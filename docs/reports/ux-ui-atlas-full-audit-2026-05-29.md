# ATLAS UX/UI Full Audit - 2026-05-29

## Audit Scope

This report captures the read-only UX/UI audit of the ATLAS frontend before any redesign or implementation work. The audit covered route inventory, static code review, local rendered-page sampling, project design standards, and frontend accessibility guidance.

Live Tailnet browser QA was attempted against `https://njgrm.buru-degree.ts.net/login`, but the route returned `502`. Rendered checks therefore used the local ATLAS runtime as fallback, with static code review used to broaden coverage across routes.

No source files were changed during the audit that produced these findings.

## Evidence Basis

- Project standards reviewed: `docs/DESIGN.md`, `docs/DESIGN-INSPIRATION.md`, `docs/context7-library-map.md`, `docs/phases/faculty-mobile-wireframe-spec.md`, `.github/instructions/frontend.instructions.md`, and relevant ATLAS frontend/audit skills.
- Context7 references reviewed for shadcn/ui, Motion for React, and WAI-ARIA dialog/tooltip/focus practices.
- Local runtime sampled with ATLAS server on port `5001` and Vite client on port `5174`.
- Admin login succeeded locally with direct ATLAS credentials.
- Faculty login succeeded locally, but `/my` failed into a dashboard unavailable state.
- Local Vite proxy repeatedly timed out against EnrollPro settings at `100.120.169.123:5002`.
- `/audit` produced a runtime crash: `ReferenceError: TooltipProvider is not defined`.

## Executive Verdict

ATLAS is not ready for broad user release from a UX/UI standpoint. The interface has useful functional pieces, but it reads too much like an internal engineering console. The largest issues are not component-library gaps; they are hierarchy, wording, role fit, progressive disclosure, accessibility, mobile ergonomics, and maintainability.

The current UI often asks users to understand implementation details such as runs, mirrors, runtime context, contracts, upstream state, and hard/soft violations. For faculty, students, and low-tech operators, this creates avoidable cognitive load.

## Critical Findings

### C-01: Audit Page Runtime Crash

`atlas-client/src/pages/Audit.tsx` uses `TooltipProvider`, `TooltipTrigger`, and `TooltipContent`, but these symbols are not imported. The page crashes at runtime and cannot be considered releasable.

Impact:
- Prevents the audit page from serving its core purpose.
- Undermines trust in readiness and system-health surfaces.
- Blocks a credible UX gate for the rest of the product.

### C-02: User-Facing Pages Expose Internal System Metadata

Public and faculty schedule pages expose internal implementation concepts such as `Run #`, `Published run`, `School 1`, and numeric school-year IDs.

Examples:
- `atlas-client/src/pages/PublicPublishedSchedule.tsx` shows `Published Schedule Family`, `Run #`, `School Year`, and `School` badges.
- `atlas-client/src/pages/MySchedule.tsx` shows `Published run #` and source metadata.

Impact:
- Students and teachers cannot understand status at a glance.
- The product feels unfinished and system-centric.
- Support burden increases because nontechnical users must ask what these terms mean.

### C-03: Dashboard Has No Clear Primary Next Action

The admin dashboard opens with six equal-weight KPI cards plus lifecycle/checklist information. The page does not clearly answer: "What needs attention now?" or "What should I do next?"

Impact:
- Operators must infer priority from scattered stats.
- The dashboard can appear healthy while generation-readiness remains blocked.
- Setup work is presented as metrics rather than an actionable path.

### C-04: Error and Empty States Are Not Recovery-Oriented

Several pages fail into thin or technical states such as `Dashboard unavailable`, `No Generation Runs`, `No Saved Data`, or raw integration/cache messages.

Impact:
- Users cannot tell whether the issue is expected, temporary, fixable, or administrator-owned.
- Recovery actions are inconsistent.
- Faculty-facing failures feel alarming instead of guided.

### C-05: Mobile Touch Targets and Dense Toolbars Are Weak

Several toolbars use `h-7`, `h-8`, or icon-only controls. Examples include room schedules, map controls, timetable panels, audit rows, and teaching-load controls.

Impact:
- Controls are difficult to use on mobile.
- Operators can mis-tap high-impact actions.
- Faculty and scheduler workflows do not consistently meet touch ergonomics expectations.

### C-06: Accessibility and Discoverability Problems Repeat

Examples:
- Audit page actions are hidden behind hover-only `opacity-0 group-hover:opacity-100` behavior.
- Faculty step badges are rendered as visual spans rather than a semantic stepper.
- The shared faculty header shrinks and hides orientation context while scrolling.
- Reduced-motion handling is not clearly applied globally.

Impact:
- Touch and keyboard users may miss actions.
- Screen-reader users do not get the same workflow orientation.
- Motion-sensitive users may receive unnecessary animated layout changes.

## Major Findings

### M-01: The Product Language Is Too Technical

Frequently exposed terms include:

- upstream
- runtime
- mirror
- saved data
- contract
- run
- source
- hard violation
- soft violation
- generation run
- split-brain
- quarantine
- sync contract

Recommendation: establish a product-language layer that translates implementation state into role-specific meaning. For example, `Run #42` becomes `Official schedule published on [date]`; `upstream unavailable` becomes `Enrollment data cannot be reached right now`.

### M-02: Too Many Pages Present All Controls at Once

Subjects, teachers, teaching load, sections, room schedules, map editor, timetable, and audit surfaces expose dense toolbars, badges, filters, and secondary controls in the first viewport.

Recommendation: use progressive disclosure. Default pages should show the primary task, current state, and one next action. Advanced/debug options should be collapsed or role-gated.

### M-03: Card Usage Creates Visual Noise

The app frequently wraps metrics, previews, summaries, and page regions in cards. This makes screens feel busy without necessarily improving comprehension.

Recommendation: reserve cards for repeated items, modals, framed tools, and meaningful grouped content. Use inline status banners and section bands for page-level information.

### M-04: Public and Faculty UX Need Stronger Role Separation

Faculty and student pages still inherit operator/system language. Their workflows should be calmer, more direct, and less configurable than scheduler/admin tools.

Recommendation:
- Faculty pages should focus on today's actions, official schedule status, and room requests.
- Student pages should focus on finding a section schedule quickly.
- Scheduler/admin pages can expose more detail, but only after plain-language summaries.

### M-05: Component Size Violations Create UX Risk

The frontend file-size guardrail says no single React component file should exceed 1000 lines. Current violations include:

| File | Approximate Lines | Risk |
|---|---:|---|
| `atlas-client/src/pages/FacultyAssignments.tsx` | 2825 | Very high |
| `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx` | 1449 | Very high |
| `atlas-client/src/components/timetable/modals/ScheduleReviewDialog.tsx` | 1437 | Very high |
| `atlas-client/src/components/timetable/LeftRailContent.tsx` | 1138 | High |
| `atlas-client/src/components/ManualEditPanel.tsx` | 1125 | High |
| `atlas-client/src/pages/Dashboard.tsx` | 1101 | High |
| `atlas-client/src/pages/FacultyRoomPreferences.tsx` | 1087 | High |
| `atlas-client/src/components/AppShell.tsx` | 1064 | High |

Impact:
- UX changes become hard to reason about.
- Page behavior, data loading, and presentation are coupled.
- Small visual fixes can cause unrelated regressions.

## Route-by-Route Findings

### `/login`

Strengths:
- Visually polished compared with the rest of the app.
- Clear direct login path exists.

Weaknesses:
- Desktop decorative panel dominates the actual login task.
- The page is too promotional for low-tech faculty who just need to sign in.
- Password accessible-name ambiguity appears in tests because `Password` also matches `Show password`.

Recommendation:
- Make the login form the visual priority.
- Reduce decorative feature cards.
- Keep helper text short and action-oriented.

### `/`

Strengths:
- Shows setup domains and lifecycle state.
- Uses dashboard cards and checklist structure consistently.

Weaknesses:
- No obvious primary action.
- Six equal-weight stat cards compete with lifecycle state.
- `Upstream unavailable` is technical.
- Dashboard can look useful while generation-readiness remains blocked.

Recommendation:
- Convert the dashboard into an action center with a top `Next required step` panel.
- Move secondary metrics into an inline status band or expandable details.

### `/subjects`

Strengths:
- Search, filter, and table affordances are present.
- Uses shadcn-style controls for most interactions.

Weaknesses:
- Too many small controls and icon-only actions.
- `Sync Offering Contract`, `Scope & Owner`, and `Room Pref.` are technical.
- Empty state tells users to sync a contract instead of explaining what is missing.

Recommendation:
- Rename system terms into scheduling language.
- Group advanced subject metadata behind row details.
- Make sync state a plain-language banner.

### `/teachers`

Strengths:
- Roster tooling is fairly complete.
- Status badges and sync controls are visible.

Weaknesses:
- Integration state language is too prominent.
- `Verified with EnrollPro`, `Working from saved data`, and `Verifying runtime` require system knowledge.
- Empty state references bridge mechanics.

Recommendation:
- Show user impact first: `Teacher list is current`, `Showing saved teacher list`, or `Cannot reach enrollment service`.

### `/teaching-load`

Strengths:
- Powerful operator workspace.
- Supports coverage, assignment, audit, and autofill actions.

Weaknesses:
- First viewport is dense and expert-only: `READ-ONLY`, `TOTAL COVERAGE`, `GRID MODE`, `STAFFING AUDIT`, `AUTO-FILL`.
- Too many controls have equal visual weight.
- Incident/debug terms such as split-brain and quarantine are not user-facing language.

Recommendation:
- Introduce a guided default mode and collapse expert controls.
- Start with `Unassigned classes`, `Teachers needing load review`, and `Next action`.

### `/sections`

Strengths:
- Home-room assignment is visible and operational.
- Map browsing exists.

Weaknesses:
- `Saved Data`, `atlas mirror`, and assignment-progress instrumentation feel internal.
- Filter/toolbars are tight on mobile.
- Empty/unavailable state lacks clear ownership.

Recommendation:
- Use plain source status and a simpler mobile flow for home-room assignment.

### `/faculty/preferences`

Strengths:
- Mobile layout is more role-aware than many admin pages.
- Bottom action bar exists for draft/final actions.

Weaknesses:
- Sensitive labels such as `Pregnancy support` and `Physical ailment / mobility support` are too blunt.
- Privacy reassurance is not prominent enough.

Recommendation:
- Rename to inclusive support categories.
- Add clear privacy and scheduler-use wording.

### `/my/room-preferences`

Strengths:
- Three-step structure is directionally correct.
- Fixed bottom action area exists.

Weaknesses:
- Step 2 is cognitively heavy: day filters, free/swap/all filters, conflict checks, and slot selection appear together.
- Several controls are below comfortable mobile touch-target size.
- Stepper semantics need accessibility hardening.

Recommendation:
- Use a guided slot picker with a plain legend.
- Increase touch targets.
- Use `aria-current` and semantic step status.

### `/faculty/preferences` Admin Review

Strengths:
- Table review flow exists.
- Status filters and reminder flows are available.

Weaknesses:
- Raw tab buttons appear instead of standardized primitives.
- `Dev: Submit All Drafts` appears in the UI and should not be present for operators.
- Table-first review is efficient but not especially readable.

Recommendation:
- Remove dev-only affordances from normal UI.
- Add a review queue summary with next action.

### `/my`

Strengths:
- Mobile faculty dashboard has a clear CTA: `Manage My Room Requests`.
- Dashboard includes action queue and upcoming classes.

Weaknesses:
- Runtime failure falls into `Dashboard unavailable` without enough user-facing explanation.
- Some summary cards still feel system-centric.

Recommendation:
- Rework failure states around likely user meaning: connection issue, schedule not ready, or data not assigned.

### `/my/schedule`

Strengths:
- Uses official published-schedule framing.
- Includes offline/saved snapshot concepts.

Weaknesses:
- Exposes `Published run`, school-year IDs, and source metadata.
- Empty message says `published run exists`, which is technical.

Recommendation:
- Rename to `Your official schedule`.
- Hide source metadata behind an advanced details affordance.

### `/public/schedules`

Strengths:
- Public access exists.
- Section, teacher, and room browsing capabilities are present.

Weaknesses:
- `Published Schedule Family` is unclear.
- Search is not the first obvious action.
- Run/source/school ID badges dominate the top of the page.
- Filters should be progressive on mobile.

Recommendation:
- Lead with `Find your class schedule` and a large search field.
- Hide metadata and advanced modes by default.

### `/timetable`

Strengths:
- Scheduler tooling is deep and capable.
- Review, violations, requests, pinned entries, locks, and manual edits exist.

Weaknesses:
- Technical terms dominate: violations, hard/soft, pre-generation draft, run, swap-safe placement.
- Left rail concepts need plain summaries.
- Mobile first viewport can be mostly chrome/loading, not task content.

Recommendation:
- Add a plain-language readiness header: `Can this schedule be published?` with blockers and next action.
- Keep detailed violation mechanics in drill-down panels.

### `/timetabling/how-it-works`

Strengths:
- Attempts to educate users.

Weaknesses:
- Still leans toward policy/constraint language.
- Should explain outcomes before algorithm mechanics.

Recommendation:
- Reframe around operator questions: `Why did this class move?`, `Why is this teacher blocked?`, `What stops publishing?`.

### `/room-schedules`

Strengths:
- Supports room, teacher, and section schedule inspection.
- Inline stat banner is a better pattern than huge metric cards.

Weaknesses:
- Toolbar exposes `Run ID`, `Latest`, template variants, and occupancy mode all at once.
- Empty state says `No Generation Runs`.
- Several controls are small.

Recommendation:
- Default to `View schedules` and hide run selection under advanced controls.
- Rename empty state to `No schedule has been generated yet`.

### `/map`

Strengths:
- Campus map editing and building/room management are valuable.

Weaknesses:
- Too many icon-only and small controls.
- Mode clarity is weak between select/add/draw/edit/save.
- Some raw button patterns and title attributes appear in related components.

Recommendation:
- Use a clear mode toolbar, larger controls, and tooltips.
- Separate map editing from room detail management more clearly.

### `/audit`

Strengths:
- Conceptually valuable as a readiness surface.

Weaknesses:
- Crashes due missing tooltip imports.
- Uses hover-only actions.
- System-health wording is technical.

Recommendation:
- Fix crash first.
- Rebuild as `What is blocking setup?` with user-facing severity and remediation.

## Rehaul Priorities

1. Fix runtime blockers and visibly broken pages.
2. Establish role-specific information architecture.
3. Replace system-centric copy with user-task language.
4. Standardize empty/error/offline/sync states.
5. Introduce progressive disclosure for advanced controls.
6. Increase mobile touch targets and reduce toolbar density.
7. Add accessibility semantics for steppers, dialogs, hover-only actions, and reduced motion.
8. Refactor oversized React files before major redesign work.

## Release Gate Decision

UX/UI broad-release gate: NO-GO.

Audit-to-planning gate: GO. The findings are sufficiently clear to plan a major UX/UI rehaul, but live Tailnet visual approval remains blocked by the `502` Tailnet issue.