# Timetable UX audit — older-scheduler surface (2026-09-26)

**Cycle:** Lane C read-only audit. **Tree audited:** `origin/main` `0ecf4778` (which already contains
`DRAFT-UX-C01` `9f42190e`). **Live release:** `861d89a2` — *not* the audited tree, and not audited here.
**Method:** two independent read-only lanes (overwhelm/jargon census; task-effectiveness and dead-end
walk), planner-adjudicated. Nothing was edited by the audit; no browser, database, or network was used.

## The one framing fact

**Every finding below survives the pending `9f42190e` deploy.** The audit ran against the tree that
already contains DRAFT-UX-C01, so none of it is fixed by shipping that release. This audit therefore
describes the *next* cycle's work, not the current fix's.

## Verdict

The **act** half of the workflow is genuinely strong: preview-before-save, plain reasons for disabled
controls, real destinations behind every blocker action, an honest fail-closed term gate, and
`Why can't I publish?` as a sheet description. The **diagnose** half has holes where a problem is
visible but the thing that names it is never rendered — and one where a stated next action points at the
wrong surface. Ten blocking findings, one of which prevents a scheduler from ever starting, and one
systemic test-methodology defect that explains why this class keeps recurring.

| # | Finding | Tier | Anchor |
|---|---|---|---|
| 1 | **Generation-blocked is a dead end.** The header says "Review the item shown" and shows no item; `diagnostic.blockers[]` is never rendered anywhere in the client. The one surface that claims to list them (`/timetable/setup` → "Review readiness") opens the *publication* readiness sheet, which for a run-less year answers "No timetable generated yet". | **BLOCKING** | `TimetableSimpleHeader.tsx:302,604-618`; `timetable-generation-readiness.ts:226-230,307-316`; `TimetableSetupPane.tsx:94,222,250`; `SimplePublishReadinessSheet.tsx:218-222` |
| 2 | **The repair banner always states "0 sessions affected."** `groupCount` is hard-coded to `0` at its only producer, directly above "ATLAS cannot test slots until this is resolved". The true count is `group.count`, already threaded on the type. A test asserts only that the *string* "sessions affected" is present, so it stays green. | **BLOCKING** | `TimetableSimpleHeader.tsx:137`; `SimpleTaskDrawerHelpers.tsx:355-359`; `SimplePublishReadinessSheet.tsx:97`; `timetable-operator-workflow-state.test.ts:333` |
| 3 | **One HARD problem has four names on one screen** — `Must fix` / `Blocked` / `blocker` / `hard` — and **three different "hard" numbers** render with nothing stating they can legitimately differ. | **BLOCKING** | `TimetableGridConflictBadge.tsx:22-25,128`; `SimpleHeaderHelpers.tsx:212,736`; `ScheduleReviewWorkspaceSummaryStats.tsx:77`; `SimpleTaskDrawerHelpers.tsx:211-212` |
| 4 | **Recommended task and lifecycle next step can contradict each other** — `chooseRecommendedTask` tests `hardCount` while the next step is computed from `blockingHardCount`, so the header can say "Review issues" and "Ready to publish" simultaneously. | **BLOCKING** | `SimpleHeaderHelpers.tsx:785` vs `TimetableSimpleHeader.tsx:352` |
| 5 | **A term-scoped count sits beside a run-wide count.** `Unassigned sessions (0)` (Term 2 only) is one click from `2 unresolved sessions still need fixing` (whole year); the drawer header is run-wide above a term-scoped list. Scope is disclosed only at zero. | **BLOCKING** | `SimpleHeaderActions.tsx:82-87,263`; `TimetableSimpleHeader.tsx:470-474`; `TimetableTaskDrawer.tsx:185-189` vs `:644-746` |
| 6 | **Drift suppresses the term-authority notice.** `TimetableSimpleHeader.tsx:573-594` is a ternary, so a run that is both drifted *and* on an unverified term shows no term warning. This is a §7 fail-closed disclosure made conditional on an unrelated condition. | **BLOCKING** (invariant) | `TimetableSimpleHeader.tsx:573-594`; `useTimetableData.ts:331` |
| 7 | **The unassigned-session evidence surface is unreachable.** `unassignedFixSuggestions` is permanently `{}` — its only two writers are one unimported file branch and one exported-but-never-rendered component. So `Still blocked` and `Ready to place` are unreachable, the `Blocked` filter chip always yields zero rows, and the plain "Why blocked" sentence exists only in dead code. | **BLOCKING** | `GeneratedRunRailPanels.tsx:820`; `GeneratedUnassignedPanel.tsx:504,636,55-56,184`; `useScheduleReviewWorkspaceState.ts:418`; `TimetableTaskDrawer.tsx:693-699` |
| 8 | **The two highest-traffic controls have no visible label.** View type and the entity picker were stripped to `aria-label`/`sr-only` to satisfy the ≤6 cap; a sighted scheduler sees `Section ▾ | Choose schedule ▾`. **This reverses a deliberately accepted DRAFT-UX-C01 decision** and is an operator call, not a planner call. | **BLOCKING** (persona) | `SimpleHeaderHelpers.tsx:271-296`; accepted contract `draft-ux-c01.test.tsx:410-425` |
| 9 | **Inline room chooser disappears at ≤1 teaching space** while the consequence still says "Choose a room first" and Confirm stays disabled — an instruction that cannot be followed. | **BLOCKING** | `InlinePlacementPreview.tsx:43`; `lib/timetable-inline-placement.ts:78-83` |
| 10 | **Undo/Redo are absent in Simple**, and the test titled *"Advanced and Simple both render a visible Undo/Redo/History control"* only greps that the component appears somewhere in the file. **The test name asserts a claim the code does not honour.** | **BLOCKING** (test integrity) | `ScheduleReviewWorkspace.tsx:596-607,74-77`; `timetable-dynamic-workspace-undo-redo.test.ts:59-67` |

## Systemic: why this class of defect survives a green suite

The dominant test pattern in this area is **source-text assertion** (`readFileSync` + regex):
`timetable-operator-workflow-state.test.ts`, `timetable-operator-repair.test.ts`,
`timetable-capabilities.test.ts`, rows 4 and 7 of `timetable-dynamic-workspace-undo-redo.test.ts`,
`timetable-dynamic-workspace-capabilities-guard.test.ts`, `timetable-dynamic-workspace-scope-links.test.ts`.
A regex cannot detect a wrong *value*, a count mismatch, an unmounted component, or a testid that is
never reached. **Findings 2, 5, 7 and 10 all survive a fully green suite.** The DOM suites
(`draft-ux-c01.test.tsx`, `timetable-dynamic-workspace-rendered.test.ts`,
`timetable-lifecycle-loading-render-c03.test.tsx`) are what would catch them, and they currently have no
fixture with `curriculumReadiness.state === 'blocked'`, no assertion on the drawer header count, and no
layout-mode-parameterised Undo/Redo row. Treat this as part of the fix, not beside it.

## Two more control-count facts

- The **≤6 Simple header cap is asserted only in tests, never enforced** — there is no constant, guard,
  or prop. The **drift state already renders 8**: the header passes `showActions={false}` to the drift
  banner, but the regenerate pair is not gated by it (`SimpleDriftBanner.tsx:224-251`,
  `TimetableSimpleHeader.tsx:586,588`).
- The **Expert header shows ≈19–20 simultaneous controls** and three `overflow-x-auto` bands. The
  six-control discipline was never applied there. The Simple header is the *only* hardened surface.

## Protect this — the audit found much that is right

These are contract-backed and must survive any correction:

1. **The one-primary rule is real and tested** — `assert.equal(controls.filter(bg-primary).length, 1)`.
2. **The severity sign states the consequence** — `This blocks saving and publishing.` / `This does not
   block saving or publishing.` The plain English the persona needs already exists; only the *word*
   disagrees with the badge's "Blocked" (finding 3).
3. **Every disabled control says why**, in full opacity, in the same control.
4. **`Generate` beside a published run is relabelled `New version`** with the honest
   "Teachers keep seeing the published schedule until you publish the new one."
5. **Preview-before-save is a stated promise** — "Nothing changes until you confirm."
6. **Every blocker action resolves to a real destination** through one shared resolver; there is no
   no-op "Review issue" button.
7. **Run-wide gate vs selected-term display are labelled, not merged** (three separate scope notes).
8. **The severity filter does not hide grid signs** — the grid reads `violationIndex`, not the
   filtered list.
9. **A missing run is never "clean"** — "No timetable generated yet" plus why.
10. **All-term export is impossible** — three independent guards, each with plain copy.
11. **Term predicates are load-bearing and correct** — `isVerifiedOrderedActiveTerm`, `matchesTermScope`,
    `isTargetSlotOccupiedForTerm`, and the term filter on `programKindFilteredUnassignedItems`. A missing
    term never becomes Term 1 in any path found.
12. **Fail-closed term gate with a real repair** — "Term setup is required before the timetable can be
    loaded." + Retry + Open Year Setup.
13. **Expert tooling is honestly labelled, not hidden** — the More menu groups it under a section
    literally titled `Expert tools`.
14. **Provenance is hidden when routine** — "Routine provenance remains in Expert diagnostics."
15. **The Advanced orientation strip answers the persona's real question** — `Term:` / `Scope:` /
    `Next: Resolve the highlighted blockers`. It is the best "what do I do next" on the surface, and
    **Simple has no equivalent** (see next cycle).

## Needs a live surface to settle (not decided by this audit)

- `NEEDS_BROWSER` — at 390×844, does the grid force horizontal panning to read one day? `min-w-160`
  (~640 px) inside a 390 px viewport with an *enforced* 14 px type floor, and unlike every other ATLAS
  list there is no card fallback. jsdom cannot answer layout.
- `NEEDS_BROWSER` — with the unresolved-sessions drawer open at 390×844, is the grid it acts on still
  visible? The drawer becomes a 72%-height overlay at that width.
- `NEEDS_BROWSER` — does the readiness sheet show exactly one scrollbar, with Close reachable, given a
  hard-coded `calc(100svh - 8rem)` instead of a flex child?
- `NEEDS_DEPLOYED` — finding 1 end to end, against the live GEN-C02 diagnostic on a built surface.
- `NEEDS_BROWSER` — when an item's own term has no free slot, does the scheduler perceive that, or does
  the tray simply offer no highlight? The code offers no affordance and no message.

## Proposed next cycle (not dispatched; deployment held)

Bounded, client-only, in dependency order, sized as one reviewable packet:

- **C1 — truthfulness (surgical, do first).** Finding 2 (real `groupCount`), finding 4 (align
  `chooseRecommendedTask` with the lifecycle predicate), finding 9 (room chooser), and the four-name /
  three-number collapse in finding 3. Each is a false or contradictory statement on the primary repair
  path. Add the missing DOM fixtures (`curriculumReadiness.state === 'blocked'`, drawer header count,
  layout-parameterised Undo/Redo) so the suite can fail on this class.
- **C2 — the generation dead end.** Finding 1: render the real blocker list with its `owningSurface`
  and `nextAction`, and re-point the setup pane's "Review readiness" at generation readiness rather than
  publication readiness. Highest scheduler value; needs a real fixture to prove it.
- **C3 — count and scope truthfulness.** Finding 5 and the unassigned count paths in finding 7.
- **C4 — the unassigned evidence surface.** Finding 7's dead writers: either mount the panel or delete
  the dead branch, and make the "Why blocked" sentence reachable.
- **C5 — invariant.** Finding 6 (drift must not suppress the term-authority notice).

Deliberately **not** in these cycles without an operator decision: finding 8 (reverses an accepted
DRAFT-UX-C01 contract), the Expert header's ~20 controls, and the 390 px grid.

## Custody

Lane C is held by this planner session from 2026-09-26. **The audit is read-only, so it creates no
write conflict.** Note the standing lane map assigns the *client timetable surface and deployment* to
Lane A (opencode). Any C1–C5 implementation therefore overlaps Lane A's declared ownership and needs an
explicit boundary before source writes begin. Deployment of `9f42190e` is **held** by operator
instruction, not by a defect.
