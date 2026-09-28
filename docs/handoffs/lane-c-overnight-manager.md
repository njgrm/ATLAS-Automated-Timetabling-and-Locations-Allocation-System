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
