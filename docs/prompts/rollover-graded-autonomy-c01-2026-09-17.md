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
