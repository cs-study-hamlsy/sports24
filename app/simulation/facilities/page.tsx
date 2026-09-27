import type { Metadata } from "next";
import ExtendedPage from "../../extended-pages";

export const metadata: Metadata = { title: "시설 조정 시뮬레이션 — 운동24" };

export default function Page() {
  return <ExtendedPage view="facilities" />;
}
