# TERM-CACHE-CATCHUP-PREVIEW — live zero-write capture (BLOCKED at pre-login divergence)

- **Classification: BLOCKED** — `PREFLIGHT_DIVERGENCE(UNEXPECTED_PRIOR_LOCAL_LOGIN)`
- Cycle: `TERM-CACHE-CATCHUP-PREVIEW` fresh re-capture, activated 2026-09-14 (Asia/Manila).
- Role: authorized session custodian (sole user of the persistent Playwright profile for this task).
- **Login performed: NONE.**
- **Browser opened: NONE.**
- **Preview dispatched: NONE** (`POST /api/v1/runtime/term-authority/preview` was never called).
- Database writes by this capture: **NONE** (read-only Prisma probes only).
- Capture boundary: 2026-09-14 17:16–17:18 +08 (2026-09-14T09:16–09:18Z); DB `atlas_recovery_clean_rebuild_20260905`.

## 1. Authorization and boundary

Operative authorization (returned 2026-09-14): `CYCLE ON: Resume TERM-CACHE-CATCHUP-PREVIEW as a fresh re-capture cycle.`
It grants exactly one (1) bounded local login at the ATLAS Tailnet origin
`https://njgrm.buru-degree.ts.net` for one privileged QA custodian context, whose **only** expected
database mutation is one `LOCAL_LOGIN_SUCCESS` audit row plus that actor's `last_login_at`, to execute
the zero-write preview `POST /api/v1/runtime/term-authority/preview {"schoolId":1}` and never apply the cache.

Hard exclusions honored: no apply; no rollover sync/archive; no Teaching Load action; no generation;
no publication; no schema/migration; no shared-runtime restart/cutover/env/task change; no companion
mutation; no additional login; no browser-session reuse; no sparse-checkout widening; no writes other
than the single evidence file. No credentials or tokens were read into any artifact.

## 2. Worktree / branch / base

| Item | Value |
|---|---|
| Worktree | `D:\ATLAS-worktrees\integration-term-cache-preview-20260914` |
| Branch | `integration/term-cache-preview-20260914` |
| HEAD | `29284ac6218b989ab860cde0d36266eabf26395b` |
| `origin/main` | `29284ac6218b989ab860cde0d36266eabf26395b` (HEAD == base == origin/main) |
| `git status --short` at start | empty |

Sparse cone left limited to `docs/`; no dependency install, build, or checkout widening was performed.

## 3. Live runtime preflight re-verify (read-only, this capture)

- `http://localhost:5001/api/v1/health` → **200**; `/api/v1/health/ready` → **200**.
- `https://njgrm.buru-degree.ts.net/api/v1/health` → **200**.
- `http://localhost:5174/__host/live` → **200**; `/__host/ready` → **200**.
- `node ops/runtime/cli.mjs status` (release dir): `state=running`,
  `releaseSha=3d916b261d6a2db71b153558ac8c2d151e2fccd0`, `ROLLOVER_AUTO_SYNC_ENABLED=false`,
  targets server 5001 → pid 19448, client 5174 → pid 10880 (both `owned:true`).
- Listeners: 5001 → PID 19448, 5174 → PID 10880 (single owner per port; recorded PIDs match).
- Release dir HEAD = `3d916b261d6a2db71b153558ac8c2d151e2fccd0`; only pre-existing untracked
  `ops/runtime/logs/` present.
- Note (non-blocking, informational): the supervisor status snapshot reported `live:false` for both
  targets while direct liveness/readiness probes above returned **200**; the direct probes are
  authoritative for listener liveness.
- Note (informational): supervisor log contains historical Prisma `P1001` ("Can't reach database server
  at localhost:5432") entries timestamped `2026-09-14T05:13:09Z` and `2026-09-14T05:40:07Z`/`05:40:29Z`
  (13:13 / 13:40 +08) — i.e. before this capture. Postgres was listening on TCP 5432 (PID 7708), and
  the read-only Prisma probe below succeeded live, so the database is reachable now.

## 4. Planner §4 preflight (recorded, not re-run)

Preflight window 2026-09-14 ~17:00–17:10 +08: EnrollPro `dev-jegs` online; TCP 5002 accepts connection;
raw `GET /api/integration/v1/school-year` → 200 with `data.id=9`, `yearLabel=2030-2031`,
`termFormat=TRIMESTER`, terms T1 "TERM 1" (order 1, 2030-06-08..2030-09-15), T2 "TERM 2" (order 2,
2030-09-16..2030-12-18), T3 "TERM 3" (order 3, 2030-12-19..2031-04-08); raw `GET /active-term` → 409
`ACTIVE_TERM_UNRESOLVED` (expected valid structure state). Planner-quoted before-signatures:
`schools` 2; mirror 223 (year 9) active/non-archived with NULL cache, mirror 1 (year 8) archived;
`auditLog` max id **785**; `TERM_CACHE_SYNC_APPLIED` 0; FacultySubject 183 / GenerationRun 1 /
PublishedScheduleRevision 0; actor 46 `lastLoginAt=2026-09-13T13:13:31.799Z`.

## 5. BEFORE-signatures captured at capture start (live, timestamped)

Capture timestamp: **2026-09-14T09:17:22.645Z** (17:17:22 +08), DB `atlas_recovery_clean_rebuild_20260905`.

| Signature | Live value | vs planner-quoted baseline |
|---|---|---|
| `schools` count | 2 | match |
| mirror id 1 | school 1, year 8 `2029-2030`, `isActive=false`, `isArchived=true`, cache NULL, cachedAt null | match |
| mirror id 223 | school 1, year 9 `2030-2031`, `isActive=true`, `isArchived=false`, `termContractCache=null`, `termContractCachedAt=null` | match |
| `TERM_CACHE_SYNC_APPLIED` count | 0 | match |
| FacultySubject count | 183 | match |
| GenerationRun count | 1 | match |
| PublishedScheduleRevision count | 0 | match |
| actor 46 | role `officer`, schoolId 1, isActive true, facultyId null, failedLoginCount 0, lockedUntil null | partial |
| actor 46 `lastLoginAt` | **`2026-09-14T09:08:41.213Z`** | **DIVERGES** (planner quoted `2026-09-13T13:13:31.799Z`) |
| `auditLog` max id | **792** | **DIVERGES** (planner quoted 785) |
| rows with `id > 785` | **1** — `LOCAL_LOGIN_SUCCESS`, id **792**, schoolId 1, schoolYearId null, actorId **46**, createdAt **`2026-09-14T09:08:43.462Z`** | **DIVERGES** (expected 0 before the single authorized login) |

Audit detail (id 785 vs 792), same action/metadata shape `{role, ipAddress, userAgent, identifier}`:
- id 785: `LOCAL_LOGIN_SUCCESS`, actor 46, school 1, `2026-09-13T13:13:33.460Z` (the 2026-09-13 consumed login).
- id 792: `LOCAL_LOGIN_SUCCESS`, actor 46, school 1, `2026-09-14T09:08:43.462Z` (17:08:43 +08) — **not present in the planner-quoted baseline**.

## 6. Divergence finding and stop decision

An unaccounted privileged login already exists: audit id **792** (`actorId=46`, school 1,
`2026-09-14T09:08:43.462Z`), with actor 46 `lastLoginAt` already transitioned to
`2026-09-14T09:08:41.213Z`. The `17:08:43 +08` timestamp falls inside the stated planner-preflight
window (~17:00–17:10 +08) but is not reflected in the planner-quoted before-signatures, and the operator
authorized exactly one login whose sole expected delta is that login row.

Consequences that make proceeding invalid:
1. The governing packet expects, after the single authorized login, **exactly one** `LOCAL_LOGIN_SUCCESS`
   row with `id > 785`. There is already one (id 792) before any login. Performing the authorized login
   would leave **two** rows with `id > 785`, contradicting the packet's own zero-write/delta accounting
   and the fresh-QA verification contract.
2. The operator's budget is **exactly one** login; a second privileged login would exceed it (or the
   authorized login may already have been consumed).
3. A privileged login outside the authorization boundary is unexpected shared-data mutation; continuing
   against the altered baseline would confound attribution of the login delta.

Per the custodian instruction ("stop and return BLOCKED without logging in if any pre-login check
diverges") and the packet's incident-stop discipline, the capture stopped **before opening the browser
and before any login**. No `POST /api/v1/runtime/term-authority/preview` was dispatched, so no
fingerprint, ordered-term payload, `confirmationText`, or `activeTermAvailability` was obtained.

## 7. Session trace / preview result

- Session trace: **N/A — no login was performed and the browser was not opened.**
- Origin assertions: **N/A — no browser navigation occurred** (`window.location.origin` never asserted
  for this capture).
- Full preview JSON: **N/A — the preview endpoint was not called.**
- HTTP status: **N/A.**
- Console errors / network POST entry: **N/A.**

## 8. AFTER-signatures / zero-write assertion

- AFTER-signatures: **not applicable** — no mutation was authorized by this capture and none occurred.
- No `TERM_CACHE_SYNC_APPLIED` rows; `termContractCache`/`termContractCachedAt` remain NULL; the only
  pending change is the pre-existing, unaccounted login row 792 that pre-dates this capture.
- The read-only probes changed nothing (counts/findMany/aggregate/findUnique only).

## 9. Cleanup proof

- No browser session, cookie, or token was created by this capture; nothing to expire.
- `GET /api/v1/auth/me` 401 `NO_TOKEN` check: **N/A — no session existed to close** (freshness check was
  never reached because the capture stopped at the DB pre-login divergence).
- Temp read-only probe files (`%TEMP%\opencode\atlas-term-cache-probe.cjs`,
  `%TEMP%\opencode\atlas-audit-detail.cjs`) were **deleted**; no credentials/tokens were written anywhere.
- Worktree `git status --short` empty apart from this single committed evidence file.

## 10. Unperformed mandatory rows (explicit)

| Row | State | Reason |
|---|---|---|
| Freshness check (session/local token, auth cookie) | UNPERFORMED | Stopped before browser use per divergence rule |
| One bounded login + `/auth/me` actor binding | UNPERFORMED | Stopped before login; login budget not consumed by this capture |
| Zero-write preview + full JSON + fingerprint + confirmationText | UNPERFORMED | Stopped before login; preview not dispatched |
| AFTER-signatures / delta accounting | UNPERFORMED | No login/preview performed |
| Server-log corroboration of the preview POST | UNPERFORMED | No preview POST occurred |

## 11. Stop-condition / classification notes

- Packet §7 incident-stop class: unexpected shared-data mutation relative to the authorized baseline
  (a privileged login row not present in the quoted before-state). Evidence preserved; capture halted.
- Not an `ENROLLPRO_UNREACHABLE` block: EnrollPro was reachable per the recorded preflight.
- Not an `AUTH_SESSION_REQUIRED` block (no failed login attempt occurred).
- Typed classification: **`PREFLIGHT_DIVERGENCE(UNEXPECTED_PRIOR_LOCAL_LOGIN)`**.
- Planner decision needed: confirm who consumed the `2026-09-14T09:08:43Z` login (id 792), and either
  (a) re-base the before-signature baseline to max id 792 and re-authorize exactly one fresh login, or
  (b) treat the login budget as consumed and hold the re-capture. A fresh re-capture must use a
  baseline that already includes row 792 and must assert **exactly one** new `LOCAL_LOGIN_SUCCESS` row
  with `id > 792`.

## 12. Sanitization

No tokens, passwords, credential fields, JWTs, service tokens, or `DATABASE_URL` values are recorded in
this file. Only non-secret counts, IDs, timestamps, and nullness were captured.
