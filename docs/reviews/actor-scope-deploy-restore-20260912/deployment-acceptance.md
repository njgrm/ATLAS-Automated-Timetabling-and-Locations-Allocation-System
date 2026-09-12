# ACTOR-SCOPE-DEPLOY-RESTORE-2026-09-12 — Deployment Acceptance Evidence

**Risk:** HIGH (shared-runtime service restoration + one authorized acceptance login).
**Packet:** `docs/prompts/actor-scope-deploy-restore-2026-09-12.md` (approved deploy-as-restore).
**Role:** EXECUTOR handoff. Not acceptance — primary planner and fresh QA own the verdict.

## Identity

- Product target SHA (pin): `d44f29e04d359ad9b18e4443b0fd4fed1daeaecd`
- Worktree: `D:\ATLAS-worktrees\actor-scope-deploy-restore-20260912`
- Branch: `work/actor-scope-deploy-restore-20260912`
- Candidate: the branch tip commit(s) of `work/actor-scope-deploy-restore-20260912` above base `d44f29e0`; this evidence file is the only changed path (docs-only).
- Fallback artifact: `fdd0c8c7d9f417bdddbe4a3dc2ec9e1f627e2b22` (NOT used — new target healthy)
- Main checkout `D:\ATLAS` was never modified (status entry count unchanged at 178).

## Preflight (read-only)

- `Get-NetTCPConnection -LocalPort 5001,5174` → **NO_LISTENERS** (verified twice: at session
  start and immediately before starting the server). No unknown listener appeared.
- Tailnet `https://njgrm.buru-degree.ts.net/api/v1/health` → **502** before start (outage confirmed).
- Env source resolved: `D:\ATLAS-worktrees\integration-rrtc01r-20260912\atlas-server\.env`
  (copied into the deploy worktree `atlas-server\.env`; never printed, never committed).
- Sanitized DB target: local PostgreSQL `localhost:5432`, database
  `atlas_recovery_clean_rebuild_20260905` (resolved via `current_database()`).
- Pre-existing condition (not touched): stale `D:\ATLAS` dev processes from the main checkout,
  including a Vite instance that fell back to port **5175** (not 5001/5174). Precondition for
  5001/5174 emptiness held.

## Process identity and exact launch commands

| Process | PID | Started (Asia/Manila) | Working dir | Command |
|---|---|---|---|---|
| ATLAS server | 38468 | 2026-09-12 14:12:45 | `...\actor-scope-deploy-restore-20260912\atlas-server` | `node dist/server.js` (env `ROLLOVER_AUTO_SYNC_ENABLED=false` + copied `.env`) |
| ATLAS client | 38460 | 2026-09-12 14:15:24 | `...\actor-scope-deploy-restore-20260912\atlas-client` | `node node_modules/vite/bin/vite.js --host --port 5174` |

- Exactly one LISTEN socket on 5001 owned by 38468; exactly one LISTEN socket on 5174 owned by 38460.
- Server log invariants (server.out.log): `[ATLAS] Server listening on http://localhost:5001` ×1;
  `[rollover-automation] Disabled via ROLLOVER_AUTO_SYNC_ENABLED=false` ×1;
  `[rollover-automation] Starting` ×0; stderr empty.
- 60-second survival gate: alive, local health 200, Tailnet health 200, one socket per port.
- Tailnet routing (read-only `tailscale serve status`): Funnel `/` → `http://127.0.0.1:5174`;
  the Vite client proxies `/api` → `http://127.0.0.1:5001`.
- Tailnet after start: `/api/v1/health` → 200 `{"status":"ok","service":"atlas"}`; `/` → 200.

## Build / stage (no listener touched during outage)

`npm ci` (root, 270 pkgs) → `npm ci --prefix atlas-server` (252 pkgs) → `npm ci --prefix atlas-client`
(235 pkgs) → `npx prisma generate --schema ..\prisma\schema.prisma` (v6.19.2) → `npm run build`
(server, tsc clean) → `npm run build` (client, Vite 5.80s). No schema/migrate/db-push/seed/reset
command was run.

## Tailnet origin assertion

Every browser row executed with `window.location.origin === "https://njgrm.buru-degree.ts.net"`
(asserted explicitly). Localhost page origins were never used. Viewports: desktop 1366×768,
mobile 390×844.

## Stage C acceptance

| Row | State | Evidence |
|---|---|---|
| C1 Login | PASS | No reusable session (`/auth/me` → 401 `NO_TOKEN` pre-login). Exactly **one** login performed 2026-09-12 14:18:27 Asia/Manila = `2026-09-12T06:18:27.208Z` UTC (`audit_logs` row id 761 `LOCAL_LOGIN_SUCCESS`, actor 46; account 46 `last_login_at` `2026-09-12T06:18:26.650Z` UTC). (Password never written to any artifact.) |
| C2 `/auth/me` | PASS | 200: `userId=46, role=officer, authSource=local, schoolId=1`. Every later request used school 1 (the actor's authoritative school). |
| C3 `/runtime/rollover-status?schoolId=1` | PASS | 200. `drift.status="aligned"`, `recommendedAction="NONE"`; `termAuthority.state="MISSING"`, `code="TERM_AUTHORITY_MISSING"`, `persisted=false`, `needsRepair=true`, `repairAction="PREVIEW_TERM_CACHE_SYNC"`. Alignment must not be read as global no-action readiness. |
| C4 `POST /runtime/term-authority/preview {schoolId:1}` | PASS | 200: `mirrorId=223`, `yearLabel="2030-2031"`, format TRIMESTER, 3 ordered terms (T1 2030-06-08→09-15, T2 09-16→12-18, T3 12-19→2031-04-08), `fingerprint=d4cd7cc4466eb3390c802934204fca2fe01b8f80782478c7a6927b3041633f81`, `zeroWrite=true`. Negative control (no auth / `credentials:'omit'`) → **401 `NO_TOKEN`**. Zero writes confirmed by section-6 signatures. |
| C5 `/generation/1/9/readiness/diagnostic` | PASS | 200. `status="BLOCKED"`, `generateAllowed=false`; sole blocker `TERM_STRUCTURE_UNAVAILABLE` (DEMAND_AUTHORITY) — the expected blocker. Diagnostic's own signature `zeroWrite=true`. |
| C6 UI (Dashboard + `/admin/year-setup`) | PASS | Both viewports. Dashboard: "S.Y. 2030-2031 • ACTIVE", "Year aligned", explicit "Year or terms missing" / "Refresh EnrollPro year and terms" (no false readiness). Year Setup: "Year current — terms not saved", "EnrollPro 2030-2031", "Automatic year sync is off. Sync stays manual.", archived 2029-2030 read-only. No school-1 foreign data; no horizontal overflow (`scrollWidth==clientWidth`). Known-benign console noise present (`runs/latest` 404). Non-blocking copy nuance: the readiness checklist item label is the criterion name "EnrollPro year and ordered terms ready" (`Dashboard.tsx:365`, `done=false`, blocker hint shown). |
| C7 Unauthenticated spot-check | PASS | Isolated fresh browser context (persistent session untouched). `/login` renders form (Sign In=1, employee field=1, no token) at both viewports; `/public/schedules` renders truthful "No published schedule is available for the current school year (9) yet." at both viewports; no overflow. |
| C8 Actor-scope regression | PASS | All runtime/year/status reads carried `schoolId=1`, the actor's authoritative school from `/auth/me` (the system has exactly one school). Ordering proved scope resolution precedes scoped dispatch: `/auth/me` (reqs 110–115) before `runtime/rollover-status` (121), `runtime/context` (122), `dashboard/readiness-summary` (123). No request was dispatched while the session was unresolved. Served-client identity: the Tailnet-served Vite module `/src/pages/Dashboard.tsx` contains the pin-specific string `EnrollPro year and ordered terms ready`, matching the pinned worktree source. |

**Console/network classification:** expected/benign only — `404` on
`/api/v1/generation/1/9/runs/latest` (no current run) and `502` on `/enrollpro-api/settings/public`
and `/enrollpro-uploads/*.png` (EnrollPro at `127.0.0.1:5000` is outside this packet's start
boundary and was correctly not touched). Pages rendered truthfully in all cases.

## Database before/after signatures (read-only; sanitized counts)

| Signature | BEFORE | AFTER | Delta |
|---|---|---|---|
| `schools` | 1 | 1 | 0 |
| `_prisma_migrations` | 2 | 2 | 0 |
| `enrollpro_school_year_mirrors` school 1 (total/active/archived) | 2 / 1 / 1 | 2 / 1 / 1 | 0 |
| active mirror `term_contract_cached_at` | `null` | `null` | 0 |
| `audit_logs` action `TERM_CACHE_SYNC_APPLIED` | 0 | 0 | 0 |
| `atlas_auth_accounts` | 44 | 44 | 0 |
| `audit_logs` total | 233 | 234 | **+1** (`LOCAL_LOGIN_SUCCESS`, id 761, actor 46) |
| account 46 `last_login_at` (UTC) | 2026-09-11 16:32:32.926 | 2026-09-12 06:18:26.650 | login footprint |
| `faculty_subjects` | 183 | 183 | 0 |
| `generation_runs` | 1 | 1 | 0 |
| `published_schedule_revisions` | 0 | 0 | 0 |
| `teaching_load_cycles` | 2 | 2 | 0 |

The only delta is the authorized single-login footprint. No mirror-cache, `TERM_CACHE_SYNC_APPLIED`,
Teaching Load, generation, or publication mutation occurred. (The `audit_logs` id sequence advanced
720→761 with a single inserted row; enumeration of `id > 720` confirmed exactly one row.)

## Restartability

**`EPHEMERAL_DEPLOYMENT`.** The runtime depends on a transient copied `.env`
(`...\actor-scope-deploy-restore-20260912\atlas-server\.env`, sourced from the operator-maintained
`integration-rrtc01r-20260912` worktree) and two unmanaged detached node processes with no service
manager or watchdog. Recovery requirement: re-resolve/copy the operator `.env` and relaunch both
exact commands above; there is no auto-restart.

## Fallback status

Not invoked. The new `d44f29e0` target started cleanly and passed local + Tailnet health,
60-second survival, and rendered-origin checks. `fdd0c8c7` remains the startable fallback.

## Remaining risks

- `EPHEMERAL_DEPLOYMENT` (above): a host restart or process exit is not auto-recovered.
- EnrollPro is not running (its 502s are expected); `termAuthority` remains `MISSING` and canonical
  generation readiness is `BLOCKED` on `TERM_STRUCTURE_UNAVAILABLE` until the separately approved
  term-cache catch-up.
- Actor school is 1, the only school in this database; scope correctness here cannot be
  discriminated by output value alone and relies on session-resolution ordering and the
  ACTOR-SCOPE-C01 code path.
- Deployment-identity caveat: Windows WMI exposes no process working directory, so the server working directory is inferred from the recorded launch command and deploy logs; the client tree identity was content-verified against the originally served module.

## Mutation boundary honored

Stopped before term-cache apply, rollover sync, Teaching Load mutation, suggestion apply, generation,
and publication. No schema/migration/seed/reset. No other port or process was started, stopped, or
reconfigured. No logs, screenshots, or password material are committed.

**Planner reconciliation (2026-09-12):** C1 timestamps relabeled to verified UTC/Asia-Manila values
per wave audit F1; the DB signature table timezone label is corrected. No other content changed.
