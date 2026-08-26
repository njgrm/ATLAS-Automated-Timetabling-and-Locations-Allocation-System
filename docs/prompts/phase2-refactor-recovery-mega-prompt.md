# Copilot Execution Prompt: Phase 2 Refactor Recovery + Closure Gate

## Goal
Recover Phase 2 to a genuinely closeable state by reconciling the drift between:
- `docs/phases/refactor-implementation-phases-2026-05-15.md`
- `qa-artifacts/home-room-load-preferences-validation-2026-05-16.md`
- `docs/verification/evidence-log.md`
- the actual runtime behavior and current codebase

This is a correctness-first recovery pass, not a cosmetic pass.

Primary outcomes:
- fully resolve the tri-sem vs quarter drift,
- tighten home-room fallback behavior to protect singleton and specialized rooms,
- implement the missing `isSharedFacility` contract end-to-end,
- prove dynamic shift-window enforcement with Grade + Program support,
- reconcile policy-panel time bounds with grade/program shift windows,
- replace partial evidence with closure-grade validation evidence.

## Scope
In scope:
- Tri-sem domain cleanup across schema, API contracts, generator metadata, and UI copy.
- Home-room-first fallback behavior and singleton/shared-facility protection.
- `Room.isSharedFacility` schema, seed, runtime, and validation wiring.
- Grade/program-aware shift-window model and enforcement.
- Cross-validation between scheduling policy times and grade/program shift windows.
- Validation scripts, evidence logging, and Phase 2 closure proof.

Out of scope:
- Phase 5 publish/dissemination work.
- Teacher X / placeholder-faculty work beyond existing schema consistency needs.
- Non-blocking timetable polish unrelated to Phase 2 closure.
- Broad UX redesign outside Phase 2 correctness surfaces.

## Required References
- `AGENTS.md`
- `phasePlan.md`
- `docs/verification/phase-gates.md`
- `docs/verification/evidence-log.md`
- `.github/instructions/planner.instructions.md`
- `docs/phases/refactor-implementation-phases-2026-05-15.md`
- `docs/phases/phase-2-home-room-algorithm-2026-05-16.md`
- `docs/phases/phase-2-validation-behavior-guide.md`
- `docs/phases/PHASE-2-KICKOFF-SUMMARY.md`
- `qa-artifacts/home-room-load-preferences-validation-2026-05-16.md`
- `prisma/schema.prisma`
- `prisma/seed.js`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/constraint-validator.ts`
- `atlas-server/src/services/grade-window.service.ts`
- `atlas-server/src/services/subject.service.ts`
- `atlas-client/src/types.ts`
- `atlas-client/src/components/SchedulingPolicyPane.tsx`
- `atlas-client/src/components/subjects/SubjectFormModal.tsx`

## Context7 Preflight
Before changing version-sensitive or library-sensitive code:
- use Context7 MCP if the runtime exposes it,
- if MCP is not available, use official docs via web,
- include a brief note in the final summary stating which doc source was used for any version-sensitive behavior.

## Validated Drift You Must Treat As Fact

### 1. Tri-Sem cleanup is incomplete
- Quarter-oriented modular metadata is still active in source.
- Subject seeds still define 4 science modular slices.
- Server logic still derives `termIndex` from modular `quarter`.
- UI copy still refers to quarter ordering on subject configuration surfaces.

Required interpretation:
- do not treat `termIndex` support alone as tri-sem completion,
- purge active quarter semantics from runtime behavior and user-facing copy.

### 2. Home-room fallback is too permissive
- Latest validation artifact shows `home room attempted: 2596`, `home room assigned: 1030`, `success rate: 39.68`.
- This is far below the documented `70%–85%` target.
- The current validation artifact explicitly allows “special-room squat behavior” for some fallback paths.

Required interpretation:
- the fallback model is too permissive,
- regular sections must not consume singleton/specialized rooms as casual fallback,
- phase closure cannot proceed with the current KPI miss.

### 3. `isSharedFacility` was promised but is not implemented
- Phase 2 docs and validation guidance assume `Room.isSharedFacility` exists.
- The active Room schema does not currently expose that field.
- Seed logic therefore cannot persist the intended singleton/shared-facility protection flag.

Required interpretation:
- this is a real contract gap,
- room-type inference is not an acceptable substitute for the explicit field.

### 4. Shift windows are partially implemented but under-modeled
- Dynamic `GradeShiftWindow` rows are passed into generation and used for slot filtering.
- The current model is grade-level only.
- The required target is Grade + Program.
- The latest validation artifact does not explicitly prove shift-window compliance.
- Scheduling policy earliest/latest bounds are not reconciled against grade/program windows.

Required interpretation:
- do not claim shift-window closure until evidence explicitly proves it,
- upgrade the model and validation to match the intended domain.

## Non-Negotiable Decisions

### Decision 1: Tri-Sem is replacement, not coexistence
- Implement tri-sem as the active domain model.
- Do not leave quarter semantics alive in generator metadata, warnings, or UI.
- If compatibility shims are needed internally, keep them isolated and non-user-facing.

### Decision 2: Regular fallback must be standard-room-first
If a section's home room is unavailable:
- regular demand must first search for an empty standard classroom,
- preference order should favor same `buildingZoneId`,
- specialized rooms must be protected for explicitly specialized demand,
- specialized fallback for non-specialized classes must be disallowed unless behind an explicit policy/override path.

### Decision 3: Shared-facility protection must be explicit
Add and use `Room.isSharedFacility`.
Mark `true` for at least:
- `LABORATORY`
- `COMPUTER_LAB`
- `TLE_WORKSHOP`
- `GYMNASIUM`

### Decision 4: Shift windows must be Grade + Program
Upgrade the shift-window model to support:
- base grade-level windows,
- optional program-specific overrides,
- explicit support for program exceptions such as STE overlap behavior.

### Decision 5: Policy and shift windows must be reconciled
Do not allow:
- grade/program windows outside policy earliest/latest bounds,
- policy times that make configured grade/program windows unschedulable,
- silent contradictions between policy panel times and shift-window data.

### Decision 6: Validation must prove closure criteria directly
Do not rely on scripts that only prove overload absence or one bug fix.
The closure script must explicitly validate:
- no quarter-era drift on active scheduling surfaces,
- home-room KPI status,
- no shared-facility double-bookings,
- no shift-window violations,
- no policy/shift-window contradictions.

## Execution Steps

### Batch 1: Tri-Sem domain cleanup
- Replace active quarter-era semantics in generator metadata and subject-management flows with term semantics.
- Remove user-facing quarter copy from scheduling and subject configuration surfaces.
- Stop deriving active term behavior from modular `quarter` fields.
- Normalize generated entries, summaries, warnings, and filters to Terms 1/2/3 only.

### Batch 2: Subject/modular contract cleanup
- Reconcile `modularGroupId`, `modularOrder`, `termGroupId`, and `termCount`.
- Eliminate quarter-driven modular assumptions that still imply a 4-part science rotation when the active model is tri-sem.
- Ensure subject seeds and default subject service align to the intended tri-sem modular structure.

### Batch 3: Home-room fallback hardening
- Keep `HOME_ROOM_FIRST` as the default strategy.
- Tighten fallback resolution:
  - home room first,
  - same-zone standard classroom second,
  - broader non-special fallback only if still standard-room compatible,
  - specialized/singleton rooms only for specialized demand or explicit override path.
- Preserve room-assignment diagnostics and extend them if needed.

### Batch 4: Shared-facility contract
- Add `isSharedFacility` to `Room`.
- Update seed logic so singleton/specialized facilities are explicitly flagged.
- Make generator and validator treat these rooms as protected shared resources.
- Ensure collision detection and fallback rules use the explicit flag.

### Batch 5: Shift-window model upgrade
- Change shift windows from grade-only to Grade + Program capable.
- Support base defaults plus program-aware overrides without hardcoding school-specific cases.
- Feed the richer model into generation so candidate slots are filtered correctly for actual section/program context.

### Batch 6: Policy / shift-window conflict prevention
- Add server-side validation preventing invalid combinations of:
  - `earliestStartTime`
  - `latestEndTime`
  - lunch/flag/recess windows
  - grade/program shift windows
- Add UI feedback in the policy/shift pane so invalid combinations are blocked before save.

### Batch 7: Closure-grade validation and evidence
- Replace or extend current validation scripts so they produce an explicit closure report.
- Update `docs/verification/evidence-log.md` with exact commands, pass/fail results, Tailnet run IDs, KPI outcomes, and blockers if any.
- Do not mark Phase 2 closed unless the evidence is unambiguous.

## Acceptance Targets

### Tri-Sem
- No active scheduling UI or active generator output uses `Q1/Q2/Q3/Q4` or `Quarter` where term semantics should appear.
- Generated entries, violations, and summaries are term-aware without quarter-derived user-facing semantics.
- Subject and modular configuration copy no longer instructs users in quarter-era terms.

### Home-Room
- Home-room-first remains default.
- Home-room success rate improves materially and is measured against the documented `70%–85%` target.
- Regular classes do not occupy specialized singleton rooms as normal fallback behavior.

### Shared Facility
- `Room.isSharedFacility` exists in schema and persisted data.
- Seeded gyms/labs/workshops/computer labs are explicitly flagged.
- No shared-facility double-booking is allowed in generated output.

### Shift Windows
- Grade/program windows are enforced in generation.
- Validation proves 0 illegal placements against active configured windows.
- Policy times and shift windows cannot be saved in contradictory combinations.

### Evidence
- Tailnet evidence explicitly proves:
  - tri-sem terminology is corrected on active scheduling surfaces,
  - home-room KPI is surfaced and measured,
  - shift-window compliance is verified,
  - shared-facility collisions are absent,
  - remaining blockers are either fixed or clearly documented as NO-GO.

## Verification Gates
- Prisma migration / schema integrity
- server build and typecheck
- client build and typecheck for touched surfaces
- generation regression tests
- shared-facility tests
- shift-window tests
- home-room fallback tests
- Tailnet manual QA for timetable and policy surfaces

Add or update tests for:
- tri-sem term labeling and metadata propagation,
- no active quarter-era scheduling copy on key surfaces,
- standard-room-first fallback for regular demand,
- `isSharedFacility` seed mapping and collision prevention,
- Grade + Program shift-window enforcement,
- policy/shift-window contradiction rejection.

## Tailnet QA Requirements
Validate on:
- `https://njgrm.buru-degree.ts.net`

Credentials:
- Admin: `1000001` / `AdminSY2026!`

Manual checks must include:
1. generation modal and strategy controls,
2. active term labeling in the scheduling UI,
3. shift-window settings visibility and save behavior,
4. KPI visibility in review,
5. violations filtering for shift-window and room-assignment diagnostics,
6. spot checks for regular sections displaced from home room,
7. spot checks for specialized rooms remaining available to specialized demand.

## GO / NO-GO Rubric
Return `GO` only if all of the following are proven:
- quarter-era drift is removed from active scheduling surfaces,
- home-room KPI meets the accepted target or the stakeholder explicitly waives it,
- shared-facility protection exists and is tested,
- Grade + Program shift-window enforcement is proven,
- policy/shift-window contradictions are blocked,
- evidence log contains closure-grade proof.

Return `NO-GO` if any of the above remain unresolved.

## Output Required From Implementer
1. Short context summary of the validated drift.
2. Grouped implementation summary by subsystem:
   - tri-sem
   - home-room fallback
   - shared facility
   - shift windows
   - validation/evidence
3. Verification results with exact commands and outcomes.
4. Evidence-log update confirmation.
5. Final Phase 2 closure recommendation:
   - `GO` only if all acceptance targets are proven,
   - otherwise `NO-GO` with blocker list.
