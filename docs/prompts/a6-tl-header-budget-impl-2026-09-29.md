# A6 c4 implementation packet — Teaching Load header to the Header budget (+ Guided-mode removal correction)

Governing packets: `docs/prompts/a6-tl-header-budget-2026-09-29.md` (Lane C, operator 2026-09-29 00:10) and
`docs/handoffs/lane-c-to-a2.md` §"header regression + control consistency" + §"Lane C -> A6, 2026-09-28 23:05".
Read `AGENTS.md` §8 (One look per control, Header budget), §11 (tiers, gates, done-means-seen) and §16.

**Tier: MEDIUM.** Merging two status lines alters what a status *claims* (§11), so this is not a VISUAL copy pass.
Loop: `executor → one fresh QA → planner integration`. Do not integrate, do not deploy, do not push to `main`.

- Base SHA: `ce1257c8` (`origin/main` at packet issue). Worktree `E:/ATLAS-worktrees/lane-a6-tl-header`
  (exclusive writer — Lane A6 planner). Branch `work/a6-tl-header-budget`. One commit is the review candidate.
- Fence: `atlas-client/src/pages/TeachingLoad.tsx`, `atlas-client/src/components/faculty-assignments/**`,
  their tests, `atlas-client/package.json` (script entries only). **Do not touch** `src/components/timetable/**`,
  `src/ui/**`, `src/hooks/useScheduleReviewWorkspaceState.ts`, any `DataTableHeader`/`thead`, `atlas-server/**`,
  `prisma/**`, `ops/**`, `AGENTS.md`, or the Lane C hotfix's zero-demand headline / grade resolver
  (commits `5bccb65d`, `a21f2cbc` — see the 23:05 note: *"do not touch those"*).

## G0 — The packet premise that is false, corrected first

`docs/prompts/a6-tl-header-budget-2026-09-29.md` says *"Guided mode removal (a2c4c135) is on main"*, and
`docs/prompts/a4-train-2026-09-29-5.md` line 13 lists A6 `a2c4c135` as *"Guided mode removed from Teaching Load"*.
**Measured false.** `a2c4c135` is a docs-only fold (`docs/handoffs/lane-c-to-a2.md`, `docs/plans/live-state.md`,
2 files). `origin/main` at `ce1257c8` still renders
`atlas-client/src/pages/TeachingLoad.tsx:895` `<TeachingLoadGuidedModePlaceholder onOpenAdvancedGrid={…} />`
behind the `advancedGridVisible` gate at line 796, and the component file still exists.
A4's train-5 record would otherwise ship a claim that is not true. G1 makes it true.

## G1 — Guided mode removed (operator's own words: *"what's the deal with the guided mode thing? Just remove that please"*)

1. The grid is **always** shown: remove the `advancedGridVisible` ternary gate at
   `TeachingLoad.tsx:796`/`894-895`. Keep the `ui.viewMode === 'teacher' ? <TeacherGridMode/> : <SectionGridMode/>`
   branch exactly as it is.
2. Delete `atlas-client/src/components/faculty-assignments/TeachingLoadGuidedModePlaceholder.tsx` and its import.
3. `advancedGridVisible` / `setAdvancedGridVisible` are also passed to `TeachingLoadRepairQueue` — **enumerate every
   consumer first** (`grep -rn advancedGridVisible atlas-client/src`), then remove the state only if nothing
   still needs it, and if the repair queue still needs a notion of "the grid was closed", give it an explicit prop
   rather than reviving the gate. Record what you found.
4. `buildGuidedEmptyTeachingLoadMessage` (imported line 13, used line 445) **may stay** if its words are plain.
   Quote them in the handoff; if they are not plain, rewrite them plainly and say so.
5. Tests: `atlas-client/src/lib/__tests__/tl-operator-workspace-c05.test.ts` holds the placeholder expectations.
   **Replace** each with the guarantee that replaced it (the workspace renders the grid and no placeholder on the
   first paint). Do not delete a row to make a suite green (§16): mark the superseded expectation and add its
   replacement beside it.
6. Failing-first: the new assertion must FAIL on `ce1257c8` (the placeholder is present there) and pass on the
   candidate. Record the literal command and both tallies.

## G2 — The header to the Header budget (operator's complaint, verbatim)

*"the Teaching Load header's compaction to less vertical rows is not graceful nor practical"*, and
Lane C's staging walk of train 3 (`bae81afb`, 2026-09-28 22:55): **A6 T5 — two amber lines when EnrollPro is
unreachable (saved-data status + Next step); merge into one.**

1. **Exactly one status line in the header, in every state.** When the source is degraded there must be **one**
   line that says it, not a degraded notice beside a repair-queue sentence. The repair queue stays a *next step*
   with its action, not a second status sentence. Mutant required: re-introduce the second amber line and the row
   must fail.
2. **Two calm rows at 1366×768** (§8): row 1 = title/tabs, **ONE** status chip, the primary action, `More`;
   row 2 = the pickers. Row 2 of the header is currently a single 28px band packing a degraded notice, a status
   sentence, an alert clause and the repair queue — that packing is the squeeze the operator rejected. Give the
   row room; **undo the squeeze, do not squeeze harder**. Vertical calm, not compression.
3. **No truncated sentence.** No ellipsis, no `truncate` on any header string. A long string wraps or moves into
   its `More`/`Tooltip` — it never ends in `…`. Mutant required.
4. **No helper sentence under a button.** Explanations live in a `Tooltip`/`Popover`/`HoverCard` from `@/ui`
   (`§8`: no raw `<details>`, no `title`).
5. **One look per control** (§8): every picker in the Teaching Load header/filter row is the same `@/ui`
   primitive and the same variant as `/timetable`'s, with the same trigger size, border and placeholder style.
   No page-local `className` that changes a primitive's look. *(The repo-wide picker sweep is A5's
   (`e93f16d8`); this row is scoped to Teaching Load and must not widen into Subjects/Sections/Faculty.)*
6. **Nothing is hidden by the restructure.** Every figure the truth panel carried keeps its `data-testid` and
   stays reachable from `Load summary`; the repair queue keeps its count, live status, `disabledReason` and
   primary action; `Archived load` stays reachable. Prove it by asserting each id still resolves on the
   candidate — a control that cannot be reached is a regression, not a simplification.
7. **One status chip.** If two chips claim the same thing, one of them goes. Say in the handoff which.

## G — Gates (record literal commands and tallies; do not substitute)

`npm ci` in `atlas-client/` first (no `node_modules` in this worktree; `E:` free space is **24.45 GiB**, below the
§3 25 GiB warn line — do not install or build if free space drops under 20 GiB, and say so if you stop).

1. `npm run test:a3-c10-tl-density` — the committed height-model control. `TEACHING_LOAD_HEADER_MODEL` must be
   re-derived from the **new** class strings, not carried over. **Keep the old constants** as superseded values
   with the reason; add the new model beside them. Weakening or deleting an existing assertion to pass is a
   §16 failure.
2. `npm run test:a6-teaching-load`, `npm run test:a3-teachers-load`, `npm run test:client-quality`
   (its `< 1000` physical-line row for `TeachingLoad.tsx` — the file is **962** lines at `ce1257c8`;
   **extract the header composition into a component before you add anything**, do not push it to the cap).
3. `npm run test:client-suite` — compare the failing set to the same command at base `ce1257c8` and report the
   symmetric difference in both directions. Do not report a green count you did not measure.
4. `npm run typecheck` — report errors **in your fence** and separately.
5. `git diff --check` clean; `git status --short` empty at hand-off; no stash, no untracked residue.

**Every new or changed test file must be reachable from a committed `package.json` script in the same commit**
(§11: a test no gate runs is not evidence). Add the script entry; do not rely on a `tsx --test` path typed by hand.

## Out of scope — do not do these

- No deployment, no staging deploy, no supervisor/task/env/listener change, no browser sign-in.
- No generation, publication, migration or live-data write.
- No change to the picker sweep on other pages (A5's), to `/timetable` (A2's), or to School Year Setup (A7's).
- Do not edit `docs/handoffs/lane-c-to-a2.md` or `docs/plans/live-state.md` — the planner owns those regions.

## Return (one page)

Base SHA · candidate SHA · exact changed paths · what changed and why, quoting the before/after header strings ·
the literal commands and tallies for every gate above · the failing-first proof for G1 and for each mutant in G2 ·
every mutant control you broke and restored, byte-exact · known risks each marked `BLOCKING` or `NON_BLOCKING` ·
verdict (`REVIEW_REQUIRED`). No transcripts.
