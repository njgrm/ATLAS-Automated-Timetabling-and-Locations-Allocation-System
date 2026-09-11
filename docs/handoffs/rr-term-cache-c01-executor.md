# RR-TERM-CACHE-C01 — executor handoff

- **Role:** EXECUTOR (bounded delegate). No merge/push/deploy; `REVIEW_REQUIRED`.
- **Worktree:** `D:/ATLAS-worktrees/rr-term-cache-c01`
- **Branch:** `work/rr-term-cache-c01`
- **Base SHA:** `77894b7acc140b88cc5591d1538cb98f7f3ac702` (verified `git rev-parse HEAD`; clean tree before editing)
- **Candidate:** the commit containing this handoff (base `77894b7a`); exact SHA reported in the executor report.
- **Governing prompt:** `docs/prompts/rollover-term-cache-catchup-one-shot-rrtc01-2026-09-11.md`

## Objective delivered

Year alignment and persisted ordered-term authority are now separate, truthful
states. An aligned active year with no `termContractCache` reports `MISSING`
(with `repairAction: PREVIEW_TERM_CACHE_SYNC`) instead of `recommendedAction:
NONE`. There is exactly one narrow repair path: a zero-write preview followed by
a privileged, actor-school-scoped, fingerprinted apply that writes only the
active mirror's `termContractCache`/`termContractCachedAt` plus one scoped audit
row. `teachingLoadResetRequired` is now namespaced/qualified and only true when
the typed dummy-year reset path actually applies.

## Changed paths

Server (owned):
- `atlas-server/src/services/enrollpro-term-contract.service.ts`
- `atlas-server/src/services/enrollpro-rollover.service.ts`
- `atlas-server/src/routes/runtime.router.ts`
- `atlas-server/src/__tests__/term-authority-status-rrtc01.test.ts` (new)
- `atlas-server/src/__tests__/term-cache-catchup-rrtc01.test.ts` (new)

Client (owned):
- `atlas-client/src/lib/settings.ts`
- `atlas-client/src/components/runtime/RolloverGuidanceCard.tsx`
- `atlas-client/src/lib/__tests__/rollover-term-repair.test.ts` (new)

No out-of-scope production path was touched. `enrollpro-term-contract.service.ts`
also gained `validatePersistedContractStructure` (needed because the existing
order-sensitive `validateCachedContract` cannot round-trip JSONB — see Risks).

## Trace table (requirement → production path → negative control → verification)

| # | Requirement | Production path | Negative control | Verification | Result |
|---|---|---|---|---|---|
| R1 | Status reports year drift and term authority independently (≥5 states) | `getRolloverStatus` → `GET /runtime/rollover-status`; `resolveTermAuthorityStatus` | aligned+null cache old returned `NONE`; new reports `MISSING`+preview. Stale when revision differs despite equal count | `term-authority-status-rrtc01` (11/11); `term-cache-catchup-rrtc01` step 1 | PASS |
| R2 | Aligned+missing says terms not saved; never "no action"; `teachingLoadResetRequired` qualified | `buildDummyYearResetPreview`, `RolloverStatusResult.teachingLoadReset`, card | aligned populated year with TL rows → `teachingLoadResetRequired=false`, `applicable=false` | `term-cache-catchup-rrtc01` step 1; client test | PASS |
| R3 | Exactly one primary repair action; zero-write preview first; never broad rollover apply | `RolloverGuidanceCard.handleTermRepair` → `previewTermCacheSync` | source guard: term-repair path must not call `applyRolloverSync`/`applyArchiveAndSync` | client `rollover-term-repair` (6/6) | PASS |
| R4 | Apply writes only active mirror cache + one audit; no faculty/section/TL/generation | `applyTermCacheSync`; `POST /runtime/term-authority/apply` | instrumented write set must be exactly `{EnrollProSchoolYearMirror:updateMany, AuditLog:create}` | `term-cache-catchup-rrtc01` step 6 | PASS |
| R5 | Preview fetches/validates live contract, returns revision/rows/bindings/fingerprint/confirmation; zero-write | `previewTermCacheSync`; `POST /runtime/term-authority/preview` | instrumented writes after preview must be zero; cache columns stay NULL | `term-cache-catchup-rrtc01` step 3 | PASS |
| R6 | Apply privileged actor-school + exact confirmation + fingerprint; re-fetch/revalidate; drift→typed 4xx zero writes; replay idempotent | `applyTermCacheSync` + `assertActorTermCacheScope` | forged fingerprint, malformed confirmation, cross-school, missing fingerprint, real upstream rename → typed 4xx + zero writes; replay zero writes + no 2nd audit | `term-cache-catchup-rrtc01` steps 4,5,8 | PASS |
| R7 | Reachable `ACTIVE_TERM_UNRESOLVED` keeps the ordered structure valid | `resolveActiveTermState`; preview | 409 UNRESOLVED fixture → 3 ordered terms, `activeTermAvailability=UNRESOLVED` | `term-cache-catchup-rrtc01` step 3; `term-contract-atlas-consumption-c02` (8/8) | PASS |
| R8 | After disposable-fixture apply, canonical demand + real diagnostic pass `TERM_STRUCTURE_UNAVAILABLE` without helper injection | `buildDerivedDemand`; `GET /generation/:schoolId/:schoolYearId/readiness/diagnostic` | before apply both blocked with `TERM_STRUCTURE_UNAVAILABLE`; after apply both clear | `term-cache-catchup-rrtc01` steps 2,7 | PASS |
| R9 | UI one concise status + explanation + one action; no broad apply, no fingerprint wall | `RolloverGuidanceCard` + `describeTermAuthority` | term-repair state hides the broad Sync/Preview buttons | client `rollover-term-repair` (6/6) | PASS |

## Status / repair matrix

| Term authority state | Meaning | UI | Repair |
|---|---|---|---|
| `PERSISTED_CURRENT` | cache matches live revision | current, no repair | none |
| `MISSING` | aligned year, no saved snapshot | "Year current — terms not saved" | preview → apply |
| `PERSISTED_STALE` | saved revision differs from live (even if count matches) | "Terms changed at source" | preview → apply |
| `CACHE_INVALID` | saved snapshot structurally malformed | "Year current — terms not saved" | preview → apply |
| `UPSTREAM_UNAVAILABLE` | EnrollPro unreachable; no live compare | warning | retry EnrollPro (no preview) |
| `INVALID_UPSTREAM_CONTRACT` | live contract fails validation | warning | none/observe |
| `YEAR_NOT_MIRRORED` | no active mirror | year drift owns it | none |
| `PERSISTED_UNVERIFIED` | year drift pending | year drift owns it | none |

## Disposable-fixture receipts

`term-cache-catchup-rrtc01.test.ts` provisions a dedicated
`atlas_restore_drill_*` database, applies the canonical schema, seeds one
fixture school with an aligned active mirror and NO snapshot, and exercises the
mounted runtime + generation routers with instrumented Prisma:

- Preview: zero writes; exact `['T1','T2','T3']`; `ACTIVE_TERM_UNRESOLVED`
  preserved; 64-char fingerprint; `SAVE_TERM_AUTHORITY_<school>_<year>`.
- Negative gates: forged fingerprint `409 FINGERPRINT_MISMATCH`, malformed
  confirmation `400 CONFIRMATION_REQUIRED`, cross-school `403
  CROSS_SCHOOL_DENIED`, missing fingerprint `400 FINGERPRINT_REQUIRED`, real
  upstream rename `409 FINGERPRINT_MISMATCH` — all zero writes.
- Apply: exactly one `EnrollProSchoolYearMirror:updateMany` + one
  `AuditLog:create` (`TERM_CACHE_SYNC_APPLIED`, `source:
  enrollpro-term-cache-catchup`); no forbidden models.
- Replay: `replayed=true`, zero writes, audit count unchanged.
- Concurrency: two identical applies → exactly one write and one additional
  audit; the other is an idempotent replay or typed 409.
- Zero residue: fixture rows deleted and the disposable database dropped
  (`pg_database` count = 0).

## Decisive gate counts

- `term-authority-status-rrtc01`: 11 passed / 0 failed
- `term-cache-catchup-rrtc01` (disposable PostgreSQL mounted): 1 suite / 0 failed
- `term-contract-atlas-consumption-c02`: 8 passed / 0 failed
- `term-contract-cache-instrumentation`: 32 passed / 0 failed
- `enrollpro-rollover-automation`: 99 passed / 0 failed (school-1 baseline
  seeded into the disposable DB; on a bare fresh DB 4 pre-existing baseline
  asserts fail because school 1 has no mirror/faculty — unrelated to this change)
- `enrollpro-rollover-lifecycle-closure`: 208 passed / 0 failed
- `rr-ux01-rollover-history`: exit 0
- client `rollover-term-repair`: 6 passed / 0 failed
- server `tsc --noEmit`: clean; client `tsc --noEmit`: clean
- server `npm run build`: exit 0; client `npm run build`: exit 0
- built `node dist/server.js` with `ROLLOVER_AUTO_SYNC_ENABLED=false`: process
  alive, `/api/v1/health` 200, `[rollover-automation] Disabled` logged, stopped
- `git diff --check`: exit 0

## Mutation / safety statement

- **No live term-cache sync was performed.** No deployment, no shared
  server/client restart, no login-driven writes, no rollover sync/apply, no
  Teaching Load mutation, no generation, no publication.
- All database-backed verification used disposable fixtures: a dedicated
  `atlas_restore_drill_*` database (created, migrated, then dropped with a
  zero-residue assertion) and disposable high-ID sandbox schools inside it.
  Database-backed suites never targeted school 1 or active year-9 data on the
  configured DB.
- Companion repositories were not touched.

## Remaining risks (all NON_BLOCKING for source acceptance)

- `validateCachedContract` remains order-sensitive and cannot round-trip
  PostgreSQL JSONB; the new persisted path uses
  `validatePersistedContractStructure` (trusts the stored revision scalar,
  enforces shape, compares to live). The pre-existing degraded
  `resolveTermContractWithDependencies` path still uses the strict validator.
- `teachingLoadResetRequired` is narrowed to the applicable dummy-reset path;
  the reset panel is already gated on `canResetDummyYear`, and the new
  `teachingLoadReset` context documents the scope.
- Browser evidence is an isolated rendered/source harness only; live Tailnet
  desktop/mobile proof is deferred to deployment (no Tailnet page origin claimed).

## Intended future HIGH approval shape (not executed)

Preview (`POST /runtime/term-authority/preview`) → exact confirmation +
fingerprint → `POST /runtime/term-authority/apply` for one named school/year;
rollback is a restore of the prior `termContractCache`/`termContractCachedAt`
(the audit row records `previousSemanticRevision`); no rows are deleted.

**REVIEW_REQUIRED**
