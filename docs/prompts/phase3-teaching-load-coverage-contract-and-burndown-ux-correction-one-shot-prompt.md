# Gemini Execution Prompt: Phase 3 Teaching Load Coverage Contract And Burndown UX Correction One-Shot

## Mission

Correct the current Teaching Load table refactor so it becomes operationally honest and scheduler-usable.

The current pass improved structure, but it still has critical semantic and interaction failures:

- `Coverage` says all classes are covered, but `Section Allocation` still surfaces rows that appear unstaffed
- the page still enters `read-only` when the verified live runtime should allow writes
- `Staffing Audit` no longer opens the real report workflow
- teacher-table metrics and colors are still misleading
- the expanded teacher workflow still creates unnecessary scroll friction

This pass must fix those issues without abandoning:

- the table-first workflow direction
- the persistent right-hand workload inspector
- the modularized refactor baseline

---

## Out Of Scope

Do not do any of the following in this pass:

- reopen backend staffing math
- change REST API contracts
- redesign the workload inspector into a modal-first workflow
- introduce a new global state library
- rebuild the page into a brand-new dashboard concept

This is a frontend correction pass, not a new product reset.

---

## Required References

Read and follow these before changing code:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

Do not introduce a new frontend architecture direction in this pass.
This is a semantics, workflow, and usability correction pass on top of the current refactor.

---

## Context7 Preflight Summary

Before editing, verify the current recommended usage patterns for:

- sticky and scoped behavior inside nested scroll containers
- the current `shadcn/ui` `Sheet`, `Dialog`, `Tabs`, `Tooltip`, and `DropdownMenu` patterns already used in this repo
- any table or grid composition pattern you reuse for the burn-down surface

Apply only patterns that remain compatible with the current ATLAS no-scroll frontend contract.

---

## Current Verified Failures

These are already confirmed and must be treated as real defects:

1. `Section Allocation` is not aligned to the same coverage contract as the `962 / 962` headline.
2. Rows that are outside the real coverage demand are still being surfaced in `Section Allocation`.
3. The page still becomes `read-only` under conditions where runtime year is verified and integrity is non-blocking.
4. Clicking `Staffing Audit` no longer opens the full report modal or sheet and instead just switches grid mode.
5. Teacher row load signaling paints `> 30h` too aggressively as danger instead of warning or review.
6. Teacher row `Classes` is using subject-assignment count rather than actual section count.
7. The teacher expanded action strip is not sticky within its own expanded block, causing repetitive scroll friction.
8. `Toggle subject list` is currently a dead or non-meaningful control.
9. `Review Needed` is too vague and does not communicate actionable review content.
10. Search and filter sizing plus header hierarchy are imbalanced.
11. Session cards inside expanded subject or grade groups are visually inconsistent and too center-biased.

These are the problems to solve.

---

## Product Decisions To Follow

These are not optional. Implement to these decisions exactly.

### 1. Coverage contract alignment

`Section Allocation` must show only rows from the exact same coverage contract as the coverage headline.

If a row is not part of the true coverage demand, it must not appear in `Section Allocation`.

Do not keep a secondary "extra rows" browse mode inside this workspace.
Hide non-coverage rows entirely from this mode.

### 2. Writable behavior

The page should be writable whenever:

- the runtime year is verified
- integrity or quarantine is non-blocking
- the backend accepts writes

Do not force read-only behavior only because the source label is not literally `live`.

### 3. Section Allocation working model

This mode must act like a burn-down checklist, not a generic all-data matrix.

Primary structure:

- rows should primarily represent sections
- expanding a section should reveal the specific covered or uncovered subject rows relevant to staffing within that section

Default behavior:

- prioritize or exclusively filter to sections with unassigned subjects
- fully staffed sections should be hidden by default or clearly diminished behind an explicit filter

If a section becomes fully staffed during active work:

- it may remain visible temporarily
- but it must clearly signal completion, for example with a green completed state

### 4. Sticky teacher action strip

When a teacher row is expanded in `By Teacher` mode:

- the local teacher action strip (`Name`, `Undo`, `Redo`, `Save`, related row actions) shall stick to the top of the viewport
- it shall remain sticky only while the user is scrolling within that teacher's expanded block
- it shall unstick when the bottom of that expanded block scrolls out of view
- it shall return to normal when the user scrolls back upward

This is not a global page-sticky toolbar.
It is a block-scoped sticky header.

### 5. Table metrics

Show both metrics explicitly and separately:

- `Subjects` = count of distinct subject assignments
- `Sections` = count of actual assigned section rows or class sections

Do not keep the vague single `Classes` metric.

### 6. Staffing Audit

`Staffing Audit` is a reporting tool, not just a workspace-mode switch.

Clicking it must bring back the full staffing audit modal or sheet used earlier.

`Section Allocation` may still exist as an active workspace mode, but it must not replace the audit workflow.

---

## Required UX And UI Corrections

### 1. Align `Section Allocation` to the true coverage contract

Required outcome:

- derive allocation rows only from the same schedulable demand basis used by the coverage headline
- remove any currently surfaced rows that come from broader catalog pairing rather than real coverage demand
- ensure the user cannot see "unstaffed" allocation work that the system simultaneously claims does not exist

If `Coverage = 962 / 962`, the allocation surface must not still imply unresolved staffing debt.

### 2. Rebuild `Section Allocation` into a true burn-down surface

Required outcome:

- make section rows the primary visible rows
- nested or expanded detail should show the subject needs within that section
- default filter should emphasize sections that still require staffing attention
- fully staffed sections should not dominate the view

Do not leave this as a flat subject-section matrix if it still feels like a generic dump of demand rows.

### 3. Restore writable behavior when runtime truth permits it

Required outcome:

- remove false `read-only` lock behavior when:
  - runtime year is verified
  - integrity is not blocking
  - write endpoints are actually allowed
- keep destructive actions appropriately guarded
- keep integrity-blocked states protected

But do not lock normal scheduler work because of an overly narrow source-label check.

### 4. Bring back the real staffing audit report

Required outcome:

- `Staffing Audit` must open the full report modal or sheet
- it may additionally offer navigation into `Section Allocation`, but report access must come first
- the report must remain distinct from the main workspace mode

### 5. Fix header hierarchy and sizing balance

Required outcome:

- strengthen the top master header (`Coverage`, grid mode, top-level controls) with slightly larger height and stronger typography
- reduce the visual heaviness of the local search and filter toolbar beneath it
- make the top-level hierarchy clearly feel more primary than local discovery controls

Do not let the search and filter bar visually overpower the page's main control header.

### 6. Correct load color semantics

Required outcome:

- `> 30h` must be a warning or review state using orange or amber
- `> 40h` must be the danger or hard-cap state using red
- do not paint teachers red merely because they crossed `100%` or `30h`

The color model must match the actual staffing policy.

### 7. Correct teacher table metrics

Required outcome:

- replace the misleading `Classes` metric
- show both `Subjects` and `Sections`
- ensure `Sections` reflects real assigned section count, not distinct subject row count

### 8. Make session cards uniform and left-aligned

Required outcome:

- within expanded grade-level groups, enforce a strict `3-column` session grid where screen size allows
- do not let card widths vary based on content length
- align section or session card text to the left
- optimize so long section names and teacher names remain readable most of the time

Do not keep the current uneven container widths and centered-content look.

### 9. Remove or wire dead controls

Required outcome:

- remove `Toggle subject list` if it is not serving a real purpose
- or fully wire it to an obvious, meaningful behavior

Do not keep non-functional controls in the toolbar.

### 10. Make reset behavior honest and reachable

Required outcome:

- ensure the global reset entrypoint is reachable in the current table workflow
- ensure it is not disabled for false runtime reasons when the page is otherwise writable
- if unsaved drafts exist, require clear typed or explicit confirmation before destructive reset

Do not leave reset visibly present but functionally unavailable for the wrong reason.

### 11. Replace vague review messaging

Required outcome:

- remove the current vague `Review Needed` banner or badge unless it becomes actionable
- if retained, it must open explicit review detail such as:
  - overload review list
  - special-program review list
  - remaining integrity notes

Do not keep a warning surface that does not explain what the scheduler should actually do.

### 12. Preserve the persistent inspector, but do not make it the only path

Required outcome:

- keep the right-hand inspector as the canonical workload context surface
- do not revert to modal-per-teacher arithmetic
- but also do not force every reporting workflow into the drawer if a dedicated modal or sheet is more appropriate

This means:

- teacher load reasoning -> inspector
- staffing report or audit workflow -> modal or sheet

### 13. Keep outside-department subjects hidden by default

Required outcome:

- preserve the calmer default where cross-department subjects stay hidden unless explicitly toggled on
- do not regress this in the pass

---

## Interaction Constraints

Mandatory:

- preserve no-scroll architecture
- preserve table-first familiarity with `Teachers` and `Sections`
- keep primary workflow on `@/ui/*` primitives only
- preserve hover-to-reveal single-item removal
- keep the persistent inspector non-blocking
- no popover-first or modal-first teacher arithmetic workflow
- no raw native controls

Do not introduce:

- a second sprawling dashboard layer
- global browser scrollbars
- misleading "shortage" labeling when the data is not shortage-only
- dead toolbar controls

---

## Execution Steps

1. Align the `Section Allocation` data shaping to the exact headline coverage contract and remove non-coverage rows from the workspace.
2. Rebuild `Section Allocation` into a section-first burn-down experience with explicit section-completion treatment.
3. Correct writable and read-only gating so verified runtime plus non-blocking integrity restores normal scheduling actions.
4. Restore the real `Staffing Audit` report modal or sheet and separate it from workspace-mode switching.
5. Rebalance header hierarchy, fix load severity color semantics, and replace the vague `Classes` metric with `Subjects` plus `Sections`.
6. Implement the block-scoped sticky teacher action strip, uniform left-aligned session cards, and dead-control cleanup.
7. Verify on Tailnet, append evidence, and keep fixing within the same pass if the page still feels semantically inconsistent.

---

## Tailnet Verification Requirements

You must verify on:

- `https://njgrm.buru-degree.ts.net`
- Admin: `1000001 / AdminSY2026!`

Verify all of the following:

1. `Coverage` and `Section Allocation` now agree on what demand exists.
2. Non-coverage rows no longer appear in `Section Allocation`.
3. The page is writable under verified year-55 runtime when integrity is non-blocking.
4. `Staffing Audit` opens the real report modal or sheet again.
5. Expanded teacher blocks use the smart sticky local action strip correctly.
6. Teacher rows show separate `Subjects` and `Sections` counts.
7. `> 30h` is warning or orange and `> 40h` is danger or red.
8. Expanded session cards are uniform, left-aligned, and visually calmer.
9. `Toggle subject list` is either removed or made meaningfully functional.
10. `Review Needed` is either removed or converted into an actionable review entrypoint.

If the page still feels semantically confusing after the first pass, keep fixing in the same pass.

---

## Evidence And Logging Requirements

You must append implementation evidence to:

- `docs/verification/evidence-log.md`

Include:

- exact live runtime year and source state used for verification
- proof that coverage and allocation semantics now match
- proof that write state is restored under the correct runtime conditions
- proof that the staffing audit modal or sheet returned
- proof that sticky teacher-row behavior works

---

## GO / NO-GO

### GO only if:

- allocation semantics now match real coverage truth
- false read-only state is gone
- staffing audit is a real report workflow again
- teacher-table metrics and load colors are honest
- the expanded-teacher sticky action strip works correctly
- dead or vague controls are removed or made meaningful

### NO-GO if:

- coverage still says fully staffed while allocation still implies missing staffing work
- the page remains read-only under healthy verified runtime
- staffing audit still only switches tabs
- section counts are still mislabeled
- load colors still overstate ordinary overloads as hard-cap danger
