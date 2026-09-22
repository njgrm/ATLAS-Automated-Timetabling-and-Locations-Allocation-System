# TEST-GATE-COVERAGE-C01 — server half (for the owner of `atlas-server/package.json`)

**From:** Lane A, 2026-09-22. **For:** Planner B (owner of `atlas-server/package.json`).
**Status: DELIVERED by Lane A as `f9c0f3cb`** (the operator authorised the custody transfer while
Planner B was on QA; the file returns to Planner B afterwards). Read the outcome in §"Outcome" below
before acting on the plan sections.

## Outcome (2026-09-22) — what shipped and what is still red

- **Orphans 80 → 0.** `test:server-suite` (28 files = the 27 hermetic + the new guard) and
  `test:server-db` (53 DB-backed). An inverse reachability guard now covers `atlas-server`.
- **`test:server-suite` is GREEN: 275/275.** The one rotten suite
  (`derived-demand-correction-c01r.test.ts`, controls 5/7/10) was fixed **test-only** — 3 added mock
  lines, zero assertion changes, zero product bytes.
- **`test:server-db` is RED — do not treat it as green.** Measured at review with the full runtime
  env against a fresh disposable database: **250 tests, 239 pass, 10 fail**. The failures are **real
  rot, not cross-suite interference**: `teaching-load-reconciliation.test.ts` fails **alone** against
  a fresh DB with `TypeError: Cannot read properties of undefined (reading 'facultyId')` at `:1032`.
- **Follow-up `TEST-GATE-COVERAGE-C01R`** owns making it green: characterise the prerequisites and/or
  run each file against its **own** fresh database (the likely design these suites were written for),
  then fix or retire each failure. Do **not** fix it by dropping files from the gate.

The plan sections below remain the recommended approach; they are kept for that follow-up.

## Why this exists

`AGENTS.md` §11: *"A test no gate runs is not evidence."* Lane A closed the **client** half
(`1ce9f4ad`): 55 orphaned client suites are now named by a committed `test:client-suite`, and
`gate-reachability.test.ts` gained an **inverse** assertion so a new client test file that no script
runs fails the guard.

**The server half is still open and is larger.** Measured 2026-09-22 at `1ce9f4ad`:

- `atlas-server` has **94 test files**; only **14** are named by a committed `test:*` script.
- **80 test files are unreachable** — nothing runs them, and nothing fails when they rot.

This is the **inverse** of your integrated `TEST-GATE-REACHABILITY-C01` (`f4462374`), which removed
32 scripts that pointed at **absent** files, and of the guard added in `0758075e`, which checks
scripts → files. Nothing checks files → scripts.

**Why it matters, concretely:** every cycle cites server suites as acceptance evidence — "the mounted
69/69 authority matrix", "disposable-PostgreSQL 61/61", "16/16 authority" — and none of those are
reproducible from the repo, because no committed script names them.

## The 80 unreachable files

```
src/__tests__/capability-override-mount.test.ts
src/__tests__/class-template-authority-c07.test.ts
src/__tests__/class-template-authority-c07-guard.test.ts
src/__tests__/companion-direct-federation-c04.test.ts
src/__tests__/curriculum-decision-candidates.test.ts
src/__tests__/curriculum-requirements-concurrency.test.ts
src/__tests__/curriculum-requirements-truth.test.ts
src/__tests__/dashboard-http-authority.test.ts
src/__tests__/dashboard-lifecycle-truth.test.ts
src/__tests__/dashboard-stale-readiness.test.ts
src/__tests__/department-authority-apply.test.ts
src/__tests__/department-authority-gates.test.ts
src/__tests__/derived-demand-authority.test.ts
src/__tests__/derived-demand-correction-c01r.test.ts
src/__tests__/derived-demand-correction-c01r2.test.ts
src/__tests__/enrollpro-rollover-automation.test.ts
src/__tests__/enrollpro-rollover-lifecycle-closure.test.ts
src/__tests__/export-presentation-postgres.test.ts
src/__tests__/export-presentation-route.test.ts
src/__tests__/export-presentation-schema-guard-c06b.test.ts
src/__tests__/faculty-sync-publication-cas-c01.test.ts
src/__tests__/generation-authority-realism-c07.test.ts
src/__tests__/generation-authority-realism-c07-availability.test.ts
src/__tests__/generation-authority-realism-c07-term-authority.test.ts
src/__tests__/generation-authority-realism-c07-trigger.test.ts
src/__tests__/generation-canonical-readiness-genc02.test.ts
src/__tests__/generation-passive-teaching-load.test.ts
src/__tests__/generation-production-trigger-genc02r1.test.ts
src/__tests__/generation-readiness-actor-scope-genc02r.test.ts
src/__tests__/generation-readiness-disposable-genc02r.test.ts
src/__tests__/generation-rotation-totals-genc02r1.test.ts
src/__tests__/generation-stakeholder-shape-genc02r.test.ts
src/__tests__/publication-contract-postgres-concurrency.test.ts
src/__tests__/publication-contract-readiness.test.ts
src/__tests__/published-immutability-c08.test.ts
src/__tests__/published-revision-authority-c12.test.ts
src/__tests__/rollover-graded-autonomy-c01.test.ts
src/__tests__/rr-ux01-rollover-history.test.ts
src/__tests__/runtime-router-actor-scope.test.ts
src/__tests__/section-route-authority-c03.test.ts
src/__tests__/slot-break-authority-c11.test.ts
src/__tests__/slot-break-authority-c11r.test.ts
src/__tests__/subject-catalog-truth.test.ts
src/__tests__/teaching-load-carry-forward-authority.test.ts
src/__tests__/teaching-load-carry-forward-postgres.test.ts
src/__tests__/teaching-load-distribution-plan.test.ts
src/__tests__/teaching-load-effective-workload-policy.test.ts
src/__tests__/teaching-load-overload-capacity-totals.test.ts
src/__tests__/teaching-load-reconciliation.test.ts
src/__tests__/teaching-load-reconciliation-route.test.ts
src/__tests__/teaching-load-suggestion-apply-parity.test.ts
src/__tests__/teaching-load-suggestion-authority.test.ts
src/__tests__/teaching-load-suggestion-authority-c03.test.ts
src/__tests__/teaching-load-suggestion-derived-demand-c03r2.test.ts
src/__tests__/teaching-load-summary-zero-write-route.test.ts
src/__tests__/teaching-load-write-authority.test.ts
src/__tests__/term-authority-status-rrtc01.test.ts
src/__tests__/term-cache-catchup-rrtc01.test.ts
src/__tests__/term-contract-atlas-consumption-c02.test.ts
src/__tests__/term-contract-cache-instrumentation.test.ts
src/__tests__/term-subject-authority.test.ts
src/__tests__/term-subject-authority-http.test.ts
src/__tests__/timetable-candidate-domain.test.ts
src/__tests__/timetable-output-export-c03.test.ts
src/__tests__/timetable-shape-diagnostic-c02.test.ts
src/__tests__/timetable-ttc02-insertion.test.ts
src/__tests__/timetable-warning-authority-c04.test.ts
src/__tests__/tt-output-c03r.test.ts
src/__tests__/tt-output-c03r3.test.ts
src/__tests__/tt-output-c03r3-placement-term.test.ts
src/__tests__/tt-output-c03r-route.test.ts
src/__tests__/tt-output-c05-beneficiary-parity.test.ts
src/__tests__/tt-output-c05r1-teacher-program.test.ts
src/__tests__/tt-source-freshness-capability-c04.test.ts
src/__tests__/tt-source-freshness-generation-c04.test.ts
src/__tests__/tt-source-freshness-quick-place-c04.test.ts
src/__tests__/tt-source-freshness-sync-pin-c04.test.ts
src/__tests__/tt-tl-authority-guard-c04.test.ts
src/__tests__/tt-tl-modules-contract.test.ts
src/__tests__/tt-warning-realism-c07a.test.ts
```

## Suggested approach (yours to change)

1. **Split hermetic from DB-backed.** Many of these need a database (`*-postgres`, `*-route`,
   `*-apply-parity`, the mounted authority matrices) and some need a disposable DB and env
   (`DATABASE_URL`, `JWT_SECRET`). One aggregate command cannot honestly run both, so gate them as
   **two** scripts — e.g. `test:server-suite` (hermetic) and `test:server-db` (DB-backed, documented
   prerequisites) — rather than pretending one command covers everything.
2. **Classify before gating.** For each file: *gate* (still valid) or *retire* (superseded — delete
   it, and list the deletions for the operator). Lane A's client sweep found all 55 orphans green
   (481 tests, 0 fail), so expect most server files to be live; do not assume rot.
3. **Add the inverse guard** to `atlas-server` beside the client one — assert every
   `src/**/*.test.ts` is named by at least one `test:*` script, failing with the list. Lane A's
   client implementation is at `atlas-client/src/lib/__tests__/gate-reachability.test.ts` (second
   `test(...)`); mirror it rather than inventing a new shape.
4. **Failing-first control:** add a temporary unreferenced test file, show the guard fails and names
   it, delete it, show it passes. Do not commit the probe.

## Boundary

Lane A did **not** touch `atlas-server/package.json` — it is yours. Lane A's change is `1ce9f4ad`
(`atlas-client/package.json` + the client guard only). If you would rather Lane A took this half,
say so and the file ownership can move; otherwise it is queued for you.
