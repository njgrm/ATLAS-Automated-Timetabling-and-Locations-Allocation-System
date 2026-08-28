# Prompt 0 — Timetable Performance Baseline and Instrumentation

## Objective

Build a reproducible performance harness for `/timetable` before changing runtime behavior. Measure navigation, resource loading, React commits, long tasks, session selection, drag start, drag-over frames, live conflict activation, preview, commit, and settled state.

## Required work

1. Repair the timetable Playwright harness so it starts or verifies the correct server, uses environment-provided credentials, fails fast on missing configuration, and retains trace data on failure.
2. Isolate or timestamp performance output so a run cannot clean or replace existing visual-regression evidence in the shared report/results directories.
3. Separate environment/runtime failure from performance failure. A page-level `Network Error`, HTTP 4xx/5xx, missing active run, or stale fixture must produce a distinct blocked result.
4. Add deterministic performance scenarios for:
   - cold authenticated direct visit;
   - warm in-app navigation to `/timetable`;
   - first session selection;
   - repeated selection across 20 sessions;
   - drag start;
   - a 10-second drag across representative empty, warning, and blocked cells;
   - keyboard/tap select-then-place;
   - preview, commit, rollback/failure, and settled state;
   - request-filter changes.
5. Capture navigation/resource timing, long tasks, event timing where supported, frame cadence, API timing/status/size, and user-timing marks.
6. Add React Profiler evidence that names commit count/duration for Header, Left Rail, Center/Grid, Right Panel, and Tactical Sandbox.
7. Record dataset size: entries, days, slots, cells, faculty, rooms, violations, unassigned items, and candidate count.
8. Capture local development diagnostics and production-build measurements separately.
9. Define the target low-end school device/network profile and document any emulation limits.

## Files to inspect first

- `playwright.config.ts`
- `qa-artifacts/playwright/specs/timetable-preview-smoke.spec.ts`
- `atlas-client/src/pages/ScheduleReview.tsx`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx`
- `atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts`
- `atlas-client/src/hooks/useTimetableData.ts`
- `atlas-client/src/components/timetable/TimetableGrid.tsx`
- `atlas-client/src/components/timetable/TacticalSandboxDock.tsx`

## Acceptance gates

- Two consecutive clean runs produce comparable results with documented variance.
- Each scenario reports pass, fail, or blocked with a concrete reason.
- Traces exist for failed/slow scenarios.
- The report includes request waterfall, route JavaScript transfer, long tasks, frames/FPS, event-to-paint latency, and React commit counts/durations.
- The baseline explicitly identifies which components commit on selection, drag start, each crossed cell, and remote presence updates.
- No credentials are committed.
- No production scheduling behavior changes in this prompt.

## Verification

- Run the harness on desktop and the agreed low-end profile.
- Run interval/selection/drag scenarios against a stable run fixture.
- Capture Tailnet evidence. If Tailnet is unavailable, keep this prompt at NO-GO and store local results as supporting evidence only.
- Append results to `docs/verification/evidence-log.md` and update the audit budgets if measured constraints require a documented decision.

## Deliverable

Produce a dated baseline report and machine-readable metrics under `qa-artifacts/`, plus the reusable automated test/spec changes.
