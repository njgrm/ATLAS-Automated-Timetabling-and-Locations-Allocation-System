# UX Rehaul Prompt 01: Shell + Global SMART Identity Refactor One-Shot

## Mission

Refactor `AppShell.tsx` below the 1000-line rule and shift ATLAS's global UX identity toward the SMART product family while preserving ATLAS auth, routing, no-scroll architecture, and role separation.

This pass changes the app's visual frame. It must make ATLAS feel like a sibling of SMART, not an EnrollPro-styled separate system, while keeping ATLAS scheduling-specific navigation and controls.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/plans/ux-ui-rehaul-and-1000-line-refactor-plan-2026-05-29.md`
- `docs/reports/ux-ui-atlas-vs-smart-comparison-audit-2026-05-29.md`
- `docs/prompts/ux-rehaul-smart-identity-sequence-2026-05-29.md`
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`

Inspect directly:

- `atlas-client/src/components/AppShell.tsx`
- `atlas-client/src/App.tsx`
- `atlas-client/src/lib/settings.ts`
- `atlas-client/src/lib/enrollpro-public-settings.ts`
- any existing shell/sidebar/mobile nav primitives
- `external-references/FINAL-CAPSTONE-SMART/src/layouts/TeacherLayout.tsx`
- `external-references/FINAL-CAPSTONE-SMART/src/layouts/RegistrarLayout.tsx`
- `external-references/FINAL-CAPSTONE-SMART/src/layouts/AdminLayout.tsx`
- `external-references/FINAL-CAPSTONE-SMART/src/contexts/ThemeContext.tsx`
- `external-references/FINAL-CAPSTONE-SMART/src/index.css`

## Required Skills / Rules

Apply:

- `.github/skills/atlas-21st-dev-frontend/SKILL.md`
- `.github/skills/atlas-design-system-enforcer/SKILL.md`
- `.github/skills/atlas-ux-audit-gate/SKILL.md`
- `.github/skills/atlas-copy-and-microcopy/SKILL.md`
- `.github/skills/atlas-mobile-faculty-ux/SKILL.md` because shell behavior includes faculty `/my/*` paths
- `.github/skills/atlas-shared-browser-qa/SKILL.md` if doing browser QA

Use Context7 for Radix/shadcn Sheet, Tooltip, DropdownMenu, and motion/reduced-motion behavior if uncertain.

## Product Direction Override For Visual Identity

The older EnrollPro visual identity is no longer the desired target for this rehaul. The new target is SMART-family identity for UX/UI only.

Keep hard ATLAS constraints that came from EnrollPro-era rules when they protect usability:

- no-scroll architecture
- local UI primitive usage
- role-aware navigation
- mobile drawer behavior
- school branding tokens
- direct ATLAS auth behavior

Replace EnrollPro-like visual tone where it conflicts with the SMART family direction.

## SMART Identity Target For Shell

Adopt these patterns from SMART:

- light slate app background
- white/near-white sidebar with subtle border
- school logo/name block at the top of the sidebar
- grouped navigation with uppercase group labels
- rounded active nav pills using the configured theme primary token
- compact sticky top bar with role label and current page title
- user profile area at the bottom of the sidebar
- mobile drawer with the same role navigation language
- school/theme token variables that align ATLAS and SMART visually without forcing SMART's default emerald palette

Sidebar IA update:

- Keep the sidebar chronological and compact: Dashboard -> School Setup -> Teachers and Rooms -> Timetable -> Review and Publish -> Audit.
- Remove locked/disabled future links such as Analytics from the primary sidebar.
- Do not keep Input Collection and Room Requests as standalone admin sidebar groups. Surface those workflows inside Timetable as tabs, queues, or contextual panels unless a later requirement explicitly restores standalone admin pages.

Do not copy SMART's raw buttons/title attributes. Use ATLAS `@/ui` primitives and proper accessible labels.

## Hard Scope

Touch only:

- `atlas-client/src/components/AppShell.tsx`
- new files under `atlas-client/src/components/app-shell/*`
- small shared identity/theme helpers if needed
- docs/evidence if behavior changes

Do not redesign individual route pages in this prompt except where a page title/route label is supplied by the shell.

## Mandatory Refactor Outcomes

### 1. Split `AppShell.tsx`

Extract at minimum:

- `components/app-shell/AppSidebar.tsx`
- `components/app-shell/MobileTopBar.tsx`
- `components/app-shell/MobileNavigationDrawer.tsx`
- `components/app-shell/SchoolYearSelector.tsx`
- `components/app-shell/AppRouteTransition.tsx`
- `components/app-shell/UserMenu.tsx`
- `components/app-shell/navigation.ts` or equivalent config module

`AppShell.tsx` must end below 1000 lines and should act as a shell orchestrator.

### 2. Preserve route transition correctness

Do not break the existing React Router `useOutlet()` freeze pattern used to avoid the AnimatePresence blinking bug.

Add or verify reduced-motion behavior for route transitions.

### 3. Redesign navigation identity toward SMART

The shell should feel like:

- `ATLAS Scheduling Portal` as a sibling to SMART's teacher/registrar/admin portals
- role-aware and school-branded
- education-product-like, not a generic EnrollPro admin extension

Preferred privileged nav grouping:

1. `Operations`
   - Dashboard
2. `School Setup`
   - Sections
   - Campus & Rooms
   - Subjects
3. `Faculty Planning`
   - Teachers
   - Teaching Load
4. `Input Collection`
   - Preferences
   - Room Requests
5. `Build & Validate`
   - Timetable
   - Room Schedules
   - Audit
6. `Advanced`
   - true advanced/admin tools only

Faculty self-service navigation must stay simpler and separate.

### 4. Keep ATLAS scheduling language

The shell must not introduce SMART grading labels like `Class Records`, `Grading Status`, or `Attendance`.

Use ATLAS scheduling labels:

- `My Schedule`
- `My Room Requests`
- `Teaching Load`
- `Timetable`
- `Room Schedules`
- `Campus & Rooms`
- `Setup and Readiness`

### 5. Replace raw shell controls

Changed controls must use local UI primitives:

- Button
- DropdownMenu
- Sheet
- Tooltip
- Select/Popover as appropriate

Do not leave raw icon buttons without accessible labels.

### 6. Add SMART-like role title treatment

The top bar should expose:

- portal name, such as `Scheduling Portal`, `Faculty Portal`, or `Public Schedule`
- current page title
- user/school context where authenticated

Avoid numeric IDs in the main shell.

## Accessibility Requirements

- Collapsed nav labels must use Tooltip, not `title` attributes.
- Mobile menu open/close controls must have accessible names.
- Active nav state must be visible and programmatically understandable.
- Focus states must remain visible.
- Reduced motion must be respected.

## Verification Gates

Required:

- `npm --prefix atlas-client run build`
- line count check for `AppShell.tsx` and extracted files
- local route smoke checks for privileged, faculty, and public routes if available:
  - `/`
  - `/subjects`
  - `/teaching-load`
  - `/timetable`
  - `/my`
  - `/my/schedule`
  - `/public/schedules`
- desktop and mobile shell visual inspection if browser tools are available

## Required Output

Return:

1. before-state shell problems
2. files changed
3. refactor summary with before/after line counts
4. SMART identity shell changes applied
5. ATLAS routing/auth behavior preserved
6. accessibility and reduced-motion notes
7. verification results
8. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- `AppShell.tsx` is under 1000 lines
- shell visually aligns with SMART-family identity
- ATLAS role/navigation semantics are preserved
- faculty/public navigation stays simple
- route transitions do not regress
- local build passes
