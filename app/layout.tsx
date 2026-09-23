import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "체육공급 현황 — 운동24",
  description: "지역 체육공급 현황과 정책 효과를 비교하는 운동24 데모",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
