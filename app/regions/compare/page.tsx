import type { Metadata } from "next";
import ExtendedPage from "../../extended-pages";

export const metadata: Metadata = { title: "유사지역 비교 — 운동24" };

export default function Page() {
  return <ExtendedPage view="regionCompare" />;
}
