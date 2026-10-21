/**
 * Release lifecycle: stage -> diff -> (human approval) -> promote, plus reject and rollback.
 * Shared by the CLI scripts and the /admin review endpoints.
 */
import type { PoolClient } from "pg";
import { getPool, withTransaction } from "../db/pool";
import { MAIN_SCHEMA, STAGING_SCHEMA } from "../db/schema";
import { diffEntries, diffToMarkdown, type DiffEntry, type DiffResult } from "../psgc/diff";
import { runGuards, hasCritical, type GuardWarning } from "../psgc/guards";
import { attributesOf, datasetToRows, parentOf, type AreaLevel, type AreaRow } from "../psgc/rows";
import type { Dataset, Meta } from "../types";
import { reviewUrl } from "./token";

export interface MainRelease { releaseId: string; version: string; meta: Meta; promotedAt: string; promotedBy: string | null }
export interface StagedRelease {
  id: string; version: string; status: "pending" | "approved" | "rejected" | "superseded"; meta: Meta;
  warnings: GuardWarning[]; diff: DiffResult | null; diffMarkdown: string | null;
  baseReleaseId: string | null; baseVersion: string | null; sourceFileName: string | null;
  createdAt: string; decidedAt: string | null; decidedBy: string | null; decisionNote: string | null;
}

export async function migrate() {
  for (const sql of MAIN_SCHEMA) await getPool("main").query(sql);
  for (const sql of STAGING_SCHEMA) await getPool("staging").query(sql);
}

// ---------- reads ----------
export async function getMainRelease(): Promise<MainRelease | null> {
  const { rows } = await getPool("main").query(`SELECT release_id, version, meta, promoted_at, promoted_by FROM release_current WHERE slot = 1`);
  const r = rows[0];
  return r ? { releaseId: r.release_id, version: r.version, meta: r.meta, promotedAt: new Date(r.promoted_at).toISOString(), promotedBy: r.promoted_by } : null;
}

async function getPreviousRelease(): Promise<MainRelease | null> {
  const { rows } = await getPool("main").query(`SELECT release_id, version, meta, promoted_at, promoted_by FROM release_previous WHERE slot = 1`);
  const r = rows[0];
  return r ? { releaseId: r.release_id, version: r.version, meta: r.meta, promotedAt: new Date(r.promoted_at).toISOString(), promotedBy: r.promoted_by } : null;
}

const ENTRY_COLS = `code, level, name, region_code, province_code, city_municipality_code, sub_municipality_code,
  data->>'cityClass' AS city_class, data->>'incomeClass' AS income_class`;
type EntryRow = { code: string; level: AreaLevel; name: string; region_code: string | null; province_code: string | null;
  city_municipality_code: string | null; sub_municipality_code: string | null; city_class: string | null; income_class: string | null };
const toEntry = (r: EntryRow): DiffEntry => ({
  code: r.code, name: r.name, level: r.level, parent: parentOf(r),
  attrs: attributesOf(r.level, { cityClass: r.city_class, incomeClass: r.income_class }),
});

export async function loadMainEntries(): Promise<DiffEntry[]> {
  const { rows } = await getPool("main").query<EntryRow>(`SELECT ${ENTRY_COLS} FROM areas`);
  return rows.map(toEntry);
}
export async function loadStagedEntries(releaseId: string): Promise<DiffEntry[]> {
  const { rows } = await getPool("staging").query<EntryRow>(`SELECT ${ENTRY_COLS} FROM staged_areas WHERE release_id = $1`, [releaseId]);
  return rows.map(toEntry);
}

function mapStaged(r: Record<string, unknown>): StagedRelease {
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  return {
    id: r.id as string, version: r.version as string, status: r.status as StagedRelease["status"], meta: r.meta as Meta,
    warnings: (r.warnings as GuardWarning[]) ?? [], diff: (r.diff as DiffResult) ?? null, diffMarkdown: (r.diff_markdown as string) ?? null,
    baseReleaseId: (r.base_release_id as string) ?? null, baseVersion: (r.base_version as string) ?? null,
    sourceFileName: (r.source_file_name as string) ?? null, createdAt: iso(r.created_at)!, decidedAt: iso(r.decided_at),
    decidedBy: (r.decided_by as string) ?? null, decisionNote: (r.decision_note as string) ?? null,
  };
}

export async function getStagedRelease(id: string): Promise<StagedRelease | null> {
  const { rows } = await getPool("staging").query(`SELECT * FROM staged_releases WHERE id = $1`, [id]);
  return rows[0] ? mapStaged(rows[0]) : null;
}
export async function listStagedReleases(limit = 20): Promise<StagedRelease[]> {
  const { rows } = await getPool("staging").query(
    `SELECT id, version, status, meta, warnings, base_release_id, base_version, source_file_name, created_at, decided_at, decided_by, decision_note,
            NULL::jsonb AS diff, NULL::text AS diff_markdown
     FROM staged_releases ORDER BY created_at DESC LIMIT $1`, [limit]);
  return rows.map(mapStaged);
}
export async function latestPendingId(): Promise<string | null> {
  const { rows } = await getPool("staging").query(`SELECT id FROM staged_releases WHERE status = 'pending' ORDER BY created_at DESC LIMIT 1`);
  return rows[0]?.id ?? null;
}
export async function listAudit(limit = 20) {
  const { rows } = await getPool("main").query(`SELECT id, action, release_id, version, counts, actor, details, created_at FROM audit_log ORDER BY id DESC LIMIT $1`, [limit]);
  return rows;
}

// ---------- writes ----------
const BATCH = 2000;
async function insertAreas(client: PoolClient, table: "areas" | "staged_areas", rows: AreaRow[], releaseId?: string) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const b = rows.slice(i, i + BATCH);
    const cols = [b.map((r) => r.code), b.map((r) => r.level), b.map((r) => r.name), b.map((r) => r.name_norm),
      b.map((r) => r.region_code), b.map((r) => r.province_code), b.map((r) => r.city_municipality_code),
      b.map((r) => r.sub_municipality_code), b.map((r) => JSON.stringify(r.data))];
    if (table === "staged_areas") {
      await client.query(
        `INSERT INTO staged_areas (release_id, code, level, name, name_norm, region_code, province_code, city_municipality_code, sub_municipality_code, data)
         SELECT $1, * FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[], $10::json[])`,
        [releaseId, ...cols]);
    } else {
      await client.query(
        `INSERT INTO areas (code, level, name, name_norm, region_code, province_code, city_municipality_code, sub_municipality_code, data)
         SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::json[])`, cols);
    }
  }
}

function newReleaseId(version: string) {
  return `${version}-${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}`;
}

/** Writes a parsed dataset to STAGING only, computes the diff vs main and runs sanity guards. */
export async function stageDataset(ds: Dataset, parseWarnings: string[], sourceFileName: string) {
  const releaseId = newReleaseId(ds.meta.version);
  const rows = datasetToRows(ds);
  const main = await getMainRelease();
  const mainEntries = main ? await loadMainEntries() : [];
  const meta: Meta & { releaseId: string; parseWarnings: string[] } = { ...ds.meta, releaseId, parseWarnings };
  const diff = diffEntries(mainEntries, rows.map((r) => ({ code: r.code, name: r.name, level: r.level, parent: parentOf(r),
    attrs: attributesOf(r.level, r.data as unknown as Record<string, unknown>) })), main ? { version: main.version, counts: main.meta.counts, releaseId: main.releaseId } : null, meta);
  const warnings = runGuards({ counts: ds.meta.counts, totalsMatch: ds.meta.totalsMatch, parseWarnings, diff, mainVersion: main?.version ?? null, newVersion: ds.meta.version });
  const markdown = diffToMarkdown(diff, { reviewUrl: safeReviewUrl(releaseId), warnings });

  await withTransaction("staging", async (c) => {
    // Only one pending release at a time: older pending ones are superseded and their rows discarded.
    const old = await c.query(`UPDATE staged_releases SET status = 'superseded', decided_at = now(), decided_by = 'system'
                               WHERE status = 'pending' RETURNING id`);
    if (old.rowCount) await c.query(`DELETE FROM staged_areas WHERE release_id = ANY($1)`, [old.rows.map((r) => r.id)]);
    await c.query(
      `INSERT INTO staged_releases (id, version, status, meta, warnings, diff, diff_markdown, base_release_id, base_version, source_file_name)
       VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, $8, $9)`,
      [releaseId, ds.meta.version, JSON.stringify(meta), JSON.stringify(warnings), JSON.stringify(diff), markdown,
        main?.releaseId ?? null, main?.version ?? null, sourceFileName]);
    await insertAreas(c, "staged_areas", rows, releaseId);
  });
  return { releaseId, diff, warnings, markdown, reviewUrl: safeReviewUrl(releaseId) };
}

function safeReviewUrl(id: string) {
  try { return reviewUrl(id); } catch { return undefined; }
}

/** Recompute the diff of a staged release against the CURRENT main and store it. */
export async function refreshDiff(releaseId: string) {
  const rel = await getStagedRelease(releaseId);
  if (!rel) throw new Error(`Staged release ${releaseId} not found`);
  const main = await getMainRelease();
  const [mainEntries, stagedEntries] = await Promise.all([main ? loadMainEntries() : Promise.resolve([]), loadStagedEntries(releaseId)]);
  if (!stagedEntries.length) throw new Error(`Staged release ${releaseId} has no rows (status ${rel.status}).`);
  const diff = diffEntries(mainEntries, stagedEntries, main ? { version: main.version, counts: main.meta.counts, releaseId: main.releaseId } : null, { ...rel.meta, releaseId });
  const parseWarnings = (rel.meta as Meta & { parseWarnings?: string[] }).parseWarnings ?? [];
  const warnings = runGuards({ counts: rel.meta.counts, totalsMatch: rel.meta.totalsMatch, parseWarnings, diff, mainVersion: main?.version ?? null, newVersion: rel.version });
  const url = rel.status === "pending" ? safeReviewUrl(releaseId) : undefined;
  const markdown = diffToMarkdown(diff, { reviewUrl: url, warnings });
  await getPool("staging").query(
    `UPDATE staged_releases SET diff = $2, diff_markdown = $3, warnings = $4, base_release_id = $5, base_version = $6 WHERE id = $1`,
    [releaseId, JSON.stringify(diff), markdown, JSON.stringify(warnings), main?.releaseId ?? null, main?.version ?? null]);
  return { release: rel, diff, warnings, markdown, reviewUrl: url };
}

export class ReleaseError extends Error { constructor(public status: number, message: string) { super(message); } }

/**
 * Promote a pending staged release into MAIN in a single transaction:
 * snapshot current main -> previous, replace areas, set release_current, write audit row.
 */
export async function promote(releaseId: string, opts: { actor: string; acknowledgeWarnings?: boolean; allowStaleBase?: boolean }) {
  const rel = await getStagedRelease(releaseId);
  if (!rel) throw new ReleaseError(404, `Staged release ${releaseId} not found`);
  if (rel.status !== "pending") throw new ReleaseError(409, `Release ${releaseId} is ${rel.status}, not pending`);
  if (hasCritical(rel.warnings) && !opts.acknowledgeWarnings)
    throw new ReleaseError(422, `Release has critical sanity warnings; explicit acknowledgement is required: ${[...new Set(rel.warnings.filter((w) => w.severity === "critical").map((w) => w.code))].join(", ")}`);
  const main = await getMainRelease();
  if ((main?.releaseId ?? null) !== rel.baseReleaseId && !opts.allowStaleBase)
    throw new ReleaseError(409, `Main changed since this diff was computed (diff base ${rel.baseReleaseId ?? "empty"}, main is ${main?.releaseId ?? "empty"}). Re-run the diff and review again.`);

  const { rows } = await getPool("staging").query<AreaRow>(
    `SELECT code, level, name, name_norm, region_code, province_code, city_municipality_code, sub_municipality_code, data FROM staged_areas WHERE release_id = $1`, [releaseId]);
  if (rows.length === 0) throw new ReleaseError(409, `Staged release ${releaseId} has no rows`);
  const c0 = rel.meta.counts;
  const expected = c0.regions + c0.provinces + c0.cities + c0.municipalities + c0.subMunicipalities + c0.barangays;
  if (rows.length < expected) throw new ReleaseError(409, `Staged rows (${rows.length}) are fewer than the release counts (${expected}); refusing to promote.`);

  await withTransaction("main", async (c) => {
    await c.query(`LOCK TABLE areas, areas_previous, release_current, release_previous IN EXCLUSIVE MODE`);
    await c.query(`DELETE FROM areas_previous`);
    await c.query(`INSERT INTO areas_previous SELECT * FROM areas`);
    await c.query(`DELETE FROM release_previous`);
    await c.query(`INSERT INTO release_previous SELECT * FROM release_current`);
    await c.query(`DELETE FROM areas`);
    await insertAreas(c, "areas", rows);
    await c.query(
      `INSERT INTO release_current (slot, release_id, version, meta, promoted_at, promoted_by) VALUES (1, $1, $2, $3, now(), $4)
       ON CONFLICT (slot) DO UPDATE SET release_id = EXCLUDED.release_id, version = EXCLUDED.version, meta = EXCLUDED.meta,
         promoted_at = EXCLUDED.promoted_at, promoted_by = EXCLUDED.promoted_by`,
      [releaseId, rel.version, JSON.stringify(rel.meta), opts.actor]);
    await c.query(
      `INSERT INTO audit_log (action, release_id, version, counts, actor, details) VALUES ('approve', $1, $2, $3, $4, $5)`,
      [releaseId, rel.version, JSON.stringify(rel.meta.counts), opts.actor,
        JSON.stringify({ previousReleaseId: main?.releaseId ?? null, summary: rel.diff?.summary ?? null, acknowledgedWarnings: rel.warnings.filter((w) => w.severity !== "info").map((w) => w.code), rows: rows.length })]);
  });

  await withTransaction("staging", async (c) => {
    await c.query(`UPDATE staged_releases SET status = 'approved', decided_at = now(), decided_by = $2 WHERE id = $1`, [releaseId, opts.actor]);
    // Keep only the latest approved release's rows in staging (it mirrors main).
    await c.query(`DELETE FROM staged_areas WHERE release_id IN (SELECT id FROM staged_releases WHERE status <> 'pending' AND id <> $1)`, [releaseId]);
  });
  return { releaseId, version: rel.version, rows: rows.length, previousReleaseId: main?.releaseId ?? null };
}

export async function reject(releaseId: string, opts: { actor: string; note?: string }) {
  const rel = await getStagedRelease(releaseId);
  if (!rel) throw new ReleaseError(404, `Staged release ${releaseId} not found`);
  if (rel.status !== "pending") throw new ReleaseError(409, `Release ${releaseId} is ${rel.status}, not pending`);
  await withTransaction("staging", async (c) => {
    await c.query(`UPDATE staged_releases SET status = 'rejected', decided_at = now(), decided_by = $2, decision_note = $3 WHERE id = $1`, [releaseId, opts.actor, opts.note ?? null]);
    await c.query(`DELETE FROM staged_areas WHERE release_id = $1`, [releaseId]);
  });
  await getPool("main").query(`INSERT INTO audit_log (action, release_id, version, counts, actor, details) VALUES ('reject', $1, $2, $3, $4, $5)`,
    [releaseId, rel.version, JSON.stringify(rel.meta.counts), opts.actor, JSON.stringify({ note: opts.note ?? null })]);
  return { releaseId, status: "rejected" as const };
}

/** Swap main with the previous snapshot (so a rollback can itself be rolled back). */
export async function rollback(opts: { actor: string }) {
  const [cur, prev] = await Promise.all([getMainRelease(), getPreviousRelease()]);
  if (!prev) throw new ReleaseError(409, "No previous snapshot to roll back to.");
  await withTransaction("main", async (c) => {
    await c.query(`LOCK TABLE areas, areas_previous, release_current, release_previous IN EXCLUSIVE MODE`);
    await c.query(`CREATE TEMP TABLE swap_areas ON COMMIT DROP AS SELECT * FROM areas`);
    await c.query(`CREATE TEMP TABLE swap_release ON COMMIT DROP AS SELECT * FROM release_current`);
    await c.query(`DELETE FROM areas`);
    await c.query(`INSERT INTO areas SELECT * FROM areas_previous`);
    await c.query(`DELETE FROM areas_previous`);
    await c.query(`INSERT INTO areas_previous SELECT * FROM swap_areas`);
    await c.query(`DELETE FROM release_current`);
    await c.query(`INSERT INTO release_current SELECT * FROM release_previous`);
    await c.query(`DELETE FROM release_previous`);
    await c.query(`INSERT INTO release_previous SELECT * FROM swap_release`);
    await c.query(`INSERT INTO audit_log (action, release_id, version, counts, actor, details) VALUES ('rollback', $1, $2, $3, $4, $5)`,
      [prev.releaseId, prev.version, JSON.stringify(prev.meta.counts), opts.actor, JSON.stringify({ from: cur?.releaseId ?? null, to: prev.releaseId })]);
  });
  return { from: cur?.releaseId ?? null, to: prev.releaseId, version: prev.version };
}
