# A.T.L.A.S. Copilot Instructions

## Authority And Startup Contract
- Treat `AGENTS.md` as the canonical repository instruction file for cross-agent behavior in this workspace.
- If guidance conflicts, use this order:
  1. `AGENTS.md`
  2. `phasePlan.md`
  3. `ATLAS_AGENT_KI.md`
  4. `docs/reference/atlas-runtime-source-of-truth-map.md`
  5. this file
- Before any non-trivial planning, implementation, QA, or prompt drafting, read:
  1. `ATLAS_AGENT_KI.md`
  2. `phasePlan.md`
  3. `docs/reference/atlas-runtime-source-of-truth-map.md`
  4. `docs/phases/README.md`
- Current active stream remains the Phase 3 generator-readiness work tracked in `phasePlan.md`.

## Project Direction
- Build A.T.L.A.S. as a mobile-responsive Progressive Web App (PWA) on PERN (PostgreSQL, Express, React, Node.js).
- Do not design or scaffold a native mobile app (no React Native, no Expo).
- Keep the system school-agnostic and configurable. Never hardcode school-specific logic.
- Support multiple schools in v1, including pilot schools, through data/configuration.

## UX Identity Direction
- ATLAS should feel like a SMART-family scheduling portal, not an EnrollPro back-office extension.
- SMART alignment means token architecture, light slate/white surfaces, rounded active navigation, task-first cards, role-specific portals, and plain school-facing copy.
- Do not hardcode SMART's default emerald palette for ATLAS brand identity. Use configured school tokens (`--primary`, `--accent`, `--sidebar-primary`) from EnrollPro/HNHS where available; on Tailnet HNHS the primary brand renders maroon.
- Use emerald only for universal success/correctness states such as ready, done, active school year, and zero blockers.
- Keep sidebar navigation chronological and compact. Do not expose locked/disabled future modules in the primary sidebar.
- Admin preference collection, room requests, and scheduling exceptions should be surfaced inside the Timetable workflow unless a standalone route is explicitly justified.
- Campus/map surfaces must be simple, presentable, and nontechnical by default: dashboard gets a clean map/readiness preview, `/map` defaults to overview, and editor controls stay grouped by task.

## MVC And Layering Rules
- Enforce strict MVC architecture.
- Model layer: Prisma ORM on PostgreSQL.
- View layer: React UI and JSON API representations.
- Controller layer: Express controllers that are thin and transport-focused only.
- Business logic must live in `/services`.
- Data access must live in model/repository layer, not controllers.

## Database And Naming Rules (Prisma)
- Use Prisma as the default ORM for this project.
- Model/table names: PascalCase (for example, `User`, `AcademicYear`, `Applicant`).
- Field/column names: camelCase (for example, `firstName`, `trackingNumber`).
- Enum names: PascalCase (for example, `ApplicationStatus`).
- Enum values: UPPER_SNAKE_CASE (for example, `UNDER_REVIEW`, `APPROVED`).

## Microservice Boundaries
- Treat ATLAS as one isolated microservice in a larger multi-app architecture.
- Expose REST APIs for other services and consume external services via HTTP REST only.
- Never share a database with another service.
- Version all exposed endpoints under `/api/v1/...`.
- Document exposed endpoints clearly for downstream service teams.

## Product Roles and Access
- Authenticated roles in v1: Scheduler Officer, Teacher/Faculty, and IT Admin.
- Students are unauthenticated public viewers of section schedules.
- Faculty auth is local username/password provisioned from imported faculty records.
- No SSO dependency in v1.
- Role clarity:
  - **Scheduler Officer**: primary timetabling operator (creates/reviews/publishes schedules).
  - **IT Admin**: account/platform administrator; can access scheduler capabilities for verification/testing, but is not the day-to-day scheduling operator.
  - **Teacher/Faculty**: submits preferences and views personal schedules.

## Manual QA Login (Direct ATLAS)
- Use direct ATLAS authentication as the primary QA entry path for protected pages in this phase.
- Start ATLAS locally (`npm run dev`) and login directly on ATLAS with one of these accounts:
  - Admin: `1000001` / `AdminSY2026!`
  - Faculty: `2000056` / `DepEd2026!` (real EnrollPro teacher record; legacy `maria.santos@deped.edu.ph` is deprecated)
- Bridge-auth from EnrollPro is optional for legacy integration checks and is not required baseline evidence for protected-route QA in this pass.

## Office Files MCP Ingestion (Word/Excel/PDF)
- When stakeholder office documents exist in `office-files/`, run an ingestion pass before output/UI polishing.
- Target MCP servers:
  - `word-document-server` for `.docx`
  - `excel` for `.xlsx`
  - `pdf-reader` for `.pdf`
- Required extraction output:
  - data structure quantities (pages, sheets, tables, rows/cols, blocks)
  - format/layout signals (headings, section patterns, embedded images)
- Preserve privacy by using placeholder names in downstream artifacts while keeping real quantities and format structure.
- If a server fails startup or tool execution, capture the error and continue using fallback extraction; do not skip the analysis phase.

## Schedule Lifecycle Rules
- Enforce strict phase order: Setup -> Preference Collection -> Generation -> Review -> Published.
- Allow Archived only as terminal state for past terms.
- Block out-of-order phase actions.
- Exceptions module actions (absence handling, substitutes, room changes) are allowed only while Published.

## Core V1 Acceptance Constraints
- Published schedules must have zero hard-constraint violations.
- Schedule generation target: under 60 seconds per single-school dataset.
- All 8 JHS learning areas plus Homeroom Guidance must meet minimum weekly minutes per DO 010 s.2024.
- Push notifications are required for faculty on publish and on schedule changes that affect them.
- Public student schedule pages must load offline if previously visited.

## Offline-First Behavior
- App shell must load from local browser storage/service worker cache when available.
- Queue offline actions and sync automatically when connectivity returns.
- If queued sync fails server validation, surface a clear error and require resubmission.
- Schedule generation and receiving published updates require active connection.
- Offline read-only cache scope in v1 is limited to previously viewed schedules per device.

## Data Ingestion
- Primary source for faculty data: external LIS/HR API.
- Required fallback: CSV upload when API is unavailable.
- No legacy migration scope in v1.
- For v1 development, implement a realistic simulated faculty service (stub/seed response) behind a swappable adapter.
- Keep integration code real and isolated so switching from stub to real endpoint requires no changes outside the adapter.

## Public Cross-Service Endpoints
- Expose public subject APIs:
	- `GET /api/v1/subjects`
	- `GET /api/v1/subjects/:id`
- Expose public published schedule APIs:
	- `GET /api/v1/schools/:schoolId/schedules/published`
	- `GET /api/v1/schools/:schoolId/schedules/published/:termId`
- Return only `Published` schedules from published schedule endpoints.

## Skills Usage
- Store project skills in `.github/skills/<skill-name>/SKILL.md`.
- Use skills as reusable workflows for database, API, frontend, PWA, algorithm, MVC, and inter-service concerns.
- For frontend prompts, always apply the project 21st Dev UI/UX skill.
- For any prompt touching faculty pages (`/my/*`, `FacultyPreferences`, `FacultyRoomPreferences`, `MyDashboard`, or `AppShell` faculty logic), **always** also apply `atlas-mobile-faculty-ux` skill before generating any code.
- For non-trivial UI prompts, also apply:
  - `atlas-design-system-enforcer`
  - `atlas-ux-audit-gate`
  - `atlas-copy-and-microcopy`
- For faculty usability-sensitive prompts, also apply:
  - `atlas-faculty-usability-first`
- For manual QA passes, also apply:
  - `atlas-shared-browser-qa`
- For offline/realtime behavior changes, also apply:
  - `atlas-offline-realtime-reliability`
- For phase completion claims, also apply:
  - `atlas-phase-gate-enforcer`
- For scheduler algorithm evaluation/refactor tasks, also apply:
  - `atlas-algorithm-benchmark-gate`
- For all UX/UI redesign work, prompts, or acceptance checks, always reference:
  - `docs/DESIGN.md`
  - `docs/DESIGN-INSPIRATION.md`
  - `docs/phases/faculty-mobile-wireframe-spec.md` (faculty flows)
- For faculty UX **expert hardening** and strict gates, use:
  - `docs/prompts/faculty-ux-expert-hardening-pass.md`
  - `docs/prompts/faculty-ux-gate-closure-prompt.md`
  - Playwright faculty matrix: `npm run test:visual:faculty` (see `qa-artifacts/playwright/README.md`)

## Manual shared-browser QA (UX)
- Before manual QA on UX-critical pages, read `docs/DESIGN.md`, `docs/DESIGN-INSPIRATION.md`, and `docs/context7-library-map.md`.
- Use Context7 during QA when validating Radix/shadcn patterns, motion, or accessibility behavior.

## Engineering Rules
- Use Context7 to verify up-to-date library behavior before introducing non-trivial patterns.
- Context7 preflight is mandatory for non-trivial UI/realtime/offline/accessibility work:
  - resolve library IDs,
  - pull 2-3 doc references,
  - cite applied pattern in output prompts.
- Approved library map: `docs/context7-library-map.md`.
- Follow Express best practices for async error propagation and centralized error middleware.
- Use parameterized SQL queries and connection pooling patterns for PostgreSQL access.
- Keep requirements artifacts in EARS format when writing PRD/requirements content.
- Edit source files directly in-place. Do not generate temporary Python/Node/shell "apply" scripts to rewrite code.
- If a scripted migration/refactor is truly necessary, ask for explicit user approval first and delete the helper script immediately after use.
- File Size & Component Extraction Rule (MANDATORY): No single React component file shall exceed 1000 lines of code. If a file approaches this limit, implementation must pause feature work and immediately extract logical sub-components (for example: sidebars, modals, forms, grids) into a `components/` subdirectory.

## Mandatory Planning Context (Copilot)
- Before proposing or implementing any non-trivial change, read these files in order:
  1. `ATLAS_AGENT_KI.md`
  2. `phasePlan.md`
  3. `docs/reference/atlas-runtime-source-of-truth-map.md`
  4. `docs/phases/README.md`
  5. `docs/DESIGN.md`
  6. `docs/DESIGN-INSPIRATION.md`
  7. Active phase file under `docs/phases/` (for example `docs/phases/phase-3-execution.md`)
  8. `docs/verification/phase-gates.md`
  9. `docs/verification/evidence-log.md`
- If phase status in `phasePlan.md` conflicts with detailed phase docs, stop and ask for clarification.
- Do not mark phase work complete without updating the relevant phase file and adding verification evidence.
- Keep implementation scoped to the active phase unless the user explicitly approves cross-phase work.

## Runtime Source-of-Truth Maintenance
- Treat `docs/reference/atlas-runtime-source-of-truth-map.md` as the living page/data ownership map.
- When a change affects page dependencies, persistence behavior, EnrollPro ownership, fallback behavior, or generator-readiness assumptions, update that file in the same pass.
- Do not leave runtime-sensitive code or prompt changes undocumented if they alter which system owns a page's data or whether a page is reading persisted versus synthesized state.

## Copilot Prompt Execution Discipline
- Treat repository prompt files in `docs/prompts/` as the primary execution contract for non-trivial work.
- Prefer a new chat/thread for each prompt file execution.
- Reuse the same chat only for a direct repair loop on that same prompt.
- If Auto model selection consistently routes a current phase stream to a stronger-performing model in an existing focused chat, it is acceptable to keep using that same chat for the rest of that one phase stream instead of restarting every prompt.
- Do not carry one long compacted chat across multiple prompt files or subsystem changes.
- Keep responses during execution concise and action-biased:
  - at most one short execution preamble
  - no repeated narration of probe reruns or obvious next actions
  - if a probe is noisy, narrow it silently and continue
- Use English only in prompt outputs unless the file being edited already requires another language.
- Prefer ASCII-only output unless the destination file already uses Unicode characters intentionally.
- Do not emit internal tool/protocol text, chain-of-thought markers, or raw control strings in user-facing output.

## Prompt Scope vs Phase Closure
- A successful prompt execution does not automatically mean the overall phase is complete.
- Distinguish:
  - prompt-scope `GO`
  - phase-gate `GO`
- Only recommend phase closure when the relevant gates in `phasePlan.md` and `docs/verification/phase-gates.md` are satisfied with matching evidence.

## Live Verification Discipline
- When a prompt requires Tailnet QA, local build/typecheck success is insufficient for `GO`.
- Use live verification loops for runtime-sensitive work:
  - audit live state
  - implement the minimum coherent fix
  - rerun local verification
  - rerun live verification
  - self-correct one more time if a local/runtime mismatch remains
- If a runtime contradiction remains after the bounded repair loop, return `NO-GO` with explicit blockers.

## Current Active Stream
- Current active stream is Phase 3 generator readiness:
  - template-capacity math
  - persisted policy / room readiness
  - MATATAG TLE contract reset
  - Teacher X redesign and subject coverage
  - KPI rerun and root-cause gate
- Phase 2 prompt closures are prerequisites, not the current phase-closure target.

## Priority Realignment (2026-05-07)
- Execute phase-by-phase, but prioritize objective-critical gaps over non-critical timetable UX polish.
- Delivery order:
  1. Standalone faculty authentication
  2. PWA/offline-first baseline
  3. Generated-view parity blockers only
  4. Publish lifecycle + published APIs
  5. Faculty published schedule view (`/my/schedule`)
  6. Student/public published schedule views
- Defer cosmetic timetable enhancements that are not direct blockers to objective acceptance.
