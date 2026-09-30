# Lane C → Codex manager handoff — 2026-09-30 (Claude Lane C, usage nearly spent)

The operator is moving the Lane C manager role from Claude Code to local Codex. Your first job is to decide how
Codex's own harness should carry the workflow, then set it up, then run it.

## State (from the 16:20 checkpoint in `lane-c-overnight-manager.md`)
Live train 21 `fdae67ec`. On main, not live: A2 move-swap c2, A5 unassigned panel, A6 placement feasibility; three
header tests pin pre-hotfix wording (a2-c12-header-rows2, draft-ux-c01, a2-c11-s2-header-banners) — fix first.
No planners running. Disk: C: 29 GB, E: 44 GB free (cleaned 30 Sep).

## Harness features to evaluate (Claude feature → what Lane C used it for)
| Claude Code | Used for | Codex candidates to check |
|---|---|---|
| Background shell + completion notification | await.sh / monitor.sh wake the manager | `codex queue <session> <msg>` from watcher scripts; hooks |
| Named subagents (`.claude/agents`, pinned model/effort) | executor, QA, HIGH reviewer, browser QA | `multi_agent` (stable, on); `codex exec -p <profile>` |
| Skills (`.agents/skills`) | reclaim, timetable invariants, browser QA rules | Codex reads `.agents/skills` natively — confirm |
| Memory + CLAUDE.md | standing rules | `memories` (on), AGENTS.md |
| Fresh session at boundaries | cost control | `codex exec` stateless ticks vs a long session + compaction |
| Claude in Chrome | browser QA | `browser_use` / Brave extension on the main account |
Two accounts at once: separate `CODEX_HOME` per process (manager = second account, QA/browser = main account with the
Brave pairing). A working fallback is already on main: `ops/lane-c/codex/` (tick loop, role card MANAGER.md,
codex-run.ps1, notify.ps1) — untested end to end. Keep it, replace it, or combine it with `codex queue`; say which and why.

## Workflow evaluation (pending operator decision 16 — do not edit rule docs until the operator decides)
Measured from 190 run logs (28-30 Sep, now in `D:/ATLAS-lane-c/runs`): 30 Sep had 46 planner runs, median 23 min,
p75 71 min; ~22 were relaunches, 13 died near-empty (07:52 launcher newline bug); 8 trains (14-21) in ~4.5 h.
Regressions that reached live were skipped gates or collisions: empty `dist` (5 min 502), header broken by two lanes,
a deploy under the operator's Generate (run 356 stuck).
Proposal "workflow v2" (previous Lane C): tiers T1 hotfix / T2 feature / T3 high risk; 3 page-owned planners
(Timetable / Setup / Reports), shared files owned by Lane C; two release windows a day or on "ship", full-suite + real
build + 1366x768 screenshots gate, client-only swap for client changes; unverified diagnoses never reach the operator;
report only on change; metrics per release.
Claude Lane C agreed, with 5 changes: (1) T1 fixes go to an executor/cloud session, not the manager's own context;
(2) T3 staging explicitly ends decision 12; (3) map old lanes A2/A3/A5-A9 to the new owners in operator-decisions guards;
(4) "silence = healthy" only while the monitor itself is alive and alarms on DIED-EMPTY; (5) add relaunch rate and
cost per shipped fix to metrics.
Extra capacity: $92 Claude cloud-session credits (expire 5 Nov, GitHub-connected) can run executor/QA jobs on branches.
