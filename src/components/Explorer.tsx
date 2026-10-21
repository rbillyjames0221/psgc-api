"use client";
import { useState } from "react";

interface Item { code: string; name: string; [k: string]: unknown }
const INDEPENDENT = "__independent__";

async function getList(url: string): Promise<Item[]> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()).data as Item[];
}

function Column({ title, items, selected, onSelect, loading, filterable, subtitle }: {
  title: string; items: Item[] | null; selected: string | null; onSelect: (i: Item) => void; loading: boolean; filterable?: boolean;
  subtitle?: (i: Item) => string | null;
}) {
  const [f, setF] = useState("");
  const shown = items && f ? items.filter((i) => i.name.toLowerCase().includes(f.toLowerCase()) || i.code.includes(f)) : items;
  return (
    <div className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-3 py-2">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-500">
          <span>{title}</span>{items && <span className="tabular-nums">{items.length.toLocaleString()}</span>}
        </div>
        {filterable && items && items.length > 8 && (
          <input value={f} onChange={(e) => setF(e.target.value)} placeholder="Filter…" className="mt-2 w-full rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-blue-400" />
        )}
      </div>
      <ul className="h-80 overflow-auto py-1 text-sm">
        {loading && <li className="px-3 py-2 text-slate-400">Loading…</li>}
        {!loading && !items && <li className="px-3 py-2 text-slate-400">Select from the previous column</li>}
        {!loading && shown?.map((i) => (
          <li key={i.code}>
            <button onClick={() => onSelect(i)}
              className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left ${selected === i.code ? "bg-blue-50 font-medium text-blue-900" : "hover:bg-slate-50"}`}>
              <span className="min-w-0"><span className="block truncate">{i.name}</span>{subtitle?.(i) && <span className="block truncate text-xs text-slate-500">{subtitle(i)}</span>}</span>
              <span className="shrink-0 text-slate-300">›</span>
            </button>
          </li>
        ))}
        {!loading && shown?.length === 0 && <li className="px-3 py-2 text-slate-400">Nothing here</li>}
      </ul>
    </div>
  );
}

export default function Explorer({ regions }: { regions: { code: string; name: string; barangayCount: number }[] }) {
  const [region, setRegion] = useState<string | null>(null);
  const [province, setProvince] = useState<string | null>(null);
  const [cm, setCm] = useState<string | null>(null);
  const [provinces, setProvinces] = useState<Item[] | null>(null);
  const [independent, setIndependent] = useState<Item[]>([]);
  const [cms, setCms] = useState<Item[] | null>(null);
  const [bgys, setBgys] = useState<Item[] | null>(null);
  const [detail, setDetail] = useState<Item | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function pickRegion(i: Item) {
    setRegion(i.code); setProvince(null); setCm(null); setCms(null); setBgys(null); setDetail(i); setLoading("p"); setErr(null);
    try {
      const [p, ind] = await Promise.all([getList(`/api/v1/regions/${i.code}/provinces`), getList(`/api/v1/regions/${i.code}/cities-municipalities?province=none`)]);
      setIndependent(ind);
      setProvinces(ind.length ? [...p, { code: INDEPENDENT, name: p.length ? "Independent cities & other LGUs" : "Cities & municipalities (no provinces)", count: ind.length }] : p);
      if (!p.length && ind.length) { setProvince(INDEPENDENT); setCms(ind); }
    } catch (e) { setErr(String(e)); } finally { setLoading(null); }
  }
  async function pickProvince(i: Item) {
    setProvince(i.code); setCm(null); setBgys(null); setErr(null);
    if (i.code === INDEPENDENT) { setCms(independent); setDetail(null); return; }
    setDetail(i); setLoading("c");
    try { setCms(await getList(`/api/v1/provinces/${i.code}/cities-municipalities`)); } catch (e) { setErr(String(e)); } finally { setLoading(null); }
  }
  async function pickCm(i: Item) {
    setCm(i.code); setDetail(i); setLoading("b"); setErr(null);
    try { setBgys(await getList(`/api/v1/cities-municipalities/${i.code}/barangays?limit=1000`)); } catch (e) { setErr(String(e)); } finally { setLoading(null); }
  }

  const regionItems: Item[] = regions.map((r) => ({ ...r }));
  return (
    <div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Column title="Region" items={regionItems} selected={region} onSelect={pickRegion} loading={false} subtitle={(i) => `${Number(i.barangayCount).toLocaleString()} barangays`} />
        <Column title="Province" items={provinces} selected={province} onSelect={pickProvince} loading={loading === "p"}
          subtitle={(i) => (i.code === INDEPENDENT ? `${i.count} HUCs / special areas` : `${i.cityCount} cities · ${i.municipalityCount} mun.`)} />
        <Column title="City / Municipality" items={cms} selected={cm} onSelect={pickCm} loading={loading === "c"} filterable
          subtitle={(i) => (i.type === "City" ? `City · ${i.cityClass}` : "Municipality") + ` · ${i.barangayCount} bgy`} />
        <Column title="Barangay" items={bgys} selected={detail?.code ?? null} onSelect={(i) => setDetail(i)} loading={loading === "b"} filterable
          subtitle={(i) => [i.urbanRural === "U" ? "Urban" : i.urbanRural === "R" ? "Rural" : null, i.population != null ? `pop. ${Number(i.population).toLocaleString()}` : null].filter(Boolean).join(" · ") || null} />
      </div>
      {err && <p className="mt-2 text-sm text-red-700">Could not load: {err}</p>}
      {detail && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <div><span className="font-semibold">{detail.name}</span> <code className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs">{detail.code}</code></div>
          <a className="font-mono text-xs text-blue-700 hover:underline" href={`/api/v1/codes/${detail.code}`} target="_blank" rel="noreferrer">GET /api/v1/codes/{detail.code}</a>
        </div>
      )}
    </div>
  );
}
