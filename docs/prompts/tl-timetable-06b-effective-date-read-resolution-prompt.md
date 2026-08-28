# Prompt 6b: Effective-Date Read Resolution

## Mission

Make published schedule reads revision-aware by effective date.

Prompt 6a created the revision contract. This prompt ensures faculty, public, section, room, and downstream published schedule consumers can resolve the correct schedule for a requested date without destroying historical truth.

## Required Context

Read first:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `.github/copilot-instructions.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/reports/crud-teaching-load-timetable-audit-2026-05-31.md`
- `docs/prompts/teaching-load-timetable-repair-sequence-2026-05-31.md`
- `docs/prompts/tl-timetable-06a-published-revision-data-model-audit-contract-prompt.md`

Apply:

- `atlas-express-api`
- `atlas-mvc-enforcement`
- `atlas-prisma-database`
- `atlas-interservice-http`
- `atlas-offline-realtime-reliability` if cache invalidation or realtime events are touched

Inspect before editing:

- published schedule service methods
- public published schedule endpoints
- faculty published schedule endpoints
- room/section/teacher schedule read paths
- cache helpers for published schedule reads
- revision model/services from Prompt 6a

## Product Decisions

- Historical reads before a revision effective date must return the old published truth.
- Reads on or after the effective date must return the revised truth.
- Public/faculty consumers must not see in-place mutation of old schedules.

## Scope

In scope:

- Date-aware published schedule selection.
- Query parameter or service contract for requested date where needed.
- Faculty/public/section/room read behavior updates.
- Cache key adjustments needed for date/revision correctness.
- Documentation/evidence updates.

Out of scope:

- Timetable revision UI.
- Tactical Dock published commit.
- Notifications.
- Backend pagination unrelated to published reads.

## Mandatory Outcomes

### 1. Date-aware read resolver

Implement a service-layer resolver that selects the correct published truth for:

- no requested date: current active published truth
- date before revision effective date: previous published truth
- date on/after revision effective date: revised published truth

Use explicit service functions rather than duplicating date logic in controllers.

### 2. Public/faculty API contract

Update endpoints only as needed to support date-aware reads.

If adding a query parameter, document it clearly and keep default behavior backward compatible.

### 3. Cache correctness

Any cache involved in published schedule reads must account for:

- revision ID or active revision marker
- effective date or requested date where relevant
- publishedAt/runId if still used

### 4. Historical truth tests

Create or update tests to prove:

- old date returns old teacher/room/slot
- effective/future date returns new teacher/room/slot
- no-date default returns current active truth

## Required Verification And Repair Loop

Run after implementation:

- `npm --prefix atlas-server run build`
- relevant backend tests or targeted API probes
- health probe if route/service loading changes
- at least one historical-date and future-date read check

Self-correction requirement:

- If any read returns the wrong revision, fix in the same session and rerun the failed check once.

## Required Output

Return:

- files changed
- read-resolution contract
- old-date/effective-date/current-date evidence
- cache key changes
- build/test/route results
- evidence-log/source-map updates
- prompt-scope `GO` or `NO-GO`