import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { regions } from "../../../../lib/regions";
import PublicPage from "../../public-pages";

export const metadata: Metadata = { title: "지역 체육현황 — 운동24" };

export function generateStaticParams() {
  return regions.map((region) => ({ regionId: region.id }));
}

export default async function Page({ params }: { params: Promise<{ regionId: string }> }) {
  const { regionId } = await params;
  if (!regions.some((region) => region.id === regionId)) notFound();
  return <PublicPage view="region" regionId={regionId} />;
}
