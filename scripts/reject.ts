#!/usr/bin/env tsx
/** Reject (discard) a pending staged release:  npm run reject -- --release <id> --yes [--note "why"] */
import { parseArgs, run } from "./lib/cli";

run(async () => {
  const args = parseArgs();
  const ops = await import("../src/lib/release/ops");
  const id = args.str("release") ?? (await ops.latestPendingId());
  if (!id) throw new Error("No pending release to reject.");
  if (args.flags.yes !== true) { console.log(`Would reject ${id}. Re-run with --yes to confirm.`); process.exitCode = 1; return; }
  await ops.reject(id, { actor: args.str("actor") ?? `cli:${process.env.USER ?? "unknown"}`, note: args.str("note") });
  console.log(`Rejected ${id}; its staged rows were discarded.`);
});
