# ATLAS Core Readiness — RC-02D Live Deployment and Tailnet Acceptance

Date: 2026-09-09
Prompt: `docs/prompts/atlas-core-readiness-rc02d-live-deploy-2026-09-09.md`
Risk: MEDIUM operational; production-data mutation forbidden
Executor worktree: `D:\ATLAS-worktrees\core-rc02d` (branch `work/core-rc02d`)
Verdict: **REVIEW_REQUIRED** — all decisive gates pass

## Commit range

- Required base: `4559eb13bbd371dd7945b39128f8c0dcdacd430a`
- Recorded base SHA: `396a72754854f2a1016661438d7fbfb31fb6b644`
  (`origin/main` HEAD at worktree creation; contains the required base. The only
  intervening commit `396a7275` is `docs(core)` and was inspected — no
  conflicting product change.)
- Deployment evidence commit: `cd5d71809b94dbb2e5a0ba02ce84d608655ca6f5`.
- Review range: `396a72754854f2a1016661438d7fbfb31fb6b644..HEAD`; the final
  candidate SHA is reported by Git in the executor handoff (not embedded in this
  commit because this commit creates it).

## 1. Preflight

### Port / process topology (before)

| Port | Owner PID | Process | Purpose |
|---|---|---|---|
| 5001 | 22972 | `node ... tsx src/server.ts` (child of `tsx watch`, npm `run dev`) | ATLAS server (dev, source) |
| 5174 | 24884 | `node ... vite.js --host --port 5174` (child of `cmd /c vite`) | ATLAS Vite client (dev) |

- Database (sanitized): `atlas_recovery_clean_rebuild_20260905` on `localhost`.
- Active school/year at entry: school 1, active year 8 (`2029-2030`), mirror
  `synced`, `isActive`, not archived.
- Baseline health: `GET /api/v1/health` → `200 {"status":"ok","service":"atlas"}`
  on localhost and Tailnet.

### Read-only census (before; captures before any login)

| Domain | Count |
|---|---|
| Schools | 1 |
| Active year mirrors | 1 (school 1 → EnrollPro year 8, `2029-2030`) |
| Section mirrors | 20 |
| Subjects | 22 |
| Faculty mirrors | 42 |
| Term configs (`school_year_term_configs`) | 0 |
| Offerings (`school_year_offerings`) | 0 |
| Offering term assignments | 0 |
| Subject-section ownerships | 265 |
| Department aliases | 0 |
| Department labels | 0 |
| Owner prefixes | 0 |
| Cross-department permissions | 0 |
| Generation runs | 0 |
| Published schedule revisions | 0 |
| Teaching load cycles | 1 (school 1, year 8, `POPULATED`, version 4) |
| Audit log (total) | 59 |
| Audit log login | `LOCAL_LOGIN_SUCCESS` 56, `LOCAL_LOGIN_FAILED` 2 |
| Admin account (employee `1234501`) | `lastLoginAt` 2026-09-08T05:40:02Z, `failedLoginCount` 0 |

## 2. Build

Decisive gate | Result
---|---
Server `tsc --noEmit` | PASS (after regenerating the worktree Prisma client from the pinned schema; `Prisma Client v6.19.2`)
Client `tsc --noEmit` | PASS
Server production build (`tsc`) | PASS (`atlas-server/dist/server.js` produced)
Client production build (`vite build`) | PASS (`atlas-client/dist/index.html` produced)

Dependencies were installed from the pinned lockfiles in the fresh worktree
(`npm ci` in root, `atlas-server`, `atlas-client`). No lockfile or manifest was
modified.

## 3. Bounded restart

1. Stopped the exact ATLAS server tree owning port 5001: node child `22972` and
   its `tsx watch` supervisor `8476` (npm `run dev` wrapper exited with its
   children). Port 5001 verified free.
2. Started exactly one hidden built server: `node dist/server.js` from
   `atlas-server` in the executor worktree, with the production configuration
   supplied in the process environment only (no `.env` edited) plus
   `ROLLOVER_AUTO_SYNC_ENABLED=false`.
3. Log evidence (stdout):
   - `[prisma] DATABASE_URL protocol looks correct`
   - `[ATLAS] Server listening on http://localhost:5001`
   - `[prisma] DB connected, 1 school(s) found`
   - `[prisma] scheduling_policies schema verified`
   - `[rollover-automation] Disabled via ROLLOVER_AUTO_SYNC_ENABLED=false` ✅
   - `[rollover-automation] Starting (...)` — **absent** ✅
   - stderr: empty.
4. One listener on port 5001 (PID `30864`); health `200` on localhost and
   Tailnet. Vite client on port 5174 left running; it serves the merged RC-02
   client.

## 4. API acceptance (Tailnet `https://njgrm.buru-degree.ts.net`)

Authenticated as the seeded scheduler officer (`1234501`, local auth). Token
hash not recorded in this report (credentials/tokens are not exposed).

| Route | HTTP | Truthful content observed |
|---|---|---|
| `GET /api/v1/health` | 200 | `{"status":"ok","service":"atlas"}` |
| `POST /api/v1/auth/login` | 200 | `user.userId 46`, `role officer`, `authSource local` |
| `GET /api/v1/auth/me` | 200 | `schoolId 1`, `userId 46` |
| `GET /api/v1/runtime/context` | 200 | `schoolId 1`, `activeSchoolYearId 8`, label `2029-2030`, drift `aligned`, source `atlas-persisted` |
| `GET /api/v1/subjects?schoolId=1` | 200 | 22 subjects, school-1 scoped SCA-01 catalog contract |
| `GET /api/v1/curriculum-requirements/8/requirements` | 200 | `termConfig null`, `requirements []` (SCA-04B not applied) |
| `GET /api/v1/curriculum-requirements/8/readiness` | 200 | `ready false`, 16 scope states `MISSING`, blocker `OFFERING_TERM_CONFIG_MISSING` |
| `GET /api/v1/faculty-assignments/summary?schoolId=1` | 200 | year-8 Teaching Load populated (265 ownerships), `loadSignalMode STANDARD` |
| `GET /api/v1/faculty-assignments/effective?schoolId=1` | 200 | `source.contractVersion 2`, `state POPULATED`, `isActiveSchoolYear true`, assignments carry `facultyExternalId`/`sectionExternalId`/curriculum metadata |
| `GET /api/v1/faculty-assignments/department-authority?schoolId=1` | 200 | `schoolId 1`, empty aliases/labels with `sourceRevision.revisionHash` |
| `GET /api/v1/generation/1/8/runs/gate` | 200 | `blocked false`, `openCount 0`, `runId null` |
| `GET /api/v1/generation/1/8/runs` | 200 | `runs []`, `count 0` |
| `GET /api/v1/dashboard/readiness-summary?schoolId=1` | 200 | `schoolId 1`, `activeSchoolYearId 8`, `sourceState using_saved_data` |

- Actor school 1 and active year 8 are resolved dynamically through the
  authenticated runtime context (no hardcoded fallback observed).
- No reviewed named route returned 404. The only 404s observed during browser
  checks are intentional no-data responses (`runs/latest`, and
  `room-preferences/.../latest/summary`) consistent with zero runs / zero room
  requests for year 8.
- Generation gate note: `/api/v1/generation/1/8/runs/gate` returning
  `blocked=false` proves only that no existing run-level lock is active. It does
  not prove curriculum or generation readiness. Generation remains
  process-locked because Curriculum Requirements reports
  `OFFERING_TERM_CONFIG_MISSING`. SCA-04A is the next stage after planner
  acceptance; no generation is authorized.

## 5. Browser acceptance

Playwright Chromium, headless, against the Tailnet app at desktop
`1280x720` and mobile `390x844`. No mutating action was clicked.

| Check | Desktop 1280x720 | Mobile 390x844 |
|---|---|---|
| Login → post-login landing on `/` | PASS | PASS |
| Pages rendered (`/`, `/subjects`, `/subjects/requirements`, `/teaching-load`, `/timetable`) | PASS (all) | PASS (all) |
| Horizontal overflow (`scrollWidth <= innerWidth+1`) | none (all pages) | none (all pages) |
| Mojibake (`\uFFFD` in visible text) | none | none |
| Uncaught page errors | 0 | 0 |
| Keyboard focus (Tab moves to a focusable control) | PASS | PASS |
| Truthful loading/empty/blocked copy | subjects `USING SAVED DATA`; curriculum page `ATLAS-owned required subjects ... Year 8` with `not configured`/`missing` states; timetable `No 2029-2030 timetable yet` / `No timetable exists for 2029-2030` | same |

Console 404 resource errors match the intentional no-data endpoints above.
`rollover-status`/`notifications/.../events` `ERR_ABORTED` entries are SSE/live
poll aborts on navigation, not application failures.

## 6. Mutation check

Repeated the identical read-only census after acceptance and compared. The
before/after setup and schedule signatures are byte-identical:

- `sectionMirrors` 20, `subjects` 22, `facultyMirrors` 42, `termConfigs` 0,
  `offerings` 0, `offeringTermAssignments` 0, `ownerships` 265,
  `departmentAliases` 0, `departmentLabels` 0, `ownerPrefixes` 0,
  `crossDeptPermissions` 0, `generationRuns` 0 (signature `cnt 0 / max_id 0 /
  sum_duration_ms 0`), `publishedRevisions` 0, teaching load cycle unchanged
  (`POPULATED` v4), active-year mirror unchanged.
- **Expected login effects only (disclosed):** 7 `LOCAL_LOGIN_SUCCESS` audit
  rows (actor 46) added within the probe window and the admin `lastLoginAt`
  updated (now 2026-09-08T11:13:30Z); `failedLoginCount` unchanged (0); zero
  `LOCAL_LOGIN_FAILED` rows added.

Result: **zero unexpected database mutations.**

## 7. Decisive gate summary

| Gate | Result |
|---|---|
| Server/client `tsc --noEmit` | PASS |
| Server/client production build | PASS |
| Built Node server owns 5001; `/api/v1/health` 200 | PASS |
| Rollover automation demonstrably disabled | PASS (`Disabled` log present, `Starting` log absent) |
| All named Tailnet routes return expected authenticated/truthful blocked state; no reviewed route 404 | PASS |
| Desktop/mobile pages render without horizontal overflow, mojibake, or uncaught errors | PASS |
| Zero unexpected database mutations | PASS |

No historical broad suite was run (RC-02 already passed 499 focused
assertions). No product source was edited in this prompt.

## Remaining risks / notes

- The live EnrollPro upstream was unreachable during acceptance, so runtime
  context reported `atlas-persisted` / dashboard `using_saved_data`; drift
  remained `aligned` from persisted mirror evidence. This is truthful degraded
  behavior, not a regression.
- The deployment now runs a built server on port 5001; the prior `tsx watch`
  dev-server supervisor was intentionally stopped and is not restarted by this
  prompt.
- SCA-04A remains LOCKED behind planner QA acceptance of this commit range.
- Generation remains process-locked: the `runs/gate` `blocked=false` result only
  confirms no active run-level lock; Curriculum Requirements reports
  `OFFERING_TERM_CONFIG_MISSING`, so no generation is authorized until SCA-04B
  persists term configuration.

## Handoff

Base: `396a72754854f2a1016661438d7fbfb31fb6b644`
Deployment evidence commit: `cd5d71809b94dbb2e5a0ba02ce84d608655ca6f5` (final
candidate SHA reported by Git in the executor handoff).
Review: immutable `base...HEAD` range on `work/core-rc02d`.
