# ATLAS Beneficiary Output Contract

Status: reviewed audit artifact — STAKEHOLDER-EXPORT-PARITY-AUDIT-C05
Date: 2026-09-14 (Asia/Manila)
Audit base: `origin/main` `84dd537bb2a2c045b8518c35b3a5372142e0080c`
Directive: `origin/main:AGENTS.md` LF-SHA-256 `5f9206708a4763376dda1943c1ead28f49427ed1b1f0532ad25661f74ed3ebb5`
Companion analysis: `docs/analysis/stakeholder-export-parity-audit-2026-09-14.md`
Correction packet: `docs/prompts/beneficiary-export-parity-one-shot-c05-2026-09-14.md`

This document is the durable product contract for ATLAS beneficiary-facing
timetable outputs (the official outputs a school prints, signs, and distributes
to learners and teachers). It restates the operator-fixed decisions from the C05
audit packet, records the layout requirements observed from the school's
2026–2027 reference artifacts, and names the open operator decisions. It does
not authorize any deployment, live generation, or publication.

## 1. Fixed product decisions (operator-governed)

1. The school uses three ordered terms: **T1, T2, T3**.
2. Official exports are **selected-term outputs**, never one mixed all-term
   document.
3. Ordinary year-long subjects appear completely in every applicable term.
4. Rotating subjects may change subject, teacher, and room by term.
5. The current beneficiary rotates Science subject identity while retaining the
   teacher; ATLAS must support future teacher and room changes.
6. **ARAL Program is beneficiary-managed and must be absent from every official
   output.** It creates no timetable demand, no Teaching Load credit, no
   ordinary schedule cell, no export row, and no empty labeled placeholder in
   the class, teacher, room, or summary exports. ARAL rows or minutes observed
   in beneficiary files (including 2026–2027 references) are historical
   observed content overridden by this operator decision.
7. **Araling Panlipunan (AP / ARAL PAN)** remains an ordinary scheduled subject.
8. **HG is not** a standalone ordinary-demand subject.
9. **Flag Ceremony/HGP is a Monday-only overlay** on the underlying
   advisory-period slot. It must not occupy the corresponding Tuesday–Friday
   cells; those cells remain teachable for the underlying subject.
10. Outputs must remain **configurable and school-agnostic**: no hardcoded
    school/division names, people, sections, buildings, or subject assignments.
    School identity, signatories, and shift windows come from persisted
    configuration; absent configuration renders blank-line placeholders, never
    invented values.
11. Priority layout models (2026–2027 only; 2025–2026 and 2023–2024 files are
    historical evidence):
    - `stakeholderFiles/DNO-CLASS-PROGRAM-TEMPLATE-2026-2027.docx` — the
      single-section day-column class-program template family (Grade 7/Grade 9
      regular and Specialization variants; 4 pages).
    - `stakeholderFiles/aral-prog_G7_Class-Program_SY2026-2027docx.docx` — the
      HNHS Grade 7 all-sections section-column class program (20 sections,
      subject/teacher stacked cells; despite the filename it contains ARAL PAN
      (Araling Panlipunan), not the ARAL Program).
    - `stakeholderFiles/Teachers-PROGRAM_SPEC-PROG-AFTERNOON.docx` and the
      current teacher-program PNG references — the teacher program layout.
    - `stakeholderFiles/root-reference/SUMMARY-AND-TEACHERS-SCHEDULE-PER-SUBJECT-2026-2027.xlsx`
      — the summary + per-subject teacher schedule workbook.
12. Separate but visually aligned official outputs are required for:
    section/class program; teacher program; room program; summary and teacher
    schedule workbook.

## 2. Term authority

- Every official output is bound to exactly one resolved numeric term index
  from the verified ordered-term authority. `termIndex=active` resolves through
  the persisted verified authority; an explicit index must belong to the exact
  contract (3 terms for the pilot).
- A request without a selected term for an official output fails closed with a
  typed client-visible error. It must not default to an all-term document and
  must not silently pick the first term.
- Missing term identity on any entry fails closed (`TERM_FILTER_NOT_READY`),
  never coerced to T1.
- The output header/identity states the school year label and the selected term
  (`T1`/`T2`/`T3`).

## 3. Official output family

### 3.1 Section/class program (selected term)

Required content, per section:

- Branding region (configurable): school name, region/division/district lines,
  logos where configured; no hardcoded school identity.
- Title: `CLASS PROGRAM` / `Class Program for Grade N`, school year label.
- Grade and section; Number of Learners Male/Female/Total fields (rendered
  blank when no authoritative source exists — see D-E).
- Time column; number-of-minutes column; Monday–Friday columns; **Teacher**
  identity per period (separate Teacher column or equivalent unambiguous
  per-period teacher attribution, matching the chosen reference family).
- Morning/afternoon shift window per configured policy.
- Lunch break and health/recess breaks rendered as spanned bands consistent
  across weekdays where the school convention spans them.
- Monday-only `Flag Ceremony/HGP` overlay in the underlying period; Tue–Fri
  cells of the same interval remain ordinary teachable periods.
- AP as an ordinary subject row/cell.
- No HG standalone row; ARAL Program absent entirely (no row, cell, label,
  placeholder, or credit) in every export.
- Daily minute totals row with exact arithmetic; Friday or shift-specific
  variants must reconcile to the configured period structure.
- Adviser name; approval areas: Prepared by, Reviewed by, Recommending
  Approval, Approved by (configurable names/roles; blank lines when unset).
- Print-ready page fit (landscape for day-column family; one section per block
  or per sheet; no clipped columns).

### 3.2 Teacher program (selected term)

Required content per teacher:

- Branding region (configurable) and school year; title `TEACHER'S PROGRAM`.
- Teacher name; position; bachelor's degree; postgraduate degree; optional
  photo (placeholder box when absent).
- Columns: Time; No. of min; Subject; Grade and section; Day; Bldg/Room #.
- Monday–Friday representation (compact `Monday to Friday` when all five days
  match, matching the reference convention).
- Ancillary work and class-advising duty shown; lunch and health break rows.
- Actual teaching load. The load block carries **no ARAL component**:
  `Total Teaching Load = Class Advising Duty + Actual Teaching Load +
  Ancillary Work`. ARAL Program must not appear in the document (no row, no
  label, no 0-min entry); ARAL minutes in historical references (2025–2026
  “60 min”, the SPEC template’s “ARAL 0 min” row) are observed historical
  content overridden by this decision.
- Term-specific rotating assignments only; no cross-term leakage; the
  output is resolved for the requested term and bound to the requested run.
- Print-readable portrait output with signature block (Checked by Teacher +
  School Head, Noted, Recommending Approval, Approved — configurable names).

### 3.3 Room program (selected term)

No 2026–2027 per-room artifact exists; the contract defines the default shape
(open decision D-B to confirm or adjust):

- One block/sheet per room (bounded to rooms with entries for the term).
- Room/building identity; school year; selected term.
- Columns: Time; minutes; Monday–Friday; cell shows Subject + Section +
  Teacher unambiguously (stacked), breaks banded.
- ARAL Program absent entirely (no row, cell, or label).
- Selected-term entries only; no cross-school rows; no same-term collision;
  cross-term reuse of the same room allowed; breaks/non-demand rows handled
  consistently with the class program.
- Official printable export (server-generated file), not only an on-screen view
  or a client-side CSV.

### 3.4 Summary and teacher schedule workbook (selected term)

- SUMMARY section-by-time matrix per grade band with adviser row, teacher row,
  subject row, and breaks, reconciled with the class program.
- Per-subject teacher schedule sheets (one panel per teacher: subject, section,
  time rows, advisory/ancillary/total rows) as in the reference workbook.
- ARAL Program absent entirely (no row, cell, or label); the reference
  workbook’s “ARAL 1 / ARAL 2” rows are observed historical content overridden
  by this decision; Araling Panlipunan (AP / ARAL PAN) remains an ordinary
  subject.
- Term identity in the header; per-term completeness; totals that reconcile
  with the class program and teacher program for the same selected term.
- Print setup: orientation, fit-to-width, sensible page breaks; no truncated
  print areas that drop cohorts or signatories.

## 4. File identity

Server `Content-Disposition` filenames identify: output type, school year
label, term, and entity where applicable, e.g.
`class-program-SY2026-2027-term1.xlsx`,
`summary-teacher-schedule-SY2026-2027-term1.xlsx`,
`teacher-program-<faculty>-SY2026-2027-term1.docx`,
`room-program-<room>-SY2026-2027-term1.xlsx`. Client download filenames mirror
the server identity.

## 5. Fail-closed behavior

- Missing/invalid term, run, faculty, room, or source authority → typed non-2xx
  error; zero file bytes; visible retryable UI error for every official
  download control.
- A published output is bound to the requested published run identity and the
  revision-effective truth; a mismatched identity fails closed.
- A completed run with zero entries does not silently emit a header-only file.
- Duplicate concurrent download requests for the same control are prevented
  client-side.

## 6. Zero-write

Official export generation, and the room schedule read path used by the room
program, perform no writes: no run creation, no audit rows, no policy
auto-creation/normalization, no DDL, no cache writes.

## 7. Cross-output parity invariants

1. Every selected-term section cell maps to exactly one compatible teacher row.
2. Every room-bearing section cell maps to exactly one compatible room row.
3. Teacher and room schedules contain no entries absent from the section truth.
4. Summary totals reconcile with section, teacher, and room outputs.
5. T1/T2/T3 are isolated end to end.
6. A five-session weekly subject appears five times in every applicable term.
7. Rotating subject identities appear only in their assigned term.
8. Rotating teacher or room changes propagate to every output.
9. Revision-effective edits appear consistently in every export.
10. Published outputs use the authoritative published revision for the requested
    run identity.
11. Draft/review outputs identify that they are not published.
12. Missing identity, term, run, faculty, room, or source authority fails
    closed.

## 8. Operator decisions (resolved 2026-09-17)

All five previously open decisions are RESOLVED by the operator as of
2026-09-17 and supersede the `DECISION_REQUIRED` entries recorded by the
2026-09-14 stakeholder export parity audit.

- **D-B (room program shape) — RESOLVED.** The §3.3 default is the official v1
  room-program form: one block or sheet per room, bounded to rooms with entries
  in the selected term; header identifies school year, selected term, room, and
  building; columns Time / Minutes / Monday-Friday; each occupied cell shows
  Subject + Section + Teacher unambiguously stacked; configured Lunch and Health
  Break rows render as banded rows; selected-term entries only; no cross-school
  rows; same-term room collisions remain invalid while reuse in different terms
  is valid; the official output is a server-generated printable export, not
  merely an on-screen view or client-generated CSV. No beneficiary-supplied
  room-program form exists; this default remains configurable for future
  beneficiaries.
- **D-C (class-program family) — RESOLVED.** The DNO single-section, day-column
  family is the official v1 Class Program layout. The four observed DNO forms are
  template variants: Grade 7/8 Regular (morning), Grade 7/8 Special Program,
  Grade 9/10 Regular (afternoon), Grade 9/10 Special Program. Each section
  receives its own printable page or bounded worksheet block; "G7, G7-Spec, G9,
  G9-Spec" does NOT mean four sections on one page. All schedulable CLASS rows
  are 45 minutes and the implementation must support Grades 7-10 through the
  applicable morning/afternoon and regular/special template family. The Grade 7
  all-sections section-column layout is NOT required in v1; it is recorded as a
  deferred optional export variant.
- **D-D (period/shift/break/Flag-HGP canonicalization) — RESOLVED, with
  corrections.** Every schedulable CLASS row is 45 minutes. A global "10 periods
  per day" rule must NOT be imposed; the canonical 2026-2027 template families
  are Grades 7-8 Regular 8 CLASS rows, Grades 7-8 Special Program 10 CLASS rows,
  Grades 9-10 Regular 8 CLASS rows, and Grades 9-10 Special Program 10 CLASS
  rows. The canonical persisted break rows are Grades 7-8 Health Break
  09:00-09:15 and Lunch Break 12:15-13:00, and Grades 9-10 Lunch Break
  **11:30-12:15** and Health Break 15:15-15:30. Afternoon-shift sections --
  including the Special Program afternoon block -- take lunch at 11:30-12:15;
  for Grades 9-10 Regular this yields a shift of 11:30-18:30 whose
  `12:15-13:00` interval is the FIRST CLASS row, not a lunch row
  (operator clarification 2026-09-17; corroborated by the Grade 10 Regular
  Section PEARL form `Total minutes per day 420` = 8x45 + 45 + 15, and by the
  Grade 9 STE schedule whose lunch band prints at 11:30-12:15).
  ARAL-Reading rows are OUT OF SCOPE and are never modelled on any grid.
  Reference exemplars for the output families (`stakeholderFiles/`, read-only):
  `grade9STE_Sched.jpg` and `grade10STE_Sched.jpg` (Special Program; `09:45-18:30`;
  10 CLASS rows; lunch band at 11:30-12:15; one 60-minute row printed in error) and
  `GRADE10_REGULAR.jpg` (Regular afternoon; Section PEARL; 8 CLASS rows;
  `Total minutes per day 420`). The legacy 11:55-12:55 lunch window
  and other global recess/lunch fallbacks are NOT authoritative when canonical
  `classProgramSlot` rows exist. The v1 default is the same canonical CLASS-row
  structure Monday-Friday; no Friday-only shortened timetable is implemented for
  SY2026-2027, and historical artifacts showing different Friday total-minute
  arithmetic are superseded unless explicit persisted Friday rows are introduced
  later. Flag Ceremony/HGP is a Monday-only overlay on the underlying
  advisory-period CLASS row: it creates no additional period and no additional
  demand or Teaching Load minutes, Tuesday-Friday retain the underlying ordinary
  subject in that interval, and daily totals must not double-count the overlay.
  The persisted `maxConsecutiveTeachingMinutesBeforeBreak = 120` is retired as
  effective warning authority; the effective primary-beneficiary threshold is the
  period-aligned three-period rule (3 x 45 = 135 minutes), emitted once per
  violating contiguous block rather than once per entry. `classProgramSlot` rows
  define the canonical grade/program time grid and therefore the effective shift
  bounds where no separate `GradeShiftWindow` rows exist. `PolicySpecialEvent`
  authority resolves as follows: use a valid persisted event where one exists;
  where no Flag/HGP event row exists for the pilot configuration, apply the
  defined Monday-only fallback snapped to exactly one underlying canonical CLASS
  row; the fallback must never invent an unmatched interval or a five-day event;
  an explicit non-Monday event, or an event spanning multiple canonical CLASS
  rows, fails closed with a typed configuration blocker. **This fallback is a
  required/successor behavior where not already implemented — the absence of
  `PolicySpecialEvent` rows must not be reported as proof that the behavior
  already exists.** Persisting explicit `GradeShiftWindow` or `PolicySpecialEvent`
  rows is a separate bounded configuration write and is NOT authorized by these
  decisions.
- **D-E (learner counts) — RESOLVED.** Male, Female, and Total remain visibly
  present but blank in every official Class Program export until an authoritative
  learner-count source is integrated. The system shall not derive, estimate, copy
  from historical documents, or emit placeholder numeric values.
- **D-F (class-program slot configuration) — RESOLVED.** Persisted per-school /
  per-year `classProgramSlot` rows are the runtime configuration authority; the
  DNO 2026-2027 catalog (`STAKEHOLDER_DNO_2026_2027_45MIN_R2`) is only the
  default seed used when establishing a new school/year configuration. Once
  persisted rows exist, generation, timetable views, readiness, publication, and
  official exports consume the persisted configuration. There is currently no
  operator route or UI for editing `classProgramSlot` rows; the editing surface
  is deferred to a successor Unified Admin / Scheduling Policy feature that must
  provide preview, validation, actor-school authority, version/fingerprint
  protection, and audited apply. It must not be built in the current
  beneficiary-export wave.

### 8.1 Persisted-state verification (2026-09-17)

The live school 1 / school year 9 configuration already matches D-D: 182
`classProgramSlot` rows across 16 grade x program scopes (Grades 7-10;
REGULAR/STE/SPA/SPS) carrying the canonical 45-minute CLASS rows and the
per-grade break rows above (09:00-09:15 and 12:15-13:00 for Grades 7-8;
12:15-13:00 and 15:15-15:30 for Grades 9-10). `class-template.service.ts`
already encodes `periodsPerDay` 8 for Regular and 10 for Special Program, so no
global period count is imposed. No configuration write is required for the grid
itself.

### 8.2 Known defect against these decisions

The effective break/shift authority does not consume `classProgramSlot`:
`warning-window-authority.service.ts` builds `breakWindows` only from
`resolvePolicyRowBreakWindows` (the persisted `SchedulingPolicy` lunch window;
live value 11:55-12:55 gated by `enableLunchWindow`) and
`resolveSpecialEventBreakWindows` (no live rows), and never reads the canonical
slot grid. That authority feeds `generation-preflight.service.ts`,
`manual-edit.service.ts`, and `pre-generation-draft.service.ts`. Consequence:
the canonical lunch 12:15-13:00 is treated as teachable, the canonical Health
Breaks are invisible, and the retired 11:55-12:55 window is applied. Tracked as
`SLOT-BREAK-AUTHORITY-C11`. The generation input snapshot
(`generation-input-snapshot.service.ts`) also does not yet cover
`classProgramSlot`, so the same correction must extend the consumed-input
fingerprint.

## 9. Non-goals

- No mixed all-term official file, ever.
- No ARAL Program content, row, label, or empty placeholder in any official
  output; Araling Panlipunan (AP) remains the only ARAL-family subject that
  appears, as an ordinary subject.
- No hardcoded beneficiary names/sections/buildings.
- No publication, deployment, or live generation authority is created by this
  contract.
