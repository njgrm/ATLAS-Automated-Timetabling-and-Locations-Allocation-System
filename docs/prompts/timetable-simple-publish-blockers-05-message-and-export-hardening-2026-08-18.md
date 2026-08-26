# Prompt 05 — Scheduler-Friendly Messages and Blocker Export

## Goal

Remove raw technical messages from the Simple publish-blocker path and give schedulers a way to share large blocker lists.

## Context

The current hard violation payload can contain text such as:

```text
Section 5 subject 3 remained unassigned in session 1.
```

That is not acceptable on the Simple path. Raw IDs may exist in technical details, but the scheduler-facing path must use class, section, subject, grade, teacher, room, reason, and next step labels.

## Scope

Frontend display hardening first. Add backend label mapping only if the frontend cannot reliably hydrate labels from existing references.

## Tasks

1. Add a Simple-mode formatter for unresolved and violation rows:
   - section label
   - subject label
   - grade label
   - session number
   - reason label
   - next step
2. Do not show raw ID-only messages in:
   - Simple publish readiness sheet
   - Simple blocker groups
   - Simple plotting tray blocker states
3. Add a secondary action:
   - `Download blocker list`
   - or `Copy blocker summary`
4. The exported/copied summary shall include:
   - run ID
   - school year label if available
   - total unresolved
   - total blockers
   - total warnings
   - grouped blocker causes
   - affected subject/grade groups
   - next step per group
5. If using a download, use CSV or plain text. Do not add a new Excel dependency in the client.

## Required plain-language mappings

- `FACULTY_OVERLOADED`: `Teacher workload is full. Move some classes or assign another teacher.`
- `NO_AVAILABLE_SLOT`: `No allowed time slot was found. Try manual placement or review the scheduling policy.`
- `NO_QUALIFIED_FACULTY`: `No qualified teacher is assigned. Build or repair Teaching Load.`
- `NO_COMPATIBLE_ROOM`: `No compatible room was found. Review room setup.`
- `ROOM_CAPACITY_EXCEEDED`: `The room is too small for this class. Choose a larger room.`
- `UNASSIGNED_SECTION`: `This class was not placed. Review the unresolved reason.`

## Acceptance criteria

- Simple publish-blocker surfaces show no raw ID-only messages.
- Fallback labels are recovery-oriented, not `Unknown ... (#id)`.
- Copy/download output is readable by non-technical staff.
- Export/copy does not mutate data.
- The action is available only when there are blockers or warnings to summarize.

## Verification commands

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-publish-blockers.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-feedback-readiness.spec.ts --workers=1
```

## Report requirements

Return:

- `GO` / `NO-GO`
- examples of before/after messages
- copy/download sample text
- proof no raw ID-only text appears in Simple path
- whether Prompt 06 can proceed
