# Timetable Workflow UX Recovery Plan

**Date:** 2026-07-17  
**Basis:** `docs/audits/timetable-workflow-ux-recovery-audit-2026-07-17.md`  
**Phase Verdict:** Current timetable UX is **NO-GO** for real operator use.

## Recovery Objective

Restore the timetable page as a foolproof scheduling workspace for scheduler officers, including older and non-technical users, without sacrificing the live conflict inspector or the ability to drag, click, place, and swap sessions.

## Implementation Status — 2026-07-18

**Phase 0:** Implemented and verified. Added `qa-artifacts/playwright/specs/timetable-workflow-phase01.spec.ts`, a live Tailnet workflow gate for generated-run unassigned scrolling, generated unassigned placement flow, and generated occupied-slot swap review across desktop, mobile portrait, and mobile landscape.

**Phase 1:** Implemented and verified for generated-run workflow recovery. The generated-run unassigned rail now exposes a usable scroll area, generated unassigned `Place session` opens the guided teacher/slot workflow sheet, and clicking one occupied generated session then another opens the occupied-slot swap review dialog. Compact viewports prioritize the unassigned list over secondary diagnostics.

**Verification:** `npx playwright test qa-artifacts/playwright/specs/timetable-workflow-phase01.spec.ts --workers=1` passed `6/6` against live Tailnet on desktop, mobile portrait, and mobile landscape. Supporting local gates passed: `npm run test:timetable-conflict`, `npm run test:ux-guardrails`, `npx tsc --noEmit`, and `npm run build`.

**Phase 2:** Implemented and verified for new pre-generation draft placement recovery. The `Plan before generating` path opens the workspace immediately, hydrates the draft board in the background, and keeps queue placement behind a visible confirmation flow.

**Phase 3:** Implemented and verified for information architecture simplification. The timetable now exposes task-first mode controls for review, unassigned placement, session switching, draft planning, and room-request review without hiding primary jobs under `More`.

**Phase 4:** Implemented and verified for first-load/data-load performance. Advanced surfaces are lazy-loaded, primary run data is applied before secondary diagnostics, run history is metadata-only, and runtime context defaults to persisted ATLAS evidence unless explicit upstream verification is requested.

**Phase 5:** Implemented and verified for older-user accessibility/foolproofing. The task guide now keeps persistent instructions for placement, switching, draft planning, and conflict meaning; primary task-mode controls meet the 44px target gate; draft placement shows conflict guidance before preview; saves/swaps use on-page status messaging; and a moderated older-user usability script is ready.

**Phase 6:** Implemented and verified for regression/release-gate closure. The final release gate checks live navigation/app-critical errors, page overflow, click-placement feedback, drag plain-language feedback, and write safety. The combined Phase 1-6 Tailnet matrix passed across all required profiles.

**Remaining recovery scope:** Moderated older-user participant evidence still requires a scheduled human session before broad rollout.

## Non-Negotiable Product Rules

- The live conflict inspector must remain visible and responsive during drag, click, and keyboard placement.
- Operators must be able to place generated-run unassigned sessions.
- Operators must be able to place new-draft unassigned sessions.
- Operators must be able to swap occupied generated sessions.
- Every scrollable panel must expose a usable viewport.
- First-use readiness must be measured separately from drag FPS.
- A task cannot be hidden under a technical implementation term.

## Phase 0 — Truthful Reproduction and Guardrails

**Goal:** Build a workflow-first QA gate that fails on the current user complaints.

### Scope

- Add/repair Playwright coverage for:
  - generated-run unassigned tab scroll viewport
  - generated-run unassigned click placement
  - generated-run unassigned drag/tap placement
  - generated-run occupied-slot swap
  - new pre-generation draft entry
  - new-draft queue placement
  - live conflict feedback during hover/drag/click
  - table visible / actionable readiness time
- Add no-write route blocking for destructive live audit flows where needed.
- Require evidence screenshots or JSON reports for desktop, mobile portrait, and mobile landscape.

### Acceptance Gate

- The suite must fail against the current behavior before fixes.
- The report must include clear pass/fail checks, not only timing samples.
- No phase may proceed on "drag smoothness" alone.

## Phase 1 — Restore Core Generated-Run Interactions

**Goal:** Make generated timetables usable again before deeper UI redesign.

### Scope

1. Fix generated-run unassigned tab layout:
   - make the unassigned list the primary scroll region.
   - collapse resource diagnostics by default.
   - keep summary/filter controls in a compact sticky header.
   - guarantee the virtual list viewport is at least `280px` on desktop and usable on mobile.

2. Make generated-run placement explicit:
   - clicking `Place session` opens a guided placement flow.
   - the flow must show three required steps: teacher, room, slot.
   - if Teaching Load repair is required, label it as "Step 1: choose teacher" instead of moving the user into a hidden dock.
   - suggested slots must appear in the same visible flow.

3. Make generated-run swap explicit:
   - selecting an occupied session must expose a `Switch with another session` action.
   - clicking/tapping an occupied target must open `Review occupied-slot swap`.
   - drag-to-occupied must continue to open the same review dialog.
   - blocked swaps must show a plain-language reason.

### Acceptance Gate

- Desktop, mobile portrait, and mobile landscape can:
  - scroll generated unassigned list.
  - open placement flow from `Place session`.
  - preview a generated unassigned placement without writing.
  - open swap dialog from both click/tap and drag paths.
- Existing drag containment metrics must remain within the previous budgets.

## Phase 2 — Restore New-Draft Placement

**Goal:** Make pre-generation/new-draft placement understandable and recoverable.

### Scope

1. Promote `New Pre-Generation Draft` out of the `More` menu into the main toolbar as `Plan before generating`.
2. Add a visible loading/transition state when opening the draft workspace.
3. Replace auto-commit-on-preview with a guided placement confirmation for all queue placements:
   - choose teacher
   - choose room
   - choose slot
   - check conflicts
   - save placement
4. Keep quick auto-selection as a default suggestion, not an invisible commit.
5. Ensure blocked placements leave a persistent recovery panel, not only a toast.

### Acceptance Gate

- Operator can open a new draft in under 3 seconds after clicking the primary action.
- Operator can select an unassigned draft queue item and place it through a visible confirmation flow.
- If placement is blocked, the UI names the blocker and offers the next valid action.

## Phase 3 — Simplify the Workspace Information Architecture

**Goal:** Reduce the overwhelming UI without removing required functionality.

### Scope

1. Split the page into task modes:
   - `Review generated schedule`
   - `Place unassigned sessions`
   - `Switch sessions`
   - `Plan before generating`
   - `Review room requests`
2. Keep advanced diagnostics behind collapsible sections.
3. Replace technical button labels with task language.
4. Keep one primary action visible per selected object.
5. Add a task checklist banner that answers "what do I do next?"

### Acceptance Gate

- A first-time operator can identify the next action from the visible UI without opening `More`.
- The left rail no longer combines diagnostics, filters, and large lists in a way that starves list height.
- Icon-only or technical controls have plain-language tooltips.

## Phase 4 — First-Load and Data-Load Performance

**Goal:** Reduce the time from navigation to useful action.

### Scope

1. Measure and optimize:
   - route JS loaded on first visit
   - initial timetable data waterfall
   - latest-run resolver latency
   - first visible table
   - first actionable grid/list
2. Lazy-load advanced surfaces:
   - map view
   - policy pane
   - request review
   - Tactical Sandbox advanced diagnostics
3. Defer non-primary diagnostics until after the grid/list are interactive.
4. Add skeleton states for grid and rails that explain loading progress.

### Acceptance Gate

- Table visible target: under 5 seconds on Tailnet.
- Primary action target: under 6 seconds on Tailnet.
- No resource diagnostics or secondary panels block initial grid/list interaction.
- No new global scrollbars.

### Implementation Status — 2026-07-18

- Added `qa-artifacts/playwright/specs/timetable-workflow-phase04.spec.ts`.
- Lazy-loaded policy, manual edit, map, and building surfaces from the timetable center workspace.
- Applied draft/violation data before background follow-up diagnostics.
- Started reference data and secondary summaries without blocking first grid readiness.
- Trimmed `/api/v1/generation/:schoolId/:schoolYearId/runs` to metadata-only run history.
- Changed `/api/v1/runtime/context` to use persisted ATLAS evidence by default and reserve upstream verification for `verifyUpstream=true`.

### Verification — 2026-07-18

- `npx playwright test qa-artifacts/playwright/specs/timetable-workflow-phase04.spec.ts --workers=1`: PASS `6/6` across desktop, mobile portrait, and mobile landscape.
- Existing desktop performance harness improved to `cold=1322ms`, `warm=1088ms` from Phase 4 baseline `cold=9239ms`, `warm=9049ms`.
- Run-history endpoint returned `5,992` bytes in `43.6ms` and omitted `summary`, `draftEntries`, `violations`, and `unassignedItems`.
- Runtime context default path returned in `185.9ms`; explicit `verifyUpstream=true` preserves the previous upstream verification behavior.
- `atlas-client` `npx tsc --noEmit`: PASS.
- `atlas-client` `npm run build`: PASS.
- `atlas-server` `npm run build`: PASS.
- Built server startup plus `/api/v1/health` on port `5020`: PASS.

## Phase 5 — Older-User Accessibility and Foolproofing

**Goal:** Make the page usable without technical scheduling knowledge.

### Scope

1. Add larger touch/click targets for primary task actions.
2. Add persistent help copy for:
   - placing an unassigned session
   - switching two sessions
   - resolving blocked placements
3. Ensure keyboard placement remains intact.
4. Ensure mobile/touch placement does not require precision dragging.
5. Add plain-language conflict labels and next-step guidance.

### Acceptance Gate

- Keyboard-only flow can select source, select target, preview, and cancel/save.
- Mobile/touch flow can place/swap without drag precision.
- Accessibility audit finds no unlabeled primary controls in the timetable workflow.
- Moderated older-user test script is ready with pass/fail tasks.

### Implementation Evidence — 2026-07-18

- Added `qa-artifacts/playwright/specs/timetable-workflow-phase05.spec.ts`.
- Added `docs/qa/timetable-phase5-older-user-usability-script-2026-07-18.md`.
- Updated the timetable task guide to keep visible plain-language instructions for place, switch, draft, and conflict meaning.
- Increased primary task-mode controls to 44px targets.
- Added an inline Undo recovery affordance when manual edit history exists.
- Added `role="status"` / `aria-live="polite"` on timetable action status and kept successful status visible for 6 seconds.
- Added pre-preview conflict guidance in `Review draft placement`.
- Short-height viewports render the help strip as an overlay so guidance remains visible without starving the unassigned panel.

### Verification — 2026-07-18

- `npm run test:ux-guardrails` in `atlas-client`: PASS `20/20`.
- `npx tsc --noEmit` in `atlas-client`: PASS.
- `npm run build` in `atlas-client`: PASS.
- `npx playwright test qa-artifacts/playwright/specs/timetable-workflow-phase05.spec.ts --workers=1`: PASS `6/6`.
- `npx playwright test qa-artifacts/playwright/specs/timetable-workflow-phase01.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase02.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase03.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase04.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase05.spec.ts --workers=1`: PASS `27/27`.

### Verdict

Phase 5 is technical GO. Moderated participant evidence remains a human scheduling activity, not a code blocker.

## Phase 6 — Regression and Release Gate

**Goal:** Prevent future "smooth but unusable" regressions.

### Scope

- Make workflow gates required before claiming timetable UX closure:
  - generated placement
  - draft placement
  - occupied swap
  - scrollable panels
  - live conflict feedback
  - first-load readiness
  - mobile/touch equivalents
- Update `phasePlan.md` and evidence logs only when live Tailnet evidence exists.
- Keep previous drag-render metrics as supporting evidence, not primary closure evidence.

### Acceptance Gate

- Full workflow suite passes on desktop, mobile portrait, and mobile landscape.
- Live Tailnet smoke confirms no app errors on navigation.
- Type-check and production build pass.
- Manual QA notes confirm the UI still exposes conflict inspector feedback while dragging/clicking.

### Implementation Evidence — 2026-07-18

- Added `qa-artifacts/playwright/specs/timetable-workflow-phase06.spec.ts`.
- Added `docs/qa/timetable-phase6-release-gate-report-2026-07-18.md`.
- Added plain-language drag overlay copy: `Release on a highlighted cell to review move or swap.`
- Added a static UX guardrail preventing removal of the Phase 6 drag overlay cue.

### Verification — 2026-07-18

- `npm run test:ux-guardrails` in `atlas-client`: PASS `21/21`.
- `npm run test:timetable-conflict` in `atlas-client`: PASS `10/10`.
- `npx tsc --noEmit` in `atlas-client`: PASS.
- `npm run build` in `atlas-client`: PASS.
- `npx playwright test qa-artifacts/playwright/specs/timetable-workflow-phase06.spec.ts --workers=1`: PASS `6/6`.
- `npx playwright test qa-artifacts/playwright/specs/timetable-workflow-phase01.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase02.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase03.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase04.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase05.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase06.spec.ts --workers=1`: PASS `33/33`.

### Verdict

Phase 6 is GO. Timetable workflow recovery Phase 0 through Phase 6 is technically closed.

## Recommended Execution Order

1. Phase 0 — write failing gates.
2. Phase 1 — fix generated-run scroll, placement, and swap.
3. Phase 2 — fix new-draft entry and placement.
4. Phase 3 — simplify mode structure and copy.
5. Phase 4 — attack first-load readiness.
6. Phase 5 — accessibility/older-user hardening.
7. Phase 6 — release gate and evidence closure.

## Current Stop Condition

Phase 1 and Phase 2 are now cleared as of 2026-07-18. The minimum operator workflow is restored and live-gated: browse generated unassigned sessions, open generated placement repair, switch occupied generated sessions, open a new pre-generation draft, select a draft queue item, and reach a visible placement confirmation before save.

Phase 6 is now technically cleared as of 2026-07-18. Timetable workflow recovery Phase 0 through Phase 6 is technically closed; remaining older-user participant evidence is a human rollout-readiness activity.

## Implementation Status Update — 2026-07-18

### Phase 0 + 1 — GO

- Live Tailnet workflow gate: `npx playwright test qa-artifacts/playwright/specs/timetable-workflow-phase01.spec.ts --workers=1` passed `6/6`.
- Profiles covered: desktop, mobile portrait, mobile landscape.
- Restored generated unassigned rail scrollability, generated unassigned placement entry, and generated occupied-slot swap review.

### Phase 2 — GO

- Live Tailnet workflow gate: `npx playwright test qa-artifacts/playwright/specs/timetable-workflow-phase02.spec.ts --workers=1` passed `6/6`.
- Profiles covered: desktop, mobile portrait, mobile landscape.
- The primary `Plan before generating` action opens the draft workspace immediately and hydrates the queue in the background.
- Draft-board navigation reads use the cached EnrollPro section snapshot path; placement preview/commit still use full validation.
- Mobile/touch draft queue cards are rendered as normal project buttons, not disabled drag wrappers.

### Phase 3 — GO

- Live Tailnet workflow gate: `npx playwright test qa-artifacts/playwright/specs/timetable-workflow-phase03.spec.ts --workers=1` passed `3/3`.
- Combined regression gate: `npx playwright test qa-artifacts/playwright/specs/timetable-workflow-phase01.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase02.spec.ts qa-artifacts/playwright/specs/timetable-workflow-phase03.spec.ts --workers=1` passed `15/15`.
- Profiles covered: desktop, mobile portrait, mobile landscape.
- Added a compact `What to do next` task guide for review, unassigned placement, session switching, draft planning, and room-request review.
- Task-mode controls expand the left rail before switching tabs so collapsed panel state does not hide the requested workflow.
- Mobile and short-height landscape layouts now keep the filter toolbar and task modes in local horizontal scrollers and compact redundant rail/header copy to preserve list/grid height.

### Supporting Verification

- `npm run test:timetable-conflict` passed `10/10`.
- `npm run test:ux-guardrails` passed `19/19`.
- `npx tsc --noEmit` passed for `atlas-client`.
- `npm run build` passed for `atlas-client`.
- `npm run build` passed for `atlas-server`.
- Live `/api/v1/health` returned OK.
- Live draft-board route returned in `987ms` with `queue=1313`.
