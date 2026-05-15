# ATLAS Project Phase Plan — Master Tracker
**Generated:** 2026-05-15  
**Status:** Phase 4 in progress (manual QA closure in progress) + Refactor Option 1 closed locally  
**Last Updated:** 2026-05-16

> **Note:** This document is the master phase tracker for ATLAS. It is gitignored to allow local tracking without committing status. Phase details and evidence are maintained in `docs/phases/` and `docs/verification/`.

---

## Phase Overview & Current State

```
PHASE 0: Foundation (✅ CLOSED)
├─ Database schema
├─ API framework
└─ Authentication framework

PHASE 1: Preference Collection (✅ CLOSED)
├─ Faculty preference workflow
├─ Room preference submission
└─ Preference storage & retrieval

PHASE 2: Generation Engine (✅ CLOSED)
├─ Constraint validator
├─ Greedy baseline scheduler
└─ Hybrid GA scheduler

PHASE 3: Acceptance & Publish (✅ CLOSED)
├─ Publish lifecycle state
├─ Published schedule APIs
└─ Evidence collection

PHASE 4: Review & Manual Adjustment (🔄 IN PROGRESS → CLOSURE)
├─ Review console UI with conflicts
├─ Manual edit workflow (drag-drop, validation)
├─ Faculty portal & room-request system
├─ Pre-generation draft workspace
├─ Teaching load data parity
└─ [NEW] Refactor implementation roadmap (approved)

REFACTOR OPTION 1 (✅ CLOSED - LOCAL EXECUTION SCOPE)
├─ Phase 1a: Database Schema (Tri-Sem, Zone Columns, Ghost Flag, termIndex)
├─ Phase 1b: Sync Service Hardening (Ancillary Read-Only)
├─ Phase 1c: API Contract Updates (Generation Output, Term-Aware)
└─ Phase 1d: Regression Testing & Acceptance Gate

PHASE 5: Publish & Dissemination (🔄 READY TO START)
├─ Published schedule export & distribution
├─ Faculty/student published views
├─ Notification system
└─ Dependent on: Phase 4 final manual QA closure evidence

PHASE 6: Faculty Assignment & Ancillary Load (🔄 READY TO START)
├─ Teaching load management
├─ Ancillary load sync enforcement
├─ HR source-of-truth locking
└─ Dependent on: Phase 4 final manual QA closure evidence

PHASE 7: Home-Room & Shift Fences (⏳ BLOCKED UNTIL REFACTOR PHASE 1D + OPTION 2 DESIGN)
├─ Home-room-first algorithm
├─ Shift fence policy enforcement
├─ Zone-based room allocation
└─ Dependent on: Refactor Phase 1d completion + pre-staging

PHASE 8+: Teacher X & Concurrency (⏳ FUTURE, BLOCKED UNTIL EARLIER PHASES)
├─ Placeholder faculty workflows
├─ Draft PDF export
├─ Concurrency & WebSocket presence
└─ Dependent on: All prior phases
```

---

## Phase 4: Review & Manual Adjustment
**Status:** In Progress → Closure  
**Duration:** 2026-04-02 → 2026-05-22 (estimated)  
**Objective:** Enable officers to review generated schedules, resolve conflicts, and manually adjust placements with confidence

### Phase 4 Waves Completed

| Wave | Name | Status | Dates | Key Deliverables |
|------|------|--------|-------|------------------|
| 4.0 | Batch 1: Review Console UI | ✅ DONE | 2026-04-02 | Violation panel, timetable grid, detail panel |
| 4.1 | Batch 2: Workflow Expansion | ✅ DONE | 2026-04-02 | Generate/Publish, grid pivots, grid controls |
| 4.2 | Batch 3: Room Identity | ✅ DONE | 2026-04-02 | Building shortCode, room enrichment, stale badges |
| 4.3 | Batch 4: UX Correction | ✅ DONE | 2026-04-03 | Pivot filtering, header split, unassigned tab |
| 4.4 | EnrollPro-First Seeding | ✅ DONE | 2026-04-21 | Cross-repo gate, source-of-truth enforcement |
| 4.5 | Teaching Load Precision | ✅ DONE | 2026-04-21 | Section-scoped assignments, scope normalization |
| 4.6 | Room Preference Workflow | ✅ DONE | 2026-04-21 | Request submission, review portal, stale-run guard |
| 4.7 | Timetable Workspace | ✅ DONE | 2026-04-22 | Sidebar collapse, room-request review sheet |
| 4.8 | Pre-Generation Unification | ✅ DONE | 2026-04-27 | Draft workspace, drag-drop, anchor retention |
| 4.9 | Seeding Quality & Teaching Load Hardening | ✅ DONE | 2026-05-12 | Smart load-based seeding, adviser-HG mapping |
| 4.10 | Department + Specialization UX | ✅ DONE | 2026-05-13 | Specialization mapping redesign, EnrollPro sync |

### Phase 4 Acceptance Gates

- ✅ **Gate 4.1:** Review console UI complete, all components functional
- ✅ **Gate 4.2:** Manual edit workflow (move, reassign, drag-drop) working with validation
- ✅ **Gate 4.3:** Room-request portal complete; faculty submission and officer review flows tested
- ✅ **Gate 4.4:** Teaching load data parity verified (no mismatch between UI/DB/autofill)
- ✅ **Gate 4.5:** Pre-generation workspace unified and anchor-aware
- ⏳ **Gate 4-Final:** Manual QA evidence captured (bridge-auth screenshots, live Tailnet QA)

### Phase 4 Outstanding Work

**Pending Manual QA Capture:**
- Live Tailnet session screenshots: `/timetable`, `/assignments`, room-request portal
- Bridge-auth transition evidence
- **Expected Completion:** 2026-05-22

---

## REFACTOR OPTION 1: Tri-Sem + Ancillary Data Contracts
**Status:** ✅ CLOSED — All 1a/1b/1c/1d gates PASS (audited 2026-05-16, migration 0028 applied)  
**Approval:** Green light to execute; foundational priority  
**Duration:** 2–3 weeks (11–15 days with parallel effort)  
**Effort:** 31–42 story points (cross-functional)

### Why Option 1 is the Foundational Priority

> **From QA Agent:** "You cannot fix the Timetable Generator (Option 2) or build the UI for Teacher X (Option 3) if the foundational database schema is still configured for a 4-quarter year and mutable ancillary loads. **Data dictates logic.**"

**Core Rationale:**
1. **Calendar Math Breakage:** Current modularGroupId assumes 4 quarters. Until schema supports 3 terms, any algorithm work must be re-done once termIndex is available.
2. **Split-Brain Data Risk:** Ancillary loads are mutable locally but sourced from HR. Until sync-time enforcement locks them read-only, data integrity vulnerabilities persist.
3. **Options 2 & 3 Blocked:** Home-Room algorithm and Teacher X workflows cannot execute successfully without tri-sem contract and read-only ancillary enforcement.

### Refactor Option 1 Phases

| Phase | Name | Duration | Effort | Owner | Gate |
|-------|------|----------|--------|-------|------|
| 1a | Database Schema (Tri-Sem, Zones, Ghost Flag) | 3-4d | 8-12 SP | Backend/DB | ✅ PASS — migrations 0024–0028 applied; homeRoomId added to SectionMirror (2026-05-16) |
| 1b | Sync Service Hardening (Ancillary Read-Only) | 3-4d | 8-10 SP | Backend/Sync | ✅ PASS — EnrollPro sync populates ancillary; PATCH returns 409 on HR mutation |
| 1c | API Contract Updates (Term-Aware Generation) | 2-3d | 5-8 SP | Backend/API | ✅ PASS — termIndex + termCounts in generation output; violations endpoint term-filtered |
| 1d | Regression Testing & Acceptance | 3-4d | 10-12 SP | QA/Backend | ✅ PASS — 4 test suites green; atlas-server tsc clean; atlas-client tsc pre-existing debt waivered |

**Parallel Opportunities:**
- Tasks 1a-1, 1a-2, 1a-3 can run in parallel (different migrations)
- Task 1b can start while 1a migrations are in flight
- Tasks 1c-1 through 1c-4 can start after 1a-4 completes

### Refactor Option 1 Detailed Plan

**Full Implementation:** [docs/phases/refactor-implementation-phases-2026-05-15.md](./phases/refactor-implementation-phases-2026-05-15.md)

**Key Deliverables:**
- ✅ 5 database migrations (0024–0028): tri-sem fields, room zone columns, faculty placeholder+ancillary, termIndex, section homeRoomId
- ✅ Updated faculty sync to populate ancillary loads from EnrollPro (HR source-of-truth)
- ✅ Read-only enforcement gate (validateAncillaryLoadImmutable) wired on PATCH /faculty
- ✅ Generation API: termIndex per entry, termCounts summary, violation endpoint term-filter param
- ✅ Regression test suites: faculty-sync-reconciliation (12/12), ancillary-load-policy (3/3), blocksAncillaryLoadMutation (5/5), term-scoped-violations (5/5)
- ✅ atlas-server tsc --noEmit clean; atlas-client build clean
- ✅ Evidence log and phase gates documentation updated (2026-05-16)

### Refactor Unblocked Planning (Parallel to Option 1)

**Phase 2 (Home-Room Algorithm):**
- **Scope:** Rewrite generator to prioritize section home rooms; only solve singleton/specialized rooms
- **Pre-Planning (Can Start Now):** Algorithm pseudocode, zone assignment rules, home-room fallback logic
- **Duration:** 2–3 weeks after Phase 1d approval
- **Estimate:** 20–30 story points
- **Blocker:** Phase 1d completion + homeRoomId/buildingZoneId schema prepped

**Phase 3 (Teacher X Placeholders):**
- **Scope:** Add placeholder faculty for ad-hoc assignments; UI for managing placeholders
- **Pre-Planning (Can Start Now):** Placeholder lifecycle design, teaching load rules, assignment UI sketches
- **Duration:** 1–2 weeks after Phase 1d approval
- **Estimate:** 10–15 story points
- **Blocker:** Phase 1d completion + isPlaceholder schema prepped

---

## Phase 5: Publish & Dissemination
**Status:** ⏳ Blocked until Refactor Phase 1d  
**Objective:** Enable published schedule export, distribution, and public/faculty access  
**Dependencies:**
- ✅ Phase 4 review & manual adjustment complete
- ⏳ Refactor Phase 1d (tri-sem, ancillary, API contracts) complete
- ⏳ Published schedule APIs updated with termIndex support

### Phase 5 Kickoff Conditions

- [x] Refactor Phase 1d gates all PASS (see evidence log 2026-05-16)
- [x] Generation output schema includes `termIndex` (1, 2, or 3) — confirmed in generation.service.ts
- [x] API documentation updated with term-aware contracts (ATLAS-PUBLIC-API.md)
- [ ] Phase 5 design document completed (using tri-sem model)

---

## Phase 6: Faculty Assignment & Ancillary Load
**Status:** ⏳ Blocked until Refactor Phase 1d  
**Objective:** Manage teaching load, lock ancillary loads as read-only, enforce HR source-of-truth  
**Dependencies:**
- ✅ Phase 4 teaching load parity complete
- ⏳ Refactor Phase 1b (ancillary sync enforcement) complete
- ⏳ Refactor Phase 1d regression gates all PASS

### Phase 6 Kickoff Conditions

- [x] Refactor Phase 1b gates all PASS (EnrollPro sync working, mutations blocked — 2026-05-16)
- [x] Teaching load calculation respects ancillary deductions
- [ ] Backend validation prevents invalid assignments
- [ ] Faculty assignment page displays tri-sem term assignment

---

## Phase 7: Home-Room & Shift Fences
**Status:** ⏳ Blocked until Refactor Phase 1d + Option 2 Design  
**Objective:** Implement home-room-first algorithm; enforce AM/PM/shift windows  
**Dependencies:**
- ✅ Refactor Phase 1d complete
- ⏳ Refactor Option 2 (Home-Room Algorithm) design + pre-staging complete
- ⏳ Section table includes `homeRoomId` and `buildingZoneId`

### Phase 7 Kickoff Conditions

- [ ] Refactor Phase 1d gates all PASS
- [ ] Option 2 algorithm design finalized
- [ ] `homeRoomId` and `buildingZoneId` columns populated with sample data
- [ ] Zone/home-room assignment UI designed

---

## Phase 8+: Teacher X, Concurrency & PDF
**Status:** ⏳ Future (Blocked until earlier phases)  
**Objective:** Support placeholder faculty, draft PDF export, live presence updates  
**Dependencies:**
- ✅ Refactor Phase 1d complete
- ⏳ Refactor Options 2 & 3 design/implementation complete
- ⏳ Faculty table includes `isPlaceholder` flag

---

## Risk Register

### Tri-Sem Migration Risk
**Risk:** Migration fails on production or existing data has invalid references  
**Mitigation:** Dry-run on prod-like environment; audit data before migration  
**Fallback:** Prepare rollback migration

### EnrollPro Ancillary Load Format Risk
**Risk:** CSV field format unavailable or mismatched  
**Mitigation:** Confirm with EnrollPro team before Phase 1b task 2  
**Fallback:** Mock format for now; re-integrate later

### API Backward Compatibility Risk
**Risk:** termIndex field breaks existing clients  
**Mitigation:** Mark optional/nullable during transition; test backward compat  
**Fallback:** Gradual rollout; clients adopt termIndex incrementally

### Phase 5 Dependencies Risk
**Risk:** Phase 5 can't proceed until Refactor Phase 1d complete  
**Mitigation:** Start Phase 5 design work in parallel; freeze on tri-sem contract  
**Fallback:** Execute Phases 5 & 6 in smaller batches post-refactor

---

## Evidence & Verification

**Phase 4 Evidence Log:** `docs/verification/evidence-log.md`  
**Phase 4 Gate Checklist:** `docs/verification/phase-gates.md`  
**Refactor Phase 1 Plan:** `docs/phases/refactor-implementation-phases-2026-05-15.md`  
**Refactor Comparison:** `docs/plans/STAKEHOLDER_UPDATE_COMPARISON_AND_REFACTOR_PLAN_2026-05-15.md`

---

## Key Dates & Milestones

| Date | Milestone | Status |
|------|-----------|--------|
| 2026-04-02 | Phase 4 kickoff | ✅ DONE |
| 2026-04-21 | Wave 4.4–4.6 delivery (teaching load, room-request, pre-gen) | ✅ DONE |
| 2026-05-12 | Seeding quality hardening | ✅ DONE |
| 2026-05-15 | QA approval + refactor roadmap | ✅ DONE |
| 2026-05-22 | Phase 4 closure (manual QA evidence) | ⏳ IN PROGRESS |
| 2026-06-01 | Refactor Phase 1a–1d completion (estimated) | ⏳ BLOCKED |
| 2026-06-15 | Phase 5 kickoff (estimated) | ⏳ BLOCKED |
| 2026-07-01 | Phase 6 kickoff (estimated) | ⏳ BLOCKED |

---

## Communication

**Current Phase Sponsor:** DepEd Officer + Scheduler Team  
**Phase 4 Lead:** Backend + QA  
**Refactor Phase 1 Lead:** Backend + Database  
**Next Review:** After Refactor Phase 1d gates close (estimated 2026-06-01)

---

**Document Version:** 1.0  
**Status:** MASTER TRACKER (Gitignored Local Copy)  
**Last Updated:** 2026-05-15 14:30 UTC  
**Maintained By:** Engineering Team
