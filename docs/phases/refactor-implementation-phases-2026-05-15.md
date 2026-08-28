# Refactor Implementation Phases - Option 1 + Architectural Foresight
**Generated:** 2026-05-15  
**Status:** Green-lit by QA Agent  
**Decision:** Option 1 (Tri-Sem + Ancillary Data Contracts) is the foundational priority  
**Rationale:** Data dictates logic. Until the database schema supports 3 terms and ancillary loads are read-only, Options 2 (Home-Room) and 3 (Teacher X) cannot execute successfully.

---

## Executive Priority Summary

### Why Option 1 First
> "You cannot fix the Timetable Generator (Option 2) or build the UI for Teacher X (Option 3) if the foundational database schema is still configured for a 4-quarter year and mutable ancillary loads." — QA Agent

**The Split-Brain Threat:** Current implementation allows mutable ancillary loads at the faculty level, creating data integrity vulnerabilities. EnrollPro is the source of truth, but ATLAS can override it locally. This must be locked down before any algorithm work proceeds.

**Calendar Math Breakage:** The modularGroupId bundle assumes 4 quarters. Until the schema shifts to 3 terms, any work on the Timetable Generator is wasted effort—it will be re-done once termIndex is available.

### Parallel Foundation Work
While executing Option 1 phases, developers must **simultaneously** pre-stage the database schema for Options 2 and 3:
- Add `homeRoomId` and `buildingZoneId` foreign keys to Section table
- Add `isPlaceholder` boolean flag to Faculty table
- Ensure Timetable output schema explicitly supports `termIndex` (1, 2, or 3)

This prevents late-stage migration surprises and keeps Option 2 and Option 3 unblocked for parallel planning/design.

---

## Phase Sequencing Dependency Graph

```
Phase 1a: Database Schema Updates (Tri-Sem + Zone Columns + Ghost Flag)
    ↓
Phase 1b: Data Sync Service Hardening (Ancillary Loads Read-Only)
    ↓
Phase 1c: API Contract Updates (Generation Output Schema + Summary Payload)
    ↓
Phase 1d: Regression Testing & Acceptance Gate
    ↓
[Phase 2 & 3 Unblocked for Parallel Planning/Design]
    ↓
Phase 2: Home-Room-First Algorithm Implementation (depends on 1d)
    ↓
Phase 3: Teacher X Placeholder Workflows (depends on 1d)
    ↓
Phase 4: Concurrency & PDF Export (depends on 2 + 3 complete)
```

---

## Phase 1a: Database Schema Updates
**Scope:** Database migrations to support tri-sem model and pre-stage Zone/Ghost columns  
**Duration:** 3-4 days  
**Effort:** 8-12 story points  
**Owner:** Backend / Database engineer

### Concrete Tasks

#### Task 1a-1: Create Migration: Add Tri-Sem Fields to Subject
- **What:** Add `termGroupId` (replaces `modularGroupId` logic) and `termCount` (always 3 for DepEd model)
- **Files:**
  - `prisma/schema.prisma`: Add `termGroupId` and `termCount` fields to Subject
  - `prisma/migrations/`: Create migration `add_tri_sem_support_to_subjects`
- **Acceptance:** Migration runs cleanly; existing `modularGroupId` data is preserved for rollback; `termCount` defaults to 3
- **Dependencies:** None
- **Estimate:** 1 day

#### Task 1a-2: Create Migration: Add Zone Columns to Section
- **What:** Add `homeRoomId` (FK to Room) and `buildingZoneId` (string, e.g., "NORTH", "SOUTH") to Section
- **Files:**
  - `prisma/schema.prisma`: Add nullable `homeRoomId` and `buildingZoneId` to Section
  - `prisma/migrations/`: Create migration `add_home_room_zone_columns_to_sections`
- **Acceptance:** Migration runs cleanly; columns nullable to allow gradual population; no existing data affected
- **Dependencies:** None
- **Estimate:** 1 day

#### Task 1a-3: Create Migration: Add Ghost Flag to Faculty
- **What:** Add `isPlaceholder` boolean (defaults to false) to Faculty
- **Files:**
  - `prisma/schema.prisma`: Add `isPlaceholder` boolean to Faculty
  - `prisma/migrations/`: Create migration `add_placeholder_flag_to_faculty`
- **Acceptance:** Migration runs cleanly; all existing faculty marked as false; no data integrity issues
- **Dependencies:** None
- **Estimate:** 1 day

#### Task 1a-4: Create Migration: Add TermIndex Support to GeneratedEntry & ScheduledEntry
- **What:** Add `termIndex` integer field (1, 2, or 3) to GeneratedEntry and ScheduledEntry to track which term a session belongs to
- **Files:**
  - `prisma/schema.prisma`: Add `termIndex` integer to GeneratedEntry and ScheduledEntry
  - `prisma/migrations/`: Create migration `add_term_index_to_generated_and_scheduled_entries`
- **Acceptance:** Migration runs cleanly; defaults to 1 for backward compatibility; test queries with termIndex filtering work
- **Dependencies:** Task 1a-1
- **Estimate:** 1.5 days

#### Task 1a-5: Seed/Update Existing Data
- **What:** Run data-fixup script to populate `termGroupId` for existing science subjects and verify `termIndex` default assignment
- **Files:**
  - `prisma/seed.js` or new migration-time script
  - `atlas-server/src/scripts/backfill-tri-sem.ts`
- **Acceptance:** Science subjects have termGroupId; no data loss; all GeneratedEntry/ScheduledEntry rows have termIndex=1
- **Dependencies:** Tasks 1a-1 through 1a-4
- **Estimate:** 1 day

### Acceptance Criteria
- [ ] All 4 migrations exist and run cleanly in a fresh database and on existing databases
- [ ] No existing data is lost or corrupted
- [ ] Prisma client regenerates without errors
- [ ] TypeScript compilation passes for schema changes
- [ ] Existing tests still pass (no breaking changes yet)

---

## Phase 1b: Data Sync Service Hardening (Ancillary Loads Read-Only)
**Scope:** Lock down ancillary load data from EnrollPro as read-only; enforce sync-time integrity  
**Duration:** 3-4 days  
**Effort:** 8-10 story points  
**Owner:** Backend / Faculty Sync engineer

### Concrete Tasks

#### Task 1b-1: Add Ancillary Load Fields to FacultyMirror
- **What:** Add `ancillaryMinutesPerWeek` (integer, nullable) and `ancillaryLoadSource` (enum: HR, LOCAL, NONE) to FacultyMirror
- **Files:**
  - `prisma/schema.prisma`: Add fields to FacultyMirror
  - `prisma/migrations/`: Create migration `add_ancillary_load_tracking_to_faculty_mirror`
- **Acceptance:** Migration runs cleanly; existing records default to `NONE`; TypeScript passes
- **Dependencies:** None
- **Estimate:** 1 day

#### Task 1b-2: Update Faculty Sync to Populate Ancillary Load from EnrollPro
- **What:** Modify `syncFacultyFromExternal()` to extract ancillary load reduction from EnrollPro CSV/API and store in `ancillaryMinutesPerWeek` with source stamp
- **Files:**
  - `atlas-server/src/services/faculty.service.ts`: Update `syncFacultyFromExternal()`
  - `atlas-server/src/lib/adapters/enrollpro-faculty-adapter.ts`: Extract ancillary load field
- **Acceptance:**
  - Sync successfully reads ancillary load from EnrollPro
  - `ancillaryLoadSource` is set to `HR` when populated from EnrollPro
  - Existing manual/local entries (if any) are preserved on first sync
  - Subsequent syncs override with EnrollPro values (true read-only)
- **Dependencies:** Task 1b-1
- **Estimate:** 2 days

#### Task 1b-3: Enforce Read-Only Gate in SchedulingPolicy Service
- **What:** Add validation method `validateAncillaryLoadImmutable()` that throws error if ATLAS tries to mutate ancillary load locally after sync from EnrollPro
- **Files:**
  - `atlas-server/src/services/scheduling-policy.service.ts`: Add validation
  - `atlas-server/src/routes/faculty.ts`: Call validation before any faculty update that touches ancillary load fields
- **Acceptance:**
  - Attempt to manually change `ancillaryMinutesPerWeek` via API returns 409 Conflict with reason
  - Audit log captures attempted mutation
  - Sync always wins (HR source of truth)
- **Dependencies:** Tasks 1b-1 and 1b-2
- **Estimate:** 1.5 days

#### Task 1b-4: Add Teaching Load Calculation Tests
- **What:** Ensure teaching load calculation respects ancillary deductions (not yet applied to algorithm, but ready for Phase 1c)
- **Files:**
  - `atlas-server/src/__tests__/teaching-load-ancillary.test.ts`: New test suite
- **Acceptance:**
  - Test verifies: `availableMinutesPerWeek = maxTeachingMinutesPerDay * 5 - ancillaryMinutesPerWeek`
  - All tests pass
- **Dependencies:** Tasks 1b-1 through 1b-3
- **Estimate:** 1 day

### Acceptance Criteria
- [ ] EnrollPro ancillary loads successfully sync into FacultyMirror
- [ ] `ancillaryLoadSource` is set correctly (HR vs LOCAL)
- [ ] Attempt to manually mutate ancillary load returns 409 Conflict
- [ ] All existing tests pass
- [ ] New ancillary load tests pass with 100% coverage

---

## Phase 1c: API Contract Updates
**Scope:** Update Generation Run output schema to include `termIndex` and reflect 3-term model  
**Duration:** 2-3 days  
**Effort:** 5-8 story points  
**Owner:** Backend / API engineer

### Concrete Tasks

#### Task 1c-1: Update GenerationRun Summary Payload Schema
- **What:** Expand `/generation/:schoolId/:schoolYearId/runs/:runId` response to include `termCounts` object (term 1/2/3 session counts) and ensure `termIndex` is present in each entry
- **Files:**
  - `atlas-server/src/routes/generation.ts`: Update response builder
  - `atlas-server/src/services/generation.service.ts`: Calculate term-aware summary
  - `atlas-client/src/types.ts`: Update TypeScript interfaces for `GenerationRunSummary` and `ScheduledEntry`
- **Acceptance:**
  - Response includes `termCounts: { term1: X, term2: Y, term3: Z }`
  - Each ScheduledEntry includes `termIndex: 1|2|3`
  - Backward-compatible: clients without termIndex support still see legacy flat schedule
- **Dependencies:** Phase 1a complete
- **Estimate:** 1.5 days

#### Task 1c-2: Update Violation Report to Support Term-Scoped Constraints
- **What:** Expand violation metadata to include `termIndex` so violations can be term-aware
- **Files:**
  - `atlas-server/src/services/constraint-validator.service.ts`: Add termIndex to violation context
  - `atlas-server/src/__tests__/violation-term-aware.test.ts`: New tests
- **Acceptance:**
  - Violations correctly reference their term
  - Reports can be filtered by term
  - All tests pass
- **Dependencies:** Phase 1a complete
- **Estimate:** 1.5 days

#### Task 1c-3: Update Draft Board Summary (Pre-Generation)
- **What:** Ensure `/generation/:schoolId/:schoolYearId/pre-generation-drafts` includes term structure in preview payload
- **Files:**
  - `atlas-server/src/routes/generation.ts`: Update draft endpoint
  - `atlas-server/src/services/draft-board.service.ts`: Term-aware draft summary
- **Acceptance:**
  - Draft preview includes term structure
  - Pre-generation placements can specify `termIndex`
- **Dependencies:** Phase 1a complete
- **Estimate:** 1 day

#### Task 1c-4: Add API Documentation and Version Notes
- **What:** Document the schema changes and term-aware contract in API reference
- **Files:**
  - `ATLAS-PUBLIC-API.md`: Add section "Tri-Sem Term Model (v1.1)"
  - `docs/contracts/tri-sem-contract.md`: New contract document
- **Acceptance:**
  - All endpoints clearly document termIndex field
  - Backward compatibility notes included
  - Examples show term-aware queries
- **Dependencies:** Tasks 1c-1 through 1c-3
- **Estimate:** 1 day

### Acceptance Criteria
- [ ] Generation Run summary includes term counts
- [ ] All ScheduledEntry records include termIndex
- [ ] Violations include termIndex metadata
- [ ] Draft board respects term structure
- [ ] API documentation updated
- [ ] All existing client code still works (backward compatible)
- [ ] TypeScript compilation passes

---

## Phase 1d: Regression Testing & Acceptance Gate
**Scope:** Comprehensive testing to verify Option 1 implementation correctness and data integrity  
**Duration:** 3-4 days  
**Effort:** 10-12 story points  
**Owner:** QA / Test engineer + Backend

### Concrete Tasks

#### Task 1d-1: Unit Tests for Tri-Sem Logic
- **What:** Test all tri-sem query logic, term filtering, and data structures
- **Files:**
  - `atlas-server/src/__tests__/tri-sem-queries.test.ts`: New comprehensive test suite
- **Acceptance:**
  - 100+ test cases covering term filtering, cross-term validation, edge cases
  - All pass
  - Coverage > 90%
- **Dependencies:** Phases 1a–1c complete
- **Estimate:** 2 days

#### Task 1d-2: Integration Tests: End-to-End Generation with Tri-Sem
- **What:** Generate a complete schedule with tri-sem model; verify all three terms are populated correctly
- **Files:**
  - `atlas-server/src/__tests__/integration-generation-tri-sem.test.ts`: New E2E test
- **Acceptance:**
  - Generation runs to completion
  - Summary includes all three terms
  - Each ScheduledEntry has correct termIndex
  - No data loss or corruption
- **Dependencies:** Phases 1a–1c complete
- **Estimate:** 2 days

#### Task 1d-3: Data Integrity & Migration Verification
- **What:** Run migrations on test database; verify no data loss; check constraints and foreign keys
- **Files:**
  - `atlas-server/src/__tests__/migration-integrity.test.ts`: New migration test
- **Acceptance:**
  - All migrations pass on fresh database
  - All migrations pass on seeded database
  - No orphaned rows
  - All foreign key constraints valid
- **Dependencies:** Phases 1a–1c complete
- **Estimate:** 1.5 days

#### Task 1d-4: Build & TypeScript Verification
- **What:** Ensure full build passes; no TypeScript errors or warnings related to schema changes
- **Files:**
  - CI/CD pipeline
- **Acceptance:**
  - `npm run build` passes for both server and client
  - No TypeScript errors
  - No console warnings
- **Dependencies:** Phases 1a–1c complete
- **Estimate:** 0.5 days

#### Task 1d-5: Evidence Collection & Gate Closure
- **What:** Document all test results, migration success, schema diffs, and verification artifacts
- **Files:**
  - `docs/verification/evidence-log.md`: Add Phase 1 evidence section
  - `docs/verification/phase-gates.md`: Mark Option 1 gates as PASS
- **Acceptance:**
  - Evidence log complete with test run summaries
  - Phase gates documented as PASS
  - Sign-off ready for Phase 2 kickoff
- **Dependencies:** Tasks 1d-1 through 1d-4
- **Estimate:** 1 day

### Acceptance Criteria
- [ ] All unit tests pass (tri-sem queries, ancillary load logic)
- [ ] All integration tests pass (E2E generation with tri-sem)
- [ ] All migration tests pass (data integrity, foreign keys)
- [ ] Full build passes with no TypeScript errors
- [ ] Evidence log updated and complete
- [ ] Phase gates marked as PASS
- [ ] Manual QA sign-off obtained

---

## Phase 1 Total Effort Summary

| Phase | Tasks | Days | Story Points | Owner |
|-------|-------|------|--------------|-------|
| 1a | 5 | 3-4 | 8-12 | Backend/DB |
| 1b | 4 | 3-4 | 8-10 | Backend/Sync |
| 1c | 4 | 2-3 | 5-8 | Backend/API |
| 1d | 5 | 3-4 | 10-12 | QA/Backend |
| **1 TOTAL** | **18** | **11-15** | **31-42** | **Cross-functional** |

**Parallel Work Opportunities:**
- Tasks 1a-1/1a-2/1a-3 can run in parallel (different migrations)
- Tasks 1b-1/1b-2 can start while 1a-1 to 1a-4 are in flight
- Tasks 1c-1 through 1c-4 can start after 1a-4 completes

**Realistic Timeline:** 2-3 weeks (with parallel effort)

---

## Unblocked Planning for Phases 2 & 3

### Phase 2: Home-Room-First Algorithm (Blocked Until Phase 1d Complete)
- **Scope:** Rewrite generator to prioritize section home rooms; only solve singleton/specialized rooms
- **Pre-Planning Tasks (Can Start Now):**
  - Define Home-Room rooming strategy enum (STRICT, FLEXIBLE, MIXED)
  - Design home-room fallback logic for rooms without zone assignment
  - Sketch algorithm pseudocode for home-room-first pass
  - Pre-populate sample zone assignments in test data
- **Duration:** ~2-3 weeks after Phase 1d approval
- **Estimate:** 20-30 story points

### Phase 3: Teacher X Placeholder Workflows (Blocked Until Phase 1d Complete)
- **Scope:** Add placeholder faculty for ad-hoc assignments; UI for managing placeholders
- **Pre-Planning Tasks (Can Start Now):**
  - Design placeholder faculty creation flow (admin-only)
  - Define teaching load rules for placeholders (should they count toward faculty capacity?)
  - Sketch placeholder assignment UI (faculty assignment page)
- **Duration:** ~1-2 weeks after Phase 1d approval
- **Estimate:** 10-15 story points

---

## Risk Mitigation & Blockers

### Risk 1: EnrollPro Ancillary Load Format Mismatch
- **Mitigation:** Confirm CSV field name and data format with EnrollPro team before Task 1b-2
- **Fallback:** If format unavailable, mock it for now and re-integrate later

### Risk 2: Existing Data Has Invalid ModularGroupId References
- **Mitigation:** Run data audit query before Task 1a-5 to identify orphans
- **Fallback:** Use seed script to clean up orphaned records before migration

### Risk 3: Migration Fails on Production Environment
- **Mitigation:** Dry-run migration on production staging environment
- **Fallback:** Prepare rollback migration in advance

### Risk 4: API Clients Break on termIndex Addition
- **Mitigation:** Ensure termIndex is optional/nullable during transition; test backward compatibility
- **Fallback:** Gradual rollout—mark endpoint as "experimental" until clients adopt

---

## Integration with Existing Phases

### Phase 4 Continuation
- Phase 1 is considered **Phase 4 Objective Blocking Work**
- Once Phase 1d gates close, Phase 4 formally ends
- Phase 4→Phase 5 bridge document updated with tri-sem alignment

### Phase 5 (Publish) Dependencies
- Phase 5 generation will use termIndex to organize published output
- Room request approval flows updated to respect termIndex context

### Phase 6 (Faculty) Dependencies
- Faculty assignment page updated to show tri-sem term assignment
- Teaching load calculation respects ancillary deductions

---

## Sign-Off Gates

### Phase 1a Gate (Database Schema)
- [x] All 4 migrations written and tested on local/test DB
- [x] Prisma client regenerates
- [x] TypeScript compilation passes
- **Sign-Off Owner:** Backend Lead

### Phase 1b Gate (Sync & Read-Only Enforcement)
- [x] EnrollPro ancillary load syncs correctly
- [x] Mutation attempts blocked with 409 error
- [x] All existing tests pass
- **Sign-Off Owner:** Sync Lead + QA

### Phase 1c Gate (API Contracts)
- [x] All endpoints updated with termIndex
- [x] Backward compatibility verified
- [x] Documentation complete
- **Sign-Off Owner:** API Lead

### Phase 1d Gate (Regression & Acceptance)
- [x] All unit/integration tests pass
- [x] Build passes with no errors
- [x] Evidence log complete
- [x] Phase 2 & 3 planning can begin
- **Sign-Off Owner:** QA Lead + Product Owner

**Closure Note (2026-05-16):**
- Refactor Option 1 is closed for local execution scope.
- Evidence references:
  - `docs/verification/evidence-log.md` (2026-05-16 verification + closure pass entries)
  - `docs/verification/phase-gates.md` (2026-05-16 closure determination)
- Known non-blocking debt carried forward:
  - atlas-client full `tsc --noEmit` contains pre-existing unrelated errors outside Option 1 touched files.

---

## Success Metrics

1. **Data Integrity:** Zero data loss across all migrations; all foreign keys valid
2. **API Compliance:** All endpoints return termIndex; backward compatibility maintained
3. **Test Coverage:** >90% coverage for tri-sem and ancillary load logic
4. **Performance:** Generation time remains <60 seconds per single-school dataset (baseline)
5. **Documentation:** All changes documented in ATLAS-PUBLIC-API.md and tri-sem-contract.md

---

## Next Steps After Phase 1d Approval

1. **Kick Off Phase 2 Design** (Home-Room Algorithm)
   - Finalize zone/home-room assignment rules
   - Complete algorithm pseudocode
   - Plan UI updates for zone-aware rooming

2. **Kick Off Phase 3 Design** (Teacher X Placeholders)
   - Finalize placeholder lifecycle (creation, assignment, archival)
   - Design admin UI for placeholder management

3. **Update Overall Roadmap**
   - Mark Phase 1 as COMPLETE in phasePlan.md
   - Publish Phase 2 & 3 detailed plans
   - Communicate timeline to stakeholders

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-16  
**Next Review:** After Phase 5 kickoff checkpoint
