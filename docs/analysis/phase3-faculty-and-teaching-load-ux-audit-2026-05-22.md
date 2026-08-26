# Phase 3 Faculty And Teaching Load UX Audit - 2026-05-22

## Purpose
This audit reviews the current `Faculty` and `Teaching Load` (`FacultyAssignments`) pages against:

- the scheduler-first direction established by the recent `Subjects` overhaul
- the current stakeholder workflow clarified in the Phase 3 subject and qualification reset stream
- ATLAS frontend guardrails in `AGENTS.md`

This is a code-and-contract audit of the current repo state. It is not a full live visual QA pass on Tailnet.

## Executive Verdict

### Overall
- `Faculty` is usable but visually and behaviorally behind the newer `Subjects` page.
- `Teaching Load` is powerful, but still too cognitively dense for schedulers.
- Both pages still expose too much internal qualification theory and too many small-text controls.
- The next improvement pass should focus on reducing cognitive load and clarifying workflow ownership, not just polishing styling.

### Readiness
- `Faculty`: acceptable as a roster page, not closure-grade UX
- `Teaching Load`: operationally capable, but still overwhelming and too technical
- Combined workflow: not yet "friendly to anyone" in the way the user requested

## Scope Of Audit

### Files inspected
- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/components/faculty-assignments/OverviewHeader.tsx`
- `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
- `atlas-client/src/pages/Subjects.tsx` as the current comparison baseline

### Audit lenses
- layout and visual hierarchy
- readability and information density
- discoverability of key actions
- workflow ownership and role clarity
- accessibility and input ergonomics
- consistency with the current `Subjects -> Teaching Load -> Timetable` flow

## Confirmed Gemini Findings

### 1. Visual drift is real
Gemini was correct that `Faculty.tsx` still feels like an older-generation page compared with `Subjects.tsx`.

Confirmed:
- `Faculty` does not use the newer sticky translucent header/filter language from `Subjects`.
- `FacultyAssignments` uses a dense split-pane workspace with visually cramped controls.
- `FacultyAssignments` still relies heavily on very small type sizes such as:
  - `text-[0.6rem]`
  - `text-[0.625rem]`
  - `text-[0.6875rem]`

Impact:
- the pages feel more "admin tool" than "scheduler workspace"
- scanning and error recovery take too much effort

### 2. Drilldown patterns are underused
Gemini was also right that the pages still overuse navigation or cramped inline detail instead of focused drilldown surfaces.

Confirmed:
- `Faculty` has no quick profile drilldown or side sheet
- `FacultyAssignments` still uses a `Breakdown` tooltip for important load details
- the assignment workspace still asks the user to parse too much directly in the main panel

Impact:
- users lose context while trying to inspect details
- critical information is hidden in interactions that are too small or too fragile

### 3. Loading and empty states are inconsistent
Confirmed:
- `Faculty` still uses a plain `Loading faculty...` row instead of structural skeletons
- empty states in `Faculty` are better than before, but still simpler and less guided than the new `Subjects` empty-state pattern
- `FacultyAssignments` does use skeletons in the left list, which is better

Impact:
- page quality feels inconsistent across the product
- the roster page still reads as legacy compared with Subjects

### 4. Filter ergonomics are weaker than Subjects
Confirmed:
- `Faculty` filters are inline and always visible, but not grouped into a clearer primary-toolbar vs secondary-filters pattern
- `FacultyAssignments` packs search, status chips, department, specialization, sort, unmapped-specs toggle, and load filters into the sidebar header
- the sidebar is trying to be both a navigator and a control center

Impact:
- the left rail in Teaching Load does too many jobs
- the workspace feels crowded before the user even selects a teacher

## Additional Findings Gemini Did Not Call Out Clearly Enough

### 1. Encoding and mojibake are still visible
This is a real polish and trust issue.

Observed in `Faculty.tsx`:
- `Table â€” component-level scrolling`
- `â€”` appears where a dash placeholder should render
- `Â·` appears in pagination separators

Observed in `FacultyAssignments` and related components:
- the product still carries tiny encoded and formatting inconsistencies from earlier prompt passes

Impact:
- makes the interface feel broken even when logic works
- lowers perceived quality immediately

Priority:
- high

### 2. `Faculty` still violates current input rules in places
Confirmed in `Faculty.tsx`:
- table header sort controls use raw HTML `button`
- error dismissal also uses a raw HTML `button`

Impact:
- breaks the stated project rule to route interactions through shared UI primitives
- increases style drift and accessibility inconsistency

Priority:
- medium

### 3. `Faculty` is missing a modern summary layer
The page acts as a table, but not as a roster workspace.

Missing or weak:
- no inline stat banner
- no clear total/active/excluded/unassigned snapshot at the top
- no quick profile sheet
- no stronger sync-state summary besides a small "Synced" line

Impact:
- page is usable, but not informative enough on first scan
- users must read the table to understand roster health

Priority:
- medium

### 4. `Teaching Load` still overexposes specialization-based qualification logic
This is now a workflow mismatch, not just a wording issue.

Confirmed in `FacultyAssignments.tsx` and `SubjectRow.tsx`:
- `departmentFilter` and `specializationFilter` both remain first-class filters
- `Unmapped Specs` remains a visible operator toggle
- subject grouping still uses:
  - `Qualified Based On Specialization`
  - `Outside Specialization`
- badges still say:
  - `Specialization Match`
  - `Outside Specialization`
- the autofill confirmation text still mentions specialization aliases

Impact:
- conflicts with the newer stakeholder-backed direction that qualification should default to department ownership
- keeps the scheduler trapped in qualification theory that is no longer their responsibility

Priority:
- critical

### 5. `Teaching Load` still mixes scheduler actions with admin repair actions too early
Confirmed:
- `Reset Global Load` remains in the top overview header beside everyday actions
- `View Staffing Needs` and `Auto-Fill Remaining` sit in the same action band as the reset
- the page still exposes global repair power at the same level as normal workflow actions

Impact:
- dangerous actions are too visually close to everyday work
- makes the page feel more intimidating than it needs to be

Priority:
- high

### 6. The left sidebar in `Teaching Load` is overloaded
The sidebar currently contains:
- search
- assignment status chips
- department filter
- specialization filter
- load sort
- unmapped-specs toggle
- load-state filter
- grouped faculty list

Impact:
- too many tiny controls are compressed into the area that should primarily help users find a teacher
- faculty navigation is visually drowned by filter chrome

Priority:
- high

### 7. Readability is still below scheduler-friendly threshold
This is one of the biggest problems on the Teaching Load page.

Examples:
- `text-[0.6rem]` for faculty ID badges and load percentages
- `text-[0.625rem]` for status chips, section metadata, policy numbers, header labels
- `text-[0.6875rem]` for key supporting info across both pages

Impact:
- dense information becomes hostile instead of helpful
- older users, touch users, and non-technical staff will fatigue quickly

Priority:
- critical

### 8. The load breakdown interaction is still too fragile
Confirmed:
- the `Breakdown` action opens a tooltip, not a persistent drilldown surface
- the tooltip contains operationally important data such as actual section-hour composition

Impact:
- hard to read
- easy to lose on mouse movement
- poor for touch and accessibility

Priority:
- high

### 9. Teacher detail is still fragmented
`Faculty` lacks a quick profile sheet.

`Teaching Load` shows some useful details for the selected faculty member, but still has gaps:
- no richer per-teacher contextual profile summary
- no lighter "quick look" flow before entering assignment changes
- no dedicated read-only section assignment inspection surface

Impact:
- users must commit to the heavy assignment page to inspect even basic roster details

Priority:
- medium

### 10. Workflow ownership is still visually muddled
Current product direction should be:
- `Subjects` = contract/catalog
- `Faculty` = roster source and sync
- `Teaching Load` = authoritative manual placement surface

But the Teaching Load page still visually mixes:
- qualification analysis
- repair operations
- assignment authoring
- staffing shortage diagnosis

Impact:
- users have to mentally infer what the page is "for"
- the page feels like a control room instead of a guided workflow

Priority:
- critical

## Page-By-Page Audit

## Faculty Page Audit

### What is working
- simple search and filter model
- clear sync action
- straightforward roster table
- dedicated action to open `Teaching Load`
- no obvious global-scroll architecture violation in current code

### What is weak
- toolbar still feels cramped and legacy
- no clear separation of primary actions vs optional filters
- no structural skeleton loading
- no quick profile sheet
- raw HTML buttons still present
- visible encoding issues reduce trust
- table-only presentation makes the page feel less helpful than Subjects

### Recommended direction
- adopt the `Subjects` header pattern
- add a profile/quick-look sheet
- add column-aware skeletons
- replace raw buttons with shared button primitives
- clean up encoding issues everywhere on the page
- keep the page primarily roster-centric, not assignment-centric

## Teaching Load Page Audit

### What is working
- strong core capability for editing and saving assignments
- left-nav plus right-workspace structure is directionally correct
- reset confirmation is typed and safer than a one-click destructive flow
- save/discard/undo/redo model is good
- grade-aware subject rows and section grouping are useful
- current load preview concept is valuable

### What is weak
- too much qualification and specialization complexity remains visible
- font sizes are too small across major parts of the page
- sidebar is over-filtered and visually crowded
- `Breakdown` tooltip should be a sheet or dedicated detail panel
- top action area mixes ordinary and destructive workflows
- subject grouping language is no longer aligned with the department-first qualification direction
- "Unmapped Specs" is not a scheduler-first filter anymore

### Recommended direction
- reset the page around department-based qualification
- move specialization mapping concerns out of the core workflow entirely
- reduce filter density in the sidebar
- make the left rail primarily a navigator
- promote a larger, calmer right-side profile and assignment context
- convert breakdown and staffing diagnosis into proper drilldown surfaces
- keep reset and repair actions visually separated from ordinary assignment work

## Accessibility And Inclusivity Audit

### Confirmed concerns
- excessive use of sub-11px effective text sizes harms readability
- tooltip-only detail delivery is weak for touch and keyboard users
- crowded control zones increase error likelihood
- the current Teaching Load left rail demands high visual precision

### Additional accessibility concerns
- the grouped faculty navigator likely needs stronger focus-state clarity once filters are reduced
- destructive actions need stronger spatial separation, not just red styling
- data density should rely more on hierarchy and progressive disclosure than micro-text

## Priority Ranking

### P0 - Must correct before calling the workflow friendly
- remove specialization-driven scheduler-facing qualification framing from Teaching Load
- reduce Teaching Load text density and micro-font usage
- replace `Breakdown` tooltip with a persistent detail surface
- stop treating the Teaching Load sidebar as both a navigator and a full filter console

### P1 - High-value next pass
- modernize Faculty header and filter language to match Subjects
- add Faculty quick profile sheet
- separate global repair/reset actions from normal Teaching Load actions
- remove encoding/mojibake from Faculty page

### P2 - Follow-up polish
- harmonize empty states and loading states
- refine load gauges and status presentation
- improve sync-state communication on Faculty

## Product Direction Decision

### Keep
- roster-first `Faculty` page
- assignment-authoring `Teaching Load` page
- save/discard/undo/redo model
- load-preview concept

### Change
- remove specialization-centered framing from Teaching Load
- demote or remove scheduler-facing unmapped-specialization tools
- reduce control clutter in the left rail
- move complex detail from tooltips into sheets or dedicated read-only detail views

### Do not do
- do not just "make it prettier" while keeping the same mental model
- do not keep tiny text as the primary way to fit more data on screen
- do not keep reset and repair actions in the same visual tier as ordinary daily actions

## Suggested Next Prompt Shape

The next prompt should be broader than a cosmetic pass and narrower than a full page rewrite.

It should target:
- `Faculty` page modernization to match the `Subjects` interaction standard
- `Teaching Load` qualification reset to department-first language and logic
- `Teaching Load` sidebar simplification
- replacement of tooltip-only breakdown patterns with persistent drilldown surfaces
- relocation or stronger separation of global reset and staffing-repair actions

## Final Conclusion

Gemini's audit was directionally right, but understated the deeper issue.

The biggest problem is not that `Faculty` and `Teaching Load` look older than `Subjects`.
The biggest problem is that `Teaching Load` still exposes too much system complexity directly to the scheduler.

If the goal is to make the system feel friendly and non-overwhelming, the next pass should reduce qualification theory, reduce filter clutter, increase text legibility, and make details easier to inspect without destabilizing the workspace.
