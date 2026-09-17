# G9-G10-CONFIG-CORRECTION-C01 — persisted-configuration correction packet

Status: **REVISION 1** — 2026-09-17 (Asia/Manila). This is a **persisted-configuration write** (HIGH):
it needs a fingerprinted preview, a fresh independent pre-action review, and the operator's exact
approval before any write. No schema change.

> ## R1 — SUPERSEDES SECTION 1 PART A. READ THIS FIRST.
>
> **Part A ("G9/G10 REGULAR is one CLASS row short") is WITHDRAWN — its premise was false.**
>
> The authoritative stakeholder template `DNO-CLASS-PROGRAM-TEMPLATE-2026-2027.docx` page 3 (Grade 9,
> single-section day-column) was extracted and read (2026-09-17). Its rows are:
>
> | Row | No. of min | Content |
> |---|---|---|
> | `11:15 - 12:15` | **60** | ARAL-Reading (Mon–Thu) / `TLE *45 min only` (Fri) |
> | `12:15 - 1:00` | 45 | **Lunch Break** |
> | `12:15 - 1:00` | 45 | **Flag Ceremony/HGP** (Mon) / TLE — a DUPLICATE row overlapping the lunch |
> | `1:00 - 1:45`, `1:45 - 2:30`, `2:30 - 3:15` | 45 | Science, Filipino, Mathematics |
> | `3:15 - 3:30` | 15 | Health Break |
> | `3:30 - 4:15` … `5:45 - 6:30` | 45 | English and the remaining subjects |
>
> Excluding the ARAL-Reading row (60 minutes, and **ARAL must never be encoded** per the settled rules)
> and the two break rows, the template yields **exactly 7 afternoon CLASS rows** — identical to the
> persisted `g9-REGULAR` / `g10-REGULAR` grids. **The persisted 7-row grid is faithful; the earlier
> claim that it is "short by one" was wrong.** The "8" in operator decision D-D counted the ARAL row.
>
> Consequences:
> - **Do NOT add an 8th CLASS row to G9/G10 REGULAR.** Doing so would corrupt a canonical grid that
>   currently matches the stakeholder template.
> - The `8` in the contract's D-D text is a **documentation error** and should be corrected to the
>   shift-aware truth: **morning REGULAR (G7/G8) 8 CLASS rows; afternoon REGULAR (G9/G10) 7 CLASS rows;
>   Special Program 10 CLASS rows.** This correction is a product-decision amendment and requires the
>   operator's confirmation before the contract is edited.
> - The reported "82.8% of unassigned instances in the four REGULAR scopes" therefore has a different
>   cause than a short grid and must be re-explained by the remaining Part B work or by workload policy.
>
> **Part B SURVIVES and is strengthened.** The extracted pages also show:
> - the template's G7 page places Flag Ceremony/HGP on the **`6:00 - 6:45`** row, not on the policy's
>   `07:00 - 07:30` window (which snaps to `06:45 - 07:30` — a *different* row), so the global window is
>   wrong even for G7/G8; and
> - the template's G9 page places Flag/HGP on the **duplicated `12:15 - 1:00`** row, which overlaps the
>   Lunch Break and is unusable — while the beneficiary's own G10 STE schedule photo shows it on the
>   **`1:00 - 1:45`** CLASS row with the ordinary subject on Tue–Fri.
>
> So Part B is correct as written: the overlay must be scoped per shift and land on the advisory CLASS
> row (G7/G8 ≈ `06:00 - 06:45`; G9/G10 ≈ `13:00 - 13:45`), the template's duplicate `12:15 - 1:00` row
> is drift to be ignored, and the global fallback window must be reconciled so no scope produces an
> unsnapable overlay.
>
> The reconnaissance artifact `docs/analysis/unassigned-feasibility-recon-2026-09-17.md` (branch
> `work/unassigned-feasibility-recon-c01`, `67125b91`) carries the same F1 "7 vs 8" defect claim and
> requires the equivalent correction note before it is merged.

## 0. Identity

- Directive pin: `origin/main:AGENTS.md` blob `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88`,
  LF-SHA-256 `7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3`. Read from Git bytes.
- Base: `origin/main` at dispatch. Authoring base `0a134bba`.
- Risk: **HIGH** (live configuration data). Disposition: `RETIRE_AFTER_INTEGRATION`.
- Worktree `E:/ATLAS-worktrees/g9-g10-config-correction-c01`, branch
  `chore/g9-g10-config-correction-c01`.

## 1. Defects (independently verified read-only 2026-09-17)

**A — G9/G10 REGULAR canonical class grid is one CLASS row short.**
Persisted `classProgramSlot` rowKind counts for school 1 / year 9:

| Scope | CLASS | BREAK | Expected (operator decision D-D) |
|---|---|---|---|
| g7/g8 REGULAR | **8** | 2 | 8 ✓ |
| g7/g8/g9/g10 STE/SPA/SPS | **10** | 2 | 10 ✓ |
| **g9 REGULAR** | **7** | 2 | **8 ✗** |
| **g10 REGULAR** | **7** | 2 | **8 ✗** |

Only the two G9/G10 REGULAR scopes are short. This correlates with the measured unassigned
concentration (82.8% of per-term unassigned instances sit in the four REGULAR scopes).

**B — the Flag Ceremony/HGP overlay cannot be represented for G9 or G10.**
`SchedulingPolicy` for school 1 / year 9 has `enableFlagCeremony: true`,
`flagCeremonyStartTime: '07:00'`, `flagCeremonyEndTime: '07:30'`. `PolicySpecialEvent` rows are
**empty**, so the overlay resolves from the global policy window. That window sits inside G7/G8's
`06:45–07:30` CLASS row (snaps), but **no G9/G10 canonical row contains it** (G9/G10 start at 09:45 or
12:15/13:00), so the single-canonical-CLASS-row snap check fails closed with
`FLAG_CEREMONY_SCOPE_INVALID` — 8 blockers, for exactly G9 and G10.

**C — recorded, not necessarily changed here.** The same policy row still carries the retired
`lunchStartTime 11:55` / `lunchEndTime 12:55`, `recessStartTime 09:45` / `recessEndTime 10:00`, and
`periodsPerDay 10`. `SLOT-BREAK-AUTHORITY-C11` made the canonical `classProgramSlot` grid authoritative,
so these are non-authoritative; they are recorded as confusing residue for a later cleanup, not fixed in
this packet unless the planner determines they still drive any effective path.

**Reference evidence.** `stakeholderFiles/grade10STE_Sched.jpg` shows the Monday `1:00–1:45` row as
`Flag Ceremony/HGP` with the ordinary subject on Tue–Fri — i.e. the overlay belongs on the G9/G10
**advisory CLASS row**, exactly as D-D item 5 requires. `grade9STE_Sched.jpg` shows the same Monday-only
pattern.

## 2. Required corrections

**Part A — reconcile the G9/G10 REGULAR grid to the canonical template.**
Do **not** invent the missing interval. Derive the expected set from the real producer
(`getExpectedCanonicalSlots(gradeLevel, programType)` / `validateCanonicalTemplateRows`), diff it against
the persisted rows, and repair the two scopes to the canonical set so each has **8 CLASS rows** and 2
BREAK rows. If the canonical template itself is the source of the shortfall, STOP and return
`PLANNER_DECISION_REQUIRED` — that would be a template defect, not a data drift.

**Part B — make the Monday-only Flag/HGP overlay representable per scope.**
The intended mechanism (D-D item 8) is a **persisted, scoped** `PolicySpecialEvent` with a Monday day:
seed `FLAG_OR_HGP` rows whose window sits inside the advisory CLASS row of each shift
(G7/G8 morning ≈ `06:45–07:30`; G9/G10 ≈ `13:00–13:45`), with the correct `gradeGroup`/`programType`
scope. Then reconcile the global `enableFlagCeremony` window so it no longer produces an unsnappable
overlay for G9/G10 (either disable the global fallback once scoped rows exist, or set the global window
so every remaining fallback scope snaps). The overlay must continue to create **no additional period and
no additional demand or Teaching Load minutes**, keep Tue–Fri as ordinary teachable periods, and never
double-count in daily totals.

**Preserve:** the fail-closed `FLAG_CEREMONY_SCOPE_INVALID` behaviour for genuinely unsnappable or
non-Monday input; the canonical authority of `classProgramSlot` established by C11; per-term isolation;
determinism.

## 3. Preflight (zero-cost, immediately before the write; any divergence is a STOP)

1. Re-measure the rowKind counts for all 16 scopes and confirm only g9/g10 REGULAR are short.
2. Confirm `PolicySpecialEvent` for school 1 / year 9 is empty (or record exactly what exists).
3. Record the policy row's flag/lunch/recess fields verbatim.
4. Record the full signature set: `class_program_slots`, `policy_special_events`, `scheduling_policies`,
   plus `audit_logs` high-water and the active mirror's `syncStatus`.
5. Confirm the register revision and that no other stream holds a revision window.

## 4. Acceptance

| # | Row | Pass condition |
|---|---|---|
| 1 | Grid repair | g9/g10 REGULAR each have **8 CLASS + 2 BREAK**; all 14 other scopes unchanged byte-for-byte |
| 2 | Canonical equality | repaired scopes equal `getExpectedCanonicalSlots` exactly (order-insensitive set equality) |
| 3 | Overlay representable | the readiness/preflight for G9 and G10 emits **zero** `FLAG_CEREMONY_SCOPE_INVALID` for all three terms |
| 4 | Overlay semantics | Monday-only; no extra period; no added demand or Teaching Load minutes; Tue–Fri ordinary; daily totals unchanged |
| 5 | Fail-closed preserved | a synthetic non-Monday or multi-row-spanning event still fails closed with the typed blocker |
| 6 | Blast radius | only `class_program_slots` + `policy_special_events` (+ the policy row if Part B changes it) differ; subjects, sections, faculty, TeachingLoadCycle, FacultySubject, SubjectSectionOwnership, generation_runs, published_schedule_revisions all delta 0 |
| 7 | Feasibility delta | the unassigned count and per-scope breakdown are re-measured and the DELTA is reported (expected to improve; report the truth either way) |
| 8 | Health | `/api/v1/health/ready` still 200 with `database: ok` |

## 5. Rollback

Restore the recorded §3 pre-values for the three tables (or re-run the canonical seed for the two scopes
if that is the sanctioned inverse). No destructive path, no schema rollback, no `_prisma_migrations`
touch.

## 6. Proposed exact approval sentence (return verbatim ONLY after the fresh pre-action review passes)

> "I approve G9-G10-CONFIG-CORRECTION-C01 exactly as reviewed: repair the school-1 / year-9 G9 and G10
> REGULAR canonical `classProgramSlot` grids to 8 CLASS rows each per the canonical template, and make
> the Monday-only Flag Ceremony/HGP overlay representable per scope via scoped `PolicySpecialEvent` rows
> plus the reconciled global flag window, with the recorded rollback. No other table, row, schema,
> migration, generation, publication, Teaching Load, runtime/task/env, deployment, or companion action
> is approved."

## 7. Boundaries

School 1 / year 9 configuration only. No schema/migration, no Teaching Load write, no generation, no
publication, no rollover/term-cache apply, no deployment/restart, no env/task change, no companion edit.
EnrollPro is READ_ONLY. Do not touch the `SLOT-BREAK-AUTHORITY-C11R` display surfaces (that stream owns
them) or the `SYNC-SECTION-ENROLMENT-C01` mirror.

## 8. Registration annex

Register by CAS when the register is free of another stream's held window. Sequence: `create-stream`
(spec `ops/workflow/specs/register/G9-G10-CONFIG-CORRECTION-C01.json`) → lease → fresh pre-action review
→ `record-approval` (WF-C10 capability; if unavailable record the grant in committed evidence and note
the under-report) → execute → `record-execution` → acceptance → close. Move coordination to `MANUAL`
before `record-integration`. Retire worktrees only after push.
