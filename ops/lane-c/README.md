# Lane C runbook — planners, Codex, watchers

A fresh Lane C session starts here. Scripts live in this folder (`ops/lane-c/`); run logs and state live outside the
repo in `D:/ATLAS-lane-c/` (override with `LANE_C_HOME`). Nothing here reads or prints secrets except `datainv.cjs`,
which reads `DATABASE_URL` from the runtime env file in memory and prints only `DATA-OK`/`DATA-BAD`.

## 1. Start of session (after a reboot, crash or /compact)

1. `bash ops/lane-c/status.sh` — runs, :4097, root checkout, live data, live/staging health, unmerged branches.
2. Check the operator's admin server: `curl -s http://127.0.0.1:4097/session/status` (`{}` = up, idle). If it is
   down, ask the operator to restart it (`opencode serve` elevated, port 4097, localhost only). Lane C never
   handles API keys; the operator runs `opencode auth login`.
3. Start the background watchers (Bash, `run_in_background`), one of each:

   | Watcher | Command | Exits (= wakes Lane C) when |
   |---|---|---|
   | Monitor, every 10 min | `bash ops/lane-c/monitor.sh` | live/staging health bad, :4097 down, stuck server, run idle >60 min, run ended without report |
   | Reaper, every 2 min | `bash ops/lane-c/reaper.sh` | never; kills planner shell calls older than 20 min |
   | Memory guard, every 15 s | `powershell -File ops/lane-c/memguard.ps1` | never; kills non-server node over 4 GB |
   | DeepSeek credit | `bash ops/lane-c/ds-quota-watch.sh` | a `-ds-` run log shows 402/429/quota |
   | One per running planner | `bash ops/lane-c/await.sh <run>` | that run exits; prints its log tail |

   Re-launch any watcher after it exits. The scheduled-task heartbeat and CronCreate do NOT reach the session.
4. Check Codex: Brave open with the "Your Brave" extension connected (lost after reboot or network drop — the
   operator clicks the extension).

## 2. OpenCode planners

- Provision a pinned `E:\ATLAS-worktrees` worktree, then launch detached:
  `powershell -File ops/lane-c/new-worktree.ps1 -Name <packet>; powershell -File ops/lane-c/launch.ps1 -Name <packet> -Agent atlas-executor -Dir E:\ATLAS-worktrees\<packet> -Prompt '<one line, no double quotes>' [-Elevated]`
  - Agents: `atlas-planner`, `atlas-executor`, `atlas-qa`, and `atlas-wave-auditor` resolve to space-bunny-free. Never omit `-Agent` and never use the provider-refused default `build` agent.
  - `-Elevated` attaches to :4097 (A4 release lane only; A4 also passes `-Force` past the cap).
  - Cap 6 planners and 6 GB commit free; when refused, use `bash ops/lane-c/queue-launch.sh <name> <agent> <worktree> <promptfile>`.
- Then `bash ops/lane-c/await.sh <name>` in the background.
- Ended on a statement of intent / killed mid-turn: continue the SAME session in its original worktree —
  `launch.ps1 -Name <name>-r -Session <ses_id> -Dir E:\ATLAS-worktrees\<packet> -Prompt '...'` (or `queue-resume.sh <name> <agent> <session> <worktree>`). Session ids: `opencode session list`.
- Read a finished session: `opencode export <ses_id>`. `opencode run` exits 0 even on model errors — read the tail.
- DIED-EMPTY in status = the command line broke (prompt quoting); fix the prompt and relaunch.
- A run log-idle >60 min with a dev server child at 0 CPU = hung foreground server: kill that server PID only.
- New packet = fresh session; never reuse one planner session across packets.

## 3. Codex (browser QA / second runner)

```
mkdir <scratch>/codex-qa/<job>; write prompt.md (exact steps, ATLAS origins only, "stop at first blocker")
codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check -c model_reasoning_effort=low \
  -o <job>/final.md - < <job>/prompt.md > <job>/run.log 2>&1      # run in background
```

- Stop Codex only with `powershell -File ops/lane-c/codex-stop.ps1` (a broad kill once hit a planner).
- `"browsers":[]` / "no Brave browser" in the output = extension disconnected → ask the operator to click it.
- Claude-side browser QA uses Claude in Chrome via `atlas-browser-qa`, never the built-in browser pane.

## 4. Live facts

- Live: supervisor API 5001 / client 5174; funnel `https://njgrm.buru-degree.ts.net`. Staging API 5101.
- Release SHA: machine env `ATLAS_RUNTIME_RELEASE_SHA`. Only A4 deploys; never while the operator is using live
  without asking. Never cut over without a built `atlas-server/dist` (rule 19).
- After a staging deploy: `node scripts/dev/ensure-staging-qa-account.cjs`.
- Worktree removal: ONLY `powershell -File ops/lane-c/remove-worktree.ps1 -Path E:\ATLAS-worktrees\<name>` (unlinks
  every node_modules junction first; a plain `git worktree remove --force` emptied D:\ATLAS node_modules on 2026-09-30).
- Disk: OpenCode fills C: (`%TEMP%\opencode` planner scratch reached 15 GB; `~/.local/share/opencode/opencode.db` 7.6 GB).
  Delete `%TEMP%\opencode` and `tool-output` files older than a day when no planner is running.

Rules and decisions: `CLAUDE.md`, `AGENTS.md`, `docs/plans/operator-decisions.md`, `docs/handoffs/workflow-metrics.md`.

## 5. Running Lane C on Codex (no Claude session needed)

Two Codex accounts, each with its own `CODEX_HOME`, can run at the same time:

| Role | Account / home | Started by |
|---|---|---|
| Manager (Lane C) | second account, `D:\codex-homes\manager` | `ops/lane-c/codex/manager-tick.ps1` loop |
| QA + browser walks | main account, `~/.codex` (paired with Brave) | the manager, via `ops/lane-c/codex/codex-run.ps1` |
| Executors (planners) | OpenCode space-bunny-free; A4 only under its release gate | the manager, via `launch.ps1` in a pinned worktree |

One-time setup (operator): `$env:CODEX_HOME='D:\codex-homes\manager'; codex login` (second account), then open a
terminal and run `powershell -File ops/lane-c/codex/manager-tick.ps1`. The role card is `ops/lane-c/codex/MANAGER.md`.
Talk to the manager by writing in `D:/ATLAS-lane-c/operator-inbox.md` (e.g. `ship`, `using live until 15:00`, a new
issue); it answers in `manager-outbox.md` and with a Windows toast. Tick logs: `D:/ATLAS-lane-c/manager-ticks/`.
