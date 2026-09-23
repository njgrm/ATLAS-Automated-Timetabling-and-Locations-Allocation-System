# ATLAS deployment acceptance — release `d7082c9d` (2026-09-24)

Elevated deployment under the operator's standing authorization. One runtime-host fix. **No migration,
no generation, no publication.** Deployment and acceptance recorded as separate outcomes.

## Cutover

| | |
|---|---|
| Target | `d7082c9db134f26e0f3f1e5fa01d470cb9b34093` |
| Incumbent / rollback basis | `22d1f5a8a341bf426a91df5a7ea6c01acd4862d2` (`E:\ATLAS-runtime-supervised-22d1f5a8-20260924`, startable in place) |
| Target source | `E:\ATLAS-runtime-supervised-d7082c9d-20260924` (detached worktree at the target; product artifacts byte-identical to `22d1f5a8` — only `ops/` and docs changed) |
| Env | `D:\ATLAS-runtime-config\atlas-server.env` |
| Pre-deploy record | `docs/plans/live-state.md` `## Live release` naming target + rollback, committed `395d2d25` and pushed **before** cutover |
| Runner | dry run clean (`mutates:false`, supervisor 50864, listeners 61128/9212) → `-Execute` → `CUTOVER_STARTED`, audit `C:\ProgramData\ATLAS\release-audit\d7082c9d-20260924-050922` |

**Change:** `ops/runtime/lib/production-host.mjs` — the proxy now passes `agent: false` on its upstream
request (and readiness probe), so it no longer reuses a pooled socket the ATLAS server has closed at its
`keepAliveTimeout` (the intermittent upstream `read ECONNRESET` → 502). Independent QA `ACCEPT_READY`
5/5/0/0, with a failing-first control (two sequential proxied requests arrive on two upstream connections;
`1 !== 2` on base). Full runtime suite 65/67 with two pre-existing `deploy-runner` failures reproduced on
clean `origin/main`.

## Post-cutover verification

- Machine `ATLAS_RUNTIME_RELEASE_SHA` = `d7082c9d…`, `ATLAS_RUNTIME_SOURCE_DIR` =
  `E:\ATLAS-runtime-supervised-d7082c9d-20260924`; supervisor log "All targets healthy";
  `GET /api/v1/health/ready` → 200 `{"status":"ready","checks":{"database":"ok"}}`.
- Served entry `assets/index-PWY0v5TC.js` (unchanged — product artifacts identical to `22d1f5a8`).
- Export matrix (run #317, termIndex 2) all 200: `class-program.xlsx` 20,388 B, `section-program.docx`
  9,872 B, `summary-teacher-schedule.xlsx` 54,080 B, `room-program.xlsx` 34,949 B. (Byte counts vary ±1 B
  between builds/downloads due to archive metadata; the status-200 claim is the material one.)
- Core APIs 200: `runtime/context`, `dashboard/readiness-summary`, `generation/1/10/runs`,
  `notification-inbox/unread-count`.

## The defect this fixes — before/after

The intermittent host/proxy 502s reproduced **pre-fix** on ~half of fresh `/timetable` loads (2–4 each, on
`runtime/rollover-status`, `runs/317/manual-edits`, `follow-up-flags/…/flags`,
`room-preferences/collaboration/ticket`, plus occasional `ERR_HTTP2_PROTOCOL_ERROR` on the notification SSE).

**Post-fix: 7 fresh `/timetable` loads (8 s idle gaps), each with 0 502s / 0 HTTP-2 protocol errors.**
(The SSE HTTP/2 component may be Tailscale-layer; it did not reappear in the post-fix sample.)

## Rollback

Re-run the runner with target/incumbent swapped (target `22d1f5a8`, incumbent `d7082c9d`) after confirming
`E:\ATLAS-runtime-supervised-22d1f5a8-20260924` is startable. Not needed — verification passed.

## Residuals

- NON_BLOCKING: two pre-existing `deploy-runner.test.mjs` failures (BOM UTF-16LE task export; PowerShell 5.1
  rooted-path preflight) reproduce on clean `origin/main`.
- NON_BLOCKING: a fresh TCP connection per proxied request adds handshake overhead vs a pooled socket — the
  deliberate fail-safe for the reuse race.
- The offline term-fallback staleness finding (`OFFLINE-FALLBACK-STALENESS-20260924`) remains open, not
  addressed by this release.
