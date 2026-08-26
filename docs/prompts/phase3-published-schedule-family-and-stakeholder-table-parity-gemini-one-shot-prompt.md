# Gemini Execution Prompt: Phase 3 Published Schedule Family And Stakeholder Table Parity One-Shot

## Goal

Refactor the published schedule surfaces so ATLAS is ready to present stakeholder-style schedule views for:

- students / sections
- teachers / faculty
- rooms

using a familiar table-first timetable presentation instead of only stacked card lists.

This is a frontend parity pass on top of the existing published schedule API family.

## Why This Pass Exists

Current verified state:

- backend published schedule endpoints already exist for:
  - latest published overall
  - section
  - faculty
  - room
- public frontend currently exposes only a section-first student browser
- authenticated faculty published schedule exists, but it is a card-list layout, not stakeholder-style timetable parity
- room schedules exist as a separate tool, but the published schedule family is not presented coherently
- live runtime currently has `PUBLISHED_RUN_NOT_FOUND`, so the UI must remain honest about “not published yet”

The problem is not only missing data today.
The product surface itself is still not shaped like the schedule artifacts stakeholders expect.

## In Scope

- `atlas-client/src/pages/PublicPublishedSchedule.tsx`
- `atlas-client/src/pages/MySchedule.tsx`
- `atlas-client/src/pages/RoomSchedules.tsx` only if needed for table-family parity
- shared schedule presentation components created under a suitable current client component path
- lightweight route-level UI additions if needed within the existing client router

## Out Of Scope

- changing publish lifecycle semantics
- synthesizing draft data into published pages
- teaching-load workspace changes
- timetable generator math
- backend API redesign unless a tiny payload adaptation is absolutely required for existing published endpoints

## Required References

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `question_prompt.pdf`
- `stakeholderFiles/`
- `atlas-client/src/pages/PublicPublishedSchedule.tsx`
- `atlas-client/src/pages/MySchedule.tsx`
- `atlas-client/src/pages/RoomSchedules.tsx`
- `atlas-server/src/routes/published-schedule.router.ts`

## Current Verified Problems

### 1. Public published schedule is section-only in the client

Server supports:

- section schedule
- faculty schedule
- room schedule

But current public/published client only exposes a section-first student browser.

### 2. Published schedule presentation is too card-based

Current faculty and student published views are primarily stacked cards by day.

Stakeholder expectation is closer to timetable-table artifacts from their files:

- compact
- scannable
- day/time structured
- easy to compare at a glance

### 3. Teacher and room schedule parity is incomplete

Teacher and room schedule data paths exist, but the app does not yet present a coherent family of published schedule views that mirrors stakeholder usage.

### 4. Empty-state honesty must remain intact

Because live runtime may still have no published run, the UI must remain explicit when a schedule is simply not published yet.

Do not fake schedule data from draft or review sources.

## Required Changes

### 1. Build a coherent published schedule family

Create a clearer published schedule family with explicit view modes such as:

- Sections
- Teachers
- Rooms

Use current available routes and data contracts.

### 2. Shift to a stakeholder-familiar table-first presentation

Primary published schedule views should default to a timetable-style table layout where appropriate, instead of only stacked cards.

Optimize for:

- scanability
- weekday comparison
- compact reading
- stakeholder familiarity

### 3. Keep section-first student access, but do not stop there

Preserve the current public section-first lookup, but extend the family so the published surfaces are not effectively “students only.”

### 4. Improve teacher published schedule presentation

`/my/schedule` should feel closer to an actual teacher timetable, not just a list of cards grouped by day.

### 5. Keep room schedule parity understandable

If room schedule remains a distinct route, visually align it with the same published schedule family rather than feeling like a separate product.

### 6. Preserve honest publish-state empty handling

If no published run exists:

- clearly say so
- do not attempt draft/review fallback
- keep all view modes honest and stable

## Interaction And Design Rules

- Use current `@/ui/*` primitives only
- no native form controls
- no browser-level page scroll regression
- no card-wall default when a compact table is the better fit
- use stakeholder familiarity as the guiding principle, not decorative redesign

## Verification Requirements

### Automated

- `npm --prefix atlas-client run build`

### Manual QA

Validate:

- `/public/schedules`
- `/my/schedule`
- `/room-schedules` if touched

Check specifically:

1. section, teacher, and room schedule modes are discoverable where in scope
2. table-first schedule reading is available and readable
3. current no-published-run state is handled clearly
4. no draft/review data leaks into public published surfaces
5. subject/teacher/room names do not overflow or collapse badly in the table layout

### Evidence

Append only to `docs/verification/evidence-log.md`.

Include:

- touched files
- which published schedule modes were added or refined
- whether stakeholder-style table parity improved
- whether no-published-run empty states remained honest
- GO / NO-GO verdict

## GO / NO-GO

### GO only if

- published schedule family is broader than section-only browsing
- stakeholder-familiar table reading is materially improved
- no-published-run handling remains explicit and truthful

### NO-GO if

- public/student schedule remains effectively section-cards only
- teacher and room published parity still feel stranded
- publish-state honesty is weakened by fake or draft-derived fallbacks
