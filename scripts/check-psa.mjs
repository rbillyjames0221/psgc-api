#!/usr/bin/env node
/**
 * Check psa.gov.ph for a PSGC release newer than the one currently live, and download its
 * Publication Datafile if possible. Never fails loudly: if Cloudflare (or anything else) blocks
 * the request, it logs a warning and exits 0 with blocked=true.
 *
 *   node scripts/check-psa.mjs [--current 2026-Q3] [--download-dir downloads]
 *
 * Current version comes from --current, $CURRENT_VERSION, $PSGC_API_BASE_URL/api/v1/meta, or the newest file in seed/.
 * Outputs (GitHub Actions): blocked, has_new, version, release_name, file, url
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PAGE = "https://psa.gov.ph/classification/psgc";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const QUARTERS = { first: 1, second: 2, third: 3, fourth: 4 };
const args = process.argv.slice(2);
const arg = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };

function output(k, v) {
  console.log(`${k}=${v}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${String(v).replace(/\n/g, " ")}\n`);
}
function summary(md) { if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n"); }
const vkey = (v) => { const m = /^(\d{4})-Q(\d)$/.exec(v ?? ""); return m ? Number(m[1]) * 10 + Number(m[2]) : 0; };

async function currentVersion() {
  if (arg("current")) return arg("current");
  if (process.env.CURRENT_VERSION) return process.env.CURRENT_VERSION;
  if (process.env.PSGC_API_BASE_URL) {
    try {
      const r = await fetch(new URL("/api/v1/meta", process.env.PSGC_API_BASE_URL), { signal: AbortSignal.timeout(15000) });
      if (r.ok) return (await r.json()).data.version;
    } catch (e) { console.log(`Could not read live meta: ${e.message}`); }
  }
  if (existsSync("seed")) {
    const vs = readdirSync("seed").map((f) => /PSGC-(\d)Q-(\d{4})/i.exec(f)).filter(Boolean).map((m) => `${m[2]}-Q${m[1]}`);
    return vs.sort((a, b) => vkey(b) - vkey(a))[0] ?? null;
  }
  return null;
}

function blocked(reason) {
  console.log(`::warning title=PSA check blocked::${reason}. psa.gov.ph is behind a Cloudflare challenge; the browser-based weekly updater is the primary path.`);
  summary(`### PSA check: blocked\n\n${reason}.\n\npsa.gov.ph is protected by a Cloudflare challenge that usually blocks CI runners. This is expected; the primary updater is the external browser-based weekly check (see README).`);
  output("blocked", "true");
  output("has_new", "false");
}

const isChallenge = (status, body) =>
  [403, 429, 503].includes(status) || /Just a moment|cf-chl|challenge-platform|Attention Required|cf_chl_opt/i.test(body);

async function main() {
  const current = await currentVersion();
  console.log(`Current live version: ${current ?? "(unknown)"}`);
  let res, body;
  try {
    res = await fetch(PAGE, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(30000), redirect: "follow" });
    body = await res.text();
  } catch (e) { return blocked(`Request failed: ${e.message}`); }
  if (isChallenge(res.status, body)) return blocked(`HTTP ${res.status} Cloudflare challenge`);
  if (!res.ok) return blocked(`HTTP ${res.status}`);

  const files = [...body.matchAll(/href="([^"]*PSGC-(\d)Q-(\d{4})-Publication-Datafile[^"]*\.xlsx)"/gi)]
    .map((m) => ({ url: new URL(m[1], PAGE).toString(), version: `${m[3]}-Q${m[2]}` }));
  const titles = [...body.matchAll(/(First|Second|Third|Fourth) Quarter (\d{4}) PSGC Updates[^<"]*/gi)]
    .map((m) => ({ name: m[0].trim(), version: `${m[2]}-Q${QUARTERS[m[1].toLowerCase()]}` }));
  const newest = [...files].sort((a, b) => vkey(b.version) - vkey(a.version))[0];
  const newestTitle = [...titles].sort((a, b) => vkey(b.version) - vkey(a.version))[0];
  const latest = newest?.version ?? newestTitle?.version;
  console.log(`Latest on PSA page: ${latest ?? "(none found)"} ${newestTitle ? `- ${newestTitle.name}` : ""}`);
  output("blocked", "false");
  if (!latest) { summary("### PSA check\n\nPage fetched but no PSGC release links found (page layout may have changed)."); return output("has_new", "false"); }
  if (current && vkey(latest) <= vkey(current)) { summary(`### PSA check\n\nNo new release. Live: ${current}, PSA: ${latest}.`); return output("has_new", "false"); }

  output("has_new", "true");
  output("version", latest);
  output("release_name", newestTitle?.version === latest ? newestTitle.name : `PSGC ${latest} Updates`);
  if (!newest || newest.version !== latest) { summary(`### New PSGC release ${latest}\n\nRelease announced but no datafile link found yet.`); return output("file", ""); }
  output("url", newest.url);
  try {
    const dir = arg("download-dir") ?? "downloads";
    mkdirSync(dir, { recursive: true });
    const r = await fetch(newest.url, { headers: { "User-Agent": UA, Referer: PAGE }, signal: AbortSignal.timeout(60000) });
    const buf = Buffer.from(await r.arrayBuffer());
    if (!r.ok || buf.subarray(0, 2).toString() !== "PK") return blocked(`Datafile download returned HTTP ${r.status} (not an xlsx)`);
    const file = join(dir, newest.url.split("/").pop().split("?")[0]);
    writeFileSync(file, buf);
    output("file", file);
    summary(`### New PSGC release ${latest}\n\nDownloaded ${newest.url} (${buf.length} bytes).`);
  } catch (e) { blocked(`Datafile download failed: ${e.message}`); }
}

main().catch((e) => blocked(`Unexpected error: ${e.message}`));
