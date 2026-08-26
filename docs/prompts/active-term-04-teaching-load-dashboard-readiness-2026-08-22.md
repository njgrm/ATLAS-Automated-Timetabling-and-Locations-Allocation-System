# Active Term Prompt 04 — Teaching Load and Dashboard Readiness

## Role

You are the ATLAS Teaching Load and dashboard executor. Use active term to make current-term workload and readiness easier to see without changing canonical Teaching Load ownership.

## Problem

Teaching Load already has term-aware rotational metadata, but officers still have to infer which term matters right now. Dashboard readiness also reports broad school-year state without active-term focus.

## Target files

- `atlas-client/src/pages/TeachingLoad.tsx`
- `atlas-client/src/components/faculty-assignments/WorkspaceToolbar.tsx`
- `atlas-client/src/components/faculty-assignments/WorkloadInspector.tsx`
- `atlas-client/src/components/faculty-assignments/StaffingAuditSheet.tsx`
- `atlas-client/src/pages/Dashboard.tsx`
- `atlas-client/src/components/dashboard/CampusReadinessCard.tsx`
- Server readiness services only if current-term metrics require backend support

## Requirements

### Functional requirements

- When active term is available, Teaching Load shall show current-term rotational load before future-term details.
- When active term is available, Teaching Load shall identify current-term overloads separately from full-year overloads.
- When active term is available, dashboard readiness shall indicate whether the current term has a published schedule.
- When active term is available, dashboard readiness shall indicate whether the current term has unassigned sessions or hard violations when that data is available.
- If active term is unavailable, then Teaching Load and dashboard shall keep existing school-year readiness behavior.
- The system shall not create, delete, or modify Teaching Load ownership solely because active term changes.

### UI requirements

- Use compact inline stat banners and badges.
- Do not add large metric cards.
- Keep current no-scroll page contracts.
- Use tooltips for current-term metrics whose meaning is not obvious.

## Implementation guidance

- Reuse existing `rotationTermBreakdown` and `rotationFamilyLoadDetails`.
- Avoid recalculating canonical Teaching Load in the browser.
- If a backend summary addition is needed, keep it additive and backward compatible.
- Display active-term context as current focus, not as the only source of truth.

## Verification

Run:

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails

cd D:\ATLAS\atlas-server
npx tsc --noEmit
npm run build
```

Live Tailnet probe:

1. Resolve active term from `/api/v1/runtime/context?schoolId=1&verifyUpstream=true`.
2. Open Dashboard.
3. Open Teaching Load.
4. Confirm current-term badges and current-term readiness use the active term.
5. Confirm full-year details remain accessible.

## Acceptance criteria

- Teaching Load surfaces current-term load without hiding full-year context.
- Dashboard shows active-term readiness without replacing school-year readiness.
- Active-term unavailable state is clear and non-blocking.
- No Teaching Load ownership rows are changed by this prompt.
- Client and server builds pass.

## Final report required

Report current-term Teaching Load display, dashboard readiness display, and confirmation that canonical Teaching Load data was not modified by active-term refresh.
