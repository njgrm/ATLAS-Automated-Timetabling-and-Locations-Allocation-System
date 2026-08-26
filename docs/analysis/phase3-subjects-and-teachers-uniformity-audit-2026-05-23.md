# Phase 3 Subjects And Teachers Uniformity Audit

Date: 2026-05-23
Scope: scheduler-facing UX/UI parity between `/subjects` and `/teachers`

## Verdict

Gemini's direction is mostly right, but not all of its recommendations should be adopted literally.

The correct direction is:

- keep `Subjects` as the structural baseline for catalog-style pages
- move `Teachers` toward the same header, filter, table, and pagination system
- borrow the better human-identity and resilience patterns from `Teachers`
- do **not** force artificial action symmetry where the workflow does not support it

So the next pass should be a **uniformity pass**, not a redesign-from-scratch pass.

## What Gemini got right

### 1. `Subjects` has the better header architecture

Confirmed in current code:

- [Subjects.tsx](/d:/ATLAS/atlas-client/src/pages/Subjects.tsx:443) uses:
  - one primary header row
  - search
  - a `Filters` toggle
  - progressive disclosure for secondary controls
- [Faculty.tsx](/d:/ATLAS/atlas-client/src/pages/Faculty.tsx:267) still keeps filters inline in the same row as search and sync

This makes `Teachers` more crowded and less scalable on narrower widths.

### 2. `Teachers` has the better row identity pattern

Confirmed in current code:

- [FacultyRow.tsx](/d:/ATLAS/atlas-client/src/components/faculty/FacultyRow.tsx:33) uses:
  - initials avatar
  - bold identity line
  - employee ID
  - advisory cue
- [SubjectRow.tsx](/d:/ATLAS/atlas-client/src/components/subjects/SubjectRow.tsx:53) still relies on:
  - plain text name
  - tiny code
  - many small badges

`Teachers` is easier to scan as a roster. `Subjects` is still more badge-heavy than it should be.

### 3. `Teachers` has the better sync/degraded-state communication

Confirmed in current code:

- [Faculty.tsx](/d:/ATLAS/atlas-client/src/pages/Faculty.tsx:324) shows explicit `Live data`, `Cached snapshot`, and `No cache`
- [Faculty.tsx](/d:/ATLAS/atlas-client/src/pages/Faculty.tsx:355) also has visible error/degraded banners

`Subjects` currently has no equivalent banner system for contract-sync state.

## What Gemini got only partially right

### 1. “Subjects should adopt Teachers semantic load-style indicators”

Partly correct.

The real need is not “copy teacher load colors everywhere.” It is:

- give `Subjects` a clearer high-signal coverage or staffing-health indicator
- do it without adding another noisy badge cluster

So the right move is:

- one small semantic coverage signal in `Subjects`
- not another full visual language layer

### 2. “Both pages should use the same drilldown pattern”

Partly correct.

They should be structurally consistent, but the content should stay different:

- `Subjects` drilldown is operational coverage inspection
- `Teachers` drilldown is identity plus current assignments

Uniform shell, different domain content.

## What Gemini got wrong or overreached

### 1. Adding a row-level `More` menu to `Teachers`

Not recommended.

Current `Teachers` actions are already minimal and clear:

- quick profile
- manage teaching load

Adding a three-dot menu only for parity would add clutter without a matching operator need.

Also, the page currently does not own controls like “Exclude from Scheduling,” so a parity menu would be misleading.

### 2. Making both pages identical

Not recommended.

Uniformity should mean:

- same header rhythm
- same table header style
- same pagination system
- same density rules

It should **not** mean flattening both pages into the same row content pattern.

## Additional issues I found

### 1. Table header style is still inconsistent

- [Subjects.tsx](/d:/ATLAS/atlas-client/src/pages/Subjects.tsx:579) uses `font-semibold`
- [Faculty.tsx](/d:/ATLAS/atlas-client/src/pages/Faculty.tsx:388) uses `font-bold`

This is small, but it contributes to the visible drift.

### 2. Pagination systems are inconsistent

`Subjects` and `Teachers` do not use the same footer language or controls.

- `Teachers` already has first/last buttons
- `Subjects` still uses the older lighter footer treatment

These two pages should use one pagination pattern.

### 3. `Subjects` still overuses tiny text

Confirmed in:

- [SubjectRow.tsx](/d:/ATLAS/atlas-client/src/components/subjects/SubjectRow.tsx:56)
- [SubjectRow.tsx](/d:/ATLAS/atlas-client/src/components/subjects/SubjectRow.tsx:70)
- [SubjectRow.tsx](/d:/ATLAS/atlas-client/src/components/subjects/SubjectRow.tsx:80)

There are too many `0.55rem` to `0.65rem` signals in one row.

### 4. `Teachers` still wastes header space with inline filters

Confirmed in:

- [Faculty.tsx](/d:/ATLAS/atlas-client/src/pages/Faculty.tsx:280)

This is the biggest remaining structural drift.

### 5. `Subjects` still puts too much meaning in separate badge clusters

The current row spreads meaning across:

- grade badges
- program-scope badges
- owner badge
- status badge
- baseline note

That is too much fragmentation for a catalog row.

### 6. `Teachers` row semantics are stronger, but the table is still less “catalog-clean”

The `Teachers` row is more human and readable, but it still mixes:

- identity
- department
- subject count
- credited-load signal
- scheduling inclusion state

without a filter system that scales as well as `Subjects`.

## Recommended master pattern

### Header and filters

Use the `Subjects` model for both pages:

- search first
- one `Filters` toggle
- expandable filter row
- action cluster separated on the right

### Table headers

Use one shared rhythm:

- same sticky header treatment
- same weight
- same button sizing
- same sort-icon spacing

### Row identity

Use:

- human-first row identity on `Teachers`
- stronger visual identity block on `Subjects`, but not avatars

For `Subjects`, the row should become:

- subject name
- code
- one concise ownership/context strip

instead of many micro-badges.

### Status and sync communication

Use the `Teachers` banner/status pattern where the page depends on upstream or cached state.

For `Subjects`, this should appear around:

- contract sync
- degraded contract fetch
- cached/offline read if present

### Pagination

Unify both pages on:

- first/previous/next/last
- current page plus total pages
- same rows-per-page selector
- same footer copy rhythm

## Decision

The next pass should be a joint `Subjects` + `Teachers` UX/UI uniformity pass.

It should:

- move `Teachers` to the `Subjects` header/filter architecture
- reduce badge and micro-text noise in `Subjects`
- unify table header and pagination patterns
- keep `Teachers` profile and resilience strengths
- avoid fake parity features like unnecessary overflow menus

That is the right “uniform but not identical” direction.
