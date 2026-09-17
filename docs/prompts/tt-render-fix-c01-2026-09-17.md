# TT-RENDER-FIX-C01 - repair the Timetable hook-order crash and add a route error boundary

ROLE: EXECUTOR. Recommended reasoning variant: `high`. Risk tier: **HIGH for the
deploy step** (shared-runtime release swap); the source change itself is small and
closely bounded.

## Why - live production defect on the demo-critical page

The Timetable page throws on load on the live site:

```
Unexpected Application Error!
Minified React error #310  (Rendered more hooks than during the previous render)
  at Object.gs [as useCallback]
  at au (ScheduleReviewWorkspace-<hash>.js)
```

React error #310 is a hook-count mismatch: a render returned early and a later
render on the same instance called more hooks than the previous one.

## Root cause (confirmed by source analysis at the live pin)

`atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx`:

- line 176 - `if (state.loading && !state.draft) { return <TimetableSkeleton />; }`
- line 180 - `if (state.error) { return (...) }`
- line 203 - `if (!state.headerContext || !state.leftRailContentContext || !state.centerWorkspaceContext || !state.rightPanelContext) { return <TimetableSkeleton />; }`
- **line 247 - `const armSwapSessions = useCallback(...)`** - a hook declared
  **after** those early returns.

A render that returns early never calls `armSwapSessions`; the next render that
proceeds past does. That is the #310 mismatch. It is the only hook after an early
return in that file; `ScheduleReviewWorkspaceBody/Header/Dialogs` are clean.

**This is not a deployment regression.** The identical defect exists at identical
lines in the previous release `54dce67b` as well as the live `8eb0511b`. The
rollover data shape is what now drives the component through an early-return render
followed by a full render on the same instance.

## Scope

1. **Hoist the hook.** Move the `armSwapSessions` `useCallback` (with its R3
   comment, currently lines 244-255) to above the first early return - before line
   174, joining the other hooks. Its dependency array is
   `[state.setSwapClassTimesMode, state.setSwapClassAEntryId,
   state.setSwapClassBEntryId, state.setInlineActionStatus]` - all `state`
   setters available long before line 174 - so nothing between 174 and 247 feeds
   it. No logic change; this is a declaration relocation only.
2. **Add a route-level error boundary** so a component failure degrades instead of
   replacing the whole page with the framework's crash screen. Include the
   Timetable route at minimum; prefer the router's `errorElement` pattern already
   used elsewhere in `App.tsx`/router config rather than inventing a new one.
3. **Regression test.** A test that mounts the workspace and renders it first
   through the loading state (no draft) and then through the loaded state **on the
   same instance**, asserting no hook-order error. It must fail before the hoist
   and pass after.

## Acceptance

| # | Row | Pass condition |
| --- | --- | --- |
| 1 | Unit/regression | the new test fails on the pre-fix source and passes after |
| 2 | Client type-check + build | clean |
| 3 | Focused suite | the timetable/workspace suites pass; no assertion removals |
| 4 | Live render (after deploy) | the Timetable page loads authenticated with **no** `#310` and no console error; snapshot the loaded workspace |
| 5 | Behavior preserved | the Swap affordances still arm the two-class swap workflow (the R3/A-05 behaviour the hook provides) |
| 6 | Boundary | forcing a child failure renders the boundary, not the raw crash page |

Rows 4-6 are live rows. If the deploy is deferred by the predecessor gate, record
rows 1-3 as the source result and rows 4-6 as the post-deploy acceptance, and do
not claim them early.

## Deploy step (HIGH - shared-runtime release swap)

The fix must ship as a **release**, not a dist hot-patch: replacing
`atlas-client/dist` inside the live release directory would make it diverge from
its pin and break `verifyProductPin`.

- Build and install a release pinned at the fix commit (same shape as the C10
  cutover: alternate-port smoke, then a release directory
  `D:\ATLAS-runtime-supervised-<pin12>-<date>`).
- `launchOwner` = the registered task `\ATLAS-Runtime-Supervisor` (SYSTEM, ONSTART,
  `PT0S`, `IgnoreNew`); `launchMechanism` = re-point the task action/working
  directory and the **Machine-scope** `ATLAS_RUNTIME_SOURCE_DIR` /
  `ATLAS_RUNTIME_RELEASE_SHA`, then `schtasks /run /tn Atlas-Runtime-Supervisor`.
  Never launch the runtime as a child of the executor shell.
- `rollbackLaunchOwner` / `rollbackLaunchMechanism` = the same task, re-pointed
  back to `D:\ATLAS-runtime-supervised-8eb0511baa53-20260917`
  (`8eb0511baa537d4212f24a007ac40e2dded38c0e`), which is the current live release
  and is proven startable.
- Register the new release directory in the global Git `safe.directory` list **as
  part of the declared `approvedActions`** - do not repeat the C10 record gap.
- Verify Machine-scope variables by reading
  `[Environment]::GetEnvironmentVariable(name,'Machine')`, **never** from the
  session's inherited environment: a shell started before the change still reports
  the old release, and `cli.mjs status` resolves its state path from that variable.

## Forbidden

No data mutation, generation, publication, Teaching Load apply, term-cache apply,
rollover, migration, or companion edit. No durable-env edit. Do not touch port
5175, unrelated processes, or Tailscale Serve. No global Git setting other than the
single new `safe.directory` entry named in the approved actions.

## Deliverable

One evidence document under `docs/reviews/tt-render-fix-c01/`: the fix diff, the
regression test with its pre-fix failure and post-fix pass, the ErrorBoundary, the
release identity and task/machine-variable diff, the pin proof, the pre/post
PID/listener/health identity, rows 1-6 with per-row PASS/FAIL (live rows labelled
`DEFERRED_TO_POST_DEPLOY` if the deploy is not yet authorized), rollback status,
and the root-cause note that the defect predates the C10 deployment.
