---
name: atlas-deploy
description: Build and cut over an ATLAS release on the supervised runtime (ports 5001/5174), including any guarded schema migration. HIGH action — use only when the operator explicitly asks to deploy a named SHA. Also covers read-only runtime status and outage triage.
metadata:
  short-description: ATLAS release build, cutover and verification (HIGH)
---

# ATLAS deploy

Authority: `AGENTS.md` §6 and §13. Facts and history: `docs/reference/agent-runtime-deploy-facts.md`
(read it first). Retention and junction rules: `docs/reference/agent-worktree-lifecycle.md`.

**Deployment, migration apply, and runtime/task/env changes are HIGH.** Read-only status and
triage (steps 0 and 6) are not.

## 0. Resolve the live identity (read-only)

- `<sourceDir>` from `schtasks /query /tn ATLAS-Runtime-Supervisor /fo LIST /v` or the
  supervisor process command line — never from memory, a prior session, or the agent
  shell's own `ATLAS_RUNTIME_*` environment (it can be stale and shadow machine scope).
- Status: `node ops/runtime/cli.mjs status` from `<sourceDir>`, with explicit env overrides.
- Only `<sourceDir>/ops/runtime/logs/supervisor-state.json` is authoritative.
- Compare against the `Live release` block of `docs/plans/live-state.md` on `origin/main`.

## 1. Present the packet, then wait

Name: target SHA, incumbent SHA and directory, the release directory to create, whether a
migration applies (host, database name, environment, migration count), expected delta,
rollback basis, and verification. **Wait for a clear go-ahead** ("yes, deploy" suffices).

## 2. Build the release directory

- Check free space first (`D:` warn < 25 GiB, fail < 15 GiB; watch `E:` too).
- `git worktree add --detach E:/ATLAS-runtime-supervised-<sha8>-<yyyymmdd> <sha>`.
- The release **owns its dependency tree**: `npm ci` inside it. Never junction into another
  release, never install through a shared junction.
- `prisma generate` from `atlas-server` with `--schema` at the **repo-root** schema.
- Server build, then client build **with `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net`**
  (without it the build exits 1 and emits no bundle).
- Node must actually start the built server (§5) — not just type-check.

## 3. Migration (only if the range adds one)

`npm run migrate:guarded` from `atlas-server` — never bare `prisma migrate deploy`, never
`db push --force-reset` or `migrate reset`. It requires a fresh checksum-valid backup manifest
and `pg_restore --list` revalidation, and prints `MIGRATE_GATE_OK`. Afterwards: migrate status
is up to date, plus an existence probe for every new column/table.

## 4. Cutover

`ops/runtime/deploy-runner.ps1` with explicit `-TargetSha -TargetSourceDir -IncumbentSha
-IncumbentSourceDir -EnvFile`. Dry-run first (default) and review the redacted plan under
`C:\ProgramData\ATLAS\release-audit`; then the same arguments with `-Execute` in an
**elevated** shell (verify `IsInRole(Administrator)`).

## 5. Prove it

- `/api/v1/health` is liveness only. Also a DB-backed read (`GET /api/v1/subjects?schoolId=<id>`)
  and the supervisor log.
- **Fetch a chunk that exists only in the new build** from the Tailnet origin and compare it
  byte-for-byte with the built asset.
- Machine `ATLAS_RUNTIME_SOURCE_DIR` / `RELEASE_SHA` equal the target.
- Update the `Live release` block in `docs/plans/live-state.md` (SHA, directory, listeners,
  rollback basis) **in the same action** — a deployment is not complete until it names both.
- Deployment and acceptance are separate outcomes: `DEPLOYED` is not "done"; browser acceptance
  goes through `atlas-live-browser-qa`.

## 6. Triage notes

Transient Prisma `P1001` / Postgres client-abort lines appear during antivirus scans —
confirm with the DB-backed read before calling an outage. `EADDRINUSE` on 5001 or Vite moving
off 5174 is expected. An unexpectedly absent listener changes the plan: prepare a
deploy-as-restore from the last accepted artifact instead of running the swap unchanged.
Unexpected shared-data mutation is an incident stop.
