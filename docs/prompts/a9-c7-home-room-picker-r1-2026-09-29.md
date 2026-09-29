# A9 c7 R1 — correction: the popover still flips up, proven in the render

**Planner review round 1: `CORRECTION_REQUIRED` on `bc2237f0`. One BLOCKING row, from rendered evidence on real
staging data.** Task 2 (the restored row picker) is accepted as written. Task 1's mechanism is wrong.

## The measurement, so nothing here is a guess

Loopback preview `:5262` → staging API `:5101`, real staging roster (20 sections, `NEED ROOMS 19`), 1366x768, origin
asserted. Row 1 (`Aguinaldo`, trigger bottom y=352): `data-side="bottom"`, popover 356→756, height 400, no overlap —
**item 46 is fixed there.** Row 3 (`Luna`, trigger 503→539): `data-side="top"`, popover 99→499, height 400 —
**overlapping the `NEED ROOMS 19` chip, the "Give 19 sections a home room" button and "Sync sections".**
`docs/reviews/a9-c7-home-room-picker-20260929/` holds both PNGs and the numbers.

**Why the committed fix cannot work.** On the flipped row the wrapper carries
`--radix-popper-available-height: 487.48px` and the content computes `max-height: 400px`. 487px is the space available
**on the side floating-ui had already flipped to**. Radix publishes that variable as a *consequence* of the flip
decision, and the flip decision compares the content's *measured height* against the space below. With the class cap
`min(25rem, var(--radix-popover-content-available-height))` the two depend on each other: at measure time the content
is 400px against ~213px below, so it flips; after the flip the variable is large, so the cap is inert. A CSS-only cap on
that variable is circular and cannot keep the popover down. `ui/searchable-select.tsx` gets away with it because its
content is short enough that the flip never comes up.

## The fix: cap the content with a measurement taken BEFORE Radix measures it

In `SectionRoomPicker.tsx`, keep the committed `side="bottom" align="start" sideOffset={4} collisionPadding={12}` and
keep the committed class string **byte-for-byte unchanged** (`… flex flex-col overflow-hidden
max-h-[min(25rem,var(--radix-popover-content-available-height))]`) — it is the fallback ceiling wherever no
measurement is available (jsdom), which is why **none of the three corrected height suites change**. Add:

1. A ref on the existing trigger `Button`.
2. On open (in the `onOpenChange` handler, before `setOpen(true)` commits — React applies the new DOM attributes and
   inline styles in the mutation phase, which runs **before** floating-ui's positioning layout effect, so `flip` sees
   an already-capped content and leaves it on `bottom`):
   - read the trigger rect and `window.innerHeight`;
   - if the space below is under a usable minimum (`MIN_USABLE_POPOVER_PX = 192`), `scrollIntoView({ block: 'center',
     behavior: 'auto' })` the trigger **first**, then re-read the rect — a row at the very bottom gets a popover you
     can use instead of a 40px strip, and the scroll happens before the popover mounts, so there is no flicker;
   - store `Math.min(POPOVER_MAX_PX /* 400 */, Math.max(0, innerHeight - rect.bottom - SIDE_OFFSET_PX - COLLISION_PADDING_PX - SAFETY_PX /* 4 */))`.
3. Apply it as `style={{ maxHeight: openMaxHeight ?? undefined }}` on the `PopoverContent`. The inline value wins over
   the class, so the class stays as the no-measurement fallback.
4. Re-measure on `resize` and on `scroll` **while the popover is open**, and remove both listeners when it closes.
   Without this a stale number survives a window resize and the popover can hang off the bottom. A scroll listener that
   recomputes the same number is cheap and harmless.
5. Export the named constants so a test and a reviewer can read the arithmetic rather than re-derive it, and comment
   **why** the CSS variable alone is circular — the measured values above — so this is not "simplified" back later.

Do **not** reach for `avoidCollisions={false}`: it also disables `shift`, so the picker would run off the right edge on
a narrow window, and it removes the edge padding. Do not shorten the 400px ceiling for a tall row; row 1's 400px list
is correct.

## The row must still open down near the bottom of the list

The last visible row is the hard case. With the cap it shrinks and its list scrolls internally — that is the intent
(§8: the list scrolls, the page never does). Prove it in the test below and in the planner's render.

## Test — one new row that discriminates, in `a3-room-picker-rows-01-02.test.tsx`

That file already stubs layout (`stubNaturalWidth`, pointerdown-to-open). Add one test:

- stub the trigger's `getBoundingClientRect` (e.g. bottom 600) and `window.innerHeight` (768), open the popover, and
  assert the content carries an inline `max-height` **strictly below the 400px ceiling** and **not above the space
  below** (768 − 600 − 4 − 12 − 4).
- **Failing-first is mandatory and must be shown in the handoff:** with the inline cap removed the assertion fails
  (the content has no inline `max-height`), which is the recorded shape of the defect.
- Assert the committed class string is still present (the fallback), so nobody removes it as dead code.

Do not add or change anything else. `a3-c4-sections-surface.test.tsx` and
`a3-c10-room-picker-anchor-width-names.test.tsx` are accepted exactly as committed.

## Gates

```
npm run typecheck
npm run test:a3-c4-sections
npm run test:a3-sections-map
npm run test:a3-truthful-numbers
npm run test:a9-c3-sections-rooms
```

Same expected result as round 1 (two pre-existing red rows outside this packet's paths, reported with their names, not
edited). Commit additively on `work/a9-c7-home-room-picker` and push. No amend, no rebase — the rendered defect and its
correction must both stay in the range. Do not touch `SectionRow.tsx`, `Sections.tsx` or the four props: they are
accepted.
