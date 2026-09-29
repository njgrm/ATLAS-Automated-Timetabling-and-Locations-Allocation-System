# A9 c7 R5 — micro-correction: `w-[200px]` did not constrain the column

**My measurement on `68c5d929`, real staging data, preview `:5262`, nothing clicked inside the picker.**

**F3 is FIXED.** Bottom-most row `Silver` (row 20, list at its maximum scroll 1511, trigger bottom 662, viewport 768):
inline `height: 192px`, popover `clientHeight 104 < scrollHeight 5448`, **2 rooms on screen**, scrollable, clears the
header and `Sync sections`. Note and disclose: that row now opens **`side="top"`** — with only 86px below it, the
192px floor is what keeps it non-empty, and it covers nothing. That is the trade the R4 packet asked for.

**F4 is NOT fixed.** At 1366x768 and at 1280x720, after the `w-[200px] min-w-0` on both the `<th>` and the `<td>`:

```
1366x768 : table scrollWidth 1105, panel clientWidth 1070  → 35px overflow, kebab right 1365 vs panel right 1346
1280x720 : table scrollWidth 1105, panel clientWidth  984  → 121px overflow, kebab right 1365 vs panel right 1260
```

The row's **"More actions"** button is still outside the visible panel on every row, at both widths.

**Why:** in an auto-layout table `w-[200px]` is a *hint*. The cell still lays out at its content's intrinsic width,
and the shared trigger's intrinsic width is what QA measured as demanding 35px more than the panel had. QA's own
experiment is the proof of what a hard constraint does: hiding the picker buttons gave exactly 1070, and **capping
them at 180px also removed the overflow**. A width is not a cap.

## The fix — a real cap, on the cell, with the primitive untouched

- `SectionRow.tsx`'s Home room `<td>`: keep `w-[200px] min-w-0` and **add a hard `max-w-[200px]`**.
- The trigger inside it must actually be able to shrink: give the `<td>`'s wrapper (or the picker trigger's own flex
  line) `min-w-0`, and confirm the label span truncates with an ellipsis rather than pushing the column. The
  primitive's own `truncate` already exists — prove it is reached at this width instead of assuming it.
- **Do not add a width, cap or `className` override inside `SectionRoomPicker.tsx`.** One look per control (§8): the
  same component must look and behave the same on the mobile card and in the guided dialog. The constraint belongs
  to the one table column that is too narrow for it.
- If a 200px cap still leaves the table over the panel — because another column is also demanding width — say so with
  the measurement and **stop**. Do not shave another column on a guess; that is a different lane's decision.

## Acceptance — DOM numbers, which are mine to take but yours to make possible

At **1366x768 and 1280x720**, with the page at rest: table `scrollWidth` ≤ its panel's `clientWidth`; the `DETAILS`
header renders its full text with no ellipsis; the "More actions" button's right edge ≤ the panel's right edge. State
the source-level conditions you changed and what each one does; do not claim the DOM numbers.

Add one test row asserting the `<td>` carries a **hard** `max-w-[…px]` equal to the header's width, beside the
existing equality row, with failing-first shown for removing it.

## Scope, gates, and the boundary

`SectionRow.tsx` (cell width/cap only) and `a3-room-picker-rows-01-02.test.tsx` only. `SectionRoomPicker.tsx`,
`Sections.tsx` and the two other test files stay exactly as committed. No `npm run build`. No preview, no browser, no
staging write — I hold `:5262`, PID 2620. No amend/rebase/force-push; commit additively and push.

```
npm run typecheck
npm run test:a3-c4-sections
npm run test:a3-sections-map
npm run test:a3-truthful-numbers
npm run test:a9-c3-sections-rooms
```

Same two known pre-existing red rows, reported not edited. **This ships after this round, unconditionally** — F4 goes
into the handoff as an open follow-up row either way.
