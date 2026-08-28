# Prompt 3 — Lightweight Session Selection and Tactical Sandbox Optimization

## Objective

Make ordinary session selection immediate and predictable, then make the advanced Tactical Sandbox explicit, delta-based, and bounded in DOM/CPU cost.

## Preconditions

- Prompt 0 selection baseline exists.
- Prompt 2 conflict detail remains correct.

## Required work

1. Decouple simple selection from opening or computing the Tactical Sandbox.
2. On selection, show concise session details and available actions without automatically entering an advanced editing workflow.
3. Open the Tactical Sandbox only after explicit user intent, while preserving the selected session and current context.
4. Precompute faculty teaching minutes once from entries and apply selected/bulk deltas instead of cloning/scanning the complete draft per candidate.
5. Cache subject/term eligibility against stable data versions.
6. Virtualize or incrementally render candidate results so initial DOM is bounded.
7. Avoid simultaneous right-panel and bottom-dock expansion that causes competing layout motion; choose one clear primary inspector behavior for the active task.
8. Preserve current faculty, workload-cap, ancillary-credit, bulk-change, revision, and publish-state correctness.
9. Provide plain-language loading, empty, unavailable, and error states suitable for older non-technical users.

## Files to inspect first

- `atlas-client/src/hooks/useTimetableMutations.ts`
- `atlas-client/src/components/timetable/CenterWorkspace.tsx`
- `atlas-client/src/components/timetable/TacticalSandboxDock.tsx`
- `atlas-client/src/components/timetable/TacticalSandboxDock.helpers.ts`
- `atlas-client/src/components/timetable/RightPanel.tsx`

## Acceptance gates

- Visible selection feedback ≤100 ms and intended lightweight inspector p95 ≤150 ms.
- Simple selection performs no Tactical Sandbox candidate calculation.
- Sandbox candidate calculation <10 ms at 1,000 entries and 250 faculty.
- Initial candidate DOM contains no more than 30 cards/rows.
- No main-thread task >50 ms during sandbox open, search, or candidate selection.
- Workload and eligibility results match the pre-refactor source of truth for representative single and bulk edits.
- Selection remains keyboard/touch accessible and does not unexpectedly move focus.
- Reduced-motion mode has no essential animation dependency.

## Verification

- Re-run repeated selection and explicit sandbox scenarios from Prompt 0.
- Add unit tests for delta workload calculation and eligibility cache invalidation.
- Compare old/new candidate ordering and workload labels on fixed fixtures.
- Capture moderated or proxy usability evidence for the explicit advanced-tool entry point.

## Out of scope

- Removing advanced repair functionality.
- Changing workload policy or assignment authority.
