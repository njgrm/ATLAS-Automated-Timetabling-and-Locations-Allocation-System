# TERM-CACHE-CATCHUP-PREVIEW — Bounded live capture attempt (2026-09-13)

Status: **EXTERNALLY_BLOCKED(ENROLLPRO_UNREACHABLE)** — the single authorized
login succeeded; the zero-write preview returned HTTP 503
`ENROLLPRO_UNREACHABLE` because the EnrollPro Tailnet host (`dev-jegs`,
`100.120.169.123:5002`) is offline. No ordered-term matrix, semantic revision,
fingerprint, or confirmation text exists yet. The term-cache **apply** remains
unexecuted and unbound. A re-capture requires the EnrollPro host restored plus a
**fresh** explicit one-login authorization (the sole login granted on
2026-09-13 is consumed).

## Packet, authorization, and boundary

- Governing packet: `docs/prompts/term-cache-catchup-preview-2026-09-13.md`
  (`origin/main` `e0a10ebc`; wave-audited `AUDIT_CLEAR` 8/8 in
  `docs/reviews/companion-sso-and-term-cache-prep-20260913/wave-completion-audit.md`).
- Operator authorization (returned 2026-09-13, verbatim):

  > I authorize exactly one bounded local login at the ATLAS Tailnet origin
  > https://njgrm.buru-degree.ts.net for a privileged QA custodian context, whose
  > only expected database mutation is one `LOCAL_LOGIN_SUCCESS` audit row plus
  > that actor's `last_login_at`, to execute the zero-write term-authority
  > catch-up preview `POST /api/v1/runtime/term-authority/preview {"schoolId":1}`
  > against live release `3d916b26` and record its ordered terms, semantic
  > revisions, fingerprint, confirmation text, and before/after zero-write
  > signatures. No term-cache apply, rollover sync, Teaching Load mutation,
  > generation, publication, migration, schema, companion-repository, or
  > runtime-listener action is authorized.

- Cycle: `term-cache-catchup-preview-20260913`. Evidence base `origin/main`
  `e0a10ebcd8efa0d4fa248b2c5948ed53a6c33c54`; worktree
  `D:/ATLAS-worktrees/integration-term-cache-preview-20260913`; branch
  `integration/term-cache-preview-20260913`.

## Live runtime identity (re-verified at capture start)

- Machine rebooted 2026-09-13 09:17:02 +08; the supervised runtime auto-restarted
  from the boot task. `ops/runtime/logs/supervisor-state.json` records the clean
  transition: previous children server `30032` / client `27408` → current
  server `14960` / client `15024`, with identical
  `releaseSha=3d916b261d6a2db71b153558ac8c2d151e2fccd0`,
  `productPin=d44f29e04d359ad9b18e4443b0fd4fed1daeaecd`, same `sourceDir` and
  env file. This is a re-record under packet §3.2, not a release divergence.
- Listeners: 5001 → PID 14960, 5174 → PID 15024 (exactly one owner per port).
  `git rev-parse HEAD` of the release dir = `3d916b26…`.
- Health: local `/api/v1/health` 200, local `/api/v1/health/ready` 200
  (`database: ok`), Tailnet `https://njgrm.buru-degree.ts.net/api/v1/health` 200.
- Supervisor log: `All targets healthy (liveness and dependency readiness)`;
  `[rollover-automation] Disabled via ROLLOVER_AUTO_SYNC_ENABLED=false`.
- Database: `atlas_recovery_clean_rebuild_20260905`.

## Read-only before-signatures (2026-09-13T13:07:26.945Z ≈ 21:07 +08)

Planner-side Prisma read-only probe (release client; `DATABASE_URL` loaded
in-process from `D:\ATLAS-runtime-config\atlas-server.env`; never echoed):

| Signature | Value |
|---|---|
| `schools` count | 2 |
| mirror `1` (year 8 `2029-2030`) | archived, inactive, cache NULL |
| mirror `223` (EnrollPro year `9`, `2030-2031`) | active, not archived, `termContractCachedAt` NULL |
| `TERM_CACHE_SYNC_APPLIED` audit count | 0 |
| `auditLog` max id | 773 |
| `FacultySubject` / `GenerationRun` / `PublishedScheduleRevision` | 183 / 1 / 0 |
| actor 46 | officer, active, `failedLoginCount` 0, `lockedUntil` NULL, `facultyId` NULL, `lastLoginAt` 2026-09-12T15:13:43.032Z |

## Custodian session (fresh QA context; sole login; final custody owner)

- Fresh browser context at `https://njgrm.buru-degree.ts.net/login` (no query
  string; no bridge token captured). Pre-login freshness: `sessionStorage`
  `atlas_local_token`/`atlas_bridge_token` null, `localStorage`
  `atlas_local_token` null, `atlasAuthToken` cookie absent. No normalization
  required.
- `window.location.origin` asserted `https://njgrm.buru-degree.ts.net` for the
  login, `/auth/me`, preview, and cleanup evaluations.
- Exactly one login attempt (no retry), "Remember me" unchecked. Actor binding:
  `GET /api/v1/auth/me` → 200, `userId` 46, `role` officer, `schoolId` 1,
  `authSource` local.
- Authorized login delta: `LOCAL_LOGIN_SUCCESS` audit id **785** (actor 46,
  school 1, `createdAt` 2026-09-13T13:13:33.460Z); actor 46 `lastLoginAt`
  2026-09-12T15:13:43.032Z → 2026-09-13T13:13:31.799Z; `failedLoginCount`
  re-asserted 0, `lockedUntil` NULL, `facultyId` NULL (verified no-ops).
- Cleanup (no UI logout control rendered): in-page removal of
  `atlas_local_token` (session + local), `atlas_bridge_token`, `userRole`;
  cookie expiry attempted on `/api/v1` and `/`. Effective termination proven by
  `GET /api/v1/auth/me` → **401 `NO_TOKEN`**. All tabs closed (0 open).

## Preview attempt (the only POST)

- Request: `POST /api/v1/runtime/term-authority/preview` body `{"schoolId":1}`
  with the local JWT, same-origin, at the Tailnet origin.
- Response: **HTTP 503**, `application/json`:
  `{"code":"ENROLLPRO_UNREACHABLE","message":"EnrollPro school-year authority is unreachable."}`
- ATLAS server log (release host), at the preview moment:
  `2026-09-13T13:14:14.513Z [warn] [supervisor] [server] [ATLAS] 503 on POST /api/v1/runtime/term-authority/preview: ENROLLPRO_UNREACHABLE EnrollPro school-year authority is unreachable.`
- Corroborating browser console (level error): 502 `/enrollpro-api/settings/public`,
  502 `/enrollpro-uploads/<redacted>.png` (×3), 503 preview; the 404 on
  `/api/v1/generation/1/9/runs/latest` is the known no-current-run state.
- Not captured (absent because the request failed closed before term-authority
  computation): `terms[]`, `format`, `liveSemanticRevision`,
  `persistedSemanticRevision`, `cachedAt`, `activeTermAvailability`,
  `fingerprint` (64-hex), `confirmationText` (expected shape
  `SAVE_TERM_AUTHORITY_1_9`), `zeroWrite`. No re-call was made.

## External-dependency probe and classification (packet §7)

Planner read-only probes, same capture window:

- `tailscale status`: `100.120.169.123  dev-jegs  windows  active; relay "hkg"; offline, last seen 1h ago`.
- `Test-NetConnection 100.120.169.123:5002` → `TcpTestSucceeded: False`; `PingSucceeded: False`.
- Raw EnrollPro ordered-contract probes from this host, using
  `ENROLLPRO_API=http://100.120.169.123:5002/api` and the configured service
  credential (never printed):
  `GET /integration/v1/school-year` → **timeout**;
  `GET /integration/v1/active-term` → **timeout**.

Classification: the raw ordered-contract probe fails **as well**, so this is
**not** the packet §7 ATLAS defect case ("preview fails while a raw probe
succeeds"). It is an external dependency outage. ATLAS behavior was correct and
fail-closed: typed 503 `ENROLLPRO_UNREACHABLE`, no cache read/write, no apply
path entered, no rollback needed.

## After-signatures (2026-09-13T13:14:30.123Z) and zero-write assertion

| Signature | After | Delta vs before |
|---|---|---|
| mirror 223 `termContractCachedAt` | NULL | none |
| `TERM_CACHE_SYNC_APPLIED` count | 0 | none |
| `FacultySubject` / `GenerationRun` / `PublishedScheduleRevision` | 183 / 1 / 0 | none |
| `schools` / mirrors | 2 / unchanged | none |
| `auditLog` rows with id > 773 | exactly one: id 785 `LOCAL_LOGIN_SUCCESS` (actor 46, school 1, 13:13:33.460Z) | authorized login |
| actor 46 `lastLoginAt` | 2026-09-13T13:13:31.799Z | authorized login |
| actor 46 `failedLoginCount` / `lockedUntil` / `facultyId` | 0 / NULL / NULL | none (no-op reassertions) |

`auditMaxId` moved 773 → 785 because PostgreSQL sequence values 774–784 were
consumed without committing rows; the `id > 773` query returns exactly one
persisted row. **Zero-write assertion holds: the only mutation in the entire
window is the single authorized login delta.**

## Mutation exclusions honored

No `term-authority/apply`; no rollover sync/archive; no Teaching Load
carry-forward/suggestion apply; no generation; no publication; no
schema/migration; no shared-runtime restart/cutover; no companion-repository
mutation; no runtime-listener action; no additional login attempt.

## Re-capture prerequisites (for the operator)

1. Restore the EnrollPro Tailnet host `dev-jegs` (`100.120.169.123:5002`) so the
   raw `school-year` and `active-term` probes succeed from the ATLAS host.
2. Return a fresh explicit one-login authorization (the 2026-09-13 login is
   consumed per its own terms).
3. Re-run the same custodian procedure (zero-write preview, before/after
   signatures, cleanup). The apply remains a later separately approved HIGH
   action and must not execute before a successful capture binds the exact
   fingerprint and `confirmationText`.

## Capture boundary

All evidence above was captured 2026-09-13 between 21:07 and 21:15 +08
(13:07–13:15 UTC) against live release `3d916b26` and database
`atlas_recovery_clean_rebuild_20260905`.
