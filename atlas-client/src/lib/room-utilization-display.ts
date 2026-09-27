/**
 * A3 (truthful numbers) — a room-utilisation figure is either MEASURED or
 * UNKNOWN, and the two must never render the same way.
 *
 * The recorded defect. `roomUtilization` is a `Map<number, number>` that is
 * populated only when `pivotDraftToView` returns `ok`:
 *
 * ```ts
 * if (!result.ok) continue;                        // no honest single-term %
 * utilization.set(room.id, Math.min(100, result.view.summary.utilizationPercent));
 * ```
 *
 * and the memo returns an EMPTY map outright when there is no schedule report
 * or the verified term index is unresolved. So a room with no entry is
 * "we could not compute this", never "this room is empty". Every read site then
 * wrote `?? 0`, which rendered a fail-closed refusal as a confident measured
 * `0%` — the exact class of fabrication the A3 ledger exists to remove, and it
 * was worse than a missing number because a zero is a claim.
 *
 * This module owns the tri-state so the six read sites (BuildingView 405/580,
 * CampusMapOverview 296/617/659/704, CampusReadinessCard 577/619/664) and the
 * duplicated map components cannot drift apart again. The underlying number,
 * `pivotDraftToView`, and `schedule-pivot.ts` are untouched: this changes how a
 * missing measurement is DISPLAYED, never what is measured.
 */

/** A utilisation reading for one room, with the unknown case kept explicit. */
export type RoomUtilizationReading =
	| { readonly kind: 'measured'; readonly percent: number }
	| { readonly kind: 'unknown' };

/** The honest, short wording for "no measurement exists". Used in DOM text,
 *  where there is room for words. */
export const ROOM_UTILIZATION_UNKNOWN_LABEL = 'Not available';

/**
 * The compact form, for the Building-view room card only.
 *
 * `ROOM_UTILIZATION_TEXT_BOX` is 36x14 stage units at `ROOM_LABEL_FONT` 11 and
 * is frozen — other work depends on its geometry — so a two-word label would
 * wrap out of its own box and collide with the program badge beside it. The
 * card is a dense scan surface whose full-detail surface is its hover layer, so
 * `n/a` (a token, not a figure) is the honest short marker here. A measured zero
 * still renders `0%`, so the two remain distinguishable at a glance.
 */
export const ROOM_UTILIZATION_UNKNOWN_LABEL_COMPACT = 'n/a';

/** Neutral grey for an unknown readout. Deliberately NOT produced by
 *  `roomUtilizationColor`, whose green-at-zero is a measured-zero signal and
 *  must stay that way. Matches the muted grey already used on the empty-floor
 *  marker in the same canvas. */
export const ROOM_UTILIZATION_UNKNOWN_FILL = '#9ca3af';

/**
 * Read one room's utilisation without collapsing the unknown case into a zero.
 *
 * `Map.get` returning `undefined` is the unknown case. A stored `0` is a real
 * measurement and is returned as one.
 */
export function readRoomUtilization(
	map: ReadonlyMap<number, number> | null | undefined,
	roomId: number,
): RoomUtilizationReading {
	const raw = map?.get(roomId);
	// `Number.isFinite` also rejects a stored NaN, which would otherwise render
	// as the string "NaN%" rather than as an honest unknown.
	if (raw == null || !Number.isFinite(raw)) return { kind: 'unknown' };
	return { kind: 'measured', percent: raw };
}

/** True only when a measurement exists. Use this to decide whether a figure may
 *  be shown at all — never to infer that a figure is zero. */
export function isRoomUtilizationKnown(
	map: ReadonlyMap<number, number> | null | undefined,
	roomId: number,
): boolean {
	return readRoomUtilization(map, roomId).kind === 'measured';
}

/** `'62%'` when measured (including a genuine `0%`), `'Not available'` when not. */
export function roomUtilizationLabel(
	map: ReadonlyMap<number, number> | null | undefined,
	roomId: number,
): string {
	const reading = readRoomUtilization(map, roomId);
	return reading.kind === 'measured' ? `${Math.round(reading.percent)}%` : ROOM_UTILIZATION_UNKNOWN_LABEL;
}

/** The Building-view card form of {@link roomUtilizationLabel}. */
export function roomUtilizationCompactLabel(
	map: ReadonlyMap<number, number> | null | undefined,
	roomId: number,
): string {
	const reading = readRoomUtilization(map, roomId);
	return reading.kind === 'measured'
		? `${Math.round(reading.percent)}%`
		: ROOM_UTILIZATION_UNKNOWN_LABEL_COMPACT;
}

/**
 * Bar GEOMETRY only — 0 when unknown, because an unmeasured bar has no extent.
 *
 * This is deliberately not a figure: every caller must pair it with
 * {@link roomUtilizationLabel} so the empty track is read as "no measurement",
 * not as a measured zero. An unknown track is marked separately by the caller
 * (Konva: neutral fill + compact label; DOM: `data-utilization="unknown"` plus
 * a striped track).
 */
export function roomUtilizationBarPercent(
	map: ReadonlyMap<number, number> | null | undefined,
	roomId: number,
): number {
	const reading = readRoomUtilization(map, roomId);
	return reading.kind === 'measured' ? reading.percent : 0;
}

/**
 * The tri-state for "does this building have a timetable?", replacing
 * `some((room) => (map.get(room.id) ?? 0) > 0)`.
 *
 *  - `'scheduled'` — at least one room carries a measured figure above zero.
 *  - `'empty'`     — at least one room was measured and every one is zero: a
 *                    real "there is no timetable here" answer.
 *  - `'unknown'`   — nothing could be measured, so the map says nothing. The
 *                    pre-fix code folded this into "no timetable", which is a
 *                    claim the data does not support.
 */
export type BuildingScheduleState = 'scheduled' | 'empty' | 'unknown';

export function buildingScheduleState(
	map: ReadonlyMap<number, number> | null | undefined,
	roomIds: readonly number[],
): BuildingScheduleState {
	let measured = 0;
	for (const roomId of roomIds) {
		const reading = readRoomUtilization(map, roomId);
		if (reading.kind !== 'measured') continue;
		measured += 1;
		if (reading.percent > 0) return 'scheduled';
	}
	return measured > 0 ? 'empty' : 'unknown';
}

/**
 * The utilisation colour ramp, moved here verbatim.
 *
 * `getUtilizationColor` was byte-identical in `BuildingView`,
 * `campus-map/CampusMapOverview` and `dashboard/CampusReadinessCard` (the same
 * 16-line body, verified by hash before the move). The thresholds, the
 * interpolation and the signature are unchanged; only the location moved, so
 * the three duplicated components cannot drift apart. The unit control pins the
 * exact output at and around both knees.
 */
export function roomUtilizationColor(pct: number): string {
	const clamped = Math.max(0, Math.min(100, pct));
	if (clamped <= 50) {
		const ratio = clamped / 50;
		const r = Math.round(34 + (234 - 34) * ratio);
		const g = Math.round(197 + (179 - 197) * ratio);
		const b = Math.round(94 + (8 - 94) * ratio);
		return `rgb(${r},${g},${b})`;
	} else {
		const ratio = (clamped - 50) / 50;
		const r = Math.round(234 + (220 - 234) * ratio);
		const g = Math.round(179 + (38 - 179) * ratio);
		const b = Math.round(8 + (38 - 8) * ratio);
		return `rgb(${r},${g},${b})`;
	}
}
