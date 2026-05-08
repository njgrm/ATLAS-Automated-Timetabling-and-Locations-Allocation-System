# Faculty Session Persistence Gate Re-Run (2026-05-08)

## Scope
Manual re-gate for the faculty session persistence blocker and required regression checks.

## Manual Checks
1. Check 1 - Faculty login redirects to `/my`: PASS
   - Evidence: `qa-artifacts/screenshots/gate-check1-faculty-login-my.png`

2. Session integrity - faculty session survives refresh: PASS
   - Evidence: `qa-artifacts/screenshots/gate-check-session-refresh-persist.png`

3. Check 2 - Faculty route guard redirects non-My routes back to `/my` while role remains faculty: PASS
   - Action: attempted direct navigation to `/timetable`
   - Result: redirected back to `/my` and sidebar identity remained faculty.
   - Evidence: `qa-artifacts/screenshots/gate-check2-faculty-route-guard.png`

4. Officer login regression sanity: PASS
   - Action: local officer login (`officer@deped.edu.ph` / `Atlas2026!`)
   - Result: successful redirect to `/` (scheduler view)
   - Evidence: `qa-artifacts/screenshots/gate-officer-login-regression-check.png`

5. Check 3 - `/my/preferences` lifecycle workflow: BLOCKED (environment)
   - Result: page shows `Cannot load preferences` -> `Failed to load session context.`
   - Evidence: `qa-artifacts/screenshots/gate-check3-preferences-blocked-no-context.png`

6. Check 4 - Bilateral SSE awareness validation: BLOCKED (environment)
   - Reason: dependent faculty preference context unavailable (same session-context failure as check 3).

7. Check 5 - `/my/room-preferences` offline queue/autosync validation: BLOCKED (environment)
   - Result: no completed run/session context available in this environment.
   - Evidence: `qa-artifacts/screenshots/gate-check5-room-preferences-blocked-no-context.png`

## External Blocker Evidence
- EnrollPro server startup failed, which prevented EnrollPro API context needed by ATLAS manual preference/room flows.
- Command: `npm --prefix EnrollPro run dev`
- Error:
  - `Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'D:\ATLAS\EnrollPro\server\src\features\teachers\atlas-sync.service.js'`
  - Import source: `EnrollPro/server/src/features/teachers/teachers.controller.ts`

## Required Command Verification
- `npm --prefix atlas-server run build`: PASS
- `npm --prefix atlas-client run build`: PASS
- `npm --prefix atlas-server run test:auth`: PASS
- `npm --prefix atlas-server run test:faculty-route-restrictions`: PASS
- `npm --prefix atlas-client run test:auth-session`: PASS
- `npm --prefix atlas-server run test:preference-wellbeing`: PASS
- `npm --prefix atlas-server run test:preference-lifecycle-lock`: PASS
- `npm --prefix atlas-server run test:preference-sse-bilateral`: PASS
- `npm --prefix atlas-server run test:room-pref-sync`: PASS

## Gate Decision
- Partial pass.
- Session drop-to-guest blocker is resolved for faculty local sessions (login, guarded navigation, refresh persistence).
- Full gate cannot be marked PASS because checks 3-5 are blocked by external EnrollPro runtime failure in this environment.
