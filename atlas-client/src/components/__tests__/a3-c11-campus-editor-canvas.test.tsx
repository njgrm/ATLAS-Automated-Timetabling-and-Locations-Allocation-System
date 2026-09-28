/**
 * A3 c11 — fix 36, RENDERED: the campus-map editor canvas spans the work area,
 * auto-grows for its content, and contains every placement.
 *
 * THE OPERATOR'S OWN REQUEST (fix-2.docx, fix 36) offered three alternatives and
 * this implements all three, each named in the request: "Dynamic Bounding Box
 * Calculation (Auto-Grow)", "Responsive Full-Workspace Canvas … so it spans the
 * entire work area to the left of the detail panel", and "Containment & Drag
 * Boundaries … so a building can never visually clip or break outside its
 * designated canvas boundary".
 *
 * WHAT THE LIVE AUDIT SAW: "The rightmost building cards are visibly clipped
 * beneath the inspector rather than contained in an auto-grown/full workspace
 * canvas" on `/map?mode=editor`.
 *
 * WHY THIS RENDERS. The base stage was a hardcoded 920x580 inside an
 * `overflow-hidden` wrapper, and the clip is a property of the STAGE SIZE against
 * the CONTAINER width, so it is decidable from a real render: the harness reads
 * the stage's own size off the rendered layer canvas and the ground rect off what
 * Konva painted. jsdom has no layout engine, so the container width is supplied
 * by the harness (`setHostBox`) — that number is the test's INPUT, and everything
 * asserted below is read back out of the render.
 *
 * WHAT IS NOT PROVEN HERE: that a real browser's inspector is 352px wide, and
 * that a real pointer drag lands where this harness says. The clamp arithmetic is
 * pure and unit-asserted; the drag itself is Lane C's / A4's browser row.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import test from 'node:test';

import { renderKonva, setHostBox, setupKonvaDom } from './konva-dom-render-harness';

const { act } = await setupKonvaDom('https://njgrm.buru-degree.ts.net/map?mode=editor');
const {
	CampusMapEditor,
	CANVAS_EDGE_PADDING,
	CANVAS_MIN_HEIGHT,
	CANVAS_MIN_WIDTH,
	clampBuildingToCanvas,
	campusEditorCanvasSize,
} = await import('@/components/CampusMapEditor');
type Building = import('@/types').Building;

function building(id: number, over: Partial<Building> = {}): Building {
	return {
		id,
		name: `Building ${id}`,
		shortCode: null,
		x: 20,
		y: 20,
		width: 120,
		height: 80,
		rotation: 0,
		color: '#0ea5e9',
		floorCount: 1,
		isTeachingBuilding: true,
		gradeScope: [],
		rooms: [],
		...over,
	} as unknown as Building;
}

/** The editor's real signature; the callbacks are inert for a size control. */
async function renderEditor(buildings: Building[], host: { width: number; height: number }) {
	setHostBox(host);
	const out = await renderKonva(createElement, act, createElement(CampusMapEditor, {
		schoolId: 1,
		buildings: buildings.map((b) => ({ ...b })),
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
	}));
	return out;
}

/** The ground rect is the one filled shape at the origin, at the canvas size. */
function groundRect(fills: Array<{ x: number; y: number; width: number; height: number; fill: string }>) {
	const candidates = fills.filter((f) => f.x === 0 && f.y === 0 && f.width > 400 && f.height > 300);
	assert.equal(candidates.length, 1, `exactly one ground rect must be painted; got ${JSON.stringify(candidates)}`);
	return candidates[0];
}

/* ── option 2: the canvas spans the work area ─────────────────────────────── */

test('36 RENDERED: the stage fills the measured work area, not a fixed 920', async () => {
	// 1366px viewport, less the 352px (`w-88`) inspector and the 32px pane
	// padding, is ~982px; the base stage was a fixed 920 in an `overflow-hidden`
	// wrapper, and anything wider than the wrapper was cut. The work area here is
	// deliberately WIDER than 920, which is the direction that used to clip.
	const host = { width: 1180, height: 640 };
	const out = await renderEditor([building(1)], host);
	try {
		assert.equal(out.stageWidth, host.width, `the stage must be the work area width, got ${out.stageWidth}`);
		assert.ok(
			out.stageWidth > CANVAS_MIN_WIDTH,
			`the stage must exceed the old fixed ${CANVAS_MIN_WIDTH}, got ${out.stageWidth}`,
		);
		assert.equal(out.stageHeight, host.height, `the stage must be the work area height, got ${out.stageHeight}`);
		// And the ground the operator actually sees is the same size as the stage.
		const ground = groundRect(out.fills);
		assert.equal(ground.width, out.stageWidth, 'the white ground must be as wide as the stage');
		assert.equal(ground.height, out.stageHeight, 'the white ground must be as tall as the stage');
	} finally {
		out.unmount();
	}
});

test('36 RENDERED: a NARROW work area keeps the old canvas as a floor, never less', async () => {
	// The floor is what stops the fix from shrinking the workspace: a narrow pane
	// (a collapsed inspector, a small window) must still get the 920x580 the base
	// always had, and the `overflow-hidden` wrapper then clips nothing because
	// there is nothing beyond it.
	const out = await renderEditor([building(1)], { width: 640, height: 400 });
	try {
		assert.equal(out.stageWidth, CANVAS_MIN_WIDTH, `the floor must hold, got ${out.stageWidth}`);
		assert.equal(out.stageHeight, CANVAS_MIN_HEIGHT, `the floor must hold, got ${out.stageHeight}`);
	} finally {
		out.unmount();
	}
});

/* ── option 1: auto-grow for content already outside the canvas ───────────── */

test('36 RENDERED: a building dragged past the old 920 edge makes the canvas grow', async () => {
	// The operator's own case: "the blue room element placed toward the right …
	// overflow and float outside the white canvas into the pink/tan background
	// grid". A building at x 1000 with width 140 reaches 1140, so a 920 canvas
	// left 220px of it outside.
	const out = await renderEditor([building(1, { x: 1000, width: 140 })], { width: 1180, height: 640 });
	try {
		assert.ok(
			out.stageWidth >= 1000 + 140 + CANVAS_EDGE_PADDING,
			`the canvas must grow to hold the building: stage ${out.stageWidth} vs required ${1000 + 140 + CANVAS_EDGE_PADDING}`,
		);
		const ground = groundRect(out.fills);
		assert.ok(ground.width >= 1140, `the painted ground must reach the building, got ${ground.width}`);
	} finally {
		out.unmount();
	}
});

test('36: the size function is total, and each of the three inputs can win', () => {
	const empty = campusEditorCanvasSize({ containerWidth: 0, containerHeight: 0, buildings: [] });
	assert.deepEqual(empty, { width: CANVAS_MIN_WIDTH, height: CANVAS_MIN_HEIGHT }, 'an unmeasured host must not collapse the canvas');

	const fromContainer = campusEditorCanvasSize({ containerWidth: 1400, containerHeight: 900, buildings: [building(1)] });
	assert.deepEqual(fromContainer, { width: 1400, height: 900 }, 'a large work area wins');

	const fromContent = campusEditorCanvasSize({
		containerWidth: 640,
		containerHeight: 400,
		buildings: [building(1, { x: 1500, width: 200, y: 900, height: 200 })],
	});
	assert.equal(fromContent.width, 1500 + 200 + CANVAS_EDGE_PADDING, 'content wins over a narrow work area');
	assert.equal(fromContent.height, 900 + 200 + CANVAS_EDGE_PADDING, 'on both axes');

	// A pathological host must not produce a NaN or a zero canvas.
	const junk = campusEditorCanvasSize({ containerWidth: Number.NaN, containerHeight: -10, buildings: [building(1)] });
	assert.deepEqual(junk, { width: CANVAS_MIN_WIDTH, height: CANVAS_MIN_HEIGHT }, 'a junk measurement falls back to the floor');
});

/* ── option 3: containment ────────────────────────────────────────────────── */

test('36: a placement is clamped fully inside the canvas, and never outside it', () => {
	const canvas = { w: 1000, h: 600 };
	const inside = clampBuildingToCanvas({ x: 10, y: 20, width: 100, height: 50 }, canvas.w, canvas.h);
	assert.deepEqual(inside, { x: 10, y: 20, width: 100, height: 50 }, 'a placement already inside is untouched, bit for bit');

	const offRight = clampBuildingToCanvas({ x: 980, y: 0, width: 120, height: 50 }, canvas.w, canvas.h);
	assert.equal(offRight.x, canvas.w - 120, 'a building over the right edge is pulled fully inside');
	assert.ok(offRight.x + 120 <= canvas.w);

	const offBoth = clampBuildingToCanvas({ x: -40, y: 1400, width: 100, height: 50 }, canvas.w, canvas.h);
	assert.equal(offBoth.x, 0, 'a negative x is pinned to the origin, not left negative');
	assert.equal(offBoth.y, canvas.h - 50, 'a building below the canvas is pulled up into it');

	// A building larger than the canvas: pinned to the origin, and the auto-grow
	// then makes a canvas that holds it. The clamp is never the reason a building
	// becomes unreachable.
	const huge = clampBuildingToCanvas({ x: 50, y: 50, width: 2000, height: 900 }, canvas.w, canvas.h);
	assert.deepEqual({ x: huge.x, y: huge.y }, { x: 0, y: 0 });
	const grown = campusEditorCanvasSize({ containerWidth: canvas.w, containerHeight: canvas.h, buildings: [huge] });
	assert.ok(grown.width >= huge.width && grown.height >= huge.height, 'the canvas grows to hold an oversized building');

	// Integer snapping is preserved, so the clamp cannot reintroduce sub-pixel drift.
	assert.equal(clampBuildingToCanvas({ x: 10.6, y: 20.4, width: 10, height: 10 }, 100, 100).x, 11);
	assert.equal(clampBuildingToCanvas({ x: 10.6, y: 20.4, width: 10, height: 10 }, 100, 100).y, 20);
});

test('36 RENDERED: the painted ground contains every building, and the buildings really painted', async () => {
	// The operator's sentence, read as an assertion: "all placed building nodes
	// remain completely inside the canvas surface".
	//
	// WHAT IS RENDERED AND WHAT IS AUTHORED, because the difference is load-bearing
	// and must not be papered over: the GROUND is read out of what Konva painted
	// (it carries no shadow, so it reaches the canvas sink), while each building's
	// rectangle is the prop the same render received — a building `Rect` DOES carry
	// a shadow, and Konva draws a shadowed shape into a detached buffer canvas, so
	// its fill never reaches the sink (the harness excludes those buffers, because
	// they redraw the same shape under a shadow offset). Asserting "the painted
	// ground holds the authored rects" is therefore a statement about the geometry
	// the render used, and the row below proves the buildings were rendered at all
	// by their painted names.
	const COLOURS = ['#0ea5e9', '#22c55e', '#f59e0b'];
	const buildings = [
		building(1, { x: 20, y: 20, color: COLOURS[0] }),
		building(2, { x: 1000, y: 500, color: COLOURS[1] }),
		building(3, { x: 700, y: 40, color: COLOURS[2] }),
	];
	const out = await renderEditor(buildings, { width: 1180, height: 640 });
	try {
		const ground = groundRect(out.fills);
		for (const b of buildings) {
			assert.ok(
				b.x >= ground.x && b.y >= ground.y
					&& b.x + b.width <= ground.x + ground.width
					&& b.y + b.height <= ground.y + ground.height,
				`building ${b.name} at ${b.x},${b.y} ${b.width}x${b.height} escapes the painted ground ${ground.width}x${ground.height}`,
			);
		}
		// The buildings are on the canvas, not silently dropped: each name painted.
		for (const b of buildings) {
			assert.ok(
				out.paintedText.includes(b.name),
				`"${b.name}" must be painted; painted: ${JSON.stringify(out.paintedText)}`,
			);
		}
	} finally {
		out.unmount();
	}
});

test('36: the base was clipped by arithmetic, so these controls can fail', () => {
	// Preconditions, so the rows above are known to discriminate. The base stage
	// was a constant; the clip follows from the editor's own layout.
	const baseStage = { width: 920, height: 580 };
	const APP_SIDEBAR_PX = 256;  // `ui/sidebar.tsx:17` SIDEBAR_WIDTH = 16rem
	const INSPECTOR_PX = 352;    // `w-88` on the editor's side panel
	const PANE_PADDING_PX = 32;  // `p-4` on both sides of the canvas column
	const workAreaAt1366 = 1366 - APP_SIDEBAR_PX - INSPECTOR_PX - PANE_PADDING_PX;
	assert.equal(workAreaAt1366, 726, 'the 1366px editor work area is arithmetic, not an estimate');
	assert.ok(
		baseStage.width - workAreaAt1366 > 0,
		`precondition: the fixed stage overflowed its wrapper by ${baseStage.width - workAreaAt1366}px, and the wrapper is overflow-hidden`,
	);
	// A building at the operator's x, on the base canvas, really did escape.
	const escaping = 1000 + 140;
	assert.ok(escaping > baseStage.width, `precondition: the building reached ${escaping} on a ${baseStage.width}px canvas`);
	assert.equal(CANVAS_MIN_WIDTH, 920, 'precondition: the floor is the old fixed width');
	assert.equal(CANVAS_MIN_HEIGHT, 580, 'precondition: the floor is the old fixed height');
});
