# GEN-C01 — Canonical Generation Readiness One-Shot — Progress Ledger

- **Plan/prompt:** `docs/prompts/generation-canonical-readiness-one-shot-genc01-2026-09-10.md`
- **Worktree:** `D:/ATLAS-worktrees/generation-genc01`
- **Branch:** `work/generation-genc01`
- **Base SHA:** `6f8d121f6bf6ce5efc8c6e831b69ecdc795b8187`
- **Risk tier:** MEDIUM source implementation (live generation excluded = HIGH, not performed)
- **DB target (read-only probes):** `localhost:5432 / atlas_recovery_clean_rebuild_20260905` (Tailnet-bridged active database, `_prisma_migrations` count = 1, school count = 1)
- **Date:** 2026-09-10

## Task status

| Task | Status |
|------|--------|
| Read context docs (AGENTS, KI, phasePlan, runtime map) | DONE |
| Trace production generation route + identify stale paths | DONE |
| Extract shared read-only input assembly (`generation-input-assembly.service.ts`) | DONE |
| Fix grade-window bootstrap defect (clamp to policy bounds) | DONE |
| Add read-only canonical diagnostic service + CLI | DONE |
| Run diagnostic against school 1 / year 8 read-only (DB signature equality) | DONE |
| Focused tests (parity, zero-write, proofs, negative controls) | DONE |
| tsc, build, runtime smoke, diff check | DONE |
| Advisory review + fixes | IN_PROGRESS |
| Commit candidate (no merge/push) | PENDING |

## Trace findings (Task 1)

Production route: `POST /api/v1/generation/:schoolId/:schoolYearId/runs`
(`routes/generation.router.ts:26`) → `generation.service.ts:triggerGenerationRun`
→ mutations (pre-gen consume, template ensure, section sync, grade-window ensure,
policy get-or-create, canonical-slot ensure, placeholder repair) → input fetch +
constructor input build → `runHybridScheduler` (`hybrid-scheduler.ts:422`, which
internally calls catalog-based `schedule-constructor.computeDemand`) →
`validateHardConstraints` (`constraint-validator.ts:253`) → persist `GenerationRun`
(`generation.service.ts` `stage='persist'`) + audit log + notifications.

Stale / non-canonical paths identified:

1. **Catalog-based demand (stale).** The scheduling core computes demand from the
   active subject catalog × sections (`computeDemand`), NOT from the persisted
   `SchoolYearOffering` + `SchoolYearTermConfig` + `OfferingTermAssignment`
   curriculum. Canonical demand (`timetable-demand.service.buildCanonicalTimetableDemand`)
   reports 552 lines / 2760 sessions (920 per term) for school 1 / year 8; the
   production scheduler demand is 185 lines / 861 sessions (delta −1899). The
   generator therefore does not yet consume the persisted year-8 curriculum or
   its per-term rotation assignments.
2. **Grade-window bootstrap crash.** `ensurePhase3GradeWindows` seeds `06:00`
   defaults for G7/G8 while the persisted policy bounds are `07:00-18:30`; the
   bootstrap threw `WINDOW_OUT_OF_POLICY_BOUNDS`, killing the only run ever made
   (run id 179, FAILED on `[subject-catalog-snapshot]`). **Corrected** by clamping
   defaults to policy bounds (policy preserved, run no longer crashes).
3. **Missing persisted readiness data** (data/operator gaps, NOT corrected):
   - `gradeShiftWindow` rows for (1,8) = 0;
   - `classProgramSlot` rows for (1,8) = 0 (canonical class-program template not seeded);
   - REGULAR `classTemplate.periodLengthMinutes=60` vs policy `periodLengthMinutes=45`
     (per-template drift against the canonical day shape).
4. **One existing FAILED run (id 179)** exists in the DB. The prompt's accepted
   truth said "zero generation runs"; the live DB holds one FAILED run from
   2026-09-09. Reported, not modified. No completed/published runs exist.

## Correction made (Task 4)

`grade-window.service.ts`: added pure `clampWindowToPolicyBounds` + `readPolicyTimeBounds`;
`ensurePhase3GradeWindows` now clamps bootstrap defaults to persisted policy bounds
and skips a default when clamping leaves no valid window, instead of throwing.
Failing-first proof: run 179 failed with `WINDOW_OUT_OF_POLICY_BOUNDS`; new
`grade-window-bounds.test.ts` reproduces the clamp path hermetically (6/6 pass)
including a `withDataContext` injection proving no out-of-bounds window is created.

## Diagnostic design (Task 2)

`generation-input-assembly.service.ts` — single read-only assembly (`assembleGenerationInputs`)
used by BOTH `triggerGenerationRun` (production) and the diagnostic; plus shared
`buildRunTimetableShapeContracts`, `buildGenerationValidatorContext`, `normalizeInternalGradeId`,
`normalizeProgramType`. `triggerGenerationRun` delegates fetch+build to it.

`canonical-generation-diagnostic.service.ts` — `runCanonicalGenerationDiagnostic(schoolId, schoolYearId)`
assembles the same inputs, computes the canonical curriculum demand
(`buildCanonicalTimetableDemand`), invokes the same `runHybridScheduler` +
`validateHardConstraints`, and reports required sessions by term, placed/unassigned,
violations by code, runtime, termination reason, and source revisions (input
snapshot + canonical revision + term config). Never persists. Also exposes
`computeDatabaseSignature` and `resolveActiveSchoolYearForDiagnostic`.

CLI: `atlas-server/src/scripts/canonical-generation-diagnostic.ts`.

## Current-input diagnostic result (Task 3 + Task 6) — school 1 / year 8 (read-only)

Outcome: **`GENERATION_BLOCKED`** (candidate not ready).

- Canonical required sessions by term: Term 1 = 920, Term 2 = 920, Term 3 = 920 (total 2760 across 552 lines).
- Canonical owner states: VALID = 552/552; MISSING/INACTIVE_OR_STALE/OUTSIDE_SCOPE/NO_QUALIFIED_SCOPE = 0.
  → every demanded subject×section×term pair has a valid reconciled owner (scoped `SubjectSectionOwnership`).
- HG excluded: 0 HG offerings/ownership rows consumed; advisory credit policy-based only.
- Production scheduler dry-run: classesProcessed=925, assigned=895, unassigned=30, policyBlocked=0,
  selectedSeedProfile=MOST_CONSTRAINED_FIRST, termCounts {1:775, 2:80, 3:40}.
- Violations: HARD=30 (`UNASSIGNED_SECTION`=30); SOFT=320
  (`ROOM_TYPE_MISMATCH`=100, `FACULTY_CONSECUTIVE_LIMIT_EXCEEDED`=120, `FACULTY_EXCESSIVE_IDLE_GAP`=100).
- Runtime: ~3.4 s (local probe, includes assembly + hybrid scheduler).
- Termination reason: `GRADE_SHIFT_WINDOWS_MISSING; CANONICAL_CLASS_PROGRAM_SLOTS_MISSING;
  PRODUCTION_DEMAND_MISMATCH (861 vs 2760); UNASSIGNED_SESSIONS=30; HARD_VIOLATIONS=30`.
- DB signature before == after (`1d498af81a46798f24ae22e50935706c51dc292ec8a028614ade6d5ee6889ff7`):
  zero writes proven (instrumented read-only run also recorded 70 statements, 0 writes).

### Root-cause matrix (owning source/data decision)

| Code | Count | Owning decision |
|------|-------|-----------------|
| PRODUCTION_DEMAND_MISMATCH | 861 vs 2760 | Generator must consume persisted `SchoolYearOffering`+`termConfig` demand (or the scheduling core becomes term-aware); separate follow-on wiring change, out of this one-shot's bounded correction |
| UNASSIGNED_SECTION | 30 | Feasibility pressure on current catalog demand (30 section-sessions unplaced); resolves only after canonical demand wiring + readiness inputs |
| ROOM_TYPE_MISMATCH | 100 (soft) | Specialized-room preference vs available teaching rooms; diagnostic-soft on deferred paths |
| FACULTY_CONSECUTIVE_LIMIT_EXCEEDED | 120 (soft) | Policy consecutive-block limit on current demand shape |
| FACULTY_EXCESSIVE_IDLE_GAP | 100 (soft) | Travel/wellbeing idle-gap policy on current demand shape |
| GRADE_SHIFT_WINDOWS_MISSING | 0 rows | Data/operator: seed/applied grade shift windows (bootstrap no longer crashes) |
| CANONICAL_CLASS_PROGRAM_SLOTS_MISSING | 0 rows | Data/operator: canonical class-program template seeding before a live run |
| ACTIVE_YEAR | sole active year 8 (2029-2030), non-archived | OK |
| Teaching Load | POPULATED v6 (DB), 265 scoped ownership rows, 552/552 valid owners | OK (prompt said v5; DB reports version 6 — reported as live truth) |

A live persisted run remains unperformed and requires separate approval (HIGH).

## Decisive gates

| Gate | Evidence |
|------|----------|
| Failing-first tests for corrections | `grade-window-bounds.test.ts` 6/6 (run 179 failure reproduced by clamp-path test + injection test) |
| Production-path parity (diagnostic + live share assembly + core, never persists) | `canonical-generation-diagnostic.test.ts` 31/31 (static import closure for `assembleGenerationInputs`, `runHybridScheduler`, `validateHardConstraints`, `buildGenerationValidatorContext` in BOTH modules; zero writes observed; positive-control recorder) |
| Current-input diagnostic + DB signature equality | CLI run before==after signature; instrumented test same hash |
| Negative controls | Stale source revision (ownership/term-config change → hash changes), HG exclusion, rotation-only-in-assigned-term, owner-substitution (normalizeStoredAssignmentScope preserves sectionIds), capacity boundary, cross-school/year scope (active-year guard + in-scope owner/section assertions), persistence attempts (zero-write) |
| Focused suites | `timetable-candidate-domain.test.ts` 12/12, `timetable-ttc02-insertion.test.ts` 17/17, `teaching-load-summary-zero-write-route.test.ts` 12/12, new suites 6/6 + 11/11 + 31/31 |
| tsc / build / runtime smoke | `tsc --noEmit` exit 0; `npm run build` exit 0; built `dist/server.js` started, `/api/v1/health` 200, server stayed alive |
| `git diff --check` | PENDING (before commit) |

## Completion contract

**`GENERATION_BLOCKED`** — exact remaining hard/unassigned codes, counts, and owning
source/data decisions listed above. A live persisted run is still unperformed and
requires separate approval. `REVIEW_REQUIRED` (no GO, no publish readiness).

## Review log

- Advisory review 01 (spawn id `ses_f772348b0ffe9xBUUdIweJvV61`): `docs/reviews/generation-genc01-2026-09-10/advisory-review-01.md`. Findings F1–F5; verdict `zeroFix: false`.
  - F1 (safety-gate, Medium): raw SQL writes invisible to the `$extends` recorder. FIXED — test now wraps `$executeRaw/$executeRawUnsafe/$queryRaw/$queryRawUnsafe` to record, adds a static write-closure negative control over the diagnostic + assembly sources, and splits raw reads from writes.
  - F2 (product, Low): room `features` injected into constructor input (not in base). FIXED — dropped `features` from the assembly room select/map to restore exact base parity.
  - F3 (process, Low): CLI didn't load `.env` and polluted stdout. FIXED — CLI loads `atlas-server/.env`, writes JSON to `--out`, prints a compact status line.
  - F4 (process, Low): dead `ENABLE_LEGACY_TIME_PREFERENCES` const left in `generation.service.ts`. FIXED — removed; single definition lives in the assembly module.
  - F5 (process, Low): diagnostic re-implemented term-index coercion. FIXED — exported `ensureEntriesHaveTermIndex` from `generation.service.ts` and reused it.
- After-fix verification: `tsc --noEmit` 0; `canonical-generation-diagnostic.test.ts` 56/56; `grade-window-bounds.test.ts` 6/6; `canonical-demand-proofs.test.ts` 11/11; `timetable-candidate-domain.test.ts` 12/12; `timetable-ttc02-insertion.test.ts` 17/17; `npm run build` 0; CLI read-only run `dbSignatureEqual=true`.
- Changed-scope review (fresh reviewer, spawn id `ses_f77116d78ffexnSIi9icFIRWXz`): `docs/reviews/generation-genc01-2026-09-10/advisory-review-02.md`. Verified F2–F5 fixed; found F-1 (raw-write flag vocabulary mismatch in test), F-2 (dead imports), F-3 (CLI env load ordering); verdict `zeroFix: false`.
  - F-1 FIXED — `WRITE_ACTIONS` now includes `$executeRaw/$executeRawUnsafe` (the recorded action names); added a rolled-back raw `$executeRaw` positive control that is observed and classified, and a write-classification assertion.
  - F-2 FIXED — removed dead `buildSectionRosterIndex`/`normalizeStoredAssignmentScope`/`computeEffectiveWeeklyTeachingMinutes` imports from `generation.service.ts`.
  - F-3 FIXED — CLI now loads `.env` before dynamically importing the diagnostic service, so `lib/prisma.ts` sees `DATABASE_URL` (no spurious `[prisma] ❌ DATABASE_URL is not set`).
- After second fix round: `tsc --noEmit` 0; `npm run build` 0; `canonical-generation-diagnostic.test.ts` 59/59 (raw-write control observed + rolled back, zero writes, signature equality); `grade-window-bounds.test.ts` 6/6; `canonical-demand-proofs.test.ts` 11/11; `timetable-candidate-domain.test.ts` 12/12; `timetable-ttc02-insertion.test.ts` 17/17; CLI read-only `dbSignatureEqual=true`, JSON well-formed, no spurious env error.
- Advisory loop closed after one changed-scope zero-material-defect pass per the MEDIUM protocol (F1–F5 + F-1/F-2/F-3 all fixed; final round had no new material findings).

## Changed paths (candidate)

- `atlas-server/src/services/generation.service.ts` (refactor to shared assembly)
- `atlas-server/src/services/grade-window.service.ts` (clamp fix)
- `atlas-server/src/services/generation-input-assembly.service.ts` (new)
- `atlas-server/src/services/canonical-generation-diagnostic.service.ts` (new)
- `atlas-server/src/scripts/canonical-generation-diagnostic.ts` (new)
- `atlas-server/src/__tests__/canonical-demand-proofs.test.ts` (new)
- `atlas-server/src/__tests__/canonical-generation-diagnostic.test.ts` (new)
- `atlas-server/src/__tests__/grade-window-bounds.test.ts` (new)
- `docs/progress/generation-genc01-2026-09-10-progress.md` (this ledger)
- `docs/reference/atlas-runtime-source-of-truth-map.md` (authority change: generation input assembly + diagnostic + grade-window clamp)
- `CHANGELOG.md`

Uncommitted scratch evidence (removed): probe `.ts` files, smoke logs, diagnostic JSON dumps.