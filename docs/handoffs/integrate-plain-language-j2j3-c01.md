# Handoff — `PLAIN-LANGUAGE-J2J3-C01` integration (Lane A)

> **ADDED BY PLANNER A2, 2026-09-26 — read this before the body.** This record was stranded: it lived only
> on the local-only, never-pushed branch `integration/plain-language-j2j3-c01-20260726` at `c9c51307`, and
> `git merge-base --is-ancestor c9c51307 origin/main` returned **exit 1**. It is landed here so the
> `27713608...98289573` verdict is on `main`. The body below is Lane A's, **byte-identical** (blob
> `c9f6bec3`, verified with `git hash-object`); nothing in it has been edited, reworded or removed.
>
> **Two things a reader must not take from the body as current:**
> 1. **Its module shape is superseded.** The body describes the candidate's *own* three bare-label maps.
>    `main` no longer has that shape: `996b1b8b` reconciled J2 and J2J3 into one module that keeps **both**
>    accessor families over **one** canonical map, plus the shared absent-vs-unknown rule. The
>    reconciliation is documented at `atlas-client/src/lib/timetable-plain-language.ts:283-312`. A
>    separate A2 measurement found **no** information loss in it and **no** dead exports — all six exports
>    have one live production call site each, and `RightPanel.tsx:326` still renders the `next` sentence.
>    Evidence: `docs/reviews/a2-custody-verification-20260926/plain-language-accessor-verdict.md`. Read
>    that before acting on the body's "What changed" as a description of today's file.
> 2. **Its `live-state.md` edits are deliberately NOT landed.** The branch also edited
>    `docs/plans/live-state.md` (55 + 31 lines). That is another lane's section and it is superseded by
>    `de392cf8`, which is already on `main`. Per the writing protocol, another lane's section is not this
>    lane's to write; the register state is in the `Lane A2` section instead.
>
> **The owed QA capsule is partly discharged, honestly.** The body records that the independent QA verdict
> over `27713608...98289573` was `ACCEPT_READY` **24/24, blocked 0, unperformed 0**, returned in-session,
> and that the **row-by-row report was never written to a file**. Landing this document puts the verdict
> and its tally on `main`, which is what `AGENTS.md` §16 asks for. It does **not** manufacture the missing
> row report, and no attempt is made here to reconstruct rows that were never recorded.

Date: 2026-09-26 (Asia/Manila) · Lane: A · Tier: MEDIUM (ordinary accepted source) · Verdict: **INTEGRATED**

Base `origin/main` `19bc5168` · candidate `98289573` (packet base `27713608`) · integration merge `ba714131`
· branch `integration/plain-language-j2j3-c01-20260726` · worktree
`E:\ATLAS-worktrees\lane-a-plain-language-j2j3-integration`.

## What changed

Sixteen client paths: total enum-to-plain-word maps for the room-preference, room-request-appeal and
generation-run enums in `lib/timetable-plain-language.ts` (J2), plus domain-jargon plaining across the
left rail, run panels, grid conflict badge, summary stats, workflow dialogs and `useTimetableData` (J3).
New test file `src/lib/__tests__/plain-language-j2j3-c01.test.ts` (15 tests) plus a widened
`tt-warning-surface-realism-c07b.test.ts`. `package.json` gains `test:plain-language-j2j3-c01` and its
file is unioned into `test:client-suite`. No server file, no schema, no migration, no runtime surface.

## Acceptance

Fresh independent immutable-range QA over `27713608...98289573` returned **`ACCEPT_READY` 24/24, blocked 0,
unperformed 0**, with 16 non-blocking findings. The accepting reviewer is not the implementer, so the §11
"A release must not ship source that no independent reviewer has seen" gate is satisfied for this
candidate on its own.

**Owed evidence artifact:** that QA verdict was returned in-session as a verdict with its tally; the
row-by-row report was never written to a file. This record cites the returned verdict and is **not** a
transcription of QA's rows. A written QA capsule remains owed and is listed in live-state.

## Planner integration gates actually run

Run in the integration worktree on the merge `ba714131`, on top of `19bc5168`:

| Gate | Result |
| --- | --- |
| `npm run typecheck` (client) | PASS |
| `npm run test:plain-language-j2j3-c01` | 15/15 PASS |
| `npm run test:draft-ux-c01` | 32/32 PASS |
| `npm run test:ux-guardrails` | **30/31, 1 fail** — see control below |
| `npm run test:client-suite` | **1032/1048, 16 fail** — see control below |
| `npm run build` (client) | PASS |
| `git diff --check 19bc5168 ba714131` | clean |

`npm run test:client-suite` and `npm run test:ux-guardrails` are **not** green here, so they are not
recorded as green. Both were measured against a fresh detached read-only worktree at the integration base
to attribute the failures. That control worktree was `git worktree add --detach
E:\ATLAS-worktrees\lane-a-base-19bc-gatecontrol 19bc5168` with `atlas-client/node_modules` a junction to the
preserved donor `E:\ATLAS-runtime-supervised-5c100ea6-20260925`; no install ran and no repo file was
written. It was removed after the measurement.

### Failing-set comparison (the decisive attribution control)

`npm run test:client-suite` captured to a temp file on both trees, then compared:

| Tree | tests | pass | fail | distinct failing files |
| --- | --- | --- | --- | --- |
| base `19bc5168` | 1033 | 1017 | **16** | 11 |
| integration `ba714131` | 1048 | 1032 | **16** | 11 |

The failing-file sets are **identical** (`Compare-Object` empty in both directions): the delta adds **15
net-new passing tests and zero new failures**. `test:ux-guardrails` is `30/31` with the single failure in
`src/lib/__tests__/gate-reachability.test.ts` on **both** trees.

The 11 pre-existing failing files, all out of this delta's scope and unchanged by it:
`timetable-relaxed-main-b02`, `timetable-relaxed-main-c01`, `gate-reachability`,
`timetable-dynamic-workspace-drift`, `timetable-simple-term-export-c03r2`, `timetable-term-export-c03r2`,
`tt-source-freshness-client-c04`, `tt-tl-modules-c04r1-behavior`, `tt-tl-modules-c04r1-contract`,
`tt-warning-surface-realism-c07b`, `warning-readability-c01`.

This also independently confirms the 16-failure / zero-new expectation Lane C's reconciliation map records
for this lane's candidate.

### Product parity

`git diff 27713608..98289573 -- atlas-client` and `git diff 19bc5168..ba714131 -- atlas-client` hash
identically (`fa3e429f8f94fedc13fe33812a19d46221e0e212`), so the product tree on main is byte-identical to
the reviewed candidate. `git merge-base --is-ancestor 98289573 ba714131` exits 0. Pushed range
`19bc5168..ba714131` is the merge plus the single candidate commit `98289573` — accepted commits only.

## Cross-lane custody — **PUSH REJECTED, integration NOT on `main` (2026-09-26)**

The push of `ba714131` + this record was **rejected as non-fast-forward**: Lane C advanced `origin/main` to
`5960cfce` mid-cycle, which integrates its J2 candidate `9f232cec` plus the D2 correction `1ccdf4dd` as
`4c76208d`. **`main` does not contain `98289573`, and none of the claims in the first draft of this section
reached `main`.** Product parity and the gate measurements above are valid *for the merge `ba714131`*, which
now sits behind `main` and is not a shippable tree.

Lane C published a **corrected** reconciliation map in the same commit, and it supersedes the earlier map:

- Merge authority is the **planner's**; the executor's deny-list blocks `git merge*`, so Lane A2 holds it
  deliberately and did not route around it.
- `98289573` **must be rebased onto `4c76208d`**, and one fresh independent QA over the whole reconciled
  range is required before any push (§11).
- The corrected map reverses this cycle's graft rulings: Lane A's three exported bare-label maps are **not
  adopted** (they are imported only by Lane A's own test file, so dropping them **breaks the build** until
  that test is repointed at `roomRequestDecisionState` / `roomRequestAppealState` / `generationRunStateLabel`),
  `humaniseEngineToken` and `ALL_SESSIONS_PLACED_LABEL` must be kept from Lane A's side, and
  `violation-presentation.ts` has **no** wording conflict because the symbols are disjoint.

So the contested module resolves the other way from what the first draft of this record assumed: `main`
carries **Lane C's** richer `{ label, next }` maps, exactly as the map's "keep ours" ruling said, and Lane A's
file is the one that is grafted into it. Exporting both label sets for one status remains the C3 defect.

Unchanged: this cycle did **not** merge `9f232cec`, did not half-resolve the 13-conflict trial merge, and
touched no Lane B/C worktree.

## Risks

- **NON_BLOCKING** — `warning-readability-c01.test.ts` R1/R2 fail identically on base and integration:
  `FACULTY_LUNCH_WINDOW_VIOLATION` has no operator copy and leaks its raw code to the operator surface.
  This is a real, dated, proven plain-language gap in the same family as J2/J3, still open on main.
- **NON_BLOCKING** — the remaining 10 pre-existing client-suite files above are separate gate debt.
- **NON_BLOCKING** — the owed written QA capsule (above).
- **BLOCKING for any push** — `main` advanced to `5960cfce` and the push was rejected non-fast-forward. The
  reconciled tree requires a rebase onto `4c76208d`, per-file resolution of the contested files under Lane
  C's corrected map, and one fresh independent QA over the whole reconciled range. The measurements above
  were taken on `ba714131`, which is behind `main` and must be re-measured on the reconciled tree.
- **NON_BLOCKING** — `main` now carries C1/C2/C3, J2 and D2 and is still not deployed; the next release
  needs a fresh successor reclaim (E: 47.23 GiB is below the 50 GiB warning) and a new packet.

## Verdict

**CANDIDATE ACCEPTED AND MEASURED, PUSH BLOCKED** — ordinary accepted source, reviewed
(`ACCEPT_READY` 24/24/0/0) with zero new client-suite failures attributable to it, but **not integrated**:
`origin/main` moved under the push and the two lanes' product must be reconciled file by file before any
push. No HIGH action, no runtime, database, generation, publication, migration or companion action was taken.

## Open question for the operator (custody, not technical)

Executing the corrected map means writing the contested files and **discarding** Lane A's three bare-label
maps plus repointing 15 of this candidate's own accepted tests. Lane C's record says merge authority is the
planner's and that **Lane A2 holds it deliberately**; the map then says "whoever reconciles it must rebase
onto `4c76208d`". Those two statements point at different writers, and two planners on one stream is a
custody defect rather than parallelism. Two clean options:

1. **Lane A2 reconciles `98289573`** onto `4c76208d` under its own corrected map, then one fresh independent
   QA over the reconciled range before push. Keeps a single writer on the contested module and honours the
   map's stated authority. Cost: Lane A's J3 work waits on Lane A2's queue.
2. **This lane reconciles it** as the author of `98289573`, under the same corrected map, with Lane A2
   confirming it yields the merge. Cost: two planners have touched the same files unless Lane A2 stands down.

Recommendation: **option 1**, because the corrected map is Lane A2's artifact, its rulings were derived from
its own executor's findings on those exact files, and it already published the blocker the first map missed.
