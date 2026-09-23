# ATLAS planner handoff — 2026-09-24 (scheduler authority + export center)

Fresh-context resume point. Written by Elevated OpenCode / Planner A. Read with
`docs/plans/live-state.md` and `AGENTS.md`.

## Live state

- **Live release: `014b4b4c`** (`E:\ATLAS-runtime-supervised-014b4b4c-20260924`; supervisor →
  server `5001`→52200 / host `5174`→62352; health + health/ready `database:"ok"` 200; DB-backed read
  `GET /api/v1/subjects?schoolId=1` 200 (19,440 B); served entry `/assets/index-BloZtbDr.js`;
  supervisor log "All targets healthy", rollover automation disabled). The client bundle is
  **identical to `09b898e6`** — both of this release's fixes are server-only, so prove identity by
  the machine `ATLAS_RUNTIME_RELEASE_SHA` / server behaviour, not the client chunk.
- **Rollback basis: `09b898e6`** (`E:\ATLAS-runtime-supervised-09b898e6-20260924`, startable in place).
  Deeper: `6e9c87e7`, `4893cbde`.
- **`origin/main` = `0caa652d`** (docs-only above `014b4b4c`). Re-check before every push.
- Deployed by Elevated OpenCode under the operator's standing authorization; audits under
  `C:\ProgramData\ATLAS\release-audit\`.

## Delivered this session (all on `origin/main`)

1. `CEREMONY-OVER-CLASS-TRUTHFULNESS-C01` — a merged day-scoped Flag/HGP overlay now annotates the
   class (subject + teacher) instead of replacing the cell. Fresh QA `ACCEPT_READY` 7/7. Live-verified.
2. Integration reconciliation — restored the established school-scope 403 codes
   (`SCHOOL_SCOPE_REQUIRED` / `CROSS_SCHOOL_DENIED`) at the new capability middleware's single emission
   point; wired unwired test files into `test:*` scripts.
3. `SCHEDULER-COLLABORATION-C01`, `SCHEDULER-EXPORT-CENTER-C01`, `SCHEDULER-ANCILLARY-AUTHORITY-C01` —
   integrated and deployed.
4. `fix(export-center)` — the learner-count reconciliation required `Array.isArray(payload.data)` and
   sex `'M'/'F'`, but EnrollPro returns `{ data: { section, learners: [{ learner: { sex: 'MALE'|'FEMALE' } }] }, meta }`.
   The test fixture had the wrong shape, so it passed in CI and always failed live. Fixed + QA-verified.
5. `fix(timetable)` — `resolveRuntimeContext` now falls back to the persisted verified ordered-term
   contract's active term when EnrollPro's active-term endpoint is unreachable (typed
   `source === 'enrollpro-unreachable'`; reachable 409/drift stay authoritative). Fresh QA
   `ACCEPT_READY` 3/3 (harness; the first attempt's branch was dead — `fetchEnrollProActiveTerm` never
   returns null).

## Deployment handoff status — scheduler ancillary authority (READY_FOR_ELEVATED_DEPLOYMENT)

The handoff's source `origin/main @ 35518455` is **already satisfied**: `35518455` is an ancestor of the
live `014b4b4c`, and `atlas-server/dist/services/scheduler-ancillary-authority.service.js` is present in
the release. **Do not deploy `35518455` exactly** — it would downgrade the runtime (it lacks the export +
offline-term fixes). The build gate is already met: `014b4b4c` was built in a clean release checkout
(server `tsc` + client `vite` exit 0). Rollback stays `09b898e6`.

## Open / next candidates

1. **BLOCKING — all-sections class-program export.** `GET …/runs/317/export/class-program.xlsx?termIndex=2`
   returns `503 LEARNER_RECONCILIATION_FAILED` because **2 of 20 section mirrors are stale**: section
   `143` (mirror `enrolled_count` 4 vs live feed 5) and section `146` (1 vs 2). The guard fails closed
   correctly. **Remedy: a section re-sync** (refresh `section_mirrors` for school 1 / year 10 from
   EnrollPro), not a code change. Per-section exports already work
   (`section-program.docx?sectionId=141` 200, `summary-teacher-schedule.xlsx` 200, `room-program.xlsx` 200).
2. **Scheduler-surface browser acceptance.** The publication-approval inbox is gated
   `canApprovePublication = (userRole === 'scheduler')` (`useScheduleReviewWorkspaceState.ts:1923`) and
   needs a **scheduler-role login** — separate credential + browser-custody approval. The collaboration
   WebSocket is already verified opening on `/timetable` and `/faculty/room-preferences` for the
   admin/officer session.
3. **Offline term fallback** — deployed but **not live-verified** (an EnrollPro outage was not
   reproducible); covered by the QA harness only.
4. Term-cache apply: preview returned **`ALREADY_CURRENT`** (year 10, `TRIMESTER`, rev `e0dba8dc…`,
   `activeTermAvailability: RESOLVED`) — no write is required and it is not the offline fix.

## Standing debts (recorded; do not re-discover)

- Credential rotation outstanding.
- Host/proxy **502 + HTTP/2** layer unowned (notifications SSE worst); server proven healthy — direct
  `localhost:5001` probes return `401`.
- `MultipleInstancesPolicy=IgnoreNew` can silently drop a `/run`.
- Unattributed `hybrid-scheduler` runs appear in the supervisor log (generation, `unassigned=10–40`);
  identify if not the operator.
- Deploy-runner live-state gate wording (clone targets / pre-deploy record must name the target).

## Key artifacts

- Acceptance matrix: `docs/reviews/runtime-acceptance-6e9c87e7-20260924/acceptance-matrix.md`.
- Machine register (`docs/plans/atlas-delivery-cycles.json`) is **superseded/frozen** (last updated
  2026-09-17); its coordination pointer was corrected to `6e9c87e7`. Coordination runs via
  `docs/plans/live-state.md`.
- Worktrees: `E:\ATLAS-worktrees\ceremony-class-coexistence-c01` (this lane's integration branch);
  `E:\ATLAS-worktrees\export-presentation-s15-rebaseline` (Planner B's, clean at `127a52bd`).

## Suggested next action

A fresh cycle to (a) re-sync the stale section mirrors so the all-sections export reconciles, and
(b) obtain the scheduler-role credential/browser-custody approval to exercise the publication-approval
surface — then close the export + scheduler acceptance. No further deployment is required for the
scheduler-authority handoff.
