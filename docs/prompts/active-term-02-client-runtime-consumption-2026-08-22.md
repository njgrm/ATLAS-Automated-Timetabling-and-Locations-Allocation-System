# Active Term Prompt 02 — Client Runtime Consumption

## Role

You are the ATLAS frontend/runtime executor. Wire the active-term runtime context into client session initialization and critical modules without exposing the EnrollPro integration key to the browser.

## Problem

`ACTIVE-TERM-INTEGRATION.md` requires dependent systems to pull active-term state when a user session initializes and when critical modules load. ATLAS should satisfy that mandate through its own `/api/v1/runtime/context` endpoint, not by letting the frontend call EnrollPro directly.

## Target files

- `atlas-client/src/components/AppShell.tsx`
- `atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts`
- `atlas-client/src/pages/TeachingLoad.tsx`
- `atlas-client/src/pages/Dashboard.tsx`
- `atlas-client/src/lib/api.ts`
- `atlas-client/src/types.ts`
- Add or update a runtime-context hook if present:
  - `atlas-client/src/hooks/useRuntimeContext.ts`

## Requirements

### Functional requirements

- When an authenticated ATLAS session initializes, the client shall request ATLAS runtime context with upstream verification when allowed by existing auth flow.
- When a critical module loads, the client shall consume the latest ATLAS runtime context instead of calling EnrollPro directly.
- When runtime context includes active term, the client shall store normalized `activeTerm` and `termIndex` in shared page state.
- If active-term verification is unavailable, then the client shall show saved-context behavior without blocking the page.
- The client shall never read, store, or transmit `ENROLLPRO_SERVICE_TOKEN`.

### Critical modules

- Dashboard
- Timetable review
- Teaching Load
- Published schedule/admin readiness surfaces where present

### UI constraints

- Keep global no-scroll architecture intact.
- Use existing shadcn/ui primitives for alerts, badges, tooltips, and controls.
- Do not add a large hero, marketing panel, or decorative card.
- Use compact inline indicators such as `Active Term: T1` near existing runtime/source-truth UI.

## Implementation guidance

- Prefer one shared runtime context hook with refresh/revalidate behavior.
- Preserve existing source-truth warnings.
- Avoid duplicating EnrollPro status logic in every page.
- Do not block first paint on active-term verification if saved runtime context is available.

## Verification

Run:

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
```

Live Tailnet probe:

1. Login as Admin.
2. Open Dashboard.
3. Open Timetable.
4. Open Teaching Load.
5. Confirm active term is visible or available in page state.
6. Confirm no browser request goes directly to EnrollPro `/active-term`.

## Acceptance criteria

- App session initialization pulls active term through ATLAS runtime context.
- Critical modules use shared active-term state.
- Browser network logs contain no EnrollPro integration-key request.
- Pages still load when active-term verification is unavailable.
- No global scrollbars or oversized source banners are introduced.

## Final report required

Report which pages consume active term, where the UI displays it, and browser evidence proving the EnrollPro key stayed server-side.
