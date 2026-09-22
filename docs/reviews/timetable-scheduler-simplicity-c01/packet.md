# TIMETABLE-SCHEDULER-SIMPLICITY-C01

Base: `da4d289f7e854863e1f7f74ab210d61a607b934f`

## Goal

Make the Class Schedule workspace calm and mouse-first for older schedulers without changing server authority, generation semantics, publication authority, or live data.

## Owned source

- `atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts`
- `atlas-client/src/components/timetable/TimetableGrid.tsx`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspaceBody.tsx`
- `atlas-client/src/components/timetable/GeneratedUnassignedPanel.tsx`
- `atlas-client/src/components/timetable/UnassignedInsertionWorkflow.tsx`
- `atlas-client/src/components/timetable/TimetableCellOverflowSheet.tsx` when made unused
- focused client tests and `atlas-client/package.json` only when a new script is necessary

## Required behavior

1. Initial term selection follows the verified EnrollPro active ordered term. Preserve a deliberate user override for the current session.
2. Never fabricate missing term authority. If no verified active/configured term exists, show a plain setup-required state; do not query or render as Term 1.
3. `All terms` stays explicit. It renders every session in a dense cell directly; no `Show more` control or overflow sheet hides a session.
4. Replace technical/polling/cache/collaboration copy in the primary header with plain scheduler language, selected school year, selected term, selected schedule scope, plain state, and one safe next action.
5. Ordinary unassigned placement and swaps are mouse-first inline flows with an inspectable preview before the persisted action. Dialogs remain for publish, reset/discard, or a risky override only.
6. Do not change API contracts, server code, persistence payloads, generation/publish dispatch, actor scope, term identity, or release/runtime files.

## Reference

SMART mirror `D:/smart-final-capstone` is read-only at `75057cca46e11dbf516cf105eb4573e7b02d8e0b`. Adopt compact sticky orientation and progressive disclosure patterns, not its pixels or source.

## Required proof

- A real mounted timetable route test proves initial active-term selection and explicit all-terms behavior.
- A failing-first regression test proves no session is hidden behind a cell overflow control in all-terms mode.
- Focused tests cover user term override preservation, missing authority fail-closed behavior, plain-language next-action priority, and preview-before-save placement/swap.
- Client build and `git diff --check` pass.

## Explicitly out of scope

Dedicated QA draft creation, generation, deployment, browser data mutation, publication, and rollback are HIGH actions owned by the planner after source acceptance and a separate packet.
