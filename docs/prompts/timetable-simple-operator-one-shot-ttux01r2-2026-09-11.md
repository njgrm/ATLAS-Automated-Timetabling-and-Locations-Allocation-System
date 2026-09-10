# TT-UX01R2 — Simple Timetable operator closure (overnight one-shot)

## Objective

Correct the Simple Timetable so an older scheduler can understand the current
state, reach the important class-level repairs, interpret every placement or
swap result, and know exactly what will happen before and after a write. Unify
Simple and Advanced generation authority without turning Simple into the
expert workspace.

This prompt supersedes
`docs/prompts/timetable-ux-one-shot-ttux01r-2026-09-11.md`. Preserve its valid
findings, but use this prompt as the complete execution contract.

## Immutable execution boundary

- Worktree: `D:\ATLAS-worktrees\timetable-ux-01`
- Branch: `work/timetable-ux-01`
- Recorded review base: `aab8fb00`
- Current candidate: `aa38d7845ed7fafa79638b9512b584c29400d48e`
- Begin only if the worktree is clean and HEAD equals the current candidate.
- Add correction commits. Do not amend, rebase, squash, merge, or push.
- ATLAS source only. EnrollPro, AIMS, SMART, and all companion repositories are
  `READ_ONLY`.
- Default edit scope: Timetable client components/hooks/libs/tests plus the
  TT-UX01 progress ledger, review artifacts, and `CHANGELOG.md`.
- Do not edit Teaching Load allocation/reconciliation source, derived-demand
  server authority, schema/migrations, auth, rollover, publication, external
  repositories, or shared runtime configuration.
- If a server contract defect prevents truthful UI behavior, stop at
  `PLANNER_DECISION_REQUIRED` with the exact route/service evidence. Do not
  silently widen the scope.

Read before editing:

- `AGENTS.md`
- `ATLAS_AGENT_KI.md`
- `docs/reference/atlas-runtime-source-of-truth-map.md`
- `docs/verification/timetable-simple-operator-audit-2026-09-11.md`
- `docs/plans/atlas-active-delivery-streams.md` (read-only to this executor)
- the existing TT-UX01 progress ledger and review artifacts

## Absolute safety rules

The live Tailnet environment is read-only for this pass. Do not trigger live
generation, save a timetable edit, swap sessions, create a run, publish,
change Teaching Load, apply curriculum/demand data, run a migration, or restart
port 5001. Opening a final generation confirmation and cancelling it is the
furthest permitted live action, and only when the current source/runtime makes
that confirmation safely reachable.

Use controlled browser fixtures for all data-filled or write-capable paths.
Intercept and record their network requests; do not point fixture mutations at
the live server or database.

## Required product corrections

### R1. One lifecycle and generation decision everywhere

Use one pure, actor-school/current-year capability model for Simple and
Advanced mode. It shall distinguish at least:

- unresolved actor/year;
- setup/term authority loading or unavailable;
- setup blocked with a reachable repair;
- ready but no run;
- generation in progress;
- latest run failed with retry available;
- generated with unresolved/hard issues;
- generated and reviewable;
- published/read-only.

Every Generate trigger—including menu items, mobile/desktop actions, hidden
legacy controls, and Advanced header actions—must use this model. Remove dead
or duplicate triggers. Never show `GENERATED RUN #-`, `schedule is clean`,
Review, Publish, placement, swap, teacher departure, or edit history as usable
run operations when no applicable run exists.

When generation is eligible, the confirmation must visually summarize:

- actor school and current school-year label;
- ordered term identities/source state;
- derived demand/session count;
- Teaching Load owner coverage and unresolved count;
- retained draft anchors or locked sessions;
- what generation creates and what it does not publish;
- Cancel and one unambiguous Generate action.

Do not trigger generation during live QA.

### R2. Remove the superseded Curriculum Requirements repair path

No Timetable action or help text may send the normal operator to
`/curriculum-requirements` or imply that duplicate year-specific curriculum
entry is the intended repair. If EnrollPro ordered term authority is missing,
unreachable, stale, or ambiguous, show that exact state and route the scheduler
to the single Year Setup/status surface. If derived demand is not yet available
from the integrated runtime, state that honestly; do not invent a local
operator workflow.

### R3. Put routine class repair in Simple mode

For a selected scheduled class, Simple mode must make these operations easy to
find and accurately named:

- Move time;
- Change room;
- Swap sessions;
- View class details;
- Repair Teaching Load owner, when owner authority is the issue.

Do not label the bulk Teacher Leaving workflow as `Change teacher` or
`Reassign teacher` for one selected class. Keep Teacher Leaving as a separate,
run-scoped bulk task with an impact explanation. If owner repair belongs on the
Teaching Load page, deep-link to the exact subject/section/faculty context and
explain that changing ownership affects the timetable.

Expose room requests and input-status review from Simple only when they are a
current blocker or an appropriate secondary task. Keep policy administration,
campus-map administration, global setup sync, full matrix, diagnostics, and
tactical sandbox in Advanced.

### R4. Make placement states visually self-explanatory

During placement or room/time repair:

- show a compact persistent legend beside the active task;
- label candidate cells with icon plus text (`Place`, `Swap`, `Warning`, or
  `Blocked`) rather than color alone;
- show the affected class, teacher, room, day/time, decisive reason, and next
  action for the selected/hovered candidate;
- distinguish an occupied swap target from an empty placement target;
- keep blocked targets non-committable;
- use progressive disclosure for secondary details.

Do not rely on tooltips as the only source of essential information. Avoid raw
constraint codes in the default view; retain them only in an expandable
technical-details region.

### R5. Make swap outcomes actionable

Exercise and correct generated and draft swaps in all three states:

- clean;
- warning-bearing but permitted;
- blocked.

A blocked result must list each decisive blocker in plain language, identify
the affected class/teacher/room/time, explain why the swap cannot proceed, and
offer one reachable repair or Cancel. A warning-bearing result must group the
important warnings, explain their consequence, show a bounded initial list
with Expand, and never hide hundreds of warnings behind a number. No Commit
action may exist while any hard blocker remains.

### R6. Make write behavior and recovery honest

Choose and consistently implement one of these contracts for clean placement:

1. explicit before/after review followed by Save; or
2. a clearly labeled one-click `Place now` action followed immediately by a
   prominent Undo strip.

Do not claim that every action is reviewed before saving if a clean path
auto-commits. Warning-bearing and occupied/swap actions always require an
explicit review. While saving, prevent duplicate submission. On stale version,
network failure, or server rejection, preserve the operator's selection,
explain what changed, and offer Retry or Refresh without pretending the edit
was saved.

### R7. Replace walls of text with state-aware guidance

Use a compact task-first hierarchy:

1. current lifecycle/status;
2. one primary action;
3. concise blocker or warning summary;
4. expandable explanation and expert details.

Make the tutorial/help state-aware. No-run help teaches setup and generation;
generated-run help teaches select, preview, save, and Undo; published help
explains read-only history. It must not point to unavailable controls or repeat
false save semantics.

Use existing shadcn/Radix, motion, Lucide, and ATLAS/SMART-family tokens. Do not
introduce another design language. Prioritize readable labels and visual
grouping over cold paragraphs.

### R8. Derive capability gates per action

Do not reuse one broad boolean for unrelated operations. Derive and test
separate gates for:

- choosing schedule view;
- setup/input status;
- room requests;
- Move;
- Change room;
- Swap;
- Teaching Load owner repair;
- issue review;
- generation;
- publication.

Disabled actions must remain discoverable only when that helps the user, and
must expose a short reason plus one reachable next action. Otherwise omit them.

## Mandatory click-path audit

Create a machine-readable or Markdown matrix covering every visible clickable
Timetable control in both modes. Each row must record:

- surface and state;
- visible label;
- precondition/capability gate;
- click result/destination;
- expected network method/path, if any;
- whether a write is possible;
- disabled/blocked explanation;
- browser evidence/result.

At minimum exercise:

- Simple header, lifecycle card, schedule chooser, run chooser, filters, More,
  tutorial/help, status key, export, refresh, unresolved placement, selected
  class menu, Move, Change room, Swap, owner repair, teacher leaving, room
  requests/input status, issue review, edit history/Undo, Advanced entry;
- Advanced header Generate/Publish/undo/sync/policy/map/input-status/requests;
- all dialogs, sheets, drawers, confirmations, errors, Cancel/Close/Back, and
  empty/loading/degraded branches reachable from those controls.

Keyboard-shortcut discovery is not a priority. Basic focusability and Escape
behavior still must not regress.

## Browser fixtures and scenarios

Use Playwright or the repository's established browser harness against the real
production Timetable components. Do not replace the feature with a mock page.
Stub the network boundary with realistic response bodies and record attempted
writes.

The controlled scenarios must include:

1. unresolved actor/year — zero API dispatch;
2. current year, no term authority;
3. current year, setup ready, no run;
4. latest run failed with an older completed run;
5. generated run with scheduled entries;
6. generated run with missing owner, missing room, and no safe slot;
7. clean, warning, and blocked Move/Change room candidates;
8. clean, warning, and blocked generated swaps;
9. clean, warning, and blocked draft swaps;
10. stale-version conflict and network failure;
11. successful edit with visible Undo;
12. published/read-only schedule.

Use non-trivial names and enough rows to expose truncation, overflow, and
warning grouping. Include a high-warning swap case so count-only copy cannot
pass.

## Live Tailnet QA

Target `https://njgrm.buru-degree.ts.net` by default and resolve the scheduler's
school/year dynamically through the authenticated runtime. Do not hardcode
school 1 or a school year in production behavior.

Perform read-only browser QA at:

- desktop 1280x720;
- mobile 390x844;
- a 200%-zoom equivalent or narrow desktop layout.

Verify login, no-run truth, schedule chooser, menus, help, repair destinations,
responsive layout, readable hierarchy, no horizontal page overflow, no
mojibake, and no unexpected console/page errors. Record all POST/PUT/PATCH/
DELETE attempts and require zero during live QA. If generation becomes
eligible, open only the final confirmation, verify its contents, cancel, and
prove no generation request was sent.

Do not claim live data-filled placement/swap readiness from this environment
unless a real current-year generated run already exists without mutation. Use
the controlled browser scenarios for those claims.

Save a small, representative screenshot set: no-run desktop/mobile, generated
Simple workspace, selected-class repair menu, labeled placement targets,
warning swap, blocked swap, stale-write recovery, and published read-only.

## Failing-first and regression requirements

Before each correction family, add a test that fails against the current
candidate for the claimed defect. Required detectors include:

- no `/curriculum-requirements` repair text/destination in Timetable;
- all generation triggers consume the same readiness decision;
- no-run states expose zero usable run-only operations;
- Simple selected-class Change room exists;
- selected-class owner repair cannot open the Teacher Leaving bulk flow;
- placement cells expose semantic text/icon states, not color only;
- blocked/warning swaps render human conflict details, not counts alone;
- hard blockers remove/disable Commit;
- clean-write help matches actual review-or-one-click behavior;
- stale/write failure preserves context and exposes recovery;
- state-aware help omits unavailable steps;
- no live write request occurs in the Tailnet matrix.

Do not satisfy these with source-string scans alone. Use pure domain tests for
decision logic, rendered component tests for controls/copy, and Playwright for
integrated interaction and responsive evidence.

## Focused gates

Run:

1. the existing Timetable operator UX suite;
2. new rendered/component interaction tests;
3. the controlled Playwright scenario matrix;
4. client `tsc --noEmit`;
5. client production build;
6. `git diff --check` over `aab8fb00...HEAD`;
7. the read-only live Tailnet matrix.

If no server file changes, do not burn time on unrelated server suites. If an
authorized client test command is missing or broken, repair only the narrow
test harness needed by this prompt and report it.

## Independent review loop

After implementation and all gates pass, spawn one fresh independent reviewer
for the complete range `aab8fb00...<candidate>`. The reviewer must inspect real
rendered behavior and the production component path, not only test names or
screenshots. If it finds a bounded defect, add a new correction commit, rerun
the affected gates, and use a fresh changed-scope reviewer. Do not rewrite
previously handed-off commits.

Stop and return to the primary planner if review requires server authority,
derived-demand implementation, Teaching Load changes, external-system edits,
live generation, or another HIGH action.

## Commit and final handoff

Stage only the bounded Timetable client source/tests and concise durable
TT-UX01 evidence. Verify the staged path list and `git diff --cached --check`,
then create conventional additive commit(s). Do not merge or push.

Return:

1. `REVIEW_REQUIRED` (never self-declared GO);
2. original base SHA and final candidate SHA;
3. exact changed paths and commits;
4. before/after lifecycle and capability matrix;
5. every-control click-path matrix location and summary;
6. placement/swap scenarios and human explanations proven;
7. Simple-versus-Advanced decisions;
8. exact test counts and command exit codes;
9. live Tailnet no-write evidence and observed runtime year/run state;
10. screenshot paths;
11. independent review findings and corrections;
12. remaining risks and the single next planner action.

Suggested commit:

```text
fix(timetable): make simple scheduling tasks guided and unambiguous
```
