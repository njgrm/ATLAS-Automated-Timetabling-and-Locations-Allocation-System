# Deployment packet — `f36b9658` Teaching Load timetable-fit moves

Status: **SOURCE_ACCEPTED — HIGH deployment approval required.** This packet authorizes no runtime, database, generation, publication, or browser action by itself.

## Target and scope

- Target: `f36b96587003bbe7f76bbdb86935d6ae4a8ef862`
- Incumbent: re-derive immediately before action from the scheduled task, machine-scoped runtime identity, and the active release state file. Do not use a shell `ATLAS_RUNTIME_*` value.
- Expected change: Teaching Load overload redistribution now tries qualified, in-capacity receivers in the existing rank order against the generator-aligned timetable session. It chooses the first receiver with a real compatible class time, reserves that time for later suggestions/moves, and shows a plain-language “No free class time” explanation when a receiver is skipped. Coverage and distribution diagnostics are merged so neither hides the other.
- Migration: **none**. `git diff --name-only origin/main...f36b9658 -- prisma/migrations atlas-server/prisma/migrations` returned no paths.
- Rollback: the incumbent release directory and SHA discovered in the pre-action identity row; no schema rollback is needed.

## Accepted source evidence

| Gate | Result |
| --- | --- |
| Independent MEDIUM review, source commit | `ce6a2dac...5fc34f77` — ACCEPT_READY |
| Independent correction review | `5fc34f77...f36b9658` — ACCEPT_READY |
| Server production-path regression | `npx tsx --test src/__tests__/a8-c4-cover-candidates.test.ts` — 38/38 pass; the busy first receiver is skipped, the feasible next receiver is moved, and the skipped receiver is retained as a shape diagnostic |
| Client diagnostic and UI contracts | `npx tsx --test src/lib/__tests__/teaching-load-suggestion-diagnostics.test.ts src/lib/__tests__/teaching-load-suggestion-diagnostics-ui.test.ts src/lib/__tests__/tl-operator-workspace-c05.test.ts` — 42/42 pass |
| Server build | `npm run build` in `atlas-server` — pass |
| Client build | `$env:VITE_ENROLLPRO_URL='https://dev-jegs.buru-degree.ts.net'; npm run build` in `atlas-client` — pass |
| Scope check | `git diff --check` — pass; no migration paths |

## Pre-action requirements (one fresh HIGH review, then explicit approval)

1. Re-derive incumbent source directory/SHA from `ATLAS-Runtime-Supervisor`, machine environment, listener lineage, and that directory's `ops/runtime/logs/supervisor-state.json`.
2. Re-check capacity before creating a release worktree. At packet preparation: D: 76.95 GiB free; E: 66.40 GiB free. Reclaim is required if either is below the 25 GiB warning line.
3. Create `E:/ATLAS-runtime-supervised-f36b9658-<yyyymmdd>` detached at the target; run isolated `npm ci`, repo-root-schema Prisma generation, server build, and client build with the required EnrollPro URL.
4. Start only the built candidate on isolated port 5198 with rollover automation disabled; prove Node starts, then stop that PID. Do not touch 5001/5174.
5. Run the target's focused server/client gates above in the release worktree. DB-writing suites are out of scope unless the guard confirms an `atlas_restore_drill_*` disposable database.
6. Present the dry-run deploy-runner audit with exact target, re-derived incumbent, environment file, rollback directory, and no-migration assertion. Wait for explicit operator approval before `-Execute`.

## Cutover and post-action acceptance

- Use only `ops/runtime/deploy-runner.ps1`; dry-run first, then the same explicit arguments with `-Execute` in an elevated shell.
- Verify machine runtime identity, active state file, listener lineage, `/api/v1/health`, and a DB-backed scoped read. Health alone is insufficient.
- Prove served client bytes using a target-only built asset discriminator, selected and compared before cutover.
- Update `docs/plans/live-state.md` with target SHA, source directory, listeners, and rollback basis in the cutover action.
- Fresh browser QA on `/teaching-load` must open the suggestion review with a timetable-blocked receiver and confirm the visible human copy “No free class time”; it must also show distribution feedback alongside ordinary coverage feedback. Assert the Tailnet origin and capture console/network evidence. This is a post-deploy acceptance gate, not source proof.
- No Teaching Load apply, timetable generation, publication, or data edit is part of this deploy verification.

## Known boundaries

- The candidate's direct isolated Node-start probe could not be executed in this source lane because the local command policy rejected the hidden child-process invocation. It is therefore a **required pre-action gate**, not a passed claim.
- Rendered source contracts cover the updated diagnostic panel, but authenticated browser evidence is intentionally pending deployment. The packet must not be marked deployed or accepted until that separate browser row passes.

Worktree disposition: `KEEP_ACTIVE` until the target is either deployed or superseded.
