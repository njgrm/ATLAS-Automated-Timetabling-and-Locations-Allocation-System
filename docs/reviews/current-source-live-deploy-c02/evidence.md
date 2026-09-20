# CURRENT-SOURCE-LIVE-DEPLOY-C02 — executor evidence (rows 1–8; browser rows 9–12 held by planner)

Base `acee3cce` (branch `work/deploy-c02-20260920`, re-fetched `origin/main`; pin exists; worktree clean).
Target pin `d50dde642c10b1ea6fdc9097266ace53cdba2063` at `D:\ATLAS-runtime-supervised-d50dde64-20260920`.
Elevated executor: true. No secret, env value, DB row, or log pasted here. No login performed. No browser launched.

## Preconditions (all PASS, fail-closed)

1. Elevated Administrator: true (`S-1-16-12288`).
2. `origin/main` re-fetched; pin `d50dde64` verified (`cat-file -t commit`). Incumbent HEAD `74999168`,
   status `?? ops/runtime/logs/` only (runtime logs). Task SYSTEM (`S-1-5-18`) / BootTrigger(ONSTART) /
   `PT0S` / `IgnoreNew`, action+workdir = incumbent. Machine `ATLAS_RUNTIME_SOURCE_DIR` = incumbent dir,
   `ATLAS_RUNTIME_RELEASE_SHA` = `74999168…`. Supervisor 83856 with children 5001→40332 / 5174→86720
   (command lines verified; Services session). Authoritative state
   `ops/runtime/logs/supervisor-state.json`: `releaseSha=74999168…`, `running`, ownedPids 40332/86720.
   (Note: `cli.mjs status` reads a stale tree state pointing at `74c1f12a`; the `logs/` file is authoritative.)
   Local health/ready, host live/ready, Tailnet health, subjects read: all 200. Task XML captured to
   operator-only `%TEMP%`, SHA-256 `D78121C7…D5D25B2BD`. Served chunk `assets/index-Bk7FKtfs.js`,
   SHA-256 `4F55D945…98`.
3. Rollback basis startable: `atlas-server/dist/server.js` + `atlas-client/dist/index.html` +
   `ops/runtime/cli.mjs` present; `atlas-server/node_modules/.prisma/client` loadable with
   `query_engine-windows.dll.node`. Zero reparse points in the release (junction-free, own trees).
4. Disk: D: free 21.81 GiB pre-build, 20.33 GiB post-build (floor 15 GiB holds; 25 GiB warn noted).
5. System `safe.directory` = `*`; gate satisfied by wildcard, nothing added.
6. Pre schema-wide signature map (C01 addendum method verbatim, throwaway inline runner resolving the
   incumbent's own `@prisma/client`, `DATABASE_URL` in child memory only): 46 tables,
   file SHA-256 `4B600436…C8D6F3D` (names+counts+hashes only).
7. Env file SHA-256 `BC7921A7…AED565C`, 17-key set, no SMART/AIMS key.
8. Release built before touching 5001/5174: local clone, detached checkout at exact pin (HEAD verified,
   status clean); locked `npm ci` root 270 / server 252 / client 237 (own trees, no junctions);
   `prisma generate` from `atlas-server` vs repo-root schema → client v6.19.2; server `tsc` clean;
   client build with exactly `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net` (SMART/AIMS unset;
   only pre-existing `VITE_PROXY_TARGET` in process env); built entry `assets/index-BZ9J8198.js`,
   SHA-256 `C3EEF117…21DA` (differs from incumbent chunk), contains `/timetable/policies` and the
   EnrollPro origin. Alternate-port smokes: server `:5052` health/ready/subjects 200, host `:5199`
   root 200 serving the new chunk; both stopped, ports clear, zero background jobs.

## Cutover (single short step, after all above passed)

- `taskkill /PID 83856 /T /F` (supervisor + 40332/86720 + grandchildren) + incumbent `cli.mjs stop`
  → settled 12 s; 5001/5174 free; task `Ready`.
  (Side effect, recorded: this shell's process env still held stale `74c1f12a` values, so `cli.mjs stop`
  wrote its stopped-state into the retained `74c1f12a` tree's `logs/` state file — runtime state only,
  product bytes untouched. The incumbent `74999168` tree's `logs/` state still reads running/dead-PIDs;
  each release owns its state file and the new start repointed it.)
- Machine vars re-pointed to target dir + pin (verified by re-read).
- Replacement XML: exactly 2 string swaps (action args + workdir, occurrence count verified = 2).
  The C01 encoding hazard did NOT recur: the capture is genuine UTF-16LE+BOM matching its UTF-16
  declaration, so `schtasks` accepted it with no repair. Registered OK, hash `A531C12E…D154`;
  re-export field-compared: SYSTEM/ONSTART/PT0S/IgnoreNew/command preserved, action+workdir = target.
- Required `Ready`, then single `schtasks /run` → task `Running`. Temp replacement/re-export XMLs,
  scratch scripts, and probe files removed (hashes kept); incumbent capture (`D78121C7…`) retained
  operator-only for rollback.

## Acceptance 8/8 PASS (0 blocked, 0 unperformed; rows 9–12 not attempted — planner browser lane)

1. Release: installed HEAD `d50dde64`, status `?? ops/runtime/logs/` only; machine vars = target dir + pin;
   task action/workdir = target; supervisor-state `releaseSha=d50dde64…`, `sourceDir`=target,
   `state=running`, ownedPids 91512/90172. (`productPin=d44f29e0` historical.)
2. Ownership: single listeners 5001→91512, 5174→90172; both `ParentProcessId=90968`
   (`…\d50dde64-20260920\ops\runtime\cli.mjs start`, Services session, task-launched).
   Task keeps SYSTEM/ONSTART/`PT0S`/IgnoreNew.
3. Health: local health/ready 200, host live/ready 200 (artifact = new dist, upstream ready),
   Tailnet health 200, subjects read 200.
4. Term truth: `/api/v1/schools/1/schedules/published?termIndex=1` → 200, 920 entries,
   distinct termIndex = {1}; `termIndex=bogus` → typed 400 `INVALID_TERM_INDEX`.
5. Warnings: `/api/v1/generation/1/9/runs/latest/violations` + `/runs/1/violations` → 401 `NO_TOKEN`
   pre-dispatch. No login performed.
6. Client identity: served HTML byte-equal to `dist/index.html`; all 35 referenced assets byte-equal
   to dist (hash-compared); entry `index-BZ9J8198.js` differs from incumbent `index-Bk7FKtfs.js`;
   served bytes contain `/timetable/policies` and the EnrollPro origin; no SMART/AIMS start-URL value;
   no React-crash markers; Tailnet `/` 200 serving the new chunk.
7. Config: env hash unchanged `BC7921A7…`, 17-key set unchanged, supervisor log
   `[rollover-automation] Disabled via ROLLOVER_AUTO_SYNC_ENABLED=false`, no SMART/AIMS invented.
8. Peers + zero mutation: `/api/v1/auth/sso/smart/start` + `/sso/aims/start` → typed 503
   `COMPANION_SSO_NOT_CONFIGURED`, no Location, no Set-Cookie; post schema-wide map (46 tables)
   SHA-256 = pre `4B600436…` byte-identical.

## Risks

- NON_BLOCKING: D: below the 25 GiB warning (20.33 GiB free; 15 GiB floor holds with margin).
- NON_BLOCKING: `cli.mjs status` reads a stale non-authoritative state file (see cutover note);
  acceptance reads the authoritative per-release `logs/supervisor-state.json`.
- NON_BLOCKING: new supervisor-state omits the old `invariants` block; rollover-disabled proven via log.
- NON_BLOCKING: `git stash list` is non-empty (3 pre-existing entries on other branches; none created here).
- BLOCKING: none open. Rollback NOT executed (no mandatory failure); incumbent + fallbacks untouched.

## Rollback status

Not required, not executed. Symmetric path staged: incumbent capture (`D78121C7…`) retained
operator-only until post-action QA terminal; incumbent release `74999168` startable and untouched.

Verdict: `REVIEW_REQUIRED` — deployed and 8/8 on the real path; rows 9–12 await the planner browser pass.
