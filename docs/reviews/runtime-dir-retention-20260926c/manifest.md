# Runtime-directory retention manifest — `20260926c` (successor to `20260926b`)

Frozen: 2026-09-26 (Asia/Manila) · Lane: A · Tier: MEDIUM (repository hygiene; **no live action, no runtime
touch, no deployment, no database**) · Trigger: `AGENTS.md:43` — E: is still below the 50 GiB warning
(**48.73 GiB**), and the next release build requires its own reclaim. This is the step-0 obligation the
`main` deployment packet R3 names as blocking.

## Why this cycle retires nothing, stated up front

`20260926b` exhausted the E: **release** set. The review of the deployment packet confirmed the remaining E:
inventory and this manifest re-verifies it independently. **This is a capacity attestation, not a removal
cycle, and it does not pretend otherwise.** Retiring nothing is the truthful outcome; the alternative — a
manifest that claims more than it does — is the failure mode §16 warns about.

## Inventory (E: only; sizes by recursive file sum)

| Path | Size | `node_modules` entries | Registered worktree | Disposition |
| --- | --- | --- | --- | --- |
| `E:\ATLAS-runtime-supervised-116a7658-20260726` | 1.46 GiB | 155 | yes | **KEEP — LIVE.** Scheduled task action names it; status Running; health 200, ready 200. |
| `E:\ATLAS-runtime-supervised-861d89a2-20260925` | 1.47 GiB | 156 | yes | **KEEP** — accepted #1, rollback basis, and the one real dependency source (intact). |
| `E:\ATLAS-runtime-supervised-eb0e3038-20260925` | 1.46 GiB | 155 | yes | **KEEP** — accepted #2, recorded rollback basis. |
| `E:\ATLAS-runtime-supervised-4893cbde-20260923` | 1.80 GiB | 125 | **no — standalone clone** (`.git` is a directory) | **PRESERVE_FOR_DECISION — operator.** Not a registered worktree, so the riskier `Remove-Item` path applies; already carried as deferred by `20260926a`. Not one of the two named last-resort artifacts. **Within the E: *release-directory* set this is the only row that would clear the 50 GiB warning, and retiring it is not this lane's decision** (scoped to the release set because the E: worktree rows below are a larger lever). |

**D: is not in scope.** D: is at **60.67 GiB** free — above its warning — and `20260926a`/`20260926b` both
declined it for that reason. All 17 `D:\ATLAS-runtime-*` rows, including the two named last-resort artifacts
(`9d293879` reset baseline, `d44f29e0` manual fallback), stay untouched.

## E: worktree rows are other lanes' custody — and this lane stated their disposition wrongly

**CORRECTION 2026-09-26 after independent pre-action audit `CORRECTION_REQUIRED` 7/8 (F1 BLOCKING).** The first
draft of this section claimed that several of these worktrees "are `KEEP_ACTIVE` or `PRESERVE_FOR_DECISION` in
their own sections". **That was false and I did not verify it.** The audit checked each of the ten names
against `docs/plans/live-state.md` and found **0 hits each**. The corrected position:

The E: worktree set holds **8.72 GiB across ten other-lane worktrees** (`lane-b-*` ×3, `lane-c-*` ×7). The
audit verified that for **all ten**: `merge-base --is-ancestor <HEAD> origin/main` is true and
`status --porcelain` is empty — i.e. **clean, finished, pushed, and merged into `main`**, with no disposition
recorded anywhere. So:

- They are **not** `KEEP_ACTIVE` and **not** `PRESERVE_FOR_DECISION`. They are preserved here solely under the
  policy's "**preserve every … uncertain owner**" rule, because no owner has spoken for them.
- They are **technically reclaimable**, and the largest available lever on E: — 8.72 GiB, enough to clear the
  50 GiB warning several times over.
- Retiring them is nonetheless **not this lane's to do**: they are Lanes B's and C's working trees, and the
  disposition call belongs to the owning lane. `AGENTS.md`'s runtime-directory retention policy governs
  release directories only — a correct scoping that the first draft stated for the wrong reason.
- **Each of the ten is owed a disposition by its owning lane.** That debt is recorded below as a dated item
  rather than left as an invisible premise.

## This lane's own two E: worktrees — dispositions restored additively

**RESTORED 2026-09-26 after the re-audit found commit `c85e70e6` deleted these two rows instead of replacing
them — a subtractive correction, which `AGENTS.md:229` forbids regardless of whether the fix is correct.** The
rows are reinstated verbatim in substance; the deletion was a real breach of "corrections are additive to
evidence, never subtractive" and is recorded rather than quietly repaired.

| Path | Disposition | Why |
| --- | --- | --- |
| `E:\ATLAS-worktrees\lane-a-r1-deploy-target` | **`KEEP_ACTIVE`** | this lane's current record worktree (`docs/lane-a-r1-deploy-target`) |
| `E:\ATLAS-worktrees\lane-a-f1-f2-deploy-candidate` | **`PRESERVE_FOR_DECISION`** | at `116a7658`, the source of the deployed release, and **not** an ancestor of `main` (`merge-base --is-ancestor 116a7658 origin/main` exit 1), so it is an unintegrated candidate that must be preserved |

With these two restored, all 15 `E:\ATLAS-worktrees` directories are accounted for: 10 other-lane worktrees,
3 non-git leftovers, and these 2.

### SHA-collision disclosure (N1)

`5c100ea6` names **two different things**, which matters because this lane's standing caution requires
verifying claims by SHA: it is the **retired release directory** removed by reclaim `20260926b` (its path is
gone from E:), and it is simultaneously the **current HEAD of the still-present worktree**
`E:\ATLAS-worktrees\lane-b-integration-scheduler-warning-clarity` (exists, registered, clean). A reader
verifying a worktree disposition by SHA will find "RETIRED" and draw the wrong conclusion. Dispositions must be
checked **by path**, not by SHA.

An inventory asserting exhaustion must name these. They are not Git repositories and are absent from
`git worktree list`, so they fall under the same `Remove-Item`-only bounded path as `4893cbde`, and total
**0.11 GiB**: `E:\ATLAS-worktrees\warning-readability-c01`,
`E:\ATLAS-worktrees\flag-window-per-scope-c01`, `E:\ATLAS-worktrees\rollover-year-identity-c01`. They are
recorded as PRESERVE_FOR_DECISION for the same owner-uncertainty reason.

## Capacity attestation

| Volume | Free | Threshold | State |
| --- | --- | --- | --- |
| E: | **48.73 GiB** | warn < 50, fail-closed < 25 | **below warning, far above fail-closed** |
| D: | **60.67 GiB** | warn < 25, fail-closed < 15 | healthy |

A release build needs roughly **2 GiB** (a checkout plus real client and server dependency copies — measured
from `861d89a2`: client `node_modules` **0.213 GiB**, server `node_modules` **0.368 GiB**, root **0.299 GiB**,
total **0.88 GiB**, and a complete existing release directory is 1.47 GiB) against 48.73 GiB free. Capacity is
verified sufficient for the build. **The §3 obligation is discharged by this cycle's run and audit, not by this
reasoning** — the obligation is to *run the reclaim*, and the reclaim has found nothing further within this
lane's authority.

## Prohibitions carried into this cycle

No removal, no `git worktree remove`, no `git worktree prune`, no `--force`, no glob, no computed path, no
branch deletion, no junction creation or deletion. **No task, env, runtime, database, or companion action.** No
edit to any file outside this manifest and the Lane A section of `docs/plans/live-state.md`. No edit to Lane B's
or Lane C's sections.

## Post-action duty

Record the result in `docs/plans/live-state.md` with the measured E:/D: figures, the exhausted-set finding, and
**two dated debts, not one** — the first draft of this section would have recorded only the second and left the
larger one invisible:

1. **8.72 GiB across ten E: worktrees** (`lane-b-*` ×3, `lane-c-*` ×7), all clean, finished, pushed, merged into
   `main`, and **carrying no disposition in any section** — owed a disposition by their owning lanes, and the
   only lever on E: large enough to clear the 50 GiB warning.
2. **`4893cbde`** (1.80 GiB) plus the three non-git E: leftovers (0.11 GiB) — `PRESERVE_FOR_DECISION`.
   Approving their removal requires **its own frozen manifest and pre-action audit**; they are standalone
   clones or non-repositories, so `agent-worktree-lifecycle.md`'s bounded exception 2 applies
   (`Remove-Item -LiteralPath` on a named, non-reparse, per-row-validated target — never a glob).

**Correction to the deferral's framing (F4):** the first draft called the `4893cbde` decision "not this lane's
decision" as though policy required it. Policy:102 actually *directs* retiring rollback depth beyond the keep
set, and exception 2 supplies the bounded path. The deferral is **conservative rather than required**, and it
stands — but it is a choice this lane is making pending the operator, not a rule the policy compels.

Also note (F4): `AGENTS.md` §3 separately caps **active task worktrees at 12** across both roots, which is
independent of the runtime-directory retention policy and is a live constraint, not part of this cycle.
