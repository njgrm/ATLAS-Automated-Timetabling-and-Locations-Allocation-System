# RELEASE d3e9dfef — executor deployment evidence (D1–D5; D6 deferred)

Pin `d3e9dfef5790142f659e6def39aa19fe2ab08077` (registered detached worktree
`D:\ATLAS-runtime-supervised-d3e9dfef-20260921`, HEAD verified, no source edit).
Elevated: True. No login, no browser, no live mutation probe. No generation,
publication, sync/archive, Teaching Load, migration, or companion action.

## Build (release tree, before touching 5001/5174)

- Trees: copied (not installed) `atlas-server/node_modules` and
  `atlas-client/node_modules` from incumbent `80acdc25` via
  `robocopy <incumbent>\...\node_modules <release>\...\node_modules /E /MT:8`.
  Both incumbent trees are real dirs (LinkType empty, junction-free); both
  release copies are real dirs (LinkType empty, isolated, no junction, no
  install through a shared tree). Provenance: incumbent release dir.
- `prisma generate --schema ..\prisma\schema.prisma` from `atlas-server`: OK
  (repo-root schema; client lands in release tree).
- Server `npm run build` (tsc): exit 0. `dist/server.js` SHA-256
  `367B7B40D8BF84BE9937F13CABD00C6277B3543448833389A4D7DFCB950C4623`.
- Client `vite build` with exactly
  `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net`
  (SMART/AIMS start URLs unset): exit 0, `✓ built in 11.76s`.
  Entry `dist/assets/index-BkDBtkSR.js`, 456,046 bytes (reviewer's expected
  name/size exact); incumbent `index-C6LTCXSf.js`, 455,998 bytes.
  `dist/index.html` references `/assets/index-BkDBtkSR.js`.
- Isolated smoke of the built server (`PORT=5052`, env from the durable file
  into the child process only): health 200, ready 200,
  `subjects?schoolId=1` 200; process stopped, `:5052` clear afterwards.
  (First attempt failed with `ERR_UNSUPPORTED_ESM_URL_SCHEME`; fixed with
  `pathToFileURL(...).href` — recorded, no product impact.)

## Harnesses (release tree, all exit 0)

- `npm run test:actor-school-residual` — pass 1 / fail 0 (load-bearing).
- `npm run test:actor-school-mutations` — pass 1 / fail 0.
- `npm run test:warning-readability` — pass 9 / fail 0.

## Pre-cutover capture (incumbent 80acdc25)

- Task `ATLAS-Runtime-Supervisor`: SYSTEM / ONSTART / `PT0S` / IgnoreNew,
  action+workdir = incumbent dir. XML captured operator-only to `%TEMP%`
  (retained for rollback; bytes `FF FE 3C 00 3F 00` = genuine UTF-16LE+BOM).
- Machine scope: `ATLAS_RUNTIME_SOURCE_DIR` = incumbent dir,
  `ATLAS_RUNTIME_RELEASE_SHA` = `80acdc25…`. Env file SHA-256
  `BC7921A782141DA3819262FD7E2008B6FD7E256A067BFFF018D197430AED565C`,
  17 real keys, no SMART/AIMS key (names only, values never printed).
- Listeners: 5001→PID 5976, 5174→PID 2692, both children of supervisor 3108
  (child of 2540); command lines verified inside the incumbent dir.
- Incumbent live: health 200, ready 200, subjects 200.

## Signature map (§2.5, literal, with scope)

- `BEGIN`; `SET LOCAL TIME ZONE 'UTC'` as the **first statement inside the
  same transaction** (standalone `SET LOCAL` never claimed as a pin);
  scope proven by `SHOW TIME ZONE` in the same tx → `tz-in-tx=UTC` pre+post.
- Enumeration in-tx: `SELECT tablename FROM pg_tables WHERE
  schemaname=$$public$$ ORDER BY tablename`.
- Per table `T` in the same tx: `SELECT COUNT(*)::int AS c,
  COALESCE(md5(string_agg(md5(row_to_json(t)::text), $$$$ ORDER BY
  md5(row_to_json(t)::text))), md5($$$$)) AS s FROM public."T" t`.
- Closed with `ROLLBACK` (zero-write); serialization one
  `"<name> count=<n> sig=<md5>"` line per table in name order + trailing
  newline; value = SHA-256 of that body. Runner: throwaway script resolving
  the release tree's own `@prisma/client`, `DATABASE_URL` in child memory
  only; script deleted after use.
- Pre: 46 tables, body `01D023900F19E8B28081436E19FD0DF82C779C945336E07381B6617DFF256F4E`.
  Post: 46 tables, body identical `01D02390…FF256F4E` — byte-identical.

## Cutover

- `taskkill /PID 3108 /T /F` (3108 + 5976/2692 + grandchildren) +
  incumbent `cli.mjs stop` with explicit env overrides (incumbent dir+SHA);
  state `stopped`; 12 s+ settle; no LISTENING on 5001/5174.
- Machine vars re-pointed to the new dir + pin (verified by re-read).
- Replacement XML: exactly 2 swaps of the full dir string (occurrence count
  verified 2→2, zero `80acdc25` remains). Encoding measured genuine
  UTF-16LE+BOM matching its declaration → registered **unmodified**, no
  repair (`SUCCESS`). Re-export field-compared: SYSTEM/ONSTART/`PT0S`/
  IgnoreNew, action+workdir = new dir. Required `Ready`, then one
  `schtasks /run` → `Running`. Temp replacement XML, scratch scripts, probe
  files removed; incumbent XML retained operator-only for rollback.

## Acceptance

- **D1 PASS.** Installed HEAD = pin; status `?? ops/runtime/logs/` only
  (declared expected dirty set). Machine vars = new dir + pin. Task
  action/workdir = new dir. Authoritative state: `releaseSha=d3e9dfef…`,
  `sourceDir` = new dir, `state=running`, ownedPids 23532/10248.
- **D2 PASS.** Exactly one listener per port: 5001→23532, 5174→10248, both
  `ParentProcessId=14540` (`"...\d3e9dfef-20260921\ops\runtime\cli.mjs" start`,
  child of 2540, task-launched). Task keeps SYSTEM/ONSTART/`PT0S`/IgnoreNew.
  Server entry resolves inside the release dir
  (`...\d3e9dfef-20260921\atlas-server\dist\server.js`); creations 21:23:43,
  postdating the cutover.
- **D3 PASS.** Local health 200, ready 200, host live 200, host ready 200,
  Tailnet `/api/v1/health` 200, `subjects?schoolId=1` 200.
  Published `?termIndex=1` → 200, distinct `termIndex={1}` (term-scoped);
  `?termIndex=bogus` → typed 400 `INVALID_TERM_INDEX`. Latest + run-specific
  violation reports → 401 `NO_TOKEN` pre-dispatch. No login performed.
- **D4 PASS.** Served `/` HTML byte-equal to `dist/index.html`; all 34
  referenced assets SHA-256-equal to dist (mismatches 0). Served entry is
  `index-BkDBtkSR.js` = freshly built manifest entry, differs from
  incumbent's `index-C6LTCXSf.js`. Served bytes contain the EnrollPro origin;
  no SMART/AIMS start-URL value. Env hash + 17-key set unchanged.
  `/auth/sso/smart/start` + `/auth/sso/aims/start` → typed 503
  `COMPANION_SSO_NOT_CONFIGURED`, no `Location`, no `Set-Cookie`. Signature
  map byte-identical pre/post (above).
- **D5 PASS.** Running entry inside the release dir; `dist/server.js`
  SHA-256 `367B7B40…C4623` equals the recorded pre-cutover build output;
  start postdates cutover. All three harnesses pass on the release tree
  (residual 1/0, mutations 1/0, readability 9/0, each exit 0).
  **Limitation, stated explicitly:** the live mutation routes were
  deliberately NOT probed — a live `POST` can write if a guard is not
  loaded; no live behavioural proof is claimed.
- **D6 DEFERRED (assigned to the independent post-action QA)** — never
  passed, never "not applicable". No browser opened, no login performed.

## Figures, rollback, risks

- D: free-before 35.24 GiB / post-build 34.33 GiB / post-cutover 34.33 GiB
  (projected 1.43–1.86; floor 15 holds).
- PIDs before: supervisor 3108, 5001→5976, 5174→2692. After: supervisor
  14540, 5001→23532, 5174→10248.
- New chunk `index-BkDBtkSR.js` (456,046 bytes) vs incumbent
  `index-C6LTCXSf.js` (455,998 bytes).
- Rollback: incumbent `80acdc25` startable in place (dist server+client,
  cli.mjs present; captured XML + both machine values retained operator-only).
  Not executed. Fallback order on typo correction: `a02884ff`, then
  `4c7c0bd9` and its predecessors.
- `git stash list` was DENIED by the harness (`git stash*` policy block) —
  recorded literally; no stash was created or used at any point. Residue
  check: release status `?? ops/runtime/logs/` only; all temp scripts/XMLs
  removed except the operator-only incumbent XML.
- Risks: NON_BLOCKING — `parseSchoolId` dead code in `runtime.router.ts`
  (successor, per r1 amendment F); supervisor log transient P1001/antivirus
  lines possible (DB-backed reads confirm health).
- Non-blocking observation: none new.

Verdict: `REVIEW_REQUIRED` — deployed, D1–D5 PASS on the real path, D6
deferred to the independent post-action QA.
