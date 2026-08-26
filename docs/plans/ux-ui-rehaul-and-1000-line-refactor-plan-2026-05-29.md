# UX/UI Rehaul and 1000-Line Refactor Plan - 2026-05-29

## Purpose

This plan converts the ATLAS UX/UI audit and SMART comparison audit into an execution path. It separates the redesign into safe phases and identifies the component refactors needed before major page-level redesign work.

Primary inputs:

- `docs/reports/ux-ui-atlas-full-audit-2026-05-29.md`
- `docs/reports/ux-ui-atlas-vs-smart-comparison-audit-2026-05-29.md`
- SMART reference clone at `external-references/FINAL-CAPSTONE-SMART`

## Rehaul Principles

1. Start every page with the user's job, not the system's data model.
2. Show one obvious next action before secondary metrics.
3. Hide implementation metadata unless the user opens advanced details.
4. Use faculty/public language for faculty/public pages and scheduler language for scheduler pages.
5. Preserve dense workbench layouts only where the target user is an expert operator.
6. Use mobile-first layouts for faculty pages.
7. Keep public pages fast, searchable, and nontechnical.
8. Fix runtime/accessibility blockers before visual polish.
9. Extract oversized components before changing their UX deeply.

## UX Language Standard

Replace system-centric terms before or during page rewrites.

| Avoid | Preferred User-Facing Copy |
|---|---|
| Published run | Official schedule |
| Run ID | Schedule version, hidden in details |
| Latest run | Most recent schedule |
| Generation run | Schedule attempt |
| Hard violation | Must fix before publishing |
| Soft violation | Warning |
| Upstream unavailable | Enrollment data cannot be reached |
| Saved data | Showing the last saved copy |
| Mirror | Saved copy |
| Offering contract | Subject requirements |
| Runtime context | Current school year |
| Source | Data status |
| Quarantine | Needs review |
| Split-brain | Conflicting saved data |

## Implementation Phases

### Phase 0 - Stabilize Broken UX Surfaces

Goal: make the current UI safe enough to audit and use while the rehaul is planned.

Scope:

- Fix `/audit` runtime crash by importing missing tooltip primitives.
- Remove hover-only actions from `/audit`; make actions visible or keyboard-reachable.
- Verify direct admin login and route load for `/`, `/audit`, `/subjects`, `/teachers`, `/sections`, `/teaching-load`, `/room-schedules`, `/map`, and `/timetable`.
- Add or verify reduced-motion handling for major route/page animation.
- Confirm Tailnet `/login` is no longer returning `502` before claiming live UX evidence.

Exit criteria:

- `/audit` loads without runtime exception.
- No critical page is blocked by a client-side crash.
- Evidence notes distinguish local and Tailnet verification.

### Phase 1 - Product Language and Status State Rewrite

Goal: reduce cognitive load before layout changes.

Scope:

- Rewrite public/faculty schedule copy.
- Replace run/source/mirror/upstream terminology on faculty and public pages.
- Standardize empty, loading, offline, saved-copy, and error states.
- Create or reuse a shared `StatusMessage`/`EmptyState` pattern with:
  - plain title
  - short explanation
  - one primary action
  - optional technical details behind disclosure

Target files:

- `atlas-client/src/pages/PublicPublishedSchedule.tsx`
- `atlas-client/src/pages/MySchedule.tsx`
- `atlas-client/src/pages/MyDashboard.tsx`
- `atlas-client/src/pages/Dashboard.tsx`
- `atlas-client/src/pages/RoomSchedules.tsx`
- `atlas-client/src/pages/Subjects.tsx`
- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/pages/Sections.tsx`

Exit criteria:

- No faculty/public first viewport shows run IDs, source IDs, or integration jargon.
- Error and empty states use a shared pattern.
- Technical details remain available only in advanced/debug affordances.

### Phase 2 - Role-Specific Information Architecture

Goal: make each role understand its task at a glance.

Scope:

- Define role home patterns:
  - Scheduler/Admin: `What blocks the schedule from being published?`
  - Faculty: `Do I need to act today?`
  - Student/Public: `Find my class schedule.`
- Rework `AppShell` navigation labels and grouping where needed.
- Add page-level priority blocks before dense tables.
- Move secondary statistics to inline status bands or collapsible sections.

Target pages:

- `/`
- `/my`
- `/my/schedule`
- `/public/schedules`
- `/teaching-load`
- `/timetable`
- `/room-schedules`

Exit criteria:

- Each page has exactly one primary action in the first viewport.
- Faculty/public pages do not expose scheduler/admin controls.
- Scheduler pages expose advanced controls only after the primary blocker summary.

### Phase 3 - Faculty and Public UX Rehaul

Goal: make nontechnical user flows simple, calm, and mobile-first.

Scope:

- Rebuild public schedule page around a top search field and section-first results.
- Rebuild faculty schedule page around official schedule status and today/weekly view.
- Improve faculty dashboard recovery states.
- Rewrite faculty support/preference labels with privacy-aware language.
- Simplify room request Step 2 with a clearer legend and larger touch targets.
- Add semantic steppers with `aria-current` and visible step state.

Target files:

- `atlas-client/src/pages/PublicPublishedSchedule.tsx`
- `atlas-client/src/pages/MySchedule.tsx`
- `atlas-client/src/pages/MyDashboard.tsx`
- `atlas-client/src/pages/FacultyPreferences.tsx`
- `atlas-client/src/components/faculty-preferences/MobilePreferencesLayout.tsx`
- `atlas-client/src/pages/FacultyRoomPreferences.tsx`
- `atlas-client/src/components/faculty-room-preferences/MobileRoomRequestLayout.tsx`
- `atlas-client/src/components/faculty-shared/FacultyGlobalHeader.tsx`

Exit criteria:

- Public page first action is schedule search.
- Faculty pages pass mobile viewport QA.
- All primary faculty controls meet 44px minimum target height unless a documented exception exists.

### Phase 4 - Scheduler/Admin Workbench Rehaul

Goal: keep power while reducing overload.

Scope:

- Dashboard becomes a next-action worklist, not a KPI wall.
- Teaching load gets guided default mode plus advanced audit/autofill mode.
- Timetable gets a `Can this be published?` readiness header.
- Room schedules hide run selection behind advanced controls.
- Map editor gets clearer mode controls, larger icon targets, and tooltips.
- Audit becomes `Setup and readiness blockers` instead of a system-health console.

Target files:

- `atlas-client/src/pages/Dashboard.tsx`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/pages/TeachingLoad.tsx`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx`
- `atlas-client/src/pages/RoomSchedules.tsx`
- `atlas-client/src/pages/MapEditor.tsx`
- `atlas-client/src/components/CampusMapEditor.tsx`
- `atlas-client/src/pages/Audit.tsx`

Exit criteria:

- Dense pages have plain-language blocker summaries.
- Advanced/debug controls are grouped away from primary task controls.
- Small icon-only controls have accessible labels and tooltips.

### Phase 5 - Visual System Consolidation

Goal: make ATLAS feel like one product.

Scope:

- Define page header variants for role pages, workbench pages, and public pages.
- Define status/empty/error variants.
- Define toolbar density rules.
- Define card usage rules.
- Remove excessive one-off rounded/shadow/card styling.
- Add screenshot-based QA matrix for desktop and mobile.

Exit criteria:

- New pages and updated pages share reusable patterns.
- No large decorative card sections are used where a workbench layout is more appropriate.
- QA screenshots are attached or logged for affected routes.

## 1000-Line Refactor Plan

The files below violate the mandatory React component size rule. Refactor them before or during UX work in their area. The goal is not only line-count reduction; it is to separate data loading, state orchestration, layout, and presentational components.

### Refactor Priority Table

| Priority | File | Current Lines | Refactor Target | Why It Comes Here |
|---:|---|---:|---|---|
| 1 | `atlas-client/src/pages/FacultyAssignments.tsx` | 2825 | `<1000`, ideally `<500` page shell | Highest risk, core teaching-load UX, largest file. |
| 2 | `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx` | 1449 | `<800` orchestrator | Core scheduler workflow; UX changes will be risky without extraction. |
| 3 | `atlas-client/src/components/timetable/modals/ScheduleReviewDialog.tsx` | 1437 | split into focused modal sections | Dialog complexity can easily regress accessibility. |
| 4 | `atlas-client/src/components/timetable/LeftRailContent.tsx` | 1138 | split per tab/rail section | Violations/unassigned/pinned/request panels need different UX copy. |
| 5 | `atlas-client/src/components/ManualEditPanel.tsx` | 1125 | split editor, conflict, save/retry, form pieces | Manual edit is high-risk operator flow. |
| 6 | `atlas-client/src/pages/Dashboard.tsx` | 1101 | split dashboard sections | First page to redesign; extraction reduces visual churn risk. |
| 7 | `atlas-client/src/pages/FacultyRoomPreferences.tsx` | 1087 | page shell plus mobile/desktop state containers | Faculty mobile flow needs rehaul. |
| 8 | `atlas-client/src/components/AppShell.tsx` | 1064 | split sidebar, mobile nav, school-year selector, route transition | Global shell changes can affect every page. |

### Refactor 1 - `FacultyAssignments.tsx`

Proposed extraction:

- `components/faculty-assignments/FacultyAssignmentsPageShell.tsx`
- `components/faculty-assignments/AssignmentDataState.tsx` or hook-only extraction into `hooks/useTeachingLoadData.ts` where appropriate
- `components/faculty-assignments/AssignmentModeRouter.tsx`
- `components/faculty-assignments/TeachingLoadStatusBanners.tsx`
- `components/faculty-assignments/AssignmentAdvancedControls.tsx`

Rules:

- Keep route page as orchestration only.
- Do not rewrite assignment logic during extraction.
- Add a smoke test or route load check after extraction.

### Refactor 2 - `ScheduleReviewWorkspace.tsx`

Proposed extraction:

- `components/timetable/workspace/ScheduleReviewHeader.tsx`
- `components/timetable/workspace/PublishReadinessBanner.tsx`
- `components/timetable/workspace/ScheduleGridRegion.tsx`
- `components/timetable/workspace/ScheduleWorkspaceState.tsx`
- `components/timetable/workspace/ScheduleWorkspaceActions.tsx`

Rules:

- Preserve existing route behavior.
- Keep timetable data transformation outside presentational components.
- Add UX language after extraction, not before.

### Refactor 3 - `ScheduleReviewDialog.tsx`

Proposed extraction:

- `components/timetable/modals/ReviewSummarySection.tsx`
- `components/timetable/modals/ViolationListSection.tsx`
- `components/timetable/modals/PublishConfirmationSection.tsx`
- `components/timetable/modals/ReviewDialogFooter.tsx`

Rules:

- Verify dialog title/description semantics.
- Ensure focus management remains correct.

### Refactor 4 - `LeftRailContent.tsx`

Proposed extraction:

- `components/timetable/left-rail/ViolationsPanel.tsx`
- `components/timetable/left-rail/UnassignedPanel.tsx`
- `components/timetable/left-rail/PinnedPanel.tsx`
- `components/timetable/left-rail/RoomRequestsPanel.tsx`
- `components/timetable/left-rail/LeftRailEmptyState.tsx`

Rules:

- Convert labels while extracting.
- Each panel should own its empty state.

### Refactor 5 - `ManualEditPanel.tsx`

Proposed extraction:

- `components/manual-edit/ManualEditForm.tsx`
- `components/manual-edit/ManualEditConflictSummary.tsx`
- `components/manual-edit/ManualEditActions.tsx`
- `components/manual-edit/ManualEditStatusBanner.tsx`
- `components/manual-edit/useManualEditDraft.ts`

Rules:

- Do not change save semantics while extracting.
- Keep validation messages plain-language.

### Refactor 6 - `Dashboard.tsx`

Proposed extraction:

- `components/dashboard/NextActionPanel.tsx`
- `components/dashboard/SetupChecklist.tsx`
- `components/dashboard/DashboardInlineStats.tsx`
- `components/dashboard/LifecycleSummary.tsx`
- `components/dashboard/CampusMapPreview.tsx`

Rules:

- Replace KPI wall with `NextActionPanel` during this refactor.
- Keep stat cards only for secondary scanning.

### Refactor 7 - `FacultyRoomPreferences.tsx`

Proposed extraction:

- `components/faculty-room-preferences/RoomRequestPageShell.tsx`
- `components/faculty-room-preferences/RoomRequestStepState.tsx`
- `components/faculty-room-preferences/RoomRequestStatusBanners.tsx`
- `components/faculty-room-preferences/RoomRequestActionBar.tsx`

Rules:

- Increase touch targets during extraction.
- Add semantic stepper and `aria-current`.

### Refactor 8 - `AppShell.tsx`

Proposed extraction:

- `components/app-shell/AppSidebar.tsx`
- `components/app-shell/MobileTopBar.tsx`
- `components/app-shell/MobileNavigationDrawer.tsx`
- `components/app-shell/SchoolYearSelector.tsx`
- `components/app-shell/AppRouteTransition.tsx`
- `components/app-shell/UserMenu.tsx`

Rules:

- Preserve route/auth behavior.
- Replace raw school-year popover buttons with project primitives.
- Add reduced-motion support to route transitions.

## Page Rehaul Backlog By User Impact

### High Impact: Nontechnical Users

1. `/public/schedules`
   - Rebuild first viewport around `Find your class schedule`.
   - Hide schedule version/source metadata.
   - Make filters progressive.

2. `/my/schedule`
   - Rename to `My Official Schedule` or `Your Official Schedule`.
   - Replace `Published run` with publication status.
   - Add normal not-yet-published state.

3. `/my`
   - Rewrite unavailable state.
   - Keep one primary CTA.
   - Show only today/urgent faculty actions first.

4. `/my/room-preferences`
   - Simplify Step 2.
   - Improve slot legend.
   - Increase touch targets.

### High Impact: Scheduler/Admin Operators

5. `/`
   - Replace KPI wall with next-action dashboard.

6. `/timetable`
   - Add publish-readiness summary.
   - Move violation mechanics behind panels.

7. `/teaching-load`
   - Separate guided assignment flow from audit/autofill tools.

8. `/room-schedules`
   - Hide run selector behind advanced controls.
   - Rename empty states.

### Medium Impact: Data Setup Workflows

9. `/subjects`
   - Rename contract/owner copy.
   - Simplify row actions.

10. `/teachers`
   - Translate sync/source statuses.

11. `/sections`
   - Translate saved-data/mirror states.
   - Improve mobile filters.

12. `/map`
   - Clarify mode toolbar.
   - Add accessible labels/tooltips to icon controls.

13. `/audit`
   - Convert system health into setup/readiness blockers.

## Verification Plan

For each phase:

1. Run local typecheck/build for changed frontend files.
2. Run targeted route smoke checks.
3. Run mobile and desktop visual checks for changed pages.
4. For Tailnet-required verification, confirm Tailnet route availability first.
5. Update evidence artifacts when behavior changes.

Minimum QA route matrix after rehaul:

- Desktop: `/`, `/subjects`, `/teachers`, `/sections`, `/teaching-load`, `/timetable`, `/room-schedules`, `/map`, `/audit`, `/public/schedules`
- Mobile: `/my`, `/my/schedule`, `/my/preferences`, `/my/room-preferences`, `/public/schedules`

## Recommended First Implementation Prompt

Start with Phase 0 and the dashboard refactor guardrail:

1. Fix `/audit` tooltip import crash.
2. Remove hover-only audit actions.
3. Extract `Dashboard.tsx` into smaller components.
4. Replace dashboard KPI wall with a `NextActionPanel` while preserving existing data calls.
5. Verify `/` and `/audit` locally.

Reason: this gives immediate visible improvement, fixes a broken page, and establishes the pattern for the rest of the rehaul.

## Non-Goals For First Pass

- Do not rebuild the scheduler algorithm.
- Do not change backend API contracts unless a page cannot be made understandable without adding a presentation field.
- Do not copy SMART's oversized rounded cards, decorative blobs, or heavy login animations.
- Do not spend effort on cosmetic-only timetable polish before user-facing terminology and hierarchy are fixed.