# ATLAS cycle artifact — export-center acceptance + section re-sync (2026-09-24)

Fresh-context planner cycle (Elevated OpenCode / Planner A). Read with
`docs/plans/live-state.md` and `AGENTS.md`. Docs + one approved live-data action; **no source change,
no deployment, no generation, no publication, no migration, no login.**

Base `origin/main` = `be0bd0df` (unchanged at start and end of cycle). Live release = **`014b4b4c`**.

## 1. Section-mirror re-sync (HIGH live-data — approved) — RESOLVED

**Failing-first (read-only, reproduced):** `GET /api/v1/generation/1/10/runs/317/export/class-program.xlsx?termIndex=2`
→ **503 `LEARNER_RECONCILIATION_FAILED`**. Root cause confirmed as data freshness, not code: the guard
(`atlas-server/src/services/export-learner-count.service.ts`) compares each requested section's
`section_mirrors.enrolled_count` against the live EnrollPro learner feed and fails closed on mismatch.

**Drift (independently read from DB + live EnrollPro feed before the action):**

| section | mirror `enrolled_count` | live EnrollPro feed |
|---|---|---|
| 143 Aguinaldo | 4 | 5 |
| 146 Matapat | 1 | 2 |
| all other 18 | — | match |

All 20 mirrors were last synced `2026-09-18T05:19:18.247Z`; names/grades/programs/capacities already
matched the feed. Exactly two rows drifted.

**Approved action (operator: "Go ahead — run the narrow re-sync").** Target:
`POST /api/v1/sections/sync` body `{schoolId:1, schoolYearId:10}` on the live `014b4b4c` runtime →
`syncSectionsFromExternal(1, 10)` (the same path that populates `section_mirrors`). Executed via the
already-authenticated officer session (no fresh login; `/auth/me` 200 role `officer`, school 1).

- **Response:** `200 {synced:true, count:20, removed:0, skipped:0, source:"enrollpro",
  fetchedAt:"2026-09-23T19:17:40.410Z", enrollProActiveYear:"2031-2032"}`.
- **Rollback basis captured first:** `%TEMP%\opencode\section-mirrors-pre-sync-20260924.tsv`
  (20 rows; 143=4, 146=1, all `last_synced_at 2026-09-18T05:19:18.247Z`). Restore = direct `UPDATE`
  of the two counts; the table is a derived EnrollPro cache, so a re-sync reproduces the same values.
- **Post-action DB:** section 143 = **5**, section 146 = **2**, both `is_stale=false`,
  `last_synced_at 2026-09-23 19:17:40.41`; 20 rows total, `sum(enrolled_count)=92`. No creates, no
  deletes, no other field change. The reconciliation guard was **not touched**.

**Re-verified export matrix (live `014b4b4c`, authenticated officer session, run #317, termIndex=2):**

| export | before | after |
|---|---|---|
| `class-program.xlsx?termIndex=2` | 503 `LEARNER_RECONCILIATION_FAILED` | **200** (20,389 B) |
| `section-program.docx?sectionId=141&termIndex=2` | 200 (9,874 B) | **200** (9,873 B) |
| `summary-teacher-schedule.xlsx?termIndex=2` | 200 (54,081 B) | **200** (54,082 B) |
| `room-program.xlsx?termIndex=2` | 200 (34,950 B) | **200** (34,951 B) |

The ±1-byte deltas are embedded document metadata/timestamps, not content change.

## 2. Scheduler-surface browser acceptance — `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`

- **Gate (source):** `atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts:1922-1923` —
  `canRequestPublication` / `canApprovePublication = (userRole === 'scheduler')`; `userRole` is decoded
  from the access-token JWT (`:202`). Render gate:
  `atlas-client/src/components/timetable/modals/TimetableWorkflowDialogs.tsx:131` —
  `<PublicationApprovalInbox … visible={canApprovePublication === true} />`, and the component returns
  `null` when `!visible` (`PublicationApprovalInbox.tsx:63`).
- **Session available:** the persistent profile is an **officer** session (localStorage `userRole=officer`;
  `GET /api/v1/auth/me` 200 role `officer`, school 1). The scheduler-only control is therefore correctly
  hidden — live check on `/timetable`: `find "Review publication requests"` → **no matches**.
- **Why blocked:** exercising the publication-approval inbox requires a **scheduler-role login**, which is a
  mutation (`LOCAL_LOGIN_SUCCESS` row + `last_login_at`) and needs explicit credential + browser-custody
  authorization. The handoff and deployment handoff both state browser login is **not pre-authorized**;
  none was granted this cycle. No credentials were entered; no login occurred.
- **Collaboration WebSocket (read-only) — VERIFIED OPEN.** Direct authenticated probe from the page:
  `POST /api/v1/room-preferences/collaboration/ticket` → 201, then
  `wss://…/api/v1/room-preferences/collaboration/ws?ticket=…&schoolId=1&schoolYearId=10&runId=317`
  → **`open`**. On `/timetable` the page itself issues the ticket POST (201s observed). On
  `/faculty/room-preferences` the page mounts the socket only when a summary `runId` exists
  (`OfficerRoomPreferences.tsx:148` guard); currently no room requests → no `runId` → no socket mounted
  (data-conditional, not a defect).

## 3. Deployment confirmation — no re-deploy

- Live release **`014b4b4c` remains live**: machine `ATLAS_RUNTIME_RELEASE_SHA` =
  `014b4b4c6ef1112f544589f7245e5b662103d9a1`, `ATLAS_RUNTIME_SOURCE_DIR` =
  `E:\ATLAS-runtime-supervised-014b4b4c-20260924`; supervisor PID 25496 → server 5001→52200 / host
  5174→62352; `GET /api/v1/health` and `/health/ready` (`database:"ok"`) 200.
- The scheduler-authority handoff target `35518455` is an **ancestor** of `014b4b4c`
  (`git merge-base --is-ancestor 35518455 014b4b4c` → true), and
  `atlas-server/dist/services/scheduler-ancillary-authority.service.js` is present in the release.
  Deploying `35518455` exactly would **downgrade** the runtime. **No deployment performed.**
- Rollback basis `09b898e6` is also an ancestor of `014b4b4c` and startable at
  `E:\ATLAS-runtime-supervised-09b898e6-20260924`.

## Ledger

- Source changes: **none** (docs-only artifact + live-state update). No fresh QA of a source range is
  required; the HIGH live-data action's evidence is independently re-verifiable from the DB + live feed.
- No `D:\ATLAS`, Codex worktree, runtime/fallback dir, companion repo, migration, generation,
  publication, or login action was touched.
