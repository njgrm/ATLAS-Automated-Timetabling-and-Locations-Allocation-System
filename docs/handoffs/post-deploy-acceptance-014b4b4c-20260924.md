# ATLAS post-deploy acceptance — 014b4b4c + continuity reconciliation (2026-09-24)

Fresh-context planner cycle (Elevated OpenCode / Lane A), read-only plus a
documentation correction. **No source change, no deployment, no login, no live-data action.**
Base/end `origin/main` = `48356ee2` (cycle entry) → see the closure commit.

## Live release identity — CONFIRMED `014b4b4c`

- Machine `ATLAS_RUNTIME_RELEASE_SHA` = `014b4b4c6ef1112f544589f7245e5b662103d9a1`;
  `ATLAS_RUNTIME_SOURCE_DIR` = `E:\ATLAS-runtime-supervised-014b4b4c-20260924`.
- Supervisor PID 25496 → server `5001`→52200 / host `5174`→62352; `/api/v1/health` and
  `/health/ready` (`database:"ok"`) 200; authoritative `ops/runtime/logs/supervisor-state.json`
  `state=running`, `releaseSha=014b4b4c…`, `previous:null`.
- The scheduled task `ATLAS-Runtime-Supervisor` last ran **2026-09-24 03:01:28 local**
  (`19:01:28Z`) — this is the **014b4b4c deployment** (audit `release-audit\014b4b4c-20260924-030100`),
  not an unplanned restart.

## Read-only demo route matrix (live, authenticated officer session, 1366×768)

13 routes navigated; each renders a real surface, **no error boundary**, **no global document
scrollbar** (`scrollHeight == clientHeight == 768`):

| route | h1 |
|---|---|
| `/` | Scheduling Dashboard |
| `/timetable` | Class Schedule |
| `/timetable/runs` | Runs |
| `/timetable/setup` | Setup |
| `/timetable/policies` | Scheduling Policy |
| `/timetable/pre-generation` | Pre-Generation |
| `/teaching-load` | Teaching Load |
| `/sections` | Sections |
| `/subjects` | Subjects |
| `/teachers` | Teachers |
| `/map` | Campus and rooms |
| `/schedules`, `/audit` | (render; no h1 element) |

Key API reads all 200: `notification-inbox` + `unread-count`, `dashboard/readiness-summary`,
`generation/1/10/runs`, `runtime/context`, `sections/summary/10`, `subjects`. The AppShell
notification bell shows **1 unread**.

## Export matrix + deep content verification (run #317, termIndex 2)

| export | status | bytes |
|---|---|---|
| `class-program.xlsx?termIndex=2` | **200** | 20,389 |
| `section-program.docx?sectionId=141&termIndex=2` | **200** | 9,873–9,874 (docx metadata varies ±1 B) |
| `summary-teacher-schedule.xlsx?termIndex=2` | **200** | 54,082 |
| `room-program.xlsx?termIndex=2` | **200** | 34,951 |

The `class-program.xlsx` was downloaded and unzipped: it contains **4 worksheets** (`Grade 7`,
`Grade 8`, `Grade 9`, `Grade 10`) with print areas/titles, all **20/20 section names** present in
`sharedStrings.xml`, and `Male`/`Female`/`Total` columns — not a header-only file. The public
published surface resolves `source.runId=317`, `activeRevisionId=43`, `snapshotState=FROZEN`,
`termScope=explicit`, `termIndex=2`, **920 entries**.

## 502 host/proxy layer — not reproducible

A 100-request load burst (4×25 parallel) through the Tailnet origin to `/api/v1/runtime/context`
returned **100/100 HTTP 200**. The intermittent `UPSTREAM_UNREACHABLE` 502s seen on some clean
page loads remain a host-side connection blip and could not be reproduced on demand, so **no fix is
attempted** (a change could not be proven to fail without it — `AGENTS.md` §11 gate 2).

## Stale continuity lines — verified against the live system and corrected

These live-state "open blocker" lines were **already resolved** by later integrated streams; each was
re-verified live and is superseded in `docs/plans/live-state.md`:

- **Runs-list `summary.isPublished`** — FIXED (`TIMETABLE-TRUTHFULNESS-C01` D1): `listRuns` now
  returns `summary.isPublished` + `activePublishedRunId` (`generation.service.ts:1206-1240`).
- **Dashboard "review blockers" wording** — FIXED: the live Dashboard renders
  `No hard violations · 289 warnings acknowledged`, and `readiness-summary` returns the canonical
  `blockingHardCount:0`, `softViolationCount:289` (not the raw 334/335).
- **`GET /rollover-recovery/preview` school-1 default + `parseStrictTermAuthoritySchoolId` guard** —
  FIXED: `runtime.router.ts` now routes through `authorizeRuntimeRead`/`authorizeRuntimeMutation`
  using `caller.schoolId`, and `parseStrictTermAuthoritySchoolId` exists as a strict parser.
- **`Live data` published-run fact** — corrected from run 315 / revision 42 to run **317 / revision 43**.

## The "unattributed `hybrid-scheduler` runs" debt — RESOLVED: it is the readiness diagnostic

The long-standing live-state debt ("unattributed `hybrid-scheduler` benchmark runs … identify if not
the operator") is **the app's own canonical readiness diagnostic**, not an external benchmark:

- `GET /api/v1/generation/:schoolId/:schoolYearId/readiness/diagnostic` calls
  `buildGenerationReadiness` (`generation-readiness.service.ts:179`), which runs the **full
  `runHybridScheduler`** and logs one `[hybrid-scheduler] profile=…` line per candidate profile plus
  `Selected profile` and `Ejection repair`. The client fetches it (`timetableDataSources.ts:58`,
  `fetchTimetableReadiness`) with `force: true` from its caller (`useTimetableData.ts:1479-1481`,
  "readiness gates generation, so it is always re-verified"), so **each page mount/refetch runs a
  ≈7.4 s scheduler**.
- Observed `[hybrid-scheduler]` bursts in the supervisor log (UTC):
  `19:02:04–19:02:11`, `19:15:02–19:17:25`, `19:35:03–19:36:11`, `19:44:51–19:45:05`,
  `19:52:56–19:53:02` (list non-exhaustive; later invocations continue to `19:53:34Z`) — discrete bursts,
  **not continuous**; **no generation run persisted** (latest
  remains #317). Triggering one call myself reproduced the exact burst (`19:52:56–19:53:02`,
  `runtimeMs 7417`, `assigned 920 / unassigned 0 / profile SUBJECT_DESC_SECTION_ASC`).
- **Impact (measured):** one readiness call blocks the single-threaded server for ≈7.4 s; 12
  concurrent requests issued during it all returned **200 but were delayed to ≈7.6 s**. It did **not**
  reproduce the intermittent 502s. This is a real **latency** cost (a page load during a diagnostic
  waits), not a correctness defect — recorded as an observation, no change made.

## Anomaly — two undisclosed officer logins (flagged, not my cycle)

- Two `audit_logs` rows **933** (`2026-09-23T19:10:51.488Z`) and **934**
  (`2026-09-23T19:14:04.354Z`): `LOCAL_LOGIN_SUCCESS`, actor 46, school 1, `127.0.0.1`, Chrome —
  **not performed by this cycle** (it used the existing session) and not disclosed in the
  handoff/live-state. Row 932 was previously disclosed as the operator's own.
- **Action taken: none.** **Recommended:** the operator attribute rows 933/934.

## Scheduler-surface acceptance — still `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`

Unchanged from `EXPORT-CENTER-ACCEPTANCE-20260924`: the publication-approval inbox is
scheduler-role-gated (`useScheduleReviewWorkspaceState.ts:1923`), the persistent profile is an
**officer** session, and no scheduler credential/authorization was available. The collaboration
WebSocket is independently verified open. Exercising this row needs a scheduler-role login (a
mutation) or a scheduler credential.

## Recommended next actions (operator-facing)

1. Attribute `audit_logs` rows 933/934 (undisclosed officer logins).
2. Consider whether the readiness diagnostic should run the **full** scheduler on every client mount
   (≈7.4 s CPU, blocks other requests) or serve a cheaper cached/precomputed readiness — a design
   decision, not a defect.
3. Grant/deny the scheduler-role login for the publication-approval acceptance row.
4. Decide on the outstanding school-1 QA/admin **credential rotation** (long-standing security debt).
5. Decide ownership of the intermittent host/proxy 502 layer (unreproducible this cycle).
