import type { Metadata } from "next";
import Sports24 from "../sports24";

export const metadata: Metadata = { title: "시나리오 비교 — 운동24" };

export default function Page() {
  return <Sports24 view="compare" />;
}
