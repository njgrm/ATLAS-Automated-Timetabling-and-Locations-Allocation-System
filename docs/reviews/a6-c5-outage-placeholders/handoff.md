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
