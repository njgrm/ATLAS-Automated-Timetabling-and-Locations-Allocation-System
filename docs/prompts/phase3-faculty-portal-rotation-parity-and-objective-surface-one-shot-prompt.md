# Copilot Execution Prompt: Phase 3 Faculty Portal Rotation Parity And Objective Surface One-Shot

## Goal

Make the faculty-side objective surface truthful and usable for real teachers after identity mapping is fixed.

This pass must ensure that faculty can understand:

- what they teach
- whether those classes are draft-plotted yet
- how room requests relate to the active draft
- and, for rotational loads such as Science/TLE, what changes across terms

## Why This Pass Exists

Live audit on the current faculty experience found:

- the faculty portal already exists and is intentionally draft-run aware
- preferences are school-year scoped and implemented
- room requests are active-draft scoped and implemented
- but the faculty portal currently collapses to a weak empty-state when the authenticated teacher mapping or draft plotting is missing
- current dashboard teaching identity is a shallow list and does not communicate rotational/term-aware teaching truth
- Science/TLE teachers need explicit term-aware communication because the same teacher can carry rotating subject identity across the year

Stakeholder expectation is not just “show a teacher name.”
It is “show what I handle, and if it rotates, show that clearly.”

## In Scope

- `atlas-server/src/services/faculty-portal.service.ts`
- `atlas-server/src/services/faculty-assignment.service.ts` only as needed to expose faculty-facing identity truth
- `atlas-client/src/pages/MyDashboard.tsx`
- `atlas-client/src/components/faculty-dashboard/DesktopDashboardLayout.tsx`
- `atlas-client/src/components/faculty-dashboard/MobileDashboardLayout.tsx`
- `atlas-client/src/pages/FacultyRoomPreferences.tsx`
- `atlas-client/src/pages/FacultyPreferences.tsx` only if copy or objective-state clarity needs minor adjustment

## Out Of Scope

- public student schedule redesign
- published schedule family expansion
- teaching-load workspace redesign
- new timetable generation algorithms
- broad authentication redesign

## Required References

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `atlas-server/src/services/faculty-portal.service.ts`
- `atlas-server/src/services/faculty-assignment.service.ts`
- `atlas-client/src/pages/MyDashboard.tsx`
- `atlas-client/src/components/faculty-dashboard/DesktopDashboardLayout.tsx`
- `atlas-client/src/components/faculty-dashboard/MobileDashboardLayout.tsx`
- `atlas-client/src/pages/FacultyRoomPreferences.tsx`
- `atlas-client/src/pages/FacultyPreferences.tsx`

## Finalization Addendum From Prior Swap Repair

This pass must account for the `2026-05-27 - Phase 3 Timetable Swap Regression Repair One-Shot` finding: occupied-slot drag and keyboard placement now route through review/swap confirmation instead of silently committing. Faculty room-request copy should therefore frame occupied-slot changes as review requests that the scheduling officer must decide, not as immediate timetable edits.

Apply these UI references while executing the prompt:

- `docs/DESIGN.md`: one obvious next action, plain-language state, and faculty role-appropriate complexity.
- `docs/DESIGN-INSPIRATION.md`: guided workflow and actionable empty-state patterns.
- `docs/phases/faculty-mobile-wireframe-spec.md`: `/my` and `/my/room-preferences` mobile content order and room-request step framing.
- Context7 preflight: shadcn/ui composition (`Alert`, `Badge`, `Card`, `Tooltip` / `HoverCard`) and Motion reduced-motion guidance if adding or changing animated states.

## Current Verified Problems

### 1. Faculty objective state is too easy to misread

A faculty user can currently see:

- `ACTIVE_DRAFT`
- zero preview entries
- zero teaching assignments
- zero room entries

without a clear explanation of whether that means:

- no teaching load
- no plotted timetable yet
- wrong faculty mapping
- or no publish yet

### 2. Rotational teaching truth is not communicated well enough

Science and TLE can rotate by term, but the current faculty dashboard teaching identity is only a shallow list of subject/section labels.

It does not adequately explain:

- stable all-year section ownership
- rotating subject identity by term
- term labels
- specialization/rotation nuance where relevant

### 3. Faculty room-request workflow is not framed clearly against draft plotting

Room requests are draft-run based, but when no draft entry exists for a teacher, the page falls back to a generic “schedule isn't ready yet” style message instead of distinguishing:

- teaching load exists
- but the draft timetable has not yet plotted this teacher
- or an occupied-slot request is a scheduler-reviewed swap request, not an immediate move

## Required Changes

### 1. Make faculty portal state explicit

The faculty portal must clearly distinguish between these states:

- no teaching load identity
- teaching load identity exists, but no active draft timetable entries are plotted yet
- active draft timetable entries exist
- published schedule not yet available

Do not collapse these into one generic empty-state.

### 2. Add rotational teaching identity communication

For rotational families such as Science and TLE:

- expose term-aware assignment meaning on the faculty-facing dashboard
- show the stable class/section ownership together with the term-varying subject identity
- communicate term labels in plain language

Examples of acceptable communication:

- grouped term chips
- “Rotates by term”
- term-specific subject summary under the class group

Do not dump raw backend jargon.

### 3. Keep the dashboard useful even before publish

The dashboard is a review-phase tool.

It must remain useful before publish by showing:

- draft-plotted class preview where available
- teaching identity even if draft plotting is absent
- room-request readiness status

### 4. Align room-request empty states with real faculty state

If a teacher has teaching-load identity but no draft timetable entries yet:

- do not imply they have no classes
- explain that the draft timetable has not yet placed their classes for room-request review

If the teacher truly has no teaching load, say that explicitly.

### 5. Preserve the preferences vs room-requests distinction

Preferences and room requests must remain distinct:

- preferences = school-year availability / well-being intent
- room requests = active-draft timetable adjustments

Make that distinction more obvious in faculty-facing copy and hierarchy.

## Verification Requirements

### Automated

- `npm --prefix atlas-client run build`
- `npm --prefix atlas-server run build`

### Tailnet Manual Verification

Verify against a current source-valid faculty account with rotational teaching load.

At minimum check:

1. `/my` renders without crash
2. faculty dashboard explains whether the teacher has teaching identity, draft entries, both, or neither
3. rotational Science/TLE truth is visibly communicated when applicable
4. `/my/room-preferences` explains the difference between “no plotted draft entries yet” vs “no teaching assignment”
5. `/my/preferences` still behaves as a separate school-year preference tool

### Evidence

Append only to `docs/verification/evidence-log.md`.

Include:

- which faculty account was used for live verification
- whether the faculty has rotational teaching load in current truth
- whether dashboard rotation communication was added
- whether empty-state differentiation was corrected
- screenshots or route notes if available
- GO / NO-GO verdict

## GO / NO-GO

### GO only if

- faculty dashboard no longer hides meaning behind generic emptiness
- rotational teaching truth is clearly communicated for Science/TLE where applicable
- room-request state is framed honestly against active draft plotting

### NO-GO if

- a loaded rotational teacher still sees a misleading blank dashboard
- the portal still cannot distinguish “not plotted yet” from “no teaching load”
- term-aware rotation truth is still absent from the faculty-facing objective surface
