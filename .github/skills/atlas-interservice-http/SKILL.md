---
name: atlas-interservice-http
description: Inter-service API contract and adapter patterns for ATLAS microservice boundaries. Use for outbound/inbound service integrations and public contract design.
user-invocable: true
---

# ATLAS Inter-Service HTTP Skill

Use this skill for service integration and exposed API contracts.

## Boundary Rules
- All inter-service communication is HTTP REST.
- No shared database with external services.
- All exposed endpoints must be versioned under /api/v1/.

## Faculty Integration Pattern
- Implement a swappable adapter interface for faculty provider integration.
- Provide a realistic stub/seed provider in v1.
- Keep real LIS/HR integration behind same interface.
- Ensure cutover needs no code changes outside adapter wiring.
- Keep CSV import as fallback provider path.

## Public Contract Requirements
- Subjects and published schedules are public resources for downstream consumers.
- Published schedule endpoints must never expose draft/review data.
- Document request/response schemas and error envelopes clearly.
