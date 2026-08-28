# Prompt 6 — Route Code Splitting, Regression Budgets, and Live Closure

## Objective

Reduce first-use JavaScript, enforce the complete performance roadmap in automated gates, and close the work with live Tailnet and target-user evidence.

## Preconditions

- Prompts 0–5 pass locally with before/after evidence.
- Functional behavior and accessibility suites are green.

## Required work

1. Lazy-load mutually exclusive timetable center views, advanced docks, and dialog groups that are not required for the initial grid.
2. Remove avoidable nested chunk discovery or prefetch the required workspace chunk on authenticated navigation intent.
3. Prefetch secondary features after the core grid is interactive or on hover/focus/explicit intent without stealing critical bandwidth/CPU.
4. Measure compressed transfer, parse/evaluation, request count, and cache behavior in a production build.
5. Enforce route JavaScript and interaction budgets in CI with stable variance policy and actionable failure output.
6. Run the full Prompt 0 matrix after every optimization: cold/warm navigation, selection, drag, keyboard/tap placement, conflict detail, sandbox, preview/commit, collaboration, and failure recovery.
7. Add accessibility regression verification: keyboard flow, focus, live status, reduced motion, screen-reader naming, and touch target behavior.
8. Run moderated older/non-technical user validation for selection, conflict interpretation, blocked placement recovery, pending save, and rollback.
9. Capture Tailnet evidence on the agreed low-end school hardware or the closest documented equivalent.
10. Update phase/status documentation only from captured evidence.

## Files to inspect first

- `atlas-client/src/pages/ScheduleReview.tsx`
- `atlas-client/src/components/timetable/CenterWorkspace.tsx`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspaceOverlays.tsx`
- timetable modal/dock imports
- `atlas-client/vite.config.ts`
- `playwright.config.ts`
- Prompt 0 performance harness and reports

## Acceptance gates

- Initial timetable-route JavaScript transfer is at least 30% lower than Prompt 0 baseline.
- No secondary feature chunk is fetched before core-grid interactivity unless the report proves it is critical.
- Cold/warm, selection, drag, conflict, sandbox, and drop budgets from the sequence index all pass on Tailnet.
- No Core Web Vital or long-task regression on the authenticated shell.
- Keyboard/touch parity and screen-reader status tests pass.
- Moderated users can select a session, understand one conflict, choose a safer destination, and recognize pending/success/failure without facilitator intervention at the agreed success rate.
- CI rejects a material route-size or interaction regression with a clear artifact.
- The evidence log contains environment, dataset, device/network, commit, run identity, raw metrics, variance, screenshots/traces, and GO/NO-GO decision.

## Verification

- Use production build/preview locally, then repeat on Tailnet.
- Run at least three measured iterations after warm-up for each performance scenario and report p50/p75/p95 as appropriate.
- Verify caches do not hide cold-route regressions.
- Confirm hard-conflict, publish, revision, selected-run, and collaboration correctness.

## Closure rule

Mark the roadmap GO only when all budgets pass on Tailnet and the accessibility/older-user evidence is complete. If Tailnet is unavailable or any correctness gate fails, retain NO-GO and list the exact remaining blocker.
