"use client";

import Link from "next/link";
import { asOfMonth, getRegion, region, regions } from "../../lib/regions";
import { changesLabel, demoScenariosFor, metricNames } from "../../data/scenarios";
import { DataTable, Section, BrandLockup } from "../ui";
import { CourseShareChart } from "../course-share-chart";

type PublicView = "home" | "region" | "policies" | "policy";
// 시민 공개 정책결과는 대표 공개지역(기본 지역)의 예시 정책안을 사용한다.
const demoScenarios = demoScenariosFor(region);

// 공개 화면 메타데이터. 실측 정제 데이터가 연결되면 기준월·출처·공개상태를 실제 값으로 교체한다.
const publicMeta = {
  asOfMonth: `${asOfMonth} 기준`,
  source: "주민등록 연령별 인구·전국체육시설 정보(실측) · 스포츠강좌 등록강좌(시연값)",
  status: "시연 공개",
};
// 정책안별 공개 상태(시연값). 실제 서비스에서는 담당자 승인 절차와 연동한다.
const policyStatus: Record<string, string> = { a: "시연 정책안", b: "시연 정책안", c: "시연 정책안" };

function MetaBar() {
  return <dl className="public-meta-bar">
    <div><dt>데이터 기준월</dt><dd>{publicMeta.asOfMonth}</dd></div>
    <div><dt>출처</dt><dd>{publicMeta.source}</dd></div>
    <div><dt>공개 상태</dt><dd><span className="public-status-badge">{publicMeta.status}</span></dd></div>
  </dl>;
}

function PublicShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <div className="public-shell">
    <header className="public-header"><BrandLockup compact /><nav aria-label="시민 공개 메뉴"><Link href="/public">안내</Link><Link href={`/public/regions/${region.id}`}>지역현황</Link><Link href="/public/policies">정책결과</Link><Link href="/">담당자 화면</Link></nav></header>
    <main><div className="public-heading"><p>운동24 시민 공개정보</p><h1>{title}</h1><span>{description}</span></div><MetaBar />{children}</main>
    <footer><span>운동24</span><span>인구·시설은 실측 정제값, 종목별 강좌·정책안은 시연값입니다.</span></footer>
  </div>;
}

export default function PublicPage({ view, scenarioId = "c", regionId }: { view: PublicView; scenarioId?: string; regionId?: string }) {
  if (view === "home") return <PublicShell title="우리 지역 체육정책을 확인하세요" description="지역별 체육공급 현황과 공개된 정책 변화 결과를 한곳에서 제공합니다."><div className="public-link-grid"><Link href={`/public/regions/${region.id}`}><b>지역 체육현황</b><span>종목별 강좌와 인구구조를 확인합니다.</span></Link><Link href="/public/policies"><b>공개 정책결과</b><span>정책안별 주요 변화를 확인합니다.</span></Link></div><PublicDataNotice /></PublicShell>;
  if (view === "region") return <PublicRegion regionId={regionId ?? region.id} />;
  if (view === "policies") return <PublicPolicies />;
  return <PublicPolicy scenarioId={scenarioId} />;
}

function PublicRegion({ regionId }: { regionId: string }) {
  const current = getRegion(regionId);
  const total = current.courses.reduce((sum, course) => sum + course.count, 0);
  return <PublicShell title={`${current.label} 체육현황`} description="지역의 강좌 구성과 비교지역 평균을 공개합니다.">
    <nav className="public-region-switch" aria-label="지역 선택">{regions.map((item) => <Link key={item.id} href={`/public/regions/${item.id}`} aria-current={item.id === current.id ? "page" : undefined} className={item.id === current.id ? "current" : ""}>{item.shortName}</Link>)}</nav>
    <div className="public-summary"><div><span>총 주민등록 인구</span><strong>{current.totalPopulation.toLocaleString("ko-KR")}명</strong></div><div><span>정상운영 체육시설</span><strong>{current.facilities.toLocaleString("ko-KR")}개소</strong></div><div><span>고령(65세+) 인구 비율</span><strong>{current.population.region[3]}%</strong></div></div>
    <Section title="종목별 강좌 현황" unit="(단위: 개, %)"><CourseShareChart courses={current.courses} /><DataTable label="시민 공개 종목별 강좌 현황"><thead><tr><th scope="col">종목</th><th scope="col">강좌수</th><th scope="col">지역 비중</th><th scope="col">비교지역 평균</th><th scope="col">설명</th></tr></thead><tbody>{current.courses.map((course) => { const gap = course.share - course.comparison; return <tr key={course.sport}><th scope="row">{course.sport}</th><td>{course.count}</td><td>{course.share.toFixed(1)}</td><td>{course.comparison.toFixed(1)}</td><td>{gap >= 3 ? "비교지역보다 높은 편" : gap <= -3 ? "비교지역보다 낮은 편" : "비슷한 수준"}</td></tr>; })}</tbody></DataTable></Section>
    <Section title="읽을 때 참고하세요"><div className="public-explanation"><p>연령별 인구 비율은 체육 수요를 확정하는 값이 아니라 정책 검토를 위한 참고자료입니다.</p><p>지역별 실제 이용률과 선호 자료가 확보되기 전에는 연령 적합도를 표시하지 않습니다.</p></div></Section>
  </PublicShell>;
}

function PublicPolicies() {
  return <PublicShell title="공개 정책결과" description="시연 정책안의 강좌 조정 내용과 관측 가능한 지표 변화를 확인합니다.">
    <Section title="원주시 공개 정책안" unit={`총 ${demoScenarios.length}건`}><DataTable label="시민 공개 정책안 목록"><thead><tr><th scope="col">정책안</th><th scope="col">주요 조정</th><th scope="col">등록일</th><th scope="col">공개 상태</th><th scope="col">상세</th></tr></thead><tbody>{demoScenarios.map((scenario) => <tr key={scenario.id}><th scope="row">{scenario.name}</th><td className="text-left">{changesLabel(scenario.changes)}</td><td>{scenario.date}</td><td><span className="public-status-badge">{policyStatus[scenario.id] ?? "검토 중"}</span></td><td><Link className="table-link" href={`/public/policies/${scenario.id}`}>결과 보기</Link></td></tr>)}</tbody></DataTable></Section>
    <PublicDataNotice />
  </PublicShell>;
}

function PublicPolicy({ scenarioId }: { scenarioId: string }) {
  const scenario = demoScenarios.find((item) => item.id === scenarioId) ?? demoScenarios[2];
  return <PublicShell title={`${scenario.name} 정책결과`} description={`${region.label} 강좌 구성 변경 전후의 핵심 결과입니다.`}>
    <div className="public-policy-summary"><b>{changesLabel(scenario.changes)}</b><span>등록일 {scenario.date}</span><span className="public-status-badge">{policyStatus[scenario.id] ?? "검토 중"}</span></div>
    <Section title="핵심 변화"><DataTable label="시민 공개 정책안 핵심 지표"><thead><tr><th scope="col">지표</th><th scope="col">정책안 결과</th><th scope="col">의미</th></tr></thead><tbody>{metricNames.slice(0, 3).map((name, index) => <tr key={name}><th scope="row">{name}</th><td><strong>{scenario.metrics[index]}</strong></td><td>{index === 0 ? "비교지역 종목 구성과의 일치도" : index === 1 ? "종목 구성이 고른 정도" : "특정 종목에 집중된 정도(낮을수록 분산)"}</td></tr>)}</tbody></DataTable></Section>
    <Section title="정책 설명"><div className="public-explanation">{scenario.analysis.map((item) => <p key={item}>{item}</p>)}</div></Section>
    <div className="page-actions"><Link className="secondary-button" href="/public/policies">목록</Link><button className="primary-button" type="button" onClick={() => window.print()}>인쇄</button></div>
  </PublicShell>;
}

function PublicDataNotice() {
  return <aside className="public-data-notice"><b>데이터 안내</b><p>인구·시설 수치는 공공데이터 기반 실측 정제값입니다. 종목별 강좌와 정책안은 시연값이며, 담당자 공개 승인 절차는 연결되지 않았습니다.</p></aside>;
}
