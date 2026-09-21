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

Clean scope: `opencode stats --days N --project ""` isolates this repository from other work on
the machine. The earlier rows used the all-projects figure; it agreed to the cent for the 1-day
window, so the rows are comparable.

| When (2026-09-21) | 1-day cost | 1-day sessions | 1-day messages | Notes |
| --- | --- | --- | --- | --- |
| baseline before the C01R closure turn | $4.63 | 42 | 3,006 | input 14.6M, output 1.1M, cache read 496.1M |
| C01R closure (release + QA + correction + clone recovery) | $4.82 | 45 | 3,162 | +$0.19 / +3 sessions / +156 msgs |
| `ACTOR-SCHOOL-MUTATIONS-C01` release (source review + deploy + post-action QA) | $4.85 | 45 | 3,191 | end-of-turn; see the lag warning below |

**Window totals (ATLAS only):** 1 day **$4.85 / 45 sessions / 3,191 messages / 15.1M input / 1.1M
output / 521.2M cache read**; 7 days **$65.65 / 426 sessions / 28,680 messages** (~$9.38/day);
30 days **$116.97 / 883 sessions / 60,478 messages** (~$3.90/day).

**Model split, 7 days:** `deepseek-v4.1-flash` **$63.50 (96.7%)**;
`muse-spark-1.3-contributor` **$1.33 (2.0%)**; `deepseek-v4-flash` $0.69; other $0.14.

## How to read this (operator directive, 2026-09-21)

**We are under a deadline and spend is not the constraint.** The instruction is to spend what the
work needs while keeping the *coordination* lean — so these figures are read as a **throughput**
signal, not a budget: cost and coordination per **accepted, deployed increment**.

- **The money is in planning and verification, not implementation** — 96.7% sits on the model that
  covers the planner and QA/reviewers, while muse executors are ~2%. That shape is intended while
  the gates are catching real defects (today: a falsified packet premise, a missing source-review
  tier, a false zero-write claim). It is *not* intended to drift into repeated review rounds over
  unchanged evidence.
- **The pure-waste signal to hunt** is a turn that re-reads artifacts to re-derive state the
  handoff already carries, or a second reviewer dispatch for a docs-only fix. Both are coordination
  producing zero new evidence, and both are now rules (`AGENTS.md` §11, §16).
- **No budget guardrail is in force.** Do not stop work to economise; stop only when the workflow
  itself is duplicating effort, and fix the workflow instead.

## Process metrics to hold the levers

Track these per accepted release; they are what the two workflow rules act on:

| Metric | Target | 2026-09-21 `ACTOR-SCHOOL-MUTATIONS-C01` |
| --- | --- | --- |
| Reviewer dispatches before the action | 1 | 1 (source review + packet lint in one pass) |
| Reviewer dispatches after the action | 1 | 1 |
| Second review rounds caused by packet wording | 0 | 0 (D4 corrected by the planner, no re-dispatch) |
| Planner turns to complete the cycle | 1 | 1 |
| Handoff size (lines) | falling | ~370 — **too long; trim to summary + pointers** |

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
