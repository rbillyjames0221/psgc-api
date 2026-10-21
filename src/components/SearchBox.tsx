"use client";
import { useEffect, useRef, useState } from "react";

interface Result { code: string; name: string; level: string; fullName: string }
interface Lookup { data: Record<string, unknown> & { name: string; code: string; level: string }; fullName: string; ancestry: Record<string, { code: string; name: string } | null> }

const LEVEL_COLORS: Record<string, string> = {
  region: "bg-purple-100 text-purple-800", province: "bg-blue-100 text-blue-800", city: "bg-emerald-100 text-emerald-800",
  municipality: "bg-teal-100 text-teal-800", "sub-municipality": "bg-amber-100 text-amber-800", barangay: "bg-slate-100 text-slate-700",
};
export const LevelBadge = ({ level }: { level: string }) => (
  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${LEVEL_COLORS[level] ?? "bg-slate-100"}`}>{level}</span>
);

export default function SearchBox() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Lookup | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/v1/search?q=${encodeURIComponent(q.trim())}&limit=12`, { signal: ctl.signal });
        const j = await r.json();
        setResults(j.data ?? []); setTotal(j.meta?.total ?? 0); setOpen(true);
      } catch { /* aborted */ } finally { setLoading(false); }
    }, 200);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  async function pick(code: string) {
    setOpen(false);
    const r = await fetch(`/api/v1/codes/${code}`);
    if (r.ok) setPicked(await r.json());
  }

  return (
    <div ref={box} className="relative text-slate-900">
      <div className="flex items-center rounded-xl bg-white px-4 shadow-lg ring-1 ring-black/5">
        <svg className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden><path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 3.47 9.77l3.63 3.63a.75.75 0 1 0 1.06-1.06l-3.63-3.63A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clipRule="evenodd" /></svg>
        <input value={q} onChange={(e) => { setQ(e.target.value); if (e.target.value.trim().length < 2) { setResults([]); setTotal(0); } }} onFocus={() => results.length && setOpen(true)}
          placeholder="Search any place: e.g. Batasan Hills, Cebu, Bacarra, 1380100001"
          aria-label="Search PSGC" className="w-full bg-transparent px-3 py-3.5 text-sm outline-none placeholder:text-slate-400" />
        {loading && <span className="text-xs text-slate-400">…</span>}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-2 max-h-96 w-full overflow-auto rounded-xl bg-white py-1 text-sm shadow-xl ring-1 ring-black/5">
          {results.map((r) => (
            <li key={r.code}>
              <button onClick={() => pick(r.code)} className="flex w-full items-start gap-3 px-4 py-2 text-left hover:bg-slate-50">
                <LevelBadge level={r.level} />
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.name}</span><span className="block truncate text-xs text-slate-500">{r.fullName}</span></span>
                <code className="text-xs text-slate-400">{r.code}</code>
              </button>
            </li>
          ))}
          {total > results.length && <li className="px-4 py-2 text-xs text-slate-500">{total.toLocaleString()} matches; refine your search to narrow down.</li>}
        </ul>
      )}
      {open && q.trim().length >= 2 && !loading && results.length === 0 && (
        <div className="absolute z-20 mt-2 w-full rounded-xl bg-white px-4 py-3 text-sm text-slate-500 shadow-xl ring-1 ring-black/5">No matches.</div>
      )}
      {picked && (
        <div className="mt-3 rounded-xl bg-white p-4 text-sm shadow-lg ring-1 ring-black/5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2"><LevelBadge level={String(picked.data.level)} /><span className="font-semibold">{picked.data.name}</span></div>
              <div className="mt-1 text-slate-500">{picked.fullName}</div>
            </div>
            <button onClick={() => setPicked(null)} className="text-slate-400 hover:text-slate-700" aria-label="Close">✕</button>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div><dt className="text-xs text-slate-500">PSGC code</dt><dd className="font-mono">{picked.data.code}</dd></div>
            {"population" in picked.data && <div><dt className="text-xs text-slate-500">Population (2024)</dt><dd>{Number(picked.data.population ?? 0).toLocaleString()}</dd></div>}
            {"urbanRural" in picked.data && picked.data.urbanRural != null && <div><dt className="text-xs text-slate-500">Urban/Rural</dt><dd>{picked.data.urbanRural === "U" ? "Urban" : "Rural"}</dd></div>}
            {"cityClass" in picked.data && picked.data.cityClass != null && <div><dt className="text-xs text-slate-500">City class</dt><dd>{String(picked.data.cityClass)}</dd></div>}
          </dl>
          <a href={`/api/v1/codes/${picked.data.code}`} className="mt-3 inline-block font-mono text-xs text-blue-700 hover:underline">GET /api/v1/codes/{picked.data.code}</a>
        </div>
      )}
    </div>
  );
}
