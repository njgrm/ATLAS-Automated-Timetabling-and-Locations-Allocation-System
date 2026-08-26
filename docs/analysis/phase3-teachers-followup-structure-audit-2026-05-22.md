# Phase 3 Teachers Follow-Up Structure Audit — 2026-05-22

## Verdict

`NO-GO` for closure on the renamed `Teachers` page and its connected `Teaching Load` flow.

The previous follow-up pass improved some contract issues, but the live code still has:

- table structure drift
- copy and naming inconsistencies
- micro-text overuse
- missing advisory-section visibility
- incomplete grade-badge semantics
- a still-specialization-heavy `Teaching Load` page
- visible encoding drift in shared shell/teaching-load code

This is no longer just polish.
There are still workflow and structure issues that will confuse schedulers.

## Confirmed User Concerns

### 1. `GR7` to `GR10` badges are not color-coded like the `Subjects` page

Confirmed.

- In `FacultyProfileSheet.tsx`, section badges are rendered as neutral outline badges:
  - `GR{sec.displayOrder}`
- They are not mapped to the DepEd semantic grade colors used elsewhere.

This weakens scanability and breaks parity with the established grade-color system.

### 2. Table header style drifted away from the `Subjects` table pattern

Confirmed.

The current `Teachers` table header differs materially from the calmer `Subjects` table rhythm:

- header labels changed shape and density
- an unnecessary `Contact` column was kept
- an `Actions` header is now visually misaligned with the underlying columns because the body still renders a separate status cell

### 3. Contact information should be removed

Confirmed.

The `Contact` column and drawer section currently add no value:

- table cell always renders `-`
- drawer always renders `No contact provided`

This is dead space and visual noise.

### 4. Active/status cell still exists in the row while the header was removed

Confirmed and high-signal.

`FacultyRow.tsx` still renders:

- a dedicated active/excluded status cell

But `Faculty.tsx` no longer renders a matching status `<th>`.

Result:

- body column count is `7`
- header column count is `6`
- `Actions` now visually sits above the wrong cell

This is a real table-structure bug, not just a style preference.

### 5. `Excluded` filter is unclear

Confirmed.

The page still exposes:

- `All Status`
- `Active`
- `Excluded`

But the page does not explain where exclusion comes from or how it is changed.
The underlying field is `isActiveForScheduling`, which is real system state, but there is no operator-facing control on this page.

So the filter is technically backed by real data, but it is under-explained and currently feels like a ghost control.

### 6. Advisory section is still not visible enough

Confirmed.

Current state:

- row shows a star icon if `isClassAdviser`
- drawer shows advisory credit text
- `FacultyAssignments.tsx` can show adviser metadata in the selected-teacher header

But the `Teachers` table and profile drawer do not show the actual advisory section explicitly in a durable, easy-to-scan way.

That means the user can know someone is an adviser without knowing which class they advise.

## Additional Findings

### 7. Micro-text is still overused

Still bad in both `Teachers` and `Teaching Load`.

Examples:

- `text-[0.55rem]`
- `text-[0.6rem]`
- `text-[0.625rem]`
- `text-[0.65rem]`
- `text-[0.6875rem]`

This directly violates the intended readability direction.

### 8. `Teaching Load` still carries the old specialization-first model

Confirmed.

`FacultyAssignments.tsx` still includes:

- `specializationFilter`
- specialization alias lookup
- specialization-qualified subject grouping
- outside-specialization grouping
- specialization-based auto-fill wording

That means the `Teachers` rename happened on the surface while the connected workload page still reflects the older mental model.

### 9. Visible encoding drift still exists

Confirmed.

Examples:

- `AppShell.tsx` still contains mojibake in comments and visible strings like the active-year bullet
- `FacultyAssignments.tsx` still contains:
  - `Auto-Fill: all subjectâ€“section pairs are already assigned.`

This is a real quality issue and can surface visibly.

### 10. `Manage Teaching Load` rename is incomplete in deeper wording

Confirmed.

Routes were renamed, but internal text and page purpose still drift:

- some surfaces still describe people as `faculty`
- some list logic still uses older filter semantics
- the page is not yet fully aligned to the calmer `Teachers -> Teaching Load` workflow

### 11. The row still over-emphasizes specialization

Confirmed.

Current second column is still:

- `Dept / Specialization`

That is not aligned with the newer department-first simplification direction.

## Teaching Load Render/Error Assessment

No client build-time render error was reproduced in this audit.

`npm --prefix atlas-client run build` passed.

So the likely problem is not a TypeScript or Vite compile break.
The more plausible current issues are:

- visual/rendered layout breakage from table-column mismatch
- visible mojibake
- stale specialization-heavy UI logic creating confusing or broken-looking states

If the user is seeing an actual runtime render problem on the `Teaching Load` page, the next pass should verify it in-browser instead of relying on build success.

## What The Next Fix Pass Should Do

1. Restore structural parity between `Teachers` table headers and body cells.
2. Remove the dead `Contact` column and drawer section.
3. Make advisory section explicit in both row and drawer when available.
4. Reintroduce proper semantic grade colors for `GR7` through `GR10`.
5. Reduce or remove specialization-first emphasis from the `Teachers` view.
6. Clarify or demote the `Excluded` filter unless the state is made clearly understandable.
7. Remove leftover mojibake from `AppShell` and `Teaching Load`.
8. Continue the `Teaching Load` cleanup so it matches the department-first workflow instead of the older specialization-driven one.

## Outcome

The recent pass is a partial improvement, not a finished `GO`.

The most important blocker is the combination of:

- table-body/header mismatch
- still-unclear status/exclusion model
- missing advisory section visibility
- still-specialization-heavy `Teaching Load`

Those make the current experience feel renamed, but not fully rethought.
