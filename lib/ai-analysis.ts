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
