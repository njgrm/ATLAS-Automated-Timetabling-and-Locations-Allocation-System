# FACULTY-SYNC-PUBLICATION-CAS-C01 — executor handoff (progress ledger)

Status: `REVIEW_REQUIRED` · Risk: MEDIUM (server source + tests, no live action)
Branch: `fix/faculty-sync-publication-cas` · Worktree: `E:/ATLAS-worktrees/faculty-sync-cas-c01`
Base SHA: `16e70be2a01bf815447ee323f13e775bb825ad4f` (frozen; ancestor of HEAD)
Candidate SHA: the tip commit that contains this file (reported in the executor return).
Directive read from this worktree: `AGENTS.md` blob `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88`.
Governing packet: `docs/prompts/faculty-sync-publication-cas-c01-2026-09-17.md`,
blob `60425bc97c359065587eebb6d6956f3556a0d99a` (§0–§7 + §8 A1; A1 controls).

## 1. Changed paths (exact) and unchanged-path proof

Changed (3):

1. `atlas-server/src/services/generation.service.ts`
2. `atlas-server/src/services/published-identity-snapshot.service.ts`
3. `atlas-server/src/__tests__/faculty-sync-publication-cas-c01.test.ts` (new)
4. `docs/handoffs/faculty-sync-publication-cas-c01-executor.md` (this file)

Unchanged, byte-identical to base (`git hash-object` tip == `git rev-parse <base>:<path>`):

- `atlas-server/src/services/publication-contract.service.ts` = `76603edab27c08eead86f2ad4c9ca6986b84689f`
- `atlas-server/src/services/faculty.service.ts` = `ec80880971ab03bd38b89d6ec79d9a47ec84062c` (no edit; the wider `invalidatedRuns` value is assignable to its declared structural subset per A1.7 — `tsc` exit 0 confirms)
- `atlas-server/package.json` = `1f38594065b2c2ba3a6daa1df53c649e9c999e3e`
- `prisma/schema.prisma` = `8af558844d5a09bd9a1c70aa81d5fb619d870fa8`

No migration, no schema change, no runtime/port/task/env change, no live login, no
deployment, no generation, no publication, no companion edit.

## 2. Trace table — requirement → production path → negative control → verification command

All 14 rows are `MANDATORY_SOURCE`, `PASS`. Rows 1–11/14 executed on real disposable
PostgreSQL; no row is `DEFERRED`.

| # | Requirement | Production path | Negative control | Verification command | Result |
|---|---|---|---|---|---|
| 1 | New suite green on disposable PostgreSQL through real `publishSchedule` + real `invalidateStaleCompletedRuns` + real routine-sync caller | `atlas-server/src/__tests__/faculty-sync-publication-cas-c01.test.ts` | R1/R3 mutants below | `npx tsx src/__tests__/faculty-sync-publication-cas-c01.test.ts` | PASS (passed=67 failed=0, exit 0) |
| 2 | C-A un-publish/resurrection interleave | `generation.service.ts` drift CAS `updateMany` + `publication-contract.service.ts` retire CAS | CAS predicate removed → C-A FAIL | same suite, C-A block | PASS (11 assertions) |
| 3 | C-B orphan interleave | `generation.service.ts` destructive CAS + `publishSchedule` | CAS predicate removed → C-B FAIL | same suite, C-B block | PASS (11 assertions) |
| 4 | C-C genuine invalidation preserved; truthful `invalidatedCount`; R2.3b `unpublishedRunIds` | destructive CAS + `invalidatedCount += 1` + `unpublishedRunIds.push` | over-blocking: no interleave must still FAILED | same suite, C-C block | PASS (9 assertions, DB-count equality) |
| 5 | R1 mutant → C-A **and** C-B FAIL; byte-exact restore | CAS predicates (`generation.service.ts`) | `where: { id: run.id }` on both writes | mutant run (below) | PASS (18 FAILs, exit 1; restored `936d6030…`) |
| 6 | Replay idempotency: 2nd sync no-ops, no duplicate audit, no 2nd destructive write | drift idempotency guard + destructive classification excludes FAILED runs | 2nd sync would duplicate the drift audit without the guard | same suite, C-replay block | PASS (7 assertions; sha256 run-row identity; drift audit count 1→1) |
| 7 | C-D fail-closed interval parity with producer | `published-identity-snapshot.service.ts` `timeToMinutes` = `h*60+m`; producer `schedule-constructor.ts:1360-1363` | R3 mutant (`: 0` coercion) → C-D FAIL | same suite, C-D block | PASS (8 assertions) |
| 8 | R3 mutant → C-D FAILS; byte-exact restore | `published-identity-snapshot.service.ts:195-205` | `(isFinite(h)?h:0)*60+(isFinite(m)?m:0)` | mutant run (below) | PASS (3 FAILs, exit 1; restored `29a0b5b1…`) |
| 9 | `published-immutability-c08.test.ts` green, no assertion removed | C08 suite exercises the drift path | count `check(`/`checkEqual(` base vs tip | `npx tsx src/__tests__/published-immutability-c08.test.ts` | PASS (passed=135 failed=0). `check(`=52/52, `checkEqual(`=62/62 (base==tip) |
| 10 | C-E real `syncFacultyFromExternal` routine-sync caller (A1.5) | `faculty.service.ts:494` → `:768` → guarded write | stub deactivation yields `deactivatedCount>0` → invalidation gate reached | same suite, C-E block | PASS (14 assertions; `deactivatedCount=2`; `invalidatedCount`==DB FAILED count) |
| 11 | Readiness + PostgreSQL concurrency suites on disposable DB with `PUBC01R_DISPOSABLE_DATABASE` binding | `publication-contract-readiness.test.ts`, `publication-contract-postgres-concurrency.test.ts` | real advisory-lock / zero-write guards inside the suites | see §4 gate 11 | PASS (readiness exit 0; concurrency exit 0, residue 0) |
| 12 | `tsc` exit 0 | `atlas-server` build | — | `npm --prefix atlas-server run build` | PASS (exit 0) |
| 13 | Built-server boot on isolated port, `/api/v1/health` 200, clean termination, `.js` runtime imports | `atlas-server/dist/server.js` | isolated port 5199, disposable DB | see §4 gate 13 | PASS (HTTP 200, port released, residue 0) |
| 14 | `git diff --check` clean; `verify-cycle` exit 0; zero residue; honest status | repository | — | see §4 gate 14 | PASS |

## 3. Mutants — results and byte-exact restore proof

Both mutants were applied to `generation.service.ts` / `published-identity-snapshot.service.ts`,
run, then reversed; the restored working-tree bytes were re-hashed with `git hash-object`.

- R1 (CAS predicate removed → `where: { id: run.id }` on **both** `updateMany` calls):
  - result: `passed=49 failed=18`, exit 1; **C-A 10 FAILs** (R resurrected to `isPublished:true`,
    supersession pointers erased, 2 published runs, `PUBLISHED_RUN_AMBIGUOUS` on the read,
    skip-audit 0, drift-audit 1) and **C-B 8 FAILs** (R set `FAILED`, version 3,
    `PUBLISHED_RUN_NOT_FOUND` on the read).
  - restore: `generation.service.ts` blob before mutant = after = `936d6030c06a725692b4d8ec14668aff27da9562`;
    final `git hash-object` equals that value.
- R3 (`return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);`):
  - result: `passed=64 failed=3`, exit 1; **C-D 3 FAILs** (malformed `07:xx` silently accepted,
    no typed contradiction).
  - restore: `published-identity-snapshot.service.ts` blob before mutant = after = `29a0b5b1ffacb54af7db809d6ed4c72eff16e20b`;
    final `git hash-object` equals that value.

## 4. Typed outcome field names and audit-count deltas

Returned type `InvalidateStaleCompletedRunsResult`: `invalidatedCount` (truthful: runs actually
set `FAILED`), `staleRunIds` (classified set, meaning preserved), `unpublishedRunIds`
(truthful destructive set, R2.3b), `driftedPublishedRunIds`, `concurrentChangedRunIds`
(CAS misses). New audit action: `GENERATION_RUN_INVALIDATION_CONCURRENT_SKIPPED`
(≤ `action VarChar(50)`, 46 chars), metadata `{ runId, observedVersion, reason, detectedAt }`,
one row per miss, `actorId: 0`.

| Control | skip-audit delta | drift-audit delta | notes |
|---|---|---|---|
| C-A | R: 0 → 1 | R: 0 → 0 | CAS miss; no drift summary written |
| C-B | R: 0 → 1 | R: 0 → 0 | destructive CAS miss; no `FAILED` |
| C-C | 0 → 0 | 0 → 0 | CAS matched; `FAILED` + `error` set |
| replay | 0 → 0 | 1 → 1 | 2nd sync writes nothing; no duplicate drift audit |
| C-E | not asserted | published run drift 1 | `invalidatedCount` == DB `FAILED` count == 1 |

## 5. Writer inventory (A1.3 corrected form) — reachability evidence

- `publishSchedule` (`publication-contract.service.ts:342-354` retire CAS, `:415-419` run CAS)
  — **reachable** (mounted publish route; exercised by this suite) — already CAS
  (`version: { increment: 1 }`) — **not modified**.
- `timetable-sync-setup.service.ts:848-856` — **reachable** — already CAS
  (`where { id, version: expectedRunVersion }`, explicit `nextVersion`) — not modified.
- `timetable-teaching-load-repair.service.ts:1144/1205-1211` — **reachable** — already CAS
  (`where { id, version: expectedVersion }`, explicit `newVersion`) — not modified.
- `invalidateStaleCompletedRuns` (routine sync; callers `faculty.service.ts:768`,
  `scripts/seed-realistic.ts:628`) — **reachable** — **was unguarded; now CAS-guarded (this fix)**.
- `reconcileInvalidPublishedRunStates` (`generation.service.ts:125-190`) —
  **reachable=false**, `git grep -n reconcileInvalidPublishedRunStates` returns only its own
  definition plus prose (`docs/prompts/…c01-2026-09-17.md`, `docs/reviews/tt-source-freshness-c04-…md`).
  Inventory row only; its inner write at `:161` is **untouched**.

## 6. Production-shape parity row

- **Real producer:** `publishSchedule` + `buildPublishedIdentitySnapshot` /
  `resolveContainingClassRow`.
- **Real consumer:** `invalidateStaleCompletedRuns` (routine sync) and
  `getPublishedSchedulePayload` (published read).
- **Conservation totals:** exactly one `isPublished===true` run per school/year (C-A/C-B/C-E);
  one revision and one `GENERATION_RUN_PUBLISHED` audit per publication (C-B, C-E);
  `invalidatedCount` == DB `FAILED` count (`INVALIDATED_BY_MIRROR_RESET`) ==
  `unpublishedRunIds.length` (C-C, C-E); `staleRunIds` keeps the classified-set meaning
  (C-A: `staleRunIds.length` 1 while `invalidatedCount` 0); `version` preserved through drift
  (C-A/C-B) and incremented once on the destructive transition (C-C).
- **Negative control:** R1 mutant fails C-A+C-B; R3 mutant fails C-D.
- **Result:** PASS.

## 7. Disposable-DB cleanup proof and honest worktree status

- New suite dropped and `assertDropped()` its `atlas_restore_drill_2026…_fscas…` DB on every run
  (5 runs incl. mutants) — all reported `CLEANUP … dropped and asserted absent`.
- Gate 11 concurrency DB `atlas_restore_drill_20260917_pubc01r279377` — `RESIDUE=0`.
- Gate 13 boot DB `atlas_restore_drill_20260917_boot228292` — `RESIDUE=0`.
- Final sweep `SELECT datname … LIKE 'atlas_restore_drill_%'` returns only
  `atlas_restore_drill_20260911_uxc01rc6e5ba0d` and `atlas_restore_drill_20260912_rrtc80ffb`
  — **pre-existing residue from other cycles (2026-09-11/12), not created by this session**.
- Worktree status after commit: `git status --short` empty (verified in the executor return).

## 8. Claim-discipline table

| Claim | Class |
|---|---|
| Base defect: unguarded `update where { id }` drift + destructive writes; `invalidatedCount = staleRunIds.length`; `unpublishedRunIds` always `[]` | CURRENT_STATE |
| Routine sync can resurrect/orphan a concurrently published run | CURRENT_STATE |
| `timeToMinutes` coerced non-finite components to `0`; producer yields `NaN` | CURRENT_STATE |
| Both writes must be CAS-bound to the classified version; misses produce one typed audit and no write | REQUIREMENT |
| `invalidatedCount`/`unpublishedRunIds` must be truthful; `staleRunIds` keeps its meaning | REQUIREMENT |
| Replay idempotency (no duplicate drift/skip audit) | REQUIREMENT |
| Interval gate must fail closed like the producer; 422 and zero-write preserved | REQUIREMENT |
| `reconcileInvalidPublishedRunStates` has zero callers and is out of scope | CURRENT_STATE (verified) |
| The drift idempotency guard is an inline implementation of R2.5, not a new successor stream | SUCCESSOR (bounded) |
| Residuals F1 (this fix) / F2 (folded R3) originate from the C08 wave audit; F3/F4 belong elsewhere | HISTORICAL |

## Notes / risks

- `faculty.service.ts` needed **no** edit (A1.7); `tsc` exit 0 proves the assignability.
- The drift idempotency guard (§R2.5) suppresses a repeated drift write/audit only when the
  recorded `driftReason`/`driftDetectedAt` exist **and** the stale-faculty id set is identical;
  a changed stale set legitimately re-drifts.
- The C-A summary assertion `publicationIntegrity === undefined` is the zero-non-CAS-write proof;
  `publishSchedule`'s retire only touches `isPublished`/`publicationSuperseded*`.
