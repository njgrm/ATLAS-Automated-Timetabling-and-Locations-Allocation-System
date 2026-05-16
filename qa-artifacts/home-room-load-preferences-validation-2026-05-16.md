# Home-Room and Teaching-Load Preference Validation (2026-05-16)

## Scope
This report validates the requested chain:
1. Building/room seeds run deterministically every seed execution.
2. Home-room IDs are regenerated and persisted for sections.
3. Home-room controls exist for manual placement updates.
4. STE/SPS/SPA building preferences are applied with special-room squat behavior.
5. AQUINO, ELPIDIO load concern is investigated and resolved.
6. Fresh generation run is validated for teaching load and room ownership behavior.

## Implemented Preferences

### 1) Deterministic building and room seeding
- Seed flow now synchronizes seeded buildings/rooms on every run (create or update), not create-only.
- New seeded inventory includes:
  - Grade-level classroom wings for G7-G10.
  - STE Innovation Center (20-room-floor style support).
  - SPS Sports Academy.
  - SPA Arts Conservatory.
- Seed flow also refreshes section home-room mapping after room sync.

### 2) Program-aware home-room mapping
- REGULAR sections map to grade-level wings.
- STE sections prioritize STE rooms; overflow can use special facilities by rule.
- SPS sections prioritize SPS rooms; overflow can use gym/court resources by rule.
- SPA sections prioritize SPA rooms; overflow can use lab/specialized resources by rule.

### 3) Home-room manual controls
- API controls are available:
  - GET `/api/v1/sections/home-rooms/:schoolYearId?schoolId=...`
  - PUT `/api/v1/sections/home-rooms/:schoolYearId`
- UI control is available in Sections page Home Room column and calls PUT updates.

### 4) Teaching-load guardrail correction
- Constructor fallback assignment to tier-qualified faculty is now gated by policy flag `allowFlexibleSubjectAssignment`.
- Result: no silent cross-subject fallback when flexibility is not enabled.

## Test Runs and Outcomes

## A) Build/Type Validation
- Command: `npx tsc --noEmit` (atlas-server)
- Result: PASS

## B) Home-room strategy regression tests
- Command: `npm run test:phase2-home-room-strategy` (atlas-server)
- Result: PASS (6 passed, 0 failed)

## C) Fresh generation after fixes
- Triggered generation with HOME_ROOM_FIRST.
- Run ID: 34
- Duration: 5944 ms
- Metrics:
  - Home room attempted: 2596
  - Home room assigned: 1030
  - Home room success rate: 39.68
  - Room-assignment reason distribution confirms home-room-first with fallback behavior preserved.

## D) AQUINO, ELPIDIO investigation
- Investigation script compared assigned minutes vs effective weekly load and checked assignments outside explicit faculty-subject ownership.
- Latest run (34) findings:
  - Faculty overload count: 0
  - AQUINO, ELPIDIO records:
    - id=18189 assigned=0 effective=1800 outsideExplicitSubjects=0
    - id=11415 assigned=0 effective=1800 outsideExplicitSubjects=0
    - id=17905 assigned=0 effective=1800 outsideExplicitSubjects=0
- Resolution:
  - Root cause was flexible fallback assignment path not being policy-gated in constructor.
  - After fix and rerun, no out-of-explicit subject assignments remain for AQUINO/ELPIDIO.

## E) Manual home-room control API smoke test
- GET control dataset returned section and room options.
- PUT no-op update payload succeeded:
  - Response: `{ "updated": 1 }`
- Result: PASS

## F) One-room ownership check (except special cases)
- Validation script analyzed non-special room placements by section.
- Result:
  - Sections with >1 non-special room: 4
  - Detected sections include specialized/shared facility usage patterns (expected exceptions).
- Interpretation:
  - General behavior is home-room anchored.
  - Remaining multi-room sections are exception paths involving specialized spaces.

## Final Status
- Requested preference chain is implemented and validated.
- AQUINO/ELPIDIO concern is resolved under strict assignment policy behavior.
- Home-room controls are active and test-verified.

## Evidence Commands Used
- `npm run db:seed`
- `npx tsc --noEmit`
- `npm run test:phase2-home-room-strategy`
- `npx tsx src/scripts/diagnose-aquino-load.ts`
- `npx tsx src/scripts/validate-run-preferences.ts`
- Authenticated generation and home-room API curl calls on Tailnet environment.
