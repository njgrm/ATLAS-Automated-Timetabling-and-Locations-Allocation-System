# Copilot Execution Prompt: Phase 3 Timetable Homeroom-First Master-Schedule Reconcile One-Shot

## Mission

Execute the second timetable re-entry pass.

This pass exists to make the timetable contract homeroom-first so ATLAS can replicate stakeholder class-program artifacts while protecting the `Sections` home-room truth if topology changes.

Your objectives:

1. treat each section `homeRoomId` as the default location for ordinary class-program output
2. downgrade specialized-room expectations to soft diagnostics for this pass
3. improve master-schedule feasibility under the active dataset with stable section-facing room output
4. if reseed/reconciliation changes room identity, repair section `homeRoomId` and `buildingZoneId` in the same pass

---

## Scope

### In Scope

- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/constraint-validator.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/section.service.ts`
- `atlas-server/src/services/map.service.ts`
- `atlas-client/src/pages/Sections.tsx` only if home-room-visible truth is affected
- directly related section home-room components
- `prisma/seed.js`
- `atlas-server/src/scripts/seed-realistic.ts`
- targeted tests for room-demand semantics and home-room reconciliation
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`

### Out Of Scope

- latest-run summary reporting truth except where needed for this pass
- stakeholder-facing term-aware timetable presentation redesign
- unrelated timetable UI polish
- lab-booking or facility-booking workflows outside the section master schedule

---

## Current Product Decisions

Follow these decisions exactly:

### 1. Stakeholder class-program PDFs are the primary success artifact

This pass is optimizing for replication of section master-schedule files such as `ARAL_G7_Class-Program_SY2025-2026.pdf`, where the visible room/building truth is the section home room.

### 2. Building identity should not be a hard blocker for ordinary classes

Prefer:

- classroom-default placement
- home-room-first logic
- grade-level building footprint

over:

- invented dedicated building routing for normal classes
- invented specialized-room routing for section-facing class-program output

### 3. Specialized facilities are out of the master-schedule scope for this pass

Labs, workshops, gyms, and similar facilities should not block ordinary section master schedules in this pass. They may remain as soft diagnostics for later operational booking flows.

### 4. Keep real hard resource collisions

Do **not** relax:

- room double-booking
- shared-facility double-booking where a real shared facility is explicitly assigned

### 5. If exact lab counts are uncertain, prefer homeroom-stable output over fake precision

If the specialized-room inventory is not trustworthy enough for strict global hard enforcement:

- relax that pressure to soft diagnostics
- keep only clearly real singleton/shared collisions hard when an explicit room assignment still uses those resources

### 6. Sections page must not be collateral damage

If reseed/topology normalization changes room or building identity:

- patch section `homeRoomId`
- patch section `buildingZoneId`
- verify `/sections/home-rooms/:schoolYearId`
- verify visible home-room truth in `/sections`

---

## Required References

Read before editing:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `docs/analysis/phase3-stakeholder-campus-and-subject-normalization-audit-2026-05-18.md`
- `docs/analysis/phase3-specialized-room-and-teacher-visibility-audit-2026-05-19.md`
- `docs/analysis/phase3-occupancy-plan-capacity-and-placement-audit-2026-05-18.md`
- `docs/analysis/phase3-schoolwide-stakeholder-pdf-deep-dive-2026-05-18.md`

Inspect directly before editing:

- `atlas-server/src/services/schedule-constructor.ts`
- `atlas-server/src/services/constraint-validator.ts`
- `atlas-server/src/services/generation.service.ts`
- `atlas-server/src/services/section.service.ts`
- `atlas-client/src/pages/Sections.tsx`
- relevant section room/home-room components
- `prisma/seed.js`
- `atlas-server/src/scripts/seed-realistic.ts`

---

## Required Outcomes

### 1. Make ordinary classes homeroom-first by default

Required result:

- ordinary section classes default to the section home room or nearest normal fallback
- section-facing master schedule output stays stable around the section home room
- aggressive specialized-building routing no longer dominates generic feasibility

### 2. Downgrade specialized-room expectations to diagnostics

Required result:

- no ordinary class remains unassigned solely because it could not enter a lab/workshop/gym-style room
- specialized-room expectations become soft diagnostics in this pass
- shared facilities remain protected
- room double-bookings remain blocked

### 3. Improve run feasibility honestly

After the contraction:

- rerun generation
- improve the blocker mix honestly

Primary target metrics:

- `UNASSIGNED_SECTION`
- `SPECIALIZED_ROOM_UNAVAILABLE`
- `FACULTY_EXCESSIVE_TRAVEL_DISTANCE`
- `FACULTY_EXCESSIVE_IDLE_GAP`
- `homeRoomSuccessRate`

### 4. Repair section home-room truth if topology moved

If room/building identity changed:

- section home rooms must be reconciled in the same pass
- do not leave `Sections` broken

---

## Verification Requirements

### Automated

1. `npm --prefix atlas-server run build`
2. `npm --prefix atlas-client run build` if section/client files are touched
3. run relevant generator/constraint tests
4. add/update tests for home-room reconciliation if topology changes

### Live checks

1. rerun generation on the active school/year
2. verify the new blocker counts
3. if topology changed, verify `/sections` home-room assignments still resolve cleanly
4. if topology changed, verify `/sections/home-rooms/:schoolYearId` still returns coherent options
5. verify a sample set of stakeholder-audited sections can be represented as stable home-room schedules

### Evidence requirements

Document:

- exactly which room/building assumptions were downgraded from hard scheduling truth to soft diagnostics
- exactly which hard collisions were retained
- whether section home rooms required patching
- whether specialized facilities were explicitly kept out of the section master-schedule scope
- final before/after run metrics
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

1. ordinary section schedules are homeroom-first and section-facing output is stable
2. real hard room/resource collisions remain protected
3. `Sections` home-room truth remains coherent if topology changed
4. blocker metrics improve honestly on the active dataset

Otherwise declare `NO-GO` with exact remaining blocker counts.
