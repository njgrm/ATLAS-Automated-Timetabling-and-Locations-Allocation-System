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
  has none.
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
  setup is unverified...`. The base had the run badge, the term scope line, a
  duplicated term notice, the draft sentence AND the whole setup paragraph
  competing inside one row.

NOT DECIDED here, and stated so:

- **The base screenshot is the old header, and the base's own text is what the
  operator complained about.** It is the "before", not a target.
- **`Schedule for: Choose Section` reads oddly in both** — that is the real
  entity-picker placeholder with no entity selected, present at the base too.
  It is a follow-up, not a regression from this slice.
- **The authenticated route, the grid below the header, and the More menu's
  real contents are not in these renders.** They are Lane C's staging rows.