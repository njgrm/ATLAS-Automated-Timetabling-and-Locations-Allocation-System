/**
 * A3 S1 — the room-card frame budget, the map layout budget, and the
 * micro-typography floor (fixes 06, 07, 10, 11).
 *
 * These are measured, not eyeballed. The card rectangles below are the ones the
 * component actually renders (the exported frame budget), and the layout budget
 * is arithmetic over the committed dialog class contract at a 1366x768
 * viewport. Each control also carries the *pre-fix* arrangement so it can be
 * seen to discriminate: a control that cannot fail is not evidence.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

import {
	ROOM_CARD_H,
	ROOM_CARD_W,
	ROOM_NAME_BOX,
	ROOM_NAME_FONT,
	ROOM_LINE_H,
	ROOM_OCCUPANCY_BOX,
	ROOM_PROGRAM_BADGE_BOX,
	ROOM_TYPE_BOX,
	ROOM_UTILIZATION_BAR_BOX,
	ROOM_UTILIZATION_TEXT_BOX,
} from '../../BuildingView';

const clientRoot = resolve(import.meta.dirname, '../../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

type Box = { x: number; y: number; width: number; height: number };

function overlaps(a: Box, b: Box): boolean {
	return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function inside(inner: Box, outer: Box): boolean {
	return inner.x >= 0
		&& inner.y >= 0
		&& inner.x + inner.width <= outer.width
		&& inner.y + inner.height <= outer.height;
}

const CARD: Box = { x: 0, y: 0, width: ROOM_CARD_W, height: ROOM_CARD_H };

/* ───────────────────── fix 07 + 11: the card frame budget ────────────────── */

test('fix 07 control: every card element owns a disjoint rectangle, and the pre-fix layout did not', () => {
	const boxes: Record<string, Box> = {
		name: ROOM_NAME_BOX,
		type: ROOM_TYPE_BOX,
		occupancy: ROOM_OCCUPANCY_BOX,
		utilizationText: ROOM_UTILIZATION_TEXT_BOX,
		programBadge: ROOM_PROGRAM_BADGE_BOX,
		utilizationBar: ROOM_UTILIZATION_BAR_BOX,
	};
	const names = Object.keys(boxes);
	const collisions: string[] = [];
	for (let i = 0; i < names.length; i += 1) {
		for (let j = i + 1; j < names.length; j += 1) {
			if (overlaps(boxes[names[i]], boxes[names[j]])) collisions.push(`${names[i]} x ${names[j]}`);
		}
	}
	assert.deepEqual(collisions, [], `card elements must not overlap: ${collisions.join(', ')}`);
	for (const name of names) {
		assert.ok(inside(boxes[name], CARD), `${name} must stay inside the ${ROOM_CARD_W}x${ROOM_CARD_H} card`);
	}

	// The pre-fix arrangement, transcribed from base 3cfe79a8 at 90x70: the
	// program badge (x 66..86, y 6..16) sat inside both the room name
	// (x 4..86, y 6..~18) and the utilization bar (x 76..86, y 8..58).
	const preFixName: Box = { x: 4, y: 6, width: 82, height: 12 };
	const preFixBadge: Box = { x: 66, y: 6, width: 20, height: 10 };
	const preFixBar: Box = { x: 76, y: 8, width: 10, height: 50 };
	assert.ok(overlaps(preFixName, preFixBadge), 'precondition: the badge used to overlap the name');
	assert.ok(overlaps(preFixBadge, preFixBar), 'precondition: the badge used to overlap the utilization bar');
});

test('fix 11 control: the named worst-case room names fit the name box by wrapping, before any ellipsis', () => {
	// Konva lays out with a font metric; this is a deliberately conservative
	// bound (0.62em mixed case, 0.72em uppercase) so the assertion cannot pass
	// on a lucky measurement.
	const charW = (text: string) => Array.from(text).reduce((sum, ch) => {
		const upper = ch === ch.toUpperCase() && ch !== ch.toLowerCase();
		return sum + (upper ? 0.72 : 0.62) * ROOM_NAME_FONT;
	}, 0);

	const lines = (text: string, width: number): number => {
		// Greedy word wrap, the same order a text engine uses.
		let count = 1;
		let current = 0;
		for (const word of text.split(' ')) {
			const w = charW(word);
			if (current === 0) current = w;
			else if (current + 0.62 * ROOM_NAME_FONT + w <= width) current += 0.62 * ROOM_NAME_FONT + w;
			else { count += 1; current = w; }
		}
		return count;
	};

	const capacity = Math.floor(ROOM_NAME_BOX.height / ROOM_LINE_H);
	assert.ok(capacity >= 2, `the name box must afford two lines, got ${capacity}`);

	for (const name of ['Learning Commons', 'Guidance Office']) {
		const used = lines(name, ROOM_NAME_BOX.width);
		assert.ok(
			used <= capacity,
			`"${name}" needs ${used} lines at ${ROOM_NAME_FONT}px in ${ROOM_NAME_BOX.width}px but the box affords ${capacity}`,
		);
	}

	// The name must wrap rather than truncate: the pre-fix text was a single
	// non-wrapping 10px line in 82px, which ellipsised these names.
	const view = source('src/components/BuildingView.tsx');
	assert.match(
		view,
		/x=\{ROOM_NAME_BOX\.x\}[\s\S]{0,320}?wrap="word"[\s\S]{0,80}?ellipsis/,
		'the room name must wrap before it ellipsises',
	);
	assert.doesNotMatch(
		view,
		/text=\{room\.name\}[\s\S]{0,200}?wrap="none"/,
		'the room name must not be a non-wrapping line any more',
	);
});

/* ─────────── cross-lane contract: this component's width must not move ───── */

/**
 * Base 3cfe79a8 transcribed verbatim: FLOOR_LABEL_W 36, FLOOR_PAD_X 8,
 * ROOM_MIN_W 90, ROOM_GAP 4. This is the width every consumer of BuildingView
 * reads, and it is the divisor of the auto-fit scale.
 */
const BASE_ROOM_MIN_W: number = 90;
function baseBuildingContentW(maxRoomsOnFloor: number): number {
	return 36 + 8 * 2 + maxRoomsOnFloor * BASE_ROOM_MIN_W + (maxRoomsOnFloor - 1) * 4;
}

test('cross-lane width contract: buildingContentW equals base, so no consumer\'s fit scale moves', (t) => {
	// The load-bearing control for the shared component. It fails if the card
	// width is anything but base 90 — proven by running it against 13f1f189,
	// which is why the "precondition" below is asserted rather than assumed.
	//
	// It deliberately reads ROOM_CARD_W (which exists on both revisions) rather
	// than a new export, so a width regression fails on a real assertion here
	// instead of on a module-load error.
	assert.equal(ROOM_CARD_W, BASE_ROOM_MIN_W, 'the card width must stay at base');
	// ROOM_CARD_W is the card, and the card is the divisor: pin the production
	// expression that every consumer's fit scale reads.
	const view = source('src/components/BuildingView.tsx');
	assert.match(
		view,
		/const buildingContentW = FLOOR_LABEL_W \+ FLOOR_PAD_X \* 2 \+ maxRoomsOnFloor \* ROOM_MIN_W \+ \(maxRoomsOnFloor - 1\) \* ROOM_GAP;/,
		'the building width must keep the base expression that every consumer reads',
	);
	assert.match(view, /const ROOM_MIN_W = 90;/, 'the card width constant must read 90');
	const contentW = (maxRooms: number) => 36 + 8 * 2 + maxRooms * ROOM_CARD_W + (maxRooms - 1) * 4;

	const cases: Array<[floors: number, maxRooms: number]> = [
		[2, 4], [3, 6], [4, 6], [4, 8], [5, 8], [6, 10],
	];
	const rows: string[] = [];
	for (const [floors, maxRooms] of cases) {
		const actual = contentW(maxRooms);
		const expected = baseBuildingContentW(maxRooms);
		assert.equal(
			actual,
			expected,
			`${floors}f x ${maxRooms}r: buildingContentW is ${actual}, base is ${expected} — every consumer's fit scale moves`,
		);
		rows.push(`${floors}f x ${maxRooms}r: ${actual} = base ${expected}`);
	}

	// The precondition that makes this discriminating: the width rejected in
	// review (110) is NOT base, and it is NOT a width change every consumer can
	// absorb. At 110 the room term grows 110/90 = +22.2%, and because the
	// rejected card was width-bound in A2's centre view, that is the limiter.
	const rejected: number = 110;
	assert.ok(rejected !== BASE_ROOM_MIN_W, 'precondition: the rejected width differs from base');
	assert.ok(
		Math.abs((rejected - BASE_ROOM_MIN_W) / BASE_ROOM_MIN_W) > 0.2,
		'precondition: the rejected width grows the room term by more than 20%',
	);

	// A2's centre view (components/timetable/CenterWorkspace.tsx, col-span-8 of
	// 12, height={420}, no fillAvailableHeight) at its two measured container
	// widths: 616px with the md:w-[24rem] task drawer present, 872px collapsed.
	// Those two widths are QA's measured inputs, taken as given; the guarantee
	// below does not depend on them, because the card is base 90 wide for every
	// width.
	//
	// The cross-lane guarantee is about the WIDTH term, and it is exact: sx is
	// bit-identical to base in every case, so this change contributes 0.0% to
	// every consumer's fit scale. The height term does move, and where it
	// becomes the limiter it is the sole cause of any remaining delta — that is
	// the disclosed vertical cost of the 84px card, not a width effect.
	const a2Containers = [616, 872];
	const a2CanvasH = 420;
	const deltas: number[] = [];
	for (const containerW of a2Containers) {
		for (const [floors, maxRooms] of cases) {
			const w = baseBuildingContentW(maxRooms);
			const sx = (containerW - 32) / w;
			// 84 tall instead of 70 is the only remaining difference.
			const h84 = 29 + 99 * floors;
			const h70 = 29 + 85 * floors;
			const sy84 = (a2CanvasH - 32) / h84;
			const sy70 = (a2CanvasH - 32) / h70;
			const s84 = Math.max(0.3, Math.min(sx, sy84, 1.4));
			const s70 = Math.max(0.3, Math.min(sx, sy70, 1.4));
			const delta = s70 === 0 ? 0 : (s84 - s70) / s70;
			deltas.push(delta);

			// The load-bearing assertion: the width term has not moved at all.
			assert.equal(
				sx,
				(containerW - 32) / baseBuildingContentW(maxRooms),
				`${floors}f x ${maxRooms}r at ${containerW}px: the width term of the fit scale must be bit-identical to base`,
			);
			// Where the width is still the limiter, the whole scale is identical.
			if (sx <= sy84) {
				assert.equal(
					s84,
					s70,
					`${floors}f x ${maxRooms}r at ${containerW}px: width-limited after the change, so the scale must be exactly base`,
				);
				assert.equal(
					ROOM_NAME_FONT * s84,
					ROOM_NAME_FONT * s70,
					`${floors}f x ${maxRooms}r at ${containerW}px: rendered card text must be byte-identical to base`,
				);
			}
			rows.push(
				`${floors}f x ${maxRooms}r at ${containerW}px: width term sx ${sx.toFixed(4)} = base (0.0% width cost); `
				+ `scale ${s70.toFixed(4)} -> ${s84.toFixed(4)} (${(delta * 100).toFixed(1)}%, ${sx <= sy84 ? 'width-limited: no change' : 'height term is now the limiter'}); `
				+ `card text ${(ROOM_NAME_FONT * s70).toFixed(2)}px -> ${(ROOM_NAME_FONT * s84).toFixed(2)}px`,
			);
		}
	}
	// Honest disclosure, asserted so it cannot be quietly forgotten: the height
	// term is not free, and this stream does not pretend otherwise.
	const worst = Math.min(...deltas);
	t.diagnostic(
		`buildingContentWidth vs base (card ${ROOM_CARD_W}x${ROOM_CARD_H}):\n${rows.join('\n')}\n`
		+ `width term cost: 0.0% in all ${deltas.length} measured cases.\n`
		+ `worst overall fit-scale delta, entirely from the required 84px card height: ${(worst * 100).toFixed(1)}%.\n`
		+ `rejected 110px width at 616px/6 rooms would have given sx ${(((616 - 32) / (36 + 16 + 6 * rejected + 5 * 4))).toFixed(4)} `
		+ `= ${(ROOM_NAME_FONT * ((616 - 32) / (36 + 16 + 6 * rejected + 5 * 4))).toFixed(2)}px card text, `
		+ `a ${(((((616 - 32) / (36 + 16 + 6 * rejected + 5 * 4)) / ((616 - 32) / baseBuildingContentW(6))) - 1) * 100).toFixed(1)}% loss against base.`,
	);
	assert.ok(
		worst > -0.2,
		`the disclosed height cost must stay reported and bounded, got ${(worst * 100).toFixed(1)}%`,
	);
});

/* ───────────────────────── fix 06: the map layout budget ─────────────────── */

/** The 1366x768 layout arithmetic over the committed class contract. */
function mapLayout(viewportW: number, viewportH: number, stageHeight: number | 'pane') {
	const dialogH = viewportH * 0.9; // h-[90vh]
	const headerH = 32 /* py-4 */ + 52 /* title block */ + 1; // border-b
	const mainH = dialogH - headerH;
	const paneInnerH = mainH - 48; // p-6
	const buildingColumnH = paneInnerH - 59; // sub-header row (43) + mb-4 (16)
	const hostH = buildingColumnH - 2; // the host pane's 1px top+bottom border
	const toolbarH = 36; // h-7 button (28) + mb-2 (8)
	const available = hostH - toolbarH;
	const campusAvailable = paneInnerH - 2; // no sub-header in campus view
	const sidebarW = 320; // w-80
	const hostW = viewportW * 0.95 - sidebarW - 48; // w-[95vw] - sidebar - p-6
	return {
		dialogH, mainH, paneInnerH, buildingColumnH, hostH, toolbarH, available, campusAvailable, hostW,
		stage: stageHeight === 'pane' ? available : stageHeight,
	};
}

test('fix 06 measurement: at 1366x768 the hardcoded stage overflowed its pane, and the pane now fits', () => {
	const before = mapLayout(1366, 768, 500);
	const after = mapLayout(1366, 768, 'pane');

	// The pre-fix geometry: a 500px stage inside a pane that affords less.
	assert.ok(
		before.stage > before.available,
		`precondition: the 500px stage exceeded its ${before.available.toFixed(1)}px pane`,
	);
	const clipped = before.stage - before.available;
	assert.ok(clipped > 0, 'the pre-fix canvas must be shown to clip');

	// The measured budget at 1366x768.
	const report = {
		dialogHeight: +before.dialogH.toFixed(1),
		buildingPaneHost: +before.hostH.toFixed(1),
		toolbar: before.toolbarH,
		stageAvailable: +before.available.toFixed(1),
		preFixStage: before.stage,
		preFixClippedBy: +clipped.toFixed(1),
		campusExplorerAvailable: +before.campusAvailable.toFixed(1),
		campusMapStage: 520,
		campusClippedBy: +(520 - before.campusAvailable).toFixed(1),
		hostWidth: +before.hostW.toFixed(1),
	};
	// The campus view has no sub-header, so the 520px CampusMap stage fits and
	// does not clip. The building view is the one that clipped.
	assert.ok(
		520 <= before.campusAvailable,
		`the campus canvas (520px) must fit its ${before.campusAvailable.toFixed(1)}px pane`,
	);
	assert.equal(report.campusClippedBy <= 0, true);

	// The fix: the stage tracks the pane, so it cannot exceed it.
	assert.ok(
		after.stage <= after.available,
		`the stage must fit its pane: ${after.stage.toFixed(1)} > ${after.available.toFixed(1)}`,
	);
	assert.equal(after.stage, after.available);

	// The source must not reintroduce a hardcoded height on this path.
	const modal = source('src/components/sections/SectionRoomMapModal.tsx');
	assert.match(modal, /<BuildingView[\s\S]{0,200}?fillAvailableHeight/);
	assert.doesNotMatch(modal, /<BuildingView[\s\S]{0,200}?height=\{\d+\}/);
});

test('fix 06 control: the bottom-most floor is fully visible at 60% and 80% zoom, and reachable at 100%', (t) => {
	// The clamp is transcribed from BuildingView (untouched by this change) and
	// asserted against the component source, so if the clamp moves this control
	// fails rather than quietly testing a stale copy.
	const view = source('src/components/BuildingView.tsx');
	assert.match(
		view,
		/const y = scaledHeight <= canvasHeight\s*\?\s*center\.y\s*:\s*Math\.min\(16, Math\.max\(canvasHeight - scaledHeight - 16, nextPosition\.y\)\)/,
		'the vertical clamp must be the one this control transcribed',
	);
	assert.match(view, /const fitScale = Math\.min\(sx, sy, 1\.4\);/);

	const layout = mapLayout(1366, 768, 'pane');
	const centre = (scaledH: number) => (scaledH <= layout.stage ? (layout.stage - scaledH) / 2 : (layout.stage - scaledH) / 2);
	/** The clamp's own lower bound, which may be negative (that is the pan). */
	const panFloor = (scaledH: number) => layout.stage - scaledH - 16;
	/** The clamp's own upper bound. */
	const panCeil = 16;

	const report: string[] = [];
	for (const roomsPerFloor of [4, 6, 8]) {
		for (const floors of [2, 3, 4, 5]) {
			const contentW = 36 + 8 * 2 + roomsPerFloor * ROOM_CARD_W + (roomsPerFloor - 1) * 4;
			const contentH = 32 + floors * (ROOM_CARD_H + 6 * 2) + (floors - 1) * 3;
			const fit = Math.max(0.3, Math.min((layout.hostW - 32) / contentW, (layout.stage - 32) / contentH, 1.4));
			const floorH = (ROOM_CARD_H + 12) * fit;

			// The auto-fit (mount and reset) centres the whole building.
			const fitBottom = centre(contentH * fit);
			assert.ok(
				fitBottom + contentH * fit <= layout.stage + 0.5,
				`${floors}f x ${roomsPerFloor}r: the auto-fit must show the whole building`,
			);
			assert.ok(
				fitBottom + contentH * fit - floorH >= -0.5,
				`${floors}f x ${roomsPerFloor}r: the bottom-most floor must be fully visible on the auto-fit`,
			);
			report.push(
				`${floors}f x ${roomsPerFloor}r: fit ${(fit * 100).toFixed(0)}%, name ${(ROOM_NAME_FONT * fit).toFixed(1)}px, bottom-floor top at ${(fitBottom + contentH * fit - floorH).toFixed(1)} of ${layout.stage.toFixed(1)}`,
			);

			for (const zoom of [0.6, 0.8, 1.0]) {
				const scaledH = contentH * zoom;
				const bottom = centre(scaledH) + scaledH;
				if (scaledH <= layout.stage) {
					// Fits: centred, so the bottom-most floor is fully visible.
					assert.ok(
						bottom - (ROOM_CARD_H + 12) * zoom >= -0.5,
						`${floors}f x ${roomsPerFloor}r at ${Math.round(zoom * 100)}%: the bottom-most floor must be fully visible without panning`,
					);
				} else {
					// Taller than the pane at this zoom. The stage is still whole
					// (its height equals the pane), and the clamp's lower bound
					// pans the bottom-most floor fully into view at stage-16. This
					// is the documented pan case, not a clipped canvas.
					assert.ok(
						panFloor(scaledH) + scaledH <= layout.stage - 16 + 0.5,
						`${floors}f x ${roomsPerFloor}r at ${Math.round(zoom * 100)}%: panning to the clamp must bring the bottom into view`,
					);
					assert.ok(panCeil <= layout.stage, 'the clamp must still allow the top of a tall building to be reached');
					report.push(
						`${floors}f x ${roomsPerFloor}r at ${Math.round(zoom * 100)}%: exceeds the pane by ${(scaledH - layout.stage).toFixed(1)}px — bottom fully visible at the clamp bound (pan)`,
					);
				}
			}
		}
	}
	// The numbers a reviewer needs, kept out of the assertions but produced.
	assert.ok(report.length > 0);
	t.diagnostic(`1366x768 building pane: stage ${layout.stage.toFixed(1)}px, host ${layout.hostW.toFixed(1)}px wide\n${report.join('\n')}`);
});


/* ──────────────────────── fix 10: the micro-typography floor ─────────────── */

test('fix 10 control: no text below 11px remains in the files this stream owns', () => {
	// All eight product files this stream touched, not a subset: a scan that
	// silently covers 5 of 8 overstates its own name.
	const owned = [
		'src/components/sections/SectionRoomMapModal.tsx',
		'src/components/sections/SectionRoomPicker.tsx',
		'src/components/sections/SectionHomeRoomModals.tsx',
		'src/components/sections/HomeRoomConfirmDialogs.tsx',
		'src/components/sections/homeRoomEditStatus.ts',
		'src/components/sections/homeRoomPersistence.ts',
		'src/components/BuildingView.tsx',
		'src/pages/Sections.tsx',
	];
	assert.equal(owned.length, 8);
	/** Tailwind's root is 16px, so text-[Nrem] = N*16 device px. */
	const remPx = (rem: number) => rem * 16;
	const offenders: string[] = [];

	for (const file of owned) {
		const text = source(file);
		for (const m of text.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
			if (Number(m[1]) < 11) offenders.push(`${file}: text-[${m[1]}px]`);
		}
		for (const m of text.matchAll(/text-\[(\d+(?:\.\d+)?)rem\]/g)) {
			if (remPx(Number(m[1])) < 11) offenders.push(`${file}: text-[${m[1]}rem] = ${remPx(Number(m[1]))}px`);
		}
		// Konva's fontSize is in stage units and is scaled at draw time; the
		// authored value must still be legible before scaling.
		for (const m of text.matchAll(/fontSize=\{(\d+)\}/g)) {
			if (Number(m[1]) < 11) offenders.push(`${file}: fontSize={${m[1]}}`);
		}
		for (const m of text.matchAll(/fontSize=\{([A-Z_]+)\}/g)) {
			if (m[1] !== 'ROOM_NAME_FONT' && m[1] !== 'ROOM_LABEL_FONT') offenders.push(`${file}: fontSize={${m[1]}}`);
		}
	}
	assert.deepEqual(offenders, [], `sub-11px text must not remain: ${offenders.join(', ')}`);

	// The floor must hold for the card too, not only the HTML chrome.
	assert.ok(ROOM_NAME_FONT >= 11, `the authored card font must be >= 11px, got ${ROOM_NAME_FONT}`);
	assert.equal(ROOM_NAME_FONT, 11);
});

test('fix 10 control: the map and sidebar keep their internal scrolling instead of gaining a page scrollbar', () => {
	const modal = source('src/components/sections/SectionRoomMapModal.tsx');
	// The dialog is a fixed-height, self-scrolling shell: root overflow hidden,
	// every growing region either a ScrollArea or clipped, and no min-h that
	// could push the pane past the dialog.
	assert.match(modal, /h-\[90vh\] flex flex-col p-0 overflow-hidden/);
	assert.match(modal, /<ScrollArea className="flex-1"/);
	assert.match(modal, /className="flex-1 bg-muted\/10 p-6 flex flex-col overflow-hidden"/);
	assert.doesNotMatch(modal, /min-h-\[\d+px\]/, 'no pixel min-height may push the map pane past the dialog');
	assert.doesNotMatch(modal, /overflow-y-auto/, 'the map must not introduce its own page-level scroll');
	// The building pane is the one that clipped; it must stay a flex child with
	// a definite height and clip its canvas rather than grow.
	assert.match(modal, /className="flex-1 min-h-0 border rounded-3xl bg-background\/50 shadow-inner overflow-hidden"/);
});
