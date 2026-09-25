# SCHEDULE-CLARITY-C03 handoff (Lane C)

- **Base:** `61f57a39` (a merge of `main` `e475c673` with the C01 candidate branch, `e3621214`) · **Candidate:**
  `07a3e5f7` on `work/lane-c-schedule-clarity-c03` · **Tier:** MEDIUM (client-only production wiring; no API,
  schema or server change)
- **Stacked on C01.** B3 and B4 use C01's published-revision preview route and clash list, so this branch merges
  the C01 candidate first. Review `61f57a39...07a3e5f7`, which is C03 alone. Integrate C01 first; C03 then merges
  cleanly. `package.json` `test:client-suite` will conflict with C02 (both add entries to one line): keep both.
- **Source findings:** B3, B4, B8, B9, B10, B11 in
  `docs/reviews/ux-audit-teaching-load-and-schedule-controls-2026-09-25.md` (branch `docs/lane-c-audit-tl-controls`).

## What and why

- **B3, moving one class after publishing.** A live check on 2026-09-25 (run 317) showed clicking a class works,
  but "Choose a new time", drag and drop and "Change room" all call the direct edit, which the server refuses
  on a published run (`RUN_ALREADY_PUBLISHED`, with an API path in the message). On a published run they now open
  `PublishedEntryChangePanel`. The panel:
  - checks the change with C01's preview route;
  - names any clash;
  - asks for the start date and reason only once the check is clean;
  - posts one dated revision. That revision carries only the changed fields, each with its current value
    (`lib/published-entry-change.ts`).

  A direct edit that still reaches the server shows a plain next step. Manual edit's empty state and the
  selection strip say how a published class is changed. Entry IDs were checked: generation stores per-term IDs
  (`entry-4::t2`), so the grid's IDs are the ones the revision service looks up.
- **B4, published chip.** "Published schedule — view only" became "Published schedule" with the line "Changes start
  on a date you choose", and the lifecycle label says the same. On a published run, Generate reads "New version",
  and its name says teachers keep the published schedule until the new one is published.
- **B8, swap.**
  - `TimetableGrid` received `swapClassAEntryId/B` but never passed them to `GridCell`, so Class A was never
    highlighted (confirmed live: `ring-blue-600` absent).
  - The inline status is now an overlay, not a layout row.
  - "Swap with another class" on a selected class now makes that class the first pick. Before, it asked the user
    to pick it again.
  - The arming prompts also clear on Cancel.
- **B9, Draft view.** The published chip is hidden in the Draft view, and leaving the Schedule view cancels swap
  mode (confirmed live: "Class A selected…" and "Start swapping" followed the user into Draft). An empty draft grid
  now says what the draft is; a loading draft says "Loading the draft…".
- **B10.** A disabled Schedule history shows the reason, at full opacity.
- **B11.** `ui/searchable-select.tsx` gained `ariaLabel`, `triggerId` and `searchLabel`, and Enter/arrow keys select
  (`aria-activedescendant`). Unnamed usages keep their old markup. The Teacher-leaving label now points at the
  picker button, and the replacement pickers are named.

## Commands run

- `npm run test:schedule-clarity`: 21/21 (`schedule-clarity-c03.test.ts` 18, `schedule-clarity-c03-dom.test.tsx` 3).
  The DOM file mounts in jsdom with a mocked `atlasApi`. It asserts:
  - the preview and create request bodies;
  - that no direct-edit route is called;
  - that there is no date field before a clean check;
  - that Enter selects.
- **Failing-first:** the modified sources were reverted to `61f57a39` and the new files kept.
  - The unit file fails: the new exports are missing.
  - The DOM test fails for B11.
  - The panel tests pass, because the panel is new.

  The source was restored byte-identical (checked with `cmp`).
- `test:client-suite`: base `61f57a39` 926/941, candidate 947/962. The 15 failures are identical by name, with no
  candidate-only failure (the base was run in the same worktree with the candidate set aside and restored).
- Updated with SUPERSEDED markers (the old assertion is kept as a comment):
  - `timetable-header-collapse-c01` (the "view only" and `<span>Generate</span>` checks);
  - `timetable-scheduler-clarity-c01`;
  - `ux-quickfix-c01-header-actions`.
- Production build with `VITE_ENROLLPRO_URL`: exit 0. `tsc --noEmit` shows only the 4 pre-existing playwright errors.
  Largest components: `TimetableGrid` 978 and `CenterWorkspace` 938 lines, both under the 1000-line limit.

## Risks

- NON_BLOCKING: the Draft view still shows both "Generate" and "Generate when ready". The secondary Generate is
  required by several committed header contracts, so it was left as is.
- NON_BLOCKING: the Advanced right-panel "Move / Change room" still opens Manual edit. On a published run its
  refusal now shows the plain next step (`PUBLISHED_DIRECT_EDIT_MESSAGE`) instead of the API path, but it does not
  open the dated-change panel.
- NON_BLOCKING: "Schedule history" counts direct edits only. Dated published changes are not listed there, so on a
  published run with scheduled changes the "nothing to show" reason is incomplete.
- **Deployment-acceptance rows (browser, after deploy):** on the published schedule:
  1. Choose a new time on a free slot: the panel opens and checks, and no API path is shown.
  2. Swap from a selected class: it becomes Class A and is highlighted, and the grid does not move.
  3. Open Draft: no published chip and no swap prompt.
  4. More, then Schedule history, shows its reason.
  5. In Teacher leaving, type a name and press Enter.

**Worktree disposition:** `KEEP_ACTIVE` until integrated, then `RETIRE_AFTER_INTEGRATION`.
