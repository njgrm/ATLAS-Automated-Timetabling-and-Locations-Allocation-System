# Timetable Performance Live Closure — 2026-07-13

**Target:** `https://njgrm.buru-degree.ts.net/timetable`  
**Role:** Scheduler officer/admin QA account  
**Viewport coverage:** Existing compact viewport plus desktop 1366×768  
**Verdict:** **FUNCTIONAL RECOVERY GO / PERFORMANCE CLOSURE NO-GO**

## Outcome

Live Tailnet access was restored and the timetable is usable again. Two hard user-facing failures were fixed:

1. The application shell no longer crashes with an invalid React hook/runtime error.
2. “Latest Run” no longer shows an empty grid when the latest alias rejects stale faculty references; it loads the same run through its explicit read-only contract and keeps the setup-change warning and unsafe actions gated.

The highest-confidence interaction fixes from the audit were also applied live:

- selecting a session no longer automatically mounts or opens the heavy Tactical Sandbox;
- “Fix teacher assignment” is now an explicit action;
- the Tactical Sandbox component is not mounted until requested;
- repeated drag-over events within the same cell no longer cause redundant drop-target state updates;
- the production service worker only cache-firsts immutable `/assets/*` resources, preventing stale Vite `/src/*` and optimized React modules from being retained.

## Live evidence

| Check | Result |
|---|---|
| Tailnet root | HTTP 200, approximately 24–46 ms during probes |
| API liveness | HTTP 200, approximately 24–26 ms; shallow process health only |
| Admin authentication | HTTP 200, approximately 324 ms |
| Shell crash | Reproduced before repair; absent after React dependency regeneration and dedupe configuration |
| New console errors after repair | 0 captured |
| Default latest timetable | Run 141 rendered successfully instead of a blank workspace |
| Run 141 live grid | 3,440 assigned entries, 25 unassigned, 25 hard and 890 soft violations |
| Stale-state safety | “Setup changes detected” visible; Publish and unsafe manual repair remained gated |
| Lightweight selection | Session selection showed “Fix teacher assignment”; repair sheet remained absent |
| Explicit advanced workflow | Repair sheet appeared only after clicking “Fix teacher assignment” |
| Conflict drag | MAPEH Monday 7:30 was dragged onto occupied AP Tuesday 8:15; occupied-slot swap review appeared |
| Data mutation safety | Swap review was cancelled; no repair was applied |
| Production build | Passed; timetable workspace chunk 374.70 kB raw / 96.42 kB gzip |
| UX guardrail tests | 13/13 passed |

## Errors found and repaired

### Invalid React hook/runtime crash

The live origin serves Vite development/HMR and the browser had a mixed optimized React module graph during dependency regeneration. The workspace and client also contain physical React installations, and the previous service worker cache-firsted every same-origin script, including development modules.

Repairs:

- added Vite `resolve.dedupe` for `react` and `react-dom`;
- regenerated the client Vite dependency cache and restarted the client;
- restricted service-worker cache-first behavior to immutable `/assets/*` resources;
- bumped the service-worker cache version.

### Blank latest-run workspace

The live latest endpoints return `409 STALE_RUN_DATA` because run 141 references 114 stale faculty mirror IDs. The previous client catch block cleared the draft and violations, even though explicit run 141 reads were healthy.

Repair:

- when the latest alias specifically returns `STALE_RUN_DATA`, the client loads the same newest run ID through the explicit historical read contract;
- the returned `inputState` continues to show stale setup domains and gate unsafe actions.

## Remaining performance and environment blockers

1. **Core-grid readiness exceeds the roadmap target.** The unique grid entry was not visible within the browser harness's 3-second selector deadline; the target is 1.5 seconds on the agreed profile.
2. **Latest validity resolution is expensive.** Latest draft/violation aliases spend approximately 1.9–2.0 seconds proving no current faculty-safe run exists before the explicit read-only fallback can load.
3. **Upstream runtime context is stale.** EnrollPro was unreachable during closure, and the runtime context call took approximately 4.15 seconds.
4. **Run 141 is not current setup truth.** It references 114 stale faculty IDs. A fresh sync and generation run is required for publish-ready truth.
5. **Drag frame and React commit budgets are not yet instrumented.** The end-to-end automated drag reached the swap dialog in approximately 1.53 seconds, but this is not a substitute for p95 pointer-frame and React Profiler evidence.
6. **Route payload remains broad.** The timetable workspace chunk remains 96.42 kB gzip, before the main application and shared dependencies.

## Closure decision

- **GO:** Tailnet connectivity, authentication, shell rendering, default stale-run review, explicit repair entry, occupied-slot conflict workflow, build, and focused tests.
- **NO-GO:** Full performance closure, fresh-run/publish readiness, low-end device frame budgets, and older-user moderated evidence.

No new generation run or timetable mutation was triggered because the upstream source was unavailable and live data regeneration is outside a read/interaction closure check without a verified current input state.
