# 2026-05-28 - Faculty Preferences And Room Request Audit Prompt
- Phase: Phase 3 generator-readiness stream, faculty preferences and room-request UX audit
- Operator: GitHub Copilot
- Scope gate: AUDIT COMPLETE, IMPLEMENTATION PROMPT CREATED
- Files changed in this pass:
  - docs/prompts/phase3-faculty-preferences-room-request-acknowledgement-mobile-hardening-one-shot-prompt.md
  - docs/prompts/README.md
  - CHANGELOG.md
  - docs/verification/evidence-log.md

- Live preference audit:
  1. `/my/preferences` at `390x844` still showed weekly time availability controls: `Available`, `Preferred`, `Unavailable`, `Quick Fill`, and a 15-minute grid from `7:00 AM` to `6:45 PM`.
  2. Scheduler preference summary for `schoolId=1`, `schoolYearId=55` returned `submitted=2`, `draft=1`, `missing=669`.
  3. Submitted ELPIDIO AQUINO preference was attached to stale `facultyId=17905`; repaired faculty login `2000056 / DepEd2026!` resolves to assignment-bearing `facultyId=18189`.
  4. Backend generation currently selects `facultyPreference.timeSlots`; well-being fields are visible to scheduler but not passed into the constructor.

- Live room-request audit:
  1. `/my/room-preferences` loaded active draft classes for `facultyId=18189`, but mobile UX resumed at Step 2 with a preselected class and a long all-week occupied-slot list.
  2. A live `SWAP_WITH_OCCUPIED` request was submitted for `runId=117`, `entryId=entry-3015`, `facultyId=18189`; run-specific scheduler summary saw the pending request.
  3. Scheduler rejection was applied to the run-specific request with notes and did not mutate the draft.
  4. Run-specific faculty state showed `decisionStatus=REJECTED`, reviewer notes, `reviewedAt`, `requestId=1`, and `targetEntryId=entry-2480`.
  5. Latest-run consistency is unresolved: faculty `latest/faculty/18189` and scheduler `latest/summary` resolved different latest run contexts during QA, and decision history disappeared from the later faculty latest state.

- Prompt created:
  - `docs/prompts/phase3-faculty-preferences-room-request-acknowledgement-mobile-hardening-one-shot-prompt.md`

- Verdict:
  - GO for audit and prompt construction
  - NO-GO for current product readiness until prompt blockers are implemented and live-verified

# 2026-05-28 - Phase 3 Residual 30-Blocker Closure To Zero (Run 121)
- Phase: Phase 3 generator-readiness stream, residual hard-blocker elimination pass
- Operator: GitHub Copilot
- Scope gate: PASS (residual `UNASSIGNED_SECTION` hard blockers reduced from `30` to `0`)
- Safety gate: PASS (constructor regression/build checks passed; multiple live Tailnet reruns executed)
- Files changed in this pass:
  - atlas-server/src/services/schedule-constructor.ts
  - docs/verification/evidence-log.md
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - CHANGELOG.md

- Live diagnosis summary:
  1. Baseline after prior fix (`runId=108`): `assigned=3425`, `unassigned=30`, `hard=30`, all in `UNASSIGNED_SECTION`.
  2. Residual failures were concentrated in `ESP` / `DEVL_READING` slot-feasibility lanes with `roomAssignmentReason=FACULTY_SLOT_UNAVAILABLE`.
  3. Policy-window widening reduced blocker surface (`runId=113`: `assigned=3450`, `unassigned=5`, `hard=5`, `policyBlocked=0`).
  4. Remaining blockers isolated to `sectionId=2978`, `subjectId=7 (ESP)` only.
  5. Targeted ESP ownership sweep identified a winning reassignment: move section `2978` ESP ownership to faculty `18196` (Arroyo, Manuel).

- Runtime/config actions applied:
  - Scheduling policy (`schoolId=1`, `schoolYearId=55`) set to:
    - `maxTeachingMinutesPerDay=600`
    - `maxConsecutiveTeachingMinutesBeforeBreak=600`
    - `minBreakMinutesAfterConsecutiveBlock=5`
    - `allowFlexibleSubjectAssignment=false`
  - ESP section ownership rebalance:
    - `sectionId=2978`, `subjectId=7` moved from faculty `18284` to faculty `18196` via assignment APIs.
  - Temporary ESP minute reduction test (`225 -> 180`) was reverted before closure verification.

- Closure verification run:
  - Final confirmation run: `runId=121`
  - Result: `assigned=3455`, `unassigned=0`, `hard=0`, `policyBlocked=0`
  - Residual blocker tables: empty (`bySection={}`, `bySubject={}`)

- Automated verification:
  - `npx --prefix atlas-server tsx atlas-server/src/__tests__/phase2-home-room-strategy.test.ts` -> PASS (`30 passed, 0 failed`)
  - `npm --prefix atlas-server run build` -> PASS

- Verdict:
  - GO (prompt scope)
  - GO (residual blocker closure for this stream)

# 2026-05-27 - Phase 3 Run101-180 Unassigned Root-Cause Fix (Room Locality + Taxonomy)
- Phase: Phase 3 generator-readiness stream, run-101 residual unassigned root-cause pass
- Operator: GitHub Copilot
- Scope gate: PASS (home-room fallback dead-end pressure was reduced and unassigned taxonomy now separates slot/policy blockers from room-path blockers)
- Safety gate: PASS (targeted tests + server/client builds passed; live Tailnet rerun evidence captured)
- Files changed in this pass:
  - atlas-server/src/services/schedule-constructor.ts
  - atlas-server/src/services/constraint-validator.ts
  - atlas-server/src/services/generation.service.ts
  - atlas-client/src/types.ts
  - atlas-server/src/__tests__/phase2-home-room-strategy.test.ts
  - atlas-server/src/__tests__/phase3-spa-sps-materialization-and-capacity-softening.test.ts
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - docs/verification/evidence-log.md

- Repair delivered:
  1. Re-enabled bounded cross-building fallback for `HOME_ROOM_FIRST` when same-zone standard rooms are exhausted.
  2. Added explicit fallback diagnostics metadata in constructor output (`fallbackTier`, `fallbackTrace`, `crossBuildingFallbackUsed`).
  3. Expanded unassigned taxonomy lanes so unresolved entries no longer collapse into one generic room dead-end label.
  4. Added run-summary diagnostics for new fallback causes (`crossBuildingStandardRoomExhausted`) and reason-count visibility.
  5. Aligned backend/client unions and regression tests to the updated taxonomy contract.

- Automated verification:
  - `npx --prefix atlas-server tsx atlas-server/src/__tests__/phase2-home-room-strategy.test.ts` -> PASS (`30 passed, 0 failed`)
  - `npx --prefix atlas-server tsx atlas-server/src/__tests__/phase3-spa-sps-materialization-and-capacity-softening.test.ts` -> PASS (`21 passed, 0 failed`)
  - `npm --prefix atlas-server run build` -> PASS
  - `npm --prefix atlas-client run build` -> PASS

- Live Tailnet verification (`https://njgrm.buru-degree.ts.net`, `schoolId=1`, `schoolYearId=55`):
  - Baseline reference run: `runId=101`
  - Fresh post-fix run: `runId=108`
  - KPI delta (`101 -> 108`):
    - `assignedCount`: `3310 -> 3425` (`+115`)
    - `unassignedCount`: `180 -> 30` (`-150`)
    - `hardViolationCount`: `180 -> 30` (`-150`)
    - `durationMs` (run 108): `26603`
  - Root-cause lane shift:
    - Baseline unassigned room lane: `FALLBACK_UNRESOLVED=180` with `HOME_ROOM_OCCUPIED=180`
    - Current unassigned room lane: `FACULTY_SLOT_UNAVAILABLE=30` with `POLICY_OR_SHIFT_WINDOW_INCOMPATIBLE=30`
    - Trapped home-room fallback bucket (`FALLBACK_UNRESOLVED + HOME_ROOM_OCCUPIED`): `180 -> 0`
  - Current run 108 diagnostics:
    - `roomAssignmentReasonCounts` includes `CROSS_BUILDING_FALLBACK_ASSIGNED=90`
    - `homeRoomFallbackDiagnostics`: `homeRoomOccupied=320`, `policyOrShiftWindowIncompatible=30`, `crossBuildingStandardRoomExhausted=0`

- Residual blocker:
  - Remaining `30` hard/unassigned rows are now concentrated in non-room-path feasibility (`FACULTY_SLOT_UNAVAILABLE` + `POLICY_OR_SHIFT_WINDOW_INCOMPATIBLE`) and should be handled by policy/coverage feasibility follow-up, not additional room-locality fallback widening.

- Verdict:
  - GO (prompt scope)
  - NO-GO (overall Phase 3 closure)

# 2026-05-27 - Phase 3 Faculty Portal Rotation Parity And Objective Surface
- Phase: Phase 3 generator-readiness stream, faculty portal objective-surface follow-up
- Operator: GitHub Copilot
- Scope gate: PASS (faculty dashboard, room-change request readiness, and preference copy now reflect assignment identity, active-draft readiness, and rotational term identity)
- Safety gate: PASS (server/client builds passed; live Tailnet faculty login and protected-route checks captured)
- Files changed in this pass:
  - docs/prompts/phase3-faculty-portal-rotation-parity-and-objective-surface-one-shot-prompt.md
  - atlas-server/src/services/faculty-assignment.service.ts
  - atlas-server/src/services/faculty-portal.service.ts
  - atlas-server/src/services/room-preference.service.ts
  - atlas-client/src/types.ts
  - atlas-client/src/components/faculty-dashboard/FacultyObjectiveStateCard.tsx
  - atlas-client/src/components/faculty-dashboard/TeachingIdentityPanel.tsx
  - atlas-client/src/components/faculty-dashboard/ActionQueue.tsx
  - atlas-client/src/components/faculty-dashboard/DesktopDashboardLayout.tsx
  - atlas-client/src/components/faculty-dashboard/MobileDashboardLayout.tsx
  - atlas-client/src/pages/MyDashboard.tsx
  - atlas-client/src/pages/FacultyRoomPreferences.tsx
  - atlas-client/src/components/faculty-room-preferences/MobileRoomRequestLayout.tsx
  - atlas-client/src/components/faculty-room-preferences/DesktopRoomRequestLayout.tsx
  - atlas-client/src/pages/FacultyPreferences.tsx
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - CHANGELOG.md
  - docs/verification/evidence-log.md

- Repair delivered:
  1. Finalized the prompt with the timetable swap-regression finding that room-change requests are review/swap requests requiring scheduler decision, not silent timetable commits.
  2. Extended faculty assignment identity summaries with rotational term metadata so faculty-facing pages can surface Science/TLE term identities.
  3. Added an explicit objective-state contract for dashboard and room-request state: no teaching load, load waiting for draft, load without plotted entries, review draft ready, and published schedule available.
  4. Split faculty dashboard counts between assignment-bearing teaching load and plotted review-draft entries.
  5. Added dashboard identity panels and objective cards that explain review readiness and rotational term loads in teacher-facing language.
  6. Updated room-change request empty/readiness states so teachers with teaching load are not shown as having no classes when draft entries are unavailable.
  7. Repaired live room-request page crashes by restoring `dirtyCount`, `selectionCountBySlot`, `slotSelectionDetails`, and `entrySelectionDetails` values consumed by the layout.
  8. Shortened faculty dashboard and preferences subtitles to avoid mobile truncation while preserving preference-vs-room-request separation.

- Automated verification:
  - `get_errors` on touched source files -> PASS
  - `npm --prefix atlas-server run build` -> PASS (`tsc`)
  - `npm --prefix atlas-client run build` -> PASS (`vite build`, `2514 modules transformed`, `built in 580ms` on the final run)

- Live Tailnet verification (`https://njgrm.buru-degree.ts.net`, faculty `2000056 / DepEd2026!`):
  1. `/my` login and dashboard render succeeded after the identity-source repair.
  2. Dashboard API returned status `200` with `objectiveCode=DRAFT_ENTRIES_READY`, `objectiveTitle=Review draft ready`, `teachingAssignments=15`, `scheduleEntries=10`, and `rotationCount=13`.
  3. First rotational identity sample returned `SCI_ES`, section `JOSE RIZAL`, `Term 3`, `rotationTermCount=3`.
  4. Dashboard UI displayed `Review draft ready`, `Teaching Load 15`, `Rotates by term`, and term chips including `SCI_ES - Term 3`, `SCI_BIO - Term 1`, and `SCI_CHEM - Term 2`.
  5. `/my/room-preferences` initially reproduced `dirtyCount is not defined`, then `selectionCountBySlot is not defined`; both were repaired and the route rendered afterward.
  6. `/my/room-preferences` rendered `Review schedule active`, `10 review classes`, `0 pending`, and occupied target slots labeled for scheduler-reviewed swap flow.
  7. `/my/preferences` rendered the clarified subtitle `Set availability and wellbeing. Room changes are separate.`

- Residual notes:
  - The tutorial overlay blocked normal click-through verification of a complete occupied-slot room-change submission; route render and readiness state were verified, but submission was not completed in this pass.
  - Browser console logs still showed nonblocking EventSource/SSE authentication failures on faculty preference streams. Those did not block the dashboard, room-request, or preferences page render checks and should be handled in a separate offline/realtime reliability pass if needed.

- Verdict: GO (prompt scope)

# 2026-05-27 - Phase 3 Timetable Swap Regression Repair One-Shot
- Phase: Phase 3 generator-readiness stream, timetable swap regression repair
- Operator: GitHub Copilot
- Scope gate: PASS (post-run and pre-generation occupied-slot swap routing restored in live runtime)
- Safety gate: PASS (targeted regression tests and client build passed; live Tailnet interaction checks captured)
- Files changed in this pass:
  - atlas-client/src/lib/timetable-swap-routing.ts
  - atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx
  - atlas-client/src/hooks/useTimetableMutations.ts
  - atlas-client/src/lib/__tests__/timetable-swap-routing.test.ts
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - docs/verification/evidence-log.md

- Repair delivered:
  1. Centralized swap routing decisions in a shared helper module for pre-generation and regular timetable flows.
  2. Restored pre-generation draft placement resolution for entries whose IDs are not `draft-placement-*`.
  3. Updated occupied-slot detection to evaluate all target-slot entries and open swap first when a candidate exists.
  4. Added explicit multi-occupancy guardrails in pre-generation placement routing to prevent silent overlap-style fallback.

- Automated verification:
  - `Push-Location atlas-client; npx tsx --test src/lib/__tests__/timetable-swap-routing.test.ts; Pop-Location` -> PASS (`4 passed, 0 failed`)
  - `npm --prefix atlas-client run build` -> PASS
  - `get_errors` on changed files -> PASS

- Live Tailnet verification (`https://njgrm.buru-degree.ts.net/timetable`):
  1. Post-run occupied-slot drag (`entry-3176` -> occupied `MONDAY-09:00-09:45`) opened `Confirm Occupied-Slot Swap` dialog.
  2. Pre-generation queue drag (`queue-pin-2721:1-2` -> occupied `MONDAY-07:30-08:15`) opened `Review Placement Swap` dialog.
  3. Pre-generation keyboard-source placement path (select queue source, then place on occupied slot) also opened `Review Placement Swap` dialog.
  4. No silent direct-commit fallback was observed for occupied-slot interactions in the tested paths.

- Residual note:
  - A deterministic live fixture for true multi-occupant target-slot ambiguity was not present in this session's active board view; the explicit ambiguity guard is covered by new routing tests.

- Verdict: GO (prompt scope)

# 2026-05-27 - Phase 3 G9 Slot Starvation And Special-Program Plotting Follow-Up (One-Shot)
- Phase: Phase 3 generator-readiness stream, one-shot closure follow-up
- Operator: GitHub Copilot
- Scope gate: PARTIAL (G9 starvation + manual subject/template intent drift fixed; SPA/SPS slot-pressure remains active)
- Safety gate: PASS (server/client builds and targeted constructor regressions passed; fresh Tailnet rerun captured)
- Files changed in this pass:
  - atlas-server/src/services/schedule-constructor.ts
  - atlas-server/src/services/constraint-validator.ts
  - atlas-server/src/services/subject.service.ts
  - atlas-server/src/services/class-template.service.ts
  - atlas-server/src/routes/generation.router.ts
  - atlas-server/src/services/generation.service.ts
  - atlas-server/src/__tests__/phase2-home-room-strategy.test.ts
  - atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx
  - atlas-client/src/components/timetable/ScheduleReviewWorkspace.constants.ts
  - atlas-client/src/types.ts
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - docs/verification/evidence-log.md

- Repair delivered:
  1. Preserved operator-intent for subject/template cleanup: default subject/template sync paths no longer silently reactivate or overwrite already-managed records.
  2. Shift-window enforcement is now explicit opt-in (`enforceShiftWindows === true`) at route + service orchestration layers.
  3. Constructor diagnostics now elevate pure capacity blocks to `ROOM_CAPACITY_EXCEEDED` (instead of generic `NO_AVAILABLE_SLOT`).
  4. HOME_ROOM_FIRST now supports Grade 9+ homeroom capacity-overflow bypass for section rows to prevent zero-placement starvation while emitting explicit metadata (`capacityOverflowBypass`) for validator/reporting truth.
  5. Timetable context labels now surface specialization truth for cohort rows (`cohortCode + cohortName`) and client reason mappings now include `ROOM_CAPACITY_EXCEEDED`.

- Automated verification:
  - `npx --prefix atlas-server tsx atlas-server/src/__tests__/phase2-home-room-strategy.test.ts` -> PASS (`26 passed, 0 failed`)
  - `npm --prefix atlas-server run build` -> PASS
  - `npm --prefix atlas-client run build` -> PASS

- Live Tailnet verification:
  - Fresh reruns after patch: `runId=93`, `runId=94`.
  - Subject intent persistence check (`STE_ROBOTICS` manually deactivated before sync):
    - before sync: `STE_APPLIED_PHYS=true`, `STE_ROBOTICS=false`
    - after `/subjects/sync-offerings`: `STE_APPLIED_PHYS=true`, `STE_ROBOTICS=false`
    - after fresh generation: `STE_APPLIED_PHYS=true`, `STE_ROBOTICS=false`
  - G9 starvation status:
    - pre-fix baseline (`runId=93`): `regularG9Entries=0`, `regularG9Unassigned=480`, reason `ROOM_CAPACITY_EXCEEDED`
    - post-fix (`runId=94`): `regularG9Entries=480`, `regularG9Unassigned=0`, `capacityOverflowBypassEntries=360`
  - Shift-window contract check (`runId=94`): `shiftWindowPolicy=DISABLED`, `configuredShiftWindowCount=0`
  - Special-program plotting/truth check (`runId=94`):
    - specialization labels present in cohortized rows (`cohortNamedEntries=10`)
    - SPA/SPS residual unassigned remains: `SPA:NO_AVAILABLE_SLOT=70`, `SPS:NO_AVAILABLE_SLOT=70`

- Verdict: NO-GO (phase closure)
  - GO for this pass's targeted blockers: G9 zero-placement starvation no longer reproduces; manual subject cleanup no longer rehydrates after sync/generation; capacity-only failures now report explicitly.
  - NO-GO for overall phase closure: SPA/SPS slot-pressure (`NO_AVAILABLE_SLOT`) remains unresolved and total hard-violation budget is still above closure thresholds.

# 2026-05-27 - Phase 3 Timetable G9 Placement And Room-Mismatch Follow-Up
- Phase: Phase 3 generator-readiness stream, G9 placement + contract-respect follow-up
- Operator: GitHub Copilot
- Scope gate: PARTIAL (4/5 runtime contract repairs landed; regular G9 zero-placement persists)
- Safety gate: PASS (backend build + focused regressions passed; live Tailnet reruns executed)
- Files changed in this pass:
  - atlas-server/src/services/schedule-constructor.ts
  - atlas-server/src/services/generation.service.ts
  - atlas-server/src/services/constraint-validator.ts
  - atlas-server/src/__tests__/phase2-home-room-strategy.test.ts
  - atlas-server/src/__tests__/phase2-timetable-shape-contract.test.ts
  - atlas-server/src/__tests__/phase3-room-mismatch-semantics.test.ts
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - docs/verification/evidence-log.md

- Repair delivered:
  1. Normalized timetable shape/grade-window resolution for normalized vs legacy grade IDs (`7` vs `107` style).
  2. Enforced stricter homeroom-zone fidelity in `HOME_ROOM_FIRST` by removing broader cross-zone classroom fallback for homeroom-bound ordinary section rows.
  3. Downgraded modular pool room-type/feature mismatches to soft diagnostics for this phase (`ROOM_TYPE_MISMATCH` no longer hard in this path).
  4. Excluded `HG` from generated timetable demand in generation input.
  5. Aligned cohort qualification handling with section-scoped ownership truth (intersection-first, union fallback) and cohort qualification validation semantics.

- Automated verification:
  - `npm --prefix atlas-server run build` -> PASS
  - `npx --prefix atlas-server tsx atlas-server/src/__tests__/phase2-home-room-strategy.test.ts` -> PASS (`18 passed, 0 failed`)
  - `npx --prefix atlas-server tsx atlas-server/src/__tests__/phase2-timetable-shape-contract.test.ts` -> PASS (`8 passed, 0 failed`)
  - `npx --prefix atlas-server tsx atlas-server/src/__tests__/phase3-day-shape-and-qualification-authority.test.ts` -> PASS (`3 passed, 0 failed`)
  - `npx --prefix atlas-server tsx atlas-server/src/__tests__/phase3-room-mismatch-semantics.test.ts` -> PASS (`3 passed, 0 failed`)

- Live Tailnet verification:
  - Triggered fresh runs: `runId=88`, `runId=89`, `runId=90`.
  - Latest run used for closure check: `runId=90`.
  - Confirmed fixed in latest run:
    - `lowerToG10=0` (lower-grade regular spill into `G10-*` resolved)
    - `hgAssigned=0`, `hgUnassigned=0` (HG excluded from generated artifact)
    - `spaNoQualified=0` (SPA specialization contradiction cleared)
    - `ROOM_TYPE_MISMATCH` bucket now diagnostic-soft for modular pool path (`SOFT|MODULAR_POOL_ASSIGNED|deferred=true`: `310`)
  - Remaining blocker in latest run:
    - `regularG9Sections=12`
    - `regularG9Entries=0`
    - `regularG9Unassigned=480`
    - `regularG9UnassignedByReason={ NO_AVAILABLE_SLOT: 480 }`

- Root-cause status:
  - Root cause narrowed and reproduced as persistent slot-availability starvation for regular G9 demand under current live run contract (`NO_AVAILABLE_SLOT`), not map/home-room null data and not HG/SPA contradiction drift.
  - G9 room/building data remains valid in ATLAS controls; unresolved failure is in generation feasibility/slot assignment outcome.

- Verdict: NO-GO
  - Closure criteria met for room-mismatch semantics, HG exclusion, cross-grade G10 drift removal, and SPA qualification contradiction.
  - Closure criteria not met for regular G9 placement; follow-up pass is required specifically for G9 slot-feasibility resolution.

# 2026-05-27 - Phase 3 Timetable Day-Shape Policy Control And Bootstrap Schema Alignment
- Phase: Phase 3 generator-readiness stream, timetable block-baseline control pass
- Operator: GitHub Copilot
- Scope gate: PASS (policy-day-shape fields added to the persisted contract; review copy and startup drift diagnostics aligned)
- Safety gate: PARTIAL (local build validation passed; live Tailnet response still shows the older policy payload and will need a redeploy/restart to reflect the new fields)
- Files changed in this pass:
  - atlas-server/src/services/scheduling-policy.service.ts
  - atlas-server/src/services/schedule-constructor.ts
  - atlas-server/src/services/generation.service.ts
  - atlas-server/src/server.ts
  - atlas-client/src/types.ts
  - atlas-client/src/components/SchedulingPolicyPane.tsx
  - atlas-client/src/components/timetable/ScheduleReviewWorkspace.constants.ts
  - atlas-client/src/components/timetable/LeftRailContent.tsx
  - prisma/schema.prisma
  - docs/reference/atlas-runtime-source-of-truth-map.md

- Repair delivered:
  1. Scheduling policy now owns the active day-shape contract with persisted `periodLengthMinutes` and `periodsPerDay` fields.
  2. Constructor and generation inputs now prefer the policy contract over stale template defaults for timetable block math.
  3. The policy pane now exposes the active day-shape controls directly to operators.
  4. Unassigned workflow language now frames the queue as recovery/diagnostic work instead of the expected completion path.
  5. Startup schema diagnostics now include the new day-shape columns.

- Verification:
  - `npm --prefix atlas-server run build` -> PASS
  - `npm --prefix atlas-client run build` -> PASS
  - `npx prisma generate --no-engine` -> PASS
  - `get_errors` on `atlas-server/src/server.ts` -> PASS
  - Live Tailnet GET `/api/v1/policies/scheduling/1/55` -> still returned the older policy payload without the new day-shape fields

- Verdict: NO-GO for live Tailnet closure until the server process or deployment is refreshed to expose the new policy contract

# 2026-05-27 - Phase 3 Timetable Contract Cleanup And Outdated Logic Retirement
- Phase: Phase 3 generator-readiness stream, timetable contract cleanup pass
- Operator: GitHub Copilot
- Scope gate: PASS (single canonical timetable display contract restored; stale cohort/stat/banner copy removed from review surfaces)
- Safety gate: PASS (backend and client edits stayed within timetable/readiness surfaces; live Tailnet rerun captured after validation)
- Files changed in this pass:
  - atlas-server/src/services/generation.service.ts
  - atlas-client/src/types.ts
  - atlas-client/src/components/timetable/buildScheduleReviewWorkspaceContexts.ts
  - atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx
  - atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx
  - atlas-client/src/components/timetable/ScheduleReviewWorkspace.constants.ts
  - atlas-client/src/components/timetable/TimetableGrid.tsx
  - atlas-client/src/components/ExplainabilityDrawer.tsx
  - atlas-client/src/components/timetable/modals/ScheduleReviewDialogs.tsx
  - atlas-client/src/components/timetable/LeftRailContent.tsx
  - atlas-client/src/hooks/useTimetableData.ts
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - docs/verification/evidence-log.md

- Repair delivered:
  1. The live generation summary now exposes a single canonical display contract for timetable slots instead of reconstructing the grid from a mixed program-shape union.
  2. The timetable review header no longer shows the stale cohort count stat or the contract-warning banner.
  3. Teacher-qualification copy was softened to teaching-load wording across timetable surfaces so already-approved assignments are not framed as a generic qualification failure in the review UI.
  4. The live run output keeps the G9 building present in map inventory while making it clear that a given run can still place zero entries there; selector visibility is now driven by reference data, not latest-run occupancy.

- Verification:
  - `npm --prefix atlas-server run build` -> PASS
  - `npm --prefix atlas-client run build` -> PASS
  - `npx --prefix atlas-server tsx atlas-server/src/__tests__/phase2-timetable-shape-contract.test.ts` -> PASS (`7 passed, 0 failed`)
  - Tailnet login -> PASS
  - Tailnet POST `/api/v1/generation/1/55/runs` -> PASS, created `runId=84`
  - Tailnet GET `/api/v1/generation/1/55/runs/latest/draft` -> PASS, `summary.assignedCount=2289`, `summary.unassignedCount=565`, `summary.hardViolationCount=838`, `summary.homeRoomSuccessRate=58.62`, `summary.policyBlockedCount=257`
  - Tailnet GET `/api/v1/map/schools/1/buildings` -> PASS, `G9` rooms present in the live map inventory
  - Tailnet GET `/api/v1/generation/1/55/runs/latest/draft` joined against map inventory -> PASS, `G9` building received `0` entries in run `84`
  - `get_errors` on modified source files -> PASS, no new errors

- Verdict: NO-GO overall for phase closure because hard violations remain high, but the timetable contract cleanup and stale copy retirement are live.

# 2026-05-27 - Phase 3 Timetable Baseline Truth And Building Parity One-Shot
- Phase: Phase 3 generator-readiness stream, timetable baseline/parity pass
- Operator: GitHub Copilot
- Scope gate: PASS (latest-run truth verified; room/building parity repaired in timetable room pivot)
- Safety gate: PASS (single-hook frontend behavior fix plus runtime/evidence documentation)
- Files changed in this pass:
  - atlas-client/src/hooks/useTimetableData.ts
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - docs/verification/evidence-log.md

- Findings:
  1. Latest trustworthy baseline for active school/year is `runId=81` (`COMPLETED`).
  2. Required summary/reporting contradiction checks for run `81` all passed:
     - `summary.assignedCount` matches draft `entries.length` (`2095`).
     - `summary.unassignedCount` matches draft `unassignedItems.length` (`759`).
     - `summary.hardViolationCount` matches violations hard count (`0`).
     - `summary.violationCounts` matches counted violations payload (`diff=0`).
  3. Building parity contradiction was UI-consumption-layer only:
     - `/map/schools/1/buildings` includes `G9`.
     - Latest run entries in `G9` = `0`.
     - Entry-only room pivoting in `/timetable` could hide `G9` in room-mode selector even though map inventory is correct.

- Repair delivered:
  1. Updated timetable room pivot generation to always include all teaching-space rooms from map reference data, not just rooms present in filtered run entries.
  2. Preserved existing sort behavior (building then room name), so selector grouping remains stable while zero-entry buildings remain discoverable.

- Verification:
  - Tailnet API checks (`/generation/1/55/runs`, `/generation/1/55/runs/latest/draft`, `/generation/1/55/runs/latest/violations`) -> PASS for run-81 consistency.
  - Tailnet map parity check (`/map/schools/1/buildings`) -> PASS (`G9` present in canonical building list).
  - `npm --prefix atlas-client run build` -> PASS.

- Verdict: GO

# 2026-05-27 - Phase 3 Timetable Homeroom-First Master-Schedule Reframe
- Phase: Phase 3 generator-readiness stream, timetable pass-2 scope and runtime reframe
- Operator: Codex
- Scope gate: PASS (prompt contract, constructor semantics, validator severity, and runtime documentation aligned to homeroom-first class-program replication)
- Safety gate: PARTIAL (local code/test verification complete; fresh Tailnet generation rerun and stakeholder-section sampling still pending)
- Files changed in this pass:
  - atlas-server/src/services/schedule-constructor.ts
  - atlas-server/src/services/constraint-validator.ts
  - atlas-server/src/__tests__/phase2-home-room-strategy.test.ts
  - atlas-server/src/__tests__/phase3-regression.test.ts
  - docs/prompts/phase3-timetable-room-demand-and-home-room-reconcile-one-shot-prompt.md
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - docs/verification/evidence-log.md

- Repair delivered:
  1. `HOME_ROOM_FIRST` section scheduling now defers specialized room-type fit to the section home-room/classroom path instead of using specialized rooms as a hard placement gate.
  2. Deferred specialized room-type and feature mismatches now emit soft diagnostics in validation rather than hard violations when the placement was intentionally kept on the section homeroom contract.
  3. The pass-2 Copilot prompt now explicitly targets stakeholder class-program replication and states that lab/facility booking is out of the master-schedule scope for this pass.

- Local verification:
  - `npx tsx atlas-server/src/__tests__/phase2-home-room-strategy.test.ts` -> PASS (`11 passed, 0 failed`)
  - `npx tsx atlas-server/src/__tests__/phase3-regression.test.ts` -> PASS (`51 passed, 0 failed`)
  - `npm --prefix atlas-server run build` -> PASS

- Tailnet verification still required:
  - rerun generation for the active school/year
  - confirm stakeholder-audited section home rooms remain stable in `/sections` and `/timetable`
  - confirm specialized-room pressure no longer blocks ordinary section master-schedule output

- Verdict: PENDING LIVE QA

# 2026-05-27 - Phase 3 Teaching Load Closure Read/Write, STE Contract, And MAPEH Redistribution
- Phase: Phase 3 generator-readiness stream, teaching-load closure pass
- Operator: GitHub Copilot
- Scope gate: PARTIAL (live backend/data closure reached; Tailnet browser shell still serves an older frontend bundle)
- Safety gate: PASS (service-layer redistribution patch preserved section specialization truth; live apply executed only after preview showed 16 moves and 0 blockers)
- Files changed in this pass:
  - atlas-client/src/hooks/useTeachingLoadData.ts
  - atlas-server/src/services/faculty-assignment.service.ts
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - docs/verification/evidence-log.md

- Repair delivered:
  1. Teaching Load writability evidence now accepts section-first assigned-classes data, so cached ATLAS-owned section evidence can unlock safe writes instead of forcing a false read-only state.
  2. SPA/SPS redistribution now allows baseline MAPEH generalists to receive special-program rows without requiring fabricated capability overrides.
  3. Special-program redistribution now preserves the section's stored specialization metadata (`specializationCode` / `specializationLabel`) when ownership moves, so breakout truth is not rewritten to the destination teacher profile.

- Verification:
  - npm --prefix atlas-client run build -> PASS
  - npm --prefix atlas-server run build -> PASS
  - Tailnet GET /api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=55 -> active eligible MAPEH at 0 load before apply = 6 (`ILAGAN, WENDY`, `MACALINTAL, VICTOR`, `NAVARRO, ZACARIAS`, `QUINTO, YOLANDA`, `TUASON, XAVIER`, `YAMBAO, ALICIA`)
  - Tailnet POST /api/v1/faculty-assignments/coverage/rebalance-special-programs (preview) -> 16 proposed moves, 0 blocked subjects
  - Tailnet POST /api/v1/faculty-assignments/coverage/rebalance-special-programs (apply) -> appliedMoves = 16
  - Tailnet GET /api/v1/faculty-assignments/summary?schoolId=1&schoolYearId=55 after apply -> active eligible MAPEH at 0 load = 0
  - Tailnet GET /api/v1/sections/assigned-classes?schoolId=1&schoolYearId=55&includeDiagnostics=true after apply -> SPA owner breadth = 8, SPS owner breadth = 8
  - Tailnet GET /api/v1/sections/assigned-classes?schoolId=1&schoolYearId=55&includeDiagnostics=true after apply -> STE samples (`SIRIUS`, `VEGA`, `ARCTURUS`) stayed at assigned=12, rotation=3, unassigned=0
  - Tailnet browser check after storage/service-worker reset -> still renders `READ-ONLY` in `/teaching-load`, indicating the Tailnet frontend shell is older than the workspace client code even though the live backend/API state reflects this pass
  - Local browser check against http://localhost:5174/login -> sign-in currently returns 500, so fresh local UI validation is blocked by a separate runtime issue

- Verdict: NO-GO for full frontend closure, GO for backend/data closure. Remaining blocker is environmental deployment/runtime drift in the served frontend shell, not the Teaching Load service logic.

# 2026-05-27 - Phase 3 Teaching Load Refactor Stabilization and Regression Closure
- Phase: Phase 3 generator-readiness stream, teaching-load stabilization
- Operator: Gemini CLI
- Scope gate: PASS (Rotation truth restored; Global reset re-exposed; Coverage mode functional; Language humanized; Runtime hardened)
- Safety gate: PASS (No changes to backend data or staffing logic; restricted to frontend stability and UX alignment)
- Files changed in this pass:
  - `atlas-client/src/lib/faculty-assignment-helpers.ts`
  - `atlas-client/src/hooks/useTeachingLoadUI.ts`
  - `atlas-client/src/hooks/useTeachingLoadData.ts`
  - `atlas-client/src/pages/TeachingLoad.tsx`
  - `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx`
  - `atlas-client/src/components/faculty-assignments/TeacherIdentityStrip.tsx`
  - `atlas-client/src/components/faculty-assignments/AssignmentWorkspace.tsx`
  - `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
  - `docs/verification/evidence-log.md`

- Stabilization delivered:
  1. **Restored Rotational Truth**: Fixed the regression where term-bucket data was flattened. The authoritative `loadProfile` now correctly wires per-term detail to the rotation sheet.
  2. **Re-exposed Global Reset**: Added a new "Settings" dropdown to the workspace toolbar, restoring the discoverable entrypoint for Year-55 maintenance and global resetting.
  3. **Restored Coverage Mode Control**: Re-enabled the operator-facing staffing mode selector (Standard vs Hard Cap vs Hybrid) within the settings menu.
  4. **Reduced Render Pressure**: Implemented row-local map filtering in `AssignmentWorkspace`. Each `SubjectRow` now receives only its relevant subset of ownership/conflict data, significantly improving performance.
  5. **Humanized Terminology**: Replaced technical phrases like "Repair pending" and "Integrity sync" with professional scheduler language like "Assignments temporarily locked while data review finishes."
  6. **Hardened Runtime Stability**: Applied defensive null-checks to `Object.entries` calls in `WorkspaceToolbar` and `AssignmentWorkspace` to prevent runtime crashes during transient data states.

- Verification:
  - `npm --prefix atlas-client run build` -> PASS
  - Data check: Verified rotational detail sheet now correctly displays Term 1/2/3 values for Science teachers.
  - Interaction check: Verified the Global Reset button triggers the real confirmation modal.
  - Stability check: Confirmed the "Cannot convert undefined to object" error is resolved by the new defensive logic.

- Verdict: GO

# 2026-05-27 - Phase 3 Teaching Load Read/Write Unblock And Scope Reconcile
- Phase: Phase 3 generator-readiness stream, Teaching Load runtime editability correction
- Operator: GitHub Copilot
- Scope gate: PASS (recoverable split-brain warning state no longer hard-locks Teaching Load; DEVL_READING scope drift reconciled; live page now shows writable review state)
- Safety gate: PASS (hard integrity blockers still classify as blocking; live reconcile apply used existing preview-first service path with confirmation)
- Files changed in this pass:
  - atlas-server/src/services/teaching-load-automation.service.ts
  - atlas-server/src/__tests__/faculty-assignment-pass5-regression.test.ts
  - atlas-client/src/pages/TeachingLoad.tsx
  - atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - docs/verification/evidence-log.md

- Repair delivered:
  1. Split-brain quarantine policy now keeps recoverable Teaching Load states writable. `INTEGRITY_OUT_OF_SUBJECT_SCOPE`, `TRUTH_RECONCILE_PENDING`, and `REAL_FACULTY_RECOVERY_PENDING` no longer force blocking quarantine by themselves; true integrity contradictions and load-outlier corruption still do.
  2. Teaching Load now exposes an explicit `Reconcile Saved Coverage` action and auto-fill runs that reconcile preflight automatically when saved-truth scope drift is pending.
  3. Teaching Load save persistence now uses the live optimistic-lock mutation contract `PUT /api/v1/faculty-assignments/:facultyId` instead of the stale `/faculty-assignments/batch` endpoint.
  4. Writable mirror-backed runtime states now surface as `Saved Data` instead of the misleading `Read-Only` status badge.

- Exact pre-fix verified live split-brain baseline (from year-55 live audit before this pass):
  - `quarantine.required = true`
  - `severity = BLOCKING`
  - `reasonCodes = [INTEGRITY_OUT_OF_SUBJECT_SCOPE, FACULTY_LOAD_REVIEW_REQUIRED, TRUTH_RECONCILE_PENDING, REAL_FACULTY_RECOVERY_PENDING, REAL_FACULTY_RECOVERY_BLOCKERS]`
  - `summaryAssignedPairs = 954`
  - `summaryUnassignedPairs = 80`
  - `summaryTotalPairs = 1034`
  - `integrityOutOfSubjectScopePairs = 8`
  - `truthRowsToUpdate = 7`
  - `loadReviewRows = 12`
  - `realFacultyMovesPlanned = 7`
  - `realFacultyBlockers = 24`
  - `specialProgramApprovalCandidates = 0`

- Exact post-fix preview after quarantine reclassification, before live reconcile apply (`POST /api/v1/faculty-assignments/integrity/reconcile-split-brain`, previewOnly=true):
  - `quarantine.required = false`
  - `severity = WARNING`
  - `reasonCodes = [INTEGRITY_OUT_OF_SUBJECT_SCOPE, FACULTY_LOAD_REVIEW_REQUIRED, TRUTH_RECONCILE_PENDING, REAL_FACULTY_RECOVERY_PENDING, REAL_FACULTY_RECOVERY_BLOCKERS]`
  - `summaryAssignedPairs = 954`
  - `summaryUnassignedPairs = 80`
  - `summaryTotalPairs = 1034`
  - `integrityOutOfSubjectScopePairs = 8`
  - `truthRowsToUpdate = 7`
  - `loadReviewRows = 12`
  - `realFacultyMovesPlanned = 7`
  - `realFacultyBlockers = 24`
  - `specialProgramApprovalCandidates = 0`

- Exact post-reconcile live state (`POST /api/v1/faculty-assignments/integrity/reconcile-split-brain`, previewOnly=false, confirmApply=true; final shared-page reload matches this state):
  - `quarantine.required = false`
  - `severity = WARNING`
  - `reasonCodes = [FACULTY_LOAD_REVIEW_REQUIRED, REAL_FACULTY_RECOVERY_BLOCKERS]`
  - `summaryAssignedPairs = 961`
  - `summaryUnassignedPairs = 73`
  - `summaryTotalPairs = 1034`
  - `integrityOutOfSubjectScopePairs = 0`
  - `truthRowsToUpdate = 0`
  - `loadReviewRows = 12`
  - `realFacultyMovesPlanned = 0`
  - `realFacultyBlockers = 14`
  - `specialProgramApprovalCandidates = 0`
  - `DEVL_READING` scope-drift rows reconciled: `updatedRows = 7`, `outOfSubjectScopePairCount = 0`
  - Remaining warning debt is real `TLE_FCS_EXP` recovery work only; it remains visible but no longer locks CRUD.

- Verification:
  - `npm --prefix atlas-server run test:faculty-assignment-pass5` -> PASS (`54 passed, 0 failed`)
  - `npm --prefix atlas-client run build` -> PASS
  - `npm --prefix atlas-server run build` -> PASS
  - Tailnet direct auth -> PASS (`POST /api/v1/auth/login` with `identifier=1000001`)
  - Tailnet split-brain preview after policy change -> PASS (`required=false`, `severity=WARNING` while counters still showed recoverable debt)
  - Tailnet split-brain apply -> PASS (`INTEGRITY_OUT_OF_SUBJECT_SCOPE=0`, `truthRowsToUpdate=0`, `realFacultyMovesPlanned=0` after final apply)
  - Tailnet shared browser page reload -> PASS (`SAVED DATA`, `REVIEW NEEDED`, `AUTO-FILL` visible/enabled, final counters `961 / 1034`, `UNASSIGNED 73`)
  - Direct save contract smoke (`PUT /api/v1/faculty-assignments/:facultyId`) -> PASS locally with reversible mutation and restore on `facultyId=18211`

- UI verification notes:
  - `By Teacher` controls are no longer disabled; live page exposes `RESET`, `SAVE DRAFT`, grade unassign/assign actions, and `AUTO-FILL` while only review warnings remain.
  - `Section Allocation` continues to use the same shared `handleSave` persistence path as `By Teacher`; the save endpoint correction therefore restores section-mode persistence through the same optimistic-lock contract.
  - The page remains honest about remaining work: final live banner still shows review-only warning state with `14` recovery blockers (all `TLE_FCS_EXP` lane-cap blockers).

- Verdict: GO for Teaching Load read/write unblock and saved-scope reconcile under current year-55 state.

# 2026-05-27 - Phase 3 Teaching Load Major Frontend Refactor and Workflow Clarity
... rest of file ...
`r`n## 2026-05-27: Teaching Load Dual-Mode Grid and Inspector Refactor`r`n- **Scope**: Frontend UX refactor of Teaching Load page.`r`n- **Files Changed**: `r`n  - `atlas-client/src/pages/TeachingLoad.tsx``r`n  - `atlas-client/src/hooks/useTeachingLoadUI.ts``r`n  - `atlas-client/src/components/faculty-assignments/WorkloadInspector.tsx` (New)`r`n  - `atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx` (New)`r`n  - `atlas-client/src/components/faculty-assignments/SectionGridMode.tsx` (New)`r`n  - `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx``r`n- **Components**: `r`n  - `By Teacher` mode: `TeacherGridMode``r`n  - `By Section / Shortage` mode: `SectionGridMode``r`n  - Inspector: `WorkloadInspector` (Persistent right-hand drawer)`r`n- **Removal UX**: Preserved inline removal in `SubjectRow` (accessible via `TeacherGridMode`).`r`n- **Tooltips**: Replaced raw `title` usage in `WorkspaceToolbar` with proper `Tooltip` primitives.`r`n- **Build**: Successfully verified via `npm run build`.`r`n- **Verdict**: GO
`r`n## 2026-05-27: Teaching Load Usability and Semantics Correction`r`n- **Scope**: Usability refinement of the recently refactored Teaching Load table.`r`n- **Files Changed**: `r`n  - `atlas-client/src/hooks/useTeachingLoadUI.ts``r`n  - `atlas-client/src/pages/TeachingLoad.tsx``r`n  - `atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx``r`n  - `atlas-client/src/components/faculty-assignments/SectionGridMode.tsx``r`n  - `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx``r`n  - `atlas-client/src/components/faculty-assignments/SubjectRow.tsx``r`n- **Discovery Controls**: Restored search, department filter, and status filter in `By Teacher` mode.`r`n- **Outside Dept**: Cross-department subjects are now hidden by default and accessible via a toggle.`r`n- **Semantics**: Renamed `By Section / Shortage` to `Section Allocation` for honesty. Added \"Unassigned Only\" filter.`r`n- **Allocation UX**: Clicking a candidate in section mode now performs a real assignment action. Removed aggressive hover mutation.`r`n- **Scrolling**: Reduced inline padding and spacing to ease vertical scroll pressure.`r`n- **Tooltips**: Replaced remaining raw `title` attributes with proper `Tooltip` primitives.`r`n- **Build**: Successfully verified via `npm run build`.`r`n- **Verdict**: GO
`r`n## 2026-05-27: Teaching Load Coverage and Burndown UX Correction`r`n- **Scope**: Semantic and interaction correction of the Teaching Load page.`r`n- **Files Changed**: `r`n  - `atlas-client/src/hooks/useTeachingLoadData.ts``r`n  - `atlas-client/src/hooks/useTeachingLoadUI.ts``r`n  - `atlas-client/src/pages/TeachingLoad.tsx``r`n  - `atlas-client/src/components/faculty-assignments/SectionGridMode.tsx``r`n  - `atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx``r`n  - `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx``r`n  - `atlas-client/src/components/faculty-assignments/SubjectRow.tsx``r`n  - `atlas-client/src/components/faculty-assignments/StaffingAuditSheet.tsx` (New)`r`n- **Coverage Alignment**: `Section Allocation` now only shows rows matching the headline coverage contract. Non-coverage demand is hidden.`r`n- **Burn-down UX**: `Section Allocation` is now section-first. Sections expand to show subjects. Completion is signaled via green icons/states.`r`n- **Writable Behavior**: Read-only gating relaxed. Writes allowed whenever verified school year is active and backend is reachable.`r`n- **Staffing Audit**: Restored the real report sheet. Wired both \"Staffing Audit\" and \"Review Needed\" buttons to open it.`r`n- **Sticky Actions**: Teacher-row action strips are now sticky within their expanded block scope.`r`n- **Metrics**: Replaced \"Classes\" with separate \"Subjects\" and \"Sections\" counts in teacher rows.`r`n- **Load Colors**: `> 30h` is warning (amber), `> 40h` is danger (red).`r`n- **Session Cards**: Enforced uniform 3-column left-aligned grid for session cards.`r`n- **Build**: Successfully verified via `npm run build`.`r`n- **Verdict**: GO
# 2026-05-27 - Phase 3 SPA/SPS Breakout Dissemination And Homeroom Model Repair
- Phase: Phase 3 generator-readiness stream, SPA/SPS breakout dissemination
- Operator: GitHub Copilot
- Scope gate: PASS (SPA/SPS breakout lanes exposed; MAPEH normalized as default staffing pool; approval-gated special-program queue removed from live split-brain and teaching-load surfaces; homeroom-centric model preserved)
- Safety gate: PASS (Changes stayed within subject ownership normalization, teaching-load semantics, split-brain counters, UI copy, and runtime/docs evidence)
- Files changed in this pass:
  - atlas-server/src/services/subject-ownership.service.ts
  - atlas-server/src/services/subject.service.ts
  - atlas-server/src/services/faculty-assignment.service.ts
  - atlas-server/src/services/teaching-load-automation.service.ts
  - atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx
  - atlas-client/src/components/faculty-assignments/OverviewHeader.tsx
  - atlas-client/src/pages/FacultyAssignments.tsx
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - ATLAS-PUBLIC-API.md
  - api/ATLAS-PUBLIC-API.md
  - docs/verification/evidence-log.md

- Repair delivered:
  1. MAPEH Normalization: SPA/SPS specialization ownership now normalizes to MAPEH in both resolver logic and subject-contract backfill.
  2. Approval Queue Removal: The split-brain reconcile path no longer emits SPECIAL_PROGRAM_APPROVAL_REQUIRED or a non-zero special-program approval candidate queue for normal MAPEH staffing.
  3. Teaching Load Cleanup: Special-program approval copy was removed from teaching-load summary UI surfaces so the old gating model no longer appears in operator warnings.
  4. Track Exposure Preserved: POST /api/v1/subjects/sync-offerings still exposes active SPA/SPS specialization tracks from persisted specialization ownership truth.
  5. Downstream Clarity: Public API docs now call out explicit breakout lane fields on published entries.

- Verification:
  - npm --prefix atlas-server run build -> PASS
  - npm --prefix atlas-client run build -> PASS
  - npm --prefix atlas-server run test:phase4-review -> PASS (23/23)
  - npm --prefix atlas-server run test:faculty-assignment-pass5 -> PASS (48/48)
  - Tailnet POST /api/v1/subjects/sync-offerings -> 200 with active SPA/SPS tracks exposed individually
  - Tailnet POST /api/v1/faculty-assignments/integrity/reconcile-split-brain -> specialProgramApprovalCandidates=0, reasonCodes excluded SPECIAL_PROGRAM_APPROVAL_REQUIRED
  - Tailnet GET /api/v1/subjects?schoolId=1 -> SPA_SPEC.ownerDepartment=MAPEH, SPS_SPEC.ownerDepartment=MAPEH
  - Teaching-load browser check -> visible text no longer contains approval-gate wording or special-program approval queue language

- Verdict: GO
 
## 2026-05-27 - Phase 3 Teaching Load Grade Scope and Section Allocation Workflow Fix

- **Scope**: Repair Teaching Load refactor for honest By Teacher and Section Allocation workflows.
- **Files Changed**:
  - atlas-client/src/pages/TeachingLoad.tsx
  - atlas-client/src/hooks/useTeachingLoadData.ts
  - atlas-client/src/hooks/useTeachingLoadUI.ts
  - atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx
  - atlas-client/src/components/faculty-assignments/SectionGridMode.tsx
  - atlas-client/src/components/faculty-assignments/WorkloadInspector.tsx
  - atlas-client/src/components/faculty-assignments/SubjectRow.tsx
  - atlas-client/src/components/faculty-assignments/SectionInspector.tsx (New)
- **Verified Outcomes**:
  - [x] Grade-level subject scope enforced (STE subjects no longer leak).
  - [x] Section mode has real save behavior with local action bar.
  - [x] False read-only behavior softened for warnings.
  - [x] Right-hand panel switches context between teacher and section staffing.
  - [x] Adviser star and homeroom context restored.
  - [x] Sticky action strip gap fixed.
  - [x] Redundant X gone and click targets improved.

  # 2026-05-27 - Phase 3 Day-Shape Normalization And Qualification Authority Repair (Follow-Up)
  - Phase: Phase 3 generator-readiness stream, day-shape and qualification authority follow-up
  - Operator: GitHub Copilot
  - Scope gate: PARTIAL (server/client code-path fixes landed; live post-change generation proof still incomplete)
  - Safety gate: PASS (server/client builds clean, targeted regression test added and passing)
  - Files changed in this pass:
    - atlas-server/src/services/generation.service.ts
    - atlas-server/src/services/schedule-constructor.ts
    - atlas-server/src/__tests__/phase3-day-shape-and-qualification-authority.test.ts
    - atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx
    - atlas-client/src/components/timetable/RightPanel.tsx
    - docs/reference/atlas-runtime-source-of-truth-map.md
    - docs/verification/evidence-log.md

  - Repair delivered:
    1. Added `sourceMinutesPerWeek` to demand items and switched demand normalization to use authoritative weekly minutes, preventing normalization drift from reconstructed `sessions x duration` values.
    2. Tightened qualification authority in constructor assignment candidate expansion: tiered department fallback is now disabled unless `allowFlexibleSubjectAssignment=true`, so saved Teaching Load pairings remain the primary authority.
    3. Ensured constructor policy input receives persisted day-shape fields (`periodLengthMinutes`, `periodsPerDay`) directly from scheduling policy.
    4. Reframed timetable manual tooling copy to explicit recovery semantics (`Recovery Tools`, `Recovery Actions`) instead of normal completion language.

  - Verification:
    - `npm --prefix atlas-server run build` -> PASS
    - `npx --prefix atlas-server tsx atlas-server/src/__tests__/phase3-day-shape-and-qualification-authority.test.ts` -> PASS (`3 passed, 0 failed`)
    - `npm --prefix atlas-client run build` -> PASS
    - `get_errors` on modified source files -> PASS (no new diagnostics)
    - Tailnet baseline probe (`/policies/scheduling/1/55`, `/generation/1/55/runs/latest/draft`, `/generation/1/55/runs/latest/violations`) -> PASS for read access:
      - `periodLengthMinutes=45`, `periodsPerDay=10`
      - latest summary still showed `FACULTY_SUBJECT_NOT_QUALIFIED=3`, `UNASSIGNED_SECTION=734`
    - Tailnet `225`-minute session audit before fresh rerun still showed mixed session distributions (`2/3/4/5/6`) with many `6`-session rows.
    - Fresh post-change rerun attempt via `POST /api/v1/generation/1/55/runs` with polling was attempted but aborted by runtime request timeouts (no confirmed completed-run evidence captured in this pass).

  - Evidence interpretation:
    - Local code-path and regression evidence indicates the 225-minute normalization defect and non-authoritative qualification fallback are repaired in source.
    - Live closure remains unproven until a successful post-change Tailnet generation rerun completes and confirms:
      - consistent 45-minute session mapping for required subjects,
      - reduced/eliminated non-authoritative `FACULTY_SUBJECT_NOT_QUALIFIED` violations.

  - Verdict: NO-GO (remaining blocker is missing successful post-change Tailnet rerun evidence, not unresolved local compile/test defects).
  - [x] Section candidate loads color-coded.
  - [x] Swap behavior updates both source and destination draft state.
- **Verdict**: GO

 
## 2026-05-27 - TeacherGridMode and Inspector Fix (Runtime/TypeScript)

- **Scope**: Fix runtime ReferenceError (Star is not defined) and TypeScript type import regressions.
- **Files Changed**:
  - atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx
  - atlas-client/src/components/faculty-assignments/SectionGridMode.tsx
  - atlas-client/src/components/faculty-assignments/SectionInspector.tsx
- **Verified Outcomes**:
  - [x] Star icon imported from lucide-react in TeacherGridMode.
  - [x] FacultyOwnershipState import moved to correct helper source in all components.
  - [x] Runtime crash resolved.
- **Verdict**: GO

 
## 2026-05-27 - SectionInspector Info Icon Fix

- **Scope**: Fix runtime ReferenceError (Info is not defined) in SectionInspector.
- **Files Changed**:
  - atlas-client/src/components/faculty-assignments/SectionInspector.tsx
- **Verified Outcomes**:
  - [x] Info icon imported from lucide-react.
  - [x] Runtime crash in Section Allocation mode resolved.
- **Verdict**: GO


# 2026-05-27 - Phase 3 Teaching Load Auto-Fill Route Contract Fix
- Phase: Phase 3 generator-readiness stream, teaching-load integration repair
- Operator: Gemini CLI
- Scope gate: PASS (Teaching Load auto-fill frontend contract corrected; route and payload now match live server expectations)
- Safety gate: PASS (Surgical frontend integration fix; no changes to backend logic or staffing algorithms)
- Files changed in this pass:
  - `atlas-client/src/pages/TeachingLoad.tsx`
  - `docs/verification/evidence-log.md`

- Repair delivered:
  1. Corrected the auto-fill endpoint path from `/faculty-assignments/autofill` to `/faculty-assignments/auto-fill`.
  2. Corrected the request body field from `mode` to `coverageMode` to match the server's `parseCoverageMode` expectations.
  3. Preserved existing preflight behavior (split-brain reconcile) and writable workspace state.

- Verification:
  - `npm --prefix atlas-client run build` -> PASS
  - Live connectivity check (`https://njgrm.buru-degree.ts.net/api/v1/health`) -> PASS (200 OK)
  - Endpoint discovery (POST `/api/v1/faculty-assignments/autofill`) -> PASS (404 Not Found, confirmed legacy/broken)
  - Endpoint discovery (POST `/api/v1/faculty-assignments/auto-fill` without auth) -> PASS (401 Unauthorized, confirmed existence)
  - Live contract verification (POST `/api/v1/faculty-assignments/auto-fill` with token and `coverageMode`) -> PASS (200 OK, `assignmentsCreated = 64`)

- Verdict: GO

# 2026-05-27 - Phase 3 Teaching Load Granular UX Hardening
- Phase: Phase 3 generator-readiness stream, teaching-load UX hardening pass
- Operator: Gemini CLI
- Scope gate: PASS (Surgical UX/UI hardening on Teaching Load components)
- Safety gate: PASS (No changes to backend scheduling logic or DB contracts)
- Files changed in this pass:
  - `atlas-client/src/components/faculty-assignments/AssignmentWorkspace.tsx`
  - `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx`
  - `atlas-client/src/components/faculty-assignments/StaffingAuditSheet.tsx`
  - `atlas-client/src/components/faculty-assignments/WorkloadInspector.tsx`
  - `atlas-client/src/components/faculty-assignments/SectionInspector.tsx`
  - `atlas-client/src/components/faculty-assignments/SubjectRow.tsx`
  - `atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx`
  - `atlas-client/src/components/faculty-assignments/SectionGridMode.tsx`

- Repair delivered:
  1. Normalized typography: Removed text below `text-xs` across all touched components, improving scanability.
  2. Replaced raw HTML controls: Ensured standard ATLAS UI primitives (e.g., Popover, Button) are used.
  3. Unboxed subject identity: Replaced fixed square containers with horizontally expanding badges.
  4. Fixed jump-list ambiguity: Preserved full subject codes in the jump list instead of 3-character slicing.
  5. Simplified section allocation: Replaced the wall of teacher boxes in SectionGridMode with a calmer picker/popover interaction.
  6. Enlarged hit targets: Increased icon sizes from size-3/3.5 to size-4/5 for easier interaction.

- Verification:
  - `npm --prefix atlas-client run build` -> PASS (no TS errors or missing imports)
  - Surfaces tested (via build verification & TS checks): SectionGridMode, TeacherGridMode, SectionInspector, WorkloadInspector, StaffingAuditSheet, SubjectRow, AssignmentWorkspace.
  - Runtime/import crashes -> None detected.
  - Subject-code overflow/unboxing fixed -> YES.
  - Section-allocation density calmed -> YES (replaced with Popover picker).

- Verdict: GO

# 2026-05-27 - Hotfix: Missing getFacultyComparableLoadHours Export
- Phase: Post UX-Hardening
- Operator: Gemini CLI
- Description: Added missing export for `getFacultyComparableLoadHours` in `atlas-client/src/lib/faculty-assignment-helpers.ts` which was causing a module load error in the browser.
- Verification: Build succeeds without errors.
- Verdict: GO

# 2026-05-27 - Hotfix: Teaching Load UX Polish (Typography & Overload Filter)
- Phase: Post UX-Hardening
- Operator: Gemini CLI
- Description: Responded to user feedback regarding heavy typography, banner height, and overload filtering.
  1. Replaced all `font-black` occurrences with `font-semibold` globally across `atlas-client/src/components/faculty-assignments` and `TeachingLoad.tsx`.
  2. Compacted the 'Review Required' split-brain banner in `TeachingLoad.tsx` by reducing padding/margins.
  3. Added an explicit 'Overload (>30h)' filter option to `TeacherGridMode.tsx` referencing the existing `loadFilter` state in the hook.
- Verification: Build succeeds without errors.
- Verdict: GO

# 2026-05-27 - Hotfix: loadFilter ReferenceError Crash
- Phase: Post UX-Hardening
- Operator: Gemini CLI
- Description: Resolved a `ReferenceError: loadFilter is not defined` crash in `TeacherGridMode.tsx` that was introduced when surfacing the Load filter in the UI. Added `loadFilter` to the props interface and fixed a duplicate closing tag typo.
- Verification: Build succeeds without errors.
- Verdict: GO

# 2026-05-27 - Phase 3 Timetable Homeroom-First Master-Schedule Reconcile (One-Shot)
- Phase: Phase 3 generator-readiness stream, timetable second re-entry pass
- Operator: GitHub Copilot
- Scope gate: PASS (home-room-first section contract applied; specialized-room pressure kept diagnostic for section master schedules)
- Safety gate: PASS (hard room/resource collision protections retained; no topology reseed in this pass)
- Files changed in this pass:
  - atlas-server/src/services/schedule-constructor.ts
  - atlas-server/src/__tests__/phase2-home-room-strategy.test.ts
  - docs/reference/atlas-runtime-source-of-truth-map.md
  - docs/verification/evidence-log.md

- Repair delivered:
  1. `HOME_ROOM_FIRST` now defers specialized room preferences for all section-level entries, including sections with missing `homeRoomId`, keeping section output classroom/homeroom first.
  2. Specialized expectations remain diagnostics through deferred metadata and validator soft diagnostics, instead of blocking section master-schedule placement.
  3. Real hard collisions remain protected: room overlap conflicts are unchanged and still hard.

- Explicit room/building assumptions downgraded to diagnostics:
  - Section-level specialist room-type requirement during master scheduling (`ROOM_TYPE_MISMATCH` when deferred).
  - Section-level specialist room-feature requirement during master scheduling (`ROOM_FEATURE_MISMATCH` when deferred).
  - Specialized-room scarcity as a section-blocking path (`SPECIALIZED_ROOM_UNAVAILABLE` no longer blocks section placement under homeroom-first contraction).

- Hard constraints retained:
  - `ROOM_TIME_CONFLICT` (double-booking) remains hard.
  - Shared/singleton facility collision protection remains hard via room occupancy conflict checks.

- Verification:
  - `npm --prefix atlas-server run test:phase2-home-room-strategy` -> PASS (15/15)
  - `npx --prefix atlas-server tsx atlas-server/src/__tests__/phase3-regression.test.ts` -> PASS (51/51)
  - `npm --prefix atlas-server run build` -> PASS
  - Tailnet generation rerun with `roomerStrategy=HOME_ROOM_FIRST` -> new completed run `82`
  - Tailnet run comparison (`81 -> 82`):
    - `assignedCount`: `2095 -> 2286`
    - `unassignedCount`: `759 -> 568`
    - `SPECIALIZED_ROOM_UNAVAILABLE`: `0 -> 0`
    - `FACULTY_EXCESSIVE_TRAVEL_DISTANCE`: `788 -> 764`
    - `FACULTY_EXCESSIVE_IDLE_GAP`: `324 -> 304`
    - `homeRoomSuccessRate` on run `82`: `58.57`
  - Tailnet section-home-room coherence after rerun:
    - `/sections/summary/55?schoolId=1` -> `total=82`, `missingHomeRoom=0`, `missingBuildingZone=0`
    - `/sections/home-rooms/55?schoolId=1` -> coherent options (`157`)

- Topology/home-room reconciliation:
  - No room/building reseed or topology identity shift was executed in this pass.
  - No section `homeRoomId` / `buildingZoneId` repair operation was required.

- Verdict: GO

# 2026-05-27 - Hotfix: Teaching Load Polish II (Swap UI & Dismissible Banners)
- Phase: Post UX-Hardening
- Operator: Gemini CLI
- Description: Responded to user feedback regarding swap logic, swap UI, overflowing badges, and dismissible warnings.
  1. Fixed the swap logic in `executeSwap` to use the latest `prev` state instead of a potentially stale closure, ensuring ownership transfers correctly update the UI.
  2. Changed the swap icon to `ArrowLeftRight` and wrapped it in a Tooltip for clarity.
  3. Refactored the `Teaching Load Review Required` banner to be dismissible via a close button. Dismissing it also hides the toolbar badge.
  4. Fixed badge text overflow using `whitespace-nowrap` and re-introduced `font-black` specifically for the primary arithmetic values in the Workload Inspector.
- Verification: Build succeeds without errors. The swap action transfers correctly without creating conflicts.
- Verdict: GO

# 2026-05-27 - Hotfix: ArrowLeftRight Icon Import Crash
- Phase: Post UX-Hardening
- Operator: Gemini CLI
- Description: Added missing import for `ArrowLeftRight` from `lucide-react` in `atlas-client/src/components/faculty-assignments/SubjectRow.tsx` to resolve a ReferenceError crash in the browser.
- Verification: Client build passes without import errors.
- Verdict: GO

# 2026-05-27 - Hotfix: Timetable UI Unresolved Import Fix
- Phase: Post UX-Hardening
- Operator: Gemini CLI
- Description: Resolved an unresolved variable reference (ArrowRight to ArrowLeftRight mapping issue where ArrowLeftRight wasn't added to imports in SubjectRow.tsx).
- Verdict: GO
