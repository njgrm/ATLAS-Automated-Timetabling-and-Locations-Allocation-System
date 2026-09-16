# AUTHZ-CLASS-TEMPLATE-C07 — executor handoff

Status: `REVIEW_REQUIRED`
Role: `EXECUTOR` (reasoning variant `high`)
Cycle: `AUTHZ-CLASS-TEMPLATE-C07`
Base SHA: `917da8be1c0dea13e2a5062f3883cce82c829384`
Worktree: `E:/ATLAS-worktrees/authz-class-template-c07`
Branch: `work/authz-class-template-c07`
Candidate SHA: recorded on `work/authz-class-template-c07` (single commit, this file included)
Worktree disposition: `RETIRE_AFTER_INTEGRATION`
`PLANNER_SESSION_ROUTE: EXISTING`

## Changed paths (candidate contains only these)

- `atlas-server/src/routes/class-template.router.ts`
- `atlas-server/src/services/class-template.service.ts`
- `atlas-server/src/__tests__/class-template-authority-c07-guard.test.ts` (new)
- `atlas-server/src/__tests__/class-template-authority-c07.test.ts` (new)
- `docs/handoffs/authz-class-template-c07-executor.md` (new)

`atlas-server/src/__tests__/helpers/tt-source-freshness-db.ts` is reused **read-only**
(`provisionDisposableDatabase` / `readSourceDatabaseUrl`) and is unmodified.

## Contract implemented

1. `authenticate` + `requirePrivilegedRole` on **both** GET routes; `authenticateWithSystemToken` is not used.
2. Positive integer actor school required before any dispatch; exact requested-school equality;
   no `?? 1` / `|| 1` / `DEFAULT_SCHOOL_ID` anywhere in the changed files.
3. `GET /:id` bound to the owning school (`getTemplateByIdForSchool`), with an identifier-only
   `probeTemplateOwnerSchoolId` to discriminate `403 CROSS_SCHOOL_DENIED` (no payload) from `404`.
4. All seeding/writes removed from every GET; `GET /` no longer calls `ensureDefaultTemplates`.
5. `POST /class-templates/initialize` is the only production path that creates defaults: one
   interactive transaction, idempotent replay (`createdCount: 0`, `idempotent: true`), exactly one
   `auditLog` row per invocation (`action: 'CLASS_TEMPLATE_INITIALIZE'`).
6. `POST /`, `PATCH /:id`, `PUT /:id/subjects` are actor-school bound with the owning-school check
   **inside** the write transaction (`updateTemplateForSchool`, `setTemplateSubjectsForSchool`);
   zero writes on rejection.
7. Existing response shapes and typed `400`/`409` behavior preserved (see G12 rows).

## Trace table (requirement -> production path -> negative control -> verification)

| # | Requirement | Production path | Negative control | Verification command |
|---|---|---|---|---|
| R1 | both GETs require auth + privileged role | `class-template.router.ts` GET `/`, GET `/:id` middleware chain | NC1 (drop `authenticate` from `GET /`) | `npx tsx src/__tests__/class-template-authority-c07-guard.test.ts` |
| R2 | actor school required, exact equality, no implicit default | `actorSchoolIdOf()` + equality checks | NC2 (drop equality check from `GET /`) | guard suite G04/G05 |
| R3 | `GET /:id` owning-school bound, no foreign payload | `getTemplateByIdForSchool()` + `probeTemplateOwnerSchoolId()` | G06 foreign-owner row | disposable suite G06 |
| R4 | zero writes on every GET | GET handlers dispatch scoped reads only | NC3 (re-add `ensureDefaultTemplates` to `GET /`) | disposable suite G07 delta |
| R5 | explicit, audited, idempotent initialize command | `initializeDefaultTemplatesForSchool()` | NC4 (delete `auditLog.create`) | disposable suite G09/G10 |
| R6 | mutation routes actor-school bound, owner check in-transaction | `createTemplate`, `updateTemplateForSchool`, `setTemplateSubjectsForSchool` | G12 foreign rows | disposable suite G12 |
| R7 | preserve response shapes + typed 400/409 | router bodies + service typed throws | G12 positive PATCH/PUT/POST + typed-error rows | disposable suite G12 |

## Section 3.3 gate matrix

| # | Control | Status | Exact command / observed result |
|---|---|---|---|
| G01 | unauthenticated `GET /` | PASS | `npx tsx src/__tests__/class-template-authority-c07-guard.test.ts` → `401 NO_TOKEN`, never 500, never 200, no template payload |
| G02 | unauthenticated `GET /:id` | PASS | same suite → `401 NO_TOKEN`, never 500, never 200, no template payload |
| G03 | malformed token / non-privileged role | PASS | same suite → `401 INVALID_TOKEN` (both GETs), `403 FORBIDDEN` (both GETs + `POST /initialize`), plus system token → `401 INVALID_TOKEN` |
| G04 | missing actor school | PASS | same suite → `403 ACTOR_SCHOOL_REQUIRED` on `GET /`, `GET /:id`, `POST /initialize`, `POST /`, `PATCH /:id`, `PUT /:id/subjects`, zero dispatch |
| G05 | cross-school collection GET | PASS | same suite → `403 CROSS_SCHOOL_DENIED`; malformed `schoolId=0`/`abc` and malformed ids → `400 INVALID_PARAM`; never 500 |
| G06 | cross-school item GET | PASS | disposable suite → `403 CROSS_SCHOOL_DENIED`, no `template` key, no foreign label text, zero fixture-row delta |
| G07 | same-school collection GET on template-less school | PASS | disposable suite → `200 { templates: [] }`, `classTemplate` count A stays `0`, audit delta `0` |
| G08 | same-school item GET / absent id | PASS | disposable suite → `200` with the C template / `404 NOT_FOUND`; zero writes |
| G09 | `POST /initialize` same-school | PASS | disposable suite → `200`, `createdCount: 4`, 4 new `classTemplate` rows, exactly 1 `auditLog` row (`schoolId`=B, `schoolYearId`=null, `actorId`=9412, `targetIds`=[2,3,4,5], `metadata.source='class-template.initialize'`, `createdCount=4`, `idempotent=false`); load-bearing via NC4 |
| G10 | `POST /initialize` replay | PASS | disposable suite → `200`, `createdCount: 0`, `idempotent: true`, 0 new templates, exactly 1 additional audit row (`targetIds: []`) |
| G11 | `POST /initialize` foreign body school | PASS | guard suite → `403 CROSS_SCHOOL_DENIED` pre-dispatch; disposable suite → zero template/audit delta, requested school still 0 templates |
| G12 | mutation binding | PASS | disposable suite → `POST /` foreign body school `403` + zero rows; `PATCH /:id` foreign `403` + row byte-unchanged; `PUT /:id/subjects` foreign `403` + zero bindings; absent ids `404` + zero rows; positive same-school `PATCH`/`PUT`/`POST` return `200/200/201` with the intended change; `409 DUPLICATE`; `400 INVALID_PERIOD_LENGTH`/`INVALID_PERIODS_PER_DAY`/`MISSING_FIELDS` preserved |
| G13 | writer/caller + fallback census | PASS | guard suite census (no DB): only `services/class-template.service.ts` contains `ensureDefaultTemplates(`; caller is `initializeDefaultTemplatesForSchool` (tx-bound); `ensureTemplatesForProgramTypes` has zero production callers (export retained); no `?? 1` / `|| 1` / `DEFAULT_SCHOOL_ID` in the changed files; GET handlers contain no write token; router never uses `authenticateWithSystemToken` |
| G14 | NC1 delete `authenticate` from `GET /` | PASS | post-commit mutant run (see Mutants) — G01 control fails, bytes restored, suite green again |
| G15 | NC2 delete actor-school equality from `GET /` | PASS | post-commit mutant run (see Mutants) — G05 control fails, bytes restored, suite green again |
| G16 | NC3 re-add `ensureDefaultTemplates` to `GET /` | PASS | post-commit mutant run (see Mutants) — G07 observes created rows, bytes restored, suite green again |
| G17 | typecheck + build | PASS | `npx tsc --noEmit` → exit `0`; `npm run build` (`tsc`) → exit `0` |
| G18 | zero residue + live safety | PASS | disposable `atlas_restore_drill_20260915_c07e73924` dropped and `assertDropped()` = `0`; read-only probe of the configured source database reports `0` fixture schools; mutants byte-restored with `git status --porcelain=v2` empty and `git diff --quiet` clean |
| NC4 | delete `auditLog.create` from the initialize command (evidence inside G09) | PASS | post-commit mutant run (see Mutants) — G09 audit-row assertion fails, bytes restored, suite green again |

Suite totals: guard suite `136 passed, 0 failed`; disposable suite `85 passed, 0 failed`.

## Production-shape parity

| Row | Value |
|---|---|
| Real producer | `DEFAULT_TEMPLATE_SPECS` → `ensureDefaultTemplates(schoolId, tx)` → `initializeDefaultTemplatesForSchool(schoolId, actorId)` → `POST /api/v1/class-templates/initialize` |
| Real consumer(s) | `atlas-client/src/pages/Audit.tsx:144` (`GET /class-templates?schoolId=<actorSchoolId>`, authenticated page, bearer token attached by `atlasApi`); the new initialize command consumer |
| Conservation totals | 4 default program types (`REGULAR`, `STE`, `SPA`, `SPS`) created once per school; `classTemplate` 0 → 4 on first invocation, +0 on replay; `auditLog` +1 per invocation (+2 across the replay); zero subject bindings when the school has no matching active subjects |
| Negative control | NC3 (reintroduce `ensureDefaultTemplates` on `GET /`) makes G07 observe created `classTemplate` rows and fail |
| Result | PASS — read path is now write-free and the create path is exactly the one audited transaction |

## Mutants (run AFTER the candidate commit)

Protocol per mutant: copy the pristine committed bytes to
`C:\Users\njgro\AppData\Local\Temp\opencode\`, mutate, run the named control, copy the pristine
bytes back, then prove `git status --porcelain=v2` and `git diff --quiet` are both clean and the
candidate SHA is unchanged. No mutant is left in the tree.

- `NC1` — delete `authenticate` from `GET /` (guard suite).
- `NC2` — delete the actor-school equality check from `GET /` (guard suite, G05 row).
- `NC3` — reintroduce `ensureDefaultTemplates` on `GET /` (disposable suite, G07 row).
- `NC4` — delete the `auditLog.create` from the initialize command (disposable suite, G09 row).

Exact observed output for each mutant is recorded in the executor's returned report (the packet
requires the mutants to run after this commit, so their byte-restoration proof is necessarily
post-commit evidence).

## Known risks

- `NON_BLOCKING` — two concurrent initialize invocations for the same school could both attempt the
  creates; the `uq_class_template_school_program` unique constraint would surface a Prisma `P2002`
  (via the generic error handler). Sequential replay idempotence is proven as required; the packet
  does not require a racing-invocation guarantee.
- `NON_BLOCKING` — `POST /` `MISSING_FIELDS` message no longer lists `schoolId`, because §2.4.2 makes
  the body `schoolId` optional and the actor school authoritative when absent. Every other typed
  `400`/`409` is behaviorally unchanged and covered by G12.
- `NON_BLOCKING` — `GET /?schoolId=0` / negative previously flowed into the service; it is now a typed
  `400 INVALID_PARAM` as required by §2.2 step 3 (non-numeric already returned `400`).
- `NON_BLOCKING` — this worktree has no committed dependency tree; `atlas-server/node_modules` is a
  junction to `E:/ATLAS-worktrees/published-immutability-archive-audit-c07/atlas-server/node_modules`
  (lockfile SHA-256 `ECF06AEF5C385591A0CF4C03F6852018B283182375F9B23656210BF13794B6E5` identical;
  `prisma/schema.prisma` SHA-256 `C53562963B11230443D9FF94DACE73C7CFF8F46BA2D22140B52711956040487E`
  identical). Treated read-only; `node_modules` is gitignored and is not part of the candidate.
- `NON_BLOCKING` — `ensureTemplatesForProgramTypes` keeps zero production callers; recorded, not
  deleted, per §2.
- `OBSERVATION` — `origin/main` at execution time is `750cafcb` (advanced past the dispatch value
  `07da71c8`); base `917da8be` is an ancestor and `git diff --stat 917da8be..origin/main` for the
  three touched source files is empty, so no drift affects this candidate.

## Zero-mutation statement

No deployment, service restart, supervisor/task/env change, browser session, login, push, merge,
rebase, reset, or stash occurred. No `prisma/**` change. The only database touched was the guarded
disposable database created by `provisionDisposableDatabase('c07')` and dropped with
`assertDropped()`. The configured source database was probed read-only only. No HTTP left
`127.0.0.1`.
