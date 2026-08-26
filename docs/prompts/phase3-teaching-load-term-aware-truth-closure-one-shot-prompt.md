# Copilot Execution Prompt: Phase 3 Teaching Load Term-Aware Truth Closure One-Shot

## Objective

Finalize `Teaching Load` so the page can be treated as closure-grade for this Phase 3 stream.

This pass is not a broad staffing redistribution pass.

It is a truth-and-UX closure pass that must eliminate the remaining contradictions between:

- `Teaching Load` summary headline
- coverage summary
- staffing-needs reporting
- teacher load rotation math shown in the selected-teacher UI

The main requirement is simple:

- the system must stop mixing raw uncovered subject-row completeness with concurrent weekly staffing shortage

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-teaching-load-staffing-blocker-audit-2026-05-23.md`
- `docs/analysis/phase3-teaching-load-staffing-discrepancy-audit-2026-05-23.md`
- `docs/analysis/phase3-teaching-load-staffing-needs-term-math-audit-2026-05-23.md`
- `docs/verification/evidence-log.md`

Inspect directly:

- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-server/src/services/teaching-load-automation.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/components/faculty-assignments/AutoFillSummaryModal.tsx`
- any shared types carrying:
  - `coverageTotals`
  - `rotationFamilyLoadDetails`
  - staffing report contracts

## Live Facts To Treat As Settled

- Teacher load math is already rotation-family aware.
- Live teacher summary exposes:
  - `sectionTeachingHoursRaw`
  - `rotationFamilyOvercountHours`
  - `rotationFamilyLoadDetails`
- Live staffing-needs currently returns:
  - `236` uncovered pairs
  - `53100` missing minutes
  - `885` missing hours
  - `29.5` hires
- That number is internally consistent for raw uncovered subject-section pairs, but it is not yet trustworthy as a concurrent weekly/FTE shortage signal.
- Live summary headline still disagrees with coverage/staffing truth:
  - summary currently reports only `2` unassigned pairs
  - coverage/staffing imply `236` uncovered subject-section pairs
- Rotation-family uncovered blockers still include:
  - `SCI_ES`
  - `SCI_CHEM`
  - `TLE_FCS_EXP`
- Non-rotation uncovered blockers still include:
  - `ENG`
  - `FIL`
  - `MATH`
  - `AP`
  - `STE_ROBOTICS`

## Scope

### In Scope

#### A. Unify the page truth model

Required:

- make `/faculty-assignments/summary` `coverageTotals` use the same active-faculty ownership truth boundary as:
  - `coverage/summary`
  - `report/staffing-needs`
- remove the current contradiction where the page headline implies near-complete coverage while other live endpoints show hundreds of uncovered pairs
- if there are two legitimately different metrics, expose both explicitly instead of collapsing them into one misleading headline

#### B. Split completeness from concurrent weekly shortage

Required:

- staffing-needs must explicitly distinguish:
  - raw uncovered subject-section completeness
  - family-aware concurrent weekly shortage
- do not treat uncovered members of `SCIENCE` and `TLE_ROTATION` as fully concurrent weekly shortage by default
- implement family-lane-aware shortage math using the same rotation-family concepts already used by teacher load math
- keep non-rotation shortage math straightforward

#### C. Make the UI explain the difference clearly

Required:

- `Teaching Load` must explain, in scheduler-facing language, the difference between:
  - uncovered rows
  - adjusted concurrent weekly load
  - rotation-family overlap
- the staffing-needs surface must stop implying that the raw uncovered total is automatically the weekly FTE hiring total
- if both numbers are shown, label them clearly, for example:
  - raw uncovered subject rows
  - concurrent weekly shortage after rotation adjustment
- do not use academic or implementation-heavy jargon if simpler scheduler-facing wording works
- do not leave the most important load explanation trapped only in a transient tooltip
- promote the core explanation into a durable visible surface in the selected-teacher workspace or staffing surface

#### D. Scheduler-first UX cleanup

Required:

- treat this as a closure-grade usability pass, not just a math pass
- do a direct UX/UI audit of `Teaching Load` before editing and use that audit to justify the final UI cleanup choices
- reduce microtext and visual crowding in the teacher rail
- make specialization easier to scan than secondary technical metadata
- demote destructive repair actions like `Reset Global Load` away from the primary everyday action band
- reduce subject-row badge/action noise where possible without removing essential ownership/conflict safety
- remove any remaining visible mojibake or malformed separators from the page
- do not leave the main operator explanation trapped only in the `Breakdown` tooltip
- move the current rotation/load explanation into a durable visible surface in the selected-teacher workspace
- make the top overview calmer and more legible, even if that means fewer badges and more explicit grouped labels
- ensure the staffing-needs surface clearly shows both:
  - raw uncovered completeness
  - concurrent weekly shortage after family-aware adjustment
- make the staffing-needs copy less alarming and more operational by explaining what the scheduler can do next
- demote raw integrity counters into a less intrusive diagnostic surface if the core scheduling workflow can remain honest without keeping them in the primary visual band
- preserve the no-scroll architecture and existing draft safety behaviors

#### E. Keep teacher load reflection correct

Required:

- preserve the current correct teacher-side rotation load math
- do not regress:
  - `rotationFamilyOvercountHours`
  - `rotationFamilyLoadDetails`
  - `Raw Rows` vs `Actual (Adjusted)` vs `Credited`
- selected-teacher UI must remain consistent with the backend math after this pass

#### F. Preserve current ownership/subject contract gains

Required:

- do not recreate umbrella `TLE`
- do not regress `STE_ROBOTICS` multi-department baseline support
- do not reintroduce placeholder masking

### Out Of Scope

Do not:

- attempt a new broad staffing redistribution pass
- redesign unrelated pages
- reopen subject contract work beyond preserving current gains
- claim final generator closure from this pass

## Required Tailnet Verification

You must run and report all of these after implementation:

1. `GET /api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=55`
   - prove the summary headline contract now aligns with the intended truth model
   - if two metrics exist, show both and explain them

2. `GET /api/v1/faculty-assignments/coverage/summary?schoolId=1&schoolYearId=55`
   - capture uncovered blocker rows for:
     - `SCI_ES`
     - `SCI_CHEM`
     - `TLE_FCS_EXP`
     - `ENG`
     - `FIL`
     - `MATH`
     - `AP`
     - `STE_ROBOTICS`

3. `POST /api/v1/faculty-assignments/report/staffing-needs`
   - prove the report now distinguishes raw uncovered completeness from concurrent weekly shortage
   - prove rotation-family shortage is not just counted row-by-row without adjustment

4. One live `Teaching Load` UI verification
   - selected-teacher breakdown still shows rotation-aware adjustment correctly
   - the staffing-needs surface language is understandable and non-contradictory
   - the teacher rail and top action area are visibly more scheduler-friendly after the pass
   - the durable load explanation is visible without hover-only interaction
   - no visible mojibake remains on the page

If any required Tailnet test is missing, return `NO-GO`.

## Required Output

Return:

1. files changed
2. summary truth-model changes
3. staffing-needs term-aware math changes
4. UI communication and scheduler-UX changes
5. exact Tailnet tests run
6. key live results
7. `GO` or `NO-GO`

## GO Condition

Return `GO` only if all are true:

- `Teaching Load` summary no longer contradicts coverage/staffing truth
- staffing-needs explicitly separates raw uncovered completeness from concurrent weekly shortage
- rotation-family shortage math is no longer overstated as simple concurrent weekly load
- teacher load rotation math remains correct and visible
- the live UI communicates the model clearly enough for schedulers to trust it
- the page feels materially calmer and easier to operate for a scheduler than before
- the rotation/load explanation is visible in a durable surface instead of depending on a transient tooltip alone
- all required Tailnet tests were actually run after the change
