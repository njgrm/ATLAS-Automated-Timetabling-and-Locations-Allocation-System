# TT-C04 — Timetable Operator UX — Progress Ledger

Plan: `docs/prompts/timetable-operator-ux-one-shot-ttc04-2026-09-10.md`
Worktree: `D:/ATLAS-worktrees/timetable-ttc04` · Branch: `work/timetable-ttc04`
Base SHA: `6f8d121f6bf6ce5efc8c6e831b69ecdc795b8187` (origin/main, clean worktree)
Risk tier: MEDIUM (client-only; generation/save/publish/server all excluded)

## Audit findings (2026-09-10, desktop code inspection)

Real route: `atlas-client/src/pages/ScheduleReview.tsx` → lazy
`components/timetable/ScheduleReviewWorkspace.tsx` (Simple default + Advanced).
Single visible primary action is `timetable-simple-primary-action` in
`TimetableSimpleHeader.tsx` (generate/publish direct buttons are CSS-hidden).

Misleading-copy defects confirmed:
- `simple/SimpleHeaderHelpers.tsx:115 readinessLabel` returns `Ready to publish`
  when hard=0/soft=0 but ignores `summary.unassignedCount`.
- `simplePublishReadiness.ts:273` + `SimplePublishReadinessSheet.tsx:161` show
  `Ready to publish` when `draft == null` (no generated run at all → isClean).
- `simple/SimpleTaskDrawerHelpers.tsx:166` clean message shows when
  `runId == null` and all counts are 0.
- `modals/TimetableWorkflowDialogs.tsx:84` publish dialog says ready when
  `softCount == 0` even with unassigned sessions outstanding.

Publish-gating defects confirmed (unassigned sessions must block publish):
- `ScheduleReviewWorkspaceHeader.tsx:380` advanced Publish disabled only on
  `!draft || hardCount > 0`; tooltip mentions hard violations only.
- `TimetableSimpleHeader.tsx:301` startTask('publish') checks hardCount only.
- `simple/SimpleHeaderHelpers.tsx:438` publish task disabled ignores unassigned.

State-model gaps confirmed (no single mapping for all 8 operator states):
- `deriveSimpleLifecycleAction` has no unresolved-scope, setup-blocked, or
  generation-failed kinds. Generation failure today is toast-only
  (`useTimetableMutations.ts:642-643`); sticky signal exists via
  `runs[0].status === 'FAILED'` with `draft == null`.
- `handleTriggerGenerate` (`useScheduleReviewWorkspaceState.ts:734`) already
  guards non-ready curriculum with an error toast; header empty-state already
  links blocked curriculum to `/curriculum-requirements`.

Stale-state gaps confirmed:
- `handleRunChange` clears selection + edit history but not preview
  (`previewResult`), assignment-picker, inline status, undo strip, or dialogs.
- `loadAll` scope-mismatch branch clears runs/draft/runId but workspace-level
  selection/preview/dialog state persists (no `[schoolId, schoolYearId]` reset).
- Collaboration (`useTimetableCollaboration`) is keyed by
  schoolId/schoolYearId/runId and resubscribes automatically — no manual clear.
- Zero-request posture while scope unresolved verified by inspection:
  `fetchRuns`/`fetchRunData`/`fetchReferenceData` throw when `!schoolId`,
  `loadRoomRequestSummary`/`fetchCurriculumReadiness` return early, and
  `loadAll` returns before run/reference/board fetches when `!syId`.

TT-C02 preview-only posture confirmed intact:
- `UnassignedInsertionWorkflow.tsx:119` hard-codes `allowApply: false`; save
  control stays disabled with preview-only copy. Stats badges already state
  `Individually previewable N`, `Globally scheduled 0`, plus a preview-only
  explainer line. HG lines group as `HG_FORBIDDEN` hard-stop first.

Blocker-actionability gaps confirmed:
- `SimplePublishReadinessSheet.tsx` `BlockerGroupRow` renders plain label +
  count + repair action but NOT the `nextStep` (why it matters), has no
  progressive disclosure, and the repair action is `h-7` (< 44px target).
- `SimpleTaskDrawerHelpers.tsx` `BlockerGroupCard` likewise omits `nextStep`
  and uses `h-7` repair action.

## Task list

- [x] T1 audit real route/hooks/components (this ledger, above)
- [x] T2 unify lifecycle derivation (scope/setup/failed states, one primary)
- [x] T3 honest readiness copy (chip, sheet, drawer, dialog; no-run never clean)
- [x] T4 publish gates include unassigned (simple task, simple startTask,
      advanced header, publish dialog disabled + copy)
- [x] T5 stale-state reset on school/year/run change (workspace-level)
- [x] T6 HG client guard (HG-coded line can never read as placeable/saveable)
- [x] T7 blocker groups: why-it-matters + one repair action + disclosure + 44px
- [x] T8 focused + negative state-machine tests (node:test/tsx, no new harness)
- [x] T9 gates: focused tests, tsc --noEmit, production build, diff --check,
      observation-only runtime probe (no restart, no writes)
- [ ] T10 advisory UX/a11y review + changed-scope re-review, commit candidate

## Decisions

- No funnel redesign: no-run primary stays `Start draft` (pre-generation draft
  is the established funnel; draft anchors feed generation confirm).
- No server/companion edits; no generation/save/publish/restart/.env writes.
- Hook-level tests use existing node:test + tsx pure-helper harness (no RTL in
  repo); derivation helpers ARE the page/hook path (header consumes directly).
- Browser QA at both viewports: attempt observation-only against isolated
  built candidate; full Tailnet login matrix is planner-QA follow-up.

## Files changed (planned)

- `atlas-client/src/lib/simple-timetable-state.ts`
- `atlas-client/src/components/timetable/simple/SimpleHeaderHelpers.tsx`
- `atlas-client/src/components/timetable/simplePublishReadiness.ts`
- `atlas-client/src/components/timetable/SimplePublishReadinessSheet.tsx`
- `atlas-client/src/components/timetable/simple/SimpleTaskDrawerHelpers.tsx`
- `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx`
- `atlas-client/src/components/timetable/timetableContexts.types.ts`
- `atlas-client/src/components/timetable/modals/TimetableWorkflowDialogs.tsx`
- `atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts`
- `atlas-client/src/lib/timetable-ttc02-insertion.ts`
- `atlas-client/src/components/timetable/UnassignedInsertionWorkflow.tsx`
- `atlas-client/src/lib/__tests__/timetable-operator-workflow-state.test.ts` (new)
- `atlas-client/src/lib/__tests__/timetable-ttc02-insertion.test.ts` (extend)
- `atlas-client/package.json` (add `test:timetable-operator-ux` script)
- `CHANGELOG.md` (TT-C04 entry; allowed path)
- this ledger

## TT-C04R2 narrow correction (2026-09-10, on top of 67ad6326, no rewrite)

Scope: remove two dead hidden generation bypasses in
`TimetableSimpleHeader.tsx` (`timetable-simple-mobile-lifecycle-action` IIFE
with its own label/disabled derivation + direct `handleTriggerGenerate`, and
`timetable-simple-generate-action` with weak loading/year check). No
replacement control added. Visible actions untouched: no-run sole primary via
`handleLifecycleAction`, `Preview demand` secondary preview-only
(`setInsertionOpen`, gated `canPlanOrGenerate`), More-menu Plan draft +
Generate schedule gated by `canPlanOrGenerate`.
Remaining direct `handleTriggerGenerate` sites: lifecycle dispatcher cases
(`generate` guarded by `generationReady`, `retry-generate`) + gated More-menu
item only — verified by grep + extended source-text test.

## Review log (R2)

- Changed-scope review 03 (`docs/reviews/.../advisory-review-03.md`, spawn
  `ses_f769b4d82ffegO2K4wnN0eJkcM`): `zeroFix: true`. Both dead test IDs gone
  from `atlas-client/src` (only the new test's negative assertions name them);
  3 remaining `handleTriggerGenerate` sites all gated (dispatcher L182/184 +
  More-menu L514); no hidden element retains a generation call; visible
  actions byte-unchanged; new test tripwires reasoned to fail on restoration;
  24/24 + tsc independently rerun. R2 advisory loop closed.

- Advisory review 01 (`docs/reviews/timetable-ttc04-2026-09-10/advisory-review-01.md`,
  spawn `ses_f77327a6bffebJ662AaK2buRaJ`): `zeroFix: false`. One minor product
  finding F1 — drawer `BlockerGroupCard` read `items[0]?.reason` (field NAME
  ambiguous although the VALUE was already the plain-language nextStep).
  Adversarial publish/HG/scope/stale checks all PASS; tests 20/20 + tsc clean
  independently rerun. No source edited by reviewer.
- F1 fix (same session): renamed drawer item field `reason` → `nextStep`
  (type + builder + card) and added a `buildBlockerGroups` unit assertion
  pinning plain-language next steps. Gates after fix: 21/21 tests, tsc 0,
  diff-check clean, production build exit 0.
- Changed-scope review 02 (`docs/reviews/.../advisory-review-02.md`, spawn
  `ses_f772f2e38ffeMtJ5S0DBvH4tpT`): `zeroFix: true`. Rename complete at all
  three sites, zero stale readers, adversarial SNAKE_CASE-render attempts fail
  closed (unmapped codes dropped; empty groups get plain fallback),
  reachability drawer→checklist→builder→card→repair intact, 21/21 + tsc
  independently rerun. Advisory loop closed.

## Gate evidence (2026-09-10, worktree, hermetic)

- `npm run test:timetable-operator-ux` → 20/20 pass (lifecycle matrix +
  negative controls + HG + preview-only + structural guardrails).
- Full remaining client suite (10 files) → 98/98 pass; combined 118/118.
- `npx tsc --noEmit` (atlas-client) → exit 0.
- `npm run build` (atlas-client) → exit 0 (`ScheduleReviewWorkspace` chunk ok).
- `git diff --check` → exit 0.
- Observation-only `GET http://localhost:5001/api/v1/health` → `ok/atlas`
  (no restart, no mutation; port 5001/5174 listeners left untouched).
- Source boundary proof: `git status` shows only `atlas-client/...`,
  `CHANGELOG.md`, ledger, new test — zero server/companion paths.
- Browser QA at 1280x720 + 390x844 (login flow, keyboard-only, 200% zoom,
  overflow, no-write-request): NOT executed here — no Playwright/browsers in
  this worktree and live Tailnet login belongs to planner QA. Static
  substitutes in place: no-scroll containers untouched, local ScrollArea
  regions preserved, h-11 repair targets + aria labels pinned by tests,
  text-first status labels kept, no new modals or keyboard traps.

## Risks

- Publish-dialog context change (`publishUnassignedCount`) touches shared
  dialog plumbing; tsc + build must confirm no other consumers break.
- Touch-target bumps (h-7 → h-11) alter blocker-row density slightly; no-scroll
  architecture preserved via existing local ScrollArea regions.

## Planner correction TT-C04R (2026-09-10)

- Status: `REVIEW_REQUIRED` pending an independent review of the correction
  commit. TT-C05 and any live generation action remain locked.
- Finding: the production no-run branch bypassed
  `deriveSimpleLifecycleAction`. With current-year curriculum ready and the
  latest run failed, the helper selected `retry-generate`, but the rendered
  page still emphasized `Start draft`, showed `Unassigned insertion`, and kept
  its actual generate control hidden.
- Correction: the no-run branch now consumes the lifecycle action directly.
  `Try generating again` is the single primary action for the observed failed
  run, while the preview-only demand tool is a secondary `Preview demand`
  action. Setup loading/failed states fail closed behind `Checking setup...` or
  `Retry setup check`; unresolved actor/year scope cannot plan or generate.
  The More-menu Plan/Generate actions use the same readiness gate.
- Focused proof: `npm run test:timetable-operator-ux` 23/23; client
  `npx tsc --noEmit`; client production build; `git diff --check` all passed.
  A production-consumer source assertion pins the no-run branch to the
  lifecycle handler and proves the hidden generate bypass is absent.
- Rendered proof against the isolated candidate client on `localhost:5175`
  with the existing live API untouched: authenticated school 1 / year 8 page
  displayed `Try generating again` plus secondary `Preview demand`, with no
  `Start draft`; 390x844 mobile measured `scrollWidth=390` and
  `innerWidth=390`. No action was invoked, so no generation/save/publication
  request was dispatched. The isolated Vite process is stopped after QA.
- Packaging note: `npm run test:timetable-conflict` is not a valid clean-tree
  gate at this commit because its package script names two ignored test files
  absent from the committed tree. This pre-existing durability defect is not
  repaired in TT-C04R and must be handled as a separate packaging correction.
