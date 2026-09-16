# TT-WARNING-SURFACE-C07B — Correction R1 (truthful rendered publish message + reachability)

ROLE: EXECUTOR. Bounded additive correction on the SAME worktree/branch as
Lane B. Parent cycle `TT-WARNING-REALISM-C07R1`.

## Boundary
- Worktree: `E:/ATLAS-worktrees/tt-warning-surface-c07b`
- Branch: `work/tt-warning-surface-c07b`
- Reviewed candidate you are correcting: `ddec3adde96728a8dbdc3caa395da7a1da8a38b0`
- Frozen cycle base: `c950e6944f148343b8c864bea5aa080bd6a19426`
- Additive commit ONLY (no amend/rebase/reset/stash/force-push).
- Client source + tests only. No `atlas-server/**`, no schema/migration, no
  browser/login, no live/deployment/HIGH action. Do not edit
  `docs/plans/atlas-delivery-cycles.json` or the generated register.

## Blocking finding F1 (from fresh QA)
`atlas-client/src/components/timetable/simplePublishReadiness.ts:539-544`
computes `totalUnresolved = Math.max(unassignedItems.length, runWideUnassigned)`,
deliberately excluding run-wide **hard** blockers, while
`hasBlockers = totalHardBlockers > 0 || totalUnresolved > 0`.
`SimplePublishReadinessSheet.tsx:199-206` renders that number as a fix-count.
Reproduced: with `runWide={blockingHardCount:2, unassignedCount:0}` the sheet
renders `Cannot publish yet 0 sessions still need fixing …` while also listing
affected sessions. The base behavior used a nonzero fallback, so the candidate
introduced the contradiction.

Required:
- The rendered block message must be truthful in **every** gate branch. Drive
  the sentence from the blocker/unresolved pair, not `totalUnresolved` alone: a
  hard-blocker-only block must not claim zero sessions need fixing.
- Fix `summaryText` (`simplePublishReadiness.ts:550`) too — it carries the same
  flaw (currently unrendered, but it is a second truth surface).
- Add rendered assertions covering: (a) run-wide hard blockers with zero
  unresolved sessions; (b) selected-term-only allowlisted HARD violations with a
  clean run-wide gate; (c) the fully clean case saying "Ready to publish".

## Also required in this correction
- **F3 (B3 third bullet).** Make the aggregate warning rows
  (`SimplePublishReadinessSheet.tsx:224-234`) either expose every affected entry
  or navigate to a real grouped repair view. The aggregated blocker rows already
  expand (`:117-138`); the warning rows currently show label+count only.
- **F2 reachability.** `PublishChecklistContent` is only rendered in the
  `task === 'publish'` branch of `TimetableTaskDrawer.tsx:219-246`, and no caller
  ever sets `task === 'publish'` (`startTask('publish')` opens the dialog
  instead). Dispose of this honestly: either wire the `publish` task to the real
  publish-readiness surface, or retire the unreachable branch and any component
  only it used. No corrected-but-unreachable production component may remain.
  Prove the disposition with a rendered/navigation assertion or an
  evidence-backed removal; if you retire, keep `buildBlockerGroups` only if a
  live consumer uses it.
- **F5.** `TimetableSimpleHeader.tsx:804-808` hardcodes
  `setUnassignedReasonFilter('NO_AVAILABLE_SLOT')` for every placement blocker.
  Honor `destination.reason` so `UNASSIGNED_SECTION` filters correctly.

## Constraints
- Preserve the run-wide gate wiring and the allowlist parity established in
  `ddec3add`. Do not weaken or delete an existing assertion.
- Preserve accessibility, 44px targets, keyboard navigation, responsive layout,
  Simple-first navigation and term-switch state hygiene.
- No browser login / Playwright session (browser rows remain deferred).

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
with the new candidate SHA, the exact changed paths, the rendered block-message
evidence for all three branches, the F2/F3/F5 dispositions, the mutant result,
and the gate tally.
