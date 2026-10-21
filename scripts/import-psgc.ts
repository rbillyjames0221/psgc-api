#!/usr/bin/env tsx
/**
 * STAGE a PSA PSGC Publication Datafile (.xlsx). Writes to the STAGING database only.
 * The public API keeps serving MAIN until the staged release is approved.
 *
 *   npm run stage -- <file.xlsx> [--release-name "..."] [--release-date YYYY-MM-DD] [--reference-no 2026-331]
 *                    [--source-file URL] [--source-page URL] [--quarter 3 --year 2026] [--expect k=v,...] [--dry-run]
 *   (npm run import is an alias)
 */
import { parseAndVerify, parseArgs, printWarnings, run, writeChanges } from "./lib/cli";

run(async () => {
  const args = parseArgs();
  const file = args.positional[0];
  if (!file) throw new Error("Usage: npm run stage -- <path-to-PSGC-Publication-Datafile.xlsx> [--release-name ...] [--release-date YYYY-MM-DD] [--dry-run]");
  const { dataset, warnings, ok, fileName } = parseAndVerify(file, args);
  if (args.flags["dry-run"]) { console.log(`\nDry run: ${ok ? "all totals match" : "TOTALS MISMATCH"}. Nothing written.`); return; }

  const { stageDataset } = await import("../src/lib/release/ops");
  const res = await stageDataset(dataset, warnings, fileName);
  const files = writeChanges(res.releaseId, res.markdown, { releaseId: res.releaseId, reviewUrl: res.reviewUrl ?? null, warnings: res.warnings, diff: res.diff });
  printWarnings(res.warnings);
  const s = res.diff.summary;
  console.log(`\nStaged release ${res.releaseId} (status: pending) in the STAGING database.`);
  console.log(`Diff vs main (${res.diff.baseVersion ?? "empty"}): +${s.added} added, -${s.removed} removed, ${s.renamed} renamed, ${s.reparented} re-parented, ${s.reclassified} reclassified.`);
  console.log(`Change summary: ${files.md} (and ${files.json}); latest copies in changes/latest.{md,json}`);
  console.log(`\nREVIEW_URL=${res.reviewUrl ?? "(set ADMIN_SECRET and PUBLIC_BASE_URL to generate)"}`);
  console.log(`RELEASE_ID=${res.releaseId}`);
});
