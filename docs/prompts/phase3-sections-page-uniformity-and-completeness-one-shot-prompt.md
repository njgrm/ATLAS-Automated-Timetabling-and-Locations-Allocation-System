# Gemini Execution Prompt: Phase 3 Sections Page Uniformity and Completeness One-Shot

## Objective

Upgrade the current `Sections` page so it matches the stronger scheduler-facing quality of `Subjects` and `Teachers`.

This is not a greenfield redesign.
Continue from the current compact `Sections` table and preserve the no-scroll architecture.

The main goal is to turn `Sections` from a basic mirror/home-room table into a section-first scheduler workspace with better information completeness, stronger row identity, and cleaner source-state communication.

## Out of Scope

Do not:

- redesign the page into a dashboard
- add global page scrolling
- remove inline home-room editing
- invent backend APIs that do not already exist
- rewrite section sync behavior
- make the page taller or heavier than the current compact catalog pattern

## Required Context

Read first:

- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-sections-vs-subjects-teachers-ux-audit-2026-05-24.md`
- `docs/analysis/phase3-subjects-teachers-and-teaching-load-visual-language-audit-2026-05-23.md`

Inspect directly:

- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/pages/Subjects.tsx`
- `atlas-client/src/pages/Faculty.tsx`
- `atlas-client/src/components/subjects/SubjectRow.tsx`
- `atlas-client/src/components/faculty/FacultyRow.tsx`

Important live contract to respect:

- `GET /api/v1/sections/:sectionId/assigned-classes`
- `GET /api/v1/sections/assigned-classes`

## Facts To Treat As Settled

- current scheduler-facing names stay:
  - `Teachers`
  - `Teaching Load`
  - `/teachers`
  - `/teaching-load`
- `Sections` should remain a section-first page, not a teacher-first inversion
- the page already has a compact toolbar and table shell worth preserving
- the page already has home-room inline editing and should keep it
- the page now has section-first assigned-class APIs available and should use them
- source-state honesty matters:
  - `live`
  - `cached`
  - `no cache`
  must be communicated truthfully

## Main Problems To Solve

### 1. Sections is much less complete than Subjects and Teachers

Right now the page mostly shows:

- section name
- grade
- enrolled count
- capacity
- fill %
- home room

That is not enough for a scheduler.

The page should help answer:

- what classes this section currently has
- which teacher owns each class
- what remains uncovered
- whether this is a regular or special-program section
- what room context the section has

### 2. The page does not yet feel visually uniform with the newer catalog pages

`Subjects` and `Teachers` now have:

- stronger identity-first rows
- better semantic color language
- clearer secondary detail
- more polished actions and drilldowns

`Sections` still feels flatter and more maintenance-oriented.

### 3. The page does not yet use the new section-first assigned-class model as a visible workflow

The row table alone is not enough.

The page needs a section detail surface that can show assigned classes cleanly without leaving the page.

### 4. Source-state messaging still needs polish

The page already distinguishes live vs cached vs no-cache, but the wording and polish still lag.

It must communicate degraded state honestly without feeling raw or confusing.

### 5. Mojibake and text roughness must be cleaned

Any remaining malformed separators or corrupted punctuation must be removed.

## Scope

### A. Bring Sections into the same visual language family as Subjects and Teachers

Required:

- preserve the current compact table shell
- strengthen row identity
- use the same quality of semantic badges, spacing, and secondary text hierarchy
- keep grade color semantics exact

### B. Add a section detail drilldown

Required:

- add a section drawer, side sheet, or equivalent compact drilldown
- this drilldown must use the section-first assigned-classes contract
- show, at minimum:
  - assigned classes
  - assigned teacher per class
  - uncovered expected classes if present
  - section room or home-room context
  - special-program context if relevant

This should become the `Sections` counterpart to:

- the `Teachers` profile sheet
- the `Subjects` coverage drawer

### C. Make row-level information more useful without bloating the table

Required:

- improve the main identity cell for a section
- better distinguish regular vs special-program sections
- keep the table scannable
- avoid turning every row into a card

### D. Keep home-room editing, but stop making it the only meaningful interaction

Required:

- preserve inline home-room editing
- add a clearer row action for details / assigned classes / ownership view
- make the follow-through behavior obvious

### E. Tighten source honesty and degraded-state communication

Required:

- keep the `live` vs `cached` vs `no cache` contract honest
- improve wording so it reads like operator guidance, not raw runtime status
- do not imply live freshness when the page is actually using cached section data

### F. Clean up typography and copy

Required:

- remove mojibake
- remove awkward separators
- keep type readable
- do not solve density with overly tiny text

## Implementation Direction

### 1. Preserve compactness

Required:

- no tall dashboard cards
- no full-page detail takeover
- no global page scroll
- keep the table as the main anchor

### 2. Use progressive disclosure

Required:

- keep the table focused
- put richer class ownership detail in a drilldown surface
- the detail surface should feel directly connected to the selected row

### 3. Reuse proven catalog patterns

Required:

- borrow the best parts of `Teachers` and `Subjects`
- do not make the page identical to them
- the outcome should feel uniform, not copy-pasted

## Verification Gates

Required:

- `npm --prefix atlas-client run build`
- verify no raw HTML interactive controls were introduced
- verify no mojibake remains
- verify no global page scrollbar was introduced
- verify the main table remains compact and laptop-usable
- verify the new section detail surface uses section-first assigned-class data
- verify the page now feels materially closer to `Subjects` and `Teachers` in information richness and visual language
- verify home-room editing still works in the intended states
- verify live/cached/no-cache status is still communicated honestly

## Required Output

Return:

1. files changed
2. row identity and table uniformity changes
3. section detail drilldown changes
4. assigned-class and teacher-ownership visibility changes
5. source-state wording changes
6. confirmation that compactness and no-scroll architecture were preserved
7. verification results
8. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- `Sections` now feels like a first-class scheduler page rather than a simpler sync table
- section-first assigned classes are visible through a clean drilldown workflow
- the page is materially more uniform with `Subjects` and `Teachers`
- source-state communication is honest and polished
- compactness and the no-scroll architecture are preserved
