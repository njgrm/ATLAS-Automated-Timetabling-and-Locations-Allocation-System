# Timetable Phase 5 Older-User Usability Script

**Date:** 2026-07-18  
**Environment:** Live Tailnet, `https://njgrm.buru-degree.ts.net/timetable`  
**Audience:** Scheduler officer or admin acting as a non-technical scheduler  
**Goal:** Confirm the timetable can be used without precision dragging or technical scheduling vocabulary.

## Setup

- Use Admin credentials only for the moderated test.
- Start from `/timetable`.
- Do not explain hidden shortcuts before the task begins.
- Allow the participant to read the page copy out loud if helpful.
- Stop the task if the participant is about to save a real change unintentionally.

## Pass/Fail Tasks

| ID | Task | Pass condition | Fail condition |
| --- | --- | --- | --- |
| P5-01 | Find what to do next. | Participant identifies the “What to do next” guide and can name the current task without opening More tools. | Participant must search menus or asks what mode they are in. |
| P5-02 | Understand conflict labels. | Participant explains that Hard means blocked and Soft means warning by reading visible text. | Participant relies only on red/yellow color or cannot infer save impact. |
| P5-03 | Place a generated unassigned session without dragging. | Participant opens Place unassigned, chooses a session, and reaches the placement review surface by clicking/tapping. | Participant believes dragging is required or cannot find the placement path. |
| P5-04 | Switch two generated sessions. | Participant selects one class, selects another occupied class, and reaches Review occupied-slot swap. | Participant cannot discover that two class selections start the swap. |
| P5-05 | Start a draft before generating. | Participant opens Plan before generating, selects a queue item, chooses a slot, and reaches Review draft placement. | Participant cannot tell draft mode apart from generated-run mode. |
| P5-06 | Recover from a mistake. | Participant can identify Undo last change when a manual edit exists, or can explain that Cancel closes a review dialog before save. | Participant believes a click immediately and irreversibly changes the timetable. |
| P5-07 | Keyboard path. | Participant can focus a selectable session, press Enter, focus a target, and reach the same review surface. | Keyboard focus is lost, unlabeled, or does not trigger the same review flow. |

## Observer Notes

Record:

- Time to first correct action.
- Any text the participant misreads.
- Any button label that requires explanation.
- Any panel that appears scrollable but cannot scroll.
- Any place where the participant expects an undo, cancel, or confirmation and does not see one.

## Release Decision

Phase 5 is usable for older non-technical scheduler officers only if all P5 tasks pass for desktop, mobile portrait, and mobile landscape observation, or each failure has a recorded fix before release.
