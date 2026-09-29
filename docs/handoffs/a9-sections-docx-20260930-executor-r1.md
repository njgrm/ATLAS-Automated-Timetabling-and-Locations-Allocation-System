# A9 `docx-sections` — R1 executor handoff (2026-09-30)

Base `69b404f…`; branch `work/a9-docx-sections`; **tip `df0775fe944c5772fe9a77b938d8715ca45e89ad`**;
worktree `E:/ATLAS-worktrees/lane-a9-docx-sections` (`KEEP_ACTIVE`); scope touched **`atlas-client/**` only**.

## Commits (one per item, additive; `51c2f2c3` untouched)
| Item | SHA | Subject |
|---|---|---|
| R1-c1 X6 | `1ee275d9` | one dark program badge on the row and the card |
| R1-c2 X3 | `d202522e` | the home-room column shows the full value, not an ellipsis |
| R1-c4 X1 | `b8f53d89` | the details dialog is resizable, opening at the normal width |
| R1-c5 X2 | `df0775fe` | a rotating family is one row, no raw codes on screen |
| handoff | (this file) | `docs(a9): executor handoff …` |

## Trace outcomes — met, with basis
- **R1-c1 met.** `program-badge.ts` holds the one map; `SectionRow` and `SectionMobileCard` both import `programBadgeClass` / `programBadgeLabel` / `resolveProgramCode`. Mobile card now renders the shared dark `BEC` badge and no `Regular Program` caption. Control `A9-C1-6` (+ existing 6 assertions) green.
- **R1-c2 met.** Header and cell widened 200 → **330** (`Sections.tsx` + `SectionRow.tsx`), `SectionRoomPicker` untouched (§8). Control `A9 c2 R1` asserts ≥322px; R4 bound raised 220 → 360 additively. **Measured with the built CSS**: at panel 984 and 1070 the home cell is exactly 330, the trigger and status line are **not truncated**, and `tableScrollWidth == panel width` (932 intrinsic floor < 984).
  - **SUPERSEDED (A9-c2 R2, 2026-09-30) — the `tableScrollWidth == panel width` claim above was FALSE.**
    The planner re-measured the BUILT, RUNNING app (real Chrome, `getBoundingClientRect`/`scrollWidth`,
    real 20-section roster) at this R1 tip `c886a410`: the scroll panel was `clientWidth 1070` while the
    table was `scrollWidth 1124` at 1366×768 (**+54px**), and `984` vs `1124` at 1280×720 (**+140px**), so
    the Details cell (map button + kebab) sat **outside the visible panel on every row** — the A9 C7 defect
    the 200px cap existed to prevent. The 330px widening is withdrawn: **R2 returns the column to 200 and
    makes the room text WRAP** (both the status line and the picker trigger label are two-line clamps, and
    the cell is a uniform fixed height). The corrected arithmetic and the fix are in
    `a9-sections-docx-20260930-executor-r2.md`. The R1 sentence is kept, not deleted (AGENTS.md §16).
- **R1-c4 met.** `resizable` (primitive default, two handles); open width carried by `w-[min(42rem,95vw)]` (not a page-local `max-w`, which defeats the drag). `A9-C4-3` + extended `A9-C4-1` green.
- **R1-c5 met.** `groupUnassignedByRotationFamily` keys by `rotationTermGroupId ?? rotationFamily`; one row reads `Science (rotates): Chemistry T2, Earth Science T3`; non-rotating rows stay plain. Raw-code regex asserted over the **rendered** list (`a9-c5-unassigned-render`, new). `A9-C5-1` marked `SUPERSEDED (A9-c5 R1)` in place; A9-C5-2..4 kept; A9-C5-5..9 added. **Not re-opened:** X4/X5.

**Fails-first at `51c2f2c3`** (controls' own readings applied to the base blobs): card lacks the shared import, still prints `Regular Program` + pale chip; header width `200`; sheet `resizable={false}` + `max-w-2xl`; base lib lacks the family function and the sheet renders `cls.rotationFamily` / `identity.secondary`.

## Commands run — real tallies
- `npx tsc --noEmit -p tsconfig.json` → **5 pre-existing base reds only** (3× `playwright` absent in `timetable-post-deploy-c04/-c05`, `timetable-scheduling-quality-c03`; +1 implicit-any +1 comparison in `timetable-truth-labels-a2`) — **none in any touched file**.
- `npm run build` → **exit 0** (needs the documented `VITE_ENROLLPRO_URL` guard; set inline to `https://dev-jegs.buru-degree.ts.net`).
- `test:a9-c1-program-badges` **7/7** · `test:a9-c4-details-dialog` **3/3** · `test:a9-c5-unassigned-grouping` **9/9 + 1/1** · `test:a9-c6-room-receipt-undo` **4/4** · `test:a3-sections-map` **42/42** · `test:a3-c4-sections` **27/27** · `test:a9-c3-sections-rooms` **17/17** · `test:ux-guardrails` **31/31** · `a3-room-picker-rows-01-02` **10/10**.
- Zero-write: `a3-sections-map-home-room-persist` still dispatches **0 PUT on Cancel** (inside 42/42). Sub-11px: none in owned files. `SectionDetailsSheet.tsx`: zero `text-slate-900` / `text-slate-500`.

## Not caused by this candidate (pre-existing; my diff touches zero in-scope tokens — `git diff 51c2f2c3..HEAD` greps empty)
`test:ux-type-scale-a7c8` (`ManualEditConflictInspector.tsx` 9–10px sites), `test:a3-palette-token-sweep` (residual 93 vs pin 95), `test:a3-c9-operator-tokens` (97 vs pin 64). **BLOCKED rows: none.**

## Boundaries
No `atlas-server/**`, `prisma/**`, schema, migration, env, runtime, deploy, live DB, generation or publication; `live-state.md`/`CHANGELOG.md` untouched. No worktree created/removed; `node_modules` junction not installed into. Rendered acceptance (Tailnet origin asserted) is the planner's row; the only browser use here was an **isolated local** measurement of the built CSS to choose the column width — not acceptance evidence. Worktree disposition **`KEEP_ACTIVE`**. Non-blocking note: `vite build` regenerates its own temp/cache under the shared `node_modules` junction; no packages were installed or updated.
