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
