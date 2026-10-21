#!/usr/bin/env tsx
/**
 * Promote an approved staged release into MAIN (single transaction, previous main kept for rollback).
 *   npm run promote -- --release <id> --yes [--acknowledge-warnings] [--allow-stale-base] [--actor "name"]
 */
import { parseArgs, printWarnings, run } from "./lib/cli";

run(async () => {
  const args = parseArgs();
  const ops = await import("../src/lib/release/ops");
  const id = args.str("release");
  if (!id) throw new Error("Usage: npm run promote -- --release <id> --yes   (see pending releases with: npm run status)");
  const rel = await ops.getStagedRelease(id);
  if (!rel) throw new Error(`Staged release ${id} not found`);
  console.log(`Release ${rel.id} [${rel.status}] ${rel.meta.releaseName}`);
  if (rel.diff) { const s = rel.diff.summary; console.log(`Diff vs ${rel.baseVersion ?? "empty"}: +${s.added} -${s.removed} ~${s.renamed} renamed, ${s.reparented} re-parented, ${s.reclassified} reclassified`); }
  printWarnings(rel.warnings);
  if (args.flags.yes !== true) {
    console.log("\nNot promoted. Re-run with --yes to confirm you approve this release for the public API.");
    process.exitCode = 1;
    return;
  }
  const res = await ops.promote(id, { actor: args.str("actor") ?? `cli:${process.env.USER ?? "unknown"}`,
    acknowledgeWarnings: args.flags["acknowledge-warnings"] === true, allowStaleBase: args.flags["allow-stale-base"] === true });
  console.log(`\nPromoted ${res.releaseId} to MAIN (${res.rows} rows). Previous release ${res.previousReleaseId ?? "(none)"} kept for rollback.`);
});
