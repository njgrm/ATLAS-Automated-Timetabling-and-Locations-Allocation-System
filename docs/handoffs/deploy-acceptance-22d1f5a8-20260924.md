# ATLAS deployment acceptance — release `22d1f5a8` (2026-09-24)

Elevated deployment executed under the operator's explicit approval and the
`TIMETABLE-LIFECYCLE-CONTROLS-C03` elevated deployment handoff. **No migration, no generation,
no publication.** Deployment and acceptance are recorded as separate outcomes.

## Cutover

| | |
|---|---|
| Target | `22d1f5a8a341bf426a91df5a7ea6c01acd4862d2` |
| Incumbent / rollback basis | `014b4b4c6ef1112f544589f7245e5b662103d9a1` (`E:\ATLAS-runtime-supervised-014b4b4c-20260924`, startable in place) |
| Target source | `E:\ATLAS-runtime-supervised-22d1f5a8-20260924` (detached worktree at the target) |
| Env | `D:\ATLAS-runtime-config\atlas-server.env` (17 keys; no `ROLLOVER_AUTO_SYNC_ENABLED` key — the operative control is `ops/runtime/runtime-contract.json` `invariants.ROLLOVER_AUTO_SYNC_ENABLED="false"`, passed through by the supervisor; live log confirms `[rollover-automation] Disabled via ROLLOVER_AUTO_SYNC_ENABLED=false`) |
| Pre-deploy record | `docs/plans/live-state.md` `## Live release` naming target + rollback, committed `4e2e5909` and pushed **before** cutover |
| Runner | `ops/runtime/deploy-runner.ps1` — dry run clean (`mutates:false`, supervisor 25496, listeners 52200/62352), then `-Execute` → `CUTOVER_STARTED`, audit `C:\ProgramData\ATLAS\release-audit\22d1f5a8-20260924-041929` |

**Build (target worktree, own dependencies — no shared junction):** `atlas-server` `npm ci` + `prisma
generate` (repo-root schema) + `tsc` build; `atlas-client` `npm ci` + `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net`
production build. Pre-build gates all green: `test:timetable-lifecycle-loading` **1/1**,
`test:timetable-route-keys` **57/57**, `timetable-lifecycle-controls-c03` **3/3**. Worktree clean after build.

## Post-cutover verification

- Machine `ATLAS_RUNTIME_RELEASE_SHA` = `22d1f5a8…`, `ATLAS_RUNTIME_SOURCE_DIR` =
  `E:\ATLAS-runtime-supervised-22d1f5a8-20260924`; `supervisor-state.json` `state=running`,
  `releaseSha=22d1f5a8…`, server 61128 / client 9212; supervisor log "All targets healthy".
- `GET /api/v1/health/ready` → 200 `{"status":"ready","checks":{"database":"ok"}}`;
  `GET /api/v1/subjects?schoolId=1` → 200 (19,440 B).
- **New bundle served from the Tailnet origin:** entry `assets/index-PWY0v5TC.js` (was `index-BloZtbDr.js`)
  and `assets/ScheduleReviewWorkspace-M15pvQpf.js` → 200 (418,480 B).
- Export matrix (run #317, termIndex 2) all 200: `class-program.xlsx` 20,389 B, `section-program.docx`
  9,873 B, `summary-teacher-schedule.xlsx` 54,081 B, `room-program.xlsx` 34,950 B.

## Authenticated read-only browser acceptance

**Desktop 1366×768** — `/timetable`: View type select + searchable entity select + `Refine` trigger
visible; mobile sheet trigger hidden; no global scrollbar. **Mobile 390×844** — `Filters` sheet trigger
visible, desktop `Refine` hidden; opening it renders the bottom sheet ("Refine this grid" + Program /
Entry type / Attention + Done); no global scrollbar.

**Direct lifecycle routes** — each shows its intended bounded loading state immediately
(`data-testid="timetable-route-loading-state"`, shell `h-[calc(100svh-3.5rem)]`, "Loading this view…")
then resolves to the correct view, with no error boundary and no global scrollbar:

| route | loading copy | resolved h1 |
|---|---|---|
| `/timetable/pre-generation` | Draft queue | Draft queue |
| `/timetable/setup` | Review setup | Review setup |
| `/timetable/policies` | Scheduling policies | Scheduling policies |
| `/timetable/runs` | Generation history | Generation history |
| `/timetable/exports` | Exports | Exports |

**Console:** the current page reported **0 errors / 0 warnings** at the moment of the acceptance pass.
The session's historical error log contains only the pre-existing intermittent host/proxy 502s and the
pre-fix 503 export errors from earlier in the session. The 502s are intermittent and can still appear on
a fresh load (a later independent load produced three transient 502s to `runtime/rollover-status`,
`room-preferences/collaboration/ticket`, and `runs/317/manual-edits`, each of which returns 200 on a
direct retry) — this is the pre-existing, unowned 502 residual, not a defect of this release.

## Rollback

If post-cutover verification had failed: re-run the runner with target/incumbent swapped
(target `014b4b4c`, incumbent `22d1f5a8`) after confirming the `014b4b4c` directory is startable.
Not needed — verification passed. The `014b4b4c` directory is **startable in place** (HEAD `014b4b4c…`,
`atlas-server/dist/server.js` + `atlas-client/dist/index.html` present); its `git status --short` is not
empty — it carries an untracked `ops/runtime/logs/` (the supervisor state JSON, which `.gitignore` does
not cover) — which does not affect startability.

## Residuals

- NON_BLOCKING (carried from the source handoff): full client typecheck still fails only in three
  unchanged tests missing Playwright declarations.
- The intermittent host/proxy 502 layer remains unowned/unreproduced (pre-existing; not introduced by
  this release).
