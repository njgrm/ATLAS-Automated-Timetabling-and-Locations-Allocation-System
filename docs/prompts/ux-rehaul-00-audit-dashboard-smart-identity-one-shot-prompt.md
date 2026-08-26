# UX Rehaul Prompt 00: Audit Stability + Dashboard SMART Identity One-Shot

## Mission

Stabilize the broken readiness/audit surface and turn the ATLAS admin dashboard from a KPI wall into a SMART-aligned scheduling action center.

This is the first implementation slice of the UX/UI rehaul. It must fix a real runtime blocker, refactor an oversized page, and visibly establish the new ATLAS-as-SMART-family identity.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/plans/ux-ui-rehaul-and-1000-line-refactor-plan-2026-05-29.md`
- `docs/reports/ux-ui-atlas-full-audit-2026-05-29.md`
- `docs/reports/ux-ui-atlas-vs-smart-comparison-audit-2026-05-29.md`
- `docs/prompts/ux-rehaul-smart-identity-sequence-2026-05-29.md`
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`

Inspect directly:

- `atlas-client/src/pages/Dashboard.tsx`
- `atlas-client/src/pages/Audit.tsx`
- `atlas-client/src/components/AppShell.tsx`
- `atlas-client/src/ui/*` primitives used by Dashboard and Audit
- `external-references/FINAL-CAPSTONE-SMART/src/pages/teacher/Dashboard.tsx`
- `external-references/FINAL-CAPSTONE-SMART/src/layouts/TeacherLayout.tsx`
- `external-references/FINAL-CAPSTONE-SMART/src/index.css`

## Required Skills / Rules

Apply:

- `.github/skills/atlas-21st-dev-frontend/SKILL.md`
- `.github/skills/atlas-design-system-enforcer/SKILL.md`
- `.github/skills/atlas-ux-audit-gate/SKILL.md`
- `.github/skills/atlas-copy-and-microcopy/SKILL.md`
- `.github/skills/atlas-shared-browser-qa/SKILL.md` if doing browser QA

Use Context7 for version-sensitive shadcn/Radix/motion questions. Record whether it was needed.

## SMART Identity Target For This Prompt

Make the dashboard feel like it belongs in the same product family as SMART by adopting:

- white surfaces on a light slate/soft emerald background
- school/theme accent as a strong but restrained cue
- task-first welcome/action block
- role-aware page title and subtitle
- object/action cards with meaningful icons
- warm plain language instead of implementation labels

Do not copy SMART's oversized hero excess. ATLAS admin/scheduler dashboard is an operational command center, not a teacher grading dashboard.

## Hard Scope

Touch only:

- `atlas-client/src/pages/Dashboard.tsx`
- `atlas-client/src/pages/Audit.tsx`
- new dashboard/audit local components under `atlas-client/src/components/dashboard/*` or `atlas-client/src/components/audit/*`
- shared status/empty components only if the extraction is small and clearly reusable
- changelog/evidence docs if behavior changes

Do not change backend APIs, schedule generation logic, auth logic, or route contracts unless a route is literally unreachable due to the frontend bug.

## Mandatory Outcomes

### 1. Fix `/audit` runtime crash

`Audit.tsx` must import and use the missing tooltip primitives correctly.

The page must not throw `ReferenceError: TooltipProvider is not defined`.

### 2. Remove hover-only audit actions

Audit actions must be visible, keyboard-reachable, or reachable through an accessible menu/popover.

Do not hide essential actions behind `opacity-0 group-hover:opacity-100`.

### 3. Refactor `Dashboard.tsx` below the 1000-line rule

Extract at minimum:

- `components/dashboard/NextActionPanel.tsx`
- `components/dashboard/SetupChecklist.tsx`
- `components/dashboard/DashboardInlineStats.tsx`
- `components/dashboard/LifecycleSummary.tsx`
- `components/dashboard/CampusMapPreview.tsx` if the map preview remains

The route page should become an orchestrator, not a monolith.

### 4. Replace dashboard KPI wall with `NextActionPanel`

The first viewport must answer:

- What is the next scheduling step?
- Is anything blocking publication or generation?
- What is the one primary action?

Suggested action ladder:

1. Finish setup
2. Collect teacher preferences
3. Generate schedule
4. Fix blockers
5. Publish schedule

Use the existing data available to the dashboard. Do not invent new backend data contracts.

### 5. Convert secondary metrics into SMART-like support surfaces

Replace the six equal-weight KPI wall with:

- one compact inline stat banner
- a small set of meaningful task cards only where each card represents work
- collapsible or secondary details for raw counts

Do not use huge metric cards.

### 6. Rewrite technical dashboard/audit copy

Use the UX language standard from the rehaul plan.

Examples:

- `Upstream unavailable` -> `Enrollment data cannot be reached`
- `Generation run` -> `Schedule attempt`
- `Hard violation` -> `Must fix before publishing`
- `Runtime context` -> `Current school year`

Technical identifiers may remain only behind an explicit details affordance.

### 7. Preserve ATLAS scheduling meaning

The dashboard must not become a SMART grading dashboard. Use scheduling concepts:

- setup completeness
- teacher preference collection
- teaching load readiness
- room/campus readiness
- timetable review readiness
- publish blockers

## Refactor Guardrails

- Do not move business rules into the frontend.
- Keep existing data calls unless a broken UI state requires a minimal presentation-only helper.
- Keep the page within ATLAS no-scroll layout rules.
- Use local `@/ui` primitives for all changed interactive elements.
- Keep every new component below 500 lines where practical.
- Do not introduce new global state management.

## Visual QA Requirements

Check at least:

- `/` desktop
- `/audit` desktop
- `/` narrow/mobile width if the shell supports it
- `/audit` narrow/mobile width if the shell supports it

Confirm:

- no client crash
- first action is obvious in under 5 seconds
- audit actions are reachable without hover
- text does not overlap
- primary controls have visible focus states

## Verification Gates

Required:

- `npm --prefix atlas-client run build`
- line count check for `Dashboard.tsx` and new extracted files
- route smoke check for `/` and `/audit`
- if server/runtime is available, login as direct admin and inspect the rendered routes

If Tailnet `/login` still returns `502`, say so and do not claim live visual verification.

## Required Output

Return:

1. before-state problems fixed
2. files changed
3. refactor summary with before/after line counts
4. SMART identity changes applied
5. dashboard next-action behavior
6. audit accessibility/runtime fixes
7. verification results
8. remaining risks
9. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- `/audit` no longer crashes
- `Dashboard.tsx` is under 1000 lines
- dashboard first viewport has one obvious scheduling next action
- secondary metrics no longer dominate the page
- changed interactive controls use local UI primitives
- local build passes
