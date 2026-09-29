# A3 c17 — Teachers profile grouping, hours, to-be-hired identity, saved weekly maximum, 14px floor

Authority: `docs/prompts/teachers-doc-2026-09-29.md` §"A3 c17" (rows 1-6) + Addendum 20:10 (row 7).
Tier: MEDIUM (production UI wiring on two shared surfaces). Delegated to `atlas-executor`.

- Worktree (the ONLY one you may write): `E:/ATLAS-worktrees/lane-a3-c17-teachers-profile`
- Branch: `work/a3-c17-teachers-profile`
- Base: `7110b031` (current `origin/main` tip at packet authoring; confirm with `git rev-parse HEAD` before editing)
- One writer: you. The planner does not edit these files.

## Files you own (only these)

- `atlas-client/src/components/faculty/FacultyProfileSheet.tsx`
- `atlas-client/src/components/faculty/teacherNameDisplay.ts`
- `atlas-client/src/pages/Faculty.tsx` (row 5 only: the `over-cap` attention chip's `helper` string)
- `atlas-client/src/components/faculty/FacultyWorkloadModal.tsx` (row 7 only: the width cap)

Do NOT edit `atlas-client/src/ui/dialog.tsx`, `GradeBadge.tsx`, `GradeLevelBadge.tsx`,
`AdminDataTable.tsx` (A5 c8 owns item 6), or anything under `faculty-assignments/`
(A6 c10 owns the cover-flow work in that directory).

## A6 c10 custody — read this before your first edit

A6 c10 (`work/a6-c10-cover-flow`, tip `6c88e95a`) is concurrently editing
`FacultyProfileSheet.tsx` to add a subject-permission block (`TeacherSubjectPermissions`,
`useSubjectPermissions`, `useSchoolSubjects`, and the `permissions` / `schoolId` /
`writeBlockedReason` / `onPermissionsChanged` props). It is NOT on `main` yet.

- Do not delete, move or rename any import, prop or block you did not add.
- Do not reformat the props interface or the import list wholesale — a whole-list
  reformat makes the eventual union conflict needlessly. Add lines; do not rewrite.
- If `git fetch` brings A6 c10 into `origin/main` while you work, run
  `git fetch origin && git merge origin/main`, and if the merge conflicts in this
  file, resolve by keeping BOTH the permission block and your own edits, then
  `git commit` and say so in your handoff. Never choose "ours" wholesale.

## The seven rows

### Row 1 — Profile grouping (packet item 5)

"Assigned subjects and sections" becomes, per assignment (`fs` in `faculty.assignments`):

- ONE card per subject, headed by the subject NAME (`fs.subject.name`). Drop the
  separate `<code>` line that renders `fs.subject.code`; the packet asks for the
  name, not the code, and one readable label is calmer than two.
- Inside the card, group that subject's sections by GRADE: one box per grade, each
  box keeping its DepEd grade colour (G7 green, G8 yellow, G9 red, G10 blue) via
  the EXISTING `GradeBadge` / `GradeLevelBadge` pair. Do not add a colour map.
- The sections of one grade sit side by side and wrap: a `flex flex-wrap gap-*`
  row of small section-name chips, not one section per line.
- GRADE RESOLUTION IS AUTHORITY, NOT A FIELD. Use
  `resolveSectionGradeNumber` from `@/lib/schedule-review-helpers` (A2 c15's
  authority; on `main` it is exported under that name and reads
  `gradeLevelName` first, then a real `displayOrder`).
  NEVER pass `sec.gradeLevelId`, and never pass a bare `sec.displayOrder` as
  your own inline expression — that is the defect this row exists to remove
  (EnrollPro re-mints `grade_level_id`; reading it as a grade rendered `GR1`).
- If a section's grade cannot be resolved, group it under a neutral
  "Grade not set" group with NO fabricated grade number and no `GradeBadge`.
  Never render a number you did not resolve.
- Sort grades ascending 7, then 8, 9, 10, then the unresolvable group last.

### Row 2 — Hours that add up

Per subject card, beside the `fs.subject.minMinutesPerWeek` badge that is already
there ("3.8h"), also state the subject's TOTAL for this teacher, so the numbers a
scheduler reads add up:

- "8 classes · 30h a week" — the class count is `fs.sections.length`; the total is
  `fs.sections.length * fs.subject.minMinutesPerWeek` rendered in hours at the same
  one-decimal precision the badge already uses
  (`Math.round((minutes / 60) * 10) / 10`).
- "3.8h each" when more than one section exists in that subject.
- One line, sentence case, `text-sm` or larger. Compute it with the SAME rounding
  expression the badge uses, in one local helper, so the badge and the total can
  never disagree.

### Row 3 — To-be-hired header

In the `DialogHeader`:

- When `faculty.isPlaceholder`: no `#ID-PENDING` `<code>` chip, and no
  "Active teacher" text. Render one badge reading "To be hired", in the SAME badge
  style as the roster's Temporary chip (find it in `FacultyRow.tsx` and copy that
  class string — do not invent a second "to be hired" look).
- When a REAL teacher has no `employeeId`: render NOTHING there. Not an empty
  `<code>`, not a dash, not `ID-PENDING`.
- A real teacher with an `employeeId` keeps today's `#<id>` chip.
- "Excluded from scheduling" and `sourceFreshness` keep working unchanged.

### Row 4 — To-be-hired names

Live placeholders currently render as "— TO BE HIRED, MAPEH" and
"1 — TO BE HIRED, TEACHER". Display only — never rewrite stored data.

- `formatFacultyDisplayName`, when the faculty is a placeholder, returns
  "To be hired: MAPEH" / "To be hired: Teacher 1" — derived from the stored
  `Last, First` via the existing formatter, with a leading numeric token and a
  leading em-dash stripped from the stored string before it is used.
- It must apply EVERYWHERE the formatter is used (Teachers roster, profile,
  Teaching Load, Timetable) because they all call this one function. That is the
  point of the row.
- The stored-name contract is untouched: `formatFacultyStoredName` and
  `teacherNameSortKey` keep returning the stored casing so search and sort are
  unaffected, and no write path changes.
- `isPlaceholder` is not on the current `NameLike` type. Widen the input type to
  include it (optional boolean) rather than adding a second formatter; every
  existing call site keeps compiling unchanged.
- `formatFacultyInitials` must still return letters, not "To be hired: …" — a
  placeholder's avatar must not overflow its circle. Give it the stripped token
  only.

### Row 5 — Item 2 text: read the saved weekly maximum

`atlas-client/src/pages/Faculty.tsx`, the `over-cap` attention chip's `helper`
string currently hard-codes "40h" (`'Active teachers above the 40h weekly maximum. Move classes before generating.'`).

- It must state the SAVED maximum, not a literal. Derive it from the loaded
  roster: the maximum `maxHoursPerWeek` among the teachers the chip is counting
  (the active, non-placeholder teachers with `policyCreditedHours > maxHoursPerWeek`),
  falling back to the roster-wide maximum, then to `MAX_WEEKLY_TEACHING_HOURS`
  from `@/lib/faculty-assignment-helpers` when the roster is empty.
- Say it in plain words and keep it one sentence. Do NOT change the chip's
  `label` ("Above weekly max") or its `count` semantics — the `count` is the
  generation-blocking number and other tests assert it.
- A teacher on a non-default maximum must make the helper read that number. That
  is the acceptance point, not "the code no longer contains the digit 40".

### Row 6 — No text under 14px in the Profile dialog

Every `text-[0.7rem]` and `text-[0.65rem]` in `FacultyProfileSheet.tsx` (the
uppercase micro-labels: "Roster identity", "Department", "Status", "Subjects",
"Sections", "Adviser and source context", the adviser badge, the status/active
line, the review link) must become `text-sm` (14px) or larger, in SENTENCE case,
not `uppercase tracking-widest` shouting.

- A7 c8 sets the type scale. Do not re-add a small size anywhere.
- Do not add visible words, chips or lines to a region to make room. SUBTRACT:
  the freed space comes from deleting the uppercase/tracking treatment, not from
  adding helper text. Remove anything that no longer earns its place.
- The 1.9:1 rule in AGENTS.md still binds: keep the dialog's content inside its
  `flex-1 min-h-0 overflow-y-auto` body. One scroll region, never a page scrollbar.

### Row 7 (Addendum 20:10) — Review load dialog does not resize

`FacultyWorkloadModal.tsx:116` passes `resizable` to the shared `DialogContent`,
so the primitive's drag handles ARE rendered — but the same line passes
`sm:max-w-2xl`, and `max-width` beats the drag handler's inline `style.width`. A
drag therefore clamps at 672px, and a leftward drag appears to do nothing.

- Remove the page-local width cap so the SHARED primitive's own
  `DIALOG_RESIZABLE_CLASSES` bounds (`min-w-[min(480px,95vw)] max-w-[95vw]`)
  govern. Do not add a local `style` width, a local resize class or a local grip.
- Keep this surface's own `max-h-[85svh]`, `overflow-hidden flex flex-col p-0`.
- Do not change `dialog.tsx` (A7 c8 / A5 own the primitive).

## What you must produce

1. Source edits in the four owned files.
2. A focused client test suite for the seven rows, reachable from a committed
   `atlas-client/package.json` script in the SAME commit (add e.g.
   `test:a3-c17-teacher-profile`). It must assert behaviour, not source text:
   - grouping: two grades of the same subject render as two grade boxes whose
     section names are all present, and a section with a junk `gradeLevelId`
     renders no `GR1` (negative control);
   - hours: the subject total equals sections × `minMinutesPerWeek` and the
     "each" figure appears only for >1 section;
   - header: a placeholder shows "To be hired" and no `ID-PENDING` and no
     "Active teacher"; a real teacher with no `employeeId` shows neither the
     code chip nor "To be hired";
   - names: `formatFacultyDisplayName` returns "To be hired: …" for a placeholder
     and `formatFacultyStoredName` / `teacherNameSortKey` still return the stored
     casing (search/sort safety), and initials stay short;
   - item 2: with a roster whose saved maximum is 32, the helper text contains
     "32" and not "40h";
   - 14px floor: no `text-[0.7rem]` / `text-[0.65rem]` class remains in the
     profile file, and no element under it carries a sub-14px size;
   - row 7: the workload modal's className carries no `max-w-` cap of its own, so
     the shared bounds govern.
   No assertion may be deleted or weakened to make a row pass. Add, never subtract.
3. `npm run test:encoding` green, and the new suite green, from the repo root /
   `atlas-client` in this worktree. `npx tsc --noEmit` clean for the client.
4. A `wip(a3-c17): …` commit and `git push -u origin work/a3-c17-teachers-profile`
   at least every 30 minutes and before any long step. Never leave the work
   uncommitted.

## NOT in your scope

Browser proof, the staging preview, `ux-audit.js` runs and the 1366x768
screenshots are the PLANNER's, on a serial browser. Do not start a server, a
preview or a browser. Do not run a full `npm run build`, a full suite, or any
DB-writing test. Do not touch `main`, do not push to `main`, do not deploy.

## Handoff (one page)

Base SHA · candidate SHA · exact changed paths · per row: the before and after
on-screen words · the commands you actually ran with their results · risks marked
`BLOCKING` / `NON_BLOCKING` · verdict. Then return `REVIEW_REQUIRED` with the
candidate SHA.
