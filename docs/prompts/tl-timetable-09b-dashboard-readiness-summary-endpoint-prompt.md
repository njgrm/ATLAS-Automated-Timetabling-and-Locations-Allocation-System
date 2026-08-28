# Prompt 9b: Dashboard Readiness Summary Endpoint

## Mission

Reduce dashboard waterfall loading by adding a single dashboard/readiness summary endpoint.

This prompt follows UI repair work and query shaping. It should not redesign the dashboard; it creates a faster data contract for existing and near-term dashboard readiness UI.

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

Inspect before editing:

- dashboard page and `useDashboardData` hook
- dashboard-related API calls
- runtime context service
- faculty/section/subject/map/generation summary services
- readiness/audit data services

## Scope

In scope:

- Backend dashboard/readiness summary endpoint.
- Service-layer aggregation.
- Client hook update to use the summary endpoint where safe.
- Fallback behavior if summary endpoint fails.
- Documentation/evidence updates.

Out of scope:

- Full dashboard visual redesign.
- Admin table server pagination.
- Published schedule query shaping unless a helper is shared.

## Mandatory Outcomes

### 1. Add summary endpoint

Expose a versioned endpoint under `/api/v1/...` that returns the dashboard readiness data needed for the first meaningful dashboard view.

Controllers must stay thin; aggregation belongs in services.

### 2. Collapse waterfall paths

Update dashboard loading so it does not depend on many sequential client fetches for first meaningful readiness state.

Where additional detail still needs separate calls, load it after the primary dashboard is usable.

### 3. Preserve source honesty

The summary response must include source/freshness information sufficient for the UI to distinguish:

- verified live
- checking source
- using saved data
- no saved data
- partial/degraded data

### 4. Backward-compatible fallback

If the summary endpoint fails, keep a clear degraded state and recovery action rather than a blank dashboard.

## Required Verification And Repair Loop

Run after implementation:

- `npm --prefix atlas-server run build`
- `npm --prefix atlas-client run build`
- endpoint probe for dashboard summary
- dashboard route smoke
- compare first meaningful dashboard readiness fields before/after

Self-correction requirement:

- If endpoint, client load, build, or fallback behavior fails, fix in the same session and rerun the failed check once.

## Required Output

Return:

- files changed
- endpoint contract summary
- dashboard loading changes
- source-state behavior
- build/probe/browser evidence
- evidence-log/source-map updates
- prompt-scope `GO` or `NO-GO`