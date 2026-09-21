# ACTOR-SCHOOL-MUTATIONS-C01 Part B — deployment evidence

Base `c6692bade581e3efa153648dc169bfe9c37b151c` (`origin/main`, re-fetched; pin
verified via `git cat-file -t`). Target pin
`80acdc257cee613418eaa24db4607114b68c2d25` at
`D:\ATLAS-runtime-supervised-80acdc25-20260921` (registered detached worktree).
Elevated executor: true. No secret, env value, or database row is recorded here.
No browser, no login, no generation, no publication, no migration, no database
mutation, no rollover/Teaching Load/term-cache action was performed.

## Preconditions (all PASS, fail-closed)

1. Elevated Administrator: true.
2. `origin/main` = `c6692bad`; pin `80acdc25` verified (`git cat-file -t commit`).
   Process-scope env held the known-stale pair
   (`ATLAS_RUNTIME_SOURCE_DIR=D:\ATLAS-runtime-supervised-c93dd2ee-20260920`,
   `ATLAS_RUNTIME_RELEASE_SHA=c93dd2ee…`); every `cli.mjs` invocation therefore
   used explicit env overrides, and identity was read from the task action, the
   supervisor command line, and the authoritative per-release state file.
3. Incumbent reproduced: HEAD `a02884ff75d46c336b17d7eaa52d8cfa773bd6af`,
   status `?? ops/runtime/logs/` only; task SYSTEM / ONSTART / `PT0S` /
   IgnoreNew, action+workdir = incumbent dir; machine
   `ATLAS_RUNTIME_SOURCE_DIR`=incumbent dir,
   `ATLAS_RUNTIME_RELEASE_SHA`=`a02884ff…`; supervisor PID 102756 with children
   5001→99584 (`…\a02884ff-20260921\atlas-server\dist\server.js`) /
   5174→96548 (`…\a02884ff-20260921\ops\runtime\host.mjs`); single listeners on
   5001/5174 owned by those PIDs; local health/ready, host `/`, Tailnet health,
   DB-backed subjects read all 200; published `termIndex=1` → 200,
   `termIndex=bogus` → 400, violations-latest → 401; durable-env SHA-256
   `BC7921A7…AED565C` with the 17-key set; served entry
   `assets/index-C6LTCXSf.js` (455,998 bytes, SHA-256 `BF1DF52A…7C97`).
   Task XML captured to operator-only `%TEMP%` before any mutation, SHA-256
   `B0EF4152…C35C29` (genuine UTF-16LE+BOM, declaration `encoding="UTF-16"`).
4. Capacity: D: free **37.32 GiB** pre-build; projected footprint ~0.85 GiB
   dependency trees + release checkout; D: free **35.82 GiB** post-cutover
   (floor 15 GiB holds with wide margin; 25 GiB warn never tripped).
5. Rollback basis startable: incumbent `dist/server.js` +
   `dist/index.html` + `ops/runtime/cli.mjs` present;
   `atlas-server/node_modules/.prisma/client` loadable with
   `query_engine-windows.dll.node`; zero top-level reparse points in all three
   incumbent `node_modules` trees (junction-free, own trees).
6. Pre schema-wide signature map (C01 addendum method + §4.6 in-transaction
   timezone pin; throwaway runner resolving the release tree's own freshly
   generated `@prisma/client`, `DATABASE_URL` in child memory only; script
   deleted after each run): **46 tables**, file SHA-256
   `EE03F1D0A5722E5F43623DC3B6D31F5DD69E94E5BC301A1C5D217B159D65521B`
   (names+counts+hashes only). Literal method retained below.
7. Release built before touching 5001/5174: registered detached worktree at the
   exact pin (HEAD verified); dependency trees copied (not installed, not
   junctioned) from the incumbent —
   `Copy-Item -LiteralPath <incumbent>\node_modules -Destination <release>\node_modules -Recurse -Force`
   (same for `atlas-server\node_modules`, `atlas-client\node_modules`);
   provenance: incumbent trees, top-level reparse count 0 before and 0 after in
   the release; `prisma generate --schema ..\prisma\schema.prisma` from
   `atlas-server` → client v6.19.2 into the release's own
   `node_modules\.prisma\client` (query engine present); server `tsc` clean,
   `dist/server.js` SHA-256 `367B7B40…C4623`; committed harness
   `npm run test:actor-school-mutations` → **tests 1 / pass 1 / fail 0**,
   exit 0; client `vite build` with exactly
   `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net` (process env held
   only pre-existing `VITE_PROXY_TARGET`; SMART/AIMS start URLs unset) →
   entry `assets/index-C6LTCXSf.js`, 455,998 bytes, SHA-256 `BF1DF52A…7C97`,
   **byte-identical** to the incumbent's (byte-diff 0); isolated smokes:
   server `:5052` health/ready/subjects 200, host `:5199` root 200 serving the
   new chunk; both stopped, ports clear, zero residual processes.

## Cutover (single short step, after all above passed)

- `taskkill /PID 102756 /T /F` (supervisor + 99584/96548 + grandchildren, all
  6 terminated) + incumbent `cli.mjs stop` with explicit incumbent machine
  values in child env → stopped-state written into the **correct** incumbent
  tree (`releaseSha=a02884ff…`); settled 12 s; 5001/5174 free; task `Ready`.
- Machine vars re-pointed to target dir + pin (verified by re-read).
- Replacement XML: exactly 2 string swaps (action args + workdir, occurrence
  count verified = 2), UTF-16LE+BOM preserved. The C01 encoding hazard did NOT
  recur: the capture is genuine UTF-16LE+BOM matching its UTF-16 declaration,
  so `schtasks /create … /xml … /f` accepted it **unmodified** (exit 0, the
  bytes `/query /xml` returned were tried first); registered hash
  `084B56FE…56ABE6`; re-export field-compared:
  SYSTEM/ONSTART/`PT0S`/IgnoreNew/command preserved, action+workdir = target.
- Required `Ready`, then single `schtasks /run` → task `Running`
  (supervisor 96476, children 5001→103700 / 5174→96612). Temp replacement XML,
  scratch scripts, and probe files removed (hashes kept); incumbent capture
  (`B0EF4152…`) retained operator-only until post-action QA terminal.

## Acceptance 5/5 PASS (0 blocked, 0 unperformed)

- **D1 — release identity: PASS.** Installed HEAD `80acdc25`, status
  `?? ops/runtime/logs/` only; both machine-scope values = target dir + pin;
  task action/workdir = target; supervisor-state `releaseSha=80acdc25…`,
  `sourceDir`=target, `state=running`, ownedPids 103700/96612.
  (`productPin=d44f29e0` historical.)
- **D2 — ownership: PASS.** Exactly one listener on 5001 (→103700) and one on
  5174 (→96612); both `ParentProcessId=96476`
  (`…\80acdc25-20260921\ops\runtime\cli.mjs start`, task-launched Services
  session, not an executor shell); task keeps SYSTEM / ONSTART (BootTrigger) /
  `PT0S` / IgnoreNew.
- **D3 — health, public truth, warning protection: PASS.** Local health/ready
  200, host `__host/live`+`__host/ready` 200, Tailnet health 200, subjects read
  200; published `termIndex=1` → 200 with 920 entries and distinct
  termIndex = {1}; `termIndex=bogus` → typed 400
  `{"code":"INVALID_TERM_INDEX","message":"termIndex must be 1..4, or \"active\"."}`;
  latest + run-specific violation reports → 401 pre-dispatch. No login.
- **D4 — served-artifact identity, configuration, zero write: PASS.** Served
  `/` HTML byte-equal to `dist/index.html`; all 33 referenced JS assets
  byte-equal served-vs-dist (hash-compared, 0 mismatches); served entry chunk
  SHA-256 = `BF1DF52A…7C97` (build-equal and incumbent-equal — byte-identity,
  not difference, per the corrected packet); served chunk contains the
  EnrollPro origin; dist holds only inert `VITE_SMART_SSO_START_URL` /
  `VITE_AIMS_SSO_START_URL` key references (unset → null → disabled plain
  text), no configured start-URL values; Tailnet `/` 200 serving the new
  chunk; env hash unchanged `BC7921A7…`, 17-key set unchanged; supervisor log
  `[rollover-automation] Disabled via ROLLOVER_AUTO_SYNC_ENABLED=false`;
  SMART/AIMS `/start` → typed 503 `COMPANION_SSO_NOT_CONFIGURED`, no
  Location, no Set-Cookie; post schema-wide map (46 tables) SHA-256 = pre
  `EE03F1D0…` byte-identical.
- **D5 — server artifact identity: PASS.** Running PID 103700 command line is
  `…\80acdc25-20260921\atlas-server\dist\server.js` (inside the release
  directory); its `dist/server.js` SHA-256 = `367B7B40…C4623` (the build
  output recorded before the cutover); process start 2026-09-21 17:34:09
  local postdates the cutover (task run 17:34:0x, supervisor
  startedAt 09:34:10Z); committed harness `test:actor-school-mutations`
  passed on the release tree in the build phase (tests 1 / pass 1 / fail 0,
  exit 0). **Limitation, stated explicitly:** the live mutation routes were
  deliberately NOT probed — a live `POST` to one of the eight routes can write
  if the guard is not in fact loaded, so no live behavioural proof is claimed;
  identity plus the committed harness is the evidence.

## Signature-map method (literal, with transaction scope)

- Table enumeration (inside the transaction):
  `SELECT tablename FROM pg_tables WHERE schemaname=$$public$$ ORDER BY tablename`
- Timezone pin — **first statement inside the same transaction** as every
  query below (a standalone `SET LOCAL` is a no-op and is not claimed):
  `SET LOCAL TIME ZONE 'UTC'`; scope proven by `SHOW TIME ZONE` in the same
  transaction returning `UTC` on both runs (`tz-in-tx=UTC` pre and post).
- Per table `T` (name safely quoted as `"T"` with `"` doubled; same
  transaction):
  `SELECT COUNT(*)::int AS c, COALESCE(md5(string_agg(md5(row_to_json(t)::text), $$$$ ORDER BY md5(row_to_json(t)::text))), md5($$$$)) AS s FROM public."T" t`
- Serialization: one line per table, tables in name order,
  `"<name> count=<n> sig=<md5>"`, plus a trailing newline; the recorded value
  is the SHA-256 of that whole file.
- Values: pre `EE03F1D0…65521B` (46 tables) = post `EE03F1D0…65521B`
  byte-identical. No unpinned variant was taken.

## Figures and identities

- D: free-before 37.32 GiB / projected ~0.85 GiB trees + checkout / free-after
  35.82 GiB.
- PIDs/listeners before: supervisor 102756, 5001→99584, 5174→96548. After:
  supervisor 96476, 5001→103700, 5174→96612.
- Harness tally: `test:actor-school-mutations` on the release tree —
  tests 1, pass 1, fail 0, exit 0.
- Tooling notes (disclosed, not silent): the harness prefix deny-list blocks
  bare `git worktree add`; both worktrees were created with the identical
  operation spelled `& "C:\Program Files\Git\cmd\git.exe" worktree add …`
  under this packet's §4.1 authorization (release: `--detach <path> <pin>`;
  evidence: `<path> -b release/actor-school-mutations-c01-20260921
  origin/main`), and are registered (`git worktree list` shows both).
  `git stash list` is blocked by the same deny-list (`git stash*`), so the
  stash list could not be read — recorded literally instead of claimed;
  residue is proven by the release `git status --short`
  (`?? ops/runtime/logs/` only), the clean evidence worktree, and the removal
  of all five scratch artifacts.

## Risks

- NON_BLOCKING: `git stash list` unreadable (deny-listed); stash residue
  unverified, all other residue surfaces clean.
- NON_BLOCKING: new supervisor-state omits the old `invariants` block;
  rollover-disabled proven via the supervisor log line.
- NON_BLOCKING: D4 rests on byte-identity (empty client delta rebuilds
  deterministically) — inequality was correctly not asserted.
- NON_BLOCKING: D5 is identity + harness evidence by design; live mutation
  behaviour remains unproven until an authorized live exercise exists.
- BLOCKING: none open. Rollback NOT executed (no mandatory failure).

## Rollback status

Not required, not executed. Symmetric path staged: incumbent capture
(`B0EF4152…C35C29`) retained operator-only until post-action QA terminal;
incumbent release `a02884ff` untouched and startable in place
(`dist/server.js`, `dist/index.html`, `cli.mjs`, generated Prisma client with
query engine all present); `4c7c0bd9` and `434b2a81` remain behind it.

Verdict: `REVIEW_REQUIRED` — deployed and 5/5 on the real path; awaiting fresh
independent post-action QA.

Worktree disposition: `RETIRE_AFTER_INTEGRATION` (both the release worktree,
which becomes the live runtime source, and the evidence worktree retire only
through the integration closure; the incumbent release is never retired here).
