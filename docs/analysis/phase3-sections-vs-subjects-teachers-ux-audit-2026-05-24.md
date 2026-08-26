# Phase 3 Sections vs Subjects and Teachers UX Audit

Date: 2026-05-24
Scope: Compare the current `Sections` page against the current `Subjects` and `Teachers` pages for UX/UI consistency, information completeness, source honesty, and scheduler usefulness.

## Summary Verdict

`Sections` is now the weakest of the three pages.

It is not broken, but it still behaves like a simpler mirror-maintenance table while `Subjects` and `Teachers` already behave more like scheduler-facing catalog workspaces.

The page has acceptable density and basic controls, but it is materially behind in:

- information richness
- follow-through actions
- visual identity language
- source-state polish
- drilldown completeness

## What Sections Already Does Reasonably Well

The current `Sections` page is not a bad base.

It already has:

- compact toolbar and no-scroll structure consistent with the broader shell
- inline search and concise filters
- inline stat banner with section count, enrollment, and grade distribution
- home-room editing directly in the table
- grade-color usage that broadly aligns with DepEd mapping
- explicit unavailable / cached / no-year states

These are worth preserving.

## Where Sections Falls Behind

### 1. It is much less information-complete than Subjects and Teachers

`Teachers` rows show:

- human identity
- department
- specialization
- advisory state
- assignment count
- credited load
- scheduling status
- immediate actions

`Subjects` rows show:

- subject identity
- room demand
- grade summary
- owner department
- program scopes
- lifecycle state
- coverage action

`Sections` rows currently show only:

- section name
- grade
- enrolled count
- capacity
- fill %
- home room

That means `Sections` is still missing the scheduler-relevant class ownership story.

Most notably, it does not yet surface the new section-first teaching-load data model:

- assigned classes per section
- assigned teacher per class
- uncovered expected classes
- stale or diagnostic ownership only when explicitly requested

This is the single biggest completeness gap.

### 2. It does not yet use the new section-first assigned-classes contract

The page currently fetches:

- `/sections/summary/:schoolYearId`
- `/sections/home-rooms/:schoolYearId`

But it does not consume:

- `GET /api/v1/sections/:sectionId/assigned-classes`
- `GET /api/v1/sections/assigned-classes`

So the page still cannot answer the scheduler question:

- “What is this section actually carrying right now, and who teaches each class?”

That is a real contract-utilization gap, not just a visual one.

### 3. Visual identity is behind the newer tables

`Subjects` and `Teachers` both now use stronger row identity:

- icon/avatar anchor
- bolder primary identity cell
- semantic department/program color usage
- clearer secondary lines

`Sections` has only a light initial/grade avatar and an optional program badge.

It does not yet have a richer identity block that helps the scheduler quickly distinguish:

- regular vs special-program sections
- home-room state
- section ownership completeness
- program-specific context

### 4. Toolbar and filter architecture drift

`Teachers` and `Subjects` both use a clearer search + filter-toggle or structured filter pattern.

`Sections` currently keeps all controls inline all the time:

- search
- grade select
- program select
- clear button

This is usable, but it is less coherent with the newer catalog rhythm and is less scalable once the page gains more real section-management controls.

### 5. Source honesty is present, but the wording is still rough

`Sections` does distinguish:

- `Live data`
- `Cached snapshot`
- `No cache`

That is good directionally.

But the copy is still less polished than it should be:

- it still speaks in source-technical terms more than operator terms
- it still contains mojibake in the file
- cached mode is framed mainly as a warning, not as a confident degraded-read contract

### 6. No drilldown surface comparable to Teachers or Subjects

`Teachers` has a profile sheet.
`Subjects` has a coverage side drawer.

`Sections` has no equivalent drilldown surface.

That means there is no compact place to show:

- class list
- teacher list
- assigned vs uncovered classes
- special-program requirements
- section room/advisory metadata

Without a section drawer or side sheet, the page remains table-only and cannot mature into a real section workspace.

### 7. Table row actions are too narrow

Current row-level interactivity is essentially:

- home-room reassignment

That is useful, but too narrow.

Compared with `Teachers` and `Subjects`, the page lacks:

- view details
- inspect assigned classes
- inspect teacher ownership
- follow-through into schedule or teaching-load context

### 8. Language and polish still lag

Current code still includes:

- mojibake like `â€¦`, `Â·`, and box-drawing corruption in comments
- slightly raw labels like `Live data`
- weaker secondary wording than the newer pages

This is a polish issue, but also a trust issue.

## Most Important Product Gap

The single most important missing behavior is this:

`Sections` is not yet acting like the section-first counterpart to `Teaching Load`.

Now that ATLAS has section-first assigned-class endpoints, the page should evolve from:

- “section roster + home room table”

into:

- “section roster + section identity + assigned classes + teacher ownership + room/advisory context”

without becoming bloated.

## Recommended Direction

The next `Sections` pass should:

1. Keep the current compact table shell.
2. Add a right-sized section detail drawer or side sheet.
3. Use the section-first assigned-classes API as the new completeness layer.
4. Make row identity stronger and more uniform with `Teachers` and `Subjects`.
5. Tighten source-state language and clean up mojibake.
6. Keep home-room editing, but stop making that the only meaningful row interaction.

## Practical UX Target

After the next pass, a scheduler should be able to answer from `Sections`:

- which sections are regular vs special-program
- what classes each section currently has
- which teachers own those classes
- what is still uncovered
- what room or home-room context the section has

without leaving the page immediately.

## Final Verdict

`Sections` is currently:

- structurally serviceable
- visually behind
- informationally incomplete
- under-integrated with the new section-first teaching-load APIs

So yes, it needs a dedicated improvement pass, and that pass should focus more on section completeness and follow-through than on cosmetic polishing alone.
