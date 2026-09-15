# WF-C04 — atomic stream registration and live-lane reconciliation

Status: `PLANNED` (ordinary source/test cycle; no HIGH action).

## 1. Dispatch identity

- Role: **fresh primary Planner**, responsible for bounded Executor, fresh QA,
  integration, and post-integration Wave Completion Audit.
- Start only after `WF-C03` is integrated or its integration owner has returned a
  terminal handoff. Reuse the accepted WF-C03 implementation; do not create a
  second status/heartbeat or browser-custody system.
- Refresh `origin/main` at dispatch and record the exact base SHA.
- New worktree: `E:/ATLAS-worktrees/workflow-atomic-stream-registration-c04`.
- Branch: `work/workflow-atomic-stream-registration-c04`.
- Worktree disposition: `RETIRE_AFTER_INTEGRATION`.
- Read the current `origin/main:AGENTS.md` directly and record its LF-normalized
  SHA-256. An older worktree copy is not directive authority.

## 2. Problem to solve

The machine registry currently contains seven formal stream records, while
ordinary Planner cycles may exist only in chat state and linked worktrees. At
the 2026-09-15 observation, four active ordinary lanes were not represented.
That count and those identities are historical evidence, not a hard-coded
execution invariant. The executor must re-observe current sessions, leases,
worktrees, candidate tips, and `origin/main` immediately before reconciliation.

The workflow CLI already performs atomic transitions for existing streams but
cannot atomically add a new stream. Manual JSON edits therefore create a blind
spot and can race with other integration owners.

## 3. Required production behavior

1. Add a named atomic transition `create-stream` to the existing
   `ops/workflow/transition.mjs` pipeline. Do not add a parallel CLI or registry.
2. `create-stream` must run through the existing repository-common-dir lock,
   expected-revision CAS, schema validation, semantic validation, deterministic
   register render, render byte verification, and atomic replace sequence.
3. Accept one exact stream document through a reviewed JSON input file
   (`--stream-spec <path>`) or an equally bounded typed interface. Arbitrary JSON
   Patch, JavaScript evaluation, and partial mutation of existing streams are
   forbidden.
4. Reject, with zero state/render/receipt mutation:
   - duplicate stream IDs;
   - stale expected revisions;
   - malformed or schema-incomplete stream specs;
   - unknown keys;
   - nonexistent or contradictory Git identity;
   - HIGH streams that bypass the existing approval/dependency rules;
   - active worktree/session claims without a consistent lease;
   - credential-shaped or secret-bearing values;
   - render, receipt, lock, or verification failures.
5. A successful create must increment `registry.revision` exactly once, append
   exactly one stream, preserve all existing stream bytes semantically, and
   produce the deterministic generated Markdown register in the same atomic
   operation.
6. Retrying the same operation after success must fail deterministically as a
   duplicate; it must never create two records or silently overwrite the first.
7. Concurrent creators using the same expected revision must yield exactly one
   success and one typed loser (`LOCK_CONTENTION` or
   `TRANSITION_STALE_REVISION`) with no partial files.
8. Update the workflow README, CLI usage, allowed flags, schemas only if needed,
   and the WF-C03 status/plugin output so newly created streams appear without a
   second manually maintained list.
9. Add a narrow machine-state evidence rule: any document claiming current
   registry state must cite the exact `origin/main` blob/tip observed at
   authoring time. A worktree-local registry copy is never current-state
   authority. Time-sensitive observations must be tagged with their capture
   boundary and must be refreshed before integration.
10. After source acceptance, use the new operation—not a hand edit—to reconcile
    every genuinely active ordinary lane missing from the machine registry.
    Re-observe rather than assuming the historical count of four. Do not create
    records for clean terminal worktrees merely because they exist.

## 4. Required controls

Add failing-first and positive controls over the real CLI/library entry points:

- one valid ordinary stream creation, exact revision +1, deterministic render;
- duplicate ID, stale revision, malformed/incomplete spec, and unknown-key
  rejection with byte-identical state/render/receipt;
- invalid Git SHA/ancestry and inconsistent lease/worktree identity rejection;
- HIGH stream without valid approval/dependencies rejected by the normal
  verifier;
- credential/JWT/PEM/password-shaped content rejected without printing the
  value;
- two concurrent creators: one winner, one typed loser, no partial files;
- injected `STAGE_STATE`, `STAGE_RENDER`, receipt, and lock failures remain
  atomic;
- CLI usage errors for missing/duplicate `--stream-spec` and prohibited flags;
- renderer output is byte-identical on repeated runs;
- WF-C03 status/heartbeat reads the newly created stream through the canonical
  registry and does not use a private cache/list;
- reconciliation fixture proving active lanes are added while terminal clean
  worktrees are not inferred as running.

Run at minimum:

```text
npm run workflow:test
npm run workflow:verify -- --state docs/plans/atlas-delivery-cycles.json
npm run workflow:render:check
git diff --check
```

Also run the current WF-C03 plugin/status discovery checks and a real temporary
Git-repository concurrency control. No test may weaken, delete, or skip an
existing workflow invariant.

## 5. Planner and QA loop

- Executor returns `REVIEW_REQUIRED` with one frozen candidate and complete gate
  tally.
- Fresh QA independently reviews the immutable range, reruns the decisive CLI,
  concurrency, failure-atomicity, render, and plugin-consumer controls, and
  returns only `ACCEPT_READY`, `CORRECTION_REQUIRED`, or
  `PLANNER_DECISION_REQUIRED` with passed/failed/blocked/unperformed counts.
- Send a deterministic correction back to the same Planner for a source defect;
  use a fresh Planner only if the existing context is lost, corrupted, or has
  crossed its bounded retry policy.
- After `ACCEPT_READY`, integrate from a clean current-main E-drive worktree,
  reconcile any new `origin/main` drift, run combined gates, push, commission a
  fresh Wave Completion Auditor, and correct/re-audit until `AUDIT_CLEAR` or a
  genuine planner decision is required.

## 6. Boundaries

No deployment, browser login, browser custody acquisition, runtime/task/env
change, database access or mutation, migration, term-cache action, Teaching Load
write, generation, publication, companion-repository edit, or worktree
retirement. Do not edit the historical prose register as a competing authority;
the generated register remains derived from the JSON registry.

## 7. Return contract

Return the base/candidate/integration/final remote SHAs, exact changed paths,
directive hash, complete QA and audit tallies, correction history, all commands
and exit codes, created/reconciled stream IDs with observation timestamps,
remaining unregistered active lanes (must be zero or explicitly blocked), and
worktree disposition/retirement proof.

Suggested commit:

```text
feat(workflow): add atomic stream registration
```
