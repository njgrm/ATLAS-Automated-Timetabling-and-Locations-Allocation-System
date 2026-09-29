/**
 * A5 C7 ITEM 44 (2026-09-29) — the subjects table's ACTION column, declared ONCE.
 *
 * ## The defect, from Lane C's staging walk
 *
 * `/subjects` scrolled, and the `ACTION` column header disappeared while the row
 * buttons it labels stayed. Codex reported it as "LIVE"; Lane C's second check
 * overruled that because Codex did not scroll. It is real, and it is a
 * STACKING bug, not a width bug.
 *
 * ## The root cause, in the actual cascade
 *
 * Before this file the table carried three independent numbers:
 *
 *   - `SubjectCatalogBody.tsx` — `<thead className="sticky top-0 z-10 …">`
 *   - `SubjectCatalogBody.tsx` — the `ACTION` `<th className="sticky right-0 z-20 …">`
 *   - `SubjectRow.tsx`        — each row's `<td className="sticky right-0 z-10 …">`
 *
 * `position: sticky` with `z-index` other than `auto` CREATES A STACKING
 * CONTEXT. So the `z-20` on the `ACTION` `<th>` was resolved INSIDE the `thead`'s
 * `z-10` context and could never lift that `th` out of it — raising a child's
 * `z-index` inside a parent context changes nothing outside that parent. The
 * `thead` as a whole sat at `z-10`, and so did every row's action `td`. Two
 * siblings at the same `z-index` paint in DOCUMENT ORDER, `tbody` comes after
 * `thead`, so **every row's action cell painted over the header's ACTION
 * column** the moment the list scrolled.
 *
 * The fix is therefore on the `thead`, not on the `th`: the header row must sit
 * at a `z-index` strictly ABOVE the body cells' `z-10`.
 *
 * ## What this file declares, and why it is not in `@/ui`
 *
 * Two facts must agree across two files, and the defect was that they did not:
 *
 * 1. **`SUBJECT_ACTION_COLUMN_Z`** — the header row's stacking level. It is
 *    above every body cell's `z-10` and nothing else in the table is sticky.
 * 2. **`SUBJECT_ACTION_COLUMN_WIDTH_CLASS`** — ONE fixed width for both the
 *    `<th>` and the `<td>`.
 *
 * They are declared here, in a module both files import, rather than in
 * `SubjectCatalogBody.tsx`, because `SubjectRow.tsx` is imported BY
 * `SubjectCatalogBody.tsx`; putting the token in the parent would make the child
 * import upward and create a cycle.
 *
 * They are deliberately NOT in `@/ui/picker-trigger` or another `@/ui` module.
 * §8 "One look per control" governs controls a scheduler OPERATES — a trigger
 * button, an input, a select. This is table chrome for one specific column of
 * one specific page, and it is not reusable by any other page. Moving it into
 * `@/ui` would make it look shared when it is not, which is the same defect in
 * the other direction.
 */

/**
 * The header row's stacking level.
 *
 * `30`, not `20`: it has to clear the body cells' `z-10` with room to spare, so
 * that a future body cell which raises its own `z` a step does not immediately
 * re-break the header. `AdminTableShell`'s pagination footer is `relative z-20`
 * and is a SIBLING of the scroll container that holds this table, so it still
 * paints above the whole table — the header row cannot cover the footer.
 */
export const SUBJECT_ACTION_COLUMN_Z = 'z-30';

/**
 * The ONE width for the action column, shared by the `<th>` and every `<td>`.
 *
 * `w-44` = 11rem = 176px, which is what the cell's contents need: a `size-8`
 * (`Review` + `Users` icon) and the `size-8` `More actions` icon button, their
 * `gap-2` between them, and `px-4` on each side. Before this the column was
 * content-sized, which meant the header label and the row buttons each decided
 * the column's width independently and the right-hand edge did not line up.
 *
 * `shrink-0` matters as much as the width: a `w-*` is a PREFERRED size, so
 * without it the table's own layout can squeeze the column and the fixed width
 * becomes decorative. `shrink-0` is what makes "the action column is 176px"
 * true.
 *
 * `px-4` is stated HERE rather than at each of the two call sites, so the
 * header's `Action` label and the row's buttons pad identically and their
 * right-hand edges line up as well as the column's outer edges do. It is
 * padding between the cell's edge and its content, not chrome on a control,
 * so §8 does not apply — and keeping it in this one constant is what stops the
 * two call sites from drifting apart again, which is the defect.
 */
export const SUBJECT_ACTION_COLUMN_WIDTH_CLASS = 'w-44 shrink-0 px-4';

/**
 * The body action cell's own `z-index`.
 *
 * UNCHANGED at `z-10`, and that is the point: the fix raised the header row
 * above it rather than lowering the cells. Lowering the cells would work too,
 * but it makes the two numbers depend on each other in the direction that
 * fails silently — a future cell with a dropdown or a popover inside it would
 * need a higher `z` than the header and would silently re-break it.
 */
export const SUBJECT_ACTION_CELL_Z = 'z-10';
