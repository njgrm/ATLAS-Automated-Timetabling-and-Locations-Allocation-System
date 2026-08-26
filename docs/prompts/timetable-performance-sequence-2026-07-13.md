# Timetable Performance Remediation — Sequential Prompt Index

**Created:** 2026-07-13  
**Source audit:** `docs/audits/timetable-performance-audit-2026-07-13.md`  
**Execution rule:** Run prompts in order. Do not begin the next prompt until the current prompt's gates pass or its NO-GO evidence is recorded.

## Sequence

| Order | Prompt file | Outcome |
|---|---|---|
| 0 | `timetable-perf-00-baseline-instrumentation-prompt.md` | Reproducible navigation, selection, drag, conflict, network, and React-render baseline. |
| 1 | `timetable-perf-01-drag-render-containment-prompt.md` | Pointer movement updates only the previous/current target cells and avoids broad workspace commits. |
| 2 | `timetable-perf-02-live-conflict-engine-prompt.md` | Reusable overlap-aware indexes and lazy active-cell conflict detail. |
| 3 | `timetable-perf-03-selection-sandbox-prompt.md` | Immediate lightweight selection and an explicit, virtualized, delta-based Tactical Sandbox. |
| 4 | `timetable-perf-04-workspace-render-boundaries-prompt.md` | Stable state/context slices with measured component commit isolation. |
| 5 | `timetable-perf-05-load-and-mutation-path-prompt.md` | Faster first visit, no filter-triggered reload, and bounded/cancelable preview/commit work. |
| 6 | `timetable-perf-06-code-split-regression-live-gate-prompt.md` | Route chunk reduction, automated budgets, accessibility regression checks, and Tailnet closure. |

## Shared constraints

- Preserve the active Phase 3 generator-readiness truth and the approved UX overlay boundary.
- Do not change scheduling semantics, hard/soft violation meaning, publish gates, role permissions, persisted ownership, or collaboration correctness merely to improve a metric.
- Preserve pointer, keyboard, and touch placement paths.
- Keep SMART-family tokens and the existing no-global-scroll workspace architecture.
- Use production-like builds for final performance comparisons; development timings are diagnostic only.
- Use environment-provided QA credentials and never commit secrets or invalid fallback credentials.
- Record before/after evidence under `qa-artifacts/` and append the decision to `docs/verification/evidence-log.md`.
- If Tailnet is unavailable, complete local supporting verification but keep the phase at NO-GO.

## Cross-phase budgets

- Cold core-grid interactive p75 ≤1.5 s on the agreed target profile.
- Warm in-app grid interactive p75 ≤500 ms.
- Session selection feedback ≤100 ms; intended inspector visible p95 ≤150 ms.
- Drag pointer scripting + render p95 <8 ms, ≥55 FPS, and no >50 ms long task during a 10-second drag.
- Conflict activation p95 ≤16 ms at 1,000 entries; active-cell detail p95 <4 ms.
- Drop acknowledgement <100 ms; preview p95 <300 ms; successful settled state <800 ms on LAN.
- Initial candidate DOM ≤30 cards.
- Initial timetable route JavaScript transfer improves by ≥30% from Prompt 0 baseline.

## Stop conditions

Stop and record NO-GO if any prompt:

- causes a hard-conflict or interval-overlap correctness regression;
- lets a stale preview or selected-run response overwrite newer state;
- removes keyboard/touch parity;
- hides pending/failed saves behind optimistic visuals;
- changes generation or publish truth outside this roadmap;
- cannot produce reproducible before/after evidence.
