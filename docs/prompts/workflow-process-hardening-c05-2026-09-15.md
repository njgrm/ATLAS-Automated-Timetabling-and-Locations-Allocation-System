# WF-C05 — Workflow process hardening (governing packet)

- **Cycle / stream id:** `WF-C05`
- **Role:** EXECUTOR (packet owner: primary planner)
- **Risk tier:** MEDIUM — repository-owned workflow tooling (`ops/workflow/**`) plus
  directive text (`AGENTS.md`). No ATLAS product code, no runtime, no database,
  no browser, no login, no migration, no generation, no publication, no companion
  edit.
- **Worktree:** `E:/ATLAS-worktrees/workflow-process-hardening-c05`
- **Branch:** `work/workflow-process-hardening-c05`
- **Registration base (authoring):** `c6d83cb45f11c11ae98d3e3e26787f5341a30945`
- **Accepted base:** the `origin/main` tip current when this packet is dispatched
  (the WF-C05 registration commit, which contains this packet, the register
  spec, the machine-register row, and the seed-inventory pin update). Verify it
  with `git rev-parse origin/main` inside the worktree before editing and record
  it in the handoff. The registration base above is an ancestor of the accepted
  base; do not treat them as the same commit.
- **Worktree disposition:** `RETIRE_AFTER_INTEGRATION` (not retired by the
  executor).
- **Directive:** `AGENTS.md` is the sole normative directive. This packet's W5
  updates it; the handoff must record the new LF-normalized SHA-256.
- **Boundary:** `WF-EVAL-C01` remains a separate successor evaluation dataset.
  Do not edit `docs/plans/wf-eval-c01-mandatory-traps.md`, do not claim
  WF-EVAL-C01 progress, and do not mark it complete through this cycle.

## 0. Objective

Close the workflow gaps found through WF-C04 and the recent TL/export cycles:

1. lifecycle-traversal acceptance for every transition/record class, ending in
   closure and a remote observation;
2. `record-correction` is mandatory whenever a post-QA defect round occurs, and a
   completed cycle that discloses a correction while `corrections[]` is empty
   must fail verification;
3. predeclared gate classes `MANDATORY_SOURCE` / `MANDATORY_LIVE` /
   `DEFERRED_EXTERNAL` that cannot be retroactively removed or reclassified;
4. source-only `ACCEPT_READY` / `AUDIT_CLEAR` can never render or claim deployed
   or live readiness;
5. directive requirements for producer-to-consumer parity and unknown-value
   conservation when a client renders server-owned enums, reasons, states, or
   blocker codes;
6. directive requirement for scope-epoch (or equivalent) stale-response
   protection across every related actor-school/year authority feed;
7. failing fixtures/mutants for the seven named defect classes;
8. `AGENTS.md` updated as the sole normative directive with its new normalized
   hash recorded.

The contract moves from `contractVersion` **1.1.0** to **1.2.0** with a
deterministic migration for the committed state document and every earlier
document shape.

## 1. Required changes

### W1 — Lifecycle-traversal acceptance (item 1)

New `ops/workflow/__tests__/lifecycle-traversal.test.mjs`:

- Enumerate `listTransitions()` from `ops/workflow/lib/transition.mjs`. The test
  must FAIL when any transition is absent from the traversal coverage map — the
  message names the uncovered transition(s). This is the mechanical guard that a
  newly introduced transition or record class cannot ship tested only at
  creation.
- Drive **one stream created through `create-stream`** through the complete
  lifecycle, in a disposable repository/state path, in this order:
  `create-stream` → `record-executor-return` → `record-correction` →
  `record-qa-result` (round 1 `CORRECTION_REQUIRED`) → `record-qa-result`
  (round 2 `ACCEPT_READY`, fresh session) → `coordination-update`
  (`CYCLE_ACTIVE` then `MANUAL` before integration) → `record-integration`
  (with `--observed-remote`) → `record-audit` (`AUDIT_CLEAR`) → `close-cycle`
  (receipt minted and pinned) → `record-remote-observation`.
- Exercise `lease-update` in the same traversal so every named transition and
  every mutable record class (correction round, lease, receipt, observation) is
  carried to a verifier-clean terminal document.
- Assert: the created record reaches `COMPLETE`; `corrections[]` holds the
  recorded round with a fresh post-correction QA session; the receipt pin
  resolves; the remote observation is the refreshed snapshot; the final document
  verifies clean and renders.
- **Failing-first control ("transition tested only at creation but unable to
  reach closure"):** inside the traversal suite, a mutation/control reproduces
  the WF-C04 class — the created record is integrated **without**
  `--observed-remote` and the traversal must FAIL at integration with the exact
  code (`TRANSITION_RESULT_INVALID` carrying `REMOTE_OBSERVATION_INVALID`), then
  PASS with the flag. A transition/record class that can be created but cannot
  reach closure must be detected by this suite.

### W2 — Corrections are recorded or verification fails (item 2)

Schema (`ops/workflow/schema/cycle-state.schema.json`, contract 1.2.0):

- `streams[].review.qaRounds` — **required** array of
  `{ round: integer ≥ 1, verdict: <QA verdict enum>, sessionId: string|null }`;
  rounds strictly increasing from 1. Bound the array (24) via a supported schema
  keyword or an engine rule (check `lib/schema.mjs` first; never invent an
  unsupported keyword — `SCHEMA_UNSUPPORTED_KEYWORD` must stay unreachable for
  shipped documents).

Verifier (`lib/verify.mjs`) new rules:

- `QA_ROUNDS_INCONSISTENT` — rounds are not exactly `1..n`; or
  `review.qaVerdict !== null` while `qaRounds` is empty; or the last round does
  not match `(review.qaVerdict, review.qaSessionId)`.
- `CORRECTION_NOT_RECORDED` — a `qaRounds` round with verdict
  `CORRECTION_REQUIRED` at round `r` with no `corrections[]` round whose `round
  >= r`; a disclosed correction with an empty `corrections[]` must fail.

Transition (`lib/transition.mjs`):

- `record-qa-result` appends the round (`round = qaRounds.length + 1`, verdict,
  session) before applying the verdict, and preserves all existing behavior.
- Recording `ACCEPT_READY` while the current `review.qaVerdict` is
  `CORRECTION_REQUIRED` requires a recorded correction: `corrections[]` must be
  non-empty and its last round's `candidateSha` must equal the stream's current
  `git.candidateSha`. Otherwise fail `TRANSITION_CORRECTION_NOT_RECORDED` with
  zero mutation (byte-compare the state, render, and no receipt side effects).

Fixture: `ops/workflow/__fixtures__/fail-correction-disclosed-unrecorded.json`
→ expected code `CORRECTION_NOT_RECORDED` (a `COMPLETE`-or-later stream whose
`qaRounds` discloses a `CORRECTION_REQUIRED` round while `corrections[]` is
empty). Add it to `expected.json` and to the receipt-materialization map only if
the fixture needs a receipt (prefer no receipt: closure `null` is cleaner for a
rule that must fire before/independently of closure).

### W3 — Predeclared gate classes (item 3)

Schema — `streams[].gates` gains two required keys:

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

`plan` is the predeclared per-class gate count; only the three class names exist
(`additionalProperties: false` everywhere).

Verifier rules:

- `GATES_ARITHMETIC` (extended) — top-level arithmetic; per-class arithmetic;
  every counter (`total`, `passed`, `failed`, `blocked`, `unperformed`) equals
  the sum of the three classes.
- `GATE_PLAN_MISMATCH` — for every class `c`:
  - **always:** `classes[c].total <= plan[c]` (a gate that was never predeclared
    may not appear);
  - **at an acceptance/closure claim** (`state ∈ {ACCEPT_READY, INTEGRATION_READY,
    INTEGRATED, COMPLETE}` or `review.qaVerdict === "ACCEPT_READY"` or
    `review.auditorVerdict === "AUDIT_CLEAR"`): `classes[c].total === plan[c]`
    (every predeclared gate must be accounted for; nothing may be dropped from
    the arithmetic).
- `ACCEPT_READY_DIRTY_GATES` (updated semantics, same code) — a stream in
  `ACCEPT_READY` or carrying `review.qaVerdict === "ACCEPT_READY"` requires:
  `gates.total > 0`; `classes.MANDATORY_SOURCE` fully passed
  (`passed === total`, `failed/blocked/unperformed === 0`);
  `classes.MANDATORY_LIVE.failed === 0 && classes.MANDATORY_LIVE.blocked === 0`.
  Unperformed `MANDATORY_LIVE` gates are permitted at `ACCEPT_READY` (that is a
  source-only acceptance); unperformed `DEFERRED_EXTERNAL` gates are permitted.
- `COMPLETE_MANDATORY_GATES_UNPASSED` (new) — `COMPLETE` additionally requires
  `classes.MANDATORY_LIVE.passed === classes.MANDATORY_LIVE.total` and
  `classes.MANDATORY_LIVE.unperformed === 0`. A plan with zero mandatory live
  gates satisfies this trivially.

Transition (`record-qa-result`):

- `--gates <t/p/f/b/u>` (unchanged top-level tally) **plus a required**
  `--gates-classes <MANDATORY_SOURCE=t/p/f/b/u,MANDATORY_LIVE=t/p/f/b/u,DEFERRED_EXTERNAL=t/p/f/b/u>`
  (exact delimiter/format is yours, but it must be deterministic, reject
  duplicate/unknown classes and malformed counters, and be documented).
- Optional `--gates-plan <MANDATORY_SOURCE=n,MANDATORY_LIVE=n,DEFERRED_EXTERNAL=n>`:
  sets or raises the plan. **Increase-only:** any decrease fails
  `TRANSITION_GATE_PLAN_REGRESSION`. The final candidate must satisfy the
  plan/class rules above or the transition fails
  `TRANSITION_GATE_PLAN_MISMATCH` before any write.
- Existing callers/tests/README that pass only `--gates` must be updated to the
  new required surface; preserve every existing behavioral assertion.

Fixture: `ops/workflow/__fixtures__/fail-gate-class-reclassified.json` →
`GATE_PLAN_MISMATCH` (a stream whose plan declares a `MANDATORY_LIVE` gate while
the class tallies show it only under `DEFERRED_EXTERNAL`, with a
`DEFERRED_EXTERNAL` count above its plan). This is the "mandatory live gate
silently reclassified as deferred" failing fixture. Also keep
`fail-gates-arithmetic.json` load-bearing for the class-sum dimension.

### W4 — Readiness: source-only acceptance never renders as live (item 4)

New shared production module (e.g. `ops/workflow/lib/readiness.mjs`):

- `GATE_CLASSES = ["MANDATORY_SOURCE", "MANDATORY_LIVE", "DEFERRED_EXTERNAL"]`
  and `READINESS_CLASSES = ["SOURCE_ONLY", "LIVE_PENDING", "LIVE_ACCEPTED"]`.
- `deriveReadiness(gates)` → `{ scope, mandatoryLive: { ... }, pendingCount }`:
  - `SOURCE_ONLY` when `MANDATORY_LIVE.total === 0` (source-only acceptance,
    never live readiness);
  - `LIVE_PENDING` when mandatory live gates exist and any is
    failed/blocked/unperformed;
  - `LIVE_ACCEPTED` only when mandatory live gates exist and all passed.
- The derivation must be the single implementation used by the verifier and the
  renderer; a mutant that infers `LIVE_ACCEPTED` from
  `auditorVerdict === "AUDIT_CLEAR"` (or from `ACCEPT_READY`) while
  `MANDATORY_LIVE.total === 0` must fail a committed control.

Renderer (`lib/render.mjs`):

- Add a `Readiness` column to the Streams table.
- Add a deterministic "Gate classes" section (stream × class ×
  planned/total/passed/failed/blocked/unperformed) and one fixed line stating
  the derivation rule, including that source-only acceptance is not deployment
  or live readiness.
- Regenerate `docs/plans/atlas-active-delivery-streams.generated.md` from the
  migrated state; `render-register.mjs --check` must exit 0 afterward.

Receipts (`lib/receipt.mjs`):

- Mint `receiptVersion` **1.1.0** with a required `verified.readiness` string.
  `verified.gates` keeps the five scalar counters (no classes).
- `SUPPORTED_RECEIPT_VERSIONS = { "1.0.0", "1.1.0" }`. Legacy 1.0.0 receipts
  remain valid: compare the five gate scalars as today and skip the readiness
  check. For 1.1.0: `verified.readiness` must equal `deriveReadiness(stream.gates).scope`,
  else `RECEIPT_READINESS_MISMATCH`; an invalid readiness value is
  `RECEIPT_INVALID` shape.

Fixture: `ops/workflow/__fixtures__/fail-receipt-readiness-live.json` →
`RECEIPT_READINESS_MISMATCH` (a closed/source-only stream pinning a 1.1.0 receipt
that claims `LIVE_ACCEPTED`). Materialize the receipt through the harness
(`makeReceipt` gains an optional readiness) and register it in
`RECEIPT_FIXTURES`.

### W5 — Directive: parity/conservation and scope-epoch (items 5, 6, 8)

Edit **`AGENTS.md` only** for normative text (do not duplicate the rules into
`ops/workflow/README.md`, `ATLAS_AGENT_KI.md`, or any other file):

1. In the **Production-shape equivalence gate** section, append one numbered
   rule (13) requiring, whenever a client renders server-owned enums, reason
   codes, state names, or blocker codes: an enumeration of the producer's
   complete emitted domain proved against the consumer's mapping member by
   member; an explicit unknown bucket that conserves counts
   (`sum(grouped counts) === total`) instead of dropping unrecognized values;
   and failing-first mutants for both (a removed producer member and a dropped
   unknown value). Missing either mutant prevents `ACCEPT_READY` for a change
   that renders server-owned values.
2. In **Always-On Safety Rules**, extend the existing bullet
   "Actor/tenant scope caches must be bound to the authenticated session
   identity or token epoch…" with the requirement that scope-epoch (or an
   equivalent stale-response guard binding each dispatched request to the scope
   active at dispatch time and discarding replies that land after a school,
   year, or session transition) applies to **every related actor-school/year
   authority feed in the affected contract — reads, diagnostics, previews, and
   state setters alike — not only the call site being edited**. A change that
   guards one feed while a sibling feed in the same authority contract can still
   accept an obsolete-scope reply has not closed the defect; an unguarded
   sibling feed is a blocking defect, not a disclosed residual, and the
   acceptance must include a failing-first scope-transition control.
3. After editing, compute the **LF-normalized SHA-256** of `AGENTS.md`
   (read bytes, normalize CRLF→LF, hash the UTF-8 bytes — the same procedure
   that yields `5f9206708a4763376dda1943c1ead28f49427ed1b1f0532ad25661f74ed3ebb5`
   at the accepted base) and record it in the handoff. Do not weaken, reorder,
   or renumber unrelated existing directive rules; keep the diff minimal and
   scoped to these two additions.

### W6 — Directive-conformance controls on the workflow's own surfaces (item 7, middle three)

The cycle must not modify ATLAS product code, and the TL/export lanes own those
files; therefore the three product defect classes are enforced, with real
failing-first controls, on the workflow system's own producer→consumer surfaces
(the state contract is the producer; the renderer, status/liveness, verifier,
and receipt consumers render or classify its values):

1. **"server reason absent from client mapping" → producer-domain parity.**
   New `ops/workflow/__tests__/directive-conformance.test.mjs` with a control
   that enumerates the schema-declared enum domains consumed by the workflow
   (stream states, QA/auditor verdicts, blocker kinds, lease states, owner
   statuses, observation statuses, gate classes, readiness classes) and asserts
   every consumer that maps or partitions a domain covers every schema member
   (via the shared constants exported by the consumers where they exist, and
   explicit fail-closed defaults where they do not). **Mutant:** add a member to
   a schema enum (test-local schema patch, as `coverage.test.mjs` already does)
   and prove the parity control fails naming the unhandled member; restore
   byte-exact.
2. **"unknown reason dropped instead of conserved" → count conservation.**
   Harden `summarizeClassifications` (and any other consumer that groups
   producer-valued items) so an out-of-domain classification is conserved in an
   explicit `UNKNOWN` bucket and `sum(buckets) === total` always holds; add the
   control with an out-of-domain value through the real production path.
   **Mutant:** restore the dropping/`NaN`-producing iteration and prove the
   control fails; restore byte-exact.
3. **"stale response accepted after scope transition" → scope-epoch guard.**
   In `status.mjs`, an explicit `--common-dir` that does not match the state
   document's resolved Git common directory must fail closed with a typed
   `STATUS_SCOPE_MISMATCH` (no foreign sessions, classifications, or next
   actions rendered as current). Add the two-temp-repo control (state in A,
   heartbeats in B → fail; matching dirs → unchanged behavior). **Mutant:**
   remove the guard and prove foreign sessions are accepted (control fails);
   restore byte-exact.
   Secondary bounded fix from the WF-C04 audit F1: `record-integration
   --observed-ref` without `--observed-remote` is currently silently ignored;
   make it fail closed with a typed error and cover it failing-first (its own
   test row in `stream-integration-observation.test.mjs` or
   `transition.test.mjs`).

Record the exact class → control → mutant mapping in the handoff under a
`directive-conformance mapping` heading so the Wave Completion Auditor can trace
each operator bullet to its executable control.

### W7 — Contract bump, migration, and document migration (item 1 dependency)

- `contractVersion` `1.1.0` → `1.2.0` in the schema; `lib/migrate.mjs` gains
  `CONTRACT_VERSION` 1.2.0 and a deterministic, pure 1.1.0 → 1.2.0 step:
  - `gates.plan = { MANDATORY_SOURCE: <existing total>, MANDATORY_LIVE: 0, DEFERRED_EXTERNAL: 0 }`
    and `gates.classes.MANDATORY_SOURCE` = a copy of the five existing counters,
    other classes zeroed (so the plan/class equality rules hold immediately);
  - `review.qaRounds` synthesized deterministically from `corrections[]`
    (each correction's non-null `qaVerdict`/`qaSessionId`, in round order) plus
    the final `review.qaVerdict`/`qaSessionId` when not already represented,
    renumbered `1..n`; the synthesis must satisfy the new rules by construction
    and must not fabricate a `CORRECTION_REQUIRED` round without its correction
    round;
  - every historical identity (SHAs, verdicts, sessions, receipts, gate
    counters) preserved verbatim; receipts are NOT rewritten.
- Migrate the **live** `docs/plans/atlas-delivery-cycles.json` (13 streams,
  revision unchanged — a version migration is not a transition) and regenerate
  the committed generated register. `verify-cycle.mjs` and
  `render-register.mjs --check` must exit 0 on the candidate tree.
- Tests: a deterministic 1.1.0→1.2.0 migration test (small embedded or fixture
  1.1.0 document with corrections/gates/receipt-free shape → migrate → verify
  clean); plus a check that migrating the pre-migration committed document
  (`git show <accepted-base>:docs/plans/atlas-delivery-cycles.json`) reproduces
  the migrated committed document byte-for-byte after re-render.
- `ops/workflow/__tests__/seed.test.mjs`: update the `contractVersion` pin to
  `1.2.0`; keep the explicit stream-inventory pin (WF-C05 was added by the
  registration commit) and all negative controls. Update every other committed
  assertion that encodes 1.1.0 (e.g. `schema.test.mjs`) to 1.2.0.
- Update `ops/workflow/README.md` for the 1.2.0 contract, the new flags, the
  readiness derivation, receipt 1.1.0, and the migration — mechanism
  documentation only, no normative-rule duplication.

### W8 — Fixture/coverage completeness

- Add the three new fixtures (W2/W3/W4) to `expected.json`.
- Every new verifier rule code must be reachable: fixture-backed
  (`CORRECTION_NOT_RECORDED`, `GATE_PLAN_MISMATCH`,
  `RECEIPT_READINESS_MISMATCH`) or a committed `coverage.test.mjs` mutation case
  (`QA_ROUNDS_INCONSISTENT`, `COMPLETE_MANDATORY_GATES_UNPASSED`).
- Update every existing fixture/state document to the 1.2.0 shape (plan,
  classes, qaRounds) — including the `pass-*` fixtures, the receipt fixtures,
  and `fail-complete-stale-corrections.json` (its freshness rule must still fire
  for the new shape; its corrected counterpart must pass).
- New transition-level failing-first controls: `TRANSITION_CORRECTION_NOT_RECORDED`
  (W2), `TRANSITION_GATE_PLAN_REGRESSION`/`TRANSITION_GATE_PLAN_MISMATCH` (W3),
  `STATUS_SCOPE_MISMATCH` (W6.3), `TRANSITION_OBSERVED_REF_WITHOUT_REMOTE` (W6.3
  secondary). Each must prove zero mutation on rejection (byte-compare).
- `__tests__/harness.mjs`: extend only as needed (readiness in `makeReceipt`,
  any traversal helpers). No test may lose coverage: if an existing assertion
  must change, the handoff lists it with the reason and the replacement
  assertion.

### W9 — Handoff and evidence

`docs/handoffs/wf-c05-executor.md` with: base/candidate SHAs, the mechanical
changed-path inventory (`git diff --name-only <base>...<candidate)`) asserted
set-equal to the declared list (Trap 5), the trace table
(`requirement -> production path -> negative control -> verification command`),
every mutant with its baseline/mutant blob or byte-restore proof, the
`directive-conformance mapping`, the new directive LF-normalized SHA-256, the
one-row `production-shape parity` statement (real producer: the transition
tool/state document; real consumers: verifier, renderer, status, receipts;
conservation totals: gate counters across classes, QA rounds, readiness
derivation; negative control: the schema-patch parity mutant + the class
reclassification fixture), the test-preservation census, risks, zero-mutation
statement, and `REVIEW_REQUIRED`.

## 2. Non-negotiable boundaries

- Owned: `AGENTS.md`, `ops/workflow/**`,
  `docs/plans/atlas-delivery-cycles.json`,
  `docs/plans/atlas-active-delivery-streams.generated.md`,
  `docs/handoffs/wf-c05-executor.md`.
- Forbidden: `atlas-client/**`, `atlas-server/**`, `prisma/**`,
  `ops/runtime/**`, `.opencode/**`, `docs/reference/**`, `docs/reviews/**`,
  `docs/prompts/**`, `docs/analysis/**`, `docs/plans/wf-eval-c01-mandatory-traps.md`,
  `CHANGELOG.md`, `stakeholderFiles/**`, every companion repository, every
  runtime/DB/config path. No deployment, restart, login, browser, database,
  migration, generation, publication, or worktree operation. Never run
  `npm install`/`npm ci` (not needed: the suite is Node built-ins only).
- The state document is the shared register: do not hand-edit it beyond the
  mechanical migration; do not change `registry.revision`; do not record
  transitions (the planner does that after integration).

## 3. Gates and evidence

Run and record, from the worktree root:

1. `node --test --test-concurrency=1 ops/workflow/__tests__/*.test.mjs` for the
   deterministic final battery (the plain `npm run workflow:test` result must
   also be recorded; see the environment note below).
2. `node ops/workflow/verify-cycle.mjs --state docs/plans/atlas-delivery-cycles.json`
   → exit 0, `errors: []`.
3. `node ops/workflow/render-register.mjs --check --state docs/plans/atlas-delivery-cycles.json --output docs/plans/atlas-active-delivery-streams.generated.md`
   → exit 0.
4. `git diff --check`; complete `git status --short` (must be empty at return).
5. Migration reproduction command + output (live document from
   `<accepted-base>` bytes → same committed bytes after render).
6. Directive hash computation + value.

**Known environment note (do not "fix" by weakening a test):** at the accepted
base the full suite ran 251/251 green in 72.0s; one earlier run had the
`plugin-load.test.mjs` "installed OpenCode resolves this exact plugin file" row
killed at its 120s `opencode debug config` timeout while other suites ran
concurrently, and the file passes 6/6 in isolation (8.2s). If that row times out
under the final battery, re-run `node --test ops/workflow/__tests__/plugin-load.test.mjs`
alone, record both results, and classify it as an environment/load flake in the
handoff.

**Budget and checkpoint (Trap 4):** MEDIUM one-shot, target ≤ 120 minutes. Commit
one coherent checkpoint commit BEFORE the final battery (full suite + verify +
render + diff-check), then land only additive finalize commits. Report at 75% of
budget with the active command and remaining critical path.

## 4. Return contract

`REVIEW_REQUIRED` with: accepted base SHA, candidate SHA, exact changed paths,
trace table (PASS/BLOCKED/DEFERRED — a row without production-path evidence is
not PASS), mutant/restore evidence, directive hash, test-preservation census,
known risks, zero-mutation statement, and clean-worktree proof. Do not merge,
rebase, amend after handoff, push, or update the register; a fresh independent
QA delegate reviews the immutable range next.

`PLANNER_SESSION_ROUTE: EXISTING primary-planner (WF-C05 cycle)`
`EXECUTOR_SESSION_ROUTE: EXISTING work/workflow-process-hardening-c05 executor`
`QA_SESSION_ROUTE: FRESH_REQUIRED` (fresh delegate per candidate)
