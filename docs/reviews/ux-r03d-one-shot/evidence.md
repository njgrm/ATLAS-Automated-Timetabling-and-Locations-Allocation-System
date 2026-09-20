# UX-R03d Part B — deployment evidence (executor)

Target pin `5f5c6c4f02caf91b1ad948ebfcb6dde409073ad6` at
`D:\ATLAS-runtime-supervised-5f5c6c4f-20260920`.
Base branch `work/ux-r03d-20260920`, candidate `5f5c6c4f` (Part A source already
committed; this run is Part B deployment only). No secret, env value, DB row, or
log pasted here. No browser, no login.

## Preconditions (all PASS, fail-closed, re-captured)

1. Elevated Administrator: true. `safe.directory` system scope = `*` (wildcard;
   nothing added).
2. `origin/main` re-fetched; pin exists (`git cat-file -t commit`).
   Incumbent live at start: release `c93dd2ee352a1e1a2d2850d6f3e746b69a63f559`,
   supervisor PID 91896 (task-launched, parent 3456), `5001`→92740,
   `5174`→82444 (single LISTENING owners; both children of 91896),
   supervisor-state `releaseSha=c93dd2ee…`, `state=running`.
   Machine values at start: source dir = incumbent dir, release SHA = `c93dd2ee…`.
   Task `ATLAS-Runtime-Supervisor`: Running, SYSTEM (`S-1-5-18`), ONSTART
   (`BootTrigger`), `PT0S`, `IgnoreNew`; action node + incumbent `cli.mjs start`.
3. Incumbent startable: `dist/server.js`, `dist/index.html`, `cli.mjs`,
   `.prisma/client` + `query_engine-windows.dll.node` present; own trees
   (no `LinkType` on any `node_modules`); installed HEAD `c93dd2ee`,
   status clean apart from untracked `ops/runtime/logs/`. Untouched after
   (only its runtime logs advanced during quiesce).
4. Disk: D: free 18.81 GiB pre-build; incumbent footprint ~1.86 GiB;
   17.31 GiB post-build (> 15 GiB floor; below 25 GiB warning — NON_BLOCKING).
5. Incumbent task XML captured to operator-only `%TEMP%` before any mutation
   (SHA-256 `6C4DECA6…`; fields SYSTEM/ONSTART/PT0S/IgnoreNew/incumbent
   action+workdir). Retained until post-action QA terminal.
6. Served incumbent chunk: `assets/index-BiORrVpn.js`
   (SHA-256 `84976BB1…`).
7. Pre schema-wide signature map (C01 addendum SQL verbatim, throwaway script,
   child-process env only, script deleted after): 46 tables, file
   SHA-256 `E19E450F…`.
8. Env: SHA-256 `BC7921A7…`, 17-key set, no SMART/AIMS key. Health pre-cutover:
   local health/ready 200, host 200, Tailnet health 200, subjects read 200.

## Build (isolated, own trees, no junctions)

Clean clone + detached checkout at exact pin (HEAD verified, status clean).
Locked `npm ci`: root 270, server 252, client 237 pkgs. `prisma generate` from
`atlas-server` against repo-root schema (engine present). Server `tsc` build →
`dist/server.js`. Client build with exactly
`VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net` (SMART/AIMS start URLs
unset; machine env carries no `VITE_SMART/AIMS` key).
Built manifest: single entry `assets/index-CQqAftds.js`
(SHA-256 `89B91169…`; differs from incumbent chunk) + `index-DGD2gSDu.css`.
Alternate-port smokes: server `:5052` health/ready/subjects 200;
host `:5199` 200 serving the new entry chunk; both stopped, no LISTENING left
on 5052/5199 (TIME_WAIT only).

## Cutover (single short step, after all above passed)

- `taskkill /PID 91896 /T /F` + incumbent `cli.mjs stop` (incumbent machine
  values) → state `stopped`; settled 12 s; 5001/5174 free; task `Ready`.
- DEVIATION (corrected immediately, no downstream effect): the first
  `SetEnvironmentVariable(ATLAS_RUNTIME_SOURCE_DIR)` wrote `D:\\…` (doubled
  backslash). Re-set to `D:\ATLAS-runtime-supervised-5f5c6c4f-20260920`
  (length 45 verified) and full release SHA (length 40 verified) by re-read.
- Replacement XML: exactly 2 string swaps (action args + workdir). No encoding
  repair needed — this capture was true UTF-16 matching its declaration, so
  `schtasks /create … /f` succeeded directly (C01's UTF-8/UTF-16 hazard did not
  recur; recorded here literally). Re-export field-compared line-for-line
  (74/74 lines, zero diffs): SYSTEM/ONSTART/PT0S/IgnoreNew/command preserved,
  action+workdir = target.
- Required `Ready`, then single `schtasks /run` → task `Running`.

## Acceptance rows 5–9 (C02 rows 1–8, re-captured) — 8/8 PASS

1. Release: installed HEAD `5f5c6c4f`, status clean (untracked logs only);
   machine source dir + SHA = target; task action/workdir = target;
   supervisor-state `releaseSha=5f5c6c4f…`, `sourceDir`=target, `state=running`,
   ownedPids 91880/76056. (`productPin=d44f29e0` ignored as historical.)
2. Ownership: single listeners 5001→91880, 5174→76056; both `ParentProcessId`
   = 75172 (`…\5f5c6c4f-20260920\ops\runtime\cli.mjs start`, child of 3456,
   task-launched, not executor shell); task Running/SYSTEM/ONSTART/PT0S/IgnoreNew.
3. Health: local health/ready 200, host live/ready 200, Tailnet health 200,
   subjects read 200.
4. Term truth: `…/schools/1/schedules/published?termIndex=1` → 200, 920 entries,
   distinct termIndex = {1}; `termIndex=bogus` → typed 400
   `INVALID_TERM_INDEX`.
5. Warnings: latest + run-specific violation routes → 401 `NO_TOKEN`
   pre-dispatch. No login performed.
6. Client identity: Tailnet `/` 200; Tailnet + local HTML reference
   `/assets/index-CQqAftds.js` (≠ incumbent `index-BiORrVpn.js`); served entry
   bytes SHA-256 = `89B91169…` (manifest-equal), CSS `644C3333…` (manifest-equal);
   served HTML hash-equal to built `dist/index.html`; bundle carries the
   EnrollPro origin; SMART/AIMS only inert (`VITE_*_START_URL:void 0`,
   "not configured" labels, no URL values); no crash markers beyond React's own
   error-formatter source text (page serves 200; browser behaviour belongs to QA).
7. Config: env hash unchanged `BC7921A7…`, 17-key set unchanged, supervisor log
   `[rollover-automation] Disabled via ROLLOVER_AUTO_SYNC_ENABLED=false`;
   no SMART/AIMS secret/URL invented.
8. Peers + zero mutation: SMART/AIMS starts → typed 503
   `COMPANION_SSO_NOT_CONFIGURED`, no Location, no Set-Cookie; post schema-wide
   map (46 tables) SHA-256 = pre `E19E450F…`, `fc` no differences.

## Built-versus-served manifest

| Asset | Built dist SHA-256 | Served bytes SHA-256 | Match |
|---|---|---|---|
| `index-CQqAftds.js` | `89B91169…` | `89B91169…` | equal |
| `index-DGD2gSDu.css` | `644C3333…` | `644C3333…` | equal |
| `index.html` | `20CAAF58…` | `20CAAF58…` | equal |

New entry `index-CQqAftds.js` differs from incumbent `index-BiORrVpn.js`
(`84976BB1…`).

## Identity before/after

- Before: supervisor 91896 → server 92740 (5001), host 82444 (5174);
  release `c93dd2ee`, chunk `index-BiORrVpn.js`.
- After: supervisor 75172 → server 91880 (5001), host 76056 (5174);
  release `5f5c6c4f`, chunk `index-CQqAftds.js`.
- Signature map: pre `E19E450F…` = post `E19E450F…` (byte-identical).

## Cleanup and residue

Deleted: smoke launcher + pid files, sigmap script + pre/post/term/headers/body
probe files, served-asset copies, replacement + re-export task XMLs. Retained
operator-only in `%TEMP%`: the original incumbent task XML (`6C4DECA6…`) until
post-action QA terminal, per the packet's rollback path. No `git stash`
(no stash assertion available under tool policy — none was created by this run),
no reset, no forced worktree removal. `git status --short` in the executor
worktree shows only this evidence file pre-commit (verified clean-empty before
writing). No existing release was retired or mutated (`c93dd2ee`, `d50dde64`,
`0eb3b67f`, `8eb0511baa53`, `E:\ATLAS-worktrees\ux-quickfix-c01` untouched;
incumbent dir only advanced its own runtime logs during quiesce). Port 5175,
unrelated processes, companion runtimes, Tailscale Serve untouched.
`D:\ATLAS-runtime-config\atlas-server.env` byte-unchanged (`BC7921A7…`).

## Risks

- NON_BLOCKING: D: at 17.31 GiB free — below the 25 GiB warning, above the
  15 GiB floor with margin.
- NON_BLOCKING: machine-var double-backslash deviation (above) — corrected
  before any dependent step; verified by re-read.
- NON_BLOCKING: no encoding repair needed for task XML (differs from C01's
  hazard; recorded literally, original capture preserved).
- NON_BLOCKING: `resolveOutletKey`/`routeEpoch` identifiers are minified away
  in the bundle; newness is proven by chunk name + SHA difference, behaviour by
  Part A source + QA browser row (Part C, not this run).
- BLOCKING: none open. Rollback NOT executed (no mandatory failure).

## Rollback status

Not required, not executed. Symmetric path staged: original incumbent XML
(`6C4DECA6…`) retained operator-only; incumbent release startable and intact.

Verdict: `REVIEW_REQUIRED` — deployed and 8/8 on the real path; Part C browser
rows belong to the independent QA task.
