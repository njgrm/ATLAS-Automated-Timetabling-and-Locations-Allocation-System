# WF-SEED-INVENTORY-C02 — executor packet

- Stream: `WF-SEED-INVENTORY-C02`
- Role: `EXECUTOR` (`atlas-executor-delegate`); recommended reasoning variant `high`
  (the change is a test-contract redesign whose strength must not be weakened).
- Cycle: operator-activated (`CYCLE ON`) 2026-09-16, objective
  "one structural workflow correction, executor, fresh QA, integration and Wave
  Completion Audit".
- Worktree: `E:/ATLAS-worktrees/wf-seed-inventory-c02` (disposition
  `RETIRE_AFTER_INTEGRATION`)
- Branch: `work/wf-seed-inventory-c02`
- Accepted base: the cycle registration commit that contains this packet
  (the planner records it with `record-executor-return --base`). Observed
  `origin/main` at packet authoring: `14e6e91979448d405e33d2221a4c00d1c538adf9`
  (registry revision 137, 21 registered streams).
- Risk tier: `MEDIUM` source/test. No runtime, database, deployment, generation,
  publication, login, or migration action is part of this packet.
- Commands: Node built-ins only. No dependency install, no network, no build.

## 1. Problem

`ops/workflow/__tests__/seed.test.mjs` pins the **complete evolving production
stream inventory** as an equality check:

```js
const SEED_STREAM_IDS = [ ...17 literal ids... ];
```

`ops/workflow/transition.mjs --transition create-stream` appends a record to
`docs/plans/atlas-delivery-cycles.json` with no knowledge of this file, so every
create-stream operation makes `npm run workflow:test` red until unrelated test
source is edited by hand. Current `origin/main` carries four extra registered
streams (`AUTHZ-CLASS-TEMPLATE-C07`, `AUTHZ-CLASS-TEMPLATE-C07R1`,
`EXPORT-PRESENTATION-SCHEMA-GUARD-C06B`, `GENERATION-AUTHORITY-REALISM-C07`) and
main is therefore red.

Measured at the base commit (planner evidence, `14e6e919` / revision 137 / 21
streams): `node --test "ops/workflow/__tests__/*.test.mjs"` → exit 1,
`tests 281 / pass 278 / fail 3`, and all three failures are the inventory pin in
`seed.test.mjs`:

1. `seed.test.mjs:50` "the committed seed state verifies cleanly with exit code 0"
   → `21 !== 17` (the fixed count pin).
2. `seed.test.mjs:~133` "the seed declares the exact expected stream inventory …"
   → inventory drift, `extra: [the four streams]`.
3. `seed.test.mjs:~240` "the seed stream-inventory pin detects a stale registry"
   → "the committed registry must satisfy the pin first".

## 2. Objective

Make the workflow test contract validate **every current and future** registry
stream generically — no source edit after `create-stream` — while **retaining
and strengthening** fail-closed coverage for malformed, missing, or lost stream
state. Appending the four ids plus `WF-SEED-INVENTORY-C02` is explicitly
forbidden: it fails again on the next stream.

## 3. Required design

The production verifier (`ops/workflow/lib/verify.mjs`, driven by
`verify-cycle.mjs`) is already generic over `streams[]`. The defect is only the
**test-level** exact-equality pin. Therefore: keep the production engine as the
single source of truth, drive it generically over every registered stream with
mutation controls, and delete the exact-equality pin.

Nothing in `ops/workflow/lib/**`, `ops/workflow/schema/**`, or
`ops/workflow/*.mjs` may change. The correction is confined to the seed test.

### §A Retire the exact-equality pin

Delete `SEED_STREAM_IDS` as an equality assertion and `seedInventoryMismatch` as
a *contract* predicate. Keep the retired rule only as an inert, frozen historical
constant that powers the failing-first control:

```js
// The complete inventory pinned at the retirement commit (17 ids, origin/main
// 80994f06). This list is history: it is never updated and never asserted as an
// equality against the live registry.
const RETIRED_PINNED_INVENTORY = Object.freeze([ ...the 17 ids, verbatim... ]);

// The retired rule, expressed as a predicate. It must reject the current
// registry (that is the defect being fixed) and it must keep rejecting the
// registry after a stream is added through the real create-stream operation.
function retiredExactInventoryMismatch(doc) { /* ordered set comparison */ }
```

### §B Immutable core baseline

Add a small, genuinely immutable baseline whose loss is registry corruption
rather than legitimate churn: the **five streams present in the register's first
committed revision** (seed commit `1790cbc0`, 2026-09-14:

```js
const CORE_STREAM_IDS = Object.freeze([
  "ENROLLPRO-PROXY-RECOVERY-LIVE",
  "LIVE-GENERATION",
  "LIVE-PUBLICATION",
  "TT-SOURCE-FRESHNESS-C04",
  "WF-C01",
]);
```

Assert **subset** membership (every core id present), never equality, plus a
negative control proving the predicate detects removal. Registry records are
retained forever (a superseded stream keeps its row), so this baseline is
stable; it must not be extended with ordinary stream ids.

### §C No literal enumeration of the live inventory

Add a mechanical guard test: for every stream in the committed registry that is
neither in `CORE_STREAM_IDS` nor in `RETIRED_PINNED_INVENTORY`, its **quoted**
id literal must not appear in `seed.test.mjs` source. Use quoted-form matching
(`source.includes('"' + id + '"')`) so ordinary prose/comment references to a
cycle id are not false positives, while a re-introduced literal id list is
caught. This is the structural statement of "no source edit after create-stream".

### §D Generic per-stream invariants via production-verifier mutation

One test that, for **every stream in the committed registry** and for each
invariant family below, mutates the *committed bytes* in memory and proves the
production verifier rejects it **at that stream's own path**:

- Call `verifyStateDocument(STATE, { stateBytes, gitMemo })` with one shared
  `createGitMemo()` across the whole matrix. `stateBytes` is the in-memory
  override the atomic transition engine itself uses to validate candidate bytes
  before any replace; it is the supported way to verify arbitrary bytes against
  the real repository without writing anything.
- Apply each family to **all applicable streams at once** (one verifier call per
  family, ~17 calls total) and then assert, per stream, that the expected
  `(code, path)` pair is present.
- Also run the **pristine** registry once and assert `errors === []`.
- Assert every family's applicable set is non-empty (a vacuity guard: a family
  that silently stops applying must fail, not pass).

Families (validated by the planner against `14e6e919` / 21 streams; adapt only
if the base registry has drifted, and report any drift):

| family | mutation applied to every applicable stream | expected code | expected path prefix |
| --- | --- | --- | --- |
| duplicate stream id | append a clone of every stream | `DUPLICATE_STREAM_ID` | `streams[n + i].id` (n = original count) |
| malformed candidate SHA | `git.candidateSha = "not-a-sha"` | `SCHEMA_PATTERN` | `$.streams[i].git.candidateSha` |
| missing remote observation key | `delete git.remoteObservation` | `SCHEMA_REQUIRED` | `$.streams[i].git` |
| missing required lifecycle field | `delete owners` | `SCHEMA_REQUIRED` | `$.streams[i]` |
| invalid state value | `state = "NOT_A_STATE"` | `SCHEMA_ENUM` | `$.streams[i].state` |
| gate arithmetic drift | `gates.passed += 1` | `GATES_ARITHMETIC` | `streams[i].gates` |
| COMPLETE without ACCEPT_READY QA | `state="COMPLETE"; review.qaVerdict=null` | `COMPLETE_MISSING_QA` | `streams[i].review.qaVerdict` |
| COMPLETE without audit verdict | `state="COMPLETE"; review.auditRequired=true; review.auditorVerdict=null` | `COMPLETE_MISSING_AUDIT` | `streams[i].review` |
| COMPLETE without closure receipt | `state="COMPLETE"; closure=null` | `COMPLETE_MISSING_RECEIPT` | `streams[i].closure.receipt` |
| terminal stream with a live lease | `leases=[]`, every stream `COMPLETE`, one ACTIVE lease per stream | `COMPLETE_WITH_LIVE_LEASE` | `leases[i].state` |
| PLANNED stream with a live lease | every stream `PLANNED`/`running=[]` + one ACTIVE lease each | `PLANNED_WITH_LIVE_LEASE` | `streams[i].state` |
| unknown candidate commit | only streams with `candidateSha !== null`: `candidateSha = "0"*40` | `GIT_SHA_UNKNOWN` | `streams[i].git` |
| tampered closure receipt | only streams with `closure.receipt`: `receipt.sha256 = "0"*64` | `RECEIPT_INVALID` | `streams[i].closure.receipt` |
| unknown remote observation | only streams with `remoteObservation !== null`: `sha = "0"*40` | `REMOTE_OBSERVATION_INVALID` | `streams[i].git.remoteObservation.sha` |
| missing required observation | every stream: `approval.presentedReady=true`, `requiredObservationIds=["obs-probe"]`, `observations=[]` | `HIGH_DEPENDENCY_MISSING` | `streams[i].approval.requiredObservationIds` |
| unhealthy required observation | as above with `observations=[{status:"FAIL", expiresAt: far future}]` | `HIGH_DEPENDENCY_UNHEALTHY` | `streams[i].observations` |
| expired required observation | as above with `observations=[{status:"PASS", expiresAt: past}]` | `HIGH_DEPENDENCY_EXPIRED` | `streams[i].observations` |

Constraints on the mutants: each mutated document must stay **schema-valid**
apart from the family under test, because a structural schema violation makes
the verifier return early with only schema errors. The lease and observation
records must therefore be schema-complete (`lease`: `id`, `streamId`, `worktree`,
`role`, `sessionId`, `state`, `revision`, `updatedAt`, `expiresAt`;
`observation`: `id`, `target`, `checkedAt`, `status`, `expiresAt`, `detail`).

### §E Failing-first regression: real `create-stream` on a clone

One test that proves a well-formed new stream added through the **real**
registration operation needs no source edit:

1. Read the committed registry bytes; copy them to a temp fixture
   `docs/.wf-seed-inventory-<random>/state.json` **inside the repo worktree**.
   That path is Git-ignored (`docs/*` with exceptions; verify with
   `git check-ignore -v`) and must be removed in `t.after` so the worktree stays
   clean. The state must live inside the repo so `resolveRepoRoot` resolves the
   real repository and the referenced commits/artifacts resolve.
2. Build a **well-formed** spec by cloning the first stream record in document
   order whose `git.candidateSha === null` (a pre-candidate record, so the shape
   is the registry's own), then override `id` (unique, derived from the current
   registry revision — never a fixed literal), `riskTier`, `state = "PLANNED"`,
   `stateUpdatedAt`, `nextAction`, `awaited = []`, `running = []`, `git`
   (`worktree: null`, `branch`, `baseSha` = the observed `origin/main` tip read
   with `git rev-parse origin/main`, `candidateSha: null`,
   `integrationSha: null`, `changedPaths: []`, `remoteObservation: null`),
   `owners` all `NONE`, zeroed `gates`/`review`/`corrections`/`successors`/
   `requires`/`observations`/`artifacts`, `blocker.kind = "NONE"`, cleared
   `approval`, `closure: null`.
3. Run the **real operation** in-process:
   `runTransition({ statePath: <clone>, transitionName: "create-stream", flags: {
   "stream-spec": <temp spec>, "observed-origin-main": <origin/main tip>,
   "expect-revision": <clone registry revision>, render: <temp render path> },
   now: <pinned>, gitMemo })`.
   - `--render` **must** be an absolute path inside the temp fixture. Without it
     the transition would republish
     `docs/plans/atlas-active-delivery-streams.generated.md` and rewrite the
     committed generated register.
   - The real operation takes the repository-wide workflow lock. Retry **only**
     on the typed transient `LOCK_CONTENTION` (bounded, ≤ 5 attempts, ~250 ms
     apart) because concurrent planners transiently hold it; every other failure
     must fail immediately. Document this in a comment.
4. Assert on the enlarged clone: the operation succeeded; exactly one record was
   appended; the revision incremented once; the pre-existing stream records are
   byte-identical; `verifyStateDocument(<clone>)` returns `ok` with `errors: []`;
   `node render-register.mjs --state <clone> --output <temp>` exits 0 and its
   output contains the created id and equals the in-process renderer output.
5. Assert the **committed** generated register file is byte-unchanged
   (the regression must never rewrite it).
6. Assert the failing-first structure: the retired exact-inventory predicate
   rejects both the current registry and the enlarged one (that is why the old
   design was red), while every new-contract assertion above is green with the
   same, unedited test source.

### §F Negative mutants for the newly created stream

Using the enlarged document from §E, prove the generic contract also covers a
stream that did not exist when the test source was written:

- malformed newly created stream (`created.git.candidateSha = "not-a-sha"`) →
  `SCHEMA_PATTERN`;
- duplicate created id (append a second copy of the created record) →
  `DUPLICATE_STREAM_ID`;
- created record missing a required lifecycle field (e.g. `delete owners`, and a
  second case `delete nextAction`) → `SCHEMA_REQUIRED`.

### §G Preserved coverage and derivation

Keep, in corrected form, the requirements previously covered:

- the committed registry verifies with exit 0 and `summary.streams.total` equals
  `doc.streams.length` (derived — **no fixed count pin**);
- the committed generated register matches the renderer byte-for-byte, ends with
  LF, and carries the do-not-edit notice;
- the generated register is a distinct file from the historical prose register
  (`docs/plans/atlas-active-delivery-streams.md`, which must not be edited);
- SHA shape predicate negative controls (39-hex, uppercase, prefixed,
  whitespace-padded, empty, non-string) are retained;
- `version`/`contractVersion` is asserted **against the shipped schema constant**
  (`ops/workflow/schema/cycle-state.schema.json` `properties.contractVersion.const`)
  rather than a literal, plus `registry.revision` a positive integer and
  `leases` an array;
- a generated-register **divergence control**: mutating one stream's
  `nextAction` in memory must make the renderer output differ from the committed
  generated bytes (the parity test above is not vacuous).

Test preservation rule: no test and no assertion may be silently removed. The
retired exact-equality assertions are replaced by the stronger §A–§F controls;
the handoff must contain an explicit mapping of every removed/renamed assertion
to its replacement so QA can verify that coverage strictly increased.

## 4. Acceptance matrix (18 mandatory source gates)

Record each row `PASS` / `BLOCKED` / `DEFERRED` with the exact command and result
in the handoff. `MANDATORY_LIVE = 0`; `DEFERRED_EXTERNAL = 0`.

| # | Gate | Decisive evidence |
| --- | --- | --- |
| G1 | Failing-first baseline captured **before any edit** at the accepted base | suite exits 1, `fail 3`, all three names/assertions belong to the inventory pin |
| G2 | Post-correction suite green, no test removed | `npm run workflow:test` exits 0; total test count ≥ 281; explicit assertion mapping |
| G3 | Exact-equality pin retired; no quoted literal of any non-core, non-retired registered stream id in the source | §A + §C guard test green |
| G4 | Core baseline subset enforced with a removal negative control | §B positive + mutant |
| G5 | Duplicate stream id detected | §D row 1 (every stream) |
| G6 | Malformed candidate SHA rejected for every stream | §D row 2 |
| G7 | Missing `git.remoteObservation` rejected for every stream | §D row 3 |
| G8 | Missing required lifecycle field rejected for every stream | §D row 4 + §F third mutant |
| G9 | Invalid state value and gate arithmetic rejected for every stream | §D rows 5–6 |
| G10 | Invalid state/audit/receipt combinations rejected for every stream | §D rows 7–9 |
| G11 | Stale/active lease rejected for every stream | §D rows 10–11 |
| G12 | Git identity semantics rejected for every applicable stream | §D rows 12–13 |
| G13 | Remote observation + HIGH dependency observation states rejected | §D rows 14–17 |
| G14 | Generated-register parity, LF/notice checks, and divergence control | §G |
| G15 | Failing-first regression: real `create-stream` on a cloned registry keeps verify/render green with no source edit and never rewrites the committed register | §E |
| G16 | Negative mutants for the newly created stream | §F |
| G17 | Contract-level assertions derive from the shipped schema, not literals | §G |
| G18 | Scope and hygiene: `npm run workflow:verify` exits 0 on the committed registry; `npm run workflow:render:check` exits 0; `git diff --check` clean; candidate range touches only the two owned paths | commands + `git diff --name-only <base>..HEAD` |

Suite budget: the new seed tests add ≈ 6–7 s (planner-measured: mutation matrix
≈ 3.9 s for 18 verifier calls over 21 streams; regression ≈ 2.7 s). Keep the
added wall time under ~10 s and the total `workflow:test` under the documented
45-second budget.

## 5. Owned and forbidden paths

Owned (the only paths the candidate may change):

- `ops/workflow/__tests__/seed.test.mjs` — the correction
- `docs/handoffs/wf-seed-inventory-c02-executor.md` — the compact handoff,
  committed with the candidate

Forbidden:

- `docs/plans/atlas-delivery-cycles.json` and
  `docs/plans/atlas-active-delivery-streams.generated.md` — machine state and its
  generated projection; **planner-only**, never hand-edited
- `docs/plans/atlas-active-delivery-streams.md` — the preserved historical prose
  register
- everything else: `ops/workflow/lib/**`, `ops/workflow/schema/**`,
  `ops/workflow/*.mjs`, every other test file, `ops/runtime/**`, `AGENTS.md`,
  `CHANGELOG.md`, `.gitattributes`, `package.json`, and all
  `atlas-client/**`, `atlas-server/**`, `prisma/**`, `atlas-*/**` product code

Never run: any transition (`create-stream`, `record-*`, `coordination-update`),
any `git push`, any install/build, any database/runtime/browser action, any
network call. Record the observed stream state; do not change it.

## 6. Return contract

Return exactly once with:

- base SHA and candidate SHA (candidate = conventional commit(s) on
  `work/wf-seed-inventory-c02`, additive commits only if a correction follows);
- complete `git status --porcelain=v2` of the worktree (must be empty) and
  `git diff --name-only <base>..<candidate>`;
- the 18-row gate matrix with PASS/BLOCKED/DEFERRED, the exact command per row,
  and the observed result (`tests/pass/fail` counts, exit codes);
- the explicit removed/renamed-assertion → replacement mapping;
- the exact new test names and their measured durations;
- residual risks, each classified `BLOCKING` or `NON_BLOCKING`;
- `REVIEW_REQUIRED` and the handoff path.

`worktree clean` means the complete `git status --short`/`--porcelain=v2` output
is empty. The temp fixtures under `docs/.wf-seed-inventory-*` must be removed by
the test itself; if any remain, report `candidate range clean; worktree dirty`
with the exact paths.
