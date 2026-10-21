#!/usr/bin/env tsx
/**
 * Seed both databases with an initial approved baseline (e.g. the 3Q 2026 release):
 *   npm run db:seed -- <file.xlsx> [release flags] [--force]
 * Runs migrate, stages the file, and promotes it as the baseline (audit actor "seed").
 * Refuses if main already has a release unless --force.
 */
import { parseAndVerify, parseArgs, printWarnings, run } from "./lib/cli";

run(async () => {
  const args = parseArgs();
  const file = args.positional[0];
  if (!file) throw new Error("Usage: npm run db:seed -- <file.xlsx> [--release-name ...] [--release-date ...] [--force]");
  const ops = await import("../src/lib/release/ops");
  await ops.migrate();
  const existing = await ops.getMainRelease();
  if (existing && args.flags.force !== true) throw new Error(`Main already has ${existing.releaseId}. Use npm run stage for updates (or --force to re-seed).`);
  const { dataset, warnings, ok, fileName } = parseAndVerify(file, args);
  if (!ok) throw new Error("Counts do not match PSA totals; refusing to seed.");
  const staged = await ops.stageDataset(dataset, warnings, fileName);
  printWarnings(staged.warnings);
  const r = await ops.promote(staged.releaseId, { actor: "seed (initial approved baseline)", acknowledgeWarnings: false });
  console.log(`\nSeeded: ${r.releaseId} is live in MAIN (${r.rows} rows); STAGING holds the same approved release.`);
});
