# Advisory Review 02 — GEN-C01 Changed-Scope (F1–F5 fix verification)

- **Reviewer context label:** opencode-task-advisory-02 (fresh independent context)
- **Parent-relayed execution-system spawn ID:** `ses_f77116d78ffexnSIi9icFIRWXz` (captured by the executor from this changed-scope reviewer-spawn task result and relayed post-hoc for trace continuity)
- **Prior review:** `ses_f772348b0ffe9xBUUdIweJvV61` — that spawn ID belongs to **advisory-review-01**; this review is a different fresh context and does not inherit its verdict.
- **Review type:** Independent advisory (MEDIUM-risk source implementation), changed-scope review after F1–F5 fixes. No GO/NO-GO authority.
- **Date:** 2026-09-10

## Changed-scope identity

- **Base SHA:** `6f8d121f6bf6ce5efc8c6e831b69ecdc795b8187`
- **Candidate:** STAGED diff in worktree `D:/ATLAS-worktrees/generation-genc01`, branch `work/generation-genc01` (HEAD == base; `git diff --cached` reviewed)
- **Changed files (staged):**
  - `CHANGELOG.md`
  - `atlas-server/src/__tests__/canonical-demand-proofs.test.ts`
  - `atlas-server/src/__tests__/canonical-generation-diagnostic.test.ts`
  - `atlas-server/src/__tests__/grade-window-bounds.test.ts`
  - `atlas-server/src/scripts/canonical-generation-diagnostic.ts`
  - `atlas-server/src/services/canonical-generation-diagnostic.service.ts`
  - `atlas-server/src/services/generation-input-assembly.service.ts`
  - `atlas-server/src/services/generation.service.ts`
  - `atlas-server/src/services/grade-window.service.ts`
  - `docs/progress/generation-genc01-2026-09-10-progress.md`
  - `docs/reference/atlas-runtime-source-of-truth-map.md`
  - `docs/reviews/generation-genc01-2026-09-10/advisory-review-01.md`

## Fix-verification matrix (F1–F5)

| Fix | Claim | My verification | Result |
|-----|-------|-----------------|--------|
| F1 | Raw ops wrapped to record; static write-closure scan; raw reads split from writes; recorder observes `$queryRaw`; zero writes (model+raw) | Recorder DOES observe the migration-signature `$queryRaw` (rawReads > 0, test PASS). Model writes correctly detected via `$allOperations`. Static token scan covers the 2 new files. **BUT** `WRITE_ACTIONS` lists `'executeRaw'`/`'executeRawUnsafe'` (no `$`) while the wrapper records `'$executeRaw'`/`'$executeRawUnsafe'` (with `$`) → a raw write would be recorded yet **not** classified as a write by the `writes` filter (probe: `WRITE_ACTIONS.has('$executeRawUnsafe') === false`). Runtime raw-write detection is ineffective; static scan covers only 2 files, not the transitive call graph. | **PARTIAL — finding F-1** |
| F2 | Room select no longer requests `features`; no `features` mapping remains; RoomInput parity | Assembly room select (`generation-input-assembly.service.ts:365`) is byte-identical to base trigger select; zero `features` matches in the assembly module; `roomsWithGradeScope` mapping identical to base. | **FIXED** |
| F3 | CLI loads `.env` from atlas-server; JSON to `--out`; compact status line | CLI run succeeded: valid well-formed JSON (ConvertFrom-Json OK), `dbSignatureEqual=true`, compact status line printed. `.env` loads in `main()` before queries; queries work. Note: `[prisma] ❌ DATABASE_URL is not set` prints at startup due to ESM import ordering (lib/prisma.ts evaluates before `main()`'s `loadServerEnv`); false alarm, run still succeeds. | **FIXED** (cosmetic startup line, informational) |
| F4 | Dead `ENABLE_LEGACY_TIME_PREFERENCES` removed from `generation.service.ts`; single definition in assembly | Grep confirms zero matches in `generation.service.ts`; definition exported from assembly (lines 48/392/526). (`preference.service.ts:76` has its own pre-existing local copy — not part of this diff.) | **FIXED** |
| F5 | `ensureEntriesHaveTermIndex` exported from `generation.service.ts` and reused by diagnostic | `export function ensureEntriesHaveTermIndex` at `generation.service.ts:482`; diagnostic imports it (line 25) and calls it (line 214); no local re-implementation remains. Behavior for modular-metadata entries matches production (`deriveTermIndexFromMetadata`). | **FIXED** |

## Commands independently rerun (from `D:/ATLAS-worktrees/generation-genc01/atlas-server`)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | PASS (exit 0) |
| `npx tsx src/__tests__/canonical-generation-diagnostic.test.ts` (live DB) | PASS 56/56 (exit 0) — rawReads observed, 0 model writes, signature before==after, rolled-back positive control |
| `npx tsx src/__tests__/grade-window-bounds.test.ts` | PASS 6/6 (exit 0) |
| `npx tsx src/__tests__/canonical-demand-proofs.test.ts` | PASS 11/11 (exit 0) |
| `npx tsx src/__tests__/timetable-candidate-domain.test.ts` | PASS 12/12 (exit 0) |
| `npx tsx src/__tests__/timetable-ttc02-insertion.test.ts` | PASS 17/17 (exit 0) |
| `npx tsx src/scripts/canonical-generation-diagnostic.ts --schoolId 1 --schoolYearId 8 --out <temp>/changed-scope-diagnostic.json` | Runs read-only; status `BLOCKED`; **dbSignatureEqual=true** (before==after `1d498af81a46...`); JSON file well-formed (7,922 bytes; ConvertFrom-Json OK); exit 1 = expected BLOCKED status, not a pass/fail gate |
| `git -C D:/ATLAS-worktrees/generation-genc01 diff --cached --check` | PASS (exit 0, no whitespace errors) |

## Adversarial attempts

1. **F1 — raw-write runtime detection (found defect).** The fix wraps `$executeRaw/$executeRawUnsafe/$queryRaw/$queryRawUnsafe` and records `{ action: rawAction }` where `rawAction` carries the `$` prefix. The write-classification set is `WRITE_ACTIONS = { create, createMany, update, updateMany, upsert, delete, deleteMany, executeRaw, executeRawUnsafe }` — the raw entries lack the `$`. Independent probe: `WRITE_ACTIONS.has('$executeRawUnsafe') === false`, so the `writes` filter at test line 214 would NOT flag a recorded raw write; `writes.length === 0` would pass even if a transitive service executed `$executeRawUnsafe`. The static token scan catches literal raw-write call sites only in the 2 newly-authored files (`canonical-generation-diagnostic.service.ts`, `generation-input-assembly.service.ts`), not the transitive call graph the diagnostic reaches (`hybrid-scheduler.ts`, `constraint-validator.ts`, `timetable-demand.service.ts`, `term-config.service.ts`, `generation-input-snapshot.service.ts`, `class-program-slot.service.ts`, `class-template.service.ts`, `faculty-assignment-scope.service.ts`, `schedule-constructor.ts`, `scheduling-policy.service.ts`). Today no raw write is actually reachable on the diagnostic path (the only `$executeRawUnsafe` site, `scheduling-policy.ensureSchedulingPolicyColumns`, is reachable only via `getOrCreatePolicy`, which the diagnostic/assembly do not call — they use `findUnique`), so the runtime outcome is safe; the **proof** for the transitive closure remains open.
2. **F1 — false-negative forms.** Static scan uses `.includes(token)` on whitespace-normalized source; `client['$executeRaw']` and template-literal forms still contain the literal `$executeRaw`, so they are caught in the two scanned files. Computed access (`client['$'+'executeRaw']`) would evade the scan — but the runtime recorder would still capture it (if the prefix mismatch were fixed). The mismatch in WRITE_ACTIONS is the actual gap, not token spelling.
3. **F2 — field-by-field room/constructor parity.** Assembly select == base select exactly (no `features`); `roomsWithGradeScope` identical. Validator context (`buildGenerationValidatorContext`) uses `buildingsRaw` (id/x/y) and `roomBuildings` (`buildingId ?? 0`); validator only reads `b.id/x/y` and `rb.buildingId` (constraint-validator.ts:610-664) — `name` unused, `buildingId` non-null for teaching rooms, so the `buildings`-name drop and `?? 0` default are inert as review-01 assessed. No new drift introduced by the fixes.
4. **F4/F5 — removed-const and term-index parity.** No remaining reference to `ENABLE_LEGACY_TIME_PREFERENCES` in `generation.service.ts`. `ensureEntriesHaveTermIndex` delegates to `resolveEntryTermIndex`/`deriveTermIndexFromMetadata`, identical behavior for modular-metadata entries (term 2/3 from `metadata.modularAssignments[0].termIndex`); diagnostic `termCountsFromEntries` now reads the populated `termIndex` after the shared helper. No circular-import issue (tests run, tsc passes).

## Findings

### F-1 — safety-gate defect (test-coverage): raw-write runtime detection remains ineffective despite the F1 fix
- **Severity:** Medium
- **Class:** (b) safety-gate defect
- **Evidence:** `canonical-generation-diagnostic.test.ts:71-74` defines `WRITE_ACTIONS` with `'executeRaw'`/`'executeRawUnsafe'` (no `$`), while the raw wrappers (lines 150-156) record `{ action: rawAction }` where `rawAction` ∈ `'$executeRaw'`, `'$executeRawUnsafe'`, `'$queryRaw'`, `'$queryRawUnsafe'` (with `$`). The zero-write filter (line 214) therefore can never match a recorded raw write. Independent probe confirmed `WRITE_ACTIONS.has('$executeRawUnsafe') === false` and that a recorded raw write is classified as zero writes. The static token scan (lines 162-171) covers only the diagnostic + assembly source files, not the transitive call graph of the diagnostic (which includes scheduling-policy, timetable-demand, input-snapshot, class-program-slot, class-template, hybrid-scheduler, etc.). The only `$executeRawUnsafe` call sites in the codebase are in `scheduling-policy.service.ensureSchedulingPolicyColumns` (lines 748-829), reachable only through `getOrCreatePolicy` — which neither the assembly nor the diagnostic calls — so **no raw write is reachable today** (instrumented run: 72 statements, 0 writes; DB signature before==after). Current runtime behavior is safe; the claimed "zero writes (model + raw)" proof remains open for any future raw write introduced in a transitively-reached module.
- **Required fix:** (a) change `WRITE_ACTIONS` to `'$executeRaw'`/`'$executeRawUnsafe'` (or strip the `$` in the wrapper before recording) so the runtime filter actually classifies recorded raw writes, and add a raw-write positive control (e.g., a rolled-back `$executeRawUnsafe` in the instrumented transaction) proving the recorder flags it; and/or (b) extend the static write-closure scan to the diagnostic's full transitive import graph.

### F-2 — code-quality inconsistency (minor): dead imports remain in `generation.service.ts`
- **Severity:** Low
- **Class:** (c) process/code-quality inconsistency
- **Evidence:** after the refactor, `buildSectionRosterIndex` and `normalizeStoredAssignmentScope` (import line 33, from `faculty-assignment-scope.service.js`) and `computeEffectiveWeeklyTeachingMinutes` (import line 38, from `scheduling-policy.service.js`) each occur exactly once in `generation.service.ts` — the import statement only. Their consumers moved to the assembly module. Runtime-inert (bundler/tree-shaking), `tsc --noEmit` passes because `noUnusedLocals` is off.
- **Required fix:** remove the three dead imports (or leave as accepted hygiene residue — planner decision).

### F-3 — process inconsistency (informational, not blocking): CLI prints a false `[prisma] ❌ DATABASE_URL is not set` startup line
- **Severity:** Low / informational
- **Class:** (c) process inconsistency
- **Evidence:** `scripts/canonical-generation-diagnostic.ts` calls `loadServerEnv()` inside `main()`, but ESM static imports evaluate `lib/prisma.ts` (module-level `console.error` when `DATABASE_URL` is unset at evaluation time) before `main()` runs. In my CLI run the `[prisma] ❌` line printed yet the diagnostic completed with `dbSignatureEqual=true` and a valid JSON file — a false alarm from import ordering, not a functional failure. No secrets are printed; JSON output goes to `--out` so stdout noise does not corrupt the artifact.
- **Required fix:** optional — move env loading before the prisma module is evaluated (e.g., a small preload) or suppress/accept the startup diagnostic. Does not block F3's stated fix (env loaded, JSON to `--out`, compact status line all satisfied).

## Overall assessment

- F2, F3 (functionally), F4, F5 are correctly fixed and verified. F1 is partially fixed: the recorder now observes raw reads, splits raw reads from writes, and a static scan covers the two new modules — but the runtime raw-write classification is defeated by the `$`-prefix mismatch between `WRITE_ACTIONS` and the recorded raw actions, and the static scan does not cover the diagnostic's transitive call graph. Current behavior is genuinely zero-write (instrumented + signature equality), so this is a proof-coverage gap, not a live-write defect.
- All 8 reviewer commands pass (7 test/tsc/CLI gates + `git diff --cached --check`); the CLI run's exit 1 is the expected `BLOCKED` status, not a failure.
- No unexplained test removals, no unexpected files in the candidate, no constraint weakening, no live mutation.

## Verdict

**zeroFix: false** — because F-1 is the same class of safety-gate (test-coverage) defect as the original F1 finding, and the fix that was intended to close it still cannot classify a recorded raw write as a write. The correction is small (WRITE_ACTIONS prefix alignment + a raw-write positive control, or a transitive static closure scan), but until it lands the "zero writes (model + raw)" claim is not fully proven at runtime. F-2/F-3 are minor hygiene items the planner may accept as recorded residuals. No GO/NO-GO is issued by this advisory review.