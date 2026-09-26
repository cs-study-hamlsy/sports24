export const metricNames = ["공급 적합도", "종목 다양성", "종목 편중도", "고령층 적합도", "청소년 적합도"] as const;

export const baselineMetrics = [64, 58, 41, 43, 82];

export type Scenario = {
  id: string;
  name: string;
  changes: Record<string, number>;
  metrics: number[] | null;
  date: string;
  analysis: string[];
};

export const demoScenarios: Scenario[] = [
  {
    id: "a",
    name: "A안",
    changes: { 수영: 5, 배드민턴: 5 },
    metrics: [75, 69, 35, 50, 84],
    date: "2026.09.21",
    analysis: ["청소년 적합도가 가장 높지만 고령층 적합도 개선 폭은 작습니다.", "추가 가능한 강좌 10개를 모두 사용합니다."],
  },
  {
    id: "b",
    name: "B안 (AI 대안)",
    changes: { 수영: 3, 배드민턴: 3, 생활체조: 4 },
    metrics: [83, 77, 33, 68, 79],
    date: "2026.09.21",
    analysis: ["공급 적합도·다양성·고령층 적합도가 세 안 중 가장 높습니다.", "강좌 10개를 모두 사용하고 청소년 적합도는 현재보다 낮습니다."],
  },
  {
    id: "c",
    name: "C안 편중 완화형",
    changes: { 태권도: -2, 수영: 3, 배드민턴: 2, 생활체조: 4 },
    metrics: [78, 73, 32, 62, 80],
    date: "2026.09.22",
    analysis: [
      "(개선사항) 생활체조 4개 확대로 고령층 적합도가 43 → 62로 상승하여 개선 폭이 가장 큼",
      "(미흡사항) 수영 비중 8.8%로 비교지역 평균(13.0%)에 미달, 청소년 적합도 2점 하락",
      "(검토의견) 잔여 1개 및 추가 예산 확보 시 수영 +2, 생활체조 +1 조합 추가 검토 필요",
      "(유의사항) 태권도 강좌 축소 시 기존 수강생 이동 방안 마련 필요",
    ],
  },
];

export const courseBudget = 10;

export function usedCourses(changes: Record<string, number>) {
  return Object.values(changes).reduce((sum, value) => sum + Math.max(0, value), 0);
}

export function changesLabel(changes: Record<string, number>) {
  const parts = Object.entries(changes)
    .filter(([, value]) => value !== 0)
    .map(([sport, value]) => `${sport} ${value > 0 ? "+" : ""}${value}`);
  return parts.length ? parts.join(", ") : "조정 없음";
}
