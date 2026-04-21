# ATLAS Phase-by-Phase Delivery Plan

## Purpose
This is the shared planning and verification ledger for all coding agents (Cursor, Copilot, Claude).
It defines phase scope, acceptance gates, and the current progress state.

## Companion Planning Docs
- Detailed phase execution files: `docs/phases/`
- Verification gate checklist: `docs/verification/phase-gates.md`
- Verification evidence ledger: `docs/verification/evidence-log.md`
- Integration contract notes: `docs/contracts/enrollpro-atlas.md`
- Architecture decisions: `docs/decisions/adr-log.md`

## Active Phase
- **Current phase:** Phase 4 - Review and Manual Adjustment
- **Mode:** Build + verify only items in active phase unless user approves otherwise

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
  - Core setup entities persisted via Prisma
  - Basic officer setup flow navigable end-to-end

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
- **Planned deliverables**
  - Review UI (`/timetable`) with conflict/warning visibility ✅ (Batch 1)
  - Manual adjustments with optimistic locking and auditability
- **Work completed**
  - Batch 1: Review Console UI foundation (ScheduleReview page, three-panel layout, run/violation/draft consumption, filter/highlight/triage UX)
  - Cross-repo hardening batch: EnrollPro build repair, authoritative contract locking for teachers/sections/cohorts, automated live-plus-cached source gate, cohort-aware review explanation hardening, and adviser-backed homeroom hints in Teaching Load
  - Wave 4.1 precision gate: section-scoped teaching load persistence, school-year/version-guarded assignment APIs, section-aware generation/manual-edit qualification, and session-visible pending ownership in Teaching Load
- **Exit criteria**
  - Officer can resolve review findings and revalidate hard constraints
  - Conflicts are blocked from publish path until cleared

## Phase 5 - Publish and Dissemination
- **Status:** Not Started
- **Scope**
  - Publish validated schedules and expose role/public views
- **Planned deliverables**
  - Publish action with lifecycle transition enforcement
  - Faculty-facing timetable view (`/my/schedule`)
  - Public schedule pages (`/s/:schoolSlug`, `/s/:schoolSlug/section/:id`)
  - Published schedule public APIs for downstream services
  - Faculty-impact notification triggers
- **Exit criteria**
  - Only published schedules are exposed publicly
  - Faculty and student/public views render published data correctly
  - Publish requires zero hard-constraint violations

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
