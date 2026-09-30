"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { asOfMonth, getRegion, region, regions, PEER_COUNT, type Region } from "../lib/regions";
import { baselineFor, changesLabel, courseBudget, demoDataVersion, demoScenariosFor, metricNames, normalizeScenario, restoreDemoScenariosFor, Scenario, usedCourses } from "../data/scenarios";
import { calculateSupplyMetrics, describeScenario } from "../lib/simulation";
import { AppShell, DataTable, Section, SideItem } from "./ui";

type ExtendedView = "regionCompare" | "facilities" | "history" | "report";
type FacilityChange = Record<string, number>;

// 시설 유형별 시연 비용단위(증설 1개당). 실제 공사·운영비가 확보되면 교체한다.
const facilityUnitCost: Record<string, number> = { 간이운동장: 3, 체력단련장: 4, 수영장: 15, 축구장: 8, 테니스장: 5 };

// 결과·비교 화면에서 고른 지역(sessionStorage)을 이어받는다. SSR은 기본 지역으로 렌더한 뒤 클라이언트에서 갱신한다.
function useSelectedRegion(): Region {
  const [target, setTarget] = useState<Region>(region);
  useEffect(() => {
    try {
      const id = sessionStorage.getItem("sports24-region");
      if (id && regions.some((item) => item.id === id)) setTarget(getRegion(id));
    } catch { /* 기본 지역을 유지한다. */ }
  }, []);
  return target;
}

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

export default function ExtendedPage({ view, scenarioId = "c", reportRegionId }: { view: ExtendedView; scenarioId?: string; reportRegionId?: string }) {
  const shell = config(view);
  return <AppShell {...shell}>{view === "regionCompare" ? <RegionCompare /> : view === "facilities" ? <FacilitySimulation /> : view === "history" ? <ComparisonHistory /> : <PolicyReport scenarioId={scenarioId} reportRegionId={reportRegionId} />}</AppShell>;
}

function RegionCompare() {
  const target = useSelectedRegion();
  return <>
    <div className="filter-bar compact-filter"><span className="filter-label">기준지역</span><strong>{target.label}</strong><span className="filter-label">유사지역 (자동 선정)</span><strong>{target.comparisonLabel}</strong></div>
    <p className="inline-notice neutral-notice">유사지역과 비교 평균은 코드가 인구 구성·규모·강좌·시설 데이터로 계산합니다. 인구·시설은 실측(기준 {asOfMonth}), 종목별 강좌는 시연값입니다.</p>
    <Section title="유사도 산정 결과" unit={`후보 ${target.rankedPeers.length}곳 중 상위 ${PEER_COUNT}곳 선정`}>
      <DataTable label="후보 지역 유사도 산정 결과" className="peer-score-table">
        <thead><tr><th scope="col">순위</th><th scope="col">후보지역</th><th scope="col">연령구성 차이</th><th scope="col">인구규모 차이</th><th scope="col">강좌총량 차이</th><th scope="col">시설수 차이</th><th scope="col">유사도</th><th scope="col">선정</th></tr></thead>
        <tbody>{target.rankedPeers.map((peer, index) => { const selected = index < PEER_COUNT; return <tr key={peer.region.id} className={selected ? "best-cell-row" : ""}>
          <td>{index + 1}</td><th scope="row">{peer.region.shortName}</th>
          <td>{peer.populationGap.toFixed(1)}%p</td><td>{peer.sizeGap.toFixed(1)}%</td><td>{peer.courseGap.toFixed(1)}%</td><td>{peer.facilityGap.toFixed(1)}%</td>
          <td><strong>{peer.similarity}</strong></td><td className={selected ? "positive" : ""}>{selected ? "선정" : "제외"}</td>
        </tr>; })}</tbody>
      </DataTable>
      <p className="table-note">유사도 = 100 − (연령구성 차이×0.4 + 인구규모 차이×0.3 + 강좌총량 차이×0.15 + 시설수 차이×0.15). 값이 작을수록 유사합니다. 산식은 <code>lib/regions.ts</code>에 있습니다.</p>
    </Section>
    <div className="overview-grid compare-region-grid">
      <Section title="인구구성 비교" unit="(단위: %)">
        <DataTable label="기준지역과 유사지역 인구구성 비교"><thead><tr><th scope="col">구분</th><th scope="col">청소년</th><th scope="col">청년</th><th scope="col">중장년</th><th scope="col">고령</th></tr></thead><tbody><tr><th scope="row">{target.shortName}</th>{target.population.region.map((value, index) => <td key={index}>{value}</td>)}</tr><tr><th scope="row">유사지역 평균</th>{target.population.comparison.map((value, index) => <td key={index}>{value}</td>)}</tr></tbody></DataTable>
      </Section>
      <Section title="선정된 유사지역"><div className="analysis-box"><h3>유사지역 <span>({target.similarPeers.length}개 지역)</span></h3><ol>{target.similarPeers.map((peer) => <li key={peer.region.id}>{peer.region.label} — 유사도 {peer.similarity}</li>)}<li>유사지역 평균값을 기준지역 비교값으로 사용합니다.</li></ol></div></Section>
    </div>
    <Section title="종목 공급 비중 비교" unit="(단위: %, %p)"><DataTable label="기준지역과 유사지역 종목 비중 비교"><thead><tr><th scope="col">종목</th><th scope="col">{target.shortName}</th><th scope="col">유사지역 평균</th><th scope="col">차이</th><th scope="col">검토</th></tr></thead><tbody>{target.courses.map((course) => { const difference = course.share - course.comparison; return <tr key={course.sport}><th scope="row">{course.sport}</th><td>{course.share.toFixed(1)}</td><td>{course.comparison.toFixed(1)}</td><td className={Math.abs(difference) >= 7 ? "danger" : ""}>{difference > 0 ? "+" : ""}{difference.toFixed(1)}</td><td>{difference <= -3 ? "상대적으로 낮음" : difference >= 3 ? "상대적으로 높음" : "유사 범위"}</td></tr>; })}</tbody></DataTable></Section>
    <div className="page-actions"><Link className="secondary-button" href="/">지역현황</Link><Link className="primary-button" href="/simulation">정책시뮬레이션</Link></div>
  </>;
}

function FacilitySimulation() {
  const target = useSelectedRegion();
  const [changes, setChanges] = useState<FacilityChange>({});
  const [notice, setNotice] = useState("");
  const facilities = target.facilityTypes.map((facility) => ({ ...facility, unitCost: facilityUnitCost[facility.type] ?? 5 }));
  const totalChange = Object.values(changes).reduce((sum, value) => sum + value, 0);
  const estimatedCost = facilities.reduce((sum, facility) => sum + Math.max(0, changes[facility.type] ?? 0) * facility.unitCost, 0);
  useEffect(() => {
    let restored: FacilityChange = {};
    try {
      const saved = sessionStorage.getItem(`sports24-facility-state-${target.id}`);
      if (saved) {
        const parsed = JSON.parse(saved) as { changes?: FacilityChange };
        for (const facility of target.facilityTypes) {
          const value = parsed.changes?.[facility.type];
          if (Number.isInteger(value) && value !== undefined && value >= -Math.min(1, facility.count) && value <= 2) restored[facility.type] = value;
        }
      }
    } catch { /* 저장값이 손상되었으면 기본 조정값을 사용한다. */ }
    setChanges(restored);
    setNotice("");
  }, [target]);
  const update = (type: string, value: number) => setChanges((current) => {
    const count = facilities.find((facility) => facility.type === type)?.count ?? 0;
    return { ...current, [type]: Math.max(-Math.min(1, count), Math.min(2, value)) };
  });
  const save = () => {
    try {
      sessionStorage.setItem(`sports24-facility-state-${target.id}`, JSON.stringify({ changes }));
      setNotice(`${target.shortName} 시설 조정 시연안을 이 브라우저 세션에 저장했습니다.`);
    } catch { setNotice("브라우저 저장소에 접근할 수 없어 저장하지 못했습니다."); }
  };
  return <>
    <div className="filter-bar compact-filter"><span className="filter-label">대상지역</span><strong>{target.label}</strong><span className="filter-label">정상운영 등록 시설</span><strong>{target.facilities.toLocaleString("ko-KR")}개소</strong></div>
    <p className="inline-notice neutral-notice">현재 시설 수는 전국체육시설 정보 API 실측값(정상운영, 기준 {asOfMonth})입니다. 증감·비용단위는 시연용 계획 입력이며 강좌 지표에는 합산하지 않습니다.</p>
    {notice && <p className="inline-notice" role="status">{notice}</p>}
    <Section title="시설 유형별 조정" unit="증설 +2 / 감축 −1 범위">
      <DataTable label="시설 유형별 조정 표" className="facility-table"><thead><tr><th scope="col">시설 유형</th><th scope="col">현재</th><th scope="col">증감</th><th scope="col">변경 후</th><th scope="col">시연 비용단위</th></tr></thead><tbody>{facilities.map((facility) => { const change = changes[facility.type] ?? 0; return <tr key={facility.type}><th scope="row">{facility.type}</th><td>{facility.count}</td><td><div className="stepper"><button type="button" aria-label={`${facility.type} 1개 감소`} onClick={() => update(facility.type, change - 1)}>−</button><output aria-label={`${facility.type} 증감`} className={change > 0 ? "positive" : change < 0 ? "danger" : ""}>{change > 0 ? `+${change}` : change}</output><button type="button" aria-label={`${facility.type} 1개 증가`} onClick={() => update(facility.type, change + 1)}>+</button></div></td><td><strong>{facility.count + change}</strong></td><td>{facility.unitCost}</td></tr>; })}</tbody></DataTable>
    </Section>
    <div className="summary-strip"><div><span>시설 순증감</span><strong>{totalChange > 0 ? `+${totalChange}` : totalChange}</strong></div><div><span>시연 비용단위</span><strong>{estimatedCost}</strong></div><div><span>강좌 지표 반영</span><strong>미적용</strong></div></div>
    <Section title="검토사항"><div className="analysis-box"><h3>시설 조정 검토</h3><ol><li>시설 수만으로 정책 효과를 산정하지 않습니다.</li><li>입지, 운영시간, 수용인원, 접근성 자료가 확보되면 별도 계산 엔진에 연결합니다.</li><li>강좌 조정 시나리오와 합산할 때는 중복 효과를 방지하는 기준이 필요합니다.</li></ol></div></Section>
    <div className="page-actions split-actions"><button className="secondary-button" type="button" onClick={() => { setChanges({}); setNotice("시설 조정값을 초기화했습니다. 저장된 시연안은 다시 저장할 때 변경됩니다."); }}>초기화</button><div><button className="secondary-button" type="button" onClick={save}>시연안 저장</button><Link className="primary-button" href="/simulation">강좌 조정으로 이동</Link></div></div>
  </>;
}

function ComparisonHistory() {
  const target = useSelectedRegion();
  const [scenarios, setScenarios] = useState<Scenario[]>(() => demoScenariosFor(region));
  useEffect(() => {
    let list: Scenario[] | null = null;
    let storedVersion: number | undefined;
    try {
      const saved = sessionStorage.getItem(`sports24-state-${target.id}`);
      if (saved) {
        const parsed = JSON.parse(saved) as { demoDataVersion?: number; scenarios?: Scenario[] };
        if (Array.isArray(parsed.scenarios)) list = parsed.scenarios;
        storedVersion = parsed.demoDataVersion;
      }
    } catch { /* 예시 시나리오로 대체한다. */ }
    setScenarios(restoreDemoScenariosFor(target, list ?? demoScenariosFor(target), list ? storedVersion : demoDataVersion));
  }, [target]);
  return <>
    <div className="filter-bar compact-filter"><span className="filter-label">대상지역</span><strong>{target.label}</strong></div>
    <p className="inline-notice neutral-notice">이력은 현재 브라우저에 저장된 {target.shortName} 시나리오입니다. 서버 저장과 담당자별 영구 이력은 아직 연결하지 않았습니다.</p>
    <Section title="최근 비교 이력" unit={`총 ${scenarios.length}건`}><DataTable label="최근 시나리오 비교 이력"><thead><tr><th scope="col">등록일</th><th scope="col">대상지역</th><th scope="col">정책안</th><th scope="col">조정내용</th><th scope="col">담당부서</th><th scope="col">결과</th></tr></thead><tbody>{scenarios.length ? scenarios.map((scenario) => <tr key={scenario.id}><td>{scenario.date}</td><td>{target.shortName}</td><th scope="row">{scenario.name}</th><td className="text-left">{changesLabel(scenario.changes)}</td><td>체육진흥과</td><td><Link className="table-link" href={`/reports/${scenario.id}?region=${target.id}`}>보고서 보기</Link></td></tr>) : <tr><td colSpan={6} className="empty-row">저장된 시나리오가 없습니다. <Link href="/simulation">강좌 조정으로 이동</Link></td></tr>}</tbody></DataTable></Section>
    <Section title="저장 범위"><div className="analysis-box"><h3>시연 이력 안내</h3><ol><li>현재는 브라우저 세션에 저장된 {target.shortName} 시나리오만 표시합니다.</li><li>실제 서비스에서는 비교 대상, 지표 버전, 데이터 기준월을 함께 저장해야 합니다.</li><li>정책안 원본이 변경되어도 기존 보고서의 계산 기준은 보존해야 합니다.</li></ol></div></Section>
    <div className="page-actions"><Link className="primary-button" href="/compare">새 비교 시작</Link></div>
  </>;
}

// 보고서는 결과·비교 화면에서 선택한 지역과 시나리오(sessionStorage)를 그대로 이어받는다.
function PolicyReport({ scenarioId, reportRegionId }: { scenarioId: string; reportRegionId?: string }) {
  const [state, setState] = useState<{ target: Region; scenario: Scenario } | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let rid = region.id;
    let scenarios: Scenario[] | null = null;
    try {
      const savedRegion = sessionStorage.getItem("sports24-region");
      if (savedRegion && regions.some((item) => item.id === savedRegion)) rid = savedRegion;
    } catch { /* 기본 지역을 사용한다. */ }
    if (reportRegionId && regions.some((item) => item.id === reportRegionId)) rid = reportRegionId;
    try {
      const saved = sessionStorage.getItem(`sports24-state-${rid}`);
      if (saved) { const parsed = JSON.parse(saved) as { scenarios?: Scenario[] }; if (Array.isArray(parsed.scenarios)) scenarios = parsed.scenarios; }
    } catch { /* 예시 시나리오로 대체한다. */ }
    const target = getRegion(rid);
    const scenario = (scenarios ?? demoScenariosFor(target)).map(normalizeScenario).find((item) => item.id === scenarioId)
      ?? (scenarioId.startsWith("saved-") ? undefined : demoScenariosFor(target).find((item) => item.id === scenarioId));
    setState(scenario ? { target, scenario } : null);
    setLoaded(true);
  }, [scenarioId, reportRegionId]);

  if (!loaded) return <article className="report-sheet"><p>보고서를 불러오는 중입니다…</p></article>;
  if (!state) return <article className="report-sheet"><div className="analysis-box"><h3>보고서를 찾을 수 없습니다</h3><p>이 브라우저 세션에 해당 정책안이 없습니다. 지역이나 저장된 시나리오를 확인해 주세요.</p><Link className="secondary-button" href="/compare">정책안 비교로 이동</Link></div></article>;
  const { target, scenario } = state;
  const baselineMetrics = baselineFor(target);
  const metrics = calculateSupplyMetrics(target.courses, scenario.changes);
  const analysis = describeScenario(target.courses, scenario.changes);
  return <article className="report-sheet">
    <div className="report-meta"><div><span>보고서 번호</span><strong>SPORTS24-{scenario.date.replaceAll(".", "")}-{scenario.id.toUpperCase()}</strong></div><div><span>대상지역</span><strong>{target.label}</strong></div><div><span>작성기준</span><strong>인구·시설 {asOfMonth} / 강좌 시연값</strong></div></div>
    <Section title="정책안 요약"><DataTable label="정책안 요약"><tbody><tr><th scope="row">시나리오명</th><td>{scenario.name}</td><th scope="row">강좌 사용</th><td>{usedCourses(scenario.changes)} / {courseBudget}개</td></tr><tr><th scope="row">조정내용</th><td colSpan={3}>{changesLabel(scenario.changes)}</td></tr></tbody></DataTable></Section>
    <Section title="핵심 지표"><DataTable label="정책 보고서 핵심 지표"><thead><tr><th scope="col">지표</th><th scope="col">현재</th><th scope="col">정책안</th><th scope="col">변화</th></tr></thead><tbody>{metricNames.map((name, index) => { const before = baselineMetrics[index]; const after = metrics[index]; const delta = before === null || after === null ? null : after - before; return <tr key={name}><th scope="row">{name}</th><td>{before ?? "산출 불가"}</td><td>{after ?? "산출 불가"}</td><td>{delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta}`}</td></tr>; })}</tbody></DataTable></Section>
    <Section title="검토 의견"><div className="analysis-box"><h3>코드 계산 결과 기반</h3><ol>{analysis.map((item) => <li key={item}>{item}</li>)}</ol></div></Section>
    <p className="report-disclaimer">인구·시설은 실측(기준 {asOfMonth}), 종목별 강좌는 시연값입니다. 실제 정책 판단에는 강좌-지역 결합 데이터, 예산, 입지와 이용률 검토가 필요합니다.</p>
    <div className="page-actions report-actions"><Link className="secondary-button" href="/compare">목록</Link><div><button className="secondary-button" type="button" onClick={() => window.print()}>PDF 저장·인쇄</button><Link className="primary-button" href="/public/policies">시민 공개 목록</Link></div></div>
  </article>;
}
