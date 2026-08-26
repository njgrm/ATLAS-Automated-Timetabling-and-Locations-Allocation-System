# Copilot Execution Prompt: Phase 3 Timetable Baseline Truth And Building Parity One-Shot

## Mission

Execute the first timetable re-entry pass.

This pass exists to repair **truth first**, not to optimize blindly.

Your objectives:

1. identify the latest trustworthy generation baseline for the active school/year
2. repair any run-summary/reporting contradictions
3. trace and fix building-registration parity inside `/timetable`
4. prove why buildings like `G9` can disappear in timetable even though they exist in the live map API

Do not attempt broad room-demand redesign in this pass.
Do not attempt the full stakeholder-facing term-output redesign in this pass.

Those come later.

---

## Scope

### In Scope

- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/schedule-constructor.ts` only if required for summary-contract truth
- `atlas-server/src/services/pre-generation-draft.service.ts`
- `atlas-server/src/services/map.service.ts`
- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/components/timetable/`
- `atlas-client/src/pages/ScheduleReview.tsx` or current `/timetable` shell only where required
- `prisma/seed.js`
- `atlas-server/src/scripts/seed-realistic.ts`
- targeted tests for generation-summary truth or building-consumption parity
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

### Out Of Scope

- broad room-demand relaxation
- broad specialized-room contract changes
- section home-room reconciliation except where required to explain building parity
- stakeholder-facing SCIENCE/TLE rotation output redesign
- unrelated timetable UX polish

---

## Current Verified Baseline

Treat these as already verified:

- Teaching Load data integrity is clean enough to leave alone for now
- live map API already contains:
  - `MAIN`
  - `SCI`
  - `TLE`
  - `GYM`
  - `ADMIN`
  - `G7`
  - `G8`
  - `G9`
  - `G10`
  - `STEX`
  - `SPS`
  - `SPA`
- `G9` exists in live map data, so a missing-`G9` symptom in `/timetable` is a timetable consumption/parity bug
- live topology still drifts against current seeds:
  - live map still includes `MAIN`
  - current `prisma/seed.js` template does not define `MAIN`
- recent latest-run reporting is not trustworthy enough yet and may contain contradictory summary values

---

## Required References

Read before editing:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `docs/analysis/phase3-stakeholder-campus-and-subject-normalization-audit-2026-05-18.md`
- `docs/analysis/phase3-timetabling-readiness-against-teaching-load-audit-2026-05-26.md`

Inspect directly before editing:

- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/pre-generation-draft.service.ts`
- `atlas-server/src/services/map.service.ts`
- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/components/timetable/CenterWorkspace.tsx`
- `atlas-client/src/components/timetable/LeftRailContent.tsx`
- `prisma/seed.js`
- `atlas-server/src/scripts/seed-realistic.ts`

---

## Required Outcomes

### 1. Repair latest-run truth first

You must:

- identify the latest completed generation runs for the active school/year
- verify whether the newest run summary is internally consistent
- if the newest run is contradictory, repair the summary/reporting contract

At minimum, these must agree with one another:

- `assignedCount`
- `unassignedCount`
- `hardViolationCount`
- `policyBlockedCount`
- `violations`
- `unassignedItems`

Do not claim generator progress while the reporting contract is still dishonest.

### 2. Trace building consumption through timetable

You must trace the building path through:

- live map API
- pre-generation draft context
- timetable bootstrap
- building/map workspace
- timetable building filters/pivots

Required result:

- if `G9` exists in map API, it must not disappear from timetable consumption unless an intentional filter explains it

### 3. Explain seed/topology drift

You must explicitly determine:

- why live topology still includes `MAIN`
- whether old seeded topology is still polluting the active school
- whether current timetable surfaces are mixing old and new map assumptions

Do not delete buildings casually.
If reconciliation is needed, make it auditable.

### 4. Leave room-demand semantics alone unless required for truth

If you find room-demand logic while tracing run summaries, note it.
But do not broaden this pass into room-contract redesign unless a tiny correction is required just to make run summaries truthful.

---

## Verification Requirements

### Automated

1. `npm --prefix atlas-server run build`
2. `npm --prefix atlas-client run build` if client files are touched
3. run relevant timetable/generation tests
4. add or update targeted tests if summary truth or building parity changed

### Live checks

1. verify live map API building list for `schoolId=1`
2. verify `/timetable` building-consuming surfaces see the corrected building list
3. verify whether `G9` was missing before the fix and present after the fix
4. verify latest-run metrics are internally consistent after the pass

### Evidence requirements

Document:

- exact building list seen in live map API
- exact layer where missing-building drift occurred
- exact run-summary contradictions found
- exact repair made
- final verdict: `GO` or `NO-GO`

---

## Documentation Updates

Update:

- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

Append only for `evidence-log.md`.

---

## GO / NO-GO Rule

Declare `GO` only if:

1. latest-run summary truth is internally trustworthy
2. `/timetable` no longer hides buildings like `G9` when live map API exposes them
3. live topology drift is understood and documented honestly

Otherwise declare `NO-GO` with exact remaining blocker details.
