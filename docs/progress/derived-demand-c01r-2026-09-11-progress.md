# DEMAND-C01R — Derived Demand Authority Closure — Progress Ledger

- Stream: `DEMAND-C01R`
- Worktree: `D:\ATLAS-worktrees\derived-demand-c01`
- Branch: `work/derived-demand-c01`
- Original base: `ec7d54ed3b94db51fca9a8095a4be13f592b90e6`
- Prior candidate (DEMAND-C01): `eae274bf457946894e9ba63c4b601861e8abff03`
- Correction base for this pass: `eae274bf...` (clean at start; no amend/rebase/merge/push)
- Risk tier: `MEDIUM` source; no schema/live mutation

## Authoritative prompt

`docs/prompts/derived-demand-authority-c01r-2026-09-11.md`

## Task status

| # | Correction | Status | Evidence |
|---|---|---|---|
| C1 | Per applicable-scope rotation completeness (`ROTATION_INCOMPLETE`), no cross-scope false duplicates | DONE | `derived-demand-correction-c01r.test.ts` controls 1–2 |
| C2 | Preserve ordered terms ≥4; no Q4→Q3 collapse | DONE | `schedule-constructor.ts` term model widened to `1..4`; control 3 reaches the real constructor with term 4 |
| C3 | Complete semantic revision (`periodLengthMinutes`, room semantics) | DONE | `derived-demand.service.ts` revision payload `DERIVED_DEMAND_V2`; controls 4–5 |
| C4 | Transaction-consistent persisted term authority via supplied client; no global/network in tx | DONE | loader reads `termContractCache` via supplied client; controls 6 |
| C5 | Generation/publication freshness bound to derived authority; legacy transition tables removed | DONE | `generation-input-snapshot.service.ts` `derivedDemand` domain; `publication-contract.service.ts` derived term gate; controls 5, 7, 10 |
| C6 | Timetable summary/preview expose revision + typed blockers; projection fail-closed + parity | DONE | `timetable-insertion.service.ts`, `derived-demand.service.ts`; controls 8–10 |
| T | Ten failing-first controls | DONE | `derived-demand-correction-c01r.test.ts` 10/10 |
| G | Focused gates | DONE | see below |

## Changed paths

- `atlas-server/src/services/derived-demand.service.ts`
- `atlas-server/src/services/generation-input-snapshot.service.ts`
- `atlas-server/src/services/publication-contract.service.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/timetable-insertion.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/constraint-validator.ts`
- `atlas-server/src/services/room-schedule.service.ts`
- `atlas-server/src/__tests__/derived-demand-correction-c01r.test.ts` (new)
- `atlas-server/src/__tests__/teaching-load-reconciliation.test.ts`
- `atlas-server/src/__tests__/publication-contract-readiness.test.ts`
- `atlas-server/src/__tests__/publication-contract-postgres-concurrency.test.ts`
- `docs/handoffs/derived-demand-c01-executor.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/progress/derived-demand-c01r-2026-09-11-progress.md`
- `CHANGELOG.md`

## Decisions

- "Incomplete rotation" = per active normalized grade/program scope, a family present in a scope must cover every configured ordered term `1..termCount`.
- The persisted EnrollPro term snapshot is read from `EnrollProSchoolYearMirror.termContractCache` through the supplied data-context client only. The stored order-sensitive `semanticRevision` is NOT trusted (PostgreSQL JSONB reorders keys); a canonical revision is recomputed.
- The scheduler term representation is extended to `1..4` (EnrollPro `TRIMESTER`/`QUARTERS`); out-of-range rotation orders are never clamped/aliased.
- Live year 9 has no persisted verified term snapshot, so live derived demand now fails closed with `TERM_STRUCTURE_UNAVAILABLE` until the explicit rollover/sync action persists it.

## Focused gate results

- `derived-demand-authority.test.ts` — pass 10 / fail 0
- `derived-demand-correction-c01r.test.ts` — pass 10 / fail 0
- `teaching-load-reconciliation.test.ts` — 170 passed / 0 failed, zero residue (disposable PG fixture)
- `timetable-ttc02-insertion.test.ts` — fail 0
- `term-subject-authority.test.ts` — fail 0
- `term-contract-atlas-consumption-c02.test.ts` — fail 0
- `timetable-candidate-domain.test.ts` — fail 0
- `generation-passive-teaching-load.test.ts` — PASS
- `publication-contract-readiness.test.ts` — exit 0
- `npx tsc --noEmit` — exit 0
- `npm run build` — exit 0
- Built server on port 5099, `ROLLOVER_AUTO_SYNC_ENABLED=false` — health 200, route mount 401, process alive
- `git diff --check` — exit 0

## Remaining risks

- `NON_BLOCKING`: `pre-generation-draft.service.ts` still calls legacy `computeDemand()` (successor `GEN-C02` scope).
- `NON_BLOCKING`: the upstream `enrollpro-term-contract.service.ts` `semanticRevisionFor`/`validateCachedContract` remain order-sensitive over JSONB; DEMAND-C01R consumes the persisted structure with a canonical revision instead of editing that TERM-CONSUME-C02 file.
- `BLOCKING`: none identified for source acceptance.

## DEMAND-C01R2 — Ordered-Term Consumer Closure (correction pass)

- Correction base: `422460fa98d6d2e686d134b996a029cf1c0b939b` (DEMAND-C01R candidate)
- Original base: `ec7d54ed3b94db51fca9a8095a4be13f592b90e6`
- Review range: `ec7d54ed3b94db51fca9a8095a4be13f592b90e6...<new-candidate>`
- Authoritative prompt: `docs/prompts/derived-demand-authority-c01r2-ordered-term-consumer-closure-2026-09-11.md`
- Risk tier: `MEDIUM` source; no schema/live mutation
- Status: `REVIEW_REQUIRED` (never `GO`)

### Corrections delivered

1. `academic-term.service.ts` centralizes ordered-term parsing/validation and the persisted verified contract loader (`loadVerifiedOrderedTermContract`) plus `resolveRequestedTermIndex` (explicit numeric works while active is unavailable; `active` fails closed).
2. Generation/review reads validate the requested term against the verified contract; exports resolve `active` through persisted verified authority; the live `fetchEnrollProActiveTerm` path was removed from workbook export.
3. Initial publication validates run entries against the verified contract term count (typed zero-write rejection); published revisions load the verified contract inside the Serializable transaction and validate source/previous/next term indices (typed zero-write rejection).
4. Public/privileged published-schedule reads expose Q4 and resolve `active` from the persisted verified contract.
5. `runtime/context` projects exact `orderedTerms`/`termFormat`/`termCount`; the timetable client uses a bounded numeric term type, exact labels, and repair-on-change.
6. Generation input snapshot bumped to `schemaVersion: 2` with required domains; schema-v1 resolves to `SNAPSHOT_VERSION_MISMATCH`, never fresh.

### RED-to-GREEN controls

- `atlas-server/src/__tests__/derived-demand-correction-c01r2.test.ts` — controls 1–10 (7 tests; controls 4/5/6 on a disposable quarterly PostgreSQL fixture with zero residue).
- `atlas-client/src/lib/__tests__/academic-term.test.ts` — control 7a–7d.

### Focused gate results

- `derived-demand-correction-c01r2.test.ts` — pass 7 / fail 0
- `derived-demand-authority.test.ts` — 10/0; `derived-demand-correction-c01r.test.ts` — 10/0
- `term-subject-authority.test.ts` — 13/0; `term-contract-atlas-consumption-c02.test.ts` — 8/0
- `term-contract-cache-instrumentation.test.ts` — 32/0
- `timetable-candidate-domain.test.ts` — 12/0; `timetable-ttc02-insertion.test.ts` — 17/0; `generation-passive-teaching-load.test.ts` — PASS
- `publication-contract-readiness.test.ts` — all checks passed
- `teaching-load-reconciliation.test.ts` — 170 passed / 0 failed, zero residue
- Client `academic-term.test.ts` — 4/0
- Server `tsc --noEmit` 0; client `tsc --noEmit` 0; server `npm run build` 0; client `npm run build` 0
- Built server port 5099 `ROLLOVER_AUTO_SYNC_ENABLED=false` — health 200, `/generation/1/9/runs/latest/violations?termIndex=4` 401 (mounted), process alive
- `git diff --check` — 0

### Remaining risks

- `NON_BLOCKING`: `publication-contract-postgres-concurrency.test.ts` requires an explicitly disposable database (`PUBC01R_DISPOSABLE_DATABASE`) which is not provisioned in this environment; its fixture was updated to a persisted quarterly contract cache and v2 snapshot but the suite was not run here. The target guard was NOT weakened.
- `NON_BLOCKING`: `pre-generation-draft.service.ts` still uses legacy `computeDemand()` (successor `GEN-C02`).
- `BLOCKING`: none identified for source acceptance.
