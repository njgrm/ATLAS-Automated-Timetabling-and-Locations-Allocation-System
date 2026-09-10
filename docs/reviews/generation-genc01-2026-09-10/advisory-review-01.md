# Advisory Review — GEN-C01 Canonical Generation Readiness

- **Reviewer spawn/context ID:** opencode-task-advisory (plain label chosen by reviewer)
- **Parent-relayed execution-system spawn ID:** ses_f772348b0ffe9xBUUdIweJvV61 (captured by the executor from the reviewer-spawn task result and relayed post-hoc for trace continuity)
- **Review type:** Independent advisory (MEDIUM-risk source implementation). NOT a formal planner/QA acceptance; no GO/NO-GO authority.
- **Date:** 2026-09-10
- **Reviewed identity**
  - Base SHA: `6f8d121f6bf6ce5efc8c6e831b69ecdc795b8187`
  - Candidate: STAGED diff in worktree `D:/ATLAS-worktrees/generation-genc01`, branch `work/generation-genc01` (HEAD == base; `git diff --cached` reviewed)
  - Authoritative prompt: `docs/prompts/generation-canonical-readiness-one-shot-genc01-2026-09-10.md`
- **Scope reviewed:** all 11 staged changed files (production, tests, scripts, docs).

## Plan-to-evidence mapping (authorized work → production call site → test)

| Authorized work (prompt) | Production call site | Executable evidence |
|---|---|---|
| 1. Trace production route for stale/catalog/hardcoded paths | `routes/generation.router.ts` → `generation.service.ts:triggerGenerationRun` (refactored: `assembleGenerationInputs` + shared `buildGenerationValidatorContext`) | Ledger `docs/progress/generation-genc01-2026-09-10-progress.md` trace section; diagnostic CLI output (demand mismatch 861 vs 2760, catalog-based `computeDemand`) |
| 2. Read-only canonical diagnostic sharing the same assembly + core | `services/canonical-generation-diagnostic.service.ts:runCanonicalGenerationDiagnostic` calls `assembleGenerationInputs` + `runHybridScheduler` + `validateHardConstraints`; live trigger calls the same three | `__tests__/canonical-generation-diagnostic.test.ts` (31/31, static import closure + instrumented zero-write) |
| 3. Diagnostic report (sessions/term, placed/unassigned, violations, runtime, source revisions) | `runCanonicalGenerationDiagnostic` result shape (`canonicalDemand`, `scheduler`, `violations`, `sourceRevisions`) | CLI run: canonical 552/2760 (920/term), assigned 895 / unassigned 30, HARD=30 `UNASSIGNED_SECTION`, SOFT=320, runtime 3.8 s, before==after signature |
| 4. Correct source defects proven failing-first, within generation boundary | `grade-window.service.ts:ensurePhase3GradeWindows` + `clampWindowToPolicyBounds` | `__tests__/grade-window-bounds.test.ts` (6/6); run-179 `WINDOW_OUT_OF_POLICY_BOUNDS` failure reproduced by clamp-path + `withDataContext` injection test |
| 5. Prove HG excluded, rotation only in assigned term, reconciled owner used, persisted capacity/scope, deterministic seed | assembly filters `code !== 'HG'` before `computeDemand`; `timetable-demand.service.ts` canonical demand; `resolveOfferingTerms` | `__tests__/canonical-demand-proofs.test.ts` (11/11) incl. owner-substitution/term-config stale-revision negatives; `timetable-candidate-domain.test.ts` (12/12) incl. HG exclusion + capacity boundary; diagnostic ownerStateTotals VALID 552/552 |
| 6. Stop with root-cause matrix / do not weaken constraints | diagnostic `terminationReason` + status `BLOCKED`; no constraint mutation | CLI: status `BLOCKED`, root-cause table in ledger; violations reported honestly (30 HARD, 320 SOFT) |

## Commands independently rerun (from `D:/ATLAS-worktrees/generation-genc01/atlas-server`)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | PASS (exit 0) |
| `npx tsx src/__tests__/grade-window-bounds.test.ts` | PASS 6/6 (exit 0) |
| `npx tsx src/__tests__/canonical-demand-proofs.test.ts` | PASS 11/11 (exit 0) |
| `npx tsx src/__tests__/canonical-generation-diagnostic.test.ts` (live DB, rolled-back positive control) | PASS 31/31 (exit 0) |
| `npx tsx src/__tests__/timetable-candidate-domain.test.ts` | PASS 12/12 (exit 0) |
| `npx tsx src/__tests__/timetable-ttc02-insertion.test.ts` | PASS 17/17 (exit 0) |
| `git -C D:/ATLAS-worktrees/generation-genc01 diff --cached --check` | PASS (exit 0, no whitespace errors) |
| `npx tsx src/scripts/canonical-generation-diagnostic.ts --schoolId 1 --schoolYearId 8` (with DATABASE_URL exported; read-only) | Runs; before==after signature `1d498af81a...`; exit 1 (status `BLOCKED` — expected, not a pass/fail gate) |

**Live diagnostic outcome (read-only):** status `BLOCKED`; terminationReason `GRADE_SHIFT_WINDOWS_MISSING; CANONICAL_CLASS_PROGRAM_SLOTS_MISSING; PRODUCTION_DEMAND_MISMATCH (861 vs 2760); UNASSIGNED_SESSIONS=30; HARD_VIOLATIONS=30`; canonical demand 552/2760 (920 per term), ownerStateTotals VALID 552/552, HG excluded; production scheduler dry-run assigned 895 / unassigned 30; violations HARD `UNASSIGNED_SECTION`=30, SOFT `ROOM_TYPE_MISMATCH`=100, `FACULTY_CONSECUTIVE_LIMIT_EXCEEDED`=120, `FACULTY_EXCESSIVE_IDLE_GAP`=100; DB signature before==after (zero writes).

Note: `npx tsc --noEmit` covers the production-build gate type check; I did not independently rerun the `npm run build` dist emit or the built-module `/api/v1/health` smoke (they write `dist/` artifacts). Those remain ledger-attested.

## Adversarial checks performed

1. **Zero-write bypass via raw SQL** — see Finding F1. The `$extends` recorder cannot observe `$executeRaw`/`$executeRawUnsafe`/`$queryRaw`. I verified the diagnostic's transitive call graph contains no raw writes today (only `$queryRaw` read in `computeDatabaseSignature`; `$executeRawUnsafe` exists only in `scheduling-policy.service.ensureSchedulingPolicyColumns`, unreachable from the diagnostic path which uses `findUnique`, not `getOrCreatePolicy`). Current behavior is safe; the *proof* has a coverage hole.
2. **Cross-school/year scope leakage** — all assembly/canonical queries are `where: { schoolId, schoolYearId }` scoped; diagnostic resolves the active non-archived mirror and asserts scope school 1 / year 8 (test asserts `schoolId === 1 && schoolYearId === 8`); ownerStateTotals VALID 552/552. No leak found.
3. **HG leakage into demand** — assembly filters `code !== 'HG'` before `computeDemand`; canonical demand explicitly skips HG ownership rows; proof tests + TTC02 HG negative control pass. No leak.
4. **Owner substitution / wrong-term rotation** — stale-revision negative controls (ownership id/owner change and term-identity change both change the revision hash) pass; `resolveOfferingTerms` restricts ROTATING_FAMILY_MEMBER to its single assigned term; `normalizeStoredAssignmentScope` preserves persisted `sectionIds` over grade substitution. Pass.
5. **Diagnostic creating a GenerationRun/LockedSession/audit row by any route** — the diagnostic service imports only read services and pure schedulers; its call graph has no model create/update/delete/upsert and no audit/notification publication. Instrumented run observed 70 statements, 0 model writes; signature byte-identical. No path found.
6. **Constructor-input fidelity vs base trigger** — field-by-field comparison of the extracted assembly against base `generation.service.ts`: faculty mapping, facultySubjects normalization (same roster index from mirror-derived sections), rooms+buildingGradeScope, subjects non-HG, preferences timeSlots gating, policy fields, gradeWindows, buildings, classTemplatePeriods, timetableShapes, demand, lockedEntries all match. `normalizeInternalGradeId` (class-program-slot) is byte-identical to the base local copy. Deviations: room `features` added (F2), validator-context `buildings` drops `name` (unused by validator), travel/vacant defaults `?? 0/false` (fields are `NOT NULL` in schema, so inert), `roomBuildings buildingId ?? 0` (rooms are filtered to teaching-building membership, so inert). Mutations still run before assembly.

## Findings

### F1 — safety-gate defect (test-coverage): zero-write recorder cannot observe raw SQL writes
- **Severity:** Medium
- **Evidence:** `canonical-generation-diagnostic.test.ts:71-74` lists `executeRaw`/`queryRaw` in `WRITE_ACTIONS`, but the interceptor `query: { $allModels: { $allOperations } }` (lines 134-143) only captures model operations. Prisma client extensions do not route `$executeRaw`/`$queryRaw` through `$allModels.$allOperations`, so those two actions can never be recorded; the zero-write assertion (line 187) therefore proves only *zero model-level writes*, not the claimed "no create/update/upsert/delete/executeRaw/queryRaw" (lines 8-10). The positive control (lines 214-241) proves only that a model `update` is seen. Today the diagnostic path is genuinely write-free (verified call graph), but a future `$executeRawUnsafe` added to the diagnostic or a transitively-called service would silently pass this gate.
- **Required fix:** instrument raw operations too (override `$executeRaw`/`$executeRawUnsafe`/`$queryRaw` on the injected client to record/fail on write-capable raw calls), or narrow the claim to "zero model writes" plus a static import-closure negative control asserting no `$executeRaw*` call site exists anywhere in the diagnostic's transitive source.

### F2 — product/runtime defect (latent): room `features` now injected into the constructor/validator input
- **Severity:** Low (currently inert for the live dataset)
- **Evidence:** base trigger room select (base `generation.service.ts` ~line 846) omitted `features`; the assembly select (line 365) adds `features: true` and maps `features: r.features ?? []` (line 433). `schedule-constructor.ts:2125-2127` gates room eligibility on `room.features` for subjects with `requiredFeatures`, and `constraint-validator.ts:422-439` emits feature-violations. Live probe: 0 of 103 school-1 rooms carry features and only `STE_ROBOTICS` has `requiredFeatures` (`["OWNER_DEPT:TLE"]`), so old and new paths both see an empty feature set → identical behavior today. But the constructor input no longer matches the base trigger field-for-field, contradicting the "reproduce the EXACT constructor input" contract, and the change has no failing-first test and is undocumented in ledger/CHANGELOG. If any room later gets persisted features, schedule output will change silently.
- **Required fix:** either (a) drop `features` from the assembly select to restore exact parity, or (b) keep it as an intentional, documented correction backed by a failing-first test that proves the feature-aware room gate is required.

### F3 — process/documentation inconsistency: CLI does not load `.env` and its stdout is not JSON-pure
- **Severity:** Low
- **Evidence:** `scripts/canonical-generation-diagnostic.ts` does not load the server `.env`; the documented invocation fails with `Environment variable not found: DATABASE_URL` unless DATABASE_URL is exported (the *test* loads `.env` itself at lines 41-55). Additionally, `[prisma]` and `[hybrid-scheduler]` console logs are written to stdout interleaved with the JSON report, so `>` redirect yields a non-JSON file (I had to strip those lines before parsing).
- **Required fix:** load `.env` in the CLI (mirror the test's loader) and route the scheduler/prisma logging to stderr, or document the env requirement and the parse caveat.

### F4 — process inconsistency: dead constant `ENABLE_LEGACY_TIME_PREFERENCES` remains in `generation.service.ts`
- **Severity:** Low
- **Evidence:** after the refactor, preference time-slot gating lives in the assembly (`generation-input-assembly.service.ts:48,392,527`); `generation.service.ts:1` still defines the constant with no remaining reference (verified by grep — only line 1 matches in that file). `tsc --noEmit` passes because `noUnusedLocals` is off. Two independent definitions of the same env toggle also risk drift.
- **Required fix:** delete the dead constant and export the single definition from the assembly, or keep one shared source of truth.

### F5 — process inconsistency (minor): diagnostic re-implements term-index coercion instead of reusing the production helper
- **Severity:** Low
- **Evidence:** `canonical-generation-diagnostic.service.ts:213-219` maps `termIndex` via `Number(...)` with fallback `1`, while the live path uses `ensureEntriesHaveTermIndex`/`resolveEntryTermIndex` (`generation.service.ts:478-488`) which falls back to `deriveTermIndexFromMetadata` (`metadata.modularAssignments[0].termIndex`). Entries lacking an explicit `termIndex` but carrying modular metadata would be reported as term 1 by the diagnostic and term 2/3 by the live path. Only the diagnostic's reported `termCounts` are affected (not placements or violations), and scheduler entries currently carry termIndex.
- **Required fix:** export `ensureEntriesHaveTermIndex` from `generation.service.ts` and reuse it in the diagnostic, per the prompt's "prefer reusing production-pure logic" preference.

### F6 — verification note (not a defect)
- The prompt's decisive gate "server production build; built-module/runtime smoke" is ledger-attested (`npm run build` exit 0; built `dist/server.js` `/api/v1/health` 200). I independently confirmed `tsc --noEmit` (exit 0) but did not rerun the dist emit or runtime smoke (they write `dist/`). No action required beyond independent confirmation at integration.

## Overall assessment

- Production refactor (`generation.service.ts` + shared assembly) is behavior-preserving for the current dataset; no material correctness regression found.
- Grade-window clamp fix is correct, preserves policy bounds, and never writes an out-of-bounds window (hermetic + injection tests pass).
- Diagnostic is genuinely read-only today, honestly reports `GENERATION_BLOCKED`, and does not weaken constraints to manufacture a zero result.
- All 7 reviewer commands pass; `git diff --cached --check` clean.
- Material gaps are in test/process hygiene (F1 raw-write proof hole, F2 undocumented parity deviation, F3 CLI env/stdout, F4 dead constant, F5 helper reuse), not in current production behavior.

## Verdict

**zeroFix: false** — because F1 (a safety-gate test-coverage hole) and F2 (an undocumented parity deviation in the constructor input) are material enough that the candidate should not proceed to formal acceptance without at least those two being addressed (or explicitly accepted by the planner with a recorded residual). F3-F5 are low-severity hygiene fixes. The executor should fix findings and request one changed-scope review before formal planner/QA acceptance.