# DATA-CORRECTION-C01 — persisted-configuration correction packet (HIGH)

Status: authored 2026-09-17 (Asia/Manila). One HIGH persisted-configuration write covering **two** live
corrections for the same school/year. Fingerprinted preview, fresh independent pre-action review, and the
operator's **exact** approval sentence before any write. No schema change.

## 0. Identity

- Directive pin: `origin/main:AGENTS.md` blob `58e0535adff79c0f01da52fb49525443a5b52603`,
  LF-SHA-256 `e7ea7f7d6b2bb36a41c7d3be29063f70900163c75de605880ac958bf1f02aa11`. Read from Git bytes.
- Base: `origin/main` at dispatch. Authoring base `056f2e4bf3e3beca20d52aa0ab4f96ab19875f01`.
- Worktree `E:/ATLAS-worktrees/data-correction-c01`, branch `chore/data-correction-c01`,
  disposition `RETIRE_AFTER_INTEGRATION`. Risk **HIGH** (live configuration data).
- Target: school 1 / school year 9 only.

## 1. HARD SEQUENCING PRECONDITION

**Do not execute before BOTH of these are true:**
1. `G9G10-FLAG-SOURCE-LANE` is integrated (its catalog defines the corrected canonical grids), **and**
2. a deployment whose pin contains that lane is live.

Reason: the lane changes the *expected* canonical grid, so the live 182 `class_program_slots` rows become
non-conforming the moment it lands and the preflight fails closed on `CANONICAL_TEMPLATE_INCOMPLETE`.
Applying the reseed against a runtime that lacks the lane would make the live grid inconsistent in the
opposite direction. If either condition is unmet, STOP and report.

## 2. Correction A — canonical grid reseed (school 1 / year 9)

Bring the persisted rows for the affected scopes to exact equality with
`getExpectedCanonicalSlots(gradeLevel, programType)` (order-insensitive set equality):

- **g9-REGULAR, g10-REGULAR** -> 8 CLASS + 2 BREAK, lunch BREAK `11:30-12:15`, first CLASS `12:15-13:00`,
  Health BREAK `15:15-15:30`, span `11:30-18:30` (= 420 min = 8x45 + 45 + 15).
- **g9/g10 STE/SPA/SPS (6 scopes)** -> 10 CLASS + 2 BREAK, lunch BREAK `11:30-12:15`, pre-lunch
  Specialization block two rows (`09:45-10:30`, `10:30-11:15`), unmodelled `11:15-11:30` seam, shift
  `09:45-18:30`.
- **The g7/g8 scopes (8) must remain byte-identical.**

Note `seedClassProgramSlots` does not overwrite existing groups — the executor must use a method that
actually reconciles existing rows (replace-in-place per scope) and must prove the rollback can restore the
old grid. If no sanctioned path can overwrite, return `PLANNER_DECISION_REQUIRED` rather than inventing one.

## 3. Correction B — Teaching-Load ownership rebalance (21 rows)

Measured cause of the 244 `WORKLOAD_POLICY_BLOCK`s: **207** from the per-term weekly cap
(`schedule-constructor.ts:1841`, `facultyMax = maxHoursPerWeek*60 = 1800`) because **7 FIL/ESP/ENG/MATH
owners hold 10 section-subject pairs = 2250 min/term (125% of cap)** while **5 qualified same-department
peers hold zero** (FIL 1/7/10, ESP 34/37). Demand 41,625 vs capacity 75,600 min/term (55% utilisation).

Move the 10 pairs off the overloaded owners to those qualified peers, and update **both**:
`subject_section_ownerships.faculty_id` **and** the receiving teacher's year-9
`faculty_subjects.section_ids` (ownership alone yields `FACULTY_SUBJECT_NOT_QUALIFIED = 14`).

Measured effect (disposable-DB A/B, artifact `docs/analysis/workload-policy-blocker-diagnostic-2026-09-17.md`):
**assigned 802 -> 861, unassigned 123 -> 64, blockers 308 -> 113, WORKLOAD_POLICY_BLOCK 244 -> 45**, with
the weekly-cap rule driven to **zero**.

**Forbidden as gaming (measured and rejected):** raising the 7 caps (30h -> 38h), or setting
`allowFlexibleSubjectAssignment` (no effect). Neither may be used.

## 4. Preflight (zero-cost, immediately before the write; any divergence is a STOP)

1. Confirm the two §1 preconditions.
2. Re-measure the 16-scope rowKind table and diff each scoped row against `getExpectedCanonicalSlots`.
3. Record the full signature set: `class_program_slots`, `subject_section_ownerships`, `faculty_subjects`,
   `policy_special_events`, `scheduling_policies`, `audit_logs` high-water, active mirror `syncStatus`.
4. Re-confirm the ownership imbalance (which 7 owners, which 10 pairs, which 5 receivers and their
   qualification rows).
5. Confirm the register revision and that no other stream holds a revision window.

## 5. Acceptance

| # | Row | Pass condition |
|---|---|---|
| 1 | Grid equality | every affected scope equals `getExpectedCanonicalSlots` exactly; g9/g10 REGULAR 8 CLASS; specials 10 CLASS with lunch `11:30-12:15` |
| 2 | Untouched scopes | the 8 g7/g8 scopes byte-identical pre/post |
| 3 | Ownership | the 10 pairs moved; receivers' `faculty_subjects.section_ids` updated; **0** new `FACULTY_SUBJECT_NOT_QUALIFIED` |
| 4 | Readiness delta | unassigned and every typed blocker count re-measured and reported truthfully vs the 123 / 308 baseline |
| 5 | Blockers not gamed | `WORKLOAD_POLICY_BLOCK` reduced by ownership change only; caps unchanged; `allowFlexibleSubjectAssignment` unchanged |
| 6 | Blast radius | only `class_program_slots`, `subject_section_ownerships`, `faculty_subjects` (+ their audit rows) differ; subjects, sections, faculty mirrors, TeachingLoadCycle, GenerationRun, PublishedScheduleRevision, `policy_special_events`, `scheduling_policies` delta 0 |
| 7 | Health | `/api/v1/health/ready` still 200 with `database: ok` |
| 8 | Revert control | a byte-exact revert of both corrections restores the recorded pre-state and the 123 / 308 baseline |

## 6. Rollback

Restore the recorded §4 pre-values for `class_program_slots`, `subject_section_ownerships` and
`faculty_subjects` (+ `faculty_subjects.section_ids`). No destructive path, no schema rollback, no
`_prisma_migrations` touch. The revert control in row 8 proves it.

## 7. Proposed exact approval sentence (return verbatim ONLY after the fresh pre-action review passes)

> "I approve DATA-CORRECTION-C01 exactly as reviewed: (A) reconcile the school-1 / year-9
> `classProgramSlot` rows for g9/g10 REGULAR and STE/SPA/SPS to the corrected canonical grids (afternoon
> lunch 11:30-12:15; REGULAR 8 CLASS; specials 10 CLASS) leaving the g7/g8 scopes byte-identical, and
> (B) move the 10 section-subject ownership pairs off the 7 cap-exceeding FIL/ESP/ENG/MATH owners to the 5
> qualified same-department peers, updating both `subject_section_ownerships.faculty_id` and the
> receivers' `faculty_subjects.section_ids`, with the recorded rollback. No cap change, no
> `allowFlexibleSubjectAssignment` change, and no other table, row, schema, migration, generation,
> publication, Teaching Load apply, runtime/task/env, deployment, or companion action is approved."

## 8. Boundaries

School 1 / year 9 only. No schema/migration, no generation, no publication, no term-cache apply, no
rollover, no deployment/restart, no env/task change, no companion edit. Do not touch
`ops/workflow/**`, the register (the stream's own CAS transitions only), or the sync mirror.

## 9. Registration annex

Register by CAS when the register is free and after `G9G10-FLAG-SOURCE-LANE` has integrated; spec
`ops/workflow/specs/register/DATA-CORRECTION-C01.json`. Sequence: `create-stream` -> lease -> fresh
pre-action review -> the operator's exact sentence -> preflight -> write -> acceptance -> fresh Wave
Completion Auditor -> `record-audit` -> `close-cycle --receipt`. Move coordination to `MANUAL` before
`record-integration`; return the lease before `close-cycle`.
