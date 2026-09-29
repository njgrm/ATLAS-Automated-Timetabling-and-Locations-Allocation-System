# A5 — rotation-aware subject counts (display-only)

- **Cycle:** `a5-rotation-subject-counts-2026-09-30`
- **Lane:** A5 (Subjects and counts). Owner: A5 planner.
- **Worktree:** `E:/ATLAS-worktrees/lane-a5-rotation-counts` (branch `work/a5-rotation-counts-20260930`)
- **Base SHA:** `a4d961126e3b0fd31e5e0961f5a0ec0351cc373c` (current `origin/main`; worktree clean)
- **Live for reference:** train 11 `bc94b10b`, year 2026-2027.
- **Risk tier:** MEDIUM (client display + one additive server count). Independent QA required.
- **Worktree disposition:** `RETIRE_AFTER_INTEGRATION`.

## Intent (operator, 00:50)

> "subject counts are misleading for rotating subjects. Science (SCI_BIO, SCI_CHEM, SCI_ES,
> term_group_id SCIENCE) and TLE (TLE_AFA_EXP, TLE_FCS_EXP, TLE_ICT_EXP,
> term_group_id TLE_EXPLORATORY) each rotate one subject per term, so each must count as ONE
> subject, not three. … make a rotation group count as one subject there, using the existing
> termGroupId/rotationFamily fields; do not change scheduling, minutes or generation.
> Display-only; one shared helper plus tests that pin the count for a section with both
> rotation groups."

The user is a scheduler reading counts on a screen. A section teaching the Science rotation
(3 catalogue rows) **and** the TLE rotation (3 catalogue rows) must read **2 subjects**, not 6.
Nothing about scheduling, minutes, capacity or generation changes.

## One rule, one client helper

Create **`atlas-client/src/lib/rotation-subject-count.ts`** (pure, exported, no React):

```ts
export interface RotationSubjectLike {
  rotationFamily?: string | null;
  termGroupId?: string | null;
}

/** The rotation group a subject row belongs to, or null when it is a standalone subject. */
export function subjectRotationGroupKey(row: RotationSubjectLike): string | null;
// key = normalize(termGroupId) || normalize(rotationFamily) || null
// normalize = trim + toUpperCase; empty -> null.

/** Rows grouped by rotation; every group is a rotation family. A null-key row is its own group. */
export function groupSubjectsByRotation<T extends RotationSubjectLike>(rows: readonly T[]): T[][];

/** One representative row per rotation group (for lists/headers). */
export function distinctSubjectsByRotation<T extends RotationSubjectLike>(rows: readonly T[]): T[];

/**
 * Count subject groups; a rotation group counts once.
 * With a predicate, a group counts once when ANY member satisfies it
 * (family-level semantics — one rotating subject with a problem is one problem).
 */
export function countSubjectGroups<T extends RotationSubjectLike>(
  rows: readonly T[],
  predicate?: (row: T) => boolean,
): number;
```

**RULE:** a rotation group counts once for a property if **any** active member has it. This is
deliberate: it keeps `>0` meaning "a gap exists" (never hides a partly-staffed family) while the
number stays a subject count. Standalone rows (no `termGroupId`/`rotationFamily`) keep counting
individually. **Do not** add code-prefix heuristics (`SCI_`/`TLE`) in this helper — the fields are
authoritative.

Reuse, do not re-invent: `atlas-client/src/lib/faculty-assignment-helpers.ts:431`
(`resolveRotationTermMetadata`: `termGroupId = rotationTermGroupId || termGroupId`) shows the
existing precedence style. Where a caller already has `resolveRotationFamily` semantics, prefer
the explicit fields as above.

## Apply sites (exactly these; nothing else)

From a full read-only sweep of every user-visible subject count:

1. **Subjects header tiles — `atlas-client/src/components/subjects/useSubjectStats.tsx`**
   - "Active subjects" (`:76,103-108`): `countSubjectGroups(subjects.filter(s => s.isActive))`.
   - "Missing coverage" (`:90-94,110-126`): `countSubjectGroups(active, isAtRisk)` where
     `isAtRisk` is the existing per-subject predicate already in this file.
   - "Room constrained" (`:70-72,78`): `countSubjectGroups(active, isRoomConstrainedSubject)`.
   - Keep every help text/tone; only the counted value collapses.
2. **Teaching Load section grid — `atlas-client/src/components/faculty-assignments/SectionGridMode.tsx`**
   - Per-section "Grade G • N Subjects" (`:404`) and the staffed fraction (`:414`) use
     `row.totalCount`. Compute a display `subjectCount = countSubjectGroups(sectionSubjects)`
     from the section's `Subject[]` (`:117-119,143`). **Do not** change `unassignedCount` or any
     assignment/ownership computation — display count only.
3. **Teaching Load "Show other subjects (N)" — `atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx:652`**
   - Collapse the outside-department `Subject[]` with the shared helper. (Do not re-add the
     deleted per-teacher `Subjects` block; a6-c6 asserts its absence.)
4. **Teachers profile stat — `atlas-client/src/components/faculty/FacultyProfileSheet.tsx:176,453`**
   - Compute the "Subjects" number from `faculty.assignments` (whose `subject` carries
     `rotationFamily`/`termGroupId`) with `countSubjectGroups`, instead of the server scalar
     `faculty.subjectCount`. Leave the label/markup unchanged.
5. **Dashboard "Subjects" tile — server scalar**
   - `atlas-server/src/services/dashboard-readiness.service.ts:683-694`. Make the two counts
     rotation-aware:
     - `subjectCount` = distinct rotation groups among active subjects.
     - `unassignedSubjectCount` = distinct rotation groups having **at least one** active member
       with no `facultySubjects` row (family-level; preserves the "a gap exists" signal).
   - Fetch `rotationFamily`/`termGroupId` for active subjects and count groups; reuse the existing
     server normaliser pattern (`derived-demand.service.ts:184`). Keep the field names and shape
     (no API contract change). Add a **cross-layer parity test**: the same Science(3)+TLE(3)
     fixture yields 2 on both the client helper and this server count.

## Out of scope — do not touch

- **Any filter bar.** `docs/plans/operator-decisions.md` row 4 locks the Teaching Load header
  (no Past-years button, no Cross-subject/No-subject-match switches); its guard test at
  `63714b1f` must stay green. Subjects filters render **no counts** (verified) — leave
  `SubjectFilterToolbar.tsx` untouched.
- **`Sections.tsx`, `AdminYearSetup.tsx`** — no subject count is displayed (verified). Do not add one.
- **Subjects catalog footer / pagination "of N results"** — that is a row count of the list being
  paged, not a subject count; leave it.
- **TL per-teacher subject count** — it was deliberately deleted; do not re-add it.
- **Scheduling, minutes, capacity, generation, publication, migration, runtime** — untouched.
- Do not revert the A7 white-tooltip changes that just landed (`FacultyRow.tsx`,
  `SubjectRow.tsx`, `TeacherGridMode.tsx`, `ui/tooltip.tsx`).

## Required controls

- **Failing-first:** a test that on the base (naive `.length`) reads **6**, and after the fix
  reads **2**, for one section holding `SCI_BIO`+`SCI_CHEM`+`SCI_ES` (`termGroupId` `SCIENCE`)
  and `TLE_AFA_EXP`+`TLE_FCS_EXP`+`TLE_ICT_EXP` (`termGroupId` `TLE_EXPLORATORY`). Add 2
  standalone subjects to prove they still count individually (expected **4**).
- **Adversarial/negative:** two distinct rotation groups must stay two (different `termGroupId`);
  a family with one unstaffed member still reads `unassignedSubjectCount > 0`.
- Helper unit tests + a render test per edited site.
- **A test no gate runs is not evidence** — every new/changed test file must be reachable from a
  committed `package.json` script.

## Gates (run literally, record output)

- Helper unit test + the edited subjects/teaching-load/dashboard suites.
- `atlas-client`: typecheck + production build. `atlas-server`: typecheck + build + dashboard tests.
- `git diff --cached --check` and full `git status --short` clean before commit.

## Commit + report

- One conventional commit: `fix(subjects): count a term-rotation group as one subject`.
- Report: base SHA, candidate SHA, changed paths, per-site tally, exact commands + results,
  risks each `BLOCKING`/`NON_BLOCKING`.
- **No deployment / runtime / live-data / generation action.** Push only after QA acceptance.
