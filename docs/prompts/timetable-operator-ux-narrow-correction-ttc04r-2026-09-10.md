# TT-C04R — Production No-Run Lifecycle Wiring Correction

## Verdict being corrected

TT-C04 candidate `4730583500c7fb506a7e3205a4008b7880fdec0c` is `NO-GO` for integration. The helper-level lifecycle model is not actually consumed by the production no-run header.

Planner QA reproduced the current school-1/year-8 state in the rendered candidate:

- Curriculum Requirements ready.
- No reviewable generated timetable.
- The latest generation run failed.
- Copy says to try generating again.
- The visible actions are `Start draft` and `Unassigned insertion`.
- The actual Generate button remains permanently hidden with `className="hidden"`.

Therefore the claimed single-primary-action lifecycle is not production-wired. The helper returns `retry-generate`, but the no-run branch bypasses `lifecycleAction` and `handleLifecycleAction`.

## Git boundary

- Continue in the existing session and worktree `D:/ATLAS-worktrees/timetable-ttc04` on `work/timetable-ttc04`.
- Current candidate: `4730583500c7fb506a7e3205a4008b7880fdec0c`.
- Do not amend, rebase, merge, or push. Add one correction commit.
- Client-only boundary remains in force. Do not touch server source, database state, generation data, publication data, configuration, port 5001, companion repositories, GEN-C01, or PUB-C01.

## Required correction

1. Make the real no-run header consume the same resolved lifecycle action used by the other branch. Do not leave a second hardcoded decision tree that can drift.
2. In the exact current state (scope resolved, curriculum ready, no reviewable run, newest run FAILED), render one visually primary action: `Try generating again`. It must invoke the existing guarded generation-confirmation workflow, not bypass confirmation or readiness gates.
3. For a ready no-run state without a failed attempt, render one visually primary next action selected by the established workflow. Keep `Start draft` and the preview-only unassigned explorer available only as clearly secondary/progressively disclosed tools; do not present two equal competing primary buttons.
4. Fail closed for unresolved readiness:
   - unresolved actor/year: disabled scope message and zero actionable generation/draft controls;
   - readiness loading: disabled `Checking setup` state;
   - readiness unavailable/failed: one retry/readiness-refresh action that cannot generate;
   - curriculum blocked: one Curriculum Requirements repair action;
   - curriculum ready: only then may generation/draft actions appear.
5. Remove the permanently hidden Generate control and any stale copy/action mismatch.
6. Preserve TT-C02 preview-only behavior: no apply endpoint, no enabled placement save, no timetable write.
7. Preserve the prior TT-C04 fixes for publish blocking, HG exclusion, grouped repairs, state cleanup, 44px targets, and accessible names.

## Failing-first proof

Add a production-consumer test that fails against `47305835` because the current no-run branch bypasses `lifecycleAction`. A helper-only test or regex that merely proves the helper exists is insufficient.

The test must prove through the actual header render or an extracted production view-model consumed unconditionally by that header that:

- ready + latest failed -> exactly one primary `Try generating again` action;
- ready + no attempt -> exactly one primary action;
- blocked -> exactly one Curriculum Requirements repair action and no generation dispatch;
- loading/unavailable/failed readiness -> no generation dispatch;
- unresolved scope -> no request/action dispatch;
- the old hardcoded two-button no-run implementation or hidden-generate mutant fails.

## Focused verification

- `npm run test:timetable-operator-ux` with the added production-consumer assertions.
- Rerun the affected tracked client test set that exists in a clean worktree.
- Client `tsc --noEmit`, production build, and `git diff --check`.
- Do not claim `npm run test:timetable-conflict` passed if its ignored test files are absent. Record that clean-checkout packaging defect separately; do not import untracked tests from `D:/ATLAS`.
- Browser QA against the corrected candidate on a CORS-allowed isolated origin such as `http://localhost:5175` or `:5176`, never `127.0.0.1:5184`:
  - authenticate and open `/timetable`;
  - desktop 1280x720 and mobile 390x844;
  - confirm current failed/no-run state exposes `Try generating again` as the sole primary action;
  - verify keyboard reachability, visible focus, 200%-zoom-equivalent reflow, no global/horizontal overflow, no mojibake, and no application errors;
  - instrument or otherwise prove that the QA session dispatches no generation/save/publish request. Do not click the generation action.
- Obtain one fresh changed-scope advisory review. Stop after the first zero-material-finding result.

## Handoff

Commit one new correction commit and return:

- original base, TT-C04 commit, correction commit, and complete candidate SHA;
- exact changed paths;
- before/after production action matrix;
- failing-first and passing test evidence;
- desktop/mobile browser evidence and zero-write/no-dispatch proof;
- the clean-checkout conflict-test packaging note;
- `REVIEW_REQUIRED`.

Suggested commit:

```text
fix(timetable): wire no-run lifecycle into the production header
```
