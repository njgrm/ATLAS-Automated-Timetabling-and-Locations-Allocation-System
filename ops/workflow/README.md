# ATLAS workflow foundation (`ops/workflow`)

Repository-owned, machine-readable delivery-cycle state with a fail-closed
verifier, a deterministic Markdown register renderer, atomic named state
transitions, an exclusive-writer lock, and a bounded compaction checkpoint
contract.

The JSON state document (`docs/plans/atlas-delivery-cycles.json`) is the
authority for current cycle state. The generated register
(`docs/plans/atlas-active-delivery-streams.generated.md`) is derived output; the
historical prose register (`docs/plans/atlas-active-delivery-streams.md`) stays
as context only and is never the current-status authority.

## Commands

```bash
npm run workflow:test      # node --test ops/workflow/__tests__/*.test.mjs
npm run workflow:verify    -- --state docs/plans/atlas-delivery-cycles.json
npm run workflow:render    -- --state docs/plans/atlas-delivery-cycles.json --output docs/plans/atlas-active-delivery-streams.generated.md
npm run workflow:render:check   # --check: no write, exit 1 on any drift
npm run workflow:transition -- --transition <name> --state <path> --expect-revision <n> [flags]
npm run workflow:checkpoint -- --state <path> --stream <id> [flags]
```

Direct CLI contract:

- `node ops/workflow/verify-cycle.mjs --state <path> [--receipt <path>] [--stream <id>]`
- `node ops/workflow/render-register.mjs [--check] --state <path> --output <path>`
- `node ops/workflow/transition.mjs --transition <name> --state <path> --expect-revision <n> [flags]`
- `node ops/workflow/checkpoint.mjs --state <path> --stream <id> [flags]`

Exit codes: `0` ok, `1` state/transition failure, `2` usage error. `--stream`
without `--receipt` is a usage error, not a silent no-op. There is never a
default state file: `--state` is always required.

Every CLI prints exactly one JSON document with the top-level keys `status`,
`summary`, `nextActions`, `artifacts`, `errors`. Identical input produces
byte-identical stdout and byte-identical rendered output.

## Contract (`contractVersion` 1.1.0)

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
stream -> render -> verify rendered bytes -> optionally mint/pin the closure
receipt -> atomic replace`

Named transitions: `record-executor-return`, `record-correction`,
`record-qa-result`, `coordination-update`, `record-integration`, `record-audit`,
`close-cycle`, `record-remote-observation`, `lease-update`. The planner closure
sequence is:

1. `record-executor-return` (derives `changedPaths` from `git diff base...candidate`)
2. `record-qa-result` (`--qa-verdict`, `--qa-session`, `--gates total/passed/failed/blocked/unperformed`)
3. `coordination-update --mode MANUAL` — **required while the closing stream is the
   active cycle.** If `coordination.activeCycleId` still names the closing stream
   when it moves to `INTEGRATED`/`COMPLETE`, that stream becomes terminal and the
   candidate document is rejected with `ACTIVE_CYCLE_TERMINAL`. Move coordination
   off the closing stream immediately before integration.
4. `record-integration` (`--integration`)
5. `record-audit` (`--auditor-verdict`, `--auditor-session`)
6. `close-cycle` (`--receipt`) — mints and pins the closure receipt
7. `record-remote-observation` (`--ref`, `--observed-sha`) — a snapshot, terminal

`coordination-update` is document-scoped (no `--stream` required) and takes
`--mode MANUAL|CYCLE_ACTIVE`, `--active-cycle-id <stream-id|null>`, and
`--global-next-action <text|null>`. `MANUAL` forces a null active cycle and
rejects an explicitly non-null id; `CYCLE_ACTIVE` requires a defined,
non-terminal target stream and a non-empty global next action. It runs through
the same lock, CAS, staging, render, verification, and atomic-replace pipeline,
so a rejected update leaves state, render, and receipt byte-identical.

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

Recovery for a manually proven-crashed unreadable lock: read the lock file,
confirm it carries no live `ownerPid` (and that no process is still running the
transition), then remove that one file by hand and re-run; never delete it merely
because it is old, and never delete a lock owned by a live process.

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

## Byte-pinned artifacts and line endings

Artifact pins (`streams[].artifacts[].sha256`) and closure receipt pins
(`streams[].closure.receipt.sha256`) are **raw byte SHA-256 values of the LF
form** of the file. They are verified against the working-tree bytes, so a
checkout that rewrites LF to CRLF would invalidate every pin.

The repository root `.gitattributes` forces `eol=lf` for the pinned classes
(`ops/workflow/**`, `docs/plans/**`, `docs/handoffs/**`). Any future pinned
artifact must live under one of these paths, or the policy must be extended in
the same change. `__tests__/artifact-portability.test.mjs` materializes every
pinned artifact through a real `core.autocrlf=true` Git checkout, asserts Git's
own `check-attr eol` resolution, and includes a mutant flow that reproduces the
CRLF defect when the rules are absent.

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
leases, closure receipt pins, approvals, observations, custody, routing, and
pinned artifacts.

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
about 82 seconds and spawned roughly 250 Git processes).

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
