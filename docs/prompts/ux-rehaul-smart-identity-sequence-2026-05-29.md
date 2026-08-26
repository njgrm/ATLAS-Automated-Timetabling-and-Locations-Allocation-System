# UX Rehaul SMART Identity Prompt Sequence - 2026-05-29

## Purpose

Use this sequence to execute the ATLAS UX/UI rehaul in large one-shot passes. Each prompt combines the required 1000-line refactor work with a visible redesign slice so the app becomes easier to maintain and starts sharing SMART's product identity.

The goal is visual, interaction-family, and token-architecture alignment with SMART, not feature, domain, or fixed-palette alignment. SMART is an academic grading system. ATLAS remains a scheduling system. ATLAS must consume EnrollPro/HNHS school branding tokens when those tokens are available.

## Source Direction

Read first:

- `docs/plans/ux-ui-rehaul-and-1000-line-refactor-plan-2026-05-29.md`
- `docs/reports/ux-ui-atlas-full-audit-2026-05-29.md`
- `docs/reports/ux-ui-atlas-vs-smart-comparison-audit-2026-05-29.md`
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- `docs/phases/faculty-mobile-wireframe-spec.md` for faculty pages
- `external-references/FINAL-CAPSTONE-SMART/src/layouts/TeacherLayout.tsx`
- `external-references/FINAL-CAPSTONE-SMART/src/layouts/RegistrarLayout.tsx`
- `external-references/FINAL-CAPSTONE-SMART/src/pages/teacher/Dashboard.tsx`
- `external-references/FINAL-CAPSTONE-SMART/src/pages/teacher/ClassRecordsList.tsx`
- `external-references/FINAL-CAPSTONE-SMART/src/index.css`
- `external-references/FINAL-CAPSTONE-SMART/src/contexts/ThemeContext.tsx`
- `external-references/FINAL-CAPSTONE-SMART/src/pages/LoginPage.tsx`
- `docs/reports/dashboard-login-sidebar-token-tailnet-audit-2026-05-30.md`

## SMART-Like Identity Contract

Apply these SMART identity traits to ATLAS:

- light slate page background with white surfaces
- token-driven primary/accent as the dominant brand cue; SMART's default may be emerald, but ATLAS must use the configured EnrollPro/school token such as HNHS maroon on Tailnet
- school logo/name as a first-class shell signal
- role-specific portals and page titles
- rounded navigation pills and clear active states
- task/object cards for real user work, not generic metric walls
- warm education-oriented copy that starts from the user's job
- page headers that say what role is doing what now
- compact top bar plus left sidebar on desktop, mobile drawer on phones
- soft borders and restrained shadows where they help hierarchy

Do not interpret SMART alignment as hard-coding green. SMART's reusable pattern is `ThemeContext`-style token consumption. For ATLAS, primary actions, focus rings, selected nav, login gradients, and dashboard brand accents must come from `--primary`, `--accent`, `--sidebar-primary`, or SMART-compatible aliases derived from EnrollPro settings.

Do not copy these SMART weaknesses:

- huge decorative cards where workbench density is needed
- floating orbs, decorative blobs, or ornamental backgrounds
- raw native buttons, title attributes, hover-only destructive actions
- grading-system concepts, SMART domain labels, or SMART route structure
- technical integration leak words such as `Atlas removal detected`, `fallback active`, or `SMART DB fallback`
- animation-heavy loading states without reduced-motion support
- hard-coded `bg-emerald-*`, `text-emerald-*`, `from-emerald-*`, `shadow-emerald-*`, or similar fixed green brand classes for primary ATLAS identity

## ATLAS Hard Constraints That Still Apply

- ATLAS remains a PERN PWA scheduling system.
- Preserve strict MVC boundaries.
- Controllers stay thin; business logic stays in services.
- Frontend work must use local `@/ui/*` primitives for interactive controls.
- No native `<select>` or raw `<button className="...">` for new/changed controls.
- Preserve no-scroll architecture and localized scroll regions.
- No React component file may remain above 1000 lines after its workstream is complete.
- Use `lucide-react` icons only.
- Use `motion/react` only where motion adds clarity, and respect reduced motion.
- Faculty/public pages must use low-tech, plain-language copy.
- Scheduler/admin pages may stay dense, but must lead with blockers and next actions.

## Execution Order

1. `docs/prompts/ux-rehaul-00-audit-dashboard-smart-identity-one-shot-prompt.md`
   - Fix `/audit` crash and hover-only actions.
   - Refactor `Dashboard.tsx` below 1000 lines.
   - Replace KPI wall with SMART-like action center.

2. `docs/prompts/ux-rehaul-01-shell-and-global-identity-refactor-one-shot-prompt.md`
   - Refactor `AppShell.tsx` below 1000 lines.
   - Shift shell identity toward SMART-style role portals while preserving ATLAS routing and auth.
   - Add reduced-motion route handling.

3. `docs/prompts/ux-rehaul-02-faculty-public-smart-aligned-one-shot-prompt.md`
   - Refactor faculty/public oversized surfaces.
   - Redesign `/my`, `/my/schedule`, `/my/preferences`, `/my/room-preferences`, and `/public/schedules` around SMART-like role/task clarity.

4. `docs/prompts/ux-rehaul-03-scheduler-admin-workbench-smart-aligned-one-shot-prompt.md`
   - Refactor `FacultyAssignments`, timetable workspace/dialog/rail, and `ManualEditPanel`.
   - Redesign scheduler/admin workbenches with SMART-aligned identity but ATLAS-grade operational density.

5. `docs/prompts/ux-rehaul-04-dashboard-campus-map-smart-identity-recovery-one-shot-prompt.md`
   - Resolve the post-rehaul dashboard/campus map SMART-identity `NO-GO` audit.
   - Reset shell/dashboard identity away from blue/admin-console cues and toward token-driven SMART portal patterns.
   - Replace the dashboard campus map mini-app with a simplified campus readiness map interface.
   - Split `/map` into read-first campus overview mode and explicit advanced editor mode.

6. `docs/prompts/ux-rehaul-05-tailnet-token-login-dashboard-process-correction-one-shot-prompt.md`
   - Correct the over-greened SMART implementation direction using live Tailnet evidence.
   - Make dashboard/login/sidebar consume EnrollPro/HNHS tokens while preserving SMART layout patterns.
   - Replace static dashboard lifecycle labels with runtime-derived progress.
   - Align sidebar chronology with the dashboard setup/generation/review process.
   - Preserve no-scroll architecture for dense table pages.

7. `docs/prompts/ux-rehaul-06-sidebar-dashboard-map-workflow-repair-one-shot-prompt.md`
   - Supersede stale sidebar/campus-map assumptions after the 2026-05-30 progress audit.
   - Reorder and reduce admin sidebar links around the real timetabling workflow.
   - Remove locked Analytics from the primary sidebar.
   - Move admin Preferences and Room Requests into Timetable workflow navigation instead of standalone sidebar links.
   - Keep a simplified, presentable dashboard map/readiness preview.
   - Redesign `/map` overview/editor and building views so they are plain-language, modern, and SMART-family aligned.

8. `docs/prompts/ux-rehaul-07-15-admin-pages-sequence-2026-05-30.md`
   - Queue guide for admin pages from `/sections` through `/audit`, explicitly excluding `/timetable`.
   - Use this file to run prompts 07-15 in order.

9. `docs/prompts/ux-rehaul-07-admin-shared-list-pattern-one-shot-prompt.md`
   - Create a shared SMART-family admin list/workspace pattern for `/sections`, `/subjects`, and `/teachers`.

10. `docs/prompts/ux-rehaul-08-sections-smart-setup-one-shot-prompt.md`
   - Redesign `/sections` around roster readiness, home-room progress, source honesty, and section detail clarity.

11. `docs/prompts/ux-rehaul-09-subjects-smart-curriculum-one-shot-prompt.md`
   - Redesign `/subjects` around curriculum readiness, coverage, and plain-language subject actions.

12. `docs/prompts/ux-rehaul-10-teachers-roster-health-one-shot-prompt.md`
   - Redesign `/teachers` around roster health, load readiness, and teacher profile clarity.

13. `docs/prompts/ux-rehaul-11-teaching-load-state-clarity-one-shot-prompt.md`
   - Harden `/teaching-load` state communication without changing staffing math or backend truth.

14. `docs/prompts/ux-rehaul-12-campus-rooms-polish-one-shot-prompt.md`
   - Polish `/map` overview/editor while preserving the restored original map behavior and room schedule drilldown.

15. `docs/prompts/ux-rehaul-13-schedules-browser-one-shot-prompt.md`
   - Redesign `/schedules` as the room/teacher/section schedule browser.

16. `docs/prompts/ux-rehaul-14-audit-readiness-report-one-shot-prompt.md`
   - Rebuild `/audit` as an operator readiness report and fix duplicate-key/blank-state risks.

17. `docs/prompts/ux-rehaul-15-admin-pages-cross-qa-gate-prompt.md`
   - Run the final cross-page QA gate across `/sections`, `/subjects`, `/teachers`, `/teaching-load`, `/map`, `/schedules`, and `/audit`.

## Cross-Prompt Verification Baseline

Every prompt must return:

1. files changed
2. refactor/extraction summary with before/after line counts for every targeted >1000-line file
3. SMART identity changes applied
4. ATLAS scheduling UX preserved
5. accessibility and reduced-motion checks
6. local build/typecheck results
7. route smoke-check results where possible
8. Tailnet status and computed-style token evidence if checked
9. `GO` or `NO-GO`

## Phase Closure Rule

These prompts can return prompt-scope `GO`, but they do not close the broader phase unless `phasePlan.md`, `docs/verification/phase-gates.md`, and `docs/verification/evidence-log.md` have matching live evidence.
