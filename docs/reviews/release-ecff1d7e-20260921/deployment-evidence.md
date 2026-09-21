# RELEASE ecff1d7e - executor deployment evidence (D1-D5; D6 deferred)

Pin `ecff1d7e6050f89aff9906221ab614a5e8132c9c` (registered detached worktree
`D:\ATLAS-runtime-supervised-ecff1d7e-20260921`, HEAD verified, no source edit).
Elevated: True. Standing authorization 2026-09-20 (per-action round-trip waived,
no gate waived). No login, no browser, no live mutation probe. No generation,
publication, sync/archive, Teaching Load, migration, or companion action.
Source review gate CLOSED (ACCEPT_READY 15/15) before execution.

## Build (release tree, before touching 5001/5174)

- Trees: copied (not installed) `atlas-server/node_modules` and
  `atlas-client/node_modules` from incumbent `d3e9dfef` via
  `robocopy <incumbent>\...\node_modules <release>\...\node_modules /E /MT:8`
  (server 376.29 MB / 8 s; client 183.70 MB / 14 s). Both incumbent trees are
  real dirs (LinkType empty, junction-free); both release copies are real dirs
  (LinkType empty, isolated, no junction, no install through a shared tree).
  Provenance: incumbent release dir. `npm ci` for the server was never run
  (deny-listed; copy path used and recorded literally).
- `npx prisma generate --schema ..\prisma\schema.prisma` from `atlas-server`:
  OK, Prisma Client v6.19.2 into the release tree (repo-root schema).
- Server `npm run build` (tsc) in `atlas-server`: exit 0.
  `dist/server.js` SHA-256
  `367B7B40D8BF84BE9937F13CABD00C6277B3543448833389A4D7DFCB950C4623`
  (entry unchanged vs d3e9dfef; the delta module compiled separately -
  `dist/routes/faculty.router.js` contains `parseStrictFacultySchoolId`).
- Client `vite build` with exactly
  `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net`
  (SMART/AIMS start URLs unset): exit 0, built in 8.28 s.
  Entry `dist/assets/index-CbCvgFxw.js`, 456,046 bytes (reviewer-expected name
  exact); incumbent `index-BkDBtkSR.js`, 456,046 bytes.
  `dist/index.html` references `/assets/index-CbCvgFxw.js`.
- Isolated smoke of the built server (`PORT=5052`, env from the durable file
  into the child process only): health 200, ready 200,
  `subjects?schoolId=1` 200; process stopped, `:5052` clear afterwards.
  (Two probe-script defects fixed literally: backslash escapes in the env path
  and a relative server path passed to dynamic import - resolved with
  `pathToFileURL(...).href`; recorded, no product impact. Throwaway scripts
  deleted after use.)

## Harnesses (release tree, each literal, all exit 0)

- `npm run test:actor-school-mutations-c02` (server) - pass 1 / fail 0 (load-bearing).
- `npm run test:actor-school-residual` (server) - pass 1 / fail 0.
- `npm run test:actor-school-mutations` (server) - pass 1 / fail 0.
- `npm run test:warning-readability` (server) - pass 9 / fail 0.
- `npm run test:warning-readability` (client) - tests 16 / pass 16 / fail 0.

## Pre-cutover capture (incumbent d3e9dfef)

- Task `ATLAS-Runtime-Supervisor`: SYSTEM / ONSTART / `PT0S` / IgnoreNew,
  action+workdir = incumbent dir. XML captured operator-only to `%TEMP%`
  (retained for rollback; bytes `FF FE 3C 00` = genuine UTF-16LE+BOM).
- Machine scope pre: `ATLAS_RUNTIME_SOURCE_DIR` = incumbent dir,
  `ATLAS_RUNTIME_RELEASE_SHA` = `d3e9dfef5790142f659e6def39aa19fe2ab08077`.
  Env file SHA-256
  `BC7921A782141DA3819262FD7E2008B6FD7E256A067BFFF018D197430AED565C`,
  17 real keys, no SMART/AIMS key (names only, values never printed).
- Listeners: 5001->PID 23532, 5174->PID 10248, both children of supervisor
  14540 (child of 2540); command lines verified inside the incumbent dir.
- Incumbent live: health 200, ready 200, subjects 200, host live 200.

## Signature map (literal, with scope AND encoding)

- `BEGIN` via a Prisma interactive transaction; `SET LOCAL TIME ZONE 'UTC'`
  as the **first statement inside the same transaction** (a standalone
  `SET LOCAL` is never claimed as a pin); scope proven by `SHOW TIME ZONE`
  in the same tx -> `tz-in-tx=UTC` pre+post (`[{"TimeZone":"UTC"}]` both).
- Enumeration in-tx: `SELECT tablename FROM pg_tables WHERE
  schemaname=$$public$$ ORDER BY tablename`.
- Per table `T` in the same tx: `SELECT COUNT(*)::int AS c,
  COALESCE(md5(string_agg(md5(row_to_json(t)::text), ',' ORDER BY
  md5(row_to_json(t)::text))), md5('')) AS s FROM public."T" t`.
- Closed with no write (read-only interactive tx; zero-write); serialization
  one `"<name> count=<n> sig=<md5>"` line per table in name order joined with
  LF plus a trailing LF; value = SHA-256 hex of those exact bytes.
- Byte encoding (measured, not assumed): first bytes `5F 70 72 69 73 6D`
  (`_prism`, NO BOM), zero `0x0D` bytes in the whole body (LF-only),
  trailing `0x0A`. UTF-8, no BOM, LF endings, one trailing newline.
  Value cross-checked: node-computed SHA-256 equals an independent .NET
  `SHA256.ComputeHash` over the file bytes.
- Runner: throwaway script resolving the release tree's own
  `node_modules/.prisma/client`, `DATABASE_URL` in child memory only;
  script deleted after use.
- Pre: 46 tables, 3036 bytes,
  body `0E7D75F89FCADF196CEB3EE73535F4892CF29B1F61A5DD6D936F80F17E953C43`.
  Post: 46 tables, 3036 bytes, body identical `0E7D75F8...953C43` -
  byte-identical. (Differs from the d3e9dfef-cycle pre value `01D02390...`
  because the live DB evolved since - e.g. `audit_logs` now 308 rows; what
  matters is pre==post within this cycle.)

## Cutover

- `taskkill /PID 14540 /T /F` (14540 + 23532/10248 + grandchildren) +
  incumbent `cli.mjs stop` with explicit env overrides (incumbent dir+SHA);
  state `stopped`; 8 s+ settle; no LISTENING on 5001/5174. (The incumbent
  root `supervisor-state.json`, if present, was removed after `stop`
  reported `stopped`; start recreates it - recorded literally.)
- Machine vars re-pointed to the new dir + pin (verified by re-read).
- Replacement XML: exactly 2 swaps of the full dir string (occurrence count
  verified 2 new / 0 old remains). Encoding measured genuine UTF-16LE+BOM
  matching its declaration -> registered **unmodified**, no repair
  (`SUCCESS: ... successfully been created`). Re-query field-compared:
  SYSTEM/ONSTART/`PT0S`/IgnoreNew, action+workdir = new dir. Required
  `Ready`, then one `schtasks /run` -> `Running` (Last Run 22:34:46 +08).
  Temp replacement XML, scratch scripts, probe files removed; incumbent XML
  retained operator-only in %TEMP% for rollback.
- `schtasks /query /xml` bytes tried first: `FF FE 3C 00` (UTF-16LE+BOM);
  declaration-conformant, registered as-is.

## Acceptance

- **D1 PASS.** Installed HEAD = pin; status `?? ops/runtime/logs/` only
  (declared expected dirty set). Machine vars = new dir + pin (re-read
  post-cutover). Task action/workdir = new dir. Authoritative state:
  `releaseSha=ecff1d7e...`, `sourceDir` = new dir, `state=running`,
  ownedPids 26724/31148.
- **D2 PASS.** Exactly one listener per port: 5001->26724, 5174->31148, both
  `ParentProcessId=26972` (`"...ecff1d7e-20260921\ops\runtime\cli.mjs" start`,
  child of 2540, task-launched). Task keeps SYSTEM/ONSTART/`PT0S`/IgnoreNew.
  Server entry resolves inside the release dir
  (`...ecff1d7e-20260921\atlas-server\dist\server.js`); child starts
  22:34:47 +08, postdating the cutover.
- **D3 PASS.** Local health 200, ready 200, host live 200, host ready 200,
  Tailnet `/api/v1/health` 200, `subjects?schoolId=1` 200.
  Published `/api/v1/schools/1/schedules/published?termIndex=1` -> 200 with
  entries/source/timeSlots (term-scoped); `?termIndex=bogus` -> typed 400
  `INVALID_TERM_INDEX`. Latest + run-316 violation reports -> 401 `NO_TOKEN`
  pre-dispatch. No login performed.
- **D4 PASS.** Served `/` HTML byte-equal to `dist/index.html`; all 34
  referenced assets SHA-256-equal to dist (mismatches 0). Served entry is
  `index-CbCvgFxw.js` (456,046 bytes, dist hash
  `604B86DBC82A550D571D980FBD7266BB63B4B5F15DC17E08C8F2500474139B88`,
  served bytes identical) = freshly built manifest entry, differs from
  incumbent's `index-BkDBtkSR.js`. Served bytes contain the EnrollPro
  origin; no SMART/AIMS start-URL value. Env hash + 17-key set unchanged.
  `/auth/sso/smart/start` + `/auth/sso/aims/start` -> typed 503
  `COMPANION_SSO_NOT_CONFIGURED`, no `Location`, no `Set-Cookie`. Signature
  map byte-identical pre/post (above, with encoding).
- **D5 PASS.** Running entry inside the release dir; `dist/server.js`
  SHA-256 `367B7B40...C4623` equals the recorded pre-cutover build output;
  start postdates cutover. All five harnesses pass on the release tree
  (c02 1/0, residual 1/0, mutations 1/0, server readability 9/0, client
  readability 16/16/0, each exit 0).
  **Limitation, stated explicitly:** the live mutation routes were
  deliberately NOT probed - a live `POST` can write if a guard is not
  loaded; no live behavioural proof is claimed.
- **D6 DEFERRED (assigned to the independent post-action QA)** - never
  passed, never "not applicable". No browser opened, no login performed.

## Figures, rollback, risks

- D: free pre-build 33.74 GiB (36,231,958,528 B) / post-build 32.83 GiB
  (35,248,836,608 B) / post-cutover 32.83 GiB (35,248,820,224 B)
  (floor 15 GiB holds throughout).
- PIDs before: supervisor 14540, 5001->23532, 5174->10248. After: supervisor
  26972, 5001->26724, 5174->31148.
- New chunk `index-CbCvgFxw.js` (456,046 bytes) vs incumbent
  `index-BkDBtkSR.js` (456,046 bytes).
- Rollback: incumbent `d3e9dfef` startable in place (dist server+client,
  cli.mjs present; captured XML + both machine values retained
  operator-only in %TEMP% + this artifact). Not executed. Behind it:
  `80acdc25` and `a02884ff` remain available.
- `git stash list` was DENIED by the harness (`git stash*` policy block) -
  recorded literally; no stash was created or used at any point. Residue
  check: release status `?? ops/runtime/logs/` only; all temp scripts/XMLs
  removed except the operator-only incumbent XML in %TEMP%.
- Risks: NON_BLOCKING - supervisor log transient P1001/antivirus lines
  possible (DB-backed reads confirm health); `dist/server.js` entry hash
  equals the d3e9dfef value because the entry module is unchanged (the delta
  ships in `dist/routes/faculty.router.js`, verified present).
- No BLOCKING risk. D6 is the only open row and belongs to the post-action QA.

Verdict: `REVIEW_REQUIRED` - deployed, D1-D5 PASS on the real path, D6
deferred to the independent post-action QA.