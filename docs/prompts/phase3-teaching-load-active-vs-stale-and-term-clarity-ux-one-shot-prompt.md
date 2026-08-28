# Gemini Execution Prompt: Phase 3 Teaching Load Active-vs-Stale and Term Clarity UX One-Shot

## Objective

Finish the scheduler-facing clarity layer for `Teaching Load` after the current Gemini workspace rehaul.

This is not a redesign from scratch.
Continue from the current calmer UI and preserve the recent workspace improvements.

The remaining UX gap is that the page still does not clearly distinguish:

- active live ownership
- stale historical ownership
- uncovered pairs
- rotation-family / per-term load behavior

The next pass must make those truths understandable to schedulers without regressing the current improved layout.

## Required Context

Read first:

- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-teaching-load-live-discrepancy-audit-2026-05-23.md`
- `docs/analysis/phase3-teaching-load-ux-and-staffing-audit-2026-05-23.md`

Inspect directly:

- `atlas-client/src/pages/FacultyAssignments.tsx`
- `atlas-client/src/components/faculty-assignments/OverviewHeader.tsx`
- `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
- `atlas-client/src/components/faculty-assignments/AutoFillSummaryModal.tsx`
- any new `Teaching Load` subcomponents introduced by the recent Gemini rehaul

Use Context7 first if you need version-sensitive guidance for:

- `shadcn/ui` patterns
- `HoverCard`, `Popover`, `Sheet`, `Tabs`, `Badge`, `Tooltip`
- current React / Vite interaction behavior

## Facts To Treat As Settled

- scheduler-facing naming stays:
  - `Teachers`
  - `Teaching Load`
  - `/teachers`
  - `/teaching-load`
- preserve the current calmer workspace direction from the latest Gemini pass
- do not undo the current workspace-height recovery
- preserve the current truthful raw-vs-concurrent staffing model
- preserve the current rotation-aware teacher load model

## Main UX Problems Still Open

### 1. Active versus stale ownership is not visible enough

The current page can still make a subject-section pair look "owned" even when the owner is stale and no longer part of active staffing truth.

Schedulers need a clear visual distinction between:

- actively owned
- stale historical owner
- uncovered
- synthetic or placeholder debt, if surfaced diagnostically

### 2. Per-term / rotation behavior is still communicated as math, not as workflow meaning

The page currently explains that rotation overlap is removed from weekly load, but does not clearly tell schedulers:

- why that happens
- which subject families are rotational
- what that means for manual assignment interpretation

### 3. The page still risks feeling more diagnostic than operational

The current rehaul improved workspace size.
Do not throw that away.

But the explanation layer still needs to become more scheduler-readable and less system-internal.

## Scope

### In Scope

#### A. Make active versus stale ownership visually explicit

Required:

- in the assignment surface, distinguish active live ownership from stale historical ownership
- stale ownership must not look identical to active ownership
- stale ownership should be visibly demoted and explained
- if a stale owner still exists in diagnostic truth, the scheduler should understand:
  - this row is not currently staffed
  - this is historical debt, not live ownership success

Preferred outcome:

- active ownership uses the main positive ownership style
- stale ownership uses a quieter warning/debt style
- uncovered uses a clearly actionable state

#### B. Make rotation-family / per-term meaning visible

Required:

- preserve the current rotation-aware load interpretation
- add a clearer scheduler-facing explanation of what a rotation family means
- explain that some subjects are counted as overlapping term-family demand rather than simultaneous weekly demand
- surface which subjects in the selected-teacher view are part of that rotation-family adjustment

Do not make this explanation feel like a developer diagnostic.
It must read as scheduler guidance.

#### C. Improve subject assignment clarity without losing the new density

Required:

- keep the denser assignment surface from the recent Gemini rehaul
- if stale ownership appears in the row-level interaction model, make it clear and intuitive
- do not let stale blockers feel like hidden technical conflicts

#### D. Keep the top and side surfaces calm

Required:

- do not re-expand the top band into heavy cards again
- do not re-bloat the selected-teacher area
- any new explanation or diagnostic treatment must fit the current calmer layout
- prefer compact, progressive disclosure over large new slabs

#### E. If backend stale-diagnostic support lands, consume it honestly

Where stale-ownership diagnostics are available, the page shall:

- surface them in plain scheduler language
- not collapse them into generic conflict language
- not silently ignore them

#### F. Missing Information & Quality of Life (QoL) Improvements

Required:

- **Swap Impact Preview**: Provide context when overriding an assignment (e.g., via a tooltip or popover showing the load shift).
- **Batch Assignment Tools**: Implement "Select All [Grade]" within a subject row to quickly assign sections in batch, reducing repetitive clicks.
- **Subject Quick-Jump**: Add a mechanism (e.g., sidebar or anchor links) to quickly navigate to specific subjects, especially useful for large catalogs.
- **Draft Change Ledger**: Include a small "Pending Changes" summary or ledger (e.g., "Added X sections to Teacher Y") so schedulers can review unsaved work.
- **Department Completion Stats**: Display high-level progress (e.g., "Math: 85% Staffed") to give schedulers a macro view of completion tracking.

### Out Of Scope

Do not:

- rewrite staffing math
- redesign the whole page again
- revert the current workspace-density improvements
- add global scroll
- reintroduce badge spam or card-heavy assignment cells

## Implementation Direction

### 1. Continue from the current UI, do not reset it

This pass must explicitly build on the recent Gemini rehaul.

Treat the current page as the new baseline and refine clarity on top of it.

### 2. Translate truth buckets into scheduler language

Avoid internal phrases unless necessary.

Schedulers should be able to tell:

- this class is actively staffed
- this class only has a stale historical owner
- this class still needs a live teacher

### 3. Show term-aware meaning where the scheduler is already looking

The rotation explanation should live in the selected-teacher context and subject-assignment context, not in a detached technical block.

### 4. Keep density gains

Do not "solve" clarity by making the page tall again.
Use compact semantic treatments.

## Verification Gates

Required:

- `npm --prefix atlas-client run build`
- verify the current denser workspace remains materially usable
- verify no raw HTML interactive elements were introduced
- verify no mojibake remains
- verify active vs stale vs uncovered states are visually distinguishable
- verify per-term / rotation meaning is clearer than before without making the page more technical

## Required Output

Return:

1. files changed
2. active-vs-stale ownership clarity changes
3. per-term / rotation communication changes
4. assignment-surface clarity changes
5. confirmation that current workspace-density gains were preserved
6. verification results
7. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- the page clearly distinguishes active ownership, stale historical ownership, and uncovered rows
- per-term / rotation-family behavior is easier for schedulers to understand
- the current Gemini workspace rehaul is preserved rather than undone
- the page remains calm, compact, and usable under the no-scroll layout
- all required verification was actually run
