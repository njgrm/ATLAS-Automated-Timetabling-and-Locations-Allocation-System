# UX Rehaul Prompt 04: Dashboard + Campus Map SMART Identity Recovery One-Shot

## Mission

Implement the follow-up fixes from the dashboard and campus map SMART identity audit. This prompt must make the dashboard and campus map feel like they belong to the same product family as SMART while preserving ATLAS scheduling workflows, PWA/no-scroll constraints, and strict component discipline.

This is not a cosmetic pass. The audit found that ATLAS still reads as a rough admin-console experience because of shell IA, dashboard language/CTA treatment, and an editor-heavy campus map. Fix those root causes in one coherent pass while preserving EnrollPro/HNHS school branding token authority.

2026-05-30 correction: the dashboard should still contain a campus/map interface. Do not remove it outright. Replace the crowded editor-like map experience with a clean, simplified campus readiness preview and a clear path into the full map/editor.

Important correction: do not interpret SMART alignment as hard-coded emerald. SMART's reusable identity pattern is token-driven. ATLAS must use configured school tokens through `--primary`, `--accent`, `--sidebar-primary`, or SMART-compatible aliases derived from those values. On Tailnet HNHS, primary actions should render maroon, not green.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/prompts/ux-rehaul-smart-identity-sequence-2026-05-29.md`
- `docs/reports/dashboard-campus-map-smart-identity-audit-2026-05-29.md`
- `docs/reports/dashboard-login-sidebar-token-tailnet-audit-2026-05-30.md`
- `docs/plans/ux-ui-rehaul-and-1000-line-refactor-plan-2026-05-29.md`
- `docs/reports/ux-ui-atlas-vs-smart-comparison-audit-2026-05-29.md`
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`

Inspect directly:

- `atlas-client/src/index.css`
- `atlas-client/src/components/AppShell.tsx`
- `atlas-client/src/pages/Dashboard.tsx`
- `atlas-client/src/components/dashboard/*`
- `atlas-client/src/pages/MapEditor.tsx`
- `atlas-client/src/components/CampusMapEditor.tsx`
- `atlas-client/src/components/BuildingPanel.tsx`
- `atlas-client/src/components/BuildingView.tsx`
- `atlas-client/src/ui/*` primitives used by shell/dashboard/map
- `external-references/FINAL-CAPSTONE-SMART/src/layouts/TeacherLayout.tsx`
- `external-references/FINAL-CAPSTONE-SMART/src/layouts/RegistrarLayout.tsx`
- `external-references/FINAL-CAPSTONE-SMART/src/pages/teacher/Dashboard.tsx`
- `external-references/FINAL-CAPSTONE-SMART/src/index.css`
- `external-references/FINAL-CAPSTONE-SMART/src/contexts/ThemeContext.tsx`

Evidence to compare against:

- `qa-artifacts/playwright/20260529-admin-dashboard-desktop-smart-audit.png`
- `qa-artifacts/playwright/20260529-admin-campus-map-desktop-smart-audit.png`

## Required Skills / Rules

Apply:

- `.github/skills/atlas-21st-dev-frontend/SKILL.md`
- `.github/skills/atlas-design-system-enforcer/SKILL.md`
- `.github/skills/atlas-ux-audit-gate/SKILL.md`
- `.github/skills/atlas-copy-and-microcopy/SKILL.md`
- `.github/skills/atlas-mobile-faculty-ux/SKILL.md` because shell changes affect faculty portal navigation
- `.github/skills/atlas-shared-browser-qa/SKILL.md` for visual evidence

Use Context7 for Radix/shadcn and motion behavior if introducing or changing Sheet, Tooltip, Dialog, Tabs, segmented controls, or route transitions.

## Design Mapping

- `SMART identity`: light slate page background, white surfaces, token-driven primary active states, role-specific portal titles, rounded nav pills, school logo/name signal, task-first cards.
- `ATLAS scheduling identity`: schedule readiness, sections, teachers, rooms, timetable generation, review, and publish readiness remain the user jobs.
- `Project UI constraints`: no native select, no raw changed buttons, no `title`-only affordances, no global browser scroll, no file above 1000 lines after this prompt touches it.
- `Campus map direction`: overview/read-first by default, editor mode only after an explicit action.

## Hard Scope

Allowed source files:

- `atlas-client/src/index.css`
- `atlas-client/src/components/AppShell.tsx`
- new files under `atlas-client/src/components/app-shell/*`
- `atlas-client/src/pages/Dashboard.tsx`
- new or changed files under `atlas-client/src/components/dashboard/*`
- `atlas-client/src/pages/MapEditor.tsx`
- `atlas-client/src/components/CampusMapEditor.tsx`
- `atlas-client/src/components/BuildingPanel.tsx`
- `atlas-client/src/components/BuildingView.tsx`
- new files under `atlas-client/src/components/campus-map/*`
- small shared helper files only if they remove real duplication
- `docs/reference/atlas-runtime-source-of-truth-map.md` only if route/source ownership changes
- `docs/verification/evidence-log.md` only if live evidence is captured
- `CHANGELOG.md`

Do not change backend APIs, Prisma schema, scheduling algorithms, auth semantics, or data ownership contracts unless a compile/runtime issue requires a minimal frontend-compatible fix.

## Mandatory Outcomes

### 1. Reset the visible identity from blue/admin console to token-driven SMART-family portal

Required:

- Change ATLAS's default rehaul accent away from blue/admin-console cues and toward the configured theme primary.
- Preserve school branding overrides where they already exist. Do not override HNHS maroon on Tailnet with SMART emerald.
- Update active nav, primary buttons, focus rings, and scrollbars that currently inherit the blue default.
- Remove outdated comments that describe the main layer as permanently EnrollPro-matched if they now conflict with the SMART identity direction.
- Do not use hard-coded `bg-emerald-*`, `text-emerald-*`, `from-emerald-*`, `shadow-emerald-*`, or fixed green classes for brand/primary identity.
- Use `bg-primary`, `text-primary`, `border-primary`, `ring-primary`, `hsl(var(--primary))`, or SMART-compatible aliases derived from EnrollPro settings.

Target feel:

- SMART's token-driven active state and light slate/white shell rhythm.
- ATLAS as `Scheduling Portal`, not `Back-office Admin Console`.

### 2. Finish shell extraction and demote EnrollPro platform affordance

`AppShell.tsx` must end below 1000 lines.

Extract or verify extraction of:

- `components/app-shell/AppSidebar.tsx`
- `components/app-shell/MobileTopBar.tsx`
- `components/app-shell/MobileNavigationDrawer.tsx`
- `components/app-shell/UserMenu.tsx`
- `components/app-shell/navigation.ts`
- `components/app-shell/AppRouteTransition.tsx` if route transition code remains in the shell

Demote `Back to EnrollPro`:

- It must not remain a prominent persistent sidebar group on the default SMART-aligned ATLAS shell.
- Move it into a user/system menu or a low-emphasis switcher if the integration still needs to be reachable.
- Do not remove the integration capability if existing flows rely on it.

### 3. Rewrite dashboard first viewport into a SMART-like scheduling portal

Required first-viewport structure:

1. Portal label: `Scheduling Portal`
2. Page title: `Build and publish the school timetable`
3. Primary task card: `Next: Check sections before generation` or equivalent based on current data
4. Readiness object row:
   - `Subjects ready`
   - `Teachers ready`
   - `Sections need attention` or `Sections ready`
   - `Rooms ready` or `Rooms need attention`

Do not use `Scheduling command center` as the visible eyebrow.

### 4. Convert the dashboard CTA from amber-dominant to token-primary with warning status

Required:

- The primary CTA must use theme primary from ATLAS/EnrollPro tokens.
- Warning/blocker state should appear as a badge, inline status row, or small supporting indicator.
- Avoid a large tinted amber panel as the dominant dashboard identity.

Keep one obvious next action.

### 5. Replace dashboard campus map mini-app with a SMART-like campus readiness card

Replace the embedded map editor/browser experience in the dashboard default view with a simplified campus map/readiness interface.

The dashboard campus section should show only:

- `Campus and rooms`
- summary count such as `12 buildings - 157 teaching rooms ready`
- readiness chips, maximum three
- one primary action: `Review campus map`
- one optional secondary action: `Edit rooms` or `Open map editor`
- a static thumbnail, simplified visual preview, or selected-building mini map that is presentable and non-editable

Do not show in the dashboard default view:

- zoom buttons
- full floor-plan grids
- 24 room buttons
- room utilization placeholders
- room schedule overlay triggers
- building chips for every building

After this change, `Dashboard.tsx` should stay simple. If map-specific helper logic remains in `Dashboard.tsx`, extract it into `components/dashboard/CampusReadinessCard.tsx` and keep the editor logic in `/map`.

### 6. Redesign `/map` into two modes: overview first, editor second

Default mode must be `Campus Overview`.

Default `/map` first viewport:

- Header: `Campus and Rooms`
- Supporting copy: `Review buildings, teaching rooms, and home-room readiness.`
- Primary action: `Edit campus map`
- Secondary action: `Review rooms` if useful
- Left/main area: simplified campus map canvas or static map preview
- Right/side area: selected building card with room summary and readiness, not raw coordinate fields

Editor mode:

- Accessible segmented mode control: `Select`, `Draw`, `Rooms`, `Photo`
- Toolbar grouped by task, not one long flat row
- Save state visible: `All changes saved`, `Unsaved changes`, `Saving...`
- Advanced placement fields collapsed by default
- Delete actions remain visible but low in the hierarchy and confirmed

Persist mode in local component state or URL query only if it helps direct linking. Do not add backend state.

### 7. Make campus map palette calm and semantic

Required:

- Replace the default rainbow building palette as the first visual impression.
- Use muted campus colors by default.
- Reserve strict DepEd grade colors only where the UI is explicitly encoding grade-level meaning.
- Use token primary for selected/active states, not as a random building color.
- Color controls should show named swatches, not force users to reason from raw hex-like color choices.

### 8. Remove technical map language from the primary path

Required copy changes:

- `Short Code` -> `Room label prefix` or move under advanced details.
- `stable seeded-map matching` -> remove from primary path or move to advanced help.
- `X`, `Y`, `Width`, `Height` -> `Advanced placement` collapsed section.
- `Cap:` -> `Capacity`.
- `Background` -> `Campus photo`.
- `Add Building` -> `Draw building` where drawing is the actual action.

Keep implementation details available only where useful for advanced operators.

### 9. Remove raw changed buttons and `title`-only affordances in touched surfaces

Required:

- Replace raw changed `<button>` controls in dashboard/map touched files with local `Button` primitives or approved UI primitives.
- Replace `title` attributes with `Tooltip` plus `aria-label` when visible text is not enough.
- Icon-only controls must have accessible names.
- Core actions must not be hover-only.

### 10. Preserve ATLAS scheduling purpose

Do not copy SMART grading domain language.

Do not add:

- `Class Records`
- `Grading Status`
- `Attendance`
- teacher grading metrics

Keep ATLAS scheduling language:

- sections
- teachers
- teaching rooms
- campus and rooms
- timetable
- generation readiness
- publish readiness

## Component / File Size Requirements

- `AppShell.tsx` must be under 1000 lines.
- `Dashboard.tsx` must remain under 1000 lines and should shrink if possible.
- `CampusMapEditor.tsx` and `BuildingPanel.tsx` are currently under 1000 lines, but avoid growing them toward the limit.
- New components should be focused and generally under 500 lines.

Suggested new components:

- `components/dashboard/CampusReadinessCard.tsx`
- `components/dashboard/ReadinessObjectRow.tsx` if the inline stats need replacement
- `components/campus-map/CampusMapOverview.tsx`
- `components/campus-map/CampusMapEditorMode.tsx`
- `components/campus-map/CampusMapToolbar.tsx`
- `components/campus-map/BuildingSummaryCard.tsx`
- `components/campus-map/AdvancedPlacementFields.tsx`
- `components/campus-map/campusMapPalette.ts`

## Verification Requirements

Required commands:

- `npm --prefix atlas-client run build`

Required line count check:

- `atlas-client/src/components/AppShell.tsx`
- `atlas-client/src/pages/Dashboard.tsx`
- `atlas-client/src/components/CampusMapEditor.tsx`
- `atlas-client/src/components/BuildingPanel.tsx`
- every new extracted file

Required browser checks:

- `/` desktop
- `/map` desktop overview mode
- `/map` desktop editor mode
- `/` mobile portrait
- `/map` mobile portrait
- mobile landscape if browser tooling allows it

Required Tailnet check:

- Use `https://njgrm.buru-degree.ts.net/` as the primary verification environment.
- Log in directly with `1000001` / `AdminSY2026!`.
- Capture computed values for `--primary`, `--accent`, sidebar active background, and dashboard primary CTA background.
- On HNHS Tailnet, the dashboard primary CTA must be maroon/token-derived, not green.

Required evidence screenshots:

- `qa-artifacts/playwright/20260529-admin-dashboard-desktop-smart-recovery-after.png`
- `qa-artifacts/playwright/20260529-admin-campus-map-overview-desktop-smart-recovery-after.png`
- `qa-artifacts/playwright/20260529-admin-campus-map-editor-desktop-smart-recovery-after.png`
- `qa-artifacts/playwright/20260529-admin-dashboard-mobile-portrait-smart-recovery-after.png`
- `qa-artifacts/playwright/20260529-admin-campus-map-mobile-portrait-smart-recovery-after.png`

If the shared browser still refuses to shrink to true mobile width, record the limitation and do not claim mobile GO.

## Post-Code Audit Checklist

Before returning, compare against `docs/reports/dashboard-campus-map-smart-identity-audit-2026-05-29.md`:

- Major 1 shell identity: resolved / partial / unresolved
- Major 2 dashboard copy: resolved / partial / unresolved
- Major 3 amber CTA dominance: resolved / partial / unresolved
- Major 4 stat strip work-object clarity: resolved / partial / unresolved
- Critical 5 dashboard campus mini-app: resolved / partial / unresolved
- Critical 6 `/map` editor-first behavior: resolved / partial / unresolved
- Major 7 map palette: resolved / partial / unresolved
- Major 8 technical map language: resolved / partial / unresolved
- Major 9 raw buttons/title affordances: resolved / partial / unresolved
- Major 10 `AppShell.tsx` 1000-line violation: resolved / partial / unresolved

## Required Output

Return:

1. files changed
2. SMART identity changes applied
3. dashboard before/after summary
4. campus map before/after summary
5. line count table
6. accessibility fixes
7. screenshots captured
8. command/test results
9. unresolved audit items, if any
10. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- the visible shell/dashboard primary identity is token-driven SMART-like rather than blue/admin-console-like or hard-coded green
- `AppShell.tsx` is under 1000 lines
- dashboard first viewport reads as a scheduling portal with one obvious next action
- dashboard campus section is a summary/action card, not an embedded floor-plan browser
- `/map` defaults to a read-first campus overview and has an explicit editor mode
- primary path map copy avoids raw coordinate/implementation language
- touched controls use local UI primitives and accessible labels
- local build passes
- desktop screenshots are captured

Return `NO-GO` if any Critical finding remains unresolved or if verification evidence is incomplete.
