/**
 * A9 c8 R1 (QA F-A) — WHAT A DASHBOARD FIGURE MAY PRINT, as one pure rule.
 *
 * A figure is printed only when a MEASURED value exists behind it. Four things mean there is
 * not one, and all four used to print a number:
 *   · `loading`           — nothing has arrived yet. `…`
 *   · `reading`           — the readiness read is in flight. `—`
 *   · `!available`        — the read answered and FAILED, or was never dispatched. `—`
 *   · `measured == null`  — the read answered and reported no value. `—`
 *
 * A MEASURED ZERO is not in that list: a school with 0 subjects, 0 teachers or 0 teaching
 * rooms prints `0`, because 0 is a fact. `null` is the absence of a fact. This is the
 * EVAL-C01 distinction the hook already draws (`null` never substitutes a synthetic `0`), and
 * this function is where it is drawn on screen.
 *
 * ── WHY IT IS ONE FUNCTION, IN A SHARED MODULE ──────────────────────────────────────────────
 * QA found `Teaching Rooms 0 of 0` on a screen reading "We could not confirm your school", and
 * re-rendering the fix showed the same fabrication in two more tiles (`Subjects 0`,
 * `Teachers 0`) and in the campus panel's own figure. Four hand-rolled ternaries is four
 * chances to get it wrong, and the one that got it wrong was the newest.
 *
 * It lives here rather than in `pages/Dashboard.tsx` because the campus panel
 * (`components/dashboard/CampusReadinessCard.tsx`) needs the same rule, and that component is
 * lazily imported BY the Dashboard — a page importing rule-from-a-component the page imports
 * is a cycle, and a copy of the rule is the defect this function exists to remove.
 */

/** The figure slot's four possible renderings. Named, so no call site invents its own. */
export const TILE_PENDING = '\u2026';
export const TILE_NO_FIGURE = '\u2014';

export function dashboardFigure(args: {
	loading: boolean;
	reading: boolean;
	available: boolean;
	measured: string | number | null | undefined;
}): string {
	if (args.loading) return TILE_PENDING;
	if (args.reading || !args.available || args.measured == null) return TILE_NO_FIGURE;
	return String(args.measured);
}
