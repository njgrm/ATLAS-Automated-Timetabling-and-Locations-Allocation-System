/**
 * A3 C4 (defect A) — ONE home-room truth for the Sections page.
 *
 * THE RECORDED DEFECT (Lane C, live walkthrough #8 on d31bfacb, 2026-09-28):
 * the stat tile read "HOME ROOMS 20/20" while five rows on the same screen read
 * "Needs home room. Choose a room."
 *
 * Two different definitions of "this section has a home room" were live at
 * once:
 *
 *   - `pages/Sections.tsx` counted `list.filter(s => !!s.homeRoomId).length` —
 *     an ID is *present*.
 *   - `components/sections/SectionRow.tsx` (and `SectionMobileCard.tsx`)
 *     decided with `homeRoomOptions.find((room) => room.id ===
 *     section.homeRoomId)` — the ID *resolves to a nameable room*.
 *
 * A `homeRoomId` pointing at a stale or deleted room, a room outside the
 * current scope, or a room list that has not loaded, is therefore counted as
 * ASSIGNED by the tile and as NEEDING a room by the row.
 *
 * THE LOAD-BEARING DECISION: the ROW's question is the honest one, so the
 * COUNTER adopts it — not the other way round. A `homeRoomId` that resolves to
 * no nameable room is not a usable home room: the operator is told to choose
 * one, and the row is where the operator acts. Making the row print a dangling
 * ID instead would be strictly worse, because it would show an operator a room
 * they cannot select and cannot see the name of.
 *
 * This module is the single place that question is asked. `Sections.tsx` (the
 * stat tile, the banner count, the home-room filter) and both row renderers
 * all import from here, so they cannot drift apart again. Re-deriving
 * `!!section.homeRoomId` or an inline `.find(...)` truth test at a call site is
 * the defect, and `a3-c4-home-room-truth.test.ts` fails on it.
 */
import type { RoomOption } from './SectionRoomPicker';

/** The only section fields this contract needs — keeps fixtures honest. */
export type HomeRoomBearing = { homeRoomId?: number | null };

export type HomeRoomReadiness = {
	/**
	 * The number of sections whose `homeRoomId` resolves to a room in
	 * `homeRoomOptions`. This is the ONLY definition of "assigned".
	 */
	assigned: number;
	/** The same array's length. The fraction's numerator and denominator come from here. */
	total: number;
	/** `total - assigned`, floored at 0. */
	needing: number;
	/** `assigned / total` as a whole percentage; 0 when the list is empty. */
	assignmentPct: number;
};

/**
 * The one truth: does this section's `homeRoomId` resolve to a room the
 * operator can actually be shown and select?
 *
 * Returns the resolved room, or `null`. `null` is returned for BOTH "no
 * `homeRoomId`" and "a `homeRoomId` that names no room in the current options"
 * — the two cases are the same truth to the operator, and the row's
 * "Needs home room" message is correct in both.
 *
 * A `null`/undefined `homeRoomId` is checked first and never reaches `.find`,
 * so a room whose `id` is somehow nullish can never satisfy it.
 */
export function resolveHomeRoom(
	section: HomeRoomBearing,
	homeRoomOptions: readonly RoomOption[],
): RoomOption | null {
	if (section.homeRoomId == null) return null;
	return homeRoomOptions.find((room) => room.id === section.homeRoomId) ?? null;
}

/** The boolean form of {@link resolveHomeRoom}, for call sites that only need the verdict. */
export function isHomeRoomResolved(
	section: HomeRoomBearing,
	homeRoomOptions: readonly RoomOption[],
): boolean {
	return resolveHomeRoom(section, homeRoomOptions) !== null;
}

/**
 * The counter for the stat tile, the start-here banner, and the home-room
 * filter.
 *
 * IMPORTANT — POPULATION: `total` is this list's own length, NOT a
 * server-declared section count. The tile used to build its fraction as
 * `assignedCount / state.data.totalSections`, pairing a count computed over the
 * client array with a denominator supplied by the server; the two agree today
 * only because the server happens to derive one from the other
 * (`atlas-server/src/services/section.service.ts:413` sets
 * `totalSections: sections.length`). That is an implementation detail of
 * another service, not a client invariant, and a fraction across two
 * populations is a fabrication the moment they diverge. Both ends now come
 * from the array that is actually rendered, so the fraction is arithmetic on
 * one list and the page has no way to display `20` beside `18/19`.
 *
 * The filter uses the same function, which is why the toolbar cannot show the
 * operator a row under "Assigned" that the row below then calls unresolved.
 * `!resolved` is a SUPERSET of `!homeRoomId` for every id >= 1 (an absent id
 * also fails to resolve), so the "missing" filter only ever GAINS the
 * dangling-ID rows and never drops one it used to show.
 *
 * CORRECTION (A3 C4 review, 2026-09-28): an earlier revision of this comment
 * claimed a STRICT superset with no qualification. That is literally false at
 * `homeRoomId === 0` — the old `!s.homeRoomId` test calls 0 "missing" (0 is
 * falsy) while `!isHomeRoomResolved(...)` calls it assigned IF any option
 * carries `id: 0`, so the row would move OUT of "missing" at that id alone.
 * `homeRoomId` is a Room foreign key whose ids are >= 1, and `0` is the
 * Global-Browse sentinel the page passes to the room map for a school-wide
 * browse rather than a section, so the divergent input is unreachable and the
 * behaviour is right. Only the comment overstated it; no behaviour changed.
 */
export function summarizeHomeRoomReadiness(
	sections: readonly HomeRoomBearing[],
	homeRoomOptions: readonly RoomOption[],
): HomeRoomReadiness {
	const total = sections.length;
	const assigned = sections.reduce(
		(count, section) => (isHomeRoomResolved(section, homeRoomOptions) ? count + 1 : count),
		0,
	);
	return {
		assigned,
		total,
		needing: Math.max(0, total - assigned),
		assignmentPct: total > 0 ? Math.round((assigned / total) * 100) : 0,
	};
}

/* ───────────────── the stat tile's own label / value / help text ───────────────── */

/**
 * The three strings the home-rooms stat tile PRINTS, derived from the same
 * {@link summarizeHomeRoomReadiness} snapshot the banner count and the filter
 * use. This is the function the A3 C4 control calls directly.
 *
 * WHY THE TILE'S PRINTING LIVES HERE (review finding B2, 2026-09-28): when the
 * label, the value and the help text were inlined in the page's `useMemo`, the
 * only thing guarding the HIGH truthfulness fix was a source-shape scan over
 * the page's text. That scan was defeated: a mutation that rebuilt the summary
 * from a plain "is a `homeRoomId` present" count contained the identifier
 * `homeRoomId` but matched none of the scan's boolean-coercion spellings, so
 * the whole suite stayed green (17/17, exit 0) while the tile printed
 * "Home rooms 3/3 (33%)" beside two rows reading "Needs home room".
 *
 * Moving the printing here makes the claim BEHAVIOURAL: a control calls this
 * function with a controlled list and asserts on what comes back. No identifier
 * spelling, import list or re-derivation on the page can satisfy it, because
 * the numbers it asserts are the numbers this function returned.
 *
 * The `readiness` argument is optional purely as an optimisation — the page
 * already holds the snapshot, so recomputing it would be wasted work. It is NOT
 * a second source of truth: every number printed below is read out of the
 * snapshot and never recomputed, so a caller cannot widen one end of the
 * fraction relative to the other by passing a mismatched list. Omit it and the
 * snapshot is derived from `sections` and `homeRoomOptions` here, which is how
 * the behavioural control calls it — one call, a fully controlled list, and no
 * hand-built snapshot a mutation could hide inside.
 */
export type HomeRoomsStat = {
	/** "Home rooms" once nothing needs one, otherwise "Need rooms". */
	label: string;
	/**
	 * Either the `assigned/total` fraction — whose BOTH ends come from
	 * `readiness.total` — or the bare `needing` count. Never a numerator and a
	 * denominator drawn from different populations.
	 */
	value: string | number;
	/** The stat tile's semantic tone for this state. */
	tone: 'success' | 'warning';
	/** The operator-facing explanation of what the number means. */
	helpText: string;
};

export function buildHomeRoomsStat(
	sections: readonly HomeRoomBearing[],
	homeRoomOptions: readonly RoomOption[],
	readiness: HomeRoomReadiness = summarizeHomeRoomReadiness(sections, homeRoomOptions),
): HomeRoomsStat {
	const { assigned, total, needing, assignmentPct } = readiness;
	// The fraction and the success tone require a NON-EMPTY roster as well as a
	// fully assigned one. `total > 0` is load-bearing: with an empty roster
	// `needing` is 0, so without it the tile would print a green "Home rooms
	// 0/0 (0%)" — a confident success claim about a list that does not exist.
	// The B2 control `an empty roster ... never as done` caught exactly this
	// when the control was first written, and it is why the guard is here
	// rather than an assumption.
	if (total > 0 && needing === 0) {
		return {
			label: 'Home rooms',
			// Both ends of this fraction are `readiness.total`'s own population.
			value: `${assigned}/${total}`,
			tone: 'success',
			helpText: `${assignmentPct}% of sections already have a home room.`,
		};
	}
	return {
		label: 'Need rooms',
		value: needing,
		tone: 'warning',
		helpText:
			'Assign these sections before schedule generation. A section counts as needing a room until its home room resolves to a room you can be shown.',
	};
}
