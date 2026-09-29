pages 11 · defects: MAJOR 5 MINOR 5 · More-filters present on: /sections, /subjects, /teachers · truncation spots 2 · encoding hits 0 · viewport 1366x768

Scope: authenticated `Your Brave` only; each route asserted `window.location.origin === https://njgrm.buru-degree.ts.net`. Read-only navigation and UI opening only. Screenshot references below identify the live capture frames reviewed during the sweep; the browser bridge exposes them to the audit stream but cannot write their PNG bytes into `./shots`.

## Filter bars compared

| Page | controls, in displayed order | search width | control height | gap/alignment | help/legend below |
|---|---|---:|---:|---|---|
| /sections | Search sections...; **More filters** → Grade: All, Program: All, Home room: All | 384px | 32px | left; two controls before disclosure | Program-codes legend appears only after opening |
| /subjects | Search name or code...; Grade: All; Program: All; **More filters** | 240px | 36px | left; uneven 8–10px gaps | none |
| /teachers | Search teacher, department, or specialization...; **More filters** → additional filters | 384px | 32px | left; disclosure separated from attention chips | none |
| /teaching-load (Teachers) | Search teachers; Status: All; Department: All; Load: All; Sort: Load, low; Cross-subject; No subject match | 240px | 36px | left; switches are a second visual row | no |
| /faculty/concerns | Search a teacher by name… | 320px | 32px | left, isolated below header | no |
| /timetable | Term; Show; Schedule for | n/a | 36px | top row after tabs; unlike all lists | Available terms line below |

## Per-page findings

### / — Dashboard

- MINOR — Sidebar school name, `ATLAS ENRIQUETA MON…`; the fixed 239px brand control truncates the institution name at desktop width. Evidence: `dashboard-1366.png`. Fix: give the brand a two-line, non-ellipsized treatment or a wider rail.

### /admin/year-setup

- MINOR — Sidebar school name has the same visible truncation. Evidence: `year-setup-1366.png`. Fix: use the shared corrected brand header.

### /sections

- MAJOR — Filter bar: `Search sections...` then **`More filters`**; Grade, Program, and Home room are hidden until the disclosure is clicked. The audit expanded it and confirmed `Grade: All`, `Program: All`, `Home room: All` plus the program-codes legend. Evidence: `sections-filters-closed.png`, `sections-filters-open.png`. Fix: render all three selects inline in the standard FilterBar.
- MINOR — This bar is 32px high with a 384px search, whereas Subjects is 36px/240px; it looks like a different product. Evidence: `sections-filters-closed.png`. Fix: use shared size tokens.
- MINOR — One huge scrollable data region has a sticky paginator and a separate page scrollbar; rows are visually compressed and 32px icon-only actions carry the row workflow. Evidence: `sections-table-1366.png`. Fix: use a single predictable table scroll model and labelled row actions on hover/focus.

### /subjects

- MAJOR — `More filters` remains after inline `Grade: All` and `Program: All`; further filtering is concealed, contrary to instant inline filters. Evidence: `subjects-1366.png`. Fix: show every filter inline, wrapping only below the row if necessary.
- MINOR — Search is 240px while Sections/Teachers use 384px, despite the same list-page role. Evidence: `subjects-1366.png`. Fix: standardize FilterBar search width.

### /teachers

- MAJOR — `Search teacher, department, or specialization...` followed by **`More filters`** conceals filter choices. Evidence: `teachers-1366.png`. Fix: replace disclosure with inline selects/chips.
- MINOR — The first-row Profile dialog exposes both `CLOSE PROFILE` and a separate `Close` control, duplicating the exit action; its long all-caps sections (`CURRENT WEEKLY HOURS`, `ASSIGNED SUBJECTS AND SECTIONS`) are visually heavier than the row UI. Evidence: `teachers-profile-first-row.png`. Fix: keep one labelled footer/close control and use normal section heading case.

### /teaching-load and /teaching-load/history

- MAJOR — Teaching Load uses a wholly different, denser filter composition: five inline fields/switches across two visual rows (`Search teachers`, `Status`, `Department`, `Load`, `Sort`, Cross-subject, No subject match), while peer lists hide controls behind More filters. Evidence: `teaching-load-teachers-1366.png`. Fix: adopt one shared FilterBar contract everywhere.
- MINOR — Archived view select `Archived year: 2029-2030` is only 128px and has a 186px scroll width; its displayed value truncates with an ellipsis. Evidence: `teaching-load-history-1366.png`. Fix: set a content-safe select min-width (or allow full text).

### /faculty/concerns

- MINOR — The only filter is visually isolated far below the header and uses `Search a teacher by name…`, not the shared search wording/geometry. Evidence: `faculty-concerns-1366.png`. Fix: place it in the common FilterBar below the page title/status strip.

### /map (overview and editor)

- PASS — No filter bar, encoding defect, visible text overflow, or horizontal page scrollbar observed. Overview’s map tabs and editor’s tool strip are intentionally page-specific. Evidence: `map-overview-1366.png`, `map-editor-1366.png`.

### /room-schedules

- PASS — No More filters, garbled characters, overflow, or clipping observed in the initial Rooms view. The very wide `Choose a room` select is content-safe at this viewport. Evidence: `room-schedules-1366.png`.

### /timetable

- MINOR — Schedule controls (`Term`, `Show`, `Schedule for`) live in a separate tabbed top strip rather than the list-page FilterBar, adding another control language. Evidence: `timetable-1366.png`. Fix: retain timetable-specific tabs but apply the common select height, label placement, and spacing tokens.

## System fixes

1. Ship one `FilterBar` component: fixed order, 36px controls, content-safe search widths, 8px gaps, left alignment, and optional below-row legend.
2. Remove every `More filters` disclosure on desktop; allow inline wrap before concealment.
3. Replace the fixed-width truncated sidebar brand with a two-line responsive brand block.
4. Establish one select minimum width based on longest active label; never ellipsize selected values.
5. Use one table scroll/pagination pattern; do not combine compressed viewport rows with competing vertical scroll regions.
6. Standardize page-header actions, chips, select heights, and table-header typography across setup, roster, and load pages.
7. Define one modal primitive with one close affordance, stable footer, max-height, and scrollable body.
8. Add visual regression coverage at 1366x768 for filter-bar geometry, overflow, ellipsis, and mojibake regexes.

## Lane C second check (16:55)
Under-reported, which is itself a finding: it shows "encoding hits 0" but the operator's screenshot of Teachers >
Review load shows "Not a problem ΓÇö this teacher…" (fixed on main `76c969d8`; the sweep did not open Review load);
it did not measure text size (1,762 `text-xs` = 12px uses on main); its screenshots could not be saved. Hence
`scripts/qa/ux-audit.js` (measured, not eyeballed) and `docs/plans/codex-walk-standard.md` for every future walk.
Also missed by it but in the operator's Sections screenshot: "Home room: Home room assigned" spills outside its select;
the three selects are spread across the full width with large gaps.
