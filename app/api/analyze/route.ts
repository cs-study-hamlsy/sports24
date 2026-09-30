// AI 정책 분석 Route Handler.
// 계산 엔진(lib/simulation.ts)이 만든 값만 받아서 해석·설명 텍스트를 생성한다.
// 수치·지표는 AI가 만들지 않으며, 서버에서만 OPENAI_API_KEY를 읽어 브라우저에 노출하지 않는다.

const endpoint = "https://api.openai.com/v1/chat/completions";
const analyzeTypes = ["gap", "brief", "review", "alternative"] as const;
type AnalyzeType = (typeof analyzeTypes)[number];

const systemPrompt =
  "당신은 대한민국 지자체 체육정책 담당자를 돕는 분석 보조자입니다. " +
  "제공된 계산 결과(JSON)만 근거로 한국어로 간결하게 설명합니다. " +
  "새로운 수치·통계·지역명을 만들어내지 말고, 제공된 값만 인용합니다. " +
  "숫자는 이미 계산 엔진이 산출한 것이며 당신은 해석과 검토 관점만 제시합니다. " +
  "정책의 최종 결정은 담당자의 몫이므로 단정 대신 검토 관점으로 서술하고, " +
  "3~5개의 항목을 각각 '핵심 제목: 설명' 형식의 한 줄 일반 텍스트로 답합니다. " +
  "별표, 해시, 백틱 등 마크다운 문법과 HTML은 사용하지 않습니다.";

const taskPrompt: Record<AnalyzeType, string> = {
  gap: "다음 지역 체육공급 현황 계산 결과를 바탕으로 공급의 부족·편중 가능성과 그 근거를 설명하세요.",
  brief: "다음 정책안(강좌 조정)과 지표 변화를 바탕으로 정책 브리프를 작성하세요. 무엇이 바뀌고 왜 의미가 있는지 요약합니다.",
  review: "다음 정책안을 검토해 한계, 추가로 확인해야 할 자료, 대안 조합 방향을 제시하세요.",
  alternative: "다음 현황과 자원 한도를 바탕으로 대안적 강좌 조정 방향을 제안하세요. 실제 증감 수치는 계산 엔진이 다시 검증합니다.",
};

function response(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return response({ error: "AI 분석 인증키(OPENAI_API_KEY)가 서버에 설정되지 않았습니다. 계산 엔진 결과는 그대로 사용할 수 있습니다." }, 503);

  let body: { type?: unknown; context?: unknown };
  try {
    body = await request.json();
  } catch {
    return response({ error: "요청 형식을 확인할 수 없습니다." }, 400);
  }

  const type = body.type;
  if (typeof type !== "string" || !analyzeTypes.includes(type as AnalyzeType)) {
    return response({ error: "지원하지 않는 분석 유형입니다." }, 400);
  }
  const context = body.context;
  if (!context || typeof context !== "object") {
    return response({ error: "분석에 사용할 계산 결과가 없습니다." }, 400);
  }
  const contextText = JSON.stringify(context);
  if (contextText.length > 6000) {
    return response({ error: "분석 요청 데이터가 너무 큽니다." }, 400);
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 700,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${taskPrompt[type as AnalyzeType]}\n\n계산 엔진 결과(JSON):\n${contextText}` },
        ],
      }),
    });

    if (!upstream.ok) {
      const status = upstream.status === 401 ? 503 : 502;
      return response({ error: status === 503 ? "AI 인증키가 올바르지 않습니다. 설정을 확인해 주세요." : "AI 분석 서버가 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." }, status);
    }
    const raw = await upstream.json();
    const text = raw?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      return response({ error: "AI 분석 결과를 받지 못했습니다. 잠시 후 다시 시도해 주세요." }, 502);
    }
    return response({ type, text: text.trim() }, 200);
  } catch {
    return response({ error: "AI 분석 연결에 실패했습니다. 잠시 후 다시 시도해 주세요." }, 502);
  }
}
