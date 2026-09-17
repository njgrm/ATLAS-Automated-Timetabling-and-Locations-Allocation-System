# RESUME — active-year demo path (2026-09-18)

**Read this first after a compaction or in a fresh session.** It is the strategic
state; the machine register (`docs/plans/atlas-delivery-cycles.json`, revision 366)
and Git are the authority for details.

## The objective

Get to a presentable live demo: the **export surfaces** (class / teacher / room /
summary) and the corrected **Teaching Load + dynamic-timetable UX**, working on the
**active school year 551 (2031-2032)** at `https://njgrm.buru-degree.ts.net`.
**Never the archived year 223 (2030-2031).** In parallel: SSO with EnrollPro.

## Live state (verified this session)

| Item | Value |
| --- | --- |
| Live release | `78be1b760e4059a4c0d0ea227579eaeb731cdf6d` at `D:\ATLAS-runtime-supervised-78be1b760e40-20260918` |
| Listeners | 5001→42904, 5174→27044 (task-launched `\ATLAS-Runtime-Supervisor`, SYSTEM) |
| Rollback | `8eb0511baa537d4212f24a007ac40e2dded38c0e` — proven by execution, intact |
| `origin/main` | `df90552f`; register rev **366**; mode `CYCLE_ACTIVE` = `DATA-CORRECTION-C01` |
| **The `/timetable` React #310 crash is FIXED** | 30-route crawl clean, verified twice independently |

## What was achieved this session

1. **Client-quality wave COMPLETE** — `CLIENT-QUALITY-C01` (source) + `CLIENT-QUALITY-RELEASE-SWAP-01` (HIGH deploy). The deploy fixed the live `/timetable` crash, the `remainingHours` null deref, and four UX findings (Run Health card removed, archived load in-page, truth panel collapsed, banner dismissible), and added the three missing gates (ESLint `react-hooks` + `no-explicit-any` ratchet via a scoped lockfile toolchain, client `tsc --noEmit`, route smoke spec).
2. **Directive ceremony cut applied** (increments 1–2): browser QA normalized (no per-instance login approval), Tier A exempted from receipts/leases/auditors, prose register retired, Wave Auditor narrowed to Tier B. Staged rules R1–R19 live in `docs/plans/directive-revision-proposal-2026-09-17.md`.
3. **Durable finding:** a SYSTEM-run supervisor cannot resolve a release pinned in a worktree owned by the interactive user — `safe.directory` is per-user and does **not** help. The release root, its `.git`, and `D:\ATLAS\.git\worktrees\<release>` must be owned by `BUILTIN\Administrators`.

## The active-year blocker picture (CORRECTED — the earlier "not set up" claim was WRONG)

### The identity trap that caused the error

The mirror table has **two identifiers**. `EnrollProSchoolYearMirror` rows are:

| Local `id` | `enrollProSchoolYearId` | Label | isActive | isArchived |
| --- | --- | --- | --- | --- |
| 1 | 8 | 2029-2030 | false | **true** |
| 223 | 9 | 2030-2031 | false | false |
| **551** | **10** | **2031-2032** | **true** | false |

`resolveSoleActiveNonArchivedYear` (`derived-demand.service.ts:904`) returns the
**`enrollProSchoolYearId`** — i.e. **10** — and the **data tables key `schoolYearId`
on that upstream value**. Querying or calling the diagnostic with the mirror row id
`551` matches nothing, so every count reads 0 and the year check fails with a
**false `INACTIVE_HISTORICAL_YEAR`**. Always use **`schoolYearId = 10`** for the
active year 2031-2032. (The archived prior year is `9`; its mirror row id is 223.)

### The real diagnostic for the active year (schoolYearId=10)

`GET /api/v1/generation/1/10/readiness/diagnostic` → `status: BLOCKED`,
`generateAllowed: false`, but **`schedulerExecuted: true`** and the year is fully
set up:

- `derivedDemandBlockers: []`; terms **T1/T2/T3** (TRIMESTER); demand **925 sessions
  per term** (555 lines / 265 pairs)
- **Teaching Load 265/265 owned, 0 missing, 0 inactive/stale** ✓
- **All 16 class-program scopes present with 0 issues** (G7–G10 × REGULAR/STE/SPA/SPS) ✓
- Policy present (45 min periods, 10/day, max 480 teaching min/day); 98 rooms,
  4379 capacity ✓

### The 66 genuine blockers, by class

| Count | Code | Meaning |
| --- | --- | --- |
| 8 | `FLAG_CEREMONY_SCOPE_INVALID` | The policy Flag Ceremony/HGP window **07:00–07:30** is contained by no canonical CLASS row. The shape signatures render the flag at **09:00–09:15** (G7/G8) and **15:15–15:30** (G9/G10). Affects G9 + G10 × all four programs. |
| 3 | `CANONICAL_SHAPE_CAPACITY_EXCEEDED` | **G10 STE requires 55 weekly sessions but only 50 canonical CLASS slots exist** (T1, T2, T3). Fix by reducing demand, correcting the canonical shape, or splitting the section — never by widening the shift. |
| 24 | `WORKLOAD_POLICY_BLOCK` | Every candidate owner is at their workload/slot limit for the session. |
| 26 | `ROOM_RESOURCE_UNAVAILABLE` | No room matched the required type/features/capacity. |
| 5 | `SEARCH_LIMIT_UNRESOLVED` | Scheduler could not place the session (`NO_AVAILABLE_SLOT`) within its bounded search. |

Two further **product decisions** are recorded in `decisionNotes`:
1. The Friday variant allowing ARAL to be replaced by TLE is not encoded as schedulable.
2. A **duplicate 12:15–13:00 row**: Lunch Break remains blocked for class placement,
   but an overlapping Flag Ceremony/HGP/TLE row remains template drift pending a
   Product decision.

### Consequences

- **`DATA-CORRECTION-C01` is mis-targeted**: it operates on the archived year and its
  four blocking findings make it unapprovable. The demo needs a **policy + shape +
  capacity correction on year 10**, in this priority order: (1) align the policy Flag
  Ceremony window with the canonical per-shift rows, (2) resolve the G10 STE 55-vs-50
  capacity conflict, (3) review workload limits, (4) review room type/feature
  classification, (5) place the 5 unplaced sessions.

## Immediate next action

**Investigate the `FLAG_CEREMONY_SCOPE_INVALID` blocker** — 8 of the 66, and the one
most likely to be a policy-configuration defect rather than a demand/resource reality.
Start from the policy's flag-window fields and the shape-signature rendering path
(`generation-preflight.service.ts` around the flag-scope validation, and the
`shapeSignatures` producer). Confirm whether the policy can express a per-shift or
day-scoped flag window; if it cannot, that is a code change, and if it can, it is a
policy data correction.

## Stream states

| Stream | State | Note |
| --- | --- | --- |
| `CONSOLIDATED-DEPLOYMENT-C10` | `COMPLETE` | deployed PIN40, receipt pinned |
| `CLIENT-QUALITY-RELEASE-SWAP-01` | `COMPLETE` | receipt pinned, `AUDIT_CLEAR` 9/9 |
| `CLIENT-QUALITY-C01` | source accepted/integrated | its own closure needs a fresh QA to record the now-unblocked live gate L2 |
| `DATA-CORRECTION-C01` | `CORRECTION_REQUIRED` | **4 blocking findings**: (F1) the heading says 21 ownership rows but the body authorizes "10 pairs to 5 peers", and only 21 rows yields the stated effect; (F2) `SubjectSectionOwnership.facultySubjectId` (required FK) is omitted and the five zero-ownership peers have no year-9 `faculty_subjects` row; (F3) acceptance rows 4/8 rest on a pre-lane 123/308 baseline that no longer exists (the preflight now fails closed on `CANONICAL_TEMPLATE_INCOMPLETE`); (F4) no verified backup and no single-transaction requirement |
| `SSO-ENV-ACTIVATION-C01` | registered, not approved | independent of the demo; one restart |
| Generation / publication / term-cache / TL applies | locked | separate HIGH approvals |

## Outstanding register-truth fix

The `DATA-CORRECTION-C01` stream text still claims `8eb0511b` "is serving 5001/5174
(verified: listeners 18348/48244)" — that release is **stopped**. Reconcile it, and
correct the stream's `nextAction`, before the next dispatch. The four blocking
findings also mean the packet and its `approvedActions` need re-authoring (or the
lane should be re-scoped to the active year).

## Durable references

- Register: `docs/plans/atlas-delivery-cycles.json` (rev 366) + generated projection.
- Packets: `docs/prompts/client-quality-release-swap-01-2026-09-17.md`, `docs/prompts/data-correction-c01-2026-09-17.md`.
- Evidence: `docs/reviews/client-quality-c01/` (execution evidence + release-swap evidence + wave audit capsule).
- Reform staging: `docs/plans/directive-revision-proposal-2026-09-17.md` (R1–R19) and `docs/prompts/directive-revision-r1-2026-09-17.md`.
- Live runtime map: `docs/reference/atlas-runtime-source-of-truth-map.md`.
- Runtime contract: `ops/runtime/runtime-contract.json` (`productPin d44f29e0`, machine vars `ATLAS_RUNTIME_SOURCE_DIR` / `_RELEASE_SHA` / `_ENV_FILE`).
