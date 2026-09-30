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
const reportHeadings = {
  gap: "현황 요약, 공급 격차 분석, 추가 확인자료, 검토 의견",
  review: "검토 개요, 지표 변화와 의미, 실행 전 확인사항, 종합 의견",
  alternative: "대안 개요, 조정 방향, 제약 및 확인사항, 종합 제안",
} as const;
const reportSystemPrompt = (type: keyof typeof reportHeadings) =>
  "당신은 지자체 체육정책 분석 의견서를 작성합니다. 제공된 계산 결과(JSON)만 근거로 한국어 공문서체의 짧은 문단을 작성하세요. " +
  (type === "gap" ? "지역현황의 종목 구성과 유사지역 비교값은 실제 수요 또는 공급 부족의 확정 증거가 아닙니다. " : "강좌 수 조정안을 가상 적용해 계산한 종목 구성 지표이며 실제 시행 결과, 참여도 또는 수요가 아닙니다. ") +
  "'시행 후', '참여도 향상', '효과가 나타났다', '필요성이 확인됐다'처럼 실제 성과를 주장하지 마세요. " +
  "새 수치·통계·지역명을 만들지 마세요. JSON의 count/currentCount는 강좌 개수(개), sharePercent/peerAveragePercent는 종목 비중(%)입니다. 비중을 강좌 개수로 읽거나 단위를 바꾸지 마세요. " +
  "비교지역 평균 비중이 낮거나 높다는 이유만으로 과잉·부족, 연령대별 선호, 실제 수요를 추정하지 마세요. '수요가 집중된다', '공급이 부족하다', '공급이 과도하다'라는 표현도 쓰지 마세요. " +
  "수요, 이용률, 연령 적합도는 자료가 없으므로 오직 '추가 확인이 필요하다'고만 쓰세요. 관찰된 비중 차이와 정책 검토 과제를 분리해 서술하세요. " +
  `다음 네 제목을 각각 한 줄에 정확히 쓰고, 제목 아래에 1~3문장의 문단을 쓰세요: ${reportHeadings[type]}. ` +
  "핵심 제목, 설명, 목록 기호, 마크다운, HTML은 쓰지 마세요.";

const taskPrompt: Record<AnalyzeType, string> = {
  gap: "다음 지역의 종목별 강좌 비중과 유사지역 평균 비중의 차이를 설명하세요. 비중 차이는 실제 공급 부족·과잉 또는 수요의 증거가 아니므로 그렇게 해석하지 마세요.",
  brief: "다음 정책안(강좌 조정)과 지표 변화를 바탕으로 정책 브리프를 작성하세요. 무엇이 바뀌고 왜 의미가 있는지 요약합니다.",
  review: "다음 강좌 조정안의 가상 계산 결과를 검토하세요. 지표 변화는 예상되는 구성 변화로만 표현하고, 시행 전 필요한 자료와 정책 판단 시 유의점을 제시하세요.",
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
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          { role: "system", content: type === "gap" || type === "review" || type === "alternative" ? reportSystemPrompt(type) : systemPrompt },
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
