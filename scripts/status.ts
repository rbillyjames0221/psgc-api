#!/usr/bin/env tsx
/** Show the release in MAIN, staged releases, and the audit log:  npm run status */
import { run } from "./lib/cli";

run(async () => {
  const ops = await import("../src/lib/release/ops");
  const main = await ops.getMainRelease();
  console.log(`MAIN: ${main ? `${main.releaseId} (${main.version}) promoted ${main.promotedAt} by ${main.promotedBy}` : "(empty)"}`);
  if (main) console.log(`      counts ${JSON.stringify(main.meta.counts)}`);
  console.log("\nSTAGING releases:");
  for (const r of await ops.listStagedReleases(10))
    console.log(`  ${r.id.padEnd(30)} ${r.status.padEnd(10)} ${r.createdAt}  warnings: ${r.warnings.filter((w) => w.severity !== "info").length}`);
  console.log("\nAudit log:");
  for (const a of await ops.listAudit(10)) console.log(`  #${a.id} ${new Date(a.created_at).toISOString()} ${a.action.padEnd(8)} ${a.release_id} by ${a.actor}`);
});
