# BLOCKED — main is ahead of origin/main and cannot be pushed

**Recorded 2026-10-03 by planner (Hermes). Do not let a release assume this is resolved.**

## State

- `main` (local, in `D:/ATLAS`) is at `7378dbbd`.
- `origin/main` is at `4c4682b9`.
- Unpushed: exactly one commit, docs-only:
  - `7378dbbd docs(release): drop the deploy-count cap and quiet-hours blackout`
  - files: `docs/plans/operator-decisions.md`, `ops/lane-c/codex/MANAGER.md`, `ops/lane-c/codex/PLANNERS.md`

Verified docs-only with `git diff --name-only origin/main..main` — no product source.

## Why it is blocked

`git push origin main` was attempted twice and failed. The second attempt with prompts
explicitly disabled returned the exact cause:

```
error: cannot spawn /nonexistent: No such file or directory
fatal: could not read Username for 'https://github.com': terminal prompts disabled
```

Remote is `https://github.com/njgrm/ATLAS-Automated-Timetabling-and-Locations-Allocation-System.git`.
`git config credential.helper` = `helper-selector`, which opens an **interactive** prompt — a
non-interactive agent shell cannot answer it, so the first attempt hung until timeout. Reads work
(`git ls-remote origin HEAD` succeeds), so this is purely a write-credential gap. No `gh` CLI is
installed.

**Operator action:** run this yourself in a terminal where GitHub auth is available (it will
prompt once, and `helper-selector` can store it):

```
cd D:\ATLAS
git push origin main
```

## Why this blocks a release

`ops/runtime/release/release-request.ps1` and `deploy-runner.ps1` both read
`docs/plans/live-state.md` **from `origin/main`** (`-LiveStateRef 'origin/main'`), and the
gate refuses unless the `## Live release` section names both the target prefix and the
incumbent/rollback prefix. The same applies to `release-prepare.ps1`'s pinned tree.

So any release record must be committed AND pushed to `origin/main` before a cutover can be
requested. A local-only commit is invisible to the gate.

## Note for whoever picks this up

The release worktree `E:\ATLAS-worktrees\lane-a4-release-20261003-trains` is currently at
`4c4682b9`, i.e. it does NOT contain `7378dbbd`. After the push lands, fast-forward it:

```
git -C E:/ATLAS-worktrees/lane-a4-release-20261003-trains fetch origin
git -C E:/ATLAS-worktrees/lane-a4-release-20261003-trains merge --ff-only origin/main
```

Verified train candidates to merge onto that target afterwards:
`d52f5355` (auth enforcement) and `5e31b698` (tab affordance + break band).
Both are independently verified; auth review verdict was ACCEPTED with zero blocking findings.