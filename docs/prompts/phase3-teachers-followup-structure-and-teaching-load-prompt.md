# Gemini Execution Prompt: Phase 3 Teachers Structure + Teaching Load Follow-Up

## Objective

Fix the remaining structural and workflow regressions introduced after the recent `Teachers` follow-up pass.

This is not a fresh redesign.
It is a corrective pass for:

- table/header structure
- advisory visibility
- grade-badge parity
- copy cleanup
- dead columns/filters
- residual specialization-heavy `Teaching Load` framing
- encoding drift that is still visible in operator-facing surfaces

## Required Context

Read these first:
- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-faculty-and-teaching-load-ux-audit-2026-05-22.md`
- `docs/analysis/phase3-faculty-followup-audit-2026-05-22.md`
- `docs/analysis/phase3-teachers-followup-structure-audit-2026-05-22.md`

Inspect directly:
- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/components/faculty/FacultyRow.tsx`
- `atlas-client/src/components/faculty/FacultyProfileSheet.tsx`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/components/AppShell.tsx`
- `atlas-client/src/pages/Subjects.tsx`
- any shared grade-badge or list/pagination helpers already used by `Subjects`

## Facts To Treat As Settled

- Scheduler-facing labels should remain `Teachers` and `Teaching Load`.
- `Teachers` must stay roster-first.
- `Teaching Load` remains the authoritative assignment-editing page.
- The current `Teachers` table structure is wrong because the header and body no longer have matching columns.
- `Contact` information is currently dead UI noise and should be removed.
- Advisory section identity matters and should be explicitly visible, not implied by a star alone.
- `GR7`, `GR8`, `GR9`, and `GR10` badges should remain color-coded like the established `Subjects` counterpart.
- The system is moving away from specialization-first scheduler UX and toward calmer department-first assignment thinking.
- Mojibake or encoding drift must not remain in visible UI strings.

## Scope

### A. Repair the `Teachers` table structure

Required:
- make header and body column counts match exactly
- restore a calmer header style closer to the `Subjects` table pattern
- remove the dead `Contact` column
- if status remains visible in the row, give it a proper header and a deliberate reason to exist
- if status does not deserve column prominence, remove that standalone cell instead of leaving the table structurally broken

### B. Restore grade badge parity

Required:
- use `GR7`, `GR8`, `GR9`, and `GR10`
- restore the same semantic grade-color behavior used in `Subjects`
- do not leave neutral outline grade badges where color helps scanability

### C. Make advisory context explicit

Required:
- show the actual advisory section in the `Teachers` table and/or profile drawer when available
- do not stop at `isClassAdviser` plus credit text
- make the relationship understandable enough that a scheduler can tell which class the teacher advises

### D. Remove dead or unclear UI

Required:
- remove dead contact placeholders from table and drawer
- reassess the `Excluded` filter and status presentation
- if exclusion remains filterable, explain it more clearly or rename it so it does not feel like a ghost control
- remove any remaining row-level UI that adds no operational value

### E. Continue the `Teaching Load` simplification

This prompt is not a full `Teaching Load` redesign, but it must fix the most obvious drift that now conflicts with the renamed `Teachers` workflow.

Required direction:
- remove or demote specialization-first framing that is still obvious to schedulers
- reduce visible specialization-heavy filter/group language where the department-first direction should now lead
- clean up visible mojibake and low-trust copy
- verify the page still renders correctly after the recent route and targeting changes

Do not leave `Teaching Load` with old specialization-centric group labels if the rest of the product is moving away from that model.

### F. Improve readability

Required:
- reduce micro-text in identity and summary areas
- keep full words where they fit comfortably
- make table and drawer identity content easier to scan

## Out Of Scope

Do not:
- redesign the entire shell in this prompt
- rewrite backend qualification logic unless it is directly necessary for visible UX correction
- fake new advisory data that does not actually exist

## Verification Gates

Required:
- client build
- direct code verification that the `Teachers` table header and body now match
- direct verification that the dead `Contact` UI is gone
- direct verification that advisory section is visible when available
- direct verification that `GR7` to `GR10` badges are color-coded
- direct verification that visible mojibake strings in touched surfaces are removed
- direct verification that `Teaching Load` still renders after the cleanup

If a browser check is available, verify:
- a populated `Teachers` table row
- the profile drawer
- the `Teaching Load` page after navigating from `Teachers`

## Required Output

Return:
1. before-state issues fixed
2. files changed
3. table/header structure decisions made
4. advisory visibility changes made
5. grade-badge/color changes made
6. `Excluded`/status decisions made
7. `Teaching Load` cleanup decisions made
8. readability/copy cleanup made
9. verification results
10. `GO` or `NO-GO` for this prompt scope

## GO Condition

Return `GO` only if:
- the `Teachers` table is structurally correct
- dead contact UI is removed
- advisory section is explicitly visible when available
- grade badges are color-coded with the expected `GR7` through `GR10` semantics
- obvious specialization-heavy drift is reduced in `Teaching Load`
- no visible mojibake remains in the touched UI

If not, return `NO-GO` with the exact remaining blocker.
