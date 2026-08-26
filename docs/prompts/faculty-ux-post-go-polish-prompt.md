# Copilot Queue Prompt: Faculty UX Post-GO Polish (Micro-Interactions + Final Fit/Finish)

Run this prompt only after Faculty UX gate status is `GO`.

This pass is for polish and consistency only. Do not introduce structural rewrites unless a regression is found.

## Preconditions (must be true before starting)
- Latest faculty UX gate result is `GO`.
- Evidence log already contains complete mobile/desktop screenshot matrix for the gate pass.
- No unresolved critical findings from prior pass.

## Required Inputs
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- `docs/phases/faculty-ux-ui-refactor-execution-plan.md`
- `docs/verification/evidence-log.md`

## Mandatory Skills (in order)
1. `atlas-design-system-enforcer`
2. `atlas-copy-and-microcopy`
3. `atlas-faculty-usability-first`
4. `atlas-shared-browser-qa`
5. `atlas-phase-gate-enforcer`

## Scope (Polish only)
1. Micro-interactions:
   - smooth drawer/sheet open-close timing
   - button/step transition consistency
   - loading/skeleton visual continuity
2. Visual rhythm:
   - spacing, section density, card padding consistency
   - badge/chip hierarchy consistency
3. Copy refinement:
   - tighten helper/error text to plain and short language
   - ensure action-first button labels
4. Accessibility polish:
   - focus visibility
   - touch-target comfort
   - contrast checks for status and warnings

## Explicit Non-Goals
- No new feature additions.
- No backend contract changes.
- No lifecycle or auth behavior changes.
- No broad component architecture rewrites.

## Required Verification
- Recheck desktop + mobile portrait + mobile landscape.
- Capture targeted after screenshots in:
  - `qa-artifacts/screenshots/faculty-ux-polish/`
- Naming:
  - `YYYYMMDD-role-route-viewport-polish-step-result.png`

## Automated checks
- Run affected frontend build/tests.
- Run Playwright visual checks and report pass/fail deltas against baseline.

## Output Required
1. List of polish changes by file.
2. Before vs after notes for interaction and readability.
3. Accessibility checks performed and outcomes.
4. Evidence-log update confirmation.
5. Final status:
   - `GO (Polished)` or
   - `CONDITIONAL GO (Minor follow-ups only)`
