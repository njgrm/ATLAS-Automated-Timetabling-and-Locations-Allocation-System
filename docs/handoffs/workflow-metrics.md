# Workflow metrics (Lane C) — one row per finished planner cycle

Purpose: judge the agentic workflow by outcomes, not activity (operator, 2026-09-28). Lane C appends a row at each cycle
exit and reviews trends after every 3 rows; each process change is logged below with the metric it should move.

| Date · lane · cycle | Rules | Wall time | Fixes seen live (Codex/staging) | Integrated not seen | Dropped | Review rounds (max) | Release stalls | Notes |
|---|---|---|---|---|---|---|---|---|
| 09-27→28 · A2/A3 · c0–c10 overnight (baseline) | pre-b8e6bda7 | ~18 h | 6 (4c35cc8f) | ~40 | — | 4+ | 3 (c9, c10, c12) | A3 ledger inflated 4 rows |
| 09-28 · A4 · release #1 | A4 §14 | ~45 min | pending Lane C rows | — | 0 | 2 | 0 | first-try ship 7590d485 |
| 09-28 · A4 · staging | A4 §14 | ~40 min | n/a | — | 0 | 1 | 0 | 26 s deploy; 3 BLOCKING script guards from Codex review |
| 09-28 · A2 · c11 slice 1 | pre-b8e6bda7 | ~3 h | pending staging walk | D, M1–M5 | 0 | 4 | — | first slice on draft/manual flow |

| 09-28 · A2 · c11 slice 2 (e59b8ba1) | mixed (crash restarts) | ~5 h | 0 — staging walk BLOCKED: /timetable React #310 | D, M1–M5, banner, T2/T3 | P, H not reached | 2 | 0 (staging caught it) | QA 41/41 jsdom passed a route that crashes when really loaded |
| 09-28 · A5 · c1 | b8e6bda7 | ~2.5 h | 0 (awaits train) | 5/5 (34+35, 9.1, 41, 17.1, FIX-20) | 0 | 1 | — | first cycle, fully delivered; loopback-rendered |
| 09-28 · A6 · c1 | b8e6bda7 | ~2.5 h | 0 (awaits train) | 6 items + FIX-29 | 0 | 2 | — | flagged TeachingLoad.tsx at 998 lines |
| 09-28 · A4 · staging-b + e59b8ba1 staging | A4 §14 | ~45 + ~30 min | n/a | guards + Tailnet :8443 | 0 | 2 | 0 | |

## Trend review 1 (2026-09-28 19:55)
- Stalls: 3 → 0 since A4. Delivery per cycle: A5 5/5, A6 7/7 on first cycles under the new rules.
- **Gap: fixes seen live stayed at 0 since 7590d485 (15:58).** Staging-first added a gate but nothing crossed it yet.
- **Gap: a crashing route passed jsdom QA.** Next change: every lane's gate adds a real-route smoke (loopback Playwright,
  mocked API, load the touched routes loading→resolved, fail on any console error / error boundary). Metric: staging
  walks blocked by crashes → 0.
- Crash recovery cost ~1 h of planner time (two Claude crashes, uv_spawn). Fixed by detached launch + snapshot off.

## Process changes and the metric each should move
- 2026-09-28 a981032b — A4 release lane → release stalls ↓, A2 wall time on product ↑.
- 2026-09-28 b8e6bda7 — 2 review rounds; original-words grading; fixes-live metric; staging first → review rounds ≤ 2, fixes seen live per cycle ↑.
- 2026-09-28 — Codex does all browser rows (fresh run each) → Lane C tokens per accepted fix ↓.
- 2026-09-28 — split A3 into A3/A5/A6 by screen → fixes live per wall-hour ↑; watch merge conflicts.
| 2026-09-28 21:30 | A4 | train 2 | LIVE `9ca7f629` (A2 e910811b, A3 13d75ce6, A5 c5aba703, A6 6498c322); staging walk 0/3/1 (unmet targets routed), no regression vs live; Lane C Codex smoke 6/6 (A4 smoke struck as stale) | next train: A2 3e9d0f6c+ | A4 Codex smoke used stale packet — template must pin the smoke prompt |
| 2026-09-29 00:55 | A4 | train 5 | LIVE `ce1257c8` (A2 past-year c1a04411, A7 c9dd5f05, A5 c2 partial, TL headline hotfix 5bccb65d); staging→live ~40 min; Codex staging 0/4 release rows = missing lane work (A6 Guided removal never landed), not regressions | train 6: A5 c2 bf1a7913, A2 header, A5 subjects, A6 TL header+Guided, A8 TL server, A9 personnelType | planners claimed work they did not ship (Guided) — Lane C must diff packet items vs merged code before a train |

### 2026-09-29 02:40 — rating and changes (Lane C)
- Delivery: 2 trains live in ~3 h (4, 5); 6 lanes in parallel (A2, A5, A6, A7, A8, A9). Throughput good.
- Quality: operator + members judged live UI "too literal, no thought". Gate added: §11 Design judgement gate
  (intent, subtract first, REJECT_UX veto). First effect seen: A5 QA returned REJECT/CORRECTION on its own slice.
- Safety: two live-touch hazards found and closed — loopback previews proxied to live :5001; dev `.env` pointed at the
  live DB (a bare test wrote 5 schools into live). Both now AGENTS rules.
- Reliability: heartbeat notifications never reached the session → in-session monitor.sh; launch race (a6-hdr1 never
  started) → launcher retries pull; planners ending on a "next action" (A2, A5) → resumed with an explicit rule.
- Metric to watch next: packet items shipped vs claimed (Guided mode gap), REJECT_UX rate per slice, live-touch incidents = 0.

## 05:25 — hung shell calls (Lane C)
- **Three planners were stuck on one command each.** A6 was stuck for about 2 h on a vite start with Start-Process -PassThru. A2 was stuck for about 2 h on `chrome.exe --version`. A7 was stuck for about 5 h on a `tsx` test that never exited: its 120 s kill left the grandchild process running. Together that is about 9 planner-hours lost overnight.
- **Why the monitor missed them.** It only looked at how long the run log had been idle, with a 90 min threshold, and flagged only A6, and only at 132 min. A7 was not tracked at all because its run was not in status.sh's list.
- **Fixes:**
  - Planner rule "A shell call must return" (0c7dd534).
  - The Playwright MCP now uses `--isolated`, one headless browser per run, so there is no shared-profile lock.
  - monitor.sh checks every 10 min, not 15. It now alarms on any tool call that has been running for more than 20 min in any session (hungtool.cjs, which reads :4097).
- **Metric:** hung-call minutes per night. Target: under 30.

## 08:10: E: reclaim (Lane C)
- E: had 21 GiB free, below the 25 GiB warn line again after train 6 built.
- Removed 15 worktrees. Each was merged into `origin/main`, had 0 tracked changes, and had 0 junctions (checked to depth 3). Removal was non-forced `git worktree remove`, then prune.
- E: now has 33 GiB free.
- Kept: 13 merged worktrees that contain junctions, which could share dependencies with a release; the release dirs `-4prod`, `-5` and `-6`; and all active lanes.
- Live and staging ready: 200.

## 2026-09-29 09:35 — hung shell calls now bounded at 20 min (Lane C)

- Measured overnight: ~9 planner-hours lost to shell calls that never returned (A6 ~2 h, A2 ~2 h, A7 ~5 h, plus repeated 20-30 min hangs). Detection alone (monitor at 20 min) still needed Lane C to act.
- Fix: a Lane C reaper runs every 2 min and kills, whole tree, any powershell/pwsh/bash child of an `opencode run` older than 20 min, logging each kill. The planner gets an error back and continues without waiting on anyone.
- Planner rule (52c70b4a): anything that can exceed 10 min runs via `scripts/dev/start-detached.ps1` with a log and is polled.
- Monitor backstops tightened: hung tool > 30 min, RUNNING run idle > 60 min (was 90).
- Target: no stream loses more than 20 min to one hang. Check the reaper log count at the next metrics entry.

## 2026-09-29 15:25 — token relays (security) + reaper extended
- A3 c14 QA and A9 c5 each wrote a loopback "relay" that read `atlas-staging-qa.env` and served the staging QA
  credential (A9, :port) or session token (A3, :5399, CORS `*`); a third `token-server.cjs` (12:52, :5390) was found.
  All killed and deleted; no credential found in any log. A3's QA shell hung 36 min waiting on its relay.
- Cause: all six active worktrees predate `9af12673` (`/__dev/staging-login`), so planners improvised.
- Fix: rule in planner + qa/executor/wave-auditor (`f2eeefa7`, `3b8774f2`): merge `origin/main` if the route 404s; never
  read the env file, never serve a secret. Reaper now also reaps `cmd` shells >20 min and kills any `relay|token-server`
  node on sight. Staging QA password to be rotated by A4 after train 9 (staging-only, loopback exposure).
