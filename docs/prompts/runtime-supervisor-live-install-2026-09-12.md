# RUNTIME-SUPERVISION-LIVE-INSTALL-2026-09-12 — HIGH Live Supervisor Installation Packet

**Status: PREPARED — NOT APPROVED.** No listener may be stopped or started, no
Windows task created/modified, no legacy-task change made, and no environment
persisted until the operator returns the exact approval sentence in section 7.

**Risk:** HIGH — shared-runtime cutover of ATLAS server 5001 / client 5174,
Windows boot-task registration, and legacy `ATLAS-DevServer-Temp2` disposition.
This replaces the current `EPHEMERAL_DEPLOYMENT` (unmanaged PIDs, Vite dev
client, transient env copy).

**Prepared:** 2026-09-12 (Asia/Manila) by the primary planner, validated against
the Wave Completion Auditor `ses_f6b5175c6ffejlywhgblmX7c5k`
(`AUDIT_CLEAR` 14/14; capsule at
`docs/reviews/runtime-stability-wave-20260912/wave-completion-audit-lane-b-preinstall-r2.md`).
The auditor's N2–N4 packet preconditions are embedded below.

## 0. Frozen identity

- **Installed release (frozen):** `9d2938791460c1d19059e5eddd30d7bba623fdad`.
  `ATLAS_RUNTIME_RELEASE_SHA` must equal the deployed checkout's
  `git rev-parse HEAD` exactly; the supervisor verifies it at start/rollback.
- **Reviewed product pin:** `d44f29e04d359ad9b18e4443b0fd4fed1daeaecd` — must be
  an ancestor of the installed HEAD (verified true). Ancestry alone does not
  bind content: prove product-byte parity explicitly.
- **Product-byte parity to prove at preflight and post-install:**
  `atlas-client` bytes == `d44f29e0`; `atlas-server` == `d44f29e0` plus the four
  reviewed supervision files (`src/app.ts` health/ready route,
  `src/services/health.service.ts`, `src/services/crash-handler.service.ts`
  supervised exit, root `package.json` scripts).
- **Supervisor lineage:** `cf9b7e6e` → `aa699b2c` → `17009872` → `05143d65`
  (linear, unamended), integrated at merges `3a880726` + `0ec3b8f7`.

## 1. Preconditions (verify read-only immediately before execution)

1. Durable git checkout at the frozen release containing `ops/runtime/**`,
   built `atlas-server/dist` (with `GET /api/v1/health/ready` and the supervised
   crash handler) and a real production `atlas-client/dist` (no Vite dev
   markers), all at one HEAD.
2. Absolute **`ATLAS_RUNTIME_SOURCE_DIR`** set explicitly (never rely on the
   preview `REPO_ROOT` fallback); absolute **`ATLAS_RUNTIME_ENV_FILE`** outside
   the source dir carrying `DATABASE_URL` and `JWT_SECRET`; optional absolute
   `ATLAS_RUNTIME_LOG_DIR`.
3. Environment delivery to the task account proven (`setx /M` or a wrapper);
   the boot task must have no default execution-time limit (set explicitly —
   SCHTASKS ONSTART defaults to ~72 h, which would kill the supervisor).
4. The durable source dir is **runtime-mutable**: `ops/runtime/logs/` and
   `supervisor-state.json` are written inside it and are not gitignored. Exclude
   that state from release copies and never `git clean` the durable checkout.
5. Recorded incumbent identity: server PID **38468** (:5001), client PID
   **38460** (:5174), exact command lines, Tailnet origin
   `https://njgrm.buru-degree.ts.net`.
6. A startable previous-release artifact on disk **plus** an explicit rollback
   record — a first supervised start has `previous = null`, so `rollback`
   returns `ROLLBACK_UNAVAILABLE` until one is seeded/confirmed.
7. Legacy `ATLAS-DevServer-Temp2`: record state (exists, Ready, on-demand, last
   result 1) and do not modify it before supervisor health.
8. `ROLLOVER_AUTO_SYNC_ENABLED=false` pinned; current live runtime still returns
   404 on `/api/v1/health/ready` (expected — it predates this release).

## 2. Exact sequence (no replacement may bind an occupied port)

1. Offline build/preflight in the durable dir (no binding): pin/release/ancestry
   verification, env-reference check, artifact check, `install-preview` and
   `status` review; record every BEFORE signature (PIDs, sockets, health,
   audit/mirror/faculty/generation counts — sanitized, never printed
   credentials).
2. Freeze and verify SHAs: `ATLAS_RUNTIME_RELEASE_SHA` == HEAD == frozen
   release; `d44f29e0` ancestor proven; product-byte parity recorded.
3. Set and prove the environment variables are visible to the task account and
   to the launching shell (N2/N3).
4. Record incumbent launch identity, then **stop only the exact PIDs 38468 and
   38460** (no image-wide kill); prove zero listeners on 5001/5174 before
   proceeding.
5. Seed/confirm the previous-release rollback target and record its release SHA.
6. Review `install-preview` / `uninstall-preview` output.
7. Start the supervisor; require exactly one owned PID per port with liveness
   **and** dependency readiness 200 per child. **On failure:** stop only the new
   owned children and restore the accepted `d44f29e0` fallback (section 6).
8. Live verification on `https://njgrm.buru-degree.ts.net`: SPA deep-link
   fallback, static caching, `/api`, `/uploads`, `/enrollpro-api`,
   `/enrollpro-uploads`, SSE pass-through, WebSocket upgrade, origin assertion
   at `1366x768` and `390x844`; observe `ROLLOVER_AUTO_SYNC_ENABLED=false` and
   `ATLAS_SUPERVISED=true`.
9. Register the boot/start task with verified credentials/lifetime (N3).
10. **Disable the legacy `ATLAS-DevServer-Temp2` task only after supervisor
    health** (N4); deletion only if separately approved inside this action.
11. Record secret-free status, bounded logs, and the exact installed HEAD.

## 3. Post-install acceptance (re-prove on the live runtime; do not reuse source tests)

- Exact release identity + product-byte parity (section 0).
- One owner per port plus an unknown-listener fail-closed negative control.
- `/api/v1/health/ready` 200 on a real DB round trip; 503 → bounded restart when
  the DB is unreachable; supervised uncaught-exception clean exit; corrupt-state
  exit; give-up after `maxRestarts`.
- SPA/proxy/SSE/WS parity on the live origin at both viewports.
- Rollback restores the previous release paths; stop/uninstall leaves zero
  surviving listeners/processes.
- Durable bounded timestamped logs across restart; boot/start recovery after a
  host or task restart.
- Rollover automation disabled; actor-scope Stage C rows C2/C3/C4-positive/C5/
  C6/C8 re-run on the changed server product with the origin invariant and a
  **pre-authorized bounded audit delta** (one `LOCAL_LOGIN_SUCCESS` row plus the
  actor's `last_login_at`); zero unauthorized DB writes.
- Legacy task untouched until the approved step; its final disposition recorded.

## 4. Roles and evidence

- Execution by one fresh executor task against this packet from a clean
  boundary; the fixed-string `EXTERNAL_QA_BUNDLE` is not required. The
  acceptance stage (C-rows) is owned by a fresh QA delegate that holds the sole
  authorized login; the executor performs no authenticated acceptance.
- Evidence: one immutable docs commit recording commands, sanitized signatures,
  logs, status, and the exact installed HEAD. Never commit secrets, usernames,
  or raw task output containing machine paths (use the redacted inventory).

## 5. Mutation exclusions (hard stop)

Until the exact approval: no stop/start of any listener; no task registration;
no legacy-task change; no `.env` persistence; no term-authority apply, rollover
sync/apply, Teaching Load mutation, suggestion apply, generation, publication,
migration/schema command; no Tailnet, registry, firewall, or companion-repo
change. Do not use the dirty `D:/ATLAS` checkout as a boundary.

## 6. Rollback boundary

No zero-downtime claim — an outage window is accepted by design. On any failed
stage: stop supervised children by owned PID only; restore the accepted
`d44f29e0` artifact from its recorded startable location; re-enable the legacy
task only if operations require it; record evidence. If `rollback` is
unavailable on first start, fall back to the recorded startable artifact.

## 7. Exact approval sentence (operator grant required)

> I approve HIGH action RUNTIME-SUPERVISION-LIVE-INSTALL-2026-09-12: stop the
> exact incumbent PIDs 38468 (port 5001) and 38460 (port 5174); install the
> reviewed supervisor at release `9d2938791460c1d19059e5eddd30d7bba623fdad`
> serving product pin `d44f29e0` on 5001/5174 with
> `ROLLOVER_AUTO_SYNC_ENABLED=false`; register the boot/start task with verified
> environment delivery and no execution-time limit; disable the legacy
> `ATLAS-DevServer-Temp2` task only after supervisor health; keep the startable
> `d44f29e0` fallback artifact and rollback record; and run the post-install
> acceptance re-proof including exactly one recorded acceptance login (database
> delta limited to one `LOCAL_LOGIN_SUCCESS` audit row plus the actor's
> `last_login_at`, no other mutation).

The login clause may be struck to split deployment from acceptance; acceptance
would then require its own later grant. No other side effect is authorized by
this packet.
