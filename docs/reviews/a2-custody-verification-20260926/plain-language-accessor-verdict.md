# Verdict — the "J2/J2J3 reconciliation lost information" finding is FALSE

Date: 2026-09-26 (Asia/Manila) · Lane: A2 · Tier: LOW (read-only verification, docs-only output)
Claim under test: `docs/handoffs/a2-initiation-brief-2026-09-26.md` §"What changed after Lane A's
checkpoint", finding 1, and its table of call sites.
Base measured: `origin/main` `a1dcfc34` (the brief commit itself). All worktrees: `a1dcfc34`.
Verdict: **CLAIM WITHDRAWN — no information loss, no dead exports, no decision required.**

## The claim, as written

| Export | Claimed call sites | Claimed payload |
| --- | --- | --- |
| `roomRequestDecisionState` | **0** | `{ label, next }` |
| `plainRoomDecisionStatus` | 1 | bare label |
| `roomRequestAppealState` | **0** | `{ label, next }` |
| `plainRoomAppealStatus` | 1 | bare label |
| `generationRunStateLabel` | **0** | `{ label, next }` |
| `plainGenerationRunStatus` | 1 | bare label |

and the conclusion: *"a scheduler now sees 'Waiting for a decision' with no explanation of what happens
next, and three dead exports remain"* — with the resulting instruction being to wire the richer
accessors back up, or delete the dead exports and accept the terser wording.

## Measurement 1 — actual signature of each export

Command: `Select-String -Path atlas-client\src\lib\timetable-plain-language.ts -Pattern 'export (function|const|type|interface)'`

```
127: export type PlainRoomRequestState = { label: string; next: string };
192: export function roomRequestDecisionState(status): PlainRoomRequestState
197: export function roomRequestSubmissionState(status): PlainRoomRequestState
202: export function roomRequestAppealState(status): string
260: export function generationRunStateLabel(status): string
314: export function plainRoomDecisionStatus(value): string
318: export function plainRoomAppealStatus(value): string
322: export function plainGenerationRunStatus(value): string
```

**Three of the six claimed `{ label, next }` exports return `string`.** `roomRequestAppealState` and
`generationRunStateLabel` are bare-label functions; there is no `next` for them to lose, and therefore
no "what happens next" sentence that could have been dropped from them. The claim's payload column is
wrong for 2 of 3 rows.

## Measurement 2 — actual production call sites

Command: recursive `Select-String` over all `*.ts`/`*.tsx` under the repo, excluding `node_modules`,
`\dist\`, `\build\`, then filtering out the defining module
`atlas-client\src\lib\timetable-plain-language.ts`. Test files are listed separately below and are not
production call sites.

| Export | Production call sites (file:line) | Test references |
| --- | --- | --- |
| `roomRequestDecisionState` | **1** — `RightPanel.tsx:21` (import), `:290` (call) | 13 |
| `roomRequestAppealState` | **1** — `RightPanel.tsx:20` (import), `:338` (call) | 6 |
| `generationRunStateLabel` | **1** — `TimetableRunsPane.tsx:21` (import), `:112` (call) | 9 |
| `plainRoomDecisionStatus` | **1** — `LeftRailContent.tsx:22`, `:561` | 8 |
| `plainRoomAppealStatus` | **1** — `TimetableWorkflowDialogs.tsx:4`, `:106` | 7 |
| `plainGenerationRunStatus` | **1** — `ScheduleReviewWorkspaceSummaryStats.tsx:25`, `:88` | 14 |

**The three "0 call sites" rows are each wrong: all three have exactly one live production consumer.**
No export in the set is dead. The `plain-rule-degradation.ts:36` hit counted in the same sweep is a
**doc comment** listing the resolvers (`:34-38`), not a call — which is plausibly the origin of the
counting error.

## Measurement 3 — the `next` sentence is still rendered

`atlas-client\src\components\timetable\RightPanel.tsx`:

```
290:  const requestDecision = roomRequestDecisionState(matchingRequest?.decisionStatus);
323:      : `Decision: ${requestDecision.label}`}
326:      {matchingRequest.status === 'DRAFT' ? requestSubmission.next : requestDecision.next}
```

So on the Room Request panel the label **and** the "what happens next" sentence both render. The claim's
user-visible consequence — *"Waiting for a decision" with no explanation of what follows* — is false on
that surface. The bare-label surfaces (`LeftRailContent`, `TimetableWorkflowDialogs`,
`ScheduleReviewWorkspaceSummaryStats`) render a bare label, but they are the J2J3 surfaces that **always**
rendered a bare label: `plain*` is not a downgrade of a richer accessor on those call sites, it is the
original contract there.

## Measurement 4 — the `plain*` three are not a competing second label set

`timetable-plain-language.ts:314-324` — each `plain*` function delegates to the ONE degradation helper
over the **same canonical map** the J2 accessors read, projecting one field:

```ts
export function plainRoomDecisionStatus(value) {
  return plainRuleValue(ROOM_REQUEST_DECISION_STATES, value, (state) => state.label);
}
export function plainRoomAppealStatus(value) {
  return plainRuleValue(ROOM_REQUEST_APPEAL_STATES, value, (label) => label);
}
export function plainGenerationRunStatus(value) {
  return plainRuleValue(GENERATION_RUN_STATE_LABELS, value, (label) => label);
}
```

`plainRuleValue` (`lib/plain-rule-degradation.ts:82-96`) implements one three-step rule: absent → em dash
(`ABSENT_VALUE_LABEL`), known member → the canonical map's label, unmapped/out-of-union →
`UNLABELLED_RULE_SENTENCE`. So `plain*` adds exactly one thing over the originals — **it distinguishes
ABSENT from UNKNOWN**, which the originals conflated. That difference is the J2J3 B1 defect the
reconciliation set out to close, and it is a **gain**, not a loss.

## Measurement 5 — the reconciliation is documented, deliberate, and reasoned in code

`timetable-plain-language.ts:283-312` is a 30-line comment stating the decision, its reason, and the
rejected alternative:

- the candidate's own three bare-label maps are **not adopted**, because this module already names each
  status and "two label sets for one status is the exact 'one HARD problem has four names' defect J1 was
  written to remove (2026-09-26 audit finding 3)";
- what **is** adopted is the degradation rule, because it distinguishes absent from unknown, and
  conflating them "is a false claim — 'this version does not name it' asserts something about ATLAS when
  the truth is that the server sent no value at all";
- `R1 (B1) SUPERSEDES this block's original step 3`, which degraded an out-of-union value with
  `humaniseEngineToken(value)` and "gave the same canonical code two different sentences depending on
  which resolver read it" — replaced by the shared honest sentence, with a note that there is
  deliberately no local `plainEnumLabel` because "a second implementation is what let the two rules drift
  in the first place".

`plain-rule-degradation.ts:1-39` documents the same rule from the owning side, including **why** it had to
be a third module (the import cycle between `timetable-plain-language.ts` and
`violation-presentation.ts` is what produced the drift in the first place) and that `plainRuleValue` is
"the single implementation" every resolver routes through.

**So the premise "a deliberate-looking choice nobody recorded" is false: the choice is recorded, in the
code, next to the code, with the rejected alternative named.**

## Measurement 6 — both accessor suites are green and are registered gates

Run in `E:\ATLAS-worktrees\lane-a2-timetable-custody` at `a1dcfc34`, with `atlas-client/node_modules` a
**real** `robocopy /E` copy of the frozen donor
`E:\ATLAS-runtime-supervised-861d89a2-20260925\atlas-client\node_modules` (156 entries before and after,
**0 reparse points** — no junction, per the standing caution):

| Script (`atlas-client/package.json`) | Result |
| --- | --- |
| `npm run test:plain-language-j2j3-c01` | **18 pass / 0 fail** |
| `npm run test:plain-tokens-c04` | **30 pass / 0 fail** |

Both are reachable from committed `package.json` scripts, so this is gate evidence and not an orphan
suite (`AGENTS.md` §11). Load-bearing rows inside them, by name:

- `plain-tokens-c04` — *"J2 P2: every RoomPreferenceDecisionStatus member has plain wording **that says
  what happens next**"*, plus a mutant row proving the assertion fires.
- `plain-language-j2j3-c01` — *"T3: no operator surface renders a decision or appeal enum"*,
  *"T2: the rail renders the real plain title, and the terse title and raw enum both fail it"*, and
  *"T8: one unmapped code gets ONE honest sentence on the resolver, the room/run helpers, the
  unassigned reasons and the dialog"* — with mutants for each.

## Measurement 7 — the three `next` sentences are true against the server

Spot-checked against `atlas-server\src\services\room-preference.service.ts` at `a1dcfc34`:

| Client sentence | Server evidence | Verdict |
| --- | --- | --- |
| `PENDING` → "Nobody has approved or declined this request yet, so the schedule has not changed." | request created with `decisionStatus: 'PENDING' as const` (`:688`); the commit branch at `:1407` is gated on `=== 'APPROVED'` | true |
| `APPROVED` → "The schedule has been changed to use the requested room." | `:1407-1449` commits `MOVE_ENTRY` with `targetRoomId: request.requestedRoomId` (`:1437`), `CHANGE_ROOM`, or a swap | true |
| `REJECTED` → "The request was declined, so this session keeps the room and time it already had." | no `commitResult` is produced outside the `APPROVED` branch | true |

**One imprecision worth recording, not a defect:** for `actionType === 'SWAP_WITH_OCCUPIED'` (`:1411`)
the session takes the *other* session's room rather than "the requested room", so that one sub-case is
looser wording than the sentence claims. It is a busy scheduler reading a common flow, not an authority
or data claim. Left as an observation; it does not affect the withdrawal.

## Why the claim's two prescribed remedies would each have caused harm

This is the part that matters, because the brief offered exactly two options and both are worse than doing
nothing:

1. **"Delete the dead exports and consciously accept the terser wording."** They are not dead — each has
   one live production consumer. Deleting `roomRequestDecisionState` removes `RightPanel.tsx:326`, the
   only rendered "what happens next" sentence on the Room Request panel, and breaks a registered gate
   (`plain-tokens-c04` *"J2 P2 … that says what happens next"*).
2. **"Wire the richer accessors back up."** Replacing a `plain*` call with the richer accessor would
   **reintroduce the absent-is-conflated-with-unknown false claim** the reconciliation was written to
   remove — and if done by adding a second accessor rather than swapping the resolver, it would
   reintroduce **two label sets for one status**, the exact J1 defect the module's own comment names.

The correct action is the third one, which the brief did not offer: **record that the reconciliation is
intact, and close the item.**

## Honest limitation

`plainRoomDecisionStatus` and friends resolve **absent** to `ABSENT_VALUE_LABEL` (`—`). The brief's
`plain-rule-degradation.ts` doc comment states the rationale and I did not dispute it. This is a
presentation choice with a stated argument, not a measured defect, and I am not reopening it here.

## Commands, verbatim

```powershell
# 1 — signatures
Select-String -Path atlas-client\src\lib\timetable-plain-language.ts -Pattern 'export (function|const|type|interface)'
# 2 — call sites (repo-wide, excluding node_modules/dist/build and the defining module)
Get-ChildItem -Path D:/ATLAS -Recurse -File -Include *.ts,*.tsx | Where-Object { $_.FullName -notmatch 'node_modules|\\dist\\|\\build\\' } | Select-String -Pattern '\b<exportName>\b'
# 3 — the .next render
Select-String -Path atlas-client\src\components\timetable\RightPanel.tsx -Pattern 'roomRequestDecisionState|\.next'
# 6 — gates (worktree with a real donor copy of node_modules)
npm run test:plain-language-j2j3-c01
npm run test:plain-tokens-c04
# 7 — server state machine
Select-String -Path atlas-server\src\services\room-preference.service.ts -Pattern 'PENDING|APPROVED|REJECTED'
```
