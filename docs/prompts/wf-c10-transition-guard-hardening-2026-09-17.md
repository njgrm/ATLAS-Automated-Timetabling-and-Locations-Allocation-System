# WF-C10-TRANSITION-GUARD-HARDENING — executor packet

Status: authored 2026-09-17 (Asia/Manila). Not yet registered. Register only after
`WF-TRANSITION-TERMINAL-RECONCILE-C09` releases its register revision window.

## 0. Immutable identity

- Directive: `origin/main:AGENTS.md`, blob `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88`,
  LF-SHA-256 `7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3`.
  Read from Git bytes. Do not use `D:/ATLAS/AGENTS.md` (stale, normalizes to
  `c1e05ab0aac280b9c335a0ea7fe41ccd9250b42ac5add9960f69508f566dcca7`).
- Base: the `origin/main` tip at dispatch (re-verify; do not pin a stale tip).
- Worktree: `E:/ATLAS-worktrees/wf-c10-transition-guards`
- Branch: `work/wf-c10-transition-guard-hardening`
- Risk tier: MEDIUM. Disposition: `RETIRE_AFTER_INTEGRATION`.

## 1. Objective

Make the machine register able to record HIGH gates and stale directives
truthfully, so no planner ever again has to choose between hand-editing machine
state and under-reporting a completed HIGH action.

## 2. Owned and forbidden paths

Owned: `ops/workflow/**` (transition CLI and libs, schema, tests, fixtures,
README), `.opencode/plugins/atlas-observability.ts`, and the machine register
through the new transitions only.

Forbidden: any product source under `atlas-server/**` or `atlas-client/**`,
`prisma/**`, receipts, `docs/plans/**` outside CAS transitions, `CHANGELOG.md`,
companions, and any runtime/task/env/port/DB surface.

## 3. Required capabilities

### 3.1 `record-approval` — the missing HIGH gate writer (blocking)

No transition currently writes `approval.*`, so `approval.granted` can never be
set through the sanctioned path; `verify.mjs:422-454` already enforces
`HIGH_EXECUTION_WITHOUT_APPROVAL`, `HIGH_APPROVAL_INCOMPLETE`, and
`HIGH_BOUNDARY_EXCEEDED`. Add a transition that:

- sets `approval.granted`, `approval.operatorIdentity`, `approval.approvedAt`,
  `approval.boundary`, and `approval.approvedActions` from explicit flags;
- refuses a second grant on an already-granted stream (`TRANSITION_APPROVAL_ALREADY_GRANTED`,
  zero mutation — replay must be idempotent, not duplicative);
- refuses to grant without a reviewed packet reference
  (`TRANSITION_APPROVAL_PACKET_REQUIRED`), named by `--packet-path` and
  `--packet-sha256`, and verifies that pin against the repo;
- leaves state unchanged;
- rejects a stale revision, an unknown stream, and a stream whose
  `approval.required` is false.

### 3.2 `record-execution` — record the outcome without erasing the approval

- sets `approval.execution.performed`, `approval.execution.actionsPerformed`,
  and the outcome detail;
- fails closed with `TRANSITION_EXECUTION_WITHOUT_APPROVAL` when the stream has
  no complete granted approval;
- fails closed with `TRANSITION_EXECUTION_OUTSIDE_APPROVAL` when any performed
  action is outside `approval.approvedActions`;
- must satisfy the existing verifier rules without weakening them.

### 3.3 A documented exit from `HIGH_APPROVAL_REQUIRED`

Single-step, literal `--expect-revision` CAS, zero mutation on any failure.
Include the `--by`/holder semantics already used by the C09 window machinery.

### 3.4 Directive-copy fail-closed

Any packet-authoring or registration path compares the operating `AGENTS.md`
LF-SHA-256 against `git show origin/main:AGENTS.md` and fails closed with typed
`DIRECTIVE_COPY_STALE`. Positive control: equal hashes proceed. Live evidence:
`D:/ATLAS/AGENTS.md` is two mandatory rules stale (missing production-shape gate
rule 13, producer-to-consumer parity and unknown-value conservation, and the
unguarded sibling-feed scope-epoch rule).

### 3.5 Packet-artifact pin lint

Any packet that cites a directive pin or a predecessor artifact must resolve it
against the repo and fail closed when it does not reproduce. Record pins as
`blob <sha> + LF-SHA256 <hash> + the exact reproducing command` (raw-byte
redirect, never a PowerShell `>` recode). Two packets currently cite a
non-reproducing `ffd14520...`; correct them at the next lawful register write.

### 3.6 Dependency-tree identity by LF-normalized lockfile hash

Verify junction/reuse identity by LF-normalized `package-lock.json` sha256, not
raw checkout bytes. The CRLF form produced a false mismatch.

### 3.7 Packet-pin checkout stability (adds to the pin lint in §3.5)

A HIGH approval packet is hash-pinned by `record-approval --packet-sha256`, so
its bytes must be identical in every checkout. Two required parts:

- The attribute set already forces LF on checkout for `ops/workflow/**`,
  `docs/plans/**`, `docs/handoffs/**`, `docs/reviews/**`, `.opencode/agents/**`
  and `.opencode/plugins/**`, but **not** for `docs/prompts/**`, where every HIGH
  packet lives. The 2026-09-17 decisions commit adds
  `docs/prompts/** text eol=lf` (committed blobs were already LF, so the rule is
  content-neutral). Prove the attribute by a materialization regression in the
  WF-C01 R1 pattern: pin a `docs/prompts/**` blob hash, re-materialize the file at
  CRLF, and assert the pinned LF-normalized hash and the blob hash are unchanged.
- The pin convention must be `blob <git-sha1> + LF-SHA-256 <hash> + the exact
  reproducing command`, matching the `AGENTS.md` convention, so a pin never
  depends on the working-copy bytes alone.

Do NOT re-implement the register revision-window reservation: WF-C09 R2 adds it
(§R2.10, window 218→227). Verify it landed and test it; do not duplicate it.

## 4. Acceptance matrix (each row a mandatory source gate)

| # | Control | Expected |
|---|---|---|
| 1 | `record-approval` grants a HIGH stream with a reviewed packet pin | granted fields complete; verifier clean |
| 2 | `record-approval` twice | `TRANSITION_APPROVAL_ALREADY_GRANTED`; zero mutation |
| 3 | `record-approval` without a packet pin | `TRANSITION_APPROVAL_PACKET_REQUIRED`; zero mutation |
| 4 | `record-approval` with an unresolvable packet pin | typed failure; zero mutation |
| 5 | `record-approval` on a stream with `approval.required: false` | typed failure; zero mutation |
| 6 | `record-execution` before any grant | `TRANSITION_EXECUTION_WITHOUT_APPROVAL`; zero mutation |
| 7 | `record-execution` with an action outside `approvedActions` | `TRANSITION_EXECUTION_OUTSIDE_APPROVAL`; zero mutation |
| 8 | `record-execution` after a complete grant, within bounds | execution recorded; approval intact; verifier clean |
| 9 | `HIGH_APPROVAL_REQUIRED` exit | documented from-state only; invalid from-state fails closed |
| 10 | Stale revision on every new transition | `TRANSITION_STALE_REVISION`; zero mutation |
| 11 | Directive-copy equal | proceeds |
| 12 | Directive-copy stale (synthetic) | `DIRECTIVE_COPY_STALE`; zero mutation |
| 13 | Packet lint: reproducible pin | passes |
| 14 | Packet lint: non-reproducing pin | fails closed |
| 15 | Window reservation landed verification | non-holder write inside a held window yields `TRANSITION_REVISION_WINDOW_HELD` |
| 16 | Render determinism | render byte-identical on every rejection |
| 17 | Full `ops/workflow` suite | green |
| 18 | `workflow:verify` on the committed tree | exit 0 |
| 19 | `workflow:render:check` | exit 0 |
| 20 | `git diff --check` | clean |

## 5. Gates

`ops/workflow` suite with one negative fixture per capability; `render:check`
exit 0; `verify` exit 0; `git diff --check`; fresh independent QA over the frozen
candidate; clean current-main integration with exact candidate-tree parity; fresh
Wave Completion Audit.

## 6. Boundaries

No product source, no runtime/port/task/env change, no database action, no login,
no companion edit. Register writes only through the new transitions, CAS-guarded.
Never hand-edit the register JSON.

## 7. Return contract

Base/candidate/integration/final-main SHAs, changed paths, per-capability fixture
results, the verified window-reservation evidence, QA and audit tallies, push
state, worktree disposition, single next action, safe parallel work, locked
successors. Corrections are additive commits; never amend, rebase, or force-push.
`REVIEW_REQUIRED` only; the executor never self-accepts.

## 8. Registration annex

Register only after `WF-TRANSITION-TERMINAL-RECONCILE-C09` is terminal or its
window is released. Sequence: `create-stream` (spec
`ops/workflow/specs/register/WF-C10-TRANSITION-GUARD-HARDENING.json`) →
`lease-update --stream WF-C10-TRANSITION-GUARD-HARDENING --lease-id
lease-wf-c10-transition-guards --lease-state ACTIVE --lease-role executor` →
`coordination-update`. Re-read `registry.revision` immediately before every
transition; on any `--expect-revision` disagreement stop and report, never guess.
