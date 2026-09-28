# A4 STAGING — pre-action packet (2026-09-28)

Lane A4, elevated, fresh session. Executing `docs/prompts/a4-staging-2026-09-28.md`.
**This is a HIGH action**: new scheduled task, new durable env file with a new
secret, new database, new deployment target. It is reviewed before it runs and
independently after.

## Authority

The operator approved staging on 2026-09-28 ("work on all the failures",
answering Lane C's staging proposal), recorded in the packet header. This cycle
creates a **new isolated environment**; it does not modify the live release, the
live task, the live database, or machine scope. A "yes, deploy" is not required
again for the staging-only sub-steps, but the HIGH gate below is not waived.

## Target, delta, rollback (AGENTS.md §13)

| | |
|---|---|
| **Exact target** | `7590d485974337f834aa3972bb128090e6067b8d` — the commit **already live** on 5001/5174 |
| **New artifacts** | `E:\ATLAS-staging\7590d485…\` (release dir), `D:\ATLAS-runtime-config\atlas-staging.env`, DB `atlas_staging`, task `ATLAS-Staging-Supervisor`, `E:\ATLAS-staging\staging-supervisor.cmd`, `active-release.txt` |
| **New source** | `ops/staging/{staging-common.ps1,staging-contract.json,refresh-db.ps1,deploy-staging.ps1}`, `docs/runbooks/staging.md` |
| **Delta to live** | **none.** Live stays on `7590d485`, ports 5001/5174, task `ATLAS-Runtime-Supervisor`, machine scope unchanged |
| **Rollback** | `schtasks /delete /tn ATLAS-Staging-Supervisor /f`; kill the staging tree; `DROP DATABASE atlas_staging`; `git worktree remove E:\ATLAS-staging\<sha>`. Live is not a participant, so live rollback is not in scope. |

## Baseline captured BEFORE any mutation

`C:\ProgramData\ATLAS\staging-audit\baseline-before.json`, 2026-09-28T09:01:18Z:

- live DB `atlas_recovery_clean_rebuild_20260905`: `audit_logs` max id **1010**, count **459**, `_prisma_migrations` **11**
- live listeners: 5001 → PID **3516**, 5174 → PID **60116**
- machine scope: source `E:\ATLAS-worktrees\lane-a4-release-20260928-1`, release `7590d485…`, env `…\atlas-server.env`

This exists because the previous A4 release shipped D7 `PARTIAL` — the zero-write
baseline was never captured and that before/after is now permanently
unrecoverable. Do not repeat it.

## Design decisions a reviewer must challenge

1. **Ports are not an env var; they are the contract, and the contract lives in
   the release directory.** `cli.mjs` has no contract-path flag, but
   `loadContract` resolves `DEFAULT_CONTRACT_PATH` relative to `lib/contract.mjs`,
   which is inside the deployed source dir. Installing a staging contract into the
   staging release dir isolates the ports with **zero** change to the live
   contract. `buildTargets` forces `PORT` from `contract.ports.server` and points
   the client host at `http://127.0.0.1:<that port>`, so the staging UI cannot
   proxy to live even if a browser resolves the wrong host.
2. **Machine scope is a single global namespace** — live and staging would collide
   on the same three variable names. So staging uses a `.cmd` launcher that sets
   them per-process. `ops/staging/` contains **no**
   `SetEnvironmentVariable(…,'Machine')` call. Challenge this.
3. **No `node_modules` junctions.** The packet suggested "junction deps as the
   last good release", but the live release dir is a *numbered release slot the
   next train reuses*. A junction chain rooted at a retired release has already
   downed this runtime once. Measured cost of owning the trees: **0.87 GiB**,
   **24.5 s**. That is a deliberate, recorded deviation from the packet's
   suggestion.
4. **`CLIENT_URL` and `CORS_EXTRA_ORIGINS` are also changed**, beyond the packet's
   three keys. The host proxies `/api` server-side, so the browser is same-origin
   and CORS likely never binds here; this is a harmless **superset** (live's
   existing origins are preserved, staging's is added), kept so a direct-to-5101
   client is not refused. The claim that the browser row is *impossible* without it
   is **withdrawn** — it was overstated. `ENROLLPRO_PROXY_ORIGIN` is now genuinely
   applied (it was previously accepted and discarded, so `-EnrollProOrigin`
   advertised a control that did not exist), defaulting to the live value so
   staging cannot diverge from the origin the bundle was built against.
5. **Companion credentials unchanged** — the packet requires staging to read
   EnrollPro/SMART/AIMS with the same keys and never write.
6. **The staging release directory will be `git status` dirty by design**, in
   exactly two places: the installed `ops/runtime/runtime-contract.json` and the
   untracked `ops/runtime/logs/`. Both are staging-local runtime artifacts.
   `deploy-staging.ps1` does not assert a clean tree; it asserts zero reparse
   points. Challenge whether that is the right check.

## Round 1 — pre-action review `CORRECTION_REQUIRED` (tally 8/21 passed, 0 blocked, 11 unperformed, 2 failed)

Four BLOCKING. All four are fixed additively; nothing was removed from evidence.

| ID | Finding | Fix |
|---|---|---|
| **B1** | `pg_restore` was given the archive as `-f` (its **output** option) and `-l <file>` (a flag), with no positional input. It would overwrite the dump it was restoring from, and the DB would be left empty. | Archive is now the **positional** argument; the pipeline helper drops `-f`/`-l` entirely. |
| **B2** | `schtasks /query` on a missing task exits 1 and writes stderr; under `$ErrorActionPreference='Stop'` with `2>&1` that is a terminating `NativeCommandError`. This is the **first-run path**, so the deploy died at step 8 — after the DB was dropped/restored and the build ran, before the task was created. | `Test-TaskExists` / `Stop-TaskIfPresent` helpers with `EA=Continue` + `try/catch`, returning `$false` instead of throwing. |
| **B3** | The staging env file was **written before** its ACL was applied, so a fresh `JWT_SECRET` plus the live DB password sat in a file carrying the directory's inherited DACL (`Authenticated Users: Modify`) until `Set-Acl` ran — and a local user could pre-create the name. | Create **empty** → `Set-Acl` → write. |
| **B4** | A full `pg_dump -Fc` of the live DB (JWT secret, system token, both SSO client secrets, service token, password hashes) was written to `C:\ProgramData\ATLAS\staging-audit` (inherited `BUILTIN\Users: ReadAndExecute` + `Write`) and never deleted. | The archive is **streamed** `pg_dump -Fc \| pg_restore` and never touches disk; the audit dir is re-ACLed to the live env file's principals. |

Non-blocking defects also fixed: **N1** `prisma generate` now reads the **release's own**
schema, not the dev worktree's; **N2** `-EnrollProOrigin` now actually applies; **N6** the
build now runs *before* the quiesce, and the quiesce now happens *before* the contract, env
file and database are rewritten, so a redeploy no longer drops a running server's database out
from under it; **N7** scalar reads are selected by shape (`^\d+\|\d+\|\d+$`) not by stream
index, so a psql `NOTICE` on stderr can no longer be parsed as the live signature; **N10** a
named mutex `Global\ATLAS-StagingDeploy` blocks concurrent `-Execute` runs.

Accepted as residual, with reasons: **N3** (row split, below), **N4** (harness strengthened,
below), **N5** (source now committed — see Round 2 base), **N8** (X10 compares before/after
around the refresh rather than against the fixed 09:01:18Z baseline, which a concurrent live
sign-in would perturb), **N9** (no live key value begins or ends with a quote), **N11**
(claim 4 softened above).

## Round 2 acceptance rows added by the reviewer

| # | Row | Harness | Why added |
|---|---|---|---|
| X16a | `/__host/live` 200 judged once | HTTP on 5274 | **N3**: the old X16 bundled `/__host/ready`, which `production-host.mjs` derives by probing `/api/v1/health/ready` — it double-counted X15 |
| X18a | Observed 5274 → `127.0.0.1:5101` established connections, and **none** to 5001 | `Get-NetTCPConnection -RemotePort` | **N4**: the old harness restated design claim 1 and could not fail independently |
| **M1** | Live `audit_logs` signature re-checked **after** staging is up | `psql` after the cutover | The old X10 was measured *before* the runtime existed, so the highest-consequence risk — the staging UI writing live — was never observed after exercise |
| **M2** | Live release **tree** unmodified | `git -C <live dir> status --short` + HEAD | Only listeners/machine scope/task were asserted, yet `robocopy` reads the live release's `node_modules` |
| **M3** | Staging server read the **staging** env file and staging release dir | secret-free `Environment reference:` line in `atlas-supervisor.log` | A server that silently fell back to the live env file would look perfectly healthy |

## Acceptance rows, with the deciding harness

Every row names the harness that decides it (§11). A row needing a browser or a
deployed build is a **browser/deployment row**, not a source row.

| # | Row | Harness | Decides |
|---|---|---|---|
| P1 | Packet + scripts + satisfiability lint pass | independent pre-action reviewer | `CORRECTION_REQUIRED` / clear |
| X1 | `E:` free space ≥ 25 GiB before seeding | `Get-PSDrive E` | measured 35.29 → 33.77 GiB |
| X2 | Staging release dir is a **registered worktree** at the SHA, HEAD == SHA | `git worktree list --porcelain` + `git rev-parse HEAD` | §12 |
| X3 | Installed contract has ports 5101/5274, rollover auto-sync **false**, `ATLAS_SUPERVISED` true | `ConvertFrom-Json` on the installed file | §3 invariant |
| X4 | Staging env `DATABASE_URL` database name == `atlas_staging` and **≠ live** | parsed, name only | isolation |
| X5 | Staging env `JWT_SECRET` **≠** live `JWT_SECRET` | hashed comparison, no value printed | cross-origin replay |
| X6 | Staging env ACL == live env ACL | `Get-Acl` on both | secret containment |
| X7 | No `SetEnvironmentVariable(...,'Machine')` anywhere in `ops/staging/` | `Select-String` over the tree | live identity |
| X8 | Zero reparse points in the staging release dir | `Get-ChildItem -Attributes ReparsePoint` | no chained junctions |
| X9 | `atlas_staging` created and populated | `psql` count + `pg_restore` exit | §packet 2 |
| X10 | **Live DB signature unchanged** (max id 1010, count 459, migrations 11) | `psql` before/after | zero-write |
| X11 | Live listeners still 5001→3516, 5174→60116 | `Get-NetTCPConnection` | live untouched |
| X12 | Live machine scope unchanged | machine-scope read | live untouched |
| X13 | `ATLAS-Staging-Supervisor` registered, SYSTEM, at startup | `schtasks /query /v` | reboot survival |
| X14 | Staging liveness 200 | `GET /api/v1/health` on 5101 | readiness |
| X15 | Staging readiness 200 | `GET /api/v1/health/ready` on 5101 | DB + deps |
| X16 | Staging host live + ready 200 | `GET /__host/live`, `/__host/ready` on 5274 | client host |
| X17 | **DB-backed read 200** | `GET /api/v1/subjects?schoolId=1` on 5101 | §6 rule |
| X18 | Staging client proxies to staging API, not live 5001 | `ATLAS_HOST_API_TARGET` from the contract port | isolation |
| X19 | Deploy time ≤ 10 min | `Mark` timeline in the result JSON | §packet 4 |
| X20 | Browser: operator signs in at `http://127.0.0.1:5274` once; runners never type credentials | **browser row**, operator | §12 |

**Not claimed, and explicitly out of scope:** production acceptance, migration,
generation, publication, any live Teaching Load write, and any Tailnet reachability
for staging. A Tailnet path is optional in the packet; A4 is not building one, and
loopback staging evidence is labelled `isolated` and is never ATLAS acceptance.

## Standing hazards for the executor

- Never run a server in a foreground command.
- Never print a credential; `Get-PgConnection` returns a password property for
  in-process `PGPASSWORD` injection only and must never be serialised.
- Never `taskkill` a PID that is not a staging-owned descendant of the staging
  task.
- Never write machine scope.
- Never run `prisma migrate` / `db push` — staging's schema comes from the dump.
- A staging port that does not clear after quiesce is a hard stop, not a retry.
