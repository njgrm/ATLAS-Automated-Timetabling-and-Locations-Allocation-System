# Teaching Load UX/UI Audit — 2026-09-11

Status: `CORRECTIVE_STREAM_REQUIRED`

## Scope and safety

- Surface: live Tailnet `/teaching-load` using the authorized officer account.
- Runtime school year shown: `2030-2031`.
- Viewports: `1280x720`, `390x844`, and `640x360` as a 200%-zoom equivalent of `1280x720`.
- Interactions were observation-only: open Advanced grid, follow the guided
  Assign Teaching Load action, switch Teachers/Sections/Subjects, and open and
  close the mobile workload profile.
- No Teaching Load selection was changed, saved, discarded, reconciled, reset,
  generated, or published. No service or database was mutated.
- Browser console: zero warnings and zero errors during the audited path.

## Decisive rendered measurements

| Condition | Main working area | Content extent | Result |
|---|---:|---:|---|
| Desktop `1280x720`, teacher list | 254 px high | 3,673 px scroll height | Only about three teacher rows are visible at once |
| Desktop `1280x720`, workload inspector | 262 px high | 842 px scroll height | Inspector competes with the assignment workspace and needs its own long scroll |
| Mobile `390x844`, teacher list | 311 px high | 3,901 px scroll height | Usable only through a very long hidden-scrollbar list |
| 200%-zoom equivalent `640x360` | 24 px high, beginning at y=537 | 946 px scroll height | Main work area is below the viewport and functionally unreachable |

The document itself remains fixed to the viewport with hidden overflow. The
failure is caused by stacked shrink-zero header, readiness, rollover, repair,
filter, inspector, and footer regions consuming the available height before the
actual assignment surface receives space.

## Material findings

### TLUX-F01 — Critical — The manual assignment area is vertically starved

The main teacher editor receives only 254 px at a normal 720 px-high laptop
viewport. At the 200%-zoom equivalent it collapses to 24 px and begins below the
viewport. The page-level `overflow-hidden` prevents a global recovery scroll.

Source evidence:

- `atlas-client/src/pages/TeachingLoad.tsx:734` fixes the page height and hides
  overflow.
- `TeachingLoad.tsx:735-802` makes the multi-row command/readiness region
  shrink-zero.
- `TeachingLoad.tsx:807-829` adds rollover and repair surfaces above the grid.
- `TeachingLoad.tsx:955-965` always reserves the draft footer.

Required outcome: the primary assignment workspace shall retain a practical
minimum height at laptop sizes and shall remain reachable at 200% and 400%
reflow. Secondary guidance must collapse, move into disclosure, or merge into
one compact command region.

### TLUX-F02 — High — Too many simultaneous primary actions compete

The first viewport shows Suggest Teaching Load Draft, Reconcile Teaching Load,
Assign Teaching Load, Details, Advanced Grid, and the persistent Save area.
Three separate surfaces claim to be the next action. This is especially hard
for occasional or older scheduler users.

Required outcome: derive one page-level primary action from a single workflow
state. Suggest, reconcile, guided repair, and manual editing must be sequenced,
not presented as peer starting points.

### TLUX-F03 — High — “100% staffed” is semantically misleading

The live page reports `100% staffed` and `0 unassigned pairs` while also showing
five no-teaching-load faculty, seven above the weekly maximum, a next step saying
AGUILAR has no load, and a footer saying to build the 2030-2031 Teaching Load
first. Coverage may be 100%, but the faculty set is not fully and safely
staffed.

Source evidence: `WorkspaceToolbar.tsx:315-334` labels pair completeness as
`% staffed`.

Required outcome: name the metric for what it measures, such as
`Subject-section coverage`, and show separate zero-load and overload counts.
The page-level state and footer must not contradict the headline.

### TLUX-F04 — High — Guided assignment does not land on the promised teacher

On mobile, activating `Assign teaching load` for AGUILAR changed the URL/filter
to `facultyId=1&task=missing-load` and `No teaching load (5)`, but left the list
at scroll position zero. AGUILAR remained below the visible Edukasyon sa
Pagpapakatao group. The named task therefore still requires searching or
scrolling after the user accepted it.

Required outcome: the action must switch to Teachers, apply the minimum required
filter, expand the exact teacher, scroll the assignment editor into view, and
move keyboard focus to its heading or first safe control. Failure to locate the
teacher must produce an explicit recovery state.

### TLUX-F05 — High — The editor is embedded deep inside an accordion directory

All department groups are expanded, every teacher appears as a large card, and
the selected teacher's subject/grade/section editor is inserted inside that
long list. The selected AGUILAR editor appeared roughly 1,500 px into the
desktop list before filtering. This mixes navigation and editing in one scroll
and makes it easy to lose context.

Required outcome: use a master-detail workspace. Keep a compact searchable
teacher directory in one pane and a stable assignment editor for the selected
teacher in the primary pane. Department groups should not all expand by
default.

### TLUX-F06 — High — The persistent workload inspector consumes scarce space

At desktop, a fixed 320 px inspector leaves the teacher editor narrower while
also requiring an 842 px internal scroll. Its generous `p-6` and `space-y-8`
layout prioritizes explanatory metrics over the actual assignment task.

Source evidence:

- `TeachingLoad.tsx:929-952` reserves `w-80` for the inspector.
- `WorkloadInspector.tsx:104-165` uses large fixed header padding.
- `WorkloadInspector.tsx:165` starts a second long hidden-scrollbar region.

Required outcome: make workload context compact and task-adjacent. Use a
collapsible/resizable inspector or an on-demand sheet. The assignment editor
must receive the larger share of width and height.

### TLUX-F07 — High — Reflow and low-height accessibility fail

At `640x360`, the scrollable assignment region begins at y=537 and has only
24 px of computed height. Because the root clips overflow, keyboard, pointer,
and magnification users cannot reach the primary task normally. This violates
the intended WCAG 2.2 reflow behavior.

Required outcome: prove usable reflow at 200% and 400%, including 1280x720 at
200%, without content loss or two-dimensional page scrolling.

### TLUX-F08 — Medium — Hidden scrollbars remove orientation and affordance

The desktop uses separate 3,673 px and 842 px scroll regions, both with
`no-scrollbar`. Mobile has a 3,901 px list with the same treatment. Users cannot
see how much content remains or which pane owns scrolling.

Source evidence: `TeacherGridMode.tsx:344` and
`WorkloadInspector.tsx:165`.

Required outcome: expose clear scroll affordances, reduce nested scrolling, and
keep sticky context inside the pane that actually scrolls.

### TLUX-F09 — Medium — Dense typography is hostile to older users

The assignment hierarchy relies heavily on `text-[10px]`, `text-[11px]`,
`text-xs`, uppercase, wide tracking, muted colors, and compressed numeric
labels. Important differences such as teaching hours, credits, assigned count,
and section ownership become difficult to scan.

Required outcome: body/task text should generally remain at least 14 px, with
uppercase reserved for short labels. Core values must meet AA contrast and use
plain-language labels.

### TLUX-F10 — Medium — Grade rows contain nested interactive semantics

Each grade disclosure is a `div role="button"` containing a real Assign Grade
button. The accessibility tree exposes `GR7 ... Assign Grade` as a button that
contains another `Assign Grade` button, creating ambiguous keyboard and screen
reader behavior.

Source evidence: `SubjectRow.tsx:399-449`.

Required outcome: use separate sibling controls: one semantic disclosure button
and one assignment button. Each must have a unique accessible name and focus
target.

### TLUX-F11 — Medium — Mobile profile close loses focus

Opening the workload profile sheet correctly traps attention, but closing it
left focus on `BODY`, not on the `View profile` trigger. Keyboard and switch
users lose their place.

Source evidence: the sheet is controlled independently of a Radix SheetTrigger
at `TeachingLoad.tsx:972-1021`.

Required outcome: restore focus to the exact trigger after close and after an
Escape dismissal.

### TLUX-F12 — Medium — Context does not follow the selected tab

The same teacher-specific repair card remains above Teachers, Sections, and
Subjects. In Sections the default `Needs staffing` view reports no sections
need attention while the persistent card still commands assignment to a named
teacher. In Subjects, `All covered` sits below the same no-load warning. The
content is individually true but the combined workflow is incoherent.

Required outcome: either make the repair queue the page-level workflow and
navigate users to the correct mode, or make its content mode-aware. Do not keep
an unrelated task pinned over every tab.

### TLUX-F13 — Medium — Important readiness text is clipped or relegated to
horizontal strips

The term/readiness warning and source state compete in narrow horizontal rows.
At mobile width, the warning is visibly clipped while the complete explanation
exists only in the accessibility tree. The readiness strip itself uses
horizontal overflow with no visible scrollbar.

Required outcome: show one concise, wrapping state explanation with one repair
action. Move supporting details into a properly labelled disclosure.

### TLUX-F14 — Medium — The persistent disabled footer wastes working height

The Draft Status footer is always mounted even when there is no draft. At
desktop it consumes roughly the height of another teacher row; at mobile it
competes with the floating profile button. Repeating “Build Teaching Load
first” and “Save stays disabled” does not help the current manual task.

Required outcome: keep a compact dirty-state indicator when no edits exist and
expand to Undo/Discard/Save only when a draft change exists or a save failure
needs action. Preserve a stable save location once it becomes actionable.

## Exhaustive component and click-path audit

This second pass traced the active Teaching Load component tree, every rendered
control, mounted-but-unreachable components, local draft/history state, and all
write-capable handlers. Harmless live controls were exercised on Tailnet. The
staffing report and reconciliation preview were invoked only as read-only
previews; suggestion creation, assignment changes, resets, saves,
reconciliation apply, generation, and publication were not invoked.

### Control disposition matrix

| Surface / control | Current effect | Decision for corrective stream |
|---|---|---|
| Help | Opens four-step generic guidance | **Move** to the More menu or contextual first-use help; remove it from the primary command row |
| Suggest Teaching Load draft | Creates a persisted suggestion proposal and opens a separate review/apply modal | **Merge** into one state-driven `Build suggested draft` flow that uses the same draft review/save surface as manual edits |
| Open staffing audit | Runs a second report and reuses the suggestion summary modal in review-only mode | **Remove**; its useful counts belong in the compact status strip and filtered teacher list |
| Show teacher jump list | Changes its menu label, but no jump list is rendered | **Remove** with its dead state/component path |
| Mobile Teachers / Sections / Subjects menu items | Duplicate the always-visible tabs | **Remove** |
| Staffing mode radio group | Silently changes later suggestion/report behavior from a global overflow menu | **Move** into an advanced section of the suggestion flow, only if all three policies remain product requirements |
| Global Reset | Permanently clears the year's assignments after typed confirmation | **Remove from daily workspace**; keep only in an explicitly privileged maintenance/recovery surface |
| Teachers tab | Opens the primary teacher directory/editor | **Keep**, redesigned as master-detail |
| Sections tab | Opens a second inline assignment editor | **Keep as coverage/navigation**, but remove duplicate owner mutation or route it into the single assignment editor |
| Subjects tab | Opens a third coverage-only view backed by a separate school-1 request | **Remove as a top-level tab**; expose missing subject coverage as a filter/report within Sections |
| Above weekly max chip | Opens the staffing report rather than the seven affected teachers | **Keep metric, fix action** to filter and focus the exact offenders |
| Reconcile teaching load | Opens a destructive current-year bulk reconciliation workflow regardless of readiness | **Remove from the daily page**; year transition/carry-forward belongs in Year Setup and must fail closed |
| Repair primary action | Changes route/filter/selection, but does not reliably focus the promised editor | **Keep concept**, rebuild as the single state-derived primary action |
| Repair Details | Repeats the visible title/status plus generic instructions | **Remove** |
| Repair Skip | Reorders a local queue but resolves nothing and survives scope changes | **Remove** |
| Repair Find | Explains that the user should open the grid and use search | **Remove**; search is already visible |
| Advanced grid buttons | The same mode switch appears in the current task and next-items row | **Merge** to one secondary `Browse all` action |
| Show next items | Reveals three additional repair cards | **Keep only in guided empty state**; otherwise use filters and counts |
| Teacher search / status / department / load / sort | Filters the teacher directory | **Keep**, with common filters visible and advanced filters in one disclosure |
| Outside-department / unmapped switches | Filter candidate subjects or teachers | **Move** into an advanced filter disclosure with plain-language consequences |
| Department and teacher disclosure rows | Mix navigation, selection, and editor insertion in one long scroll | **Replace** with compact master-list selection |
| Row tools / Reset assignments | Clears all mutable assignments for the selected teacher into the draft without explaining scope | **Remove menu**; if retained, use one explicit `Clear this teacher's draft` action with confirmation and Undo |
| Select All Eligible / Unassign All | Applies across all grades; partial selection changes the label to broad `Unassign All` | **Remove broad all-grades action**; retain grade/section operations with explicit counts |
| Expand/collapse all grades | Expands a nested editor inside the teacher directory | **Remove with accordion-directory editor** |
| Assign/Unassign Grade | Applies a bounded grade batch | **Keep**, separated from the disclosure button and labelled with the affected count |
| Section cell | Toggles ownership; clicking another owner's cell can invoke an implicit two-way swap | **Keep only for unowned/current-owner toggles**; occupied rows require an explicit reviewed transfer |
| Tiny swap icon | Duplicates the occupied section-cell action | **Remove** |
| Section owner picker | Performs the same ownership mutation from a second editing surface | **Route to single editor or remove mutation** from Sections mode |
| Cross-department teaching switch | Immediately PATCHes the faculty record outside the Teaching Load draft/save model | **Remove from workload inspector**; manage as a separately labelled faculty eligibility setting |
| Workload profile / View profile | Duplicates a fixed desktop inspector and floating mobile sheet | **Merge** into one collapsible task-adjacent summary; remove floating overlay when the summary is already in the editor |
| Undo / Discard / Save footer | Owns the global multi-teacher draft | **Keep as sole draft authority**, mounted only when dirty/error; add atomicity or limit the save scope |

### TLUX-F15 — Critical — Reconciliation can preview a destructive empty-demand plan while readiness is blocked

The live 2030-2031 page reports `No persisted school-year term configuration`,
but `Preview reconciliation` remains enabled. The production preview returned
`Demand 0 pairs`, `Removed 265`, and a projected after-state of 42 zero-load
teachers. The confirmation input is then enabled and the client contains a
callable apply path. The warning and the action therefore contradict each
other, and an older scheduler can be guided into clearing the entire carried
Teaching Load because prerequisite demand is unavailable.

Source evidence:

- `TeachingLoadReconciliationPanel.tsx:63` defines `canPreview` from only
  school, year, and online state.
- `TeachingLoadReconciliationPanel.tsx:95-109` computes apply eligibility
  without reconciliation readiness.
- `TeachingLoadReconciliationPanel.tsx:174-181` enables preview despite the
  visible readiness blocker.

Required outcome: remove reconciliation from the daily Teaching Load page.
The year-transition workflow shall derive or carry forward demand in Year
Setup, and both preview and apply shall fail closed when term/demand authority
is incomplete. A zero-demand preview must never translate existing ownership
into mass retirement unless the operator is in a separately authorized
retirement workflow.

### TLUX-F16 — Critical — “Change owner” can silently exchange an unrelated section

Both the occupied teacher-grid cell and the Sections-mode `Change owner` picker
call `handleSwapRequest`. If the destination teacher already owns any section
for that subject, the handler takes `sectionIds[0]` and gives that unrelated
section back to the donor. The UI labels promise a transfer/change of owner,
but the final draft is an implicit two-way exchange whose second section was
never shown or selected.

Source evidence: `TeachingLoad.tsx:218-281` derives `sectionToGiveBack` from the
destination teacher's first subject section, then removes it from the
destination and adds it to the donor. `SectionGridMode.tsx:149-168` routes
`Change owner` through that same handler.

Required outcome: transfer exactly the section the operator selected. A
two-way exchange must be a distinct workflow that names both sections and both
teachers before confirmation. No array-order-selected section may be moved.

### TLUX-F17 — High — Draft, history, and repair state are not scoped to school/year

`draftAssignmentsByFaculty`, undo/redo stacks, selected repair item, skipped
repair IDs, filters, and dialogs survive data refreshes and active-year changes
while the page component remains mounted. `fetchData` replaces source rows but
does not clear the old draft or history. A rollover can therefore leave an old
year's local draft and Undo snapshots visible against a new year's faculty and
sections.

Required outcome: bind all mutable UI state to `{schoolId, schoolYearId}`. On
scope change, block navigation if a dirty draft needs a decision; otherwise
clear selection, hover, dialogs, repair skips, draft/history, and stale route
intent before rendering the new scope.

### TLUX-F18 — High — Save can partially persist a multi-teacher draft

The single global Save action loops over teacher drafts and sends one PUT per
teacher. If a later request fails, earlier teachers are already saved even
though the page reports one save failure and presents the remaining state as a
single draft. The button's promise is not atomic.

Source evidence: `TeachingLoad.tsx:166-205` awaits sequential per-faculty PUTs.

Required outcome: either add one server-transactional batch save for the
global draft, or constrain the editor and Save action to one teacher at a time.
The UI must report exactly which records committed if atomicity cannot be
provided.

### TLUX-F19 — High — Two active subviews still use school 1 instead of actor scope

The Subjects coverage tab calls `fetchSubjectCoverageSummary` without a school
argument; `coverage.ts` supplies `DEFAULT_SCHOOL_ID = 1`. The compact rollover
banner is also rendered without a school ID, so `RolloverGuidanceCard` uses its
default `schoolId = 1`. On another school, the page can show coverage or year
status from school 1 beside actor-scoped Teaching Load data.

Required outcome: remove all fallback school IDs. Prefer deriving coverage from
the already actor-scoped Teaching Load contract; otherwise pass the resolved
actor school and issue zero requests while it is unresolved.

### TLUX-F20 — High — The teacher jump-list button is a proven no-op

On Tailnet, choosing `Show teacher jump list` changed the next menu label to
`Hide teacher jump list`, but rendered zero subject jump buttons and changed no
working area. The only component that consumes `showJumpList` is the unreferenced
`AssignmentWorkspace`; the live page renders `TeacherGridMode` instead.

Required outcome: delete the menu item, `showJumpList`, `jumpListItems`, and the
unreferenced implementation unless a new master list provides a real,
tested replacement.

### TLUX-F21 — High — The overload action opens a contradictory report

The live `Above weekly max: 7` chip opens a modal stating `Complete Coverage`
and `everyone is within their workload capacity`, with zero kept, suggested,
or unresolved rows. It does not show or focus any of the seven overloaded
teachers. The modal is a suggestion-report surface, not an overload repair
surface.

Required outcome: clicking the metric shall select Teachers, apply the excess
or over-cap filter, show the exact count, and focus the first affected teacher.
Delete the duplicate staffing-report modal from the primary workflow.

### TLUX-F22 — High — “Review manually” discards the suggestion it promises to review

The Suggest action creates a persisted proposal. In its modal, `Review
manually` silently cancels that proposal, closes the modal, and opens the
unchanged grid; it never loads the suggested rows into the editable draft.
Likewise, `Suggest Teaching Load draft` is not the same draft controlled by the
page's Undo/Discard/Save bar.

Required outcome: one draft model shall own manual and suggested changes.
Previewing a suggestion may populate a reviewable local draft, but Apply/Save
must use the same visible confirmation, dirty-state, Undo, and error handling.
If that integration is not built, rename the action to `Preview suggestions`
and remove `Review manually`.

### TLUX-F23 — Medium — The Sections owner picker is a weaker duplicate editor

Sections mode supplies another ownership editor whose candidate list filters
only by department match. It does not visibly exclude inactive teachers or
explain capacity/qualification failures, and its `*` draft marker is derived
from whether a teacher has any effective assignments rather than whether that
teacher has a draft. This makes a second editing path both harder to trust and
harder to maintain.

Required outcome: use Sections for coverage diagnosis and navigation. Perform
the actual assignment in the single teacher/assignment editor with one shared
eligibility explanation and one draft state.

### TLUX-F24 — Medium — Reset and bulk-clear controls overlap dangerously

The page exposes global-year reset, teacher-level reset, subject-level
Unassign All, grade-level unassign, and individual section toggles. Their labels
do not consistently distinguish a local draft clear from an immediate server
write. The highest-impact reset lives in the ordinary More menu.

Required outcome: remove global reset from this workspace, remove the row-tools
reset menu, and retain only explicit scoped draft operations with affected
counts, confirmation proportional to impact, and Undo before Save.

### TLUX-F25 — Medium — Dead components and state preserve obsolete workflows

`AssignmentWorkspace`, `RosterSidebar`, and `TeacherIdentityStrip` have no
imports in the active client. `StaffingAuditSheet` is mounted but no active
handler sets `staffingAuditOpen` true. The autofill confirmation dialog state,
rotation sheet state, inspector state, subject search, section filter, and
teacher jump-list state likewise have no live consumer or reachable opener.

Required outcome: delete unreachable components, props, state, and callbacks
as part of the redesign. Their duplicate Save/Undo/reset and navigation logic
must not remain as a misleading alternative implementation.

### TLUX-F26 — Medium — Fuzzy Homeroom detection can protect the wrong subject

The client treats any subject whose name contains `homeroom` as system-assigned
and immutable in `SubjectRow` and `useAssignmentHistory`. The agreed authority
is the exact HG catalog identity; fuzzy display-name matching can incorrectly
lock a different subject and makes the rule diverge across layers.

Required outcome: consume one canonical scheduling-disposition/HG authority
from the subject contract. Do not infer exclusion or immutability from display
text.

### TLUX-F27 — Medium — Redo exists only as an invisible keyboard path

Undo is visible in the footer, but Redo is available only through Ctrl/Cmd+Y;
its only visible buttons live in the unreferenced `TeacherIdentityStrip`.
Discoverability and the active implementation disagree.

Required outcome: either expose Redo beside the sole Undo control with a clear
history scope, or remove the hidden shortcut/state and keep the draft history
model deliberately one-way.

## Corrective-stream product direction

The corrective stream should treat the page as a task workspace, not a
dashboard stacked above a directory:

1. One compact command header: page title, source/year state, one primary
   action, and a More menu.
2. One small workflow/status strip: truthful coverage, zero-load, overload, and
   unsaved-change counts.
3. One remaining-height workspace:
   - compact master list/search/filter pane;
   - stable selected-teacher or selected-section assignment editor;
   - optional collapsible workload context.
4. One save surface that expands only for dirty/error states.
5. Guided tasks navigate and focus the exact object they name.
6. Mobile uses the same selection/editor state in a full-width sheet or routed
   step, with focus restoration and no hidden or competing action layer.
7. Year transition and bulk reconciliation live outside the daily assignment
   workspace and fail closed when authoritative demand is unavailable.
8. One draft model and one assignment editor own suggestion, manual edits,
   transfer, Undo/Redo, discard, and Save.
9. Remove the dead/unreachable component family and every fallback school ID.

## Required verification for the future corrective candidate

- Rendered Tailnet or isolated authenticated fixture at `1440x900`,
  `1280x720`, `1024x768`, `390x844`, and 200%/400% reflow equivalents.
- At least 55% of a 720 px-high content viewport remains available to the
  primary assignment workspace when no modal is open.
- The primary editor never computes below 320 px high at ordinary desktop
  scale; low-height/reflow mode must provide a reachable single scroll instead
  of clipping it.
- Guided no-load action lands on, expands, scrolls to, and focuses the exact
  teacher.
- No nested interactive controls.
- Keyboard-only flow: select teacher, expand subject/grade, assign/unassign a
  section in a disposable state, review draft, undo, discard, and open/close
  profile with focus restoration.
- Visible scroll affordance and zero page-level horizontal overflow.
- Headline counts and lifecycle copy are mutually consistent for empty,
  populated, degraded-source, read-only history, dirty draft, saving, saved,
  and error states.
- A `Change owner` test proves exactly one selected section moves and no other
  section changes; a separate explicit exchange test names both sides.
- A school/year scope-change test proves drafts, history, skips, dialogs,
  selection, hover, and route intent cannot cross the scope boundary.
- A multi-teacher Save failure test proves atomic rollback or an exact
  partial-commit receipt; a generic failure toast is not sufficient.
- Reconciliation preview and apply dispatch zero requests while term/demand
  readiness is incomplete. A zero-demand negative control must not propose
  retirement of existing ownership.
- Multi-school tests prove coverage and rollover status never fall back to
  school 1.
- Source scan proves the removed jump-list, dead component family, duplicate
  staffing report, global reset menu, and fuzzy Homeroom detection are absent.
- Target sizes meet WCAG 2.2 minimums and the ATLAS 44 px touch convention on
  mobile.
- No Teaching Load, curriculum, generation, or publication mutation during
  visual QA unless a separate disposable fixture explicitly authorizes it.

## Verdict

`NO_GO_FOR_CURRENT_UX`. The underlying assignment controls exist, but the live
workspace is not ready for older or occasional scheduler users. The corrective
stream should begin after the term migration preview returns; it is otherwise
source-independent and may run while the EnrollPro developer is unavailable.
