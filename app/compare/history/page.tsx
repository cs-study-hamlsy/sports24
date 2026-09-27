import type { Metadata } from "next";
import ExtendedPage from "../../extended-pages";

export const metadata: Metadata = { title: "비교 이력 — 운동24" };

export default function Page() {
  return <ExtendedPage view="history" />;
}
