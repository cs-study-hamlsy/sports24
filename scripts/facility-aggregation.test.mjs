import test from "node:test";
import assert from "node:assert/strict";
import { summarizeFacilities, collectPages } from "./facility-aggregation.mjs";

test("counts only normal facilities with an explicit matching province", () => {
  const rows = [
    { faci_stat_nm: "정상운영", addr_ctpv_nm: "강원특별자치도", ftype_nm: "수영장" },
    { faci_stat_nm: "정상운영", addr_ctpv_nm: "", ftype_nm: "수영장" },
    { faci_stat_nm: "정상운영", addr_ctpv_nm: "세종특별자치시", ftype_nm: "수영장" },
    { faci_stat_nm: "비정상운영", addr_ctpv_nm: "강원특별자치도", ftype_nm: "수영장" },
    { faci_stat_nm: "폐업", addr_ctpv_nm: "강원특별자치도", ftype_nm: "수영장" },
  ];
  assert.deepEqual(summarizeFacilities(rows, "강원특별자치도", ["수영장"]), {
    active: 1, facilityTypes: [{ type: "수영장", count: 1 }],
  });
});

test("collects every page and rejects a partial API result", async () => {
  const page = (pageNo) => ({ totalCount: 3, items: pageNo === 1 ? [1, 2] : [3] });
  assert.deepEqual(await collectPages(page, { pageSize: 2, wait: async () => {} }), [1, 2, 3]);
  await assert.rejects(
    collectPages(async (pageNo) => ({ totalCount: 3, items: pageNo === 1 ? [1, 2] : [] }), { pageSize: 2, wait: async () => {} }),
    /expected 3 rows, received 2/,
  );
});

test("retries rate limits without skipping a page", async () => {
  let attempts = 0;
  const rows = await collectPages(async () => {
    attempts++;
    if (attempts === 1) throw Object.assign(new Error("HTTP 429"), { status: 429 });
    return { totalCount: 1, items: ["facility"] };
  }, { pageSize: 2, wait: async () => {} });
  assert.deepEqual(rows, ["facility"]);
  assert.equal(attempts, 2);
});
