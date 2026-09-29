# A8 unblock packet — the Generate panel must not claim a teacher is "at their limit" when the real reason is no free period

Lane A8 (generation), 2026-09-29/30. Base `aeb1bd2c` (`origin/main` tip). Branch
`work/a8-unblock-generation-truth`. Worktree `E:/ATLAS-worktrees/lane-a8-unblock`.
**One writer: this packet's executor, then the planner.**

Risk **MEDIUM**. This packet changes a user-facing *claim* and its server-side
`reason`/`entity` text. It changes **no gate**: `generateAllowed`, the blocking
/advisory sets, `resolveUnassignedViolationCode`, and every publication predicate
stay exactly as they are. The blocker CODE is unchanged.

## Authority boundary — NOT authorized

| Not authorized | Why |
| --- | --- |
| Deploying anything | §14: only Lane A4 deploys |
| A generation run (prod OR staging), any rollover sync, publication | HIGH, §13 |
| Any write to the live/shared database | HIGH, §13 |
| Migration / schema / runtime / env / task change | HIGH, §13 |
| Companion (EnrollPro/AIMS/SMART) edits | §4 READ_ONLY |
| Editing `E:/ATLAS-worktrees/lane-a8-c5-fixable` (A8 c5, still running) | separate active writer |

Authorized: source + test edits inside this worktree; client unit tests; the
hermetic server suites; nothing else.

## Reproduction (planner, against a read-only restore of LIVE)

Fresh `pg_dump -Fc` of live (`atlas_recovery_clean_rebuild_20260905`) restored
into the disposable `atlas_restore_drill_20260929_a8unblock`, then the real
production builder `buildGenerationReadiness(1, <yearId>)` was run.

- Live release `8d98628d`. EnrollPro's live active year moved during the session
  (id 4 "2025-2026" -> id 5 "2026-2027"); ATLAS mirror 632 (`is_active=true`) is
  ep4/2025-2026, so ATLAS reports `drift: atlas-stale` / `RUN_ROLLOVER_SYNC`.
- **Year 3 (2024-2025 / mirror 631)**: `generateAllowed:false`; blockers
  `INACTIVE_HISTORICAL_YEAR` + `TERM_AUTHORITY_UNRESOLVED` (`termStructure:null`).
- **Year 4 (2025-2026 / mirror 632, the active year)**: Teaching Load is complete
  (`requiredPairs 268 / ownedPairs 268 / missingPairs 0`); terms `TRIMESTER
  T1/T2/T3`; the scheduler ran (assigned 910, unassigned 30); blockers
  `CANONICAL_SHAPE_CAPACITY_EXCEEDED` (12), `SEARCH_LIMIT_UNRESOLVED` (15, section
  70 `COMED`, `NO_AVAILABLE_SLOT`), and `WORKLOAD_POLICY_BLOCK` (55 rows, ADVISORY
  — not counted in `blockerCount`, which was 27 = 12 + 15).
- Policy for both years: `teaching_standard_minutes = 1800` (**30 h**),
  `hard_cap_minutes = 2400`. The dry run produced **zero** hard
  `FACULTY_OVERLOADED` violations (`hardCount 0`; only SOFT codes).
- `generation-preflight.service.ts:430`:
  `if (item.reason === 'FACULTY_OVERLOADED' || roomReason === 'FACULTY_SLOT_UNAVAILABLE')`
  returns ONE code `WORKLOAD_POLICY_BLOCK` with
  `reason: 'Every candidate owner is at their workload/slot limit for this session.'`
  But `FACULTY_SLOT_UNAVAILABLE` is set for a **bare slot collision**
  (`schedule-constructor.ts:3170-3171`, `sawFacultySlotUnavailable`) as well as a
  cap breach. The scheduler-facing line therefore asserts a cap breach that did
  not happen.
- Client `atlas-client/src/lib/timetable-generation-readiness.ts`
  `GROUP_CAUSE_COPY.WORKLOAD_POLICY_BLOCK = { noun: 'classes', verb: 'have a
  teacher at their limit' }` renders **"55 classes have a teacher at their
  limit"** — the operator's exact words — although no teacher is over 30 h.

## Slices

### S1 — the server reason tells the truth and names the owner

`atlas-server/src/services/generation-preflight.service.ts`, the
`FACULTY_OVERLOADED || FACULTY_SLOT_UNAVAILABLE` branch (lines ~430-438):

- Replace the `reason` with a truthful sentence: the class's owner has **no free
  period** left for this session in its term; when the refusal is the cumulative
  weekly-cap case, say so. It must not assert a limit that the data does not show.
  Keep `code: 'WORKLOAD_POLICY_BLOCK'`, `category: 'POLICY_BLOCKER'`, and the
  existing `owningSurface`/`nextAction` (they are correct: the fix is Teaching
  Load / the scheduling policy).
- **Name the owner.** Add an optional `facultyName?: string | null` to the
  classifier's `item` parameter and include it in `base.entity` when present
  (e.g. `Section 66 · Subject STE_APPLIED_PHYS · T1 · session 1 · owner <name>`).
  Do not change the classifier's return *shape* otherwise.

`atlas-server/src/services/generation-readiness.service.ts` (~440-445): the caller
already has `item.facultyId`. Build a `facultyId -> name` map from the preflight
assembly (extend the `facultyMirror.findMany` select in
`buildGenerationPreflightWithContext` with the name field(s) and expose it on the
assembly) and pass `facultyName` through for each unassigned item. If a name
cannot be resolved, pass `null` and render only the term — never invent one.

### S2 — the client sentence stops claiming a cap breach

`atlas-client/src/lib/timetable-generation-readiness.ts`,
`GROUP_CAUSE_COPY.WORKLOAD_POLICY_BLOCK.verb`: change
`'have a teacher at their limit'` to a truthful verb, e.g.
`'have no free period with their teacher'`, so the line reads
"55 classes have no free period with their teacher". Change ONLY that string;
leave the other rows and the noun/singularisation untouched.

**This is the one row A8 c5 does not fix.** c5 rewrites this map into
`lib/timetable-blocker-code-copy.ts` but keeps
`WORKLOAD_POLICY_BLOCK: '{one} with a teacher at their weekly limit'` — the same
false claim. State in the handoff that c5's table row must become the same
truthful sentence when c5 merges (expected mechanical conflict in this map).

## Acceptance rows — each names its harness

| # | Row | Harness |
| --- | --- | --- |
| A1 | `classifyUnassignedBlocker` with `roomAssignmentReason:'FACULTY_SLOT_UNAVAILABLE'` returns the truthful "no free period" reason (no "limit"), and with a resolved owner name the `entity` contains that name; `reason:'FACULTY_OVERLOADED'` still returns `WORKLOAD_POLICY_BLOCK`. Adding this assertion must **fail on base** and pass on the fix (failing-first control). | `atlas-server/src/__tests__/a8-c3-generate-with-gaps.test.ts` (script `test:a8-c3-generate-gaps`) |
| A2 | A `buildGenerationReadiness` result for a fixture where a class is refused for a slot collision carries a `WORKLOAD_POLICY_BLOCK` reason that does not contain "limit". | same server suite (hermetic fixture; no DB) |
| A3 | The client sentence for `WORKLOAD_POLICY_BLOCK` no longer contains "limit" and is non-empty. | `atlas-client/src/lib/__tests__/uxc01r-generation-readiness.test.ts` (script `test:uxc01r`) |
| A4 | No gate moved: `generateAllowed`/blocking/advisory membership unchanged; `test:a8-c3-generate-gaps` + `test:server-suite` stay green. | repo scripts |
| G1 | server `tsc --noEmit` + client `tsc --noEmit` + client build | repo scripts |
| G2 | `git diff --check` clean over the candidate range | git |

Both changed test files are already reachable from committed scripts
(`test:a8-c3-generate-gaps`, `test:uxc01r`); if you add a NEW test file it must be
added to a committed `package.json` script in the same commit.

## Explicitly out of scope (report, do not fix)

- `INACTIVE_HISTORICAL_YEAR` / `TERM_AUTHORITY_UNRESOLVED` for a non-active year —
  the year identity question is a product/rollover-sync decision (HIGH), not this
  packet.
- `CANONICAL_SHAPE_CAPACITY_EXCEEDED` (12) and `SEARCH_LIMIT_UNRESOLVED` (15) for
  the active year — TRUE blockers; the scheduler action is a shape/period fix and
  is written by the planner.
- The `atlas-stale` drift to EnrollPro year 5 — a rollover sync (HIGH).

## Throughput and hygiene

- Commit `wip(a8-unblock): ...` and push at least every 30 minutes.
- Never `git checkout --`, `reset --hard`, `clean`, or revert uncommitted work.
- Corrections are ADDITIVE new commits; never amend or rebase a handed-off commit.
- No helper scripts left in the tree; no PowerShell `Get-Content | Set-Content`
  round-trips on repo files.
- Never echo a credential; never read `D:\ATLAS-runtime-config\atlas-staging-qa.env`.
- No server/watcher in a foreground shell call.
- Bare test runs never touch live: DB-writing suites only via `npm run test:server-db`.

## Deliverable

One candidate SHA on `work/a8-unblock-generation-truth` plus a one-page handoff:
base · candidate · exact changed paths · what changed and why · the decisive
commands with results · risks marked `BLOCKING` / `NON_BLOCKING` · the A-row tally
with each row's own result (`passed`/`blocked`/`unperformed` + reason).
