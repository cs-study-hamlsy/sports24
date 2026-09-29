import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { scenarioTemplates } from "../../../data/scenarios";
import { regions } from "../../../lib/regions";
import ExtendedPage from "../../extended-pages";

export const metadata: Metadata = { title: "정책 보고서 — 운동24" };

// 예시 시나리오는 정적 생성하고, 저장된(saved-*) 시나리오는 요청 시 렌더한다.
export function generateStaticParams() {
  return scenarioTemplates.map((scenario) => ({ scenarioId: scenario.id }));
}

export default async function Page({ params, searchParams }: { params: Promise<{ scenarioId: string }>; searchParams: Promise<{ region?: string }> }) {
  const { scenarioId } = await params;
  if (!scenarioTemplates.some((scenario) => scenario.id === scenarioId) && !/^saved-\d+$/.test(scenarioId)) notFound();
  const { region: reportRegionId } = await searchParams;
  if (reportRegionId && !regions.some((region) => region.id === reportRegionId)) notFound();
  return <ExtendedPage view="report" scenarioId={scenarioId} reportRegionId={reportRegionId} />;
}
