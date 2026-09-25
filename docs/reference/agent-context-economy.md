# Agent Context Economy

This is a non-normative operating note. `AGENTS.md` remains the authority.

## Defaults

- Start a fresh session at a durable lane boundary, not during an uncommitted
  correction, browser handoff, or HIGH action. The prior lane must have a committed
  handoff and must release browser, worktree, runtime, and register custody.
- Keep stable instructions, model, reasoning effort, and tool definitions at the
  front of the prompt. Put changing SHAs, results, and the immediate request last.
- Use one compaction system. OpenCode native auto-compaction and pruning are the
  default for this workspace; do not install a replacement compactor alongside it.
- Pass committed artifact paths and immutable ranges between roles. Do not paste the
  artifact body, complete logs, or prior reasoning.
- **Batch independent shell checks into one call.** Each extra call is a full
  round-trip through the context.
- **Cap every output** — `-First`, `--oneline`, `--stat`, `-Tail`. Never dump a whole
  file, a directory listing, or a JSON payload into context.
- Query only the documentation concept needed for the current decision. Context7 is
  preferred for library and tool documentation; broad web-page ingestion is not.
- Use path-specific role prompts and repository instructions. Avoid copying global
  rules into every task packet.
- Keep Context7 and Playwright available because they serve distinct required lanes;
  avoid adding global MCP servers that are unused by most work.
- **Keep `AGENTS.md` short.** Detailed test matrices and domain contracts belong in
  referenced files under `docs/`, not in the directive itself; every agent pays for
  every line of it on every request.

## Review routing

- LOW: executor or planner self-check, then planner review.
- MEDIUM: one executor, one fresh QA review, then planner integration.
- HIGH: independent packet review, explicit approval, executor, and independent
  post-action QA. Add a wave auditor only for the triggers in `AGENTS.md`.

## Batching gates and turn shape

The two levers that actually move measured cost (figures in
`docs/reviews/workflow-cost-tracking.md`):

1. **One reviewer dispatch per pre-action, one per post-action.** A HIGH cycle's pre-action
   reviewer closes the source range **and** the packet satisfiability lint in a single pass and
   returns one verdict with per-row tallies; the post-action QA closes every deployment row plus
   the independent zero-write corroboration. Target **≤ 2 reviewer dispatches per accepted
   release**. Write the reviewer's scope into the packet as one section so the batching is
   designed rather than improvised. Do not dispatch a reviewer to re-derive a fact an earlier
   dispatch already established, and do not run a second round because a *packet's* wording was
   wrong when the fix is documentation-only — the planner corrects and verifies that.
   *Why it is safe:* the reviewer that also lints the packet is the one best placed to notice the
   packet is unsatisfiable; on 2026-09-21 exactly that batching falsified the packet's own D4
   before the deployment ran.
2. **Fewer, longer planner turns.** The dominant cost is context re-read *per message*: every
   extra turn re-pays the whole prefix, and a fresh session additionally re-pays cache setup.
   Finish a cycle inside one turn unless a real decision or approval is needed. Never split one
   coherent delivery across turns to report progress.

**Measured shape, 2026-09-21 (ATLAS project only, `opencode stats --project ""`):** 1 day **$4.85
/ 45 sessions / 3,191 messages**; 7 days **$65.65 / 28,680 messages**; 30 days **$116.97 / 60,478
messages**. **96.7% of 7-day spend is one model** (`deepseek-v4.1-flash`), which covers the planner
**and** QA/reviewers; muse executors are ~2%. The money therefore goes to **planning and
verification**, not implementation — which is where the gates earn their keep, and also exactly
where these two levers bite.

**Keep the living handoff short.** It is re-read by every fresh session; left unchecked it grows
until reading it costs more than the state it carries. Put narrative in packets and evidence and
keep the handoff to: current verdict, live identity, custody/dispositions, decisions awaited, one
next action.

## Executor loop shape

Observed 2026-09-25 (Lane C, SCHEDULE-CLARITY-C03): about 120 tool calls at a context of 300k+ tokens used up most
of a 5-hour plan window. The single-file reads and edits, not the work itself, re-paid that context each time.

- **Read once, in bulk.** Collect every file region a change needs in one shell call
  (`sed -n` ranges, `grep -n -A`), then edit. Do not alternate read, edit and read.
- **Group edits by file.** Make every change to one file in one edit pass. Group files a change touches together
  into one step when the edit is mechanical.
- **Run the full suite once per candidate,** after the focused tests pass and every superseded assertion is
  updated. Before that, run only the affected test files. A full run that starts while tests are still being
  edited is wasted.
- **Record the base failure names** in the handoff (or a scratch file named by base SHA) the first time they are
  computed. A later candidate on the same base compares against that list instead of re-running the base suite.
- **Browser evidence as text:** use `get_page_text`, `find` or `javascript_tool` returning a small JSON object;
  take screenshots only when layout is the question, at a reduced scale.
- **Start a fresh planner session at a lane boundary:** when QA verdicts arrive, after a deploy, or when context
  passes about 200k tokens. Write the handoff first (see below).

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
