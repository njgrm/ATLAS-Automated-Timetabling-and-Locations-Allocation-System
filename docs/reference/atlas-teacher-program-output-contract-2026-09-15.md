# ATLAS Teacher Program Output Contract

**Status:** Governing product decision for the next beneficiary-export correction.

**Evidence authority:**

- `D:/ATLAS/stakeholderFiles/Teachers-PROGRAM_SPEC-PROG-AFTERNOON.docx`
- `D:/ATLAS/stakeholderFiles/teacherSched+LoadActual.png`
- SMART reference mirror `D:/smart-final-capstone` at `1bda23399204414f8d21c9fddbdf6b41a8e440d4` (read-only)

## 1. Daily teacher-program semantics

1. The teacher program shall cover the canonical periods in the teacher's configured shift for the selected ordered term.
2. When the teacher has a class in a period, the row shall show the resolved selected-term subject, grade and section, weekday scope, and building/room.
3. When a canonical scheduling-policy event covers the period, the row shall show that event. `Lunch Break` and `Health Break` may appear only at their configured policy intervals.
4. When the teacher has no class and no configured break/event in a canonical shift period, the row shall show `Ancillary Work`.
5. An ordinary free period shall never be relabeled `Health Break`.
6. Equivalent rows across Monday through Friday shall compact to `Monday to Friday`. Day-specific differences shall remain explicit.
7. `Ancillary Work` in the teacher program is a presentation of an unoccupied teacher period. It is not a generated timetable entry, subject, room reservation, demand pair, conflict, violation, or teaching-load credit.

## 2. Teaching-load arithmetic

1. `Actual Teaching Load` shall equal selected-term teaching-session minutes only.
2. `Class Advising Duty` may contribute only through the persisted, effective advisory-credit policy and an actual adviser assignment.
3. `Ancillary Work` shall contribute zero minutes to teaching load, capacity, utilization, overload, redistribution, and `Total Teaching Load`.
4. `Total Teaching Load` shall equal `Actual Teaching Load + authorized Class Advising Duty`.
5. `ARAL Program` shall be absent from all rows, labels, placeholders, credits, subtotals, and totals. `Araling Panlipunan` (AP) remains an ordinary teaching subject.
6. Break minutes shall contribute zero teaching-load minutes.
7. If ancillary responsibilities need separate reporting, they shall be labeled outside the Teaching Load summary and shall carry an explicit zero teaching-load effect.

## 3. Reference-document parity

The generated teacher program shall be a school-agnostic, data-driven reproduction of the cited teacher-program template rather than a generic report. It shall preserve the reference's recognizable structure:

- one-page portrait print target when the canonical row count fits;
- decorative page border and balanced print margins;
- DepEd and school identity/logo header;
- centered government, region, division, district, school, title, and school-year block;
- six-column schedule table: `Time`, `No. of min`, `Subject`, `Grade and section`, `Day`, `Bldg/Room #`;
- full-width merged break bands for configured breaks;
- `Monday to Friday` compaction where truthful;
- actual-teaching-minutes total and applicable Monday HGP/PEACE note;
- load block using the arithmetic in section 2;
- teacher photo and profile rows;
- signature/approval region matching the reference roles and visual hierarchy;
- footer treatment when configured.

The implementation shall not hardcode the beneficiary school's names, people, logos, address lines, or colors. Missing optional identity values shall render as intentional blank signature lines or omitted optional lines, never invented data.

## 4. Editable signatory authority

SMART's useful pattern is the separation between externally synchronized school identity and editable form authority. ATLAS shall implement the equivalent behavior within ATLAS ownership:

1. Privileged Scheduler Officers and IT Admins shall be able to edit the teacher-program signatory names and displayed titles for School Head, PSDS, CID Chief, and ASDS. The exported teacher name shall resolve from the selected teacher and shall not be manually substituted.
2. Signatory configuration shall be actor-school scoped and active-school-year scoped. No school-1 or current-year fallback is permitted.
3. The editor shall use the existing ATLAS shadcn/Radix settings patterns, expose Save/Cancel and validation, and show which school year the values govern.
4. Active-year edits shall update subsequent draft/review exports only after a successful, audited save.
5. Publication shall snapshot the effective export/signatory configuration or bind it by an immutable revision. Published and archived exports shall continue to render the values that were effective for that publication revision even after active-year settings change.
6. Missing signatory names shall render blank signature lines with the configured role titles. The system shall never invent a person's name.
7. Read and write routes shall enforce JWT role, positive actor identity, actor-school equality, and exact school-year scope. Cross-school and stale-revision writes shall fail typed with zero writes.

## 5. Source-of-truth boundaries

- Ordered-term timetable entries remain the sole class-session authority.
- `SchedulingPolicy` and `PolicySpecialEvent` remain the time/shift/break authorities.
- EnrollPro public settings remain the school branding authority where the existing contract provides those fields.
- ATLAS owns teacher-program signatory configuration and its publication snapshot/revision.
- No read/export path may create, normalize, or repair policy or signatory rows.
- A schema/migration source change may be added if no existing typed ATLAS store can satisfy the year-scoped snapshot contract, but applying that migration is a separate HIGH action.

## 6. Release acceptance

Acceptance requires a real generated DOCX, extracted table/text assertions, and a PDF/PNG render comparison against the cited template. HTTP 200, unit-only layout assertions, or a text-only DOCX inspection is insufficient. Live generation, publication, deployment, migration application, and data mutation remain separately gated.

## 7. Implementation classification (C05R1)

Each material statement above is classified below against the C05R1 candidate
(`076b4b2d` base; correction commits `e052a564`, `f1e74b14`, `c7533e4a`,
`0b48b1a1`). Labels: **REQUIREMENT** (binding product contract),
**CURRENT_STATE** (already true at this candidate), **SUCCESSOR** (deferred to a
separately gated lane), **HISTORICAL** (superseded).

| Statement | Class | Evidence |
|---|---|---|
| §1.1–1.4 canonical shift projection: class row / configured event row / `Ancillary Work` | REQUIREMENT — implemented (CURRENT_STATE) | `teacher-program-export.service.ts` `resolveCanonicalIntervals` + per-weekday projection; controls 1–2 |
| §1.5 an ordinary free period is never `Health Break` | CURRENT_STATE | control 2; only configured break/event intervals produce `BREAK` rows |
| §1.6 `Monday to Friday` compaction, day exceptions explicit | CURRENT_STATE | control 3; `compactDayLabel` |
| §1.7 `Ancillary Work` is presentation-only, never persisted | CURRENT_STATE | `presentationOnly: true`, `source: EXPORT_PROJECTION`; zero-write control 9 |
| §2.1 `Actual Teaching Load` = teaching-session minutes only | CURRENT_STATE | control 4; ARAL/HG/reference-only filtered before the sum |
| §2.2 adviser credit needs the persisted policy + a real adviser assignment | CURRENT_STATE | control 6; `SchedulingPolicy.advisoryCreditMinutes` gated on `isClassAdviser` + advised section |
| §2.3 ancillary contributes zero to load/capacity/utilisation/overload/redistribution | CURRENT_STATE | controls 4 (+ ancillary-in-total mutant fails) |
| §2.4 `Total Teaching Load` = actual teaching + authorised adviser credit | CURRENT_STATE | controls 4, 11 |
| §2.5 `ARAL Program` absent everywhere; AP ordinary | CURRENT_STATE | controls 4, 5, 11 |
| §2.6 break minutes contribute zero | CURRENT_STATE | control 4 |
| §3 template parity (border/header/title/table/merged bands/compaction/load/profile/signatures/footer) | REQUIREMENT — implemented (CURRENT_STATE) | control 12 render checklist; 1-page render (control 13) |
| §3.1 one-page portrait when the canonical row count fits | CURRENT_STATE | generated fixture = 1 page; template = 1 page |
| Region/division/district identity lines and DepEd/school logo images | SUCCESSOR | no persisted ATLAS source; omitted/placeholder per §3.8 (never invented). Needs the EnrollPro branding contract |
| §2.5 vs the scanned template's `ARAL Program 0 min` row | HISTORICAL (template detail superseded) | the binding contract removes ARAL; the generated form omits the row |
| §2 load block totals convention | REQUIREMENT — clarified | the form states the **per-day** teaching figure (`225 mins` for five 45-minute sessions), not the weekly sum; `perDayTeachingMinutes` / `perDayTotalTeachingLoad` render the totals row and load block (`0b48b1a1`) |
| §4.1 editable School Head/PSDS/CID Chief/ASDS names + titles; teacher from the selected teacher | CURRENT_STATE | `export-presentation.service.ts` + `ExportPresentationSettingsDialog.tsx`; controls 8, 10 |
| §4.2 actor-school + active-year scoped, no school-1/current-year fallback | CURRENT_STATE | `assertActiveSchoolYear`; mounted matrix (control 8) |
| §4.3 shadcn/Radix editor reachable from the export flow | CURRENT_STATE | download-menu entry + dialog; client suite |
| §4.4 active-year edits affect subsequent draft/review exports after an audited save | CURRENT_STATE | control 8 (one audit on committed change; zero-write replay) |
| §4.5 publication binds an immutable revision | CURRENT_STATE (by revision, not JSON snapshot) | `readSignatoryProfileAsOfPublication`: published/archived exports resolve the append-only revision effective at `publishedAt`; control 10 |
| §4.6 missing names render blank lines, never invented people | CURRENT_STATE | blank-signature control |
| §4.7 JWT role, positive actor, actor-school equality, exact year scope; stale writes fail typed | CURRENT_STATE | mounted matrix (401/403/cross-school/stale 409/validation 400) |
| §5 ordered-term timetable entries remain the sole class-session authority | CURRENT_STATE | projection consumes resolved selected-term entries only; control 7 |
| §5 `SchedulingPolicy`/`PolicySpecialEvent` remain the time/break authority | CURRENT_STATE | `resolveCanonicalIntervals` |
| §5 EnrollPro public settings remain the branding authority | CURRENT_STATE | `branding.schoolName` from the persisted school |
| §5 ATLAS owns signatory configuration + its publication revision | CURRENT_STATE | new `TeacherProgramPresentationRevision` store |
| §5 no read/export creates/normalises/repairs policy or signatory rows | CURRENT_STATE | instrumented zero-write export + zero-write read/preview |
| §5 a schema/migration source may be added; applying it is a separate HIGH action | REQUIREMENT — source added, NOT applied | `prisma/migrations/0003_teacher_program_presentation/migration.sql`; disposable-PG proof only |
| §6 real DOCX + extracted assertions + render comparison | CURRENT_STATE | control 11 extraction suite + control 12 render checklist |
