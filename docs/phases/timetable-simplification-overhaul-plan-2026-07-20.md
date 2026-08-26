# Timetable Simplification Overhaul Plan - 2026-07-20

## Objective

Transform `/timetable` from an expert cockpit into a simple, guided scheduling workspace that still preserves the required power features.

The page must make the common tasks obvious:

1. Review the schedule.
2. Place unresolved sessions.
3. Swap sessions.
4. Plan before generating.
5. Publish only when clean.

Everything else must be progressively disclosed.

## Non-Negotiable Outcomes

- Generated unassigned placement must be possible when the data is placeable.
- If an unassigned item is not placeable, the UI must say exactly why and show the next action.
- Swap must use the modern visual review flow and the final action must say `Swap sessions`, not `Apply repair`.
- The default page must not show diagnostics, violation walls, setup tools, policy tools, map tools, and repair panels at once.
- The workflow must be usable by older non-technical users without drag precision.
- Browser tests must prove actual commit attempts through reversible or write-blocked gates, not only that dialogs open.
- The setup pages that feed timetable quality (`/sections`, `/subjects`, `/teachers`, `/teaching-load`) must stop wasting vertical space with oversized headers.
- The app must visibly explain whether it is using live EnrollPro-verified data or stale ATLAS-persisted data before a scheduler trusts the timetable.

## Phase 0A - Runtime Source-Truth Reconciliation

### Goal

Stop silent data drift before UI work hides it.

The current live resolver is using stale ATLAS-persisted school year `39`, while the previous EnrollPro-backed working dataset exists under school year `55`. This changes the number of sections, enrollment totals, home-room availability, and generated timetable behavior.

### Work

- Add a source-truth audit gate that records:
  - `GET /api/v1/runtime/context?schoolId=1`,
  - `GET /api/v1/runtime/context?schoolId=1&verifyUpstream=true`,
  - section counts for the resolved school year,
  - latest generation run for the resolved school year.
- Add visible source-truth copy to setup/timetable pages:
  - `Using saved ATLAS data`,
  - `Verified with EnrollPro`,
  - `Source unavailable`,
  - `School year mismatch`.
- Decide whether the active scheduling workspace should continue using school year `39` or restore the previous EnrollPro-backed school year `55` dataset.
- Block final timetable GO when runtime evidence mixes school-year sources without an explicit operator-visible decision.

### Gate

- A scheduler can tell which school year and source are being used before taking action.
- The page does not silently switch from the expected EnrollPro-backed dataset to another persisted dataset.
- The verification report includes section counts and latest-run ID for the selected school year.

## Phase 0 - Stop False GO: Real Workflow Contract Audit

### Goal

Replace shallow verification with tests that prove the primary user journeys reach the correct commit path or a clear blocker state.

### Work

- Add a live Tailnet audit gate for generated unassigned click placement.
- Add a live Tailnet audit gate for generated unassigned drag placement.
- Add a live Tailnet audit gate for generated occupied-slot swap commit attempt.
- Add explicit assertions for whether the selected unassigned item has:
  - Teaching Load owner,
  - room source,
  - compatible target slot.
- Mark current generated unassigned placement as `NO-GO` when `targetRoomId` cannot be resolved.
- Update tests so `Place session` cannot pass if it only opens the Tactical Sandbox.

### Gate

- The test must fail when a visible `Place session` action does not lead to placement review or a clear `Fix room first` / `Fix owner first` state.
- The test must prove swap reaches `manual-edits/swap` when the user confirms a safe swap.
- No live write should be committed unless using a reversible fixture.

## Phase 1 - Repair Generated Unassigned Placement Contract

### Goal

Make generated unassigned placement honest and usable.

### Work

- Split unassigned item states into explicit categories:
  - `Ready to place`
  - `Needs room`
  - `Needs Teaching Load owner`
  - `Needs regeneration`
  - `Blocked by conflict`
- Resolve `targetRoomId` from the best valid room source:
  - section home room,
  - selected target cell room context where applicable,
  - server-provided placement suggestion,
  - explicit room-readiness blocker.
- Do not show `Place session` when `targetRoomId` is missing.
- Replace misleading `Place session -> Tactical Sandbox` behavior with:
  - `Place on grid` for placeable items,
  - `Fix room first` for missing room,
  - `Fix Teaching Load owner` for missing owner,
  - `Regenerate after setup fix` for stale/non-placeable items.
- Keep teacher ownership out of timetable placement.

### Gate

- For a placeable generated unassigned item, click and drag both open the same modern placement review and can reach the manual-edit commit path.
- For a non-placeable item, the UI never says `Place session`; it shows the exact blocker and next action.
- Current run `223` must show `Needs room` or equivalent for items with `homeRoomId=null`.

## Phase 2 - Simplify Swap Into a Single Obvious Flow

### Goal

Make session switching understandable and confidence-building.

### Work

- Rename final generated swap action from `Apply repair` to `Swap sessions`.
- Keep advanced strategies behind a secondary disclosure:
  - `Direct swap`
  - `Move blocking session`
  - `Move selected session`
- Show a one-screen before/after card:
  - selected session,
  - target session,
  - before slots,
  - after slots,
  - blocking count,
  - warning count,
  - recommended action.
- Make click-to-swap the primary path.
- Keep drag-to-swap as an optional shortcut.

### Gate

- Clicking two occupied generated sessions opens the visual swap review.
- The primary confirmation button says `Swap sessions`.
- The swap confirmation reaches the swap commit endpoint or a reversible fixture commit.
- No teacher/room assignment controls appear.

## Phase 3 - Rebuild the Page Shell Around One Primary Task

### Goal

Stop showing the whole cockpit by default.

### Work

- Replace the current three-panel default with a guided shell:
  - top: minimal run/status bar,
  - center: timetable grid,
  - bottom or side: current task drawer.
- Default first load should show:
  - current run identity,
  - publish readiness,
  - one recommended next action,
  - grid.
- Hide these behind `More` or task drawers:
  - full violation list,
  - resource diagnostics,
  - policy tools,
  - map tools,
  - setup sync,
  - edit history,
  - advanced filters.
- Keep `Needs attention` as a drawer, not an always-open rail.

### Gate

- First viewport shows grid plus one clear next action.
- Violation rows are not visible on first load.
- Unassigned recovery is one click away.
- No global scrollbar.
- Mobile first load gives the grid at least 90% of usable width.

## Phase 3A - Cross-Page Compact Header Architecture

### Goal

Fix the shared UI failure where setup pages spend too much vertical space on headers before showing the table.

### Scope

- `/sections`
- `/subjects`
- `/teachers`
- `/teaching-load`
- `/timetable`

### Work

- Refactor the shared setup frame in `AdminWorkspaceFrame` into a compact command band:
  - title and source chip on one line,
  - short description hidden or moved behind a help popover on dense screens,
  - inline stat banner kept on the same row where width allows,
  - primary actions aligned right,
  - filters behind one `Filters` popover.
- Refactor Teaching Load's custom toolbar to follow the same compact command-band budget.
- Remove duplicated workflow instruction rows from first view; move the step-by-step guide behind `How this works`.
- Keep all inputs and controls on ATLAS `@/ui/*` primitives.
- Preserve the no-global-scroll architecture.
- Add a Playwright layout budget for all scoped pages.

### Gate

- On a `1366x768` desktop viewport, first useful table/grid content starts at or above `220px` from the top of the viewport.
- On the same viewport, the main table/grid body owns at least `65%` of available height.
- No route introduces a global browser scrollbar.
- The route still exposes source state, primary action, and filters, but not as stacked vertical blocks.

## Phase 4 - Redesign Unassigned Recovery As a Guided Queue

### Goal

Turn the 365-item unassigned wall into a useful, prioritized recovery flow.

### Work

- Group unassigned items by next action, not raw reason:
  - `Ready to place`
  - `Needs room setup`
  - `Teacher overloaded`
  - `Needs regeneration`
- Add a queue header explaining:
  - how many can be placed now,
  - how many need setup,
  - how many need regeneration.
- Add bulk filters only after a `Filter` disclosure.
- Keep each card to one line collapsed:
  - section,
  - subject,
  - session count,
  - next action.
- Expanded card shows details and explanations.

### Gate

- Users can tell within 5 seconds whether there are placeable sessions.
- No card says `Place` unless it can reach placement review.
- Current run `223` does not pretend all 365 unresolved items are directly placeable.

## Phase 5 - Replace Modal Sprawl With One Review Pattern

### Goal

Make placement, swap, and draft review feel like one family.

### Work

- Create a single `ReviewActionSheet` pattern for:
  - place generated unassigned,
  - swap generated sessions,
  - place draft item,
  - swap draft sessions.
- Use the same sections:
  - what changes,
  - what blocks,
  - what warnings,
  - what happens after save,
  - primary action.
- Use plain button labels:
  - `Place session`
  - `Swap sessions`
  - `Save draft placement`
  - `Fix room first`
  - `Fix Teaching Load owner`

### Gate

- All placement/swap reviews use the same visual structure.
- No review asks the user to assign a teacher.
- All blocked states include one next action.

## Phase 6 - Performance Revalidation After Structural Simplification

### Goal

Ensure the simplified shell stays fast after real workflows are restored.

### Work

- Re-run first-load timing.
- Re-run drag FPS and long-task checks.
- Re-run grid-wide guidance checks.
- Ensure task drawers and action sheets are lazy where appropriate.
- Keep conflict calculation out of pointer-frequency handlers.

### Gate

- First useful grid action under 2.5s in isolated Tailnet runs.
- Drag remains visually smooth.
- No broad grid commit storm.
- No global scrollbars.

## Phase 7 - External Validation and Moderated Older-User Script

### Goal

Stop relying only on automated tests for usability.

### Work

- Send Antigravity a final browser Playwright prompt.
- Add a moderated older-user script:
  - place one unresolved session,
  - swap two sessions,
  - identify why a blocked item cannot be placed,
  - find advanced filters,
  - return to the grid.
- Record time-to-understand and wrong-clicks.

### Gate

- Antigravity returns `GO`.
- At least one non-technical user can complete the scripted tasks without coaching.
- Any failed task becomes a new blocker before calling the overhaul complete.

## Proposed Execution Order

1. Phase 0A first, because the app is currently resolving stale school year `39` while the previous EnrollPro-backed dataset was school year `55`.
2. Phase 0 next, because current tests produced false confidence.
3. Phase 1 next, because generated unassigned placement is currently misleading and non-placeable for the active run.
4. Phase 2 next, because swap is technically reachable but poorly labeled.
5. Phase 3 and Phase 3A together, because timetable simplification and shared setup header-density repairs should use one compact shell contract.
6. Phase 4 after source truth and shell density are under control.
7. Phase 5 after the new shell stabilizes.
8. Phase 6 performance validation.
9. Phase 7 external and human validation.

## Grouped Implementation Iterations

To keep Codex and Antigravity verification easier, the phases are grouped into four validation-sized batches:

### Iteration A - Source and Workflow Truth

Includes Phase 0A and Phase 0, plus the smallest Phase 1/2 corrections needed to stop false UI claims.

Status: `ANTIGRAVITY GO`.

Implemented on `2026-07-20`:

- The timetable header now exposes a source-truth notice when ATLAS is working from saved/stale school-year context or when the latest visible grid is backed by a completed run behind newer failed runs.
- Generated unassigned items with a faculty owner but no `homeRoomId` initially showed `Needs room` and `Fix room first` instead of the false `Place session` action. Iteration B superseded this stopgap by allowing explicit room review before save.
- Generated occupied-slot swap confirmation now uses `Swap sessions` instead of `Apply repair`.
- Added `qa-artifacts/playwright/specs/timetable-overhaul-iteration-a.spec.ts`.
- Added `docs/prompts/antigravity-timetable-overhaul-iteration-a-validation-2026-07-20.md`.

Codex verification:

- `npx tsc --noEmit` in `atlas-client`: PASS.
- `npm run build` in `atlas-client`: PASS.
- `npm run test:ux-guardrails` in `atlas-client`: PASS `26/26`.
- `npm run test:timetable-conflict` in `atlas-client`: PASS `10/10`.
- `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-a.spec.ts --workers=1`: PASS `9/9` across desktop, mobile portrait, and mobile landscape.

### Iteration B - Placement and Swap Contract Repair

Includes Phase 1 and Phase 2.

Goal:

- Derive or require a valid room source for generated placement.
- Ensure placeable generated unassigned items can reach placement review and write-blocked/reversible commit proof.
- Keep blocked generated unassigned items routed to the right setup fix.
- Keep all generated and draft swaps on the same modern visual review path.

Status: `ANTIGRAVITY GO`.

Implemented on `2026-07-20`:

- Generated unassigned cards with a Teaching Load owner but no home room now remain placeable through the grid.
- The generated placement flow opens `Review generated placement` after the operator selects or drags to a grid cell.
- The generated placement review locks the teacher to the existing Teaching Load owner and asks only for the room source needed to save the session.
- Generated unassigned drag uses viewport hit-testing under the drag overlay so dropping a card on the grid resolves the intended timetable cell instead of the overlay.
- Manual edit commits now return a confirmed success/failure signal. Placement and move flows no longer close or show success when the commit failed.
- Generated occupied-slot swap continues to use the modern visual `Review occupied-slot swap` / `Swap sessions` review path.
- Added `qa-artifacts/playwright/specs/timetable-overhaul-iteration-b.spec.ts`.
- Updated Iteration A, Phase 01, Phase 05, and UX guardrail tests to encode the new generated placement contract.

Codex verification:

- `npx tsc --noEmit` in `atlas-client`: PASS.
- `npm run build` in `atlas-client`: PASS.
- `npm run test:ux-guardrails` in `atlas-client`: PASS `26/26`.
- `npm run test:timetable-conflict` in `atlas-client`: PASS `10/10`.
- `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-a.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-b.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase01.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase05.spec.ts --workers=1`: PASS `30/30` across desktop, mobile portrait, and mobile landscape.

### Iteration C - Visual Simplification and Compact Setup Headers

Includes Phase 3, Phase 3A, and Phase 4.

Goal:

- Rebuild `/timetable` around one primary task.
- Refactor `/sections`, `/subjects`, `/teachers`, and `/teaching-load` into compact command-band headers.
- Redesign generated unassigned recovery as a grouped queue.
- Enforce the `<=220px` first-useful-content desktop gate.

Status: `ANTIGRAVITY GO`.

Implemented on `2026-07-21`:

- Shared setup pages now use a compact command-band header and compact content shell on `/sections`, `/subjects`, and `/faculty`.
- Setup-page source/status, stats, search, filters, and action controls now stay in the first command lane where viewport width allows and collapse without consuming large vertical space on mobile.
- Teaching Load now uses a compact command header, removes duplicate visual workflow prose from the first lane, and exposes the working area earlier.
- Timetable source-truth notice, task guide, and command row were compressed while preserving the primary task buttons and grid-first behavior.
- Added `qa-artifacts/playwright/specs/timetable-overhaul-iteration-c.spec.ts`.
- Added `docs/prompts/antigravity-timetable-overhaul-iteration-c-validation-2026-07-21.md`.

Codex verification:

- `npx tsc --noEmit` in `atlas-client`: PASS.
- `npm run build` in `atlas-client`: PASS.
- `npm run test:ux-guardrails` in `atlas-client`: PASS `27/27`.
- `npm run test:timetable-conflict` in `atlas-client`: PASS `10/10`.
- `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-c.spec.ts --workers=1`: PASS `15/15` across desktop, mobile portrait, and mobile landscape.
- `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-a.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-b.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-c.spec.ts --workers=1`: PASS `33/33` across desktop, mobile portrait, and mobile landscape.

### Iteration D - Unified Review, Performance, and External Closure

Includes Phase 5, Phase 6, and Phase 7.

Goal:

- Use one review/action-sheet pattern for placement and swaps.
- Revalidate first-load and drag performance after structural simplification.
- Run Antigravity and moderated older-user validation before final closure.

Status: `ANTIGRAVITY GO after external performance re-test, pending moderated older-user evidence`.

Implemented on `2026-07-21`:

- Added a shared `ReviewActionSheet` pattern for generated placement, generated swap, draft placement, and draft swap.
- Added a visible timetable selection strip with selected-session context, `Move timeslot`, and `Details`.
- Changed pointer-drag grid-wide guidance to batched DOM decoration so the grid still shows `Can place`, `Can swap`, `Blocked`, and `Warning` without triggering full React grid rerenders during drag.
- Updated the performance harness for the simplified selection strip, keyboard move path, and stable mobile touch placement.
- Added `qa-artifacts/playwright/specs/timetable-overhaul-iteration-d.spec.ts`.
- Added `docs/prompts/antigravity-timetable-overhaul-iteration-d-validation-2026-07-21.md`.
- Added `docs/qa/timetable-overhaul-moderated-older-user-script-2026-07-21.md`.

Correction after Antigravity NO-GO on `2026-07-21`:

- Antigravity correctly found that mobile-portrait scenario 14 failed the mandatory performance gate with `maxCellsPerCommitBatch=3`.
- Throttled pointer active-cell visual updates so mobile drag crossing stays within the `maxCellsPerCommitBatch <= 2` gate.
- Normalized compact panel defaults to avoid invalid layout totals and kept the compact hidden resize handle mounted.
- Preserved compact left-rail expansion for choosing actions, then collapsed the rail after selecting a draft queue item so mobile landscape tap-to-place can reach the grid and open `Review draft placement`.
- Antigravity re-tested the failing mobile-portrait performance profile after correction and reported `14/14` PASS in `55.9s`, including React commit containment and the mandatory Prompt 0/1 gate verdict.

Codex verification:

- `npx tsc --noEmit` in `atlas-client`: PASS.
- `npm run build` in `atlas-client`: PASS.
- `npm run test:ux-guardrails` in `atlas-client`: PASS `28/28`.
- `npm run test:timetable-conflict` in `atlas-client`: PASS `10/10`.
- `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-d.spec.ts --workers=1`: PASS `12/12`.
- `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-performance.spec.ts --project=desktop --workers=1`: PASS `14/14`.
- `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-performance.spec.ts --project=mobile-portrait --project=mobile-landscape --workers=1`: PASS `28/28`.
- `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-a.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-b.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-c.spec.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-d.spec.ts --workers=1`: PASS `45/45`.
- After the Antigravity NO-GO correction, `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-d.spec.ts --project=mobile-landscape -g "draft placement uses" --workers=1 --reporter=line`: PASS `1/1`.
- After the Antigravity NO-GO correction, `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-d.spec.ts --workers=1 --reporter=line`: PASS `12/12`.
- After the Antigravity NO-GO correction, `PLAYWRIGHT_ADMIN_EMAIL=1000001 PLAYWRIGHT_ADMIN_PASSWORD=AdminSY2026! npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-performance.spec.ts --workers=1 --reporter=line`: PASS `42/42`; latest `pointer_drag.json` reports `maxCellsPerCommitBatch=2`, `60.10 FPS`, no long tasks, and zero header/left/right commits.

## Current Verdict

`NO-GO` for timetable simplification closure.

Iteration A, Iteration B, Iteration C, and Iteration D performance re-test are Antigravity-verified. The overall stream remains `NO-GO` until moderated older-user evidence is captured.

This verdict also applies to the surrounding setup experience until Phase 0A and Phase 3A are completed. The current setup pages preserve no-scroll layout technically, but their local headers consume too much of the usable viewport and the runtime source state can silently resolve to a different saved school-year dataset than the user expects.
