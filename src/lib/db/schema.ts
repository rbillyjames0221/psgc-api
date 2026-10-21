/** SQL schema for the two databases. Applied idempotently by `npm run db:migrate`. */

const AREA_COLUMNS = `
  code                    char(10) NOT NULL,
  level                   text     NOT NULL,
  name                    text     NOT NULL,
  name_norm               text     NOT NULL,
  region_code             char(10),
  province_code           char(10),
  city_municipality_code  char(10),
  sub_municipality_code   char(10),
  data                    json     NOT NULL`;  // json (not jsonb) keeps field order in API responses

export const MAIN_SCHEMA = [
  `DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS pg_trgm; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pg_trgm not available: %', SQLERRM; END $$`,
  `CREATE TABLE IF NOT EXISTS areas (${AREA_COLUMNS}, PRIMARY KEY (code))`,
  `CREATE INDEX IF NOT EXISTS areas_level_idx ON areas (level, code)`,
  `CREATE INDEX IF NOT EXISTS areas_region_idx ON areas (region_code, level)`,
  `CREATE INDEX IF NOT EXISTS areas_province_idx ON areas (province_code, level)`,
  `CREATE INDEX IF NOT EXISTS areas_citymun_idx ON areas (city_municipality_code, level)`,
  `CREATE INDEX IF NOT EXISTS areas_submun_idx ON areas (sub_municipality_code)`,
  `DO $$ BEGIN CREATE INDEX IF NOT EXISTS areas_name_trgm_idx ON areas USING gin (name_norm gin_trgm_ops); EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'trigram index skipped: %', SQLERRM; END $$`,
  // Snapshot of the previous approved release, used by rollback.
  `CREATE TABLE IF NOT EXISTS areas_previous (${AREA_COLUMNS}, PRIMARY KEY (code))`,
  `CREATE TABLE IF NOT EXISTS release_current (
     slot int PRIMARY KEY CHECK (slot = 1), release_id text NOT NULL, version text NOT NULL,
     meta json NOT NULL, promoted_at timestamptz NOT NULL DEFAULT now(), promoted_by text)`,
  `CREATE TABLE IF NOT EXISTS release_previous (
     slot int PRIMARY KEY CHECK (slot = 1), release_id text NOT NULL, version text NOT NULL,
     meta json NOT NULL, promoted_at timestamptz NOT NULL, promoted_by text)`,
  `CREATE TABLE IF NOT EXISTS audit_log (
     id bigserial PRIMARY KEY, action text NOT NULL, release_id text, version text,
     counts jsonb, actor text, details jsonb, created_at timestamptz NOT NULL DEFAULT now())`,
];

export const STAGING_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS staged_releases (
     id text PRIMARY KEY,
     version text NOT NULL,
     status text NOT NULL CHECK (status IN ('pending','approved','rejected','superseded')),
     meta json NOT NULL,
     warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
     diff jsonb,
     diff_markdown text,
     base_release_id text,
     base_version text,
     source_file_name text,
     created_at timestamptz NOT NULL DEFAULT now(),
     decided_at timestamptz,
     decided_by text,
     decision_note text)`,
  `CREATE TABLE IF NOT EXISTS staged_areas (
     release_id text NOT NULL REFERENCES staged_releases(id) ON DELETE CASCADE,
     ${AREA_COLUMNS},
     PRIMARY KEY (release_id, code))`,
  `CREATE INDEX IF NOT EXISTS staged_areas_level_idx ON staged_areas (release_id, level)`,
];
