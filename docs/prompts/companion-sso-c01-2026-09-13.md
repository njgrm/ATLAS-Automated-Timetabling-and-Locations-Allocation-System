# COMPANION-SSO-C01 — ATLAS-side companion SSO (EnrollPro ↔ ATLAS)

Status: `READY_FOR_EXECUTION` — prepared 2026-09-13 (Asia/Manila) by the primary
planner under the operator's `CYCLE ON:
COMPANION-SSO-AND-TERM-CACHE-PREP-2026-09-13`.

Risk: **MEDIUM source (security-sensitive)**. Live activation, deployment,
environment configuration, and any EnrollPro/SMART/AIMS change are **HIGH** and
out of scope here. No live login, no live SSO exchange, no live/shared database
write, no migration apply.

## 0. Authority and boundaries

- Read-only authority: `COMPANION-SSO-INTEGRATION-GUIDE.md` (repo root,
  untracked local copy; also copied into the executor worktree root). It is
  self-contained. The `docs/new api/...` references inside it do **not** exist
  in this repository — do not chase them.
- Governing cycle directive: `CYCLE ON:
  COMPANION-SSO-AND-TERM-CACHE-PREP-2026-09-13` (operator, 2026-09-13).
- Companion repositories (EnrollPro, AIMS, SMART) are **READ_ONLY**. Never
  edit, install dependencies, migrate, format, commit, or push in them. Live
  probes are read-only and optional; prefer committed evidence in this repo.
- This packet implements the **ATLAS side only**. EnrollPro onboarding/config
  exchange is documented for a developer handoff; it is not executed here.
- Hard concurrency boundary: `D:/ATLAS-worktrees/tt-output-c03` is actively
  being modified by another stream (TT-OUTPUT-C03R3). Never inspect, edit,
  test, stage, commit, reset, rebase, or merge anything in that path.
- Do not touch: shared runtime processes, ports 5001/5174, Windows tasks,
  durable env files, `opencode.json`, the living register
  (`docs/plans/atlas-active-delivery-streams.md`), the runtime source-of-truth
  map, `CHANGELOG.md`, or `AGENTS.md`.

## 1. Objective

Implement the complete ATLAS-side companion SSO integration so that:

1. **Flow A (EnrollPro → ATLAS):** an EnrollPro launch redirects the browser to
   ATLAS with a one-time code; ATLAS exchanges it server-to-server, validates
   the identity, creates a local ATLAS session for an **existing** local
   account, and lands the user on the correct ATLAS surface.
2. **Flow B (ATLAS → EnrollPro reverse):** an authenticated ATLAS staff user
   clicks EnrollPro in ATLAS; ATLAS issues a hash-only one-time code bound to
   audience/redirect, EnrollPro exchanges it at ATLAS with its reverse secret,
   and ATLAS returns the identity assertion.
3. The **Integrated Systems** AppShell area lists AIMS, SMART, ATLAS, MRF with
   ATLAS marked as non-clickable "Current system", EnrollPro enabled through
   reverse SSO in the same tab, and AIMS/SMART/MRF disabled with plain text.

## 2. Production entry points (exact)

| Purpose | Entry point |
|---|---|
| Flow A callback (EnrollPro launch lands here) | `GET /api/v1/auth/enrollpro/callback?code=<43-char>&state?` |
| Flow A SPA result page | `/auth/sso/callback` (client route) |
| Flow B authorize API (JWT-authed, SPA-mediated) | `POST /api/v1/auth/sso/authorize` |
| Flow B authorize SPA page (EP full-page redirect target) | `/auth/enrollpro/authorize` |
| Flow B exchange API (Bearer reverse secret) | `POST /api/v1/auth/sso/exchange` |

Routes mount through `atlas-server/src/routes/auth.router.ts` (already mounted
at `/api/v1/auth` in `atlas-server/src/app.ts:90`). Preserve `POST /login` and
`GET /me` behavior exactly.

## 3. Required behavior

### 3.1 Flow A — callback + exchange + local session

1. `GET /api/v1/auth/enrollpro/callback`:
   - Validate `code` shape first: `^[A-Za-z0-9_-]{43}$`. Invalid → plain
     recoverable error (see §3.5); never echo the code.
   - Server-to-server exchange: `POST ${ENROLLPRO_BASE_URL}/auth/companion-sso/atlas/exchange`
     with `Authorization: Bearer <ENROLLPRO_SSO_CLIENT_SECRET>` and
     `{ "code": "<code>" }` (canonical secret env; accepted legacy alias
     `ATLAS_SSO_CLIENT_SECRET`; `ENROLLPRO_BASE_URL` may include a trailing
     `/api`). Bounded timeout consistent with existing upstream calls (5s).
   - Ambiguous/failed network results: **never retry the consumed code**
     (treat as consumed). One code → at most one successful exchange ever.
   - Validate the response (guide §5.3): `success === true`; `companion`
     case-insensitively equal to `atlas`; `identity` present with resolvable
     `employeeId`/`accountName`; at least one role in the ATLAS allowed set
     `{SYSTEM_ADMIN, HEAD_REGISTRAR, CLASS_ADVISER, TEACHER}`; `activeSchoolYear`
     present with numeric `id` and non-empty `yearLabel`.
   - Map to an **existing** `atlas_auth_accounts` row only:
     exact normalized `employeeId` match first, then exact `accountName` match.
     Deterministic single match required (zero or multiple → reject). **Never
     create, provision, or update an account** (this deliberately differs from
     the legacy `/api/v1/auth/login` EnrollPro delegation path, which must stay
     unchanged).
   - Reject `isActive === false`. Faculty accounts must additionally pass the
     existing canonical-mirror eligibility gate
     (`resolveCanonicalFacultyMirror` + `classifyFacultyLoginEligibility` from
     `local-auth.service.ts`), preserving the F-06-03 fail-closed behavior and
     its typed codes.
   - School/year parity: the account's `schoolId` is the session school; the
     school must have exactly one active non-archived
     `EnrollProSchoolYearMirror`; its EnrollPro year id must equal the payload's
     `activeSchoolYear.id` (and label must match when the mirror stores one).
     Mismatch/missing → reject with the guide's `ACTIVE_SCHOOL_YEAR_*` semantics.
   - Create the ATLAS local session exactly like a local login does: same
     `LocalAuthUser` shape (`userId`/`role`/`authSource: 'local'`/`schoolId`/
     `accountId`/`facultyId`/`email`/`employeeId`/`accountName`), same
     `JWT_SECRET`/`JWT_EXPIRES_IN` signing, same faculty `userId` convention
     (faculty → canonical mirror external id), one `COMPANION_SSO_SESSION_CREATED`
     audit row (school-scoped; metadata must contain no code/secret/identity
     payload), and one `lastLoginAt` update. Exactly one session per code.
   - Redirect to the SPA page `/auth/sso/callback` with the ATLAS token in the
     **URL fragment** (`#atlasToken=<jwt>`). The SPA consumes it immediately
     with `setLocalToken(token, false)`, strips it with
     `history.replaceState` **before any further action**, then routes by role
     (`faculty` → `/my`, otherwise `/`). The fragment must never be logged,
     persisted, or sent to any server.
2. `POST /api/v1/auth/enrollpro/callback` (JSON variant): **DEFERRED** for this
   packet (guide lists it optional). Record it as deferred in the handoff.

### 3.2 Flow B — authorize + exchange

1. SPA page `/auth/enrollpro/authorize`:
   - Reads `response_type`, `client_id`, `redirect_uri`, `state` from the URL.
   - Waits for auth hydration before deciding login state (pitfall #3); if no
     session, redirects to `/login?returnUrl=<encoded full authorize URL>`.
   - When authenticated, calls `POST /api/v1/auth/sso/authorize` with the
     bearer JWT and `{ response_type, client_id, redirect_uri, state }`, then
     performs `window.location.assign(response.callbackUrl)`.
2. `POST /api/v1/auth/sso/authorize` (JWT-authed; privileged local role only —
   reuse `hasPrivilegedRole` semantics from `middleware/authorize.ts`;
   non-privileged → typed 403, zero code rows):
   - Strict validation: `response_type === 'code'`; `client_id === 'enrollpro'`;
     `redirect_uri` exactly equals `ENROLLPRO_SSO_CALLBACK_URL`; `state` is a
     non-empty bounded string. Anything else → typed 400 with no redirect and
     zero code rows (open-redirect rejection).
   - Issue a one-time code: 32 random bytes → 43 base64url chars. Persist
     **only** its SHA-256 hex hash plus `userId` (local account), `audience`
     `'enrollpro'`, exact `redirectUri`, `expiresAt = now + 60s`.
   - Return `{ callbackUrl: '<ENROLLPRO_SSO_CALLBACK_URL>?code=<code>&state=<unchanged state>' }`.
     The code appears only in this authenticated response and the subsequent
     browser redirect to EnrollPro.
3. `POST /api/v1/auth/sso/exchange` (Bearer reverse secret; **no** browser JWT):
   - Constant-time secret compare (`crypto.timingSafeEqual` with a length
     guard) against `ATLAS_SSO_REVERSE_CLIENT_SECRET` (accepted legacy alias
     `ENROLLPRO_REVERSE_CLIENT_SECRET`); log only which env name matched, never
     the value. Missing/bad secret → 401 `COMPANION_SSO_CLIENT_INVALID`.
   - Body `{ code, clientId, redirectUri }`: strict shape validation; require
     `clientId === 'enrollpro'` and `redirectUri` exactly equal to
     `ENROLLPRO_SSO_CALLBACK_URL`.
   - **Atomic consume** (single SQL statement, not read-then-update):
     `updateMany({ where: { codeHash, consumedAt: null, expiresAt: { gt: now }, audience: 'enrollpro', redirectUri }, data: { consumedAt: now } })`;
     require `count === 1`, else return exactly
     `401 {"code":"COMPANION_SSO_CODE_INVALID","message":"The SSO authorization code is invalid, expired, or already used."}`.
   - On success return the guide §5.6 assertion:
     `{ success: true, issuer: 'ATLAS', identity: { subject: 'ATLAS_USER:<stable account id>', employeeId, lrn: null, firstName, middleName: null, lastName, roles: [<existing ATLAS role>] }, activeSchoolYear: { id: <EnrollPro year id from the active mirror>, yearLabel: <mirror label> }, authenticatedAt }`.
     `identity.subject` must be ATLAS's own stable identifier (never copy
     EnrollPro's subject). The local account's stored role is authoritative;
     EnrollPro roles never elevate it. Normalize `employeeId` when the account
     lacks it? **No** — do not fabricate identity fields; if a required
     assertion field is absent locally, return the typed account-unavailable
     error instead of inventing data.
   - Exactly one successful exchange per code under concurrency; two
     concurrent identical exchanges must yield exactly one `200` and one typed
     `401`; no retry of an ambiguously consumed code.
   - Successful exchange writes exactly one `COMPANION_SSO_CODE_CONSUMED`
     audit row (school-scoped; no code/secret/identity metadata). A failed
     consume writes no success audit.

### 3.3 Identity/session preservation

- Existing local login (`POST /api/v1/auth/login`), `GET /api/v1/auth/me`,
  bridge-token behavior, the client `atlas_local_token`/`atlas_bridge_token`
  storage keys, the `atlasAuthToken` cookie helper, and the token-epoch
  subscription in `atlas-client/src/lib/auth.ts` must be behavior-identical.
  You may only add a minimal additive export (e.g., an exported session-token
  issuer) to `local-auth.service.ts`; do not alter existing functions.
- `atlas-client/src/pages/Login.tsx`: add **only** additive `returnUrl`
  handling (safe same-origin relative path validation: must start with `/`,
  must not start with `//`, no scheme/host) so the authorize page resumes
  after login. Do not change credential submission, remember-me, or landing
  logic when no `returnUrl` is present.

### 3.4 Integrated Systems AppShell area

- New dedicated component(s) under `atlas-client/src/components/app-shell/`
  plus a dedicated config/helper module (e.g. `integrated-systems.ts` under
  `components/app-shell/` or `lib/`).
- Placement per guide §4.5: after primary nav, before system administration
  (the profile/back-to-EnrollPro area) in the desktop sidebar and the mobile
  navigation drawer; use existing shadcn-style primitives and the established
  no-scroll layout. Keep files under the 1000-line rule.
- Items, in order AIMS, SMART, ATLAS, MRF:
  - ATLAS: non-clickable, labeled "Current system" (aria-current), visually
    distinct but not disabled-looking.
  - EnrollPro: enabled for authenticated privileged staff (same predicate as
    the client `isAdmin` check); same-tab navigation to
    `VITE_ENROLLPRO_SSO_START_URL` if set, else
    `(VITE_ENROLLPRO_URL ?? 'http://100.88.55.125:5173') + '/api/auth/companion-sso/atlas/reverse/start'`.
    Never link to an EnrollPro dashboard URL.
  - AIMS/SMART/MRF: disabled with plain text such as "Available after direct
    federation" — no raw companion URLs anywhere.
- Errors are plain and recoverable; never render raw upstream responses,
  codes, secrets, assertions, or callback URLs.

### 3.5 Error contract

- Use the guide §8 stable codes. Flow A callback failures render the SPA
  `/auth/sso/callback` page with a plain message and a "Return to sign in"
  affordance; the SPA page must strip `code`/`state` from the URL before
  rendering.
- Flow B exchange invalid-code response body must be exactly the guide's JSON.
- Never log or return the code, secrets, full callback URL on errors, raw
  upstream bodies, or JWT/identity payloads.

## 4. Schema boundary

- You may add the `CompanionSsoCode` model (`companion_sso_codes` table;
  `codeHash` unique, `userId` FK, `audience`, `redirectUri`, `expiresAt`,
  `consumedAt`, `createdAt`) and the back-relation on `AtlasAuthAccount` in
  `prisma/schema.prisma`, plus a **migration SOURCE** under
  `prisma/migrations/0002_companion_sso_code/`.
- Generate/verify the migration only against a **disposable** PostgreSQL
  database using repository conventions. Column names must match ORM field
  mappings (pitfall #2). **Never** run any command against the live/shared
  database; never apply migration 0002 anywhere outside the disposable target.
- Record the disposable database name and the migration count in the handoff.

## 5. Mandatory proofs (trace table rows; mounted routes, disposable PG)

1. Flow A happy path: real mounted `GET /api/v1/auth/enrollpro/callback` with a
   stubbed EnrollPro (ephemeral localhost HTTP stub via `ENROLLPRO_BASE_URL`)
   → existing local account mapped, one `COMPANION_SSO_SESSION_CREATED` audit
   row, one `lastLoginAt` update, SPA redirect with fragment token.
2. Flow A invalid/missing JWT-independent rejects: malformed/expired/replayed
   code, wrong companion, wrong audience/user, upstream unreachable
   (`COMPANION_SSO_UNREACHABLE`, no session, no partial writes).
3. Flow A account failures: unknown account, ambiguous multi-match, inactive
   account, disallowed role (MRF/LEARNER/unknown), faculty canonical-mirror
   failure — zero session/audit writes on each rejection.
4. Flow A school-year parity: missing mirror, mismatched year id, mismatched
   label → typed rejection with zero writes; matching mirror passes.
5. Flow B authorize route matrix: missing/invalid JWT, non-privileged role,
   system token rejection, malformed `response_type`/`client_id`/
   `redirect_uri`/`state` (incl. open-redirect attempts) → typed rejections,
   zero code rows, zero redirect.
6. Flow B issue→exchange happy path: mounted exchange with the exact Bearer
   secret → 200 assertion `{success, issuer:'ATLAS', identity.subject:'ATLAS_USER:*', activeSchoolYear}`;
   exactly one consumed row; exactly one `COMPANION_SSO_CODE_CONSUMED` audit.
7. Flow B exchange negatives: missing/wrong secret (incl. wrong length),
   malformed code, expired code, replayed code, wrong `clientId`, wrong
   `redirectUri`, wrong audience → the exact invalid-code JSON, zero success
   audits.
8. Concurrency: two concurrent exchanges of one code → exactly one `200`,
   one typed `401`; exactly one consumed row; exactly one success audit.
9. Zero plaintext codes at rest: no `companion_sso_codes` row contains the
   plaintext code; `codeHash` matches `^[0-9a-f]{64}$`.
10. No leak: captured responses (all error paths) and captured logs contain no
    code, secret, identity payload, or callback URL; the fragment token never
    appears in server logs.
11. Regression: existing `POST /api/v1/auth/login` and `GET /api/v1/auth/me`
    suites still pass; bridge-token capture behavior unchanged.
12. Client: callback fragment consumption strips the URL before navigation;
    authorize page waits for hydration and resumes via `returnUrl`; Integrated
    Systems renders the four systems with correct enabled/disabled semantics
    and zero raw companion URLs (assert rendered output, not source strings).
13. Gates: server + client `tsc`, production builds, isolated built-server
    startup (no live ports; use an isolated port), `git diff --check`, and
    disposable-PostgreSQL cleanup with zero residue.

## 6. Forbidden

- No live/shared database write, migration apply, seed, or reset.
- No shared runtime interaction (5001/5174), no deployment, no Windows task,
  no durable env mutation.
- No live login / live SSO exchange / browser automation against the shared
  Tailnet runtime for this packet.
- No edits to `atlas-client/src/types.ts`, timetable, Teaching Load,
  generation, publication, rollover, term-cache, runtime-supervisor files,
  `CHANGELOG.md`, the living register, the runtime map, or `AGENTS.md`.
- No companion-repository edits of any kind.
- Never commit secrets, tokens, real credential values, or the local
  `COMPANION-SSO-INTEGRATION-GUIDE.md` copy (keep it untracked).

## 7. Environment contract (documented, NOT configured here)

Server: `ENROLLPRO_BASE_URL`, `ENROLLPRO_SSO_CLIENT_SECRET` (alias
`ATLAS_SSO_CLIENT_SECRET`), `ENROLLPRO_SSO_CALLBACK_URL`,
`ATLAS_SSO_REVERSE_CLIENT_SECRET` (alias `ENROLLPRO_REVERSE_CLIENT_SECRET`).
Client: `VITE_ENROLLPRO_SSO_START_URL` (fallback as in §3.4).
The handoff must include the EnrollPro-side onboarding checklist (callback
URL, outbound secret, reverse authorize/exchange URLs, reverse client id,
reverse secret) as documentation only.

## 8. Return contract

- Worktree `D:/ATLAS-worktrees/companion-sso-c01`, branch
  `work/companion-sso-c01`, base = the `origin/main` SHA recorded at dispatch.
- Commit the bounded candidate (conventional commit(s); no amend/force after
  handoff) plus one handoff at `docs/handoffs/companion-sso-c01-executor.md`
  containing: base/candidate SHAs, complete changed-path list, the
  requirement→production path→negative control→verification-command trace
  table with PASS/BLOCKED/DEFERRED per row, decisive test commands and counts,
  disposable-DB identity, deferred items (Flow A POST variant), known risks,
  and `REVIEW_REQUIRED`. Do not stage `AGENTS.md` or the untracked guide copy.
- Do not merge, rebase onto newer main, push, or self-accept.
- Fresh independent security-focused QA follows on the frozen range; a bounded
  correction round may be dispatched on the same branch.
