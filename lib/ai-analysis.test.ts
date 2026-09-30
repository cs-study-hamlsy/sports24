import test from "node:test";
import assert from "node:assert/strict";
import { formatAiAnalysis } from "./ai-analysis";

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
