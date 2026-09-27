import type { Metadata } from "next";
import PublicPage from "../public-pages";

export const metadata: Metadata = { title: "공개 정책결과 — 운동24" };

export default function Page() {
  return <PublicPage view="policies" />;
}
