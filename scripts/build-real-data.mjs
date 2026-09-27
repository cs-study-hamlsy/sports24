// 실측 공공데이터로 지역 인구·시설 데이터를 정제해 data/regions.json, data/candidates.ts를 갱신한다.
//   - 인구: 행정안전부 지역별 성별·연령별 주민등록 인구 (odcloud, 읍면동 단위 → 시군구 합계)
//   - 시설: 국민체육진흥공단 전국체육시설 정보 (정상운영 등록 시설 수)
//   - 강좌: 스포츠강좌 API에 지역 식별자가 없어 실측 불가 → 종목별 강좌는 시연값 유지
// 실행: node scripts/build-real-data.mjs  (.env.local의 POPULATION_API_KEY, SPORTS_FACILITY_API_KEY 사용)

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// 최신 기준월 스냅샷(2026-08-31). 새 달이 공개되면 uddi/asOfMonth만 교체한다.
const POPULATION_UDDI = "uddi:5beebd9e-8733-44f8-817f-9cfa03548b7a";
const AS_OF_MONTH = "2026-08";
const POPULATION_BASE = `https://api.odcloud.kr/api/15097972/v1/${POPULATION_UDDI}`;
const FACILITY_BASE = "https://apis.data.go.kr/B551014/SRVC_API_SFMS_FACI/TODZ_API_SFMS_FACI";

// 대상 지역과 종목별 강좌(시연값). sido/sigungu는 공공데이터의 시도명/시군구명과 정확히 일치해야 한다.
const registry = {
  base: {
    id: "wonju", label: "강원 원주시", shortName: "원주시", sido: "강원특별자치도", sigungu: "원주시",
    comparisonLabel: "춘천시, 강릉시, 충주시",
    courses: [
      { sport: "태권도", count: 32 }, { sport: "배드민턴", count: 7 }, { sport: "수영", count: 5 },
      { sport: "생활체조", count: 4 }, { sport: "요가·필라테스", count: 6 }, { sport: "기타", count: 30 },
    ],
    analysis: [
      "태권도 강좌가 전체의 38.1%로 유사지역 평균(24.2%) 대비 13.9%p 높음",
      "수영 강좌 비중 6.0%로 유사지역 평균(13.5%)의 약 1/2 수준",
      "고령인구 비율이 유사지역보다 높으나 생활체조 강좌는 4개에 불과함",
    ],
  },
  candidates: [
    { id: "chuncheon", label: "강원 춘천시", shortName: "춘천시", sido: "강원특별자치도", sigungu: "춘천시",
      courses: [["태권도",20],["배드민턴",9],["수영",11],["생활체조",8],["요가·필라테스",7],["기타",28]] },
    { id: "chungju", label: "충북 충주시", shortName: "충주시", sido: "충청북도", sigungu: "충주시",
      courses: [["태권도",18],["배드민턴",8],["수영",9],["생활체조",7],["요가·필라테스",6],["기타",27]] },
    { id: "jecheon", label: "충북 제천시", shortName: "제천시", sido: "충청북도", sigungu: "제천시",
      courses: [["태권도",15],["배드민턴",7],["수영",8],["생활체조",6],["요가·필라테스",5],["기타",22]] },
    { id: "gangneung", label: "강원 강릉시", shortName: "강릉시", sido: "강원특별자치도", sigungu: "강릉시",
      courses: [["태권도",19],["배드민턴",8],["수영",12],["생활체조",6],["요가·필라테스",8],["기타",25]] },
    { id: "donghae", label: "강원 동해시", shortName: "동해시", sido: "강원특별자치도", sigungu: "동해시",
      courses: [["태권도",10],["배드민턴",4],["수영",5],["생활체조",3],["요가·필라테스",3],["기타",15]] },
    { id: "hongcheon", label: "강원 홍천군", shortName: "홍천군", sido: "강원특별자치도", sigungu: "홍천군",
      courses: [["태권도",8],["배드민턴",3],["수영",3],["생활체조",2],["요가·필라테스",2],["기타",12]] },
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
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
}

// 청소년(0~19) / 청년(20~39) / 중장년(40~64) / 고령(65+) 4구간 합계와 비율(%)을 계산한다.
async function fetchPopulation(key, sido, sigungu) {
  const cond = (field, value) => `cond%5B${encodeURIComponent(field)}%3A%3AEQ%5D=${encodeURIComponent(value)}`;
  const url = `${POPULATION_BASE}?page=1&perPage=400&serviceKey=${key}&${cond("시도명", sido)}&${cond("시군구명", sigungu)}`;
  const data = await fetchJson(url);
  const rows = data.data ?? [];
  if (!rows.length) throw new Error(`인구 데이터 없음: ${sido} ${sigungu}`);
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

// cpb_nm(시군구)로 조회해 정상운영 등록 체육시설 수를 센다. 타 시도 동명 시군구는 시도명으로 걸러낸다.
async function fetchFacilityCount(key, sido, sigungu) {
  let pageNo = 1;
  let total = Infinity;
  let active = 0;
  let fetched = 0;
  while (fetched < total) {
    const url = `${FACILITY_BASE}?serviceKey=${key}&pageNo=${pageNo}&numOfRows=1000&resultType=JSON&cpb_nm=${encodeURIComponent(sigungu)}`;
    const data = await fetchJson(url);
    const body = data?.response?.body;
    total = Number(body?.totalCount) || 0;
    const item = body?.items?.item;
    const rows = Array.isArray(item) ? item : item ? [item] : [];
    if (!rows.length) break;
    for (const row of rows) {
      const status = String(row.faci_stat_nm ?? "");
      const ctpv = String(row.addr_ctpv_nm ?? "").trim();
      if (status.includes("정상") && (ctpv === "" || ctpv === sido)) active++;
    }
    fetched += rows.length;
    pageNo++;
    if (pageNo > 30) break;
  }
  return active;
}

async function enrich(key, target) {
  const [population, facilities] = await Promise.all([
    fetchPopulation(key.pop, target.sido, target.sigungu),
    fetchFacilityCount(key.faci, target.sido, target.sigungu),
  ]);
  console.log(`  ${target.shortName}: 인구 ${population.totalPopulation.toLocaleString()} ${JSON.stringify(population.population)}, 시설 ${facilities}`);
  return { ...target, ...population, facilities };
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
    id: base.id, label: base.label, shortName: base.shortName, comparisonLabel: base.comparisonLabel,
    asOfMonth: AS_OF_MONTH,
    totalPopulation: base.totalPopulation, facilities: base.facilities,
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
    totalPopulation: ${candidate.totalPopulation},
    population: [${candidate.population.join(", ")}],
    facilities: ${candidate.facilities},
    courses: [
${candidate.courses.map((course) => `      { sport: ${JSON.stringify(course.sport)}, count: ${course.count} },`).join("\n")}
    ],
  },`).join("\n");
  const ts = `// 유사 지역 선정용 후보 데이터.
// 인구(totalPopulation, population)와 시설 수(facilities)는 실측 공공데이터(기준월 ${AS_OF_MONTH})다.
// 종목별 강좌(courses)는 지역 식별자가 없는 스포츠강좌 API 한계로 시연값을 유지한다.
// scripts/build-real-data.mjs로 재생성한다. 직접 수정하지 말 것.

export type CandidateRegion = {
  id: string;
  label: string;
  shortName: string;
  /** 총 주민등록 인구 (실측, 기준월 ${AS_OF_MONTH}) */
  totalPopulation: number;
  /** 연령 구성 비율(%) 청소년(0~19) / 청년(20~39) / 중장년(40~64) / 고령(65+), 합 100 */
  population: [number, number, number, number];
  /** 정상운영 등록 체육시설 수 (실측) */
  facilities: number;
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
