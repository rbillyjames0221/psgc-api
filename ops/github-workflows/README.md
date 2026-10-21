# GitHub Actions workflow (not yet active)

`psgc-check.yml` is the weekly PSA check. It lives here instead of `.github/workflows/` because the token used
to create this repo had no `workflow` scope, so GitHub refused to accept a workflow file from it.

To activate it, do either:

- GitHub web UI: **Add file → Create new file**, name it `.github/workflows/psgc-check.yml`, paste this file's contents, commit; or
- locally with a token/SSH key that has the `workflow` scope:
  `mkdir -p .github/workflows && git mv ops/github-workflows/psgc-check.yml .github/workflows/ && git commit -m "Activate PSA check workflow" && git push`

Optional repo settings it uses: secrets `DATABASE_URL_MAIN`, `DATABASE_URL_STAGING`, `ADMIN_SECRET`; variables `PSGC_API_BASE_URL`, `PSGC_OPEN_ISSUE`.
