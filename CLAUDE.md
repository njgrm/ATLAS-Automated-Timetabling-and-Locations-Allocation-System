# Claude Directive

Claude Code sessions follow `AGENTS.md` (the project directive) plus the three cost rules below. They add to
`AGENTS.md` §16 and `docs/reference/agent-context-economy.md`; they waive no gate.

Evidence (2026-09-25): one Lane C session carried three streams (browser QA, the swap/scroll fix, the Teaching
Load fix). Every turn re-read all three streams' context, and the browser steps inflated it further.

1. **One stream per session.** Start a fresh session at every stream boundary: after a candidate is committed and
   handed off, after a deploy, when QA verdicts arrive, or when the work moves to an unrelated stream. Write the
   handoff first (Session checkpoint in `agent-context-economy.md`) and say so to the operator. This is the
   largest saving.
2. **Browser QA runs in a subagent.** Give it the release SHA, the rows and the `atlas-live-browser-qa` skill. It
   returns one short tally (`passed/blocked/unperformed`, one line per row, evidence paths). The main
   conversation never holds the individual browser steps.
3. **Choose the subagent model by task:**

   | Task | Model |
   |---|---|
   | Code search, file location (Explore) | Haiku 4.5, or Sonnet 5 when the search needs judgement |
   | Browser QA runs | Sonnet 5 |
   | MEDIUM-risk review/QA (§11) | Sonnet 5 |
   | HIGH-risk review/QA (§11, §13) | Opus |

   Pass `model` on every Agent dispatch; never let a subagent inherit Opus by default. Precedent: on 2026-09-25
   an Opus reviewer caught two real defects in a HIGH-risk review, so the cost was justified there.
