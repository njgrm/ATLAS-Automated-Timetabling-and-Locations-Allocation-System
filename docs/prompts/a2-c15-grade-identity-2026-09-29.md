# A2 c15 — a grade is 7-10, never EnrollPro's gradeLevelId (HIGH)

Issued by Lane C, 17:05. Start now. Risk HIGH (generation input, published schedule, exports). One atlas-reviewer-high
pass. Target: train 10 if QA passes by ~18:30, else the first morning train. Real staging data.

## Evidence
- Operator screenshot, live e75d6b8f, Teachers > Review load (FERNANDEZ, JANELLA MARIE): classes LUNA/RIZAL show
  **GR1**, MAKATAO/ORCHID **GR2**. Our school is JHS: grades 7-10 only.
- Live DB `section_mirrors` (Lane C, read-only): `grade_level_id` is an opaque EnrollPro id. S.Y. ids 1 and 2 use
  1..4 for "Grade 7".."Grade 10"; S.Y. ids 8-10 used 17..20. `grade_level_name` is always "Grade 7".."Grade 10".
- Code on main that treats the id as the grade (non-exhaustive — find them all):
  `atlas-client/src/components/faculty/teacherWorkloadProfile.ts:73` (`gradeLevel: section.gradeLevelId ?? 0`),
  `atlas-server/src/services/locked-session.service.ts:48`, `pre-generation-draft.service.ts:424,739,947`,
  `published-identity-snapshot.service.ts:660`, `published-schedule.service.ts:709`, `workbook-export.service.ts:291`
  (check), and any `displayOrder ?? gradeLevelId` fallback. `teaching-load-carry-forward.service.ts`
  `resolveCarryForwardGrade(id, name)` shows the intended approach.

## Do
1. One server helper `gradeNumberOf({gradeLevelName, displayOrder, gradeLevelId})` -> 7..12 parsed from the name
   (then displayOrder only if it is 7..12), never the id; one client twin. Replace every site; grep proves none remain
   (`gradeLevelId ??`, `gradeLevel: *.gradeLevelId`, `GR${...Id}`).
2. Find the consequences: grade time windows, grade-scoped rules, room/grade preferences, generation input, published
   snapshots, exports — anything keyed by grade number that received 1..4. State for each whether live output was
   wrong and since when.
3. Tests with ids 1..4 AND 17..20 both producing 7..10; a negative control (id 1 must never render "GR1" / Grade 1).
4. Badge text: "Grade 7" (or "G7"), never "GR1"; 14px minimum (UI foundation).
5. Proof on staging: Teachers > Review load, Profile, Teaching Load, Sections, Class Schedule readiness; ux-audit.js JSON.
