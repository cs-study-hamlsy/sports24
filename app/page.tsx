"use client";

import { FormEvent, useMemo, useState } from "react";
import regions from "../data/regions.json";

type Tone = "normal" | "danger";

type Region = {
  id: string;
  label: string;
  shortName: string;
  comparisonLabel: string;
  metrics: Array<{ name: string; value: number; judgment: string; note: string; tone: Tone }>;
  population: { region: number[]; comparison: number[] };
  courses: Array<{ sport: string; count: number; share: number; comparison: number }>;
  analysis: string[];
};

const regionData = regions as Region[];
const ageLabels = ["청소년", "청년", "중장년", "고령(65세 이상)"];

export default function Home() {
  const [fontScale, setFontScale] = useState(1);
  const [draftRegion, setDraftRegion] = useState(regionData[0].id);
  const [selectedRegion, setSelectedRegion] = useState(regionData[0].id);

  const region = useMemo(
    () => regionData.find((item) => item.id === selectedRegion) ?? regionData[0],
    [selectedRegion],
  );

  const totalCourses = region.courses.reduce((sum, course) => sum + course.count, 0);

  function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSelectedRegion(draftRegion);
  }

  function downloadCsv() {
    const rows = [
      ["종목", "강좌수", "비중", "비교지역 평균"],
      ...region.courses.map((course) => [course.sport, course.count, course.share, course.comparison]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.join(",")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${region.shortName}-체육공급현황.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <div className="app-shell" style={{ "--font-scale": fontScale } as React.CSSProperties}>
      <header>
        <div className="utility-bar">
          <span>체육진흥과 담당자 님</span>
          <span className="utility-divider" aria-hidden="true" />
          <span>글자크기</span>
          <button
            type="button"
            className="font-control"
            onClick={() => setFontScale((value) => Math.min(1.12, value + 0.06))}
            aria-label="글자 크게"
          >
            +
          </button>
          <button
            type="button"
            className="font-control"
            onClick={() => setFontScale((value) => Math.max(0.94, value - 0.06))}
            aria-label="글자 작게"
          >
            −
          </button>
        </div>
        <div className="brand-row">
          <span className="brand-mark" aria-hidden="true">S</span>
          <strong>SPORTS24</strong>
          <span>체육정책 시뮬레이션 시스템</span>
        </div>
        <nav className="global-nav" aria-label="주 메뉴">
          <a href="#main" aria-current="page">지역현황</a>
          <span aria-disabled="true" title="후속 구현 예정">정책시뮬레이션</span>
          <span aria-disabled="true" title="후속 구현 예정">결과조회</span>
          <span aria-disabled="true" title="후속 구현 예정">정책안비교</span>
        </nav>
      </header>

      <div className="workspace">
        <aside className="side-panel" aria-label="지역현황 메뉴">
          <section className="side-menu">
            <h2>지역현황</h2>
            <a className="selected" href="#main" aria-current="page">· 체육공급 현황</a>
            <span>· 종목별 강좌</span>
            <span>· 연령별 인구</span>
            <span>· 유사지역 비교</span>
          </section>
          <section className="source-box">
            <h2>자료 출처</h2>
            <p>스포츠강좌이용권 등록강좌</p>
            <p>전국 체육시설 현황</p>
            <p>주민등록 연령별 인구</p>
          </section>
        </aside>

        <main id="main">
          <div className="page-heading">
            <h1><span aria-hidden="true" />체육공급 현황</h1>
            <nav aria-label="현재 위치">HOME <b aria-hidden="true">›</b> 지역현황 <b aria-hidden="true">›</b> <strong>체육공급 현황</strong></nav>
          </div>

          <form className="filter-bar" onSubmit={handleLookup} noValidate>
            <label htmlFor="region">지역</label>
            <select id="region" value={draftRegion} onChange={(event) => setDraftRegion(event.target.value)}>
              {regionData.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <label htmlFor="comparison">비교지역</label>
            <select id="comparison" defaultValue="similar">
              <option value="similar">{region.comparisonLabel}</option>
            </select>
            <button className="primary-button" type="submit">조회</button>
          </form>

          <div className="overview-grid">
            <Section title="주요지표">
              <DataTable label="주요지표 표" className="metrics-table">
                <thead><tr><th scope="col">지표명</th><th scope="col">값</th><th scope="col">판정</th><th scope="col">비고</th></tr></thead>
                <tbody>
                  {region.metrics.map((metric) => (
                    <tr key={metric.name}>
                      <th scope="row">{metric.name}</th>
                      <td className={metric.tone === "danger" ? "danger" : ""}>{metric.value}</td>
                      <td className={metric.tone === "danger" ? "danger" : ""}>{metric.judgment}</td>
                      <td>{metric.note}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </Section>

            <Section title="연령별 인구 구성">
              <DataTable label="연령별 인구 구성 표">
                <thead><tr><th scope="col">구분</th>{ageLabels.map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
                <tbody>
                  <tr><th scope="row">{region.shortName}</th>{region.population.region.map((value, index) => <td className={index === 3 ? "danger" : ""} key={ageLabels[index]}>{value}%</td>)}</tr>
                  <tr><th scope="row">비교지역 평균</th>{region.population.comparison.map((value, index) => <td key={ageLabels[index]}>{value}%</td>)}</tr>
                </tbody>
              </DataTable>
              <p className="table-note">※ 인구구조는 잠재 수요 참고용이며 종목 선호를 의미하지 않음</p>
            </Section>

            <Section title="종목별 강좌 현황" unit="(단위: 개, %)">
              <DataTable label="종목별 강좌 현황 표">
                <thead><tr><th scope="col">종목</th><th scope="col">강좌수</th><th scope="col">비중</th><th scope="col">비교지역 평균</th><th scope="col">차이</th></tr></thead>
                <tbody>
                  {region.courses.map((course) => {
                    const difference = Number((course.share - course.comparison).toFixed(1));
                    return (
                      <tr key={course.sport}>
                        <th scope="row">{course.sport}</th>
                        <td>{course.count}</td><td>{course.share.toFixed(1)}</td><td>{course.comparison.toFixed(1)}</td>
                        <td className={Math.abs(difference) >= 7 ? "danger" : ""}>{difference > 0 ? "+" : ""}{difference.toFixed(1)}</td>
                      </tr>
                    );
                  })}
                  <tr className="total-row"><th scope="row">합계</th><td>{totalCourses}</td><td>100.0</td><td>100.0</td><td /></tr>
                </tbody>
              </DataTable>
            </Section>

            <Section title="분석의견">
              <div className="analysis-box">
                <h3>현황 분석의견 <span>(자동분석)</span></h3>
                <ol>{region.analysis.map((item) => <li key={item}>{item}</li>)}</ol>
              </div>
            </Section>
          </div>

          <div className="page-actions">
            <button type="button" className="secondary-button" onClick={downloadCsv}>CSV 다운로드</button>
            <button type="button" className="secondary-button" onClick={() => window.print()}>인쇄</button>
            <button type="button" className="primary-button" disabled title="Policy Sandbox 구현 후 사용할 수 있습니다">정책시뮬레이션</button>
          </div>
        </main>
      </div>
    </div>
  );
}

function Section({ title, unit, children }: { title: string; unit?: string; children: React.ReactNode }) {
  return (
    <section className="content-section">
      <div className="section-heading"><h2><span aria-hidden="true" />{title}</h2>{unit && <p>{unit}</p>}</div>
      {children}
    </section>
  );
}

function DataTable({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return <div className="table-scroll" role="region" aria-label={label} tabIndex={0}><table className={className}>{children}</table></div>;
}
