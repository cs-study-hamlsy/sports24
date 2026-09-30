import test from "node:test";
import assert from "node:assert/strict";
import { regions } from "../lib/regions";
import { courseBudget, demoDataVersion, demoScenariosFor, restoreDemoScenariosFor, scenarioTemplates, usedCourses } from "./scenarios";

test("demo offers hierarchical coverage across four provinces and thirteen detailed regions", () => {
  assert.equal(regions.length, 13);
  assert.deepEqual([...new Set(regions.map((item) => item.provinceLabel))], [
    "강원특별자치도",
    "충청북도",
    "서울특별시",
    "경기도",
  ]);
});

test("every detailed region has ten comparable sport rows", () => {
  for (const item of regions) {
    assert.equal(item.courses.length, 10, item.label);
    assert.ok(item.analysis.length >= 3, `${item.label} 분석의견`);
  }
});

test("six demo scenarios stay within the course budget", () => {
  assert.equal(scenarioTemplates.length, 6);
  for (const scenario of scenarioTemplates) {
    assert.ok(usedCourses(scenario.changes) <= courseBudget, scenario.name);
  }
});

test("older sessions receive newly added demo scenarios without losing saved scenarios", () => {
  const oldDefaults = demoScenariosFor(regions[0]).slice(0, 3);
  const saved = { ...oldDefaults[0], id: "saved-example", name: "담당자 저장안" };
  const merged = restoreDemoScenariosFor(regions[0], [...oldDefaults, saved]);
  assert.deepEqual(merged.map((item) => item.id), ["a", "b", "c", "saved-example", "d", "e", "f"]);
});

test("current-version sessions keep deliberate scenario removals", () => {
  const remaining = demoScenariosFor(regions[0]).filter((item) => item.id !== "a");
  const restored = restoreDemoScenariosFor(regions[0], remaining, demoDataVersion);
  assert.deepEqual(restored.map((item) => item.id), ["b", "c", "d", "e", "f"]);
});
