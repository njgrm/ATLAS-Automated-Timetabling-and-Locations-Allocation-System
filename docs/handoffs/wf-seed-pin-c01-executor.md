# WF-SEED-PIN-C01 — Executor Handoff

**Role:** EXECUTOR · **Risk tier:** LOW (ordinary source/test correction) · **Verdict:** `REVIEW_REQUIRED`

| Field | Value |
|---|---|
| Cycle | `WF-SEED-TERM-CACHE-TL-C06-20260916`, Phase 0 = `WF-SEED-PIN-C01` |
| Accepted base SHA | `476157b100b4ddb1e27bc487c33fd977bc76632b` (verified: `git rev-parse HEAD` at start and clean `git status --short`) |
| Candidate SHA | the single commit containing this file on `fix/wf-seed-pin-c01` (reported as exact 40-hex in the return message) |
| Branch | `fix/wf-seed-pin-c01` |
| Worktree | `E:/ATLAS-worktrees/wf-seed-pin-c01` (pre-existing; not created, moved, or retired by this task) |
| Owned paths | `ops/workflow/__tests__/seed.test.mjs`, `docs/handoffs/wf-seed-pin-c01-executor.md` |
| Worktree disposition | `RETIRE_AFTER_INTEGRATION` (not retired here) |

## Defect

`ops/workflow/__tests__/seed.test.mjs` asserted, for `ENROLLPRO-PROXY-RECOVERY-LIVE` only, that
`stream.git.candidateSha` equalled the deployed product release `54dce67b…`. That conflated two
different identities: the registry correctly records `7ca366fa…` as that stream's docs/evidence
candidate and integration identity, while `54dce67b…` is an operational deployment fact recorded only
inside the stream's `objective` / `approval.boundary` / `approval.approvedActions` prose. The comment
at `seed.test.mjs:70-73` already documented the intended invariant ("either has no candidate yet
(`null`) or carries a committed 40-hex lowercase SHA"); the deleted branch contradicted it.

Failing-first baseline (reproduced independently in this worktree before editing):
`node --test ops/workflow/__tests__/seed.test.mjs` → exit 1, `tests 5 / pass 4 / fail 1`,
`seed.test.mjs:91` `ERR_ASSERTION` actual `7ca366fa396ddb2d7cdfec0e40abcecd404b8445` vs expected
`54dce67b8392cbce09aa810813c37f9c87a67159`.

## Correction

1. Deleted the stream-specific `if (stream.id === "ENROLLPRO-PROXY-RECOVERY-LIVE") { …; continue; }`
   branch. The stream now falls through to the same `isNullOrCommittedSha` / `CANDIDATE_SHA_PATTERN`
   invariant as every other stream.
2. Preserved that general invariant unchanged: `null` OR committed lowercase 40-hex.
3. Introduced no replacement hard-coded SHA. The literal `54dce67b8392cbce09aa810813c37f9c87a67159`
   does not appear anywhere in the committed tree under this task's ownership — the deployed release
   is derived at runtime from the stream's own approval/objective prose.
4. Added the failing-first, load-bearing regression
   `an evidence candidate may differ from the deployed product release`, which reads the real
   committed registry (`docs/plans/atlas-delivery-cycles.json`) and asserts:
   (a) `isNullOrCommittedSha(stream.git.candidateSha)` accepts the real evidence candidate;
   (b) the prose-derived deployed release is a distinct committed SHA (`assert.notEqual` across the
   two identities); (c) the explicit conflation predicate
   `conflatesEvidenceWithDeployedRelease(stream)` is `false` on the real record while its inverted
   mutant `invertedConflationPredicate(stream)` is `true`, so a vacuous implementation cannot pass.
   It additionally re-evaluates the retired rule in its exact assertion form and requires it to throw
   (`err.code === "ERR_ASSERTION"`), documenting that reintroducing the old equality assertion cannot
   pass here.
5. Kept every existing negative control and extended them (added `0x`-prefixed, leading-whitespace,
   trailing-whitespace, and `undefined` rejection cases). No assertion was weakened or removed.
6. `SEED_STREAM_IDS` is unchanged (exactly the 14 committed ids). No registry JSON, generated
   register, `ops/workflow/schema/**`, `ops/workflow/lib/**`, `ops/workflow/transition.mjs`, or other
   transition semantic was touched. No schema field for deployed runtime identity was added.

## Trace table

| Requirement | Production path | Negative control | Verification command | Result |
|---|---|---|---|---|
| R1 Remove the stream-specific `candidateSha == deployed release` assertion | `ops/workflow/__tests__/seed.test.mjs` invariant loop (now uniform for all 14 streams) | mutation control re-inserts the literal conflation assertion → the regression fails (exit 1) | `node --test ops/workflow/__tests__/seed.test.mjs` | PASS (6/6, exit 0) |
| R2 Preserve the general `null`-or-committed-40-hex invariant | `isNullOrCommittedSha` + `CANDIDATE_SHA_PATTERN` (`seed.test.mjs:74-78`) applied to all streams | 9 malformed classes rejected + 2 positive classes accepted | `node --test ops/workflow/__tests__/seed.test.mjs` | PASS |
| R3 No replacement hard-coded SHA operand | committed candidate tree | source scan of the owned file for the retired literal | `grep`/`git show HEAD:ops/workflow/__tests__/seed.test.mjs` → 0 matches | PASS |
| R4 Failing-first load-bearing regression proving candidate ≠ deployed release | real registry `docs/plans/atlas-delivery-cycles.json` (`ENROLLPRO-PROXY-RECOVERY-LIVE`) → new test | inverted-predicate mutant required `true`; re-inserted literal conflation assertion fails the test | `node --test ops/workflow/__tests__/seed.test.mjs` | PASS |
| R5 Negative controls retained and extended | same predicate | malformed/uncommitted values still rejected | `node --test ops/workflow/__tests__/seed.test.mjs` | PASS |
| R6 No inventory, registry, schema, or transition change | `SEED_STREAM_IDS` (14 ids) and all forbidden paths untouched | exact changed-path attribution | `git diff --name-only 476157b1...HEAD` | PASS (2 owned paths only) |

## Gate results

| # | Command | Observed |
|---|---|---|
| 1 | `node --test ops/workflow/__tests__/seed.test.mjs` | exit 0; `tests 6 / pass 6 / fail 0` |
| 2 | mutation control (literal conflation assertion temporarily re-inserted) | exit 1; `tests 6 / pass 5 / fail 1` — only `an evidence candidate may differ from the deployed product release` failed; restored byte-exactly (SHA-256 unchanged, mutation absent, diff shows only the intended correction) |
| 3 | `npm run workflow:test` | exit 0; `tests 280 / pass 280 / fail 0` |
| 4 | `node ops/workflow/verify-cycle.mjs --state docs/plans/atlas-delivery-cycles.json` | exit 0, `status: ok`, `errors: []` |
| 5 | `node ops/workflow/render-register.mjs --check --state docs/plans/atlas-delivery-cycles.json --output docs/plans/atlas-active-delivery-streams.generated.md` | exit 0, no drift |
| 6 | `git diff --check` | clean (exit 0) |
| 7 | `git diff --name-only 476157b1...HEAD` (post-commit) | exactly the two owned paths |

## Environment precondition (disclosed, not "fixed")

`.opencode/package.json` and `.opencode/node_modules` exist in this worktree as untracked, gitignored
local OpenCode scaffold. The file was confirmed present before the final `npm run workflow:test`
(without it, three `plugin-load.test.mjs` tests fail with `Cannot use import statement outside a
module` — a pre-existing hermeticity defect explicitly out of scope here). Nothing under `.opencode/`
was added, modified, removed, staged, or committed.

## WF-EVAL successor recommendation (recorded only — not implemented)

Deployed runtime identity currently has **no structured registry field**: for
`ENROLLPRO-PROXY-RECOVERY-LIVE` the deployed product release exists only inside `approval.boundary` /
`approval.approvedActions` / `objective` prose, while `git.candidateSha` carries the docs/evidence
candidate. That asymmetry is exactly what let the retired assertion conflate the two, and it forced
this regression to parse prose. Recommend registering for WF-EVAL a bounded successor that adds an
explicit, schema-validated deployed-runtime-identity field (for example
`runtime.deployedReleaseSha` / `runtime.installedAt` on streams whose approval execution performed a
deployment), plus verifier invariants distinguishing evidence candidate, integration identity, and
deployed release. This correction deliberately does **not** widen into a schema change.

## Residual risks / non-blocking observations

- The regression is bound to the stream id `ENROLLPRO-PROXY-RECOVERY-LIVE` and to its approval/objective
  prose; if that prose ever loses the deployed release SHA the test fails closed (`deployedReleaseShas.length > 0`).
  This is intentional for a load-bearing control, but a future registry-shape change should update it
  together with the WF-EVAL successor field above.
- The regression derives the release by scanning prose for `\b[0-9a-f]{40}\b` tokens in `objective`,
  `approval.boundary`, and `approval.approvedActions`. It deliberately does not read `nextAction`
  (free-form status prose whose shape can legitimately change between reconciliations).
- No product runtime code, server, client, database, or shared runtime was touched; this is a test-only
  correction.

## Boundary statement

I did not touch the machine registry (`docs/plans/atlas-delivery-cycles.json`), the generated or
historical living registers, `CHANGELOG.md`, receipts, the runtime source-of-truth map, or anything
under `.opencode/**`. I did not create or remove a worktree, merge, rebase, reset, stash, amend, or
push any branch. No login, browser session, database, migration, generation, publication, or runtime
action was performed.
