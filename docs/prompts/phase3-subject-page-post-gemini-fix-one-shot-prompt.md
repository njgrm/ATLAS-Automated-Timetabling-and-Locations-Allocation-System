# Copilot Execution Prompt: Phase 3 Subject Page Post-Gemini Fix One-Shot

## Objective

Take the current Gemini-overhauled `Subjects` page and finish the job.

This pass is not a fresh redesign.
It is a focused repair pass that must:
- keep the cleaner structure Gemini introduced
- fix the remaining workflow bugs
- reduce scheduler friction further
- and make the page trustworthy for real subject cleanup and teaching-load remediation work

## Required Context

Read these first:
- `phasePlan.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `docs/analysis/phase3-subject-followup-audit-2026-05-21.md`
- `docs/analysis/phase3-subject-page-post-gemini-audit-2026-05-22.md`
- `docs/analysis/phase3-stakeholder-baseline-mapping-and-live-drift-audit-2026-05-19.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

Inspect directly:
- `atlas-client/src/pages/Subjects.tsx`
- `atlas-client/src/components/subjects/SubjectRow.tsx`
- `atlas-client/src/components/subjects/SubjectFormModal.tsx`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/lib/subject-constants.ts`
- `atlas-client/src/types.ts`
- `atlas-server/src/routes/subject.router.ts`
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `prisma/schema.prisma`
- `prisma/seed.js`

## Facts To Treat As Settled

- the Gemini pass improved layout, but did not close the page
- `SubjectRow.tsx` extraction and the teacher-coverage sheet are directionally correct
- hidden action clusters and hover-only affordances are still a scheduler problem
- current `Subjects.tsx` still hardcodes `schoolYearId: 1` in teacher-coverage and assignment actions
- inactive-subject delete blockers are real and still need the strongest workflow treatment
- stakeholder schedules support equal visible slot lengths for specialization/research blocks, but do not prove a blanket `240`-minute reset for every internal special-program row
- specialization editing should remain mostly sync-driven and view-only
- department ownership remains the right qualification baseline simplification

## Scope

### A. Repair hard functional bugs first

You must fix:
- any `schoolYearId: 1` hardcoding in subject-page teaching-load workflows
- any subject-page path that can mutate or inspect the wrong school year
- any live `/subjects` runtime break you can directly attribute to the touched subject/faculty contract work

If the live `/subjects` failure is not caused by this page’s contract work, say so explicitly with evidence.

### B. Make actions always discoverable on touch and keyboard

The scheduler must not need hover to discover critical actions.

At minimum:
- the row-level overflow action must remain visibly present at all times
- teacher coverage sheet actions must not depend on hover-only reveal
- touch and keyboard users must have the same action discoverability as mouse users

### C. Remove raw HTML button drift

Replace raw button clusters in subject-page flows with project-approved primitives.

This applies especially to:
- time-mode toggle
- grade-level multi-select chips
- program-scope chips
- inter-section pooling grade chips
- specialization inspect trigger if still using raw button
- feature-remove controls where appropriate

Do not leave this pass with the modal still relying on generic raw buttons for primary field interactions.

### D. Strengthen the ownership contract UX

The ownership contract is persisted now, but still not operator-trustworthy enough in the UI.

You must make the subject contract clearly visible and understandable.

At minimum the scheduler must be able to inspect:
- output label
- owner department
- qualification priority
- rotation family
- whether the row is system-managed
- whether specialization values are sync-driven

If some of these are editable and some are read-only, make that distinction explicit.

### E. Make specialization visibility better without reopening specialization-heavy setup

Do not reintroduce specialization mapping as a first-class scheduler workflow.

But for SPA/SPS/STE rows, improve inspectability so the scheduler can clearly see:
- which upstream-enabled specialization values are attached
- whether they came from the offering contract
- what the outward-facing schedule label is

The current “N specs” count link is not enough by itself.

### F. Tighten delete, archive, and reset guidance

Keep the remediation features already added, but make the flow more obvious.

You must improve:
- the blocked-delete decision tree
- the archive visibility story
- the inactive/archived discoverability story
- subject-scoped cleanup understanding
- global reset placement and explanation

The global reset should remain available, but should feel like:
- an advanced repair action
- clearly destructive
- preview-first
- separate from normal daily scheduling tasks

### G. Finish small but real scanability issues

Fix at least:
- incorrect pagination range text
- any overly dense secondary badges or duplicated signals still left in the row
- any confusing `Archived` wording if it still implies a stronger archive system than what actually exists

## UX/UI Rules

- Preserve the current no-scroll architecture.
- Keep the improved toolbar/table/sheet structure unless a specific defect requires adjustment.
- Prefer concise, scheduler-first phrasing over technical labels.
- Do not add a new heavy setup page.
- Do not bring back badge soup.

## Non-Goals

Do not:
- redesign the entire shell/sidebar here
- reopen specialization mapping as a primary page
- force every special-program row to `240`
- reopen TLE cohort logic
- merge this pass into a broad generator-repair stream

## Required Verification

You must verify:
1. row and sheet actions are discoverable without hover
2. no subject-page teaching-load flow still uses hardcoded `schoolYearId: 1`
3. ownership contract data is clearer and more complete in the UI
4. specialization inspection is materially more informative
5. reset/delete/archive flow is easier to understand
6. pagination text is correct
7. builds still pass

At minimum run:
- `npm --prefix atlas-client run build`
- `npm --prefix atlas-server run build`
- direct source inspection for remaining raw button drift
- live or local runtime verification if the `/subjects` endpoint is available

## Execution Discipline

- Provide at most one short execution preamble, then act.
- Do not spend the pass restating the previous Gemini summary.
- Keep the pass focused on scheduler usability and subject-contract correctness.
- If live verification is blocked by runtime infrastructure, say exactly where and stop claiming live GO.

## Required Output

Return:
1. before-state summary
2. exact Gemini improvements retained
3. exact functional bugs fixed
4. exact UX/UI issues fixed
5. ownership/specialization contract changes in the UI
6. remaining blockers, if any
7. verification results
8. `GO` or `NO-GO` for this prompt scope

## GO Condition

Return `GO` only if:
- no subject-page teaching-load flow is pinned to school year `1`
- action discoverability no longer depends on hover
- raw button drift has been materially removed from the subject workflow
- ownership contract visibility is clearer and operator-trustworthy
- specialization inspection is stronger without reintroducing specialization-heavy setup
- delete/archive/reset flows are easier for schedulers to follow
- builds pass

If not, return `NO-GO` with the exact remaining blocker cluster.
