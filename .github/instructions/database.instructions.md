---
applyTo: "{**/*.sql,migrations/**}"
---

# Database Instructions (Prisma + PostgreSQL)

## ORM And Ownership
- Use Prisma as the primary ORM for all ATLAS data access.
- Keep persistence logic in model/repository layer only.
- Controllers must not perform raw SQL or direct persistence operations.

## Naming Conventions
- Model/table names: PascalCase.
- Field/column names: camelCase.
- Enum names: PascalCase.
- Enum values: UPPER_SNAKE_CASE.

## Multi-School Data Modeling
- Include school scoping in all tenant-bound tables.
- Enforce referential integrity with explicit foreign keys.
- Prevent school data leakage by ensuring joins and filters are school-scoped.

## Required V1 Entities
- Define schemas for: schools, academic_terms (4-quarter annual model), rooms, subjects, faculty, sections, faculty_subject_assignments, faculty_preferences, generated_schedules, manual_schedule_adjustments, schedule_lifecycle_states, push_notification_records, audit_logs.
- Seed subjects for the 8 MATATAG JHS learning areas plus Homeroom Guidance on first run.

## Constraint Strategy
- Encode hard constraints with strong validations where feasible (uniqueness, non-overlap, required ranges, integrity checks).
- Represent soft constraints as preference metadata and scoring inputs, not hard blockers.
- Include version columns for optimistic locking on mutable scheduling records.

## Query Safety and Performance
- Use ORM-generated parameterized queries by default.
- Use connection pooling patterns for application access.
- Add indexes for high-frequency filters: school_id, term_id, section_id, faculty_id, lifecycle_state, and schedule lookup keys.
- Avoid N+1 query patterns in schedule retrieval paths.

## Migrations and Idempotence
- Keep migrations forward-only and deterministic.
- Use transactional migrations where supported.
- Add rollback notes for destructive operations.
- Include seed structures that are school-agnostic.

## Data Import Rules
- Support LIS/HR API ingestion and CSV fallback mapping to the same canonical faculty model.
- Store import source metadata and timestamp for traceability.
- Validate duplicate faculty identity records before credential provisioning.

## Auditing and Compliance
- Record who changed what and when for schedule edits and lifecycle transitions.
- Preserve immutable audit trails for publish events and hard-constraint resolution actions.

## Objective-Critical Database Priority (2026-05-07)
- Prioritize schema and migration work for:
  1. Standalone ATLAS authentication support for faculty credentials/session handling.
  2. Publish lifecycle state persistence and published-run references.
  3. Read models for faculty published schedules and student/public published schedules.
  4. Offline queue/sync bookkeeping tables for PWA write reconciliation.
- Defer non-critical timetable UX-driven schema changes unless required for correctness blockers.
