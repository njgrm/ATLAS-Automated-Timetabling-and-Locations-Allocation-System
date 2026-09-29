# A9 c7 R3 — correction: the room list stopped scrolling when the fixed height became a cap

**Planner review round 3: `CORRECTION_REQUIRED` on `c0724e64`. One BLOCKING row, a regression this packet's own R1
introduced.** This is the last correction round; it ships after, whatever the render says.

## R2's premise was my measurement, not the product — recorded, not hidden

I reported "one click sends the list from `scrollTop = 400` back to 0". Controlled re-measurement on the same build
says otherwise: `Playwright`'s `locator.click()` runs `scrollIntoViewIfNeeded` first, and the rows I clicked were
partially cut off at the top of the panel (trigger at y −13…91). With the row **fully visible** — list at
`scrollTop = 400`, trigger at 301…337, a normal click — **`scrollTop` stays 400**. No product jump. The R2 change
(`preventScroll: true`, the scroll confined to the picker's own viewport) is harmless and defensible on its own terms;
it is **not** proven necessary. Keep it, do not extend it, and do not cite it as a fixed defect.

## The real defect: 79 rooms, ~2 reachable, no scrollbar

Measured on the open picker, real staging data, preview `:5262` (79 options, 78 staging rooms):

```
popover body        400px   (or 248px / 209px on lower rows — the cap works)
ScrollArea root     160px   (clips)
scroll viewport     clientHeight 5448  scrollHeight 5448  scrollTop 0   overflow-y: scroll
```

`clientHeight === scrollHeight` is the whole story: the viewport is as tall as all 79 options, so it has nothing to
scroll, and the root's `overflow-hidden` simply cuts it off at the footer. The operator sees "Unassigned" and one or
two rooms and **cannot reach the other 76** except by typing in the search box.

**This is a regression from R1, and it is my instruction.** The body went from `h-100` (a **height**) to
`max-h-[min(25rem,var(…))]` (a **maximum**). With a definite height the flex column resolves `flex-1` on the ScrollArea
root against a known size, the viewport collapses to the space that is actually there, and it scrolls. With only a
maximum, the container's height is indefinite for its children, the root takes its content height, the viewport never
shrinks and never scrolls. Same page, same build, one experiment: setting `height: 400px` on the open popover inline
dropped the viewport from `clientHeight 5448` to `160` and it accepted `scrollTop = 500`.

The row-01 control asserted "exactly one scroll region exists inside the body" and "the root clips". It never asserted
that the viewport is SMALLER than its content — which is the one property that distinguishes a scrolling list from a
clipped one. That gap is why R1's change passed every suite.

## The fix

In `SectionRoomPicker.tsx`, where R1 applies the measured number:

```js
style={{ maxHeight: openMaxHeight ?? undefined }}
```

make the cap **definite**:

```js
style={{ height: openMaxHeight ?? undefined, maxHeight: openMaxHeight ?? undefined }}
```

Keep the committed class string byte-for-byte — it is still the no-measurement (jsdom, first paint) fallback and still
caps the body when nothing is measured. With a definite height the top rows keep the same 400px list they have always
had, and a low row gets its measured 248px with the list scrolling inside it. Nothing else changes: same `side`,
`align`, `sideOffset`, `collisionPadding`, same 400px ceiling, same R1 trigger centring, same R2 focus and reveal.

Comment the mechanism with the measured numbers above and the one-line experiment, so the `height` is never "simplified"
back to a `max-height`.

## Test — two rows added to `a3-room-picker-rows-01-02.test.tsx`, failing-first shown

1. The existing row-01 control gains the assertion it was missing, stated in terms a real browser would show: **the
   scroll viewport must be smaller than its scroll height** — `vp.clientHeight < vp.scrollHeight` — i.e. the list
   scrolls inside the picker. With the definite height removed this is `5448 === 5448` and it fails.
2. A new row asserting the popover body carries a **definite** inline `height` equal to the measured cap when one was
   measured, and that it is not merely a `max-height`.

Both mutants — `height` removed, `height` reverted to `max-height` only — must be reported with their failing output.

Do not edit anything else. `SectionRow.tsx`, `Sections.tsx`, `a3-c4-sections-surface.test.tsx`,
`a3-c10-room-picker-anchor-width-names.test.tsx` and the committed `className` string stay exactly as they are.

## Gates

```
npm run typecheck
npm run test:a3-c4-sections
npm run test:a3-sections-map
npm run test:a3-truthful-numbers
npm run test:a9-c3-sections-rooms
```

Same two known pre-existing red rows, reported by name, not edited. Commit additively, push, no amend/rebase, no
`npm run build`, no server or browser (I hold the preview on `:5262`).
