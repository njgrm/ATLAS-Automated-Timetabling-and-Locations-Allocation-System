# Requirements: Table Semantic Audit Gate

## Overview

Add Playwright E2E coverage that validates table readability and semantic correctness across the four admin list surfaces (`/subjects`, `/teachers`, `/sections`, `/teaching-load`). The spec acts as a regression gate: it catches header/body column mismatches, misleading labels, row structure inconsistencies, and mobile layout violations. A known current failure on `/subjects` (orphaned "Program" header) must be detected by the new tests.

## Scope

### In Scope
- Desktop table header-to-cell alignment audit for `/subjects`, `/teachers`, `/sections`
- Mobile card/list layout assertion for all four routes (including `/teaching-load`)
- Visible word count and badge count per row measurement (hard threshold)
- Primary action + More menu presence per row
- Misleading column label detection
- Row cell count vs header count validation
- Overflow regression co-check (existing `assertNoGlobalOverflow` reused)

### Out of Scope
- Fixing the `/subjects` column mismatch (test-first; fix is a separate prompt)
- Timetable grid semantic audit (separate domain, separate spec)
- Accessibility tree assertions beyond structural semantics (covered by `ux-guardrails.test.ts`)
- Teaching Load inner-grid (SubjectRow section cells) audit — the page has no `<table>` surface
- Student/public unauthenticated views

## Actors

| Actor | Description |
|-------|-------------|
| Playwright test runner | Automated E2E executor running against the live Tailnet environment |
| Scheduler Officer (admin) | Authenticated user whose session the tests simulate via `loginAdmin()` |

## Requirements

### Functional Requirements

#### FR-01: Desktop Header-Cell Alignment

- FR-01.1: When a desktop `<table>` is rendered on `/subjects`, `/teachers`, or `/sections`, the system (test) shall count the visible `<th>` elements in `<thead>` and the `<td>` elements in each data `<tr>`, and fail if any row's cell count does not equal the header count.
- FR-01.2: When a `<th>` contains a sortable button with a visible label, the test shall extract that label text and compare it against the semantic content of the corresponding `<td>` cell in the same column index, and fail if the cell content is semantically unrelated to the label.
- FR-01.3: The test shall treat the `/subjects` "Program" header (column index 3) as a known mismatch and assert that it fails, confirming the test catches the current bug.

#### FR-02: Misleading Label Detection

- FR-02.1: For each visible column header on desktop tables, the test shall extract the header label text and assert that at least one row's cell in that column contains content whose text matches a semantic expectation derived from the label (e.g., "Grades" column should contain grade-level text like "GR7", "GR8", etc.).
- FR-02.2: If a column header label is "Grades", the test shall assert that the corresponding cell text matches the pattern `/GR\d/` (case-insensitive) for at least one visible row, and fail if no row matches.
- FR-02.3: If a column header label is "Coverage", the test shall assert that the corresponding cell text contains one of the known coverage states: "Archived", "Excluded", "Teacher assigned", "Needs teacher".

#### FR-03: Row Word Count Budget

- FR-03.1: For each visible data row on desktop tables, the test shall compute the total visible word count across all `<td>` cells (splitting on whitespace, excluding empty strings).
- FR-03.2: The test shall fail if any single row exceeds 80 visible words, indicating possible content overflow or rendering confusion.
- FR-03.3: The test shall report the per-row word count in the test output for baselining.

#### FR-04: Badge Count Per Row

- FR-04.1: For each visible data row on desktop tables, the test shall count elements matching `[class*="Badge"], [data-slot="badge"], .badge` (or a refined selector based on shadcn Badge rendering).
- FR-04.2: The test shall fail if any single row contains more than 8 visible badges, indicating visual overload.
- FR-04.3: The test shall report the per-row badge count in the test output for baselining.

#### FR-05: Primary Action + More Menu

- FR-05.1: For each visible data row on desktop tables, the test shall assert that at least one actionable element (button or link) exists in the row's actions cell.
- FR-05.2: For each visible data row, the test shall assert that a "More" trigger (button with `aria-label` containing "More" or a `MoreVertical`/kebab icon) is present, or that the row's action cell contains a dropdown/popover trigger.
- FR-05.3: The test shall fail if any row has zero actionable elements or lacks a secondary "More" mechanism.

#### FR-06: Mobile Card Layout Assertion

- FR-06.1: When the viewport is set to mobile portrait (390px), the test shall assert that `/subjects`, `/teachers`, `/sections`, and `/teaching-load` do NOT render a visible `<table>` element.
- FR-06.2: When the viewport is set to mobile portrait, the test shall assert that at least one mobile card element is visible on each route (matching `data-testid` patterns like `subject-mobile-card`, `section-mobile-card`, or equivalent card containers).
- FR-06.3: On `/teaching-load` mobile, the test shall assert that the content shell renders cards or accordion items (not a desktop-width table).

#### FR-07: Overflow Regression Co-Check

- FR-07.1: For each route and viewport combination tested, the test shall call `assertNoGlobalOverflow(page)` to confirm no global scrollbar regression is introduced.
- FR-07.2: The overflow check shall use the existing `assertNoGlobalOverflow` helper from `timetable-layout-helpers.ts`.

### Non-Functional Requirements

#### NFR-01: Performance

- NFR-01.1: The full table-semantic-audit spec shall complete within 120 seconds total across all routes and viewports when run against the live Tailnet environment.

#### NFR-02: Isolation

- NFR-02.1: The spec shall be runnable in isolation via `npx playwright test table-semantic-audit` without depending on prior test execution order.
- NFR-02.2: The spec shall perform its own admin login in `beforeEach` and not share state between tests.

#### NFR-03: Maintainability

- NFR-03.1: The spec shall import shared helpers (`loginAdmin`, `assertNoGlobalOverflow`) from `timetable-layout-helpers.ts` rather than duplicating them.
- NFR-03.2: Column header expectations per route shall be defined as a data structure (array/object) at the top of the file, not scattered across individual test bodies.

## Acceptance Criteria

| ID | Criteria | Pass Condition |
|----|----------|----------------|
| AC-01 | Subjects header mismatch detection | The test asserting `/subjects` header-cell alignment FAILS for the "Program" column (orphaned header with no matching cell data), confirming the known bug is caught |
| AC-02 | Teachers header-cell alignment | The test asserting `/teachers` header-cell alignment PASSES (5 data columns + actions match 6 `<th>` elements) |
| AC-03 | Sections header-cell alignment | The test asserting `/sections` header-cell alignment PASSES (7 columns match 7 `<td>` cells) |
| AC-04 | Row word count | All rows across all three table routes are within the 80-word budget |
| AC-05 | Badge count | All rows across all three table routes are within the 8-badge budget |
| AC-06 | Primary action + More | Every visible data row on desktop has at least one action button and a secondary More mechanism |
| AC-07 | Mobile card layout | On mobile portrait, no `<table>` is visible on any of the four routes; mobile card elements are visible |
| AC-08 | Overflow co-check | `assertNoGlobalOverflow` passes on every tested route/viewport combination |
| AC-09 | Standalone run | `npx playwright test table-semantic-audit` runs without errors (aside from the intentional Subjects mismatch failure) |

## Open Questions

- [ ] None at this time.

## Assumptions

- The live Tailnet environment is accessible and ATLAS server is running.
- Admin credentials (`1000001` / `AdminSY2026!`) are valid.
- The existing `assertNoGlobalOverflow` helper works on the target routes without modification.
- shadcn Badge renders with a predictable class pattern or slot attribute that can be queried.

## Dependencies

- `timetable-layout-helpers.ts` — shared login and overflow helpers
- Playwright configured with desktop, mobile-portrait, and mobile-landscape projects
- Live Tailnet environment (`https://njgrm.buru-degree.ts.net`)

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-08-15 | opencode | Initial draft |
