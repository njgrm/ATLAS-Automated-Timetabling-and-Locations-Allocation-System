# Copilot Execution Prompt: Faculty UX/UI Refactor (Mobile + Desktop)

> **If prior work was minimal or regressive**, run **`docs/prompts/faculty-ux-expert-hardening-pass.md`** instead of (or immediately after) this prompt. That document mandates **Context7 expert bar**, **full Playwright faculty screenshots** (`npm run test:visual:faculty`), **map/building** polish, and **live conflict inspector** on **mobile and desktop**.

## Goal and Scope
Implement a faculty-side UX/UI refactor for:
- `/my`
- `/my/preferences`
- `/my/room-preferences`

Primary objective:
- Deliver first-class mobile and desktop experiences with low cognitive load, plain-language guidance, and reliable offline/realtime status visibility.

Out of scope:
- Scheduler/Admin/Public surface refactors.
- Backend contract redesign unrelated to existing faculty flows.
- New lifecycle policy changes.

## Critical Clarification (Read First)
This is a **layout and interaction refactor**, not a shared-component-only pass.

The following alone are insufficient and must be treated as incomplete:
- only introducing shared components (`StatusRail`, `StepFlowHeader`, etc.)
- only replacing copy/banners
- only wiring status indicators without changing page structure

Completion requires visible structural changes for both mobile and desktop across all 3 faculty pages.

## Required References
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- `docs/phases/faculty-mobile-wireframe-spec.md`
- `docs/phases/ux-refactor-master-plan.md`
- `docs/phases/faculty-ux-ui-refactor-execution-plan.md`
- `docs/context7-library-map.md`
- `.github/skills/atlas-design-system-enforcer/SKILL.md`
- `.github/skills/atlas-ux-audit-gate/SKILL.md`
- `.github/skills/atlas-faculty-usability-first/SKILL.md`
- `.github/skills/atlas-copy-and-microcopy/SKILL.md`
- `.github/skills/atlas-offline-realtime-reliability/SKILL.md`
- `.github/skills/atlas-shared-browser-qa/SKILL.md`
- `.github/skills/atlas-phase-gate-enforcer/SKILL.md`

## Context7 Preflight Summary (Complete Before Coding)
1. Resolve library IDs from approved map for:
   - Atlassian Design System (guided multi-step/tour patterns)
   - Shopify Polaris (action hierarchy, empty/error states)
   - Carbon Design System (responsive dense layouts)
   - WAI-ARIA Authoring Practices (interaction/accessibility behavior)
2. Pull 2-3 references relevant to this pass.
3. Add a short "Applied Pattern Mapping" note in your implementation summary:
   - pattern name
   - ATLAS surface where applied
   - intended usability outcome

If Context7 preflight is missing, stop and complete it before implementation.

## Mandatory Skill Application Order
1. `atlas-design-system-enforcer`
2. `atlas-ux-audit-gate`
3. `atlas-faculty-usability-first`
4. `atlas-copy-and-microcopy`
5. `atlas-offline-realtime-reliability`
6. `atlas-shared-browser-qa`
7. `atlas-phase-gate-enforcer`

## Implementation Requirements

### Global Faculty UX Rules
- One obvious next action per screen.
- Plain-language microcopy only (no backend jargon).
- Mobile and desktop must be intentionally different layouts, not stretched variants.
- Preserve EnrollPro accent source behavior and no default-color flash regression.
- Preserve auth/lifecycle/active-draft/decision-gate behavior.

### `/my` Requirements
- Mobile:
  - compact greeting/context
  - dominant CTA above fold
  - compact summary tiles and short own-schedule preview
  - no blocking banner stack above main action
- Desktop:
  - split workspace for action context + own schedule
  - keep faculty-focused context by default
- Required structural evidence:
  - clearly different mobile and desktop layout trees in code
  - desktop must not be a stacked mobile card column

### `/my/preferences` Requirements
- Mobile:
  - clear grouped sections
  - sticky action bar (`Save Draft`, `Submit`)
  - plain labels for well-being toggles
- Desktop:
  - grouped panels with improved readability and spacing
  - actions remain visible and obvious
- Keep lifecycle locks and submission semantics unchanged.
- Required structural evidence:
  - sticky action behavior verified in both mobile and desktop
  - visible panel grouping changes on desktop, not only typography/copy edits

### `/my/room-preferences` Requirements
- Mobile:
  - guided 3-step flow with persistent step chips
  - step sequence: select class -> choose target -> review/submit
  - no forced desktop grid behavior on phone sizes
  - avoid nested-scroll traps
- Desktop:
  - dedicated split workspace:
    - source selection
    - target chooser
    - conflict inspector + reason + submit
  - conflicts shown request-scoped first
- Keep realtime presence/sync status visible and low-noise.
- Keep offline queue lifecycle visible and actionable.
- Required structural evidence:
  - mobile wizard remains 3-step and touch-optimized
  - desktop has true multi-pane workspace and does not mirror mobile stacking
  - no blocking banner stack above core action area

## Execution Slices (Do in Order)
1. Shared components:
   - `StatusRail`
   - `StepFlowHeader`
   - `PlainLanguageNotice`
   - `ConflictInspector`
2. `/my` mobile + desktop pass.
3. `/my/preferences` mobile + desktop pass.
4. `/my/room-preferences` mobile + desktop pass.
5. Reliability/copy hardening pass.
6. Verification + evidence update pass.

Do not stop after Slice 1. Shared component extraction without page-level layout completion is an automatic incomplete pass.

## Required Files To Change (Minimum)
- `atlas-client/src/pages/MyDashboard.tsx`
- `atlas-client/src/pages/FacultyPreferences.tsx`
- `atlas-client/src/pages/FacultyRoomPreferences.tsx`

And at least one new/updated desktop-specific and one mobile-specific layout component under:
- `atlas-client/src/components/faculty-*` or `atlas-client/src/components/faculty-room-preferences/*`

## Verification Gates

### Automated
- Run affected builds/tests and keep them green.
- Run Playwright visual matrix:
  - local role matrix where possible
  - CI-safe guest baseline still must pass
- **Faculty hardening gate:** run `npm run test:visual:faculty` (requires dev server + faculty login env if non-default). Artifacts must land in `qa-artifacts/screenshots/faculty-ux-refactor/`.

### Manual QA (Required)
- Viewports:
  - desktop
  - mobile portrait
  - mobile landscape
- Required screenshots:
  - mobile drawer open
  - each room-request step
  - offline queued state
  - reconnect synced state
  - desktop non-regression
  - desktop room-preferences split workspace full view
  - mobile room-preferences step flow with bottom action visible
- Naming:
  - `YYYYMMDD-role-route-viewport-step-result.png`
- Store in:
  - `qa-artifacts/screenshots/faculty-ux-refactor/`

### Evidence Update
- Update `docs/verification/evidence-log.md` with:
  - what changed (blocker -> fix mapping)
  - pass/fail results
  - unresolved risks
  - final gate decision

Also include:
- Before vs after screenshot pairs for each major layout change.
- Explicit statement of which previous UX blockers are now resolved.

## GO/NO-GO Rubric
- `NO-GO` if any critical UX blocker remains unresolved.
- `NO-GO` if major fixes are claimed without screenshot evidence.
- `NO-GO` if mobile/desktop are still stretched variants of each other.
- `NO-GO` if auth/lifecycle/active-draft behavior regresses.
- `NO-GO` if changes are mostly shared-component/copy substitutions without page structural change.
- `NO-GO` if manual screenshot matrix is missing.
- `GO` only when:
  - first action is obvious within 5 seconds on both form factors
  - one complete room request can be done without guesswork
  - offline/realtime statuses are clear
  - copy is plain-language and actionable
  - desktop and mobile information architecture are visibly distinct on all 3 pages

## Output Format Required from Copilot
1. Context7 preflight result (IDs + references + applied patterns).
2. File-by-file change summary.
3. Verification results (automated + manual).
4. Evidence-log update confirmation.
5. Final GO/NO-GO decision with blockers (if any).
