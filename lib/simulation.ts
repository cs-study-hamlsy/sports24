export type SportSupply = { sport: string; count: number; comparison: number };

/** 시연용 종목 구성만 비교한다. 수요·접근성·연령 적합도를 추정하지 않는다. */
export function calculateSupplyMetrics(courses: SportSupply[], changes: Record<string, number> = {}) {
  const counts = courses.map(({ sport, count }) => Math.max(0, count + (changes[sport] ?? 0)));
  const total = counts.reduce((sum, count) => sum + count, 0);
  const peerTotal = courses.reduce((sum, course) => sum + Math.max(0, course.comparison), 0);
  if (!total || !peerTotal || courses.length < 2) return [null, null, null, null, null] as const;

  const shares = counts.map((count) => count / total);
  const peerShares = courses.map((course) => Math.max(0, course.comparison) / peerTotal);
  const similarity = 100 * (1 - shares.reduce((sum, share, index) => sum + Math.abs(share - peerShares[index]), 0) / 2);
  const diversity = -100 * shares.reduce((sum, share) => sum + (share ? share * Math.log(share) : 0), 0) / Math.log(courses.length);
  const concentration = 100 * shares.reduce((sum, share) => sum + share * share, 0);

  // 연령별 실제 수요와 수강 대상이 없으므로 연령 적합도는 산출하지 않는다.
  return [Math.round(similarity), Math.round(diversity), Math.round(concentration), null, null] as const;
}

export function describeScenario(courses: SportSupply[], changes: Record<string, number>) {
  const before = calculateSupplyMetrics(courses);
  const after = calculateSupplyMetrics(courses, changes);
  const total = courses.reduce((sum, course) => sum + course.count, 0);
  const nextTotal = total + Object.values(changes).reduce((sum, value) => sum + value, 0);
  const leadingGap = nextTotal > 0 ? courses
    .map((course) => ({ sport: course.sport, gap: ((course.count + (changes[course.sport] ?? 0)) / nextTotal) * 100 - course.comparison }))
    .filter((item) => item.sport !== "기타")
    .sort((left, right) => left.gap - right.gap)[0] : undefined;

  return [
    `강좌 합계는 ${total}개에서 ${nextTotal}개로 바뀝니다.`,
    `종목 구성 유사도 ${before[0]} → ${after[0]}, 다양성 ${before[1]} → ${after[1]}, 편중도 ${before[2]} → ${after[2]} (낮을수록 분산).`,
    leadingGap ? `${leadingGap.sport} 비중은 시연 비교지역 평균보다 ${Math.abs(leadingGap.gap).toFixed(1)}%p ${leadingGap.gap < 0 ? "낮습니다" : "높습니다"}.` : "비교 가능한 종목이 없습니다.",
    "연령별 적합도는 수강 대상·실제 수요 자료가 없어 산출하지 않습니다.",
  ];
}
