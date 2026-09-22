# ATLAS Runtime Supervision (`ops/runtime`)

Repository-owned, testable supervision and production-hosting contract for the
ATLAS Tailnet host. It replaces the previous ephemeral runtime (transient copied
`.env`, unmanaged PIDs, Vite dev/HMR, liveness-only health, no restart owner).
**This contract does not install or deploy anything live.** Installation,
cutover, and removal of the legacy scheduled task belong to a separately
approved `HIGH` packet.

## Topology

| Port | Owner | Artifact |
|------|-------|----------|
| `5001` (configurable) | supervised `atlas-server` child | `atlas-server/dist/server.js` |
| `5174` (configurable) | supervised production host child | `ops/runtime/host.mjs` serving `atlas-client/dist` |

Exactly one process owns each port. `ops/runtime/runtime-contract.json` is the
immutable, reviewed contract; it contains no secrets, no machine usernames, no
database URLs, and no worktree-only transient paths.

## Operator-owned environment

The supervisor reads durable paths from process environment (never copied into
the repository, never printed):

| Variable | Meaning |
|----------|---------|
| `ATLAS_RUNTIME_ENV_FILE` | Absolute path to the operator-owned dotenv file, outside any git worktree. |
| `ATLAS_RUNTIME_SOURCE_DIR` | Absolute durable deployed source directory. |
| `ATLAS_RUNTIME_RELEASE_SHA` | Exact installed HEAD; must equal `git -C <sourceDir> rev-parse HEAD` and must descend from the reviewed `productPin`. |
| `ATLAS_RUNTIME_LOG_DIR` | Optional absolute log directory; defaults to `<source>/ops/runtime/logs`. |
| `ENROLLPRO_PROXY_ORIGIN` | EnrollPro origin for `/enrollpro-api` and `/enrollpro-uploads`. **Required for a supervised production launch.** |

### EnrollPro proxy origin (`ENROLLPRO_PROXY_ORIGIN`)

- **Required for `start`/`rollback`.** The launch gate fails closed with the
  typed code `ENROLLPRO_PROXY_ORIGIN_MISSING` before constructing or spawning
  any child when neither the durable env file nor the inherited environment
  supplies the value. `stop` and `status` stay usable without it.
- **Durable file wins.** A value in `ATLAS_RUNTIME_ENV_FILE` (`envValues`)
  overrides a conflicting inherited process value; pinned invariants are
  unaffected.
- **Origin format.** Only a normalized absolute `http(s)` origin is accepted:
  credentials, any path, query strings, fragments, non-`http(s)` schemes, and
  unparseable values are rejected with the typed code
  `ENROLLPRO_PROXY_ORIGIN_INVALID` (before any child spawn). A single trailing
  slash normalizes to the same origin. Blank values are treated as missing.
- **Development fallback only.** Outside the launch gate the reviewed
  `upstream.defaultEnrollProOrigin` (`http://127.0.0.1:5000`) is used so local
  development remains usable; it is never accepted as supervised production
  configuration.
- **Degraded behavior.** An unreachable EnrollPro upstream returns a bounded
  `502 {"code":"UPSTREAM_UNREACHABLE"}` for that proxied request only. ATLAS
  liveness (`/__host/live`), dependency readiness (`/__host/ready`, backed by
  `/api/v1/health/ready`), `/api` proxying, and the SPA fallback stay available:
  EnrollPro availability is **not** a prerequisite for ATLAS readiness.

The production host (`ops/runtime/host.mjs`) requires `ATLAS_HOST_ENROLLPRO_TARGET`
to be a valid normalized `http(s)` origin; it is never silently inherited from
`ATLAS_HOST_API_TARGET`.

The reviewed `productPin` is an **ancestor milestone**, not an equality target.
A commit cannot contain its own SHA, so the pin cannot be the same commit that
introduces `ops/runtime/**`; the supervisor verifies ancestry
(`git merge-base --is-ancestor <productPin> HEAD`) and separately requires the
operator to declare the exact installed release SHA. Status surfaces both
distinctly.

Secret values from `ATLAS_RUNTIME_ENV_FILE` are loaded into the child process
environment by name only. They are never written to the repository, logs, or
status output; log lines are additionally scrubbed.

## Commands

```
node ops/runtime/cli.mjs start              # verify pin + env, then start both owned children
node ops/runtime/cli.mjs status             # deterministic status from durable state
node ops/runtime/cli.mjs stop               # terminate only owned PIDs; require port release
node ops/runtime/cli.mjs rollback           # stop and restore the previous recorded release
node ops/runtime/cli.mjs install-preview    # print the future live-install steps (never executed)
node ops/runtime/cli.mjs uninstall-preview  # print the reversal steps (never executed)
node ops/runtime/cli.mjs inventory          # read-only schtasks query of the legacy task
```

## Reviewed release cutover runner

`deploy-runner.ps1` replaces hand-authored release cutover blocks. It requires the
target and incumbent identities explicitly, verifies a clean target and the exact
supervisor listener lineage, captures the scheduled-task XML as bytes, and writes a
redacted plan under the audit directory. It is dry-run by default; `-Execute` is the
only mode that registers the preserved task XML, updates the two machine runtime
variables, quiesces the resolved supervisor PID tree, and starts the restored task.

The runner never builds, installs, migrates, connects to the database, prints env-file
contents, or kills by image name. If execution fails after cutover begins, rollback
restores only the captured task XML and the two captured machine variables. The task
XML is replaced byte-for-byte at the path references; its encoding declaration is
never rewritten because this host's `schtasks` output is accepted unmodified despite
declaring UTF-16.

Equivalent npm scripts exist under `runtime:*`.

## Guarantees

- **Fail-closed pin (ancestor + exact release).** Startup refuses a missing
  `ATLAS_RUNTIME_*` reference; a `ATLAS_RUNTIME_RELEASE_SHA` that is absent,
  malformed, or differs from the deployed HEAD; and a deployed HEAD that does not
  descend from the reviewed `productPin` (typed `PIN_MISMATCH`).
- **Unknown-listener rejection.** A port owned by an unrecorded process aborts
  startup; the supervisor never adopts or broad-kills it.
- **No broad process killing.** Only recorded owned child PIDs are terminated,
  by exact PID and its tree.
- **Bounded restart/backoff.** An unexpected child exit restarts with bounded
  exponential backoff; exceeding `maxRestarts` fails closed instead of looping.
- **Distinct readiness.** Liveness (`/api/v1/health`, `/__host/live`) is checked
  separately from dependency readiness (`/api/v1/health/ready`, `/__host/ready`);
  the constant liveness response alone is never sufficient.
- **Pinned rollover invariant.** `ROLLOVER_AUTO_SYNC_ENABLED=false` is injected
  into every child from the contract.
- **Clean restart on corruption.** Under `ATLAS_SUPERVISED=true` an uncaught
  server exception exits the process so the supervisor performs a clean restart.
- **Bounded durable logs.** Timestamped, size- and file-count-bounded.
- **Production hosting only.** `atlas-client/dist` is served with SPA fallback
  and `/api`, `/uploads`, `/enrollpro-api`, `/enrollpro-uploads`, SSE, and
  WebSocket upgrade parity. A Vite dev/HMR tree is rejected.

## Legacy scheduled task

`ATLAS-DevServer-Temp2` is observed as read-only external state via
`schtasks /query` and is explicitly superseded by `RUNTIME-SUPERVISION-C01`.
The source contract never creates, changes, disables, or deletes it.

## Tests

```
npm run runtime:test
```

Tests use isolated ports and disposable child processes only; they never bind
`5001`/`5174` and clean up every process, listener, and temporary directory.
