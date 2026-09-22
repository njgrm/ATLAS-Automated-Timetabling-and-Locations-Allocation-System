# TEACHER-INPUT-SIMPLE-SURFACE-C01 — surface teacher requests and preferences where a scheduler works

**Status:** `PREPARED — BLOCKED on one external decision` (see §0). **Risk:** MEDIUM (client surface +
one consumption path). **Owner:** Lane A.

## 0. Why this is blocked, and what unblocks it

The ATLAS operator's direction (2026-09-22): teacher preferences and room requests come back into the
Timetable, and **SMART owns the teacher-facing side** while ATLAS consumes it. The SMART contract is
requested in `docs/handoffs/smart-teacher-preferences-and-room-requests-2026-09-22.md`, which asks them
to choose between:

- **(a)** SMART owns **submission only** — ATLAS keeps the officer review + appeal workflow; or
- **(b)** SMART owns the **whole lifecycle** — ATLAS consumes only decided outcomes and retires its
  review surface.

**That choice decides this packet's shape**, so it is not specified further until they answer. What is
already true and does not depend on them is recorded below.

## 1. What exists today (measured 2026-09-22, `origin/main`)

Both features are **fully implemented and completely unused** — `faculty_preferences`,
`preference_time_slots`, `preference_reviews`, `faculty_room_preferences`, `room_request_appeals` and
`room_request_appeal_history` all hold **0 rows**.

- **Teacher pages:** `/my/preferences`, `/my/room-preferences` — both gated **`facultyOnly: true`** in
  `app-shell/navigation.ts:52-53`, which is why the operator's officer account cannot see them.
- **Officer review page:** `/faculty/preferences` (group "Teachers and Rooms").
- **Timetable wiring:** the Advanced workspace already carries room-request context
  (`LeftRailContent`, `RightPanel`, `ScheduleReviewWorkspace`, `TimetableWorkflowDialogs`,
  `useTimetableMutations`, `useTimetableData`) — this is the "semblance in the advanced view".
- **Generation already consumes preferences** (`generation-input-snapshot.service.ts`,
  `generation-preflight.service.ts`), so the scheduling consequence exists server-side.

## 2. The deliverable (once §0 is answered)

Bring the teacher-submitted data into the **Simple** workspace where a scheduler resolves blockers —
not only into Advanced — so that a request or preference is visible **next to the session it affects**
and can be acted on there. The exact actions depend on §0:

- if **(a)**: Simple shows pending submissions with an officer decision control, routed through the
  existing review workflow;
- if **(b)**: Simple shows decided outcomes as information (nothing to approve) and the ATLAS review
  surface is retired.

## 3. Boundaries (independent of §0)

- Do not duplicate the teacher-facing forms in ATLAS. Once SMART owns submission, ATLAS's
  `/my/preferences` and `/my/room-preferences` are retired or left dormant — they are not developed.
- Keep the **run/entry/term binding** (`runId`, `entryId`, `termIndex`): a room request is meaningless
  without the exact session, and that identity lives in ATLAS.
- Match teachers on **`employeeId` / external faculty id**, never a local surrogate, and fail closed on
  an unmatchable identity.
- Preserve the existing no-scroll architecture and `@/ui` primitives in the Simple workspace.
- No generation, publication, migration, or live-data action is unlocked by this packet.

## 4. Next action

Send §5 of the SMART handoff, get **(a)** or **(b)**, then author the implementation packet against that
answer. Until then this stays `BLOCKED(EXTERNAL_DECISION)` — do not start it.
