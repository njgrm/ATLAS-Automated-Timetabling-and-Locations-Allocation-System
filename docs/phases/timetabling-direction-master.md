# ATLAS Timetabling Direction Master (Planner + QC)

Date: 2026-03-31  
Owner: Planner/QC  
Audience: Claude/Copilot implementation agent, Gemini UI polisher, verifier

## Why This Document Exists

This is the single direction file for the timetabling improvements discussed so far.  
It consolidates UX, scheduling logic, policy controls, and role workflows so implementation stays aligned and non-fragmented.

This document is implementation-oriented but remains product-first.  
Use it together with:

- `docs/phases/phase-4-bundle-a-verification.md`
- `docs/phases/phase-4-bundle-a-implementation-pack.md`
- `docs/verification/phase-4-bundle-a-qc-checklist.md`

## Product Direction (North Star)

The scheduling experience must be:

1. **Controllable** by schedulers (not opaque black-box generation only)
2. **Understandable** for non-technical school staff
3. **Policy-aware** for DepEd load and school-specific operational rules
4. **Role-appropriate** for Scheduler, Master Teachers, and Faculty
5. **Simple under pressure** (clear actions, low visual overload, explicit conflict detail on demand)

## Confirmed Policy/Behavior Baselines

- Teacher load interpretation:
  - `30h` = soft baseline target
  - `40h` = hard cap
- TLE prioritization is required (two-pass priority capability)
- Global lunch window support is required
- Vacant-aware controls are part of policy
- Grade label standardization target is `G7`, `G8`, `G9`, `G10`

## Major Improvement Themes (Complete Scope)

### A) Faculty and Teaching Load

- Faculty profile must include:
  - name
  - subject specialization context
  - employment status (`PERMANENT`/`PROBATIONARY`)
  - adviser/equivalent load context
- Teaching load view must clearly separate:
  - **Qualified/primary subjects**
  - **Other subjects (outside department)**
- Add explicit global emergency control:
  - `Allow outside department (emergency)` default OFF
- Distinguish:
  - subjects teacher is qualified for
  - subjects currently being handled
- Show clearer teacher detail context:
  - subject, room, grade + section where available

### B) Scheduling Logic and Constraints

- Keep minute-level scheduling semantics.
- TLE/lab-first behavior must be respected by generator policy.
- Add policy option for consecutive lab sessions where required by operations.
- Keep half-day window support and future-ready for per-grade shift windows.
- Expose customization controls for consecutive teaching and related soft constraints.
- Distance remains low-priority for now (do not over-weight).

### C) Room and Resource Management

- Room usage must align with real map editor buildings/rooms.
- Capacity-aware scheduling remains a required hardening item.
- Surface clear conflicts:
  - teacher conflict
  - room conflict
  - no available room.

### D) UX Simplification and Clarity

- Reduce cognitive overload in timetable/manual edit flows.
- Keep detailed conflict analysis available, but default to concise summaries.
- Support searchable, filterable assignment controls.
- Keep no-global-scroll architecture and dense operator-oriented layouts.
- Reuse grade color semantics consistently.

### E) Role-Based Workflow Direction

- Scheduler controls master planning and policy.
- Master Teacher flow must support grade-focused scheduling ownership.
- Faculty-side planning needs:
  - schedule visibility
  - room preference submission
  - preference contention notes for scheduler visibility.

## UX Decisions to Preserve

- Conflict-heavy flows should show persistent context (not toast-only failures).
- “Complex inspector” should be progressively disclosed:
  - short summary by default
  - full detail when opened.
- Drilldowns should avoid route thrash:
  - map deep-links
  - focused contextual panels when possible.

## Sequenced Delivery Waves

## Wave 1 (Start Here): Bundle A Core

Goal: stabilize teacher-load and assignment control surfaces.

- Backend:
  - faculty load-context fields + API exposure
- Frontend:
  - primary vs other subjects split
  - emergency outside-department toggle
  - subject search in teaching load
  - faculty and subject drilldown entry points
  - grade label normalization (`Gx`) across target pages
- QC gates:
  - zero TS errors server/client
  - no regressions in ScheduleReview/manual edit flows

## Wave 2: Generator and Policy Deepening

- Consecutive-lab policy control
- MWF/TTH-style preference control (where applicable)
- Capacity-aware placement/validation hardening
- stronger policy explainability in UI

## Wave 3: Workflow Expansion

- Pre-generation manual pin/lock scheduling
- per-grade shift windows (AM/PM grade ownership)
- faculty room preference contention and scheduler arbitration

## Wave 4: UX Polish and Training

- tutorial/onboarding refinement
- explainability and conflict drilldowns polish
- dashboard and timetable operator speed improvements

## Non-Negotiable Guardrails

- Do not modify `.cursor/plans/*` files for implementation.
- Keep strict MVC boundaries in backend.
- Keep versioned REST contracts under `/api/v1`.
- Avoid introducing new global scrolling behavior.
- Prefer existing UI primitives and design system patterns.

## Immediate Next Implementation Target

Proceed with **Wave 1 / Bundle A**, building on current in-progress code edits already present in:

- `prisma/schema.prisma`
- `prisma/migrations/0008_add_faculty_profile_fields/migration.sql`
- `atlas-server/src/services/faculty-adapter.ts`
- `atlas-server/src/services/faculty.service.ts`
- `atlas-server/src/routes/faculty.router.ts`

Implementation must **complete and validate** these edits rather than resetting or redoing from scratch.

