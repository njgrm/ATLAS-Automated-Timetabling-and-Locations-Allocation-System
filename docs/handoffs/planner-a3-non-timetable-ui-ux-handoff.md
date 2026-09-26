# Planner A3 — non-timetable UI/UX remediation handoff

**Disposition:** `KEEP_ACTIVE` until A3 has created bounded implementation packets.

## Purpose and source of truth

This is A3's working progress record for the non-timetable UI/UX findings verified on the live Tailnet on 2026-09-27. The full requirement ledger remains the user-supplied file:

- `D:/ATLAS/ATLAS-FIXES-CODEX-PLANNER-HANDOFF.md`

That root file is user-owned and currently untracked in the shared checkout. Do not edit it from an implementation lane. A3 must record progress **in this file** after each verification or implementation milestone, preserving the baseline below.

## Ownership boundary — A3 only

### In scope

- Sections and room-map UI: Fixes 01–12.
- Subjects UI: Fixes 09, 15, 17, 19, 20, 31, 32, 33A, 33B.
- Teachers and Teaching Load UI: Fixes 13, 14, 16, 18, 21–26, 29, 30.

### Explicitly out of scope — A2 timetable ownership

Do not edit, plan, test, or change:

- `/timetable`, Class Schedule, Room Schedules, published schedules, exports, generation, publication, revisions, or schedule reads.
- `atlas-client/src/pages/Timetable*` or `atlas-client/src/components/timetable/**`.
- Server timetable/generation routes, term-selection logic, run state, published-run data, or timetable query shape.
- A shared UI component when its change would alter timetable behavior or styling, unless A2 accepts that dependency in writing.

Specific fences:

- Fix 22 applies only to Teachers and Teaching Load; Class Schedule name rendering stays with A2.
- Fix 26 must not add or alter a “Proceed to Timetable” action.
- Fix 33B is presentational only. Preserve rotation/shared-session data, persistence, and scheduling semantics.

## Baseline evidence

- Live origin: `https://njgrm.buru-degree.ts.net`
- Live release observed: `0da104f96696aef7de7016e5364f29b50d0ed00f`
- Primary QA viewport: desktop `1366×768`; only a brief `390×844` Subjects smoke was performed.
- No records, assignments, swaps, saves, publications, or timetable data were changed during the audit.
- Browser console: no errors on the exercised Sections, Subjects, Teachers, Teaching Load, and Map routes. Authenticated API requests returned 200 in the captured desktop session.
- Focused test: `npm --prefix atlas-client run test:teaching-load-clarity` passed 8/8.
- Do not treat `test:visual:faculty` as a passing gate: it references a missing Playwright spec. The Teaching Load visual script was blocked by its separate terminal credential requirement.

## Current finding ledger

Status meaning: `REPRODUCED` was observed on the current desktop runtime; `VERIFIED_FIXED` was exercised without the historical defect; `SOURCE_CONFIRMED` is exact deployed-source evidence needing a targeted interaction; `PARTIAL` is partly resolved; `NEEDS_REPRO` needs a specific scenario; `SOURCE_GAP` has no valid requirement.

| Fix | Baseline status | A3 next action | A3 progress |
|---|---|---|---|
| 01 | VERIFIED_FIXED | Preserve; regression-test picker scroll containment. | TODO |
| 02 | VERIFIED_FIXED | Preserve; regression-test one picker layer. | TODO |
| 03 | REPRODUCED | Widen/reflow picker occupancy text; test long occupant name. | TODO |
| 04 | SOURCE_CONFIRMED | Exercise occupied-room change; retain confirmation and zero-write Cancel control. | TODO |
| 05 | SOURCE_CONFIRMED | Verify direct map entry; do not regress it. | TODO |
| 06 | NEEDS_REPRO | Test BuildingView pan/zoom on floor-level state before changing bounds. | TODO |
| 07 | SOURCE_CONFIRMED | Audit interior room-card overlap at usable zoom. | TODO |
| 08 | PARTIAL | Obtain product decision: deselect versus unassign. | BLOCKED_PRODUCT_DECISION |
| 09 | REPRODUCED | Replace oversized technical Subjects warning with calm, actionable state copy. | TODO |
| 10 | SOURCE_CONFIRMED | Increase map typography and badge legibility. | TODO |
| 11 | SOURCE_CONFIRMED | Rework premature room-name truncation. | TODO |
| 12 | SOURCE_CONFIRMED | Add persistence-aware success/error feedback; distinguish queued from saved. | TODO |
| 13 | PARTIAL | Use grade display treatment in workload detail without changing timetable surfaces. | TODO |
| 14 | PARTIAL | Improve Teaching Load desktop density without page-level scroll. | TODO |
| 15 | REPRODUCED | Make primary Subjects filters directly visible. | TODO |
| 16 | REPRODUCED | Reduce Teaching Load click/load density; keep controls mouse-first. | TODO |
| 17 | REPRODUCED | Convert targeted desktop review drawers to responsive dialogs; preserve mobile sheets where useful. | TODO |
| 18 | PARTIAL | Standardize grade treatment only in A3-owned routes. | TODO |
| 19 | SOURCE_CONFIRMED | Prevent wrapping/clipping in A3-owned action menus; avoid broad primitive change. | TODO |
| 20 | PARTIAL | Add truthful post-save feedback and maintain internal dialog scrolling. | TODO |
| 21 | REPRODUCED | Remove redundant Next Teacher strip and reclaim roster space. | TODO |
| 22 | REPRODUCED | Standardize display casing in A3-owned Teacher/Load UI only. | TODO |
| 23 | REPRODUCED | Use Fix 17 dialog pattern for Teacher profile detail. | TODO |
| 24 | REPRODUCED | Update Teachers menu copy and keep labels on one line. | TODO |
| 25 | REPRODUCED | Replace default navigation with in-page workload review dialog. | TODO |
| 26 | REPRODUCED | Remove permanent desktop inspector; reuse workload content in an audit modal. | TODO |
| 27 | SOURCE_GAP | Do not implement. | BLOCKED_SOURCE_GAP |
| 28 | SOURCE_GAP | Do not implement. | BLOCKED_SOURCE_GAP |
| 29 | SOURCE_CONFIRMED | Restrict swap to a dedicated control and require confirmation; prove Cancel = zero draft change. | TODO |
| 30 | SOURCE_CONFIRMED | Separate Select checked and hover states in a route-safe way. | TODO |
| 31 | REPRODUCED | Display `BEC` for persisted `REGULAR`; do not migrate enum/schema. | TODO |
| 32 | REPRODUCED | Filter Faculty Room/Office only from Subject room-need options. | TODO |
| 33A | REPRODUCED | Make Advanced Scheduling Rules always visible. | TODO |
| 33B | REPRODUCED | Hide Shared class session UI while preserving logic/schema; elevate Rotates by term. | TODO |
| 34 | SOURCE_GAP | Do not implement. | BLOCKED_SOURCE_GAP |

## Required progress discipline

After every meaningful A3 action, update the corresponding **A3 progress** cell and append a dated entry below. Do not replace baseline evidence with an unsupported claim.

Allowed progress values:

- `TODO`
- `REPRODUCED`
- `VERIFIED_FIXED`
- `IMPLEMENTED_PENDING_QA`
- `QA_PASSED`
- `BLOCKED_<reason>`
- `SUPERSEDED_<reason>`

Each dated entry must contain:

1. Fix IDs and intended outcome.
2. Base SHA and candidate SHA, when a candidate exists.
3. Exact changed paths.
4. Focused test command/result.
5. Desktop browser result at `1366×768`, including accessibility, console, and network status.
6. For a mutation-capable flow: a negative control proving Cancel/non-action made zero changes.
7. Any A2 dependency or explicitly retained risk.

## Progress log

### 2026-09-27 — live baseline captured

- Owner: Planner A3 (handoff prepared; no implementation started).
- Evidence: live desktop audit and exact deployed-source inspection.
- Outcome: 01 and 02 verified fixed; 03, 09, 15–17, 21–26, 31–33B reproduced; 27, 28, and 34 remain source gaps; remaining rows are targeted source/interaction follow-ups.
- A2 dependency: none permitted without an explicit ownership transfer.

## Execution sequence

1. Reconfirm the baseline in a clean A3 worktree and close 01, 02, 04, 05, 06, and 14 before proposing changes.
2. Plan Sections/Map as one stream: 03, 07, 08, 10–12.
3. Plan Subjects as one stream: 09, 15, 17, 19, 20, 31, 32, 33A/B.
4. Plan Teachers/Teaching Load as one stream: 13, 16, 18, 21–26, 29, 30.
5. Keep 13+18, 14+16, 17+23, 25+26, and 33A+33B as consolidated changes rather than independent patches.

## Handoff completion condition

Return one compact ledger update against this file with every row in a terminal or explicitly blocked state. Include the candidate range, exact changed paths, decisive tests, browser evidence, known risks, and a clear verdict. Do not claim timetable acceptance, deployment, publication, or data mutation evidence.
