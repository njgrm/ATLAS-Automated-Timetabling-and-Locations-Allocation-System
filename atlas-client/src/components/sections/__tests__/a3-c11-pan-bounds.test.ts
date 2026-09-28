/**
 * A3 c11 FIX-06 — "Building canvas cannot pan far enough to Floor 1 at usable
 * zoom" — the review's verification matrix, made decidable.
 *
 * The recorded state: the dynamic bounds and `clampPosition` already existed in
 * `BuildingView.tsx`, but they lived inside the component, and the staging
 * auditor could not finish the matrix because the seeded data has no 5-floor
 * building and it could not reach an exact 60/80/100%. So the row was undecidable
 * rather than unproven.
 *
 * This control runs the matrix the review demanded, against the SAME pure
 * function the canvas draws with:
 *
 *   floor counts 2/3/4/5 x { 60%, 80%, 100%, 140%, the component's own fit
 *   scale } x a tall pane (900px) and a short pane (320px) — asserting
 *
 *   (a) REACHABILITY. Dragged to the extreme that exposes the bottom-most floor,
 *       that floor's box is FULLY inside the visible pane. Its edges come from
 *       `buildingFloorRowTop(1, n)`, the function the render loop calls, and the
 *       content box from the same `buildingContent*` derivations — no constant
 *       invented here. A 16px gutter is the documented reach.
 *   (b) INFINITE-DRAG PREVENTION. Dragging far past every edge in both axes,
 *       both directions, repeatedly, always lands inside the same bound, and
 *       clamping an already-clamped position is a no-op (idempotence), which is
 *       what `dragBoundFunc` + `onDragEnd` rely on.
 *   (c) ONE CLAMP, SHARED. Every consumer of the building canvas is enumerated
 *       from the tree and must reach the shared clamp; none may define its own.
 *   (d) FAILING-FIRST. The matrix is compiled against a MUTANT of the committed
 *       clamp text (the pre-fix fixed-viewport-height assumption) and must fail
 *       with a legible message, and the committed file must be byte-identical
 *       afterwards.
 *
 * jsdom runs no layout, so the pane's measured size is an input here — the
 * component measures it with one ResizeObserver and this is the same number it
 * would measure. Everything else is real production code.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { test } from 'node:test';

import {
	BUILDING_FIT_MAX_SCALE,
	BUILDING_FIT_MIN_SCALE,
	BUILDING_PAN_PADDING_PX,
	buildingContentHeight,
	buildingContentWidth,
	buildingFitScale,
	buildingFloorRowTop,
	clampBuildingPan,
	type BuildingPanContent,
	type BuildingPanPane,
	type BuildingPanPosition,
} from '../../BuildingView';

const clientRoot = resolve(import.meta.dirname, '../../../..');
const srcRoot = join(clientRoot, 'src');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

const BUILDING_VIEW = 'src/components/BuildingView.tsx';
const EPS = 1e-6;

/* ─────────────── the panes, the floors and the zooms the review named ─────── */

/**
 * 930px is the Assign-Home-Room pane's measured inner width at 1366x768 (see the
 * `fillAvailableHeight` note in BuildingView). The two heights bracket the
 * operator's real cases: a tall pane, and the short pane whose bottom floor the
 * review reported as unreachable.
 */
const PANE_WIDTH = 930;
const PANES: Array<{ name: string; pane: BuildingPanPane }> = [
	{ name: 'tall pane', pane: { width: PANE_WIDTH, height: 900 } },
	{ name: 'short pane', pane: { width: PANE_WIDTH, height: 320 } },
];
const FLOOR_COUNTS = [2, 3, 4, 5];
/** Six rooms on the widest floor: the review's "at usable zoom" cases all fit
 *  930px at 140% (612 x 1.4 = 856.8, + the 16px gutter = 872.8 <= 930). A wider
 *  building would be WIDTH-limited at 140%, which is a different property and is
 *  asserted separately below. */
const MAX_ROOMS_ON_FLOOR = 6;
const NAMED_SCALES = [0.6, 0.8, 1.0, 1.4];

function contentFor(floors: number): BuildingPanContent {
	return { width: buildingContentWidth(MAX_ROOMS_ON_FLOOR), height: buildingContentHeight(floors) };
}

/** The committed floor geometry, and a ratchet that it is the component's own. */
test('the floor box this control measures is the one the render loop draws', () => {
	const view = source(BUILDING_VIEW);
	// The component computes the row offset FROM this function, so a control that
	// reads the export cannot drift from the pixels.
	assert.match(
		view,
		/const floorY = buildingFloorRowTop\(floorNum, floorsAsc\.length\) - ROOF_H;/,
		'the render loop must derive each floor row from the exported geometry',
	);
	assert.match(view, /const floorTotalH = FLOOR_ROW_H;/, 'one floor band, one source');
	// Base constants, read from the file rather than restated, so this ratchet
	// fails if the committed geometry moves.
	const constant = (name: string): number => {
		const m = view.match(new RegExp(`const ${name} = (\\d+);`));
		assert.ok(m, `expected ${name} to be a committed numeric constant`);
		return Number(m![1]);
	};
	const ROOM_H = constant('ROOM_H');
	const ROOM_GAP = constant('FLOOR_GAP');
	const FLOOR_PAD_Y = constant('FLOOR_PAD_Y');
	const ROOF_H = constant('ROOF_H');
	const rowH = ROOM_H + FLOOR_PAD_Y * 2;

	// The component's own `buildingContentH` expression, evaluated from source
	// with its only variable bound to the floor count.
	const expr = view.match(/const buildingContentH = ([^;]+);/);
	assert.ok(expr, 'the component must still compute its content height inline');
	const exprText = expr![1].replace(/floorsAsc\.length/g, 'n').replace(/floorTotalH/g, 'rowH');
	const evaluate = new Function('ROOF_H', 'rowH', 'FLOOR_GAP', 'n', `return ${exprText};`);
	for (const floors of FLOOR_COUNTS) {
		assert.equal(
			buildingContentHeight(floors),
			evaluate(ROOF_H, rowH, ROOM_GAP, floors),
			`${floors}f: the exported content height must equal the component's expression`,
		);
		// Floor 1 is the BOTTOM-most row: its band runs from its top to the very
		// bottom of the content, so its height is exactly one floor band.
		const top = buildingFloorRowTop(1, floors);
		assert.equal(buildingContentHeight(floors) - top, rowH, `${floors}f: floor 1's band height`);
		assert.equal(buildingFloorRowTop(floors, floors), ROOF_H, `${floors}f: the top floor sits under the roof`);
		assert.ok(
			buildingFloorRowTop(1, floors) > buildingFloorRowTop(floors, floors),
			`${floors}f: floor 1 must sit below the top floor`,
		);
	}
	// Width, the cross-lane contract the other lane's control already pins.
	assert.equal(buildingContentWidth(6), 36 + 8 * 2 + 6 * 90 + 5 * 4);
	assert.equal(BUILDING_PAN_PADDING_PX, 16, 'the documented reach gutter is 16px');
});

/* ───────────────────────────── (a) reachability ──────────────────────────── */

type Combo = { floors: number; scale: number; paneName: string; pane: BuildingPanPane; content: BuildingPanContent };

/** Every (floor count, zoom, pane) the review named, including the component's
 *  own fit scale, which differs per case and is therefore not one number. */
function matrix(): Combo[] {
	const combos: Combo[] = [];
	for (const floors of FLOOR_COUNTS) {
		const content = contentFor(floors);
		for (const { name, pane } of PANES) {
			const fit = buildingFitScale(pane.width, pane.height, content.width, content.height);
			for (const scale of [...NAMED_SCALES, fit]) {
				combos.push({ floors, scale, paneName: name, pane, content });
			}
		}
	}
	return combos;
}

/** The bottom-most floor's box in pane coordinates at a given pan position. */
function bottomFloorBox(combo: Combo, pos: BuildingPanPosition) {
	const top = buildingFloorRowTop(1, combo.floors);
	return {
		left: pos.x,
		right: pos.x + combo.content.width * combo.scale,
		top: pos.y + top * combo.scale,
		bottom: pos.y + combo.content.height * combo.scale,
	};
}

function insidePane(box: ReturnType<typeof bottomFloorBox>, pane: BuildingPanPane) {
	return (
		box.left >= -EPS &&
		box.right <= pane.width + EPS &&
		box.top >= -EPS &&
		box.bottom <= pane.height + EPS
	);
}

const comboLabel = (c: Combo) =>
	`${c.floors} floors @ ${Math.round(c.scale * 100)}% (fit ${(buildingFitScale(c.pane.width, c.pane.height, c.content.width, c.content.height) * 100).toFixed(0)}%), ${c.paneName} ${c.pane.width}x${c.pane.height}`;

test('(a) at every zoom and both pane heights, the bottom-most floor can be brought fully into view', (t) => {
	const FAR = -1e7;
	const rows: string[] = [];
	for (const combo of matrix()) {
		// Drag to the extreme that exposes the lowest floor: as far up and left
		// as the pointer can physically go.
		const pos = clampBuildingPan({ x: FAR, y: FAR }, combo.scale, combo.content, combo.pane);
		const box = bottomFloorBox(combo, pos);
		assert.ok(
			insidePane(box, combo.pane),
			`${comboLabel(combo)}: the bottom-most floor must be FULLY visible at the clamp, but it is `
			+ `top ${box.top.toFixed(1)} bottom ${box.bottom.toFixed(1)} left ${box.left.toFixed(1)} `
			+ `right ${box.right.toFixed(1)} in a ${combo.pane.width}x${combo.pane.height} pane`,
		);
		// And it must be genuinely reachable, not padded into place: the pan had
		// to move (or the content fitted), and the floor is not left off-screen.
		assert.ok(box.bottom > 0, `${comboLabel(combo)}: the bottom floor is on screen`);
		rows.push(
			`${comboLabel(combo)}: bottom floor at y ${box.top.toFixed(1)}..${box.bottom.toFixed(1)} of ${combo.pane.height}`,
		);
	}
	// The matrix is exhaustive over what the review named: 4 floor counts x
	// (4 zooms + the fit scale) x 2 panes.
	assert.equal(matrix().length, FLOOR_COUNTS.length * (NAMED_SCALES.length + 1) * PANES.length);
	assert.ok(rows.length >= 40, 'the matrix covers every case, not a sample');
	t.diagnostic(`${rows.length} cases\n${rows.join('\n')}`);
});

test('(a) a wide building is width-limited at 140%, and the floor is still reachable on the axis that is not', () => {
	// Stated rather than assumed: at 8 rooms/floor the building is 800 wide, so
	// 140% overflows the 930px pane horizontally. The bottom floor's WIDTH cannot
	// be shown at that zoom — no clamp could — but its vertical reach is intact,
	// which is what the review's complaint was about.
	const content = { width: buildingContentWidth(8), height: buildingContentHeight(5) };
	const pane = { width: PANE_WIDTH, height: 320 };
	assert.ok(content.width * 1.4 > pane.width, 'precondition: 140% overflows the width');
	const pos = clampBuildingPan({ x: -1e7, y: -1e7 }, 1.4, content, pane);
	const box = bottomFloorBox({ floors: 5, scale: 1.4, paneName: 'x', pane, content }, pos);
	assert.ok(box.top >= -EPS && box.bottom <= pane.height + EPS, 'the bottom floor is still fully visible vertically');
	assert.ok(
		content.width * 1.4 > pane.width + BUILDING_PAN_PADDING_PX,
		'and the width genuinely does not fit, so the control is not vacuous',
	);
});

/* ─────────────────── (b) infinite-drag prevention, repeatedly ────────────── */

	test('(b) dragging far past every edge, in both axes and both directions, stays inside the same bound', () => {
		const FAR = 1e7;
		/**
		 * On one axis the clamp has exactly two legal answers, and which one
		 * applies is a property of the geometry, not of the drag: the content
		 * either FITS (then the position is pinned to the centre, and the whole
		 * box is inside the pane) or it does not (then the position must sit
		 * between the two gutter bounds). Asserting the right one per case is
		 * what makes "infinite drag prevention" a real bound.
		 */
		const axisBound = (
			position: number,
			offset: number,
			scaledSize: number,
			paneSize: number,
			label: string,
		) => {
			if (scaledSize <= paneSize) {
				assert.equal(
					position,
					(paneSize - scaledSize) / 2,
					`${label}: content fits on this axis, so the clamp must pin it to the centre`,
				);
				return;
			}
			assert.ok(
				position >= paneSize - scaledSize - BUILDING_PAN_PADDING_PX - EPS && position <= BUILDING_PAN_PADDING_PX + EPS,
				`${label}: pan escaped the gutter bound (offset ${position.toFixed(1)}, legal `
				+ `${(paneSize - scaledSize - BUILDING_PAN_PADDING_PX).toFixed(1)}..${BUILDING_PAN_PADDING_PX})`,
			);
			assert.ok(offset >= -EPS, `${label}: the content never leaves the pane`);
		};

		for (const combo of matrix()) {
			const { pane, content, scale } = combo;
			const scaledW = content.width * scale;
			const scaledH = content.height * scale;
			// Start from a position nobody could reach by dragging, and clamp it.
			let pos = clampBuildingPan({ x: FAR, y: FAR }, scale, content, pane);
			for (let round = 0; round < 5; round += 1) {
				// Konva hands `dragBoundFunc` the raw dragged position every frame,
				// so the input is always wild; the output must always be in bounds.
				const drags: Array<[number, number]> = [
					[FAR, FAR], [-FAR, -FAR], [FAR, -FAR], [-FAR, FAR], [0, 0], [1e4, -1e4],
				];
				for (const [dx, dy] of drags) {
					pos = clampBuildingPan({ x: pos.x + dx, y: pos.y + dy }, scale, content, pane);
					axisBound(pos.x, pos.x + scaledW, scaledW, pane.width, `${comboLabel(combo)} round ${round} drag (${dx}, ${dy}) x`);
					axisBound(pos.y, pos.y + scaledH, scaledH, pane.height, `${comboLabel(combo)} round ${round} drag (${dx}, ${dy}) y`);
					// Idempotence: the result of a clamp is a fixed point, so a drag
					// cannot creep the canvas off-screen over many frames.
					assert.deepEqual(clampBuildingPan(pos, scale, content, pane), pos, `${comboLabel(combo)}: clamp is idempotent`);
				}
			}
		}
	});

/* ───────────────── (c) one clamp, shared by every consumer ───────────────── */

/**
 * Every file in `src` that renders the shared building canvas. The list is
 * ENUMERATED from the tree, not restated, so a new consumer cannot slip past this
 * control; the named expectations then make each one an explicit decision.
 */
function buildingViewConsumers(): string[] {
	const out: string[] = [];
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (entry.name.endsWith('.tsx') && !full.includes('__tests__')) {
				if (readFileSync(full, 'utf8').includes('<BuildingView')) out.push(relative(srcRoot, full).replace(/\\/g, '/'));
			}
		}
	};
	walk(srcRoot);
	return out.sort();
}

test('(c) every consumer of the building canvas reaches the one shared clamp', () => {
	const consumers = buildingViewConsumers();
	// The review's matrix names the Assign Home Room modal, the campus/building
	// explorer and any third pane using the same canvas; the dashboard card is a
	// fourth consumer. This is deliberately NOT compared for exact equality: a
	// consumer added in ANOTHER lane (A2 owns `components/timetable/**`) must
	// not turn this script red and read as an A3 regression. Correctness comes
	// from the loop below, which holds EVERY enumerated consumer - present, and
	// future - to the one shared clamp; the assertions here only pin that the
	// panes the review names are actually covered.
	for (const required of [
		'components/sections/SectionRoomMapModal.tsx',
		'components/campus-map/CampusMapOverview.tsx',
		'components/dashboard/CampusReadinessCard.tsx',
	]) {
		assert.ok(consumers.includes(required), `${required} must be a covered consumer of the shared canvas`);
	}
	assert.ok(consumers.length >= 4, `expected at least the four shared-canvas panes, found ${consumers.length}`);

	for (const file of consumers) {
		const text = source(`src/${file}`);
		// A consumer may not own a second pan bound: that is the "per-page hack"
		// the criterion forbids, and it is the only way a pane could diverge
		// from the shared one.
		assert.doesNotMatch(text, /dragBoundFunc/, `${file} must not bound its own drag`);
		assert.doesNotMatch(text, /function clamp(Position|BuildingPan)\b/, `${file} must not define its own clamp`);
		assert.doesNotMatch(text, /onDragEnd/, `${file} must not pan the canvas itself`);
		// It reaches the shared clamp by rendering the shared component, and
		// nothing else: no second canvas of its own.
		assert.match(text, /<BuildingView\b/, `${file} renders the shared canvas`);
		assert.doesNotMatch(text, /from 'react-konva'/, `${file} must not build a second canvas`);
	}

	// And the shared component's own drag path routes through the one clamp, on
	// both the live-drag bound and the drop.
	const view = source(BUILDING_VIEW);
	assert.match(
		view,
		/dragBoundFunc=\{\(nextPosition\) => clampPosition\(nextPosition, scale\)\}/,
		'the live drag must be bounded by the shared clamp',
	);
	assert.match(
		view,
		/onDragEnd=\{\(e\) => setPos\(clampPosition\(\{ x: e\.target\.x\(\), y: e\.target\.y\(\) \}, scale\)\)\}/,
		'the drop must settle through the shared clamp',
	);
	assert.match(
		view,
		/return clampBuildingPan\(\s*nextPosition,\s*nextScale,\s*\{ width: buildingContentW, height: buildingContentH \},\s*\{ width: containerW, height: canvasHeight \},?\s*\);/,
		'the component must delegate to the exported clamp, not keep its own copy',
	);
	assert.match(view, /const s = buildingFitScale\(containerW, canvasHeight, buildingContentW, buildingContentH\);/, 'the fit scale is the exported one');
});

/* ───────────────── (d) failing-first, then byte-exact restore ───────────── */

/** The committed clamp's own source text, with its type annotations stripped. */
function committedClampSource(): string {
	const view = source(BUILDING_VIEW);
	const start = view.indexOf('/* clamp-building-pan:begin');
	const end = view.indexOf('/* clamp-building-pan:end */');
	assert.ok(start > 0 && end > start, 'the clamp must be delimited so this control compiles the committed text');
	const block = view.slice(view.indexOf('export function clampBuildingPan', start), end);
	const stripped = block
		.replace(/:\s*(BuildingPanPosition|BuildingPanContent|BuildingPanPane|number)\b/g, '')
		.replace('export function', 'function');
	assert.doesNotMatch(stripped, /:\s*(BuildingPan|number)/, 'every annotation must be stripped before compiling');
	return stripped;
}

function compileClamp(sourceText: string) {
	const factory = new Function(
		'buildingPanCenter',
		`${sourceText}\nreturn clampBuildingPan;`,
	) as (center: unknown) => (
		next: BuildingPanPosition,
		scale: number,
		content: BuildingPanContent,
		pane: BuildingPanPane,
	) => BuildingPanPosition;
	return factory((scale: number, content: BuildingPanContent, pane: BuildingPanPane) => ({
		x: (pane.width - content.width * scale) / 2,
		y: (pane.height - content.height * scale) / 2,
	}));
}

const fileDigest = (path: string) => createHash('sha256').update(readFileSync(resolve(clientRoot, path))).digest('hex');

test('(d) the matrix is load-bearing: a fixed-viewport-height clamp fails it, and the committed file is restored', (t) => {
	const committed = committedClampSource();
	const committedDigest = fileDigest(BUILDING_VIEW);

	// The pre-fix assumption FIX-06 names: the pane is always the old hardcoded
	// canvas height, so a 320px pane is clamped as if it were 500px tall.
	const FIXED_VIEWPORT_HEIGHT_PX = 500;
	const mutant = committed.replace(
		/const canvasHeight = pane\.height;/,
		`const canvasHeight = ${FIXED_VIEWPORT_HEIGHT_PX}; // MUTANT: fixed viewport height`,
	);
	assert.notEqual(mutant, committed, 'the mutant must actually differ from the committed clamp');
	assert.match(mutant, /MUTANT: fixed viewport height/, 'the mutation must be the fixed-height assumption');

	/** Runs criterion (a) against an arbitrary clamp and reports every failure. */
	const failuresFor = (clamp: ReturnType<typeof compileClamp>): string[] => {
		const failures: string[] = [];
		const FAR = -1e7;
		for (const combo of matrix()) {
			const pos = clamp({ x: FAR, y: FAR }, combo.scale, combo.content, combo.pane);
			const box = bottomFloorBox(combo, pos);
			if (!insidePane(box, combo.pane)) {
				failures.push(
					`${comboLabel(combo)}: bottom-most floor is y ${box.top.toFixed(1)}..${box.bottom.toFixed(1)} `
					+ `in a ${combo.pane.height}px pane`,
				);
			}
		}
		return failures;
	};

	const realFailures = failuresFor(clampBuildingPan);
	assert.deepEqual(realFailures, [], 'the committed clamp satisfies the matrix');

	const mutantFailures = failuresFor(compileClamp(mutant));
	assert.ok(
		mutantFailures.length > 0,
		'the matrix must FAIL against a clamp that assumes a fixed viewport height, '
		+ `or it decides nothing (tried floors ${FLOOR_COUNTS.join(', ')} at `
		+ `${NAMED_SCALES.map((s) => Math.round(s * 100) + '%').join(', ')} on `
		+ `${PANES.map((p) => `${p.pane.width}x${p.pane.height}`).join(' and ')})`,
	);
	// Legible: the message names the case and the numbers, so a reviewer reading
	// a red run knows which floor/zoom/pane broke without rerunning anything.
	for (const failure of mutantFailures) {
		assert.match(failure, /floors @ \d+% .* pane/, `the failure message must name the case: ${failure}`);
		assert.match(failure, /in a \d+px pane/, `the failure message must carry the numbers: ${failure}`);
	}
	t.diagnostic(
		`fixed-viewport-height mutant (${FIXED_VIEWPORT_HEIGHT_PX}px) fails ${mutantFailures.length} of `
		+ `${matrix().length} cases:\n${mutantFailures.slice(0, 6).join('\n')}`
		+ (mutantFailures.length > 6 ? `\n... and ${mutantFailures.length - 6} more` : ''),
	);

	// Restore proof: this control never wrote the file, and the committed text it
	// compiled is still the committed text, byte for byte.
	assert.equal(fileDigest(BUILDING_VIEW), committedDigest, 'BuildingView.tsx must be byte-identical after the mutant run');
	assert.doesNotMatch(source(BUILDING_VIEW), /MUTANT: fixed viewport height/, 'no mutant text may remain in the committed source');
	assert.equal(committedClampSource(), committed, 'the committed clamp text is unchanged');
});

/* ───────────────────── the scale bounds, pinned ──────────────────────────── */

test('the zoom range the toolbar can reach is the one this matrix covers', () => {
	const view = source(BUILDING_VIEW);
	// The toolbar multiplies/divides the current scale by 1.15, and `zoomTo`
	// bounds it to [0.2, 3]; the matrix's 60/80/100/140% all sit inside that, so
	// each named case is a state the operator can actually produce.
	assert.match(view, /const boundedScale = Math\.max\(0\.2, Math\.min\(3, nextScale\)\);/);
	assert.equal(BUILDING_FIT_MAX_SCALE, 1.4, 'the fit cap is the 140% case the review names');
	assert.equal(BUILDING_FIT_MIN_SCALE, 0.3, 'the fit floor');
	for (const scale of NAMED_SCALES) assert.ok(scale >= 0.2 && scale <= 3, `${scale} is reachable`);
});
