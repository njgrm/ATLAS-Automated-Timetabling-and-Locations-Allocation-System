# Gemini Execution Prompt: Phase 3 Faculty Offline Publish UX And Degraded State One-Shot

## Objective

Turn the current faculty-facing ATLAS experience into a clear, trustworthy offline-capable portal now that the runtime/backend pass has already landed.

This pass must cover the faculty surfaces involved in published schedule access and degraded/offline continuity:

- `/login`
- `/my`
- `/my/schedule`
- `/my/preferences`
- `/my/room-preferences`
- shell/source-state messaging affecting faculty users

Do not redesign the product.
Build on the existing faculty shell and mobile-responsive direction.

## Out of Scope

Do not:

- rewrite backend auth or caching logic
- rebuild faculty navigation from scratch
- redesign scheduler/admin pages
- create student/public publish UI here
- add speculative product flows not backed by the runtime/backend pass

## Required Context

Read first:

- `GEMINI.md`
- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-paper-alignment-audit-2026-05-24.md`
- `docs/analysis/phase3-offline-capability-and-outage-ui-audit-2026-05-25.md`
- `docs/verification/evidence-log.md` and specifically:
  - `# 2026-05-26 - Phase 3 Faculty Offline Publish Readiness One-Shot`

Inspect directly:

- `atlas-client/src/pages/Login.tsx`
- `atlas-client/src/pages/MyDashboard.tsx`
- `atlas-client/src/pages/MySchedule.tsx`
- faculty preference and room-request pages
- `atlas-client/src/components/AppShell.tsx`
- faculty dashboard components and any new offline/source-state UI components

Use Context7 first if you need version-sensitive guidance for:

- `shadcn/ui`
- `Tabs`
- `HoverCard`
- `Popover`
- `Tooltip`
- `Badge`
- `motion`

## Facts To Treat As Settled

- local faculty login already exists
- admin and faculty accounts are already provisioned from EnrollPro-backed identities into ATLAS auth
- the faculty problem is now completion and usability, not greenfield identity design
- the backend/runtime pass has already delivered:
  - `/my/schedule`
  - service worker + manifest baseline
  - ATLAS-first faculty runtime bootstrap
  - degraded cache behavior
  - reconnect recovery support

This pass must make that understandable and professional for faculty users.

## Current UX Failure To Correct

The faculty experience still does not match the paper’s promise cleanly because:

- `/my/schedule` now exists, but the faculty-facing presentation still needs closure-grade polish
- outage/degraded communication is still inconsistent
- pages still feel more technical than intentional when they fall back to saved ATLAS data
- source-state wording is still too system-oriented for teachers

Faculty users need to understand in plain language:

1. whether they are seeing verified live school data or saved ATLAS data
2. whether they can keep working right now
3. what will sync or refresh when EnrollPro comes back
4. where to find their published schedule

## Required Product Outcomes

Faculty users should be able to:

- sign in confidently
- understand what the portal can do right now
- open `/my/schedule` as the primary published-schedule destination
- understand whether schedule, preference, and request data is live or saved
- understand whether changes will sync later

## Required UX Changes

### A. Make `/my/schedule` feel like the primary faculty destination

Required:

- treat the newly implemented published faculty schedule as the primary faculty destination
- make it visually and structurally consistent with the rest of the faculty portal
- emphasize clarity of:
  - class
  - section
  - room
  - day/time
  - school year
  - source state

This should feel like a real teacher-facing schedule page, not a debug surface.

### B. Normalize faculty source-state messaging into plain language

Required:

- do not use technical labels like:
  - `ATLAS Mirror`
  - `Cached snapshot`
  - `Live upstream-backed`
- prefer plain-language phrasing such as:
  - `Verified with EnrollPro`
  - `Working from saved ATLAS data`
  - `Saved data only`
  - `You can keep working`
  - `This action will sync when EnrollPro returns`

Use the same language family across:

- login
- shell
- `/my`
- `/my/schedule`
- preferences
- room requests

Also normalize existing backend/runtime-derived notices such as:

- `Working from saved ATLAS school-year context`
- `Using your last saved faculty account link while offline`
- `Saved published schedule`

These are directionally honest, but still need more teacher-friendly phrasing and hierarchy.

### C. Make degraded/offline mode feel intentional, not broken

Required:

- if ATLAS already has enough data, the faculty portal should look intentionally usable in outage mode
- clearly distinguish:
  - what is viewable now
  - what is editable now
  - what is queued or waiting for reconnect
- avoid panic/error framing when the user can still keep working
- preserve honest limits where actions are still blocked

Current evidence to preserve:

- `/my` remains accessible offline
- `/my/schedule` can open from saved data
- `/my/preferences` stays readable and disables submit honestly when offline
- `/my/room-preferences` can surface honest retry/dependency guidance

### D. Clarify reconnect and sync recovery

Required:

- explain in simple language what will happen when EnrollPro returns
- show whether saved data is waiting to refresh
- if a faculty action is queued or waiting on reconnect, make that state understandable without technical jargon

Current evidence to preserve:

- `/my/preferences` returns to online interaction state after reconnect
- `/my/room-preferences` recovers from offline transport failure to live draft-status guidance after reconnect

### E. Preserve current mobile responsiveness and shell patterns

Required:

- stay within the current faculty shell/navigation style
- keep the mobile-responsive design
- avoid turning the portal into a dashboard of large cards
- keep layouts compact and readable

## Implementation Direction

- build on current faculty shell and dashboard conventions
- use `shadcn/ui` primitives only
- keep copy calm and direct
- use plain language instead of system language
- prefer one clear source-state banner or status line over multiple mixed labels

## Verification Gates

Required:

- `npm --prefix atlas-client run build`
- verify no raw HTML interactive controls were introduced
- verify the new faculty schedule surface remains mobile-friendly
- verify degraded/offline copy is plain-language and consistent
- verify `/my/schedule` is discoverable and clearly faculty-facing
- verify the shell and faculty pages communicate reconnect/sync behavior understandably
- verify the new UI does not erase or contradict the honest backend/runtime notices already proven in the evidence log

## Required Output

Return:

1. files changed
2. faculty schedule UX changes
3. faculty degraded/offline messaging changes
4. shell/source-state copy normalization changes
5. mobile/readability confirmation
6. verification results
7. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- the faculty portal now has a real `/my/schedule` experience
- outage/degraded behavior is understandable in plain language
- faculty users can tell what is live, saved, writable, or queued
- the updated experience feels intentional and trustworthy rather than technically degraded
