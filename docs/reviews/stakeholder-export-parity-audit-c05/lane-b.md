# LANE B — ATLAS Production-Path Export Audit (STAKEHOLDER-EXPORT-PARITY-AUDIT-C05)

- Repo: D:/ATLAS  | audit SHA (origin/main): 84dd537bb2a2c045b8518c35b3a5372142e0080c
- Frozen worktree: E:/ATLAS-worktrees/stakeholder-export-parity-audit-c05 (branch audit/stakeholder-export-parity-c05, HEAD == 84dd537b, worktree clean)
- Directive pin: origin/main:AGENTS.md LF-SHA-256 5f9206708a4763376dda1943c1ead28f49427ed1b1f0532ad25661f74ed3ebb5
- Mode: read-only static audit. No writes to any repo/worktree. No browser/login/db/runtime/network probe. No tests executed.
- All paths relative to the frozen worktree root unless prefixed.

## A. CURRENT ATLAS ROUTE / CONTROL MATRIX (official outputs)

### A1. Summary workbook (CLASS-MONITORING SUMMARY)
- Client control: `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx:237-242` (`resolveSimpleExportRequest('summary-teacher-schedule', …)`) rendered by `SimpleExportMenu` item `SimpleBeneficiaryControls.tsx:115-123`; dispatch `TimetableSimpleHeader.tsx:257-276`.
- URL: `/api/v1/generation/{schoolId}/{schoolYearId}/runs/{runId}/export/summary-teacher-schedule.xlsx?termIndex={n}` (`simpleExportRequests.ts:56-65`).
- Route mount: `generation.router.ts:582-638`; mounted `app.ts:112` (`app.use('/api/v1/generation', generationRouter)`).
- Auth: `authenticate` (JWT only) `generation.router.ts:584` -> `middleware/authenticate.ts:176-191`; role gate `PRIVILEGED_ROLES` `generation.router.ts:18,588`; actor-school gate `assertActorSchoolScope` `generation.router.ts:38-49,599`.
- Service entry: `exportSummaryWorkbook` `workbook-export.service.ts:384-478` -> `loadExportContext` `:159-281`.
- Data source: `db.generationRun.findFirst` `:166-169`; status gate `:180-183`; if `summary.isPublished` -> `resolvePublishedRun` (revision-effective) `:192-202` (import `:4`); else `run.draftEntries` `:186`; term filter `:208-217`.
- Builder: `buildEntryGrid` `:283-310` (day+interval key `:293`, HG/ARAL dropped `:297`), sheet assembly `:404-476`.
- Response: `Content-Type application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` `:618`; filename `summary-teacher-schedule-term{N}.xlsx` or `summary-teacher-schedule.xlsx` `:619-620`; workbook header row carries School/Year/Run (`addReportHeader` `:364-382`).
- Error path: 400 INVALID_PARAM/INVALID_TERM_INDEX `:594-612`, 403 `:589/599`, 404 RUN_NOT_FOUND `:623-625`, 422 RUN_NOT_COMPLETED `:627-629`, 501 TERM_FILTER_NOT_READY `:631-633`; other typed errors (PUBLISHED_* via `resolvePublishedRun`) fall to `next(e)` -> `middleware/errorHandler.ts:38-60` (maps `err.statusCode`/`err.code`).
- Verdict: **PARTIAL** — output exists and is revision-effective when published, but the route/term contract permits an all-term (`termIndex` absent) mixed workbook (see D1) and the filename omits school year/entity.

### A2. Class program workbook
- Client control: `TimetableSimpleHeader.tsx:243-248`; menu item `SimpleBeneficiaryControls.tsx:124-132`.
- URL: `/…/export/class-program.xlsx?termIndex={n}` (`simpleExportRequests.ts:68-75`).
- Route: `generation.router.ts:642-710` (mount `app.ts:112`); auth/role/scope `:644-659`; `specializationVisibility` `:677-687`.
- Service: `exportClassProgramWorkbook` `workbook-export.service.ts:480-628` -> `loadExportContext` (same resolver as A1).
- Data source: identical to A1 (`:481` -> `:159-281`): published -> `resolvePublishedRun`; else `draftEntries`; term filter `:208-217`.
- Builder: `buildEntryGrid` `:499`; per-grade `resolveCanonicalSlotsForPrograms` `:543`; per-section weekday block `:575-624`.
- Response: xlsx `:690`; filename `class-program-term{N}.xlsx` `:691-692`.
- Error path: same mapping `:694-708`.
- Verdict: **PARTIAL** — exists and term/revision-consistent with A1, but same all-term/absent-termIndex server gap and same filename gap.

### A3. Class-program matrix (JSON, grade-level)
- Client consumer: `ClassProgramMatrixView.tsx` (view, not a file download); route accepts optional `runId`/`termIndex`.
- URL: `/api/v1/generation/{schoolId}/{schoolYearId}/class-program-matrix?gradeLevel={7..10}[&runId][&termIndex]` (`generation.router.ts:798-880`).
- Mount: `app.ts:112`. Auth/role/scope `:800-814`; grade validation `:816-821`; visibility `:823-827`; optional runId `:832-837`; term parse `:838-852`.
- Service: `generateClassProgramMatrix` `class-program-matrix.service.ts:164-324` -> `resolveSourceRun` `:98-152` -> `applyTermFilter` `:154-160`.
- Data source: explicit runId or latest `status:'COMPLETED'` by `createdAt desc` `:115-119`; published -> `resolvePublishedRun` `:135-148`; else `draftEntries` `:151`.
- Response: `res.json({ data: matrix })` `:863`; no file/filename.
- Error path: 404/422/501 mapping `:864-877`.
- Verdict: **PARTIAL** — exists; JSON not a file; absent termIndex yields a mixed all-term JSON `termIndex:null`; latest-run selection differs from the published resolver tie-break (see D3).

### A4. Teacher program DOCX
- Client control: `TimetableSimpleHeader.tsx:249-255`; menu item `SimpleBeneficiaryControls.tsx:133-143` (only when `viewMode==='faculty'` with an entity, `:449`).
- URL: `/…/export/teacher-program.docx?facultyId={id}&termIndex={n}` (`simpleExportRequests.ts:77-84`).
- Route: `generation.router.ts:714-794` (mount `app.ts:112`); auth/role `:716-723`; facultyId parse `:731-732`; scope `:733`; term `:735-749`.
- Service: `buildTeacherProgramExportShape` `teacher-program-export.service.ts:128-464` then `generateTeacherProgramDocx` `docx-export.service.ts:106-443`.
- Data source: faculty `:144-147`; run `:152-159`; **if published it calls `getPublishedFacultySchedule`** (`:227-232`, imported lazily `:229-230`) => `published-schedule.service.ts:698-700` -> `getPublishedSchedulePayload` `:513-692` -> `resolvePublishedRun` `:173-340`; else `draftEntries.filter(facultyId)` `:265-266`; term filter `:271-278`; HG/ARAL drop `:283-286`.
- Builder rows TEACHING `:340-362`, BREAK `:318-337`, ANCILLARY `:364-400`, ADVISORY `:402-416`, ARAL hard-coded `NOT_CONFIGURED`/0 `:418-420`.
- Response: docx `generation.router.ts:762`; filename `Teacher_Program_{safeName}.docx` `:763` — **no term and no school year in the filename**.
- Error path: 404 FACULTY_NOT_FOUND/RUN_NOT_FOUND/PUBLISHED_RUN_NOT_FOUND `:766-789`, 422 `:774-777`, 501 `:778-781`, generic typed 404 passthrough `:787-790`.
- Verdict: **PARTIAL** — exists; uses a *different published resolver* than A1/A2 (see D2) and the filename omits term/year/entity-scope beyond the teacher name.

### A5. Room program (official)
- Client control: NONE. Server route: NONE.
- Only room-related outputs: `GET /api/v1/room-schedules/{schoolId}/{schoolYearId}/rooms/{roomId}` JSON (`room-schedule.router.ts:20-59`) and the client-side CSV helper `schedule-export.ts` used by `RoomSchedules.tsx:28,354-357,504-513`.
- Verdict: **ABSENT** — no official room-program export exists anywhere on the audit SHA (grep `room-program|roomProgram|room_program|RoomProgram` returns only unrelated `HomeRoomProgramType` type aliases in `section.service.ts:162,170,470`).

### A6. Other file/print producers (beyond the named list)
- `SimplePublishReadinessSheet.tsx:184-201` — client-side `publish-blockers-run-{runId}.csv` from in-memory readiness; button label `Download CSV` `:296`. No server call, no term, no error path, no in-flight guard.
- `RoomSchedules.tsx` + `schedule-export.ts:5-51` — client-side CSV of on-screen view; filename `schedule-{viewMode}-{safeName}.csv` `:48`. No server round-trip; no filename year/term/run; no error path; no in-flight guard.
- `window.print()` paths (browser print, not file export): `RoomSchedules.tsx:643` (OccupancyTemplatePreview), `MySchedule.tsx:380`, `PublicPublishedSchedule.tsx:516`.
- No other server `Content-Disposition`/`attachment` producer exists: grep over `atlas-server/src` returns exactly the 3 routes in `generation.router.ts:620,692,763`.

## B. ANSWERS 1–14

1. **Do the outputs genuinely exist?** YES for summary workbook (`workbook-export.service.ts:384`), class program workbook (`:480`), class-program matrix JSON (`class-program-matrix.service.ts:164`), teacher program DOCX (`docx-export.service.ts:106`). ROOM PROGRAM: NO (see 12).
2. **Generated / revision-effective / published truth?** Non-published runs export `run.draftEntries`. Published runs (`summary.isPublished === true`) export revision-effective truth: workbook/matrix via `resolvePublishedRun` (`workbook-export.service.ts:192-202`, `class-program-matrix.service.ts:135-148`; `published-schedule.service.ts:173-340` applies `publishedScheduleRevision` change sets — `applyPublishedRevisions :139-155`, validation `:210-242`), teacher program via `getPublishedFacultySchedule` -> same `resolvePublishedRun`. Non-published exports are review-workspace truth, not publication truth (expected).
3. **Do section/teacher/room outputs share the selected-term entries?** Section (class-program workbook + matrix) and teacher program both filter to one `termIndex` and both drop HG/ARAL, but they use **different published resolvers** and different entry normalization (workbook raw entries vs teacher nested presentation entries). There is no room output to compare. See D2.
4. **Any route exporting stale base-run data?** Published paths do NOT use pre-revision draft JSON (`workbook-export.service.ts:188-202`; `class-program-matrix.service.ts:136-148`; `teacher-program-export.service.ts:224-263`). Non-published paths intentionally read `draftEntries`. `resolvePublishedRun` additionally rejects a run whose id != publication binding (`workbook-export.service.ts:195-199`, `class-program-matrix.service.ts:140-143`). No stale-publication defect found.
5. **Actor-school scope?** YES. Export routes require `authenticate` (JWT) + `PRIVILEGED_ROLES` + `assertActorSchoolScope(req,res,schoolId)` against `req.user.schoolId` (`generation.router.ts:584-599,644-659,716-733,800-814`; `actorSchoolId :26-29`; `assertActorSchoolScope :38-49`). SYSTEM_ADMIN is explicitly not an implicit cross-school bypass (`:31-37`). A raw system token is NOT accepted: `authenticate` only verifies JWT (`authenticate.ts:176-191`); the system-token path `authenticateWithSystemToken :126-174` is not mounted on these routes, so a raw token -> 401. A JWT with `role:'SYSTEM_ADMIN'` but no `schoolId` -> 403 `SCHOOL_SCOPE_REQUIRED`. Fail-closed.
6. **All-term fails closed?** CLIENT: YES — `resolveSimpleExportRequest` returns `null` unless a numeric term 1..`MAX_ACADEMIC_TERM_INDEX` is present (`simpleExportRequests.ts:33-53`), `dispatchSimpleExport` no-ops on `null` (`:104`), menu disabled + "Choose a term to export" (`SimpleBeneficiaryControls.tsx:107-114,146-153`). SERVER: **NO** — an absent `termIndex` is accepted as all-terms (`resolveRequestedTermIndex :147` returns `undefined`; `loadExportContext :208-217` skips filtering; `applyTermFilter :155` skips). This contradicts governing decision 2 and permits a direct-API mixed all-term workbook/DOCX/JSON. Bypass of the constraint at the API boundary.
7. **Non-2xx failures visible/retryable?** YES for the 3 official client exports: `dispatchSimpleExport` throws the server message (`simpleExportRequests.ts:110-114`); `handleSimpleExport` catches per-kind (`TimetableSimpleHeader.tsx:268-275`); `SimpleExportErrorBanner` renders kind + message + Retry (`SimpleBeneficiaryControls.tsx:169-199`, wired `:489-493`). NOT present for the client-side CSVs (`schedule-export.ts`, `SimplePublishReadinessSheet.tsx`).
8. **Duplicate concurrent downloads prevented?** YES for official exports: `if (exportingKind !== null) return;` (`TimetableSimpleHeader.tsx:259`) + `disabled={!x || exporting}` on every item (`SimpleBeneficiaryControls.tsx:117,126,136`). Server has no per-request/idempotency guard, but dispatch is client-serialized. NOT present for the client-side CSVs.
9. **Filename identity (year, term, output type, entity)?**
   - Official client download names: `summary-teacher-schedule-run-{runId}-term{n}.xlsx`, `class-program-run-{runId}-term{n}.xlsx`, `teacher-program-{facultyId}-term{n}.docx` (`simpleExportRequests.ts:63,72,82`): output type + term + (run for 2 of 3 / entity for teacher). **School year is absent in all; class-program/summary entity (section/grade) is absent.**
   - Server `Content-Disposition`: `summary-teacher-schedule-term{n}.xlsx` / `class-program-term{n}.xlsx` / `Teacher_Program_{name}.docx` (`generation.router.ts:620,692,763`): no runId, no year; teacher DOCX has **no term at all**.
   - Workbook content header carries School/Year/Run (`workbook-export.service.ts:364-382`); DOCX title carries SY label (`docx-export.service.ts:125-137`).
   - Verdict: filenames do NOT satisfy the full identify-year+term+type+entity contract.
10. **Empty/unresolved outputs fail honestly (typed error, no empty file)?** Mostly YES. Typed failures: 404 `RUN_NOT_FOUND`, 422 `RUN_NOT_COMPLETED`, 501 `TERM_FILTER_NOT_READY`, 409 `TERM_STRUCTURE_UNAVAILABLE`, 400 `TERM_INDEX_OUTSIDE_CONTRACT`/`INVALID_TERM_INDEX`, 404 `FACULTY_NOT_FOUND`, 404 `PUBLISHED_RUN_NOT_FOUND`, 409 `PUBLISHED_REVISION_INVALID`/`PUBLISHED_RUN_AMBIGUOUS` (`generation.router.ts:622-636,694-708,765-792,864-877`; `errorHandler.ts:38-60` maps `statusCode`+`code` for pass-through errors). No empty file is sent on those. EXCEPTION: `class-program-matrix` with no resolvable source run returns HTTP 200 with `sourceRunId:null, columns:[], warnings:['NO_SOURCE_RUN']` (`class-program-matrix.service.ts:212-227`) — an honest empty JSON, not a file.
11. **Zero-write?** YES. Export services perform read-only Prisma calls only (`loadExportContext :165-248`; `buildTeacherProgramExportShape :144-205`; `resolveSourceRun :104-125`); workbook/class-program matrix add no writes; DOCX generation is pure (`docx-export.service.ts:106-443`); term resolution is read-only (`academic-term.service.ts:92-115`). `PUBLISHED_SCHEDULE_REVISION` reads only. The mounted-route test asserts zero writes for summary + class-program + matrix (`tt-output-c03r-route.test.ts:166,209,231`) and cross-school rejections dispatch zero calls (`:198`).
12. **Room-program official export — exists or assumed?** **ABSENT.** Server has no room export route (only the read-only `room-schedule.router.ts:20-59`). The `RoomSchedules` page's "Export CSV" is a **client-side utility** that serializes the currently displayed view (`RoomSchedules.tsx:354-357,504-513` -> `schedule-export.ts:5-51`); it is not scoped to a term, not server-validated, not revision-aware, has no error surface, and its filename is `schedule-{viewMode}-{name}.csv`. Any statement that an official room program exists is unsupported.
13. **Test classification** — see Section C.
14. **Other producers/consumers** — see A6. Search terms executed: `export|download|xlsx|docx|workbook|print|csv` over `atlas-server/src/routes`, `atlas-server/src/services`, `atlas-client/src`. Server file producers: exactly 3 (A1–A4 minus matrix). Client blob producers: exactly 3 (A6). Print producers: 3.

## C. TEST ADEQUACY TABLE

| Test file | What it actually exercises | Asserts rendered/structured output values? | Decisive lines |
|---|---|---|---|
| `atlas-server/src/__tests__/tt-output-c03r-route.test.ts` | **Real mounted express router** (`generation.router.ts`) over HTTP (`createServer`+`fetch`) with fake read-only Prisma delegates injected onto the singleton. Real auth middleware + JWT. Real `class-program-matrix` JSON and real class-program xlsx when exceljs present. | YES — weekday cell days, subject/teacher cells, xlsx header row + cell text, HTTP status/content-type, zero-write instrumentation. | 108-118 harness; 136-151 server; 153-167 matrix; 169-182 404/400; 184-199 cross-school 403 + zero dispatch; 201-210 summary 200 + non-empty + zero writes; 212-231 real xlsx cells |
| `atlas-server/src/__tests__/tt-output-c03r.test.ts` | **Service builders** with injected fake client (`withDataContext`): `buildEntryGrid`, `exportClassProgramWorkbook`, `generateClassProgramMatrix`, `constructBaseline`. Workbook layout uses a **fake workbook** via `workbookFactory` (real layout loop, fake xlsx). | YES — grid keys, sheet rows/columns, term selection, HG/ARAL/AP, matrix cells, run binding. | 121-155 fake workbook; 159-177 grid; 190-241 layout; 295-316 term select + TERM_FILTER_NOT_READY; 320-334 HG/ARAL vs AP; 386-409 matrix |
| `atlas-server/src/__tests__/timetable-output-export-c03.test.ts` | **Helper/service level**: `buildTeacherProgramExportShape`, `loadExportContext`, `sortTeacherProgramWorkloadRows`, `buildPeriodSlots`/`buildSpecialEventSlots`. One **source-text** assertion. | YES for shape rows (HG excluded, Monday-only break, numeric order) and export-context revision/term behavior. Source-text assertion is structural only. | 38-90 teacher shape; 100-141 published normalize + HG; 143-146 source-text; 148-176 export context published + fail-closed |
| `atlas-server/src/__tests__/tt-output-c03r3.test.ts` | **Real derived-demand + per-term resolution pipeline**, then `loadExportContext` with injected read-only client; parity/mutant controls. | YES — per-term totals, rotation membership, no leak, 3 mutants. | 193-327 pipeline; 367-381 export context; 385-429 mutants |
| `atlas-server/src/__tests__/tt-output-c03r3-placement-term.test.ts` | Placement/quick-place **term identity** (`solveQuickPlace`, `buildQuickPlaceCommitProposals`, `previewManualEdit`). Not an export test. | YES — term preserved/rejected, cross-term vs same-term overlap. | 113-135, 169-215, 241 |
| `atlas-server/src/__tests__/generation-stakeholder-shape-genc02r.test.ts` | **Generation readiness/preflight/scheduler shape**, canonical slots, HG reference-only. Not an export route test. | YES — canonical CLASS rows, shift frames, HG exclusion, display/export slot resolver equality. | 37-107, 254-314, 337-397 |
| `atlas-client/src/lib/__tests__/timetable-simple-term-export-c03r2.test.ts` | **Real component SSR render** (`renderToStaticMarkup(TimetableSimpleHeader)`) with injected workspace context (MemoryRouter). | YES — request URL/filename attributes, term option list, all-term disabled copy. No click dispatch. | 132-146 render; 159-167 term options; 169-189 URLs/filenames; 191-198 all-term |
| `atlas-client/src/lib/__tests__/timetable-term-export-c03r2.test.ts` | **Helper-level** `resolveSimpleExportRequest`/`dispatchSimpleExport` + `matchesTermScope` + **source-text** assertions on the hook/header. | YES for URL/term/filename and `null` on 'all'; source-text only for wiring. | 64-102; 125-151; 153-165 source-text |
| `atlas-client/src/lib/__tests__/timetable-term-export-c03r3.test.ts` | **Real component SSR render** (`SimpleExportMenu`, `SimpleExportErrorBanner`) + real `dispatchSimpleExport` helper. | YES — banner kind/message/Retry, busy attr, non-2xx rejection + no download, all-term zero request, exact filename. | 56-76; 78-104; 106-117; 119-131; 133-144 |
| `atlas-client/src/lib/__tests__/timetable-output-c03.test.ts` | **Helper-level** `pivotDraftToView` section/teacher/room projection. | YES — entry identity per projection, special-event scope. | 25-42 |
| `atlas-client/src/lib/__tests__/timetable-ordered-term-conflict-c03r3.test.ts` | **Helper-level** term-aware conflict inspector + placement fast path. Not an export test. | YES — cross-term clean, same-term blocked, unscoped fail-safe. | 59-116 |

Gap in test coverage (not a defect by itself, but relevant to acceptance): no mounted-route test for the **teacher-program.docx** route, no mounted test for **missing/invalid JWT**, raw **system-token**, or **non-privileged role** on export routes (the route test covers only cross-school 403 and same-school admin 200); no test asserts server **rejects absent termIndex** (because it does not); no test asserts the server `Content-Disposition` filename.

## D. CROSS-OUTPUT DIVERGENCE FINDINGS

- **D1 (material).** All-term server gap: the three official routes accept an absent `termIndex` and export a mixed-term document (`resolveRequestedTermIndex` returns `undefined` at `academic-term.service.ts:147`; workbook `loadExportContext:208-217`; teacher `:271-278`; matrix `applyTermFilter:155`). For the workbook the mixed data then **collides** on the term-less grid key `sectionId-day-start-end` with first-wins (`workbook-export.service.ts:293-294`), so a later term's cell is silently dropped rather than surfaced. Client null/no-op protects only browser callers. Contradicts governing decision 2.
- **D2 (material).** Different published resolvers per output: summary/class-program/matrix use `resolvePublishedRun` (`published-schedule.service.ts:173`); teacher program uses `getPublishedFacultySchedule` -> `getPublishedSchedulePayload` (`:698-700`, `:513-692`) and then re-normalizes the nested presentation shape inline (`teacher-program-export.service.ts:238-263`). Both call the same underlying resolver for entries, so revision handling agrees today, but the teacher path depends on a second mapping layer that can drift (e.g. `section.externalId ?? id` fallback `:256`) independently of the workbook path.
- **D3 (minor).** Latest-run selection differs: matrix picks `status:'COMPLETED'` ordered by `createdAt desc` only (`class-program-matrix.service.ts:115-119`); `resolvePublishedRun` orders `createdAt desc, id desc` and requires `runType:'FULL'` (`published-schedule.service.ts:182-202`). Two runs sharing a createdAt can resolve differently, and matrix ignores `runType`.
- **D4 (minor/behavioral).** Published-run mismatch handling differs: workbook throws `RUN_NOT_FOUND` (`workbook-export.service.ts:195-199`); matrix returns a 200 `NO_SOURCE_RUN` empty JSON (`class-program-matrix.service.ts:140-143,212-227`). Same input, different truth surface.
- **D5 (cosmetic).** Filename identity differs by output (server vs client, term present vs absent, run/entity inconsistent) — see B9.
- **D6 (consistency, not conflict).** Section/teacher/room projections elsewhere: `room-schedule.service.ts:277-278` projects per-entry `termIndex` but has **no term filter**; the RoomSchedules client CSV therefore cannot be term-scoped (`schedule-export.ts`). The section/teacher *views* are term-scoped by the client (`useTimetableData.ts:1062` `matchesTermScope`), but there is no official room file export to reconcile.

## E. ZERO-WRITE ASSESSMENT

- No export path performs writes. Verified call targets: `generationRun.findFirst/findUnique/findMany`, `school.findUnique`, `enrollProSchoolYearMirror.findFirst/findUnique`, `sectionMirror.findMany`, `facultyMirror.findMany/findFirst`, `subject.findMany`, `room.findMany`, `building.findMany`, `schedulingPolicy.findFirst/findUnique`, `policySpecialEvent.findMany`, `publishedScheduleRevision.findMany`, and one `$queryRawUnsafe` SELECT (`published-schedule.service.ts:273-281`). `workbook-export.service.ts:165-248,393-397,487-490`; `teacher-program-export.service.ts:144-205`; `class-program-matrix.service.ts:104-125,173-188,238-255`; `published-schedule.service.ts:182-289,531-538`.
- No audit-log/write-table/cache-write call exists in any export path (no `create/update/upsert/delete/executeRaw`). The published/term resolvers are read-only (`academic-term.service.ts:92-115`; `published-schedule.service.ts` has no write delegate).
- Test evidence: `tt-output-c03r-route.test.ts:47,55-57` instruments every Prisma method and throws on writes; `:166,198,209,231` assert zero writes / zero dispatch.
- Client export dispatch performs only a `fetch` GET plus a local Blob/anchor download (`simpleExportRequests.ts:107-125`).

## F. COMMANDS RUN AND EVIDENCE PATHS

- Identity: `git -C E:/ATLAS-worktrees/stakeholder-export-parity-audit-c05 rev-parse HEAD` -> 84dd537bb2a2c045b8518c35b3a5372142e0080c; `branch --show-current` -> audit/stakeholder-export-parity-c05; `status --porcelain=v2` empty.
- `git -C D:/ATLAS rev-parse HEAD` and `rev-parse origin/main` -> 84dd537bb2a2c045b8518c35b3a5372142e0080c; `git -C D:/ATLAS status --porcelain=v2` empty before and after (no test execution, no writes).
- Static inspection via Read/Grep/Select-String over the frozen worktree (all file:line citations above).
- No test was executed (static analysis only; NOT_RUN for every suite). Rationale: every named suite is safe to read statically and the lane authorizes NOT_RUN when execution is not safely possible; executing from D:/ATLAS would add nothing to the static call-path findings and the necessary fixtures/mounts are already evidenced in source.
- Evidence artifact: %TEMP%\opencode\stakeholder-export-parity-c05\lane-b\report.md

## G. LIMITATIONS / BLOCKERS

1. No live/runtime/browser/database verification (prohibited by the lane). All conclusions are static source truth at 84dd537b.
2. Tests were not executed; the "what it proves" classification is from static reading of each file, not from observed pass/fail output.
3. The `exceljs` skip-guards in server tests (`tt-output-c03r-route.test.ts:121-130,212-213`, `tt-output-c03r.test.ts` `exceljsSkip`) mean the real-xlsx assertions may self-skip in the frozen worktree; the fake-workbook layout tests still exercise the layout loop. Not verified here.
4. `atlas-server/src/services/class-program-slot.service.ts:165,189-237` hard-codes the `STAKEHOLDER_DNO_2026_2027_45MIN_R2` catalog with `DNO` source notes and fixed grade-band time rows. It is not rendered school/division identity (metadata only; `subjectLabel`/time only are output) and the catalog is seeded per school/year (`seedClassProgramSlots`), but it is a school-specific template hardcode worth a planner school-agnosticism decision under decision 10.
5. No official room-program export exists to trace; rows A5/12 are ABSENT by exhaustive search, not by assumption.
