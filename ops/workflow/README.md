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
npm run workflow:verify    -- --state docs/plans/atlas-delivery-cycles.json
npm run workflow:render    -- --state docs/plans/atlas-delivery-cycles.json --output docs/plans/atlas-active-delivery-streams.generated.md
npm run workflow:render:check   # --check: no write, exit 1 on any drift
npm run workflow:transition -- --transition <name> --state <path> --expect-revision <n> [flags]
npm run workflow:checkpoint -- --state <path> --stream <id> [flags]
npm run workflow:status    [-- --json] [--common-dir <path>] [--now <iso>]
npm run workflow:custody   -- --op <operation> [flags]
```

Direct CLI contract:

- `node ops/workflow/verify-cycle.mjs --state <path> [--receipt <path>] [--stream <id>]`
- `node ops/workflow/render-register.mjs [--check] --state <path> --output <path>`
- `node ops/workflow/transition.mjs --transition <name> --state <path> --expect-revision <n> [flags]`
- `node ops/workflow/checkpoint.mjs --state <path> --stream <id> [flags]`
- `node ops/workflow/status.mjs --state <path> [--json] [--common-dir <path>] [--now <iso>] [--active-window-ms <n>] [--profile <path>] [--notify-kind <kind>] [--notify-message <text>]`
- `node ops/workflow/custody.mjs --op <acquire|renew|transfer-request|transfer-ack|release|recover|login|status> --state <path> [flags]`

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
