---
name: atlas-companion-sync
description: Sync and pin a READ_ONLY companion mirror (EnrollPro, AIMS, SMART) before reading its source, benchmarking its UX, or citing its behaviour, and write a handoff when a defect belongs to it. Use whenever ATLAS work touches D:/EnrollPro, D:/AIMS or D:/smart-final-capstone.
metadata:
  short-description: Sync-before-inspect for READ_ONLY companion repos
---

# ATLAS companion sync

Authority: `AGENTS.md` §4. Companion clones are **READ_ONLY**: never edit source, config,
migrations, lockfiles, generated files, docs or Git history; no installs, formatters,
migrations, seeds, or snapshot-updating tests. "Fix consumers" or "make integration pass" is
not write authority — that needs a new explicit instruction naming the repo and scope.

## Remotes (check, don't assume)

| Mirror | Tracks |
|---|---|
| `D:/smart-final-capstone` | upstream `madebyseaan/smart-final-capstone` |
| `D:/EnrollPro` | fork `njgrm/EnrollPro` |
| `D:/AIMS` | fork `njgrm/AIMS` |

`git -C <mirror> remote -v` to confirm.

## Sync before you inspect

1. `git -C <mirror> status --short` must be empty. If dirty: **stop** — no stash, reset, clean
   or pull; report the state.
2. `git -C <mirror> fetch --all --prune`.
3. Fast-forward only: `git -C <mirror> merge --ff-only <remote>/main`.
4. Record the exact pin (`git -C <mirror> rev-parse HEAD`) in the artifact that cites it.
   Evidence without a pin is invalid.

Bringing a fork in step with upstream: prove there are no fork-only commits
(`git merge-base --is-ancestor fork/main upstream/main`), then fast-forward push. Never
force-push a companion repo.

## When the defect is theirs

Write a developer-facing handoff in `docs/handoffs/` (in ATLAS) with: the upstream commit pin,
exact source path:line evidence, the required contract, and acceptance tests. Do not implement
the external patch.
