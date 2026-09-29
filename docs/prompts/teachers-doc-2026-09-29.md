# teachers.docx (schedulers' team, 2026-09-29 evening): Teachers page — status and owners

Issued by Lane C, 18:50. Source: `D:/ATLAS/teachers.docx` (6 items, 9 screenshots of live `e75d6b8f`). Checked by Lane C
(code) and Codex (live, read-only; `ux-audit.js` on page, Profile, Review load, row menu). Codex report:
scratchpad `codex-qa/teachers-doc/report.md`.

| # | Request | Status | Owner |
|---|---|---|---|
| 1 | Header button "Create temporary teacher (Teacher X)", no running number | On main `e54e649f`, train 10 | — (verify in train 10 walk) |
| 2 | "Above weekly max" hover text cut off | On main `e54e649f` (shared tooltip wraps), train 10. Its text hard-codes "40h" (`Faculty.tsx:705`) | A3 c17: read the saved maximum |
| 3 | Weekly load hover text cut off | On main `e54e649f`, train 10 | — (verify) |
| 4 | Every Teachers dialog resizable, centred | On main `e54e649f` (Profile, Review load, Create/Edit temporary), train 10. Live Review load is fixed-width | — (verify by dragging both handles on Review load and Profile) |
| 5 | Profile: one box per subject, inside it one colour-coded box per grade with that grade's sections side by side, wrapping | NOT STARTED (`FacultyProfileSheet.tsx:300-338` lists one section per line) | **A3 c17** |
| 6 | Row 3-dots menu items wrap to two lines | NOT STARTED: `AdminDataTable.tsx:176` fixes the menu at `w-52` (208px) for every roster | **A5 c8 addendum** |

## A5 c8 addendum (item 6)
`components/admin-workspace/AdminDataTable.tsx:176` `DropdownMenuContent className="w-52"`: menus fit their longest item on one
line (`w-max min-w-52 max-w-[min(28rem,90vw)]`, items `whitespace-nowrap`), keep collision padding. Every roster's row
menu, not just Teachers. Proof: Teachers row menu on a to-be-hired teacher at 1366, both items one line, audit clean.

## A3 c17 — Teachers profile and to-be-hired identity (after A3 c16; merge origin/main first, A6 c10 edits the same dialog: keep its permission block)
1. **Profile grouping (item 5):** "Assigned subjects and sections" becomes: one card per subject (name, not code); inside it
   one box per grade (resolved grade 7-10 via A2 c15's helper, never displayOrder/id), grade colour kept; that grade's
   sections as chips in a `flex-wrap` row. Example: MAPEH → (Grade 7: Aguinaldo · Bonifacio · Luna · Mabini · Rizal)
   (Grade 8: Maka-Diyos · Makakalikasan · Makatao).
2. **Hours that add up:** the subject badge shows `fs.subject.minMinutesPerWeek` (one section's weekly minutes, "3.8h")
   beside a 30/30h teacher. Show the subject total for this teacher ("8 classes · 30h a week") and, if useful, "3.8h each".
3. **To-be-hired header:** for `isPlaceholder`, no "#ID-PENDING" and no "Active teacher": say "To be hired" (plain
   words, same badge style as the roster's Temporary chip). For real teachers with no employee ID, show nothing, not a code.
4. **To-be-hired names:** live placeholders render "— TO BE HIRED, MAPEH", "1 — TO BE HIRED, TEACHER" (Last, First of
   stored names). Display only (never rewrite data): `formatFacultyDisplayName` for `isPlaceholder` renders
   "To be hired: MAPEH" / "To be hired: Teacher 1" everywhere the formatter is used (Teachers, Teaching Load, Timetable).
5. **Item 2 text:** "Above weekly max" helper reads the saved weekly maximum, not a literal "40h".
6. Profile text under 14px (`text-[0.7rem]`, `text-[0.65rem]` uppercase micro-labels): sentence case, `text-xs` or larger
   (A7 c8 sets the scale; do not re-add small sizes).
Proof: real staging data at 1366x768, screenshots of Profile for a real teacher and a to-be-hired teacher, Teachers roster,
Teaching Load teacher view; `ux-audit.js` with the Profile open: 0 MAJOR; `npm run test:encoding` green. Commit and push wip
every 30 min; handoff with before/after on-screen words per row.
