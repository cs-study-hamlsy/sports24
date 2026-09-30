import test from "node:test";
import assert from "node:assert/strict";
import { formatAiAnalysis, formatAiReport, formatPolicyReview } from "./ai-analysis";

test("preserves intended emphasis without exposing markdown markers", () => {
  assert.deepEqual(formatAiAnalysis("**추가 검토 필요**: 실제 이용률 자료를 확인해야 합니다."), [
    { heading: "추가 검토 필요", body: "실제 이용률 자료를 확인해야 합니다." },
  ]);
});

test("normalizes markdown bullets and headings into readable analysis items", () => {
  assert.deepEqual(formatAiAnalysis("### 정책 효과\n- **장점**: 종목 편중이 완화됩니다.\n2. 한계: 실제 수요 자료가 없습니다."), [
    { heading: "정책 효과", body: "" },
    { heading: "장점", body: "종목 편중이 완화됩니다." },
    { heading: "한계", body: "실제 수요 자료가 없습니다." },
  ]);
});

test("keeps ordinary paragraphs as unlabelled body text", () => {
  assert.deepEqual(formatAiAnalysis("추가 자료를 확보한 뒤 다시 검토합니다."), [
    { heading: "", body: "추가 자료를 확보한 뒤 다시 검토합니다." },
  ]);
});

test("removes unmatched and truncated markdown delimiters", () => {
  assert.deepEqual(formatAiAnalysis("**주의: 확인 필요\n검토 **필요\n__중첩 **표현**__도 정리"), [
    { heading: "주의", body: "확인 필요" },
    { heading: "", body: "검토 필요" },
    { heading: "", body: "중첩 표현도 정리" },
  ]);
});

test("formats a policy review as report sections", () => {
  assert.deepEqual(formatPolicyReview("검토 개요\n강좌 조정안을 검토했습니다.\n\n지표 변화와 의미\n유사도는 3점 높아졌습니다.\n\n실행 전 확인사항\n이용률을 확인해야 합니다.\n\n종합 의견\n단계적 적용을 권고합니다."), [
    { heading: "검토 개요", body: "강좌 조정안을 검토했습니다." },
    { heading: "지표 변화와 의미", body: "유사도는 3점 높아졌습니다." },
    { heading: "실행 전 확인사항", body: "이용률을 확인해야 합니다." },
    { heading: "종합 의견", body: "단계적 적용을 권고합니다." },
  ]);
});

test("legacy AI labels do not appear in the report", () => {
  assert.deepEqual(formatPolicyReview("핵심 제목: 종목 구성\n설명: 구성 차이를 검토합니다."), [
    { heading: "종목 구성", body: "구성 차이를 검토합니다." },
  ]);
});

test("formats gap and alternative analysis as report sections", () => {
  assert.deepEqual(formatAiReport("현황 요약\n유사지역과 종목 구성을 비교했습니다.\n\n공급 격차 분석\n수영 비중은 비교값보다 낮습니다.\n\n추가 확인자료\n실제 수요를 확인해야 합니다.\n\n검토 의견\n강좌 구성 조정을 검토할 수 있습니다.", "gap"), [
    { heading: "현황 요약", body: "유사지역과 종목 구성을 비교했습니다." },
    { heading: "공급 격차 분석", body: "수영 비중은 비교값보다 낮습니다." },
    { heading: "추가 확인자료", body: "실제 수요를 확인해야 합니다." },
    { heading: "검토 의견", body: "강좌 구성 조정을 검토할 수 있습니다." },
  ]);
  assert.deepEqual(formatAiReport("대안 개요\n한도 내 강좌 재배분을 검토합니다.\n\n조정 방향\n수영 증설을 검토합니다.\n\n제약 및 확인사항\n이용률을 확인해야 합니다.\n\n종합 제안\n재계산 후 비교합니다.", "alternative").map(({ heading }) => heading), [
    "대안 개요", "조정 방향", "제약 및 확인사항", "종합 제안",
  ]);
});

test("accepts report headings with colons and inline paragraphs", () => {
  assert.deepEqual(formatAiReport("현황 요약: 유사지역과 비교했습니다.\n공급 격차 분석: 수영 비중은 낮습니다.", "gap"), [
    { heading: "현황 요약", body: "유사지역과 비교했습니다." },
    { heading: "공급 격차 분석", body: "수영 비중은 낮습니다." },
  ]);
});
