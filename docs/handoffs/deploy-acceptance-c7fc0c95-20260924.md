# ATLAS deployment acceptance — release `c7fc0c95` (2026-09-24)

Elevated deployment under the operator's standing authorization. One client fix. **No server change,
migration, generation, or publication.** Deployment and acceptance are separate outcomes.

## Cutover

| | |
|---|---|
| Target | `c7fc0c955253b924fd880f346c23d428166437c6` |
| Incumbent / rollback basis | `514be157632786e7cc66b0a4adf117826135a0ed` (`E:\ATLAS-runtime-supervised-514be157-20260924`, startable in place) |
| Target source | `E:\ATLAS-runtime-supervised-c7fc0c95-20260924` (detached worktree; client rebuilt from the target source, server artifacts byte-identical to `514be157`) |
| Env | `D:\ATLAS-runtime-config\atlas-server.env` |
| Pre-deploy record | `docs/plans/live-state.md` naming target + rollback, committed `c9629a90` and pushed **before** cutover |
| Runner | dry run clean (`mutates:false`) → `-Execute` → `CUTOVER_STARTED`, audit `…\release-audit\c7fc0c95-20260924-061608` |

**Change:** `atlas-client/src/pages/MySchedule.tsx` — `/my/schedule` now sends the resolved ordered term to the
published-faculty-schedule endpoint, which had been failing closed with `TERM_SELECTION_REQUIRED` (400) and
rendering no schedule. An unresolved term now shows a message and **never defaults to Term 1**. The term is
also part of the offline cache key. Independent QA `ACCEPT_READY` 6/6/0/0 (test 5/5 with a load-bearing
mutant; live 400→200 reproduced pre-deploy).

## Post-cutover verification

- Machine `ATLAS_RUNTIME_RELEASE_SHA` = `c7fc0c95…`, `ATLAS_RUNTIME_SOURCE_DIR` =
  `E:\ATLAS-runtime-supervised-c7fc0c95-20260924`; `GET /api/v1/health/ready` → 200.
- New bundle served from the Tailnet origin: entry `assets/index-C7SskN0k.js` (was `index-PWY0v5TC.js`).

## Verification limitation

Live end-to-end confirmation of the faculty page was **not** completed: the persistent browser session had
**expired** during this cycle (the app redirected `/my/schedule` to `/login`; `GET /api/v1/auth/me` → 401),
and a fresh login was not performed (credentials are secrets and a login is a mutation). The fix is verified
by the independent QA (unit test with a mutant control; the 400→200 endpoint behaviour reproduced live
before the cutover) and by the served bundle changing to the rebuilt entry. The next authenticated browser
session should confirm `/my/schedule` renders a schedule.

## Rollback

Re-run the runner with target/incumbent swapped (target `514be157`, incumbent `c7fc0c95`). Not needed.

## Residuals

- The persistent browser profile's session expired mid-cycle; future browser QA needs a fresh authorized login.
- Two pre-existing `deploy-runner.test.mjs` failures were fixed in `514be157`; the 4 pre-existing client
  typecheck errors (Playwright declarations in three unchanged test files) remain.
