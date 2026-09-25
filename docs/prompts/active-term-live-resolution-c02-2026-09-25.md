# Cycle packet — `ACTIVE-TERM-LIVE-RESOLUTION-C02` (Stage 2, 2026-09-25)

MEDIUM server authority/transaction cycle. This is one bounded source cycle, not a deployment
packet. It folds the current `eb0e3038` acceptance closure into the cycle boundary but does not
change the live runtime.

## Cycle objective

Make generation and publication consume one pre-resolved authoritative active ordered term. The
term is resolved before entering any Serializable/advisory-locked transaction, then frozen into the
existing preflight, input-snapshot, and publication-identity contracts. A term change or missing
authority between resolution and persistence must fail closed with zero writes.

This closes the Stage-2 divergence left by `ACTIVE-TERM-LIVE-RESOLUTION-C01`: the availability
authority already resolves live-first, while generation/publication still read the persisted
snapshot. It also removes the in-transaction live-read temptation without weakening any typed
failure.

## Step 0 — release closure (already satisfied, no new action)

- `eb0e3038` is live and Q1/Q2/Q3/Q5/Q6/Q7 passed.
- Q4/Q6 evidence review is `ACCEPT_READY` 2/2/0/0; the planner-owned authenticated pair directly
  observed first `cached=false`, then `cached=true`, `ran=true`, `zeroWrite=true`.
- Lane C A1 is recorded at 2026-09-25 15:11Z: two tracked `/timetable` reloads returned readiness 200,
  no readiness slow-request/stall in the log window, and zero hybrid-scheduler lines. The direct
  `scheduler.cached` field on the A1 reload response remains optional; the server-log criterion is
  satisfied. Do not rerun Q4 or disturb the consumed cold cache.
- No migration, generation, publication, availability write, or deployment belongs to this cycle.

## In scope — one MEDIUM source candidate

1. **Generation entry:** in `triggerGenerationRun`, resolve the active ordered term through the
   existing `resolveActiveOrderedTermIndexLive` before the first transaction, alongside the existing
   active-year guard. Thread the resolved term/contract through `buildGenerationPreflight` and
   `revalidateGenerationPreflight`; do not re-read the network inside Serializable.
2. **Readiness entry:** `GET /:schoolId/:schoolYearId/readiness/diagnostic` must use the same
   pre-resolved term contract as the generation path. Readiness remains zero-write.
3. **Publication entry:** pre-resolve before `runSerializablePublicationTransaction` / the
   publication advisory lock, then pass the contract through the existing
   `buildPublishedIdentitySnapshot` seam and publication input-snapshot computation. No live fetch
   under the lock.
4. **Parity:** the generation-side availability read must consume the pre-resolved term, matching the
   availability write authority. Deliberately supersede the Stage-1 N1 divergence assertions with
   parity assertions; preserve the evidence and do not silently delete the old control.
5. **Snapshot invariant:** thread the pre-resolved term into
   `GenerationInputSnapshot.domains.availability.availabilityTermIndex` without changing its
   existing null/`-1` fail-closed semantics. A term change after pre-resolution must produce the
   existing typed stale/authority failure before any COMPLETED write, never Term 1.
6. **Fail-closed codes:** preserve `TERM_SCOPE_MISMATCH`, `TERM_AUTHORITY_UNRESOLVED`,
   `TERM_STRUCTURE_UNAVAILABLE`, `TERM_AUTHORITY_STALE`, `SOURCE_AUTHORITY_STALE`,
   `PUBLICATION_INPUTS_STALE`, `PUBLICATION_TERM_CONTRACT_INVALID`, and `ACTIVE_YEAR_DRIFT`.
   Add no `?? 1`, `|| 1`, or equivalent default.
7. **Tests:** add or extend only focused, committed, script-reachable tests. They must prove live-first
   resolution, persisted/date-derived fallback, missing-authority failure, generation/publication
   parity, readiness parity, no live fetch inside Serializable, snapshot consistency, and zero-write
   stale/negative controls. Reuse the existing disposable-PostgreSQL/source-freshness harness and
   its unreachable-EnrollPro tripwire; do not add a test file without a committed `package.json`
   entry point in the same commit.

## Explicitly out of scope

- Deployment, runtime restart, migration, term-cache apply, rollover sync, generation, publication,
  availability/Teaching Load writes, browser work, companion repositories, or live-data mutation.
- F1 frozen published-export term derivation: separate cycle because it is a published-artifact
  immutability rule, not live generation authority.
- F2 availability drift repair href (`/faculty` → `/faculty/concerns`): separate client-only cycle.
- F7 daily-tools placement: deliberately rejected on main.
- Changes to `resolveRequestedTermIndexFromContract` term-filter semantics or derived-demand rules.

## Required acceptance

The candidate is acceptable only when the executor records the exact base/candidate SHAs and changed
paths, and one fresh `atlas-qa` review of the immutable range returns `ACCEPT_READY` with
`passed == total`, `blocked: 0`, and `unperformed: 0`. Mandatory rows:

1. Generation pre-resolves live-first before the transaction and threads one term through preflight
   and snapshot calculation; a failing-first control proves the old persisted-only behavior.
2. Readiness uses the same pre-resolved term and remains zero-write.
3. Publication pre-resolves before the advisory/Serializable transaction and uses the existing
   identity-snapshot seam; no network call occurs under the lock.
4. Generation/availability term parity is proven; the superseded Stage-1 divergence assertion is
   retained as superseded evidence beside its replacement.
5. Missing/stale/changed term authority fails closed with the exact typed code and zero writes.
6. The in-transaction input snapshot remains consistent with the pre-resolved term; an interleave
   produces the existing stale failure, never Term 1.
7. Existing source-freshness, publication, active-term, and client term-gate preservation suites pass
   or reproduce only recorded pre-existing failures.
8. Server/client type-checks and production builds pass; every new test is reachable from a committed
   package script; `git diff --check` is clean.

## Worktree and handoff

- Executor worktree: `E:\ATLAS-worktrees\lane-a-active-term-c02`, branch
  `work/active-term-live-resolution-c02`, based on current `origin/main` product tip.
- Executor returns one immutable review candidate and one short handoff; no push or integration.
- Planner integrates only after fresh QA `ACCEPT_READY`; deployment remains a separate HIGH cycle.
