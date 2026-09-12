# RUNTIME-SUPERVISION-LIVE-INSTALL-RESTORE-2026-09-12 — Deployment Evidence

## Approval and scope

- Operator HIGH approval sentence received **2026-09-12**. The operator explicitly
  confirmed the database target `localhost:5432/atlas_recovery_clean_rebuild_20260905`.
- Governing packet: `docs/prompts/runtime-supervisor-live-install-restore-2026-09-12.md`.
- Accepted base (current `origin/main`): `f52e4b1ec0a23f581d43cc924be3a8dcea7321da`.
- Risk: HIGH — deploy-as-restore shared-runtime install during a confirmed outage
  (no incumbent to stop).
- Execution identity: elevated Administrator
  (`WindowsPrincipal.IsInRole(Administrator) = True`). Elevation precondition
  satisfied; no non-admin fallback was taken.

## Frozen identity

| Item | Value |
|---|---|
| Supervisor release (deployed HEAD) | `9d2938791460c1d19059e5eddd30d7bba623fdad` |
| Product pin | `d44f29e04d359ad9b18e4443b0fd4fed1daeaecd` |
| Durable source dir | `D:\ATLAS-runtime-supervised-20260912` |
| Durable env file | `D:\ATLAS-runtime-config\atlas-server.env` |
| Startable fallback | `D:\ATLAS-runtime-fallback-d44-20260912` at `d44f29e0` (not needed) |
| Ports | 5001 (server), 5174 (production host) only |

## BEFORE signatures (pre-mutation, 2026-09-12)

| Item | BEFORE |
|---|---|
| Listeners 5001 / 5174 | EMPTY |
| Local `http://localhost:5001/api/v1/health` | no connection |
| Tailnet `https://njgrm.buru-degree.ts.net/api/v1/health` | 502 |
| Task `ATLAS-Runtime-Supervisor` | absent (query exit 1) |
| Task `ATLAS-DevServer-Temp2` | Ready, enabled |
| `D:\ATLAS-runtime-config` | absent |
| `ops\runtime\logs\supervisor-state.json` | `state=stopped`, `ownedPids={}` |
| Protected port 5175 (Vite) | PID 14268 |
| Protected unrelated `tsx` PIDs | 708, 31612 |
| Installed HEAD | `9d293879…` |
| `ATLAS_RUNTIME_ENV_FILE` / `SOURCE_DIR` / `RELEASE_SHA` | unset (process, user, machine) |

## Durable environment provisioning

- `D:\ATLAS-runtime-config` created (absent before).
- Byte-identical copy of the verified staging source
  `D:\ATLAS-worktrees\integration-rrtc01r-20260912\atlas-server\.env` to the durable
  target: `dstExists=True`, `srcBytes=2290`, `dstBytes=2290`,
  `sha256_equal=True`. Neither digest value was printed.
- The confirmed DB target is retained by construction (byte-identical copy); no
  `DATABASE_URL` value was read into any artifact.
- ACL: inheritance disabled (protected DACL), **exactly three** explicit `Read`
  ACEs — `NT AUTHORITY\SYSTEM`, `BUILTIN\Administrators`, and the executing
  operator account. No other principals. Owner `BUILTIN\Administrators`.
- Post-install re-verification: file present (2290 bytes), inheritance still
  protected, ACE count 3, SHA-256 equality still `True`.

## Environment delivery (dual context)

- Machine-level (boot-task) delivery: `setx /M` for the three variables;
  registry-verified `matches_expected=True` for each of
  `ATLAS_RUNTIME_ENV_FILE`, `ATLAS_RUNTIME_SOURCE_DIR`, `ATLAS_RUNTIME_RELEASE_SHA`
  (authorized machine-level environment delivery only).
- Immediate elevated process: the same three variables set in-process for the
  `cli.mjs` start/status commands.
- **Negative control:** `node ops/runtime/cli.mjs status` with the env reference
  unset returned `ENV_REFERENCE_MISSING` (exit 1) — proves the durable reference is
  required and fail-closed.
- **Task-identity read-proof (temporary SYSTEM task, removed):**
  `readOk=true`, `equalOk=true`, `length=2290`, `envRef=true`, `srcDir=true`,
  `relSha=true`; task `LastTaskResult=0`. This proves the scheduled-task identity
  can read the durable file and that the three machine variables are visible to a
  task-account process. The temporary task `ATLAS-Runtime-EnvReadProof` and its
  temporary script/result files were deleted (removal verified).

## Start results

`node ops/runtime/cli.mjs start` executed from the durable directory.

| Target | Port | Owned PID | Live (local probe) |
|---|---|---|---|
| ATLAS server | 5001 | 15388 | `/api/v1/health` 200, `/api/v1/health/ready` 200 |
| ATLAS production host | 5174 | 22272 | `/__host/live` 200, `/__host/ready` 200 |

- `state=running`, `restartFailures=0`, `releaseSha=9d293879…`, `productPin=d44f29e0…`.
- `http://localhost:5174/` 200 with **no** Vite/HMR markers
  (`/@vite/client`, `/@react-refresh`, `src/main.tsx`, `src/main.ts` all absent).
- `http://localhost:5174/api/v1/health/ready` via proxy 200.
- Tailnet `https://njgrm.buru-degree.ts.net/api/v1/health` → **200**.
- Observed invariants: `ROLLOVER_AUTO_SYNC_ENABLED=false` and `ATLAS_SUPERVISED=true`.
- Supervisor process 32632 is orphaned (its launcher parent has exited) and owns
  children 15388 / 22272.

## Task registration

- Task `ATLAS-Runtime-Supervisor` registered with a boot trigger
  (`MSFT_TaskBootTrigger`; XML `<BootTrigger />`).
- `ExecutionTimeLimit=PT0S`; `MultipleInstances=IgnoreNew`; principal
  `S-1-5-18` (SYSTEM), `ServiceAccount`, `RunLevel=Highest`.
- Action: `C:\Program Files\nodejs\node.exe` with argument
  `"D:\ATLAS-runtime-supervised-20260912\ops\runtime\cli.mjs" start`, working
  directory `D:\ATLAS-runtime-supervised-20260912`.
- Post-registration state `Ready`; `schtasks /query /tn ATLAS-Runtime-Supervisor`
  reviewed with `Task To Run` / `Run As User` / `Start In` redacted; XML
  elements (`BootTrigger`, `ExecutionTimeLimit=PT0S`, `Command`, `Arguments`,
  `UserId`) reviewed.

## Legacy task disposition

- `ATLAS-DevServer-Temp2` was disabled **only after** supervised health
  (`/api/v1/health` 200, `/api/v1/health/ready` 200) and successful task
  registration. Final state: `Disabled`.

## Protections untouched

- Port 5175 Vite process PID **14268** unchanged.
- Unrelated `tsx` PIDs **708** and **31612** unchanged.
- PostgreSQL untouched; no login, term-cache apply/sync, Teaching Load mutation,
  generation, publication, migration/schema, Tailscale/firewall, or
  companion-repository change occurred.

## Trace outcome

| # | Requirement | Production path | Negative control | Outcome |
|---|---|---|---|---|
| 1 | Elevated executor | WindowsPrincipal admin check | non-admin STOP | PASS |
| 2 | 5001/5174 empty | `Get-NetTCPConnection` | listener ⇒ STOP | PASS (EMPTY) |
| 3 | Byte-identical durable env | copy staging `.env` | hash mismatch ⇒ STOP | PASS (`equal=True`, 2290 B) |
| 4 | Restricted ACL | `Set-Acl` explicit DACL | extra principal | PASS (3 ACEs) |
| 5 | Fail-closed env reference | `cli.mjs status` | unset ref | PASS (`ENV_REFERENCE_MISSING`, exit 1) |
| 6 | No Vite dev artifact | production host static root | dev marker ⇒ refuse | PASS (no markers) |
| 7 | One owner per port | `cli.mjs start` | unknown listener ⇒ refuse | PASS (15388 / 22272) |
| 8 | Local + Tailnet health | `/api/v1/health[/ready]` | pre-start 502 | PASS (200/200/200) |
| 9 | Boot task PT0S | `Register-ScheduledTask` | inspect XML | PASS |
| 10 | Task-identity read-proof | temporary SYSTEM task | read failure ⇒ nonzero | PASS (exit 0) |
| 11 | Legacy disable after health | `schtasks /Change /DISABLE` | disable-before-health | PASS (Disabled) |
| 12 | Protected processes | PID preservation | PID drift | PASS (14268 / 708 / 31612) |

## Deviations

1. **Detached start required.** The packet's step-4 command
   `node ops/runtime/cli.mjs start` runs the supervisor in the foreground and keeps
   the invoking shell open. Running it under a bounded executor shell let the shell
   reclaim the command, which terminated the first supervisor instance and its
   children (ports returned to EMPTY; the state file retained stale PIDs until the
   next start overwrote it). The identical command was re-launched detached
   (`Start-Process`, inheriting the in-process variables); the resulting supervisor
   32632 is orphaned from the shell and owns children 15388 / 22272. Packet intent
   (exactly one supervised owner per port) is preserved.
2. **Registration mechanism.** A literal `schtasks /Create /SC ONSTART` cannot
   express `ExecutionTimeLimit=PT0S`, so the task was registered with
   `Register-ScheduledTask` and the equivalent boot semantics, SYSTEM principal,
   absolute node path, and `PT0S` were independently verified via
   `schtasks /query /xml`.
3. **Machine-level delivery.** Used `setx /M` (the authorized machine-level
   environment delivery); the install-preview sample showed a user-level `setx`.
4. **Temporary identity mechanism.** A temporary SYSTEM task plus a temporary
   script/result file were used only to prove the task-identity read; all were
   removed and the removal verified.

## Remaining risks (NON_BLOCKING)

- The currently running supervisor is a manually launched detached process, not
  itself a task-spawned instance. The boot task is the durable restart mechanism
  and will start a fresh instance at next boot; actual reboot-start behavior was
  not exercised in this session.
- `cli.mjs status` from a separate process reports `live:false` for targets because
  that process holds no live child handles; listener ownership plus local and
  Tailnet 200 responses are the authoritative liveness evidence.
- A transient `machine\username` string appeared in one ACL-verification tool
  output during execution; it was not written to any committed artifact, and no
  credential or env value was exposed.

## No secrets recorded

No credentials, `DATABASE_URL` values, `JWT_SECRET`, env-file contents, raw
machine-sensitive task output, or usernames are recorded in this artifact. Only
booleans, byte lengths, sanitized status, PIDs, ports, and packet-pinned SHAs and
paths appear.
