// 국민체육진흥공단 전국체육시설 정보 조회. 인증키는 SPORTS_FACILITY_API_KEY 서버 환경변수에서만 읽는다.
const upstream = "https://apis.data.go.kr/B551014/SRVC_API_SFMS_FACI/TODZ_API_SFMS_FACI";
const filters = ["cpb_nm", "ftype_nm", "faci_nm"] as const;

function response(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request) {
  const key = process.env.SPORTS_FACILITY_API_KEY?.trim();
  if (!key) return response({ error: "전국체육시설 API 인증키가 서버에 설정되지 않았습니다." }, 503);

  const search = new URL(request.url).searchParams;
  const pageNo = Number(search.get("pageNo") ?? "1");
  const numOfRows = Number(search.get("numOfRows") ?? "10");
  if (!Number.isInteger(pageNo) || pageNo < 1 || pageNo > 10000 || !Number.isInteger(numOfRows) || numOfRows < 1 || numOfRows > 50) {
    return response({ error: "페이지 번호 또는 페이지 크기가 올바르지 않습니다." }, 400);
  }

  const url = new URL(upstream);
  let decodedKey = key;
  try { decodedKey = decodeURIComponent(key); } catch { /* An unencoded key can be used as-is. */ }
  url.searchParams.set("serviceKey", decodedKey);
  url.searchParams.set("pageNo", String(pageNo));
  url.searchParams.set("numOfRows", String(numOfRows));
  url.searchParams.set("resultType", "JSON");
  for (const filter of filters) {
    const value = search.get(filter)?.trim();
    if (value && value.length > 100) return response({ error: "검색어는 100자 이내로 입력해 주세요." }, 400);
    if (value) url.searchParams.set(filter, value);
  }

  try {
    const upstreamResponse = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!upstreamResponse.ok) return response({ error: "공공데이터 서버가 요청을 처리하지 못했습니다. 잠시 후 다시 조회해 주세요." }, 502);
    const raw = await upstreamResponse.json();
    const payload = raw?.response ?? raw;
    const code = String(payload?.header?.resultCode ?? "");
    if (code !== "00" && code !== "0000") {
      return response({ error: "공공데이터 API가 조회를 완료하지 못했습니다. 인증키와 활용신청 상태를 확인해 주세요." }, 502);
    }
    const body = payload?.body;
    if (!body || typeof body !== "object") return response({ error: "공공데이터 응답 형식을 확인할 수 없습니다." }, 502);
    const item = body.items?.item;
    const items = (Array.isArray(item) ? item : item ? [item] : []).map((row: Record<string, unknown>) => ({
      faci_nm: String(row.faci_nm ?? ""),
      ftype_nm: String(row.ftype_nm ?? "").trim(),
      fcob_nm: String(row.fcob_nm ?? "").trim(),
      faci_stat_nm: String(row.faci_stat_nm ?? "").trim(),
      inout_gbn_nm: String(row.inout_gbn_nm ?? "").trim(),
      addr_ctpv_nm: String(row.addr_ctpv_nm ?? ""),
      addr_cpb_nm: String(row.addr_cpb_nm ?? ""),
      faci_road_addr: String(row.faci_road_addr ?? row.faci_addr ?? ""),
    }));
    const totalCount = Number(body.totalCount);
    return response({ pageNo, numOfRows, totalCount: Number.isFinite(totalCount) ? totalCount : items.length, items }, 200);
  } catch {
    return response({ error: "공공데이터 연결에 실패했습니다. 잠시 후 다시 조회해 주세요." }, 502);
  }
}
