import { Pool, type PoolClient } from "pg";

/**
 * Two separate Postgres databases:
 *  - main:    the ONLY database the public API reads from (approved releases).
 *  - staging: every new PSA import lands here first and waits for approval.
 */
export type DbName = "main" | "staging";

const ENV: Record<DbName, string> = { main: "DATABASE_URL_MAIN", staging: "DATABASE_URL_STAGING" };

const g = globalThis as unknown as { __psgcPools?: Partial<Record<DbName, Pool>> };
g.__psgcPools ??= {};

export function hasDb(name: DbName) {
  return Boolean(process.env[ENV[name]]);
}

export function getPool(name: DbName): Pool {
  const existing = g.__psgcPools![name];
  if (existing) return existing;
  const url = process.env[ENV[name]];
  if (!url) throw new Error(`${ENV[name]} is not set. Copy .env.example to .env.local and fill in your connection strings.`);
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.PG_POOL_MAX ?? 5),
    ssl: isLocal || /sslmode=disable/.test(url) ? undefined : { rejectUnauthorized: true },
    idleTimeoutMillis: 30_000,
  });
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
