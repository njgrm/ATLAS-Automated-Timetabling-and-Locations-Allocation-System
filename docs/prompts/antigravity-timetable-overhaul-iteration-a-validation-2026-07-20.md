# Antigravity Validation Prompt - Timetable Overhaul Iteration A

## Target

Validate ATLAS Timetable Simplification Overhaul Iteration A on the live Tailnet environment.

- URL: `https://njgrm.buru-degree.ts.net`
- Login: Admin `1000001` / `AdminSY2026!`
- Use browser Playwright interaction, not only API probes.

## Iteration A Scope

Iteration A groups:

- Phase 0A: Runtime source-truth reconciliation visibility.
- Phase 0: Real workflow contract gates.
- Phase 1/2 starter corrections that remove false UI claims:
  - generated unassigned items missing room source must not say `Place session`;
  - generated occupied-slot swap must use `Swap sessions`, not `Apply repair`.

Do not validate later compact-header or full-shell simplification as complete yet. Those are Iteration C.

## Expected Behaviors

### 1. Runtime/source truth must be visible

1. Log in as Admin.
2. Navigate to `/timetable`.
3. Verify a visible source-truth notice appears when ATLAS is using saved/stale data or when the selected latest draft is backed by a completed run behind newer failed runs.
4. Confirm the notice includes:
   - active school year number,
   - visible run number,
   - plain-language source label such as `Using saved ATLAS data`,
   - if applicable, a note that the grid uses completed run `#223` while newer failed runs exist.

### 2. API source evidence must match visible UI

Using authenticated API requests, capture:

- `GET /api/v1/runtime/context?schoolId=1`
- `GET /api/v1/generation/1/{activeSchoolYearId}/runs?limit=5`
- `GET /api/v1/generation/1/{activeSchoolYearId}/runs/latest/draft`

Report:

- active school year,
- runtime source,
- stale flag,
- upstream reachable/verified flags,
- newest run ID/status,
- latest completed draft run ID,
- assigned entry count,
- unassigned item count,
- unassigned items with faculty,
- unassigned items with home room.

### 3. Missing-room generated unassigned items must not claim they can be placed

1. Open `/timetable`.
2. Click `Place unassigned`.
3. Expand the first generated unassigned item that has a faculty owner but no `homeRoomId`.
4. Confirm the card shows `Needs room`.
5. Confirm the visible action says `Fix room first`.
6. Confirm no visible action in that missing-room card says `Place session`.

This is a hard blocker check. If a missing-room item still says `Place session`, return `NO-GO`.

### 4. Generated occupied-slot swap must use the modern action label

1. On `/timetable`, click an occupied generated timetable entry.
2. Click another occupied generated timetable entry to open `Review occupied-slot swap`.
3. Confirm the primary action button says `Swap sessions`.
4. Confirm there is no `Apply repair` button in this generated occupied-slot swap dialog.

Do not click the final confirmation button unless you have a reversible fixture. This validation should not mutate the live timetable.

### 5. Layout and app-error smoke

For desktop, mobile portrait, and mobile landscape:

- `/timetable` must render the timetable table.
- No app-critical page errors or React error boundary text should appear.
- No global browser scrollbar should be introduced by the source-truth notice.

## Required Commands

Run the Codex-created gate:

```bash
npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-overhaul-iteration-a.spec.ts --workers=1
```

Also run:

```bash
cd atlas-client
npx tsc --noEmit
npm run test:ux-guardrails
npm run test:timetable-conflict
npm run build
```

If `npm run lint` is unavailable, report that as unavailable rather than a failure.

## Report Format

Return:

1. `GO` or `NO-GO`.
2. Exact tests/commands run and pass/fail result.
3. Browser timing observations.
4. API evidence summary.
5. Console/page/network/app errors.
6. Whether missing-room unassigned cards avoided the false `Place session` action.
7. Whether generated swap uses `Swap sessions`.
8. Any blockers before Codex proceeds to Iteration B.

