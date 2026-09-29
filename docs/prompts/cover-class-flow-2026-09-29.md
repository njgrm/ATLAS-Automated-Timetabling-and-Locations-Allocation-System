# Cover a class: real teachers first, other departments by the scheduler's choice, to-be-hired last

Issued by Lane C, 15:50. Owners: **A8 c4 (server)** after A8 c3 lands; **A6 c10 (client)** after A6 c9r lands. Risk
MEDIUM (A8 adds one write route; no migration: `cross_department_permissions` and
`faculty_mirrors.can_teach_outside_department` already exist). Target: train 10 if ready, else train 11 (demo morning).
Real staging data (`/__dev/staging-login`), 1366x768 browser proof, clickable must look clickable.

## Operator direction (15:45, verbatim intent)
"The cover teachers UX/UI components look awful. We haven't considered allowing teachers from other departments or
allowing anyone else to teach a subject; those controls must be enabled — there was something like that before. The
workflow and controls must be smooth. Our fallback shouldn't immediately go to placeholder teachers; that should be an
absolute last resort, when there are no identifiable teachers that can cover a class based on the scheduler's decision."

## Facts (Lane C, live e75d6b8f)
- `CrossDepartmentPermission` (per teacher x subject) is READ by qualification-evaluator, teaching-load automation,
  carry-forward, reconciliation and the suggestion proposal, but **nothing in the server or client can create or delete
  one**. Live: 0 permissions; 0 real teachers with `canTeachOutsideDepartment`.
- `canTeachOutsideDepartment` is settable only via `faculty.router.ts` create/update, and the only UI is the Create
  temporary teacher dialog (`CreatePlaceholderDialog.tsx:75,121`).
- The live cover job (Codex, 15:30, operator-approved, KEPT for now) put all 50 open classes on 14 "to be hired"
  placeholders and moved 22 classes off 4 over-cap teachers. The new flow must make replacing them with real teachers
  easy (each placeholder's classes are "open" for this flow).
- Codex UX audit of today's cover surfaces: `docs/reviews/codex-live-cover-ux-e75d6b8f.md` (fold its defects in).

## A8 c4 — server
1. `POST/DELETE /api/v1/faculty/:facultyId/subject-permissions` `{schoolId, subjectId}` -> upsert/delete
   `CrossDepartmentPermission`; officer-only; audit-logged; idempotent. `PATCH` teacher `canTeachOutsideDepartment`
   for real teachers too (it exists: prove it, add a test).
2. `GET /api/v1/teaching-load/:schoolId/:schoolYearId/cover-candidates?subjectId&sectionId` -> ranked list, each with
   `{facultyId, name, department, tier, hoursNow, hoursAfter, cap, overCapAfter, reason}` where tier is
   `QUALIFIED` (qualified, has room) > `OTHER_DEPARTMENT` (has room; permission exists or can be granted) > `ANYONE`
   (has room) > never placeholders. Placeholders are not candidates.
3. The suggestion proposal and "Suggest assignments" must never propose a placeholder while any QUALIFIED or
   already-permitted OTHER_DEPARTMENT teacher has room; placeholders only when explicitly requested.
4. Assigning an OTHER_DEPARTMENT/ANYONE teacher without a permission returns a typed 409 `NEEDS_PERMISSION` (the client
   asks, then retries with `grantPermission: true` which writes the permission and the ownership in one transaction).
5. Tests: tiers, cap maths, 409 + grant path, no placeholder when real teachers have room.

## A6 c10 — client: one "Cover this class" window
- Opened from every place a class is open (staffing figure list, Sections view "Assign teacher", a placeholder's class).
- Header: "Grade 8 – Rizal · MAPEH · 4 h/week". Three plain groups: **Teachers for MAPEH** (qualified), **Teachers from
  other departments** (shows "Science dept"), **Anyone with free hours**. Each row: name, dept, "18 h → 22 h of 30 h",
  one outline **Assign** button. Over-cap rows are shown greyed with the reason, not hidden.
- Choosing an other-department teacher asks once: "Allow Maria Reyes to teach MAPEH? She is in Science." [Allow and
  assign] [Cancel]. Afterwards she appears under "Teachers for MAPEH (allowed)".
- Bottom, visually last and quiet: "No one can take this class?  Add a to-be-hired teacher" (secondary link-button).
- Teachers page: a clear switch "Can teach outside their department" on a teacher's detail, and a "Subjects they may
  also teach" list with remove.
- Replacing a placeholder: the placeholder's card says "To be hired — 8 classes. Give them to real teachers ›" which
  opens the same window per class.
- Subtract: remove the old cover/outage dialog pieces the audit rejects; one look for every Assign button.
- Proof: cover 3 open classes on staging with (1) a qualified teacher, (2) an other-department teacher via the Allow
  prompt, (3) a to-be-hired only after declining; screenshots at 1366x768.

## Addendum 16:05 — Codex audit landed (REJECT_UX), binding additions
Read `docs/reviews/codex-live-cover-ux-e75d6b8f.md` (screens in Lane C scratchpad). Must-fix in c10 (A6) / c4 (A8):
- **Placeholders are counted as staffed** in Sections ("Needs staffing" shows 0 while the header says 72) and Subjects
  ("Full coverage", "MISSING COVERAGE 0"). A placeholder-owned class is OPEN everywhere: filter, counts, coverage.
- The existing "Cross-subject" switch on /teaching-load is an unlabeled filter, not a permission: either retire it or
  label it "Include teachers from other departments"; the permission itself lives in the Cover window + teacher profile.
- Teachers roster: real teachers first; placeholders in a collapsed "To be hired — last resort (14)" group at the end;
  "Review temporary" only on placeholders.
- "Review load" opens THAT teacher's load (the staff-wide audit is a separate "View all teachers" link) — reconcile with
  A6 c9's 38.1 work.
- "UNASSIGN ALL / UNASSIGN GRADE" move behind a "More" menu with confirmation.
- Suggest-assignments review: one reconciled count; no Apply while checking; one Close.
- Subjects "Review coverage" and the teacher profile edit the same permission list.

## Addendum 16:27 — A6 does the c9 follow-up FIRST, as its own small push to main (before any cover-flow work)
A6 c9r landed the staffing figure but left (its own handoff): (1) the header still says the saved-roster fact twice
("These numbers come from the last saved roster, not the current one." + "From the saved roster (29 Sept)") - delete the
sentence, keep at most the one grey line, re-pin the ~6 rows on purpose and give `A6C9-3` a page-subtree scope; (2) the
15:55 addendum: "+N more short subjects — Open the coverage detail" must open the who-needs-a-teacher window, not switch
tab; (3) the "Temporary substitutes" chip renders a `<span>` whose onClick is dropped - make it a real button or plain
text (clickable must look clickable); (4) fix-1.2 16.2 card order. Push (1)-(3) to main by 17:30 for train 10, then (4),
then the cover flow.

## Addendum 16:58 — build the cover window on the UI foundation
A6: do the c9 follow-up first (16:27 addendum). Build the Cover window only with the shared components as they stand after A7 c8's type slice and A5 c8's filter bar/select (`docs/prompts/ui-foundation-2026-09-29.md`); 14px minimum text, no truncation, ux-audit.js clean.
