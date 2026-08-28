# Prompt 9a: Published Schedule Query Shaping

## Mission

Replace full-payload published schedule filtering with targeted service queries for faculty, room, and section reads.

This is the first performance follow-up. Keep it focused on published schedule query shape only.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `.github/copilot-instructions.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/reports/crud-teaching-load-timetable-audit-2026-05-31.md`
- `docs/prompts/teaching-load-timetable-repair-sequence-2026-05-31.md`

Apply:

- `atlas-express-api`
- `atlas-mvc-enforcement`
- `atlas-prisma-database`
- `atlas-interservice-http`

Inspect before editing:

- `atlas-server/src/services/published-schedule.service.ts`
- published schedule controllers/routes
- public faculty/section/room schedule endpoints
- latest-run/timetable read paths if shared
- tests around published schedule reads

## Scope

In scope:

- Filtered service queries for faculty schedules.
- Filtered service queries for room schedules.
- Filtered service queries for section schedules.
- Performance-safe candidate selection.
- Tests/probes comparing old expected results to new filtered reads.

Out of scope:

- Dashboard summary endpoint.
- Server pagination for admin tables.
- UI redesign.
- Revision effective-date logic unless already required by current contracts.

## Mandatory Outcomes

### 1. Avoid full-payload filtering for targeted reads

Do not load every published schedule entry and filter afterward when the route asks for one faculty, room, or section view.

Prefer service-layer queries or lightweight row selection that retrieves only the needed slice.

### 2. Preserve public contract

Response shape must remain compatible unless the existing docs explicitly permit an additive field.

### 3. Keep latest-run memory guardrails

Do not introduce whole-array cloning/remapping of large JSON payloads on hot read paths unless strictly required.

### 4. Prove equivalence

For at least one faculty, room, and section read:

- verify the filtered query returns the same meaningful schedule rows as the previous behavior
- verify missing/empty cases still return clear empty states

## Required Verification And Repair Loop

Run after implementation:

- `npm --prefix atlas-server run build`
- backend tests or targeted API probes for faculty/room/section reads
- `/api/v1/health` or server startup verification if route loading changed
- timing or payload-size comparison where feasible

Self-correction requirement:

- If any targeted read changes behavior unexpectedly, fix in the same session and rerun the failing probe once.

## Required Output

Return:

- files changed
- query-shape summary
- faculty/room/section equivalence evidence
- timing/payload notes
- build/health results
- evidence-log/source-map updates
- prompt-scope `GO` or `NO-GO`