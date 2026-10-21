import "server-only";
import { getPool } from "./db/pool";
import { normalize, type AreaLevel } from "./psgc/rows";
import type { Meta } from "./types";

/**
 * Public read layer. Reads ONLY from the MAIN database (approved releases).
 * Staging is never touched here.
 */

export type PublicMeta = Omit<Meta, "psaPublishedTotals"> & { releaseId: string; promotedAt: string; psaPublishedTotals?: Meta["psaPublishedTotals"] };

let metaCache: { at: number; value: PublicMeta | null } | null = null;
export async function getMeta(): Promise<PublicMeta | null> {
  if (metaCache && Date.now() - metaCache.at < 30_000) return metaCache.value;
  const { rows } = await getPool("main").query(`SELECT release_id, meta, promoted_at FROM release_current WHERE slot = 1`);
  let value: PublicMeta | null = null;
  if (rows[0]) {
    const { parseWarnings: _pw, releaseId: _rid, ...meta } = rows[0].meta as Meta & { parseWarnings?: string[]; releaseId?: string };
    void _pw; void _rid;
    value = { ...meta, releaseId: rows[0].release_id, promotedAt: new Date(rows[0].promoted_at).toISOString() };
  }
  metaCache = { at: Date.now(), value };
  return value;
}

export interface AreaQuery {
  levels: AreaLevel[];
  region?: string | null;
  province?: string | null; // "none" = not under any province
  cityMunicipality?: string | null;
  subMunicipality?: string | null;
  cityClass?: string | null;
  urbanRural?: "U" | "R" | null;
  name?: string | null;
  page: number;
  limit: number;
}

export async function queryAreas<T = Record<string, unknown>>(q: AreaQuery): Promise<{ items: T[]; total: number }> {
  const where: string[] = ["level = ANY($1)"];
  const params: unknown[] = [q.levels];
  const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replace("?", `$${params.length}`)); };
  if (q.region) add("region_code = ?", q.region);
  if (q.province === "none") where.push("province_code IS NULL");
  else if (q.province) add("province_code = ?", q.province);
  if (q.cityMunicipality) add("city_municipality_code = ?", q.cityMunicipality);
  if (q.subMunicipality) add("sub_municipality_code = ?", q.subMunicipality);
  if (q.cityClass) add("data->>'cityClass' = ?", q.cityClass);
  if (q.urbanRural) add("data->>'urbanRural' = ?", q.urbanRural);
  if (q.name) add("name_norm LIKE ?", `%${normalize(q.name)}%`);
  params.push(q.limit, (q.page - 1) * q.limit);
  const sql = `SELECT data, count(*) OVER() AS total FROM areas WHERE ${where.join(" AND ")}
               ORDER BY code LIMIT $${params.length - 1} OFFSET $${params.length}`;
  const { rows } = await getPool("main").query(sql, params);
  let total = rows.length ? Number(rows[0].total) : 0;
  if (!rows.length && q.page > 1) {
    const c = await getPool("main").query(`SELECT count(*) FROM areas WHERE ${where.join(" AND ")}`, params.slice(0, -2));
    total = Number(c.rows[0].count);
  }
  return { items: rows.map((r) => r.data as T), total };
}

export async function getArea(code: string, levels?: AreaLevel[]) {
  const { rows } = await getPool("main").query(
    `SELECT code, level, data, region_code, province_code, city_municipality_code, sub_municipality_code FROM areas
     WHERE code = $1 ${levels ? "AND level = ANY($2)" : ""}`, levels ? [code, levels] : [code]);
  return rows[0] as { code: string; level: AreaLevel; data: Record<string, unknown>; region_code: string | null; province_code: string | null; city_municipality_code: string | null; sub_municipality_code: string | null } | undefined;
}

type Ancestry = {
  region: { code: string; name: string } | null;
  province: { code: string; name: string } | null;
  cityMunicipality: { code: string; name: string; type: string; cityClass: string | null } | null;
  subMunicipality: { code: string; name: string } | null;
};

async function ancestryFor(rows: { region_code: string | null; province_code: string | null; city_municipality_code: string | null; sub_municipality_code: string | null }[]) {
  const codes = new Set<string>();
  for (const r of rows) for (const c of [r.region_code, r.province_code, r.city_municipality_code, r.sub_municipality_code]) if (c) codes.add(c);
  const map = new Map<string, { code: string; name: string; data: Record<string, unknown> }>();
  if (codes.size) {
    const { rows: anc } = await getPool("main").query(`SELECT code, name, data FROM areas WHERE code = ANY($1)`, [[...codes]]);
    for (const a of anc) map.set(a.code, a);
  }
  return (r: (typeof rows)[number]): Ancestry => {
    const g = (c: string | null) => (c && map.get(c) ? { code: c, name: map.get(c)!.name } : null);
    const cm = r.city_municipality_code ? map.get(r.city_municipality_code) : null;
    return {
      region: g(r.region_code),
      province: g(r.province_code),
      cityMunicipality: cm ? { code: cm.code, name: cm.name, type: String(cm.data.type), cityClass: (cm.data.cityClass as string) ?? null } : null,
      subMunicipality: g(r.sub_municipality_code),
    };
  };
}

const fullName = (name: string, a: Ancestry) =>
  [name, a.subMunicipality?.name, a.cityMunicipality?.name, a.province?.name, a.region?.name].filter((x, i, arr) => x && arr.indexOf(x) === i).join(", ");

/** Any code with its full ancestry. Accepts 10-digit PSGC or 9-digit correspondence codes. */
export async function lookupCode(code: string) {
  let row = await getArea(code.length === 10 ? code : "");
  if (!row && code.length === 9) {
    const { rows } = await getPool("main").query(`SELECT code FROM areas WHERE data->>'correspondenceCode' = $1 LIMIT 1`, [code]);
    if (rows[0]) row = await getArea(rows[0].code);
  }
  if (!row) return null;
  // Cities/municipalities and provinces carry no city_municipality_code of their own
  const anc = await (await ancestryFor([row]))(row);
  return { level: row.level, data: row.data, ancestry: anc, fullName: fullName(String(row.data.name), anc) };
}

const SEARCH_LEVEL_RANK = `CASE level WHEN 'region' THEN 0 WHEN 'province' THEN 1 WHEN 'city' THEN 2 WHEN 'municipality' THEN 2 WHEN 'sub-municipality' THEN 3 ELSE 4 END`;

export async function search(q: string, opts: { limit: number; levels: AreaLevel[]; region?: string | null; province?: string | null }) {
  const nq = normalize(q);
  if (!nq) return { total: 0, results: [] };
  const params: unknown[] = [nq, opts.levels, opts.limit];
  const extra: string[] = [];
  if (opts.region) { params.push(opts.region); extra.push(`AND (region_code = $${params.length} OR code = $${params.length})`); }
  if (opts.province) { params.push(opts.province); extra.push(`AND (province_code = $${params.length} OR code = $${params.length})`); }
  const sql = `
    WITH m AS (
      SELECT code, level, name, data, region_code, province_code, city_municipality_code, sub_municipality_code,
        regexp_replace(regexp_replace(name_norm, '^city of ', ''), ' city$', '') AS bare, name_norm
      FROM areas
      WHERE level = ANY($2) AND name_norm LIKE '%' || $1 || '%' ${extra.join(" ")}
    )
    SELECT *, count(*) OVER() AS total,
      CASE WHEN name_norm = $1 OR bare = $1 THEN 0
           WHEN name_norm LIKE $1 || '%' OR bare LIKE $1 || '%' THEN 1
           WHEN (' ' || name_norm) LIKE '% ' || $1 || '%' THEN 2 ELSE 3 END AS score
    FROM m ORDER BY score, ${SEARCH_LEVEL_RANK}, length(name), name LIMIT $3`;
  const { rows } = await getPool("main").query(sql, params);
  const anc = await ancestryFor(rows);
  return {
    total: rows.length ? Number(rows[0].total) : 0,
    results: rows.map((r) => {
      const a = anc(r);
      return { code: r.code, name: r.name, level: r.level as AreaLevel, fullName: fullName(r.name, a), ancestry: a };
    }),
  };
}
