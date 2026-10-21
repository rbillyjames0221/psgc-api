import type { Metadata } from "next";
import { headers } from "next/headers";
import CodeBlock from "@/components/CodeBlock";
import Tabs from "@/components/Tabs";
import Mermaid from "@/components/Mermaid";
import { ENDPOINTS, ERROR_EXAMPLE, FLOW_MERMAID, snippets } from "@/lib/docs/content";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "API documentation", description: "REST API reference and integration plan for the PSGC API." };

const slug = (p: string) => p.replace(/^\/api\/v1\//, "").replace(/[{}]/g, "").replace(/[^a-z0-9]+/gi, "-");

export default async function Docs() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = (process.env.PUBLIC_BASE_URL && !process.env.PUBLIC_BASE_URL.includes("localhost") ? process.env.PUBLIC_BASE_URL : `${proto}://${host}`).replace(/\/$/, "");
  const s = snippets(base);

  const toc = [
    ["overview", "Overview"], ["conventions", "Conventions"], ["endpoints", "Endpoints"], ["examples", "Code examples"],
    ["integration", "Integration plan"], ["updates", "How data updates work"], ["self-hosting", "Self-hosting"],
  ];

  return (
    <main className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[200px_1fr]">
      <aside className="hidden lg:block">
        <nav className="sticky top-20 space-y-1 text-sm">
          {toc.map(([id, label]) => <a key={id} href={`#${id}`} className="block rounded px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900">{label}</a>)}
          <div className="pt-3 text-xs font-medium uppercase tracking-wide text-slate-400">Endpoints</div>
          {ENDPOINTS.map((e) => <a key={e.path} href={`#${slug(e.path)}`} className="block truncate rounded px-2 py-0.5 font-mono text-[11px] text-slate-500 hover:text-slate-900">{e.path.replace("/api/v1", "")}</a>)}
        </nav>
      </aside>

      <article className="min-w-0 space-y-12">
        <section id="overview" className="scroll-mt-20">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">PSGC API reference</h1>
          <p className="mt-3 max-w-3xl text-slate-600">
            A read-only JSON API over the Philippine Statistics Authority&apos;s Philippine Standard Geographic Code: 18 regions, 82 provinces,
            149 cities, 1,493 municipalities, the 14 sub-municipalities of Manila, and 42,010 barangays (3Q 2026). No API key needed.
          </p>
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <div className="text-slate-500">Base URL</div>
            <code className="font-mono text-slate-900">{base}/api/v1</code>
          </div>
        </section>

        <section id="conventions" className="scroll-mt-20 space-y-3 text-sm text-slate-700">
          <h2 className="text-xl font-semibold text-slate-900">Conventions</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li><b>Codes</b> are 10-digit strings (<code>RR PPP MM BBB</code>: region, province, city/municipality, barangay). Always treat them as strings; they have leading zeros.</li>
            <li><b>Hierarchy quirks</b>: NCR has no provinces; Highly Urbanized Cities (HUCs), the City of Isabela and the BARMM Special Geographic Area are not under a province (<code>provinceCode: null</code>, use <code>province=none</code>). <code>geographicProvinceCode</code> tells you which province such a city sits in on the map. Manila&apos;s barangays also carry a <code>subMunicipalityCode</code>.</li>
            <li><b>Lists</b> return <code>{"{ data: [...], meta: { total, page, limit, totalPages, hasNextPage } }"}</code>. Single items return <code>{"{ data: {...} }"}</code>.</li>
            <li><b>Errors</b> always look like <code>{"{ error: { status, code, message } }"}</code> with codes <code>BAD_REQUEST</code>, <code>NOT_FOUND</code>, <code>SERVICE_UNAVAILABLE</code>, <code>INTERNAL_ERROR</code>.</li>
            <li><b>CORS</b>: <code>Access-Control-Allow-Origin: *</code>, so you can call it straight from a browser.</li>
            <li><b>Caching</b>: <code>Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800</code> (meta: 5 minutes). Every response has <code>X-PSGC-Version</code> and <code>X-PSGC-Release</code> headers.</li>
          </ul>
          <CodeBlock code={ERROR_EXAMPLE} title="Error format" />
        </section>

        <section id="endpoints" className="scroll-mt-20 space-y-8">
          <h2 className="text-xl font-semibold text-slate-900">Endpoints</h2>
          {ENDPOINTS.map((e) => (
            <div key={e.path} id={slug(e.path)} className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">{e.method}</span>
                <code className="font-mono text-sm font-semibold text-slate-900">{e.path}</code>
              </div>
              <p className="mt-2 text-sm text-slate-600">{e.summary}</p>
              {e.params && (
                <table className="mt-3 w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-slate-400"><tr><th className="py-1 pr-4">Param</th><th className="py-1 pr-4">In</th><th className="py-1">Description</th></tr></thead>
                  <tbody>{e.params.map((p) => (
                    <tr key={p.name} className="border-t border-slate-100"><td className="py-1 pr-4 font-mono text-xs">{p.name}</td><td className="py-1 pr-4 text-slate-500">{p.in}</td><td className="py-1 text-slate-700">{p.desc}</td></tr>
                  ))}</tbody>
                </table>
              )}
              <div className="mt-3 text-xs text-slate-500">Example: <a className="font-mono text-blue-700 hover:underline" href={e.example} target="_blank" rel="noreferrer">GET {e.example}</a></div>
              <div className="mt-2"><CodeBlock code={e.response} title="Response" /></div>
            </div>
          ))}
        </section>

        <section id="examples" className="scroll-mt-20 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">Copy-paste examples</h2>
          <Tabs tabs={[
            { label: "JavaScript", content: <CodeBlock code={s.js} title="fetch" /> },
            { label: "Python", content: <CodeBlock code={s.python} title="requests" /> },
            { label: "cURL", content: <CodeBlock code={s.curl} title="shell" /> },
          ]} />
        </section>

        <section id="integration" className="scroll-mt-20 space-y-4 text-sm text-slate-700">
          <h2 className="text-xl font-semibold text-slate-900">Integration plan: using this API in another app</h2>
          <ol className="list-decimal space-y-4 pl-5">
            <li>
              <b>Configure the base URL as an environment variable</b> so you can switch between this hosted API, a staging copy, or your own self-hosted instance without code changes.
              <div className="mt-2"><CodeBlock code={s.env} title=".env.local" /></div>
            </li>
            <li>
              <b>Build the address form as cascading dropdowns</b>: Region → Province → City/Municipality → Barangay. Handle the two special cases: when a region has no provinces (NCR) go straight to its cities, and offer an &ldquo;Independent city (HUC) / other&rdquo; choice that loads <code>?province=none</code>.
              <div className="mt-2"><CodeBlock code={s.react} title="AddressPicker.tsx (React)" /></div>
            </li>
            <li><b>Store PSGC codes, not names.</b> Save <code>regionCode</code>, <code>provinceCode</code>, <code>cityMunicipalityCode</code>, <code>barangayCode</code> (as strings) plus the <code>version</code> you validated against. Names get corrected by PSA (the 3Q 2026 release itself is a barangay name correction); codes stay stable. Render names at display time, or cache them with the version.</li>
            <li>
              <b>Handle quarterly updates with a version check.</b> PSA publishes PSGC updates quarterly. Call <code>/api/v1/meta</code> on app start or daily; when <code>version</code> changes, drop cached lists and re-validate stored codes via <code>/api/v1/codes/{"{code}"}</code> (a 404 means the code was dissolved or merged).
              <div className="mt-2"><CodeBlock code={s.version} title="version check" /></div>
            </li>
            <li><b>Cache aggressively; be gentle.</b> Lists change at most once a quarter. Cache region/province lists for the app lifetime and barangay lists per city for at least a day (respect <code>Cache-Control</code>). Debounce search-as-you-type (200-300 ms, min 2 chars). Paginate <code>/barangays</code> with <code>limit=500</code> rather than hammering. There is no hard rate limit, but abusive traffic may be throttled at the edge.</li>
            <li><b>Server-side validation</b>: before saving an address, verify the chain with <code>/api/v1/codes/{"{barangayCode}"}</code> and compare <code>ancestry</code> to the submitted parent codes.</li>
            <li><b>Self-host when you need guarantees</b> (offline, SLA, data residency): deploy this repo with your own Postgres databases, see <a href="#self-hosting" className="text-blue-700 underline">Self-hosting</a>.</li>
          </ol>
        </section>

        <section id="updates" className="scroll-mt-20 space-y-3 text-sm text-slate-700">
          <h2 className="text-xl font-semibold text-slate-900">How data updates work (staging → review → main)</h2>
          <p>New PSA files never go straight to the public API. Every import lands in a separate <b>staging</b> database, is checked by sanity guards and diffed against <b>main</b>, and only a human approval on the signed review page promotes it. The previous main is kept so a rollback is one command.</p>
          <Mermaid chart={FLOW_MERMAID} />
          <ul className="list-disc space-y-1 pl-5">
            <li><b>Sanity guards</b> flag any level whose count drops by more than 1%, more than 0.5% of codes removed, malformed or orphan codes, truncated files (below plausible national minimums) and mismatches against PSA&apos;s own National Summary sheet. Critical warnings must be explicitly acknowledged to approve.</li>
            <li><b>Review links</b> are HMAC-signed with <code>ADMIN_SECRET</code>, tied to one staged release id, expire (14 days by default) and stop working once that release is approved, rejected or superseded. Approval is a POST with a confirmation checkbox, so link scanners in mail clients can&apos;t trigger it.</li>
            <li><b>Promotion</b> runs in one Postgres transaction on main: current data → <code>areas_previous</code>, staged rows → <code>areas</code>, <code>release_current</code> updated, an <code>audit_log</code> row written. <code>npm run rollback -- --yes</code> swaps current and previous back.</li>
          </ul>
        </section>

        <section id="self-hosting" className="scroll-mt-20 space-y-3 text-sm text-slate-700">
          <h2 className="text-xl font-semibold text-slate-900">Self-hosting</h2>
          <CodeBlock title="shell" code={`git clone <this repo> && cd psgc-api && npm ci
cp .env.example .env.local   # set DATABASE_URL_MAIN, DATABASE_URL_STAGING, ADMIN_SECRET, PUBLIC_BASE_URL
npm run db:seed -- seed/PSGC-3Q-2026-Publication-Datafile.xlsx \\
  --release-name "Third Quarter 2026 PSGC Updates: Correction of the Name of One Barangay" \\
  --release-date 2026-10-12 --reference-no 2026-331
npm run build && npm start`} />
          <p>Data attribution: Philippine Statistics Authority (PSA). This project is not affiliated with PSA.</p>
        </section>
      </article>
    </main>
  );
}
