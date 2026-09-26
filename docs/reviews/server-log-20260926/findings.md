# Server log review — live `0da104f9` (2026-09-26)

**Source:** `E:/ATLAS-worktrees/lane-a2-release-0da104f9/ops/runtime/logs/atlas-supervisor.log`, from the 19:55
+08 restart to 21:40, read-only; plus an operator-pasted excerpt from 15:35–15:45 +08 (release `400a6909` /
`e4989b72`). By Lane C.

## Verdict

**The original readiness stall is fixed.** That was 3–8 s of synchronous scheduler work inside
`readiness/diagnostic` on every `/timetable` load. Request-attributed loop blocks are now ~240–270 ms. The log
does show three different problems. One of them may be a leak.

| # | Finding | Evidence | Severity |
|---|---|---|---|
| 1 | **Live notification streams only ever go up.** `streams=` climbs 2 → 34 after the 19:55 restart and never falls, although only a few tabs are open at any time (QA runners opened and closed tabs repeatedly). If every page load or reload opens an event stream and a closed tab never releases it, the server accumulates connections until restart. **Suspected leak of the unified notifications SSE stream** (`/api/v1/notifications/:schoolId/:schoolYearId/events`). Verify: open and close one tab 5× and watch `streams=`; check the server's `req.on('close')` cleanup. | log | **HIGH (verify)** |
| 2 | **Every page waits 4–5 s on EnrollPro.** 51× `GET /api/v1/runtime/context 200 ~4050ms` and `rollover-status 304 ~5020ms`. These are the EnrollPro timeouts while its host is down: waiting, not loop blocking. It is still the main reason pages feel slow, and they will stay slow for as long as EnrollPro is down. Consider a short negative cache (e.g. 30–60 s) after a failed upstream check, so pages do not each pay the timeout. | log | MEDIUM |
| 3 | **Unattributed background stalls of up to 2.5 s.** `event-loop-stall blocked ~2536ms … active: none (background work)` at 13:13Z (21:13 +08), and ~1.7 s at 07:45Z (15:45 +08). No request was in flight. Two candidates: host CPU starvation (release builds, test suites, Chrome and Codex QA runs all share this machine; 15:35–15:45 +08 coincides with A2's `400a6909`/`e4989b72` build window, 21:11–21:13 with Lane C's browser runs), or a server timer job. The monitor cannot tell them apart. Add the job name to the stall line, or correlate with host CPU once. | log | MEDIUM (unproven) |
| 4 | **`readiness/diagnostic` still takes ~8.4 s wall time** (`running 8424ms`, `8435ms`) with only ~270 ms of loop block, so it waits on I/O. Likely the same EnrollPro timeouts serialised (2 × 4 s). The `/timetable` readiness line appears late for the same reason. | log | MEDIUM |

## Owner

Findings 1–3 are server runtime work and go to **Planner A**. Finding 4 goes to **A2** (the timetable readiness
path). None of them is a data or correctness defect. Finding 1 is the only one that can degrade the server over
time.
