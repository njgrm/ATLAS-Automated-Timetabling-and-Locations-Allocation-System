# TERM-CACHE-CATCHUP-PREVIEW — live zero-write capture (second attempt, re-based baseline)

- **Classification: CAPTURED** (zero-write preview obtained; no cache apply).
- Cycle: `TERM-CACHE-CATCHUP-PREVIEW` fresh re-capture, activated 2026-09-14 (Asia/Manila).
- Role: authorized session custodian (sole user of the persistent Playwright profile for this task).
- Login performed: exactly **ONE** (one `LOCAL_LOGIN_SUCCESS` audit row, id 793).
- Preview dispatched: exactly **ONE** `POST /api/v1/runtime/term-authority/preview` → **200**.
- Database writes by this capture: **only** the single login audit row (793) + actor 46 `lastLoginAt`.
- First attempt (blocked) record preserved unmodified at `docs/reviews/term-cache-catchup-preview-20260914/capture.md`.
- Capture boundary: 2026-09-14 09:22–09:30Z (17:22–17:30 +08); DB `atlas_recovery_clean_rebuild_20260905`.

## 1. Authorization and boundary

Operative authorization (returned 2026-09-14): `CYCLE ON: Resume TERM-CACHE-CATCHUP-PREVIEW as a fresh
re-capture cycle.` It grants exactly one (1) bounded local login at the ATLAS Tailnet origin
`https://njgrm.buru-degree.ts.net` for one privileged QA custodian context, whose **only** expected
database mutation is one `LOCAL_LOGIN_SUCCESS` audit row plus that actor's `last_login_at`, to execute
the zero-write preview `POST /api/v1/runtime/term-authority/preview {"schoolId":1}` and never apply the cache.

Hard exclusions honored: no `term-authority/apply`; no rollover sync/archive; no Teaching Load action;
no generation; no publication; no schema/migration; no shared-runtime restart/cutover/env/task change;
no companion mutation; no additional login; no browser-session reuse; no sparse-checkout widening; no
writes other than the single evidence file plus the single authorized login delta. No credentials or
tokens were read into any artifact.

## 2. Re-based baseline rationale (required deviation from packet §3)

The planner re-based the packet baseline after an off-cycle external login was observed:
`auditLog` id **792**, action `LOCAL_LOGIN_SUCCESS`, actor 46, school 1,
`createdAt=2026-09-14T09:08:43.462Z` (17:08:43 +08), metadata `{role: officer, ipAddress: 127.0.0.1,
userAgent: Chrome/153, identifier: 1234501}`. Classification: `EXTERNAL_LOGIN_OBSERVED` — pre-existing,
not this cycle's browser tooling, not this cycle's login budget, and not a stop condition.
Re-based anchor: BEFORE max `auditLog` id = **792**; actor 46 `lastLoginAt` =
`2026-09-14T09:08:41.213Z`. The anchor was **re-verified live at this capture start** (§5) and matched
exactly (max id 792, zero rows above it), so the login budget was intact and the capture proceeded.

## 3. Worktree / branch / base

| Item | Value |
|---|---|
| Worktree | `D:\ATLAS-worktrees\integration-term-cache-preview-20260914` |
| Branch | `integration/term-cache-preview-20260914` |
| Base | `29284ac6218b989ab860cde0d36266eabf26395b` |
| Tip at capture start | `8d28ec757200f1072eb347d252156cff9eab21af` (first-attempt record commit) |
| `git status --short` at start | empty |

Sparse cone left limited to `docs/`; no dependency install, build, or checkout widening was performed.

## 4. Live runtime preflight re-verify (read-only, this capture)

- `http://127.0.0.1:5001/api/v1/health` → **200** `{"status":"ok","service":"atlas"}`.
- `http://127.0.0.1:5001/api/v1/health/ready` → **200**
  `{"status":"ready","service":"atlas","checks":{"database":"ok"}}`.
- `https://njgrm.buru-degree.ts.net/api/v1/health` → **200**; `https://njgrm.buru-degree.ts.net/` → **200**.
- `node ops/runtime/cli.mjs status` (release `D:\ATLAS-runtime-supervised-3d916b26-20260912`):
  `state=running`, `releaseSha=3d916b261d6a2db71b153558ac8c2d151e2fccd0`,
  `ROLLOVER_AUTO_SYNC_ENABLED=false`, targets server 5001 → pid 19448, client 5174 → pid 10880
  (both `owned:true`).
- Listeners: 5001 → PID 19448, 5174 → PID 10880 (single owner per port; recorded PIDs match).
- No Chromium/Chrome/Playwright browser process held the shared profile before the capture.
- Note (non-blocking, informational): the supervisor status snapshot reported `live:false` for both
  targets while direct liveness/readiness probes above returned **200**; the direct probes are
  authoritative for listener liveness.

## 5. BEFORE-signatures captured at capture start (live, timestamped)

Probe window: **2026-09-14T09:23:07.757Z – 09:23:07.921Z** (17:23:07 +08),
DB `atlas_recovery_clean_rebuild_20260905`.

| Signature | Live value | vs re-based baseline |
|---|---|---|
| `schools` count | 2 | match |
| mirror id 1 | school 1, year 8 `2029-2030`, `isActive=false`, `isArchived=true`, cache NULL, cachedAt null | match |
| mirror id 223 | school 1, year 9 `2030-2031`, `isActive=true`, `isArchived=false`, `termContractCache=null`, `termContractCachedAt=null` | match |
| `TERM_CACHE_SYNC_APPLIED` count | 0 | match |
| FacultySubject count | 183 | match |
| GenerationRun count | 1 | match |
| PublishedScheduleRevision count | 0 | match |
| actor 46 | role `officer`, schoolId 1, isActive true, facultyId null, failedLoginCount 0, lockedUntil null | match |
| actor 46 `lastLoginAt` | `2026-09-14T09:08:41.213Z` | match (re-based) |
| `auditLog` max id | **792** | match (re-based anchor) |
| rows with `id > 792` | **0** | match (clean baseline; budget intact) |

## 6. Session trace (live Tailnet)

- Navigation: `https://njgrm.buru-degree.ts.net/login` (no query string);
  `window.location.origin === "https://njgrm.buru-degree.ts.net"` **asserted**.
- Freshness: `sessionStorage` empty; `atlas_local_token`/`atlas_bridge_token` null in session+local;
  `atlasAuthToken` cookie absent; zero cookies. **Nothing to clear.**
- Login: exactly ONE attempt, identifier `1234501`, "Remember me" verified `aria-checked="false"`
  (unchecked) and left untouched. Post-login URL `https://njgrm.buru-degree.ts.net/`;
  origin re-asserted `https://njgrm.buru-degree.ts.net`.
- `GET /api/v1/auth/me` → **200**
  `{"user":{"userId":46,"role":"officer","mustChangePassword":false,"authSource":"local","schoolId":1,"accountId":46}}`.
- Storage after login: `sessionStorage.atlas_local_token` present; no auth cookie (header-based Bearer).
- Audit login row (from AFTER probe): id **793**, `LOCAL_LOGIN_SUCCESS`, actorId 46, schoolId 1,
  targetIds `[46]`, `createdAt=2026-09-14T09:27:58.608Z`, metadata
  `{role, ipAddress:"127.0.0.1", userAgent:"Chrome/153", identifier:"1234501"}`.

## 7. Preview call and full response JSON (no tokens)

- Call: `POST https://njgrm.buru-degree.ts.net/api/v1/runtime/term-authority/preview`
  header `Authorization: Bearer <session token, read in-page and never printed>`,
  body `{"schoolId":1}`. Called **exactly once**; network index 107; **HTTP 200**. No retry.
- Response body:

```json
{"schoolId":1,"schoolYearId":9,"yearLabel":"2030-2031","mirrorId":223,"state":"READY","code":"ACTIVE_TERM_UNRESOLVED","message":"Saving stores only this school year\u2019s ordered term authority. It does not sync faculty, sections, or Teaching Load.","format":"TRIMESTER","terms":[{"identity":"T1","displayLabel":"TERM 1","order":1,"startDate":"2030-06-08","endDate":"2030-09-15"},{"identity":"T2","displayLabel":"TERM 2","order":2,"startDate":"2030-09-16","endDate":"2030-12-18"},{"identity":"T3","displayLabel":"TERM 3","order":3,"startDate":"2030-12-19","endDate":"2031-04-08"}],"liveSemanticRevision":"a51b62a26e27416c3d1295697f144d7ae5de5c56bb6a5e0d25bcb0c24dd8abb9","persistedSemanticRevision":null,"cachedAt":null,"activeTermAvailability":"UNRESOLVED","fingerprint":"d4cd7cc4466eb3390c802934204fca2fe01b8f80782478c7a6927b3041633f81","confirmationText":"SAVE_TERM_AUTHORITY_1_9","zeroWrite":true}
```

Decisive values:

| Field | Value |
|---|---|
| `state` | `READY` |
| `format` | `TRIMESTER` |
| `mirrorId` / `schoolYearId` / `yearLabel` | `223` / `9` / `2030-2031` |
| `terms[]` | T1 "TERM 1" order 1 (2030-06-08..2030-09-15); T2 "TERM 2" order 2 (2030-09-16..2030-12-18); T3 "TERM 3" order 3 (2030-12-19..2031-04-08) |
| `liveSemanticRevision` | `a51b62a26e27416c3d1295697f144d7ae5de5c56bb6a5e0d25bcb0c24dd8abb9` |
| `persistedSemanticRevision` | `null` |
| `cachedAt` | `null` |
| `activeTermAvailability` | `UNRESOLVED` (acceptable per packet §7; `code=ACTIVE_TERM_UNRESOLVED` with full `terms[]`) |
| `fingerprint` (64-hex) | `d4cd7cc4466eb3390c802934204fca2fe01b8f80782478c7a6927b3041633f81` |
| `confirmationText` | `SAVE_TERM_AUTHORITY_1_9` |
| `zeroWrite` | `true` |

Ordered terms match the planner-quoted raw EnrollPro contract field-for-field (identity/label/order/dates).

### Console and network

- Network: exactly one `POST /api/v1/runtime/term-authority/preview` → `200`.
- Console errors (none preview-related): 3× `502` `/enrollpro-uploads/...png` and 1× `502`
  `/enrollpro-api/settings/public` (known EnrollPro proxy origin issue, cf. `ENROLLPRO-PROXY-RECOVERY`);
  2× `404` `/api/v1/generation/1/9/runs/latest` (known-benign "no current run").

## 8. AFTER-signatures and zero-write assertion

Probe window: **2026-09-14T09:29:04.272Z – 09:29:04.376Z** (17:29:04 +08), same DB.

| Signature | BEFORE | AFTER | Delta |
|---|---|---|---|
| `schools` count | 2 | 2 | 0 |
| mirror id 1 (year 8, archived) | cache NULL / cachedAt null | cache NULL / cachedAt null | 0 |
| mirror id 223 (year 9, active) | `termContractCache=null` / `termContractCachedAt=null` | `termContractCache=null` / `termContractCachedAt=null` | **0 (no cache write)** |
| `TERM_CACHE_SYNC_APPLIED` count | 0 | 0 | 0 |
| FacultySubject count | 183 | 183 | 0 |
| GenerationRun count | 1 | 1 | 0 |
| PublishedScheduleRevision count | 0 | 0 | 0 |
| `auditLog` max id | 792 | 793 | +1 |
| rows `id > 792` | 0 | 1 | +1 (login only) |
| actor 46 `lastLoginAt` | `2026-09-14T09:08:41.213Z` | `2026-09-14T09:27:55.967Z` | transitioned |
| actor 46 `failedLoginCount` / `lockedUntil` / `facultyId` | 0 / null / null | 0 / null / null | 0 |
| actor 46 role / schoolId / isActive | officer / 1 / true | officer / 1 / true | 0 |

Only delta = one `LOCAL_LOGIN_SUCCESS` row (id 793) + actor 46 `lastLoginAt`. **Zero-write assertion holds.**

## 9. Server-log corroboration

- Supervisor log `D:\ATLAS-runtime-supervised-3d916b26-20260912\ops\runtime\logs\atlas-supervisor.log`
  last write `2026-09-14T05:40:29Z` (pre-capture); successful requests are not logged at warn level.
- No preview outcome line exists for this capture (expected — `200` is not a warning/error), and **no**
  `503 ENROLLPRO_UNREACHABLE` line appears for this capture. The only `term-authority` entry in the log
  is the historical `2026-09-13T13:14:14.513Z` `503 ENROLLPRO_UNREACHABLE` from the first attempt.
  Therefore no `ENROLLPRO_UNREACHABLE` finding applies.

## 10. Cleanup proof

- Removed `atlas_local_token` (session + local), `atlas_bridge_token`, `userRole`; expired all cookies
  (none existed). `sessionStorage` emptied; no `token`/`jwt` keys remain in `localStorage`.
  Remaining `localStorage` keys are non-credential app caches
  (`atlas:active-school-year-context:*`, `atlas:accent-hsl`, `atlas:subjects:v1:1`,
  `atlas:section-home-rooms:v1:1:9`, `atlas:faculty-summary:v5:1:9`, `atlas:section-summary:v1:1:9`,
  `atlas:shell-branding:v1`, `atlas:session-user:v1`) — no JWT.
- `GET /api/v1/auth/me` (no Authorization header) → **401** `{"code":"NO_TOKEN","message":"Authorization header missing or malformed."}`.
- All tabs closed; browser context released; no Chromium process remains; shared profile flushed
  (~17:30 +08). No remembered JWT left behind.
- Temp read-only probe `%TEMP%\opencode\term-cache-probe.cjs` deleted; no credentials/tokens written anywhere.

## 11. Stop-condition notes

- Packet §7 stop conditions encountered: **none**. Preview returned a full ordered contract with
  `state=READY`; `ACTIVE_TERM_UNRESOLVED` is the acceptable structure state with `terms[]` present.
- No `AUTH_SESSION_REQUIRED`, no `ENROLLPRO_UNREACHABLE`, no non-login DB delta, no secret exposure.

## 12. Sanitization

No tokens, passwords, credential fields, JWTs, service tokens, or `DATABASE_URL` values are recorded in
this file. Only non-secret counts, IDs, timestamps, hashes, and nullness were captured.
