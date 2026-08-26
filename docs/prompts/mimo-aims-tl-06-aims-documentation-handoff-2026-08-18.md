# Mimo Prompt 06 — AIMS Documentation Handoff

## Role

You are the ATLAS documentation executor. Update the AIMS guide so AIMS devs know exactly which endpoints are stable, which ones are draft/internal, and how to handle current vs historical school years.

Do not begin this prompt until Prompt 05 receives Codex QA `GO`.

## Target file

- `docs/guides/AIMS_FETCH_PUBLISHED_SCHEDULES_GUIDE.md`
- Optionally update:
  - `docs/reference/atlas-smart-rollover-api-endpoints-2026-08-07.md`

## Required documentation decisions

### AIMS may consume

- Current active-year published schedule:

```http
GET /api/v1/schools/:schoolId/schedules/published
```

- Explicit school-year published schedule:

```http
GET /api/v1/schools/:schoolId/school-years/:schoolYearId/schedules/published
```

- Explicit section/faculty/room schedule routes under the school-year namespace.
- Explicit term routes only if Prompt 04 implemented reliable term filtering.

### AIMS must not consume as final truth

```http
POST /api/v1/faculty-assignments/suggestion-proposals
POST /api/v1/faculty-assignments/suggestion-proposals/:proposalId/apply
POST /api/v1/faculty-assignments/auto-fill
GET /api/v1/faculty-assignments/summary
GET /api/v1/generation/:schoolId/:schoolYearId/runs/latest/timetable
```

Explain that those are internal/scheduler workflow endpoints, not AIMS final-sync endpoints.

## Requirements

### Functional documentation requirements

- The guide shall state that Teaching Load suggestions are proposal data until applied by an officer.
- The guide shall state that AIMS final truth is published schedule data only.
- The guide shall state that default current endpoint cannot return historical schedules.
- The guide shall state that historical schedules require explicit school-year routes.
- The guide shall define `faculty.atlasId` and `faculty.externalId`.
- The guide shall instruct AIMS to use `faculty.externalId` for EnrollPro-compatible matching.
- The guide shall define placeholder faculty behavior.
- The guide shall document expected 404 responses for no current published schedule.
- The guide shall document setup/generation prerequisites in plain terms.

## Verification

Run:

```bash
cd D:\ATLAS
rg -n "suggestion-proposals|auto-fill|runs/latest/timetable|school-years/.*/schedules/published|CURRENT_PUBLISHED_RUN_NOT_FOUND|faculty.externalId|faculty.atlasId" docs/guides/AIMS_FETCH_PUBLISHED_SCHEDULES_GUIDE.md docs/reference/atlas-smart-rollover-api-endpoints-2026-08-07.md
```

Then run normal gates if any source code was touched:

```bash
cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build

cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
npm run test:timetable-conflict
```

## Acceptance criteria

- AIMS dev can identify the correct endpoint in under one minute from the guide.
- AIMS dev is explicitly warned not to treat proposals or Teaching Load summaries as published schedule truth.
- The guide explains how to distinguish active current schedules from historical schedules.
- The guide explains which ID fields are safe for cross-system matching.
