# TERM-CONSUME-C02 Progress Ledger

- Authoritative prompt: `docs/prompts/term-contract-atlas-consumption-c02-2026-09-11.md`
- Worktree: `D:/ATLAS-worktrees/term-consume-c02`
- Branch: `work/term-consume-c02`
- Base SHA: `e7121e75cb8bdb1118e09e3e3b261a2936b8ed48`
- Risk tier: `MEDIUM`
- Status: `REVIEW_REQUIRED`

## Tasks

| ID | Task | Status |
|----|------|--------|
| T1 | Split ordered structure from active-term resolution in `enrollpro-term-contract.service.ts` | DONE |
| T2 | Return verified structure + nullable active term for 200/409 `ACTIVE_TERM_UNRESOLVED` | DONE |
| T3 | Preserve structure on active-term network/HTTP failure; fail typed on contradiction | DONE |
| T4 | Remove passive cache writes; add `syncActiveTermContractAuthority` explicit writer | DONE |
| T5 | Wire explicit cache sync into actor-scoped `POST /runtime/rollover-sync/apply` | DONE |
| T6 | Keep verbose client contract null-safe for nullable `activeTerm` | DONE |
| T7 | Update existing term authority tests; add C02 state-matrix + mutant controls | DONE |
| T8 | Mounted-route zero-write instrumentation with rolled-back positive control | DONE |
| T9 | Rollover-path cache write + idempotency proof | DONE |
| T10 | TypeScript checks, build, built-server startup, diff check | DONE |
| T11 | Live read-only EnrollPro 200/409 matrix | DONE |
| T12 | Source map, ledger, changelog | DONE |

## Changed paths

- `atlas-server/src/services/enrollpro-term-contract.service.ts`
- `atlas-server/src/services/enrollpro-rollover.service.ts`
- `atlas-server/src/routes/runtime.router.ts`
- `atlas-server/src/__tests__/term-contract-atlas-consumption-c02.test.ts` (new)
- `atlas-server/src/__tests__/term-contract-cache-instrumentation.test.ts` (new)
- `atlas-server/src/__tests__/term-subject-authority.test.ts`
- `atlas-server/src/__tests__/term-subject-authority-http.test.ts`
- `atlas-client/src/types.ts`
- `atlas-client/src/pages/Subjects.tsx`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/progress/term-consume-c02-2026-09-11-progress.md` (new)
- `CHANGELOG.md`

## State matrix

| school-year | active-term | result | activeTerm | activeTermState |
|-------------|-------------|--------|------------|-----------------|
| 200 valid ordered | 200 in-order | `ok` | resolved identity | `RESOLVED` |
| 200 valid ordered | 409 `ACTIVE_TERM_UNRESOLVED` | `ok` | `null` | `UNRESOLVED` |
| 200 valid ordered | network failure | `ok` | `null` | `UNAVAILABLE` (`ENROLLPRO_ACTIVE_TERM_UNREACHABLE`, reachable false) |
| 200 valid ordered | HTTP non-409 (e.g. 500) | `ok` | `null` | `UNAVAILABLE` (`ENROLLPRO_ACTIVE_TERM_UNAVAILABLE`) |
| 200 valid ordered | 200 identity outside order | `ok: false` | — | `ACTIVE_TERM_OUTSIDE_CONTRACT` |
| 200 valid ordered | 200 wrong year/school | `ok: false` | — | `ACTIVE_TERM_YEAR_MISMATCH` / `SCHOOL_ID_MISMATCH` |
| invalid/mismatched/duplicate/out-of-order | any | `ok: false` | — | typed structure error |

## Evidence

- Unit (`npx tsx src/__tests__/term-contract-atlas-consumption-c02.test.ts`): 8 passed / 0 failed.
- Updated unit (`npx tsx src/__tests__/term-subject-authority.test.ts`): 13 passed / 0 failed.
- DB cache/zero-write (`npx tsx src/__tests__/term-contract-cache-instrumentation.test.ts`): 32 passed / 0 failed.
  - Mounted `GET /subjects/scheduling-authority` returns `VERIFIED_LIVE`, `activeTerm: null`, `UNRESOLVED`, exact identities, and zero Prisma writes; the ALS-injected recorder observed the mirror read.
  - Positive control: a rolled-back `enrollProSchoolYearMirror.update` was observed by the same recorder and left persisted state unchanged.
  - Explicit sync: exactly one scoped cache write; replay with the same semantic revision wrote nothing and preserved `termContractCachedAt`.
  - Rollover apply (`applyRolloverSync(..., { syncTermContract: true })`) persisted the exact ordered identities with a nullable active term; zero residue after cleanup.
- Gated mounted HTTP (`TERM_SUBJECT_HTTP_PROOF=1`, active-term 200): 1 passed / 0 failed; passive read left the cache columns NULL.
- Regression: `enrollpro-rollover-lifecycle-closure.test.ts` 208 passed / 0 failed; `enrollpro-rollover-automation.test.ts` 106 passed / 0 failed.
- TypeScript: `atlas-server` `tsc --noEmit` clean; `atlas-client` `tsc --noEmit` clean.
- Build: `npm run build` exit 0.
- Built-server startup: `node dist/server.js` with `ROLLOVER_AUTO_SYNC_ENABLED=false` on `PORT=5099`; `/api/v1/health` returned 200 and the process stayed alive.
- Live read-only EnrollPro probe (`ENROLLPRO_API=http://100.120.169.123:5002/api`): `/integration/v1/school-year` → 200 with `TRIMESTER` `T1`/`T2`/`T3` and inclusive dates; `/integration/v1/active-term` → 409 `{"error":{"code":"ACTIVE_TERM_UNRESOLVED"}}`. No EnrollPro files or data were changed; shared port 5001 was not touched.

## Decisions

- The semantic revision binds only the ordered structure so a reachable unresolved active term shares the cache identity of a resolved structure over the same terms.
- Cache writes are opt-in (`syncTermContract: true`) so existing service-direct rollover callers keep their call-count and network behavior unchanged.
- Degraded cached reads null the active term and mark it `UNAVAILABLE`, since the cached active term is not a current verification.

## Risks

- Live EnrollPro currently omits `schoolId` from `/school-year`; school binding relies on the exact mirror + requested year, as before. `BLOCKING` none.
- The rollover cache sync is best-effort: a term-structure verification failure is reported in `RolloverApplyResult.termContract` and does not fail the rollover. This is intentional and `NON_BLOCKING` for DEMAND-C01, which must read the explicit sync result.

## Next

- Independently accepted on the immutable `e7121e75...a55abf7e` range after
  8/8 C02 unit, 13/13 authority unit, 32/32 PostgreSQL cache/zero-write, server
  and client TypeScript, and source-path verification.
- Integrated additively onto the current `origin/main` boundary by the primary
  planner. The integration merge preserves the accepted candidate without
  rewriting it; deployment remains a separate service-lifecycle action.
