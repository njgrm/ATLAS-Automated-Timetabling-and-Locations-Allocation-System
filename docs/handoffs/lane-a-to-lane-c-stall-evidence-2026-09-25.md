# Lane A → Lane C: SERVER-TIMING stall evidence (2026-09-25)

Read-only evidence capture. **Nothing was started or stopped.** Requested by Lane C.

## Method / provenance

- `<sourceDir>` resolved from `schtasks /query /tn ATLAS-Runtime-Supervisor /fo LIST /v`:
  **`E:\ATLAS-runtime-supervised-e8553752-20260925`** (live release `e8553752`; log head
  `Starting RUNTIME-SUPERVISION-C01 … releaseSha=e8553752…`). This release descends from the `e475c673`
  Lane C referenced and carries `SERVER-TIMING-C01`.
- Read clock: `2026-09-25T13:15:04+08:00` (`05:15:04Z`). Live log last written
  `2026-09-25T13:12:50+08:00`.
- Command run:
  `Select-String -Path <sourceDir>\ops\runtime\logs\atlas-supervisor.log -Pattern '\[event-loop-stall\]|\[slow-request\]|P1001|P2024|pool' | Select-Object -Last 60`
- **Limitation:** the `/timetable` load step could not be performed by Lane A — this shell has no browser
  and no seeded browser profile (browser custody is Lane B / Codex). No *new* load line was generated. The
  lines below are **real live `/timetable`-driven traffic already recorded in that log**, last at
  `05:12:50Z` (13:12:50 +08), ~2 minutes before the read. For a fresh load with a fresh clock time,
  ask Lane B (or the operator) to drive the seeded session.

## Live log — matching lines, verbatim (count: 3; no `P1001`/`P2024`/`pool`)

```
2026-09-25T05:04:22.094Z [warn] [supervisor] [server] [event-loop-stall] blocked ~384ms; active: GET /api/v1/health/ready (done, 5ms), GET /api/v1/subjects (done, 30ms), GET /api/v1/health (done, 1ms), POST /api/v1/generation/:n/:n/runs/:n/published-revisions/preview (done, 381ms), GET /api/v1/notifications/:n/:n/events (running 25974ms), GET /api/v1/notifications/:n/events (running 25961ms)
2026-09-25T05:06:47.130Z [warn] [supervisor] [server] [slow-request] GET /api/v1/runtime/context 200 4221ms inFlight=2
2026-09-25T05:12:50.892Z [warn] [supervisor] [server] [slow-request] GET /api/v1/runtime/context 200 4127ms inFlight=2
```

Paths are masked (`:n`); no query strings or tokens appear.

## Prior `SERVER-TIMING-C01` release — heavier sustained evidence

Still on disk at
`E:\ATLAS-runtime-supervised-89295c27-20260925\ops\runtime\logs\atlas-supervisor.log`
(75 matching lines: **49 `[event-loop-stall]` + 26 `[slow-request]`**, 0 `P1001`/`P2024`/`pool`).
Representative verbatim lines (the full set is in that log):

```
2026-09-25T03:42:18.040Z [warn] [supervisor] [server] [event-loop-stall] blocked ~4671ms; active: GET /api/v1/notifications/:n/:n/events (running 21020441ms), GET /api/v1/notifications/:n/events (running 21020435ms), GET /api/v1/notifications/:n/:n/events (running 21020432ms), GET /api/v1/notifications/:n/events (running 21020431ms), GET /api/v1/notifications/:n/:n/events (running 21020429ms), GET /api/v1/notifications/:n/events (running 21020426ms), GET /api/v1/notifications/:n/events (running 20974385ms), GET /api/v1/notifications/:n/:n/events (running 20964922ms)
2026-09-25T03:44:50.138Z [warn] [supervisor] [server] [event-loop-stall] blocked ~7668ms; active: GET /api/v1/notifications/:n/:n/events (running 21175336ms), GET /api/v1/notifications/:n/events (running 21175331ms), GET /api/v1/notifications/:n/:n/events (running 21175328ms), GET /api/v1/notifications/:n/events (running 21175327ms), GET /api/v1/notifications/:n/:n/events (running 21175324ms), GET /api/v1/notifications/:n/events (running 21175321ms), GET /api/v1/notifications/:n/events (running 21129281ms), GET /api/v1/notifications/:n/:n/events (running 21119818ms), +7 more
2026-09-25T03:44:50.229Z [warn] [supervisor] [server] [slow-request] GET /api/v1/generation/:n/:n/readiness/diagnostic 200 8203ms inFlight=18
2026-09-25T03:44:50.233Z [warn] [supervisor] [server] [slow-request] GET /api/v1/sections/summary/:n 304 8260ms inFlight=15
2026-09-25T03:44:50.250Z [warn] [supervisor] [server] [slow-request] GET /api/v1/room-preferences/:n/:n/latest/summary 304 8069ms inFlight=14
```

Observations (for Lane C; not a fix):

- Every `[event-loop-stall]` names the same `GET /api/v1/notifications/:n/:n/events` and
  `GET /api/v1/notifications/:n/events` streams as the active work, with durations **growing
  monotonically from ~26,000 ms to ~24,263,000 ms (~6.7 h)** — i.e. the event streams **never terminate**.
- The multi-second bursts line up with `runtime/rollover-status` repetitions (many `304`s at 2.6–3.7 s
  each, ~12 in-flight) alongside the open notification streams.
- `sections/summary`, `readiness/diagnostic` and `room-preferences/latest/summary` all finish within
  ~0.2 s of each other at the ~8 s mark — consistent with the audit's "shared server-side stall" and with
  `sections/summary` being a victim, not the cause.

Nothing was fixed, cleared, or restarted. The lines remain in both logs for you to read.
