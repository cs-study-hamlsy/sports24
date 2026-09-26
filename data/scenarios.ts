import regions from "./regions.json";
import { calculateSupplyMetrics, describeScenario } from "../lib/simulation";

export const metricNames = ["종목 구성 유사도", "종목 다양성", "종목 편중도", "고령층 적합도", "청소년 적합도"] as const;

export const baselineMetrics = calculateSupplyMetrics(regions[0].courses);

export type Scenario = {
  id: string;
  name: string;
  changes: Record<string, number>;
  metrics: readonly (number | null)[];
  date: string;
  analysis: string[];
};

export const demoScenarios: Scenario[] = [
  {
    id: "a",
    name: "A안",
    changes: { 수영: 5, 배드민턴: 5 },
    metrics: calculateSupplyMetrics(regions[0].courses, { 수영: 5, 배드민턴: 5 }),
    date: "2026.09.21",
    analysis: describeScenario(regions[0].courses, { 수영: 5, 배드민턴: 5 }),
  },
  {
    id: "b",
    name: "B안 (AI 대안)",
    changes: { 수영: 3, 배드민턴: 3, 생활체조: 4 },
    metrics: calculateSupplyMetrics(regions[0].courses, { 수영: 3, 배드민턴: 3, 생활체조: 4 }),
    date: "2026.09.21",
    analysis: describeScenario(regions[0].courses, { 수영: 3, 배드민턴: 3, 생활체조: 4 }),
  },
  {
    id: "c",
    name: "C안 편중 완화형",
    changes: { 태권도: -2, 수영: 3, 배드민턴: 2, 생활체조: 4 },
    metrics: calculateSupplyMetrics(regions[0].courses, { 태권도: -2, 수영: 3, 배드민턴: 2, 생활체조: 4 }),
    date: "2026.09.22",
    analysis: describeScenario(regions[0].courses, { 태권도: -2, 수영: 3, 배드민턴: 2, 생활체조: 4 }),
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
