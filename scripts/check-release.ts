#!/usr/bin/env tsx
/**
 * Is a PSA release (as listed on psa.gov.ph) newer than what MAIN / STAGING already have?
 *
 *   npm run check:release -- --title "<release title>" --date YYYY-MM-DD [--json]
 *
 * Prints one of:
 *   STATUS=CURRENT         MAIN already serves this release (same title or same date), or MAIN's release is newer.
 *   STATUS=ALREADY_STAGED  A PENDING staged release matches; it is waiting for approval at /admin/review.
 *   STATUS=NEW             Neither has it. Download the xlsx and stage it (see ops/WEEKLY_CHECK.md).
 * Read-only: queries both databases, writes nothing. Exit code 0 unless the check itself fails.
 */
import { parseArgs, run } from "./lib/cli";

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[\u2013\u2014]/g, "-").replace(/\s+/g, " ").trim();
const day = (s: string | null | undefined) => (s ? s.slice(0, 10) : null);

run(async () => {
  const { str, flags } = parseArgs();
  const title = str("title");
  const date = str("date");
  if (!title || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error('Usage: npm run check:release -- --title "<release title>" --date YYYY-MM-DD [--json]');

  const ops = await import("../src/lib/release/ops");
  const main = await ops.getMainRelease();
  const staged = await ops.listStagedReleases(50);

  const mainDate = day(main?.meta.releaseDate);
  const same = (name: string | null | undefined, d: string | null) => norm(name) === norm(title) || (d !== null && d === date);

  let status: "NEW" | "ALREADY_STAGED" | "CURRENT";
  let detail: string;
  const pending = staged.find((r) => r.status === "pending" && same(r.meta.releaseName, day(r.meta.releaseDate)));
  if (main && same(main.meta.releaseName, mainDate)) {
    status = "CURRENT"; detail = `MAIN serves ${main.releaseId} ("${main.meta.releaseName}", released ${mainDate ?? "?"}).`;
  } else if (main && mainDate && mainDate > date) {
    status = "CURRENT"; detail = `MAIN's release (${mainDate}, ${main.releaseId}) is newer than ${date}.`;
  } else if (pending) {
    status = "ALREADY_STAGED"; detail = `Pending in STAGING as ${pending.id} (staged ${pending.createdAt}); approve or reject it at /admin/review.`;
  } else {
    status = "NEW";
    const rejected = staged.find((r) => r.status === "rejected" && same(r.meta.releaseName, day(r.meta.releaseDate)));
    detail = `Not in MAIN (${main ? `${main.releaseId}, released ${mainDate ?? "?"}` : "empty"}) and not pending in STAGING.`
      + (rejected ? ` Note: a matching release was previously REJECTED (${rejected.id}).` : "");
  }

  if (flags.json) console.log(JSON.stringify({ status, title, date, main: main?.releaseId ?? null, mainReleaseDate: mainDate, pending: pending?.id ?? null, detail }));
  else { console.log(`STATUS=${status}`); console.log(detail); }
});
