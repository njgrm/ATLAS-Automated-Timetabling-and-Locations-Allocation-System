---
name: atlas-mvc-enforcement
description: Enforces strict MVC and service-layer boundaries across ATLAS. Use whenever implementing or reviewing architecture, modules, and file placement.
user-invocable: false
---

# ATLAS MVC Enforcement Skill

Apply this skill automatically for architecture-sensitive work.

## Boundary Rules
- Model: Prisma/PostgreSQL data models and repositories.
- View: React UI and API JSON representations.
- Controller: Thin Express request/response handlers.
- Service: Business workflows, scheduling logic, lifecycle orchestration.

## Hard Prohibitions
- Controllers must not include scheduling algorithms.
- Controllers must not include cross-entity business rules.
- Controllers must not perform direct SQL.

## Review Checklist
1. Does controller delegate logic to service?
2. Does service call repository/model layer?
3. Is data access isolated from transport layer?
4. Are state transitions enforced in services?
