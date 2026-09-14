# Stakeholder Export Parity Audit — 2026-09-14

**Cycle:** STAKEHOLDER-EXPORT-PARITY-AUDIT-C05 (planner-led, read-only artifact
and source audit)
**Role:** PRIMARY_PLANNER (activated by operator `CYCLE ON`)
**Audit base:** `origin/main` = `84dd537bb2a2c045b8518c35b3a5372142e0080c`
(refreshed 2026-09-14; `D:/ATLAS` clean; minimum ancestor satisfied)
**Directive:** `origin/main:AGENTS.md` LF-normalized SHA-256
`5f9206708a4763376dda1943c1ead28f49427ed1b1f0532ad25661f74ed3ebb5`
(168,022 bytes; read directly from the frozen ref)
**Audit worktree:** `E:/ATLAS-worktrees/stakeholder-export-parity-audit-c05`
(branch `audit/stakeholder-export-parity-c05`; HEAD == `84dd537b`)
**Lane task IDs:** Lane A `ses_f5fba15cdffel6pC0kTWSfsQGZ`; Lane B
`ses_f5fb9f4b7ffeVgfh6jqVy13qvJ`; Lane C `ses_f5fb9ca2fffeNDJFpZTDty9TBv`
**Lane evidence:** `docs/reviews/stakeholder-export-parity-audit-c05/lane-{a,b,c}.md`
plus temp renders under `%TEMP%/opencode/stakeholder-export-parity-c05/`
(`lane-a/`, `lane-b/`, `lane-c/`, `planner/`)
**Correction packet:** `docs/prompts/beneficiary-export-parity-one-shot-c05-2026-09-14.md`
**Output contract:** `docs/reference/atlas-beneficiary-output-contract.md`
**Revision:** r2 (2026-09-14) — wave-audit F2 remedy applied (G13 added to
§0/§6/§7/§9 and to packet T10/M23); F3/F4 evidence-index corrections. Revision
r1 was frozen at `5eb14664`; audit round-1 verdict preserved at
`docs/reviews/stakeholder-export-parity-audit-c05/wave-completion-audit-r1.md`.

## 0. Verdict summary

ATLAS has three genuinely wired, actor-scoped, zero-write official export routes
(summary workbook, class program, teacher program) sharing one per-term entry
source with correct ARAL/HG/AP/Flag semantics and a client contract that binds
every official download to one selected term. **The beneficiary-ready claim is
NOT met.** Confirmed blocking and material defects:

| # | Finding | Class |
|---|---|---|
| G1 | Server official exports fail open to mixed all-term output when `termIndex` is absent | **BLOCKING** |
| G2 | Published teacher-program export loses term identity (501 on selected term) and is not bound to the requested published run | **BLOCKING** |
| G3 | Class program does not reproduce the 2026–2027 template layout (no merged break bands, no separate Teacher column convention, no totals row, no signature/approval areas, no learner fields, no shift header identity) | **BLOCKING** (beneficiary readiness) |
| G4 | Room program official export does not exist; room representation is an all-term client-side CSV; on-screen room read can write | **ABSENT / BLOCKING** |
| G5 | Summary workbook lacks per-subject teacher sheets and print setup parity; geometry source diverges from class program | MATERIAL |
| G6 | Filenames omit school year/term/entity identity required by the output contract | MATERIAL |
| G7 | Matrix JSON endpoint semantics diverge (empty-200, run selection, mismatch handling) | MATERIAL |
| G8 | Test quality: source-text assertions, catalog-vs-catalog “shape” parity, silently skipped real-buffer rows, helper-level term assertions, fixture-injected term identity that masks G2 | MATERIAL |
| G9 | DNO template catalog is a single-school default seed; editing surface/authority unstated | DECISION_REQUIRED (D-F) |
| G10 | Committed docs contain three false/stale parity claims | MATERIAL (docs-only) |
| G11 | Room read path performs writes via `getOrCreatePolicy` (create/normalize/DDL) | MATERIAL |
| G12 | Beneficiary artifacts show ARAL rows / minutes conventions that conflict with decision 6 wording; placeholder/period-config questions | DECISION_REQUIRED (D-A, D-C, D-D, D-E) |
| G13 | Draft/review official outputs carry no publication-state marker; a draft export is indistinguishable from a published one (contract §7.11) | MATERIAL |

**Classification vs the six categories:** no output type is
`PROVEN_COMPLETE`; class program/teacher program/summary are `PARTIAL`; room
program is `ABSENT`; server term handling is `FALSE_OR_MISLEADING` only in the
sense that the client contract (“selected-term only”) is not enforced at the
server boundary; several product-shape questions are `DECISION_REQUIRED`; no
row is `EXTERNALLY_BLOCKED` (the only renderer gap was resolved by planner
reproduction — see §3).

## 1. Scope, method, and evidence boundary

- Read-only audit: no browser, no login, no database access, no live/runtime
  probes, no package installation, no repository writes by any lane. Lanes read
  the frozen worktree; artifact bytes read from `D:/ATLAS/stakeholderFiles/**`
  (untracked, gitignored reference material) and copied to temp before rendering.
- Method: exact-SHA source trace (routes → middleware → services → builders →
  responses), test-internals inspection, structural extraction (python-docx
  1.2.0 / openpyxl 3.1.5), and **visual rendering of every relevant artifact
  page/sheet** (Word COM DOCX→PDF, Excel COM XLSX→PDF, Windows.Data.Pdf
  PDF→1600px PNG; inspected visually page-by-page).
- Planner independently re-verified the highest-risk claims: G1 (route + term
  resolver + service filter), G2 (published projection + export mapping), Z1/G11
  (write-on-read call chain), the class-program/summary builder layout, and the
  DOCX renderer availability dispute.
- Out of scope: live rendered ATLAS files from a real generation run, browser
  UX behavior, deployed runtime behavior, publication state.

## 2. Source artifact inventory (exact)

Classification: **C** = current 2026–2027 contract evidence; **H** = historical
layout/room evidence only; **X** = context/technical (not a layout contract).

| Artifact | SHA-256 | Extent | Class |
|---|---|---|---|
| `stakeholderFiles/DNO-CLASS-PROGRAM-TEMPLATE-2026-2027.docx` | `9FDAC094…4E09EED0` | 4 pp (G7, G7-Spec, G9, G9-Spec; single-section day-column; Teacher column; merged breaks; Flag/HGP Monday overlay; ARAL-Reading rows; totals; 4-signature block; division footer) | C |
| `stakeholderFiles/aral-prog_G7_Class-Program_SY2026-2027docx.docx` | `A83A09F6…B9B8954D3A` | 5 pp (Grade 7 all-sections section-column: 20 sections as columns, subject/teacher stacked sub-rows, HEALTH/LUNCH bands, legend, HNHS branding, 10-signature page). Contains ARAL PAN (AP), not the ARAL Program | C |
| `stakeholderFiles/Teachers-PROGRAM_SPEC-PROG-AFTERNOON.docx` | `79AEC643…F6D1A3BF9` | 1 p (afternoon teacher program; Time/No. of min/Subject/Grade and section/Day/Bldg/Room #; load block with ARAL 0 min; photo box; 5-role signature block; “45 mins Inclusive of HGP/PEACE Campaign (Monday)” note) | C |
| `stakeholderFiles/root-reference/SUMMARY-AND-TEACHERS-SCHEDULE-PER-SUBJECT-2026-2027.xlsx` | `63DB8E9A…79D0B3B3` | 10 sheets (SUMMARY ×2, SCIENCE, MATH, ENGLISH, FIL, AP, ESPGMRC, MAPEH, TLE; panel-per-teacher; ARAL 1/2 rows; print area `$B$40:$N$77` truncation) | C |
| `stakeholderFiles/CamScanner-04-16-2026-14.38.pdf` | `1C907A86…23FDDDE` | 7 pp rendered (Annex B three-term school calendar SY 2026–2027; T1 Jun 8–Sep 15 2026; T3 Jan 4–Apr 8 [2026 print typo for 2027]) | C (term calendar) |
| `D:/ATLAS/teacherSched+LoadActual.png` | `359E6E4D…EB3AD34C` | 1 (SY2026-2027 teacher program photo reference; 225/60/0/285 min block) | C |
| `D:/ATLAS/teacher2Sched+LoadActual.png` | `7C976636…6B43919` | 1 (SY2026-2027 teacher program photo reference) | C |
| `D:/ATLAS/793160024_…jpg` | `1FDD01C4…8E18D05` | 1 (Grade 9 class program photo; learners 14/20/34; 510/495 min; adviser + 4 signatories) | C |
| `stakeholderFiles/CLASS-PROGRAM-SY-2025-2026-GRADE-8.xlsx` | `16668493…D13F0BD32` | 14 sheets (FLAG row, RECESS/LUNCH, “TEACHER X” placeholders, signature block) | H |
| `stakeholderFiles/quarter-3_grade-10-schedule-monitoring.xlsx` | `474AA680…BADEE183` | 11 sheets (Q3 special program monitoring; 40-min periods; B3/2F/R1) | H |
| `stakeholderFiles/root-reference/Teachers-PROGRAM.docx` | `44DBDD52…260E6D77` | 1 p (SY 2025–2026; RECESS/lunch; ARAL Program 60 min; “For every learner, we rise!”) | H |
| `stakeholderFiles/root-reference/CLASS-PROGRAM-v2.docx` | `C44ACAC1…EFD260B` | 1 p (SY 2025–2026 Grade 7 - AGONCILLO; full-width Flag band; inline subject/teacher) | H |
| `stakeholderFiles/root-reference/40-minutes.xlsx` | `C5396FE0…F4D962` | 3 sheets/39 pp (SY 2025–2026; three mutually inconsistent internal time grids) | H |
| Occupancy set: `BLDG3-BLDG-9-occupancy-plan-2023-24.docx`, `GARDE-8-OCCUPANCY-PLAN.docx`, `OCCUPANCY-PLAN-IN-4-STOREY-20-CL_24-CL-BUILDINGS_SY-2023-2024.docx`, `GRADE-7-OCCUPANCY-PLAN.pdf` | see lane A | room→section→adviser history | H |
| `root-reference/Curio_Gilera_Gromea_ATLAS_BSIT3B.pdf`, `root-reference/question_prompt.pdf`, `EnrollPro/docs/HNHS.pdf` | see lane A | capstone/defense/product context | X |

All 14 pinned SHA-256 values were independently re-computed by Lane A and
matched; Lane C independently re-verified 7 of them; no source artifact was
modified (renderers opened temp copies only).

## 3. Rendered evidence inventory

**DOCX (planner reproduction).** Lane A reported
`EXTERNALLY_BLOCKED(RENDERER_UNAVAILABLE)` for DOCX rendering. The planner
reproduced DOCX→PDF successfully on the same host with MS Word COM
(`word.Documents.Open(path,$false,$true,$false)` + `ExportAsFixedFormat(pdf,17)`),
then rasterized via Windows.Data.Pdf at 1600px. **Lane A’s block is superseded
by planner evidence; the renderer is available for DOCX.**

| Artifact | Pages rendered | PNG pages visually inspected |
|---|---|---|
| DNO-CLASS-PROGRAM-TEMPLATE-2026-2027.docx | 4 | 4 (p1 G7, p2 G7-Spec, p3 G9, p4 G9-Spec) |
| aral-prog_G7_Class-Program_SY2026-2027docx.docx | 5 | 5 (p1–p4 = 20 Grade 7 sections; p5 = 10-signature approval page) |
| Teachers-PROGRAM_SPEC-PROG-AFTERNOON.docx | 1 | 1 |
| root-reference/Teachers-PROGRAM.docx (H) | 1 | 1 |
| root-reference/CLASS-PROGRAM-v2.docx (H) | 1 | 1 |

Evidence: `%TEMP%/opencode/stakeholder-export-parity-c05/planner/pdf/`
(4 PDFs: aral-prog, spec-afternoon, root-teacher-program, class-program-v2),
`.../planner/png/` (8 PNGs), plus the DNO render `dno-copy.pdf` (4 pp) and
`test-page-1..4.png` at the temp root.

**XLSX (Lane A).** 38/38 relevant sheets converted to per-sheet PDF
(`lane-a/xlsx-pdf/`, 39 PDFs including one non-sheet probe) and rasterized to
272 PNGs (`lane-a/pdf-png/`, including 9 probe artifacts). Visual inspection coverage:
SUMMARY workbook 7/10 sheets (SUMMARY, SUMMARY(2), SCIENCE, MATH, MAPEH,
ESPGMRC, TLE), 40-minutes 4/39 pp, CLASS-PROGRAM-2025-2026 1 sheet, quarter-3
1 sheet. Structural extraction was complete for all sheets (merged ranges,
hidden rows/columns, print areas, orientation, formulas, typed values).

**PDF/images.** CamScanner 7 pp rendered (4 inspected), GRADE-7-OCCUPANCY 4 pp
(1 inspected), HNHS.pdf 27 pp (4 sampled), Curio 97 pp (3 sampled),
question_prompt 5 pp (1 sampled); all three SY2026-2027 root images inspected.

## 4. Beneficiary field/layout matrix (2026–2027 contract evidence)

### 4.1 Section/class program — two observed families

| Field/layout element | DNO family (day columns, 1 section/page) | G7 family (section columns) | ATLAS today |
|---|---|---|---|
| Branding region | Division header + footer band (no logos in file) | HNHS header + MATATAG/Bagong Pilipinas logos + address footer | Title + `School:`/`Year:`/`Run:`/`Generated:` meta only |
| Grade / Section | Grade printed; Section blank to fill | 5–6 section columns/page | `SECTION: <name>` row per block |
| Learners M/F/Total | Present, blank | Absent | Absent |
| Time + No. of min | Both columns | Time only | TIME + MINUTES columns |
| Mon–Fri columns | Yes | No (sections are columns) | Yes (per-section blocks) |
| Teacher attribution | Dedicated Teacher column | Teacher name stacked under subject (light band) | Inline `${subject}\n${teacher}` in one cell |
| Breaks | Merged bands (Health 15 min; Lunch 45 min) | Merged full-width bands | Label repeated into day cells; no merges |
| Flag/HGP | Monday-only overlay sharing the Tue–Fri period | Not present | Monday-only overlay implemented (policy-driven) |
| AP | Ordinary row | ARAL PAN ordinary subject | Ordinary (ARAL PAN unaffected) |
| HG standalone row | None | None | Excluded |
| ARAL Program row | “ARAL-Reading English/Filipino/Math” 60 min row (Mon–Thu) with Friday “TLE *45 min only”; totals 420/405 and 510/495 | Not present (decision 6 scope) | Excluded from cells |
| Totals row | Present (“Total minutes per day”) | Absent | Absent |
| Adviser | Present | Present (row) | Adviser in SUMMARY only |
| Approval areas | Prepared/Reviewed/Recommending/Approved (4) | Signature page (10 signatures) | Absent |
| Orientation | Landscape 11×8.5 | A4 landscape | Default sheet, no print setup |
| Term identity | None visible (flat) | None | Term in filename only (client) |

### 4.2 Teacher program

| Field | SPEC afternoon (C) | Root reference (H) | ATLAS today |
|---|---|---|---|
| Branding region | HNHS + division header, footer motto | Same family | None (title only) |
| Columns | Time/No. of min/Subject/Grade and section/Day/Bldg/Room # | Same | Same six columns (parity) |
| Day representation | “Monday to Friday” compaction | Same | Same compaction implemented |
| Photo | Picture box | Picture box | Absent (no placeholder box) |
| Profile block | Name/Position/Bachelor’s/Post-grad | Same | Present (Name/Position/degrees) |
| Load block | Class Advising / Actual / ARAL (0 min) / Total | ARAL 60 min (2025–2026) | Present incl. Ancillary row; ARAL 0 in 2026–2027 path per exclusion filters |
| Daily totals | “315 mins. (Monday–Friday)” + HGP note | “285 mins…” | Per-day table (Day × min) — different shape |
| Ancillary | Time-slotted rows in schedule | Time-slotted rows | Weekly “Credited Non-Teaching Work” table |
| Signatures | Teacher/School Head/PSDS/CID/ASDS (names printed) | Same | Roles present; names blank placeholders (configurable) |
| Term identity | Title “SY 2026-2027”; term not printed | — | Term only in client filename; server filename has none |

### 4.3 Room program

No 2026–2027 standalone per-room artifact exists. Room identity appears inside
class programs (`BLDG./ROOM NO.` bands) and occupancy sheets (room → section →
adviser). ATLAS has no official room export; the RoomSchedules page exposes an
on-screen grid plus a client-side, all-term CSV (`schedule-export.ts`).

### 4.4 Summary workbook

| Field | Reference workbook | ATLAS today |
|---|---|---|
| Sheets | SUMMARY ×2 + 7 per-subject sheets + ESPGMRC | Single `SUMMARY` sheet only |
| Panel layout | Per-teacher panels: SUBJECT|SECTION, time rows, ADVISORY/ANCILLARY/TOTAL | Section matrix: TIME | adviser | teacher row + subject row per slot, bands ≤12 sections |
| Term identity | Absent (flat) | Absent (flat) |
| Print setup | Per-sheet orientation/scale; truncated print_area on SUMMARY | None (no print area/orientation set) |

## 5. Current ATLAS route/control matrix (verified)

| Output | Client control | URL | Route / authority | Truth source | Builder | Response / filename | Errors | Verdict |
|---|---|---|---|---|---|---|---|---|
| Summary workbook | `TimetableSimpleHeader.tsx:237-242` → menu `SimpleBeneficiaryControls.tsx:115-123` | `/api/v1/generation/{school}/{year}/runs/{run}/export/summary-teacher-schedule.xlsx?termIndex=n` (`simpleExportRequests.ts:56-65`) | `generation.router.ts:582-638`; `authenticate` + `PRIVILEGED_ROLES` + `assertActorSchoolScope` (`:584-599`) | `loadExportContext` (`workbook-export.service.ts:159-281`): run-scoped draft entries; published → `resolvePublishedRun` + runId equality (`:192-202`); term filter only when provided (`:208-217`) | `exportSummaryWorkbook` (`:384-478`), `buildEntryGrid` (`:283-310`) | xlsx buffer (`:617`); `summary-teacher-schedule-termN.xlsx` (`:619-620`) | typed 404/422/501/400 (`:622-636`) | **PARTIAL** |
| Class program | `:243-248` | `…/class-program.xlsx?termIndex=n` (`:68-75`) | `generation.router.ts:642-710` (same authority) | same context | `exportClassProgramWorkbook` (`:480-629`) | `class-program-termN.xlsx` (`:691-692`) | same shape (`:694-708`) | **PARTIAL** |
| Teacher program | `:249-255` | `…/teacher-program.docx?facultyId=&termIndex=n` (`:77-84`) | `generation.router.ts:714-794` (same authority) | `buildTeacherProgramExportShape` (`teacher-program-export.service.ts:128-464`); published → `getPublishedFacultySchedule` (`:227-263`) | `generateTeacherProgramDocx` (`docx-export.service.ts:106-443`) | DOCX (`:764`); `Teacher_Program_{name}.docx` (`:763`, no term/year) | typed 404/422/501 (`:766-789`) | **PARTIAL (blocking published defect)** |
| Class-program matrix (JSON) | (internal/diagnostic) | `…/class-program-matrix?gradeLevel` (`generation.router.ts:798-880`) | same authority | `resolveSourceRun` (`class-program-matrix.service.ts:98-152`): latest COMPLETED `createdAt desc` when no runId; published → `resolvePublishedRun` | `generateClassProgramMatrix` (`:164-324`) | `res.json` 200 incl. `NO_SOURCE_RUN` empty (`:211-227`) | typed errors; empty-200 exception | **PARTIAL** |
| Room program | none | none | none | `room-schedule.service.ts:87-92` (no term param) | none server-side | client CSV `schedule-export.ts:5-51` (all terms) | none official | **ABSENT** |

**Term authority chain (verified):** route parses `termIndex` only when present
(`generation.router.ts:601-615`); `resolveRequestedTermIndex(…, undefined)
→ undefined` (`academic-term.service.ts:141-147`); services filter only when
defined (`workbook-export.service.ts:208-217`, `class-program-matrix.service.ts:
154-160`, `teacher-program-export.service.ts:271-278`). Therefore an official
export with the query parameter omitted serves mixed all-term content. The
client never sends it empty (`simpleExportRequests.ts:33-53`: all-term resolves
to `null`; menu disabled), so this is a server-boundary fail-open.

**Client error/duplicate handling (verified):** single-flight guard
(`TimetableSimpleHeader.tsx:259`), per-item disabled state
(`SimpleBeneficiaryControls.tsx:117,126,136`), visible retryable error banner
(`:169-199`; `TimetableSimpleHeader.tsx:270-272`), all verified by SSR tests
(`timetable-term-export-c03r3.test.ts:56-144`).

## 6. Cross-output parity matrix (12 invariants)

| # | Invariant | Status | Evidence |
|---|---|---|---|
| 1 | Section cell → exactly one compatible teacher row | PARTIAL | Same-entry inline attribution for draft (`workbook-export.service.ts:300-307,618`); published teacher program diverges (G2) |
| 2 | Room-bearing cell → exactly one room row | PARTIAL | Class program modal-room band (`:501-523`); teacher program room column; no room program |
| 3 | Teacher/room schedules contain no entries absent from section truth | PARTIAL | Draft path same entries; published teacher path is a different resolver (`teacher-program-export.service.ts:227-263`) |
| 4 | Summary totals reconcile with section/teacher/room | PARTIAL | No totals in class program; teacher load block computed in its own builder; no reconciliation control |
| 5 | T1/T2/T3 isolated | PARTIAL | Entry-level guards pass (`TERM_FILTER_NOT_READY`), but server accepts absent term (G1) and published teacher path breaks (G2) |
| 6 | Five-session weekly subject → five sessions every applicable term | PROVEN (service) | `tt-output-c03r3.test.ts:193-327` per-term totals + rotation membership; no leak (`:385-429`) |
| 7 | Rotating subject identities only in assigned term | PROVEN (service) | Same suite incl. mutants |
| 8 | Rotating teacher/room changes propagate to every output | PARTIAL | Shared draft entries; published teacher resolver diverges |
| 9 | Revision-effective edits appear in every export | PARTIAL | Workbook + matrix use `resolvePublishedRun`; teacher uses a different resolver; matrix/teacher identity rules differ |
| 10 | Published output uses authoritative published revision | PARTIAL | Workbook binds `published.source.runId === runId` (`workbook-export.service.ts:195-199`); matrix returns 404/empty (`class-program-matrix.service.ts:140-143`); teacher export performs **no runId binding** (`teacher-program-export.service.ts:227-232`) |
| 11 | Draft/review outputs identify not published | ABSENT → **G13** | No publication-state label in any builder (grep: no NOT_PUBLISHED/publication marker in the export services); workbook meta has run id only (`workbook-export.service.ts:364-382`); carried as G13 (§7) and packet T10/M23 |
| 12 | Missing identity/term/run/faculty/room/source authority fails closed | PARTIAL | 404/422/409/501 lanes exist; absent term does not fail (G1); matrix empty-200 (G7) |

## 7. Confirmed gaps (file:line evidence)

**G1 — Server official exports fail open to mixed all-term output. BLOCKING.**
`generation.router.ts:601-615` (absent query → `undefined`),
`academic-term.service.ts:141-147` (`undefined` → all terms),
`workbook-export.service.ts:208-217`, `teacher-program-export.service.ts:271-278`,
`class-program-matrix.service.ts:154-160` (filter only when defined).
Contradicts fixed decision 2 and the client contract’s guarantee.

**G2 — Published teacher-program export loses term identity and run binding.
BLOCKING.** Presentation projection omits `termIndex`
(`published-schedule.service.ts:613-666`); export maps `termIndex ?? null`
(`teacher-program-export.service.ts:238-263`) then rejects when a term was
requested (`:271-278`) → selected-term published export = 501
`TERM_FILTER_NOT_READY`; unterm’d = mixed. No `published.source.runId`
equality check at `:227-232` (contrast `workbook-export.service.ts:195-199`).
The client always sends a term, so the published teacher-program download is
functionally broken.

**G3 — Class program is not template-parity. BLOCKING (beneficiary readiness).**
`workbook-export.service.ts:480-629`: per-section blocks exist, but no merged
break bands, no DNO-style Teacher column (inline cell at `:618`), no totals row
(`:590-621`), no signature/approval areas, no learner M/F/Total fields, no
branding block beyond `addReportHeader` (`:364-382`), no print setup/orientation.
Reference layouts: DNO 4 pp and G7 5 pp (see §4.1).

**G4 — Room program official export absent; room representation not term-scoped
and not zero-write. BLOCKING/ABSENT.** No server route
(`generation.router.ts` content-disposition producers are only the three at
`:620,692,763`); `room-schedule.service.ts:87-92` takes no term parameter and
`:251-308` merges all terms; `RoomSchedules.tsx:354-357` + `schedule-export.ts:5-51`
provide an all-term client CSV; on-screen read can write (G11).

**G5 — Summary workbook parity. MATERIAL.** Single `SUMMARY` sheet
(`workbook-export.service.ts:415`); no per-subject teacher sheets; no print
setup; section geometry differs from the canonical slot geometry used by the
class program (`:399-402` vs `:492-497,543`); reference workbook has 10 sheets
and per-sheet print setup (Lane A).

**G6 — File identity. MATERIAL.** Server filenames
`summary-teacher-schedule-termN.xlsx`, `class-program-termN.xlsx`,
`Teacher_Program_{name}.docx` (`generation.router.ts:619-620,691-692,763`) omit
school year; teacher filename omits term; entity absent for summary/class.

**G7 — Matrix JSON semantics. MATERIAL.** Empty run → 200 with
`warnings: [NO_SOURCE_RUN]` (`class-program-matrix.service.ts:211-227`); latest
selection ignores `runType` (`:115-119`) vs published resolver
`createdAt desc, id desc`, `runType:'FULL'` (`published-schedule.service.ts:182-202`);
published-run mismatch → 404 only for explicit runId, else silent empty (`:140-143`).

**G8 — Test quality gaps. MATERIAL.**
- `timetable-output-export-c03.test.ts:143-146` asserts DOCX print order by
  reading service source text.
- `generation-stakeholder-shape-genc02r.test.ts:33-77` compares a hand-authored
  catalog against itself; never parses the pinned stakeholder template.
- `tt-output-c03r.test.ts:121-155,241,272,295,320` silently skips real-buffer
  rows when `exceljs` is absent (`exceljsSkip`).
- `tt-output-c03r3.test.ts:367-381` asserts on `ctx.entries` (helper level), not
  on a produced artifact.
- `timetable-output-export-c03.test.ts:161-164` injects `termIndex` into
  fixtures — masking G2’s real published-producer gap.
- `TimetableSimpleHeader.tsx:259` single-flight guard has no behavioral control
  (`timetable-term-export-c03r3.test.ts:78-104` renders the busy prop only).
- No mounted-route test exists for `teacher-program.docx`, for missing/invalid
  JWT, for raw system tokens, or for non-privileged roles on the export family.

**G9 — Single-school default seed. DECISION_REQUIRED (D-F). MATERIAL.**
`class-program-slot.service.ts:165` (`STAKEHOLDER_DNO_2026_2027_45MIN_R2`),
`:47-56,98-107` (“for this school” grade mappings), seeded per school/year
without overwrite (`:280-317`); exports resolve persisted slots
(`workbook-export.service.ts:543`). The persisted-row authority exists; the
editing surface and the school-agnostic handling of the default seed are
unstated. No beneficiary person/school names exist in runtime source (Lane C
grep: TORNEA/NONATO/BEDAIRE/FELICANO/ENGLIS/NEGROS/HNHS → none).

**G10 — False/stale committed claims. MATERIAL (docs-only).**
`docs/reference/timetable-dynamic-workspace-and-warning-contract.md:303-304`
claims shared selected-term entries for room/teacher/exports (contradicted by
G1/G2/G4); `docs/reference/atlas-runtime-source-of-truth-map.md:920`
`TERM_FILTER_NOT_READY` claim is true only when a term is requested;
`docs/handoffs/tt-output-c03r-planner-result.md:78-82` accepted “default
downloads are all-term” — the server gap was never closed and the closure is
stale.

**G11 — Room read path writes. MATERIAL (pre-existing).**
`room-schedule.service.ts:87-92` → `:101` `policyService.getOrCreatePolicy`
→ `scheduling-policy.service.ts:963-983` (creates defaults, normalizes
`constraintConfig`) and `ensureSchedulingPolicyColumns()` (`:900-958`, DDL +
backfill UPDATEs). A passive reader already exists (`:1001+`) and should be
used by read/export paths.

**G12 — Preserved semantics & beneficiary-document conventions. DECISION_REQUIRED.**
Correct and must not be rewritten: Flag/HGP Monday-only overlay
(`workbook-export.service.ts:75-80,604-613`), HG/ARAL exclusion from cells and
teacher rows (`:297`, `teacher-program-export.service.ts:283-286`,
`class-program-matrix.service.ts:281-283`), AP ordinary, per-term demand
5/term, no T1 coercion. Open conventions: ARAL placeholder vs omission (D-A),
class-program family choice (D-C), period/shift canonicalization (D-D),
learner-count source (D-E). Latent: teacher-program break rows lack the
Flag→Monday day fallback used by the workbook
(`teacher-program-export.service.ts:320-336`) — included in the packet.

**G13 — Draft/review outputs carry no publication-state marker. MATERIAL.**
Contract §7.11 requires non-published outputs to identify that they are not
published; no builder emits such a marker (grep across
`workbook-export.service.ts`, `docx-export.service.ts`,
`teacher-program-export.service.ts`: no `NOT_PUBLISHED`/publication label). The
workbook meta rows carry a `Run:` id only (`workbook-export.service.ts:364-382`),
and the run gate admits any COMPLETED run (`loadExportContext:181-183`).
A review-state export is therefore indistinguishable from a published one.
Corrected by packet T10 / M23. (Added in r2 after wave-audit finding F2.)

## 8. Missing source behavior vs unverified live behavior

**Missing/incorrect source behavior (correctable now, no live dependency):**
G1, G2, G3, G4, G5, G6, G7, G8, G11, G10 (docs).

**Unverified live behavior (explicitly NOT claimed by this audit):**
- Actual ATLAS-generated files from a real current-year run (no live run access
  in this read-only cycle) — all builder verdicts are from source + unit/mounted
  tests already committed.
- Published-path behavior against a real published revision (source-level only).
- Browser UX of the exported controls (SSR tests only; no login/browser).
- Physical print fidelity and font substitution in Word/Excel output.
- Learner-count data availability (no authoritative source identified in ATLAS).

**Live precondition context (from the living register, not re-probed here):**
the shared runtime serves release `3d916b26`; the term-cache catch-up capture is
complete (`9c19b772`) with its apply still locked; generation/publication remain
separately gated HIGH actions. None of those were touched by this audit.

## 9. Prioritized correction scope

**P0 (correctness of the beneficiary contract):**
1. G1 — require a resolved selected term for all official exports; typed
   failure when absent; mounted negative controls prove zero bytes.
2. G2 — carry `termIndex` through the published presentation projection (or
   thread the term filter through `getPublishedFacultySchedule`), bind the
   published run identity, and prove with a real-producer mounted test.

**P1 (output completeness/parity):**
3. G3 — class program: DNO-family layout (Teacher column or equivalent,
   merged break bands, totals row, learner fields, approval areas, branding
   block) from configurable inputs; print setup.
4. G4 — official room program export (selected term, server-generated, actor
   scoped, zero-write) + client control.
5. G5 — summary workbook: per-subject teacher sheets + print setup +
   reconciliation totals.
6. G6 — server/client filename identity.
7. G11 — room read path uses the passive policy reader.

**P2 (hardening):**
8. G7 — matrix semantics parity.
9. G8 — replace weak controls with real-builder/mounted/parity controls (the
   packet lists the mandatory matrix).
10. G13 — publication-state marker on every official output (draft/review vs
    published), driven by the run’s persisted publication state; covered by
    packet T10/M23.

**Docs:** G10 corrections are carried in the successor packet (this audit’s
deliverable set does not include editing pre-existing docs).

**Preserve (must not be rewritten):** per-term demand 5/term + rotation
isolation tests; no implicit T1 coercion; HG/ARAL exclusion; AP ordinary;
Flag Monday-only overlay with Tue–Fri teachable; actor-school scope with zero
dispatch; client term-bound requests, all-term disable, visible retryable
errors, single-flight; export services read-only; published workbook revision
binding; zero-write instrumentation in `tt-output-c03r-route.test.ts`.

## 10. Operator decisions (DECISION_REQUIRED)

- **D-A**: ARAL placeholder row in official class program: render an empty
  labeled row, or omit entirely? (Decision 6 excludes demand/credit/cells;
  artifacts show ARAL rows for the school’s own use.)
- **D-B**: Confirm the default room-program shape (§3.3 of the contract) or
  supply the school’s preferred form; confirm the room program is required for
  the pilot.
- **C / D-C**: Confirm the DNO single-section day-column family as the official
  class-program layout; whether the Grade 7 all-sections variant is also
  required.
- **D-D**: Confirm authoritative period lengths, shift windows, and
  Friday/“*45 min only” conventions per grade as persisted configuration
  (references show 420/405, 495/510, 315 variants).
- **D-E**: Name the learner-count source (Male/Female/Total) or confirm blank
  fields until integrated.
- **D-F**: Confirm persisted `classProgramSlot` rows as the configuration
  authority (DNO catalog = default seed) and name the editing surface.

## 11. Recommended successor streams

1. **BENEFICIARY-EXPORT-PARITY-C05 (primary, one-shot, MEDIUM source risk):**
   the correction packet at
   `docs/prompts/beneficiary-export-parity-one-shot-c05-2026-09-14.md`.
   Covers P0/P1/P2, docs corrections (G10), and the full mandatory control
   matrix; no deployment/live generation/publication; fresh independent QA.
2. **Deployment/acceptance (separate, HIGH, locked):** after the correction is
   integrated and the term-cache apply is separately approved, verify rendered
   exports from a real run against the contract’s print matrix. Not part of
   the correction packet.
3. **No other successor is needed for this audit.** G-9/D-F and D-A..D-D are
   decisions, not workstreams; defaults are specified if unanswered.

## 12. Evidence index

- Lane A report: `docs/reviews/stakeholder-export-parity-audit-c05/lane-a.md`
  (+ `%TEMP%/opencode/stakeholder-export-parity-c05/lane-a/`).
- Lane B report: `.../lane-b.md` (+ `.../lane-b/`).
- Lane C report: `.../lane-c.md` (+ `.../lane-c/`).
- Planner renders/commands: `%TEMP%/opencode/stakeholder-export-parity-c05/`
  — `planner/pdf/` (4 PDFs), `planner/png/` (8 PNGs), plus the DNO render at
  the temp root (`dno-copy.pdf`, `test-page-1..4.png`); all 12 rendered pages
  were visually inspected.
- Key commands: `git -C D:/ATLAS fetch origin --prune`; `git rev-parse
  origin/main` → `84dd537b…`; directive hash via LF-normalized SHA-256;
  Word/Excel COM renders; Windows.Data.Pdf rasterization; `git grep` source
  traces; python-docx/openpyxl structural extraction (no package installs).
- Zero-mutation confirmation: no repository write by any lane or the planner
  (worktree clean before/after; artifacts read from untracked
  `stakeholderFiles/` copies); no login/browser/database/runtime action.
