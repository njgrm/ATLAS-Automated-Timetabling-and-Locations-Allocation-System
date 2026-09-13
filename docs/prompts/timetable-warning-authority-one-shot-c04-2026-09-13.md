# One-shot C04-B: Warning authority, retirement, and term-aware truth

Packet ID: `TT-WARNING-AUTHORITY-C04`
Role: EXECUTOR (fresh session). Returns `REVIEW_REQUIRED`; no self-approval,
merge, or push.
Risk tier: MEDIUM full-stack source (validator, policy, read models, client
labels) with HIGH publication-authority implications; no live mutation,
deployment, generation, or publication.
Date authored: 2026-09-13 (Asia/Manila), from cycle TT-DYNAMIC-AUDIT-C04.

## 0. Governing references

- `D:/ATLAS/AGENTS.md` (canonical directive; normalized SHA-256 at authoring
  `29C1BD0600937B18C9B387B7F0A71A464E7EE8F7BC15D8A12B14AEE9CB41F81E`).
- `docs/reference/timetable-dynamic-workspace-and-warning-contract.md` §6.
- `docs/audits/timetable-dynamic-workspace-audit-2026-09-13.md` findings
  C-01…C-16 and CP-5/CP-6.

## 1. Objective

Retire the false metric travel warning from active behavior, replace it with
auditable building/floor transition semantics, decouple policy families, stop
unreliable warnings from ever becoming hard publication blockers, make every
faculty/day and section/day calculation term-aware, and give all warning
surfaces one authoritative context and one complete client contract.

## 2. Worktree, base, and boundaries

- Create a clean worktree from refreshed `origin/main` at the exact base SHA the
  planner pins at dispatch (must include the integrated TT-DYNAMIC-AUDIT-C04
  docs package). Branch: `work/tt-warning-authority-c04`.
- **Owned paths (exclusive):**
  - Server: `atlas-server/src/services/constraint-validator.ts`,
    `scheduling-policy.service.ts`, `generation-preflight.service.ts`,
    `pre-generation-draft.service.ts`, `manual-edit.service.ts`,
    `generation.service.ts`, `publication-contract.service.ts`.
  - Server tests: new `atlas-server/src/__tests__/timetable-warning-authority-*.test.ts`
    plus focused updates to warning/validator tests that must change.
  - Client: `atlas-client/src/hooks/useTimetableData.ts`,
    `atlas-client/src/types.ts`,
    `atlas-client/src/components/timetable/ScheduleReviewWorkspace.constants.ts`,
    `atlas-client/src/components/timetable/simplePublishReadiness.ts`,
    `atlas-client/src/components/timetable/GeneratedRunRailPanels.tsx`,
    `atlas-client/src/components/ExplainabilityDrawer.tsx`,
    `atlas-client/src/components/PolicyImpactSummary.tsx`,
    `atlas-client/src/components/SchedulingPolicyPane.tsx`,
    `atlas-client/src/components/SchedulingPolicySheet.tsx`,
    `atlas-client/src/components/scheduling-policy/PolicyPanePrimitives.tsx`,
    and new `atlas-client/src/lib/__tests__/timetable-warning-authority-*.test.ts`.
  - One executor handoff: `docs/handoffs/tt-warning-authority-c04-executor.md`.
- **Forbidden paths (other packets / planner):** every other
  `atlas-client/src/components/timetable/**` file (owned by
  `TT-DYNAMIC-WORKSPACE-C04`, especially `TimetableSimpleHeader.tsx`,
  `ScheduleReviewWorkspace*.tsx`, `TimetableWorkflowDialogs.tsx`),
  `atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts`,
  `useTimetableMutations.ts`, `atlas-server/src/services/timetable-*.ts`,
  `reconciliation*.ts`, `teaching-load-*.ts`, `timetable-sync-setup.service.ts`,
  `timetable-quick-place.service.ts`,
  `atlas-server/src/services/generation-input-snapshot.service.ts` (S4),
  `CHANGELOG.md`, `docs/plans/atlas-active-delivery-streams.md`, runtime map.
- **Forbidden actions:** live database writes or API mutations; starting a
  server against the shared/live `.env` DB; generation, publication, deployment,
  restart, migration, term-cache/TL apply, login, or companion-repo edits. Do
  not push.

## 3. Required outcomes and failing-first controls

### R1 — Retire the false metric travel warning (finding C-01; contract §6.1)

- `FACULTY_EXCESSIVE_TRAVEL_DISTANCE` must have **no producer** on any surface:
  `constraint-validator.ts:645-677` must not compute or emit it, must not read
  `Building.x/y` for warnings, and must not emit `estimatedDistanceMeters`.
- Remove the operator control and its policy field from active UI
  (`SchedulingPolicyPane.tsx:950-957`, `PolicyPanePrimitives.tsx:34-37`).
  Keep `Building.x/y` and the historical column as deprecated compatibility
  data; keep the code in the client union as a deprecated legacy label only so
  old persisted runs render (never promotable).
- The retired code must never block publication, including on legacy runs that
  already persisted it as HARD: publication must exclude non-allowlisted codes
  from the hard-blocking set (R4) and surface them only as informational.
- Controls: failing-first test asserting zero emissions of the code across
  generation/manual/pre-gen contexts; a mutant that attempts to enable/promote
  it proves no publication effect and no hard severity survives; a source-level
  assertion that the validator no longer references `Building.x/y`.

### R2 — Cross-building and cross-floor semantics (findings C-03, C-14)

- Add `FACULTY_FLOOR_TRANSITION`: emitted when consecutive same-faculty,
  same-day, same-term entries are in the **same building** with
  `|floorDelta| >= floorTransitionThreshold` (default 3) and an inter-class gap
  below `floorTransitionBufferMinutes` (default 5). Authority is `Room.floor`
  only; `floorNumber` is not consulted unless it equals `floor`.
- 1–2 floor moves inside one building must not warn on their own.
- Keep `FACULTY_EXCESSIVE_BUILDING_TRANSITIONS` and
  `FACULTY_INSUFFICIENT_TRANSITION_BUFFER` identity-based; make the hardcoded
  5-minute back-to-back buffer (`constraint-validator.ts:680`) a policy field
  (`buildingTransitionBufferMinutes`, default 5) used by both checks.
- All transition/floor checks are term-aware (R6) and never promoted to hard.
- Controls: deterministic fixtures for same-building 1/2/3-floor moves, gap
  boundaries (4/5/6 min), cross-building moves, and cross-term duplicates.

### R3 — Decouple policy families and align defaults (findings C-04, C-05, C-13)

- Replace the single master switch gate set with explicit families:
  building transitions (transitions + buffer), floor transitions, idle gap,
  early start, late end, vacant, compression. Each family is gated only by its
  own flag and its per-code `enabled`; the deprecated
  `enableTravelWellbeingChecks` must no longer gate unrelated codes. Existing
  persisted rows migrate to the new flags (absent new flags derive from the old
  value; document the mapping).
- Unify the policy defaults and normalization: `ROOM_CAPACITY_EXCEEDED` default
  `treatAsHard:false` on both client and server; every read path that feeds a
  gate (including `generation-preflight.service.ts:586`) goes through one
  normalization resolver so a raw row can never diverge from the UI contract.
  Keep the documented asymmetry: generation warns (SOFT), manual candidate
  placement hard-blocks.
- Remove or document dead config (`SESSION_PATTERN_VIOLATED`,
  `constraint-validator.ts:28-54`; unused `SchedulingPolicySheet.tsx` delete if
  it truly has no importers).
- Controls: mapping tests for legacy→new flags; default-parity test across
  client defaults, server defaults, and the normalized read; a mutant proving a
  raw stored `treatAsHard:true` for room capacity cannot block publication.

### R4 — Promotion trust boundary (finding C-06; contract §6.4)

- Add a server-owned allowlist of codes that may be `treatAsHard` (trustworthy
  structural checks only: conflicts, overload, qualification, unassigned,
  room type/feature hard cases, correctly-computed daily max). Writing
  `treatAsHard:true` for any non-allowlisted code is rejected with a typed 400
  (`CONSTRAINT_NOT_PROMOTABLE`) and legacy rows are coerced to non-hard on read.
- Publication derives hard-blocking only from allowlisted codes; non-allowlisted
  HARD severities can never block publication.
- Controls: per-code allowlist test; promotion mutation fixture proving a
  persisted non-allowlisted `treatAsHard:true` has zero publication effect and
  is rejected on write.

### R5 — Term-aware grouping for every soft/policy check (finding C-02)

- Group faculty/day and section/day calculations by
  `(facultyId|sectionId, day, termIndex)`; a year-long entry expanded across
  terms contributes its minutes only inside each term. Consecutive/break/idle/
  vacant/compressed/daily computations must all use the term key. Where a
  physical slot repeats across terms, no cross-term accumulation is allowed.
- Controls: failing-first 3-term fixture where per-term daily minutes are legal
  (e.g., 4×45 min) but the summed total would exceed the hard max → after the
  fix, zero `FACULTY_DAILY_MAX_EXCEEDED` and zero false SOFT
  daily/consecutive/vacant/compressed violations; a mutant restoring the
  term-blind key must fail. This test must fail on the current base.

### R6 — One warning context per surface (findings C-08, C-09, C-11; CP-6)

- Manual edits and pre-generation previews must consume the same authoritative
  inputs as generation: room `features`, subject `requiredFeatures`, the
  effective ancillary-deducted faculty hours authority, and placement term
  identity (`LockedSession.termIndex` must survive into the preview context).
- Controls: parity test — the same schedule produces identical violation codes
  and severities through generation, manual-edit, and pre-gen contexts; a
  mutant removing `features` from the manual context must fail.

### R7 — Client contract completeness (findings C-07, C-15)

- Add `ROOM_FEATURE_MISMATCH` (and the new floor-transition code) to the client
  union and both label maps; guard label lookup so an unknown code never throws
  (`useTimetableData.ts:525`) and the rail renders a readable fallback.
- Make the read-model scope explicit: the `violations` list stays selected-term
  scoped; counts returned to clients must carry a documented scope (run-wide
  gate counts vs selected-term display counts) so the client gate (packet A)
  can consume run-wide truth while the display stays term-scoped. Do not change
  the server's run-wide publication semantics.
- Controls: label/search tests for the new codes and an unknown code; count
  scope test for a multi-term run.

### R8 — Coverage closure (finding C-16)

- Add deterministic production-path tests (with failing-first controls) for
  every touched code family: travel retirement, floor/building transitions,
  buffer, idle, early/late, vacant/compressed, daily standard/max, consecutive/
  break, promotion allowlist, term-aware grouping, and the publication effect
  for each. No test may rely on a policy-less validator context to pass.

## 4. Mandatory gates

- `atlas-server`: `npm run build`; focused suites
  `npm run test:hybrid-scheduler`, `npm run test:timetable-quick-place`,
  `npm run test:timetable-sync-setup`, `npm run test:preference-wellbeing`,
  plus every new `timetable-warning-authority-*` test, plus the existing suites
  that build validator contexts (e.g. `generation-canonical-readiness-genc02`,
  `tt-output-c03r3`, `timetable-candidate-domain`,
  `generation-stakeholder-shape-genc02r`, `generation-rotation-totals-genc02r1`,
  `generation-production-trigger-genc02r1`) — these must be updated to assert
  the new behavior rather than disabling it.
- `atlas-client`: `npx tsc --noEmit` (or repo-exact), `npm run build`,
  `npm run test:timetable-operator-ux`, `npm run test:ux-guardrails`, plus new
  `timetable-warning-authority-*` tests.
- `git diff --check`; clean staged-path audit.
- If any persistence read path changes, follow the repo's disposable-PostgreSQL
  pattern for a zero-write/normalization test; never against the shared DB.

## 5. Browser QA requirements (no login authorized)

- Rendered policy-pane and rail-label rows: cover with component tests;
  if an `ISOLATED_LOCAL_BROWSER` matched candidate build is used, label it and
  never start a server against the shared `.env` DB.
- Tailnet read-only rows require an existing reusable session with origin
  assertion; otherwise `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`. Do not log
  in, do not request credentials, and do not use the shared runtime for writes.

## 6. Review, correction budget, and return contract

- Fresh independent QA on the immutable `<base>...<candidate>` range; maximum
  two correction rounds; additive commits only.
- Return one handoff: base/candidate SHAs, changed paths, trace table with
  PASS/BLOCKED/DEFERRED, decisive command results, browser labels, known risks,
  `REVIEW_REQUIRED`. Do not edit the living register, `CHANGELOG.md`, or other
  streams' files.
