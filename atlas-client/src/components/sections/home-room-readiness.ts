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
 * `!resolved` is a strict SUPERSET of `!homeRoomId` (an absent ID also fails
 * to resolve), so the "missing" filter only ever GAINS the dangling-ID rows and
 * never drops one it used to show.
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
