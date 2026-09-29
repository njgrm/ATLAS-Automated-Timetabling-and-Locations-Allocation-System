/**
 * A9 m1 — the campus map BACKGROUND, as pure, total functions.
 *
 * THE OPERATOR'S OWN WORDS, and the one that governs:
 * "uploading an image that will serve as the map background is limited, since we
 * can't zoom out and lock the map in place, causing the map to be cut off with no
 * option for the schedulers to work around it unless they crop it perfectly,
 * which is a hassle."
 *
 * WHAT WENT WRONG IS TWO SEPARATE ARITHMETIC MISTAKES, and only one of them was
 * visible. The visible one is the stretch: `CampusMapEditor.tsx` painted the
 * uploaded photo as two `Rect`s with
 * `fillPatternScaleX = CANVAS_WIDTH / image.width` and
 * `fillPatternScaleY = CANVAS_HEIGHT / image.height` — two INDEPENDENT factors, so
 * any photo that is not 1.59:1 was squashed or stretched, and the scheduler's
 * only remedy was to crop the file to 920x580 before uploading, which is exactly
 * the "hassle" the sentence names. The invisible one is the ceiling: 920x580 WAS
 * the whole coordinate space, so a panorama wider than the frame had its edges
 * outside the world and no zoom control could ever bring them back, because
 * zooming out was clamped at 0.4 and the world itself could not grow.
 *
 * THE CONTRACT, in four parts.
 *
 *   1. ONE uniform scale. {@link CampusMapPlacement} carries `width` only; the
 *      height is ALWAYS derived from the image's own intrinsic ratio. There is no
 *      code path that can produce a placement whose drawn ratio differs from the
 *      file's, which is what "never stretched" means as a property rather than as
 *      a hope.
 *   2. The world GROWS. {@link backgroundWorld} is the extent that contains the
 *      image rect AND every building, so a tall or panoramic photo gets a world
 *      that can hold it and the view transform fits that world. Nothing is
 *      cropped by ATLAS.
 *   3. ONE framing. {@link fitViewTransform} is a delegation to
 *      `campusEditorViewTransform` (`campusEditorCanvas.ts`), the function A9 c4
 *      already wrote for the editor. The editor and every read-only viewer
 *      therefore cannot disagree about what "fit" means, and there is no second
 *      copy of the fit/offset/clamp arithmetic to drift.
 *   4. EXISTING SCHOOLS ARE UNCHANGED. A school whose photo predates this change
 *      has NO stored placement, and {@link normalisePlacement} gives it
 *      {@link defaultPlacement} — fit whole image, centred, LOCKED. That rect is
 *      contained by the world, so {@link backgroundWorld} returns the world
 *      UNCHANGED, the view transform is bit-for-bit what it was, and every
 *      building keeps the screen position it had before the migration. The
 *      guarantee is proved in `__tests__/a9-m1-campus-background.test.ts`, not
 *      asserted here.
 *
 * Everything is total. Every input is coerced, so junk, `NaN`, an unmeasured
 * host, or an image that has not finished loading can never yield a `NaN`
 * rectangle, a zero scale, or an invisible canvas.
 */

import {
	CANVAS_EDGE_PADDING,
	type CanvasFitBox,
	type CanvasSpace,
	type CanvasViewTransform,
	campusEditorViewTransform,
} from '@/components/campus-map/campusEditorCanvas';

/** The intrinsic pixel size of the uploaded photo, as the browser measured it. */
export type CampusMapImageSize = { width: number; height: number };

/** How a placement was arrived at, in words a scheduler can read. */
export type CampusMapPlacementMode = 'fit' | 'fill' | 'custom';

/**
 * Where the photo sits in the WORLD — the stage coordinate space, the same space
 * every building's stored `x`/`y` lives in.
 *
 * `width` is UNIFORM: the height is always `width × imageHeight / imageWidth`,
 * and `placementRect` is the only thing that turns this into a drawable box. A
 * `Placement` therefore cannot describe a stretched image even if the JSON in the
 * database says something odd — {@link normalisePlacement} repairs the ratio on
 * the way in.
 */
export type CampusMapPlacement = {
	imageWidth: number;
	imageHeight: number;
	x: number;
	y: number;
	width: number;
	locked: boolean;
	mode: CampusMapPlacementMode;
};

/** The legacy world: the measured work area, or a named default before measuring. */
export type CampusMapWorld = { width: number; height: number };

/** A drawable rectangle, in world units. */
export type CampusMapRect = { x: number; y: number; width: number; height: number };

/** The stored JSON shape, before it has been repaired into a `CampusMapPlacement`. */
export type RawCampusMapPlacement = {
	imageWidth?: unknown;
	imageHeight?: unknown;
	x?: unknown;
	y?: unknown;
	width?: unknown;
	locked?: unknown;
	mode?: unknown;
};

/* ── coercion, so junk can never reach a rectangle ───────────────────────── */

/** A strictly positive, finite measurement, or 0 for anything else. */
function positive(value: unknown): number {
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Any finite number, sign intact; 0 for a NaN or an infinity. */
function finite(value: unknown): number {
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? n : 0;
}

/** The intrinsic ratio, guarded: an unmeasured or degenerate image is square. */
function imageRatio(image: CampusMapImageSize | null | undefined): number {
	const width = positive(image?.width);
	const height = positive(image?.height);
	if (width === 0 || height === 0) return 1;
	return width / height;
}

/* ── the world ───────────────────────────────────────────────────────────── */

/** A world that always has an extent, so `Math.min`/`Math.max` stay meaningful. */
export function safeWorld(world: CampusMapWorld | null | undefined): CampusMapWorld {
	return { width: positive(world?.width), height: positive(world?.height) };
}

/**
 * The world the campus is painted in: the base world GROWN to contain the photo
 * and every building.
 *
 * This is what lets a 3:1 panorama or a 2:3 plan exist at all. Under the old
 * fixed 920x580 frame the overflow was simply not addressable; here the world
 * takes the size of its content and the view transform fits whatever it finds,
 * so "the whole image is visible" is a property of the world rather than a
 * constraint the scheduler has to satisfy by cropping the file.
 *
 * CONTAINMENT, not coverage, on both axes. A building is never moved and the
 * origin never shifts, because a world that grew leftwards or upwards would move
 * every existing building's screen position and break the "existing schools are
 * unchanged" guarantee in the module header.
 */
export function backgroundWorld(
	placement: CampusMapPlacement | null | undefined,
	buildings: ReadonlyArray<{ x: number; y: number; width: number; height: number }>,
	baseWorld: CampusMapWorld | null | undefined,
): CampusMapWorld {
	const base = safeWorld(baseWorld);
	let right = base.width;
	let bottom = base.height;

	if (placement) {
		const rect = placementRect(placement);
		right = Math.max(right, rect.x + rect.width);
		bottom = Math.max(bottom, rect.y + rect.height);
	}

	for (const building of buildings ?? []) {
		right = Math.max(right, finite(building?.x) + positive(building?.width));
		bottom = Math.max(bottom, finite(building?.y) + positive(building?.height));
	}

	return { width: Math.ceil(right), height: Math.ceil(bottom) };
}

/* ── the placements ──────────────────────────────────────────────────────── */

/**
 * "Fit whole image" — the DEFAULT, and the only state a school is ever in
 * without somebody having chosen otherwise.
 *
 * The image is CONTAINED inside the world on both axes with ONE uniform factor
 * (`min` of the two ratios), then centred. Because the result is contained, the
 * world does not grow, which is exactly why a school that never touched these
 * controls looks identical to how it looked before this change.
 */
export function defaultPlacement(
	image: CampusMapImageSize | null | undefined,
	world: CampusMapWorld | null | undefined,
): CampusMapPlacement {
	const imageWidth = positive(image?.width) || 1;
	const imageHeight = positive(image?.height) || 1;
	const box = safeWorld(world);
	const scale = Math.min(box.width / imageWidth, box.height / imageHeight);
	const width = imageWidth * (Number.isFinite(scale) && scale > 0 ? scale : 0);
	return {
		imageWidth,
		imageHeight,
		x: (box.width - width) / 2,
		y: (box.height - width / (imageWidth / imageHeight)) / 2,
		width,
		locked: true,
		mode: 'fit',
	};
}

/**
 * "Fill the area" — the same aspect, at the factor that COVERS the world, then
 * centred.
 *
 * `max` of the two ratios, so one axis overflows by construction. That overflow
 * is not a defect: {@link backgroundWorld} grows the world to hold it and the
 * view fits the result, so the scheduler sees the whole photo either way. Filling
 * is for a scheduler who wants no blank margin around the plan, and it is never
 * the default.
 */
export function fillPlacement(
	image: CampusMapImageSize | null | undefined,
	world: CampusMapWorld | null | undefined,
): CampusMapPlacement {
	const imageWidth = positive(image?.width) || 1;
	const imageHeight = positive(image?.height) || 1;
	const box = safeWorld(world);
	const scale = Math.max(box.width / imageWidth, box.height / imageHeight);
	const width = imageWidth * (Number.isFinite(scale) && scale > 0 ? scale : 0);
	return {
		imageWidth,
		imageHeight,
		x: (box.width - width) / 2,
		y: (box.height - width / (imageWidth / imageHeight)) / 2,
		width,
		locked: true,
		mode: 'fill',
	};
}

/** The drawn rectangle. The ONLY place a `CampusMapPlacement` becomes a box. */
export function placementRect(placement: CampusMapPlacement | null | undefined): CampusMapRect {
	const imageWidth = positive(placement?.imageWidth) || 1;
	const imageHeight = positive(placement?.imageHeight) || 1;
	const width = positive(placement?.width);
	return {
		x: finite(placement?.x),
		y: finite(placement?.y),
		width,
		// THE ASPECT CONTRACT, in one expression: the drawn height is never chosen,
		// it is read off the file. There is deliberately no branch here.
		height: width * (imageHeight / imageWidth),
	};
}

/**
 * Keep the photo REACHABLE — never dragged fully out of the world.
 *
 * The origin is the top-left of the world and every building lives at a
 * non-negative coordinate, so the image is clamped to the range that keeps its
 * left and top edges at or after the origin. When the image is WIDER than the
 * world the range collapses to 0: the world has already grown to hold it (see
 * {@link backgroundWorld}), so there is nowhere else to put it and no drag can
 * lose it.
 *
 * The aspect is preserved because this function only ever moves `x` and `y` —
 * `width` is not in the output's decision path, and the drawn height is re-derived
 * from the image ratio rather than remembered.
 */
export function clampPlacement(
	placement: CampusMapPlacement | null | undefined,
	world: CampusMapWorld | null | undefined,
): CampusMapPlacement {
	const source = placement ?? defaultPlacement(null, world);
	const box = safeWorld(world);
	const width = positive(source.width);
	const height = width * (positive(source.imageHeight) / (positive(source.imageWidth) || 1));
	const maxX = Math.max(0, box.width - width);
	const maxY = Math.max(0, box.height - height);
	return {
		imageWidth: positive(source.imageWidth) || 1,
		imageHeight: positive(source.imageHeight) || 1,
		x: Math.min(maxX, Math.max(0, finite(source.x))),
		y: Math.min(maxY, Math.max(0, finite(source.y))),
		width,
		locked: source.locked !== false,
		mode: source.mode === 'fill' || source.mode === 'custom' ? source.mode : 'fit',
	};
}

/** Move the photo, preserving everything else about it. */
export function movePlacement(
	placement: CampusMapPlacement,
	delta: { x: number; y: number },
): CampusMapPlacement {
	return {
		...placement,
		x: placement.x + finite(delta?.x),
		y: placement.y + finite(delta?.y),
		mode: 'custom',
	};
}

/** Resize the photo about its own centre, preserving the aspect by construction. */
export function scalePlacement(placement: CampusMapPlacement, factor: number): CampusMapPlacement {
	const current = positive(placement.width);
	const next = Math.max(1, current * (Number.isFinite(factor) && factor > 0 ? factor : 1));
	const delta = (next - current) / 2;
	return { ...placement, width: next, x: placement.x - delta, y: placement.y - delta, mode: 'custom' };
}

/**
 * The stored JSON, repaired into a placement this build can draw.
 *
 * Three repairs, each of which is a defect the raw column could otherwise carry:
 *
 *  - NO stored placement at all → {@link defaultPlacement}. This is the existing
 *    school: fit whole image, centred, locked, with its buildings exactly where
 *    they were.
 *  - A placement whose recorded image size differs from the photo the browser
 *    actually loaded → {@link defaultPlacement}. A new upload replaced the old
 *    file, so the old ratio is meaningless; refitting is the only honest answer.
 *  - A placement with a non-positive or non-finite width → {@link defaultPlacement}.
 *
 * The ratio is repaired even when the sizes agree, because `x`/`y`/`width` are
 * re-derived against the loaded image and clamped, so a hand-edited row can move
 * the photo but can never distort it.
 */
export function normalisePlacement(
	raw: RawCampusMapPlacement | null | undefined,
	image: CampusMapImageSize | null | undefined,
	world: CampusMapWorld | null | undefined,
): CampusMapPlacement {
	if (!raw || typeof raw !== 'object') return defaultPlacement(image, world);

	const imageWidth = positive(image?.width);
	const imageHeight = positive(image?.height);
	const storedWidth = positive(raw.imageWidth);
	const storedHeight = positive(raw.imageHeight);
	// A photo that has not loaded yet cannot be framed against the photo that did.
	if (imageWidth === 0 || imageHeight === 0) return defaultPlacement(null, world);
	// A different file is showing: the stored ratio describes a photo that is gone.
	if (storedWidth !== imageWidth || storedHeight !== imageHeight) return defaultPlacement(image, world);

	const width = positive(raw.width);
	if (width === 0) return defaultPlacement(image, world);

	return clampPlacement(
		{
			imageWidth,
			imageHeight,
			x: finite(raw.x),
			y: finite(raw.y),
			width,
			locked: raw.locked !== false,
			mode: raw.mode === 'fill' || raw.mode === 'custom' ? raw.mode : 'fit',
		},
		world,
	);
}

/* ── the one framing, for every viewer ───────────────────────────────────── */

/**
 * The zoom bounds, in the operator's own units: a MULTIPLIER ON TOP OF THE FIT.
 *
 * `MIN_VIEW_ZOOM` is 0.25, not the old 0.4, and that is the reported defect the
 * packet names: the operator has to be able to see the whole photo with a margin
 * around it — "at least until the whole image fits at 50% of the view". A 0.5
 * multiplier is reachable with room to spare, so the whole image is reachable at
 * half size and still smaller. `MAX_VIEW_ZOOM` is 4 (was 2.5) so a small building
 * can be placed precisely on a large plan.
 *
 * `CANVAS_MIN_SCALE` / `CANVAS_MAX_SCALE` in `campusEditorCanvas.ts` carry the
 * same two numbers for `nextZoomScale`, so the buttons and the wheel cannot
 * disagree about the ends of the range.
 */
export const MIN_VIEW_ZOOM = 0.25;
export const MAX_VIEW_ZOOM = 4;

/** Clamp a requested zoom step from the buttons or the wheel, in both directions. */
export function nextBackgroundZoom(current: number, step: number): number {
	const from = Number.isFinite(current) && current > 0 ? current : 1;
	const by = Number.isFinite(step) ? step : 0;
	return Math.max(MIN_VIEW_ZOOM, Math.min(MAX_VIEW_ZOOM, Math.round((from + by) * 100) / 100));
}

/** The zoom, in the words the packet asks for: "75%", not "0.75". */
export function zoomLabel(zoom: number): string {
	const value = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
	return `${Math.round(value * 100)}%`;
}

/**
 * THE framing function every viewer calls.
 *
 * A DELEGATION, not a copy. `campusEditorViewTransform` already owns the fit,
 * the centring offset and the clamped pan (A9 c4), and re-deriving any of it here
 * is how the editor and the read-only previews came to disagree in the first
 * place. The `content`/`box` names are the shared vocabulary; the arithmetic is
 * the editor's, by reference.
 */
export function fitViewTransform(input: {
	content: CampusMapWorld;
	box: CanvasFitBox;
	zoom?: number;
	pan?: { x: number; y: number };
}): CanvasViewTransform {
	const content = safeWorld(input.content);
	const canvas: CanvasSpace = { canvasWidth: content.width, canvasHeight: content.height };
	return campusEditorViewTransform({ free: input.box, canvas, zoom: input.zoom, pan: input.pan });
}

/* ── the editor's canvas size, now background-aware ──────────────────────── */

/**
 * The base world the editor measures: the work area, grown for the BUILDINGS
 * only, and never for the photo.
 *
 * The growth for the photo is {@link backgroundWorld}'s job, and keeping the two
 * apart is what makes the existing-school guarantee mechanical rather than
 * arithmetic: with no stored placement, `backgroundWorld` has nothing to grow
 * for and returns this value unchanged.
 */
export function measuredWorld(input: {
	containerWidth: number;
	containerHeight: number;
	buildings: ReadonlyArray<{ x: number; y: number; width: number; height: number }>;
}): CampusMapWorld {
	let right = 0;
	let bottom = 0;
	for (const building of input.buildings ?? []) {
		right = Math.max(right, finite(building?.x) + positive(building?.width));
		bottom = Math.max(bottom, finite(building?.y) + positive(building?.height));
	}
	return {
		width: Math.ceil(Math.max(positive(input.containerWidth), right > 0 ? right + CANVAS_EDGE_PADDING : 0)),
		height: Math.ceil(Math.max(positive(input.containerHeight), bottom > 0 ? bottom + CANVAS_EDGE_PADDING : 0)),
	};
}

/** The whole world for a viewer or the editor: the base, grown to hold the photo. */
export function campusWorld(input: {
	containerWidth: number;
	containerHeight: number;
	buildings: ReadonlyArray<{ x: number; y: number; width: number; height: number }>;
	placement: CampusMapPlacement | null | undefined;
}): CampusMapWorld {
	const base = measuredWorld(input);
	return backgroundWorld(input.placement, input.buildings, base);
}
