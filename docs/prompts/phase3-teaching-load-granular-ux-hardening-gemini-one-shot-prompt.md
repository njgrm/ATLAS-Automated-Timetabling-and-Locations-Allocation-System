# Gemini Execution Prompt: Phase 3 Teaching Load Granular UX Hardening One-Shot

## Mission

Perform a safe, high-signal UX/UI hardening pass on the current authoritative `Teaching Load` workspace at `/teaching-load`.

This pass is based on repeated live and code audits of the current Teaching Load experience after the major refactor and subsequent workflow repairs.

The goal is not to redesign the product again.
The goal is to remove the remaining fragile, noisy, hard-to-read UI patterns that make the page feel cramped, confusing, and crash-prone.

You must work only on the current `Teaching Load` workspace and its directly related components.

---

## Scope

### In Scope
- `atlas-client/src/pages/TeachingLoad.tsx`
- directly related components under `atlas-client/src/components/faculty-assignments/`
- directly related hooks under `atlas-client/src/hooks/` only if necessary for the touched UI behavior
- current `Teaching Load` toolbar, section-allocation surface, teacher-mode surface, persistent inspector rails, staffing audit sheet, and jump-list/assignment workspace surfaces still used by `/teaching-load`

### Out Of Scope
- `atlas-client/src/pages/FacultyAssignments.tsx`
- backend scheduling logic
- split-brain/quarantine semantics
- subject ownership or DB repair
- timetabling workspace redesign
- broad navigation or shell redesign outside what is directly necessary for the current Teaching Load surface

Do not reopen legacy `FacultyAssignments.tsx` just because it is large.
Treat `/teaching-load` as the authoritative scheduler surface now.

---

## Required References

Read before editing:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `GEMINI.md`

Inspect directly before editing:

- `atlas-client/src/pages/TeachingLoad.tsx`
- `atlas-client/src/components/faculty-assignments/SectionGridMode.tsx`
- `atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx`
- `atlas-client/src/components/faculty-assignments/SectionInspector.tsx`
- `atlas-client/src/components/faculty-assignments/WorkloadInspector.tsx`
- `atlas-client/src/components/faculty-assignments/StaffingAuditSheet.tsx`
- `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
- `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx`
- any current jump-list or assignment-workspace component still rendered by `/teaching-load`

---

## Current Verified UX Problems

Treat all of the following as real defects already identified through audit.

### 1. Typography is too small across the workspace

There is widespread use of tiny text like:

- `text-[0.55rem]`
- `text-[0.6rem]`
- `text-[0.65rem]`
- `text-[9px]`-style equivalents

This violates the current readability guardrails.

Primary examples:

- staffing labels
- adviser labels
- metric captions
- small status/badge text
- inspector metadata

### 2. Raw HTML interactive controls still exist in the current Teaching Load surface

At least one current section-allocation candidate control path still uses raw styled `<button>` patterns rather than ATLAS UI button primitives.

This violates the current `GEMINI.md` control rule.

### 3. Section Allocation is too dense and visually exhausting

Current pattern:

- expand section
- show vertical stack of subjects
- under each subject, dump a dense grid of teacher choices

This creates:

- a wall of boxes
- too much vertical scrolling
- poor scanability
- hidden/non-obvious swap behavior

### 4. Subject-code containers are fragile and overflow

The current design still uses small square containers for compact subject identity in inspectors and section rows.

This fails for wider codes such as:

- `TLE_FCS_EXP`
- `MAPEH`
- `ESP 10`
- similar multi-character codes

The square container pattern is too fragile and should be removed where it causes overflow or compression.

### 5. Jump-list truncation creates ambiguous navigation

Current subject-code truncation patterns like slicing to 3 characters can make different items indistinguishable.

This weakens the jump list and creates navigation ambiguity.

### 6. Inspector hierarchy is still weak

In the current rails/drawers:

- primary identity
- secondary metadata
- status chips
- tiny labels

still compete too much for attention.

### 7. Badge spam and cramped micro-containers remain

Single rows/cards can still end up carrying too many small badges or compressed identity containers.

This violates the visual-calming rules.

### 8. Scroll behavior is still fragile

Nested scroll regions and hidden scrollbars in the current Teaching Load workspace can create:

- scroll trapping
- uncertain discoverability of additional content
- too much reliance on internal invisible scroll regions

### 9. Hit targets are too small in some dense controls

Examples include:

- tiny chevrons
- small expansion buttons
- compressed inline control targets

These are risky for trackpad and touch interaction.

### 10. Section Allocation load-choice display is still too busy

Current candidate cards show:

- name
- load percentage
- icon
- ownership context

repeated too many times in one view.

The safer pattern is:

- show current owner clearly
- provide a calmer `Edit` / `Reassign` interaction
- reveal filtered teacher selection through a more controlled picker

### 11. Staffing Audit sheet still needs calmer action hierarchy

The sheet can become a long scroll region with action guidance buried too low.

It should remain useful without becoming another dense report trap.

---

## Product Decisions To Follow

### 1. Readability floor is mandatory

Do not use text smaller than `text-xs` for normal operator-facing content unless you can justify it explicitly.

Target:

- primary content: `text-sm`
- secondary content: `text-xs`

### 2. Remove fragile square code containers

Where subject code is currently placed in a tiny fixed square and can overflow or compress badly:

- replace that pattern with a horizontally expanding badge or text label
- prefer readable text over ornamental micro-boxes

### 3. Calm the section-allocation assignment interaction

Do not keep dumping a large teacher-card grid under every subject if a calmer pattern can do the job.

Preferred direction:

- show current owner clearly
- expose a focused `Edit` or `Assign` control
- open a constrained `Popover`, `Sheet`, or `SearchableSelect`-style teacher picker

Do not turn this into a modal-heavy workflow.
Keep it inline and scheduler-efficient.

### 4. Preserve the persistent inspector concept

Do not remove the right-hand inspector rails.
Improve their hierarchy and readability instead.

### 5. Reduce visual energy

Use:

- calmer text rhythm
- fewer all-caps black micro-labels
- fewer compressed badges
- clearer visual grouping

Do not solve density by shrinking text.

### 6. Keep interactions safe and obvious

Expansion rows, chevrons, and editable cards should have comfortable hit targets and clear click affordances.

### 7. Prefer safe passes over risky architecture churn

This is a UX hardening pass.
Do not reopen architecture decisions that are not necessary for these fixes.

---

## Required Changes

### 1. Normalize typography

Required outcome:

- remove or drastically reduce tiny custom font sizes below `text-xs`
- standardize operator-facing labels to `text-xs` minimum
- promote key identity/metric text to `text-sm` where space allows

If a label is too long:

- shorten the label
- do not shrink the font below readability standards

### 2. Replace raw interactive controls in the current Teaching Load surface

Required outcome:

- replace raw styled `<button>` usage in the current touched Teaching Load components with `@/ui/button` or another appropriate ATLAS primitive

### 3. Unbox subject identity where current square containers fail

Required outcome:

- remove fragile fixed square containers holding subject codes where overflow is possible
- use horizontally expanding badge/text labels instead
- verify this specifically in:
  - `SectionInspector`
  - `WorkloadInspector`
  - `SectionGridMode`
  - any current jump-list / assignment-workspace surface still rendered by `/teaching-load`

### 4. Fix jump-list ambiguity

Required outcome:

- stop truncating subject identity so aggressively that codes become ambiguous
- preserve fast scanning without making different subjects indistinguishable

### 5. Simplify section-allocation candidate presentation

Required outcome:

- reduce the current “wall of teacher boxes” pattern
- make current ownership clearer
- move reassignment/selection into a calmer focused picker interaction where appropriate
- preserve fast assignment speed

Do not regress the real assignment workflow.

### 6. Improve inspector hierarchy

Required outcome:

- make teacher/section identity the strongest visual layer
- make department/program/secondary metadata quieter
- ensure status colors remain readable with the new text floor

### 7. Reduce badge overload

Required outcome:

- reduce stacked micro-badges and noisy status clutter
- keep only the most important status signals visible at once

### 8. Reduce scroll traps

Required outcome:

- avoid nested invisible scroll regions where possible
- keep the main content scroll behavior understandable
- if a drawer or sheet must scroll internally, ensure it feels intentional and not trapped

### 9. Enlarge small hit targets

Required outcome:

- make tiny expand/collapse and similar interactive controls easier to hit
- do not rely on tiny icon-only click targets in dense scheduler workflows

### 10. Calm the Staffing Audit sheet

Required outcome:

- keep the sheet readable
- avoid burying key next-step guidance too deep in a long scroll wall
- improve hierarchy without turning it into a new dashboard

---

## Verification Requirements

You must verify the actual current `/teaching-load` page and the touched component paths before declaring `GO`.

At minimum:

1. `npm --prefix atlas-client run build`
2. confirm there are no TypeScript/import errors in touched files
3. open the real `/teaching-load` page
4. exercise the touched surfaces that you changed

Mandatory crash/surface checks before `GO`:

- page loads without runtime crash
- `By Teacher` mode renders
- `Section Allocation` renders
- touched inspector rail(s) open and render
- touched sheet(s) or popovers open and render
- no missing icon import crashes
- no missing component import crashes
- no obvious subject-code overflow remains in the touched surfaces

You must specifically test the components/surfaces you changed, not just the page shell:

- `SectionGridMode`
- `TeacherGridMode`
- `SectionInspector`
- `WorkloadInspector`
- `StaffingAuditSheet`
- `SubjectRow`
- any touched jump-list or assignment-workspace surface still used by `/teaching-load`

If any touched surface crashes or fails to open, do not declare `GO`.

---

## Documentation Updates

Update:

- `docs/verification/evidence-log.md`

Append only.

The evidence entry must state:

- which current `/teaching-load` components were changed
- which surfaces were opened/tested
- whether any runtime/import crash was encountered
- whether subject-code overflow/unboxing was fixed
- whether section-allocation density was calmed
- final verdict: `GO` or `NO-GO`

---

## Completion Rule

Do not implement risky new architecture in this pass.

This pass is successful only if the current authoritative `Teaching Load` page becomes:

- more readable
- less fragile
- less noisy
- less crash-prone
- easier to scan in both `By Teacher` and `Section Allocation`

while staying inside the current product direction.
