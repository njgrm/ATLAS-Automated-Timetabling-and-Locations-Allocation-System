# ROLLOVER-GRADED-AUTONOMY-C01 — executor packet (ordinary MEDIUM source lane)

Status: authored 2026-09-17 (Asia/Manila). Operator decision applied: *"when EnrollPro rolls its active
year, ATLAS rolls too, unattended"* — implemented as **graded autonomy** (unattended in the provably
trivial case, human-confirmed when consequential), with **no automatic archive**. Ordinary MEDIUM source
work: no HIGH approval, no register write by the lane, no database write.

## 0. Identity

- Directive: `origin/main:AGENTS.md`, blob `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88`,
  LF-SHA-256 `7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3`. Read from Git bytes;
  NEVER use `D:/ATLAS/AGENTS.md` (stale).
- Base: `origin/main` at dispatch. Authoring base `6058d3ab`.
- Worktree `E:/ATLAS-worktrees/rollover-graded-autonomy-c01`, branch `fix/rollover-graded-autonomy`,
  disposition `RETIRE_AFTER_INTEGRATION`. Risk MEDIUM.

## 1. Current behaviour and why it is pinned (evidence)

`atlas-server/src/services/rollover-automation.service.ts:2-5` — *"periodically checks each school's
rollover drift state and automatically applies `applyRolloverSync` when the drift is [detected]"*, on a
`TICK_INTERVAL_MS` default of 300 000 ms (`:37`).

On a fresh rollover the apply runs **cleanup -> sync -> cycle verify -> archive -> notify** (`:2175`),
writing (all verified by reading the source):

| Step | Write | Line |
|---|---|---|
| Cleanup | `teachingLoadCycle.deleteMany`, and in the clear phase `subjectSectionOwnership.deleteMany`, `facultySubject.deleteMany`, `teachingLoadCycle.deleteMany` for the **target** year | `:1859`, `:1910-1912` |
| Faculty sync | `syncFacultyFromExternal(schoolId, activeYear.id, ...)` | `:1550` |
| Section sync | `syncSectionsFromExternal(schoolId, activeYear.id, ...)` | `:1557` |
| TL cycle | `tx.teachingLoadCycle.upsert({...})` | `:1626` |
| Active mirror | `enrollProSchoolYearMirror.upsert({...})` | `:1667` |
| Audit | `auditLog.create({...})` x2 | `:1633`, `:1701` |
| **Archive** | `archiveSchoolYear({...})` for **every non-archived superseded year** | `:2095-2118` |

It is pinned **off** by a hard supervisor invariant:

```
ops/runtime/lib/contract.mjs:59-60
  if (invariants.ROLLOVER_AUTO_SYNC_ENABLED !== 'false') {
    throw fail('RUNTIME_CONTRACT_INVALID',
      'invariants.ROLLOVER_AUTO_SYNC_ENABLED must be the pinned string "false".');
  }
```
asserted by `ops/runtime/__tests__/contract.test.mjs:41-42,48`, `supervisor.test.mjs:148`,
`enrollpro-origin.test.mjs:79` (*"pinned invariants stay pinned"*).

The application's own default is **enabled** (`rollover-automation.service.ts:35`:
`process.env.ROLLOVER_AUTO_SYNC_ENABLED !== 'false'`), so today the **supervisor** is the only thing
holding it off. The operator surface and the explicit path already exist:
`POST /rollover-sync/preview` + `/rollover-sync/apply` (`routes/runtime.router.ts:256`, `:270`),
`AdminYearSetup.tsx`, and `RolloverGuidanceCard.tsx:323` which already calls
`applyRolloverSync(schoolId, {...})` with a reconfigured-section acknowledgement.

## 2. Required corrections

**2.1 Graded autonomy in the tick — apply unattended ONLY in the provably trivial case.**
Keep polling and drift detection. After `previewRollover(schoolId)` (`:177`), evaluate the graded
predicate and choose:

- **AUTO-APPLY** only when **all** hold: zero conflicts, zero reconfigured sections, and the target year's
  Teaching Load is **empty** (so the cleanup `deleteMany`s at `:1859`/`:1910-1912` are provable no-ops).
  Then apply exactly as today with `applyRolloverSync(schoolId, undefined, { initiatedBy: 'system' })`.
- **NOTIFY AND DO NOT APPLY** otherwise. Emit a typed, idempotent notification carrying the preview
  summary: from-year -> to-year, conflict count, reconfigured-section count, and target-year TL occupancy,
  with a next action that routes the operator to `AdminYearSetup` / the rollover guidance card.
  The existing `ROLLOVER_ATTENTION_REQUIRED` path (`:344`, `:359`) is the precedent; add a distinct
  `ROLLOVER_DETECTED` type only if the existing type cannot carry the summary.

**2.2 Never auto-archive.** The automation must **not** call `archiveSchoolYear` /
`archiveSupersededYearsForRecovery` (`:2089-2118`). Superseding the previous year becomes an explicit
operator step on the existing surface. Do not delete the archive code — make it operator-invoked only.

**2.3 Unpin the invariant.** Remove the hard pin at `ops/runtime/lib/contract.mjs:59-60` so
`ROLLOVER_AUTO_SYNC_ENABLED` becomes a real environment control, and update the three tests that assert the
pin (`contract.test.mjs:41-42,48`; `supervisor.test.mjs:148`; `enrollpro-origin.test.mjs:79`) to assert the
new contract (value passed through; `ATLAS_SUPERVISED=true` still pinned). Keep a working kill-switch:
`ROLLOVER_AUTO_SYNC_ENABLED=false` must still disable everything.

**2.4 Guards preserved or added.** Single-flight per school (no double-fire on overlapping ticks);
EnrollPro-unreachable bounded backoff and `ROLLOVER_ATTENTION_REQUIRED` (`:173`); the existing
archive-only and recovery completion markers (`:2017-2060`) must keep working; idempotency — a second tick
over an already-applied rollover must be a no-op; deterministic behaviour with no notification storms
(`notifyOnce` dedupe by `type:lastResult`).

## 3. Mandatory failing-first controls

Use a disposable database and a synthetic drift (EnrollPro active year ahead of ATLAS's). Drive
`tickRolloverAutomation` through its real dependency seam (the `RolloverAutomationDependencies` type at
`:40-50`) rather than by editing internals.

| # | Control | Expected |
|---|---|---|
| 1 | Drift + zero conflicts + zero reconfigured sections + target TL empty | **auto-applies** once; TL cycle and mirrors updated for the new year; one completion notification |
| 2 | Same, but the preview reports conflicts | **does not apply**; `ROLLOVER_DETECTED`/`ATTENTION_REQUIRED` carries the conflict count; zero writes to the target year |
| 3 | Same, but sections were reconfigured | **does not apply**; notification names the count and routes to the acknowledgement surface |
| 4 | Same, but the target year already has Teaching Load rows | **does not apply**; notification reports the occupancy; **no `deleteMany` executed** |
| 5 | Any auto-applied case | `archiveSchoolYear` is **never** called; the superseded year is left non-archived |
| 6 | Two overlapping ticks | exactly one apply (single-flight) |
| 7 | EnrollPro unreachable | bounded backoff, attention notification, no apply |
| 8 | Second tick after a successful apply | no-op, no duplicate audit/mirror writes |
| 9 | `ROLLOVER_AUTO_SYNC_ENABLED=false` | whole automation disabled, including detection |
| 10 | MUTANT: restore unconditional auto-apply on drift | controls 2, 3, 4 and 5 must fail a decisive committed test, then be restored byte-exactly |

## 4. Gates

Rollover-automation, rollover-service, notification-events, runtime-contract
(`ops/runtime/__tests__/*.test.mjs`) suites; server `tsc` + production build; built-server startup with
explicit `.js` ESM runtime-import proof; `git diff --check`; fresh independent QA over the frozen
candidate; clean current-main integration with exact candidate-tree parity; fresh Wave Completion Auditor.

## 5. Always-run test inventory (name each; no silent deletion)

`ops/runtime/__tests__/contract.test.mjs` (the pin assertions), `supervisor.test.mjs:148`,
`enrollpro-origin.test.mjs:79`, `lifecycle.e2e.test.mjs` (`:42-43`, `:74` reference the invariant), and any
rollover-automation suite that asserts the current unconditional-apply behaviour. Every change must be
justified against the operator's decision in the handoff.

## 6. Boundaries and sequencing

Source only. No database write, no register write by the lane, no `ops/runtime` deployment, no
runtime/ports/task/env change in this lane, no companion edit. The client surface may be touched only to
expose the detected state; the apply flow already exists.

**Sequencing:** the unpinned invariant and the new server behaviour only take effect in a **deployment**.
This lane should therefore integrate before the next deployment, and the operator must decide whether that
deployment carries it. Until then the live runtime remains pinned off — which is safe.

## 7. Return contract

Base/candidate/integration/final-main SHAs; changed paths; the graded-predicate definition; the
per-control results including the mutant and its byte-exact restore; the notification payload shape; the
list of updated tests with justifications; whether any assertion was removed and why; QA/audit tallies;
push state; disposition; single next action.
`REVIEW_REQUIRED` only; never self-approve, merge, or push.

---

## R1 — SCOPE NARROWED after reconnaissance (supersedes §2.1's predicate and §3's control set)

**Finding: most of this is already built and already live** in the deployed release `54dce67b`.
Reconnaissance (2026-09-17) established that the following exist today and **must not be rebuilt**:

- `GET /runtime/rollover-status` already returns `drift.status` (`aligned` / `atlas-stale` /
  `mapping-conflict` / `enrollpro-unreachable`), `drift.recommendedAction` (`NONE` /
  `RUN_ROLLOVER_SYNC` / `RUN_ARCHIVE_AND_SYNC`), `drift.message`, `conflicts`, and reconfigured sections.
- The UI already surfaces drift in four places — `RolloverGuidanceCard` (Year Setup) with badges,
  plain-language labels, **dismiss persistence that re-shows on a drift-status change**, and a
  **conflict-gated apply**; `Dashboard` (`rolloverBlocking`); `TimetableSimpleHeader` and
  `ScheduleReviewWorkspaceHeader` (`driftBlocked` / `driftMessage`); plus the recovery paths
  (`/rollover-recovery/{classify,preview,apply}`, `mark-test-data`, `scaffold`), `RolloverResetPanel`, and
  `termRepairOnly` term-authority repair.
- The existing gate is already the safety predicate:
  `canApply = drift.recommendedAction === 'RUN_ROLLOVER_SYNC' && conflicts.length === 0`.

**R1.1 — Reuse the existing gate; do NOT invent a new predicate.** Replace §2.1's bespoke predicate
(zero conflicts / zero reconfigured sections / empty target-year Teaching Load) with the codebase's own
verdict:

```
AUTO-APPLY only when drift.recommendedAction === 'RUN_ROLLOVER_SYNC' && conflicts.length === 0
```

Any other status — `mapping-conflict`, `atlas-stale` requiring archive, `enrollpro-unreachable`, or any
non-empty conflicts — **notifies and does not apply**. This keeps the automation and the operator UI on one
safety contract, and removes the need for new no-op analysis.

**R1.2 — The new work is exactly two things.**
(a) **Unattended detection with a transition-triggered notification.** Poll as today, compute status
through the existing service, and notify **only on a status transition** (pattern precedent: the
`RolloverGuidanceCard` dismiss key is per drift status), never on every tick. The notification carries the
existing `drift.status`, `drift.recommendedAction`, `drift.message`, and the conflict count.
(b) **Auto-apply under R1.1's gate, with no auto-archive** (unchanged from §2.2).

**R1.3 — Explicitly out of scope for this lane.** Do not modify, duplicate, or refactor: the
`RolloverGuidanceCard` / `RolloverResetPanel` / `SimpleDriftBanner` surfaces, the preview/confirm flow, the
conflict gating, the reconfigured-section acknowledgement, the recovery classify/preview/apply paths, the
dummy-year reset, `mark-test-data`, or the term-repair surfacing. The client may be touched only if a
notification must deep-link into the existing Year Setup surface.

**R1.4 — Revised control set (replaces §3 rows 1-5; rows 6-10 stand).**

| # | Control | Expected |
|---|---|---|
| 1 | Drift with `recommendedAction === 'RUN_ROLLOVER_SYNC'` and `conflicts.length === 0` | auto-applies once; one completion notification |
| 2 | Drift with any conflict | does not apply; notification carries `drift.status` and the conflict count; zero target-year writes |
| 3 | Drift with `recommendedAction === 'RUN_ARCHIVE_AND_SYNC'` (or `mapping-conflict`, or `enrollpro-unreachable`) | does not apply; notification only |
| 4 | Status unchanged across consecutive ticks | **no** repeat notification (transition-triggered only) |
| 5 | Any auto-applied case | `archiveSchoolYear` / `archiveSupersededYearsForRecovery` is **never** called |
| 6-10 | unchanged | single-flight; unreachable backoff; idempotent second tick; `=false` kill-switch; MUTANT restoring unconditional auto-apply must fail controls 2-5 |

**R1.5 — Value statement (so the lane is not oversold).** Two thirds of the originally proposed packet
was redundant with live behaviour. After R1 the lane adds exactly: unattended detection, the
transition-triggered notification, auto-apply under the pre-existing gate, and the invariant unpin. If the
operator judges even that insufficient to justify a cycle, the honest alternative is to leave the
supervisor pin in place and rely on the existing Year Setup surface — say so rather than building it for
its own sake.

---

## R2 — PLANNER VERIFICATION AND CORRECTIONS (governs where it conflicts with sections 1–3 or R1)

Authored 2026-09-17 by the head planner after reading the real base tree at `43341ac7`. R1 stands except
where R2.2 and R2.3 correct it.

### R2.1 The section-1 line table is not valid evidence

The packet's line references do not resolve against any version of this file. At the dispatch base,
`atlas-server/src/services/rollover-automation.service.ts` is **612 lines**; section 1 cites `:1550`,
`:1626`, `:1667`, `:1859`, `:1910-1912`, `:2095-2118`, `:2175`, and section 2.4 cites `:2017-2060`. Those
anchors are **not** evidence and must not be treated as authoritative. Locate behaviour by symbol.

Planner-verified anchors (base `43341ac7`):

| Item | Real anchor |
|---|---|
| `ENABLED` = `process.env.ROLLOVER_AUTO_SYNC_ENABLED !== 'false'` | `rollover-automation.service.ts:35` |
| `TICK_INTERVAL_MS` default 300000 / `MAX_BACKOFF_MS` default 1800000 | `:37-38` |
| `RolloverAutomationDependencies` seam | `:40-51` |
| `SchoolAutomationState` (`lastResult`, `lastNotifiedState`, `currentlyApplying`) | `:55-63` |
| `notifyOnce` (dedupe key is `type:lastResult`) | `:114-134` |
| `tickRolloverAutomation` | `:138-427` |
| unreachable + bounded backoff | `:168-175` |
| `previewRollover(schoolId)` | `:177` |
| pending-archive marker retry (`applyTestRecovery`) | `:188-245` |
| test-mode collision auto-clear (`applyTestRecovery`) | `:249-307` |
| conflicts branch | `:309-346` |
| archive-resolvable self-heal (applies and archives) | `:314-339` |
| non-aligned skip | `:348-353` |
| reconfigured-section guard | `:355-361` |
| auto-apply call | `:363` |
| post-sync archive loop | `:369-392` |
| completion notification | `:394-416` |
| `withSchoolLock` / `runTick` / `startRolloverAutomation` | `:444-462` / `:466-477` / `:479-494` |
| `getAutomationStatus` | `:590-612` |
| `buildDriftState` (the drift verdict) | `enrollpro-rollover.service.ts:424-479` |
| `resolveMappingConflictAction` / `isArchiveResolvableConflict` | `:402-422` / `:398-400` |
| `applyRolloverSync` unacknowledged-reconfigure rejection (409 `SECTION_RECONFIGURATION_REVIEW_REQUIRED`) | `:1524-1542` |
| `archiveSchoolYear` definition / callers | `:1198` / `:1355`, `:2103`, tick `:378` |
| `archiveSupersededYearsForRecovery` | `:2089`, called from `:2377` inside `applyTestYearRecovery` (`:2186`) |
| `archiveAndSyncActiveYear` | `:1334`; tick caller `:316`; operator route `runtime.router.ts:387` |
| operator surfaces (do not touch) | `runtime.router.ts:122,145,158,183,213,227,238,256,270,323,369,387,400` |

Two further verified facts that change the plan:

- `drift.status === 'atlas-stale'` and `recommendedAction === 'RUN_ROLLOVER_SYNC'` are the **same**
  condition in `buildDriftState` (`:458-468`); `aligned` maps to `NONE` (`:470-478`),
  `enrollpro-unreachable` to `RETRY_ENROLLPRO` (`:433-443`), and `mapping-conflict` to
  `RUN_ARCHIVE_AND_SYNC` / `RESET_DUMMY_YEAR` / `REVIEW_MAPPING_CONFLICT` (`:445-456`).
- `reconfiguredSections` is computed independently (`:1025`) and attached separately (`:1068`), so
  `RUN_ROLLOVER_SYNC` **can** coexist with reconfigured sections.

### R2.2 The auto-apply gate is the intersection — not R1.1's two-term quotation

Because `applyRolloverSync` hard-rejects unacknowledged reconfigured sections with
`409 SECTION_RECONFIGURATION_REVIEW_REQUIRED` (`:1524-1542`), and the product's own guidance says
"Review and acknowledge the changes before syncing" (`:813`), R1.1's literal predicate
(`RUN_ROLLOVER_SYNC && conflicts.length === 0`) would drop a load-bearing guard, breach R1.3's
instruction not to modify the reconfigured-section acknowledgement, and convert a clean notification into
a 409-driven failure/backoff loop.

**Required predicate — all four conditions:**

```ts
drift.status === 'atlas-stale'
  && drift.recommendedAction === 'RUN_ROLLOVER_SYNC'
  && conflicts.length === 0
  && reconfiguredSections.length === 0
```

Any other preview notifies and does not apply. This is R1.1's actual intent: one safety contract shared
with the operator UI.

### R2.3 No auto-archive is absolute

The automation must never reach `archiveSchoolYear`, `archiveSupersededYearsForRecovery`,
`archiveAndSyncActiveYear`, or `applyTestYearRecovery` — directly or through a dependency seam. Retire
from the tick: (i) the post-sync archive loop `:369-392`; (ii) the `isArchiveResolvableStatus` self-heal
apply `:314-339`; (iii) the pending-archive marker retry `:188-245`; (iv) the test-mode collision
auto-clear `:249-307`. Any tick that would previously have taken those paths now falls through to the
R2.4 notification.

**Disclosed conflict:** section 2.4 asks that the recovery-completion markers "keep working", while the
operator's instruction for this cycle is "NO auto-archive ever". The operator instruction governs. The
durable marker machinery and the operator routes inside `enrollpro-rollover.service.ts` stay untouched, so
an operator can still complete a pending recovery or archiving; only the unattended completion is retired.
Restoring the pending-archive retry is a separate bounded lane if the operator wants it.

Keep the three archive-producing seams (`applyArchiveAndSync`, `archiveYear`, `applyTestRecovery`) in
`RolloverAutomationDependencies` so the never-archive control can inject throwing spies, and keep the
exported helper functions.

### R2.4 Notification contract

Add event type `ROLLOVER_DETECTED` (`NotificationEvent.type` is a plain string, so no union change).
Shape: `domain: 'integration'`, `audience: 'PRIVILEGED'`, `severity: 'warning'`, `schoolId`,
`schoolYearId: preview.enrollProActiveYear?.id ?? 0`, `facultyId: null`, a `message` naming the drift
status and the next action, and
`metadata: { driftStatus, recommendedAction, driftMessage, conflictCount, fromYearLabel, toYearLabel }`.
`audience: 'PRIVILEGED'` plus `domain: 'integration'` is required for the Year Setup subscriber to receive
it (`notification-events.service.ts:48-56`).

**Transition trigger:** add `lastNotifiedDriftStatus` to `SchoolAutomationState`. Emit at most one
notification per observed drift-status change — emit only when
`preview.drift.status !== state.lastNotifiedDriftStatus` and the status is not `aligned`; always record the
observed status. Do not route this through `notifyOnce` (its key is `type:lastResult`, a different axis).
Replace the `notifyOnce(ROLLOVER_ATTENTION_REQUIRED, ...)` attention calls at `:173`, `:344`, `:359` with
this single transition-triggered notification, so one status change produces exactly one notification.
Keep `notifyOnce` for genuine failure/error paths and the bounded-backoff retry notices.

### R2.5 Auto-apply definition

When the R2.2 gate holds: call `applyRolloverSync(schoolId, undefined, { initiatedBy: 'system' })` exactly
as today, set `lastResult='success'`, `consecutiveFailures=0`, `nextAttemptAt = now + TICK_INTERVAL_MS`,
`lastNotifiedState=null`, `lastNotifiedDriftStatus=null`, and publish the existing
`ROLLOVER_AUTO_SYNC_COMPLETED` with a message that no longer claims any archived year. No archive call and
no write beyond what `applyRolloverSync` already performs.

### R2.6 Mandatory controls (R1.4 rows 1–5 as corrected, plus 6–10)

Drive `tickRolloverAutomation` through the real dependency seam. Use a **disposable** database only.

| # | Control | Expected |
|---|---|---|
| 1 | Gate holds (atlas-stale, `RUN_ROLLOVER_SYNC`, zero conflicts, zero reconfigured) | applies exactly once; one `ROLLOVER_AUTO_SYNC_COMPLETED`; **zero** archive-seam invocations; no `ROLLOVER_DETECTED` |
| 2 | Any conflict | does not apply; `ROLLOVER_DETECTED` carries `driftStatus` + `conflictCount`; zero target-year writes |
| 3 | `RUN_ARCHIVE_AND_SYNC`, `mapping-conflict`, or `enrollpro-unreachable` | does not apply; notification only |
| 4 | Unchanged drift status across consecutive ticks | exactly one notification in total |
| 5 | Every scenario above, plus a pending-archive-marker scenario and a test-mode collision scenario | the three throwing archive spies record **zero** invocations |
| 6 | Two overlapping ticks for one school | exactly one apply (single-flight) |
| 7 | EnrollPro unreachable | bounded backoff (`nextAttemptAt` grows, capped at `MAX_BACKOFF_MS`), one notification, no apply |
| 8 | Second tick after a successful apply | `skipped`; no new mirror or audit rows (assert counts before/after) |
| 9 | Fresh process with `ROLLOVER_AUTO_SYNC_ENABLED=false` | `getAutomationStatus().enabled === false`; no timer; no detection |
| 10 | MUTANT restoring unconditional auto-apply on drift | controls 2, 3, 4 and 5 fail decisively; then restore byte-exactly and record the before/after SHA-256 of the mutated file |

### R2.7 Invariant unpin

- `ops/runtime/lib/contract.mjs:59-61`: replace the hard pin. New rule —
  `invariants.ROLLOVER_AUTO_SYNC_ENABLED` must be the string `'true'` or `'false'`, otherwise
  `RUNTIME_CONTRACT_INVALID` (fail-closed against `'yes'`, `'TRUE'`, `''`, `1`). Add a hard pin that
  `invariants.ATLAS_SUPERVISED === 'true'` so unpinning one value does not weaken the pinned-invariant
  model.
- `ops/runtime/runtime-contract.json`: **unchanged** (`ROLLOVER_AUTO_SYNC_ENABLED: "false"`). Do not
  enable it in this lane; that is a separately approved deployment/config decision.
- `resolveInvariantEnv` keeps passing declared values through unchanged.
- Tests: rewrite `ops/runtime/__tests__/contract.test.mjs:39-50` so the shipped contract still declares a
  valid boolean string, `resolveInvariantEnv` passes that value through, validation **accepts** `'true'`
  (pass-through) and **rejects** invalid values, and validation rejects a non-`'true'` `ATLAS_SUPERVISED`.
  Update `supervisor.test.mjs:148` and `enrollpro-origin.test.mjs:79` to assert value pass-through and
  that `ATLAS_SUPERVISED` stays `'true'` (their "pinned invariants stay pinned" wording is now imprecise
  for the rollover key, not the assertion). Re-run `lifecycle.e2e.test.mjs:42-43,74` and change it only if
  the invariant model itself changes.
- The service kill-switch (`:35`, `:479-483`) is unchanged and must remain working.

### R2.8 Gates

`npx tsx src/__tests__/enrollpro-rollover-automation.test.ts` (custom harness, `process.exitCode=1` on any
failure), `enrollpro-rollover-lifecycle-closure.test.ts`, `notification-events.test.ts`,
`npm --prefix atlas-server run test:rollover-readiness`, the whole of `npm run runtime:test` (including
`contract.test.mjs`, `supervisor.test.mjs`, `enrollpro-origin.test.mjs`, `lifecycle.e2e.test.mjs`), server
`tsc` plus the production build, a built-server startup with explicit `.js` ESM import proof, and
`git diff --check`.

The disposable-PostgreSQL tier must follow the established guarded pattern
(`atlas_restore_drill_<yyyymmdd>_<rand>`, schema applied only inside it, `try/finally` zero-residue
cleanup, skip-safe without `DATABASE_URL`). Never target the live database
`atlas_recovery_clean_rebuild_20260905`. Record the resolved host, database name, environment
classification, school count, and migration count without exposing secrets.

### R2.9 Boundaries and return contract

Source only. No live/shared database write, no register write by the lane, no `ops/runtime` deployment, no
runtime/ports/task/env change, no companion edit, and do not touch the client surfaces named in R1.3. Do not
edit `docs/plans/atlas-delivery-cycles.json` or its generated register.

Return `REVIEW_REQUIRED` with base/candidate SHAs, changed paths, the implemented predicate, the
notification payload shape, the per-control matrix including the mutant and its byte-exact restore, the
updated-test inventory with justifications, any removed assertion and why, and the seams proven never
invoked. Never self-approve, merge, or push.
