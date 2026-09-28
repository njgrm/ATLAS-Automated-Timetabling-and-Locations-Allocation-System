# A8 packet: server event-loop stalls and leaked live-update streams (demo-critical)

Issued by Lane C, 2026-09-29 06:55 +08. MEDIUM tier; HIGH if you touch auth or SSE contracts. Fresh session.

**Evidence (live, `ce1257c8`, log `E:\ATLAS-worktrees\lane-a4-release-20260929-5\ops\runtime\logs\atlas-supervisor.log`):**
- `[event-loop-stall] blocked ~2.4 s` about every 4 s with `active: none (background work)`, while nobody uses live.
- Stall counts per hour (UTC): 16Z 74, 17Z 152, 18Z 107, 19Z 94, 21Z 51, 22Z 80.
- `streams=` climbs 8 → 21 → 26 and never falls. Live-update (SSE) connections look leaked.

**Evidence (staging, `24e268fb`, `E:\ATLAS-staging\24e268fb…\ops\runtime\logs\atlas-supervisor.log`, 22:4xZ):**
- 29 stalls and 39 slow requests.
- `readiness/diagnostic` took 93 s, and one ended in 500 P1001.
- `sections/summary`, `runtime/context` and `subjects/scheduling-authority` took 8–12 s.
- The client then showed "Verifying session…" forever, "no live Teaching Load source is available", and an empty Subjects table. The Codex staging walk failed train 6 on these.

**Do:**
1. **Find what the "background work" is, with measurement, not guesses.** Candidates: a per-stream timer or poll whose cost grows with open streams; term-cache or EnrollPro re-verification; sync fan-out. Use `--cpu-prof` on a disposable copy, or add timing, on a loopback server pointed at staging data. Do NOT restart or profile live.
2. **Fix the stream leak** so a closed tab frees its stream: close on `req` `close`/`aborted`, add a heartbeat timeout, and cap streams per user.
3. **Take the background work off the event loop,** or make it proportional to real change, not to stream count. Heavy reads the UI waits on (`readiness/diagnostic`, `sections/summary`, `runtime/context`, `scheduling-authority`) must answer in under 1 s at demo scale (20 teachers, 20 sections).
4. **Failing-first tests:** a leaked stream is released; background work per tick does not scale with the stream count.
5. Measure before and after on the loopback server: stalls per 10 min at 0 and 26 streams, and p95 of the four routes. Record the numbers.

**Rules:**
- No live restarts. Only A4 deploys.
- Start any preview only with `scripts/dev/start-preview.ps1`. A shell call must return.
- One fresh QA, then merge to main. Post `A8 ready for release at <sha>`, with the before and after numbers, in `docs/handoffs/lane-a-to-c.md`.
- Do not end the run on your own next action.
