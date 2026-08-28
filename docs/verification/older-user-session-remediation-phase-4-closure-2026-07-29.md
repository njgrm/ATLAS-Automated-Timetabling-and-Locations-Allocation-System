# Older-User Session Remediation Phase 4 Closure — 2026-07-29

## Verdict

Phase 4 is **Technical GO**.

This is browser-proxy evidence only. Product GO still requires Phase 5 moderated older-user sessions using the shared protocol.

## Scope verified

- Generated-unassigned queue touch scrolling on mobile portrait and mobile landscape.
- Local queue/drawer scrolling without global page scroll.
- Click-to-place after scrolling without stale selection or live timetable mutation.
- 200% text-size reflow for task drawer, queue, status key, and review sheet.
- Regression safety for Phase 0 through Phase 4 older-user remediation contracts.

## Implementation changes

- `atlas-client/src/components/timetable/VirtualizedRailList.tsx`
  - Added one-finger touch-scroll fallback for virtualized rail lists.
  - Keeps scroll movement inside the intended rail and stops propagation only after a real vertical pan threshold.
- `atlas-client/src/components/timetable/GeneratedRunRailPanels.tsx`
  - Added `touch-pan-y overscroll-contain` to the generated-unassigned queue viewport.
- `atlas-client/src/components/timetable/DraggablePinWrappers.tsx`
  - Generated-unassigned drag listeners are disabled on coarse-pointer devices so touch users can scroll and tap reliably.
  - Desktop pointer dragging remains available.
- `qa-artifacts/playwright/specs/timetable-touch-queue-and-reflow.spec.ts`
  - Added Phase 4 browser gate using CDP `touchStart` / `touchMove` / `touchEnd` events, click-to-place after scroll, and 200% reflow checks.
- `atlas-client/src/lib/__tests__/ux-guardrails.test.ts`
  - Added static guardrail coverage for the Phase 4 touch-scroll contract.
- `qa-artifacts/playwright/specs/older-user-session-remediation-fixtures.ts`
  - Hardened the legacy desktop wheel probe by closing transient menu state before measuring the queue.

## Key evidence

Latest Phase 4 touch artifacts:

- `qa-artifacts/older-user-session-remediation/phase-4/mobile-portrait-queue-touch-scroll-metrics-2026-07-28T17-27-06-123Z.json`
  - viewport: `390x844`
  - gesture: `touch-dispatched`
  - queue: `scrollTop 0 -> 176`
  - root: `scrollHeight 844`, `clientHeight 844`
- `qa-artifacts/older-user-session-remediation/phase-4/mobile-landscape-queue-touch-scroll-metrics-2026-07-28T17-27-56-309Z.json`
  - viewport: `844x390`
  - gesture: `touch-dispatched`
  - queue: `scrollTop 0 -> 176`
  - root: `scrollHeight 390`, `clientHeight 390`

## Commands run

- `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/timetable-touch-queue-and-reflow.spec.ts --workers=1 --reporter=line`
  - PASS: `9/9`
- `npm exec -- tsc --noEmit` in `atlas-client`
  - PASS
- `npm run test:ux-guardrails` in `atlas-client`
  - PASS: `35/35`
- `npm run test:timetable-conflict` in `atlas-client`
  - PASS: `10/10`
- `npm run build` in `atlas-client`
  - PASS
- `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/older-user-session-remediation-phase-0.spec.ts qa-artifacts/playwright/specs/older-user-status-guidance.spec.ts qa-artifacts/playwright/specs/dashboard-source-health-guidance.spec.ts qa-artifacts/playwright/specs/timetable-review-focus-and-cancel.spec.ts qa-artifacts/playwright/specs/timetable-touch-queue-and-reflow.spec.ts --workers=1 --reporter=line`
  - PASS: `45/45`
- `npx playwright test -c playwright.config.ts qa-artifacts/playwright/specs/older-user-session-validation-codex.spec.ts --workers=1 --reporter=line`
  - PASS: `3/3`; T01-T12 passed on desktop, mobile portrait, and mobile landscape without committing timetable data.

## Notes

- The generated-unassigned queue remains virtualized with a bounded visible slice.
- Mobile/coarse-pointer users should use tap/click placement as the primary older-user path; desktop users retain drag placement.
- The live Tailnet tests were write-guarded; no timetable commit endpoint was allowed during verification.

