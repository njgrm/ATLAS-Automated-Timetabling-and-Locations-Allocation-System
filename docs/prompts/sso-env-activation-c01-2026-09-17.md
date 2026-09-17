# SSO-ENV-ACTIVATION-C01 - load the four companion-SSO keys with one runtime restart

ROLE: EXECUTOR. Recommended reasoning variant: `high` (HIGH shared-runtime action).
Risk tier: **HIGH** - shared-runtime restart plus a durable-env load.

## Objective

Bring the already-deployed and already-reviewed companion-SSO code into service by
restarting the supervisor-owned runtime so it loads the four SSO keys the operator
has appended to the durable env. **No build, no install, no task re-point, no
release change.** The release stays at the live pin.

## Immutable identity

| Item | Value |
| --- | --- |
| Live release pin | `8eb0511baa537d4212f24a007ac40e2dded38c0e` (unchanged by this action) |
| Release directory | `D:\ATLAS-runtime-supervised-8eb0511baa53-20260917` |
| Durable env | `D:\ATLAS-runtime-config\atlas-server.env` |
| Directive | read `origin/main:AGENTS.md` directly; record its blob + LF-SHA-256 in the evidence |

Re-read `origin/main` and the register revision at dispatch; this packet is
authored before the stream is registered.

## Preconditions (verify read-only; any failure is a STOP)

1. Release identity: `git -C D:\ATLAS-runtime-supervised-8eb0511baa53-20260917 rev-parse HEAD`
   equals the pin, and `ops/runtime/cli.mjs status` reports `releaseSha` equal to the pin
   (do not score the stale `live` flags).
2. The env file holds **exactly 17 keys** - the 13 pre-existing names plus
   `ENROLLPRO_SSO_CLIENT_SECRET`, `ATLAS_SSO_REVERSE_CLIENT_SECRET`,
   `ENROLLPRO_SSO_CALLBACK_URL`, `ENROLLPRO_BASE_URL` - and its ACL is the restored
   read-only descriptor. **Verify, do not modify.** Do not print any value; record
   key names and a file checksum only.
3. `ENROLLPRO_SSO_CALLBACK_URL` is exactly
   `https://dev-jegs.buru-degree.ts.net/api/auth/companion-sso/atlas/reverse/callback`
   with no trailing slash (ATLAS compares it strictly). Record its value; it is not a secret.
4. Incumbent listener identity captured (task fields, PIDs, health) immediately before the restart.

## Execution

1. Record the incumbent identity and the env key-name set + checksum.
2. Stop only the supervisor-owned tree using `node ops/runtime/cli.mjs stop` from the
   release directory, then a settle window of at least 10 seconds, then verify 5001
   and 5174 are actually free. Never touch port 5175, unrelated processes, Tailscale
   Serve, or any non-supervisor PID.
3. Start via the registered task: `schtasks /run /tn ATLAS-Runtime-Supervisor`.
   `launchOwner` = the registered task `\ATLAS-Runtime-Supervisor` (SYSTEM, ONSTART,
   `PT0S`, `IgnoreNew`); `launchMechanism` = that task. Do not launch the runtime as a
   child of your own shell.
4. Rollback (`rollbackLaunchOwner`/`rollbackLaunchMechanism`): the same registered
   task. Because neither the release nor the task registration changes, rollback is
   simply another stop/start of the same task; no re-point is required.

## Acceptance

| # | Row | Pass condition |
| --- | --- | --- |
| 1 | Release identity | `cli.mjs status` `releaseSha` + installed HEAD equal the pin |
| 2 | Listeners | exactly one owner per port (5001, 5174); the owning tree is the task-launched supervisor, and it survives the invoking shell exiting |
| 3 | Health | local health + ready (`database: ok`), host 5174, Tailnet health all 200 |
| 4 | Env loaded | the four SSO key names are present; all other names unchanged against the 13-key set |
| 5 | SSO mounting | unauthenticated `POST /api/v1/auth/sso/authorize` and `POST /api/v1/auth/sso/exchange` both return 401 (a GET returns 404 because they are POST-only; use the correct method) |
| 6 | Positive half-proof | with an authorized privileged session, `POST /api/v1/auth/sso/authorize` with `client_id=enrollpro` and the exact registered `redirect_uri` returns a `callbackUrl`; then `POST /api/v1/auth/sso/exchange` with the paired reverse bearer and that code's value returns the identity assertion (not `COMPANION_SSO_CLIENT_INVALID`). Disclose every login with its expected audit delta |
| 7 | Negative control | `POST /api/v1/auth/sso/exchange` with a mutated bearer returns the typed client failure and consumes no code |
| 8 | Rollback startable | the same-task rollback path is proven available (not executed unless row 2 or 3 fails) |

Auth budget: as many authenticated logins as rows 6 and 7 require, each disclosed
with its expected delta (one `LOCAL_LOGIN_SUCCESS` plus that actor's `last_login_at`
per login), followed by logout.

## Boundaries

No data mutation, generation, publication, Teaching Load apply, term-cache apply,
rollover, migration, release change, task re-point, or companion edit. Companions
READ_ONLY. Do not touch port 5175, unrelated processes, Tailscale Serve, any
durable-env key other than the four verified additions, or global Git configuration.
Do not print, log, or commit any secret value.

## Deliverable

One concise evidence document under `docs/reviews/sso-env-activation-c01/`
containing: pin and release identity, env key-name set + checksums (verified,
unmodified), the incumbent and post-restart PID/listener identity, health results,
the eight rows with per-row PASS/FAIL and evidence, every login with its observed
delta, rollback status, and the residual that the end-to-end cross-system test with
EnrollPro is a separate joint session.

## Note on the joint test

ATLAS-side acceptance ends at row 7. The full Flow A and Flow B browser test with
EnrollPro is a separate session: their configuration is confirmed complete and the
mediator (`/auth/enrollpro/authorize`) is live, so the only remaining cross-system
dependency is their credential-aware probe passing once this restart completes.
