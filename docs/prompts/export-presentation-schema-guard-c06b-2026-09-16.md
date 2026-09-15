# EXPORT-PRESENTATION-SCHEMA-GUARD-C06B — bounded source correction

- **Role:** executor (`atlas-executor-delegate`), effort `high`
- **Risk tier:** MEDIUM (source + test; no live action, no migration, no deployment)
- **Base:** the tip of this branch (`work/export-presentation-schema-guard-c06b`), which is
  the planner packet/bookkeeping commit immediately above `origin/main` `4160028f`
- **Worktree:** `E:/ATLAS-worktrees/export-presentation-schema-guard-c06b`
- **Branch:** `work/export-presentation-schema-guard-c06b`
- **Worktree disposition:** `RETIRE_AFTER_INTEGRATION`
- **Predeclared gates:** `MANDATORY_SOURCE = 17`, `MANDATORY_LIVE = 0`,
  `DEFERRED_EXTERNAL = 0` (readiness is `SOURCE_ONLY`)

## 1. Objective

When migration `prisma/migrations/0003_teacher_program_presentation` is **not applied**
(the table `teacher_program_presentation_revisions`, or one of its columns, does not
exist), the official **teacher-program DOCX export** must fail closed with a typed JSON
service-unavailable response — `503` + `code: "EXPORT_PRESENTATION_SCHEMA_UNAVAILABLE"` —
and must never return HTML, Prisma error text, stack detail, SQL identifiers, or partial
document bytes.

Today the failure escapes as an untyped Prisma error: `readEffectiveSignatoryProfile`
(and its siblings) let `P2021`/`P2022` propagate out of
`buildTeacherProgramExportShape`, the route calls `next(e)`, and the shared
`errorHandler` answers `500` with `code: "P2021"` — a leaked Prisma/schema detail — while
the presentation settings routes answer the same leaky `500`.

## 2. Required production behavior (the contract)

### 2.1 Guard location and narrowness

`atlas-server/src/services/export-presentation.service.ts` is the presentation authority
and the only place the new translation is implemented. It must:

1. Translate **only** a Prisma `P2021` ("table does not exist") or `P2022` ("column does
   not exist") raised by the **teacher-program presentation revision store calls**
   (`teacherProgramPresentationRevision.findFirst` / `.create` on the real data context,
   including inside the interactive transaction) into a typed error.
2. Use the existing typed error class so every current consumer stays consistent:
   `new PresentationProfileError(503, 'EXPORT_PRESENTATION_SCHEMA_UNAVAILABLE', MESSAGE)`.
   Carry **no** `details` payload.
3. Pin this exact client-facing message (single constant, used for every consumer):

   `Teacher-program presentation settings are unavailable because the required presentation schema has not been provisioned on this deployment. No official document can be produced until an administrator applies the pending schema migration.`

4. **Not** widen the translation. Any other error (`P2002`, `P2034`, a plain `Error`, a
   thrown validation object, a future Prisma code) must propagate byte-identically to
   today's behavior. The guard must never wrap `assertActiveSchoolYear`
   (`enrollProSchoolYearMirror`, a core table outside migration 0003) or any other
   unrelated authority, so a genuine core-schema break is never mislabelled
   `EXPORT_PRESENTATION_SCHEMA_UNAVAILABLE`.
5. Keep the read-only fixture behavior intact: when the injected client has no
   `teacherProgramPresentationRevision` delegate at all, `readEffectiveSignatoryProfile`
   still returns `emptySignatoryProfile()` (existing contract used by the fixture-based
   parity suites). Only a thrown `P2021`/`P2022` is translated.
6. Preserve every existing semantic: append-only revision, `PRESENTATION_PROFILE_STALE`
   CAS/conflict mapping (`P2002`/`P2034`), `SCHOOL_YEAR_NOT_ACTIVE`,
   `ACTIVE_YEAR_UNAVAILABLE`/`ACTIVE_YEAR_AMBIGUOUS`, no-change replay zero-write, and
   `Serializable` transaction isolation.
7. Record the original Prisma failure **server-side only** (a bounded `console.error`
   naming the Prisma code is sufficient) so the swallowed upstream failure stays
   diagnosable while the client response stays typed.

### 2.2 Transport boundary

- `atlas-server/src/routes/generation.router.ts`, **teacher-program export route only**
  (`GET /:schoolId/:schoolYearId/runs/:runId/export/teacher-program.docx`): add an
  explicit typed branch returning `503` + `{ code: 'EXPORT_PRESENTATION_SCHEMA_UNAVAILABLE',
  message: <same message> }` and nothing else. Do not rely solely on the generic
  `statusCode`+`code` branch, and do not alter any other route in the file
  (class-program `.xlsx`, room-program `.xlsx`, summary workbook, readiness, runs).
- `atlas-server/src/routes/export-presentation.router.ts` already maps
  `PresentationProfileError` through `sendProfileError`; it must return the same typed
  `503` body with no `details` and no Prisma code. Do not change its authority checks.
- No document bytes may be produced on any failure path: the request must never receive a
  DOCX content type, a `Content-Disposition` attachment header, or a body containing the
  ZIP signature `PK\x03\x04`.

## 3. Owned and forbidden paths

**Owned (may be created/modified — nothing else):**

- `atlas-server/src/services/export-presentation.service.ts`
- `atlas-server/src/routes/generation.router.ts` (teacher-program export route only)
- `atlas-server/src/__tests__/export-presentation-schema-guard-c06b.test.ts` (new)
- `docs/handoffs/export-presentation-schema-guard-c06b-executor.md` (new)

**Forbidden:**

- `prisma/migrations/**` — **do not apply migration 0003 and do not edit migration SQL**
  (the apply is a separately reviewed HIGH action). `prisma/schema.prisma`.
- `atlas-server/src/routes/export-presentation.router.ts` unless a one-line typed-body
  change is genuinely required (report it in the handoff if so).
- Every other exporter/service (`workbook-export`, `room-program-export`,
  `class-program-matrix`, `published-schedule`, `docx-export`), every other router, and
  every existing test file (no assertion removals, no assertion reductions — if you
  believe an existing test must change, stop and report a blocker instead).
- `atlas-client/**`, `ops/**`, `docs/plans/**` (living register + receipts),
  `CHANGELOG.md`, `docs/reference/**`, `.opencode/**`, `.github/**`, `AGENTS.md`.
- `D:/ATLAS-runtime-config/**`, `D:/ATLAS-runtime-*`, PostgreSQL storage,
  `E:/ATLAS-worktrees/tl-operator-workspace-c05` (read-only dependency source),
  and every companion repository (EnrollPro/AIMS/SMART are READ_ONLY).
- No deployment, no runtime restart, no supervisor/task change, no login, no browser
  session, no live/shared-database write, no generation, no publication.

## 4. Environment and harness notes (satisfiability)

- **Isolated install is required in this worktree.** Do **not** reuse another worktree's
  `node_modules`: the nearby `E:/ATLAS-worktrees/tl-operator-workspace-c05` tree was
  verified to hold a **stale generated Prisma client with zero references to
  `TeacherProgramPresentationRevision`**; using it would make the `P2021` control vacuous
  (the delegate would be absent and the service would return an empty profile instead of
  failing). Install here:

  ```
  npm ci
  npm --prefix atlas-server ci
  npx --prefix atlas-server prisma generate --schema=../prisma/schema.prisma
  ```

  (from the worktree root; the canonical schema is the repository-root
  `prisma/schema.prisma`). Verify the generated client exposes the delegate before any
  control — gate S1 below.
- **Disposable PostgreSQL harness:** `provisionDisposableDatabase` /
  `isDisposableHarnessAvailable` / `seedCanonicalFixture` in
  `atlas-server/src/__tests__/helpers/tt-source-freshness-db.js`. It reads the source URL
  from `process.env.DATABASE_URL` → `atlas-server/.env` → the durable runtime env
  `D:/ATLAS-runtime-config/atlas-server.env` (never print it), creates a guarded
  `atlas_restore_drill_*` database, and applies the canonical migrations there only.
  `psql` is at `D:/PostgreSQL/18/bin/psql.exe`. Migrations are applied **only** inside the
  disposable database.
- The sibling suites `export-presentation-postgres.test.ts` and `tt-output-c03r-route.test.ts`
  show the two harness patterns you must combine: real disposable-prisma client, and a real
  express mount (`express` + `jsonwebtoken` + hand-signed JWT) plus the production
  `errorHandler`.
- Time budget: this is a narrow correction — 45 minutes of focused work is the target;
  freeze scope rather than growing the harness.

## 5. Mandatory acceptance matrix (17 rows — report your tally against these ids)

Every row is a **production-path** control on the workspace's real code. A helper-only or
source-text assertion does not satisfy any row.

| Gate | Control | Pass condition |
| --- | --- | --- |
| **S1** | Harness precondition | The freshly generated Prisma client exposes `teacherProgramPresentationRevision.findFirst` and the disposable database is reachable. The suite **fails loudly** (never skips) when either is false. |
| **S2** | No over-broad translation | A non-`P2021`/non-`P2022` failure from the presentation store (e.g. a client throwing `{ code: 'P2002' }`, or a plain `Error`) is **not** converted to `EXPORT_PRESENTATION_SCHEMA_UNAVAILABLE`; it propagates unchanged (the existing `P2002`/`P2034` → `PRESENTATION_PROFILE_STALE` mapping still holds). |
| **S3** | Real `P2021` through the mounted export route | With table `teacher_program_presentation_revisions` absent on the disposable DB, `GET /api/v1/generation/:schoolId/:schoolYearId/runs/:runId/export/teacher-program.docx?facultyId=..&termIndex=1` returns `503` with `code: "EXPORT_PRESENTATION_SCHEMA_UNAVAILABLE"` and the pinned message, `details` absent, and **no** forbidden token (`P2021`, `P2022`, `prisma`, `public.`, `relation`, table/column names, `does not exist`, `at …:` stack frames). |
| **S4** | Zero document bytes on the failure path | Same request: `Content-Type` is JSON, no `Content-Disposition` attachment, the body parses as JSON, contains no `<html`/`<!doctype`, and contains no `PK\x03\x04` ZIP signature anywhere (document length asserted small). |
| **S5** | Real `P2022` through the mounted export route | With the table present but one selected column dropped (`footer_text`), the same route returns the identical typed `503` body and the same zero-byte/no-leak conditions. |
| **S6** | Present table → normal DOCX | With `prisma/migrations/0003_teacher_program_presentation/migration.sql` applied inside the disposable DB, the same route returns `200`, `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`, an attachment filename matching `teacher-program-<facultyId>-SY<yearLabel>-term<termIndex>.docx`, and a body starting with `PK\x03\x04`. |
| **S7** | Presentation settings consumer | Mounted `GET /api/v1/export-presentation/:schoolId/:schoolYearId` with the table absent returns `503` + the same typed code/message, no `details`, no Prisma token. |
| **S8** | Unauthenticated | Export route with no `Authorization` header → `401 { code: 'NO_TOKEN' }`, **zero** Prisma delegate invocation, no document bytes. |
| **S9** | Invalid token | Export route with a malformed/invalid JWT → `401 { code: 'INVALID_TOKEN' }`, zero dispatch, no document bytes. |
| **S10** | Non-privileged role | Valid JWT with role `faculty` → `403 { code: 'FORBIDDEN' }`, zero dispatch. |
| **S11** | Cross-school actor (export) | Valid JWT whose `schoolId` differs from the path `schoolId` → `403 { code: 'CROSS_SCHOOL_DENIED' }`, zero dispatch, no document bytes. |
| **S12** | Cross-school actor (settings) | Same cross-school JWT against `GET /api/v1/export-presentation/:schoolId/:schoolYearId` → `403 { code: 'CROSS_SCHOOL_DENIED' }`, zero dispatch. |
| **S13** | `P2021` mutant — translation is load-bearing | On the same missing-table database, the **unguarded** path (a direct `prisma.teacherProgramPresentationRevision.findFirst`, no translation) throws an error whose `code === 'P2021'` and which is **not** an instance of the typed error; routed through the **real** `errorHandler` it produces `500` with `code: 'P2021'`. That observable response differs from the typed `503`, proving the translation (and not something else) creates the typed response. |
| **S14** | `P2022` mutant — translation is load-bearing | Same as S13 with the dropped column: unguarded `code === 'P2022'` → real `errorHandler` `500` + `code: 'P2022'`, never the typed `503`. |
| **S15** | Migration 0003 stays unapplied on the configured database | Read-only probe against the **configured** (non-disposable) database before and after the suite: `SELECT to_regclass('public.teacher_program_presentation_revisions')::text` returns `NULL`. No migration command may target the configured database. |
| **S16** | Zero residue | Disposable database dropped and `assertDropped()` executed; every seeded fixture row removed; no stray HTTP server, socket, or child process left running; suite exits `0`. |
| **S17** | Preservation and integration hygiene | These suites pass unmodified with no assertion removals or reductions: `export-presentation-route.test.ts`, `export-presentation-postgres.test.ts`, `tt-output-c05r1-teacher-program.test.ts`, `tt-output-c05-beneficiary-parity.test.ts`, `timetable-output-export-c03.test.ts`, `tt-output-c03r-route.test.ts`; plus `npm --prefix atlas-server run build` (tsc) is clean, `git diff --check` is clean, and the committed changed-path set is exactly the four owned paths (report the exact list). |

`MANDATORY_LIVE = 0` and `DEFERRED_EXTERNAL = 0`: no live/runtime/browser row is
predeclared, and none may be added. If you cannot satisfy a row, mark it `FAIL` or
`BLOCKED` with evidence — never silently drop, merge, or renumber it. If you find a
genuinely required additional row, report it separately with its own id; the planner
increases the predeclared plan (increase-only).

Run the suites with `npx tsx src/__tests__/<file>.ts` from `atlas-server`.

## 6. Commit, handoff, and return contract

1. Trace table first: `requirement -> production path -> negative control -> verification
   command`; mark every row `PASS` / `BLOCKED` / `FAIL` before committing.
2. Commit only the assigned source/tests/handoff with a conventional message, e.g.
   `fix(export): fail closed with a typed 503 when the presentation schema is unavailable`.
3. Write one compact handoff at
   `docs/handoffs/export-presentation-schema-guard-c06b-executor.md` containing: base SHA,
   candidate SHA, exact changed paths, the 17-row trace table with evidence, the exact
   commands run and their results, the generated-client precondition evidence, the
   configured-database non-application probe, known risks, and `REVIEW_REQUIRED`.
4. Return `REVIEW_REQUIRED` with: base SHA, candidate SHA, changed-path list, decisive
   evidence, tally (`mandatory / passed / failed / blocked / unperformed`), and any
   blocker. Do **not** merge, rebase, amend a handed-off commit, push, open the living
   register, or self-accept.
5. If the guard cannot be made narrow (S2) without touching a forbidden path, stop and
   return `PLANNER_DECISION_REQUIRED` with the exact seam you need.

## 7. Known residuals explicitly out of scope for this packet

- A **stale generated Prisma client** (delegate absent on the real data context) currently
  renders the export with empty signatories instead of failing closed. Correcting that
  needs a real-versus-injected-client discriminator that would touch existing fixture call
  sites; it is recorded as a ranked successor observation, **not** part of this packet, and
  must not be attempted here.
- The other official exports (`class-program.xlsx`, `room-program.xlsx`, summary workbook)
  do not read the presentation store and must not be modified.
- Applying migration 0003, deploying, and configuring the live runtime are separately
  reviewed HIGH actions and are not authorized here.
