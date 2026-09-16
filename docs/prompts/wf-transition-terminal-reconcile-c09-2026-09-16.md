# WF-TRANSITION-TERMINAL-RECONCILE-C09 — executor packet

ROLE: EXECUTOR. Recommended reasoning variant: `high`.
Risk tier: MEDIUM source/test on the `ops/workflow` delivery-cycle authority. No
live, runtime, database, schema-apply, migration, generation, publication,
deployment, or companion action. A fresh Wave Completion Audit is required after
integration because this changes the delivery-cycle state authority.

## 0. Immutable identity

| Item | Value |
| --- | --- |
| Stream | `WF-TRANSITION-TERMINAL-RECONCILE-C09` |
| Accepted base | the commit that contains this packet — the planner's registration commit (run `git rev-parse HEAD` in the worktree; it is `origin/main` at dispatch). Your candidate range is `base...candidate` from that commit, and you must pass that exact SHA as `--base` when the return is recorded. |
| Register base | `registry.revision` **218** (registration sequence `create-stream` → `lease-update` → `coordination-update`, from 215) |
| Pre-registration `origin/main` tip | `61efa8a1` (`61efa8a1b4ba4598e25f7d37909f88a5b94a66b2`) — the observation baseline recorded at `create-stream`, not your candidate base |
| Worktree | `E:/ATLAS-worktrees/wf-transition-terminal-reconcile-c09` |
| Branch | `work/wf-transition-terminal-reconcile-c09` |
| Directive | read `origin/main:AGENTS.md` directly; LF-normalized SHA-256 `7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3` |
| Budget | 150 minutes; at 112 minutes (75%) report active command, completed evidence, remaining critical path and freeze scope |

Naming note: the operator's first label for this stream was
`WF-TRANSITION-TERMINAL-RECONCILE-C06`. The `C09` resume superseded that label
before any commit, candidate, register record, or worktree was created under
`C06`; the `C06` worktree was removed clean (no commits) and no `C06` record
exists anywhere. Use `C09` in every path, identifier, and message.

Standing rules that override any looser phrasing in this packet:

- Do not edit `main`. Do not push any branch.
- The live register is repaired **inside this candidate, and only through the new
  transitions** (§3.3, §3.2, §3.1). This is not optional and it is not the
  planner's post-integration job: `__tests__/seed.test.mjs` asserts that the
  committed `docs/plans/atlas-delivery-cycles.json` verifies with exit `0` and
  zero errors, that the committed generated register equals the renderer output
  byte-for-byte, and `__tests__/render-controls.test.mjs` asserts
  `render-register.mjs --check` exits `0`. The new `RUNNING` rule (§3.4) makes the
  inherited register fail those gates until the orphaned `RUNNING` declaration is
  repaired, so a candidate that leaves the register untouched cannot be green.
  You must **never** hand-edit the JSON: every register change goes through the
  new transitions with an explicit `--expect-revision` CAS, and the ordered
  sequence in §4 is mandatory. The planner independently re-verifies the register
  delta, the ordering, and the CAS revisions.
- Follow the Direct Editing Rule: edit repository source directly; do not create
  bulk text-replacement helper scripts.
- Commit one conventional commit (or a small number of additive commits) on
  `work/wf-transition-terminal-reconcile-c09`, then return `REVIEW_REQUIRED`.
  Never amend, rebase, or force-push a handed-off commit.

## 1. Objective

Make the machine register able to state the truth about three situations that it
currently cannot express, and then prevent the worst of those situations from
recurring:

1. a `RUNNING` declaration whose work is gone (no lease, no live session) must be
   abandonable back to a truthful `PLANNED`;
2. a `DECISION_REQUIRED` stream must have a documented terminal exit that records
   who resolved it and what the resolution was;
3. a terminal or `INTEGRATED` stream's `awaited` / `running` / `blocker` /
   `nextAction` residue must be reconcilable atomically **without** changing the
   stream's state;
4. and a stream may no longer *declare* `RUNNING` unless the declaration is
   backed by evidence — an `ACTIVE` lease or a fresh heartbeat.

Work through `ops/workflow` only. There is no product change in this packet.

## 2. Owned and forbidden paths

Owned (you may edit):

- `ops/workflow/**` — `lib/transition.mjs`, `lib/verify.mjs`, `lib/migrate.mjs`
  if needed, `lib/render.mjs`, `lib/schema.mjs` if needed,
  `schema/cycle-state.schema.json`, `transition.mjs` (CLI), `verify-cycle.mjs`,
  `render-register.mjs`, `README.md`, `__tests__/**`, `__fixtures__/**`.

Forbidden (do not edit, do not create):

- `atlas-client/**`, `atlas-server/**`, `prisma/**`, `EnrollPro/**`,
  `AIMS/**`, `SMART/**`, any companion clone.
- `.opencode/**`, `docs/prompts/**` (including this packet),
  `docs/handoffs/**`, `docs/reviews/**`, `CHANGELOG.md`,
  `docs/reference/atlas-runtime-source-of-truth-map.md`.
- `docs/plans/atlas-delivery-cycles.json` and
  `docs/plans/atlas-active-delivery-streams.generated.md` may change **only**
  through the new transitions, at the CAS revision the packet names, and in the
  order §4 requires. Hand-editing either file is forbidden even to fix a single
  character; the generated projection is only ever republished by the transition
  engine. No other `docs/plans/**` path may change.
- `docs/plans/receipts/**` — do not mint, edit, or delete a closure receipt.
- Any runtime, scheduled task, environment file, port, database, browser
  session, or login. No login is authorized for this packet.

The candidate must leave every path outside `ops/workflow/**` byte-identical.
`git status --short` must be empty at handoff.

## 3. Required capabilities and exact contracts

Names, flag names, state sets, and error codes below are **fixed contracts**.
You may add further codes, but these must exist with these exact spellings.

### 3.1 `reconcile-stream` — atomic residue reconciliation without a state change

- Stream-scoped. `from`: every state in the schema enum **except `RUNNING`**
  (i.e. `PLANNED`, `REVIEW_REQUIRED`, `CORRECTION_REQUIRED`, `ACCEPT_READY`,
  `INTEGRATION_READY`, `INTEGRATED`, `DECISION_REQUIRED`,
  `HIGH_APPROVAL_REQUIRED`, `BLOCKED`, `EXTERNALLY_BLOCKED`, `SUPERSEDED`,
  `CLOSED`, `COMPLETE`).
  Invoking it on `RUNNING` fails closed with a typed
  `TRANSITION_RECONCILE_RUNNING_FORBIDDEN` and zero mutation. Rationale to record
  in the README: `RUNNING` is the one state whose residue *is* a claim of live
  work; it may only be exited through the proof-gated `abandon-stream`, never
  edited in place. This is the packet's interpretation of the operator's
  "non-scratch state": `PLANNED`, decision, and every terminal state are
  reconcilable, so all five required acceptance reconciliations are satisfiable.
- Optional flags (at least one must be supplied):
  `--awaited <json array of strings>`, `--running <json array of strings>`,
  `--next-action <text>`, `--blocker-kind <NONE|EXTERNAL|DEPENDENCY|APPROVAL|INTERNAL>`,
  `--blocker-detail <text>`, `--blocker-safe-work-remaining <true|false>`,
  `--blocker-safe-work-items <json array of strings>`.
- Supplying none of them fails closed with `TRANSITION_RECONCILE_NO_CHANGES` and
  zero mutation.
- Round-trip flags must preserve their existing validation style: malformed JSON,
  non-string array members, or an unknown `--blocker-kind` fail closed with a
  typed error and zero mutation.
- `--blocker-safe-work-remaining` must be read strictly: only the exact strings
  `true` / `false` are accepted; anything else (including `1`, `0`, `yes`,
  empty) fails closed with `TRANSITION_BLOCKER_FLAG_INVALID`.
- Blocker fields apply individually; an unset field keeps its prior value. After
  applying, the transition must enforce
  `blocker.safeWorkRemaining === (blocker.safeWorkItems.length > 0)` and fail
  closed with `TRANSITION_BLOCKER_INCONSISTENT` otherwise. This makes the
  candidate trip-proof for the existing verifier rule `BLOCKER_INCONSISTENT`
  instead of relying on it.
- `state` must be unchanged. Every other stream field other than `awaited`,
  `running`, `blocker`, `nextAction`, `stateUpdatedAt` (which the engine
  refreshes for every transition) must be byte-identical: `git`, `gates`,
  `review`, `corrections`, `successors`, `requires`, `owners`, `approval`,
  `observations`, `artifacts`, `closure`, `objective`, `riskTier`, `kind`,
  `resolution`.
- `reconcile-stream` mints no receipt. It does not touch `leases[]`.
- Backstop to prove, not to hide: setting `--blocker-kind NONE` on a `BLOCKED` or
  `EXTERNALLY_BLOCKED` stream must still fail the candidate verification
  (`BLOCKER_KIND_MISMATCH`) and therefore fail the transition with
  `TRANSITION_RESULT_INVALID` and zero mutation. Add that as a negative case.

### 3.2 `resolve-decision` — the documented terminal exit for `DECISION_REQUIRED`

- Stream-scoped. `from`: `["DECISION_REQUIRED"]` only.
- Required flags: `--disposition <SUPERSEDED|CLOSED>`, `--resolver <identity>`,
  `--resolution <text>`, `--next-action <text>`.
- Optional: `--superseded-by <stream-id>`.
- `--disposition` outside the enum fails closed with
  `TRANSITION_DISPOSITION_INVALID` and zero mutation.
- `--disposition SUPERSEDED` **requires** `--superseded-by`, else
  `TRANSITION_SUPERSEDED_BY_REQUIRED`. `--disposition CLOSED` **rejects**
  `--superseded-by`, else `TRANSITION_SUPERSEDED_BY_NOT_APPLICABLE`. Both with
  zero mutation. This is what makes the register rule "mark it SUPERSEDED *with
  its replacement*" mechanically enforceable.
- `--superseded-by` is validated against the candidate document before any write,
  each condition with its own typed code and zero mutation:
  - not a defined stream id → `TRANSITION_SUPERSEDED_BY_UNKNOWN`;
  - equal to the stream being resolved → `TRANSITION_SUPERSEDED_BY_SELF`;
  - names a stream whose state is `SUPERSEDED` or `CLOSED` →
    `TRANSITION_SUPERSEDED_BY_DEAD`.
  Do not add a further state restriction: the live replacement
  `TT-WARNING-COUNT-C07A-R1` is `INTEGRATED`, which is a terminal state, so
  requiring a non-terminal replacement would make the required acceptance proof
  unsatisfiable.
- Effects, exactly:
  - `state` → the disposition;
  - `awaited` → `[]` (always; `resolve-decision` accepts no `--awaited`);
  - `running` → `[]`;
  - `resolution` → `{ disposition, resolver, text, resolvedAt: <transition now>,
    supersededBy: <id or null> }`;
  - `nextAction` → `--next-action`;
  - `blocker`, `git`, `gates`, `review`, `corrections`, `successors`,
    `requires`, `owners`, `approval`, `observations`, `artifacts`, `closure`
    unchanged; no receipt minted; `leases[]` untouched.

### 3.3 `abandon-stream` — the proof-gated exit from `RUNNING`

- Stream-scoped. `from`: `["RUNNING", "PLANNED"]`.
- Required flags: `--reason <text>`, `--next-action <text>`. `--next-action` is
  mandatory because the outcome state `PLANNED` is in the verifier's
  `NEXT_ACTION_STATES`.
- Optional: `--awaited <json array of strings>`, `--active-window-ms <n>`.
  `--running` is **not** accepted: the outcome is `running: []` by definition, and
  this transition exists precisely to remove a live-work claim.
- Preconditions, all fail-closed with zero mutation:
  1. **Zero ACTIVE lease.** No entry in the candidate document's `leases[]` may
     have `streamId === <stream>` and `state === "ACTIVE"`, else
     `TRANSITION_ABANDON_ACTIVE_LEASE`. This is the in-document machine lease,
     not the local custody lease.
  2. **No fresh heartbeat.** No heartbeat record whose `stream` equals
     `<stream>` may have `ageMs(record, now) <= activeWindowMs`, else
     `TRANSITION_ABANDON_FRESH_HEARTBEAT`. Reuse the production helpers
     (`lib/liveness.mjs` `ageMs`, `DEFAULT_ACTIVE_WINDOW_MS`; the observability
     reader) rather than re-implementing freshness.
  3. **Ordering.** `abandon-stream` is the only transition allowed to read a
     document carrying the new liveness defect (§3.4), so it must be invoked
     before any other transition on such a document. State that ordering
     constraint in the README.
- Mandatory observability: the transition's returned `summary` must disclose the
  heartbeat evidence it relied on — the number of heartbeat records naming the
  stream, the freshest observed age, the effective window, and the number of
  heartbeat files present but unreadable. A read-only refusal is only auditable
  if the evidence is reported.
- Unreadable-heartbeat policy (deliberate, to be documented): an *unreadable*
  heartbeat file is not "a heartbeat newer than the window", so it does not block
  by itself; it must be counted and disclosed in the summary. This matches the
  documented doctrine that heartbeats are advisory local monitoring state
  (unlike custody records). Do not silently ignore them: the count must appear in
  the output. (`DEFAULT_ACTIVE_WINDOW_MS` is the configured staleness window;
  `--active-window-ms` overrides it.)
- Effects: `state` → `PLANNED`; `running` → `[]`; `awaited` → `[]` unless
  `--awaited` is given; `nextAction` → `--next-action`. `blocker` is **not**
  touched by this transition (a `PLANNED` stream may legitimately carry an
  `APPROVAL` blocker; erasing it here would silently delete a HIGH gate).
  No receipt minted; every other field unchanged.

### 3.4 Verifier rule: `RUNNING_WITHOUT_LIVE_EVIDENCE` (prevention)

Add a new typed verifier **error** (not a warning) in `lib/verify.mjs`:

- Fires when `stream.state === "RUNNING"` and neither of these holds:
  - an `ACTIVE` lease exists with `streamId === stream.id`; or
  - a heartbeat record with `stream === stream.id` exists whose
    `ageMs(record, now) <= activeWindowMs`.
- The code is `RUNNING_WITHOUT_LIVE_EVIDENCE`; it must be included in the sorted
  error list, make `ok === false`, and make `verify-cycle.mjs` exit `1`.
- The rule must be reachable from the verifier's committed coverage map
  (`__tests__/coverage.test.mjs` reaches every deterministic rule code) with both
  a negative case and the two positive controls (ACTIVE lease; fresh heartbeat).

Consequence you must also handle: a `RUNNING` stream can no longer be created
without evidence, so extend `create-stream` with optional atomic lease creation:

- `--lease-id <id>` (optional). When supplied, `--lease-role
  <planner|executor|qa|auditor>` becomes required and exactly one `ACTIVE` lease
  bound to the created stream is appended in the same atomic transition
  (`state: "ACTIVE"`, `revision: 1`, `updatedAt` = transition time,
  `expiresAt: null` unless a `--lease-expires` is supplied,
  `worktree` defaulting to the created stream's `git.worktree`,
  `sessionId` from `--lease-session` or `null`).
- `--lease-id` without `--lease-role` fails closed. Supplying lease flags when the
  created stream's state is `PLANNED` fails closed (the verifier would reject
  `PLANNED_WITH_LIVE_LEASE` anyway; fail early with a typed code).
- A `RUNNING` spec with no lease flags must fail closed with
  `RUNNING_WITHOUT_LIVE_EVIDENCE` surfaced through `TRANSITION_RESULT_INVALID`.
- Update `__tests__/lifecycle-traversal.test.mjs` accordingly: the `NEW-1` record
  is currently created as `RUNNING` with no lease and will now fail.

### 3.5 The sanctioned repair-read (load-bearing — read this section twice)

The new rule in §3.4 makes the **current live document** fail verification,
because `TERM-CACHE-CATCHUP-APPLY-REFRESH-C01` is `RUNNING` with no `ACTIVE`
lease and no heartbeat. `runTransition` refuses to read a current document that
is not verifier-clean, so without a deliberate allowance **every** transition —
including `abandon-stream` — would be permanently refused and the document could
never be repaired. That deadlock must not be solved by weakening the candidate
gate, by hand-editing JSON, or by creating a fake `ACTIVE` lease.

Implement this narrow, declared allowance instead:

- Add one per-transition declaration in the `TRANSITIONS` spec table, e.g.
  `toleratesCurrentLivenessDefect: true`, set **only** on `abandon-stream`. It is
  a named spec field, not a global relaxation and not a CLI flag a caller can
  toggle.
- When the declaration is present, the **current** document is read with the
  single code `RUNNING_WITHOUT_LIVE_EVIDENCE` tolerated. Any other current
  document error still fails with `TRANSITION_STATE_INVALID` and zero mutation.
- The **candidate** document is verified with the same tolerance, but only when
  the candidate's set of offending stream ids is a **strict subset** of the
  current document's offending set. If the sets are equal, or the candidate adds
  a new offending stream, the transition fails closed (`TRANSITION_RESULT_INVALID`
  or a dedicated typed code — your choice, but it must be typed and it must
  appear in both the packet tally and the README). This guarantees monotone
  progress: every accepted repair strictly reduces the defect set, so a document
  with any number of orphaned `RUNNING` declarations is recoverable, and no
  transition can ever introduce one.
- With that rule in place, the single-defect live document repairs in one step:
  current set `{TERM-CACHE-CATCHUP-APPLY-REFRESH-C01}` → candidate set `{}`.
- Every other transition keeps the current strict behaviour (tolerates nothing).
- Document the allowance in the README with the safety argument: the candidate
  gate is never relaxed into accepting a *new* or *equal* defect, and the
  tolerance is declared per transition rather than granted to callers.

### 3.6 Determinism plumbing

The new rule reads a clock and a local heartbeat store, so the tools that could
silently become non-deterministic must be made explicit:

- Fix the latent plumbing gap: `runTransition`'s flag-applicability check rejects
  `--now` because `now` is absent from the ignored base-flag list, so
  `transition.mjs --now <iso>` currently fails with
  `TRANSITION_FLAG_NOT_APPLICABLE` even though the CLI and README document it.
  Add `now` and the new `active-window-ms` to the transition CLI's base flags and
  to the engine's ignored set so both the engine and **both** verifications
  receive them, and prove it with a test.
- `verify-cycle.mjs` and `render-register.mjs` gain `--now <iso>`,
  `--active-window-ms <n>`, and `--common-dir <path>` (heartbeat-store root
  override), matching `status.mjs` conventions. A malformed `--now` or
  `--active-window-ms` is a usage error (exit `2`), never a silent fallback.
- Heartbeat store resolution for the verifier: `gitCommonDir(repoRoot)` +
  the observability session-store path, overridable by `--common-dir`. When no
  Git repository is resolvable, or the store does not exist, the store is empty
  (no fresh heartbeat) — that is the fail-closed direction for the `RUNNING`
  rule and must be tested.
- Update the README's determinism statement truthfully: the verifier and renderer
  are pure functions of (state bytes, Git facts, artifact bytes, the heartbeat
  store, `now`, the active window). Document that while a document declares a
  `RUNNING` stream, `workflow:render:check` is clock- and store-sensitive; with
  zero `RUNNING` declarations the store and clock are not consulted at all.
  Prove the second half with a test: the same document verified and rendered
  under two different `--now` values with an empty store produces byte-identical
  output.

### 3.7 Schema addition: the optional `resolution` property

Add `resolution` to `$defs.stream` in `schema/cycle-state.schema.json`:

- Declared in `properties` (so `additionalProperties: false` still rejects
  unknown keys) but **not** added to `required`.
- A new `$defs.resolution` object with `additionalProperties: false` and
  `required: ["disposition", "resolver", "text", "resolvedAt", "supersededBy"]`:
  `disposition` enum `["SUPERSEDED", "CLOSED"]`; `resolver` `type: "string"`,
  `minLength: 3`; `text` `type: "string"`, `minLength: 1`; `resolvedAt`
  `$ref: "#/$defs/isoRequired"`; `supersededBy` `type: ["string", "null"]`.
- The property is `type: ["object", "null"]`.
- Use only schema keywords the engine already supports (`type`, `enum`,
  `required`, `additionalProperties`, `properties`, `$ref`, `minLength`);
  `findUnsupportedKeywords` must stay empty.

Deliberate design decision you must not change: the property is optional rather
than required. Making it required would force a `contractVersion` bump and a
mechanical rewrite of every historical stream record, all 27 fixtures, and all 16
`specs/register/*.json` create-stream specs — a large unrelated blast radius with
no added truth, because the property is only meaningful on a resolved decision
record. `contractVersion` stays `1.2.0`, `lib/migrate.mjs` needs no new step, and
no historical byte changes.

Add two semantic verifier rules for `resolution` (both typed errors):

- `RESOLUTION_INCONSISTENT` when `resolution` is present and
  `resolution.disposition !== stream.state` (which also covers "present on an
  unresolved state"), or when `supersededBy` is null while `disposition` is
  `SUPERSEDED`.
- `RESOLUTION_SUPERSEDED_BY_UNKNOWN` when `resolution.supersededBy` is non-null
  and does not name a defined stream.

### 3.8 Renderer

Surface the resolution deterministically in the generated register (a
`## Resolutions` section, or an extension of an existing table — your choice):
disposition, resolver, superseded-by, resolved-at, and resolution text, sorted by
stream id with the file's existing escaping helpers. `--check` must remain
byte-exact and `renderRegister` must stay a pure function of its inputs.

## 4. Satisfiability constraints you must preserve

These are the facts that make the required acceptance proofs possible. Do not
design against them:

- The live document has exactly **one** `RUNNING` stream
  (`TERM-CACHE-CATCHUP-APPLY-REFRESH-C01`). Its owned worktree
  `E:/ATLAS-worktrees/integration-wf-seed-term-cache-tl-c06-20260916` currently
  exists and is clean, so the verifier's `PLANNED_WITH_DIRTY_WORKTREE` rule
  permits the `abandon-stream` outcome. Re-check that precondition immediately
  before running repair step 1 in §4; if that worktree has become dirty, the
  finding belongs to the planner, not to a weakened transition.
- `TERM-CACHE-CATCHUP-APPLY-REFRESH-C01` has no entry in `leases[]` at all and no
  heartbeat names it, so both `abandon-stream` preconditions are satisfiable.
- After the repair sequence the live document declares **no** `RUNNING` stream,
  so `workflow:verify` exit `0` and `workflow:render:check` exit `0` are
  achievable on the real document.
- A `RUNNING` claim and its evidence must be created atomically (§3.4), and the
  reverse ordering is equally load-bearing: a lease may only be returned
  (`lease-update --lease-state RETURNED`) **after** the stream has left `RUNNING`,
  otherwise the document would declare `RUNNING` without an `ACTIVE` lease.
  State this ordering in the README; it is a new invariant created by §3.4.
- `resolution === null` is treated as **absent**: no `resolution` rule fires.
  State this explicitly in the README and in the verifier. It keeps the property
  usable as `type: ["object", "null"]` on every historical or not-yet-resolved
  record, and it keeps the `seed.test.mjs` §E probe valid when it templates its
  spec from whichever committed record currently has a null `candidateSha`
  (`seed.test.mjs` does not overwrite `resolution` on the probe spec, so the
  probe spec must remain schema-valid whether or not the template carries the
  key; adding `resolution: null` to the probe spec is an acceptable, expected
  test update).
- The register repair sequence is **ordered and revision-exact**. Your base
  register is at `registry.revision` 218 (the planner's registration commit:
  `create-stream` → `lease-update` → `coordination-update`, from 215). Perform
  exactly these seven transitions from that revision, in this order, each with
  its literal `--expect-revision`:

  | # | Transition | Stream | Revision | Target outcome |
  | --- | --- | --- | --- | --- |
  | 1 | `abandon-stream` | `TERM-CACHE-CATCHUP-APPLY-REFRESH-C01` | 218 → 219 | `PLANNED`, `running: []`, `awaited: []`, orphaned nextAction |
  | 2 | `reconcile-stream` | `TERM-CACHE-CATCHUP-APPLY-REFRESH-C01` | 219 → 220 | stale `blocker.safeWorkItems` cleared with `safeWorkRemaining: false` |
  | 3 | `resolve-decision` | `TT-WARNING-COUNT-C07A` | 220 → 221 | `SUPERSEDED` with `resolution`, `--superseded-by TT-WARNING-COUNT-C07A-R1`, `awaited: []` |
  | 4 | `reconcile-stream` | `TT-WARNING-COUNT-C07A` | 221 → 222 | `blocker.safeWorkRemaining: false`, `safeWorkItems: []` |
  | 5 | `reconcile-stream` | `TL-DIAGNOSTICS-LOADING-C06` | 222 → 223 | `blocker.safeWorkRemaining: false`, `safeWorkItems: []` |
  | 6 | `reconcile-stream` | `WF-C02` | 223 → 224 | stale forward-looking `nextAction` replaced |
  | 7 | `reconcile-stream` | `WF-SEED-PIN-C01` | 224 → 225 | stale forward-looking `nextAction` replaced |

  Step 1 must come first because `abandon-stream` is the only transition that may
  read a document carrying the liveness defect. Record all seven transition
  reports verbatim in your handoff. If any `--expect-revision` disagrees, stop and
  report the actual revision rather than guessing — a concurrent planner write is
  a coordination event, not a retry.

## 5. Acceptance matrix (20 mandatory source rows)

Every row is a real production-path check. Mark each `PASS`, `BLOCKED`, or
`DEFERRED` in your handoff and include the failing-first/negative control named in
the row. A row without production-path evidence is not `PASS`.

| # | Requirement | Production path | Negative / failing-first control |
| --- | --- | --- | --- |
| 1 | `abandon-stream` repairs a `RUNNING` stream with zero lease and no heartbeat into a clean `PLANNED` record (`running: []`, `awaited: []`, `nextAction` set, candidate verifier-clean, rendered bytes verified) | `runTransition` + `renderRegister` over a document shaped exactly like `TERM-CACHE-CATCHUP-APPLY-REFRESH-C01` | With the repair-read declaration removed, the identical call must fail `TRANSITION_STATE_INVALID` with zero mutation |
| 2 | `abandon-stream` fails closed on an `ACTIVE` lease | same | `TRANSITION_ABANDON_ACTIVE_LEASE`; state, render and receipts byte-identical |
| 3 | `abandon-stream` fails closed on a fresh heartbeat naming the stream | same, with a synthetic heartbeat store | `TRANSITION_ABANDON_FRESH_HEARTBEAT`; zero mutation |
| 4 | `abandon-stream` succeeds on a stale heartbeat beyond the window (positive control for #3) | same, heartbeat aged `window + 1ms` | succeeds; and the same store with `--active-window-ms` widened must flip it back to a failure |
| 5 | `abandon-stream` rejects an unknown stream | `runTransition` | `TRANSITION_STREAM_UNKNOWN`; zero mutation |
| 6 | `abandon-stream` rejects an invalid from-state (`COMPLETE`) | `runTransition` | `TRANSITION_INVALID_STATE`; zero mutation |
| 7 | `abandon-stream` rejects a stale revision | `runTransition` CAS | `TRANSITION_STALE_REVISION`; zero mutation |
| 8 | `resolve-decision` resolves `DECISION_REQUIRED` to `SUPERSEDED` with a recorded `resolution` and cleared `awaited` (the live `TT-WARNING-COUNT-C07A` shape) | `runTransition` over that exact record shape, `--superseded-by` the live replacement id | `resolution.supersededBy` recorded; `state` superseded; candidate verifier-clean; rendered bytes verified |
| 9 | `resolve-decision` rejects unknown stream, invalid from-state (`RUNNING`), and stale revision | `runTransition` | three typed failures; zero mutation each |
| 10 | `resolve-decision` requires `--superseded-by` for `SUPERSEDED` | `runTransition` | `TRANSITION_SUPERSEDED_BY_REQUIRED`; zero mutation |
| 11 | `resolve-decision` rejects an unknown, self, or dead replacement | `runTransition` | `TRANSITION_SUPERSEDED_BY_UNKNOWN` / `_SELF` / `_DEAD`; zero mutation each |
| 12 | `resolve-decision` rejects `--superseded-by` with `CLOSED` | `runTransition` | `TRANSITION_SUPERSEDED_BY_NOT_APPLICABLE`; zero mutation |
| 13 | `resolve-decision --disposition CLOSED` records `supersededBy: null` | `runTransition` | positive; candidate verifier-clean |
| 14 | `reconcile-stream` sets `blocker.safeWorkRemaining false` with `safeWorkItems []` on the live `TL-DIAGNOSTICS-LOADING-C06` shape and leaves `state`, `git`, `gates`, `review`, `closure` byte-identical | `runTransition` | candidate verifier-clean; a byte-diff of every untouched field is empty |
| 15 | `reconcile-stream` reconciles a stale forward-looking `nextAction` on the live `WF-C02` (COMPLETE) and `WF-SEED-PIN-C01` (INTEGRATED) shapes | `runTransition` | positive; all other fields byte-identical; the transition must not change `state` |
| 16 | `reconcile-stream` refuses `RUNNING` | `runTransition` | `TRANSITION_RECONCILE_RUNNING_FORBIDDEN`; zero mutation |
| 17 | `reconcile-stream` refuses an inconsistent blocker combination and a non-strict `--blocker-safe-work-remaining` value | `runTransition` | `TRANSITION_BLOCKER_INCONSISTENT` and `TRANSITION_BLOCKER_FLAG_INVALID`; zero mutation each |
| 18 | `reconcile-stream` refuses a no-op invocation, plus unknown stream / invalid from-state / stale revision | `runTransition` | `TRANSITION_RECONCILE_NO_CHANGES` and the three shared codes; zero mutation each |
| 19 | Verifier emits `RUNNING_WITHOUT_LIVE_EVIDENCE` for an unjustified `RUNNING` declaration and stays silent with an `ACTIVE` lease or a fresh heartbeat | `verify-cycle.mjs` exit code and `lib/verify.mjs` | reachable from `coverage.test.mjs`; stale-heartbeat and empty-store cases both fire; lease/fresh-heartbeat cases do not |
| 20 | Repair-read narrowing and monotonicity hold | `runTransition` | an unrelated current defect (e.g. `GATES_ARITHMETIC`) still fails `TRANSITION_STATE_INVALID` for `abandon-stream`; with two defective streams the first abandon succeeds and drops the set to one; abandoning a non-defective stream fails closed; a candidate that would add a defect fails closed — all with zero mutation |

Additional mandatory but unrowed controls that must also be evidenced in the
handoff (add them to the tally if your QA organiser counts them separately —
`gates-plan` is increase-only, so raise `MANDATORY_SOURCE` rather than dropping a
row):

- Atomicity: `ATLAS_WORKFLOW_FAULT=AFTER_LOCK|STAGE_STATE|STAGE_RENDER|VERIFY_RENDERED`
  for each new transition leaves the state document, the rendered register, and
  every receipt byte-identical; a successful transition increments
  `registry.revision` exactly once and publishes state and render together.
- Coverage: `listTransitions()` is a subset of the lifecycle-traversal coverage
  map, and the traversal actually drives all three new transitions to a
  verifier-clean document (`reconcile-stream` on a `COMPLETE` record,
  `resolve-decision` on a `DECISION_REQUIRED` record, `abandon-stream` on a
  `RUNNING` record with its lease returned first).
- `create-stream` atomic lease: a `RUNNING` spec plus lease flags appends exactly
  one bound `ACTIVE` lease; lease flags without `--lease-role` fail closed; a
  `RUNNING` spec without lease flags fails closed with the new code.
- Full suite: `npm run workflow:test` green with no skipped, filtered-out, or
  removed assertions; any test that must change is updated in place and the
  count is preserved or increased.
- No historical churn: `contractVersion` stays `1.2.0`; no fixture, no
  `specs/register/*.json` spec, and no receipt byte changes; `git status --short`
  empty at handoff.
- `--now` plumbing: `transition.mjs --now` reaches the engine and both
  verifications and demonstrably changes the `RUNNING`-rule outcome; malformed
  `--now` / `--active-window-ms` are usage errors.
- README: all three transitions, the new verifier rule and its two `resolution`
  companions, the declared repair-read with its safety argument, the ordering
  invariants (repair first; lease returned only after leaving `RUNNING`), the new
  clock/window/store options and the updated determinism statement, and the
  optional-`resolution` rationale.

## 6. Evidence, ordering, and cleanup

- Run your decisive tests from the **committed** candidate. A passing command run
  from uncommitted bytes is evidence for those bytes, not for the named commit.
- Perform the seven register transitions from §4 against the **real**
  `docs/plans/atlas-delivery-cycles.json` in this worktree, with the engine's
  default render path, so the committed state document and the committed
  generated projection are published together by the transition engine and are
  part of your candidate. A dry run is encouraged but must be done first, on a
  scratch copy of the register (`docs/.wf-c09-dryrun/state.json`) with an
  absolute `--render` inside that scratch directory, and the scratch directory
  must be deleted before handoff. Never use a scratch copy as a substitute for
  the real repair, and never hand-edit either file.
- Order the repair exactly as the invariant requires: `abandon-stream` on the
  orphaned `RUNNING` record first (it is the only transition that may read a
  document carrying the defect), then `resolve-decision`, then the
  `reconcile-stream` residue passes.
- Leave no residue: no scratch file, temp repository, synthetic heartbeat store,
  fixture, or log outside the committed test tree. Any temp Git repository must
  live under `os.tmpdir()`.
- If a mandatory row cannot be performed, say so explicitly and mark it
  `BLOCKED`; never relabel a blocked mandatory row as non-blocking, and never
  substitute a helper-only or source-text assertion for a production-path check.

## 7. Commit workflow and return contract

1. Confirm the worktree is clean and record `git rev-parse HEAD` as your base
   before editing.
2. Implement, test, and keep one concise progress/notes file only if it is
   durable and useful.
3. Stage only `ops/workflow/**`, `docs/plans/atlas-delivery-cycles.json`, and
   `docs/plans/atlas-active-delivery-streams.generated.md`. Verify the staged path
   list and `git diff --cached --check`, then create a conventional commit, e.g.
   `feat(workflow): add abandon/resolve/reconcile transitions and the RUNNING evidence gate`.
4. Return `REVIEW_REQUIRED` with: base SHA, candidate SHA, exact changed paths,
   the filled 20-row acceptance table with its extra controls, every decisive
   command with its result, the seven committed register transition reports plus
   the rendered-register byte proof, a statement that the register changed only
   through the transitions at revisions 218–225, known risks classified
   `BLOCKING`/`NON_BLOCKING`, worktree disposition
   (`RETIRE_AFTER_INTEGRATION`), and the explicit statement that no receipt was
   minted, deleted, or edited.
5. Do not self-approve, merge, or push. The primary planner validates the
   immutable range including the register delta and the revision arithmetic,
   dispatches fresh independent QA, integrates the accepted candidate, and pushes
   it. Any subsequent real register write remains a separately CAS-serialized
   planner transition.

## 8. Session routing

- `EXECUTOR_SESSION_ROUTE: FRESH_REQUIRED` — this bounded workflow-authority
  implementation runs in a fresh executor context in the named worktree.
- `QA_SESSION_ROUTE: FRESH_REQUIRED` — the frozen candidate requires a fresh
  independent QA context.
- `PLANNER_SESSION_ROUTE: EXISTING` — the primary planner owns this cycle,
  validates and accepts the register delta and its revision arithmetic,
  integrates, and pushes.
- `AUDITOR_SESSION_ROUTE: FRESH_REQUIRED` — a fresh Wave Completion Auditor is
  required because this changes the delivery-cycle state authority.
