# A5 — Unassigned sessions panel on Class Schedule (2026-09-30)

**Operator is at the demo site. This is the one fix for this cycle.**

- **Base SHA:** `3b29bb44` (`origin/main`, verified at packet authoring)
- **Branch:** `work/a5-unassigned-panel`
- **Worktree:** `E:/ATLAS-worktrees/lane-a5-unassigned-panel` (clean at base)
- **Risk tier:** MEDIUM (production wiring, cross-layer shape) + HIGH interaction guardrails (the placement commit path)
- **Worktree disposition:** `RETIRE_AFTER_INTEGRATION`
- **Boundaries:** no live write, no deploy, no generation, no publication, no migration, no sign-in to live, no companion edit. `D:/ATLAS` is never written.

## The operator's words (verbatim — this is the acceptance)

> the Unassigned sessions panel on Class Schedule is unusable … Target: the panel title says **N classes need a time slot**; ONE list grouped by section, each row one line: **subject, section, teacher, why it could not be placed in plain words**, and **one button Place** that opens the free slots for that class highlighted in the grid (**one click on a slot places it, with a receipt and Undo**); **no raw codes, no counts that disagree with the header, no nested scroll traps**; it **closes with Esc**.

Governing operator decisions: `docs/plans/operator-decisions.md` rows **8** (label is exactly `N classes need a time slot`), **11** (applying saves at once with a plain receipt and Undo), **12** (QA stays; land on main; no staging deploy). AGENTS.md §8 (no-scroll architecture, no clipped text, one look per control, less is more) and the design-judgement gate (subtract first; judged, not just seen).

## Where the panel is (verified)

- Live component: `atlas-client/src/components/timetable/GeneratedUnassignedPanel.tsx`
  - `GeneratedUnassignedPanel` (the body) and `SimpleUnassignedSessionsPanel` (the Simple wrapper).
- Rendered in two places, both from that one component:
  - `TimetableTaskDrawer.tsx` task `unassigned-sessions` (the Simple drawer opened from the More menu item `timetable-more-unassigned-sessions`).
  - `LeftRailContent.tsx` when `leftTab === 'unassigned' && !isPreGenerationWorkspace`.
- `GeneratedRunRailPanels.tsx` carries a **dead duplicate** `GeneratedUnassignedPanel` (no importer). Do **not** edit it; leave it byte-identical (a source test reads it).
- The More-menu item already reads `N classes need a time slot` (`simple/SimpleHeaderActions.tsx` `SimpleUnassignedSessionsItem`). The panel must use the **same count** as that item.

## What is wrong today (the "unusable" list — confirm each by rendering)

1. The panel header shows three badges (`N unresolved`, `X/Y placed`, `% home-room`) plus a search box, two rows of filter chips (status + grade + reason), a `Showing X of Y` line, a `Show diagnostics` toggle and a `Clear` button — before any class is visible.
2. Each class is a tall card (156 px) with a status pill, a program badge, a reason badge, and **three** buttons (`Place session` / `Fix teaching load` / `Review room source`, `Details`, `Flag`).
3. The row does **not** name the teacher.
4. The reason is a badge label, not a plain sentence, and the status pill (`Needs owner` / `Needs room` / `Still blocked`) is a second, competing vocabulary.
5. Counts disagree: the header badge says `N unresolved`, the More menu says `N classes need a time slot`, the panel says `Showing X of Y`.
6. The list is a `VirtualizedRailList` with its own `overflow-auto` inside the drawer — a nested scroll region.
7. There is no Esc-to-close on the drawer.

## The target (build exactly this)

### Panel body (`GeneratedUnassignedPanel.tsx`)

- **Title:** `N classes need a time slot` (singular `1 class needs a time slot`), where `N` is the **same count the More-menu item uses** (the selected term's unplaced count). Prove the two read one source; a second count is a defect.
- **ONE list, grouped by section.** Group `filteredUnassignedItems` by `sectionId`; render one group heading per section (`sectionLabel(sectionId)`), groups ordered by section label, rows ordered by subject label then session.
- **Each row is one line** (no card, no multi-row stack): **subject · section · teacher · plain reason · one `Place` button**. Wrapping is allowed; **no ellipsis, no clipping** (`truncate`/`line-clamp`/`text-ellipsis` are forbidden on these strings).
  - subject: `subjectLabel(item.subjectId)`
  - section: `sectionLabel(item.sectionId)`
  - teacher: the teacher's **name**. Thread the workspace's existing `facultyLabel(id)` into `LeftRailContentContext` (it exists in `useScheduleReviewWorkspaceState`; the left-rail context currently carries only `formatFacultyInitials`). When `item.facultyId` is null render `No teacher yet`.
  - reason: the shared `UNASSIGNED_REASON_LABELS` label (already plain, never a code). If the label is absent, fall back to the plain sentence from `getDefaultUnassignedReasonDetail` (`lib/schedule-review-helpers.ts`). **Never render `item.reason` raw.**
  - **one button `Place`** — the only control on the row. Remove the `Details` and `Flag` buttons, the status pill, the program badge, the reason badge, the drag pin, and the `Load fix suggestions` flow from this panel.
- **Remove** the search box, both filter-chip rows, the `Showing X of Y` line, the `Show diagnostics` toggle, `GeneratedResourceDiagnostics`, and the `VirtualizedRailList`. The panel is a plain list.
- **No nested scroll:** the panel has exactly **one** scroll region (the list). The drawer must not add a second. Verify by rendering.
- Keep the empty state (`ALL_SESSIONS_PLACED_LABEL`) and the "no schedule yet" state.
- `Place` behaviour: arm the class exactly as `openPlacementFlow` does today (`setKbSelectedSource({ type: 'unassigned', item })`), so the grid highlights the free slots. When `item.facultyId` is null, `Place` opens the Teaching Load repair (today's `openTeachingLoadRepair`) and the row's reason says `No teacher yet`.

### One click on a slot places it, with a receipt and Undo

Today a clean slot opens an inline Confirm (`decideAutoSavePlacement` → `preview-confirm`, B1). The operator's 2026-09-30 instruction supersedes that for the ordinary case:

- A **clean** or **soft-warned** slot commits on the **single slot click** — no second Confirm — reusing the existing receipt + Undo (`buildEditReceipt` + `setLastAutoSaveUndo`, the same path `confirmInlinePlacement` uses).
- An **occupied** slot, a **hard-blocked** slot, a slot with **no resolved room**, and a class with **no owner** keep the existing review path (swap prompt / inline chooser / Teaching Load repair). Nothing dangerous auto-commits.
- Update the B1 control test (`timetable-relaxed-main-b02.test.tsx`) to the new operator contract: a clean slot now returns an auto-commit decision; the fail-closed preconditions (`review-no-owner`, `review-occupied`, `review-no-room`, `review-no-preview`, `review-blocked`) are unchanged. Record the operator decision in the test comment. Do not delete the control — rewrite it to assert the new contract.

### Esc closes the drawer

Add an Escape handler on `TimetableTaskDrawer` that calls `onTaskChange(null)` when no dialog is open. Scope it so it does not fire while a dialog/overlay is open.

## Files you own

- `atlas-client/src/components/timetable/GeneratedUnassignedPanel.tsx`
- `atlas-client/src/components/timetable/TimetableTaskDrawer.tsx`
- `atlas-client/src/components/timetable/timetableContexts.types.ts` (add `facultyLabel`)
- `atlas-client/src/components/timetable/buildScheduleReviewWorkspaceContexts.ts` (thread `facultyLabel`)
- `atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts` (thread `facultyLabel`; the one-click commit path)
- `atlas-client/src/lib/simple-timetable-state.ts` (`decideAutoSavePlacement` auto-commit kind)
- `atlas-client/src/components/timetable/__tests__/timetable-relaxed-main-b02.test.tsx` (B1 control rewrite)
- new test file(s) under `atlas-client/src/components/timetable/__tests__/` and a `package.json` script entry
- `atlas-client/package.json` (script entry only)

**Forbidden:** `GeneratedRunRailPanels.tsx` (dead duplicate — leave byte-identical), `D:/ATLAS`, any server/prisma file, any other lane's file. If a shared file must change, keep the change minimal and additive.

## Failing-first tests (mandatory)

Write the tests **before** the fix and show them red on the base, green on the candidate. At minimum:

1. **Rendered** mount of `SimpleUnassignedSessionsPanel` with a context carrying unplaced items across **two** sections:
   - title reads `N classes need a time slot` with `N === summary.unassignedCount`;
   - two section headings render;
   - each row shows subject, section, teacher name, a plain reason, and **exactly one** button whose label is `Place`;
   - no raw reason code (`NO_AVAILABLE_SLOT` etc.) appears anywhere in the rendered text;
   - no search input, no filter chips, no `Showing`, no `Show diagnostics`.
2. **Count parity:** the panel title count equals the More-menu item's count for the same context (one source).
3. **Esc:** pressing Escape on the drawer calls `onTaskChange(null)`.
4. **One-click:** `decideAutoSavePlacement` returns the auto-commit kind for a clean slot and for a soft-warned slot; the fail-closed kinds are unchanged. Plus a rendered/hook-level control that a clean slot click commits and produces a receipt with Undo.
5. **No nested scroll:** structural assertion that the panel renders no `VirtualizedRailList` and no second `overflow-auto` region.

Every new/changed test file must be reachable from a committed `package.json` script (§11). Run `npm run test:encoding`.

## Gates (run and report literal results)

- the new test script(s);
- `test:timetable-relaxed-main` (the B1 control lives here);
- `test:a7-c12-calm-copy` (decision-8 copy guard);
- `test:a7-c13-clip` (no-clip guard);
- `test:plain-language-j2j3-c01` (reason-label guard);
- `test:ux-guardrails`;
- `test:a2-place-one-action` and `test:a2-mc-move-swap-grid-wiring` (placement path preservation);
- `test:client-suite` (report the failing set and prove it is identical to the base's);
- client `tsc --noEmit` (report pre-existing errors only);
- `npm run test:encoding`;
- `git diff --check`.

## Evidence

- Rendered jsdom evidence is the primary proof (the tests above).
- **Before/after screenshots at 1366x768** with a draft that has unplaced classes: use the test harness or a loopback preview with a mocked `/api/v1` (`ISOLATED_LOCAL_BROWSER`). If no browser tool is available in your harness, report the screenshot rows `UNPERFORMED` with the reason — do not fake them.
- One commit, conventional message, `REVIEW_REQUIRED` handoff with immutable Git identity, changed paths, decisive commands and results, and clean-worktree proof.

## Addendum (operator, 2026-09-30, live train 20)

> the live unassigned rows show 5 identical lines (GR8 - Makabansa, TLE, NAVARRO); each row must say its term and session.

The row must therefore also name its **term** and **session**, so five sessions of the same subject/section/teacher are distinguishable. Render `Term {item.termIndex}` (omit when `termIndex` is null) and `Session {item.session}` in the row, in plain words, before the reason. Add a failing-first test: two items with the same subject/section/teacher but different `session`/`termIndex` render as two distinct rows, each naming its own term and session.

## Boundaries

No live write, no deploy, no generation, no publication, no migration, no sign-in to live, no companion edit. Do not merge, rebase, push, or touch `D:/ATLAS`. Commit a `wip(...)` checkpoint by step 120 and again by step 240.
