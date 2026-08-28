# Copilot Execution Prompt: Phase 3 Offline Runtime Closure Multi-Page One-Shot

## Objective

Finish the next real offline/runtime-independence pass across the pages that still depend too directly on EnrollPro during bootstrap.

This is not a generic PWA prompt.
It is a focused multi-page runtime-closure pass for the pages that still fail or stall even though ATLAS already has enough local data to keep working.

The goal is:

- ATLAS-first bootstrap
- honest degraded read/write behavior
- clean sync recovery once EnrollPro is back

## Out of Scope

Do not:

- redesign page layouts beyond necessary state/copy/status adjustments
- reopen Teaching Load staffing math
- reopen Subject or Teacher catalog UX
- change business scope for generation or publish lifecycle
- add fake stub data for production-like runtime paths

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/analysis/phase3-offline-capability-and-outage-ui-audit-2026-05-25.md`
- `docs/analysis/phase3-enrollpro-outage-runtime-independence-audit-2026-05-24.md`
- `docs/verification/evidence-log.md`

Inspect directly:

- `atlas-client/src/lib/settings.ts`
- `atlas-client/src/lib/enrollpro-public-settings.ts`
- `atlas-client/src/components/AppShell.tsx`
- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/pages/RoomSchedules.tsx`
- `atlas-client/src/pages/Sections.tsx`
- `atlas-client/src/pages/OfficerPreferences.tsx`
- `atlas-client/src/pages/FacultyPreferences.tsx`
- `atlas-client/src/pages/OfficerRoomPreferences.tsx`
- `atlas-client/src/pages/FacultyRoomPreferences.tsx`
- `atlas-client/src/pages/MyDashboard.tsx`
- `atlas-client/src/components/RoomScheduleOverlay.tsx`
- `atlas-server/src/services/runtime-context.service.ts`
- `atlas-server/src/services/section.service.ts`
- any room-preference or preference services/routes involved in degraded bootstrap

## Findings To Treat As Real

- `Teaching Load`, `Teachers`, `Sections`, `Subjects`, `Dashboard`, and `Audit` have made meaningful ATLAS-side continuity progress already.
- `Timetable`, `Room Schedules`, both preferences pages, both room-request pages, and `My Dashboard` still lag because they bootstrap from `fetchPublicSettings()` and/or `fetchSchoolYears()`.
- shell branding still depends on live EnrollPro settings.
- `Sections` now has real `atlas-mirror` continuity, but still does not fully meet the intended degraded write model.
- local outbox logic already exists in room-request flows, but bootstrap still depends too much on EnrollPro.

This is no longer mainly a storage problem.
It is a bootstrap-order and degraded-contract problem.

## Required Product Outcome

If ATLAS has already synced the relevant school once, then while EnrollPro is down:

- the shell should still open with stable school-year context
- scheduler pages should not block on EnrollPro just to discover the school year
- `Timetable` should bootstrap from ATLAS-owned school-year/runtime evidence
- `Room Schedules` should bootstrap from ATLAS-owned school-year/runtime evidence
- `Officer Preferences` should bootstrap from ATLAS-owned school-year/runtime evidence
- `Faculty Preferences` should bootstrap from ATLAS-owned school-year/runtime evidence
- `Officer Room Requests` should bootstrap from ATLAS-owned school-year/runtime evidence
- `Faculty Room Requests` should bootstrap from ATLAS-owned school-year/runtime evidence
- `My Dashboard` should bootstrap from ATLAS-owned school-year/runtime evidence
- `Sections` should support the intended safe degraded work path if ATLAS local evidence is sufficient

Unsafe upstream refresh operations may still fail honestly.
But page-open and ATLAS-owned work should not collapse just because EnrollPro is down.

## Implementation Requirements

### A. Remove direct EnrollPro active-year bootstrap from the lagging pages

Replace first-load dependence on `fetchPublicSettings()` / `fetchSchoolYears()` for school-year context with:

- `resolveActiveSchoolYearContext()`
- persisted ATLAS runtime evidence
- optional EnrollPro verification after the page is already usable

Pages in scope:

- `useTimetableData.ts`
- `RoomSchedules.tsx`
- `OfficerPreferences.tsx`
- `FacultyPreferences.tsx`
- `OfficerRoomPreferences.tsx`
- `FacultyRoomPreferences.tsx`
- `MyDashboard.tsx`
- `RoomScheduleOverlay.tsx`

Do not remove EnrollPro branding support entirely.
Do remove EnrollPro as a hard prerequisite for runtime school-year bootstrap.

### B. Harden shell runtime continuity

The shell must not depend on live EnrollPro settings just to remain intelligible.

Required:

- preserve `runtime/context`-driven active-year continuity
- persist or cache enough school identity metadata for degraded reopen
- ensure the shell can render a stable school-year state even if branding refresh fails

This may use client-side persistence and/or an ATLAS-owned backend-assisted read model, whichever is simpler and defensible.

### C. Finish degraded write parity for `Sections`

Bring `Sections` closer to the model already used in `Teaching Load`.

Required:

- allow safe ATLAS-owned edits when runtime evidence is sufficient
- keep destructive or upstream-dependent sync actions separately guarded
- ensure degraded writable behavior is not accidentally downgraded back to blanket read-only

At minimum, home-room changes should follow a clear safe-local / later-sync model if current local evidence is sufficient.

### D. Make room-request and preference flows bootstrap from local runtime context first

The pages may still require online state for some submission/review operations.
That is acceptable.

But the page should not fail to open or fail to know its school year simply because EnrollPro settings are unavailable.

Where local outbox or persisted workflow state already exists, preserve and use it.

### E. Preserve clean sync recovery

When EnrollPro comes back:

- explicit refresh/sync actions must still work
- pages must recover back to verified/live mode cleanly
- local cached state must not prevent fresh upstream confirmation

### F. Keep source labels technically honest

If a page is running from saved ATLAS data, do not label it as live upstream data.

You do not need to solve final layman copy polish in this pass.
You do need the data-mode contract to be technically correct.

## Verification Requirements

You must not stop at build success.

Required:

1. `npm --prefix atlas-client run build`
2. `npm --prefix atlas-server run build`
3. verify active school-year bootstrap for all in-scope pages no longer depends first on `fetchPublicSettings()`
4. verify `Sections` degraded writable behavior with sufficient local evidence
5. verify at least one preference or room-request page can open its base view from ATLAS-owned runtime context when upstream settings are unavailable
6. verify `Timetable` and `Room Schedules` can resolve their school-year context without calling EnrollPro first

## Mandatory Tailnet / Simulated-Outage Proof

Do not return `GO` without proving the behavior under one of:

- real EnrollPro outage
- simulated failure of `/enrollpro-api/settings/public`
- simulated failure of the relevant EnrollPro bootstrap requests while ATLAS runtime context already exists

You must prove at least these:

- shell still resolves the active school year
- one scheduler page from the lagging group still opens
- one faculty-facing page from the lagging group still opens
- `Sections` safe local work remains available when local evidence exists

If those are not proven, return `NO-GO`.

## Required Output

Return:

1. files changed
2. pages migrated away from direct EnrollPro school-year bootstrap
3. shell/runtime continuity changes
4. `Sections` degraded-write parity changes
5. room-request / preference bootstrap changes
6. build results
7. Tailnet or simulated-outage verification results
8. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- the lagging pages no longer depend first on EnrollPro just to resolve school-year context
- the shell still has a stable active-year story during outage
- `Sections` degraded write behavior is materially improved and honest
- at least one scheduler page and one faculty-facing page from the lagging group are proven to open from ATLAS-owned runtime context during outage-like conditions
