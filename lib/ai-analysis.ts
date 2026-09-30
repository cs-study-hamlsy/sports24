export type AiAnalysisItem = { heading: string; body: string };

function cleanMarkdown(value: string) {
  return value
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_]{1,3}/g, "")
    .replace(/`+/g, "")
    .trim();
}

export function formatAiAnalysis(text: string): AiAnalysisItem[] {
  return text
    .split(/\r?\n/)
    .map((source) => ({ line: cleanMarkdown(source), isHeading: /^#{1,6}\s+/.test(source.trim()) }))
    .filter(({ line }) => Boolean(line))
    .map(({ line, isHeading }) => {
      if (isHeading) return { heading: line, body: "" };
      const match = line.match(/^([^:：]{1,40})[:：]\s*(.+)$/);
      return match
        ? { heading: match[1].trim(), body: match[2].trim() }
        : { heading: "", body: line };
    });
}

export type AiReportType = "gap" | "review" | "alternative";

const reportHeadingsByType: Record<AiReportType, string[]> = {
  gap: ["현황 요약", "공급 격차 분석", "추가 확인자료", "검토 의견"],
  review: ["검토 개요", "지표 변화와 의미", "실행 전 확인사항", "종합 의견"],
  alternative: ["대안 개요", "조정 방향", "제약 및 확인사항", "종합 제안"],
};

export function formatAiReport(text: string, type: AiReportType): AiAnalysisItem[] {
  const reportHeadings = new Set(reportHeadingsByType[type]);
  const sections: AiAnalysisItem[] = [];
  for (const source of text.split(/\r?\n/)) {
    const line = cleanMarkdown(source);
    if (!line) continue;
    const withoutNumber = line.replace(/^\d+[.)]\s*/, "");
    const legacyTitle = withoutNumber.match(/^핵심 제목[:：]\s*(.+)$/);
    if (legacyTitle) {
      sections.push({ heading: legacyTitle[1].trim(), body: "" });
    } else if (reportHeadings.has(withoutNumber.replace(/[:：].*$/, "").trim())) {
      const [heading, ...body] = withoutNumber.split(/[:：]/);
      sections.push({ heading: heading.trim(), body: body.join(":").trim() });
    } else {
      const paragraph = withoutNumber.replace(/^설명[:：]\s*/, "");
      if (!sections.length) sections.push({ heading: reportHeadingsByType[type][0], body: paragraph });
      else sections[sections.length - 1].body += `${sections[sections.length - 1].body ? " " : ""}${paragraph}`;
    }
  }
  return sections.filter((section) => section.body);
}

export function formatPolicyReview(text: string): AiAnalysisItem[] {
  return formatAiReport(text, "review");
}
