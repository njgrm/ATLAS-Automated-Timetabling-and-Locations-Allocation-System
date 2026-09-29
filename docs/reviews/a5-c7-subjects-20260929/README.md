# A5 C7 — `/subjects`: five filters in one row + the ACTION header that survives scroll

**Candidate branch:** `work/a5-c7-subjects-filters-action-header`
**Base:** `cf7defa2` · **Packet:** `docs/prompts/fix-3-2026-09-29.md` items 43 and 44
**Risk:** LOW-MEDIUM, client only. No server, API, data, auth or route change.

---

## WHAT THIS IS, AND WHAT IT IS NOT

Every row below was captured against **REAL STAGING DATA** through a loopback preview of
**this candidate's source**, with `window.location.origin` asserted on each row.

> **This is a CANDIDATE RENDER AGAINST REAL STAGING DATA. IT IS NOT LIVE.**
> Origin on every row: `http://127.0.0.1:5277` — the A5 C7 worktree's own vite preview
> (port 5277, inside the 5200–5299 band), started with
> `scripts/dev/start-preview.ps1`, which proxies `/api/v1` to the **staging** server on
> `127.0.0.1:5101`. It has never been pointed at `127.0.0.1:5001` (live). Signed in via
> the candidate's own `/__dev/staging-login`, which sets the session server-side; no
> credential was read, typed, echoed or displayed at any point.
> `D:\ATLAS-runtime-config\atlas-staging-qa.env` was **never opened, read or navigated to**.
>
> The live ATLAS origin (`https://njgrm.buru-degree.ts.net`) serves an older release and
> can never prove undeployed source bytes, so it is the wrong instrument for this packet.

**22 real subject rows** were on screen in every capture. The staging API answered
`404` on `/generation/1/2/runs/latest` throughout: staging has no generated schedule.
That is the state of the staging database, not a defect and not a mock — the subject
catalogue itself is real.

---

## ITEM 43 — all five filters inline in ONE row

### Row 1 — BEFORE: the `More filters` disclosure, closed

`43-BEFORE-more-filters-closed.png` · origin `http://127.0.0.1:5277` · base source `cf7defa2`

Measured on the base source, same origin, same 22 rows:

| | base |
|---|---|
| filters visible in the row, no interaction | **2** — `Grade: All`, `Program: All` |
| `More filters` button | present, visible, reads `More filters` |
| `Status`, `Room`, `Term` | **not rendered** until that button is pressed |

This is the state item 43 is filed against: **three of the five filters are not on the
screen**, and a scheduler has to click a button to find out the page is filtered at all.
The button also carries a `(n)` count of set filters — a number the older, mouse-first
scheduler this packet is written for does not read off a filter bar.

### Row 2 — AFTER: five pickers, one line, no disclosure

`43-after-filter-row-one-line.png` · origin `http://127.0.0.1:5277` · 1366×768

`43-after-picker-open-same-look.png` — the same row with the `Room` picker open, to show
it is built from the same primitive as its four neighbours (same height, border, radius,
type size, chevron and option-list search behaviour).

**The proof is the geometry, not the picture.** Every control's `getBoundingClientRect().top`:

| control | top | width |
|---|---|---|
| search box | **150** | 240 |
| `Grade: All` | **150** | 128 |
| `Program: All` | **150** | 128 |
| `Status: All` | **150** | 128 |
| `Room: All` | **150** | 128 |
| `Term: All` | **150** | 128 |

- **`distinctTops = [150]`, `WRAPS = false`.** One line. No wrap.
- Search box starts at x=281, `Term`'s right edge is x=1201, the row's container edge is
  x=1341 → **140px of slack** at 1366.
- All five triggers render the identical class list width token `w-32`, and an
  in-browser scan for any button whose visible text begins `More filters` returns **0**.
- `data-testid="subjects-more-filters"` is **absent from the DOM**, not merely hidden.

`43-after-filter-set-reset-one-line.png` — with `Room: Laboratory` set, so the ghost
`Reset` is showing. Still `distinctTops = [150]`, `WRAPS = false`. `Reset` measured 58px.
The six-control row therefore fits one line too.

### A MEASURED DEFECT THIS SLICE MAKES MORE VISIBLE — see RISKS

With `Room: Laboratory` set, that trigger reports
`scrollWidth − clientWidth = 10`: its face genuinely overflows its 128px rectangle.
`picker-trigger.tsx` removed `truncate` deliberately (§8 forbids an ellipsis) and the
trigger carries no overflow handling, so the text runs past the border. This is
**pre-existing and identical on the base** — `Room: Laboratory` was already `w-32` there
— but item 43 moves it from "behind a disclosure" to "permanently on screen". The full
inventory is in `KNOWN_OVERFLOWING_FACES` in
`a5-c4-subjects-filter-disclosure.test.tsx` (14 faces), and it is asserted there rather
than left in a comment. **Not fixed in this slice** — the reasons are in that block and
in RISKS below.

---

## ITEM 44 — the ACTION column header survives scroll

### Row 3 — BEFORE: the header is covered by row buttons

`44-BEFORE-scrolled-action-header-covered.png` · origin `http://127.0.0.1:5277` · base source `cf7defa2`

Scrolled to **308px** (of 1200px scrollable, 22 rows). **Class names alone would have
called this fine** — the `th` reads `sticky right-0 z-20`. The proof is a hit test:

| | base | candidate |
|---|---|---|
| `thead` computed `z-index` | **10** | **30** |
| row action `td` computed `z-index` | **10** | 10 |
| sticky row cells geometrically under the header | 2 | 2 |
| `elementFromPoint` at the header's right edge | **`TD :: Review`** | `TH :: Action` |
| `ACTION` header paints on top | **false** | **true** |

On the base, `document.elementFromPoint` at the right edge of the header — where the word
`ACTION` is drawn — returns a **row's `Review` button**. The header is not merely dimmed
behind it; a different control is on top and is what a click would land on.

**Root cause, confirmed in the cascade exactly as Lane C diagnosed:** `position: sticky`
with a `z-index` other than `auto` **creates a stacking context**. The `thead` sat at
`z-10`, every row's action `<td>` sat at `z-10`, and two siblings at the same `z-index`
paint in document order — `tbody` after `thead`. The `ACTION` `<th>`'s own `z-20` was
resolved **inside** the `thead`'s context and could never lift it out. Raising a child's
`z-index` inside a parent stacking context changes nothing outside that parent.

### Row 4 — AFTER: header fully visible, edges lined up

`44-after-scrolled-action-header-visible.png` · origin `http://127.0.0.1:5277` ·
**same 308px scroll position, same 22 rows, same viewport** — the two rows are
comparable rather than two different views of the page.

- `thead` is now `sticky top-0 z-30 bg-muted`.
- `elementFromPoint` at the header's right edge returns **`TH :: Action`**.
- **The `th`'s own `z-20` was deliberately removed.** It could never have worked, and
  leaving it would have been worse than useless: it reads as "this cell is protected"
  and is exactly the misreading that shipped the defect. Nothing is lost — within the
  `thead` a positioned cell paints above non-positioned siblings regardless of
  `z-index`, so `sticky right-0` alone keeps it above the other five headers.
- **Opaque background:** `bg-muted/90` + `backdrop-blur-md` → `bg-muted`. At `/90` a row
  button was legible *through* the header. With an opaque fill the blur has nothing to
  blur, so it was dropped rather than left as an inert class.
- **One fixed width for both cells**, from `SUBJECT_ACTION_COLUMN_WIDTH_CLASS`
  (`w-44 shrink-0 px-4`) in `atlas-client/src/components/subjects/subject-action-column.ts`,
  imported by `SubjectCatalogBody.tsx` and `SubjectRow.tsx` alike. `shrink-0` is part of
  the constant: a `w-*` is only a *preferred* size, so without it the table can squeeze
  the column and the shared width is decorative. It lives in its own module rather than
  in either component because `SubjectCatalogBody` imports `SubjectRow`, so a token in
  the parent would make the child import upward into a cycle — and deliberately NOT in
  `@/ui`, since it is table chrome for one column of one page, not a reusable control.

---

## WHAT THESE FOUR ROWS DO NOT PROVE

- They are a **candidate** render. They prove nothing about the live release, which
  serves an older SHA and will keep doing so until this candidate is deployed.
- They do **not** prove a filter value selects the same subjects. That is the source
  pipeline's job and it is unchanged: `Subjects.tsx`, `SubjectStatusFilter`, every
  option list and every `shortLabels` map are byte-identical. The dedicated suite drives
  all five filters end to end and asserts the exact value each reaches the page.
- They do **not** prove the row holds at other widths. The budget and the class contract
  are asserted in source (`A5-C7-2k`); 1366 is the width this packet names, and it is
  the one measured here. `flex-wrap` is kept so a narrower viewport degrades by wrapping
  rather than overflowing (§8's no-page-scrollbar rule).

---

## GATES

Run from `E:\ATLAS-worktrees\lane-a5-c7-subjects\atlas-client`. Base counts are from the
same commands on `cf7defa2`, captured before any edit.

| command | base | candidate |
|---|---|---|
| `npm run test:a6-c8-subjects-coverage` | **88 pass / 0 fail** | **89 pass / 0 fail** |
| `npm run test:a5-c4-filter-disclosure` | (inside the 88) | **11 pass / 0 fail** |
| `npm run test:a5-c3-subjects-calm-surface` | — | **23 pass / 0 fail** |
| `npm run test:a5-subjects-c1` | — | **14 pass / 0 fail** |
| `npm run test:a3-subjects` | — | **32 pass / 0 fail** |
| `npm run test:a3-c4-subjects-copy` | — | **19 pass / 0 fail** |
| `npx tsc --noEmit -p tsconfig.json` | 5 errors, all pre-existing | 5 errors, all pre-existing, **none in a changed file** |
| `npm run build` | — | **built in 5.54s** |
| `git diff --check` | — | **exit 0** |

The five `tsc` errors are `Cannot find module 'playwright'` in three
`src/components/timetable/__tests__/` files (playwright is absent from this worktree's
junctional `node_modules`), one implicit-`any` in `timetable-scheduling-quality-c03`, and
one comparison in `timetable-truth-labels-a2`. None is in a file this candidate touches,
and the count is identical on base and candidate.

`npm run build` **fails closed** without `VITE_ENROLLPRO_URL` — the guard documented in
`docs/reference/agent-runtime-deploy-facts.md`. It was run with
`VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net` (a non-secret origin, no
credential). Recording the literal invocation, because a build that "passes" only with an
inherited shell variable is not reproducible.

---

## WORKTREE

`E:\ATLAS-worktrees\lane-a5-c7-subjects` · **disposition `KEEP_ACTIVE`** — a correction
round is expected and the preview may still be running.

The `node_modules` junction to `E:\ATLAS-worktrees\lane-a2-c13\atlas-client\node_modules`
(156 entries, 30 bins) was **read only**. No `npm install`, no `npm ci`, and the junction
was not deleted.

The base/candidate comparison in rows 1 and 3 was produced by applying
`git diff --output=<file> cf7defa2 HEAD -- <the four source files>` and reversing it with
`git apply -R`, then restoring with `git apply`. Both sides were pinned by SHA-256 before
and after, and the three restored files were confirmed **byte-identical to the committed
candidate** before this evidence was written. No `git checkout --`, `git reset --hard`,
`git clean` or stash was used at any point.
