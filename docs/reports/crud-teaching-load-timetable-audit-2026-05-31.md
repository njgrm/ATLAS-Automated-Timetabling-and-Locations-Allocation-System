# CRUD, Teaching Load, and Timetable Audit - 2026-05-31

## Scope

This report saves the latest source-level UX/system audit findings and expands them around four requested areas:

- table and CRUD readability across admin pages
- Teaching Load terminology, especially overload and credited-workload presentation
- whether `FacultyAssignments.tsx` is still active
- a plan for timetable-side Teaching Load quick fixes and automatic reflection of policy/assignment changes

This was a source audit, not a live browser visual QA gate. The implementation ladder in this document is now finalized at the planning level, but it still requires prompt-by-prompt execution and evidence before any stage can be treated as complete.

## Executive Summary

The active Teaching Load page is `TeachingLoad.tsx`, reached from `/teaching-load`. The legacy `/assignments` route redirects to `/teaching-load`, and the old `FacultyAssignments.tsx` page was stale. The stale page should stay removed to prevent future agents from editing the wrong surface.

The Teaching Load feature is functionally stronger than its copy implies, but the current labels blur the difference between actual teaching hours, advisory or ancillary credited load, overload approval, and the hard cap. The UI should make those concepts explicit before adding more timetable-side repair controls.

The timetable workflow currently concentrates many changes after generation. ATLAS needs a clearer pre-generation planning lane, a timetable-side Teaching Load quick-fix panel, and a freshness model so policy or assignment changes are reflected before generation and safely marked after generation or publish.

Overall gate: **NO-GO** for claiming the current CRUD, Teaching Load, and timetable workflow as low-tech-user-ready. The system has strong functional coverage, but the workflow is still too dense and fragile for school schedulers who need fast recovery during setup or semester changes.

## Route and Stale Page Verification

Verdict: `FacultyAssignments.tsx` was stale and has been deleted.

Evidence:

- `atlas-client/src/App.tsx` lazy-loads `./pages/TeachingLoad` for `/teaching-load`.
- The legacy `/assignments` route redirects to `/teaching-load`.
- Workspace search found no active import of `atlas-client/src/pages/FacultyAssignments.tsx`; matches were only the stale file itself and historical markdown references.
- Active Teaching Load work now lives in `atlas-client/src/pages/TeachingLoad.tsx`, `atlas-client/src/hooks/useTeachingLoadData.ts`, `atlas-client/src/hooks/useTeachingLoadUI.ts`, and `atlas-client/src/components/faculty-assignments/*`.

Cleanup decision:

- Delete the unused monolith to avoid future agents auditing or editing the wrong page.
- Keep API/domain names such as `/faculty-assignments` where they represent backend resources rather than the UI page name.
- Use `Teaching Load` for operator-facing copy and implementation prompts.

## Source-Level UX Gate Findings

### Gate Decision

The source-level UX audit says **NO-GO** for calling the UX rehaul complete. The rehaul clearly improved consistency: the shell, shadcn/Radix usage, lifecycle framing, faculty mobile layouts, source-state badges, and skeleton states are real progress. The system still has trust, cognitive-load, and performance risks that would show up quickly with low-tech school staff.

This pass did not include live browser screenshot QA, so it is a code and workflow audit rather than a full visual evidence gate.

### Top Findings

1. Freshness and trust are the biggest user risk. Faculty schedules and room-request bootstrap data use 24-hour caches keyed mostly by school year, not by published run ID, so a teacher can see an old same-day schedule or stale room request state after a new publish. Representative source points: `MySchedule.tsx:18` and `FacultyRoomPreferences.tsx:57`.
2. The hardest workflows are still expert-first. Teaching Load, Room Requests, Audit, and Schedule Review expose powerful controls but too much jargon: `hard conflicts`, `soft violations`, `split-brain`, `coverage mode`, `run`, `gate`, and `stale run data`. A nontechnical teacher or school admin can complete the flow only after explanation, which fails the first-action-under-5-seconds bar.
3. Several frontend files violate or approach the 1000-line guardrail. The largest at audit time were `FacultyAssignments.tsx` at 2825 lines, `ScheduleReviewWorkspace.tsx` at 1449 lines, `ScheduleReviewDialogs.tsx` at 1437 lines, `LeftRailContent.tsx` at 1138 lines, `ManualEditPanel.tsx` at 1125 lines, and `FacultyRoomPreferences.tsx` at 1025 lines. `FacultyAssignments.tsx` has since been deleted as stale, but the other large files remain maintainability and render-performance risks.
4. Backend payload shape is causing frontend heaviness. Published faculty, section, and room schedule endpoints load the full published schedule payload and filter afterward in `published-schedule.service.ts:300`. That works now, but it scales poorly and delays the exact teacher/student views that need to feel instant.
5. Global data loading is too waterfall-heavy. Dashboard data starts with a small `Promise.all`, then chains faculty, school year, sections, run, and violations fetches later in `useDashboardData.ts:53`. Users wait for slow paths and get inconsistent partial states.
6. Design-system rules still leak. Raw `<button>` uses and `title=` hover hints remain in user-facing files, including faculty room request and officer review surfaces. One concrete example is quick reason chips in `ConflictInspector.tsx:83`; these should use `Button`, `Tooltip`, `Popover`, or visible helper text.

## Admin Workflow Audit

Dashboard is the strongest admin page conceptually: it frames setup, preferences, generation, review, and publish in a way school staff can follow. The missing pieces are drilldowns, a refresh action, and clearer `why this blocks generation` explanations.

Sections, Subjects, and Teachers are usable for trained staff, but not yet friendly for first-time school admins. They need bulk actions, persistent field help instead of tooltip-only guidance, server-side pagination/search, and clearer source freshness. Subject setup especially needs advanced curriculum metadata hidden by default.

Teaching Load is the highest-risk admin workflow. It is too dense, too stateful, and too jargon-heavy for low-tech users. The right direction is a guided `Coverage Repair` mode for normal users and an `Advanced staffing controls` mode for expert schedulers.

Map and room setup is visually decent but still assumes too much spatial and technical confidence. Room capacity validation, batch reorder, upload progress, clear teaching-space visibility, and unsaved-change warnings would make it safer.

Audit and Schedule Review are lifecycle-correct but too passive. The Audit page should become a repair console: each blocker should say what it blocks, why it matters, and open the exact fix flow.

## Teacher Workflow Audit

My Dashboard feels welcoming and mobile-aware. The main issue is stale data and lack of a happy-path refresh action.

My Schedule is readable, but trust is fragile. The `Live` or `Saved snapshot` badge is too low on the page, there is no print/PDF affordance, and the cache can outlive a same-day publish.

Support Preferences is the clearest teacher form. It still needs pre-lock disabling before submit, an offline queue like room requests, and a persistent `what happens next` confirmation after save/submit.

Room Requests is the biggest teacher UX challenge. The three-step structure is good, but `swap`, `hard conflict`, and `minor note` need plain-language definitions inline. Hard-conflict submits should use a final review Drawer with explicit acknowledgement. Outbox sync status should be visible as `2 requests waiting to send`, not hidden behind toast behavior.

## Performance Plan

1. Add `runId` and `publishedAt` to faculty cache keys and invalidate schedule/room-request snapshots on publish or room-decision events.
2. Replace full-payload published entity endpoints with filtered service queries for faculty, room, and section schedules.
3. Add a single dashboard/readiness summary endpoint so the dashboard is not composed from many independent client fetches.
4. Add server-side pagination/search for subjects, faculty, sections, preference reviews, room requests, and violations.
5. Virtualize large grids and lists in Teaching Load, Schedule Review side rails, Room Schedules, and public schedule selectors.
6. Extract oversized React files into page containers plus focused components, then memoize heavy row components.
7. Standardize request dedupe, retry/backoff, cancellation, and stale-state labels across pages.

## Recommended Order

1. Fix trust and freshness first: run-aware cache invalidation, visible sync queue counts, and teacher decision notifications.
2. Reduce cognitive load next: glossary/help, plain conflict copy, guided admin setup, and audit fix CTAs.
3. Then handle performance and maintainability: backend endpoint shape, pagination, virtualization, and component extraction.

Overall, the rehaul gave ATLAS a much better visual and structural foundation. The next pass should make it feel less like a powerful scheduling console and more like a calm school workflow where each user always knows what is current, what to do next, and what happens after they press the button.

## Table and CRUD Audit

### Current Strengths

- `AdminWorkspaceFrame`, `AdminSearchFilterToolbar`, `AdminTableShell`, and `AdminStatePanel` provide a consistent page frame.
- Subjects, Sections, and Teachers expose clear source-state chips and top-level stats.
- CRUD flows generally use shadcn/Radix primitives and confirmation dialogs instead of raw native controls.
- Sections has a useful inline home-room picker and local offline queue behavior.
- Subjects has safer archive/delete distinction and coverage drilldown links into Teaching Load.

### Readability Problems

1. Tables are still hand-built per page. The shared shell wraps custom `<table>` markup, but columns, density, action behavior, row status, empty states, mobile behavior, and pagination are duplicated or inconsistent.
2. Rows are visually dense. Many rows use uppercase, tiny text, multiple badges, icon-only actions, and hover-only explanations at once.
3. CRUD actions are not always task-ranked. The most common next action competes with profile/details icons, dropdown menus, coverage icons, archive/delete actions, and secondary links.
4. Mobile and narrow desktop fallbacks are not yet a first-class table pattern. The tables rely on horizontal density rather than a standard card/list fallback.
5. Page-level pagination is mostly client-side. That is acceptable for small pilot data, but it will not scale with many subjects, sections, teachers, requests, audit rows, or violations.
6. Forms expose too much advanced scheduling metadata at once. Subject add/edit is functional but asks for identity, weekly time, grades, program scope, owner departments, rotation fields, inter-section behavior, room type, and room features in one modal.
7. CRUD success/failure feedback is often toast-first. Low-tech users need persistent row-level or form-level confirmation for changes that affect generation.

### Recommended Shared Pattern

Build a shared `AdminDataTable` pattern before rewriting individual pages.

Minimum behavior:

- Standard table header with visible sort state and plain-language column labels.
- Compact row primary/secondary hierarchy: name/title first, status second, metadata third.
- Row action contract: one visible primary action, secondary actions in a menu, destructive action separated.
- Built-in skeleton, empty, error, cached-data, and no-results states.
- Footer with page count, page-size selector, and server-pagination hooks.
- Mobile/narrow fallback that renders rows as scannable cards with the same action contract.
- Accessible labels for icon-only actions and tooltips only for supplemental help, not required understanding.

Recommended CRUD pattern:

- Use right-side Sheet for inspect/edit when the user needs context from the list.
- Use Dialog for short create/confirm flows.
- Split advanced subject/scheduling fields under an `Advanced scheduling rules` disclosure or tab.
- Show persistent dirty-state and save-result banners inside the form, not only toasts.
- Make destructive flows explain downstream impact: generation, Teaching Load, published schedules, and historical records.

Priority pages:

1. `/teaching-load`: highest complexity and generator impact.
2. `/timetable`: highest workflow impact and recovery pressure.
3. `/subjects`: strongest CRUD density and advanced-field exposure.
4. `/sections`: inline home-room edits and offline queue need standardized save visibility.
5. `/teachers`: mostly readable, but load wording must align with Teaching Load.
6. `/audit`: should continue moving toward fix-oriented actions rather than a passive report.

## Teaching Load Wording Audit

### Current Model Found in Source

- `STANDARD_WEEKLY_TEACHING_HOURS = 30`.
- `MAX_WEEKLY_TEACHING_HOURS = 40`.
- `CLASS_ADVISER_EQUIVALENT_HOURS = 5`.
- `actualTeachingHours` is based on credited teaching minutes after rotation-family peak-term logic.
- `creditedTotalHours = actualTeachingHours + advisory/ancillary equivalent hours`.
- `overloadHours = creditedTotalHours - 30`, floored at zero.
- `overCapHours = creditedTotalHours - 40`, floored at zero.

### Wording Risks

1. `deriveLoadStatus()` returns status `overload-allowed` for exactly 30 hours but label `Compliant`. The inspector maps `overload-allowed` to amber/orange, so exactly-standard load can look like an overload warning.
2. The filter says `Optimal (25-30h)`, while the load status helper treats anything under 30 as `Below Standard`. That is semantically inconsistent.
3. `Overload Allowed` sounds like approval has already been granted. If the system has no approval record, the safer wording is `Overload needs approval` or `Above standard`.
4. `Credited` is short but not precise enough. Users need to know whether it includes advisory and ancillary equivalents.
5. `Remaining` can be misread. It currently appears to mean remaining capacity up to the teacher's max, not remaining capacity to the 30-hour standard. Both numbers matter.
6. Teacher rows sometimes show percent load and sometimes hours for placeholders. This makes row scanning inconsistent.
7. `Load Status` is used as a label for a percent value, not a status. That should be `Credited load` or `Used capacity`.

### Proposed Terminology

Use these terms consistently across Teaching Load, Teachers, Timetable, Audit, and fix suggestions:

| Term | Meaning | Recommended UI Label |
|---|---|---|
| Teaching hours | Class teaching time after rotation-family peak-term logic | `Teaching hours` |
| Equivalent hours | Advisory and ancillary credits | `Advisory/ancillary credit` |
| Credited workload | Teaching hours plus equivalent hours | `Credited workload` |
| Standard load | Target weekly teaching load, currently 30 hours | `30h standard` |
| Available to standard | Hours before reaching 30 credited hours | `To standard` |
| Legal cap | Maximum allowed weekly credited workload, currently 40 hours | `40h cap` |
| Available to cap | Hours before reaching 40 credited hours | `To cap` |
| Above standard | More than 30 and up to 40 credited hours | `Above standard` |
| Over cap | More than 40 credited hours | `Over cap` |

Status recommendation:

- `< 25h`: `Light load` or `Needs assignments`.
- `25h to <30h`: `Near standard`.
- `30h exactly`: `At standard`.
- `>30h to <=40h`: `Above standard - approval needed` unless an approval flag exists.
- `>40h`: `Over cap - must fix`.

The UI should show both:

- `Credited workload: 32.5h`.
- `2.5h above standard, 7.5h below cap`.

That is clearer than a single `Remaining` number.

## Timetable and Teaching Load Change Audit

### Current State

- `/timetable` has generated-run view, pre-generation draft, policy, map, room/building, and manual-edit modes.
- Policy can be opened inside the timetable page and saves via `SchedulingPolicyPane`, then calls a refresh handler.
- Manual edits can change selected entry time, room, or faculty through preview/commit flows.
- There is no embedded Teaching Load quick-fix surface.
- Teaching Load changes live on `/teaching-load`, so schedulers must leave the schedule review context for assignment corrections.
- Generated runs are snapshot-like. Changing policy or Teaching Load does not automatically re-materialize the displayed generated table.

### Risk

The current split makes setup corrections feel fragile:

- A scheduler notices a bad assignment inside the timetable.
- They must leave the timetable, find the same subject/section/teacher in Teaching Load, save there, come back, refresh/regenerate, and infer whether the schedule changed.
- Mid-semester assignment changes are not framed as a controlled schedule revision, so it is unclear whether the generated/published table is historical truth, editable draft truth, or live recomputed truth.

### Recommended Product Model

Do not silently mutate a generated or published timetable whenever Teaching Load or Policy changes. That would be surprising and risky for auditability.

Instead, use a versioned impact model:

1. Teaching Load and Policy remain source-of-truth inputs.
2. Generated runs remain snapshots created from a specific input version.
3. When inputs change after a run, the timetable shows an `Input changes detected` banner.
4. The scheduler can open an impact preview showing affected teachers, sections, subjects, rooms, and violations.
5. The scheduler chooses one controlled action: regenerate, create a revision draft, or apply a scoped manual repair.
6. Published schedules require a revision/publish workflow with audit trail and notifications.

### Quick Access Teaching Load Component Proposal

Add a timetable-side `Teaching Load Quick Fix` surface.

Recommended first version:

- Entry point in `/timetable` header and selected-entry right panel.
- Opens as a right Sheet or resizable side panel, not a full page navigation.
- Defaults to the selected timetable entry's subject, section, teacher, and school year.
- Shows current owner, eligible teachers, credited workload before/after, and generation impact warning.
- Allows one scoped action: reassign this subject-section owner.
- Saves through the existing Teaching Load assignment endpoint and refreshes timetable reference data.
- After save, shows `Assignments changed since Run #N` and offers `Preview impact` / `Regenerate` rather than silently changing every cell.

Second version:

- Add bulk fixes for all unassigned sections for the selected subject.
- Add safe transfer between two teachers with before/after credited workload.
- Add `Create revision draft` for post-generation or mid-semester changes.

### Automatic Reflection Rules

Use different rules by state:

- Before generation: Teaching Load and Policy changes should automatically refresh the pre-generation demand queue and input health indicators.
- During generation: lock changes or show a clear `generation in progress` lock.
- After generation but before publish: changes should mark the run stale and offer impact preview/regenerate/manual scoped repair.
- After publish: changes should create a revision draft with effective date and notification requirements; do not mutate published truth silently.
- During the semester: scheduler changes should be modeled as versioned schedule revisions, not hidden edits to the old run.

## Resolved Product Decisions

These decisions are now locked for the next implementation sequence:

1. Post-run input changes shall mark the run stale only. ATLAS must never auto-regenerate because regeneration can wipe out manual timetable repair work. The timetable should show `Input changes detected` and offer `Preview Impact`, `Manually Repair`, and `Regenerate Draft`.
2. Mid-semester published changes shall create a new published revision with an effective date. ATLAS must preserve historical schedule truth for DepEd audits, payroll, grading, and teacher-work records.
3. Overload approval shall stay outside ATLAS. The UI should say `Above standard - approval needed` without storing a digital approval state, because approval remains a physical/signature process.
4. Advisory and ancillary credits shall count toward both the 30-hour standard and the 40-hour cap while staying visually distinct. Load bars should stack teaching time and credited advisory/ancillary time so schedulers can see actual teaching and credited workload at once.
5. Timetable quick-fix shall use a context-aware `Tactical Bottom Dock` with Live Sandbox behavior. Do not embed the full Teaching Load page inside `/timetable`.
6. `/teaching-load` remains the dedicated bulk setup page. `/timetable` gets only a filtered, cell-context repair dock for focused experiments and commits.
7. `/teachers` is the pilot page for the first `AdminDataTable` pass because it has CRUD, metadata, source state, placeholder/Teacher X status, and load review links without the complexity of Subjects or Teaching Load.
8. The first table readability pass shall be UI-only over existing client-side data. The shared component should accept pagination props so server pagination can land later without redesigning the UI.
9. Timetable customizability priority is post-generation and post-publish manual repair through Sandbox Mode. In post-generation state, commit updates the draft. In post-publish state, commit starts the revision workflow with an effective date.

## Sequential Implementation Plan

The next implementation work should run as a prompt ladder. Each prompt should finish with evidence, update the runtime/source map when behavior changes, and hand off a stable contract to the next prompt.

The full executable prompts are now saved under `docs/prompts/`:

1. `docs/prompts/tl-timetable-01-teaching-load-semantics-foundation-prompt.md`
2. `docs/prompts/tl-timetable-02-teachers-admin-data-table-pilot-prompt.md`
3. `docs/prompts/tl-timetable-03-timetable-stale-input-contract-prompt.md`
4. `docs/prompts/tl-timetable-04-tactical-bottom-dock-live-sandbox-prompt.md`
5. `docs/prompts/tl-timetable-05-sandbox-draft-commit-path-prompt.md`
6. `docs/prompts/tl-timetable-06a-published-revision-data-model-audit-contract-prompt.md`
7. `docs/prompts/tl-timetable-06b-effective-date-read-resolution-prompt.md`
8. `docs/prompts/tl-timetable-06c-timetable-revision-ui-workflow-prompt.md`
9. `docs/prompts/tl-timetable-07-faculty-trust-and-freshness-repair-prompt.md`
10. `docs/prompts/tl-timetable-08-audit-repair-console-dashboard-drilldowns-prompt.md`
11. `docs/prompts/tl-timetable-09a-published-schedule-query-shaping-prompt.md`
12. `docs/prompts/tl-timetable-09b-dashboard-readiness-summary-endpoint-prompt.md`
13. `docs/prompts/tl-timetable-09c-admin-server-pagination-search-prompt.md`
14. `docs/prompts/tl-timetable-09d-virtualization-component-extraction-prompt.md`

Sequence index: `docs/prompts/teaching-load-timetable-repair-sequence-2026-05-31.md`.

### Prompt 1 - Teaching Load Semantics Foundation

Target pages and files:

- `/teaching-load`
- `/teachers`
- shared Teaching Load helpers and components

Purpose:

- Fix the overload vocabulary before any timetable repair UI reuses load status.
- Make advisory and ancillary credits count toward both standard and cap calculations.
- Visually separate actual teaching hours from credited advisory/ancillary time.

Required implementation shape:

- Replace `Overload Allowed` with `Above standard - approval needed` unless a future physical-approval reference is only displayed as note text.
- Treat exactly 30 credited hours as `At standard`, not amber overload.
- Show `Teaching hours`, `Advisory/ancillary credit`, `Credited workload`, `To standard`, and `To cap` consistently.
- Add stacked load-bar semantics: teaching time as the primary segment, advisory/ancillary credit as a visually distinct secondary segment, cap markers at 30h and 40h.
- Keep physical approval outside the data model for this pass.

Progression value:

- Establishes the language and load math the Tactical Bottom Dock will use.
- Prevents `/teachers`, `/teaching-load`, and `/timetable` from presenting conflicting overload states.

Verification:

- Unit coverage or focused helper checks for 25+5, 30+0, 35+5, and over-40 credited workload scenarios.
- UI smoke on `/teaching-load` and `/teachers` confirming labels and stacked bars.

### Prompt 2 - Teachers AdminDataTable Pilot

Target pages and files:

- `/teachers`
- shared admin table components

Purpose:

- Prove the shared table/readability pattern on the safest high-value CRUD page.
- Keep the pass UI-only over existing client-side data.

Required implementation shape:

- Add or refine an `AdminDataTable` pattern with column hierarchy, row action contract, mobile-card fallback, loading/empty/error states, and pagination props.
- Convert `/teachers` first.
- Preserve current faculty sync, placeholder/Teacher X state, source-state badges, and `Review teaching load` action.
- Use one visible primary row action, secondary actions in a menu, and destructive actions separated behind confirmation.
- Do not add backend pagination/search yet, but shape the component API for future `page`, `pageSize`, `total`, and `onPageChange` wiring.

Progression value:

- Gives later Subjects, Sections, Audit, and Teaching Load passes a tested visual pattern.
- Reduces CRUD risk before touching more complex pages.

Verification:

- Desktop and narrow viewport visual smoke for `/teachers`.
- No raw native `<button>`, `<select>`, `<details>`, or `title=` in touched UI.
- No touched React file above 1000 lines.

### Prompt 3 - Timetable Stale Input Contract

Target pages and files:

- `/timetable`
- generation run services and DTOs where input fingerprints are owned
- runtime source-of-truth map

Purpose:

- Make post-run input drift visible and safe before adding sandbox commits.
- Enforce the rule that ATLAS marks stale, never auto-regenerates.

Required implementation shape:

- Track or derive a generation input version/fingerprint for Teaching Load, policy, rooms, sections, and subject setup.
- Compare the active run snapshot with current input state.
- Show an `Input changes detected` banner when the run is stale.
- Provide three clear actions: `Preview Impact`, `Manually Repair`, and `Regenerate Draft`.
- Ensure `Regenerate Draft` is explicit and destructive; do not trigger it automatically.
- Keep generated/published schedules immutable unless the user chooses a controlled repair or revision path.

Progression value:

- Creates the safety rail the Tactical Bottom Dock depends on.
- Prevents sandbox repair from becoming a hidden regeneration path.

Verification:

- Local or API-level probe showing unchanged input produces no stale banner and changed assignment/policy produces stale state.
- `/timetable` UI smoke confirming banner copy and action availability.

### Prompt 4 - Tactical Bottom Dock Live Sandbox V1

Target pages and files:

- `/timetable`
- timetable selection state
- manual edit preview logic
- Teaching Load candidate/read helpers

Purpose:

- Add the context-aware bottom dock for post-generation manual repair without embedding the full Teaching Load page.
- Let schedulers experiment locally before committing changes.

Required implementation shape:

- When a scheduler selects a timetable cell, open a collapsible bottom Drawer/Dock scoped to that cell's subject, section, teacher, term, and school year.
- Show only eligible teachers for that subject/section context.
- Include a **Subject-Scoped Bulk Expansion** area inside the dock.
  - Render the other relevant unassigned or repair-eligible sections for that same subject as explicit selectable rows or checkboxes within the same drawer.
  - Allow the scheduler to expand a single-cell repair into a same-subject multi-section assignment action without leaving `/timetable`.
  - Keep the bulk scope constrained to the currently selected subject context so the dock does not turn into a full Teaching Load replacement.
- Show each candidate's stacked load bar using Prompt 1 semantics.
- Support local sandbox reassignment: the timetable updates immediately in client state, moved blocks are visibly highlighted, and conflicts receive red-border treatment.
- Keep sandbox changes uncommitted until the scheduler presses `Commit Changes`.
- Include `Reset Sandbox` and `Close without saving` actions.
- Avoid viewport death: no full Teaching Load grid, no broad teacher table, no nested heavy page embed.

Progression value:

- Gives schedulers the immediate customizability they need after generation.
- Reduces click fatigue for same-subject coverage repair, especially when several sections of one subject need the same staffing action.
- Reuses the stale input and load semantics contracts from Prompts 1 and 3.

Verification:

- Select a generated cell, open dock, preview reassignment, see local timetable change, reset, and close without persistence.
- From the same dock, verify that same-subject bulk selection for other sections is available and stays scoped to the selected subject.
- Confirm conflict highlighting appears in sandbox only and does not save before commit.
- Desktop and mobile/narrow behavior checked for no nested-scroll traps.

### Prompt 5 - Sandbox Draft Commit Path

Target pages and files:

- `/timetable`
- manual edit commit service/controller paths
- audit/evidence hooks where manual edit history is recorded

Purpose:

- Make post-generation sandbox experiments safely persist to the draft.

Required implementation shape:

- In post-generation review state, `Commit Changes` saves the sandboxed reassignment as a draft manual repair.
- Commit must preserve existing manual edits and not regenerate the whole draft.
- Commit response should update the timetable, load snapshot, and manual edit/audit state.
- Conflict blockers must stop commit with plain-language explanation and a recovery action.
- Successful commit should state what changed and what to do next.

Progression value:

- Converts sandbox from visual experiment into safe draft repair.
- Prepares the same UI workflow to hand off to published revisions in Prompt 6.

Verification:

- Commit a valid post-generation repair and reload the run/draft to confirm persistence.
- Attempt an invalid conflict commit and confirm it is blocked with recovery copy.
- Confirm no full regeneration occurs.

### Prompt 6 - Published Revision With Effective Date

Execution note:

- Do **not** run this as one oversized one-shot. Split it into three sequential implementation prompts:
  1. published revision data model and audit contract
  2. effective-date read resolution for faculty/public schedule consumers
  3. timetable revision UI workflow
- Each sub-pass must verify build, live read behavior, and evidence-log state before the next sub-pass begins.

Target pages and files:

- `/timetable`
- published schedule services/controllers
- revision/audit models or existing generation-run publish metadata
- faculty/public schedule read paths as needed for revision selection

Purpose:

- Support mid-semester repair without destroying historical published truth.

Required implementation shape:

- In post-publish state, `Commit Changes` from the Tactical Dock starts a revision workflow instead of editing the current published schedule in place.
- The revision flow must require an effective date.
- Existing published schedule remains historically readable for dates before the effective date.
- The new revision becomes the active published truth only from its effective date onward.
- Record actor, reason, changed entries, previous owner, new owner, and effective date.
- Do not introduce digital overload approval. If a repair creates above-standard load, show `Above standard - approval needed` and let the scheduler continue only where hard caps remain valid.

Progression value:

- Extends the same sandbox UI into the legally safer mid-semester workflow.
- Protects DepEd audit, payroll, and grading history.

Verification:

- Create a revision from a published schedule with an effective date.
- Confirm historical date reads still resolve the old teacher and future/effective date reads resolve the new teacher.
- Confirm audit/evidence records identify the revision and actor.

### Prompt 7 - Faculty Trust and Freshness Repair

Execution note:

- This prompt has two responsibilities, and they should not be artificially coupled.
- The **live runtime/source honesty repair** part may run earlier as an immediate operational fix if faculty pages are already showing false saved-data or broken event/update transport.
- The **published revision freshness** part should still follow Prompt 6 because it depends on revision-aware invalidation semantics.

Target pages and files:

- `/my/schedule`
- `/my/room-preferences`
- faculty portal bootstrap/cache helpers
- publish and room-decision event hooks

Purpose:

- Fix the biggest teacher-facing trust risk found in the source audit.

Required implementation shape:

- Add `runId` and `publishedAt` to faculty schedule cache keys.
- Invalidate schedule and room-request snapshots on publish, revision publish, and room-decision events.
- Add a visible happy-path refresh action on My Dashboard/My Schedule where appropriate.
- Show outbox status as plain text, for example `2 requests waiting to send`, not only as toast behavior.
- Keep faculty language nontechnical: avoid leading with `run`, `gate`, or `stale run data`.

Progression value:

- Immediate value: repairs live faculty trust and runtime honesty independent of published revision work.
- Downstream value: ensures published revisions from Prompt 6 are trusted by faculty users.
- Prevents a scheduler repair from becoming invisible or stale on teacher pages.

Verification:

- Publish or simulate a newer run/revision and confirm old faculty cache is not reused.
- Queue room request offline and confirm visible outbox count.
- Faculty mobile smoke for no clipped action bars or hidden state.

### Prompt 8 - Audit Repair Console and Dashboard Drilldowns

Target pages and files:

- `/audit`
- `/dashboard`
- exact setup/fix routes: `/teaching-load`, `/teachers`, `/sections`, `/subjects`, `/map`, `/timetable`

Purpose:

- Turn passive readiness reporting into repair-oriented workflow after the exact fix surfaces exist.

Required implementation shape:

- Each blocker should say what is blocked, why it matters, and open the exact fix flow.
- Dashboard cards should drill into the same repair targets.
- Avoid routing users to generic pages when a subject, teacher, section, room, or timetable cell context is known.
- Keep one obvious primary action per blocker group.

Progression value:

- Connects the earlier prompt outputs into a coherent school workflow.
- Reduces cognitive load across setup, repair, and publish review.

Verification:

- Sample at least one blocker per group and confirm its action opens the intended fix context.
- Confirm copy avoids unexplained jargon in primary messages.

### Prompt 9 - Performance and Server Pagination Follow-Up

Execution note:

- Do **not** execute this as one broad pass.
- Split it into separate follow-up prompts in this order:
  1. published schedule query shaping
  2. dashboard/readiness summary endpoint
  3. server-side pagination/search for high-volume admin/review lists
  4. virtualization and oversized-component extraction
- This section is a backlog cluster, not a safe single implementation prompt.

Target pages and files:

- published faculty/section/room schedule services
- dashboard/readiness summary services
- Subjects, Sections, Teachers, room requests, preference reviews, violations, and large timetable side rails

Purpose:

- Move from UI readability to scale and response-time improvements after the UI contracts stabilize.

Required implementation shape:

- Replace full-payload published entity filtering with filtered service queries.
- Add a dashboard/readiness summary endpoint so the dashboard does not assemble many independent client fetches.
- Add server-side pagination/search for the high-volume admin/review lists.
- Virtualize large grids and lists in Teaching Load, Schedule Review side rails, Room Schedules, and public schedule selectors.
- Extract remaining oversized React files before adding more feature logic.

Progression value:

- Follows the UI-only table pilot with backend contracts once the visual pattern is proven.
- Reduces latency and render pressure on the exact pages that will carry the new repair workflows.

Verification:

- Endpoint-level timing comparison before/after for published entity reads and dashboard summary.
- Large-list smoke proving virtualization does not break keyboard or mobile behavior.

## Concern-to-Prompt Mapping

| Concern | Locked Decision | Primary Prompt(s) | Primary Pages |
|---|---|---|---|
| Post-run input changes | Mark stale only; never auto-regenerate | Prompt 3, then Prompts 4-5 | `/timetable` |
| Mid-semester published changes | New published revision with effective date | Prompt 6a-6c, supported by Prompt 7 | `/timetable`, faculty/public schedule reads |
| Overload approval source | UI says approval needed; no digital approval state | Prompt 1, reused in Prompts 4-6 | `/teaching-load`, `/teachers`, `/timetable` |
| Advisory/ancillary credits | Count toward both standard and cap; display distinctly | Prompt 1 | `/teaching-load`, `/teachers`, Tactical Dock |
| Quick-fix scope | Tactical Bottom Dock with Live Sandbox | Prompts 4-6 | `/timetable` |
| AdminDataTable pilot | Pilot on Teachers | Prompt 2 | `/teachers` |
| Table readability pass | UI-only first; backend later | Prompt 2, then split Prompt 9 follow-ups | `/teachers`, then other admin tables |
| Timetable customizability | Post-generation and post-publish Sandbox Mode first | Prompts 3-6 | `/timetable` |

## Page-by-Page Impact Plan

- `/teaching-load`: Keep as the bulk setup workspace. First work is terminology, load math, and stacked credited-workload presentation.
- `/teachers`: Use as the AdminDataTable pilot and align teacher row load copy with Teaching Load semantics.
- `/timetable`: Add stale input banner, Tactical Bottom Dock, Live Sandbox preview, draft commit, and published revision handoff in that order.
- `/my/schedule`: Make schedule freshness run-aware and add visible refresh/trust cues after published revisions exist.
- `/my/room-preferences`: Make bootstrap/cache freshness revision-aware and show plain-language outbox counts.
- `/dashboard`: Add drilldowns and refresh/readiness summary after repair targets have stable routes.
- `/audit`: Convert from passive report to repair console once exact fix flows exist.
- `/subjects` and `/sections`: Adopt AdminDataTable and progressive advanced-field disclosure after the Teachers pilot proves the pattern.
- `/map`: Keep room setup improvements queued after the repair-console pass unless a room-capacity blocker becomes phase-critical.

## Prompt Drafting Status

The decisions are resolved and the full prompt set has been drafted. The next step is execution, starting with `docs/prompts/tl-timetable-01-teaching-load-semantics-foundation-prompt.md`, then proceeding through the ladder only after each prior prompt or split sub-pass has build, targeted UI, repair-loop, and evidence-log verification.
