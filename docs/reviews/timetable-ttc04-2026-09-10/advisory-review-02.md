# Advisory Review 02 — TT-C04 changed-scope re-review (fresh reviewer)

- Plan/prompt: `D:/ATLAS/docs/prompts/timetable-operator-ux-one-shot-ttc04-2026-09-10.md`
- Worktree: `D:/ATLAS-worktrees/timetable-ttc04`, branch `work/timetable-ttc04`
- Reviewer role: fresh changed-scope advisory reviewer — implemented nothing, and did not author advisory-review-01. Review-01 was read for context only; every check below was independently reproduced.
- Execution-system/task context identifier: **no spawn/task/session ID was supplied to this reviewer in the review request.** Stated explicitly rather than invented: the parent request contained the review instructions but no verifiable execution-system identifier to repeat. Until the orchestrator re-issues this review with one, this artifact is advisory evidence only, not formal acceptance.
- Date (UTC): 2026-09-10.

## Reviewed diff identity

- Base SHA: `6f8d121f6bf6ce5efc8c6e831b69ecdc795b8187` (HEAD == base; all work uncommitted).
- `git diff --stat` (tracked, 15 files, +265/−23):

```
CHANGELOG.md                                       | 33 +++++++++
atlas-client/package.json                          |  1 +
ScheduleReviewWorkspaceHeader.tsx                   |  8 ++-
SimplePublishReadinessSheet.tsx                     | 29 ++++++--
TimetableSimpleHeader.tsx                           | 20 ++++++
UnassignedInsertionWorkflow.tsx                     |  1 +
modals/TimetableWorkflowDialogs.tsx                 |  4 +-
simple/SimpleHeaderHelpers.tsx                      | 13 +++-
simple/SimpleTaskDrawerHelpers.tsx                  | 22 ++++--
simplePublishReadiness.ts                           | 10 ++-
timetableContexts.types.ts                          |  4 ++
useScheduleReviewWorkspaceState.ts                  | 81 ++++++++++++++++++++--
__tests__/timetable-ttc02-insertion.test.ts         | 14 ++++
simple-timetable-state.ts                           | 26 +++++++
timetable-ttc02-insertion.ts                        | 22 ++++++
```

- Untracked: `atlas-client/src/lib/__tests__/timetable-operator-workflow-state.test.ts` (286 lines),
  `docs/progress/timetable-ttc04-2026-09-10-progress.md`, `docs/reviews/timetable-ttc04-2026-09-10/`.
- `git diff --check` → clean. No source edited, nothing committed, no server/ports/databases touched in this review.

## Scope closure

- The tracked file set is identical to the 15-file set recorded in advisory-review-01; the only tracked-file
  line movement since that review is in
  `atlas-client/src/components/timetable/simple/SimpleTaskDrawerHelpers.tsx` (18 → 22 changed lines),
  and it is exactly the F1 fix: drawer `BlockerGroup` item field `reason` renamed to `nextStep`
  (type `SimpleTaskDrawerHelpers.tsx:23`, builder push site `:72`, `BlockerGroupCard` reader `:192`),
  plus the `whyItMatters` fallback const (`:192`).
- The untracked workflow-state test gained exactly one test versus review-01's record (17 → 18 tests in that
  file): `drawer blocker items carry plain-language next steps, never raw codes` (`:262-275`).
- Nothing else changed outside that scope plus review-artifact/ledger bookkeeping: no server, schema,
  companion, `App.tsx`, or design-token paths touched; `CHANGELOG.md`/ledger entries are bookkeeping only.

## Requirement-to-enforcement mapping (changed scope only)

Prompt clause 5 requires blockers to be actionable: grouped plain-language issue, count, why-it-matters,
and one repair destination.

| Changed-scope requirement | Production enforcement (wired call site) | Test |
|---|---|---|
| Drawer item copy is plain language, never a raw `SNAKE_CASE` code | `SimpleTaskDrawerHelpers.tsx:23` item type field is `nextStep: string` (no `reason` field exists on the item shape); `:72` builder assigns `nextStep: groupConfig.nextStep` (a full sentence from `UNASSIGNED_GROUP_MAP`, `:27-33`); `:192` reader is `group.items[0]?.nextStep ?? 'Fix this group before the schedule can be published.'` | `timetable-operator-workflow-state.test.ts:262-275` pins `nextStep === 'No allowed time slot was found. Try manual placement or review the scheduling policy.'` and `doesNotMatch(/^[A-Z_]+$/)` |
| Repair navigation callback intact through the rename | `ScheduleReviewWorkspaceBody.tsx:62-79` hosts `<TimetableTaskDrawer>` (simple layout) → `TimetableTaskDrawer.tsx:214-227` renders `<PublishChecklistContent>` with `onReviewIssues → onTaskChange('review-issues')`, `onPlaceUnresolved → onTaskChange('place-unresolved')` → `SimpleTaskDrawerHelpers.tsx:107-110` `useMemo(buildBlockerGroups(...))` → `:127-129` maps groups to `<BlockerGroupCard onNavigate={…teaching-load ? onReviewIssues : onPlaceUnresolved}>` → `:202-212` repair `Button onClick={onNavigate}` with count-bearing `aria-label` | Structural: `publish stays disabled with unresolved sessions across surfaces`; `blocker repair actions keep 44px targets and screen-reader names` |

## Rename completeness (independently grepped, `atlas-client/src`, `*.{ts,tsx}`)

- Zero stale readers of the old drawer-item field: no `items[0]?.reason`, `item.reason`, or `.reason`
  access remains anywhere under `components/timetable/simple/` except `group.reason` at
  `SimpleTaskDrawerHelpers.tsx:128`, which is the intentionally retained **group-level** code key used only
  as the React `key` — it is never rendered as text (rendered texts are `plainLabel`, count,
  `whyItMatters`, `actionLabel`).
- The 45 remaining `.reason` hits elsewhere in `atlas-client/src` are all different shapes confirmed by
  inspection (unassigned demand items, `RepairOrigin.plainReason`, appeal records, scope-mismatch verdicts,
  teaching-load reconciliation entries) — none constructs or reads the drawer `BlockerGroup` item shape.
- No other component constructs the drawer item shape: the sole producer is `buildBlockerGroups`
  (`SimpleTaskDrawerHelpers.tsx:35-78`); the sole consumers are `PublishChecklistContent` and the new test.
  (`SimplePublishReadinessSheet.tsx`/`simplePublishReadiness.ts` own a separate sheet-side shape that already
  used `nextStep`.)
- `npx tsc --noEmit` exit 0 corroborates type-safety of the rename.

## Adversarial checks (changed scope; traced against the real code, no source edited)

- (A) Unmapped violation code (e.g. `BOGUS_CODE`, or a HARD `ROOM_TYPE_MISMATCH`) reaching the drawer:
  **cannot render raw text.** `buildBlockerGroups` (`:44-47`) hits `if (!groupConfig) continue` → no group is
  created → `blockerGroups.map` (`:127`) emits zero cards → no "Why it matters" line exists at all.
- (B) Empty-items group (mapped code but violation carries no section/subject ids, so the `:67` push guard
  skips while the group entry with incremented `count` still exists): **renders the plain-language fallback.**
  `group.items[0]?.nextStep` evaluates to `undefined` → `whyItMatters` falls back to
  `'Fix this group before the schedule can be published.'` (`:192`), rendered at `:200` as
  `Why it matters: Fix this group before the schedule can be published.` The item list is guarded by
  `group.items.length > 0` (`:215`), and `group.reason` (the raw code) is used only as React key (`:128`).
- (C) Normal mapped item: `nextStep` is always assigned from `UNASSIGNED_GROUP_MAP` sentences, never the code
  (builder `:72` has no code path assigning `v.code` to the item), pinned by the new test asserting the exact
  `NO_AVAILABLE_SLOT` sentence plus `doesNotMatch(/^[A-Z_]+$/)`.
- Result: no input I could construct makes the drawer render a raw `SNAKE_CASE` code as "Why it matters".
  Review-01 finding F1 is closed.

## Commands independently rerun (this review, worktree `atlas-client`)

- `npm run test:timetable-operator-ux` → **21/21 pass** (18 workflow-state incl. the new `drawer blocker items
  carry plain-language next steps, never raw codes` assertion + 3 insertion). Up from review-01's 20/20 by
  exactly the new test.
- `npx tsc --noEmit` → **exit 0**, no output.
- `git diff --check` → **clean**.
- Broad suites deliberately not run per the prompt's decisive gates.

## Findings

- None. No file:line requires a fix. F1 from advisory-review-01 is verified closed; the rename is complete at
  all three sites (type, producer, consumer); adversarial paths render plain language or nothing; gates rerun
  green (21/21 tests, `tsc` exit 0, `diff --check` clean); the production reachability chain
  drawer dialog → `PublishChecklistContent` → `buildBlockerGroups` → `BlockerGroupCard` → repair navigation
  callback is intact with real call sites named above.

## Verdict

- `zeroFix: true` — changed scope is clean. Candidate is in shape for planner/QA formal review (including the
  live browser matrix and any formal-identity requirements, both outside this advisory pass).
- No source edited, nothing committed, no server/ports/databases touched in this review.
