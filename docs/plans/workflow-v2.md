# Workflow v2 — operating space-bunny-free planners

Operator decision, 2026-09-30. This is the Lane C operating contract distilled
from the 27–30 September runs. It supersedes older Lane C notes that route a
normal planner or QA packet through DeepSeek. It does not weaken `AGENTS.md`:
its worktree, review, integration, and HIGH-action rules prevail when wording
would otherwise conflict.

## Model and launch contract

- `atlas-planner`, `atlas-executor`, and `atlas-qa` resolve to
  `opencode-go/space-bunny-free`, variant `high`, with steps 400, 300, and 150
  respectively. Before dispatch, the manager verifies that resolved
  configuration rather than trusting an old role file or a model name in a log.
- The default OpenCode model is `deepseek-v4.1-flash`. Every normal dispatch
  explicitly passes `--agent atlas-planner` or `--agent atlas-executor`; a
  `-ds` agent or omitted agent is a deliberate DeepSeek exception, not an
  accidental fallback. The provider-refused `build` agent is never used.
- `opencode run` exit status is not a verdict. Only the required report block
  below decides whether a packet is complete.
- The manager creates a registered worktree in `E:/ATLAS-worktrees` from a
  pinned `origin/main` SHA before dispatch. Planners never work in `D:/ATLAS`.
  Each packet names its exact worktree, branch, and owned files.

## Packet template

Each packet is a file at `docs/prompts/<lane>/<id>.md`; the detached launch
prompt is only `Read <path> and execute it`. This avoids multi-line command
quoting failures and makes the packet reviewable.

```text
TIER: T1|T2|T3 · OWNER LANE · BASE SHA · WORKTREE path · BRANCH
ACCEPTANCE (operator's words, verbatim): "..."
OWNED FILES: ...
FORBIDDEN: .env/runtime-config reads, deploy, publish, live DB writes, other lanes' files
DONE MEANS: failing test first -> fix -> focused tests + full client/server suite + tsc
            -> 1366x768 screenshot of the changed screen -> commit
            -> planner integration (T1/T2) or branch review (T3)
REPORT BLOCK (last thing printed, exactly):
RESULT: LANDED <sha> | PUSHED <branch>@<sha> | BLOCKED <reason> | NEEDS_DECISION <question>
TESTS: <names and pass counts>   SCREENSHOT: <path>   EVIDENCE: <for any diagnosis>
WORKTREE: clean|wip@<sha>
```

`LANDED` means integrated by the designated integration owner, never an
executor committing directly to `main`. A WIP checkpoint is committed on the
packet branch before a run exits; the manager pushes it when the executing role
is intentionally denied push authority. A packet must not leave a dirty
worktree.

## Failure rules

1. **Silent completion.** Missing report block is `NEEDS_TRIAGE`. Resume the
   same session once with: `continue; finish and print the report block`. A
   second silent exit ends the run; preserve its WIP commit, split the packet,
   and start fresh.
2. **Requirement narrowing.** `ACCEPTANCE` quotes the operator verbatim; a
   planner may not restate it. Self-QA is advisory. Codex checks every item on
   the deciding rendered surface against that quote.
3. **Context decay.** One fix per packet and a fresh session per packet. No
   commit within 90 minutes means stop, checkpoint, split, and relaunch.
4. **Foreground-server hangs.** Packets require hidden/background startup,
   bounded readiness polling, and stopping the process in the same command.
   The 20-minute reaper and 60-minute idle monitor remain armed.
5. **Forbidden configuration reads and fragile prompts.** Packets forbid all
   `.env` and runtime-config reads. Packet content lives in a file; command-line
   prompts stay one line.
6. **Dirty exits.** Before exit, make a `wip:` checkpoint on the packet branch;
   do not leave a dirty worktree. The manager performs any push the role cannot.
7. **Git races and cross-lane edits.** The packet's owned-file list is a
   boundary. Editing another file requires `NEEDS_DECISION`; shared headers and
   other shared surfaces have one named owner. Remove worktrees only through
   `ops/lane-c/remove-worktree.ps1`.
8. **Unsupported cause claims.** Every diagnosis carries a read-only query,
   log line, or failing test. Otherwise report `HYPOTHESIS`, never a fact.
9. **Transport or free-tier errors.** Retry once after two minutes. On a second
   error, queue the run and notify the operator; never retry-loop.
10. **Known noise.** Each packet lists relevant pre-existing test/typecheck
    failures. The executor neither absorbs nor fixes them without a new packet.

## Tier ownership

| Tier | Work | Delivery loop |
| --- | --- | --- |
| T1 | Bounded hotfix | Codex implements in its dedicated worktree; focused tests, typecheck, screenshot, planner integration. Do not pay planner startup cost for a mechanical fix. |
| T2 | Normal feature | One space-bunny executor per packet; Codex verifies the original acceptance quote on the deciding route. At most one fix-up round. |
| T3 | Generator, publish/deploy path, migration, or other HIGH work | Space-bunny plans and implements on a branch. A second model independently reviews before integration; deployment and migration gates remain governed by `AGENTS.md` and decision 16a. |

Run at most three planners plus A4. A4 runs only in a release window.

## Release and reporting

- Decision 16a is the autonomous-release authority: automated artifacts,
  full suites, 1366x768 header/grid evidence, a 15-minute live-use quiet
  window, deployment cap/window, post-cutover chunk/health/five-flow smoke, and
  automatic rollback all apply.
- The manager reports only a change: landed, blocked, died, released, or a
  decision needed. Silence is healthy only while the monitor itself is alive;
  a missing report block or dead monitor is an alarm.
- Per release, record fixes live and seen, packets shipped versus claimed,
  relaunch rate, `REJECT_UX` rate, cost per shipped fix, and live-touch
  incidents. These metrics decide whether a workflow rule stays.

## Implementation reconciliation

Before enabling the contract, update the launcher and its tests so normal
dispatches use the pinned worktree and explicit `--agent` rather than the
shared-root `git pull` path. Validate resolved OpenCode configuration with
`opencode debug config --pure`; stale tests or documents that expect DeepSeek
for `atlas-planner`, `atlas-executor`, or `atlas-qa` are defects to correct in
that implementation packet.
