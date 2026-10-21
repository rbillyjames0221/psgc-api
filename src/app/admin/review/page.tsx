import type { Metadata } from "next";
import Link from "next/link";
import { authorize } from "@/lib/admin-auth";
import { getMainRelease, getStagedRelease, listAudit, listStagedReleases } from "@/lib/release/ops";
import type { DiffItem } from "@/lib/psgc/diff";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Review PSGC release", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

const SEV: Record<string, string> = {
  critical: "border-red-300 bg-red-50 text-red-900",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
};
const STATUS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800", approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800", superseded: "bg-slate-200 text-slate-700",
};

export default async function ReviewPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const release = one(sp.release), exp = one(sp.exp), sig = one(sp.sig), done = one(sp.done), err = one(sp.err);
  const mode = await authorize({ release, exp, sig });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">&larr; PSGC API</Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Release review</h1>
          <p className="text-sm text-slate-500">Staged PSA imports wait here. Nothing reaches the public API until it is approved.</p>
        </div>
        {mode === "session" && (
          <form action="/api/admin/logout" method="post"><button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">Log out</button></form>
        )}
      </div>
      {done && <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-emerald-900">Done: {done}.</div>}
      {err && <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-red-900">{err}</div>}
      {!mode ? <Login release={release} exp={exp} sig={sig} /> : release ? <ReleaseView id={release} mode={mode} exp={exp} sig={sig} /> : <Overview />}
    </main>
  );
}

function Login({ release, exp, sig }: { release: string | null; exp: string | null; sig: string | null }) {
  return (
    <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="font-medium text-slate-900">Admin access required</h2>
      <p className="mt-1 text-sm text-slate-600">
        Open the signed review link from the update email, or sign in with the server&apos;s <code>ADMIN_SECRET</code>.
        {release && " The review link you used is invalid or expired."}
      </p>
      <form action="/api/admin/login" method="post" className="mt-4 space-y-3">
        <input type="hidden" name="release" value={release ?? ""} />
        <input type="hidden" name="exp" value={exp ?? ""} />
        <input type="hidden" name="sig" value={sig ?? ""} />
        <input name="secret" type="password" required placeholder="ADMIN_SECRET" autoComplete="current-password"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        <button className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">Sign in</button>
      </form>
    </div>
  );
}

async function Overview() {
  const [main, releases, audit] = await Promise.all([getMainRelease(), listStagedReleases(20), listAudit(20)]);
  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-medium text-slate-900">Live in MAIN</h2>
        {main ? (
          <p className="mt-1 text-sm text-slate-600"><b>{main.meta.releaseName}</b> ({main.version}), release id <code>{main.releaseId}</code>, promoted {new Date(main.promotedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} by {main.promotedBy}</p>
        ) : <p className="text-sm text-slate-600">Main is empty.</p>}
        <form action="/api/admin/rollback" method="post" className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="confirm" value="yes" required /> Restore the previous snapshot</label>
          <button className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">Roll back main</button>
        </form>
      </section>
      <section>
        <h2 className="mb-2 font-medium text-slate-900">Staged releases</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-3">Release</th><th className="p-3">Status</th><th className="p-3">Staged</th><th className="p-3">Warnings</th></tr></thead>
            <tbody>
              {releases.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="p-3"><Link className="text-blue-700 hover:underline" href={`/admin/review?release=${encodeURIComponent(r.id)}`}>{r.id}</Link><div className="text-xs text-slate-500">{r.meta.releaseName}</div></td>
                  <td className="p-3"><span className={`rounded px-2 py-0.5 text-xs ${STATUS[r.status]}`}>{r.status}</span></td>
                  <td className="p-3 text-slate-600">{new Date(r.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</td>
                  <td className="p-3">{r.warnings.filter((w) => w.severity === "critical").length} critical, {r.warnings.filter((w) => w.severity === "warning").length} warnings</td>
                </tr>
              ))}
              {!releases.length && <tr><td className="p-3 text-slate-500" colSpan={4}>No staged releases.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-medium text-slate-900">Audit log</h2>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
          {audit.map((a) => (
            <li key={a.id} className="flex flex-wrap gap-x-3 p-3">
              <span className="font-mono text-xs text-slate-400">#{a.id}</span>
              <span className="font-medium">{a.action}</span>
              <span className="font-mono text-xs">{a.release_id}</span>
              <span className="text-slate-500">by {a.actor} at {new Date(a.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

async function ReleaseView({ id, mode, exp, sig }: { id: string; mode: "session" | "link"; exp: string | null; sig: string | null }) {
  const [rel, main] = await Promise.all([getStagedRelease(id), getMainRelease()]);
  if (!rel) return <p className="text-slate-600">Release <code>{id}</code> not found.</p>;
  const critical = rel.warnings.filter((w) => w.severity === "critical");
  const stale = (main?.releaseId ?? null) !== rel.baseReleaseId;
  const d = rel.diff;
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS[rel.status]}`}>{rel.status}</span>
          <code className="text-xs text-slate-500">{rel.id}</code>
        </div>
        <h2 className="mt-2 text-lg font-semibold text-slate-900">{rel.meta.releaseName}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          <Item k="Version" v={rel.version} /><Item k="Released" v={rel.meta.releaseDate ?? "-"} />
          <Item k="As of" v={rel.meta.asOf ?? "-"} /><Item k="Reference" v={rel.meta.referenceNo ?? "-"} />
          <Item k="Source file" v={rel.sourceFileName ?? "-"} /><Item k="Compared with main" v={rel.baseVersion ?? "(empty)"} />
          <Item k="Staged" v={new Date(rel.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} />
          <Item k="Decided" v={rel.decidedAt ? `${new Date(rel.decidedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} by ${rel.decidedBy}` : "-"} />
        </dl>
      </section>

      {rel.warnings.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-medium text-slate-900">Sanity checks</h3>
          {rel.warnings.map((w, i) => (
            <div key={i} className={`rounded-lg border p-3 text-sm ${SEV[w.severity]}`}><b className="uppercase">{w.severity}</b> · <code>{w.code}</code> · {w.message}</div>
          ))}
        </section>
      )}
      {rel.status === "pending" && stale && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">Main changed since this diff was computed. Run <code>npm run diff -- --release {rel.id}</code> and review again; approval is blocked until then.</div>
      )}

      {d && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-medium text-slate-900">Counts</h3>
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-slate-500"><tr><th className="py-1">Level</th><th className="py-1 text-right">Main</th><th className="py-1 text-right">Staged</th><th className="py-1 text-right">Change</th></tr></thead>
            <tbody>
              {Object.entries(d.countDelta).map(([k, v]) => (
                <tr key={k} className="border-t border-slate-100">
                  <td className="py-1">{k}</td><td className="py-1 text-right tabular-nums">{v.before ?? "-"}</td><td className="py-1 text-right tabular-nums">{v.after}</td>
                  <td className={`py-1 text-right tabular-nums ${v.delta && v.delta < 0 ? "text-red-700" : v.delta ? "text-emerald-700" : "text-slate-400"}`}>{v.delta === null ? "-" : `${v.delta > 0 ? "+" : ""}${v.delta}`}{v.pct ? ` (${v.pct}%)` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-sm text-slate-600">Added {d.summary.added} · Removed {d.summary.removed} · Renamed {d.summary.renamed} · Re-parented {d.summary.reparented} · Reclassified {d.summary.reclassified}</p>
        </section>
      )}

      {d && (
        <section className="space-y-3">
          <DiffList title="Added" items={d.added} names={d.names} render={(i) => <>in {nm(d.names, i.after?.parent)}</>} />
          <DiffList title="Removed" items={d.removed} names={d.names} render={(i) => <>was in {nm(d.names, i.before?.parent)}</>} />
          <DiffList title="Renamed" items={d.renamed} names={d.names} render={(i) => <>&ldquo;{i.before?.name}&rdquo; &rarr; &ldquo;{i.after?.name}&rdquo;</>} />
          <DiffList title="Re-parented" items={d.reparented} names={d.names} render={(i) => <>{nm(d.names, i.before?.parent)} &rarr; {nm(d.names, i.after?.parent)}</>} />
          <DiffList title="Reclassified" items={d.reclassified} names={d.names} render={(i) => <>{i.changes?.join("; ")}</>} />
          {!d.hasChanges && <p className="text-sm text-slate-600">No code-level differences from main.</p>}
        </section>
      )}

      {rel.status === "pending" && (
        <section className="rounded-xl border-2 border-slate-900 bg-white p-5">
          <h3 className="font-medium text-slate-900">Decision</h3>
          <form method="post" className="mt-3 space-y-3">
            <input type="hidden" name="exp" value={exp ?? ""} /><input type="hidden" name="sig" value={sig ?? ""} />
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" className="mt-1" /> I reviewed the counts and changes above and want this release to replace what the public API serves.</label>
            {critical.length > 0 && (
              <label className="flex items-start gap-2 text-sm text-red-800"><input type="checkbox" name="acknowledgeWarnings" value="yes" className="mt-1" /> I acknowledge the {critical.length} critical sanity warning(s) and still want to approve.</label>
            )}
            <input name="note" placeholder="Optional note (stored with a rejection)" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <div className="flex gap-3">
              <button formAction={`/api/admin/releases/${encodeURIComponent(rel.id)}/approve`} disabled={stale}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">Approve &amp; promote to main</button>
              <button formAction={`/api/admin/releases/${encodeURIComponent(rel.id)}/reject`}
                className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">Reject</button>
            </div>
            <p className="text-xs text-slate-500">Approve copies staging into main in one transaction and keeps the previous main for <code>npm run rollback</code>. {mode === "link" ? "Authorized by signed review link." : "Authorized by admin session."}</p>
          </form>
        </section>
      )}
    </div>
  );
}

const nm = (names: Record<string, string>, c?: string | null) => (c ? `${names[c] ?? "?"} (${c})` : "-");
function Item({ k, v }: { k: string; v: string }) {
  return <div><dt className="text-xs text-slate-500">{k}</dt><dd className="truncate text-slate-900">{v}</dd></div>;
}
function DiffList({ title, items, render }: { title: string; items: DiffItem[]; names: Record<string, string>; render: (i: DiffItem) => React.ReactNode }) {
  if (!items.length) return null;
  const MAX = 2000;
  return (
    <details open={items.length <= 50} className="rounded-xl border border-slate-200 bg-white">
      <summary className="cursor-pointer p-4 font-medium text-slate-900">{title} ({items.length})</summary>
      <ul className="max-h-[480px] divide-y divide-slate-100 overflow-auto border-t border-slate-100 text-sm">
        {items.slice(0, MAX).map((i) => (
          <li key={i.code} className="flex flex-wrap gap-x-2 px-4 py-1.5">
            <code className="text-xs text-slate-500">{i.code}</code><span className="font-medium">{i.name}</span>
            <span className="text-xs text-slate-400">{i.level}</span><span className="text-slate-600">{render(i)}</span>
          </li>
        ))}
        {items.length > MAX && <li className="px-4 py-2 text-slate-500">...and {items.length - MAX} more (see changes/*.json)</li>}
      </ul>
    </details>
  );
}
