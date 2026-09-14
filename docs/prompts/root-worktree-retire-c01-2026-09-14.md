# CYCLE ON: ROOT-WORKTREE-RETIRE-C01

## Role and objective

ROLE: PRIMARY PLANNER controlling one guarded cleanup executor and two fresh
read-only auditors (pre-action manifest audit, then post-action verification).

Safely reduce `D:/ATLAS-worktrees` from historical execution storage to the
small set of genuinely active or decision-pending worktrees. Preserve every
active, dirty, unintegrated, uncertain, runtime, backup, companion, and
Codex-managed checkout. This cycle authorizes retirement only of registered,
clean, merged, inactive worktrees proven eligible below. It does not authorize
branch deletion.

Observed dispatch boundary (refresh before use):

- Repository: `D:/ATLAS`
- `origin/main`: `be1a2d6f4402729ee85d1cf379332e516c16b51e`
- `D:` free space at authorship: approximately 7.08 GiB
- Registered worktrees at authorship: 101 total, 93 under
  `D:/ATLAS-worktrees`

Those counts are observations, not deletion authority. Recompute them at
execution time. Because `D:` is below the 15 GiB hard floor, do not create a
new full worktree or install dependencies for this cycle. Operate from the
clean root checkout only after refreshing it by fast-forward; if it is dirty or
cannot fast-forward, stop with `PLANNER_DECISION_REQUIRED` rather than stashing,
resetting, cleaning, or absorbing changes.

Read current `origin/main:AGENTS.md` and record its LF-normalized SHA-256 before
dispatch. The Workspace Capacity And Worktree Lifecycle Rule governs this
cycle.

## Exact authorized scope

The only filesystem retirement scope is a registered Git worktree whose
resolved canonical path is a direct child of:

`D:/ATLAS-worktrees`

Use PowerShell and Git end to end. Remove an eligible worktree only with:

`git worktree remove <exact-literal-path>`

Do not use `--force`, `Remove-Item -Recurse`, `rd`, `rmdir`, wildcards, string-
built shell commands, or cross-shell path pipelines. Do not delete any local or
remote branch in this cycle.

## Always-preserved boundaries

Never remove or modify:

- `D:/ATLAS`;
- anything outside `D:/ATLAS-worktrees`;
- Codex-managed worktrees under `%USERPROFILE%/.codex/worktrees`;
- `%TEMP%/opencode` workspaces;
- `D:/ATLAS-runtime-*`, `D:/ATLAS-runtime-config`, or supervisor/task state;
- PostgreSQL data, databases, fixtures, backups, or restore drills;
- `D:/ATLAS-checkout-preserve-20260914` or any preservation/archive directory;
- `stakeholderFiles` or any EnrollPro, AIMS, SMART, or other companion clone;
- ports, processes, Tailnet/Tailscale configuration, environment files, or live
  runtime state.

## Eligibility contract

A worktree is removable only when every row below is independently `PASS`:

1. Its canonical path is a direct child of `D:/ATLAS-worktrees`.
2. It appears in `git worktree list --porcelain` and is not the main checkout.
3. Its complete `git status --short` is empty, including tracked and untracked
   files. A stale-index or EOL ambiguity is resolved read-only first.
4. Its HEAD is an ancestor of refreshed `origin/main`, or its entire committed
   tree is proven byte-equivalent to a specifically named integrated commit.
   Ancestry is preferred. A branch merely being pushed is not integration.
5. The current living register contains no `RUNNING`, `AWAITED`,
   `REVIEW_REQUIRED`, `ACCEPT_READY`, `BLOCKED`, `HIGH_APPROVAL_REQUIRED`, or
   successor ownership that still names the worktree.
6. No active OpenCode/Codex planner, executor, QA, browser custodian, terminal,
   process command line, or current user handoff owns or references it.
7. It is not needed as the only local source of an unpushed commit, review
   artifact, or unresolved correction.
8. It contains no junction/symlink target that would be treated as owned data;
   retirement may unlink the worktree entry but must never delete a shared
   target.

Any `FAIL`, ambiguity, lookup error, locked file, or unexpected state means
`PRESERVE_FOR_DECISION`. Do not negotiate the gate downward to increase freed
space.

## Required cycle

### Phase 1 — inventory and manifest

1. Fetch/prune remotes and fast-forward the clean root to `origin/main`.
2. Record free space and `git worktree list --porcelain`.
3. Parse the living register and current process command lines. Do not infer
   activity only from a directory's existence.
4. Produce `docs/reviews/root-worktree-retire-c01-20260914/pre-action-manifest.md`
   with one row per registered direct child of `D:/ATLAS-worktrees`:
   exact path, branch/detached state, HEAD, clean/dirty, merged/equivalent,
   register state, process/session evidence, disposition, and reason.
5. Report totals for `ELIGIBLE_TO_RETIRE`, `KEEP_ACTIVE`, and
   `PRESERVE_FOR_DECISION`. Record volume free space without recursively
   traversing junction targets or presenting junction-inflated apparent size as
   physical usage.

### Phase 2 — fresh pre-action audit

Freeze the manifest commit. A fresh read-only auditor must reproduce every
eligibility predicate for every `ELIGIBLE_TO_RETIRE` path and return either:

- `AUDIT_CLEAR` with `passed == total`, `blocked == 0`, and
  `unperformed == 0`; or
- `CORRECTION_REQUIRED`, naming exact rows to preserve or correct.

The auditor must not remove worktrees, edit the register, or reinterpret an
uncertain owner as inactive. Do not begin retirement before `AUDIT_CLEAR`.

### Phase 3 — guarded retirement

For each audited eligible path, one at a time:

1. Resolve and re-check the literal path, status, ancestry/equivalence, register
   state, and process/session references immediately before removal.
2. Run `git worktree remove <exact-literal-path>` without `--force`.
3. On the first refusal, lock, unexpected dirty state, or ownership change,
   preserve that path, record the result, and continue only with paths whose
   independent gates remain valid.
4. Process batches of no more than 10 removals. After each batch, record `D:`
   free space and re-run `git worktree list --porcelain`.
5. Once all approved rows are processed, run `git worktree prune` and no other
   pruning/deletion command.

Do not remove the branch refs. Do not use the freed space to install packages,
build, deploy, migrate, or begin another stream inside this cycle.

### Phase 4 — post-action audit and closure

A fresh read-only auditor shall verify:

- every removed path was in the audited manifest and met all predicates;
- every preserved path still exists and its status/HEAD are unchanged;
- root, runtime, preservation, PostgreSQL, companion, Codex, and temporary
  boundaries were untouched;
- current registered worktree count and free space;
- no branch was deleted;
- root remains clean and `origin/main` continuity is intact;
- the living register names retained active/decision worktrees and contains no
  false claim that all worktrees were removed.

Commit the post-action evidence and the smallest register reconciliation, then
push only after the audit returns `AUDIT_CLEAR`. If the free-space result remains
below 15 GiB, close as `CLEANUP_INCOMPLETE_CAPACITY_BLOCKED` with the exact
preserved categories; do not widen deletion authority.

## Return contract

Return one terminal report containing:

- verdict;
- starting and ending `origin/main` SHA;
- AGENTS normalized SHA-256;
- starting and ending free GiB;
- starting and ending registered worktree counts;
- exact removed paths with recorded branch and HEAD;
- exact preserved paths grouped by active, dirty, unmerged, uncertain, or
  excluded boundary;
- pre-action and post-action auditor IDs and tallies;
- proof no branch/runtime/database/backup/companion boundary was changed;
- manifest/evidence paths and pushed commit SHA;
- one next action if capacity remains blocked.

This is a repository-hygiene action only. No product source edit, dependency
install, test/build, browser session, login, deployment, migration, database
write, Teaching Load action, generation, publication, or companion-system
change is authorized.
