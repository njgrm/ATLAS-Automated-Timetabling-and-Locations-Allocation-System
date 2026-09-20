# CURRENT-SOURCE-LIVE-DEPLOY-C01 — executor evidence

Base `2d53b2a10ddd7b09ef8c0fd7ebc25c0fa186a9ad` (`origin/main`, re-fetched; target pin exists; worktree clean).
Target pin `7499916886707c35ea708a17ef7a87e791a6bade` at `D:\ATLAS-runtime-supervised-74999168-20260920`.
Elevated executor: true. No secret, env value, DB row, or log pasted here.

## Preconditions (all PASS, fail-closed)

1. Elevated Administrator: true.
2. `origin/main` = `2d53b2a1`; pin `74999168` verified (`git cat-file -t commit`); later tip did not replace pin.
3. Incumbent reproduced, matched `docs/plans/live-state.md`: task SYSTEM (`S-1-5-18`) / At-system-startup /
   `PT0S` / `IgnoreNew`; machine `ATLAS_RUNTIME_SOURCE_DIR=D:\ATLAS-runtime-supervised-74c1f12a5c06-20260918`,
   `ATLAS_RUNTIME_RELEASE_SHA=74c1f12a…`; supervisor PID 67028 with children 5001→63688 / 5174→12992
   (command lines verified); listeners owned by those PIDs; local health/ready, host `/`, Tailnet health 200;
   DB-backed subjects read 200; durable-env hash `BC7921A7…AED565C` with 17-key set; served chunk
   `assets/index-CtOKnF1z.js` (matches live-state). No divergence.
4. Disk: D: free 23.31 GiB pre-build; incumbent footprint ~0.58 GiB; post-install free 21.8 GiB (> 15 GiB). Proven.
5. Rollback basis: incumbent `dist/server.js` + `dist/index.html` present; server `node_modules` junction →
   do-not-retire `0eb3b67f` tree holding generated `index.js`; client `node_modules` junction →
   `E:\ATLAS-worktrees\ux-quickfix-c01\…`; Git identity `74c1f12a`; `ops/runtime/cli.mjs` present. Untouched after.
6. Original task XML exported to operator-only `%TEMP%`, SHA-256 `72FB5C1C…273CA8C`. Fields captured:
   SYSTEM / BootTrigger(ONSTART) / PT0S / IgnoreNew / incumbent action+workdir. Retained until QA terminal.
7. System `safe.directory` = wildcard `*` → gate satisfied by wildcard; nothing added.
8. Pre schema-wide signature map: 46 tables, file SHA-256 `222718C7…E7C3E3` (names+counts+hashes only).
9. Release built before touching 5001/5174: clean clone, checkout at exact pin (HEAD verified, status clean);
   locked `npm ci` in root (270 pkgs), server (252), client (237) — own trees, no junctions; `prisma generate`
   from `atlas-server` vs repo-root schema → client v6.19.2 + `PRISMA-IMPORT-SMOKE-OK`; server `tsc` build +
   `dist/server.js`; client build with exactly `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net`
   (SMART/AIMS start URLs unset in env); `companion-config.test.ts` 11/11 (SMART+AIMS disabled plain text,
   no `href`); alternate-port smokes: server `:5052` health/ready/subjects 200, host `:5199` 200; jobs stopped,
   ports clear, zero background jobs.
10. Built manifest from `dist/index.html`: single JS asset `index-Bk7FKtfs.js`,
    SHA-256 `4F55D9452418D534116F035703498FBA8A3FD5A1705C6128057074CC04DA8F98` (differs from incumbent chunk).

## Cutover (single short step, after all above passed)

- `taskkill /PID 67028 /T /F` (incumbent tree) + incumbent `cli.mjs stop` with incumbent machine values in
  child env → state `stopped`; settled 12 s; 5001/5174 free; task `Ready` (not Running).
- Machine vars re-pointed to target dir + pin (verified by re-read).
- Replacement XML: exactly 2 string swaps (action args + workdir) → UTF-16 encoding repair (schtasks rejects
  the UTF-8-with-UTF-16-declaration bytes its own `/query /xml` emits; original capture untouched,
  re-declaration matches bytes, no property changed) → registered OK, hash `B6D36B02…AB32`; re-export
  field-compared: SYSTEM/ONSTART/PT0S/IgnoreNew/command preserved, action+workdir = target.
- Required `Ready`, then single `schtasks /run` → task `Running`. Temp new/re-export XMLs removed (hashes kept).

## Acceptance 8/8 PASS (0 blocked, 0 unperformed)

1. Release: installed HEAD `74999168`; machine SHA prefix `74999168`; task action/workdir = target;
   supervisor-state `releaseSha=74999168…`, `sourceDir`=target, `state=running`, ownedPids 40332/86720.
   (`productPin=d44f29e0` ignored as historical per packet.)
2. Ownership: single listeners 5001→40332, 5174→86720; both `ParentProcessId=83856`
   (`…\74999168-20260920\ops\runtime\cli.mjs start`, task-launched, not executor shell).
3. Health: local health/ready 200, host live/ready 200, Tailnet health 200, subjects read 200.
4. Term truth: `…/schools/1/schedules/published?termIndex=1` → 200, 920 entries, distinct termIndex = {1};
   `termIndex=bogus` → typed 400 `INVALID_TERM_INDEX`.
5. Warnings: latest + run-specific violation reports → 401 `NO_TOKEN` pre-dispatch. No login performed.
6. Client identity: Tailnet `/` 200, no React-crash markers, serves `/assets/index-Bk7FKtfs.js` whose fetched
   bytes SHA-256 = `4F55D945…98` (manifest-equal); contains EnrollPro origin; no SMART/AIMS start-URL values
   (only inert env-key references; 11/11 component control proves disabled plain text, no `href`).
7. Config: env hash unchanged `BC7921A7…`, 17-key set unchanged, supervisor log
   `[rollover-automation] Disabled via ROLLOVER_AUTO_SYNC_ENABLED=false`, no SMART/AIMS secret/URL invented.
8. Peers + zero mutation: SMART/AIMS starts → typed 503 `COMPANION_SSO_NOT_CONFIGURED`, no Location,
   no Set-Cookie; post schema-wide map (46 tables) SHA-256 = pre `222718C7…` byte-identical.

## Risks

- NON_BLOCKING: D: remains below the 25 GiB warning (21.8 GiB free; 15 GiB floor holds with margin).
- NON_BLOCKING: new supervisor-state omits the old `invariants` block; rollover-disabled proven via log line.
- NON_BLOCKING: task-XML encoding repair (above); original capture byte-preserved for symmetric rollback.
- BLOCKING: none open. Rollback NOT executed (no mandatory failure); incumbent + fallbacks preserved untouched.

## Rollback status

Not required, not executed. Symmetric path staged: original XML (`72FB5C1C…`) retained operator-only until
post-action QA terminal; incumbent release, `0eb3b67f` client graft, and `ux-quickfix-c01` host deps untouched.

Verdict: `REVIEW_REQUIRED` — deployed and 8/8 on the real path; awaiting fresh independent post-action QA.
