# Fresh planner handoff — deploy the unified official export presentation (2026-09-24)

**Ready to paste into a new primary-planner session.** All facts below were verified against
`origin/main` at handoff time.

---

## Role

Primary planner, Elevated OpenCode (shared runtime + the single authenticated browser). One cycle.
You have HIGH authority. You may deploy.

## Read first (from `origin/main` — never from `D:\ATLAS`, which is stale/dirty)

- `AGENTS.md` (whole directive, once)
- `docs/plans/live-state.md` (`## Live release` + the Lane A entries)
- `docs/reference/agent-verification-gates.md`
- `docs/reference/agent-live-browser-qa.md`
- `docs/handoffs/planner-handoff-2026-09-24-export-presentation-deploy.md` (this file)

## Verified state (2026-09-24)

- **Live / rollback SHA:** `c7fc0c955253b924fd880f346c23d428166437c6` at
  `E:\ATLAS-runtime-supervised-c7fc0c95-20260924` (health/ready `database:"ok"` 200).
- **Code target:** `70a5160819349f5ea0742b839c11606e8408185d` — an ancestor of `origin/main`.
- **`2c4a6c80`** (scheduler-control clarity / Simple-workspace plain language) **is an ancestor of
  `70a51608`**, so **one deployment covers both**.
- **`origin/main` = `23ccb3cf28be69160169be82e50661965fc68fc8`** — a docs-only commit that adds the required
  **pending-release record**. `docs/plans/live-state.md` names `70a51608` under `## Live release`, so the
  runner's fail-closed gate will pass. **Do NOT deploy `23ccb3cf` as the runtime source** — it is only the
  preflight record that lets the runner deploy `70a51608`.
- **Migration `20260924000000_unified_official_export_profile` is present and INTENTIONALLY UNAPPLIED**
  (latest applied is `20260923000000_publication_approval_requests`). The deploy must run the **guarded**
  migration; never bare Prisma.
- **The authenticated browser session has expired.** Post-deploy acceptance needs an **authorized login**
  (one `LOCAL_LOGIN_SUCCESS` + `last_login_at` audit delta). Credentials live in
  `%USERPROFILE%\.config\opencode\atlas-qa-credentials.local.md`; a login is a mutation — get the operator's
  explicit go and disclose the delta.
- **Cohort sections: not active for the current live school year.** The cohorts endpoint returns 200 with
  zero cohorts and the current run has no cohort entries. This needs data / EnrollPro population or an
  authorized sync later — **not a UI change**. Do not treat it as a deploy blocker.
- `E:` and `D:` have ample free space.

## Objective — deploy `70a51608` (+ `2c4a6c80`), then accept

**What ships:** Grade-level Class Program **DOCX** is now one landscape matrix across all grade sections
(section/adviser/room headers, paired subject/teacher rows); Section/Room/Teacher official DOCX use direct
template-oriented renderers; XLSX stays as readable working data with separate weekday cells; the Export
Center distinguishes official Word output from Excel working data; official export identity/profile fields
are additive and frozen for published schedules; grade exports reject a misleading `sectionId` filter.
Plus (from `2c4a6c80`) plain-language timetable copy, the desktop header wrapping cleanly instead of a
clipped horizontal strip, thin primary-maroon scrollbars, and generation staying fail-closed while the
readiness check is pending with a "Retry schedule check" affordance. **No generation, publication, or
cohort-data change.**

**Verification already recorded (do not repeat the whole suite):** scheduler clarity 46/46, timetable UX
35/35, lifecycle loading 1/1, server focused 25/25, client export 9/9, both production builds, Prisma
validation, built server-route import, rendered multi-section Grade/Section/Room DOCX fixtures inspected in
Word→PDF. Terra accepted correction range `e74408c1...70a51608`. The full client typecheck remains blocked
only by pre-existing missing Playwright declarations in older test files.

## Elevated deployment handoff

```powershell
$targetSha = '70a5160819349f5ea0742b839c11606e8408185d'
$targetDir = 'E:\ATLAS-runtime-supervised-70a51608-20260924'
$incumbentSha = 'c7fc0c955253b924fd880f346c23d428166437c6'
$incumbentDir = 'E:\ATLAS-runtime-supervised-c7fc0c95-20260924'
$runtimeEnvFile = 'D:\ATLAS-runtime-config\atlas-server.env'

git -C D:\ATLAS fetch origin
git -C D:\ATLAS worktree add --detach $targetDir $targetSha

npm ci --prefix "$targetDir\atlas-server"
npm ci --prefix "$targetDir\atlas-client"

Push-Location "$targetDir\atlas-server"
$env:DATABASE_URL = 'postgresql://atlas:<redacted>@127.0.0.1:5432/atlas'
# REDACTED 2026-09-26 (SECRET-SCRUB-20260926): the password segment above was a stale
# local default, verified non-functional against the live server on that date. Only
# the password segment is redacted; this command, its position in the sequence, and
# all surrounding context are unchanged. The real value belongs in the durable
# runtime env file, which is never committed.
npx prisma generate --schema ..\prisma\schema.prisma
Pop-Location

$env:VITE_ENROLLPRO_URL = 'https://dev-jegs.buru-degree.ts.net'
npm --prefix "$targetDir\atlas-client" run build
```

Load the protected runtime environment into the elevated process without printing secrets, then run the
**mandatory guarded migration — do not use bare Prisma**:

```powershell
Push-Location "$targetDir\atlas-server"
npx tsx src/scripts/atlas-migrate.ts
Pop-Location
```

Dry-run the cutover first, then execute only if it passes:

```powershell
& "$targetDir\ops\runtime\deploy-runner.ps1" `
  -TargetSha $targetSha `
  -TargetSourceDir $targetDir `
  -IncumbentSha $incumbentSha `
  -IncumbentSourceDir $incumbentDir `
  -EnvFile $runtimeEnvFile

& "$targetDir\ops\runtime\deploy-runner.ps1" `
  -TargetSha $targetSha `
  -TargetSourceDir $targetDir `
  -IncumbentSha $incumbentSha `
  -IncumbentSourceDir $incumbentDir `
  -EnvFile $runtimeEnvFile `
  -Execute
```

**Post-deploy acceptance** (authorized authenticated browser, 1366×768 and 390×844): Export Center
controls; Grade DOCX matrix; Section/Room/Teacher DOCX; readable XLSX downloads; **no console/network
regressions**; **no generation or publication action**. Then verify the served entry bundle changed and the
release identity matches the target; record the acceptance artifact and update `docs/plans/live-state.md`
(`70a51608` becomes LIVE, `c7fc0c95` becomes the rollback basis). Retire the cycle worktree.

## Constraints

- One writer per stream; work from a clean worktree under `E:\ATLAS-worktrees` (or the release dir above);
  never junction `node_modules` across releases.
- **Risk — the additive migration is intentionally unapplied.** If its backup/revalidation gate fails,
  **stop; do not bypass it.**
- Never touch `D:\ATLAS` (beyond `git -C D:\ATLAS` commands), Codex worktrees, runtime/fallback dirs, or
  companion repos (EnrollPro/AIMS/SMART are READ_ONLY).
- Keep deployment and acceptance as **separate outcomes**.
- Do not deploy `23ccb3cf`.

## Deliverable

One committed acceptance artifact stating: the cutover result and live identity; the migration outcome
(applied via the guarded runner); the export matrix + a real content check of the new Grade DOCX matrix;
the browser-acceptance outcome (or a typed `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)` row with evidence if
no login is granted); confirmation that no generation/publication occurred; and the rollback basis. Fresh
independent QA over the deployed acceptance; then update `docs/plans/live-state.md`.

## Known open items (not this cycle unless trivial)

- Cohort sections need data/EnrollPro population (not a UI change).
- Export depends on `section_mirrors` matching EnrollPro; the all-sections export 503s when they drift and
  there is no automatic refresh.
- Scheduler-role acceptance for grade-level coordinators (`GRADE N COORDINATOR` ancillary roles) is
  unverified live; no coordinator credential.
- School-1 QA/admin credential rotation; the intermittent Tailscale-layer SSE HTTP/2 blips.
