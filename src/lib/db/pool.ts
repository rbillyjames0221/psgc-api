import { Pool, type PoolClient } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

/**
 * Two separate Postgres databases:
 *  - main:    the ONLY database the public API reads from (approved releases).
 *  - staging: every new PSA import lands here first and waits for approval.
 */
export type DbName = "main" | "staging";

const ENV: Record<DbName, string> = { main: "DATABASE_URL_MAIN", staging: "DATABASE_URL_STAGING" };
/** Fallbacks: the pooled URLs the Vercel Neon integration injects (resources created with prefixes PSGC_MAIN_ / PSGC_STAGING_). */
const FALLBACK: Record<DbName, string> = { main: "PSGC_MAIN_DATABASE_URL", staging: "PSGC_STAGING_DATABASE_URL" };
const urlFor = (name: DbName) => process.env[ENV[name]] || process.env[FALLBACK[name]];

const g = globalThis as unknown as { __psgcPools?: Partial<Record<DbName, Pool>> };
g.__psgcPools ??= {};

export function hasDb(name: DbName) {
  return Boolean(urlFor(name));
}

export function getPool(name: DbName): Pool {
  const existing = g.__psgcPools![name];
  if (existing) return existing;
  const url = urlFor(name);
  if (!url) throw new Error(`${ENV[name]} is not set. Copy .env.example to .env.local and fill in your connection strings.`);
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  // PSGC_DB_DRIVER=neon-ws: tunnel Postgres over WebSockets (port 443) for machines where outbound
  // port 5432 is blocked (e.g. the CLI box). Production on Vercel uses plain `pg` over TCP.
  if (process.env.PSGC_DB_DRIVER === "neon-ws") {
    neonConfig.webSocketConstructor = ws;
    const neonPool = new NeonPool({ connectionString: url, max: Number(process.env.PG_POOL_MAX ?? 5) }) as unknown as Pool;
    g.__psgcPools![name] = neonPool;
    return neonPool;
  }
  const pool = new Pool({
    connectionString: url,
    // Use Neon's pooled (-pooler, PgBouncer) URL. Keep per-instance pools small on serverless.
    max: Number(process.env.PG_POOL_MAX ?? (process.env.VERCEL ? 3 : 5)),
    ssl: isLocal || /sslmode=disable/.test(url) ? undefined : { rejectUnauthorized: true },
    idleTimeoutMillis: 30_000,
  });
  // On Vercel Fluid compute, lets idle clients be released before an instance is suspended.
  if (process.env.VERCEL) attachDatabasePool(pool);
  g.__psgcPools![name] = pool;
  return pool;
}

export async function withTransaction<T>(name: DbName, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool(name).connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function closePools() {
  await Promise.all(Object.values(g.__psgcPools ?? {}).map((p) => p?.end()));
  g.__psgcPools = {};
}
