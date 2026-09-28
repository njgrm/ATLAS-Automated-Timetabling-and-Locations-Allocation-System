# A2 header-budget — rendered evidence

Real Chromium (Playwright MCP), the REAL `TimetableSimpleHeader` and the real
Tailwind CSS, at 1366x768 and 1920x1080, in both year states.

**Harness, honestly labelled.** These are ISOLATED loopback renders of the
header component, not the authenticated `/timetable` route. A temporary harness
mounted the real header with the same fixture the committed suite
(`a2-header-budget-2026-09-29.test.tsx`) uses, served by a vite dev server on
`127.0.0.1:5310` with `VITE_ATLAS_API=http://127.0.0.1:5101`. The harness
files were deleted after the screenshots; the base tree got the identical
harness on `:5311` so the before/after pair is the same fixture both sides.
AGENTS.md 12: this is never ATLAS acceptance. The authenticated live/staging
walk remains Lane C's row on A4's staging.

**How the band count was measured.** `getBoundingClientRect()` on every
descendant of `[data-testid="timetable-simple-header-row"]` at the real
viewport, then the distinct `top` values. That is a real layout measurement,
which JSDOM cannot do — it is why this row exists and why the committed suite
calls itself STRUCTURAL.

| Render | Header box height | Distinct text-row tops | Verdict |
|---|---|---|---|
| base 1366x768, state B | **100 px** | 0,9,10,12,13,17,18,19,21,22,34,56,57,60,62,65,66,68,70,71,72,73,74,75,76,77,78,80 | the seven-band header Lane C measured |
| candidate 1366x768, state A | **86 px** | 0,4,6,9,10,12,14,15,16,17,21,44,46,54,55,56,58,60,62,64 | two rows, 44 px + 42 px |
| candidate 1366x768, state B | **86 px** | 0,4,6,9,10,12,14,15,16,17,19,20,21,44,46,54,55,56,58,59,60,62,64 | two rows, 44 px + 42 px |
| candidate 1920x1080, state A | **86 px** | — | same two rows, no growth with width |
| candidate 1920x1080, state B | **86 px** | — | same two rows, no growth with width |

`document.documentElement.scrollHeight` equals `innerHeight` (768 / 1080) on
every render: no page scroll is introduced by the header.

## The PUBLISHED state, and the correction of 2026-09-29

The state the table above had no row for is the **published** state: a year whose
run is published, which is what `resolveSimpleHeaderPrimary` puts in row 1's
**primary** slot. Independent QA returned `CORRECTION_REQUIRED` 7/8 on `cc13af57`
with one BLOCKING finding: `SimplePublishedState` still carried `truncate` on both
of its sentences, while `docs/handoffs/lane-a-to-c.md` recorded the truncation as
BUILT and the packet target is worded "**anywhere**". So the one state an ordinary
scheduler reaches with a finished year was the one state with a clipping mechanism
in it and no rendered evidence at all. Both classes are now out.

Same harness, same fixture, same 1366x768 viewport, measured with one `evaluate`
on each side. **BEFORE** is the `cc13af57` code path (the two `truncate` classes
restored for the render only, then removed again for real).

| | BEFORE (`cc13af57` path) | AFTER (this correction) |
|---|---|---|
| Render | `published-1366x768-BEFORE-cc13af57.png` | `published-1366x768-AFTER.png` (and `…-no-follow-ups.png`) |
| `truncate` classes inside the header | **`span[truncate]`, `span[truncate text-xs font-normal text-emerald-800]`** | **none** |
| `…` / `...` in the header's rendered text | none | none |
| Header box height | **87 px** | **87 px** (identical) |
| Row 1 / row 2 count | 2 rows, row 1 = 44 px | 2 rows, row 1 = 44 px (identical) |
| Published surface box | 364 × 44 px | 364 × 44 px (identical) |
| Both copy spans | `clientWidth === scrollWidth` (318 px) | `clientWidth === scrollWidth` (318 px) |
| `documentElement.scrollWidth/scrollHeight` | 1366 / 768 | 1366 / 768 (no page scroll) |

**Read the honest part of that table.** The geometry is IDENTICAL on both sides:
at 1366 the ellipsis was **latent, not painted** — the surface is `shrink-0`, so
it is always given its full content width and `truncate` had nothing to clip. The
fix removes a hazard and makes the handoff claim true; it does not change a pixel
of what a scheduler sees today, and this README does not claim that it does. What
it would take to make the ellipsis actually paint is a follow-up count with more
digits than the row has slack for, or a future layout that makes the surface
elastic — and the trade for that case is written into the source comment rather
than left silent.

**And the strongest form of that statement, checkable in one command: the two
renders are BYTE-IDENTICAL.** That is the point, not an accident of the
harness, and both files are kept so the claim is verifiable rather than asserted:

```
Get-FileHash published-1366x768-BEFORE-cc13af57.png, published-1366x768-AFTER.png -Algorithm SHA256
F026AEE9ACE13BA1DDF2EE780C1E4772AC2192004814CA16FC85417DE487B9A0   (both)
```

The third render, `published-1366x768-AFTER-no-follow-ups.png`, is the zero-
follow-up state and differs (`723157A0…`), so the pair above is not two copies of
one image by mistake.

## What the screenshots decide, and what they do not

DECIDED by these renders, in the operator's own state (468 setup blockers) and
in the draft state:

- **One status chip.** State A reads `468 setup items to fix` and nothing else
  claims the schedule is missing. The base's duplicate is gone: the base
  screenshot shows `Draft — not visible ...` truncated with an ellipsis AND the
  long `Setup needs attention before ATLAS can generate a timetable. 468
  setup...` paragraph AND `Ready to publish`, three separate claims.
- **No truncated sentence anywhere.** The base's `Draft — not visible ...` and
  `Term ...` and `468 setup...` all carry ellipses on screen. The candidate
  has none. (The published state was the gap in this claim, and it is closed as
  of 2026-09-29 — see the section above.)
- **No helper sentence under a draft action.** The base prints
  `Pick a class on the grid first, then choose Edit.` under `Edit draft`. The
  candidate prints nothing; the reason moved to the tooltip.
- **Idle actions are gone.** State A (no draft) shows no Undo/Redo/History and
  no `Discard draft`; the base showed Undo/Redo/History and `Discard draft` on a
  year with a schedule, and `Edit draft` disabled with a printed reason.
- **The 468 items became a short link.** `468 setup items to fix` is the whole
  chip. The detail is still reachable (the existing blocker sheet, and the
  chip's Tooltip carries the diagnostic).
- **Row 2 is Term / Show / Schedule for**, on the shared `@/ui` picker chrome.
- **The status line moved out of the box.** In state B the candidate renders one
  calm line below the header: `State: Draft — teachers and students cannot see
  it yet. (Run 321)  Draft — not visible to teachers until you publish  Term
  setup is unverified. Without an explicit term, the timetable is not loaded.`
  The base had the run badge, the term scope line, a
  duplicated term notice, the draft sentence AND the whole setup paragraph
  competing inside one row.

  *(Corrected 2026-09-29. This line previously ended `… Term setup is unverified...`,
  which is an ellipsis the render does not show — the status band carries no
  `truncate` and prints the sentence whole. Quoted in full, so no reader can
  mistake the abbreviation for a UI truncation in the section about not
  truncating.)*

NOT DECIDED here, and stated so:

- **The base screenshot is the old header, and the base's own text is what the
  operator complained about.** It is the "before", not a target.
- **`Schedule for: Choose Section` reads oddly in both** — that is the real
  entity-picker placeholder with no entity selected, present at the base too.
  It is a follow-up, not a regression from this slice.
- **The authenticated route, the grid below the header, and the More menu's
  real contents are not in these renders.** They are Lane C's staging rows.