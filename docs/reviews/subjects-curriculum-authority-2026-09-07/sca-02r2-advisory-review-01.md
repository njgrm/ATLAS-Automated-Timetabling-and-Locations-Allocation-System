# SCA-02R2 Advisory Review 01 — Atomic Requirement Creation + Durable Evidence

Reviewer-Spawn-ID: ses_f83b16986ffeREi5mlo5lC5uPK

The execution-system spawn ID `ses_f83b16986ffeREi5mlo5lC5uPK` was captured from the spawn return envelope by the spawning parent and relayed to the reviewer before this artifact was written. It is repeated verbatim here (header + prose); typed aliases, filenames, personas, or paraphrases are never substitutes for this identifier.

**Reviewer context:** fresh advisory reviewer. Did not implement the SCA-02R2 work, holds no implementation context, and runs in a different context from the executor. All attacks below are the reviewer's own design; the executor's suite was spot-rerun (executed, counts recorded) but never copied as proof.

## Scope reviewed (changed files)

- `atlas-server/src/services/school-year-offering.service.ts` — SCA-02R2 changed ONLY `createRequirement` (canonical duplicate discovery + insert moved inside ONE Serializable transaction, P2034/40001 → typed 409 mapping after bounded existence re-read, spurious-abort retry ≤3 attempts) plus the `isSerializationConflict` helper. The rest of the file is SCA-02/02R carryover.
- `atlas-server/src/__tests__/curriculum-requirements-concurrency.test.ts` — executor's new regression test (read to understand, NOT copied).
- `atlas-server/src/routes/curriculum-requirements.router.ts` — POST `/requirements` route (transport only; unchanged by SCA-02R2).
- `docs/progress/subjects-curriculum-authority-2026-09-07-progress.md` — section "SCA-02R2 atomic creation + durable evidence".

## Method (reviewer-owned INSERT-gate attack)

Mechanism (DIFFERS from the executor's symmetric `$transaction`-entry barrier): staggered-start with an INSERT-gate. Request B is held at the `$transaction` boundary until request A has completed its in-tx duplicate discovery AND issued its in-tx `schoolYearOffering.create` (detected by wrapping A's tx-client `create`). B's discovery read therefore ALWAYS overlaps A's still-open write transaction: the pair can never execute as two disjoint sequential transactions, so a bare `Promise.all`+sleep vacuous pass is impossible by construction. The loser must either observe the winner in-tx or lose the Serializable SSI race (P2034/40001 → typed 409). Fail-open 10s timeout marks the attack un-engaged (loud failure, never silent pass); an unpatchable tx model throws loudly (fail-closed).

Disposable IDs: school **99972** / year **77872**, actor 42 — distinct from executor IDs (99971/77871) and prior suites (99981/99980, 99961/99960, 99991–99994). Live school 1 had zero contact (not even a read). Ephemeral port **5995** (closed in `finally`). No modifications staged/committed/stashed/reset; no schema/migration commands; no port-5001 restart.

## Exact commands + counts

From `D:/ATLAS/atlas-server`:
1. `npx tsx --env-file=.env src/__tests__/curriculum-requirements-concurrency.test.ts` → **27 passed, 0 failed** (matches executor claim 27/27).
2. `npx tsx --env-file=.env src/__tests__/curriculum-requirements-truth.test.ts` → **68 passed, 0 failed** (matches 68/68).
3. Wrote one temporary probe `src/__tests__/sca02r2-reviewer-probe-99972.test.ts`, ran `npx tsx --env-file=.env src/__tests__/sca02r2-reviewer-probe-99972.test.ts` → **35 passed, 0 failed**, then **deleted it** (`Test-Path` → False after delete; it lived under gitignored `**/__tests__/`, never staged).

From `D:/ATLAS`: `git ls-files` (3 test paths), `git status --short`, `git diff --cached --name-only`, `git diff --name-only`, forbidden-name grep → clean.

## Outcome evidence per attack (all gates engaged=true — no vacuous passes)

- **RB1 gated identical base-scope pair (service):** engaged, `a={ok,id=204} / b={REQUIREMENT_EXISTS,status=409}`, exactly 1 active canonical row, loser code has no `THROW:`/`P` prefix → zero raw Prisma/serialization leakage.
- **RB2 gated identical section-override pair (service):** engaged, exactly 1 success, loser `REQUIREMENT_EXISTS`, exactly 1 active section row.
- **RB3 gated identical cohort-override pair through the REAL route:** engaged, HTTP statuses `201,409`, loser body `code=REQUIREMENT_EXISTS` (winner body carries no `code` — expected `{requirement}` shape), no raw P2034 over HTTP, exactly 1 active cohort row.
- **RB4 gated DIFFERENT-identity pair under forced overlap (spurious-conflict safety):** engaged, both succeed (ids 209/210), 1 row each → no false 409, bounded retry is silent-safe, no silent duplicate retry.
- **RC1 same scope, different rotationFamily → both succeed:** two ROTATING_FAMILY_MEMBER rows (RVFAM1/Q1, RVFAM2/Q2) both succeed, persist exactly once each; term rows = 2 → identity distinction + term atomicity.
- **RC2 EMPTY-scope duplicate semantics:** first EMPTY create succeeds; second → 409 REQUIREMENT_EXISTS.
- **RC3 retired-then-recreate then re-duplicate:** retire deactivates; recreate succeeds (retired does not block); re-duplicate → 409.
- **RC4 sequential duplicate still 409:** first succeeds; immediate duplicate → typed 409 REQUIREMENT_EXISTS (no concurrency needed).
- **RC5 untyped-error probe (garbage ids → typed 4xx, never Prisma 500):** service nonexistent subject → 400 INVALID_SUBJECT; `'xyz'` section id → 400 INVALID_OFFERING; NaN subject → typed 400; route-level `'abc'` subject → HTTP 400 INVALID_OFFERING. No `THROW:`/`P`-prefixed leakage in any of the four.
- **Residue:** `0` on school 99972 across all six tables (offerings, term configs, section mirrors, cohorts, subjects, year mirrors), asserted in-run post-cleanup.

## Tracking verification (D)

`git ls-files` confirms all three test paths tracked: `atlas-server/src/__tests__/curriculum-requirements-truth.test.ts`, `atlas-client/src/lib/__tests__/curriculum-scope-states.test.ts`, `atlas-server/src/__tests__/curriculum-requirements-concurrency.test.ts`. `git status --short` shows the staged set contains ONLY those three tests plus `docs/progress/subjects-curriculum-authority-2026-09-07-progress.md`, with `school-year-offering.service.ts` modified-but-unstaged (` M`) — exactly the expected "source packaging needs separate authorization" state. No untracked files.

## Boundary scan (E)

`git diff --name-only` (unstaged) = only `atlas-server/src/services/school-year-offering.service.ts`. Forbidden-name grep over status (faculty-assignment, TeachingLoad/teaching-load, generation/generator, prisma/schema, migrations, .env, EnrollPro/AIMS/smart-final) → empty. Zero TL-06R3C files, zero generation / Teaching Load / schema / migration / .env / external-repo changes.

## Requirement-to-enforcement matrix (F)

All call sites in `school-year-offering.service.ts`; route `curriculum-requirements.router.ts:199-221` (transport only).

| Demand | Production call site | Executable proof |
|---|---|---|
| In-tx discovery+insert | `createRequirement` Serializable `$transaction` block | RB1/RB2/RB3 engaged + exactly 1 win |
| Exactly-one-row | same block + unique active identity | row counts = 1 in RB1/RB2/RB3 |
| Typed-409-not-raw | `catch` + `isSerializationConflict` mapping | loser `REQUIREMENT_EXISTS`/409, no `P2034`/`THROW`; HTTP 201+409 |
| Identity distinctions incl. rotationFamily | `requirementIdentityOf/Key` | RB2 section, RB3 cohort, RC1 families both succeed, RC2 EMPTY dup 409 |
| Retired-does-not-block | discovery `isActive:true` filter | RC3 recreate succeeds |
| Term-atomicity | term creates inside same tx | RC1 exactly 2 term rows; RB4 no extra rows |
| No-silent-duplicate-retry | `MAX_CREATE_ATTEMPTS=3` + fresh-tx re-discovery | RB4 both succeed exactly once |
| Bounded serialization mapping | statusCode-carrier exclusion in `isSerializationConflict` | RC4 sequential 409 (no retry path); RC5 typed 400s |
| No hardcoding | no school/count literals (only attempt bound) | fresh IDs 99972/77872 throughout |
| No migration | — | diff shows service-only change, no schema/migrations |
| 7 regression items (C1–C7) | executor concurrency suite | rerun 27/27 by this reviewer |
| Durable tracking | git index | ls-files + staged-set verified above |

## Findings

- **Product/runtime defects:** none.
- **Safety-gate defects:** none.
- **Process/docs inconsistencies:** none. The ledger's 27/27, 68/68, staged-set, and unstaged-service claims were all reproduced exactly. (Note: a garbage string section id yields service-level 400 `INVALID_OFFERING` rather than `INVALID_SECTION_SCOPE` — a typed 400 either way, recorded here for precision, not a defect.)

## Verdict

`zeroFix: true`

SCA-02 stays REVIEW_REQUIRED until planner QA; SCA-03 stays locked.
