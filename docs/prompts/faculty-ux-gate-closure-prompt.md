# Copilot Queue Prompt: Faculty UX Gate-Closure (Verification + Targeted Patching)

Run a strict Faculty UX/UI Gate-Closure pass for `/my`, `/my/preferences`, and `/my/room-preferences`.

**Expert bar:** apply **`docs/prompts/faculty-ux-expert-hardening-pass.md`** when judging “good enough.” Cosmetic or component-only fixes are **not** sufficient if UX still feels subpar.

You must treat this as verification + targeted patching, not a summary.

## Required Inputs
- `docs/prompts/faculty-ux-expert-hardening-pass.md`
- `docs/prompts/faculty-ux-ui-refactor-execution-prompt.md`
- `docs/phases/faculty-ux-ui-refactor-execution-plan.md`
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- `docs/phases/faculty-mobile-wireframe-spec.md`
- `docs/verification/evidence-log.md`

## Mandatory Skills (in order)
1. `atlas-design-system-enforcer`
2. `atlas-ux-audit-gate`
3. `atlas-faculty-usability-first`
4. `atlas-copy-and-microcopy`
5. `atlas-offline-realtime-reliability`
6. `atlas-shared-browser-qa`
7. `atlas-phase-gate-enforcer`

## What to do
1. Audit all 3 faculty pages on:
   - desktop
   - mobile portrait
   - mobile landscape
2. Validate that mobile and desktop are structurally different and both first-class.
3. Validate one-obvious-next-action rule per page.
4. Validate room-request flow is understandable end-to-end without guessing.
5. Validate offline/realtime status clarity (`queued`, `syncing`, `synced`, `failed`) + retry.
6. Patch any remaining blockers immediately.
7. Re-run validation after patches.

## Required Screenshot Evidence
Save to `qa-artifacts/screenshots/faculty-ux-refactor/` with naming:
`YYYYMMDD-role-route-viewport-step-result.png`

Capture at minimum:
- mobile drawer open
- `/my` primary CTA above fold (mobile + desktop)
- `/my/preferences` sticky actions visible
- `/my/room-preferences` step 1, step 2, step 3
- desktop room-preferences split workspace full view
- offline queued state
- reconnect synced state
- failed state + retry outcome

## Automated checks
- Run affected frontend build/tests.
- **Required:** `npm run test:visual:faculty` (repo faculty screenshot matrix to `qa-artifacts/screenshots/faculty-ux-refactor/`). Report pass/fail and artifact paths.
- Optionally run full `npm run test:visual` for role matrix.
- Report exact commands and pass/fail.

## Manual shared-browser QA (design + Context7)

Before manual QA, read **`docs/DESIGN.md`**, **`docs/DESIGN-INSPIRATION.md`**, and **`docs/context7-library-map.md`**. Use Context7 when validating Radix/shadcn Sheet/Dialog behavior, scroll containment, or a11y patterns against current docs.

## Gate Decision (strict)
Return:
- Critical/Major/Minor findings (with file references)
- What was patched
- What remains
- `GO` / `CONDITIONAL GO` / `NO-GO`

Rules:
- `NO-GO` if any critical issue remains.
- `NO-GO` if screenshot matrix is incomplete.
- `NO-GO` if `npm run test:visual:faculty` was not run or faculty-ux-refactor screenshots are missing.
- `NO-GO` if changes are mostly cosmetic/shared-component-only.
- `GO` only if all 3 pages pass mobile + desktop usability criteria and expert hardening bar (`faculty-ux-expert-hardening-pass.md`) is met for room-request map/building and live conflict visibility.
