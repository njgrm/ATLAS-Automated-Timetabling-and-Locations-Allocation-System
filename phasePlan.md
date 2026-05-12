# ATLAS Phase-by-Phase Delivery Plan

## Purpose
This is the shared planning and verification ledger for all coding agents (Cursor, Copilot, Claude).
It defines phase scope, acceptance gates, and the current progress state.

## Companion Planning Docs
- Detailed phase execution files: `docs/phases/`
- UX refactor execution plan: `docs/phases/ux-refactor-master-plan.md`
- Hybrid algorithm refactor execution plan: `docs/phases/algorithm-hybrid-refactor-plan.md`
- Verification gate checklist: `docs/verification/phase-gates.md`
- Verification evidence ledger: `docs/verification/evidence-log.md`
- Integration contract notes: `docs/contracts/enrollpro-atlas.md`
- Architecture decisions: `docs/decisions/adr-log.md`

## Active Phase
- **Current phase:** Phase 4 - Review and Manual Adjustment
- **Mode:** Build + verify only items in active phase unless user approves otherwise

## Priority Realignment (2026-05-07)
- **Direction change:** De-prioritize non-critical timetable UX/UI polish and prioritize objective-completion blockers.
- **Objective-critical focus order:**
  1. Standalone ATLAS faculty authentication flow
  2. PWA/offline-first baseline (manifest, service worker, cache/sync strategy)
  3. Generated-view functional parity blockers only
  4. Publish lifecycle implementation
  5. Faculty published schedule view (`/my/schedule`)
  6. Student/public published schedule views and APIs
- **Scope rule while Phase 4 remains active:** timetable UI changes are allowed only if they fix correctness, parity, or performance blockers tied to objective acceptance.
- **Reference docs:**
  - `docs/progress/objectives-priority-progress-check-2026-05-07.md`
  - `docs/phases/phase-4-priority-realignment-2026-05-07.md`
  - `docs/phases/ux-refactor-master-plan.md`

## Objective Completion Roadmap (Post-Faculty UX)
- Trigger: Start this sequence after faculty UX gates are accepted for the current pass.
- Objective mapping:
  - **1.1** Web-based administrative portal with drag-and-drop scheduling
  - **1.2** Configurable scheduling priority management
  - **1.3** Mobile faculty authentication with preference submission
  - **1.4** Automated timetable generation system
- Execution order:
  1. **Scheduler UX refactor (UX-1)**  
     - Finalize scheduler desktop command-center clarity and conflict triage speed.  
     - Outcome target: strengthen Objective **1.1** usability and operational readiness.
  2. **Admin UX refactor (UX-2)**  
     - Refactor policy/account governance surfaces with safe defaults and clear impact messaging.  
     - Outcome target: improve Objective **1.2** operability and reduce admin-side configuration errors.
  3. **Public/Student UX refactor (UX-4)**  
     - Simplify read-only published schedule discovery and mobile readability.  
     - Outcome target: complete publish-consumption experience tied to Objectives **1.1** and **1.4** outputs.
  4. **Publish lifecycle completion (Phase 5 core)**  
     - Close remaining publish path blockers, enforce zero-hard-violation publish rules, and finalize public APIs.  
     - Outcome target: finish Objective **1.4** lifecycle delivery and dissemination.
  5. **Priority management hardening (policy + review loop)**  
     - Tighten policy controls and scheduler decision loops affecting generated outcomes and request handling.  
     - Outcome target: complete Objective **1.2** in production-like operation.
  6. **Hybrid algorithm refactor (H-ALG)**  
     - Implement greedy multi-seed constructor + GA optimization + repair operators as described in `docs/phases/algorithm-hybrid-refactor-plan.md`.  
     - Outcome target: improve Objective **1.4** automated generation reliability and Objective **1.2** policy-priority optimization quality under dense constraints.
  7. **Cross-role consistency pass (UX-5)**  
     - Normalize status semantics, copy, spacing, and EnrollPro accent fidelity across scheduler/admin/faculty/public.  
     - Outcome target: whole-system UX coherence for Objectives **1.1–1.4**.
  8. **Final objective verification sweep**  
     - Run full automated suites + role-based manual QA + evidence consolidation for capstone objective sign-off.

## Algorithm Refactor Track (Hybrid GA Enhancement)
- **Status:** Planned (post-faculty UX gate)
- **Reference plan:** `docs/phases/algorithm-hybrid-refactor-plan.md`
- **Context:** Current deterministic constructor is fast but can be short-sighted in dense bottlenecks. GA is better for global optimization but benefits from stronger initial populations and repair operators.
- **Model choice:** Keep Genetic Algorithm as the primary optimization engine; add deterministic greedy construction and repair as supporting stages.
- **Implementation path in current system flow:**
  1. Generate multiple baseline candidates through a deterministic greedy multi-seed constructor.
  2. Feed candidates into GA for crossover/mutation optimization against hard/soft fitness.
  3. Apply repair passes for hard-constraint recovery before candidate rejection.
  4. Persist best candidate into existing generation run artifacts consumed by review UI.
- **Objective impact mapping:**
  - **1.1:** fewer broken drafts reaching manual review in admin portal workflows.
  - **1.2:** stronger policy-weighted optimization and priority control behavior.
  - **1.3:** better schedule quality for faculty-facing preference/request participation.
  - **1.4:** higher automated completion rates with fewer hard violations.
- **Gates to start implementation:**
  - Faculty UX hardening pass accepted for current cycle.
  - Algorithm benchmark datasets and pass/fail metrics agreed in evidence log.

## Non-ATLAS Scope Guardrail
- Keep out of ATLAS: enrollment/admission workflows, grades/class records, LMS content uploads, registrar document workflows, MRF governance tracking.
- ATLAS consumes cross-service data via API only.

## Phase 0 - Platform Foundation (Baseline)
- **Status:** Completed
- **Delivered**
  - PERN app shell, routing, and bridge-aware navigation
  - Core map CRUD (buildings/rooms/campus image)
  - Subject and faculty domains with assignment workflows
  - Initial dashboard with lifecycle widget and setup checklist
- **Exit criteria (passed)**
  - Server routes mounted under `/api/v1/...`
  - **Audit Wave 4: Specialization Hardening** (Delivered 2026-05-12)
  - Tiered Qualification Matcher (Specialization > Dept > Alias)
  - Dynamic Specialization Alias system (No more hardcoded keywords)
  - Unified Qualification Audit Dashboard
  - Load-aware coverage suggestions in Subjects UI

## Phase 1 - Setup Completion
- **Status:** Completed
- **Closed:** 2026-04-01
- **Closure report:** `docs/phase1-closure.md`
- **Scope**
  - Finalize setup-readiness quality for subjects, faculty, assignments, sections readiness, and campus map readiness
  - Tighten dashboard readiness indicators and setup gate logic
- **Work items**
  - Confirm map/editor UX parity with requested behavior and room typing rules
  - Implement/finish section ingestion and section count surfacing (from upstream service)
  - Harden checklist logic (teaching/non-teaching distinctions, empty placeholder buildings/rooms handling)
  - Ensure room/building type semantics align with scheduling exclusions
- **Exit criteria**
  - Setup checklist is trustworthy for scheduling readiness
  - Subjects/faculty/assignments/rooms readiness is machine-checkable
  - No unresolved phase-1 blockers remain in this file

## Phase 2 - Preference Collection
- **Status:** Completed
- **Closed:** 2026-04-02
- **Closure report:** `docs/phases/phase-2-closeout.md`
- **Scope**
  - Faculty preference submission flow and officer monitoring/reminders
- **Planned deliverables**
  - Faculty preference data model + APIs
  - Faculty portal preference screen (`/my/preferences`)
  - Officer preference status view (`/faculty/preferences`) with submit/missing indicators and reminder actions
- **Work completed**
  - Backend: Prisma models (FacultyPreference, PreferenceTimeSlot, AuditLog), enums, preference service + router (5 endpoints)
  - Backend remediation: configurable lifecycle phase (env var), auth guard (faculty self + officer/admin/SYSTEM_ADMIN bypass), MISSING filter in service layer, durable audit log for reminders
  - Frontend: FacultyPreferences page (`/my/preferences`) with time slot editor, save draft, submit, lifecycle/conflict/error handling
  - Frontend: OfficerPreferences page (`/faculty/preferences`) with summary cards, status filter, search, faculty table, multi-select + reminder action with auditId
  - Navigation: role-based sidebar entries (officer sees Preferences under Scheduling; faculty sees My Preferences under My Portal)
  - Shared types: DayOfWeek, TimeSlotPreference, PreferenceStatus, FacultyPreference, OfficerSummary*, ReminderResponse
- **Exit criteria**
  - Preference window enforceable by lifecycle state
  - Officer can identify missing submissions and trigger reminders
  - Preference data available for generation input

## Phase 3 - Schedule Generation
- **Status:** Completed
- **Closed:** 2026-04-02
- **Closure report:** `docs/phases/phase-3-acceptance-report.md`
- **Scope**
  - Run algorithm with hard/soft constraints and produce draft schedules
- **Planned deliverables**
  - Generation endpoint/workflow and persistence for generation artifacts
  - Constraint validation and warning surfaces
  - Runtime instrumentation toward sub-60-second target per school dataset
- **Work completed**
  - Generation run lifecycle endpoints and persistence model implemented
  - Deterministic baseline constructor integrated with generation runs
  - Hard-constraint validator implemented with violation reporting (8 codes)
  - Scheduling policy model/service/router integrated into constructor + validator
  - Hard violation counting semantics corrected (`HARD` only)
  - Break requirement violation emission added with toggle-based severity handling
  - Draft inspection endpoints and room schedule projection/view implemented
  - Room schedule interval-union deduplication for occupiedMinutes
  - Benchmark harness with repeatable 5-run performance artifact (p50=90ms, max=103ms)
  - Regression test suite: 22 tests covering constraint semantics, policy toggling, deduplication
- **Exit criteria (all met)**
  - Generation can run from valid setup + preference inputs
  - Hard constraint violations are detectable and reportable
  - Draft output is consumable by review UI
  - Runtime performance evidence captured (well under 60s target)

## Phase 4 - Review and Manual Adjustment
- **Status:** In Progress
- **Started:** 2026-04-02
- **Scope**
  - Officer review grid and manual schedule corrections before publish
  - **Faculty Auth Foundation (Objective-Critical, 2026-05-08):** Standalone ATLAS faculty authentication with delegated EnrollPro fallback, token identity hardening for downstream faculty route enforcement
- **Planned deliverables**
  - Review UI (`/timetable`) with conflict/warning visibility ✅ (Batch 1)
  - Manual adjustments with optimistic locking and auditability
  - Faculty auth infrastructure for Phase 5 portal access ✅ (2026-05-08)
- **Work completed**
  - Batch 1: Review Console UI foundation (ScheduleReview page, three-panel layout, run/violation/draft consumption, filter/highlight/triage UX)
  - Cross-repo hardening batch: EnrollPro build repair, authoritative contract locking for teachers/sections/cohorts, automated live-plus-cached source gate, cohort-aware review explanation hardening, and adviser-backed homeroom hints in Teaching Load
  - Wave 4.1 precision gate: section-scoped teaching load persistence, school-year/version-guarded assignment APIs, section-aware generation/manual-edit qualification, and session-visible pending ownership in Teaching Load
  - Wave 4.2 closeout: room-preference request workflow hardened with stale-run guards, regenerated latest run ownership, and passing faculty/officer browser QA on `/my/room-preferences` and `/faculty/room-preferences`
  - Wave 4.4 implementation pass: `/timetable` pre-generation promoted to a dedicated center workspace, room/building navigation unified through the editable grid, and generation anchor regression coverage extended
  - **Faculty Auth Hardening (2026-05-08):** ATLAS delegated faculty login now prefers stable upstream faculty identifiers (FacultyMirror.externalId), token identity correctly issued for downstream route enforcement, EnrollPro teacher User accounts auto-provisioned during runtime CRUD, 142 seeded teachers backfilled, end-to-end auth validation PASS (52/52 tests, protected endpoints accessible)
  - **Wave 4.5 (in progress):** Pre-generation **scheduler truth**—map-first onboarding, mandatory faculty/room confirmation aligned with teaching load, daily load policy (6h standard / ≤8h soft overload />8h hard block), pre-gen-only unassigned sourcing, richer Pins panel, full-week conflict context, desktop-first DnD gating. See `docs/phases/phase-4-review.md` section **Wave 4.5**.
- **Exit criteria**
  - Officer can resolve review findings and revalidate hard constraints
  - Conflicts are blocked from publish path until cleared
  - Faculty auth validated and ready for Phase 5 portal pages

## Phase 5 - Publish and Dissemination
- **Status:** Ready for Initiation (Faculty Auth Validated 2026-05-08)
- **Scope**
  - Publish validated schedules and expose role/public views
  - Faculty portal with authenticated schedule/preference/assignment views
- **Planned deliverables**
  - Faculty dashboard (`/my/dashboard`) with active schedule, class list, load summary
  - Faculty personal schedule view (`/my/schedule`)
  - Faculty assignment management (`/my/assignments`)
  - Publish action with lifecycle transition enforcement
  - Public schedule pages (`/s/:schoolSlug`, `/s/:schoolSlug/section/:id`)
  - Published schedule public APIs for downstream services
  - Faculty-impact notification triggers
- **Prerequisites Met**
  - ✅ Faculty authentication infrastructure (delegated login, token identity hardening, protected routes)
  - ✅ EnrollPro teacher User provisioning working (runtime CRUD creates User accounts)
  - ✅ Preference collection data model complete (Phase 2)
  - ✅ Generation and review workflows complete (Phases 3-4)
- **Exit criteria**
  - Only published schedules are exposed publicly
  - Faculty and student/public views render published data correctly
  - Publish requires zero hard-constraint violations
  - Faculty dashboard accessible and shows personalized schedule/assignments

## Phase 6 - Exceptions and Archive
- **Status:** Not Started
- **Scope**
  - Post-publish operational changes and archival lifecycle
- **Planned deliverables**
  - Exceptions handling for absences/substitutions/room changes
  - Archive transition for completed terms
  - Audit/reporting support for lifecycle events
- **Exit criteria**
  - Exceptions actions allowed only in published state
  - Archive is terminal and read-focused

## Verification Workflow (Quality Control)
- For every implementation batch:
  - Scope gate (active phase only)
  - Architecture gate (MVC/service boundaries, `/api/v1`, school scoping)
  - Behavior gate (feature-specific acceptance checks)
  - Regression gate (affected pages/routes/services)
- A batch is **Accepted** only when all blocking findings are resolved or explicitly waived by user.

## Current Phase 1 Checkpoint (from codebase audit)
- **Status:** CLOSED (2026-04-01)
- **Closure report:** `docs/phase1-closure.md`
- **Summary**
  - All five setup domains validated and machine-checkable (subjects, faculty, assignments, sections, buildings/rooms)
  - Sections sourcing + QC findings (school-scoping, grade labels, checklist messaging) fully resolved
  - Dashboard setup checklist accurate; "setup complete" banner with Phase 2 gating message live
  - Phase 1 formally closed — next active work moves to Phase 2 (Preference Collection)
