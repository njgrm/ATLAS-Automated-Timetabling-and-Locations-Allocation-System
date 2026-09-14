# TL-SUGGESTION-C03R2 — executor handoff

Status: `REVIEW_REQUIRED`

- Worktree: `D:\ATLAS-worktrees\tl-suggestion-c03r2`
- Branch: `work/tl-suggestion-c03r2`
- Base: `e0a10ebcd8efa0d4fa248b2c5948ed53a6c33c54` (current `origin/main`)
- Governing prompt: `docs/prompts/teaching-load-suggestion-derived-demand-c03r2-2026-09-13.md`

## Objective

Make canonical `buildDerivedDemand` the sole current-year pair authority for
Teaching Load suggestions, staffing need, over-cap move targets, and reviewed
proposal fingerprinting / apply-time revalidation; fail closed when ordered-term
or canonical authority is missing or changed.

## Changed paths

- `atlas-server/src/services/teaching-load-automation.service.ts` (canonical pair authority)
- `atlas-server/src/services/teaching-load-suggestion-proposal.service.ts` (tx-client revision binding)
- `atlas-server/src/__tests__/teaching-load-suggestion-derived-demand-c03r2.test.ts` (new)
- `atlas-server/src/__tests__/teaching-load-suggestion-authority-c03.test.ts` (additive fixture)
- `atlas-server/src/__tests__/teaching-load-suggestion-authority.test.ts` (additive disposable-PostgreSQL fixture correction)
- `atlas-server/src/__tests__/teaching-load-suggestion-apply-parity.test.ts` (additive fixture/dependency)
- `atlas-server/src/__tests__/teaching-load-write-authority.test.ts` (additive fixture/dependency)
- `docs/handoffs/tl-suggestion-c03r2-executor.md` (this handoff)

## Trace table

| Requirement | Production path | Negative control | Verification command | Status |
|---|---|---|---|---|
| Suggestions consume canonical derived demand, not a Cartesian subject x section product | `autoFill` work queue built from `deriveCanonicalDemand`/`buildDerivedDemand` pairs | grade-8-scoped subject + grade-7 section forms no pair; widening scope exposes it | `npx tsx src/__tests__/teaching-load-suggestion-derived-demand-c03r2.test.ts` | PASS |
| Only `SCHEDULED_TEACHING` demand; REFERENCE_ONLY creates no suggestion/staffing/move | `buildDerivedDemand` disposition filter + HG/ARAL code guard + over-cap REFERENCE_ONLY exclusion | reference-only `ROBOTICS` excluded; flipping disposition exposes hidden pairs | new C03R2 suite controls A | PASS |
| Respect ordered-term rotation without tripling/splitting | `deriveCanonicalDemand` rotation lanes | 1 ALL + 3 rotating members = 4 pairs / 6 lines; each member one term | new C03R2 suite control C | PASS |
| Carry revision/pair set into proposal; re-resolve in apply tx | `autoFill` result fields + `applyTeachingLoadSuggestionProposal` tx `resolveDerivedDemand` | tx-client disposition/scope/minutes/section/term change → `TEACHING_LOAD_PROPOSAL_STALE` | new C03R2 suite controls F/G/I | PASS |
| Fail closed on missing/stale/zero-active/ambiguous authority | `resolveSuggestionDerivedDemand` typed 409 | missing term cache and ambiguous active year | new C03R2 suite control E | PASS |
| Ownership outside canonical demand diagnosed and excluded | `outsideDemandOwnershipCount` + `canonicalOwnershipRows` capacity/minute filter | legacy reference-only ownership | new C03R2 suite control A | PASS |
| No global read/cache mutation escapes the supplied/tx client; preview zero-write | bound `buildDerivedDemand({ client })`; tx re-resolution | in-memory client throws on writes; tx view differs from global | new C03R2 suite controls A/G | PASS |
| Preserve qualification/caps/adviser/cross-dept/zero-load visibility | unchanged evaluator + new canonical pair source | zero-load FIL/ESP accepted | C03 64/64 + new C03R2 control D | PASS |
| Reviewed suites stay green | — | — | C03 64/64; parity 34/34; distribution 13/13; workload policy 56/56; write-authority PASS | PASS |

## Decisive evidence

- New C03R2 suite: 100/100 after Correction 3 (hermetic + one disposable `atlas_restore_drill_*` PostgreSQL fixture).
- Preserved C03 authority: 64/64. C03R apply parity: 34/34. Distribution: 13/13. Workload policy: 56/56. Write authority: PASS. `generation-passive-teaching-load`: PASS.
- Derived demand: `derived-demand-authority` 10/10; `derived-demand-correction-c01r` 10/10; `derived-demand-correction-c01r2` 7/7 (incl. disposable PostgreSQL).
- Server `tsc --noEmit` and production build: exit 0. Client `tsc --noEmit` and `vite build`: exit 0.
- Built-server smoke (isolated port 5392, `ROLLOVER_AUTO_SYNC_ENABLED=false`): `/api/v1/health` 200; `/api/v1/faculty-assignments/report/staffing-needs` unauthenticated 401. No shared 5001/5174 runtime touched.
- `git diff --check`: clean.
- Disposable PostgreSQL stale matrix: schedulingDisposition, program scope, weekly minutes, grade scope, section scope, and ordered-term structure each return `TEACHING_LOAD_PROPOSAL_STALE` with byte-identical ownership/FacultySubject/audit tables.

## production-shape parity

| Producer | Consumers | Conservation totals | Negative control | Result |
|---|---|---|---|---|
| `buildDerivedDemand` (canonical derived demand over the ordered-term contract and persisted inputs) | `autoFill` preview/staffing (mounted `POST /api/v1/faculty-assignments/auto-fill`, `.../report/staffing-needs`); `previewOrApplyOverCapRebalance` (mounted `POST .../coverage/rebalance-over-cap`); reviewed proposal preview + `applyTeachingLoadSuggestionProposal` (fingerprint/apply) | `subjectId:sectionExternalId` pair identities preserved end to end; ordered-term identities preserved (control C: one `ALL` subject + a 3-member rotating family = 4 pairs / 6 lines, each rotation member retaining its own term); suggestion and over-cap consumers consume the same canonical pair set with no dropped, duplicated, reassigned, or cross-scope pairs. E2: 8 canonical pairs / 1920 donor minutes with 1 outside-demand ownership excluded vs grade-scope mutant 9 pairs / 2160 minutes; C03R2 100/100 | transaction-client disposition flip between preview and apply (control G / over-cap E4) returns the typed stale result with zero writes; grade-scope mutant (control A/B/E2) proves the out-of-scope pair is excluded from capacity and can never enter `proposedMoves`; REFERENCE_ONLY/non-HG/non-ARAL subject produces zero suggestion/staffing/move | PASS (decisive reruns recorded in Decisive evidence above) |

## Mutant proofs

- Canonical pair filter: a REFERENCE_ONLY subject predicted by the old Cartesian construction produces zero rows; flipping it to SCHEDULED_TEACHING reintroduces the pairs (filter is load-bearing).
- Derived-demand revision binding: changing disposition/program/grade/minutes/section/term between preview and apply is rejected as stale; an unchanged control applies.
- Transaction-client revalidation: the tx view flips a subject to REFERENCE_ONLY while the global client does not; the apply is rejected as stale (a global-client read would have proceeded).

## Correction 1 — fixture restoration under canonical demand (additive)

Fresh independent QA returned `CORRECTION_REQUIRED` because the new mandatory
canonical-demand gate broke `teaching-load-suggestion-authority.test.ts`
(the TL-UX-C01R2 DB-backed suite). Reproduced failing-first on a disposable
`atlas_restore_drill_*` PostgreSQL database:

```
[FATAL] Error: Canonical derived demand is unavailable for this school year: TERM_STRUCTURE_UNAVAILABLE.
  code: 'DERIVED_DEMAND_UNAVAILABLE'
```

Fixture edit (only this file plus this handoff):

- added a persisted verified ordered-term `termContractCache` +
  `termContractCachedAt` to the fixture year mirror (TRIMESTER, T1/T2/T3);
- corrected the sections' internal EnrollPro grade key from `gradeLevelId: 7`
  (which `normalizeInternalGradeId` maps to Grade 9) to `gradeLevelId: 17`
  (current EnrollPro feed ID for Grade 7), matching the subjects' declared
  `gradeLevels: [7]`.

No assertion, expected count, or skip was changed. Post-fix on the same
disposable database: `RESULT: 61 passed, 0 failed`, zero residue. Regression
reruns: C03R2 74/74, C03 authority 64/64, apply parity 34/34.

The suite provisions its database through the ambient `DATABASE_URL`
(`createTestPrismaClient()` / `loadServerEnv()`); it does not create a database
itself. It was run only against a disposable `atlas_restore_drill_*` target that
was migrated, used, and dropped; the configured database was never the target.

## Correction 2 — bind over-cap redistribution to canonical demand (additive)

Fresh QA returned `CORRECTION_REQUIRED`: the sibling over-cap redistributor
(`previewOrApplyOverCapRebalance`, mounted at `POST /coverage/rebalance-over-cap`)
was left unbound. Capacity/move targets were built from raw ownerships filtered
only by HG/ARAL/REFERENCE_ONLY, and the function ran even when canonical demand
was unavailable (fail-open).

### Entry-point inventory (`teaching-load-automation.service.ts`)

| Exported entry point | Mounted consumer | Produces | Canonical binding |
|---|---|---|---|
| `autoFill` | `POST /auto-fill`, `POST /report/staffing-needs` | suggestion demand, staffing need, distribution plan | BOUND (Correction of round 1): work queue from `buildDerivedDemand` pairs; fail-closed `DERIVED_DEMAND_UNAVAILABLE` |
| `previewOrApplyOverCapRebalance` | `POST /coverage/rebalance-over-cap` | over-cap minutes/capacity, move targets, apply writes | BOUND (this correction): canonical pairs gate capacity and `proposedMoves`; tx-client revision revalidation; fail-closed |
| `previewOrApplyTeachingLoadSplitBrainReconcile` | `POST /integrity/reconcile-split-brain` | reconciliation counters, integrity/load diagnostics, repair preview | NOT APPLICABLE: consumes assignment/coverage summaries plus truth/stale/real-faculty reconciliation; it builds no `(subject, section)` demand pair set, no over-cap capacity, and no proposal |
| `resolveTeachingLoadQualification` | library (via coverage) | pure qualification tier/authority | NOT APPLICABLE: pure evaluator, no demand or capacity |
| `evaluateTeachingLoadReceiverQualification` | proposal apply | tx-bound receiver qualification | NOT APPLICABLE: pure/tx-bound evaluator, no demand |
| `resolveSuggestionDerivedDemand` | internal | canonical pair authority resolver | BOUND: the shared binding helper itself |
| `summarizeDistributionPlan`, `emptyDistributionPlan` | plan builders | pure summaries / empty plan | NOT APPLICABLE: pure |
| `__testComputeCreditedCapacityMinutes`, `__testEstimateCapacityLaneDeltaMinutes`, `__testResolveEffectiveCapMinutes`, `__testRankCoverageCandidates`, `__testAggregateSplitBrainCoverageTotals`, `__testResolveSplitBrainQuarantine` | tests | test-only helpers | NOT APPLICABLE: test-only |

Internal `buildTeachingLoadDistributionPlan` calls the (now bound) over-cap
service and is reached only from the bound `autoFill`. No other exported
entry point in this family produces suggestion demand, staffing need, over-cap
minutes, move targets, or proposals.

### Binding details

- `previewOrApplyOverCapRebalance` resolves `resolveSuggestionDerivedDemand`
  through `input.client` (ambient context for the mounted route) and fails closed
  with `DERIVED_DEMAND_UNAVAILABLE` before any capacity/move work when the
  ordered-term authority is unavailable.
- Ordinary over-cap minutes come from canonical-demand ownership only
  (`canonicalPairKeySetForRebalance`), keeping the HG/ARAL/REFERENCE_ONLY
  exclusions. Out-of-scope ownership is excluded from capacity and can never
  enter `proposedMoves`; it is counted (`outsideDemandOwnershipCount`) and, when
  it would otherwise be eligible, reported as a bounded
  `OUTSIDE_CANONICAL_DEMAND` rejection. Legacy receiver diagnostics (e.g.
  `PROGRAM_SCOPE_INCOMPATIBLE`) remain visible, so the reviewed C03 suite is
  unchanged.
- The apply branch persists writes. It re-resolves canonical demand inside a
  transaction opened with an explicit
  `{ isolationLevel: 'Serializable' }` option through the transaction client and
  throws typed `TEACHING_LOAD_REBALANCE_STALE` (409) before any write when the
  revision changed. Correction 3 added the explicit option (the earlier commit
  claimed Serializable but omitted it, so the revalidation ran at the
  read-committed default).
- `OverCapRebalanceResult` gained additive optional fields
  (`derivedDemandRevision`, `canonicalDemandPairCount`,
  `outsideDemandOwnershipCount`); no existing field changed.

### Over-cap controls and results

- E2 canonical binding (hermetic, real service): 8 canonical pairs, 1
  outside-demand ownership, donor teaching minutes 1920 (not 2160), no
  `proposedMoves` entry for the out-of-scope pair, zero writes. Mutant (grade
  scope widened): 9 pairs, 0 outside, 2160 minutes, and the pair is proposed.
- E3 absent authority (real mounted route): `POST /coverage/rebalance-over-cap`
  → 409 `DERIVED_DEMAND_UNAVAILABLE`, zero writes.
- E4 apply revalidation (real service + tx client): unchanged control applies
  (≥1 move, exactly one audit, exactly the proposed ownerships reassigned); a
  transaction-view canonical change → `TEACHING_LOAD_REBALANCE_STALE` with zero
  ownership/FacultySubject/cycle/audit writes.

## Correction 3 — make over-cap apply revalidation serializable (additive)

Fresh QA returned `CORRECTION_REQUIRED`: the over-cap apply claimed a
Serializable transaction but called `db().$transaction(...)` with no options, so
the canonical-revision re-read ran at the PostgreSQL default
(`read committed`). The freshness claim was false as written.

### Isolation-claim audit (every `$transaction` in the two services)

| Transaction | Service / mount | Isolation option | Status |
|---|---|---|---|
| over-cap apply + canonical revalidation | `teaching-load-automation.service.ts` → `POST /coverage/rebalance-over-cap` | **was absent** (read committed) | **FIXED** → `{ isolationLevel: 'Serializable' }` |
| proposal create | `teaching-load-suggestion-proposal.service.ts` (`:229`→`:277`) | `{ isolationLevel: 'Serializable' }` | OK, unchanged |
| proposal apply + canonical revalidation | `teaching-load-suggestion-proposal.service.ts` (`:360`→`:820`) | `{ isolationLevel: 'Serializable' }` | OK, unchanged |
| proposal cancel | `teaching-load-suggestion-proposal.service.ts` (`:867`→`:888`) | `{ isolationLevel: 'Serializable' }` | OK, unchanged |

No other `$transaction` exists in either service. No comment in either service
claims a Serializable/revision-freshness guarantee that the code does not pass.

Serialization-conflict behavior is intentionally consistent with the proposal
apply: neither service installs a retry loop; a genuine Prisma `P2034`/SQLSTATE
`40001` conflict propagates as an error rather than being silently retried. The
mandated outcome is unchanged and is what the tests exercise: a canonical change
between preview and apply is detected by the in-transaction revision comparison
and yields typed `TEACHING_LOAD_REBALANCE_STALE` (over-cap) with zero
ownership/FacultySubject/cycle/audit writes.

### Failing-first and pass evidence

- Pre-fix code inspection: `445b5a99` had
  `await db().$transaction(async (tx) => {` with no options argument.
- Real-engine fact (disposable `atlas_restore_drill_*`): a transaction opened
  with no options reports `SHOW transaction_isolation = 'read committed'`; a
  transaction opened with `{ isolationLevel: 'Serializable' }` reports
  `'serializable'`. Both are asserted inside the C03R2 disposable control.
- Real service assertion: the over-cap apply `$transaction` call records
  `isolationLevel === 'Serializable'` on both the positive and the stale path.
- The six-case disposable stale matrix was rerun green after the change.

## Known risks / residuals

1. The reviewed C03 authority and C03R apply-parity suites required additive fixture updates (term snapshot, internal grade key, pinned derived authority) because canonical demand is now mandatory. Assertion counts and semantics are unchanged (64/64, 34/34).
2. `teaching-load-write-authority.test.ts` also required additive fixture/dependency updates; all its assertions remain.
3. `teaching-load-reconciliation.test.ts` Part B uses the configured-database fixture pattern and was not run under this packet's "never write the configured database" rule. Its hermetic A1–A14 controls pass; its Part B fixture failures are in a service graph untouched by this candidate (`teaching-load-reconciliation.service.ts` does not import the changed automation/proposal services). `teaching-load-suggestion-authority.test.ts` Part B is now runnable and green against a disposable database (Correction 1).
4. `isProgramScopeCompatible` was removed from the automation service because its only caller was the deleted Cartesian construction; the equivalent canonical scope check lives in `derived-demand.service.ts` / `qualification-evaluator.service.ts`.

## Mutation boundary

Source and focused tests only. No push, merge, rebase, amend, migration, live
database write, generation, publication, deployment, login, or shared-runtime
action was performed.

## Correction 4 — make preliminary stale-ownership handling zero-write (C03R3 additive)

Wave-completion review found that `previewOrApplyOverCapRebalance` called
`previewOrApplyStaleOwnershipReconcile` with `previewOnly: !apply` before its
later Serializable transaction. An apply could therefore commit stale-row
deletion, `FacultySubject` update/deletion, and `TeachingLoadCycle` refresh,
then discover a changed canonical revision and return
`TEACHING_LOAD_REBALANCE_STALE` after those earlier writes.

The preliminary reconcile is now always preview-only. If an apply observes one
or more stale current-year ownership pairs, it fails with HTTP 409 code
`TEACHING_LOAD_STALE_OWNERSHIP_RECONCILIATION_REQUIRED` before opening the
rebalance transaction. The separate reconciliation endpoint remains the only
place that applies stale-ownership cleanup; positive over-cap apply still uses
the explicit `{ isolationLevel: 'Serializable' }` transaction.

| C03R3 requirement | Production path | Negative control | Verification | Status |
|---|---|---|---|---|
| Preliminary stale-ownership handling cannot write before freshness revalidation | `previewOrApplyOverCapRebalance` → preview-only `previewOrApplyStaleOwnershipReconcile` → typed 409 before `$transaction` | Run the real stale reconcile in apply mode first, then trigger the transaction-only canonical revision change | C03R2 E5; byte comparisons across ownership, `FacultySubject`, cycle, audit, and notification buffer | PASS |
| Positive over-cap apply retains explicit Serializable isolation | `previewOrApplyOverCapRebalance` apply `$transaction` | Observe the transaction options on both matching and stale canonical revisions | C03R2 E4 | PASS |

Load-bearing E5 coverage creates both stale ownership and a transaction-only
canonical disposition interleave, invokes the real over-cap apply service, and
asserts the typed reconciliation-required failure plus byte-identical ownership,
`FacultySubject`, `TeachingLoadCycle`, audit, and production notification-buffer
state.
It also asserts that no apply transaction starts. Its negative control runs the
real apply-capable stale reconcile first (the pre-fix preliminary behavior),
then reaches `TEACHING_LOAD_REBALANCE_STALE`; the protected byte-identity check
fails because reconciliation writes already committed.

### C03R3 focused evidence

- C03R2 derived-demand/atomicity suite: `109/109` (includes positive
  Serializable option observation, the E5 zero-write gate, the pre-fix mutant,
  and its own disposable PostgreSQL isolation/apply checks).
- C03 authority: `64/64`.
- Apply parity: `34/34`.
- Distribution plan: `13/13`.
- Effective workload policy: `56/56`.
- Write authority: suite `PASS` (the suite does not publish an assertion count).
- Omitted C03R2 DB authority suite now inventoried above and rerun: `61/61`
  against disposable database `atlas_restore_drill_20260914_c03r30f7097ca`;
  the configured shared database `atlas_recovery_clean_rebuild_20260905` was
  read only, and the disposable database was dropped with residue count `0`.

No live/shared database write, migration/schema apply, deployment, login,
shared runtime, Teaching Load apply, generation, publication, or external
repository action was performed. The only database mutations were in uniquely
named disposable databases created by the existing isolated fixtures and
dropped with zero residue.
