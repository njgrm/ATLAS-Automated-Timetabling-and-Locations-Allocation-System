# TT-UX01R — close remaining Timetable no-run and split-brain controls

## Execution boundary

Continue in the existing worktree and branch:

- Worktree: `D:/ATLAS-worktrees/timetable-ux-01`
- Branch: `work/timetable-ux-01`
- Current candidate: `aa38d7845ed7fafa79638b9512b584c29400d48e`
- Original review base: `aab8fb002fb54d0f009525fd68ddc99b9baa5f88`

Do not amend, rebase, merge, push, restart port 5001, generate, save a draft,
publish, migrate, or mutate live data. Do not edit server, Teaching Load,
derived-demand, term-authority, publication, schema, or companion-system
source. EnrollPro, AIMS, and SMART are READ_ONLY.

Retain the accepted TT-UX01 fixes. Add one or more additive correction commits
and return one complete immutable candidate.

## Corrections

### R1. Replace the dead and superseded repair destination

- Remove every active Timetable link, handler, and label that sends an operator
  to `/curriculum-requirements` or tells them to fix Curriculum Requirements.
- Until DEMAND-C01 supplies the replacement readiness contract, use the single
  protected Year Setup surface (`/admin/year-setup`) and neutral wording such
  as `Review year setup`.
- Do not restore `/subjects/requirements`, implement derived demand, or invent
  term decisions in this correction.

### R2. One fail-closed capability model for Simple and Advanced mode

Create or extend a pure client decision helper that derives distinct
capabilities from:

- positive integer actor school ID;
- positive integer active school-year ID;
- setup/readiness state;
- rollover drift;
- generated-run existence and status;
- pre-generation-draft state;
- loading/generating state.

Both headers must consume it. Do not leave parallel ad hoc `disabled`
expressions that permit a broader action than the shared model.

At minimum:

- generation and regeneration are unavailable unless scope is resolved,
  readiness is explicitly ready, drift is safe, and no request is in flight;
- generated-session review/place/issue actions require a reviewable generated
  run;
- pre-generation placement actions require a pre-generation draft;
- publish requires a reviewable current run, zero hard blockers, and zero
  unresolved sessions;
- a failed latest run is history, not a reviewable schedule.

### R3. Make Advanced mode truthful with no run

- With no run, Advanced mode must not default to `Review schedule`.
- Disable or omit Review, Place, Switch, Requests, run export, edit history,
  sync-current-run, and manual-repair controls when their required run is
  absent. Give a visible plain-language reason for disabled primary controls.
- Keep legitimate pre-generation planning, policy, map, and input-status work
  available only where its own prerequisites are satisfied.
- Never render zero violations, fully placed, clean, review-ready, or
  publish-ready merely because run-derived arrays are empty.

### R4. Remove dead-end no-run actions

- Disable or hide `Teacher leaving / Reassign load` when no reviewable run is
  loaded; direct the operator to Teaching Load for annual ownership changes.
- Split the current `runToolsAvailable` boolean into precise capabilities.
  A pre-generation draft must not enable generated-session `Place unresolved`
  or `Review issues` actions.
- Keep the selected-class `Change teacher` action available only when a real
  selected entry and its run context exist.

### R5. Make help contextual for older schedulers

- In the no-run state, the tutorial must teach only the current year/setup
  explanation and the one available next action. Skip or omit run-only steps;
  do not make the operator click `Show me` merely to learn that a target does
  not exist.
- Once a run exists, restore the relevant review, issue, placement, and publish
  steps.
- Keep every mobile touch target at least 44 by 44 CSS pixels and ensure icon
  buttons have accessible names.
- When the schedule selector is empty, show a visible reason in addition to an
  accessible disabled state. Ensure `aria-expanded=false` while disabled.

## Required failing-first controls

Add executable controls that would fail on `aa38d784` and pass after the
correction:

1. No active `/curriculum-requirements` link/copy remains on Timetable.
2. Advanced Generate/Regenerate cannot invoke the generation handler for
   unresolved scope, blocked/loading/failed/unavailable readiness, unsafe
   drift, or no confirmed readiness.
3. A ready no-run fixture exposes exactly one primary draft action and no direct
   generation call.
4. A blocked no-run fixture exposes exactly one Year Setup repair action.
5. Advanced no-run has no active Review/Place/Switch/Requests or teacher
   departure action and makes no clean/zero-violation claim.
6. A pre-generation fixture does not enable generated-session actions.
7. A reviewable-run fixture retains the intended review and repair controls.
8. A zero-hard/zero-unassigned run is the only unpublished fixture that may
   reach publish readiness.
9. No-run tutorial step set contains no absent run-only targets.
10. Disabled empty selectors expose a visible reason and `aria-expanded=false`.

Prefer behavioral render/click tests over new source-text assertions. A source
guard may supplement, not replace, the behavior proof.

## Browser QA

Serve the candidate from the worktree on an isolated Tailnet-reachable port and
proxy read-only API calls to the live ATLAS API. Intercept and fail any
`POST`/`PUT`/`PATCH`/`DELETE` request before it leaves the browser.

Test at least:

- 1280x720;
- 390x844;
- 640x360 or an equivalent short landscape viewport;
- keyboard-only traversal;
- 200% zoom or equivalent reduced CSS viewport.

For blocked no-run, ready no-run, failed-latest, pre-generation, and reviewable
run fixtures, click every visible header/menu/task/tutorial/selector control.
Prove one primary action, no dead end, no false run-derived claim, no global
horizontal overflow, no clipped deciding text, no mojibake, and zero issued
writes. Keep screenshots and a compact machine-readable click-path result as
durable tracked evidence or encode the same behavioral assertions in the
tracked test suite.

## Gates

Run:

- `npm run test:timetable-operator-ux`;
- all tracked client test files;
- client `npx tsc --noEmit`;
- client production build;
- `git diff --check aab8fb00...<candidate>`.

Obtain one fresh changed-scope advisory review after the final correction. The
reviewer must inspect the complete original-base-to-candidate range and the
actual production controls, not only test text.

## Handoff

Return:

1. `REVIEW_REQUIRED`;
2. original base SHA and final candidate SHA;
3. additive correction commits;
4. exact changed paths for the complete range and for TT-UX01R only;
5. capability matrix for blocked no-run, ready no-run, failed-latest,
   pre-generation, reviewable run, clean unpublished, and published states;
6. failing-first and passing test counts;
7. browser viewport/click-path/write-guard evidence;
8. advisory findings and fixes;
9. remaining risks;
10. confirmation of no live mutation, generation, publication, restart,
    server/Teaching Load/demand/term/external-source edits, merge, or push.

Suggested commit:

```text
fix(timetable): close no-run and advanced control bypasses
```
