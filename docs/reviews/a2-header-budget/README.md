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

**Correction 2's four renders used the same pattern on `:5321`** (a free port in
the 5320–5339 range), same `VITE_ATLAS_API` staging target, same fixture code
copied verbatim from the committed suite, harness files deleted after the
screenshots, and `window.location.origin` (`http://127.0.0.1:5321`) asserted on
every measurement. These are still ISOLATED loopback renders of the component,
never ATLAS acceptance.

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

## CORRECTION 2 (2026-09-29) — "one status per fact"

The independent design-judgement reviewer (AGENTS.md §11 gate item 4) returned
`REJECT_UX` on this slice: **six of seven rubric items pass, one fails.** The
operator's complaint was two elements claiming the same thing, and the header
budget had moved that disease into two new forms rather than removed it. Four
fixes follow, and every one of them changes what a scheduler READS, so every one
of them is decided by a render in this directory and not by a JSDOM assertion.

Same harness, same fixtures (`stateAContext` / `stateBContext` /
`stateCFollowUpsContext` copied verbatim from
`src/components/timetable/__tests__/a2-header-budget-2026-09-29.test.tsx`), same
1366×768 viewport, `window.location.origin` asserted on every row.

| | Render | Decided |
|---|---|---|
| **F1** state B | `c2-1366x768-stateB.png` | the run's state is stated ONCE |
| **F2** state B | `c2-1366x768-stateB.png` | a real separator before the amber term clause |
| **F3** published, 2 follow-ups | `c2-1366x768-published-followups.png` | the follow-up count is stated ONCE |
| **F3** published, 0 follow-ups | `c2-1366x768-published-clean.png` | the exact `schedule-clarity-c03` accessible name survives |
| **F4** state A | `c2-1366x768-stateA.png` | no control with nothing to do on row 2 |

### F1 — the duplicated draft-visibility clause

The reviewer's measurement, quoted: `State: Draft — teachers and students cannot
see it yet. (Run 321)` in grey is followed 14 px later, with no separator and no
line break, by bold `Draft — not visible to teachers until you publish`. "Same
fact, same strip, said twice. It reads as one run-on sentence with a font change
in the middle."

**The band now reads, in full:**

> `State: Draft — teachers and students cannot see it yet. (Run 321)  ·  Term setup is unverified. Without an explicit term, the timetable is not loaded.`

Measured on the live DOM at 1366×768: `timetable-draft-visibility` is **not** a
descendant of `timetable-simple-status-band`; `timetable-run-identity` is, and its
text is the whole surviving sentence including the run number.

**Which one survived, and why — the reason, not the taste.** Both strings come
from the ONE `describeRunState` call (`RunStateBadge.tsx:103`) and therefore from
the same `runStateKeyOf`, so they are the same fact by construction.
`runStateSentence` survives because it carries **the run number**, and #41 (the
screen must name the run it is showing) is accepted committed behaviour; the
number is the one thing on that line a scheduler can act on, and `History 3` gives
them the list. `runVisibilitySentence` is pure restatement there, and the wordier
of the two. The restatement was **deleted, not reworded** — the reviewer's ruling
was explicit, and rewording would have left two sentences about one fact.

Nothing was lost. The OTHER surface that renders `timetable-draft-visibility` —
`DraftVisibilityState` inside `TimetableDraftStateStrip`, used by the EXPERT
header — is untouched, and `a2-c11-draft-actions.test.tsx:173,239` still assert
its copy byte-for-byte. In the Simple header that strip is rendered with
`visibility={null}`, so the run's audience is now stated in exactly one place: the
band's own sentence, which says a draft means "teachers and students cannot see
it yet".

### F2 — a real separator before the amber term clause

The band container's `gap-x-2` was not enough: 8 px of white space is a pause,
not a boundary, so the attention colour still read as the tail of the draft
sentence. There is now a visible middot in **its own span**, between the two
facts in DOM order, `aria-hidden="true"`, `select-none`, at
`text-muted-foreground/60` so it is quieter than either sentence, with `px-1` so
the band reads as "A · B" rather than as one clause with a mark in it.

Measured: `timetable-status-band-separator` is a sibling positioned after
`timetable-run-identity` and before `timetable-term-authority-unverified`; neither
clause contains the character; and with the separator's `aria-hidden` honoured
(the committed suite's `visibleText` strips `aria-hidden` descendants) the band's
readable text contains no separator character at all. The amber clause keeps its
`text-amber-800` and its `timetable-term-authority-unverified` testid, which the
rows depend on — it now reads as a warning about **terms**, which is what it is.

### F3 — the follow-up count, said once

The reviewer's measurement, quoted: a small pill reading `Published with 2
follow-up items`, and 30 px to its right the green primary surface `Published
schedule — 2 follow-up items remain`. "The follow-up count is stated twice, side
by side, in the same row."

| | before | after |
|---|---|---|
| readiness chip | `Published with 2 follow-up items` | **`Published`** |
| published primary surface | `Published schedule — 2 follow-up items remain` | **unchanged** |
| `aria-label` (2 follow-ups) | `Published schedule — 2 follow-up items remain. Changes start on a date you choose.` | **unchanged** |
| `aria-label` (0 follow-ups) | `Published schedule. Changes start on a date you choose.` | **unchanged** (verified again on `c2-1366x768-published-clean.png`) |
| elements in the header naming the count | 2 | **1** |

**The count moved OFF the chip and STAYED on the primary surface**, and the reason
is not taste. `SimplePublishedState` is the DOMINANT object in that state — `h-11`,
emerald, and the lifecycle PRIMARY slot — and `resolveSimpleHeaderPrimary` returns
`'published'` for exactly the runs whose `summary.isPublished` is true, which is
the same predicate `readinessLabel` reads before it reaches this branch. So the
published surface is on screen in **every** state whose chip can say "Published"
here: the count cannot appear without somewhere for it to appear, and nothing is
lost.

The one committed row that pinned the chip's duplicate —
`timetable-operator-workflow-state.test.ts`, "readiness chip distinguishes
published follow-ups from clean published" — is marked **SUPERSEDED IN PLACE**,
with the original assertion retained verbatim in a comment and a replacement that
asserts the surviving claim as a rule (the chip names the state, names no number,
and is identical for 0, 2 and 12 follow-ups). AGENTS.md §16 forbids closing a
finding by editing the row that found it, so nothing was deleted.

**SUPERSEDES the previously committed `published-1366x768-AFTER.png`.** That file
is **kept** and is still an accurate record of the *truncation* correction, but it
is no longer the current published-state render: it shows the chip still reading
`Published with 2 follow-up items`, which this correction removed. The current
published renders are `c2-1366x768-published-followups.png` (2 follow-ups) and
`c2-1366x768-published-clean.png` (none). The claim the old pair was kept to prove
— the two `truncate` classes are gone and the before/after are byte-identical —
is unaffected and still checkable with the hash command above.

### F4 — the dead `Edit draft` in state A

The reviewer's ruling, quoted: "The disabled `Edit draft` on row 2 in state A — it
should not be there. … In the base it was `Edit draft` (grey) + a printed
sentence explaining why it was dead. This slice deleted the sentence and kept the
dead button. That is the worst half of the pair kept and the better half removed.
Hide it in state A, or move it under `More`."

**`c2-1366x768-stateA.png`**: row 2 is `Term · Show · Schedule for` and nothing
else. Measured: no `timetable-draft-strip-edit`, no `timetable-draft-strip-discard`,
no `-reason` element, and `timetable-simple-more-trigger` still on screen. The
action is not lost — it is one `More` click away, which is the other half §8
allows ("hidden OR live under `More`"), and `draft-ux-c01`'s S1R row now asserts
that reachability explicitly.

**The signal is `actions.hasDraft`, and the alternatives were measured, not
assumed:**

- `actions.edit.enabled` is `hasSelectedClass && onEdit !== null`, and it is
  **false in state B** — a screen with a real draft on it and no class selected.
  Gating on it would hide a reachable control. Rejected.
- `actions.discard.enabled` is `hasDraft && onDiscard !== null`. A first attempt
  replaced BOTH controls' rule with a single `hasDraft` signal; `draft-ux-c01`'s
  `A2-C12-ITEM4R` rows (4) and (5) require `Discard draft` to be hidden without a
  handler even WITH a draft on screen, and to return when one is supplied. That
  attempt failed (4) in the bare-node `assert.equal(querySelector(...), null)` form
  — the exact statement `a2-header-budget`'s own **H10** row exists to catch — and
  took the 256 MB child process down with it. So the two controls read **two
  signals**: `Discard draft` keeps `discard.enabled` verbatim, and `Edit draft`
  reads `hasDraft`. Both prop comments in `TimetableDraftStateStrip` record this.

**One committed row had to be superseded for F4, additively and visibly:**
`draft-ux-c01`'s `S1R` asserted `deepEqual(names(withRun), names(noRun))` — "the
action set does not change shape between 'no run' and 'run present'". Hiding the
dead control makes the two sets differ by exactly that one control, which is what
the reviewer required, so the equality and the ruling cannot both stand. The row
is marked SUPERSEDED in place with its original assertion verbatim in a comment,
and its replacement is **stronger about the thing that matters**: the per-state
cap, the exact seven names in the run state, that the ONLY difference between the
states is `Edit draft`, that nothing disappears when a run appears, and that the
verb is still reachable in `More`.

### Carried forward, NOT fixed here

The reviewer recorded one further **observation, not a blocker**: state A's
disabled `Generate` samples as a pale green (`rgb(141,188,171)`) that reads as a
misprinted button rather than as "unavailable until you fix the 468". This
correction does **not** change `Generate`'s styling — that is a design change
beyond this round, and the reviewer said so. Recorded here so it is not lost.
Mechanism, from the source: `SimpleGenerateAction` renders
`variant={primary ? 'default' : 'outline'}`, and in state A with no generated run
`resolveSimpleHeaderPrimary` returns `'generate'`, so the control is `default`
(`bg-primary`) **and** `disabled` — shadcn's `disabled:opacity-50` over the
primary fill is the pale green. Note the `c2-1366x768-stateA.png` fixture has
`curriculumReadiness.state === 'ready'`, so its `Generate` is ENABLED and this
sampling was not re-taken on a blocked fixture.

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
- **Idle actions are gone.** State A (no draft) shows no Undo/Redo/History, no
  `Discard draft` and — as of correction 2 — **no `Edit draft` either**; row 2 is
  the three pickers and nothing more. The base showed Undo/Redo/History and
  `Discard draft` on a year with a schedule, and `Edit draft` disabled with a
  printed reason.
- **The 468 items became a short link.** `468 setup items to fix` is the whole
  chip. The detail is still reachable (the existing blocker sheet, and the
  chip's Tooltip carries the diagnostic).
- **Row 2 is Term / Show / Schedule for**, on the shared `@/ui` picker chrome.
- **The status line moved out of the box.** In state B the candidate renders one
  calm line below the header. **As of correction 2 it reads, in full:**

  `State: Draft — teachers and students cannot see it yet. (Run 321)  ·  Term setup is unverified. Without an explicit term, the timetable is not loaded.`

  One sentence about the run, a middot, then the term warning. (Before correction
  2 this line also carried the second draft sentence — see the F1 section above.)
  The base had the run badge, the term scope line, a duplicated term notice, the
  draft sentence AND the whole setup paragraph competing inside one row.

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