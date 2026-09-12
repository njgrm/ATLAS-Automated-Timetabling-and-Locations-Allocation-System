# TT/TL Runtime Acceptance — 2026-09-12

Status: PREPARED — NOT EXECUTED

## Objective

Deploy the integrated ATLAS source at `3d916b261d6a2db71b153558ac8c2d151e2fccd0`
to the supervised runtime, then perform read-only live acceptance of the new
Timetable shape diagnostics and Teaching Load authority diagnostics.

This is a source deployment and read-only acceptance only. It does not authorize
Teaching Load apply, carry-forward, generation, publication, rollover sync,
term-cache apply, migration, schema changes, or companion-repository changes.

## Current verified state

- Tailnet health: `https://njgrm.buru-degree.ts.net/api/v1/health` = 200.
- Current listeners: ATLAS owns ports 5001 and 5174 (supervised PIDs must be
  re-verified immediately before execution).
- Current product pin: `d44f29e04d359ad9b18e4443b0fd4fed1daeaecd`.
- Current supervisor release: `9d2938791460c1d19059e5eddd30d7bba623fdad`.
- Current legacy task: `ATLAS-DevServer-Temp2` is disabled.
- Target source: `3d916b261d6a2db71b153558ac8c2d151e2fccd0`, which descends from
  the current product pin.
- Rollback: retain the current `d44f29e0` runtime release and its supervisor
  state; never stop an unexpected listener.

## Required preflight

1. Refresh `origin/main` and verify the target SHA and ancestry.
2. Re-read the current supervisor state, exact PIDs, ports, task state, and
   Tailnet health. If either port is unexpectedly empty or owned by an unknown
   process, stop for replanning.
3. Build the target server and client from the exact target SHA in a new
   durable release directory. Verify the built server and client artifacts and
   the supervisor contract before any listener interruption.
4. Record secret-free before signatures. Do not print or commit environment
   contents.

## Deployment boundary

- Stop and start only the ATLAS supervisor-owned processes on ports 5001/5174.
- Keep `ROLLOVER_AUTO_SYNC_ENABLED=false`.
- Preserve the current `d44f29e0` release as the immediate fallback.
- Do not alter port 5175, unrelated processes, Tailscale configuration, or
  `ATLAS-DevServer-Temp2` beyond the existing disabled state.
- On failed health/readiness, stop only newly owned children and restore the
  recorded `d44f29e0` release.
- Do not claim zero downtime.

## Read-only acceptance

After target health and readiness are 200:

- Assert browser origin is exactly `https://njgrm.buru-degree.ts.net`.
- Use an existing authenticated session if available. Do not perform a fresh
  login unless separately approved because login creates an audit event.
- At 1366x768 and 390x844, inspect Dashboard, Subjects, Teaching Load, and
  Simple Timetable. Capture route URLs, accessibility snapshots, console
  errors, network statuses, and no-write request proof.
- Call the read-only Teaching Load authority-diagnostics route with explicit
  `schoolId` and active `schoolYearId`; verify zero-write proof, HG exclusion,
  zero-load faculty visibility, adviser diagnostics, and typed blockers.
- Call the read-only generation readiness/diagnostic route with shift-window
  enforcement; verify three-term authority, stakeholder shape blockers, empty
  demand/output fail-closed behavior, and no generation claim.
- Stop before any Save, Apply, Generate, Publish, rollover, or term-cache
  action.

## Evidence and stop conditions

Return `REVIEW_REQUIRED` unless all target health, release identity, browser
origin, read-only diagnostics, and zero-write checks pass. Report any
`EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)` honestly. Do not substitute
localhost for Tailnet browser evidence.

Commit one docs-only evidence artifact under `docs/verification/` or
`docs/reviews/`; do not modify product source during acceptance.

Suggested commit:

```text
docs(runtime): record TT and Teaching Load live acceptance
```
