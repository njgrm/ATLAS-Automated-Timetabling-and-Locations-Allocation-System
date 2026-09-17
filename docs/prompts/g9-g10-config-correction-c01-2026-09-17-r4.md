# G9-G10-CONFIG-CORRECTION-C01 — REVISION 4 (authoritative; supersedes the original, R1, R2 and R3)

Status: authored 2026-09-17 (Asia/Manila). **Read this file only.** R4 supersedes
`...-2026-09-17.md` §1 Part A, its appended R1 block, `...-2026-09-17-r2.md`, and `...-2026-09-17-r3.md`.
Persisted-configuration write (HIGH): fingerprinted preview, fresh independent pre-action review, and the
operator's exact approval before any write.

## R4.0 Correction record and the operator ruling that resolves F-A

The `SLOT-BREAK-AUTHORITY-C11R` Wave Completion Auditor returned `PLANNER_DECISION_REQUIRED` on F-A: the
R3 packet was **not executable as written**, because R3 required a lunch **banded over a CLASS row**,
while `class-program-slot.service.ts:208-209` encodes `12:15-13:00` as a BREAK and
`schedule-constructor.ts:340-342` derives bands only from `rowKind === 'BREAK'` (no band-over-CLASS
mechanism). It correctly refused to invent a resolution.

**The operator has now ruled (2026-09-17), and it dissolves F-A entirely:**

> Afternoon-shift sections take lunch at **11:30-12:15** (confirmed against the Grade 9 FE DEL MUNDO
> schedule). Regular afternoon classes take lunch the same way. **ARAL scheduling is out of our scope
> and is not to be modelled.**

Arithmetic: `11:30 -> 18:30 = 420 min = 8 x 45 (teaching) + 45 (lunch) + 15 (health)` — **exact**, and
identical to the Grade 10 Regular Section PEARL form's printed `Total minutes per day 420`.

**Consequences — no new display mechanism, no teaching-semantics change:**

- The lunch simply **moves** from `12:15-13:00` to `11:30-12:15` as a normal `rowKind === 'BREAK'` row.
- `12:15-13:00` becomes the **first CLASS row**. The existing rowKind-driven band derivation keeps
  working; no band-over-CLASS overlay is required.
- C11/C11R assertions are **not** invalidated: the canonical grid retains exactly two BREAK rows, the
  retired `11:55`/`12:55` literals stay gone, and the canonical-grid authority is unchanged. Only the
  grid intervals change.
- **ARAL-Reading rows are never modelled** — the `11:15-12:15` ARAL row on the reference form is ignored
  (the form's own `Total 420` excludes it, so this matches the source of record).
- Prior-revision dispositions: **R1 is withdrawn** (the grid is not "correctly 7"); **R2 had the right
  interval but the wrong rowKind** (it added `11:30-12:15` as a CLASS rather than moving the LUNCH there);
  **R3 is superseded** (its band-over-CLASS requirement and its "D-D needs NO amendment" claim were both
  wrong). The contract's §8 D-D **has been amended in this same change** (see R4.4).

## R4.1 Verified defect (read-only, 2026-09-17)

`g9-REGULAR` and `g10-REGULAR` each persist 9 rows = 2 BREAK + 7 CLASS:

```
12:15-13:00  BREAK  Lunch Break     <-- WRONG INTERVAL: lunch belongs at 11:30-12:15
13:00-13:45  CLASS
13:45-14:30  CLASS
14:30-15:15  CLASS
15:15-15:30  BREAK  Health Break
15:30-16:15  CLASS
16:15-17:00  CLASS
17:00-17:45  CLASS
17:45-18:30  CLASS
```

Required grid (`catalogSlot` entries in `GRADE_9_10_REGULAR`, `class-program-slot.service.ts:208-209`):

```
11:30-12:15  BREAK  Lunch Break
12:15-13:00  CLASS
13:00-13:45  CLASS
13:45-14:30  CLASS
14:30-15:15  CLASS
15:15-15:30  BREAK  Health Break
15:30-16:15  CLASS
16:15-17:00  CLASS
17:00-17:45  CLASS
17:45-18:30  CLASS
```
**8 CLASS + 2 BREAK = 10 rows**, shift `11:30 - 18:30`.

## R4.2 Required corrections

**Part A — the G9/G10 REGULAR grid.**
Change the **catalog** `GRADE_9_10_REGULAR` so the Lunch Break BREAK row moves from `12:15-13:00` to
`11:30-12:15` and `12:15-13:00` becomes a CLASS row, leaving Health Break at `15:15-15:30`. Then reseed
or repair school 1 / year 9 so the persisted rows equal `getExpectedCanonicalSlots(9|10,'REGULAR')`
exactly. Preserve all 14 other scopes byte-for-byte. `GRADE_7_8_REGULAR` is unaffected (its lunch row
sits after the morning shift ends).

**Part A2 — confirm whether the Special Program grids share the lunch move.**
The same ruling ("afternoon-shift sections take lunch at 11:30-12:15") implies the Special Program
grids' lunch is also `11:30-12:15` rather than `12:15-13:00`. Their CLASS totals stay 10 either way, but
the morning/afternoon split shifts. **Measure the current Special Program rows, state the delta against
the two STE schedules, and if their morning/afternoon split is ambiguous return
`PLANNER_DECISION_REQUIRED` with the candidate layouts — do not silently re-split them.**

**Part B — the Monday-only Flag/HGP overlay (unchanged in intent).**
`scheduling_policies` (school 1 / year 9) has `enableFlagCeremony: true` with window `07:00-07:30`;
`policy_special_events` is empty, so the overlay resolves from the global window, which contains no
G9/G10 row and fails closed with `FLAG_CEREMONY_SCOPE_INVALID` for exactly G9 and G10 (8 blockers). Per
D-D item 8, use a **persisted, scoped** `PolicySpecialEvent` with a Monday day whose window sits inside
that shift's advisory CLASS row, and reconcile the global fallback so no scope is unsnappable. The
reference forms print Flag Ceremony/HGP on the first afternoon row (Grade 10 Regular: the
`12:15-1:00` row, with Science continuing Tue-Fri; DNO G7: `06:00-06:45`). The overlay creates **no
additional period and no additional demand or Teaching Load minutes**, keeps Tue-Fri ordinary, and never
double-counts daily totals.

**Preserve:** the fail-closed behaviour for genuinely unsnappable or non-Monday input; the canonical
authority of `classProgramSlot` (C11); the removal of the retired `11:55`/`12:55` literals (C11R);
per-term isolation; determinism.

**Recorded, not fixed here:** the policy row's retired `lunchStartTime 11:55` / `lunchEndTime 12:55`,
`recessStartTime 09:45` / `recessEndTime 10:00`, `periodsPerDay 10`, and the dead `canonical` parameter
on `buildPeriodSlots`/`buildSpecialEventSlots` (capsule residual F-G).

## R4.3 Preflight, acceptance, rollback

**Preflight (zero-cost, immediately before the write; any divergence is a STOP):** re-measure rowKind
counts across all 16 scopes; diff `getExpectedCanonicalSlots` against the persisted rows for the affected
scopes and record whether the catalog or only the data needs changing; confirm `policy_special_events` is
empty and record the policy flag/lunch/recess fields verbatim; record the full signature set
(`class_program_slots`, `policy_special_events`, `scheduling_policies`, `audit_logs` high-water, active
mirror `syncStatus`); confirm the register revision and that no other stream holds a revision window.

| # | Acceptance row | Pass condition |
|---|---|---|
| 1 | Grid repair | g9/g10 REGULAR = **8 CLASS + 2 BREAK**, shift `11:30-18:30`, lunch BREAK at `11:30-12:15`, first CLASS at `12:15-13:00`; the 14 other scopes unchanged byte-for-byte |
| 2 | Canonical equality | repaired scopes equal `getExpectedCanonicalSlots` exactly (order-insensitive set equality) |
| 3 | Catalog fixed | `class-program-slot.service.ts` `GRADE_9_10_REGULAR` carries the new lunch interval; if it does not, this was a source change and it is covered |
| 4 | Daily total | the G9/G10 REGULAR total reconciles to `420` (8x45 + 45 + 15) as printed on the reference form |
| 5 | Overlay representable | readiness/preflight for G9 and G10 emits **zero** `FLAG_CEREMONY_SCOPE_INVALID` across all three terms |
| 6 | Overlay semantics | Monday-only; no extra period; no added demand or Teaching Load minutes; Tue-Fri ordinary; totals unchanged |
| 7 | Fail-closed preserved | a synthetic non-Monday or multi-row-spanning event still fails closed with the typed blocker |
| 8 | No band-over-CLASS regression | the lunch still renders as a band, now at `11:30-12:15`; `12:15-13:00` renders as a CLASS with its teacher |
| 9 | Blast radius | only `class_program_slots` + `policy_special_events` (+ the policy row if Part B changes it) differ; subjects, sections, faculty, TeachingLoadCycle, FacultySubject, SubjectSectionOwnership, generation_runs, published_schedule_revisions delta 0 |
| 10 | Feasibility delta | the unassigned count and per-scope breakdown are re-measured and the delta reported truthfully |
| 11 | Health | `/api/v1/health/ready` still 200 with `database: ok` |

**Rollback:** restore the recorded pre-values for the affected tables, or re-run the canonical seed. No
destructive path, no schema rollback, no `_prisma_migrations` touch.

## R4.4 Contract amendment applied with this revision

`docs/reference/atlas-beneficiary-output-contract.md` §8 D-D now records the Grades 9-10 **Lunch Break
`11:30-12:15`** (was `12:15-13:00`), the afternoon-shift lunch rule (including the Special Program
afternoon block), the fact that `12:15-13:00` is the first CLASS row for G9/G10 Regular, and that
**ARAL-Reading is out of scope and never modelled**. This refutes the R3 §R3.0 claim that no amendment was
needed.

## R4.5 Proposed exact approval sentence (return verbatim ONLY after the fresh pre-action review passes)

> "I approve G9-G10-CONFIG-CORRECTION-C01 R4 exactly as reviewed: move the Grades 9-10 Regular Lunch
> Break from `12:15-13:00` to `11:30-12:15` in the canonical `classProgramSlot` catalog and reseed school
> 1 / year 9 so each of g9-REGULAR and g10-REGULAR has 8 CLASS rows with a `11:30-18:30` shift and its
> first CLASS row at `12:15-13:00`, make the Monday-only Flag Ceremony/HGP overlay representable per scope
> via scoped `PolicySpecialEvent` rows plus the reconciled global flag window, and record the resulting
> Special Program lunch measurement, with the recorded rollback. No other table, row, schema, migration,
> generation, publication, Teaching Load, runtime/task/env, deployment, or companion action is approved."

## R4.6 Boundaries and cycle coupling

School 1 / year 9 configuration only. No schema/migration, no Teaching Load write, no generation, no
publication, no rollover/term-cache apply, no deployment/restart, no env/task change, no companion edit.
EnrollPro READ_ONLY. Do not touch `ops/workflow/**` or the SYNC-SECTION-ENROLMENT-C01 mirror.

**Cycle coupling:** `SLOT-BREAK-AUTHORITY-C11R` is `INTEGRATED` with its auditor's single failed row being
*successor/HIGH-packet readiness*. R4 resolves that row, so C11R closes **after** R4 is authored, reviewed
and its readiness confirmed — then one fresh Wave Completion Auditor re-runs over C11R, and `close-cycle`
follows.

## R4.7 Also required

1. `docs/analysis/unassigned-feasibility-recon-2026-09-17.md` (branch
   `work/unassigned-feasibility-recon-c01`, `67125b91`) still needs its F1 "7 vs 8" correction note before
   merge; its F2/F5/F6/F7 findings stand.
2. Cite the three reference schedules (`grade9STE_Sched.jpg`, `grade10STE_Sched.jpg`,
   `GRADE10_REGULAR.jpg`) in the contract's §3/§8 as the family exemplars.
