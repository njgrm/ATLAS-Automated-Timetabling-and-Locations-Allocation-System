# Moderated Older-User Script: Timetable Overhaul Iteration D

Target: `https://njgrm.buru-degree.ts.net`

Persona: older non-technical scheduler or office staff member who understands school scheduling terms but is not comfortable with complex software.

## Purpose

Validate whether the simplified timetable page is actually understandable without developer coaching. This script is required before claiming final product-level closure for the older-user usability goal.

## Moderator rules

- Do not explain where controls are unless the participant is blocked for more than 90 seconds.
- Ask the participant to think aloud.
- Record whether each task was completed independently, completed with one hint, or failed.
- Record confusing labels verbatim.
- Record whether the participant used click, drag, or both.

## Tasks

1. Open `/timetable` and explain what data/source the page is using.
2. Find the latest generated timetable.
3. Find an unresolved/unassigned session.
4. Explain whether that session can be placed now or needs another setup fix first.
5. Place a placeable unresolved session using click, not drag.
6. Start dragging an unresolved session and explain what the cell labels mean.
7. Select a scheduled session and find how to move it.
8. Swap two occupied sessions and explain the before/after review before saving.
9. Enter the pre-generation draft workspace.
10. Place one draft queue item.
11. Find where filters are located.
12. Recover from a mistake by cancelling a dialog or backing out of a move.

## Pass criteria

- At least 10 of 12 tasks are completed independently or with one hint.
- The participant can correctly explain `Can place`, `Can swap`, `Blocked`, `Warning`, `Occupied`, and `Current`.
- The participant does not expect to assign teachers inside timetable placement.
- The participant can identify the primary next action within 10 seconds on first load.
- The participant does not need page-level browser scrolling to reach the main timetable work area.
- The participant can cancel a risky action without moderator help.

## Failure criteria

- The participant believes timetable is where teachers should be assigned.
- The participant cannot find unassigned placement or session swap after two hints.
- The participant cannot tell why an unassigned session is blocked.
- The participant describes the default page as visually overwhelming after the Iteration D simplification.
- The participant must use browser page scroll to reach the primary timetable grid on normal desktop or mobile viewports.

## Evidence to capture

- Participant role/background.
- Device and viewport.
- Completion result per task.
- Time to identify the first primary action.
- Time to complete first placement review.
- Time to complete first swap review.
- Confusing labels or controls.
- Any accessibility observations around text size, color, touch targets, or focus.

