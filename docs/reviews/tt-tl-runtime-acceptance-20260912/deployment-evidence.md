# TT/TL Runtime Acceptance — Deployment Evidence (Phase B: switch + start)

Status: `REVIEW_REQUIRED` — elevated executor switch phase complete; fresh QA
acceptance (read-only Tailnet diagnostics) follows with the retained session
custodian context.

## Approval and packet

- **Approval:** Operator-approved HIGH action `TT-TL-RUNTIME-ACCEPTANCE-2026-09-12`
  (amended R3), returned 2026-09-12. Section 8 revised copy-ready approval
  sentence authorizes: build, quiesce, durable release switch, start, Tailnet-only
  read-only acceptance with the existing session only, one docs-only evidence
  commit.
- **Governing packet:** `docs/prompts/tt-tl-runtime-acceptance-2026-09-12.md`
  (read at integration worktree `D:\ATLAS-worktrees\integration-tt-tl-runtime-acceptance-20260912`,
  packet commit `5a9ab46f`; R3 re-audit reviewed the corrected packet at
  `9221864b`). Deployment strategy step 1/2, Required preflight, and section 8
  were followed.
- **Evidence-commit base:** current `origin/main`
  `ba3d56bd5c5dbb9d1f7e4017ca4af4e50b1f025f` (`docs(planning): record build phase
  completion for TT TL runtime acceptance`). Deployed product target:
  `3d916b261d6a2db71b153558ac8c2d151e2fccd0` (ancestor of `origin/main`, descends
  from reviewed pin `d44f29e04d359ad9b18e4443b0fd4fed1daeaecd`).
- **Zero-write scope:** no apply, sync, generation, publication, migration,
  schema, rollover, carry-forward, suggestion apply, login, or browser
  interaction. No Tailscale changes. No pushes.

## Listener signatures (owner PID per port)

| Port | Before (incumbent `9d293879`) | After (target `3d916b26`) |
|------|-------------------------------|----------------------------|
| 5001 | PID `15388` — `D:\ATLAS-runtime-supervised-20260912\atlas-server\dist\server.js`, parent `32632` | PID `30032` — `D:\ATLAS-runtime-supervised-3d916b26-20260912\atlas-server\dist\server.js`, parent `44336` |
| 5174 | PID `22272` — `D:\ATLAS-runtime-supervised-20260912\ops\runtime\host.mjs`, parent `32632` | PID `27408` — `D:\ATLAS-runtime-supervised-3d916b26-20260912\ops\runtime\host.mjs`, parent `44336` |
| 5175 | PID `14268` — Vite (`D:\ATLAS\atlas-client`), parent `36096` — **out of scope** | PID `14268` — **unchanged** |

Exactly one supervisor-owned PID per ATLAS port before and after. Port 5175 and
the unrelated `tsx` (`D:\ATLAS\atlas-server`) processes were never stopped or
modified.

## Quiesce and settle-window evidence

- **Resident supervisor (before):** PID `32632`,
  `"C:\Program Files\nodejs\node.exe" "D:\ATLAS-runtime-supervised-20260912\ops\runtime\cli.mjs" start`,
  created 2026-09-12 19:25:02 +08; recorded children `15388` (5001) and `22272`
  (5174).
- **Tree termination:** `taskkill /PID 32632 /T /F` → exit `0`; terminated
  `32632`, `15388`, `22272`, and descendants `34944`, `19452`, `39848`.
- **Supervisor stop:** `node ops/runtime/cli.mjs stop` from
  `D:\ATLAS-runtime-supervised-20260912` (with the incumbent `ATLAS_RUNTIME_*`
  values set in the invoking process) → exit `0`; state `stopped`;
  `releaseSha=9d293879…`; both targets `owned:false`, `pid:null`.
- **Settle window:** 12 polled samples over ~26 seconds (strictly greater than the
  2-second restart backoff). Result: listeners on 5001/5174 = **none** in every
  sample; no `ops/runtime/cli.mjs start` respawn in every sample;
  `violations=0`. Port 5175 remained owned by `14268` throughout.

## Durable release switch (machine env + boot task)

Machine-scope environment (metadata only; the env file was never printed):

| Variable | Before | After |
|----------|--------|-------|
| `ATLAS_RUNTIME_SOURCE_DIR` | `D:\ATLAS-runtime-supervised-20260912` | `D:\ATLAS-runtime-supervised-3d916b26-20260912` |
| `ATLAS_RUNTIME_RELEASE_SHA` | `9d2938791460c1d19059e5eddd30d7bba623fdad` | `3d916b261d6a2db71b153558ac8c2d151e2fccd0` |
| `ATLAS_RUNTIME_ENV_FILE` | `D:\ATLAS-runtime-config\atlas-server.env` | `D:\ATLAS-runtime-config\atlas-server.env` (**unchanged**) |

`setx /M` for the two variables returned `SUCCESS`; independent registry
read-verify (`HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment`)
and `[Environment]::GetEnvironmentVariable(...,'Machine')` both returned the new
values.

Boot task `ATLAS-Runtime-Supervisor` (re-pointed via XML export → path replace →
`schtasks /Create /F`, then verified via `schtasks /query /tn … /xml`):

| Field | Before | After |
|-------|--------|-------|
| `UserId` | `S-1-5-18` (SYSTEM) | `S-1-5-18` (SYSTEM) — preserved |
| `RunLevel` | `HighestAvailable` | `HighestAvailable` — preserved |
| Trigger | `<BootTrigger />` (ONSTART) | `<BootTrigger />` — preserved |
| `ExecutionTimeLimit` | `PT0S` | `PT0S` — preserved |
| `MultipleInstancesPolicy` | `IgnoreNew` | `IgnoreNew` — preserved |
| `Arguments` | `"D:\ATLAS-runtime-supervised-20260912\ops\runtime\cli.mjs" start` | `"D:\ATLAS-runtime-supervised-3d916b26-20260912\ops\runtime\cli.mjs" start` |
| `WorkingDirectory` | `D:\ATLAS-runtime-supervised-20260912` | `D:\ATLAS-runtime-supervised-3d916b26-20260912` |

The transient task XML was created under the sanctioned temp directory and
removed after re-registration.

## Start results (target release)

- **Resident supervisor:** PID `44336`, `node ops/runtime/cli.mjs start`, started
  2026-09-12 23:26:43 +08 from
  `D:\ATLAS-runtime-supervised-3d916b26-20260912`; owned children `30032` (5001)
  and `27408` (5174) — exactly one per port.
- **Local liveness:** `GET http://localhost:5001/api/v1/health` → **200**
  `{"status":"ok","service":"atlas"}`.
- **Local dependency readiness:** `GET http://localhost:5001/api/v1/health/ready`
  → **200** `{"status":"ready","service":"atlas","checks":{"database":"ok"}}`.
- **Tailnet liveness:** `GET https://njgrm.buru-degree.ts.net/api/v1/health` →
  **200** `{"status":"ok","service":"atlas"}`.
- **Supervisor status:** `state=running`, `sourceDir=…3d916b26-20260912`,
  `releaseSha=3d916b261d6a2db71b153558ac8c2d151e2fccd0`, both targets
  `owned:true` with the PIDs above, invariants `ATLAS_SUPERVISED=true` and
  `ROLLOVER_AUTO_SYNC_ENABLED=false`.
- **Installed HEAD:** `git -C D:\ATLAS-runtime-supervised-3d916b26-20260912
  rev-parse HEAD` = `3d916b261d6a2db71b153558ac8c2d151e2fccd0` — equal to the
  supervisor `releaseSha`. (Health payloads do not contain `releaseSha`; the
  value is from supervisor status + Git HEAD.)

Observation (non-blocking): the `status` output reports `live:false` for both
targets while the external liveness/readiness endpoints return 200; the `live`
field is not refreshed by the read-only `status` command and does not reflect the
verified external probes.

## Protections untouched

- Port 5175 (Vite PID `14268`) unchanged throughout.
- Unrelated `tsx`/npm processes under `D:\ATLAS` untouched.
- PostgreSQL untouched: no migrate/push/seed/reset/schema command was issued;
  readiness reported `database: ok` read-only.
- Durable env file `D:\ATLAS-runtime-config\atlas-server.env` never modified and
  never printed (mtime remained `2026-09-07T00:52:40+08`).

## Rollback status

- Incumbent supervised release `D:\ATLAS-runtime-supervised-20260912` retained
  intact at HEAD `9d2938791460c1d19059e5eddd30d7bba623fdad` (server + client
  dist present) for a supervised reset.
- Operator-named manual last resort
  `D:\ATLAS-runtime-fallback-d44-20260912` retained at `d44f29e0` (server +
  client dist present; no `/api/v1/health/ready` — non-supervised degraded
  restore only).
- No rollback was required; `node ops/runtime/cli.mjs rollback` was not used.

## Deviations

1. **Fresh-process environment inheritance.** The ambient OpenCode process tree
   predates the machine-scope `ATLAS_RUNTIME_*` values and does not inherit them.
   `cli.mjs stop`, `status`, and `start` were therefore invoked with the
   `ATLAS_RUNTIME_*` values set in the invoking process. This is expected and is
   why start cannot rely on ambient inheritance; it did not change any durable
   state by itself.
2. **Launcher wrapper termination.** The detached `Start-Process` wrapper that
   launched `cli.mjs start` was terminated by the shell tool after the start
   call; the supervisor process tree (`44336` → `30032`/`27408`) remained
   resident and stable, as verified by process, state-file, and health evidence.
3. **`status` `live` field.** Described above; external probes are authoritative.

## New release directory ownership

Filesystem owner of `D:\ATLAS-runtime-supervised-3d916b26-20260912`:
`BUILTIN\Administrators` (created from the elevated Administrator context).
Later non-elevated roles may use a per-command Git `safe.directory` override
limited to this exact verified path.

## No-secrets note

No environment-file contents, credentials, tokens, connection strings, or
secrets are recorded in this artifact. All environment references are names and
non-secret path/SHA metadata only.
