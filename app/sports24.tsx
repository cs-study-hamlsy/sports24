"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { asOfMonth, facilityCollectedAt, getRegion, region as defaultRegion, regions, type Region } from "../lib/regions";
import { baselineFor, changesLabel, courseBudget, demoDataVersion, demoScenariosFor, metricNames, restoreDemoScenariosFor, Scenario, scenarioTemplates, usedCourses } from "../data/scenarios";
import { calculateSupplyMetrics, describeScenario } from "../lib/simulation";
import { formatAiAnalysis, formatAiReport, type AiReportType } from "../lib/ai-analysis";
import { provinceOptions, regionsForProvince } from "../lib/region-options";
import { catalogProvinces, catalogRegionById, firstRegionForProvince } from "../lib/region-catalog";
import { AppShell, DataTable, Section, SideItem } from "./ui";
import { CourseShareChart } from "./course-share-chart";

type View = "overview" | "simulation" | "result" | "compare";
type Course = Region["courses"][number];
// 선택한 지역(activeRegion)에 따라 시뮬레이션·결과·비교가 모두 다시 계산된다.
const REGION_KEY = "sports24-region";
const stateKey = (regionId: string) => `sports24-state-${regionId}`;
type LiveCourse = { brno: string; facil_sn: string; course_no: string; item_nm: string; course_nm: string; lectr_nm: string; lectr_weekday_val: string; settl_amt: string };
type CourseSearch = { item_nm: string; course_nm: string; brno: string; facil_sn: string };
type CourseResponse = { pageNo: number; numOfRows: number; totalCount: number; items: LiveCourse[]; error?: string };

const ageLabels = ["청소년", "청년", "중장년", "고령(65세 이상)"];
const editableSports = ["태권도", "수영", "배드민턴", "생활체조", "요가·필라테스", "축구", "농구", "탁구", "테니스", "기타"];
const paths: Record<View, string> = { overview: "/", simulation: "/simulation", result: "/result", compare: "/compare" };
const navLabels: Record<View, string> = { overview: "지역현황", simulation: "정책시뮬레이션", result: "결과조회", compare: "정책안비교" };
const sideMenus: Record<View, string[]> = {
  overview: ["체육공급 현황", "종목별 강좌", "연령별 인구", "유사지역 비교"],
  simulation: ["강좌 조정", "시설 조정", "저장된 시나리오"],
  result: ["시나리오 결과", "분석의견"],
  compare: ["시나리오 비교", "비교 이력"],
};
const titles: Record<View, string> = {
  overview: "체육공급 현황",
  simulation: "강좌 조정 시뮬레이션",
  result: "시나리오 결과조회",
  compare: "시나리오 비교",
};

function currentDate() {
  const date = new Date();
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function sameChanges(left: Record<string, number>, right: Record<string, number>) {
  return editableSports.every((sport) => (left[sport] ?? 0) === (right[sport] ?? 0));
}

function courseCount(region: Region, sport: string) {
  return region.courses.find((course) => course.sport === sport)?.count ?? 0;
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}

function metricsFor(region: Region, scenario: Scenario) {
  return calculateSupplyMetrics(region.courses, scenario.changes);
}

type DemoState = { demoDataVersion: number; scenarios: Scenario[]; activeScenarioId: string; previewScenario: Scenario | null; draftName: string; draftChanges: Record<string, number> };

function defaultsFor(region: Region): DemoState {
  const scenarios = demoScenariosFor(region);
  return { demoDataVersion, scenarios, activeScenarioId: "c", previewScenario: null, draftName: scenarios[2].name, draftChanges: { ...scenarios[2].changes } };
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Sports24({ view }: { view: View }) {
  const router = useRouter();
  const [regionId, setRegionId] = useState(defaultRegion.id);
  const activeRegion = useMemo(() => getRegion(regionId), [regionId]);
  const baselineMetrics = useMemo(() => baselineFor(activeRegion), [activeRegion]);
  const demoScenarios = useMemo(() => demoScenariosFor(activeRegion), [activeRegion]);

  const [draftName, setDraftName] = useState(scenarioTemplates[2].name);
  const [draftChanges, setDraftChanges] = useState<Record<string, number>>({ ...scenarioTemplates[2].changes });
  const [visibleSports, setVisibleSports] = useState(editableSports.slice(0, 7));
  const [selectedSports, setSelectedSports] = useState(["태권도", "수영", "배드민턴", "생활체조"]);
  const [scenarios, setScenarios] = useState<Scenario[]>(() => demoScenariosFor(defaultRegion));
  const [selectedScenarioIds, setSelectedScenarioIds] = useState(scenarioTemplates.map((item) => item.id));
  const [activeScenarioId, setActiveScenarioId] = useState("c");
  const [previewScenario, setPreviewScenario] = useState<Scenario | null>(null);
  const [notice, setNotice] = useState("");
  const [removedScenarios, setRemovedScenarios] = useState<Scenario[]>([]);
  const [loaded, setLoaded] = useState(false);

  function applyState(targetRegion: Region, state: DemoState, storedVersion = demoDataVersion) {
    setScenarios(restoreDemoScenariosFor(targetRegion, state.scenarios, storedVersion));
    setActiveScenarioId(state.activeScenarioId);
    setPreviewScenario(state.previewScenario);
    setDraftName(state.draftName);
    setDraftChanges(state.draftChanges);
  }

  useEffect(() => {
    let rid = defaultRegion.id;
    try {
      const savedRegion = sessionStorage.getItem(REGION_KEY);
      if (savedRegion && regions.some((item) => item.id === savedRegion)) rid = savedRegion;
      const saved = sessionStorage.getItem(stateKey(rid));
      const target = getRegion(rid);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<DemoState>;
        applyState(target, { ...defaultsFor(target), ...parsed }, parsed.demoDataVersion);
      } else applyState(target, defaultsFor(target));
    } catch {
      applyState(getRegion(rid), defaultsFor(getRegion(rid)));
      setNotice("저장된 시나리오를 읽지 못했습니다. 기본 정책안을 표시합니다.");
    }
    setRegionId(rid);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      sessionStorage.setItem(REGION_KEY, regionId);
      sessionStorage.setItem(stateKey(regionId), JSON.stringify({ demoDataVersion, scenarios, activeScenarioId, previewScenario, draftName, draftChanges }));
    } catch {
      setNotice("브라우저 저장 공간을 사용할 수 없어 현재 화면에서만 변경사항이 유지됩니다.");
    }
  }, [loaded, regionId, scenarios, activeScenarioId, previewScenario, draftName, draftChanges]);

  function selectRegion(id: string) {
    if (id === regionId) return;
    setRegionId(id);
    try {
      sessionStorage.setItem(REGION_KEY, id);
      const saved = sessionStorage.getItem(stateKey(id));
      const target = getRegion(id);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<DemoState>;
        applyState(target, { ...defaultsFor(target), ...parsed }, parsed.demoDataVersion);
      } else applyState(target, defaultsFor(target));
    } catch {
      applyState(getRegion(id), defaultsFor(getRegion(id)));
    }
    setVisibleSports(editableSports.slice(0, 7));
    setSelectedScenarioIds(scenarioTemplates.map((item) => item.id));
    setNotice(`${getRegion(id).label} 기준으로 전환했습니다.`);
  }

  const activeScenario = previewScenario ?? scenarios.find((item) => item.id === activeScenarioId) ?? demoScenarios[2];
  const knownDraft = demoScenarios.find((item) => sameChanges(item.changes, draftChanges));
  const previewMetrics = calculateSupplyMetrics(activeRegion.courses, draftChanges);
  const positiveUsed = usedCourses(draftChanges);
  const netChange = Object.values(draftChanges).reduce((sum, value) => sum + value, 0);
  const afterTotal = activeRegion.courses.reduce((sum, course) => sum + course.count, 0) + netChange;

  function setChange(sport: string, nextValue: number) {
    if (nextValue < -courseCount(activeRegion, sport)) return;
    const next = { ...draftChanges, [sport]: nextValue };
    if (usedCourses(next) > courseBudget) {
      setNotice(`추가 가능한 강좌는 ${courseBudget}개입니다. 다른 종목의 증감을 먼저 줄여 주세요.`);
      return;
    }
    setDraftChanges(next);
    setNotice("");
  }

  function makeDraftScenario(): Scenario {
    return {
      id: knownDraft?.id ?? `draft-${Date.now()}`,
      name: draftName.trim() || "새 시나리오",
      changes: { ...draftChanges },
      metrics: previewMetrics,
      date: currentDate(),
      analysis: describeScenario(activeRegion.courses, draftChanges),
    };
  }

  function persist(next: Partial<DemoState>) {
    try {
      sessionStorage.setItem(stateKey(regionId), JSON.stringify({ demoDataVersion, scenarios, activeScenarioId, previewScenario, draftName, draftChanges, ...next }));
    } catch { /* The inline status below explains unavailable storage. */ }
  }

  function saveScenario() {
    const draft = makeDraftScenario();
    const saved: Scenario = { ...draft, id: `saved-${Date.now()}` };
    const nextScenarios = [...scenarios, saved];
    setScenarios(nextScenarios);
    setActiveScenarioId(saved.id);
    setPreviewScenario(null);
    persist({ scenarios: nextScenarios, activeScenarioId: saved.id, previewScenario: null });
    setNotice(`“${saved.name}” 시나리오를 저장했습니다.`);
  }

  function openResult() {
    const draft = makeDraftScenario();
    setPreviewScenario(draft);
    persist({ previewScenario: draft });
    router.push(paths.result);
  }

  function openSavedResult(scenario: Scenario) {
    setActiveScenarioId(scenario.id);
    setPreviewScenario(null);
    persist({ activeScenarioId: scenario.id, previewScenario: null });
    router.push(paths.result);
  }

  function loadScenario(scenario: Scenario) {
    setDraftName(scenario.name);
    setDraftChanges({ ...scenario.changes });
    setNotice(`“${scenario.name}” 조정값을 불러왔습니다.`);
    router.push(paths.simulation);
  }

  function removeSelectedScenarios() {
    const removed = scenarios.filter((scenario) => selectedScenarioIds.includes(scenario.id));
    if (!removed.length) {
      setNotice("삭제할 시나리오를 선택해 주세요.");
      return;
    }
    setRemovedScenarios(removed);
    setScenarios(scenarios.filter((scenario) => !selectedScenarioIds.includes(scenario.id)));
    setSelectedScenarioIds([]);
    setNotice(`${removed.length}개 시나리오를 목록에서 제거했습니다.`);
  }

  const sideTargets = view === "overview"
    ? ["#main", "#courses", "#population", "/regions/compare"]
    : view === "simulation"
      ? ["#course-adjustment", "/simulation/facilities", paths.compare]
      : view === "result"
        ? ["#scenario-info", "#analysis"]
        : ["#scenario-list", "/compare/history"];
  const sideItems: SideItem[] = sideMenus[view].map((label, index) => ({ label, href: sideTargets[index], current: index === 0 }));

  return (
    <AppShell
      activeNav={view}
      sideTitle={navLabels[view]}
      sideItems={sideItems}
      title={titles[view]}
      breadcrumb={[navLabels[view], view === "simulation" ? "강좌 조정" : view === "result" ? "시나리오 결과" : titles[view]]}
      notice={notice}
    >

          {view === "overview" && <Overview region={activeRegion} onSelectRegion={selectRegion} onSimulation={() => router.push(paths.simulation)} />}
          {view === "simulation" && <>
            <form className="filter-bar simulation-filter" noValidate onSubmit={(event: FormEvent) => { event.preventDefault(); saveScenario(); }}>
              <label htmlFor="scenario-name">시나리오명</label>
              <input id="scenario-name" value={draftName} onChange={(event) => setDraftName(event.target.value)} maxLength={60} />
              <RegionSelectorFields idPrefix="simulation" regionId={regionId} onChange={selectRegion} />
              <p className="budget-summary">추가 가능 강좌 <b>{courseBudget}개</b> / 사용 <b>{positiveUsed}개</b> / 잔여 <strong>{courseBudget - positiveUsed}개</strong></p>
            </form>
            <div id="course-adjustment">
              <Section title="종목별 강좌 조정" unit="(단위: 개)">
                <DataTable label="종목별 강좌 조정 표" className="adjustment-table">
                  <thead><tr><th scope="col">선택</th><th scope="col">종목</th><th scope="col">현재</th><th scope="col">증감</th><th scope="col">변경 후</th><th scope="col">변경 후 비중</th><th scope="col">비교지역 평균</th></tr></thead>
                  <tbody>
                    {visibleSports.map((sport) => {
                      const course = activeRegion.courses.find((item) => item.sport === sport)!;
                      const change = draftChanges[sport] ?? 0;
                      return <tr key={sport}>
                        <td><input type="checkbox" aria-label={`${sport} 선택`} checked={selectedSports.includes(sport)} onChange={(event) => setSelectedSports((current) => event.target.checked ? [...current, sport] : current.filter((item) => item !== sport))} /></td>
                        <th scope="row">{sport}</th><td>{course.count}</td>
                        <td><div className="stepper"><button type="button" aria-label={`${sport} 강좌 1개 감소`} onClick={() => setChange(sport, change - 1)}>−</button><output className={change > 0 ? "positive" : change < 0 ? "danger" : ""} aria-label={`${sport} 증감`}>{signed(change)}</output><button type="button" aria-label={`${sport} 강좌 1개 증가`} onClick={() => setChange(sport, change + 1)}>+</button></div></td>
                        <td><strong>{course.count + change}</strong></td><td>{((course.count + change) / afterTotal * 100).toFixed(1)}%</td><td>{course.comparison.toFixed(1)}%</td>
                      </tr>;
                    })}
                    <tr className="total-row"><td /><th scope="row">합계 (기타 {courseCount(activeRegion, "기타")}개 포함)</th><td>{activeRegion.courses.reduce((sum, course) => sum + course.count, 0)}</td><td>{signed(netChange)}</td><td>{afterTotal}</td><td /><td /></tr>
                  </tbody>
                </DataTable>
              </Section>
              <div className="table-actions">
                <button type="button" className="secondary-button" onClick={() => {
                  const next = editableSports.find((sport) => !visibleSports.includes(sport));
                  if (next) { setVisibleSports([...visibleSports, next]); setNotice(`“${next}” 종목을 조정 표에 추가했습니다.`); }
                  else setNotice("추가할 종목이 없습니다.");
                }}>+ 종목 추가</button>
                <button type="button" className="secondary-button" onClick={() => {
                  if (!selectedSports.length) { setNotice("제외할 종목을 선택해 주세요."); return; }
                  setVisibleSports(visibleSports.filter((sport) => !selectedSports.includes(sport)));
                  setDraftChanges(Object.fromEntries(Object.entries(draftChanges).filter(([sport]) => !selectedSports.includes(sport))));
                  setSelectedSports([]);
                  setNotice("선택한 종목을 조정 표에서 제외했습니다. 다시 추가할 수 있습니다.");
                }}>선택 삭제</button>
              </div>
            </div>
            <Section title="지표 변화 미리보기">
              <DataTable label="지표 변화 미리보기 표" className="preview-table">
                <thead><tr><th scope="col">구분</th>{metricNames.map((name) => <th key={name} scope="col">{name}</th>)}</tr></thead>
                <tbody>
                  <tr><th scope="row">현재</th>{baselineMetrics.map((value, index) => <td key={metricNames[index]}>{value ?? "산출 불가"}</td>)}</tr>
                  <tr><th scope="row">변경 후</th>{metricNames.map((name, index) => <td key={name}><strong>{previewMetrics[index] ?? "산출 불가"}</strong></td>)}</tr>
                  <tr className="total-row"><th scope="row">증감</th>{metricNames.map((name, index) => {
                    const before = baselineMetrics[index];
                    const after = previewMetrics[index];
                    const delta = before === null || after === null ? null : after - before;
                    return <td key={name} className={delta === null ? "" : (index === 2 ? delta < 0 : delta > 0) ? "positive" : delta === 0 ? "" : "danger"}>{delta === null ? "산출 불가" : `${delta > 0 ? "▲" : delta < 0 ? "▼" : ""}${Math.abs(delta)}${index === 2 && delta < 0 ? " (개선)" : ""}`}</td>;
                  })}</tr>
                </tbody>
              </DataTable>
              <p className="table-note">유사도는 실제 수요 적합도를 뜻하지 않으며 연령별 적합도는 산출하지 않습니다.</p>
            </Section>
            <AiAnalysisPanel type="alternative" title="AI 대안 방향 제안" fallback="아래 ‘B안 예시 불러오기’로 비교안을 불러올 수 있습니다." context={{
              regionLabel: activeRegion.label,
              similarRegions: activeRegion.comparisonLabel,
              courseBudget,
              usedCourses: positiveUsed,
              currentChanges: changesLabel(draftChanges),
              metrics: metricNames.map((name, index) => ({ name, before: baselineMetrics[index], after: previewMetrics[index] })),
              courses: activeRegion.courses.map((course) => ({ sport: course.sport, currentCount: course.count, peerAveragePercent: course.comparison })),
            }} />
            <div className="page-actions split-actions">
              <button type="button" className="secondary-button" onClick={() => { setDraftName("새 시나리오"); setDraftChanges({}); setVisibleSports(editableSports.slice(0, 7)); setNotice("강좌 조정값을 초기화했습니다."); }}>초기화</button>
              <div>
                <button type="button" className="secondary-button" onClick={() => { setDraftName(demoScenarios[1].name); setDraftChanges({ ...demoScenarios[1].changes }); setNotice("B안을 불러왔습니다. 위 ‘AI 대안 방향 제안’에서 근거 설명을 생성할 수 있습니다."); }}>B안 예시 불러오기</button>
                <button type="button" className="secondary-button" onClick={saveScenario}>시나리오 저장</button>
                <button type="button" className="primary-button" onClick={openResult}>결과조회</button>
              </div>
            </div>
          </>}
          {view === "result" && <Result region={activeRegion} scenario={activeScenario} onList={() => router.push(paths.compare)} onCompare={() => router.push(paths.compare)} />}
          {view === "compare" && <>
            <div id="scenario-list">
              <Section title="저장된 시나리오 목록" unit={`총 ${scenarios.length}건`}>
                <DataTable label="저장된 시나리오 목록 표" className="scenario-list-table">
                  <thead><tr><th scope="col">선택</th><th scope="col">번호</th><th scope="col">시나리오명</th><th scope="col">조정내용</th><th scope="col">강좌 사용</th><th scope="col">등록일</th><th scope="col">보고서</th></tr></thead>
                  <tbody>{scenarios.length ? scenarios.map((scenario, index) => <tr key={scenario.id}>
                    <td><input type="checkbox" aria-label={`${scenario.name} 선택`} checked={selectedScenarioIds.includes(scenario.id)} onChange={(event) => setSelectedScenarioIds((current) => event.target.checked ? [...current, scenario.id] : current.filter((id) => id !== scenario.id))} /></td>
                    <td>{scenarios.length - index}</td>
                    <th scope="row"><button type="button" className="table-link" onClick={() => openSavedResult(scenario)}>{scenario.name}</button></th>
                    <td className="text-left">{changesLabel(scenario.changes)}</td>
                    <td>{usedCourses(scenario.changes)}/{courseBudget}</td><td>{scenario.date}</td><td><Link className="table-link" href={`/reports/${scenario.id}?region=${regionId}`}>보기</Link></td>
                  </tr>) : <tr><td colSpan={7} className="empty-row">저장된 시나리오가 없습니다. <Link href={paths.simulation}>강좌 조정으로 이동</Link></td></tr>}</tbody>
                </DataTable>
              </Section>
            </div>
            <div id="comparison">
              <Section title="지표 비교" unit="굵은 글씨: 항목별 최고값 (편중도는 최저값)">
                <DataTable label="시나리오 지표 비교 표" className="compare-metrics-table">
                  <thead><tr><th scope="col">지표명</th><th scope="col">현재</th>{scenarios.filter((item) => selectedScenarioIds.includes(item.id)).map((scenario) => <th scope="col" key={scenario.id}>{scenario.name.split(" ")[0]}</th>)}</tr></thead>
                  <tbody>{metricNames.map((name, index) => {
                    const selected = scenarios.filter((item) => selectedScenarioIds.includes(item.id));
                    const values = selected.map((item) => metricsFor(activeRegion, item)[index]).filter((value): value is number => typeof value === "number");
                    const best = values.length ? (index === 2 ? Math.min(...values) : Math.max(...values)) : null;
                    return <tr key={name}><th scope="row">{name}</th><td className="baseline-cell">{baselineMetrics[index] ?? "산출 불가"}</td>{selected.map((scenario) => { const value = metricsFor(activeRegion, scenario)[index]; return <td key={scenario.id} className={value !== null && value === best ? "best-cell" : ""}>{value ?? "산출 불가"}</td>; })}</tr>;
                  })}</tbody>
                </DataTable>
              </Section>
              <Section title="분석의견">
                <DataTable label="시나리오별 장단점 표" className="comparison-notes-table">
                  <thead><tr><th scope="col">구분</th><th scope="col">장점</th><th scope="col">단점</th></tr></thead>
                  <tbody>{scenarios.filter((item) => selectedScenarioIds.includes(item.id)).map((scenario) => { const metrics = metricsFor(activeRegion, scenario); return <tr key={scenario.id}><th scope="row">{scenario.name.split(" ")[0]}</th><td className="text-left">{`구성 유사도 ${metrics[0]}점, 다양성 ${metrics[1]}점`}</td><td className="text-left">{`편중도 ${metrics[2]}점. 연령별 적합도는 산출 불가`}</td></tr>; })}</tbody>
                </DataTable>
              </Section>
            </div>
            <div className="page-actions split-actions">
              <div><button type="button" className="secondary-button" onClick={removeSelectedScenarios}>선택 삭제</button>{removedScenarios.length > 0 && <button type="button" className="text-button" onClick={() => { setScenarios([...scenarios, ...removedScenarios]); setSelectedScenarioIds(removedScenarios.map((item) => item.id)); setRemovedScenarios([]); setNotice("제거한 시나리오를 복원했습니다."); }}>삭제 취소</button>}</div>
              <div>
                <button type="button" className="secondary-button" onClick={() => downloadCsv("시나리오-지표비교.csv", [
                  ["지표명", "현재", ...scenarios.filter((item) => selectedScenarioIds.includes(item.id)).map((item) => item.name)],
                  ...metricNames.map((name, index) => [name, baselineMetrics[index] ?? "산출 불가", ...scenarios.filter((item) => selectedScenarioIds.includes(item.id)).map((item) => metricsFor(activeRegion, item)[index] ?? "산출 불가")]),
                ])}>CSV 다운로드</button>
                <button type="button" className="secondary-button" onClick={() => window.print()}>인쇄</button>
              </div>
            </div>
          </>}
    </AppShell>
  );
}

function Overview({ region: currentRegion, onSelectRegion, onSimulation }: { region: Region; onSelectRegion: (id: string) => void; onSimulation: () => void }) {
  const [draftRegion, setDraftRegion] = useState(currentRegion.id);
  const [comparisonId, setComparisonId] = useState("similar");
  const [unavailableRegionId, setUnavailableRegionId] = useState<string | null>(null);
  useEffect(() => { setDraftRegion(currentRegion.id); }, [currentRegion.id]);
  useEffect(() => { setComparisonId("similar"); }, [currentRegion.id]);
  const comparisonPreview = catalogRegionById(draftRegion)?.available ? getRegion(draftRegion) : null;
  const comparisonRegion = comparisonId === "similar" ? null : getRegion(comparisonId);
  const displayRegion = comparisonRegion ? {
    ...currentRegion,
    comparisonLabel: comparisonRegion.shortName,
    population: { ...currentRegion.population, comparison: comparisonRegion.population.region },
    courses: currentRegion.courses.map((course) => {
      const peer = comparisonRegion.courses.find((item) => item.sport === course.sport);
      const peerTotal = comparisonRegion.courses.reduce((sum, item) => sum + item.count, 0) || 1;
      return { ...course, comparison: Math.round(((peer?.count ?? 0) / peerTotal) * 1000) / 10 };
    }),
  } : currentRegion;
  const totalCourses = displayRegion.courses.reduce((sum, course) => sum + course.count, 0);
  const selectDraftRegion = (id: string) => {
    setDraftRegion(id);
    setComparisonId("similar");
    setUnavailableRegionId(catalogRegionById(id)?.available ? null : id);
  };
  const controls = <form className="filter-bar overview-filter" noValidate onSubmit={(event) => {
    event.preventDefault();
    if (catalogRegionById(draftRegion)?.available) {
      setUnavailableRegionId(null);
      onSelectRegion(draftRegion);
    } else setUnavailableRegionId(draftRegion);
  }}>
    <RegionSelectorFields idPrefix="overview" regionId={draftRegion} onChange={selectDraftRegion} scope="national" />
    <label htmlFor="comparison-region">비교지역</label><select id="comparison-region" value={comparisonId} disabled={!comparisonPreview} onChange={(event) => setComparisonId(event.target.value)}><option value="similar">{comparisonPreview ? `자동 평균 (${comparisonPreview.comparisonLabel})` : "지역 데이터 준비 중"}</option>{comparisonPreview && regions.filter((item) => item.id !== draftRegion).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
    <button className="primary-button" type="submit">조회</button>
  </form>;
  const unavailableRegion = unavailableRegionId ? catalogRegionById(unavailableRegionId) : null;
  if (unavailableRegion) return <>{controls}<div className="region-unavailable" role="status"><h2>{unavailableRegion.provinceName} {unavailableRegion.name}</h2><p>이 지역의 체육공급 지표는 준비 중입니다. 다른 지역을 선택해 조회해 주세요.</p></div></>;
  return <>
    {controls}
    <div className="region-summary-strip">
      <div><span>총 주민등록 인구</span><strong>{currentRegion.totalPopulation.toLocaleString("ko-KR")}명</strong><small>실측 · 기준 {asOfMonth}</small></div>
      <div><span>정상운영 등록 체육시설</span><strong>{currentRegion.facilities.toLocaleString("ko-KR")}개소</strong><small>실측 · {facilityCollectedAt} 조회 · 시·도 주소 확인분</small></div>
      <div><span>등록 강좌</span><strong>{totalCourses}개</strong><small>종목별 구성</small></div>
    </div>
    <div className="overview-grid">
      <Section title="주요지표"><DataTable label="주요지표 표" className="metrics-table"><thead><tr><th scope="col">지표명</th><th scope="col">값</th><th scope="col">판정</th><th scope="col">비고</th></tr></thead><tbody>{metricNames.map((name, index) => { const value = calculateSupplyMetrics(displayRegion.courses)[index]; return <tr key={name}><th scope="row">{name}</th><td>{value ?? "—"}</td><td>{value === null ? "산출 불가" : "참고"}</td><td>{["유사지역 종목 비중과의 일치도", "종목 비중의 고른 정도", "종목 비중 제곱합(낮을수록 분산)", "연령별 실제 수요·수강 대상 자료 없음", "연령별 실제 수요·수강 대상 자료 없음"][index]}</td></tr>; })}</tbody></DataTable></Section>
      <div id="population"><Section title="연령별 인구 구성"><DataTable label="연령별 인구 구성 표"><thead><tr><th scope="col">구분</th>{ageLabels.map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody><tr><th scope="row">{displayRegion.shortName}</th>{displayRegion.population.region.map((value, index) => <td className={index === 3 ? "danger" : ""} key={ageLabels[index]}>{value}%</td>)}</tr><tr><th scope="row">비교지역 평균</th>{displayRegion.population.comparison.map((value, index) => <td key={ageLabels[index]}>{value}%</td>)}</tr></tbody></DataTable><p className="table-note">※ 연령별 인구는 행정안전부 주민등록 인구(기준 {asOfMonth}) 실측값입니다. 잠재 수요 참고용이며 종목 선호를 의미하지 않습니다.</p></Section></div>
      <div id="courses"><Section title="종목별 강좌 현황" unit="(단위: 개, %)"><CourseShareChart courses={displayRegion.courses} /><DataTable label="종목별 강좌 현황 표"><thead><tr><th scope="col">종목</th><th scope="col">강좌수</th><th scope="col">비중</th><th scope="col">비교지역 평균</th><th scope="col">차이</th></tr></thead><tbody>{displayRegion.courses.map((course) => { const difference = course.share - course.comparison; return <tr key={course.sport}><th scope="row">{course.sport}</th><td>{course.count}</td><td>{course.share.toFixed(1)}</td><td>{course.comparison.toFixed(1)}</td><td className={Math.abs(difference) >= 7 ? "danger" : ""}>{difference > 0 ? "+" : ""}{difference.toFixed(1)}</td></tr>; })}<tr className="total-row"><th scope="row">합계</th><td>{totalCourses}</td><td>100.0</td><td>100.0</td><td /></tr></tbody></DataTable></Section></div>
      <div className="overview-analysis"><Section title="분석의견"><div className="analysis-box"><h3>현황 분석의견</h3><ol>{currentRegion.analysis.slice(0, 3).map((item) => <li key={item}>{item}</li>)}<li>연령별 강좌 적합도는 수강 대상·실제 수요 자료가 없어 판단하지 않습니다.</li></ol></div></Section></div>
    </div>
    <AiAnalysisPanel type="gap" title="AI Gap 분석" fallback="AI 분석 없이도 위 지표와 분석의견은 그대로 확인할 수 있습니다." context={{
      regionLabel: displayRegion.label,
      similarRegions: displayRegion.comparisonLabel,
      metrics: metricNames.map((name, index) => ({ name, value: calculateSupplyMetrics(displayRegion.courses)[index] })),
      courses: displayRegion.courses.map((course) => ({ sport: course.sport, count: course.count, sharePercent: course.share, peerAveragePercent: course.comparison })),
      population: { region: displayRegion.population.region, peerAverage: displayRegion.population.comparison, labels: ["청소년", "청년", "중장년", "고령"] },
    }} />
    <div className="page-actions"><button type="button" className="secondary-button" onClick={() => downloadCsv(`${displayRegion.shortName}-체육공급현황.csv`, [["종목", "강좌수", "비중", "비교지역 평균"], ...displayRegion.courses.map((course) => [course.sport, course.count, course.share, course.comparison])])}>CSV 다운로드</button><button type="button" className="secondary-button" onClick={() => window.print()}>인쇄</button><button type="button" className="primary-button" onClick={onSimulation}>정책시뮬레이션</button></div>
    <LiveCourseLookup region={currentRegion} />
    <LiveFacilityLookup region={currentRegion} />
  </>;
}

type LiveFacility = { faci_nm: string; ftype_nm: string; fcob_nm: string; faci_stat_nm: string; inout_gbn_nm: string; addr_ctpv_nm: string; addr_cpb_nm: string; faci_road_addr: string };
type FacilitySearch = { cpb_nm: string; ftype_nm: string; faci_nm: string };
type FacilityResponse = { pageNo: number; numOfRows: number; totalCount: number; items: LiveFacility[]; error?: string };

function LiveFacilityLookup({ region }: { region: Region }) {
  const [search, setSearch] = useState<FacilitySearch>({ cpb_nm: region.shortName, ftype_nm: "", faci_nm: "" });
  const [committed, setCommitted] = useState<FacilitySearch | null>(null);
  const [result, setResult] = useState<FacilityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => {
    requestRef.current?.abort();
    setSearch({ cpb_nm: region.shortName, ftype_nm: "", faci_nm: "" });
    setCommitted(null);
    setResult(null);
    setLoading(false);
    setError("");
  }, [region]);

  async function load(pageNo: number, filters: FacilitySearch) {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ pageNo: String(pageNo), numOfRows: "10" });
    for (const [key, value] of Object.entries(filters)) if (value.trim()) params.set(key, value.trim());
    try {
      const response = await fetch(`/api/facilities?${params}`, { signal: controller.signal });
      const data = await response.json() as FacilityResponse;
      if (!response.ok) throw new Error(data.error || "체육시설 정보를 불러오지 못했습니다.");
      if (controller.signal.aborted) return;
      setResult(data);
      setCommitted(filters);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : "체육시설 정보를 불러오지 못했습니다.");
      setResult(null);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  const fields: { key: keyof FacilitySearch; label: string; placeholder: string }[] = [
    { key: "cpb_nm", label: "시군구", placeholder: "예: 원주시" },
    { key: "ftype_nm", label: "시설유형", placeholder: "예: 수영장" },
    { key: "faci_nm", label: "시설명", placeholder: "예: 종합체육관" },
  ];
  const first = result ? (result.pageNo - 1) * result.numOfRows + 1 : 0;
  const last = result ? Math.min(result.pageNo * result.numOfRows, result.totalCount) : 0;

  return <details className="live-courses" id="live-facilities">
    <summary>전국체육시설 정보 실시간 조회</summary>
    <p className="table-note">국민체육진흥공단 전국체육시설 정보 API의 실측 데이터입니다. 위 “정상운영 등록 체육시설” 수치와 같은 출처이며, 폐업 시설도 함께 조회됩니다.</p>
    <form className="course-search-form" noValidate onSubmit={(event) => { event.preventDefault(); void load(1, search); }}>
      {fields.map(({ key, label, placeholder }) => <div className="course-search-field" key={key}>
        <label htmlFor={`faci-${key}`}>{label}</label>
        <div className="course-search-input"><input id={`faci-${key}`} value={search[key]} maxLength={100} placeholder={placeholder} onChange={(event) => setSearch((current) => ({ ...current, [key]: event.target.value }))} />
          {search[key] && <button type="button" aria-label={`${label} 지우기`} onClick={() => { setSearch((current) => ({ ...current, [key]: "" })); }}>×</button>}
        </div>
      </div>)}
      <button type="submit" className="primary-button" disabled={loading}>{loading ? "조회 중" : "시설 조회"}</button>
    </form>
    <div className="live-result" aria-live="polite">
      {loading ? <p>체육시설을 조회하고 있습니다.</p> : error ? <p className="live-error" role="alert">{error}</p> : !result ? <p>시군구·시설유형·시설명을 입력하고 시설 조회를 누르세요.</p> : result.items.length === 0 ? <p>조회된 시설이 없습니다. 검색 조건을 바꿔 다시 조회해 주세요.</p> : <>
        <p>총 {result.totalCount.toLocaleString("ko-KR")}건 중 {first.toLocaleString("ko-KR")}–{last.toLocaleString("ko-KR")}건</p>
        <DataTable label="전국체육시설 조회 결과" className="live-course-table"><thead><tr><th scope="col">시설명</th><th scope="col">유형</th><th scope="col">업종</th><th scope="col">상태</th><th scope="col">실내외</th><th scope="col">주소</th></tr></thead><tbody>{result.items.map((facility, index) => <tr key={`${facility.faci_nm}-${index}`}><th scope="row">{facility.faci_nm || "—"}</th><td>{facility.ftype_nm || "—"}</td><td>{facility.fcob_nm || "—"}</td><td className={facility.faci_stat_nm.includes("폐업") ? "danger" : ""}>{facility.faci_stat_nm || "—"}</td><td>{facility.inout_gbn_nm || "—"}</td><td className="text-left">{facility.faci_road_addr || "—"}</td></tr>)}</tbody></DataTable>
        <div className="course-pagination"><button type="button" className="secondary-button" disabled={result.pageNo <= 1} onClick={() => committed && void load(result.pageNo - 1, committed)}>이전</button><span>{result.pageNo}페이지</span><button type="button" className="secondary-button" disabled={last >= result.totalCount} onClick={() => committed && void load(result.pageNo + 1, committed)}>다음</button></div>
      </>}
    </div>
  </details>;
}

function LiveCourseLookup({ region }: { region: Region }) {
  const [search, setSearch] = useState<CourseSearch>({ item_nm: "", course_nm: "", brno: "", facil_sn: "" });
  const [committed, setCommitted] = useState<CourseSearch | null>(null);
  const [result, setResult] = useState<CourseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const inputRefs = useRef<Record<keyof CourseSearch, HTMLInputElement | null>>({ item_nm: null, course_nm: null, brno: null, facil_sn: null });

  useEffect(() => () => requestRef.current?.abort(), []);

  async function load(pageNo: number, filters: CourseSearch) {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ pageNo: String(pageNo), numOfRows: "10" });
    for (const [key, value] of Object.entries(filters)) if (value.trim()) params.set(key, value.trim());
    try {
      const response = await fetch(`/api/courses?${params}`, { signal: controller.signal });
      const data = await response.json() as CourseResponse;
      if (!response.ok) throw new Error(data.error || "강좌정보를 불러오지 못했습니다.");
      if (controller.signal.aborted) return;
      setResult(data);
      setCommitted(filters);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : "강좌정보를 불러오지 못했습니다.");
      setResult(null);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  const fields: { key: keyof CourseSearch; label: string; placeholder: string }[] = [
    { key: "item_nm", label: "종목명", placeholder: "예: 태권도" },
    { key: "course_nm", label: "강좌명", placeholder: "예: 초급반" },
    { key: "brno", label: "사업자등록번호", placeholder: "숫자 입력" },
    { key: "facil_sn", label: "시설일련번호", placeholder: "숫자 입력" },
  ];
  const first = result ? (result.pageNo - 1) * result.numOfRows + 1 : 0;
  const last = result ? Math.min(result.pageNo * result.numOfRows, result.totalCount) : 0;

  return <details className="live-courses" id="live-courses">
    <summary>스포츠바우처 등록강좌 실시간 조회</summary>
    <p className="table-note">공공데이터 API의 전국 강좌정보입니다. 지역 식별 정보가 없어 위 {region.shortName} 지표와 시뮬레이션 수치에는 아직 합산하지 않습니다.</p>
    <form className="course-search-form" noValidate onSubmit={(event) => { event.preventDefault(); void load(1, search); }}>
      {fields.map(({ key, label, placeholder }) => <div className="course-search-field" key={key}>
        <label htmlFor={`live-${key}`}>{label}</label>
        <div className="course-search-input"><input id={`live-${key}`} ref={(element) => { inputRefs.current[key] = element; }} value={search[key]} maxLength={100} placeholder={placeholder} onChange={(event) => setSearch((current) => ({ ...current, [key]: event.target.value }))} />
          {search[key] && <button type="button" aria-label={`${label} 지우기`} onClick={() => { setSearch((current) => ({ ...current, [key]: "" })); requestRef.current?.abort(); setLoading(false); inputRefs.current[key]?.focus(); }}>×</button>}
        </div>
      </div>)}
      <button type="submit" className="primary-button" disabled={loading}>{loading ? "조회 중" : "강좌 조회"}</button>
    </form>
    <div className="live-result" aria-live="polite">
      {loading ? <p>등록강좌를 조회하고 있습니다.</p> : error ? <p className="live-error" role="alert">{error}</p> : !result ? <p>검색 조건을 입력하고 강좌 조회를 누르세요. 조건이 없으면 첫 페이지를 조회합니다.</p> : result.items.length === 0 ? <p>조회된 강좌가 없습니다. 검색 조건을 바꿔 다시 조회해 주세요.</p> : <>
        <p>총 {result.totalCount.toLocaleString("ko-KR")}건 중 {first.toLocaleString("ko-KR")}–{last.toLocaleString("ko-KR")}건</p>
        <DataTable label="스포츠바우처 등록강좌 조회 결과" className="live-course-table"><thead><tr><th scope="col">종목</th><th scope="col">강좌명</th><th scope="col">강사</th><th scope="col">요일</th><th scope="col">이용금액</th><th scope="col">사업자번호</th><th scope="col">시설번호</th></tr></thead><tbody>{result.items.map((course, index) => <tr key={`${course.brno}-${course.facil_sn}-${course.course_no}-${index}`}><th scope="row">{course.item_nm || "—"}</th><td>{course.course_nm || "—"}</td><td>{course.lectr_nm || "—"}</td><td>{course.lectr_weekday_val || "—"}</td><td>{course.settl_amt || "—"}</td><td>{course.brno || "—"}</td><td>{course.facil_sn || "—"}</td></tr>)}</tbody></DataTable>
        <div className="course-pagination"><button type="button" className="secondary-button" disabled={result.pageNo <= 1} onClick={() => committed && void load(result.pageNo - 1, committed)}>이전</button><span>{result.pageNo}페이지</span><button type="button" className="secondary-button" disabled={last >= result.totalCount} onClick={() => committed && void load(result.pageNo + 1, committed)}>다음</button></div>
      </>}
    </div>
  </details>;
}

function Result({ region, scenario, onList, onCompare }: { region: Region; scenario: Scenario; onList: () => void; onCompare: () => void }) {
  const baselineMetrics = baselineFor(region);
  const scenarioMetrics = metricsFor(region, scenario);
  const net = Object.values(scenario.changes).reduce((sum, value) => sum + value, 0);
  const total = region.courses.reduce((sum, course) => sum + course.count, 0) + net;
  const visibleCourses = region.courses;
  return <>
    <div id="scenario-info"><Section title="시나리오 정보"><DataTable label="시나리오 정보 표" className="scenario-info-table"><tbody><tr><th scope="row">시나리오명</th><td>{scenario.name}</td><th scope="row">대상지역</th><td>{region.label}</td></tr><tr><th scope="row">조정내용</th><td>{changesLabel(scenario.changes)}</td><th scope="row">강좌 사용</th><td>{usedCourses(scenario.changes)} / {courseBudget}개 (잔여 {courseBudget - usedCourses(scenario.changes)})</td></tr></tbody></DataTable></Section></div>
    <div className="result-grid">
      <Section title="지표 비교"><DataTable label="시나리오 지표 비교 표" className="result-metrics-table"><thead><tr><th scope="col">지표명</th><th scope="col">현재</th><th scope="col">변경 후</th><th scope="col">증감</th><th scope="col">판정</th></tr></thead><tbody>{metricNames.map((name, index) => { const before = baselineMetrics[index]; const after = scenarioMetrics[index]; const delta = before === null || after === null ? null : after - before; const improved = delta !== null && (index === 2 ? delta < 0 : delta > 0); return <tr key={name}><th scope="row">{name}</th><td>{before ?? "산출 불가"}</td><td><strong>{after ?? "산출 불가"}</strong></td><td className={delta === null ? "" : improved ? "positive" : delta === 0 ? "" : "danger"}>{delta === null ? "—" : signed(delta)}</td><td className={delta === null ? "" : improved ? "positive" : delta === 0 ? "" : "danger"}>{delta === null ? "산출 불가" : improved ? "개선" : delta === 0 ? "유지" : "악화"}</td></tr>; })}</tbody></DataTable></Section>
      <Section title="종목 구성 변화" unit="(단위: %)"><CourseShareChart courses={region.courses} changes={scenario.changes} /><DataTable label="종목 구성 변화 표" className="result-course-table"><thead><tr><th scope="col">종목</th><th scope="col">현재 비중</th><th scope="col">변경 후</th><th scope="col">비교지역</th><th scope="col">비교</th></tr></thead><tbody>{visibleCourses.map((course: Course) => { const after = ((course.count + (scenario.changes[course.sport] ?? 0)) / total) * 100; const label = after < course.comparison - 3 ? "여전히 낮음" : after > course.comparison + 3 ? "여전히 높음" : Math.abs(after - course.comparison) <= 0.5 ? "유사 수준" : "-"; return <tr key={course.sport}><th scope="row">{course.sport}</th><td>{course.share.toFixed(1)}</td><td><strong>{after.toFixed(1)}</strong></td><td>{course.comparison.toFixed(1)}</td><td className={label.startsWith("여전히") ? "danger" : ""}>{label}</td></tr>; })}</tbody></DataTable></Section>
    </div>
    <div id="analysis"><Section title="분석의견"><div className="analysis-box result-analysis"><h3>시나리오 분석의견</h3><ol>{describeScenario(region.courses, scenario.changes).map((item) => <li key={item}>{item}</li>)}</ol></div></Section></div>
    <AiAnalysisPanel type="review" title="AI 정책 검토" fallback="AI 검토가 없어도 위 자동분석 결과는 그대로 사용할 수 있습니다." context={{
      regionLabel: region.label,
      similarRegions: region.comparisonLabel,
      asOfMonth,
      scenario: scenario.name,
      changes: changesLabel(scenario.changes),
      courseBudget,
      usedCourses: usedCourses(scenario.changes),
      metrics: metricNames.map((name, index) => ({ name, before: baselineMetrics[index], after: scenarioMetrics[index] })),
    }} />
    <div className="page-actions split-actions"><button type="button" className="secondary-button" onClick={onList}>목록</button><div><button type="button" className="secondary-button" onClick={() => window.print()}>인쇄·PDF 저장</button><button type="button" className="primary-button" onClick={onCompare}>정책안비교</button></div></div>
  </>;
}

function AiAnalysisPanel({ type, title, context, fallback }: { type: string; title: string; context: unknown; fallback?: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const reportType = type === "gap" || type === "review" || type === "alternative" ? type as AiReportType : null;
  const reportContext = reportType ? context as { regionLabel?: string; scenario?: string; asOfMonth?: string; similarRegions?: string; courseBudget?: number } : null;
  const reportLabels = {
    gap: { name: "지역 체육공급 분석 의견서", scope: "검토 범위: 종목별 강좌 구성과 유사지역 비교값. 실제 이용 수요와 공급 부족 여부는 별도 자료로 확인해야 합니다." },
    review: { name: "정책 검토 의견서", scope: "검토 범위: 강좌 조정안을 가상 적용한 종목 구성 지표. 실제 시행 효과와 수요는 별도 검증이 필요합니다." },
    alternative: { name: "강좌 조정 대안 의견서", scope: "검토 범위: 현재 강좌 구성과 자원 한도를 바탕으로 한 조정 방향. 제안된 증감은 시뮬레이션으로 재계산해야 합니다." },
  };

  async function run() {
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, context }),
      });
      const data = await response.json() as { text?: string; error?: string };
      if (!response.ok) {
        setStatus("error");
        setMessage(data.error || "AI 분석을 불러오지 못했습니다.");
        return;
      }
      setText(data.text ?? "");
      setStatus("done");
    } catch {
      setStatus("error");
      setMessage("AI 분석 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }

  return <Section title={title}>
    <div className="ai-panel">
      <div className="ai-panel-head">
        <p>계산 엔진이 산출한 값만 전달해 AI가 해석·검토 의견을 생성합니다. 수치는 AI가 만들지 않습니다.</p>
        <button type="button" className="secondary-button" onClick={run} disabled={status === "loading"}>{status === "loading" ? "생성 중…" : status === "done" ? "다시 생성" : "AI 분석 생성"}</button>
      </div>
      {status === "done" && (reportType && reportContext ? <article className="policy-review" aria-live="polite">
        <header><p>운동24 · {reportLabels[reportType].name}</p><h3>{reportType === "review" ? reportContext.scenario ?? "정책안 검토" : reportContext.regionLabel ?? "지역 분석"}</h3><div><span>대상지역 {reportContext.regionLabel}</span>{reportType === "gap" && <span>비교 기준 {reportContext.similarRegions}</span>}{reportType === "alternative" && <span>추가 한도 {reportContext.courseBudget}개 강좌</span>}{reportType === "review" && <span>인구 기준 {reportContext.asOfMonth}</span>}</div></header>
        <p className="policy-review-scope">{reportLabels[reportType].scope}</p>
        {formatAiReport(text, reportType).map((section, index) => <section key={`${section.heading}-${index}`}><h4>{section.heading}</h4><p>{section.body}</p></section>)}
      </article> : <ul className="ai-panel-body" aria-live="polite">{formatAiAnalysis(text).map((item, index) => <li key={`${item.heading}-${index}`}><p>{item.heading && <><strong>{item.heading}</strong>{item.body && " — "}</>}{item.body}</p></li>)}</ul>)}
      {status === "error" && <p className="inline-notice neutral-notice" role="status">{message}{fallback ? ` ${fallback}` : ""}</p>}
    </div>
  </Section>;
}

function RegionSelectorFields({ idPrefix, regionId, onChange, scope = "available" }: { idPrefix: string; regionId: string; onChange: (id: string) => void; scope?: "available" | "national" }) {
  if (scope === "national") {
    const selected = catalogRegionById(regionId) ?? catalogRegionById("wonju")!;
    const detailedRegions = catalogProvinces.find((province) => province.id === selected.provinceId)?.regions ?? [];
    return <>
      <label htmlFor={`${idPrefix}-province`}>시·도</label>
      <select id={`${idPrefix}-province`} value={selected.provinceId} onChange={(event) => {
        const first = firstRegionForProvince(event.target.value);
        if (first) onChange(first.id);
      }}>{catalogProvinces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <label htmlFor={`${idPrefix}-region`}>세부지역</label>
      <select id={`${idPrefix}-region`} value={selected.id} onChange={(event) => onChange(event.target.value)}>{detailedRegions.map((item) => <option key={item.id} value={item.id}>{item.name}{item.available ? "" : " (준비 중)"}</option>)}</select>
    </>;
  }
  const selected = getRegion(regionId);
  const provinces = provinceOptions(regions);
  const detailedRegions = regionsForProvince(regions, selected.provinceId);
  return <>
    <label htmlFor={`${idPrefix}-province`}>시·도</label>
    <select id={`${idPrefix}-province`} value={selected.provinceId} onChange={(event) => {
      const first = regionsForProvince(regions, event.target.value)[0];
      if (first) onChange(first.id);
    }}>{provinces.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
    <label htmlFor={`${idPrefix}-region`}>세부지역</label>
    <select id={`${idPrefix}-region`} value={regionId} onChange={(event) => onChange(event.target.value)}>{detailedRegions.map((item) => <option key={item.id} value={item.id}>{item.shortName}</option>)}</select>
  </>;
}
