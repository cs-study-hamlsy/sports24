"use client";

import Link from "next/link";
import { useState } from "react";

export type PrimaryNav = "overview" | "simulation" | "result" | "compare" | "public";

const primaryItems: Array<{ key: Exclude<PrimaryNav, "public">; label: string; href: string }> = [
  { key: "overview", label: "지역현황", href: "/" },
  { key: "simulation", label: "정책시뮬레이션", href: "/simulation" },
  { key: "result", label: "결과조회", href: "/result" },
  { key: "compare", label: "정책안비교", href: "/compare" },
];

export type SideItem = { label: string; href?: string; current?: boolean; disabledReason?: string };

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={`brand-lockup${compact ? " compact" : ""}`} href="/" aria-label="운동24 지역현황으로 이동">
      <span className="brand-character-slot" aria-hidden="true" hidden />
      <span className="brand-wordmark" aria-label="운동24"><b>운동</b><strong>24</strong></span>
      {!compact && <span className="brand-service-name">체육정책 시뮬레이션 시스템</span>}
    </Link>
  );
}

export function AppShell({
  activeNav,
  sideTitle,
  sideItems,
  title,
  breadcrumb,
  notice,
  children,
}: {
  activeNav: PrimaryNav;
  sideTitle: string;
  sideItems: SideItem[];
  title: string;
  breadcrumb: string[];
  notice?: string;
  children: React.ReactNode;
}) {
  const [fontScale, setFontScale] = useState(1);
  return (
    <div className="app-shell" style={{ "--font-scale": fontScale } as React.CSSProperties}>
      <header>
        <div className="utility-bar">
          <span>체육진흥과 담당자 님</span><span className="utility-divider" aria-hidden="true" />
          <span>글자크기</span>
          <button type="button" className="font-control" onClick={() => setFontScale((value) => Math.min(1.12, value + 0.06))} aria-label="글자 크게">+</button>
          <button type="button" className="font-control" onClick={() => setFontScale((value) => Math.max(0.94, value - 0.06))} aria-label="글자 작게">−</button>
          <Link className="utility-link" href="/public">시민 공개화면</Link>
        </div>
        <div className="brand-row"><BrandLockup /></div>
        <nav className="global-nav" aria-label="주 메뉴">
          {primaryItems.map((item) => <Link key={item.key} href={item.href} aria-current={activeNav === item.key ? "page" : undefined}>{item.label}</Link>)}
        </nav>
      </header>
      <div className="workspace">
        <aside className="side-panel" aria-label={`${sideTitle} 메뉴`}>
          <section className="side-menu">
            <h2>{sideTitle}</h2>
            {sideItems.map((item) => item.href
              ? <Link key={item.label} href={item.href} className={item.current ? "selected" : ""} aria-current={item.current ? "page" : undefined}>· {item.label}</Link>
              : <span key={item.label} aria-disabled="true"><span>· {item.label}</span>{item.disabledReason && <small>{item.disabledReason}</small>}</span>)}
          </section>
          <section className="source-box"><h2>연동 대상 데이터</h2><p>스포츠강좌이용권 등록강좌</p><p>전국 체육시설 현황</p><p>주민등록 연령별 인구</p><p>현재 지표는 목업 시연값 기준</p></section>
        </aside>
        <main id="main">
          <div className="page-heading">
            <h1><span aria-hidden="true" />{title}</h1>
            <nav aria-label="현재 위치"><ol><li><Link href="/">HOME</Link></li>{breadcrumb.map((item, index) => <li key={item} aria-current={index === breadcrumb.length - 1 ? "page" : undefined}>{item}</li>)}</ol></nav>
          </div>
          {notice && <p className="inline-notice" role="status">{notice}</p>}
          {children}
        </main>
      </div>
    </div>
  );
}

export function Section({ title, unit, children }: { title: string; unit?: string; children: React.ReactNode }) {
  return <section className="content-section"><div className="section-heading"><h2><span aria-hidden="true" />{title}</h2>{unit && <p>{unit}</p>}</div>{children}</section>;
}

export function DataTable({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return <div className="table-scroll" role="region" aria-label={label} tabIndex={0}><table className={className}>{children}</table></div>;
}

export function SystemPage({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return <div className="system-page"><BrandLockup /><section><p className="system-code">운동24 안내</p><h1>{title}</h1><p>{description}</p><div className="system-actions">{children ?? <Link className="primary-button" href="/">지역현황으로 이동</Link>}</div></section></div>;
}
