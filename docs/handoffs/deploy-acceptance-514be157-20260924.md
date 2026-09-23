# ATLAS deployment acceptance — release `514be157` (2026-09-24)

Elevated deployment under the operator's standing authorization. One deploy-runner fix. **No runtime
behavior, migration, generation, or publication change.** Deployment and acceptance are separate outcomes.

## Cutover

| | |
|---|---|
| Target | `514be157632786e7cc66b0a4adf117826135a0ed` |
| Incumbent / rollback basis | `426b6ac8358bbdf10cc4289fdd34067ff88d0c81` (`E:\ATLAS-runtime-supervised-426b6ac8-20260924`, startable in place) |
| Target source | `E:\ATLAS-runtime-supervised-514be157-20260924` (detached worktree; product artifacts byte-identical to `426b6ac8` — only `ops/` and docs changed) |
| Env | `D:\ATLAS-runtime-config\atlas-server.env` |
| Pre-deploy record | `docs/plans/live-state.md` naming target + rollback, committed `161fdcfd` and pushed **before** cutover |
| Runner | dry run clean (`mutates:false`) → `-Execute` → `CUTOVER_STARTED`, audit `…\release-audit\514be157-20260924-055138` |

**Change:** `ops/runtime/deploy-runner.ps1` — `Invoke-Native` ran `& $File @Arguments 2>&1` under
`$ErrorActionPreference='Stop'`, so native stderr was promoted to a terminating error that aborted the runner
with a raw message before its exit-code check (a bad target leaked `git.exe : fatal: cannot change to '…'`
instead of `DEPLOY_RUNNER_STOP`). The preference is now relaxed for the duration of the call and restored in
`finally`. Also an encoding-robust BOM UTF-16LE task-export test. Independent QA `ACCEPT_READY` 5/5/0/0.

## Post-cutover verification

- Machine `ATLAS_RUNTIME_RELEASE_SHA` = `514be157…`, `ATLAS_RUNTIME_SOURCE_DIR` =
  `E:\ATLAS-runtime-supervised-514be157-20260924`; `GET /api/v1/health/ready` → 200
  `{"status":"ready","checks":{"database":"ok"}}`; `GET /api/v1/subjects?schoolId=1` → 200.
- The fixed `Invoke-Native` (`previousPreference`) is present in the live release's
  `ops/runtime/deploy-runner.ps1`.
- Runtime suite **93 tests, 0 failures** for the full suite (`npm run runtime:test`, 12 files) — 93/93 in a
  built tree (the 2 `crash-policy` build-gated tests skip without a build). Base `426b6ac8`: 91/93 (the two
  prior `deploy-runner` failures). An earlier draft reported 67/67 — that was a 6-file subset, not the full
  suite.

## Rollback

Re-run the runner with target/incumbent swapped (target `426b6ac8`, incumbent `514be157`). Not needed —
verification passed.

## Residuals

- NON_BLOCKING: on a zero-exit native call, merged stderr is now folded into the returned string rather than
  aborting — the intended contract (exit code remains the authority); no current call site relies on benign
  success-stderr.
