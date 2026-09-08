# Prompt SCA-03E-R — Decision Workspace Authority Closure

Date: 2026-09-08  
Risk: MEDIUM  
Execution target: fresh executor session  
Time budget: 35 minutes  
Verdict boundary: return `REVIEW_REQUIRED`; never declare formal `GO`  
Repository boundary: `D:/ATLAS` only

## Objective

Correct and close the SCA-03E decision workspace before any SCA-04 apply or
demand integration. Remove operator decisions and curriculum policy from
production constants while retaining a fast, explicit operator workflow for
creating a decision draft from current persisted evidence.

SCA-04 remains locked. This prompt authorizes no curriculum apply, term-config
write, Teaching Load mutation, timetable generation, publication, schema
change, migration, process restart, or external-repository edit.

## Mandatory startup reads

Read completely before editing:

1. `D:/ATLAS/AGENTS.md`
2. `D:/ATLAS/ATLAS_AGENT_KI.md`
3. `D:/ATLAS/phasePlan.md`
4. `D:/ATLAS/docs/reference/atlas-runtime-source-of-truth-map.md`
5. `D:/ATLAS/docs/prompts/subjects-curriculum-authority-00-sequence-2026-09-07.md`
6. `D:/ATLAS/docs/progress/subjects-curriculum-authority-2026-09-07-progress.md`
7. `D:/ATLAS/docs/verification/subjects-curriculum-operator-decisions-2026-09-08.json`
8. This prompt and its planner manifest
9. Every production and test file listed under the edit boundary below

Run `git status --short` before editing. The worktree contains active Teaching
Load, dashboard/evaluator, and timetable streams. Attribute every existing
hunk and preserve unrelated work exactly.

## Verified blocker

`atlas-server/src/services/curriculum-decision-candidates.service.ts` contains
`ESTABLISHED_SPECIALIZATION_DECISIONS`, including explicit subject codes,
grades, actions, and descriptions for Applied Physics, Robotics, and Research.
It converts those source constants into `PRE_RESOLVED_SPECIALIZATION` rows.

The decisions themselves reflect earlier operator statements, but production
code is not a persisted decision authority. Keeping them in the service would
make a future school/year or curriculum inherit historical choices from code.
This violates the stream contract that subject identity, specialization count,
classification, and applicability are configurable data rather than policy.

## Required tasks

### SCA-03E-R.0 — Preflight and attribution (LOW)

- Record HEAD, exact dirty-file inventory, active database name only, port-5001
  PID, and current SCA-03E route availability.
- Classify every allowed-file hunk as SCA-03E or pre-existing concurrent work.
- Add separate task rows to the existing SCA progress ledger.
- Do not restart or mutate the live runtime.

### SCA-03E-R.1 — Remove code-owned decisions (MEDIUM)

- Delete the production constant and all behavior that treats the six rows as
  established, approved, locked, or pre-resolved merely because their
  subject/grade/program matches code.
- Candidate reconstruction may use persisted ATLAS subjects, active section
  mirrors, annual ownership evidence marked `SUGGESTION_ONLY`, persisted term
  configuration, and persisted current-year requirements.
- With zero persisted current-year requirements, every reconstructed candidate
  must remain unapproved and editable. No subject code, grade, program,
  specialization count, classification, action, or term identity may receive
  authoritative status from a production constant.
- Existing persisted requirements may be shown as persisted state, but must not
  be confused with ownership suggestions or silently rewritten.
- Preserve the ability to represent any number of specialization subjects.

### SCA-03E-R.2 — Preserve operator efficiency without hidden authority (MEDIUM)

- Keep the workspace's explicit per-row decision, bulk selection/bulk
  classification, term draft, preview, export, and restore workflow.
- Prior operator choices may enter the workspace only through an operator
  action such as restoring/importing a decision draft whose contents are shown
  for confirmation. They must not be imported automatically from source code,
  a superseded preview, a school-specific filename, or a server default.
- A restored draft must be schema/scope/source-revision validated and visibly
  remain a draft. It must not write terms or requirements and must not unlock
  SCA-04.
- Do not require 233 individual confirmations when an explicit bulk action can
  safely express the operator's decision. Bulk operations must skip no rows
  silently and must report affected/held-out counts.

### SCA-03E-R.3 — Executable authority and lifecycle tests (MEDIUM)

Add or update focused tests proving through production functions/routes that:

1. Applied Physics, Robotics, and Research receive no special status from their
   codes alone.
2. The same candidate data under another school/year receives no inherited
   decision.
3. Zero persisted requirements yields zero pre-approved/locked candidates.
4. Ownership remains `SUGGESTION_ONLY` and never becomes curriculum authority.
5. A third or fourth specialization remains representable.
6. Explicit draft restore can reproduce the six operator choices without any
   server-side constant or database write.
7. Wrong school/year, stale source revision, malformed draft, unknown row,
   duplicate row, and partial bulk action fail closed with visible errors.
8. No apply/term PUT is dispatched by preview/export/restore.

Include a negative-control mutant or fixture showing the tests fail if a
code-matched row is automatically marked pre-resolved again.

### SCA-03E-R.4 — Focused rendered verification (MEDIUM)

- Run the affected server/client tests, both TypeScript checks, and one client
  build only if UI/import code changes.
- Verify the existing Tailnet runtime read-only at desktop and 390px mobile.
  Do not restart port 5001. If the current runtime is stale relative to the
  corrected source, label browser proof `PENDING_DEPLOY`; do not weaken source
  acceptance and do not deploy in this prompt.
- Confirm no horizontal page overflow, no mojibake, clear draft/authority copy,
  and usable keyboard-accessible bulk controls.
- Capture before/after signatures proving zero term-config, requirement,
  Teaching Load, generation-run, and publication writes. Permitted login audit
  effects must be separately identified.

### SCA-03E-R.5 — Reconcile and advisory review (MEDIUM)

- Update the SCA ledger with exact files, commands, counts, exit codes,
  negative controls, runtime status, and remaining risks.
- Obtain one fresh advisory reviewer that did not implement this pass. Give it
  this prompt, the manifest, changed-file inventory, and exact commands.
- Fix every material in-scope finding. After fixes, obtain one fresh
  changed-scope review. Stop after the latest review reports zero material
  findings; do not require ceremonial repeated zero-finding reviews.
- The advisory reviewer cannot issue formal GO or unlock SCA-04.

## Edit boundary

Allowed only when needed for this correction:

- `atlas-server/src/services/curriculum-decision-candidates.service.ts`
- `atlas-server/src/routes/curriculum-requirements.router.ts`
- `atlas-server/src/__tests__/curriculum-decision-candidates.test.ts`
- `atlas-client/src/pages/DecisionWorkspace.tsx`
- `atlas-client/src/lib/decision-draft.ts`
- `atlas-client/src/lib/__tests__/decision-draft.test.ts`
- `atlas-client/src/components/decision-workspace/**`
- `docs/progress/subjects-curriculum-authority-2026-09-07-progress.md`
- `docs/reviews/subjects-curriculum-authority-2026-09-07/**`

Do not edit `App.tsx` or `CurriculumRequirements.tsx` unless a failing test
proves a correction is indispensable; if so, stop and report the exact needed
hunk instead of crossing the boundary. Do not edit Teaching Load, timetable,
dashboard/evaluator, generation, subject catalog, schema/migrations, auth,
backup/recovery, `.env`, or companion-system files.

## Focused gate ceiling

Run only:

1. SCA-03E candidate tests.
2. Decision-draft tests.
3. Any directly affected existing curriculum truth/concurrency suite, once.
4. Server and client `tsc --noEmit`.
5. One client build only when a client production file changed.
6. `git diff --check`.
7. One bounded read-only Tailnet browser/API matrix.

Do not run historical recovery, full timetable, full Teaching Load, or broad
repository matrices. If an unrelated concurrent-stream compile error blocks a
global check, prove it is unrelated by file/diagnostic attribution and report
it; do not edit that stream.

## Exit criteria

Return `REVIEW_REQUIRED` only when:

- production source contains no code-owned operator/curriculum decisions;
- all zero-persisted-requirement candidates remain unapproved;
- operator draft import/restore is explicit, validated, non-persisting, and
  efficient through bulk actions;
- the focused gates and negative control pass;
- live data signatures prove zero unauthorized writes;
- one fresh advisory review reports zero material findings;
- SCA-04 is still explicitly locked.

If time reaches 35 minutes, finish the current atomic check, reconcile the
ledger, and return the truthful incomplete state. Do not start extra tests or a
new review iteration after the time budget.

## Required final report

Report:

1. verdict;
2. exact changed files;
3. before/after authority behavior;
4. exact source of every prefilled decision, if any;
5. tests, counts, exit codes, and negative controls;
6. live/static UI evidence and runtime freshness;
7. before/after zero-write signature;
8. advisory reviewer identity, findings, and fixes;
9. collision-boundary proof;
10. remaining operator decisions;
11. one next action.

Suggested commit after planner acceptance:

```text
fix(curriculum): remove code-owned decisions from the operator workspace
```
