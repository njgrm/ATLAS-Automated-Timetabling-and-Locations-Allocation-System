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
 * card is a dense scan surface, so `n/a` (a token, not a figure) is the honest
 * short marker here. A measured zero still renders `0%`, so the two remain
 * distinguishable at a glance.
 *
 * A3 c4 CORRECTION. This comment used to say the card's "full-detail surface is
 * its hover layer", so the token was left unlabelled. That was FALSE: the
 * Building view's hover room card showed Type and Capacity and never mentioned
 * use at all, so the full-detail surface of this figure was nowhere. Two things
 * changed — the hover card now carries a `Use` row (which is where "is this room
 * free?" is answered), and the toolbar legend
 * ({@link ROOM_UTILIZATION_UNKNOWN_LEGEND_TEXT}) is what names the token, since
 * a hover layer is mouse-only and this figure has to be legible without a mouse.
 */
export const ROOM_UTILIZATION_UNKNOWN_LABEL_COMPACT = 'n/a';

/** Neutral grey for an unknown readout. Deliberately NOT produced by
 *  `roomUtilizationColor`, whose green-at-zero is a measured-zero signal and
 *  must stay that way. Matches the muted grey already used on the empty-floor
 *  marker in the same canvas. */
export const ROOM_UTILIZATION_UNKNOWN_FILL = '#9ca3af';

/* ───────────────────────── the campus-map TILE, and the words for both ───────────────────────── */

/**
 * A3 c4 — `CampusMap` was the one duplicated map component `1e417694` never
 * converted, so it kept the pre-fix shape in full:
 *
 * ```tsx
 * const occupancy = buildingOccupancy?.get(b.id) ?? 0;
 * ...
 * text={`${Math.round(occupancy)}% FILLED`}
 * ```
 *
 * `buildingOccupancy` is OPTIONAL, and of its two callers only
 * `SectionRoomMapModal` supplies it — `timetable/CenterWorkspace` passes
 * nothing, so every wing rendered a confident `0% FILLED` for a building with a
 * full term of lessons in it. Supplying real data there is another lane's file;
 * making the absent case HONEST is this one, and it is what stops the next
 * release from fabricating a zero before that wiring lands.
 *
 * A `buildingOccupancy` entry is read exactly like a `roomUtilization` entry —
 * same `Map<number, number>` shape, same "absent means we could not compute
 * this" rule — so the three helpers below delegate to {@link readRoomUtilization}
 * rather than re-deriving the tri-state. They exist so `CampusMap` reads as a
 * building lookup instead of a room lookup on a building id.
 */

/** The measured tile label, unchanged from the pre-fix wording, so a real figure
 *  looks exactly as it did. Only the ABSENT case gained a new string. */
export const BUILDING_UTILIZATION_MEASURED_TILE_SUFFIX = 'FILLED';

/**
 * The unknown tile label. `USE N/A`, derived from
 * {@link ROOM_UTILIZATION_UNKNOWN_LABEL_COMPACT} so the map tile and the
 * Building-view card cannot word the same refusal differently.
 *
 * WHY NOT "Use: not available yet", which is the longer honest wording: the
 * tile draws a Konva `Text` with `width={b.width - 12}` inside a 12-unit-tall
 * group, and a Konva `Text` with a `width` WRAPS rather than overflows. A second
 * line at `fontSize 7` escapes the group and runs off the bottom of the
 * building, so the binding constraint is ONE line — and the narrowest real
 * building on the seeded campus is 180 units, a 168-unit track. At 7px bold a
 * sentence is unreadable anyway: this is a scan surface, and 7 characters
 * occupies the same optical slot as the `0% FILLED` it replaces.
 *
 * The words live in the DOM chrome instead — see
 * {@link ROOM_UTILIZATION_UNKNOWN_LEGEND_TEXT} — so a user who needs the
 * sentence has it without the canvas shrinking the font below the 7px floor or
 * the building boxes growing.
 */
export const BUILDING_UTILIZATION_UNKNOWN_TILE_LABEL = `USE ${ROOM_UTILIZATION_UNKNOWN_LABEL_COMPACT.toUpperCase()}`;

/**
 * The label the campus-map tile reads. The whole tile contract, in one place,
 * so a third map cannot invent its own wording the way `CampusMap` did.
 */
export function buildingOccupancyTileLabel(
	map: ReadonlyMap<number, number> | null | undefined,
	buildingId: number,
): string {
	const reading = readRoomUtilization(map, buildingId);
	return reading.kind === 'measured'
		? `${Math.round(reading.percent)}% ${BUILDING_UTILIZATION_MEASURED_TILE_SUFFIX}`
		: BUILDING_UTILIZATION_UNKNOWN_TILE_LABEL;
}

/** True only when a measurement exists. Never use this to infer a zero. */
export function isBuildingOccupancyKnown(
	map: ReadonlyMap<number, number> | null | undefined,
	buildingId: number,
): boolean {
	return readRoomUtilization(map, buildingId).kind === 'measured';
}

/** Bar GEOMETRY only — 0 when unknown, exactly as `roomUtilizationBarPercent`.
 *  Never render this as a figure; pair it with
 *  {@link buildingOccupancyTileLabel}. */
export function buildingOccupancyBarPercent(
	map: ReadonlyMap<number, number> | null | undefined,
	buildingId: number,
): number {
	const reading = readRoomUtilization(map, buildingId);
	return reading.kind === 'measured' ? reading.percent : 0;
}

/**
 * A3 c4 — what the two figures MEAN, in words, for the DOM chrome.
 *
 * `n/a` is honest but unlabelled, and it contradicted the tile's `0%` for the
 * same building. `ROOM_UTILIZATION_TEXT_BOX` is 36x14 stage units and frozen —
 * a two-word label would wrap out of its own box into the program badge — so the
 * words are placed where there is room for them: the toolbar, which is DOM and
 * not a canvas. Both surfaces read these two constants, so the legend and the
 * card cannot drift apart, and neither prints a number.
 */
export const ROOM_UTILIZATION_LEGEND_TEXT = 'Use = share of periods in use';

export const ROOM_UTILIZATION_UNKNOWN_LEGEND_TEXT =
	`"${ROOM_UTILIZATION_UNKNOWN_LABEL_COMPACT}" = use not available yet`;

/**
 * A3 c11 fix 7.1 — the fixed half of the meter's hover sentence. It is the
 * legend's own phrase ({@link ROOM_UTILIZATION_LEGEND_TEXT}) without the `=`, so
 * the toolbar and the hover card cannot describe "use" two different ways.
 */
export const ROOM_UTILIZATION_METER_SENTENCE_PREFIX = 'Share of periods in use';

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
 * A3 c11 fix 7.1 — the SENTENCE behind the vertical meter, in the operator's own
 * words ("`share of periods in use: X%`", and the zero case reading "0%" rather
 * than an empty slot).
 *
 * It is a separate function from {@link roomUtilizationLabel} rather than a new
 * argument, because the two answers are asked in two places: the figure belongs
 * in a `tabular-nums` cell, and the sentence does not. The unknown case reuses
 * the ONE unknown vocabulary this module already owns instead of inventing a
 * third wording, so a reader who has learned "not available" needs to learn
 * nothing new — and so `a3-c4-map-truth.test.ts`'s vocabulary ratchet, which
 * greps these files for stray utilisation wording, still passes.
 */
export function roomUtilizationMeterLabel(
	map: ReadonlyMap<number, number> | null | undefined,
	roomId: number,
): string {
	const reading = readRoomUtilization(map, roomId);
	return reading.kind === 'measured'
		? `${ROOM_UTILIZATION_METER_SENTENCE_PREFIX}: ${Math.round(reading.percent)}%`
		: `${ROOM_UTILIZATION_METER_SENTENCE_PREFIX}: ${ROOM_UTILIZATION_UNKNOWN_LABEL.toLowerCase()}`;
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
