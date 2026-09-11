# TL-RR01 — Teaching Load Rollover Carry-Forward Progress

- Authoritative prompt: `docs/prompts/teaching-load-rollover-carry-forward-one-shot-tlrr01-2026-09-11.md`
- Branch: `work/teaching-load-carry-forward-tlrr01`
- Base SHA: `89440321260a9c4902cc20b7c5a642f47a74e35f` (`origin/main`)
- Risk: MEDIUM preview; HIGH apply (apply implemented, not invoked)
- Current phase: single one-shot, implementation complete; formal independent review pending

## Deliverables

| # | Task | Status | Evidence |
|---|---|---|---|
| 1 | Carry-forward service (preview + apply) | DONE | `atlas-server/src/services/teaching-load-carry-forward.service.ts` |
| 2 | Strict-body privileged router + mount | DONE | `atlas-server/src/routes/teaching-load-carry-forward.router.ts`, `atlas-server/src/app.ts` |
| 3 | Hermetic authority + mutant tests | DONE | `teaching-load-carry-forward-authority.test.ts` — 8/8 |
| 4 | Disposable PostgreSQL + mounted-route tests | DONE | `teaching-load-carry-forward-postgres.test.ts` — 60/60 |
| 5 | Client decision helpers + tests | DONE | `atlas-client/src/lib/teaching-load-carry-forward-helpers.ts`, helper test 11/11 |
| 6 | Year Setup preview UX (no apply action) | DONE | `CarryForwardReviewPanel.tsx`, `AdminYearSetup.tsx` |
| 7 | Isolated Playwright (1280x720 + 390x844) | DONE | `qa-artifacts/playwright/specs/teaching-load-carry-forward.spec.ts` — 5/5 |
| 8 | Focused docs + CHANGELOG | DONE | this file, executor handoff, `CHANGELOG.md`, runtime source map |

## Tracks

- `SOURCE_IMPLEMENTATION`: `GO`
- `LIVE_RUNTIME`: `BLOCKED_EXTERNAL` (deployment + explicit year-9 term sync not authorized)

## Decisive checks (this run)

| Check | Command | Result |
|---|---|---|
| Server typecheck | `tsc --noEmit -p atlas-server` | 0 errors |
| Server build | `npm --prefix atlas-server run build` | 0 errors, emits service/router |
| Server runtime | `node dist/server.js` + `GET /api/v1/health` | 200 `{status:ok}`, process stayed alive |
| Client typecheck | `tsc --noEmit -p atlas-client` | 0 errors |
| Client build | `npm --prefix atlas-client run build` | built |
| Hermetic + mutant | `tsx teaching-load-carry-forward-authority.test.ts` | 8/8 |
| PostgreSQL fixtures | `tsx teaching-load-carry-forward-postgres.test.ts` | 60/60 |
| Playwright isolated | `playwright test -c playwright.carry-forward.config.ts` | 5/5 |
| Client helpers | `tsx --test teaching-load-carry-forward-helpers.test.ts` | 11/11 |
| Existing TL reconciliation | `tsx teaching-load-reconciliation.test.ts` | 170/170 |
| Existing TL write authority | `tsx teaching-load-write-authority.test.ts` | 0 failures |
| Existing TL suggestion authority | `tsx teaching-load-suggestion-authority.test.ts` | 61/61 |
| Existing TL distribution/policy | distribution-plan, effective-workload-policy | 0 failures / 56/56 |
| Existing archived history | `tsx rr-ux01-rollover-history.test.ts` | 0 failures |
| Client TL suites | canonical-workload, distribution-ui, ownership-integrity, reconciliation-ui, rollover-ui-guardrails | 0 failures |

## Pre-existing failure (not introduced)

- `atlas-server/src/__tests__/teaching-load-reconciliation-route.test.ts`
  fails identically on the clean base `89440321` (reproduced in
  `D:/ATLAS-worktrees/integration-term-consume-c02`): `R4/R5` preview/apply return
  `409 DERIVED_DEMAND_BLOCKED` because the fixture predates DEMAND-C01 and does
  not seed a persisted term contract. Not caused by TL-RR01; left unchanged to
  avoid cross-stream scope.

## Mapping / reason matrix (fixture)

| Archived row | Resolution | Reason |
|---|---|---|
| MATH `Sampaguita`, owner active MATH | exact canonical section + qualified | `EXACT_CARRY` |
| ENG `Tandang Sora`, owner active ENG | exact canonical section + qualified | `EXACT_CARRY` |
| MATH `Narra`, target already owned | empty-only preserved | `ALREADY_OCCUPIED` |
| MATH `Rizal`, owner inactive | no active same-school owner | `MISSING_FACULTY` |
| MATH `DelPilar`, owner stale | no active same-school owner | `MISSING_FACULTY` |
| MATH `Mabini`, owner ENG dept | department mismatch | `UNQUALIFIED` |
| MATH `Bonifacio`, owner at 2400 cap | +240 exceeds hard cap | `CAP_BLOCKED` |
| MATH `Malvar`, no target section | canonical grade+program+name miss | `MISSING_SECTION` |
| MATH `Aguinaldo` x2 archived rows | duplicate canonical target pair | `AMBIGUOUS` |
| MATH `Balintawak`, two target sections | duplicate canonical target section | `AMBIGUOUS` |
| HG `Luna` (REFERENCE_ONLY) | not SCHEDULED_TEACHING demand | `NO_CURRENT_DEMAND` |
| OBS `Quezon` (inactive subject) | not current demand | `NO_CURRENT_DEMAND` |

## Transaction / replay evidence

- Concurrent apply: exactly two ownerships created; the losing transaction fails
  closed with `409 TRANSACTION_CONFLICT`; no duplicates.
- Stale target: injected ownership between preview and apply aborts with
  `TARGET_DRIFT` and zero writes.
- Replay: a repeat apply with the same fingerprint returns `replayed: true` with
  zero writes and no additional audit.
- Cardinality: exactly one `TEACHING_LOAD_CARRY_FORWARD` audit and one refreshed
  target cycle after apply; rollback identities list the created ownerships.
- Source immutability: all 13 archived ownership rows and 9 archived
  FacultySubject rows unchanged after apply.

## Remaining risks

- `BLOCKING`: independent formal review has not yet been performed.
- `NON_BLOCKING`: live preview requires the integrated runtime deployment and the
  explicit year-9 term snapshot sync; apply remains a separate HIGH approval.
- `NON_BLOCKING`: pre-existing `teaching-load-reconciliation-route` fixture
  failure on the base commit.

## Stop-eligibility

- Safe incomplete tasks: 0
- Required deferred/absent/collapsed tasks: 0
- Invalid/missing required reviews: formal independent review pending (expected
  at this boundary)
- Accessible read-only routes not probed: none in this stream's scope
