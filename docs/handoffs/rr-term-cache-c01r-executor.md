# RR-TERM-CACHE-C01R — executor handoff

- **Role:** EXECUTOR (bounded delegate). No merge/push/deploy/register edit; `REVIEW_REQUIRED`.
- **Worktree:** `D:/ATLAS-worktrees/rr-term-cache-c01r`
- **Branch:** `work/rr-term-cache-c01r`
- **Base SHA:** `904818d4aa6365df267a1a2c8a37857ec7e848d7` (verified equal to `git rev-parse HEAD`; clean tree before editing)
- **Candidate:** the tip commit on `work/rr-term-cache-c01r` containing this handoff (base `904818d4`); exact SHA reported in the executor report.
- **Governing prompt:** RR-TERM-CACHE-C01R correction packet (three production-authority defects).

## Objective delivered

Closed three production-authority defects in the integrated persisted-term
catch-up workflow without widening the narrow contract:

1. **JWT-only route authority (preview and apply).** Both routes now use the
   JWT-only `authenticate` middleware (never `authenticateWithSystemToken`) and
   enforce privileged role, strict positive actor user id, strict positive actor
   school, and same-school scope before any service/upstream/DB dispatch.
2. **Client actor-school authority.** Removed the `schoolId = 1` defaults from
   `RolloverGuidanceCard`, `previewTermCacheSync`, and `applyTermCacheSync`.
   The card requires an explicit actor school; omitted-prop callers use the new
   fail-closed `ActorScopedRolloverGuidanceCard` (`/auth/me`), which dispatches
   nothing until the actor school is a strict positive integer.
3. **Complete active-year authority inside the transaction.** `resolveActiveYearMirror`
   now accepts the caller's data client and elects the complete same-school
   `isActive && !isArchived` set; apply re-elects it through the transaction
   client inside the existing Serializable transaction before writing.

## Changed paths

Product (server):
- `atlas-server/src/routes/runtime.router.ts`
- `atlas-server/src/services/enrollpro-term-contract.service.ts`

Product (client):
- `atlas-client/src/lib/settings.ts`
- `atlas-client/src/components/runtime/RolloverGuidanceCard.tsx`
- `atlas-client/src/lib/term-authority-repair-scope.ts` (new, pure scope/lifecycle helpers)
- `atlas-client/src/pages/Dashboard.tsx` (explicit actor school)
- `atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx` (explicit school)
- `atlas-client/src/pages/Sections.tsx` (fail-closed wrapper)
- `atlas-client/src/pages/Faculty.tsx` (fail-closed wrapper)

Tests:
- `atlas-server/src/__tests__/term-cache-catchup-rrtc01.test.ts` (authority matrix + active-year ambiguity matrix)
- `atlas-client/src/lib/__tests__/rollover-term-repair.test.ts` (updated source guards)
- `atlas-client/src/lib/__tests__/term-authority-actor-scope.test.ts` (new)

Docs:
- `CHANGELOG.md`
- `docs/handoffs/rr-term-cache-c01r-executor.md` (this file)

Out of scope and untouched: Prisma schema/migrations, companion repos,
Teaching Load reconciliation/suggestion, derived-demand semantics, generation,
publication, shared runtime processes, live database, and the active delivery
register.

## Trace table

| # | Requirement | Production entry point | Old-behavior negative control | Verification | Result |
|---|---|---|---|---|---|
| A1 | Both term routes JWT-only; system token never authorizes | `authenticate` on `POST /runtime/term-authority/{preview,apply}` | 904818d4 used `authenticateWithSystemToken` (SYSTEM_ADMIN user) | mounted matrix: system-token bearer → 401 INVALID_TOKEN; integration-key only → 401 NO_TOKEN; zero dispatch | PASS |
| A2 | Privileged role required (preview too) | `authorizeTermAuthorityCaller` → 403 FORBIDDEN | preview at 904818d4 had no role check | mounted matrix: faculty preview/apply → 403 FORBIDDEN, zero dispatch | PASS |
| A3 | Strict positive actor user id | route gate + `applyTermCacheSync` service guard | route passed `req.user?.userId ?? 0` | mounted matrix: `userId:0` → 403 ACTOR_USER_REQUIRED, zero writes | PASS |
| A4 | Strict positive actor school; cross-school denied | route gate | `parseSchoolId` defaulted missing schoolId to 1 | mounted matrix: no-school JWT → 403 SCHOOL_SCOPE_REQUIRED; cross-school → 403 CROSS_SCHOOL_DENIED, zero dispatch | PASS |
| A5 | Missing/malformed school parameter → 400 (no school-1 default) | `parseStrictTermAuthoritySchoolId` | `Number(raw ?? 1)` accepted missing as school 1 | mounted matrix: `schoolId:0`, `-1`, `{}` → 400 INVALID_PARAM, zero dispatch | PASS |
| A6 | Preview is zero-write but still fully scoped | `POST /runtime/term-authority/preview` | preview was actor-unscoped at 904818d4 | step 3: valid same-school privileged preview → 200, zero writes; step 0 matrix rejects all others | PASS |
| B1 | No `schoolId = 1` in card/wrappers | `RolloverGuidanceCard`, `previewTermCacheSync`, `applyTermCacheSync` | all three defaulted `schoolId = 1` | client suite source guards + required `schoolId: number` signature | PASS |
| B2 | Zero requests while actor scope unresolved | `ActorScopedRolloverGuidanceCard` (`/auth/me`) | omitted-prop callers sent school-1 requests immediately | client suite: unresolved scope never applicable; wrapper renders nothing until strict positive | PASS |
| B3 | Actor-school change clears dialog/preview/confirmation/errors/pending apply | `resetTermRepairForScope` in card effect + dialog controls | old card kept termPreview across prop change | client suite: reset clears all fields | PASS |
| B4 | Stale (incl. late-arriving) preview cannot apply after scope switch | `acceptTermRepairPreview`, `isTermRepairPreviewApplicable` | old card could submit a preview from the previous school | client suite: school-1 preview not applicable at school 2; late response rejected | PASS |
| B5 | Production callers wired to actor school | Dashboard (`actorSchoolId`), Schedule Review (`schoolId`), Teaching Load (`data.schoolId`), Admin Year Setup (`schoolId`), Sections/Faculty (wrapper) | Dashboard/ScheduleReview omitted the prop → school 1 | client suite caller-source assertions; client `tsc` + build | PASS |
| C1 | Apply re-elects complete same-school active/non-archived set inside tx | `resolveActiveYearMirror(schoolId, tx)` | 904818d4 read only the preview-selected row by composite key | disposable PG: second active mirror created during the apply fetch → 409 ACTIVE_YEAR_AMBIGUOUS, zero writes | PASS |
| C2 | Zero rows → ACTIVE_YEAR_UNAVAILABLE; >1 → ACTIVE_YEAR_AMBIGUOUS | `resolveActiveYearMirror` | selected-row lookup never saw the extra row | disposable PG ambiguity matrix | PASS |
| C3 | In-tx verify id/year/fingerprint/school match | transaction block | old tx accepted the still-active preview row | disposable PG: old selected-row lookup returns active row (would accept); full-set election rejects | PASS |
| C4 | No global Prisma read from inside tx | `tx` passed as the read client | n/a (new) | disposable PG ambiguous apply; no `getDataContext` read inside tx | PASS |
| D1 | Service rejects missing/non-positive actor before write | `applyTermCacheSync` early guard | service trusted the route's `?? 0` | client-side route matrix + code path; mirrored route 403 ACTOR_USER_REQUIRED | PASS |
| N1 | Concurrency: one cache mutation + one audit, no partial writes | existing concurrency step | n/a (retained) | disposable PG step 9 | PASS |

## Route authentication matrix (mounted, real router)

All rejections observed zero instrumented service/DB operations.

| Caller | Preview | Apply |
|---|---|---|
| No Authorization header | 401 NO_TOKEN | 401 NO_TOKEN |
| System-token bearer | 401 INVALID_TOKEN | 401 INVALID_TOKEN |
| `X-Integration-Key` only | 401 NO_TOKEN | 401 NO_TOKEN |
| Non-privileged faculty | 403 FORBIDDEN | 403 FORBIDDEN |
| JWT without actor school | 403 SCHOOL_SCOPE_REQUIRED | 403 SCHOOL_SCOPE_REQUIRED |
| JWT with `userId: 0` | 403 ACTOR_USER_REQUIRED | 403 ACTOR_USER_REQUIRED |
| Cross-school actor | 403 CROSS_SCHOOL_DENIED | 403 CROSS_SCHOOL_DENIED |
| Invalid/missing school parameter | 400 INVALID_PARAM | 400 INVALID_PARAM |
| Valid same-school privileged | 200, zero writes | 200, only cache + one audit |

## Client scope-transition matrix

| Control | Result |
|---|---|
| Unresolved actor school is never a valid dispatch scope | PASS (`isResolvedActorSchoolId` rejects null/0/negative/fraction/string) |
| Scope change clears preview, confirmation, error, pending apply | PASS (`resetTermRepairForScope`) |
| Preview only applicable to the school that produced it | PASS |
| Stale school-1 preview cannot apply after switching to school 2 | PASS |
| Preview for an unresolved school cannot be submitted | PASS |
| Late-arriving preview for a previous school rejected | PASS (`acceptTermRepairPreview`) |
| No term-authority `schoolId = 1` default remains | PASS (source guards on card + wrappers) |
| Production caller wiring (5 page/component callers) | PASS (source assertions; client tsc/build) |

## Transaction ambiguity matrix (disposable PostgreSQL)

1. Preview with exactly one active mirror → `READY`. PASS
2. During the apply's live fetch, a second same-school active, non-archived mirror is created (after preflight, before the transaction). PASS (fixture)
3. Apply → `409 ACTIVE_YEAR_AMBIGUOUS`; zero instrumented writes. PASS
4. Mirror cache stays NULL; audit count unchanged; Teaching Load rows unchanged; zero generation/publication writes. PASS
5. Old selected-row-only composite lookup still returns the active preview mirror (would have accepted). PASS (demonstrates the counterfactual)
6. Deactivate the competing mirror. PASS
7. Fresh preview + apply succeeds; exactly one additional audit row. PASS
8. Concurrent identical applies: exactly one writer + one audit, other is replay/typed 409. PASS (retained)
9. `finally` cleanup; zero fixture residue. PASS
10. Disposable database dropped; `pg_database` count = 0. PASS

## Decisive gate counts

Server (`atlas-server`):
- Gate 1 `term-authority-status-rrtc01`: 11 passed / 0 failed / 0 skipped
- Gate 2 `term-cache-catchup-rrtc01` (disposable PG, mounted): 1 passed / 0 failed / 0 skipped
- Gate 3 `term-contract-atlas-consumption-c02`: 8 passed / 0 failed / 0 skipped
- Gate 4 `term-contract-cache-instrumentation`: 32 passed / 0 failed / 0 skipped
- Gate 5 `enrollpro-rollover-lifecycle-closure`: 208 passed / 0 failed / 0 skipped
- Gate 6 `enrollpro-rollover-automation`: 106 passed / 0 failed / 0 skipped (seeded disposable DB)
- Gate 7 `npx tsc --noEmit`: exit 0
- Gate 8 `npm run build`: exit 0
- Gate 9 built `node dist/server.js` on isolated port 5099 with `ROLLOVER_AUTO_SYNC_ENABLED=false`: health 200, `[rollover-automation] Disabled` logged, both term routes 401 unauthenticated, process stopped; ports 5001/5174 untouched
- Gate 10 `git diff --check`: exit 0

Client (`atlas-client`):
- Gate 1 `rollover-term-repair`: 6 passed / 0 failed / 0 skipped
- Gate 2 `term-authority-actor-scope` (new): 8 passed / 0 failed / 0 skipped
- Gate 3 affected regressions (`dashboard-lifecycle-truth`, `rollover-ui-guardrails`, `teaching-load-carry-forward-helpers`): 32 passed / 0 failed / 0 skipped
- Gate 4 `npx tsc --noEmit`: exit 0
- Gate 5 `npm run build`: exit 0
- Gate 6 `git diff --check`: exit 0

## Zero-residue proof

`term-cache-catchup-rrtc01` created and dropped a dedicated
`atlas_restore_drill_<date>_rrtc*` database; the `finally` block deletes all
fixture rows (including the second ambiguity mirror), asserts zero `RRTC` school
residue, and asserts `pg_database` count = 0 after the drop.
`enrollpro-rollover-automation` used its own seeded disposable database.

## Known risks

- The in-transaction election is exercised by creating the competing mirror
  during the apply's live upstream fetch, which sits between preflight and the
  Serializable transaction. This is production-path proof that the transaction
  re-election rejects ambiguity; it does not separately pin a millisecond-level
  race inside the transaction window, which is covered by the shared
  `resolveActiveYearMirror` function plus the retained concurrency test.
- No live Tailnet browser evidence is claimed. This is a source correction; live
  browser acceptance belongs to a later approved deployment.
- No BLOCKED or DEFERRED mandatory rows.

## Mutation / safety statement

- No merge, no push, no rebase, no amend, no register edit, no self-approval.
- No live/shared database was touched; only disposable PostgreSQL fixtures.
- No shared runtime process (ports 5001/5174) was started, used, or restarted.
- Companion repositories were not touched.
- No generation, publication, or live term-cache write occurred.

**REVIEW_REQUIRED**
