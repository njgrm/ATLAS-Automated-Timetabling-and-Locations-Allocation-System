# DATA-CORRECTION-C01 - planner cycle handoff

ROLE: PRIMARY_PLANNER. Recommended reasoning variant: `high`. This is the
orchestration envelope, not the implementation: you own activation, registration,
review commissions, approval routing, validation, and closure. You do not perform
the write.

## Objective

One HIGH persisted-configuration write for school 1 / school year 9: reconcile the
G9/G10 `classProgramSlot` rows to the corrected canonical grids, and move the
cap-exceeding section-subject ownership pairs to qualified same-department peers -
the change that clears the expected `CANONICAL_TEMPLATE_INCOMPLETE` so generation
and the export surfaces can proceed.

## Immutable identity (re-read at start)

| Item | Value |
| --- | --- |
| `origin/main` | `1f6058802834ffb42c66f1d7e880f65a794c9901` at authoring - re-read and re-verify |
| Spec | `ops/workflow/specs/register/DATA-CORRECTION-C01.json` |
| Executor packet | `docs/prompts/data-correction-c01-2026-09-17.md` (read in full; it governs the write) |
| Expected worktree / branch | `E:/ATLAS-worktrees/data-correction-c01` / `chore/data-correction-c01` |
| Live release (precondition) | `8eb0511baa537d4212f24a007ac40e2dded38c0e` |
| Directive | read `origin/main:AGENTS.md` directly; record its blob and LF-SHA-256 |

## Preconditions - VERIFIED 2026-09-17, do not re-litigate

- The live release contains `G9G10-FLAG-SOURCE-LANE`, so its catalog already holds
  the corrected grids. A deploy is no longer required. (Applying the reseed against
  a runtime without the lane would fail closed in the opposite direction.)
- `class_program_slots.day_of_week` being NULL is **correct**: the canonical
  `catalogSlot(start, end, kind, label, note)` takes no day, and validation keys
  are `${startTime}-${endTime}-${rowKind}`. No day backfill is in scope.

## Measured pre-state (independently reproduced read-only)

| Surface | Value |
| --- | --- |
| `class_program_slots` total | 182 |
| G9/G10 REGULAR | **9 rows each** - `12:15-13:00 Lunch Break`, 7 CLASS, `15:15-15:30 Health Break` |
| Canonical at PIN40 | `GRADE_9_10_REGULAR` = **10 rows** - `11:30-12:15 BREAK`, 8 CLASS, Health; `GRADE_9_10_SPECIAL` = 12 |
| G7/G8 (must stay byte-identical) | 46 rows per grade: 10 REGULAR, 12 per special |
| `subject_section_ownerships` | 530 rows across 42 owning faculty; top five hold 22-25 sections |
| `faculty_subjects` | 183 rows |
| `section_mirrors` | year 9: 20 rows, `sum(enrolled_count)` = 0 (all 20 zero); year 8: 20 rows, sum 81 |
| Protected high-water (must not move) | `audit_logs` 248, `teaching_load_cycles` 2, `teaching_load_suggestion_proposals` 4 |

Target effect: unassigned `123 -> 64`, blockers `308 -> 113`,
`WORKLOAD_POLICY_BLOCK 244 -> 45`.

## Steps

1. **Activate.** `coordination-update --mode CYCLE_ACTIVE --active-cycle-id
   DATA-CORRECTION-C01 --expect-revision <rev read immediately before>`.
2. **Register.** `create-stream --stream-spec
   ops/workflow/specs/register/DATA-CORRECTION-C01.json --observed-origin-main
   <tip> --expect-revision <rev>`; confirm the lease and both gates exit 0.
3. **One fresh independent pre-action review** over the packet: the pre-state
   capture, backup and rollback, the transaction boundary, both correction
   scopes, the G7/G8 byte-identity control, the 8-row matrix, and the forbidden
   scope.
4. **On PASS only**, return the exact approval sentence with every placeholder
   filled - pin, backup target, and the acceptance matrix - modelled on:
   `I approve DATA-CORRECTION-C01 exactly as reviewed: <scope A> and <scope B> as
   specified in docs/prompts/data-correction-c01-2026-09-17.md, preceded by a
   verified logical backup to <backup-target> and a read-only pre-state capture,
   performed in one transaction, with rollback limited to restoring that backup.
   No schema, migration, generation, publication, Teaching Load apply, term-cache
   apply, rollover, deployment, runtime/task/env, or companion change is approved.`
5. **On approval:** `record-approval` binding the packet blob and LF-SHA-256, then
   dispatch **one fresh executor** with the executor packet.
6. **On `REVIEW_REQUIRED`:** verify the worktree is clean, the candidate is
   attributed, the pre/post measurement table shows every item PASS, the G7/G8
   scopes are proven unchanged, every other signature is delta 0, and no row is
   blocked or unperformed.
7. `record-execution`, then **one fresh post-action acceptance QA**, then
   `record-qa-result`.
8. **One fresh Wave Completion Auditor** (HIGH persisted write, max reasoning).
9. **On `AUDIT_CLEAR`:** `close-cycle` with receipt, retire the worktree,
   coordination to `MANUAL`. Then confirm the canonical readiness diagnostic
   clears and hand off to live generation as its own gated action.

## Boundaries and successors

Boundaries: no generation, publication, runtime/task/env change, migration,
Teaching Load apply, term-cache apply, rollover, or companion edit. The eight
G7/G8 scopes must remain byte-identical.

Locked successors: live generation (still separately approved), publication,
`TERM-CACHE-CATCHUP-APPLY`, `AUTHZ-CLASS-TEMPLATE-LIVE`, and the
`SSO-ENV-ACTIVATION-C01` lane (which must not overlap this write with a runtime
restart).

## Return contract

Report cycle state, the exact commit(s) or blocker, the gate tally, remaining
risks, and the single next action. Stop only for a genuine operator decision, a
failed safety gate, or completion.
