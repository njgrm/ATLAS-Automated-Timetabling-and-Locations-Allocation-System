# A2 place — one action + visible in the grid (2026-09-30)

**Lane A2 (timetable behaviour). Risk MEDIUM (client + one server write path).**
Base: `origin/main` `8c8138eb`. Worktree: `E:/ATLAS-worktrees/lane-a2-place` (branch `work/a2-place-one-action`).

## Operator requirement (Lane C -> A2 mc, 2026-09-30 01:00, items 10 and 11)

Putting a class into the **Draft** — from the unplaced list (the left-rail queue) or into a free grid cell — must:

1. **Happen in one action with an Undo, no confirm-first dialog.** Today a clean drop renders an inline
   "Preview before saving" panel with a **Confirm** button (and a no-room/no-owner drop opens the
   `draft-placement-review-dialog`). The operator must see the placement saved immediately, with the existing
   contextual **Undo** offered — not a confirm step.
2. **Appear in the grid immediately and stay after reload.** Today the placed class is **invisible** in the grid
   ("invisible after placing") while it is present in the left-rail pinned-placement list.

**No header control, banner, chip or copy is added to the header** — A7 owns the header (operator decision 2 and 8).
This change lives in the centre pane, the left-rail list and the mutation path.

## Root cause (planner, source-verified)

**Wrong term/view filter compounded by a non-persisted term identity.**

- The pre-generation grid entry list is projected in `atlas-client/src/hooks/useTimetableData.ts`
  (`preGenEntries`, ~748-764) from `draftBoard.placements`. The projection **drops `termIndex`** (and the
  `LockedSession`/`DraftPlacement` types in `atlas-client/src/types.ts:1619,1655` do not declare it, although the
  server returns it — `pre-generation-draft.service.ts:329`).
- `filteredDraftEntries` (`useTimetableData.ts:1230-1240`) then filters every entry through
  `matchesTermScope(entry, effectiveTermFilter)` (`atlas-client/src/lib/timetable-term-scope.ts:13-21`), which
  returns **false** for an entry whose `termIndex` is null/undefined when a **numeric** term is selected.
- The header defaults `termFilter` to the verified active term — a **number** (`useScheduleReviewWorkspaceState.ts:815-825`),
  and the live term contract is verified (2026-2027, EnrollPro active **T1**). So every placed draft class is removed
  from the grid the moment it is committed, while `LeftRailContent`'s pinned list (status-only filter) still shows it.
  That is exactly "invisible in the grid".
- The placement's term is also **not persisted with the placement**: the commit request never carries `termIndex`
  (`pre-generation-draft.router.ts:48-69` ignores it), and `commitPlacement`
  (`pre-generation-draft.service.ts:1341-1358`) sets no `termIndex`, so the Prisma default `@default(1)`
  (`prisma/schema.prisma:1090`) is stored for every placement regardless of the term the operator was viewing.

Fix both halves so the grid filter can see a placement **and** the placement carries the term it was placed into.

## Required outcome

- **One action:** a clean or soft-warned drop of a queue item (or a draft-placement move) commits without any
  Confirm step, and the existing Undo (`setLastAutoSaveUndo`, ledger `draft`) is registered for it.
- **Fail-closed preserved:** a drop the authoritative preview cannot clear — hard conflict, no resolved room, no
  Teaching-Load owner, or a failed preview — must **not** auto-commit; it keeps a single explicit recovery surface
  (the existing review dialog), which is not a "confirm-first" step for an ordinary placement.
- **Visible:** the committed placement appears in the grid immediately and remains after reload, in the term it was
  placed into. The placement's `termIndex` is carried into the projected grid entry **and** persisted on commit from
  the selected term (validated 1..4, fail closed outside the ordered contract).

## Decisive files (executor to confirm; do not widen beyond the placement path)

- `atlas-client/src/types.ts` — `LockedSession`/`DraftPlacement`: declare `termIndex`.
- `atlas-client/src/hooks/useTimetableData.ts` — `preGenEntries`: carry `termIndex`.
- `atlas-client/src/hooks/useTimetableMutations.ts` — `PreGenPendingPlacement`, `buildPreGenPendingPlacement`,
  `stagePreGenDrop` (auto-commit on clean/soft + Undo), `commitPreGenPending`/`commitConfirmPlacement`.
- `atlas-client/src/lib/simple-timetable-state.ts` — `decideDraftPlacementReview` decision boundary.
- `atlas-client/src/components/timetable/InlinePlacementPreview.tsx` / `timetable-inline-placement.ts` — copy only
  for whatever confirm surface remains (blocked/no-room/no-owner).
- `atlas-server/src/routes/pre-generation-draft.router.ts` — parse `termIndex`.
- `atlas-server/src/services/pre-generation-draft.service.ts` — persist `termIndex` on create/update.

**Do not touch:** the header (`TimetableSimpleHeader`, `SimpleHeader*`, `ScheduleReviewWorkspaceHeader`), publication,
generation, migrations, `prisma/`, or any runtime/env/task file. All relative server imports keep explicit `.js`.

## Tests first (failing first)

In `atlas-client` (and `atlas-server` for the persistence row), add controls that fail on the current base:

1. **Rendered grid row (decisive):** mount the real `ScheduleReviewWorkspace` (pre-generation) with a
   `draftBoard` whose placement has `termIndex` set and the header term filter numeric; assert the placed class is
   rendered in the grid (`data-testid`/entry id `draft-placement-<id>`), and that removing `termIndex` from the
   projection makes it disappear (mutant control).
2. **One-action row:** a clean drop calls `commitPreGenPending` (or the commit endpoint) **without** any Confirm
   click and registers an Undo (`lastAutoSaveUndo` ledger `draft`); a hard/no-room/no-owner drop does **not** commit.
3. **Persistence row (server):** `POST .../pre-generation-drafts/commit` with `termIndex: 2` persists and returns
   `termIndex: 2`; a `termIndex` outside the ordered contract is rejected.

Every changed test file must be reachable from a committed `package.json` script. Run the affected suites plus one
preservation suite. `tsc --noEmit` clean; `git diff --check` clean.

## Evidence and boundaries

- **No live/staging deploy, no generation, no publication, no migration.** No write to the shared runtime.
- **Staging reproduction is BLOCKED** and must be reported as such: on the staging preview
  (`http://127.0.0.1:5231`, via `/__dev/staging-login`) `/timetable` stops at "Term setup is required" (staging active
  year 2023-2024 has no verified term contract), a year-2 commit returns `DERIVED_DEMAND_PROJECTION_INCOMPLETE`, and
  year 5 is `INACTIVE_HISTORICAL_YEAR`. The rendered grid row above is the substitute reproduction; state this plainly.
- Candidate commit(s) on the worktree branch; handoff = base SHA, candidate SHA, exact paths, commands run with
  results, root cause, and a `passed/blocked/unperformed` tally. No handoff longer than one page.
