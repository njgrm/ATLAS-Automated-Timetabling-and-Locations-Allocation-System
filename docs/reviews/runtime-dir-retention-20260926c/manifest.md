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
| `E:\ATLAS-runtime-supervised-4893cbde-20260923` | 1.80 GiB | 125 | **no — standalone clone** (`.git` is a directory) | **PRESERVE_FOR_DECISION — operator.** Not a registered worktree, so the riskier `Remove-Item` path applies; already carried as deferred by `20260926a`. Not one of the two named last-resort artifacts. **This is the only E: row that would clear the 50 GiB warning and retiring it is not this lane's decision.** |

**D: is not in scope.** D: is at **60.67 GiB** free — above its warning — and `20260926a`/`20260926b` both
declined it for that reason. All 17 `D:\ATLAS-runtime-*` rows, including the two named last-resort artifacts
(`9d293879` reset baseline, `d44f29e0` manual fallback), stay untouched.

## E: worktree rows are other lanes' custody

The E: worktree set holds ~8.7 GiB across ten finished lane worktrees. **This lane does not retire them**: they
belong to Lanes B and C, several are `KEEP_ACTIVE` or `PRESERVE_FOR_DECISION` in their own sections, and
§3's retention policy governs **release directories**, not other lanes' active worktrees. This lane's own E:
worktrees are `lane-a-r1-deploy-target` (`KEEP_ACTIVE` — the current lane record) and
`lane-a-f1-f2-deploy-candidate` (`PRESERVE_FOR_DECISION` — it is the source of the deployed release and is not
an ancestor of `main`). Neither is retirable.

## Capacity attestation

| Volume | Free | Threshold | State |
| --- | --- | --- | --- |
| E: | **48.73 GiB** | warn < 50, fail-closed < 25 | **below warning, far above fail-closed** |
| D: | **60.67 GiB** | warn < 25, fail-closed < 15 | healthy |

A release build needs roughly **2 GiB** (a checkout plus real client and server dependency copies — measured
`861d89a2` at 0.21 GiB client, ~0.9 GiB server) against 48.73 GiB free. Capacity is verified sufficient for the
build. **The §3 obligation is discharged by this cycle's run and audit, not by this reasoning** — the
obligation is to *run the reclaim*, and the reclaim has found nothing further within this lane's authority.

## Prohibitions carried into this cycle

No removal, no `git worktree remove`, no `git worktree prune`, no `--force`, no glob, no computed path, no
branch deletion, no junction creation or deletion. **No task, env, runtime, database, or companion action.** No
edit to any file outside this manifest and the Lane A section of `docs/plans/live-state.md`. No edit to Lane B's
or Lane C's sections.

## Post-action duty

Record the result in `docs/plans/live-state.md` with the measured E:/D: figures, the exhausted-set finding, the
`4893cbde` decision still owed by the operator, and the fact that capacity sufficiency is measured rather than
asserted. **If the operator approves retiring `4893cbde`, it requires its own frozen manifest and pre-action
audit** — the standalone-clone removal path, per `agent-worktree-lifecycle.md`'s bounded exception 2.
