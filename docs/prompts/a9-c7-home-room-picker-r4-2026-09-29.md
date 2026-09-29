# A9 c7 R4 — final bounded correction: the bottom row shows no rooms, and the table overflows its panel

**Independent QA `CORRECTION_REQUIRED` on `ab7ef587`: 6/8 rows passed, blocked 0, unperformed 0, rows 6 and 8 FAIL,
two BLOCKING findings (F3, F4) plus two false statements in shipped comments (F1, F2).**

This is the **last** round for this candidate. It ships after, with anything still open recorded as a follow-up row.
I am exceeding the nominal two rounds because both findings are (a) introduced by this candidate, (b) on the packet's
own proof rows, and (c) mechanical. The honest reason my earlier rounds missed them is recorded in the last section:
**my evidence file mislabelled two mid-panel rows as "the last visible row"**, so the bottom of the list was never
rendered.

## F3 (BLOCKING) — the bottom-most row's popover has a 0px room list

QA's read-only reproduction, 1366x768, real staging data, list scrolled to its end (`scrollTop 1511`), row 20
`Silver`, trigger bottom **662**:

```
popoverMaxHeightPx(662, 768) = 86   → inline height: 86px, side=bottom, popover 666→752
scroll viewport clientHeight = 0     scrollHeight 5448
```

The chrome is **header 41 + footer 45 = 86px**, so a body of exactly 86px is consumed entirely by the two `shrink-0`
rows: the popover opens showing a search box and `BROWSE INTERACTIVE MAP` and **no room at all**. R1's mitigation
cannot save it — 86 < `POPOVER_MIN_USABLE_PX` (192), so `measureOpenMaxHeight` does call
`trigger.scrollIntoView({ block: 'center' })`, and the re-read still returns 86 because the trigger is the last row
of an **already-bottom-scrolled** list, so centring has nothing left to move.

### Fix, in the primitive

1. **Move the trigger, not just ask the browser to.** Replace the bare `scrollIntoView({ block: 'center' })` with a
   helper that finds the trigger's nearest scrollable ancestor and writes its `scrollTop` so the trigger's centre
   lands at about 45% of the viewport height (the same "write one element's scrollTop, never walk ancestors"
   reasoning R2 applied to the option list — write it there, do not ask the browser). Clamp to the container's
   scroll range, re-read the rect **after** the write, and fall back to `scrollIntoView({ block: 'center' })` only
   when there is no scrollable ancestor. Export it as a pure-ish, testable function next to `popoverMaxHeightPx`, with
   the measured case in the comment: bottom-scrolled last row, trigger bottom 662, space below 86 → the container is
   written so the trigger moves to ~346 → ~380px of list.
2. **Floor the body so a 0px list is impossible.** After measuring, `Math.max(cap, POPOVER_MIN_USABLE_PX)`, so the
   list always gets at least ~106px even when the trigger genuinely cannot be moved (a very short window, or a
   container already at both ends). The floor is a safety net, not the mechanism: on any ordinary viewport the
   centring write does the work and the floor never binds. Record that in the comment — a body that ignores the
   space below and hangs off the window is worse than one that is slightly too tall, but a picker with **zero** rooms
   in it is never acceptable.

Keep the committed `className` byte-for-byte, keep `POPOVER_MAX_PX = 400`, keep `side`/`align`/`sideOffset`/
`collisionPadding`, keep R2's focus and reveal, keep R3's definite `height` (and its `maxHeight`).

## F4 (BLOCKING) — the restored control makes the table wider than its panel

At 1366x768 QA measured: table `scrollWidth 1105` inside a `flex-1 min-h-0 overflow-auto` panel of `clientWidth
1070` — **35px of horizontal overflow**. The `DETAILS` header renders as **`DETA`**, and the last cell's right edge
lands at x=1381 against a panel edge of 1346, so the row's **"More actions" kebab (right 1365) is outside the visible
panel** — a control no one can reach, on every row. QA attributed it in place: hiding only the row picker buttons
drops the table to exactly 1070; capping them at 180px also removes it. The trigger's `w-[min(18rem,…)]` is
pre-existing, but before this packet it only ever rendered on the mobile card and inside the guided dialog.

**This is visible in the candidate's own committed evidence**, `a9c7-01-sections-1366x768.png` — `DETAIL` cut off at
the right edge and the `⋯` clipped — and `rendered-evidence.md` does not mention it.

### Fix — size the column, not the control

Give the table's Home room column an explicit width and let the shared trigger fill it:

- `Sections.tsx` `<th>` for Home room and `SectionRow.tsx`'s matching `<td>` carry the same explicit width (about
  `200px`) plus `min-w-0`, and the status line keeps its `truncate`.
- The trigger keeps `w-full` and its own `truncate` — do **not** add a width cap inside `SectionRoomPicker`, do not
  change its look, and do not add a page-local `className` override of any primitive (§8: one look per control). The
  control stays h-9 outline with its chevron on all three surfaces; only the column that holds it in this one table
  gets a width.
- The acceptance measurement, which must be in your handoff as numbers at **1366x768 and 1280x720**: the table's
  `scrollWidth` is **≤** its panel's `clientWidth`; the `DETAILS` header is not truncated; the row's "More actions"
  button's right edge is **≤** the panel's right edge.

## F1 and F2 — two false statements in shipped comments (NON_BLOCKING, fix them here)

- **F1.** The R3 comment in `SectionRoomPicker.tsx` records `ScrollArea root 160px (clips)` and the test bakes
  `CHROME_H = 400 - 160 = 240`. The measured truth: for a 400px body the **list** is **312px** and the chrome is
  **86–88px** (the root's own rect stays small; it is the *viewport* that becomes 5448 when the height is
  indefinite). A reader who trusts "160px of list" underestimates the control by about half. Correct the comment and
  the test's constant to the measured figures; the assertion's direction is right and its discriminating power is
  proven, so keep the assertion and only fix the numbers.
- **F2.** The R1 `measureOpenMaxHeight` comment says "the render confirms it gives a usable 248px popover on the last
  visible row". 248px was measured on `Maka-Diyos`, a **mid-panel** row. On the real last row it is 86px with no list
  (F3). Delete the claim rather than rewriting it — a comment must not assert a measurement it does not have.

## Re-render, with honest labels

Re-take the proof rows and label each by **what was actually clicked** — section name and its trigger's y before and
after, not "row N". The packet's row is *the bottom-most row of the list, scrolled to its end*; render that one, plus
one row near the top and one mid-panel. Record for each: `data-side`, popover rect, viewport `clientHeight` vs
`scrollHeight`, and whether the header / `Sync sections` / the "More actions" button are clear. **Click nothing inside
the picker** — no option, no write (see the disclosure already in `rendered-evidence.md`).

## Gates

```
npm run typecheck
npm run test:a3-c4-sections
npm run test:a3-sections-map
npm run test:a3-truthful-numbers
npm run test:a9-c3-sections-rooms
```

Add a test row that fails if the popover body is smaller than the chrome it contains plus one option row — the F3
defect in the harness's own terms — with failing-first shown. Add a source-level assertion that the Home room cell and
header declare the same explicit width, so F4 cannot silently return. Do not edit anything else, do not touch
`a3-c4-sections-surface.test.tsx`'s wording assertions, do not run `npm run build`, do not start or stop a preview (I
hold `http://127.0.0.1:5262`, PID 2620, and will re-render). Commit additively, push, no amend/rebase.
