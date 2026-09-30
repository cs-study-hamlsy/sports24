export function summarizeFacilities(rows, province, facilityTypes) {
  const byType = Object.fromEntries(facilityTypes.map((type) => [type, 0]));
  let active = 0;
  for (const row of rows) {
    if (String(row.faci_stat_nm ?? "").trim() !== "정상운영") continue;
    if (String(row.addr_ctpv_nm ?? "").trim() !== province) continue;
    active++;
    const type = String(row.ftype_nm ?? "").trim();
    if (type in byType) byType[type]++;
  }
  return { active, facilityTypes: facilityTypes.map((type) => ({ type, count: byType[type] })) };
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function collectPages(requestPage, { pageSize, wait = delay, maxAttempts = 4 }) {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error("invalid pageSize");
  const rows = [];
  let totalCount;
  for (let pageNo = 1; ; pageNo++) {
    let page;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        page = await requestPage(pageNo, pageSize);
        break;
      } catch (error) {
        if (!(error.status === 429 || error.status >= 500) || attempt === maxAttempts) throw error;
        const milliseconds = Number.isFinite(error.retryAfterSeconds)
          ? error.retryAfterSeconds * 1000 : 500 * 2 ** (attempt - 1);
        await wait(milliseconds);
      }
    }
    if (!page || !Number.isInteger(page.totalCount) || page.totalCount < 0 || !Array.isArray(page.items) || page.items.length > pageSize) {
      throw new Error(`invalid page ${pageNo}`);
    }
    if (totalCount === undefined) totalCount = page.totalCount;
    if (totalCount !== page.totalCount) throw new Error(`totalCount changed on page ${pageNo}`);
    rows.push(...page.items);
    if (rows.length >= totalCount || page.items.length === 0 || pageNo >= Math.ceil(totalCount / pageSize)) break;
  }
  if (rows.length !== totalCount) throw new Error(`expected ${totalCount} rows, received ${rows.length}`);
  return rows;
}
