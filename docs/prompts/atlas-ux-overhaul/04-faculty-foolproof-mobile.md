# Prompt UX-04 — Faculty Foolproof Mobile Experience

## Objective

Make faculty workflows completeable on a phone by an older, low-confidence user without training.

## Target Routes

- `/my`, `/my/schedule`, `/my/preferences`, `/my/room-preferences`.

## Implementation Directive

1. Keep `/my` as the single task-first home with one dominant next action.
2. Keep My Schedule focused on the teacher’s own schedule; make unpublished, changed, offline, and empty states explicit.
3. Convert My Preferences into a guided review with readable labels, clear saved state, and a single submit/update action.
4. Rebuild My Room Preferences as a three-step workflow: choose class, choose requested change, review and submit.
5. Show the current step, allow Back without losing input, and keep advanced alternatives collapsed.
6. Use 44px mobile targets, body-sized instructional text, persistent action placement, and no horizontal page overflow.
7. Show offline states as Queued, Syncing, Synced, or Failed, with a retry action and a statement about whether the request is safe.
8. Replace native title help and icon-only ambiguity with visible help or accessible project primitives.
9. Extract `FacultyRoomPreferences.tsx` into focused step, summary, status, and data hooks before adding behavior.

## Usability Scenario

A faculty user with no prior ATLAS training shall be able to find today’s schedule and submit one room request using only the visible instructions, with no facilitator explanation.

## Exit Gate

GO when the scenario passes on 375px portrait and mobile landscape, at 200% text scaling, by touch and keyboard, with successful online and queued-offline outcomes.
