/** Content for the /docs page (kept in one place so examples stay consistent). */

export interface Param { name: string; in: "path" | "query"; desc: string }
export interface Endpoint { method: "GET"; path: string; summary: string; params?: Param[]; example: string; response: string }

const page: Param[] = [
  { name: "page", in: "query", desc: "Page number, starting at 1 (default 1)." },
];

export const ENDPOINTS: Endpoint[] = [
  {
    method: "GET", path: "/api/v1/meta", summary: "Current release: version, PSA release name/date, counts, when it went live. Poll this to detect quarterly updates.",
    example: "/api/v1/meta",
    response: `{
  "data": {
    "version": "2026-Q3",
    "releaseId": "2026-Q3-20261021T071052Z",
    "releaseName": "Third Quarter 2026 PSGC Updates: Correction of the Name of One Barangay",
    "releaseDate": "2026-10-12",
    "referenceNo": "2026-331",
    "asOf": "30 September 2026",
    "sourceFile": "https://psa.gov.ph/system/files/scd/PSGC-3Q-2026-Publication-Datafile.xlsx",
    "counts": { "regions": 18, "provinces": 82, "cities": 149, "highlyUrbanizedCities": 33,
                "independentComponentCities": 5, "componentCities": 111, "municipalities": 1493,
                "subMunicipalities": 14, "barangays": 42010 },
    "totalsMatch": true,
    "promotedAt": "2026-10-21T07:10:54.404Z",
    "...": "importedAt, notes, attribution, psaPublishedTotals"
  }
}`,
  },
  {
    method: "GET", path: "/api/v1/regions", summary: "All 18 regions with roll-up counts.", params: [...page, { name: "limit", in: "query", desc: "1-100 (default 100)." }],
    example: "/api/v1/regions?limit=1",
    response: `{
  "data": [{ "code": "0100000000", "name": "Region I (Ilocos Region)", "correspondenceCode": "010000000",
             "population": 5342453, "provinceCount": 4, "cityCount": 9, "municipalityCount": 116,
             "subMunicipalityCount": 0, "barangayCount": 3267 }],
  "meta": { "total": 18, "page": 1, "limit": 1, "totalPages": 18, "hasNextPage": true }
}`,
  },
  { method: "GET", path: "/api/v1/regions/{code}", summary: "One region.", params: [{ name: "code", in: "path", desc: "10-digit region code, e.g. 1300000000 (NCR)." }],
    example: "/api/v1/regions/1300000000", response: `{ "data": { "code": "1300000000", "name": "National Capital Region (NCR)", "provinceCount": 0, "cityCount": 16, "municipalityCount": 1, "barangayCount": 1715, "...": "..." } }` },
  { method: "GET", path: "/api/v1/regions/{code}/provinces", summary: "Provinces in a region. NCR returns an empty list (it has no provinces).", params: [{ name: "code", in: "path", desc: "Region code." }],
    example: "/api/v1/regions/1400000000/provinces", response: `{ "data": [{ "code": "1400100000", "name": "Abra", "regionCode": "1400000000", "incomeClass": "1st", "population": 246948, "cityCount": 0, "municipalityCount": 27, "barangayCount": 303, "...": "..." }], "meta": { "total": 6, "page": 1, "limit": 100, "totalPages": 1, "hasNextPage": false, "regionCode": "1400000000" } }` },
  { method: "GET", path: "/api/v1/regions/{code}/cities-municipalities", summary: "Cities/municipalities in a region. Use province=none for LGUs outside any province (HUCs, NCR, City of Isabela, BARMM Special Geographic Area).",
    params: [{ name: "code", in: "path", desc: "Region code." }, { name: "province", in: "query", desc: "Province code, or none." }],
    example: "/api/v1/regions/0700000000/cities-municipalities?province=none", response: `{ "data": [{ "code": "0730600000", "name": "City of Cebu", "type": "City", "cityClass": "HUC", "provinceCode": null, "geographicProvinceCode": "0702200000", "...": "..." }, "..."], "meta": { "total": 3, "...": "..." } }` },
  { method: "GET", path: "/api/v1/provinces", summary: "All 82 provinces.", params: [{ name: "region", in: "query", desc: "Filter by region code." }, ...page, { name: "limit", in: "query", desc: "1-100 (default 100)." }],
    example: "/api/v1/provinces?region=1400000000", response: `{ "data": [{ "code": "1400100000", "name": "Abra", "...": "..." }], "meta": { "total": 6, "...": "..." } }` },
  { method: "GET", path: "/api/v1/provinces/{code}", summary: "One province.", params: [{ name: "code", in: "path", desc: "10-digit province code." }],
    example: "/api/v1/provinces/0102800000", response: `{ "data": { "code": "0102800000", "name": "Ilocos Norte", "regionCode": "0100000000", "...": "..." } }` },
  { method: "GET", path: "/api/v1/provinces/{code}/cities-municipalities", summary: "Component cities and municipalities of a province (HUCs are independent and are not listed under a province).",
    params: [{ name: "code", in: "path", desc: "Province code." }, ...page, { name: "limit", in: "query", desc: "1-500 (default 500)." }],
    example: "/api/v1/provinces/0102800000/cities-municipalities", response: `{ "data": [{ "code": "0102801000", "name": "Adams", "type": "Mun", "...": "..." }, "..."], "meta": { "total": 23, "...": "..." } }` },
  {
    method: "GET", path: "/api/v1/cities-municipalities", summary: "All 1,642 cities and municipalities, filterable.",
    params: [{ name: "region", in: "query", desc: "Region code." }, { name: "province", in: "query", desc: "Province code, or none." },
      { name: "type", in: "query", desc: "city, municipality, huc, icc or cc." }, { name: "name", in: "query", desc: "Name contains (accent-insensitive)." },
      ...page, { name: "limit", in: "query", desc: "1-2000 (default 2000)." }],
    example: "/api/v1/cities-municipalities?province=0102800000&type=city",
    response: `{
  "data": [{
    "code": "0102812000", "name": "City of Laoag", "type": "City", "cityClass": "CC", "incomeClass": "3rd",
    "regionCode": "0100000000", "provinceCode": "0102800000", "geographicProvinceCode": "0102800000",
    "specialAreaCode": null, "isCapital": true, "correspondenceCode": "012812000", "oldNames": null,
    "population": 112117, "subMunicipalityCount": 0, "barangayCount": 80
  }, "..."],
  "meta": { "total": 2, "page": 1, "limit": 2000, "totalPages": 1, "hasNextPage": false }
}`,
  },
  { method: "GET", path: "/api/v1/cities-municipalities/{code}", summary: "One city or municipality.", params: [{ name: "code", in: "path", desc: "10-digit code." }],
    example: "/api/v1/cities-municipalities/1381300000", response: `{ "data": { "code": "1381300000", "name": "Quezon City", "type": "City", "cityClass": "HUC", "...": "..." } }` },
  { method: "GET", path: "/api/v1/cities-municipalities/{code}/barangays", summary: "Barangays of a city/municipality. Limit up to 1000 so even Manila (897) fits in one call.",
    params: [{ name: "code", in: "path", desc: "City/municipality code." }, { name: "subMunicipality", in: "query", desc: "Manila only: filter by sub-municipality code." }, ...page, { name: "limit", in: "query", desc: "1-1000 (default 1000)." }],
    example: "/api/v1/cities-municipalities/0102812000/barangays", response: `{ "data": [{ "code": "0102812001", "name": "Bgy. No. 1, San Lorenzo (Pob.)", "urbanRural": "U", "isPoblacion": true, "population": 1250, "...": "..." }, "..."], "meta": { "total": 80, "...": "..." } }` },
  { method: "GET", path: "/api/v1/cities-municipalities/{code}/sub-municipalities", summary: "Sub-municipalities (districts) of the City of Manila.", params: [{ name: "code", in: "path", desc: "1380600000 (Manila)." }],
    example: "/api/v1/cities-municipalities/1380600000/sub-municipalities", response: `{ "data": [{ "code": "1380601000", "name": "Tondo I/II", "cityMunicipalityCode": "1380600000", "population": 637942, "barangayCount": 259 }, "..."], "meta": { "total": 14, "...": "..." } }` },
  {
    method: "GET", path: "/api/v1/barangays", summary: "All 42,010 barangays, filterable and paginated.",
    params: [{ name: "region", in: "query", desc: "Region code." }, { name: "province", in: "query", desc: "Province code, or none." },
      { name: "cityMunicipality", in: "query", desc: "City/municipality code (alias: city)." }, { name: "subMunicipality", in: "query", desc: "Sub-municipality code." },
      { name: "urbanRural", in: "query", desc: "U or R (2024 CPH)." }, { name: "name", in: "query", desc: "Name contains." },
      ...page, { name: "limit", in: "query", desc: "1-500 (default 100)." }],
    example: "/api/v1/barangays?cityMunicipality=1380600000&limit=1&page=3",
    response: `{
  "data": [{
    "code": "1380601003", "name": "Barangay 3", "regionCode": "1300000000", "provinceCode": null,
    "cityMunicipalityCode": "1380600000", "subMunicipalityCode": "1380601000", "urbanRural": "U",
    "isPoblacion": false, "correspondenceCode": "133901003", "oldNames": null, "population": 1232
  }],
  "meta": { "total": 897, "page": 3, "limit": 1, "totalPages": 897, "hasNextPage": true }
}`,
  },
  { method: "GET", path: "/api/v1/barangays/{code}", summary: "One barangay.", params: [{ name: "code", in: "path", desc: "10-digit barangay code." }],
    example: "/api/v1/barangays/0301413033", response: `{ "data": { "code": "0301413033", "name": "Friendship Village Resources", "oldNames": "FVR", "urbanRural": "U", "population": 14296, "...": "..." } }` },
  {
    method: "GET", path: "/api/v1/search", summary: "Name search across all levels (accent-insensitive; exact and prefix matches rank first, then higher levels).",
    params: [{ name: "q", in: "query", desc: "Search text, 2-100 characters (required)." }, { name: "level", in: "query", desc: "Comma list: region, province, city, municipality, sub-municipality, barangay." },
      { name: "region", in: "query", desc: "Restrict to a region." }, { name: "province", in: "query", desc: "Restrict to a province." }, { name: "limit", in: "query", desc: "1-100 (default 20)." }],
    example: "/api/v1/search?q=batasan&limit=1",
    response: `{
  "data": [{
    "code": "0305403003", "name": "Batasan", "level": "barangay",
    "fullName": "Batasan, Arayat, Pampanga, Region III (Central Luzon)",
    "ancestry": {
      "region": { "code": "0300000000", "name": "Region III (Central Luzon)" },
      "province": { "code": "0305400000", "name": "Pampanga" },
      "cityMunicipality": { "code": "0305403000", "name": "Arayat", "type": "Mun", "cityClass": null },
      "subMunicipality": null
    }
  }],
  "meta": { "query": "batasan", "total": 8, "limit": 1, "returned": 1 }
}`,
  },
  {
    method: "GET", path: "/api/v1/codes/{code}", summary: "Look up any code (any level) with its full ancestry. Also accepts the older 9-digit correspondence code.",
    params: [{ name: "code", in: "path", desc: "10-digit PSGC code or 9-digit correspondence code." }],
    example: "/api/v1/codes/1380100001",
    response: `{
  "data": {
    "code": "1380100001", "name": "Barangay 1", "regionCode": "1300000000", "provinceCode": null,
    "cityMunicipalityCode": "1380100000", "subMunicipalityCode": null, "urbanRural": "U",
    "isPoblacion": false, "correspondenceCode": "137501001", "oldNames": null, "population": 2356,
    "level": "barangay"
  },
  "ancestry": {
    "region": { "code": "1300000000", "name": "National Capital Region (NCR)" },
    "province": null,
    "cityMunicipality": { "code": "1380100000", "name": "City of Caloocan", "type": "City", "cityClass": "HUC" },
    "subMunicipality": null
  },
  "fullName": "Barangay 1, City of Caloocan, National Capital Region (NCR)"
}`,
  },
];

export const ERROR_EXAMPLE = `HTTP/1.1 400 Bad Request
{ "error": { "status": 400, "code": "BAD_REQUEST", "message": "limit must be an integer between 1 and 500." } }

HTTP/1.1 404 Not Found
{ "error": { "status": 404, "code": "NOT_FOUND", "message": "Barangay 1380100003 not found." } }`;

export const FLOW_MERMAID = `flowchart TD
  PSA["psa.gov.ph PSGC page"] -->|"weekly check (browser updater; GitHub Action as backup)"| FILE["New Publication Datafile (.xlsx)"]
  FILE --> STAGE["npm run stage -- file.xlsx<br/>parse + verify vs PSA National Summary<br/>writes STAGING database only"]
  STAGE --> GUARDS{"Sanity guards<br/>count drop > 1%, malformed codes,<br/>truncated file, totals mismatch"}
  GUARDS --> DIFF["npm run diff<br/>staging vs main<br/>changes/*.md + *.json + signed review URL"]
  DIFF --> EMAIL["Email to owner<br/>change summary + review link"]
  EMAIL --> REVIEW["/admin/review<br/>signed HMAC link or ADMIN_SECRET"]
  REVIEW -->|Approve| PROMOTE["Promote in ONE transaction on MAIN<br/>main -> previous snapshot, staging -> main, audit row"]
  REVIEW -->|Reject| DISCARD["Discard staged release"]
  PROMOTE --> API["Public API /api/v1/*<br/>reads MAIN only"]
  PROMOTE -.->|"npm run rollback"| PREV[("Previous snapshot")]
  PREV -.-> API`;

export const snippets = (base: string) => ({
  js: `// JavaScript (browser or Node 18+)
const BASE = "${base}";

const res = await fetch(\`\${BASE}/api/v1/codes/1380100001\`);
if (!res.ok) throw new Error((await res.json()).error.message);
const { data, ancestry, fullName } = await res.json();
console.log(fullName); // "Barangay 1, City of Caloocan, National Capital Region (NCR)"

// Paginate through all barangays of a province
let page = 1, all = [];
while (true) {
  const r = await fetch(\`\${BASE}/api/v1/barangays?province=0102800000&limit=500&page=\${page}\`).then(r => r.json());
  all.push(...r.data);
  if (!r.meta.hasNextPage) break;
  page++;
}`,
  python: `# Python (pip install requests)
import requests

BASE = "${base}"

r = requests.get(f"{BASE}/api/v1/search", params={"q": "batasan hills", "limit": 5}, timeout=10)
r.raise_for_status()
for hit in r.json()["data"]:
    print(hit["code"], hit["level"], hit["fullName"])

provinces = requests.get(f"{BASE}/api/v1/regions/0100000000/provinces", timeout=10).json()["data"]
print([p["name"] for p in provinces])`,
  curl: `# cURL
curl -s "${base}/api/v1/meta"
curl -s "${base}/api/v1/regions"
curl -s "${base}/api/v1/cities-municipalities?province=0102800000&type=city"
curl -s "${base}/api/v1/barangays?cityMunicipality=1381300000&limit=500"
curl -s "${base}/api/v1/search?q=cebu&level=city,province"
curl -s "${base}/api/v1/codes/1380100001"`,
  env: `# .env.local in YOUR app
NEXT_PUBLIC_PSGC_API_BASE_URL=${base}`,
  react: `"use client";
// Cascading address picker: Region -> Province -> City/Municipality -> Barangay.
// Stores PSGC CODES (stable), shows names (which PSA can correct).
import { useEffect, useState } from "react";

const BASE = process.env.NEXT_PUBLIC_PSGC_API_BASE_URL;
type Opt = { code: string; name: string };
const get = (path: string): Promise<Opt[]> => fetch(BASE + path).then((r) => r.json()).then((j) => j.data);

export function AddressPicker({ onChange }: { onChange: (v: Record<string, string | null>) => void }) {
  const [regions, setRegions] = useState<Opt[]>([]);
  const [provinces, setProvinces] = useState<Opt[]>([]);
  const [cities, setCities] = useState<Opt[]>([]);
  const [barangays, setBarangays] = useState<Opt[]>([]);
  const [independent, setIndependent] = useState<Opt[]>([]);
  const [v, setV] = useState({ region: "", province: "", city: "", barangay: "" });

  useEffect(() => { get("/api/v1/regions").then(setRegions); }, []);

  async function pickRegion(region: string) {
    setV({ region, province: "", city: "", barangay: "" }); setCities([]); setBarangays([]);
    const [p, independent] = await Promise.all([
      get(\`/api/v1/regions/\${region}/provinces\`),
      // HUCs / NCR cities / special areas are not under a province:
      get(\`/api/v1/regions/\${region}/cities-municipalities?province=none\`),
    ]);
    setProvinces(p);
    setIndependent(independent);
    setCities(p.length === 0 ? independent : []); // NCR: skip straight to cities
  }
  async function pickProvince(province: string) {
    setV((s) => ({ ...s, province, city: "", barangay: "" })); setBarangays([]);
    setCities(province === "none" ? independent : await get(\`/api/v1/provinces/\${province}/cities-municipalities\`));
  }
  async function pickCity(city: string) {
    setV((s) => ({ ...s, city, barangay: "" }));
    setBarangays(await get(\`/api/v1/cities-municipalities/\${city}/barangays?limit=1000\`));
  }
  function pickBarangay(barangay: string) {
    const next = { ...v, barangay };
    setV(next);
    onChange({ regionCode: next.region, provinceCode: next.province || null, cityMunicipalityCode: next.city, barangayCode: barangay });
  }

  const sel = (value: string, opts: Opt[], on: (c: string) => void, label: string, extra?: Opt) => (
    <select value={value} onChange={(e) => on(e.target.value)} disabled={!opts.length && !extra} aria-label={label}>
      <option value="">{label}</option>
      {opts.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
      {extra && <option value={extra.code}>{extra.name}</option>}
    </select>
  );
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {sel(v.region, regions, pickRegion, "Region")}
      {sel(v.province, provinces, pickProvince, "Province", provinces.length ? { code: "none", name: "Independent city (HUC) / other" } : undefined)}
      {sel(v.city, cities, pickCity, "City / Municipality")}
      {sel(v.barangay, barangays, pickBarangay, "Barangay")}
    </div>
  );
}`,
  version: `// Check once a day (or on app start) whether PSGC data changed
const KEY = "psgc-version";
const meta = await fetch(\`\${BASE}/api/v1/meta\`).then((r) => r.json());
if (localStorage.getItem(KEY) !== meta.data.version) {
  // new quarterly release: clear cached dropdown lists and re-validate stored codes
  caches?.delete?.("psgc");
  localStorage.setItem(KEY, meta.data.version);
}
// Server side: re-check stored codes with GET /api/v1/codes/{code}; a 404 means the code was
// removed/merged in the new release. Store the version alongside each saved address.`,
});
