# ATLAS Staging Runtime (Runbook)

Owner: **Lane A4** (`AGENTS.md` §14). Staging exists so a candidate can be seen
rendered in minutes, before it is ever proposed for the live runtime.

> Staging is **not** production. It holds a copy of production data. Never run
> generation, publication, migration, or any destructive Teaching Load action
> against it and never point it at a real companion write.

## Topology at a glance

| | Live | Staging |
|---|---|---|
| Task | `ATLAS-Runtime-Supervisor` | `ATLAS-Staging-Supervisor` |
| API | 5001 | **5101** |
| Client host | 5174 | **5274** |
| URL | `https://njgrm.buru-degree.ts.net` | `http://127.0.0.1:5274` |
| Release dir | `E:\ATLAS-worktrees\lane-a4-release-20260928-1` | `E:\ATLAS-staging\<sha>` |
| Contract | `…\ops\runtime\runtime-contract.json` | same file, **staging contract** |
| Env file | `D:\ATLAS-runtime-config\atlas-server.env` | `D:\ATLAS-runtime-config\atlas-staging.env` |
| Database | `atlas_recovery_clean_rebuild_20260905` | `atlas_staging` (dump copy) |
| Rollback | `4c35cc8f` | re-deploy any earlier sha |

## How the isolation actually works

Four independent mechanisms. Any one alone would be a single point of failure.

1. **Ports come from the contract inside the deployed source directory.**
   `ops/runtime/lib/contract.mjs` resolves `DEFAULT_CONTRACT_PATH` relative to
   itself, so a release directory *is* its own contract. `deploy-staging.ps1`
   installs `ops/staging/staging-contract.json` (ports 5101/5274) into the staging
   release directory. The live contract in the live release directory is never
   read by staging and never written by this lane.
2. **Machine scope is never written.** `ATLAS_RUNTIME_SOURCE_DIR`,
   `ATLAS_RUNTIME_RELEASE_SHA` and `ATLAS_RUNTIME_ENV_FILE` are a single global
   namespace shared with live. `E:\ATLAS-staging\staging-supervisor.cmd` sets all
   three **inside its own process** and then execs the staging `cli.mjs`. Nothing
   in `ops/staging/` calls `SetEnvironmentVariable(…,'Machine')`.
3. **Separate durable env file and a separate database.** `atlas-staging.env`
   differs in `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CLIENT_URL` and
   `CORS_EXTRA_ORIGINS`. The database is a `pg_dump | pg_restore` copy, so staging
   writes cannot reach live data even if a code path tried.
4. **Separate scheduled task.** `ATLAS-Staging-Supervisor` runs as SYSTEM at
   startup, so staging survives a reboot independently of live.

`JWT_SECRET` is freshly generated, so a staging session cannot be replayed against
live and a live session cannot be replayed against staging. The EnrollPro/SMART/AIMS
credentials are deliberately **unchanged** — those are read-only companion keys.

## Deploy a candidate

```powershell
# dry run: prints the plan, mutates nothing
.\ops\staging\deploy-staging.ps1 -Sha <40-char-sha>

# real deploy: worktree -> deps -> contract -> env -> DB refresh -> build -> task -> health
.\ops\staging\deploy-staging.ps1 -Sha <40-char-sha> -Execute
```

One command delivers a candidate **with current data**, because the database is
re-snapshotted from live as part of the deploy. Useful switches:

| Switch | Effect |
|---|---|
| `-SkipDbRefresh` | keep the existing `atlas_staging` contents (faster; staging writes survive) |
| `-SkipBuild` | re-point the runtime at an already-built tree |
| `-RotateJwtSecret` | invalidate all staging sessions (default: sessions **survive** a redeploy) |
| `-EnrollProOrigin <url>` | companion origin baked into the client build (non-secret) |

Budget: ~25 s to seed dependencies, then the two builds. The `Mark` timeline in
the result JSON gives the real per-step cost.

A first staging deploy needs roughly **0.9 GiB** on `E:` for the three owned
dependency trees. Check free space before it — §3 warns below 25 GiB and fails
closed below 15 GiB.

## What the deploy script refuses

`ops/staging/staging-guards.ps1` holds the pins. They run in preflight, **before
the dry-run return**, so a refusal is identical with and without `-Execute`, and
long before any mutation — before the mutex, the worktree, the dependency seeds,
the env-file write, the database refresh, the task stop or the `schtasks /create`.
Every refusal is `STAGING_DEPLOY_STOP: <TOKEN>: <detail>`.

| Token | Refused |
|---|---|
| `TASK_NAME_LIVE_DENYLIST` | `-TaskName ATLAS-Runtime-Supervisor` (also `\ATLAS-Runtime-Supervisor`, any case) and `ATLAS-DevServer-Temp2`. Scheduled tasks are one global namespace, so this would stop and then overwrite the live task. |
| `TASK_NAME_NOT_STAGING` | any name that is not `ATLAS-Staging` or `ATLAS-Staging-<instance>` — including `ATLAS-Staging-Supervisor-evil`. |
| `TASK_NAME_EMPTY` | empty or whitespace-only `-TaskName`. |
| `RELEASE_ROOT_OUTSIDE_STAGING` | a resolved `-ReleaseRoot` outside `E:\ATLAS-staging`: a live release root, `D:\ATLAS`, the sibling trap `E:\ATLAS-staging-evil`, or `E:\ATLAS-staging\..\…` resolved **after** normalisation. |
| `RELEASE_ROOT_NOT_ABSOLUTE` | a relative, UNC, device or wildcard `-ReleaseRoot`. |
| `STAGING_ENV_LIVE_LEAF` | `-StagingEnvFile …\atlas-server.env`, i.e. the live env file. |
| `STAGING_ENV_LEAF_MISMATCH` | any leaf other than `atlas-staging.env`. |
| `STAGING_ENV_NOT_ABSOLUTE` | a relative, UNC, device or wildcard `-StagingEnvFile`. |
| `STAGING_ENV_IS_LIVE_ENV` | a `-StagingEnvFile` that **resolves** to the live env file named by `-LiveEnvFile`, even under a differently-cased or dotted spelling that survives the leaf checks. |
| `LIVE_ENV_NOT_ABSOLUTE` | a relative, UNC or wildcard `-LiveEnvFile`. Fail-closed: the script will not compare paths it cannot resolve. |
| `STAGING_ROOT_ANCHOR_INVALID` | the **pinned anchor itself** `E:\ATLAS-staging` is not resolvable. Defence in depth — a broken host, not an operator input. |

This table is the complete set of tokens the guard module can throw; the last
three are the resolved-path and anchor checks that run *after* the shape checks.

The staging env file default is `D:\ATLAS-runtime-config\atlas-staging.env` and
stays valid — do not relocate it, the launcher already points there.

**No credential or companion-origin value is ever printed.** The client-build
timeline line reports the *key name* and whether it was set
(`VITE_ENROLLPRO_URL key set: true`), never the origin. A failed build is scrubbed
of the origin before its last output lines are surfaced, the same way
`Invoke-PgTool` scrubs the database password. Database names, ports, file paths
and key names are not secrets and do appear in the plan and result JSON.

`-Execute` still requires an elevated Administrator PowerShell. The **dry-run does
not** and is read-only, so the guard gate below needs no privilege.

## Guard gate

```powershell
npm run test:staging-guards
```

`ops/staging/__tests__/deploy-staging-guards.test.mjs` drives the real script in
dry-run and asserts each refusal above, plus the positive controls (default
parameters still print a plan and exit 0; `-ReleaseRoot 'E:\ATLAS-staging\'` with
a trailing separator is accepted). Rows that must hold regardless of host state
dot-source `staging-guards.ps1` as pure functions in a child PowerShell — the
documented non-mutating entry point. Nothing in the suite mutates disk, the task
scheduler, or a database.

## Refresh the database on demand

```powershell
.\ops\staging\refresh-db.ps1              # plan only
.\ops\staging\refresh-db.ps1 -Execute
```

Drops and recreates `atlas_staging`, restores from a fresh `pg_dump`, and then
**proves the live signature did not change** (`max(audit_logs.id)`, row count and
`_prisma_migrations` count, before and after). The script aborts if the target
name ever equals the live database name, and it never runs a migration command.

## Health

```powershell
Invoke-WebRequest http://127.0.0.1:5101/api/v1/health          -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:5101/api/v1/health/ready     -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:5274/__host/live             -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:5274/__host/ready            -UseBasicParsing
Invoke-WebRequest 'http://127.0.0.1:5101/api/v1/subjects?schoolId=1' -UseBasicParsing
```

`/api/v1/health` is **liveness only** (§6). The `subjects` call is the
DB-backed read; readiness also verifies the database. Prove a deploy with a
marker that only exists in the new build — a healthy `/health` on the old release
looks identical to a successful deploy.

Runtime identity, from the active staging release directory only:

```powershell
Get-Content E:\ATLAS-staging\<sha>\ops\runtime\logs\supervisor-state.json
```

`cli.mjs status` reads an in-memory map that is empty out-of-process and will
report `live: false` on a perfectly healthy runtime. That is a known false-alarm
trap, not a defect.

## Signing in

The operator signs in at `http://127.0.0.1:5274` once per browser profile.
**Runners never type credentials.** With no session, report
`NEEDS_SESSION(<agent>/<profile>)` and continue with the other rows.

Because `JWT_SECRET` is staging's own, a session seeded on the Tailnet live origin
is *not* valid here — and a session seeded here is *not* valid on live. Loopback
staging evidence is explicitly **isolated** evidence, never ATLAS production
acceptance (`AGENTS.md` §12).

## What staging must never do

- Never write the live database — it has no connection string to it.
- Never stop, restart, or reconfigure the live supervisor or its task.
- Never write machine-scope runtime variables.
- Never run a migration, generation, or publication. Staging's schema comes from
  the dump, not from `prisma migrate`.
- Never be mistaken for acceptance: rows gathered here prove a candidate renders,
  not that production is correct.

## Retention and teardown

```powershell
schtasks /end   /tn ATLAS-Staging-Supervisor
schtasks /delete /tn ATLAS-Staging-Supervisor /f
# then, only after the task is gone:
git worktree remove E:\ATLAS-staging\<sha>
git worktree prune
```

Each staging release **owns** its dependency trees. There are deliberately **no
`node_modules` junctions**: a junction chain rooted at a retired release has
already taken this runtime down once (`docs/reference/agent-worktree-lifecycle.md`).
Retire a staging release only with the audited reclaim path — never `--force`,
never a glob.
