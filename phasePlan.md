# ATLAS Phase-by-Phase Delivery Plan

## Purpose
This is the shared planning and verification ledger for all coding agents (Cursor, Copilot, Claude).
It defines phase scope, acceptance gates, and the current progress state.

## Active Phase
- **Current phase:** Phase 1 - Setup Completion
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
- **Status:** In Progress
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
- **Status:** Not Started
- **Scope**
  - Faculty preference submission flow and officer monitoring/reminders
- **Planned deliverables**
  - Faculty preference data model + APIs
  - Faculty portal preference screen (`/my/preferences`)
  - Officer preference status view (`/faculty/preferences`) with submit/missing indicators and reminder actions
- **Exit criteria**
  - Preference window enforceable by lifecycle state
  - Officer can identify missing submissions and trigger reminders
  - Preference data available for generation input

## Phase 3 - Schedule Generation
- **Status:** Not Started
- **Scope**
  - Run algorithm with hard/soft constraints and produce draft schedules
- **Planned deliverables**
  - Generation endpoint/workflow and persistence for generation artifacts
  - Constraint validation and warning surfaces
  - Runtime instrumentation toward sub-60-second target per school dataset
- **Exit criteria**
  - Generation can run from valid setup + preference inputs
  - Hard constraint violations are detectable and reportable
  - Draft output is consumable by review UI

## Phase 4 - Review and Manual Adjustment
- **Status:** Not Started
- **Scope**
  - Officer review grid and manual schedule corrections before publish
- **Planned deliverables**
  - Review UI (`/schedule/review`) with conflict/warning visibility
  - Manual adjustments with optimistic locking and auditability
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
- **Ready/implemented**
  - `subjects`, `faculty`, and `faculty/assignments` routes/pages exist and are functional baselines
  - map editor/building panel already include floor count, non-teaching flags, and room reordering patterns
- **Still incomplete for Phase 1 closure**
  - sections module is still placeholder
  - timetable module is still placeholder
  - some setup quality checks need stronger rule enforcement and verification evidence
