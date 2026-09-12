# TL/TT C03R parallel source cycle — planner handoff

Role: `PRIMARY_PLANNER`

Activation: `CYCLE ON: complete TL-SUGGESTION-C03R and TT-OUTPUT-C03R through independent QA, without integration or live mutation.`

## Planner boundary

You are the bounded planner for two parallel source lanes. You own executor
dispatch, immutable-range verification, fresh delegated QA, correction routing,
and durable lane capsules. The upstream head planner retains integration,
`origin/main` push, living-register edits, runtime deployment, and every HIGH
action.

Do not make the user relay executor reports to QA. Spawn and coordinate the
roles yourself. Keep the planner turn open while either lane is running. Use
bounded waits and state-change-only updates.

Read `AGENTS.md`, `docs/reference/atlas-runtime-source-of-truth-map.md`, and
`docs/plans/atlas-active-delivery-streams.md`. Fetch `origin/main` for reference
only. Do not merge, rebase, or pull it into either existing candidate worktree.

## Lane A — Teaching Load suggestion authority

Governing packet:
`docs/prompts/teaching-load-suggestion-authority-c03r-resume-2026-09-12.md`

- Worktree: `D:\ATLAS-worktrees\tl-suggestion-c03`
- Branch: `work/tl-suggestion-c03`
- Accepted base: `4e5ef1f60193a8225af7bceac13a34a4c126152d`
- Existing diagnostic commit: `2292b25dc4389389a45fc4aa17cb464e18d12598`
- Required inherited dirty paths: the three paths named by the governing packet
- Required inherited binary diff hash:
  `c52898a3f5e71c81c40e208ace4055044cbd1c7f`

Before dispatch, verify the worktree still matches that boundary. If it does
not, stop only Lane A and report the exact discrepancy. Never reset, stash,
clean, restore, or discard inherited work.

Spawn one `ROLE: EXECUTOR` to complete the packet in the same worktree. The
executor commits additive correction commits and returns `REVIEW_REQUIRED`.
The executor must not spawn a duplicate general advisory reviewer.

After the executor returns, independently verify ancestry, worktree cleanliness,
complete changed paths, and the highest-risk production paths. Then spawn one
fresh `ROLE: DELEGATED_QA` with the exact base-to-source-candidate range and the
governing acceptance matrix. QA is read-only and returns the mandatory tally
and exactly `ACCEPT_READY`, `CORRECTION_REQUIRED`, or
`PLANNER_DECISION_REQUIRED`.

If QA returns `CORRECTION_REQUIRED`, send one bounded correction to the same
executor session, preserving history, then use a fresh QA context on the new
exact range. After a second substantive correction, stop and return to the head
planner instead of growing another patch loop.

## Lane B — Timetable beneficiary outputs

Governing packet:
`docs/prompts/timetable-beneficiary-output-c03r-2026-09-12.md`

- Worktree: `D:\ATLAS-worktrees\tt-output-c03`
- Branch: `work/tt-output-c03`
- Accepted base: `4e5ef1f60193a8225af7bceac13a34a4c126152d`
- Existing clean candidate: `378a1f710e913837cc79f0e2424939fa145ac8aa`

The DNO Monday–Friday class-program output is mandatory. Also treat the fresh
review findings in the governing packet as mandatory: real constructor
Monday-only eligibility, main `TimetableGrid`/placement-conflict day scope,
weekday-preserving workbook/matrix cells, and stale-run fail-closed behavior.

Spawn a separate `ROLE: EXECUTOR` in the existing clean worktree. Preserve all
four existing commits and add corrections without amend/rebase/squash. Follow
the same immutable-range verification, fresh delegated-QA, and one-correction
budget used for Lane A.

## Parallel and safety rules

The two executors may run in parallel. Their product ownership is disjoint.
Tests may run concurrently only when they do not use the shared recovery
database, shared browser profile, ports 5001/5174, or the live Tailnet runtime.

The active `TT-TL-RUNTIME-ACCEPTANCE` planner owns the shared supervisor,
runtime packet, machine environment, Windows task, ports 5001/5174, and living
register. This source cycle must not edit those surfaces or interact with that
runtime cycle.

Forbidden in both lanes:

- merge, rebase, squash, amend, or push to `main`;
- living-register, runtime-map, or shared `CHANGELOG.md` edits;
- live/shared database access or fixture creation;
- deployment, restart, listener/task/environment changes;
- Teaching Load apply, carry-forward, generation, publication, rollover,
  term-cache apply, migration, or schema change;
- companion-repository edits;
- live login or browser mutation.

## Durable QA capsules

The user must not have to copy executor and QA reports between chats. After a
lane reaches a terminal QA verdict, the bounded planner shall add exactly one
compact docs-only capsule on top of that lane's reviewed source candidate:

- Lane A: `docs/handoffs/tl-suggestion-c03r-planner-result.md`
- Lane B: `docs/handoffs/tt-output-c03r-planner-result.md`

Each capsule records:

- executor and QA task/session IDs;
- base, prior candidate, reviewed source candidate, and capsule commit SHA;
- exact source changed paths;
- QA verdict and mandatory total/passed/blocked/unperformed;
- checks independently rerun by QA versus reused evidence;
- findings and remaining risks;
- confirmation that the capsule is docs-only and was added after QA;
- exact next action for the upstream head planner.

Commit the capsule on the same lane branch after the reviewed source commit.
Do not call the capsule commit the reviewed candidate. Do not edit product/test
bytes after an `ACCEPT_READY` verdict. Do not push either branch unless the
upstream head planner explicitly requests it; all worktrees are locally shared.

## Terminal return

Return only after both lanes are terminal, or immediately if one requires a
real product/authority decision while the other may continue safely.

For each lane report:

- `ACCEPT_READY`, `CORRECTION_REQUIRED`, or `PLANNER_DECISION_REQUIRED`;
- reviewed source candidate and docs-only capsule commit;
- exact immutable range and worktree cleanliness;
- mandatory tally;
- remaining blocking/non-blocking risks.

Then report:

- running/awaited roles: none, or the exact still-running role;
- safe parallel work and locked successors;
- `RETURN_TO_HEAD_PLANNER: validate both capsules and integrate accepted source candidates from a clean current-main boundary.`

Do not integrate, push, deploy, or request HIGH approval.

Suggested capsule commits:

```text
docs(teaching-load): record TL suggestion C03R planner result
docs(timetable): record TT output C03R planner result
```
