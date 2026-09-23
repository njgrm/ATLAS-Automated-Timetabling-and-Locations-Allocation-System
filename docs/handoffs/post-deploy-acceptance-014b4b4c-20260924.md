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

12 routes navigated; each renders a real surface, **no error boundary**, **no global document
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
| `section-program.docx?sectionId=141&termIndex=2` | **200** | 9,873 |
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

## Anomaly — unattributed benchmark + two logins (flagged, not my cycle)

Discovered while reconciling the runtime, **not attributable to this or the prior planner cycle**:

- A continuous `[hybrid-scheduler]` profile benchmark ran **2026-09-23T19:02:04Z – 19:17:25Z**
  (≈15 min, cycling 7 profiles, `Ejection repair` each pass) with **no persisted generation run**
  (latest run remains #317, 2026-09-22). The server restarted at 19:01:28Z as part of the
  `014b4b4c` deploy, so the benchmark started ≈15 s after boot.
- Two `audit_logs` rows **933** (`2026-09-23T19:10:51.488Z`) and **934**
  (`2026-09-23T19:14:04.354Z`): `LOCAL_LOGIN_SUCCESS`, actor 46, school 1, `127.0.0.1`, Chrome —
  **not performed by this cycle** (it used the existing session) and not disclosed in the
  handoff/live-state. Row 932 was previously disclosed as the operator's own.
- **Action taken: none** (cannot attribute; not this lane's authority to terminate another
  session's work). **Recommended:** the operator attribute the benchmark and rows 933/934, and
  confirm whether a second agent/session is running benchmarks against the live runtime.

## Scheduler-surface acceptance — still `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`

Unchanged from `EXPORT-CENTER-ACCEPTANCE-20260924`: the publication-approval inbox is
scheduler-role-gated (`useScheduleReviewWorkspaceState.ts:1923`), the persistent profile is an
**officer** session, and no scheduler credential/authorization was available. The collaboration
WebSocket is independently verified open. Exercising this row needs a scheduler-role login (a
mutation) or a scheduler credential.

## Recommended next actions (operator-facing)

1. Attribute the 19:02–19:17Z `hybrid-scheduler` benchmark and logins 933/934; confirm no second
   agent is benchmarking the live runtime.
2. Grant/deny the scheduler-role login for the publication-approval acceptance row.
3. Decide on the outstanding school-1 QA/admin **credential rotation** (long-standing security debt).
4. Decide ownership of the intermittent host/proxy 502 layer (unreproducible this cycle).
