# A3 c14 — School Year Setup: calm, plain, one next step

**ON `main` at `603902dc`** (product merge `b1249a7c`). Candidate `5b65d78e` on
`work/a3-c14-year-setup-calm`. QA `ACCEPT_READY` round 2, 11/11/0/0.
**0 fixes live and seen / 1 integrated, not on production / 0 dropped.** A4 owns the deploy; Lane C's UX walk
blocks the release of this screen. Not deployed by A3.

## Verdict against the operator's own words

> "make the default view one sentence and one button, with IT details folded away, and never an endless
> Checking message"

Measured on **real staging data** (2023-2024, signed in with the staging QA login, loopback preview proxying to
`:5101`), at 1366x768:

| | before | after |
|---|---|---|
| visible words in the main region | 222 | **43** |
| content height in a 659px region | 1236px (scrolled) | **659px (no scroll)** |
| visible primary actions | — | **0** (aligned state) |
| raw codes visible (fold open) | — | **0** |
| sentence | — | "ATLAS is on 2023-2024." |
| fold trigger | — | "Details for IT", `aria-expanded=false`, visible at y=348 |

Rendered test count: default view **32 words closed / 157 with the fold open**.

## What changed

- **`CalmYearSetupDetails.tsx` (new)** — one `@/ui` ghost disclosure, `aria-expanded` + `aria-controls`, closed by
  default, panel carried by the HTML **`hidden`** attribute so the detail is out of the page *and* the tab order
  while every existing assertion still finds its node. It is a provider and a portal target, so the plain card's
  own detail lands in the **same** fold; with no provider mounted the card renders that detail inline exactly as
  before, so no other mount of `RolloverGuidanceCard` changed.
- **`RolloverPlainYearSetupCard.tsx`** — drift badges, counts line, server conflict messages, field-level EnrollPro
  changes and the standalone read-only preview move into the detail. The aligned state no longer repeats itself.
  The raw grade-level and program **database ids** are gone; the field that moved is named instead.
- **`AdminYearSetup.tsx`** — the term-authority line, the school-year list, the carry-forward review and the
  destructive reset move into the fold. The amber `ADMIN ONLY` chip is removed (the route guard already enforces
  it). **The endless check ends:** after 8 s with no status the page says what is slow and offers one
  "Try again", which re-reads through the page's existing `reloadSignal` — one status read per mount, no second
  reader. The sign-in check deliberately got **no** second deadline; A7-C5's shared resolver owns that one.

**Subtracted, not added:** the `ADMIN ONLY` chip, the fold hint line, the redundant "Nothing to do." sentence, the
raw ids in the reconfigured list, and the "EnrollPro 2023-2024" badge from the default view.

## Gates actually run

| Gate | Result |
|---|---|
| `npm run test:a3-c14-year-setup-calm` (new, rendered DOM) | 6/6 |
| `npm run test:a7-year-setup-plain-words` | 17/17 |
| `npm run test:a7-year-setup-carry-switches` | 11/11 |
| `npm run test:ux-guardrails` | 31/31 |
| `npm run test:a7-c5-session-deadline` | 12/12 |
| `npm run typecheck` | 5 errors, **none in a changed file** (3x TS2307 `playwright` from the incomplete node_modules donor + 2 pre-existing) |
| QA round 1 | `CORRECTION_REQUIRED` 18/17/0/0 — one BLOCKING (duplicate object key, TS2783, in the new test file) |
| QA round 2 | `ACCEPT_READY` 11/11/0/0, no REJECT_UX |

QA independently reproduced the before/after render, three discriminating mutants (removing `hidden` → 4/6 rows
red; forcing the card inline → row 2 red; removing the retry re-arm → row 6 red), the one-status-read claim, and
confirmed the new row 5 genuinely compensates for the scope the detail left behind in A7-C1's mouse-first row.

## The one recorded departure (QA N1)

The packet asked for "Past years: one short list" in the **default** view. On real staging that list is five tall
drill-year cards (2029-2030 to 2032-2033), so leaving it above the fold overflowed 768 and pushed the fold itself
off screen. It is inside the fold now. **A7 c7 owns the list and is making it short; moving it back above the fold
is a one-line change when it is.**

## Follow-ups, none blocking

1. The slow-check copy cannot distinguish a slow read from a failed one without a new prop through the banner
   card (A7's file). QA's rendered probe found the stacked state does not in fact occur.
2. The card's error line still shows the raw transport message — pre-existing at base, out of c14's scope.
3. The shell header "Active year: 2023-2024" duplicates the page sentence; c14 cut the year being stated three
   times down to two.
4. `PlainYearSetupCard` now returns a fragment, so on a no-provider mount the detail sits outside `<Card>`. No
   production mount lacks the provider.
5. `a7-year-setup-plain-words.test.tsx` row 5's ordered request list became a multiset, because folding the
   term-authority banner changed the mount order of `/runtime/context` and `/runtime/rollover-status`. The
   multiset still fails on a missing, extra or duplicated request, and the superseded order is retained as its own
   row. QA ran the base file against base source to confirm the old order was real.

## Browser rows (own, real staging, `http://127.0.0.1:5271` -> staging `:5101`)

- default view at 1366x768, 2023-2024 — PASS (43 words, no scroll, one sentence, fold closed)
- the Details fold is closed by default — PASS (`aria-expanded="false"`, panel `hidden`, 0 visible focusables)
- no raw code visible, fold closed **and** open — PASS
- slow-check message appears after 8 s with one Retry — PASS (at 4 s: no notice; at 11 s: the line and exactly one
  "Try again")

Screenshots: `C:/Users/njgro/AppData/Local/Temp/opencode/pw-mcp-output/` — `c14-before-default-1366.png`,
`c14-after-default-1366.png`, `c14-slow-check.png`.

**Reproduction:** `powershell -File scripts/dev/start-preview.ps1 -ClientDir <worktree>\atlas-client -Port 5271`
then sign in on `/login` with the staging-only QA login. The `/api/v1` base in that script is load-bearing and is
now explained in its comment (A6 c8 / A9 c4 landed the fix; this branch adds the reasoning).

## Worktrees

`E:/ATLAS-worktrees/lane-a3-c14-year-setup` and `E:/ATLAS-worktrees/lane-a3-c14-integ`, both
`RETIRE_AFTER_INTEGRATION`. Each has `atlas-client/node_modules` as a **junction** to
`E:/ATLAS-worktrees/lane-a3-c12-dashboard-map-sections/atlas-client/node_modules`: `cmd /c rmdir` the junction
**before** `git worktree remove`, then re-count the donor. A `git worktree remove` that follows the junction empties
the donor.
