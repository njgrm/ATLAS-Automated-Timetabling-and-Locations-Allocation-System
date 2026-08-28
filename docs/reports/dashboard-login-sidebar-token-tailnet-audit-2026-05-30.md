# Dashboard, Login, Sidebar Token Audit - 2026-05-30

## Scope

This audit reviews the live Tailnet ATLAS scheduler dashboard after the SMART-style redesign pass, with specific focus on the user's correction: ATLAS should borrow SMART layout, role clarity, and interaction patterns, but it must consume EnrollPro/HNHS design tokens instead of hard-coding SMART emerald.

Primary environment:

- Tailnet: `https://njgrm.buru-degree.ts.net/`
- Direct ATLAS admin login: `1000001`

Reference branch verified:

- SMART repo path: `external-references/FINAL-CAPSTONE-SMART`
- Branch: `LATEST-SMART-PRE-ORAL-DONE-29-05-2026-4-25PM`
- Commit: `408f60c LATEST SMART (PRE ORAL DONE) 29/05/2026 4:25PM`

Evidence captured:

- `qa-artifacts/playwright/20260530-tailnet-dashboard-smart-token-audit.png`

## Executive Verdict

`NO-GO` for the current dashboard/login/sidebar correction.

The dashboard is now closer to SMART in structure, but the redesign over-applied SMART's default emerald accent. Live Tailnet proves HNHS maroon tokens are available and used by the sidebar active state, while dashboard actions, badges, icon tiles, and gradients are hard-coded green. This makes the shell and page disagree inside the same viewport.

The dashboard also reports a static lifecycle phase (`Setup`) even though live runtime data shows the active school year has a completed generation run. The next action and checklist therefore do not reflect the real process state.

## Live Findings

### Critical 1 - Dashboard hard-codes SMART emerald instead of consuming school tokens

Live Tailnet computed tokens:

- `--primary`: `360 75% 30%`
- `--accent`: `360 75% 30%`
- `--sidebar-primary`: `360 75% 30%`
- Sidebar active dashboard link background: `rgb(134, 19, 19)`
- Main dashboard `Open timetable` button background: `oklch(0.596 0.145 163.225)`

Source evidence:

- `atlas-client/src/pages/Dashboard.tsx` defines `StatTone = 'emerald' | 'sky' | 'violet' | 'amber'`.
- `Dashboard.tsx` uses `bg-emerald-500`, `text-emerald-600`, `bg-emerald-600`, `hover:bg-emerald-700`, `shadow-emerald-glow`, and `from-emerald-500 via-emerald-600 to-teal-700`.
- `atlas-client/src/components/app-shell/AppSidebar.tsx` still contains emerald status text for `Scheduling Portal` and `ACTIVE` even while the active nav token is maroon.

Impact:

The dashboard looks like a SMART-colored page inserted into an HNHS/ATLAS shell. The intended direction is SMART-compatible patterning with EnrollPro/HNHS token authority.

Required correction:

- Do not hard-code `bg-emerald-*`, `text-emerald-*`, `from-emerald-*`, or `shadow-emerald-*` for brand or primary action styling.
- Use `bg-primary`, `text-primary`, `border-primary`, `ring-primary`, `bg-primary/10`, `hsl(var(--primary))`, or a SMART-compatible `--theme-primary` alias derived from `--primary`/EnrollPro `selectedAccentHsl`.
- Reserve fixed semantic colors only for real semantic states: warning, destructive, success, grade colors, or room/category meaning.

### Critical 2 - SMART reference was misunderstood as a fixed green palette

SMART source evidence:

- `external-references/FINAL-CAPSTONE-SMART/src/contexts/ThemeContext.tsx` defaults to emerald but writes configured values into `--theme-primary`, `--theme-secondary`, `--theme-accent`, and RGB variants.
- `external-references/FINAL-CAPSTONE-SMART/src/pages/LoginPage.tsx` maps `--primary` and `--accent` to `var(--theme-primary)` and `var(--theme-accent)`.

Impact:

The previous prompt wording encouraged an emerald target. The correct implementation model is not `make ATLAS green`; it is `make ATLAS use SMART's token architecture and layout language while sourcing color from EnrollPro/HNHS`.

Required correction:

- Update prompt language from `emerald portal` to `token-driven SMART-family portal`.
- On Tailnet HNHS, primary actions must render maroon (`rgb(134, 19, 19)`-family), not green.

### Critical 3 - Dashboard lifecycle is static and contradicts live runtime state

Live Tailnet runtime evidence:

- `/api/v1/runtime/context?schoolId=1`: active school year `55`, label `2026-2027`, source `enrollpro-verified`, stale `false`.
- `/api/v1/subjects/stats/1`: `22` subjects, `0` unassigned.
- `/api/v1/sections/summary/55?schoolId=1`: `82` sections, `3565` enrolled.
- `/api/v1/generation/1/55/runs/latest`: completed run `128`, duration `20441ms`.
- Latest timetable and latest violations routes return data for run `128`.

Source evidence:

- `Dashboard.tsx` hard-codes `const CURRENT_PHASE = 'SETUP';`.
- `pickNextStep()` only reasons over setup readiness, so it returns `Generate the timetable` once setup is complete.

Impact:

The first viewport says `Setup phase`, `Step 1 of 5`, and `Generate the timetable` even though a completed generation run exists. The correct next action is likely review/fix/publish readiness, not generation setup.

Required correction:

- Extend dashboard data to include active school year, latest generation run status, latest violation summary, and published schedule status if an existing endpoint exists.
- Derive the displayed lifecycle state from runtime evidence instead of a component constant.
- Keep `Setup checklist` as setup readiness only, and label it that way.
- Add a separate lifecycle/progress card for the whole process: Setup -> Preferences -> Generation -> Review -> Published.

### Major 4 - Sidebar chronology does not match the dashboard readiness flow

Current sidebar order:

- Dashboard
- School Setup: Sections, Campus & Rooms, Subjects
- Teacher Planning: Teachers, Teaching Load
- Input Collection: Preferences, Room Requests
- Build & Validate: Timetable, Schedules, Audit

Current dashboard setup checklist order:

- Subjects added
- Teachers synced from EnrollPro
- Every subject has a teacher
- Sections loaded for school year
- Buildings and rooms ready

Impact:

The sidebar and dashboard teach different process orders. A scheduler cannot tell whether they should begin with EnrollPro sections, subjects, teachers, teaching load, or campus setup.

Required correction:

- Pick one operator chronology and use it in both dashboard and sidebar.
- Recommended flow: Dashboard -> Sections/School Year evidence -> Subjects -> Teachers -> Teaching Load -> Campus & Rooms -> Preferences -> Room Requests -> Timetable -> Schedules/Publish -> Audit.
- Keep the labels plain and role-oriented.

### Major 5 - Login still needs SMART-pattern parity with token-driven colors

Current state:

- `atlas-client/src/pages/Login.tsx` uses a split branded/login layout and `hsl(var(--primary))`/`hsl(var(--accent))`, but it does not use SMART's `--theme-primary`/RGB token alias pattern.
- Tailnet login still reads as old ATLAS scheduling copy rather than the requested SMART-version login experience adapted for ATLAS.

Required correction:

- Update the login page to match SMART's overall composition: school/portal brand panel, compact form panel, pixel/grid motif, token-driven gradient, logo handling, and mobile logo treatment.
- Keep ATLAS scheduling copy and auth behavior.
- Do not copy SMART grading features such as class records, grade analytics, or teacher-only routing.

### Major 6 - Preserve no-scroll table pages during the correction pass

The latest follow-up prompt must explicitly protect table/workbench pages that already use localized scrolling:

- `/teachers`
- `/teaching-load`
- `/sections`
- `/subjects`
- `/timetable`
- `/schedules`
- `/audit`

Required correction:

- Any touched table/workbench page must keep `h-[calc(100svh-3.5rem)]`, `flex-1 min-h-0 overflow-auto`, sticky headers, and no global browser scrollbar.
- Do not apply landing-page or decorative SMART card treatment to dense operational tables.

## File Size Snapshot

Current audited source file line counts:

| File | Lines | Status |
| --- | ---: | --- |
| `atlas-client/src/pages/Dashboard.tsx` | 515 | Under 1000, but contains hard-coded lifecycle/color logic |
| `atlas-client/src/pages/Login.tsx` | 553 | Under 1000, candidate for SMART-pattern token correction |
| `atlas-client/src/components/AppShell.tsx` | 418 | Under 1000 after extraction |
| `atlas-client/src/components/app-shell/navigation.ts` | 60 | Under 1000, chronology source |
| `atlas-client/src/hooks/useDashboardData.ts` | 96 | Under 1000, needs richer runtime state |

## Required Follow-Up Prompt Direction

The follow-up implementation prompt must require:

1. Tailnet-first verification at `https://njgrm.buru-degree.ts.net/`.
2. Direct admin login before protected-route QA.
3. SMART branch verification before copying patterns.
4. Token-driven SMART implementation, not fixed emerald.
5. Dashboard computed-style proof showing HNHS maroon primary actions on Tailnet.
6. Login page SMART-pattern update with ATLAS scheduling copy.
7. Dashboard lifecycle derivation from live runtime data.
8. Sidebar chronology alignment with dashboard readiness/order.
9. Table no-scroll preservation for dense pages.
10. Screenshot evidence and `GO`/`NO-GO` decision.

## Final Gate

`NO-GO` until the dashboard, login, and sidebar pass Tailnet computed-style verification and the dashboard lifecycle reflects active runtime evidence rather than a hard-coded setup phase.