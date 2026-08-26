# Gemini Execution Prompt: Phase 3 Teaching Load Major Frontend Refactor And Workflow Clarity One-Shot

## Mission

Refactor the Teaching Load page into a maintainable, scheduler-usable frontend architecture.

This is no longer a narrow polish pass. The current page has crossed the line into a frontend architecture problem:

- `TeachingLoad.tsx` is roughly `2900+` lines
- it violates the ATLAS frontend rule that no React component should exceed `1000` LOC
- it mixes data fetch orchestration, heavy derived state, route/query handling, workspace controls, assignment logic, and the full UI in one place
- it remains visually exhausting even after multiple truth-fix passes

This pass must **structurally refactor** the Teaching Load frontend while preserving the current corrected year-55 data truth.

This is a **frontend refactor and UX architecture pass**, not a backend-model pass.

---

## Current Verified Live Context

Tailnet year-55 truth is now stable enough for a frontend refactor:

- `schoolId = 1`
- `schoolYearId = 55`
- coverage = `962 / 962`
- `unassignedPairs = 0`
- split-brain preview:
  - `quarantine.required = false`
  - integrity counters = `0`
  - `truthRowsToUpdate = 0`
  - remaining warning reasons:
    - `FACULTY_LOAD_REVIEW_REQUIRED`
    - `SPECIAL_PROGRAM_APPROVAL_REQUIRED`

The current problems are therefore mostly:

- structural frontend debt
- render density
- poor workflow hierarchy
- confusing action placement
- too much developer-facing language

---

## Hard Scope

Touch only the Teaching Load frontend surface and directly related client helpers.

Likely files:

- `atlas-client/src/pages/TeachingLoad.tsx`
- `atlas-client/src/components/faculty-assignments/*`
- `atlas-client/src/hooks/useAssignmentHistory.ts`
- `atlas-client/src/lib/faculty-assignment-helpers.ts`
- any new local feature-level hooks/components needed under a teaching-load-oriented structure

You may create new components and hooks, but keep them inside the client frontend architecture.

Do **not**:

- reopen backend math
- change API contracts
- change staffing logic
- change generation logic
- introduce a brand-new global state library by default

Important constraint:

- Do **not** introduce Zustand, Redux, or another new app-wide state framework unless it is absolutely required.
- Prefer:
  - component extraction
  - local feature hooks
  - narrow local context if truly needed
- The goal is to reduce the God Component safely, not to create a second architectural upheaval.

---

## Honest Architectural Direction

You should treat the page as having two real operator workflows:

1. **Teacher transcription / assignment workflow**
   - scheduler picks a teacher
   - sees scoped subject/section assignment surfaces
   - rapidly assigns or removes ownership

2. **Shortage / allocation workflow**
   - scheduler focuses on what is unassigned or constrained
   - decides who should take remaining work

The current monolithic page blends these together too loosely.

Refactor the UI so those workflows are clearer without turning the page into a route maze.

---

## Mandatory Refactor Outcomes

### 1. Break the God Component apart

Required outcome:

- `TeachingLoad.tsx` must stop being a monolithic all-in-one file.
- Extract clear subcomponents for at least:
  - roster sidebar
  - selected-teacher header / identity strip
  - workspace toolbar / controls
  - review/integrity status surface
  - rotational breakdown surface or drawer
  - modal/sheet cluster
  - assignment workspace surface

If needed, extract local hooks for:

- filter state
- selected teacher state
- workspace mode state
- compact review/integrity presentation state

Do not leave one giant page file that still owns everything.

### 2. Move complex inline derivation out of the page

Required outcome:

- move heavy inline rotation/helper normalization out of giant `useMemo` blocks where appropriate
- place reusable view-model logic in the proper client helper file(s)
- keep page components focused on orchestration and rendering

Do not keep large anonymous derivation blocks embedded inline if they can be safely extracted.

### 3. Reduce prop-drilling pressure

Required outcome:

- stop passing oversized state blobs deeply through large trees where a narrower feature boundary can be used
- only pass what each child actually needs
- avoid unnecessary mass rerenders from giant shared objects

You do not need to introduce a new global store to do this.

### 4. Calm the selected-teacher surface

Required outcome:

- the selected-teacher strip must stop trying to be:
  - dashboard
  - toolbar
  - inspector
  - incident console
  - all at once

The main strip should focus on the minimum high-value signals:

- teacher identity
- credited weekly load
- concurrent teaching
- remaining capacity
- save state / draft action

Dense explanation and secondary metrics must move into secondary disclosure.

### 5. Move review and rotation detail out of the prime workspace

Required outcome:

- the warning-only review state must not sit as a large banner above the workspace
- the rotational family breakdown must not sit permanently expanded in the working area

Move those into:

- popover
- drawer
- sheet
- compact expandable review surface

Keep the main working area for actual scheduling work.

### 6. Clean up badge and color noise

Required outcome:

- reduce badge spam in `SubjectRow`
- do not show redundant badges that communicate the same thing twice
- standardize rotational signaling so:
  - explicit term labels carry the meaning
  - a second redundant “rotational lane” style badge is not needed if the term badge already communicates it

Also:

- reduce or eliminate broad row tinting if it makes the grid feel like a rainbow wall
- prefer calmer accents such as borders or small markers rather than large filled backgrounds

### 7. Unify critical actions

Required outcome:

- stop burying essential operations behind multiple layers when they are core to the workflow
- remove duplicate control placement where the same control appears in multiple UI locations without a strong reason

For example:

- coverage mode should not feel duplicated
- workspace ops should not feel like a second hidden control center

Use one coherent action model.

### 8. Replace developer-first wording

Required outcome:

- stop exposing scheduler-facing copy like:
  - `Split-Brain`
  - `Teacher Arithmetic Hidden`
  - similarly internal-engineering phrasing

Use scheduler-facing language such as:

- `Integrity Status`
- `Load Breakdown`
- `Review Needed`
- similar plain-language equivalents

### 9. Make removal a first-class interaction

Undo/Redo are safety nets, not the primary removal flow.

Required outcome:

- active assigned section cards must behave like editable controls, not static status chips
- when hovering an already-assigned card, the UI should clearly communicate the destructive action
- a scheduler must be able to remove a single assignment directly from the card interaction

You may implement this as a contextual hover toggle or another equally clear direct-manipulation pattern.

Bulk destructive actions like `Unassign All` or grade-wide clearing must retain lightweight confirmation.

### 10. Prepare the UI for explicit `SPA/SPS` breakout lanes

Do **not** implement backend breakout dissemination in this pass.
But do not hardcode the current coarse umbrella assumption deeper into the UI.

Required outcome:

- subject and row rendering must remain capable of displaying explicit specialization lanes cleanly
- avoid UI assumptions that only one generic `SPA_SPEC` / `SPS_SPEC` row will ever exist
- keep the page structurally ready for the upcoming breakout-lane contract

---

## Recommended Component Direction

You do not have to use these exact names, but the refactor should move toward a structure like:

- `TeachingLoadLayout`
- `TeachingLoadRosterSidebar`
- `TeachingLoadWorkspaceToolbar`
- `TeachingLoadActionsMenu`
- `TeachingLoadReviewStatusPopover` or similar
- `TeacherInspectorDrawer`
- `TeacherAssignmentWorkspace`
- `ShortageAllocationWorkspace`

The right-hand dense breakdown surface should become an inspector-style secondary surface rather than continuing to suffocate the top bar.

---

## Design-System Constraints

Mandatory:

- keep no-scroll architecture intact
- use `@/ui/*` primitives only
- no raw HTML select/button patterns
- preserve compact scheduler density
- keep the page mobile-safe where it already supports smaller widths

Do not create a generic dashboard-card explosion.

---

## Tailnet Verification Requirements

You must verify on:

- `https://njgrm.buru-degree.ts.net`
- Admin: `1000001 / AdminSY2026!`

You must verify all of the following:

1. The page no longer feels dominated by a single monolithic header-plus-banner-plus-breakdown slab.
2. Review-only status is visible but no longer consumes prime workspace.
3. Rotational detail remains available but is no longer always open in the main work area.
4. At least one single-card assignment removal flow is obvious and usable.
5. One `SCI` teacher and one `TLE` teacher can still be understood clearly after the refactor.
6. The page remains materially calmer without losing truthful top-line teacher signals.

If the page still feels structurally crowded after the first pass, keep fixing in the same pass.

---

## Build Requirement

Run:

- `npm --prefix atlas-client run build`

---

## Evidence Log Requirement

Append to `docs/verification/evidence-log.md` with:

- files extracted or created
- final `TeachingLoad.tsx` size after refactor
- what moved out of the primary workspace
- what replaced the large review banner
- how single-assignment removal now works
- Tailnet verification results
- final verdict: `GO` or `NO-GO`

Do not claim `GO` unless the page is materially calmer **and** the page has been structurally decomposed enough to no longer qualify as the same God Component problem.
