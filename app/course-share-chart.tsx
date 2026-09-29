import type { Region } from "../lib/regions";

type Props = { courses: Region["courses"]; changes?: Record<string, number> };

/** 종목 비중을 빠르게 비교하는 보조 시각화. 정확한 값은 바로 아래 표에도 제공한다. */
export function CourseShareChart({ courses, changes }: Props) {
  const afterTotal = courses.reduce((sum, course) => sum + Math.max(0, course.count + (changes?.[course.sport] ?? 0)), 0);
  const rows = courses.map((course) => ({
    sport: course.sport,
    current: course.share,
    after: afterTotal ? Math.max(0, course.count + (changes?.[course.sport] ?? 0)) / afterTotal * 100 : 0,
    peer: course.comparison,
  }));
  const max = Math.max(40, Math.ceil(Math.max(...rows.flatMap((row) => [row.current, row.after, row.peer])) / 10) * 10);
  const series = changes
    ? [{ key: "current", label: "현재", className: "current" }, { key: "after", label: "변경 후", className: "after" }, { key: "peer", label: "유사지역 평균", className: "peer" }] as const
    : [{ key: "current", label: "선택 지역", className: "current" }, { key: "peer", label: "유사지역 평균", className: "peer" }] as const;

  return <figure className="course-share-chart" aria-label="종목별 강좌 비중 비교 그래프">
    <figcaption>종목별 비중 비교 <small>강좌 수는 시연값 · 단위 %</small></figcaption>
    <div className="course-chart-legend">{series.map((item) => <span key={item.key}><i className={`chart-swatch ${item.className}`} aria-hidden="true" />{item.label}</span>)}</div>
    <div className="course-chart-rows">{rows.map((row) => <div className="course-chart-row" key={row.sport}>
      <strong>{row.sport}</strong>
      <div className="course-chart-series">{series.map((item) => <div className="course-chart-line" key={item.key}>
        <span className="course-chart-track"><span className={`course-chart-bar ${item.className}`} style={{ width: `${row[item.key] / max * 100}%` }} /></span>
        <span className="course-chart-value">{row[item.key].toFixed(1)}%</span>
      </div>)}</div>
    </div>)}</div>
    <p className="course-chart-scale">같은 눈금으로 비교 · 0–{max}%</p>
  </figure>;
}
