# A3 teacher-one — merge Teacher Profile and Review load into ONE teacher dialog

- **Stream:** `A3` (Teachers) · cycle `teacher-one` · 2026-09-30
- **Executor:** `atlas-executor-ds` (default variant) — sole writer for this packet
- **Worktree:** `E:/ATLAS-worktrees/lane-a3-teacher-one-20260930`
- **Branch:** `work/a3-teacher-one-20260930`
- **Base:** `5444c44524f15005bf245ca4aa1be0f4886581bb` (`origin/main`, train 11)
- **Authored by:** the A3 planner. Do not edit this packet; correct the code.

## Locked operator decisions (read before writing any JSX)

`docs/plans/operator-decisions.md` rows **9**, **10** and **6**. A change that reverts a row is a
failed change:

- **9** — Teacher Profile and Review load are **ONE dialog**: load figures on top (Review load),
  classes taught below (Profile layout); the row keeps only "Review load".
- **10** — dialogs open at a **normal centred width (about 42rem), never near full screen**;
  resizing is optional but must keep working.
- **6** — presentation outranks function; a UX regression or a wrong value blocks.

Also §8: subtract first (remove at least as much as you add), one look per control, no raw
`<details>`/`title`/`<select>`, no global scrollbar, ≤1000 physical lines per component file.

## THE ONE CHANGE

Merge these two dialogs into ONE teacher dialog:

| today | file | opened by |
|---|---|---|
| "Review load" | `atlas-client/src/components/faculty/FacultyWorkloadModal.tsx` | the row's primary button (`openWorkloadModal`) |
| "Teacher Profile" | `atlas-client/src/components/faculty/FacultyProfileSheet.tsx` | the row's separate **Profile** button, the *Assigned classes* cell, the mobile card |

### Required end state

1. **One dialog component.** Keep `FacultyProfileSheet.tsx` as the survivor and **delete
   `FacultyWorkloadModal.tsx`** (and the `WorkloadInspector` usage it alone carried). Reason, record
   it in the handoff: `FacultyProfileSheet` is the only surface that renders
   `TeacherSubjectPermissions` — the single front door that can create a `CrossDepartmentPermission`
   (A6 c10, Codex audit finding 6). Deleting that shell deletes the front door; decision 6 forbids it.
2. **Body order — load figures on top, classes taught below.**
   - **Top: the Review-load figures**, sourced from `buildTeacherWorkloadView(faculty)`
     (`components/faculty/teacherWorkloadProfile.ts`) — the same data the deleted modal showed, so
     the numbers cannot drift:
     - the teacher name, and for a class adviser the **adviser star with the advisory section**;
     - the **load bar** reading `{actualTeachingHours}h a week … · {teachingStandardHours}h standard`
       (the 30h standard when no policy is stored);
     - the **credit** line ("Adviser and other duties (credit)");
     - **"Room for more classes"** (`remainingHours`);
     - **ONE plain "what to do" line** — the same sentence the deleted inspector rendered for the
       status (over-cap / overload-allowed / below-standard / at standard). One sentence, one line,
       no second instruction.
   - **Below: the A3 c17 classes-taught layout, kept as-is** — one box per subject, grade boxes via
     the existing `GradeBadge` (no second colour map), section names side by side and wrapping, the
     "N classes · Xh a week" total with the C3-FIX clause rule untouched.
   - Keep the cross-department permission panel reachable.
   - Subtract: the profile's own "Current weekly hours" card and any duplicate of the load figures is
     replaced by the block above, not repeated beside it. Roster identity / Subjects-Sections stat
     cards / Adviser-and-source-context may be removed when the top block already states the same
     fact (§8, subtract first) — say which you removed and why.
3. **Footer: exactly two controls** — **'Edit in Teaching Load'** and **'Close'**.
   - The link keeps its exact form and carries this teacher:
     `` `/teaching-load?facultyId=${faculty.id}${intent ? `&task=${intent.task}` : ''}` ``.
     A6 owns that routing; do **not** change the route, the params or the label.
   - No **'More detail'** button, toggle or expander anywhere in the dialog.
4. **Width.** The dialog opens at about **42rem**, centred, never near full screen. Implement as a
   **width** class on `DialogContent`: `w-[min(42rem,95vw)]` (replacing the current
   `w-[min(56rem,95vw)]`), keeping `resizable` and the shared
   `min-w-[min(480px,95vw)] max-w-[95vw]`. **Do not use a `max-w-*` class for the default width** — a
   `max-width` clamps the drag handler's inline `style.width` and re-breaks resize (A3 c17 row 7).
   Keep the internal-scroll / no-global-scrollbar structure.
5. **Row: ONE button, no Profile.**
   - Delete `inlineSecondary` from `useFacultyRowActions` and the `Profile` button in
     `FacultyMobileCard` (`FacultyRow.tsx`). Exactly one action button per row remains, and it opens
     the merged dialog.
   - Keep the primary button's per-intent label (`Review load` / `Assign teaching load` /
     `Move classes` / `Review temporary`). The operator's point is the button **count** and the
     Profile removal; renaming working guidance copy is a separate product decision. Record this
     reading in the handoff so the operator can overrule it in one line.
   - Enumerate every call site that opened the profile before changing anything:
     `git grep -n "setProfileTarget\|onOpenProfile\|onProfileClick\|onAssignedClassesClick"`. Each one
     must open the merged dialog. The prompt names "the 3-dots menu item that opened the profile"; if
     no such menu entry exists in source, report `NOT_FOUND_IN_SOURCE` with the grep output — do not
     invent one.
6. **Delete the dead code** of the removed dialog: the file, its now-unused imports, props, exports
   and tests-only helpers. `git grep` must return **zero** references to the deleted module.

## TESTS FIRST (they must fail on the base)

New file `atlas-client/src/components/faculty/__tests__/a3-teacher-one.test.tsx`, jsdom, in the
harness style of `a3-c17-teacher-profile.test.tsx`. **Add a `package.json` script** so a gate runs it
(§11: a test no gate runs is not evidence) — e.g. extend `test:a3-c17-teacher-profile` or add
`test:a3-teacher-one`.

| Row | Harness | What it must decide |
|---|---|---|
| T1 | rendered | For a teacher with a normal load, the load figures **and** the A3 c17 subject boxes render inside the **same** dialog element (one `[data-testid]` dialog, both sections). Failing-first: on the base no single component renders both. |
| T2 | rendered | A row renders **exactly one** action button and **no** Profile control (`teacher-row-profile-action` absent). |
| T3 | rendered class contract | The merged dialog's `DialogContent` carries `w-[min(42rem,95vw)]`, does **not** carry `w-full`, and is `data-resizable="true"`. This is a class contract, not a pixel measurement — say so in the test. |
| T4 | rendered | The footer has an **'Edit in Teaching Load'** link whose `href` carries this teacher's `facultyId` and the intent `task`, plus a Close control; the dialog text contains no `More detail`. |
| T5 | rendered | `TeacherSubjectPermissions` is still reachable from the merged dialog. |
| T6 | migrate | Move the **intent** of the existing rows to the merged dialog: `a3-c17-teacher-profile.test.tsx` (mounts `FacultyProfileSheet` — keep its subject-box, grade-authority and total-arithmetic rows), `a6-teachers-header-profile.test.tsx` (A6-23.1 rows), `a3-c10-teacher-surface.test.tsx` (F25 rows) and `a3-c17` row 7 (retarget the "no `max-w-` cap" assertion at the merged dialog). Update assertions that named the deleted component; **do not delete a control or an evidence row to close a finding** (§16) — mark superseded and add the replacement beside it. |

## GATES TO RUN — record the literal command and its result

1. Failing-first evidence: the new rows fail on base (show the red run, then the green run).
2. `npx tsc --noEmit` in `atlas-client` (record pre-existing failures on base verbatim; fix nothing
   out of range).
3. `npm run test:a3-c17-teacher-profile` (it also runs `a3-c10-teacher-surface`,
   `a6-teachers-header-profile`, `a5-c6-shared-dialog-tooltip`, `a7-c8-type-scale`,
   `a3-c17-timetable-identity`, `timetable-cell-info`) and `npm run test:a6-c11-teacher-truth`.
4. `git diff --check`; `git status --short` empty (the junction is untracked and ignored).
5. One list of every changed path with a one-line reason.

**No server, no DB, no network call is required by this change.** Do not start a foreground server
or watcher.

## BOUNDARIES

- Only `atlas-client/**` (plus this packet) may change. **No** `atlas-server/**`, `prisma/**`,
  `docs/plans/operator-decisions.md`, or any file owned by another lane.
- No runtime, deployment, database, migration, generation, publication or companion-repo action.
  No push to `main`, no force-push, no rebase of a handed-off commit.
- One commit per coherent step; conventional messages. Do not amend after handing off.

## HANDOFF (one page, ≤8 lines of summary)

Base SHA · candidate SHA · changed paths · failing-first evidence · gates actually run with results ·
the survivor choice, the label reading and the 3-dots finding · risks each marked BLOCKING or
NON_BLOCKING · verdict.
