# A2 c13 — "Class Schedule" calm surfaces: loading, one name, one plainly-unavailable Generate

**Base:** `341bdb9d` (`origin/main`). **Worktree:** `E:\ATLAS-worktrees\lane-a2-c13` (branch `work/a2-c13-timetable-load`).
**Owner:** A2 (executor writes only in that worktree). **Tier:** MEDIUM, user-facing, VISUAL-plus-behaviour.
**Planner:** Lane A2 primary planner. **Deployer:** A4 only. Do not deploy, do not touch ports 5001/5174, do not
sign in, do not generate, do not publish, do not migrate, do not write in `D:\ATLAS`.

**Source of the request:** Lane C's Codex staging walk on train 6, `docs/reviews/codex-staging-train6-24e268fb/`
(`run1-report.md`, `run2-report.md`), routed at `docs/handoffs/lane-c-to-a2.md` 2026-09-29 06:58, A2 bullet:
loading copy + "Class Schedule" naming. Item 3 is A2's own open item (the disabled Generate as a pale-green
near-miss), raised by the operator.

---

## 0. The user, and what should feel different

An older, mouse-first school scheduler. They are not waiting for data; they are trying to read today's class
schedule. Right now the screen tells them the software is busy in engineering words and gives them nothing to do.
After this cycle the page should feel like **one named place that says what is happening and offers one way out.**

Three fixes, one idea: **say what is happening, name the place once, and never show a control that looks
available when it is not.**

---

## 1. Loading copy + a time limit (Lane C item 1)

### 1a. The sentence — SUBTRACT, do not reword

`atlas-client/src/components/timetable/TimetableSkeleton.tsx:31` currently reads:

> `Loading timetable:` navigation is ready now; the grid fills as soon as the latest run resolves.

Codex graded this MAJOR: *"'latest run resolves' is technical and passive; say 'Your schedule is still loading.'"*

**Delete the whole sentence and print exactly:**

> `Your schedule is still loading.`

Not a prefix in bold, not a trailing clause, not a second sentence. "Navigation is ready now" and "the grid fills as
soon as the latest run resolves" are **removed, not reworded** — they name the mechanism, which is the
operator's exact complaint ("A copy change that alters what a number or status *claims*" is MEDIUM; this changes
nothing factual, so it stays VISUAL, but the removal is the fix).

### 1b. After a time limit, offer a way out

One exported constant, e.g. `LOADING_RETRY_AFTER_MS = 8000`, in the skeleton module (or a small sibling) so a test
can assert the value and advance to it. "About 8 s" per the operator.

After the limit elapses **while the skeleton is still showing**, render on the same band as the sentence:

- **ONE `Retry`** — the primary action. It re-runs the real data load (the workspace's existing reload/refetch
  path), and it **resets the timer** so a second failed retry offers itself again after another 8 s.
  A browser location reload is acceptable ONLY if the workspace offers no refetch; say which you used and why.
- **`Show the last published schedule`** — a secondary action, rendered **if and only if** a published run is
  already derivable from data the app holds (the workspace context's `runs` / `activeGeneratedRunId` and the
  existing `isRunPublishedStrict` helper). It links to **`/public/schedules`**, which already exists
  (`atlas-client/src/App.tsx:211`).
  - **No published run → the control does not render at all.** Not rendered-and-disabled; a disabled control with
    no action is the exact class of defect item 3 is fixing.
  - **No new fetch** to decide this. Derive it from state already on screen. A skeleton that fires a request to
    learn whether it may offer a link is a new stall.
- Before the limit, the band shows the sentence and **no controls**. The skeleton keeps its current progressive
  first paint (the shell, `TimetableSubNav`, the header skeletons) — do not delay the paint.
- The per-route loading states in `TimetableRouteLoadingState.tsx` / `timetable-route-loading-intent.ts` keep
  their own per-route copy and the `ScheduleReviewWorkspace` early return that selects them is untouched.

### 1c. THE #310 TRAP — read this before you add the timer

`ScheduleReviewWorkspace.tsx:229-230, 335-341` records the c12 defect: `moveTargetSlotKeys` sat **below** the
`if (state.loading && !state.draft)` early return, so the loading render called one fewer hook than the resolved
render and React threw **#310**. `e910811b` hoisted it above every early return.

**Any `useState` / `useEffect` / `useRef` you add for the 8-second timer must be hoisted above EVERY early
return in its component**, exactly as that comment requires. `a2-c12-s2-310fix.test.tsx` is the guard; it must
still pass, and you must re-run it. If the cleanest placement is inside `TimetableSkeleton` (which has no early
returns), that is a legitimate answer — say which you chose.

---

## 2. One name for the place (Lane C item 2)

### The ruling — "Class Schedule" wins. Do not rename the nav to "Timetable".

Lane C: *"The nav says 'Class Schedule' but the page is 'Timetable'. Pick one familiar name."*

I have enumerated the surface. **"Class Schedule" is already the product's own name for the place**, in the places
a scheduler reads it:

| Already "Class Schedule" | Where |
|---|---|
| the nav item | `app-shell/navigation.ts:62` |
| the group divider | `AppSidebar.tsx:213` |
| the breadcrumb group | `navigation.ts:84` |
| **the page `<h1>`** | derived from the same nav item via `resolveRouteChrome` → `TimetableSubNav.tsx:67-72` |
| the product's own cross-page links | `teacher-concern-helpers.ts:129` "Open Class Schedule", `RunAvailabilityDriftCard.tsx:76` |

"Timetable" is the **internal** name leaking into user-visible text. So the fix is to close the leak, not to
rename five committed surfaces. Renaming to "Timetable" would touch the nav, the divider, the breadcrumbs, the
`<h1>`, and three cross-page links, break ~10 committed test contracts, and swap a familiar everyday word for a
less familiar one. **"Class Schedule" is the familiar name; it also wins the inventory.**

### 2a. What to change — place names and standalone control labels only

Export **one** constant, `CLASS_SCHEDULE_LABEL = 'Class Schedule'`, and route every place-name through it, so a
future rename cannot leave a surface behind (the lesson already recorded at
`SimpleHeaderHelpers.tsx:453-465` for `PUBLISHED_GENERATE_LABEL`).

Change these user-visible place-name surfaces (verify each against source; some may have moved):

- `TimetableRouteLoadingState.tsx:13` — eyebrow `Timetable workspace` → `Class Schedule`
- `TimetableSubNav.tsx:74` — `aria-label="Timetable sections"` → `Class Schedule sections`
- `ScheduleReviewWorkspaceHeader.tsx:714` — tooltip "…queue inside **Timetable**" → "…inside **Class Schedule**"
- `ScheduleReviewWorkspaceHeader.tsx:232` — toast "**Timetable** setup already matches…" → "Class Schedule setup…"
- `ScheduleReviewWorkspaceHeader.tsx:56` — `<DialogTitle>Sync Timetable with Setup</DialogTitle>`
- `ScheduleReviewWorkspaceDialogs.tsx:56` — the same dialog title if it is a second definition
- `ScheduleReviewWorkspace.tsx:804` — `aria-label="Switch to simple timetable view"`
- `TimetableGrid.tsx:808` and `ClassProgramMatrixView.tsx:159` — `aria-label="Timetable"` (the table) → the place name
- `SimpleTutorial.tsx:256,266` — "Open timetable tutorial" / "Simple timetable tutorial"
- `SimpleHeaderStatusStrip.tsx:91`, `SimpleMoreMenuContent.tsx:387`, `TimetableStatusLegend.tsx:33,50` — the
  `aria-label`s that name the timetable place/status region
- `SimpleFilterControls.tsx:87,194` — "Active timetable filters"
- `TimetableUndoRedoControl.tsx:146,153` — "manual timetable change"
- `ManualEditPanel.tsx:302` — "Back to timetable (Esc)"
- `SchedulingPolicyPane.tsx:500` — "Return to the timetable grid view"
- `PublishedRevisionDialog.tsx:150` — badge "Timetable revision"
- `TimetableFacultyIssuePivotDialog.tsx:23,30` — "…'s timetable?" / "Open teacher timetable" → **these name the
  teacher's own weekly schedule, not the workspace. Use `schedule`, not `Class Schedule`** — do not send a user to
  a place called "Class Schedule" when they mean their own timetable. Same for `SimpleTaskDrawerHelpers.tsx:293-294`
  and `SimplePublishReadinessSheet.tsx:238-239` if you touch them: **"schedule"**, not the place name.
- `SimpleGenerationBlockerSheet.tsx:149` — "What is stopping a timetable" → "What is stopping a schedule"

### 2b. What NOT to change — a dated boundary, not an oversight

Do **not** rewrite prose that uses "timetable" as the ordinary English noun: "Generate a timetable before
reviewing publish readiness", "cannot generate the timetable", "Refresh the timetable, or open Subjects…",
`PublicPublishedSchedule.tsx`, `Dashboard.tsx`, `notification-presentation.ts`, `RolloverResetPanel.tsx`,
`SectionHomeRoomModals.tsx`, `UnassignedInsertionWorkflow.tsx`, `FacultyProfileSheet.tsx`, `TacticalSandboxDock*`.
That is a separate, larger copy sweep and rewording it here would be the "too literal, no thought" change the
design judgement gate exists to catch. **List the strings you deliberately left in your handoff.**

### 2c. Routes are unchanged — hard constraint

`/timetable` and every `/timetable/*` path, every `to=`, every redirect, every breadcrumb resolution and the
`routeChromeOverrides` **keys** stay byte-identical. Only the display `label`/`title`/`aria-label`/`aria-labelledby`
strings change. A test must prove it: the route table at `navigation.ts:112-140` and the resolved
`{to, label}` pairs are asserted unchanged apart from the label text.

---

## 3. A disabled Generate must read as plainly unavailable (A2's own item)

### The defect, precisely

`SimpleGenerateAction` (`simple/SimpleHeaderHelpers.tsx:469-511`) renders `variant="default"` — a solid
`bg-primary` — with `disabled`. The shared base adds `disabled:opacity-50`. **A solid green button at 50% opacity
is a pale-green button**: it still reads as a primary that is "almost ready". The operator's words: *"the disabled
Generate reads as a pale-green near-miss."* For a scheduler the worst possible reading is a control that looks
like the next step and is not.

### 3a. One new variant, in `@/ui`, so every page gets it (§8 "One look per control")

Add **one** variant to `atlas-client/src/ui/button-variants.ts`. It must be **plainly unavailable**: no
`bg-primary`, no green, no `shadow-sm`, a plain `border-border` / `bg-muted` / `text-muted-foreground` treatment.

**Do not fight `disabled:opacity-50` in the base string.** Two same-property Tailwind utilities
(`disabled:opacity-50` vs `disabled:opacity-100`) are resolved by stylesheet order, not class order, so that
"fix" is a coin flip. Leave the base alone; a pale **grey** control already reads as unavailable. The defect is
specifically the **pale green**, i.e. the retained `bg-primary`.

### 3b. Use it, and do not remove the control

`SimpleGenerateAction`: when `disabled`, use the new variant; when enabled, `primary ? 'default' : 'outline'`
exactly as today.

**Also apply it to `SimplePublishAction`** (`SimpleHeaderHelpers.tsx:522-572`). It sits in the same header row and
takes the same `default` variant when disabled. Leaving it pale-green would put **two different "unavailable"
looks in one row**, which fails §8 "One look per control" harder than the original defect. This is in scope
because the row must look consistent; it is not scope creep.

### 3c. The reason in words, BESIDE the control

§8's "Header budget" rule (2026-09-29) put the reason in a `Tooltip` only. **The operator has now overridden that
for this control**: *"put the reason in words beside it."* The reason must be **visible on screen beside the
disabled button**, not hover-only. §12/§8 "never hover-only" is not violated — the `aria-label` still carries it.

- Render it on the **same row**, immediately beside the control, `text-xs`, `text-muted-foreground`.
- It must be a **short form** — **≤ 6 words** — derived from the existing reason, never a second independent copy
  of the reason text. `resolveSimpleGenerateActionState` (`SimpleHeaderHelpers.tsx:849-859`) already produces the
  full sentence; derive a short form from the same source, or add a short-form field to the resolver so the two
  cannot drift.
- **No `truncate` / no ellipsis** (§8). If the short form cannot fit, shorten the words, do not cut them.
- **No new header band and no new row.** The visible sentence must fit inside the row the control already
  occupies. If it cannot at 1366×768, that is a finding to report, not a reason to add a row.
- **The Tooltip and the `aria-label` stay.** Additive, per §16.

### 3d. Additive note you must write in place

`SimplePublishAction`'s existing comment block (`:538-555`) records that A2 HEADER-BUDGET **SUPERSEDED** the
visible `timetable-publish-blocked-reason` sentence. Your change re-introduces a visible reason. **Do not delete
that note** — mark it superseded again with today's date and the operator instruction, and keep the original text.
Same for the old skeleton copy assertion (§16: never delete a control, assertion or evidence row to close a
finding).

---

## 4. Failing-first proof (mandatory, and it must be at the BASE)

Write the new assertions, run them against **base `341bdb9d`'s files** (stash or `git worktree`-free checkout of
the base blobs — do not rewrite history), and record the literal failing output. An assertion that has never been
seen failing is not evidence.

| # | Assertion | Must fail at base |
|---|---|---|
| L1 | rendered: the loading band reads exactly `Your schedule is still loading.`, and contains **no** `latest run resolves` / `navigation is ready now` | yes |
| L2 | rendered + fake timers: before 8 s no `Retry`; at 8 s exactly **one** `Retry`; clicking it resets the timer | yes |
| L3 | rendered + fake timers: with a published run present, exactly one `Show the last published schedule` linking to `/public/schedules`; with **no** published run, **zero** such controls | yes |
| L4 | rendered: a disabled Generate carries **no** `bg-primary` / `text-primary-foreground`, carries the new unavailable variant's classes, and a visible reason sentence sits beside it (not tooltip-only) | yes |
| L5 | rendered: a disabled Publish in the same row uses the **same** unavailable classes as the disabled Generate | yes |
| L6 | source/table: the place-name constant is used by the nav item, the `<h1>` and the loading surfaces, and every `to` / route path in `navigation.ts` is byte-identical to base | yes (constant absent at base) |
| N1 | **negative control**: revert item 3a's variant to the old `variant={primary ? 'default' : 'outline'}` and show L4 and L5 FAIL; restore byte-exact. Do the same for L1/L2's copy. | — |
| N2 | re-run `test:ux-a2-c12-310fix` (`a2-c12-s2-310fix.test.tsx`) — the #310 guard must still pass with your timer hooks in place | — |

### Gate entry (§11)
Every new test file must be reachable from a committed `package.json` script **in the same commit** — add e.g.
`"test:ux-a2-c13-calm-loading": "…"` and list the new files. A test no gate runs is not evidence.

### Re-pointed existing rows
`timetable-relaxed-main-b02.test.tsx:443` asserts the old copy (`/the grid fills as soon as the latest run
resolves/`). Mark that row **SUPERSEDED in place** with the reason; do not delete it. Then find every other
committed row that pins a string this candidate changes and do the same. Report the full list.

### Gates to run, on the merged candidate tree
- `npx tsc --noEmit` in `atlas-client` — report the **count**, and show any error is byte-identical at base
  (5 pre-existing errors, 3 of them `playwright` not installed).
- `npm run test:client-suite` at **base** and at **candidate**: report both tallies and show the
  failing-identifier **difference set is empty in both directions**. (Pre-existing at HEAD: 12 failures,
  2 of them `playwright` not installed.) **Do not carry that number forward — re-measure.**
- `npm run test:ux-a2-c12-310fix`, `test:ux-a2-c11-s2-header`, `test:ux-a2-header-budget`,
  `test:timetable-relaxed-main`, `test:ux-guardrails`, `test:a3-page-title-c1`, `test:timetable-route-keys`,
  `test:ux-r01-shared-chrome`, `test:ux-a2-c12-past-year`, `test:draft-ux-c01`, `test:a2-ux-menu2-c2`.
- `git diff --check` clean.

### §8 file cap — extract before you add
`TimetableSimpleHeader.tsx` is **999 / 1000** lines and `ScheduleReviewWorkspaceHeader.tsx` is **987 / 1000**. The
next edit to either has no headroom. Extract the smallest coherent sub-component out of whichever you touch, and
keep every file under 1000 physical lines.

---

## 5. Rendered evidence (VISUAL work is done when it is SEEN, §11)

A source-text assertion is **not** acceptance evidence for a user-facing change. Before handing back:

1. Build the client.
2. Start the preview **only** with
   `scripts/dev/start-preview.ps1 -ClientDir <clientDir> -Port <p>` and label it `ISOLATED`/`isolated`.
   **Never** `vite preview`, `npm run dev` or a bare `&`/`Start-Process`; a tool call that waits on a server never
   returns. **Do not ask the operator to sign in on a loopback port** (2026-09-29 02:10: sign-in is origin-bound).
3. Use the Playwright MCP for every capture. At **1366×768** capture, on the built client with `/api/v1` mocked:
   - the loading band **before** the 8 s limit, and **after** it, in both the published-run and no-published-run cases;
   - the header with a **disabled** Generate and a **disabled** Publish, side by side, so the two unavailable looks
     can be compared;
   - the `<h1>` and the nav, proving one name.
4. **Score your own captures against `ux-communication-rubric`** and report the score, but know that a **fresh
   reviewer who did not build it** re-scores before/after and can return `REJECT_UX` on a miss — every test passing
   does not protect you from it.

---

## 6. Handoff format (one page, §10)

Base `341bdb9d` · candidate `<sha>` · exact changed paths · what changed and why, per item ·
the decisive commands actually run with their real output (not a summary) · the failing-first output at base ·
the strings you deliberately left in §2b · known risks marked `BLOCKING` / `NON_BLOCKING` · verdict.
Rendered captures under `docs/reviews/a2-c13-*/`. **Post `A2 ready for release at <sha>` — A4 deploys, you do not.**

**Not claimed unless you did it:** 0 fixes rendered on the live Tailnet. Nothing is deployed by this candidate.
