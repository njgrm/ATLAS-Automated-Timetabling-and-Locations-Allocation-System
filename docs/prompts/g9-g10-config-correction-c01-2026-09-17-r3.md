# G9-G10-CONFIG-CORRECTION-C01 — REVISION 3 (authoritative; supersedes the original, R1, and R2)

Status: authored 2026-09-17 (Asia/Manila). **Read this file only.** R3 supersedes
`...-2026-09-17.md` §1 Part A, its appended R1 block, and the whole of
`...-2026-09-17-r2.md`. Persisted-configuration write (HIGH): fingerprinted preview, fresh independent
pre-action review, and the operator's exact approval before any write.

## R3.0 Correction record

- The **R1 block is withdrawn** (it claimed the REGULAR grid is correctly 7 rows and that adding an 8th
  row would corrupt the grid). Its "do not add an 8th row" instruction must not be followed.
- **R2's Part A placement is also wrong.** R2 asserted the missing row is `11:30 - 12:15`, inferred from
  shift arithmetic. That inference was not evidence.
- **The operator supplied `stakeholderFiles/GRADE10_REGULAR.jpg` (2026-09-17 13:15), the actual
  Grade 10 REGULAR class program in use, and it is decisive.** The grid must be repaired to match it, and
  **`docs/reference/atlas-beneficiary-output-contract.md` §8 D-D needs NO amendment** — its
  "Grades 9-10 Regular 8 CLASS rows" was correct. Only the packets were wrong.

## R3.1 The authoritative reference (Grade 10 REGULAR, Section PEARL)

Read from `stakeholderFiles/GRADE10_REGULAR.jpg`: "Class Program for Grade 10 Enhanced K to 10 for
SY 2026-2027"; Grade 10, Section PEARL, learners M19 / F21 / TOTAL 40; Adviser BON LISTER F. FACTORIN;
signatories Nonato / Englis / Bedaure / Felicano. Columns: Time | No. of min. | Monday | Tuesday |
Wednesday | Thursday | Friday | Teacher.

| Time | min | Monday | Tue-Thu | Friday | Teacher |
|---|---|---|---|---|---|
| `11:15 - 12:15` | **60** | ARAL-Reading English/Filipino/Math | same | TLE `*45 min only` | (blank) |
| `12:15 - 1:00` | 45 | **Lunch Break** (band across the week) | - | - | - |
| **`12:15 - 1:00`** | 45 | **Flag Ceremony/HGP** | **Science** | Science | BL. FACTORIN |
| `1:00 - 1:45` | 45 | English | English | English | C. SANTARITA |
| `1:45 - 2:30` | 45 | MAPEH | MAPEH | MAPEH | J. CANSON |
| `2:30 - 3:15` | 45 | AP | AP | Health Break | R. GARRATON |
| `3:15 - 3:30` | 15 | **Health Break** | - | - | - |
| `3:30 - 4:15` | 45 | VE | VE | VE | J. SISCAR |
| `4:15 - 5:00` | 45 | TLE | TLE | TLE | B. NIONES |
| `5:00 - 5:45` | 45 | Math | Math | Math | M. MAGALLANO |
| `5:45 - 6:30` | 45 | Filipino | Filipino | Filipino | O. PARCON |

`Total minutes per day: 420 (Mon-Thu) / 405 (Fri)`. Arithmetic: `8 x 45 + 45 (lunch) + 15 (health) = 420`
and `8 x 45 + 45 = 405`. **Eight CLASS rows.** The form's own total **excludes** the 60-minute
ARAL-Reading row, independently corroborating that ARAL is never encoded.

## R3.2 The precise divergence in our data (verified read-only)

`g9-REGULAR` and `g10-REGULAR` each persist 9 rows = 2 BREAK + 7 CLASS:

```
12:15-13:00  BREAK  Lunch Break      <-- OUR DEFECT: this is a CLASS row in the reference
13:00-13:45  CLASS
13:45-14:30  CLASS
14:30-15:15  CLASS
15:15-15:30  BREAK  Health Break
15:30-16:15  CLASS
16:15-17:00  CLASS
17:00-17:45  CLASS
17:45-18:30  CLASS
```

All 14 other scopes conform (morning REGULAR 8 CLASS + 2 BREAK; Special Program 10 CLASS + 2 BREAK).

**The repair: `12:15 - 13:00` becomes the first CLASS row for G9/G10 REGULAR, giving 8 CLASS + 1 BREAK =
9 rows with shift `12:15 - 18:30`.** The reference prints the Lunch Break as a **band over that same
slot**, not as a separate numbered period.

## R3.3 The one modelling decision the executor must not invent

Because our grid partitions time into rows, `12:15 - 13:00` cannot simultaneously be a BREAK row and a
CLASS row. The reference shows the lunch **banded over the first teaching period**. Therefore:

- **Required:** `12:15 - 13:00` is a CLASS row for g9/g10 REGULAR, and the scope has **exactly one**
  BREAK row (`15:15 - 15:30` Health Break). The lunch must be represented as a **display band over the
  `12:15 - 13:00` interval** (the same mechanism D-D item 5 defines for the Monday Flag/HGP overlay), not
  as a break row that consumes a teaching period.
- If the current renderer/validator cannot express a lunch band over a CLASS row, **do not guess**: return
  `PLANNER_DECISION_REQUIRED` with the concrete blocker, because the alternative (keeping a lunch BREAK
  row) is what produces the current 7.
- If the canonical template (`getExpectedCanonicalSlots(9|10, 'REGULAR')`) already carries the
  `12:15 - 13:00` CLASS row, this is a data repair; if the catalog is short, fix the catalog in
  `atlas-server/src/services/class-program-slot.service.ts` as a source change and reseed. Never invent
  an interval.

## R3.4 Part B — unchanged (Monday-only Flag/HGP overlay)

`scheduling_policies` (school 1 / year 9) has `enableFlagCeremony: true` with window `07:00 - 07:30`;
`policy_special_events` is empty, so the overlay resolves from the global window, which contains no
G9/G10 row and fails closed with `FLAG_CEREMONY_SCOPE_INVALID` for exactly G9 and G10 (8 blockers).

Per D-D item 8 the intended mechanism is a **persisted, scoped** `PolicySpecialEvent` with a Monday day
whose window sits inside that shift's advisory CLASS row. The new reference corroborates the target: it
prints Flag Ceremony/HGP on the **`12:15 - 1:00`** row with Science continuing Tue-Fri; the DNO G7 page
prints it on **`06:00 - 06:45`**. Scope the rows per shift and reconcile the global fallback so no scope
produces an unsnappable overlay. The overlay creates **no additional period and no additional demand or
Teaching Load minutes**, keeps Tue-Fri ordinary, and never double-counts daily totals.

**Preserve:** the fail-closed behaviour for genuinely unsnappable or non-Monday input; the canonical
authority of `classProgramSlot` (C11); per-term isolation; determinism.

**Recorded, not fixed:** the policy row's retired `lunchStartTime 11:55` / `lunchEndTime 12:55`,
`recessStartTime 09:45` / `recessEndTime 10:00`, `periodsPerDay 10`. C11 made the canonical grid
authoritative, so these are non-authoritative residue.

## 2. Preflight (zero-cost, immediately before the write; any divergence is a STOP)

1. Re-measure rowKind counts across all 16 scopes; confirm only g9/g10 REGULAR are short.
2. Diff `getExpectedCanonicalSlots` against the persisted rows for those two scopes; record whether the
   catalog or only the data is defective.
3. Confirm `policy_special_events` is empty; record the policy flag/lunch/recess fields verbatim.
4. Record the full signature set: `class_program_slots`, `policy_special_events`, `scheduling_policies`,
   `audit_logs` high-water, active mirror `syncStatus`.
5. Confirm the register revision and that no other stream holds a revision window.

## 3. Acceptance

| # | Row | Pass condition |
|---|---|---|
| 1 | Grid repair | g9/g10 REGULAR each have **8 CLASS + 1 BREAK**, shift `12:15 - 18:30`, first CLASS at `12:15 - 13:00`; the 14 other scopes unchanged byte-for-byte |
| 2 | Canonical equality | repaired scopes equal `getExpectedCanonicalSlots` exactly (order-insensitive set equality) |
| 3 | Lunch band | the `12:15 - 13:00` interval renders as a banded lunch **without** removing that CLASS row, and daily totals exclude ARAL and reconcile to the reference (Mon-Thu 420 / Fri 405 for this shape) |
| 4 | Overlay representable | readiness/preflight for G9 and G10 emits **zero** `FLAG_CEREMONY_SCOPE_INVALID` across all three terms |
| 5 | Overlay semantics | Monday-only; no extra period; no added demand or Teaching Load minutes; Tue-Fri ordinary; totals unchanged |
| 6 | Fail-closed preserved | a synthetic non-Monday or multi-row-spanning event still fails closed with the typed blocker |
| 7 | Blast radius | only `class_program_slots` + `policy_special_events` (+ the policy row if Part B changes it) differ; subjects, sections, faculty, TeachingLoadCycle, FacultySubject, SubjectSectionOwnership, generation_runs, published_schedule_revisions delta 0 |
| 8 | Feasibility delta | the unassigned count and its per-scope breakdown are re-measured and the delta reported truthfully (the previously reported "82.8% in the four REGULAR scopes" is expected to move once the grid is repaired) |
| 9 | Health | `/api/v1/health/ready` still 200 with `database: ok` |

## 4. Rollback

Restore the recorded §2 pre-values for the affected tables, or re-run the canonical seed. No destructive
path, no schema rollback, no `_prisma_migrations` touch.

## 5. Proposed exact approval sentence (return verbatim ONLY after the fresh pre-action review passes)

> "I approve G9-G10-CONFIG-CORRECTION-C01 R3 exactly as reviewed: repair the school-1 / year-9 G9 and G10
> REGULAR canonical `classProgramSlot` grids so `12:15 - 13:00` is the first CLASS row and each scope has
> 8 CLASS rows with a `12:15 - 18:30` shift, representing lunch as a band over that interval rather than
> a break row (fixing the catalog first if the canonical template itself is short), and make the
> Monday-only Flag Ceremony/HGP overlay representable per scope via scoped `PolicySpecialEvent` rows plus
> the reconciled global flag window, with the recorded rollback. No other table, row, schema, migration,
> generation, publication, Teaching Load, runtime/task/env, deployment, or companion action is approved."

## 6. Boundaries

School 1 / year 9 configuration only. No schema/migration, no Teaching Load write, no generation, no
publication, no rollover/term-cache apply, no deployment/restart, no env/task change, no companion edit.
EnrollPro READ_ONLY. Do not touch the `SLOT-BREAK-AUTHORITY-C11R` display surfaces (that stream owns
them) or the `SYNC-SECTION-ENROLMENT-C01` mirror.

## 7. Also required

1. `docs/reference/atlas-beneficiary-output-contract.md` §8 D-D **requires no change** (it already says
   8). R1's proposed amendment is withdrawn.
2. The reconnaissance artifact `docs/analysis/unassigned-feasibility-recon-2026-09-17.md` (branch
   `work/unassigned-feasibility-recon-c01`, `67125b91`) carries the same erroneous F1 "7 vs 8" claim and
   must receive a correction note before it is merged. Its F2/F5/F6/F7 findings are unaffected.
3. The newly added reference `stakeholderFiles/GRADE10_REGULAR.jpg` should be cited in the contract's
   §3.1/§8 as the REGULAR-family exemplar, alongside the two STE schedules.
