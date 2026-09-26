import type { Metadata } from "next";
import Sports24 from "./sports24";

export const metadata: Metadata = { title: "체육공급 현황 — 운동24" };

export default function Page() {
  return <Sports24 view="overview" />;
}
