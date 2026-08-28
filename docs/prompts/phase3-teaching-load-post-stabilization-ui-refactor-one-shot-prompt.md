# Gemini Execution Prompt: Phase 3 Teaching Load Post-Stabilization UI Refactor One-Shot

## Mission

Refine the Teaching Load page into a calmer, clearer, scheduler-first workspace now that:

- the large frontend decomposition already landed
- the post-refactor stabilization pass already restored functional truth
- the page is now structurally safe enough for a pure UI/UX refactor

This is **not** a backend pass.
This is **not** another architecture rescue.
This is a **post-stabilization UI refactor** that should operate on the current modular page and make it feel coherent to schedulers.

---

## Current Verified Baseline

Verified in code/build:

- `atlas-client/src/pages/TeachingLoad.tsx` is now `408` lines
- extracted hooks/components are in place:
  - `useTeachingLoadData.ts`
  - `useTeachingLoadUI.ts`
  - `RosterSidebar.tsx`
  - `TeacherIdentityStrip.tsx`
  - `WorkspaceToolbar.tsx`
  - `AssignmentWorkspace.tsx`
  - `TeachingLoadModals.tsx`
- `npm --prefix atlas-client run build` passes

Verified product truth that must be preserved:

- `schoolId = 1`
- `schoolYearId = 55`
- coverage is stable
- rotation-family term truth is restored
- global reset is reachable again
- coverage mode is operator-selectable again

So this pass must **not reopen solved truth work**.
It must focus on the page experience itself.

---

## What Is Still Wrong

After stabilization, the remaining problems are mostly UI/UX quality and render-shape quality:

1. The page is still visually busy and operationally dense.
2. The two workflows are clearer than before, but still not calm enough:
   - teacher assignment/transcription
   - shortage/allocation review
3. The toolbar and identity strip still compete with the working area more than they should.
4. Secondary controls and explanations are improved, but the page still feels like a technical workspace rather than a scheduler-first one.
5. `AssignmentWorkspace` still performs ownership-map filtering inline during render loops.
6. Some icon buttons still use raw `title` attributes instead of proper `Tooltip` primitives.
7. `SubjectRow` still carries too much density and color/badge noise.

This pass should attack those, not math.

---

## Hard Scope

Touch only the Teaching Load frontend surface and directly related client helpers.

Likely files:

- `atlas-client/src/pages/TeachingLoad.tsx`
- `atlas-client/src/hooks/useTeachingLoadUI.ts`
- `atlas-client/src/components/faculty-assignments/*`
- `atlas-client/src/lib/faculty-assignment-helpers.ts` only if a tiny frontend-facing view-model extraction is truly necessary

Do **not**:

- reopen backend load math
- change API contracts
- change staffing logic
- change generation logic
- change coverage-mode semantics
- remove the restored reset flow

This is a **scheduler-surface refactor**, not a product-behavior reset.

---

## Architectural Direction To Follow

The page should now lean into two operator workflows explicitly:

1. **Teacher Assignment Workflow**
   - select teacher
   - review honest top-line load state
   - assign / remove section ownership rapidly

2. **Shortage / Allocation Workflow**
   - review missing or pressured coverage
   - inspect staffing mode effects
   - decide who should take remaining work

These should feel like two clear working modes inside one page, not one crowded hybrid slab.

Do not split them into separate routes.
Do not create a route maze.

---

## Required UI Refactor Outcomes

### 1. Make the page feel calmer without losing density

Required outcome:

- preserve compactness
- preserve no-scroll architecture
- reduce visual competition between:
  - toolbar
  - selected-teacher strip
  - subject workspace
  - review surfaces

The page should feel deliberate and quiet, not empty and not overloaded.

### 2. Strengthen the teacher workflow hierarchy

Required outcome:

- the selected teacher must remain obvious
- the top strip must remain limited to:
  - identity
  - credited weekly load
  - concurrent teaching
  - remaining capacity
  - essential draft actions
- all extra explanatory material must remain in secondary disclosure

Do not expand the strip back into a dashboard.

### 3. Refine the toolbar into a real operations bar

Required outcome:

- the toolbar must feel like one coherent operations bar
- coverage, workflow mode, review status, and actions must read as one organized control model
- the current `Settings` dropdown must feel intentional, not like overflow clutter

Specific fixes to include:

- remove raw `title` attributes from icon buttons
- replace them with proper `Tooltip` usage
- make icon-only controls self-explanatory through the project tooltip pattern

### 4. Clean up the subject workspace density

Required outcome:

- reduce badge spam in `SubjectRow`
- reduce broad color-noise and “rainbow wall” behavior
- preserve term identity and program identity without stacking too many equal-weight signals

Preferred direction:

- explicit `Term 1 / Term 2 / Term 3` remains
- calmer accents over broad tinted slabs
- avoid duplicate badges that say the same thing twice

### 5. Improve direct manipulation clarity

Required outcome:

- assignment removal must remain fast and obvious
- hovered destructive states should feel intentional, not accidental
- swap/take behavior should remain understandable

Do not fall back to checkbox-heavy interaction.

### 6. Reduce render-loop shaping in the workspace

This is a UI refactor, but one small structural cleanup should be included because it directly affects page responsiveness.

Required outcome:

- stop filtering ownership/conflict maps inside large JSX render loops where reasonably avoidable
- move that shaping one step higher or into a local memoized view-model
- keep the solution simple

Do **not** build a new state system.
Do **not** overengineer this.

### 7. Keep the page ready for upcoming SPA/SPS breakout lanes

Do not implement breakout dissemination here.

But the UI must not deepen the coarse umbrella-subject assumption.

Required outcome:

- subject rendering stays compatible with explicit specialization-lane rows
- the visual hierarchy must be able to display multiple special-program lanes cleanly
- do not hardcode assumptions that only one generic `SPA_SPEC` or `SPS_SPEC` row will exist

---

## Specific Remaining Issues You Must Include

These are confirmed and should be explicitly fixed or improved in this pass:

1. `AssignmentWorkspace` still filters `savedOwnershipMap`, `pendingOwnershipMap`, and `savedConflictMap` inside render loops per subject.
2. Some icon controls still rely on raw `title` attributes instead of `Tooltip`.
3. The current page still feels like the toolbar, teacher strip, and workspace are all asking for attention at once.
4. `SubjectRow` still carries more visual weight than it should for repeated dense lists.

Do not ignore these.

---

## Design-System Constraints

Mandatory:

- preserve no-scroll architecture
- use `@/ui/*` primitives only
- no native `<select>` or raw form controls
- no raw HTML `title`-based explanation as the final pattern
- preserve mobile safety where current page already supports it
- preserve strict DepEd semantic colors where actually relevant

Do not turn the page into:

- a dashboard-card explosion
- a modal maze
- a dark-pattern dense control wall

---

## Tailnet Verification Requirements

You must verify on:

- `https://njgrm.buru-degree.ts.net`
- Admin: `1000001 / AdminSY2026!`

Verify all of the following:

1. The page still opens on the correct active school year and keeps the current stable teaching-load truth.
2. One `SCI` teacher still feels understandable after the UI cleanup.
3. One `TLE` teacher still feels understandable after the UI cleanup.
4. The toolbar feels cleaner and all icon-only controls are explained without raw title-only reliance.
5. The assignment workspace feels less noisy and less “rainbow-heavy”.
6. Direct assign/remove behavior is still obvious and usable.
7. The page feels calmer overall without becoming slower or more hidden.

If it still feels visually messy after the first implementation, keep fixing in the same pass.

---

## Build Requirement

Run:

- `npm --prefix atlas-client run build`

---

## Evidence Log Requirement

Append to `docs/verification/evidence-log.md` with:

- files changed
- what was visually simplified
- what secondary disclosures stayed secondary
- whether raw `title` reliance was removed from the touched controls
- what render-shaping cleanup was done in the workspace
- Tailnet verification notes for one `SCI` teacher and one `TLE` teacher
- final verdict: `GO` or `NO-GO`

Do **not** call this `GO` unless the page is materially calmer and clearer on Tailnet while preserving the stabilized truth contract.

---

## Final Execution Rule

This pass should leave Teaching Load as:

- modular
- truthful
- calmer
- scheduler-first
- and ready for the later SPA/SPS breakout-lane stream

Do not reopen the firefight.
Finish the UI.

