import regionsData from "../data/regions.json";
import { candidates, type CandidateRegion } from "../data/candidates";

// 유사 지역 선정과 비교지역 평균 계산을 코드로 수행한다.
// 모든 입력은 시연값이며, 실측 정제 데이터가 확보되면 data/*를 교체하면 결과가 다시 계산된다.

type RawRegion = {
  id: string;
  label: string;
  shortName: string;
  comparisonLabel: string;
  asOfMonth?: string;
  totalPopulation: number;
  facilities: number;
  population: { region: number[]; comparison: number[] };
  courses: { sport: string; count: number; share: number; comparison: number }[];
  analysis: string[];
};

const base = (regionsData as RawRegion[])[0];

/** 인구·시설 실측 데이터의 기준월(YYYY-MM). 강좌 데이터는 시연값이다. */
export const asOfMonth = base.asOfMonth ?? "";

/** 후보 지역이 기준지역과 얼마나 다른지를 0(동일)에 가까울수록 유사하게 계산한다. */
export type PeerDistance = {
  region: CandidateRegion;
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

function relativeGap(a: number, b: number) {
  const larger = Math.max(a, b, 1);
  return (Math.abs(a - b) / larger) * 100;
}

function totalCourses(courses: { count: number }[]) {
  return courses.reduce((sum, course) => sum + course.count, 0);
}

export function peerDistance(candidate: CandidateRegion): PeerDistance {
  const populationGap = base.population.region.reduce((sum, value, index) => sum + Math.abs(value - candidate.population[index]), 0) / 2;
  const sizeGap = relativeGap(base.totalPopulation, candidate.totalPopulation);
  const courseGap = relativeGap(totalCourses(base.courses), totalCourses(candidate.courses));
  const facilityGap = relativeGap(base.facilities, candidate.facilities);
  const distance = WEIGHTS.population * populationGap + WEIGHTS.size * sizeGap + WEIGHTS.course * courseGap + WEIGHTS.facility * facilityGap;
  return {
    region: candidate,
    populationGap: Math.round(populationGap * 10) / 10,
    sizeGap: Math.round(sizeGap * 10) / 10,
    courseGap: Math.round(courseGap * 10) / 10,
    facilityGap: Math.round(facilityGap * 10) / 10,
    distance: Math.round(distance * 10) / 10,
    similarity: Math.max(0, Math.round(100 - distance)),
  };
}

export const PEER_COUNT = 3;

/** 전체 후보의 거리를 계산해 유사한 순서로 정렬한다. */
export const rankedPeers: PeerDistance[] = candidates
  .map(peerDistance)
  .sort((left, right) => left.distance - right.distance);

/** 선정된 상위 유사 지역 */
export const similarPeers: PeerDistance[] = rankedPeers.slice(0, PEER_COUNT);

const selectedRegions = similarPeers.map((peer) => peer.region);

function peerShareAverage(sport: string) {
  const shares = selectedRegions.map((peer) => {
    const total = totalCourses(peer.courses) || 1;
    return ((peer.courses.find((course) => course.sport === sport)?.count ?? 0) / total) * 100;
  });
  return shares.reduce((sum, value) => sum + value, 0) / (shares.length || 1);
}

function peerPopulationAverage(index: number) {
  const values = selectedRegions.map((peer) => peer.population[index]);
  return values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
}

const baseTotal = totalCourses(base.courses) || 1;

// 선정된 유사 지역에서 계산한 종목별 비중 평균과 연령 구성 평균을 기준지역 비교값으로 사용한다.
export const region = {
  ...base,
  comparisonLabel: selectedRegions.map((peer) => peer.shortName).join(", "),
  population: {
    region: base.population.region,
    comparison: base.population.comparison.map((_, index) => Math.round(peerPopulationAverage(index) * 10) / 10),
  },
  courses: base.courses.map((course) => ({
    ...course,
    share: Math.round((course.count / baseTotal) * 1000) / 10,
    comparison: Math.round(peerShareAverage(course.sport) * 10) / 10,
  })),
};

export const regions = [region];
