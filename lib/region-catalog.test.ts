import test from "node:test";
import assert from "node:assert/strict";
import { catalogProvinces, catalogRegionById, firstRegionForProvince } from "./region-catalog";

test("national selector includes current administrative regions without transitional duplicates", () => {
  assert.equal(catalogProvinces.length, 16);
  assert.equal(catalogProvinces.reduce((sum, province) => sum + province.regions.length, 0), 262);
  assert.ok(catalogProvinces.some((province) => province.name === "전남광주통합특별시"));
  assert.ok(!catalogProvinces.some((province) => province.name === "전라남도"));
  const incheon = catalogProvinces.find((province) => province.name === "인천광역시");
  assert.ok(incheon?.regions.some((region) => region.name === "영종구"));
  assert.ok(!incheon?.regions.some((region) => region.name === "중구"));
});

test("existing measured regions retain their IDs and other regions have an unavailable state", () => {
  const wonju = catalogRegionById("wonju");
  assert.equal(wonju?.available, true);
  assert.equal(wonju?.name, "원주시");
  const busan = firstRegionForProvince("26");
  assert.equal(busan?.available, false);
  assert.ok(busan && catalogRegionById(busan.id));
});
