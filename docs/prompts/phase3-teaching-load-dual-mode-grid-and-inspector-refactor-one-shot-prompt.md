# Gemini Execution Prompt: Phase 3 Teaching Load Dual-Mode Grid And Inspector Refactor One-Shot

## Mission

Refactor the Teaching Load page away from the current dashboard-like workspace into a **dual-mode administrative data grid** with a **persistent right-hand inspector drawer**.

This is a major frontend UX refactor, but it is now justified by stakeholder workflow truth.

The previous refactor improved modularity, but it did **not** land on the right interaction model. The page is still trying to make one surface handle two different operator jobs with too much visual competition.

This pass must move the page toward the correct mental model:

1. **Transcription workflow**
   - department heads already decided many pairings
   - schedulers need to rapidly encode those pairings into ATLAS

2. **Allocation workflow**
   - regular sections still need active staffing decisions
   - schedulers need to burn down shortage and balance load

The new UI must support both cleanly.

---

## Stakeholder Workflow Truth To Design Around

This is the critical requirement you must follow.

At Hinigaran National High School and similar stakeholder environments:

- **Department heads** often decide who teaches specific classes, especially high-scrutiny classes like `STE`
- **Grade level coordinators / schedulers** then link those teachers to the exact `(Section x Subject)` pairs
- For many **regular sections**, schedulers themselves still decide who should take the load

That means Teaching Load is not just a balancing tool.
It is also a **transcription surface**.

So the page must stop assuming only one working style.

---

## Correct Product Direction

Do **not** move to a single rigid “table by subject only” model.

That would help shortage burn-down, but it would make department-head transcription slower and more frustrating.

Instead, implement a **dual-mode data grid**:

### Mode 1: `By Teacher`

Purpose:

- rapid transcription of known assignments
- scheduler starts from a teacher and attaches the correct classes

Expected behavior:

- rows are teachers
- expanding/selecting a teacher reveals their assignable subject/section rows
- this is the fast data-entry mode when the teacher is already known

### Mode 2: `By Section / Shortage`

Purpose:

- allocation of remaining uncovered demand
- scheduler starts from an unassigned or constrained class need

Expected behavior:

- rows are subject-section demand rows
- selecting a row reveals eligible teachers ordered by the most useful staffing signal
- this is the burn-down mode for remaining shortages

Do not split these into separate routes.
Keep them in one page with a strong mode toggle.

---

## Inspector Model

Do **not** use popovers or blocking modals for dense load arithmetic.

Do **not** rely on fragile hover surfaces for important workload reasoning.

Use a **persistent right-hand inspector drawer / sheet** as the canonical detail surface.

The drawer should update when:

- a teacher row is selected in `By Teacher`
- a teacher candidate is selected in `By Section / Shortage`

The drawer should contain the heavy detail:

- credited weekly load
- concurrent teaching
- remaining capacity
- peak term / rotational family detail
- assignment-specific impact cues if needed

The main grid should stay for data entry.
The drawer should hold the dense explanation.

---

## Hard Scope

Touch only the Teaching Load frontend and directly related client helpers.

Likely files:

- `atlas-client/src/pages/TeachingLoad.tsx`
- `atlas-client/src/hooks/useTeachingLoadData.ts`
- `atlas-client/src/hooks/useTeachingLoadUI.ts`
- `atlas-client/src/components/faculty-assignments/*`
- `atlas-client/src/lib/faculty-assignment-helpers.ts` only if a small frontend view-model extraction is necessary

Do **not**:

- reopen backend math
- change API contracts
- change staffing logic
- change generation logic
- add a new global state library

This is a **frontend workflow refactor** on top of the already stabilized truth contract.

---

## Required Refactor Outcomes

### 1. Replace the current main interaction model

Required outcome:

- the page must stop centering the current split dashboard/subject workspace model
- replace it with a dual-mode master-detail grid system
- the grid is the main workspace
- the inspector drawer is the secondary detail surface

The user should feel like they are working through a structured staffing ledger, not a hybrid dashboard.

### 2. Build a clear mode toggle

Required outcome:

- add a clear top-level mode switch between:
  - `By Teacher`
  - `By Section` or `By Shortage`

The toggle must be obvious and must not feel buried.

The mode label should use scheduler language, not technical language.

### 3. Support the transcription workflow explicitly

Required outcome for `By Teacher` mode:

- rows are teachers
- teacher selection/expansion is fast
- schedulers can rapidly add or remove class ownership for that teacher
- this mode should feel optimized for encoding pre-decided assignments from department heads

Do not force the scheduler to hunt through a giant subject shortage table when they already know the teacher.

### 4. Support the allocation workflow explicitly

Required outcome for `By Section / Shortage` mode:

- rows are unassigned or shortage-relevant class demands
- selecting a row shows eligible teachers
- candidate ordering should respect the already-correct backend staffing truth
- the mode should feel optimized for burning down open sections

Do not turn this into a generic subject catalog.
Keep it demand-led.

### 5. Use the inspector drawer as the canonical math surface

Required outcome:

- remove heavy arithmetic and rotational detail from primary grid rows
- keep only concise, scannable signals in the grid
- move the dense explanatory math into the inspector drawer

The drawer must be:

- stable
- persistent while working
- non-blocking
- easy to scan

### 6. Define removal UX clearly

Use this rule:

- **single assignment removal** should remain inline and direct in the grid
- **bulk destructive actions** may still use lightweight confirmation

So for mistakes:

- use a contextual hover state for removal
- the grid should look clean and static by default
- when hovering over an active assignment, it should transform to reveal the inline `X`, `DROP`, or `Unassign` affordance
- do **not** force the user into the drawer just to remove one assignment

The inspector drawer is for understanding and confirming context, not for every basic removal.

### 7. Reduce visual noise materially

Required outcome:

- reduce badge spam
- reduce row tint overload
- reduce large static explanation blocks
- make the table/grid carry the workload, not floating explanation slabs

Keep:

- explicit `Term 1 / Term 2 / Term 3`
- essential special-program identity
- honest load status

But reduce duplicate signaling and equal-weight noise.

Also:

- stop using amber/warning colors for teachers who simply have remaining capacity
- reserve warning/danger colors for:
  - over-capacity states
  - algorithmic conflicts
  - truly unresolved/unassigned demand
- use neutral or primary-brand signals for available capacity / underutilized staff

### 8. Remove raw title-based explanations

Required outcome:

- no important icon control in the touched surface should rely on raw `title`
- replace those with proper `Tooltip` usage using project primitives

### 9. Reduce render-loop shaping where practical

The last audit found that ownership/conflict maps were still being filtered inside render loops.

Required outcome:

- reduce this in the new grid model where reasonably possible
- shape row-local data before deep render fan-out when practical
- keep the solution simple

Since new global state libraries are banned:

- isolate draft mutation state (`Undo` / `Redo` / draft assignment changes) using dedicated React Context or highly localized hooks
- use component memoization where appropriate so assigning a section to `Teacher A` does not trigger a broad rerender of unrelated teacher rows / cells

Do not overengineer this.

### 10. Stay ready for SPA/SPS breakout-lane truth

Do **not** implement breakout dissemination here.

But the new grid model must be able to display future explicit lanes cleanly.

Required outcome:

- the new rows and drawer must remain compatible with multiple specialization lanes
- do not hardcode the assumption that only one coarse `SPA_SPEC` or `SPS_SPEC` row will exist forever

---

## Recommended Component Direction

You do not have to use these exact names, but the architecture should move toward this shape:

- `TeachingLoadToolbar`
- `TeachingLoadModeToggle`
- `TeacherGroupedTable` or `TeacherAssignmentTable`
- `SectionShortageTable` or `SectionDemandTable`
- `TeacherWorkloadInspectorDrawer`
- `AssignmentCell` / `AssignmentRow`
- `TeachingLoadBulkActionBar`

The page should feel like a master-detail admin tool.

---

## Design-System Constraints

Mandatory:

- preserve no-scroll architecture
- use `@/ui/*` primitives only
- no native inputs
- no raw HTML `title` as the final explanation pattern
- preserve mobile safety where feasible
- preserve strict scheduler density

Do not turn this into:

- a card explosion
- a modal maze
- a new dashboard

This should feel like a high-density staffing ledger with a calm inspector.

---

## Tailnet Verification Requirements

You must verify on:

- `https://njgrm.buru-degree.ts.net`
- Admin: `1000001 / AdminSY2026!`

Verify all of the following:

1. `By Teacher` mode supports rapid transcription of known assignments.
2. `By Section / Shortage` mode supports demand-led allocation clearly.
3. The right-hand inspector drawer updates correctly when selecting teachers/candidates.
4. A scheduler can remove a single assignment directly from the main grid without relying on undo.
5. One `SCI` teacher remains understandable in the new model.
6. One `TLE` teacher remains understandable in the new model.
7. The page feels less like a crowded dashboard and more like a staffing tool.

If the first implementation still feels like “the old page wearing a table costume,” keep fixing in the same pass.

---

## Build Requirement

Run:

- `npm --prefix atlas-client run build`

---

## Evidence Log Requirement

Append to `docs/verification/evidence-log.md` with:

- files changed
- which components now represent `By Teacher` and `By Section / Shortage`
- where the inspector drawer lives
- how single-assignment removal works
- whether raw title usage was removed from touched controls
- Tailnet verification notes
- final verdict: `GO` or `NO-GO`

Do **not** call this `GO` unless the new interaction model clearly supports both:

1. transcription of department-head-decided assignments
2. shortage/allocation burn-down by schedulers

---

## Final Execution Rule

This pass is a **workflow-model correction**.

The page should leave this pass feeling like:

- a real scheduler operations surface
- a transcription tool when needed
- an allocation tool when needed
- and a calmer master-detail interface overall

Do not merely re-skin the current layout.
Change the working model.
