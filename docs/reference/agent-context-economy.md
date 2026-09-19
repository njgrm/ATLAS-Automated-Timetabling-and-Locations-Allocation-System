# Agent Context Economy

This is a non-normative operating note. `AGENTS.md` remains the authority.

## Defaults

- Start a fresh session at a durable lane boundary, not during an uncommitted
  correction, browser handoff, or HIGH action.
- Keep stable instructions, model, reasoning effort, and tool definitions at the
  front of the prompt. Put changing SHAs, results, and the immediate request last.
- Use one compaction system. OpenCode native auto-compaction and pruning are the
  default for this workspace; do not install a replacement compactor alongside it.
- Pass committed artifact paths and immutable ranges between roles. Do not paste the
  artifact body, complete logs, or prior reasoning.
- Query only the documentation concept needed for the current decision. Context7 is
  preferred for library and tool documentation; broad web-page ingestion is not.
- Use path-specific role prompts and repository instructions. Avoid copying global
  rules into every task packet.
- Keep Context7 and Playwright available because they serve distinct required lanes;
  avoid adding global MCP servers that are unused by most work.

## Review routing

- LOW: executor or planner self-check, then planner review.
- MEDIUM: one executor, one fresh QA review, then planner integration.
- HIGH: independent packet review, explicit approval, executor, and independent
  post-action QA. Add a wave auditor only for the triggers in `AGENTS.md`.

## Session checkpoint

Before compaction or a session reset, record only:

1. objective and current verdict;
2. exact branch/base/candidate SHA;
3. changed paths or committed artifact path;
4. completed decisive gates and remaining blocker;
5. custody for worktree, browser, runtime, and live-state file;
6. one next action.

## Configuration note

OpenCode's native compaction should remain `auto: true` and `prune: true`. The
previous `@cortexkit/opencode-magic-context` entry was removed because that plugin's
own setup requires native compaction and pruning to be disabled. Stacking the two
made ownership of compaction ambiguous and added an unused global tool surface.

## References

- OpenCode compaction: <https://opencode.ai/v2/docs/compaction>
- OpenCode instructions: <https://opencode.ai/v2/docs/instructions>
- GitHub Copilot usage optimization: <https://docs.github.com/en/copilot/tutorials/optimize-ai-usage>
- GitHub custom instructions: <https://docs.github.com/en/copilot/concepts/prompting/response-customization>
- OpenAI prompt caching: <https://developers.openai.com/api/docs/guides/prompt-caching>
- Anthropic prompt caching: <https://platform.claude.com/docs/en/build-with-claude/prompt-caching>
- Gemini context caching: <https://ai.google.dev/gemini-api/docs/generate-content/caching>
- Magic Context setup: <https://github.com/cortexkit/magic-context/blob/master/README.md>
