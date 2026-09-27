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

## Cycle log (newest first)

| When (+08) | Lane | Run / session | Verdict | Next packet | Notes |
|---|---|---|---|---|---|
| 2026-09-27 22:00 | A2 | `ses_f1ccfb677ffe2OdBUU7IleK4hV` (elevated) | running | — | packet c0 `overnight-a2-timetable-2026-09-27.md` |
| 2026-09-27 22:00 | A3 | `ses_f1cdb5976ffeZApJg9uYqJopdx` | running | — | packet c0 `overnight-a3-ui-ux-2026-09-27.md` |
