# COMPANION-SSO-C01 — Executor handoff

- Stream: COMPANION-SSO-C01 (ATLAS-side companion SSO, EnrollPro ↔ ATLAS)
- Worktree: `D:/ATLAS-worktrees/companion-sso-c01`
- Branch: `work/companion-sso-c01`
- Base SHA: `a284d775411856adbdf24540dadc9d09b0d911a8` (origin/main tip at dispatch)
- Product commit: `3e0103a3cda027c35227631cc7551d4b0d6a416d`
- Candidate SHA (tip incl. this handoff): reported by the enclosing commit
- Status: `REVIEW_REQUIRED`

## Changed-path list

Server
- `atlas-server/src/services/companion-sso.service.ts` (new)
- `atlas-server/src/routes/auth.router.ts`
- `atlas-server/src/services/local-auth.service.ts` (additive exports only)
- `atlas-server/src/__tests__/companion-sso-http.test.ts` (new)

Client
- `atlas-client/src/components/app-shell/IntegratedSystems.tsx` (new)
- `atlas-client/src/lib/integrated-systems.ts` (new)
- `atlas-client/src/lib/companion-sso-client.ts` (new)
- `atlas-client/src/lib/jwt-payload.ts` (new)
- `atlas-client/src/pages/SsoCallback.tsx` (new)
- `atlas-client/src/pages/EnrollProAuthorize.tsx` (new)
- `atlas-client/src/lib/__tests__/companion-sso-client.test.ts` (new)
- `atlas-client/src/pages/Login.tsx` (additive `returnUrl` only)
- `atlas-client/src/App.tsx` (two new public routes)
- `atlas-client/src/components/AppShell.tsx` (drawer prop)
- `atlas-client/src/components/app-shell/AppSidebar.tsx` (Integrated Systems area)
- `atlas-client/src/components/app-shell/MobileNavigationDrawer.tsx` (Integrated Systems area)

Schema
- `prisma/schema.prisma` (`CompanionSsoCode` model + `AtlasAuthAccount` back-relation)
- `prisma/migrations/0002_companion_sso_code/migration.sql`

Not staged/committed by design: `AGENTS.md` (pre-existing modified), `COMPANION-SSO-INTEGRATION-GUIDE.md` (untracked read-only authority), `prisma/migrations/migration_lock.toml` (restored; line-ending-only).

## Trace table — requirement → production path → negative control → verification

| # | Requirement (prompt §5) | Production path | Negative control | Verification | Status |
|---|---|---|---|---|---|
| 1 | Flow A happy path: mounted callback, stub EnrollPro, existing account, 1 session audit, 1 lastLoginAt, fragment redirect | `GET /api/v1/auth/enrollpro/callback` → `companion-sso.service.exchangeEnrollProCallbackCode` → `createSessionForExistingAccount` | malformed/replayed code | `npx tsx --test src/__tests__/companion-sso-http.test.ts` (proof 1) | PASS |
| 2 | Flow A rejects: malformed, expired/replayed, wrong companion, upstream unreachable, zero writes | route shape check + `validateCompanionSsoIdentity` + fetch abort | each reject asserted with 0 session/audit/lastLoginAt | same suite (proofs 2a–2d) | PASS |
| 3 | Flow A account failures: unknown, inactive, disallowed role, faculty canonical-mirror fail-closed | `findExistingAccount` + `ALLOWED_ATLAS_ROLES` + `classifyFacultyLoginEligibility` | one case per rejection, zero writes | same suite (proof 3) | PASS |
| 4 | Flow A school/year parity: missing / id mismatch / label mismatch; matching passes | `resolveActiveSchoolYearMirror` | typed `ACTIVE_SCHOOL_YEAR_REQUIRED`/`_CONFLICT`, zero writes | same suite (proof 4) | PASS |
| 5 | Flow B authorize matrix: missing/invalid JWT, non-privileged, malformed params/open-redirect | `POST /api/v1/auth/sso/authorize` → `validateAuthorizeRequest` | each reject → typed 400/401/403, 0 code rows | same suite (proof 5) | PASS |
| 6 | Flow B issue→exchange happy path → 200 ATLAS assertion, 1 consumed row, 1 audit | `issueCompanionSsoCode` + `exchangeCompanionSsoCode` + `buildAssertion` | — | same suite (proof 6) | PASS |
| 7 | Flow B exchange negatives → exact invalid-code JSON, zero success audits | `matchReverseClientSecret` + `consumeCompanionSsoCode` | missing/short/wrong secret, malformed, unknown, expired, wrong audience, wrong clientId/redirectUri, replay | same suite (proof 7) | PASS |
| 8 | Concurrency: one code → exactly one 200 + one 401 | single-statement `updateMany` consume | two concurrent exchanges | same suite (proof 8) | PASS |
| 9 | Zero plaintext codes at rest | `hashCompanionSsoCode` persisted only | assert stored hash ≠ plaintext and matches `^[0-9a-f]{64}$` | same suite (proof 9) | PASS |
| 10 | No leak: responses/logs never contain code, secret, token | no logging of secrets; fragment token; constant-time secret | console capture across success/error paths | same suite (proof 10) | PASS |
| 11 | Regression: `POST /auth/login` + `GET /auth/me` unchanged | `local-auth.service.login` / existing route | valid + invalid credential paths | same suite (proof 11) | PASS |
| 12 | Client behavior: Integrated Systems rendered output, callback fragment, authorize hydration/returnUrl | `IntegratedSystems.tsx`, `SsoCallback.tsx`, `EnrollProAuthorize.tsx`, `companion-sso-client.ts` | query-string token ignored; unsafe returnUrl rejected; staffless hides EnrollPro | `npx tsx --test src/lib/__tests__/companion-sso-client.test.ts` (12/12) | PASS |
| 13 | Gates: server+client tsc, both builds, isolated built-server health, `git diff --check`, disposable-DB cleanup | `npm run build` / `node dist/server.js` on isolated port | n/a | see Decisive checks | PASS |

Deferred:
- Flow A `POST /api/v1/auth/enrollpro/callback` JSON variant — explicitly DEFERRED by prompt §3.1.2 (guide lists it optional). No route mounted.

## Decisive checks (commands + results)

- Server mounted-route suite: `npx tsx --test src/__tests__/companion-sso-http.test.ts` (from `atlas-server`, with `DATABASE_URL` → disposable DB and a test `JWT_SECRET`) → **14 tests, 14 pass, 0 fail**. Exercises the real Express app + Prisma + real `fetch` path via an ephemeral localhost EnrollPro stub selected by `ENROLLPRO_BASE_URL`.
- Client behavior suite: `npx tsx --test src/lib/__tests__/companion-sso-client.test.ts` (from `atlas-client`) → **12 tests, 12 pass, 0 fail**. Integrated Systems asserted against real `renderToStaticMarkup` HTML (order AIMS/SMART/ATLAS/MRF; ATLAS `aria-current`; AIMS/SMART/MRF `aria-disabled`; only absolute URL is the EnrollPro start URL).
- `atlas-server` `npx tsc --noEmit` → exit 0.
- `atlas-client` `npx tsc --noEmit` → exit 0.
- `atlas-server` `npm run build` → exit 0.
- `atlas-client` `npm run build` → exit 0.
- Isolated built-server startup: `node dist/server.js` with `PORT=5311`, `ROLLOVER_AUTO_SYNC_ENABLED=false`, disposable `DATABASE_URL` → `GET http://127.0.0.1:5311/api/v1/health` = **200** `{"status":"ok","service":"atlas"}`; process stopped; **port 5311 released**. Ports 5001/5174 never touched.
- `git diff --check` → exit 0 (after trimming one trailing blank line at EOF in `companion-sso.service.ts`).
- `git diff --cached --check` → exit 0.

## Disposable database identity

- Name: `atlas_companion_sso_c01_20260913` (local PostgreSQL 18, `localhost:5432`, local-only — not the shared/live database).
- Migrations applied: **3** (`0000_clean_baseline`, `0001_term_subject_authority`, `0002_companion_sso_code`); 44 tables.
- Fixture isolation: test rows confined to school ids `9_200_101` / `9_200_102`; test `after` hook removes all schools/accounts/codes/audit/mirrors it created. Post-run residue verified **0** across `schools`, `atlas_auth_accounts`, `companion_sso_codes`, `audit_logs`, `enrollpro_school_year_mirrors`, `faculty_mirrors`.
- Cleanup: database **dropped** (`DROP DATABASE atlas_companion_sso_c01_20260913`) — zero residue. Recreation for independent QA: `createdb` the same name, then `DATABASE_URL=... npx prisma migrate deploy`, then re-run the server suite.

## Security/conservation notes

- The plaintext code is generated with 32 random bytes → 43 base64url chars, persisted only as SHA-256 hex; the row is consumed with one atomic `updateMany` (codeHash + `consumedAt:null` + fresh + audience + exact redirectUri, `count===1`).
- Reverse secret compared with `crypto.timingSafeEqual` behind a length guard; only the matching env *name* is ever logged. Canonical `ATLAS_SSO_REVERSE_CLIENT_SECRET` accepted with legacy `ENROLLPRO_REVERSE_CLIENT_SECRET` alias.
- Session token is delivered in the URL **fragment** (`#atlasToken=`) and stripped by the SPA with `history.replaceState` before any storage/navigation; the callback fails closed if the token only appears in the query string.
- The callback never creates/provisions/updates an account; the local stored role is authoritative and the faculty canonical-mirror eligibility gate is preserved.
- Audit metadata contains no code/secret/identity payload.
- `local-auth.service.ts` changes are additive exports only (`issueCompanionSsoToken`, `writeCompanionSsoAudit`); existing functions untouched.

## Deferred items

- Flow A `POST /api/v1/auth/enrollpro/callback` (JSON variant) — DEFERRED per prompt §3.1.2 (guide marks it optional).
- EnrollPro-side onboarding/config exchange is documented (below), not executed. Live activation, env configuration, deployment, and any EnrollPro/SMART/AIMS change are HIGH and out of scope.

## EnrollPro-side onboarding checklist (documentation only)

1. Register ATLAS callback: `<ATLAS_PUBLIC>/api/v1/auth/enrollpro/callback`.
2. Provision ATLAS outbound secret (`ENROLLPRO_SSO_CLIENT_SECRET`, ≥32 chars) on both sides — EnrollPro stores it, ATLAS sends it as Bearer on the exchange.
3. Register ATLAS reverse authorize URL: `<ATLAS_PUBLIC>/auth/enrollpro/authorize`.
4. Register ATLAS reverse exchange URL: `<ATLAS_PUBLIC>/api/v1/auth/sso/exchange`.
5. Reverse client id: `enrollpro`.
6. Generate the reverse secret (ATLAS holds `ATLAS_SSO_REVERSE_CLIENT_SECRET`) and give EnrollPro its value.
7. Set `ENROLLPRO_SSO_CALLBACK_URL` (ATLAS) to EnrollPro's exact reverse callback URL used to validate `redirect_uri`.
8. Client builds: optionally set `VITE_ENROLLPRO_SSO_START_URL`.

## Known risks

- NON_BLOCKING — The genuine ambiguous *multi-match* account case cannot be materialized because `atlas_auth_accounts` enforces `UNIQUE(employee_id)` and `UNIQUE(account_name)`. The deterministic single-match guard (`candidates.size !== 1`) rejects both zero and multiple matches and is exercised through the zero-match path; multi-row ambiguity is additionally constrained at the DB layer.
- NON_BLOCKING — Client page navigation effects are covered through the pure decision helpers plus rendered initial-state output; there is no DOM/jsdom harness in the repo and no live browser evidence was produced (live/browser execution is out of scope for this packet).
- NON_BLOCKING — Flow A/B runtime environment variables (`ENROLLPRO_BASE_URL`, secrets, `ENROLLPRO_SSO_CALLBACK_URL`, `VITE_ENROLLPRO_SSO_START_URL`) are documented but not configured here; live activation is a separate HIGH action.
- NON_BLOCKING — Isolated startup used `ROLLOVER_AUTO_SYNC_ENABLED=false`; the production default remains unchanged.
- BLOCKING — none.

## Return

`REVIEW_REQUIRED` — frozen range `a284d775...3e0103a3` (product) plus this handoff commit. Do not merge/rebase/push/self-accept.
