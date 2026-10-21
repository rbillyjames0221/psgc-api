"use client";
import { useMemo, useState } from "react";
import type { Region } from "@/lib/types";

const METRICS = {
  barangayCount: "Barangays",
  municipalityCount: "Municipalities",
  cityCount: "Cities",
  provinceCount: "Provinces",
  population: "Population (2024)",
} as const;
type Metric = keyof typeof METRICS;

const short = (name: string) => {
  const m = name.match(/\(([^)]+)\)\s*$/);
  return m ? m[1] : name.replace(" Region", "");
};

export default function RegionChart({ regions }: { regions: Region[] }) {
  const [metric, setMetric] = useState<Metric>("barangayCount");
  const rows = useMemo(() => [...regions].sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0)), [regions, metric]);
  const max = Math.max(1, ...rows.map((r) => r[metric] ?? 0));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">By region</h2>
          <p className="text-sm text-slate-500">{METRICS[metric]} per region</p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 text-xs">
          {(Object.keys(METRICS) as Metric[]).map((m) => (
            <button key={m} onClick={() => setMetric(m)}
              className={`rounded-md px-2.5 py-1 ${metric === m ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
              {METRICS[m]}
            </button>
          ))}
        </div>
      </div>
      <ul className="mt-4 space-y-1.5">
        {rows.map((r) => {
          const v = r[metric] ?? 0;
          return (
            <li key={r.code} className="grid grid-cols-[7.5rem_1fr_5.5rem] items-center gap-3 text-sm sm:grid-cols-[12rem_1fr_6rem]" title={r.name}>
              <span className="truncate text-slate-700">{short(r.name)}</span>
              <span className="h-5 overflow-hidden rounded bg-slate-100">
                <span className="block h-full rounded bg-gradient-to-r from-[#0038a8] to-[#3b6fd8] transition-all duration-500" style={{ width: `${(v / max) * 100}%` }} />
              </span>
              <span className="text-right tabular-nums text-slate-900">{v.toLocaleString("en-US")}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
