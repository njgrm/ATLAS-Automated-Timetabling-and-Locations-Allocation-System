# SYNC-SECTION-ENROLMENT-C01 — bounded live-data sync packet

Status: authored 2026-09-17 (Asia/Manila). A bounded live **mirror-data** sync, not a cutover,
migration, generation, or publication. Requires authorisation before the POST.

## 0. Immutable identity

- Directive: `origin/main:AGENTS.md`, blob `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88`,
  LF-SHA-256 `7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3`. Read from Git bytes.
- Base: the `origin/main` tip at dispatch (re-verify). Authoring base:
  `dd4f8552843863203bf49f1832baf4d4fa7b8e2a`.
- Risk tier: MEDIUM (live mirror write of derived, refreshable data). No schema, no migration.
- Worktree: `E:/ATLAS-worktrees/sync-section-enrolment-c01`, branch
  `chore/sync-section-enrolment-c01`, disposition `RETIRE_AFTER_INTEGRATION`.

## 1. Verified defect

The active school year's section mirrors carry **no enrolment counts**, although the upstream has
them (read-only probes, 2026-09-17):

| Source | Result |
|---|---|
| EnrollPro `GET /integration/v1/sections` (active year) | HTTP 200, `total: 20`, **20 of 20 rows with `enrolledCount > 0`**; sample Aguinaldo 4/40, Bonifacio 5/40, Luna 4/40, Mabini 4/40, Rizal 4/40; `meta.scope` = schoolId 4 "HINIGARAN NATIONAL HIGH SCHOOL", year 9 "2030-2031", `isActiveSchoolYear: true`, TRIMESTER |
| ATLAS `section_mirrors` school 1 / **year 9 (active)** | 20 rows, **all `enrolledCount = 0`** |
| ATLAS `section_mirrors` school 1 / year 8 | 20 rows, 81 learners total (previous year's values) |
| ATLAS adapter `section-adapter.ts:529-601` | Correct: reads `page.data` across pages (`limit=200`), wraps `{data: allRows}`, maps `enrolledCount`/`maxCapacity`. Relies on EnrollPro defaulting to the active year — which is year 9. |

Conclusion: neither EnrollPro nor the fetch code is defective. The year-9 section mirror was never
re-synced after the counts existed upstream; the active mirror's `syncStatus: setup-review-required`
corroborates this. A sync today would import all 20 counts.

Secondary lead: `cohort.service.ts:222` consumes `enrolledCount` for cohort/specialization sizing, so
zero enrolment may also distort specialization demand and contribute to the ~95 unassigned sessions.

## 2. Exact action

```
POST /api/v1/sections/sync
Auth: authenticateWithSystemToken + requirePrivilegedRole
      (system token OR a privileged JWT; NO browser login required)
Body: { "schoolId": 1, "schoolYearId": 9 }
```
Route `atlas-server/src/routes/section.router.ts:112-150`; service
`syncSectionsFromExternal(schoolId, schoolYearId, upstreamAuthToken)`; reconciles EnrollPro sections
into `SectionMirror`, publishes a `SECTION_SYNC_COMPLETED` notification event, and writes the section
snapshot. One POST. No retry, no replay.

Use `ATLAS_SYSTEM_TOKEN` from `D:\ATLAS-runtime-config\atlas-server.env` (never printed, never logged).

## 3. Preflight (zero-cost, immediately before the POST; any divergence is a STOP)

1. Register revision and mode read from `origin/main`.
2. `ATLAS` y9 baseline: `section_mirrors` where schoolId 1 / schoolYearId 9 → 20 rows,
   **0** with `enrolledCount > 0`.
3. Upstream re-probe: `GET /integration/v1/sections` → 200 with 20 rows and `enrolledCount > 0`
   on all of them; active year id = 9.
4. Exactly one active, non-archived `EnrollProSchoolYearMirror` for school 1, `enrollProSchoolYearId` 9.
5. Record the full pre-state signature set: `section_mirrors`(y9), `section_snapshots`, `audit_logs`,
   `notifications`/notification-outbox, and `enrolledProSchoolYearMirrors` updated_at.

## 4. Acceptance (post-action)

| # | Row | Pass condition |
|---|---|---|
| 1 | Sync response | 200; `count` = 20 (or 20 synced / 0 removed) |
| 2 | y9 mirror counts | **20 of 20** rows `enrolledCount > 0`; total equals the upstream total computed from the same probe |
| 3 | Row identity | same 20 section names/ids as before; no rows added or removed; `maxCapacity` unchanged (40) |
| 4 | Scope discipline | only school 1 / year 9 rows changed; **year 8 rows byte-identical** |
| 5 | Snapshot | exactly one `section_snapshots` row for school 1 / y9 updated (or created) with the new checksum |
| 6 | Notification | exactly one `SECTION_SYNC_COMPLETED` event |
| 7 | Audit | the expected sync audit row(s) only; no other audit class |
| 8 | Protected domains | TeachingLoadCycle, FacultySubject, SubjectSectionOwnership, GenerationRun, PublishedScheduleRevision, classProgramSlot all delta 0 |
| 9 | Health | `/api/v1/health/ready` still 200 with `database: ok` |
| 10 | Mirror status | report the resulting `syncStatus` on the active mirror (expected to advance off `setup-review-required`, or state precisely what remains) |

## 5. Rollback

The sync is idempotent and refreshable from the same read-only source; the rollback is a re-run
against the same upstream, or restoring the recorded y9 pre-values. No destructive path exists.
Do NOT hand-edit `section_mirrors`.

## 6. Proposed exact approval sentence (return verbatim BEFORE the POST)

> "I approve SYNC-SECTION-ENROLMENT-C01 exactly as reviewed: one authenticated
> `POST /api/v1/sections/sync` with body `{"schoolId":1,"schoolYearId":9}` using the ATLAS system
> token, to reconcile the 20 EnrollPro year-9 sections into ATLAS `section_mirrors`. No rollover,
> Teaching Load, generation, publication, migration, deployment, runtime/task/env change, or
> companion action is approved."

## 7. Boundaries

One POST, one school, one year. No other ATLAS endpoint. No rollover/term-cache apply, no Teaching
Load write, no generation, no publication, no migration, no deployment/restart, no env or task change.
EnrollPro is READ_ONLY and is read only through this existing ATLAS route. Do not probe EnrollPro
directly beyond the preflight GET.

## 8. Return contract

Pre-state signature table; the exact request (token redacted); the response body; the post-action
acceptance table with the y9 count total; the resulting mirror `syncStatus`; the delta table for every
signature; rollback statement; approval status; register state; push status; worktree disposition;
single next action.

## 9. Registration annex

Register only when the register is free (CAS). Sequence: `create-stream` (spec
`ops/workflow/specs/register/SYNC-SECTION-ENROLMENT-C01.json`) → lease → `record-approval` (WF-C10
capability; if not yet available, record the grant in committed evidence and note the under-report) →
execute → `record-execution` → verify → close. Re-read `registry.revision` before every transition.
