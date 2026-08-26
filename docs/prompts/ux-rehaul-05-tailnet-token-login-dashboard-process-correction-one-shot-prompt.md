# UX Rehaul Prompt 05: Tailnet Token, Login, Dashboard Process Correction One-Shot

## Mission

Correct the SMART rehaul direction using live Tailnet evidence. ATLAS must feel like the same product family as SMART through layout, information hierarchy, portal framing, task cards, compact surfaces, and token architecture, but ATLAS must consume EnrollPro/HNHS school branding tokens. Do not hard-code SMART emerald as the final ATLAS identity.

This prompt supersedes any previous wording that says the goal is an `emerald portal`. The correct goal is a token-driven SMART-family scheduling portal. On the live HNHS Tailnet environment, primary actions must render maroon from EnrollPro tokens, not green.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/prompts/ux-rehaul-smart-identity-sequence-2026-05-29.md`
- `docs/reports/dashboard-login-sidebar-token-tailnet-audit-2026-05-30.md`
- `docs/reports/dashboard-campus-map-smart-identity-audit-2026-05-29.md`
- `docs/plans/ux-ui-rehaul-and-1000-line-refactor-plan-2026-05-29.md`
- `docs/reports/ux-ui-atlas-vs-smart-comparison-audit-2026-05-29.md`
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`

Inspect directly:

- `atlas-client/src/pages/Dashboard.tsx`
- `atlas-client/src/hooks/useDashboardData.ts`
- `atlas-client/src/pages/Login.tsx`
- `atlas-client/src/components/AppShell.tsx`
- `atlas-client/src/components/app-shell/AppSidebar.tsx`
- `atlas-client/src/components/app-shell/navigation.ts`
- `atlas-client/src/lib/settings.ts`
- `atlas-client/src/index.css`
- `external-references/FINAL-CAPSTONE-SMART/src/pages/LoginPage.tsx`
- `external-references/FINAL-CAPSTONE-SMART/src/contexts/ThemeContext.tsx`
- `external-references/FINAL-CAPSTONE-SMART/src/layouts/TeacherLayout.tsx`
- `external-references/FINAL-CAPSTONE-SMART/src/layouts/RegistrarLayout.tsx`

Reference evidence:

- `qa-artifacts/playwright/20260530-tailnet-dashboard-smart-token-audit.png`

## Required Skills / Rules

Apply:

- `.github/skills/atlas-21st-dev-frontend/SKILL.md`
- `.github/skills/atlas-design-system-enforcer/SKILL.md`
- `.github/skills/atlas-ux-audit-gate/SKILL.md`
- `.github/skills/atlas-copy-and-microcopy/SKILL.md`
- `.github/skills/atlas-mobile-faculty-ux/SKILL.md` because shell/login changes affect faculty navigation entry
- `.github/skills/atlas-shared-browser-qa/SKILL.md`

Use Context7 for Radix/shadcn and motion behavior if introducing or changing Sheet, Tooltip, Dialog, Tabs, segmented controls, route transitions, or focus management.

## Verified Starting Facts

- SMART branch is `LATEST-SMART-PRE-ORAL-DONE-29-05-2026-4-25PM` at commit `408f60c`.
- SMART defaults to emerald but its real pattern is token-driven: `ThemeContext.tsx` writes `--theme-primary`, `--theme-accent`, and RGB variants.
- Tailnet HNHS ATLAS exposes maroon tokens: `--primary = 360 75% 30%`, `--accent = 360 75% 30%`, `--sidebar-primary = 360 75% 30%`.
- Tailnet sidebar active link already renders maroon: `rgb(134, 19, 19)`.
- Tailnet dashboard primary button currently renders green: `oklch(0.596 0.145 163.225)`.
- Active school year is `55` / `2026-2027` from `/api/v1/runtime/context?schoolId=1`.
- Active school year has `82` sections and latest completed generation run `128` with duration `20441ms`.
- `Dashboard.tsx` currently hard-codes `CURRENT_PHASE = 'SETUP'`.

## Hard Scope

Allowed source files:

- `atlas-client/src/pages/Dashboard.tsx`
- `atlas-client/src/hooks/useDashboardData.ts`
- new or changed files under `atlas-client/src/components/dashboard/*`
- `atlas-client/src/pages/Login.tsx`
- `atlas-client/src/components/AppShell.tsx` only if shell token application or layout wiring requires it
- `atlas-client/src/components/app-shell/AppSidebar.tsx`
- `atlas-client/src/components/app-shell/navigation.ts`
- `atlas-client/src/lib/settings.ts` only for token aliasing or cached theme application
- `atlas-client/src/index.css` only for token defaults/utilities that cannot live in component classes
- `docs/reference/atlas-runtime-source-of-truth-map.md` only if route/source ownership changes
- `docs/verification/evidence-log.md` when live evidence is captured
- `CHANGELOG.md`

Do not change backend APIs, Prisma schema, scheduling algorithms, auth semantics, or EnrollPro data ownership unless a compile/runtime issue proves a minimal frontend-compatible fix is required.

## Mandatory Outcomes

### 1. Replace hard-coded brand emerald with token-driven SMART styling

Required:

- Remove hard-coded emerald classes from brand/primary-action styling in touched files.
- Do not use `bg-emerald-*`, `text-emerald-*`, `from-emerald-*`, `via-emerald-*`, `to-teal-*`, `ring-emerald-*`, or `shadow-emerald-*` for brand identity or primary actions.
- Use theme tokens instead: `bg-primary`, `text-primary`, `border-primary`, `ring-primary`, `bg-primary/10`, `text-primary-foreground`, `hsl(var(--primary))`, `hsl(var(--accent))`, or SMART-compatible aliases sourced from EnrollPro settings.
- Add SMART-compatible aliases if useful, such as `--theme-primary`, `--theme-accent`, and RGB variants, but derive them from ATLAS/EnrollPro `selectedAccentHsl`; do not introduce a fixed green fallback on Tailnet.

Allowed semantic color exceptions:

- `amber` for warnings/blockers.
- `red/destructive` for errors/hard blockers.
- `green/emerald` only for semantic success states where color is not the brand identity.
- Strict DepEd grade colors only when the UI is explicitly encoding grade level.

Tailnet pass condition:

- On `https://njgrm.buru-degree.ts.net/`, dashboard primary CTA background must compute to HNHS maroon/token-derived primary, not green.
- Sidebar active state and dashboard primary action must visually agree.

### 2. Update login to SMART composition without copying SMART domain

Required:

- Refactor `Login.tsx` to follow SMART's login composition: school brand panel, compact login panel, token-driven gradient, logo handling, mobile brand header, and subtle pixel/grid motif.
- Preserve ATLAS auth behavior: bridge token capture, direct local login, remember-me behavior, `verifySessionToken`, faculty/admin landing routing, and existing error handling.
- Preserve ATLAS scheduling copy:
  - scheduling portal
  - timetable generation
  - teacher preferences
  - review and publish
  - Junior High School scope
- Do not copy SMART grading domain labels such as `Class Records`, `Grade Analytics`, `Student Management and Records Tracking`, or teacher-only routing behavior.
- Replace any raw changed icon-only buttons with local `Button` primitives or provide accessible names and approved primitives where the existing UI primitive supports the control.

### 3. Make dashboard lifecycle reflect live runtime state

Required:

- Remove `CURRENT_PHASE = 'SETUP'` from `Dashboard.tsx`.
- Extend `useDashboardData` or a nearby dashboard service hook to fetch enough existing data to infer the real dashboard state:
  - active school year context
  - subject readiness
  - faculty readiness
  - section readiness
  - building/room readiness
  - latest completed generation run status
  - latest violation counts by severity if available
  - published schedule status if an existing public/published endpoint can answer it cheaply
- Do not add memory-heavy timetable payload reads to the dashboard just to infer state. Prefer metadata endpoints and lightweight latest-run/violation summaries.
- If no lightweight endpoint exists for a piece of state, display `Needs review` or `Unavailable` honestly rather than loading full timetable payloads.

State guidance:

- If setup is incomplete, next action should target the missing setup object.
- If setup is complete and no completed generation run exists, next action should be `Generate timetable`.
- If a completed generation run exists and hard violations are zero but soft warnings exist, next action should be `Review warnings` or `Review timetable`.
- If a completed generation run exists and hard violations exist, next action should be `Fix blockers`.
- If a schedule is already published, next action should be `View published schedule` or `Manage changes`.

Required copy distinction:

- Rename `Setup checklist` to `Setup readiness` if it only covers setup prerequisites.
- Add or revise a separate `Scheduling lifecycle` card/row for whole-process progress.

### 4. Align sidebar chronology with dashboard process order

Required:

- Update `navigation.ts` and sidebar group labels so the menu teaches the same process order as the dashboard.
- Recommended order:
  1. Dashboard
  2. Sections / school year evidence
  3. Subjects
  4. Teachers
  5. Teaching Load
  6. Campus & Rooms
  7. Preferences
  8. Room Requests
  9. Timetable
  10. Schedules / Publish
  11. Audit
- Use plain labels that a scheduler understands at a glance.
- Keep `Back to EnrollPro` demoted inside a user/system menu, not as a primary navigation step.
- Use token-driven active/status colors in the sidebar. Do not leave brand text fixed emerald while active nav is maroon.

### 5. Preserve no-scroll architecture on table/workbench pages

Required:

- Do not convert dense table/workbench pages into global scrolling pages.
- Any touched table/workbench page must keep localized scroll regions using patterns like `flex-1 min-h-0 overflow-auto` inside `h-[calc(100svh-3.5rem)]` containers.
- Preserve sticky table headers and dense controls on:
  - `/teachers`
  - `/teaching-load`
  - `/sections`
  - `/subjects`
  - `/timetable`
  - `/schedules`
  - `/audit`

### 6. Keep SMART as interaction family, not feature/domain source

Required:

- Borrow SMART's layout rhythm, token usage, portal clarity, compact cards, rounded nav, and school identity presentation.
- Do not copy SMART routes, role model, grading concepts, class-record workflows, or copy that belongs to SMART rather than ATLAS.

## Component / File Size Requirements

- `Dashboard.tsx` must remain under 1000 lines.
- `Login.tsx` must remain under 1000 lines.
- `AppShell.tsx` must remain under 1000 lines.
- Any new dashboard/login/sidebar component should generally stay under 500 lines.
- Extract focused components under `components/dashboard/*` only when it reduces real duplication or keeps files small.

## Verification Requirements

Required local commands:

- `npm --prefix atlas-client run build`

Required line count check:

- `atlas-client/src/pages/Dashboard.tsx`
- `atlas-client/src/pages/Login.tsx`
- `atlas-client/src/components/AppShell.tsx`
- `atlas-client/src/components/app-shell/AppSidebar.tsx`
- `atlas-client/src/components/app-shell/navigation.ts`
- every new extracted file

Required Tailnet browser checks:

- Login page at `https://njgrm.buru-degree.ts.net/` with no active session.
- Direct admin login with `1000001` / `AdminSY2026!`.
- Dashboard first viewport after login.
- Sidebar active/hover states.
- At least one dense table page, preferably `/teachers` or `/sections`, to verify no global scrollbar regression.

Required Tailnet computed-style checks:

- `getComputedStyle(document.documentElement).getPropertyValue('--primary')`
- `getComputedStyle(document.documentElement).getPropertyValue('--accent')`
- sidebar active link background color
- dashboard primary CTA background color
- login primary button background color

Required evidence screenshots:

- `qa-artifacts/playwright/20260530-login-tailnet-token-correction-after.png`
- `qa-artifacts/playwright/20260530-dashboard-tailnet-token-correction-after.png`
- `qa-artifacts/playwright/20260530-sidebar-tailnet-process-correction-after.png`
- `qa-artifacts/playwright/20260530-table-noscroll-tailnet-correction-after.png`

If mobile verification is attempted and the shared browser cannot reach true mobile width, record the limitation and do not claim mobile GO.

## Required Output

Return:

1. files changed
2. token architecture changes applied
3. login before/after summary
4. dashboard lifecycle/progress before/after summary
5. sidebar chronology before/after summary
6. no-scroll table verification result
7. line count table
8. computed-style evidence from Tailnet
9. screenshots captured
10. command/test results
11. unresolved audit items, if any
12. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- SMART branch verification is recorded.
- Dashboard, login, and sidebar use token-driven colors for brand/primary identity.
- On Tailnet HNHS, dashboard/login primary actions render maroon/token-derived primary, not green.
- Dashboard lifecycle is derived from live runtime evidence and does not hard-code `Setup`.
- Dashboard next action agrees with latest generation/publish state.
- Sidebar chronology matches dashboard process order.
- Table/workbench no-scroll architecture remains intact on at least one dense page.
- Local build passes.
- Required Tailnet screenshots and computed-style evidence are captured.

Return `NO-GO` if any critical token, lifecycle, login, or verification item remains unresolved.