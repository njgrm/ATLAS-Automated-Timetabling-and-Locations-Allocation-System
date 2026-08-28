---
name: atlas-shared-browser-qa
description: Standard manual QA procedure for shared-browser runs with viewport matrix, evidence-log updates, and screenshot naming conventions.
user-invocable: true
---

# ATLAS Shared Browser QA Skill

Use this skill for manual QA and UX gate checks that require browser evidence.

## Required reading (before judging UX)
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- `docs/context7-library-map.md`
- Use **Context7** when validating library behavior (Radix/shadcn Sheet/Dialog, ScrollArea, motion) during QA.

## Automated faculty screenshots (repo)
- When the gate requires faculty route evidence, run `npm run test:visual:faculty` (app must be running). Outputs: `qa-artifacts/screenshots/faculty-ux-refactor/`. See `docs/prompts/faculty-ux-expert-hardening-pass.md`.

## QA Matrix
- Desktop: `1366x768` minimum.
- Mobile portrait: `390x844`.
- Mobile landscape: `844x390`.

## Required Flow
1. Validate prerequisites (dev servers, seeded account, role).
2. Run scripted scenario list per route.
3. Capture screenshots per checkpoint and failure.
4. Update `docs/verification/evidence-log.md`.

## Required Evidence Fields
- Date/time + operator.
- Role/account used.
- Route + viewport.
- Expected behavior vs actual behavior.
- Result (`Pass`/`Fail`/`Blocked`) and notes.

## Screenshot Naming Convention
- `YYYYMMDD-role-route-viewport-step-result.png`
- Example: `20260509-faculty-my-preferences-mobile-portrait-step-03-pass.png`

## Failure Handling
- Do not mark pass when blocked by auth/session/tooling issues.
- Log blockers explicitly with reproducible steps.
- Attach at least one screenshot for each failure.
