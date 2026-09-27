# Handoff — Planner A2 → fresh session (2026-09-27 ~13:20 +08)

**Read §0 first. This session was cut short on context, not on work.** There is **uncommitted work in the lane
worktree** — see §5, assess it, do not adopt or discard it blind.

---

## 0. Thirty-second orientation

- **Live: `c5a9e832`**, healthy. **Nothing is deployed from the last several hours of work.**
- **A finished, verified release is sitting on disk, blocked only by the absence of an elevated shell:**
  `E:\ATLAS-worktrees\lane-a2-release-9b28c572` at `9b28c572`. Both discriminators already proved non-vacuously.
- **One decision is owed and was not taken:** draft run 321 is at **69 warnings, not the 159 it started at.**
- The queue is small and specific (§3). Two hypotheses have been **tested and refuted** — do not re-run them (§4).

---

## 1. Live state (verified at handover)

| | |
|---|---|
| Live release | `c5a9e8321756ee59c7795786417f6449831ecda3` |
| Live dir | `E:\ATLAS-worktrees\lane-a2-release-c5a9e832` |
| Listeners | 5001 → **43192**, 5174 → **43744** |
| Health | `/health/ready` **ready**, `database: ok`; DB-backed `/subjects?schoolId=1` 200 (19 453 B) |
| Public schedule | `?date=` 09-20 → run 315, 09-25 → 317, **09-26 → 319 (fallback true)**, 09-27/28 → 320 head. **No 409 anywhere.** |
| Rollback basis for `9b28c572` | the `c5a9e832` dir — present, HEAD `c5a9e832`, clean, both dists built, real non-junction `node_modules` |
| `origin/main` | `91a92fd9` |
| Capacity | E: ~42.9 GiB, D: ~39.4 GiB — both clear the 25 GiB warn / 15 GiB fail-closed lines |
| Elevation in this session | **`False`** — machine-scope writes throw *"Requested registry access is not allowed."* |

**A3 has merged nothing new** as of `91a92fd9`; there is nothing to merge from any side.

---

## 2. Integrated, reviewed, and **NOT deployed**

All of this is on `origin/main` and **none of it is live**. It ships with the `9b28c572` cutover.

| Commit | Merge | QA | What it fixes |
|---|---|---|---|
| `e51388c1` | — | `ACCEPT_READY` 41/41 | Swap committed ≠ preview; revert restored nothing (live in `b0736007`, superseded) |
| `8bf4b415` + `f72b8df9` | `51563739` | `CORRECTION_REQUIRED` 35/37 → `ACCEPT_READY` 14/14 | **Public schedule 409 for every date before its effective date** (live via `d11304e8`/`b0736007`, re-verified live twice) |
| `dff85db4` | — | `ACCEPT_READY` 27/27 | Commit button said "Swap sessions" while relocating a class; auto-move row had no icon |
| `9bfe0cd6` | `38e540d4` | `ACCEPT_READY` 22/22 | `REVERT` row named no edit, showed a fabricated `warnings: 0`, offered an enabled guaranteed-409 "Revert this edit" |
| `70ada9e2` | `aa13a0fd` | `ACCEPT_READY` 19/19 | Redo broken on **every** revert, reporting a false "schedule changed" |
| `a33680ae` | `d924f88b` | `ACCEPT_READY` 14/14 | **#64** — an undone swap row offered a dead Revert, disabled but with a tooltip saying *"wait for a newer edit"* when the truth is never |
| `0e79c87c` + `2029f6d1` | `5ada3763` | `CORRECTION_REQUIRED` 15/16 → `ACCEPT_READY` 14/15 | **#61** — a concurrent commit named **engineer ids**; the grid changed with no re-sync; the **selection stayed armed on a class that had moved** |

**A3's contribution, also undeployed, independently reviewed by their reviewer
`ses_f1f5aac59ffeverXxPOh9j8oVT` (`CORRECTION_REQUIRED` 25/26/0/1, blocking finding corrected in `97ee76e9`):** 6
client paths — the Konva `lineHeight` fix on `room.name` (13 was passed as a **multiplier**, not a ratio, so names
truncated to `"Learning."` and drew 71.5 units below their card) and the Teaching Load Next Step banner's dead
control.

---

## 3. The queue, in order

### 3a. Finish the `9b28c572` deploy — needs an ELEVATED shell

Packet: `docs/prompts/a2-release-9b28c572-2026-09-27.md` (rev with all three review corrections, **committed** at
`aa097043`, plus an EXECUTION RECORD section). Pre-action review: **`PRE_ACTION_CLEAR` 11/14 passed, 0 blocked, 2
unperformed**, after one `CORRECTION_REQUIRED` 19/24 whose three blocking findings were **all packet-document**
defects. The source range needed no change.

**Already done and needing no redo:** the release dir is created, both builds are clean, and **both discriminators
proved non-vacuously** —
- server: `atlas-server/dist/services/timetable-edit-message.js` **absent from the live build, present in the new
  one**; `manual-edit.service.js` differs by hash;
- client: `ScheduleReviewWorkspace` glob matched **exactly one** file each side (`-dY-BJ1Wl` 442 KiB → `-C4bvatRP`
  445 KiB), and the `ALREADY_UNDONE_EDIT_MESSAGE` literal is **present in the new chunk, absent from the live one**.

**Remaining, all elevation-gated:** end the scheduled task → re-point the task XML → write the two machine-scope
values → start → D1–D8 → browser D9–D12.

**Re-derive the baselines at cutover time — do NOT reuse the recorded numbers.** The record captured
`generation_runs 9, manual_schedule_edits 7, audit_logs 444, published_schedule_revisions 6` in window
`2026-09-27T05:03:28.911Z` with `authorisedActorIds {46}`. **`manual_schedule_edits` was 7, not the 5 in earlier
records, because a concurrent lane is actively editing the draft.** The window is the authority, not the number.

**D10 is load-bearing and gated:** before committing any swap, confirm **authenticated** that the run you are about
to mutate is a **draft**. Run 320 is published (`currentPublishedRunId: 320` on every public response). **If the draft
is not the run you expect, D10 becomes a published-run mutation and is out of bounds — stop and report.** Record the
pre-swap warning count, commit, record the post-swap count and the audit id, **do not revert**.

**D9–D12 are browser rows and a session is available** (`space-bunny/opencode-default`), so they are performable —
but that profile is **shared with a concurrent lane**; one agent at a time (§12), and that collision is exactly how
finding #61 surfaced.

### 3b. The uncommitted work in the lane worktree — ASSESS IT, do not trust it

See §5. It is a plausible, partly-complete implementation of queue items **#63** and **`strategy` validation**. It has
never been reviewed, and it is **not committed**.

### 3c. Still open, none blocking

- **#63 (MEDIUM)** — two Undo controls on one Expert screen sharing one accessible name and the same reason.
  Lane C's instruction: **keep the toolbar one.** (The uncommitted work appears to touch this.)
- **`strategy` wire validation (server)** — the router passes `req.body.strategy` unvalidated, and the new
  notification message guard is **exclusion-based**, so an unknown strategy commits as a plain swap and the message
  then **falsely claims a relocation**. Needs an explicit allowlist. (Also appears in the uncommitted work.)
- **The 159 → 68 → 69 warning discrepancy — OPEN, mechanism UNKNOWN.** See §4.
- **A publish-gate truthfulness defect, CONFIRMED, separate lane.** `blockingHardViolationCount` is in the edit
  path's **preserve** list (`manual-edit.service.ts:852`) so every manual edit carries the generation-time value
  forward, while `hardViolationCount` **is** recomputed; `timetableWorkspaceTruth.ts:110` **prefers the stale field**;
  the client gates publish on it (`ScheduleReviewWorkspaceHeader.tsx:467,482`) while the server recomputes
  independently (`publication-contract.service.ts:329`) and throws 422. **The two gates read different numbers.**
  Bias is toward a **false block** — it cannot cause an unsafe publication.
- **A cross-space `userId` aliasing risk (NON_BLOCKING).** `LocalAuthUser.userId` is polymorphic —
  `facultyExternalId` for a self-service faculty account, else `account.id` — and both are bare ints, so they share a
  number space in the event. A collision yields a **false "mine"**, which suppresses the concurrent-commit notice
  *and* the refresh. The fix is upstream: the server should send a namespaced identity.
- **Repo debt found and recorded:** **18 tracked files carry a committed UTF-8 BOM** (4 production:
  `RolloverGuidanceCard.tsx`, `TimetableTaskDrawer.tsx`, `generation.service.ts`, `subject.router.ts` — all
  pre-existing), and **8 committed `atlas-server/check*.cjs` / `fix_ict_seedable.cjs` scratch scripts are a live
  §2 violation** (leftover bulk-edit helpers in the repo).

### 3d. Owed and not taken

**Restore draft run 321 from 69 warnings to 159.** It needs a regeneration (**HIGH**, not authorised here) or a
corrective edit. The published run and the whole public surface were verified untouched throughout. **Decide
explicitly; do not let it drift.**

---

## 4. Two hypotheses that are TESTED AND REFUTED — do not re-run them

1. **"The swap auto-move falls outside the recorded `SWAP_ENTRIES` payload, which is why a revert does not restore
   the warning state."** **Falsified.** The enumeration harness (`4157f599`,
   `npm run test:timetable-swap-revert-enumeration-a2`) reports **`MUTATED BUT NOT NAMED: []`** and
   **`RESIDUAL vs PRE-SWAP (0): []`** in **all five** strategies: the payload *does* name every mutated entry and the
   revert *does* round-trip the entry set. Fresh QA re-ran it independently and agreed. **Struck, not deleted**, in
   `docs/reviews/a2-browser-acceptance-c5a9e832/revert-row-and-warning-state.md` and `docs/plans/live-state.md`.
2. **"The publish-gate stale-preserved counter explains the 159 → 68 → 69 drop."** **Chain confirmed, sufficiency
   rejected.** A preserved, preferred value would hold the number *stuck*, not drop it 90. For the display to fall,
   the stale field must be **absent** and the chain must fall through to the recomputed value. **The better lead:**
   the edit path recomputes via `validateHardConstraints` (`constraint-validator.ts:668-670`), which is **HARD-only,
   single-family**, while generation counted the **merged** result across families — so the two figures are **not
   comparable** across an edit or a revert. That also explains 68 → **69** on revert.

**The one correction I published that was wrong about the product:** I described the undone swap row's control as
**enabled**. It renders **`disabled`**; my browser read raced a history refetch. The real defect was the misleading
**reason**. Lane C's committed source trace was right.

---

## 5. The uncommitted work — treat as untrusted input

`E:\ATLAS-worktrees\lane-a2-timetable-custody` is at `91a92fd9` with a **dirty tree** from a dispatch that was
cancelled mid-flight. **It is my lane's own work, not another stream's**, so assessing and continuing it is in scope —
but it has had **no review at all**.

```
 M atlas-client/package.json
 M atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx        (45 +--)
 M atlas-client/src/components/timetable/TimetableAdvancedHeaderHelp.tsx          (65 +--)
 M atlas-client/src/components/timetable/__tests__/timetable-relaxed-main-b02.test.tsx   (3 --)   <-- SEE BELOW
 M atlas-client/src/components/timetable/timetableUndoRedoState.ts                (11 +-)
 M atlas-server/src/__tests__/timetable-swap-custody-a2.test.ts                  (386 ++)
 M atlas-server/src/routes/manual-edit.router.ts                                  (76 ++)
 M atlas-server/src/services/timetable-edit-message.ts                            (30 +-)
?? atlas-client/src/components/timetable/__tests__/timetable-undo-single-surface-a2.test.tsx
```

**8 files, +522 / −99, plus one new test file.**

What it appears to be doing, from reading the diffs: removing the duplicate Undo copy (the `-99` is mostly that),
adding a **typed explicit allowlist** for `SwapStrategy` at the wire boundary in `manual-edit.router.ts`, and a
`+386` block of server tests. The allowlist's own comment claims the set is **typed by** the `SwapStrategy` union so a
non-member is a **compile error**, plus an `S5` test that reads both declarations at runtime and fails on drift.
**That design is plausible and well-reasoned — but it is unverified, and I ran out of context before reviewing it.**

**Two specific things to scrutinise first:**

1. **`timetable-relaxed-main-b02.test.tsx` loses 3 lines.** §16 is explicit that corrections are **additive — never
   delete or weaken an existing assertion.** If those 3 lines are a superseded assertion, they must be **retained and
   marked superseded**, not removed. This is the first thing to check, because a subtractive correction here would
   fail review regardless of how good the rest is.
2. **The claimed compile-error coupling.** Read the actual type annotation and the `S5` test before believing the
   comment. A comment asserting a guarantee is not the guarantee.

**Also confirm:** no Lane A3-owned path was touched (the undo surfaces may live in files A3 also edits), and whether
the `strategy` **absent-vs-unknown** decision was made from the real call sites rather than assumed.

---

## 6. Baselines — compare by failing NAME, never by count

- **Client `test:client-suite`: 12 pre-existing failures** (1142 / 1130). Server typecheck **exactly 4** (3x TS2307
  `playwright`, 1 TS7006).
- **Server `test:server-suite`: 4 failing *tests*, all in ONE file** — `tt-output-c03r.test.ts`, class-program
  layout/workbook. **An earlier record of mine said "5 failing files" — that is a different unit and is wrong as
  stated.** The authoritative signal is the name set.
- `test:a2-timetable-custody` **55/55** · `test:timetable-swap-custody-a2` **11/11** (client) / **9/9** (server) ·
  `test:timetable-redo-truthfulness-a2` **20/20** · `test:ux-guardrails` **31/31**.
- **Coverage — pin which reading you quote.** At `2029f6d1`: **149 on disk, 149 named by a committed script, 117 in
  the `test:client-suite` aggregate, 0 unreachable, 0 phantom**, counted with the same walk and regex as
  `gate-reachability.test.ts`. **"117 in the aggregate" and "0 unreachable" are opposite conclusions** — say which
  you mean.

---

## 7. Traps that have cost real time on this host

- **Elevation is not guaranteed.** Two cutovers succeeded at `ADMIN=True`; the most recent session had `False` and
  machine-scope writes threw. **Check `IsInRole(Administrator)` before planning a cutover**, not at step 1.
- **`schtasks /change /tr` FAILS** on a path containing spaces. Use the XML route; capture with `cmd /c`
  redirection (**PowerShell `>` re-encodes and breaks it**); **leave `encoding="UTF-16"` unmodified**; replace the
  path in **both** `<Arguments>` and `<WorkingDirectory>`. All these steps need elevation.
- **Ending the scheduled task quiesces the whole tree**; an out-of-process `cli.mjs stop` does **not**.
- **`cli.mjs status` reports `"live": false` structurally** (`supervisor.mjs:401` reads an in-process map). Never read
  a deploy failure out of it. The state file's `state`/`ownedPids`/`releaseSha` **are** trustworthy.
- **Never read runtime identity from `Env:`** — machine scope + task action + listeners, always.
- **`index.html` and `dist/server.js` are invalid deploy discriminators.** A vacuous or guaranteed-FAIL glob is worse
  than none: it reads as a pass or halts a good deploy. Use a lazy chunk **and** a content-string assertion.
- **`git add` on a CRLF file emits a warning that can swallow a compound PowerShell command.** Stage in its own
  command and verify with `git diff --cached --name-only`.
- **A very long `git commit -m` argument can fault the CLR mid-command** (`RESULT 80004005`). It aborted a merge
  cleanly — no `MERGE_HEAD`, tree untouched — but use a message **file**.
- **PowerShell 5.1 mangles UTF-8 on read** (a clean file displayed as `U+FFFD`). Verify encoding with `node`, and
  write repository files with an explicit UTF-8 encoder and **no BOM**.
- **`git diff A..B` shows tree differences BOTH ways** and will list your own files as someone else's additions. Use
  `git log A..B --name-only`.
- **A browser profile is a single shared resource.** One agent at a time (§12).

---

## 8. The process correction — do not repeat my mistake

I held a deploy across **three consecutive cycles** to avoid adding unperformed browser rows. **That was
over-conservative and I reversed it.** The rows are a *bookkeeping* cost; the falsehoods the hold kept live were a
*product* cost paid by real operators. The rule, recorded in `docs/plans/live-state.md`:

> **Bookkeeping debt is not a reason to keep operator-facing falsehoods live. A missing session is a blocker on the
> rows, never a reason to withhold the fixes.**

The corollary, which cost me a `CORRECTION_REQUIRED`: **do not narrow a test or a docstring to make a packet look
clean.** Two of my own claims were falsified this way — a vacuous discriminator and a "no other file carries a BOM"
sweep. **Fix the guarantee or state its real scope; never shrink the assertion to fit the evidence.**

And the one that mattered most: **§13's foreign-lane enumeration is the table the operator's consent rests on.** I
quoted A3's merge message but dropped the `7 paths` line directly above the sentence I quoted, understating their
surface from 6 paths to 5 — the exact direction §13's named precedent exists to prevent. **Quote the whole artifact
and re-derive the count.**

---

## 9. Suggested first three actions

1. **Get an elevated shell** (or hand the cutover to a session that has one) and finish `9b28c572` per §3a,
   re-deriving the baselines. This is the single highest-value action: six reviewed candidates are sitting undeployed.
2. **Assess the dirty worktree** per §5 — specifically the 3-line test deletion first.
3. **Decide the draft-321 restoration** (§3d). It has been owed for a while and every session that defers it makes
   it cheaper to forget and more expensive to explain.
