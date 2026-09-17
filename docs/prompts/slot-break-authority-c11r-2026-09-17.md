# SLOT-BREAK-AUTHORITY-C11R — executor packet

Status: authored 2026-09-17 (Asia/Manila). Successor to the closed, wave-audited
`SLOT-BREAK-AUTHORITY-C11` (register rev 259, receipt `a70dfe9e…`). Register only when
the register is free of any held revision window.

## 0. Immutable identity

- Directive: `origin/main:AGENTS.md`, blob `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88`,
  LF-SHA-256 `7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3`. Read from Git bytes.
- Base: the `origin/main` tip at dispatch. Authoring base:
  `43f6909f09f73c43de1f77092c23fdb764f545e7`.
- Risk tier: MEDIUM. Disposition: `RETIRE_AFTER_INTEGRATION`.
- Worktree `E:/ATLAS-worktrees/slot-break-authority-c11r`, branch
  `fix/slot-break-authority-c11r`.

## 1. Defect (C11 residual F3, independently confirmed at source)

`SLOT-BREAK-AUTHORITY-C11` made the **validation** authority canonical: when
`classProgramSlot` rows exist for a `(gradeLevel, programType)` scope, they define the break windows
and shift bounds. **The display surfaces were not migrated.** They still build period/break slots from
the persisted `SchedulingPolicy` lunch window, with the retired **11:55–12:55** baked in as a fallback:

| File | Evidence |
|---|---|
| `schedule-constructor.ts` | `buildPeriodSlots(policy)` `:240`, uses `policy.lunchStartTime ?? '11:55'` / `lunchEndTime ?? '12:55'` at `:287-288`; `buildSpecialEventSlots(policy)` `:328` with the same hardcoded pair at `:373-374`. `classProgramSlot` refs: **0** |
| `room-schedule.service.ts` | passes `policy.lunchStartTime/lunchEndTime` at `:131-132`, `:149-150`. `classProgramSlot` refs: **0** |
| `locked-session.service.ts` | `getEffectivePeriodSlots` `:121`, passes policy lunch at `:129-130`. `classProgramSlot` refs: **0** |
| `published-schedule.service.ts` | passes policy lunch at `:542-543` (public/published read path). `classProgramSlot` refs: **0** |
| `pre-generation-draft.service.ts` | passes policy lunch at `:720-721`, `:744-745`, `:762-763`. `classProgramSlot` refs: 6 |
| `published-identity-snapshot.service.ts` | policy lunch at `:305`, `:579-580`, `:737-738`; `classProgramSlot` refs: 8 (it already freezes slot rows) |

Consequence against operator decisions D-D (2026-09-17): validation enforces the canonical
**Lunch 12:15–13:00** and **Health Breaks 09:00–09:15 (G7–8) / 15:15–15:30 (G9–10)**, while the
display can render the **retired 11:55–12:55** window — a visible contradiction between what a
schedule *shows* and what it *enforces*, reaching the beneficiary-facing published read.

## 2. Owned and forbidden paths

Owned: `atlas-server/src/services/schedule-constructor.ts`,
`.../room-schedule.service.ts`, `.../locked-session.service.ts`,
`.../published-schedule.service.ts`, `.../pre-generation-draft.service.ts`,
`.../published-identity-snapshot.service.ts` (snapshot-build path only), and one new focused test under
`atlas-server/src/__tests__/`.

Forbidden: `atlas-server/src/services/warning-window-authority.service.ts` and
`.../constraint-validator.ts` (C11 already made these canonical — do not re-touch),
`atlas-server/src/services/class-program-slot.service.ts` (the authority source),
`generation.service.ts`, `docs/plans/**`, `ops/workflow/**`, receipts, `CHANGELOG.md`, companions,
and any runtime/task/env/port/DB surface.

## 3. Required corrections

1. `schedule-constructor.ts`: when canonical `classProgramSlot` rows exist for a scope, derive the
   period grid, break bands, and shift bounds from them; use the policy path only as a fallback for
   scopes with no canonical rows. **Delete the silent `'11:55'` / `'12:55'` literals**; a missing
   policy must not silently invent the retired window.
2. Thread the canonical grid (or the resolved canonical break/shift authority) into
   `buildPeriodSlots` / `buildSpecialEventSlots` and into the five call sites that currently pass only
   the policy lunch times.
3. `published-identity-snapshot.service.ts`: freeze the **canonical-derived** slots at publication
   time. The **read** path must keep rendering the frozen snapshot — published immutability
   (C08/C08R1) must be preserved exactly; do not re-derive from live authority at read time.
4. Preserve: policy fallback for scopes without canonical rows; determinism and ordering; existing
   `FLAG_CEREMONY_SCOPE_INVALID` fail-closed behaviour; ARAL/HG exclusion; term scoping.
5. No contract-semantic change: this is a display/derivation correction, not a policy change.

## 4. Mandatory failing-first controls

Build the fixture through the real producer (`getExpectedCanonicalSlots` / `seedClassProgramSlots` /
`ensureCanonicalClassProgramSlots`, `CANONICAL_TEMPLATE_VERSION`
`STAKEHOLDER_DNO_2026_2027_45MIN_R2`) plus a policy row carrying the legacy lunch 11:55–12:55.

| # | Control | Expected |
|---|---|---|
| 1 | G7–8 scope with canonical rows | display break bands include Health 09:00–09:15 and Lunch 12:15–13:00 |
| 2 | G9–10 scope with canonical rows | display break bands include Lunch 12:15–13:00 and Health 15:15–15:30 |
| 3 | Any scope with canonical rows | `11:55` and `12:55` appear **nowhere** in the built slots |
| 4 | Shift bounds | derived from the canonical grid, not from policy start/end |
| 5 | Display/validator parity | the display slot set equals the validator break-window set for the same scope (the C11 authority) |
| 6 | Scope without canonical rows | the policy fallback still applies, unchanged |
| 7 | Published immutability | a published snapshot renders the FROZEN slots even after the live grid changes (C08 behaviour preserved) |
| 8 | Public/published read path | `published-schedule.service.ts` renders canonical-derived frozen slots, never the retired window |
| 9 | Missing policy, canonical rows present | no silent retired-window fallback; grid comes from slots |
| 10 | MUTANT: restore the policy/hardcoded-only display path | controls 1–5 fail a decisive committed test, then restore byte-exactly |

## 5. Gates

Room-schedule, locked-session, published-schedule, pre-generation-draft, schedule-constructor,
published-immutability (C08), candidate-domain, and readiness suites; the disposable-PostgreSQL mounted
suite fed through the real producer; server `tsc` + production build; built-server startup with explicit
`.js` ESM runtime-import proof; `git diff --check`; fresh independent QA; clean current-main integration
with exact candidate-tree parity; fresh Wave Completion Audit.

## 6. Boundaries

`atlas-server` source and tests only, within the owned paths in §2. No runtime/ports/task/env change,
no DB apply, no migration, no generation, no publication, no login, no companion edit.

## 7. Return contract

Base/candidate/integration/final-main SHAs, changed paths, the before/after display slot sets per
scope, the display/validator parity result, control and mutant results, published-immutability
preservation evidence, whether any assertion was removed and why, QA/audit tallies, push state,
worktree disposition, single next action, safe parallel work, locked successors.
Additive commits only; never amend, rebase, or force-push. `REVIEW_REQUIRED` only.

## 8. Registration annex

Register by CAS when the register is free. Sequence: `create-stream` (spec
`ops/workflow/specs/register/SLOT-BREAK-AUTHORITY-C11R.json`) → acquire the lease → dispatch →
`record-executor-return --base <dispatch tip>` → fresh QA → integration → fresh Wave Completion Auditor
→ `record-audit` → `close-cycle --receipt`. Move coordination to `MANUAL` **before**
`record-integration` (contract constraint), and retire worktrees only after every register
reconciliation is pushed.
