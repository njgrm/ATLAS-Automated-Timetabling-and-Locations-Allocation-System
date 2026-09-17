# G9G10-FLAG-SOURCE-LANE — executor packet (ordinary MEDIUM source lane)

Status: authored 2026-09-17 (Asia/Manila). Ordinary source lane — no HIGH approval, no register write by
the lane, no database write. Decisions applied: **Q3 = yes** (per-scope Flag/HGP resolution authorised)
and the operator's shift-based lunch ruling.

## 0. Identity

- Directive: `origin/main:AGENTS.md`, blob `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88`,
  LF-SHA-256 `7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3`. Read from Git bytes;
  NEVER use `D:/ATLAS/AGENTS.md` (stale).
- Base: the `origin/main` tip at dispatch. Authoring base `056f2e4bf3e3beca20d52aa0ab4f96ab19875f01`.
- Worktree `E:/ATLAS-worktrees/g9g10-flag-source-lane`, branch `fix/g9g10-flag-source`,
  disposition `RETIRE_AFTER_INTEGRATION`.
- Risk: MEDIUM. Owned paths listed in §2. No DB, no register, no runtime, no companion.

## 1. Settled product rules this lane implements

- **Lunch is shift-based, not program-based.** Afternoon shift (Grades 9-10, *all* programs) lunches at
  **11:30-12:15**. Morning shift (Grades 7-8, all programs) keeps lunch at `12:15-13:00` after its
  06:00-12:15 block.
- **ARAL-Reading is never modelled.**
- The Monday Flag Ceremony/HGP overlay creates no additional period, no additional demand and no
  additional Teaching Load minutes; Tue-Fri keep the ordinary subject; daily totals never double-count it.

## 2. Owned and forbidden paths

Owned: `atlas-server/src/services/class-program-slot.service.ts`,
`atlas-server/src/services/generation-preflight.service.ts`, and the tests this lane must update (§5).

Forbidden: every other product file, `ops/workflow/**`, `docs/plans/**`, the machine register, receipts,
`CHANGELOG.md`, companions, and any runtime/task/env/DB surface. This lane writes **no** database.

## 3. Required corrections

**3.1 Canonical grids — define both arrays explicitly, no shared spread.**
Today `GRADE_9_10_SPECIAL = [...GRADE_9_10_REGULAR]` at `class-program-slot.service.ts:220-225`, so a
REGULAR edit silently moves all six special scopes. Decouple them.

```
GRADE_9_10_REGULAR (8 CLASS + 2 BREAK, shift 12:15-18:30, span 420 = 8x45 + 45 + 15):
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

GRADE_9_10_SPECIAL (10 CLASS + 2 BREAK, shift 09:45-18:30):
  09:45-10:30  CLASS  Specialization
  10:30-11:15  CLASS  Specialization
  [11:15-11:30 unmodelled seam — the same treatment today's grid gives the 12:00-12:15 seam]
  11:30-12:15  BREAK  Lunch Break
  then the SAME eight afternoon CLASS rows as REGULAR, with the Health BREAK at 15:15-15:30
```

`GRADE_7_8_REGULAR` and `GRADE_7_8_SPECIAL` are **unchanged** (morning shift; lunch `12:15-13:00`).
The pre-lunch specialization block therefore drops from three rows to two; **no class duration changes**
and the specials' CLASS total stays **10**.

**3.2 Per-scope Flag/HGP resolution.**
`generation-preflight.service.ts:1008-1048` selects **one** `configuredFlagEvent` and requires that single
window to be contained by exactly one canonical CLASS row **of every one of the 16 shape contracts**.
Morning (G7/G8) and afternoon (G9/G10) families share no interval, so no single window can satisfy all
shapes: the global `07:00-07:30` passes G7/G8 and fails exactly G9/G10, and seeding scoped
`PolicySpecialEvent` rows makes it **worse (8 → 16 blockers)** because the first row is still tested
globally. Resolve the overlay **per scope-family**, mirroring the constructor's existing per-scope snap
(`resolvePolicyFlagOverlaySlots` -> `overlay.slice(0, 1)` per grid). Target windows by family:
G7/G8 `06:00-06:45`; G9/G10 REGULAR the first morning/afternoon CLASS row; G9/G10 specials their
equivalent row. This is a resolution fix only — it must not change what the overlay renders.

**3.3 Relabel fix.**
`generation-preflight.service.ts:405` raises `WORKLOAD_POLICY_BLOCK`, and at `:2464`/`:2847` a slot
collision sets `sawFacultySlotUnavailable`, which currently outranks the true room reason. Correct the
precedence so a genuine room/placement cause is reported as `ROOM_RESOURCE_UNAVAILABLE`, and a genuine
per-term weekly-cap breach stays `WORKLOAD_POLICY_BLOCK` (threshold `facultyMax = maxHoursPerWeek*60` at
`schedule-constructor.ts:1841`).

## 4. Mandatory failing-first controls

Build the fixture through the real producer (`getExpectedCanonicalSlots`, `seedClassProgramSlots`,
`ensureCanonicalClassProgramSlots`, `CANONICAL_TEMPLATE_VERSION` `STAKEHOLDER_DNO_2026_2027_45MIN_R2`).

| # | Control | Expected |
|---|---|---|
| 1 | 16-scope table | every scope equals `getExpectedCanonicalSlots` exactly (order-insensitive set equality) |
| 2 | G7/G8 all four programs | byte-identical to today (`GRADE_7_8_*` untouched) |
| 3 | g9/g10 REGULAR | 8 CLASS + 2 BREAK, lunch BREAK `11:30-12:15`, first CLASS `12:15-13:00`, span 420 |
| 4 | g9/g10 STE/SPA/SPS | 10 CLASS + 2 BREAK, lunch BREAK `11:30-12:15`, shift `09:45-18:30`, pre-lunch block 2 rows |
| 5 | Composition guard | a mutation of `GRADE_9_10_REGULAR` must NOT change any special scope (no shared spread) |
| 6 | Flag overlay, all 16 scopes, 3 terms | zero `FLAG_CEREMONY_SCOPE_INVALID` |
| 7 | Flag semantics | Monday-only; no extra period; no added demand or Teaching Load minutes; Tue-Fri ordinary |
| 8 | Relabel | the 37/45 mislabelled blocks now report the true room cause; genuine cap breaches unchanged |
| 9 | MUTANT: restore the shared spread and the global flag resolution | controls 3-6 must fail a decisive committed test, then be restored byte-exactly |

## 5. Always-run test inventory (mandatory — name every one in the handoff; no silent deletions)

- `atlas-server/src/__tests__/timetable-shape-diagnostic-c02.test.ts:69-70` — G9/G10 REGULAR first CLASS
  `'13:00'` -> `'12:15'`; CLASS count `7` -> `8`.
- `atlas-server/src/__tests__/generation-stakeholder-shape-genc02r.test.ts:79-90` — the test is titled
  "the duplicate 12:15-13:00 row is a BREAK, never a CLASS"; the lunch row moves to `11:30-12:15` and
  `12:15-13:00` becomes a CLASS. Update the assertions **and** the title/comment to the operator ruling.
- `atlas-server/src/__tests__/tt-output-c03r.test.ts` (~`:518`) — G9 class starts at/after `13:00`.
- `atlas-server/src/__tests__/slot-break-authority-c11.test.ts:345-350` (DB-guarded).
- `atlas-server/src/__tests__/slot-break-authority-c11r.test.ts:282,316`.
- Any further assertion over `class-program-slot.service.ts` / `generation-preflight.service.ts` found by
  the inventory. Each change must be justified against the operator ruling in the handoff.

## 6. Gates

`tsc` + production build for the server; the shape-diagnostic, stakeholder-shape, tt-output, C11, C11R and
published-immutability suites; built-server startup with explicit `.js` ESM runtime-import proof;
`git diff --check`; fresh independent QA over the frozen candidate; clean current-main integration with
exact candidate-tree parity; fresh Wave Completion Auditor.

## 7. Boundaries and sequencing

No database write, no register write, no `ops/workflow/**`, no runtime/task/env, no companion edit.

**CRITICAL SEQUENCING:** this lane changes the *expected* canonical grid, so once it lands the live 182
`class_program_slots` rows for school 1 / year 9 become non-conforming and the preflight **fails closed**
on `CANONICAL_TEMPLATE_INCOMPLETE`. The grid reseed in `DATA-CORRECTION-C01` must therefore follow, and
only after a deployment whose pin contains this lane. Do not attempt generation in between.

## 8. Return contract

Base/candidate/integration/final-main SHAs; changed paths; the 16-scope table; the flag-overlay result per
scope; the relabel evidence; the complete list of updated tests with each justification; the mutant result
with byte-exact restore; whether any assertion was removed and why; QA/audit tallies; push state;
disposition; single next action.
`REVIEW_REQUIRED` only; never self-approve, merge, or push.
