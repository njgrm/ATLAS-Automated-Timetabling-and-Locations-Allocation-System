# COMPANION-SSO-RUNTIME-ACTIVATION-C02-2026-09-15 — prepared HIGH runtime activation packet

Status: **PREPARED — NOT APPROVED. The exact operator approval sentence in
section 10 has NOT been granted.** No part of this packet may be executed until
the operator returns that sentence verbatim (or an explicit superset), and until
the §5 gating preconditions (accepted migration result + resolved role-contract
decision + reachable companion) are all satisfied.

Risk: **HIGH — shared-runtime release install + durable environment change +
supervised restart on ports 5001/5174 + authenticated cross-system SSO
acceptance with logins and expected database/audit deltas in two systems.**

Prepared 2026-09-15 (Asia/Manila) by the COMPANION-SSO-LIVE-PREP-C02 executor
(`REVIEW_REQUIRED`). Independent pre-action review, a fresh QA pass, and a Wave
Completion Audit are required by this packet.

Dependency: **this packet depends on the accepted result of
`COMPANION-SSO-MIGRATION-LIVE-C02-2026-09-15`.** It must not run before that
migration is applied and verified, because Flow B persists into
`companion_sso_codes`.

## 1. Objective

Make the already source-integrated ATLAS side of EnrollPro ↔ ATLAS SSO live:
install a release whose product tree contains COMPANION-SSO-C01, configure the
four ATLAS server keys and the client build input, coordinate the EnrollPro-side
values, restart only the supervisor-owned processes on 5001/5174, and prove both
flows end to end with exact expected deltas in both systems.

This packet does **not** activate AIMS, SMART, or MRF, does not enable their
disabled ATLAS Integrated Systems rows, does not claim unified cross-application
SSO, and does not perform companion-to-companion federation.

## 2. Accepted source binding

- Minimum required ATLAS ancestor: COMPANION-SSO-C01 integration merge
  `c989f03d67fa246ac8b168a59012a7615458be4f` (correction
  `fbb9dc6367fc9a20372e4a71d908f6a9d81a5411`). The deployed HEAD MUST descend
  from `c989f03d`.
- Candidate release pin at preparation time: `origin/main` tip
  `53a781a4fdb6e254bd1277c47fcef0700e0e769d`; re-measured at correction time
  (2026-09-15) against `origin/main`
  `0c20342394ca2ca800cecc6dd69825e07625c66d` (the `53a781a4..0c203423` drift is
  itself docs-only: 2 files,
  `docs/plans/atlas-active-delivery-streams.generated.md` and
  `docs/plans/atlas-delivery-cycles.json`, +48/-38).
  **The tip is NOT docs-only above the SSO merge.** Measured at correction time:
  - `git diff --shortstat c989f03d 0c203423` = **299 files changed, 40938
    insertions(+), 3034 deletions(-)**; non-docs = **230 files**, top-level
    scopes `atlas-client` 90, `ops` 67, `atlas-server` 63, `.opencode` 4,
    `package.json` 1, `opencode.json` 1, `.gitignore` 1, `.gitattributes` 1,
    plus the root `CHANGELOG.md` and `AGENTS.md`.
  - The incumbent release `3d916b26` deploys product pin
    `d44f29e04d359ad9b18e4443b0fd4fed1daeaecd`. `git diff --shortstat d44f29e0
    0c203423 -- . ":(exclude)docs"` = **270 files changed, 39367
    insertions(+), 2863 deletions(-)**, top-level scopes `atlas-client` 96,
    `ops` 84, `atlas-server` 76, `.opencode` 4, `prisma` 2, `qa-artifacts` 2,
    `package.json` 1, `.gitignore` 1, `.gitattributes` 1, `opencode.json` 1,
    plus the root `CHANGELOG.md` and `AGENTS.md`. (Full delta including docs:
    366 files, 54059 insertions(+), 2938 deletions(-).)
  - The **only** docs-only drift in this preparation lineage is the branch base
    `234046f8..53a781a4` (10 files at the executor turn); `53a781a4..0c203423`
    is also docs-only (2 files, above).
  - **Consequence: installing the re-pinned tip deploys the entire integrated
    main product tree — every integrated-but-undeployed change since the
    incumbent, including COMPANION-SSO-C01 — not the SSO change alone.** The
    execution preflight MUST recompute and record both
    `git diff --stat c989f03d..<pin>` and the non-docs
    `git diff --stat d44f29e0..<pin>` before install, and review the latter as the
    actual deployment diff.
- **Re-pinning rule:** if `origin/main` advanced by execution time, re-pin to the
  new tip, re-verify it descends from `c989f03d` and that
  `atlas-server/src/services/companion-sso.service.ts`,
  `atlas-server/src/routes/auth.router.ts`,
  `prisma/migrations/0002_companion_sso_code/migration.sql`,
  `atlas-client/src/lib/companion-config.ts`, and
  `atlas-client/src/pages/EnrollProAuthorize.tsx` + `SsoCallback.tsx` are present,
  and record both SHAs. Never install a tree that lacks the SSO product files.
- Incumbent runtime (must be re-captured at preflight, not assumed):
  sourceDir `D:\ATLAS-runtime-supervised-3d916b26-20260912`, `releaseSha`
  `3d916b26`, `productPin` `d44f29e0`, release `3d916b26`. Installed HEAD
  `3d916b26` **predates** COMPANION-SSO-C01 and returns **404** on
  `/api/v1/auth/sso/exchange` and `/api/v1/auth/sso/authorize` (verified
  read-only during preparation).
- Retained rollback artifacts on disk (verified 2026-09-15): supervised
  `D:\ATLAS-runtime-supervised-20260912` (`9d293879`) and manual
  `D:\ATLAS-runtime-fallback-d44-20260912` (`d44f29e0`).

## 3. Prepared-time live snapshot (read-only, 2026-09-15 ~04:05Z / ~12:05 +08)

Revalidation input, not an execution assumption. Re-probe each value and STOP on
drift.

- Supervisor state (`node ops/runtime/cli.mjs status` from
  `D:\ATLAS-runtime-supervised-3d916b26-20260912`): `state=running`,
  `releaseSha=3d916b261d6a2db71b153558ac8c2d151e2fccd0`,
  `productPin=d44f29e0…`, `rolloverAutoSyncEnabled=false` (invariant),
  `restartFailures=0`, `startedAt=2026-09-12T15:26:45.407Z`, uptime ≈2.5 days.
- Listeners: 5001 → PID **19792** (ATLAS server), 5174 → PID **19000**
  (production host); both `owned:true`.
- **`live:false` resolution:** the status CLI always prints `live:false` for both
  targets because `runStatus` (`ops/runtime/cli.mjs:63-72`) restores only
  `ownedPids`/`state` from the state file and leaves the in-process child map
  empty; `getStatus()` derives `live` from that map
  (`ops/runtime/lib/supervisor.mjs:371-401`). It is a status-CLI artifact, not a
  liveness signal. Liveness evidence is the HTTP probes and listener ownership.
- Tailnet: `https://njgrm.buru-degree.ts.net/api/v1/health` 200;
  `https://njgrm.buru-degree.ts.net/` and `/login` 200.
- Durable env `D:\ATLAS-runtime-config\atlas-server.env`: 13 keys;
  `DATABASE_URL`, `JWT_SECRET`, `ENROLLPRO_API` (host `100.120.169.123`, scheme
  `http`, path `/api`), `ATLAS_DEFAULT_SCHOOL_ID`, `ENROLLPRO_CLIENT_URL`,
  `ENROLLPRO_SERVICE_TOKEN`, `ATLAS_AUTH_DISABLE_RATE_LIMIT`,
  `ATLAS_SYSTEM_TOKEN`, `CLIENT_URL` (`https://njgrm.buru-degree.ts.net/`),
  `CORS_EXTRA_ORIGINS`, `FACULTY_ADAPTER`, `PORT`, `SECTION_SOURCE_MODE`.
  **Absent:** `ENROLLPRO_BASE_URL`, `ENROLLPRO_SSO_CLIENT_SECRET`,
  `ATLAS_SSO_CLIENT_SECRET`, `ENROLLPRO_SSO_CALLBACK_URL`,
  `ATLAS_SSO_REVERSE_CLIENT_SECRET`, `ENROLLPRO_REVERSE_CLIENT_SECRET`.
- Live database (read-only): `atlas_recovery_clean_rebuild_20260905`;
  `_prisma_migrations`=2; `companion_sso_codes` **ABSENT** (this packet requires
  the migration packet to have run first); `schools`=2, `atlas_auth_accounts`=44,
  `audit_logs`=242, `enrollpro_school_year_mirrors`=2, `faculty_mirrors`=42;
  `atlas_auth_accounts.role` = `faculty`×42, `officer`×2.
- EnrollPro mirror `D:/EnrollPro` clean at `5887d685…`; production base shape
  `https://dev-jegs.buru-degree.ts.net/api` (EnrollPro mounts `/api`).
  **EnrollPro Tailnet host `dev-jegs` (100.120.169.123) was OFFLINE at capture**
  ("offline, last seen 33m ago"); the browser entry
  `https://dev-jegs.buru-degree.ts.net/personnel/login` timed out.
- `schtasks /query /tn ATLAS-Runtime-Supervisor` returned `Access is denied` for
  the non-elevated executor; the task definition could not be re-read during
  preparation and MUST be captured elevated at execution preflight.
- Canonical directive: `origin/main:AGENTS.md` LF-normalized SHA-256
  `5f9206708a4763376dda1943c1ead28f49427ed1b1f0532ad25661f74ed3ebb5` (packet
  authoring recorded `0cf68d62…`; the newer directive wins — re-read at execution
  and carry the then-current hash).

## 4. Verified cross-system URL and key matrix (the only accepted configuration)

ATLAS server keys (`D:\ATLAS-runtime-config\atlas-server.env`):

| ATLAS key | Required value | Consumed by |
| --- | --- | --- |
| `ENROLLPRO_BASE_URL` | `https://dev-jegs.buru-degree.ts.net/api` | Flow A outbound: `${ENROLLPRO_BASE_URL}/auth/companion-sso/atlas/exchange` → EnrollPro `POST /api/auth/companion-sso/atlas/exchange` |
| `ENROLLPRO_SSO_CLIENT_SECRET` | shared secret S1 (≥32 chars) | Flow A `Authorization: Bearer` |
| `ENROLLPRO_SSO_CALLBACK_URL` | `https://dev-jegs.buru-degree.ts.net/api/auth/companion-sso/atlas/reverse/callback` | Flow B exact `redirect_uri` binding; MUST equal EnrollPro's computed redirect URI byte-for-byte |
| `ATLAS_SSO_REVERSE_CLIENT_SECRET` | shared secret S2 (≥32 chars, distinct from S1) | Flow B inbound `Authorization: Bearer` |

ATLAS client build input (baked into the bundle by Vite):

| Build variable | Required value |
| --- | --- |
| `VITE_ENROLLPRO_URL` | `https://dev-jegs.buru-degree.ts.net` |
| `VITE_ENROLLPRO_SSO_START_URL` | unset (derives `${VITE_ENROLLPRO_URL}/api/auth/companion-sso/atlas/reverse/start`) |

EnrollPro server keys (owned and set by the EnrollPro operator; ATLAS must not
edit the EnrollPro repository or its configuration files):

| EnrollPro key | Required value | Notes |
| --- | --- | --- |
| `ATLAS_SSO_CALLBACK_URL` | `https://njgrm.buru-degree.ts.net/api/v1/auth/enrollpro/callback` | Flow A browser callback (includes `/api/v1`) |
| `ATLAS_SSO_CLIENT_SECRET` | shared secret S1 (`== ENROLLPRO_SSO_CLIENT_SECRET`) | Flow A exchange bearer |
| `ATLAS_SSO_REVERSE_AUTHORIZE_URL` | `https://njgrm.buru-degree.ts.net/auth/enrollpro/authorize` | Flow B SPA page |
| `ATLAS_SSO_REVERSE_EXCHANGE_URL` | `https://njgrm.buru-degree.ts.net/api/v1/auth/sso/exchange` | Flow B exchange API |
| `ATLAS_SSO_REVERSE_CLIENT_ID` | `enrollpro` | exact; `enrollpro_client_id` is rejected by ATLAS |
| `ATLAS_SSO_REVERSE_CLIENT_SECRET` | shared secret S2 (`== ATLAS_SSO_REVERSE_CLIENT_SECRET`) | Flow B inbound bearer |
| `ENROLLPRO_PUBLIC_URL` | `https://dev-jegs.buru-degree.ts.net` | server-side callback computation; `https` required outside local dev |

Invariants enforced by source: EnrollPro requires
`authorizeUrl.origin === exchangeUrl.origin` (`companion-sso-reverse.service.ts:120-128`)
— both `https://njgrm.buru-degree.ts.net`; ATLAS requires
`ENROLLPRO_SSO_CALLBACK_URL` to equal EnrollPro's computed redirect URI exactly
(`companion-sso.service.ts:566,693`). Secrets S1 and S2 must be distinct, ≥32
characters, and contain none of the placeholder markers
`replace|placeholder|example|change_me|your_` (EnrollPro rejects those in
`readCompanionConfiguration`/`getReverseConfiguration`).

## 5. Gating preconditions (fail closed; STOP before the HIGH action if any fails)

1. **Accepted migration result.** `COMPANION-SSO-MIGRATION-LIVE-C02` applied and
   verified: `companion_sso_codes` exists with the expected DDL and
   `_prisma_migrations` contains `0002_companion_sso_code`. If `0002` is absent,
   STOP and report `PRECONDITION_MIGRATION_UNACCEPTED`.
2. **Role/name contract decision resolved.** Preparation found a blocking
   cross-system mismatch (`docs/handoffs/enrollpro-sso-contract-corrections-2026-09-15.md`):
   ATLAS's Flow B assertion emits `identity.roles: [account.role]` from the live
   lowercase vocabulary (`faculty`/`officer`), while EnrollPro's
   `companionSsoReverseExchangeResponseSchema` requires case-sensitive uppercase
   `RoleEnum` values and non-empty `firstName`/`lastName`; EnrollPro therefore
   rejects the assertion with `502 COMPANION_REVERSE_SSO_RESPONSE_INVALID`.
   The planner/operator MUST choose and complete one resolution before Flow B
   acceptance is attempted:
   - **(A) ATLAS-side normalization** — map the local role to EnrollPro's
     vocabulary and guarantee non-empty assertion names before responding (new
     ATLAS product commit + fresh QA + re-pin); or
   - **(B) EnrollPro-side acceptance** — widen
     `companionSsoReverseExchangeResponseSchema` to accept ATLAS's role
     vocabulary (and define the name fallback), committed in the EnrollPro
     repository by its owner.
   If neither resolution is complete and independently verified, STOP with
   `PRECONDITION_ROLE_CONTRACT_UNRESOLVED` (Flow A may still be exercised as
   partial evidence, but the packet is not satisfiable and must not be reported
   as passing).
3. **Companion reachability.** `https://dev-jegs.buru-degree.ts.net` resolves to
   the Tailnet host and `GET /personnel/login` returns a browser page (2xx/3xx)
   at execution time; Tailscale reports the peer online. If the peer is offline,
   STOP with `EXTERNALLY_BLOCKED(LIVE_TAILNET)` — prep-time evidence shows it
   was offline ("last seen 33m ago") and no acceptance row may be downgraded to
   non-blocking because of that.
4. **Release tree and build.** The chosen release directory contains a clean
   checkout of the pinned tip with `atlas-server/dist` and `atlas-client/dist`
   built from that tree, and the client build used
   `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net`.
5. **Task definition captured elevated.** Capture the
   `ATLAS-Runtime-Supervisor` task definition (principal, trigger/delay,
   multiple-instances policy, action, working directory) with the rights the
   approval grants before any re-point.
6. **Full release-delta reviewed and recorded.** Recompute and record, against
   the then-current re-pinned tip, both `git diff --stat c989f03d..<pin>` and
   the non-docs `git diff --stat d44f29e0..<pin>` (this is the full
   integrated-but-undeployed product delta the install actually deploys, not the
   SSO change alone). The operator MUST acknowledge the recorded non-docs delta
   for the exact tip being installed. If either delta cannot be computed or
   recorded, STOP with `PRECONDITION_RELEASE_DELTA_UNRECORDED` — do not install.

## 6. Exact switch set (nothing else may change)

**Launch ownership (durable resident owner — mandatory; directive `AGENTS.md`
§Mechanical Cycle Closure And Runtime Launch Ownership).** The replacement
resident supervisor MUST be launched by the registered Windows task, never as a
child of an attached executor shell, terminal, or temporary wrapper. The same
task is the rollback launch owner:

```yaml
launchOwner:
  type: WINDOWS_SCHEDULED_TASK
  taskName: ATLAS-Runtime-Supervisor
  principal: SYSTEM
launchMechanism:
  command: schtasks /run /tn "ATLAS-Runtime-Supervisor"
  requirement: task action and working directory point to the new release
rollbackLaunchOwner:
  type: WINDOWS_SCHEDULED_TASK
  taskName: ATLAS-Runtime-Supervisor
  principal: SYSTEM
rollbackLaunchMechanism:
  command: schtasks /run /tn "ATLAS-Runtime-Supervisor"
  requirement: task action and working directory restored to release 3d916b26
```

1. **Environment backup.** Copy `D:\ATLAS-runtime-config\atlas-server.env` to an
   operator-only path outside every Git worktree (record absolute path, size,
   SHA-256; never print or commit values).
2. **Four ATLAS keys, exactly.** Add `ENROLLPRO_BASE_URL`,
   `ENROLLPRO_SSO_CLIENT_SECRET`, `ENROLLPRO_SSO_CALLBACK_URL`,
   `ATLAS_SSO_REVERSE_CLIENT_SECRET` per §4. No other key may be added, removed,
   or modified. Do not use the legacy alias names.
3. **Cross-system secret delivery (never exposes values).**
   - S1/S2 are generated once by the operator (≥32 chars, high entropy, no
     placeholder markers) and stored only in the two runtime configurations.
   - ATLAS side: the executor writes them into
     `D:\ATLAS-runtime-config\atlas-server.env` without echoing them (no
     terminal echo, no `setx` argument visible in history, no repo file, no
     log). Record key names and PRESENT only.
   - EnrollPro side: the **EnrollPro runtime configuration owner** (a named
     human owner for the `dev-jegs` host) sets the §4 EnrollPro keys directly on
     that host. ATLAS must not edit EnrollPro source, `.env` files, or history.
   - Verification of the shared values is performed only by the end-to-end
     handshake (a matching pair succeeds; a mismatched pair returns the typed
     401). Never compare, hash, or print the values.
4. **Release install.** Create `D:\ATLAS-runtime-supervised-<pin7>-20260915`
   with a clean checkout of the pinned tip and built artifacts:
   `atlas-server/dist` (`npm run build` = `tsc`) and `atlas-client/dist`
   (`npm run build` = `vite build`, with `VITE_ENROLLPRO_URL` set per §4). A Vite
   dev/HMR tree is rejected. Do not modify the incumbent release directory.
5. **Supervisor boundary re-point.** Update machine `ATLAS_RUNTIME_SOURCE_DIR` and
   `ATLAS_RUNTIME_RELEASE_SHA`, and re-point the `ATLAS-Runtime-Supervisor` task
   action **and working directory** to the new release; keep principal SYSTEM,
   trigger ONSTART (`PT0S`), multiple-instances `IgnoreNew`, the existing
   `ATLAS_RUNTIME_ENV_FILE`, and the log directory. Elevation is expected.
6. **Restart only supervisor-owned 5001/5174.** Record incumbent identity;
   `node <oldRelease>\ops\runtime\cli.mjs stop` (owned PIDs only); terminate the
   resident supervisor process tree (documented quiesce correction: an
   out-of-process `stop` cannot durably quiesce a resident supervisor) and wait
   ≥10 s; confirm no listener on 5001/5174 (any unknown listener → STOP, never
   broad-kill); re-capture the re-pointed task record; launch only via
   `schtasks /run /tn "ATLAS-Runtime-Supervisor"`. The new supervisor must not be
   a descendant of the invoking shell.
7. **Keep `ROLLOVER_AUTO_SYNC_ENABLED=false`.**
8. **Confirm live route presence.** `POST /api/v1/auth/sso/exchange` with no
   Bearer returns `401 {"code":"COMPANION_SSO_CLIENT_INVALID",…}` (not 404), and
   `POST /api/v1/auth/sso/authorize` with no Bearer returns 401. This is the
   mounted-route proof that the release contains the SSO source.

## 7. Browser custody and login budget (one serialized plan, both directions)

- **One controller at a time** on the shared persistent profile
  `~/.config/opencode/playwright-profile`. Roles use independent contexts
  **serially**; the executor must finish and release custody before fresh QA
  starts, and QA must do the same before the final cleanup owner.
- **Browser-origin invariant:** every ATLAS browser row must execute with
  `window.location.origin === "https://njgrm.buru-degree.ts.net"`; every
  EnrollPro browser row must execute with
  `window.location.origin === "https://dev-jegs.buru-degree.ts.net"`. A page
  origin of `localhost`, `127.0.0.1`, or a raw Tailnet IP is invalid evidence
  for this packet.
- **Login budget (exact).** At most **one fresh ATLAS operator login** (creates
  exactly one `LOCAL_LOGIN_SUCCESS` row plus that actor's `last_login_at`) and
  **one fresh EnrollPro login** (creates the EnrollPro session cookie and its
  audit row(s)) across the whole packet, including QA. Do not export, copy, or
  hand off a JWT; do not enable "Remember me"; do not exceed the budget. If a
  reusable session already exists, prefer it read-only. If a mandatory row
  cannot run within the budget, STOP and request a revised budget rather than
  logging in again.
- **Custody order and cleanup owner:**
  1. executor leg (Flow A then Flow B) holds custody, records the exact origin
     assertion and console/network evidence, then releases custody without
     logging out if QA must reuse the same context — or logs out if the packet
     assigns fresh QA an independent context;
  2. fresh QA holds custody, re-verifies the decisive rendered rows, and is the
     **final cleanup owner**: it performs logout in both systems, verifies
     `GET /api/v1/auth/me` returns 401 `NO_TOKEN`, and closes all tabs.
  No persistent remembered token may remain.

**Expected deltas per authorized action (both systems; record before/after):**

| Action | ATLAS expected delta | EnrollPro expected delta |
| --- | --- | --- |
| Flow A: EnrollPro staff launches ATLAS (`POST /api/auth/companion-sso/atlas/launch`) | — (not yet) | +1 `companion_sso_authorization_codes` row; +1 audit `COMPANION_SSO_LAUNCHED` |
| Flow A: ATLAS exchanges and creates a local session | +1 audit `COMPANION_SSO_SESSION_CREATED`; `atlas_auth_accounts.lastLoginAt` update for exactly one account; no `companion_sso_codes` row | `companion_sso_authorization_codes.consumedAt` set for that row; +1 audit `COMPANION_SSO_EXCHANGED` |
| Flow B: ATLAS privileged operator authorizes | +1 `companion_sso_codes` row (hash only); the operator's local ATLAS session login adds exactly one `LOCAL_LOGIN_SUCCESS` row + `last_login_at` if a fresh login was used | +1 audit `COMPANION_REVERSE_SSO_STARTED` |
| Flow B: EnrollPro consumes the code | `companion_sso_codes.consumedAt` set; +1 audit `COMPANION_SSO_CODE_CONSUMED` | +1 `companion_identity_links` row (first link) or `lastAuthenticatedAt` update; `users.lastLoginAt` update; +1 audit `COMPANION_REVERSE_SSO_LOGIN`; EnrollPro session issued |
| Cleanup | `GET /api/v1/auth/me` → 401 `NO_TOKEN`; no new rows | session cookie cleared; no new rows |

Any unexplained extra write in either system is an incident stop.

## 8. Acceptance matrix (all rows mandatory; PASS/FAIL each with evidence)

1. Release identity: `git -C <newReleaseDir> rev-parse HEAD` equals the pinned
   tip and descends from `c989f03d`; supervisor state `releaseSha` matches;
   `atlas-client/dist` exists and was built with the §4 `VITE_ENROLLPRO_URL`;
   and the §5.6 recorded deltas are present for this exact tip — the full
   `git diff --stat c989f03d..<pin>` and the non-docs
   `git diff --stat d44f29e0..<pin>` (the deployment's actual product delta, not
   SSO alone), acknowledged by the operator. A missing or unreproducible delta
   record fails this row.
2. Mounted routes live: `POST /api/v1/auth/sso/exchange` and
   `POST /api/v1/auth/sso/authorize` return 401 (not 404) on the Tailnet origin.
3. Health/readiness: local `/api/v1/health` 200, `/api/v1/health/ready` 200;
   host `/__host/live` 200 and two consecutive `/__host/ready` 200; Tailnet
   `/api/v1/health` 200.
4. Ownership: exactly one owner per port (5001/5174) matching the supervisor's
   recorded PIDs; supervisor is not a descendant of the invoking shell; the
   task record shows SYSTEM/ONSTART `PT0S`/IgnoreNew with action + working
   directory at the new release; post-shell re-probe from a later shell shows
   the same supervisor PID owning 5001/5174 and health 200.
5. Rollover automation remains disabled (invariant; no rollover activity).
6. Flow A — browser at `https://dev-jegs.buru-degree.ts.net/personnel/login`
   (origin asserted), EnrollPro-authenticated staff launches ATLAS; browser lands
   on `https://njgrm.buru-degree.ts.net/auth/sso/callback#atlasToken=…`
   (origin asserted); the fragment is stripped before navigation; the ATLAS
   AppShell renders and the Integrated Systems area shows AIMS/SMART/MRF as
   disabled plain text with ATLAS current and EnrollPro enabled; deltas match §7.
7. Flow B — browser at `https://njgrm.buru-degree.ts.net` (origin asserted),
   privileged ATLAS operator opens the Integrated Systems EnrollPro row; the
   browser reaches `https://njgrm.buru-degree.ts.net/auth/enrollpro/authorize`
   then `https://dev-jegs.buru-degree.ts.net/api/auth/companion-sso/atlas/reverse/callback`
   and lands on the EnrollPro landing route (`/dashboard` for
   SYSTEM_ADMIN/HEAD_REGISTRAR, else `/teacher/advisory`); deltas match §7.
8. Return routing: after Flow A the operator can return to EnrollPro from the
   ATLAS shell, and after Flow B the EnrollPro session is usable; no open
   redirect is followed for a foreign `returnUrl`/`redirect_uri`.
9. Negative controls (each must fail closed with the typed code and zero
   unintended writes):
   - wrong role: a non-privileged ATLAS role → 403 `COMPANION_SSO_ROLE_DENIED`
     with zero `companion_sso_codes` rows;
   - wrong school/year: an identity/mirror year mismatch → 409
     `ACTIVE_SCHOOL_YEAR_REQUIRED`/`_CONFLICT` with zero writes;
   - wrong redirect: an unregistered `redirect_uri` → 400
     `COMPANION_SSO_INVALID_REQUEST`, no redirect, no code row;
   - wrong secret: an incorrect Bearer on `/sso/exchange` → 401
     `COMPANION_SSO_CLIENT_INVALID` with zero code consumption;
   - expired/replayed code: after the first success, a second exchange → 401
     `COMPANION_SSO_CODE_INVALID` with exactly one consumption total;
   - unreachable companion: with the EnrollPro peer down,
     `/enrollpro/callback` redirects with `ssoError=COMPANION_SSO_UNREACHABLE`
     and writes no session;
   - open redirect: a protocol-relative/absolute `returnUrl` on ATLAS login is
     rejected to the role-based landing route.
10. Desktop (1366×768) **and** mobile (390×844) AppShell renders for the flows in
    rows 6–8, with the origin assertion repeated at each viewport.
11. Logs: bounded/redacted logs contain no code, token, or secret; no plaintext
    code at rest (`companion_sso_codes` stores hashes only, 64 hex chars).
12. Database: all deltas match §7 exactly; `_prisma_migrations` unchanged beyond
    the already-accepted `0002`; every other signature delta is 0.
13. EnrollPro-side deltas (§7) recorded from the companion host by its owner or a
    read-only probe the owner permits; a companion-side unexplained write is an
    incident stop.

## 9. Rollback (configuration, release, runtime)

- **Configuration stage:** restore the §6.1 environment backup byte-for-byte.
- **Release/restart stage** (same durable owner and mechanism as forward):
  1. quiesce the new-release supervisor exactly as in §6.6 (owned `cli.mjs stop`
     → resident tree termination → confirm 5001/5174 have no listener; never
     broad-kill);
  2. restore the environment backup byte-for-byte;
  3. restore `ATLAS_RUNTIME_SOURCE_DIR`/`ATLAS_RUNTIME_RELEASE_SHA` to the
     incumbent values recorded at preflight;
  4. re-point the `ATLAS-Runtime-Supervisor` task action **and working
     directory** back to `D:\ATLAS-runtime-supervised-3d916b26-20260912`;
  5. relaunch only via `schtasks /run /tn "ATLAS-Runtime-Supervisor"`;
  6. prove task identity, listener ownership, health/readiness, and the absence
     of the SSO routes (404 restored) as the honest rolled-back state.
- **Runtime failure:** if the new release cannot become healthy, the supervisor's
  bounded backoff will fail closed; do not bypass it. Fall back to the supervised
  `9d293879` or the manual `d44f29e0` artifacts using the same durable-owner rule.
- Record honestly: rollback restores continuity; live SSO is then **not**
  available and the cycle closes `DEPLOYED_ACCEPTANCE_INCOMPLETE`/`BLOCKED`.
- Do not roll back the accepted migration in this packet; a migration rollback
  requires its own authorization.

## 10. Exact proposed HIGH approval sentence (NOT GRANTED)

> APPROVE COMPANION-SSO-RUNTIME-ACTIVATION-C02-2026-09-15: after the accepted
> `COMPANION-SSO-MIGRATION-LIVE-C02` result is verified and the reverse-assertion
> role/name contract decision is resolved and independently verified, back up
> `D:\ATLAS-runtime-config\atlas-server.env` to an operator-only path; set exactly
> `ENROLLPRO_BASE_URL=https://dev-jegs.buru-degree.ts.net/api`,
> `ENROLLPRO_SSO_CLIENT_SECRET=<S1>`,
> `ENROLLPRO_SSO_CALLBACK_URL=https://dev-jegs.buru-degree.ts.net/api/auth/companion-sso/atlas/reverse/callback`,
> and `ATLAS_SSO_REVERSE_CLIENT_SECRET=<S2>` in that file (S1/S2 distinct,
> ≥32 chars, generated by the operator and never printed); have the named
> EnrollPro runtime configuration owner set
> `ATLAS_SSO_CALLBACK_URL=https://njgrm.buru-degree.ts.net/api/v1/auth/enrollpro/callback`,
> `ATLAS_SSO_CLIENT_SECRET=<S1>`,
> `ATLAS_SSO_REVERSE_AUTHORIZE_URL=https://njgrm.buru-degree.ts.net/auth/enrollpro/authorize`,
> `ATLAS_SSO_REVERSE_EXCHANGE_URL=https://njgrm.buru-degree.ts.net/api/v1/auth/sso/exchange`,
> `ATLAS_SSO_REVERSE_CLIENT_ID=enrollpro`,
> `ATLAS_SSO_REVERSE_CLIENT_SECRET=<S2>`, and
> `ENROLLPRO_PUBLIC_URL=https://dev-jegs.buru-degree.ts.net` on the `dev-jegs`
> host; build the client with `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net`
> and install release `<re-pinned origin/main tip, descendant of c989f03d>` at
> `D:\ATLAS-runtime-supervised-<pin7>-20260915` after recomputing and recording
> the full release delta for that exact tip (`git diff --stat c989f03d..<pin>`
> and the non-docs `git diff --stat d44f29e0..<pin>`), acknowledging that the
> install deploys the entire integrated main product tree since the incumbent
> product pin `d44f29e0`, not the SSO change alone; re-point
> `ATLAS_RUNTIME_SOURCE_DIR`/`ATLAS_RUNTIME_RELEASE_SHA` and the
> `ATLAS-Runtime-Supervisor` task action and working directory to it; quiesce
> only the supervisor-owned ATLAS processes on 5001/5174 and relaunch the
> replacement resident supervisor only through the registered SYSTEM task via
> `schtasks /run /tn "ATLAS-Runtime-Supervisor"`, preserving ONSTART, `PT0S`,
> IgnoreNew (incumbent at preflight: release `3d916b26`, as re-verified at
> execution); run the packet's acceptance matrix including one ATLAS operator
> login and one EnrollPro login with the §7 expected deltas in both systems,
> desktop and mobile AppShell checks, the listed negative controls
> (wrong role, wrong school/year, wrong redirect, wrong secret, expired/replayed
> code, unreachable companion, open redirect), hash-only-at-rest proof, log
> redaction, and post-shell supervisor survival; commission fresh QA and a Wave
> Completion Audit before closing; and on any mandatory failure roll back
> symmetrically by quiescing the new release, restoring the environment backup
> and machine variables, re-pointing the task action and working directory to
> `D:\ATLAS-runtime-supervised-3d916b26-20260912`, relaunching through the same
> registered task, and re-proving task identity, listener ownership, health, and
> readiness. Excluded: AIMS/SMART/MRF activation or their disabled ATLAS rows,
> companion-to-companion federation, any EnrollPro repository edit, migration
> rollback, databases/migrations beyond the accepted `0002`, term-cache,
> Teaching Load, generation, publication, port 5175, unrelated processes,
> Tailscale Serve, and every other environment key.

## 11. Execution record required

Return: preflight re-probes and the elevated task-definition capture; the exact
pinned tip and `rev-parse HEAD`; the recorded release deltas for that exact tip —
`git diff --stat c989f03d..<pin>` and the non-docs
`git diff --stat d44f29e0..<pin>` with their shortstat outputs (the full
integrated-but-undeployed product delta, not SSO alone) and the operator's
acknowledgment of the non-docs delta; the client build invocation with the
`VITE_ENROLLPRO_URL` value; the environment backup path + size + SHA-256; the
four added key names (names only); the EnrollPro-side key names changed and by
whom (names only); the quiesce/start transcript and the
`schtasks /run /tn "ATLAS-Runtime-Supervisor"` parentage proof; the acceptance
matrix with per-row PASS/FAIL, raw status codes, exact route URLs, and the
`window.location.origin` assertion for every browser row; both systems'
before/after delta tables; the browser custody/login ledger; the rollback record
if used; an explicit statement that no excluded action occurred; fresh QA's
verdict and tally; and the Wave Completion Auditor's capsule and verdict.
