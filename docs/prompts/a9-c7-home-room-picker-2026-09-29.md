# A9 c7 — the Sections row picks its own home room, and it opens downward

Lane C packet `docs/prompts/fix-3-2026-09-29.md`, item **46** + the **15:55 addendum (binding)**.
Base `fa57114c` (`origin/main` tip, after A9 c6 landed at `91328502`). Branch `work/a9-c7-home-room-picker`.
Worktree `E:/ATLAS-worktrees/lane-a9-c7-home-room`. Risk **LOW-MEDIUM, client only** — no server, no route, no schema.

## The user and the task

An older, mouse-first scheduler is on `/sections` with a roster that needs home rooms. Two things are true today and
both are wrong for her:

1. **Item 46 — the picker flips up over the header.** `SectionRoomPicker` renders in a table cell with a fixed
   `h-100` (400 px) body and Radix's default collision handling, so a row near the top of the list has its popover
   push UP, over the sticky toolbar and the Auto-assign / Sync buttons.
2. **Addendum 15:55 (binding) — the row picker was removed and must come back.** A9 c3 (`86665f48`) replaced every
   inline picker with plain text. Rows now read "Needs a home room" as **text**, and the operator reported item 46
   *against that control* — she uses the row picker, and manual assignment is the demo priority. The guided bulk step
   stays the primary action; it is not a replacement for the row control.

What it should feel like: one obviously pressable control per row that tells her the current room, opens a short list
**underneath itself**, and never hides the header or the buttons she needs next.

## Non-negotiable rules

- **Clickable must look clickable.** An outlined, full-cell-width `@/ui` `Button` with a visible label and a chevron.
  No bare glyph, no `title`, no raw `<select>`/`<details>` (AGENTS.md §8).
- **Never write in `D:\ATLAS`.** Work only in `E:/ATLAS-worktrees/lane-a9-c7-home-room`.
- Commit a `wip(...)` checkpoint at least every 30 minutes and before any long step; push the branch.
- Shell calls are force-killed at 20 min. Anything that can exceed 10 min goes out through
  `scripts/dev/start-detached.ps1 -Dir -Command -Log`; poll the log with short calls.
- Commit only your assigned paths. Conventional commit message, no agent/model/vendor in the branch name.
- Do **not** run `npm run build` (blocked by design on the repo's `VITE_ENROLLPRO_URL` guard; A4 owns it).

## Task 1 — item 46: the popover opens downward and shrinks instead of flipping

`atlas-client/src/components/sections/SectionRoomPicker.tsx`, the `PopoverContent` (~line 383):

- `side="bottom"`, `align="start"`, `sideOffset={4}`, `collisionPadding={12}`.
- Replace the fixed `h-100` with
  `max-h-[min(25rem,var(--radix-popover-content-available-height))]` so the body shrinks to the space below instead of
  flipping over the header. Keep `flex flex-col` and add `overflow-hidden` to the body.
- `ui/searchable-select.tsx:321` already uses `--radix-popover-content-available-height` — **copy that pattern**, do
  not invent a second one.
- The measured-width machinery, the single `ScrollArea`, the header/footer `shrink-0` rows and the uniform option row
  height are load-bearing (three suites assert them). Change nothing else in this component.
- One primitive, three surfaces (desktop row, mobile card, guided dialog) — this fix lands on all three by
  construction, which is the point of §8 "one look per control".

## Task 2 — addendum 15:55: one clearly shaped button per row

`atlas-client/src/components/sections/SectionRow.tsx`, the Home room cell (lines 175-220), plus
`atlas-client/src/pages/Sections.tsx` line ~918.

- **Copy what works:** `SectionMobileCard.tsx:88-104` already renders exactly this shape on mobile — the picker in a
  `space-y-1.5` block with ONE status line under it. The desktop row becomes that, minus the card's extra chrome.
- Restore the four props on `SectionRow` and pass them from `Sections.tsx`: `schoolId={scopedSchoolId}`,
  `roomOccupancy={roomOccupancyMap}`, `isSaving={savingMirrorId === s.id}`,
  `onHomeRoomChange={handleHomeRoomChange}`. All four already exist in the page (`Sections.tsx:143/429/123/453`).
- **Trigger label — copy the mobile card and the existing primitive.** Empty → `Choose home room`; set →
  `{room.name} - {buildingName}`, in the shared trigger that already carries `variant="outline"` and the
  `ChevronsUpDown` chevron. The addendum's `"… ›"` is that chevron: keep the icon, do NOT add a literal `›` glyph to
  the label, and do not add a second chevron shape. `SectionRoomPicker` is one primitive used by three surfaces;
  changing its trigger changes all of them at once.
- **Stable row height.** The status line under the button must never change the row's height when a room is assigned:
  a `flex h-4 items-center gap-1.5` row with a `truncate`d `span`, one line, always. Keep the A9 c3 wording the C4
  suites already assert — unresolved `Needs a home room`, resolved `{room.name} · {buildingName}` — and keep the
  existing `Home` / `AlertTriangle` cue icons. Do not reintroduce the pre-A9-c3 "Needs home room. Choose a room." /
  "Ready: …" sentences, and do not add a read-only sentence (a C4 row asserts the row does not carry one).
- **Honest ledger.** The 40-line comment block at `SectionRow.tsx:176-209` argues at length that the picker must not
  come back. That decision has been overruled by the operator and Lane C. Rewrite it to state what is true now: the
  row picker was removed in A9 c3 and restored on Lane C's binding addendum of 2026-09-29 15:55, the guided bulk step
  remains the primary action, and no write path was added or removed. Cite the date and the packet. Leave no stale
  claim that "the row no longer renders a picker" in `Sections.tsx:915-917`.
- Do not rename files, routes, APIs, or anything else on this page. `Sections.tsx` is 927 lines against a 1000-line
  cap — add nothing beyond the four props.

## Task 3 — tests, corrected additively (never delete an assertion)

- `src/components/sections/__tests__/a3-c4-sections-surface.test.tsx` (~lines 306-333): the assertion
  `el.querySelectorAll('[role="combobox"]').length === 0` ('the row still renders a home-room picker; the guided step
  owns that control now') now contradicts the binding addendum. **Keep its text quoted as superseded** with the date
  and the reason, then assert the replacement: the row renders **exactly one** combobox, it is the picker trigger, and
  the row's map control still does not fire a home-room change. Add a row asserting the restored control reaches
  `onHomeRoomChange` (open the popover, click a room option, count the call) if it can be done honestly in the existing
  jsdom harness — `a3-room-picker-rows-01-02.test.tsx` already opens the popover with a `pointerdown` event; copy that.
- `src/components/sections/__tests__/a3-c10-room-picker-anchor-width-names.test.tsx:582`: the
  `assert.match(className, /\bh-100\b/, 'the bounded h-100 body must be retained')` row. Quote it as superseded
  (with the FIX-03 reason it recorded) and add the replacement: the cap is
  `max-h-[min(25rem,var(--radix-popover-content-available-height))]`, no fixed `h-` token remains, and the list still
  scrolls instead of the page. Every other row in that file stays exactly as it is.
- `src/components/sections/__tests__/a3-room-picker-rows-01-02.test.tsx` ("row 01 control"): it derives the body's
  height from `/\bh-(\d+)\b/` and requires `bodyHeightPx <= viewport height`. Re-derive from the new cap (25 rem =
  400 px, still fits 1366x768 and 390x844) and **keep every other assertion in that row** — `flex`, `flex-col`,
  `shrink-0` header/footer, exactly one `[data-radix-scroll-area-viewport]` inside the body, `overflow-hidden` +
  `flex-1` on the scroll root, the fixture genuinely overflowing, and no document-level scrollbar.
- Nothing else. If a suite you did not expect fails, stop and report it with the row; do not edit it to be green.

## Gates to run and record (literal commands)

```
npm run typecheck
npm run test:a3-c4-sections
npm run test:a3-sections-map
npm run test:a3-truthful-numbers
npm run test:a9-c3-sections-rooms
```

All five green, or a failing row reported with its name and the commit that caused it.

## Rendered proof — the planner's row, but you own the fixture

Do not spend this cycle on the browser. The planner takes the renders on real staging data through
`/__dev/staging-login` at 1366x768 and 1366x650. What the source must make possible, and what QA will check against
the render:

- rows 1, 2 and the last visible row, assigned and unassigned, all open **downward**;
- the popover never covers the page header or the Auto-assign / Sync buttons;
- no flicker on open — the popover does not resize the row or jump sides;
- the row's height is identical before and after an assignment.

## Deliverable

One `REVIEW_REQUIRED` commit range `fa57114c..<tip>` on `work/a9-c7-home-room-picker`, pushed, with a handoff of
base · candidate · exact paths · what changed and why · the literal gate commands and their tallies · risks marked
`BLOCKING` / `NON_BLOCKING`. One page.
