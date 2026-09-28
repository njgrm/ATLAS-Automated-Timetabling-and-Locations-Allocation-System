# Packet c5 — Planner A2 — source work while browsers are signed out — 2026-09-28 08:05 +08

Issued by Lane C. Authority as in c3. Live `a1db27d5`. **Both browser profiles are signed out** (Lane C finding L1,
`docs/reviews/lane-c-overnight-20260928/findings.md`); the operator re-seeds them this morning, so B9–B22 wait. Do
source work only; delegate implementation to executors and QA to atlas-qa; background any server.

1. **L1 (HIGH, demo risk): does a cutover sign every user out?** Find where sessions and "remember me" tokens live
   (in-memory store? a per-release or per-process signing secret? a cookie secret read from the release dir?), and
   prove it with a test or a loopback restart. If a restart invalidates remember-me sessions, fix it so a deploy never
   signs users out (a persistent store or a stable secret from the runtime config, **no secret value in any file,
   log or commit**). Record the verdict either way.
2. **#52:** first render of `/timetable/map` shows the previous section's grid for ~2 s; show a loading state
   (`TimetableRouteViewSync.tsx:67`, `CenterWorkspace.tsx:585-614`, `timetable-route-loading-intent.ts:7`).
3. **#53 remainder:** `CenterWorkspace.tsx:608` must pass a real `buildingOccupancy`; the campus map tiles still read
   "0% FILLED" for occupied wings. Real use from the published run, or A3's labelled not-available state.
4. The residual "Locked classes kept" unmeasured 0; the `tt-output-c03r` workbook columns dropped in production data.
5. Stage one release carrying 1–4 plus A3's `34b01038`; cut it over only once the operator has re-seeded the sessions
   (check with one browser probe). Otherwise leave it staged with its pre-action review done.
6. Handoff c5 section, acks, live-state. Push.
Final message: ≤ 12 lines.
