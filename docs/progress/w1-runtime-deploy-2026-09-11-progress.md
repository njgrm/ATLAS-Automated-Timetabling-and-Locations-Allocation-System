# W1-RUNTIME-DEPLOY progress — 2026-09-11

Approved packet: `docs/prompts/w1-runtime-deploy-tailnet-acceptance-2026-09-11.md`
(executor-verified SHA-256 `02D4727571FE50BB1B7D7A243BDFCA1DFDB58E4CDE2E78F3AB94EC8493BAB0EF`).

Approved/deployed product commit: `fdd0c8c7d9f417bdddbe4a3dc2ec9e1f627e2b22`.
Branch: `work/w1-runtime-deploy-20260911` (worktree `D:/ATLAS-worktrees/w1-runtime-deploy`).
`origin/main` at preflight: `b4f32319` (docs-only cycle-open on top of `fdd0c8c7`; product tree pinned to `fdd0c8c7`).

## Stage A — read-only preflight (captured before any stop)

### Runtime owners (revalidated, not trusted from planner)

| Port | PID | Name | Command line (sanitized) | Source dir | Created |
|---|---|---|---|---|---|
| 5001 | 22592 | node.exe | `node --require .../tsx/dist/preflight.cjs --import .../tsx/dist/loader.mjs src/server.ts` (parent chain: 14536 `tsx watch src/server.ts` ← 22364 `cmd /c tsx watch src/server.ts` ← 15996 `npm --prefix atlas-server run dev`) | `D:/ATLAS/atlas-server` | 21:09:07 +08 |
| 5174 | 15876 | node.exe | `node .../vite/bin/vite.js --host --port 5174` (parent chain: 7260 `cmd /c vite --host --port 5174` ← 11904 `npm --prefix atlas-client run dev` ← 21700 cmd ← explorer) | `D:/ATLAS/atlas-client` | 21:08:56 +08 |

Top-level launcher is `D:/ATLAS/package.json` script `dev` = `concurrently -n server,client ... "npm --prefix atlas-server run dev" "npm --prefix atlas-client run dev"`.

No ESTABLISHED external connections on 5001/5174 at preflight (only `TimeWait` residue). Listeners: `0.0.0.0:5001` (PID 22592), `::5174` (PID 15876). No other browser-QA owner of the shared runtime detected.

### Tailnet route

`tailscale serve status` (unchanged, will not be modified):

```
https://njgrm.buru-degree.ts.net (Funnel on)
|-- / proxy http://127.0.0.1:5174
```

### Preflight health

- localhost `http://127.0.0.1:5001/api/v1/health` → 200 `{"status":"ok","service":"atlas"}`
- localhost `http://127.0.0.1:5174/` → 200
- Tailnet `https://njgrm.buru-degree.ts.net/api/v1/health` → 200 `{"status":"ok","service":"atlas"}`
- Tailnet `https://njgrm.buru-degree.ts.net/` → 200 (735 bytes)

### Database target and migration state (no credentials printed)

- Host `localhost`; database `atlas_recovery_clean_rebuild_20260905`.
- `_prisma_migrations` applied: `0000_clean_baseline`, `0001_term_subject_authority`. Migration `0001_term_subject_authority` confirmed APPLIED. No migration/schema/push/seed/repair/sync command was run.
- Active year mirror: id 223, school 1, `enrollpro_school_year_id` 9, label `2030-2031`, `is_active=true`, `is_archived=false`, `term_contract_cache` NULL (not cached).
- Archived history: id 1, school 1, year 8, label `2029-2030`, `is_archived=true`.

### Before-signatures (SELECT-only, md5 over ordered curated rows)

| Table | rows | signature |
|---|---|---|
| enrollpro_school_year_mirrors | 2 | `7181c114e18a9d1f01100779d304682a` |
| subjects | 22 | `671e38478435d06ad4fdafcf3b185bbe` |
| section_mirrors | 40 | `43e1233afd3ef3e460e5476f47b9cda3` |
| faculty_mirrors | 42 | `fa51cab682bc59d4fddd0adf2068f204` |
| faculty_subjects | 183 | `77a18940e5b068e94d414f63afb3fa69` |
| subject_section_ownerships | 530 | `eabdfdf9ccfe1c4ea556001dfd24fe34` |
| teaching_load_cycles | 2 | `03b77f7a30191014768f329fb86fa974` |
| teaching_load_suggestion_proposals | 4 | `6fb3b066e742c3a0b6286998f59e6ea0` |
| generation_runs | 1 | `859f9c3ecd76f00a2e24f6065a8f7cea` |
| published_schedule_revisions | 0 | `EMPTY` |
| audit_logs | 232 | `555cdff9e5559fa7594b580bb0350c31` |

Audit action histogram at preflight: `ARCHIVE_SCHOOL_YEAR` 1, `GENERATION_RUN_FAILED` 1, `LOCAL_LOGIN_FAILED` 4, `LOCAL_LOGIN_SUCCESS` 223, `ROLLOVER_SYNC_APPLIED` 1, `TEACHING_LOAD_ANNUAL_CHANGE` 1, `TEACHING_LOAD_RECONCILIATION` 1.

### Dependency handling

- Server and client `package-lock.json` hashes MATCH between `D:/ATLAS` and the worktree; root lockfile differs and was not used.
- Because the live checkout (`D:/ATLAS` HEAD `f6c86e06`, target commit NOT an ancestor) and its `node_modules` cannot be trusted to match, dependencies were installed fresh inside the worktree with `npm ci --prefix atlas-server` and `npm ci --prefix atlas-client` (252 / 235 packages). Lockfiles were not modified.
- `prisma generate` (offline codegen only, no DB/schema mutation) was required because `npm ci` leaves the stub `@prisma/client`; generated v6.19.2 to `atlas-server/node_modules/.prisma/client` per schema generator output. No migration/push/seed was run.

### Mandatory trace table

| # | requirement | production/runtime path | observable pass | negative control | rollback |
|---|---|---|---|---|---|
| 1 | Server startup | `node dist/server.js` from `atlas-server/` (cwd), DB via `DATABASE_URL` | log `[ATLAS] Server listening on http://localhost:5001` + `[prisma] ✔ DB connected`; localhost+Tailnet `/api/v1/health` 200; exactly one listener on 5001 with worktree command line | missing dist / wrong cwd / bad env → exit or health<200; a second/foreign listener on 5001 fails | stop new server PID; relaunch prior `npm --prefix atlas-server run dev` (tsx watch) from `D:/ATLAS` |
| 2 | Client origin | Vite `vite --host --port 5174` from `atlas-client/`; Funnel https→127.0.0.1:5174 | `window.location.origin === "https://njgrm.buru-degree.ts.net"`; pages render | client down → Tailnet root non-200; localhost page origin invalidates evidence | stop new client PID; relaunch prior `npm --prefix atlas-client run dev` from `D:/ATLAS` |
| 3 | Rollover-disabled state | `rollover-automation.service.ts` `ENABLED` from process env at module eval | log has `[rollover-automation] Disabled via ROLLOVER_AUTO_SYNC_ENABLED=false`; NO `[rollover-automation] Starting` line | default `!== 'false'` would log `Starting`; grep must show disabled present and starting absent | process-only; restart without flag reverts (no data change) |
| 4 | Tailnet routing | `tailscale serve` Funnel → 127.0.0.1:5174 | `tailscale serve status` unchanged; Tailnet `/api/v1/health` and `/` return 200 | route pointing elsewhere/changed → stop (`PLANNER_DECISION_REQUIRED`); never modify serve | restore captured serve status only if it had changed (it must not) |
| 5 | Actor/year truth | runtime-context active-year election in Dashboard / Year Setup | active school 1 year `2030-2031` (EnrollPro id 9); archived `2029-2030` labeled archived/read-only | archived year shown active or stale unlabeled → finding | read-only; no data change |
| 6 | Derived demand | derived-demand revision consumed by readiness/dashboard | diagnostic reports derived-demand revision + counts; no claim unsupported by diagnostic | false "ready"/zero overclaim → finding | read-only |
| 7 | Teaching Load history + carry-forward preview visibility | Teaching Load route + archived history; carry-forward preview (read-only) | history visible read-only; preview observable without apply | any apply/mutation request in network → acceptance fail | read-only; no data change |
| 8 | Canonical generation readiness | `GET /api/v1/generation/1/9/readiness/diagnostic?enforceShiftWindows=true` | typed blocker list captured; zero-hard claimed only if response proves zero hard / zero unresolved / freshness / scheduler execution / `zeroWrite=true` | accepting a legacy/404 readiness path or overclaiming zero fails | read-only |
| 9 | Zero unauthorized writes | before/after SELECT signatures + network method capture | every signature identical before/after; browser issued no non-GET mutation | any changed signature fails acceptance; `/apply` never called | on change: incident stop, report, do not "repair" with writes |

## Stage B — deployment (DONE)

- Gates before any stop: server typecheck exit 0, server build exit 0 (`dist/server.js`), client typecheck exit 0, client build exit 0 (Vite 8.0.3). `prisma generate` v6.19.2 (offline codegen) required for the build.
- Stopped only the revalidated ATLAS trees (root `15996` server / `11904` client); both ports FREE afterward.
- Started server `node "...\atlas-server\dist\server.js"` (PID 11564) with process env `ROLLOVER_AUTO_SYNC_ENABLED=false`; started client `node "...\atlas-client\node_modules\vite\bin\vite.js" --host --port 5174` (PID 6756). Exactly one listener per port; both command lines reference the approved worktree.
- Health: localhost 5001 200, localhost 5174 proxy 200, Tailnet `/api/v1/health` 200, Tailnet `/` 200.
- Log `server-current.out.log` contains `[rollover-automation] Disabled via ROLLOVER_AUTO_SYNC_ENABLED=false` once and `Starting` zero times.
- `tailscale serve status` unchanged. Rollback NOT triggered.

## Stage C — Tailnet acceptance (PARTIAL: unauthenticated PASS; authenticated BLOCKED)

- Origin `https://njgrm.buru-degree.ts.net` asserted on every page; desktop 1366x768 and mobile 390x844.
- `/login` rendered, one Sign In, no overflow, no mojibake, 0 console errors (only `GET /enrollpro-api/settings/public` 200).
- `/public/schedules` truthful empty state for year 9; only `GET /api/v1/schools/1/schedules/published?date=...` 404 (expected).
- GET-only traffic; no mutation request; no Save/Apply/Generate/Publish/Delete/sync clicked.
- Dashboard, Year Setup, Subjects, Teaching Load + history, Simple Timetable: `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)` — `/dashboard` redirects to `/login`, zero cookies for the origin, no auth token in localStorage; fresh login not performed (would write `LOCAL_LOGIN_SUCCESS`).

## Stage D — read-only diagnostics (preview PASS; diagnostic BLOCKED)

- `POST /api/v1/runtime/rollover-sync/preview` (integration key, never printed) → EnrollPro active year 9 / `2030-2031`, `drift.status "aligned"`, `recommendedAction "NONE"`, faculty 42 / sections 20, `settingsReachable true`, `teachingLoadResetRequired true`, archived year 8 / `2029-2030`. `/apply` never called.
- Zero-write: recomputed signatures identical (`SIGNATURE_DIFFS=0`, audit 232→232).
- `GET /api/v1/generation/1/9/readiness/diagnostic?enforceShiftWindows=true` unauthenticated → 401 (JWT-only route). No typed blockers captured; no readiness overclaim; `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`.

## Cleanup and commit

- Removed the transient `atlas-server/.env` and `atlas-client/.env` from the worktree; no junctions or scratch files remain in the worktree. Runtime logs retained outside the repo at `%TEMP%\opencode\atlas-w1-runtime-deploy\logs\`.
- Worktree diff vs `fdd0c8c7` is exactly this file and `docs/verification/w1-runtime-deploy-tailnet-acceptance-2026-09-11.md`.
