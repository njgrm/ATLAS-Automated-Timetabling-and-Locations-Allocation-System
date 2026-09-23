# Worktree And Dependency-Tree Lifecycle

Referenced by `AGENTS.md` §3. **Read this before creating, retiring, or cleaning up any
worktree, release directory, or dependency tree.** `AGENTS.md` remains the authority; this
file holds the mechanics so the directive stays short.

## Roots and capacity

- `E:/ATLAS-worktrees` is the root for every new planner, executor, QA, audit, and
  integration worktree. `D:/ATLAS-worktrees` is legacy-retention only — no new worktree
  there without an explicit operator decision. Branches, commits and pushed artifacts
  preserve history; retaining every checkout does not.
- Before creating a worktree, installing dependencies, or starting a heavy build, record the
  target volume's free space. On `D:`, **warn below 25 GiB, fail closed below 15 GiB** —
  PostgreSQL lives on `D:`, so database headroom is part of the gate.
- Keep at most **12 active task worktrees** across both roots. Integration worktrees count
  and must not persist as historical evidence.
- **The cap is on *active* worktrees — never on the registered total.** `git worktree list`
  necessarily includes trees that must be preserved by rule: dirty worktrees, unmerged
  candidates, `node_modules` junction anchors, the `D:\ATLAS-runtime-*` release trees retained
  under the retention policy above, Codex-managed worktrees, and `D:/ATLAS` itself. A registry count above 12 is therefore
  **not** a blocker and is never a reason to retire something uncertain. Observed 2026-09-21:
  exactly this misreading — reading the cap as a registry total — stalled Lane B's integration
  when the correct reading would have let it proceed immediately. If capacity genuinely
  pressures a lane, ask the planner to free space through the audited reclaim path; do not
  retire on your own authority.

## Create a registered worktree — never a clone

`git worktree add <path> -b <branch> <base>` from the shared repository. A **standalone clone**
(its own `.git` directory, its own `origin`) is not a worktree: it is invisible to
`git worktree list`, its commits are invisible to the integration boundary, and its `origin`
often points at a stale checkout rather than the real remote. Measured 2026-09-21: an executor
built its evidence "worktree" as a clone of the stale `D:/ATLAS`, committed the correction there,
and reported the SHA. The planner's `git merge <branch>` resolved a *different, older* commit of
the same branch from the shared repo, so `main` briefly carried the **uncorrected** evidence while
the planner believed the correction had been pushed. Nothing was lost, but only because the file
was re-verified afterwards.

Guard: after an executor returns a candidate SHA, run `git cat-file -t <sha>` **from the
integration boundary**. `fatal: Not a valid object name` means the work is not in the shared
repo — stop and transport it (`git fetch <clone-path> <branch>`) before integrating, never merge
a same-named branch on trust.

**Executors usually cannot create a worktree.** Measured 2026-09-21: the executor harness denies
`git worktree add` and `git worktree remove`. The **planner provisions** the executor's registered
worktree — and the release directory — before dispatch, and hands over the exact path. An executor
that finds no provisioned path must report `BLOCKED(environment)` and change nothing; inventing a
path or a SHA is the failure this rule exists to prevent. Conversely, never assume a worktree you
retired earlier still exists: re-check before naming it in a dispatch.

## Disposition

Every handoff states one: `KEEP_ACTIVE`, `RETIRE_AFTER_INTEGRATION`, or
`PRESERVE_FOR_DECISION`. Retire a candidate's clean inactive worktrees in the same closure
that integrates and pushes it.

## Before retiring anything, record

Exact path, branch or detached state, HEAD, the complete `git status --short`, ancestry or
tree-equivalence evidence, and any active process using it.

**Preserve every dirty worktree, unintegrated candidate, active stream, and uncertain
owner.**

## Retiring

`git worktree remove <exact-validated-path>` then `git worktree prune`.

Never `--force`, never raw recursive deletion, never a glob or a computed path. Retirement
never authorises branch deletion.

**Two bounded exceptions, each requiring a frozen manifest + independent pre-action audit +
post-action audit:**

1. **Runtime release directories are subject to the retention policy below** — they are not
   absolutely retained.
2. **A release directory created as a standalone clone is not a registered worktree**, so
   `git worktree remove` does not apply. Its removal is
   `Remove-Item -LiteralPath "<exact validated path>" -Recurse -Force`, one row at a time, gated on
   an empty per-row reparse scan and the recorded "before retiring" fields above. The prohibition on
   raw recursive deletion covers *worktrees and junctions*; it never licenses a glob, a computed
   path, or an unrecorded target.

## Never retire or modify

`D:/ATLAS`, Codex-managed worktrees, `D:/ATLAS-runtime-config`, PostgreSQL storage, companion
repositories, `stakeholderFiles`, or preservation/backup directories.

**Retention policy for `D:/ATLAS-runtime-*` (operator decision 2026-09-23).** These are **not**
absolutely retained: they accumulated to ~46 GiB because no rule defined the required rollback
depth, and routine hygiene ended up needing a one-off operator exception. **Keep** the live release,
the two most recent accepted releases, the two named last-resort artifacts (the supervisor reset
baseline and the manual fallback), and one real dependency source. **Retire** rollback depth beyond
that, plus junction pass-through directories whose dependents no longer exist. A deep rollback is a
**rebuild** (`git worktree add --detach <sha>` → install → `prisma generate` → builds), not an
instant re-point. Any reclaim under this policy still requires the frozen-manifest + pre-action-audit
+ post-action-audit cycle.

## Dependency trees

- **A fresh checkout is not gate-ready until `prisma generate` runs.** After `npm ci` in a new
  worktree, the server gates fail (`tsc` and the mutation suites) because the generated Prisma
  client is absent — the client lives inside `node_modules`, not in Git. Run it from
  `atlas-server` with `--schema` pointing at the **repo-root** schema. Observed 2026-09-21:
  Lane B stalled an otherwise-clean integration on this, believing `prisma generate` was a HIGH
  action.
- **`prisma generate` is a build/codegen step, not a HIGH action.** It reads the schema and
  writes into `atlas-server/node_modules/.prisma/client` (the schema's `output` resolves
  relative to the schema file). That path is inside `node_modules`; **no generated path is
  tracked**, so `git status` stays clean and an integration's merge scope does not grow. It
  makes **no database connection** — `migrate`, `db push` and every other schema command remain
  HIGH and separately approved. It is already listed as an authorized mutation inside the
  deploy boundary (`current-source-live-deploy-c02` §6.1). Treating it as HIGH stalls every
  fresh checkout forever.
- **Do not chain `node_modules` junctions across releases.** Junction only to a *stable*
  target: a chain rooted at a retired release breaks `@prisma/client` for every release at
  once, which has already taken the live runtime down. Each release owns its dependency tree
  or junctions to one that will not be retired.
- Never run an install through a shared junction, and never count or delete its target
  during cleanup.
- A release that is a rollback basis is a do-not-retire dependency **within the retention policy
  above** (live + the two most recent accepted): record it in `docs/plans/live-state.md` when a
  deployment makes it one, and drop it from that list when a later accepted release displaces it.
- **A deployment is not complete until `docs/plans/live-state.md` names the new release and its
  rollback basis.** Observed 2026-09-23: the live release moved **twice in one session**
  (`7ac28124` → `89012430` → `0232bf9c`) while the register still named the previous one. That stale
  premise cost a review cycle and would mislead any next session — the register's own protocol calls
  an undated pending line "a premise error waiting to happen".
- **Never echo a credential value.** Read it inside a process and inject the result; never print it,
  never paste it into a prompt, a log, or a browser field. Observed 2026-09-23: the live QA credential
  was found in **8 plaintext files across earlier sessions** plus an agent transcript, because the
  credential file wraps values in markdown backticks and a naive parse submitted them literally.
