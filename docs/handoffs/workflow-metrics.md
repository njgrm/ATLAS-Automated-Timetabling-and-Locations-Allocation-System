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

## Train 10 cutover incident — 2026-09-29 19:53 +08 (Lane C)
GO posted ~19:33; live at 19:52 after three attempts. (1) Lane C resumed the wrong OpenCode session (a sub-review
session, found by grepping the log for ses_ ids); it rightly refused. (2) The real A4 session, resumed with a one-line GO,
re-read a 2,600-line channel file and a 6,000-line live-state.md, built the prod tree, then derailed before running
deploy-runner. (3) A third resume with numbered steps finished it. Before that: the walk took three Codex passes because
Chrome cannot reach staging's loopback origin, one prompt quoted a stale number, and the baseline rule was worded too broadly.
**Fixes, standing from train 11:** A4's STAGING post must include its OpenCode session id (`opencode session list` title
"A4 release train N"); Lane C's GO resume uses that id and a numbered cutover prompt (record live-state, dry run,
-Execute, verify served chunk, rollback, post); Lane C verifies the served chunk itself. Walk prompts never quote expected
figures. The baseline rule is "caused or worsened by the train".

## Hotfix #2 false "live" — 2026-09-29 22:35 +08 (Lane C)
Lane C told the operator hotfix f4d34c75 was live after seeing the new chunk on :5174 mid-cutover; the supervisor then
rolled it back (readiness 45 s budget, ~80 s cold start under memory pressure). **Standing fixes:** Lane C says "live" only
after A4's LIVE post AND the Tailnet URL (https://njgrm.buru-degree.ts.net/) serves the new chunk; readiness budget is
now 180 s (8d98628d / 029e5425).

## Workflow changes after the 29 Sep night — 30 Sep 00:02 +08 (Lane C, operator asked)
What went wrong tonight and the standing change for each (all in force now):
1. **Operator decisions got undone by merges** (A5 c8 restored the Teaching Load switches). → `docs/plans/operator-decisions.md`
   is the locked list; planners read it before every merge; each row has a guard test.
2. **Too many planners at once** (10 running, 56/61 GB committed, a deploy failed its 45 s start). → `launch.ps1` refuses a
   launch at 6 running planners or under 6 GB free commit (`-Force` only for A4 deploys); readiness budget 180 s.
3. **Long multi-fix sessions drift and stop early** (~35 of 121 runs needed a relaunch). → **one fix per planner cycle for
   every lane**, not only A7; the prompt names ONE deliverable and ends with an at-most-8-line report.
4. **Stale facts in prompts** (A8 unblock was briefed on 2024-2025 minutes before a rollover to 2025-2026). → Lane C
   re-checks year, term and live SHA with `ctx.cjs`/`term.cjs` immediately before every launch and writes them in the prompt.
5. **"Live" claimed before it was** (hotfix #2). → live = A4 LIVE post + the Tailnet URL serves the new chunk.
6. **Agent config silently ignored** (project `.opencode/agents` never applied; the D:/ATLAS write-deny never worked; a
   DeepSeek launch ran on gpt-5.6-sol). → the global `~/.config/opencode/agents` is the source of truth; every launch
   checks the run header shows the intended model; `rootchk` in status.sh stays the only D:/ATLAS guard.
7. **Rollover paths were never walked** (terms contract, setup-review-required, special-program blockers all surfaced
   only when the operator rolled over live). → every train walk gets a rollover row: fresh year on staging, Generate
   enabled, setup/terms/Teaching Load verified, no false blocker.
8. **Model split.** A7 (Class Schedule) and hard diagnosis (A8 unblock) run on DeepSeek V4.1 Flash; bounded
   server/deploy work stays on space-bunny; Codex walks are the QA signal of record; planner self-QA is advisory.

### Rule 9 (30 Sep 00:25) - re-check the live year before relaying any planner finding
Incident: Lane C relayed A8's "live is on 2025-2026, EnrollPro drifted to 2026-2027" to the operator; A8's restore
predated the operator's 00:05 rollover, and live was already aligned on 2026-2027. Before relaying a finding that names
a year, term or live state, run `ctx.cjs` (verifyUpstream) and state the time of the planner's data next to it.
Staging sign-in note: `/__dev/staging-login` exists only on a `vite` dev preview (e.g. :5277 over the :5101 API), not on
the built staging server :5274.

### Rule 10 (30 Sep 01:12) - retire junctions before removing a worktree
Incident: the shared D:/ATLAS/atlas-client/node_modules was emptied at ~00:34 by a worktree cleanup that recursed through a
node_modules junction; client tests in every junctioned worktree broke silently for ~30 min. Always `cmd /c rmdir
<junction>` (no /s) first, then `git worktree remove --force`; check the donor still has `vite/client.d.ts` after.

### After-demo backlog from the 30 Sep 01:45-02:08 Codex click sweep (not in train 12)
- Year Setup: "Open teaching load" for 2031-2032 lands on `?schoolYearId=4&view=history` showing 2025-2026 (wrong year id); "See what would be copied" disables itself and opens nothing.
- Sections and Subjects summary chips: the (i) help icons do nothing on click (hover-only tooltips); make them click-to-open for touch and mouse users.
- Room Schedules: "Room occupancy sheet" adds two unexplained buttons `11x6` / `13x6` that do nothing visible (page is WIP; redesign later).
- Teacher Preferences: "Load the teacher roster first." shown on entry.
- Sweep coverage gaps: Teachers (0 clicks, browser session collision) and Teaching Load (3 clicks) need a re-run after train 12.

### Double-time rules (30 Sep 06:55 +08, operator: "we desperately need to double time")

Night of 29-30 Sep: 4 trains (11, 12b, 13, 14), but about 3 h lost to dead or waiting work nobody saw, 35-60 min of
overhead per train, and 45-90 min planner cycles for one-line fixes. Rules from train 15 on:

11. **Lane C checks `status.sh` every 15 minutes**, not only on notifications. It now flags `DIED-EMPTY` launches and
    lists pushed `work/`/`fix/` branches not on main. Anything in either list is acted on in the same check.
12. **Planners land their own QA-passed work on main.** "Awaiting Lane C judgement" is allowed only for a HIGH action
    (deploy, generation, publication, live data). A UX candidate that passes QA is integrated at once; Lane C judges it
    on the next train's walk, and a REJECT_UX becomes the next cycle.
13. **LOW fixes skip the planner cycle.** Copy, CSS, layout and label fixes (like the 30 Sep grid wrap and adviser line)
    are Lane C hotfix commits with a test and client tsc, same hour. Planner/executor/QA cycles are for behaviour and data.
14. **Trains run on a clock: every 90 minutes**, from the main tip, carrying what is there. Never hold a train for one
    lane, never restart a build to add a late candidate: it rides the next train.
15. **A4 posts three lines** (pin, migrations, served chunk + live PIDs) and nothing else. Before every build it
    reclaims old staging trees if E: is under 25 GiB, and after every staging deploy it runs
    `ensure-staging-qa-account.cjs`. Staging and GO may run in one A4 session when Lane C has posted GO in advance
    conditional on the walk.
16. **At most 4 planners, on pages that do not overlap** (e.g. timetable / Teaching Load / Sections+Rooms /
    Subjects+Teachers). Two planners never edit the same page in the same hour; queue the second.
17. **Walk before build where possible.** Planners attach a staging-preview screenshot of the changed page at
    1366x768 to their post; Lane C rejects clipped text, raw codes or extra confirms from that screenshot before the
    train, so a train walk only finds regressions, not first looks.
18. **Launcher prompts are single-line** (`launch.ps1` now collapses newlines and strips `< > | & ^ %`).
19. **Never cut over without a built server (30 Sep 10:21, train 19: 4 min of 502 during the demo).** A4 ran
    `tsc --noEmit` and recorded it as the server build, so `atlas-server/dist` was empty and the API never started.
    Every A4 prompt now says: run `npm run build` in atlas-server and atlas-client, then assert
    `atlas-server/dist/server.js` and `atlas-client/dist/index.html` exist and the dist file count matches the live
    tree before the dry run; if not, stop. `release-live.ps1` (A4 fast-deploy) must make this a hard gate.

| 2026-09-30 · A2 · move-swap c2 | decision 12 | — | 0 | 3 | 1 | 1 | awaits Train 22 | `8c1b9218` is on main; menu removal is explicitly out of scope and needs a bounded follow-up. |
| 2026-09-30 · A5 · unassigned panel | decision 12 | — | 0 | 1 | 0 | 1 | awaits Train 22 | `22b34170` is on main; independent QA 15/15, rendered browser row remains unperformed. |
| 2026-09-30 · A6 · placement feasibility | decision 14 | — | 0 | 1 | 0 | 3 | awaits Train 22 | `8766c084`/`fffa830c` are on main; QA caught two refusal-surface corrections; rendered row remains unperformed. |
| 2026-09-30 · A8 · Makabansa cause | decision 14 | — | 0 | 0 | 0 | n/a | none | Read-only finding: run 359 has zero hard/unassigned; generator repair remains a separate T3 packet. |
