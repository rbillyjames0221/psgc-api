import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parsePsgcWorkbook, readNationalSummary } from "./parse-psgc";
import type { Counts } from "../../src/lib/types";

/** Load .env.local / .env (if present) without overriding variables already set. */
export function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    const p = resolve(f);
    if (existsSync(p)) {
      try { process.loadEnvFile(p); } catch { /* ignore */ }
    }
  }
}

export function parseArgs(argv = process.argv.slice(2)) {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) { flags[key] = next; i++; } else flags[key] = true;
    } else positional.push(a);
  }
  const str = (k: string) => (typeof flags[k] === "string" ? (flags[k] as string) : undefined);
  return { positional, flags, str };
}

/** Parse a PSA workbook and verify counts against PSA's National Summary sheet (+ optional --expect). */
export function parseAndVerify(file: string, args: ReturnType<typeof parseArgs>) {
  const path = resolve(file);
  if (!existsSync(path)) throw new Error(`File not found: ${path}`);
  const { str } = args;
  const { dataset, warnings } = parsePsgcWorkbook(path, {
    releaseName: str("release-name"), releaseDate: str("release-date"), referenceNo: str("reference-no"),
    sourceFile: str("source-file"), sourcePage: str("source-page"),
    quarter: str("quarter") ? Number(str("quarter")) : undefined, year: str("year") ? Number(str("year")) : undefined,
  });
  const m = dataset.meta;
  const expected: Partial<Counts> = {};
  const summary = readNationalSummary(path);
  if (summary) {
    expected.regions = Object.keys(summary.regions).length;
    expected.provinces = summary.national.provinces;
    expected.cities = summary.national.cities;
    expected.municipalities = summary.national.municipalities;
    expected.barangays = summary.national.barangays;
  }
  if (str("expect")) for (const pair of str("expect")!.split(",")) {
    const [k, v] = pair.split("=");
    if (k && v) (expected as Record<string, number>)[k.trim()] = Number(v);
  }
  console.log(`\nPSGC file: ${path}`);
  console.log(`Release: ${m.releaseName} (${m.version}), as of ${m.asOf ?? "?"}, released ${m.releaseDate ?? "?"}\n`);
  console.log("Level                          Parsed   Expected  OK");
  let ok = true;
  for (const [k, v] of Object.entries(m.counts)) {
    const e = (expected as Record<string, number | undefined>)[k];
    const mark = e === undefined ? "" : e === v ? "yes" : "NO";
    if (mark === "NO") ok = false;
    console.log(`${k.padEnd(30)} ${String(v).padStart(6)}   ${String(e ?? "-").padStart(8)}  ${mark}`);
  }
  if (summary) {
    const issues: string[] = [];
    for (const r of dataset.regions) {
      const s = summary.regions[r.code];
      if (!s) { issues.push(`${r.code} ${r.name}: not in National Summary`); continue; }
      const got = { provinces: r.provinceCount, cities: r.cityCount, municipalities: r.municipalityCount, barangays: r.barangayCount };
      for (const k of Object.keys(got) as (keyof typeof got)[]) if (got[k] !== s[k]) issues.push(`${r.code} ${r.name}: ${k} parsed ${got[k]} vs summary ${s[k]}`);
    }
    if (issues.length) { ok = false; console.log("\nPer-region mismatches:\n  " + issues.join("\n  ")); }
    else console.log(`\nPer-region counts match PSA's National Summary sheet for all ${dataset.regions.length} regions.`);
  } else {
    console.log("\n(No National Summary sheet found; only --expect totals were checked.)");
  }
  m.psaPublishedTotals = expected;
  m.totalsMatch = ok;
  if (warnings.length) console.log(`\nParser notes (${warnings.length}):\n  ` + warnings.slice(0, 30).join("\n  "));
  return { dataset, warnings, ok, fileName: path.split(/[\\/]/).pop()! };
}

export function writeChanges(id: string, markdown: string, json: unknown) {
  const dir = resolve("changes");
  mkdirSync(dir, { recursive: true });
  for (const name of [id, "latest"]) {
    writeFileSync(join(dir, `${name}.md`), markdown + "\n");
    writeFileSync(join(dir, `${name}.json`), JSON.stringify(json, null, 2) + "\n");
  }
  return { md: join(dir, `${id}.md`), json: join(dir, `${id}.json`), latestMd: join(dir, "latest.md"), latestJson: join(dir, "latest.json") };
}

export function printWarnings(w: { severity: string; code: string; message: string }[]) {
  if (!w.length) { console.log("\nSanity checks: all passed."); return; }
  console.log("\nSanity checks:");
  for (const x of w) console.log(`  [${x.severity.toUpperCase()}] ${x.code}: ${x.message}`);
}

export async function run(main: () => Promise<void>) {
  loadEnv();
  const { closePools } = await import("../../src/lib/db/pool");
  try { await main(); } catch (e) {
    console.error(`\nError: ${(e as Error).message}`);
    process.exitCode = 1;
  } finally { await closePools(); }
}
