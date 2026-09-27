# Handoff — Planner A2 → next session (2026-09-27, ~06:30 +08)

**Read this first. The candidate queue was re-scoped in the last hour and is NOT what an earlier session would
tell you.** Read §1 and §2 before dispatching anything.

## 1. The single question Lane C asked me, answered

Lane C's finding **#64** (HIGH, truthfulness) on `docs/reviews/timetable-manual-controls-20260926/findings.md`:

> The undone swap still offers "Revert this edit". Its undo row already says "Undid: Swapped two sessions",
> yet the swap row keeps the button while both header Undos say "nothing left to undo". **Either it is dead
> (a 409) or it re-reverts. Not clicked; A2 to say which, then hide it or say why it is off.**

**Answer: it is DEAD — a guaranteed 409. It cannot re-revert.** From source, no browser needed:

- `revertLastEdit` selects its target with `editType: { not: 'REVERT' }` (`manual-edit.service.ts:1675`), so a
  `REVERT` row can never be the target.
- `assertUndoHead` throws `UndoConflictError` when `requestedOperationId !== headOperationId`
  (`timetable-undo-contract.ts:22`). The `headEdit` query at `:1676` has **no** `editType` filter, so after a
  revert **the head IS the `REVERT` row** and the swap row's id no longer matches.
- `priorRevert` is also queried at `:1674`, so `alreadyReverted` is a second, independent trigger.

**And it was no longer a *false-cause* defect:** `70ada9e2` (live in `c5a9e832`) unified every `UNDO_CONFLICT` onto
one honest message, so clicking it says what happened instead of "the schedule changed".

**#64 is now CLOSED — `a33680ae`, merge `d924f88b`, QA `ACCEPT_READY` 14/14/0/0.** ~~An **enabled** control that can
only fail is the same misleading-affordance class~~ → the control was in fact **`disabled`**, and the real defect was
the **misleading reason**: *"Only the latest edit can be reverted"* tells a scheduler to wait for a newer edit when
the truth is **never again**. That is worse than a dead button. The fix derives "undone" from **the server's own
refusal test** — a `REVERT` row in the already-fetched history naming this row — with **no server change**, and
replaces the control with a stated reason.


## 2. Re-scoped queue — read §1 first; one item is now CLOSED and one is now REFUTED

| # | Item | Severity | Status |
|---|---|---|---|
| ~~1~~ | **#64** — the undone swap row offered a dead "Revert this edit" | HIGH | ✅ **CLOSED** — `a33680ae`, merge `d924f88b`, QA `ACCEPT_READY` 14/14/0/0 |
| 2 | **#61** — a concurrent commit lands mid-action with **engineer ids** and no re-sync: the toast read *"Manual swap committed between entries entry-321::t2 and entry-421::t2"*, the grid changed under the operator, and **the selection banner stayed armed on a class that had just moved**. Must name what changed in words, and cancel or re-check a selection whose class moved. | HIGH | **Unfixed. Next candidate.** It was **my** swap that landed under Lane C's runner. |
| 3 | **#63** — two Undo buttons on one Expert screen, same accessible name, same reason | MEDIUM | Unfixed, behind #61 |
| 4 | **The 159 → 68 → 69 discrepancy** | CORRECTION_REQUIRED | **OPEN, and now mechanism-UNKNOWN** |

**Item 4 changed materially — do not re-run the old theory.** I published that the cause was the auto-move falling
outside the recorded pair. **That is falsified.** `npm run test:timetable-swap-revert-enumeration-a2` (committed at
`4157f599`) reports **`MUTATED BUT NOT NAMED: []`** and **`RESIDUAL vs PRE-SWAP (0): []`** in all five strategies —
the payload names every mutated entry and the revert round-trips the entry set exactly. Fresh QA re-ran it
independently and agreed. The entry set round-trips, so live candidates are things like a warning count that is not
a pure function of entry slots, or a derived/aggregated value. **A lead is wanted over silence; I have already
published one wrong explanation about it.**

## 2b. #64 — the answer, and the correction to my own packet

Lane C left the question open in the finding: *"Either it is dead (a 409) or it re-reverts. Not clicked; A2 to say
which."* **It is dead — a guaranteed 409** (`editType: { not: 'REVERT' }` at `manual-edit.service.ts:1675`;
`assertUndoHead` at `timetable-undo-contract.ts:22`; the `headEdit` query at `:1676` has **no** `editType` filter,
so the head after a revert **is** the `REVERT` row; `priorRevert` at `:1674` is a second trigger).

**I asserted the control was "enabled". It renders `disabled`** — Lane C's committed source trace said so, and QA
reproduced it against the real base component. My single browser read raced a history refetch. The real defect was
the **reason**, whose tooltip said *"Only the latest edit can be reverted"* — telling a scheduler to wait for a
newer edit when the truth is never again.

**The fix's key property, worth keeping in mind for similar predicates:** QA showed the wrong-direction failure is
**structurally impossible**, not merely unlikely. A row named by a later row can never be the head, so the
predicate can only remove a control the head check had already disabled. If you extend this pattern, look for an
equivalent structural argument rather than relying on bounds.


## 3. State

- **Live `c5a9e8321756ee59c7795786417f6449831ecda3`**, dir `E:\ATLAS-worktrees\lane-a2-release-c5a9e832`.
  5001 → PID 43192, 5174 → PID 43744. Rollback basis `d11304e8` (Lane A3's release, verified startable).
- `origin/main` is moving; A3 and Lane C are merging docs continuously. **Fetch and fast-forward before editing.**
- **A browser session is now available** (`space-bunny/opencode-default`, operator/QA actor). It was absent for
  five cycles and cleared at ~05:46. **Note the collision** — Lane C's runner and mine shared the profile, and #61
  is the direct result. One agent per browser profile at a time (`AGENTS.md` §12).
- **Draft run 321 is at 69 warnings, not the 159 it started at** (my swap+revert was net-non-neutral). The
  **published run 320 and the whole public surface are untouched** — 09-26 → 200 run 319, 09-27 → 200 run 320,
  895 entries each, no 409. **Restoring the draft needs a regeneration (HIGH) or a corrective edit — that decision
  is still owed and was not taken.**

## 4. What is already closed — do not redo

- **Publish-date resolver** `8bf4b415` + `f72b8df9` — live and re-verified after A3's release superseded it.
  Every published date resolves to the publication in force on it; `servedByFallback` is truthful.
- **Swap custody** `e51388c1`, **swap label/icon** `dff85db4`, **edit-history truthfulness** `9bfe0cd6`,
  **Redo truthfulness** `70ada9e2` — all live in `c5a9e832`, all QA-accepted with zero blocking findings.
- **All browser acceptance rows are performed.** Evidence + screenshots at
  `docs/reviews/a2-browser-acceptance-c5a9e832/`. Notably *Change room on MAPEH passes* — the row I twice
  flagged as most likely to be wrongly closed.

## 5. The process correction I had to make — read it before you hold anything

I held a deploy across **three consecutive cycles** to avoid adding unperformed browser rows. **That was
over-conservative and I reversed it.** The rows are a *bookkeeping* cost; the five falsehoods the hold kept live
were a *product* cost paid by real operators. The rule I landed on and recorded in `docs/plans/live-state.md`:

> **Bookkeeping debt is not a reason to keep operator-facing falsehoods live. A missing session is a blocker on
> the rows, never a reason to withhold the fixes.**

Do not repeat the hold. If a visual acceptance row cannot be run, say so and ship the fix.

## 6. Baselines — compare by failing NAME, never count

- **Server `test:server-suite`: 5 failing files** — `tt-source-freshness-generation-c04`,
  `tt-source-freshness-quick-place-c04`, `tt-source-freshness-sync-pin-c04` (all on the **A3 term-authority**
  condition), `tt-warning-realism-c07a`, `teaching-load-suggestion-derived-demand-c03r2`.
- **Client `test:client-suite`: 12 pre-existing failures**; typecheck **exactly 4** (3x TS2307 `playwright`,
  1 TS7006). `test:a2-timetable-custody` **36/36**, `test:timetable-swap-custody-a2` **11/11**.
- **Coverage — pin which reading you quote.** At `70ada9e2`: **146** test files on disk, **146** named by a
  committed script, **117** in the `test:client-suite` aggregate, **29** omitted from that aggregate, **0
  unreachable, 0 phantom**. "29 omitted from the aggregate" and "0 unreachable" are **opposite conclusions**.

## 7. Traps that have cost real time here

- **`schtasks /change /tr` fails** on a path containing spaces — use the task-XML export/replace/re-register
  route, and replace **both** `<Arguments>` and `<WorkingDirectory>`.
- **Ending the scheduled task quiesces the whole tree**; an out-of-process `cli.mjs stop` does not.
- **`cli.mjs status` reports `"live": false` structurally** (`supervisor.mjs:401` reads an in-process map). Never
  read a deploy failure out of it. The state file's `state`/`ownedPids`/`releaseSha` **are** trustworthy.
- **Never read runtime identity from `Env:`** — machine scope + task action + listeners, always.
- **`index.html` and `dist/server.js` are invalid deploy discriminators.** Use a lazy chunk; each glob must match
  exactly one file whose name differs from live, and a returning live name is a **FAIL**.
- **`git add` on a CRLF file emits a warning that can swallow a compound command** in PowerShell — stage in its
  own command, verify with `git diff --cached --name-only`.
- **PowerShell 5.1 mangles UTF-8 on read** — a clean file showed as `U+FFFD` through `Get-Content`. Verify
  encoding with `node` before believing a corruption.
