# Claude Directive

Claude Code sessions follow `AGENTS.md` (the project directive) plus the three cost rules below. They add to
`AGENTS.md` §16 and `docs/reference/agent-context-economy.md`; they waive no gate.

Evidence (2026-09-25): one Lane C session carried three streams (browser QA, the swap/scroll fix, the Teaching
Load fix). Every turn re-read all three streams' context, and the browser steps inflated it further.

1. **One stream per session.** Start a fresh session at every stream boundary: after a candidate is committed and
   handed off, after a deploy, when QA verdicts arrive, or when the work moves to an unrelated stream. Write the
   handoff first (Session checkpoint in `agent-context-economy.md`) and say so to the operator. This is the
   largest saving. **The planner recommends the reset unprompted** — the operator should never have to ask. When
   a stream reaches a boundary, end the turn with the handoff path and one line: "Start a fresh session from
   `<handoff path>`." Also recommend it when context passes about 200k tokens.
2. **Browser QA runs in a subagent.** Give it the release SHA, the rows and the `atlas-live-browser-qa` skill. It
   returns one short tally (`passed/blocked/unperformed`, one line per row, evidence paths). The main
   conversation never holds the individual browser steps.
3. **Dispatch through the named agents in `.claude/agents/`**; each pins its model and effort:

   | Role | Agent | Model · effort |
   |---|---|---|
   | Executor (one candidate) | `atlas-executor` | Opus 5.5 · medium |
   | MEDIUM QA (§11) | `atlas-qa` | Opus 5.5 · low |
   | HIGH review, pre- or post-action (§11, §13) | `atlas-reviewer-high` | Opus 5.5 · high |
   | Browser QA / reproduction (exact steps) | `atlas-browser-qa` | Sonnet 5 · low |
   | Code or file search | `atlas-search` | Haiku 4.5 |

   Do not pass `model` on the dispatch; it overrides the definition. Never let a subagent inherit the planner's
   model by accident: use a named agent, or pass `model` explicitly for any other agent type.
   **Why this split (2026-09-25):** Opus 5.5 is $4/$20 per MTok against Sonnet 5's $2/$10, so it costs no more once
   it finishes in half the tokens, and lower effort makes fewer, consolidated tool calls. Sonnet 5 at default
   effort took 188k tokens / 86 tool calls to execute and 139k / 53 to QA one MEDIUM candidate, and a Sonnet
   browser runner ran a different slot than the one asked. An Opus reviewer caught two real defects in a HIGH
   review the same day. **Measure it:** record each dispatch's `subagent_tokens` per accepted candidate in the
   handoff; after three cycles keep whichever split is cheaper per accepted candidate, and change this table.
