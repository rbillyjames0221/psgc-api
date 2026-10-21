# Weekly PSA check: operator runbook

Use this when the weekly check (or a person) finds a new PSGC publication on
<https://psa.gov.ph/classification/psgc>. The public API keeps serving **MAIN** until someone approves the
new release at `/admin/review`. Every step below writes to **STAGING** only.

## 0. Environment (on the ops box)

Connection strings and secrets live in `/home/box/.config/psgc-api/.env` (mode 600).
`/workspace/psgc-api/.env.local` is a symlink to that file. It contains `DATABASE_URL_MAIN`, `DATABASE_URL_STAGING`
(the Neon production databases, pooled), `ADMIN_SECRET`, `PUBLIC_BASE_URL` and `PSGC_DB_DRIVER=neon-ws`.
The box can't reach port 5432, so the CLI talks to Neon over WebSockets on port 443.

The CLI loads `.env.local` **without overriding variables already set in your shell**. A stray export
(for example, an old local Postgres URL) would silently point the CLI at the wrong database. Always start with:

```bash
cd /workspace/psgc-api
unset DATABASE_URL_MAIN DATABASE_URL_STAGING PSGC_MAIN_DATABASE_URL PSGC_STAGING_DATABASE_URL PUBLIC_BASE_URL ADMIN_SECRET
npm run status        # should print MAIN: <current release> from Neon
```

Never print or paste the contents of the `.env` file.

## 1. Is the listed release actually new?

Copy the title and release date exactly as PSA lists them:

```bash
npm run check:release -- --title "Fourth Quarter 2026 PSGC Updates: ..." --date 2027-01-15
```

| Output | Meaning | Next step |
|---|---|---|
| `STATUS=CURRENT` | MAIN already serves it (same title or date), or MAIN's release is newer | Nothing to do |
| `STATUS=ALREADY_STAGED` | A **pending** staged release matches | Approve or reject at `/admin/review` (step 4) |
| `STATUS=NEW` | Not in MAIN and not pending | Continue to step 2 |

Add `--json` to get a single machine-readable line. The check is read-only.

## 2. Validate, then stage the downloaded xlsx

The file is the "PSGC Publication Datafile" (`PSGC-<n>Q-<yyyy>-Publication-Datafile.xlsx`), saved for example at
`~/Downloads/PSGC-4Q-2026-Publication-Datafile.xlsx`.

```bash
F=~/Downloads/PSGC-4Q-2026-Publication-Datafile.xlsx

# Dry run: parse and check totals against PSA's National Summary sheet. Writes nothing.
npm run stage -- "$F" --dry-run \
  --release-name "Fourth Quarter 2026 PSGC Updates: ..." --release-date 2027-01-15 --reference-no 2027-xxx \
  --quarter 4 --year 2026

# Stage it in STAGING (same flags, without --dry-run)
npm run stage -- "$F" \
  --release-name "Fourth Quarter 2026 PSGC Updates: ..." \
  --release-date 2027-01-15 \
  --reference-no 2027-xxx \
  --quarter 4 --year 2026 \
  --source-page "https://psa.gov.ph/classification/psgc" \
  --source-file "<direct URL of the xlsx on psa.gov.ph>"
```

- `--release-name`, `--release-date` (YYYY-MM-DD) and `--reference-no` come from the PSA listing or press release.
- `--quarter` and `--year` set the version (`2026-Q4`). Without them, they are inferred from the file name.
- Optional: `--expect barangays=42011,municipalities=1493` adds extra totals checks.
- Staging a new file marks any older pending release `superseded`.

The output ends with:

```
Staged release 2026-Q4-2027...Z (status: pending) in the STAGING database.
Diff vs main (2026-Q3): +N added, -N removed, N renamed, N re-parented, N reclassified.
Change summary: changes/<id>.md (and changes/<id>.json); latest copies in changes/latest.{md,json}
REVIEW_URL=https://psgc-api-liard.vercel.app/admin/review?release=...&exp=...&sig=...
RELEASE_ID=2026-Q4-2027...Z
```

Sanity-guard warnings print above the summary. A **critical** warning (TRUNCATED, COUNT_DROP > 1%,
MANY_REMOVED, MALFORMED_CODES, TOTALS_MISMATCH) blocks approval unless it is explicitly acknowledged. Treat it as
a reason to reject.

## 3. Get the change summary and review link again (any time)

```bash
npm run diff                                   # latest pending release: markdown to stdout, REVIEW_URL at the end
npm run diff -- --release <RELEASE_ID> --format json --out changes/review.json
```

- `changes/latest.md` and `changes/latest.json` are rewritten on every stage or diff. They are git-ignored.
- `REVIEW_URL` is HMAC-signed for that release id. It is valid for 14 days and only while the release is pending.
  Email `changes/latest.md` and the `REVIEW_URL` to the approver outside the app; the app sends no email.
  The link opens the review page, and the approver still needs `ADMIN_SECRET` to log in.

## 4. Check whether a release is pending: `npm run status`

```
MAIN: 2026-Q3-20261021T073327Z (2026-Q3) promoted ... by seed
STAGING releases:
  2026-Q4-20270116T010203Z       pending    2027-01-16T01:02:03.000Z  warnings: 0
  2026-Q3-20261021T073327Z       approved   2026-10-21T07:33:28.241Z  warnings: 0
Audit log:
  #1 ... approve  2026-Q3-20261021T073327Z by seed
```

- The second column of **STAGING releases** is the status: `pending` (awaiting review), `approved` (promoted),
  `rejected` or `superseded`. A release is waiting **only** if a row says `pending`.
- `warnings:` counts the non-info guard warnings.
- Once approved, **MAIN** shows the new release id and the audit log gains an `approve` row.

## 5. Decide

- **Approve or reject in the browser** at `REVIEW_URL` (or `https://psgc-api-liard.vercel.app/admin/review`).
- **Or from the CLI:**
  - Promote: `npm run promote -- --release <RELEASE_ID> --yes`. Add `--acknowledge-warnings` only if you have
    reviewed the critical warnings.
  - Reject: `npm run reject -- --release <RELEASE_ID>`.
- **Undo a bad promotion:** `npm run rollback -- --yes` restores the previous MAIN snapshot. The rollback is audited.
- **Verify:** `curl -s https://psgc-api-liard.vercel.app/api/v1/meta` returns the new `version` within about 30 s.
