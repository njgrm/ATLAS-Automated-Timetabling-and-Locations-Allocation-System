# Gemini Execution Prompt: Phase 3 Teaching Load Grade Scope And Section Allocation Workflow Fix One-Shot

## Mission

Repair the current Teaching Load refactor so the page behaves honestly for both `By Teacher` and `Section Allocation`.

The latest table-first pass is still not closure-grade because:

- grade-scoped subjects are leaking into the wrong sections
- section mode is still partially implemented on top of a teacher-centric draft model
- save, swap, and inspector behavior are still misleading in section-first work
- adviser-aware identity cues regressed
- several dense interactions remain awkward or redundant

This pass must fix those issues without abandoning:

- the table-first page direction
- the persistent right-hand panel
- the current modular component architecture

---

## Out Of Scope

Do not do any of the following in this pass:

- reopen backend scheduling math
- change REST API contracts
- rebuild the page into a dashboard
- replace the persistent side panel with modal-first arithmetic
- introduce a new state library

This is a frontend workflow-truth repair pass.

---

## Required References

Read and follow these before editing:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

Inspect these current files directly before editing:

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

1. `TeachingLoad.tsx` still shapes `sectionsBySubject` using section grade filter and program scope only, without respecting `subject.gradeLevels`.
2. STE-related subjects therefore leak into the wrong grade levels inside Teaching Load even though the `Subjects` and `Sections` contracts already respect grade scope.
3. Section mode still has no fully honest save model of its own and still depends on selected-teacher batch-save assumptions.
4. The page still enters false `read-only` behavior under current year-55 verified runtime even though split-brain is warning-only and not blocking.
5. The right-hand panel remains teacher-only and does not switch to section-aware detail in `Section Allocation`.
6. Adviser-aware identity regressed:
   - adviser star cue is gone
   - homeroom/advisory context is weak or missing in the teacher table and side panel
7. The block-scoped sticky teacher action strip still leaves an awkward visual gap below the master header.
8. The inline `X` remove affordance is redundant because checklist toggling already represents the same action.
9. Whole-card and whole-grade-row click targets are still incomplete or too narrow.
10. Section-mode candidate load percentages are not color-coded and are unreadable at a glance.
11. Section-mode candidate rows do not clearly communicate current ownership context, so they read as if all teachers are equally free.
12. Swap behavior is still not operationally honest because it remains selected-teacher-centric under the hood.
13. The teacher-focused side panel still lacks a strong class summary parity with the better teacher surfaces elsewhere in ATLAS.

These are the problems to solve.

---

## Product Decisions To Follow

These are now authoritative for this pass.

### 1. Grade-level awareness is mandatory

Teaching Load must respect the same subject grade-scope contract already defined in the subject catalog and already respected in section-first surfaces.

If a subject is only valid for certain grades, it must not appear as demand outside those grades in Teaching Load.

This is especially critical for STE-scoped subject rows.

### 2. Section Allocation must be a real section-first workflow

`Section Allocation` is not just a browser of data.
It is an active assignment workspace.

That means it must support:

- section-first context
- real assignment actions
- real save behavior
- real swap behavior

Do not leave the mode half teacher-centric under the hood.

### 3. Persistent panel must become context-aware

Keep the persistent right-hand panel, but it must change based on active workflow:

- in `By Teacher`, show teacher workload and teacher assignment detail
- in `Section Allocation`, show section-first staffing context and assignment detail

Do not leave section-mode users staring at the wrong object model.

### 4. Adviser-aware behavior must return

Teacher surfaces must again show:

- adviser star identity
- homeroom awareness
- advisory-related context where relevant

### 5. Save must be visible and trustworthy

If section-mode actions create draft state, the user must be able to clearly save those changes from the section workflow.

Do not depend on hidden selected-teacher side effects to make save possible.

### 6. Swap must be truthful

When a section ownership swap is initiated:

- the current owner must visibly lose the section in draft state
- the target teacher must visibly gain it
- the UI must not suggest both still own it

### 7. Simplify selection mechanics

The checklist selection already provides add/remove meaning.
Do not keep a redundant inline `X` if it only adds noise.

---

## Required Corrections

### 1. Fix page-level subject-to-section demand shaping

Required outcome:

- enforce both:
  - `subject.gradeLevels`
  - `subject.programScopes`
- stop surfacing STE and other scoped subjects to irrelevant grade levels in Teaching Load

This must bring page-level demand shaping into parity with the existing subject contract instead of inventing broader demand locally.

### 2. Make section mode truly saveable

Required outcome:

- section-mode assignment actions must create visible and trustworthy draft state
- section mode must expose a clear save action
- save flow must not depend on hidden selected-teacher assumptions

If the chosen pattern is a sticky local section toolbar, keep it compact and obvious.

### 3. Remove false read-only behavior

Required outcome:

- stop disabling draft work under the current verified year-55 warning-only runtime
- preserve lock behavior only for true blocking integrity states

Do not keep the page unwritable when runtime is healthy enough for normal operator work.

### 4. Make the right-hand panel switch context in section mode

Required outcome:

- in `By Teacher`, keep teacher workload and handled-class detail
- in `Section Allocation`, switch the panel to section information first
- include section identity, program, staffed subjects, missing subjects, and assignment context

Do not keep section-mode users in a teacher-only inspector.

### 5. Restore adviser-aware identity

Required outcome:

- restore adviser star identity in the teacher table
- show homeroom or advisory context again in the persistent panel
- make teacher identity parity feel closer to the stronger adviser-aware `Teachers` experience

### 6. Fix sticky-strip positioning

Required outcome:

- keep the block-scoped sticky behavior
- remove the awkward gap beneath the master header
- the sticky strip should visually attach directly below the header above it

### 7. Remove the redundant inline `X`

Required outcome:

- remove the hover `X` removal affordance from section cards if checklist toggling already covers the action
- keep the card calmer and avoid duplicate delete metaphors

### 8. Make cards and grade rows fully clickable

Required outcome:

- the whole section/session card should be clickable for toggle behavior, not just the checkbox
- the whole grade row should be clickable to expand or collapse, not just a small left-side button

Do not make users hunt for narrow click targets in a high-volume scheduling workflow.

### 9. Color-code section-mode candidate loads

Required outcome:

- candidate load signals in `Section Allocation` must use the same honest severity semantics as teacher mode
- `> 30h` warning
- `> 40h` danger

Do not leave candidate loads in uniform dark text.

### 10. Show current ownership context clearly in section mode

Required outcome:

- subject rows inside a section must clearly show who currently owns them
- candidate rows must not read as if all teachers are equally free
- if a teacher already owns the row or is the current holder, the UI must state that plainly

### 11. Make swap behavior operationally honest

Required outcome:

- swap actions must update both source and destination draft state
- source teacher loses the section
- destination teacher gains the section
- visible ownership context and save state must update immediately and consistently

Do not keep a fake swap that only mutates one side of the interaction model.

### 12. Add handled-class summary into the teacher-side panel

Required outcome:

- the teacher-focused panel must include a readable summary of handled classes
- include:
  - subject
  - section
  - rotation or specialization identity where relevant
  - homeroom/advisory cue where appropriate

This should feel much closer to the useful handled-class summary already available on stronger teacher-facing surfaces.

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
- another dashboard-style split workspace
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
8. Section-mode candidate load signals are color-coded correctly.
9. Current owner context is clear in section mode.
10. Swap behavior updates both source and destination ownership truth in the UI.

If the first implementation still leaves section mode half teacher-centric, keep fixing in the same pass.

---

## Evidence And Logging Requirements

Append to `docs/verification/evidence-log.md` with:

- files changed
- exact live runtime year/source state used
- proof that grade-level subject shaping is fixed
- proof that false read-only state is removed
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
