# TT-DYNAMIC-WORKSPACE-C04 — Executor handoff

Lane: S1 (`TT-DYNAMIC-WORKSPACE-C04`)
Role: EXECUTOR (fresh session, continued after a harness step limit)
Verdict: **REVIEW_REQUIRED**
Risk tier: MEDIUM source (client-heavy) with HIGH interaction guardrails; no live mutation.

## Immutable boundary

- Base SHA: `e3882ca0356e04545fadaa9dbfa5cd1261ba64b5` (branch `work/tt-dynamic-workspace-c04`)
- Source candidate SHA (pre-handoff): `93216b38`
- Candidate tip: the commit that contains this file (additive; the planner/QA must
  read the exact tip from `git log -1 --format=%H` on this branch).
- Worktree: `D:\ATLAS-worktrees\tt-dynamic-workspace-c04`
- Additive commits: `c356ed72` (WIP publication truth + Simple drift), `cf949181`
  (R4 visible Advanced Undo/Redo + history revert), `a2922e4d` (R7 requests/setup-sync
  migration + cache-age), `a49ae9d3` (failing-first controls + R7 guards), `93216b38`
  (R7 policy link + parity controls), plus this handoff commit.

## Changed paths (all inside packet §2 owned paths)

New:
- `atlas-client/src/components/timetable/timetableWorkspaceTruth.ts`
- `atlas-client/src/components/timetable/timetableDriftRouting.ts`
- `atlas-client/src/components/timetable/timetableUndoRedoState.ts`
- `atlas-client/src/components/timetable/TimetableUndoRedoControl.tsx`
- `atlas-client/src/components/timetable/ScheduleReviewInputStateBanner.tsx`
- `atlas-client/src/components/timetable/simple/SimpleDriftBanner.tsx`
- `atlas-client/src/lib/__tests__/timetable-dynamic-workspace-publication.test.ts`
- `atlas-client/src/lib/__tests__/timetable-dynamic-workspace-undo-redo.test.ts`
- `atlas-client/src/lib/__tests__/timetable-dynamic-workspace-drift.test.ts`
- `atlas-client/src/lib/__tests__/timetable-dynamic-workspace-capabilities-guard.test.ts`
- `atlas-client/src/lib/__tests__/timetable-dynamic-workspace-scope-links.test.ts`
- `atlas-client/src/lib/__tests__/timetable-dynamic-workspace-truth-fixes.test.ts`

Modified:
- `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx`
- `atlas-client/src/components/timetable/ScheduleReviewWorkspaceOverlays.tsx`
- `atlas-client/src/components/timetable/CenterWorkspace.tsx`
- `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx`
- `atlas-client/src/components/timetable/TimetableTaskDrawer.tsx`
- `atlas-client/src/components/timetable/SimplePublishReadinessSheet.tsx`
- `atlas-client/src/components/timetable/buildScheduleReviewWorkspaceContexts.ts`
- `atlas-client/src/components/timetable/timetableContexts.types.ts`
- `atlas-client/src/components/timetable/modals/TimetableAssignmentDialogs.tsx`
- `atlas-client/src/components/timetable/simple/SimpleHeaderHelpers.tsx`
- `atlas-client/src/components/timetable/simple/SimpleTaskDrawerHelpers.tsx`
- `atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts`
- `atlas-client/src/hooks/useTimetableMutations.ts`

Forbidden paths were never touched: no `CHANGELOG.md`, living register, runtime map,
`useTimetableData.ts`, `types.ts`, `simplePublishReadiness.ts`,
`ScheduleReviewWorkspace.constants.ts`, `GeneratedRunRailPanels.tsx`, or any
warning/policy/TL/sync server file. No S1 server file was added, so the
`atlas-server` build + mounted read-route gate is **not applicable**.

## Trace table

| Req | Production path | Negative control (fails on base) | Verification command | Status |
|---|---|---|---|---|
| R1 run-wide publish gate vs term display | `useScheduleReviewWorkspaceState.ts` → `deriveRunWideReadiness(summary, violations)` → `headerContext.hardCount/softCount`; `useTimetableMutations.handlePublishConfirm` | Summary `hardViolationCount:1`, display array term-filtered to zero → gate must block; base used the filtered array | `timetable-dynamic-workspace-publication.test.ts` (8) | PASS |
| R2 one strict publication predicate | `timetableWorkspaceTruth.isRunPublishedStrict` consumed by `ScheduleReviewWorkspace`, `CenterWorkspace`, `ScheduleReviewWorkspaceHeader` | `{isPublished:false, publishedAt, publishedBy}` must render not-published; base loose OR-check rendered published | `timetable-dynamic-workspace-publication.test.ts` (8) | PASS |
| R3 selected-class Swap is armed | `ScheduleReviewWorkspace.armSwapSessions` → `setSwapClassTimesMode('select-first')`, used by strip primary + More action + details sheet | Source has no `armSwapSessions`; base only `setActiveSimpleTask('swap-sessions')` (state-only no-op) | `timetable-dynamic-workspace-truth-fixes.test.ts` (test 1) | PASS |
| R4 truthful persistence + bounded Redo/history | `useTimetableMutations.runAuthoritativeRevert`/`redoLastEdit`; `timetableUndoRedoState`; `TimetableUndoRedoControl` (both layouts); `TimetableAssignmentDialogs` history | Stale redo target dispatches nothing; non-head history rows cannot revert; base had no Redo and a `sr-only` Advanced undo | `timetable-dynamic-workspace-undo-redo.test.ts` (8) | PASS |
| R5 scope hygiene | `ScheduleReviewWorkspace` scope-key effect clears task/sheets/selection/swap/undo on school/year/run/term change | Effect absent on base; sheets/task survived scope change | `timetable-dynamic-workspace-scope-links.test.ts` (tests 1–2) | PASS |
| R6 Simple source-drift/term-authority visibility | `timetableDriftRouting.describeRunInputDrift` → `SimpleDriftBanner` (domain chips + `SetupImpactDialog` + `RolloverGuidanceCard` + sync); drift blocks Simple generation | Simple had no `inputState`/drift consumer on base | `timetable-dynamic-workspace-drift.test.ts` (10) | PASS |
| R7 capability model is the production guard + Advanced migration | `deriveTimetableCapabilities` → `useSimpleTasks(context, capabilities.gates)`; Simple requests rail, setup-sync, TL owner repair, policy link; Advanced panels kept | Base consumed only `gates.generation`; publish/swap/review used local counts | `timetable-dynamic-workspace-capabilities-guard.test.ts` (7) | PASS |
| R8 no dead repair navigation | `/map` in `TimetableSimpleHeader` + `SimpleTaskDrawerHelpers`; route table has `/map`, not `/campus-rooms` | Base linked `/campus-rooms` (unmounted catch-all) | `timetable-dynamic-workspace-scope-links.test.ts` (tests 3–4) | PASS |
| R9 truth fixes | A-06 drawer copy; A-09 JWT role; A-10 Year Setup route; A-12 Advanced Requests expands rail; A-13 strip Simple-only; A-15 `replayed` info + Advanced publish block; A-16 fail-closed policy + hidden-row warning; A-18 identity-preserving TL link; A-19 tutorial role; B-10 checked-at age | Each defect present on base as documented in the audit | `timetable-dynamic-workspace-truth-fixes.test.ts` (12), `timetable-dynamic-workspace-drift.test.ts` (B-10) | PASS |
| R10 archived read-only exclusion | `data-timetable-year-binding="runtime-active-only"`; no archived affordance added; D4 recorded below | No archived binding exists; honest exclusion, no fake control | `timetable-dynamic-workspace-scope-links.test.ts` (tests 5–6) | PASS |

## Production-shape parity row

- Real producer: `atlas-server/src/services/generation.service.ts:824,903` persists
  run-wide `hardViolationCount`/`softViolationCount` on the run summary.
- Real consumer: `useScheduleReviewWorkspaceState.ts` → `deriveRunWideReadiness(summary, violations)`
  → `headerContext.hardCount/softCount` → publication gate.
- Conservation totals: run-wide hard/soft counts preserved exactly; the selected-term
  display violation array is passed through untouched and used only as a fallback when
  no authoritative summary exists.
- Negative control: summary hard=1 with a term-filtered display of zero HARD must block.
- Result: PASS (`timetable-dynamic-workspace-publication.test.ts` parity + R1 tests).
- Evidence class: source-traced producer/consumer parity (no live generator run is
  authorized by this packet; no disposable DB runtime was available).

## Decisive command results

| Command | Result |
|---|---|
| `npx tsc --noEmit` (atlas-client) | EXIT 0 |
| `npm run build` (atlas-client) | EXIT 0 — 3211 modules, built in ~4.4s (`dist/index.html` present, gitignored) |
| `npm run test:timetable-operator-ux` | 58 / 58 pass, 0 fail |
| `npm run test:timetable-sync-setup` | 6 / 6 pass, 0 fail |
| `npx tsx --test timetable-ordered-term-conflict-c03r3 + timetable-day-scope-c03r` | 9 / 9 pass, 0 fail |
| `npx tsx --test src/hooks/__tests__/useTeachingLoadRouteIntent.test.ts` | 21 / 21 pass, 0 fail |
| New `timetable-dynamic-workspace-*` tests | 48 / 48 pass, 0 fail |
| Full tracked client inventory (`tsx --test` on all 48 tracked `src/**/*.test.ts`) | **376 / 376 pass, 0 fail, 0 cancelled, 0 skipped** |
| `git diff --check` | clean (exit 0) |
| Staged-path audit | only owned paths staged in every commit |
| `npm run test:timetable-conflict` | **BLOCKED(BASE_TEST_UNTRACKED_4794bd9e)** — `timetable-live-conflict.test.ts`, `tactical-sandbox-dock-helpers.test.ts` untracked at base |
| `npm run test:ux-guardrails` | **BLOCKED(BASE_TEST_UNTRACKED_4794bd9e)** — `ux-guardrails.test.ts`, `public-schedule-grade.test.ts` untracked at base; the tracked member (`useTeachingLoadRouteIntent.test.ts`) ran green (21/21) |

### Mandatory-gate tally (planner-normalized matrix)

Total 12 / passed 10 / blocked 2 (both blocked by the ruled pre-existing base defect
`BASE_TEST_UNTRACKED_4794bd9e`) / unperformed 0.

Passed: `test:timetable-operator-ux`, `test:timetable-sync-setup`, ordered-term/day-scope
substitute, `useTeachingLoadRouteIntent` substitute, new `timetable-dynamic-workspace-*`
tests, full tracked inventory, `tsc --noEmit`, `npm run build`, `git diff --check`,
staged-path audit. Blocked: `test:timetable-conflict`, `test:ux-guardrails`.

## Browser rows

No reusable authenticated Tailnet session exists and no login is authorized; no safe
disposable DB runtime was available for an isolated local build. All browser rows are
labeled `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`:

- Swap arming (strip + details sheet) — blocked; covered by component/source control.
- Auto-commit disclosure before one-click placement — blocked; covered by source control.
- Visible Undo/Redo strip after auto-commit — blocked; covered by source control.
- Scope clearing on school/year/run/term change — blocked; covered by source control.
- Tailnet read-only render of the Simple drift banner / Advanced Requests rail — blocked.

No login, no shared-runtime write, no Tailnet page navigation was performed.

## Risks

- BLOCKING: none identified within the candidate range.
- NON_BLOCKING: the Advanced visible Undo/Redo control is absolutely positioned in the
  header's top-right stack and could visually crowd the header at very narrow widths;
  the Simple drift banner adds a conditional row only when a run exists and its inputs
  are stale/unknown.
- NON_BLOCKING: `applyRunReconciliation` (B-02/D3) and full archived-year read-only
  binding (D4) are outside this packet; R10 implements the honest exclusion only.
- NON_BLOCKING (unperformed evidence): live/runtime parity of the drift banner requires
  the bounded runtime deployment, which this packet forbids.

## Decisions recorded for the planner

- **D4 (archived scope)**: the workspace binds the runtime-active school year only and
  never presents a year switcher. No archived mutation affordance is introduced;
  full archived read-only binding remains a dependency (recorded here, not implemented).
- **B-10**: the client 120 s cache lives in the forbidden `useTimetableData.ts`; the
  checked-at age is surfaced instead via `formatCheckedAtAge` in both Simple and Advanced
  input-state surfaces.

## Zero-mutation statement

No live database write, live API mutation, generation, publication, deployment, process
restart, migration, term-cache apply, Teaching Load apply, login, or companion-repository
edit occurred. Only local source/test edits and read-only gate runs were performed.
No push was made.
