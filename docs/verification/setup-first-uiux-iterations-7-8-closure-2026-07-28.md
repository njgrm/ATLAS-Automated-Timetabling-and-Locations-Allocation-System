# Setup-First UI/UX Iterations 7–8 Closure

Date: 2026-07-28  
Environment: `https://njgrm.buru-degree.ts.net`

## Verdict

`Technical GO`. The setup-first stream is ready for independent external review. Product-level older-user closure remains pending a moderated participant session; no human participant evidence was fabricated.

## Implemented

- Added `setup-first-uiux-iteration-7-8.spec.ts` for route smoke, app-error detection, overflow checks, and reversible Simple/Advanced timetable mode checks.
- Hardened the Dashboard shell to keep content scrolling locally instead of creating a page-level scrollbar on short mobile-landscape viewports.
- Made route-smoke waits content-aware so loading skeletons are not misclassified as final layout failures.
- Preserved the existing moderated older-user script and scorecard as the required human gate.

## Verification

Local gates:

- `npx tsc --noEmit`: PASS.
- `npm run test:ux-guardrails`: PASS `32/32`.
- `npm run test:timetable-conflict`: PASS `10/10`.
- `npm run build`: PASS.

Tailnet/browser gates:

- `timetable-tailnet-preflight.spec.ts`: PASS `1/1`.
- Iterations 7–8 route and mode suite: PASS `6/6` across desktop, mobile portrait, and mobile landscape.
- Combined setup-first Iterations 0–7 plus timetable compactness regression: PASS `57/57` across desktop, mobile portrait, and mobile landscape.

## Corrective finding

The first Iteration 7–8 run found a mobile-landscape overflow while the Dashboard was still showing its loading skeleton (`scrollHeight=504`, `clientHeight=390`). The Dashboard now uses a fixed shell with a local `flex-1 min-h-0 overflow-auto` content region. The rerun passed all route-smoke and mode checks.

## Human product gate

Use `docs/verification/timetable-moderated-older-user-validation-2026-07-27.md` with at least five representative scheduler participants. Keep the product verdict at `Technical GO / Product validation pending` until its thresholds are recorded.
