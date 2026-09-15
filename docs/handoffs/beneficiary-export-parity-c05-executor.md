# BENEFICIARY-EXPORT-PARITY-C05 — Executor Handoff (recovery adoption)

**Stream:** `BENEFICIARY-EXPORT-PARITY-C05`
**Worktree:** `E:/ATLAS-worktrees/beneficiary-export-parity-c05`
**Branch:** `work/beneficiary-export-parity-c05`
**Directive verified:** `origin/main:AGENTS.md` raw-blob SHA-256
`5f9206708a4763376dda1943c1ead28f49427ed1b1f0532ad25661f74ed3ebb5` (matches the
recovery packet pin; no directive drift observed).
**Governing packet:** `docs/prompts/beneficiary-export-parity-one-shot-c05-2026-09-14.md`
**Recovery packet:** `docs/prompts/beneficiary-export-parity-c05-recovery-adoption-2026-09-15.md`
**Risk tier:** MEDIUM source/client/tests/docs. No schema, deployment, runtime,
live generation, publication, or live-data action.

## 1. Verdict

**REVIEW_REQUIRED.** The candidate is complete for T1–T10 and the W3/W4 scope;
all 23 mandatory matrix rows are PASS (revision 2 — F1 correction + M19 render).

## 2. Immutable range

- Instruction-review base: `2e0b406f` (audit docs tip; ancestor of `HEAD`).
- Implementation range reviewed by this executor: `2e0b406f..<candidate>`
  (the candidate is the handoff commit itself — see §9).
- Adopted, unmodified commits: `90c539bc` (W1), `55b8a29a` (W2 checkpoint),
  `dbe2ceef` (planner packet). Not rebased, amended, reverted, or rewritten.
- Pre-existing recovery commits authored by the interrupted sessions and
  re-verified (not rewritten) by this executor: `5175a6ed`, `f7e72f97`.
- Additive corrections (round 1): `f29a9667`, `e614feef`, `2005f4dd`.
- Additive corrections (round 2 — QA `CORRECTION_REQUIRED`): `b1760dd6`
  (F1 zero-entry guard), plus the updated handoff commit.

## 3. Changed paths

**Adopted-verified (no bytes changed by this executor unless listed in §4):**
`atlas-server/src/services/workbook-export.service.ts`,
`teacher-program-export.service.ts`, `docx-export.service.ts`,
`class-program-matrix.service.ts`, `room-schedule.service.ts`,
`published-schedule.service.ts`, `room-program-export.service.ts` (new),
`atlas-server/src/routes/generation.router.ts`, `room-schedule.router.ts`,
`atlas-server/src/__tests__/timetable-output-export-c03.test.ts`,
`atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`,
`atlas-client/src/components/timetable/simple/simpleExportRequests.ts`,
`atlas-client/src/components/room-schedules/schedule-export.ts`,
`atlas-client/src/pages/RoomSchedules.tsx`,
`docs/prompts/beneficiary-export-parity-c05-recovery-adoption-2026-09-15.md`.

**Modified by this executor (additive corrections):**
- **F1 (QA round 1, blocking M16)** — one typed `EMPTY_SELECTED_TERM` (HTTP 422)
  fail-closed guard for a completed run whose selected-term *renderable* entry
  set is empty (reference-only HG/ARAL rows are not renderable). Placement is
  service level so the transport stays thin.
  - `atlas-server/src/services/workbook-export.service.ts` — new exported
    `assertRenderableExportEntries(ctx)`, called from `exportSummaryWorkbook`
    and `exportClassProgramWorkbook` immediately after `loadExportContext`.
  - `atlas-server/src/services/teacher-program-export.service.ts` — same typed
    failure after the selected-term + reference-only filters.
  - `atlas-server/src/routes/generation.router.ts` — typed mapping on the
    summary, class, and teacher routes only. The room route keeps
    `EMPTY_ROOM_SCHEDULE` and the matrix route keeps `EMPTY_SOURCE_RUN`; the
    guard deliberately does **not** live in `loadExportContext`, so neither is
    replaced.
  - Interpretation recorded (F1 item 3): the guard is evaluated on the renderable
    entry set the document would actually print. A run with entries in the
    selected term still returns 200 + a real file; a run whose selected-term rows
    are all HG/ARAL fails closed.
  - Tests in `tt-output-c03r-route.test.ts`: `every official export fails closed
    with zero file bytes when the completed run has no selected-term entries`
    (both directions — populated → 200 + >2000 bytes; empty and HG-only → 422
    `EMPTY_SELECTED_TERM`, no `content-disposition`, `application/json`, error
    body < 500 bytes, zero writes) and `the zero-entry guard does not replace the
    room or matrix failure contracts` (non-regression).
- `atlas-server/src/services/room-program-export.service.ts` — period structure now
  unions entry intervals with `displaySlots` (an entry could previously be
  silently dropped); totals row is per-weekday occupancy instead of one repeated
  aggregate.
- `atlas-server/src/services/workbook-export.service.ts` — summary per-subject
  sheet enumeration now excludes reference-only HG/ARAL subjects (**M8 defect**:
  the adopted delta created `ARAL Program` / `Homeroom Guidance` worksheets).
- `atlas-server/src/__tests__/tt-output-c03r-route.test.ts` — room route added to
  M1; new mounted room-program, auth matrix, filename identity, publication
  marker, and missing-faculty suites.
- `atlas-server/src/__tests__/tt-output-c03r.test.ts` — T4 layout row indices and
  the new T4 layout/merge suites (adopted dirty delta completed).
- `atlas-client/src/lib/__tests__/timetable-term-export-c03r3.test.ts` —
  adjudicated fixture correction from the retired `*-run-<id>-term<N>` identity
  to the current `SY<year>` identity (see §8).

**Added by this executor:**
- `atlas-server/src/__tests__/tt-output-c05-beneficiary-parity.test.ts`
- `atlas-client/src/lib/__tests__/timetable-c05-beneficiary-export.test.ts`

**Docs (W4, exactly three):**
- `docs/reference/timetable-dynamic-workspace-and-warning-contract.md` (§9.2)
- `docs/reference/atlas-runtime-source-of-truth-map.md` (TERM_FILTER_NOT_READY
  semantics)
- `docs/handoffs/tt-output-c03r-planner-result.md` ("default downloads are
  all-term" superseded)

## 4. Adopted-work verification result

| Adopted claim | Result | Evidence |
|---|---|---|
| Compile break (defect §2.1) | **already fixed** in `5175a6ed`; verified by `tsc --noEmit` server+client = 0 | §6 |
| Stale matrix-route comment (defect §2.2) | **already fixed**; comment now states the T1 rejection | `generation.router.ts:947-951` |
| Teacher DOCX `Checked by` row (defect §2.3) | **already restored**; full role set asserted from real DOCX XML | M10 test |
| Client/server filename identity (defect §2.4) | **already implemented**; client mirrors the server token and degrades to `SY-UNLABELED`; asserted both halves | M18 tests |
| T1/T2/T3 typed term + published binding | verified by mounted and service tests | M1, M3, M4, M16 |
| T4 class-program layout | verified, and **completed** (learner row, TEACHER column, merged bands, totals, approval block, print setup) | M9, M13 |
| T5 summary workbook | **completed**: per-subject sheets, print setup, reconciliation; **M8 defect corrected** (HG/ARAL sheets removed) | M8, M12 |
| T6 teacher program | verified: branding, portrait, photo placeholder, six columns + compaction, load identity, role set | M10 |
| T7 room program export | **completed and corrected**: new service+route+client control; interval-union and per-day totals fixes | M11, M13 |
| T8 room read term scope + passive policy | verified; passive reader proven zero-write with an instrumented client and a `getOrCreatePolicy` source guard | M15 |
| T9/T10 identity + publication marker | verified on all four outputs | M18, M23 |

## 5. Mandatory matrix tally

`total 23 / passed 23 / blocked 0 / deferred 0` (revision 2)

| # | Verdict | Evidence |
|---|---|---|
| M1 | PASS | All four export routes + matrix reject absent `termIndex` with typed 400 `TERM_INDEX_REQUIRED`, no `content-disposition`, zero dispatch |
| M2 | PASS | Per-term class/room/summary outputs contain only that term's cells; rotation members asserted absent across terms |
| M3 | PASS | Published teacher-program shape driven by the real published resolver + selected term |
| M4 | PASS | Mismatched published `runId` → `RUN_NOT_FOUND`, zero bytes (workbook + teacher shape) |
| M5 | PASS | 5 MATH cells in each of the three terms in the generated class workbook |
| M6 | PASS | Rotation member per term in the class workbook; other-term members absent |
| M7 | PASS | Monday-only flag cell with Tue–Fri teachable (existing + retained suites) |
| M8 | PASS | No ARAL Program / HG worksheet, row, cell, or label in class/summary/room; AP renders ordinarily |
| M9 | PASS | Learner row, TEACHER column, merged break geometry, daily totals arithmetic, approval rows, landscape fit |
| M10 | PASS | Real DOCX XML: branding, portrait, role set, load rows, no ARAL/HG, `Monday to Friday` compaction |
| M11 | PASS | Mounted room route 200 + scoped identity + zero writes + client zero dispatch while unresolved |
| M12 | PASS | SUMMARY matrix + per-subject sheets + landscape/fit + reconciliation totals |
| M13 | PASS | Class/room/summary conserve the same 7 renderable term-1 entries; class and room agree on the tuple |
| M14 | PASS | Mounted matrix: missing JWT 401, invalid JWT 401, non-privileged 403, raw system token 401, cross-school 403 — zero dispatch each |
| M15 | PASS | Instrumented DB client: exports zero-write; passive policy reader performs exactly one `findUnique` and zero writes; room view never calls the creating/DDL path |
| M16 | PASS | **F1 correction.** Typed 4xx + zero file bytes for unknown run, invalid/absent/out-of-contract term, unknown room, unknown faculty, empty source run, **and a completed run whose selected-term renderable set is empty (now `EMPTY_SELECTED_TERM`, 422, `application/json`, `content-disposition` absent, error body < 500 bytes, zero writes on all three official export routes; QA's pre-fix 7141/6815/DOCX bytes no longer produced)**. Room keeps `EMPTY_ROOM_SCHEDULE`, matrix keeps `EMPTY_SOURCE_RUN` |
| M17 | PASS | Busy flag + every official item disabled by the in-flight flag + handler single-flight guard |
| M18 | PASS | Server `Content-Disposition` and client filenames identical for all four outputs, incl. `SY-UNLABELED` |
| M19 | PASS | 7/7 produced outputs rendered to PDF, **every one exactly 1 page**; artifacts within sane size bounds (7 130–10 320 B); DOCX portrait (`w:pgSz w:orient="portrait"`); XLSX landscape + fit-to-width. **Root cause of the earlier hang confirmed: the wedged default printer `POS58 Printer(3)`. Recipe: save the default, set `Microsoft Print to PDF`, bounded 90 s Word COM job, then restore the default and kill orphans — default verified restored and no orphan Office processes remain.** |
| M20 | PASS | Three docs corrected; `git diff --check` clean |
| M21 | PASS | No assertion removals: asserts 52→72, 29→74, 16→16, 14→14; tests 11→13, 5→13 |
| M22 | PASS | Real builders produced DOCX/XLSX in `%TEMP%`; bidirectional extraction on real bytes |
| M23 | PASS | Draft renders `NOT PUBLISHED — DRAFT/REVIEW`; published renders `PUBLISHED — Revision 7 (2026-09-01)` |

**M19 no longer blocked.** The earlier Word COM hang was caused by the wedged
default printer queue (`POS58 Printer(3)`), not by the artifacts. The verified
recipe was applied: save the current default, set `Microsoft Print to PDF`, run a
bounded 90 s Word COM job (`Documents.Open` → `ExportAsFixedFormat(...,17)` →
`Close` → `Quit`), then restore the default and kill orphan Office processes. The
default was restored and verified (`POS58 Printer(3)`), and no orphan
`WINWORD`/`EXCEL` processes remain.

## 6. Decisive commands and results

| Command | Result |
|---|---|
| `npx tsc --noEmit` (atlas-server) | exit 0 |
| `npx tsc --noEmit -p tsconfig.json` (atlas-client) | exit 0 |
| `npm run build` (atlas-server) | exit 0 |
| `npm run build` (atlas-client) | exit 0 |
| `tsx src/__tests__/tt-output-c03r-route.test.ts` | 15 pass / 0 fail / 0 skip |
| `tsx src/__tests__/tt-output-c03r.test.ts` | 13 / 0 / 0 |
| `tsx src/__tests__/tt-output-c03r3.test.ts` | 12 / 0 / 0 |
| `tsx src/__tests__/tt-output-c03r3-placement-term.test.ts` | 8 / 0 / 0 |
| `tsx src/__tests__/timetable-output-export-c03.test.ts` | 7 / 0 / 0 |
| `tsx src/__tests__/tt-output-c05-beneficiary-parity.test.ts` | 11 / 0 / 0 |
| `tsx --test src/lib/__tests__/timetable-*.test.ts` (7 suites) | 29 pass / 0 fail / 0 skip |
| `git diff --check` | clean |

Server total (round 2) **66 pass / 0 fail / 0 skip**; client total **29 pass /
0 fail / 0 skip** (client untouched by F1).

## 7. Fixture inventory (deterministic)

Three ordered terms; one ordinary five-session weekly subject (MATH, Mon–Fri
06:00–06:45, 5 sessions in every term); one rotation family Biology→Chemistry→
Earth Science with per-term teacher/room changes; AP ordinary at 06:45 Thursday;
HG and ARAL present in the source demand but absent from every output; two
sections (7-Rizal, 7-Zamora) and two advisers; two teachers; two rooms (101/102
in Building A); a 09:00–09:15 Health Break band; a published variant with
`publication.revisionId = 7`, `publishedAt 2026-09-01`.

## 8. Test-preservation adjudications (M21)

1. `tt-output-c03r.test.ts` — class-program row indices shifted from 5/6 to
   10/11 by the T4 branding/identity block. Assertions were **re-pointed**, not
   removed, and coverage was extended (TEACHER column, learner row, merges,
   totals, approval block). Requirement formerly covered: per-day weekday cell
   content — still covered, plus the new layout contract.
2. `timetable-term-export-c03r3.test.ts` — the three hand-written descriptor
   fixtures carried the **retired** `*-run-<id>-term<N>` filename. They were
   updated to the current `SY<year>` identity; the assertion count is unchanged
   (14→14). Requirement formerly covered: "a successful export downloads the
   exact term-bound file" — still covered; the old fixture would have masked an
   M18 filename regression.

## 9. Artifacts and rendering inventory

Artifacts (never in the repo), directory
`%TEMP%/opencode/beneficiary-export-parity-c05/`:

| Artifact | Bytes |
|---|---|
| `class-program-SY2026-2027-term1.xlsx` | 7674 |
| `summary-teacher-schedule-SY2026-2027-term1.xlsx` | 9558 |
| `room-program-601-SY2026-2027-term1.xlsx` | 7131 |
| `teacher-program-501-SY2026-2027-term1.docx` | 10319 |
| `artifact-inventory.json`, `render-inventory.json`, `default-printer.before.txt` | — |

Byte counts drift by ±1 between rebuilds (container metadata); the M22 suite
asserts a >2000-byte sanity floor rather than an exact size.

Sheet inventory: class `Grade 7`; summary `SUMMARY, Mathematics, Biology,
Araling Panlipunan` (no HG/ARAL sheet); room `Room 101`.

Renders (Excel/Word COM → per-output PDF) under `.../renders/` — **7/7 outputs,
every one a single page**:

| Render | Bytes | Pages |
|---|---|---|
| `class-program-SY2026-2027-term1.xlsx.Grade_7.pdf` | 298 620 | 1 |
| `room-program-601-SY2026-2027-term1.xlsx.Room_101.pdf` | 285 080 | 1 |
| `summary-teacher-schedule-SY2026-2027-term1.xlsx.SUMMARY.pdf` | 258 309 | 1 |
| `summary-teacher-schedule-SY2026-2027-term1.xlsx.Mathematics.pdf` | 267 738 | 1 |
| `summary-teacher-schedule-SY2026-2027-term1.xlsx.Biology.pdf` | 265 452 | 1 |
| `summary-teacher-schedule-SY2026-2027-term1.xlsx.Araling_Panlipunan.pdf` | 270 454 | 1 |
| `teacher-program-501-SY2026-2027-term1.docx.pdf` | 118 165 | 1 |

The full machine-readable inventory is `render-inventory.json`.

## 10. Known risks

- **NON_BLOCKING:** every produced output rendered to a single page, so there is
  no multi-page clipped-column case to inspect; the landscape/fit-to-width setup
  is proven only for the deterministic fixture at this page geometry.
- **NON_BLOCKING:** the client year token comes from the runtime context's
  `activeSchoolYearLabel`; the server resolves it from `enrollProSchoolYearMirror`.
  Both degrade to `SY-UNLABELED`, but equality is by contract, not by a shared
  runtime read. If those two sources ever diverge, M18 would need re-verification.
- **NON_BLOCKING (pre-existing, not this candidate's scope):**
  `npm run test:workbook-export` points at
  `src/__tests__/workbook-export-content.test.ts`, which was removed from tracking
  long ago (`4794bd9e`); the script is dangling at base, on `origin/main`, and at
  this candidate.
- **NON_BLOCKING:** `M15`'s room-read half is proven at the policy-reader boundary
  (instrumented client) plus a `getOrCreatePolicy` call-site guard; a fully
  mounted `room-schedule.router` test does not exist in the repo and was not
  added (the route's policy builder needs a wide disposable-PostgreSQL fixture).

## 11. Boundary compliance / zero-mutation statement

No deployment, no runtime restart, no listener on 5001/5174, no live/shared
database access or mutation, no migration/schema change, no generation, no
publication, no browser login, no companion-repository edit, no
`stakeholderFiles/**` access, no `prisma/**`, no `package.json`/lockfile change,
no `docs/plans/**` or `CHANGELOG.md` edit, no push, no new dependency. All
produced artifacts live under `%TEMP%/opencode/beneficiary-export-parity-c05/`.
The M19 render required a temporary default-printer switch to
`Microsoft Print to PDF`; the original default (`POS58 Printer(3)`) was restored
and verified, no print queue was modified, and no orphan Office automation
processes remain.

## 12. Return

**REVIEW_REQUIRED.** Revision 2 — F1 (`EMPTY_SELECTED_TERM`) and M19 render
resolved; tally `23 / 23 / 0 / 0`.
