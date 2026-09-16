# TT-WARNING-COUNT-C07A — Correction R1 (single consecutive-threshold authority)

ROLE: EXECUTOR. Bounded additive correction on the **same** worktree/branch as
Lane A. Parent cycle `TT-WARNING-REALISM-C07R1`.

## Boundary
- Worktree: `E:/ATLAS-worktrees/tt-warning-count-c07a`
- Branch: `work/tt-warning-count-c07a`
- Base of the reviewed candidate: `4b94d3d193adfd08d791ec36708f10ed99ac5683`
- Frozen cycle base: `c950e6944f148343b8c864bea5aa080bd6a19426`
- Additive commit only (do NOT amend, rebase, reset or force-push).
- Atlas server source + tests only. No `atlas-client/**`, no schema/migration,
  no live/DB/deployment/generation/publication/HIGH action.

## Planner decision (already made — implement, do not relitigate)
A persisted `maxConsecutiveTeachingMinutesBeforeBreak = 120` is the **retired
legacy constant** (it is simultaneously the Prisma schema default, the documented
live value, and the pre-C07 hardcoded constant, and is not expressible as a whole
number of 45-minute periods). The settled policy requires a **period-aligned
default**. Therefore the *effective* threshold is derived once through the
canonical resolver; only a genuinely explicit, slot-expressible value is honored.
No data write is needed — the resolution happens in source at read/enforce time.

The resolver semantics already implemented in
`scheduling-policy.service.ts` `resolveMaxConsecutiveTeachingMinutesBeforeBreak`
are correct and must be preserved:
- absent / non-numeric → `periodLengthMinutes × DEFAULT_ALLOWED_CONSECUTIVE_PERIODS`
  (3 × 45 = 135 for the canonical shape);
- value equal to the legacy constant `120` → the period-aligned default;
- an explicit slot-aligned value (e.g. 135, 180) or any other explicit minute
  count → honored verbatim.

## Root cause (verified by QA at `4b94d3d1`)
The resolver is applied **only inside the validator**. Two sibling production
consumers of the same field still use the raw value:
1. `atlas-server/src/services/schedule-constructor.ts` reads the raw
   `maxConsecutiveTeachingMinutesBeforeBreak` (the consecutive/placement check)
   and its shape policy uses a hardcoded `input.basePolicy?.maxConsecutiveTeachingMinutesBeforeBreak ?? 180`.
   With the legacy 120 it therefore refuses a third consecutive 45-minute period
   when `enforceConsecutiveBreakAsHard` is true, while the validator stays silent.
2. `atlas-server/src/services/scheduling-policy.service.ts`
   `resolveSchedulingPolicyForRead` returns the raw row, so the editor displays
   `120` while enforcement uses `135`.

## Required outcome
Route the effective consecutive threshold through the one canonical resolver at
**every** remaining consumer boundary so that the validator, the schedule
constructor, and the policy read/display path all report and enforce the same
value. Specifically:
- Apply `resolveMaxConsecutiveTeachingMinutesBeforeBreak` where the constructor
  input/base policy is assembled (`atlas-server/src/services/generation-preflight.service.ts`
  `buildPreflightConstructorInput`) and/or at every `schedule-constructor.ts`
  read of the field, and remove the hardcoded `?? 180` divergence so it cannot
  disagree with the resolver.
- Apply the same resolution in `resolveSchedulingPolicyForRead` (and
  `buildSyntheticPolicy` if it can produce this field) so the read/display value
  equals the enforced value.
- Preserve the parity chain generation / manual-edit / pre-generation after the
  change (all three must still agree).

Do **not** change `minBreakMinutesAfterConsecutiveBlock`,
`enforceConsecutiveBreakAsHard`, or the placement semantics.

## Decisive controls (add to `atlas-server/src/__tests__/tt-warning-realism-c07a.test.ts`)
- Constructor and validator resolve the **same** effective threshold for the
  canonical 45-minute shape when the policy carries the legacy `120`
  (assert e.g. 135 in both, and that a third consecutive period is not refused
  by the constructor while the validator is silent).
- `resolveSchedulingPolicyForRead` returns the same effective value that
  enforcement uses.
- An explicit slot-aligned value (`180`) is still honored by all three consumers.
- Mutant: restoring the raw/`?? 180` constructor read makes a decisive test fail.

## Gates (rerun and report)
- `npx tsx src/__tests__/tt-warning-realism-c07a.test.ts`
- `npx tsx src/__tests__/timetable-warning-authority-c04.test.ts`
- `npx tsx src/__tests__/generation-authority-realism-c07.test.ts`
- `npx tsx src/__tests__/generation-authority-realism-c07-trigger.test.ts`
- `npx tsx src/__tests__/generation-authority-realism-c07-term-authority.test.ts`
- `npx tsx src/__tests__/generation-canonical-readiness-genc02.test.ts`
- `npx tsx src/__tests__/publication-contract-readiness.test.ts`
- `npx tsc --noEmit` (server) and `npm run build`
- `git diff --check`

## Return contract
Commit additively on `work/tt-warning-count-c07a` and return `REVIEW_REQUIRED`
with the new candidate SHA, the exact changed paths, the resolved-threshold
evidence for all three consumers, the mutant result, and the gate tally.
