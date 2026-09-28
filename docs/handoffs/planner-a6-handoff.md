# Planner A6 — Teachers + Teaching Load — c1 handoff (2026-09-28)

**0 fixes live and seen / 7 items integrated and QA-accepted / 0 dropped.**
Nothing is deployed and nothing is seen rendered. This cycle is source-only; the browser rows are
listed below and are owed on the Tailnet after A4 ships the release.

## Result

Product range `abe0153a..4706ba65`, integrated and pushed at merge **`6498c322`** on `main`
(branch `integration/a6-teachers-tl-2026-09-28`). Base `5c566dba`. 25 product paths, +3534/−435,
then a 4-path bounded correction. **Zero** path under `src/components/timetable/**`,
`src/hooks/useScheduleReviewWorkspaceState.ts`, `src/ui/**`, and no `DataTableHeader`/`thead`
(A2 and A5 fences held). `pages/Subjects.tsx` is the only file in the merged tree that differs from
the reviewed candidate, and it is A5's, carried in from `main`.

| item | tier | verdict | decisive evidence |
|---|---|---|---|
| 24.1 Teachers header direct buttons | VISUAL | **DONE** | `Review teachers` and the `... More` popover removed; `Update teacher list` then `Create temporary teacher (Teacher X)` as direct buttons, strings verbatim. Mutant `→ 'Refresh roster'` fails A6-24.1-1. |
| 23.1 profile dialog resize + subject codes | VISUAL | **DONE (source)** | `resize` + `overflow-hidden`, `min-w-[min(500px,95vw)] min-h-[min(400px,90vh)] max-w-[95vw] max-h-[90vh]`, one `overflow-y-auto` body, codes `text-xs font-medium` legible. Handle *visibility* is a browser row. |
| 16.1 inline `Review load` per card | VISUAL | **DONE** | every row has `Review load` with `aria-label="Review load for <name>"`; detached desktop control gone. |
| 38 Load summary behind a modal | VISUAL | **DONE (source)** | inline `TEACHING LOAD SUMMARY` band removed; `Load summary` in the header action row opens a dialog rendering the page's own `TeachingLoadTruthPanel` node as `children`, so there is one authority. |
| 39 filter toolbar | VISUAL | **DONE (source)** | `More filters` gone from the DOM; one row: search `w-[240px] h-9 text-xs`, `All status`, `All departments`, `All loads`, `Lowest load`, `Cross-Dept`, `Unmapped Specialization`. |
| 40 draft controls + save confirmation | MEDIUM | **DONE** | sticky `DRAFT STATUS` footer deleted; Undo/Redo + `Save changes` in the filter row; disabled at `isDirty === false`; `Save Teaching Load Changes?` with `Cancel` / solid confirm. |
| FIX-29 swap confirmation | MEDIUM | **DONE** | `Confirm Assignment Swap` dialog naming source teacher, **target** teacher and section, plus the weekly-load impact for both teachers; `stopPropagation` on the only initiating control; re-entrancy ref + `loading`/`aria-busy`; two rapid confirms dispatch exactly one swap. |

## Gates

Fresh QA `ACCEPT_READY`, mandatory 23 → passed 19 / blocked 0 / unperformed 4, then one BLOCKING;
bounded correction; scoped re-review **`ACCEPT_READY` 22 / 22 / 0 / 0**. Combined gates on the merged
tree: `a6-teachers` 6/6 · `a6-teaching-load` 13/13 · `a3-teachers-load` 43 pass 0 fail 6 pre-existing
`test.skip` supersessions · `a3-c4-tl-truth` 13/13 · `a3-c10-tl-density` 9/9 · `a3-c10-workload-audit`
12/12 · `teaching-load-clarity` 8/8 · `a3-c10-teacher-surface` 20/20. `typecheck` 5 errors, **0 in my
fence**: 3 × missing `playwright` (A2, module not installed in this worktree) + the byte-identical
pre-existing `timetable-truth-labels-a2.test.ts(523,32)`. `test:client-quality` 33/34, the one failure
pre-existing and A2-owned.

## The finding worth keeping

QA's BLOCKING 1 was a **count wearing the wrong noun**: the save gate said "You have X uncommitted load
assignment **changes**" while `X` was `Object.keys(draftByFaculty).length` — the number of *teachers*
holding a draft. A 3-teacher/7-assignment draft told a scheduler it was about to write 3 changes. The
control that claimed to cover it could not fail: `A6-40-3` mounted a harness-authored `Shell` whose
`description` the test itself wrote, so replacing the real template still gave 10/10 and 43/0. The
correction derives a real per-teacher symmetric-difference of `(subjectId, sectionId)` pairs — the
unit the save's whole-set `PUT` actually writes, removals included — and the body now reads
`You have 7 uncommitted load assignment changes across 3 teachers.` The unprovable `for Term N` was
**withheld** rather than asserted: `FacultyAssignmentDraft` carries no term. Two new rows mount the
real `TeachingLoadModals`; QA reproduced the mutant at 11 pass / 2 fail and re-introduced the original
defect at 12 pass / 1 fail. §11's "a control's fixture must come from the real surface" is the rule
that caught it, and the same shape will catch the next one.

## Recorded NON_BLOCKING residuals (ship-with-finding, no third round per §11)

1. `TeachingLoadModals.tsx:162` — the **discard** dialog still reads `Discard ${activeDraftCount}
   draft change(s)?` with a teacher count labelled "changes". Same class, pre-existing, outside item 40.
2. The new count's **arithmetic is source-shape-pinned, not executed**: a mutant collapsing pair
   identity from `(subjectId, sectionId)` to `subjectId` still passes 13/13. The directional loops are
   pinned; the pair key is not. Add one executed unit when the hook is next mounted.
3. `useTeachingLoadData.ts:817` counts a draft faculty whose roster row is missing, which `handleSave`
   then skips — a marginally high teacher count in that pathological case.
4. **`pages/TeachingLoad.tsx` is full at 998 physical lines** against `test:client-quality`'s strict
   `< 1000` row. (The executor reported reducing it from 1000; QA measured 997 → 998 — the correction
   *grew* it by one line and nothing was deleted. Treat the file as full.)
5. `pendingChangeScope` is now always `''`, kept as a documented seam for a future term-scoped draft.
   QA adjudicated KEEP: a fabricated term clause is pinned to fail by `doesNotMatch(/for Term/)`.

## Owed to a real browser — deployment-acceptance rows, not source rows (§11)

Assert `window.location.origin === 'https://njgrm.buru-degree.ts.net'`, 1366×768 and 1920×1080,
**after** A4 ships the release:

1. **23.1** the profile card's native resize handle is visible bottom-right and dragging it resizes.
2. **39** the seven filter controls sit on one row without wrapping; no horizontal scrollbar.
3. **38/40** the no-scroll fold: search bar, filters and teacher rows fully in view; no fixed footer.
4. **38** the `Load summary` dialog shows a vertical list with no sideways scroller (Lane C major 3).
5. **40** the save confirmation reads the real change count; Cancel saves nothing.
6. **FIX-29** a card-body click mutates nothing; the swap control opens the dialog and still mutates
   nothing; Cancel → zero draft changes; Confirm → exactly one swap; double-confirm → exactly one.

## Next blocker — Lane C's 19:05 TOP PRIORITY spec, NOT REACHED in this cycle

`docs/reviews/codex-teaching-load-walk-20260928/report.md` (5 major, 2 minor) and the operator's
screenshot posted to `docs/handoffs/lane-a-to-c.md` arrived **during** this cycle's integration. Not
attempted here — this cycle spent its two review rounds. **5 major are live in my fence and three of
them sit in code `6498c322` just changed**, so the before/after must be checked on staging before
anything is claimed better:

1. **Major 1** the 1070px header status/action rail overflows sideways and the warning chip is hidden
   beneath `Assign` (x=1115 vs 1133) at 1366 and 1920; summary truncated. Wants two calm rows, one
   primary action, sentence case, no letter-spaced caps. — `pages/TeachingLoad.tsx` header, which my
   item 38 and 40 both edited.
2. **Major 2** `% staffed 100%` / `Classes without a teacher 0` sit beside `Unknown number of classes`
   and a saved-data notice: contradictory operational claims in the degraded path. —
   `TeachingLoadTruthPanel` / `teachingLoadWorkspaceMetrics.ts`, both in my diff.
3. **Major 3** the summary produces two 34px horizontal scrollers (1,189px and 2,388px of content).
   My dialog bounded the **vertical** axis only; the pill strips may persist. **Unverified.**
4. **Major 4** the teacher card expands inline into a destructive-looking assignment editor; wants a
   read-only profile dialog plus an explicit `Edit assignments`.
5. **Major 5** the Sections tab's empty state after a no-match search says `NO SECTIONS REQUIRE
   ATTENTION`; wants `No sections match '<q>'` with a clear-search button.
6. Minor 6 (fixed draft footer) and Minor 7 (footer `Review teachers` label) are **already addressed** by
   items 40 and 16.1 respectively — the footer is gone and the control is per-row.

**Worktree disposition:** `lane-a6-teachers-tl` → `RETIRE_AFTER_INTEGRATION`, left in place for A4
(junction-safe removal; §14 gives A4 E: capacity and reclamation). Branch `work/a6-teachers-tl`
resolves to `4706ba65`; no branch deleted.
