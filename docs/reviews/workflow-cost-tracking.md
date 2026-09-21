# Workflow cost tracking

Operator request, 2026-09-21: monitor what each turn burns so we can judge whether it is
unjustifiable and adjust the workflow from there. This is the one place measured cost figures
live (`AGENTS.md` §16 keeps them out of the normative directive).

## How to measure (the only machine-readable source)

`opencode stats --days 1` (and `--days 7`, `--models` for per-model cost). The provider console
allowance percentage is **not** machine-readable from this lane — the operator's console login is
OAuth-only and this lane must never complete it. Report console percentages as
"last operator-confirmed <when>" and ask for a re-read when it matters.

Per-turn delta = the `--days 1` figures at the end of a turn minus the same figures at its start.
Sessions and messages are the most stable counters; `Total Cost` is provider-priced and moves in
coarser steps. Cache-read tokens dominate the input side and are the planner-context proxy.

## Log

| When (2026-09-21) | 1-day cost | 1-day sessions | 1-day messages | 7-day cost | Notes |
| --- | --- | --- | --- | --- | --- |
| baseline before the C01R closure turn | $4.63 | 42 | 3,006 | $66.76 / 444 sessions | input 14.6M, output 1.1M, cache read 496.1M |
| C01R closure turn (release deploy + QA + correction + clone recovery) | $4.82 | 45 | 3,162 | — | **+$0.19 / +3 sessions / +156 msgs / +17.2M cache read** |
| `ACTOR-SCHOOL-MUTATIONS-C01` release turn (source review + packet + deploy + post-action QA) | $4.84 | 45 | 3,177 | — | +$0.02 / +0 sessions / +15 msgs / +4.2M cache read — **almost certainly undercounted**: the turn ran two subagent sessions (a reviewer that reproduced the harness and a QA that re-derived the signature map and ran a whole-DB scan) and the counters clearly had not yet aggregated them. Re-measure at the next boundary; treat this row as a floor, not a total. |

> **Known measurement lag.** `opencode stats` session/message counters aggregate subagent sessions
> after they close, so a figure taken immediately at the end of a turn that dispatched subagents can
> undercount by most of that turn's work. Take the reading at the **start** of the next turn as well
> and use the larger of the two; do not read a suspiciously small delta as a cheap turn.

## What is known about the shape of the burn

- **`deepseek-v4.1-flash` was 97% of 7-day spend** ($65.33 of $67.35 across 26,107 messages,
  ~$0.0025/msg) while `muse-spark-1.3-contributor` was **3x cheaper per message** ($1.18 across
  1,411 messages). ds4.1flash covers the planner **and** `atlas-qa`; muse covers executors.
- Therefore the two cost levers that actually move the number are: **(a) planner context** —
  every planner turn re-reads a large context, so fewer/larger turns beat many small ones — and
  **(b) the number of ds4.1flash QA/reviewer runs**, not executor dispatch.
- Counter-lever: a fresh session re-pays prompt-cache setup, and compaction invalidates the cache
  prefix too. So "restart often" is not free either.

## Workflow decisions this should inform

Track the delta per turn against what the turn actually delivered. A turn that merely
re-reads artifacts to re-derive a known state is the failure mode to watch for — the handoff
exists precisely so a fresh session does not have to reconstruct state from Git.
