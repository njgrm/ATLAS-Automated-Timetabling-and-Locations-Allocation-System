# Gemini Execution Prompt: Phase 3 Teaching Load Rotation Semantics And Load Labeling UX One-Shot

## Objective

Fix the remaining `Teaching Load` rotation math confusion in the UI without changing backend logic.

The current live backend/data contract is now good enough:

- active year is correct
- year-55 coverage is fully closed (`962 / 962`)
- split-brain integrity debt is cleared
- quarantine is warning-only
- live faculty detail payloads now expose correct `rotationTermBreakdown`
- peak-term crediting is being returned correctly for both `SCIENCE` and `TLE_ROTATION`

But the scheduler surface is still misleading because the page presentation makes rotational term loads feel additive and makes `credited load` look like the same thing as `concurrent teaching load`.

This pass is UI/UX only.
Do not rewrite backend math.

## Out of Scope

Do not:

- change backend load computation
- change staffing or auto-fill logic
- change the peak single-term rule
- redesign the whole page
- reopen split-brain or runtime-year work
- alter approval workflow semantics for `SPS_SPEC` / `SPA_SPEC`

## Required Context

Read first:

- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

Inspect directly:

- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/lib/faculty-assignment-helpers.ts`
- `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
- `atlas-client/src/components/faculty-assignments/OverviewHeader.tsx`
- any extracted selected-teacher / load-detail subcomponents

## Live Facts To Treat As Settled

These are settled and should not be reinterpreted by the UI:

1. Rotational families are credited by peak single term, not by summing all terms.
2. Year-round subjects stack normally with that peak rotational term.
3. `rotationTermBreakdown` is already available and truthful.
4. `policyCreditedHours` is not the same concept as concurrent teaching-only hours.
5. `SCIENCE` and `TLE_ROTATION` are not “all happening at once.”

## Current UX Problem

The page still creates the wrong mental model in two places:

### A. Main load label confusion

The selected-teacher strip still shows:

- `Weekly Load`

while binding it to:

- `loadProfile.creditedTotalHours`

That makes the user read:

- “this is concurrent weekly teaching”

when the number is actually:

- rotation-adjusted teaching
- plus advisory/equivalent credits

### B. Term cue still feels additive

The compact `Term Load` cue currently computes:

- rotational term hours
- plus non-rotational hours

and renders mini-bars that can still feel like:

- Term 1 + Term 2 + Term 3 are all part of one summed weekly load

Even if the math is technically sourced from correct data, the visual is still leading schedulers to the wrong conclusion.

## Required Outcome

After this pass, a scheduler should be able to tell at a glance:

1. what the teacher’s **credited weekly load** is
2. what the teacher’s **concurrent teaching load** is
3. which term is currently the **peak rotational term**
4. that `Term 1 / Term 2 / Term 3` are alternative rotational states, not additive weekly blocks
5. how year-round classes combine with the peak rotational term

The result must feel calmer and clearer, not denser.

## Implementation Directives

### 1. Rename the main load label honestly

Do not keep `loadProfile.creditedTotalHours` under the label:

- `Weekly Load`

Use a label that matches the value, such as:

- `Credited Weekly Load`
- or another equally clear scheduler-facing label

This primary label must not imply “teaching rows only.”

### 2. Separate credited load from teaching-only load

The selected-teacher trust surface must clearly separate:

- concurrent teaching load
- credited weekly load

without making the strip explode vertically.

The main strip should lead with:

- credited weekly load
- status
- remaining capacity

But it should also show a compact secondary signal for:

- concurrent teaching-only load

Do not force the scheduler to infer this from the arithmetic popover alone.

### 3. Rework the term cue so it does not look additive

The current mini-bar cue is too easy to misread.

You must change it so it clearly communicates:

- `Term 1`
- `Term 2`
- `Term 3`

as alternate rotational states.

Required:

- make the peak term visually explicit
- make non-peak terms visibly comparative, not additive
- do not make the three terms feel like stacked cumulative weekly hours

Acceptable directions:

- compact segmented comparison
- peak-term chips with comparative values
- alternate-term cards with one explicitly marked as load-driving

Not acceptable:

- a visualization that still feels like all three bars should be mentally summed

### 4. Make year-round stacking explicit in plain language

The UI must explain the real rule in scheduler language:

- `Your year-round classes stay every week.`
- `Rotational Science/TLE contributes only from the busiest term.`
- `The credited weekly load is year-round classes plus the peak rotational term.`

This explanation should be durable and readable, not hover-only.

Keep it short.

### 5. Make the calculation popover semantically cleaner

Keep the detailed worked calculation in secondary disclosure, but fix its semantics so it reinforces the right model:

- raw teaching rows
- rotation overlap removed
- concurrent teaching load
- equivalent / advisory credits
- final credited weekly load

The wording must not imply that all term buckets are counted together.

### 6. Keep rotation-family breakdown readable

For each family in the detailed breakdown:

- show raw family minutes/hours
- show peak term
- show credited family load
- show non-peak term buckets as alternate, not additive

Make it obvious which term drives the weekly load.

### 7. Preserve current compactness

Do not make the selected-teacher header tall again.

Do not add giant new cards.

Do not solve this with more microtext.

The page should feel:

- clearer
- less misleading
- still compact

### 8. Keep scheduler language plain

Prefer:

- `Credited Weekly Load`
- `Concurrent Teaching`
- `Peak Term`
- `Year-round classes`
- `Different term, no added weekly block`

Avoid:

- developer wording
- repeated “lane” jargon without explanation
- metric labels that require prior system knowledge

## Verification Gates

Required:

- `npm --prefix atlas-client run build`
- verify no raw HTML interactive controls were introduced
- verify no global page scrollbar was introduced
- verify the selected-teacher strip is still compact on laptop width
- verify the main load label now matches the actual value shown
- verify a scheduler can distinguish credited weekly load from concurrent teaching load without opening the popover
- verify the term cue no longer feels additive
- verify `SCIENCE` and `TLE_ROTATION` examples read correctly in the UI

## Evidence Requirement

Append a short follow-up note to `docs/verification/evidence-log.md` under the latest Teaching Load UX work, explicitly stating:

- this was a UI semantics pass, not a backend math pass
- the live payload contract was reused as-is
- what was changed in load labeling and term visualization

Do not claim `GO` unless the page no longer suggests that term buckets are being summed into one weekly load.
