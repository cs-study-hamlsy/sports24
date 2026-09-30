import administrativeRegions from "../data/administrative-regions.json";
import { regions } from "./regions";

// 2026-09-30 행정구역 목록. 수치가 준비된 지역만 기존 시뮬레이션 ID로 연결한다.
const availableByLocation = new Map(regions.map((region) => [`${region.provinceLabel}:${region.shortName}`, region.id]));

export const catalogProvinces = administrativeRegions.provinces.map((province) => ({
  id: province.code,
  name: province.name,
  regions: province.regions.map((item) => {
    const availableId = availableByLocation.get(`${province.name}:${item.name}`);
    return {
      id: availableId ?? `admin-${item.code}`,
      name: item.name,
      provinceId: province.code,
      provinceName: province.name,
      available: Boolean(availableId),
    };
  }),
}));

export type CatalogRegion = (typeof catalogProvinces)[number]["regions"][number];

export function catalogRegionById(id: string): CatalogRegion | undefined {
  return catalogProvinces.flatMap((province) => province.regions).find((region) => region.id === id);
}

export function firstRegionForProvince(provinceId: string): CatalogRegion | undefined {
  return catalogProvinces.find((province) => province.id === provinceId)?.regions[0];
}
