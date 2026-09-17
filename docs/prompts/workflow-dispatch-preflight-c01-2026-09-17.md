# WORKFLOW-DISPATCH-PREFLIGHT-C01 — a read-only precondition probe for HIGH actions

ROLE: EXECUTOR. Recommended reasoning variant: `high`. Risk tier: **LOW–MEDIUM**
(`ops/workflow/**` plus tests; read-only tooling, no product or live change).

## Why

Every stall in the `CONSOLIDATED-DEPLOYMENT-C10` execution was a **zero-cost
precondition that nobody checked until the moment it mattered**:

| Stall | Discovered at | Should have been found |
| --- | --- | --- |
| Rollback tier `9d293879` unstartable (missing `express`, `helmet`) | pre-action review, late | before the action was offered for approval |
| Env file `atlas-server.env` carries an inheritance-protected read-only DACL | at the env-change step | before approval |
| Staged release fails `git rev-parse HEAD` (`detected dubious ownership`; no `safe.directory` entry) | **after** the stop was authorised | before approval |
| `sso-provisioning-*.local.env` absent while the clause required it | after approval | before approval |
| Two consecutive operator sentences non-executable (missing placeholder) | after approval | before approval |

Each was cheap to check. None was checked.

## Objective

Add a read-only preflight that runs all zero-cost precondition probes for a HIGH
action and reports a machine-readable pass/fail checklist, so a packet is never
offered for pre-action review with an unsatisfiable precondition.

## Required checks (all read-only, none mutating)

1. **Pin/identity** — pin resolves; pin is an ancestor of `origin/main`; packet
   blob at the pin matches the reviewed blob; register names the SHA; directive
   blob/hash matches the packet's declared value.
2. **Rollback startability** — for every named rollback tier, the built server
   entry point and its critical dependencies exist (the concrete `9d293879`
   failure: `atlas-server/dist/server.js` plus `express`, `helmet`).
3. **Env-file writability** — the target env file's DACL versus the principal
   that will write it; report the exact SDDL and whether a bounded ACL remedy
   would be required. Never modify.
4. **Named input artifacts** — every path a clause depends on (provisioning
   files, backup roots, release directories) exists, or the clause is reported
   as unsatisfiable.
5. **`git` safety for each release directory** — `git -C <dir> rev-parse HEAD`
   succeeds under the invoking identity, or the missing `safe.directory` entry
   is named. (Elevation changes this answer; the probe must report the identity
   it probed under.)
6. **Listening/ownership preconditions** — ports free or held by the expected
   owner; disk floors on every volume the action touches.
7. **Register CAS revision** — the current revision, so the dispatching planner
   re-reads rather than caching.
8. **Placeholder completeness** — scan the operator sentence/approval template
   for unfilled `<...>` placeholders and fail if any remain.

## Acceptance

- Running the preflight against the **historical C10 inputs** must surface all
  five stalls above as failures, from the pre-action state. That is the
  decisive positive control.
- Running it against a satisfied state exits 0.
- It must be **read-only**: prove by before/after signatures that no file,
  config, task, listener, or database row changed.
- Negative fixtures for each check, each exiting nonzero through the real entry
  point.

## Owned paths

`ops/workflow/**` (new probe module + CLI + tests). Nothing else.

## Forbidden

No runtime restart, no task/env/config mutation, no database write, no login, no
companion change, no register transition, no product source.

Suggested spec (author at registration; do not add prematurely):

```json
{
  "id": "WORKFLOW-DISPATCH-PREFLIGHT-C01",
  "kind": "STREAM",
  "objective": "Add a read-only dispatch preflight that probes every zero-cost precondition for a HIGH action (pin/content identity, rollback-tier startability, env-file writability, named-input presence, git safe.directory under the invoking identity, listeners/disk, register CAS revision, unfilled placeholders) so unsatisfiable preconditions are caught at authoring time rather than at execution.",
  "riskTier": "LOW",
  "state": "PLANNED",
  "requires": []
}
```
