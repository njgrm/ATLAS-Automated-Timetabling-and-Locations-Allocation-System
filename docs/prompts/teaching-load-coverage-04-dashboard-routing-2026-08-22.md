# Prompt 04 — Dashboard Coverage Routing and Copy

## Role

You are the ATLAS dashboard readiness executor. Implement only this prompt after Prompts 01, 02, and 03 are GO.

## Problem

Dashboard currently says a subject still needs a teacher but sends the operator to a broad Teaching Load page. After Prompts 01-03, Dashboard should route directly to the subject shortage view and use copy that matches the actionable coverage unit.

## Target files

- `atlas-client/src/pages/Dashboard.tsx`
- `atlas-client/src/hooks/useDashboardData.ts`
- Shared coverage-summary helper from Prompt 01
- Focused dashboard tests or UX guardrails as needed

## Out of scope

- Reworking the dashboard layout again.
- Changing campus map, lifecycle, or source chip layout.
- Changing Teaching Load ownership.
- Changing generation or publish behavior.

## Requirements

- Dashboard teacher-coverage readiness shall use Prompt 01 subject-section coverage rows.
- Dashboard shall distinguish:
  - one subject with missing section coverage;
  - multiple subjects with missing section coverage;
  - zero missing coverage;
  - coverage unknown/degraded.
- The next-step body shall use grammatically correct copy:
  - `1 subject still needs teacher coverage before generation.`
  - `N subjects still need teacher coverage before generation.`
- If one subject is missing coverage, Dashboard shall show or route with its subject identity where available.
- The primary CTA shall route to:
  - `/teaching-load?view=subjects&filter=missing-coverage`
  - plus `subjectId=<id>` when there is exactly one missing subject.
- Setup readiness item `Every subject has a teacher` shall link to the same subject shortage route.
- Dashboard shall not claim zero missing teacher coverage while coverage summary is unavailable.
- Source-state/degraded copy shall remain calm and non-banner-heavy.

## UI requirements

- Preserve the current accepted Dashboard layout.
- Do not reintroduce a full-width source banner.
- Do not move Campus Map & Rooms.
- Do not use custom gradients or oversized colored panels.
- Use standard `Card`, `Badge`, `Button`, and `Tooltip` patterns already present.

## Verification

Run:

```bash
cd D:\ATLAS\atlas-client
npx tsc --noEmit
npm run build
npm run test:ux-guardrails
```

Tailnet browser checks:

1. Open Dashboard.
2. Confirm next-step teacher coverage text uses subject-section coverage.
3. Click the primary CTA when teacher coverage is missing.
4. Confirm the destination is Teaching Load `Subjects` mode with missing coverage filter active.
5. Click the setup-readiness row for teacher coverage and confirm the same destination.
6. Confirm no dashboard layout regression on desktop `1366x768`, mobile portrait, and mobile landscape.

## Acceptance criteria

- Dashboard no longer sends users to an ambiguous Teaching Load landing state.
- The CTA reaches the subject shortage view.
- Copy is grammatically correct for singular and plural counts.
- Dashboard remains visually stable.

## Final report required

Report dashboard count source, route URLs generated, command results, Tailnet click-path proof, and any remaining caveats.
