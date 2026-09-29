# Lane C overnight manager — standing handoff (read this first, every cycle)

Written 2026-09-27 22:40 +08. Each review cycle runs in a **fresh-context reviewer subagent** (`atlas-reviewer-high`, Opus 5.5 · high) that the
relay session (the operator's Claude desktop session, bypass permissions) dispatches when a planner run exits. The
reviewer reads this file, does one cycle, updates the Cycle log and returns a short verdict plus the `DISPATCH:` line.
The relay runs the dispatch in the background, so the next exit wakes it. Hourly heartbeat at :17 in the relay.
(`claude -p` is not usable here: the CLI is not logged in and does not know Opus 5.5, tested 2026-09-27 22:45.)

## Mandate (operator, 2026-09-27 night, in chat)

- **Goal:** the full ATLAS demo on **Wednesday 2026-09-30**. Keep chaining packets until the operator says stop.
- Lane C takes the operator's place for **judgement calls and QA**. **UX/UI weighs as much as function:** older,
  mouse-first schedulers must find ATLAS easy and intuitive. Grade by the rubric: fewer words, one verb per action, a
  visual cue beside every status, less is more.
- **Authorized:** deploys (A2 only), draft edits, generation, **publish**; live data is test data. Every gate is
  retained (`AGENTS.md` §11/§13; standing authorization removes waiting, never evidence).
- **Out of bounds:** EnrollPro/SMART/AIMS writes (READ_ONLY), `ATLAS_SYSTEM_TOKEN`, pushing
  `fix/committed-credential-scrub-20260926`, history rewrites.
- **Codex YOLO (Terra 5.6)** may take browser QA or other bulky tasks to save tokens. Invocation: memory
  `codex-cli-second-browser-runner.md` (`codex exec --json --dangerously-bypass-approvals-and-sandbox …` with
  chrome-devtools MCP). After each Codex run, check `git -C D:/ATLAS status --short`.

## The lanes

| Lane | Surface | How it runs | Deploys |
|---|---|---|---|
| A2 | timetable + every release | **elevated**: `env -u OPENCODE_SERVER_PASSWORD opencode run --attach http://127.0.0.1:4097 --dir 'D:\ATLAS' --agent atlas-planner "<prompt>"` (the operator's admin `opencode serve`, no password, localhost only) | yes, the only one |
| A3 | non-timetable UI/UX | `env -u OPENCODE_SERVER_PASSWORD opencode run --dir 'D:\ATLAS' --agent atlas-planner "<prompt>"` | no; A2 ships A3's integrated work |

Rules for the planners:
- **Always pass `--agent atlas-planner`.** It pins opencode-go/space-bunny-free, variant high. The default agent routes
  to glm-5.3, which the provider refuses.
- **Start every new packet in a FRESH session.** Never `--session`/`--continue`; OpenCode sessions degrade as their
  context grows.
- `opencode run` exits 0 even on a model error, so judge a run by its output tail and by `origin/main`.
- Inspect a planner without touching it: `opencode session list -n 6`, `opencode export <id>` (parse JSON; read the
  last assistant text only).
- Browser custody between A2 and A3: `E:/ATLAS-worktrees/.browser-lock` (`<lane> <ISO time> <purpose>`, 45 min stale).
  The Lane C Chrome profile is separate (Claude in Chrome, `atlas-browser-qa` agent); the Codex chrome-devtools profile
  is separate again.

## A review cycle (what the fresh reviewer subagent does)

1. `git fetch`; read this file, then `docs/plans/live-state.md` → Live release, the finished lane's overnight handoff
   (`docs/handoffs/planner-a2-handoff-2026-09-28-overnight.md` or A3's ledger "2026-09-28 overnight"), and the new
   entries in `lane-a-to-c.md` / `lane-c-to-a2.md`.
2. **Verify against the live Tailnet** (`https://njgrm.buru-degree.ts.net`): `/api/v1/health`, the public matrix
   `/api/v1/schools/1/schedules/published?date=2026-09-20|25|26|27|28`, served chunk names for claimed releases.
   Spot-check the lane's claims with browser QA (Codex or `atlas-browser-qa`, one flow per run with exact steps), with
   **ease-of-use grading** for every surface touched, not just pass/fail.
3. **Judge:** accept, or send it back with corrections. Record every verdict in `docs/handoffs/lane-c-to-a2.md`,
   newest first, with evidence.
4. **Write the next packet** for that lane in `docs/prompts/overnight-<lane>-<yyyy-mm-dd>-c<N>.md`: the remaining
   work toward the demo, biggest-value first, the same authority/coordination blocks as the c0 packets
   (`overnight-a2-timetable-2026-09-27.md`, `overnight-a3-ui-ux-2026-09-27.md`), and a ≤ 15-line final message
   contract. Push it to `origin/main`.
5. Append one Cycle-log row below and push. **Do not dispatch the planner yourself**; print the exact dispatch
   command as the last line of your output, prefixed `DISPATCH:`. Print `DISPATCH: none` when the lane should stop
   (say why).

## Demo-readiness backlog (keep this current)

- Objective (`live-state.md` → Objective): correct Teaching Load; a dynamic, term-aware timetable; realistic official
  exports; zero HARD publication blockers; SMART-family visual cohesion across the whole site; direct two-way SSO with
  EnrollPro/SMART/AIMS (companion-blocked: record, do not attempt).
- Timetable findings #1–#64: `docs/reviews/timetable-manual-controls-20260926/findings.md`. Inventory:
  `docs/reviews/timetable-control-inventory-2026-09-26.md`.
- A3 ledger: `docs/handoffs/planner-a3-non-timetable-ui-ux-handoff.md`.
- Before Wednesday: a **demo walkthrough script** (the operator's path through the product) walked end to end on live,
  graded for older users, with every stumble fixed or listed.

## CHECKPOINT 2026-09-29 01:15 (supersedes earlier checkpoints)

**LIVE `c9be17fe` (train 4)** since ~00:40: grade-name hotfix + A2 24c6242c + A6 5481dcc + A3 13d75ce6. Luna smoke 3/3
(TL suggestion 2022-2023 = 264 rows). Rollback `9ca7f629`. **Next train candidates:** A2 6d034431 (index), A7 c9dd5f05
(School Year Setup plain words) + A7 c2 (past years list/Keep as history/read-only links, running `a7-c2`), A2 past-year
view (running a2-c12r6; its TEST HAS AN INFINITE LOOP - reached 15 and 37 GB, crashed dwm/Brave/Codex; posted to A2).
**01:20 update:** Codex applied TL 2022-2023 on live (239 assigned, 25 substitutes, 11 over 30h). Timetable GENERATE DISABLED:
468 setup blockers (docs/reviews/codex-live-year1-flow-20260929.md). Lane C executor (hotfix-newyear-readiness) diagnosing:
code bug vs per-year setup to inherit (year 1 has 0 grade_shift_windows vs 20 in year 10) vs operator decisions; also the
wrong zero-demand headline with 264 rows. Rollovers stay PAUSED until year 1 can generate.

**Codex job running (bfld2f932 waiter, terra@medium):** on LIVE applies TL, generates, publishes 2022-2023 + older-user UX
review -> scratchpad/codex-qa/live-year1-flow/report.md. Then route findings, then operator does next EnrollPro rollover
(Preview + Sync now; Lane C verifies with sy.cjs / fcheck.cjs).
**Memory guard:** scratchpad/memguard.ps1 runs DETACHED (CIM, hidden), kills node >4 GB private (not server.js/staging/a4
release), log memguard.log. Check commit charge before Codex runs.
**Lanes:** A2 a2-c12r6 (past-year view; P parked), A3 a3-c12r, A5 a5-c2r3, A6 a6-c3 (Guided mode removal first), A7 a7-c2.
Waiters: re-arm with await.sh after restart. Heartbeat every 15 min with notifyOnCompletion (re-arm after restart).
**Operator artifact:** https://claude.ai/artifact/EQ6Zas4FD6GZHpu29TwjVv (update: train 4 items now live).

## CHECKPOINT 2026-09-29 00:25 (supersedes earlier checkpoints)

**Live** `9ca7f629` (train 2). **Train 4 `c9be17fe`** (main 60e58567 + A3 13d75ce6: A2 24c6242c header/draft, A6 5481dcc,
Lane C grade-name hotfix 938de8aa) passed staging 4/4 (TL suggestion 264 rows) -> **a4-train4-prod running** (session
ses_f17acda30ffea6RmHSKhymLKZE). On LIVE: luna smoke, then tell operator "live" -> operator reruns TL suggestion 2022-2023,
generate, publish, then EnrollPro rollovers (paused until then; operator confirms each; ATLAS auto sync is OFF -> operator
presses Preview + Sync now per year; Lane C verifies each year: sy.cjs / fcheck.cjs in scratchpad).
**EnrollPro reset:** school year IDs now 1.. (ATLAS keeps 8-10 as history; 9,10 not archived and invisible -> A7 fix, then
operator archives on screen). Teacher IDs reset: live+staging faculty external_id offset +1e6 (backups in
D:/ATLAS-runtime-config/backups/faculty-id-offset-20260928/); 23 teachers re-linked by employee_id, 23 old stale. AP subject
repaired (rotation null, grades 7-10). EnrollPro active-term API says T3 (all 2022-23 terms past) - EnrollPro-side.
**Lanes running:** A2 a2-c12r6 (past-year read-only timetable /timetable?schoolYearId=; P parked till after demo; 6d034431
ready), A3 a3-c12r (Dashboard scroll, map inspector), A5 a5-c2r3 (EnrollPro timeouts: TL blank 30 s; notifications year
labels; OWNER_DEPT codes), A6 a6-c3 (remove Guided mode FIRST, counts 23 vs 20, T5 double amber), A7 a7-c1 (School Year
Setup plain words + list all past years + read-only links). Routing posts in lane-c-to-a2.md 22:55, 23:05, 23:20.
**Codex:** luna@medium for fixed steps, terra@medium for UX walks; never save Subjects/setup/policy on live.
**Heartbeat:** every 15 min, notifyOnCompletion (re-arm after restart); status.sh flags STUCK-SERVER and filters cmd.exe PIDs.
**Operator artifact:** fix-docs QA checklist https://claude.ai/artifact/EQ6Zas4FD6GZHpu29TwjVv (republish from
scratchpad/atlas-fix-docs-qa.html when train 4+ lands).

## CHECKPOINT 2026-09-28 20:30 (supersedes earlier checkpoints)

PC rebooted ~20:15. Live `7590d485` and staging came back on their own; admin serve on :4097 restarted by the operator WITHOUT a
password (a password-set serve gives 401 to our launches). Lanes resumed in their own sessions via
`launch.ps1 -Session <id>`: a2-c12r (ses_f183ec69…: header ≤2 rows, then speed), a3-c12r (ses_f1819474…: Dashboard + demo-walk
items), a5-c2r3 (ses_f1814066…: EnrollPro root cause + 2 blockers), a6-c2r (ses_f1836d61…: Teaching Load header spec).
**Train 2 running:** a4-train2-stg = release/2026-09-28-2 from main tip (A2 e910811b #310 fix, A5 c5aba703, A6 6498c322) + A3
13d75ce6 (local-only commit) → STAGING only. Next: Codex walks staging (A2 c11 targets + A5/A6/A3 rows, prompts in
scratchpad/codex-qa/stg-a2walk and fixdocs), then A4 ships to production, then Codex smoke, then tell the operator it is live.
Heartbeat task `atlas-planner-heartbeat` (every 30 min) survives restarts. Waiters must be re-armed after any Claude restart:
`bash scratchpad/await.sh <run>` for each RUNNING run in `bash scratchpad/status.sh`.
Lesson: exit 0 with no final message = the model ended its turn on a statement of intent → continue the same session.

## CHECKPOINT 2026-09-28 20:00 (supersedes earlier checkpoints)

Live `7590d485` (rollback `4c35cc8f`). Staging `e59b8ba1` (BROKEN: /timetable React #310) at http://127.0.0.1:5274 and
https://njgrm.buru-degree.ts.net:8443. Lanes: A2 timetable · A3 Sections/maps/Dashboard · A5 Subjects+shared tooltip ·
A6 Teachers/Teaching Load · A4 release+staging (elevated, :4097, restarted 19:00 with new config). AGENTS rules added today:
A4 §14, Throughput rules §11 (2 rounds, original words, fixes-live metric, staging first, real-route smoke 30074e02).
Launch: `scratchpad/launch.ps1 -Name <run> -Prompt '<no double quotes>' [-Elevated]` (detached); wait
`bash scratchpad/await.sh <run>` (background); status `bash scratchpad/status.sh`; heartbeat scheduled task
`atlas-planner-heartbeat` every 30 min notifies this session. Codex: `codex exec --dangerously-bypass-approvals-and-sandbox
--skip-git-repo-check -o final.md "<prompt>" < /dev/null`, @Brave "Your Brave" (live signed in 7 d; staging signed in on 5274).
Running: a2-c12b (fix #310 first, then H 2 rows, then P speed) · a3-c11r2 (c11 + FIX-06/08/12) · a6-c2 (Teaching Load
header spec 19:05) · Codex demo-path walk (non-timetable pages → A5 c2 backlog).
Ready, waiting for the train: A5 `c5aba703`, A6 `6498c322` (both on main). Next train: when A2 posts the #310 fix →
A4 deploys main tip to staging → Codex walks A2 targets + A5/A6 rows → A4 ships to production → Codex smoke.
Metrics: `docs/handoffs/workflow-metrics.md` (trend review 1 at 19:55). Demo: Wednesday 2026-09-30 morning.

## CHECKPOINT 2026-09-28 11:25 +08 (read this first)

- **Live** `a1db27d5` (health 200). The admin `opencode serve` on 127.0.0.1:4097 is still on **120 steps**; restart it
  (ask the elevated server to spawn a fresh `opencode serve --hostname 127.0.0.1 --port 4097` with
  OPENCODE_SERVER_PASSWORD unset, then exit) **when nothing is busy on it** (`/session/status`), then verify 250.
- **Running:** A2 c7 (`docs/prompts/a2-timetable-2026-09-28-c7.md`, **local non-elevated** run); A3 c9
  (`docs/prompts/a3-ui-ux-2026-09-28-c9.md`, root `ses_f1a382ebbffejFnOMHQvaLcx8s` on :4097); the duplicate-teacher
  diagnostic (on :4097). Re-arm the watcher: `python <scratchpad>/planner-watch.py <root ids>` (`opencode session list`).
- **Queued:** A3 c10 (`a3-ui-ux-2026-09-28-c10.md`, from the original-criteria scorecard, after c9). After A2 posts
  "ready for release": an **elevated** A2 packet for the E: reclaim (operator-authorised: every release dir except
  `a1db27d5` + `d31bfacb`, plus `4893cbde`), build, cutover, then Lane C live rows (B11, B16, B20, B22, A3's rows, the
  scorecard items).
- **Waiting on the operator's answer:** give load to the 4 zero-load teachers only after the duplicate check (Reyes,
  Maria Angela and Garcia, Anna Patricia may be duplicates). Auto-assign ("Preview suggested assignments") proposes
  nothing when every class is staffed: an A3 UX bug.
- **Also do after A2's run:** set `JWT_EXPIRES_IN=7d` in `D:/ATLAS-runtime-config/atlas-server.env` (back up the file,
  restore its ACL byte-identical) and restart live (operator decision C). A real remember-me waits until after Wednesday.
- Evidence: `docs/reviews/lane-c-overnight-20260928/findings.md`,
  `docs/reviews/fixes-original-criteria-audit-20260928/scorecard.md`.

## Operator decisions carried (2026-09-28)

- **Sessions:** option C now — `JWT_EXPIRES_IN=7d` in `D:/ATLAS-runtime-config/atlas-server.env` (the default in
  `local-auth.service.ts:10` is `8h`) plus a live restart, done by Lane C through an elevated maintenance task **after
  A2's current run**, with the env file backed up and its read-only ACL restored byte-identical. **Option A** (a real
  "remember me": about 1 h access tokens, a hashed, rotating, revocable 30-day refresh token in an HttpOnly cookie, a
  migration) is **after Wednesday 2026-09-30**; then remove the 7d setting. Until then planners do only the work that
  completes ATLAS for the demo.
- The admin `opencode serve` restarts after A2's current run to load `steps: 250`.

## Cycle log (newest first)

| When (+08) | Lane | Run / session | Verdict | Next packet | Notes |
|---|---|---|---|---|---|
| 2026-09-28 07:00 | A2 | c4 (`a1db27d5` LIVE; D 9/9, QA 13/13) | accept deploy; acceptance incomplete: B9–B22 NEEDS_SESSION in both profiles (L1) | none until the operator re-seeds sessions | A3 c6 running (remaining non-timetable routes) |
| 2026-09-28 05:55 | A2 | c2 (`a32a577a`; UX batch + #62 integrated; `a1db27d5` staged) | accept; its 06:30 self-stop and narrowing of the publish grant overruled | c3: ship `a1db27d5`, A3 c4 rows, #52/#53 prop, the walkthrough | live `d31bfacb` unchanged, health 200 |
| 2026-09-28 05:05 | A3 | c4 (`ed14720c`, `fa37a7c1`) | accept; #52 and the #53 occupancy prop handed to A2 | c5 small: subjects stats, worktrees, morning brief | A2 c2 was HUNG 02:33–05:00 on an orphaned review server (PID 52132, :5199); Lane C stopped it via the elevated server |
| 2026-09-28 02:45 | A3 | c3 (`5a9b9b09`) | accept; the title-scale unification needs one rendered screen (Lane C after the next release) | c4 `overnight-a3-ui-ux-2026-09-28-c4.md` | Lane C live rows 01:35–02:15: #53 tiles FAIL, #52 FAIL, B5 PASS, walkthrough top 10 → findings |
| 2026-09-28 01:30 | A3 | c2 (`81ad1892` S-e sweep, `0cae7ea1` docs) | accept source; all browser rows UNPERFORMED (A2 elevated Chromium PID 12580 holds the shared profile) | c3 `overnight-a3-ui-ux-2026-09-28-c3.md`, source-only | A3 browser rows moved to Codex (Lane C), report → docs/reviews/lane-c-codex-a3-rows-20260928/; lock file cleared |
| 2026-09-28 00:45 | A2 | c1 (`d31bfacb` live) | accept; health 200, matrix unchanged (Lane C direct check) | c2 `overnight-a2-timetable-2026-09-28-c2.md` | browser custody scheduled: A3 until 02:45, A2 after |
| 2026-09-28 00:45 | A3 | c1 (`c5cffa72`, `dd5b2366` on main) | accept; browser items BLOCKED(BROWSER_CUSTODY) all cycle | c2 `overnight-a3-ui-ux-2026-09-28-c2.md` | handoff + live-state A3 sections owed |
| 2026-09-28 00:10 | A2 | `ses_f1ccfb677ffe2OdBUU7IleK4hV` (c0 ended, step cap) | **ACCEPT with corrections**, 0 BLOCKING / 6 NON_BLOCKING; `c0d91827` LIVE (rollback `9b28c572`); `a56ac86d` built, not deployed | c1 `overnight-a2-timetable-2026-09-28-c1.md` | live-state Live release stale (says 9b28c572); 4 deliverables, #62, D10, items 3–4 not reached |
| 2026-09-27 23:10 | A3 | `ses_f1cdb5976ffeZApJg9uYqJopdx` (c0 done) | **ACCEPT**, 0 BLOCKING / 4 NON_BLOCKING; `1e417694` integrated, NOT live (live `c0d91827`) | c1 `overnight-a3-ui-ux-2026-09-28-c1.md` | UX-R02–R05/R03c not reached; #52 + B5 unperformed; #53 undeployed |
| 2026-09-27 22:00 | A2 | `ses_f1ccfb677ffe2OdBUU7IleK4hV` (elevated) | running | — | packet c0 `overnight-a2-timetable-2026-09-27.md` |
| 2026-09-27 22:00 | A3 | `ses_f1cdb5976ffeZApJg9uYqJopdx` | running | — | packet c0 `overnight-a3-ui-ux-2026-09-27.md` |

## 00:30 — year 2022-2023 generation diagnosis (executor, 193k tokens / 78 tools)

Root cause is STAFFING DATA, not a code bug: after the EnrollPro wipe only 23 teachers are active (23 stale); 23 × 30 h = exactly the 920 sessions needed, zero slack; only 2 MAPEH teachers. 355 items = 25 substitute-only class/subject pairs (MAPEH ×18 sections + MATH/ESP/SCI_BIO/TLE_ICT in S19/S20); 105 = owners at weekly limit; 8 hard violations (TLE rotation load measured differently TL vs generator — unverified, watch). Teachers #3, #20, #33 have no department → auto-match skips them (0 load).
Also missing per-year setup: 0 shift windows (year 10 had 20), 0 special events (had 2).
Candidate 5bccb65d (branch work/hotfix-newyear-readiness-20260929): TL modal headline fix + '25 classes still need a real teacher'; atlas-qa dispatched. Data script copy-year-setup-shift-windows-events.mjs (dry-run: +20 windows, +2 events; --apply receipt, --revert) awaits operator approval.
Rollovers PAUSED pending operator staffing decision.
- 00:40 5bccb65d atlas-qa ACCEPT_READY (62.7k tokens; 4 TL failures pre-exist on main) → merged to main; rides next train. Rendered proof owed in that train's Codex check.

## 03:05 checkpoint (pre-compact; operator asleep — Lane C makes judgement calls)

**Direction (operator, 03:00):** make ATLAS fully ready for older schedulers — easy to navigate and understand, never
dense or intimidating, and helping at every step (Teaching Load, Timetable, Teacher Concerns especially under
constraints) so no guesswork or tedium is left to the user. Keep improving the workflow for speed and effectiveness,
never over-engineered.
**Live:** train 5 `ce1257c8` (rollback `c9be17fe`). On main for train 6: A5 c2 `bf1a7913`, A5 subjects slice A (`419277e4`),
A9 teaching-personnel `c491e98d` (reset now reconciles, not prune).
**Running:** a2-hdr2 (leak bisect → header), a5-subj2 (slice B picker sweep), a6-hdr1c (QA + integrate Guided removal/TL
header, session ses_f17327a54ffeSVMoLIWDsajymK), a8-srv1 (TL server truth, QA round 1 correction). Queued: A6 c5
`docs/prompts/a6-outage-placeholders-2026-09-29.md` (fresh session after a6-hdr1c), A7 carry-over packet (after a7-c2).
**Train 6 plan:** when A6 Guided removal lands (+ whatever else is merged), cut A4 train 6 (fresh elevated session, reuse
train-5 packet shape) incl. shipped-vs-claimed check, drop 7 stale drill DBs, E: reclaim. Codex staging walk (terra
medium) then GO. After live: Sync now (reconcile) with operator → ids 3/20/33 stale, 2022-2023 = 20 teachers.
**Rollovers PAUSED** until 2022-2023 generates. After each rollover: run the year-setup copy script (prev→new year).
**Tooling:** monitor.sh (in-session heartbeat, 90-min idle), await.sh waiters, memguard pid 6256, Playwright MCP now
`--headless` (global opencode.jsonc; backup in scratchpad) — stops the about:blank Chromium pop-ups.

## Session checkpoint — 2026-09-29 14:30 +08 (Lane C, before compaction)
- **Live:** `3216d383` (train 8), synced to **S.Y. 2023-2024** (EnrollPro rolled over ~13:15; live sync + 2023-2024
  Teaching Load saved by Codex ~13:50; backup `D:\ATLAS-runtime-config\backups\pre-live-sync-20260929\`).
  Incident + procedure: `docs/plans/rollover-runbook.md`. Demo-day steps: `docs/plans/demo-day-runbook.md`.
- **In flight:** A4 train 9 (packet `a4-train-2026-09-29-9.md`; pin = main tip at start); A8 c3 generate-with-gaps +
  grouped blockers (demo blocker, 17:00); A6 c9 staffing button + 38.1 + 16.2 (17:30); A3 c14 Year Setup calm (17:30);
  A5 c6 fix-1.2 24.2/35.1/23.2/17.2 + a5-c2a DB guard FIRST (18:00); A9 c5 past-year TL (17:30); A9 c6 fix-1.2 7.2/10.2/36.2
  (18:00); A2 c14 term fix (check state).
- **Ready for the next train (after 9):** A7 c7 `3918902e` (false banner), A6 c8 (More filters, coverage window),
  A9 c4 (map panel, helper line), A2 c14 term commits on main.
- **Owed by Lane C:** Codex walk of train 9 on staging -> GO -> A4 resume (`launch.ps1 -Session`); after train 9 is
  live, Codex covers the 50 unstaffed classes on live with "to be hired" placeholders (operator approved); demo year
  fixed at ~18:00 (operator may roll EnrollPro again — follow the rollover runbook each time); evening train 10;
  full demo rehearsal walk.
- **Workflow state:** reaper (20-min shell kill + BelowNormal priority for planner/test/browser processes) and monitor
  running from the scratchpad; staging QA login via `/__dev/staging-login` (password rotated 15:15); rule "clickable
  must look clickable" in the planner agent.

## Session checkpoint — 2026-09-29 18:05 (Lane C, before compaction)
- **Live** `e75d6b8f` (train 9) on S.Y. 2023-2024 Term 1; 14 "to be hired" placeholders own the 50 open classes + 22
  moved (operator: keep for now). Rollover PAUSED by the operator. Backups: `backups/pre-cover-50-20260929`,
  `backups/pre-rollover-2-20260929`.
- **Train 10** (`docs/prompts/a4-train-2026-09-29-10.md`) launched 18:02 as `a4-t10`; E: 19.4 GiB → A4 reclaims first.
  On `A4 STAGING at <pin>`: run the Codex walk per `docs/plans/codex-walk-standard.md` (Part 1 rows: Year Setup calm,
  Teacher Preferences rename, Subjects filters/ACTION header, staffing button + audit, generate with gaps on 2023-2024,
  past-year TL, room filters, no garbled text) + Part 2 sweep with `scripts/qa/ux-audit.js`; new MAJOR = NO_GO; Lane C
  looks at screenshots before GO. Then resume A4 with GO.
- **Operator direction 16:40-17:00:** UX/UI quality and readability are top priority; be critical; UX regressions block;
  bigger default text (min 14px). Operator resting; Lane C holds judgement calls.
- **In flight:** A7 c8 type scale + gate; A5 c8 one filter bar + fitting selects; A2 c15 grade identity (HIGH; then
  A2 c16 truth items); A8 c4 cover routes (then A8 c5 = truth BLOCKERs first, then fix-it blockers); A6 c10r (c9
  follow-up → placeholders-not-staff → push, then cover window); A9 c7 row home-room picker (then A9 c8 Dashboard/rooms
  truth); A3 c16 no codes on screen. Packets: `ui-foundation`, `truth-fixes`, `cover-class-flow`, `fix-3`,
  `a2-c15-grade-identity`, `a8-c5-generation-always-fixable` (all 2026-09-29).
- **Train 11 (target ~21:00):** A7 c8, A5 c8, A2 c15/c16, A6 c10r, A9 c7/c8, A3 c16, A8 c4/c5 as they land; then the
  staging drill (rollover→sync→TL→generate→manual edits→publish) and the Codex manual-controls audit on a real timetable.
- **Operator decision pending:** drill years 2029-2030..2031-2032 listed as "past" in Year Setup/TL history.
- **Workflow state:** reaper (20-min shells, cmd too, token relays) + monitor (silent-exit check) running; executor 300
  steps, planner 400; rules: checkpoint commits, never revert uncommitted work, staging sign-in only via
  `/__dev/staging-login`, UX regressions block, ux-audit.js in every proof, `test:encoding`. Stop Codex only with
  `scratchpad/codex-stop.ps1`.

## Session checkpoint — 2026-09-29 21:51 (Lane C, before compaction)

**Live:** `cd542245` (train 10) since 19:52, verified by served chunk `index-BdvkYd2N.js`; rollback `e75d6b8f`. Health 200.
Backups today: `D:/ATLAS-runtime-config/backups/pre-term1-confirm-20260929/` and `pre-drill-20260929/` (nothing was
written for Term 1: it is already verified from EnrollPro). Live has draft Run 347 (2023-2024 Term 1, 910/920 placed).
Checklist artifact v4 "Train 10": https://claude.ai/artifact/EQ6Zas4FD6GZHpu29TwjVv (source `scratchpad/atlas-fix-docs-qa.html`,
builder `scratchpad/t10artifact.py`).

**Operator rulings tonight (standing):** receipts rule (walk standard); presentation over function; no imposed freezes;
walk baseline = caused or worsened by the train; Generate is never greyed out (A8 c5); **Class Schedule is the top
priority after the current planners** — tabs stay, **Expert view retired**, baseline = relaxed header `3e894d0e`, one
vocabulary (Generate → Draft → Published; "Planning" tab → "Draft"), one owner (A7) for its layout/words, proposal
before code (operator reviews A7's per-tab proposal; show it to the operator when posted). ATLAS must propose placements
for unplaced classes (A8 r1). Rollover still paused.

**Running planners:** A2 c15 (grades), A2 c17 (preferences kept, both pages), A2 mc (swap stall, lock, place, preview;
behaviour only), A3 p1 (Preferences Save — demo blocker), A3 c17 (teachers.docx 5 + profile), A5 c8 (+c8b chained: row
menus), A6 c10r2 (cover flow; preview port must be 5200-5299), A7 c10b (calm timetable, proposal first; session
`ses_f129d4df5ffeeTjrs5rghfXyZm`), A8 c5 (never-disabled Generate + receipt), A8 g1 (spread classes across days; HIGH),
A8 r1 (placement proposals; HIGH), A9 c8 (Dashboard "could not check"), A9 m1 (campus map background). On main for
train 11: A3 c16, A7 c8, A7 c9, A8 c4, A9 c7. Train 11 proposal: cut when A3 p1 + A5 c8 land (~22:30); the calm
timetable follows. A4 release session id must be in its STAGING post; GO resume uses it with a numbered cutover prompt.

**Open Codex jobs:** `codex-qa/tt-walk-a` then `tt-walk-b` (timetable component walk, read-only) — feed findings into
`docs/prompts/timetable-calm-2026-09-29.md` for A7. Remaining drill rows not yet exercised: Grade/Section/Room and Excel
exports, Expert/Advanced rules/Tutorial/Refresh (rerun after A2 mc lands). Preference test waits for A3 p1.

**Tooling fixed tonight:** await.sh waits for runs not yet started; start-preview refuses ports outside 5200-5299; agents
deny edits to D:/ATLAS; workflow-metrics records the train 10 cutover incident. Watchers: reaper, monitor, A7 proposal
watcher (`scratchpad/await-a7-proposal.sh`).

## Session checkpoint — 2026-09-30 00:12 +08 (Lane C, before compaction)
**Live:** `8d98628d` (hotfixes: EnrollPro null active-term tolerated; Teaching Load header without Past years/switches +
Show other subjects; suggestion apply 30 s; readiness budget 180 s). Tailnet serves `index-BfzPMwrg.js`. Active year
**2025-2026** (EnrollPro id 4, mirror 632), context enrollpro-verified, terms cached; EnrollPro active-term = null,
ATLAS picks T3 (atlas-unverified). Rollback basis `9462d82d` (`lane-a4-hotfix-term-prod`).
**Train 11:** re-pinned to `bc94b10b` (adds A3 c17 profile, A5 c8 one filter bar, 63714b1f switches stay removed,
Teaching Load verifyUpstream 176ff936, A3 p1 Preferences Save). A4 session `ses_f124d3556ffeD2leYFPJ6zt4RN`, run
`a4-t11b` building staging; it must post STAGING RE-PIN with a staging account that opens /teaching-load and /timetable.
Next: Codex walk in short jobs on 127.0.0.1:5274 incl. the new ROLLOVER row, then GO (numbered cutover, verify Tailnet chunk).
**Blocker #1 for the demo:** live /timetable Generate disabled for 2025-2026 — 82 items, all on special-program sections
(STE Bonifacio/Makatao/Rose/Silver, SPS Daisy, Jade): ~65 "A scheduling rule needs a decision" → Open Year Setup,
15 "could not be placed" (GR7 Bonifacio STE), 5 "teacher at their limit" (STE_RESEARCH, STE_APPLIED_PHYS, SCI_BIO).
Read-out: `docs/handoffs/tt-blockers-2526-live-readout.md`. The gate exists since 9e280369 (11 Sep). Owner:
`a8-ds-unblock` (DeepSeek) — TRUE/FALSE per cause, fix FALSE, plain action for TRUE; watcher `await-a8-unblock.sh`
fires on its post "A8 -> Lane C, unblock" (show the list to the operator). Suspect: mirror syncStatus
`setup-review-required` never clears. A8 c5 (Generate never greyed out) still running on its branch.
**A7:** `a7-ds-c11` (DeepSeek) — Step 0 per-tab proposal only; show the operator before header code. Tooltip slice
aec13de2 on work/a7-c10-calm pushed, QA pending. DeepSeek agents live in ~/.config/opencode/agents (-ds, -ds-delegate).
**Running:** a4-t11b, a7-ds-c11, a8-ds-unblock, a2-mc, a2-c16, a8-g1 (+ a8-c5, a3-c17 finished/landed?). Stopped by
operator: A5 c8 (landed), A9 m1 (branch work/a9-m1-campus-background pushed) → train 12 fresh cycles.
**Standing:** docs/plans/operator-decisions.md (locked calls); workflow changes in workflow-metrics.md (30 Sep 00:0x);
launch.ps1 cap 6 / 6 GB commit (-Force for A4); DeepSeek credit watcher ds-quota-watch.sh; one fix per cycle.

## Session checkpoint — 2026-09-30 02:40 +08

**Live:** train 11 `bc94b10b` (LIVE 00:32, chunk `index-CYuWuj7B.js`), year **2026-2027** (EnrollPro id 5, T1), aligned.
Operator staffed the 4 AP gaps and archived COMED (id 2299, unaudited test leftover); Generate runs on live.
Rollback basis `lane-a4-hotfix-tl-prod` (8d98628d) still KEEP_ACTIVE.

**On main for train 12 (not deployed):** A8 unblock wording `3536258e`; A8 gen trigger=readiness classification `e3d5c3cd`
(QA 8/8, server 513/513); white tooltips `238ce8e3`; TL advisory section beside the star (A6, 01:45); sidebar brand like
EnrollPro `4e35296c` + `ea0dda65` (school name only); A5 rotation counts (check its post); decisions 8-11 locked.

**Running (DeepSeek unless noted):** a7-ds-c12b (calm header + 27 words + Setup-card year), a8-ds-refresh (draft shows
after Generate), a6-ds-deeplink (every link/button into TL lands on + opens its target, incl. subjectId-only, filter param,
Assign teaching load), a2-ds-lag (/timetable centre content one click behind: Policies shows Setup, Runs shows Policies),
a2-mc (space-bunny, manual controls R2), a8-c5 (Generate never greyed out, correction round).
**Queued (queue-launch.sh, cap 6):** a6-ds-demand, a2-ds-place (after a2-mc: one-click place + Undo, invisible placed
class), a5-ds-docx1 (Subjects coverage badge not clickable, Owned-by tooltip, temp-teacher form: optional names, no
placeholders, Select Department, NO Specialization), a9-ds-sections (badges dark, room text full, remove Browse room map,
drawer -> normal-width dialog, rotation row, Apply rooms receipt + Undo), a6-ds-tllayout (after deeplink), a3-ds-teacher
(one teacher dialog = Review load + Profile, normal width; likely after demo).

**Operator actions pending:** Teachers > More > Refresh roster (20 advisers, A6 00:55 post); restart the ELEVATED
`opencode serve --port 4097` so A4 uses the new DeepSeek/OpenCode Go key (switched 02:33; old key at 6%). A4 must attach
to 4097 (elevation), never run without it.

**Train 12 plan:** cut at ~04:00 from main tip with what has passed QA; A4 staging; Codex walk (dev preview :52xx over
:5101 with /__dev/staging-login; staging data is on an old year, so year-dependent rows are checked on live after cutover);
GO; verify Tailnet chunk before saying live. Operator records 04:45-05:45, leaves 06:00. No 03:00 fallback needed.

**After-demo backlog:** workflow-metrics.md "After-demo backlog from the 30 Sep click sweep"; re-run Teachers + TL click
sweeps; Year Setup wrong-year link; help icons click-to-open; Room Schedules 11x6/13x6.

## Operator approval - 2026-09-30 ~05:58 +08

Operator (leaving 07:00): Lane C may release train 14 without the operator, same gates as trains 12b/13: only QA-passed
work from main, A4 staging on :4097, Codex per-page walk on a :52xx preview, GO with a numbered cutover, Tailnet chunk
and live check after, rollback basis train 13 (8f19430b). Candidates: A2 move/swap/remove (a2-ds-moveswap), A7 clipping
and warnings list (a7-ds-clip), A6 saved-data banner (a6-ds-banner), A3 merged teacher dialog (a3-ds-integrate), A5/A9
docx items. E: free space is 17 GiB: reclaim old staging trees before the build. Leave a short summary for the operator.
