# Gemini Execution Prompt: Phase 3 Teaching Load Scheduler Workspace UX One-Shot

## Objective

Recover `Teaching Load` as a usable scheduler workspace without changing the staffing math or backend truth model.

This pass is strictly for UX/UI.

The latest page became too vertically expensive and too card-heavy for practical manual scheduling, especially in the `Subject Assignments` area.

The target outcome is simple:

- keep the current truthful load and shortage model visible
- make the page feel calm
- make the manual assignment workspace large enough and dense enough for real scheduler work

## Required Context

Read first:

- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-teaching-load-ux-and-staffing-audit-2026-05-23.md`
- `docs/analysis/phase3-subjects-teachers-and-teaching-load-visual-language-audit-2026-05-23.md`

Inspect directly:

- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/components/faculty-assignments/OverviewHeader.tsx`
- `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
- `atlas-client/src/components/faculty-assignments/AutoFillSummaryModal.tsx`
- `atlas-client/src/index.css`

Use Context7 first if you need version-sensitive guidance for:

- `shadcn/ui` composition patterns
- `Popover`, `HoverCard`, `DropdownMenu`, `Sheet`
- current React / Vite interaction behavior

## Facts To Treat As Settled

- scheduler-facing naming is:
  - `Teachers`
  - `Teaching Load`
  - `/teachers`
  - `/teaching-load`
- raw-vs-concurrent staffing truth must stay visible
- current teacher-side rotation-aware load math must stay visible
- this pass must not redesign the truth model
- this pass must not touch backend staffing calculations except for tiny client-contract support if absolutely unavoidable

## Main UX Diagnosis To Fix

The `Subject Assignments` workspace is too small because too much fixed vertical space is consumed above it by:

- overview cards
- data health band
- large selected-teacher header
- large persistent load explanation block
- lacking-faculty alert band
- assignment toolbar
- assignment filter row

At the same time, each subject row and section cell is too tall.

This combination makes the actual assignment surface too cramped under the no-scroll layout.

Gemini audit additions to treat as explicit design intent:

- flatten `OverviewHeader` into a slimmer stat-line or compact banner treatment instead of three large stacked cards if that restores meaningful workspace height
- compress the selected-teacher area into a single stronger `identity bar` plus a smaller secondary load strip instead of a large dashboard-style card
- convert the current section-card grid into a denser `tag-list`, `button-group`, or similarly compact assignment-target pattern
- move integrity diagnostics and maintenance controls into a calmer secondary surface such as an overflow menu, collapsed diagnostics panel, or equivalent progressive-disclosure treatment
- solve density by reducing container footprint and hierarchy noise, not by shrinking persistent text below reasonable reading size

## Scope

### In Scope

#### A. Recover workspace height

Required:

- materially increase the usable visible height of the `Subject Assignments` area
- target recovery on a normal laptop viewport, not just wide desktop screenshots
- compress the selected-teacher panel substantially
- merge or slim stacked control bands where possible
- flatten the top overview treatment if necessary to reclaim meaningful height
- keep the no-scroll architecture intact
- do not solve this by adding global page scroll

#### B. Rebuild the assignment surface for density

Required:

- make `SubjectRow` denser and more scheduler-efficient
- reduce the current card-heavy feel of per-section assignment cells
- prefer a compact tag-list / segmented-button / pill-grid style over full mini-cards where possible
- preserve ownership/conflict safety
- preserve specialization display where it matters
- preserve advisory/system-assigned signals where they matter
- make it easier to scan and place many section targets quickly

#### C. Keep explanation durable, but smaller

Required:

- keep the load explanation visible without hover-only dependence
- reduce its footprint substantially
- turn the current large blue explanation slab into a compact inline interpretation pattern
- keep deeper interpretation available through progressive disclosure if needed
- do not let the persistent explanation consume full card height or a large fixed column in the selected-teacher area

#### D. Simplify the left rail

Required:

- reduce microtext
- reduce stacked visual noise
- keep specialization more important than employee ID or other technical metadata
- keep the roster rail readable under dense use
- if identity can be expressed in one stronger line and one smaller supporting line, prefer that over three-layer stacked metadata

#### E. Make the top workflow band calmer

Required:

- keep the truthful overview metrics
- make the action band and overview consume less visual and vertical weight
- keep maintenance and data-health access available, but less dominant
- remove any dashboard-like padding or card treatment that is wasting height in a dense operator page

#### F. Keep staffing modal usable

Required:

- preserve the raw-vs-concurrent explanation
- do not let the modal become even taller or denser
- keep it readable and action-oriented

#### G. Typography and weight cleanup

Required:

- inspect `index.css` and current table/rail weights
- reduce unnecessary heaviness
- avoid persistent workflow text smaller than `text-xs` where possible
- standardize toward `text-sm` and `text-xs` rather than repeated custom `0.6rem`-style microtext
- keep the page professional and readable, not shouty

### Out Of Scope

Do not:

- rewrite backend staffing math
- change Auto-Fill logic
- redesign unrelated pages
- remove truthful diagnostics entirely
- add new workflow scope beyond `Teaching Load`

## Implementation Direction

### 1. Prioritize viewport economics

This page is a dense operator tool.  
The main success criterion is not prettiness.  
It is how much usable assignment workspace the scheduler gets without losing trust or clarity.

### 2. Prefer compact grouped summaries over large stacked panels

Compress:
- selected teacher identity
- load preview
- load interpretation

Do not hide the truth, but stop paying such a large height cost for it.

Where it helps, prefer:
- a compact stat line
- an identity bar
- a small expandable diagnostics surface

over:
- multiple dashboard cards
- a full-height explanation slab
- several fixed-height stacked bands

### 3. Prefer denser assignment targets over decorative cards

The current section cards look polished but waste space.  
Use a denser scheduler-first assignment presentation.

### 4. Keep risk tools separated

Maintenance and integrity diagnostics should remain available but should not compete visually with daily manual assignment work.

## Verification Gates

Required:

- `npm --prefix atlas-client run build`
- verify no raw HTML interactive elements were introduced
- verify no visible mojibake remains in `Teaching Load`
- verify the `Subject Assignments` workspace is visibly larger than before
- verify the selected-teacher area is materially shorter than before
- verify the subject-row section targets are denser and easier to scan than before
- verify the no-scroll architecture is still preserved
- verify the page no longer relies on repeated microtext to fit its core workflow

## Required Output

Return:

1. files changed
2. workspace-height recovery changes
3. selected-teacher compression changes
4. subject-row density changes
5. teacher-rail readability changes
6. top-band and modal cleanup changes
7. verification results
8. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- the `Subject Assignments` area is materially larger and more usable
- the page still preserves the current truthful metrics
- the selected-teacher block is materially more compact
- section assignment targets are denser and more scheduler-friendly
- no-scroll architecture is preserved
- all required verification was actually run
