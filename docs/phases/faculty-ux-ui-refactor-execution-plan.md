# Faculty UX/UI Refactor Execution Plan (Mobile + Desktop)

## Purpose
This plan defines a practical, tool-enforced UX/UI refactor for faculty surfaces so both mobile and desktop are first-class experiences:
- `/my`
- `/my/preferences`
- `/my/room-preferences`

It operationalizes the new governance stack:
- Skills gates under `.github/skills/*`
- Context7 preflight policy (`docs/context7-library-map.md`)
- Playwright visual matrix (`qa-artifacts/playwright/*`)
- Shared-browser evidence protocol (`docs/verification/evidence-log.md`)

## Required Inputs (Before Coding)
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- `docs/phases/faculty-mobile-wireframe-spec.md`
- `docs/phases/ux-refactor-master-plan.md`
- `docs/context7-library-map.md`

## Mandatory Skill Stack (Apply in This Order)
1. `atlas-design-system-enforcer`
2. `atlas-ux-audit-gate`
3. `atlas-faculty-usability-first`
4. `atlas-copy-and-microcopy`
5. `atlas-offline-realtime-reliability`
6. `atlas-shared-browser-qa`
7. `atlas-phase-gate-enforcer`

---

## 1) Context7 Preflight (Required)

Before implementation prompts, capture:
- Resolved library IDs (from approved map).
- 2-3 references for:
  - guided multi-step flows
  - responsive dense-data behavior
  - accessibility interaction behavior
- Pattern mapping statement:
  - pattern name
  - where used in faculty pages
  - expected user impact

If preflight is missing, do not proceed to implementation.

---

## 2) Refactor Targets by Surface

## `/my` (Faculty Dashboard)
### Mobile Target
- Hero context in one compact block.
- One dominant CTA above fold (`Manage My Room Requests`).
- Compact status tiles and short schedule preview list.
- No banner stack that pushes primary action off-screen.

### Desktop Target
- Two-column workspace:
  - left: action and status context
  - right: upcoming own schedule list
- Keep only faculty-owned context by default.
- Add optional "show broader context" toggle if needed.

### Implementation Notes
- Preserve current auth/session behavior and role scoping.
- Preserve EnrollPro accent token behavior.

## `/my/preferences`
### Mobile Target
- Clear section grouping with plain labels.
- Sticky action bar (`Save Draft`, `Submit`).
- Well-being toggles visible and understandable without jargon.

### Desktop Target
- Wider form layout with grouped panels:
  - time preferences
  - well-being preferences
  - submission/status area
- Keep actions always visible near content end and in sticky footer if needed.

### Implementation Notes
- Keep lifecycle lock behavior unchanged.
- Keep offline queue feedback visible and actionable.

## `/my/room-preferences`
### Mobile Target
- Guided 3-step flow (select class -> choose target -> review/submit).
- Step chips persistently visible.
- Bottom-sheet target chooser and conflict review ergonomics.
- Single primary scroll region and no nested-scroll trap.

### Desktop Target
- Purpose-built split layout (not mobile stretched):
  - left pane: selected source class + current request summary
  - center pane: target slot/room chooser
  - right pane: conflict inspector + reason + submit
- Keep cognitive load low with request-scoped conflicts first.

### Implementation Notes
- Preserve active-draft and decision-gate behavior.
- Preserve realtime presence/status rails and offline sync states.
- Require plain-language reason and status copy.

---

## 3) Component-Level Refactor Checklist

## App Shell / Navigation
- Ensure faculty mobile top bar + hamburger drawer remains clean and non-duplicated.
- Ensure route changes close drawer and keep context title accurate.

## Shared Faculty UX Components
- `StatusRail` (connected/offline/queued/syncing/synced/failed).
- `PrimaryActionHero` (context + one dominant CTA).
- `StepFlowHeader` (step chips + helper sentence).
- `ConflictInspector` (hard vs soft with clear next action).
- `PlainLanguageNotice` (what happened / what to do / escalation).

## Page-Level Expectations
- `/my`: action-first and summary-first.
- `/my/preferences`: form clarity + sticky action behavior.
- `/my/room-preferences`: explicit wizard behavior on mobile and split workspace on desktop.

---

## 4) Verification Strategy (Tool-Enforced)

## Automated
- Keep existing route/auth/lifecycle tests green.
- Run Playwright visual matrix:
  - `guest` route for CI baseline
  - `faculty` routes for local/manual regression checks

## Visual Baseline Commands
- Install:
  - `npm run test:visual:install`
- Capture:
  - `npm run test:visual`
- Assert (after baseline committed):
  - `PLAYWRIGHT_ASSERT_SNAPSHOTS=1 npm run test:visual:assert`

## Manual QA (Shared Browser)
- Required viewports:
  - desktop
  - mobile portrait
  - mobile landscape
- Required evidence fields:
  - role, route, viewport, expected vs actual, pass/fail
- Required screenshot naming:
  - `YYYYMMDD-role-route-viewport-step-result.png`

## Reliability QA
- Validate queued -> syncing -> synced flow.
- Validate failed -> retry recovery flow.
- Validate realtime fallback messaging behavior.

---

## 5) Acceptance Gates (GO/NO-GO)

## Must Pass
- First primary action is visible within 5 seconds on mobile and desktop.
- Faculty can complete one room request without guesswork on both form factors.
- No blocking banner stack above the primary action area.
- Offline/realtime statuses are visible and understandable.
- Copy is plain-language and action-led.
- EnrollPro accent token behavior is preserved.

## Automatic NO-GO
- Any unresolved critical UX blocker.
- Missing screenshot evidence for claimed major fixes.
- Desktop or mobile layout treated as a stretched version of the other.
- Regression in auth/lifecycle/active-draft behavior.

---

## 6) Delivery Slices (Recommended)

1. Shell and shared component extraction (`StatusRail`, `PlainLanguageNotice`, `StepFlowHeader`).
2. `/my` dual-layout pass (mobile + desktop).
3. `/my/preferences` dual-layout pass.
4. `/my/room-preferences` dual-layout pass with reliability hardening.
5. Full evidence pass + phase gate decision.

Each slice must be merged only after gate evidence is updated.
