# Runtime-directory retention manifest — `20260926b` (successor to `20260926a`)

Frozen: 2026-09-26 (Asia/Manila) · Lane: A · Tier: MEDIUM (repository hygiene; **no live action, no runtime
touch, no database, no deployment**) · Trigger: `AGENTS.md` §3 — E: crossed the **50 GiB warning** line
(**46.25 GiB free** at freeze). Fail-closed is 25 GiB, so this is a warning-triggered reclaim, not a capacity
emergency. Policy source: `docs/reference/agent-worktree-lifecycle.md` → "Retention policy for
`D:/ATLAS-runtime-*` and `E:/ATLAS-runtime-*`".

## Scope decision (recorded because it is a judgement, not a fact)

The policy's keep set is counted **across both volumes**, but its **trigger** is per-volume. **D: is at 60.66
GiB free — not under warning — so no `D:\ATLAS-runtime-*` directory is touched by this cycle**, including the
~10 superseded releases there. Reclaiming a volume that is not under pressure adds risk for no required gain.
Every row below is therefore E: only.

## Measured inventory (all sizes by recursive file sum, GiB)

| Path | Size | `node_modules` entries | Registered worktree | HEAD | Ancestor of `origin/main` | `git status --short` |
| --- | --- | --- | --- | --- | --- | --- |
| `E:\ATLAS-runtime-supervised-116a7658-20260726` | 1.46 | 155 | yes | `116a7658` | **no** (exit 1) | `?? ops/runtime/logs/` |
| `E:\ATLAS-runtime-supervised-861d89a2-20260925` | 1.47 | 156 | yes | `861d89a2` | yes | `?? ops/runtime/logs/` |
| `E:\ATLAS-runtime-supervised-c5e167d7-20260925` | 1.43 | 155 | yes | `c5e167d7` | yes | `?? ops/runtime/logs/` |
| `E:\ATLAS-runtime-supervised-eb0e3038-20260925` | 1.46 | 155 | yes | `eb0e3038` | yes | `?? ops/runtime/logs/` |
| `E:\ATLAS-runtime-supervised-5c100ea6-20260925` | 0.96 | **0** | yes | `5c100ea6` | yes | clean |
| `E:\ATLAS-runtime-supervised-4893cbde-20260923` | 1.80 | 125 | **no — standalone clone** | `4893cbde` | yes | `?? ops/runtime/logs/` |

Total E: release directories: **8.58 GiB**.

## RETIRE — 2 rows, 2.42 GiB

| # | Exact path | Justification under the policy |
| --- | --- | --- |
| R1 | `E:\ATLAS-runtime-supervised-eb0e3038-20260925` | Rollback depth beyond the keep set. Accepted-release order on E: is `116a7658` (live) → `861d89a2` → `c5e167d7` → `eb0e3038`; policy keeps live + the two most recent accepted, so this is the first row beyond it. Deep rollback is a rebuild, not an instant re-point. |
| R2 | `E:\ATLAS-runtime-supervised-5c100ea6-20260925` | Beyond the keep set **and** disqualified as the "one real dependency source": its `atlas-client/node_modules` holds **0 entries and no `tsx`**, so the donor role this lane's live-state recorded for it is already void. Measured directly; the two worktrees that had junctioned to it were retired earlier today. |

Both are `git worktree remove`-eligible (registered, detached-HEAD worktrees with a `.git` *file*).
`git worktree remove` refuses while untracked files remain, so R1 needs its exact untracked
`ops/runtime/logs/` path removed first. That path is recorded here, is not tracked, and is the same
untracked logs directory the **live** release also carries.

## PRESERVE_FOR_DECISION — 1 row (operator decision required, not taken here)

| # | Exact path | Why preserved |
| --- | --- | --- |
| P1 | `E:\ATLAS-runtime-supervised-4893cbde-20260923` | 1.80 GiB, the single largest E: item, and **a standalone clone, not a registered worktree** (`.git` is a directory), so `git worktree remove` does not apply — its removal is the riskier `Remove-Item` path in the policy. It was already carried as deferred-for-decision by the prior cycle. **Retiring it needs the operator's decision, not mine.** It is also not one of the two named last-resort artifacts. |

## KEEP — unchanged, and the resulting state

| Role | Path | Note |
| --- | --- | --- |
| LIVE | `E:\ATLAS-runtime-supervised-116a7658-20260726` | Scheduled task `ATLAS-Runtime-Supervisor` action is `node.exe "E:\ATLAS-runtime-supervised-116a7658-20260726\ops\runtime\cli.mjs" start`, status Running. Verified by task query, not by a previous session's PIDs. Not an ancestor of `main` (deliberate isolated line). |
| Accepted #1 (rollback basis) | `E:\ATLAS-runtime-supervised-861d89a2-20260925` | |
| Accepted #2 | `E:\ATLAS-runtime-supervised-c5e167d7-20260925` | |
| One real dependency source | `E:\ATLAS-runtime-supervised-861d89a2-20260925` (156 entries) | The only keep-row with an intact tree. **Replaces `5c100ea6`, whose donor role is void.** Use a real copy, never a junction chain. |
| Last-resort artifacts | `D:\ATLAS-runtime-supervised-20260912` (`9d293879`) and `D:\ATLAS-runtime-fallback-d44-20260912` (`d44f29e0`) | On D:, untouched — not under warning. |

## Preconditions verified before this manifest was frozen

1. **Junction-dependent scan across every root** — every registered worktree, every `E:\ATLAS-*` and
   `D:\ATLAS-*` directory, and `D:\ATLAS`, checking `node_modules`, `atlas-client/node_modules` and
   `atlas-server/node_modules` for reparse points whose target contains `eb0e3038` or `5c100ea6`:
   **no dependents found.** This matters because two worktrees junctioned to `5c100ea6`'s empty
   `node_modules` earlier today, so a stale borrower was a real possibility.
2. **Dirt classification** — the only untracked path in R1 is `ops/runtime/logs/`, identical to the live
   release's, so R1 is not a dirty worktree in the policy's sense.
3. **No active process** — the supervisor's action names the live release only; neither R1 nor R2 is named by
   any task action, and the boot task points at the live release.
4. **Capacity at freeze** — E: 46.25 GiB, D: 60.66 GiB.

## Expected outcome and its honest limit

Retiring R1 + R2 returns ~2.42 GiB, taking E: to roughly **48.7 GiB — still below the 50 GiB warning line.**
This reclaim therefore satisfies the §3 obligation (run the reclaim before the next release build) but does
**not** clear the warning. Clearing it needs an operator decision on **P1** (1.80 GiB). That is stated here
rather than papered over, and it does not block a release build: a checkout plus a dependency tree is
~2 GiB against 48 GiB free.

## Prohibitions carried into execution

`git worktree remove` with the exact validated path, then `git worktree prune`. **Never `--force`, never a
glob, never a computed path, never raw recursive deletion of a worktree or junction.** No branch deletion.
No action on `D:\ATLAS`, Codex-managed worktrees, `D:\ATLAS-runtime-config`, PostgreSQL storage, companion
repositories, `stakeholderFiles`, or any `D:\ATLAS-runtime-*` row. No start/stop/replace of the supervisor or
its children. No touch of the live release, R1's or R2's *contents* beyond the one recorded untracked logs
path, or any file in any other worktree.
