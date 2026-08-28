# Timetable Simplification Recovery Plan - 2026-07-18

## Audit Summary

The timetable page is functionally stronger after the Phase 0-6 recovery, but it is still visually and cognitively overloaded. The current page exposes too many expert surfaces at once: violations, unassigned recovery, pinned draft sessions, room requests, pivot controls, setup sync, generation actions, tactical sandbox, manual edit history, map/policy tools, and multiple dialog families. This creates a scheduler cockpit instead of a guided scheduling workspace.

The most important regressions raised by the user are valid:

- Generated-run unassigned dragging was routed into the deprecated "Assign teacher and room" modal instead of using Teaching Load ownership.
- At-a-glance grid feedback was over-corrected for performance; only the hovered cell showed useful placement/swap/conflict state.
- The deprecated teacher/room assignment model remained visible in timetable dialogs even though teacher ownership belongs in Teaching Load.
- The page still needs stronger visual hierarchy so non-technical schedulers see one primary task at a time.

## UX Principles For This Recovery

1. Timetable is for placing, moving, and swapping sessions; Teaching Load is for teacher ownership.
2. Grid guidance must be visible at a glance, but conflict computation must not run at pointer frequency.
3. Default UI must show the next task, not every expert diagnostic.
4. Expert tools remain available, but disclosed behind deliberate actions.
5. Drag must have click/tap alternatives, but desktop drag must still work.

## Prompt Phase 0 - Audit, Contracts, and Gates

Prompt:

```text
Audit the timetable page for visual overload, hidden critical actions, deprecated teacher-assignment surfaces, unassigned placement regressions, and swap modal regressions. Produce a source-backed checklist of expected behaviors and update guardrails so future changes cannot pass by removing functionality.
```

Gate:

- Source audit identifies each deprecated teacher/room modal path.
- Guardrails assert that generated unassigned placement does not reopen the deprecated assignment picker.
- Guardrails assert that source selection/drag starts a grid-wide preview without pointer-frequency conflict recomputation.

Status: Implemented in this pass.

## Prompt Phase 1 - Restore At-a-Glance Grid Guidance Without Reintroducing Drag Lag

Prompt:

```text
Restore the useful "all cells show what will happen" behavior while keeping performance containment. When a source session is selected or dragged, compute visible cell status once per source change and render compact labels for Place, Swap, Occupied, Blocking, Warning, and Current. Keep pointer-frequency updates limited to the currently hovered cell only.
```

Gate:

- Selecting a generated unassigned item shows grid-wide Place/Swap/Occupied/Blocking/Warning labels.
- Dragging a generated unassigned item shows the same grid-wide labels during drag.
- `getLiveCellConflict` is not called from pointer-move handlers.
- Existing Phase 6 drag/click gate still passes.

Status: Implemented in this pass.

## Prompt Phase 2 - Replace Deprecated Generated-Unassigned Teacher/Room Assignment Flow

Prompt:

```text
Remove the generated-run "Assign teacher and room" timetable modal. Generated unassigned placement shall use the Teaching Load owner already present on the unassigned item and the section home room. If the item has no Teaching Load owner, route to Teaching Load repair. If the item has no home room, show a setup/room-readiness blocker. Do not ask the scheduler to choose a teacher inside the timetable placement flow.
```

Gate:

- Generated unassigned click placement does not show "Assign teacher and room."
- Generated unassigned drag placement does not show "Assign teacher and room."
- Items with `facultyId` and `homeRoomId` preview/commit through `PLACE_UNASSIGNED`.
- Items without `facultyId` open the Teaching Load repair path.

Status: Implemented in this pass for generated-run unassigned placement.

## Prompt Phase 3 - Modern Swap Review Modal Unification

Prompt:

```text
Unify generated-view and pre-generation swap review around the modern visual swap modal. The modal shall show Session A, Session B, before/after slots, affected counts, hard/soft conflict figures, and the recommended safe action. It shall not ask for teacher assignment. Pre-generation swap shall use existing draft placement identities and generated-run swap shall use the existing swap preview endpoint.
```

Gate:

- Generated occupied-session swap opens only the modern visual review.
- Pre-generation occupied-slot swap opens only the modern visual review.
- No swap dialog contains "Choose teacher," "Assign teacher," or teacher reassignment controls.
- Direct swap / repair strategy labels are plain language.

Status: Implemented, Codex-verified, and Antigravity-verified GO.

Evidence:

- Replaced the deprecated generated/pre-generation timetable teacher-room assignment review with readonly Teaching Load owner, suggested room, target slot, and hard/soft conflict figures.
- Generated occupied-slot swap now uses a visual switch review with before/after outcomes and hard/soft figures instead of timetable-owned teacher/room reassignment controls.
- Removed stale timetable ownership copy from the tactical dock, right panel, placement dialogs, manual edit labels, tour text, and recovery copy.
- Added `qa-artifacts/playwright/specs/timetable-simplification-phase03.spec.ts`.
- `npm run test:timetable-conflict`: PASS `10/10`.
- `npm run test:ux-guardrails`: PASS `24/24`.
- `npx tsc --noEmit` in `atlas-client`: PASS.
- `npm run build` in `atlas-client`: PASS.
- `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-simplification-phase03.spec.ts --workers=1`: PASS `6/6` across desktop, mobile portrait, and mobile landscape.
- `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-workflow-phase01.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase05.spec.ts --workers=1`: PASS `12/12` across desktop, mobile portrait, and mobile landscape.
- `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-workflow-phase02.spec.ts qa-artifacts/playwright/specs/timetable-simplification-phase03.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase06.spec.ts --workers=1`: PASS `18/18` across desktop, mobile portrait, and mobile landscape.
- `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-workflow-phase04.spec.ts --workers=1`: PASS `6/6` across desktop, mobile portrait, and mobile landscape.

Note:

- The live Tailnet pre-generation board currently filters to a section with no visible occupied draft entries, so direct live pre-generation occupied-slot switching is protected by source/static guardrails and the shared visual switch dialog code path. Generated occupied-slot visual switching is browser-verified live.

## Prompt Phase 4 - Simplify Default Page Composition

Prompt:

```text
Reduce timetable visual overload by making the default workspace task-first. Keep the primary task strip and grid visible. Collapse diagnostics by default. Move policy/map/history/sync/setup tools behind one More menu. Keep Needs attention visible only when the current task requires it. Ensure no functionality is removed.
```

Gate:

- First-load viewport shows the primary task, grid, and one context rail only.
- Advanced diagnostics are not visible by default.
- User can still reach violations, unassigned, requests, policy, map, history, setup sync, generation, and publish.
- No global scrollbars.

Status: Implemented and Codex-verified in this pass.

Evidence:

- Moved nonessential timetable filters behind a `Filters` popover while keeping view/entity controls visible.
- Compressed the task guide from a large "What to do next" card into a smaller "Next task" strip that preserves large labeled task buttons.
- Shortened visible mobile help copy while preserving the full placement/switch/draft guidance for screen readers and regression assertions.
- Collapsed compact viewport side panels to zero width by default so the first mobile viewport is grid-first.
- Kept the generated and draft unassigned rails reachable through the existing task buttons; updated Phase 01 regression coverage to use the task-button path when the hidden rail tab is not visible.
- Auto-collapsed the right detail panel when no entry or draft queue item is selected, removing the persistent empty details rail.
- `npx tsc --noEmit` in `atlas-client`: PASS.
- `npm run test:timetable-conflict` in `atlas-client`: PASS `10/10`.
- `npm run test:ux-guardrails` in `atlas-client`: PASS `25/25`.
- `npm run build` in `atlas-client`: PASS.
- `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-workflow-phase04.spec.ts --workers=1`: PASS `6/6` across desktop, mobile portrait, and mobile landscape.
- `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-simplification-phase03.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase05.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase06.spec.ts --workers=1`: PASS `18/18` across desktop, mobile portrait, and mobile landscape.
- `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-workflow-phase01.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase02.spec.ts --workers=1`: PASS `12/12` across desktop, mobile portrait, and mobile landscape.

Notes:

- `atlas-client` still has no configured `lint` script, so lint remains unavailable as a package gate.
- Phase 5 should continue the visual-density pass for copy/badge refinement, but Phase 4's default composition and compact layout blockers are closed.

## Prompt Phase 5 - Older-User Copy and Visual Density Pass

Prompt:

```text
Rewrite timetable microcopy and visual hierarchy for older non-technical schedulers. Replace technical labels with action labels, reduce badge noise, increase spacing where task-critical, and ensure every blocked state says what to do next.
```

Gate:

- Critical actions have 44px targets where practical.
- No critical action is hover-only on mobile.
- Empty/blocked states include the next action.
- Status language distinguishes "blocked," "warning," "occupied," "can place," and "can swap."

Status: Implemented and Codex-verified in this pass.

Evidence:

- Replaced grid-wide preview labels with plain-language `Can place`, `Can swap`, `Blocked`, and `Warning` states while preserving the existing placement/swap/review flows.
- Added a persistent timetable status legend explaining that `Can place` means an empty slot, `Can swap` means an occupied slot, `Blocked` means fix first, and `Warning` means review only.
- Changed top task badges from bare counts to capped action labels such as `99+ to place` and `99+ blocked`.
- Reduced generated-unassigned collapsed-card noise by moving detailed reason/program badges into the expanded explanation area.
- Enlarged generated-unassigned recovery controls so the primary click-placement/fix path is easier for older and touch users.
- `npx tsc --noEmit` in `atlas-client`: PASS.
- `npm run test:ux-guardrails` in `atlas-client`: PASS `26/26`.
- `npm run test:timetable-conflict` in `atlas-client`: PASS `10/10`.
- `npm run build` in `atlas-client`: PASS.
- `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-workflow-phase05.spec.ts --workers=1`: PASS `6/6` across desktop, mobile portrait, and mobile landscape.
- `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-workflow-phase04.spec.ts --workers=1`: PASS `6/6` across desktop, mobile portrait, and mobile landscape.
- `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-workflow-phase01.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase02.spec.ts qa-artifacts/playwright/specs/timetable-simplification-phase03.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase06.spec.ts --workers=1`: PASS `24/24` across desktop, mobile portrait, and mobile landscape.
- Antigravity external verification returned `GO` with automated gates passing, no app-level console/page/network errors, no global scrollbars, generated click/drag placement working, modern swap review intact, pre-generation draft review working, and obsolete teacher/room modal absent.

Notes:

- `atlas-client` still has no configured `lint` script, so lint remains unavailable as a package gate.
- Phase 5 is externally closed. Phase 6 should perform final release validation only, without adding new UI scope.

## Prompt Phase 6 - External Browser Validation

Prompt:

```text
Run full browser Playwright validation on the live Tailnet for timetable simplification. Prove that generated unassigned drag and click placement work, grid-wide status appears on select and drag, swap review uses the modern review modal, the deprecated assignment modal is gone, and the simplified page remains navigable across desktop and mobile.
```

Gate:

- Codex browser validation passes first.
- Antigravity independently validates with browser Playwright before proceeding beyond this phase.

Status: Codex-verified in this pass; pending Antigravity final external release confirmation.

Evidence:

- Tightened `timetable-workflow-phase06.spec.ts` to assert the final Phase 5 plain-language feedback contract: `Can place`, `Can swap`, `Blocked`, `Warning`, `Occupied`, and `Current`.
- `npx tsc --noEmit` in `atlas-client`: PASS.
- `npm run test:ux-guardrails` in `atlas-client`: PASS `26/26`.
- `npm run test:timetable-conflict` in `atlas-client`: PASS `10/10`.
- `npm run build` in `atlas-client`: PASS.
- Full live Tailnet matrix passed across desktop, mobile portrait, and mobile landscape:
  - `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-workflow-phase01.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase02.spec.ts qa-artifacts/playwright/specs/timetable-simplification-phase03.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase04.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase05.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase06.spec.ts --workers=1`: PASS `36/36`.

Notes:

- Phase 6 write-sensitive tests block non-preview generation mutations and verified no live timetable writes were committed.
- `atlas-client` still has no configured `lint` script, so lint remains unavailable as a package gate.
- This phase is ready for Antigravity final external browser verification.
