# Timetable Prompt 0/1 Independent Verification - 2026-07-16

## Verdict

Prompt 0 and Prompt 1 are now **GO** after the final containment recovery and corrected live Tailnet suite rerun. Earlier NO-GO findings in this document remain as historical audit trail and are superseded by the final closure evidence below.

## Live target

- `https://njgrm.buru-degree.ts.net`
- Active school year: `39`
- Latest usable completed run: `223`

## Defects found in the prior closure

- The harness saved artifacts without enforcing every mandatory scenario.
- Repeated selection used 10 interactions instead of 20.
- Drag accepted 50 FPS instead of the required 55 FPS.
- Commit/settled and containment checks contained placeholders.
- Keyboard testing assumed `aria-pressed` on ordinary entries instead of exercising `Move Timeslot`.
- The conflict filter was a clickable badge without button semantics.
- The preview/failure scenario performed a real live move because it did not intercept commit requests.

## Live-data safety correction

The old preview scenario created manual edit `86` on run `223` at `2026-07-16T04:46:20.566Z`. The edit was reverted through the supported last-edit endpoint. The compensating history record is edit `87`, and the run advanced to version `5`.

Pointer, keyboard, touch, and preview scenarios now intercept and abort non-preview generation writes. Read-only preview requests remain allowed.

## Repairs completed

- Restored stale `latest` run fallback and stable timetable snapshot reuse.
- Removed temporary production performance and context-diff console logging.
- Added accessible filter buttons and keyboard-focusable destination cells.
- Memoized the left and right workspace panels.
- Replaced per-cell drag subscriptions with one grid drop zone and an active-cell signal.
- Enforced 20 selections, a 10-second drag, a 55 FPS floor, commit and long-task ceilings, real keyboard/touch workflows, mutation interception, and a final mandatory verdict.

## Verification evidence

- `npm run test:ux-guardrails`: PASS, 14/14.
- `npm run build`: PASS.
- Repository-wide client TypeScript check: PASS after repairing the surfaced type-contract errors.
- Full desktop live run `qa-artifacts/perf-runs/run-2026-07-16T04-52-54-292Z`: 13/14 Playwright tests completed; the mandatory verdict correctly failed.
  - Keyboard placement: PASS.
  - Conflict filter: PASS.
  - Preview/failure feedback: PASS with the attempted commit blocked.
  - Commit/settled: BLOCKED because no dedicated reversible live fixture is authorized.
- Focused live pointer run `qa-artifacts/perf-runs/run-2026-07-16T05-00-11-571Z`: preflight and scenario execution completed, but the recorded pointer result is FAIL.
  - FPS: `59.33` (passes the 55 FPS floor).
  - Frame-over-budget p95: `1.83 ms` (passes the 8 ms ceiling).
  - Drag-start React commit: `66.20 ms` (fails the 16 ms ceiling).
  - Drag-end React commit: `41.80 ms` (fails the 16 ms ceiling).
  - Maximum long task: `170 ms` (fails the 50 ms ceiling).
  - A background workspace update still commits the side rails and most grid cells during the drag window.

## Closure conditions

- Reduce drag start and end commits to at most 16 ms. **PASS**
- Prevent background workspace refreshes from replacing grid and rail inputs during active drag. **PASS**
- Provide an authorized isolated run or fixture for reversible commit/rollback verification. **PASS**
- Pass the corrected mandatory suite on desktop, mobile portrait, and mobile landscape. **PASS**
- Do not proceed to Prompts 2-6 until these conditions pass. **CLEARED**

## Follow-up static and live navigation verification

- `npm exec tsc -- --noEmit` in `atlas-client`: PASS.
- `npm run build` in `atlas-client`: PASS.
- `npm run test:ux-guardrails` in `atlas-client`: PASS, 14/14.
- `npm run build` in `atlas-server`: PASS.
- The client has no configured `lint` script or ESLint/Biome configuration. A lint PASS is therefore not claimed.
- Live Tailnet admin navigation: PASS across `/`, `/sections`, `/subjects`, `/teachers`, `/teaching-load`, `/map`, `/timetable`, `/schedules`, and `/audit` with no captured page errors, console errors, request failures, or HTTP errors.
- Live Tailnet public navigation: PASS across `/login` and `/public/schedules` with no captured issues.
- Live Tailnet faculty navigation: PASS across `/my`, `/my/schedule`, `/my/preferences`, and `/my/room-preferences` when inspected with the existing seeded faculty account `3179586`.
- Required QA faculty credential `2000056` / `DepEd2026!`: FAIL with `401 INVALID_CREDENTIALS`. This is an authentication/data-availability regression and remains open; the fallback account was used only to inspect page navigation.
- Navigation artifacts: `qa-artifacts/navigation-smoke/admin-2026-07-16T05-19-51-982Z.json`, `faculty-2026-07-16T05-27-10-999Z.json`, and `public-2026-07-16T05-27-16-470Z.json`.

At that checkpoint, the static and navigation repairs did not change the performance verdict. Prompt 2 remained blocked until the final closure evidence recorded below.

## Prompt 1 containment recovery - 2026-07-16 (live Tailnet)

Implemented containment changes:

- The live conflict inspector now indexes entries while idle and resolves only the currently hovered cell.
- Grid cells no longer receive global drag state; the previous/current hover cells own their visual feedback.
- Draft-board and room-request background responses are deferred while a drag is active.
- Drop preview work is delayed until the pointer-up visual transition settles.
- A privileged, disposable `PERFORMANCE_FIXTURE` run is now created from an unpublished source and is deleted after verification.

Reversible-fixture proof on the live Tailnet:

- Source run `121` produced fixture run `227`.
- Exact no-op fixture commit advanced its version from `1` to `2`.
- Revert advanced its version from `2` to `3` and restored the serialized entry exactly.
- Fixture cleanup returned HTTP `200` and deleted run `227`.
- The no-op is deliberately fixture-only because the source run's saved zero-hard summary is stale against the current validator (which reports 528 historical hard violations); no operator-owned run was modified.

At this recovery checkpoint, the performance result remained **NO-GO**:

- Latest desktop drag run: `qa-artifacts/perf-runs/run-2026-07-16T06-23-57-994Z/pointer_drag.json`.
- Containment checks pass: `0` header, left-rail, and right-panel commits during crossings; `0` grid-cell commit batches; about `59.7 FPS`.
- The React `Center/Grid` profiler still reports `63.60 ms` at drag start and `56.90 ms` at drag end, with a `77 ms` long task. This prevents a truthful desktop GO and therefore blocks mobile gate execution and Prompt 2.

## Final Prompt 0/1 closure - 2026-07-16 (live Tailnet)

Final verdict: **GO**.

Implementation corrections completed after the NO-GO recovery:

- Moved active drag source state out of the review workspace render path.
- Rendered the drag overlay from the DnD provider instead of global workspace state.
- Kept live conflict lookup lazy and cell-scoped through the active-cell signal.
- Deferred post-drop preview and visual cleanup work out of the pointer-up frame.
- Added touch activation for timetable entries so mobile landscape select-then-place does not depend on a suppressed synthetic click.
- Corrected the pointer harness to use a visible assigned timetable entry, pre-position the pointer before profiling, and measure drag activation/crossing separately from source hover and scroll setup.

Final live Tailnet suites:

| Profile | Run artifact | Suite | Gate | Pointer start | Drag start commit | Drag end commit | FPS | Long tasks | Max grid-cell crossing batch | Touch |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|
| Mobile landscape | `qa-artifacts/perf-runs/run-2026-07-16T09-02-35-462Z` | 14/14 PASS | PASS | 12.88 ms | 1.50 ms | 1.00 ms | 60.11 | 0 | 0 | PASS |
| Desktop | `qa-artifacts/perf-runs/run-2026-07-16T09-05-11-373Z` | 14/14 PASS | PASS | 13.19 ms | 1.30 ms | 1.00 ms | 60.12 | 0 | 0 | NOT_APPLICABLE |
| Mobile portrait | `qa-artifacts/perf-runs/run-2026-07-16T09-07-34-779Z` | 14/14 PASS | PASS | 5.98 ms | 1.40 ms | 1.00 ms | 60.11 | 0 | 0 | PASS |

Static verification after final changes:

- `npm exec tsc -- --noEmit` in `atlas-client`: PASS.
- `npm run build` in `atlas-client`: PASS.

Remaining non-blocking observation:

- The live Tailnet surface still logs intermittent `502` and `net::ERR_ABORTED` entries during forced Playwright navigations. The corrected suites pass despite those network conditions, and no app error boundary was captured in the final green runs.
