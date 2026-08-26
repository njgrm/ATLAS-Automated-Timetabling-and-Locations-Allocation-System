# Gemini Execution Prompt: Phase 3 Teaching Load Scheduler Surface Recovery UX One-Shot

## Run Gate

Do not run this prompt until the paired Copilot pass has landed and verified:

- split-brain contradictory teacher/cohort rows are detected and quarantined
- saved-truth repair tooling exists
- impossible faculty arithmetic is no longer silently presented as normal truth
- `MAPEH` blocked candidate / approval-needed states are available

If those are not true yet, stop and return `NO-GO`.

## Objective

Finalize `Teaching Load` as a scheduler-usable page after the backend/runtime truth is repaired.

This pass is **not** allowed to redesign the product from scratch.
It must calm the current page, reduce cognitive overload, and make the repaired truth easy to act on.

## Out of Scope

Do not:

- invent new backend semantics
- hide integrity problems that the backend now surfaces
- auto-approve capability overrides
- add giant permanent diagnostic blocks into the main workspace
- re-expand the selected-teacher strip into a dense arithmetic slab

## Required Reading

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `GEMINI.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- the latest Copilot evidence entry for the split-brain repair pass

Inspect directly:

- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/components/faculty-assignments/OverviewHeader.tsx`
- `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
- `atlas-client/src/components/faculty-assignments/AutoFillSummaryModal.tsx`

## Required UX Outcomes

### 1. Calm the selected-teacher surface

The main selected-teacher strip should be scannable at a glance.

Keep primary visible signals to:

- credited weekly load
- peak term
- remaining capacity
- current integrity state if the row is quarantined

Move detailed per-term arithmetic and family breakdown into secondary disclosure:

- popover
- drawer
- or compact detail sheet

Do not keep the full math slab always visible.

### 2. Make repair/quarantine states obvious but not noisy

When the backend flags a contradictory row/cohort:

- show a strong but compact warning state
- disable unsafe assignment actions
- explain in plain language that this teacher/subject state needs repair before more scheduling work

Do not let this look like a generic error toast.
It must feel like a purposeful scheduler integrity state.

### 3. Make per-term truth readable in scheduler language

Use exact terminology:

- `Term 1`
- `Term 2`
- `Term 3`

Explain rotational meaning in plain language:

- only the busiest term counts toward weekly rotational load
- year-round classes still stack on top

Avoid technical phrasing like:

- `Rotating Term Lane`
- `Peak Adjusted`

Prefer scheduler wording:

- `Busiest Term`
- `No weekly increase`
- `Raises weekly load`

### 4. Surface `MAPEH` blocked candidates clearly

For `SPA_SPEC` / `SPS_SPEC` and related special-program surfaces:

- show zero-load / low-load `MAPEH` candidates where relevant
- show why they cannot be used yet
- show whether an override is missing
- make the state feel actionable, not dead-ended

The page should communicate:

- `Candidate available`
- `Needs approved override`
- `Already approved`

without pretending the handoff already happened.

### 5. Reduce density and microtext

Raise the text-size floor across trust-critical surfaces.

Targets:

- selected-teacher strip
- roster rail status snippets
- term breakdown cards
- staffing / special-program cues

Avoid:

- `text-[0.5rem]`
- `text-[0.55rem]`
- dense all-caps micro-labeling everywhere

### 6. Keep compact workspace architecture

Preserve:

- no-scroll overall page architecture
- compact roster-first workflow
- efficient scheduler workspace density

The goal is calmer hierarchy, not a taller or card-heavier redesign.

## Specific UI Directives

### Selected Teacher

- primary row = teacher identity + credited load + peak term + remaining capacity
- integrity state, if any, should appear as a compact high-priority badge/banner inside the same zone
- per-term family breakdown must be secondary disclosure

### Subject Rows

- keep term chip visible for rotational subjects
- use simple delta text:
  - `Raises weekly load`
  - `No weekly increase`
- if blocked by quarantine/integrity state, say so directly

### Auto-Fill / Shortage / Special Views

- visually distinguish:
  - real-faculty closure
  - synthetic/placeholder closure if present
  - blocked-by-approval `MAPEH` opportunities
- make it obvious when the system found candidates but human approval is still needed

## Verification Requirements

### Build

Run:

- `npm --prefix atlas-client run build`

### Live/Tailnet UI Verification

You must test the real page behavior on Tailnet or the live bridged surface, not just inspect code.

Verify:

1. contradictory/quarantined row state is visually obvious and assignment actions are suppressed
2. selected-teacher strip is materially calmer and no longer dominated by arithmetic
3. per-term breakdown is still available but secondary
4. `MAPEH` blocked candidates are visible with override-needed language
5. term wording is consistently `Term 1 / Term 2 / Term 3`

If any of these fail in live behavior, fix them in the same pass before claiming `GO`.

### Evidence Log

Append implementation proof to `docs/verification/evidence-log.md` with:

- files changed
- build result
- live UI verification notes
- any residual UX gap honestly called out

## GO / NO-GO

### GO only if

- the page feels calmer than the current microtext-heavy state
- primary teacher decisions are understandable at a glance
- integrity-repair states are obvious and trustworthy
- blocked `MAPEH` special-program candidates are visible and actionable
- term-aware rotational behavior is understandable without reading backend jargon

### NO-GO if

- the selected-teacher strip is still arithmetic-heavy
- quarantined states are hidden or ambiguous
- `MAPEH` blocked candidates still look like unexplained zero-load dead rows
- live UI testing was not actually performed
