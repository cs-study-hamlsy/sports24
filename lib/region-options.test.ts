import test from "node:test";
import assert from "node:assert/strict";
import { provinceOptions, regionsForProvince } from "./region-options";

const fixture = [
  { id: "wonju", provinceId: "gangwon", provinceLabel: "강원특별자치도", shortName: "원주시" },
  { id: "chuncheon", provinceId: "gangwon", provinceLabel: "강원특별자치도", shortName: "춘천시" },
  { id: "suwon", provinceId: "gyeonggi", provinceLabel: "경기도", shortName: "수원시" },
];

test("builds one province option per province in national display order", () => {
  assert.deepEqual(provinceOptions(fixture), [
    { id: "gyeonggi", label: "경기도" },
    { id: "gangwon", label: "강원특별자치도" },
  ]);
});

test("returns only detailed regions that belong to the selected province", () => {
  assert.deepEqual(regionsForProvince(fixture, "gangwon").map((item) => item.id), ["wonju", "chuncheon"]);
});
