# Gemini Execution Prompt: Phase 3 Rotational Subject Term Awareness UX Follow-Up One-Shot

## Objective

Finalize the scheduler-facing UX for rotational subject term awareness after the Copilot full-stack pass lands.

This is a follow-up pass only.
Do not invent missing backend semantics.
Assume Copilot has already:

- corrected term-aware load truth
- exposed explicit term metadata to the frontend
- updated the main affected page contracts

Your job is to make the result feel obvious, calm, and scheduler-friendly across:

- `Subjects`
- `Teaching Load`
- `Sections` detail surfaces

The backend truth is now good enough.
This pass is about making that truth readable, calm, and decision-friendly.

## Out of Scope

Do not:

- rewrite backend logic
- redesign whole pages
- invent a second load model
- hide term meaning behind hover-only explanations
- reopen staffing math or API contract work

## Required Context

Read first:

- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

Inspect directly after Copilot pass:

- `atlas-client/src/pages/Subjects.tsx`
- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/pages/Sections.tsx`
- related subject drawer / selected-teacher / section detail components

Also inspect:

- `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
- `atlas-client/src/components/faculty-assignments/OverviewHeader.tsx`
- `atlas-client/src/components/faculty-assignments/AutoFillSummaryModal.tsx`

## UX Problem To Solve

Even with correct backend truth, rotational subjects will still feel confusing if the page only shows:

- canonical subject code
- rotation family
- technical delta values

Schedulers need to immediately understand:

- this is a `Term 1`, `Term 2`, or `Term 3` subject
- this row belongs to a rotating family
- whether assigning it changes current weekly load
- whether a section or teacher is already covered in another term

There is also a final readability problem on `Teaching Load`:

- the selected-teacher strip is still too crowded
- the always-visible arithmetic strip is still too dominant
- the page still leans on microtext and uppercase density in core trust surfaces
- the rotational term distribution block duplicates some of the same information instead of presenting it in the cleanest possible way

This pass must fix clarity **and** readability at the same time without reopening layout architecture.

## Required Outcome

After this pass:

- term rank is visually obvious wherever rotational subjects appear
- term labels are readable in plain scheduler language
- `Subjects`, `Teaching Load`, and `Sections` feel consistent
- the page explains rotational meaning without becoming text-heavy
- the current compact workspace remains intact
- the selected-teacher surface no longer feels like a dense technical calculator
- the per-term teacher breakdown is presentable enough for real scheduler use

## Implementation Directives

### 1. Make term labels first-class identity chips

Where a subject is rotational, term rank must be visible as a compact, readable identity element such as:

- `Term 1`
- `Term 2`
- `Term 3`

Do not bury this in tiny muted copy.
Do not force a hover to discover it.

### 2. Keep canonical subject identity while making term meaning obvious

Schedulers still need the real subject identity:

- `Science - Chemistry`
- `Science - Earth Science`
- `TLE Exploratory - ICT`

But term meaning must sit beside that identity cleanly.

The visual model should make it obvious that these are:

- distinct canonical rows
- belonging to one rotating family
- happening in different terms

### 3. Improve Teaching Load assignment understanding

In `Teaching Load`:

- make rotational term labels visible in the selected-teacher summary
- make assignment-row term labels visible in the subject assignment surface
- make concurrent delta language plain:
  - `Adds this term only`
  - `No weekly increase; different term lane`
  - `Raises current weekly load`

Use the backend truth.
Do not guess.

### 3a. Clean up the selected-teacher trust surface

The current selected-teacher strip is still too busy.

Required:

- demote the always-visible arithmetic slab so it no longer dominates the main identity strip
- keep the full worked calculation available, but move complexity into secondary disclosure
- keep the main strip focused on:
  - credited total
  - status
  - a small peak-term indicator
  - a compact per-term summary cue

Do not keep a crowded inline equation as the primary visual anchor.

### 3b. Present the per-term teacher breakdown cleanly

The new `rotationTermBreakdown` contract must be visible in `Teaching Load`, but it must feel like a scheduler tool, not a debug table.

Required:

- show each rotational family with:
  - peak term
  - peak credited hours
  - the other term buckets in a readable compact layout
- make it obvious which term drives the weekly load bar
- keep this compact enough for a normal laptop viewport

Avoid:

- tiny compressed grid labels
- repeated explanatory copy
- making the breakdown look like a developer artifact

### 4. Improve Sections details understanding

In `Sections` details:

- rotational assigned classes must show term labels clearly
- if a section has multiple rotational-family rows, make the sequencing readable
- avoid dense debug-like metadata blocks

### 5. Keep the pages uniform

The term-awareness treatment should feel like one ATLAS language system, not three unrelated implementations.

Use:

- consistent chip treatment
- consistent wording
- consistent placement hierarchy

### 6. Preserve readability

Do not regress back into:

- cramped microtext
- too many uppercase tiny labels
- hover-only explanation for core meaning

Specific current risks to reduce:

- `text-[0.5rem]` to `text-[0.65rem]` overuse in `Teaching Load`
- repeated uppercase control labels that make the page harsh to scan
- duplicate explanation blocks for the same rotational concept
- tiny audit/action labels that feel denser than the actual scheduling surface

Minimum expectation:

- primary term labels readable at `text-xs` or `text-sm`
- main subject identity readable without dense stacked metadata
- selected-teacher trust surfaces readable without squinting

### 7. Keep overview and modal copy plain

In the shortage / auto-fill surfaces and compact overview:

- keep `Term 1 / Term 2 / Term 3` visible where rotational shortage or closure is explained
- prefer scheduler language over technical phrases like `lane` unless the term is directly explained
- keep `Teacher X` synthetic closure visually distinct but not alarmist

## Verification Gates

Required:

- `npm --prefix atlas-client run build`
- verify no raw HTML interactive controls were introduced
- verify no global page scrollbar was introduced
- verify visible term labels exist in:
  - `Subjects`
  - `Teaching Load`
  - `Sections` detail surfaces
- verify the selected-teacher surface feels materially less crowded than the current implementation
- verify the per-term teacher breakdown is readable without opening tooltips
- verify rotational subject meaning is understandable without opening tooltips
- verify the result still feels compact and scheduler-friendly

## Evidence Requirement

Append a short implementation proof entry to `docs/verification/evidence-log.md` under the Copilot rotation-term pass section or as a clearly linked follow-up note.

Do not claim `GO` unless the visible term-awareness treatment is actually present on all three affected surfaces.
