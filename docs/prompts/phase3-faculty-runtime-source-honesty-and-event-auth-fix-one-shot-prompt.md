# Copilot Execution Prompt: Phase 3 Faculty Runtime Source Honesty And Event Auth Fix

## Goal

Repair the remaining live faculty/runtime regressions verified on Tailnet after timetable and published schedule recovery.

This pass must make the faculty-facing surfaces honest and operational again without reopening unrelated UX redesign work.

The main target is the current live mismatch where:

- Tailnet runtime context is healthy and `enrollpro-verified`
- faculty pages still present `WORKING FROM SAVED DATA` / `VERIFIED WITH SAVED SCHOOL YEAR DATA`
- unauthorized or failed background requests keep firing on healthy pages
- faculty event/update channels are failing
- faculty room-request self-route parity is inconsistent

---

## Why This Pass Exists

Live Tailnet browser audit on `2026-05-28` verified all of the following at `https://njgrm.buru-degree.ts.net`:

### Healthy baseline already proven

- `/api/v1/health` returns `200`
- admin login works with `1000001 / AdminSY2026!`
- faculty login works with `2000056 / DepEd2026!`
- `/api/v1/runtime/context` returns:
  - `source = enrollpro-verified`
  - `activeSchoolYearId = 55`
- `/api/v1/generation/1/55/runs/latest/timetable` returns `runId = 126`, `entries = 3455`, `unassigned = 0`
- `/api/v1/schools/1/schedules/published` returns published `runId = 126`
- `/api/v1/faculty-portal/1/55/dashboard` returns assignment-bearing faculty data for the live Science teacher

So the system is not generally offline anymore.

### Current verified regressions

#### 1. Faculty pages still lie about degraded data source

Real browser audit showed:

- `/my` renders but shows `WORKING FROM SAVED DATA`
- `/my/preferences` renders but shows `VERIFIED WITH SAVED SCHOOL YEAR DATA`
- `/my/room-preferences` renders but shows `WORKING FROM SAVED DATA`
- `/my/schedule` also shows saved-data style wording despite live published run availability

This is incompatible with the current live runtime context and should be treated as a source-honesty bug, not as a real degraded-state signal.

#### 2. Unauthorized background requests still fire on healthy pages

Tailnet browser audit captured repeated `401` calls from healthy authenticated pages:

- `GET /enrollpro-api/school-years`
- `GET /api/v1/policies/scheduling/1/55` on `/timetable`

These requests are either:

- incorrectly unauthenticated
- pointing at the wrong transport path
- using the wrong expectation for public/private runtime ownership

Even when pages recover visually, this request noise contributes to false degraded messaging and unstable operator trust.

#### 3. Faculty preference and room-request event channels are failing

Live browser audit captured:

- `/my/preferences`
  - `GET /api/v1/preferences/1/55/events?...` -> `net::ERR_FAILED`
- `/my/room-preferences`
  - `GET /api/v1/room-preferences/1/55/events?...` -> `net::ERR_ABORTED`

That means the acknowledgement/status/event layer for these faculty objective surfaces is not currently healthy.

#### 4. Faculty room-request self route is still inconsistent

Live API verification showed:

- faculty login payload exposes `user.userId = 4997`
- direct self-room-request call:
  - `GET /api/v1/room-preferences/1/55/latest/faculty/4997`
  - returns `403 FORBIDDEN`

But the faculty room-request page itself still renders a review surface.

That indicates route identity or authorization parity is still inconsistent between:

- logged-in faculty account identity
- faculty mirror identity
- room-request self-service contract

This is still an objective-level defect.

---

## In Scope

- faculty-facing source-state labeling and degraded banners
- runtime/public-settings consumption paths that drive faculty page status
- auth or routing parity for `enrollpro-api/school-years` usage
- timetable page unauthorized policy fetch only if the same runtime/auth drift is causing it
- faculty preferences event/update transport
- faculty room-preferences event/update transport
- faculty room-request self-route identity/authorization parity
- docs:
  - `docs/reference/atlas-runtime-source-of-truth-map.md`
  - `docs/verification/evidence-log.md`

## Out Of Scope

- redesigning the faculty UX
- changing teaching-load logic
- changing timetable generation logic
- changing publish lifecycle semantics
- broad room-request workflow redesign
- replacing SSE/event transport with a different architecture unless a small compatibility fallback is absolutely required

Do not turn this into a broad portal polish pass.

---

## Required References

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `phasePlan.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/evidence-log.md`
- `atlas-client/src/pages/MyDashboard.tsx`
- `atlas-client/src/pages/FacultyPreferences.tsx`
- `atlas-client/src/pages/FacultyRoomPreferences.tsx`
- `atlas-client/src/pages/MySchedule.tsx`
- `atlas-client/src/lib/enrollpro-public-settings.ts`
- `atlas-client/src/lib/auth-session.ts`
- any current faculty portal/runtime hook used by those pages
- any server routes/services currently backing:
  - `/api/v1/preferences/...`
  - `/api/v1/room-preferences/...`
  - `/api/v1/faculty-portal/...`
  - `/api/v1/runtime/context`
  - `/enrollpro-api/school-years`

---

## Required Product Decisions

Follow these decisions:

1. If runtime context is currently live and upstream-verified, faculty pages must not remain visually stuck in saved-data mode.
2. Background unauthorized calls must not be allowed to silently degrade otherwise healthy pages.
3. Faculty self-service routes must resolve against the logged-in faculty’s real assignment-bearing identity, not an ambiguous duplicate or mismatched identifier.
4. Event/acknowledgement channels may fail gracefully, but they must not fail due to broken auth or route-identity mismatch.
5. The fix must preserve fast cache-first reopen and must not regress the earlier runtime timeout resilience work.

---

## Required Changes

### 1. Fix faculty source-honesty on live healthy pages

Required outcome:

- `/my`
- `/my/preferences`
- `/my/room-preferences`
- `/my/schedule`

must stop presenting saved-data or degraded wording when:

- runtime context is `enrollpro-verified`
- and the page’s effective data source is live/current

Important:

- do not simply remove degraded banners globally
- retain honest degraded wording when the page is truly on cache-only or mirror-only fallback

### 2. Repair unauthorized `school-years` background fetch behavior

Required outcome:

- eliminate the repeated `401` requests to `/enrollpro-api/school-years` on healthy authenticated faculty/admin pages

Acceptable directions:

- route them through the correct public runtime resolver
- stop calling the raw EnrollPro path from the client if runtime context already owns this concern
- or ensure the correct auth/public transport contract is used

Do not leave these requests firing in the background if they are not needed.

### 3. Repair timetable policy fetch auth drift if it shares the same root cause

Required outcome:

- remove the live `401` call to `/api/v1/policies/scheduling/1/55` from `/timetable` if it is caused by the same auth/bootstrap regression

If the route legitimately requires auth, make the client satisfy that contract.
If the route should not be queried in that phase/path, stop querying it.

### 4. Fix faculty preferences event/update transport

Required outcome:

- `/my/preferences` must not fail its event/update path due to auth or malformed transport
- `GET /api/v1/preferences/1/55/events?...` should either:
  - connect correctly
  - or degrade intentionally and silently without throwing request-failure noise into the page

Do not leave `net::ERR_FAILED` in the healthy normal path.

### 5. Fix faculty room-preferences event/update transport

Required outcome:

- `/my/room-preferences` must not fail its event/update path due to auth or identity mismatch
- `GET /api/v1/room-preferences/1/55/events?...` should either:
  - connect correctly
  - or degrade intentionally without polluting the page with broken-request noise

Do not leave `net::ERR_ABORTED` in the healthy normal path unless it is an expected browser-cancel case that is explicitly handled and non-noisy.

### 6. Fix faculty room-request self-route identity parity

Required outcome:

- the logged-in faculty user must be able to resolve their own room-request latest state through the intended self-service contract

That means reconciling the identity relationship between:

- auth account `userId`
- `facultyId`
- faculty mirror identity
- room-request route authorization checks

The current live `403` on:

- `/api/v1/room-preferences/1/55/latest/faculty/4997`

must either be:

- repaired to the correct self-identity resolution
- or replaced in the client with the proper self route if a better canonical endpoint already exists

Do not leave the product depending on a brittle mismatch between account id and faculty mirror id.

### 7. Preserve existing healthy faculty data behavior

Required outcome:

- keep the current healthy faculty dashboard behavior for `2000056`
- do not regress assignment-bearing dashboard truth
- do not break published schedule visibility on `/my/schedule`

### 8. Update runtime-source documentation

Required outcome:

- update `docs/reference/atlas-runtime-source-of-truth-map.md` for any changed ownership of:
  - runtime context resolution
  - faculty saved/live source labeling
  - faculty event/update transport
  - room-request self-route identity rules

---

## Verification Requirements

### Automated

1. `npm --prefix atlas-client run build`
2. `npm --prefix atlas-server run build` if server routes/services are touched

### Manual / Runtime QA

Use live Tailnet.

Required live checks:

1. Admin login works
2. Faculty login works with:
   - `2000056 / DepEd2026!`
3. `/my` no longer falsely shows saved-data/degraded wording when live truth is healthy
4. `/my/preferences` no longer falsely shows saved-data/degraded wording when live truth is healthy
5. `/my/room-preferences` no longer falsely shows saved-data/degraded wording when live truth is healthy
6. `/my/schedule` remains healthy and honest for published run `126`
7. `/timetable` still loads without the prior crash and without the spurious policy-auth failure if touched
8. browser console/network no longer shows repeated `401` to `/enrollpro-api/school-years` on those healthy pages
9. faculty preferences event/update path no longer shows broken request failure in the normal path
10. faculty room-preferences event/update path no longer shows broken request failure in the normal path
11. faculty self room-request latest contract resolves correctly for the logged-in teacher

If a transport intentionally degrades instead of connecting live, document exactly why and prove the page remains honest and stable.

### Evidence

Append only to `docs/verification/evidence-log.md`.

Include:

- touched files
- which faculty pages were opened on Tailnet
- whether saved-data/degraded wording was cleared when runtime was healthy
- whether `school-years` unauthorized fetches were removed
- whether faculty preferences events were repaired or intentionally degraded
- whether room-preferences events were repaired or intentionally degraded
- whether faculty self room-request identity parity was repaired
- final verdict: `GO` or `NO-GO`

---

## GO / NO-GO

### GO only if

- faculty pages no longer falsely claim saved-data mode while live runtime is healthy
- unauthorized `school-years` noise is gone from the normal path
- faculty event/update transport no longer fails noisily
- faculty room-request self-service identity parity is repaired or properly rerouted to a canonical self contract

### NO-GO if

- faculty pages still visually degrade while live runtime context is healthy
- repeated `401` runtime/background fetches remain in the normal path
- event/update channels still fail noisily
- room-request self-service still depends on a mismatched identity contract

---

## Completion Rule

This pass is successful only if the live faculty objective surfaces become operationally honest:

- live means live
- degraded means actually degraded
- self-service routes resolve to the logged-in teacher correctly
- and background transport failures no longer poison the normal workflow
