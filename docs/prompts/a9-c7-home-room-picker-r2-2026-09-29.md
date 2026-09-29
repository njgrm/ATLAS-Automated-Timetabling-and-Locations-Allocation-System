# A9 c7 R2 — correction: opening the picker throws you back to the top of the list

**Planner review round 2: `CORRECTION_REQUIRED` on `cb9d218e`. One BLOCKING row, again from the render.** R1's fix is
**accepted** — item 46 is now genuinely fixed on every proof row (see the measurements below). This is the last
correction round; whatever survives it ships, with anything still open recorded as a follow-up row.

## What R1 fixed (measured on real staging data, preview `:5262` → staging API `:5101`, origin asserted)

| Row | Viewport | `data-side` | Popover | Inline cap | Header / toolbar / Sync covered |
|---|---|---|---|---|---|
| 1 `Aguinaldo` | 1366x768 | `bottom` | 356→756, 400px | — | no |
| 3 `Luna` | 1366x768 | `bottom` | 543→752, 209px | `209px` | no |
| last visible `Maka-Diyos` | 1366x768 | `bottom` | 504→752, 248px | `248px` | no |
| 1 | 1366x650 | `bottom` | 356→634, 278px | `278px` | no |
| last visible | 1366x650 | `bottom` | 445→634, 189px | `189px` | no |

Row height across an assignment: `Luna` **83px before, 83px after** assigning `Music Room`, status line
`Music Room · MAPEH and Wellness Hub`. Stable, as the packet required.

## The new BLOCKING row: the list jumps to the top on every open

`SectionRoomPicker.tsx`, the open effect (~line 325):

```js
setTimeout(() => {
  if (activeItemRef.current) activeItemRef.current.scrollIntoView({ behavior: 'auto', block: 'center' });
  else if (inputRef.current) inputRef.current.focus();
}, 50);
```

Measured, same preview, list scrolled to `scrollTop = 400` by hand, then one click on a row's picker:

- row 2 (`Bonifacio`, **unassigned** → the `focus()` path): list `scrollTop` **400 → 0**.
- row 1 (`Aguinaldo`, **assigned** → the `scrollIntoView` path): list `scrollTop` **400 → 0**.

So both branches move the page. `focus()` without `preventScroll` and `Element.scrollIntoView` both walk **every**
scrollable ancestor, and the popover is portalled into `document.body` — the browser still scrolls the sections list
to "reveal" it. The operator clicks row 17, the list jumps to row 1, and the row they were working on leaves the
screen. That is the opposite of "no flicker", and it is why the packet asked for the render to be taken.

**Why it is in this packet's scope even though the code is old:** the effect is pre-existing, but A9 c3 removed this
control from the table, so it was unreachable here; the binding 15:55 addendum put it back and this is the first time
`/sections` can hit it. It has always been reachable on the mobile card and in the guided dialog. Fix it once, in the
primitive, and all three surfaces are correct.

## The fix — confine the scroll to the picker's own list

1. `inputRef.current.focus({ preventScroll: true })`. The input is inside the popover that Radix just positioned;
   there is nothing to reveal, and `preventScroll` stops the ancestor walk. Do not remove the focus — Phase 1.4 made
   the search box the first focus target on open and that is load-bearing for keyboard users.
2. Replace `activeItemRef.current.scrollIntoView(...)` with a scroll **of the picker's own scroll root only**:
   find the ancestor `[data-radix-scroll-area-viewport]` (the single scroll region the row-01 control already asserts
   exists), measure its rect against the active option's rect, and add the delta to that viewport's `scrollTop` when
   the option is out of view. Same user-visible result — the current room comes into view inside the list — with no
   ancestor scrolling. Keep `block: 'center'` semantics by centring within the viewport.
3. Do **not** touch the R1 centring `scrollIntoView({ block: 'center' })` on the trigger. That one is deliberate, it
   fires only when the space below is under 192px, it runs before the popover mounts, and the render confirms it
   gives a usable 248px popover on the last visible row.

## Test — one new row in `a3-room-picker-rows-01-02.test.tsx`, failing-first shown

Stub `Element.prototype.scrollIntoView` to record every element it is called on, and stub the search input's `focus`
to record its argument. After opening the picker, assert:

- **no recorded `scrollIntoView` target is outside the picker body** (in particular, never the row's trigger);
- the focus call carried `preventScroll: true`;
- for an **assigned** value, the active option is brought into view by the scroll root's `scrollTop`, not by an
  ancestor move.

Failing-first is mandatory: with `preventScroll` removed, or with the `scrollIntoView` branch restored, one of those
assertions must fail. Report both mutants in the handoff.

Nothing else changes. `SectionRow.tsx`, `Sections.tsx`, `a3-c4-sections-surface.test.tsx` and
`a3-c10-room-picker-anchor-width-names.test.tsx` stay exactly as committed; the committed `className` string stays
byte-for-byte.

## Gates

```
npm run typecheck
npm run test:a3-c4-sections
npm run test:a3-sections-map
npm run test:a3-truthful-numbers
npm run test:a9-c3-sections-rooms
```

Same expected result as before (the two named pre-existing red rows outside this packet, reported not edited). Commit
additively, push, no amend/rebase.
