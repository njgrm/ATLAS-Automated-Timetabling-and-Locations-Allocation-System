# Prompt 6a: Published Revision Data Model And Audit Contract

## Mission

Create the backend contract for published schedule revisions with effective dates.

This prompt must not build the full timetable revision UI. It establishes the persistence and audit foundation that later prompts will read and use.

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
- `atlas-interservice-http` if public/published contracts are touched

Inspect before editing:

- Prisma schema and migrations
- published schedule services/controllers
- generation run publish metadata
- manual edit/audit services
- public/faculty published schedule endpoints
- existing audit log patterns

## Product Decisions

- Mid-semester published changes create a new published revision with an effective date.
- Do not edit the current published schedule in place.
- Record actor, reason, changed entries, previous owner, new owner, and effective date.
- Historical schedule truth must remain queryable.

## Scope

In scope:

- Data model or existing-model extension for published revisions.
- Service-layer contract for creating a revision draft or revision record.
- Audit record contract.
- API surface only if needed to support later prompts.
- Migration and generated Prisma client updates where required.
- Documentation updates.

Out of scope:

- Timetable UI workflow.
- Effective-date read selection for consumers. That is Prompt 6b.
- Tactical Dock commit UI. That is Prompt 6c.
- Notifications.

## Mandatory Outcomes

### 1. Revision persistence model

Represent published revisions with at least:

- school ID
- school year ID
- source published run/revision
- effective date
- actor/user ID where available
- reason
- changed entry set or change summary
- previous teacher/room/slot values where relevant
- new teacher/room/slot values where relevant
- created/updated timestamps

Use Prisma naming conventions from project instructions.

### 2. Revision creation service contract

Implement service-layer functions that can:

- create a revision record/draft from a published schedule repair intent
- reject missing effective date
- reject same-day/incoherent effective date where business rules require it
- preserve existing published truth until Prompt 6b resolves date-aware reads

Controllers must remain thin.

### 3. Audit trail contract

Revision creation must write or expose audit details sufficient to answer:

- who changed it
- what changed
- when it takes effect
- why it changed
- what published truth it supersedes after the effective date

### 4. No digital approval scope creep

If a revision includes above-standard load, store only the schedule revision facts. Do not create overload approval tables or approval states.

## Required Verification And Repair Loop

Run after implementation:

- `npm --prefix atlas-server run build`
- Prisma generate/migration checks required by the repo workflow
- targeted service/API tests for revision creation and missing effective-date rejection
- server startup or health probe if route loading changes

Self-correction requirement:

- If migration, build, route loading, or revision creation checks fail, fix in the same session and rerun the failed check once.

## Required Output

Return:

- files changed
- schema/service/API contract summary
- migration status
- audit contract summary
- build/test/health results
- evidence-log/source-map updates
- prompt-scope `GO` or `NO-GO`