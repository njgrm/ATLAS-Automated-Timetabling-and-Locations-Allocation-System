# Gemini Execution Prompt: Phase 3 Teaching Load Table Familiarity And Shortage Semantics Correction One-Shot

## Mission

Correct the recently landed Teaching Load table refactor so it aligns with the intended familiar admin-table workflow instead of the current confusing grid behavior.

The new direction itself was not wrong:

- table-first familiarity is still the right direction
- a persistent right-hand workload inspector is still the right direction

But the current implementation missed key usability requirements:

- it dropped earlier filter/search affordances
- it leaves outside-department subjects always visible
- `By Section / Shortage` is semantically misleading when coverage is already `0 unassigned`
- the section-first mode does not actually complete assignment behavior
- the page still scrolls too much because too much content is expanded inline

This pass must correct those issues **without abandoning the table-based direction**.

---

## Current Verified Problems

These are already confirmed in the current code:

1. The earlier teacher search/filter controls still exist in state, but are no longer properly surfaced in the page workflow.
2. `Outside Department` subjects are still rendered by default in `By Teacher`, which creates visual noise and weakens the transcription workflow.
3. `By Section / Shortage` is currently mixing:
   - genuinely unassigned rows
   - plus staffed rows when they match search
   so it is not a true shortage mode.
4. Candidate selection in section mode does not complete a real assignment flow yet; it mostly selects a teacher / inspector target.
5. The persistent inspector is acceptable, but the main grid still expands too much inline and creates scrolling pressure.
6. Hovering candidates in section mode currently mutates the selected teacher, which is too aggressive.

These are the problems to solve.

---

## Product Direction To Preserve

Keep these decisions:

- familiar table/admin-list structure similar to `Teachers` / `Sections`
- default working model should still feel table-first
- persistent right-hand workload inspector should stay
- no modal-first load review

Do **not** revert to:

- the old dashboard/card-heavy Teaching Load surface
- modal-per-teacher arithmetic
- popover-based primary load reasoning

---

## Corrected Workflow Model

### 1. Default mode should remain `By Teacher`

This is the primary transcription workflow.

It should feel like:

- search/filter teachers
- choose a teacher
- see their subject assignment rows
- quickly encode department-head-decided pairings

### 2. Secondary mode should become honest section demand review

Do **not** keep calling it `Shortage` if the mode is not actually showing shortage-only demand.

If coverage is `0 unassigned`, a label like `By Section / Shortage` is misleading.

Required direction:

- either make it a **true shortage-only** mode
- or rename/reframe it to something honest like:
  - `By Section`
  - `Section Demand`
  - `Section Allocation`

and then provide a separate filter for:

- unassigned only
- all sections
- constrained / review-needed sections

The mode must match the data being shown.

---

## Required Corrections

### 1. Restore familiar discovery controls

Required outcome:

- bring back visible teacher search/filter controls in the teacher-first workflow
- keep them familiar to the `Teachers` / `Sections` browsing rhythm

At minimum, restore or clearly expose:

- teacher search
- department filter
- assignment-status filter
- sort by load

Do not bury these in invisible state.

### 2. Hide outside-department subjects by default

Required outcome:

- `Outside Department` / `Cross-Department` subjects must be hidden by default
- expose them only behind an explicit reveal toggle such as:
  - `Show Outside Department`
  - `Include Cross-Department Subjects`

This is critical to keep the main transcription surface calm and honest.

The default view should prioritize:

- department-qualified
- adviser-relevant
- normal expected assignment scope

### 3. Fix section-mode semantics

Required outcome:

- stop presenting a fully covered year as if it still has classic shortage rows
- if the mode is shortage-only, show shortage-only truth
- if the mode includes staffed section demand, rename it accordingly and add explicit filters

You must not leave a mode where:

- the header says `Unassigned = 0`
- but the user opens `By Section / Shortage`
- and sees a long list that still looks like unresolved shortage work

That is currently confusing and untrustworthy.

### 4. Make section-mode candidate interaction real

Required outcome:

- selecting a candidate in section mode must support a real assignment workflow
- it must not only change the selected teacher / inspector target

The section-first mode must become operationally valid.

If needed:

- use explicit inline `Assign`
- `Take`
- `Reassign`
- or equivalent row-level action

But make it actually do the job.

### 5. Keep the inspector, but reduce inline expansion

Required outcome:

- keep the persistent workload inspector
- reduce how much of the main grid expands into large nested content
- keep the main surface scannable

The current issue is not that the drawer exists.
The issue is that too much detail still lives inline in the main grid, forcing heavy scrolling.

### 6. Fix hover behavior in section mode

Required outcome:

- hovering a candidate teacher must not aggressively mutate the primary selected-teacher state in a way that feels unstable
- use hover for preview only if the interaction is stable and intentional
- otherwise require click/select for inspector changes

Do not make simple cursor movement feel like a selection change.

### 7. Keep direct single-row removal inline

Required outcome:

- retain inline single-assignment removal
- use hover-to-reveal destructive affordances so rows remain calm by default
- keep bulk destructive actions behind lightweight confirmation

### 8. Preserve tooltip-standard compliance

Required outcome:

- continue replacing raw `title`-style explanation with proper `Tooltip`
- do not regress here

---

## Familiarity Requirement

The new table model should feel recognizably related to:

- `Teachers`
- `Sections`

Use that familiarity deliberately:

- strong row rhythm
- predictable search/filter placement
- clean header controls
- expandable detail only where it helps

Do not blindly copy those pages.
But the Teaching Load page should now feel like part of the same admin family.

---

## Design-System Constraints

Mandatory:

- preserve no-scroll architecture
- use `@/ui/*` primitives only
- keep compact density
- keep the persistent inspector non-blocking
- no modal-first arithmetic
- no raw native inputs

Do not create:

- a scroll-heavy accordion maze
- a shortage mode that lies about the underlying coverage state
- a cross-department-default wall of noise

---

## Tailnet Verification Requirements

You must verify on:

- `https://njgrm.buru-degree.ts.net`
- Admin: `1000001 / AdminSY2026!`

Verify all of the following:

1. `By Teacher` has visible search/filter controls again.
2. Outside-department subjects are hidden by default and only appear when explicitly toggled on.
3. The section-first mode has an honest label and honest semantics relative to current coverage.
4. Section-mode candidate selection performs a real assignment action rather than only changing inspector focus.
5. The page scroll burden is materially reduced versus the current landed refactor.
6. The persistent inspector remains useful without dominating the workflow.

If the page still feels like a confusing accordion after the first implementation, keep fixing in the same pass.

---

## Build Requirement

Run:

- `npm --prefix atlas-client run build`

---

## Evidence Log Requirement

Append to `docs/verification/evidence-log.md` with:

- files changed
- which controls were restored
- what the default outside-department behavior is now
- what the section-mode label is and why
- how real assignment works in section mode
- Tailnet verification notes
- final verdict: `GO` or `NO-GO`

Do **not** call this `GO` unless the page clearly feels more familiar, more honest, and less confusing than the current landed refactor.

---

## Final Execution Rule

Do not throw away the table direction.

Correct it.

The outcome should be:

- familiar
- searchable
- filterable
- teacher-first by default
- honest about shortage semantics
- calmer about outside-department content
- and still powered by a persistent workload inspector

