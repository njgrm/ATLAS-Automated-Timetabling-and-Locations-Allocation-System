/**
 * A9 c4, ITEM 36 — the campus-map EDITOR fits the whole campus into the free
 * area, so no building sits under the inspector at 1366x768.
 *
 * THE OPERATOR'S OWN WORDS (fix-2.docx, fix 36), and the sentence that governs:
 * "The rightmost building cards are visibly clipped beneath the inspector rather
 * than **contained** in an auto-grown/full workspace canvas", and "No building
 * may sit under the panel at 1366x768 (fit the canvas to the free area, or make
 * the panel collapse)."
 *
 * THE INTENT, because the letter of it was already met once and was not enough:
 * an older, mouse-first scheduler opens Edit map to find a building, and should
 * see the WHOLE campus at once — nothing hidden behind a panel, nothing to
 * scroll sideways to find. A3 c11's answer was auto-grow plus a scrolling
 * region, which made the hidden buildings REACHABLE. The operator's word is
 * "contained", and reachable is not contained.
 *
 * WHERE THE FIX LIVES, and why it is not in the size function: the A3 c11
 * geometry contract in `campusEditorCanvas.ts` sizes the stage to the MEASURED
 * work area, grown for content, and clamps a gesture inside it. That contract is
 * correct and is not changed. The last mile is a VIEW: a stage bigger than the
 * box it sits in has to be PAINTED smaller, which is a stage transform
 * (`scaleX`/`scaleY`/`x`/`y`) and nothing else. So the stage's `width`/`height`
 * attributes stay the geometry contract's numbers, the painted ground stays the
 * same rect in stage coordinates, and no building's stored `x`/`y` moves.
 *
 * THE REAL STAGING GEOMETRY, as the planner measured it in a browser at
 * 1366x768, and the numbers every row below is decided against. These are the
 * operator's own buildings, not invented ones:
 *
 *     app sidebar                     256   `ui/sidebar.tsx` SIDEBAR_WIDTH = 16rem
 *     editor inspector                352   `pages/MapEditor.tsx` `w-88`
 *     canvas column padding            32   `pages/MapEditor.tsx` `p-4`, 16 a side
 *     -----------------------------------
 *     free area at 1366               726   `canvasWorkArea` of the region box
 *     rightmost content               902   `Speech Lab` at x 836 + width 66
 *     + CANVAS_EDGE_PADDING            24   so the stage grows to 926
 *     -----------------------------------
 *     over the free area              200   926 - 726: the defect
 *
 * The planner reported 741 as the free width (a 17px disagreement with the
 * component's own measurement, which subtracts the column's own `p-4` twice) and
 * 185px over. The conclusion is identical on either reading and is what matters:
 * the content needs more width than the free area has, so on the base the
 * rightmost buildings are painted past the free area. The rows below use the
 * COMPONENT's own 726, because that is the number the production code measures.
 *
 * WHAT IS REAL HERE: `campusEditorCanvas.ts`'s own exported functions, and — in
 * the rendered rows — the real `CampusMapEditor` through the same react-konva +
 * konva@10.2.3 + jsdom harness A3 c11 uses, with the region box supplied by that
 * harness because jsdom has no layout engine. WHAT IS NOT PROVEN HERE: pixels, a
 * scrollbar and pointer events, none of which jsdom has. A browser row — the
 * operator's actual screen with the real data — stays owed to the browser-custody
 * holder (the planner), as A3 c11's own harness header says.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import test from 'node:test';

import { renderKonva, setHostBox, setupKonvaDom } from './konva-dom-render-harness';

const { act } = await setupKonvaDom('https://njgrm.buru-degree.ts.net/map?mode=editor');
const {
	CANVAS_EDGE_PADDING,
	campusEditorCanvasSize,
	campusEditorFitScale,
	campusEditorViewTransform,
} = await import('@/components/campus-map/campusEditorCanvas');
const { CampusMapEditor } = await import('@/components/CampusMapEditor');
type Building = import('@/types').Building;

/* ── the geometry, from the operator's own buildings ──────────────────────── */

/**
 * The free area at 1366x768, in the TWO vocabularies it legitimately has.
 *
 * `HOST_1366` is what the DOM reports — the harness fixes
 * `getBoundingClientRect` to it, because jsdom has no layout engine, and the
 * component derives the work area from the region's box.
 * `FREE_1366` is the same area in the contract's own names, which is what the
 * pure rows pass. They are ONE number, not two: mixing them up is not a typo a
 * reviewer can see, it silently reads as an UNMEASURED region, which falls back
 * to 1 and would make every fit row vacuously pass.
 */
const HOST_1366 = { width: 726, height: 504 };
const FREE_1366 = { freeWidth: HOST_1366.width, freeHeight: HOST_1366.height };

/**
 * The operator's real staging buildings, as the planner read them from
 * `GET /map/schools/1/buildings`. Taken from the REAL surface, not invented:
 * a control whose fixture already fitted would pass for the wrong reason.
 */
const REAL_BUILDINGS = [
	{ id: 1, name: 'Grade 10 Academic Wing', x: 640, y: 120, width: 180, height: 160 },
	{ id: 2, name: 'Admin and Learning Commons', x: 680, y: 320, width: 180, height: 120 },
	{ id: 3, name: 'Speech Lab', x: 836, y: 60, width: 66, height: 80 },
] as const;

function building(b: { id: number; name: string; x: number; y: number; width: number; height: number }): Building {
	return {
		id: b.id,
		name: b.name,
		shortCode: null,
		x: b.x,
		y: b.y,
		width: b.width,
		height: b.height,
		rotation: 0,
		color: '#0ea5e9',
		floorCount: 1,
		isTeachingBuilding: true,
		gradeScope: [],
		rooms: [],
	} as unknown as Building;
}

const OPERATOR_BUILDINGS = REAL_BUILDINGS.map(building);

/**
 * The stage the accepted size contract produces for those buildings, in the SIZE
 * function's own `{width, height}`…
 */
const OPERATOR_CANVAS = campusEditorCanvasSize({
	containerWidth: HOST_1366.width,
	containerHeight: HOST_1366.height,
	buildings: OPERATOR_BUILDINGS,
});

/**
 * …and the same stage in the VIEW contract's own `{canvasWidth, canvasHeight}`.
 * Two names for one rectangle, exactly as `HOST_1366`/`FREE_1366` are two names
 * for one area: the size function sizes the coordinate space, the view functions
 * scale it, and neither may be handed the other's vocabulary.
 */
const OPERATOR_SPACE = { canvasWidth: OPERATOR_CANVAS.width, canvasHeight: OPERATOR_CANVAS.height };

/**
 * The one ground rect: the only LARGE filled shape. Its origin is NOT assumed to
 * be 0,0 — a fitted, vertically centred view legitimately paints it lower down,
 * which is the overview's own centring behaviour, and a filter that demanded 0
 * would have hidden exactly the centring this fix introduces.
 */
function groundRect(fills: Array<{ x: number; y: number; width: number; height: number; fill: string }>) {
	const candidates = fills.filter((f) => f.width > 200 && f.height > 200);
	// Every painted fill is named on failure, because "no ground" is otherwise the
	// least actionable failure this file can produce.
	assert.equal(
		candidates.length,
		1,
		`exactly one ground rect must be painted; matched ${candidates.length} of ${JSON.stringify(fills)}`,
	);
	return candidates[0];
}

async function renderEditor(host: { width: number; height: number }) {
	setHostBox(host);
	const out = await renderKonva(
		createElement,
		act,
		createElement(
			'div',
			{ 'data-campus-map-canvas-region': '', className: 'flex flex-col overflow-auto p-4', style: { position: 'relative' } },
			createElement(CampusMapEditor, {
				schoolId: 1,
				buildings: OPERATOR_BUILDINGS.map((b) => ({ ...b })),
				campusImageUrl: null,
				onBuildingsChange: () => {},
				selectedBuildingId: null,
				onSelect: () => {},
				onSaved: () => {},
				historyStack: [],
				redoStack: [],
				onPushHistory: () => {},
				onUndo: () => {},
				onRedo: () => {},
			}),
		),
	);
	return out;
}

/* ── the base really was over the free area, so these rows can fail ────────── */

test('36+A9C4: the BASE view really did paint the operator\'s buildings past the free area', () => {
	// The precondition every other row rests on, and the reason this file is
	// evidence rather than a description. The base had no fit: the stage painted
	// at scale 1, so the rightmost building's far edge was at its stored x + width.
	const rightmost = Math.max(...OPERATOR_BUILDINGS.map((b) => b.x + b.width));
	assert.equal(rightmost, 902, 'the operator\'s rightmost building really reaches 902');
	assert.ok(
		rightmost > FREE_1366.freeWidth,
		`precondition: on the base, ${rightmost - FREE_1366.freeWidth}px of campus was painted beyond the ${FREE_1366.freeWidth}px free area`,
	);
	// And the stage really does grow to 926 for these buildings, which is the
	// number the planner measured in the browser — so the fixture reproduces the
	// operator's screen rather than a shape that happens to fit.
	assert.equal(OPERATOR_CANVAS.width, rightmost + CANVAS_EDGE_PADDING);
	assert.equal(OPERATOR_CANVAS.width, 926, 'the operator\'s measured stage width, from the real buildings');
	// The base view transform was the identity scale at the origin; the fit is not.
	assert.equal(
		campusEditorViewTransform({ free: FREE_1366, canvas: OPERATOR_SPACE, zoom: 1 }).scale,
		726 / 926,
		'the fit the base did not have',
	);
});

/* ── the fit, as a total and pure function ────────────────────────────────── */

test('36+A9C4: content NARROWER than the free area is not shrunk, and not enlarged either', () => {
	// "no shrink" cuts both ways: a canvas already inside its box must be painted
	// at 1. It is not scaled UP to fill the box either — enlarging is the
	// operator's zoom control's job, and a fit that silently magnified the campus
	// would be its own surprise.
	assert.equal(campusEditorFitScale({ freeWidth: 900, freeHeight: 600 }, { canvasWidth: 726, canvasHeight: 504 }), 1);
	assert.equal(campusEditorViewTransform({ free: { freeWidth: 900, freeHeight: 600 }, canvas: { canvasWidth: 726, canvasHeight: 504 } }).scale, 1);
	// A canvas exactly the free area is still 1, with nothing to pan to.
	const exact = campusEditorViewTransform({ free: { freeWidth: 726, freeHeight: 504 }, canvas: { canvasWidth: 726, canvasHeight: 504 }, pan: { x: -300, y: 900 } });
	assert.equal(exact.scale, 1);
	assert.deepEqual({ x: exact.x, y: exact.y }, { x: 0, y: 0 }, 'content that fits cannot be panned away from the free area');
});

test('36+A9C4: content WIDER than the free area is scaled until EVERY building is inside it', () => {
	// The operator's own case, decided on the real buildings: 926 of stage into
	// 726 of free area, so nothing is painted where the panel is.
	const fit = campusEditorFitScale(FREE_1366, OPERATOR_SPACE);
	assert.ok(fit < 1, `the fit must shrink a canvas bigger than its box; got ${fit}`);
	assert.equal(fit, 726 / 926);
	const view = campusEditorViewTransform({ free: FREE_1366, canvas: OPERATOR_SPACE });
	assert.equal(view.scale, fit, 'zoom 1 is the fit view — the default the operator lands on');
	// Every real building, painted at the fit, inside the free area. This is the
	// operator's sentence as an assertion: NO BUILDING MAY SIT UNDER THE PANEL.
	for (const b of OPERATOR_BUILDINGS) {
		const left = b.x * view.scale + view.x;
		const right = (b.x + b.width) * view.scale + view.x;
		const top = b.y * view.scale + view.y;
		const bottom = (b.y + b.height) * view.scale + view.y;
		assert.ok(left >= 0 && right <= FREE_1366.freeWidth, `"${b.name}" paints ${left}..${right}, past the ${FREE_1366.freeWidth}px free area`);
		assert.ok(top >= 0 && bottom <= FREE_1366.freeHeight, `"${b.name}" paints ${top}..${bottom}, past the ${FREE_1366.freeHeight}px free area`);
	}
	// The two the planner named specifically: the Grade 10 wing was 79px under the
	// panel and Speech Lab was entirely under it. Neither may be now.
	const grade10 = OPERATOR_BUILDINGS[0];
	assert.ok(grade10.x + grade10.width > FREE_1366.freeWidth, 'precondition: the Grade 10 wing really did reach past the free area');
	assert.ok(836 * view.scale + view.x <= FREE_1366.freeWidth, 'and Speech Lab, which was entirely under the panel, is now inside it');
});

test('36+A9C4: BOTH axes are fitted, and the smaller one wins', () => {
	// A campus that grew DOWNWARDS is as real as one that grew rightwards, and
	// must be fitted on the same terms — the defect was never only horizontal.
	// Each case below names which axis decided, so a one-axis fit fails here.
	assert.equal(
		campusEditorFitScale(FREE_1366, { canvasWidth: 926, canvasHeight: 504 }),
		726 / 926,
		'tall enough to leave the WIDTH the smaller ratio, so the width decides',
	);
	assert.equal(
		campusEditorFitScale(FREE_1366, { canvasWidth: 926, canvasHeight: 1124 }),
		504 / 1124,
		'a campus grown downwards is fitted on its HEIGHT, which is now the smaller ratio',
	);
	assert.equal(
		campusEditorFitScale(FREE_1366, { canvasWidth: 1452, canvasHeight: 504 }),
		0.5,
		'and the width still decides when it is the smaller one',
	);
	// Whichever axis is smaller, the stage ends up inside the free area on BOTH.
	for (const canvas of [{ canvasWidth: 926, canvasHeight: 1124 }, { canvasWidth: 1452, canvasHeight: 504 }]) {
		const scale = campusEditorFitScale(FREE_1366, canvas);
		assert.ok(canvas.canvasWidth * scale <= FREE_1366.freeWidth + 1e-9, 'the width is inside the free area');
		assert.ok(canvas.canvasHeight * scale <= FREE_1366.freeHeight + 1e-9, 'and so is the height');
	}
});

test('36+A9C4: an UNMEASURED host or canvas yields a finite scale and never a zero stage', () => {
	// The pre-measurement first paint, the named-floor case, and plain junk. A fit
	// that could produce NaN would blank the canvas on exactly the render a user
	// is most likely to see first.
	for (const free of [
		{ freeWidth: 0, freeHeight: 0 },
		{ freeWidth: Number.NaN, freeHeight: 504 },
		{ freeWidth: -726, freeHeight: 504 },
		{ freeWidth: Number.POSITIVE_INFINITY, freeHeight: 504 },
	]) {
		const scale = campusEditorFitScale(free, OPERATOR_SPACE);
		assert.equal(scale, 1, `an unmeasured free area must not change the scale; got ${scale} for ${JSON.stringify(free)}`);
	}
	for (const canvas of [
		{ canvasWidth: 0, canvasHeight: 0 },
		{ canvasWidth: Number.NaN, canvasHeight: 504 },
		{ canvasWidth: 926, canvasHeight: Number.NaN },
	]) {
		const view = campusEditorViewTransform({ free: FREE_1366, canvas, zoom: 1.5, pan: { x: Number.NaN, y: Number.POSITIVE_INFINITY } });
		assert.ok(Number.isFinite(view.scale) && view.scale > 0, `a junk canvas must not yield a NaN or zero scale; got ${view.scale}`);
		assert.ok(Number.isFinite(view.x) && Number.isFinite(view.y), `a junk pan must not yield a NaN origin; got ${view.x}, ${view.y}`);
	}
	// A junk zoom falls back to 1 rather than collapsing the stage.
	assert.equal(campusEditorViewTransform({ free: FREE_1366, canvas: OPERATOR_SPACE, zoom: 0 }).scale, campusEditorFitScale(FREE_1366, OPERATOR_SPACE));
	assert.equal(campusEditorViewTransform({ free: FREE_1366, canvas: OPERATOR_SPACE, zoom: Number.NaN }).scale, campusEditorFitScale(FREE_1366, OPERATOR_SPACE));
});

test('36+A9C4: the operator\'s zoom rides ON TOP of the fit, and reset returns to the fit', () => {
	const fit = campusEditorFitScale(FREE_1366, OPERATOR_SPACE);
	// Zoom in is detail work on a map the operator can already see whole — the
	// opposite of the base, where zoom 1 was already too big to see.
	const zoomed = campusEditorViewTransform({ free: FREE_1366, canvas: OPERATOR_SPACE, zoom: 1.5 });
	assert.ok(zoomed.scale > fit, 'zooming in goes past the fit, for detail work');
	assert.equal(zoomed.scale, fit * 1.5);
	// RESET is `zoom: 1, pan: {0,0}` — the fit view, which is now the default, so
	// the two agree by construction. The base's reset returned to 100%.
	assert.deepEqual(
		campusEditorViewTransform({ free: FREE_1366, canvas: OPERATOR_SPACE, zoom: 1, pan: { x: 0, y: 0 } }),
		campusEditorViewTransform({ free: FREE_1366, canvas: OPERATOR_SPACE }),
		'reset lands exactly on the default fit view',
	);
});

test('36+A9C4: the pan is clamped, so zoomed-in detail can never be lost', () => {
	const zoomed = campusEditorViewTransform({ free: FREE_1366, canvas: OPERATOR_SPACE, zoom: 2 });
	const scaledWidth = OPERATOR_CANVAS.width * zoomed.scale;
	assert.ok(scaledWidth > FREE_1366.freeWidth, 'precondition: at 2x the campus is wider than the free area, so there is somewhere to pan');
	// Each edge can be brought to the free area's edge, and no further.
	assert.equal(zoomed.x, 0, 'the default is the left edge in place');
	assert.equal(campusEditorViewTransform({ free: FREE_1366, canvas: OPERATOR_SPACE, zoom: 2, pan: { x: 99_999, y: 0 } }).x, 0, 'a pan past the right stop is held at the right stop');
	assert.equal(
		campusEditorViewTransform({ free: FREE_1366, canvas: OPERATOR_SPACE, zoom: 2, pan: { x: -99_999, y: 0 } }).x,
		FREE_1366.freeWidth - scaledWidth,
		'and past the left stop, at the left stop — the rightmost pixel of the map just meets the right edge',
	);
	// Whatever the pan, the content stays reachable: the rightmost building can
	// always be brought inside the free area.
	const far = campusEditorViewTransform({ free: FREE_1366, canvas: OPERATOR_SPACE, zoom: 2, pan: { x: -99_999, y: -99_999 } });
	const rightmost = 902 * far.scale + far.x;
	assert.ok(rightmost <= FREE_1366.freeWidth + 1e-9, `the rightmost building must be reachable; it stops at ${rightmost}`);
	// Shrinking the content back to the fit releases the pan, so the operator is
	// never left staring at a canvas scrolled to nowhere.
	assert.equal(campusEditorViewTransform({ free: FREE_1366, canvas: OPERATOR_SPACE, zoom: 1, pan: { x: -99_999, y: -99_999 } }).x, 0);
});

/* ── rendered: the real editor, at the operator's real geometry ────────────── */

test('36+A9C4 RENDERED: the ground PAINTS fitted to the free area, and the stage attribute still grows', async () => {
	// The load-bearing row, and the REPLACEMENT for the A3 c11 row whose painted
	// ground claim A9 c4 superseded (recorded in that file, not deleted).
	//
	// Both halves are asserted together because either alone is a lie: a stage
	// that shrank would contain the campus but break the accepted size contract,
	// and a stage that grew but painted at 1 is the base.
	const out = await renderEditor(HOST_1366);
	try {
		// The size contract, untouched: the stage attribute is still the grown
		// stage, so the coordinate space every stored x/y lives in is unchanged.
		assert.equal(out.stageWidth, 926, 'the stage attribute must still be the grown 926px canvas');
		assert.equal(out.stageHeight, 504, 'and the work area\'s own height, since nothing grows it');
		// And it is PAINTED at the fit, so the painted ground is the free area.
		const ground = groundRect(out.fills);
		assert.ok(
			Math.abs(ground.width - HOST_1366.width) < 1,
			`the painted ground must be the ${HOST_1366.width}px free area, got ${ground.width}`,
		);
		assert.ok(
			Math.abs(ground.height - HOST_1366.height * (HOST_1366.width / 926)) < 1,
			`and the same aspect on the other axis, got ${ground.height}`,
		);
		// A regression to the base's 100% default is the exact failure this row
		// exists to catch, so it is named as its own claim.
		assert.notEqual(ground.width, 926, 'the base painted the full 926px ground into a 726px box; that is the defect');
	} finally {
		out.unmount();
	}
});

test('36+A9C4 RENDERED: a work area BIGGER than the canvas paints the whole canvas, unshrunk', async () => {
	// The other direction, so the row is a measurement rather than a constant that
	// only ever shrinks. Nothing may be scaled UP to fill a box, and a campus that
	// already fits must be painted at 1.
	const out = await renderEditor({ width: 1400, height: 900 });
	try {
		const ground = groundRect(out.fills);
		assert.equal(out.stageWidth, 1400, 'the stage is the measured work area, so the accepted size contract still holds');
		assert.equal(ground.width, 1400, 'and the painted ground is the whole of it, at scale 1');
	} finally {
		out.unmount();
	}
});

test('36+A9C4 RENDERED: the status bar reports the scale the map is really painted at', async () => {
	// The number an operator reads. At the default it is the FIT (about 78% at
	// 1366x768), not 100% — and 100% was the view that put a building under the
	// panel, so a truthful readout is part of the fix rather than a detail.
	const out = await renderEditor(HOST_1366);
	try {
		const text = out.host.textContent ?? '';
		assert.match(text, /78% zoom/, `the status bar must report the fitted scale; got ${JSON.stringify(text.slice(-40))}`);
		assert.doesNotMatch(text, /100% zoom/, 'the old fixed 100% default must be gone');
	} finally {
		out.unmount();
	}
});
