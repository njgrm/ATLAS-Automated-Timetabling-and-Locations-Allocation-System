# Prompt 10B: Complete Dynamic Unassigned Teaching Load Repair

## Context

You already added dynamic setup sync and Quick Place. You also previously wired scheduled-entry Teaching Load repair in `/timetable`.

What is still missing:

- A scheduler cannot fully repair canonical Teaching Load ownership from an unassigned row.
- Quick Place can place sessions after ownership exists, but the UI does not complete the flow: unassigned row -> choose teacher -> save Teaching Load -> place or regenerate.
- The objective is not only auto-placement. The timetable page must be dynamic and repairable from the unassigned state.

## Mission

Implement the missing `UNASSIGNED` Teaching Load repair path inside `/timetable`.

## Required Changes

### 1. Extend The Teaching Load Repair Contract

Support both change kinds:

- `kind: "ENTRY"`
- `kind: "UNASSIGNED"`

Keep legacy `changes[]` payloads working as `ENTRY` changes.

### 2. UNASSIGNED Preview

For `UNASSIGNED` preview, return:

- current canonical owner
- proposed owner
- whether the session is placeable now
- one plain blocker reason if not placeable
- up to three placement suggestions if placeable

### 3. UNASSIGNED Apply

For `UNASSIGNED` apply:

- validate completed unpublished run
- block published runs with `RUN_ALREADY_PUBLISHED`
- validate expected run/faculty versions
- update `SubjectSectionOwnership`
- update matching `FacultySubject.sectionIds`
- refresh run summary/input snapshot trust state
- keep unassigned item visible unless the user explicitly places it

### 4. Optional Placement

If a placement proposal is included:

- project the Teaching Load repair first
- place through the existing manual-edit placement path
- remove the unassigned item only after successful placement

### 5. UI Flow

In Needs Attention / Unassigned rows, show one of:

- `Fix teacher`
- `Place session`
- `Still blocked`

Selecting `Fix teacher` opens the same embedded Teaching Load dock.

Keep the dock progressive:

- Current owner
- Choose teacher
- Preview and save

Primary actions:

- `Save Teaching Load`
- `Save Teaching Load and place session`
- `Place session`

Published mode must only show `Create timetable revision`.

## Tests

Add or extend server tests:

- `UNASSIGNED` preview identifies current owner
- `UNASSIGNED` apply updates canonical ownership
- `FacultySubject.sectionIds` updates
- placement removes unassigned item only when placement succeeds
- conflict blocks and rolls back
- published run blocks canonical repair
- no new generation run is created

## Browser QA

Use Playwright against Tailnet by default:

- URL: `https://njgrm.buru-degree.ts.net/login`
- Admin: `1000001` / `AdminSY2026!`
- Route: `/timetable`

Test flow:

1. Use unpublished run `127` if still available.
2. Select an unassigned row.
3. Change teacher.
4. Preview.
5. Save.
6. Confirm row changes to placeable or shows one plain blocker.
7. Place a valid session if available.
8. Refresh and confirm timetable reflects the change.

## Verification

Run:

- `npm --prefix atlas-server run build`
- `npm --prefix atlas-client run build`
- targeted server tests
- browser smoke for desktop and mobile

## Required Output

Return:

- files changed
- unassigned repair API contract
- UI flow evidence
- build/test/browser results
- prompt-scope `GO` or `NO-GO`

