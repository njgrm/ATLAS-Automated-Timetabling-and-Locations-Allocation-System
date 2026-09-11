# DEMAND-C01R2 — Ordered-Term Consumer Closure

## Objective

Complete DEMAND-C01 as one coherent cross-layer correction. DEMAND-C01R now
derives valid trimester and quarter demand, but downstream production consumers
still hard-code three terms. The corrected candidate must preserve the exact
verified EnrollPro ordered-term contract through generation reads, review,
revision, publication, public schedule reads, exports, and the timetable client.

This is source and test work only. Do not reconcile Teaching Load, generate a
live schedule, create a publication or revision, deploy, restart port 5001,
apply a migration, or mutate live data.

## Git and execution boundary

- Reuse `D:/ATLAS-worktrees/derived-demand-c01` on
  `work/derived-demand-c01`.
- Verify the worktree is clean and HEAD is exactly
  `422460fa98d6d2e686d134b996a029cf1c0b939b` before editing.
- Add correction commits only. Do not amend, rebase, merge, or push.
- Review the complete immutable range
  `ec7d54ed3b94db51fca9a8095a4be13f592b90e6...<new-candidate>`.
- The authorized boundary is the ordered-term production path: derived demand,
  generation snapshot/run reads and exports, schedule review/manual revision,
  publication validation and public reads, timetable term filters/types, their
  focused tests, the stream handoff/progress ledger, runtime source-of-truth
  map, and `CHANGELOG.md`.
- Do not edit Dashboard, Teaching Load suggestion/apply UI, migration guards,
  Curriculum Requirements UI, Prisma schema/migrations, authentication, or any
  companion repository. Stop with `PLANNER_DECISION_REQUIRED` if a required
  correction genuinely falls outside this boundary.

## Blocking QA evidence to reproduce first

The current candidate admits `QUARTERS` and produces `termIndex=4`, but:

- `publication-contract.service.ts` rejects published entries outside 1..3;
- `published-revision.service.ts` rejects Q4 changes and Q4 source entries;
- `generation.router.ts` and `published-schedule.router.ts` reject Q4 filters;
- published-schedule error guidance advertises only terms 1..3;
- timetable client types, state, toolbar options, and schedule pivots are
  limited to `1 | 2 | 3` and static `T1`/`T2`/`T3` labels;
- `generation-input-snapshot.service.ts` added the `derivedDemand` domain while
  retaining snapshot schema version 1, so the materially changed snapshot
  shape is not versioned honestly.

Add a failing-first source/behavior control for these defects before fixing
them. Do not treat unrelated three-step wizards, qualification tiers, or other
non-academic uses of 1..3 as term defects.

## Corrections required

### 1. One authoritative ordered-term model

- Carry the verified persisted EnrollPro term count, ordered identities, and
  display labels into every academic-term consumer.
- Accept every configured position in the current supported contract
  (`TRIMESTER` 1..3 and `QUARTERS` 1..4).
- Syntactic parsing may accept positive supported indices, but semantic
  validation must reject an index absent from the exact school/year contract.
  A trimester must reject 4; a quarter must accept 4.
- Never clamp, cycle, default, relabel, or silently drop a term.
- Centralize shared academic-term parsing/validation where doing so removes
  duplicate policy without widening unrelated behavior.

### 2. Generation and review reads

- Latest-run timetable, run timetable, violation, summary/export, and any
  equivalent term-filtered production routes must support configured Q4.
- `termIndex=active` must resolve through verified EnrollPro authority and must
  fail closed when the active term is unavailable or outside the ordered
  contract.
- Explicit numeric reads must continue to work when active-term resolution is
  unavailable, provided the requested index belongs to the verified structure.
- Preserve stable entry order and the existing memory-sensitive route/query
  shape; do not load or clone full run payloads unnecessarily.

### 3. Publication and revision authority

- Initial publication must accept Q4 entries only when the exact source run and
  verified school/year contract are quarterly; it must reject Q4 for a
  trimester with a typed zero-write error.
- Published-revision creation must apply the same exact-contract rule to source
  entries, previous values, and next values inside its existing Serializable,
  advisory-locked transaction.
- Public and privileged published-schedule filters must expose Q4 and preserve
  revision-effective stable ordering.
- Preserve all existing actor-school, active-year, exact-run, source-revision,
  idempotency, concurrency, freshness, hard-violation, and notification
  boundaries. This pass grants no live publication authority.

### 4. Timetable client contract and UX

- Replace academic `1 | 2 | 3` unions and static three-option lists with a
  bounded numeric term type driven by the verified runtime contract.
- Render exact ordered labels supplied by EnrollPro. Use `T1`/`T2`/etc. only as
  an explicit fail-closed fallback when no authoritative label exists; do not
  invent semester/quarter names.
- The timetable toolbar, review state, pivots, active-term selection, filters,
  exports, revision clients, and relevant dialogs must preserve and display Q4.
- On school/year/contract change, clear or repair an invalid selected term
  without dispatching a request for the wrong term.
- Keep the UI concise and compatible with the existing Simple/Advanced
  timetable workflow; do not add another term-configuration surface.

### 5. Version the generation snapshot honestly

- Bump the generation input snapshot schema because `derivedDemand` is now a
  required freshness domain.
- A run carrying the old schema must resolve to typed/structured `UNKNOWN` with
  `SNAPSHOT_VERSION_MISMATCH`; it must never compare as fresh under the new
  contract.
- A new snapshot must require all current domains, bind the exact ordered-term
  and derived-demand revision, and remain deterministic under read-order
  permutations.
- Preserve legacy-run readability; do not rewrite historical run rows.

## Required RED-to-GREEN controls

Use real service/route/client entry points, not helper-only assertions:

1. A quarterly derived-demand fixture produces Q1..Q4 without Q4 collapse.
2. Latest/run timetable and violation routes return Q4 entries for a quarterly
   contract; trimester Q4 and indices outside the contract fail typed.
3. Explicit numeric Q4 reads work while active-term resolution is unavailable;
   `active` still fails closed in that state.
4. Initial publication accepts a valid Q4 run in a disposable quarterly
   PostgreSQL fixture and rejects the same Q4 entry for a trimester with zero
   revision/audit/notification writes.
5. Published-revision create/change accepts Q4 for a quarter and rejects it for
   a trimester inside the real transaction, with zero writes on rejection.
6. Public published-schedule and term-aware export/read paths return Q4 with
   stable ordering and revision-effective values.
7. The timetable client renders all exact ordered labels, selects/filters Q4,
   marks active Q4, and clears an invalid filter after a contract/scope change.
8. A source guard proves no academic-term production path in this boundary
   retains a hard-coded three-term union/list/message. Include a positive
   control so unrelated 1..3 concepts are not falsely rewritten.
9. An old schema-v1 generation snapshot becomes
   `SNAPSHOT_VERSION_MISMATCH`; a new snapshot with the derived-demand domain
   compares fresh only when every bound domain matches.
10. Existing trimester behavior, public compatibility routes, publication
    concurrency/idempotency, and DEMAND-C01R per-scope rotation and projection
    parity remain green.

Use disposable PostgreSQL fixtures only where transaction semantics matter.
Verify exact cleanup and zero residue. Never use the live school as a fixture.

## Focused gates

- Derived-demand C01/C01R/C01R2 suites.
- Generation-input snapshot and term-filtered generation route suites.
- Publication contract, published revision, published schedule, and authorized
  disposable-PostgreSQL concurrency suites.
- Timetable term-filter/operator workflow client suites affected by the change.
- Teaching Load reconciliation regression only to prove the accepted derived
  contract did not regress; do not widen into suggestion/apply work.
- Server and client `tsc --noEmit`, production builds, complete-range
  `git diff --check`, and isolated built-server health/route mount with rollover
  automation disabled.

Do not run live generation or publication. If a disposable PostgreSQL suite
refuses a non-disposable target, provision or use an explicitly disposable
test database rather than weakening its target guard.

## Review and completion contract

After implementation, commission one fresh independent changed-scope review
over the complete base-to-candidate range. Correct any material finding with an
additional commit and obtain fresh QA for the enlarged range.

Return `REVIEW_REQUIRED`, never `GO`, with:

- original base, prior candidates, and new candidate SHA;
- exact changed paths;
- RED-to-GREEN evidence for all ten controls;
- quarterly-versus-trimester route, publication, revision, and client matrix;
- snapshot-version behavior;
- decisive tests and remaining risks;
- explicit zero-live-mutation, zero-generation, zero-publication,
  zero-deployment/restart, and no-companion-edit statement.
