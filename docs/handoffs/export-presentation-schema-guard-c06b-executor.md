# EXPORT-PRESENTATION-SCHEMA-GUARD-C06B — executor handoff

- **Stream:** `EXPORT-PRESENTATION-SCHEMA-GUARD-C06B`
- **Role:** executor, effort `high`
- **Risk tier:** MEDIUM (source + test only; no migration, no deployment, no live action)
- **Worktree:** `E:/ATLAS-worktrees/export-presentation-schema-guard-c06b`
- **Branch:** `work/export-presentation-schema-guard-c06b`
- **Base SHA (accepted, frozen):** `d7743bd8d154395f984a816cd1feb868b166d31f`
- **Candidate SHA:** the single commit that introduces this file on the branch above
  (reported as the candidate SHA in the executor return message)
- **Worktree disposition:** `RETIRE_AFTER_INTEGRATION`
- **Predeclared gates:** `MANDATORY_SOURCE = 17`, `MANDATORY_LIVE = 0`, `DEFERRED_EXTERNAL = 0`
- **Return:** `REVIEW_REQUIRED`

## 1. Objective

When migration `0003_teacher_program_presentation` is not applied, the official
teacher-program DOCX export and the presentation-settings read must fail closed with
`503` + `code: "EXPORT_PRESENTATION_SCHEMA_UNAVAILABLE"` and zero document bytes,
never an HTML/Prisma/stack leak or a partial document. The translation is implemented
only in `export-presentation.service.ts`, only for Prisma `P2021`/`P2022` raised by the
teacher-program presentation revision store calls.

## 2. Exact changed paths (4 owned paths, nothing else)

1. `atlas-server/src/services/export-presentation.service.ts` (modified)
2. `atlas-server/src/routes/generation.router.ts` (modified — teacher-program export route only)
3. `atlas-server/src/__tests__/export-presentation-schema-guard-c06b.test.ts` (new)
4. `docs/handoffs/export-presentation-schema-guard-c06b-executor.md` (new)

`git diff --stat` (source): 2 files changed, 74 insertions(+), 10 deletions(-); the new
test and this handoff are untracked additions. No other path was touched; `atlas-server/dist/`
is gitignored build output.

## 3. Implementation notes

- `withPresentationSchemaGuard(operation)` wraps **only** the five presentation revision
  store call sites: the two read paths (`readEffectiveSignatoryProfile`,
  `readSignatoryProfileAsOfPublication`), the pre-transaction CAS read, the in-transaction
  CAS re-read, and the in-transaction `create`. `assertActiveSchoolYear`
  (`enrollProSchoolYearMirror`, a core table outside migration 0003) is **not** wrapped,
  so a genuine core-schema break is never mislabelled. The existing
  `P2002`/`P2034 -> PRESENTATION_PROFILE_STALE` mapping and the
  "no delegate -> `emptySignatoryProfile()`" fixture contract are unchanged.
- The single client-facing message is exported as
  `EXPORT_PRESENTATION_SCHEMA_UNAVAILABLE_MESSAGE` (with
  `EXPORT_PRESENTATION_SCHEMA_UNAVAILABLE_CODE`) and is the only message used by the
  export route branch and the settings `sendProfileError` transport.
- `generation.router.ts` gains one explicit typed branch in the teacher-program DOCX
  route catch (`503` + `{ code, message }`, nothing else), placed before the generic
  `statusCode`+`code` branch. No other route in the file changed.
- The original Prisma failure is logged server-side only
  (`[export-presentation] ... (Prisma P2021|P2022) ...`).

## 4. Mandatory acceptance matrix (17 rows)

`requirement -> production path -> negative control -> verification command` — all rows
executed on the disposable harness from `atlas-server`:

| Gate | Production path | Negative control | Verification command | Result |
| --- | --- | --- | --- | --- |
| S1 | `prisma.teacherProgramPresentationRevision.findFirst` on the fresh generated client + disposable DB round trip | generated client lacks the delegate / DB unreachable ⇒ loud failure (no skip) | `npx tsx src/__tests__/export-presentation-schema-guard-c06b.test.ts` | PASS |
| S2 | `readEffectiveSignatoryProfile` / `readSignatoryProfileAsOfPublication` / `saveSignatoryProfile` (real functions, injected client seam) | store throws `{code:P2002/P2034/P2025/P9999}` and plain `Error`; conflict mapping asserted | same suite | PASS |
| S3 | mounted `GET /api/v1/generation/:schoolId/:schoolYearId/runs/:runId/export/teacher-program.docx?...&termIndex=1` with the table dropped | raw Prisma `P2021` leak (`500 P2021`) at the same DB state | same suite | PASS |
| S4 | same request as S3 | HTML/Prisma text/`PK\x03\x04`/attachment header on the failure body | same suite | PASS |
| S5 | same route with `footer_text` dropped | raw Prisma `P2022` leak | same suite | PASS |
| S6 | same route with migration 0003 applied in the disposable DB | — (positive control) | same suite | PASS |
| S7 | mounted `GET /api/v1/export-presentation/:schoolId/:schoolYearId` with the table dropped | raw Prisma leak through `sendProfileError` | same suite | PASS |
| S8 | export route, no `Authorization` | any Prisma dispatch / document bytes | same suite | PASS |
| S9 | export route, malformed JWT | any Prisma dispatch / document bytes | same suite | PASS |
| S10 | export route, valid JWT role `faculty` | any service dispatch | same suite | PASS |
| S11 | export route, valid cross-school JWT | any service dispatch / document bytes | same suite | PASS |
| S12 | settings route, valid cross-school JWT | any Prisma dispatch | same suite | PASS |
| S13 | unguarded direct `findFirst` (table dropped) + real `errorHandler` | `code === 'P2021'`, not the typed error, `500` (≠ typed `503`) | same suite | PASS |
| S14 | unguarded direct `findFirst` (`footer_text` dropped) + real `errorHandler` | `code === 'P2022'`, not the typed error, `500` (≠ typed `503`) | same suite | PASS |
| S15 | configured DB read-only `to_regclass(...)` probe before and after the suite | non-empty result ⇒ configured DB was migrated | same suite (`127.0.0.1`, configured DB name resolved, never printed) | PASS |
| S16 | `teardownCanonicalFixture` + `$disconnect` + server close + `drop()` + `assertDropped()` | residual database / stray listener | same suite | PASS |
| S17 | the six preservation suites + `npm --prefix atlas-server run build` + `git diff --check` + exactly four owned paths | assertion removal / new type error / extra path | §5 commands | PASS |

## 5. Commands run and observed results

Environment (isolated in this worktree, per packet §4):

```
npm ci
npm --prefix atlas-server ci
# packet's `npx --prefix atlas-server prisma generate --schema=../prisma/schema.prisma`
# resolves the schema relative to CWD (--prefix does not change CWD), and
# prisma.config.ts requires DATABASE_URL to load. Equivalent invocation used:
#   (from atlas-server, DATABASE_URL from the durable runtime env, never printed)
npx prisma generate --schema=../prisma/schema.prisma
```

- Root `npm ci`: 270 packages. `npm --prefix atlas-server ci`: 252 packages.
- `prisma generate`: `✔ Generated Prisma Client (v6.19.2) to .\node_modules\.prisma\client`.
- **S1 generated-client precondition (static):**
  `atlas-server/node_modules/.prisma/client/index.d.ts` contains
  `get teacherProgramPresentationRevision(): Prisma.TeacherProgramPresentationRevisionDelegate<ExtArgs, ClientOptions>;`
  (and the `Model TeacherProgramPresentationRevision` block). The suite additionally
  asserts `typeof prisma.teacherProgramPresentationRevision.findFirst === 'function'`
  at runtime and fails loudly if absent.

Decisive gates:

```
npx tsx src/__tests__/export-presentation-schema-guard-c06b.test.ts   (cwd: atlas-server)
  -> tests 2, pass 2, fail 0, skipped 0
npm --prefix atlas-server run build                                    -> exit 0 (tsc clean)
git diff --check                                                       -> clean
```

S17 preservation suites (each run with `npx tsx src/__tests__/<file>.ts` from `atlas-server`):

```
export-presentation-route.test.ts          9 tests, 9 pass, 0 fail, 0 skipped
export-presentation-postgres.test.ts       1 test,  1 pass, 0 fail, 0 skipped
tt-output-c05r1-teacher-program.test.ts   11 tests, 11 pass, 0 fail, 0 skipped
tt-output-c05-beneficiary-parity.test.ts  11 tests, 11 pass, 0 fail, 0 skipped
timetable-output-export-c03.test.ts        7 tests,  7 pass, 0 fail, 0 skipped
tt-output-c03r-route.test.ts              15 tests, 15 pass, 0 fail, 0 skipped
```

Failing-first mutant (decisive load-bearing proof):

```
# Temporarily disabled the translation:
#   if (false && (code === 'P2021' || code === 'P2022')) {
npx tsx src/__tests__/export-presentation-schema-guard-c06b.test.ts
  -> tests 2, pass 1, fail 1
  -> AssertionError: S2 contrast: P2021 must translate to the typed 503
# Restored exact bytes; backup SHA-256 == restored SHA-256
#   500D9BC1485CAAD1CD8B5D03B92D3A5D286E5BB42AAF43B8BDA638EAA16CA53E
# Re-ran the suite: tests 2, pass 2, fail 0
```

S15 configured-database non-application probe (inside the suite, both sides):

```
SELECT to_regclass('public.teacher_program_presentation_revisions')::text
  before: '' (NULL)   after: '' (NULL)
```

S16 zero-residue assertion: `teardownCanonicalFixture` ran, the disposable
`atlas_restore_drill_*` database was dropped and `assertDropped()` passed, the HTTP
server was closed (`server.listening === false`), and the suite exited `0`. No migration
command ever targeted the configured database (only `provisionDisposableDatabase`, which
applies migrations exclusively inside the guarded `atlas_restore_drill_*` database).

## 6. Tally

`mandatory / passed / failed / blocked / unperformed = 17 / 17 / 0 / 0 / 0`.

## 7. Known risks / notes

- **Packet command nuance (environment only, no product impact).** `npx --prefix atlas-server
  prisma generate --schema=../prisma/schema.prisma` as written in packet §4 resolves
  `../prisma/schema.prisma` relative to the *worktree root* (`--prefix` does not change
  CWD), and `prisma.config.ts` requires `DATABASE_URL` to load. The equivalent working
  invocation (CWD `atlas-server`, `DATABASE_URL` supplied from the durable runtime env
  without printing) was used. The generated client is the canonical fresh one.
- **NON_BLOCKING residual (packet §7, out of scope).** A stale generated client whose
  real data context lacks the delegate still renders empty signatories instead of failing
  closed; that requires a real-versus-injected-client discriminator and is deliberately
  not attempted here.
- **NON_BLOCKING residual.** `assertActiveSchoolYear` P2021 (a genuine core-schema break)
  still surfaces as the raw Prisma `500`; that is the required narrowness, not a defect.
- No migration, deployment, runtime/task change, login, browser session, live/shared-DB
  write, generation, or publication was performed.

## 8. Worktree state

`candidate range clean; worktree clean` — complete `git status --short` contains only the
two modified owned files and the two new owned files (staged for the candidate commit);
`git diff --check` is clean.

## 9. Return

`REVIEW_REQUIRED` — do not merge, rebase, amend, push, or self-accept.
