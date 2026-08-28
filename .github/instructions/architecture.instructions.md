---
applyTo: "**"
---

# Architecture Instructions (A.T.L.A.S.)

## System Shape
- Use a modular PERN architecture with clear separation between frontend, API, domain services, and persistence.
- Treat school as a first-class boundary in all business flows. All domain records must be scoped by school context.
- Design for multi-school v1 operation without school-specific code branches.

## MVC Enforcement
- Follow strict MVC with a service layer.
- Model: Prisma ORM + PostgreSQL for all persistence and query logic.
- View: React UI for users and JSON responses for API consumers.
- Controller: thin Express controllers responsible only for request parsing, auth checks, validation handoff, and response formatting.
- Business/domain logic must live in `/services`.
- Controllers must never contain scheduling algorithms, cross-entity workflow logic, or direct SQL.
- Data access must be isolated to model/repository code.

## Microservice Isolation
- ATLAS is an isolated microservice in a broader platform.
- Use HTTP REST for all inter-service communication.
- Never share database ownership with other services.
- Version all externally exposed endpoints under `/api/v1/...`.
- Keep service contracts explicit and documented for downstream consumers.

## Domain Priorities
- Model strict lifecycle state transitions: Setup -> Preference Collection -> Generation -> Review -> Published -> Archived.
- Enforce hard constraints as publish blockers; soft constraints as warnings.
- Use best-effort generation when constraints are infeasible, but do not allow publish until hard violations are zero.

## Concurrency and Integrity
- Use optimistic locking for admin schedule edits.
- On version mismatch, return conflict response and require explicit user reload/retry.
- Preserve auditability for schedule creation, manual edits, phase changes, and publish actions.

## PWA-First Requirements
- Architecture must support service-worker-driven offline-first behavior.
- Queue write actions offline and synchronize on reconnect.
- Keep offline schedule cache read-only and limited to previously viewed items in v1.
- Do not introduce native app dependencies.

## Phase-by-Phase Priority Steering (2026-05-07)
- Maintain phase discipline from `phasePlan.md`, but prioritize objective blockers over additional timetable UX refinements.
- Current architecture priority sequence:
  1. Local ATLAS authentication path for faculty users.
  2. PWA/offline foundation (manifest, service worker, caching/sync boundaries).
  3. Publish and dissemination architecture (published lifecycle state + exposure APIs).
  4. Faculty and student published-schedule read architecture.
- Treat non-critical timetable visual polish as backlog until these architecture-critical slices are delivered.

## Integration Boundaries
- Faculty records come from external LIS/HR API with CSV fallback.
- In v1, integration must run through a swappable adapter that supports stubbed faculty responses and future real service cutover.
- Push notifications are required for publish and faculty-impacting schedule changes.
- Email, SMS, analytics, automated backups, and monitoring platform integrations are out of scope for v1.

## Manual QA Login Protocol (Live Tailnet Environment)

- **Primary Environment:** ALL testing, research, and validation MUST target the live Tailnet environment (https://njgrm.buru-degree.ts.net) by default.
- **Tailscale Connectivity:** Ensure your testing tools (e.g., Playwright, curl, scripts) are configured to use the Tailnet hostname or IP (100.88.55.125).
- **Direct QA credentials:**
  1. Admin: admin@deped.edu.ph / Incorrect_404
  2. Faculty: maria.santos@deped.edu.ph / DepEd2026!
- **No Push/Pull Needed:** The local and remote environments are bridged via Tailscale; code changes in the workspace are reflected in the local backend, which is visible to the remote surfaces.

## Cross-Service Public Data
- Expose ATLAS-owned subjects as public REST resources for other services.
- Expose only published schedules via public endpoints; never expose draft/review schedules publicly.

## Campus Map Feature Architecture
- Implement two map modes: Editor (Scheduling Officer only) and View (Faculty + Public, read-only).
- Persist map data per school with `campus_image_url` and `buildings` JSON scoped by `school_id`.
- Building JSON shape contract: `[{ id, name, x, y, width, height, color, rooms: [...] }]`.
- In Editor mode, allow image upload, rectangle drawing, building labeling, and room management through a side panel workflow.
- In View mode, render map overlays for published schedules by current time slot as navigation context only.
- Never allow scheduling drag-and-drop edits inside map view mode.
- Use adapter/service boundaries so map retrieval and schedule overlay composition stay out of controllers.

## Performance Targets
- Design generation workflow and data access for sub-60-second schedule generation per single-school dataset.
- Avoid unnecessary cross-school queries; favor scoped query paths and indexed filtering keys.

## Documentation and Traceability
- Map major behaviors to testable requirements and acceptance criteria.
- Keep implementation details out of requirements docs; keep behavior in EARS syntax when writing PRDs.
- For implementation work, edit repository files directly; do not introduce helper script files (Python/Node) solely to apply text replacements.

## Frontend Maintainability Guardrail
- File Size & Component Extraction Rule (MANDATORY): No single React component file shall exceed 1000 lines of code. If a component file approaches this limit, stop feature development and immediately extract logical sub-components (for example: sidebars, modals, forms, grids) into a nearby `components/` subdirectory before continuing.
