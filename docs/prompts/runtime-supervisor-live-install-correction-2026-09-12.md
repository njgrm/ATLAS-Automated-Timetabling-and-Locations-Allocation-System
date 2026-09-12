# RUNTIME-SUPERVISION-LIVE-INSTALL-CORRECTION-2026-09-12 — HIGH Retry Packet

**Status: PREPARED — NEW APPROVAL REQUIRED.** The original install packet was
executed and correctly rolled back. This packet is a bounded retry of the same
runtime cutover, not an authorization to bypass the failed boot-task gate.

## 1. Failure being corrected

The reviewed supervisor release `9d2938791460c1d19059e5eddd30d7bba623fdad`
started and passed transient liveness/readiness on ports 5001 and 5174, but
both approved `ONSTART` task-registration attempts returned Windows `Access is
denied`. No `ATLAS-Runtime-Supervisor` task exists. The accepted `d44f29e0`
fallback is running manually; `ATLAS-DevServer-Temp2` remains unchanged and
enabled. The final executor evidence is `2794c40f` and fresh QA returned
`CORRECTION_REQUIRED` for the exact range
`60cfe3d4...2794c40f`.

The previous handoff's rollback prose said `/health/ready`; the real endpoint
is `/api/v1/health/ready`. The correction evidence must use the real route.

## 2. Required authority before execution

1. The operator must launch the executor in an **elevated Administrator
   PowerShell/OpenCode process**. The executor must prove elevation before any
   listener or task mutation and stop with `PLANNER_DECISION_REQUIRED` if it is
   not elevated.
2. No new Windows account, stored password, registry change, firewall change,
   credential export, or security-policy workaround is authorized.
3. The operator must approve this packet separately. The prior approval is not
   silently extended to a different execution context.

## 3. Frozen target and scope

- Supervisor release: `9d2938791460c1d19059e5eddd30d7bba623fdad`.
- Reviewed product pin: `d44f29e04d359ad9b18e4443b0fd4fed1daeaecd`.
- Ports: 5001 and 5174 only.
- `ROLLOVER_AUTO_SYNC_ENABLED=false`.
- Exact task: `ATLAS-Runtime-Supervisor`, start at boot, explicit unlimited
  execution duration, environment delivery proven to the task account.
- Legacy task: inspect `ATLAS-DevServer-Temp2`; disable only after supervised
  health and successful task registration.
- Acceptance QA owns the one previously approved login, if still required.

No term-cache apply/sync, Teaching Load mutation, generation, publication,
migration, schema change, companion-repository edit, or unrelated process/task
change is in scope.

## 4. Required sequence

1. Verify the exact live fallback PIDs, ports, Tailnet health, DB signatures,
   task inventory, and clean durable release checkout. Do not trust stale PIDs.
2. Prove Administrator elevation and task-account environment delivery in a
   secret-free log. Review the generated `schtasks` command without printing
   credentials.
3. Verify the startable fallback and rollback record before stopping anything.
4. Stop only the exact current ATLAS PIDs on 5001/5174; prove both ports empty.
5. Register the supervisor task using the elevated process. Explicitly verify
   `ONSTART`, task principal/run level, `ExecutionTimeLimit=PT0S` (or the
   equivalent no-limit setting), and the configured action/environment.
6. Start the supervisor and require exactly one owned PID per port, local
   `/api/v1/health` 200, `/api/v1/health/ready` 200, and Tailnet health 200.
   If any step fails, stop only owned children and restore the d44 fallback.
7. Only after steps 5–6 pass, disable `ATLAS-DevServer-Temp2` and record its
   final disposition. If task registration fails, leave the legacy task
   untouched and roll back.
8. Fresh QA, not the executor, performs the approved read-only Tailnet browser
   acceptance at 1366x768 and 390x844 with the origin assertion, and performs
   the single login only if the existing approved session is unavailable.

## 5. Mandatory acceptance matrix

- Task exists and is boot-triggered with no execution limit.
- Supervisor status is distinct from manual fallback and records release/pin.
- Local liveness and dependency readiness both return 200.
- Tailnet SPA, API, proxy, SSE, WebSocket, and responsive surfaces work at both
  required viewports with `window.location.origin` exactly
  `https://njgrm.buru-degree.ts.net`.
- A controlled restart/health failure proves bounded recovery and no duplicate
  listener; rollback restores the prior release.
- Rollover automation remains disabled.
- DB signatures remain unchanged except the explicitly approved login audit
  delta, if QA must log in.
- No credentials or raw machine-sensitive task output enter artifacts.

The executor must return `REVIEW_REQUIRED` with an immutable docs-only commit;
fresh QA must review the exact final `base...candidate` range and return
`ACCEPT_READY` or `CORRECTION_REQUIRED`. Acceptance cannot be downgraded while
the task is absent, the no-limit setting is unproven, or the runtime is only a
manual fallback.

## 6. Copy-ready approval sentence

> I approve HIGH action RUNTIME-SUPERVISION-LIVE-INSTALL-CORRECTION-2026-09-12:
> from an elevated Administrator executor, retry the reviewed supervisor
> installation at release `9d2938791460c1d19059e5eddd30d7bba623fdad` serving
> product pin `d44f29e04d359ad9b18e4443b0fd4fed1daeaecd` on ports 5001 and 5174
> only, with `ROLLOVER_AUTO_SYNC_ENABLED=false`; register
> `ATLAS-Runtime-Supervisor` at boot with verified environment delivery and no
> execution-time limit; disable `ATLAS-DevServer-Temp2` only after supervised
> health and successful task registration; use the recorded d44 fallback on any
> failure; allow fresh QA to perform the previously authorized single login if
> needed; and stop before term-cache apply/sync, Teaching Load mutation,
> generation, publication, migration, schema, or companion-repository changes.

