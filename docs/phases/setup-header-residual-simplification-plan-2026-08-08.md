# Setup Header Residual Simplification Plan

Date: 2026-08-08 (second pass, resolved)
Target pages: Sections, Subjects, Teachers, Teaching Load.
Predecessor: `docs/phases/setup-header-simplification-plan-2026-08-08.md`.
Driver audit: `docs/analysis/setup-header-residual-density-audit-2026-08-08.md`.

## Goal

The first pass cleared the visible command header but let the moved clutter re-bloom one band lower or one menu deeper. This pass adds explicit band budgets so the relief is real and stays real. All decisions in this document are resolved against the primary-user constraint: older, non-technical scheduler officers.

## Resolved Decisions (From Open Questions)

| # | Decision | Rationale (non-technical schedulers) |
|---|---|---|
| 1 | Subjects `Add subject` — **promote inline**, always visible next to `Refresh offerings`, as a clearly-subordinate outline button. | Older users do not explore mystery icon-only More buttons. Consistent placement beats conditional placement. One primary + one clearly-subordinate outline action does not break the one-decision rule. |
| 2 | Teachers `Last sync` — **relocate to the source chip popover** as a secondary line (`Last verified: …`). | The chip already signals freshness at a glance; the timestamp is a "why is this stale?" diagnostic, which a user only wants when the chip looks wrong. Don't waste a strip slot on housekeeping data they rarely act on. |
| 3 | `Time display` Hours/Minutes — **delete from the Subjects filter row entirely**. Render the list rows in **hours** (hardcoded). Keep the Hours/Minutes toggle inside the Add/Edit modal untouched (it controls data entry, not list readability). Do not move to global settings. | `Time display` is not Subjects-only (the modal has its own copy), but the page-level toggle only affects list-row display. Hours is always the right unit for reading ("Filipino 5 hrs/wk"); minutes only matters during precise entry, which the modal already handles. Current page default of `'minutes'` is backwards for this demographic. |
| 4 | Teaching Load readiness strip — **state-driven**: `% staffed` (always) + `Unassigned pairs` (always, most prominent) + a **conditional alert chip** that renders `Teacher X: N` (amber), `Over cap: N` (red, generation blocker), or `Review saved coverage` (amber, split-brain) only when counts are non-zero. | Calm strip by default; problems surface only when problems exist. Permanent `Teacher X: 0` / `Over cap: 0` chips are noise and train users to ignore the red one when it finally appears. Conditional chip pulls the buried `Review saved coverage` alert out of More and into the visible strip. |

## Band Budgets

These are in addition to the header-height gates from the predecessor plan.

- Readiness strip chip count: Sections ≤2, Subjects ≤3, Teachers ≤3, Teaching Load ≤3 (with one slot state-driven).
- Default-visible filter controls (excluding search and the `More filters` toggle): ≤3 per page. Anything beyond that collapses behind the existing `More filters` toggle.
- More menu sections: ≤3, and only when a section actually has children. No self-referential helper copy.
- No global preference controls in per-page filter rows.

## Implementation Rules

- Command header layout from the predecessor plan stays unchanged: title, compact source/status chip, Help, one primary action (Subjects: primary + one inline outline secondary), More.
- Readiness strip remains the band directly below the command header, and only carries roster-health metrics — not housekeeping, not inverse duplicates, not archived counts on their own.
- Long descriptions stay in Help; long source-truth text stays in the source chip popover; secondary actions stay in More. No regression on these.
- Important alerts (split-brain/quarantine, sync failure) render in the readiness strip or as a banner, never only inside More.
- Existing routes and source-of-truth behavior must not change.

## Page Decisions

### Sections

- Keep the two existing readiness chips (`Sections`, `Home rooms assigned`). No change.
- Delete the hidden dead grade-level pill block at `Sections.tsx:874`.
- `Browse room map` stays in More.

### Subjects

- Command header: keep `Refresh offerings` as the primary (filled) button; promote `Add subject` to an **always-visible inline outline secondary** immediately next to it. Remove `Add subject` from the More popover on this page.
- Readiness strip target: three chips — `Active subjects` (with archived count folded in via tooltip, e.g., `Active 42 · 3 archived`), `Missing coverage`, `Room constrained`. Remove the standalone `Archived` chip.
- Filter row: keep `Status`, `Attention`, and one more visible by default (≤3 visible Selects). Collapse `Room Types`, `Grades`, `Programs` behind `More filters`.
- Delete the `Time display` Hours/Minutes control from the filter row entirely. Hardcode list-row duration rendering to **hours**. Lock the page-level default to `'hours'` (currently `'minutes'` at `Subjects.tsx:124`). Leave modal-level toggle untouched.
- Strip the self-referential helper copy and empty section headers from the More popover.

### Teachers / Faculty

- Readiness strip target: three chips — `Active teachers`, `With load`, `Over cap`. Fold `Without load` into the `With load` chip tooltip. Fold `Approval review` into Help or the source chip popover. Remove `Last sync` from the strip; relocate it to the source chip popover as a secondary line (`Last verified: …`).
- Command header stays as-is: `Review load` primary, `Create Placeholder` and `Refresh teacher roster` in More.

### Teaching Load

- Restore a compact readiness strip **below** the command header with three chips:
  - `% staffed` (always, headline health)
  - `Unassigned pairs` (always, most visually prominent)
  - state-driven alert slot: `Teacher X: N` (amber, when `syntheticPlaceholderPairs > 0`), `Over cap: N` (red, generation blocker), `Review saved coverage` (amber, when `showReviewBadge` is true).
- Shrink the More `Settings2` dropdown to advanced tools only: `View mode`, `Staffing mode`, `Reconcile saved coverage`, `Global reset`, `Open staffing audit`, `Show teacher jump list`. Remove the coverage snapshot grid from the dropdown.
- Surface `Review saved coverage` as the visible alert chip in the readiness strip when `showReviewBadge` is true, instead of only inside More.

### Cross-Cutting (AdminWorkspaceFrame More popover)

- Render the `Daily setup` / `Source data` / `Advanced tools` section headers only when their group has children. Delete the three fixed AI-generated helper sentences:
  - "Extra setup actions stay here so the header remains calm."
  - "Use the source chip for details; sync and refresh actions appear here when available."
  - "Use filters and row menus only when the default list is too broad."
- Keep the popover layout otherwise unchanged.

## Test Requirements

- All predecessor gates still pass: desktop header ≤88px (Teaching Load ≤96px), portrait ≤104px (≤112px), landscape ≤76px (≤84px); no global scrollbar; no horizontal overflow; no visible `Source truth:` sentence; More exposes hidden secondary actions; Help opens guidance; primary sync/refresh/placeholder/room-map/Teaching Load actions still reachable.
- New gates (extend `setup-header-simplification.spec.ts`):
  - Readiness strip chip count ≤ budget per page (`setup-readiness-strip` testid, count direct chip children).
  - Subjects default-visible filter Select count ≤3 before `More filters` is opened.
  - Subjects filter row no longer contains a `Time display` labeled control.
  - Subjects `Add subject` button is rendered in the command header (not only inside More).
  - Teachers readiness strip does not contain `Last sync` or both `With load` and `Without load` as separate chips.
  - Teaching Load readiness strip renders below the command header and shows `% staffed` (or equivalent) and `Unassigned pairs` without opening More.
  - Teaching Load `Review saved coverage` is visible in the readiness strip, not only inside More, when a split-brain incident is present (mock/fixture the `splitBrainIncident` state for the test).
  - `AdminWorkspaceFrame` More popover contains none of the three removed helper sentences.

## Out of Scope

- Changing which actions are primary vs secondary beyond what is named above (Decision 1 already resolves the Subjects inline question).
- New source-of-truth or routing behavior.
- Mobile-native or PWA shell changes outside the four target pages.

## Acceptance

- All test requirements (predecessor + new) pass on Sections, Subjects, Teachers, Teaching Load in desktop, mobile portrait, and mobile landscape.
- Visual scan: each of the four pages shows title + source chip + Help + one primary (+ Subjects' one inline outline `Add`) + More in the command row, ≤3 readiness chips below, ≤3 default-visible filter controls, and a Teaching Load readiness strip visible without opening More.
- No self-referential helper copy in any More popover.
- No dead hidden UI blocks (Sections grade pill bar deleted).

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-08-08 | atlas-uiux-expert | Initial second-pass plan. |
| 2026-08-08 | atlas-uiux-expert | Resolved all four open questions against the non-technical-scheduler constraint; folded into Page Decisions and Test Requirements. |