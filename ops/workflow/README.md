# ATLAS workflow foundation (`ops/workflow`)

Repository-owned, machine-readable delivery-cycle state with a fail-closed
verifier, a deterministic Markdown register renderer, atomic named state
transitions, an exclusive-writer lock, a bounded compaction checkpoint contract,
local session observability with truthful liveness, and an exclusive browser
custody lease.

The JSON state document (`docs/plans/atlas-delivery-cycles.json`) is the
authority for current cycle state. The generated register
(`docs/plans/atlas-active-delivery-streams.generated.md`) is derived output; the
historical prose register (`docs/plans/atlas-active-delivery-streams.md`) stays
as context only and is never the current-status authority.

## Commands

```bash
npm run workflow:test      # node --test ops/workflow/__tests__/*.test.mjs
npm run workflow:verify    # self-contained: --state docs/plans/atlas-delivery-cycles.json is embedded
npm run workflow:render    # self-contained: writes docs/plans/atlas-active-delivery-streams.generated.md
npm run workflow:render:check   # --check: no write, exit 1 on any drift
npm run workflow:transition -- --transition <name> --state <path> --expect-revision <n> [flags]
npm run workflow:checkpoint -- --stream <id> [flags]   # --state is embedded; --stream is a pass-through
npm run workflow:status    [-- --json] [--common-dir <path>] [--now <iso>]
npm run workflow:custody   # self-contained: --op status --state docs/plans/atlas-delivery-cycles.json
```

Direct CLI contract:

- `node ops/workflow/verify-cycle.mjs --state <path> [--receipt <path>] [--stream <id>]`
- `node ops/workflow/render-register.mjs [--check] --state <path> --output <path>`
- `node ops/workflow/transition.mjs --transition <name> --state <path> --expect-revision <n> [flags]`
- `node ops/workflow/checkpoint.mjs --state <path> --stream <id> [flags]`
- `node ops/workflow/status.mjs --state <path> [--json] [--common-dir <path>] [--now <iso>] [--active-window-ms <n>] [--profile <path>] [--notify-kind <kind>] [--notify-message <text>]`
- `node ops/workflow/custody.mjs --op <acquire|renew|transfer-request|transfer-ack|release|recover|login|status> --state <path> [flags]`
- `node ops/workflow/pins.mjs check --packet <repo-relative> | check --all` (section 3.5)
- `node ops/workflow/deps.mjs identity <path> | compare <a> <b>` (section 3.6)

Exit codes: `0` ok, `1` state/transition/lint failure, `2` usage error. `--stream`
without `--receipt` is a usage error, not a silent no-op. A repeated flag on
`transition.mjs` is a usage error (`USAGE_DUPLICATE_FLAG`), never a last-one-wins
override, because a caller cannot tell which value was used. There is never a
default state file: `--state` is always required by the CLI.

### The documented `workflow:*` aliases must actually run

The aliases are self-contained: an alias that needs a state document embeds the
committed path in `package.json` and never defaults it inside a CLI. A CLI that
silently defaulted `--state` would let a wrong-working-directory invocation
operate on an unintended file, so the wrong-directory case still fails closed
with `STATE_UNREADABLE` (exit `1`), and the alias is the only place the path
appears.

| Alias | Published invocation | Exit |
| --- | --- | --- |
| `workflow:test` | `npm run workflow:test` | suite exit |
| `workflow:verify` | `npm run workflow:verify` | `0` on a clean register |
| `workflow:render` | `npm run workflow:render` | `0`; rewrites the generated register |
| `workflow:render:check` | `npm run workflow:render:check` | `0` byte-identical |
| `workflow:status` | `npm run workflow:status` | `0`/`1` |
| `workflow:custody` | `npm run workflow:custody` | `0`/`1` (`--op status`) |
| `workflow:checkpoint` | `npm run workflow:checkpoint -- --stream <id>` | `0`/`1` |
| `workflow:transition` | `npm run workflow:transition -- --transition <name> --expect-revision <n> ...` | `0`/`1`/`2` |

`workflow:checkpoint` is intentionally parameterized: a checkpoint is always for
one stream, so `--stream <id>` is a pass-through argument after `--`. The
required `--state` is embedded. Omitting `--stream` fails closed with
`USAGE_MISSING_STREAM` (exit `2`) rather than defaulting to some other stream.
`workflow:transition` is likewise a pass-through: the transition name, revision,
and stream are caller knowledge.

Every CLI prints exactly one JSON document with the top-level keys `status`,
`summary`, `nextActions`, `artifacts`, `errors`. Identical input produces
byte-identical stdout and byte-identical rendered output.

## Contract (`contractVersion` 1.2.0)

- Schema: `ops/workflow/schema/cycle-state.schema.json` (JSON Schema 2020-12,
  `additionalProperties: false` everywhere). The verifier always loads this file
  relative to its own module, never from the state document and never from the
  working directory. Missing/unreadable schema => `SCHEMA_LOAD_FAILED`;
  unsupported keyword => `SCHEMA_UNSUPPORTED_KEYWORD`.
- State document: `contractVersion`, `registry`, `coordination`, `streams`,
  `leases`, `browserCustody`. Every object key is required; null is allowed only
  where the contract declares a nullable type.
- `registry.revision` is the monotonic document CAS token. It starts at `1` and
  every atomic transition increments it exactly once.
- The verifier collects all independent rule violations deterministically
  (schema/parse catastrophes abort early with one explicit code).

### Closure identity is not self-referential (A1)

`git.baseSha`, `git.candidateSha`, and `git.integrationSha` are immutable
identities. A post-push remote observation is stored separately as
`git.remoteObservation` — a nullable snapshot of a named ref:

```json
{ "ref": "refs/remotes/origin/main", "sha": "<40-hex>", "observedAt": "<iso>", "kind": "REMOTE_TRACKING_REF" }
```

No committed field is required to equal the commit that contains it, the current
tip, or the working HEAD. The verifier only requires the observed SHA to be a
real commit that is downstream of (or equal to) the integration SHA, so a forged
observation fails closed while recording one never creates a "new final SHA"
fix-up chain. The former ambiguous `remoteSha` scalar is gone; legacy 1.0.0
documents migrate through `ops/workflow/lib/migrate.mjs` without losing their
historical candidate/integration/receipt identities.

### Leases and real active-work detection (A3)

`leases[]` is a machine-readable stream/worktree lease:

```json
{
  "id": "lease-1", "streamId": "WF-C02", "worktree": "E:/ATLAS-worktrees/x",
  "role": "executor", "sessionId": null, "state": "ACTIVE",
  "revision": 1, "updatedAt": "<iso>", "expiresAt": null
}
```

Lease states are `ACTIVE`, `RETURNED`, `IDLE`, `ERROR`, `STALE_UNCONFIRMED`.
A stream may not be `PLANNED` with `running: []` while a verified `ACTIVE` lease
names it (`PLANNED_WITH_LIVE_LEASE`) or while its owned worktree is dirty
(`PLANNED_WITH_DIRTY_WORKTREE`). Plain directory existence is not activity: a
clean worktree with no lease passes. Expiry is evidence of uncertainty, never
authority to clean up or replace another owner's work — an expired `ACTIVE` lease
still blocks a `PLANNED` declaration until an explicit transition changes it.

## Atomic transitions (A2)

`ops/workflow/transition.mjs` exposes narrow named transitions rather than
arbitrary JSON patching. Each one performs, under an exclusive
repository-common-dir lock:

`read -> schema/semantic verify -> expected-revision CAS -> mutate exactly one
stream (or append exactly one new stream) -> render -> verify rendered bytes ->
optionally mint/pin the closure receipt -> atomic replace`

Named transitions: `record-executor-return`, `record-correction`,
`record-qa-result`, `create-stream`, `coordination-update`, `record-integration`,
`record-audit`, `close-cycle`, `record-remote-observation`, `lease-update`,
`reconcile-stream`, `resolve-decision`, `abandon-stream`, `refresh-artifact-pin`.
The planner closure sequence is:

1. `record-executor-return` (derives `changedPaths` from `git diff base...candidate`)
2. `record-qa-result` (`--qa-verdict`, `--qa-session`, `--gates
   total/passed/failed/blocked/unperformed`, required `--gates-classes
   MANDATORY_SOURCE=t/p/f/b/u,MANDATORY_LIVE=t/p/f/b/u,DEFERRED_EXTERNAL=t/p/f/b/u`,
   optional increase-only `--gates-plan CLASS=n,...`)
3. `coordination-update --mode MANUAL` — **required while the closing stream is the
   active cycle.** If `coordination.activeCycleId` still names the closing stream
   when it moves to `INTEGRATED`/`COMPLETE`, that stream becomes terminal and the
   candidate document is rejected with `ACTIVE_CYCLE_TERMINAL`. Move coordination
   off the closing stream immediately before integration.
4. `record-integration` (`--integration`, plus `--observed-remote` when the stream
   carries a creation-time observation — see below)
5. `record-audit` (`--auditor-verdict`, `--auditor-session`)
6. `close-cycle` (`--receipt`) — mints and pins the closure receipt
7. `record-remote-observation` (`--ref`, `--observed-sha`) — a snapshot, terminal

### Refreshing a creation-time observation at integration

The verifier requires `integrationSha` to be an ancestor-or-equal of
`remoteObservation.sha`, and `record-remote-observation` is gated to
`INTEGRATED`/`COMPLETE`. A stream registered by `create-stream` therefore carries
the tip that was observed *before* it was integrated, and that stale snapshot
cannot be corrected after integration. `record-integration` closes the gap with
two optional flags:

- `--observed-remote <40-hex lowercase>` — the remote tip that now contains the
  integration. It must be a real commit (`TRANSITION_OBSERVED_REMOTE_UNKNOWN`)
  and the integration must be an ancestor-or-equal of it
  (`TRANSITION_OBSERVED_REMOTE_ANCESTRY`); a malformed value is
  `TRANSITION_OBSERVED_REMOTE_INVALID`. On success the stream's
  `git.remoteObservation` is replaced with
  `{ ref, sha, observedAt: <transition time>, kind }` and the refreshed snapshot
  is echoed in `summary.observation`.
- `--observed-ref <ref>` — defaults to `refs/remotes/origin/main`. The kind is
  derived exactly as `record-remote-observation` derives it:
  `REMOTE_TRACKING_REF` for a `refs/remotes/` ref, otherwise `LOCAL_REF`.
  Supplying `--observed-ref` **without** `--observed-remote` fails closed with
  `TRANSITION_OBSERVED_REF_WITHOUT_REMOTE` and writes nothing.

The observed sha **may equal** the integration sha: an observation of the
integration commit itself is a valid downstream-or-equal snapshot, and the
verifier treats equality as satisfying the ancestor-or-equal rule.

Lifecycle rule: a stream carrying a creation-time `git.remoteObservation` must
refresh it at integration through `record-integration --observed-remote`; without
the flag the candidate document is rejected with `TRANSITION_RESULT_INVALID`
(`REMOTE_OBSERVATION_INVALID`) and nothing is written. A stream whose
`remoteObservation` is `null` integrates without the flag exactly as before, and
`create-stream`'s storage semantics are unchanged. `record-remote-observation`
remains the post-integration refresh.

### Predeclared gate classes, QA rounds, and readiness

`streams[].gates` carries a predeclared per-class plan plus the five class
tallies:

```json
"gates": {
  "total": 0, "passed": 0, "failed": 0, "blocked": 0, "unperformed": 0,
  "plan": { "MANDATORY_SOURCE": 0, "MANDATORY_LIVE": 0, "DEFERRED_EXTERNAL": 0 },
  "classes": {
    "MANDATORY_SOURCE": { "total": 0, "passed": 0, "failed": 0, "blocked": 0, "unperformed": 0 },
    "MANDATORY_LIVE":   { "total": 0, "passed": 0, "failed": 0, "blocked": 0, "unperformed": 0 },
    "DEFERRED_EXTERNAL":{ "total": 0, "passed": 0, "failed": 0, "blocked": 0, "unperformed": 0 }
  }
}
```

- `GATES_ARITHMETIC` requires each top-level counter to equal the sum of the
  three classes, and each class total to equal its own four counters.
- `GATE_PLAN_MISMATCH` requires `classes[c].total <= plan[c]` always, and
  `classes[c].total === plan[c]` at an acceptance/closure claim
  (`ACCEPT_READY`/`INTEGRATION_READY`/`INTEGRATED`/`COMPLETE`, `qaVerdict
  ACCEPT_READY`, or `auditorVerdict AUDIT_CLEAR`), so a predeclared gate cannot
  be quietly deferred or dropped from the arithmetic.
- `ACCEPT_READY_DIRTY_GATES` requires `gates.total > 0`, a fully passed
  `MANDATORY_SOURCE` class, and zero failed/blocked `MANDATORY_LIVE` gates.
  Unperformed `MANDATORY_LIVE` gates are allowed at `ACCEPT_READY` (that is a
  source-only acceptance).
- `COMPLETE_MANDATORY_GATES_UNPASSED` additionally requires every
  `MANDATORY_LIVE` gate to have passed with zero unperformed.

`streams[].review.qaRounds` is a required, bounded (max 24) history of
`{ round, verdict, sessionId }`. `QA_ROUNDS_INCONSISTENT` requires the rounds to
be exactly `1..n` with the last round matching `review.qaVerdict`/`qaSessionId`.
`CORRECTION_NOT_RECORDED` fails an acceptance/closure claim that discloses a
`CORRECTION_REQUIRED` round with no `corrections[]` round at or after it, and
`record-qa-result` rejects recording `ACCEPT_READY` after `CORRECTION_REQUIRED`
without a recorded correction at the current candidate
(`TRANSITION_CORRECTION_NOT_RECORDED`, zero mutation).

Readiness (`lib/readiness.mjs`) is the single derivation shared by the verifier,
the renderer's `Readiness` column, and the closure receipt: `SOURCE_ONLY` when no
`MANDATORY_LIVE` gate was predeclared, `LIVE_PENDING` while any is
failed/blocked/unperformed, and `LIVE_ACCEPTED` only when all passed. A
source-only acceptance is never rendered or attested as deployment or live
readiness. Closure receipts mint `receiptVersion` **1.1.0** with a required
`verified.readiness`; legacy `1.0.0` receipts remain valid and compare only the
five gate scalars. A 1.1.0 receipt whose readiness differs from the stream's
derivation is `RECEIPT_READINESS_MISMATCH`.

`lib/migrate.mjs` upgrades earlier documents deterministically. The 1.1.0 ->
1.2.0 step synthesizes `gates.plan`/`gates.classes` from the existing gate
counters (all existing gates become `MANDATORY_SOURCE`, so nothing is fabricated
or deferred) and `review.qaRounds` from `corrections[]` plus the final review
verdict, preserving every historical identity and never rewriting receipts. A
version migration is not a transition: `registry.revision` is unchanged.

`coordination-update` is document-scoped (no `--stream` required) and takes
`--mode MANUAL|CYCLE_ACTIVE`, `--active-cycle-id <stream-id|null>`, and
`--global-next-action <text|null>`. `MANUAL` forces a null active cycle and
rejects an explicitly non-null id; `CYCLE_ACTIVE` requires a defined,
non-terminal target stream and a non-empty global next action. It runs through
the same lock, CAS, staging, render, verification, and atomic-replace pipeline,
so a rejected update leaves state, render, and receipt byte-identical.

### Registering a new stream (`create-stream`)

`create-stream` appends exactly one stream to `streams[]` through the same lock,
CAS, schema/semantic verification, render, render-byte check, and atomic replace
as every other transition. There is no second CLI, no second registry, and no
JSON Patch, JavaScript evaluation, or partial mutation of an existing stream.

```bash
node ops/workflow/transition.mjs --transition create-stream \
  --state docs/plans/atlas-delivery-cycles.json --expect-revision <n> \
  --stream-spec <path> --observed-origin-main <40-hex tip> [--by <actor>]
```

- `--stream-spec <path>` is **required** and must resolve to exactly one JSON
  object that is a complete stream record. The path is resolved against the
  process working directory (never against the state document, never a default
  location). `--stream-spec` and `--observed-origin-main` are the only two
  transition-specific flags; `--stream` is rejected
  (`TRANSITION_FLAG_NOT_APPLICABLE`) because the id comes from the spec.
- `--observed-origin-main <40-hex>` is **required**. It is the only source of
  the created record's `git.remoteObservation`, and the tool stamps both
  `remoteObservation.observedAt` and `stateUpdatedAt` with the transition time so
  a spec cannot assert a remote tip it did not observe or backdate its own state.
  A spec that already carries a non-null `git.remoteObservation` is contradictory
  and is rejected.
- The spec is validated against the shipped `$defs.stream` schema before any
  mutation, so **unknown keys anywhere in the record** (`CREATE_SPEC_UNKNOWN_KEY`
  names the exact path) and every schema violation (`CREATE_SPEC_INVALID`,
  reported by code and path only — no spec value is echoed) are rejected with
  zero state/render/receipt mutation.
- The whole candidate document is then re-verified by the production engine, so
  duplicate ids (`CREATE_SPEC_DUPLICATE_ID`), unknown commits (`GIT_SHA_UNKNOWN`),
  broken `base -> candidate -> integration` ancestry (`GIT_ANCESTRY`), a
  `changedPaths` set that does not match `git diff base...candidate`
  (`CHANGED_PATHS_MISMATCH`), and a HIGH record that bypasses the approval or
  dependency rules (`HIGH_EXECUTION_WITHOUT_APPROVAL`,
  `HIGH_DEPENDENCY_*`) all fail closed.
- Creation-time claim/evidence consistency (`CREATE_SPEC_CLAIM_INCONSISTENT`):
  `RUNNING` requires a non-empty `running[]`, `PLANNED` requires an empty
  `running[]`, and an owner claiming `status: "ACTIVE"` requires a non-null
  `sessionId`. A `PLANNED` record additionally may not name an `ACTIVE` lease or
  own a dirty worktree — the verifier enforces both on the final document
  (`PLANNED_WITH_LIVE_LEASE`, `PLANNED_WITH_DIRTY_WORKTREE`).
- Credential-shaped content anywhere in the spec is rejected
  (`CREATE_SPEC_SECRET_CONTENT`) using `lib/redact.mjs` `containsSecret` before
  parsing; the value is never echoed, logged, or written.
- On success `registry.revision` increments exactly once, exactly one stream is
  appended, all existing stream bytes are preserved, and the deterministic
  generated register is published in the same operation. Repeating the same
  operation after success fails deterministically as a duplicate and never
  creates a second record or silently overwrites the first.
- `create-stream` mints no closure receipt, so `ATLAS_WORKFLOW_FAULT=STAGE_RECEIPT`
  is unreachable for it; `STAGE_STATE`, `STAGE_RENDER`, `VERIFY_RENDERED`, and
  `AFTER_LOCK` remain atomic. Two concurrent creators with the same expected
  revision produce exactly one winner and one typed loser (`LOCK_CONTENTION` or
  `TRANSITION_STALE_REVISION`) with no partial files.

### The HIGH gate writers (sections 3.1-3.3)

Before WF-C10 no transition wrote `approval.*`, so `approval.granted` could never
be set through the sanctioned path while the verifier already enforced
`HIGH_EXECUTION_WITHOUT_APPROVAL`, `HIGH_BOUNDARY_EXCEEDED` and
`HIGH_APPROVAL_INCOMPLETE`. Three transitions close that gap. Each is a
single-step revision-CAS transition under the same lock, staging, render,
verification, and atomic-replace pipeline as every other, so a refusal stages
nothing and leaves state, render, and every receipt byte-identical.

#### `record-approval`

Required `--packet-path <repo-relative>`, `--packet-sha256 <64-hex>`,
`--operator-identity`, `--boundary`, `--approved-actions <JSON array>`. The tool
owns `approvedAt`.

Effects: `approval.granted`, `operatorIdentity`, `approvedAt`, `boundary` and
`approvedActions` are set. `state`, `blocker`, `running`, `awaited`, `nextAction`
and `approval.execution` are **unchanged**.

**`presentedReady` is deliberately not set.** Leaving it exactly as declared keeps
the `HIGH_DEPENDENCY_MISSING` observation rules a separate concern: forcing it
`true` would make a plain grant unsatisfiable unless every required observation
were already `PASS` and unexpired.

The packet path is resolved through the one shared repo-relative resolver
(`lib/paths.mjs`): absolute, drive-qualified, UNC, `..`-bearing, symlink-escaping,
absent, or non-file references are refused. `--packet-sha256` is the
**LF-normalized** SHA-256 of the resolved bytes, and the packet is linted through
the section 3.5 directive-pin rules before the digest is compared.

Refusals, all zero-mutation, render byte-identical, no receipt:

| Code | Condition |
| --- | --- |
| `TRANSITION_APPROVAL_PACKET_REQUIRED` | either packet flag is absent |
| `TRANSITION_APPROVAL_NOT_REQUIRED` | the stream's `approval.required` is not `true` |
| `TRANSITION_APPROVAL_ALREADY_GRANTED` | `approval.granted` is already `true` (replay is idempotent) |
| `TRANSITION_APPROVAL_PACKET_SHA_INVALID` | the digest is not lowercase 64-hex |
| `TRANSITION_APPROVAL_PACKET_UNRESOLVED` | the path escapes the repo root or names no file |
| `TRANSITION_APPROVAL_PACKET_PIN_INVALID` | the packet fails the directive-pin lint |
| `TRANSITION_APPROVAL_PACKET_HASH_MISMATCH` | the LF-normalized digest differs |
| `TRANSITION_APPROVAL_ACTIONS_INVALID` | `--approved-actions` is not a non-empty array of non-empty strings |
| `TRANSITION_APPROVAL_STATE_FORBIDDEN` | the stream is `COMPLETE`, `CLOSED`, or `SUPERSEDED` |
| `TRANSITION_STALE_REVISION`, `TRANSITION_UNKNOWN_STREAM` | as usual |

#### `record-execution`

Required `--actions-performed <JSON array>` and `--outcome <non-empty string>`.
The tool owns `executedAt`; `recordedBy` is `--by` or `null`.

Effects: `approval.execution = { performed: true, actionsPerformed, evidence:
null, outcome, executedAt, recordedBy }`. `state` and the granted fields are
unchanged. `evidence` is required by `$defs/approvalExecution` and predates this
transition, so the tool writes it `null` rather than inventing an evidence
artifact; the new descriptive fields are `outcome`, `executedAt` and
`recordedBy`.

Refusals, all zero-mutation: `TRANSITION_EXECUTION_WITHOUT_APPROVAL` unless the
grant is complete **by the verifier's own definition** (`required === true &&
granted === true && non-empty operatorIdentity && approvedAt !== null &&
non-empty boundary && non-empty approvedActions`);
`TRANSITION_EXECUTION_OUTSIDE_APPROVAL` when any performed action is absent from
`approval.approvedActions`; `TRANSITION_EXECUTION_ALREADY_RECORDED` when
`approval.execution.performed` is already `true`; `TRANSITION_EXECUTION_ACTIONS_INVALID`
for a malformed array; `TRANSITION_EXECUTION_OUTCOME_REQUIRED` for an empty
outcome; `TRANSITION_EXECUTION_STATE_FORBIDDEN` from a settled stream.

The sanctioned path never trips `HIGH_EXECUTION_WITHOUT_APPROVAL`,
`HIGH_BOUNDARY_EXCEEDED` or `HIGH_APPROVAL_INCOMPLETE`, and all three stay
reachable for a hand-crafted document.

#### `withdraw-approval` — the documented exit from `HIGH_APPROVAL_REQUIRED`

Before WF-C10 **no transition declared `HIGH_APPROVAL_REQUIRED` in a `from`
list**, so the state was a dead end and `TERM-CACHE-CATCHUP-APPLY` was stuck in it
in the live register. `withdraw-approval` is the missing exit.

Stream-scoped from `HIGH_APPROVAL_REQUIRED` only
(`TRANSITION_WITHDRAW_STATE_FORBIDDEN` otherwise). Required `--to-state` ∈
{`INTEGRATION_READY`, `PLANNED`, `SUPERSEDED`, `CLOSED`}, `--reason`,
`--next-action`; optional `--replacement`, **required when `--to-state` is
`SUPERSEDED`**, mirroring the `resolve-decision` precedent and naming a different,
existing, non-resolved-away stream.

Effects: the state becomes `--to-state`, `approval.presentedReady` becomes
`false`, and `approval.requiredObservationIds` is cleared — nothing else.
`TRANSITION_APPROVAL_ALREADY_GRANTED` refuses a granted stream (a grant is
executed, never withdrawn); `TRANSITION_WITHDRAW_TARGET_INVALID` refuses a target
outside the allowed set.

### Directive pinning and packet-pin lint (sections 3.4-3.5)

`lib/directive.mjs` is the single directive-pin resolver: `directivePinAtTip`
returns `{ blob, lfSha256 }` computed from raw `git cat-file blob` bytes, and
`operatingCopyHash` returns the LF-SHA-256 of the operating `AGENTS.md`.

**Registration is fail-closed on the directive copy.** `create-stream` compares
the operating `AGENTS.md` at the repository root with the directive blob at the
submitter's `--observed-origin-main` tip. A mismatch is `DIRECTIVE_COPY_STALE`
and an unresolvable tip is `DIRECTIVE_REMOTE_UNRESOLVED`; both mutate nothing.
An unresolvable tip is never a silent skip. **Consequence:** a register write must
run from a checkout whose `AGENTS.md` matches the tip being observed, because the
stale `D:/ATLAS/AGENTS.md` copy is two mandatory rules behind the tracked
directive.

`create-stream` also accepts an optional `--packet-path` and lints the
registering stream's own packet through the same resolver
(`TRANSITION_REGISTER_PACKET_UNRESOLVED` / `TRANSITION_REGISTER_PACKET_PIN_INVALID`).

`pins.mjs check --packet <path>` and `pins.mjs check --all` (sweeping
`docs/prompts/**`) apply three rules:

1. **Directive-pin reproducibility.** On a line carrying a directive marker
   (`origin/main:AGENTS.md` or the word `Directive`), every 40-hex token must
   resolve as a Git object (`PIN_BLOB_UNRESOLVED`), and every **declared**
   `… SHA-256 <64-hex>` field must equal the LF-normalized SHA-256 of the
   directive blob at the current tip **or any historical tip**
   (`PIN_DIRECTIVE_HASH_UNKNOWN`). A historical-but-reproducible pin therefore
   **passes**: a later directive bump never invalidates an already-queued packet,
   while a value that reproduces at no tip fails closed. The original C08
   misprint (`ffd14520…`) is exactly what this catches.
2. **Declared pin-pair recomputation.** The documented pair is recomputed from raw
   blob bytes; a disagreement is `PIN_HASH_MISMATCH`.
3. **Scope discipline.** Only values in a declared pin slot are pins. A token that
   is not declared (`liveSemanticRevision`, a fixture fingerprint, or a superseded
   value quoted in a correction note) is prose and never fires, and a marker-free
   line never fires the blob-resolution rule. Both directions are proven by
   fixtures.

### Machine-state evidence rule

Any document that claims current registry state must cite the exact
`origin/main` tip observed at authoring time; a claim without that tip is not
current-state evidence. Two consequences are load-bearing:

- **A worktree-local registry copy is never current-state authority.** A linked
  worktree's `docs/plans/atlas-delivery-cycles.json` (or its generated register)
  is a snapshot of that branch, not of the remote. Refresh `origin/main` and read
  the tip from the integration boundary before treating registry state as current.
- **Time-sensitive observations carry their capture boundary and must be
  refreshed before integration.** A recorded observation (including the
  `git.remoteObservation` stamped by `create-stream`) attests the SHA observed at
  its `observedAt` instant. It is not compared with the containing commit, the
  current tip, or the working HEAD, and it must not be presented as the current
  tip after the remote has moved.

`create-stream` makes the first consequence mechanical for new records: the
observed tip is a required flag, so the created record always carries an exact
`refs/remotes/origin/main` observation rather than an assumed one.

Failure atomicity: on invalid input, stale revision, invalid transition,
ambiguous stream, failed render, failed receipt, or lock contention the command
exits nonzero and modifies nothing. All outputs are staged first and published
by rename only after the candidate passes full verification; the receipt is
published before the state so the state never pins a receipt that is not yet
present. `ATLAS_WORKFLOW_FAULT` (`STAGE_STATE`, `STAGE_RENDER`,
`STAGE_RECEIPT`, `VERIFY_RENDERED`, `AFTER_LOCK`) and
`ATLAS_WORKFLOW_LOCK_HOLD_MS` exist only for deterministic tests.

Locking: the lock lives in `git rev-parse --git-common-dir` so every linked
worktree serializes through one file. Publication is atomic — the complete owner
record is written to a unique sibling temp file and published with a
no-overwrite hard link (`fs.linkSync`, `EEXIST` while held) — so a visible lock
always carries a complete owner record and this tool cannot create an empty or
partial lock. A crashed publisher may leave a stray `<lock>.*.tmp` beside the
lock; a temp file is never treated as a lock and is not managed by this tool.

Reclaim is fail-closed: a lock is deleted only when a readable record names a
positive integer `ownerPid` whose process is provably absent, never merely
because it is old. Unreadable, empty, malformed, or ownerless locks are reported
as `LOCK_UNREADABLE` after the bounded inspection window with zero mutation. Two
or more concurrent writers produce exactly one committed transition and typed
losers (`LOCK_CONTENTION` or `TRANSITION_STALE_REVISION`) with zero partial files.

Reclaim is also serialized: reclaiming a dead lock happens inside a claim mutex
(`<lock>.claim`, created `O_EXCL` and always released in a `finally`). Inside the
claim section the lock file is re-read and must still carry the exact dead record
that was classified (byte fingerprint) before it may be unlinked and immediately
CAS-republished with `linkSync`; if the record is missing or changed, nothing is
touched. A fresh acquirer cannot publish while the dead record exists, and only
the unique claim holder can remove it, so a live record can never be unlinked by a
reclaimer. If a claim file is already present — an active reclaimer or a crashed
one — reclaim is blocked: the caller receives a typed `LOCK_CONTENTION` naming the
claim file, with zero mutation. A claim file is never automatically deleted.

Recovery for a manually proven-crashed lock: read the lock file, confirm it
carries no live `ownerPid` (and that no process is still running the transition),
then remove that one file by hand and re-run. Recovery for a stale claim (a
reclaimer that crashed between claim and release): confirm no transition process
is running for this repository, then remove the single `<lock>.claim` file and
re-run. Never delete either file merely because it is old, and never delete a lock
owned by a live process.

## Terminal exits, residue reconciliation, and the RUNNING live-evidence rule (C09)

Four transitions complete the terminal-authority surface: the three
terminal/reconcile transitions below plus `refresh-artifact-pin` (documented with
the repair-read). Names, flags, state sets and error codes are fixed contracts.

### `reconcile-stream` — atomic residue reconciliation without a state change

Stream-scoped, with `from` = every schema state **except `RUNNING`**, and at
least one of `--awaited`, `--running`, `--next-action`, `--blocker-kind`,
`--blocker-detail`, `--blocker-safe-work-remaining`, `--blocker-safe-work-items`.

- Supplying none of them fails closed with `TRANSITION_RECONCILE_NO_CHANGES`
  (zero mutation). Blocker fields apply individually: an unset field keeps its
  prior value.
- `--blocker-safe-work-remaining` is read strictly — only the exact strings
  `true`/`false` are accepted; `1`, `0`, `yes`, empty and any other spelling fail
  closed with `TRANSITION_BLOCKER_FLAG_INVALID`.
- After applying, `blocker.safeWorkRemaining === (blocker.safeWorkItems.length > 0)`
  is enforced with `TRANSITION_BLOCKER_INCONSISTENT`, so the transition is
  trip-proof for the verifier's `BLOCKER_INCONSISTENT` instead of relying on it.
  Setting `--blocker-kind NONE` on a `BLOCKED`/`EXTERNALLY_BLOCKED` stream still
  trips the verifier's `BLOCKER_KIND_MISMATCH` and therefore fails with
  `TRANSITION_RESULT_INVALID` before any write.
- `state` never changes, and every field other than `awaited`, `running`,
  `blocker`, `nextAction` and `stateUpdatedAt` is byte-identical. No receipt is
  minted and `leases[]` is untouched.
- **Why `RUNNING` is refused.** `RUNNING` is the one state whose residue *is* a
  claim of live work. It may only be exited through the proof-gated
  `abandon-stream`, never edited in place, so invoking `reconcile-stream` on a
  `RUNNING` stream fails closed with the dedicated
  `TRANSITION_RECONCILE_RUNNING_FORBIDDEN`. Because `RUNNING` is the only state
  outside this transition's `from` set, that code is also what every
  invalid-from-state invocation of `reconcile-stream` returns.

### `resolve-decision` — the documented terminal exit for `DECISION_REQUIRED`

Stream-scoped from `DECISION_REQUIRED` only. Required: `--disposition
<SUPERSEDED|CLOSED>`, `--resolver`, `--resolution`, `--next-action`; optional
`--superseded-by`.

- `SUPERSEDED` **requires** `--superseded-by` (`TRANSITION_SUPERSEDED_BY_REQUIRED`);
  `CLOSED` **rejects** it (`TRANSITION_SUPERSEDED_BY_NOT_APPLICABLE`). This is what
  makes "mark it SUPERSEDED *with its replacement*" mechanically enforceable.
- The replacement is validated against the candidate document before any write:
  not defined → `TRANSITION_SUPERSEDED_BY_UNKNOWN`; equal to the stream being
  resolved → `TRANSITION_SUPERSEDED_BY_SELF`; already `SUPERSEDED`/`CLOSED` →
  `TRANSITION_SUPERSEDED_BY_DEAD`. An `INTEGRATED`/`CLOSED`-by-closure replacement
  is deliberately accepted: a replacement is usually already integrated.
- Effects, exactly: state → the disposition, `awaited` → `[]`, `running` → `[]`,
  `nextAction` → `--next-action`, and
  `resolution = { disposition, resolver, text, resolvedAt, supersededBy }`. Every
  other field is unchanged, no receipt is minted, `leases[]` is untouched.
- The verifier adds `RESOLUTION_INCONSISTENT` (resolution present but
  `disposition !== state`, or `SUPERSEDED` with a null `supersededBy`) and
  `RESOLUTION_SUPERSEDED_BY_UNKNOWN` (a `supersededBy` that names no stream).

### `abandon-stream` — the proof-gated exit from `RUNNING`

Stream-scoped, `from: ["RUNNING", "PLANNED"]`. Required `--reason`,
`--next-action`; optional `--awaited`. `--running` is not accepted: the outcome
is `running: []` by definition, and this transition exists precisely to remove a
live-work claim.

Preconditions, all fail-closed with zero mutation:

1. **Zero `ACTIVE` lease.** Any `leases[]` entry with `streamId === <stream>` and
   `state === "ACTIVE"` refuses with `TRANSITION_ABANDON_ACTIVE_LEASE`. This is
   the in-document machine lease, not the local custody lease.
2. **No fresh heartbeat.** No heartbeat record naming `stream` may have
   `ageMs(record, now) <= activeWindowMs`, else
   `TRANSITION_ABANDON_FRESH_HEARTBEAT`. The production helpers (`ageMs`,
   `DEFAULT_ACTIVE_WINDOW_MS`, the observability reader) are reused rather than
   re-implemented.

The returned `summary.heartbeatEvidence` discloses the number of heartbeat
records naming the stream, the freshest observed age, the effective window and
the number of heartbeat files present but unreadable — a read-only refusal is
only auditable when the evidence is reported.

`blocker` is **not** touched: a `PLANNED` stream may legitimately carry an
`APPROVAL` blocker, and erasing it here would silently delete a HIGH gate. No
receipt is minted and every other field is unchanged.

**Unreadable-heartbeat policy (deliberate).** An unreadable heartbeat file is not
"a heartbeat newer than the window", so it does not block by itself; it is
counted and disclosed in the summary. This matches the documented doctrine that
heartbeats are advisory local monitoring state (unlike custody records, where an
unreadable lease is uncertain custody and fails closed). It is never silently
ignored.

### The `RUNNING_WITHOUT_LIVE_EVIDENCE` verifier error

`lib/verify.mjs` reports a typed **error** (not a warning) when
`stream.state === "RUNNING"` and neither holds:

- an `ACTIVE` lease exists with `streamId === stream.id`; or
- a heartbeat record with `stream === stream.id` exists whose
  `ageMs(record, now) <= activeWindowMs`.

`running[]` prose is a description, never evidence. A `RUNNING` record can
therefore no longer be *created* without evidence: `create-stream` accepts
`--lease-id`, `--lease-role`, `--lease-session`, `--lease-expires` and
`--lease-worktree`, and appends exactly one `ACTIVE` lease (`revision: 1`,
`updatedAt` = transition time, `expiresAt: null` unless supplied, `worktree`
defaulting to the created record's `git.worktree`, `sessionId` from
`--lease-session` or `null`) in the same atomic transition. A `RUNNING` spec with
no lease flags is refused by the engine-level monotonicity rule
(`TRANSITION_REPAIR_NOT_MONOTONE`, naming `RUNNING_WITHOUT_LIVE_EVIDENCE`),
because it would introduce a liveness defect; lease flags without
`--lease-id`/`--lease-role` fail with
`TRANSITION_LEASE_ID_REQUIRED`/`TRANSITION_LEASE_ROLE_REQUIRED`; lease flags
on a non-`RUNNING` record fail with `TRANSITION_CREATE_LEASE_STATE_INVALID`.

**Settling evidence that R2 did not weaken the rule.** `938e3063` (type the
reconcile-stream `RUNNING` refusal) touched only `ops/workflow/README.md`,
`ops/workflow/__tests__/terminal-reconcile.test.mjs` and
`ops/workflow/lib/transition.mjs`; `lib/verify.mjs` was untouched, and the rule
remains live at `lib/verify.mjs` lines 30, 39, 103-187 and 774-781, with coverage
at `__tests__/coverage.test.mjs` lines 416-455 and
`__tests__/terminal-reconcile.test.mjs`. Prose is never evidence: a `RUNNING`
stream whose `running[]` is non-empty **and** whose
`owners.executor.sessionId` names a plausible session, but with zero `ACTIVE`
lease and no heartbeat in window, still fails closed with
`RUNNING_WITHOUT_LIVE_EVIDENCE`. Only an `ACTIVE` lease bound to the stream or a
heartbeat naming it inside the active window clears the rule.

`resolution === null`, and an absent `resolution` key, are both "not resolved":
no resolution rule fires, so every historical or not-yet-resolved record stays
valid and the property remains optional.

### Ordering invariants created by the rule

1. **Repair before you need a clean document.** While the current document
   carries a repairable defect, every transition may still read it under the
   sub-multiset rule below, but only `abandon-stream` and `refresh-artifact-pin`
   strictly reduce the repairable count. A document that carries the liveness
   defect is only *clean* after the orphaned `RUNNING` declaration is abandoned,
   so an operator repairing a real register abandons the orphan first and then
   performs ordinary reconciliations.
2. **A lease is returned only after the stream has left `RUNNING`.**
   `lease-update --lease-state RETURNED` on a `RUNNING` stream would produce a
   `RUNNING` declaration with no `ACTIVE` lease, which the verifier refuses; the
   transition engine therefore refuses that write.

### The sanctioned repair-read (R2.5 safety argument)

`runTransition` refuses to read a current document that is not verifier-clean.
Without an allowance, a document holding an orphaned `RUNNING` declaration or a
stale artifact pin could never be repaired: every transition — including
`abandon-stream` and `refresh-artifact-pin` — would be refused forever. The
allowance is one **engine-level rule with one closed set**, not a CLI flag and
not a transition-name special case:

- `REPAIRABLE = { "RUNNING_WITHOUT_LIVE_EVIDENCE", "ARTIFACT_HASH_MISMATCH" }`.
- The **current** document may be read if and only if *every* error reported for
  it is in `REPAIRABLE`. Any other current-document error still fails with
  `TRANSITION_STATE_INVALID` and zero mutation.
- The **candidate** must contain no error outside `REPAIRABLE`, and its multiset
  of repairable `code|path` tuples (sorted, with multiplicity) must be a
  **sub-multiset** of the current document's. Violation fails closed with
  `TRANSITION_REPAIR_NOT_MONOTONE` and zero mutation. If the current document has
  no repairable errors, the candidate must have none.
- Why a sub-multiset and not a strict subset: once two independent repairable
  defect classes coexist — the mandated schema edit invalidates `WF-C01`'s pin
  while an orphaned `RUNNING` declaration is still present — a per-class
  strict-subset rule lets each class block the other and the document becomes
  unrecoverable. Equal counts are therefore allowed **on an already-defective
  document**: a transition that neither reduces nor introduces a repairable
  defect publishes the document unchanged in that respect, and
  `workflow:verify` still exits `1`.
- Nothing can be hidden: no defect outside the closed set is tolerated, no
  transition can introduce a repairable defect (a `RUNNING` `create-stream` with
  no lease is refused), a clean current document still requires a clean
  candidate, and `workflow:verify` stays red until the repairable count reaches
  zero. `abandon-stream` and `refresh-artifact-pin` strictly reduce, so every
  document is eventually repairable. With zero repairable errors the behaviour is
  exactly as before.
- The deadlock is never solved by weakening the candidate gate, hand-editing JSON,
  or creating a fake `ACTIVE` lease.

### `refresh-artifact-pin` — repairing a stale artifact attestation

Refreshes exactly one stale `artifacts[].sha256` on a settled stream. It exists
because a sanctioned schema/source edit invalidates an existing pin and no other
transition could repair an attestation. Stream-scoped,
`from: ["COMPLETE", "INTEGRATED", "CLOSED"]`; required `--artifact-path
<repo-relative path>`, `--artifact-sha256 <lowercase 64-hex>` and `--reason`.

Guards, each typed, fail-closed, zero mutation:

1. the stream must already carry an `artifacts[]` entry for exactly that path →
   `TRANSITION_ARTIFACT_NOT_PINNED` (a pin may be refreshed, never created);
2. the file must exist and its current working-tree bytes must hash to exactly
   `--artifact-sha256` → `TRANSITION_ARTIFACT_HASH_MISMATCH` (a caller cannot
   invent a hash or pin bytes it does not have); a non-64-hex digest is
   `TRANSITION_ARTIFACT_SHA_INVALID`;
3. the state must be one of the three allowed → `TRANSITION_ARTIFACT_STATE_FORBIDDEN`.

Effect: exactly one `artifacts[i].sha256` changes; the path, the array length,
the state, and every other field are untouched apart from `stateUpdatedAt` and
`registry`. No receipt is minted. The file is resolved against the repository
root exactly as artifact verification resolves it.

### Determinism and the live-evidence inputs

`workflow:verify` and `workflow:render` accept `--now <iso>`,
`--active-window-ms <n>` and `--common-dir <path>`; `workflow:transition` accepts
`--now` and `--active-window-ms` as base flags so the engine and **both**
verifications receive them. A malformed `--now` or `--active-window-ms` is a usage
error (exit 2), never a silent fallback to the wall clock or the default window.
The heartbeat store is resolved from `gitCommonDir(repoRoot)` plus the
observability session-store path, overridable by `--common-dir`; an explicit
`--common-dir` that is not the state document's own resolved Git common directory
fails closed with `STATE_SCOPE_MISMATCH`, because foreign observability state may
never satisfy a local `RUNNING` claim.

Truthful determinism statement: the verifier and renderer are pure functions of
(state bytes, Git facts, artifact bytes, the heartbeat store, `now`, the active
window). **While a document declares a `RUNNING` stream**, `workflow:render:check`
is clock- and store-sensitive, because the store is read. **With zero `RUNNING`
declarations the store and the clock are not consulted at all**, so the same
document verified and rendered under two different `--now` values produces
byte-identical output. When no Git repository is resolvable, or the store does not
exist, the store is empty — the fail-closed direction for the rule.

### Register revision windows (R2.10, A1)

`registry.windows[]` is an optional reservation that names who may write for a
span of register revisions:

```json
{ "streamId": "WF-C09", "fromRevision": 218, "toRevision": 227,
  "holder": "WF-C09", "declaredAt": "<iso>" }
```

A **through-terminal** window has no upper bound:

```json
{ "streamId": "WF-C10", "fromRevision": 241, "toRevision": null,
  "holder": "WF-C10", "declaredAt": "<iso>" }
```

`toRevision: null` means "from the declaration revision until the holder's
terminal transition", and it is the **default reservation for a cycle**. The
bounded form is the reason: the WF-C09 reservation was `218..227` while that
cycle's own closure transitions ran at `228-233`, so protection lapsed
mid-cycle and two foreign pushes landed in the gap. A through-terminal window
cannot lapse.

- **Declaration.** `create-stream` accepts `--register-window-through-terminal`
  (the default form) or `--register-window-to <revision>`, plus
  `--register-window-holder <identity>` (default holder = the created stream's
  id; the holder flag requires one of the two bound forms). `lease-update`
  accepts the symmetric already-created path `--window-declare <streamId>
  --window-through-terminal` or `--window-to <revision>`, with optional
  `--window-from <revision>` (default: the current register revision) and
  `--window-holder <identity>` (default: the named stream's id). The two bound
  forms are mutually exclusive (`TRANSITION_WINDOW_FLAG_CONFLICT`), and declaring
  neither is `TRANSITION_WINDOW_FLAG_REQUIRED`. `fromRevision` is the register
  revision at declaration, so the span is anchored to the record the caller
  actually observed.
- **Check, in every transition before any mutation.** If a window satisfies
  `fromRevision <= registry.revision` and (`toRevision === null` or
  `registry.revision <= toRevision`) and it is not the invoking holder's, the
  transition fails closed with `TRANSITION_REVISION_WINDOW_HELD`, zero mutation,
  no receipt, render byte-identical. A transition is the holder's own when `--by`
  equals the window's `holder`, **or** the transition's target stream id equals
  the window's `streamId`. `holder` is an attestation at the same trust level as
  `--by`; a window grants no state authority of its own. Document-scoped
  transitions are subject to the same check, so a holder passes `--by <holder>`
  for its own pre-integration `coordination-update`.
- **Release.** Automatic: the window is removed in the same candidate in which
  its holder stream reaches `INTEGRATED`, `COMPLETE`, `CLOSED` or `SUPERSEDED`.
  Explicit: `lease-update --release-window <streamId>`, which names the window's
  own stream and is therefore always available as the documented remedy for a
  stuck holder. A window is never deleted by hand. A second window for the same
  stream is refused (`TRANSITION_WINDOW_DUPLICATE`); to re-declare, release
  first.
- Verifier rules: `WINDOW_INVALID` (a **bounded** `toRevision < fromRevision`),
  `WINDOW_UNKNOWN_STREAM` (the window names no defined stream), and
  `WINDOW_LAPSED` (a bounded `toRevision` below the current register revision
  while its holder is still non-terminal — the reservation is no longer
  protection). A through-terminal window can never be `WINDOW_INVALID` or
  `WINDOW_LAPSED`. A missing `windows` key and `[]` both mean "no window is
  declared", and no rule fires.

#### Two concurrency limits of the reservation and of `coordination`

Both are structural and documented rather than engineered around; this workflow
adds **no** co-holder mechanism.

1. **A reservation is only correct when its holder is the sole active register
   writer.** The holder predicate refuses every transition whose target stream is
   not the window's stream (`isWindowHolder`). During WF-C10's first registration
   attempt, three commits landed on `origin/main` from two peer cycles while the
   local registration ran; a `237..300` reservation would have refused those
   peers' legitimate stream-scoped transitions. A reservation therefore must not
   be declared in the presence of concurrent cycles; where cycles are genuinely
   concurrent, each registers with `create-stream` alone and declares no window.
2. **`coordination.activeCycleId` is single-valued.** It cannot represent two or
   more concurrent `RUNNING` cycles. The first claimant keeps the pointer and
   every additional concurrent cycle is represented by its own stream row, not by
   stealing `coordination-update`.

### Optional, declared, lazily-materialized properties

`resolution` and `registry.windows` are the named pattern for **optional,
declared, lazily-materialized** properties: each is listed in its parent's
`properties` (so `additionalProperties: false` still rejects unknown keys) but
deliberately **not** in `required`, and a missing key is equivalent to `null` /
`[]`. Readers treat the absent form as "absent" and never fire a rule on it.

The alternative — making either key required — would force a `contractVersion`
bump plus a mechanical rewrite of every historical stream record, every fixture,
and every `specs/register/*.json` create-stream spec: roughly 45 files of
unrelated churn that would rewrite historical identity and buy no truth, because
both properties are only meaningful on the records that actually use them.
`contractVersion` therefore stays `1.2.0`, `lib/migrate.mjs` needs no new step,
and no historical bytes change. `resolution: null` and a missing `windows` key are
both treated as absent.

## Compaction checkpoint (A5)

`ops/workflow/lib/checkpoint.mjs` (exposed by `workflow:checkpoint`) emits a
bounded recovery object carrying only: stream id, role, worktree/branch,
base/candidate/integration SHAs, state, revision, lease id, directive hash, last
completed gate, next atomic action, forbidden boundaries, and pending approval.
`buildCheckpoint` drops unknown input keys, rejects credential-shaped values
(`sk-…`, bearer tokens, PEM blocks, `password=`/`api_key=`, JWT), enforces a
2048-byte ceiling, per-field length limits, and a boundary-count limit.
Checkpoints never carry transcripts, tool output, or environment contents.

Automatic compaction and pruning are configured in the project `opencode.json`
using keys accepted by the installed OpenCode 1.18.21:

```json
{ "compaction": { "auto": true, "prune": true, "reserved": 12000 },
  "agent": { "compaction": { "model": "opencode-go/deepseek-v4.1-flash", "variant": "low" } },
  "subagent_depth": 1 }
```

The installed version accepts `reserved` (not a v2 `buffer`/`keep` form);
resolution is proven by `opencode debug config --pure`.

## Project roles (A4)

`.opencode/agents/` defines four least-privilege roles that resolve from the
installed OpenCode configuration surface:

| Agent | Mode | Edit | Task | Notes |
| --- | --- | --- | --- | --- |
| `atlas-planner` | primary | ATLAS repo/worktrees only | only `atlas-executor`, `atlas-qa`, `atlas-wave-auditor`, and the existing `atlas-executor-delegate` / `atlas-qa-delegate` | variant `max` |
| `atlas-executor` | subagent | ATLAS repo/worktrees only; runtime-config, DB, and companion paths denied | denied | cannot merge, rebase, reset, stash, push, install, or manage worktrees |
| `atlas-qa` | subagent | denied | denied | read/command verification only |
| `atlas-wave-auditor` | subagent | denied | denied | read/command audit only |

Task allowlists are fail-closed and account for OpenCode's last-matching-rule
semantics (a scalar `task: deny` denies every target; a `"*": deny` entry is
followed by explicit allows). QA and the auditor cannot self-promote through the
Task tool. The user can still invoke every role directly, and the existing
`atlas-executor-delegate` / `atlas-qa-delegate` faces are preserved unchanged.
`opencode debug config --pure` and `opencode debug agent <name>` are the
verification surfaces used by `ops/workflow/__tests__/roles.test.mjs`.

## Local observability, liveness, and notifications (B1/B2/B4/B5)

The WF-C03 OpenCode plugin (`.opencode/plugins/atlas-observability.ts`) keeps
compact, restart-safe session state for local monitoring. It is a **monitor, not
an orchestrator**: it spawns nothing, sends nothing, approves nothing, retries
nothing, and never navigates, logs in, or touches a browser.

### Storage

All state lives under the repository **Git common directory**, never inside a
worktree and never as committed data:

```
<git-common-dir>/atlas-observability/
  sessions/<session-id>.json      # one writer per session file
  custody/<profile-key>.json      # one browser-custody lease per profile
  notifications.json              # bounded local ring buffer
  custody.lock, notifications.lock, *.tmp
```

`lib/observability.mjs` exposes the whole store; `lib/custody.mjs` the lease;
`lib/liveness.mjs` the classification engine. `status.mjs` accepts
`--common-dir <path>` so a caller can point the reader at another common dir
(tests use a temp dir and never write the real one).

### Bounded, redacted, atomic records

A heartbeat record is a **closed allowlist** of identity and status fields:
`schema`, `sessionId`, `role`, `stream`, `worktree`, `branch`, `head`, `leaseId`,
`status`, `firstSeenAt`, `updatedAt`, `lastEventAt`, `lastEventType`,
`lastAtomicAction`, `nextAction`, `processId`, `host`, `revision`, `transitions`,
`expiresAt`. Unknown input keys are dropped by construction, so prompts,
responses, transcripts, command output, diffs, environment contents, and browser
storage cannot be stored — they have nowhere to go. Free-form text is passed
through `lib/redact.mjs`, which collapses control characters and replaces
credential-shaped substrings (`sk-…`, bearer tokens, PEM/private-key blocks,
`ghp_…`, `AKIA…`, `xox…`, `password=`/`api_key=`/`token=` assignments, JWTs) with
`[REDACTED:<name>]`. Records are capped at 8192 bytes with at most 24 sanitized
transitions; the notification ring buffer keeps at most 50 entries.

Publication is stage-then-rename. Temp names are unique per call (pid,
millisecond, counter, random suffix) and the rename is retried on the bounded,
transient Windows errors (`EPERM`/`EACCES`/`EBUSY`/`ENOENT`) that the lock module
already treats as transient. A reader therefore observes either the previous
complete record or the next complete record, never a partial one; a crash between
stage and publish leaves the prior record intact and discards the staged bytes.

### Subscribed events

`session.created`, `session.updated`, `session.status`, `session.idle`,
`session.error`, `session.compacted`, `session.deleted`, `permission.asked`,
`permission.replied`. Permission and compaction events are recorded as sanitized
`{at, type, status}` transitions only — a permission reply can never widen the
active packet because no permission, pattern, response, or grant field exists in
the record. The tool hook records the tool **name** as `lastAtomicAction` and
never its arguments. Every hook body is guarded, so a plugin fault cannot throw
into the OpenCode host.

### Classification (`workflow:status`)

`workflow:status` reconciles three independent evidence sources: local
heartbeats, real Git worktree state (`git status --porcelain`, current HEAD), and
the committed machine register (`streams[].owners`, `leases[]`, `running[]`,
coordination). It **reads** the register through the production verify path and
never writes it.

| Classification | Meaning |
| --- | --- |
| `ACTIVE` | recorded process is alive and the last event is inside the active window |
| `IDLE` | recorded process is alive but has gone quiet |
| `RETURNED` | the session recorded its own terminal event (`session.deleted`) |
| `ERROR` | the session recorded `session.error` or `ERROR` status |
| `STALE_UNCONFIRMED` | process presence could not be confirmed, or custody expired |
| `UNKNOWN` | no readable heartbeat for that session |

Two rules are load-bearing. **Expiry is uncertainty, not death**: a missing
process or an ancient heartbeat never yields `RETURNED`/`ERROR`, and uncertain
custody is never treated as free. **A worktree directory is not activity**: the
directory is reported as an observed artifact, but only a live recorded process
plus a recent event makes a session `ACTIVE`. Output is one JSON object
(`status`, `summary`, `nextActions`, `artifacts`, `errors`) with exit `0`/`1`/`2`;
`--json` prints the same object, and a malformed `--now` or `--active-window-ms`
is a usage error rather than a silent fallback. Recovery instructions and the
exact observed artifacts (worktree path, HEAD, process id, pid liveness) are
always included.

### Notifications

An optional `--notify-kind` appends one bounded local record announcing
`RETURNED`, `ERROR`, `CUSTODY_CONFLICT`, or `DECISION_REQUIRED` to the ring
buffer surfaced by `workflow:status`. The append is a local file write only; it
starts no process, performs no network call, edits no product state, and grants
no approval or retry authority. An unknown kind is a typed failure.

## Browser custody lease (B3)

`workflow:custody` serializes access to the shared persistent Playwright profile
(`C:\Users\njgro\.config\opencode\playwright-profile` by default). It records and
validates custody; it never drives the browser.

Operations: `acquire`, `renew`, `transfer-request`, `transfer-ack`, `release`,
`recover`, `login`, `status`. A lease binds session, role, stream, profile,
origin (mandatory; the approved ATLAS origin is
`https://njgrm.buru-degree.ts.net` and any other origin requires the explicit
`--override-origin` flag, which still requires `https`), authorized login budget,
expected audit delta, issued/renewed/expiry timestamps, cleanup owner, and a
monotonic `revision`.

Invariants:

- Exactly one `ACTIVE` controller per profile; a second `acquire` fails with
  `CUSTODY_HELD`.
- **Expiry becomes `STALE_UNCONFIRMED`, never an automatically free lease.** An
  expired lease still blocks `acquire`, cannot be renewed or transferred, and is
  cleared only by a verified owner `release` (which must acknowledge complete
  cleanup) or an explicit operator `recover` (`--confirm` plus operator identity
  and reason).
- Every mutation is revision-CAS guarded; a stale `--expected-revision`, a wrong
  owner, an unauthorized/exhausted login budget, an incomplete cleanup, a wrong
  origin, or a transfer without both owner acknowledgements fails with a typed
  `CUSTODY_*` code and **mutates nothing**.
- A transfer is two-step: the current owner requests it, and only the target may
  acknowledge it, which moves the lease.
- **A lease file that exists but cannot be read or validated is uncertain
  custody, never free custody.** `readLeaseResult` distinguishes `ABSENT` from
  `UNREADABLE`, and every operation — `acquire`, `renew`, `transfer-request`,
  `transfer-ack`, `release`, `recover`, `login`, `status` — fails closed with
  `CUSTODY_UNREADABLE` and leaves the file byte-identical. There is no automatic
  clear, and `recover --confirm` will not rewrite an unreadable record. The only
  documented recovery mirrors the lock doctrine: after proving that no custody is
  live, an operator removes that single corrupt file by hand and re-acquires.
  `workflow:custody --op status` exits `1` with `CUSTODY_UNREADABLE` and names the
  path, reason, and manual-recovery instruction; `workflow:status` reports the
  same in `summary.custodyUnreadable` and `summary.unreadableLeases` plus a
  `custody` next action, and never reports "no lease" for that profile.
- Heartbeats and notifications are **advisory** local monitoring state and are
  intentionally reset when a record is missing or corrupt; custody records are
  not, and `lib/observability.mjs` documents that distinction at the reader.
- Lease mutations are serialized through an exclusive lock under the Git common
  dir that reuses the state-transition lock's publish/reclaim/claim-mutex
  semantics, so two concurrent acquires commit exactly one lease plus one typed
  loser.

`--now` and `--ttl-min` are validated: malformed values are usage errors, because
they decide `ACTIVE` versus `STALE_UNCONFIRMED`.

### Plugin discovery

The plugin resolves from `.opencode/plugins/` in the installed OpenCode 1.18.21.
`opencode debug config` (which, unlike `--pure`, loads external plugins) lists
`file:///<repo>/.opencode/plugins/atlas-observability.ts` in `plugin` and
`plugin_origins` with `scope: local`, and a probe plugin placed in a temp
`.opencode/plugins/` is actually evaluated during config resolution (it wrote its
startup marker). `__tests__/plugin-load.test.mjs` re-runs that resolution against
the committed file.

## Byte-pinned artifacts and line endings

Artifact pins (`streams[].artifacts[].sha256`) and closure receipt pins
(`streams[].closure.receipt.sha256`) are **raw byte SHA-256 values of the LF
form** of the file. They are verified against the working-tree bytes, so a
checkout that rewrites LF to CRLF would invalidate every pin.

The repository root `.gitattributes` forces `eol=lf` for the pinned classes
(`ops/workflow/**`, `docs/plans/**`, `docs/handoffs/**`, `docs/reviews/**`,
`docs/prompts/**`) plus `.opencode/agents/**` and `.opencode/plugins/**`. Any
future pinned artifact must live under one of these paths, or the policy must be
extended in the same change. `__tests__/artifact-portability.test.mjs`
materializes every pinned artifact through a real `core.autocrlf=true` Git
checkout, asserts Git's own `check-attr eol` resolution, and includes a mutant
flow that reproduces the CRLF defect when the rules are absent.

`docs/prompts/**` is a pinned class because a HIGH packet is bound by
`record-approval --packet-sha256`, which is an **LF-normalized** digest. The
materialization regression pins a real `docs/prompts/**` file, re-materializes it
through a real checkout with and without the attribute, and asserts that the
LF-normalized hash and the Git blob hash are unchanged in both cases — the attribute
is load-bearing for the raw workspace bytes, while the LF-normalized pin is
checkout-stable by construction. The documented pin convention is
`blob <git-sha1> + LF-SHA-256 <hash> + the exact reproducing command`.

### Dependency-tree identity (section 3.6)

Dependency-tree reuse (worktree junctions, shared `node_modules`) is decided by
the **LF-normalized** `package-lock.json` SHA-256, never by raw checkout bytes: a
`core.autocrlf=true` checkout rewrites LF to CRLF and a byte-for-byte compare then
reports a false mismatch.

```bash
node ops/workflow/deps.mjs identity <path>      # exit 0 ok, 1 unreadable, 2 usage
node ops/workflow/deps.mjs compare <a> <b>      # exit 0 equal, 1 different, 2 usage
```

This is the sanctioned command for the dependency-reuse rule in `AGENTS.md`:
before reusing an existing dependency tree, `compare` the two lockfiles and treat
exit `0` as identity. A real difference still exits `1`.

When no Git repository is resolvable around the state file, artifact paths
resolve against the state file's directory (documented fallback; the normal path
resolves against the repository root).

## Renderer

The renderer runs the same validation engine first. On invalid state it exits
`1`, prints the failure JSON, and leaves any existing output untouched. On
success it writes UTF-8 Markdown with LF newlines and a trailing newline.
`--check` verifies the existing output equals the deterministic render without
writing. Output is a pure function of the state file content plus its content
SHA-256: no timestamps, no file paths, no environment values. Sections include
registry revision, stream states, Git identity (including remote observations),
leases, closure receipt pins, resolutions, revision windows, approvals,
observations, custody, routing, and pinned artifacts.

The `## Resolutions` table (stream, disposition, resolver, superseded-by,
resolved-at, resolution text) lists every stream whose `resolution` is non-null,
sorted by stream id with the file's existing escaping helpers. The
`## Revision windows` table (stream, from revision, to revision, holder, declared
at) lists every declared `registry.windows[]` entry, sorted by stream id then
revision span. The renderer also accepts `--now`, `--active-window-ms` and
`--common-dir` so it reads exactly the live-evidence inputs the verifier reads;
see "Determinism and the live-evidence inputs".

## Fixture harness and performance

`__fixtures__/` holds state templates with `{{BASE_SHA}}`, `{{CANDIDATE_SHA}}`,
`{{INTEGRATION_SHA}}`, `{{OTHER_SHA}}`, and `{{RECEIPT_SHA}}` placeholders. The
fixture matrix validates in-process through the exact production engine against
one shared disposable repository built with a single `git fast-import`; the
remaining tests use disposable repositories created under `os.tmpdir()`. A true
CLI process test is preserved for the argument/exit-code contract and the atomic
transition lifecycle, and the real Git checkout portability controls are
preserved.

On this host the fixture/semantic suite runs in about 2 seconds and the complete
`npm run workflow:test` in well under the 45-second budget (the earlier
per-assertion Node-process and per-assertion Git-repository harness measured
about 82 seconds and spawned roughly 250 Git processes). The WF-C03 observability
and custody suites added multi-process storms and one real `opencode debug config`
resolution; the complete suite measured 21.6 seconds wall for 224 tests, against
19.8 seconds for the 162 tests at the adopted base `3a1a1759`.

## WF-C01 residual disposition

| Residual | Disposition |
| --- | --- |
| R4 artifact base-path fallback undocumented | Closed — documented above |
| R2 six engine codes lacked committed fixtures | Closed — `__tests__/coverage.test.mjs` reaches every deterministic rule code; `GIT_DIFF_FAILED` and unused schema keywords (`SCHEMA_MAXIMUM`, `SCHEMA_MIN_ITEMS`, `SCHEMA_MAX_LENGTH`) are retained as defensive/unreachable with the shipped schema |
| R3 receipt `verified.artifacts` attested but excluded from the staleness compare | Retained — artifact bytes are enforced independently by `ARTIFACT_HASH_MISMATCH` |
| R1 portability coverage used a naive prefix matcher | Closed — the test now also asserts Git's own `check-attr eol` resolution |
| O1 generated register did not surface the closure receipt pin | Closed — the rendered register has a "Closure receipts" section |
| O2 machine-vs-prose register authority wording | Closed — the authority statement above names the JSON state as authoritative |
| R5 `.gitattributes` fixes future checkouts only | Retained — an already-CRLF working tree needs one refresh |
| R6 `--stream` without `--receipt` was a silent no-op | Closed — now a usage error (exit 2) |
| R7 `receipt.stateSha256` is informational | Retained — the receipt pins facts, not the containing state bytes |
| R8 seed candidate-SHA predicate is a shape check | Retained — the verifier enforces type, existence, and ancestry |
