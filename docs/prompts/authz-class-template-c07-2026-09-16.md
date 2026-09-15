# AUTHZ-CLASS-TEMPLATE-C07 — executor packet (class-template authority boundary)

Cycle: `AUTHZ-CLASS-TEMPLATE-C07` (planner-led end-to-end: executor -> fresh QA ->
Wave Completion Audit). Risk tier for **source work**: `MEDIUM`. Live
deployment/acceptance is a **separate `HIGH` action** and is explicitly **out of
scope** for this packet.

Role: `atlas-executor` (or `atlas-executor-delegate`). Reasoning variant: `high`.

## 0. Authority and boundaries

- Base SHA: recorded in the living machine register for this stream
  (`docs/plans/atlas-delivery-cycles.json`, `streams[AUTHZ-CLASS-TEMPLATE-C07].git.baseSha`).
- Worktree: `E:/ATLAS-worktrees/authz-class-template-c07`
- Branch: `work/authz-class-template-c07`
- Directive: read `origin/main:AGENTS.md` (normalized LF SHA-256 recorded by the
  planner in the dispatch). Do not re-read the whole file from disk.
- **Forbidden**: deployment, service restart, supervisor/task/env changes,
  browser sessions, any login, any mutation of the configured/live database,
  `prisma` schema or migration changes (no `prisma/**`), companion repositories,
  `ops/workflow/**`, `docs/plans/**` (planner-owned), `atlas-client/**` (no
  client change is authorized by this packet), any file outside the owned list.
- **Owned paths** (candidate may contain only these):
  - `atlas-server/src/routes/class-template.router.ts`
  - `atlas-server/src/services/class-template.service.ts`
  - `atlas-server/src/__tests__/class-template-authority-c07.test.ts` (new)
  - `atlas-server/src/__tests__/class-template-authority-c07-guard.test.ts` (new)
  - `docs/handoffs/authz-class-template-c07-executor.md` (new handoff)
  - Reuse `atlas-server/src/__tests__/helpers/tt-source-freshness-db.ts`
    **read-only** (its `provisionDisposableDatabase` helper). Do not edit it.
- Do not push. Do not merge/rebase/reset/stash. One candidate commit (plus
  additive correction commits only if the planner asks).
- Mutation boundary: the only database this packet may touch is a **guarded
  disposable** database created by `provisionDisposableDatabase()` and dropped in
  `finally` with a zero-residue assertion. The configured source database and the
  live deployment are read-only/untouched. No login. No HTTP call outside
  `127.0.0.1`.

## 1. Defect statement (verified on the base by the planner)

`atlas-server/src/routes/class-template.router.ts` currently exposes:

```
GET /            -> no auth, no role gate; Number(req.query.schoolId);
                    await templateService.ensureDefaultTemplates(schoolId);   <-- WRITE ON READ
GET /:id         -> no auth, no role gate; unscoped findUnique by id           <-- CROSS-SCHOOL READ
POST /           -> authenticate + requirePrivilegedRole; body schoolId with NO actor-school equality
PATCH /:id       -> authenticate + requirePrivilegedRole; unscoped read/update by id
PUT /:id/subjects-> authenticate + requirePrivilegedRole; unscoped delete+create of bindings
```

Consequences: an anonymous caller can enumerate every school's class templates
and can *cause writes* (four default templates) into any school by requesting
`GET /class-templates?schoolId=N`; an authenticated privileged actor of school A
can read, retarget and rewrite school B's templates by id; and there is no
`schoolId` fallback constant, but also no actor-school authority at all.

Verified caller census on the base: the only deployed client caller is
`atlas-client/src/pages/Audit.tsx:144`
(`atlasApi.get('/class-templates?schoolId=' + actorSchoolId)`), on an
authenticated page that already waits for a resolved `actorSchoolId`; `atlasApi`
attaches the bearer token. No other production caller of these routes exists.
`ensureTemplatesForProgramTypes` has **zero** production callers (unreachable
export; record it, do not delete it).

This packet is one coherent production contract (the class-template authority
boundary) in one router + one service. Do not split it.

## 2. Required final contract

### 2.1 Shared router authority helpers

Add to the router:

```ts
function actorSchoolIdOf(req: Request): number | null {
  const schoolId = req.user?.schoolId;
  return typeof schoolId === 'number' && Number.isInteger(schoolId) && schoolId > 0 ? schoolId : null;
}
```

- Missing/invalid actor school on **any** class-template route =>
  `403 { code: 'ACTOR_SCHOOL_REQUIRED', message: 'The authenticated actor must have an assigned school.' }`
  **before any service dispatch**.
- No `?? 1`, `|| 1`, `DEFAULT_SCHOOL_ID`, or any other implicit school default
  may exist anywhere in the changed files. The actor school from the verified JWT
  is the only implicit scope; every other scope must be explicit and equal to it.
- Middleware order per route: `authenticate`, `requirePrivilegedRole`, then the
  actor-school guard, then parameter validation, then school equality, then
  dispatch. `authenticateWithSystemToken` must **not** be used on this router
  (system tokens carry no school and stay rejected by `authenticate`).

### 2.2 `GET /class-templates?schoolId=X`

1. `authenticate`, `requirePrivilegedRole`.
2. Actor school must be a positive integer -> else `403 ACTOR_SCHOOL_REQUIRED`.
3. `schoolId` query must be a positive integer -> else `400 INVALID_PARAM`
   (unchanged contract).
4. `schoolId` must equal the actor school -> else
   `403 { code: 'CROSS_SCHOOL_DENIED', message: 'Cannot read another school\u2019s class templates.' }`.
5. `getTemplatesBySchool(actorSchoolId)` -> `200 { templates }`.
6. **Remove `ensureDefaultTemplates` from this route entirely.** This route
   performs zero writes, always.

### 2.3 `GET /class-templates/:id`

1. `authenticate`, `requirePrivilegedRole`.
2. Actor school required -> `403 ACTOR_SCHOOL_REQUIRED`.
3. `id` must be a positive integer -> else `400 INVALID_PARAM`.
4. Bind to the template's owning school:
   - template exists and `schoolId === actorSchoolId` -> `200 { template }`;
   - template exists and `schoolId !== actorSchoolId` ->
     `403 { code: 'CROSS_SCHOOL_DENIED', ... }` with **no template payload**
     (no `template` key, and no label/name/subject data from the foreign row);
   - template absent -> `404 { code: 'NOT_FOUND', ... }`.
5. Zero writes.

Implement this with a school-scoped read first
(`getTemplateByIdForSchool(id, actorSchoolId)`) and only then, when it misses, a
minimal existence probe (`select: { id, schoolId }`) to discriminate 403 from
404. Never return a foreign row's payload. Prefer adding the scoped reader to the
service over inlining Prisma in the router; keep the router transport-only.

### 2.4 `POST /class-templates` (create)

1. `authenticate`, `requirePrivilegedRole`, actor school required
   (`403 ACTOR_SCHOOL_REQUIRED`).
2. `body.schoolId`: when present it must be a positive integer equal to the actor
   school -> mismatch is `403 CROSS_SCHOOL_DENIED`; malformed is
   `400 INVALID_PARAM`. When absent, the actor school is used.
3. All other existing validation (`MISSING_FIELDS`, `INVALID_PROGRAM_TYPE`,
   `P2002 -> 409 DUPLICATE`) is preserved byte-for-byte in behavior.
4. `createTemplate(actorSchoolId, {...})` -> `201`.

### 2.5 `PATCH /class-templates/:id`

1. `authenticate`, `requirePrivilegedRole`, actor school required.
2. `id` positive integer -> else `400 INVALID_PARAM`.
3. The write must verify the template's owning school **inside the write path**:
   - foreign template -> `403 CROSS_SCHOOL_DENIED`, zero writes;
   - absent -> `404 NOT_FOUND`, zero writes;
   - own template -> the update proceeds and returns `200 { template }`.
4. Preserve the existing `INVALID_PERIOD_LENGTH` / `INVALID_PERIODS_PER_DAY`
   typed 400s.

### 2.6 `PUT /class-templates/:id/subjects`

1. `authenticate`, `requirePrivilegedRole`, actor school required.
2. `id` positive integer; `subjectIds` must be a non-empty array
   (`400 MISSING_FIELDS` preserved).
3. The owning-school verification and the binding replacement must happen in
   **one interactive transaction** (no TOCTOU): scoped owning-school check, then
   `deleteMany` + `createMany`. Foreign template -> `403 CROSS_SCHOOL_DENIED`,
   absent -> `404 NOT_FOUND`, and in both cases **zero** `classTemplateSubject`
   rows are touched.
4. Own template -> `200 { template }` (unchanged response shape).

### 2.7 New explicit initialization command

`POST /class-templates/initialize` — `authenticate`, `requirePrivilegedRole`.

This is the **only** production path that may create default templates now.

1. Actor school required -> `403 ACTOR_SCHOOL_REQUIRED` (before any dispatch).
2. `req.user.userId` must be a positive integer -> else
   `401 { code: 'NO_USER', message: 'Authenticated user required.' }` (an audited
   command needs a real actor; zero writes).
3. Optional `body.schoolId`: when present it must equal the actor school -> else
   `403 CROSS_SCHOOL_DENIED` (zero writes).
4. Service command (new export, e.g.
   `initializeDefaultTemplatesForSchool(schoolId, actorId)`) that runs the whole
   command in **one interactive transaction**:
   - read the school's existing template program types (scoped);
   - create only the missing `DEFAULT_TEMPLATE_SPECS` entries (idempotent);
   - insert **exactly one** `auditLog` row inside the same transaction:
     `{ schoolId: actorSchoolId, schoolYearId: null, action: 'CLASS_TEMPLATE_INITIALIZE', actorId, targetIds: <created template ids>, metadata: { createdProgramTypes, createdCount, idempotent, source: 'class-template.initialize' } }`
     (`action` must be <= 50 chars for `VarChar(50)`);
   - on any failure: zero template rows and zero audit rows.
   - `ensureDefaultTemplates` may be refactored to accept an optional
     `Prisma.TransactionClient` (pattern already used by
     `getTemplatePeriodProfiles`) and to return the created program types/ids.
5. Response `200 { templates, createdProgramTypes, createdCount, idempotent }`.
6. Idempotence: a second authorized invocation creates **zero** new
   `classTemplate` rows, reports `createdCount: 0` and `idempotent: true`, and
   still writes exactly one audit row for that invocation.

### 2.8 No-go

- Any read route that writes. Any route that dispatches before the actor-school
  guard. Any cross-school disclosure of a template payload. Any implicit school
  default. Any system-token acceptance on this router.

## 3. Required produced artifacts

### 3.1 `atlas-server/src/__tests__/class-template-authority-c07-guard.test.ts`

A **dispatch-free** mounted suite: it must prove the guard rows reject without
ever reaching the database.

- Before importing `../app.js`, set `process.env.DATABASE_URL` to a
  syntactically valid URL for a database that **does not exist** (clone the
  configured source URL and replace only the database name with
  `atlas_c07_absent_<random>`; never print or commit the URL, and never create
  it). Load `JWT_SECRET`/`ATLAS_SYSTEM_TOKEN` from the durable env
  (`D:/ATLAS-runtime-config/atlas-server.env`) or `atlas-server/.env` the same way
  the existing mounted suites do (`loadServerEnv` pattern).
- Boot the real app on an ephemeral port and hand-sign JWTs.
- Assert every guard row returns its typed rejection and **never `500`** and
  **never `200`** (a `500` here is exactly what a pre-guard dispatch against the
  absent database would produce, so this is the zero-dispatch control):
  - no `Authorization` header on `GET /` and `GET /:id` -> `401 NO_TOKEN`;
  - malformed bearer token -> `401 INVALID_TOKEN`;
  - `role: 'faculty'` JWT with a school on `GET /`, `GET /:id`,
    `POST /initialize` -> `403 FORBIDDEN`;
  - `role: 'officer'` JWT **without** `schoolId` on `GET /`, `GET /:id`,
    `POST /initialize` -> `403 ACTOR_SCHOOL_REQUIRED`;
  - `role: 'officer'` JWT for school A requesting `GET /?schoolId=B` ->
    `403 CROSS_SCHOOL_DENIED`;
  - no response body may contain `templates` or `template` keys.
- Documented fallback **only if** the app cannot boot without a reachable
  database: invoke the real router directly under an instrumented
  `withDataContext()` client (`$extends` with
  `query.$allModels.$allOperations` counting every operation) and assert the
  counter is exactly `0` for each guard row. Record which mechanism was used.

### 3.2 `atlas-server/src/__tests__/class-template-authority-c07.test.ts`

A mounted suite over a **guarded disposable database**:

- Import the helper first, call `provisionDisposableDatabase('c07')` (returns
  `null` -> report `EXTERNALLY_BLOCKED(DISPOSABLE_DB_UNAVAILABLE)` instead of
  faking evidence), then set `process.env.DATABASE_URL = disposable.targetUrl`
  **before** the dynamic `import('../app.js')` / `import('../lib/prisma.js')`, so
  the production singleton is bound to the disposable database.
- Fixture: three disposable schools in the disposable database only —
  `A` (read rows), `B` (initialize rows), `C` (item rows with one pre-created
  template and zero subject bindings). Use a clearly disposable
  `FIXTURE_NAME` (`AUTHZ-CLASS-TEMPLATE-C07 FIXTURE — SAFE TO DELETE`).
- `finally`: `drop()` + `assertDropped()`; assert the configured source database
  was never written (no `classTemplate`/`auditLog` row keyed to a fixture school
  can exist there, and no fixture school row was created there).

### 3.3 Gate matrix the executor must implement and report

Number these exactly; QA will report the mandatory tally against this list.

| # | Control | Pass condition |
|---|---|---|
| G01 | unauthenticated `GET /` | `401 NO_TOKEN`, zero dispatch, zero writes |
| G02 | unauthenticated `GET /:id` | `401 NO_TOKEN`, zero dispatch, zero writes |
| G03 | malformed token + non-privileged (`faculty`) role on both GETs | `401 INVALID_TOKEN` / `403 FORBIDDEN`, zero dispatch, zero writes |
| G04 | missing actor school on `GET /`, `GET /:id`, `POST /initialize` | `403 ACTOR_SCHOOL_REQUIRED`, zero dispatch, zero writes |
| G05 | cross-school collection GET (`?schoolId` != actor school) | `403 CROSS_SCHOOL_DENIED`, zero dispatch, **zero writes in the requested school** |
| G06 | cross-school item GET (foreign-owned template) | `403 CROSS_SCHOOL_DENIED`, **no template payload**, zero writes |
| G07 | same-school collection GET on a template-less school | `200`, `templates: []`, **zero `classTemplate` rows created** (write-on-read removed) |
| G08 | same-school item GET; same-school absent id | `200` with the template / `404 NOT_FOUND`; zero writes |
| G09 | `POST /initialize` same-school | `200`, exactly the missing defaults created, **exactly one** `auditLog` row (action `CLASS_TEMPLATE_INITIALIZE`, `schoolId` = actor school, `actorId` = fixture actor, `targetIds` = created ids, metadata fields present); the audit write must be proven load-bearing by mutant NC4 |
| G10 | `POST /initialize` replay | `200`, `createdCount: 0`, `idempotent: true`, zero new `classTemplate` rows, exactly one additional audit row |
| G11 | `POST /initialize` with foreign `body.schoolId` | `403 CROSS_SCHOOL_DENIED`, zero template rows, zero audit rows, zero dispatch |
| G12 | mutation binding: `POST /` foreign body school; `PATCH /:id` foreign template; `PUT /:id/subjects` foreign template | `403` + zero writes + unchanged foreign row/bindings; plus positive same-school `PATCH` and `PUT` rows returning `200` with the intended change (no over-strict regression) |
| G13 | writer/caller + fallback census (mechanical, over `atlas-server/src` excluding `__tests__`) | no production caller of `ensureDefaultTemplates` other than `initializeDefaultTemplatesForSchool`; no write reachable from any GET; `ensureTemplatesForProgramTypes` has zero production callers (recorded, not deleted); no `?? 1`, `|| 1`, `DEFAULT_SCHOOL_ID` in the changed files |
| G14 | mutant NC1: delete `authenticate` from `GET /` | the G01/G02 assertion fails (typed rejection replaced by a `500`/`200`), then bytes are restored byte-identically and the suite passes again |
| G15 | mutant NC2: delete the actor-school equality check from `GET /` | G05 returns `200` (fails), then bytes are restored byte-identically and the suite passes again |
| G16 | mutant NC3: reintroduce `ensureDefaultTemplates` on `GET /` | G07 observes created `classTemplate` rows (fails), then bytes are restored byte-identically and the suite passes again |
| G17 | `atlas-server`: `npx tsc --noEmit` (typecheck) and `npm run build` | both exit `0` |
| G18 | zero residue + live safety | disposable database dropped and asserted dropped; configured source database and live school rows untouched; `git status` clean after the candidate commit |

`NC4` (required evidence inside G09, not a separate numbered row): temporarily
delete the `auditLog.create` from the initialize command and observe G09's
audit-row assertion fail; restore bytes byte-identically and re-run green.

Mutants: before mutating, copy the pristine file to
`C:\Users\njgro\AppData\Local\Temp\opencode\`, mutate, run the named control,
then copy the pristine bytes back and prove
`git status --porcelain=v2` and `git diff --quiet` are both clean **and** that the
committed candidate is unchanged. Never leave a mutant in the tree. Run mutants
**after** the candidate commit so a failed restoration cannot contaminate the
candidate.

## 4. Required return contract

Commit one candidate on `work/authz-class-template-c07` (conventional message,
e.g. `fix(authz): bind class-template routes to the authenticated actor school`),
then return exactly one handoff containing:

- base SHA, candidate SHA, exact `git status --short` for the worktree;
- exact changed-path list (must equal the owned list in section 0);
- the section 3.3 matrix with every row marked `PASS` / `BLOCKED` / `DEFERRED`
  and the exact command + observed result for each;
- the production-shape parity row: real producer
  (`DEFAULT_TEMPLATE_SPECS` -> `ensureDefaultTemplates` ->
  `initializeDefaultTemplatesForSchool` -> `GET /class-templates`), real
  consumers (`Audit.tsx` read; the new initialize command), conservation
  totals (created program types, template counts, audit rows) and the failing
  negative control;
- known risks classified `BLOCKING` / `NON_BLOCKING`;
- `REVIEW_REQUIRED`, and `PLANNER_SESSION_ROUTE: EXISTING` for the planner.

Also commit `docs/handoffs/authz-class-template-c07-executor.md` with the same
compact content as part of the candidate.

## 5. Explicitly deferred (not part of this packet)

- Deployment of the corrected source to the supervised runtime, and any live or
  authenticated acceptance, remain a separate `HIGH` action with its own preview,
  approval sentence and post-action verification.
- EnrollPro/AIMS/SMART repositories remain `READ_ONLY`.
- The client-side "initialize default templates" affordance is not authorized
  here; the operator-facing path for this cycle is the API command.
