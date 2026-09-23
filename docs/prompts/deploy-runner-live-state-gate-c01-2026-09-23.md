# DEPLOY-RUNNER-LIVE-STATE-GATE-C01

**Tier:** MEDIUM production tooling. **Author:** Lane A (primary planner). **Date:** 2026-09-23.
**Base:** `origin/main` = `d75776cf523aec90e4e008da7cd43f2f48097547`.
**Worktree:** `E:\ATLAS-worktrees\deploy-gate-c01` (branch `work/deploy-gate-c01`). Dependencies are **not
required** — this change and its suite are node/PowerShell only (`npm run runtime:test`); **do not run
`npm ci`**.

## Why

The release-directory retention cycle established a rule in `docs/reference/agent-runtime-deploy-facts.md`:
*a deployment is not complete until `docs/plans/live-state.md` names the new release and its rollback
basis.* That rule is prose, and it failed **twice in one session** on 2026-09-23 — the live release moved
`7ac28124` → `89012430` → `0232bf9c` while the register still named the previous one. A stale premise cost
a full review cycle and would have misled any next session.

This packet converts the rule into a gate: **the runner refuses to perform a cutover while the currently
live release is unrecorded.**

## Contract

Add a **fail-closed pre-mutation gate** to `ops/runtime/deploy-runner.ps1`:

1. **Pure predicate (unit-testable, no I/O).** A function that takes the live-state **text** and the
   incumbent release SHA and throws `DEPLOY_RUNNER_STOP` (the runner's existing `Fail` form) when the
   **Live release section** does not name that release. The section is the text between the
   `## Live release` heading and the next `## ` heading. Matching is on the **8-character SHA prefix**
   (e.g. `0232bf9c`) appearing inside that section. The error message must name the missing prefix, the
   file, and the ref checked. A SHA that appears only *outside* the Live release section must **not**
   satisfy the gate.
2. **Input resolution.** Resolve the **shared repository** from `-TargetSourceDir` (the target is a
   registered worktree of it) and read `docs/plans/live-state.md` from a **committed** ref — new parameter
   `-LiveStateRef`, default `origin/main`. Read it with `git show <ref>:docs/plans/live-state.md` so the
   check does not depend on any working tree being clean or current. A missing file, a missing ref, or an
   empty read is a hard failure, never a pass.
3. **Placement.** Invoke the gate in `Invoke-DeploymentRunner` **after** `Assert-Administrator` and the
   target/machine identity checks, and **before** the audit directory is created and before any mutation.
   It must run in **dry-run as well as `-Execute`** — a dry run that would be refused must say so.
4. **No new authority.** The gate never mutates anything, never writes live-state, and never relaxes an
   existing check. It only refuses.
5. **Do not change** the byte-preserving task-XML logic, the supervisor-lineage check, the rollback block,
   the parameter validation, or the dry-run/execute semantics. Do not add `npm`, `prisma`, or database
   operations (an existing test asserts these are absent).

## Acceptance rows — each names the harness that decides it

| # | Row | Harness |
|---|---|---|
| A1 | The predicate passes when the 8-char incumbent prefix appears in the Live release section | unit test via dot-sourced PowerShell invocation |
| A2 | The predicate throws `DEPLOY_RUNNER_STOP` naming the missing prefix when the section omits it | unit test |
| A3 | The predicate throws when the prefix appears **only outside** the Live release section | unit test (failing-first control — this must fail against a naive whole-file `-match` implementation) |
| A4 | The gate is invoked before the mutation block and before the dry-run return | source-regex test on the runner, asserting ordering against the `if (-not $Execute)` and `taskkill` markers |
| A5 | A missing live-state file or unresolvable ref fails closed (never passes) | source-regex test **plus** a real invocation against a non-existent ref |
| A6 | The existing suite still passes unchanged, including the "cannot become a build/install/migration/database operation" test and the rooted-path/relative-path validation tests | `npm run runtime:test` |
| A7 | `-LiveStateRef` is documented in the parameter block and defaults to `origin/main` | source-regex test |

**A3 is the decisive control.** Without it, a whole-file substring check would pass the gate on a
historical mention anywhere in the document — which is exactly how the register drifted in the first place.

## Gates to run (record literal results)

1. `npm run runtime:test` (from the repository root).
2. A **failing-first proof**: show A3's assertion failing against a naive implementation before it passes
   against the delivered one.
3. `git diff --check`.

## Evidence to return (one page)

Base SHA · candidate SHA · exact changed paths · the gate's function name and placement · each of A1–A7
with its literal result · the failing-first control with its before/after · known risks each marked
`BLOCKING`/`NON_BLOCKING` · verdict `REVIEW_REQUIRED`.

**Do not deploy, do not run the runner with `-Execute`, do not touch the live runtime, and do not edit
`docs/**`.** Additive commits only — never amend, rebase, or force-push. Leave the worktree clean.
