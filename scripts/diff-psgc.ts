#!/usr/bin/env tsx
/**
 * Diff a staged release (default: the latest pending one) against MAIN, store the result, and print a
 * clean change summary (markdown or JSON) plus the signed review URL for the approval email.
 *
 *   npm run diff                                  # latest pending staged release vs main (markdown)
 *   npm run diff -- --release <id> [--format json] [--out file]
 *   npm run diff -- --file new.xlsx               # preview a file vs main without staging it
 */
import { writeFileSync } from "node:fs";
import { parseAndVerify, parseArgs, run, writeChanges } from "./lib/cli";

run(async () => {
  const args = parseArgs();
  const ops = await import("../src/lib/release/ops");
  const { diffEntries, diffToMarkdown } = await import("../src/lib/psgc/diff");
  const { runGuards } = await import("../src/lib/psgc/guards");
  const { datasetToRows, parentOf, attributesOf } = await import("../src/lib/psgc/rows");
  const format = args.str("format") === "json" ? "json" : "md";
  let markdown: string, json: unknown, id: string;

  if (args.str("file")) {
    const { dataset, warnings } = parseAndVerify(args.str("file")!, args);
    const main = await ops.getMainRelease();
    const base = main ? await ops.loadMainEntries() : [];
    const next = datasetToRows(dataset).map((r) => ({ code: r.code, name: r.name, level: r.level, parent: parentOf(r), attrs: attributesOf(r.level, r.data as unknown as Record<string, unknown>) }));
    const diff = diffEntries(base, next, main ? { version: main.version, counts: main.meta.counts, releaseId: main.releaseId } : null, dataset.meta);
    const guards = runGuards({ counts: dataset.meta.counts, totalsMatch: dataset.meta.totalsMatch, parseWarnings: warnings, diff, mainVersion: main?.version ?? null, newVersion: dataset.meta.version });
    markdown = diffToMarkdown(diff, { warnings: guards }).replace("awaiting approval", "preview (not staged)");
    json = { releaseId: null, reviewUrl: null, warnings: guards, diff };
    id = `preview-${dataset.meta.version}`;
  } else {
    const releaseId = args.str("release") ?? (await ops.latestPendingId());
    if (!releaseId) throw new Error("No pending staged release. Stage one with: npm run stage -- <file.xlsx>");
    const r = await ops.refreshDiff(releaseId);
    markdown = r.markdown;
    json = { releaseId, status: r.release.status, reviewUrl: r.reviewUrl ?? null, warnings: r.warnings, diff: r.diff };
    id = releaseId;
  }
  const files = writeChanges(id, markdown, json);
  const out = format === "json" ? JSON.stringify(json, null, 2) : markdown;
  if (args.str("out")) writeFileSync(args.str("out")!, out + "\n");
  console.log(out);
  console.error(`\nSaved: ${files.md} and ${files.json} (also changes/latest.md, changes/latest.json)`);
  const url = (json as { reviewUrl: string | null }).reviewUrl;
  if (url) console.error(`REVIEW_URL=${url}`);
});
