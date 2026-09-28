/**
 * A3 c11 — fix 7.1, RENDERED: the section-name pill shows the whole name, and
 * the vertical meter keeps a permanent track on EVERY room card.
 *
 * THE OPERATOR'S OWN REQUEST (fix-1.1.docx, fix 7.1), verbatim in intent:
 *   1. "so longer labels fit comfortably on one line without truncating (`...`)"
 *      — the observed case was `G9 Room 401` rendering `"Sampag..."`.
 *   2. "Add Permanent Subtle Background Track for Vertical Utilization Meters …
 *       render a permanent, soft neutral track across ALL room cards regardless
 *       of assigned status", because "Rooms like `G9 Room 402` and `G9 Room 403`
 *       must keep this soft track visible so users clearly recognize the meter
 *       slot", and a hover tooltip must state the status ("`0% periods used`" /
 *       "`share of periods in use: X%`").
 *
 * WHY THIS FILE RENDERS INSTEAD OF READING SOURCE. The defect is Konva's
 * `measureText`-driven ellipsis decision (`Text.js:400-419`) and the contrast of
 * a painted fill. Neither is visible in source, and the pre-existing controls
 * for this file are box models over exported constants — which is how the first
 * two attempts at this card passed while the live surface showed `G9 Room.`
 * (see `a3-sections-map-layout.test.ts`'s own fix-11 correction). So this file
 * mounts the REAL `BuildingView` through `react-konva` into jsdom with a canvas
 * sink, and asserts on what Konva painted. `konva-dom-render-harness.ts` states
 * exactly what is real in that setup and what is not; nothing below claims a
 * pixel, a scrollbar or a click.
 *
 * FAILING-FIRST, recorded rather than asserted: on the base revision this
 * harness painted
 *   ["Grade 9 Academic Wing","F1","G9 Room","401","Classroom","Sampag…","SPA",
 *    "60%","402","Capacity: 40","0%"]
 * i.e. the operator's `Sampag...` — Konva's ellipsis glyph is U+2026 — and the
 * room NAME needed two lines. Every row below states the base value it differs
 * from, and row 1 re-derives the base decision from the metrics so the control
 * is shown to discriminate rather than to agree.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
	measureArialText,
	renderKonva,
	setHostBox,
	setupKonvaDom,
} from './konva-dom-render-harness';

const { createElement, act } = await setupKonvaDom('https://njgrm.buru-degree.ts.net/sections');
const { BuildingView, ROOM_CARD_W, ROOM_LABEL_FONT, ROOM_NAME_BOX, ROOM_OCCUPANCY_BOX, ROOM_OCCUPANCY_TEXT_BOX, ROOM_UTILIZATION_BAR_BOX, ROOM_UTILIZATION_TRACK_FILL, ROOM_UTILIZATION_TRACK_RADIUS } =
	await import('@/components/BuildingView');
const { roomUtilizationMeterLabel, ROOM_UTILIZATION_METER_SENTENCE_PREFIX } =
	await import('@/lib/room-utilization-display');
type Building = import('@/types').Building;
type Room = import('@/types').Room;

const CLIENT_ROOT = resolve(import.meta.dirname, '../../..');

function room(id: number, name: string, over: Partial<Room> = {}): Room {
	return {
		id,
		name,
		type: 'CLASSROOM',
		capacity: 40,
		isTeachingSpace: true,
		floor: 1,
		floorPosition: id - 400,
		...over,
	} as Room;
}

/** The live `/sections` Assign Home Room shape: three rooms, one occupied. */
const BUILDING = {
	id: 1,
	name: 'Grade 9 Academic Wing',
	floorCount: 1,
	x: 0,
	y: 0,
	width: 100,
	height: 100,
	color: '#fff',
	rotation: 0,
	gradeScope: [],
	isTeachingBuilding: true,
	rooms: [
		room(401, 'G9 Room 401'),
		room(402, 'G9 Room 402'),
		room(403, 'G9 Room 403'),
	],
} as unknown as Building;

const SECTION = { sectionName: 'Sampaguita', gradeKey: '9', programCode: 'SPA' };

async function renderCard(utilization: Map<number, number>) {
	setHostBox({ width: 900, height: 520 });
	const out = await renderKonva(createElement, act, createElement(BuildingView, {
		building: BUILDING,
		fillAvailableHeight: true,
		roomSectionData: new Map([[401, SECTION]]),
		roomUtilization: utilization,
	} as never));
	assert.ok(out.drawCount > 0, 'precondition: Konva must actually have drawn');
	assert.ok(out.frameCount > 0, 'precondition: at least one complete scene pass must have been recorded');
	return out;
}

/* ── the metric, stated so the base failure is arithmetic, not opinion ─────── */

test('7.1: the pill is wider than the operator\'s worst name, and the base width was 0.35px short of it', () => {
	const font = `bold ${ROOM_LABEL_FONT}px Arial`;
	const name = SECTION.sectionName;
	const namePx = measureArialText(name, font);
	const namePlusEllipsisPx = measureArialText(`${name}\u2026`, font);

	// Konva keeps a line whole only when `measureText(line + '\u2026') < maxWidth`
	// (Text.js:411-413), and only tries the line at all when it is wider than
	// `maxWidth` (Text.js:318). Both conditions are evaluated, not assumed.
	const baseLabelWidth = 62; // ROOM_OCCUPANCY_BOX.width (70) - 8, on the base
	assert.ok(namePx > baseLabelWidth, `precondition: the base pill was short by ${(namePx - baseLabelWidth).toFixed(2)}px`);
	assert.ok(namePlusEllipsisPx > baseLabelWidth, 'precondition: the base could not have kept the name plus its ellipsis either');

	// The committed label box must clear the NAME, which is the condition the
	// operator asked for; the ellipsis test is reported, not required, so a
	// future 1px-shorter name cannot be mistaken for a regression here.
	const committed = ROOM_OCCUPANCY_TEXT_BOX.width;
	assert.ok(
		committed > namePx,
		`the committed pill affords ${committed}px but "${name}" needs ${namePx.toFixed(2)}px`,
	);
	assert.ok(
		ROOM_OCCUPANCY_TEXT_BOX.x + committed <= ROOM_OCCUPANCY_BOX.width,
		'the label must stay inside its own chip',
	);
	assert.ok(committed >= namePx, `slack is ${(committed - namePx).toFixed(2)}px`);
});

/* ── the visible result, decided by Konva's own paint ──────────────────────── */

test('7.1 RENDERED: the section pill paints the WHOLE name, not `Sampag…`', async () => {
	const out = await renderCard(new Map([[401, 60], [402, 0], [403, 0]]));
	try {
		assert.ok(
			out.paintedText.includes('Sampaguita'),
			`the card must paint the whole section name; painted: ${JSON.stringify(out.paintedText)}`,
		);
		assert.ok(
			!out.paintedText.some((t) => /Sampag[\u2026.]/.test(t)),
			`the reported truncation must be gone; painted: ${JSON.stringify(out.paintedText)}`,
		);
	} finally {
		out.unmount();
	}
});

test('7.1 RENDERED: the pill treatment is uniform — every section chip, every floor', async () => {
	// The fix says "Apply this sizing uniformly to all section chips across
	// every floor (e.g. Tulip, Orchid, Rose)". One code path renders them, so the
	// uniform claim is only real if each of those names survives the SAME
	// committed geometry. Driven through a real render, not a source read.
	const names = ['Sampaguita', 'Tulip', 'Orchid', 'Rose'];
	for (const name of names) {
		setHostBox({ width: 900, height: 520 });
		const out = await renderKonva(createElement, act, createElement(BuildingView, {
			building: { ...BUILDING, rooms: [room(401, 'G9 Room 401')] } as unknown as Building,
			fillAvailableHeight: true,
			roomSectionData: new Map([[401, { sectionName: name, gradeKey: '9', programCode: 'SPA' }]]),
			roomUtilization: new Map([[401, 40]]),
		} as never));
		try {
			assert.ok(
				out.paintedText.includes(name),
				`"${name}" must paint in full; painted: ${JSON.stringify(out.paintedText)}`,
			);
			assert.ok(
				measureArialText(name, `bold ${ROOM_LABEL_FONT}px Arial`) <= ROOM_OCCUPANCY_TEXT_BOX.width,
				`"${name}" must fit the committed pill`,
			);
		} finally {
			out.unmount();
		}
	}
});

/* ── the permanent meter track ────────────────────────────────────────────── */

/** WCAG relative luminance of a #rrggbb / #rgb colour. */
function luminance(hex: string): number {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
	assert.ok(m, `not a #rrggbb colour: ${hex}`);
	const int = Number.parseInt(m![1], 16);
	const channel = (shift: number) => {
		const c = (int >> shift) & 0xff;
		const s = c / 255;
		return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
}
const contrast = (a: string, b: string): number => {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
};

test('7.1 RENDERED: EVERY room card fills the meter track, including the empty rooms', async () => {
	const out = await renderCard(new Map([[401, 60], [402, 0], [403, 0]]));
	try {
		// A track is the one filled shape carrying the track's fill at the bar's
		// aspect ratio. The base ALSO painted a track on every card, so PRESENCE is
		// not what the operator's complaint is about — VISIBILITY is, and the
		// contrast row below decides that. This row pins presence so the two
		// halves cannot be quietly swapped for one another.
		const tracks = out.fills.filter((f) => f.fill === ROOM_UTILIZATION_TRACK_FILL);
		assert.equal(
			tracks.length,
			3,
			`one track per room card is required (3 cards: one occupied, two empty); found ${tracks.length} in ${JSON.stringify(out.fills)}`,
		);
		// Read at the RENDERED scale, not the authored one: the Stage auto-fits the
		// building, so the bar is 10x62 stage units but paints at
		// 10*s x 62*s device units. The aspect ratio is what identifies the shape
		// without re-deriving the fit scale, and it is the ratio a real
		// 10x62 (or `rounded-full`) box keeps under uniform scale.
		const [first, ...rest] = tracks;
		const scale = first.width / ROOM_UTILIZATION_BAR_BOX.width;
		assert.ok(scale > 0, 'the track must have been painted with a positive width');
		for (const [index, track] of tracks.entries()) {
			assert.ok(
				Math.abs(track.height / ROOM_UTILIZATION_BAR_BOX.height - scale) < 1e-6,
				`track ${index} must keep the bar's aspect ratio; got ${track.width}x${track.height}`,
			);
		}
		// The cards are laid out on a fixed pitch, so three tracks on three cards
		// must be evenly spaced by exactly that pitch at the rendered scale. This
		// is what makes "one per card" a claim about the LAYOUT rather than about
		// three coincidental fills.
		const gap = tracks[1].x - tracks[0].x;
		assert.ok(Math.abs((tracks[2].x - tracks[1].x) - gap) < 1e-6, 'the three tracks must be evenly spaced, one per card');
		// Three evenly spaced tracks, each wider apart than one card, are three
		// CARDS and not three fills on one card. The exact pitch is not asserted
		// here: the card gap is module-private, and `a3-sections-map-layout.test.ts`
		// already pins the whole card grid (90 + 4) as a cross-lane contract, so a
		// second copy of that number in this file could only drift from it.
		assert.ok(gap > ROOM_CARD_W * scale, 'the tracks must be on separate cards, not stacked on one');
		// The two rooms the operator named as showing NO track are 402 and 403, to
		// the right of the occupied 401, so their tracks are the last two and they
		// carry no inner fill.
		assert.ok(tracks[1].x > tracks[0].x && tracks[2].x > tracks[1].x, 'the empty rooms tracks must sit right of the occupied room');
		// The fix replaces a "harsh border outline", so the track is a FILL and
		// never a STROKE. A shape Konva only fills produces no stroke call at all,
		// so this is decidable from the render rather than from the source.
		for (const [index, track] of tracks.entries()) {
			const stroked = out.strokes.some(
				(s) => Math.abs(s.x - track.x) < 1e-6 && Math.abs(s.y - track.y) < 1e-6
					&& Math.abs(s.width - track.width) < 1e-6 && Math.abs(s.height - track.height) < 1e-6,
			);
			assert.equal(stroked, false, `track ${index} must not be stroked — the fix replaces a harsh border outline`);
		}
		// And the occupied room really does carry an inner fill the empties do not,
		// so "the track is permanent" and "the fill is the measurement" stay
		// separable — the base conflated them by hiding the track entirely.
		const fillsPerTrack = tracks.map((track) => out.fills.filter(
			(f) => f.fill !== ROOM_UTILIZATION_TRACK_FILL
				&& f.x >= track.x - 1e-6 && f.x < track.x + track.width + 1e-6
				&& f.y >= track.y - 1e-6 && f.y < track.y + track.height + 1e-6,
		).length);
		assert.equal(fillsPerTrack[0], 1, 'the occupied room must paint an inner utilisation fill');
		assert.deepEqual(fillsPerTrack.slice(1), [0, 0], 'a measured 0% must paint the track and no fill');
	} finally {
		out.unmount();
	}
});

test('7.1: the track is a VISIBLE soft neutral, which the base track was not', () => {
	// The base painted slate-100 `#f1f5f9`; ROOM_FILLS.CLASSROOM.bg is `#eff6ff`.
	// That is 1.01:1 — the same colour to the eye, which is the whole defect.
	assert.equal(contrast('#f1f5f9', '#eff6ff').toFixed(2), '1.01', 'precondition: the base track was invisible on a classroom card');
	assert.equal(contrast('#f1f5f9', '#fff1f2').toFixed(2), '1.00', 'precondition: and invisible on a faculty-room card too');

	// Decided against the palette's own extremes, so the row cannot pass by
	// being visible against only one card fill.
	for (const [label, cardFill] of [['CLASSROOM', '#eff6ff'], ['FACULTY_ROOM', '#fff1f2'], ['GYMNASIUM', '#ecfdf5']] as const) {
		const ratio = contrast(ROOM_UTILIZATION_TRACK_FILL, cardFill);
		assert.ok(
			ratio >= 1.25,
			`the track must be recognisable on a ${label} card: ${ratio.toFixed(2)}:1 against ${cardFill}`,
		);
		assert.ok(
			ratio <= 3,
			`the track must stay SOFT, not become a border: ${ratio.toFixed(2)}:1 against ${cardFill}`,
		);
	}
	// And it is a pill, not a stroked rectangle: `rounded-full` on a 10-unit
	// column is exactly half the width, which is what the render passes.
	assert.equal(ROOM_UTILIZATION_TRACK_RADIUS, ROOM_UTILIZATION_BAR_BOX.width / 2);
});

/* ── the meter tooltip, in the operator's words ────────────────────────────── */

test('7.1: the hover sentence is the operator\'s own wording, for zero and for a share', () => {
	assert.equal(ROOM_UTILIZATION_METER_SENTENCE_PREFIX, 'Share of periods in use');
	// The zero case must read as a measured zero, not as an absent widget: the
	// operator asked for `"0% periods used"` on the empty rooms.
	assert.equal(roomUtilizationMeterLabel(new Map([[402, 0]]), 402), 'Share of periods in use: 0%');
	assert.equal(roomUtilizationMeterLabel(new Map([[401, 62]]), 401), 'Share of periods in use: 62%');
	// The unknown case keeps the module's own vocabulary; it must NOT read "0%".
	assert.equal(roomUtilizationMeterLabel(new Map(), 402), 'Share of periods in use: not available');
	assert.notEqual(roomUtilizationMeterLabel(new Map(), 402), 'Share of periods in use: 0%');
});

/* ── a bonus the widening delivered, pinned so it cannot silently regress ──── */

test('7.1 RENDERED: the room NAME now fits one line, which the base could not do', async () => {
	// `G9 Room 401` is 70.30px at Arial Bold 11px — wider than the base 70-unit
	// name box, so the base wrapped it to "G9 Room" / "401" (visible in the
	// recorded base paint above). The same 4 units released to the text column
	// clear it. This row is not part of the operator's request; it is pinned
	// because a future narrowing of the column would quietly bring the two-line
	// wrap back and this control is the thing that would notice.
	const out = await renderCard(new Map([[401, 60]]));
	try {
		assert.ok(
			out.paintedText.includes('G9 Room 401'),
			`the room name must paint on one line; painted: ${JSON.stringify(out.paintedText)}`,
		);
		assert.ok(
			measureArialText('G9 Room 401', `bold ${ROOM_LABEL_FONT}px Arial`) < ROOM_NAME_BOX.width,
			'the metric precondition must hold against the COMMITTED name box, not a literal copied beside it',
		);
	} finally {
		out.unmount();
	}
});
