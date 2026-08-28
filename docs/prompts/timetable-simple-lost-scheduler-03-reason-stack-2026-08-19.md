# Prompt 03 — Blocker Reason Stack and Row Guidance

## Goal

Make unresolved-session rows explain both the publish blocker and the immediate next action, so row actions do not look contradictory.

## Context

A session can belong to a `No available slot` blocker group while the row action says `Choose room` or `Fix owner`. That can be technically correct: ATLAS may need a room or Teaching Load owner before it can evaluate slots. But without explanation, older scheduler officers may think the system changed topics.

## Target files

Primary candidates:

- `atlas-client/src/components/timetable/TimetableTaskDrawer.tsx`
- `atlas-client/src/components/timetable/GeneratedUnassignedPanel.tsx`
- `atlas-client/src/components/timetable/simplePublishReadiness.ts`
- `atlas-client/src/components/timetable/SimplePublishReadinessSheet.tsx`
- `atlas-client/src/components/timetable/buildScheduleReviewWorkspaceContexts.ts`

## Tasks

1. Add a small derived reason-stack helper for unresolved generated sessions.
2. Each row in the Simple plotting tray shall be able to show:
   - publish blocker, if the user is in a blocker repair context;
   - immediate prerequisite;
   - exact next action label.
3. Examples of visible copy:
   - `Main issue: No available slot`
   - `First fix: Choose room`
   - `ATLAS cannot test slots until the room is known.`
4. Do not duplicate long explanations on every row. Use compact labels in rows and a details affordance for the full explanation.
5. The current session card may show more guidance than next-session rows.
6. The full details drawer/sheet shall show the complete reason stack.

## Required action labels

- Placeable item: `Place`
- Missing room: `Choose room`
- Missing owner: `Fix owner`
- Blocked item: `Review blocker`
- No-slot context with missing prerequisite: keep the prerequisite label, but show why it appears.

## UX requirements

- Keep compact row height near the existing target.
- Do not turn the tray into a wall of text.
- Do not expose raw enum names.
- Do not show raw database IDs.
- Use badges/cards with text, not color-only meaning.
- Use `GR7` compact grade labels if a grade badge is shown.

## Acceptance criteria

- A no-slot filtered row with missing room explains that room must be chosen before slot repair can continue.
- A no-slot filtered row with missing owner explains that Teaching Load owner must be fixed before slot repair can continue.
- A ready-to-place row does not show unnecessary blocker text.
- Details exposes the complete reason in plain language.
- Every disabled row action has a visible reason close to the action.

## Required tests

Update or add:

- `qa-artifacts/playwright/specs/timetable-simple-lost-scheduler.spec.ts`
- `qa-artifacts/playwright/specs/timetable-simple-publish-blockers.spec.ts`
- unit tests for any new reason-stack helper.

Assertions:

- no-slot filter shows a context reason;
- prerequisite actions are explained;
- visible copy does not contain raw enum text;
- disabled actions show a reason;
- visible row text remains under a reasonable word budget.

## Verification commands

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-lost-scheduler.spec.ts --workers=1
npx playwright test -c ../playwright.config.ts ../qa-artifacts/playwright/specs/timetable-simple-publish-blockers.spec.ts --workers=1
```

## Report requirements

Return:

- `GO` / `NO-GO`
- examples of before/after row copy
- screenshots of current session card and details
- files changed
- exact commands and results
- remaining caveats
