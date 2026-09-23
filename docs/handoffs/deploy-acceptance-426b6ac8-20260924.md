# ATLAS deployment acceptance — release `426b6ac8` (2026-09-24)

Elevated deployment under the operator's standing authorization. One server fix. **No migration, no
generation, no publication.** Deployment and acceptance recorded as separate outcomes.

## Cutover

| | |
|---|---|
| Target | `426b6ac8358bbdf10cc4289fdd34067ff88d0c81` |
| Incumbent / rollback basis | `d7082c9db134f26e0f3f1e5fa01d470cb9b34093` (`E:\ATLAS-runtime-supervised-d7082c9d-20260924`, startable in place) |
| Target source | `E:\ATLAS-runtime-supervised-426b6ac8-20260924` (detached worktree at the target; server rebuilt from the target source, client bundle byte-identical to `d7082c9d`) |
| Env | `D:\ATLAS-runtime-config\atlas-server.env` |
| Pre-deploy record | `docs/plans/live-state.md` `## Live release` naming target + rollback, committed `1743c6c3` and pushed **before** cutover |
| Runner | dry run clean (`mutates:false`, supervisor 61896, listeners 68564/65048) → `-Execute` → `CUTOVER_STARTED`, audit `C:\ProgramData\ATLAS\release-audit\426b6ac8-20260924-053226` |

**Change:** `atlas-server/src/services/runtime-context.service.ts` — the RR-TERM-CACHE offline fallback now
derives the active term from the persisted contract's verified term dates (containment → latest-started →
snapshot) instead of surfacing a stale `term_contract_cache.activeTerm` snapshot (school 1 / year 10:
snapshot `T1` vs live `T2`). Independent QA `ACCEPT_READY` 6/6/0/0, with a failing-first pure unit test
(6/6; mutant returns the stale `T1` / `null`), server `tsc` clean, hermetic preservation 11/11.

## Post-cutover verification

- Machine `ATLAS_RUNTIME_RELEASE_SHA` = `426b6ac8…`, `ATLAS_RUNTIME_SOURCE_DIR` =
  `E:\ATLAS-runtime-supervised-426b6ac8-20260924`; `GET /api/v1/health/ready` → 200
  `{"status":"ready","checks":{"database":"ok"}}`.
- `GET /api/v1/runtime/context?schoolId=1&verifyUpstream=true` → 200, `source:"enrollpro-verified"`,
  `activeTerm.activeTerm:"T2"`, `activeTerm.termIndex:2` (the live path is unchanged; the fix affects only the
  unreachable path).
- Export matrix (run #317, termIndex 2) all 200: `class-program.xlsx` 20,389 B, `section-program.docx`
  9,873 B, `summary-teacher-schedule.xlsx` 54,080 B, `room-program.xlsx` 34,949 B.
- 4 fresh `/timetable` loads with ~8 s idle gaps → **0 502s / 0 HTTP-2 errors** (the 502s seen immediately
  after the cutover were the server restart window, not a regression).

## Verification limitation

The fix runs **only** when the EnrollPro active-term endpoint is unreachable, which cannot be induced on the
live runtime without a network/runtime change; it is therefore verified by the pure unit test (failing-first
control) and the live path is confirmed unchanged (`T2`, `enrollpro-verified`). The pre-fix stale-snapshot
behaviour was confirmed directly from the database earlier.

## Rollback

Re-run the runner with target/incumbent swapped (target `d7082c9d`, incumbent `426b6ac8`) after confirming
`E:\ATLAS-runtime-supervised-d7082c9d-20260924` is startable. Not needed — verification passed.

## Residuals

- NON_BLOCKING: `dayStamp` uses the local calendar date for a `Date` and the UTC-normalized stamp for a
  string; for the date-only `YYYY-MM-DD` inputs the persisted contract produces, these coincide.
- NON_BLOCKING: the two pre-existing `deploy-runner.test.mjs` failures remain (Windows/PowerShell-5.1
  harness artifacts).
- The intermittent host/proxy 502s were fixed in `d7082c9d`; the SSE HTTP/2 variant may be Tailscale-layer.
