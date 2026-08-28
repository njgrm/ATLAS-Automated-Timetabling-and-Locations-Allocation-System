---
name: atlas-express-api
description: Express API workflow for ATLAS with thin controllers, service-layer logic, versioned routes, error handling, and consistent response envelopes.
user-invocable: true
---

# ATLAS Express API Skill

Use this skill when creating or modifying routes, controllers, middleware, or response contracts.

## MVC Enforcement
- Controllers are transport-only: parse request, call service, format response.
- Business logic lives in /services.
- Data access lives in model/repository layer.

## API Contract Rules
- Version all endpoints under /api/v1/.
- Use explicit REST resources and stable JSON response envelopes.
- Keep public endpoints intentionally public; protect private endpoints by role.

## Required Public Endpoints
- GET /api/v1/subjects
- GET /api/v1/subjects/:id
- GET /api/v1/schools/:schoolId/schedules/published
- GET /api/v1/schools/:schoolId/schedules/published/:termId

## Error Handling
- Use centralized 4-argument Express error middleware.
- Propagate async errors to middleware.
- Return machine-readable error codes for validation/conflict cases.

## Concurrency
- Enforce optimistic locking on schedule edits.
- Return conflict response on stale version updates.
