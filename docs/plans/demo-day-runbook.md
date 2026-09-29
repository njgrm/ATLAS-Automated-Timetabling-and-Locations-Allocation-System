# Demo-day runbook — Wed 2026-09-30 (Lane C)

Why: live's event-loop stalls (up to 30 s) happen with the server idle (heap ~35 MB, no active work) while planner
builds, tests and headless browsers load the host (A8, 2026-09-29, `6a496cbd`). The demo host must be quiet.

## T-60 min
1. Freeze releases: no A4 train after T-120. Live SHA recorded here: `________`.
2. Stop every planner run and Codex job Lane C started (by recorded PID only), and the reaper/monitor loops.
   No `tsc`, builds, test suites or Playwright on the host until the demo ends.
3. Raise the live runtime's priority: the node processes under the supervisor for ports 5001/5174 ->
   `AboveNormal` (reset by any restart; re-apply if the supervisor restarts).
4. Health: `/api/v1/health` 200 on 127.0.0.1:5001 and on the Tailnet origin; the log window shows no
   `event-loop-stall` over 500 ms for 10 min.

## T-30 min — data the story needs (live, active year)
- Exactly 1 active school year mirror; 0 fixture ids 900000–999999 (AGENTS.md §14).
- Teachers list shows teaching staff only.
- A generated timetable exists for the active term, so Timetable review, Room Schedules and print have content.
- At least one teacher has concerns recorded, including a room need.

## Story order (side menu)
School Year -> Subjects -> Teachers -> Teacher Concerns -> Teaching Load -> Timetable -> Look up & print schedules.

## If something goes wrong
- A page stalls: wait 5 s, reload once; do not click repeatedly.
- Live down: the supervisor restarts it; the release dir named in the Machine env `ATLAS_RUNTIME_SOURCE_DIR` is the
  running build. Roll back only via A4's harness.
