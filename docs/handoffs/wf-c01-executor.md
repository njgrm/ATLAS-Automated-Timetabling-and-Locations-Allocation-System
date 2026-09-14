# WF-C01 executor handoff (workflow-foundation)

## Identity

- Worktree: `D:\ATLAS-worktrees\workflow-foundation-wfc01`
- Branch: `work/workflow-foundation-wfc01`
- Base SHA: `29284ac6218b989ab860cde0d36266eabf26395b` (= refreshed `origin/main` at dispatch)
- Candidate product/test tip SHA: `42f41a21e58e7443b7314963fb9109a2a2aacb8f` (every product, test, fixture, README, `package.json`, renderer, and `.gitattributes` change; includes the R1 portability correction and the R2 candidate-SHA invariant correction)
- Candidate branch tip: the commit that carries this handoff, the seed document, and the generated register. A file cannot contain its own commit SHA, so the branch tip is resolved with
  `git -C D:\ATLAS-worktrees\workflow-foundation-wfc01 rev-parse HEAD`; the planner/QA records that SHA as the candidate SHA. Commits above the product/test tip are documentation-only (seed, generated register, handoff).
- Candidate SHA lifecycle: at candidate freeze the seed keeps `git.candidateSha` null for WF-C01; the planner records candidate/integration SHAs when the register advances to `INTEGRATION_READY`/`COMPLETE`, and `seed.test.mjs` accepts `null` or a 40-hex lowercase SHA for every stream except the externally pinned `ENROLLPRO-PROXY-RECOVERY-LIVE`.
- Risk tier: MEDIUM (source + tests + docs; no live runtime, database, network, browser, or HIGH action)
- Verdict: `REVIEW_REQUIRED`

## Changed paths (base...tip, 48)

```
.gitattributes
docs/handoffs/wf-c01-executor.md
docs/plans/atlas-active-delivery-streams.generated.md
docs/plans/atlas-delivery-cycles.json
ops/workflow/README.md
ops/workflow/__fixtures__/expected.json
ops/workflow/__fixtures__/fail-accept-ready-blocked.json
ops/workflow/__fixtures__/fail-candidate-unknown.json
ops/workflow/__fixtures__/fail-changed-paths-extra.json
ops/workflow/__fixtures__/fail-changed-paths.json
ops/workflow/__fixtures__/fail-complete-stale-corrections.json
ops/workflow/__fixtures__/fail-custody-overlap.json
ops/workflow/__fixtures__/fail-dependency-not-satisfied.json
ops/workflow/__fixtures__/fail-duplicate-writable.json
ops/workflow/__fixtures__/fail-external-with-safe-work.json
ops/workflow/__fixtures__/fail-gates-arithmetic.json
ops/workflow/__fixtures__/fail-high-boundary-exceeded.json
ops/workflow/__fixtures__/fail-high-expired-dependency.json
ops/workflow/__fixtures__/fail-high-unreachable-dependency.json
ops/workflow/__fixtures__/fail-high-without-approval.json
ops/workflow/__fixtures__/fail-missing-next-action.json
ops/workflow/__fixtures__/fail-receipt-missing.json
ops/workflow/__fixtures__/fail-receipt-stale.json
ops/workflow/__fixtures__/fail-stale-candidate.json
ops/workflow/__fixtures__/fail-successor-unlocked.json
ops/workflow/__fixtures__/fail-unauthorized-login.json
ops/workflow/__fixtures__/fail-unknown-requires.json
ops/workflow/__fixtures__/pass-audited-wave.json
ops/workflow/__fixtures__/pass-high-prepared.json
ops/workflow/__fixtures__/pass-ordinary.json
ops/workflow/__tests__/artifact-portability.test.mjs
ops/workflow/__tests__/cli.test.mjs
ops/workflow/__tests__/determinism.test.mjs
ops/workflow/__tests__/fixtures.test.mjs
ops/workflow/__tests__/harness.mjs
ops/workflow/__tests__/schema.test.mjs
ops/workflow/__tests__/seed.test.mjs
ops/workflow/lib/args.mjs
ops/workflow/lib/git.mjs
ops/workflow/lib/receipt.mjs
ops/workflow/lib/render.mjs
ops/workflow/lib/schema.mjs
ops/workflow/lib/util.mjs
ops/workflow/lib/verify.mjs
ops/workflow/render-register.mjs
ops/workflow/schema/cycle-state.schema.json
ops/workflow/verify-cycle.mjs
package.json
```

## Trace matrix (requirement -> production path -> negative control -> verification)

| ID | Requirement | Production path | Negative control | Verification command | Result |
| --- | --- | --- | --- | --- | --- |
| G01 | Clean worktree, correct base ancestry, exact changed-path attribution | branch `work/workflow-foundation-wfc01` at base `29284ac6` | — | `git status --porcelain`; `git merge-base --is-ancestor 29284ac6 HEAD`; `git diff --name-only --no-renames 29284ac6...HEAD` | PASS (clean; base is ancestor; 48 paths identical to the seed `changedPaths` list) |
| G02 | Every required surface exists at its exact path | `ops/workflow/{schema,lib,verify-cycle.mjs,render-register.mjs,__tests__,__fixtures__,README.md}`, `docs/plans/atlas-delivery-cycles.json`, `docs/plans/atlas-active-delivery-streams.generated.md`, `docs/handoffs/wf-c01-executor.md`, `package.json` | — | `git ls-files ops/workflow docs/plans/atlas-delivery-cycles.json docs/plans/atlas-active-delivery-streams.generated.md docs/handoffs/wf-c01-executor.md package.json` | PASS |
| G03 | `npm run workflow:test` exits 0 with no skips | `ops/workflow/__tests__/*.test.mjs` | per-fixture child-process exit codes | `npm run workflow:test` | PASS (60 tests / 60 pass / 0 fail / 0 skipped) |
| G04 | Committed seed verifies cleanly | `verify-cycle.mjs --state docs/plans/atlas-delivery-cycles.json` | — | `node ops/workflow/verify-cycle.mjs --state docs/plans/atlas-delivery-cycles.json` | PASS (exit 0, status ok, 5 streams) |
| G05 | Verify stdout is byte-identical for identical input | `lib/verify.mjs` + `buildReport` | repeated run | `determinism.test.mjs` "verify stdout is byte-identical across two runs" | PASS |
| G06 | Renderer is deterministic and path-independent | `lib/render.mjs` | two paths, identical content | `determinism.test.mjs` "render output is byte-identical across two runs" + "independent of the state file path" | PASS |
| G07 | Determinism assertion is load-bearing | notice marker `const GENERATED_NOTICE = "<!-- atlas-workflow-register: generated; do not edit -->"` | mutated renderer injecting `Date.now()` | `determinism.test.mjs` "nondeterministic renderer mutant is detected" | PASS (mutant produces different bytes) |
| G08 | Three positive fixtures exit 0 | `__fixtures__/pass-*.json` | — | `fixtures.test.mjs` fixture cases + "positive fixtures expose no error codes" | PASS (3/3) |
| G09 | Every negative fixture exits nonzero with its intended code | `__fixtures__/fail-*.json` + `expected.json` | — | `fixtures.test.mjs` fixture cases | PASS (21/21) |
| G10 | No default/decoy state selection; render usage errors | `lib/args.mjs`, `verify-cycle.mjs`, `render-register.mjs` | cwd containing decoy `docs/plans/atlas-delivery-cycles.json` | `cli.test.mjs` decoy / unknown-flag / missing-output / missing-value cases | PASS (exit 2, `USAGE_MISSING_STATE`; decoy byte-identical after run) |
| G11 | Receipt minting is correct and never happens on failure | `lib/receipt.mjs` + `verify-cycle.mjs --receipt` | failing state + `--receipt` | `cli.test.mjs` mint / failing-state / ambiguous / unknown-stream cases | PASS (`stateSha256` == sha256 of state bytes; no file written on failure) |
| G12 | COMPLETE receipt binding | `validateClosureReceipt` | missing receipt; stale gates | `fail-receipt-missing.json` (`COMPLETE_MISSING_RECEIPT`), `fail-receipt-stale.json` (`RECEIPT_STALE`), renderer-refusal case | PASS |
| G13 | Post-correction freshness | COMPLETE correction rules in `lib/verify.mjs` | round 2 reusing round 1 QA session | `fail-complete-stale-corrections.json` | PASS (`POST_CORRECTION_FRESH_QA_MISSING`) |
| G14 | Git ancestry/SHA existence/changed-path set equality | `lib/git.mjs` + git binding rules | orphan candidate; unknown object; missing/extra declared path | `fail-stale-candidate.json`, `fail-candidate-unknown.json`, `fail-changed-paths*.json` | PASS (`GIT_ANCESTRY`, `GIT_SHA_UNKNOWN`, `CHANGED_PATHS_MISMATCH` with exact missing/extra lists) |
| G15 | HIGH execution requires a complete granted approval inside the boundary | approval rules | `performed` with `granted:false`; unapproved action | `fail-high-without-approval.json`, `fail-high-boundary-exceeded.json` | PASS (`HIGH_EXECUTION_WITHOUT_APPROVAL`, `HIGH_BOUNDARY_EXCEEDED`) |
| G16 | HIGH readiness dependencies must be healthy and unexpired | readiness rules | FAIL observation; expired PASS observation | `fail-high-unreachable-dependency.json`, `fail-high-expired-dependency.json` | PASS (`HIGH_DEPENDENCY_UNHEALTHY`, `HIGH_DEPENDENCY_EXPIRED`) |
| G17 | Browser custody exclusivity and login authorization | custody rules | two ACTIVE custody entries; performed login with no authorization | `fail-custody-overlap.json`, `fail-unauthorized-login.json` | PASS (`CUSTODY_OVERLAP`, `LOGIN_UNAUTHORIZED`) |
| G18 | One writable owner per stream/worktree | owner rules | two ACTIVE writable owners | `fail-duplicate-writable.json` | PASS (`WRITABLE_OWNER_CONFLICT`) |
| G19 | External blockers may not hide safe work | blocker rules | EXTERNAL with `safeWorkRemaining:true` + items | `fail-external-with-safe-work.json` | PASS (`EXTERNAL_BLOCKER_WITH_SAFE_WORK`) |
| G20 | Successor/requires integrity | successor + requires rules | unlocked successor from RUNNING; undefined id; unmet dependency | `fail-successor-unlocked.json`, `fail-unknown-requires.json`, `fail-dependency-not-satisfied.json` | PASS (`SUCCESSOR_UNLOCKED_INCOMPLETE`, `UNKNOWN_STREAM_REFERENCE`, `DEPENDENCY_NOT_SATISFIED`) |
| G21 | Hermetic, dependency-free, clean | Node built-ins only; temp repositories under `os.tmpdir()` | — | `git diff --cached --check`; `git status --porcelain`; `git diff -- package-lock.json`; `git diff --stat` | PASS (no dependency change, package-lock untouched, clean status after the suite, diff-check clean) |

## Test evidence

- `npm run workflow:test` -> `tests 60 / pass 60 / fail 0 / cancelled 0 / skipped 0 / todo 0` (57 in the original candidate + 3 portability controls in R1).
- Fixture totals: 24 fixture files (3 positive, 21 negative) indexed by `__fixtures__/expected.json`; extra tests assert the index covers every fixture file, that positives expose zero error codes, and that changed-path mismatches report the exact missing/extra direction.
- Determinism: verify stdout and rendered Markdown are byte-identical across repeats and across two distinct state paths; the mutated-renderer control proves the assertion is load-bearing.
- Receipt: minted receipt carries `stateSha256` equal to the SHA-256 of the state bytes; no receipt is created for a failing state; ambiguous selection returns `RECEIPT_STREAM_AMBIGUOUS` with no write.
- Hermeticity: tests create disposable repositories under `os.tmpdir()` with fixed `-c user.name` / `-c user.email` / `-c commit.gpgsign=false`; `git status --porcelain` is empty after the full suite.

## R1 correction (additive; found by the primary planner during integration gates)

**Root cause.** The seed's artifact pins are raw working-tree SHA-256 values, and
the worktree files were written by tools as LF, so the pins are LF hashes
(schema `6125be928cc9eac70dcda86c76242105ce0107a72a9abc12ee2f9010e5128101`,
handoff `d73260d1…`). This host's global Git config sets `core.autocrlf=true`
and the repository had no `.gitattributes`, so any Git-materialized checkout
rewrote LF to CRLF. On the integration merge tree `936aa439` the schema
materialized as `0745843a…` (CR=323, 13173 bytes vs the pinned LF 12850 bytes)
and the handoff as `b28b0fc6…`, while the Git-normalized blob identities stayed
identical (`ac76b8f9…` schema, `ada087c0…` handoff). The committed seed
therefore failed `ARTIFACT_HASH_MISMATCH` (G04) in any fresh checkout, and the
same class would have broken the future `closure.receipt.sha256` pin under
`docs/plans/receipts/`.

**Fix (smallest complete).** Added the repository root `.gitattributes`
enforcing `eol=lf` for the pinned classes (`ops/workflow/**`, `docs/plans/**`,
`docs/handoffs/**`) so the raw LF bytes are checkout-stable; no pin semantics,
verifier, receipt, schema, or fixture behaviour changed. The schema pin is
unchanged because the schema bytes did not change. `ops/workflow/README.md`
now documents that artifact and receipt pins are raw LF byte hashes and that
future pinned artifacts must live under an LF-enforced path.

**Load-bearing regression.** `ops/workflow/__tests__/artifact-portability.test.mjs`
adds three controls:

| ID | Control | Negative/mutant flow | Result |
| --- | --- | --- | --- |
| R1-01 | Every seed-pinned artifact path is covered by an `eol=lf` attribute | a future pin outside the enforced directories fails until the policy is extended | PASS |
| R1-02 | Real flow: each pin materializes through a disposable `core.autocrlf=true` Git checkout (`.gitattributes` copied, `git add`, commit, delete working copies, `git checkout -- .`) and its raw SHA-256 equals the pin | — | PASS (schema and handoff both equal their pins) |
| R1-03 | Mutant flow: the same materialization **without** the `.gitattributes` rules | at least one materialized file's raw SHA-256 differs from its pin (reproduces the CRLF defect) | PASS (CRLF materialization detected) |

Commands: `node --test ops/workflow/__tests__/artifact-portability.test.mjs`
(3/3) and `npm run workflow:test` (60/60). The seed was re-pinned for the
handoff only after its R1 content was final, and
`docs/plans/atlas-active-delivery-streams.generated.md` was regenerated after
the seed edit.

## R2 correction (additive; wave-auditor finding B1)

**Defect.** `ops/workflow/__tests__/seed.test.mjs` asserted that every stream
other than `ENROLLPRO-PROXY-RECOVERY-LIVE` has `git.candidateSha` strictly
`null`. That over-constrained the intended lifecycle: the planner's register
recording legitimately sets `WF-C01.git.candidateSha` when the register advances
to `INTEGRATION_READY`/`COMPLETE`, so at the integrated tree the assertion at
`seed.test.mjs:45` failed (`59/60` red). The handoff sentence "The seed
deliberately keeps `git.candidateSha` null for WF-C01" was likewise only true at
candidate freeze.

**Fix.** The invariant is now drift-proof and load-bearing:
`ENROLLPRO-PROXY-RECOVERY-LIVE` keeps its exact pinned SHA
`54dce67b8392cbce09aa810813c37f9c87a67159`; every other stream must satisfy
`candidateSha === null || /^[0-9a-f]{40}$/.test(candidateSha)`. The defining test
gained inline negative controls (`"not-a-sha"`, a 39-hex string, an uppercase
40-hex string, `""`, `123`) proving the predicate rejects malformed values, plus
positive controls for `null` and a valid 40-hex SHA. No other assertion was
weakened, and no separate test was added, so the suite count is unchanged at 60.

**Failing-first / load-bearing control.** In a disposable copy under `C:` temp
(`package.json`, `ops/workflow/**`, `docs/plans/**`, `docs/handoffs/**`,
`.gitattributes`, `git init -b main`; the candidate-SHA test isolated with
`--test-name-pattern="candidate"` because a minimal copy has no commit graph for
the ENROLLPRO pins):

| Case | WF-C01 `git.candidateSha` | Test file | Result |
| --- | --- | --- | --- |
| a | `bcee9d0d92f43a55db4cbfa3a0a6306dd57d3275` | R2 (fixed) | exit 0 — 1 pass / 0 fail |
| b | `"NOT-A-SHA"` | R2 (fixed) | exit 1 — 0 pass / 1 fail at `seed.test.mjs:56` (predicate assertion) |
| c | `null` | R2 (fixed) | exit 0 — 1 pass / 0 fail |
| d | `bcee9d0d92f43a55db4cbfa3a0a6306dd57d3275` | pre-fix (committed at `bcee9d0d`) | exit 1 — 0 pass / 1 fail at `seed.test.mjs:45:14` (the audit failure line) |

New tip: product/test `42f41a21e58e7443b7314963fb9109a2a2aacb8f`; the branch tip
that carries this handoff is resolved with `git rev-parse HEAD`. The handoff was
re-pinned in the seed after its R2 content was final, the schema pin is
unchanged, and the generated register was regenerated after the seed edit.

## Known risks (all NON_BLOCKING for this packet)

1. The handoff cannot embed its own commit SHA (self-reference); the branch tip is resolved with `git rev-parse HEAD`, and the seed keeps `git.candidateSha` null only at candidate freeze. Once the planner records a candidate SHA at `INTEGRATION_READY`/`COMPLETE`, the register and `seed.test.mjs` (null-or-40-hex) both accept it.
2. `verified.artifacts` in a receipt is attested but not part of the staleness comparison; the compared set is `candidateSha`, `integrationSha`, `qaVerdict`, `auditorVerdict`, and `gates` as specified.
3. `--stream` without `--receipt` is accepted and has no effect (no usage error is defined for that combination).
4. When no Git repository is resolvable around the state file, artifact paths resolve against the state file's directory; this fallback is documented in `ops/workflow/README.md`.
5. The generated register is committed alongside — and does not modify — the historical prose register.
6. `.gitattributes` fixes future checkouts. A working tree that was already materialized as CRLF before this commit keeps CRLF bytes until it is re-materialized (`git checkout -- .` or `git reset --hard`); the integration worktree observed at `936aa439` needs that one-time re-materialization before the seed verifies there.

## Return

`REVIEW_REQUIRED` — no merge, rebase, amend, push, or self-acceptance performed.
