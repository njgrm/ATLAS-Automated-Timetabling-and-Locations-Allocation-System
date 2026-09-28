# Packet A2-C6-TRUTH — Planner A2, 2026-09-28 10:00 +08 (executor packet)

Worktree: `E:\ATLAS-worktrees\lane-a2-c6-truth`, branch `work/a2-c6-truth`, base `4adc9f2f`.
Risk tier: **MEDIUM** (client production wiring + cross-surface copy). One executor, then one fresh
independent QA, then planner integration. **No deploy, no generation, no publication, no live-data
write is in scope.** Every row below is a *source* row; each names the harness that decides it.

## The defect class this packet exists to close

**A surface that states something false about the schedule.** Measured live on `a1db27d5`,
`https://njgrm.buru-degree.ts.net`, 2026-09-28 01:46–01:53Z, draft run **321** (`version 5 → 6`).
Do not "fix the wording" where the underlying read is wrong; a reword over a wrong number is the
defect. Lane C's rule from the 2026-09-27 00:10 entry: *a clear screen that says the wrong thing is
the worst case for older users.* That is the rule of this packet.

## T1 — a term change erases the schedule history and never refetches it (HIGH, truthfulness)

Reproduced, not inferred. With run 321 loaded in Term 2:

| step | observed |
|---|---|
| fresh load, Term 2 | `Schedule history (4)` — correct |
| switch Term 2 → Term 3 | `Schedule history` / "Nothing to show yet: no class has been moved, swapped or given a new room in this schedule." |
| switch Term 3 → Term 2 (back) | **still** the same empty string — the 4 rows do **not** come back |

The server is correct: `GET /api/v1/generation/1/10/runs/321/manual-edits` returned
`{"edits":[…4 rows…],"count":4}` on the same load. `listManualEdits`
(`atlas-server/src/services/manual-edit.service.ts:1938-1965`) filters only on
`runId/schoolId/schoolYearId` — the four rows are `school_id 1`, `school_year_id 10`, `run_id 321`,
so there is no server-side reason for an empty list.

Mechanism, named: `handleTermFilterChange` calls `resetTermScopedUiRef.current()`
(`atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts:813-827`), which is
`resetRunScopedUi` (`:1249-1297`) and which does `setEditHistory([])` at `:1295`. The only refill is
the effect at `:2002-2005`, `useEffect(() => { fetchEditHistory(); }, [fetchEditHistory])`, and
`fetchEditHistory` (`atlas-client/src/hooks/useTimetableMutations.ts:985-995`) is memoised on
`apiBase`, which is keyed on the **run**, not the term. So a term change clears the ledger and
nothing re-reads it. `handleRunChange` (`:1320-1333`) has the same shape: it resets and calls
`fetchRunData` but never `fetchEditHistory`.

**Required:** the history must be correct after any term change, on the way back as well as on the
way out, and the empty state must never assert a falsehood.

- **T1a** — after a term change the history is refetched, not just cleared. Scope the fix to the
  **run ledger only**; do not resurrect a term-scoped undo affordance (`:820-826` clears it
  deliberately and that decision stands).
- **T1b (truthfulness, the part that must not be skipped)** — while the read is in flight the entry
  must not claim "no class has been moved…". Say the history is loading, or say what is known. The
  current sentence is a **false claim about a run that has four such changes**; the fix is that it
  must never be able to print that sentence unless the server really returned zero rows.
- **T1c** — `fetchEditHistory`'s `catch { // ignore }` swallows every failure and returns `[]`.
  A failed read must not be indistinguishable from an empty run. At minimum, surface it. Do not
  change the return type unless you update all 8 call sites.
- **T1d** — `handleRunChange` must refill the ledger too (same shape, same reason).

**Failing-first, mandatory:** a test that mounts the workspace state, drives a real term change, and
fails at base with `editHistoryCount === 0` while the run ledger has 4 rows. A test that asserts
only "the effect is called" proves wiring, not outcome — c5's reviewer caught exactly that
("`AnimatePresence` deleted and the row still passed").

## T2 — an auto-move is recorded but never shown (HIGH, truthfulness)

`manual_schedule_edits` **id 12** (2026-09-27 12:50:29Z, actor 46, run 321, `SWAP_ENTRIES`):

```
before: entryA entry-1::t2  MONDAY 06:00–06:45   entryB entry-221::t2 MONDAY 06:45–07:30
after:  entryA entry-1::t2  MONDAY 12:15–13:00   entryB entry-221::t2 MONDAY 06:45–07:30
        strategy: AUTO_FIX_MOVE_SOURCE
```

A class was displaced three hours down the day. On screen it was invisible **in all three
surfaces**:

1. **the grid** — GR7 - Luna Term 2 Monday 6:00 rendered **empty** (Tue–Fri showed
   `TLE P. CRUZ · Room 103 · G7AW`), and the displaced TLE at 12:15 rendered as `Lunch Break` — the
   fixed band — so the class was not visible anywhere on the day at all;
2. **the history row** — measured on the live dialog, that row reads exactly
   `Swapped two classes · 9/27/2026, 8:50:29 PM`. The auto-move is **not mentioned**, and the
   strategy that caused it is in `after_payload.strategy` where no user can reach it;
3. **the preview** — the preview named the two-class swap; only the post-commit toast admitted the
   move. This was Lane C's filed finding on 2026-09-26 23:05 and it is **still open**.

The user's control said "swap these two" and the schedule lost a class. **Required:**

- **T2a** — a history row for a swap that carried an auto-move **must name the move that happened**,
  in the same plain words the toast used, with no id. A `SWAP_ENTRIES` row whose
  `after_payload.strategy` is `AUTO_FIX_MOVE_BLOCKING` / `AUTO_FIX_MOVE_SOURCE` and whose
  `entryA`/`entryB` no longer sit at their `before_payload` slots is a **three-session** change and
  must read as one. Reuse the existing `undoneEditLabel` precedent (`TimetableAssignmentDialogs.tsx:46`)
  — this is the same shape as the "Undid: …" row.
- **T2b** — the swap **preview** must show the exact auto-move target before commit, or the commit
  control stays disabled. `SwapPreviewResult` already carries `autoFixBlockingTarget` and
  `recommendedStrategy` (`manual-edit.service.ts:1967-1974`) — check whether a source-move target is
  carried too; if it is not, the preview endpoint is the gap and say so in your handoff rather than
  papering over it in the client.
- **T2c** — the history row also reads **"Changed by a signed-in account. This record does not show
  which person."** on every row, including a row the notification for names in full. The ledger has
  `actorId`; resolve the name the same way `plain-tokens` resolves section/subject/room labels.
- **T2d** — measured on the live dialog, row 1 renders the accessible name **"Revert this edit" three
  times** (`Revert this edit Revert this edit Revert this edit`). Find and fix the duplication.

## T3 — the header states three unverified things (HIGH, truthfulness; this is c6 item 2)

All measured on the live build at 01:46Z, Simple view, run 321.

- **T3a — no run identity anywhere.** `hasRunLine: false`, `hasDraftWord: false` on `/timetable`.
  The only run-ish strings on the page are `REVIEW AND PUBLISH`, `Runs`, `Publish schedule`,
  `Latest Run`. c1 measured `Run: Run 321 · Draft` on the **previous** release `d31bfacb`, so this
  is either a regression or a surface move — **determine which from source before you change
  anything**, and record the answer. An older user must be able to say which schedule they are
  looking at and whether anyone can see it.
- **T3b — "Active Term: T2" is asserted while the authority says nothing.** The stored contract in
  the live profile is
  `{"source":"atlas-unverified","reachable":false,"verified":false,"activeTerm":null,"termIndex":null,…,"orderedTerms":[…3…],"termFormat":"TRIMESTER","termCount":3}`
  and the chip still reads `Active Term: T2`. A chip that names a term the system has not verified is
  the exact failure class of `#44` and `#57`. The truthfulness fix is a state, not a string: when
  the active term is unverified, say so and offer the ordered terms; do not invent T2.
- **T3c — the chip and the selector are two controls for one fact.** The packet's own suggestion is
  the contract: express it as one line, e.g. *Viewing Term 1 · school is in Term 2*, and when the
  active term is unknown, *Viewing Term 1 · active term not confirmed*. One fact, one place.
- **T3d — `Class Schedule` twice** (sidebar group + page heading) and the top bar. One page name.
- **T3e — the drift banner is 26 words** with `Preview impact` / `Regenerate to apply` still showing
  on a run that has not changed. Make it **≤ 12 words** or hide it when nothing changed. Preserve
  the existing #17/#59 predicate semantics: a genuine stale comparison must still alarm, and a
  neutral "has not checked" state must not claim a check that never ran. Wording only — **do not
  touch the predicate.**
- **T3f — six message rows above the grid.** Cap at 3 with a plain "and N more" line.
- **T3g — `Publish schedule` is a big red control on a draft with warnings and "1 setup item must
  be fixed first".** The control must **say why it is not ready**, in the same place, before it is
  pressed. Not a tooltip. A red disabled button whose reason is one screen away is the defect.

## T4 — the header warning count is not the run's warning count (HIGH, truthfulness; this is #62)

This is c5 §6's "most valuable unknown", now with a **third, decisive** data point. Do not repeat
the falsified payload theory — the enumeration harness at `4157f599` already refuted it
(`MUTATED BUT NOT NAMED: []`, `RESIDUAL vs PRE-SWAP (0): []`). Do not repeat my own falsified
8-hour-token theory; it is unrelated.

The measurement, all on run 321, all within ten minutes:

| when | run's stored violations | header chip |
|---|---|---|
| pre-edit, fresh load 01:46Z | **148** — edit 13's own `validationSummary.softCount` is 148, and the pre-edit `POST /manual-edits/preview` returned `softBefore: 148` | **48** |
| post-commit 01:51Z | 148 (`violationDelta` 148 → 148, hard 0 → 0) | **148** |
| fresh reload 01:52Z | 148 — `GET /runs/321/violations` returns `n = 148`, all `SOFT`, by code `FACULTY_EXCESSIVE_IDLE_GAP 97`, `FACULTY_CONSECUTIVE_LIMIT_EXCEEDED 36`, `FACULTY_FLOOR_TRANSITION 15` | **148** |

`148 − 48 = 100`. **The chip rendered 48 for a run that held 148, then rendered 148 for the same
run after an edit that changed nothing about warnings.** So the chip is not a pure function of the
stored violations and is not a per-term subset (it survives a term change). Find the actual
expression. Candidates worth testing, not asserting: a per-code de-duplication, a truncation, an
`undefined`-collapsed tally, or a merge that keeps only one term's blocks.

**Required:** one number, one meaning, and it must equal the number the run stores. `#44` is the
precedent for the rule and the reason it is cheap to state: *pick one meaning and one number.*

## Rules that bind this packet

1. **A test that only asserts source text is not evidence.** Every row above needs a rendered or
   returned value, and every new/changed test file must be reachable from a committed
   `package.json` script in the same commit. A test no gate runs is not evidence.
2. **Failing-first, byte-exact restore.** Prove each row fails at base, then restore every mutated
   file byte-for-byte. `git status --short` must be empty except your intended changes, and
   `git stash list` and the reflog must show nothing.
3. **No React component file above 1000 physical lines.** `TimetableGrid.tsx` was at exactly 1000
   and had to be extracted, not inlined. Extract before you continue.
4. **No native `<select>`, no raw `<button>`, no `<details>`/`title`.** `@/ui` primitives only.
5. **Do not touch `atlas-server/` production behaviour in this packet.** Every defect above is
   client-side or is a *reporting* gap. If you conclude a server change is required (T2b is the
   live candidate), **stop, do not make it, and name it in your handoff.** One comment-only server
   change already ships in this release range; do not add a second.
6. **No test removal.** Corrections are additive. If a committed test pins wrong behaviour, correct
   it additively and mark the old row `SUPERSEDED` beside the replacement — never delete it.
7. **Commit candidate(s) on `work/a2-c6-truth`.** Never `main`. Do not deploy, generate, publish,
   migrate, or write to the live database.
8. Report a real `passed / blocked / unperformed` tally. A mandatory row is never "not applicable":
   run it, or report it blocked or unperformed with the reason.

## Handoff (one page, no transcripts)

Base SHA · candidate SHA · exact changed paths · per-row result T1a…T4 with the deciding value for
each · the failing-first evidence · residual risks marked `BLOCKING` / `NON_BLOCKING` · the answer
to T3a's regression-or-move question · anything you deliberately did not do and why.
