import Link from "next/link";
import { getMeta, queryAreas } from "@/lib/data";
import type { Region } from "@/lib/types";
import RegionChart from "@/components/RegionChart";
import Explorer from "@/components/Explorer";
import SearchBox from "@/components/SearchBox";

export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("en-US");
const fmtDate = (s: string | null | undefined) => {
  if (!s) return "-";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Manila" });
};

export default async function Home() {
  let meta: Awaited<ReturnType<typeof getMeta>> = null;
  let regions: Region[] = [];
  let dbError = false;
  try {
    [meta, { items: regions }] = await Promise.all([getMeta(), queryAreas<Region>({ levels: ["region"], page: 1, limit: 100 })]);
  } catch (e) {
    console.error(e);
    dbError = true;
  }

  if (dbError || !meta) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold">PSGC API</h1>
        <p className="mt-3 text-slate-600">{dbError ? "The database is not reachable right now." : "No approved PSGC release has been published yet."}</p>
        <Link href="/docs" className="mt-6 inline-block text-blue-700 underline">Read the API docs</Link>
      </main>
    );
  }

  const c = meta.counts;
  const stats = [
    { label: "Regions", value: c.regions, note: "incl. NCR, CAR, NIR, BARMM" },
    { label: "Provinces", value: c.provinces, note: "NCR has none" },
    { label: "Cities", value: c.cities, note: `${c.highlyUrbanizedCities} HUC · ${c.independentComponentCities} ICC · ${c.componentCities} CC` },
    { label: "Municipalities", value: c.municipalities, note: "incl. 8 in the BARMM SGA" },
    { label: "Barangays", value: c.barangays, note: `${c.subMunicipalities} Manila sub-municipalities` },
  ];

  return (
    <main>
      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-[#0038a8] via-[#163f9e] to-[#0b1d4d] text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#fcd116]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-[#ce1126]/25 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs ring-1 ring-white/20">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Live release {meta.version} · ref. {meta.referenceNo ?? "-"}
          </div>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">Philippine Standard Geographic Code, as an API</h1>
          <p className="mt-4 max-w-2xl text-blue-100">
            Every region, province, city, municipality and barangay from the PSA&apos;s official PSGC publication, with stable 10-digit codes, a searchable explorer, and a free JSON API for your apps.
          </p>
          <div className="mt-6 grid max-w-3xl gap-3 rounded-xl bg-white/10 p-4 text-sm ring-1 ring-white/15 sm:grid-cols-3">
            <div><div className="text-blue-200">Current PSA release</div><div className="font-medium">{meta.releaseName}</div></div>
            <div><div className="text-blue-200">Released · As of</div><div className="font-medium">{fmtDate(meta.releaseDate)} · {meta.asOf}</div></div>
            <div><div className="text-blue-200">Last updated here</div><div className="font-medium">{fmtDate(meta.promotedAt)}</div></div>
          </div>
          <div className="mt-6 max-w-2xl"><SearchBox /></div>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link href="/docs" className="rounded-md bg-white px-4 py-2 font-medium text-[#0038a8] hover:bg-blue-50">API documentation</Link>
            <Link href="/docs#integration" className="rounded-md px-4 py-2 font-medium text-white ring-1 ring-white/40 hover:bg-white/10">Integration plan</Link>
            <a href="/api/v1/meta" className="rounded-md px-4 py-2 font-mono text-xs text-blue-100 ring-1 ring-white/20 hover:bg-white/10">GET /api/v1/meta</a>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-8 max-w-6xl px-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{s.label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{fmt(s.value)}</div>
              <div className="mt-1 text-xs text-slate-500">{s.note}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {meta.totalsMatch ? "✓ Counts verified against PSA's published National Summary for this release." : "Counts as parsed from the PSA publication file."}
        </p>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4">
        <RegionChart regions={regions} />
      </section>

      <section id="explorer" className="mx-auto mt-10 max-w-6xl scroll-mt-20 px-4 pb-16">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Explorer</h2>
            <p className="text-sm text-slate-500">Drill down from region to barangay. Every list here is a live call to the public API.</p>
          </div>
        </div>
        <Explorer regions={regions.map((r) => ({ code: r.code, name: r.name, barangayCount: r.barangayCount }))} />
      </section>
    </main>
  );
}
