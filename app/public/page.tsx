import type { Metadata } from "next";
import PublicPage from "./public-pages";

export const metadata: Metadata = { title: "시민 공개정보 — 운동24" };

export default function Page() {
  return <PublicPage view="home" />;
}
