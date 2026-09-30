# A9 `docx-sections` — R2 additive correction (2026-09-30)

Boundary: worktree `E:/ATLAS-worktrees/lane-a9-docx-sections` (`KEEP_ACTIVE`),
branch `work/a9-docx-sections`; cycle base `69b404ff…`; R1 tip `c886a410…`.
Scope touched: **`atlas-client/**` + `docs/handoffs/**` only.** Additive commits —
`c886a410` and everything below it is untouched (no amend/rebase/force-push).

## Commits (one per item, additive)
| Item | SHA | Subject |
|---|---|---|
| R2-a X3 | `2e4ceb99` | the home-room cell wraps to fit its panel, keeping the room text whole |
| R2-b X4 | `1d852e7d` | a double-click on Apply sends one write, not two |
| R2-c X2 | `e003932f` | a rotating row never lists an empty member |
| R2-d docs | (this commit) | correct the R1 column-width claim and record the measured overflow |

## Trace outcomes — met, with basis
- **R2-a met.** The Home room column is back to the A9 C7 cap **200px** on BOTH
  the `<th>` (`Sections.tsx`) and the `<td>` (`SectionRow.tsx`, same number), and
  the room text **wraps** to a second line: the row status line
  (`data-testid="section-row-home-room"`) is a fixed `h-8` two-line clamp, and the
  shared trigger's label is a two-line clamp with the trigger at `px-2`/`gap-0`
  (the change is in the PRIMITIVE, so row + mobile card + guided dialog wrap
  alike, §8). The cell is a uniform fixed height, so assigning a room cannot
  change the row height. Control: the c2-R1 control is extended additively —
  the `>=322px` floor is marked `SUPERSEDED (A9-c2 R2)` in place and replaced by
  the `<=200` cap and the wrap assertions.
- **R2-b met.** `apply` and `undo` in `HomeRoomAutoAssignDialog.tsx` each carry a
  ref set synchronously before the first `await` (`applyInFlightRef` /
  `undoInFlightRef`), on the `HomeRoomConfirmDialogs.tsx` `inFlightRef` shape, so
  one invocation = one PUT in the same tick. The button `disabled` stays the
  visible affordance. Two additive rendered controls dispatch two clicks
  synchronously inside one `act()`.
- **R2-c met.** `unassignedMemberLabel` falls back to the family's plain name and
  never returns an empty label; `groupUnassignedByRotationFamily` also drops an
  empty member at the boundary. Two additive controls in
  `a9-c5-unassigned-grouping.test.ts`.
- **R2-d met.** The false R1 measurement claim is marked `SUPERSEDED (A9-c2 R2)`
  in place in `a9-sections-docx-20260930-executor-r1.md`, and the R1 rationale
  block in `SectionRow.tsx` carries the same superseded record — nothing deleted.

## Recomputed column-width sum (no browser needed)
`Section 300 (pinned) + Grade 87 + Enrolled 100 + Capacity 105 + %Full 87 + Home room 200 + Details 100 = 979px`,
which is `<= 984px` (the scroll panel at 1280×720) and therefore also fits the
1070px panel at 1366×768. `SectionRoomPicker` gains **no** width/cap/className
override; only the one table column is capped.

## Commands run — real tallies
- `npx tsc --noEmit -p tsconfig.json` → **exactly the 5 pre-existing base reds**
  (3× `playwright` absent in `timetable-post-deploy-c04` / `-c05` /
  `timetable-scheduling-quality-c03`; +1 implicit-any and +1 comparison in
  `timetable-truth-labels-a2`) — **none in any touched file**.
- `npm run build` → **exit 0** (`VITE_ENROLLPRO_URL='https://dev-jegs.buru-degree.ts.net'` inline).
- `test:a3-sections-map` **42/42** · `test:a3-c4-sections` **27/27** ·
  `test:a9-c3-sections-rooms` **17/17** · `test:a9-c1-program-badges` **7/7** ·
  `test:a9-c4-details-dialog` **3/3** · `test:ux-guardrails` **31/31** ·
  `test:a9-c5-unassigned-grouping` **11/11 + 1/1** ·
  `test:a9-c6-room-receipt-undo` **6/6** · `test:a5-subjects-c1` **15/15** (run
  because `SectionsSortableHeader` gained an optional prop it renders).
- Zero-write: `a3-sections-map-home-room-persist` still dispatches **0 PUT on
  Cancel** (inside 42/42). Sub-11px: none in owned files (scan printed 0 for
  `SectionRow`, `HomeRoomAutoAssignDialog`, `SectionRoomPicker`, `Sections.tsx`).
  `SectionDetailsSheet.tsx`: **zero** `text-slate-900` / `text-slate-500`.

## Failing-first readings
- c2-R1 control: at `69b404ff` the Home `<th>` is `200` but the status line
  (`className="min-w-0 truncate"`) and the trigger label
  (`className="flex items-center gap-2 truncate"`) are one-line nowrap → the wrap
  assertions fail. At `c886a410` the Home `<th>` is `330` → the `<=200` cap fails.
- R2-b: `c886a410`'s `HomeRoomAutoAssignDialog.tsx` has **0** occurrences of
  `InFlightRef`, so a same-tick double click sent 2 PUTs (QA's measurement).
- R2-c: the base `c886a410` blob of `section-unassigned-grouping.ts` run on a fully
  blank rotating row returned `heading "Science (rotates)"`, `members [""]`.

## Not caused by this candidate
`test:a3-truthful-numbers` (run because it contains the changed
`a3-room-picker-rows-01-02.test.tsx`) has **one pre-existing failure** in the
unrelated `a3-teacher-load-readout-a1.test.tsx` ("a placeholder row states
temporary"). `git diff 69b404ff -- atlas-client/src/components/faculty-assignments`
is **empty**, and none of that test's imports are in this diff, so the failure is
identical on the base. The A9 controls inside that script pass. R1's recorded
pre-existing reds (`test:ux-type-scale-a7c8`, `test:a3-palette-token-sweep`,
`test:a3-c9-operator-tokens`) are likewise not run here.

**BLOCKED rows: none.** Worktree disposition **`KEEP_ACTIVE`**. No push, merge,
deploy, generation/publication, runtime or live-DB action. `node_modules` junction
not installed into; no worktree created or removed.

The only browser use in R2 was an **isolated text-metric measurement** (a canvas
`measureText` on a `data:` URL, no ATLAS origin, no page, no session) to choose the
wrap track — it is NOT acceptance evidence, and no Tailnet row is claimed here. The
planner's own re-measurement at 1366×768 and 1280×720 is the X3 acceptance.
