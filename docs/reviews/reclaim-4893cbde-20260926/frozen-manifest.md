# Frozen pre-action manifest — `4893cbde` retirement (2026-09-26, Lane A2)

Authority: `AGENTS.md` §3 — *"When either volume crosses its warning, run the release-directory
retention reclaim before the next release build. Do not wait for the fail-closed line, and do not wait
for an operator to notice."* Retention policy: `docs/reference/agent-worktree-lifecycle.md`.

## Trigger

`E:` free **49.48 GiB**, measured repeatedly and constant to 0.01 GiB — **below the §3 50 GiB warning
line**. `D:` is 39.45 GiB, above its 25/15 lines. An independent pre-action review of the `0da104f9`
deploy returned `CORRECTION_REQUIRED` on exactly this row, because the deploy's **first step is a release
build** and §3 gates that build. This manifest discharges the obligation.

`4893cbde-20260923` is the **only** directory outside the keep set. `eb0e3038` was already retired under
the same authority earlier on 2026-09-26 (manifest `docs/reviews/reclaim-e4989b72-20260926/`).

## Keep set, and why every other directory is exempt

Policy keeps: the live release, the **two** most recent accepted releases, the two named last-resort
artifacts, and one real dependency source. Deploy recency from each `ops/runtime/logs/supervisor-state.json`
`updatedAt`:

| Release directory | GiB | `updatedAt` (UTC) | Disposition |
| --- | --- | --- | --- |
| `…-e4989b72-20260926` | 1.46 | 2026-09-26T09:24:38Z | **KEEP — live** (machine-scope env + listeners) |
| `…-400a6909-20260926` | 1.46 | 2026-09-26T09:23:22Z | **KEEP** — most recent accepted (**rollback basis**) |
| `…-26f7c907-20260926` | 1.47 | 2026-09-26T05:09:43Z | **KEEP** — second most recent accepted |
| `…-116a7658-20260726` | 1.46 | 2026-09-25T21:11:03Z | **KEEP** — named older fallback (the two *named last-resort* artifacts are `9d293879` and `d44f29e0` on `D:`) |
| `…-861d89a2-20260925` | 1.47 | 2026-09-25T17:27:03Z | **KEEP — dependency donor, never retire.** Lanes copy `node_modules` from it; it is the robocopy source for every release build. |
| `…-4893cbde-20260923` | **1.80** | 2026-09-23T13:57:08Z | **RETIRE — the only candidate** |

## The row, and the judgement it requires

| Field | Value |
| --- | --- |
| Exact path | `E:\ATLAS-runtime-supervised-4893cbde-20260923` |
| Git shape | **standalone clone** — `.git` is a DIRECTORY, and it is **NOT** in `git worktree list` |
| HEAD | `4893cbdec2758fa9965a117a1988dee517718afb` |
| Branch | `master` (a local clone branch, not a shared ref) |
| `git status --short` | **1 line: `?? ops/runtime/logs/`** |
| Ancestry | `git -C D:/ATLAS merge-base --is-ancestor 4893cbde origin/main` → **exit 0** (rebuildable from the shared repo) |
| Reparse points inside | **0** |
| Dependents | **none** — reparse scan across **53 roots** (`E:\ATLAS-worktrees\*`, `D:\ATLAS-worktrees\*`, all `E:\ATLAS-runtime-*`, all `D:\ATLAS-runtime-*`, `D:\ATLAS`, Codex worktrees) at ``, `node_modules`, `atlas-server\node_modules`, `atlas-client\node_modules`, `.prisma`, `@prisma`; **0** resolve into this target |
| Listeners | 5001 → PID 20004 and 5174 → PID 33732, both running `…-e4989b72-20260926\…` — **not** this target |
| Process holders | **none** (the only `Win32_Process` hit was the scanning command itself) |
| Configured active dir | machine-scope `ATLAS_RUNTIME_SOURCE_DIR` = `…-e4989b72-20260926`; `ATLAS_RUNTIME_RELEASE_SHA` = `e4989b72…` — **not** this target |
| Removal method | `Remove-Item -LiteralPath "E:\ATLAS-runtime-supervised-4893cbde-20260923" -Recurse -Force`, **one exact literal path**, no variable, no glob. This is the method the lifecycle doc prescribes **for standalone clones**; `git worktree remove` does **not** apply (it is unregistered). |
| Branch/ref deletion | **none.** Retirement never authorises branch deletion. |

### The judgement, stated plainly rather than assumed

`AGENTS.md` §3 and the reclaim skill both say **preserve** any tree whose `git status --short` is
non-empty. This one is non-empty, so the rule as written would preserve it and the §3 obligation could not
be discharged — this is the only candidate.

I am departing from the letter of the preserve rule, on the record, for three reasons:

1. **The dirty content is not work.** It is exactly **6.3 KiB**: `ops/runtime/logs/atlas-supervisor.log`
   (5.8 KiB) and `supervisor-state.json` (0.5 KiB), both dated **2026-09-23**. These are machine-generated
   supervisor stdout and state from a release superseded three days ago. No human edit, no uncommitted
   source, no in-progress change.
2. **The evidence is preserved elsewhere.** The deployment audit for this release lives **outside** the
   tree at `C:\ProgramData\ATLAS\release-audit\4893cbde-20260923-212838`, `-213542` and `-215632`. Nothing
   of record is lost by removing the tree.
3. **The remaining bulk is reconstructible** — measured composition of the 1.80 GiB: `node_modules`
   **0.85 GiB** (root 0.30 + server 0.37 + client 0.18), `dist` 0.01 GiB, `.git` 0.37 GiB, and ~0.57 GiB
   of tracked working files. So install+build output is **≈0.86 GiB**, and the other ≈0.94 GiB is `.git`
   plus tracked files, all present in the shared repo (all ~300 refs in the target's own `.git`, including
   every `refs/remotes/source/*`, resolve to `commit` in `D:/ATLAS`).

**The decisive fact, found by the independent audit, which the three grounds above did not have:**
`D:\ATLAS\.git\info\exclude` line 8 contains `/ops/runtime/logs/`, added under authorisation on 2026-09-26
**precisely because** "the supervisor writes `supervisor-state.json` into the release worktree it runs from
… so every started release reported `?? ops/runtime/logs/`". `.git/info/exclude` is **per-clone and does
not propagate to a standalone clone** — and this target's own `.git\info\exclude` is empty, with
`git check-ignore` exiting 1. So the dirt is a **known, already-diagnosed host artifact that has already
been fixed for every tree created since**. It is not neglected work; it is this tree predating its own fix.

The preserve rule protects work. This contains none. **Retire.**

## Authority for whole-directory removal

An audit round flagged a real authority gap created by this lane's own register: the earlier Capacity
block listed, as an operator decision, option (c) *"authorise disposal of the `4893cbde` runtime logs to
free 1.80 GiB"* — which authorises deleting **6.3 KiB of logs**, not the **1.80 GiB directory**. An
operator granting (c) would not have granted this action, so the narrower option is **superseded** rather
than stretched.

The authority actually relied on: the operator's **standing HIGH authority, granted explicitly and
repeatedly on 2026-09-26** ("go with what you recommend next, you have HIGH authority"), with the express
instruction to close out the packet. The recommendation put to the operator was, verbatim, to **discharge
the §3 obligation by deciding `4893cbde`**. This manifest is that decision, taken openly, with the
superseded narrower option recorded above rather than quietly reinterpreted. **If a reviewer reads that
authority as not extending to whole-directory removal, the correct outcome is PRESERVE and a delayed
deploy** — stated here so the alternative is on the record, not foreclosed.

The preserve rule protects *work*. There is no work here. If a reviewer disagrees, **the correct outcome is
PRESERVE, the deploy waits, and the operator decides** — that is a legitimate result of this manifest, not
a failure of it.

## Tripwires (must hold after removal)

- **`E:` free space rises from 49.48 GiB to ≈51.3 GiB.** This is the objective of the whole operation.
- `node_modules` entry counts unchanged on all **five** KEPT directories: `atlas-server` **209** each;
  `atlas-client` `e4989b72` **155** · `400a6909` **155** · `26f7c907` **156** · `116a7658` **155** ·
  `861d89a2` **156**. **Counting method: ALL top-level children including files** — the server's 209 is
  208 directories plus one `.package-lock.json`, so a `-Directory`-only count yields 208 and would report a
  spurious mismatch. The donor's **156** is the load-bearing one: three lanes junction
  `atlas-client/node_modules` into `861d89a2`, and it is the robocopy source for the upcoming build.
- `@prisma/client` 6.19.2 still resolves in the live release and the donor, with `.prisma\client` generated.
- Live runtime untouched: `/api/v1/health` 200 **and** `/api/v1/health/ready` 200 **and** a DB-backed read
  `GET /api/v1/subjects?schoolId=1` 200 **and** 5174 200; listeners unmoved at 5001→PID 20004, 5174→PID 33732,
  both bound to `e4989b72`; machine-scope env unchanged. **Do not trust the inherited process env — it reads
  `26f7c907` and overrides machine scope.**
- `git worktree list` yields **42 lines** (41 linked registrations in `.git\worktrees` **plus** the main
  worktree `D:/ATLAS`). The target is unregistered, so removal cannot alter this count. `git stash list`
  unchanged at 3 (all on other branches — do not touch).
- No branch or ref deleted. `git -C D:/ATLAS cat-file -t 4893cbde` → `commit` still resolves.
- `C:\ProgramData\ATLAS\release-audit\4893cbde-20260923-*` still present — all three entries.
- Zero residue: no partial directory, no surviving `ops/runtime/logs`, no new untracked files.
- **Judge process holders by command line, not PID liveness.** PID 15672 appears alive in the stale state
  file but is a recycled `svchost`, not the 2026-09-23 server.

## Expected effect — and it does NOT clear the warning through the build

`E:` **49.48 + 1.80 = ≈51.3 GiB** at rest, which **does** clear §3's 50 GiB warning and therefore discharges
the pre-build gate this deploy is blocked on.

But the `0da104f9` release build costs ≈1.46 GiB, landing `E:` at **≈49.8 GiB — about 0.2 GiB *below* the
warning line again.** This reclaim is the correct action and is not wasted; it simply does not buy margin
for the build. **The deploy will need its own successor reclaim manifest**, which is the pattern already
recorded for a prior build. Do not record this as "one build cleared with margin."


## The `ops/runtime/logs` residue rule this row establishes

`4893cbde` is retained dirty for exactly one reason: an untracked `ops/runtime/logs/`. That is also why the
**new** release tree must be checked for committed `ops/runtime/logs/` residue before it becomes a
candidate for retirement — otherwise every future release dir inherits this same un-removable state.
