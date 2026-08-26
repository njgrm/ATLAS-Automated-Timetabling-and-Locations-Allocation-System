# Gemini Execution Prompt: Phase 3 Teaching Load Section-Mode Truth And Workflow Repair One-Shot

## Mission

Repair the newly landed Teaching Load table workflow so `By Teacher` and `Section Allocation` both become truthful, usable, and saveable.

The latest pass improved some surface semantics, but it still has serious operator-facing regressions:

- `Section Allocation` is still not truly section-first in behavior
- the page still shows false read-only behavior
- section-mode save/swap behavior is not operationally valid
- the right-hand panel still stays teacher-centric even when the user is working section-first
- grade-level and adviser-aware truth regressed
- sticky behavior and table affordances still feel awkward

This pass must fix those issues without abandoning:

- the table-first Teaching Load direction
- the persistent right-hand side panel
- the modularized refactor baseline

---

## Out Of Scope

Do not do any of the following in this pass:

- reopen backend staffing math
- change REST API contracts
- redesign the page into a dashboard again
- replace the persistent side panel with modal-first teacher arithmetic
- introduce a new state library

This is a frontend truth and workflow repair pass.

---

## Required References

Read and follow these before editing:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

Also inspect the current touched files before modifying:

- `atlas-client/src/pages/TeachingLoad.tsx`
- `atlas-client/src/hooks/useTeachingLoadData.ts`
- `atlas-client/src/hooks/useTeachingLoadUI.ts`
- `atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx`
- `atlas-client/src/components/faculty-assignments/SectionGridMode.tsx`
- `atlas-client/src/components/faculty-assignments/WorkloadInspector.tsx`
- `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
- `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx`

---

## Current Verified Failures

These are already confirmed and must be treated as real defects:

1. `sectionsBySubject` in `TeachingLoad.tsx` still ignores `subject.gradeLevels`, so STE-related subjects can be surfaced across all grade levels instead of only the grades defined on the subject contract.
2. `Section Allocation` still has no clear save action of its own and still relies on selected-teacher draft semantics behind the scenes.
3. The page is still entering `read-only` in a year-55 runtime state where:
   - runtime year is verified
   - quarantine is warning-only, not blocking
   - summary/coverage truth is clean
4. The right-hand panel is still teacher-only and does not switch to section-aware information when working in `Section Allocation`.
5. Adviser-aware UI regressed:
   - adviser star identity is gone
   - homeroom/advisory cues are missing from the teacher table and the persistent panel
6. The block-scoped sticky action strip has a visible gap from the master header instead of snapping directly beneath it.
7. The inline `X` removal affordance is redundant and visually noisy because selection is already checklist-based.
8. Section/session cards are still not fully click-targeted:
   - only the small checklist is reliably actionable
   - grade rows still do not feel fully row-clickable
9. Load percentages in `Section Allocation` candidates are not color-coded, making overload review unreadable at a glance.
10. Section-mode candidate rows behave as if all teachers are free because current section ownership context is not shown clearly enough.
11. Swap behavior is still draft-selected-teacher-centric and not operationally correct:
   - the selected teacher can appear to gain a section
   - but the originating owner does not correctly lose possession in a trustworthy UI flow
12. The right-hand panel still lacks a clean summary of the teacher's actual handled subject-section list similar to the `Teachers` page.

These are the problems to solve.

---

## Product Decisions To Follow

These are now authoritative for this pass.

### 1. Grade-level awareness is mandatory

`Teaching Load` must respect the same grade-level subject contract already defined on the `Subjects` page and already respected by the `Sections` page.

If a subject is only valid for a specific grade set, it must not appear as assignable demand outside that grade set.

This is especially important for `STE` subject rows.

### 2. Section Allocation must be a real working mode

`Section Allocation` is not a read-only browser.
It is an active scheduler workspace.

That means it must support:

- honest section-first detail
- real assignment actions
- real save semantics
- real swap semantics

Do not leave it half teacher-first under the hood.

### 3. Persistent side panel must be context-aware

Keep the persistent right-hand panel, but it must become context-sensitive:

- in `By Teacher`, it should show teacher workload and teacher assignment detail
- in `Section Allocation`, it should switch to section-first detail and assignment context

Do not leave section-mode users staring at irrelevant teacher-only detail.

### 4. Adviser-aware behavior must return

Teacher surfaces must again show:

- adviser star identity
- homeroom awareness
- advisory-related context where relevant

### 5. Save behavior must be visible and trustworthy

If section-mode actions create draft state, the user must be able to clearly save those draft changes from the section workflow.

Do not require invisible teacher-selection side effects for save to become possible.

### 6. Swap must be truthful

When a section ownership swap is initiated:

- the current owner must visibly lose that section in draft state
- the target teacher must visibly gain it
- the UI must not suggest both still own it

### 7. Simplify row actions

The checklist selection already provides remove/add behavior.
Do not keep a redundant inline `X` remove affordance if it adds clutter.

---

## Required Corrections

### 1. Fix subject-to-section demand shaping

Required outcome:

- respect both:
  - `subject.gradeLevels`
  - `subject.programScopes`
- stop surfacing `STE` and other scoped subjects to irrelevant grades

This must align `Teaching Load` demand shaping with the existing subject contract instead of inventing broader coverage locally.

### 2. Make section mode truly saveable

Required outcome:

- section-mode assignment actions must produce visible, trustworthy draft state
- section mode must expose a clear save action
- save flow must not depend on hidden selected-teacher assumptions

If needed, make save state visible in the section-mode panel or local sticky action area.

### 3. Remove false read-only behavior

Required outcome:

- stop disabling draft work under the current verified year-55 warning-only runtime
- preserve lock behavior only for true blocking states

Do not keep the page unwritable when:

- runtime year is verified
- quarantine is warning-only
- the backend is reachable

### 4. Make the right-hand panel switch context in section mode

Required outcome:

- in `By Teacher`, keep teacher workload/detail
- in `Section Allocation`, show section information first
- include:
  - section identity
  - program
  - current staffed subjects
  - missing subjects
  - candidate assignment context

Do not keep the panel pinned to irrelevant teacher detail while the user is clearly operating on a section row.

### 5. Restore adviser-aware UI

Required outcome:

- restore adviser star identity in the teacher table
- show homeroom/advisory context again in the persistent panel
- make the teacher summary feel parity-aligned with the stronger adviser cues previously present in `Teachers`

### 6. Fix sticky header positioning

Required outcome:

- keep the teacher action strip block-scoped sticky
- remove the awkward vertical gap beneath the master header
- the sticky strip should visually attach directly below the header above it

### 7. Remove redundant inline `X`

Required outcome:

- remove the hover `X` remove affordance from subject/session cards if the checklist already handles selection toggling
- keep the card calm and avoid duplicate delete metaphors

### 8. Make cards and grade rows fully clickable

Required outcome:

- the whole section/session card should be clickable for toggle behavior, not just the tiny checklist zone
- the whole grade header row should be clickable to expand/collapse, not just the small left-side button

Do not make users hunt for narrow click targets in a dense staffing workflow.

### 9. Color-code load in section-mode candidate rows

Required outcome:

- candidate teacher load percentages in `Section Allocation` must use the same reviewed color semantics as teacher mode
- `>30h` warning
- `>40h` danger

Do not leave all candidate loads in neutral dark text.

### 10. Show current teacher ownership context in section mode

Required outcome:

- each section-mode subject row should clearly show the current owner when one exists
- candidate rows should make it clear whether the teacher is already busy with another current ownership relevant to this context
- the UI must stop reading like every candidate is equally free and unattached

### 11. Make swap behavior operationally honest

Required outcome:

- if a swap is initiated from section mode or teacher mode, both sides of the draft state must update correctly
- the origin teacher must lose the section
- the destination teacher must gain the section
- the visible owner context and save state must match that draft truth immediately

Do not keep a fake swap that only partially mutates one side.

### 12. Add teacher assignment summary back into the side panel

Required outcome:

- the teacher-focused panel must include a readable summary of handled classes
- include:
  - subject
  - section
  - relevant rotation or specialization identity
  - homeroom/advisory cue where appropriate

This should feel more like the useful handled-class summary already present on stronger teacher surfaces.

---

## Interaction Constraints

Mandatory:

- preserve no-scroll architecture
- keep the table-first model
- keep the persistent side panel
- use `@/ui/*` primitives only
- preserve compactness without sacrificing clarity
- avoid developer-facing wording

Do not introduce:

- modal-per-teacher arithmetic
- another dashboard-like split workspace
- global page scrolling
- duplicated destructive micro-controls

---

## Tailnet Verification Requirements

You must verify on:

- `https://njgrm.buru-degree.ts.net`
- Admin: `1000001 / AdminSY2026!`

Verify all of the following:

1. STE and other grade-scoped subjects no longer appear across irrelevant grade levels in Teaching Load.
2. Section-mode assignment actions create visible saveable draft state.
3. The page is writable under the current year-55 warning-only runtime.
4. The right-hand panel changes meaningfully in section mode instead of remaining teacher-only.
5. Adviser star and homeroom-aware behavior are visible again.
6. The sticky action strip attaches directly beneath the header without the current gap.
7. The redundant `X` affordance is gone and whole-card click targets work.
8. Section-mode candidate load percentages are color-coded correctly.
9. Current owner context is clear in section mode.
10. Swap behavior updates both source and destination ownership truth in the UI.

If the first implementation still leaves section mode half teacher-centric, keep fixing in the same pass.

---

## Evidence And Logging Requirements

Append to `docs/verification/evidence-log.md` with:

- files changed
- exact live runtime year/source state used
- proof that grade-level subject shaping is fixed
- proof that read-only false lock is removed
- proof that section-mode save and swap behavior now work
- proof that adviser-aware UI returned
- final verdict: `GO` or `NO-GO`

Append only. Do not overwrite prior evidence entries.

---

## GO / NO-GO

### GO only if:

- grade-level subject scope is respected in Teaching Load
- section mode has real save behavior
- false read-only state is gone
- side panel context is correct for both teacher and section workflows
- adviser-aware cues are back
- swap behavior is operationally honest

### NO-GO if:

- STE or other scoped subjects still appear across wrong grades
- section mode still cannot clearly save
- the page still presents as read-only under current healthy runtime
- the side panel still shows teacher-only detail in section mode
- swap behavior is still only half-applied in the UI
