# ROLLOVER-GRADED-AUTONOMY-C01 — executor handoff

- Status: `REVIEW_REQUIRED` (never self-approved).
- Role/session: `ROLE: EXECUTOR`, single bounded MEDIUM source lane; recommended variant `high`.
- Worktree: `E:/ATLAS-worktrees/rollover-graded-autonomy-c01`
- Branch: `fix/rollover-graded-autonomy`
- Disposition: `RETIRE_AFTER_INTEGRATION`
- Risk: MEDIUM (no HIGH approval, no live/shared DB write, no runtime/task/env change, no companion edit).
- Accepted base: `b3ae9fbb797c37201508e2fc347bf47b21bbc74f` (= `origin/main`; worktree clean at base before editing).
- Source candidate commit: `5d61857b22d6c506be7fe1f15e4491449bad23ec`
  (8 files: 6 modified, 1 added test, 1 modified runtime lib; the new control suite is an addition).
- Handoff commit: the commit that adds this file (tip of `fix/rollover-graded-autonomy`).
- Directive: `AGENTS.md` read from the worktree at base (matches `origin/main:AGENTS.md`).
- Governing packet: `docs/prompts/rollover-graded-autonomy-c01-2026-09-17.md`, with **R2** governing where it
  conflicts with §1–§3 or R1. R2.1's anchor table was used to locate behaviour by symbol, never by the
  invalid §1 line table.

## Exact changed paths

| Path | Change |
|---|---|
| `atlas-server/src/services/rollover-automation.service.ts` | graded auto-apply gate; transition-triggered `ROLLOVER_DETECTED`; four unattended archive paths retired; `applyRollover` seam; `lastNotifiedDriftStatus` |
| `atlas-server/src/__tests__/rollover-graded-autonomy-c01.test.ts` | **new** DB-free control suite (controls 1–9 + subscriber contract), custom harness, `process.exitCode=1` on failure |
| `atlas-server/src/__tests__/enrollpro-rollover-automation.test.ts` | stale retired-behaviour assertions updated; RR-15A auto-retry section replaced with a retired-path control |
| `atlas-server/src/__tests__/enrollpro-rollover-lifecycle-closure.test.ts` | clean-automation section updated to sync-without-archive |
| `ops/runtime/lib/contract.mjs` | `ROLLOVER_AUTO_SYNC_ENABLED` boolean-string pass-through; `ATLAS_SUPERVISED` hard pin |
| `ops/runtime/__tests__/contract.test.mjs` | pin assertions rewritten to pass-through/accept/reject |
| `ops/runtime/__tests__/supervisor.test.mjs` | value pass-through + `ATLAS_SUPERVISED` pinned |
| `ops/runtime/__tests__/enrollpro-origin.test.mjs` | value pass-through + `ATLAS_SUPERVISED` pinned |

`ops/runtime/runtime-contract.json` is **unchanged** (`ROLLOVER_AUTO_SYNC_ENABLED: "false"`).
No client file, no operator route, no `enrollpro-rollover.service.ts`, no register/`CHANGELOG.md`/runtime-map edit.

## D1 — implemented predicate (R2.2, four conditions, deliberately)

```ts
const autoApplyGate = preview.drift.status === 'atlas-stale'
  && preview.drift.recommendedAction === 'RUN_ROLLOVER_SYNC'
  && preview.conflicts.length === 0
  && preview.reconfiguredSections.length === 0;
```

On the gate: `applyRollover(schoolId, undefined, { initiatedBy: 'system' })` (the new seam, defaulting to the
real `applyRolloverSync`), then `lastResult='success'`, `consecutiveFailures=0`,
`nextAttemptAt = now + TICK_INTERVAL_MS`, `lastNotifiedState=null`, `lastNotifiedDriftStatus=null`, and the
existing `ROLLOVER_AUTO_SYNC_COMPLETED` with an archive-free message. Every other preview is
notification-only. The reconfigured-section term is load-bearing (409
`SECTION_RECONFIGURATION_REVIEW_REQUIRED`) and is kept.

**No auto-archive (R2.3) — retired from the tick:** the post-sync archive loop, the
`isArchiveResolvableStatus` self-heal, the pending-archive marker retry, and the test-mode collision
auto-clear. `applyTestRecovery` / `applyArchiveAndSync` / `archiveYear` stay declared on
`RolloverAutomationDependencies` for throwing-spy injection, and `canAutoRecoverMarkedTestCollision` /
`isArchiveResolvableStatus` stay exported. The built module no longer emits imports for the archive
functions (type-position only), so the tick cannot reach them even transitively:
`dist/services/rollover-automation.service.js` imports only `../lib/prisma.js`,
`./enrollpro-rollover.service.js`, `./notification-events.service.js`.

## D2 — notification payload shape (R2.4)

`type: 'ROLLOVER_DETECTED'`, `domain: 'integration'`, `audience: 'PRIVILEGED'`, `severity: 'warning'`,
`schoolId`, `schoolYearId: preview.enrollProActiveYear?.id ?? 0` (0 on the unreachable health branch),
`facultyId: null`,
`message: "Rollover drift detected (<status>). <drift.message> Next action: <recommendedAction> — <plain-language hint>"`,
`metadata: { driftStatus, recommendedAction, driftMessage, conflictCount, fromYearLabel, toYearLabel }`
(`fromYearLabel = preview.mirror?.yearLabel`, `toYearLabel = preview.enrollProActiveYear?.yearLabel ?? drift.enrollProSchoolYearLabel`).

Transition trigger: emit only when `drift.status !== state.lastNotifiedDriftStatus` **and** status is not
`aligned`; always record the observed status. Not routed through `notifyOnce`. `notifyOnce` remains for the
auto-apply catch block and the outer error catch. Replaces the attention calls at the unreachable,
conflict, and reconfigure-pending branches. Bounded backoff preserved (`computeNextBackoff` capped at
`MAX_BACKOFF_MS`).

## D3 — invariant unpin (R2.7)

`ops/runtime/lib/contract.mjs`: `ROLLOVER_AUTO_SYNC_ENABLED` must be the string `'true'` or `'false'`
(fail-closed against `'yes'`, `'TRUE'`, `''`, `1`, `null`); `ATLAS_SUPERVISED` is now a hard pin to
`'true'`. `resolveInvariantEnv` still passes declared values through unchanged. The service kill-switch
(`ENABLED`, `startRolloverAutomation`) is unchanged.

## Mandatory control matrix (R2.6) — all through the real dependency seam, no database

Command for controls 1–9 (from `atlas-server`):
`npx tsx src/__tests__/rollover-graded-autonomy-c01.test.ts` → **189 passed, 0 failed, exit 0**.

| # | Control | Result | Observed |
|---|---|---|---|
| 1 | Gate holds | PASS | `applied`; apply called exactly once with `(schoolId, undefined, {initiatedBy:'system'})`; one `ROLLOVER_AUTO_SYNC_COMPLETED`; zero `ROLLOVER_DETECTED`; completion message has no "archiv"; three archive spies 0 |
| 2 | Any conflict | PASS | `applies=0`, `action='conflict'`; one `ROLLOVER_DETECTED` with `driftStatus='atlas-stale'`, `conflictCount=1`; spies 0 |
| 2b | Year Setup subscriber | PASS | real bus: `subscribeSchoolNotificationEvents` receives exactly one `ROLLOVER_DETECTED` (audience PRIVILEGED, domain integration, conflictCount 1) |
| 3 | `RUN_ARCHIVE_AND_SYNC` / `mapping-conflict` / `enrollpro-unreachable` | PASS | all three: `applies=0`; one `ROLLOVER_DETECTED` each; spies 0 |
| 4 | Unchanged drift status | PASS | tick 1 notifies once; tick 2 (backoff bypassed) runs and does **not** re-notify; a real status change re-notifies exactly once with the new status |
| 5 | Never-archive across every scenario + pending-archive-marker + test-mode collision + reconfigure-pending | PASS | three throwing spies 0, `applyRollover` 0, `classifyRecovery` 0; pending-marker scenario returns `skipped` (retired path, no DB lookup); test-mode collision returns `conflict`; reconfigure-pending returns `reconfigure-pending` with no apply |
| 6 | Two overlapping ticks | PASS | second returns `skipped`/`Already applying`; exactly one apply, one completion |
| 7 | EnrollPro unreachable | PASS | `unreachable`; `nextAttemptAt` grows 300s→600s, capped `≤ MAX_BACKOFF_MS+1s`; one notification on the transition, none on the retry; `applies=0` |
| 8 | Second tick after success | PASS | aligned post-apply tick returns `skipped`; `applies` stays 1; no duplicate completion; no detection |
| 9 | Fresh process `ROLLOVER_AUTO_SYNC_ENABLED=false` | PASS | child process (`node --import tsx -e`): `getAutomationStatus().enabled=false`, `Disabled via ROLLOVER_AUTO_SYNC_ENABLED=false` logged, `schools=0` (no timer, no detection) |
| 10 | MUTANT restoring unconditional auto-apply on drift | PASS | see below |

## Control 10 mutant and byte-exact restore

Mutation applied to `atlas-server/src/services/rollover-automation.service.ts`:

```ts
// before (candidate)
const autoApplyGate = preview.drift.status === 'atlas-stale'
  && preview.drift.recommendedAction === 'RUN_ROLLOVER_SYNC'
  && preview.conflicts.length === 0
  && preview.reconfiguredSections.length === 0;
// mutant
const autoApplyGate = preview.drift.status !== 'aligned';
```

- Before SHA-256: `BADDCBC9AAAFD35AFCF66961B54C91562498DAE68EBF1108101343417842899E`
- Mutant SHA-256: `7B1A434093592E341EA607519D9366514604C7E0CB63BAB6CF2331525FEC5704`
- After restore SHA-256: `BADDCBC9AAAFD35AFCF66961B54C91562498DAE68EBF1108101343417842899E` → **byte-exact restore**
- Mutant run: `npx tsx src/__tests__/rollover-graded-autonomy-c01.test.ts` → 100 passed, **33 failed**, exit 1.
  Decisive failures:
  - Control 2: `conflicted drift never auto-applies expected 0, got 1`; `tick reports the manual conflict expected conflict, got applied`; `one ROLLOVER_DETECTED expected 1, got 0`.
  - Control 3: for each of `RUN_ARCHIVE_AND_SYNC` / `mapping-conflict` / `enrollpro-unreachable` — `never auto-applies expected 0, got 1`; `action is notification-only expected <conflict|skipped>, got applied`; `exactly one ROLLOVER_DETECTED expected 1, got 0`.
  - Control 4: `first observation notifies once expected 1, got 0`; `second tick actually runs expected conflict, got applied`; `changed-status tick runs expected conflict, got applied`.
  - Control 5: `no auto-apply expected 0, got 1` for conflict / `RUN_ARCHIVE_AND_SYNC` / reconfigure-pending / test-mode collision; `no auto-apply with unacknowledged sections expected reconfigure-pending, got applied`; `no unattended test-data clear expected conflict, got applied`.
- Post-restore re-run: 189 passed, 0 failed, exit 0.

## Updated-test inventory and justifications

| Test file | Change | Justification |
|---|---|---|
| `atlas-server/src/__tests__/rollover-graded-autonomy-c01.test.ts` (new) | controls 1–10 + subscriber contract, no DB | R2.6 requires seam-driven proof; the packet permits no-database controls |
| `.../enrollpro-rollover-automation.test.ts` — `A realistic unmarked section collision stays manual` | marked test-mode collision now expects `conflict`, `recoveryApplyCalls=0`, `classifyCalls=0`, one `ROLLOVER_DETECTED` | the test-mode auto-clear was retired by R2.3 |
| `.../enrollpro-rollover-automation.test.ts` — RR-09B archive-resolvable section | retitled "…notify instead of self-healing"; expects `conflict`, `archiveAndSyncActiveYear` 0, one `ROLLOVER_DETECTED` naming `RUN_ARCHIVE_AND_SYNC` | the self-heal was retired by R2.3 |
| `.../enrollpro-rollover-automation.test.ts` — RR-09B non-resolvable conflict | `lastNotifiedState` now `null`; one `ROLLOVER_DETECTED` | `notifyOnce` no longer runs on this path (R2.4) |
| `.../enrollpro-rollover-automation.test.ts` — RR-09B clean sandbox | expects **not** archived, 0 `ARCHIVE_SCHOOL_YEAR`, no archive metadata/message | no auto-archive is absolute (R2.3/R2.5) |
| `.../enrollpro-rollover-automation.test.ts` — RR-15A retry section | replaced by `RR-15A retired: the tick never performs unattended archival or test-data clearing` (real pending marker + marked collision; three throwing spies 0, classifier 0, marker/year untouched) | the pending-archive retry path was retired by R2.3; the service-level recovery/archival behaviour is still covered by the lifecycle-closure suite |
| `.../enrollpro-rollover-lifecycle-closure.test.ts` — RR-15F clean automation | old year deactivated but **not** archived; 0 archive audits; no archive metadata/message; 0 `ROLLOVER_DETECTED` on the apply path | matches the new tick contract |
| `ops/runtime/__tests__/contract.test.mjs` | shipped contract must declare a valid boolean string and pass it through; `'true'` accepted; invalid values rejected; `ATLAS_SUPERVISED` non-`'true'` rejected | R2.7 |
| `ops/runtime/__tests__/supervisor.test.mjs` | ports still pinned; rollover control passed through; `ATLAS_SUPERVISED='true'`; added an enabled pass-through case | R2.7 |
| `ops/runtime/__tests__/enrollpro-origin.test.mjs` | rollover value passed through; `ATLAS_SUPERVISED='true'` | R2.7 |

**Removed assertions (all replaced, none silently dropped):**

1. `Marked mapping-conflict enters the auto-recovery path in test mode` (`action==='applied'`) and
   `Marked mapping-conflict invokes recovery exactly once` (`===1`) → replaced by the retired-path
   assertions above. Original requirement: RR-15A test-mode auto-clear, retired by R2.3.
2. `Archive-resolvable conflict self-heals (applied)`, `Automation records success for the self-heal`,
   `archiveAndSyncActiveYear invoked exactly once`, `Self-heal runs with initiatedBy system` → replaced by
   conflict/zero-invocation/detection assertions. Original requirement: RR-09B self-heal, retired by R2.3.
3. `Attention notification state recorded for manual conflicts` (`lastNotifiedState ===
   'ROLLOVER_ATTENTION_REQUIRED:conflict'`) → replaced by `lastNotifiedState === null` + one
   `ROLLOVER_DETECTED`. Original requirement: attention dedupe, superseded by the transition axis (R2.4).
4. `Superseded year archived automatically after the sync`, `ARCHIVE_SCHOOL_YEAR audit written with
   initiatedBy system`, `Completion notification carries archive metadata`, `Archive metadata names the
   superseded year`, `Completion message mentions the archive` → replaced by the no-archive equivalents.
   Original requirement: RR-09B post-sync archive, retired by R2.3.
5. The RR-15A pending-archive retry block (`Tick 1 returns archive-pending`, `Tick 4 completes the pending
   archival`, `Superseded year archived by the retry completion`, `Marker archivesApplied=true after
   completion`, bus `TEST_YEAR_RECOVERY_*` counts, backoff/partial-success assertions, 5-tick sequence) →
   replaced by the retired-path section. Original requirement: RR-15A unattended archive retry, retired
   by R2.3. Replacement coverage for the surviving service behaviour (`applyTestYearRecovery`,
   `archiveSchoolYear`) is the lifecycle-closure suite (208/0).
6. Removed the now-unused `subscribeNotificationEvents` / `NotificationEvent` import in the automation
   suite (no assertions involved).

No test file was deleted; no assertion was removed without replacement coverage.

## Seams proven never invoked

`RolloverAutomationDependencies.applyTestRecovery`, `.applyArchiveAndSync`, `.archiveYear` — injected as
throwing spies in controls 1/2/3/4/5, 6, 7, 8 and in the RR-15A retired-path section; all recorded 0.
`.classifyRecovery` — 0 invocations in control 5 and the retired-path section. The tick's only writer is
the injected `.applyRollover` (default `applyRolloverSync`).

## §5 always-run inventory

| Item | Result |
|---|---|
| `ops/runtime/__tests__/contract.test.mjs` | rewritten per R2.7 — `npm run runtime:test` 77 passed / 0 failed / 0 skipped, exit 0 |
| `ops/runtime/__tests__/supervisor.test.mjs:148` (now 148/155) | value pass-through + `ATLAS_SUPERVISED` pinned — green |
| `ops/runtime/__tests__/enrollpro-origin.test.mjs:79` | value pass-through + `ATLAS_SUPERVISED` pinned — green |
| `ops/runtime/__tests__/lifecycle.e2e.test.mjs:42-43,74` | re-run, **unchanged** (invariant model unchanged) — green |
| `atlas-server/src/__tests__/enrollpro-rollover-automation.test.ts` | updated, 67 passed / 0 failed, exit 0 (disposable DB) |
| `atlas-server/src/__tests__/enrollpro-rollover-lifecycle-closure.test.ts` | updated, 208 passed / 0 failed, exit 0 (disposable DB) |

## Commands actually run (exit status)

| Command (cwd) | Exit | Result |
|---|---|---|
| `git status --porcelain=v2` / `git rev-parse HEAD` (worktree) | 0 | clean at base `b3ae9fbb` |
| `npx tsc --noEmit` (`atlas-server`) | 0 | no errors |
| `npx tsx src/__tests__/rollover-graded-autonomy-c01.test.ts` (`atlas-server`) | 0 | 189 passed / 0 failed |
| `npx tsx src/__tests__/enrollpro-rollover-lifecycle-closure.test.ts` (`atlas-server`, disposable DB) | 0 | 208 passed / 0 failed |
| `npx tsx src/__tests__/enrollpro-rollover-automation.test.ts` (`atlas-server`, disposable DB) | 0 | 67 passed / 0 failed |
| `npm run build` (`atlas-server`) | 0 | tsc + `dist/server.js` emitted |
| `node -e "import('./dist/services/rollover-automation.service.js')…"` (`atlas-server`) | 0 | `RUNTIME_IMPORT_OK tick=function start=function` |
| `node dist/server.js` on isolated `PORT=5233` (`atlas-server`) | started/stopped | `/api/v1/health` 200, `/api/v1/health/ready` 200 `{"database":"ok"}`, `Disabled via ROLLOVER_AUTO_SYNC_ENABLED=false`; 5001/5174 PIDs 13244/13260 untouched |
| `npm run runtime:test` (repo root) | 0 | 77 passed / 0 failed / 0 skipped |
| `npm run test:notifications` (`atlas-server`) | 1 | `BLOCKED(PRE_EXISTING_MISSING_SCRIPT_TARGET)`: `src/__tests__/notification-events.test.ts` absent at base `b3ae9fbb` (removed by `4794bd9e`); script unchanged base→candidate |
| `npm run test:rollover-readiness` (`atlas-server`) | 1 | `BLOCKED(PRE_EXISTING_MISSING_SCRIPT_TARGET)`: `src/__tests__/enrollpro-rollover-readiness.test.ts` absent at base `b3ae9fbb`; script unchanged base→candidate |
| `git diff --check` (all staged) | 0 | clean |

The two blocked npm scripts reference tracked-absent files at the accepted base; both were verified absent
in `b3ae9fbb` (`git cat-file -e` fails) and are untouched by this candidate. Subscriber delivery of
`ROLLOVER_DETECTED` is instead proven by control 2b on the real notification bus.

## Dependency provisioning (junction, read-only)

- `atlas-server/node_modules` is a junction to
  `E:\ATLAS-worktrees\export-presentation-s15-rebaseline\atlas-server\node_modules` (real directory, not a
  junction itself; target worktree clean).
- Lockfile identity checked: `atlas-server/package-lock.json` SHA-256
  `ECF06AEF5C385591A0CF4C03F6852018B283182375F9B23656210BF13794B6E5` matches the target exactly.
- `prisma/schema.prisma` and the 4 migration directories match the target. No install ran through or
  alongside the junction. The junction is ignored by Git and is an untracked local provision only.

## Disposable database (guarded pattern)

- Resolved host `localhost`, port `5432`, database `atlas_restore_drill_20260917_c01`,
  classification `DISPOSABLE`, `schools=1` (minimal fixture: school 1 + active mirror year 9 +
  one active faculty mirror, required by the automation suite's live-state premise), `migrations=4`
  (`prisma migrate deploy` applied only inside it).
- Never targeted `atlas_recovery_clean_rebuild_20260905` or any shared/live database.
- Cleanup: `DROP DATABASE IF EXISTS` after terminating backends → `DROPPED … remaining=0` (zero residue).
  No secret value was printed; only host/port/db name and counts.

## Boundaries and zero-mutation statement

- Source only. No live/shared database write, no register write, no `ops/runtime` deployment, no
  runtime/ports/task/env change, no companion edit, no client edit, no `enrollpro-rollover.service.ts` edit.
- `ROLLOVER_AUTO_SYNC_ENABLED` remains `"false"` in the shipped `ops/runtime/runtime-contract.json`;
  enabling it is a separately approved deployment/config decision.
- The two ports 5001/5174 were never bound or touched; the isolated startup used port 5233 only.
- Zero mutation to the shared runtime, the live database, scheduled tasks, or companion repositories.

## Source/live tracks

- `SOURCE_IMPLEMENTATION`: `GO` (candidate committed; all mandatory source controls pass).
- `LIVE_RUNTIME`: `NOT_APPLICABLE` — no deployment is authorized or attempted by this lane; the unpin and
  the graded tick only take effect in a separately approved deployment.

## Risks and residuals (all NON_BLOCKING)

- The `action` union still declares the now-unreachable `'archive-pending'` member for API compatibility;
  no path returns it.
- The automation suite's live-school-1 sections are premise-dependent; its pass required a minimal seeded
  school-1 fixture in the disposable database (documented above). In an unseeded disposable database the
  same suite reports exactly those premise assertions as failures (base and candidate alike).
- The `test:notifications` / `test:rollover-readiness` npm targets are pre-existing base defects.
- `classifyRecovery` remains a declared-but-unused dependency seam (kept for injector compatibility).

## Worktree disposition

`RETIRE_AFTER_INTEGRATION` — the worktree is clean apart from the ignored junction; remove it with
non-forced `git worktree remove` after integration. No branch deletion.
