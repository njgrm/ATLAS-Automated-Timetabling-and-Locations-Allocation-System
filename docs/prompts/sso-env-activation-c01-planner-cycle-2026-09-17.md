# SSO-ENV-ACTIVATION-C01 - planner cycle handoff

ROLE: PRIMARY_PLANNER. Recommended reasoning variant: `high`. This is the
orchestration envelope, not the implementation: you own activation, registration,
review commissions, approval routing, validation, and closure. You do not perform
the restart.

## Objective

Bring the already-deployed companion-SSO code into service with **one** restart of
the supervisor-owned runtime, so it loads the four companion-SSO keys the operator
has already appended to the durable env. No build, no install, no task re-point,
no release change.

## Immutable identity (re-read at start; do not trust this snapshot)

| Item | Value |
| --- | --- |
| `origin/main` | `1f6058802834ffb42c66f1d7e880f65a794c9901` at authoring - re-read and re-verify |
| Spec | `ops/workflow/specs/register/SSO-ENV-ACTIVATION-C01.json` |
| Executor packet | `docs/prompts/sso-env-activation-c01-2026-09-17.md` |
| Live release (unchanged by this lane) | `8eb0511baa537d4212f24a007ac40e2dded38c0e` |
| Release directory | `D:\ATLAS-runtime-supervised-8eb0511baa53-20260917` |
| Expected worktree / branch | `E:/ATLAS-worktrees/sso-env-activation-c01` / `chore/sso-env-activation-c01` |
| Directive | read `origin/main:AGENTS.md`; blob `09ede31cbb133ed424039049cbaf44382dd3e4bf`, LF-SHA-256 `3ef09bb64eb623a6c7412fb98549c9143e16589739628656036b19c144a70d79` |

## Preconditions - VERIFIED, do not re-litigate

- Durable env `D:\ATLAS-runtime-config\atlas-server.env` holds **17 keys**: the 13
  pre-existing names plus `ENROLLPRO_SSO_CLIENT_SECRET`,
  `ATLAS_SSO_REVERSE_CLIENT_SECRET`, `ENROLLPRO_SSO_CALLBACK_URL`,
  `ENROLLPRO_BASE_URL`. Both secret values measure **43 characters**; the callback
  URL is byte-exact with no trailing slash; the DACL is the restored read-only
  descriptor; there are **zero** duplicate keys. The keys were appended by the
  operator - the executor must not modify the file.
- The runtime is live and healthy on the release above (5001/5174, health and
  ready 200) under the task-launched supervisor.
- EnrollPro's side is complete: F1/F2 applied, both secrets rotated, the active
  school year resolves VALID, and `/auth/enrollpro/authorize` is confirmed live.

## Steps

1. **Activate.** `node ops/workflow/transition.mjs --transition coordination-update
   --mode CYCLE_ACTIVE --active-cycle-id SSO-ENV-ACTIVATION-C01
   --expect-revision <rev read immediately before>`. Re-pointing the marker is
   allowed while `CONSOLIDATED-DEPLOYMENT-C10` stays parked and non-terminal; C10
   does not block this.
2. **Register.** `create-stream --stream-spec
   ops/workflow/specs/register/SSO-ENV-ACTIVATION-C01.json
   --observed-origin-main <tip> --expect-revision <rev>`; confirm the lease is
   ACTIVE and both gates exit 0 (`verify-cycle`, `render-register --check`).
3. **One fresh independent pre-action review** (read-only) over the executor
   packet: preconditions, launch and rollback ownership, the 8-row matrix, the
   auth budget, and the forbidden scope.
4. **On PASS only**, return the exact approval sentence - every placeholder filled:
   `I approve SSO-ENV-ACTIVATION-C01 exactly as reviewed: stop only the
   supervisor-owned runtime tree and restart it via the registered task
   ATLAS-Runtime-Supervisor so the four companion-SSO keys already appended by me
   to D:\ATLAS-runtime-config\atlas-server.env are loaded, changing no release,
   no task registration, and no durable-env key; run the 8-row acceptance matrix
   including the SSO half-proof against the paired reverse bearer and the
   mutated-bearer negative control, disclosing every login with its expected audit
   delta; rollback is the same-task restart. No data mutation, generation,
   publication, Teaching Load apply, term-cache apply, rollover, migration, release
   change, task re-point, env edit, or companion change is approved.`
5. **On approval:** `record-approval` binding the packet blob and its LF-SHA-256,
   then dispatch **one fresh executor** with the executor packet above.
6. **On `REVIEW_REQUIRED`:** verify the worktree is clean, the candidate is
   attributed, the 8 rows are all PASS with evidence and none blocked or
   unperformed, and the login delta matches what was disclosed.
7. `record-execution`, then **one fresh post-action acceptance QA** (its own
   logins, each disclosed), then `record-qa-result`.
8. **One fresh Wave Completion Auditor** (`ROLE: WAVE_COMPLETION_AUDITOR`, max
   reasoning for a HIGH runtime action).
9. **On `AUDIT_CLEAR`:** `close-cycle` with receipt, retire the worktree, and
   return coordination to `MANUAL`.

## Boundaries and successors

Boundaries: the shared runtime tree, the registered task, the durable env, global
Git configuration, the database, generation, publication, and companions are all
outside this lane except for the single approved restart. Do not touch port 5175,
unrelated processes, or Tailscale Serve.

Not in this lane: the end-to-end Flow A/Flow B browser test with EnrollPro is a
separate joint session after EnrollPro's credential probe passes.

Locked successors: `DATA-CORRECTION-C01`, `TERM-CACHE-CATCHUP-APPLY`,
`AUTHZ-CLASS-TEMPLATE-LIVE`, live generation, publication.

## Return contract

Report cycle state, the exact commit(s) or blocker, the gate tally, remaining
risks, and the single next action. Stop only for a genuine operator decision, a
failed safety gate, or completion.
