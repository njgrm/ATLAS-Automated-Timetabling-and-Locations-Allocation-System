# Older-User Session Remediation Phase 0 Closure

Date: 2026-07-28  
Target: `https://njgrm.buru-degree.ts.net`  
Evidence class: Browser proxy / static test gates  
Decision: **GO for Phase 0; remediation stream remains open**

## Scope

Phase 0 established read-only, evidence-first contracts for the older-user remediation stream. No React, server, database, source-of-truth, or timetable behavior was changed.

Added test-only artifacts:

- `qa-artifacts/playwright/specs/older-user-session-remediation-fixtures.ts`
- `qa-artifacts/playwright/specs/older-user-session-remediation-phase-0.spec.ts`
- JSON evidence under `qa-artifacts/older-user-session-remediation/phase-0/`

The fixture freezes the shared T01–T12 wording and the seven cockpit capability-parity outcomes. Placement and swap probes stop at review and Cancel/Escape; a generation write guard fails the test if a commit endpoint is attempted.

## Live fixture contract

The Tailnet runtime remained unchanged before and after the probes:

| Field | Before | After |
|---|---:|---:|
| School | `1` | `1` |
| School year | `39` | `39` |
| Runtime source | `atlas-persisted` | `atlas-persisted` |
| Stale | `true` | `true` |
| Upstream reachable | `false` | `false` |
| Reviewable run | `223` (`COMPLETED`) | `223` (`COMPLETED`) |
| Unassigned queue | `365` | `365` |

The fixture selects the newest completed run when a newer failed attempt exists, matching the user-facing timetable resolver. No live data was created, edited, or deleted.

## Automated results

- Phase 0 spec: **9/9 passed** across desktop, mobile portrait, and mobile landscape.
- Existing T01–T12 Codex proxy audit: **3/3 viewport sessions passed** (`36/36` task executions).
- `npx tsc --noEmit`: **PASS**.
- `npm run test:ux-guardrails`: **32/32 PASS**.
- `npm run test:timetable-conflict`: **10/10 PASS** on the isolated rerun.
- `npm run build`: **PASS**.

The conflict test had one transient timing-budget miss during an initial parallel gate run; the required isolated rerun passed all 10 tests.

## Probe evidence

- Desktop queue wheel scrolling advanced the intended virtualized list.
- Mobile portrait and landscape programmatic scroll advanced the intended list, while the report explicitly marks the real touch gesture as `unsupported-by-runner`; it is not counted as a touch pass. Real-device/touch-capable browser proof remains Phase 4.
- Placement and occupied-slot swap review sheets opened and cancelled without blocked writes.
- Dialog focus entered the review surfaces and Tab moved through dialog controls. Focus restoration to the exact invoking control is currently recorded as `false` for both placement and swap, confirming OUSER-003 for Phase 3 rather than hiding it behind a passing assertion.
- Global page overflow stayed within the no-scroll contract on all three profiles.
- No browser console errors, uncaught page errors, or ATLAS API 5xx responses were captured during the Phase 0 fixture tests.

## Gate interpretation

Phase 0 is complete because the fixture is stable, reversible, write-protected, and explicit about proxy limitations. The focus-restoration observation and mobile touch limitation are intentionally carried forward as bounded Phase 3 and Phase 4 work. This is technical evidence only; it does not claim moderated older-user Product GO.

