# LANE C — Adversarial Parity Review
STAKEHOLDER-EXPORT-PARITY-AUDIT-C05

Repository: D:/ATLAS
Audit SHA: origin/main = 84dd537bb2a2c045b8518c35b3a5372142e0080c
Frozen worktree: E:/ATLAS-worktrees/stakeholder-export-parity-audit-c05 (branch audit/stakeholder-export-parity-c05, HEAD == 84dd537b, status empty)
Directive: AGENTS.md LF-SHA-256 5f9206708a4763376dda1943c1ead28f49427ed1b1f0532ad25661f74ed3ebb5

All artifact SHA-256 values independently re-verified equal to the pinned list. This lane is STATIC_ONLY (no test executed; all evidence is source/artifact inspection). No repository write occurred.

Artifacts extracted independently (python-docx 1.x / openpyxl; extractors under this lane temp dir):
- DNO-CLASS-PROGRAM-TEMPLATE-2026-2027.docx (9FDAC094...EED0)
- Teachers-PROGRAM_SPEC-PROG-AFTERNOON.docx (79AEC643...3BF9)
- root-reference/Teachers-PROGRAM.docx (44DBDD52...D77)
- root-reference/CLASS-PROGRAM-v2.docx (C44ACAC1...260B)
- root-reference/SUMMARY-AND-TEACHERS-SCHEDULE-PER-SUBJECT-2026-2027.xlsx (63DB8E9A...B3B3)
- root-reference/40-minutes.xlsx (C5396FE0...D962)

## A. FINDINGS TABLE

| ID | Severity | Category | Evidence (file:line / artifact) | Consequence for beneficiary output |
|---|---|---|---|---|
| T1 | MATERIAL | test-quality | `timetable-output-export-c03.test.ts:143-146` reads `docx-export.service.ts` as text and regex-asserts `sortTeacherProgramWorkloadRows([...compactedTeaching, ...breakRows])` | A source-text assertion is the only "proof" of the DOCX numeric print order; a real ordered DOCX buffer is never asserted |
| T2 | MATERIAL | test-quality | `generation-stakeholder-shape-genc02r.test.ts:33-35,37-77` compares the hand-authored `getExpectedCanonicalSlots` catalog to itself; never parses the pinned DNO DOCX. Honest blind-spot control at `:397-407` | Canonical-shape "parity" validates the catalog against itself, not the artifact; a wrong catalog edit passes |
| T3 | MATERIAL | test-quality | `tt-output-c03r.test.ts:121-155` `makeFakeWorkbook` is a Map shim, not ExcelJS; real round-trip rows are `skip: exceljsSkip` at `:241,:272,:295,:320` | On an incomplete dependency tree the real XLSX-buffer rows silently skip; only `getCell().value` shim assertions remain |
| T4 | MINOR | test-quality | `tt-output-c03r3.test.ts:367-381` asserts `ctx.entries` arrays only; no xlsx/docx buffer built | Export-context parity is helper-level, not artifact-level |
| T5 | MINOR | test-quality | `timetable-output-export-c03.test.ts:161-164` injects `termIndex` on published entries; the real producer `published-schedule.service.ts:613-666` never emits it | Injection masks the published teacher-program term defect (D1) |
| T6 | OBSERVATION | test-quality | `timetable-term-export-c03r3.test.ts:78-104` only renders the busy prop; single-flight guard `TimetableSimpleHeader.tsx:259` is untested | Concurrency guard is real but has no failing-first control |
| L1 | BLOCKING | layout | DNO template TABLE0 R5/R10 = `Health Break[span5]` / `Lunch Break[span5]` merged bands and R0 includes a dedicated `Teacher` column; `workbook-export.service.ts:583-619` writes per-day cells with no merges and no Teacher column | Beneficiary class program is not template parity: breaks not banded, teacher embedded in subject cell |
| L2 | MATERIAL | layout | DNO paragraphs P5-P9 signature block (Prepared/Principal, Recommending/CID-Chief, Reviewed/PSDS, Approved/ASDS); `CLASS-PROGRAM-v2.docx` TABLE1 | ATLAS class-program.xlsx has no signature/approval area |
| L3 | MATERIAL | layout | DNO TABLE0 R12 / TABLE1 R14 `Total minutes per day`; ATLAS `workbook-export.service.ts:590-621` emits no total row | No formula/total parity |
| L4 | MATERIAL | layout | `workbook-export.service.ts:618` emits `${subject}\n${teacher}` inline; template uses separate columns | Beneficiary layout differs from template |
| L5 | MINOR | layout | Artifact `SUMMARY-AND-TEACHERS-...xlsx` sheets = SUMMARY + per-subject teacher schedules (SCIENCE/MATH/...) with ADVISORY CLASS/ANCILLARY TASK/TOTAL rows; `workbook-export.service.ts:415` adds only 'SUMMARY' | The per-subject teacher-schedule workbook half is absent |
| L6 | MINOR | layout | SUMMARY geometry from run `displaySlots` (`workbook-export.service.ts:387-389`); class program from DB canonical slots (`:543`) | Two time-geometry sources can disagree |
| L7 | MINOR | layout | `Teachers-PROGRAM_SPEC...docx` TABLE0 R0/R13; `docx-export.service.ts:112-137` title has SY only, no school/division, and no `Total minutes per day` row | Teacher DOCX omits school identity and daily-total row |
| H1 | MATERIAL | hardcode | `class-program-slot.service.ts:165` `CANONICAL_TEMPLATE_VERSION='STAKEHOLDER_DNO_2026_2027_45MIN_R2'`; catalog `:189-225`; seeded for every school `:280-317` | Export time geometry is one school's hardcoded template version, not configurable input |
| H2 | MATERIAL | hardcode | `class-program-slot.service.ts:47-56,98-107` `KNOWN_MAPPINGS` comment "Known mapping for this school" | Single-school EnrollPro grade-id mapping baked into shared service |
| H3 | OBSERVATION | hardcode | `docx-export.service.ts:362-368` hardcoded DepEd signatory role labels | Not configurable/school-agnostic |
| H4 | NOTE | hardcode | grep of `atlas-server/src` + `atlas-client/src` for TORNEA/NONATO/BEDAIRE/FELICANO/ENGLIS/NEGROS/HINIGARAN/HNHS/Cottage returns no person/school string (only unrelated `ENGLISH`) | Person/school names live only in untracked artifacts; exports do not emit them |
| D1 | BLOCKING | divergence/term-rotation | `teacher-program-export.service.ts:238-263` maps presentation entries with `termIndex: value.termIndex ?? null`; `published-schedule.service.ts:613-666` never emits `termIndex`; filter `teacher-program-export.service.ts:271-278` | Published-run official teacher program cannot be selected-term: explicit term -> 501 TERM_FILTER_NOT_READY; omitted -> all-term mixed DOCX |
| D2 | BLOCKING | fail-closed | `academic-term.service.ts:147` returns undefined for omitted termIndex; only-if-present filters at `workbook-export.service.ts:208-217`, `class-program-matrix.service.ts:154-160`, `teacher-program-export.service.ts:271`; routes `generation.router.ts:601-615,661-675,735-749,838-852` do not require it | Server serves mixed all-term official documents; only the client (`simpleExportRequests.ts:49`) blocks them |
| D3 | MATERIAL | divergence | `class-program-matrix.service.ts:173-188` filters `gradeLevelName`/`isActiveForScheduling:true`/`isStale:false`; `workbook-export.service.ts:223-227` filters none | Same selected term can list different sections across outputs |
| D4 | MATERIAL | divergence | `class-program-matrix.service.ts:113-121` no-runId -> latest `status:'COMPLETED'`; workbook requires explicit runId; published path binds immutable revision `published-schedule.service.ts:210-242` | Different run/revision resolvers for the same selected term |
| D5 | MATERIAL | divergence/term-rotation | `room-schedule.service.ts:87-92` has no term parameter; grid merges all terms `:251-308`; client CSV `schedule-export.ts:5-51` + `RoomSchedules.tsx:356` all-term | Room representation is not selected-term; rotation not isolated |
| D6 | MINOR | divergence | SUMMARY section sort by raw `gradeLevelId` (`workbook-export.service.ts:399-402`) vs normalized grade (`:144-148,492-497`) | Row/column ordering can differ |
| D7 | OBSERVATION | flag-aral-ap-hg | `teacher-program-export.service.ts:320-336` uses `slot.dayOfWeek` only; workbook-export adds FLAG->MONDAY fallback `:75-80` | A display slot lacking dayOfWeek renders Flag on Tue-Fri in the teacher DOCX |
| F1 | PASS | flag-aral-ap-hg | `workbook-export.service.ts:75-80,604-613`; `room-schedule.service.ts:113,256`; tests `tt-output-c03r.test.ts:209-237,272-291` | Monday-only Flag/HGP overlay correct in workbook/room; Tue-Fri stay teachable |
| F2 | PASS | flag-aral-ap-hg | HG excluded `workbook-export.service.ts:297`, `class-program-matrix.service.ts:281-283`, `teacher-program-export.service.ts:283-286`, `generation-preflight.service.ts:746` | HG never an ordinary cell/demand row |
| F3 | PASS | flag-aral-ap-hg | ARAL excluded `generation-preflight.service.ts:746`, `workbook-export.service.ts:297`, `class-program-matrix.service.ts:283`, `teacher-program-export.service.ts:285`, `teaching-load-automation.service.ts:64,2138` | ARAL creates no cell/credit/export row |
| F4 | PASS | flag-aral-ap-hg | AP has no exclusion in any builder; proven `tt-output-c03r.test.ts:228-237,320-334` | AP remains ordinary |
| F6 | OBSERVATION | flag-aral-ap-hg | Pinned DNO TABLE0 R11 and SUMMARY sheet show ARAL rows; decision 6 excludes them | Documented product override to reconcile, not a source bug |
| FC2 | MATERIAL | fail-closed | `class-program-matrix.service.ts:212-227` returns 200 `warnings:['NO_SOURCE_RUN']` with empty columns; `workbook-export.service.ts:384-478,480-629` has no empty-run guard | Existing-but-empty completed run yields a header-only 200 file |
| FC3 | PASS | fail-closed | Missing term identity when a term is requested -> `TERM_FILTER_NOT_READY` (`workbook-export.service.ts:210-212`; `class-program-matrix.service.ts:156-158`; `teacher-program-export.service.ts:272-276`) | Term-selected reads fail closed on unscoped entries |
| FC4 | PASS | fail-closed | `RUN_NOT_FOUND`/`PUBLISHED_RUN_NOT_FOUND`/409 `TERM_STRUCTURE_UNAVAILABLE` (`published-schedule.service.ts:588-589`; `generation.router.ts:623-634,695-706,766-790`) | Missing run/published source/contract is typed |
| FC5 | PASS | fail-closed | `simpleExportRequests.ts:110-114`; `TimetableSimpleHeader.tsx:270-272`; banner `SimpleBeneficiaryControls.tsx:169-200` | Non-2xx surfaces visibly with retry |
| FC6 | PASS | fail-closed | Single-flight guard `TimetableSimpleHeader.tsx:259` | Duplicate concurrent downloads blocked client-side |
| Z1 | MATERIAL | zero-write | `room-schedule.service.ts:101` -> `scheduling-policy.service.ts:963-999` (`CREATE`/`UPDATE` policy) and `ensureSchedulingPolicyColumns()` DDL `:900-952` | `GET /room-schedules/.../rooms/:id` read route can write; export services themselves are read-only |
| X1 | MATERIAL | false-claim | `docs/reference/timetable-dynamic-workspace-and-warning-contract.md:303-304` "section/teacher/room projections, official exports, and published reads consume the same selected-term entries" | Contradicted by D1, D2, D5 |
| X2 | MINOR | false-claim | `docs/reference/atlas-runtime-source-of-truth-map.md:920` "published-schedule and workbook-export still treat an unverified/unresolved active term as TERM_FILTER_NOT_READY" | True only when a term is requested; omission bypasses to all-term (D2) |
| X3 | MINOR | false-claim | `docs/handoffs/tt-output-c03r-planner-result.md:78-82` records "default downloads are all-term" as accepted NON_BLOCKING | The client was later wired, but the server all-term default was never closed; stale as a closure statement |

## B. PER-OUTPUT CLASSIFICATION

### Section / class program — PARTIAL
Strongest evidence FOR: `tt-output-c03r-route.test.ts:212-231` mounts the real route, receives a real xlsx buffer (`workbook.xlsx.load`), and asserts exact weekday cells; `tt-output-c03r.test.ts:190-237,320-334` assert term isolation, Monday-only flag, HG/ARAL exclusion and AP inclusion through the real layout loop.
Strongest evidence AGAINST: pinned DNO template requires merged `span5` break bands, a separate `Teacher` column, signature area, and total row (L1-L4); server all-term fail-open (D2); section-set/resolver divergence vs the matrix (D3/D4). Cell truth is proven; beneficiary template layout is not.

### Teacher program — PARTIAL (with a BLOCKING published-path defect)
Strongest evidence FOR: `docx-export.service.ts:140-150` column set exactly matches `Teachers-PROGRAM_SPEC...docx` TABLE0 header (Time / No. of min / Subject / Grade and section / Day / Bldg/Room #); `timetable-output-export-c03.test.ts:38-90` exercises the real production builder for Monday-only break, numeric order, HG exclusion.
Strongest evidence AGAINST: `D1` — on a published run, selecting one term always throws `TERM_FILTER_NOT_READY` and omitting the term emits a mixed all-term DOCX; no school/division header or daily-total row (L7). Only draft/unpublished runs can produce a term-correct teacher program.

### Room program — ABSENT
Strongest evidence: there is no server-side official room-program export route; the only room download is the client CSV `schedule-export.ts:5-51` invoked at `RoomSchedules.tsx:356`. Its source view `room-schedule.service.ts:87-92,251-308` has no selected-term scope (D5) and its read path writes via `getOrCreatePolicy` (Z1). No stakeholder room-program artifact exists to define the required format.

### Summary workbook — PARTIAL
Strongest evidence FOR: `workbook-export.service.ts:415-472` builds a real 'SUMMARY' grade-monitoring sheet (section columns, ADVISER row, teacher/subject rows, break labels) and the mounted route returns a non-empty `spreadsheetml` 200 with zero writes (`tt-output-c03r-route.test.ts:201-210`).
Strongest evidence AGAINST: the pinned artifact is "SUMMARY-AND-TEACHERS-SCHEDULE-PER-SUBJECT" and contains SUMMARY plus per-subject teacher-schedule sheets; ATLAS emits only SUMMARY (L5). Geometry source differs from the class program (L6).

## C. CONTRADICTIONS THE PRIMARY PLANNER MUST RECONCILE

- C1. **Server all-term vs product decision 2 / client guard.** Server returns mixed all-term official documents when `termIndex` is omitted (D2); the client blocks it (`simpleExportRequests.ts:49`). Settle with: either the server routes require a validated numeric termIndex (fail closed on omission) for official exports, or the product explicitly authorizes an all-term machine export distinct from the beneficiary program. Evidence needed: mounted-route negative control proving omitted `termIndex` yields non-2xx.
- C2. **Published teacher program term loss (D1).** `getPublishedSchedulePayload` drops `termIndex` from its presentation projection, so the teacher DOCX cannot be term-filtered. Settle with: add `termIndex` to the presentation projection or pass `options.termIndex`/use `resolvePublishedRun` raw entries, plus a mounted published-run test with a real presentation producer (not an injected fixture).
- C3. **Room representation term scope and zero-write (D5/Z1).** The interactive room view merges all terms and can write policy rows. Settle with: a room contract decision plus a read-only policy accessor (the file already has a "Passive policy read" section at `scheduling-policy.service.ts:1001`).
- C4. **Section-set divergence (D3).** Matrix filters `isActiveForScheduling`/`isStale`; workbook does not. Settle with: one shared section-scope contract for all outputs.
- C5. **Geometry sources (L6).** SUMMARY uses run `displaySlots`; class program uses DB canonical slots. Settle with: declare which is authoritative for each artifact and assert cross-artifact row parity on the same run.
- C6. **Empty-but-200 (FC2).** Decide whether a completed run with zero entries must hard-fail.

## D. WHAT IS ALREADY CORRECT (do not rewrite)

- Per-term derived demand: a five-session weekly subject contributes five sessions in every applicable term, and rotation resolves its own member/teacher/room per term (`tt-output-c03r3.test.ts:193-240`; `derived-demand.service.ts` term-indexed lines; `resolvePerTermScheduleEntries`).
- Term identity is never coerced to Term 1 (`assertNoImplicitTermDefault`; test `tt-output-c03r3.test.ts:255-262`).
- Missing term identity fails closed when a term IS requested (`TERM_FILTER_NOT_READY`) in all three builders.
- HG excluded everywhere; ARAL excluded from demand/cells/credit/export; AP remains ordinary; Flag/HGP is a Monday-only overlay with Tue-Fri teachable (F1-F4).
- Cross-school actor scope on all four output routes (`generation.router.ts:599,659,733,814`), proven with zero downstream dispatch (`tt-output-c03r-route.test.ts:184-199`).
- Client term-bound request building, all-term disable, visible retryable error, and single-flight guard (`simpleExportRequests.ts`, `SimpleBeneficiaryControls.tsx`, `TimetableSimpleHeader.tsx:233-276`).
- Export services are read-only; no run creation, audit row, or cache write in `workbook-export`/`teacher-program-export`/`docx-export`/`class-program-matrix`.

## E. OPERATOR-DECISION CANDIDATES

1. **Room program format/scope (no artifact exists).** Exact question: what artifact must the room program reproduce (per-room weekly grid, per-room teacher list, columns, term scope), and is a selected-term official room export required, or is the current all-term client CSV acceptable?
2. **Template-layout fidelity.** Exact question: must class-program.xlsx reproduce the merged break bands, separate Teacher column, signature/approval block, and daily-total row of the pinned DNO template, or does "separately but visually aligned" permit a different compatible layout?
3. **ARAL presentation.** Exact question: the pinned artifacts display ARAL rows (DNO TABLE0 R11; SUMMARY sheet), while decision 6 excludes ARAL from ATLAS outputs. Must the official class program show an ARAL overlay row supplied separately, or omit ARAL entirely?
4. **Empty official file.** Exact question: for a COMPLETED run with zero entries, must the official export fail (404/422) rather than emit a header-only 200 file?

## F. EXACT COMMANDS RUN + EVIDENCE PATHS + LIMITATIONS

Read-only Git/identity:
- `git rev-parse HEAD`; `git -C E:/ATLAS-worktrees/stakeholder-export-parity-audit-c05 rev-parse HEAD`; `... status --porcelain=v2`; `... rev-parse --abbrev-ref HEAD`
- `git log --oneline -3`; `git rev-parse origin/main`
Artifact hash re-verification:
- `Get-FileHash ... -Algorithm SHA256` for all seven pinned artifacts (all matched)
Independent extraction:
- `python <lane-c>/extract_docx.py <artifact>`; `python <lane-c>/extract_xlsx.py <artifact>` (extractors and raw stdout under this lane temp dir)
Source inspection: `read`/`grep` over `atlas-server/src/routes/generation.router.ts`, `atlas-server/src/services/{workbook-export,class-program-matrix,class-program-slot,teacher-program-export,docx-export,published-schedule,academic-term,room-schedule,scheduling-policy,generation-preflight}.service.ts`, `atlas-client/src/components/timetable/simple/simpleExportRequests.ts`, `SimpleBeneficiaryControls.tsx`, `TimetableSimpleHeader.tsx`, `atlas-client/src/components/room-schedules/schedule-export.ts`, and the export test files named above.

Evidence outputs (this lane):
- `%TEMP%/opencode/stakeholder-export-parity-c05/lane-c/report.md`
- `%TEMP%/opencode/stakeholder-export-parity-c05/lane-c/extract_docx.py`
- `%TEMP%/opencode/stakeholder-export-parity-c05/lane-c/extract_xlsx.py`

Limitations:
- STATIC_ONLY. No test was executed; no browser, login, database, or runtime probe.
- `grep`/ripgrep returned "JSON record exceeded 65536 bytes" on broad patterns; searches were narrowed by include/path. The strong hardcode sweep was performed per directory.
- The published teacher-program defect (D1) is established by exact source reading (presentation projection omits `termIndex`; the consumer maps `?? null` then rejects any null when a term is requested). It was not re-executed as a live test, so it is asserted as source-proven, not runtime-observed.
- Artifact layout findings are based on the pinned untracked copies; this lane did not render DOCX->PDF/PNG.
