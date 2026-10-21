import type { Barangay, CityMunicipality, Dataset, Province, Region, SpecialArea, SubMunicipality } from "../types";

export type AreaLevel = "region" | "province" | "city" | "municipality" | "sub-municipality" | "barangay" | "special-area";
export const LEVELS: AreaLevel[] = ["region", "province", "city", "municipality", "sub-municipality", "barangay", "special-area"];

/** One row in the `areas` / `staged_areas` tables. */
export interface AreaRow {
  code: string;
  level: AreaLevel;
  name: string;
  name_norm: string;
  region_code: string | null;
  province_code: string | null;
  city_municipality_code: string | null;
  sub_municipality_code: string | null;
  data: Region | Province | CityMunicipality | SubMunicipality | Barangay | SpecialArea;
}

export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function datasetToRows(ds: Dataset): AreaRow[] {
  const rows: AreaRow[] = [];
  const base = (code: string, name: string, level: AreaLevel) => ({ code, name, level, name_norm: normalize(name) });
  for (const r of ds.regions) rows.push({ ...base(r.code, r.name, "region"), region_code: null, province_code: null, city_municipality_code: null, sub_municipality_code: null, data: r });
  for (const p of ds.provinces) rows.push({ ...base(p.code, p.name, "province"), region_code: p.regionCode, province_code: null, city_municipality_code: null, sub_municipality_code: null, data: p });
  for (const c of ds.citiesMunicipalities) rows.push({ ...base(c.code, c.name, c.type === "City" ? "city" : "municipality"), region_code: c.regionCode, province_code: c.provinceCode, city_municipality_code: null, sub_municipality_code: null, data: c });
  for (const s of ds.subMunicipalities) rows.push({ ...base(s.code, s.name, "sub-municipality"), region_code: s.regionCode, province_code: null, city_municipality_code: s.cityMunicipalityCode, sub_municipality_code: null, data: s });
  for (const b of ds.barangays) rows.push({ ...base(b.code, b.name, "barangay"), region_code: b.regionCode, province_code: b.provinceCode, city_municipality_code: b.cityMunicipalityCode, sub_municipality_code: b.subMunicipalityCode, data: b });
  for (const a of ds.specialAreas) rows.push({ ...base(a.code, a.name, "special-area"), region_code: a.regionCode, province_code: null, city_municipality_code: null, sub_municipality_code: null, data: a });
  return rows;
}

/** Immediate parent code of a row (sub-municipality > city/municipality > province > region). */
export function parentOf(r: Pick<AreaRow, "level" | "region_code" | "province_code" | "city_municipality_code" | "sub_municipality_code">): string | null {
  if (r.level === "region") return null;
  return r.sub_municipality_code ?? r.city_municipality_code ?? r.province_code ?? r.region_code;
}

/** Attributes compared by the diff besides name and parent. */
export function attributesOf(level: AreaLevel, data: Record<string, unknown>): string {
  if (level === "city" || level === "municipality") return `class=${data.cityClass ?? "-"};income=${data.incomeClass ?? "-"}`;
  if (level === "province") return `income=${data.incomeClass ?? "-"}`;
  return "";
}
