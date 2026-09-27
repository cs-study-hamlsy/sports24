import regionsData from "../data/regions.json";
import { candidates } from "../data/candidates";

// 유사 지역 선정과 비교지역 평균 계산을 코드로 수행한다.
// 인구(totalPopulation, population)와 시설 수(facilities)는 실측값, 종목별 강좌는 시연값이다.
// data/*를 교체하면(예: npm run build-data) 모든 결과가 다시 계산된다.

type RawRegion = {
  id: string;
  label: string;
  shortName: string;
  comparisonLabel?: string;
  asOfMonth?: string;
  totalPopulation: number;
  facilities: number;
  /** 연령 구성 비율(%) 청소년 / 청년 / 중장년 / 고령 */
  population: number[];
  courses: { sport: string; count: number }[];
  analysis?: string[];
};

const baseData = (regionsData as {
  id: string; label: string; shortName: string; asOfMonth?: string;
  totalPopulation: number; facilities: number;
  population: { region: number[]; comparison: number[] };
  courses: { sport: string; count: number }[]; analysis?: string[];
}[])[0];

// 기준지역(원주)과 후보 지역을 동일한 원시 형태로 합쳐 모두 조회 가능한 지역으로 다룬다.
const rawRegions: RawRegion[] = [
  {
    id: baseData.id, label: baseData.label, shortName: baseData.shortName,
    asOfMonth: baseData.asOfMonth, totalPopulation: baseData.totalPopulation, facilities: baseData.facilities,
    population: baseData.population.region,
    courses: baseData.courses.map((course) => ({ sport: course.sport, count: course.count })),
    analysis: baseData.analysis,
  },
  ...candidates.map((candidate) => ({
    id: candidate.id, label: candidate.label, shortName: candidate.shortName,
    totalPopulation: candidate.totalPopulation, facilities: candidate.facilities,
    population: [...candidate.population],
    courses: candidate.courses.map((course) => ({ sport: course.sport, count: course.count })),
  })),
];

/** 두 지역이 얼마나 다른지를 0(동일)에 가까울수록 유사하게 계산한 결과. */
export type PeerDistance = {
  region: RawRegion;
  /** 연령 구성 차이(%p 절대합의 1/2, 0~100) */
  populationGap: number;
  /** 인구 규모 상대 차이(%) */
  sizeGap: number;
  /** 강좌 총량 상대 차이(%) */
  courseGap: number;
  /** 시설 수 상대 차이(%) */
  facilityGap: number;
  /** 가중 종합 거리(작을수록 유사) */
  distance: number;
  /** 유사도 점수(100 − 거리, 0~100) */
  similarity: number;
};

// 가중치: 연령 구성 유사성을 가장 크게 보고, 인구 규모·강좌 총량·시설 수 순으로 반영한다.
const WEIGHTS = { population: 0.4, size: 0.3, course: 0.15, facility: 0.15 } as const;
export const PEER_COUNT = 3;

function relativeGap(a: number, b: number) {
  return (Math.abs(a - b) / Math.max(a, b, 1)) * 100;
}

function totalCourses(courses: { count: number }[]) {
  return courses.reduce((sum, course) => sum + course.count, 0);
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function distanceBetween(target: RawRegion, other: RawRegion): PeerDistance {
  const populationGap = target.population.reduce((sum, value, index) => sum + Math.abs(value - (other.population[index] ?? 0)), 0) / 2;
  const sizeGap = relativeGap(target.totalPopulation, other.totalPopulation);
  const courseGap = relativeGap(totalCourses(target.courses), totalCourses(other.courses));
  const facilityGap = relativeGap(target.facilities, other.facilities);
  const distance = WEIGHTS.population * populationGap + WEIGHTS.size * sizeGap + WEIGHTS.course * courseGap + WEIGHTS.facility * facilityGap;
  return {
    region: other,
    populationGap: round1(populationGap), sizeGap: round1(sizeGap), courseGap: round1(courseGap), facilityGap: round1(facilityGap),
    distance: round1(distance), similarity: Math.max(0, Math.round(100 - distance)),
  };
}

function peerShareAverage(peers: RawRegion[], sport: string) {
  const shares = peers.map((peer) => ((peer.courses.find((course) => course.sport === sport)?.count ?? 0) / (totalCourses(peer.courses) || 1)) * 100);
  return shares.reduce((sum, value) => sum + value, 0) / (shares.length || 1);
}

// 종목 구성 차이에서 가장 두드러진 과다·과소 종목을 문장으로 만든다(강좌는 시연값 기준).
function describeGaps(courses: { sport: string; share: number; comparison: number }[]) {
  const rated = courses.filter((course) => course.sport !== "기타").map((course) => ({ ...course, gap: course.share - course.comparison }));
  if (!rated.length) return [] as string[];
  const high = [...rated].sort((left, right) => right.gap - left.gap)[0];
  const low = [...rated].sort((left, right) => left.gap - right.gap)[0];
  const lines: string[] = [];
  if (high && high.gap > 0.5) lines.push(`${high.sport} 강좌 비중이 ${high.share.toFixed(1)}%로 유사지역 평균(${high.comparison.toFixed(1)}%) 대비 ${high.gap.toFixed(1)}%p 높음`);
  if (low && low.gap < -0.5) lines.push(`${low.sport} 강좌 비중이 ${low.share.toFixed(1)}%로 유사지역 평균(${low.comparison.toFixed(1)}%) 대비 ${Math.abs(low.gap).toFixed(1)}%p 낮음`);
  return lines;
}

function enrich(target: RawRegion) {
  const rankedPeers = rawRegions.filter((other) => other.id !== target.id).map((other) => distanceBetween(target, other)).sort((left, right) => left.distance - right.distance);
  const similarPeers = rankedPeers.slice(0, PEER_COUNT);
  const peerRegions = similarPeers.map((peer) => peer.region);
  const total = totalCourses(target.courses) || 1;
  const courses = target.courses.map((course) => ({
    sport: course.sport, count: course.count,
    share: round1((course.count / total) * 100),
    comparison: round1(peerShareAverage(peerRegions, course.sport)),
  }));
  const population = {
    region: target.population,
    comparison: target.population.map((_, index) => round1(peerRegions.reduce((sum, peer) => sum + (peer.population[index] ?? 0), 0) / (peerRegions.length || 1))),
  };
  const analysis = target.analysis?.length ? target.analysis : describeGaps(courses);
  return {
    id: target.id, label: target.label, shortName: target.shortName, asOfMonth: asOfMonth,
    totalPopulation: target.totalPopulation, facilities: target.facilities,
    comparisonLabel: peerRegions.map((peer) => peer.shortName).join(", "),
    population, courses, analysis, rankedPeers, similarPeers,
  };
}

/** 인구·시설 실측 데이터의 기준월(YYYY-MM). 강좌 데이터는 시연값이다. */
export const asOfMonth = baseData.asOfMonth ?? "";

/** 조회 가능한 모든 지역(기준지역 + 후보). 각 지역은 자기 유사지역과 비교값을 코드로 계산해 갖는다. */
export const regions = rawRegions.map(enrich);

export type Region = (typeof regions)[number];

export function getRegion(id: string): Region {
  return regions.find((region) => region.id === id) ?? regions[0];
}

/** 기본 기준지역(원주). 단일 지역을 쓰는 화면에서 사용한다. */
export const region = getRegion(baseData.id);

// 유사지역 비교 화면 등 기본 지역 기준으로 동작하는 화면용 단축 export.
export const rankedPeers = region.rankedPeers;
export const similarPeers = region.similarPeers;
