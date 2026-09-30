// 실측 공공데이터로 지역 인구·시설 데이터를 정제해 data/regions.json, data/candidates.ts를 갱신한다.
//   - 인구: 행정안전부 지역별 성별·연령별 주민등록 인구 (odcloud, 읍면동 단위 → 시군구 합계)
//   - 시설: 국민체육진흥공단 전국체육시설 정보 (정상운영 등록 시설 수)
//   - 강좌: 스포츠강좌 API에 지역 식별자가 없어 실측 불가 → 종목별 강좌는 시연값 유지
// 실행: node scripts/build-real-data.mjs  (.env.local의 POPULATION_API_KEY, SPORTS_FACILITY_API_KEY 사용)

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { collectPages, summarizeFacilities } from "./facility-aggregation.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// 최신 기준월 스냅샷(2026-08-31). 새 달이 공개되면 uddi/asOfMonth만 교체한다.
const POPULATION_UDDI = "uddi:5beebd9e-8733-44f8-817f-9cfa03548b7a";
const AS_OF_MONTH = "2026-08";
const POPULATION_BASE = `https://api.odcloud.kr/api/15097972/v1/${POPULATION_UDDI}`;
const FACILITY_BASE = "https://apis.data.go.kr/B551014/SRVC_API_SFMS_FACI/TODZ_API_SFMS_FACI";
const FACILITY_COLLECTED_AT = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

// 시설 조정 시뮬레이션 기준값으로 쓸 대표 공공 체육시설 유형. 값이 작을수록 유사하게 비교된다.
const FACILITY_TYPES = ["간이운동장", "체력단련장", "수영장", "축구장", "테니스장"];

// 대상 지역과 종목별 강좌(시연값). sido/sigungu는 공공데이터의 시도명/시군구명과 정확히 일치해야 한다.
const registry = {
  base: {
    id: "wonju", label: "강원 원주시", shortName: "원주시", provinceId: "gangwon", sido: "강원특별자치도", sigungu: "원주시",
    comparisonLabel: "춘천시, 강릉시, 충주시",
    courses: [
      { sport: "태권도", count: 28 }, { sport: "배드민턴", count: 7 }, { sport: "수영", count: 5 },
      { sport: "생활체조", count: 4 }, { sport: "요가·필라테스", count: 6 }, { sport: "축구", count: 8 },
      { sport: "농구", count: 4 }, { sport: "탁구", count: 6 }, { sport: "테니스", count: 4 }, { sport: "기타", count: 12 },
    ],
    analysis: [
      "태권도 강좌 비중이 다른 종목보다 높아 공급 편중 여부를 검토할 필요가 있음",
      "수영과 생활체조 강좌는 유사지역 평균과 함께 확대 여지를 검토할 수 있음",
      "세부 종목을 포함한 10개 시연 분류로 종목 구성 변화를 비교함",
    ],
  },
  candidates: [
    { id: "chuncheon", label: "강원 춘천시", shortName: "춘천시", provinceId: "gangwon", sido: "강원특별자치도", sigungu: "춘천시",
      courses: [["태권도",18],["배드민턴",9],["수영",11],["생활체조",8],["요가·필라테스",7],["축구",8],["농구",4],["탁구",6],["테니스",4],["기타",8]] },
    { id: "chungju", label: "충북 충주시", shortName: "충주시", provinceId: "chungbuk", sido: "충청북도", sigungu: "충주시",
      courses: [["태권도",16],["배드민턴",8],["수영",9],["생활체조",7],["요가·필라테스",6],["축구",7],["농구",4],["탁구",5],["테니스",4],["기타",9]] },
    { id: "jecheon", label: "충북 제천시", shortName: "제천시", provinceId: "chungbuk", sido: "충청북도", sigungu: "제천시",
      courses: [["태권도",13],["배드민턴",7],["수영",8],["생활체조",6],["요가·필라테스",5],["축구",6],["농구",3],["탁구",4],["테니스",3],["기타",8]] },
    { id: "gangneung", label: "강원 강릉시", shortName: "강릉시", provinceId: "gangwon", sido: "강원특별자치도", sigungu: "강릉시",
      courses: [["태권도",17],["배드민턴",8],["수영",12],["생활체조",6],["요가·필라테스",8],["축구",7],["농구",4],["탁구",5],["테니스",4],["기타",7]] },
    { id: "donghae", label: "강원 동해시", shortName: "동해시", provinceId: "gangwon", sido: "강원특별자치도", sigungu: "동해시",
      courses: [["태권도",8],["배드민턴",4],["수영",5],["생활체조",3],["요가·필라테스",3],["축구",4],["농구",2],["탁구",3],["테니스",2],["기타",6]] },
    { id: "hongcheon", label: "강원 홍천군", shortName: "홍천군", provinceId: "gangwon", sido: "강원특별자치도", sigungu: "홍천군",
      courses: [["태권도",6],["배드민턴",3],["수영",3],["생활체조",2],["요가·필라테스",2],["축구",4],["농구",1],["탁구",2],["테니스",2],["기타",5]] },
    { id: "gangnam", label: "서울 강남구", shortName: "강남구", provinceId: "seoul", sido: "서울특별시", sigungu: "강남구",
      courses: [["태권도",24],["배드민턴",16],["수영",12],["생활체조",10],["요가·필라테스",22],["축구",10],["농구",8],["탁구",10],["테니스",9],["기타",15]] },
    { id: "songpa", label: "서울 송파구", shortName: "송파구", provinceId: "seoul", sido: "서울특별시", sigungu: "송파구",
      courses: [["태권도",30],["배드민턴",18],["수영",15],["생활체조",14],["요가·필라테스",20],["축구",18],["농구",12],["탁구",14],["테니스",10],["기타",18]] },
    { id: "nowon", label: "서울 노원구", shortName: "노원구", provinceId: "seoul", sido: "서울특별시", sigungu: "노원구",
      courses: [["태권도",28],["배드민턴",15],["수영",12],["생활체조",16],["요가·필라테스",14],["축구",12],["농구",10],["탁구",15],["테니스",8],["기타",16]] },
    { id: "pyeongtaek", label: "경기 평택시", shortName: "평택시", provinceId: "gyeonggi", sido: "경기도", sigungu: "평택시",
      courses: [["태권도",35],["배드민턴",18],["수영",18],["생활체조",15],["요가·필라테스",16],["축구",22],["농구",14],["탁구",16],["테니스",10],["기타",20]] },
    { id: "gimpo", label: "경기 김포시", shortName: "김포시", provinceId: "gyeonggi", sido: "경기도", sigungu: "김포시",
      courses: [["태권도",30],["배드민턴",17],["수영",15],["생활체조",13],["요가·필라테스",18],["축구",18],["농구",12],["탁구",14],["테니스",9],["기타",18]] },
    { id: "paju", label: "경기 파주시", shortName: "파주시", provinceId: "gyeonggi", sido: "경기도", sigungu: "파주시",
      courses: [["태권도",38],["배드민턴",20],["수영",18],["생활체조",16],["요가·필라테스",22],["축구",25],["농구",15],["탁구",18],["테니스",14],["기타",22]] },
  ],
};

function loadEnv() {
  return readFile(join(root, ".env.local"), "utf8").then((text) => {
    const env = {};
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) env[match[1]] = match[2].trim();
    }
    return env;
  });
}

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), cache: "no-store" });
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter !== null && Number.isFinite(Number(retryAfter))) error.retryAfterSeconds = Number(retryAfter);
    throw error;
  }
  return response.json();
}

// 청소년(0~19) / 청년(20~39) / 중장년(40~64) / 고령(65+) 4구간 합계와 비율(%)을 계산한다.
async function fetchPopulation(key, sido, sigungu) {
  const cond = (field, value) => `cond%5B${encodeURIComponent(field)}%3A%3AEQ%5D=${encodeURIComponent(value)}`;
  const url = `${POPULATION_BASE}?page=1&perPage=400&serviceKey=${key}&${cond("시도명", sido)}&${cond("시군구명", sigungu)}`;
  const data = await fetchJson(url);
  const rows = data.data ?? [];
  if (!rows.length) throw new Error(`인구 데이터 없음: ${sido} ${sigungu}`);
  if (rows.length !== Number(data.matchCount)) throw new Error(`인구 데이터 페이지 누락: ${sido} ${sigungu}`);
  const buckets = [0, 0, 0, 0];
  let total = 0;
  for (const row of rows) {
    for (const [column, value] of Object.entries(row)) {
      const match = column.match(/^(\d+)세(?:이상)?\s*(?:남자|여자)$/);
      if (!match) continue;
      const age = Number(match[1]);
      const count = Number(value) || 0;
      total += count;
      buckets[age <= 19 ? 0 : age <= 39 ? 1 : age <= 64 ? 2 : 3] += count;
    }
  }
  return { totalPopulation: total, population: buckets.map((value) => Math.round((value / total) * 1000) / 10) };
}

// cpb_nm(시군구)로 조회해 정상운영 등록 체육시설 수와 대표 유형별 수를 센다. 타 시도 동명 시군구는 시도명으로 걸러낸다.
async function fetchFacilities(key, sido, sigungu) {
  const rows = await collectPages(async (pageNo, pageSize) => {
    const url = `${FACILITY_BASE}?serviceKey=${key}&pageNo=${pageNo}&numOfRows=${pageSize}&resultType=JSON&cpb_nm=${encodeURIComponent(sigungu)}`;
    const data = await fetchJson(url);
    const code = String(data?.response?.header?.resultCode ?? "");
    if (code !== "00" && code !== "0000") throw new Error(`시설 API 오류: ${code || "missing"}`);
    const body = data?.response?.body;
    const item = body?.items?.item;
    return { totalCount: Number(body?.totalCount), items: Array.isArray(item) ? item : item ? [item] : [] };
  }, { pageSize: 1000 });
  return summarizeFacilities(rows, sido, FACILITY_TYPES);
}

async function enrich(key, target) {
  const [population, facilities] = await Promise.all([
    fetchPopulation(key.pop, target.sido, target.sigungu),
    fetchFacilities(key.faci, target.sido, target.sigungu),
  ]);
  console.log(`  ${target.shortName}: 인구 ${population.totalPopulation.toLocaleString()} ${JSON.stringify(population.population)}, 시설 ${facilities.active} ${JSON.stringify(facilities.facilityTypes.map((f) => f.count))}`);
  return { ...target, ...population, facilities: facilities.active, facilityTypes: facilities.facilityTypes };
}

function shareOf(courses) {
  const total = courses.reduce((sum, course) => sum + course.count, 0) || 1;
  return courses.map((course) => ({ ...course, share: Math.round((course.count / total) * 1000) / 10 }));
}

async function main() {
  const env = await loadEnv();
  const key = { pop: env.POPULATION_API_KEY, faci: env.SPORTS_FACILITY_API_KEY };
  if (!key.pop || !key.faci) throw new Error("POPULATION_API_KEY 또는 SPORTS_FACILITY_API_KEY가 .env.local에 없습니다.");

  console.log("실측 데이터 수집 중 (기준월", AS_OF_MONTH + ")...");
  const base = await enrich(key, registry.base);
  const candidates = [];
  for (const candidate of registry.candidates) {
    candidates.push(await enrich(key, { ...candidate, courses: candidate.courses.map(([sport, count]) => ({ sport, count })) }));
  }

  // data/regions.json (기준지역)
  const courses = shareOf(base.courses);
  const regionJson = [{
    id: base.id, label: base.label, shortName: base.shortName, provinceId: base.provinceId, provinceLabel: base.sido, comparisonLabel: base.comparisonLabel,
    asOfMonth: AS_OF_MONTH,
    facilityCollectedAt: FACILITY_COLLECTED_AT,
    totalPopulation: base.totalPopulation, facilities: base.facilities, facilityTypes: base.facilityTypes,
    population: { region: base.population, comparison: base.population },
    courses: courses.map((course) => ({ ...course, comparison: course.share })),
    analysis: base.analysis,
  }];
  await writeFile(join(root, "data/regions.json"), JSON.stringify(regionJson, null, 2) + "\n", "utf8");

  // data/candidates.ts
  const entries = candidates.map((candidate) => `  {
    id: ${JSON.stringify(candidate.id)},
    label: ${JSON.stringify(candidate.label)},
    shortName: ${JSON.stringify(candidate.shortName)},
    provinceId: ${JSON.stringify(candidate.provinceId)},
    provinceLabel: ${JSON.stringify(candidate.sido)},
    totalPopulation: ${candidate.totalPopulation},
    population: [${candidate.population.join(", ")}],
    facilities: ${candidate.facilities},
    facilityTypes: [${candidate.facilityTypes.map((f) => `{ type: ${JSON.stringify(f.type)}, count: ${f.count} }`).join(", ")}],
    courses: [
${candidate.courses.map((course) => `      { sport: ${JSON.stringify(course.sport)}, count: ${course.count} },`).join("\n")}
    ],
  },`).join("\n");
  const ts = `// 유사 지역 선정용 후보 데이터.
// 인구(totalPopulation, population)는 ${AS_OF_MONTH} 기준, 시설 수(facilities)는 ${FACILITY_COLLECTED_AT} 조회 실측값이다.
// 종목별 강좌(courses)는 지역 식별자가 없는 스포츠강좌 API 한계로 시연값을 유지한다.
// scripts/build-real-data.mjs로 재생성한다. 직접 수정하지 말 것.

export type CandidateRegion = {
  id: string;
  label: string;
  shortName: string;
  provinceId: string;
  provinceLabel: string;
  /** 총 주민등록 인구 (실측, 기준월 ${AS_OF_MONTH}) */
  totalPopulation: number;
  /** 연령 구성 비율(%) 청소년(0~19) / 청년(20~39) / 중장년(40~64) / 고령(65+), 합 100 */
  population: [number, number, number, number];
  /** 시·도 주소가 확인된 정상운영 등록 체육시설 수 (실측) */
  facilities: number;
  /** 대표 유형별 정상운영 시설 수 (실측) */
  facilityTypes: { type: string; count: number }[];
  /** 종목별 등록 강좌 수 (시연값) */
  courses: { sport: string; count: number }[];
};

export const candidates: CandidateRegion[] = [
${entries}
];
`;
  await writeFile(join(root, "data/candidates.ts"), ts, "utf8");
  console.log("완료: data/regions.json, data/candidates.ts 갱신");
}

main().catch((error) => { console.error("실패:", error.message); process.exit(1); });
