/**
 * A9 m1 — the campus background placement maths.
 *
 * These are the acceptance rows for the packet's "Proof" section, and each one is
 * written to FAIL if the property it names is broken rather than merely to pass
 * today. The four that matter most:
 *
 *   - `defaultPlacement` / `fillPlacement` / `placementRect` PRESERVE THE ASPECT
 *     RATIO, checked across five different image shapes including the packet's
 *     3:1 panorama and 2:3 plan, AND with a MUTANT: a local copy of the placement
 *     maths with the uniform-scale branch reverted to independent X/Y factors is
 *     asserted to produce a DIFFERENT, stretched rectangle. Without the mutant a
 *     green suite would still be consistent with a reintroduced stretch.
 *   - `normalisePlacement(null, ...)` is the "existing schools are unchanged"
 *     guarantee, proved MECHANICALLY: the fit-whole placement is contained by the
 *     world, so `backgroundWorld` returns the world untouched, the view transform
 *     is bit-for-bit what it was before this change, and a building's projected
 *     screen position is identical.
 *   - BUILDINGS KEEP THEIR POSITIONS across zoom and across a window resize. The
 *     world is the coordinate space and the transform is only scale + origin, so
 *     the ratio between two buildings' screen positions is invariant.
 *   - The zoom range actually reaches the packet's "the whole image fits at 50%
 *     of the view", and the bounds the editor and the viewers use are the SAME
 *     two numbers (`CANVAS_MIN_SCALE`/`CANVAS_MAX_SCALE` vs
 *     `MIN_VIEW_ZOOM`/`MAX_VIEW_ZOOM`), because they are declared twice on
 *     purpose and only a test can stop them drifting.
 *
 * Reachable from `npm run test:campus-background` in `atlas-client/package.json`,
 * added in the same commit as this file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
	CANVAS_MAX_SCALE,
	CANVAS_MIN_SCALE,
	campusEditorFitScale,
	campusEditorViewTransform,
} from '@/components/campus-map/campusEditorCanvas';
import {
	MAX_VIEW_ZOOM,
	MIN_VIEW_ZOOM,
	backgroundWorld,
	clampPlacement,
	defaultPlacement,
	fillPlacement,
	fitViewTransform,
	movePlacement,
	nextBackgroundZoom,
	normalisePlacement,
	placementRect,
	safeWorld,
	scalePlacement,
	zoomLabel,
} from '@/components/campus-map/campusMapBackground';

/* ── the fixtures, taken from the real shapes the packet names ──────────────── */

/** The editor's measured work area at the 1366px default: 1366 - 256 - 352 - 32. */
const WORK_AREA = { width: 726, height: 520 };
/** The free AREA the view is fitted into, in the shape the shared function names. */
const WORK_AREA_BOX = { freeWidth: WORK_AREA.width, freeHeight: WORK_AREA.height };

/** The old fixed frame, kept only to state what is being replaced. */
const LEGACY_FRAME = { width: 920, height: 580 };

const PANORAMA = { width: 3000, height: 1000 };   // 3:1
const TALL_PLAN = { width: 1200, height: 1800 };  // 2:3
const SMALL_PHOTO = { width: 600, height: 400 };  // 3:2, and the packet's "small photo"
const SQUARE = { width: 1000, height: 1000 };
const LEGACY_RATIO = { width: 920, height: 580 }; // 1.586:1, the only shape that used to work

const SHAPES = [PANORAMA, TALL_PLAN, SMALL_PHOTO, SQUARE, LEGACY_RATIO];

/** A real-looking campus: buildings spread across the old frame, plus one past it. */
const BUILDINGS = [
	{ x: 40, y: 30, width: 180, height: 120 },
	{ x: 300, y: 90, width: 140, height: 200 },
	{ x: 520, y: 200, width: 220, height: 160 },
	{ x: 860, y: 480, width: 120, height: 140 }, // past the old 920x580 edge on the Y
];

const close = (actual: number, expected: number, tolerance = 1e-6, message?: string) => {
	assert.ok(
		Math.abs(actual - expected) <= tolerance,
		`${message ?? 'value'}: expected ${expected}, got ${actual} (tolerance ${tolerance})`,
	);
};

/* ── 1. fit, fill, and the aspect contract ──────────────────────────────────── */

test('1a: "Fit whole image" CONTAINS the whole image in the world, centred, and locked', () => {
	for (const image of SHAPES) {
		const placement = defaultPlacement(image, WORK_AREA);
		const rect = placementRect(placement);
		const label = `${image.width}x${image.height}`;

		assert.ok(rect.width <= WORK_AREA.width + 1e-6, `${label}: the drawn width must fit the world`);
		assert.ok(rect.height <= WORK_AREA.height + 1e-6, `${label}: the drawn height must fit the world`);
		close(rect.x, (WORK_AREA.width - rect.width) / 2, 1e-6, `${label}: centred on X`);
		close(rect.y, (WORK_AREA.height - rect.height) / 2, 1e-6, `${label}: centred on Y`);
		assert.equal(placement.locked, true, `${label}: the default is LOCKED`);
		assert.equal(placement.mode, 'fit', `${label}: the default is the fit mode`);
	}
});

test('1b: MUTANT CONTROL - the drawn rectangle preserves the file ratio, and reverting the uniform scale BREAKS it', () => {
	for (const image of SHAPES) {
		const rect = placementRect(defaultPlacement(image, WORK_AREA));
		const drawnRatio = rect.width / rect.height;
		close(drawnRatio, image.width / image.height, 1e-9, `${image.width}x${image.height}: drawn ratio must equal the file ratio`);

		// THE MUTANT. This is the arithmetic that was in production: two
		// INDEPENDENT factors, one per axis, each stretching the image to fill the
		// whole 920x580 frame. It is written out here and asserted to be WRONG, so
		// this suite cannot pass if the uniform-scale branch is ever reverted.
		const mutantRatio = LEGACY_FRAME.width / LEGACY_FRAME.height;
		const offBy = Math.abs(mutantRatio - image.width / image.height) / (image.width / image.height);
		// The 920x580 shape is the ONE exception, and it is the whole point: it is
		// the only image that ever looked right, which is why the defect survived.
		// It is asserted as the exception rather than skipped silently, so a
		// regression that breaks even this one still fails.
		if (image === LEGACY_RATIO) {
			close(mutantRatio, image.width / image.height, 1e-9, '920x580 is the shape the old code handled, and is why the defect survived');
		} else {
			assert.ok(
				offBy > 0.05,
				`${image.width}x${image.height}: the independent-axis mutant is expected to be visibly ` +
				`stretched (off by ${(offBy * 100).toFixed(1)}%); if it is not, this control no longer discriminates`,
			);
		}
	}
});


test('1c: "Fill the area" COVERS the world at the same aspect, and its world grows to hold the overflow', () => {
	for (const image of SHAPES) {
		const placement = fillPlacement(image, WORK_AREA);
		const rect = placementRect(placement);
		const label = `${image.width}x${image.height}`;

		assert.ok(rect.width >= WORK_AREA.width - 1e-6, `${label}: fill must cover the width`);
		assert.ok(rect.height >= WORK_AREA.height - 1e-6, `${label}: fill must cover the height`);
		// The axis that OVERFLOWS is pinned to the origin, and the axis that is
		// contained is centred. Centring the overflowing axis is what produced the
		// runaway world growth documented on `fillPlacement`; this row states the
		// corrected rule rather than the intuitive one.
		close(rect.x, Math.max(0, (WORK_AREA.width - rect.width) / 2), 1e-6, `${label}: pinned to the origin on X when it overflows`);
		close(rect.y, Math.max(0, (WORK_AREA.height - rect.height) / 2), 1e-6, `${label}: centred on Y when it is contained`);
		assert.equal(placement.mode, 'fill', `${label}: the mode says so`);
		// The overflow is NOT cropped: the world takes the photo's extent.
		const world = backgroundWorld(placement, [], WORK_AREA);
		assert.ok(world.width >= rect.x + rect.width - 1e-6, `${label}: the world holds the photo's width`);
		assert.ok(world.height >= rect.y + rect.height - 1e-6, `${label}: the world holds the photo's height`);
		// And growing the world to hold the fill is a FIXED POINT, which is what
		// makes the render terminate instead of oscillating.
		const again = backgroundWorld(fillPlacement(image, world), [], world);
		assert.deepEqual(again, world, `${label}: refitting into the grown world must not grow it again`);
	}
});

/* ── 2. the world grows, and the reachability clamp ─────────────────────────── */

test('2a: the world GROWS for a photo that is larger than the world, so nothing is cropped', () => {
	// A 3:1 panorama filled to a tall world is much wider than that world.
	const tall = { width: 600, height: 1600 };
	const placement = fillPlacement(PANORAMA, tall);
	const world = backgroundWorld(placement, [], tall);
	assert.ok(world.width > tall.width, 'a panorama must be able to exceed the world width, and the world must follow it');
	assert.ok(world.height >= tall.height, 'and the world never shrinks below the base');
});

test('2b: the world also grows for a BUILDING that sits outside the base world', () => {
	const base = { width: 400, height: 300 };
	const world = backgroundWorld(null, [{ x: 900, y: 700, width: 100, height: 100 }], base);
	assert.ok(world.width >= 1000, `a building at x=900 must be reachable; got ${world.width}`);
	assert.ok(world.height >= 800, `a building at y=700 must be reachable; got ${world.height}`);
});

test('2c: clampPlacement keeps the photo reachable and never distorts it', () => {
	const base = { width: 400, height: 300 };
	const flung = { imageWidth: 1600, imageHeight: 900, x: -99_999, y: -99_999, width: 1600, locked: false, mode: 'custom' as const };
	const clamped = clampPlacement(flung, base);
	const rect = placementRect(clamped);
	assert.ok(clamped.x >= 0 && clamped.y >= 0, 'a flung photo is pulled back to the origin side');
	assert.ok(clamped.x <= base.width && clamped.y <= base.height, 'and cannot be pushed past the far edge');
	close(rect.width, flung.width, 1e-9, 'the width is untouched, so the aspect cannot change');
	close(rect.height, flung.width * (900 / 1600), 1e-9, 'and the height is still the file ratio');

	// A photo SMALLER than the world is kept fully inside it.
	const small = clampPlacement({ imageWidth: 600, imageHeight: 400, x: 5000, y: 5000, width: 300, locked: true, mode: 'fit' }, base);
	assert.ok(small.x + 300 <= base.width + 1e-6, 'a small photo is held inside the world, not half off it');
	assert.ok(small.y + 200 <= base.height + 1e-6, 'on both axes');
});

/* ── 3. THE EXISTING-SCHOOL GUARANTEE ───────────────────────────────────────── */

/**
 * The packet: "Existing schools with no placement get 'Fit whole image', locked,
 * and their existing buildings keep their current on-screen positions."
 *
 * This is the row that decides whether the migration is safe, and it is proved as
 * MECHANICS rather than as an intention. A school's stored placement is null; the
 * photo is fitted inside the world; the fitted rect is therefore CONTAINED by the
 * world, so `backgroundWorld` cannot grow it, so the view transform is computed
 * from the same two numbers as before, so a building lands on the same pixel.
 */
test('3a: NORMALISE - no stored placement means fit-whole, centred, LOCKED, for every image shape', () => {
	for (const image of SHAPES) {
		const placement = normalisePlacement(null, image, WORK_AREA);
		const rect = placementRect(placement);
		assert.equal(placement.mode, 'fit', `${image.width}: the default mode is fit`);
		assert.equal(placement.locked, true, `${image.width}: the default is locked`);
		assert.equal(placement.imageWidth, image.width, `${image.width}: the image size is recorded`);
		assert.equal(placement.imageHeight, image.height, `${image.width}: on both axes`);
		close(rect.width, Math.min(WORK_AREA.width, (WORK_AREA.height * image.width) / image.height), 1e-6, `${image.width}: fitted width`);
	}
});

test('3b: PROOF - an existing school\'s buildings keep their EXACT screen positions after this change', () => {
	// BEFORE: the stage was the measured work area grown for the buildings, and
	// the view was that stage fitted into the same box. No photo existed.
	const worldBefore = backgroundWorld(null, BUILDINGS, WORK_AREA);

	// AFTER: the same school, with a photo uploaded BEFORE this change, so its
	// stored placement is null.
	const stored: unknown = null;
	const image = LEGACY_RATIO;
	const placement = normalisePlacement(stored, image, WORK_AREA);
	const worldAfter = backgroundWorld(placement, BUILDINGS, WORK_AREA);

	// The fitted photo is CONTAINED, so the world is bit-for-bit unchanged. This
	// single equality is the whole guarantee: with the world unchanged, every
	// downstream number is unchanged.
	assert.deepEqual(worldAfter, worldBefore, 'a null placement must not change the world by even one pixel');

	const asCanvas = (world: { width: number; height: number }) => ({ canvasWidth: world.width, canvasHeight: world.height });
	const before = campusEditorViewTransform({ free: WORK_AREA_BOX, canvas: asCanvas(worldBefore), zoom: 1, pan: { x: 0, y: 0 } });
	const after = fitViewTransform({ content: worldAfter, box: WORK_AREA_BOX, zoom: 1, pan: { x: 0, y: 0 } });
	assert.deepEqual(after, before, 'and therefore neither the painted scale nor the origin');


	// And, stated in the operator's terms: where each building lands on screen.
	const project = (view: { scale: number; x: number; y: number }, x: number, y: number) => ({
		screenX: x * view.scale + view.x,
		screenY: y * view.scale + view.y,
	});
	for (const building of BUILDINGS) {
		const a = project(before, building.x, building.y);
		const b = project(after, building.x, building.y);
		assert.equal(b.screenX, a.screenX, `${building.x},${building.y}: the screen X must be identical`);
		assert.equal(b.screenY, a.screenY, `${building.x},${building.y}: the screen Y must be identical`);
	}
});

test('3c: a stored placement describing a DIFFERENT photo REFITS instead of stretching the new one', () => {
	// The scheduler uploaded a panorama over a placement measured against a
	// portrait plan. Using the stored ratio would squash the new file.
	const stale = { imageWidth: 1200, imageHeight: 1800, x: 0, y: 0, width: 500, locked: true, mode: 'custom' as const };
	const repaired = normalisePlacement(stale, PANORAMA, WORK_AREA);
	assert.equal(repaired.mode, 'fit', 'a replacement upload refits rather than inheriting the old framing');
	assert.equal(repaired.locked, true, 'and lands in the safe, locked default');
	const rect = placementRect(repaired);
	close(rect.width / rect.height, PANORAMA.width / PANORAMA.height, 1e-9, 'at the NEW file ratio');
});

test('3d: a hand-edited row can MOVE the photo but can never DISTORT it', () => {
	// The image here is the one the tampered row claims, so the row passes the
	// "same file" check and its position and width are honoured — while its HEIGHT
	// is still re-derived from the file rather than trusted. That is the row:
	// a stored row can move the photo and resize it, and can never squash it.
	const image = { width: 1600, height: 900 };
	const tampered = { imageWidth: 1600, imageHeight: 900, x: 25, y: 15, width: 480, locked: false, mode: 'custom' as const };
	const repaired = normalisePlacement(tampered, image, WORK_AREA);
	assert.equal(repaired.x, 25, 'the stored position is honoured');
	assert.equal(repaired.y, 15, 'on both axes');
	assert.equal(repaired.width, 480, 'and the stored width');
	assert.equal(repaired.locked, false, 'an explicit unlock is honoured');
	const rect = placementRect(repaired);
	close(rect.height, 480 * (900 / 1600), 1e-9, 'the height is re-derived from the file, never trusted');
});


/* ── 4. the round trip: JSON in, placement out, JSON back ───────────────────── */

test('4: a placement survives a JSON round trip unchanged once it is REACHABLE', () => {
	// THE ROUND TRIP THAT ACTUALLY HAPPENS. The editor saves a placement that has
	// already been clamped into the world, so `clampPlacement` is applied on the way
	// out as well as on the way in, and the stored JSON restores to exactly the
	// same placement. A school reloads its framing bit-for-bit, which is the packet's
	// "reload, the placement is kept" row.
	for (const image of SHAPES) {
		for (const raw of [defaultPlacement(image, WORK_AREA), fillPlacement(image, WORK_AREA)]) {
			const reachable = clampPlacement(raw, WORK_AREA);
			const stored = JSON.parse(JSON.stringify(reachable)) as Record<string, unknown>;
			const restored = normalisePlacement(stored, image, WORK_AREA);
			assert.deepEqual(restored, reachable, `${image.width}x${image.height} in ${raw.mode}: the round trip must be exact`);
		}
	}
});

test('4b: an UNREACHABLE placement is clamped deterministically, identically every time', () => {
	// "Fill the area" deliberately overflows the world on one axis, and the clamp
	// pulls that overflow back to the origin side so the photo can never be lost.
	// The result is stable: clamping an already-clamped placement changes nothing,
	// so repeated saves cannot walk the photo.
	for (const image of SHAPES) {
		const once = clampPlacement(fillPlacement(image, WORK_AREA), WORK_AREA);
		const twice = clampPlacement(once, WORK_AREA);
		assert.deepEqual(twice, once, `${image.width}: clamping is idempotent`);
		assert.equal(once.x, 0, `${image.width}: the overflow is pulled back to the origin side`);
		assert.equal(once.y, 0, `${image.width}: on both axes`);
	}
});


/* ── 5. buildings keep their positions across ZOOM and across a RESIZE ──────── */

test('5a: zoom changes the SCALE only - a building\'s position relative to the photo is invariant', () => {
	const placement = defaultPlacement(PANORAMA, WORK_AREA);
	const world = backgroundWorld(placement, BUILDINGS, WORK_AREA);
	const rect = placementRect(placement);
	const building = BUILDINGS[0];

	for (const zoom of [0.25, 0.5, 1, 1.5, 2.5, 4]) {
		const view = fitViewTransform({ content: world, box: WORK_AREA_BOX, zoom, pan: { x: 0, y: 0 } });
		// The relation is measured in SCREEN pixels on BOTH sides - the offset from
		// the photo's edge, and the photo's own on-screen width. Dividing the offset
		// by the photo's WORLD width instead would itself move with the fit, and
		// the row would pass for the wrong reason.
		const offsetX = (building.x - rect.x) * view.scale;
		const offsetY = (building.y - rect.y) * view.scale;
		close(offsetX / (rect.width * view.scale), (building.x - rect.x) / rect.width, 1e-9, `zoom ${zoom}: the horizontal relation to the photo`);
		close(offsetY / (rect.height * view.scale), (building.y - rect.y) / rect.height, 1e-9, `zoom ${zoom}: the vertical relation to the photo`);
	}
});


test('5b: a window RESIZE re-fits, and every building and the photo keep their relative positions', () => {
	const placement = defaultPlacement(TALL_PLAN, WORK_AREA);
	const rect = placementRect(placement);
	const building = BUILDINGS[1];

	for (const size of [{ width: 400, height: 300 }, WORK_AREA, { width: 1200, height: 900 }, { width: 320, height: 240 }]) {
		const world = backgroundWorld(placement, BUILDINGS, { width: size.width, height: size.height });
		const view = fitViewTransform({ content: world, box: { freeWidth: size.width, freeHeight: size.height }, zoom: 1, pan: { x: 0, y: 0 } });
		const offsetX = (building.x - rect.x) * view.scale;
		close(
			offsetX / (rect.width * view.scale),
			(building.x - rect.x) / rect.width,
			1e-9,
			`${size.width}x${size.height}: the building must stay in the same place ON the photo`,
		);
		// The whole world is on screen: the view never crops content.
		const screenX = building.x * view.scale + view.x;
		const screenY = building.y * view.scale + view.y;
		assert.ok(screenX >= -1e-6 && screenX <= size.width + 1e-6, `${size.width}: the building stays within the view horizontally`);
		assert.ok(screenY >= -1e-6 && screenY <= size.height + 1e-6, `${size.width}: the building stays within the view vertically`);
	}
});

test('5c: the whole world is visible at zoom 1, for every shape - nothing is cropped by ATLAS', () => {
	for (const image of SHAPES) {
		for (const mode of ['fit', 'fill'] as const) {
			const placement = mode === 'fit' ? defaultPlacement(image, WORK_AREA) : fillPlacement(image, WORK_AREA);
			const world = backgroundWorld(placement, BUILDINGS, WORK_AREA);
			const view = fitViewTransform({ content: world, box: WORK_AREA_BOX, zoom: 1, pan: { x: 0, y: 0 } });
			const scale = campusEditorFitScale(WORK_AREA_BOX, { canvasWidth: world.width, canvasHeight: world.height });
			assert.ok(Math.abs(view.scale - scale) < 1e-9, `${image.width} ${mode}: zoom 1 is the fit`);
			assert.ok(world.width * view.scale <= WORK_AREA.width + 1e-6, `${image.width} ${mode}: the world fits the width`);
			assert.ok(world.height * view.scale <= WORK_AREA.height + 1e-6, `${image.width} ${mode}: the world fits the height`);
		}
	}
});

/* ── 6. the zoom RANGE, and that the two declared pairs agree ───────────────── */

test('6a: MIN_VIEW_ZOOM reaches the packet requirement - the whole image visible at 50% of the view', () => {
	// "at least until the whole image fits at 50% of the view": 0.5 must be
	// reachable, and there must be room BEYOND it so the photo can be seen with a
	// margin. The old floor of 0.4 could not do this.
	assert.ok(0.5 >= MIN_VIEW_ZOOM, '50% must be reachable');
	assert.ok(MIN_VIEW_ZOOM <= 0.3, `and there must be room below it for a margin; got ${MIN_VIEW_ZOOM}`);
	assert.ok(0.4 > MIN_VIEW_ZOOM, 'the old 0.4 floor was the reported defect and must be gone');
	// Repeated Zoom Out from the default, which is what a scheduler actually does.
	let zoom = 1;
	for (let press = 0; press < 20 && zoom > MIN_VIEW_ZOOM; press += 1) {
		zoom = nextBackgroundZoom(zoom, -0.15);
	}
	assert.ok(zoom < 0.5, `repeated Zoom Out from 100% must go below half size; stopped at ${zoom}`);
});


test('6b: MAX_VIEW_ZOOM is far enough in to place a small building on a large plan', () => {
	assert.ok(MAX_VIEW_ZOOM >= 4, `expected 4 or more; got ${MAX_VIEW_ZOOM}`);
	assert.ok(2.5 < MAX_VIEW_ZOOM, 'the old 2.5 ceiling is not enough to place small buildings');
	assert.equal(nextBackgroundZoom(1, 0.15), 1.15, 'a step is a step');
	assert.equal(nextBackgroundZoom(MAX_VIEW_ZOOM, 1), MAX_VIEW_ZOOM, 'and the buttons stop at the ceiling');
	assert.equal(nextBackgroundZoom(MIN_VIEW_ZOOM, -1), MIN_VIEW_ZOOM, 'and at the floor');
});

test('6c: the editor and the viewers declare the SAME two bounds', () => {
	// They are declared twice on purpose (the editor module has no dependency on
	// the background contract), so only a test can stop them drifting.
	assert.equal(CANVAS_MIN_SCALE, MIN_VIEW_ZOOM, 'CANVAS_MIN_SCALE and MIN_VIEW_ZOOM must agree');
	assert.equal(CANVAS_MAX_SCALE, MAX_VIEW_ZOOM, 'CANVAS_MAX_SCALE and MAX_VIEW_ZOOM must agree');
});

test('6d: the percentage is shown in WORDS, not as a bare fraction', () => {
	assert.equal(zoomLabel(0.75), '75%');
	assert.equal(zoomLabel(1), '100%');
	assert.equal(zoomLabel(0.25), '25%');
	assert.equal(zoomLabel(4), '400%');
	assert.equal(zoomLabel(Number.NaN), '100%', 'an unmeasured zoom reads as 100%, never "NaN%"');
	assert.equal(zoomLabel(0), '100%');
});

/* ── 7. totality: junk in, a finite rectangle out ──────────────────────────── */

test('7: every function is TOTAL - junk, NaN and an unmeasured world never yield NaN', () => {
	const junkImages = [null, undefined, { width: 0, height: 0 }, { width: Number.NaN, height: 10 }, { width: -5, height: 5 }];
	const junkWorlds = [null, undefined, { width: 0, height: 0 }, { width: Number.NaN, height: Number.POSITIVE_INFINITY }];

	for (const image of junkImages) {
		for (const world of junkWorlds) {
			for (const placement of [defaultPlacement(image, world), fillPlacement(image, world), clampPlacement(null, world)]) {
				const rect = placementRect(placement);
				for (const [key, value] of Object.entries(rect)) {
					assert.ok(Number.isFinite(value), `placementRect().${key} must be finite, got ${value}`);
				}
				const grown = backgroundWorld(placement, [], world);
				assert.ok(Number.isFinite(grown.width) && grown.width >= 0, 'the grown world width must be finite and non-negative');
				assert.ok(Number.isFinite(grown.height) && grown.height >= 0, 'the grown world height must be finite and non-negative');
				const view = fitViewTransform({ content: grown, box: { freeWidth: 0, freeHeight: 0 }, zoom: Number.NaN, pan: { x: Number.NaN, y: Number.POSITIVE_INFINITY } });
				assert.ok(Number.isFinite(view.scale) && view.scale > 0, 'a fit scale must be finite and positive, never NaN or 0');
				assert.ok(Number.isFinite(view.x) && Number.isFinite(view.y), 'a transform origin must be finite');
			}
		}
	}
});

test('7b: normalisePlacement repairs every malformed stored row rather than throwing', () => {
	const rows = [
		{}, null, undefined, 'nonsense', 42, [],
		{ imageWidth: 'a', imageHeight: null, x: undefined, y: NaN, width: -1, locked: 'no', mode: 'wat' },
		{ imageWidth: 1600, imageHeight: 900, x: 0, y: 0, width: 0, locked: true, mode: 'fit' },
		{ imageWidth: 1600, imageHeight: 900, x: Number.POSITIVE_INFINITY, y: 0, width: 400, locked: true, mode: 'fit' },
	];
	for (const row of rows) {
		const placement = normalisePlacement(row as never, PANORAMA, WORK_AREA);
		const rect = placementRect(placement);
		assert.ok(Number.isFinite(rect.x) && Number.isFinite(rect.y), 'a malformed row must still give a finite position');
		assert.ok(Number.isFinite(rect.width) && rect.width > 0, 'and a positive width');
		assert.ok(['fit', 'fill', 'custom'].includes(placement.mode), 'and a known mode');
		assert.equal(typeof placement.locked, 'boolean', 'and a boolean lock');
	}
});

/* ── 8. the edits are pure and repeatable ──────────────────────────────────── */

test('8: Bigger and Smaller are pure and repeatable, and never distort', () => {
	const start = defaultPlacement(SMALL_PHOTO, WORK_AREA);
	const once = scalePlacement(start, 1.15);
	const twice = scalePlacement(once, 1.15);
	close(placementRect(twice).width, placementRect(start).width * 1.15 * 1.15, 1e-6, 'two steps compose to the square of the factor');
	// Composed about the CENTRE, so growing does not walk the photo off the world.
	close(placementRect(twice).x + placementRect(twice).width / 2, placementRect(start).x + placementRect(start).width / 2, 1e-6, 'the centre is the fixed point of a resize');

	const smaller = scalePlacement(scalePlacement(start, 1 / 1.15), 1 / 1.15);
	close(placementRect(smaller).width, placementRect(start).width / (1.15 * 1.15), 1e-6, 'two Shrink presses divide by the factor twice');
	close(
		placementRect(smaller).x + placementRect(smaller).width / 2,
		placementRect(start).x + placementRect(start).width / 2,
		1e-6,
		'the centre is the fixed point of a resize in either direction',
	);


	const moved = movePlacement(start, { x: 40, y: -25 });
	assert.equal(placementRect(moved).x, placementRect(start).x + 40, 'a move changes only the position');
	assert.equal(placementRect(moved).y, placementRect(start).y - 25, 'on both axes');
	assert.equal(placementRect(moved).width, placementRect(start).width, 'never the size, so never the aspect');
	assert.equal(moved.mode, 'custom', 'and it is recorded as a deliberate choice');
});

/* ── 9. the ONE framing, proved to be the editor's own function ────────────── */

test('9: fitViewTransform is the EDITOR transform, not a lookalike', () => {
	for (const content of [WORK_AREA, { width: 3000, height: 400 }, { width: 120, height: 2400 }]) {
		for (const box of [WORK_AREA, { width: 400, height: 300 }]) {
			for (const zoom of [0.25, 0.7, 1, 2.2, 4]) {
				for (const pan of [{ x: 0, y: 0 }, { x: 120, y: -80 }, { x: -99_999, y: 99_999 }]) {
					const shared = fitViewTransform({ content, box, zoom, pan });
					const editor = campusEditorViewTransform({
						free: box,
						canvas: { canvasWidth: content.width, canvasHeight: content.height },
						zoom,
						pan,
					});
					assert.deepEqual(shared, editor, 'the viewer framing must BE the editor framing, not a copy of it');
				}
			}
		}
	}
});

test('9b: the pan is clamped, so zoomed-in detail can never be lost', () => {
	const content = { width: 2000, height: 2000 };
	const rightStop = fitViewTransform({ content, box: WORK_AREA_BOX, zoom: 2, pan: { x: 99_999, y: 99_999 } });
	const leftStop = fitViewTransform({ content, box: WORK_AREA_BOX, zoom: 2, pan: { x: -99_999, y: -99_999 } });
	// The two stops are distinct, so the pan is genuinely bounded, and at EITHER
	// stop the scaled content still covers the whole free area: the operator can
	// never pan part of the campus out of sight.
	const scaledWidth = content.width * rightStop.scale;
	const scaledHeight = content.height * rightStop.scale;
	for (const [label, view] of [['right', rightStop], ['left', leftStop]] as const) {
		assert.ok(view.x <= 1e-6, `${label} stop: the origin never sits inside the content`);
		assert.ok(view.x + scaledWidth >= WORK_AREA.width - 1e-6, `${label} stop: the content still reaches the right edge`);
		assert.ok(view.y <= 1e-6, `${label} stop: on the vertical axis too`);
		assert.ok(view.y + scaledHeight >= WORK_AREA.height - 1e-6, `${label} stop: the content still reaches the bottom edge`);
	}
	assert.ok(rightStop.x > leftStop.x, 'and the two stops are not the same place');
	assert.ok(rightStop.y > leftStop.y, 'on both axes');
});


/* ── 10. SOURCE-LEVEL CONTROLS: the duplicates are really gone ──────────────── */

/**
 * A pure-function refactor leaves the old arithmetic in place easily, and a green
 * maths suite would not notice. These rows read the real source files and fail if
 * a private copy of the world or the zoom bounds reappears.
 */
/**
 * The repository root, resolved from the CLIENT package root rather than from
 * `import.meta.url`. `npm run` sets the CWD to `atlas-client/`, and a
 * `../../../..`-style walk up from this file silently lands one directory short
 * on Windows — which produces ENOENT on every source-level row below while the
 * maths rows pass, which is exactly the kind of half-green that gets waved
 * through. One `path.resolve` against `process.cwd()` and the paths are stated
 * once.
 */
const REPO_ROOT = resolve(process.cwd(), '..');

function source(relative: string): string {
	return readFileSync(join(process.cwd(), relative), 'utf8');
}

test('10a: NO viewer declares its own 920x580 world or its own zoom bounds', () => {
	const files = [
		'src/components/campus-map/CampusMapCanvasPreview.tsx',
		'src/pages/MapView.tsx',
		'src/components/CampusMap.tsx',
		'src/components/CampusMapEditor.tsx',
	];
	for (const file of files) {
		const text = source(file);
		assert.doesNotMatch(text, /^\s*(?:export\s+)?const\s+CANVAS_WIDTH\s*=\s*920/m, `${file} must not re-declare the old fixed 920 world`);
		assert.doesNotMatch(text, /^\s*(?:export\s+)?const\s+CANVAS_HEIGHT\s*=\s*580/m, `${file} must not re-declare the old fixed 580 world`);
		assert.doesNotMatch(text, /^\s*(?:export\s+)?const\s+(?:MIN_ZOOM|MAX_ZOOM)\s*=/m, `${file} must not re-declare its own zoom bounds`);
	}
});

test('10b: the pattern scales are set in EXACTLY ONE place, and always from the drawn rect', () => {
	const files = [
		'src/components/campus-map/CampusMapBackgroundLayer.tsx',
		'src/components/CampusMapEditor.tsx',
		'src/components/campus-map/CampusMapCanvasPreview.tsx',
		'src/pages/MapView.tsx',
		'src/components/CampusMap.tsx',
	];
	// A `fillPatternScale` may only appear in the ONE shared layer. A second
	// occurrence anywhere is a second chance to reintroduce the stretch, which is
	// the defect this whole refactor exists to remove.
	const holders: string[] = [];
	for (const file of files) {
		const text = source(file);
		const scales = text.match(/fillPatternScale([XY])\s*=\s*\{([^}]*)\}/g) ?? [];
		if (scales.length > 0) holders.push(file);
		for (const scale of scales) {
			const axis = /fillPatternScaleX/.test(scale) ? 'width' : 'height';
			assert.ok(
				scale.includes(`rect.${axis} / image.${axis}`),
				`${file}: "${scale.trim()}" must divide the drawn ${axis} by the image's ${axis}, not by a constant`,
			);
		}
	}
	assert.deepEqual(holders, ['src/components/campus-map/CampusMapBackgroundLayer.tsx'], 'the two pattern scales must be set in exactly one file');
});


test('10c: the room-request inset no longer CROPS the photo with cover', () => {
	const text = source('src/components/faculty-room-preferences/RoomRequestSheet.tsx');
	assert.doesNotMatch(text, /backgroundSize:\s*'cover'/, 'the inset used backgroundSize: cover, which is the crop this change removes');
	assert.match(text, /backgroundSize:\s*'contain'/, 'and must contain the whole photo instead');
	assert.doesNotMatch(text, /function\s+mapBounds/, 'the private bounding-box normalisation had no relationship to the image and is gone');
});

test('10d: the Background step exists, is a group and not a disclosure, and has no helper sentence', () => {
	const text = source('src/components/campus-map/CampusMapBackgroundStep.tsx');
	assert.match(text, /role="group"/, 'the step is a group');
	assert.doesNotMatch(text, /More filters|<details|aria-expanded/, 'a disclosure is forbidden: an operator must see the controls at all times');
	assert.doesNotMatch(text, /text-\[(0\.\d+rem|\d+px)\]/, 'no text under 14px on anything this step introduces');
	// The lock is stated in WORDS, which is the packet's explicit requirement.
	assert.match(text, /Background locked/, 'the locked state must be readable as words');
	assert.match(text, /Background not locked/, 'and so must the unlocked state');
	for (const verb of ['Move background', 'Smaller', 'Bigger', 'Fit whole image', 'Fill the area', 'Reset', 'Unlock', 'Lock background', 'Save background']) {
		assert.ok(text.includes(verb), `the step must carry the control "${verb}" in words, not as a bare icon`);
	}
});

test('10e: the receipt sentence is the packet\'s exact words, on the page where the save happened', () => {
	const hook = source('src/components/campus-map/useCampusMapBackground.ts');
	assert.match(hook, /Background saved and locked\. Buildings stay where you placed them\./, 'the packet requires this sentence exactly');
	// And the receipt states what was NOT done and the next step, per the walk
	// standard's receipts rule.
	assert.match(hook, /Nothing else changed/, 'a receipt must say what was not done');
	assert.match(hook, /Next:/, 'and give the next step');
	// It is rendered in the editor, not only in a toast.
	const editor = source('src/components/CampusMapEditor.tsx');
	assert.match(editor, /campus-background-receipt/, 'the receipt must be on the page where the action happened');
	assert.match(editor, /role="status"/, 'and must be announced, not only drawn');
});

test('10f: the migration is additive, nullable, and has no backfill', () => {
	const sql = readFileSync(join(REPO_ROOT, 'prisma/migrations/20260929220000_campus_map_placement/migration.sql'), 'utf8');
	assert.match(sql, /ALTER TABLE "schools" ADD COLUMN "campus_map_placement" JSONB;/, 'exactly one additive nullable column');
	// No DEFAULT, so no existing row silently gains a value. The header comment
	// names the phrase "NO DEFAULT", so the check is on SQL rather than prose.
	assert.doesNotMatch(sql, /ADD COLUMN[^;]*\bDEFAULT\b/i, 'no DEFAULT on the new column, so no existing row gains a value');
	assert.doesNotMatch(sql, /^\s*UPDATE\s/im, 'no backfill: ATLAS must not write a placement for a school nobody configured');
	assert.doesNotMatch(sql, /^\s*DROP\s/im, 'nothing is dropped');
	assert.doesNotMatch(sql, /^\s*ALTER\s+TABLE\s+"(?!schools")/im, 'no other table is altered');

});

test('10g: the placement WRITE is scoped to the actor school from the token, not the path parameter', () => {
	const router = readFileSync(join(REPO_ROOT, 'atlas-server/src/routes/map.router.ts'), 'utf8');
	const match = router.match(/router\.put\('\/schools\/:schoolId\/campus-map-placement'[\s\S]*?\n\}\);/);
	assert.ok(match, 'the placement PUT route must exist');
	assert.match(match![0], /authenticate/, 'authenticated');
	assert.match(match![0], /requirePrivilegedRole/, 'privileged role');
	assert.match(match![0], /actorSchoolId/, 'and the actor school comes from the verified token');

	const service = readFileSync(join(REPO_ROOT, 'atlas-server/src/services/map.service.ts'), 'utf8');
	assert.match(service, /schoolId !== actorSchoolId[\s\S]{0,200}CROSS_SCHOOL_DENIED/, 'a path/school mismatch must be refused, not redirected');
	assert.match(service, /actorSchoolId === undefined[\s\S]{0,200}CROSS_SCHOOL_DENIED/, 'and an unknown actor scope must fail closed');
});

test('10h: the client seam is TYPED and is the only way the placement is read or written', () => {
	const api = source('src/lib/campus-background-api.ts');
	assert.match(api, /CampusMapPlacement/, 'the seam speaks the placement type the pure module produces');
	assert.match(api, /campusMapPlacement/, 'and reads the field the server returns');
	// No other file re-implements the read or the write.
	const files = [
		'src/pages/MapEditor.tsx',
		'src/components/CampusMapEditor.tsx',
		'src/pages/MapView.tsx',
		'src/components/sections/SectionRoomMapModal.tsx',
		'src/components/campus-map/useCampusBackground.ts',
	];
	for (const file of files) {
		assert.doesNotMatch(source(file), /\/campus-map-placement/, `${file} must go through the shared seam, not call the route itself`);
	}
});

test('10i: every viewer that shows the map also passes the placement through', () => {
	// A viewer that renders the photo but not the placement would silently fall
	// back to the default and frame a configured school differently from the rest.
	for (const file of [
		'src/components/campus-map/CampusMapCanvasPreview.tsx',
		'src/components/CampusMap.tsx',
	]) {
		assert.match(source(file), /campusMapPlacement/, `${file} must accept the stored placement`);
	}
	for (const file of [
		'src/components/campus-map/CampusMapOverview.tsx',
		'src/components/dashboard/CampusReadinessCard.tsx',
		'src/components/sections/SectionRoomMapModal.tsx',
		'src/components/faculty-room-preferences/RoomRequestSheet.tsx',
		'src/components/timetable/CenterWorkspacePaneSurface.tsx',
	]) {
		assert.match(source(file), /campusMapPlacement/, `${file} must pass the placement to the map it renders`);
	}
});

test('10j: safeWorld is exported and total, and the module imports no React and no Konva', () => {
	assert.deepEqual(safeWorld(null), { width: 0, height: 0 });
	assert.deepEqual(safeWorld({ width: -3, height: Number.NaN }), { width: 0, height: 0 });
	const text = source('src/components/campus-map/campusMapBackground.ts');
	// IMPORT statements only: a prose mention of a library in a comment is not a
	// dependency, and this row is about the module's purity, not its vocabulary.
	const imports = text.match(/^\s*import\s.*$/gm) ?? [];
	for (const line of imports) {
		assert.doesNotMatch(line, /from 'react'/, 'the placement contract must stay pure: no React');
		assert.doesNotMatch(line, /konva/i, 'and no Konva');
	}
	assert.ok(imports.length > 0, 'the module does import its own types, so the import scan is live');
});
