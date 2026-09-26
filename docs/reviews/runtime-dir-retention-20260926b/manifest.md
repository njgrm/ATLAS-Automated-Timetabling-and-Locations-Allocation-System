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
| `E:\ATLAS-runtime-supervised-eb0e3038-20260925` | 1.46 | 155 | yes | `eb0e3038` | yes | `?? ops/runtime/logs/` |
| `E:\ATLAS-runtime-supervised-c5e167d7-20260925` | 1.43 | 155 | yes | `c5e167d7` | yes | `?? ops/runtime/logs/` |
| `E:\ATLAS-runtime-supervised-5c100ea6-20260925` | 0.96 | **0** | yes | `5c100ea6` | yes | clean |
| `E:\ATLAS-runtime-supervised-4893cbde-20260923` | 1.80 | 125 | **no — standalone clone** | `4893cbde` | yes | `?? ops/runtime/logs/` |

Total E: release directories: **8.58 GiB**.

## RETIRE — 2 rows, 2.39 GiB

> **R1 CORRECTED 2026-09-26 after independent pre-action audit `CORRECTION_REQUIRED` 12/14 (one BLOCKING
> row).** The first draft of this manifest inverted the accepted-release ordering and would have retired a
> keep row. The correction is recorded here rather than silently applied.

| # | Exact path | Justification under the policy |
| --- | --- | --- |
| R1 | `E:\ATLAS-runtime-supervised-c5e167d7-20260925` | First row beyond the keep set. Accepted-release order on E: is `116a7658` (live, committed 2026-09-26T03:35:39+08:00) → `861d89a2` (2026-09-26T00:21:05+08:00) → `eb0e3038` (2026-09-25T21:39:57+08:00) → `c5e167d7` (2026-09-25T19:17:49+08:00), so the two most recent accepted are `861d89a2` and `eb0e3038`, and `c5e167d7` is the first row past live + those two. `docs/plans/live-state.md:51-56` records all three as past rollback bases, and the lifecycle rule drops a rollback basis from the list "when a later accepted release displaces it" — two later accepted releases (`eb0e3038`, `861d89a2`) have. Deep rollback is a rebuild, not an instant re-point. |
| R2 | `E:\ATLAS-runtime-supervised-5c100ea6-20260925` | Beyond the keep set **and** disqualified as the "one real dependency source": its `atlas-client/node_modules` holds **0 entries and no `tsx`**, so the donor role this lane's live-state recorded for it is already void. Measured directly; the two worktrees that had junctioned to it were retired earlier today. Its commit is retained by the branch `integration/scheduler-warning-clarity`, so no Git object is lost. |

Both are `git worktree remove`-eligible (registered, detached-HEAD worktrees whose `.git` is a **file**, so
neither is the standalone-clone removal path). `git worktree remove` refuses while untracked files remain, so
R1 needs its exact untracked logs path removed first, by the literal command
`Remove-Item -LiteralPath "E:\ATLAS-runtime-supervised-c5e167d7-20260925\ops\runtime\logs" -Recurse -Force` —
the policy's bounded exception 2, which permits a `-LiteralPath -Recurse -Force` on a named, non-reparse
target and never a glob or computed path. That target is **not** a reparse point, and it is **not** the active
supervisor state: machine `ATLAS_RUNTIME_SOURCE_DIR` is `E:\ATLAS-runtime-supervised-116a7658-20260726`, and
§6 makes only the active state file authoritative.

**Pre-delete capture (recorded before any deletion).** R1's state file
`ops\runtime\logs\supervisor-state.json` — 477 bytes, SHA-256
`B820E66C6E413E6439F5B128273D13A712BC6ECE3052836B948806A11030C7DA` — verbatim:

```json
{
  "contractVersion": 1,
  "stream": "RUNTIME-SUPERVISION-C01",
  "releaseLabel": "atlas-d44f29e0",
  "productPin": "d44f29e04d359ad9b18e4443b0fd4fed1daeaecd",
  "releaseSha": "c5e167d7c5939ff586880149c566ce29506430e8",
  "sourceDir": "E:\\ATLAS-runtime-supervised-c5e167d7-20260925",
  "state": "running",
  "startedAt": "2026-09-25T12:41:00.140Z",
  "updatedAt": "2026-09-25T12:41:00.140Z",
  "ownedPids": { "server": 54256, "client": 77492 },
  "previous": null
}
```

Its `state: running` is a **stale historical record**, not a live claim: PIDs 54256 and 77492 are absent, and
this directory is not the active source dir. R1's logs total 22,737 bytes across 2 files. R2 has no logs
directory and no state file.

## PRESERVE_FOR_DECISION — 1 row (operator decision required, not taken here)

| # | Exact path | Why preserved |
| --- | --- | --- |
| P1 | `E:\ATLAS-runtime-supervised-4893cbde-20260923` | 1.80 GiB, the single largest E: item, and **a standalone clone, not a registered worktree** (`.git` is a directory), so `git worktree remove` does not apply — its removal is the riskier `Remove-Item` path in the policy. It was already carried as deferred-for-decision by the prior cycle. **Retiring it needs the operator's decision, not mine.** It is also not one of the two named last-resort artifacts. |

## KEEP — unchanged, and the resulting state

| Role | Path | Note |
| --- | --- | --- |
| LIVE | `E:\ATLAS-runtime-supervised-116a7658-20260726` | Scheduled task `ATLAS-Runtime-Supervisor` action is `node.exe "E:\ATLAS-runtime-supervised-116a7658-20260726\ops\runtime\cli.mjs" start`, status Running. Verified by task query, not by a previous session's PIDs. Not an ancestor of `main` (deliberate isolated line). |
| Accepted #1 (rollback basis) | `E:\ATLAS-runtime-supervised-861d89a2-20260925` | Most recent accepted before the live release. |
| Accepted #2 (rollback basis) | `E:\ATLAS-runtime-supervised-eb0e3038-20260925` | **Promoted into the keep set by the audit correction** — it is the second most recent accepted, newer than `c5e167d7`, and `live-state.md:53` names it a rollback basis. |
| One real dependency source | `E:\ATLAS-runtime-supervised-861d89a2-20260925` (156 entries) | The only keep-row with an intact tree. **Replaces `5c100ea6`, whose donor role is void.** Use a real copy, never a junction chain. |
| Last-resort artifacts | `D:\ATLAS-runtime-supervised-20260912` (`9d293879`) and `D:\ATLAS-runtime-fallback-d44-20260912` (`d44f29e0`) | On D:, untouched — not under warning. |

**Supersession this cycle forces on the register.** `docs/plans/live-state.md:691` records `5c100ea6` as
`PRESERVE_FOR_DECISION` "as a release directory only"; R2 retires it, so that line is superseded on execution.
`live-state.md:55-56` lists `c5e167d7` as a rollback basis; R1 displaces it, so it must be dropped from the
rollback list and marked RETIRED in the same closure that removes it, exactly as cycle `20260926a` did for
`ad8f9717`.

## Preconditions verified before this manifest was frozen

1. **Junction-dependent scan across every root** — every registered worktree, every `E:\ATLAS-*` and
   `D:\ATLAS-*` directory, and `D:\ATLAS`, checking `node_modules`, `atlas-client/node_modules` and
   `atlas-server/node_modules` for reparse points whose target contains `eb0e3038` or `5c100ea6`:
   **no dependents found.** This matters because two worktrees junctioned to `5c100ea6`'s empty
   `node_modules` earlier today, so a stale borrower was a real possibility.
2. **Dirt classification** — the only untracked path in R1 is `ops/runtime/logs/`, identical to the live
   release's, so R1 is not a dirty worktree in the policy's sense.
3. **No active process** — the supervisor's action names the live release only; neither R1 (`c5e167d7`) nor R2
   is named by any task action, and the boot task points at the live release. `ATLAS_RUNTIME_SOURCE_DIR` is the
   live release, so R1's `state: running` record is stale, not authoritative.
4. **Capacity at freeze** — E: 46.25 GiB, D: 60.66 GiB.

## Expected outcome and its honest limit

Retiring R1 + R2 returns ~2.39 GiB, taking E: to roughly **48.6 GiB — still below the 50 GiB warning line.**
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
