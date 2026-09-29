/**
 * A3 c11 — fix 36, RENDERED: the campus-map editor canvas is CONTAINED in the
 * work area it is given, and nothing is painted where it cannot be reached.
 *
 * THE OPERATOR'S OWN REQUEST (fix-2.docx, fix 36): "The rightmost building cards
 * are visibly clipped beneath the inspector rather than contained in an
 * auto-grown/full workspace canvas." The governing word is CONTAINED, and this
 * file holds the three things that word needs:
 *
 *   1. The stage is the MEASURED work area. The 920px minimum is gone — at the
 *      1366px default the column is 726px wide, so a 920px stage was the
 *      operator's 194px clip reproduced exactly (see the layout facts derived
 *      below, from the shell's own `SIDEBAR_WIDTH` and the page's own padding,
 *      not from a literal).
 *   2. Auto-grow still happens, and is now REACHABLE: the page's canvas column
 *      is the one bounded scroll region, asserted on the real page in
 *      `a3-c11-campus-overview-layout.test.tsx`.
 *   3. A drag is clamped by the same single `clampBuildingToCanvas` the draw and
 *      resize paths use, so containment does not rest on auto-grow alone. That
 *      row drives a real Konva `dragend` at the component's real handler.
 *
 * A PRIOR ROW IN THIS FILE ASSERTED THE DEFECT, and is superseded here rather
 * than deleted: "36 RENDERED: a NARROW work area keeps the old canvas as a floor,
 * never less" asserted `stageWidth === CANVAS_MIN_WIDTH` for a 640px host, i.e.
 * it required the 920px floor that CAUSED the clip. Its replacement — "a column
 * NARROWER than the old 920 floor is contained, not clipped" — is the opposite
 * assertion, and it fails on the old code. A proof artefact that cannot
 * discriminate is worse than no proof, so the row is kept, reversed, and named.
 *
 * WHY THIS RENDERS. The base stage was a hardcoded 920x580 inside an
 * `overflow-hidden` wrapper, and the clip is a property of the STAGE SIZE against
 * the CONTAINER width, so it is decidable from a real render: the harness reads
 * the stage's own size off the rendered layer canvas and the ground rect off what
 * Konva painted. jsdom has no layout engine, so the container width is supplied
 * by the harness (`setHostBox`) — that number is the test's INPUT, and everything
 * asserted below is read back out of the render. The editor is mounted inside a
 * region element carrying `data-campus-map-canvas-region`, exactly as
 * `pages/MapEditor.tsx` renders it, so the measurement under test is the
 * production one.
 *
 * WHAT IS NOT PROVEN HERE: rasterisation, a scrollbar, and hit-testing — jsdom
 * has none of them, and the harness's own header says so. The scroll-region
 * shape and the end-to-end sizing on the real page are the browser-adjacent
 * rows in `a3-c11-campus-overview-layout.test.tsx`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import test from 'node:test';

import { renderKonva, setHostBox, setupKonvaDom } from './konva-dom-render-harness';

const { act } = await setupKonvaDom('https://njgrm.buru-degree.ts.net/map?mode=editor');
const {
	CANVAS_EDGE_PADDING,
	CANVAS_USABILITY_FLOOR_HEIGHT,
	CANVAS_USABILITY_FLOOR_WIDTH,
	alignmentGuides,
	canvasWorkArea,
	clampBuildingToCanvas,
	campusEditorCanvasSize,
	drawRectFromPointer,
	transformOrigin,
} = await import('@/components/campus-map/campusEditorCanvas');
const { CampusMapEditor } = await import('@/components/CampusMapEditor');
type Building = import('@/types').Building;

/* ── the editor's real layout, derived from the sources that decide it ─────── */

/** `src/components/__tests__` → the package root. */
const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (relative: string): string => readFileSync(path.join(PKG_ROOT, relative), 'utf8');

/** Tailwind's spacing scale is 0.25rem per unit and the root font is 16px, so a
 *  spacing class is decidable rather than copied. */
const REM_PX = 16;
function spacingPx(cls: string): number {
	const unit = Number.parseFloat(cls.split('-')[1] ?? '');
	assert.ok(Number.isFinite(unit), `unparseable Tailwind spacing class: ${cls}`);
	return (unit / 4) * REM_PX;
}

/** The app sidebar, open by default: `ui/sidebar.tsx` `SIDEBAR_WIDTH = '16rem'`. */
const sidebarSource = read('src/ui/sidebar.tsx');
const sidebarRem = Number.parseFloat(/const SIDEBAR_WIDTH = '([\d.]+)rem'/.exec(sidebarSource)?.[1] ?? '');
assert.ok(Number.isFinite(sidebarRem), 'ui/sidebar.tsx must still declare SIDEBAR_WIDTH as a rem length');
assert.match(sidebarSource, /defaultOpen = true/, 'the sidebar must still be open by default, or this width is not the default one');
const APP_SIDEBAR_PX = sidebarRem * REM_PX;

/** The editor page's own layout: the inspector it draws beside, and the padding
 *  it puts on the canvas column. Read out of the classes it really renders. */
const mapEditorSource = read('src/pages/MapEditor.tsx');
const inspectorUnit = /className="w-(\d+(?:\.\d+)?)\s/.exec(mapEditorSource)?.[1];
assert.ok(inspectorUnit, 'pages/MapEditor.tsx must still render its inspector as a `w-N` column');
const INSPECTOR_PX = spacingPx(`w-${inspectorUnit}`);
const regionClass = /data-campus-map-canvas-region=""[\s\S]{0,400}?className="([^"]*)"/.exec(mapEditorSource)?.[1];
assert.ok(regionClass, 'pages/MapEditor.tsx must still name its canvas region');
const regionPaddingUnit = /(?:^|\s)p-(\d+(?:\.\d+)?)(?:\s|$)/.exec(regionClass)?.[1];
assert.ok(regionPaddingUnit, `the canvas region must still be padded, got class "${regionClass}"`);
const PANE_PADDING_PX = spacingPx(`p-${regionPaddingUnit}`) * 2;

/** The work area at the default 1366px viewport, with the sidebar open. This is
 *  the number the component measures in a browser, derived here from the same
 *  three facts — never a literal, so a layout change fails this loudly instead
 *  of silently agreeing with a stale expectation. */
const VIEWPORT_1366 = 1366;
const workAreaAt1366 = VIEWPORT_1366 - APP_SIDEBAR_PX - INSPECTOR_PX - PANE_PADDING_PX;
assert.equal(APP_SIDEBAR_PX, 256, 'ui/sidebar.tsx SIDEBAR_WIDTH = 16rem = 256px');
assert.equal(INSPECTOR_PX, 352, 'the editor inspector `w-88` = 22rem = 352px');
assert.equal(PANE_PADDING_PX, 32, 'the canvas column `p-4` = 16px a side = 32px');
assert.equal(workAreaAt1366, 726, `the 1366px editor work area is arithmetic, not an estimate; got ${workAreaAt1366}`);

/* ── the harness ──────────────────────────────────────────────────────────── */

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

/** The editor's own record shape: `Building` plus its edit bookkeeping. */
type EditorBuilding = Building & { dirty?: boolean; isNew?: boolean };

type EditorProps = { onBuildingsChange?: (next: EditorBuilding[]) => void };

/** Mount the editor the way the page does: inside a region element the canvas
 *  measures. `onBuildingsChange` is recorded so a gesture's RESULT can be read. */
async function renderEditor(buildings: Building[], host: { width: number; height: number }, props: EditorProps = {}) {
	setHostBox(host);
	let changes: EditorBuilding[][] = [];
	const out = await renderKonva(
		createElement,
		act,
		createElement(
			'div',
			{ 'data-campus-map-canvas-region': '', className: 'flex flex-col overflow-auto p-4', style: { position: 'relative' } },
			createElement(CampusMapEditor, {
				schoolId: 1,
				buildings: buildings.map((b) => ({ ...b })),
				campusImageUrl: null,
				onBuildingsChange: (next: EditorBuilding[]) => {
					changes.push(next);
					props.onBuildingsChange?.(next);
				},
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
	return { ...out, get changes() { return changes; } };
}

/**
 * The ground rect is the one LARGE filled shape — the canvas surface.
 *
 * A9 c4 changed the ORIGIN requirement here, and the reason is worth keeping:
 * this helper used to demand `x === 0 && y === 0`, which was true only while
 * the stage painted untransformed at the top-left of its box. A9 c4 item 36
 * paints the canvas through a fitted, VERTICALLY CENTRED stage transform (the
 * read-only overview has done this all along), so the ground legitimately paints
 * lower down. The `x === 0 && y === 0` clause is dropped, NOT the `exactly one`
 * clause: uniqueness is decided by the size filter, which no transformer anchor
 * or shadowed building rect can reach, and every row below still asserts the
 * ground's SIZE against the stage or the free area.
 */
function groundRect(fills: Array<{ x: number; y: number; width: number; height: number; fill: string }>) {
	const candidates = fills.filter((f) => f.width > 400 && f.height > 300);
	assert.equal(candidates.length, 1, `exactly one ground rect must be painted; got ${JSON.stringify(candidates)}`);
	return candidates[0];
}

/** The Konva Group that carries a building's name, found through the name Konva
 *  actually painted — not through an index or a class name.
 *
 *  `createRequire`, not `import`, on purpose: this file is ESM (it has a
 *  top-level await), so a bare `import('konva')` would load Konva's ESM build
 *  while `react-konva` and the component under test hold the CJS one — two
 *  instances, and the second one's `stages` registry is always empty. Konva
 *  says so itself: "Several Konva instances detected." */
async function buildingNode(name: string) {
	const required = createRequire(import.meta.url)('konva') as { default?: unknown; stages?: unknown };
	const Konva = (required.stages ? required : required.default) as { stages: unknown[] };
	assert.ok(Konva.stages.length > 0, 'the rendered editor must have registered its Konva stage');
	const stage = Konva.stages[Konva.stages.length - 1];
	/** Not every child of a Konva container is itself a Container (the background
	 *  `Rect` is not), so the walk asks before it descends. */
	const childrenOf = (node: unknown): unknown[] => {
		const getChildren = (node as { getChildren?: () => unknown[] }).getChildren;
		return typeof getChildren === 'function' ? getChildren.call(node) : [];
	};
	for (const child of childrenOf(childrenOf(stage)[0])) {
		for (const grand of childrenOf(child)) {
			const text = (grand as { text?: () => string }).text;
			if (typeof text === 'function' && text.call(grand) === name) {
				return child as { x(v: number): void; y(v: number): void; fire(type: string): void };
			}
		}
	}
	throw new Error(`no rendered building named "${name}"`);
}

/* ── the stage is the work area it is given ────────────────────────────────── */

test('36 RENDERED: the stage is the measured work area, at the real 1366px default', async () => {
	// The operator's default screen, sidebar open: 726px of work area. The old
	// 920px floor overflowed this column by 194px, and nothing in the chain could
	// scroll, so the rightmost buildings were painted out of reach. The stage must
	// now be the column — no horizontal overflow at all, and no scroll needed.
	const out = await renderEditor([building(1)], { width: workAreaAt1366, height: 640 });
	try {
		assert.equal(out.stageWidth, workAreaAt1366, `the stage must be the work area width, got ${out.stageWidth}`);
		assert.ok(
			out.stageWidth < 920,
			`the old 920 floor must not survive: the stage is ${out.stageWidth} in a ${workAreaAt1366}px column`,
		);
		assert.equal(out.stageHeight, 640, `the stage must be the work area height, got ${out.stageHeight}`);
		const ground = groundRect(out.fills);
		assert.equal(ground.width, out.stageWidth, 'the white ground must be as wide as the stage');
		assert.equal(ground.height, out.stageHeight, 'the white ground must be as tall as the stage');
	} finally {
		out.unmount();
	}
});

test('36 RENDERED: the stage is the work area at ANY width, never a fixed 920', async () => {
	// The direction that used to clip the other way, plus the narrow direction, so
	// the sizing is a measurement rather than a constant with a floor.
	for (const width of [1180, 940, workAreaAt1366, 512]) {
		const out = await renderEditor([building(1)], { width, height: 640 });
		try {
			assert.equal(out.stageWidth, width, `at a ${width}px column the stage must be ${width}, got ${out.stageWidth}`);
			const ground = groundRect(out.fills);
			assert.equal(ground.width, width, `the painted ground must reach the whole ${width}px column, got ${ground.width}`);
		} finally {
			out.unmount();
		}
	}
});

test('36 RENDERED: a column NARROWER than the old 920 floor is CONTAINED, not clipped', async () => {
	// SUPERSEDES the previous row "36 RENDERED: a NARROW work area keeps the old
	// canvas as a floor, never less", which asserted
	// `stageWidth === CANVAS_MIN_WIDTH` for a 640px host. That row required the
	// 920px floor THAT CAUSED the operator's clip, so it could not discriminate;
	// this is the same geometry with the opposite claim, and it fails on the old
	// code. Nothing is deleted — the old claim is recorded as the defect it was.
	const out = await renderEditor([building(1)], { width: 640, height: 400 });
	try {
		assert.equal(
			out.stageWidth,
			640,
			`a 640px column must CONTAIN the stage at 640, not clip a ${CANVAS_USABILITY_FLOOR_WIDTH}px floor; got ${out.stageWidth}`,
		);
		assert.equal(out.stageHeight, 400, `and the same on the vertical axis; got ${out.stageHeight}`);
	} finally {
		out.unmount();
	}
});

test('36: an UNMEASURED canvas takes the named usability floor, not the old 920', async () => {
	// A canvas mounted outside a region has no measurement to size itself from.
	// That is the only case the floor exists for, and it must be small, explicit
	// and reachable — the region scrolls for it. 920 was never a floor at all: it
	// was a fixed stage in a variable layout, which is the reported defect.
	const empty = campusEditorCanvasSize({ containerWidth: 0, containerHeight: 0, buildings: [] });
	assert.deepEqual(empty, { width: CANVAS_USABILITY_FLOOR_WIDTH, height: CANVAS_USABILITY_FLOOR_HEIGHT }, 'an unmeasured host takes the floor');
	assert.equal(CANVAS_USABILITY_FLOOR_WIDTH, 320, 'the floor is 320: a 960px window is the narrowest that fits this editor at all');
	assert.ok(CANVAS_USABILITY_FLOOR_WIDTH < workAreaAt1366, 'the floor must sit below every realistic column, or it clips again');

	// And nothing stands in for the pane: the floor cannot exceed the column the
	// page measured, because the page measures it.
	const at726 = campusEditorCanvasSize({ containerWidth: workAreaAt1366, containerHeight: 640, buildings: [building(1)] });
	assert.equal(at726.width, workAreaAt1366, 'the measured column wins over the floor');

	// A pathological host must not produce a NaN or a zero canvas.
	const junk = campusEditorCanvasSize({ containerWidth: Number.NaN, containerHeight: -10, buildings: [building(1)] });
	assert.deepEqual(junk, { width: CANVAS_USABILITY_FLOOR_WIDTH, height: CANVAS_USABILITY_FLOOR_HEIGHT }, 'a junk measurement falls back to the floor');
});

test('36: the work area is the region box less its padding and its two content bands', () => {
	// Exactly what the component measures: the region's border box, its own
	// padding from `getComputedStyle`, and what it paints above/below the canvas.
	// The expected numbers are the layout facts derived at the top of this file.
	const regionWidth = workAreaAt1366 + PANE_PADDING_PX; // the column includes its own padding
	const band = spacingPx(`p-${regionPaddingUnit}`); // 16px of `p-4` on the top edge
	const work = canvasWorkArea({
		regionWidth,
		regionHeight: 700,
		paddingTop: band,
		paddingRight: band,
		paddingBottom: band,
		paddingLeft: band,
		contentAbove: 92, // page header + gap + editor toolbar, from `offsetTop`
		contentBelow: 20, // the status bar's own height, from `offsetHeight`
	});
	assert.deepEqual(work, { width: workAreaAt1366, height: 700 - band * 2 - 92 - 20 }, 'the arithmetic is the region box, nothing else');

	// A region that cannot answer a measurement yields 0, which the size function
	// then floors — never a NaN canvas.
	assert.deepEqual(
		canvasWorkArea({ regionWidth: Number.NaN, regionHeight: -1, paddingTop: 16, paddingRight: 16, paddingBottom: 16, paddingLeft: 16, contentAbove: 0, contentBelow: 0 }),
		{ width: 0, height: 0 },
		'an unmeasurable region reads as unmeasured',
	);
	// And a region smaller than its own content cannot produce a negative canvas.
	const over = canvasWorkArea({ regionWidth: 200, regionHeight: 200, paddingTop: 16, paddingRight: 16, paddingBottom: 16, paddingLeft: 16, contentAbove: 500, contentBelow: 500 });
	assert.deepEqual(over, { width: 168, height: 0 }, 'a negative remainder is clamped, never propagated');
});

/* ── auto-grow, which the scroll region makes reachable ────────────────────── */

test('36 RENDERED: a building past the old 920 edge makes the canvas grow', async () => {
    // The operator's own case: a building at x 1000 reaches 1140, well past the
    // old 920 canvas. Growth still happens; what changed is that the region's
    // scroll container makes the grown area reachable instead of clipped.
    const out = await renderEditor([building(1, { x: 1000, width: 140 })], { width: workAreaAt1366, height: 640 });
    try {
        const required = 1000 + 140 + CANVAS_EDGE_PADDING;
        assert.ok(
            out.stageWidth >= required,
            `the canvas must grow to hold the building: stage ${out.stageWidth} vs required ${required}`,
        );
        assert.ok(out.stageWidth > workAreaAt1366, 'and it must genuinely exceed the column, which is what the region then scrolls');
        const ground = groundRect(out.fills);
        // A9 c4 SUPERSEDES the third claim this row used to make —
        //     assert.ok(ground.width >= 1140, 'the painted ground must reach the building')
        // — and it is recorded here rather than deleted (AGENTS.md §16). WHY it had
        // to go: the harness composes every recorded rect with the transform Konva
        // set immediately before it (`konva-dom-render-harness.ts` `point`/`abs`),
        // so a FITTED stage paints the ground at the fitted size. A9 c4 item 36 is
        // precisely the operator's sentence "no building may sit under the panel …
        // fit the canvas to the free area", so a control that REQUIRES a painted
        // ground as wide as the content asserts the defect as if it were correct.
        // The two STAGE-ATTRIBUTE claims above are untouched and still pass, which
        // is the part of this row that is about the accepted size contract.
        // Its replacement is "36+A9C4 RENDERED: the ground PAINTS fitted to the free
        // area while the stage attribute still grows" in `a9-c4-map-fit.test.tsx`,
        // which runs from the committed `test:a9-c4-map-fit` script.
        assert.ok(
            ground.width <= workAreaAt1366 + 1,
            `the painted ground must now FIT the ${workAreaAt1366}px free area, got ${ground.width}`,
        );
    } finally {
        out.unmount();
    }
});

test('36: the size function is total, and each of the three inputs can win', () => {
	const fromContainer = campusEditorCanvasSize({ containerWidth: 1400, containerHeight: 900, buildings: [building(1)] });
	assert.deepEqual(fromContainer, { width: 1400, height: 900 }, 'a large work area wins');

	const fromContent = campusEditorCanvasSize({
		containerWidth: 640,
		containerHeight: 400,
		buildings: [building(1, { x: 1500, width: 200, y: 900, height: 200 })],
	});
	assert.equal(fromContent.width, 1500 + 200 + CANVAS_EDGE_PADDING, 'content wins over a narrow work area');
	assert.equal(fromContent.height, 900 + 200 + CANVAS_EDGE_PADDING, 'on both axes');

	// A building larger than the floor is held whole, so the clamp is never the
	// reason a building becomes unreachable.
	const huge = clampBuildingToCanvas({ x: 50, y: 50, width: 2000, height: 900 }, 640, 400);
	assert.deepEqual({ x: huge.x, y: huge.y }, { x: 0, y: 0 });
	const grown = campusEditorCanvasSize({ containerWidth: 640, containerHeight: 400, buildings: [huge] });
	assert.ok(grown.width >= huge.width && grown.height >= huge.height, 'the canvas grows to hold an oversized building');
});

/* ── containment: draw, resize AND drag, through the one clamp ─────────────── */

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

	// Integer snapping is preserved, so the clamp cannot reintroduce sub-pixel drift.
	assert.equal(clampBuildingToCanvas({ x: 10.6, y: 20.4, width: 10, height: 10 }, 100, 100).x, 11);
	assert.equal(clampBuildingToCanvas({ x: 10.6, y: 20.4, width: 10, height: 10 }, 100, 100).y, 20);
});

test('36 RENDERED: a DRAG past the right/bottom edge lands contained, not off-canvas', async () => {
	// The operator's own gesture, at the real default geometry. This fires a
	// genuine Konva `dragend` at the component's real `handleDragEnd`, so the row
	// fails if the clamp is removed from the drag path — which is exactly how the
	// previous cycle shipped a drag that could still escape a 726px column.
	const dragged = building(1, { x: 20, y: 20, width: 120, height: 80 });
	const out = await renderEditor([dragged], { width: workAreaAt1366, height: 640 });
	try {
		const node = await buildingNode(dragged.name);
		await act(async () => {
			node.x(workAreaAt1366 + 400);
			node.y(640 + 400);
			node.fire('dragend');
		});
		assert.equal(out.changes.length, 1, `the drag must reach onBuildingsChange exactly once; got ${out.changes.length}`);
		const placed = out.changes[0][0];
		assert.equal(placed.x, workAreaAt1366 - dragged.width, 'a drag off the right edge lands flush inside it');
		assert.equal(placed.y, 640 - dragged.height, 'a drag below the bottom lands flush inside it');
		assert.ok(placed.x >= 0 && placed.y >= 0, 'and never at a negative coordinate');
		assert.ok(placed.dirty === true, 'the move is still recorded as a dirty change');
	} finally {
		out.unmount();
	}
});

test('36: a drag already inside the canvas is untouched, and the other two gestures agree', () => {
	// The clamp must not move a placement that already fits, or every drag would
	// jump. And the ONE clamp is what the draw, drag and resize paths share, so
	// their verdicts on the same off-canvas placement cannot differ.
	const canvas = { w: 726, h: 640 };
	const size = { width: 120, height: 80 };
	const fits = clampBuildingToCanvas({ x: 300, y: 200, ...size }, canvas.w, canvas.h);
	assert.deepEqual(fits, { x: 300, y: 200, ...size }, 'a placement that already fits is untouched, bit for bit');
	assert.deepEqual(
		drawRectFromPointer({ x: 700, y: 600 }, { x: 900, y: 800 }),
		{ x: 700, y: 600, width: 200, height: 200 },
		'a draw gesture normalises a backwards drag to a positive rect',
	);
	assert.deepEqual(
		drawRectFromPointer({ x: 300, y: 200 }, { x: 100, y: 120 }),
		{ x: 100, y: 120, width: 200, height: 80 },
		'and anchors it up-left when the pointer leads',
	);
	// An anchored resize keeps the opposite handle fixed: the origin moves by
	// exactly the change in that handle's offset.
	const resized = transformOrigin({
		building: { x: 100, y: 100, width: 100, height: 100, rotation: 0 },
		activeAnchor: 'top-left',
		nodeX: 0,
		nodeY: 0,
		newWidth: 200,
		newHeight: 100,
		newRotation: 0,
	});
	assert.deepEqual(resized, { x: 0, y: 100 }, 'growing from the top-left anchor moves only x');
});

test('36: snap guides are the moving edges that line up, within the named threshold', () => {
	// The full verdict for one alignment, so the row pins every edge rule rather
	// than a convenient subset: a moving box whose left is 4px from the other's
	// left snaps on that edge AND on both the right and centre edges, which all
	// land within 4px of the other's.
	const others = [{ x: 300, y: 400, width: 100, height: 60 }];
	assert.deepEqual(
		alignmentGuides({ x: 304, y: 400, width: 100, height: 60 }, others),
		[{ x: 300 }, { x: 400 }, { x: 350 }, { y: 400 }, { y: 460 }, { y: 430 }],
		'left-left, right-right, centre-centre, top-top, bottom-bottom and centre-centre all snap',
	);
	assert.deepEqual(alignmentGuides({ x: 0, y: 0, width: 10, height: 10 }, others), [], 'a building nowhere near another gets no guide');
	assert.deepEqual(alignmentGuides({ x: 309, y: 0, width: 10, height: 10 }, others), [], 'a gap of 9px is past the 5px threshold');
});

/* ── the ground really contains what is painted on it ──────────────────────── */

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
		building(2, { x: 400, y: 500, color: COLOURS[1] }),
		building(3, { x: 200, y: 40, color: COLOURS[2] }),
	];
	const out = await renderEditor(buildings, { width: workAreaAt1366, height: 640 });
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
	// was a constant; the clip follows from the editor's own layout — the same
	// three facts the rows above derive.
	const baseStage = { width: 920, height: 580 };
	assert.ok(
		baseStage.width - workAreaAt1366 > 0,
		`precondition: the fixed stage overflowed the default work area by ${baseStage.width - workAreaAt1366}px, and the chain had no scroll region`,
	);
	// A building at the operator's x, on the base canvas, really did escape.
	const escaping = 1000 + 140;
	assert.ok(escaping > baseStage.width, `precondition: the building reached ${escaping} on a ${baseStage.width}px canvas`);
	// And the two assertions that make the fix falsifiable, stated as the old
	// values so a reviewer can see exactly which claims changed.
	assert.ok(
		campusEditorCanvasSize({ containerWidth: 640, containerHeight: 400, buildings: [] }).width < baseStage.width,
		'a 640px column must no longer be widened to the old fixed stage',
	);
	assert.deepEqual(
		clampBuildingToCanvas({ x: 900, y: 700, width: 120, height: 80 }, 726, 640),
		{ x: 606, y: 560, width: 120, height: 80 },
		'an off-canvas drag into the default work area lands flush inside it',
	);
});
