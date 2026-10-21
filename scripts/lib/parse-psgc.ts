/**
 * Parser for the PSA "PSGC Publication Datafile" workbook.
 * Converts the flat PSGC sheet into normalized, hierarchical records.
 *
 * PSGC 10-digit code structure: RR PPP MM BBB
 *   RR  = region, PPP = province (or HUC / special code), MM = city/municipality, BBB = barangay
 */
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import type {
  Barangay,
  CityMunicipality,
  Counts,
  Dataset,
  GeoLevel,
  Meta,
  Province,
  Region,
  SpecialArea,
  SubMunicipality,
} from "../../src/lib/types";

type Cell = string | number | null | undefined;

const LEVELS: GeoLevel[] = ["Reg", "Prov", "City", "Mun", "SubMun", "Bgy"];

/** Known geographic placement for cities whose code does not reveal it. */
const GEOGRAPHIC_PROVINCE_OVERRIDES: Record<string, string> = {
  // City of Isabela is administratively part of Region IX but located on Basilan island.
  "0990101000": "1900700000",
};

export interface ParseOptions {
  releaseName?: string;
  releaseDate?: string | null;
  referenceNo?: string | null;
  sourcePage?: string;
  sourceFile?: string;
  quarter?: number;
  year?: number;
}

export interface ParseResult {
  dataset: Dataset;
  warnings: string[];
}

function clean(v: Cell): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  if (s === "" || s === "#N/A" || s === "-") return null;
  return s;
}

/** Remove trailing footnote markers such as "City of Lucenaa/" -> "City of Lucena". */
function cleanName(v: Cell): string {
  const s = clean(v) ?? "";
  return s.replace(/\s*\d{1,2}\/$/, "").replace(/([a-z])[a-z]\/$/, "$1").trim();
}

function toCode(v: Cell, len: number): string | null {
  const s = clean(v);
  if (!s || !/^\d+$/.test(s)) return null;
  return s.padStart(len, "0");
}

function toNumber(v: Cell): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = clean(v);
  if (!s) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function headerIndex(header: Cell[], ...needles: string[]): number {
  const norm = header.map((h) => (h == null ? "" : String(h).toLowerCase().replace(/\s+/g, " ")));
  for (const n of needles) {
    const i = norm.findIndex((h) => h.includes(n));
    if (i >= 0) return i;
  }
  return -1;
}

function findMetadataValue(wb: XLSX.WorkBook, label: string): string | null {
  const ws = wb.Sheets["Metadata"];
  if (!ws) return null;
  const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: null });
  for (const r of rows) {
    if (clean(r[0])?.toLowerCase().startsWith(label.toLowerCase())) return clean(r[1]);
  }
  return null;
}

function readGeneralNotes(wb: XLSX.WorkBook): string[] {
  const ws = wb.Sheets["Notes"];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: null });
  const notes: string[] = [];
  let inGeneral = false;
  for (const r of rows) {
    const a = clean(r[0]);
    const b = clean(r[1]);
    if (a && /^A\.?$/.test(a)) { inGeneral = true; continue; }
    if (a && /^[B-Z]\.?$/.test(a)) break;
    if (inGeneral && b && /^\d+\./.test(b)) notes.push(b.replace(/^\d+\.\s*/, ""));
  }
  return notes;
}

function inferQuarterYear(fileName: string, asOf: string | null): { quarter: number; year: number } | null {
  const m = fileName.match(/(\d)Q[-_ ]?(\d{4})/i);
  if (m) return { quarter: Number(m[1]), year: Number(m[2]) };
  if (asOf) {
    const d = new Date(asOf);
    if (!Number.isNaN(d.getTime())) return { quarter: Math.floor(d.getMonth() / 3) + 1, year: d.getFullYear() };
  }
  return null;
}

export function parsePsgcWorkbook(filePath: string, opts: ParseOptions = {}): ParseResult {
  const warnings: string[] = [];
  const wb = XLSX.read(readFileSync(filePath), { type: "buffer" });

  // Locate the PSGC sheet: prefer one named "PSGC", else one whose header mentions "10-digit PSGC".
  let sheetName = wb.SheetNames.find((n) => n.trim().toUpperCase() === "PSGC");
  let rows: Cell[][] = [];
  let headerRow = -1;
  const candidates = sheetName ? [sheetName, ...wb.SheetNames] : wb.SheetNames;
  for (const name of candidates) {
    const r = XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[name], { header: 1, raw: true, defval: null });
    const idx = r.slice(0, 20).findIndex((row) => row.some((c) => typeof c === "string" && /10-?digit psgc/i.test(c)));
    if (idx >= 0) { sheetName = name; rows = r; headerRow = idx; break; }
  }
  if (headerRow < 0 || !sheetName) throw new Error("Could not find the PSGC sheet (no '10-digit PSGC' header) in " + filePath);

  const header = rows[headerRow];
  const col = {
    code: headerIndex(header, "10-digit psgc"),
    name: headerIndex(header, "name"),
    corr: headerIndex(header, "correspondence"),
    level: headerIndex(header, "geographic level"),
    oldNames: headerIndex(header, "old name"),
    cityClass: headerIndex(header, "city class"),
    income: headerIndex(header, "income"),
    urbanRural: headerIndex(header, "urban"),
    population: headerIndex(header, "population"),
    status: headerIndex(header, "status"),
  };
  for (const [k, v] of Object.entries(col)) {
    if (v < 0 && !["oldNames", "status", "urbanRural", "cityClass", "income"].includes(k)) {
      throw new Error(`Required column '${k}' not found in sheet ${sheetName}`);
    }
  }
  // An unlabeled column right after population holds remarks/footnotes (e.g. "(excluding CITY OF BAGUIO)").
  const remarksCol = col.population >= 0 && header[col.population + 1] == null ? col.population + 1 : -1;

  interface Raw {
    code: string; name: string; level: GeoLevel | null; corr: string | null; oldNames: string | null;
    cityClass: string | null; income: string | null; urbanRural: string | null; population: number | null;
    status: string | null; remarks: string | null;
  }
  const raws: Raw[] = [];
  const seen = new Set<string>();
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i];
    const code = toCode(r[col.code], 10);
    if (!code) continue; // footnotes / blank rows
    if (code.length !== 10) { warnings.push(`Row ${i + 1}: code ${code} is not 10 digits, skipped`); continue; }
    if (seen.has(code)) { warnings.push(`Duplicate code ${code} at row ${i + 1}, skipped`); continue; }
    seen.add(code);
    const lvl = clean(r[col.level]);
    const level = lvl && (LEVELS as string[]).includes(lvl) ? (lvl as GeoLevel) : null;
    if (lvl && !level) warnings.push(`Unknown geographic level '${lvl}' for ${code}`);
    raws.push({
      code,
      name: cleanName(r[col.name]),
      level,
      corr: toCode(r[col.corr], 9),
      oldNames: col.oldNames >= 0 ? clean(r[col.oldNames]) : null,
      cityClass: col.cityClass >= 0 ? clean(r[col.cityClass]) : null,
      income: col.income >= 0 ? clean(r[col.income]) : null,
      urbanRural: col.urbanRural >= 0 ? clean(r[col.urbanRural]) : null,
      population: toNumber(r[col.population]),
      status: col.status >= 0 ? clean(r[col.status]) : null,
      remarks: remarksCol >= 0 ? clean(r[remarksCol]) : null,
    });
  }

  const regionCodeOf = (c: string) => c.slice(0, 2) + "00000000";
  const provCodeOf = (c: string) => c.slice(0, 5) + "00000";
  const cmCodeOf = (c: string) => c.slice(0, 7) + "000";

  const regions: Region[] = [];
  const provinces: Province[] = [];
  const cms: CityMunicipality[] = [];
  const subs: SubMunicipality[] = [];
  const bgys: Barangay[] = [];
  const specialAreas: SpecialArea[] = [];

  const byCode = new Map(raws.map((r) => [r.code, r]));
  const provinceSet = new Set(raws.filter((r) => r.level === "Prov").map((r) => r.code));

  for (const r of raws) {
    switch (r.level) {
      case "Reg":
        regions.push({ code: r.code, name: r.name, correspondenceCode: r.corr, population: r.population,
          provinceCount: 0, cityCount: 0, municipalityCount: 0, subMunicipalityCount: 0, barangayCount: 0 });
        break;
      case "Prov":
        provinces.push({ code: r.code, name: r.name, regionCode: regionCodeOf(r.code), correspondenceCode: r.corr,
          oldNames: r.oldNames, incomeClass: r.income, population: r.population, remarks: r.remarks,
          cityCount: 0, municipalityCount: 0, barangayCount: 0 });
        break;
      case "City":
      case "Mun": {
        const p = provCodeOf(r.code);
        const provinceCode = provinceSet.has(p) ? p : null;
        let geographicProvinceCode: string | null = provinceCode;
        if (!provinceCode) {
          if (GEOGRAPHIC_PROVINCE_OVERRIDES[r.code]) geographicProvinceCode = GEOGRAPHIC_PROVINCE_OVERRIDES[r.code];
          else if (r.corr && r.code.slice(0, 2) !== "13") {
            // Old 9-digit correspondence code is RR PP MM BBB; map its province to the 10-digit form RR 0PP.
            const guess = r.code.slice(0, 2) + "0" + r.corr.slice(2, 4) + "00000";
            geographicProvinceCode = provinceSet.has(guess) ? guess : null;
          }
        }
        const pseudo = byCode.get(p);
        const specialAreaCode = !provinceCode && pseudo && pseudo.level === null ? p : null;
        let cityClass = r.level === "City" ? (r.cityClass as CityMunicipality["cityClass"]) : null;
        if (r.level === "City" && !["HUC", "ICC", "CC"].includes(String(cityClass))) {
          warnings.push(`City ${r.code} ${r.name} has unexpected city class '${r.cityClass}'`);
          cityClass = null;
        }
        cms.push({ code: r.code, name: r.name, type: r.level, cityClass, incomeClass: r.income,
          regionCode: regionCodeOf(r.code), provinceCode, geographicProvinceCode, specialAreaCode,
          isCapital: r.status === "Capital", correspondenceCode: r.corr, oldNames: r.oldNames,
          population: r.population, subMunicipalityCount: 0, barangayCount: 0 });
        break;
      }
      case "SubMun":
        subs.push({ code: r.code, name: r.name, cityMunicipalityCode: provCodeOf(r.code), regionCode: regionCodeOf(r.code),
          correspondenceCode: r.corr, population: r.population, barangayCount: 0 });
        break;
      case "Bgy":
        // filled in the second pass once parents are known
        break;
      default:
        specialAreas.push({ code: r.code, name: r.name, regionCode: regionCodeOf(r.code), correspondenceCode: r.corr,
          population: r.population,
          note: "Grouping row in the PSA file with no geographic level; it is not a province. Its cities/municipalities have provinceCode = null and specialAreaCode set to this code." });
        warnings.push(`Non-level grouping row kept as special area: ${r.code} ${r.name}`);
    }
  }

  const cmMap = new Map(cms.map((c) => [c.code, c]));
  const subMap = new Map(subs.map((s) => [s.code, s]));
  const provMap = new Map(provinces.map((p) => [p.code, p]));
  const regMap = new Map(regions.map((g) => [g.code, g]));

  for (const s of subs) {
    if (!cmMap.has(s.cityMunicipalityCode)) warnings.push(`SubMun ${s.code} has no parent city ${s.cityMunicipalityCode}`);
  }

  for (const r of raws) {
    if (r.level !== "Bgy") continue;
    const parent7 = cmCodeOf(r.code);
    let cm = cmMap.get(parent7);
    let sub: SubMunicipality | undefined;
    if (!cm) {
      sub = subMap.get(parent7);
      if (sub) cm = cmMap.get(sub.cityMunicipalityCode);
    }
    if (!cm) { warnings.push(`Barangay ${r.code} ${r.name} has no parent city/municipality, skipped`); continue; }
    bgys.push({ code: r.code, name: r.name, regionCode: cm.regionCode, provinceCode: cm.provinceCode,
      cityMunicipalityCode: cm.code, subMunicipalityCode: sub?.code ?? null,
      urbanRural: r.urbanRural === "U" || r.urbanRural === "R" ? r.urbanRural : null,
      isPoblacion: r.status === "Pob.", correspondenceCode: r.corr, oldNames: r.oldNames, population: r.population });
  }

  // Roll-up counts
  for (const p of provinces) {
    const g = regMap.get(p.regionCode);
    if (g) g.provinceCount++; else warnings.push(`Province ${p.code} has no region`);
  }
  for (const c of cms) {
    const g = regMap.get(c.regionCode);
    if (!g) { warnings.push(`City/Mun ${c.code} has no region`); continue; }
    if (c.type === "City") g.cityCount++; else g.municipalityCount++;
    if (c.provinceCode) {
      const p = provMap.get(c.provinceCode)!;
      if (c.type === "City") p.cityCount++; else p.municipalityCount++;
    }
  }
  for (const s of subs) {
    regMap.get(s.regionCode)!.subMunicipalityCount++;
    cmMap.get(s.cityMunicipalityCode)!.subMunicipalityCount++;
  }
  for (const b of bgys) {
    regMap.get(b.regionCode)!.barangayCount++;
    if (b.provinceCode) provMap.get(b.provinceCode)!.barangayCount++;
    cmMap.get(b.cityMunicipalityCode)!.barangayCount++;
    if (b.subMunicipalityCode) subMap.get(b.subMunicipalityCode)!.barangayCount++;
  }

  const counts: Counts = {
    regions: regions.length,
    provinces: provinces.length,
    cities: cms.filter((c) => c.type === "City").length,
    highlyUrbanizedCities: cms.filter((c) => c.cityClass === "HUC").length,
    independentComponentCities: cms.filter((c) => c.cityClass === "ICC").length,
    componentCities: cms.filter((c) => c.cityClass === "CC").length,
    municipalities: cms.filter((c) => c.type === "Mun").length,
    subMunicipalities: subs.length,
    barangays: bgys.length,
  };

  const asOf = findMetadataValue(wb, "Publication date");
  const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
  const qy = opts.quarter && opts.year ? { quarter: opts.quarter, year: opts.year } : inferQuarterYear(fileName, asOf);
  if (!qy) warnings.push("Could not infer quarter/year from file name; pass --quarter and --year");
  const quarter = qy?.quarter ?? 0;
  const year = qy?.year ?? 0;

  const meta: Meta = {
    version: `${year}-Q${quarter}`,
    quarter,
    year,
    releaseName: opts.releaseName ?? `PSGC ${["", "First", "Second", "Third", "Fourth"][quarter] ?? ""} Quarter ${year} Updates`.replace(/\s+/g, " "),
    releaseDate: opts.releaseDate ?? null,
    referenceNo: opts.referenceNo ?? null,
    asOf,
    sourcePage: opts.sourcePage ?? "https://psa.gov.ph/classification/psgc",
    sourceFile: opts.sourceFile ?? `https://psa.gov.ph/system/files/scd/${fileName}`,
    sourceFileName: fileName,
    counts,
    importedAt: new Date().toISOString(),
    attribution: "Source: Philippine Statistics Authority (PSA), Philippine Standard Geographic Code (PSGC).",
    notes: readGeneralNotes(wb),
  };

  const byCodeSort = <T extends { code: string }>(a: T, b: T) => a.code.localeCompare(b.code);
  return {
    dataset: {
      meta,
      regions: regions.sort(byCodeSort),
      provinces: provinces.sort(byCodeSort),
      citiesMunicipalities: cms.sort(byCodeSort),
      subMunicipalities: subs.sort(byCodeSort),
      barangays: bgys.sort(byCodeSort),
      specialAreas: specialAreas.sort(byCodeSort),
    },
    warnings,
  };
}

export interface SummaryRow { provinces: number; cities: number; municipalities: number; barangays: number; population: number | null }

/** Reads PSA's own "National Summary" sheet in the same workbook, used to cross-check parsed counts. */
export function readNationalSummary(filePath: string): { national: SummaryRow; regions: Record<string, SummaryRow & { name: string }> } | null {
  const wb = XLSX.read(readFileSync(filePath), { type: "buffer" });
  const name = wb.SheetNames.find((n) => /national summary/i.test(n));
  if (!name) return null;
  const rows = XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[name], { header: 1, raw: true, defval: null });
  const hi = rows.findIndex((r) => r.some((c) => clean(c)?.toUpperCase() === "REGION"));
  if (hi < 0) return null;
  const h = rows[hi];
  const idx = (re: RegExp) => h.findIndex((c) => re.test(String(c ?? "")));
  const ci = { name: idx(/^REGION$/i), prov: idx(/PROV/i), city: idx(/CIT/i), mun: idx(/MUN/i), bgy: idx(/BGY|BARANGAY/i), pop: idx(/POPULATION/i) };
  const row = (r: Cell[]): SummaryRow => ({
    provinces: toNumber(r[ci.prov]) ?? 0, cities: toNumber(r[ci.city]) ?? 0,
    municipalities: toNumber(r[ci.mun]) ?? 0, barangays: toNumber(r[ci.bgy]) ?? 0, population: toNumber(r[ci.pop]),
  });
  let national: SummaryRow | null = null;
  const regions: Record<string, SummaryRow & { name: string }> = {};
  for (const r of rows.slice(hi + 1)) {
    const nm = clean(r[ci.name]);
    if (!nm) continue;
    if (/^PHILIPPINES$/i.test(nm)) { national = row(r); continue; }
    const code = toCode(r[0], 10);
    if (code) regions[code] = { name: nm, ...row(r) };
  }
  return national ? { national, regions } : null;
}
