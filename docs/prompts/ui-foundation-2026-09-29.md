# UI foundation: readable by default, one filter bar, nothing cut off (A7 c8 + A5 c8)

Issued by Lane C, 16:50. **Top priority until the demo.** Risk MEDIUM (shared styles touch every page).
Real staging data (`/__dev/staging-login`), 1366x768. Proof = `scripts/qa/ux-audit.js` JSON + screenshots for EVERY page
in `docs/plans/codex-walk-standard.md` Part 2, before and after. Commit and push wip every 30 min.
Codex live sweep (landing soon): `docs/reviews/codex-live-ux-sweep-e75d6b8f.md` — every MAJOR in it is in scope.

## Operator (16:40, 16:48)
"There are a lot of regressions and fixes that have been less satisfactory, especially on UX/UI. The more filters still
exist; we want filters to be shown instantly, and the filters have still been varying in how they are placed — look at
the Sections filters. Look at that overflow. There are a bunch of ellipses in dropdowns because of the contained
dropdown items. The system UX/UI isn't responsive anymore." — "UX/UI is so important for older scheduler users. Our
default text and sizes should naturally be bigger; there is still a lot of text that is too small, which fails
accessibility. Lock in."

## Measured on main (Lane C, outside tests)
`text-xs` (12px) 1,762 uses · `text-[9-12px]` 137 · `truncate` 301 · "More filters" 22 · root font 16px.

## A7 c8 — readable type scale and the gate (start now)
1. **Type tokens (Tailwind v4 `@theme` in `atlas-client/src/index.css`):** `--text-xs` → 0.875rem (14px),
   `--text-sm` → 0.9375rem (15px) with matching line-heights; body/table text 16px. Replace every `text-[9px]`,
   `text-[10px]`, `text-[11px]`, `text-[12px]` with `text-xs`. Nothing under 14px anywhere (badges, captions, grade chips,
   table headers included). Uppercase micro-labels become sentence-case 14px.
2. **Targets:** buttons, selects, tabs, chips that act ≥ 40px tall (44 on primary actions).
3. **Re-fit, don't clip:** after the scale change, walk every page; where text no longer fits, let it wrap or give the
   container room. Adding `truncate` to make it fit is forbidden.
4. **Gate** (`atlas-client` test, wired into the client suite): fails on `text-[9-12px]` in `src/` (tests excluded), on
   the text "More filters", and on `truncate` inside `@/ui/select`, `filter-picker`, `picker-trigger` and menu items.
   Re-pin the palette/size ratchet tests on purpose (name them).

## A5 c8 — one filter bar everywhere, dropdowns that fit (after A5 c7 lands)
1. **`@/ui/filter-bar`**: search (about 240px) then every filter as an inline select, one row that wraps, left-aligned,
   `gap-2`, same height as the search, no disclosure, no legend line inside the bar (a code legend goes in a tooltip
   on the Program select). Use it on Teachers, Subjects, Sections, Teaching Load (each view), Campus & Rooms, Room
   Schedules, Timetable and any other roster. Delete every "More filters" and its popover.
2. **Selects/pickers fit their text:** trigger width follows the selected label (`w-auto`, min 8rem, max 22rem), no
   ellipsis; menu content at least as wide as the trigger, items wrap instead of truncating; portalled, opens downward
   with collision padding.
3. Proof: the filter-bar table from the walk standard, all pages identical in order/height/gap/alignment.

## Both
- Fold in every MAJOR from the Codex sweep that belongs to your area; list the rest for Lane C.
- Done = the audit JSON on every Part 2 page shows 0 mojibake, 0 moreFilters, 0 overflowing, no sideways scroll, no
  text under 14px; screenshots attached; `npm run test:encoding` green.

## Addendum 18:50 — A5 c8: row menus (teachers.docx item 6)
See `docs/prompts/teachers-doc-2026-09-29.md` "A5 c8 addendum": `AdminDataTable.tsx:176` menu `w-52` wraps every row
menu's items; menus fit their longest item on one line.
