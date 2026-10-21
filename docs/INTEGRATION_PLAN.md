# Integration plan: using the PSGC API in another app

This is the same plan shown on the `/docs#integration` page of the dashboard.

## 1. Configure the base URL as an environment variable

Never hard-code the host. Switch between the hosted API, a staging copy, or your own self-hosted instance by env var.

```bash
# .env.local in YOUR app
NEXT_PUBLIC_PSGC_API_BASE_URL=https://<your-psgc-host>
```

All endpoints live under `${BASE}/api/v1`. No API key is required. CORS is open (`Access-Control-Allow-Origin: *`), so browsers can call it directly.

## 2. Build the address form as cascading dropdowns

Region -> Province -> City/Municipality -> Barangay.

| Step | Call |
|---|---|
| Regions | `GET /api/v1/regions` |
| Provinces of a region | `GET /api/v1/regions/{regionCode}/provinces` |
| LGUs outside any province (HUCs, NCR cities, City of Isabela, BARMM SGA) | `GET /api/v1/regions/{regionCode}/cities-municipalities?province=none` |
| Cities/municipalities of a province | `GET /api/v1/provinces/{provinceCode}/cities-municipalities` |
| Barangays of a city/municipality | `GET /api/v1/cities-municipalities/{code}/barangays?limit=1000` |

Special cases to handle:

- **NCR has no provinces.** When the province list is empty, go straight to the cities list (`?province=none`).
- **Highly Urbanized Cities** (Baguio, Angeles, Cebu, Davao, ...) are independent of provinces. Offer an "Independent city (HUC) / other" option in the province dropdown that loads `?province=none`. `geographicProvinceCode` tells you which province such a city sits in on the map.
- **Manila** barangays also carry a `subMunicipalityCode` (Tondo, Sampaloc, ...), see `/cities-municipalities/1380600000/sub-municipalities`.

```tsx
"use client";
// Cascading address picker. Stores PSGC CODES (stable), shows names.
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
    const [p, ind] = await Promise.all([
      get(`/api/v1/regions/${region}/provinces`),
      get(`/api/v1/regions/${region}/cities-municipalities?province=none`),
    ]);
    setProvinces(p);
    setIndependent(ind);
    setCities(p.length === 0 ? ind : []); // NCR: skip straight to cities
  }
  async function pickProvince(province: string) {
    setV((s) => ({ ...s, province, city: "", barangay: "" })); setBarangays([]);
    setCities(province === "none" ? independent : await get(`/api/v1/provinces/${province}/cities-municipalities`));
  }
  async function pickCity(city: string) {
    setV((s) => ({ ...s, city, barangay: "" }));
    setBarangays(await get(`/api/v1/cities-municipalities/${city}/barangays?limit=1000`));
  }
  function pickBarangay(barangay: string) {
    const next = { ...v, barangay };
    setV(next);
    onChange({ regionCode: next.region, provinceCode: next.province === "none" ? null : next.province || null,
      cityMunicipalityCode: next.city, barangayCode: barangay });
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
}
```

For a single search box instead of dropdowns, use `GET /api/v1/search?q=...&level=barangay&limit=10` (debounce 200-300 ms, min 2 characters). Each hit includes `fullName` and `ancestry`.

## 3. Store PSGC codes, not names

Save in your database:

| column | example |
|---|---|
| `region_code` | `"1300000000"` |
| `province_code` | `null` (NCR) |
| `city_municipality_code` | `"1381300000"` |
| `barangay_code` | `"1381300011"` |
| `psgc_version` | `"2026-Q3"` |

Codes are strings with leading zeros: never store them as integers. Names are corrected by PSA from time to time (the 3Q 2026 release is itself a barangay name correction), so render names at display time or cache them keyed by version.

## 4. Handle quarterly updates with a version check

PSA publishes PSGC updates quarterly. `GET /api/v1/meta` returns `version` (e.g. `2026-Q3`), `releaseId`, `releaseName`, `releaseDate` and `counts`; every response also carries an `X-PSGC-Version` header.

```js
const KEY = "psgc-version";
const meta = await fetch(`${BASE}/api/v1/meta`).then((r) => r.json());
if (localStorage.getItem(KEY) !== meta.data.version) {
  // new release: clear cached dropdown lists and re-validate stored codes
  localStorage.setItem(KEY, meta.data.version);
}
```

Server side, a nightly/weekly job can compare the stored `psgc_version` with `/api/v1/meta` and re-check each distinct stored code with `GET /api/v1/codes/{code}`. A `404` means the code was dissolved/merged in the new release; flag those records for review.

## 5. Caching and rate advice

- Responses send `Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800` (meta: 5 minutes). Honor it; put a CDN or your own cache in front if you have heavy traffic.
- Cache regions/provinces for the app lifetime; cache barangay lists per city for at least a day.
- Paginate `/api/v1/barangays` with `limit=500` (max) and follow `meta.hasNextPage`.
- There is no API key and no hard rate limit today; abusive traffic may be throttled. For bulk use, self-host.

## 6. Validate on the server

Before saving an address, call `GET /api/v1/codes/{barangayCode}` and check that `ancestry.cityMunicipality.code`, `ancestry.province?.code` and `ancestry.region.code` match what the client submitted.

## 7. Self-hosting option

Deploy this repository with two Postgres databases (main + staging), set the env vars from `.env.example`, run `npm run db:seed -- seed/PSGC-3Q-2026-Publication-Datafile.xlsx ...` and `npm run build && npm start`. You then control uptime, caching and when new PSA releases are approved.

## Quick reference

```bash
curl -s "$BASE/api/v1/meta"
curl -s "$BASE/api/v1/regions"
curl -s "$BASE/api/v1/cities-municipalities?province=0102800000&type=city"
curl -s "$BASE/api/v1/barangays?cityMunicipality=1381300000&limit=500"
curl -s "$BASE/api/v1/search?q=cebu&level=city,province"
curl -s "$BASE/api/v1/codes/1380100001"
```

```python
import requests
BASE = "https://<your-psgc-host>"
r = requests.get(f"{BASE}/api/v1/search", params={"q": "batasan hills", "limit": 5}, timeout=10)
for hit in r.json()["data"]:
    print(hit["code"], hit["level"], hit["fullName"])
```
