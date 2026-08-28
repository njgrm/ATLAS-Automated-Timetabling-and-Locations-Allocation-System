# Prompt 10C: Timetable KISS Regression Cleanup

## Context

You improved the timetable header and dock in earlier passes, but the latest changes regressed some KISS objectives.

Missed items:

- `Workflow` and `Class Program Matrix` labels are visible again.
- `Auto-Place Displaced Sessions?` and `Auto-Place Sessions` sound technical and tool-driven.
- Header/view controls are still concept-heavy for schedulers.

## Mission

Restore the simplified scheduler-first timetable UX.

## Required Changes

### 1. Replace Primary Labels

Replace:

- `Workflow` -> `Schedule review`
- `Class Program Matrix` -> `Grid view`
- `Auto-Place Displaced Sessions?` -> `Place available sessions?`
- `Auto-Place Sessions` -> `Review placements`

Avoid `algorithm` in primary copy.

### 2. Header Rules

The always-visible command row should stay limited to:

- run selector
- `Refresh schedule`
- eligible `Publish`
- `More`
- compact status stats

Move setup sync, placement, history, map, policy, and explanations under `More` or a collapsible secondary strip.

### 3. Needs Attention Rail

- Use plain group labels.
- Avoid raw violation codes as primary copy.
- Keep rows scannable for an older scheduler user.

### 4. Quick Place Modal

Show plain summary:

- `Can place`
- `Still blocked`
- teacher
- section
- room
- time

Hide technical metadata by default.

## Static Checks

- No primary visible labels:
  - `Workflow`
  - `Class Program Matrix`
  - `Auto-Place`
  - `algorithm`
- No native `<button>`, `<select>`, `<details>`, or raw DOM `title=` in touched timetable files.
- Touched React component files under 1000 lines.

## Browser QA

Use Playwright:

- URL: `https://njgrm.buru-degree.ts.net`
- Admin: `1000001` / `AdminSY2026!`
- Route: `/timetable`

Check:

- desktop `1440x900`
- narrow `900x900`
- mobile `390x844`
- no horizontal overflow
- header is understandable without reading docs
- `Refresh schedule` is visible/discoverable

## Verification

Run:

- `npm --prefix atlas-client run build`

## Required Output

Return:

- files changed
- old-label scan result
- browser evidence
- build result
- prompt-scope `GO` or `NO-GO`

