---
name: atlas-prisma-database
description: PostgreSQL and Prisma modeling, migrations, and query patterns for ATLAS. Use when designing or changing schemas, repositories, constraints, and seed data.
user-invocable: true
---

# ATLAS Prisma Database Skill

Use this skill for all persistence work in ATLAS.

## Rules
- Use Prisma ORM with PostgreSQL as the default data access approach.
- Keep database logic in model/repository layer, never in controllers.
- Follow naming conventions:
  - Models/tables: PascalCase
  - Fields/columns: camelCase
  - Enum names: PascalCase
  - Enum values: UPPER_SNAKE_CASE
- Scope tenant-bound data by school context.

## Required Data Focus
- Support v1 entities: schools, academic terms, rooms, subjects, faculty, sections, assignments, preferences, generated schedules, manual adjustments, lifecycle states, notifications, audit logs.
- Seed MATATAG JHS learning areas plus Homeroom Guidance on first run.

## Migration Procedure
1. Update Prisma schema with minimal, explicit changes.
2. Generate and review migration SQL for safety and determinism.
3. Verify indexes on school/term/section/faculty/state lookup paths.
4. Ensure constraints reflect hard validation rules.
5. Add/update seeds without school-specific hardcoding.

## Query Procedure
1. Prefer Prisma query APIs and transactions for multi-step operations.
2. Prevent N+1 patterns and over-fetching.
3. Include optimistic locking version checks on mutable schedule records.
4. Preserve audit fields and write audit logs for sensitive operations.
