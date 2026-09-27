import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { scenarioTemplates } from "../../../../data/scenarios";
import PublicPage from "../../public-pages";

export const metadata: Metadata = { title: "정책결과 상세 — 운동24" };

export function generateStaticParams() {
  return scenarioTemplates.map((scenario) => ({ scenarioId: scenario.id }));
}

export default async function Page({ params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = await params;
  if (!scenarioTemplates.some((scenario) => scenario.id === scenarioId)) notFound();
  return <PublicPage view="policy" scenarioId={scenarioId} />;
}
