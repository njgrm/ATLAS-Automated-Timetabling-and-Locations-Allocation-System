# DEMAND-C01R — Derived Demand Authority Closure

## Objective

Correct the material authority gaps in DEMAND-C01 without rewriting its
reviewed commit. The corrected candidate must make derived demand complete per
applicable scope, transaction-consistent for write-authorizing consumers,
faithful to every verified ordered term, and part of generation/publication
freshness. It must also surface the same revision and typed blockers through the
real Timetable summary and preview paths.

This remains source and test work only. Do not reconcile Teaching Load,
generate, publish, deploy, restart port 5001, or mutate live data.

## Git and execution boundary

- Reuse `D:/ATLAS-worktrees/derived-demand-c01` on
  `work/derived-demand-c01`.
- Verify the worktree is clean and HEAD is exactly
  `eae274bf457946894e9ba63c4b601861e8abff03` before editing.
- Add correction commits; do not amend, rebase, merge, or push.
- Review the complete immutable range
  `ec7d54ed3b94db51fca9a8095a4be13f592b90e6...<new-candidate>`.
- Stay inside DEMAND-C01 production consumers, their shared generation-input
  snapshot/publication-freshness boundary, focused tests, the stream handoff,
  runtime source-of-truth map, progress ledger, and `CHANGELOG.md`.
- Do not edit Teaching Load suggestion/apply UI, Dashboard, migration guards,
  Curriculum Requirements UI, schema, or migrations. If a necessary fix falls
  outside this boundary, return `PLANNER_DECISION_REQUIRED` with the exact path
  and reason.

## Corrections required

### 1. Complete rotation authority per applicable scope

- Validate each rotation family independently for every active normalized
  grade/program scope to which it applies, not only as one global family.
- For a family present in a scope, require exactly one applicable member for
  every configured ordered term position `1..termCount`.
- Reject a missing position as typed `ROTATION_INCOMPLETE`.
- Reject duplicate and out-of-range positions with the existing typed
  blockers.
- Do not treat equal orders in disjoint grade/program scopes as collisions.
- Do not let a globally complete family hide an incomplete family within one
  applicable scope.

### 2. Preserve the complete ordered-term contract

- Never collapse a fourth or later verified term onto term 3. The current
  constructor mapping of all `modularOrder > 2` to `termIndex=3` is invalid.
- Prefer extending the scheduler's term representation and routing to preserve
  all verified ordered term indices admitted by EnrollPro, including
  `QUARTERS`.
- If the current scheduling core genuinely cannot support a verified term
  cardinality within this correction boundary, fail closed before scheduler
  invocation with a typed unsupported-term blocker. Silent truncation,
  clamping, cycling, or aliasing is forbidden.

### 3. Make the semantic revision complete

- Bind every value that changes derived demand identity, count, term placement,
  or scheduler projection into the canonical revision.
- At minimum include `periodLengthMinutes`; changing it must change the
  revision when it changes `sessionsPerWeek`.
- Bind Subject room semantics used by the scheduler projection, including the
  preferred room type and required features, or introduce an explicitly
  separate generation-input domain that binds them. Do not label a partial
  revision as the complete consumer source revision.
- Preserve stable canonical ordering and order-sensitive term identities.

### 4. Use transaction-consistent term authority

- A caller-supplied Prisma/DataContext client must govern every database read
  used to build and revalidate derived demand.
- Do not call a global-Prisma term resolver or perform a live EnrollPro network
  request from inside a Teaching Load or publication Serializable transaction.
- Passive reads may refresh or compare live term authority outside a write
  transaction, but any write-authorizing preview/apply contract must bind a
  persisted verified term snapshot/revision that can be re-read through the
  supplied transaction client.
- If live EnrollPro term authority and the persisted verified snapshot differ,
  fail closed and require the existing explicit rollover/sync action; do not
  repair it implicitly during reconciliation, generation, or publication.

### 5. Bind generation and publication freshness to derived authority

- Make the immutable generation input snapshot include the authoritative
  derived-demand revision or an equivalent complete semantic domain.
- Publication freshness must recompute and compare that authority for the exact
  actor school and active year.
- Remove legacy `SchoolYearTermConfig`, `SchoolYearOffering`, and
  `OfferingTermAssignment` from current-year authoritative freshness. A change
  only to those transition tables must not stale a derived-authority run.
- A change to ordered EnrollPro terms, an applicable Subject/section semantic
  field, period length, or derived demand must stale the run before publication.
- Preserve existing exact-run, actor-school, active-year, concurrency, and
  idempotency protections.

### 6. Fail closed through real Timetable consumers

- Timetable summary and preview must expose the same
  `derivedDemandRevision` used by Teaching Load and generation.
- Propagate typed derived-demand authority blockers. Do not turn blocked demand
  into an empty-looking summary or `DEMAND_LINE_NOT_FOUND`.
- `toSchedulerDemandOverride` must fail closed when a derived line cannot map
  to its section or Subject snapshot. It must not silently skip canonical
  lines.
- Assert exact projection parity: every accepted canonical timetable line is
  represented once in the scheduler override.

## Required failing-first and negative controls

Add tests that fail on the current candidate and pass only after the real
production path is corrected:

1. A valid three-term family missing position 2 returns
   `ROTATION_INCOMPLETE`.
2. Two disjoint grade/program scopes may reuse rotation order without a false
   duplicate; an incomplete or duplicate family inside one scope fails.
3. A four-term contract reaches the real constructor without mapping Q4 to Q3,
   or is rejected before constructor invocation by the explicit typed
   unsupported-term gate.
4. Changing period length changes the revision and expected session count;
   read-order permutations remain stable.
5. Changing room semantics changes the generation freshness domain.
6. A trap client proves a supplied transaction client is used for every
   persisted term-authority read and that the transactional path makes no
   global Prisma or network call.
7. Mutating only a legacy offering/term-config row does not stale a derived
   generation snapshot; changing current ordered terms or derived inputs does.
8. Mounted Timetable summary and preview return the canonical revision and
   typed authority blocker rather than an empty result or 404.
9. Missing section/Subject projection data returns a typed drift blocker and
   zero scheduler invocation; successful projection has exact line-count
   parity.
10. Replace DEMAND-C01's projection/count-only consumer proof with assertions
    through the actual Teaching Load reconciliation, Timetable summary/preview,
    generation assembly, and publication-freshness entry points.

Use disposable PostgreSQL fixtures where transaction behavior matters, with
exact cleanup and zero residue. Never touch the live school.

## Focused gates

- Derived-demand authority and consumer integration suites.
- Teaching Load reconciliation service and mounted-route suites.
- TT-C02 demand/insertion and shared candidate-domain suites.
- Term-contract C02 suites.
- Generation-input snapshot, passive Teaching Load, and publication-contract
  readiness suites affected by freshness wiring.
- Server `tsc --noEmit`, production build, committed-range
  `git diff --check`, and isolated built-server health/route mount with rollover
  automation disabled.

Do not run a live generation or publication. No client gate is needed unless a
client contract changes.

## Completion contract

Obtain one fresh independent changed-scope review after all corrections. Commit
the bounded candidate and return `REVIEW_REQUIRED`, never `GO`, with:

- original base and new candidate SHA;
- exact changed paths;
- RED-to-GREEN evidence for all ten controls;
- rotation-scope and ordered-term matrix;
- transaction-client and generation/publication freshness proof;
- real Timetable summary/preview blocker behavior;
- focused gate results and remaining risks;
- explicit confirmation of zero live reconciliation, generation, publication,
  deployment, restart, schema, migration, or companion-system mutation.
