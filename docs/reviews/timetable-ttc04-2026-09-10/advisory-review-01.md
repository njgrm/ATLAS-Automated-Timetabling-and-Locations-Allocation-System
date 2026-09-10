# Advisory Review 01 — TT-C04 Timetable Operator UX (fresh reviewer)

- Plan/prompt: `D:/ATLAS/docs/prompts/timetable-operator-ux-one-shot-ttc04-2026-09-10.md`
- Worktree: `D:/ATLAS-worktrees/timetable-ttc04`, branch `work/timetable-ttc04`
- Reviewer role: fresh advisory reviewer — did not implement the work.
- Execution-system/task context identifier: **no spawn/task/session ID was supplied to this reviewer in the
  review request.** I state this explicitly rather than inventing one: the parent request contained the review
  instructions but no verifiable execution-system identifier to repeat. Ledger entry below records
  `spawnId: none-provided`. If the orchestrator requires a pinned reviewer ID, this review must be
  re-issued with one; until then it is advisory evidence only, not formal acceptance.
- Date (UTC): 2026-09-10.

## Reviewed diff identity

- Base SHA: `6f8d121f6bf6ce5efc8c6e831b69ecdc795b8187` (HEAD == base; work uncommitted).
- `git diff --stat` (15 files, +263/−21; untracked: `atlas-client/src/lib/__tests__/timetable-operator-workflow-state.test.ts`,
  `docs/progress/timetable-ttc04-2026-09-10-progress.md`):

```
CHANGELOG.md                                       | 33 +++++++++
atlas-client/package.json                          |  1 +
ScheduleReviewWorkspaceHeader.tsx                   |  8 ++-
SimplePublishReadinessSheet.tsx                     | 29 ++++++--
TimetableSimpleHeader.tsx                           | 20 ++++++
UnassignedInsertionWorkflow.tsx                     |  1 +
modals/TimetableWorkflowDialogs.tsx                 |  4 +-
simple/SimpleHeaderHelpers.tsx                      | 13 +++-
simple/SimpleTaskDrawerHelpers.tsx                  | 18 +++--
simplePublishReadiness.ts                           | 10 ++-
timetableContexts.types.ts                          |  4 ++
useScheduleReviewWorkspaceState.ts                  | 81 ++++++++++++++++++++--
__tests__/timetable-ttc02-insertion.test.ts         | 14 ++++
simple-timetable-state.ts                           | 26 +++++++
timetable-ttc02-insertion.ts                        | 22 ++++++
```

- Worktree status at review: `M` on the 15 tracked files above, `??` on the new test + progress ledger.
  No server, schema, companion, `App.tsx`, or design-token paths touched. Client-only + CHANGELOG + ledger.
- Method: read the authoritative prompt and progress ledger first; traced each clause from
  `ScheduleReviewWorkspace` → `TimetableSimpleHeader` / `useScheduleReviewWorkspaceState` / `useTimetableData`
  into the changed helpers (wiring verified, not just exports); attempted the five adversarial bypasses;
  independently reran the focused suite and `tsc`. No source file edited, nothing committed, no server/ports/DB touched.

## Requirement-to-enforcement matrix

| Prompt clause | Production call site (wired, not merely exported) | Test |
|---|---|---|
| 1. One primary action per state (8 states) | `simple-timetable-state.ts:84-122` `deriveSimpleLifecycleAction` gains `resolve-scope` (scopeResolved===false wins first), `fix-setup` (curriculumState==='blocked'), `retry-generate` (no run + latestRunFailed); consumed as the single emphasized control by `TimetableSimpleHeader.tsx:151` + rendered at `:902-956` (`timetable-simple-primary-action`), routed at `:175-189` (resolve=no-op disabled; fix-setup→`/curriculum-requirements`; retry→`handleTriggerGenerate`) with header-supplied `scopeResolved`, `curriculumState`, `latestRunFailed` (`:156-161`, `:137-140`) | `timetable-operator-workflow-state.test.ts` legacy matrix + 3 new-kind tests incl. precedence negatives |
| 2a. No-run never "ready to publish" | `simplePublishReadiness.ts:271-290` (`!draft` summary branch, `isClean` requires `draft != null`, `hasGeneratedRun`); `SimpleTaskDrawerHelpers.tsx:163-180` (no-run banner, clean banner + publish button gated on `runId != null`); `SimpleHeaderHelpers.tsx:102-105` chip (`No … timetable yet` when `!draft`); sheet no-run banner `SimplePublishReadinessSheet.tsx:171-176` | no-run readiness test; drawer/sheet source-text + behavior tests |
| 2b. Previewability ≠ joint feasibility | `SimpleHeaderHelpers.tsx:117-118` (`N unresolved`, checked before warnings/ready); `TimetableSimpleHeader.tsx:306-311` startTask publish reroutes to readiness sheet when unassigned>0; copy `Preview and readiness checks alone cannot be published` in sheet + drawer | unresolved-beats-ready + unresolved-beats-warnings tests |
| 2c. Failed/stale/historical never reviewable/published | `TimetableSimpleHeader.tsx:140-142,833-837` (`latestRunFailed` banner `timetable-last-generation-failed-message`); `retry-generate` kind (never publish/review); failed flag cannot hijack a reviewable run (derivation order) | retry test + negative (failed flag + hasGeneratedRun → fix-blockers/publish) |
| 3. TT-C02 preview-only preserved | `UnassignedInsertionWorkflow.tsx:116-121` (`allowApply: false` hard-coded; only new wiring is `subjectCode` for the HG guard); save `Button` at `:290-298` has **no onClick** — dead/disabled control, `disabled={!preview \|\| !save.canSave}`; sole POST in file is `:95` `unassigned-workflow/preview` (read-only preview endpoint) | `insertion workflow stays preview-only` source-text test; pre-existing save-boundary tests intact |
| 4. Actionable blockers | Sheet `BlockerGroupRow` (`SimplePublishReadinessSheet.tsx:24-72`): plainLabel + count + why-it-matters + one repair action + `Show N more` disclosure (`aria-expanded`), `h-11` targets + `aria-label` with count. Drawer `BlockerGroupCard` same shape **except F1 below** | 44px/screen-reader source-text tests; readiness grouping test (plainLabel/actionLabel/nextStep non-empty) |
| 5. No-scroll / panels / colors / a11y | Diff touches none of: `ScheduleReviewWorkspace.tsx:196` root `h-[calc(100svh-3.5rem)]`, three-panel layout, `GradeLevelBadge`/DepEd colors, `ScrollArea` regions (sheet `ScrollArea` preserved). Adds `h-11` targets, `aria-label`s, `aria-expanded`, `role="status"`/`aria-live` already present at header `:890-893` | structural guardrail tests (no `h-7` repair targets); browser/keyboard/zoom/overflow QA **not executed here — deferred to planner QA as the ledger discloses** |
| 6. Stale cleared; draft ownership kept on run switch | `useScheduleReviewWorkspaceState.ts:831-870` `resetRunScopedUi` (selection, violation, preview, picker, inline status, undo, all hook dialogs incl. publish/swap/soft/pre-gen/generate/reset/leave/sandbox/blocker/drawer/swap-class/drag/kb/follow-ups/edit-history/show flags) called from `handleRunChange` and from the `[schoolId, schoolYearId]` effect, which additionally re-pins `selectedRunId='latest'`. `preGenPending/preGenPreview(+Error/+AllowSoftOverride)` are **not** in the run-scoped reset — cleared on school/year change only — so mere run switch cannot wipe draft-board ownership | Executor claims hook tests; this reviewer verified by code trace (state-machine tests here are derivation-level; the reset itself has no dedicated unit test — see O2) |
| 7. HG never demand/load | `timetable-ttc02-insertion.ts:81-85` `isHomeroomGuidanceCode` (exact `HG` or contains `HOMEROOM`, case-insensitive, trimmed); `placementSaveAvailability:144-150` HG short-circuit **before** the previewable branch → `Save blocked`; wired with real line code at `UnassignedInsertionWorkflow.tsx:120` (`previewLine?.subjectCode`) | spelling matrix + mislabeled-previewable-with-allowApply=true tests in both test files |

## Commands independently rerun (this review, worktree `atlas-client`)

- `npm run test:timetable-operator-ux` → **20/20 pass** (17 workflow-state + 3 insertion incl. HG/preview-only/grouping).
- `npx tsc --noEmit` → **exit 0**, no output.
- `git diff --check` → **clean** (PowerShell `$?` True).
- Broad suites deliberately not run per the prompt's decisive gates.

## Adversarial checks (each attempted, pass/fail)

- (a) unassigned>0 + hard=0 on every publish path → **PASS**. Simple task disabled (`SimpleHeaderHelpers.tsx:441-446`);
  `startTask('publish')` reroutes to readiness sheet (`TimetableSimpleHeader.tsx:309-312`); advanced header disabled +
  `Cannot publish: N session(s) still need placing` (`ScheduleReviewWorkspaceHeader.tsx:380-395`); dialog Publish
  disabled + `still need placing` copy (`TimetableWorkflowDialogs.tsx:84`).
- (b) draft==null on sheet/drawer clean blocks → **PASS**. `isClean` false without draft; sheet clean banner gated on
  `readiness.isClean`; drawer clean banner + publish button gated on `runId != null`, plus explicit no-run banner.
- (c) HG-coded INDIVIDUALLY_PREVIEWABLE line with allowApply=true → **PASS** (`canSave:false`, `Save blocked`);
  production call site additionally hard-codes `allowApply:false`, so this is defense-in-depth and correctly ordered
  before the previewable branch.
- (d) scope unresolved reaching generate/publish → **PASS with note**. The single emphasized primary action is
  disabled non-interactive `resolve-scope` and its handler is a no-op `break`; setup-blocked maps to repair, never
  generate/publish. Enforcement lives at the derivation + primary-action level (the prompt's requirement), not as a
  global guard on `handleTriggerGenerate` — other (CSS-hidden/advanced) triggers rely on pre-existing scope guards.
- (e) run switch leaving publish dialog/selection open → **PASS**. `resetRunScopedUi` clears hook-level publish dialog
  (`setShowPublishDialog(false)` + acknowledgement), selection, preview, inline status, undo, and all other hook
  dialogs; draft-board ownership (`preGenPending/preGenPreview`) is excluded from the run-switch reset by design.

## Findings

### Product/runtime (require fix before acceptance)

- **F1 (minor) — Drawer "Why it matters" renders a raw reason code, violating clause 5's plain-language rule.**
  `simple/SimpleTaskDrawerHelpers.tsx:192` (`BlockerGroupCard`): `group.items[0]?.reason` is a `SNAKE_CASE` code
  (`NO_AVAILABLE_SLOT`, `FACULTY_OVERLOAD`, … — see `simplePublishReadiness.ts:129-137,161-170,198-207`), while the
  sheet correctly uses `nextStep` (human text from `REASON_TO_NEXT_STEP`, `:71-78`). The drawer will show e.g.
  `Why it matters: NO_AVAILABLE_SLOT` where the sheet shows the plain-language sentence for the identical group.
  Required fix: use `group.items[0]?.nextStep ?? 'Fix this group before the schedule can be published.'` to match the
  sheet, plus one assertion pinning drawer copy contains no `SNAKE_CASE` reason rendering. One-line change; then one
  changed-scope re-review of `SimpleTaskDrawerHelpers.tsx` only.

### Process/docs (observations, no fix required)

- **O1 — No reviewer spawn ID exists to record.** The review request supplied no execution-system/task/session
  identifier, so none is repeated above beyond this explicit statement. Advisory evidence only; formal acceptance
  needs planner/QA review outside the executor tree with its own pinned identity.
- **O2 — `resetRunScopedUi` has no dedicated unit test.** Clause-6 reset is verified here by code trace + typecheck,
  not by an executable regression. Suggest (non-blocking): a reducer-level test seeding dialog/preview/undo state,
  invoking the run/scope transition, and asserting cleared flags plus preserved `preGenPending`. Left to planner QA
  whether to require it in the changed-scope pass.
- **O3 — Header-local UI (`readinessSheetOpen`, `insertionOpen`, active task) persists across run/scope switches.**
  Waived: contents re-derive from the new run/scope context (no stale timetable is presented as actionable), and the
  prompt's dialog/selection/preview/error clearing is satisfied at hook level. No fix.
- **O4 — Browser QA (1280×720 + 390×844 login, keyboard-only, 200% zoom, overflow, no-write-request) not executed.**
  Waived for this advisory pass: the ledger honestly discloses it as planner-QA follow-up, the diff is static-safe
  (no layout-root, panel, scroll-region, or color changes; targets/ARIA only improve), and hermetic gates pass.
  Formal acceptance still needs the live matrix.

## Verdict

- `zeroFix: false` — one minor product finding (**F1**) requires a one-line fix + changed-scope re-review of
  `atlas-client/src/components/timetable/simple/SimpleTaskDrawerHelpers.tsx`. All seven clauses otherwise verify
  against wired production paths; gates independently rerun green (20/20 tests, `tsc` exit 0, `diff --check` clean).
- After F1 is fixed: re-review that file's diff + rerun `npm run test:timetable-operator-ux` and `npx tsc --noEmit`,
  then the candidate is in shape for planner/QA formal review (including the deferred live browser matrix).
- No source edited, nothing committed, no server/ports/databases touched in this review.
