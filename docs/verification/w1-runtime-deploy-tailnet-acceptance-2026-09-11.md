# W1-RUNTIME-DEPLOY — Tailnet deployment and acceptance verification (2026-09-11)

Governing packet: `docs/prompts/w1-runtime-deploy-tailnet-acceptance-2026-09-11.md`
(SHA-256 `02D4727571FE50BB1B7D7A243BDFCA1DFDB58E4CDE2E78F3AB94EC8493BAB0EF`, executor-verified).
Approved/deployed product commit: `fdd0c8c7d9f417bdddbe4a3dc2ec9e1f627e2b22`.
Evidence branch: `work/w1-runtime-deploy-20260911` (worktree `D:/ATLAS-worktrees/w1-runtime-deploy`).

## 1. Verdict

`REVIEW_REQUIRED` — deployment succeeded, runtime healthy, zero unauthorized writes.
Stage C authenticated surfaces and Stage D canonical generation diagnostic are
`EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)` because no reusable authenticated
session existed and the packet forbids a fresh login (which would write a
`LOCAL_LOGIN_SUCCESS` audit row).

## 2. Process owners, rollback, and rollback status

Previous owners (stopped only for the two ATLAS trees; revalidated immediately before stopping):

- Port 5001: listener PID `22592` (`node ... tsx ... src/server.ts`), tree root `15996` (`npm --prefix atlas-server run dev`), source `D:/ATLAS/atlas-server`.
- Port 5174: listener PID `15876` (`node ... vite/bin/vite.js --host --port 5174`), tree root `11904` (`npm --prefix atlas-client run dev`), source `D:/ATLAS/atlas-client`.
- No ESTABLISHED external connections on either port at preflight (only `TimeWait`); `taskkill /PID 15996 /T /F` and `/PID 11904 /T /F` both reported SUCCESS. Both ports confirmed FREE before start.

New owners:

- Port 5001: PID `11564` — `node "D:\ATLAS-worktrees\w1-runtime-deploy\atlas-server\dist\server.js"` (detached wrapper cmd PID `20368`).
- Port 5174: PID `6756` — `node "D:\ATLAS-worktrees\w1-runtime-deploy\atlas-client\node_modules\vite\bin\vite.js" --host --port 5174` (detached wrapper cmd PID `22928`).
- Exactly one listener per port; both command lines point at the approved worktree.

Rollback status: **NOT TRIGGERED**. New server and client both started, health 200 on
localhost and Tailnet, and the Tailnet login shell loads. Data was never mutated to
repair anything.

Exact rollback commands (captured in Stage A, not needed):

```
# stop the new deployed owners only
taskkill /PID 11564 /T /F
taskkill /PID 6756  /T /F
# restore the previous ATLAS dev processes from D:/ATLAS
npm --prefix atlas-server run dev      # workdir D:/ATLAS  (tsx watch src/server.ts)
npm --prefix atlas-client run dev      # workdir D:/ATLAS  (vite --host --port 5174)
# equivalently: npm run dev  (concurrently) from D:/ATLAS
```

## 3. Build gates (from the approved worktree; failed gate would block any stop)

- Server typecheck `npx tsc --noEmit -p tsconfig.json` → exit 0.
- Server production build `npm run build` (`tsc`) → exit 0; `dist/server.js` emitted.
- Client typecheck `npx tsc --noEmit -p tsconfig.json` → exit 0.
- Client production build `npm run build` (`vite build`) → exit 0 (Vite 8.0.3).
- Dependencies installed fresh with `npm ci --prefix atlas-server` (252 pkgs) and `npm ci --prefix atlas-client` (235 pkgs) after confirming server/client lockfiles match the live checkout and the live checkout (`D:/ATLAS` HEAD `f6c86e06`) is NOT an ancestor of the target. Lockfiles unmodified.
- `prisma generate` (offline codegen only, no DB/schema command) produced `@prisma/client` v6.19.2 into `atlas-server/node_modules/.prisma/client`.

## 4. Runtime start and health

Server log (`%TEMP%\opencode\atlas-w1-runtime-deploy\logs\server-current.out.log`, retained for QA):

```
[prisma] ✔ DATABASE_URL protocol looks correct
[ATLAS] Server listening on http://localhost:5001
[prisma] ✔ DB connected, 1 school(s) found
[prisma] ✔ scheduling_policies schema verified
[rollover-automation] Disabled via ROLLOVER_AUTO_SYNC_ENABLED=false
```

- `Disabled via ROLLOVER_AUTO_SYNC_ENABLED=false` present exactly once; `[rollover-automation] Starting` present 0 times.
- `http://127.0.0.1:5001/api/v1/health` → 200 `{"status":"ok","service":"atlas"}`.
- `http://127.0.0.1:5174/api/v1/health` (Vite proxy) → 200 `{"status":"ok","service":"atlas"}`.
- `https://njgrm.buru-degree.ts.net/api/v1/health` → 200 `{"status":"ok","service":"atlas"}`.
- `https://njgrm.buru-degree.ts.net/` → 200.
- `tailscale serve status` UNCHANGED: Funnel `https://njgrm.buru-degree.ts.net` → `http://127.0.0.1:5174`.

Runtime environment: server reads its own `atlas-server/.env` via dotenv from cwd; the
copied `.env` was removed after startup (server already loaded it, no watcher). Client
`VITE_ENROLLPRO_URL` / `VITE_ENROLLPRO_API_BASE` were injected into the Vite process
from the live `atlas-client/.env` (Vite `loadEnv` includes `process.env` `VITE_*`,
verified in `node_modules/vite/dist/node/chunks/node.js:4976`); no client `.env` remains
in the worktree, so deleting it cannot trigger a Vite config restart.

## 5. Tailnet browser acceptance (Stage C)

All evidence from `playwright_browser_*`; `window.location.origin === "https://njgrm.buru-degree.ts.net"` asserted on every page.

- Desktop `1366x768`:
  - `/login` — renders (branding "ATLAS HINIGARAN NATIONAL HIGH SCHOOL"), exactly one "Sign In" action, no horizontal overflow (`scrollWidth 1366 == clientWidth 1366`), no mojibake, 0 console errors. Only requests: `GET /enrollpro-api/settings/public` → 200 (×2).
  - `/dashboard` → redirects to `/login` (no valid session).
  - `/public/schedules` — renders truthful empty state "No published schedule is available for the current school year (9) yet." (consistent with 0 `published_schedule_revisions`). Requests: only `GET /api/v1/schools/1/schedules/published?date=2026-09-11` → 404 (expected: nothing published). 2 console errors are those 404s; no others.
- Mobile `390x844`: `/login` and `/public/schedules` — no horizontal overflow (`scrollWidth 390 == clientWidth 390`), login has one "Sign In", 0 console errors.
- Mutation proof: browser issued GET-only traffic; no POST/PUT/PATCH/DELETE; no Save/Apply/Generate/Publish/Delete/sync action clicked.
- Authenticated surfaces (Dashboard, Year Setup, Subjects, Teaching Load + archived history, Simple Timetable): `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)` — `/dashboard` redirects to `/login`, the browser context held **zero cookies** for the origin, and no auth token key exists in `localStorage`. A fresh login was deliberately not performed because it would create an audit write.

## 6. Database target and before/after signatures (SELECT-only, credentials never printed)

Host `localhost`; database `atlas_recovery_clean_rebuild_20260905`.
Migrations applied: `0000_clean_baseline`, `0001_term_subject_authority` (confirmed applied). No migration/push/seed/repair/sync command was run.

| Table | before rows / sig | after rows / sig | changed |
|---|---|---|---|
| enrollpro_school_year_mirrors | 2 / `7181c114e18a9d1f01100779d304682a` | same | no |
| subjects | 22 / `671e38478435d06ad4fdafcf3b185bbe` | same | no |
| section_mirrors | 40 / `43e1233afd3ef3e460e5476f47b9cda3` | same | no |
| faculty_mirrors | 42 / `fa51cab682bc59d4fddd0adf2068f204` | same | no |
| faculty_subjects | 183 / `77a18940e5b068e94d414f63afb3fa69` | same | no |
| subject_section_ownerships | 530 / `eabdfdf9ccfe1c4ea556001dfd24fe34` | same | no |
| teaching_load_cycles | 2 / `03b77f7a30191014768f329fb86fa974` | same | no |
| teaching_load_suggestion_proposals | 4 / `6fb3b066e742c3a0b6286998f59e6ea0` | same | no |
| generation_runs | 1 / `859f9c3ecd76f00a2e24f6065a8f7cea` | same | no |
| published_schedule_revisions | 0 / `EMPTY` | same | no |
| audit_logs | 232 / `555cdff9e5559fa7594b580bb0350c31` | same | no |

`SIGNATURE_DIFFS=0`; `audit_logs` 232 → 232. **Zero unauthorized writes: no migration,
schema change, rollover term-cache sync, mirror/faculty/section/Teaching Load write,
generation, or publication occurred. No row changed across the whole deployment and
acceptance run.**

## 7. Rollover preview (Stage D.1–D.2) — read-only, zero-write

`POST /api/v1/runtime/rollover-sync/preview` with the live integration key (never printed):

- `enrollProActiveYear` = id 9 / `2030-2031`; `drift.status = "aligned"`; `recommendedAction = "NONE"`; `atlasSchoolYearId` 9.
- mirror: faculty 42, sections 20, `lastSyncedAt` 2026-09-10T11:18:14Z, `syncStatus "setup-review-required"`, `termContractCache` NULL.
- `counts.settingsReachable = true`; `teachingLoadResetRequired = true`; no conflicts/reconfigured sections.
- archived year: id 8 / `2029-2030` (archived 2026-09-10).
- Zero-write proven by the identical before/after signatures above.

A separate HIGH approval would be required **if** a rollover term-cache sync / Teaching
Load reset is desired; this run performed none, and `/rollover-sync/apply` was never called.

## 8. Canonical generation readiness diagnostic (Stage D.3) — blocked

`GET /api/v1/generation/1/9/readiness/diagnostic?enforceShiftWindows=true`:

- Unauthenticated → `401` (route uses the JWT-only `authenticate` middleware plus privileged
  role and actor-school scope; the integration/system token is not accepted by that route).
- No typed blockers, term identities, derived-demand revision, scheduler totals, or
  violation counts could be captured without an authenticated actor session.
- **Not overclaimed:** no zero-hard-blocker / ready statement is made. Status is
  `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`; the route's own contract was not bypassed,
  and no token was forged.

## 9. Remaining approval / correction handoff

- No rollback. No product defect found in the deployed deployment path; the deployed
  product tree equals the approved commit `fdd0c8c7`.
- To complete the authenticated half of Stage C and Stage D.3, an operator must either
  (a) establish a valid officer session in the persistent Playwright profile, or
  (b) authorize a read-only acceptance login and accept the resulting `LOCAL_LOGIN_SUCCESS`
  audit row. This packet forbade that write, so it is deferred.
- No rollover-sync apply, Teaching Load apply, generation, or publication is authorized or requested.

## 10. What is running / awaited / locked

- Running: deployed server (PID 11564) and client (PID 6756) on the shared Tailnet runtime, rollover automation disabled.
- Awaited: fresh independent QA of this evidence commit; then the planner's integration/register step.
- Safe parallel work: read-only inspection of the retained startup log and this artifact; no other stream may swap the shared runtime while this deployment serves live traffic.
- Locked successors: rollover term-cache sync/apply, Teaching Load carry-forward/suggestion apply, generation, and publication all remain separately gated.

## Appendix — mandatory trace table outcomes

| # | requirement | outcome |
|---|---|---|
| 1 | Server startup | PASS |
| 2 | Client origin | PASS (origin asserted; authenticated pages BLOCKED(AUTH_SESSION_REQUIRED)) |
| 3 | Rollover-disabled state | PASS |
| 4 | Tailnet routing | PASS (unchanged) |
| 5 | Actor/year truth | BLOCKED (authenticated) — preview shows year 9 / 2030-2031 aligned |
| 6 | Derived demand | BLOCKED (authenticated) |
| 7 | Teaching Load history + carry-forward preview visibility | BLOCKED (authenticated) |
| 8 | Canonical generation readiness | BLOCKED (authenticated) |
| 9 | Zero unauthorized writes | PASS |
