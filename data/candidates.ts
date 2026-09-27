// 유사 지역 선정용 후보 데이터. 모두 공모전 시연값이며 실제 행정통계가 아니다.
// 실측 정제 데이터가 확보되면 이 파일을 교체하고 lib/regions.ts의 선정 결과를 다시 계산한다.

export type CandidateRegion = {
  id: string;
  label: string;
  shortName: string;
  /** 총 주민등록 인구 (시연값) */
  totalPopulation: number;
  /** 연령 구성 비율(%) 청소년 / 청년 / 중장년 / 고령(65세 이상), 합 100 */
  population: [number, number, number, number];
  /** 등록 체육시설 수 (시연값) */
  facilities: number;
  /** 종목별 등록 강좌 수 (시연값) */
  courses: { sport: string; count: number }[];
};

export const candidates: CandidateRegion[] = [
  {
    id: "chuncheon",
    label: "강원 춘천시",
    shortName: "춘천시",
    totalPopulation: 290000,
    population: [13, 20, 45, 22],
    facilities: 24,
    courses: [
      { sport: "태권도", count: 20 },
      { sport: "배드민턴", count: 9 },
      { sport: "수영", count: 11 },
      { sport: "생활체조", count: 8 },
      { sport: "요가·필라테스", count: 7 },
      { sport: "기타", count: 28 },
    ],
  },
  {
    id: "chungju",
    label: "충북 충주시",
    shortName: "충주시",
    totalPopulation: 210000,
    population: [14, 18, 44, 24],
    facilities: 20,
    courses: [
      { sport: "태권도", count: 18 },
      { sport: "배드민턴", count: 8 },
      { sport: "수영", count: 9 },
      { sport: "생활체조", count: 7 },
      { sport: "요가·필라테스", count: 6 },
      { sport: "기타", count: 27 },
    ],
  },
  {
    id: "jecheon",
    label: "충북 제천시",
    shortName: "제천시",
    totalPopulation: 130000,
    population: [13, 17, 45, 25],
    facilities: 15,
    courses: [
      { sport: "태권도", count: 15 },
      { sport: "배드민턴", count: 7 },
      { sport: "수영", count: 8 },
      { sport: "생활체조", count: 6 },
      { sport: "요가·필라테스", count: 5 },
      { sport: "기타", count: 22 },
    ],
  },
  {
    id: "gangneung",
    label: "강원 강릉시",
    shortName: "강릉시",
    totalPopulation: 200000,
    population: [11, 22, 45, 22],
    facilities: 22,
    courses: [
      { sport: "태권도", count: 19 },
      { sport: "배드민턴", count: 8 },
      { sport: "수영", count: 12 },
      { sport: "생활체조", count: 6 },
      { sport: "요가·필라테스", count: 8 },
      { sport: "기타", count: 25 },
    ],
  },
  {
    id: "donghae",
    label: "강원 동해시",
    shortName: "동해시",
    totalPopulation: 87000,
    population: [13, 16, 46, 25],
    facilities: 9,
    courses: [
      { sport: "태권도", count: 10 },
      { sport: "배드민턴", count: 4 },
      { sport: "수영", count: 5 },
      { sport: "생활체조", count: 3 },
      { sport: "요가·필라테스", count: 3 },
      { sport: "기타", count: 15 },
    ],
  },
  {
    id: "hongcheon",
    label: "강원 홍천군",
    shortName: "홍천군",
    totalPopulation: 68000,
    population: [11, 15, 45, 29],
    facilities: 8,
    courses: [
      { sport: "태권도", count: 8 },
      { sport: "배드민턴", count: 3 },
      { sport: "수영", count: 3 },
      { sport: "생활체조", count: 2 },
      { sport: "요가·필라테스", count: 2 },
      { sport: "기타", count: 12 },
    ],
  },
];
