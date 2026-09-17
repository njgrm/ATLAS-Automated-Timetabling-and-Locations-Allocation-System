# G9-G10-CONFIG-CORRECTION-C01 — REVISION 2 (supersedes the original packet AND its R1 note)

Status: authored 2026-09-17 (Asia/Manila). Read this file instead of
`docs/prompts/g9-g10-config-correction-c01-2026-09-17.md`; R2 supersedes that packet's §1 Part A **and**
its appended R1 block in full. This is a **persisted-configuration write** (HIGH): fingerprinted
preview, fresh independent pre-action review, and the operator's exact approval before any write.

## R2.0 Correction record — read this first

- The **R1 block is withdrawn.** R1 asserted that the G9/G10 REGULAR grid is correctly 7 CLASS rows and
  that adding an 8th row would corrupt a canonical grid. **That was wrong**, and its "do not add an 8th
  row" instruction must not be followed.
- **The operator has confirmed 8 CLASS rows for G9/G10 REGULAR after checking directly** (2026-09-17).
  The operator's original decision D-D is correct; my R1 analysis was not.
- R1's error: it derived the count from the DNO template's Grade 9 page, whose rows include a duplicated
  `12:15 - 1:00` row and an `11:15 - 12:15` **ARAL-Reading** row. Counting those out gave 7 and I
  treated the template as authoritative over the operator's own verified count. The template is a
  stakeholder **draft** with known drift; the operator's check is authoritative.
- The two STE images (`grade9STE_Sched.jpg`, `grade10STE_Sched.jpg`) are **not** REGULAR sections
  (G9 shows Applied Chemistry / Research III; G10 is `STE-FELIX MARAMBA`), so they neither supported nor
  refuted the 7. They remain valid evidence for the **Special Program** family only.

## R2.1 Verified arithmetic — the missing row is pinned

With the operator's D-D break times (Lunch `12:15 - 13:00`, Health `15:15 - 15:30`) and **8 CLASS rows**
of 45 minutes, exactly one layout fits:

```
11:30 - 12:15   CLASS   1
12:15 - 13:00   LUNCH BREAK
13:00 - 13:45   CLASS   2
13:45 - 14:30   CLASS   3
14:30 - 15:15   CLASS   4
15:15 - 15:30   HEALTH BREAK
15:30 - 16:15   CLASS   5
16:15 - 17:00   CLASS   6
17:00 - 17:45   CLASS   7
17:45 - 18:30   CLASS   8
```
`8 x 45 + 45 + 15 = 420 min`, and `11:30 -> 18:30` is exactly 420 minutes. So the G9/G10 REGULAR shift
runs **11:30 - 18:30**, and the persisted grid's only defect is a **missing `11:30 - 12:15` CLASS row**
(our grid begins at `12:15` with the lunch, which is why it counts 7).

**Read-only confirmation of the persisted defect (2026-09-17):** `g9-REGULAR` and `g10-REGULAR` each
hold 9 rows = 2 BREAK + 7 CLASS, beginning with `12:15-13:00 BREAK Lunch Break` and ending
`17:45-18:30 CLASS`. All 14 other scopes conform (morning REGULAR 8 CLASS + 2 BREAK; Special Program
10 CLASS + 2 BREAK).

**The arithmetic must still be confirmed against the authoritative source before the write.** If
`getExpectedCanonicalSlots(9|10, 'REGULAR')` yields the `11:30 - 12:15` row, the catalog is correct and
only the data needs repair. If it yields 7 rows, the **catalog itself is defective** and must be fixed in
`atlas-server/src/services/class-program-slot.service.ts` as a source change, then reseeded. Do not
invent an interval that neither the catalog nor the operator confirms: return
`PLANNER_DECISION_REQUIRED` with the diff.

## 1. Required corrections

**Part A — add the missing `11:30 - 12:15` CLASS row to g9-REGULAR and g10-REGULAR.**
Each scope must end with **8 CLASS rows + 2 BREAK rows = 10 rows** and shift bounds `11:30 - 18:30`.
Derive the row (rowKind, subject label, source note) from the canonical template; when the catalog is
correct this is a data repair, when it is defective it is a source change plus a reseed. Preserve all 14
other scopes byte-for-byte.

**Part B — make the Monday-only Flag/HGP overlay representable per scope.**
`scheduling_policies` for school 1 / year 9 has `enableFlagCeremony: true` with window
`07:00 - 07:30`, and `policy_special_events` is **empty**, so the overlay resolves from the global
window. That window sits inside G7/G8's `06:45 - 07:30` CLASS row but **contains no G9/G10 row**, so the
single-canonical-CLASS-row snap check fails closed with `FLAG_CEREMONY_SCOPE_INVALID` for exactly G9 and
G10 (8 blockers). Per D-D item 8 the intended mechanism is a **persisted, scoped** `PolicySpecialEvent`
with a Monday day whose window sits inside that shift's advisory CLASS row. The beneficiary's own G10
STE schedule prints Flag Ceremony/HGP on the **`13:00 - 13:45`** row with the ordinary subject continuing
Tue-Fri, and the DNO G7 page prints it on **`06:00 - 06:45`** — so scope the rows per shift and reconcile
the global fallback so no scope produces an unsnappable overlay. The overlay must create **no additional
period and no additional demand or Teaching Load minutes**, keep Tue-Fri ordinary, and never double-count
daily totals.

**Preserve:** the fail-closed `FLAG_CEREMONY_SCOPE_INVALID` behaviour for genuinely unsnappable or
non-Monday input; the canonical authority of `classProgramSlot` established by C11; per-term isolation;
determinism.

**Recorded, not fixed here:** the policy row still carries the retired `lunchStartTime 11:55` /
`lunchEndTime 12:55`, `recessStartTime 09:45` / `recessEndTime 10:00`, and `periodsPerDay 10`. C11 made
the canonical grid authoritative, so these are non-authoritative residue for a later cleanup.

## 2. Preflight (zero-cost, immediately before the write; any divergence is a STOP)

1. Re-measure rowKind counts for all 16 scopes; confirm only g9/g10 REGULAR are short.
2. Diff `getExpectedCanonicalSlots` against the persisted rows for those two scopes and record whether
   the catalog or only the data is defective.
3. Confirm `policy_special_events` for school 1 / year 9 is empty, and record the policy flag/lunch/recess
   fields verbatim.
4. Record the full signature set: `class_program_slots`, `policy_special_events`, `scheduling_policies`,
   `audit_logs` high-water, and the active mirror's `syncStatus`.
5. Confirm the register revision and that no other stream holds a revision window.

## 3. Acceptance

| # | Row | Pass condition |
|---|---|---|
| 1 | Grid repair | g9/g10 REGULAR each have **8 CLASS + 2 BREAK** and shift bounds `11:30 - 18:30`; the 14 other scopes unchanged byte-for-byte |
| 2 | Canonical equality | repaired scopes equal `getExpectedCanonicalSlots` exactly (order-insensitive set equality) |
| 3 | Overlay representable | readiness/preflight for G9 and G10 emits **zero** `FLAG_CEREMONY_SCOPE_INVALID` across all three terms |
| 4 | Overlay semantics | Monday-only; no extra period; no added demand or Teaching Load minutes; Tue-Fri ordinary; daily totals unchanged |
| 5 | Fail-closed preserved | a synthetic non-Monday or multi-row-spanning event still fails closed with the typed blocker |
| 6 | Blast radius | only `class_program_slots` + `policy_special_events` (+ the policy row if Part B changes it) differ; subjects, sections, faculty, TeachingLoadCycle, FacultySubject, SubjectSectionOwnership, generation_runs, published_schedule_revisions all delta 0 |
| 7 | Feasibility delta | the unassigned count and per-scope breakdown are re-measured and the delta reported truthfully (the previously reported "82.8% in the four REGULAR scopes" is expected to move once the grid is repaired) |
| 8 | Health | `/api/v1/health/ready` still 200 with `database: ok` |

## 4. Rollback

Restore the recorded §2 pre-values for the affected tables, or re-run the canonical seed. No destructive
path, no schema rollback, no `_prisma_migrations` touch.

## 5. Proposed exact approval sentence (return verbatim ONLY after the fresh pre-action review passes)

> "I approve G9-G10-CONFIG-CORRECTION-C01 R2 exactly as reviewed: add the missing `11:30 - 12:15` CLASS
> row to the school-1 / year-9 G9 and G10 REGULAR canonical `classProgramSlot` grids so each has 8 CLASS
> rows and an `11:30 - 18:30` shift (fixing the catalog first if the canonical template itself is
> short), and make the Monday-only Flag Ceremony/HGP overlay representable per scope via scoped
> `PolicySpecialEvent` rows plus the reconciled global flag window, with the recorded rollback. No other
> table, row, schema, migration, generation, publication, Teaching Load, runtime/task/env, deployment,
> or companion action is approved."

## 6. Boundaries

School 1 / year 9 configuration only. No schema/migration, no Teaching Load write, no generation, no
publication, no rollover/term-cache apply, no deployment/restart, no env/task change, no companion edit.
EnrollPro is READ_ONLY. Do not touch the `SLOT-BREAK-AUTHORITY-C11R` display surfaces (that stream owns
them) or the `SYNC-SECTION-ENROLMENT-C01` mirror.

## 7. Also required

The reconnaissance artifact `docs/analysis/unassigned-feasibility-recon-2026-09-17.md` (branch
`work/unassigned-feasibility-recon-c01`, `67125b91`) carries the same erroneous F1 "7 vs 8" claim and
must receive a correction note before it is merged. Its **F2/F5/F6/F7 findings are unaffected** and
remain valid.
