# Runtime acceptance matrix — release `6e9c87e7`

- **Target release:** `6e9c87e7` (live; `E:\ATLAS-runtime-supervised-6e9c87e7-20260924`)
- **Origin:** `https://njgrm.buru-degree.ts.net` (asserted on every row)
- **Session:** the acceptance used an **already-authenticated** admin/officer session; **this lane entered no credentials** (no login form appeared on any navigation). **Correction (QA B1):** the earlier "no fresh login" wording was **false and is superseded**. `audit_logs` id **932** records a `LOCAL_LOGIN_SUCCESS` (actor 46, role officer, `127.0.0.1`, Chrome) at **2026-09-23T16:38:57.960Z** — after the 16:23:04Z cutover and **outside this lane's flow**. **Attribution resolved: the operator confirmed it was their own login (authorized).**
- **Controller:** elevated OpenCode (single browser profile)
- **Viewports:** `1366×768` and `390×844`
- **Method:** read-only navigation only; no Save / Apply / Generate / Publish / Delete

## Release identity
- Served entry `/assets/index--ZHwcC0J.js`, SHA-256 `917E98F0…830A` — **byte-identical** to the build.
- Machine `ATLAS_RUNTIME_SOURCE_DIR` / `ATLAS_RUNTIME_RELEASE_SHA` = the target.

## Route matrix — desktop `1366×768`
| Route | Rendered signal | Global scroll | App console errors |
|---|---|---|---|
| `/` Dashboard | `Scheduling Dashboard` | none | 0 |
| `/sections` | `Sections` | none | 0 |
| `/subjects` | `Subjects` | none | 0 |
| `/teachers` | `Teachers` | none | 0 |
| `/teaching-load` | `Teaching Load` | none | 0 |
| `/map` Campus & Rooms | `Campus and rooms` | none | 0 |
| `/map?mode=editor` | `Campus map editor`, `Building summary` | none | 0 |
| `/timetable` Class Schedule | `Class Schedule`; `TERM 2 (active)`; terms list | none | 0 |
| `/timetable/runs` | `Runs` | none | 0 |
| `/timetable/policies` | `Scheduling Policy` | none | 0 |
| `/timetable/exports` | `Exports` | none | 0 |
| `/schedules` Room Schedules | `SCHEDULES`; `98 rooms available`; `Export CSV` | none | 0 |
| `/room-schedules` | same Room Schedules page | none | 0 |
| `/audit` | `Needs fixes before scheduling`; `5 domains | Blockers: 67 | Warnings: 0` | none | 0 |
| `/admin/year-setup` | `School Year Setup` (admin-only copy) | none | 0 |
| `/faculty/room-preferences` | `SCHEDULER ROOM REQUEST QUEUE` | none | 0 |
| `/my/room-preferences` | `Room requests`; `60 classes · 0 pending` | none | 0 |

## Mobile `390×844`
`/`, `/timetable`, `/teaching-load`, `/schedules`, `/audit`, `/faculty/room-preferences`, `/my/room-preferences` — all render with `main` present and **no global scrollbar** (`scrollWidth`/`scrollHeight` ≤ viewport). No app console errors.

## Ceremony-over-class fix (live)
`/timetable`, Monday cell: `Flag Ceremony / Homeroom Guidance` rendered **above** the class entry — `SCIENCE · R. Santos · Room 103 · G7AW`. Grid present. (Verified `1366×768` and `390×844`.)

## Planner B collaboration (live)
- `/timetable` and `/faculty/room-preferences` open the WebSocket `wss://njgrm.buru-degree.ts.net/api/v1/room-preferences/collaboration/ws` — **opened**, no socket errors.
- Publication-approval inbox **not exercised**: it is gated `canApprovePublication = (userRole === 'scheduler')` (`useScheduleReviewWorkspaceState.ts:1923`); this admin/officer session correctly hides it. Needs a scheduler-role session.

## Console failures (host/proxy layer, NOT the release)
Observed `502` on `manual-edits`, `runtime/rollover-status`, `follow-up-flags`, `room-preferences/collaboration/ticket`, and `notifications/:id/events` (the last also `net::ERR_HTTP2_PROTOCOL_ERROR`, SSE). **Direct `localhost:5001` probes of all five return `401`** (server reachable, auth required) → the failures are the known **unowned host/proxy layer**, not the server. (The `404`s in the console are this lane's own earlier GET re-probes of a POST route.)

## Rows not exercised
- Publication-approval inbox (scheduler-role gated).
- Any mutating flow (Save/Apply/Generate/Publish/Delete) — out of scope for acceptance.

## Verdict
**PASS** for the deployed release: every exercised route renders on both viewports with no global scrollbar and no app-level console error; the ceremony fix and the collaboration WebSocket are live; release identity is byte-exact. Residual: the host/proxy 502 + HTTP/2 layer (unowned, pre-existing) and the scheduler-role publication-approval surface (unexercised).
