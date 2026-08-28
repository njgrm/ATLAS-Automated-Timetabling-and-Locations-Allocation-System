# Gemini Execution Prompt: Phase 3 Teaching Load Non-Additive Term Presentation UX One-Shot

## Objective

Fix the remaining `Teaching Load` presentation bug where rotational teachers still look like their term loads are being summed into one weekly load.

The backend contract is now good enough.
Do not change backend math.

This pass is only about making the UI faithful to the actual per-term and weekly truth.

## Core Rule To Preserve

For rotational families such as `SCIENCE` and `TLE_ROTATION`:

- only the **peak single term** contributes to weekly concurrent teaching load
- year-round subjects stack normally with that peak term
- `Term 1`, `Term 2`, and `Term 3` are **alternate rotational states**
- they must never look like additive weekly totals

## Problem To Fix

Current `Teaching Load` still presents too many overlapping load concepts:

- `Credited Weekly Load`
- `Concurrent Teaching`
- header `Term Load`
- rotational distribution banner

This is confusing because two different term surfaces are being shown:

1. a header term cue that behaves like a whole-teacher term snapshot
2. a rotational-family banner that behaves like family-only term truth

Even if both are technically derived from real data, the page makes them feel like competing weekly totals.

That causes the scheduler to read impossible interpretations such as:

- “this teacher is 60%+ in more than one term at the same time”
- “the terms are being added together”

We do not want that.

## Required Outcome

After this pass:

1. the page shows **one clear weekly load story**
2. the page shows **one clear term comparison story**
3. rotational term values look like alternate per-term realities, not cumulative weekly sums
4. teachers no longer appear to have impossible multi-term weekly percentages
5. year-round subjects feel intuitive and normal, the same way non-rotational subjects already do

## Out of Scope

Do not:

- rewrite backend load logic
- change staffing or auto-fill logic
- redesign the whole page
- add new diagnostic dashboards
- reopen split-brain or runtime-year work

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
- any selected-teacher or load-summary subcomponents

## Truth Model To Present

The page should clearly separate these concepts:

### A. Concurrent Teaching

This is:

- actual classroom time in the busiest week/term
- year-round teaching
- plus the peak single rotational term

This is the closest thing to:

- “how much this teacher is truly teaching in one week”

### B. Credited Weekly Load

This is:

- concurrent teaching
- plus advisory/equivalent credits

This must stay visible, but it must not be confused with term-by-term teaching totals.

### C. Rotational Family Term Breakdown

This is:

- the alternate term distribution inside `SCIENCE` or `TLE_ROTATION`
- family-specific only
- not the whole teacher’s total weekly load

## Implementation Directives

### 1. Remove or demote the duplicate header term cue

The current header `Term Load` cue is the main source of confusion.

You must either:

- remove it entirely

or

- reduce it to a tiny peak-term indicator that does not show comparative term totals

Do not keep a second visible term-total surface that competes with the rotational breakdown banner.

If any term indicator remains in the header, it should only say something like:

- `Peak Term: Term 2`

not a three-term comparative load display.

### 2. Keep only one real term breakdown surface

The rotational distribution banner should become the single authoritative term comparison surface.

It must clearly be labeled as something like:

- `Rotational Family Breakdown`
- `Science / TLE Term Breakdown`

not generic `Term Load`

It must be obvious that this surface explains rotational families only.

### 3. Stop showing additive-looking percentages for terms

Do not present per-term numbers in a way that implies:

- each term is a percentage of the same concurrent weekly load at the same time
- multiple term percentages should be mentally added together

If percentages are shown, they must be framed as:

- per-term teaching snapshot
- alternate term load

not a shared weekly utilization bar.

### 4. Make the main weekly numbers faithful

The main top-line numbers should be:

- `Concurrent Teaching`
- `Credited Weekly Load`
- `Remaining Capacity`

Those numbers must not be visually contaminated by alternate-term comparisons.

The scheduler should not have to compare top-line weekly numbers with a second term-total strip.

### 5. Explain year-round stacking in one sentence

Add a short durable sentence near the rotational breakdown:

- year-round classes happen every week
- rotational Science/TLE contributes only from the busiest term

Keep it short and plain.
Do not add a paragraph.

### 6. Make rotational teachers feel like normal teachers again

The page should present rotational teachers with the same clarity as non-rotational teachers:

- one real weekly load
- one credited load
- one clear breakdown of why rotation changes the number

Do not let rotational teachers look like special broken cases.

### 7. Keep the compact layout

Do not expand the header vertically.
Do not add giant cards.
Do not solve this by adding more metrics.

This is a simplification pass.

## Verification Gates

Required:

- `npm --prefix atlas-client run build`
- verify no raw HTML interactive controls were introduced
- verify no global page scrollbar was introduced
- verify a Science teacher and a TLE teacher no longer show two competing term-total surfaces
- verify the page no longer suggests that multiple terms contribute simultaneously to weekly load
- verify rotational teachers no longer look like they have impossible `60%+` loads in multiple terms at once
- verify the selected-teacher strip is calmer and easier to read

## Evidence Requirement

Append a short note to `docs/verification/evidence-log.md` that explicitly states:

- the pass was presentation-only
- the backend term-capacity contract was reused unchanged
- the duplicate/competing term-total presentation was removed or demoted

## GO Condition

Return `GO` only if:

- there is no longer more than one competing visible term-total presentation
- weekly load no longer looks like summed multi-term load
- rotational term numbers read as alternate per-term states
- the page feels faithful to actual teacher load in one term at a time
