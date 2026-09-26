# Frozen pre-action manifest — E: release-directory reclaim (2026-09-26, Lane A2)

Authority: `AGENTS.md` §3 (act on the **warning** line, not the fail-closed line) and the retention
policy in `docs/reference/agent-worktree-lifecycle.md`. Target volume `E:`.

## Trigger

`E:` free **48.54 GiB** (measured this session, `Get-PSDrive E`), below the §3 **50 GiB warning**
line. `C:` is 42.90 GiB and is not a concern. The §3 reclaim trigger is met and is **owed**; this
manifest exists to execute it safely, not to decide whether to.

## Measured volume state before removal

| Release directory | Size | State-file `updatedAt` (UTC) | Disposition |
| --- | --- | --- | --- |
| `ATLAS-runtime-supervised-e4989b72-20260926` | 1.46 GiB | 2026-09-26T09:24:38Z | **KEEP — live** |
| `ATLAS-runtime-supervised-400a6909-20260926` | 1.46 GiB | 2026-09-26T09:23:22Z | **KEEP** — most recent accepted release (rollback basis) |
| `ATLAS-runtime-supervised-26f7c907-20260926` | 1.47 GiB | 2026-09-26T05:09:43Z | **KEEP** — second most recent accepted release |
| `ATLAS-runtime-supervised-116a7658-20260726` | 1.46 GiB | 2026-09-25T21:11:03Z | **KEEP** — immediately prior rollback basis, older fallback named in history (the two *named last-resort* artifacts are `9d293879` and `d44f29e0` on `D:`) |
| `ATLAS-runtime-supervised-861d89a2-20260925` | 1.47 GiB | 2026-09-25T17:27:03Z | **KEEP — dependency donor, never retire** (lanes copy `node_modules` from it) |
| `ATLAS-runtime-supervised-eb0e3038-20260925` | 1.46 GiB | 2026-09-25T14:20:17Z | **RETIRE** — row R1 below |
| `ATLAS-runtime-supervised-4893cbde-20260923` | 1.80 GiB | 2026-09-23T13:57:08Z | **PRESERVE** — dirty (row X1 below) |

## Row R1 — the only removal

| Field | Value |
| --- | --- |
| Exact path | `E:\ATLAS-runtime-supervised-eb0e3038-20260925` |
| Git shape | **registered linked worktree** (`.git` is a file), `detached` — listed in `git worktree list --porcelain` |
| HEAD | `eb0e30386336673a4a31ecfe39a9bef93549e0ed` |
| Branch | detached (no branch ref; nothing to delete) |
| `git status --short` | **empty** (0 lines) |
| Ancestry | `git -C D:/ATLAS merge-base --is-ancestor eb0e3038 origin/main` → **exit 0** (rebuildable from the shared repo) |
| Reparse points inside target | **0** (`Get-ChildItem -Recurse -Attributes ReparsePoint`) |
| Dependents | **none** — reparse scan across **53 roots** (`E:\ATLAS-worktrees\*`, `D:\ATLAS-worktrees\*`, all `E:\ATLAS-runtime-*`, all `D:\ATLAS-runtime-*`, `D:\ATLAS`, Codex worktrees) at ``, `node_modules`, `atlas-server\node_modules`, `atlas-client\node_modules`, `atlas-server\node_modules\.prisma`, `atlas-server\node_modules\@prisma`; **0** resolve into this target |
| Process holders | **none** (`Win32_Process` command-line scan; the only regex self-hit was the scanning command itself) |
| Listeners | 5001 → PID 20004 and 5174 → PID 33732, both `E:\ATLAS-runtime-supervised-e4989b72-20260926\...\dist\server.js` / `ops\runtime\host.mjs` — **not** this target |
| Configured active dir | machine-scope `ATLAS_RUNTIME_SOURCE_DIR` = `E:\ATLAS-runtime-supervised-e4989b72-20260926`; `ATLAS_RUNTIME_RELEASE_SHA` = `e4989b725394204898ebcd429db74daaf7316323` — **not** this target |
| Removal method | `git -C D:/ATLAS worktree remove E:/ATLAS-runtime-supervised-eb0e3038-20260925` then `git -C D:/ATLAS worktree prune`. **Not** `--force`. **Not** `Remove-Item -Recurse -Force` — that exception is for standalone clones, and this is a registered worktree. |
| Branch/ref deletion | **none.** Retirement never authorises branch deletion. |

## Row X1 — preserved, not removed

`E:\ATLAS-runtime-supervised-4893cbde-20260923` reports `?? ops/runtime/logs/`. `AGENTS.md` §3 and the
skill classification both **preserve** any tree with a non-empty `git status --short`. It is 1.80 GiB
and is **held** rather than reclaimed. Its logs are untracked supervisor output from when that release
ran; whether they are disposable is an operator decision, not one to assume while reclaiming.

## Two corrections to the recorded reclaim table

The table in `ae523c9d` (and handoff §1) is wrong in two ways that matter. Both were caught by
re-deriving rather than trusting it:

1. **It classified `26f7c907` as reclaimable.** It is the **second most recent accepted release**, which
   the retention policy keeps. Removing it would have destroyed a keep-set rollback basis (a *rebuild*,
   not an instant re-point) for no capacity gain that the two remaining rows could not already give.
2. **It described all three rows as standalone clones needing "non-forced removal".** Two of the three
   (`26f7c907`, `eb0e3038`) are **registered linked worktrees**, so `git worktree remove` applies and
   `Remove-Item -Recurse -Force` would have left a stale registration.

**Consequence: the true reclaimable set is ONE directory / 1.46 GiB, not 3 / 4.36 GiB.** `E:` goes
48.54 → ~50.0 GiB, which reaches the 50 GiB warning line but does **not** clear it with margin. See
"Capacity consequence" below — this is an operator decision and is not self-resolved here.

## Tripwires (must hold after removal)

- `node_modules` entry counts on all **five** KEEP directories must be unchanged from the pre-reclaim
  baseline below. `atlas-server` = **209** for each; `atlas-client` =
  `e4989b72` **155** · `400a6909` **155** · `26f7c907` **156** · `116a7658` **155** ·
  `861d89a2` **156**. This proves no junction was followed into a preserved tree. The donor
  `861d89a2` matters most: three live lanes junction `atlas-client/node_modules` into it.
- `@prisma/client` must still resolve inside the live release and the donor.
- Live runtime untouched: `/api/v1/health` 200 **and** `/api/v1/health/ready` 200 **and** a DB-backed
  read (`GET /api/v1/subjects?schoolId=1`) 200 **and** 5174 200. Listener PIDs must remain
  supervisor `4252`, server `20004`, client `33732`, all resolving to `e4989b72`.
- `git worktree list` count falls 42 → 41; the keep-set release worktrees and the donor still resolve.
- `git stash list` unchanged (3 entries); no branch or ref deleted.

## Recorded coupling — do not reach for `--force`

Non-forced `git worktree remove` succeeds here **only** while
`D:\ATLAS\.git\info\exclude:8` (`/ops/runtime/logs/`) is in place; `git check-ignore` attributes the
target's own state file to it, which is why the tree is genuinely clean. If that exclude is ever
removed the target becomes dirty, non-forced removal refuses, `--force` is forbidden, and
`Remove-Item` would leave a stale registration. Satisfied at manifest time; recorded so a future
reclaim does not force past the refusal.

The target's own `supervisor-state.json` still reads `state: "running"` with `ownedPids` that no longer
exist. That is stale residue from its last run, not evidence of a live runtime; liveness is decided by
machine-scope env, listener ownership, and the process table.


## Pre-action audit

One fresh independent read-only auditor (not the implementer) re-derived all of the above rather than
reading it: **`CLEAR_TO_PROCEED`, 12/12/0/0**, five findings, **all NON_BLOCKING**, no disposition
changed. It confirmed `eb0e3038` ranks **6th** by `updatedAt` across **both** volumes and fills none of
the six keep-set slots, and it strengthened the dependents row beyond the manifest by running a full
recursive reparse scan of every ATLAS root: 8 reparse points total, the only destinations being
`861d89a2` and `0eb3b67fe94c`, **0** into the target.

Two of its findings were **my** errors and are corrected above rather than left standing: the tripwire
baseline omitted the donor's `atlas-client` count of **156** (I transcribed four values for five
directories, having measured all five), and the `116a7658` role label was imprecise. Its third finding
— that `docs/plans/live-state.md` on `origin/main` still reads "DEPLOY IN PROGRESS — target `400a6909`,
rollback basis `26f7c907`" while the machine serves `e4989b72` — is a register reconciliation owed in
this cycle's closure, not a reclaim blocker.

## Capacity consequence (operator decision, not actioned here)

After this reclaim `E:` sits at ~50.0 GiB — at the warning line. The next release build adds ~1.46 GiB
and returns `E:` to ~48.5 GiB, i.e. **below the warning again, one deploy from the 25 GiB fail-closed
line.** The keep set cannot absorb that. Resolving it needs an explicit operator decision, not a
planner's deletion: (a) drop the second-most-recent-accepted rollback basis with a recorded exception,
(b) relocate release directories to another volume, or (c) authorise disposal of the `4893cbde` runtime
logs to free that 1.80 GiB. None is taken here.
