# Prompt 7: Faculty Trust And Freshness Repair

## Mission

Fix teacher-facing freshness and trust problems on faculty pages.

This prompt can be run in two lanes. Runtime/source honesty can run early if faculty pages are already misleading. Revision-aware invalidation should run after Prompts 6a-6c.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `.github/copilot-instructions.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- `docs/phases/faculty-mobile-wireframe-spec.md`
- `docs/reports/crud-teaching-load-timetable-audit-2026-05-31.md`
- `docs/prompts/teaching-load-timetable-repair-sequence-2026-05-31.md`

Apply:

- `atlas-21st-dev-frontend`
- `atlas-mobile-faculty-ux`
- `atlas-faculty-usability-first`
- `atlas-copy-and-microcopy`
- `atlas-offline-realtime-reliability`
- `atlas-ux-audit-gate`

Inspect before editing:

- `atlas-client/src/pages/MySchedule.tsx`
- `atlas-client/src/pages/FacultyRoomPreferences.tsx`
- faculty dashboard page/components
- faculty cache/bootstrap helpers
- room-request outbox/sync helpers
- publish/revision event hooks if present
- faculty portal API aggregation paths if cache keys are backend-owned

## Product Decisions

- Faculty schedule and room-request caches must become run/revision-aware.
- Use `runId` and `publishedAt` where available.
- After revision work exists, include revision/effective-date semantics in invalidation.
- Faculty copy must avoid leading with `run`, `gate`, or `stale run data`.
- Outbox status must be visible in plain language, not toast-only.

## Scope

In scope:

- `/my/schedule` freshness and cache keys.
- `/my/room-preferences` bootstrap/cache/outbox visibility.
- My Dashboard refresh/trust cues where relevant.
- publish/revision/room-decision invalidation hooks where available.
- faculty mobile UX verification.

Out of scope:

- Timetable Tactical Dock.
- Published revision data model if not already implemented.
- New notification platform.
- Full faculty redesign.

## Mandatory Outcomes

### 1. Run-aware schedule cache

Faculty schedule cache keys must account for:

- school year
- published run ID
- `publishedAt`
- revision/effective-date marker where available

Old same-day schedule snapshots must not survive a new publish or revision publish.

### 2. Room-request bootstrap freshness

Room request bootstrap/cache must refresh or invalidate when:

- a new publish changes the draft/published schedule context
- a room decision event changes request status
- revision publish changes effective schedule context

### 3. Visible refresh and source honesty

Add or preserve a clear refresh action where it helps:

- `Refresh schedule`
- `Check for updates`

Use source-state copy that a teacher can understand:

- `Showing latest saved schedule`
- `Checking for updates`
- `Waiting for connection`
- `Some requests are waiting to send`

### 4. Outbox count visibility

If room requests are queued offline, show a persistent count such as:

- `2 requests waiting to send`

Do not hide the queue state behind toast-only feedback.

## Required Verification And Repair Loop

Run after implementation:

- `npm --prefix atlas-client run build`
- `npm --prefix atlas-server run build` if backend touched
- targeted cache-key/invalidation tests or probes
- line-count and primitive scans for touched React files

Browser/Tailnet smoke:

- `/my/schedule` mobile portrait and desktop/narrow check
- `/my/room-preferences` mobile portrait and offline/outbox state if feasible
- refresh action behavior
- source-state copy review

Self-correction requirement:

- If cache invalidation, outbox visibility, build, or mobile smoke fails, fix in the same session and rerun the failed check once.

## Required Output

Return:

- files changed
- cache key/invalidation contract
- faculty copy changes
- outbox state evidence
- build/browser results
- evidence-log/source-map updates
- prompt-scope `GO` or `NO-GO`