# COMPANION-SSO-LIVE-PREP-C02 — preparation evidence

Status: `REVIEW_REQUIRED` (preparation candidate, frozen by the executor).
Governing packet: `docs/prompts/companion-sso-live-prep-c02-2026-09-15.md`.
Executor handoff: `docs/handoffs/companion-sso-live-prep-c02-executor.md`.
Prepared HIGH packets:
`docs/prompts/companion-sso-migration-live-c02-2026-09-15.md`,
`docs/prompts/companion-sso-runtime-activation-c02-2026-09-15.md`.
Companion handoff:
`docs/handoffs/enrollpro-sso-contract-corrections-2026-09-15.md`.

This document is evidence only. It is not approval for any live action.

## 0. Claim tags

Every material row is tagged:

- `REQUIREMENT` — a rule this preparation packet must satisfy.
- `CURRENT_STATE` — an observed fact at the capture boundary below.
- `SUCCESSOR` — work that is **not** done and is owned by a later packet.
- `HISTORICAL` — superseded/prior evidence retained for continuity.

A `CURRENT_STATE` row must never contain unfinished `SUCCESSOR` work. Section 12
lints that invariant.

Capture boundary: **2026-09-15, ~04:05Z / ~12:05 Asia/Manila**, host
`LAPTOP-6K65A1QI`. Time-sensitive rows are marked.

## 1. Identity (REQUIREMENT / CURRENT_STATE)

| Item | Value | Tag |
| --- | --- | --- |
| Worktree | `E:/ATLAS-worktrees/companion-sso-live-prep-c02` | CURRENT_STATE |
| Branch | `work/companion-sso-live-prep-c02` | CURRENT_STATE |
| Dispatch base (branch-additive base) | `6409a2a8c2977a7e96db114b1d1a2d84a0d01afb` | CURRENT_STATE |
| Prompt-authoring base | `234046f80effa5b963295bb27f83a90020b4f544` | HISTORICAL |
| Refreshed `origin/main` at executor turn | `53a781a4fdb6e254bd1277c47fcef0700e0e769d` (capture-boundary observation; superseded by the correction-time tip `0c20342394ca2ca800cecc6dd69825e07625c66d` — see §6.4 Correction 1) | HISTORICAL |
| Merge-base with `origin/main` | `234046f80effa5b963295bb27f83a90020b4f544` | CURRENT_STATE |
| Drift `234046f8..origin/main` | docs-only (10 files: `docs/plans/*`, `docs/prompts/term-cache-catchup-apply-2026-09-14.md`, `docs/reviews/workflow-foundation-wfc01/*`); no product tree | CURRENT_STATE |
| Required ancestor `c989f03d` (merge) | `c989f03d67fa246ac8b168a59012a7615458be4f`, parents `a284d775` + `fbb9dc63`; `git merge-base --is-ancestor` exit 0 vs `origin/main` | CURRENT_STATE |
| Directive `origin/main:AGENTS.md` LF-normalized SHA-256 | `5f9206708a4763376dda1943c1ead28f49427ed1b1f0532ad25661f74ed3ebb5` (UTF-8, CRLF→LF; blob 168,022 bytes) | CURRENT_STATE |
| Directive at prompt authoring (packet recorded) | `0cf68d62d9c6c6bb37b737c6038118a8eed7efc2d403a2100de9d64f02c871d6` | HISTORICAL |
| Directive resolution | the newer `5f920670…` wins; recorded in this handoff and both prepared packets | REQUIREMENT |
| `E:` free space | 79,528,701,952 bytes (≈74.1 GiB) | CURRENT_STATE |
| `D:` free space | 35,032,186,880 bytes (≈32.6 GiB) | CURRENT_STATE |
| `C:` free space | 18,480,996,352 bytes (≈17.2 GiB) | CURRENT_STATE |
| PostgreSQL volume | local instance on `:5432` (`D:`-hosted data dir per register) | CURRENT_STATE |
| PostgreSQL 18 binaries | `D:\PostgreSQL\18\bin\` (`psql.exe`, `createdb.exe`, `dropdb.exe`, `pg_dump.exe` present; not on PATH) | CURRENT_STATE |

Worktree cleanliness at start: `git status --porcelain=v2` empty,
`git diff --quiet` exit 0.

### 1.1 Companion mirrors (READ_ONLY) (CURRENT_STATE)

| Mirror | Local HEAD | `git status --porcelain` lines | Tag |
| --- | --- | --- | --- |
| `D:/EnrollPro` (`https://github.com/njgrm/EnrollPro.git`, branch `main`) | `5887d685b834db31600be258e96be3bdd0bccacb` | 0 | CURRENT_STATE |
| `D:/AIMS` | `2332d92ef3395ae65e9a067bd8ef6cce1191940c` | 0 | CURRENT_STATE |
| `D:/smart-final-capstone` | `1bda23399204414f8d21c9fddbdf6b41a8e440d4` | 0 | CURRENT_STATE |

All three were already clean at the observed SHAs; no fetch, fast-forward, edit,
install, migration, seed, snapshot, or history rewrite was performed this turn.
(SMART remote `main` observation at packet authoring was `065600a6…`; the local
mirror was left untouched at `1bda2339…` — HISTORICAL/observed, not updated.)

## 2. ATLAS production surface inventory (CURRENT_STATE)

All file:line references are against the dispatch base `6409a2a8` tree.

### 2.1 Server routes (mount `atlas-server/src/app.ts:103` → `/api/v1/auth`)

| Flow | Method + path | Source | Tag |
| --- | --- | --- | --- |
| A — EnrollPro launch callback | `GET /api/v1/auth/enrollpro/callback` | `atlas-server/src/routes/auth.router.ts:82` | CURRENT_STATE |
| B — issue one-time reverse code | `POST /api/v1/auth/sso/authorize` | `atlas-server/src/routes/auth.router.ts:109` | CURRENT_STATE |
| B — consume code / return assertion | `POST /api/v1/auth/sso/exchange` | `atlas-server/src/routes/auth.router.ts:150` | CURRENT_STATE |
| SPA result page | `GET /auth/sso/callback` (client route) | `atlas-client/src/App.tsx:62`, `atlas-server/src/routes/auth.router.ts:20` | CURRENT_STATE |
| SPA authorize page | `GET /auth/enrollpro/authorize` (client route) | `atlas-client/src/App.tsx:66` | CURRENT_STATE |

### 2.2 Environment readers (CURRENT_STATE)

| Concern | Key(s) read | Source | Notes |
| --- | --- | --- | --- |
| Outbound EnrollPro secret (Flow A exchange) | `ENROLLPRO_SSO_CLIENT_SECRET`, legacy alias `ATLAS_SSO_CLIENT_SECRET` | `atlas-server/src/services/companion-sso.service.ts:113-119` | canonical wins; value never logged |
| Inbound reverse secret (Flow B exchange) | `ATLAS_SSO_REVERSE_CLIENT_SECRET`, legacy alias `ENROLLPRO_REVERSE_CLIENT_SECRET` | `atlas-server/src/services/companion-sso.service.ts:122-128` | constant-time compare, returns only the matching env **name** |
| EnrollPro server base | `ENROLLPRO_BASE_URL` | `atlas-server/src/services/companion-sso.service.ts:131-135` | trailing `/` trimmed; comment allows an included `/api` |
| EnrollPro reverse callback (exact redirect binding) | `ENROLLPRO_SSO_CALLBACK_URL` | `atlas-server/src/services/companion-sso.service.ts:137-139`; exact match enforced at `:566` and `:693` | must equal EnrollPro's computed redirect URI byte-for-byte |
| Client EnrollPro origin | `VITE_ENROLLPRO_URL` | `atlas-client/src/lib/companion-config.ts:28-32` | fail-closed to `null`; no raw-IP default |
| Client explicit reverse-start override | `VITE_ENROLLPRO_SSO_START_URL` | `atlas-client/src/lib/companion-config.ts:55-59` | wins over the derived path |
| Derived reverse-start path | `/api/auth/companion-sso/atlas/reverse/start` | `atlas-client/src/lib/companion-config.ts:12` | appended to `VITE_ENROLLPRO_URL` |

### 2.3 Persistence, migration, and UI entry points (CURRENT_STATE)

| Item | Source | Tag |
| --- | --- | --- |
| Prisma model `CompanionSsoCode` → `companion_sso_codes` | `prisma/schema.prisma:338-355` | CURRENT_STATE |
| FK `CompanionSsoCode.user` → `AtlasAuthAccount` (`onDelete: Cascade`) | `prisma/schema.prisma:350`; `atlas_auth_accounts` at `:308-331` | CURRENT_STATE |
| Migration `0002_companion_sso_code` | `prisma/migrations/0002_companion_sso_code/migration.sql` | CURRENT_STATE |
| AppShell Integrated Systems area | `atlas-client/src/components/app-shell/AppSidebar.tsx:224-225`; `IntegratedSystems.tsx:73-93`; `MobileNavigationDrawer.tsx:72-75` | CURRENT_STATE |
| Integrated Systems catalog (AIMS/SMART/ATLAS/MRF; EnrollPro only enabled companion) | `atlas-client/src/lib/integrated-systems.ts:37-51`; disabled rows asserted rendered in `atlas-client/src/lib/__tests__/companion-sso-client.test.ts:66-84` | CURRENT_STATE |
| Mounted SSO tests | `atlas-server/src/__tests__/companion-sso-http.test.ts` (18 tests); `atlas-client/src/lib/__tests__/companion-sso-client.test.ts` (14 tests); `atlas-client/src/lib/__tests__/companion-config.test.ts` | CURRENT_STATE |

### 2.4 AIMS/SMART in the ATLAS Integrated Systems area (CURRENT_STATE)

AIMS, SMART, and MRF are deliberately disabled plain-text rows with the reason
`Available after direct federation` (`integrated-systems.ts:41-44`); the ATLAS
row is the non-clickable current system. This preparation cycle does **not**
enable them and does not expand into companion-to-companion federation
(`REQUIREMENT`, satisfied).

## 3. ATLAS-side gate results (CURRENT_STATE)

| Gate | Command | Result | Tag |
| --- | --- | --- | --- |
| Server mounted SSO suite | `npx tsx --test src/__tests__/companion-sso-http.test.ts` (`atlas-server`, `DATABASE_URL`=disposable, `JWT_SECRET` set) | **18 / 18 pass, 0 fail** — see §5 | CURRENT_STATE |
| Client SSO suite | `npx tsx --test src/lib/__tests__/companion-sso-client.test.ts` (`atlas-client`) | **14 / 14 pass, 0 fail** | CURRENT_STATE |
| Server typecheck | `npx tsc --noEmit` (`atlas-server`) | exit 0 | CURRENT_STATE |
| Client typecheck | `npx tsc --noEmit` (`atlas-client`) | exit 0 | CURRENT_STATE |
| Server build | `npm run build` (`atlas-server`) | exit 0 | CURRENT_STATE |
| Client build | `npm run build` (`atlas-client`) | exit 0 (`✓ built in 23.34s`) | CURRENT_STATE |
| Isolated built-server startup | `node dist/server.js`, `PORT=5317`, `ROLLOVER_AUTO_SYNC_ENABLED=false`, disposable `DATABASE_URL` | `GET http://127.0.0.1:5317/api/v1/health` → **200** `{"status":"ok","service":"atlas"}`; process stopped; port 5317 released; sentinel listeners 5001/5174 retained their PIDs (19792 / 19000) | CURRENT_STATE |
| Whitespace check | `git diff --check` | clean (see handoff for the final post-commit run) | CURRENT_STATE |

Dependency tree: the isolated `node_modules` trees were created during this
preparation cycle's execution turn on 2026-09-15 (Asia/Manila) — root
`node_modules` 11:12:57, `atlas-server/node_modules` 11:10:21,
`atlas-client/node_modules` 11:11:01 — from the committed lockfiles
(`atlas-server/package-lock.json` SHA-256
`ecf06aef5c385591a0cf4c03f6852018b283182375f9b23656210bf13794b6e5`;
`atlas-client/package-lock.json` SHA-256
`ce1ae84ed088be75f27542cb039abf338395ece1c9e9a5d2139c2c65cf3b9f1e`). They were
not a pre-existing shared dependency tree carried over from an older checkout.
All seven gates above executed against that tree and passed; no shared junction
or shared dependency tree was used, and the runner did not re-run `npm ci` (it
would have rebuilt a byte-identical tree). The isolated install is therefore
validated by execution rather than asserted. (Note for reviewers: `node_modules`
is gitignored and is not part of the candidate.)

Localhost use in this table is an **isolated non-browser test harness** only; it
is not browser evidence.

## 4. EnrollPro contract inspection (READ_ONLY) (CURRENT_STATE)

Inspected EnrollPro mirror SHA `5887d685b834db31600be258e96be3bdd0bccacb`,
production source only (guides, `.env.example`, and `docs/` treated as claims,
not authority).

### 4.1 EnrollPro mounts

EnrollPro mounts its auth router under `/api`
(`server/src/app.ts:179` `app.use("/api", apiRouter)` →
`server/src/features/auth/auth.router.ts`), giving:

| Method + path | Source |
| --- | --- |
| `GET /api/auth/companion-sso/catalog` (authenticated) | `auth.router.ts:59-63` |
| `POST /api/auth/companion-sso/:system/launch` (authenticated) | `auth.router.ts:64-69` |
| `POST /api/auth/companion-sso/:system/exchange` (Bearer secret) | `auth.router.ts:70-75` |
| `GET /api/auth/companion-sso/:system/reverse/start` | `auth.router.ts:76-80` |
| `GET /api/auth/companion-sso/:system/reverse/callback` | `auth.router.ts:81-85` |

`:system` is parsed case-insensitively and restricted to
`ATLAS|AIMS|SMART|MRF` (`companion-sso.service.ts:21-26`, `:200-210`).

### 4.2 Two-flow contract matrix

**Flow A — EnrollPro → ATLAS** (EnrollPro is initiator/hub; ATLAS is companion)

| Property | Value | Source |
| --- | --- | --- |
| Initiating system | EnrollPro (authenticated staff action `POST /api/auth/companion-sso/atlas/launch`) | `companion-sso.service.ts:240-356` |
| Browser URL (launch) | `${ATLAS_SSO_CALLBACK_URL}?code=<43-char>` | `companion-sso.service.ts:337-338` |
| Server exchange URL | `${ENROLLPRO_BASE_URL}/auth/companion-sso/atlas/exchange` (ATLAS → EnrollPro) | `atlas-server/.../companion-sso.service.ts:325`, called at `:328` |
| HTTP method | `POST` (JSON body `{ code }`) | `companion-sso.service.ts:328-336` |
| Auth mechanism | `Authorization: Bearer ${ENROLLPRO_SSO_CLIENT_SECRET}` (ATLAS outbound); EnrollPro compares with `safeSecretMatches` constant-time over SHA-256 digests | service `:331`; EnrollPro `companion-sso.service.ts:379-395`, `:129-133` |
| `client_id` | n/a for Flow A (bearer secret only) | — |
| Registered `redirect_uri` | `${ATLAS_SSO_CALLBACK_URL}` (ATLAS mount) | `companion-sso.service.ts:337-338` |
| State / cookie | none on Flow A; EnrollPro records `ipAddress` + `userAgent` on the code row | `companion-sso.service.ts:326-335` |
| Allowed roles | EnrollPro `ALLOWED_ROLES.ATLAS = {SYSTEM_ADMIN, HEAD_REGISTRAR, TEACHER, CLASS_ADVISER}` (`companion-sso.service.ts:28-33`); ATLAS re-filters to `{SYSTEM_ADMIN, HEAD_REGISTRAR, CLASS_ADVISER, TEACHER}` (`atlas-server/.../companion-sso.service.ts:203`, `:270`) — **intersection is the same four roles** | CURRENT_STATE |
| Active-year fields | EnrollPro returns `activeSchoolYear: { id, yearLabel }` from the resolved active year; ATLAS requires positive integer `id` + non-empty `yearLabel` (`atlas-server/.../companion-sso.service.ts:274-278`) and exact parity with exactly one active, non-archived `enrollpro_school_year_mirrors` row for the account's school (`:505-528`) | CURRENT_STATE |
| One-time-code lifetime | 60,000 ms (`AUTHORIZATION_CODE_TTL_MS`, `companion-sso.service.ts:20`); ATLAS mirror constant `:37` | CURRENT_STATE |
| Replay behavior | atomic `updateMany` predicate on `(id, companion, consumedAt=null, expiresAt>now)`; exactly one winner (`companion-sso.service.ts:446-461`) inside a `Serializable` transaction (`:405-491`) | CURRENT_STATE |
| Expected success writes (EnrollPro) | 1 `companion_sso_authorization_codes` insert at launch; `consumedAt` set at exchange; audit `COMPANION_SSO_LAUNCHED` / `COMPANION_SSO_EXCHANGED` | CURRENT_STATE |
| Expected success writes (ATLAS) | `atlas_auth_accounts.lastLoginAt` + `facultyId` update (`:404-407`), 1 `audit_logs` row `COMPANION_SSO_SESSION_CREATED` (`:409-420`); never creates an account (`:296-303`, `:453-480`) | CURRENT_STATE |
| Typed failures (ATLAS) | `COMPANION_SSO_NOT_CONFIGURED` 503, `COMPANION_SSO_UNREACHABLE` 503, `COMPANION_SSO_CODE_INVALID` 401, `COMPANION_SSO_IDENTITY_INCOMPLETE` 401/403, `COMPANION_SSO_ACCOUNT_UNAVAILABLE` 401/403, `COMPANION_SSO_ROLE_DENIED` 403, `COMPANION_SSO_COMPLETER_BLOCKED` 403, `ACTIVE_SCHOOL_YEAR_REQUIRED` 409, `ACTIVE_SCHOOL_YEAR_CONFLICT` 409 (`atlas-server/.../companion-sso.service.ts:56-81`) | CURRENT_STATE |
| Typed failures (EnrollPro) | `COMPANION_SSO_NOT_CONFIGURED` 503, `COMPANION_SSO_CLIENT_INVALID` 401, `COMPANION_SSO_CODE_INVALID` 401, `COMPANION_SSO_SYSTEM_NOT_FOUND` 404, `PASSWORD_CHANGE_REQUIRED` 428, `COMPANION_SSO_ROLE_DENIED`/`_COMPLETER_BLOCKED`/`_IDENTITY_INCOMPLETE`/`_ACCOUNT_UNAVAILABLE` 403/401, `COMPANION_SSO_UNREACHABLE` 503, `COMPANION_SSO_RATE_LIMITED` 429 | CURRENT_STATE |

**Flow B — ATLAS → EnrollPro** (reverse)

| Property | Value | Source |
| --- | --- | --- |
| Initiating system | ATLAS privileged operator (Integrated Systems → EnrollPro row) | `IntegratedSystems.tsx:73-93`; `companion-config.ts:12` |
| Browser URL (start) | `${VITE_ENROLLPRO_URL}/api/auth/companion-sso/atlas/reverse/start` (or explicit `VITE_ENROLLPRO_SSO_START_URL`) | `companion-config.ts:12`, `:55-59` |
| EnrollPro → browser redirect | `303` to `${ATLAS_SSO_REVERSE_AUTHORIZE_URL}?response_type=code&client_id=${ATLAS_SSO_REVERSE_CLIENT_ID}&redirect_uri=${ENROLLPRO_PUBLIC_URL}/api/auth/companion-sso/atlas/reverse/callback&state=<jwt>` | `companion-sso-reverse.service.ts:237-267`; `companion-sso.controller.ts:91-97` |
| Server exchange URL | `${ENROLLPRO_BASE_URL}/api/v1/auth/sso/exchange` (EnrollPro → ATLAS) | `companion-sso-reverse.service.ts:290-303` |
| HTTP method | `POST` (JSON body `{ code, clientId, redirectUri }`) | `companion-sso-reverse.service.ts:297-301` |
| Auth mechanism | `Authorization: Bearer ${ATLAS_SSO_REVERSE_CLIENT_SECRET}` (EnrollPro → ATLAS) compared constant-time at ATLAS `auth.router.ts:150-157` | CURRENT_STATE |
| `client_id` | `${ATLAS_SSO_REVERSE_CLIENT_ID}`; ATLAS requires exactly `enrollpro` (`companion-sso.service.ts:42`, `:556`, `:693`) | CURRENT_STATE |
| Registered `redirect_uri` | `${ENROLLPRO_PUBLIC_URL}/api/auth/companion-sso/atlas/reverse/callback` (computed, `companion-sso-reverse.service.ts:167-172`); ATLAS requires it to equal `ENROLLPRO_SSO_CALLBACK_URL` exactly (`:566`, `:693`) | CURRENT_STATE |
| State / cookie | 24-byte base64url nonce in a JWT (`aud=enrollpro-companion-reverse-sso`, `purpose=COMPANION_REVERSE_SSO`, TTL 300 s) mirrored in cookie `enrollpro_reverse_sso_atlas` (httpOnly, sameSite=lax, path `/api/auth/companion-sso`, secure in production); both must match constant-time | `companion-sso-reverse.service.ts:17-19`, `:163-235`; `companion-sso.controller.ts:68-97` |
| Allowed roles | EnrollPro staff set `{SYSTEM_ADMIN, HEAD_REGISTRAR, TEACHER, CLASS_ADVISER}` (`companion-sso-reverse.service.ts:21-26`); ATLAS authorizer requires `admin|officer|SYSTEM_ADMIN` (`middleware/authorize.ts:3-8`) | CURRENT_STATE |
| Active-year fields | ATLAS assertion `activeSchoolYear: { id, yearLabel }` must equal EnrollPro's resolved active year or `COMPANION_REVERSE_SSO_SCHOOL_YEAR_MISMATCH` 409 (`companion-sso-reverse.service.ts:548-557`) | CURRENT_STATE |
| One-time-code lifetime | ATLAS 60,000 ms (`COMPANION_SSO_CODE_TTL_MS`) | CURRENT_STATE |
| Replay behavior | ATLAS single atomic `updateMany` (`:663-673`); EnrollPro reverse flow separately enforces single-use of the ATLAS code | CURRENT_STATE |
| Expected success writes (ATLAS) | 1 `companion_sso_codes` insert then `consumedAt`; 1 `audit_logs` row `COMPANION_SSO_CODE_CONSUMED` | CURRENT_STATE |
| Expected success writes (EnrollPro) | `companion_identity_links` insert/update + `users.lastLoginAt`; `SESSION` issue via `issueAuthSession`; audit `COMPANION_REVERSE_SSO_LOGIN` | `companion-sso-reverse.service.ts:478-508`, `:565-575`; `companion-sso.controller.ts:155-161` |
| Landing route after success | `/dashboard` for `SYSTEM_ADMIN`/`HEAD_REGISTRAR`, else `/teacher/advisory` | `companion-sso-reverse.service.ts:602-607` |
| Typed failures | `COMPANION_REVERSE_SSO_NOT_CONFIGURED` 503, `_STATE_INVALID` 401, `_CODE_INVALID` 401, `_ACCESS_DENIED` 403, `_ACCOUNT_UNAVAILABLE` 401, `_COMPLETER_BLOCKED` 403, `_ROLE_DENIED` 403, `_LINK_REQUIRED`/`_IDENTITY_CONFLICT` 409, `_UNAVAILABLE` 503, `_RESPONSE_INVALID` 502, `PASSWORD_CHANGE_REQUIRED` 428; browser receives `/personnel/login?ssoError=<code>&source=ATLAS` | `companion-sso-reverse.service.ts:129-134`, `:304-365`, `:391-421`, `:444-451`; `companion-sso.controller.ts:110`, `:178` |

### 4.3 EnrollPro-configured ATLAS URL classification

Real ATLAS mounts used for classification: Flow A `GET /api/v1/auth/enrollpro/callback`;
Flow B page `GET /auth/enrollpro/authorize`; Flow B authorize API
`POST /api/v1/auth/sso/authorize`; Flow B exchange API `POST /api/v1/auth/sso/exchange`.

| EnrollPro key | Claimed value(s) in `server/.env.example` | Real ATLAS mount | Class |
| --- | --- | --- | --- |
| `ATLAS_SSO_CALLBACK_URL` | `https://njgrm.buru-degree.ts.net/auth/enrollpro/callback` (`.env.example:36`) | `https://njgrm.buru-degree.ts.net/api/v1/auth/enrollpro/callback` | **MISMATCH** (missing `/api/v1`) |
| `ATLAS_SSO_REVERSE_AUTHORIZE_URL` (block 1) | `https://configured-atlas-host/auth/enrollpro/authorize` (`.env.example:38`) | `https://njgrm.buru-degree.ts.net/auth/enrollpro/authorize` | **UNPROVEN** (placeholder host; path correct) |
| `ATLAS_SSO_REVERSE_AUTHORIZE_URL` (block 2, duplicate) | `https://njgrm.buru-degree.ts.net/auth/sso/authorize` (`.env.example:66`) | `https://njgrm.buru-degree.ts.net/auth/enrollpro/authorize` | **MISMATCH** (wrong path) |
| `ATLAS_SSO_REVERSE_EXCHANGE_URL` (block 1) | `https://configured-atlas-host/api/auth/enrollpro/exchange` (`.env.example:39`) | `https://njgrm.buru-degree.ts.net/api/v1/auth/sso/exchange` | **MISMATCH** |
| `ATLAS_SSO_REVERSE_EXCHANGE_URL` (block 2, duplicate) | `https://njgrm.buru-degree.ts.net/auth/sso/exchange` (`.env.example:67`) | `https://njgrm.buru-degree.ts.net/api/v1/auth/sso/exchange` | **MISMATCH** |
| `ATLAS_SSO_REVERSE_CLIENT_ID` (block 1) | `enrollpro` (`.env.example:40`) | ATLAS requires `enrollpro` | **MATCH** |
| `ATLAS_SSO_REVERSE_CLIENT_ID` (block 2, duplicate) | `enrollpro_client_id` (`.env.example:68`) | ATLAS requires `enrollpro` | **MISMATCH** |
| `ATLAS_SSO_CLIENT_SECRET` | `replace_with_a_distinct_32_character_secret` (`.env.example:37`) | ATLAS `ENROLLPRO_SSO_CLIENT_SECRET` (or alias) | **UNPROVEN** (placeholder; operator value required) |
| `ATLAS_SSO_REVERSE_CLIENT_SECRET` | `replace_with_a_distinct_reverse_32_character_secret` (`.env.example:41`) / `replace_this_with_a_secure_32_character_minimum_random_string` (`.env.example:69`) | ATLAS `ATLAS_SSO_REVERSE_CLIENT_SECRET` (or alias) | **UNPROVEN** (placeholder; operator value required) |
| Reverse callback derived by EnrollPro | `{ENROLLPRO_PUBLIC_URL}/api/auth/companion-sso/atlas/reverse/callback` | ATLAS `ENROLLPRO_SSO_CALLBACK_URL` must equal it exactly | **UNPROVEN** (production `ENROLLPRO_PUBLIC_URL` not present in the mirror) |
| ATLAS outbound base | ATLAS `ENROLLPRO_BASE_URL` + `/auth/companion-sso/atlas/exchange` | EnrollPro `POST /api/auth/companion-sso/atlas/exchange` | **UNPROVEN** (key ABSENT at runtime; server base must end with `/api`) |
| ATLAS client reverse-start | `{VITE_ENROLLPRO_URL}/api/auth/companion-sso/atlas/reverse/start` | EnrollPro `GET /api/auth/companion-sso/atlas/reverse/start` | path **MATCH**; origin **UNPROVEN** (`VITE_ENROLLPRO_URL` absent in the worktree) |

Do not accept `configured-atlas-host` placeholders, `/api/auth/enrollpro/exchange`,
`/auth/sso/authorize`, or `/auth/sso/exchange` as current ATLAS contracts. They
appear only in EnrollPro examples or duplicate example blocks and contradict the
real mounts. `.env.example` also declares `ATLAS_API_KEY` twice (lines 41-42
region and later), which is a documentation defect only.

### 4.4 EnrollPro defect summary (feeds the companion handoff)

1. `server/.env.example` contains **two contradictory ATLAS reverse blocks**
   (`:36-41` and `:66-69`); both are wrong for the real ATLAS mounts except the
   block-1 `client_id`.
2. `ATLAS_SSO_CALLBACK_URL` example omits `/api/v1`.
3. **Cross-system role-vocabulary mismatch** (see §4.5) — EnrollPro rejects a
   valid ATLAS reverse assertion when the ATLAS account role is stored in the
   lowercase production vocabulary.

### 4.5 Decisive contract mismatch: reverse-assertion role vocabulary (CURRENT_STATE)

| Evidence | Detail |
| --- | --- |
| EnrollPro schema | `shared/src/schemas/companion-sso.schema.ts:63-80` — `companionSsoReverseExchangeResponseSchema` requires `identity.roles: z.array(RoleEnum).min(1)` and `firstName`/`lastName` each `z.string().min(1)` |
| EnrollPro vocabulary | `shared/src/constants/index.ts:4-11` — `RoleEnum = ["SYSTEM_ADMIN","HEAD_REGISTRAR","CLASS_ADVISER","TEACHER","LEARNER","MRF"]` (uppercase, case-sensitive) |
| EnrollPro enforcement | `companion-sso-reverse.service.ts:351-365` — `safeParse` failure → `502 COMPANION_REVERSE_SSO_RESPONSE_INVALID` |
| ATLAS output | `atlas-server/src/services/companion-sso.service.ts:784` — `roles: [account.role]` (raw stored value); `:801-818` — `resolveAccountNameParts` falls back to `''`/`''` when neither a faculty row nor `accountName` exists |
| Live ATLAS role values | measured read-only on `atlas_recovery_clean_rebuild_20260905`: **`faculty`=42, `officer`=2** (lowercase); no uppercase role rows exist |
| Consequence | Flow B (ATLAS → EnrollPro) cannot complete in production: the ATLAS assertion `roles:["officer"|"faculty"]` fails EnrollPro's case-sensitive enum, and a name-less account also fails `firstName`/`lastName` `min(1)`. The ATLAS suite does not catch this because its fixture account is created with role `'SYSTEM_ADMIN'` (`companion-sso-http.test.ts:163`) and asserts `roles[0] === 'SYSTEM_ADMIN'` (`:521`) |

This is a production-shape contradiction: the committed ATLAS test encodes the
uppercase role, while the real producer of `atlas_auth_accounts.role` emits
lowercase. Per the production-shape equivalence gate it is a blocking
integration defect, not a non-blocking note. It is documented for correction in
`docs/handoffs/enrollpro-sso-contract-corrections-2026-09-15.md`; no product
source was edited by this preparation cycle.

### 4.6 AIMS / SMART roadmap classification (READ_ONLY) (CURRENT_STATE)

| System | Classification | Evidence |
| --- | --- | --- |
| AIMS | `CONFIGURATION_REQUIRED` | Server implementation present: `server/src/routes/auth.routes.ts:36-39` (`GET/POST /enrollpro/callback`, `POST /sso/authorize`, `POST /sso/exchange`), `server/src/services/enrollpro-sso.service.ts`, `server/src/services/enrollpro-reverse-sso.service.ts`, migration `server/prisma/migrations/20260907000001_add_companion_sso_codes/migration.sql`, client pages `client/src/pages/auth/EnrollProAuthorize.tsx` + `SsoCallback.tsx`. `server/.env.example:22,25,28` still hold placeholder secrets/URLs → configuration not established. |
| SMART | `NOT_IMPLEMENTED` | No SSO source: only `docs/SMART-ENROLLPRO-SSO.md`; no `*_SSO_*` reverse/authorize/exchange keys and no `SsoCallback`/`EnrollProAuthorize` files. `server/.env.example` keys are EnrollPro data-sync credentials only. |

Neither system's ATLAS Integrated Systems row is enabled by this cycle
(`REQUIREMENT`, satisfied). No federation scope was added.

## 5. Migration / database readiness (CURRENT_STATE)

### 5.1 Live database signatures (read-only SQL only)

Environment classification: shared/**live** operational database
`atlas_recovery_clean_rebuild_20260905` on the local PostgreSQL 18.1 instance
(`:5432`, user `atlas_user`, CREATEDB, non-superuser). No value of
`DATABASE_URL` was printed, hashed, or committed.

| Signature | Before cycle | After cycle | Delta |
| --- | --- | --- | --- |
| `_prisma_migrations` rows | 2 | 2 | 0 |
| Applied migrations | `0000_clean_baseline` (finished), `0001_term_subject_authority` (finished) | same | 0 |
| Migration `0002_companion_sso_code` | **ABSENT** | **ABSENT** | 0 |
| `public.companion_sso_codes` | **ABSENT** | **ABSENT** | 0 |
| `schools` | 2 | 2 | 0 |
| `atlas_auth_accounts` | 44 | 44 | 0 |
| `audit_logs` | 242 | 242 | 0 |
| `enrollpro_school_year_mirrors` | 2 | 2 | 0 |
| `faculty_mirrors` | 42 | 42 | 0 |
| `atlas_auth_accounts.role` distribution | `faculty`=42, `officer`=2 | same | 0 |

Zero-write proven for the live database across the whole cycle. No migration,
schema change, seed, reset, or data write touched it.

### 5.2 Disposable PostgreSQL rehearsal

Exactly one uniquely named disposable database was created, migrated, exercised,
rolled back, re-applied, and dropped in a `finally`-equivalent sequence:
`atlas_restore_drill_20260915_sso026821` (asserted ≠ the configured live
database name).

| Step | Command | Result |
| --- | --- | --- |
| Create | `createdb --maintenance-db=<live> atlas_restore_drill_20260915_sso026821` | exit 0 |
| Apply real chain through `0002` | from repo root: `DATABASE_URL=<disposable> npx prisma migrate deploy --schema prisma/schema.prisma` | applied `0000_clean_baseline`, `0001_term_subject_authority`, `0002_companion_sso_code`; "All migrations have been successfully applied." |
| Schema proof | `information_schema` / `pg_indexes` / `pg_constraint` | 10 columns exact (see below) |
| Migration status | `prisma migrate status --schema prisma/schema.prisma` | "Database schema is up to date!" |
| Idempotent replay | second `prisma migrate deploy` | "No pending migrations to apply." (no-op) |
| Mounted SSO suite | `npx tsx --test src/__tests__/companion-sso-http.test.ts` | **18/18 pass, 0 fail** (8.1 s) |
| Rollback rehearsal | `DROP TABLE IF EXISTS companion_sso_codes; DELETE FROM _prisma_migrations WHERE migration_name='0002_companion_sso_code';` | `DROP TABLE`, `DELETE 1`; table absent, migrations=2 |
| Clean re-apply | `prisma migrate deploy` | re-applied `0002_companion_sso_code`; table present, migrations=3 |
| Drop | `dropdb --if-exists atlas_restore_drill_20260915_sso026821` | exit 0 |
| Zero residue | `SELECT count(*) FROM pg_database WHERE datname LIKE 'atlas_restore_drill_20260915_sso02%'` | **0** |

Post-rollback then re-apply is the rehearsed forward-only recovery: migration
`0002` ships no down script, so the documented rollback for this table is
`DROP TABLE companion_sso_codes` plus deletion of its `_prisma_migrations` row.
The packet `COMPANION-SSO-MIGRATION-LIVE-C02` binds exactly this procedure.

`companion_sso_codes` schema proven on the disposable target:

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| `id` | integer | NO | `nextval('companion_sso_codes_id_seq')` |
| `code_hash` | varchar(64) | NO | — |
| `user_id` | integer | YES | — |
| `school_id` | integer | YES | — |
| `school_year_id` | integer | YES | — |
| `audience` | varchar(32) | NO | `'enrollpro'` |
| `redirect_uri` | varchar(512) | NO | — |
| `expires_at` | timestamp(3) without time zone | NO | — |
| `consumed_at` | timestamp(3) without time zone | YES | — |
| `created_at` | timestamp(3) without time zone | NO | `CURRENT_TIMESTAMP` |

Indexes/constraints: PK `companion_sso_codes_pkey (id)`; unique
`companion_sso_codes_code_hash_key (code_hash)`; composite
`companion_sso_codes_code_hash_consumed_at_idx (code_hash, consumed_at)`;
`companion_sso_codes_expires_at_idx (expires_at)`; FK
`companion_sso_codes_user_id_fkey (user_id) REFERENCES atlas_auth_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE`.

Migration content fingerprint (bind this, not a checkout-dependent hash):

| Item | Value |
| --- | --- |
| Path | `prisma/migrations/0002_companion_sso_code/migration.sql` |
| Git blob | `8d61bd591e564b9a686028f64dc6fc7d8e898635` |
| Git blob bytes | 1046 |
| SHA-256 of the git-blob (LF-normalized) content | `c2502e3070a98e6a6ddf4a1568cf2b3368a5cc72db2983cd02d0311012e43baf` |
| Working-tree checkout SHA-256 | `cdbc387221eaba88d40800e45bfd36fdcb00540c2b800b2e54a3c80a5bbfd05b` (1076 bytes — CRLF checkout artifact from the repository LF policy) |

The LF-normalized blob hash is the checkout-stable fingerprint and is the one
bound by the migration packet.

## 6. Configuration and release readiness (CURRENT_STATE)

### 6.1 Server configuration key matrix (names + presence only; no values)

Source: durable env `D:\ATLAS-runtime-config\atlas-server.env` (13 keys total).
Nothing was printed, hashed, or committed; key names and PRESENT/ABSENT only.

| Key | Owner | Purpose | Minimum shape | Status |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | ATLAS runtime | live DB connection | URI | PRESENT |
| `JWT_SECRET` | ATLAS runtime | local JWT signing (also reused by EnrollPro reverse-state cookies) | ≥32 chars | PRESENT |
| `ENROLLPRO_API` | ATLAS runtime | existing EnrollPro integration base | URI ending `/api` | PRESENT — host `100.120.169.123` (raw Tailnet IP), scheme `http`, path `/api` |
| `ATLAS_DEFAULT_SCHOOL_ID` | ATLAS runtime | pilot school default | integer | PRESENT |
| `ENROLLPRO_CLIENT_URL` | ATLAS runtime | client-side EnrollPro link | URI | PRESENT — host `localhost`, scheme `http` (not the Tailnet origin) |
| `ENROLLPRO_SERVICE_TOKEN` | ATLAS runtime | service auth to EnrollPro | secret | PRESENT |
| `ATLAS_AUTH_DISABLE_RATE_LIMIT` | ATLAS runtime | auth rate-limit toggle | boolean | PRESENT |
| `ATLAS_SYSTEM_TOKEN` | ATLAS runtime | system-token auth | secret | PRESENT |
| `CLIENT_URL` | ATLAS runtime | public ATLAS origin | URI | PRESENT — `https://njgrm.buru-degree.ts.net/` |
| `CORS_EXTRA_ORIGINS` | ATLAS runtime | extra CORS origins | comma list | PRESENT |
| `FACULTY_ADAPTER` | ATLAS runtime | faculty source adapter | token | PRESENT |
| `PORT` | ATLAS runtime | server port | integer (5001) | PRESENT |
| `SECTION_SOURCE_MODE` | ATLAS runtime | section source mode | token | PRESENT |
| `ENROLLPRO_BASE_URL` | ATLAS SSO outbound | EnrollPro server base for Flow A exchange | HTTPS URI ending `/api` | **ABSENT** |
| `ENROLLPRO_SSO_CLIENT_SECRET` (+ legacy `ATLAS_SSO_CLIENT_SECRET`) | ATLAS SSO outbound | Flow A bearer secret | ≥32 chars | **ABSENT (both names)** |
| `ENROLLPRO_SSO_CALLBACK_URL` | ATLAS SSO reverse | exact registered redirect URI | absolute HTTPS URI | **ABSENT** |
| `ATLAS_SSO_REVERSE_CLIENT_SECRET` (+ legacy `ENROLLPRO_REVERSE_CLIENT_SECRET`) | ATLAS SSO inbound | Flow B bearer secret | ≥32 chars | **ABSENT (both names)** |
| `VITE_ENROLLPRO_URL` | ATLAS client | EnrollPro browser origin | HTTPS origin | **ABSENT** (no real client env in the worktree; only `.env.example`) |
| `VITE_ENROLLPRO_SSO_START_URL` | ATLAS client | explicit reverse-start override | absolute HTTPS URI | **ABSENT** (optional; derivation used) |

`atlas-server/.env.example` documents **none** of the four ATLAS SSO server keys
(ATLAS-owned documentation gap; not fixed by this packet). `atlas-client/.env.example:18,21-22`
documents the correct `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net`
and `VITE_ENROLLPRO_SSO_START_URL=https://dev-jegs.buru-degree.ts.net/api/auth/companion-sso/atlas/reverse/start`.

### 6.2 Verified public origins

| System | Origin / route | Evidence | Tag |
| --- | --- | --- | --- |
| ATLAS | `https://njgrm.buru-degree.ts.net` | HTTP 200 (`/` and `/login`); Tailscale "Funnel on: https://njgrm.buru-degree.ts.net"; `CLIENT_URL` key agrees | CURRENT_STATE |
| EnrollPro browser entry | `https://dev-jegs.buru-degree.ts.net/personnel/login` | Tailnet DNS A → `100.120.169.123`; **currently unreachable** (see §7) | CURRENT_STATE |
| EnrollPro server base | expected shape `https://dev-jegs.buru-degree.ts.net/api` (EnrollPro mounts under `/api`) | EnrollPro `server/src/app.ts:179`; production `ENROLLPRO_PUBLIC_URL` value not present in the read-only mirror → **UNPROVEN**, must be supplied by the operator in the activation packet | SUCCESSOR |

Never substitute a retired raw Tailnet IP, `localhost`, or an old hostname for
either browser origin (`REQUIREMENT`). The raw-IP value currently present in
`ENROLLPRO_API` is server-to-server only and must not become a browser origin.

### 6.3 Shared runtime inventory (read-only; zero mutation)

Resolved this turn from the deployed checkout and the supervisor CLI
(`node ops/runtime/cli.mjs status` from `D:\ATLAS-runtime-supervised-3d916b26-20260912`):

| Property | Value |
| --- | --- |
| sourceDir | `D:\ATLAS-runtime-supervised-3d916b26-20260912` |
| Installed HEAD | `3d916b26` (`git rev-parse` blocked by a dubious-ownership guard for the current user; the path exists and `dist`/`ops` are present) |
| `releaseSha` | `3d916b261d6a2db71b153558ac8c2d151e2fccd0` |
| `productPin` | `d44f29e04d359ad9b18e4443b0fd4fed1daeaecd` |
| `releaseLabel` | `atlas-d44f29e0` |
| `state` | `running` |
| `startedAt` | `2026-09-12T15:26:45.407Z`; `uptimeMs` ≈ 217,605,304 ms (≈2.5 days) |
| `restartFailures` | 0 |
| Invariants | `ATLAS_SUPERVISED=true`, `ROLLOVER_AUTO_SYNC_ENABLED=false` |
| Listeners | 5001 → PID **19792** (ATLAS server); 5174 → PID **19000** (production host); both `owned:true` |
| Supervisor process | `node .../ops/runtime/cli.mjs start` observed as node PIDs; `schtasks /query /tn ATLAS-Runtime-Supervisor` returned **`Access is denied`** for this non-elevated user, so the registered task's action/principal could **not** be read directly this turn |
| Durable env path | `D:\ATLAS-runtime-config\atlas-server.env` (exists; outside every worktree) |
| Rollback (supervised) | `D:\ATLAS-runtime-supervised-20260912` present; `git rev-parse HEAD` = `9d2938791460c1d19059e5eddd30d7bba623fdad` |
| Manual fallback | `D:\ATLAS-runtime-fallback-d44-20260912` present; `git rev-parse HEAD` = `d44f29e04d359ad9b18e4443b0fd4fed1daeaecd` |
| Tailnet health | `https://njgrm.buru-degree.ts.net/api/v1/health` → 200 `{"status":"ok","service":"atlas"}` |

**Resolved `live:false`:** the status CLI prints `live:false` for both targets
even though both ports listen and health is 200. Cause: `runStatus`
(`ops/runtime/cli.mjs:81-91`) constructs a fresh in-process `Supervisor`,
restores only `ownedPids`/`state` from the state file, and leaves `this.children`
empty; `Supervisor.getStatus()` (`ops/runtime/lib/supervisor.mjs:375`) computes
`live` at `:401` from that empty map. A standalone `status`
invocation therefore always reports `live:false` by construction. It is a
status-CLI artifact, **not** a liveness signal. Real liveness evidence is the
HTTP probes and listener ownership above.

### 6.4 Live runtime predates the SSO source (CURRENT_STATE)

The shared runtime does **not** mount the SSO routes:

| Probe | Result |
| --- | --- |
| `POST https://njgrm.buru-degree.ts.net/api/v1/auth/sso/exchange` (no Bearer, read-only) | **HTTP 404**, empty body |
| `POST https://njgrm.buru-degree.ts.net/api/v1/auth/sso/authorize` (no Bearer) | **HTTP 404** |
| Grep of the deployed `atlas-server/dist/routes/auth.router.js` for `sso` / `enrollpro/authorize` | no matches |

This is expected: deployed release `3d916b26` predates COMPANION-SSO-C01
(`c989f03d`). **Live SSO is not available** and is not claimed to be. Required
successor: `COMPANION-SSO-RUNTIME-ACTIVATION-C02`. Minimum reviewed ATLAS
product SHA that contains COMPANION-SSO-C01: any descendant of merge
`c989f03d`; the executor-turn `origin/main` tip `53a781a4` is the candidate pin
(origin/main has since advanced to `0c203423`; see the correction below), to be
re-pinned and re-verified at execution.

**Correction 1 (planner review, 2026-09-15) — release-delta correction.** The
earlier statement that the commits above `c989f03d` up to the release tip are
docs-only was false and is superseded. Re-measured against the current
`origin/main` `0c20342394ca2ca800cecc6dd69825e07625c66d`:

| Measurement | Result |
| --- | --- |
| `git diff --shortstat c989f03d 0c203423` | 299 files changed, 40938 insertions(+), 3034 deletions(-); non-docs = 230 files |
| `git diff --shortstat d44f29e0 0c203423 -- . ":(exclude)docs"` | 270 files changed, 39367 insertions(+), 2863 deletions(-) |
| `git diff --shortstat d44f29e0 0c203423` (full) | 366 files changed, 54059 insertions(+), 2938 deletions(-) |
| `git diff --shortstat 53a781a4 0c203423` | 2 files changed, 48 insertions(+), 38 deletions(-) — docs-only (`docs/plans/…generated.md`, `docs/plans/atlas-delivery-cycles.json`) |

Installing the re-pinned tip therefore deploys the **entire integrated main
product tree** since the incumbent product pin `d44f29e0` (deployed release
`3d916b26`), not the SSO change alone. The activation packet's
§2/§5.6/§8.1/§10/§11 now require recomputing and recording both deltas against
the exact installed tip before install, with operator acknowledgment of the
non-docs delta.

### 6.5 Machine-state verification (read-only) (CURRENT_STATE)

`docs/plans/atlas-delivery-cycles.json` (contractVersion `1.1.0`), read-only at
correction time: `coordination.mode = MANUAL`; `coordination.activeCycleId =
null`; `coordination.globalNextAction = "WF-C02 COMPLETE with pinned receipt and
AUDIT_CLEAR; WF-C03 (Lane B) dispatch follows from the refreshed origin/main
tip."`; `leases` is empty; `browserCustody.profiles[0].custody` and
`browserCustody.logins` are both empty; the 6 `streams` entries contain no
`COMPANION-SSO-LIVE-PREP-C02` entry. No lease and no browser-custody record
touches this stream's docs, companion mirrors, disposable-database namespace,
browser profile, runtime inventory, or SSO packet paths. This preparation cycle
is **intentionally unregistered** in the machine state because the recovery
boundary forbids register edits while another lane owns `origin/main`; the
governing packet's Workflow-state requirement is satisfied by this read-only
verification rather than a state write.

## 7. Public / browser preflight (no authentication) (CURRENT_STATE)

| Row | Evidence | Tag |
| --- | --- | --- |
| Playwright MCP tools | present (`playwright_browser_*`); configured browser build `chromium-1244` was initially missing and was installed with the sanctioned `npx @playwright/mcp install-browser chrome-for-testing` (out-of-repo, `%LOCALAPPDATA%\ms-playwright\chromium-1244`) | CURRENT_STATE |
| ATLAS origin (desktop 1366×768) | `https://njgrm.buru-degree.ts.net/login`; `window.location.origin === "https://njgrm.buru-degree.ts.net"`; title `ATLAS`; login form rendered (Employee ID/Email, Password, Sign In) | CURRENT_STATE |
| ATLAS origin (mobile 390×844) | same URL; origin asserted again; viewport `390x844`; password input present; "Welcome Back / Sign in to continue to ATLAS" rendered | CURRENT_STATE |
| ATLAS console | 1 error: `502` on `https://njgrm.buru-degree.ts.net/enrollpro-uploads/55a414b8-….png` — the known EnrollPro proxy degradation pending `ENROLLPRO-PROXY-RECOVERY-LIVE`; page renders normally | CURRENT_STATE |
| ATLAS network | no `/api/*` request on `/login`; no session created, no form submitted, no login | CURRENT_STATE |
| EnrollPro origin | `https://dev-jegs.buru-degree.ts.net/personnel/login` → HTTP attempts `unable to connect` (×3) and browser `net::ERR_CONNECTION_TIMED_OUT`; Tailscale reports `dev-jegs` (100.120.169.123) **offline, last seen 33m ago** | CURRENT_STATE |
| Browser custody | one short session owned by the executor; tabs closed after evidence (no lingering context, no reusable session) | CURRENT_STATE |
| Flow A / Flow B protected execution | `NOT_AUTHORIZED_IN_PREP` — no login, no code issued/exchanged/consumed, no session created | REQUIREMENT |

The EnrollPro half of the preflight is **externally blocked** by a live Tailnet
state change (`dev-jegs` offline), not by the candidate. Both prepared packets
encode this as a fail-closed precondition.

## 8. Trace table (requirement → production path → negative control → verification)

| # | Requirement | Production path | Negative control | Verification command | Result |
| --- | --- | --- | --- | --- | --- |
| T1 | Refreshed Git/directive identity + SSO ancestry | `c989f03d` merge ancestry; `origin/main:AGENTS.md` | n/a (identity) | `git merge-base --is-ancestor c989f03d origin/main`; LF-normalized SHA-256 | PASS |
| T2 | Complete route/env-reader inventory | `atlas-server/src/app.ts:103`; `auth.router.ts:82,109,150`; `companion-sso.service.ts:113-139`; `companion-config.ts:28-59` | 404/absent-key probes | `git grep`; live `POST /api/v1/auth/sso/*` → 404 | PASS |
| T3 | EnrollPro contract matrix, every URL classified | EnrollPro `auth.router.ts:59-85`; `companion-sso.service.ts`; `companion-sso-reverse.service.ts`; `shared/src/schemas/companion-sso.schema.ts` | example-vs-source contradiction recorded; real mounts used as authority | `git -C D:/EnrollPro grep/show` (read-only) | PASS |
| T4 | AIMS/SMART classification, no scope expansion | AIMS `server/src/routes/auth.routes.ts:36-39`; SMART docs-only | ATLAS rows remain disabled (`integrated-systems.ts:41-44`) | `git -C D:/AIMS grep`; `git -C D:/smart-final-capstone grep`; SSO client test asserting disabled rows | PASS |
| T5 | SSO tests, typechecks, builds, isolated startup | mounted suite + `tsc` + builds + `dist/server.js` | suite runs against disposable DB (not live); isolated port 5317 | §3 commands | PASS |
| T6 | Read-only live migration/table state + before/after signatures | `_prisma_migrations`, `to_regclass`, row counts | before/after delta must be 0 | §5.1 `psql` read-only queries | PASS |
| T7 | Disposable apply/status/rollback/replay + zero residue | `prisma migrate deploy --schema prisma/schema.prisma`; mounted suite | rollback → re-apply; `pg_database` residue count | §5.2 sequence | PASS |
| T8 | Secret-safe config presence inventory | `D:\ATLAS-runtime-config\atlas-server.env` key names only | no value printed/hashed/committed | key-name extraction | PASS |
| T9 | Runtime/release/supervisor/rollback inventory, zero mutation | `cli.mjs status`; listener ownership; rollback dirs | PIDs unchanged before/after isolated probe | `cli.mjs status`; `Get-NetTCPConnection`; `git rev-parse` on rollback dirs | PASS |
| T10 | Tailnet-only public preflight, exact origins, two viewports | `https://njgrm.buru-degree.ts.net/login` (both viewports) | **EnrollPro origin offline** | browser origin assertion + HTTP probes + `tailscale status` | **BLOCKED** (ATLAS half PASS; EnrollPro half `EXTERNALLY_BLOCKED(LIVE_TAILNET)`) |
| T11 | Migration HIGH packet complete + satisfiable | `docs/prompts/companion-sso-migration-live-c02-2026-09-15.md` | binds fail-closed preflight; no config/deploy/login authority | packet review | PASS |
| T12 | Runtime activation HIGH packet complete + satisfiable | `docs/prompts/companion-sso-runtime-activation-c02-2026-09-15.md` | dependency-bound; NOT GRANTED; no AIMS/SMART/MRF bundling | packet review | PASS |
| T13 | Companion defect handoff with exact evidence, no companion edit | `docs/handoffs/enrollpro-sso-contract-corrections-2026-09-15.md` | `D:/EnrollPro` clean before/after (`5887d685`, 0 dirty) | `git -C D:/EnrollPro status --porcelain` | PASS |
| T14 | Claim classification without current-state/successor contradiction | Section 12 lint | — | manual lint of this document | PASS |
| T15 | `git diff --check`, attribution, no secrets, no unauthorized mutation | candidate diff | live DB + runtime + mirror signatures unchanged | `git diff --check`; `git status --porcelain=v2`; signatures | PASS |

## 9. Fifteen-row tally

| # | Row | Status |
| --- | --- | --- |
| 1 | Refreshed Git/directive identity and source ancestry | PASS |
| 2 | Complete ATLAS production-route and environment-reader inventory | PASS |
| 3 | EnrollPro production-source contract matrix with every URL classified | PASS |
| 4 | AIMS/SMART read-only roadmap classification without scope expansion | PASS |
| 5 | Existing SSO production-path tests, typechecks, builds, isolated startup | PASS |
| 6 | Read-only live migration/table state and before/after zero-write signatures | PASS |
| 7 | Disposable PostgreSQL apply/status/rollback/replay plus zero residue | PASS |
| 8 | Secret-safe configuration presence inventory with zero values disclosed | PASS |
| 9 | Runtime/release/supervisor/rollback inventory with zero mutation | PASS |
| 10 | Tailnet-only public browser preflight, exact origins, two viewports, serialized custody | **BLOCKED** — ATLAS origin PASS; EnrollPro origin `EXTERNALLY_BLOCKED(LIVE_TAILNET)` (`dev-jegs` offline at capture) |
| 11 | Separate migration HIGH packet complete and satisfiable | PASS |
| 12 | Separate runtime activation HIGH packet complete, dependency-bound, satisfiable | PASS |
| 13 | Companion defect has an ATLAS-owned developer handoff, no companion edit | PASS |
| 14 | Claim classification contains no current-state/successor contradiction | PASS |
| 15 | `git diff --check`, changed-path attribution, no secret-like content, no unauthorized mutation | PASS |

Tally: **14 / 15 passed / 1 blocked / 0 unperformed.** The single blocked row is
an external live-state condition (EnrollPro Tailnet host offline), captured with
evidence and encoded as a fail-closed precondition in both prepared packets.

## 10. What was not executed (explicit)

- No live/shared migration, schema mutation, seed, reset, or data write; `0002`
  remains absent on the live database.
- No login, SSO launch, authorization-code issue/exchange/consume, or session
  creation in ATLAS or any companion.
- No secret value display/hash/copy/logging/repository write.
- No companion-repository edit, fetch, fast-forward, install, migration, or
  snapshot.
- No shared-runtime stop/start/restart, task/env edit, port ownership change,
  Tailscale change, generation, publication, Teaching Load, or rollover action.
- No localhost browser evidence (localhost use was an isolated non-browser test
  harness only).
- No merge, rebase, reset, amend, squash, other-worktree cleanup, or push.

## 11. Risk register

| ID | Risk | Class |
| --- | --- | --- |
| R1 | Flow B reverse assertion role/name contract mismatch (§4.5) makes ATLAS→EnrollPro SSO fail in production even after migration + config | **BLOCKING** for live SSO acceptance; remedy documented in the companion handoff (outside this prep candidate's writable scope) |
| R2 | EnrollPro `.env.example` reverse URLs/`client_id` are contradictory and wrong (§4.3) | **BLOCKING** for a correct-configuration claim; activation packet binds the verified matrix and requires source-correct values |
| R3 | `ENROLLPRO_BASE_URL` / `ENROLLPRO_SSO_*` / `ATLAS_SSO_REVERSE_*` absent; `ENROLLPRO_API` is a raw Tailnet IP with `/api` | **BLOCKING** for activation; bound as explicit PRESENT-gate preconditions |
| R4 | EnrollPro Tailnet origin `dev-jegs` offline at capture; blocks the EnrollPro half of the public preflight and every live SSO acceptance row | **BLOCKING** for activation acceptance; fail-closed preflight required |
| R5 | Live runtime predates SSO (404 on `/api/v1/auth/sso/*`); activation requires installing a post-`c989f03d` release | **BLOCKING** for live SSO; owned by `COMPANION-SSO-RUNTIME-ACTIVATION-C02` |
| R6 | `schtasks /query` denied to the non-elevated executor, so the boot-task action/principal could not be re-read this turn; the activation packet must re-verify it elevated before any restart | NON_BLOCKING for preparation; mandatory precondition for the HIGH action |
| R7 | `atlas-server/.env.example` documents none of the four SSO keys | NON_BLOCKING documentation gap; successor correction |
| R8 | Browser build `chromium-1244` had to be installed; `chromium-1243` from the directive was stale | NON_BLOCKING; resolved out-of-repo |
| R9 | EnrollPro Flow A `assertUserCanLaunch` requires a companion identifier (`employeeId` or `lrn`), but ATLAS maps accounts only by `employeeId`/`accountName` and ignores `lrn` | NON_BLOCKING (learners are excluded by the four-role allowlist); recorded for completeness |

## 12. Claim-classification lint

- Every `CURRENT_STATE` row describes an observation at the capture boundary.
- Every unfinished item (live migration, configuration, deployment, live SSO
  acceptance, AIMS/SMART enablement, the role-vocabulary correction) is tagged
  `SUCCESSOR` and points at an owning packet or handoff.
- The live-SSO-availability row is `CURRENT_STATE` and says **not available**
  (404 evidence), not "ready".
- No `CURRENT_STATE` row asserts a capability that only `SUCCESSOR` work can
  produce (lint result: PASS).
