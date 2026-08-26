# Gemini Execution Prompt: Phase 3 Teaching Load Refactor Stabilization And Regression Closure One-Shot

## Mission

Stabilize the newly refactored Teaching Load frontend after the major decomposition pass.

This is **not** another broad redesign. The structural split is already real:

- `TeachingLoad.tsx` is now below the project LOC limit
- extracted hooks/components now exist
- the client build passes

But the refactor introduced a small set of product regressions and truth-contract gaps that must be closed before this frontend can be treated as the stable base for the next stream.

Your job is to **preserve the new modular architecture** while fixing the remaining refactor regressions in one pass.

---

## Current Verified State

Verified in code after the refactor:

- `atlas-client/src/pages/TeachingLoad.tsx` is now `386` lines
- extracted files now exist:
  - `atlas-client/src/hooks/useTeachingLoadData.ts`
  - `atlas-client/src/hooks/useTeachingLoadUI.ts`
  - `atlas-client/src/components/faculty-assignments/RosterSidebar.tsx`
  - `atlas-client/src/components/faculty-assignments/TeacherIdentityStrip.tsx`
  - `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx`
  - `atlas-client/src/components/faculty-assignments/AssignmentWorkspace.tsx`
  - `atlas-client/src/components/faculty-assignments/TeachingLoadModals.tsx`
- `npm --prefix atlas-client run build` passes

Live scheduler truth to preserve:

- `schoolId = 1`
- `schoolYearId = 55`
- coverage = `962 / 962`
- `unassignedPairs = 0`
- split-brain / integrity warning is now non-blocking, not incident-grade

This pass must not destabilize that corrected baseline.

---

## Hard Scope

Touch only the Teaching Load frontend and directly related client helpers.

Likely files:

- `atlas-client/src/pages/TeachingLoad.tsx`
- `atlas-client/src/hooks/useTeachingLoadData.ts`
- `atlas-client/src/hooks/useTeachingLoadUI.ts`
- `atlas-client/src/components/faculty-assignments/*`
- `atlas-client/src/lib/faculty-assignment-helpers.ts`

Do **not**:

- reopen backend math
- change API contracts
- change staffing algorithms
- change generation logic
- introduce a new app-wide state library

This is a **frontend stabilization pass** on top of the refactor.

---

## Verified Regressions To Fix

### 1. Rotational breakdown truth was flattened during the refactor

The new `TeacherIdentityStrip` still expects meaningful per-term rotational detail, but `TeachingLoad.tsx` is currently passing simplified family objects with:

- `termBuckets: []`

This broke the truth contract for the new detailed rotational drawer/sheet.

Required outcome:

- restore the real rotation family term breakdown end-to-end
- do not pass fake or empty term buckets into the strip/sheet
- keep the current non-additive term semantics
- preserve honest tied-peak behavior

If the current `loadProfile` shape already contains enough truth, wire it through correctly.
If not, derive a proper frontend view-model from the authoritative helper output.

Do **not** fake the term display with placeholders.

### 2. Global reset became unreachable

The `Global Assignment Reset` dialog still exists, but the refactor removed the visible workflow entrypoint.

Required outcome:

- restore one intentional and discoverable entrypoint for the global reset flow
- keep it clearly separated from ordinary teacher draft tools
- keep the existing typed confirmation behavior
- keep destructive reset gated to the correct runtime state

Do **not** hide it several layers deep again.
Do **not** merge global reset into an ambiguous per-teacher draft action.

### 3. Coverage mode was silently hardcoded

`TeachingLoad.tsx` currently hardcodes:

- `REAL_FACULTY_THEN_TEACHER_X`

with a static `Hybrid Staffing` description.

That is too much product behavior to silently collapse inside a frontend refactor.

Required outcome:

- restore a clear operator-facing coverage-mode control **if the current product still supports multiple modes**
- or, if current verified product direction is now intentionally hybrid-only, make that explicit and remove the dead abstraction cleanly

Important rule:

- do not invent new modes
- do not reopen backend mode semantics
- reflect the real currently supported product behavior honestly

If multiple modes still exist in the current Teaching Load workflow, the refactor must not hide them.

### 4. Residual render-pressure coupling should be reduced one more step

The God Component was split, but `AssignmentWorkspace` is still passing large ownership maps and conflict maps into every `SubjectRow`.

Required outcome:

- reduce unnecessary prop fan-out where safely possible in this pass
- keep the solution simple
- do not do a second architecture rewrite

Acceptable solutions:

- narrower prop contracts
- precomputed row-local lookups closer to where they are used
- small local helper/context only if clearly justified

Do not overengineer this.

### 5. Scheduler wording still needs one more cleanup pass

The refactor improved terminology, but some phrases still feel internal:

- `Repair pending: assignment edits are temporarily blocked.`
- `Load Breakdown Hidden During Integrity Sync`

Required outcome:

- rewrite remaining integrity/read-only phrases into calmer scheduler language
- preserve honesty about blocked edits
- avoid internal system-theory language

Use wording closer to:

- `Assignments temporarily locked while data review finishes`
- `Load details unavailable until review completes`
- or similar plain-language equivalents

Do not reintroduce terms like `Split-Brain`.

---

## UX Guardrails

Preserve the good parts of the refactor:

- keep the modular decomposition
- keep the calmed selected-teacher strip
- keep review state compact rather than reverting to a giant banner
- keep rotational detail in secondary disclosure, not always expanded
- keep no-scroll architecture
- keep `shadcn/ui` primitives only

Do **not**:

- collapse back into a giant page file
- reintroduce duplicate term surfaces
- reintroduce additive-looking term totals
- bring back dense incident-card style banners for warning-only states

---

## Tailnet Verification Requirements

You must verify on:

- `https://njgrm.buru-degree.ts.net`
- Admin: `1000001 / AdminSY2026!`

Test all of the following after implementation:

1. Open Teaching Load on the correct active school year and confirm the refactored page still loads without runtime/import failure.
2. Select one `SCI` teacher and confirm the rotational detail sheet/drawer shows real term buckets, not empty or placeholder data.
3. Select one `TLE` teacher and confirm the same rotational truth path works there too.
4. Confirm the global reset entrypoint is visible, intentional, and opens the real typed-confirmation dialog.
5. Confirm the current coverage-mode behavior is honest:
   - either the selector is back and functional
   - or the UI now clearly communicates that the current workflow is intentionally fixed to the single supported mode
6. Confirm non-blocking warning/review state still stays compact and does not re-expand into a dominant banner.

If any of the above fails, keep fixing in the same pass.

---

## Build Requirement

Run:

- `npm --prefix atlas-client run build`

---

## Evidence Log Requirement

Append to `docs/verification/evidence-log.md` with:

- files changed
- which regression(s) were fixed
- whether rotation family breakdown now receives real term-bucket data
- where the global reset entrypoint now lives
- whether coverage mode is selectable or intentionally fixed
- Tailnet verification notes for one `SCI` teacher and one `TLE` teacher
- final verdict: `GO` or `NO-GO`

Do **not** call this `GO` unless all four regression classes are explicitly addressed:

1. rotation truth wiring
2. global reset reachability
3. coverage-mode honesty
4. scheduler-language cleanup

---

## Final Execution Rule

This pass is meant to **stabilize the refactor**, not reopen the whole page.

The correct outcome is:

- preserve the new architecture
- close the regressions
- verify on Tailnet
- leave the page ready for stricter post-pass audit

