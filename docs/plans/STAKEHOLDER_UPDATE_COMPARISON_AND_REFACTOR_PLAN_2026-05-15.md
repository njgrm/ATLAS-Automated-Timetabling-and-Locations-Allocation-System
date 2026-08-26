# Stakeholder Update vs Current System - Comparison and Refactor Plan
Generated: 2026-05-15

## Purpose
This document compares the proposed pivots in NEW STAKEHOLDER UPDATE.md against the currently implemented ATLAS system, then defines a concrete refactor lane to finalize architecture and delivery sequencing.

## Sources Reviewed
- docs/plans/NEW STAKEHOLDER UPDATE.md
- docs/plans/phasePlan.md
- docs/phases/phase-4-review.md
- docs/phases/phase-5-publish.md
- docs/phases/phase-4-priority-realignment-2026-05-07.md
- docs/SYSTEM-OVERVIEW.md
- docs/verification/evidence-log.md
- CHANGELOG.md
- docs/progress/objectives-priority-progress-check-2026-05-07.md
- docs/phases/requirements-science-rotation.md
- docs/phases/publish-readiness-implementation-plan.md

## Current Program Context (as of review)
- Active phase pointer is Phase 4 (Review and Manual Adjustment), with priority realignment toward objective blockers.
- Publish and dissemination are partially scaffolded but Phase 5 remains not started in phase docs.
- Faculty assignment integrity and source-of-truth sync have had multiple hardening passes in changelog/evidence, including duplicate-ownership and mirror-parity improvements.

## Executive Readout
- The stakeholder pivots are directionally compatible with ATLAS architecture but only partially reflected in implementation.
- Strongest alignment today: source-of-truth mindset, teacher-movement constraints, and concurrency guards.
- Largest gaps: tri-sem term model, ancillary-load sync model, home-room-first rooming strategy, Teacher X placeholder workflow, and draft PDF sign-off exports.

---

## Comparison Matrix

### 1) Curriculum and Labor Constraints

#### 1.1 Tri-Sem Shift (3 terms, not 4 quarters)
- Proposal:
  - Move from quarter-based 4-part modular assumption to a 3-term school-year model with Term 1/2/3 schedule layers.
- Current system evidence:
  - requirements-science-rotation.md still defines 4 science modules (Bio/Chem/ES/Phys) and quarter-oriented modular metadata expectations.
  - Subject model has modularGroupId/modularOrder, but no explicit tri-sem term domain model is enforced in currently reviewed docs.
- Status: PARTIAL / MISALIGNED
- Gap:
  - Modular grouping exists, but the temporal contract is still effectively 4-part in core requirements.
  - No explicit Term entity/layering contract for generated and published views.
- Refactor impact:
  - Introduce term-aware scheduling domain (tri-sem) and migrate generation/reporting contracts from quarter assumptions.

#### 1.2 Ancillary Loads as Read-Only Sync
- Proposal:
  - Administrative deductions (e.g., department head load reduction) should come from EnrollPro and be read-only in ATLAS.
- Current system evidence:
  - Faculty metadata includes editable local load controls (e.g., maxHoursPerWeek) and scheduling-level adjustments.
  - No clear implemented ancillary-load ingestion contract from EnrollPro found in reviewed docs.
- Status: PARTIAL
- Gap:
  - ATLAS still behaves as a mutable load authority for key capacity fields.
  - Missing dedicated ancillary-load sync contract and provenance tracking.
- Refactor impact:
  - Separate HR-derived ancillary load from local scheduling knobs; enforce read-only synced deductions with source stamps.

### 2) Physical Space and Time Constraints

#### 2.1 Home-Room-First Rooming (drop universal room search)
- Proposal:
  - Default classes to section home rooms; only enforce explicit singleton spaces (e.g., gym/lab bottlenecks).
- Current system evidence:
  - Current constructor flow still resolves compatible rooms per class placement and validates room occupancy broadly.
  - Room conflict logic and room-type constraints are deeply integrated into generation and review flow.
- Status: PARTIAL / STRATEGIC MISMATCH
- Gap:
  - Solver complexity remains tied to universal room allocation.
  - No explicit home-room default mode with singleton exception policy found in reviewed implementation references.
- Refactor impact:
  - Introduce rooming strategy mode (HOME_ROOM_FIRST) and limit hard room solving to singleton/specialized resources.

#### 2.2 Shift Fences and Zone Transitions
- Proposal:
  - Enforce AM/PM/overlap shift windows per grade/program and minimize cross-zone transitions.
- Current system evidence:
  - GradeShiftWindow model and service exist.
  - Teacher movement and building-transition constraints already exist in policy and validator pathways.
- Status: PARTIAL TO STRONG
- Gap:
  - Policy primitives exist, but school-specific shift fence defaults and strict enforcement profile are not codified as a formal implementation package in reviewed plans.
- Refactor impact:
  - Promote GradeShiftWindow + transition constraints into mandatory baseline policy for target schools and generation gate checks.

### 3) Operational and Human Constraints

#### 3.1 Teacher X (Placeholder Faculty)
- Proposal:
  - Allow temporary placeholder faculty capacity to fully schedule on paper before HR onboarding.
- Current system evidence:
  - Faculty mirrors are source-synced; unassigned classes become lacking-faculty outputs.
  - No explicit placeholder/TBA faculty entity and swap-to-real-faculty workflow found in reviewed artifacts.
- Status: MISSING
- Gap:
  - Cannot reserve workload for future hires without introducing fake HR records.
- Refactor impact:
  - Add PlaceholderFaculty (non-HR) entity + guarded workflows for assignment, replacement, and audit trail.

#### 3.2 Concurrency + Draft PDF Exports
- Proposal:
  - Multi-coordinator concurrent scheduling with presence and conflict safety, plus printable draft exports for offline approvals.
- Current system evidence:
  - Optimistic locking/version conflicts are already implemented in several write paths.
  - Collaboration/presence infrastructure exists (WebSocket presence and SSE event channels, with evidence logs).
  - No dedicated timetable draft PDF export pipeline found; only print/save behavior appears on occupancy preview surface.
- Status: PARTIAL
- Gap:
  - Presence/collaboration exists but appears concentrated on room-preference and selected flows.
  - Missing formal draft-to-PDF approval artifact flow for timetable sign-off.
- Refactor impact:
  - Extend presence guarantees to timetable editing surfaces and add draft schedule PDF export package with sign-off metadata.

---

## Refactor Workstreams (Recommended)

### Workstream A - Data Contract and Lifecycle Alignment (High Priority)
1. Tri-Sem domain model
- Add explicit term model (Term 1/2/3) in generation runs, draft payloads, and published endpoints.
- Replace quarter-bound modular assumptions in requirements-science-rotation and related generator outputs.

2. Ancillary load authority split
- Introduce read-only synced ancillary-load fields sourced from EnrollPro.
- Keep local planner controls separate and traceable; prevent HR split-brain writes.

### Workstream B - Solver Complexity and Operational Realism (High Priority)
1. Home-room-first policy mode
- Add scheduling policy switch and default implementation path using section home room.
- Reserve hard room resolution for singleton/specialized room groups only.

2. Shift fence baseline
- Convert grade/program windows into hard generation constraints by default for target schools.
- Keep zone-transition constraints soft-but-visible with escalations when repeatedly violated.

### Workstream C - Human Workflow Completion (High Priority)
1. Teacher X placeholder lane
- Add placeholder faculty records with explicit type flags and limited permissions.
- Add replacement flow to map placeholder load to real faculty post-hiring.

2. Concurrency + draft approval artifacts
- Bring presence/selection indicators to timetable editing endpoints where not yet complete.
- Add draft PDF export for department-head walkover approval (with run/version watermark).

---

## Proposed Delivery Sequence
1. Tri-Sem + ancillary load contract design and migration plan (architecture-first).
2. Home-room-first generator mode with singleton safeguards.
3. Shift-fence policy hardening per grade/program windows.
4. Teacher X placeholder workflows.
5. Timetable concurrency/presence completion and draft PDF exports.
6. Phase-gated verification pass and evidence-log updates.

## Phase/Gate Notes
- Keep implementation under Phase 4 objective-blocking allowance until Phase 5 kickoff is explicitly updated in docs/plans/phasePlan.md.
- For each batch, log proof in docs/verification/evidence-log.md and map to docs/verification/phase-gates.md checks.

## Immediate Next Refactor Decision Needed
Choose the first execution slice to implement:
- Option 1: Tri-Sem + ancillary-load source-of-truth contracts first.
- Option 2: Home-room-first and shift-fence generator behavior first.
- Option 3: Teacher X + draft PDF workflow first.

Recommendation: Option 1 first, because it stabilizes data authority and calendar semantics before algorithmic and UX refactors.
