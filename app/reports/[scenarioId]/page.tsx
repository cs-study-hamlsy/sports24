import type { Metadata } from "next";
import { scenarioTemplates } from "../../../data/scenarios";
import ExtendedPage from "../../extended-pages";

export const metadata: Metadata = { title: "정책 보고서 — 운동24" };

// 예시 시나리오는 정적 생성하고, 저장된(saved-*) 시나리오는 요청 시 렌더한다.
export function generateStaticParams() {
  return scenarioTemplates.map((scenario) => ({ scenarioId: scenario.id }));
}

export default async function Page({ params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = await params;
  return <ExtendedPage view="report" scenarioId={scenarioId} />;
}
