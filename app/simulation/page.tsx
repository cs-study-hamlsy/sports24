import type { Metadata } from "next";
import Sports24 from "../sports24";

export const metadata: Metadata = { title: "강좌 조정 시뮬레이션 — 운동24" };

export default function Page() {
  return <Sports24 view="simulation" />;
}
