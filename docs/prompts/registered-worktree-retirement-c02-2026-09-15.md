# WORKTREE-RETIRE-C02 — registered historical worktree retirement

Status: `DEFERRED_READY` (execute only after the active lanes named below are
terminal or explicitly preserved).

## 1. Dispatch identity and prerequisites

- Role: **fresh primary Planner** with one read-only Inventory Auditor, one
  bounded Retirement Executor, and a fresh post-action QA/Auditor.
- Refresh `origin/main` and read its tracked `AGENTS.md`; record the exact tip
  and LF-normalized directive SHA-256.
- Control worktree: `E:/ATLAS-worktrees/worktree-retirement-c02`.
- Branch: `work/worktree-retirement-c02`.
- Worktree disposition: `RETIRE_AFTER_INTEGRATION`; this control worktree is
  removed last, after its evidence is integrated and pushed.
- Preferred prerequisite: WF-C04 is integrated so active lanes and leases can be
  read from the machine registry. If WF-C04 is not complete, this packet may run
  **inventory only** and must not retire any uncertain worktree.

At the 2026-09-15 planning observation Git reported 80 registered worktrees: 63
under legacy `D:/ATLAS-worktrees`, nine under `E:/ATLAS-worktrees`, plus the root,
runtime releases, Codex-managed checkouts, and a temporary OpenCode checkout.
Only four ordinary lanes were believed active. These counts are historical and
must be recomputed; they are not deletion targets or pass conditions.

## 2. Hard stop before retirement

Do not begin retirement while any of these observed lanes is still running,
awaited, dirty, under review, or lacks an authoritative terminal disposition:

- `BENEFICIARY-EXPORT-PARITY-C05`;
- `COMPANION-SSO-LIVE-PREP-C02` and its Option-A successor decision;
- `TL-OPERATOR-WORKSPACE-C05`;
- `WF-C03` integration/closure.

The names above are a historical minimum, not a complete active set. Reconcile
the canonical machine registry, leases, OpenCode/Codex session evidence, Git
worktree list, active processes, and current register before classifying any
path. A missing registry record is uncertainty, never permission to remove.

## 3. Inventory and classification

For every registered worktree, record:

- exact resolved path and approved root/direct-child proof;
- branch or detached state and HEAD;
- complete `git status --short` and untracked/ignored summary;
- current `origin/main` and ancestry/tree-equivalence evidence;
- candidate/integration/audit references in machine state and repository docs;
- active lease, session, process, runtime, successor, or preservation owner;
- dependency-tree/junction target and whether the target is shared;
- estimated on-disk size without following shared junction targets;
- final class: `ACTIVE_KEEP`, `DIRTY_PRESERVE`, `UNINTEGRATED_PRESERVE`,
  `RUNTIME_EXCLUDED`, `CODEX_EXCLUDED`, `TEMP_UNCERTAIN`,
  `TERMINAL_ELIGIBLE`, or `PLANNER_DECISION_REQUIRED`.

No inference from an old branch name, directory age, or clean status is enough.
Only `TERMINAL_ELIGIBLE` paths may advance to retirement.

## 4. Permanent exclusions

Never remove or modify through this packet:

- `D:/ATLAS`;
- any path under `C:/Users/njgro/.codex/worktrees`;
- `D:/ATLAS-runtime-*` or `D:/ATLAS-runtime-config`;
- PostgreSQL storage;
- companion repositories, `stakeholderFiles`, backups, or preservation archives;
- any active/unknown OpenCode temporary checkout;
- any dirty, unintegrated, under-review, active, leased, process-owned, or
  successor-owned worktree;
- any junction/symlink target outside the exact worktree being retired.

## 5. Eligibility proof

A path is `TERMINAL_ELIGIBLE` only when all are true:

1. it is a resolved direct child of `D:/ATLAS-worktrees` or
   `E:/ATLAS-worktrees`;
2. it is clean, including no material untracked evidence;
3. no live/uncertain lease, task, process, or session owns it;
4. its candidate is integrated into current `origin/main`, or its complete tree
   is proven byte-equivalent to an integrated tree;
5. all required QA/audit artifacts and branch/commit history are pushed or
   otherwise durably preserved;
6. no register row, prompt, successor, runtime, or rollback action requires the
   checkout;
7. its disposition is `RETIRE_AFTER_INTEGRATION`, or the head planner explicitly
   changes a stale disposition after reviewing the evidence;
8. removing the checkout cannot delete a shared dependency-tree target.

Any failed or unavailable proof changes the class to a preserve/decision state.

## 6. Retirement execution

- Freeze the reviewed manifest before mutation and obtain fresh QA acceptance of
  its classifications.
- Recheck every target immediately before removal. Stop if its HEAD, status,
  owner, lease, process, registry state, or `origin/main` relationship changed.
- Retire one exact validated path at a time with:

```text
git worktree remove <exact-validated-path>
git worktree prune
```

- Never use `--force`, `Remove-Item`, `rm`, a glob, a computed unresolved path,
  branch deletion, reset, clean, stash, or recursive filesystem deletion.
- After each removal, verify the directory is absent, the Git registration is
  gone, the branch still exists, and no excluded path changed.
- Stop at the first unexpected result. Previously completed exact removals may
  remain; report the partial manifest honestly and do not widen the command.

## 7. Required evidence and acceptance

- before/after registered-worktree count by root and classification;
- before/after free bytes on C, D, and E;
- exact retired paths with branch/HEAD and integration proof;
- exact preserved paths with reason/owner;
- explicit proof that active lanes, runtime releases, root checkout, Codex
  checkouts, temporary uncertain checkouts, PostgreSQL, companions, backups,
  and shared dependency targets were untouched;
- `git worktree list --porcelain` and `git worktree prune --dry-run` after the
  final removal;
- root and all preserved active worktrees retain their pre-action status/HEAD;
- machine registry and generated register remain verifier-clean; record
  retirement disposition changes through the atomic workflow operation when
  available, not by competing prose edits;
- fresh post-action QA rechecks a sample of retired and every protected class;
- Wave Completion Audit verifies no eligible target was skipped without reason
  and no protected target was removed.

The success metric is not “delete all old worktrees.” Success is a smaller,
fully explained registered set with zero loss and no ambiguous ownership.

## 8. Boundaries

No product/source correction, dependency install, build, database access or
mutation, migration, runtime/task/env/listener change, browser action/login,
term-cache action, Teaching Load write, generation, publication, companion edit,
branch deletion, or deletion outside the exact eligible linked worktrees.

## 9. Return contract

Return the frozen manifest, all role IDs, complete QA/audit tallies, exact paths
retired/preserved, before/after counts and free space, any stopped partial state,
machine-state revision/receipt, integration/final remote SHAs for evidence, and
the disposition of this control worktree.

Suggested commit:

```text
chore(worktrees): retire validated historical checkouts
```
