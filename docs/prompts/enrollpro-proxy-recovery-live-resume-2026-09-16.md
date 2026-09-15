# ENROLLPRO-PROXY-RECOVERY-LIVE-RESUME-2026-09-16 — elevated HIGH execution packet

Status: **ACTIVE — approved.** The operator's exact superset approval for release
`54dce67b` is already granted and recorded in the machine-authoritative state
(`approval.granted=true`, operator `operator:njgrm`, approvedAt
`2026-09-15T12:00:04+08:00`, record `0c203423`). Do not request it again. The
elevation blocker that stopped the 2026-09-15 attempt (`9b82a98f`, zero mutation)
is resolved: the execution context is elevated and the SYSTEM task is capturable.

This packet **supplements and does not replace** the governing packet
`docs/prompts/enrollpro-proxy-recovery-live-2026-09-14.md`. The governing
packet's §2 source binding, §4 exact switch set, §5 hard exclusions, §6
acceptance matrix, §7 rollback and §9 execution record are binding. This packet
adds the resume-specific preflight, build method, capture requirements,
acceptance-row IDs, evidence shape and return contract.

Risk: **HIGH — shared-runtime environment change + release install + supervised
process restart on ports 5001/5174.**

## 1. Execution boundary (immutable)

| Item | Value |
|---|---|
| Worktree | `E:/ATLAS-worktrees/enrollpro-proxy-recovery-live-20260915` |
| Branch | `work/enrollpro-proxy-recovery-live-20260915` |
| Base | the branch tip at handoff — the `docs(planning): open the ENROLLPRO-PROXY-RECOVERY-LIVE-RESUME execution window` commit; the dispatch message names its exact SHA. It MUST equal `git rev-parse HEAD` before you edit anything, and `git status --porcelain=v2` MUST be empty. |
| Candidate | exactly **one new file you commit**: `docs/reviews/enrollpro-proxy-recovery-live-20260916/live-execution-evidence.md`. Nothing else may be created, staged or committed in this worktree. |
| Approved release | `54dce67b8392cbce09aa810813c37f9c87a67159` (product tree; ancestor pin `d44f29e04d359ad9b18e4443b0fd4fed1daeaecd` must remain an ancestor) |
| Approved install path | `D:\ATLAS-runtime-supervised-54dce67b-20260914` |
| Incumbent (rollback target) | release `D:\ATLAS-runtime-supervised-3d916b26-20260912` (HEAD `3d916b261d6a2db71b153558ac8c2d151e2fccd0`) |
| Durable env file | `D:\ATLAS-runtime-config\atlas-server.env` |
| Backup target | `D:\ATLAS-runtime-config\backups\atlas-server.env.bak-<UTCstamp>` (create `backups` if absent; outside every Git worktree) |

Forbidden in Git: no push, no merge, no rebase, no reset, no stash, no branch
changes, no worktree creation other than the approved release checkout in §4.

## 2. Approved mutation set (closed — nothing else)

1. back up the durable env file to an operator-only path outside every Git worktree;
2. set exactly `ENROLLPRO_PROXY_ORIGIN` and `ENROLLPRO_API` in `D:\ATLAS-runtime-config\atlas-server.env`;
3. build the client with `VITE_ENROLLPRO_URL` and install release `54dce67b8392cbce09aa810813c37f9c87a67159` at `D:\ATLAS-runtime-supervised-54dce67b-20260914`;
4. re-point `ATLAS_RUNTIME_SOURCE_DIR`, `ATLAS_RUNTIME_RELEASE_SHA`, and the `ATLAS-Runtime-Supervisor` task action and working directory;
5. quiesce only the supervisor-owned ATLAS processes on 5001/5174;
6. relaunch the replacement resident supervisor through `schtasks /run /tn ATLAS-Runtime-Supervisor`;
7. run the packet acceptance matrix;
8. roll back symmetrically on a mandatory failure;
9. record the bounded approval, evidence, and register docs-only records.

Any action outside this list is unauthorized. `ROLLOVER_AUTO_SYNC_ENABLED=false`
is a code-pinned contract invariant — never add it to the env file.

## 3. Mandatory preflight — STOP before mutation on any ambiguity

1. **Elevation proof.** `[Security.Principal.WindowsIdentity]::GetCurrent()` +
   `IsInRole(Administrator)` must be `True`, and
   `schtasks /query /tn "\ATLAS-Runtime-Supervisor" /xml` must succeed.
2. **Ancestry.** `git fetch origin`; confirm `54dce67b` is an ancestor of
   `origin/main` and that your worktree HEAD equals the dispatch-named base.
3. **Custody.** Machine state shows this stream's executor lease `ACTIVE` and no
   other stream owns your worktree. No other registry writer is active.
4. **Task capture (elevated).** `schtasks /query /tn "\ATLAS-Runtime-Supervisor"
   /xml` → save to `%TEMP%`; `schtasks /query /tn "\ATLAS-Runtime-Supervisor" /fo
   LIST /v`. Capture the incumbent definition exactly: principal `S-1-5-18`
   (SYSTEM), `HighestAvailable`, boot trigger (ONSTART), `ExecutionTimeLimit`
   `PT0S`, `MultipleInstancesPolicy` `IgnoreNew`, action
   `"C:\Program Files\nodejs\node.exe" "<incumbent>\ops\runtime\cli.mjs" start`,
   working directory `<incumbent>`. If the captured incumbent differs
   materially from this packet's §1, STOP and report.
5. **Incumbent identity (live, never assumed).** From the task, the supervisor
   process (`node ... cli.mjs start`), and
   `<incumbent>\ops\runtime\logs\supervisor-state.json`: record supervisor PID,
   parent PID, child PIDs for 5001/5174, `state`, `releaseSha`, `sourceDir`.
6. **Listeners.** Exactly one supervisor-owned PID listening on each of 5001 and
   5174, matching the state file. Anything else → STOP.
7. **Probes.** Local `http://127.0.0.1:5001/api/v1/health` and
   `/api/v1/health/ready` 200; host `http://127.0.0.1:5174/__host/live` 200 and
   two consecutive `__host/ready` 200; Tailnet
   `https://njgrm.buru-degree.ts.net/api/v1/health` 200; direct
   `https://dev-jegs.buru-degree.ts.net/api/settings/public` 200 and
   `/api/integration/v1/health` 200; ATLAS
   `http://127.0.0.1:5174/enrollpro-api/settings/public` currently **502**
   (the defect being repaired). Two consecutive EnrollPro probes PASS ⇒ proceed.
   If EnrollPro is unreachable, STOP before any mutation (EXTERNAL blocker).
8. **Env metadata only.** Record the full pre-change key-name → value-SHA-256
   map of the durable env file (13 keys expected) and the file size + mtime.
   Never print or commit any value.
9. **DB baseline (read-only).** With `DATABASE_URL` loaded into the child
   process env (never printed), record `count(*)` for `audit_logs` and
   `_prisma_migrations`. Example from the release root (after §4 install):
   `node -e "require('dotenv').config({path:'D:/ATLAS-runtime-config/atlas-server.env',quiet:true});const{Client}=require('pg');(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();const a=await c.query('select count(*)::int n from audit_logs');const m=await c.query('select count(*)::int n from _prisma_migrations');console.log(JSON.stringify({audit:a.rows[0].n,migrations:m.rows[0].n}));await c.end()})()"`.
   Read-only. No schema/migration/seed/write command.
10. **Custody note (carried from the r2 audit).** N-3: with `IgnoreNew`, confirm
    the task instance is no longer `Running` before `schtasks /run`. N-4: task
    query/re-point/run require elevation — confirmed in step 1.

## 4. Build and install (no listener, env-file, or task mutation in this phase)

1. Create the release checkout: from your worktree run
   `git worktree add --detach D:/ATLAS-runtime-supervised-54dce67b-20260914 54dce67b`.
   Verify `git -C D:\ATLAS-runtime-supervised-54dce67b-20260914 rev-parse HEAD`
   equals `54dce67b8392cbce09aa810813c37f9c87a67159` and that its
   `git status --porcelain=v2` is empty (build outputs are ignored).
2. Install dependencies separately in each of the three trees — **no junction
   reuse, no install through a shared tree, never modify the incumbent release
   directory**:
   - `npm ci` in the release root, `npm ci` in `atlas-server`, `npm ci` in `atlas-client`.
   - Run each with `DATABASE_URL` present in the child process environment
     (Prisma config resolves `env("DATABASE_URL")`); never print the value.
3. Generate the Prisma client from `prisma/schema.prisma` and **ensure both**
   `<release>/node_modules/.prisma/client` and
   `<release>/atlas-server/node_modules/.prisma/client` exist and were generated
   from this schema (mirror the incumbent layout — the server resolves
   `@prisma/client` from its own tree). Recommended: `npx prisma generate` from
   the release root (root CLI + `prisma.config.ts`), verify
   `node_modules/.prisma/client/index.js`, then either run a second generate
   from `atlas-server` or copy the generated `.prisma` directory into
   `atlas-server/node_modules/`. Verify both `index.js` files exist and are
   non-trivial before building.
4. Build the server: `npm --prefix atlas-server run build` (= `tsc`). Verify
   `atlas-server/dist/server.js` exists.
5. Build the client **with the explicit companion origin**:
   set `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net` in the build
   process environment and run `npm --prefix atlas-client run build`
   (= `vite build`). Never use a raw IP. Do not set
   `VITE_ENROLLPRO_SSO_START_URL` (the reverse start derives from the origin).
   Verify `atlas-client/dist/index.html` and `atlas-client/dist/assets/*` exist.
6. Static checks only — do NOT run suites that bind 5001/5174 or start the
   runtime; do not run `runtime:test` e2e flows. `tsc`/`vite build` success plus
   the §6 live matrix is the proof.

## 5. Re-point, quiesce and relaunch (exact order)

1. **Env backup** (§1 backup target). Verify byte-identity with the original and
   record absolute path, size, SHA-256. Never print values.
2. **Env edit — exactly two changes.** In
   `D:\ATLAS-runtime-config\atlas-server.env`:
   - add `ENROLLPRO_PROXY_ORIGIN=https://dev-jegs.buru-degree.ts.net` (bare origin, no path);
   - change `ENROLLPRO_API` to `https://dev-jegs.buru-degree.ts.net/api`.
   Preserve every other key, ordering and file format. Post-change, record the
   key-name → value-SHA-256 map again and prove exactly one key was added and
   exactly one value changed.
3. **Machine environment.** `setx /M ATLAS_RUNTIME_SOURCE_DIR
   "D:\ATLAS-runtime-supervised-54dce67b-20260914"` and `setx /M
   ATLAS_RUNTIME_RELEASE_SHA "54dce67b8392cbce09aa810813c37f9c87a67159"`.
   Verify by reading `HKLM\SYSTEM\CurrentControlSet\Control\Session
   Manager\Environment` and `[Environment]::GetEnvironmentVariable(...,'Machine')`.
   Keep `ATLAS_RUNTIME_ENV_FILE` and log-directory settings unchanged.
4. **Task re-point.** Export the task XML, replace only the action path and
   working directory with the new release, `schtasks /Create /F /TN
   "\ATLAS-Runtime-Supervisor" /XML <temp>` (temp under `%TEMP%`, removed
   afterwards), then re-query `/xml` and capture: `S-1-5-18`, `HighestAvailable`,
   boot trigger, `PT0S`, `IgnoreNew`, new action + new working directory.
5. **Quiesce (owned processes only).** Record incumbent identity first.
   `node <incumbent>\ops\runtime\cli.mjs stop` invoked with the **incumbent**
   `ATLAS_RUNTIME_SOURCE_DIR` / `ATLAS_RUNTIME_RELEASE_SHA` /
   `ATLAS_RUNTIME_ENV_FILE` values set in the child process environment (the
   machine values now name the new release); then terminate the resident
   supervisor tree with `taskkill /PID <incumbentSupervisorPid> /T /F`; wait at
   least 10 seconds; poll until **no listener** remains on 5001/5174. If any
   unknown listener remains, STOP and report — never broad-kill. Confirm the
   task instance is no longer `Running` (N-3).
6. **Relaunch through the durable owner only.**
   `schtasks /run /tn "ATLAS-Runtime-Supervisor"`. Never invoke
   `cli.mjs start` from your shell. Then poll (≤ 120 s) until local
   `/api/v1/health` and `/api/v1/health/ready` are 200; read the new
   `<newRelease>\ops\runtime\logs\supervisor-state.json`; capture supervisor PID,
   parent PID, child PIDs. The supervisor MUST NOT be a descendant of your shell
   or session. If the launch fails closed with `ENROLLPRO_PROXY_ORIGIN_MISSING`,
   do not bypass the gate: fix the environment or roll back per §7.
7. **Acceptance matrix** (§6) with raw status codes, then §8 evidence commit.

## 6. Acceptance matrix — all rows mandatory

Source rows (MANDATORY_SOURCE, 4):

- **S1 Release identity.** `D:\ATLAS-runtime-supervised-54dce67b-20260914` is a
  clean checkout at exactly `54dce67b…`; `rev-parse HEAD` equals it; no tracked
  modifications.
- **S2 Env backup.** Backup exists outside every Git worktree, byte-identical to
  the pre-change file (recorded path + size + SHA-256); pre-change metadata map
  captured.
- **S3 Env delta.** Exactly two keys changed (one added, one value changed); all
  other key/value hashes identical; `ROLLOVER_AUTO_SYNC_ENABLED` not present as
  an enabled value anywhere.
- **S4 Built artifacts.** `atlas-server/dist/server.js` and
  `atlas-client/dist/index.html` + assets exist and were built from that tree;
  the exact client build invocation with `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net`
  is recorded.

Live rows (MANDATORY_LIVE, 16):

- **L1** Local `GET /api/v1/health` 200.
- **L2** Local `GET /api/v1/health/ready` 200 (database `ok`).
- **L3** Host `GET /__host/live` 200.
- **L4** Host `GET /__host/ready` two consecutive 200.
- **L5** Tailnet `GET https://njgrm.buru-degree.ts.net/api/v1/health` 200.
- **L6** ATLAS `GET /enrollpro-api/settings/public` 200 with canonical-body
  parity to direct `https://dev-jegs.buru-degree.ts.net/api/settings/public`
  (parse both, compare stable stringify; record both canonical SHA-256s).
- **L7** `/enrollpro-uploads/...` pass-through non-502 (record exact path + status;
  a 200/404 from upstream is acceptable; choose a path from the settings payload
  if present, e.g. `/enrollpro-uploads/<logo-path>`).
- **L8** Continuity: SPA `GET /` 200 (built index) and one ATLAS API call 200.
- **L9** Ownership: exactly one supervisor-owned PID per port 5001/5174 matching
  the new supervisor state; the resident supervisor is not a descendant of the
  invoking shell/session.
- **L10** Supervisor state `running` with `releaseSha=54dce67b…`; `git -C
  <newRelease> rev-parse HEAD` equals it.
- **L11** Rollover automation remains disabled (`ROLLOVER_AUTO_SYNC_ENABLED=false`
  invariant; no rollover auto-sync activity).
- **L12** Logs bounded and redacted: new bounded logs under
  `<newRelease>\ops\runtime\logs`, no secret values, no unbounded console noise.
- **L13** DB delta zero: `audit_logs` and `_prisma_migrations` counts unchanged
  before vs after; no login occurred; no other write.
- **L14** Task identity: principal SYSTEM, ONSTART, `PT0S`, `IgnoreNew`
  preserved, and action + working directory point to the new release.
- **L15** Post-shell survival: after your shell/session returns, a later
  independent shell still observes the same supervisor PID owning 5001/5174 with
  health/ready 200. Record the pre-return PID and the exact observation method
  (the independent re-probe itself is executed by fresh QA).
- **L16** Served client bundle: `GET /` plus each JS asset it references contain
  `dev-jegs.buru-degree.ts.net` and contain neither `100.88.55.125` nor
  `100.120.169.123`.

## 7. Rollback (symmetric; on any mandatory failure)

Follow governing packet §7 with the same durable owner:
1. quiesce the new-release supervisor (owned `cli.mjs stop` with the new
   release's env values → terminate the resident tree → confirm no listener;
   never broad-kill);
2. restore the env backup byte-for-byte;
3. restore machine `ATLAS_RUNTIME_SOURCE_DIR` / `ATLAS_RUNTIME_RELEASE_SHA` to
   the preflight incumbents;
4. re-point the task action + working directory back to
   `D:\ATLAS-runtime-supervised-3d916b26-20260912`;
5. relaunch via `schtasks /run /tn "ATLAS-Runtime-Supervisor"`;
6. prove task identity, one owner per port, health/ready/Tailnet 200.
Record the rollback actions performed and the final state honestly. Rollback
restores continuity even though the old release's `/enrollpro-api` remains 502.

## 8. Evidence commit (the single candidate)

Commit exactly one new file:
`docs/reviews/enrollpro-proxy-recovery-live-20260916/live-execution-evidence.md`
with: preflight identity + probe results + the exact directive SHA-256 you read;
env backup path/size/SHA-256 and the pre/post key-hash maps (names and hashes
only); release dir, `rev-parse HEAD`, install/build transcript excerpts and the
exact client build invocation; task captures before and after; machine env
before/after; quiesce + start transcript (bounded); the §6 matrix with per-row
PASS/FAIL and raw status codes; DB counts before/after; rollback record if used;
an explicit statement that no excluded action occurred; and the final live
identity (supervisor PID, children, `releaseSha`, state). Never include secret
values. Commit with a conventional message; do not amend; do not push.

## 9. Hard exclusions

Port 5175 and unrelated processes; Tailscale Serve; EnrollPro/AIMS/SMART
runtimes; databases/schema/migrations/seed commands (read-only counts only);
migrations 0002/0003 apply; any login or authenticated session; term-cache
capture/apply; Teaching Load/suggestion/carry-forward apply; generation;
publication; any other environment key; any other Windows task; Git
push/merge/rebase/reset/stash; worktree creation beyond §4.1; any modification
of the incumbent release directory; any modification of `D:\ATLAS` source; the
preserved dirty worktree `E:/ATLAS-worktrees/tl-operator-workspace-c05` must not
be touched; no edits outside the §1 candidate path.

## 10. Return contract

Return one terminal report: base SHA, candidate SHA, exact changed paths, the
per-class acceptance tally (`MANDATORY_SOURCE n/4`, `MANDATORY_LIVE n/16`,
blocked, unperformed), decisive evidence, known risks, `REVIEW_REQUIRED`. Do not
self-approve, merge, or push. If a mandatory row fails and rollback executed,
return the rollback record and the exact blocked result instead.
