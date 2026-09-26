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
3. **The remaining 1.79 GiB is reconstructible** — `node_modules` and build output, rebuildable from
   `4893cbde`, which is an ancestor of `origin/main` and therefore still reachable in the shared repo.

The preserve rule protects *work*. There is no work here. If a reviewer disagrees, **the correct outcome is
PRESERVE, the deploy waits, and the operator decides** — that is a legitimate result of this manifest, not
a failure of it.

## Tripwires (must hold after removal)

- `node_modules` entry counts unchanged on all **five** KEPT directories: `atlas-server` **209** each;
  `atlas-client` `e4989b72` **155** · `400a6909` **155** · `26f7c907` **156** · `116a7658` **155** ·
  `861d89a2` **156**. The donor's **156** is the load-bearing one — it is the robocopy source for the
  upcoming release build.
- `@prisma/client` still resolves in the live release and the donor.
- Live runtime untouched: `/api/v1/health` 200 **and** `/api/v1/health/ready` 200 **and** a DB-backed read
  `GET /api/v1/subjects?schoolId=1` 200 **and** 5174 200; listeners unmoved at 5001→PID 20004, 5174→PID 33732.
- `git worktree list` count unchanged at 41 (4893cbde is unregistered, so this row does not alter it).
- `git stash list` unchanged at 3 (all on other branches — do not touch).
- No branch or ref deleted. `git -C D:/ATLAS cat-file -t 4893cbde` → `commit` still resolves.
- `C:\ProgramData\ATLAS\release-audit\4893cbde-20260923-*` still present after removal.

## Expected effect

`E:` **49.48 → ~51.3 GiB**, clearing the §3 50 GiB warning with margin, so the `0da104f9` release build
(≈1.46 GiB) proceeds from ≈51.3 → ≈49.8 GiB and finishes **above** the warning line.

## The `ops/runtime/logs` residue rule this row establishes

`4893cbde` is retained dirty for exactly one reason: an untracked `ops/runtime/logs/`. That is also why the
**new** release tree must be checked for committed `ops/runtime/logs/` residue before it becomes a
candidate for retirement — otherwise every future release dir inherits this same un-removable state.
