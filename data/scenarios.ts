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

/** 이전 시연 세션에 저장된 B안 표시명을 현재 안내 문구에 맞춘다. */
export function normalizeScenario(scenario: Scenario): Scenario {
  return scenario.id === "b" && scenario.name === "B안 (AI 대안)"
    ? { ...scenario, name: "B안 (대안 예시)" }
    : scenario;
}

// 지역과 무관한 강좌 조정 예시. 선택한 지역의 강좌 위에서 지표·분석을 다시 계산한다.
export const scenarioTemplates: { id: string; name: string; changes: Record<string, number>; date: string }[] = [
  { id: "a", name: "A안", changes: { 수영: 5, 배드민턴: 5 }, date: "2026.09.21" },
  { id: "b", name: "B안 (대안 예시)", changes: { 수영: 3, 배드민턴: 3, 생활체조: 4 }, date: "2026.09.21" },
  { id: "c", name: "C안 편중 완화형", changes: { 태권도: -2, 수영: 3, 배드민턴: 2, 생활체조: 4 }, date: "2026.09.22" },
  { id: "d", name: "D안 구기종목 확장형", changes: { 축구: 4, 농구: 3, 탁구: 3 }, date: "2026.09.23" },
  { id: "e", name: "E안 생활체육 균형형", changes: { 생활체조: 3, 요가·필라테스: 3, 탁구: 2, 테니스: 2 }, date: "2026.09.24" },
  { id: "f", name: "F안 수영·테니스 보완형", changes: { 수영: 5, 테니스: 3, 배드민턴: 2 }, date: "2026.09.25" },
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

export const demoDataVersion = 2;

/**
 * 버전이 없는 이전 세션에는 새 시연안을 보충하되, 현재 버전에서 사용자가
 * 삭제한 시나리오는 다시 만들지 않는다.
 */
export function restoreDemoScenariosFor(region: Region, saved: Scenario[], storedVersion?: number): Scenario[] {
  const normalized = saved.map(normalizeScenario);
  if (storedVersion === demoDataVersion) return normalized;
  const savedIds = new Set(normalized.map((scenario) => scenario.id));
  return [...normalized, ...demoScenariosFor(region).filter((scenario) => !savedIds.has(scenario.id))];
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
