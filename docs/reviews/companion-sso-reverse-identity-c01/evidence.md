# Evidence — COMPANION-SSO-REVERSE-IDENTITY-C01 (reverse assertion identity) + release `d4c9f391`

- **Base:** `831bb9fa` · **Candidate:** `ecfa1286` · **Integration merge / release pin:** `d4c9f391`
- **Risk:** MEDIUM server source; HIGH deployment. Executed by Lane A under the operator's standing
  authorization, every gate retained.
- **Result:** ATLAS → EnrollPro (reverse) **confirmed working live**; EnrollPro → ATLAS (normal)
  **BLOCKED on an EnrollPro configuration value** (typed reason in §6).

## 1. Changed paths (candidate, 5)

`atlas-server/src/services/companion-sso.service.ts`,
`atlas-server/src/services/companion-sso-identity.ts`,
`atlas-server/src/__tests__/companion-sso-http.test.ts`, `atlas-server/package.json` (one script
entry), `docs/handoffs/companion-sso-reverse-identity-c01-enrollpro.md`.

## 2. Gates

| Gate | Range | Result |
| --- | --- | --- |
| Pre-action source review + packet lint | `831bb9fa...ecfa1286` | `ACCEPT_READY` **17/17/0/0**, no blocking finding |
| Planner mounted suite (disposable DB) | candidate | `test:companion-sso` **21/21** |
| Integration combined gates | merged tree | build exit 0; `test:companion-sso` **21/21**; `test:actor-school-mutations` **1/1**; `test:warning-readability` **9/9**; `git diff --check` clean |
| Post-action QA | live `d4c9f391` | **CORRECTION_REQUIRED** — D1/D2/D3/D5 pass; D4/D7 incomplete at its step limit; **D6 normal leg failed** |

## 3. R1–R5 results

- **R1 — already satisfied (verification row).** `CompanionSsoAssertion`
  (`companion-sso.service.ts:829-843`) declares `subject` and **no** `userId`; `buildAssertion`
  emits `subject: ATLAS_USER:<account.id>`. The click-through findings' "Defect B" was a
  **misattribution**: the quoted `userId: account.role === 'faculty' …` line is the Flow A local
  `sessionUser` (`:573-574`), not the cross-system assertion. `git log -S 'userId: account.role'`
  returns one occurrence. Recorded in the companion handoff §3.
- **R2 — names optional by omission.** `buildAssertion` spreads `{firstName, lastName}` only when
  `resolveReverseSsoNameParts` returns non-null; otherwise both keys are **absent**. Empty strings
  are never sent, because EnrollPro's schema declares `firstName`/`lastName` as
  `z.string().min(1).optional()` (`D:/EnrollPro` @ `7b6231ee`,
  `shared/src/schemas/companion-sso.schema.ts:66-77`) — present-but-empty fails. Safe because
  EnrollPro never compares the name (`assertUserCanEnterEnrollPro`,
  `server/src/features/auth/companion-sso-reverse.service.ts:411-419`, checks only `isActive`).
  Nameless-case assertion body:
  `{success:true, issuer:'ATLAS', identity:{subject:'ATLAS_USER:<id>', employeeId:'<E…>', lrn:null, middleName:null, roles:['SYSTEM_ADMIN']}, activeSchoolYear:{id:…, yearLabel:…}, authenticatedAt:…}`
  — no `userId`, no `firstName`/`lastName` keys.
- **R3 — fail closed before the assertion.** `employeeId = account.employeeId ?? account.faculty?.employeeId`;
  null/empty → `CompanionSsoError('COMPANION_SSO_IDENTITY_EMPLOYEE_ID_UNAVAILABLE')`, mapped to HTTP
  **403** and added to `REVERSE_ASSERTION_TYPED_FAILURES`, so the exchange re-throws it as a typed
  producer-side failure (not a retryable 503). Zero success audits on that path.
- **R4 — contract compatibility.** `issuer: 'ATLAS'` (EnrollPro `companionSystemSchema` enum),
  `success: true`, `authenticatedAt`, optional `activeSchoolYear`, `roles` from the real `RoleEnum`;
  no field EnrollPro reads was removed.
- **R5 — proven without deploying first.** Mounted, DB-backed suite (not helper-only): proof 16
  (lowercase role mapping), proof 17 (single-token `accountName` + valid `employeeId` → `subject` +
  `employeeId`, no `userId`, names omitted), proof 18 (no `employeeId` → typed 403 with zero success
  audits; faculty-mirror `employeeId` fallback → 200). Failing-first: the pre-change code throws
  `…NAME_UNAVAILABLE` and never reaches these paths.

## 4. Release

- Pin `d4c9f39139dcb34e1653d543586d4c76420ea8a5` at
  `D:\ATLAS-runtime-supervised-d4c9f391-20260921` (registered detached worktree).
- Supervisor **28104**; server `5001`→**39064**; client `5174`→**39392**; state `releaseSha=d4c9f391…`.
- Client tree unchanged, so the served entry chunk is still `index-DgF0ZSEz.js` (456,064 B) — the
  deploy is proven by the **server** artifacts: `dist/services/companion-sso.service.js`
  `A3EAFB7B…` and `…identity.js` `E0094C58…` (incumbent `D436EEEE…` / `58F18D04…`); the compiled
  artifact contains `COMPANION_SSO_IDENTITY_EMPLOYEE_ID_UNAVAILABLE`.
- Health/ready/Tailnet/subjects 200; SMART/AIMS `/start` → `503 COMPANION_SSO_NOT_CONFIGURED` with no
  `Location`/`Set-Cookie`.
- Rollback: incumbent `d92facfa` startable at `D:\ATLAS-runtime-supervised-d92facfa-20260921`
  (task XML captured pre-mutation, SHA-256 `53510853…`); **not executed**.

## 5. Zero-write scan (whole database, post-cutover)

A timestamp scan across every `public` table's `createdAt`/`updatedAt`/`created_at`/`updated_at`/
`last_login_at` column after the cutover (`TIMESTAMP '2026-09-22 03:30:00'`, the column family stores
UTC wall time) returns **only**:

| table | column | rows |
| --- | --- | --- |
| `atlas_auth_accounts` | `last_login_at` | 1 |
| `atlas_auth_accounts` | `updated_at` | 1 |
| `audit_logs` | `createdAt` | 4 |
| `companion_sso_codes` | `created_at` | 2 |

No other table wrote. Every row is an auth row attributable to the disclosed logins/click-through
below. (The QA's own signature-map re-derivation was not completed before its step limit; this scan
is the replacement zero-write evidence.)

## 6. Live click-through (R6)

**Reverse — ATLAS → EnrollPro: PASS.** Logged into `https://njgrm.buru-degree.ts.net`, used
Integrated Systems → EnrollPro (`…/api/auth/companion-sso/atlas/reverse/start`). Final URL
**`https://dev-jegs.buru-degree.ts.net/dashboard`**, `window.location.origin ===
'https://dev-jegs.buru-degree.ts.net'` asserted, authenticated EnrollPro surface ("Jose Rizal /
System Administrator"), **no `ssoError`**. This is the fix's acceptance.

**Normal — EnrollPro → ATLAS: FAIL — `BLOCKED(COMPANION_CALLBACK_MISCONFIGURED)`.** From an
authenticated EnrollPro session, EnrollPro issued `POST …/api/auth/companion-sso/atlas/launch → 201`
and navigated to `GET https://njgrm.buru-degree.ts.net/auth/sso/callback?code=…` → 200. That is
ATLAS's SPA **result** page, which reads only the fragment `atlasToken` / query `ssoError` and never
a `code`, so it rendered *"No sign-in token was provided. Start again from EnrollPro."* ATLAS was not
authenticated and no ATLAS session/audit row was created.

Root cause: EnrollPro's `ATLAS_SSO_CALLBACK_URL` is set to ATLAS's **result** path where the
**callback** path belongs. Required:
`ATLAS_SSO_CALLBACK_URL=https://njgrm.buru-degree.ts.net/api/v1/auth/enrollpro/callback`
(evidence and acceptance tests in the companion handoff §4). Companion-side configuration; the ATLAS
release delta is not implicated (client tree and the Flow A server route are unchanged).

## 7. Session disclosure

Baseline before this stream's click-through: `audit_logs` max id **864**, count **313**; actor 46
`last_login_at` `2026-09-22 03:32:45.192`.

| Row | Action | Actor | Time (UTC) | Attribution |
| --- | --- | --- | --- | --- |
| 863 | `LOCAL_LOGIN_SUCCESS` | 46 | 2026-09-22 03:32:45 | **Unexplained / not mine** (pre-dates this release's cutover at 03:36:58) |
| 864 | `COMPANION_SSO_CODE_CONSUMED` | 46 | 2026-09-22 03:38:01 | **Unexplained / not mine** — written on the new release; consistent with the fix working, but not a controlled step of this lane |
| 865 | `LOCAL_LOGIN_SUCCESS` | 46 | 2026-09-22 03:54:34 | The QA's ATLAS login for the click-through |
| 866 | `COMPANION_SSO_CODE_CONSUMED` | 46 | 2026-09-22 03:54:53 | The QA's reverse click-through |

`companion_sso_codes`: id 1 (2026-09-21 16:24:03, pre-existing), id 2 (03:38:01, unexplained — pairs
with row 864), id 3 (03:54:53, the QA's). Actor 46 `last_login_at` now `2026-09-22 03:54:34` (the
QA's login). Logout proven: tokens cleared from `localStorage` and `sessionStorage`,
`GET /api/v1/auth/me` → `401 {"code":"NO_TOKEN"}`. Browser context closed. Disposable databases
(`atlas_sso_c01_test`, `atlas_qa_d4c9f391`) dropped; the live database is intact.

## 8. Companion handoff

`docs/handoffs/companion-sso-reverse-identity-c01-enrollpro.md` — §2 asks EnrollPro to prefer
`employeeId` over a caller-supplied `userId` and to surface the companion's 403 code; §4 is the
**Flow A callback misconfiguration** above. No companion repo was touched.

## 9. Findings

**BLOCKING (for the normal direction only)** — EnrollPro `ATLAS_SSO_CALLBACK_URL` points at ATLAS's
SPA result path. Companion-side; needs an EnrollPro env change.

**NON_BLOCKING** — `COMPANION_SSO_IDENTITY_NAME_UNAVAILABLE` is now unreachable from
`buildAssertion` but remains in the typed-failure set; the `employeeId` guard tests
`!employeeId.trim()` while emitting the untrimmed value; the state file's `releaseLabel`/`productPin`
labels are stale; `audit_logs` count was 313 where the QA prompt said 312.

## 10. Stated limitations

The QA's D4 signature-map re-derivation and D7 delta/cleanup were not completed before its step
limit; the whole-database timestamp scan in §5 and the logout proof in §7 close them. Unexplained
rows 863/864 are disclosed rather than attributed. The live EnrollPro environment was not readable
from here, so the §6 attribution rests on the observed `?code=` request plus the EnrollPro mirror
source at `7b6231ee`.
