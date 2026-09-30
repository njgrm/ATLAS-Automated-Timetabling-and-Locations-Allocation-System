# Running space-bunny-free planners (read with MANAGER.md)

Planners, executors and QA in `.opencode/agents` pin `opencode-go/space-bunny-free` (variant high; steps 400/300/150).
The `opencode.json` default is `deepseek-v4.1-flash`: ALWAYS pass `-Agent atlas-planner` or `-Agent atlas-executor`.
No agent, or a `-ds` agent, silently runs DeepSeek; the default `build` agent is refused by the provider.
`opencode run` exits 0 even on model or transport errors: only the report block counts.

## Tiers (workflow v2)
| Tier | What | Path |
|---|---|---|
| T1 | Wording, layout, styling, one component, <=50 lines, no data/generation/publish logic | One executor, short packet: focused tests + tsc + 1366x768 screenshot; the named integration owner lands it after checking the report. No separate QA round. |
| T2 | One page or behaviour | One executor; Codex verifies live against the quoted operator words. At most 1 fix-up round, then decide. |
| T3 | Generator, publish, deploy path, migrations, live-data writes, auth | Executor on a branch; a second model reviews before landing (Codex high effort). Staging walk. Never self-graded. |

Owners: **Timetable** (/timetable, header, grid, draft/swap/unassigned, generator UI), **Setup** (Teachers, Teaching Load,
Subjects, Sections, Policies, Year Setup), **Reports** (Print Reports, exports, docx, Dashboard). Shared files (app shell,
navigation, shared header helpers) belong to the manager. At most 3 feature planners plus A4.
Releases follow decision 16a: at most 2 per day, none 22:00-06:00 unless the operator writes `ship`; the live-use
gate, artifact checks, screenshots, post-cutover smoke, automatic rollback, and migration reviewer rules are mandatory.
Pre-existing failures are compared against the pinned base and recorded; they are never silently accepted as green.

## Launch recipe (one packet)
1. Write the packet to `docs/prompts/v2/<id>.md` on the manager's docs branch; the named integration owner commits and
   integrates it. Never write directly to `main`.
2. `powershell -File ops/lane-c/new-worktree.ps1 -Name lane-<owner>-<id>` (pinned to origin/main).
3. `powershell -File ops/lane-c/launch.ps1 -Name <id> -Agent atlas-executor -Dir E:\ATLAS-worktrees\lane-<owner>-<id> -Prompt 'Read docs/prompts/v2/<id>.md and execute it. End with the report block.'`
4. Next ticks: `bash ops/lane-c/status.sh`; read the log tail in `D:/ATLAS-lane-c/runs/<id>.log`.
5. After the integration owner lands it: `powershell -File ops/lane-c/remove-worktree.ps1 -Path E:\ATLAS-worktrees\lane-<owner>-<id>`.

## Known failure modes and the rule for each
1. **It stops after stating intent** (exit 0, no report block). Mark it NEEDS_TRIAGE and resume the SAME session once:
   `launch.ps1 -Name <id>-r -Session <ses_id> -Dir <wt> -Prompt 'Continue. Finish and print the report block.'`
   (`opencode session list` gives the id). A second silent exit means kill it, split the packet and start fresh.
2. **It narrows the requirement and grades itself PASSED.** On 09-28, 15 of 34 claimed passes met the operator's
   words. Its verdict is advisory only; Codex checks each quoted item live.
3. **It decays over long sessions.** One fix per packet, fresh session per packet. No commit after 90 min: kill and split.
4. **It hangs on foreground servers** (vite preview, `node dist/server.js`). Packets say "start servers in the
   background with a timeout; stop them before reporting". Keep the reaper armed; a run idle over 60 min is hung.
5. **It hangs on a denied .env read**, and multi-line prompts killed runs. The prompt is one line pointing at the
   packet file; packets forbid reading any .env or runtime-config file.
6. **It leaves dirty worktrees.** Before any exit it commits `wip: <id>` to its branch. If the executor is denied push,
   it reports the SHA and the manager performs the permitted push; no worktree stays dirty.
7. **It makes confident wrong diagnoses.** Every cause claim carries evidence (a read-only DB query, a log line or a
   failing test) or is labelled HYPOTHESIS.
8. **It hits transport or free-tier errors** ("Cannot connect to API", uv_spawn EUNKNOWN). Retry once after 2 min,
   then queue it and tell the operator.
9. **It chases known noise.** The client has 5 pre-existing tsc errors (playwright imports, truth-labels-a2); packets
   say not to fix them.

## Packet template (`docs/prompts/v2/<id>.md`)
```
TIER: T1|T2|T3   OWNER: Timetable|Setup|Reports   BASE: <sha>   WORKTREE: E:\ATLAS-worktrees\lane-<owner>-<id>   BRANCH: work/lane-<owner>-<id>
ACCEPTANCE (operator's words, verbatim; do not restate): "..."
CONTEXT: <files, decisions N from docs/plans/operator-decisions.md, known causes with evidence>
OWNED FILES: <list>. Editing any other file = stop and report NEEDS_DECISION.
FORBIDDEN: reading .env/runtime-config files, deploy, publish, generation or writes on live, other lanes' files,
  fixing the 5 known client tsc errors.
DONE MEANS: failing test first -> fix -> focused tests + full client/server suite + tsc -> 1366x768 screenshot of the
  changed screen (servers in background with a timeout, stopped after) -> commit -> report candidate SHA.
  The designated integration owner merges T1/T2; T3 receives independent review first. Before ANY exit, commit
  `wip: <id>` if anything is uncommitted and report the SHA for a manager-owned push.
REPORT BLOCK (print exactly, last):
RESULT: LANDED <sha> | PUSHED <branch>@<sha> | BLOCKED <reason> | NEEDS_DECISION <question>
TESTS: <names and pass counts>   SCREENSHOT: <path>   EVIDENCE: <for any diagnosis>   WORKTREE: clean|wip@<sha>
```

## Packet queue (30 Sep 19:26; live is train 21 `fdae67ec`)
| # | Packet | Owner | Tier | Note |
|---|---|---|---|---|
| 1 | Update the 3 header tests pinning pre-hotfix wording: a2-c12-header-rows2 (+2), draft-ux-c01 (+3), a2-c11-s2-header-banners (+1). Match the c82b8636 hotfix wording; do not change product code. | Timetable | T1 | Blocks train 22 (gate: no red tests) |
| 2 | Train 22: A2 move-swap c2 `8c1b9218`, A5 unassigned panel `22b34170`, A6 placement feasibility `8766c084`/`fffa830c`| A4 | Release | After #1 is green, in a window, with the operator's OK |
| 3 | Triage the 3 dirty worktrees (lane-a4-fast-deploy 1 file, lane-a7-relaxed-header 19 files, lane-a6-docx-tl 1 file): read each diff, then commit to its branch or record a discard for the operator | Manager | Triage | Before relaunching #4, #6, #8 |
| 4 | A4 fast deploy: `release-live.ps1`, package reuse, `-ClientOnly`, rule 19 as a hard gate | Release | T3 | Salvage from lane-a4-fast-deploy |
| 5 | Makabansa generator repair (decision 14): when a class has no free slot, move one blocking class | Timetable | T3 | Cause: greedy placement, only 11:30 free, every rotation teacher booked then |
| 6 | Relaxed header: one row above the grid | Timetable | T2 | Salvage from lane-a7-relaxed-header, or restart |
| 7 | Regenerate run 359 on live to clear the 156 pre-decision-15 lunch warnings | Timetable | Live action | Lunch fix `0df8dd76` is already live (train 21): can run now, with operator approval |
| 8 | Teaching Load docx items | Setup | T2 | lane-a6-docx-tl |
| 9 | Old branches: `work/a8-g1-spread-sessions`, `fix/a5-c8b-row-menu-fit`, `work/a9-m1-campus-background`. Decide keep or drop against decisions 2-15 | Manager | Triage | Deleting unmerged work needs the operator |
| 10 | After-demo backlog, one T1 packet each: Year Setup wrong-year link; "See what would be copied" dead; (i) help icons click-to-open; Teacher Preferences "Load the roster first" on entry; Room Schedules 11x6/13x6 | Setup | T1 | |
| 11 | Click sweeps re-run: Teachers (0 clicks) and Teaching Load (3 clicks) | QA | Codex walk | |
