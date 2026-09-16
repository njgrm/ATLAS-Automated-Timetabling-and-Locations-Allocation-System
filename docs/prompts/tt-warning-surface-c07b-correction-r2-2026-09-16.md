# TT-WARNING-SURFACE-C07B — Correction R2 (root-cause closure of the block sentence)

ROLE: EXECUTOR. Root-cause closure correction on the SAME worktree/branch as
Lane B. Parent cycle `TT-WARNING-REALISM-C07R1`. This is the second substantive
correction on this lane, so it is one coherent closure packet — fix the whole
sentence-authority contract, not another local patch.

## Boundary
- Worktree: `E:/ATLAS-worktrees/tt-warning-surface-c07b`
- Branch: `work/tt-warning-surface-c07b`
- Reviewed candidate you are correcting: `12c50ab71807424e5e7b7c9215d0483b5be02821`
- Frozen cycle base: `c950e6944f148343b8c864bea5aa080bd6a19426`
- Additive commit ONLY (no amend/rebase/reset/stash/force-push).
- Client source + tests only. No `atlas-server/**`, no schema/migration, no
  browser/login, no live/deployment/HIGH action. Do not edit
  `docs/plans/atlas-delivery-cycles.json` or the generated register.

## Root cause (do not patch around it)
The publish block sentence conflates **two independent authorities**:
1. the **hard-violation authority** — run-wide `runWide.blockingHard` plus
   HARD-severity selected-term violation groups; and
2. the **unresolved-queue authority** — unassigned reason groups built from
   `buildItemsFromUnassigned` (each unresolved session is either a HARD
   `UNASSIGNED_SECTION` or a SOFT `SPECIALIZED_ROOM_UNAVAILABLE`; the SOFT path
   legally yields `blockingHard = 0` with `unassignedCount > 0`).

`simplePublishReadiness.ts` folds the unresolved-queue groups into
`totalHardBlockers` (`groupBlockerCount` → `Math.max(groupBlockerCount, runWideBlockingHard)`),
so the sentence claims "N hard blockers" that are not hard violations and
double-counts the same sessions. Reproduced with a production-shaped draft
(2 `unassignedItems` with `reason: NO_AVAILABLE_SLOT`, `runWide = {blockingHardCount: 0, unassignedCount: 2}`):
`2 hard blockers and 2 unresolved sessions still need fixing …` rendered beside
a panel that says **0 blocking hard**.

## Required outcome (one coherent closure)
- The **hard clause** of `blockerSentence` and `summaryText` must be driven
  **only** by the hard-violation authority: run-wide `runWideBlockingHard` plus
  HARD-severity selected-term violation groups.
- The **unresolved clause** must be the only place unresolved reason groups
  appear; they must never be added to the hard-blocker count.
- The sentence must be internally consistent: it must never state a
  hard-blocker count that contradicts the run-wide hard gate rendered in the
  same panel. `summaryText` must agree with `runWideBlockingHard`.
- Preserve the F2/F3/F5 fixes and the run-wide gate wiring and allowlist parity.

## Fixtures (the current guard cannot detect the defect)
Existing fixtures built from `draftReport()` have empty `unassignedItems`, which
is **not** producer-equivalent. Add **producer-shaped** fixtures and assert the
rendered sentence plus `summaryText`:
- unresolved-only: 2 items, `runWide = {blockingHardCount: 0, unassignedCount: 2}`
  → sentence reports 0 hard blockers and 2 unresolved sessions;
- hard-only: `runWide = {blockingHardCount: 2, unassignedCount: 0}` → 2 hard
  blockers, no unresolved claim;
- mixed: 1 hard blocker + 2 unassigned → exactly 1 hard blocker and 2 unresolved
  sessions, with no session counted twice;
- clean → "Ready to publish".

## Mutants (each must fail a decisive test)
- folding unresolved reason groups back into the hard-blocker count;
- reverting the sentence to `totalUnresolved` only (the original F1 defect);
- a hard clause that contradicts `runWideBlockingHard`.

## Gates (rerun and report exact results)
- `npx tsx --test src/lib/__tests__/tt-warning-surface-realism-c07b.test.ts`
- `npx tsx --test src/lib/__tests__/timetable-warning-authority-contract.test.ts src/lib/__tests__/tt-source-freshness-client-c04.test.ts`
- `npx tsx --test src/lib/__tests__/timetable-dynamic-workspace-rendered.test.ts src/lib/__tests__/timetable-dynamic-workspace-publication.test.ts`
- the full `src/lib/__tests__/timetable-dynamic-workspace-*.test.ts` set
- `npx tsx --test src/lib/__tests__/timetable-operator-workflow-state.test.ts src/lib/__tests__/uxc01r-generation-readiness.test.ts`
- `npx tsc --noEmit` and `npm run build` (client)
- `git diff --check`

## Return contract
Commit additively on `work/tt-warning-surface-c07b` and return `REVIEW_REQUIRED`
with the new candidate SHA, exact changed paths (full range c950e694...<new>),
the rendered sentence and `summaryText` evidence for all four fixtures, the
mutant results, the F2/F3/F5 preservation evidence, and the gate tally.
