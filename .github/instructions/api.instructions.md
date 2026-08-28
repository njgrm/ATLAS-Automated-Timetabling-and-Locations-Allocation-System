---
applyTo: "{**/routes/*,**/controllers/*}"
---

# API Instructions (Express + Node)

## API Boundaries
- Keep routes thin and controllers focused on transport concerns.
- Move business rules into domain/service layer modules.
- Enforce school scoping on every relevant read/write path.
- Keep controllers free of business logic; delegate to `/services` and model/repository layers.
- Version all ATLAS endpoints under `/api/v1/...`.
- Use REST over HTTP for all service-to-service communication.

## Authentication and Authorization
- Authenticate Scheduling Officer and Teacher/Faculty endpoints with local credentials.
- Keep student schedule-view endpoints public and read-only.
- Enforce role-based permissions on lifecycle transitions and admin-only actions.

## Manual QA Login Protocol (Live Tailnet Environment)

- **Primary Environment:** ALL testing, research, and validation MUST target the live Tailnet environment (https://njgrm.buru-degree.ts.net) by default.
- **Tailscale Connectivity:** Ensure your testing tools (e.g., Playwright, curl, scripts) are configured to use the Tailnet hostname or IP (100.88.55.125).
- **Direct QA credentials:**
  1. Admin: admin@deped.edu.ph / Incorrect_404
  2. Faculty: maria.santos@deped.edu.ph / DepEd2026!
- **No Push/Pull Needed:** The local and remote environments are bridged via Tailscale; code changes in the workspace are reflected in the local backend, which is visible to the remote surfaces.

## Lifecycle and Validation Rules
- Reject out-of-order lifecycle transitions.
- Allow best-effort generation with warnings when preferences are missing or soft constraints fail.
- Block publish when hard-constraint violations exist.
- Permit exceptions module operations only for Published schedules.

## Objective-Critical API Delivery Order (2026-05-07)
- Prioritize API implementation work in this order:
  1. Standalone ATLAS auth endpoints/flow support for faculty login (bridge-independent path).
  2. Publish lifecycle APIs and state transition enforcement.
  3. Public published schedule endpoints (`/api/v1/schools/:schoolId/schedules/published*`).
  4. Faculty published schedule retrieval APIs.
  5. Student/public read-only schedule retrieval APIs.
- Avoid opening new timetable-UX-only API changes unless they fix correctness or parity blockers.

## Concurrency Rules
- Implement optimistic locking using version checks.
- Return conflict responses when stale updates are submitted.
- Include machine-readable error codes for conflict handling in clients.

## Error Handling (Context7-aligned Express)
- Use centralized error-handling middleware with the 4-argument signature.
- Propagate async errors to middleware rather than swallowing errors in handlers.
- Return consistent error envelope shape across routes.
- Apply backend changes directly in route/controller/service files; do not generate temporary patch scripts (Python/Node) for code edits.

## Data Access (Context7-aligned node-postgres)
- Use Prisma ORM on PostgreSQL for default data access.
- Keep queries type-safe and parameterized through ORM/query APIs.
- Use explicit transaction scopes for multi-step schedule operations.
- Ensure transaction rollback paths are explicit for generation/publish workflows.

## Integration Endpoints
- Support LIS/HR API ingestion as primary faculty source through an adapter/service interface.
- Provide a realistic stub/seed-based faculty provider in v1 behind the same adapter interface.
- Ensure real endpoint cutover requires no code changes outside the adapter implementation.
- Provide CSV import fallback endpoint with validation and detailed error reporting.
- Trigger push notifications for publish and faculty-impacting schedule changes.

## Public Cross-Service Endpoints
- Expose unauthenticated subject APIs:
	- `GET /api/v1/subjects`
	- `GET /api/v1/subjects/:id`
- Expose unauthenticated published schedule APIs:
	- `GET /api/v1/schools/:schoolId/schedules/published`
	- `GET /api/v1/schools/:schoolId/schedules/published/:termId`
- Never return non-published schedules from published schedule endpoints.

## Observability and Audit
- Emit structured logs for lifecycle transitions, import operations, and publish events.
- Record audit entries for sensitive operations and conflict resolutions.
