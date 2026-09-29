# A6-TL-DEEPLINK — every entry into Teaching Load lands ON its target

Base: `34cb6b31` (`origin/main`, 2026-09-30)
Worktree: `E:/ATLAS-worktrees/lane-a6-tl-deeplink`
Branch: `work/a6-tl-deeplink-20260930`
Owner: `atlas-executor-ds` (single writer). Planner: A6. QA: fresh `atlas-qa-ds`.
Tier: **MEDIUM** — client-only, user-facing navigation/focus behaviour. No server, no DB, no deploy, no migration. No HIGH action is unlocked by this packet.

## 1. The defect (Lane C, operator-confirmed in source)

Every link into Teaching Load from Sections, Teachers and Subjects, and every in-page repair-queue
button, only *navigates*. The named target (teacher / section / subject) is never selected, scrolled
into view, focused, or opened once the data arrives. Root causes visible in source:

1. **Load-order loss.** `useTeachingLoadRouteIntent.ts` applies the intent **once on mount** and marks
   it applied (`intentAppliedRef`). At that instant the faculty list is empty, so
   `useTeachingLoadData.ts:727-735` sets `selectedId` to `null` (empty list) and then to `faculty[0]`.
   The intent is never re-applied. `TeachingLoad.tsx:127-137` also calls `resetForScope()` when
   `data.scopeKey` resolves, clearing the section/subject selection the intent had set.
2. **Later URL changes re-fire the intent.** The applied flag resets whenever `locationKey`
   (`searchParams.toString()`) changes, so any URL rewrite after arrival (repair-queue routing, a
   teacher click that pushes params) re-applies `setSelectedId(entryFacultyId)` after the operator
   changed selection — the "I edited another teacher and it did not save" symptom. The URL intent is
   never **consumed**.
3. **`subjectId`-only intent is dropped.** `DeleteSubjectDialog.tsx:275` links
   `/teaching-load?subjectId=N`. `parseRouteIntent` returns `viewMode: null` for it (no
   view/facultyId/sectionId/task), and the apply effect bails on
   `!intent.viewMode && !intent.facultyId && !intent.sectionId && !intent.task` — the subject is
   ignored.
4. **`filter=missing-coverage` is never read.** `SubjectCoverageSheet.tsx:303,327,357` (and
   `Dashboard.tsx:277,564`, `Audit.tsx:501`) emit `/teaching-load?view=subjects&subjectId=N&filter=missing-coverage`.
   Teaching Load reads no `filter` parameter, so the list is not narrowed to the uncovered sections.
5. **In-page repair-queue buttons do nothing visible.** `useTeachingLoadRepairQueue.ts:506-535`
   (`handleRepairPrimaryAction` / `handleSelectRepairItem`) sets `activeRepairId`, rewrites the URL
   and calls `onSelectFaculty` — no open, scroll or focus. The next-teacher step behaves the same.

## 2. The ONE rule (both entry paths)

For every entry that names a target — a URL deep link **or** an in-page repair-queue button /
next-teacher step — **once the data has loaded**:

- **(R-a) Select** the named teacher / section / subject.
- **(R-b) Scroll** the target row into view (`scrollIntoView` on the target row element).
- **(R-c) Focus** the target row (it becomes `document.activeElement`).
- **(R-d) Open** — for an Assign entry (`teacher-missing-load` / "Assign teaching load", and any
  `task=review`/`task=missing-load` that assigns load), the assign editor for that teacher is **open**.
- **(R-e) Consume** — after it is applied, the URL intent is consumed: it **must not** re-apply on any
  later render or URL changeLocation; a later operator selection is never overridden by the entry
  target.
- **(R-f) Then editable** — after arrival, **any** teacher/section can be selected, edited and saved;
  Save issues the PUT for the teacher actually edited, not the entry target.

Both paths use the same mechanism, not two. The intent stays **pending until data has loaded**, is
applied exactly once against the loaded lists, then is consumed.

## 3. Entry table — every entry gets a rendered test row

| # | Entry (source) | URL / action | Target that must be reached |
|---|---|---|---|
| E1 | Sections row / details / mobile card — `SectionRow.tsx:333`, `SectionDetailsSheet.tsx:334`, `SectionMobileCard.tsx:146` | `/teaching-load?sectionId=N` | section N selected, scrolled, focused |
| E2 | Teacher profile — `FacultyProfileSheet.tsx:231` | `/teaching-load?facultyId=N` | teacher N selected, scrolled, focused |
| E3 | Teacher workload modal — `FacultyWorkloadModal.tsx:100` | `/teaching-load?facultyId=N&task=review` | teacher N selected, scrolled, focused (Assign editor open) |
| E4 | Subjects → Delete subject dialog — `DeleteSubjectDialog.tsx:275` | `/teaching-load?subjectId=N` | subject N focus applied and in view (today: ignored) |
| E5 | Subject coverage — `SubjectCoverageSheet.tsx:303,327,357`; `Dashboard.tsx:277,564`; `Audit.tsx:501` | `/teaching-load?view=subjects&subjectId=N&filter=missing-coverage` | coverage view narrowed to the **uncovered** sections for subject N (today: `filter` ignored) |
| E6 | Class Schedule blocker — `TimetableSimpleHeader.tsx:148-156` | `/teaching-load?facultyId&sectionId&subjectId&task=missing-load` | class in view + its teacher (today: load-order loss) |
| E7 | Class Schedule owner repair — `ScheduleReviewWorkspace.tsx:498-511` | `/teaching-load?facultyId&sectionId&subjectId&task=change-owner&returnTo=…` | class + its own teacher in view — **PARTIAL 2026-09-30 (R1/F2):** the class's own teacher is landed and proven; the class itself is **excluded**, not claimed, because `change-owner` resolves to teacher mode (contract pinned by `useTeachingLoadRouteIntent-change-owner-a2.test.ts` R1/R2) and teacher mode renders no section row. The link's `sectionId`/`subjectId` are preserved on the landing target and applied to `ui.selectedSectionId`/`selectedSubjectId`, but not visible in teacher mode. |
| E8 | Audit findings — `Audit.tsx:460,471,482,501` | `/teaching-load?facultyId&subjectId`, `?subjectId`, `?facultyId`, `?sectionId&subjectId` | each named target reached |
| E9 | In-page repair queue — `useTeachingLoadRepairQueue.ts:506-535` (`Assign teaching load` / `Move classes` / `Review temporary` primary button, item select, next-teacher step) | button click | teacher selected, scrolled, focused; Assign opens the editor |

**Known asymmetry (F3, 2026-09-30, recorded not unified).** The URL path derives its
landing target through `parseRouteIntent`, so a teacher deep link carries
`viewMode:'teacher'`; the in-page repair path normalizes `viewMode:null`. Their
consumed keys therefore differ (`teacher:9:-:-:-` vs `-:9:-:-:-`). That is
deliberate — a URL entry and an in-page entry are separately consumable events —
so the two paths are left as they are rather than unified into one key, which
would let one path silently suppress the other. F1's `?facultyId=9&task=review`
control stays inside the URL path, where both the mount and the rewrite parse at
`viewMode:'teacher'` and the same key.

## 4. Tests (write them first; rendered, one row per entry)

New file: `atlas-client/src/components/faculty-assignments/__tests__/a6-tl-deeplink.test.tsx`.

- **Rendered**: mount the REAL `TeachingLoad` page with `react-dom/client` + `jsdom` + `act` and a
  `MemoryRouter initialEntries:[<the entry URL>]`, stubbing ONLY the transport (`@/lib/api`) — the
  harness shape in `src/components/__tests__/a3-c14-year-setup-calm.test.tsx` (mount + `flush()` +
  `teardown()`), including `scrollIntoView`/`focus` spies. The mocked API must return a real-shape
  fixture for the Teaching Load reads (actor school, ordered active year/term, faculty list with
  assignments, sections, subjects, `faculty-assignments/*`, generation runs).
- **Table-driven**: one row per entry in §3 (E1–E9), plus cross-cutting rows:
  - **X1 intent consumed**: after E2/E3 arrives, change the selection to another teacher; assert the
    entry target is NOT re-applied (selection stays on the new teacher) across a subsequent render
    and a URL rewrite.
  - **X2 edit-another-then-save**: arrive via E2 (`facultyId=9`); select teacher 12; edit a class;
    Save → assert a `PUT /faculty-assignments/12` carrying the edit is issued and the edit persists;
    assert the entry target did not hijack the save.
- **Failing-first**: run the new file against the base source and record the literal command and the
  observed failures for at least E4 (subjectId ignored), E5 (`filter` ignored), E2/E3/X1 (target lost
  / re-applied) and E9 (nothing opens). Record the output.
- **Wired**: add `"test:a6-tl-deeplink": "tsx --test <new file>"` to `atlas-client/package.json` and add
  the new file to the `test:client-suite` list (the `gate-reachability` control fails if a test file is
  named by no script). No deletion of any existing script entry.

## 5. Boundary

- Client only: `atlas-client/src/**` and `atlas-client/package.json`. No `atlas-server/**`, no
  `prisma/**`, no DB, no deploy, no companion repo, no runtime/task/env change.
- Additive corrections only: never delete an existing test, assertion or control.
- Keep the existing route-intent contract for `change-owner` / `missing-load` / `view=subjects`
  working (preservation rows must stay green).
- Do not touch `docs/plans/live-state.md` or the register — the planner owns those.

## 6. Evidence to return (one page)

Base SHA, candidate SHA, exact changed paths, the JSON of the entry table with each row's result, the
failing-first output, the decisive commands run with results, the `git status --short` (empty), known
risks each marked `BLOCKING`/`NON_BLOCKING`, verdict `REVIEW_REQUIRED`. Disposition:
`RETIRE_AFTER_INTEGRATION`.
