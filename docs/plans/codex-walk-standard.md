# Codex walk standard (Lane C) — every staging walk and every live check

Adopted 2026-09-29 16:50 after the operator's team found regressions that earlier walks passed: garbled "ΓÇö",
leftover "More filters", filter bars laid out differently per page, text overflowing its box, "…" in dropdowns, text too
small for older schedulers. Earlier walks only checked the train's own rows; this standard makes every walk also a
whole-app sweep, measured, not eyeballed.

## Fixed setup
- @Brave 'Your Brave' only; assert `window.location.origin` on every page; never type credentials.
- **Viewport 1366x768.** Set it (window resize / device emulation). Record `innerWidth x innerHeight` per page; if it
  is not 1366x768 the walk says so in line 1 and repeats the sweep at 1366 via emulation before any verdict.
- Staging walks may save only where the prompt allows; live walks are read-only unless the operator approved a write.

## Part 1 — the train's own rows
The rows named in the prompt, PASS/FAIL with exact on-screen words.

## Part 2 — the whole-app sweep (always, every page)
Pages: `/`, `/admin/year-setup`, `/sections`, `/subjects`, `/teachers`, `/teaching-load` (each view), `/teaching-load/history`,
`/faculty/concerns` (or its new name), `/map` (overview and editor), `/room-schedules`, `/timetable`.
On each page:
1. Run `scripts/qa/ux-audit.js` (paste its contents into the page's JS context) and keep the JSON.
2. Open every filter dropdown, the first row's dialogs, and the header's dialogs; run the audit again with each open;
   scroll each dialog to the bottom.
3. Screenshot the page and each dialog (`shots/<page>-<state>.png`).
4. Judge by eye what the script cannot: consistency with the other pages, clickable-looks-clickable, clutter, word count.

**Filter bars compared** (one table, all pages): order of controls, search width, control height, font size, gaps,
alignment, any disclosure ("More filters" must not exist), legend lines.

## Verdict rules (Lane C does not overrule these)
- **MAJOR = NO_GO**: any `mojibake`, any `moreFilters`, any `overflowing`, `pageScrollsSideways`, text under 12px,
  a dialog footer covering content, a control cut off, a clickable that looks like plain text on a primary path, a page
  worse than the live build.
- **MINOR** (listed, owner named, not blocking): text 12-13px, isolated `truncated` items with a tooltip, targets 32-39px.
- Line 1: `pass x/y · MAJOR n · MINOR n · viewport WxH · verdict GO|NO_GO`.

## Report
Line 1; the train rows; the filter-bar table; per page: MAJOR/MINOR with element, exact words, screenshot, one-line fix,
and the audit summary numbers; "System fixes" (shared-component changes that fix the most at once).
