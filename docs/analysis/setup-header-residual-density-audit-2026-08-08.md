# Setup Header Residual Density Audit

Date: 2026-08-08 (second pass)
Re-audits: Sections, Subjects, Teachers, Teaching Load.
Predecessor: `docs/analysis/setup-header-density-audit-2026-08-08.md` and the simplification pass Codex landed on 2026-08-08.

## Verdict

CONDITIONAL GO.

The first pass fixed the command header band (title + source chip + Help + one primary + More) and removed the visible long `Source truth:` sentence. That part worked. But the relocated clutter did not disappear — it moved one band down or one menu deeper, and in some cases an AI-generated filler section header was introduced. The result is that four pages still feel busy, just in different places.

This pass audits what survived Codex's simplification and where the next cut should land.

## What Codex Got Right

- Command header is now one row: page title, compact source chip, Help trigger, one primary action, More. `AdminWorkspaceFrame` (`atlas-client/src/components/admin-workspace/AdminWorkspace.tsx:160`) and `WorkspaceToolbar` (`atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx:152`) both comply.
- Visible `Source truth:` sentence is gone from all four pages; it survives only as `sr-only` copy for assistive tech, which is correct.
- Source detail moved into a popover on the source chip (`AdminSourceStateChip`, AdminWorkspace.tsx:70).
- Teaching Load toolbar visibly shows title, one workspace-state Badge (with tooltip), Help, one primary action, and a More icon button — one-decision rule holds in the visible band.
- `setup-header-simplification.spec.ts` adds height gates (88/104/76px desktop/portrait/landscape, 96/112/84px for Teaching Load) and a no-visible-`Source truth:` assertion.

## Concrete Findings

### Sections (`atlas-client/src/pages/Sections.tsx:787`)

- This is the leanest of the four. Readiness strip has two chips (`Sections`, `Home rooms assigned`) — within budget.
- Dead code remains: a hidden grade-level pill bar at `Sections.tsx:874` (`<div className="hidden">` then a row of `Grade Level:` pills). It renders nothing but lives in the DOM and the file. Remove it.
- `Browse room map` is the only `secondaryActions` child and still sits behind the More popover. Defensible, but note that More is being opened for exactly one action on this page.

### Subjects (`atlas-client/src/pages/Subjects.tsx:545`)

- Readiness strip has four chips: `Active subjects`, `Archived`, `Missing coverage`, `Room constrained`. `Archived` is informational only and adds noise without adding an action; it can be folded into `Active subjects` (e.g., `Active X · Y archived`) or dropped to a tooltip.
- The content toolbar (`Subjects.tsx:588`) exposes five `<Select>` filters plus a `Time display` Hours/Minutes toggle plus a `Reset all` button. That is six controls in a single band — the band-density problem that pushed us to simplify has simply reappeared one row lower.
- `Time display` (Hours/Minutes) is a global preference, not a Subjects-specific filter. It does not belong on this page at all; if it is needed it should live in app settings or be removed. It fails the SMART-family "one band, one purpose" test.
- `Add subject` was demoted into More even though on Subjects it is the canonical daily action in many workflows. Plan codified "Refresh offerings primary, Add subject in More", but the re-audit suggests at minimum keeping `Add subject` visible next to `Refresh offerings` or surfacing it when the list is empty.
- Stat strip and filter row together still produce a wall-of-chips-then-wall-of-selects effect before the user sees the subject list.

### Teachers / Faculty (`atlas-client/src/pages/Faculty.tsx:582`)

- Readiness strip (`Faculty.tsx:498` → `teacherStats`) renders six chips: `Active teachers`, `With load`, `Without load`, `Approval review`, `Over cap`, `Last sync`. Six pills in a row is a wall, especially on mobile portrait.
- `Without load` is the arithmetic inverse of `With load` — publishing both forces the reader to do the subtraction. Collapse to one chip.
- `Last sync` is housekeeping, not roster health. Move to the source chip popover or drop entirely.
- Net target for this strip: at most three chips (`Active teachers`, `With load`, `Over cap`), with `Approval review` and `Last sync` moved into Help or the source popover.
- Command header itself is good: `Review load` primary, `Create Placeholder` + `Refresh teacher roster` in More. No change needed there.

### Teaching Load (`atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx:152`)

- Visible row is compliant with the one-decision rule.
- **Over-correction:** all coverage metrics (completeness %, assigned/total pairs, Teacher X count, unassigned count) were moved *inside* the More `Settings2` dropdown's "Coverage snapshot" panel (WorkspaceToolbar.tsx:225-247). The simplification plan said metrics should render as a compact readiness strip *below* the command header. Hiding them removes the at-a-glance readiness signal a scheduler needs before opening More, and means a non-technical user has to open a menu to see whether the page is healthy.
- The More dropdown itself became an expert cockpit — it now contains: Coverage snapshot grid + `Review saved coverage`, `Open staffing audit`, `Show teacher jump list`, a View mode radio group, `Reconcile saved coverage`, a Staffing mode radio group (with description rows), and a `Global Reset` menu item with its own description. Six grouped sections behind one icon. The clutter was relocated, not removed.
- `Review saved coverage` (the split-brain/quarantine warning, WorkspaceToolbar.tsx:229) only renders inside the More coverage snapshot. An important alert is now buried two taps deep.
- Recommended split: one compact readiness strip below the header (completeness %, unassigned pairs, Teacher X count) *plus* a smaller More that keeps only true advanced tools (view mode, staffing mode, reconcile, global reset, staffing audit, jump list). Leave alert surfaces out of More.

### Cross-Cutting (AdminWorkspaceFrame More popover)

- `AdminWorkspaceFrame` (AdminWorkspace.tsx:186-214) renders the More popover with three fixed section headers — `Daily setup`, `Source data`, `Advanced tools` — and three AI-generated helper sentences:
  - "Extra setup actions stay here so the header remains calm."
  - "Use the source chip for details; sync and refresh actions appear here when available."
  - "Use filters and row menus only when the default list is too broad."
- These are visible chrome with no real content behind `Source data` and `Advanced tools` in most pages; only `Daily setup` ever holds actions. The other two headers + copy are filler that the user reads on every More open. They violate the AGENTS no-fluff rule and add reading load inside the menu that was supposed to reduce reading load on the page.
- The popover should only render a section header when that section actually has children to render, and should contain zero meta-commentary about itself.

## Root Cause

The first pass treated "move it out of the visible header" as the goal and stopped there. It did not define budgets for the *new* surfaces that absorbed the removed items:

- no cap on readiness-strip chip count;
- no cap on default-visible filter-row controls;
- no rule that global preferences (e.g., Time display) must not leak into per-page filter rows;
- no rule that the More menu must not itself become a multi-section cockpit;
- no rule that the More popover must not include self-referential filler copy;
- no rule that important alerts must not be buried inside More.

So each moved item found somewhere else to live and re-bloated. The next pass needs explicit band budgets, not just "hide it."

## Required UX Corrections

1. Define and enforce per-page readiness-strip budgets (Sections ≤2, Subjects ≤3, Teachers ≤3, Teaching Load ≤3 visible chips).
2. Collapse inverse/duplicate metrics (Teacher `With load` / `Without load`; Subject `Active` / `Archived`).
3. Remove or relocate housekeeping metrics (`Last sync`) out of the readiness strip.
4. Move `Time display` Hours/Minutes off the Subjects filter row entirely; it is a global preference.
5. Cap default-visible filter-row controls (recommend ≤3 visible Selects; collapse the rest behind the existing `More filters` toggle).
6. Restore a compact readiness strip to Teaching Load *below* the command header, and shrink the More dropdown to true advanced tools only.
7. Surface split-brain/quarantine alerts outside the More menu (e.g., as a banner or a visible `Review saved coverage` chip in the readiness strip when `showReviewBadge` is true).
8. Strip the self-referential helper copy and empty section headers from the `AdminWorkspaceFrame` More popover; render section headers only when they have children.
9. Delete the dead hidden grade-level pill block in `Sections.tsx:874`.
10. Re-consider `Add subject` visibility on Subjects: keep it inline when the list is empty, or surface as a second primary, since it is a frequent daily action on that page. Capture as an open question.
11. Extend the Playwright spec to gate readiness-strip chip count and default-visible filter control count, not just header height, so the bloat cannot silently regress again.

## Open Questions

- [ ] On Subjects, should `Add subject` stay visible alongside `Refresh offerings`, or remain in More? Plan currently says More; re-audit says inline at least when the list is empty.
- [ ] Where should `Last sync` live — source chip popover, Help dialog, or be removed entirely?
- [ ] Do we want a single global `Time display` control in settings, or is it only meaningful on Subjects and should be deleted if unused elsewhere?