import type { Metadata } from "next";
import Link from "next/link";
import { SystemPage } from "./ui";

export const metadata: Metadata = { title: "페이지를 찾을 수 없음 — 운동24" };

export default function NotFound() {
  return <SystemPage title="페이지를 찾을 수 없습니다" description="주소가 변경되었거나 요청한 화면이 존재하지 않습니다."><Link className="primary-button" href="/">지역현황으로 이동</Link><Link className="secondary-button" href="/public">시민 공개화면</Link></SystemPage>;
}
