# 2026-05-26 - Phase 3 Teaching Load Credited Load + Summary UX One-Shot

## Objective

Fix the remaining scheduler-trust problem in `Teaching Load` without redesigning the whole page again.

This pass must make weekly load understandable, readable, and calm by:

1. treating credited policy load as the primary workload truth
2. removing the overwhelming inline arithmetic slab from the selected-teacher strip
3. fixing the current presentation bug where raw teaching values appear as `0`
4. adding a clean, readable teacher summary of assigned subjects and sections directly in the page

## Why This Pass Is Needed

The page is still too technical in the wrong places.

Current problems:

- the main selected-teacher strip is trying to show the whole weekly calculation inline
- that arithmetic makes the strip feel crowded and overwhelming
- the hover/popover explanation is the right place for the worked math, not the main container
- the load status appears to be anchored too much to actual/raw teaching hours in presentation, even though schedulers need the credited policy load to be respected as real work
- current presentation is making raw teaching rows look like `0` for all teachers, which destroys trust even if backend math is correct
- the page still lacks a clean, readable teacher-level summary comparable in usefulness to the stronger breakdown patterns on other roster/catalog pages
- `Teacher X` is now a real first-class closure path, so the page must stop visually blurring:
  - real-faculty completion
  - synthetic placeholder closure

## Current Live State To Design Against

Treat this live state as real:

- the system can now reach `0` unassigned rows
- but current full assignment still includes synthetic closure
- current live totals include:
  - `realFacultyAssignedPairs = 892`
  - `syntheticPlaceholderPairs = 70`
  - `unassignedPairs = 0`
- the remaining synthetic coverage is currently concentrated in `SCI_ES`

So this pass must not make:

- `100% assigned`

look identical to:

- `100% covered by real faculty`

## Required Outcome

After this pass:

- the selected-teacher strip feels calm and readable
- credited policy load is the primary visible load signal
- worked weekly arithmetic is moved into a hover/popover/details surface, not kept inline as the dominant block
- `raw`, `rotation overlap`, `concurrent`, and `credited` values display correctly
- each teacher has an easy-to-read in-page summary of:
  - what subjects they hold
  - which sections are assigned
- synthetic placeholder closure is visually distinguishable from real-faculty completion without turning the page into a warning dashboard

## Scope

### In Scope

- `Teaching Load` selected-teacher surface
- weekly-load presentation
- teacher-level assigned-subject summary presentation
- hover/popover clarity for rotation math
- compact real-versus-synthetic completion clarity where the backend already exposes that truth

### Out of Scope

- backend staffing logic rewrite
- auto-fill algorithm changes
- major workspace restructuring
- unrelated tables/pages

## UI Implementation Directives

### 1. Make credited policy load the primary visible load truth

In the main selected-teacher surface:

- foreground `policyCreditedHours`
- use credited load for the main status and comparison against weekly cap
- do not visually imply that "actual teaching only" is the primary total that matters

The scheduler should immediately read:
- total credited weekly work
- status against allowed weekly load

not:
- a confusing raw-teaching-first narrative

For status interpretation:

- credited total is the primary comparison against weekly cap
- a teacher with advisory or other credited work must not look `below standard` only because actual teaching hours are lower than credited total

### 2. Remove the worked calculation slab from the main strip

The current inline calculation block is too much.

Change the presentation so:

- the main strip shows only a compact summary
- the full arithmetic lives in a hover card, popover, or similar secondary disclosure
- the compact strip should show:
  - credited total
  - status
  - a small rotation-aware indicator when relevant

Do not keep the full:
- raw
- minus overlap
- plus credits
- equals total

equation as the dominant always-visible content block.

### 3. Keep the math available, but only as a clear secondary explainer

Schedulers still need the worked math when they want it.

So the secondary disclosure must clearly show:

- raw teaching rows
- rotation overlap removed
- concurrent teaching load
- advisory / ancillary credits
- final policy-credited total

And it must explain this in plain scheduler language, not debug language.

### 4. Fix the raw-teaching presentation bug

There is a current trust issue where raw teaching rows appear as `0` in the UX even when backend math is not globally zero.

This pass must:

- verify the frontend is reading the correct fields
- stop displaying `0` when non-zero raw teaching exists
- make valid zero-overlap cases understandable without making all rows look broken

Do not paper over this with copy only. Fix the presentation source.

Design and verify against both:

- non-zero raw teaching examples
- valid `0 overlap removed` examples

### 5. Add a clean in-page teacher assignment summary

The page needs a readable summary of each selected teacher's current assignment footprint.

Add a clean summary area that surfaces:

- assigned subjects
- per subject:
  - subject code / label
  - assigned sections
  - any relevant rotation / specialization note when necessary

Where relevant, the summary should also indicate whether coverage is:

- real faculty ownership
- synthetic `Teacher X` closure

This should feel like a concise roster/drawer summary, not a debug dump.

It must help a scheduler answer quickly:
- what is this teacher currently carrying?

It should also help a scheduler answer:

- is this a real teacher workload or a placeholder closure case?

### 6. Make completion truth more honest without adding noise

Use the backend truth that already exists for:

- real-faculty coverage
- synthetic placeholder coverage

At minimum:

- if a subject or completion state is only closed by `Teacher X`, do not make it look identical to real-faculty completion
- use a compact distinction such as:
  - `Real faculty complete`
  - `Closed with Teacher X`
  - `Synthetic coverage`

Keep this restrained and scheduler-readable.

### 7. Preserve the current compact workspace

Do not re-expand the page vertically.

Preserve:

- no-scroll architecture
- compact subject assignment workspace
- denser assignment surface that Gemini already improved

This pass is about:
- trust
- readability
- information hierarchy

not another large layout rehaul.

### 8. Raise readability, not density

Avoid solving the problem with more chips, more microcopy, or more tiny text.

Use:

- `text-sm` for primary content where possible
- `text-xs` for secondary metadata
- less simultaneous uppercase microtext
- fewer competing inline badges in the selected-teacher strip

## Verification Requirements

You must not return `GO` without verifying:

1. the main selected-teacher surface now foregrounds credited policy load
2. the full arithmetic is demoted into secondary disclosure
3. non-zero raw teaching values display correctly where they should
4. valid zero-overlap states do not look like broken math
5. synthetic `Teacher X` closure is visually distinguishable from real-faculty completion
6. the new teacher assignment summary is readable on normal laptop and mobile widths
7. the compact no-scroll workspace is preserved

## Deliverables

1. code changes
2. concise before/after explanation
3. UI verification notes
4. explicit `GO` or `NO-GO`

If any of the above is not truly satisfied, return `NO-GO`.
