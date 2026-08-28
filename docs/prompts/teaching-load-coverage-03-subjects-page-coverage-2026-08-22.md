# Prompt 03 — Subjects Page Coverage Visibility

## Role

You are the ATLAS Subjects-page UX executor. Implement only this prompt after Prompt 01 is GO.

## Problem

The Subjects page currently marks a subject as `Ready` if any teacher is assigned to that subject. This hides partial coverage gaps such as one section missing a teacher while the subject appears generally assigned.

## Target files

- `atlas-client/src/pages/Subjects.tsx`
- `atlas-client/src/components/subjects/SubjectRow.tsx`
- Shared coverage-summary helper from Prompt 01
- Focused tests or UX guardrails as needed

## Out of scope

- Changing subject CRUD rules.
- Changing Teaching Load ownership.
- Replacing the Subjects page shell.
- Implementing the Teaching Load subject view; that is Prompt 02.

## Requirements

- Subjects page shall use the Prompt 01 coverage summary for teacher coverage status.
- The `Teacher coverage` column shall distinguish:
  - `Full coverage`
  - `Partial coverage`
  - `No coverage`
  - `Excluded`
  - `Archived`
- For schedulable active subjects, the table shall show covered/required counts, for example `19/20 covered`.
- The missing coverage filter shall mean `uncoveredSectionCount > 0`.
- The missing coverage stat shall count subjects with `uncoveredSectionCount > 0`.
- The coverage drawer shall show exact uncovered sections when available.
- The drawer shall link directly to `/teaching-load?view=subjects&subjectId=<id>&filter=missing-coverage`.
- If coverage summary is loading, the table shall show a neutral loading state rather than falsely showing `Ready`.
- If coverage summary fails, the table shall show a clear degraded state and keep subject CRUD usable.

## UI requirements

- Preserve the existing `AdminWorkspaceFrame`, `AdminSearchFilterToolbar`, and `AdminTableShell` composition.
- Keep row height practical and readable; do not add oversized alert panels.
- Use standard badges and tooltips for coverage meaning.
- Mobile cards shall show the same coverage status and covered/required counts.
- Do not use raw native buttons or native selects.

## Verification

Run:

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
```

Tailnet browser checks:

1. Open `/subjects`.
2. Confirm the `Missing coverage` stat matches coverage rows with `uncoveredSectionCount > 0`.
3. Confirm table rows show covered/required counts.
4. Use `Missing teacher coverage` filter and confirm only partial/zero coverage subjects remain.
5. Open a subject coverage drawer and confirm uncovered sections are named when available.
6. Click `Fix in Teaching Load` and confirm the route includes `view=subjects` plus `subjectId`.
7. Check mobile portrait and mobile landscape for no horizontal overflow.

## Acceptance criteria

- Subjects no longer claims `Ready` based only on any assignment.
- Partial coverage is visible at table glance.
- Coverage drawer shows actionable missing section information.
- The Teaching Load handoff route is specific enough for Prompt 02.

## Final report required

Report files changed, coverage status examples observed, command results, Tailnet findings, and any degraded-state caveats.
