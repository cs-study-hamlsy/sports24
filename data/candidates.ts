// 유사 지역 선정용 후보 데이터.
// 인구(totalPopulation, population)와 시설 수(facilities)는 실측 공공데이터(기준월 2026-08)다.
// 종목별 강좌(courses)는 지역 식별자가 없는 스포츠강좌 API 한계로 시연값을 유지한다.
// scripts/build-real-data.mjs로 재생성한다. 직접 수정하지 말 것.

export type CandidateRegion = {
  id: string;
  label: string;
  shortName: string;
  /** 총 주민등록 인구 (실측, 기준월 2026-08) */
  totalPopulation: number;
  /** 연령 구성 비율(%) 청소년(0~19) / 청년(20~39) / 중장년(40~64) / 고령(65+), 합 100 */
  population: [number, number, number, number];
  /** 정상운영 등록 체육시설 수 (실측) */
  facilities: number;
  /** 대표 유형별 정상운영 시설 수 (실측) */
  facilityTypes: { type: string; count: number }[];
  /** 종목별 등록 강좌 수 (시연값) */
  courses: { sport: string; count: number }[];
};

export const candidates: CandidateRegion[] = [
  {
    id: "chuncheon",
    label: "강원 춘천시",
    shortName: "춘천시",
    totalPopulation: 284783,
    population: [14.9, 24.3, 37.3, 23.5],
    facilities: 983,
    facilityTypes: [{ type: "간이운동장", count: 494 }, { type: "체력단련장", count: 114 }, { type: "수영장", count: 4 }, { type: "축구장", count: 5 }, { type: "테니스장", count: 3 }],
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
    totalPopulation: 205691,
    population: [13.4, 20.4, 39.2, 26.9],
    facilities: 871,
    facilityTypes: [{ type: "간이운동장", count: 535 }, { type: "체력단련장", count: 53 }, { type: "수영장", count: 3 }, { type: "축구장", count: 9 }, { type: "테니스장", count: 3 }],
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
    totalPopulation: 127898,
    population: [13, 18.7, 38.1, 30.2],
    facilities: 326,
    facilityTypes: [{ type: "간이운동장", count: 97 }, { type: "체력단련장", count: 33 }, { type: "수영장", count: 1 }, { type: "축구장", count: 3 }, { type: "테니스장", count: 6 }],
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
    totalPopulation: 205440,
    population: [12.7, 19.6, 39.1, 28.6],
    facilities: 909,
    facilityTypes: [{ type: "간이운동장", count: 588 }, { type: "체력단련장", count: 57 }, { type: "수영장", count: 3 }, { type: "축구장", count: 3 }, { type: "테니스장", count: 3 }],
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
    totalPopulation: 85534,
    population: [14.3, 17.9, 40.3, 27.5],
    facilities: 336,
    facilityTypes: [{ type: "간이운동장", count: 163 }, { type: "체력단련장", count: 23 }, { type: "수영장", count: 2 }, { type: "축구장", count: 3 }, { type: "테니스장", count: 2 }],
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
    totalPopulation: 65817,
    population: [10.6, 15.2, 36.9, 37.3],
    facilities: 260,
    facilityTypes: [{ type: "간이운동장", count: 54 }, { type: "체력단련장", count: 11 }, { type: "수영장", count: 4 }, { type: "축구장", count: 8 }, { type: "테니스장", count: 6 }],
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
