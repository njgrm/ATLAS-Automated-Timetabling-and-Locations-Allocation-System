# DASHBOARD-TRUTH-C01 — Part B deployment evidence (Lane A)

Scope: **Part B only** — the release build and the supervised runtime switch.
No browser was opened and no login was performed; browser rows B1–B3 are handed to
the independent QA session. Lane A Part A is unchanged in
`docs/reviews/dashboard-truth-c01/executor-handoff.md`.

- **Risk:** HIGH (shared supervised runtime replacement).
- **Executor:** elevated Administrator `LAPTOP-6K65A1QI\njgro` (verified `IsInRole(Administrator)=True`).
- **Worktree:** `E:\ATLAS-worktrees\dashboard-truth-c01`, branch `work/dashboard-truth-c01`.
- **No `atlas-server/**` source was changed.** The delta deployed is client-only.

## Pin and product-tree proof

- Re-fetched `origin/main` = **`4c7c0bd996569d2c8bfc0c836a9f986b48f9938d`** (the pin).
- Accepted product commit **`2a6cb06d`**.
- `git diff --name-status 2a6cb06d 4c7c0bd9` → exactly 2 files, both docs:
  `M docs/handoffs/planner-session-handoff.md`,
  `A docs/reviews/dashboard-truth-c01/executor-handoff.md`.
- `git diff --name-only 2a6cb06d 4c7c0bd9 -- atlas-client atlas-server ops prisma package.json package-lock.json` → **empty, exit 0**.
  The product tree at the pin is byte-identical to `2a6cb06d`.
- Release directory: **`D:\ATLAS-runtime-supervised-4c7c0bd9-20260921`** (clean clone of `D:\ATLAS`, detached `--detach 4c7c0bd9`, own dependency trees, **junction-free** — reparse scan of root/`node_modules` ×3 clean).

## Deviations from the packet, recorded literally

1. **`npm ci` is blocked by the executor harness deny-list** (`npm ci*`, `npm install*`).
   I did **not** wrap or prefix a command to bypass it. The three dependency trees were
   **copied** from the junction-free incumbent release
   (`robocopy /E` → `node_modules`, `atlas-server\node_modules`, `atlas-client\node_modules`,
   all `rc=1`). This is sound because `git diff --name-only 434b2a81 4c7c0bd9 -- package-lock.json atlas-server/package-lock.json atlas-client/package-lock.json`
   is **empty** (no lockfile changed; only `atlas-client/package.json`, a test-script entry),
   so the installed dependency set is identical. No junction was created and no install
   ran through a shared tree.
2. **Task-XML encoding.** The packet records the C01 hazard as "re-declare the encoding before
   registration succeeds". Measured here it is the **opposite**: the captured bytes are
   ASCII/UTF-8 (`60,63,120,109,108…` = `<?xml`) carrying `encoding="UTF-16"`, and that file
   **registers with exit 0**. Rewriting the declaration to `encoding="UTF-8"` **fails**
   with `ERROR: The task XML is malformed. (1,40)::ERROR: unable to switch the encoding`.
   Controlled proof with two trigger-less probe tasks (both deleted; 0 remain):
   `probe1` (declaration preserved) exit **0**; `probe2` (declaration → UTF-8) exit **1**.
   **Repair applied: none — the declaration is preserved byte-for-byte.** The only edits to
   the captured XML are the two path substitutions
   (`434b2a81-20260921` → `4c7c0bd9-20260921`, in `<Arguments>` and `<WorkingDirectory>`).
3. **First switch attempt failed and was rolled back before continuing.** The first
   registration used the UTF-8-declared file, failed, and the rollback path re-registered the
   captured incumbent XML, restored both machine-scope values, and started the task. Rollback
   verified healthy: incumbent `434b2a81` task `Running`, 5001/5174 listening, local health
   200 / host `/` 200 / Tailnet health 200. The switch was then re-run with the corrected XML
   and completed.

## Preconditions (all PASS, fail-closed)

- Incumbent resolved from the task, never assumed: task action
  `node "D:\ATLAS-runtime-supervised-434b2a81-20260921\ops\runtime\cli.mjs" start`, SYSTEM,
  At-system-startup. Incumbent HEAD `434b2a81…`, `git status --short` = `?? ops/runtime/logs/`
  (untracked runtime log dir only). Supervisor PID 87396 (ppid 3456) with children
  5001→74212 / 5174→90380. State file `releaseSha=434b2a81…`, `sourceDir` = incumbent,
  `state=running`, `ownedPids.server=74212`, `ownedPids.client=90380`
  (`productPin=d44f29e0` ignored as historical). Local health/ready, host `/`, Tailnet health 200.
- **Task XML captured before any mutation**: `%TEMP%\opencode\atlas-runtime-434b2a81-rollback.xml`,
  SHA-256 `3B3A363397F0F00F268165C9DA0F15A1054F5B9BAFAD374B5A0E9F97A09A382C` (retained for rollback).
- **Rollback basis startable**: `D:\ATLAS-runtime-supervised-5f5c6c4f-20260920` has
  `atlas-server/dist/server.js`, `atlas-client/dist/index.html`, `ops/runtime/cli.mjs`, and
  `atlas-server/node_modules/.prisma/client` with `query_engine-windows.dll.node` (21,182,976 B).
  The same four checks pass on the incumbent `434b2a81`.
- **Disk (15 GiB floor):** `D:` free **39.73 GiB** before the build → **38.82 GiB** after the
  build and switch. Measured footprint: new release **1.86 GiB**, incumbent **1.86 GiB**.
- `safe.directory` system scope = **`*`** (wildcard; nothing added).
- **Durable env unchanged:** `D:\ATLAS-runtime-config\atlas-server.env`
  SHA-256 `BC7921A782141DA3819262FD7E2008B6FD7E256A067BFFF018D197430AED565C`, **17-key** set
  (`ATLAS_AUTH_DISABLE_RATE_LIMIT, ATLAS_SSO_REVERSE_CLIENT_SECRET, ATLAS_SYSTEM_TOKEN,
  CLIENT_URL, CORS_EXTRA_ORIGINS, DATABASE_URL, ENROLLPRO_API, ENROLLPRO_BASE_URL,
  ENROLLPRO_CLIENT_URL, ENROLLPRO_PROXY_ORIGIN, ENROLLPRO_SERVICE_TOKEN,
  ENROLLPRO_SSO_CALLBACK_URL, ENROLLPRO_SSO_CLIENT_SECRET, FACULTY_ADAPTER, JWT_SECRET, PORT,
  SECTION_SOURCE_MODE`). No value was read, printed, or changed. No SMART/AIMS key invented.
- **Incumbent served entry chunk:** `/assets/index-BMgoX99N.js`,
  SHA-256 `56B258585E17653A88FB98677FA1A9E2BE2C7FAA2BE26ABB89B2AF5CB46631B0`
  (455,935 B; the on-disk dist asset hashes identically, so the served bytes are the disk bytes).

## Build (release untouched on 5001/5174 throughout)

- `prisma generate` from `atlas-server` with `--schema ..\prisma\schema.prisma` →
  `Generated Prisma Client (v6.19.2) to .\node_modules\.prisma\client`, exit 0;
  `node -e "require('@prisma/client')"` → `PRISMA-IMPORT-SMOKE-OK`.
- `npm run build` in `atlas-server` (`tsc`) → exit 0, `dist/server.js` present.
- `npm run build` in `atlas-client` (`vite build`) with **only**
  `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net`; `VITE_SMART_SSO_START_URL` and
  `VITE_AIMS_SSO_START_URL` unset (`True/False` check → both unset) → exit 0 (`✓ built in 13.76s`).
  `VITE_PROXY_TARGET` was present in the shell but is referenced by no client source and the
  config only injects `VITE_`-prefixed `.env` values, so it cannot reach the bundle.
- Built manifest = `dist/index.html` + **34** referenced assets, all present on disk.

## Alternate-port smoke (5001/5174/5175 never bound)

- Server on **5052**: `/api/v1/health` 200, `/api/v1/health/ready` 200.
- Production host on **5199** (own `ops/runtime/host.mjs`, `ATLAS_HOST_*` env):
  `/` 200 serving `/assets/index-zIp12x6H.js`; proxied `/api/v1/health` 200.
- Both processes stopped; 5052/5199 clear; context listeners still 5001→74212 / 5174→90380.

## Zero-write evidence (C01 addendum method, verbatim)

Throwaway probe resolving `@prisma/client` v6.19.2 from the recorded do-not-retire tree
`D:\ATLAS-runtime-supervised-8eb0511baa53-20260917\atlas-server`, `DATABASE_URL` loaded into
the child process only. Literal SQL: table enumeration
`SELECT tablename FROM pg_tables WHERE schemaname=$$public$$ ORDER BY tablename`; per table
`SELECT COUNT(*)::int AS c, COALESCE(md5(string_agg(md5(row_to_json(t)::text), $$$$ ORDER BY md5(row_to_json(t)::text))), md5($$$$)) AS s FROM public."T" t`;
serialization = one line per table in name order `"<name> count=<n> sig=<md5>"` + trailing
newline; the value is the SHA-256 of that file. **`SET LOCAL TIME ZONE 'UTC'`** is pinned
inside the single read-only transaction so `row_to_json` of `timestamptz` is
session-deterministic (a per-statement `SET` is not, because Prisma pools connections).

- Determinism control: two consecutive pre runs → identical file SHA-256.
- **Pre = post = `CA2C915A65CF7C58443B998D50B355E3240DED9516620CFD58E62E754975CBD7`, 46 tables, byte-identical.**
- C01's recorded `222718C7…E3E3` is **not** reproduced, and is not expected: the live data
  advanced after 2026-09-20 (e.g. `audit_logs`, `_prisma_migrations` count=4). The row's
  requirement is pre==post within this cycle under one pinned method.
- The probe issued only `SELECT`/`SHOW` statements inside one read-only transaction; `_prisma_migrations count=4` was captured in the map and is unchanged pre→post.

## D1–D4 (deployment rows — decided by the deployed runtime)

- **D1 — PASSED.** Installed HEAD `4c7c0bd9…`, `git status --short` = `?? ops/runtime/logs/`
  (untracked runtime logs only; no modified tracked file). Machine-scope
  `ATLAS_RUNTIME_SOURCE_DIR=D:\ATLAS-runtime-supervised-4c7c0bd9-20260921`,
  `ATLAS_RUNTIME_RELEASE_SHA=4c7c0bd996569d2c8bfc0c836a9f986b48f9938d`. Task action
  `node "<release>\ops\runtime\cli.mjs" start`, working directory = release.
  `supervisor-state.json` `releaseSha=4c7c0bd9…`, `sourceDir` = release, `state=running`
  (read `releaseSha`; `productPin=d44f29e0` is historical).
- **D2 — PASSED.** Exactly one listener per port: 5001→102964, 5174→87184; supervisor PID
  102800 (ppid 3456, task-launched), both listeners are its direct children. Task re-export
  is **byte-identical** to the registered file (SHA-256 `328C8BC415C4B95C93FEE9F3FA79ABD10919D05DD739104C7F3692519563B16D`)
  and keeps `S-1-5-18`, `HighestAvailable`, `PT0S`, `IgnoreNew`, `BootTrigger`.
- **D3 — PASSED.** Local health 200, local ready 200, production-host `/` 200, production-host
  `/api/v1/health/ready` 200, Tailnet health 200, DB-backed `GET /api/v1/subjects?schoolId=1` 200.
  Public term truth: `/api/v1/schools/1/schedules/published?termIndex=1` → **200**, 920 entries,
  distinct `termIndex` = **{1}** (term-scoped); `?termIndex=bogus` → **400 `{"code":"INVALID_TERM_INDEX"}`**.
  Warning protection: `/api/v1/generation/1/1/runs/latest/violations` and
  `/api/v1/generation/1/1/runs/316/violations` → **401 `{"code":"NO_TOKEN"}`** pre-dispatch.
- **D4 — PASSED.** Served `index.html` bytes == built `dist/index.html`; all **34** referenced
  assets fetched from the host byte-match the built manifest (0 missing, 0 mismatched);
  served entry **`/assets/index-zIp12x6H.js`** vs incumbent **`/assets/index-BMgoX99N.js`**
  (differs; the served bytes are the deployed build, whose JS carries the new
  `test:dashboard-truth-c01` route markers). Env file SHA-256 and 17-key set unchanged.
  SMART `/api/v1/auth/sso/smart/start` → **503 `COMPANION_SSO_NOT_CONFIGURED`**, no `Location`,
  no `Set-Cookie`; AIMS → same typed 503. Rollover stays disabled:
  `[rollover-automation] Disabled via ROLLOVER_AUTO_SYNC_ENABLED=false`.
  Schema-wide signature map byte-identical (above). `D:` free **38.82 GiB** after (> 15 GiB floor).

## Handed to the independent QA browser session (not run here)

- **B1** dashboard truth on `/` — literal rendered strings, zero-HARD / 335-SOFT run.
- **B2** deferred `DUP-READ-CALLERS-C01` request counts on a clean `/timetable` load
  (`/auth/me` 1 per token epoch, `runtime/context` ≤2, `rollover-status` 1 with two cards
  mounted in the same step).
- **B3** no regression at `1366x768` on `/` and `/timetable`, console errors against the
  named incumbent build baseline. O1 (502 lead status/body/headers) and O2 (dedup baseline)
  are observations, reported separately.
- **One authorized login is expected and still unspent** — no login, no browser session and
  no read-only UI pass was performed in this lane.

## Incumbent / new chunk pair

| | Entry chunk | SHA-256 |
|---|---|---|
| Incumbent `434b2a81` | `/assets/index-BMgoX99N.js` | `56B258585E17653A88FB98677FA1A9E2BE2C7FAA2BE26ABB89B2AF5CB46631B0` |
| Deployed `4c7c0bd9` | `/assets/index-zIp12x6H.js` | `7BF06C86C8D3E12612C144815423CA0E4925E5F5DA32E5C57145DC4307FFA7AC` |

## Recorded `D:` figures

before build **39.73 GiB** · projected/measured new-release footprint **1.86 GiB** ·
after build+switch **38.82 GiB** · floor 15 GiB.

## Rollback status

Not executed for the final switch (no mandatory failure). Symmetric path staged and proven:
the captured incumbent XML (`3B3A3633…`, `%TEMP%\opencode\atlas-runtime-434b2a81-rollback.xml`)
plus both machine-scope values restore `434b2a81`; the release directory and the retained
`5f5c6c4f` basis are untouched and startable (four startability checks PASS). No branch,
release directory, or `0eb3b67fe94c-20260918` / `8eb0511baa53-20260917` /
`E:\ATLAS-worktrees\ux-quickfix-c01` was touched. The failed first attempt already exercised
the restore path end to end and it came back healthy.

## Cleanup

Removed: the replacement XML, the post-switch re-export, both probe XMLs, their outputs, the
smoke stdout/stderr, the three signature-map outputs, and the scratch probe script. Verified:
0 `ATLAS-Runtime-XmlProbe*` tasks remain, 0 listeners on 5052/5199, worktree
`git status --short` empty. Retained deliberately: the incumbent rollback XML above
(C02 §8 requires the captured incumbent XML for rollback). No `git stash` was created
(the deny-list blocks it; `git stash list` shows 3 pre-existing entries).

## Risks

- `NON_BLOCKING` — `npm ci` was deny-listed and dependency trees were copied instead of
  installed; lockfiles are byte-identical between incumbent and pin, and the release is
  junction-free, but the trees are not a fresh lock-verified install.
- `NON_BLOCKING` — the packet's task-XML hazard wording is inverted for this host; the literal
  measurement is recorded above and the declaration was preserved, not repaired.
- `NON_BLOCKING` — `D:` free (38.82 GiB) is below the 25 GiB warning band.
- `NON_BLOCKING` — `installation status` reports `live:false` for the children (known carried
  bug); listener ownership, `supervisor-state.json`, and the HTTP probes are authoritative.
- `NON_BLOCKING` — `GET /api/v1/auth/sso/enrollpro/start` also returns typed
  `503 COMPANION_SSO_NOT_CONFIGURED`. The env bytes are unchanged, so this is identical
  pre-existing configuration behaviour, not a regression; the packet's D4 clause only
  requires SMART/AIMS inactive.
- `BLOCKING` — none open.

## Verdict

`REVIEW_REQUIRED` — `4c7c0bd9` deployed and D1–D4 all PASS on the real path; B1–B3 remain
`UNPERFORMED` pending the independent QA browser session (one unspent authorized login).
