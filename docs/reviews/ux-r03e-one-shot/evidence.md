# UX-R03e Part B — deployment evidence (executor)

Target pin `434b2a8111cda9b77d545c2939555413c959b775` at
`D:\ATLAS-runtime-supervised-434b2a81-20260921`.
Base branch `work/ux-r03e-20260921`, candidate `434b2a81` (Part A source already
committed: `5acb08b8` runs + `434b2a81` setup; this run is Part B deployment only).
`origin/main` re-fetched at execution (`8afdd458`, one docs-only commit above the pin).
No secret, env value, DB row, or log pasted here. No browser, no login.

## Preconditions (all PASS, fail-closed, re-captured)

1. Elevated Administrator: true. `safe.directory` system scope = `*` (wildcard;
   nothing added).
2. `origin/main` re-fetched; pin exists (`git cat-file -t commit`).
   Incumbent live at start: release `5f5c6c4f02caf91b1ad948ebfcb6dde409073ad6`,
   supervisor PID 75172 (child of 3456), `5001`→91880, `5174`→76056 (single
   LISTENING owners; both children of 75172), supervisor-state
   `releaseSha=5f5c6c4f…`, `state=running`, ownedPids 91880/76056.
   Machine values at start: source dir = incumbent dir, release SHA = `5f5c6c4f…`.
   Task `ATLAS-Runtime-Supervisor`: Running, SYSTEM (`S-1-5-18`), ONSTART
   (`BootTrigger`), `PT0S`, `IgnoreNew`; action node + incumbent `cli.mjs start`.
3. Incumbent startable: `dist/server.js`, `dist/index.html`, `cli.mjs`,
   `.prisma/client` loadable + `query_engine-windows.dll.node` present; own trees
   (no `LinkType` on release root or server/client `node_modules`); installed HEAD
   `5f5c6c4f`, status clean apart from untracked `ops/runtime/logs/`. Untouched after
   (only its runtime logs advanced during quiesce).
4. Disk: D: free 17.31 GiB pre-build; incumbent footprint ~1.86 GiB;
   15.81 GiB post-build (> 15 GiB floor; below 25 GiB warning — NON_BLOCKING).
5. Incumbent task XML captured to operator-only `%TEMP%` before any mutation
   (SHA-256 `934A91FE…`; fields SYSTEM/ONSTART/PT0S/IgnoreNew/incumbent
   action+workdir). Retained until post-action QA terminal.
6. Served incumbent chunk: `assets/index-CQqAftds.js`
   (SHA-256 `89B91169…`, re-captured from the live host).
7. Pre schema-wide signature map (C01 addendum SQL verbatim, throwaway script,
   child-process env only, script deleted after): 46 tables, file
   SHA-256 `4EC274C5…`.
8. Env: SHA-256 `BC7921A7…`, 17-key set, no SMART/AIMS key. Health pre-cutover:
   local health/ready 200, host 200, Tailnet health 200, subjects read 200.

## Build (isolated, own trees, no junctions)

Clean clone + detached checkout at exact pin (HEAD verified, status clean).
Locked `npm ci`: root 270, server 252, client 237 pkgs. `prisma generate` from
`atlas-server` against repo-root schema → client v6.19.2 +
`PRISMA-IMPORT-SMOKE-OK` (engine present). Server `tsc` build →
`dist/server.js`. Client build with exactly
`VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net` (SMART/AIMS start URLs
unset; only pre-existing `VITE_PROXY_TARGET` in process env).
`companion-config.test.ts` 11/11 (SMART+AIMS disabled plain text, no `href`).
Built entry `assets/index-BMgoX99N.js` (SHA-256 `56B25858…`; differs from
incumbent chunk) + `index-C5EpPgzZ.css`; bundle carries the EnrollPro origin,
SMART/AIMS `void 0`, the `timetable/setup` marker, and lazy
`TimetableRunsPane`/`TimetableSetupPane` chunks.
Alternate-port smokes: server `:5052` health/ready/subjects 200;
host `:5199` 200 serving the new entry chunk; both stopped, no LISTENING left
on 5052/5199, zero residual processes.

## Cutover (single short step, after all above passed)

- `taskkill /PID 75172 /T /F` + incumbent `cli.mjs stop` (incumbent machine
  values) → state `stopped`; settled 12 s; 5001/5174 free; task `Ready`.
- DEVIATION (recorded literally, corrected in-run): the first smoke-launch
  attempt via `[System.Diagnostics.Process]::Start` errored in the tool wrapper
  (`Unknown: ChildProcess.kill`) but its node child survived and bound `:5052`;
  the retry then probed that surviving process (same new-release bytes, same
  env method). Both smoke processes were stopped and `:5052`/`:5199` proven
  free with zero residual node processes before cutover. No incumbent,
  runtime, or database state was touched by this deviation.
- Machine vars re-pointed to target dir + pin (verified by re-read, exact;
  no double-backslash on this run).
- Replacement XML: exactly 2 string swaps (action args + workdir, occurrence
  count verified = 2). No encoding repair needed — this capture was true
  UTF-16LE+BOM matching its UTF-16 declaration, so `schtasks /create … /f`
  succeeded directly (re-export hash equals replacement hash `1FA11D10…`).
  Re-export field-compared: SYSTEM/ONSTART/PT0S/IgnoreNew/command preserved,
  action+workdir = target.
- Required `Ready`, then single `schtasks /run` → task `Running`.

## Acceptance rows 5–8 — 4/4 PASS (Part C browser rows not attempted)

5. Release: installed HEAD `434b2a81`, status clean (untracked logs only);
   machine source dir + SHA = target; task action/workdir = target;
   supervisor-state `releaseSha=434b2a81…`, `sourceDir`=target, `state=running`,
   ownedPids 74212/90380. (`productPin=d44f29e0` ignored as historical.)
6. Ownership: single listeners 5001→74212, 5174→90380; both `ParentProcessId`
   = 87396 (`…\434b2a81-20260921\ops\runtime\cli.mjs start`, task-launched,
   not executor shell); task Running/SYSTEM/ONSTART/PT0S/IgnoreNew.
7. Health, term truth, warnings: local health/ready 200, host live/ready 200,
   Tailnet health 200, subjects read 200; `…/schools/1/schedules/published?termIndex=1`
   → 200, 920 entries, distinct termIndex = {1}; `termIndex=bogus` → typed 400
   `INVALID_TERM_INDEX`; latest + run-specific violation routes → 401 `NO_TOKEN`
   pre-dispatch. No login performed.
8. Served identity, config, zero write: Tailnet + local HTML hash-equal to built
   `dist/index.html` (`96AC5151…`); all 34 referenced assets byte-equal to dist;
   served entry `index-BMgoX99N.js` (`56B25858…` ≠ incumbent `index-CQqAftds.js`
   `89B91169…`); served bytes carry the EnrollPro origin and `timetable/setup`
   marker with SMART/AIMS `void 0`; no React-crash markers; env hash unchanged
   `BC7921A7…`, 17-key set unchanged, supervisor log
   `[rollover-automation] Disabled via ROLLOVER_AUTO_SYNC_ENABLED=false`;
   SMART/AIMS starts → typed 503 `COMPANION_SSO_NOT_CONFIGURED`, no Location,
   no Set-Cookie; post schema-wide map (46 tables) SHA-256 = pre `4EC274C5…`,
   `fc` no differences.

## Built-versus-served manifest

| Asset | Built dist SHA-256 | Served bytes SHA-256 | Match |
|---|---|---|---|
| `index-BMgoX99N.js` | `56B25858…` | `56B25858…` | equal |
| `index.html` | `96AC5151…` | `96AC5151…` | equal |
| 32 further referenced assets | dist manifest | served bytes | all equal |

New entry `index-BMgoX99N.js` differs from incumbent `index-CQqAftds.js`
(`89B91169…`).

## Identity before/after

- Before: supervisor 75172 → server 91880 (5001), host 76056 (5174);
  release `5f5c6c4f`, chunk `index-CQqAftds.js`.
- After: supervisor 87396 → server 74212 (5001), host 90380 (5174);
  release `434b2a81`, chunk `index-BMgoX99N.js`.
- Signature map: pre `4EC274C5…` = post `4EC274C5…` (byte-identical).

## Cleanup and residue

Deleted: sigmap throwaway script, smoke servers/hosts, served-asset copies,
served-HTML copies, sigmap pre/post files, incumbent-chunk copy, replacement +
re-export task XMLs. Retained operator-only in `%TEMP%`: the original incumbent
task XML (`934A91FE…`) until post-action QA terminal, per the packet's rollback
path. No `git stash` (none created by this run; stash-list check unavailable
under tool policy — not asserted), no reset, no forced worktree removal.
`git status --short` in the executor worktree shows only this evidence file
pre-commit. No existing release was retired or mutated (`5f5c6c4f`, `c93dd2ee`,
`0eb3b67f`, `8eb0511baa53`, `E:\ATLAS-worktrees\ux-quickfix-c01` untouched;
incumbent dir only advanced its own runtime logs during quiesce). Port 5175,
unrelated processes, companion runtimes, Tailscale Serve untouched.
`D:\ATLAS-runtime-config\atlas-server.env` byte-unchanged (`BC7921A7…`).

## Risks

- NON_BLOCKING: D: at 15.81 GiB free — below the 25 GiB warning, above the
  15 GiB floor with ~0.8 GiB margin.
- NON_BLOCKING: smoke-launch deviation (above) — same new-release bytes, fully
  stopped and proven free before cutover; no downstream effect.
- NON_BLOCKING: no encoding repair needed for task XML (differs from C01's
  hazard; recorded literally, original capture preserved).
- NON_BLOCKING: runs/setup pane rendering belongs to Part C browser rows (QA
  custody, not this run); deployment proves the new chunk served, not the UX.
- BLOCKING: none open. Rollback NOT executed (no mandatory failure).

## Rollback status

Not required, not executed. Symmetric path staged: original incumbent XML
(`934A91FE…`) retained operator-only; incumbent release startable and intact.

Verdict: `REVIEW_REQUIRED` — deployed and 4/4 (rows 5–8) on the real path;
Part C browser rows belong to the independent QA task.
