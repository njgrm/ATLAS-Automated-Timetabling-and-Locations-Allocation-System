# SLOT-BREAK-AUTHORITY-C11 — executor packet

Status: authored 2026-09-17 (Asia/Manila). Not yet registered. Register only after
`WF-TRANSITION-TERMINAL-RECONCILE-C09` releases its register revision window.

## 0. Immutable identity

- Directive: `origin/main:AGENTS.md`, blob `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88`,
  LF-SHA-256 `7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3`.
  Read from Git bytes. Never use `D:/ATLAS/AGENTS.md` (stale).
- Base: the `origin/main` tip at dispatch (re-verify). Authoring base:
  `e852f972ac2c47d1bddbc50e08ea50e811c15e58`.
- Worktree: `E:/ATLAS-worktrees/slot-break-authority-c11`
- Branch: `fix/slot-break-authority-c11`
- Risk tier: MEDIUM. Disposition: `RETIRE_AFTER_INTEGRATION`.

## 1. Defect (verified read-only 2026-09-17)

The effective break/shift authority ignores the canonical `classProgramSlot` grid.

- `warning-window-authority.service.ts` — `buildWarningWindowAuthority` accepts
  only `{ sections, policyRow, specialEvents, shiftWindows }`, and assembles
  `breakWindows` solely from `resolvePolicyRowBreakWindows` +
  `resolveSpecialEventBreakWindows`. `classProgramSlot` is never an input
  (confirmed by grep in this file and in `constraint-validator.ts`).
- Production callers that receive the wrong windows:
  `generation-preflight.service.ts:1301` (→ `:1362`),
  `manual-edit.service.ts:302` (→ `:512`),
  `pre-generation-draft.service.ts:901` (→ `:965`).
- Additional fail-open: `manual-edit.service.ts:456` —
  `refData.windowAuthority ?? { breakWindows: [], shiftWindows: [], sectionScope: new Map() }`.
  With no authority supplied, break windows are EMPTY, so every break counts as
  teachable time.
- Additional gap: `generation-input-snapshot.service.ts` has zero references to
  `classProgramSlot`, so the consumed-input fingerprint does not cover the grid.

Live school 1 / school year 9 state: `SchedulingPolicy.lunchStartTime/lunchEndTime`
= 11:55-12:55 with `enableLunchWindow` true; `PolicySpecialEvent` rows EMPTY;
`GradeShiftWindow` rows EMPTY; `classProgramSlot` = 182 rows.

Consequence, against the operator decisions of 2026-09-17 (contract §8, D-D
items 3, 7, 8): the canonical lunch 12:15-13:00 is treated as teachable, the
canonical Health Breaks 09:00-09:15 (Grades 7-8) and 15:15-15:30 (Grades 9-10)
are invisible, the retired 11:55-12:55 window is applied, and effective shift
bounds come from policy times rather than the per-grade/program grid.

## 2. Owned and forbidden paths

Owned: `atlas-server/src/services/warning-window-authority.service.ts`,
`atlas-server/src/services/constraint-validator.ts`,
`atlas-server/src/services/manual-edit.service.ts`,
`atlas-server/src/services/generation-preflight.service.ts`,
`atlas-server/src/services/pre-generation-draft.service.ts`,
`atlas-server/src/services/generation-input-snapshot.service.ts`, the
generation-preflight/readiness callers that assemble the authority, and one new
focused test file under `atlas-server/src/__tests__/`.

Forbidden: `atlas-server/src/services/generation.service.ts`,
`atlas-server/src/services/published-identity-snapshot.service.ts`,
`docs/plans/**`, `ops/workflow/**`, receipts, `CHANGELOG.md`, companions, and any
runtime/task/env/port/DB surface. Other active lanes own those paths.

## 3. Required corrections

1. When canonical `classProgramSlot` rows exist for a `(gradeLevel, programType)`
   scope, they are the break-window and shift-bound authority for that scope. The
   persisted policy-row lunch window must NOT override them. Preserve the
   policy-row and special-event paths for scopes with NO canonical slot rows.
2. Canonical `rowKind = BREAK` rows (Health Break, Lunch Break) become the
   effective break windows for their scope; canonical CLASS rows define the
   effective shift bounds when no `GradeShiftWindow` rows exist.
3. Preserve the existing Monday-only Flag/HGP authority and the
   single-canonical-CLASS-row snap validation.
4. Close the narrow residual in `generation-preflight.service.ts`: the
   single-canonical-CLASS-row snap check currently runs only when a persisted
   Flag/HGP event exists (`:1000 if (configuredFlagEvent …)`). Extend it to the
   policy-row-only fallback path so an unsnappable overlay fails closed there too.
5. Close the `manual-edit.service.ts:456` fail-open fallback: an absent authority
   must not silently mean "no breaks".
6. Extend `generation-input-snapshot.service.ts` to cover `classProgramSlot` in
   the consumed-input fingerprint, so the grid cannot change between the preflight
   read and the write without failing closed.
7. Scope matching, determinism, and ordering preserved per
   `(gradeLevel, programType)` scope.

## 4. Mandatory failing-first controls

The fixture MUST be built by invoking the real producer — never hand-written rows:
`CANONICAL_TEMPLATE_VERSION` (`STAKEHOLDER_DNO_2026_2027_45MIN_R2`),
`getExpectedCanonicalSlots(gradeLevel, programType)`, `seedClassProgramSlots`,
`ensureCanonicalClassProgramSlots`, `resolveCanonicalSlotsForPrograms`,
`resolveCanonicalSlotsFromRows`, `KNOWN_PROGRAM_TYPES`
(`['REGULAR','STE','SPA','SPS']`) from `class-program-slot.service.ts`.

Production-shaped input set: the canonical grid for Grades 7-10 across
REGULAR/STE/SPA/SPS, a policy row with lunch 11:55-12:55 and `enableLunchWindow`
true, EMPTY special events, EMPTY shift windows.

| # | Control | Expected |
|---|---|---|
| 1 | `12:15-13:00` for every scope | is a break, not teachable time |
| 2 | `09:00-09:15` | is a break for Grades 7-8 |
| 3 | `15:15-15:30` | is a break for Grades 9-10 |
| 4 | `11:55-12:55` | is NOT applied as a break window |
| 5 | A class entry placed at `12:15-13:00` | produces a conflict (it is lunch) |
| 6 | Teacher idle 11:55-12:15 then teaching 12:15-13:00 | no idle-gap violation, and 12:15-13:00 is not counted as teaching |
| 7 | Grades 7-8 Regular vs Special Program | 8 vs 10 CLASS rows honoured; no global 10-period assumption |
| 8 | All three callers (generation preflight, manual edit, pre-generation draft) | identical break-window sets for the same scope |
| 9 | Absent authority in manual edit | no longer means "no breaks" |
| 10 | Flag/HGP policy-row-only fallback with an unsnappable window | `FLAG_CEREMONY_SCOPE_INVALID`, fail closed |
| 11 | Input snapshot | covers `classProgramSlot`; a one-row slot change between compute and write fails closed with zero run/audit writes |
| 12 | MUTANT: restore the policy-only break path | controls 1-6 must fail a decisive committed test, then be restored byte-exactly |

## 5. Gates

Warning-authority, constraint-validator, generation-preflight, readiness, and
candidate-domain suites; disposable-PostgreSQL mounted suite fed through the real
producer; server `tsc` + production build; built-server startup with explicit
`.js` ESM runtime-import proof; `git diff --check`; fresh independent QA over the
frozen candidate; clean current-main integration with exact candidate-tree parity;
fresh Wave Completion Audit.

## 6. Boundaries

`atlas-server` source and tests only. No runtime/ports/task/env change, no DB
apply, no migration, no generation, no publication, no login, no companion edit.
Do not touch the forbidden paths in §2.

## 7. Return contract

Base/candidate/integration/final-main SHAs, changed paths, before/after
break-window sets and violation counts per scope, control and mutant results,
whether any assertion was removed (and why), QA and audit tallies, push state,
worktree disposition, single next action, safe parallel work, locked successors.
Additive commits only; never amend, rebase, or force-push. `REVIEW_REQUIRED` only.

## 8. Registration annex

Register at dispatch time, not in advance. `WF-TRANSITION-TERMINAL-RECONCILE-C09`
is terminal and its register window is released, so the only remaining constraint
is the lifecycle contract: a `PLANNED` record may not hold an `ACTIVE` lease
(`PLANNED_WITH_LIVE_LEASE`), `lease-update` never changes a stream's state, and
`create-stream` refuses lease flags unless the spec's state is `RUNNING`. When
this stream's dispatch is authorized, set the spec's `state` to `RUNNING` with a
populated `running[]`, set `blocker.kind` to `NONE` (a `DEPENDENCY` blocker may
not carry safe work), and register atomically:

```
node ops/workflow/transition.mjs --transition create-stream \
  --state docs/plans/atlas-delivery-cycles.json --expect-revision <R> \
  --stream-spec ops/workflow/specs/register/SLOT-BREAK-AUTHORITY-C11.json \
  --observed-origin-main <origin/main tip> \
  --lease-id lease-slot-break-authority-c11 --lease-role executor \
  --by primary-planner:slot-break-c11-registration
```

then `coordination-update --mode CYCLE_ACTIVE --active-cycle-id
SLOT-BREAK-AUTHORITY-C11 --by primary-planner:slot-break-c11-registration`.
Re-read `registry.revision` immediately before every transition; on any
`--expect-revision` disagreement stop and report, never guess.
