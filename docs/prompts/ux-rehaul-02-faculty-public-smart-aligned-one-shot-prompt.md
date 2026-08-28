# UX Rehaul Prompt 02: Faculty + Public SMART-Aligned Refactor One-Shot

## Mission

Redesign ATLAS faculty and public schedule experiences so low-tech users immediately understand what to do, while refactoring oversized faculty files below the 1000-line rule.

This pass should make ATLAS faculty/public UX feel like the same product family as SMART teacher pages: warm, role-specific, school-branded, and task-first. ATLAS remains a scheduling product, so the user jobs are schedule viewing, preference submission, and room requests.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/plans/ux-ui-rehaul-and-1000-line-refactor-plan-2026-05-29.md`
- `docs/reports/ux-ui-atlas-full-audit-2026-05-29.md`
- `docs/reports/ux-ui-atlas-vs-smart-comparison-audit-2026-05-29.md`
- `docs/prompts/ux-rehaul-smart-identity-sequence-2026-05-29.md`
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- `docs/phases/faculty-mobile-wireframe-spec.md`

Inspect directly:

- `atlas-client/src/pages/PublicPublishedSchedule.tsx`
- `atlas-client/src/pages/MyDashboard.tsx`
- `atlas-client/src/pages/MySchedule.tsx`
- `atlas-client/src/pages/FacultyPreferences.tsx`
- `atlas-client/src/pages/FacultyRoomPreferences.tsx`
- `atlas-client/src/components/faculty-preferences/MobilePreferencesLayout.tsx`
- `atlas-client/src/components/faculty-room-preferences/MobileRoomRequestLayout.tsx`
- `atlas-client/src/components/faculty-shared/FacultyGlobalHeader.tsx`
- `external-references/FINAL-CAPSTONE-SMART/src/pages/teacher/Dashboard.tsx`
- `external-references/FINAL-CAPSTONE-SMART/src/pages/teacher/ClassRecordsList.tsx`
- `external-references/FINAL-CAPSTONE-SMART/src/pages/teacher/components/ClassRecordMobileList.tsx` if present

## Required Skills / Rules

Apply:

- `.github/skills/atlas-21st-dev-frontend/SKILL.md`
- `.github/skills/atlas-mobile-faculty-ux/SKILL.md`
- `.github/skills/atlas-design-system-enforcer/SKILL.md`
- `.github/skills/atlas-ux-audit-gate/SKILL.md`
- `.github/skills/atlas-copy-and-microcopy/SKILL.md`
- `.github/skills/atlas-faculty-usability-first/SKILL.md`
- `.github/skills/atlas-offline-realtime-reliability/SKILL.md` for offline/sync surfaces
- `.github/skills/atlas-shared-browser-qa/SKILL.md` if doing browser QA

Use Context7 for Sheet/Dialog/Popover/Tabs/ScrollArea/motion/a11y behavior if uncertain.

## SMART Identity Target For Faculty/Public

Adopt these SMART teacher-facing strengths:

- role greeting and clear portal context
- task cards for actual user work
- school-branded but calm visual identity
- friendly but official error states
- large, readable mobile cards
- obvious primary actions
- grade/section labels that feel familiar to school users

Do not copy SMART's grading domain, oversized decorative cards, hover-only archived delete actions, or raw controls.

## Hard Scope

Touch faculty/public frontend only:

- `atlas-client/src/pages/PublicPublishedSchedule.tsx`
- `atlas-client/src/pages/MyDashboard.tsx`
- `atlas-client/src/pages/MySchedule.tsx`
- `atlas-client/src/pages/FacultyPreferences.tsx`
- `atlas-client/src/pages/FacultyRoomPreferences.tsx`
- `atlas-client/src/components/faculty-preferences/*`
- `atlas-client/src/components/faculty-room-preferences/*`
- `atlas-client/src/components/faculty-shared/*`
- new local components/hooks under those feature folders

Do not change backend API contracts unless a tiny presentation field is absolutely required and service/controller boundaries are preserved.

## Mandatory Refactor Outcomes

### 1. Refactor `FacultyRoomPreferences.tsx`

Bring it under 1000 lines.

Extract at minimum:

- `components/faculty-room-preferences/RoomRequestPageShell.tsx`
- `components/faculty-room-preferences/RoomRequestStepState.tsx`
- `components/faculty-room-preferences/RoomRequestStatusBanners.tsx`
- `components/faculty-room-preferences/RoomRequestActionBar.tsx`

Keep data loading and submit semantics intact.

### 2. Public schedule becomes search-first

`/public/schedules` first viewport must focus on:

- `Find your class schedule`
- search by section
- grade/program filters as secondary helpers
- readable section results

Hide `Run #`, `School 1`, numeric school-year IDs, and scheduler diagnostics from the main path.

Use `Official schedule`, `Showing the last saved copy`, or `No official schedule has been published yet` copy.

### 3. Faculty schedule becomes official-status-first

`/my/schedule` should lead with:

- `Your Official Schedule`
- whether the schedule is published, under review, or not available yet
- today/weekly schedule view
- room and time details in mobile-readable cards

Hide `Published run`, raw source labels, and version IDs behind details.

### 4. Faculty dashboard becomes role/task-first

`/my` should answer:

- Do I need to submit anything today?
- Is my official schedule available?
- Is a room request pending?
- What changed recently?

Use one dominant CTA. Do not show a generic system dashboard.

### 5. Faculty preferences use privacy-aware language

Rewrite support/preference labels so they feel official and respectful.

Avoid exposing sensitive terms as loud headings. Use calm, optional support language with short explanations.

### 6. Room request Step 2 becomes simpler and touch-friendly

Required:

- clearer legend
- larger touch targets, minimum 44px for primary controls
- semantic stepper with `aria-current`
- visible selected states
- one primary next action per step

### 7. Standardize faculty/public states

Create or reuse a shared pattern for:

- loading
- empty
- no official schedule yet
- offline / queued
- saved-copy mode
- failed sync / retry

Each state must include what happened, what to do now, and who owns the next step if blocked.

## Copy Requirements

Replace main-path terms:

- `Published run` -> `Official schedule`
- `Run ID` -> hide under details as `Schedule version`
- `Latest run` -> `Most recent schedule`
- `Upstream unavailable` -> `Enrollment data cannot be reached`
- `Saved data` -> `Showing the last saved copy`
- `Runtime context` -> `Current school year`

## Visual Requirements

- Use SMART-like white cards/surfaces on a token-tinted light slate background.
- Use configured school/theme primary tokens for primary actions and active state. Do not hardcode emerald for brand identity; reserve emerald for success/correctness states.
- Use task/object cards only where they represent a class, request, or schedule day.
- Avoid giant decorative hero sections.
- Avoid nested cards.
- Keep mobile layouts intentionally different from desktop where needed.

## Verification Gates

Required:

- `npm --prefix atlas-client run build`
- line count check for `FacultyRoomPreferences.tsx` and any touched large files
- mobile and desktop smoke checks for:
  - `/public/schedules`
  - `/my`
  - `/my/schedule`
  - `/my/preferences`
  - `/my/room-preferences`
- faculty login check if runtime is available
- public no-login check for `/public/schedules`

If Tailnet is unavailable, record local-only evidence and keep live evidence pending.

## Required Output

Return:

1. before-state problems fixed
2. files changed
3. refactor summary with before/after line counts
4. SMART identity changes applied
5. public schedule UX summary
6. faculty schedule/dashboard/preference UX summary
7. offline/saved-copy state summary
8. accessibility/touch target notes
9. verification results
10. `GO` or `NO-GO`

## GO Condition

Return `GO` only if:

- public users can find a section schedule quickly without login
- faculty users see task-first, nontechnical schedule/preference/room-request surfaces
- `FacultyRoomPreferences.tsx` is under 1000 lines
- no first-viewport faculty/public copy exposes raw run/source IDs
- mobile faculty controls meet touch ergonomics
- local build passes
