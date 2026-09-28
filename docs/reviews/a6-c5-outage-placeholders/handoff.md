# A6 c5 — executor handoff: outage shortage line, one-click cover, placeholders that say so

**Base** `b768dba8` (= `origin/main` `316534f2` + packet commit) · **checkpoint** `0053d379` (`wip(a6): outage surface checkpoint`, never amend) · **candidate** `59ccb02f`
Worktree `E:/ATLAS-worktrees/lane-a6-tl-header`, branch `work/a6-c5-outage-placeholders`. Client only; no `atlas-server/**` file touched.

## Changed paths

| Path | What |
| --- | --- |
| `atlas-client/src/pages/TeachingLoad.tsx` | 1017 → **990** lines; wires the shortage surface; carries the S9 note |
| `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx` | **S3 computation fix** |
| `atlas-client/src/components/faculty-assignments/teachingLoadOutage.ts` | S6 `and N more` gap closed |
| `atlas-client/src/components/faculty-assignments/__tests__/a3-c10-tl-header-density.test.ts` | assertion re-based, additive |
| `atlas-client/src/components/faculty-assignments/__tests__/a6-teaching-load-surface.test.tsx` | two assertions re-based, additive |
| `atlas-client/src/components/faculty-assignments/__tests__/a6-c5-outage.test.tsx` | **new**, 11 rows |
| `atlas-client/src/components/faculty-assignments/__tests__/a6-c5-outage-derivation.test.tsx` | **new**, 7 rows |
| `atlas-client/package.json` | `test:a6-c5-outage`; both files added to `test:client-suite` |
| `docs/reviews/a6-c5-outage-placeholders/layout-note.md` | over-cap clause amended |

(The other 13 source files were carried in checkpoint `0053d379`.)

## The two open items, resolved

**(a) S3 — the computation, not the slot.** `WorkspaceToolbar` computed
`(realAssignedPairs + syntheticPlaceholderPairs) / totalPairs`, so a placeholder-held class
counted as staffed. Suppressing the figure beside a shortage line hid the *slot*; the
arithmetic was still a lie to every other consumer. The numerator is now `realAssignedPairs`
alone. Two committed assertions pinned the old number on fixtures that **do** contain
placeholders — measured, not assumed: `a3-c10` (39 real + 1 synthetic / 42 → 95%) and
`a6-surface` (22 + 1 / 24 → 96%, twice). All three are marked **SUPERSEDED in place** with a
one-line reason carrying the old value, and the corrected assertion sits beside each
(93%, 92%, 92%). Nothing was deleted and no other assertion in those tests was touched.

**(b) Over-cap.** **The clause is dropped; the fact is not.** `useTeachingLoadRepairQueue`
builds its `over-cap` items **unconditionally** — verified at
`useTeachingLoadRepairQueue.ts:293`, no `hasShortage` guard — so the blocker is named
exactly once, in the queue (`Alcantara, Roberto is over the weekly max · 32.0h used / 30h max`),
which lives in `stateLineSlot` on row 2 and this slice does not touch. The chip is replaced
by *two* things: the shortage line (the `Temporary substitutes: 25` clause's own fact) and the
queue item. That is §8's actual rule — one status per fact, **never zero** — and it is a
strict improvement on the chip-plus-queue pair it replaces. The layout note's prior wording
("the over-cap and excess clauses survive only when there is no shortage") was imprecise
about *where* the fact lives; it is amended to say precisely that the over-cap blocker now
lives in the queue, named once, with the measured reason. The one honest residual is
recorded in the note: `Excess teaching load: N` has no per-teacher queue item (advisory
facet count, not a generation blocker), so it is withheld while a shortage claims the row and
returns the moment it does not.

## Decisive commands and literal results

```
npx tsc --noEmit  (atlas-client)
  BASE      316534f2 : exit 2, 5 errors
  CANDIDATE 59ccb02f : exit 2, 5 errors   (same five, byte-identical list)
    timetable-post-deploy-c04.test.ts(7,26)  TS2307 'playwright'
    timetable-post-deploy-c05.test.ts(7,26)  TS2307 'playwright'
    timetable-scheduling-quality-c03.test.tsx(9,26)  TS2307 'playwright'
    timetable-scheduling-quality-c03.test.tsx(101,90) TS7006 implicit any
    timetable-truth-labels-a2.test.ts(523,32)  TS2367
  S12 is therefore exit 0 relative to base, not absolute exit 0.

npm run test:a6-c5-outage        18 tests, 18 pass, 0 fail
npm run test:a6-teaching-load    29 tests, 29 pass, 0 fail
npm run test:a6-tl-header-budget  9 tests,  9 pass, 0 fail
npm run test:tl-no-demand-hotfix 5 tests,  5 pass, 0 fail
npm run test:a3-teachers-load   49 tests, 43 pass, 0 fail, 6 skipped
npm run test:a3-c10-tl-density   9 tests,  9 pass, 0 fail
npm run test:teaching-load-clarity 8 tests, 8 pass, 0 fail
npm run test:client-quality     34 tests, 34 pass, 0 fail
npm run test:ux-guardrails      31 tests, 31 pass, 0 fail
npm run test:client-suite    CANDIDATE 1238 tests, 1199 pass, 39 fail
                          BASE      1220 tests, 1181 pass, 39 fail
```

**The omnibus 39 is not mine and I did not fix it.** Both base and candidate measure the
same 39, across the same 24 files, all in `components/timetable/**`, `lib/__tests__/timetable-*`,
`tt-*`, `tl-operator-workspace-c05` and `a7-year-setup-plain-words` — zero in
`faculty-assignments` and zero in either new file. The count recorded in `3d369a31` is 38; it
has drifted by one somewhere on another lane. Recorded, not attributed, not fixed.

**One regression I caused, found and fixed before committing:** the S9 note carried
`shrink-0`, which broke `a3-c10` T4 ("the main column must carry exactly one `shrink-0` band,
the out-of-fence rollover wrapper"). The note is content that scrolls with the roster, not a
fixed band, so `shrink-0` is gone; `a3-c10-tl-density` is 9/9.

## Failing-first evidence

**BASE-RED — observed literally at `316534f2`** (the test file was copied into
`E:/ATLAS-worktrees/lane-a6-c5-baseline`, which is byte-identical to `316534f2` and
`git status --short` empty again):

```
a6-c5-outage.test.tsx  tests 11 · pass 2 · fail 9
  AssertionError: (75 real + 25 placeholder) / 112 must NOT read 89% staffed
                  — a to-be-hired record is not a teacher            [S3-1]
  AssertionError: the over-cap teacher must still be named while a shortage is showing
                                                                        [OVERCAP-1]
  AssertionError: the roster row must carry the placeholder note
                  — it used to read a bare one-word `temporary`      [S7-1]
  AssertionError: SectionGridMode.tsx must take the placeholder sentence
                  from the ONE constant                                [S7-2]
  AssertionError: the pre-hotfix wording must be gone from the code, not
                  only from the comment that names it                   [S9-1]
```
Five of the nine failures are these defects; the other four are the same files failing on the
missing c5 modules. Every red row names the defect the packet names, not an import error.

**PROVED BY MUTANT — the function was changed, the control was shown to fail, the exact bytes
were restored.** `git diff --stat` after restoration shows only the intended 9-line change to
`teachingLoadOutage.ts`; `useCoverShortage.ts` is byte-identical to the checkpoint.

| Row | Mutation | Result |
| --- | --- | --- |
| S3-3 | `staffedPercent` numerator re-adds `placeholder` | **7 tests, 6 pass, 1 fail** — `A6C5-S3-3` red |
| S4-1 | `runPreview` sends `apply: true` | **7 tests, 5 pass, 2 fail** — `A6C5-S4-1` red (S6-1 collateral: its preview applied too) |
| S6-1 | revert the `and N more` fix | **7 tests, 5 pass, 2 fail** — `A6C5-S6-1` red |
| S8-1 | `isComplete` ignores `stillUncoveredPairs` | (same run as S6-1) — `A6C5-S8-1` red |
| S2-2 | fixture mutation **inside** the control | always green by design: the row mutates the ownership map twice and asserts 9 → 8 when a placeholder becomes real, and that a draft-inclusive map does not move the SAVED figure |

**NOT PROVEN EITHER WAY:** the *rendered* grid row and the *rendered* suggestion-preview row of
S7. Both render `PLACEHOLDER_TRUTH_LABEL` — `A6C5-S7-2` proves both import the one constant and
both contain a render of it, and the roster row is proved rendered — but mounting them needs
`SectionGridMode`'s full expansion prop set and a complete `AutoFillSummaryResult` fixture, and
I would not fake either. **The browser lane must confirm the two surfaces visibly.**

## Rows

`S1` covered (`A6C5-S10-2`; identifier preserved, nothing reachable says `Guided`) · `S2` mutant · `S3` **base-red + mutant** · `S4` mutant · `S5` mutant-in-test (the server fixture moves the number 2 of 9 → 9 of 9) · `S6` mutant · `S7` **base-red**, two of three surfaces wiring-proved · `S8` mutant · `S9` **base-red** · `S10` covered (`A6C5-S10-1/2`) · `S11` covered (`A6C5-S11-1`: no department/outside-department control exists in any new file; exactly three options) · `S12` parity with base.

## 409 / apply path — verification status

**Proven by test, never fired at staging or live.** `A6C5-S6-1` drives the real
`useCoverShortage` hook against a stubbed `atlasApi.post` that throws the 409 with the
server's real `details` shape, and asserts the drift sentence names the classes
(`MAPEH — MAPEH 9`), never an id, and carries `and 3 more`; then clicks `Review again` and
asserts the next request is `apply: false`. `A6C5-S4-1` asserts the primary action is disabled
until an `apply:false` preview has resolved and that opening the dialog issues **no** request
at all. No `apply:true` was sent to any environment, and no staging/live write occurred.

## Follow-up rows recorded, not built

1. `teach outside department` in the cover dialog — the A8 endpoint has no `canTeachOutsideDepartment`.
2. `buildGuidedEmptyTeachingLoadMessage` still says Guided (identifier only, not user-visible).
3. `AutoFillSummaryModal.tsx` hard-codes the three coverage-mode labels `lib/teaching-helpers.ts` already owns.
4. `CreatePlaceholderDialog` hard-codes `schoolId: 1` on `POST /faculty/placeholders` (Faculty page, another lane's surface).

## Risks

- **NON_BLOCKING — S7 rendered gap.** Two of three placeholder surfaces are wiring-proved, not rendered. Browser lane must see them.
- **NON_BLOCKING — the one-word drift from 38 to 39** in `test:client-suite`; identical on base, in files this slice does not touch.
- **NON_BLOCKING — S12 is parity, not exit 0.** The five base errors remain on `main`; the packet's row as written is not satisfiable without another lane's `playwright` dependency and a timetable truth-label fix.
- **NON_BLOCKING — `Excess teaching load: N` is withheld** during a shortage state (advisory, no per-teacher queue item). Recorded in the layout note rather than hidden.
- **BLOCKING — none outstanding.**

## Verdict

**REVIEW_REQUIRED.** The packet's contract is implemented, every gate is green or provably at
base parity, S3 is fixed at the computation with its three dependent assertions re-based
additively, the over-cap blocker is measured to survive exactly once, and the S6 `and N more`
gap the previous session left open is closed. Two things a reviewer must judge rather than
take from me: the two unrendered S7 surfaces, and whether the over-cap adjudication is the
right one to ship.

---

# Correction round 1 — 2026-09-29

Range `b768dba8..cb70f307` came back `CORRECTION_REQUIRED` from a fresh independent QA:
12 source rows passed, 3 BLOCKING findings, all in one edit scope. This section is additive.
Nothing above it is rewritten; where this round supersedes an earlier claim, the earlier
claim is named and kept.

**Root cause of all three.** One sentence, on one row, tried to be a breakdown and a summary
at once. The per-subject clause repeated its verb once per subject, the overflow was written
twice in two vocabularies, and the row-2 word count was asserted only in a layout note that
no gate could decide — so nothing stopped the row growing past the row it replaced.

## The instrument, settled once and for all

Three instruments were tried on the same row. They disagree, and the note adopted the one
that cannot flatter the candidate:

| instrument | BEFORE words |
| --- | --- |
| collapse across element boundaries (the layout note's original method; also how QA's B1 table reads) | 24 |
| QA's rendered measurement, as reported in the finding | 19 |
| **every rendered text run counted as its own words — ADOPTED** | **30** |

The adopted instrument treats an **element boundary as a word boundary**. JSDOM's
`textContent` glues adjacent nodes with no whitespace, so `12 Sept roster` + `+3 more` +
`Cover these classes` came back as `roster+3` and `moreCover` — two tokens for four words.
A row could grow by two words and the count would not move, which is a control that cannot
discriminate. Hover text is not in the DOM (Radix does not render closed tooltip content),
so nothing needed filtering; the repair queue's own `data-testid="teaching-load-repair-status"`
span **is** counted, because it is visible text on the chip.

Consequence for this record: **QA's 19 and this note's 30 are not in conflict.** They are
two instruments. The rule defended is "the after must not be larger", so the bound that can
only over-report is the one that decides it.

## B1 — subtract-first failed on the rendered row. FIXED.

**Measured, on the adopted instrument, on the same fixture, before and after this round:**

| state | pre-correction (`cb70f307`) | after (this commit) | the 30-word row it replaces |
| --- | --- | --- | --- |
| 0 subjects | 30 | **30** | 30 (the base row, untouched) |
| 1 subject | 13 | **12** | — |
| 2 subjects | 20 | **14** | — |
| 3 subjects (the cap) | 27 | **16** | — |
| 4 subjects (cap + overflow) | 33 | **18** | — |
| 6 subjects (widest) | 33 | **18** | — |

Rendered AFTER, widest: `19 classes short: MAPEH 9, English 4, Fil 2 · 12 Sept roster +3 more
Cover these classes`. The pre-correction column was measured by temporarily reinstating the
superseded sentence shape in the model, running the committed control, and restoring the
bytes — so it is a rendered measurement of `cb70f307` on this fixture, not an estimate.

**What was changed**

- `teachingLoadOutage.ts:165` — `shortageClauseFor` (which returned
  `MAPEH: 9 classes need a teacher`) is superseded by `shortageEntryLabel`
  (`MAPEH 9`). The verb is now paid for **once**.
- `teachingLoadOutage.ts:227-259` — `buildShortageLineModel` takes a required
  `totalShortClasses` and builds `N classes short: {subject} {n}, …` plus ` · {date}`.
  The head clause is the **workspace** figure, not the sum of the subjects the cap had room
  to name: with the cap at three the named figures cannot sum to the total, so a row of
  per-subject counts alone would understate the outage by exactly the part it cannot show.
- `useTeachingLoadOutage.ts:118` — passes the workspace total through.
- `useCoverShortage.ts` production behaviour is **unchanged**.

**What was NOT done, deliberately.** Neither of the two figures the packet forbids deleting
was touched: every named subject still carries its own figure, and `12 Sept roster` is still
on the row. `A6C5-WORD-2` fails if either is ever bought out of the budget. What went is the
per-subject repetition of one verb, the workspace-wide clause the row-2 sentence already
replaced with a per-subject breakdown, and the duplicate overflow clause (B2).

**The control, committed** — `a6-c5-outage-derivation.test.tsx`, `A6C5-WORD-1`: renders the
real `WorkspaceToolbar` with the real `TeachingLoadOutageSurface` in `shortageLineSlot` and
the real `TeachingLoadRepairQueue` (through the real hook) in `stateLineSlot`, across six
states, and fails if any shortage state exceeds **19** or exceeds the **30-word** BEFORE.
`A6C5-WORD-2` then fails if the per-subject figures or the data date are gone. Both are
reachable from `npm run test:a6-c5-outage`.

**One scope statement, stated rather than hidden.** The 19-word budget is asserted only for
states this slice renders. The **zero-subject** state is measured against the BEFORE
(30 against 30) instead, because in that state the row is the base row — `% staffed`, the
alert chip, the `missing-load` next step — which `a6-c10`/`a6-c2`/`a3-c10` pin and which this
slice has no authority to rewrite. Asserting ≤19 there would be a claim about another slice's
sentence. B3 asked the control to *cover* the zero-subject state; it does, under the rule
that actually governs it.

## B2 — the overflow fact was stated twice. FIXED.

At the reviewed tip `cb70f307`, `teachingLoadOutage.ts:203` pushed `N more subject(s)` into
`line.text`, while `TeachingLoadShortageLine.tsx:90` rendered a separate `+N more` control
beside it.

**Deleted:** the sentence's `N more subject(s)` clause. The sentence no longer mentions the
overflow in any wording.

**Kept:** the `+N more` control — it is the one with a real target (the existing coverage
detail), and a count you can press is worth more than a count you cannot. Its hover
(`moreLabel`) now says what it OPENS — `Open the coverage detail for every class still
open.` — instead of repeating how many subjects it hides, and the control gained an
`aria-label` that starts with its visible text, because `+2 more` alone named nothing for a
screen-reader user.

`A6C5-S2-3` is the new control: it asserts the sentence matches **no** overflow wording
(`/more|others|remaining|hidden/i`, so a prose variant fails too), that the control still
states the count (neither duplicated nor dropped), and that the hover and the accessible name
carry the destination rather than a second copy of the number.

## B3 — the layout note was not a truthful record. FIXED.

`docs/reviews/a6-c5-outage-placeholders/layout-note.md`:

- **Every figure corrected to a measured value.** BEFORE 24 → **30**; AFTER 23 → **18**;
  one subject 20 → **12**; "26 widest" → **18**; the `missing-load` subtraction "14 of 24" →
  **18 of 30**. Each superseded figure is recorded in place with the reason, not deleted.
- **The missing control added, not merely the claim deleted.** `A6C5-WORD-1` and
  `A6C5-WORD-2` now exist and are the thing that decides row 2's length. The note no longer
  attributes a measurement to a control that was not there.
- **The instrument section corrected** with the three-way table above and the reason the
  upper bound was chosen.
- **The S9 page-level note added to the ledger.** `teaching-load-still-need-real-teacher`
  (`pages/TeachingLoad.tsx:817`) is now in the MOVES section with where it sits — first line
  of the main column, below the strip, above the roster, `text-muted-foreground`, `hidden`
  below 640px, deliberately **not** a `shrink-0` band because `a3-c10` T4 allows the main
  column exactly one — and why it is there: it is the one statement of the count that reaches
  a scheduler who never opens a dialog, and it is deliberately NOT on row 2, because putting
  the workspace figure on row 2 as well is the duplicate-vocabulary defect again. It is also
  what let the row-2 budget be met without deleting the total.

## In-scope extras — both FIXED

1. **`a6-c5-outage-derivation.test.tsx:404` at `cb70f307` was vacuous.** It asserted
   `body.schoolId === 1` against a fixture whose school IS 1, so a hard-coded school-1
   default passed it identically. Re-based as **`A6C5-S4-2`** (school **7**, year **42** —
   values no default in this client could produce) and **`A6C5-S4-3`** (no scope → the
   endpoint is **never called**, the refusal is stated in words, and the primary action stays
   disabled). The original assertion is left in place inside `A6C5-S4-1` with a comment
   marking it superseded — it still holds, and deleting it would have removed evidence.
2. **`useCoverShortage.ts`'s comment overclaimed.** It said "a committed negative control
   forbids that literal anywhere on this page"; the control did not scan this file. Rather
   than weaken the claim, `../../hooks/useCoverShortage.ts` was **added to
   `TL_POLICY_FREE_FILES`** in `teaching-load-canonical-workload.test.ts`, so the school-1
   control now reads the one file that builds the request body. **Evidence it is
   load-bearing:** the control failed the moment the file was added, on the very
   `DEFAULT_SCHOOL_ID` token this comment used to quote — a comment may not name the
   constant, because a comment is indistinguishable from a call site to a source scan. The
   comment now says "a school-1 default" and describes both gates. Production behaviour is
   unchanged.

## Literal gate tallies

| gate | result |
| --- | --- |
| `npx tsc --noEmit` (atlas-client) | **5 errors**, the base's 5, all in other lanes' timetable test files: `timetable-post-deploy-c04.test.ts`, `timetable-post-deploy-c05.test.ts`, `timetable-scheduling-quality-c03.test.tsx` (×2), `timetable-truth-labels-a2.test.ts` |
| `npm run test:a6-c5-outage` | tests 23 / pass 23 / fail 0 |
| `npm run test:a6-teaching-load` | tests 29 / pass 29 / fail 0 |
| `npm run test:a6-tl-header-budget` | tests 9 / pass 9 / fail 0 |
| `npm run test:tl-no-demand-hotfix` | tests 5 / pass 5 / fail 0 |
| `npm run test:a3-c10-tl-density` | tests 9 / pass 9 / fail 0 |
| `npm run test:a3-teachers-load` | tests 49 / pass 43 / fail 0 / skipped 6 |
| `npm run test:client-quality` | tests 34 / pass 34 / fail 0 |
| `npm run test:ux-guardrails` | tests 31 / pass 31 / fail 0 |
| `npx tsx --test src/lib/__tests__/teaching-load-canonical-workload.test.ts` (the file this round edits) | tests 33 / pass 33 / fail 0 |

`test:a3-teachers-load` skips 6 on base as well; no test was removed, skipped or weakened by
this round. `test:a6-c5-outage` went from 19 to 23 tests: `A6C5-S2-3`, `A6C5-S4-2`,
`A6C5-S4-3`, `A6C5-WORD-1`, `A6C5-WORD-2` are added, and none was deleted.

## Re-scoped rows, recorded as follow-ups

- **S11 — NOT DONE, re-scoped.** QA ruled the roster fetch and the zero-load derivation are
  **A9's clause**, not c5's: A9 removes non-teaching personnel at fetch, so the roster
  reaching Teaching Load already excludes them and c5 must not build a "Needs a department"
  cue for records that must not exist. The existing `A6C5-S11-1` row already asserts the
  absence of that affordance across all six outage files and is untouched. **Follow-up:**
  confirm on staging that no non-teaching personnel reaches Teaching Load after A9 lands.
- **S12 — NOT DONE, re-scoped; the packet row was defective.** QA ruled the candidate's tsc
  **parity with base** (5 errors, 5 errors) is the correct reading and the packet's row as
  written ("exit 0") is not satisfiable without another lane's `playwright` dependency and a
  timetable truth-label fix — neither of which c5 may touch. **Follow-up:** the two
  timetable-lane defects (`playwright` types in three test files; the `timetable-truth-labels-a2`
  type comparison) belong to the timetable lane, not to c5. Nothing was "fixed" to make the
  row read green.

## Follow-up rows recorded, not done

- **No `applyingRef` in-flight guard** on the cover dialog's apply — unchanged from round 0
  (QA left it as a follow-up; it is a concurrency guard, not a word-budget or duplication
  defect, and is out of this round's scope).
- **The dead-but-harmless `onReviewAgain` export** — unchanged from round 0.
- **The roster fetch and the zero-load derivation** — A9's clause (S11 above).
- **The two unrendered S7 surfaces** (`SectionGridMode`, `AutoFillSummaryModal`) are still
  wiring-proved; the browser lane must see them. Unchanged and still open.
- **A multi-word subject name would add a token per named subject.** The 19-word budget is
  proved for the declared fixture, whose subject names are single tokens. The cap of three
  is what bounds how many times that can happen, so the cap — not the number — is the real
  guarantee. Stated in the note rather than left for a reviewer to discover.

## Risks

- **NON_BLOCKING — the 19-word budget sits one word under the measured widest (18).** Held
  deliberately so a later copy edit does not immediately fail the control. If a reviewer
  prefers zero headroom, 18 is the number that fails.
- **NON_BLOCKING — the three instruments disagree (19 / 24 / 30).** Recorded, with the reason
  for adopting the upper bound, so a reviewer comparing this handoff with QA's B1 table is not
  reading a contradiction.
- **NON_BLOCKING — `67% staffed` in the measured BEFORE is this candidate's corrected figure;
  the row this slice replaced read `89% staffed`.** One token differs, so 30 is the count for
  both, and the note says so.
- **NON_BLOCKING — the word-budget control is a JSDOM count.** It measures rendered text, not
  pixels. The 1366px fit stays with `a6-tl-header-budget` and the visual lane, exactly as
  before this round.
- **BLOCKING — none outstanding.**

## Verdict

**REVIEW_REQUIRED.** B1, B2, B3 and both in-scope extras are fixed, the row-2 budget is now
decided by a committed control on an instrument that cannot flatter the candidate, the two
vacuous claims (the school-id assertion, the hook's comment) are replaced by controls that
discriminate, and the two re-scoped rows are recorded as follow-ups with QA's reason instead
of being quietly satisfied. Two things a reviewer should judge rather than take from me: the
one word of headroom under the budget, and the S11/S12 re-scoping — c5 did not touch them
because QA ruled the packet rows defective, not because they are hard.
