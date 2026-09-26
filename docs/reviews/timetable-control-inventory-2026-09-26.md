# Timetable control inventory — `/timetable` and every sub-view

**Describes:** `main` at `bdf5c469885280a509d987391cb73ef31cf0b8d2` (worktree `E:/ATLAS-worktrees/lane-a2-timetable-custody`, branch `work/a2-timetable-custody`, base = `origin/main`).
**Live release at the time of writing:** `0da104f9`, which is **behind `main`**. This document is a source inventory of `main`, not of the live build.
**Rows that can differ live** (merged after the live release — re-check after the next release): the Runs-pane settled states (`TimetableRunsPane.tsx:143-192`), the 390 px drift-banner leg (`SimpleDriftBanner.tsx:158-185`), and the `Must fix` vocabulary (`timetable-plain-language.ts:43`). Every such row is marked **[live re-check]**.

**Purpose:** one enumeration the operator's QA lane verifies live, row by row. A row that could not be cited was not written. A control that was searched for and not found is recorded in §15, not omitted.

## Status vocabulary (exact values, used in every row)

| Status | Meaning |
| --- | --- |
| `OK` | Reachable, truthfully labelled, destination exists and is mounted, covered by a rendered test. |
| `DEAD` | Renders but cannot do anything; or its target is unmounted/unreachable; or it is permanently disabled with no path to enabled. |
| `DUPLICATE` | A second control doing the same job as another visible one. |
| `MISLABELLED` | The label does not describe what the control does. |
| `CONTRADICTS` | It disagrees with another visible control or status statement on the same screen. |
| `UNTESTED` | No rendered test covers it. |
| `NOT FOUND` | Used **only** on the two rows that record a control the packet asked about which does not exist on the surface. Those rows point at §15, where the search and its evidence are recorded in full. No row that renders uses this value. |

**"Rendered test" rule used throughout.** A test counts only if it mounts the component and asserts on the produced DOM (JSDOM + `react-dom/client`, `react-dom/server` `renderToStaticMarkup`, or a `*.harness.tsx` harness). A test that `readFileSync`s the source and regex-matches a `data-testid` or a string **does not count** and is reported as `UNTESTED` with the gap named. Every cited test file is reachable from a committed `atlas-client/package.json` script; the script name is given per row.

**Test-name abbreviations** used in the `Covering test` cell: the file basename without extension, then the `test(...)` name prefix, then the script.

---

## §1 `/timetable` — status region and action row

The row is one band: `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx:610` (`data-testid="timetable-simple-header"`). It renders in the Simple layout only, inside `showSchedulerChrome` (`ScheduleReviewWorkspace.tsx:557-579`).

| # | Control (label as rendered) | Where (route + file:line) | Enabled/disabled rule and the VISIBLE reason | What it does / where it goes | Read-only or mutating | Covering test | Status |
|---|---|---|---|---|---|---|---|
| 1 | Status region, `role="region" aria-label="Timetable status"` | `/timetable` · `TimetableSimpleHeader.tsx:620` | Always rendered. Not a control. | Holds rows 2–7. | Read-only | `draft-ux-c01` S1/S2R · `test:draft-ux-c01` (renders the header, counts visible controls) | `OK` |
| 2 | `Term` (non-interactive `<span>`) | `/timetable` · `simple/SimpleBeneficiaryControls.tsx:28` | Always rendered. | Label for row 3. | Read-only | `draft-ux-c01` S2R · `test:draft-ux-c01`; `timetable-relaxed-main-c01` A2 · `test:timetable-relaxed-main` | `OK` |
| 3 | `Term` (select trigger, `aria-label="Term"`) | `/timetable` · `simple/SimpleBeneficiaryControls.tsx:31-40` | Never disabled. Options come from `context.termOptions`; an unverified authority yields no fabricated option (`timetable-relaxed-main-c01` A1) — no disabled state, so no reason to show. | Sets `context.onTermFilterChange('all' \| Number)`; re-reads the grid. No request of its own. | Read-only (selection only) | `draft-ux-c01` S2R · `test:draft-ux-c01`; `timetable-relaxed-main-c01` A2/A4 · `test:timetable-relaxed-main` | `OK` |
| 4 | `Show` (non-interactive `<span>`) + view-type select `aria-label="View type"` (Section / Teacher / Room) | `/timetable` · `simple/SimpleHeaderHelpers.tsx:278,285-293` | Never disabled. | `handleViewModeChange` (`TimetableSimpleHeader.tsx:540`) — changes the pivot dimension and clears the grid selection. | Read-only (selection only) | `draft-ux-c01` S2R · `test:draft-ux-c01` | `OK` |
| 5 | `Schedule for` (non-interactive `<span>`) + `SearchableSelect` | `/timetable` · `simple/SimpleHeaderHelpers.tsx:295,298-308` | `disabled={!entityOptionsAvailable}`; `disabledReason="No schedule options are available yet. Generate or load a timetable first."` — **the reason is visible** in the control. | `handleEntityChange` (`:550`) — pivots to one section/teacher/room. | Read-only (selection only) | `UNTESTED` — the disabled branch and its reason have no rendered assertion; the only references are the pure selector logic, not a mounted control. | `UNTESTED` |
| 6 | Small-viewport schedule sheet trigger, `aria-label="Showing <View> schedule: <label>"` | `/timetable` (<1024 px) · `simple/SimpleHeaderHelpers.tsx:332-347` | `className="… lg:hidden"` — never disabled, hidden at ≥`lg`. | Opens `Sheet` `timetable-simple-schedule-sheet` (`:348-365`) which re-renders row 4 + row 5. | Read-only | `timetable-header-collapse-c01` · `test:timetable-relaxed-main`; `timetable-ux-rehaul-c01` · `test:timetable-ux-rehaul` | `OK` |
| 7 | Merged warnings control — face is the readiness chip; `aria-label` is `<action>: <readiness>` or, when nothing to do, the bare readiness string | `/timetable` · `simple/SimpleHeaderActions.tsx:134-144` | `disabled={dispatch === 'none'}` (`:139`). **When disabled there is no visible reason** — the face is the same chip either way, and only the `aria-label` drops the action name. This is the one disabled control in the action row with no stated reason. | `dispatch` is `generation-blockers` → `SimpleGenerationBlockerSheet`; `readiness-sheet` → `SimplePublishReadinessSheet`; `review-issues` → the review-issues task; `none` → nothing. `handleWarningsClick` `TimetableSimpleHeader.tsx:494-504`. | Read-only (navigation) | `draft-ux-c01` S1 (action name), PL-J1.4a/b/c (each readiness state) · `test:draft-ux-c01`; `timetable-relaxed-main-c01` C7 · `test:timetable-relaxed-main` | `OK` |
| 8 | Readiness chip — `data-testid="timetable-simple-readiness-chip"`; three visual states `unplaced` / `blockers` / `outstanding` / `clear` | `/timetable` · `simple/SimpleSetupSharedControls.tsx:116-130` (blocking) and `:142-156` (neutral) | Display only, never disabled. The blocking variant prints the consequence in text (`:114`, `:128`), not colour alone. | No action. Its own `aria-label` is `<readiness>. <consequence>.` | Read-only | `draft-ux-c01` PL-J1.4a/b/c, PL-J4.1/1R/1S/1T, PL-J4.2 · `test:draft-ux-c01` | `OK` |
| 9 | `Generate` (solid primary, no generated run) or `New version` (published) | `/timetable` · `simple/SimpleHeaderHelpers.tsx:616-628`; mounted `TimetableSimpleHeader.tsx:713-720` | `disabled={generateActionState.disabled}`; the reason is rendered in a `@/ui` Tooltip on a focusable wrapper (`GatedAction`, `:551-570`) **and** in the `aria-label` (`:622`). Visible reason present. | `shouldDispatchSimpleGenerate(canPlanOrGenerate)` guard, then `context.handleTriggerGenerate()`. | **Mutating** (creates a generation run) | `draft-ux-c01` S1 (no-run primary), PL-J4.5/5R · `test:draft-ux-c01` | `OK` |
| 10 | `Publish schedule` (solid primary once a run exists) | `/timetable` · `simple/SimpleHeaderHelpers.tsx:650-662`; mounted `TimetableSimpleHeader.tsx:721-727` | `disabled={!enabled}` from `capabilities.gates.publication`; reason shown in the same tooltip + `aria-label` (`:656`). Visible reason present. | `handlePublishActionClick` → `handlePublishClick` (`:430-456`): opens the publish task checklist, or the readiness sheet. | **Mutating** (changes the published output) | `draft-ux-c01` S1 (run-exists primary) · `test:draft-ux-c01` | `OK` |
| 11 | `Published schedule — <n> follow-up item(s) remain` + `Changes start on a date you choose` | `/timetable` · `simple/SimpleHeaderHelpers.tsx:697-711`; mounted `TimetableSimpleHeader.tsx:728-729` | `role="status"`, no `disabled`, no `<button>` — a status surface, not a control. | None. | Read-only | `timetable-header-collapse-c01` · `test:timetable-relaxed-main`; `timetable-ux-rehaul-c01` · `test:timetable-ux-rehaul` | `OK` |
| 12 | `More` (`aria-label="More"`) | `/timetable` · `TimetableSimpleHeader.tsx:734-744` | Never disabled. | Opens the six-group dropdown (`:746-792`). | Read-only (menu) | `draft-ux-c01` S1/S1b (`openHeaderMore()`) · `test:draft-ux-c01` | `OK` |
| 13 | `The last schedule build did not finish. Check schedule information, then try again.` | `/timetable` · `TimetableSimpleHeader.tsx:647-650` | Rendered only when `latestRunFailed` (`:286`). | Statement, not a control. | Read-only | `UNTESTED` — the failed-run status line has no rendered assertion in any registered suite. | `UNTESTED` |
| 14 | `<n> rule break(s) did not stop publishing, but … still worth reviewing.` | `/timetable` · `TimetableSimpleHeader.tsx:651-655` | Rendered when `publishBlockTruth.nonBlockingHardCount > 0`. | Statement. | Read-only | `UNTESTED` — the non-blocking-HARD notice has no rendered assertion. | `UNTESTED` |

### §1b The status region has no draft-vs-published statement

| # | Control | Where | Rule | Effect | Read-only | Covering test | Status |
|---|---|---|---|---|---|---|---|
| 15 | **No control states whether the grid is the working draft or the published schedule.** | Searched: `TimetableSimpleHeader.tsx:620-676` (the whole status region), `simple/SimpleHeaderActions.tsx:114-148` (the only chip), `TimetableSubNav.tsx:22-30`, `simple/SimpleHeaderHelpers.tsx:196-221` (`readinessLabel`). The only state-dependent text is `SimplePublishedState` (row 11), which renders **only** when the run *is* published — an unpublished draft prints nothing. | n/a | n/a | Read-only | n/a, there is nothing to render or to test | `NOT FOUND` (see §15 row 221) |

---

## §2 The tab strip — `TimetableSubNav`

`atlas-client/src/components/timetable/TimetableSubNav.tsx:32-72`, mounted on every `/timetable*` route at `ScheduleReviewWorkspace.tsx:389`. Five `NavLink`s (`:22-30`); the nested children are element-less (`App.tsx:226-236`), so navigation never remounts the workspace.

| # | Control (label as rendered) | Where (route + file:line) | Enabled/disabled rule and the VISIBLE reason | What it does / where it goes | Read-only or mutating | Covering test | Status |
|---|---|---|---|---|---|---|---|
| 16 | `h1` page title (`data-testid="timetable-page-heading"`), text = `resolveRouteChrome(pathname).title` | all `/timetable*` · `TimetableSubNav.tsx:39-44`; titles `app-shell/navigation.ts:103-115`, index title from `navigation.ts:41` → **"Class Schedule"** | Always rendered. | Statement. | Read-only | `timetable-relaxed-main-b02` B3 · `test:timetable-relaxed-main` | `OK` |
| 17 | `Schedule` | `/timetable` · `TimetableSubNav.tsx:23` (`end`) | Never disabled. `centerView='schedule'` via the guarded setter. | Mounted. | Read-only | `timetable-relaxed-main-c01` A5 · `test:timetable-relaxed-main` | `OK` |
| 18 | `Draft` | `/timetable/pre-generation` · `TimetableSubNav.tsx:26` | Never disabled. | Mounted; renders the pre-generation grid (`CenterWorkspace.tsx:766-926`). See §13 rows 197–206. | Read-only | `timetable-relaxed-main-c01` A5 · `test:timetable-relaxed-main` | `OK` |
| 19 | `Setup` | `/timetable/setup` · `TimetableSubNav.tsx:27` | Never disabled. | Mounted. See §13 rows 207–212. | Read-only | `timetable-relaxed-main-c01` A5 · `test:timetable-relaxed-main`; `ux-r03e-timetable-runs-setup` · `test:timetable-route-keys` | `OK` |
| 20 | `Policies` | `/timetable/policies` · `TimetableSubNav.tsx:28` | Never disabled. | Mounted (`CenterWorkspace.tsx:447-469`). See §13 rows 213–222 — this surface carries mislabelled copy. | Read-only (view) / **mutating** (its Save Policy) | `timetable-relaxed-main-c01` A5 · `test:timetable-relaxed-main`; `ux-r03a` · `test:timetable-route-keys` | `OK` |
| 21 | `Runs` | `/timetable/runs` · `TimetableSubNav.tsx:29` | Never disabled. | Mounted. See §13 rows 223–229. **[live re-check]** | Read-only | `timetable-relaxed-main-c01` A5 · `test:timetable-relaxed-main`; `timetable-runs-pending-custody-a2` · `test:a2-timetable-custody` | `OK` |

No sub-nav entry for `/timetable/map`, `/timetable/manual-edit`, `/timetable/building` or `/timetable/exports`; those four are reached only from More ▸ Tools (rows 39–42) or by URL. `exports` is a legacy redirect into `?print=1` (`TimetableRouteViewSync.tsx:48-53`); there is no control for it and none is expected.

---

## §3 The More menu — every group and every item

Six groups, confirmed: `Schedule actions` (`simple/SimpleHeaderActions.tsx:183`), `Daily tasks` (`simple/SimpleMoreMenuContent.tsx:74`), `Expert tools` (`:108`), `Help & display` (`:165`), `Tools` (`:208`), `Schedule data` (`:237`).

### 3a `Schedule actions` — `simple/SimpleHeaderActions.tsx:182-259`

| # | Control (label as rendered) | Where (route + file:line) | Enabled/disabled rule and the VISIBLE reason | What it does / where it goes | Read-only or mutating | Covering test | Status |
|---|---|---|---|---|---|---|---|
| 22 | `Next step: <label>` | `simple/SimpleHeaderActions.tsx:186-201` | `suppressPrimaryAction` clears it entirely (`:512`); otherwise `disabled={lifecycleAction.disabled \|\| context.loading}` with **no visible reason** on the disabled branch. | In-place → `context.handleRefresh()`; href → `Link` to the repair target; else `handleLifecycleAction` (`:458-475`). | Read-only unless the step is a generate | `UNTESTED` — `timetable-more-next-step` appears in no test file, rendered or otherwise. | `UNTESTED` |
| 23 | `Generate` (label `New version` when published) with the gate reason as a second line (`data-testid="timetable-more-generate-reason"`) | `simple/SimpleHeaderActions.tsx:204-221` | `visible={headerPrimary !== 'generate'}`; `disabled={generateActionState.disabled}` and the reason **is** printed inline (`:216`). | Same dispatch as row 9. | **Mutating** | `draft-ux-c01` S1b (asserts `timetable-more-generate` renders in More) · `test:draft-ux-c01` | `OK` |
| 24 | `Preview demand` | `simple/SimpleHeaderActions.tsx:223-233` | `visible={generationReady && !hasGeneratedRun}`; `disabled={!canPlanOrGenerate}`. The disabled branch shows **no reason**. | `setInsertionOpen(true)` → `UnassignedInsertionWorkflow` (`TimetableSimpleHeader.tsx:825-831`). | Read-only (preview) | `UNTESTED` — `timetable-unassigned-insertion-action` is referenced only by `timetable-operator-workflow-state.test.ts` (`test:timetable-operator-ux`), which asserts the pure predicate, not a rendered menu item. | `UNTESTED` |
| 25 | `Return to published` | `simple/SimpleHeaderActions.tsx:234-243` | `visible={isPreGenerationWorkspace && Boolean(hasPublishedReturnState)}` — **not rendered** on `/timetable`. | `context.returnToGeneratedRun`. | Read-only (discards the working view) | `timetable-post-deploy-c04` / `-c05` · `test:timetable-post-deploy-c04`, `test:timetable-post-deploy-c05` | `OK` |
| 26 | `Download schedules` | `simple/SimpleHeaderActions.tsx:244-253` | `downloadAvailable={hasGeneratedRun}` — **hidden** with no run. | Sets `?print=1` on the current URL (`TimetableSimpleHeader.tsx:227-234`), which opens `SchedulerPrintDialog` (`:799-810`). | Read-only (file generation, no schedule change) | `draft-ux-c01` S1/S1b (asserts the text is in the More menu) · `test:draft-ux-c01`; `timetable-term-export-c03r3` · `test:client-suite` | `OK` |
| 27 | `School information` / `Check school information` (drift) | `simple/SimpleHeaderActions.tsx:254-259`; label source `TimetableSimpleHeader.tsx:752` | Never disabled. | `Link to="/timetable/setup"` — mounted. | Read-only | `draft-ux-c01` S1 (asserts the link and `href="/timetable/setup"`) · `test:draft-ux-c01` | `OK` |

### 3b `Daily tasks` — `simple/SimpleMoreMenuContent.tsx:73-106`

| # | Control (label as rendered) | Where (route + file:line) | Enabled/disabled rule and the VISIBLE reason | What it does / where it goes | Read-only or mutating | Covering test | Status |
|---|---|---|---|---|---|---|---|
| 28 | `Unassigned sessions (<n>)` with the reason as a second line | `simple/SimpleMoreMenuContent.tsx` (item) rendered by `simple/SimpleHeaderActions.tsx:286-303` | `disabled` when `unassignedUnavailable != null` (pre-generation workspace, or no generated run) **or** `count === 0`; the reason line is always rendered (`:297`) — "Unassigned sessions belong to a generated schedule…", "No generated schedule yet.", or "No unassigned sessions in <Term>." Visible reason present. | `startTask('unassigned-sessions')` → left tab `unassigned` + the task drawer's `SimpleUnassignedSessionsPanel` (`TimetableTaskDrawer.tsx:206-207`). | Read-only (navigation) | `draft-ux-c01` S5 (both the populated and the 0-with-reason cases, rendered) · `test:draft-ux-c01` | `OK` |
| 29 | `Place unresolved sessions` | `simple/SimpleMoreMenuContent.tsx:76-80` | Rendered only when `summary.unassignedCount > 0`; `disabled={!runToolsAvailable}` and the reason is **screen-reader only** (`<span className="sr-only">`, `:79`) — not visible on screen. | `startTask('place-unresolved')`. | Read-only (navigation) | `UNTESTED` — `ux-audit-findings-c01` F7 (`:377-383`) matches this testid in the **source file text**, not in rendered markup. | `UNTESTED` |
| 30 | `Swap sessions` | `simple/SimpleMoreMenuContent.tsx:81-85` | `disabled={!runToolsAvailable}`; reason again `sr-only` (`:84`). | `startTask('swap-sessions')` → arms the two-class swap (`timetableSwapArming.ts`). | Read-only until a pair is picked; the commit is **mutating** | `UNTESTED` — same source-text test as row 29. | `UNTESTED` |
| 31 | `Teacher leaving / Reassign load` | `simple/SimpleMoreMenuContent.tsx:86-95` | `disabled={!runToolsAvailable}`; reason `sr-only` (`:94`). | `onOpenTeacherDeparture` → `TeacherDepartureRecoverySheet` (`ScheduleReviewWorkspace.tsx:662-681`). | **Mutating** (Teaching Load ownership) | `UNTESTED` — `timetable-operator-repair.test.ts` / `timetable-operator-workflow-state.test.ts` (`test:timetable-operator-ux`) cover the pure dispatch, not the rendered item. | `UNTESTED` |
| 32 | `Review room requests (<n>)` | `simple/SimpleMoreMenuContent.tsx:97-105` | Rendered only when `context.requestPendingCount > 0`; `disabled={requestPendingCount === 0}` (unreachable while rendered — dead predicate, not a visible defect). | `setLeftTab('requests')` + expands the left rail. | Read-only | `UNTESTED` — referenced only by `timetable-dynamic-workspace-capabilities-guard.test.ts` (`test:client-suite`), a source-string guard. | `UNTESTED` |

### 3c `Expert tools` — `simple/SimpleMoreMenuContent.tsx:107-160`

| # | Control (label as rendered) | Where (route + file:line) | Enabled/disabled rule and the VISIBLE reason | What it does / where it goes | Read-only or mutating | Covering test | Status |
|---|---|---|---|---|---|---|---|
| 33 | `Review issues` | `simple/SimpleMoreMenuContent.tsx:109-115` | `hidden` entirely when `moreHidesReviewIssues` (row 7 owns it). `disabled={!runToolsAvailable}`, reason `sr-only` (`:113`). | `startTask('review-issues')` → left tab `violations`. | Read-only | `draft-ux-c01` S1c (asserts it is **absent** from More when the header owns the action) · `test:draft-ux-c01` — rendered | `OK` |
| 34 | `Schedule history (<n>)` / `Schedule history` + reason line | `simple/SimpleMoreMenuContent.tsx:118-135` | `disabled={context.editHistoryCount === 0}` with the reason **visible** (`:128-130`). | `context.setShowEditHistory(true)` → `TimetableAssignmentDialogs` edit-history dialog (`modals/TimetableAssignmentDialogs.tsx:24-112`). Read-only list with per-row revert. | Read-only until a row revert is pressed (then **mutating**) | `UNTESTED` — `schedule-clarity-c03.test.ts` (`test:schedule-clarity`) references the testid in source text only. | `UNTESTED` |
| 35 | `Advanced rules` | `simple/SimpleMoreMenuContent.tsx:139-151` | Never disabled. | `Link to="/timetable/policies"` **and** `onLayoutModeChange('advanced')`. Mounted. | Read-only | `UNTESTED` — `ux-r03a` / `ux-r03e` (`test:timetable-route-keys`) and `timetable-dynamic-workspace-capabilities-guard` assert the href in source text, not rendered markup. | `UNTESTED` |
| 36 | `Expert view` | `simple/SimpleMoreMenuContent.tsx:152-159` | Never disabled. | `onLayoutModeChange('advanced')`; also writes `localStorage['atlas_timetable_layout_mode']` (`ScheduleReviewWorkspace.tsx:86-92`). | Read-only (view switch) | `UNTESTED` — `data-testid="timetable-layout-toggle"` appears in no test file. Note the same testid is reused on the Advanced→Simple button (`ScheduleReviewWorkspace.tsx:591`); the two are in mutually exclusive branches, so they never co-render. | `UNTESTED` |

### 3d `Help & display` — `simple/SimpleMoreMenuContent.tsx:164-204`

| # | Control (label as rendered) | Where (route + file:line) | Enabled/disabled rule and the VISIBLE reason | What it does / where it goes | Read-only or mutating | Covering test | Status |
|---|---|---|---|---|---|---|---|
| 37 | `Tutorial` | `simple/SimpleMoreMenuContent.tsx:166-175` | Rendered only when `onOpenTutorial` is passed (it always is, `TimetableSimpleHeader.tsx:780`). | Opens `SimpleTutorialControl` triggerless (`:839`) — `simple/SimpleHeaderHelpers.tsx:455-537`. | Read-only | `UNTESTED` — `timetable-relaxed-main-c01` A3 (`:466-475`) is explicitly labelled "(source contract)" and only `readFileSync`s the menu. | `UNTESTED` |
| 38 | `Day options` group + `<n> earlier row(s) hidden` chip + `Show full day` / `Full day` toggle | `simple/SimpleMoreMenuContent.tsx:176-187`; controls `simple/SimpleDayOptions.tsx:39-49` (chip) and `:58-70` (toggle) | The **whole block is hidden** unless `policyAlignmentWarning \|\| hiddenRowCount > 0` (`SimpleMoreMenuContent.tsx:176`). The toggle renders only when `hiddenRowCount > 0`. `inline` is passed, so the popover trigger at `SimpleDayOptions.tsx:88` is **not** rendered in the menu — only the controls are. | Toggles `context.setShowFullDay` — changes which time rows are displayed. | Read-only (display) | `UNTESTED` — `timetable-more-day-options` is matched in source text by `timetable-relaxed-main-c01` A3 and `timetable-ux-rehaul-c01` (`test:timetable-ux-rehaul`); neither renders the menu. | `UNTESTED` |
| 39 | `Status key` (list of `STATUS_ITEMS`) | `simple/SimpleMoreMenuContent.tsx:188-203`; source `TimetableStatusLegend.tsx:8-21` | Always rendered inside the group. | Display only. Shares one `STATUS_ITEMS` constant with the Advanced legend (`TimetableStatusLegend.tsx:32-44`). | Read-only | `UNTESTED` — matched in source text by `timetable-relaxed-main-c01` A3. | `UNTESTED` |

### 3e `Tools` — `simple/SimpleMoreMenuContent.tsx:207-235`

| # | Control (label as rendered) | Where (route + file:line) | Enabled/disabled rule and the VISIBLE reason | What it does / where it goes | Read-only or mutating | Covering test | Status |
|---|---|---|---|---|---|---|---|
| 40 | `Teacher concerns` | `simple/SimpleMoreMenuContent.tsx:211-216` | Never disabled. | `Link to="/faculty/concerns"` — mounted (`App.tsx:204-206`). | Read-only | `UNTESTED` — no test file references `timetable-more-teacher-concerns`. | `UNTESTED` |
| 41 | `Campus map` | `simple/SimpleMoreMenuContent.tsx:217-222` | Never disabled. | `Link to="/timetable/map"` — mounted (`CenterWorkspace.tsx:585-620`). | Read-only | `UNTESTED` — `timetable-relaxed-main-c01` A3 is a source contract. | `UNTESTED` |
| 42 | `Manual edit` | `simple/SimpleMoreMenuContent.tsx:223-228` | Never disabled. | `Link to="/timetable/manual-edit"` — mounted. **Note:** the pane needs a selected class; with none it renders the honest empty state (`CenterWorkspace.tsx:547-584`). | Read-only | `UNTESTED` — `timetable-relaxed-main-c01` A3 is a source contract. | `UNTESTED` |
| 43 | `Building view` | `simple/SimpleMoreMenuContent.tsx:229-234` | Never disabled. | `Link to="/timetable/building"` — mounted. **Note:** with no building selected it renders the honest empty state (`CenterWorkspace.tsx:712-743`), so from More alone it lands on "No building selected". | Read-only | `UNTESTED` — `timetable-relaxed-main-c01` A3 is a source contract. | `UNTESTED` |

### 3f `Schedule data` — `simple/SimpleMoreMenuContent.tsx:236-263`

| # | Control (label as rendered) | Where (route + file:line) | Enabled/disabled rule and the VISIBLE reason | What it does / where it goes | Read-only or mutating | Covering test | Status |
|---|---|---|---|---|---|---|---|
| 44 | Run select, placeholder `Run to review` / `No generated run yet`; options `Latest Run` and `runAnchorLabel(id, timestamp)` | `simple/SimpleMoreMenuContent.tsx:238-253` | `disabled={context.runs.length === 0 \|\| context.centerView === 'pre-generation'}`; the placeholder states the reason when there are no runs, but the **pre-generation disabled case prints no reason**. | `context.handleRunChange` — same selection path the header select uses. | Read-only (selection) | `UNTESTED` | `UNTESTED` |
| 45 | `Refresh timetable` | `simple/SimpleMoreMenuContent.tsx:255-258` | Never disabled. | `context.handleRefresh()` — re-reads the run bundle. | Read-only | `UNTESTED` | `UNTESTED` |
| 46 | `Refresh school names` (+ the sentence "Updates displayed names for the selected school year only. It does not change the schedule.") | `simple/SimpleMoreMenuContent.tsx:261`; control `simple/SimpleSetupSharedControls.tsx:165-181` | Never disabled. | `context.refreshReferenceLabels()`. | Read-only (reference cache) | `UNTESTED` — `ux-r03e-timetable-runs-setup.test.ts` (`test:timetable-route-keys`) checks the testid in the **setup pane** source, not the menu item. | `UNTESTED` |

**Grouping note (not a status finding).** The six groups are the finding recorded by the operator's QA lane (`docs/reviews/timetable-live-walk-20260926/findings.md:88`): everyday work and expert/technical tools are interleaved in one 6-group dropdown. Every group and item is enumerated above and every item is reachable; the complaint is ordering, not deadness. It is carried into §16 as a live question, not asserted here.

---

## §4 The grid

`atlas-client/src/components/timetable/TimetableGrid.tsx`; mounted at `CenterWorkspace.tsx:820-860` (schedule) and `:820` (draft).

| # | Control (label as rendered) | Where (route + file:line) | Enabled/disabled rule and the VISIBLE reason | What it does / where it goes | Read-only or mutating | Covering test | Status |
|---|---|---|---|---|---|---|---|
| 47 | Grid cell, `role="button"`, `aria-label="Move selected session to <Day> <time>"` — only while a move source is armed; otherwise `aria-label="Timetable slot <Day> <time>"` with no role | `TimetableGrid.tsx:301-366` | `hasKbSource` gates `role`/`tabIndex`/`aria-label`/handlers (`:306-312`). No disabled state. | Click/keyboard/touch → `onKbPlace(day,start,end)`; on a published run the entry is read-only (`:883`, `useTimetableEntryReadOnly`). | **Mutating** (writes the placement) | `ux-audit-findings-c01-dom` F6 (published read-only rendering) · `test:ux-audit-findings`; `timetable-relaxed-main-c01` C8/C9 · `test:timetable-relaxed-main` | `OK` |
| 48 | Blocked special-event cell, `aria-label="Blocked slot: <event> on <Day> <time>"` | `TimetableGrid.tsx:223-241` | Rendered only when a `hasKbSource` move is armed. Enter/Space → `toast.info("This slot is blocked by … Choose a regular class slot.")`. | Informs; performs nothing. | Read-only | `UNTESTED` | `UNTESTED` |
| 49 | Cell hover conflict state — cell decoration while a drag source is live | `TimetableGrid.tsx:317-340` (`onMouseEnter`/`onFocus` → `setKbConflictInfo`), `:741-789` (grid-wide pointer preview) | Active only while `kbSelectedSource != null`. | Decoration; the 40 ms defer at `:100` is deliberate. | Read-only | `timetable-scrollbar-wiring-c01` · `test:client-suite` (grid wiring) | `OK` |
| 50 | Placement target label `Place` / `Swap` (icon + text, never colour alone) | `TimetableGrid.tsx:390-399` | Rendered only when a placement source exists **and** the hovered cell is `kind === 'clean'`. | Statement. | Read-only | `timetable-scheduling-quality-c03` · `test:timetable-relaxed-main` | `OK` |
| 51 | Drag — `GripVertical` handle + `DraggableEntry` | `TimetableGrid.tsx:452-456,492`; `TimetableDraggableEntry.tsx` | `readOnly` hides the grip and forces `cursor-default` (`:486`, `:492`). | `@dnd-kit` drag → drop resolves through `useTimetableDragDrop.ts` into a preview, then one Confirm. | **Mutating** | `timetable-relaxed-main-b02` B1 · `test:timetable-relaxed-main` | `OK` |
| 52 | Conflict badge — `Must fix` (icon + text) or `Warning`; tooltip `Must fix - fix before saving` / `Warning - review before saving`; per-displacement links `- View Teacher` / `- View Section` / `- View Room` | `TimetableGridConflictBadge.tsx:126-193`, mounted `TimetableGrid.tsx:377-384` | Rendered only while a drag/hover source is active on a `hard`/`soft` cell. | The three nav links re-point the entity filter (`onNavToFaculty/Section/Room`). | Read-only | `draft-ux-c01` PL-J1.1 (rendered: the badge says `Must fix`, never `Blocked`) · `test:draft-ux-c01` | `OK` |
| 53 | Tooltip heading of row 52, literal `'Must fix - fix before saving'` | `TimetableGridConflictBadge.tsx:156` | n/a | n/a | Read-only | `UNTESTED` — `plain-language-j2j3-c01` T7 (`:693-720`) asserts `severitySummary` derives from `MUST_FIX_LABEL` and that the file still *uses* the constant at `:140`/`:143`; no test asserts this tooltip heading is derived, and no test renders the hover state. **Raw literal in a file that imports `MUST_FIX_LABEL` two lines above it** (`timetable-plain-language.ts:43` defines the one word). **[live re-check]** | `UNTESTED` |
| 54 | Tooltip severity prefix, literal `'Must fix: '` | `TimetableGridConflictBadge.tsx:90` | n/a | n/a | Read-only | `UNTESTED` — same gap as row 53; `plain-language-j2j3-c01` T7 covers `severitySummary` only. **[live re-check]** | `UNTESTED` |
| 55 | Entry severity sign, `role="img"`, `aria-label="<n> Must fix, <m> warnings"` | `TimetableGridConflictBadge.tsx:70-84`; mounted `TimetableGrid.tsx:504-510` | Renders only when the entry has a severity. | `@/ui` Tooltip discloses the reasons. | Read-only | `ux-audit-findings-c01-dom` F3 (focus opens a tooltip naming the real violation) · `test:ux-audit-findings`; `ux-audit-findings-c01` F3 · `test:ux-audit-findings` | `OK` |
| 56 | Entry accessible name: `Select <subject> for <section>, <Day> <time>, <n> warning(s), <h> Must fix, <s> Schedule note` | `TimetableGrid.tsx:459-461` | `View …` instead of `Select …` when `readOnly` (published run). | Accessible name only. | Read-only | `UNTESTED` — no rendered test asserts this `aria-label`. | `MISLABELLED` |
| 57 | The visible severity wording beside the same count: `severitySummary` → `"<h> Must fix, <s> warning(s)"` (`TimetableGridConflictBadge.tsx:22-34`) | `TimetableGridConflictBadge.tsx:31-32` vs `TimetableGrid.tsx:460-461` | n/a | n/a | Read-only | `plain-language-j2j3-c01` T7 · `test:plain-language-j2j3-c01` (asserts the shared derivation) | `MISLABELLED` |
| 58 | Ceremony overlay label (`Flag` + event name) | `TimetableGrid.tsx:368-376` | Rendered only when `ceremonyOverlayWithClass`. | Annotates the class; never replaces it. | Read-only | `timetable-day-scope-c03r` · `test:client-suite` | `OK` |
| 59 | Cohort badge (`cohortCode`) | `TimetableGrid.tsx:512-516` | `entryKind === 'COHORT' && cohortCode`. | Statement. | Read-only | `UNTESTED` | `UNTESTED` |
| 60 | Sandbox / teacher-departure / conflict / follow-up badges | `TimetableGrid.tsx:517-528`; `TimetableGridEntryBadges.tsx:13` | Each gated on its own set membership. | Statement. | Read-only | `timetable-scheduling-quality-c03` · `test:timetable-relaxed-main` | `OK` |
| 61 | Cell detail line + tooltip (`<teacher/room> · <room>` etc.) | `TimetableGrid.tsx:559-571`; text composition `:542-554`; `dedupeCellGradeRepetition` `:26-34` | Always rendered for an entry. The tooltip carries the un-deduped string. | Statement. | Read-only | `timetable-ux-rehaul-c01` F-07 (dedupe function) · `test:timetable-ux-rehaul`; `timetable-cell-info` · `test:client-suite` | `OK` |
| 62 | Cell detail in **Room view**: `roomLabelShort(id)` = `<room name> · <buildingShortCode>` — the live label `G10 Room 101 · G1AW` | `timetable-reference-labels.ts:88-97` (`:94-95`); surfaced as the pivot label `useTimetableData.ts:1944-1947`; entity picker `simple/SimpleHeaderHelpers.tsx:298-308` | Never disabled. | The `G1AW` token is `room.buildingShortCode`. Nothing in the timetable subtree defines it: the cell tooltip in room view shows `<section> · <teacher>` only (`TimetableGrid.tsx:552`), and no legend, `aria-label` or help string names the building code. `dedupeCellGradeRepetition` cannot drop it — `'G1AW'.startsWith('G10')` is false, so `TimetableGrid.tsx:33` returns the string untouched. | Read-only | `timetable-ux-rehaul-c01` F-07 · `test:timetable-ux-rehaul` (dedupe only; no test asserts the suffix is explained) | `MISLABELLED` |
| 63 | `Show <n> more class(es)` overflow trigger (with the `N need teacher` badge) | `TimetableGrid.tsx:578-601`; sheet `:604-621` | Rendered only when `termFilter !== 'all' && cellEntries.length > 2` — under `All terms` every entry is shown instead (`:272-273`). | `TimetableCellOverflowSheet` (`TimetableCellOverflowSheet.tsx:75-190`) with per-entry select / swap / reassign. | Read-only until a swap/reassign is confirmed (**mutating**) | `ux-audit-findings-c01-dom` · `test:ux-audit-findings`; `timetable-scheduler-simplicity-c01` · `test:timetable-scheduler-simplicity` | `OK` |
| 64 | Per-term entry label (only under `All terms`) | `TimetableGrid.tsx:494-502` | `termFilter === 'all'` only. | Statement. | Read-only | `timetable-relaxed-main-c01` A2 · `test:timetable-relaxed-main` | `OK` |

---

## §5 Selection strip, session dialog, swap arming

| # | Control (label as rendered) | Where (route + file:line) | Enabled/disabled rule and the VISIBLE reason | What it does / where it goes | Read-only or mutating | Covering test | Status |
|---|---|---|---|---|---|---|---|
| 65 | Selection strip, `role="status"`, `Selected: <subject> · <section>` + the hint sentence | `ScheduleReviewWorkspace.tsx:471-487` | Only in Simple, only with a selected entry, only on a scheduler view. | Statement. | Read-only | `UNTESTED` — `simple-selected-primary-action` appears in no test file. | `UNTESTED` |
| 66 | `Choose a new time for selected class` (primary button) | `ScheduleReviewWorkspace.tsx:489-500`; label source `:328-344` | Never disabled; hidden when no entry is selected. | `startMoveSelectedEntry` (`:282-292`) → inline placement preview. | **Mutating** | `UNTESTED` | `UNTESTED` |
| 67 | `More actions for selected class` → `Dismiss selection` | `ScheduleReviewWorkspace.tsx:503-511` | Never disabled. | Clears the selection. | Read-only | `UNTESTED` | `UNTESTED` |
| 68 | `Choose a new time` (in the strip's More menu) | `ScheduleReviewWorkspace.tsx:512-515` | Never disabled. | Same as row 66, which is the visible primary button in the same strip — so with the menu open the strip shows one action under two names, and the same is true of row 70 vs the primary's `Swap with another class` (`ScheduleReviewWorkspace.tsx:328-333`). | **Mutating** | `UNTESTED` | `DUPLICATE` |
| 69 | `Change room` | `ScheduleReviewWorkspace.tsx:516-519` | Never disabled. Branches on `state.publishedChangeScope`. | Draft → `enterManualEditView('CHANGE_ROOM')`; published → the dated-change dialog (`:685-705`). | **Mutating** | `UNTESTED` | `OK` |
| 70 | `Swap with another class` | `ScheduleReviewWorkspace.tsx:520-523` | Never disabled (gated upstream by `capabilities.gates.swap` in `startTask`). | `armSwapSessions` (`:208-218`). | **Mutating** | `UNTESTED` | `OK` |
| 71 | `View class details` | `ScheduleReviewWorkspace.tsx:524-527` | Never disabled. | `openSimpleSelectedDetails` (`:294-300`) → `SimpleSessionDetails`. | Read-only | `draft-ux-c01` S4 (renders the dialog at desktop) · `test:draft-ux-c01` | `OK` |
| 72 | `Change Teaching Load owner` (+ sub-line "Opens Teaching Load for this subject, section, and teacher") | `ScheduleReviewWorkspace.tsx:529-535` | Never disabled. | `openSelectedOwnerRepair` (`:317-326`) → `/teaching-load?facultyId&sectionId&subjectId&task=missing-load`. | **Mutating** (Teaching Load) | `UNTESTED` | `OK` |
| 73 | `Teacher leaving (all classes)` (+ sub-line "Bulk repair for every class this teacher handles") | `ScheduleReviewWorkspace.tsx:536-542` | Never disabled. | `openTeacherDepartureRecovery` → the same sheet as row 31. | **Mutating** | `UNTESTED` | `OK` |
| 74 | `Expert details` | `ScheduleReviewWorkspace.tsx:543-550` | Never disabled. | `setLayoutMode('advanced')` + expand the right panel. | Read-only | `UNTESTED` | `OK` |
| 75 | `Swap class times: choose Class A on the grid.` / `… Class A selected. Choose Class B on the grid.` + `Cancel` | `TimetableSimpleHeader.tsx:890-917` (`Cancel` at `:905-914`) | Rendered only when `swapClassTimesMode != null`. | `Cancel` clears the mode and both picks (`:574-578`). | Read-only (disarms) | `UNTESTED` — `timetable-swap-class-times-cancel` appears in no test file. | `UNTESTED` |
| 76 | Session details — centred `@/ui` Dialog at ≥768 px, bottom `Sheet` below | `simple/SimpleSessionDetails.tsx:147-178` (`timetable-simple-details-dialog` / `-sheet`); mounted `ScheduleReviewWorkspace.tsx:707-765` | Both render the same `SessionDetailsBody`; neither is disabled. | — | Read-only | `draft-ux-c01` S4 (desktop dialog and mobile drawer, rendered) · `test:draft-ux-c01` | `OK` |
| 77 | Summary cards `Class` / `Teacher` / `Room` / `Time` (`Tuesday · 09:00–10:00`) | `simple/SimpleSessionDetails.tsx:91-94` | Always rendered. | Statement. | Read-only | `draft-ux-c01` S4 · `test:draft-ux-c01` | `OK` |
| 78 | `Warnings · <n>` list; per-row literal prefix `'Must fix: '` / `'Warning: '` | `simple/SimpleSessionDetails.tsx:96-115` (literal at `:107`) | Rendered only when the entry has warnings. | Statement; each item says whether it blocks saving/publishing. | Read-only | `UNTESTED` — the file does not import `MUST_FIX_LABEL` at all, and no rendered test asserts this prefix. **[live re-check]** | `UNTESTED` |
| 79 | `Move time` | `simple/SimpleSessionDetails.tsx:118-120` | Never disabled. | Inline placement preview. | **Mutating** | `UNTESTED` — `timetable-simple-details-move-time` appears in no test file. | `UNTESTED` |
| 80 | `Change room` | `simple/SimpleSessionDetails.tsx:121-123` | Never disabled. | Row 69. | **Mutating** | `UNTESTED` | `UNTESTED` |
| 81 | `Swap` | `simple/SimpleSessionDetails.tsx:124-126` | Never disabled. | Row 70. | **Mutating** | `UNTESTED` | `UNTESTED` |
| 82 | `Change owner` | `simple/SimpleSessionDetails.tsx:127-129` | Never disabled. | Row 72. | **Mutating** | `UNTESTED` | `UNTESTED` |
| 83 | `Expert details` | `simple/SimpleSessionDetails.tsx:130-132` | Never disabled. | Row 74. | Read-only | `UNTESTED` | `UNTESTED` |
| 84 | `Close` | `simple/SimpleSessionDetails.tsx:133-135` | Never disabled. | Closes. | Read-only | `draft-ux-c01` S4 · `test:draft-ux-c01` | `OK` |
| 85 | `Undo` (auto-save strip, after a committed placement) | `ScheduleReviewWorkspace.tsx:428-467` (button `:441-464`, testid `:446`) | Rendered only while `state.lastAutoSaveUndo` is set; the strip is cleared on scope change (`:151`). | `dispatchUndoByLedger(target, {revertRunEdit, revertDraftEdit})` — the draft-queue variant reverts the draft ledger, the run variant reverts the run manual edit. | **Mutating** (a revert) | `timetable-relaxed-main-b02` B1 ("keeps Undo reachable", rendered) · `test:timetable-relaxed-main`; `timetable-relaxed-main-c01` C10/C11 · `test:timetable-relaxed-main` | `OK` |
| 86 | `Redo` + `Dismiss` (redo strip, `topSlot` of the session dialog) | `ScheduleReviewWorkspace.tsx:725-764` (`Redo` `:739-750`, `Dismiss` `:752-761`) | Rendered only while `state.redoState \|\| state.redoVersionStale`; the dialog itself must be open. | `state.redoLastEdit()` / `state.clearRedo()`. | **Mutating** | `UNTESTED` — `timetable-dynamic-workspace-undo-redo.test.ts` (`test:client-suite`) asserts the **source string** of the control and its mount, not a rendered redo strip; no test renders `ScheduleReviewWorkspace.tsx:725-764`. | `UNTESTED` |
| 87 | `Version-stale` notice | `ScheduleReviewWorkspace.tsx:733-737` | Rendered when `state.redoVersionStale` — dispatching nothing, as the sentence says. | Statement. | Read-only | `UNTESTED` | `UNTESTED` |
| 88 | Inline placement preview: `Confirm`, `Cancel`, room picker, consequence line | `ScheduleReviewWorkspace.tsx:416-427`; controls `InlinePlacementPreview.tsx:47,64,77,100,112` | `Confirm` disabled with the typed reason on a blocked destination (`timetable-relaxed-main-b02` B1). | Exactly one Confirm commits. | **Mutating** | `timetable-relaxed-main-b02` B1 (all six cases, rendered) · `test:timetable-relaxed-main` | `OK` |
| 89 | Published-entry change dialog: `Move this class from a date` / `Change this class's room from a date`, its `Schedule` and close | `ScheduleReviewWorkspace.tsx:685-705`; panel `modals/PublishedEntryChangePanel.tsx:147-234` | Opened only when `publishedEntryChange && publishedChangeScope`. | Dated change against the published run. | **Mutating** | `timetable-post-deploy-c04` / `-c05` · `test:timetable-post-deploy-c04`, `test:timetable-post-deploy-c05` | `OK` |
| 90 | `Checking schedule information…` overlay while a refresh runs with a draft on screen | `ScheduleReviewWorkspace.tsx:377-384` | `state.loading && state.draft`. | Statement. | Read-only | `timetable-lifecycle-loading-render-c03` · `test:timetable-lifecycle-loading` | `OK` |

---

## §6 Publish readiness sheet

`atlas-client/src/components/timetable/SimplePublishReadinessSheet.tsx`; mounted from the header (`TimetableSimpleHeader.tsx:855-889`) and from `/timetable/setup` (`TimetableSetupPane.tsx:297-328`). The repair dispatch is the one shared implementation, `dispatchSimpleReadinessRepair` (`TimetableSimpleHeader.tsx:126-201`).

| # | Control (label as rendered) | Where (route + file:line) | Enabled/disabled rule and the VISIBLE reason | What it does / where it goes | Read-only or mutating | Covering test | Status |
|---|---|---|---|---|---|---|---|
| 91 | Sheet, title `Publish Readiness`, sub-line `Why can't I publish?` | `SimplePublishReadinessSheet.tsx:354-365` | Only when opened. | — | Read-only | `draft-ux-c01` PL-J1.4 · `test:draft-ux-c01` | `OK` |
| 92 | `No timetable generated yet` | `SimplePublishReadinessSheet.tsx:237-240` | When `!hasGeneratedRun`. | Statement. | Read-only | `draft-ux-c01` PL-J1.4a/b/c · `test:draft-ux-c01` | `OK` |
| 93 | Whole-year vs selected-term scope block | `SimplePublishReadinessSheet.tsx:243-256` | When `hasGeneratedRun`. | Statement; uses `MUST_FIX_LABEL` throughout. | Read-only | `draft-ux-c01` PL-J1.4a/b/c · `test:draft-ux-c01` | `OK` |
| 94 | `Ready to publish` / `Cannot publish yet` / `Ready except for warnings` | `SimplePublishReadinessSheet.tsx:258-266, 270-276, 286-291` | One of the three, by state. | Statement. | Read-only | `draft-ux-c01` PL-J1.4a/b/c · `test:draft-ux-c01` | `OK` |
| 95 | Blocker group row + its action button (`<actionLabel>`, `aria-label="<actionLabel>: <plainLabel>, <n> sessions affected"`) | `SimplePublishReadinessSheet.tsx:92-155` (button `:115-129`) | Rendered once per `blockerGroups` entry; the button is never disabled. | `onNavigateToRepair(href, reason, identity, count)` → the shared dispatch. Teaching Load → `/teaching-load?…`; rooms → `/map`; placement → the queue with the reason filter; review → the violation in the rail (`:161-200`). | Read-only (navigation) | `draft-ux-c01` C1-a (the real group count, rendered) · `test:draft-ux-c01`; `plain-language-j2j3-c01` · `test:plain-language-j2j3-c01` | `OK` |
| 96 | `Show <n> more` / `Show less` | `SimplePublishReadinessSheet.tsx:140-149` | Only when `group.items.length > 3`. | Expands the affected list. | Read-only | `UNTESTED` | `UNTESTED` |
| 97 | Warning group row + expand | `SimplePublishReadinessSheet.tsx:162-205` (row `:167-190`, expand `:197`) | One per `warningGroups` entry. | Statement. | Read-only | `draft-ux-c01` PL-J1.4c · `test:draft-ux-c01` | `OK` |
| 98 | `Copy summary` | `SimplePublishReadinessSheet.tsx:312-321` | Rendered only when `hasBlockers \|\| hasWarnings`. | Clipboard write of the plain-text report; never requests anything. | Read-only | `draft-ux-c01` PL-J1.4R (asserts the pasted text uses the same words) · `test:draft-ux-c01` | `OK` |
| 99 | `Download CSV` | `SimplePublishReadinessSheet.tsx:322-331` | Same gate as row 98. | Client-side Blob `publish-blockers-run-<id>.csv`. | Read-only | `UNTESTED` | `UNTESTED` |
| 100 | `Close` | `SimplePublishReadinessSheet.tsx:334-342` | Always. | Closes. | Read-only | `UNTESTED` | `UNTESTED` |

---

## §7 The drift banner

`atlas-client/src/components/timetable/simple/SimpleDriftBanner.tsx`. Two mount points, with different prop sets — this matters for every row below.

- `/timetable` — `TimetableSimpleHeader.tsx:624-642`: `layout="inline"`, **`showActions={false}`**, `showRolloverGuidance={false}`, `onRegenerate` **supplied**.
- `/timetable/setup` — `TimetableSetupPane.tsx:221-233`: defaults, so `showActions` and `showRolloverGuidance` are **true**, `onRegenerate` **not** supplied, `onStartRevision` supplied.

| # | Control (label as rendered) | Where (route + file:line) | Enabled/disabled rule and the VISIBLE reason | What it does / where it goes | Read-only or mutating | Covering test | Status |
|---|---|---|---|---|---|---|---|
| 101 | `Schedule information changed` (STALE) / `Schedule information could not be checked` (UNKNOWN) + the message line | `SimpleDriftBanner.tsx:135-185`; message `:181-184`; gating `:121` | Rendered only when `!isPreGenerationWorkspace && draft != null && drift.status !== 'FRESH'`. | Statement; STALE and UNKNOWN use different wording **and** different tone (`:139-144`). | Read-only | `draft-ux-c01` PL-J4.3/3R/4 (rendered) · `test:draft-ux-c01`; `timetable-drift-banner-390-a2` · `test:a2-timetable-custody` | `OK` |
| 102 | Domain chips (`timetable-simple-repair-<domain>` labels are separate rows) | `SimpleDriftBanner.tsx:150-157` | `showActions` — **suppressed on `/timetable`**, shown on `/timetable/setup`. | Statement. | Read-only | `timetable-drift-banner-390-a2` · `test:a2-timetable-custody` | `OK` |
| 103 | `Review changes` (published run) | `SimpleDriftBanner.tsx:192-194` | `showActions && isPublished` — so `/timetable/setup` only. | `Link to={drift.primaryHref}`. | Read-only | `draft-ux-c01` PL-J4.3 · `test:draft-ux-c01` | `OK` |
| 104 | `Start a revision` (published run) | `SimpleDriftBanner.tsx:195-197` | `disabled={!onStartRevision}` — reachable only on `/timetable/setup`, which passes it, so never disabled in practice. | `inputs.onStartRevision` → the published-revision dialog. | **Mutating** | `timetable-post-deploy-c04` / `-c05` · `test:timetable-post-deploy-c04`, `test:timetable-post-deploy-c05` | `OK` |
| 105 | `Review changes` (draft run) | `SimpleDriftBanner.tsx:201-203` | `showActions && !isPublished` — `/timetable/setup` only. | `Link to={drift.primaryHref}`. | Read-only | `UNTESTED` | `UNTESTED` |
| 106 | `Fix <domain>` per changed domain | `SimpleDriftBanner.tsx:206-224` | Rendered only when `capabilities.gates.setupInputStatus.enabled`; otherwise the `Repair setup` row below. | `Link to={domain.href}`. | Read-only | `UNTESTED` — no rendered assertion for the per-domain repair links. | `UNTESTED` |
| 107 | `Repair setup` (disabled fallback) | `SimpleDriftBanner.tsx:226-237` | `disabled` when the `setupInputStatus` gate denies; the reason is in the `aria-label` (`:231`) but **not visible on screen**. | Nothing — it is a gate explanation, not a link. | Read-only | `UNTESTED` | `UNTESTED` |
| 108 | `Open Year Setup` (primary fallback) | `SimpleDriftBanner.tsx:238-250` | Rendered only when `repairGate.enabled && needsPrimaryFallback` (i.e. the umbrella `primaryHref` matches no per-domain href). | `Link to={drift.primaryHref}`. | Read-only | `UNTESTED` | `UNTESTED` |
| 109 | `Preview impact` — the **setup-repair** variant | `SimpleDriftBanner.tsx:251-254` | `showActions && !isPublished` — `/timetable/setup` only. | `setShowImpactPreview(true)` → `SetupImpactDialog` (`:294-299`). | Read-only (preview) | `UNTESTED` | `UNTESTED` |
| 110 | `Preview impact` — the **regenerate** variant | `SimpleDriftBanner.tsx:263-273` | `showRegenerateAction = Boolean(onRegenerate) && !isPublished && showRunDrift` — so **`/timetable` only**, because the setup pane passes no `onRegenerate`. | `setShowRegenerateImpact(true)` → `RegenerateImpactDialog` (`:300-308`). | Read-only (preview) | `timetable-drift-banner-390-a2` · `test:a2-timetable-custody` | `OK` |
| 111 | `Regenerate to apply` | `SimpleDriftBanner.tsx:274-286`; disabled rule `:123` | `disabled={regenerating \|\| loading \|\| !regenerationEnabled \|\| activeGeneratedRunId == null}`; reason in the `aria-label` (`:281`) only — **not visible on screen**. Guarded again at dispatch (`:111-119`). | `RegenerateImpactDialog` → `onConfirm` → `context.handleTriggerGenerate()`. | **Mutating** (rebuilds the run) | `draft-ux-c01` PL-J4.5/5R (rendered: the routine rebuild is not the destructive button) · `test:draft-ux-c01` | `OK` |
| 112 | `Not now` / `Regenerate to apply` (dialog footer) | `SimpleDriftBanner.tsx:367-378` | `Confirm` `disabled={!generationEnabled}` — no visible reason. | Confirms the rebuild. | **Mutating** | `UNTESTED` | `UNTESTED` |
| 113 | `RolloverGuidanceCard` | `SimpleDriftBanner.tsx:291-293`; component `components/runtime/RolloverGuidanceCard.tsx` | `showRolloverGuidance` — **suppressed on `/timetable`**, mounted on `/timetable/setup`. | Rollover sync guidance (`onApplied` → `onRefresh`). | **Mutating** (rollover sync) | `UNTESTED` | `UNTESTED` |
| 114 | The 390 px leg of rows 101/110/111 — the message line is given `w-full basis-full` below `sm` so the actions wrap onto their own rows | `SimpleDriftBanner.tsx:158-185` (classes `:178`) | n/a | n/a | Read-only | `timetable-drift-banner-390-a2` (source-level class control **plus** a rendered assertion of the surviving actions) · `test:a2-timetable-custody` | `OK` **[live re-check]** |

---

## §8 Unassigned sessions and the insertion workflow

| # | Control (label as rendered) | Where (route + file:line) | Enabled/disabled rule and the VISIBLE reason | What it does / where it goes | Read-only or mutating | Covering test | Status |
|---|---|---|---|---|---|---|---|
| 115 | Task drawer — the entry point for rows 116–124 | `TimetableTaskDrawer.tsx:154`; mounted `ScheduleReviewWorkspaceBody.tsx:73-92` (Simple only) | Only when `activeSimpleTask != null`. | — | Read-only | `draft-ux-c01` S5 (the drawer opens from the More item, rendered) · `test:draft-ux-c01` | `OK` |
| 116 | Search `Find section, subject, or session...` (`aria-label="Search unresolved sessions"`) | `GeneratedUnassignedPanel.tsx:172-175`; panel `:153` | Never disabled. | Client-side filter. | Read-only | `timetable-dynamic-workspace-rendered` · `test:client-suite` | `OK` |
| 117 | `Clear unresolved search` (`aria-label`) | `GeneratedUnassignedPanel.tsx:182` | Rendered only when the query is non-empty. | Clears. | Read-only | `UNTESTED` | `UNTESTED` |
| 118 | Status filters (`aria-label="Unresolved status filters"`) | `GeneratedUnassignedPanel.tsx:190` | Never disabled. | Filters the list. | Read-only | `UNTESTED` | `UNTESTED` |
| 119 | Grade and reason filters (`aria-label="Unresolved grade and reason filters"`) | `GeneratedUnassignedPanel.tsx:210` | Never disabled. | Filters the list. | Read-only | `UNTESTED` | `UNTESTED` |
| 120 | Result count line | `GeneratedUnassignedPanel.tsx:258` | Always. | Statement. | Read-only | `UNTESTED` | `UNTESTED` |
| 121 | `Diagnostics` block: `Lowest teaching-load coverage`, `Most saturated times` | `GeneratedUnassignedPanel.tsx:326-341` | Always rendered in the panel. | Read-only diagnostics. | Read-only | `UNTESTED` | `UNTESTED` |
| 122 | Per-item card (draggable onto the grid) | `GeneratedUnassignedPanel.tsx:427` | Always per item. | Drag → placement preview → one Confirm. | **Mutating** | `timetable-ttc02-insertion` · `test:timetable-operator-ux` | `OK` |
| 123 | Insertion workflow dialog: `Unassigned insertion`, `aria-label="Refresh readiness"`, `Fix Teaching Load ownership`, demand-line browser + search, `Previous` / `Next`, `Save` boundary note | `UnassignedInsertionWorkflow.tsx:138,143,211,218,220,238-239,287,295` | Opened only by `Preview demand` (row 24), which itself needs `generationReady && !hasGeneratedRun`. | Previews demand lines and records the boundary. | **Mutating** at the save step | `timetable-ttc02-insertion` · `test:timetable-operator-ux`; `timetable-c05r1-presentation-settings` (`test:client-suite`) | `OK` |

---

## §9 Download, print and export dialogs

`atlas-client/src/components/timetable/simple/SchedulerPrintDialog.tsx` — mounted from the header (`:799-810`, opened by `?print=1`) and from `/room-schedules` (`RoomSchedules.tsx:689-699`).

| # | Control (label as rendered) | Where (route + file:line) | Enabled/disabled rule and the VISIBLE reason | What it does / where it goes | Read-only or mutating | Covering test | Status |
|---|---|---|---|---|---|---|---|
| 124 | `Download schedules` (dialog title) + the explanation paragraph | `SchedulerPrintDialog.tsx:143-144` | Opens only with a valid scope. | — | Read-only | `timetable-c05r1-presentation-settings`, `timetable-c05-beneficiary-export` (`test:client-suite`) | `OK` |
| 125 | The unresolved-scope banner: `Choose one ordered term before downloading.` / `Choose a completed schedule run first.` / `School-year scope is not ready.` | `SchedulerPrintDialog.tsx:97-99,146` | Replaces the whole body when present. **Visible reason present.** | — | Read-only | `scheduler-print-requests` · `test:client-suite` | `OK` |
| 126 | `Word` / `Excel` (`aria-pressed`) | `SchedulerPrintDialog.tsx:149-150` | Never disabled; `docx` is the default (`:50`). | Sets the file format. | Read-only | `timetable-term-export-c03r3` · `test:client-suite` | `OK` |
| 127 | `Grade` / `Section` / `Teacher` / `Room` (`aria-pressed`) | `SchedulerPrintDialog.tsx:153-158` (list `:35-40`) | Never disabled; switching clears the selection (`:155`). | Sets the program type; the default is derived from the current grid view (`:80-81`). | Read-only | `timetable-c05r1-presentation-settings` · `test:client-suite` | `OK` |
| 128 | `Select all` / `Clear all` | `SchedulerPrintDialog.tsx:168-171` | `disabled={choices.length === 0}` with no reason line — but the list below prints `No <program> programs are available for this term.` (`:175`), so the reason is visible one line away. | Selects/deselects every choice. | Read-only | `timetable-c05r1-presentation-settings` · `test:client-suite` | `OK` |
| 129 | Search `Find a <program>` | `SchedulerPrintDialog.tsx:162-166` | Never disabled. | Filters the choice list. | Read-only | `timetable-c05r1-presentation-settings` · `test:client-suite` | `OK` |
| 130 | Per-item checkbox + label | `SchedulerPrintDialog.tsx:177-181` | Never disabled. | Selects ids. | Read-only | `timetable-c05r1-presentation-settings` · `test:client-suite` | `OK` |
| 131 | Footer line `<n> selected · <yearLabel> · Term <n>` | `SchedulerPrintDialog.tsx:183` | Always. | Statement. | Read-only | `export-download-identity` · `test:client-suite` | `OK` |
| 132 | `Header and signatories` | `SchedulerPrintDialog.tsx:188` | Rendered whenever `onOpenPresentationSettings` is supplied — and the header supplies it **unconditionally** (`TimetableSimpleHeader.tsx:809`), while the dialog it opens is mounted only when `hasGeneratedRun` (`TimetableSimpleHeader.tsx:812-820`). Reachable failure: open the dialog by URL with `?print=1` and no generated run — the button renders and the dialog it opens is not in the tree. | `setPresentationSettingsOpen(true)` → `ExportPresentationSettingsDialog`. | **Mutating** (saves the export profile) | `UNTESTED` — `timetable-c05r1-presentation-settings.test.ts` renders `SimpleExportMenu`, never the header's no-run branch, so the mismatch is not exercised. | `DEAD` |
| 133 | `Close` | `SchedulerPrintDialog.tsx:189` | Always. | Closes. | Read-only | `timetable-c05r1-presentation-settings` · `test:client-suite` | `OK` |
| 134 | `Download Word` / `Download Excel` / `Download ZIP` / `Preparing…` | `SchedulerPrintDialog.tsx:190-193` | `disabled={!options \|\| loading \|\| busy \|\| Boolean(unresolvedReason) \|\| selectedIds.length === 0}`. **No visible reason on the disabled branch** — but rows 125 and 183 state the two causes the operator can act on. | POSTs the resolved print request and downloads the blob. | Read-only (file generation) | `timetable-term-export-c03r3`, `export-download-identity` (`test:client-suite`) | `OK` |
| 135 | `Official export profile` dialog: the profile fields, `Cancel`, `Save` | `ExportPresentationSettingsDialog.tsx:114-201` (`Cancel` `:192`, `Save` `:199`); placeholders `:159,181` | Mounted only with `hasGeneratedRun` (see row 132). | Saves the header/signatory profile via `exportPresentationApi.ts`. | **Mutating** | `timetable-c05r1-presentation-settings` · `test:client-suite` | `OK` |

---

## §10 Manual edit

| # | Control (label as rendered) | Where (route + file:line) | Enabled/disabled rule and the VISIBLE reason | What it does / where it goes | Read-only or mutating | Covering test | Status |
|---|---|---|---|---|---|---|---|
| 136 | `Manual edit` (More ▸ Tools) | `simple/SimpleMoreMenuContent.tsx:223-228` | Never disabled. | `/timetable/manual-edit`. | Read-only (navigation) | `UNTESTED` — see row 42. | `UNTESTED` |
| 137 | Empty state `No class selected for manual edit` + `Back to Schedule` | `CenterWorkspace.tsx:561-582` (published note `:568-572`) | Shown when `centerView === 'manual-edit'` with no `selectedEntry`. | Names the three real ways in. | Read-only | `ux-r03b-center-view-routes` · `test:timetable-route-keys` | `OK` |
| 138 | `ManualEditPanel` — its own controls (move, room, teacher, follow-up, preview, commit) | `CenterWorkspace.tsx:521-544`; component `atlas-client/src/components/ManualEditPanel.tsx` | Rendered only with a selected entry. | Preview → commit, with the soft-override dialog. | **Mutating** | `UNTESTED` — **not enumerated here**: this inventory did not read `ManualEditPanel.tsx`, so no control inside it is claimed. Recorded in §15. | `UNTESTED` |

---

## §11 The expert / Advanced view

`ScheduleReviewWorkspaceHeader` (`atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx`) + `TimetableToolbar.tsx` + `TimetableAdvancedHeaderHelp.tsx` + `TimetableUndoRedoControl.tsx` + `LeftRail.tsx` + `TacticalSandboxDock*`. Reached from `ScheduleReviewWorkspace.tsx:580-610` when `layoutMode === 'advanced'`.

| # | Control (label as rendered) | Where (route + file:line) | Enabled/disabled rule and the VISIBLE reason | What it does / where it goes | Read-only or mutating | Covering test | Status |
|---|---|---|---|---|---|---|---|
| 139 | `Simple view` (`aria-label="Switch to simple timetable view"`) | `ScheduleReviewWorkspace.tsx:585-595` | Never disabled. | `setLayoutMode('simple')`. | Read-only | `timetable-dynamic-workspace-undo-redo` (source contract) · `test:client-suite` | `OK` |
| 140 | `Undo last change` (`aria-label="Undo last manual timetable change"`) in the Advanced guidance bar | `TimetableAdvancedHeaderHelp.tsx:56-71`; mounted `ScheduleReviewWorkspaceHeader.tsx:756-762` | Rendered **only** when `editHistoryCount > 0 && mode === 'schedule'`. | `onRevertLastEdit` = `revertLastEdit`. | **Mutating** (a revert) | `timetable-relaxed-main-b02` B2 (renders the guidance bar) · `test:timetable-relaxed-main` — but **no test asserts it is the only Undo** | `DUPLICATE` |
| 141 | `Undo` (`aria-label="Undo last manual timetable change"`, `data-testid="timetable-visible-undo"`) | `TimetableUndoRedoControl.tsx:34-46`; mounted `ScheduleReviewWorkspace.tsx:597-606` | `disabled={revertLoading \|\| editHistoryCount === 0}`. **No visible reason on the disabled branch.** | `revertLastEdit` — the same function row 140 receives. | **Mutating** | `timetable-dynamic-workspace-undo-redo` asserts the **source string** of the control and its mount · `test:client-suite`; no rendered test mounts it. | `DUPLICATE` |
| 142 | `Redo` (`aria-label="Redo the last reverted change"`) | `TimetableUndoRedoControl.tsx:47-59` | `disabled={revertLoading \|\| !redoState}`; no visible reason. | `redoLastEdit` with a fresh CAS. | **Mutating** | `timetable-dynamic-workspace-undo-redo` (source string) · `test:client-suite` | `UNTESTED` |
| 143 | `History (<n>)` | `TimetableUndoRedoControl.tsx:70-82` | `disabled={editHistoryCount === 0}`; no visible reason. | `setShowEditHistory(true)` — the same edit-history dialog row 34 opens, but row 34 lives in the **Simple** More menu and this is the **Advanced** control, so the two are in mutually exclusive layouts and are not simultaneously visible. | Read-only | `timetable-dynamic-workspace-undo-redo` (source string) · `test:client-suite` | `OK` |
| 144 | `Version-stale` + `Dismiss` (Advanced) | `TimetableUndoRedoControl.tsx:60-69,83-87` | Only when `redoVersionStale`. | `clearRedo`. | Read-only | `UNTESTED` | `UNTESTED` |
| 145 | Guidance line `No precision dragging required.` + the per-mode sentence, and `TimetableStatusLegend` | `TimetableAdvancedHeaderHelp.tsx:44-56`; legend `TimetableStatusLegend.tsx:23-44` | Always. | Statement. | Read-only | `timetable-relaxed-main-b02` B2 · `test:timetable-relaxed-main` | `OK` |
| 146 | Advanced term-authority notice + its disclosure | `ScheduleReviewWorkspaceHeader.tsx:408,417` | Rendered on an unverified authority. | Statement. | Read-only | `timetable-relaxed-main-c01` A1/A4 · `test:timetable-relaxed-main` | `OK` |
| 147 | `Newer run failed` notice | `ScheduleReviewWorkspaceHeader.tsx:397` | Rendered on that condition. | Statement. | Read-only | `UNTESTED` | `UNTESTED` |
| 148 | `Publish` (`timetable-advanced-publish`) | `ScheduleReviewWorkspaceHeader.tsx:468` | Gated by the shared publication capability. | `setShowPublishDialog(true)` (`ScheduleReviewWorkspaceBody.tsx:643-646`). | **Mutating** | `timetable-dynamic-workspace-capabilities-guard` (source guard) · `test:client-suite` | `OK` |
| 149 | `Return to published` | `ScheduleReviewWorkspaceHeader.tsx:525`; component `TimetablePublishedReturnAction.tsx:8-18` | Shown per the same predicate as row 25. | `returnToGeneratedRun`. | Read-only | `timetable-post-deploy-c04` / `-c05` · `test:timetable-post-deploy-c04`, `test:timetable-post-deploy-c05` | `OK` |
| 150 | `Generate` / the generate-repair variant (`timetable-advanced-generate`, `-generate-repair`) | `ScheduleReviewWorkspaceHeader.tsx:545,558` | Gated by `generationGate`; the repair variant replaces it when the gate offers a real repair (`:315-323`). | `handleTriggerGenerate` / `handleRefresh`. | **Mutating** (generate) / read-only (repair) | `timetable-dynamic-workspace-capabilities-guard` (source guard) · `test:client-suite` | `OK` |
| 151 | `Review room requests` (`timetable-advanced-requests`) | `ScheduleReviewWorkspaceHeader.tsx:632` | Gated by `requestPendingCount`. | Left rail `requests` tab. | Read-only | `timetable-dynamic-workspace-capabilities-guard` (source guard) · `test:client-suite` | `OK` |
| 152 | `How scheduling works` link → `/timetabling/how-it-works` | `ScheduleReviewWorkspaceHeader.tsx:711` | Never disabled. | Mounted (`App.tsx:240-242`). **The live walk's report that `/timetable/how-it-works` "silently returns" is a wrong-URL observation, not an app defect** — no control in the tree links that address. | Read-only | `timetable-relaxed-main-c01` A5, `ux-r03a` (both assert the route block in `App.tsx` source) · `test:timetable-relaxed-main`, `test:timetable-route-keys` | `OK` |
| 153 | Task-mode guide (`timetable-task-guide`) | `ScheduleReviewWorkspaceHeader.tsx:738`; `ScheduleReviewWorkspaceTaskModes.tsx` | Always. | Statement. | Read-only | `UNTESTED` | `UNTESTED` |
| 154 | Toolbar: view-type select (placeholder `View by`) | `TimetableToolbar.tsx:61-72` | Never disabled. | `setViewMode` + clears the selection (`:796-803`). | Read-only | `academic-term` · `test:client-suite` (toolbar term contract) | `OK` |
| 155 | Toolbar: entity `SearchableSelect` (placeholder `Select <view>...`) | `TimetableToolbar.tsx:74-83` | Never disabled (no `disabled` prop is passed, unlike row 5). | `setEntityFilter` + clears the selection. | Read-only | `UNTESTED` | `UNTESTED` |
| 156 | Toolbar: `Term` label + term select `data-testid="timetable-term-filter"` | `TimetableToolbar.tsx:85-97` | Never disabled. | `onTermFilterChange`. | Read-only | `academic-term` · `test:client-suite` | `OK` |
| 157 | Toolbar: `Filters` popover → `Program`, `Entry type`, `Attention type` chips | `TimetableToolbar.tsx:99-156`; the attention chips are passed as `children` from `ScheduleReviewWorkspaceHeader.tsx:844-875` | Never disabled. | Program / entry-kind / severity filters. | Read-only (display) | `academic-term` · `test:client-suite` | `OK` |
| 158 | Attention chips `All` / `Must fix` / `Warning` / `Conflicts` / `Well-being`, each with a count | `ScheduleReviewWorkspaceHeader.tsx:844-875` | Never disabled; `active` styling by `severityFilter`. | `setSeverityFilter`. | Read-only (display) | `timetable-dynamic-workspace-rendered` · `test:client-suite` | `OK` |
| 159 | `Schedule review` / `Grid view` presentation toggle | `ScheduleReviewWorkspaceHeader.tsx:826-841` | Never disabled. | `setPresentationMode('workflow' \| 'matrix')` → grid or `ClassProgramMatrixView`. | Read-only (display) | `UNTESTED` | `UNTESTED` |
| 160 | Left rail: `Expand panel` / `Collapse panel`, tabs `Violations` / `Unassigned` / `Pinned Sessions` / `Room Requests`, group label `Needs attention` | `LeftRail.tsx:59,63,75,86,95,107,116,124`; container `ViolationsSidebar.tsx:63` | `Violations` is hidden in the pre-generation workspace (recorded in `ScheduleReviewWorkspace.tsx:355-360`). | Left-rail tab selection. | Read-only | `timetable-dynamic-workspace-rendered` · `test:client-suite` | `OK` |
| 161 | `TacticalSandboxDock` — redistribution / qualification / availability / capability-override modules | `CenterWorkspace.tsx:928-958`; controls `TacticalSandboxDock.parts.tsx:84-475` | Mounted when `tacticalSandboxOpen \|\| sandboxFacultyByEntryId.size > 0 \|\| selectedUnassigned != null` (`:403-405`); each module is `disabled` on an unresolved scope with the reason printed (`timetable-redistribution-scope-unresolved` `:104`, `timetable-capability-scope-unresolved` `:406`, `timetable-availability-deferred` `:306`). | Local, non-persisted teacher reassignment, then preview/commit to Teaching Load. | **Mutating** on apply | `timetable-dynamic-workspace-behavioral`, `tt-tl-modules-c04r1-behavior` (`test:client-suite`) | `OK` |

---

## §12 The Building view and the Room Schedules view

### 12a Building view — `/timetable/map` → `/timetable/building` (`CenterWorkspace.tsx:585-743`)

| # | Control (label as rendered) | Where (route + file:line) | Enabled/disabled rule and the VISIBLE reason | What it does / where it goes | Read-only or mutating | Covering test | Status |
|---|---|---|---|---|---|---|---|
| 162 | Map badge + the mode sentence `View-only map workspace. Editing remains in /map?mode=editor.` (or the pre-generation variant) | `CenterWorkspace.tsx:596-599` | Always in map view. | Statement. | Read-only | `timetable-relaxed-main-c01` A8 · `test:timetable-relaxed-main` | `OK` |
| 163 | `Back to Schedule` / `Back to Grid` | `CenterWorkspace.tsx:601-605` | Never disabled. | `setCenterView('schedule' \| 'pre-generation')`. | Read-only | `UNTESTED` | `UNTESTED` |
| 164 | `Back to Map` (building view) | `CenterWorkspace.tsx:632-635` | Never disabled. | `setCenterView('map')`. | Read-only | `UNTESTED` | `UNTESTED` |
| 165 | `Building View` badge + building name | `CenterWorkspace.tsx:636-637` | Only with `selectedMapBuilding`. | Statement. | Read-only | `UNTESTED` | `UNTESTED` |
| 166 | `BuildingView` canvas + its own toolbar | `CenterWorkspace.tsx:651-660` (`showToolbar`); component `components/BuildingView.tsx` | Rendered only with a selected building. | Click a room → `openRoomGridWorkspace`. | Read-only | `UNTESTED` — `BuildingView.tsx`'s own toolbar is **not enumerated here**; see §15. | `UNTESTED` |
| 167 | Rooms list per floor: `F<floor>` + per-room button (room name + `ROOM_TYPE_LABELS` type) | `CenterWorkspace.tsx:666-707` (button `:687-700`) | Never disabled. | `openRoomGridWorkspace(room.id)` — pivots the grid to that room. | Read-only | `UNTESTED` | `UNTESTED` |
| 168 | `Empty` for a floor with no rooms | `CenterWorkspace.tsx:678-681` | Only when `rooms.length === 0`. | Statement. | Read-only | `UNTESTED` | `UNTESTED` |
| 169 | `No building selected` empty state + `Back to Map` | `CenterWorkspace.tsx:726-740` | Reached by URL entry to `/timetable/building`. | Statement + navigation. | Read-only | `ux-r03b-center-view-routes` · `test:timetable-route-keys` | `OK` |

### 12b Room Schedules — `/room-schedules` and `/schedules` (both `App.tsx:244-250`)

Page: `atlas-client/src/pages/RoomSchedules.tsx`. Term scope is mandatory here: the on-screen grid is single-term, fail-closed when unverified (`RoomSchedules.tsx:117,281-284`).

| # | Control (label as rendered) | Where (route + file:line) | Enabled/disabled rule and the VISIBLE reason | What it does / where it goes | Read-only or mutating | Covering test | Status |
|---|---|---|---|---|---|---|---|
| 170 | `Schedules` eyebrow + readiness chip (`Ready to review` / `Loading names` / `Choose schedule`) | `RoomSchedules.tsx:471-478` | Always. | Statement. | Read-only | `room-schedules-term-c01` · `test:room-schedules-term-c01` | `OK` |
| 171 | Selected-term badge `Showing <label>` / the unverified title | `RoomSchedules.tsx:483-488` | Always. | Statement. | Read-only | `room-schedules-term-c01` · `test:room-schedules-term-c01` | `OK` |
| 172 | `How to browse schedules` help | `RoomSchedules.tsx:492-501` | Never disabled. | `SmartHelpTrigger` walkthrough. | Read-only | `UNTESTED` | `UNTESTED` |
| 173 | `Tools` popover → `Latest` / `Run ID` + the `Generation run ID` input | `RoomSchedules.tsx:504-533` | Never disabled. `Run ID` invalid input prints `Use a whole number above 0.` (`:529`), `aria-invalid` set (`:527`). | Sets `sourceMode`; the input debounces 300 ms (`:258-261`). | Read-only | `room-schedules-term-c01` (source-level) · `test:room-schedules-term-c01` | `OK` |
| 174 | `Rooms` / `Teachers` / `Sections` view buttons | `RoomSchedules.tsx:538-557` (copy `:37-59`) | Never disabled. | `setViewMode`; switching away from `rooms` resets the occupancy presentation (`:548`). | Read-only | `room-schedules-term-c01` · `test:room-schedules-term-c01` | `OK` |
| 175 | Entity `SearchableSelect` (`Select room…` / `Select teacher…` / `Select section…`) + the status sentence below it | `RoomSchedules.tsx:568-579` (status `:425-431`) | Replaced by a `Skeleton` while `roomsLoading` (`:565-567`). The status sentence states loading / unavailable / none-available / count — **the reason is always visible**. | `setSelectedEntityId` → `fetchSchedule`. | Read-only | `room-schedules-term-c01` · `test:room-schedules-term-c01` | `OK` |
| 176 | View-term select, `aria-label="Schedule view term"` | `RoomSchedules.tsx:589-605` | `disabled={!termVerified}` — the header badge (row 171) already shows the unverified title, so the reason is visible one control away. | `setViewTerm` for a term inside the verified ordered contract. | Read-only | `room-schedules-term-c01` · `test:room-schedules-term-c01` | `OK` |
| 177 | `Download schedules` | `RoomSchedules.tsx:607-609` | Never disabled. | `SchedulerPrintDialog` (`:689-699`). | Read-only | `timetable-c05-beneficiary-export` (`test:client-suite`) | `OK` |
| 178 | `Occupancy` / `Schedule` toggle (rooms view only) | `RoomSchedules.tsx:611-618` | Rendered only when `viewMode === 'rooms'`. | Switches the grid for `OccupancyTemplatePreview`. | Read-only (display) | `UNTESTED` | `UNTESTED` |
| 179 | `Refresh` | `RoomSchedules.tsx:620-629` | `disabled={!selectedEntityId \|\| loading \|\| !isRunIdValid \|\| runIdHasValidationError \|\| runIdMissing}` — **no reason text on the control**; the invalid Run ID case does print one (row 173) and the empty-entity case is covered by the row 175 status sentence. | `fetchSchedule`. | Read-only | `UNTESTED` | `UNTESTED` |
| 180 | `Export CSV` | `RoomSchedules.tsx:632-641` | `disabled={state.status !== 'ok'}` with no reason. | `exportScheduleToCsv` — a client-side blob. | Read-only | `UNTESTED` | `UNTESTED` |
| 181 | Download-term select, `aria-label="Schedule download term"`, leading option `Choose one term` | `RoomSchedules.tsx:643-657` | Never disabled; `all` is explicitly "unresolved and keeps the official control disabled with zero dispatch" (`:94-96`), and the print dialog then shows row 125's banner. | Binds the download term. | Read-only | `room-schedules-term-c01` · `test:room-schedules-term-c01` | `OK` |
| 182 | `11x6` / `13x6` template buttons (rooms + occupancy only) | `RoomSchedules.tsx:704-705` | Rendered only when `viewMode === 'rooms' && presentationMode === 'occupancy'`. | `setTemplateVariant`. | Read-only (display) | `UNTESTED` | `UNTESTED` |
| 183 | Conflict badge `Conflict — Click to inspect` (`role="button"`, `aria-label="Inspect conflict"`) | `components/room-schedules/ScheduleTimetableGrid.tsx:176-187`; click `:154-163` | Rendered only when `cellData.conflict`. | `onConflictClick` → `ConflictInspectorSheet` (`RoomSchedules.tsx:804-811`). | Read-only | `UNTESTED` | `UNTESTED` |
| 184 | `Retry` in the error state | `RoomSchedules.tsx:758-760` | Rendered only in `state.status === 'error'`. | `fetchSchedule`. | Read-only | `UNTESTED` | `UNTESTED` |
| 185 | Utilisation / Occupied / Conflicts / `Run #<id> · <status>` summary | `RoomSchedules.tsx:662-687` | Rendered only when `state.status === 'ok'`. | Statement. **`Run #318 · COMPLETED` is raw engine wording** — the same complaint the operator's QA lane recorded as system-walk finding 6. | Read-only | `UNTESTED` | `MISLABELLED` |
| 186 | **No empty-state or utilisation affordance for a sparsely used room.** | `ScheduleTimetableGrid.tsx:122-134` renders an unoccupied `<td>` containing only the special-event label; the only utilisation summary in the product is `RoomSchedules.tsx:662-687`, and it appears only once a room is already selected. | n/a | n/a | Read-only | n/a, there is nothing to render or to test | `NOT FOUND` (see §15 row 224) |

---

## §13 The `/timetable` sub-views' own controls

### 13a `Draft` (`/timetable/pre-generation`)

| # | Control (label as rendered) | Where (route + file:line) | Enabled/disabled rule and the VISIBLE reason | What it does / where it goes | Read-only or mutating | Covering test | Status |
|---|---|---|---|---|---|---|---|
| 187 | `Map` button + the pivot context badge | `CenterWorkspace.tsx:780-811` | Rendered only in the pre-generation centre view. | `setCenterView('map')` + `setPreGenOnboarding(true)`. | Read-only | `timetable-relaxed-main-c01` A8 · `test:timetable-relaxed-main` | `OK` |
| 188 | `Nothing is placed in this draft yet. The draft is a separate working copy…` | `CenterWorkspace.tsx:816-818` | Only when `sandboxGridEntries.length === 0`. | Statement — the honest-naming answer to system-walk finding 3. | Read-only | `UNTESTED` | `OK` |
| 189 | `Save placement` | `CenterWorkspace.tsx:908-918` | `disabled={preGenSaving \|\| preGenPreviewLoading \|\| !preGenPreview \|\| hardViolations.length > 0}`; the reason is stated immediately above in the preview strip (`:889-906`). | `commitPreGenPending`. | **Mutating** | `timetable-relaxed-main-c01` C8/C9 · `test:timetable-relaxed-main` | `OK` |
| 190 | `Cancel` (pending-placement strip) | `CenterWorkspace.tsx:919-921` | Never disabled. | Clears the pending placement, preview, error and the soft override. | Read-only | `UNTESTED` | `UNTESTED` |
| 191 | Draft queue: search, grade / subject / section filters, drag pins | `TimetableTaskDrawer.tsx:264` (`SimpleDraftPlottingTray`); `LeftRailContent.tsx:187-360` | Always inside the `plan-draft` task. | Queue items drag into the draft grid. | Read-only (selection) | `timetable-dynamic-workspace-rendered` · `test:client-suite` | `OK` |
| 192 | `Find session` / reason filter / visible list in the generated plotting tray | `TimetableTaskDrawer.tsx:778-842` | Always inside `place-unresolved`. | Narrows the unplaced queue. | Read-only | `timetable-dynamic-workspace-rendered` · `test:client-suite` | `OK` |

### 13b `Setup` (`/timetable/setup`)

| # | Control (label as rendered) | Where (route + file:line) | Enabled/disabled rule and the VISIBLE reason | What it does / where it goes | Read-only or mutating | Covering test | Status |
|---|---|---|---|---|---|---|---|
| 193 | `Setup` badge + the guidance sentence | `TimetableSetupPane.tsx:237-240`; sentence source `:101-118` | Always. | Statement. | Read-only | `ux-r03e-timetable-runs-setup` · `test:timetable-route-keys` | `OK` |
| 194 | `Setup details are unavailable` + `Back to Schedule` | `TimetableSetupPane.tsx:139-151` | Only when `inputs == null`. | Statement + navigation. | Read-only | `ux-r03e-timetable-runs-setup` · `test:timetable-route-keys` | `OK` |
| 195 | Readiness chip (shared, `softCount` defaults to 0 here) | `TimetableSetupPane.tsx:244-249` | Display only. | Same implementation as row 8. | Read-only | `draft-ux-c01` PL-J1.4* (shared component) · `test:draft-ux-c01` | `OK` |
| 196 | `See what to fix` (generation blocked) / `Review readiness` | `TimetableSetupPane.tsx:251-262` | Never disabled; the label and target swap on `generationBlocked` (`:206-217`, `:258`). | `SimpleGenerationBlockerSheet` or `SimplePublishReadinessSheet`. | Read-only (navigation) | `generation-blockers-c02` · `test:generation-blockers-c02` | `OK` |
| 197 | The publish-blocked reason sentence | `TimetableSetupPane.tsx:264-268` | Only when `publishBlocked`. | Statement. | Read-only | `draft-ux-c01` PL-J4.1R (shared sentence) · `test:draft-ux-c01` | `OK` |
| 198 | `Refresh school names` (+ its sentence) | `TimetableSetupPane.tsx:276`; control `simple/SimpleSetupSharedControls.tsx:174-179` | Never disabled. | `inputs.onRefreshSetupNames`. | Read-only (reference cache) | `ux-r03e-timetable-runs-setup` (source) · `test:timetable-route-keys` | `OK` |
| 199 | `Back to Schedule` | `TimetableSetupPane.tsx:279-286` | Never disabled. | `Link to="/timetable"`. | Read-only | `ux-r03e-timetable-runs-setup` · `test:timetable-route-keys` | `OK` |

### 13c `Policies` (`/timetable/policies`)

`atlas-client/src/components/SchedulingPolicyPane.tsx`, mounted at `CenterWorkspace.tsx:457-467`.

| # | Control (label as rendered) | Where (route + file:line) | Enabled/disabled rule and the VISIBLE reason | What it does / where it goes | Read-only or mutating | Covering test | Status |
|---|---|---|---|---|---|---|---|
| 200 | Back button (`onBack`) + `Advanced rules` title | `SchedulingPolicyPane.tsx:485-499` | Never disabled. | `exitPolicyView` → the schedule grid. | Read-only | `UNTESTED` | `OK` |
| 201 | Policy status chip (`data-testid="policy-status-chip"`; `Policy saved` and friends) | `SchedulingPolicyPane.tsx:511-516` | Always. | Statement. | Read-only | `UNTESTED` | `UNTESTED` |
| 202 | Tabs `Policy` / `Shift Settings` | `SchedulingPolicyPane.tsx:524-525` | Never disabled. | Switches the pane's column. | Read-only | `UNTESTED` | `UNTESTED` |
| 203 | `Advanced rules` reveal / `Edit advanced rules` | `SchedulingPolicyPane.tsx:531,571` | Never disabled. | Reveals the editable field set. | Read-only | `UNTESTED` | `UNTESTED` |
| 204 | **`Save Policy`, whose busy label is the literal `'SavingG'` followed by U+01EA (a capital `E` with circumflex)** | `SchedulingPolicyPane.tsx:540-549` — the literal is at **`:548`** | `disabled={!isDirty \|\| saving}`; `Unsaved changes` is printed beside it (`:534-539`) — visible reason present. | `savePolicy` (`:251`). | **Mutating** (the scheduling policy) | `UNTESTED` — no rendered assertion of the button's label in either state. | `MISLABELLED` |
| 205 | **The pane's loading sentence: `Loading policyG` followed by U+01EA** | `SchedulingPolicyPane.tsx:555` | Rendered while `loading`. | Statement. | Read-only | `UNTESTED` | `MISLABELLED` |
| 206 | Lunch-window help strings: `Start of the lunch window G` + U+01EA + ` no classes will overlap this range.` and `End of the lunch window G` + U+01EA + ` classes resume after this time.` | `SchedulingPolicyPane.tsx:712,724` | Rendered with the lunch-window fields. | Help text. | Read-only | `UNTESTED` | `MISLABELLED` |
| 207 | Flexible-assignment label: `G` + U+01EA + `n+? Warning:` | `SchedulingPolicyPane.tsx:851` | Rendered with that section. | Help text. | Read-only | `UNTESTED` | `MISLABELLED` |
| 208 | The rest of the policy field set (per-rule inputs, plus the `Reconcile And Save` action) | `SchedulingPolicyPane.tsx:251-400` (action label at `:352`) | `disabled` by the pane's own dirty/saving rule; `Reconcile And Save` runs a reconciliation preview before writing. | **Not enumerated** — this inventory did not read the per-rule field list, so no control inside it is claimed. | **Mutating** (each field, and the reconcile) | `UNTESTED` — no rendered assertion for any of them | `UNTESTED` |

**Encoding note for rows 204–207.** `SchedulingPolicyPane.tsx` is the **only** file in `atlas-client/src` that contains invalid UTF-8: 93 `U+FFFD` replacement characters, 13 of them inside comments (`:5,67,127,129,480,552,654,826,841,856`) and the rest inside the four rendered strings above. Verified by reading every `.ts`/`.tsx` under `atlas-client/src` as UTF-8 and counting `U+FFFD` and the `G`+`U+01EA` sequence. No other file is affected.

### 13d `Runs` (`/timetable/runs`)

| # | Control (label as rendered) | Where (route + file:line) | Enabled/disabled rule and the VISIBLE reason | What it does / where it goes | Read-only or mutating | Covering test | Status |
|---|---|---|---|---|---|---|---|
| 209 | `Runs` badge + the header line (`Checking the generation runs…` / `could not be loaded` / `Runs · read-only history` / `<n> runs · newest first · read-only history`) | `TimetableRunsPane.tsx:139-142`; precedence `:90-99` | `pending` beats `populated` beats `unavailable` beats `empty`. | Statement. | Read-only | `timetable-runs-pending-custody-a2` (all four states, rendered) · `test:a2-timetable-custody` | `OK` **[live re-check]** |
| 210 | `Loading generation runs…` pending state | `TimetableRunsPane.tsx:143-159` | `runsPending`. | Statement. | Read-only | `timetable-runs-pending-custody-a2` · `test:a2-timetable-custody` | `OK` **[live re-check]** |
| 211 | `Generation runs could not be loaded` (+ the typed reason) | `TimetableRunsPane.tsx:160-175` | `runsUnavailableReason != null`. | Statement. | Read-only | `timetable-runs-pending-custody-a2` · `test:a2-timetable-custody` | `OK` **[live re-check]** |
| 212 | `No generation runs yet for this school year.` + `Back to Schedule` | `TimetableRunsPane.tsx:176-192` | Only the settled-empty state; the sentence is made exactly once (`:127-135`). | Statement + navigation. | Read-only | `timetable-runs-pending-custody-a2` · `test:a2-timetable-custody` | `OK` **[live re-check]** |
| 213 | `Review this run` (per non-selected row) | `TimetableRunsPane.tsx:225-235` | Hidden on the already-selected row. | `onSelectRun(id)` + `Link to="/timetable"`. | Read-only (selection) | `timetable-runs-pending-custody-a2` · `test:a2-timetable-custody` | `OK` |
| 214 | Per-row `Created` / `Duration` / `Version` / `Kind` / `Started` / `Finished` / error | `TimetableRunsPane.tsx:237-273` | Optional fields render when present. | Statement. **No row marks a run as *published*** — the list endpoint does not return `summary` (`:7-10`). | Read-only | `timetable-runs-pending-custody-a2` · `test:a2-timetable-custody` | `OK` |

---

## §14 Controls the product has that no reachable page renders

These are the "dead control" class the operator asked about. Each is cited with the proof that it is unmounted.

| # | Control | Where (route + file:line) | Rule | Destination | Read-only / mutating | Covering test | Status |
|---|---|---|---|---|---|---|---|
| 215 | `Download schedules` as a **header** button (`SimpleExportMenu`) | `simple/SimpleBeneficiaryControls.tsx:60-68` | n/a | Would open the print dialog. | Read-only | `timetable-c05-beneficiary-export` / `timetable-c05r1-presentation-settings` / `timetable-term-export-c03r3` all `renderToStaticMarkup` this component (`test:client-suite`) — **no production file imports `SimpleExportMenu`** (verified by search across `atlas-client/src`: the only references are the component and the three tests). The live entry is the More-menu item at row 26. | `DEAD` |
| 216 | `Retry` / `Dismiss` on the beneficiary-download error banner (`SimpleExportErrorBanner`) | `simple/SimpleBeneficiaryControls.tsx:81-111` | n/a | Would re-dispatch a failed export. | Read-only | `timetable-term-export-c03r3` renders it (`test:client-suite`); no production file imports it. | `DEAD` |
| 217 | `SchedulerExportCenterDialog` (the whole Office export center) | `simple/SchedulerExportCenterDialog.tsx:34-128` | n/a | n/a | Read-only | `timetable-c05-beneficiary-export.test.ts:107,118,127` **asserts its absence** from both the header and the page (`test:client-suite`) — the retirement is deliberate and covered, so the component is dead code left in the tree, not a broken control. | `DEAD` |
| 218 | The shared schedule-lifecycle model | `atlas-client/src/lib/schedule-lifecycle.ts:36-215` | n/a | Would state draft-vs-published and Live-ness on a surface. | Read-only | `schedule-lifecycle-c01.test.ts` · `test:schedule-lifecycle-c01`, `test:client-suite` | `DEAD` |
| 219 | `TimetableUndoRedoControl` in the **Simple** layout | mounted only at `ScheduleReviewWorkspace.tsx:597`, inside the `layoutMode === 'advanced'` branch | The `else` arm at `:580-610` is Advanced-only. In Simple the only undo is the transient post-placement strip (row 85) and the only redo is the strip inside the session dialog (row 86). | n/a | **Mutating** when reachable | `timetable-dynamic-workspace-undo-redo` (`test:client-suite`) asserts the mount **inside the advanced guard** in source text only. | `DEAD` |
| 220 | The `title="The schedule changed; refresh and re-preview before redoing."` attribute on `Version-stale` | `TimetableUndoRedoControl.tsx:65` | n/a | n/a | Read-only | `UNTESTED` | `MISLABELLED` |

**Row 218 in full, because it is the finding the operator named.** `ea5e12b0` ("feat(timetable): add the one shared schedule lifecycle model, tested, not yet wired") added `atlas-client/src/lib/schedule-lifecycle.ts`, exporting `ScheduleLifecycleKind` (`:36`), `PublicationFacts` (`:43`), `DraftFacts` (`:56`), `ScheduleLifecycle` (`:64`), `LifecycleInput` (`:71`), `deriveScheduleLifecycle` (`:101`), `hasPublication` (`:132`), `isLive` (`:137`), `describePublication` (`:152`), `describeNewerDraft` (`:164`), `describeLifecycle` (`:176`), `LifecycleAudience` (`:202`) and `describeForAudience` (`:204`). The four surfaces it was written for — the dashboard, `/timetable`, the teacher portal and the public schedule page — **contain no import of it**: verified by searching `atlas-client/src` for `schedule-lifecycle`; the only references are the module itself and `src/lib/__tests__/schedule-lifecycle-c01.test.ts`. Its own commit message says so: "Deliberately NOT wired yet." This is the mechanism that would have answered system-walk findings 4 and 5 (no draft-vs-published statement) on `/timetable`.

---

## §15 Controls searched for and NOT FOUND

Recorded, not omitted. Each is a live question in §16.

| # | Not found | How it was searched | Consequence |
|---|---|---|---|
| 221 | Any control or sentence on `/timetable` stating whether the grid is the draft or what teachers see. | `TimetableSimpleHeader.tsx:620-676` (whole status region); `simple/SimpleHeaderActions.tsx:114-148`; `simple/SimpleHeaderHelpers.tsx:196-221` (`readinessLabel`); `TimetableSubNav.tsx:22-30`. The published chip (row 11) renders **only** when published, so the unpublished case prints nothing. `simple-timetable-state.ts` is not wired either. | Confirms the operator's QA finding 5 (`findings.md:28`, `:81`) and system-walk finding 4 (`03-timetable-rest.md:32`) on `main`, not only on the live build. |
| 222 | Any always-visible Undo/Redo pair in the **Simple** layout. | `ScheduleReviewWorkspace.tsx:557-610` (the layout branch), `:428-467` (transient undo), `:725-764` (dialog-only redo); `TimetableSimpleHeader.tsx:609-918` (the whole header). | Confirms QA finding 6 (`findings.md:29`, `:82`) on `main`. |
| 223 | Any control that explains the room's `buildingShortCode` (`G1AW`) anywhere in the timetable subtree. | `timetable-reference-labels.ts:88-97` (composition), `TimetableGrid.tsx:559-571` (the tooltip, which in room view shows `<section> · <teacher>` at `:552` and no room at all), `TimetableStatusLegend.tsx`, `simple/SimpleMoreMenuContent.tsx:188-203` (the status key), `SimpleDayOptions.tsx`. | Confirms QA finding 7's first half on `main`. |
| 224 | Any empty-state or utilisation affordance for a sparsely used room. | `ScheduleTimetableGrid.tsx:122-134` (unoccupied cell → empty `<td>`); `RoomSchedules.tsx:662-687` (the utilisation summary, which only appears once a room is selected). | Confirms QA finding 7's second half. |
| 225 | The control list **inside** `ManualEditPanel` (`atlas-client/src/components/ManualEditPanel.tsx`), **inside** `BuildingView`'s own toolbar (`atlas-client/src/components/BuildingView.tsx`), **inside** `TacticalSandboxDock.tsx`/`.parts.tsx` field-level modules, and the **per-rule policy field set** in `SchedulingPolicyPane.tsx:251-400`. | Not read in this pass. | These surfaces are entered but not enumerated. The operator's QA lane must treat them as an open leg of this inventory, not as cleared. |
| 226 | A control that opens `/timetable/exports`. | `App.tsx:232` (route, `element: null`), `TimetableRouteViewSync.tsx:48-53` (legacy redirect into `?print=1`), `SimpleMoreMenuContent.tsx` (no item). | Not a defect: it is a legacy alias, and the live entry is row 26. Recorded so its absence is not later read as a gap. |

---

## §16 Lane C live verification packet

**Origin:** `https://njgrm.buru-degree.ts.net` (assert `window.location.origin` before recording anything; localhost page evidence is invalid for this packet).
**Live build is `0da104f9`, which is behind `main` at `bdf5c469`.** Every row below must report what the live page does, and whether the difference from this document is explained by the release lag or is a live-only defect.

### 16a One question per non-`OK` row

| Row | Question to ask on the live page | What would falsify the row |
|---|---|---|
| 7 | With a run present and nothing to review, is the merged warnings chip clickable, and is any reason for it being inert visible on screen? | The chip opens the readiness sheet, or prints a visible reason. |
| 5 | With no generated run, is `Schedule for` disabled, and does it show "No schedule options are available yet…"? | The control is enabled, or the reason text is absent. |
| 13 | On a failed run, does the status region print "The last schedule build did not finish…"? | The line is absent. |
| 14 | With non-blocking HARD violations, does the amber "did not stop publishing" notice appear? | The line is absent. |
| 15 / 221 | On `/timetable` with a generated, **unpublished** run: read the whole status region. Does anything state that this is the draft? | Any sentence naming draft vs published appears. |
| 22 | Open More on a run that needs a step, and read the `Next step:` row. If it is greyed, is a reason shown? | A reason is shown, or the row is enabled. |
| 24 | With a generatable year and no run, is `Preview demand` present and enabled? | The item is absent. |
| 29, 30, 31 | Open More ▸ Daily tasks with **no** generated run: are the three items greyed, and is the reason visible on screen (not only to a screen reader)? | A visible reason appears. |
| 32 | With pending room requests, does `Review room requests (n)` appear in Daily tasks? | The item is absent. |
| 34 | With zero edits, does `Schedule history` show its reason line? | The reason line is absent. |
| 35 | Does `Advanced rules` land on `/timetable/policies` **and** switch to the Advanced layout? | The URL and the layout disagree. |
| 36 | Does `Expert view` switch the layout? | The layout does not change. |
| 37 | Does `Tutorial` open a dialog whose every step's "Show me" finds a real control? | A step reports its target is unavailable. |
| 38 | With hidden early rows, do the hidden-row chip and `Show full day` appear inside More ▸ Help & display? | The block is absent, or a `Day options` popover trigger appears inside the dropdown. |
| 39 | Does the `Status key` inside More list the same entries as the Advanced legend? | The two lists differ. |
| 40 | Does `Teacher concerns` open `/faculty/concerns`? | The route is not mounted or 404s. |
| 41, 42, 43 | Do `Campus map`, `Manual edit` and `Building view` each open a mounted view? Note what `Manual edit` and `Building view` show with nothing selected. | Either lands on a blank centre, or 404s. |
| 44 | Open More ▸ Schedule data: is the run select disabled, and does it print why? | A reason is printed. |
| 45, 46 | Do `Refresh timetable` and `Refresh school names` act? | Either does nothing. |
| 48 | While a move is armed, focus a blocked-slot cell and press Enter: does the toast appear? | No toast. |
| 53, 54 | Hover a hard-conflict badge on a live drag: read the tooltip heading and each severity prefix literally. | Either reads a value derived from the shared word rather than a raw literal. |
| 56, 57 | Read one entry's accessible name (screen reader or DOM inspector) beside its visible severity text. Does the name say "Schedule note" where the surface says "warning", and is the count pluralised correctly? | The accessible name matches the visible wording. |
| 59 | Does a COHORT entry show its cohort badge? | Absent on a cohort entry. |
| 62 | Switch `Show` to **Room**, read the entity picker's first room, and read its cell tooltip. Does anything define the trailing `G1AW`? | A legend, tooltip or help string defines it. |
| 65–74 | Select a class. Do the strip and the dialog offer the same action under two names on the same screen (row 68 vs 66)? | Only one of them is present. |
| 75 | Arm a swap, read the banner, press `Cancel`. | The banner does not clear. |
| 78 | Open the session dialog on a class with a HARD warning and read the prefix literally. | It is not the raw word. |
| 79–83 | Do all five session-dialog actions fire? | Any action does nothing. |
| 86, 87 | After a revert, open the session dialog: is the `Redo` strip reachable, and does `Version-stale` appear when the CAS fails? | The strip never appears, or the stale case is silent. |
| 96 | In Publish Readiness, does a group with more than three items show `Show N more`? | The list is truncated with no expander. |
| 99, 100 | Do `Download CSV` and `Close` work in the readiness sheet? | Either does nothing. |
| 105–110 | On `/timetable/setup` with a stale run: are `Review changes`, `Fix <domain>`, `Repair setup`, `Open Year Setup` and the setup `Preview impact` all present, and does each navigate? | Any is missing or inert. |
| 107, 111 | Is the reason for a disabled `Repair setup` / `Regenerate to apply` visible on screen, or only in the accessible name? | A visible reason appears. |
| 112 | In the regenerate dialog, is a disabled confirm explained? | A visible reason appears. |
| 113 | Does `/timetable/setup` show the rollover guidance card? | Absent. |
| 117–121 | Open More ▸ Unassigned sessions: do search, clear, status filters, grade/reason filters, the result count and the diagnostics block all respond? | Any does nothing. |
| 132 | Open the download dialog **with no generated run** (reach it by URL with `?print=1`). Is `Header and signatories` present, and does it open anything? | The button is absent, **or** its dialog opens. |
| 136–138 | Reach `Manual edit` from More with no class selected, then with one. Does the empty state name the three real ways in? | A blank centre, or an empty state that names no action. |
| 140, 141 | Switch to Expert view with at least one edit in history. Count the visible Undo controls and read each accessible name. | Exactly one Undo is visible. |
| 142, 143 | In Expert view, are `Redo` and `History` reachable, and does `History` open the same list as More ▸ `Schedule history`? | Either is unreachable, or they open different lists. |
| 144 | Force a version-stale redo; does the Advanced `Version-stale` notice and `Dismiss` appear? | Absent. |
| 147, 153 | On Expert view with a failed newer run, and with an active task: do both notices appear? | Either absent. |
| 155 | In Expert view, does the entity picker behave like the Simple one (does it ever disable with a reason)? | It disables with no reason where Simple prints one. |
| 159 | Do `Schedule review` and `Grid view` both switch the centre? | Either does nothing. |
| 163–168 | Walk `/timetable/map` → a building → a room. Does each `Back` control return, does the floor list label `Empty` correctly, and does a room button pivot the grid? | Any does nothing, or an empty floor is silent. |
| 172, 173 | On `/room-schedules`: does the help open, and does an invalid Run ID print its reason? | Either is silent. |
| 178, 179, 180, 182, 183, 184 | Do `Occupancy`/`Schedule`, `Refresh`, `Export CSV`, `11x6`/`13x6` and the conflict badge each act; is a disabled `Export CSV` explained? | Any does nothing, or a disabled control is unexplained. |
| 185 | Read the `Run #<id> · <status>` line literally. | It reads a plain sentence instead of a raw enum. |
| 186 / 224 | Select a room used twice in a week. Does anything say the room is mostly free? | An empty-state or utilisation affordance appears. |
| 190 | Arm a draft placement and press `Cancel`. | The pending placement survives. |
| 201–203, 208 | On `/timetable/policies`: does the pane load, do `Policy` / `Shift Settings` switch, does `Edit advanced rules` reveal the fields, and does each field save? | Any is inert. Note: the live walk reported this pane taking over 25 s — that is a load-timing question, not a control defect, and this row does not claim it. |
| 204, 205, 206, 207 | Read these four strings literally: the `Save Policy` busy label, the pane's loading sentence, the two lunch-window help strings and the flexible-assignment warning label. | Any reads as intended English. |
| 215, 216, 217 | Not live-checkable (no entry point). Confirm by observation only that no surface offers a header `Download schedules` button, no export-error banner, and no "Export Center". | Any of the three appears anywhere. |
| 219 | On `/timetable` in Simple, after moving a class: is there any **persistent** Undo/Redo, or only the transient strip? | A persistent Undo/Redo pair appears. |
| 220 | Focus the Advanced `Version-stale` notice: is the explanation in the accessible description, or only in a hover title? | The explanation is in the accessible name/description. |
| 225 | Enter `Manual edit`, `Building view`'s own toolbar, the Tactical Sandbox modules, and the per-rule policy fields; enumerate the controls there and report them against the gaps named in §15. | — this is the open leg, not a yes/no. |

### 16b Standing requests

1. **The public schedule's default term.** With **no query string**, read `source.termIndex` from the public API response and report it **literally**. The suspect is `atlas-server/src/services/published-schedule.service.ts:758-773`: for a frozen run, `active` is resolved through `resolveRequestedTermIndexFromContract(frozenContract, …)` from the **publication-time** `activeTermOrder` (`:762-771`), `activeTermVerified` is set true whenever the request was `active` (`:772`), and the failure path is a 409 `TERM_SELECTION_REQUIRED` only when `activeTermOrder == null` (`:763-765`). Do not infer the value from a rendered label; read the API.
2. **Browser acceptance still owed for the live `0da104f9` release:** the retired `/my` tombstone; the public-schedule term switch retaining a valid section; a positive login confirmation; the 390 px drift-banner leg (row 114); and the Runs-pane settled states (rows 209–212).
3. **After every integration and every release from this lane**, re-run §16a against the new build and record, per row, `matches this document` / `differs — explained by release lag` / `differs — live defect`. Rows marked **[live re-check]** are the ones expected to differ on the first pass.

Nothing in this section is asserted beyond what §1–§15 establish. Each item above is either a row with a status other than `OK`, a not-found record from §15, or one of the three standing requests.

---

## Appendix — verification method for this document

- Revision: `bdf5c469885280a509d987391cb73ef31cf0b8d2`; worktree `E:/ATLAS-worktrees/lane-a2-timetable-custody`, branch `work/a2-timetable-custody`, clean, equal to `origin/main` at authoring.
- Every `file:line` was read in that tree. No file outside it was modified; this document is the only file created.
- Test-coverage claims were established by locating each cited `data-testid` across all `*.test.ts(x)` under `atlas-client/src` and then classifying the citing assertion as rendered (JSDOM / `renderToStaticMarkup` / harness) or source-text (`readFileSync` + regex). Source-text-only citations are reported `UNTESTED`, never as coverage.
- Script names were taken from `atlas-client/package.json` `scripts`; every cited test file appears in at least one committed script, and `test:client-suite` is listed where a file is only unioned there.
- The encoding claim in rows 204–207 was produced by reading every `.ts`/`.tsx` under `atlas-client/src` as UTF-8 and counting `U+FFFD` and the `G`+`U+01EA` sequence per file; one file matched.
