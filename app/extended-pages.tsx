"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { rankedPeers, region, similarPeers, PEER_COUNT } from "../lib/regions";
import { baselineMetrics, changesLabel, courseBudget, demoScenarios, metricNames, usedCourses } from "../data/scenarios";
import { AppShell, DataTable, Section, SideItem } from "./ui";

type ExtendedView = "regionCompare" | "facilities" | "history" | "report";
type FacilityChange = Record<string, number>;
const facilities = [
  { type: "공공체육관", current: 5, unitCost: 8 },
  { type: "수영장", current: 2, unitCost: 15 },
  { type: "생활체육센터", current: 4, unitCost: 10 },
  { type: "야외운동시설", current: 12, unitCost: 3 },
];

function config(view: ExtendedView): { activeNav: "overview" | "simulation" | "compare" | "result"; sideTitle: string; title: string; breadcrumb: string[]; sideItems: SideItem[] } {
  if (view === "regionCompare") return {
    activeNav: "overview", sideTitle: "지역현황", title: "유사지역 비교", breadcrumb: ["지역현황", "유사지역 비교"],
    sideItems: [
      { label: "체육공급 현황", href: "/" }, { label: "종목별 강좌", href: "/#courses" },
      { label: "연령별 인구", href: "/#population" }, { label: "유사지역 비교", href: "/regions/compare", current: true },
    ],
  };
  if (view === "facilities") return {
    activeNav: "simulation", sideTitle: "정책시뮬레이션", title: "시설 조정 시뮬레이션", breadcrumb: ["정책시뮬레이션", "시설 조정"],
    sideItems: [
      { label: "강좌 조정", href: "/simulation" }, { label: "시설 조정", href: "/simulation/facilities", current: true },
      { label: "저장된 시나리오", href: "/compare" },
    ],
  };
  if (view === "history") return {
    activeNav: "compare", sideTitle: "정책안비교", title: "비교 이력", breadcrumb: ["정책안비교", "비교 이력"],
    sideItems: [{ label: "시나리오 비교", href: "/compare" }, { label: "비교 이력", href: "/compare/history", current: true }],
  };
  return {
    activeNav: "result", sideTitle: "결과조회", title: "정책 보고서", breadcrumb: ["결과조회", "정책 보고서"],
    sideItems: [{ label: "시나리오 결과", href: "/result" }, { label: "정책 보고서", href: "/reports/c", current: true }],
  };
}

export default function ExtendedPage({ view, scenarioId = "c" }: { view: ExtendedView; scenarioId?: string }) {
  const shell = config(view);
  const scenario = demoScenarios.find((item) => item.id === scenarioId) ?? demoScenarios[2];
  return <AppShell {...shell}>{view === "regionCompare" ? <RegionCompare /> : view === "facilities" ? <FacilitySimulation /> : view === "history" ? <ComparisonHistory /> : <PolicyReport scenario={scenario} />}</AppShell>;
}

function RegionCompare() {
  return <>
    <div className="filter-bar compact-filter"><span className="filter-label">기준지역</span><strong>{region.label}</strong><span className="filter-label">유사지역 (자동 선정)</span><strong>{region.comparisonLabel}</strong></div>
    <p className="inline-notice neutral-notice">유사지역과 비교 평균은 코드가 인구 구성·규모·강좌·시설 데이터로 계산합니다. 입력값은 시연 데이터이며 실측 정제 후 결과가 다시 계산됩니다.</p>
    <Section title="유사도 산정 결과" unit={`후보 ${rankedPeers.length}곳 중 상위 ${PEER_COUNT}곳 선정`}>
      <DataTable label="후보 지역 유사도 산정 결과" className="peer-score-table">
        <thead><tr><th scope="col">순위</th><th scope="col">후보지역</th><th scope="col">연령구성 차이</th><th scope="col">인구규모 차이</th><th scope="col">강좌총량 차이</th><th scope="col">시설수 차이</th><th scope="col">유사도</th><th scope="col">선정</th></tr></thead>
        <tbody>{rankedPeers.map((peer, index) => { const selected = index < PEER_COUNT; return <tr key={peer.region.id} className={selected ? "best-cell-row" : ""}>
          <td>{index + 1}</td><th scope="row">{peer.region.shortName}</th>
          <td>{peer.populationGap.toFixed(1)}%p</td><td>{peer.sizeGap.toFixed(1)}%</td><td>{peer.courseGap.toFixed(1)}%</td><td>{peer.facilityGap.toFixed(1)}%</td>
          <td><strong>{peer.similarity}</strong></td><td className={selected ? "positive" : ""}>{selected ? "선정" : "제외"}</td>
        </tr>; })}</tbody>
      </DataTable>
      <p className="table-note">유사도 = 100 − (연령구성 차이×0.4 + 인구규모 차이×0.3 + 강좌총량 차이×0.15 + 시설수 차이×0.15). 값이 작을수록 유사합니다. 산식은 <code>lib/regions.ts</code>에 있습니다.</p>
    </Section>
    <div className="overview-grid compare-region-grid">
      <Section title="인구구성 비교" unit="(단위: %)">
        <DataTable label="기준지역과 유사지역 인구구성 비교"><thead><tr><th scope="col">구분</th><th scope="col">청소년</th><th scope="col">청년</th><th scope="col">중장년</th><th scope="col">고령</th></tr></thead><tbody><tr><th scope="row">{region.shortName}</th>{region.population.region.map((value, index) => <td key={index}>{value}</td>)}</tr><tr><th scope="row">유사지역 평균</th>{region.population.comparison.map((value, index) => <td key={index}>{value}</td>)}</tr></tbody></DataTable>
      </Section>
      <Section title="선정된 유사지역"><div className="analysis-box"><h3>유사지역 <span>({similarPeers.length}개 지역)</span></h3><ol>{similarPeers.map((peer) => <li key={peer.region.id}>{peer.region.label} — 유사도 {peer.similarity}</li>)}<li>유사지역 평균값을 기준지역 비교값으로 사용합니다.</li></ol></div></Section>
    </div>
    <Section title="종목 공급 비중 비교" unit="(단위: %, %p)"><DataTable label="기준지역과 유사지역 종목 비중 비교"><thead><tr><th scope="col">종목</th><th scope="col">{region.shortName}</th><th scope="col">유사지역 평균</th><th scope="col">차이</th><th scope="col">검토</th></tr></thead><tbody>{region.courses.map((course) => { const difference = course.share - course.comparison; return <tr key={course.sport}><th scope="row">{course.sport}</th><td>{course.share.toFixed(1)}</td><td>{course.comparison.toFixed(1)}</td><td className={Math.abs(difference) >= 7 ? "danger" : ""}>{difference > 0 ? "+" : ""}{difference.toFixed(1)}</td><td>{difference <= -3 ? "상대적으로 낮음" : difference >= 3 ? "상대적으로 높음" : "유사 범위"}</td></tr>; })}</tbody></DataTable></Section>
    <div className="page-actions"><Link className="secondary-button" href="/">지역현황</Link><Link className="primary-button" href="/simulation">정책시뮬레이션</Link></div>
  </>;
}

function FacilitySimulation() {
  const [changes, setChanges] = useState<FacilityChange>({});
  const [notice, setNotice] = useState("");
  const totalChange = Object.values(changes).reduce((sum, value) => sum + value, 0);
  const estimatedCost = facilities.reduce((sum, facility) => sum + Math.max(0, changes[facility.type] ?? 0) * facility.unitCost, 0);
  const update = (type: string, value: number) => setChanges((current) => ({ ...current, [type]: Math.max(-1, Math.min(2, value)) }));
  return <>
    <p className="inline-notice neutral-notice">시설 조정은 시연용 계획 입력 화면입니다. 실제 입지·수용인원·운영비와 강좌 지표에는 아직 합산하지 않습니다.</p>
    {notice && <p className="inline-notice" role="status">{notice}</p>}
    <Section title="시설 유형별 조정" unit="증설 +2 / 감축 −1 범위">
      <DataTable label="시설 유형별 조정 표" className="facility-table"><thead><tr><th scope="col">시설 유형</th><th scope="col">현재</th><th scope="col">증감</th><th scope="col">변경 후</th><th scope="col">시연 비용단위</th></tr></thead><tbody>{facilities.map((facility) => { const change = changes[facility.type] ?? 0; return <tr key={facility.type}><th scope="row">{facility.type}</th><td>{facility.current}</td><td><div className="stepper"><button type="button" aria-label={`${facility.type} 1개 감소`} onClick={() => update(facility.type, change - 1)}>−</button><output aria-label={`${facility.type} 증감`} className={change > 0 ? "positive" : change < 0 ? "danger" : ""}>{change > 0 ? `+${change}` : change}</output><button type="button" aria-label={`${facility.type} 1개 증가`} onClick={() => update(facility.type, change + 1)}>+</button></div></td><td><strong>{facility.current + change}</strong></td><td>{facility.unitCost}</td></tr>; })}</tbody></DataTable>
    </Section>
    <div className="summary-strip"><div><span>시설 순증감</span><strong>{totalChange > 0 ? `+${totalChange}` : totalChange}</strong></div><div><span>시연 비용단위</span><strong>{estimatedCost}</strong></div><div><span>강좌 지표 반영</span><strong>미적용</strong></div></div>
    <Section title="검토사항"><div className="analysis-box"><h3>시설 조정 검토</h3><ol><li>시설 수만으로 정책 효과를 산정하지 않습니다.</li><li>입지, 운영시간, 수용인원, 접근성 자료가 확보되면 별도 계산 엔진에 연결합니다.</li><li>강좌 조정 시나리오와 합산할 때는 중복 효과를 방지하는 기준이 필요합니다.</li></ol></div></Section>
    <div className="page-actions split-actions"><button className="secondary-button" type="button" onClick={() => { setChanges({}); setNotice("시설 조정값을 초기화했습니다."); }}>초기화</button><div><button className="secondary-button" type="button" onClick={() => setNotice("시설 조정 시연안을 현재 세션에 저장했습니다.")}>시연안 저장</button><Link className="primary-button" href="/simulation">강좌 조정으로 이동</Link></div></div>
  </>;
}

function ComparisonHistory() {
  const rows = useMemo(() => [
    { id: "20260922-c", date: "2026.09.22", region: region.label, scenarios: "A안 · B안 · C안", owner: "체육진흥과", report: "c" },
    { id: "20260921-ab", date: "2026.09.21", region: region.label, scenarios: "A안 · B안", owner: "체육진흥과", report: "b" },
  ], []);
  return <>
    <p className="inline-notice neutral-notice">이력은 현재 브라우저 시연 데이터입니다. 서버 저장과 담당자별 영구 이력은 아직 연결하지 않았습니다.</p>
    <Section title="최근 비교 이력" unit={`총 ${rows.length}건`}><DataTable label="최근 시나리오 비교 이력"><thead><tr><th scope="col">비교일</th><th scope="col">대상지역</th><th scope="col">비교 정책안</th><th scope="col">담당부서</th><th scope="col">결과</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.date}</td><td>{row.region}</td><td>{row.scenarios}</td><td>{row.owner}</td><td><Link className="table-link" href={`/reports/${row.report}`}>보고서 보기</Link></td></tr>)}</tbody></DataTable></Section>
    <Section title="저장 범위"><div className="analysis-box"><h3>시연 이력 안내</h3><ol><li>현재는 목업 시나리오의 대표 비교 이력만 표시합니다.</li><li>실제 서비스에서는 비교 대상, 지표 버전, 데이터 기준월을 함께 저장해야 합니다.</li><li>정책안 원본이 변경되어도 기존 보고서의 계산 기준은 보존해야 합니다.</li></ol></div></Section>
    <div className="page-actions"><Link className="primary-button" href="/compare">새 비교 시작</Link></div>
  </>;
}

function PolicyReport({ scenario }: { scenario: (typeof demoScenarios)[number] }) {
  return <article className="report-sheet">
    <div className="report-meta"><div><span>보고서 번호</span><strong>SPORTS24-{scenario.date.replaceAll(".", "")}-{scenario.id.toUpperCase()}</strong></div><div><span>대상지역</span><strong>{region.label}</strong></div><div><span>작성기준</span><strong>시연 데이터</strong></div></div>
    <Section title="정책안 요약"><DataTable label="정책안 요약"><tbody><tr><th scope="row">시나리오명</th><td>{scenario.name}</td><th scope="row">강좌 사용</th><td>{usedCourses(scenario.changes)} / {courseBudget}개</td></tr><tr><th scope="row">조정내용</th><td colSpan={3}>{changesLabel(scenario.changes)}</td></tr></tbody></DataTable></Section>
    <Section title="핵심 지표"><DataTable label="정책 보고서 핵심 지표"><thead><tr><th scope="col">지표</th><th scope="col">현재</th><th scope="col">정책안</th><th scope="col">변화</th></tr></thead><tbody>{metricNames.map((name, index) => { const before = baselineMetrics[index]; const after = scenario.metrics[index]; const delta = before === null || after === null ? null : after - before; return <tr key={name}><th scope="row">{name}</th><td>{before ?? "산출 불가"}</td><td>{after ?? "산출 불가"}</td><td>{delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta}`}</td></tr>; })}</tbody></DataTable></Section>
    <Section title="검토 의견"><div className="analysis-box"><h3>코드 계산 결과 기반</h3><ol>{scenario.analysis.map((item) => <li key={item}>{item}</li>)}</ol></div></Section>
    <p className="report-disclaimer">본 보고서는 목업 시연값을 기준으로 작성되었습니다. 실제 정책 판단에는 최신 공공데이터, 예산, 입지와 이용률 검토가 필요합니다.</p>
    <div className="page-actions report-actions"><Link className="secondary-button" href="/compare">목록</Link><div><button className="secondary-button" type="button" onClick={() => window.print()}>PDF 저장·인쇄</button><Link className="primary-button" href="/public/policies">시민 공개 목록</Link></div></div>
  </article>;
}
