#!/usr/bin/env tsx
/** Create/upgrade tables in both databases:  npm run db:migrate */
import { run } from "./lib/cli";

run(async () => {
  const { migrate } = await import("../src/lib/release/ops");
  await migrate();
  console.log("Schema applied to MAIN (DATABASE_URL_MAIN) and STAGING (DATABASE_URL_STAGING).");
});
