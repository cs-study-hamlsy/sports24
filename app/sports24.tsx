"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import regions from "../data/regions.json";
import { baselineMetrics, changesLabel, courseBudget, demoScenarios, metricNames, Scenario, usedCourses } from "../data/scenarios";

type View = "overview" | "simulation" | "result" | "compare";
type Region = (typeof regions)[number];
type Course = Region["courses"][number];

const region = regions[0];
const ageLabels = ["청소년", "청년", "중장년", "고령(65세 이상)"];
const editableSports = ["태권도", "수영", "배드민턴", "생활체조", "요가·필라테스", "기타"];
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

function courseCount(sport: string) {
  return region.courses.find((course) => course.sport === sport)?.count ?? 0;
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
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
  const [fontScale, setFontScale] = useState(1);
  const [draftName, setDraftName] = useState(demoScenarios[2].name);
  const [draftChanges, setDraftChanges] = useState<Record<string, number>>({ ...demoScenarios[2].changes });
  const [visibleSports, setVisibleSports] = useState(editableSports.slice(0, 5));
  const [selectedSports, setSelectedSports] = useState(["태권도", "수영", "배드민턴", "생활체조"]);
  const [scenarios, setScenarios] = useState<Scenario[]>(demoScenarios);
  const [selectedScenarioIds, setSelectedScenarioIds] = useState(["a", "b", "c"]);
  const [activeScenarioId, setActiveScenarioId] = useState("c");
  const [previewScenario, setPreviewScenario] = useState<Scenario | null>(null);
  const [notice, setNotice] = useState("");
  const [removedScenarios, setRemovedScenarios] = useState<Scenario[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("sports24-demo-state");
      if (saved) {
        const state = JSON.parse(saved) as {
          scenarios?: Scenario[];
          activeScenarioId?: string;
          previewScenario?: Scenario | null;
          draftName?: string;
          draftChanges?: Record<string, number>;
        };
        if (Array.isArray(state.scenarios)) setScenarios(state.scenarios);
        if (typeof state.activeScenarioId === "string") setActiveScenarioId(state.activeScenarioId);
        if (state.previewScenario) setPreviewScenario(state.previewScenario);
        if (typeof state.draftName === "string") setDraftName(state.draftName);
        if (state.draftChanges && typeof state.draftChanges === "object") setDraftChanges(state.draftChanges);
      }
    } catch {
      setNotice("저장된 시나리오를 읽지 못했습니다. 기본 시연안을 표시합니다.");
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      sessionStorage.setItem("sports24-demo-state", JSON.stringify({ scenarios, activeScenarioId, previewScenario, draftName, draftChanges }));
    } catch {
      setNotice("브라우저 저장 공간을 사용할 수 없어 현재 화면에서만 변경사항이 유지됩니다.");
    }
  }, [loaded, scenarios, activeScenarioId, previewScenario, draftName, draftChanges]);

  const activeScenario = previewScenario ?? scenarios.find((item) => item.id === activeScenarioId) ?? demoScenarios[2];
  const knownDraft = demoScenarios.find((item) => sameChanges(item.changes, draftChanges));
  const previewMetrics = knownDraft?.metrics ?? null;
  const positiveUsed = usedCourses(draftChanges);
  const netChange = Object.values(draftChanges).reduce((sum, value) => sum + value, 0);
  const afterTotal = 84 + netChange;

  function setChange(sport: string, nextValue: number) {
    if (nextValue < -courseCount(sport)) return;
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
      analysis: knownDraft?.analysis ?? ["강좌 수와 종목 비중은 변경값으로 계산했습니다.", "공급 지표와 정책 분석의견은 계산 엔진 연결 후 표시됩니다."],
    };
  }

  function saveScenario() {
    const draft = makeDraftScenario();
    const saved: Scenario = { ...draft, id: `saved-${Date.now()}` };
    const nextScenarios = [...scenarios, saved];
    setScenarios(nextScenarios);
    setActiveScenarioId(saved.id);
    setPreviewScenario(null);
    try {
      sessionStorage.setItem("sports24-demo-state", JSON.stringify({ scenarios: nextScenarios, activeScenarioId: saved.id, previewScenario: null, draftName, draftChanges }));
    } catch { /* The inline status below explains unavailable storage. */ }
    setNotice(`“${saved.name}” 시나리오를 저장했습니다.`);
  }

  function openResult() {
    const draft = makeDraftScenario();
    setPreviewScenario(draft);
    try {
      sessionStorage.setItem("sports24-demo-state", JSON.stringify({ scenarios, activeScenarioId, previewScenario: draft, draftName, draftChanges }));
    } catch { /* The result falls back to the selected demo scenario. */ }
    router.push(paths.result);
  }

  function openSavedResult(scenario: Scenario) {
    setActiveScenarioId(scenario.id);
    setPreviewScenario(null);
    try {
      sessionStorage.setItem("sports24-demo-state", JSON.stringify({ scenarios, activeScenarioId: scenario.id, previewScenario: null, draftName, draftChanges }));
    } catch { /* The result falls back to the selected demo scenario. */ }
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

  const sideItems = sideMenus[view];
  const sideTargets = view === "overview"
    ? ["#main", "#courses", "#population", "#courses"]
    : view === "simulation"
      ? ["#course-adjustment", "#facility-adjustment", paths.compare]
      : view === "result"
        ? ["#scenario-info", "#analysis"]
        : ["#scenario-list", "#comparison"];

  return (
    <div className="app-shell" style={{ "--font-scale": fontScale } as React.CSSProperties}>
      <header>
        <div className="utility-bar">
          <span>체육진흥과 담당자 님</span><span className="utility-divider" aria-hidden="true" />
          <span>글자크기</span>
          <button type="button" className="font-control" onClick={() => setFontScale((value) => Math.min(1.12, value + 0.06))} aria-label="글자 크게">+</button>
          <button type="button" className="font-control" onClick={() => setFontScale((value) => Math.max(0.94, value - 0.06))} aria-label="글자 작게">−</button>
        </div>
        <div className="brand-row"><span className="brand-mark" aria-hidden="true">S</span><strong>SPORTS24</strong><span>체육정책 시뮬레이션 시스템</span></div>
        <nav className="global-nav" aria-label="주 메뉴">
          {(Object.keys(paths) as View[]).map((key) => <Link key={key} href={paths[key]} aria-current={view === key ? "page" : undefined}>{navLabels[key]}</Link>)}
        </nav>
      </header>
      <div className="workspace">
        <aside className="side-panel" aria-label={`${navLabels[view]} 메뉴`}>
          <section className="side-menu">
            <h2>{navLabels[view]}</h2>
            {sideItems.map((item, index) => sideTargets[index] === "#facility-adjustment"
              ? <span key={item} aria-disabled="true" title="시설 조정은 다음 개발 단계입니다">· {item}</span>
              : <Link key={item} href={sideTargets[index]} className={index === 0 ? "selected" : ""} aria-current={index === 0 ? "page" : undefined}>· {item}</Link>)}
          </section>
          <section className="source-box"><h2>자료 출처</h2><p>스포츠강좌이용권 등록강좌</p><p>전국 체육시설 현황</p><p>주민등록 연령별 인구</p></section>
        </aside>
        <main id="main">
          <div className="page-heading">
            <h1><span aria-hidden="true" />{titles[view]}</h1>
            <nav aria-label="현재 위치">HOME <b aria-hidden="true">›</b> {navLabels[view]} <b aria-hidden="true">›</b> <strong>{view === "simulation" ? "강좌 조정" : view === "result" ? "시나리오 결과" : titles[view]}</strong></nav>
          </div>
          {notice && <p className="inline-notice" role="status">{notice}</p>}

          {view === "overview" && <Overview onSimulation={() => router.push(paths.simulation)} />}
          {view === "simulation" && <>
            <form className="filter-bar simulation-filter" noValidate onSubmit={(event: FormEvent) => { event.preventDefault(); saveScenario(); }}>
              <label htmlFor="scenario-name">시나리오명</label>
              <input id="scenario-name" value={draftName} onChange={(event) => setDraftName(event.target.value)} maxLength={60} />
              <label htmlFor="simulation-region">지역</label>
              <select id="simulation-region" defaultValue="wonju"><option value="wonju">{region.label}</option></select>
              <p className="budget-summary">추가 가능 강좌 <b>{courseBudget}개</b> / 사용 <b>{positiveUsed}개</b> / 잔여 <strong>{courseBudget - positiveUsed}개</strong></p>
            </form>
            <div id="course-adjustment">
              <Section title="종목별 강좌 조정" unit="(단위: 개)">
                <DataTable label="종목별 강좌 조정 표" className="adjustment-table">
                  <thead><tr><th scope="col">선택</th><th scope="col">종목</th><th scope="col">현재</th><th scope="col">증감</th><th scope="col">변경 후</th><th scope="col">변경 후 비중</th><th scope="col">비교지역 평균</th></tr></thead>
                  <tbody>
                    {visibleSports.map((sport) => {
                      const course = region.courses.find((item) => item.sport === sport)!;
                      const change = draftChanges[sport] ?? 0;
                      return <tr key={sport}>
                        <td><input type="checkbox" aria-label={`${sport} 선택`} checked={selectedSports.includes(sport)} onChange={(event) => setSelectedSports((current) => event.target.checked ? [...current, sport] : current.filter((item) => item !== sport))} /></td>
                        <th scope="row">{sport}</th><td>{course.count}</td>
                        <td><div className="stepper"><button type="button" aria-label={`${sport} 강좌 1개 감소`} onClick={() => setChange(sport, change - 1)}>−</button><output className={change > 0 ? "positive" : change < 0 ? "danger" : ""} aria-label={`${sport} 증감`}>{signed(change)}</output><button type="button" aria-label={`${sport} 강좌 1개 증가`} onClick={() => setChange(sport, change + 1)}>+</button></div></td>
                        <td><strong>{course.count + change}</strong></td><td>{((course.count + change) / afterTotal * 100).toFixed(1)}%</td><td>{course.comparison.toFixed(1)}%</td>
                      </tr>;
                    })}
                    <tr className="total-row"><td /><th scope="row">합계 (기타 {courseCount("기타")}개 포함)</th><td>84</td><td>{signed(netChange)}</td><td>{afterTotal}</td><td /><td /></tr>
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
                  <tr><th scope="row">현재</th>{baselineMetrics.map((value, index) => <td key={metricNames[index]}>{value}</td>)}</tr>
                  <tr><th scope="row">변경 후</th>{metricNames.map((name, index) => <td key={name}><strong>{previewMetrics?.[index] ?? "—"}</strong></td>)}</tr>
                  <tr className="total-row"><th scope="row">증감</th>{metricNames.map((name, index) => {
                    const delta = previewMetrics ? previewMetrics[index] - baselineMetrics[index] : null;
                    return <td key={name} className={delta === null ? "" : (index === 2 ? delta < 0 : delta > 0) ? "positive" : delta === 0 ? "" : "danger"}>{delta === null ? "계산 대기" : `${delta > 0 ? "▲" : delta < 0 ? "▼" : ""}${Math.abs(delta)}${index === 2 && delta < 0 ? " (개선)" : ""}`}</td>;
                  })}</tr>
                </tbody>
              </DataTable>
              {!previewMetrics && <p className="table-note">임의 조정안의 정책 지표는 계산 엔진 연결 후 표시합니다. 강좌 수와 비중은 현재 변경값으로 계산했습니다.</p>}
            </Section>
            <div className="page-actions split-actions">
              <button type="button" className="secondary-button" onClick={() => { setDraftName("새 시나리오"); setDraftChanges({}); setVisibleSports(editableSports.slice(0, 5)); setNotice("강좌 조정값을 초기화했습니다."); }}>초기화</button>
              <div>
                <button type="button" className="secondary-button" onClick={() => { setDraftName(demoScenarios[1].name); setDraftChanges({ ...demoScenarios[1].changes }); setNotice("목업의 B안 예시를 불러왔습니다. 실제 AI 대안 생성은 다음 개발 단계입니다."); }}>AI 대안 생성</button>
                <button type="button" className="secondary-button" onClick={saveScenario}>시나리오 저장</button>
                <button type="button" className="primary-button" onClick={openResult}>결과조회</button>
              </div>
            </div>
          </>}
          {view === "result" && <Result scenario={activeScenario} onList={() => router.push(paths.compare)} onCompare={() => router.push(paths.compare)} />}
          {view === "compare" && <>
            <div id="scenario-list">
              <Section title="저장된 시나리오 목록" unit={`총 ${scenarios.length}건`}>
                <DataTable label="저장된 시나리오 목록 표" className="scenario-list-table">
                  <thead><tr><th scope="col">선택</th><th scope="col">번호</th><th scope="col">시나리오명</th><th scope="col">조정내용</th><th scope="col">강좌 사용</th><th scope="col">등록일</th></tr></thead>
                  <tbody>{scenarios.length ? scenarios.map((scenario, index) => <tr key={scenario.id}>
                    <td><input type="checkbox" aria-label={`${scenario.name} 선택`} checked={selectedScenarioIds.includes(scenario.id)} onChange={(event) => setSelectedScenarioIds((current) => event.target.checked ? [...current, scenario.id] : current.filter((id) => id !== scenario.id))} /></td>
                    <td>{scenarios.length - index}</td>
                    <th scope="row"><button type="button" className="table-link" onClick={() => openSavedResult(scenario)}>{scenario.name}</button></th>
                    <td className="text-left">{changesLabel(scenario.changes)}</td>
                    <td>{usedCourses(scenario.changes)}/{courseBudget}</td><td>{scenario.date}</td>
                  </tr>) : <tr><td colSpan={6} className="empty-row">저장된 시나리오가 없습니다. <Link href={paths.simulation}>강좌 조정으로 이동</Link></td></tr>}</tbody>
                </DataTable>
              </Section>
            </div>
            <div id="comparison">
              <Section title="지표 비교" unit="굵은 글씨: 항목별 최고값 (편중도는 최저값)">
                <DataTable label="시나리오 지표 비교 표" className="compare-metrics-table">
                  <thead><tr><th scope="col">지표명</th><th scope="col">현재</th>{scenarios.filter((item) => selectedScenarioIds.includes(item.id)).map((scenario) => <th scope="col" key={scenario.id}>{scenario.name.split(" ")[0]}</th>)}</tr></thead>
                  <tbody>{metricNames.map((name, index) => {
                    const selected = scenarios.filter((item) => selectedScenarioIds.includes(item.id));
                    const values = selected.map((item) => item.metrics?.[index]).filter((value): value is number => typeof value === "number");
                    const best = values.length ? (index === 2 ? Math.min(...values) : Math.max(...values)) : null;
                    return <tr key={name}><th scope="row">{name}</th><td className="baseline-cell">{baselineMetrics[index]}</td>{selected.map((scenario) => <td key={scenario.id} className={scenario.metrics?.[index] === best ? "best-cell" : ""}>{scenario.metrics?.[index] ?? "—"}</td>)}</tr>;
                  })}</tbody>
                </DataTable>
              </Section>
              <Section title="분석의견">
                <DataTable label="시나리오별 장단점 표" className="comparison-notes-table">
                  <thead><tr><th scope="col">구분</th><th scope="col">장점</th><th scope="col">단점</th></tr></thead>
                  <tbody>{scenarios.filter((item) => selectedScenarioIds.includes(item.id)).map((scenario) => <tr key={scenario.id}><th scope="row">{scenario.name.split(" ")[0]}</th><td className="text-left">{scenario.id === "a" ? "청소년 적합도 최고(84)" : scenario.id === "b" ? "공급 적합도·다양성·고령층 적합도 최고" : scenario.id === "c" ? "종목 편중도 최저(32), 잔여 강좌 1개" : "강좌 조정안을 저장하고 비교할 수 있음"}</td><td className="text-left">{scenario.id === "a" ? "고령층 적합도 개선 미흡(43 → 50)" : scenario.id === "b" ? "강좌 10개 전부 사용, 청소년 적합도 3점 하락" : scenario.id === "c" ? "태권도 축소에 따른 이해관계 조정 필요" : "지표 계산 엔진 연결 전이라 수치 비교 대기"}</td></tr>)}</tbody>
                </DataTable>
              </Section>
            </div>
            <div className="page-actions split-actions">
              <div><button type="button" className="secondary-button" onClick={removeSelectedScenarios}>선택 삭제</button>{removedScenarios.length > 0 && <button type="button" className="text-button" onClick={() => { setScenarios([...scenarios, ...removedScenarios]); setSelectedScenarioIds(removedScenarios.map((item) => item.id)); setRemovedScenarios([]); setNotice("제거한 시나리오를 복원했습니다."); }}>삭제 취소</button>}</div>
              <div>
                <button type="button" className="secondary-button" onClick={() => downloadCsv("시나리오-지표비교.csv", [
                  ["지표명", "현재", ...scenarios.filter((item) => selectedScenarioIds.includes(item.id)).map((item) => item.name)],
                  ...metricNames.map((name, index) => [name, baselineMetrics[index], ...scenarios.filter((item) => selectedScenarioIds.includes(item.id)).map((item) => item.metrics?.[index] ?? "계산 대기")]),
                ])}>CSV 다운로드</button>
                <button type="button" className="secondary-button" onClick={() => window.print()}>인쇄</button>
                <button type="button" className="primary-button" onClick={() => { const scenario = scenarios.find((item) => selectedScenarioIds.includes(item.id)); if (scenario) openSavedResult(scenario); else setNotice("보고서로 확인할 시나리오를 선택해 주세요."); }}>보고서 작성</button>
              </div>
            </div>
          </>}
        </main>
      </div>
    </div>
  );
}

function Overview({ onSimulation }: { onSimulation: () => void }) {
  const [draftRegion, setDraftRegion] = useState(region.id);
  const [selectedRegion, setSelectedRegion] = useState(region.id);
  const currentRegion = useMemo(() => regions.find((item) => item.id === selectedRegion) ?? region, [selectedRegion]);
  const totalCourses = currentRegion.courses.reduce((sum, course) => sum + course.count, 0);
  return <>
    <form className="filter-bar" noValidate onSubmit={(event) => { event.preventDefault(); setSelectedRegion(draftRegion); }}>
      <label htmlFor="region">지역</label><select id="region" value={draftRegion} onChange={(event) => setDraftRegion(event.target.value)}>{regions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
      <label htmlFor="comparison-region">비교지역</label><select id="comparison-region" defaultValue="similar"><option value="similar">{currentRegion.comparisonLabel}</option></select>
      <button className="primary-button" type="submit">조회</button>
    </form>
    <div className="overview-grid">
      <Section title="주요지표"><DataTable label="주요지표 표" className="metrics-table"><thead><tr><th scope="col">지표명</th><th scope="col">값</th><th scope="col">판정</th><th scope="col">비고</th></tr></thead><tbody>{currentRegion.metrics.map((metric) => <tr key={metric.name}><th scope="row">{metric.name}</th><td className={metric.tone === "danger" ? "danger" : ""}>{metric.value}</td><td className={metric.tone === "danger" ? "danger" : ""}>{metric.judgment}</td><td>{metric.note}</td></tr>)}</tbody></DataTable></Section>
      <div id="population"><Section title="연령별 인구 구성"><DataTable label="연령별 인구 구성 표"><thead><tr><th scope="col">구분</th>{ageLabels.map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody><tr><th scope="row">{currentRegion.shortName}</th>{currentRegion.population.region.map((value, index) => <td className={index === 3 ? "danger" : ""} key={ageLabels[index]}>{value}%</td>)}</tr><tr><th scope="row">비교지역 평균</th>{currentRegion.population.comparison.map((value, index) => <td key={ageLabels[index]}>{value}%</td>)}</tr></tbody></DataTable><p className="table-note">※ 인구구조는 잠재 수요 참고용이며 종목 선호를 의미하지 않음</p></Section></div>
      <div id="courses"><Section title="종목별 강좌 현황" unit="(단위: 개, %)"><DataTable label="종목별 강좌 현황 표"><thead><tr><th scope="col">종목</th><th scope="col">강좌수</th><th scope="col">비중</th><th scope="col">비교지역 평균</th><th scope="col">차이</th></tr></thead><tbody>{currentRegion.courses.map((course) => { const difference = course.share - course.comparison; return <tr key={course.sport}><th scope="row">{course.sport}</th><td>{course.count}</td><td>{course.share.toFixed(1)}</td><td>{course.comparison.toFixed(1)}</td><td className={Math.abs(difference) >= 7 ? "danger" : ""}>{difference > 0 ? "+" : ""}{difference.toFixed(1)}</td></tr>; })}<tr className="total-row"><th scope="row">합계</th><td>{totalCourses}</td><td>100.0</td><td>100.0</td><td /></tr></tbody></DataTable></Section></div>
      <Section title="분석의견"><div className="analysis-box"><h3>현황 분석의견 <span>(자동분석)</span></h3><ol>{currentRegion.analysis.map((item) => <li key={item}>{item}</li>)}</ol></div></Section>
    </div>
    <div className="page-actions"><button type="button" className="secondary-button" onClick={() => downloadCsv(`${currentRegion.shortName}-체육공급현황.csv`, [["종목", "강좌수", "비중", "비교지역 평균"], ...currentRegion.courses.map((course) => [course.sport, course.count, course.share, course.comparison])])}>CSV 다운로드</button><button type="button" className="secondary-button" onClick={() => window.print()}>인쇄</button><button type="button" className="primary-button" onClick={onSimulation}>정책시뮬레이션</button></div>
  </>;
}

function Result({ scenario, onList, onCompare }: { scenario: Scenario; onList: () => void; onCompare: () => void }) {
  const net = Object.values(scenario.changes).reduce((sum, value) => sum + value, 0);
  const total = 84 + net;
  const visibleCourses = ["태권도", "수영", "배드민턴", "생활체조", "요가·필라테스"].map((sport) => region.courses.find((course) => course.sport === sport)!);
  return <>
    <div id="scenario-info"><Section title="시나리오 정보"><DataTable label="시나리오 정보 표" className="scenario-info-table"><tbody><tr><th scope="row">시나리오명</th><td>{scenario.name}</td><th scope="row">대상지역</th><td>{region.label}</td></tr><tr><th scope="row">조정내용</th><td>{changesLabel(scenario.changes)}</td><th scope="row">강좌 사용</th><td>{usedCourses(scenario.changes)} / {courseBudget}개 (잔여 {courseBudget - usedCourses(scenario.changes)})</td></tr></tbody></DataTable></Section></div>
    <div className="result-grid">
      <Section title="지표 비교"><DataTable label="시나리오 지표 비교 표" className="result-metrics-table"><thead><tr><th scope="col">지표명</th><th scope="col">현재</th><th scope="col">변경 후</th><th scope="col">증감</th><th scope="col">판정</th></tr></thead><tbody>{metricNames.map((name, index) => { const after = scenario.metrics?.[index]; const delta = after === undefined ? null : after - baselineMetrics[index]; const improved = delta !== null && (index === 2 ? delta < 0 : delta > 0); return <tr key={name}><th scope="row">{name}</th><td>{baselineMetrics[index]}</td><td><strong>{after ?? "—"}</strong></td><td className={delta === null ? "" : improved ? "positive" : delta === 0 ? "" : "danger"}>{delta === null ? "—" : signed(delta)}</td><td className={delta === null ? "" : improved ? "positive" : delta === 0 ? "" : "danger"}>{delta === null ? "계산 대기" : improved ? "개선" : delta === 0 ? "유지" : "악화"}</td></tr>; })}</tbody></DataTable></Section>
      <Section title="종목 구성 변화" unit="(단위: %)"><DataTable label="종목 구성 변화 표" className="result-course-table"><thead><tr><th scope="col">종목</th><th scope="col">현재 비중</th><th scope="col">변경 후</th><th scope="col">비교지역</th><th scope="col">비교</th></tr></thead><tbody>{visibleCourses.map((course: Course) => { const after = ((course.count + (scenario.changes[course.sport] ?? 0)) / total) * 100; const label = after < course.comparison - 3 ? "여전히 낮음" : after > course.comparison + 3 ? "여전히 높음" : Math.abs(after - course.comparison) <= 0.5 ? "유사 수준" : "-"; return <tr key={course.sport}><th scope="row">{course.sport}</th><td>{course.share.toFixed(1)}</td><td><strong>{after.toFixed(1)}</strong></td><td>{course.comparison.toFixed(1)}</td><td className={label.startsWith("여전히") ? "danger" : ""}>{label}</td></tr>; })}</tbody></DataTable></Section>
    </div>
    <div id="analysis"><Section title="분석의견"><div className="analysis-box result-analysis"><h3>시나리오 분석의견 <span>({scenario.metrics ? "목업 예시 분석" : "계산 대기"})</span></h3><ol>{scenario.analysis.map((item) => <li key={item}>{item}</li>)}</ol></div></Section></div>
    <div className="page-actions split-actions"><button type="button" className="secondary-button" onClick={onList}>목록</button><div><button type="button" className="secondary-button" disabled title="한글 파일 생성은 다음 개발 단계입니다">한글(HWP) 저장</button><button type="button" className="secondary-button" onClick={() => window.print()}>PDF 저장</button><button type="button" className="secondary-button" onClick={() => window.print()}>인쇄</button><button type="button" className="primary-button" onClick={onCompare}>정책안비교</button></div></div>
  </>;
}

function Section({ title, unit, children }: { title: string; unit?: string; children: React.ReactNode }) {
  return <section className="content-section"><div className="section-heading"><h2><span aria-hidden="true" />{title}</h2>{unit && <p>{unit}</p>}</div>{children}</section>;
}

function DataTable({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return <div className="table-scroll" role="region" aria-label={label} tabIndex={0}><table className={className}>{children}</table></div>;
}
