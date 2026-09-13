# TT-DYNAMIC-WORKSPACE-C04 — Executor handoff

Lane: S1 (`TT-DYNAMIC-WORKSPACE-C04`)
Role: EXECUTOR (fresh session)
Verdict: **REVIEW_REQUIRED**
Risk tier: MEDIUM source (client-heavy) with HIGH interaction guardrails; no live mutation.

## Immutable boundary

- Base SHA: `e3882ca0356e04545fadaa9dbfa5cd1261ba64b5` (branch `work/tt-dynamic-workspace-c04`)
- Source candidate SHA (pre-handoff): `96f81aa6`
- Candidate tip: the commit that contains this file (additive; read the exact tip
  from `git log -1 --format=%H` on this branch).
- Worktree: `D:\ATLAS-worktrees\tt-dynamic-workspace-c04`
- Commits: `c356ed72` (WIP), `cf949181` (R4), `a2922e4d` (R6/R7/R9/R10),
  `a49ae9d3` (tests + R7 guards), `93216b38` (policy link), `88ed0276`/`a1854eeb`
  (handoff + counts), `4c711839` (correction 1: F2 gate + routed repairs +
  rendered/behavioral controls), `96f81aa6` (correction 2: load-bearing R2
  consumer control + mutant proof), plus this handoff commit.

## Correction round 2 (final, R2 load-bearing control)

The QA round-2 finding was that no committed control covered the real R2
consumers (`ScheduleReviewWorkspace.tsx`, `CenterWorkspace.tsx`), so reverting
their published derivation to the base loose `publishedAt`/`publishedBy` OR-marker
predicate kept the full inventory green. Rendering those consumers is infeasible
in this harness (`ScheduleReviewWorkspace` calls the network hook
`useScheduleReviewWorkspaceState()`; `CenterWorkspace` reads the browser viewport
in a `useState` initializer and mounts heavy DOM/dnd sub-surfaces), so the packet's
option 2 was implemented:

- (a) `timetable-dynamic-workspace-r2-consumers.test.ts` executes the superseded
  fixture `{isPublished:false, publishedAt:<string>, publishedBy:<number>}` on the
  single selector `isDraftPublishedStrict`.
- (b) a call-site binding check requires both real consumers to declare
  `const isDraftPublished = isDraftPublishedStrict(<draft>)`, to contain no
  `publishedAt`/`publishedBy` fallback, and to pass `isPublished={isDraftPublished}`
  to the rendered published surface.
- (c) a discrimination mutant reproduces the base loose OR-marker predicate and
  proves it returns `true` for the superseded fixture while the selector returns
  `false`.

**Mutant proof (run during development; not left in the tree):** both consumers
were temporarily reverted to the exact base predicate, then
`npx tsx --test src/lib/__tests__/timetable-dynamic-workspace-r2-consumers.test.ts`
exited `1`:

```
✖ R2 both real R2 consumers derive published state through the single selector
AssertionError [ERR_ASSERTION]: src/components/timetable/CenterWorkspace.tsx must derive published state through isDraftPublishedStrict(draft)
    at timetable-dynamic-workspace-r2-consumers.test.ts:88:10
ℹ tests 3   pass 2   fail 1
```

The consumers were restored with `git checkout --` (verified: both call
`isDraftPublishedStrict` again) and the test passes 3/3. The optional QA
observation was also fixed: the R5 behavioral test's previously vacuous
`dispatchCount` now observes a real captured-request dispatch counter, with a
negative control proving an unchanged scope does not clear and still dispatches.

## Correction round 1 (all three QA defects addressed)

1. **R6 routed repairs were dead data** — `SimpleDriftBanner` now renders a real
   mounted repair action per changed domain (`Button asChild` + `Link`,
   `data-testid="timetable-simple-repair-<domain>"`, `data-primary-repair` on the
   `primaryHref` match) plus an umbrella primary action for unmapped domains. Chips
   stay informational. The repair group is guarded by
   `deriveTimetableCapabilities().gates.setupInputStatus`.
2. **Missing rendered/behavioral controls** — added
   `timetable-dynamic-workspace-rendered.test.ts` (real
   `renderToStaticMarkup` header/banner rendering) and
   `timetable-dynamic-workspace-behavioral.test.ts` (real production functions,
   not source regex). Production logic was extracted into `timetableSwapArming.ts`,
   `timetableScopeHygiene.ts`, and `dispatchRedo` so the controls exercise the
   exact production transition.
3. **F2 client half** — `RunWideReadiness.blockingHardCount` sourced from
   `summary.blockingHardViolationCount` with a fail-closed fallback to
   `summary.hardViolationCount`; Simple and Advanced publish gates now use it while
   `hardCount` remains the display total and the display list stays term-scoped.
   No server file was edited (the S2 lane owns `blockingHardViolationCount`).

## Changed paths (cumulative range; all inside packet §2 owned paths)

New: `components/timetable/{timetableWorkspaceTruth.ts, timetableDriftRouting.ts,
timetableUndoRedoState.ts, timetableSwapArming.ts, timetableScopeHygiene.ts,
TimetableUndoRedoControl.tsx, ScheduleReviewInputStateBanner.tsx,
simple/SimpleDriftBanner.tsx, simple/SimpleMoreMenuContent.tsx}`;
`lib/__tests__/timetable-dynamic-workspace-{publication,undo-redo,drift,capabilities-guard,scope-links,truth-fixes,rendered,behavioral,r2-consumers}.test.ts`.

Modified: `components/timetable/{ScheduleReviewWorkspace, ScheduleReviewWorkspaceHeader,
ScheduleReviewWorkspaceOverlays, CenterWorkspace, TimetableSimpleHeader,
TimetableTaskDrawer, SimplePublishReadinessSheet, buildScheduleReviewWorkspaceContexts,
timetableContexts.types, modals/TimetableAssignmentDialogs, simple/SimpleHeaderHelpers,
simple/SimpleTaskDrawerHelpers}.tsx|ts`;
`hooks/{useScheduleReviewWorkspaceState,useTimetableMutations}.ts`;
`docs/handoffs/tt-dynamic-workspace-c04-executor.md`.

Test-assertion relocation (coverage preserved, not removed): the Simple More menu
was extracted into `simple/SimpleMoreMenuContent.tsx`, so
`timetable-operator-repair.test.ts` and `timetable-operator-workflow-state.test.ts`
now read that file for the same entries (same assertions, same counts); the
workflow-state `headerContext` fixture now defaults `blockingHardCount` to
`hardCount` so existing readiness-copy expectations are unchanged.

Forbidden paths untouched: no `CHANGELOG.md`, living register, runtime map,
`useTimetableData.ts`, `types.ts`, `simplePublishReadiness.ts`,
`ScheduleReviewWorkspace.constants.ts`, `GeneratedRunRailPanels.tsx`, or any
server file.

## Trace table

| Req | Production path | Negative control | Verification | Status |
|---|---|---|---|---|
| R1 run-wide publish gate vs term display | `deriveRunWideReadiness(summary, violations)` → `headerContext.blockingHardCount` → capability/publication gate | summary blocking=1 + term-filtered display=0 ⇒ rendered publish block | `publication.test.ts` (8) + `rendered.test.ts` R1 (2) | PASS |
| R1b F2 allowlist-aligned gate | `blockingHardCount` from `summary.blockingHardViolationCount`, fail-closed fallback | total hard=1 (legacy non-blocking), blocking=0 ⇒ publish not blocked | `publication.test.ts`, `rendered.test.ts` R1b | PASS |
| R2 one strict publication predicate | `isDraftPublishedStrict` in both real consumers (`ScheduleReviewWorkspace.tsx:174`, `CenterWorkspace.tsx:361`) | superseded fixture must be not-published; reverting a consumer to the loose OR-marker predicate fails the consumer control | `publication.test.ts` + `rendered.test.ts` R2 + `r2-consumers.test.ts` (3, incl. mutant) | PASS |
| R3 selected-class Swap is armed | `createSwapArmHandler` in the strip/More/details | source only re-set `activeSimpleTask` on base | `behavioral.test.ts` R3 (setters called once, `select-first`) | PASS |
| R4 bounded Redo/history | `dispatchRedo`/`runAuthoritativeRevert`; `TimetableUndoRedoControl`; history revert | stale CAS dispatches **zero** requests | `behavioral.test.ts` R4 (3) + `undo-redo.test.ts` (8) | PASS |
| R5 scope hygiene | `buildScopeKey`/`shouldClearForScopeChange`/`clearScopeState` | unchanged/initial scope does not clear; changed scope clears before dispatch | `behavioral.test.ts` R5 (4) + `scope-links.test.ts` | PASS |
| R6 source-drift + routed repairs | `describeRunInputDrift` → `SimpleDriftBanner` routed Links | `primaryHref` had no consumer on base (dead data) | `rendered.test.ts` R6 (3) + `drift.test.ts` (10) | PASS |
| R7 capability guard + migration | `deriveTimetableCapabilities` → `useSimpleTasks(context, gates)`; Simple requests/setup-sync/TL/policy | base consumed only `gates.generation` | `behavioral.test.ts` R7 (3) + `capabilities-guard.test.ts` (7) + rendered setup-sync (`rendered.test.ts`) | PASS (see coverage boundary) |
| R8 no dead repair navigation | `/map` in header/drawer helpers; route table | base `/campus-rooms` unmounted | `scope-links.test.ts` (route-resolution) | PASS |
| R9 truth fixes | A-06/A-09/A-10/A-12/A-13/A-15/A-16/A-18/A-19/B-10 | each defect present on base | `truth-fixes.test.ts` (11) + `drift.test.ts` B-10 | PASS |
| R10 archived exclusion | `data-timetable-year-binding="runtime-active-only"`; D4 recorded | no fake archived control | `scope-links.test.ts` (2) | PASS |

**R7 coverage boundary (honest):** rendered Simple entry points are proven for
setup-sync via the drift banner. The room-request, policy, and selected-class
owner-repair entries live inside Radix `DropdownMenuContent`/`Sheet` portals, which
`renderToStaticMarkup` does not emit (no jsdom/testing-library in this repo). Those
entries are covered by the capability behavioral test, source-resolved entry points,
and a mounted-route assertion; the portal-rendered click is a
`NO_DOM_RENDER_HARNESS` limitation, not a silent skip.

## Production-shape parity row

- Real producer: `generation.service.ts:824,903` (run-wide hard/soft counts);
  S2 adds allowlist-filtered `blockingHardViolationCount` + `counts.runWide.blockingHard`.
- Real consumer: `deriveRunWideReadiness` → `headerContext.blockingHardCount` →
  `deriveTimetableCapabilities().gates.publication` → Simple/Advanced publish.
- Conservation: total `hardCount` and the selected-term display array pass through
  unchanged; only the gate consumes the allowlist-filtered count.
- Negative control: total hard=1 / blocking=0 must allow publish; blocking=1 with an
  empty selected-term display must block it.
- Result: PASS (behavioral + rendered). Evidence class: source-traced producer/consumer
  parity; no live generator run is authorized by this packet.

## Decisive command results

| Command | Result |
|---|---|
| `npx tsc --noEmit` | EXIT 0 |
| `npm run build` | EXIT 0 — 3214 modules |
| `npm run test:timetable-operator-ux` | 58 / 58 pass, 0 fail |
| `npm run test:timetable-sync-setup` | 6 / 6 pass, 0 fail |
| ordered-term + day-scope substitute | 9 / 9 pass, 0 fail |
| `useTeachingLoadRouteIntent` substitute | 21 / 21 pass, 0 fail |
| new `timetable-dynamic-workspace-*` | 71 / 71 pass, 0 fail |
| full tracked client inventory (51 tracked test files) | **399 / 399 pass, 0 fail, 0 cancelled, 0 skipped** |
| `git diff --check` | clean (exit 0) |
| staged-path audit | owned paths only |
| `npm run test:timetable-conflict` | **BLOCKED(BASE_TEST_UNTRACKED_4794bd9e)** — `timetable-live-conflict.test.ts`, `tactical-sandbox-dock-helpers.test.ts` |
| `npm run test:ux-guardrails` | **BLOCKED(BASE_TEST_UNTRACKED_4794bd9e)** — `ux-guardrails.test.ts`, `public-schedule-grade.test.ts`; tracked member green (21/21) |

**Mandatory-gate tally: total 12 / passed 10 / blocked 2 / unperformed 0.**

## Browser rows

No reusable authenticated Tailnet session and no login authorized; no disposable DB
runtime. Rows labelled `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`: swap arming,
auto-commit disclosure, visible Undo/Redo strip, scope clearing, Tailnet render of the
Simple drift banner / Advanced Requests. The portal-rendered click rows are additionally
`NO_DOM_RENDER_HARNESS` (see R7 coverage boundary). No login, no shared-runtime write,
no Tailnet navigation performed.

## Risks

- BLOCKING: none within the candidate range.
- NON_BLOCKING: `NO_DOM_RENDER_HARNESS` limits rendered assertions for the two R2
  consumers (`ScheduleReviewWorkspace` uses a network hook at top level;
  `CenterWorkspace` reads the viewport in a `useState` initializer) and for Radix
  portal content (menu/sheet entries). Both are covered by the sanctioned
  call-site binding + discrimination-mutant controls, not silent skips.
- NON_BLOCKING: the Advanced Undo/Redo control is absolutely positioned top-right and
  may crowd very narrow headers.
- NON_BLOCKING: D3 (`applyRunReconciliation`) and full archived read-only binding (D4)
  stay out of packet; R10 is the honest exclusion.

## Decisions recorded for the planner

- D4 (archived scope): workspace binds the runtime-active year only; no archived
  mutation affordance is added; full read-only binding remains a dependency.
- B-10: the 120 s cache lives in the forbidden `useTimetableData.ts`; the checked-at
  age is surfaced via `formatCheckedAtAge` in both Simple and Advanced.

## Zero-mutation statement

No live database write, live API mutation, generation, publication, deployment,
restart, migration, term-cache apply, Teaching Load apply, login, or companion-repo
edit occurred. Only local source/test edits and read-only gate runs. No push; no
amend/rebase after handoff.
