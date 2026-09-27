import type { Region } from "../lib/regions";
import { calculateSupplyMetrics, describeScenario } from "../lib/simulation";

export const metricNames = ["종목 구성 유사도", "종목 다양성", "종목 편중도", "고령층 적합도", "청소년 적합도"] as const;

export type Scenario = {
  id: string;
  name: string;
  changes: Record<string, number>;
  metrics: readonly (number | null)[];
  date: string;
  analysis: string[];
};

// 지역과 무관한 강좌 조정 예시. 선택한 지역의 강좌 위에서 지표·분석을 다시 계산한다.
export const scenarioTemplates: { id: string; name: string; changes: Record<string, number>; date: string }[] = [
  { id: "a", name: "A안", changes: { 수영: 5, 배드민턴: 5 }, date: "2026.09.21" },
  { id: "b", name: "B안 (AI 대안)", changes: { 수영: 3, 배드민턴: 3, 생활체조: 4 }, date: "2026.09.21" },
  { id: "c", name: "C안 편중 완화형", changes: { 태권도: -2, 수영: 3, 배드민턴: 2, 생활체조: 4 }, date: "2026.09.22" },
];

/** 선택한 지역의 현재 종목 구성 지표. */
export function baselineFor(region: Region) {
  return calculateSupplyMetrics(region.courses);
}

/** 예시 시나리오를 선택한 지역 기준으로 계산해 반환한다. */
export function demoScenariosFor(region: Region): Scenario[] {
  return scenarioTemplates.map((template) => ({
    ...template,
    metrics: calculateSupplyMetrics(region.courses, template.changes),
    analysis: describeScenario(region.courses, template.changes),
  }));
}

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
