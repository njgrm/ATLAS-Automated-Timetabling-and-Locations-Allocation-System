# WF-SEED-INVENTORY-C02 — executor handoff

- Stream: `WF-SEED-INVENTORY-C02`
- Role: `EXECUTOR` (reasoning variant `high`); no self-approval
- Worktree: `E:/ATLAS-worktrees/wf-seed-inventory-c02`
- Branch: `work/wf-seed-inventory-c02`
- Accepted base: `24ba85a850470f2efe88c82913a9ea83415dba24`
- Candidate: the conventional commit containing this file (single commit, same branch)
- Governing packet: `docs/prompts/wf-seed-inventory-c02-2026-09-16.md`
- Verdict: `REVIEW_REQUIRED`

## 1. Objective and change

`ops/workflow/__tests__/seed.test.mjs` previously pinned the complete evolving
production stream inventory as an exact-equality list (`SEED_STREAM_IDS`), so
every real `create-stream` registration made `npm run workflow:test` red until
unrelated test source was edited by hand. This candidate replaces that pin with a
generic contract driven by the unmodified production verifier, and adds a
failing-first regression that runs the real `create-stream` operation against a
Git-ignored clone of the committed registry.

No production source changed. The correction is confined to the seed test plus
this handoff.

Registry drift observed at the accepted base: the packet was validated against
`14e6e919` / revision 137 / 21 streams. The accepted base `24ba85a8` is revision
**138 / 22 streams** (the base added `WF-SEED-INVENTORY-C02`). All matrix families
were re-validated against that registry; no family had an empty applicable set.

## 2. Immutable boundary

- `git diff --name-only <base>..<candidate>`:

```text
docs/handoffs/wf-seed-inventory-c02-executor.md
ops/workflow/__tests__/seed.test.mjs
```

- `git status --porcelain=v2`: empty (after `git update-index --refresh`).
- No temp fixtures remain; the probe fixture is created under a Git-ignored
  `docs/.wf-seed-inventory-*` path and removed by the test's `test.after` hook.
- No transition was run against `docs/plans/atlas-delivery-cycles.json`; no
  receipt, register, generated projection, push, install, or live action occurred.
- Forbidden paths (machine register + projection, prose register, `ops/workflow/lib/**`,
  `ops/workflow/schema/**`, `ops/workflow/*.mjs`, other test files, `ops/runtime/**`,
  `AGENTS.md`, `CHANGELOG.md`, `.gitattributes`, `package.json`, all
  `atlas-client/**` / `atlas-server/**` / `prisma/**`) are untouched.

## 3. G1 failing-first baseline (captured before any edit)

- Command: `node --test "ops/workflow/__tests__/*.test.mjs"` (equivalent to
  `npm run workflow:test`)
- Result: exit `1`; `tests 281 / pass 278 / fail 3`
- The three failures, all in `ops/workflow/__tests__/seed.test.mjs`:
  1. `:50` — `the committed seed state verifies cleanly with exit code 0` →
     `AssertionError: 22 !== 17` (the fixed count pin at `:55`)
  2. `:129` — `the seed declares the exact expected stream inventory with
     null-or-committed candidate SHAs` → inventory drift, `extra: [the four
     streams added after the retirement commit, plus WF-SEED-INVENTORY-C02]`
  3. `:240` — `the seed stream-inventory pin detects a stale registry` →
     `the committed registry must satisfy the pin first`

## 4. Gate matrix (MANDATORY_SOURCE = 18, MANDATORY_LIVE = 0, DEFERRED_EXTERNAL = 0)

| # | Gate | Exact command | Observed result | Status |
| --- | --- | --- | --- | --- |
| G1 | Failing-first baseline before any edit | `node --test "ops/workflow/__tests__/*.test.mjs"` | exit 1; tests 281 / pass 278 / fail 3; all three failures are the inventory pin (`:50`, `:129`, `:240`) | PASS |
| G2 | Post-correction suite green, no test removed | `npm run workflow:test` | exit 0; tests 287 / pass 287 / fail 0 (`duration_ms` 65 918 vs base 66 660) | PASS |
| G3 | Exact-equality pin retired; no quoted non-core/non-retired id in source | §A retired predicate + §C guard test inside G2 run | both tests green; §C checks 5 non-exempt ids | PASS |
| G4 | Core baseline subset + removal control | §B test inside G2 run | `coreInventoryMismatch(doc) === null`; removal control reports `missing: [removed]` | PASS |
| G5 | Duplicate stream id detected | §D family 1 inside G2 run | `DUPLICATE_STREAM_ID @ streams[n+i].id` for all 22 streams | PASS |
| G6 | Malformed candidate SHA rejected for every stream | §D family 2 | `SCHEMA_PATTERN @ $.streams[i].git.candidateSha` for all 22 | PASS |
| G7 | Missing `git.remoteObservation` rejected for every stream | §D family 3 | `SCHEMA_REQUIRED @ $.streams[i].git` for all 22 | PASS |
| G8 | Missing required lifecycle field rejected | §D family 4 + §F third mutant | `SCHEMA_REQUIRED @ $.streams[i]` for all 22; `SCHEMA_REQUIRED` for `owners`/`nextAction` on the created record | PASS |
| G9 | Invalid state value and gate arithmetic rejected | §D families 5–6 | `SCHEMA_ENUM @ $.streams[i].state` (22); `GATES_ARITHMETIC @ streams[i].gates` (22) | PASS |
| G10 | Invalid state/audit/receipt combinations rejected | §D families 7–9 | `COMPLETE_MISSING_QA @ streams[i].review.qaVerdict` (22); `COMPLETE_MISSING_AUDIT @ streams[i].review` (22); `COMPLETE_MISSING_RECEIPT @ streams[i].closure.receipt` (22) | PASS |
| G11 | Stale/active lease rejected | §D families 10–11 | `COMPLETE_WITH_LIVE_LEASE @ leases[i].state` (22); `PLANNED_WITH_LIVE_LEASE @ streams[i].state` (22) | PASS |
| G12 | Git identity semantics rejected | §D families 12–13 | `GIT_SHA_UNKNOWN @ streams[i].git` (17 applicable); `RECEIPT_INVALID @ streams[i].closure.receipt` (13 applicable) | PASS |
| G13 | Remote observation + HIGH dependency observation states | §D families 14–17 | `REMOTE_OBSERVATION_INVALID @ streams[i].git.remoteObservation.sha` (19); `HIGH_DEPENDENCY_MISSING @ streams[i].approval.requiredObservationIds` (22); `HIGH_DEPENDENCY_UNHEALTHY @ streams[i].observations` (22); `HIGH_DEPENDENCY_EXPIRED @ streams[i].observations` (22) | PASS |
| G14 | Generated-register parity, LF/notice, divergence control | §G tests inside G2 run | CLI render equals committed bytes; ends with LF, no CRLF, carries the do-not-edit notice; a mutated `nextAction` changes the render | PASS |
| G15 | Real `create-stream` on the clone keeps verify/render green, no source edit, committed register byte-unchanged | §E test inside G2 run | transition `status=ok`, 1 record appended, revision +1, prior records byte-identical, clone `verify` `errors []`, CLI render == in-process render and names the created id, committed generated register `deepEqual` before/after | PASS |
| G16 | Negative mutants on the newly created stream | §F test inside G2 run | `SCHEMA_PATTERN`, `DUPLICATE_STREAM_ID`, `SCHEMA_REQUIRED` ×2 at the created stream's own paths | PASS |
| G17 | Contract assertions derive from the shipped schema | `ops/workflow/schema/cycle-state.schema.json` `properties.contractVersion.const` compared in the §G contract test | `doc.contractVersion` equals the shipped constant; `registry.revision` positive integer; `leases` array | PASS |
| G18 | Scope and hygiene | `npm run workflow:render:check`; `npm run workflow:verify -- --state docs/plans/atlas-delivery-cycles.json`; `git diff --check`; `git diff --name-only <base>..HEAD` | render:check exit 0 `status ok`; verify exit 0 `status ok` 22 streams / 0 errors; `diff --check` exit 0; exactly the two owned paths | PASS |

Gate-plan tally: MANDATORY_SOURCE 18 / PASS 18; MANDATORY_LIVE 0; DEFERRED_EXTERNAL 0.

`npm run workflow:verify` **without arguments** exits 2 with
`USAGE_MISSING_STATE`: `verify-cycle.mjs` never falls back to a default state file
by design and `package.json` (forbidden) defines the script without `--state`.
The canonical invocation with `--state docs/plans/atlas-delivery-cycles.json`
exits 0, so G18 is recorded PASS with that command plus the no-argument result
disclosed. This is pre-existing, not introduced here.

## 5. Removed / renamed assertion → replacement mapping

Every assertion removed from the seed test is mapped below; nothing was dropped
silently. Test count grew 6 → 12 and the suite count grew 281 → 287.

Retired test `the seed stream-inventory pin detects a stale registry` (`:240`):

- `seedInventoryMismatch(doc) === null` pre-check → the inverse is now the
  contract: §A control asserts `retiredExactInventoryMismatch(doc)` is truthy.
- `stale.streams.length === 11` count literal → replaced by the §D generic
  per-stream matrix (structural corruption is detected without a count literal).
- `mismatch` truthy → replaced by the §A removal control (`controlMismatch` truthy).
- `mismatch.missing` deep-equals the six added ids → replaced by the §A removal
  control (`controlMismatch.missing` deep-equals `[removed]`).
- `mismatch.extra` deep-equals `[]` → replaced by the §A live-registry assertion
  `mismatch.extra.length > 0`.
- extra-stream control (`extraMismatch.extra` deep-equals `["UNREGISTERED-1"]`)
  → replaced by §D family 1 (`DUPLICATE_STREAM_ID`, all streams) and §F mutant 2
  (`DUPLICATE_STREAM_ID` on the created record).

Retired assertions inside `the seed declares the exact expected stream inventory ...` (`:129`):

- `doc.contractVersion === "1.2.0"` (literal) → replaced by the schema-derived
  `schema.properties.contractVersion.const` comparison (§G contract test).
- `seedInventoryMismatch(doc) === null` (exact-equality pin) → replaced by §B core
  subset + §D generic matrix + §A failing-first control.
- `doc.streams.length === SEED_STREAM_IDS.length` (fixed count pin) → replaced by
  the derived `summary.streams.total === doc.streams.length` in the verifying test.

Retired assertion inside `the committed seed state verifies cleanly with exit code 0` (`:50`):

- `summary.streams.total === SEED_STREAM_IDS.length` → replaced by the derived
  `=== doc.streams.length`.

Preserved (corrected form): `contractVersion` (schema-derived), `registry.revision`
integer ≥ 1, `leases` array, per-stream legacy `remoteSha` absence, per-stream
`remoteObservation` presence, the `isNullOrCommittedSha` per-stream invariant, all
nine malformed-SHA negative controls plus the two positive controls, the
generated-register byte parity with LF/notice checks, the distinct-file check, the
WF-SEED-PIN-C01 evidence-vs-deployed-release regression, and the §E.6 failing-first
structure.

Strengthened (new coverage): §B core subset + removal control, §C quoted-literal
guard, §D 17-family generic mutation matrix with per-stream exact `(code, path)`
assertions and a vacuity guard, §E real-`create-stream` clone regression with the
absolute temp `--render`, a typed-`LOCK_CONTENTION`-only bounded retry, and the
committed-register byte-unchanged assertion, §F three mutants on the created
stream, and the §G render divergence control.

## 6. New test names and measured durations

Measured with `node --test ops/workflow/__tests__/seed.test.mjs` (file isolated;
file wall 25 782 ms vs 9 649 ms for the pre-correction file):

| Test | ms |
| --- | --- |
| the committed seed state verifies cleanly with exit code 0 (modified) | 6 112 |
| the committed generated register matches the renderer output byte-for-byte (modified) | 5 665 |
| the generated register is a distinct file from the historical prose register | 0.3 |
| the registry contract version, revision, and leases derive from the shipped schema (new) | 4.4 |
| every registered stream carries a null-or-committed candidate SHA and no legacy remoteSha (renamed) | 1.9 |
| an evidence candidate may differ from the deployed product release | 3.4 |
| the immutable core stream baseline is a subset of the registry and its predicate detects removal (new §B) | 3.0 |
| the retired exact-inventory predicate rejects the committed registry with an observable removal control (new §A) | 3.5 |
| no non-core, non-retired registered stream id is enumerated as a quoted literal in this test source (new §C) | 3.4 |
| every registered stream is rejected at its own path for each contract invariant family (new §D) | 7 111 |
| a stream created through the real create-stream operation keeps verify and render green with no source edit (new §E) | 6 458 |
| negative mutants on the newly created stream are rejected at the created stream's own path (new §F) | 52 |

Added wall time for the new tests on this host ≈ 13.6 s, above the packet's ~6–7 s
planner estimate. Full-suite wall time is unchanged (`npm run workflow:test`
65 918 ms vs 66 660 ms base) because the new seed work overlaps other files.

## 7. Residual risks

- NON_BLOCKING — added isolated seed-file wall time ≈ 13.6 s exceeds the packet's
  ~10 s guideline on this host, while full-suite wall time is unchanged. The §D
  matrix pays one full production-verifier Git-binding pass over 22 streams through
  one shared `createGitMemo()`, and §E.4 requires one full `render-register.mjs`
  subprocess verify; both are mandated by the packet. Measured host cost:
  `git merge-base --is-ancestor` ≈ 45 ms and `git diff --name-only` ≈ 54 ms.
- NON_BLOCKING — `npm run workflow:verify` without arguments exits 2
  (`USAGE_MISSING_STATE`); the npm script omits `--state` and `package.json` is
  outside the owned paths. The canonical `--state docs/plans/atlas-delivery-cycles.json`
  invocation exits 0.
- NON_BLOCKING — §D's `tampered closure receipt` family requires
  `state === "COMPLETE"`, matching the verifier, which validates a closure receipt
  only for COMPLETE streams. All 13 receipt-bearing streams are COMPLETE at this
  base, so the applicable set is unchanged; the predicate is additionally
  future-robust.
- NON_BLOCKING — the `PLANNED_WITH_LIVE_LEASE` family sets every stream PLANNED,
  so the verifier's `PLANNED_WITH_DIRTY_WORKTREE` check runs for the six streams
  whose worktree path currently exists (extra errors only; the expected pair is
  asserted exactly).
- NON_BLOCKING — §E's in-process `runTransition` acquires the real
  repository-common-dir workflow lock and retries only on the typed
  `LOCK_CONTENTION` (≤ 5 attempts, ~250 ms apart). A concurrent planner holding
  the lock for > ~1 s could exhaust the retries and make that test fail closed
  without mutating anything; it reads the registry and never writes it.

No BLOCKING residual.

## 8. Return

`REVIEW_REQUIRED` — this handoff is committed with the candidate at
`docs/handoffs/wf-seed-inventory-c02-executor.md`. Do not self-approve, merge,
push, or transition any state.
