# EnrollPro rollover runbook (Lane C) — written after the 2026-09-29 incident

## What went wrong on 2026-09-29
EnrollPro rolled 2022-2023 -> 2023-2024 at ~13:15. ATLAS auto-sync is off by design, so live stayed on 2022-2023:
every page re-verified EnrollPro (runtime context up to 48 s, rollover-status up to 72 s), pages showed "EnrollPro has
moved", SMART saw "ATLAS active year 1 != EnrollPro active year 2" and its `/faculty` fetch timed out. Planner builds
and tests on the same host caused 5.5 s event-loop stalls on live at the same time. Live School Year Setup then sat on
"Checking the school year now..." with the preview disabled, so the operator could not sync from the UI. A false
"changed to 2029-2030" banner (id-space collision) confused the picture. Recovered by ~13:50: staging rehearsal via
API, live backup, live sync, then the 2023-2024 Teaching Load saved (264 assigned, 50 open).

## The procedure (every rollover)
1. **Before** the EnrollPro rollover: host quiet (planners paused or at BelowNormal — the reaper enforces this), live
   healthy, `pg_dump` of live to `D:\ATLAS-runtime-config\backups\pre-live-sync-<date>\`.
2. Operator rolls EnrollPro over and tells Lane C at once.
3. **Within 10 minutes**, rehearse on staging via the API (staging QA login): `rollover-sync/preview` (0 conflicts,
   0 reconfigured) -> `rollover-sync/apply` with both carry switches `true` -> `term-authority/preview` (expect
   `ALREADY_CURRENT`, else apply with the returned confirmation + fingerprint) -> runtime context shows the new year
   and a verified term.
4. **Immediately after**, sync live the same way — the UI if School Year Setup works, otherwise the same API calls from
   the operator's signed-in page (Codex), with the same guard: apply only if the target label is right and there are
   0 conflicts.
5. Build and save the new year's Teaching Load (suggestion / carry-forward, then Save), so SMART gets classes.
6. Check: Dashboard has no "EnrollPro has moved"; Teacher Concerns shows its form; Class Schedule readiness; SMART's
   next fetch succeeds; live-data invariant = exactly 1 active mirror.

The mismatch window must be minutes, not an hour. Never leave live on the old year while EnrollPro is on the new one.
