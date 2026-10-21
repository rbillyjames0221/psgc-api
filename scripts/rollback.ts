#!/usr/bin/env tsx
/** Restore MAIN to the previous snapshot (swaps current <-> previous):  npm run rollback -- --yes */
import { parseArgs, run } from "./lib/cli";

run(async () => {
  const args = parseArgs();
  const ops = await import("../src/lib/release/ops");
  const cur = await ops.getMainRelease();
  console.log(`Current main: ${cur?.releaseId ?? "(empty)"}`);
  if (args.flags.yes !== true) { console.log("Re-run with --yes to roll main back to the previous snapshot."); process.exitCode = 1; return; }
  const r = await ops.rollback({ actor: args.str("actor") ?? `cli:${process.env.USER ?? "unknown"}` });
  console.log(`Rolled back main: ${r.from} -> ${r.to} (${r.version}). Run again to undo.`);
});
