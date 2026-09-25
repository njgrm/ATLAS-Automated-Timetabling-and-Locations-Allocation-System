# Handoff — `PLAIN-LANGUAGE-J2J3-C01` reconciliation, corrected, integrated

Date: 2026-09-26 (Asia/Manila) · Lane: A · Tier: MEDIUM (client presentation authority) · Verdict: **INTEGRATED**

Base `5960cfce` · reconciled merge `996b1b8b` · B1 correction `4130fd3c` · test correction `de392cf8` (now
`origin/main`). Branch `integration/plain-language-j2j3-reconcile-20260726`, worktree
`E:\ATLAS-worktrees\lane-a-j2j3-reconcile-20260726` (retired after the push).

## What happened, in order

Lane C (A2) integrated its J2 `9f232cec` + D2 `1ccdf4dd` as `4c76208d` and published a **corrected**
reconciliation map. My first integration push was rejected non-fast-forward; `996b1b8b` rebased the
reconciled J2/J3 work onto `4c76208d` under that map, resolving all 6 conflicts. Independent QA returned
`CORRECTION_REQUIRED` **18/20, blocked 0, unperformed 0** with one BLOCKING finding. `4130fd3c` fixed it.
A fresh bounded-correction QA returned **`ACCEPT_READY` 20/20, blocked 0, unperformed 0**. The integration
client suite then caught a net-new failure neither the focused gates nor the bounded review had run, fixed
additively at `de3928f8`'s sibling `de392cf8`, after which the suite matched base exactly.

## Acceptance

| Review | Verdict | Tally |
| --- | --- | --- |
| Fresh independent QA, `5960cfce…996b1b8b` | `CORRECTION_REQUIRED` | 18/20, blocked 0, unperformed 0 |
| Fresh independent QA, `996b1b8b…4130fd3c` | **`ACCEPT_READY`** | **20/20, blocked 0, unperformed 0** |

The accepting reviewer is not the implementer. QA independently reproduced both planner measurements and
proved B1 closed with a failing-first control (mutant 15/17 red → candidate 17/17).

## B1, the blocking finding, and its fix

`resolveViolationTitle` / `plainEnumLabel` degraded an unmapped canonical rule code to a **de-snake-cased
engine token** (`"faculty lunch window violation"`). QA ruled that BLOCKING on evidence, not taste: main
already had a passing row named *"J2 P5: the shared unlabelled sentence is one sentence and never a
de-snake-cased token"* whose comment named that exact string, and `timetable-plain-language.ts:165` claimed in
prose *"It deliberately does NOT de-snake-case the token"* while `plainEnumLabel` 130 lines below did exactly
that. Two surfaces also gave the same code two different sentences.

The fix put **one** degradation rule in a new third module `atlas-client/src/lib/plain-rule-degradation.ts`
(chosen so the import direction stays acyclic): **absent → em dash; known → its one canonical label; unmapped
or out-of-union → the one honest sentence** `UNLABELLED_RULE_SENTENCE`. `humaniseEngineToken` stays exported
and unit-covered, restricted to free-form text. `plain-tokens-c04.test.tsx` was restored byte-identical to
`5960cfce` (blob `4a383e1b`, also on `origin/main`), and a new cross-surface row T8 pins the single rule in
both directions.

**Honest cost, ruled acceptable by QA and recorded rather than minimised:** every unmapped code now renders
the identical sentence, so two different unmapped codes are indistinguishable on screen, and diagnosing a
new-server rule needs the payload or audit log rather than the UI. The alternative asserted a name ATLAS
does not have.

## Gates actually run, and their provenance correction

The executor refused the specified dependency junction after finding
`E:\ATLAS-runtime-supervised-5c100ea6-20260925\atlas-client\node_modules` **empty (0 entries, no `tsx`)** —
true, and it means the donor recorded in `live-state.md` is **not** a usable junction source. It used a real
copy (0.21 GiB) of an intact tree instead, ran no install. I then **re-ran my own earlier base-attribution
control**, because that measurement had used the empty donor: base and candidate were re-measured against one
identical, self-owned dependency tree (two real copies, no junctions).

| Tree | tests | pass | fail | failing files |
| --- | --- | --- | --- | --- |
| base `5960cfce` | 1062 | 1046 | **16** | 11 |
| candidate `4130fd3c` | 1077 | 1061 | **16** | 11 (identical set) |
| candidate `de392cf8` | 1079 | 1063 | **16** | 11 (identical set) |

Base numbers match Lane A2's independently reported 1062/1046/16. Focused gates: `plain-language-j2j3-c01`
17/17, `plain-tokens-c04` 29/29, `draft-ux-c01` 32/32, `ux-guardrails` 30/31 (pre-existing
`gate-reachability` defect, base-reproduced). `typecheck` = exactly 4 errors, all in 3 test files
`git diff --name-status` proves this range never touches (`playwright` undeclared ×3, one implicit-any), so the
range adds **zero** typecheck errors. `git diff --check` clean; worktree clean; stash list unchanged (the same 3
pre-existing unrelated entries).

**The integration client suite earned its keep.** At `4130fd3c` it reported a net-new failing file,
`timetable-warning-authority-contract.test.ts` — main's R7 row pinned the de-snake-cased `'some future code'`
as the readable degradation. The focused gates and the bounded QA (which correctly did not run the full suite)
both missed it. Fixed at `de392cf8` by re-pinning that one over-specific expectation to the honest sentence
while keeping `doesNotThrow`, the not-a-de-snake-cased-token guard, and the untouched legacy-map assertion.

## Dated residuals (all NON_BLOCKING, none introduced by this range)

- **F1** — a residual wording split survives: for a value *outside* its union, main's four pinned fallbacks
  (`generationRunStateLabel` "In a state this version does not name", `roomRequestDecisionState` "Decision not
  recorded", and two siblings) still differ from the shared sentence. QA ruled this NON_BLOCKING on four
  verified grounds — unreachable on today's schema, no token leak, known-value parity holds, and it contradicts
  no tested rule — but it is a **product decision I did not make**: is the shared sentence canonical, or are
  four per-code-space fallbacks? Only the run-state string is test-pinned.
- **F2** — `plain-rule-degradation.ts:34-38` overstates that *every* resolver routes through it. The successor
  lane should tighten the sentence; a documentation overstatement in the module that exists to prevent drift.
- **F3** — B1's exact defect class is still live on two surfaces outside this range:
  `ManualEditPanel.tsx:929,948` de-snake-case an unmapped `ViolationCode` and
  `QuickPlaceSummaryModal.tsx:58` an unmapped quick-place reason. Backlog, base-reproduced.
- **F4** — `TimetableSimpleHeader.tsx:153` renders "Unknown issue" for an absent reason where step 1 of the
  shared rule prescribes the em dash. Base-reproduced.
- **F5** — `playwright` is imported by 3 test files but undeclared in `atlas-client/package.json`; source of
  the 4 standing typecheck errors. Pre-existing; wants a LOW ticket.
- **F6** — `RightPanel.tsx`'s `violationLabels` prop is documentation-only. This range's own `RightPanel` delta
  was comment-only; the whitespace-only re-indent sits in the reviewed range.
- **F7** — `warning-readability-c01.test.ts` R1/R2 still fail (rendered `1 faculty_lunch_window_violation item
  needs review` from `TimetableShared.tsx:127`), base-reproduced, same defect class as F3.

## Custody ruling I made under delegated authority (operator asleep)

Two dated records pointed at different writers: Lane C's said merge authority is the planner's and **Lane A2
holds it deliberately**, while the map said "whoever reconciles it must rebase onto `4c76208d`". I took the
reconciliation myself rather than stalling the queue, on three grounds: I am the planner of record, I hold
planner merge authority, and no Lane A2 process was present to contest. **If the operator or an active A2
session disagrees, this range is revertible as three additive commits on one branch.** Recorded so it is
visible rather than assumed. The map's rulings were followed as the governing spec throughout.

## Verdict

**INTEGRATED and pushed to `origin/main` as `de392cf8`.** Ordinary accepted source. No HIGH action, no
runtime, database, browser, generation, publication, migration, deployment, or companion-repo action was taken.
`main` remains **undeployed**; live is still `116a7658` off the `861d89a2` line.
