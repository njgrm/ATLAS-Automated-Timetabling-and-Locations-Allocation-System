# Copilot Execution Prompt: Phase 3 Faculty Preferences, Room Requests, Acknowledgement, And Mobile Hardening One-Shot

## Goal

Repair the faculty preference and room-request experience so it matches stakeholder expectations:

- remove faculty time preferences from the preference workflow
- make remaining preferences scheduler-visible and timetable-respected where they can be enforced
- make manual-only notes explicit instead of implying algorithmic enforcement
- make room requests work reliably against the same latest draft for teachers and schedulers
- provide visible teacher-scheduler acknowledgement after request decisions
- rebuild the faculty mobile UX so the first screen is usable on a phone

This is a Phase 3 generator-readiness and faculty-portal hardening pass. It must not drift into published-schedule or Phase 5+ work.

## Why This Pass Exists

Live audit on 2026-05-28 found that the current implementation is partially real but not yet trustworthy enough for operators:

- `/my/preferences` still exposes a dense weekly time grid on mobile, even though stakeholders do not want time preferences.
- Well-being preferences are persisted and visible to the scheduler, but the generator currently consumes only `timeSlots`; well-being toggles are not proven as timetable inputs.
- Scheduler preference summary contains a submitted ELPIDIO AQUINO preference for stale `FacultyMirror.id=17905`, while the repaired faculty login `2000056` resolves to assignment-bearing `FacultyMirror.id=18189` and has no current preference record.
- `/my/room-preferences` can load active-draft class entries and can submit move/swap requests, but live latest-run behavior diverged between faculty and scheduler endpoints during QA.
- A submitted room-swap request was visible in the run-specific scheduler queue and a scheduler rejection returned to the teacher in run-specific state, but the teacher's later `latest` state no longer showed that decision after a different latest run resolved.
- Mobile room-request UX starts too deep in the flow, shows a wall of occupied target slots, and is not obvious for low-tech faculty users.

## In Scope

- `prisma/schema.prisma` only if a small additive migration is needed for acknowledgement/history or enforceability metadata
- `atlas-server/src/routes/preference.router.ts`
- `atlas-server/src/services/preference.service.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/constraint-validator.ts`
- `atlas-server/src/services/room-preference.service.ts`
- `atlas-server/src/routes/room-preference.router.ts`
- `atlas-client/src/types.ts`
- `atlas-client/src/pages/FacultyPreferences.tsx`
- `atlas-client/src/components/faculty-preferences/*`
- `atlas-client/src/pages/OfficerPreferences.tsx`
- `atlas-client/src/pages/FacultyRoomPreferences.tsx`
- `atlas-client/src/components/faculty-room-preferences/*`
- `atlas-client/src/pages/OfficerRoomPreferences.tsx`
- timetable review request panels only where needed to keep the same acknowledgement/appeal contract visible
- focused backend/frontend tests for this scope
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `CHANGELOG.md`

## Out Of Scope

- public student schedule redesign
- published schedule family expansion
- broad timetable visual redesign unrelated to preferences or room requests
- new authentication system design
- native mobile app work
- generic notification delivery beyond existing realtime/SSE/browser state
- approving live QA room requests that would mutate the draft unless explicitly required for a test and immediately documented

## Required References

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/DESIGN.md`
- `docs/DESIGN-INSPIRATION.md`
- `docs/phases/faculty-mobile-wireframe-spec.md`
- `docs/context7-library-map.md`
- `docs/verification/phase-gates.md`
- `docs/verification/evidence-log.md`
- `atlas-client/src/pages/FacultyPreferences.tsx`
- `atlas-client/src/pages/OfficerPreferences.tsx`
- `atlas-client/src/pages/FacultyRoomPreferences.tsx`
- `atlas-client/src/pages/OfficerRoomPreferences.tsx`
- `atlas-server/src/services/preference.service.ts`
- `atlas-server/src/services/room-preference.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`

## Context7 Preflight Summary

Use Context7 before code changes if the runtime exposes it. The audit preflight already resolved:

- Library ID: `/shadcn-ui/ui`
  - Applied pattern: use shadcn/Radix `Drawer`, `Sheet`, `Dialog`, `Alert`, `Badge`, `Select`, `Tabs`, `Tooltip`, `Switch`, and `Button` primitives for mobile step review, bottom actions, and status disclosure.
- Library ID: `/websites/motion_dev_react`
  - Applied pattern: use `AnimatePresence` for step transitions and respect reduced-motion behavior.

Do not introduce native `<select>`, raw unstyled buttons, raw `details`, or browser `title` tooltips.

## Current Verified Findings

### Preference Findings

1. Time preferences are still live in the faculty UI.
   - Live route: `/my/preferences`, mobile viewport `390x844`.
   - Visible state: `Weekly Availability`, `Available`, `Preferred`, `Unavailable`, `Quick Fill`, and a long 15-minute grid from `7:00 AM` to `6:45 PM`.

2. Time preferences are still live in the scheduler review UI.
   - `OfficerPreferences.tsx` renders `Time Slot Preferences` and a day/start/end/preference table.

3. Backend preference persistence requires and stores `timeSlots`.
   - `preference.router.ts` validates `timeSlots` as an array.
   - `preference.service.ts` deletes and recreates `PreferenceTimeSlot` rows on draft and submit.
   - seeded preferences create default available `timeSlots`.

4. Generation consumes only time-slot preferences from `FacultyPreference`.
   - `generation.service.ts` selects `facultyPreference.timeSlots`.
   - `schedule-constructor.ts` builds `prefLookup` from `timeSlots` and filters `UNAVAILABLE` slots.
   - `wellbeing` fields are not passed to the constructor.

5. Existing early/late preference validators are policy-level soft checks, not faculty-submitted time preferences.
   - `constraint-validator.ts` emits `FACULTY_EARLY_START_PREFERENCE` and `FACULTY_LATE_END_PREFERENCE` only from policy thresholds.
   - `scheduling-policy.service.ts` disables those by default.

6. Well-being preferences are received by scheduler but not proven as timetable-respected.
   - `getOfficerSummaryWithReviews` includes `pregnancySupport`, `physicalAilmentSupport`, `minimizeTravelTime`, and `avoidUpperFloors`.
   - `OfficerPreferences.tsx` shows well-being badges in the detail sheet.
   - Current generator input ignores these fields.

7. Preference identity can still point at stale faculty rows.
   - Live admin summary for `schoolId=1`, `schoolYearId=55` showed a submitted ELPIDIO AQUINO preference on `facultyId=17905`.
   - Live faculty login `2000056 / DepEd2026!` resolves to `facultyId=18189`.
   - `/api/v1/preferences/1/55/faculty/18189` returned no current preference in the live faculty page state.

### Room Request Findings

1. Room requests are real, not just manual notes.
   - Faculty request APIs support draft, preview, submit, delete, queued sync, and SSE.
   - Scheduler APIs support summary, detail, decision preview, review, and appeals.
   - `reviewRoomPreference` commits approved room changes through `manualEditService` for room changes, moves, and swaps.

2. Run-specific teacher-scheduler acknowledgement works.
   - Live test submitted a `SWAP_WITH_OCCUPIED` request for `facultyId=18189`, `runId=117`, `entryId=entry-3015`.
   - Run-specific scheduler summary `/room-preferences/1/55/runs/117/summary?status=SUBMITTED&decisionStatus=PENDING` showed the request.
   - Scheduler rejection wrote reviewer notes.
   - Run-specific faculty state `/room-preferences/1/55/runs/117/faculty/18189` showed `decisionStatus=REJECTED`, `reviewerNotes`, `reviewedAt`, `requestId=1`, and `targetEntryId=entry-2480`.

3. Latest-run teacher-scheduler consistency is not reliable enough.
   - During live QA, faculty `latest/faculty/18189` resolved to run `117` while scheduler `latest/summary` returned a different latest queue with zero requests.
   - Later officer UI at mobile viewport showed `Run #121`, zero requests.
   - A teacher decision tied to run `117` was not visible in later `latest/faculty/18189` state after latest-run resolution changed.

4. Mobile room-request UX is currently NO-GO.
   - `/my/room-preferences` mobile can load classes, but it resumed in Step 2 with a preselected class instead of starting with one obvious action.
   - It displayed a long vertical list of occupied slots across all weekdays.
   - The tutorial overlay previously blocked normal flow and still appears as a page-level interruption.
   - The faculty must infer too much: free slot means move, occupied means swap, pending means scheduler decision, rejected note visibility depends on run context.

5. Officer room request mobile UX is also weak.
   - `/faculty/room-preferences` at `390x844` showed an admin queue, but no request history for superseded runs and no obvious route to the run-specific test request once latest moved on.
   - Collaboration WebSocket logged a disconnect warning; SSE remains active but this needs graceful copy only, not alarmist UI.

## Required Changes

### 1. Remove Time Preferences From Faculty And Scheduler Preference UX

Remove weekly availability/time preference collection from:

- `/my/preferences`
- mobile and desktop preference layout components
- scheduler preference detail sheets
- preference review summaries where time-slot preference counts/tables are displayed

Replace the faculty preference page with a small, plain-language well-being and notes flow:

1. select applicable support needs
2. add optional scheduler note
3. review and submit

Do not show a time grid, `Preferred`, `Unavailable`, `Quick Fill`, or time painting controls.

### 2. Deprecate Time Slots Safely In Backend Contracts

Keep database compatibility unless a migration is truly necessary, but stop treating `timeSlots` as the active preference product surface.

Backend requirements:

- Accept preference draft/submit payloads with missing or empty `timeSlots`.
- Do not require a faculty user to submit any time slot data.
- Stop seeding default availability as meaningful operator data.
- Exclude legacy `timeSlots` from generation unless a deliberate compatibility flag is enabled for a migration window.
- Remove or replace the time-unavailability audit endpoint logic; it should not report time-grid percentages for a deprecated product surface.

### 3. Canonicalize Faculty Preference Identity

Fix preference ownership at the same root as the faculty login repair:

- A faculty preference must attach to the canonical, assignment-bearing `FacultyMirror.id` for the active school/year.
- Reads and writes for faculty users must resolve through the authenticated account's canonical faculty identity, not stale mirror rows.
- Scheduler summaries must not show stale duplicate faculty preference rows as if they belong to an active teacher.
- Provide a repair path for existing stale preference rows, especially the live `17905 -> 18189` ELPIDIO AQUINO case.
- Add a regression test proving the login faculty id and scheduler preference row id match after canonicalization.

### 4. Make Remaining Preferences Timetable-Respected Or Clearly Manual

Classify each remaining preference field in the UI and data contract:

- Algorithmically respected:
  - `pregnancySupport`
  - `physicalAilmentSupport`
  - `avoidUpperFloors`
  - `minimizeTravelTime`
- Manual-only:
  - freeform notes

Implement timetable/generation support for the algorithmic fields at the root service layer:

- Add preference input to generation/constructor that carries the well-being fields for submitted preferences only.
- Bias room assignment toward ground-floor or accessible/lower-floor rooms for `pregnancySupport`, `physicalAilmentSupport`, and `avoidUpperFloors`.
- Bias same-building or adjacent-building placement where possible for `minimizeTravelTime`.
- Emit soft warnings when an algorithmic well-being preference cannot be honored.
- Surface those warnings in timetable review in plain language.
- Do not make these hard publish blockers unless a scheduling policy explicitly marks them hard.

If any field cannot be algorithmically respected in this pass, explicitly label it as `manual scheduler review` in faculty and scheduler UI and add a documented follow-up blocker. Do not leave it silently implied.

### 5. Repair Latest Draft Consistency For Room Requests

Make faculty and scheduler latest-room-request endpoints resolve the same active draft run for the same school/year.

Required contract:

- `GET /room-preferences/:schoolId/:schoolYearId/latest/faculty/:facultyId`
- `GET /room-preferences/:schoolId/:schoolYearId/latest/summary`

must agree on `runId` unless the user explicitly filters to a run or a documented role-specific condition applies.

Add tests that fail if faculty latest and scheduler latest diverge.

When a new generation supersedes a run with submitted room requests:

- do not silently hide prior decisions from the teacher
- show a `superseded draft` status in request history
- preserve teacher-visible decision notes and timestamps
- provide scheduler access to request history by run and faculty

### 6. Strengthen Teacher-Scheduler Acknowledgement

Keep the existing decision flow, but make it obvious:

- Faculty sees pending, approved, rejected, and needs-follow-up decisions in `/my/room-preferences` without needing the old run URL.
- Faculty sees scheduler notes and reviewed timestamp.
- Faculty has a clear appeal/follow-up action only after rejection or needs-follow-up.
- Scheduler can see teacher appeals and update appeal status from both the timetable review workspace and `/faculty/room-preferences`.
- Realtime/SSE decision updates should refresh the visible request state and show a calm toast.

Do not introduce chat. The acknowledgement loop is decision, note, appeal/follow-up, and status history.

### 7. Rebuild Faculty Mobile Room Request UX

Apply `atlas-mobile-faculty-ux`, `atlas-faculty-usability-first`, `atlas-copy-and-microcopy`, `atlas-21st-dev-frontend`, `atlas-design-system-enforcer`, and `atlas-ux-audit-gate`.

Mobile requirements:

- Start at Step 1 unless the URL contains a valid `entryId`.
- Use one primary action per screen.
- Replace the all-week slot wall with day tabs and filters:
  - `Free slots`
  - `Swap with occupied`
  - `All`
- Show compact target cards with current class, target slot, and conflict summary.
- Use a bottom Drawer/Sheet for review and submit.
- Keep bottom CTA above safe-area insets.
- Keep tap targets at least 44px.
- Use plain labels: `Ask to move here`, `Ask to swap`, `Send to scheduler`.
- Show clear pending/approved/rejected states on each class card.
- Make `Full context` off by default and explain it with a tooltip or inline helper only when opened.
- Prevent tutorial overlays from blocking the primary CTA.

Desktop can stay denser, but remove raw native inputs and `title` attributes where touched.

### 8. Keep Scheduler Review Operational

Scheduler `/faculty/room-preferences` must remain efficient:

- show latest-run queue and superseded-run history separately
- show request status counts in an inline stat banner, not oversized metric cards
- preserve preview before approve/reject
- block approval on hard conflicts unless existing override policy explicitly allows it
- keep rejection/needs-follow-up as no-draft-mutation decisions

## Execution Steps

1. Audit and fix canonical faculty preference identity first.
2. Remove/deprecate time preference UI and backend requirements.
3. Pass submitted well-being preferences into generation/constructor and add soft warning output.
4. Repair room-request latest-run consistency and add request history for superseded runs.
5. Harden teacher-scheduler acknowledgement UI.
6. Rebuild mobile room-request UX around a focused step flow.
7. Update tests and evidence.
8. Run live Tailnet verification and self-correct once if live behavior disagrees with local tests.

## Verification Requirements

### Automated

- `npm --prefix atlas-server run build`
- `npm --prefix atlas-client run build`
- targeted preference service/router tests for:
  - empty/missing `timeSlots` accepted
  - stale preference row canonicalizes to assignment-bearing faculty id
  - scheduler preference summary excludes stale duplicates
  - generation input receives submitted well-being preferences
- targeted constructor/validator tests for:
  - floor/accessibility preference bias
  - travel-minimization bias or soft warning
  - no generation dependency on `PreferenceTimeSlot` by default
- targeted room preference tests for:
  - faculty latest and scheduler latest resolve the same `runId`
  - submit -> scheduler summary -> reject -> faculty visible decision
  - decision history remains visible after a newer run supersedes the request run
  - appeal create/update is visible to both roles
- targeted frontend tests or Playwright checks for mobile `/my/preferences`, `/my/room-preferences`, and `/faculty/room-preferences`

### Tailnet Manual Verification

Use `https://njgrm.buru-degree.ts.net` by default.

Required accounts:

- Faculty: `2000056 / DepEd2026!`
- Scheduler/admin: `1000001 / AdminSY2026!`

Verify at mobile viewport `390x844` and desktop viewport `1366x768`:

1. `/my/preferences` has no time grid and submits well-being/notes only.
2. Scheduler `/faculty/preferences` sees the submitted preference under canonical faculty id `18189`, not stale id `17905`.
3. Timetable generation/reporting shows how well-being preferences were honored or warned.
4. `/my/room-preferences` starts with class selection and provides a clear move/swap path.
5. Faculty can submit a move or swap request against the same latest run the scheduler sees.
6. Scheduler can preview and reject a request without mutating the draft.
7. Faculty sees the scheduler decision, note, reviewed timestamp, and follow-up/appeal option.
8. A newer active draft does not erase prior room-request decision history from the teacher view.

### Evidence

Append to `docs/verification/evidence-log.md`.

Include:

- preference canonicalization evidence (`17905 -> 18189` or equivalent)
- before/after route screenshots or route notes
- latest-run agreement proof for faculty and scheduler room-request endpoints
- request acknowledgement proof with request id, run id, decision, and faculty-visible note
- mobile UX screenshots or Playwright route notes
- automated commands and pass/fail results
- GO / NO-GO verdict

## GO / NO-GO

### GO only if

- time preferences are removed from faculty and scheduler UX
- remaining preferences are either timetable-respected or explicitly labeled manual-only
- stale faculty preference identity is repaired for the live ELPIDIO case
- faculty and scheduler latest room-request endpoints agree on active `runId`
- teacher-scheduler decision acknowledgement remains visible after run changes
- mobile faculty preferences and room requests are usable at `390x844`

### NO-GO if

- a faculty user can still paint time availability
- scheduler still sees stale duplicate preference identities as active truth
- well-being preferences remain invisible to generation/timetable without manual-only labeling
- a request submitted by the teacher is not visible to scheduler latest queue for the same active draft
- rejected/approved decisions disappear from the teacher view when a newer draft exists
- mobile room requests still present a long all-week occupied-slot wall as the primary experience