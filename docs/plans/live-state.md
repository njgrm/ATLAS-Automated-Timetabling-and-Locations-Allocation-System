# ATLAS Live State

Single current-state document. Replaces the retired delivery register
(`docs/plans/atlas-active-delivery-streams.md`, historical only).
Keep this file short; update it only when live facts change.

Last verified: 2026-09-18 19:40 +08

## Objective

Presentable live demo on the active school year (`schoolYearId = 10`,
2031-2032) at `https://njgrm.buru-degree.ts.net`: exports
(class / teacher / room / summary) plus corrected Teaching Load and dynamic
timetable UX, with generation running end to end.

## Deployed runtime (verified)

| Item | Value |
| --- | --- |
| Product pin | `74c1f12a` (`1400bea2` is docs-only above it) |
| Release dir | `D:\ATLAS-runtime-supervised-74c1f12a5c06-20260918` |
| Supervisor | PID 67028, owner `NT AUTHORITY\SYSTEM`, task-launched |
| Task | `ATLAS-Runtime-Supervisor` — ONSTART, SYSTEM, Highest, IgnoreNew, `PT0S` |
| 5001 (server) | PID 63688 — `atlas-server/dist/server.js` |
| 5174 (host) | PID 12992 — `ops/runtime/host.mjs` |
| Health | local health/ready 200, host live 200, Tailnet health 200, DB-backed read 200 |
| Entry chunk | `assets/index-CtOKnF1z.js` |
| Rollover automation | disabled (`ROLLOVER_AUTO_SYNC_ENABLED=false`) |

Machine env (all three are required; the task-launched process resolves the
release from these, **not** from its own directory):

- `ATLAS_RUNTIME_ENV_FILE` = `D:\ATLAS-runtime-config\atlas-server.env` (17 keys)
- `ATLAS_RUNTIME_SOURCE_DIR` = the release dir above
- `ATLAS_RUNTIME_RELEASE_SHA` = `74c1f12a5c06bb025a1a7a13088c1c5da1a76d74`

### Rollback

Set the two env vars back to
`D:\ATLAS-runtime-supervised-f0d65a531e34-20260918` /
`f0d65a531e34ded9d8148a1c3f7bf5ddbf2eec4a`, then stop and start the task.
Retained startable releases on disk: `f0d65a53`, `4ce73d15`, `3c4cc3cd`,
`798cd783`, `0eb3b67f`, `131baab7`, `20f07f59`, `405e5b18`.

## Hard dependencies — do not retire

- **`D:\ATLAS-runtime-supervised-0eb3b67fe94c-20260918`** is the live
  `atlas-server/node_modules` chain root. The live release links to it in a
  single hop:
  `74c1f12a...\atlas-server\node_modules` -> `0eb3b67f...\atlas-server\node_modules`.
  Lockfile identity verified identical (`9332EF25659983DA`) across
  `0eb3b67f`, `f0d65a53`, `74c1f12a`. Treat the target read-only; never run an
  install through the junction.
- `git config --system --add safe.directory "*"` is required. The SYSTEM-owned
  supervisor runs `git -C <releaseDir> rev-parse HEAD`; without it the pin check
  fails closed with `PIN_UNRESOLVED` (dubious ownership) and the task exits 1.

## Data state

- Database `atlas_recovery_clean_rebuild_20260905` @ localhost:5432.
- Active year = upstream `enrollProSchoolYearId` **10** (mirror row 551).
  Data tables key on the upstream id (10), not 551. Archived year = upstream 9.
- `grade_shift_windows` seeded for year 10 (ids 1-20). This was the real
  generation blocker: the client sends `enforceShiftWindows: true` by default
  while the table had 0 rows for year 10.
  Rollback: `delete from grade_shift_windows where id between 1 and 20;`
- Generation verified: run #314 COMPLETED in 7.2 s, 920 assigned / 0
  unassigned / 0 HARD violations, published revision 41, all four exports 200.
- Blocker arc closed: 66 -> 48 -> 110 -> 55 -> 69 -> 30 -> 0 (room, capacity,
  flag, scheduler search).

## Open items

1. **Product decision needed** — does REGULAR overlay the Flag/HGP period while
   only STE/SPA/SPS relocate the displaced session to a Monday-only
   compensation row? Determines the size of the flag/compensation lane.
   Note: `ec2430ab` ("in-period overlay") is inconsistent with the stakeholder
   image for the relocated subject.
2. Export DepEd styling — mirror the DOCX renderer's header/borders/merges into
   the exceljs class-program renderer; fix `Total minutes per day` writing the
   same value to all five weekday cells.
3. `Building.gradeScope` is `[]` for every building, so `buildingMatchScore`
   collapses to building-name order. Current home-room assignment is correct
   only because it was set manually.
4. `manual-edit.service.ts` leaks the internal string
   "Published repairs require the Prompt 6 revision workflow" to operators.
5. Published-safe swap and revision-time hard-constraint validation
   (revision path performs none today).
6. `DATA-CORRECTION-C01` is mis-targeted at the archived year and has 4 blocking
   findings — rescope onto year 10 or abandon.
7. SSO env activation needs one restart (must not overlap another runtime action).
8. Hygiene: untracked scratch `atlas-server/src/__probe-preflight.ts` in the
   integration worktree.

## Boundaries

- `D:\ATLAS` is a stale/dirty checkout (~466 behind) and is never an
  integration boundary. Real work happens in `E:/ATLAS-worktrees/*`.
- The harness may inject a stale `D:/ATLAS/AGENTS.md`; read the directive from
  Git bytes (`origin/main:AGENTS.md`).
- Companion repos (EnrollPro, AIMS, SMART) are read-only.
