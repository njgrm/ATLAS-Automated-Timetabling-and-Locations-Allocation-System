/**
 * A3 c11 fix 36 — the campus editor's canvas GEOMETRY, as pure, total functions.
 *
 * THE OPERATOR'S OWN WORDS (fix-2.docx, fix 36), and the one that governs:
 * "The rightmost building cards are visibly clipped beneath the inspector
 * rather than **contained** in an auto-grown/full workspace canvas."
 *
 * WHAT WENT WRONG IS ARITHMETIC, and it is arithmetic about the LAYOUT, not
 * about the data. A stage that is *at least* 920px wide, inside a column that
 * is 726px wide at the default 1366px viewport, is clipped by exactly the 194px
 * it was clipped by before:
 *
 *     1366  the viewport
 *   −  256  app sidebar, `ui/sidebar.tsx` SIDEBAR_WIDTH = '16rem', open by default
 *   −  352  editor inspector, `pages/MapEditor.tsx` `w-88`
 *   −   32  canvas column padding, `pages/MapEditor.tsx` `p-4`
 *   =  726  the work area actually available to the canvas
 *
 * So `920 > 726`, and no link in the chain could reach what overflowed: the page
 * root is `overflow-hidden`, the column is `overflow-hidden`, and there was no
 * scroll region at all. That is why keeping 920 as a MINIMUM reproduced the
 * operator's clip byte for byte, and why this module no longer has one. Auto-grow
 * did not rescue it either: a building at y 900 grew the stage to 1124px tall
 * and 504px of it was painted below the fold, still with nothing to scroll.
 *
 * THE CONTRACT, in three parts. The third is what makes the first two safe.
 *
 *   1. REACHABILITY belongs to the page, not to this module. The canvas column
 *      is the ONE bounded scroll region (AGENTS.md §8 shape, `role="region"`,
 *      named, `tabIndex={0}`), so whatever the stage grows to is scrollable
 *      rather than painted outside the visible canvas. Nothing is clipped
 *      without a way to reach it.
 *   2. The stage is the work area it is GIVEN — {@link canvasWorkArea} from the
 *      MEASURED region box, never a constant standing in for the pane. At the
 *      1366px default the stage is 726px and needs no horizontal scroll at all.
 *   3. Containment is enforced on the way IN as well as out, via
 *      {@link clampBuildingToCanvas}, which the draw-create, resize/rotate AND
 *      drag paths all call. A building cannot be moved out of the area at all,
 *      so containment never rests on auto-grow alone.
 *
 * Kept here rather than in the component for two reasons: AGENTS.md §8 caps a
 * React component at 1000 physical lines and `CampusMapEditor.tsx` had reached
 * 1088, and these are the functions the rendered controls import, so a reviewer
 * reads one file for the whole geometry contract.
 */

/** The four numbers a canvas decision needs from a building. */
export type CanvasExtent = { x: number; y: number; width: number; height: number };

/** The smallest rectangle the editor will create or resize a building to, px. */
export const MIN_WIDTH = 60;
export const MIN_HEIGHT = 40;

/**
 * Breathing room kept between the right-most/bottom-most building and the edge,
 * so a building placed hard against the border is not already half-clipped.
 */
export const CANVAS_EDGE_PADDING = 24;

/**
 * A USABILITY floor, not a layout constant — deliberately far below the 726px
 * work area and below every column a person is likely to work in. The numbers
 * come from the same layout arithmetic as the top of this file: a 960px window,
 * with the sidebar open and the inspector shown, leaves
 * `960 − 256 − 352 − 32 = 320`, so 320x240 is the point at which a real window
 * stops fitting the editor at all. Below it the REGION SCROLLS — which is
 * reachability — rather than the canvas clipping, which is the reported defect.
 *
 * It is also the unmeasured first paint: a host that has not been measured yet
 * (or a canvas mounted outside the region, which the page never does) gets this
 * floor, so a stage is never zero-sized and never 920px-wide by assumption.
 */
export const CANVAS_USABILITY_FLOOR_WIDTH = 320;
export const CANVAS_USABILITY_FLOOR_HEIGHT = 240;

/** Region-box arithmetic, in px, as the caller measured it. */
export type CanvasRegionBox = {
	/** The region's own border-box size, from `getBoundingClientRect()`. */
	regionWidth: number;
	regionHeight: number;
	/** The region's own padding, from `getComputedStyle()`. Unknown reads as 0. */
	paddingTop: number;
	paddingRight: number;
	paddingBottom: number;
	paddingLeft: number;
	/**
	 * Everything the region paints ABOVE the canvas: the canvas host's
	 * `offsetTop` within the region (the page header and the editor toolbar) plus
	 * the region's top padding. Independent of the stage's pixel size, so
	 * measuring it cannot feed the stage back into itself.
	 */
	contentAbove: number;
	/** Everything the region paints BELOW the canvas — the status bar's own
	 *  `offsetHeight`. Also independent of the stage, and the reason the default
	 *  layout has no spurious 20px scroll. */
	contentBelow: number;
};

/**
 * The work area available to the canvas, in px.
 *
 * Total and pure, so the component's Stage and the rendered controls are sized
 * by the same call and cannot disagree. Every input is MEASURED: the region box,
 * its padding, and the two content bands. A non-finite or negative result reads
 * as 0, which {@link campusEditorCanvasSize} then floors — so a DOM that cannot
 * answer a measurement produces the named floor, never a NaN canvas.
 */
export function canvasWorkArea(box: CanvasRegionBox): { width: number; height: number } {
	const clean = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);
	const width = clean(box.regionWidth) - clean(box.paddingLeft) - clean(box.paddingRight);
	const height =
		clean(box.regionHeight) - clean(box.paddingTop) - clean(box.paddingBottom) - clean(box.contentAbove) - clean(box.contentBelow);
	return { width: clean(width), height: clean(height) };
}

/**
 * The stage size: the measured work area, grown for content, floored for
 * usability — in that order of authority.
 *
 *  - the MEASURED work area, because that is what the operator sees, and a stage
 *    larger than its column is the defect (a stage SMALLER than the column is
 *    merely a waste of space, so the max() biases towards contained, not
 *    towards clipped);
 *  - content, because a building already outside the canvas must never be
 *    clipped by the fix that is meant to stop clipping — and it now can be
 *    reached, because the region scrolls;
 *  - the usability floor last, so an unmeasured or absurdly small host still
 *    gets a workable canvas instead of collapsing to nothing.
 */
export function campusEditorCanvasSize(input: {
	containerWidth: number;
	containerHeight: number;
	buildings: ReadonlyArray<CanvasExtent>;
	floorWidth?: number;
	floorHeight?: number;
	padding?: number;
}): { width: number; height: number } {
	const floorWidth = input.floorWidth ?? CANVAS_USABILITY_FLOOR_WIDTH;
	const floorHeight = input.floorHeight ?? CANVAS_USABILITY_FLOOR_HEIGHT;
	const padding = input.padding ?? CANVAS_EDGE_PADDING;
	let contentRight = 0;
	let contentBottom = 0;
	for (const b of input.buildings) {
		contentRight = Math.max(contentRight, b.x + b.width);
		contentBottom = Math.max(contentBottom, b.y + b.height);
	}
	const positive = (value: number): number => (Number.isFinite(value) && value > 0 ? value : 0);
	const widest = contentRight > 0 ? contentRight + padding : 0;
	const deepest = contentBottom > 0 ? contentBottom + padding : 0;
	return {
		width: Math.ceil(Math.max(floorWidth, positive(input.containerWidth), widest)),
		height: Math.ceil(Math.max(floorHeight, positive(input.containerHeight), deepest)),
	};
}

/**
 * Containment (the operator's option 3): pull a building fully inside the canvas.
 *
 * A building LARGER than the canvas is pinned to the origin rather than given a
 * negative coordinate — and the canvas then auto-grows to hold it, so the clamp
 * can never be the reason a building is unreachable. This is the ONE clamp: the
 * draw-create, resize/rotate and drag paths all call it.
 */
export function clampBuildingToCanvas<T extends CanvasExtent>(building: T, canvasWidth: number, canvasHeight: number): T {
	const maxX = Math.max(0, canvasWidth - building.width);
	const maxY = Math.max(0, canvasHeight - building.height);
	return {
		...building,
		x: Math.min(maxX, Math.max(0, Math.round(building.x))),
		y: Math.min(maxY, Math.max(0, Math.round(building.y))),
	};
}

/**
 * Smart-threshold label rotation:
 * - |angle| <= 20°: keep text upright (counter-rotate fully)
 * - |angle| > 20°: let text ride with the building (no correction)
 */
export function smartLabelRotation(buildingRotation: number): number {
	const absAngle = Math.abs(buildingRotation % 360);
	const effective = absAngle > 180 ? 360 - absAngle : absAngle;
	return effective <= 20 ? -(buildingRotation ?? 0) : 0;
}

/** Map each resize anchor to the opposite (fixed) anchor */
export const OPPOSITE_ANCHORS: Record<string, string> = {
	'top-left': 'bottom-right',
	'top-center': 'bottom-center',
	'top-right': 'bottom-left',
	'middle-left': 'middle-right',
	'middle-right': 'middle-left',
	'bottom-left': 'top-right',
	'bottom-center': 'top-center',
	'bottom-right': 'top-left',
};

/** Compute local (unrotated) offset of a named anchor within a rectangle */
export function anchorLocalOffset(w: number, h: number, anchor: string): { x: number; y: number } {
	let x = 0;
	let y = 0;
	if (anchor.includes('right')) x = w;
	else if (anchor.includes('center')) x = w / 2;
	if (anchor.includes('bottom')) y = h;
	else if (anchor.startsWith('middle')) y = h / 2;
	return { x, y };
}

/** How close two edges must be, in stage px, for a snap guide to appear. */
export const ALIGNMENT_SNAP_THRESHOLD = 5;

/** The stage's zoom bounds. One pair of constants for both zoom controls. */
export const CANVAS_MIN_SCALE = 0.4;
export const CANVAS_MAX_SCALE = 2.5;

/** Clamp a requested zoom step, from either the buttons or the wheel. The
 *  arithmetic is the editor's, unchanged; only the bounds are now named and
 *  shared by the two buttons and the wheel. */
export function nextZoomScale(current: number, step: number): number {
	return Math.max(CANVAS_MIN_SCALE, Math.min(CANVAS_MAX_SCALE, current + step));
}

/**
 * The rectangle a draw gesture covers, from its start point and the current
 * pointer: negative drags normalise to a positive-extent rect anchored up-left.
 */
export function drawRectFromPointer(start: { x: number; y: number }, pointer: { x: number; y: number }): CanvasExtent {
	return {
		x: Math.min(start.x, pointer.x),
		y: Math.min(start.y, pointer.y),
		width: Math.abs(pointer.x - start.x),
		height: Math.abs(pointer.y - start.y),
	};
}

/**
 * Snap guides for a drag: the edges of `moving` that line up with an edge or the
 * centre of any other building, within {@link ALIGNMENT_SNAP_THRESHOLD}.
 *
 * Pure, and given the OTHER buildings already filtered, so a control can decide
 * every guide without a render.
 */
export function alignmentGuides(moving: CanvasExtent, others: ReadonlyArray<CanvasExtent>): Array<{ x?: number; y?: number }> {
	const guides: Array<{ x?: number; y?: number }> = [];
	const near = (a: number, b: number): boolean => Math.abs(a - b) < ALIGNMENT_SNAP_THRESHOLD;
	for (const other of others) {
		// left-left, right-right, left-right, right-left, center-center
		for (const edge of [
			{ drag: moving.x, other: other.x },
			{ drag: moving.x + moving.width, other: other.x + other.width },
			{ drag: moving.x, other: other.x + other.width },
			{ drag: moving.x + moving.width, other: other.x },
			{ drag: moving.x + moving.width / 2, other: other.x + other.width / 2 },
		]) {
			if (near(edge.drag, edge.other)) guides.push({ x: edge.other });
		}
		// top-top, bottom-bottom, top-bottom, bottom-top, center-center
		for (const edge of [
			{ drag: moving.y, other: other.y },
			{ drag: moving.y + moving.height, other: other.y + other.height },
			{ drag: moving.y, other: other.y + other.height },
			{ drag: moving.y + moving.height, other: other.y },
			{ drag: moving.y + moving.height / 2, other: other.y + other.height / 2 },
		]) {
			if (near(edge.drag, edge.other)) guides.push({ y: edge.other });
		}
	}
	return guides;
}

/**
 * Where a resized/rotated building must sit so the anchor OPPOSITE the one being
 * dragged stays exactly where it was — in stage coordinates, from the PRE
 * transform integers, so rounding the new origin cannot accumulate drift.
 *
 * `activeAnchor` null (a pure rotation, or an anchor this build does not know)
 * falls back to the node's own position, which is what the operator dragged.
 */
export function transformOrigin(input: {
	building: CanvasExtent & { rotation?: number | null };
	activeAnchor: string | null;
	nodeX: number;
	nodeY: number;
	newWidth: number;
	newHeight: number;
	newRotation: number;
}): { x: number; y: number } {
	const fixedAnchorName = input.activeAnchor ? OPPOSITE_ANCHORS[input.activeAnchor] : undefined;
	if (!fixedAnchorName) return { x: Math.round(input.nodeX), y: Math.round(input.nodeY) };

	const oldRad = ((input.building.rotation ?? 0) * Math.PI) / 180;
	const oldCos = Math.cos(oldRad);
	const oldSin = Math.sin(oldRad);
	const oldOff = anchorLocalOffset(input.building.width, input.building.height, fixedAnchorName);
	const fixedX = input.building.x + oldOff.x * oldCos - oldOff.y * oldSin;
	const fixedY = input.building.y + oldOff.x * oldSin + oldOff.y * oldCos;

	const newRad = (input.newRotation * Math.PI) / 180;
	const newCos = Math.cos(newRad);
	const newSin = Math.sin(newRad);
	const newOff = anchorLocalOffset(input.newWidth, input.newHeight, fixedAnchorName);
	// fixedPoint = origin + rotatedOffset → origin = fixedPoint − rotatedOffset
	return {
		x: Math.round(fixedX - (newOff.x * newCos - newOff.y * newSin)),
		y: Math.round(fixedY - (newOff.x * newSin + newOff.y * newCos)),
	};
}
