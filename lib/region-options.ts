export type ProvinceRegion = {
  id: string;
  provinceId: string;
  provinceLabel: string;
};

const provinceDisplayOrder = ["seoul", "gyeonggi", "gangwon", "chungbuk"];

export function provinceOptions<T extends ProvinceRegion>(items: readonly T[]) {
  return Array.from(new Map(items.map((item) => [item.provinceId, { id: item.provinceId, label: item.provinceLabel }])).values())
    .sort((left, right) => {
      const leftIndex = provinceDisplayOrder.indexOf(left.id);
      const rightIndex = provinceDisplayOrder.indexOf(right.id);
      return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex);
    });
}

export function regionsForProvince<T extends ProvinceRegion>(items: readonly T[], provinceId: string) {
  return items.filter((item) => item.provinceId === provinceId);
}
