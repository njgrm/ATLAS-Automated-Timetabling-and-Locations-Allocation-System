# Copilot Execution Prompt: Phase 3 Subject Domain Reset + UX One-Shot

## Objective

Reset the `Subjects` plus `Teaching Load` contract so ATLAS reflects the stakeholder school's actual workflow after the MATATAG TLE change.

This pass must:
- fix subject data and seed drift
- stop making specialization the primary regular-track qualification tool
- move subject ownership toward department-level defaults
- surface SPA/SPS specialization detail correctly
- repair inactive-subject delete blockers caused by stale assignment rows
- improve the subject-page UX so the scheduler can trust and operate it

## Required Context

Read these first:
- `phasePlan.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `docs/analysis/phase3-subject-domain-and-shell-audit-2026-05-21.md`
- `docs/analysis/phase3-stakeholder-baseline-mapping-and-live-drift-audit-2026-05-19.md`
- `docs/analysis/phase3-matatag-tle-reset-and-faculty-baseline-audit-2026-05-21.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

Inspect the current implementation directly:
- `atlas-client/src/pages/Subjects.tsx`
- `atlas-client/src/components/subjects/SubjectFormModal.tsx`
- `atlas-client/src/lib/subject-constants.ts`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-server/src/services/subject.service.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `prisma/schema.prisma`
- `prisma/seed.js`

## Facts To Treat As Settled

- Grades 9-10 TLE no longer split into specialization cohorts.
- Regular-track TLE should behave like a section-scoped rotating family across Grades `7-10`.
- Stakeholder-facing schedule outputs remain normalized:
  - `SCIENCE`
  - `TLE`
  - `SPECIALIZATION`
  - `RESEARCH`
- The stakeholder workflow is department-head driven:
  - department heads often decide teacher placements
  - schedulers manually encode those placements
  - autofill is only fallback behavior
  - manual/saved placements must be respected and never casually overwritten
- Current live DB still has `265` historical `FacultySubject` rows attached to inactive subjects, which is blocking delete behavior.
- Current subject form sources specialization options from `/faculty/specializations`, which is the wrong authority for subject-contract state.

## Scope

### A. Reset subject ownership around department defaults

Implement a department-first subject ownership contract.

That means:
- subjects must carry or expose department ownership clearly
- regular qualification and autofill must lean on department ownership first
- specialization gating should become secondary metadata, not the main regular-track qualification contract

Bias strongly toward:
- `SCI`
- `MATH`
- `ENG`
- `TLE`
- `FIL`
- `ESP`
- `MAPEH`
- `AP`

### B. Align the subject contract to the MATATAG TLE reality

Make the regular TLE subject family coherent for Grades `7-10`.

That includes:
- no return to Grade 9-10 TLE split specialization rows
- no stale dynamic `TLE_SPEC_*` assumptions for regular-track generation
- if internal modular TLE child rows remain necessary for rotation logic, keep them
- but the operator-facing contract must present TLE as a single rotating family, not as four disconnected specialization-driven setup items

### C. Keep SPA/SPS specialization detail visible and inspectable

Do not flatten SPA/SPS into invisible metadata.

The subject page must let the scheduler:
- see which SPA/SPS specialization values are currently enabled
- understand which ones are coming from upstream-enabled offerings
- distinguish subject display labels from internal canonical rows

Do not source these values from faculty specialization lists.
Use the correct subject/offering contract source.

### D. Fix subject delete and stale historical assignment cleanup

Repair the current behavior where inactive subjects cannot be deleted even though the visible teaching-load page does not show a meaningful active dependency.

Your solution must:
- distinguish active blockers from stale historical blockers
- expose clear delete-block reasons in the UI
- provide safe cleanup/archive semantics for inactive subjects with stale historical `FacultySubject` rows
- avoid silent destructive data loss

If the safest answer is archive + cleanup rather than hard delete, implement that path explicitly.

### E. Improve subject-page UX and data trustworthiness

Repair the subject page so it behaves like a scheduler control surface, not a hidden mutation screen.

That includes:
- no hidden seeding/sync mutation on passive page load
- explicit sync actions where mutation is needed
- visible department ownership
- visible rotation family / normalized output label where relevant
- visible specialization detail for SPA/SPS rows
- visible delete blocker reason
- visible active/inactive and sync-driven state

### F. Strengthen teaching-load authority behavior

Ensure the teaching-load workflow matches the actual stakeholder process:
- manual placements are authoritative
- autofill respects them
- department ownership is the main default
- subject qualification should not depend primarily on the specialization-mapping page for regular-track work

If a local lock or preserve mechanism is required to make this explicit and safe, add it.

## UX/UI Audit Requirements

You must perform and explicitly log a code-first UX audit for:
- `Subjects`
- `Teaching Load`

At minimum validate and repair:
- form-control primitive usage
- hidden mutation behavior
- filter/action clarity
- inspectability of specialization and ownership state
- delete/archive affordances
- empty/error/loading states
- mobile and dense-table scanability

Known current UI defects to treat as real:
- raw button-chip controls in `SubjectFormModal`
- specialization shown only as a count badge on the subject list
- no explicit inspectable subject ownership model
- subject delete toast can report a blocker with no visible matching row in Teaching Load

## Explicit Non-Goals

Do not:
- redesign the whole shell/sidebar in this prompt
- reopen campus topology work
- reopen stale TLE cohort/fallback work
- fabricate upstream faculty counts to match stakeholder counts

## Required Live/DB Verification

You must prove:
1. the active subject contract now matches the MATATAG regular TLE reality
2. SPA/SPS specialization detail is inspectable from the subject workflow
3. subject ownership is department-centered in the new contract
4. inactive-subject delete/archive behavior is now truthful and safe
5. teaching-load/autofill behavior still preserves manual placements

At minimum verify with:
- server build/typecheck
- client build/typecheck
- touched targeted tests
- direct DB checks for inactive subject assignment blockers
- live Tailnet/API validation for the subject list and relevant CRUD/sync/delete paths

## Execution Discipline

- Provide at most one short execution preamble, then act.
- Do not narrate probe retries.
- If a check is noisy, narrow it silently.
- Limit this pass to at most 2 repair iterations before returning explicit blockers.

## Required Output

Return:
1. before-state summary
2. files changed
3. exact subject-contract reset made
4. exact UX problems fixed
5. delete/archive blocker findings and repair
6. teaching-load authority findings and repair
7. verification results
8. `GO` or `NO-GO` for this prompt scope

## GO Condition

Return `GO` only if all of the following are true:
- the subject domain now reflects section-scoped MATATAG TLE reality
- department ownership is the primary qualification baseline in the repaired contract
- SPA/SPS specialization detail is visible and inspectable where needed
- inactive-subject delete/archive behavior is truthful and safe
- subject page no longer performs hidden mutation on passive load
- teaching-load/autofill still respects manual placements

If not, return `NO-GO` with the exact remaining blocker cluster.
