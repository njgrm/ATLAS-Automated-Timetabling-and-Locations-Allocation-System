import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Group, Layer, Line, Rect, Stage, Text } from 'react-konva';
import { DoorOpen, Minus, Plus, RotateCcw } from 'lucide-react';

import type { Building, Room, RoomType } from '@/types';
import { getPrimaryCanvasColor } from '@/components/campus-map/campusMapPalette';
import { ROOM_TYPE_LABELS } from '@/lib/room-type-labels';
import {
	ROOM_UTILIZATION_LEGEND_TEXT,
	ROOM_UTILIZATION_METER_SENTENCE_PREFIX,
	ROOM_UTILIZATION_UNKNOWN_FILL,
	ROOM_UTILIZATION_UNKNOWN_LEGEND_TEXT,
	isRoomUtilizationKnown,
	roomUtilizationBarPercent,
	roomUtilizationColor,
	roomUtilizationCompactLabel,
	roomUtilizationLabel,
	roomUtilizationMeterLabel,
} from '@/lib/room-utilization-display';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

/* ─── Room-type color tokens (canvas fills) ─── */
const ROOM_FILLS: Record<RoomType, { bg: string; text: string; accent: string }> = {
	CLASSROOM: { bg: '#eff6ff', text: '#1d4ed8', accent: '#bfdbfe' },
	LABORATORY: { bg: '#f5f3ff', text: '#6d28d9', accent: '#ddd6fe' },
	COMPUTER_LAB: { bg: '#ecfeff', text: '#0e7490', accent: '#a5f3fc' },
	TLE_WORKSHOP: { bg: '#fff7ed', text: '#c2410c', accent: '#fed7aa' },
	LIBRARY: { bg: '#fffbeb', text: '#b45309', accent: '#fde68a' },
	GYMNASIUM: { bg: '#ecfdf5', text: '#047857', accent: '#a7f3d0' },
	FACULTY_ROOM: { bg: '#fff1f2', text: '#be123c', accent: '#fecdd3' },
	OFFICE: { bg: '#f9fafb', text: '#4b5563', accent: '#d1d5db' },
	OTHER: { bg: '#f8fafc', text: '#475569', accent: '#cbd5e1' },
};

export { ROOM_TYPE_LABELS } from '@/lib/room-type-labels';

/* ─── HTML badge colors (exported for consumers) ─── */
export const ROOM_COLORS: Record<RoomType, { bg: string; border: string; text: string }> = {
	CLASSROOM: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
	LABORATORY: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700' },
	COMPUTER_LAB: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
	TLE_WORKSHOP: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
	LIBRARY: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
	GYMNASIUM: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
	FACULTY_ROOM: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
	OFFICE: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600' },
	OTHER: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600' },
};

/* ─── DepEd Standard Building Colors ─── */
const DEPED_COLORS = {
	roof: '#95d1af',
	roofStroke: '#6fb890',
	door: '#aed058',
	walls: '#f1edca',
	floorLabel: '#f0fdfa',
} as const;

/* ─── Layout constants ─── */
const FLOOR_LABEL_W = 36;
const ROOM_GAP = 4;
const FLOOR_GAP = 3;
const ROOM_MIN_W = 90;
const ROOM_H = 84;
const FLOOR_PAD_X = 8;
const FLOOR_PAD_Y = 6;
const ROOF_H = 32;
/** A3 c11 FIX-06 — one floor band, and one pitch between bands. Both the render
 *  loop and `buildingFloorRowTop` below read these, so a control can measure the
 *  floor the operator actually sees without restating the arithmetic. */
const FLOOR_ROW_H = ROOM_H + FLOOR_PAD_Y * 2;
const FLOOR_ROW_PITCH = FLOOR_ROW_H + FLOOR_GAP;
const ROOF_OVERHANG = 14;
const UTILIZATION_BAR_W = 10;

/* ─── Room-card frame budget (A3 fix 07/11) ───
 * Every text and meter element below owns a disjoint rectangle inside the
 * card, so no element can paint over another at any stage scale. The card is
 * 90x84: base was 90x70, and only the HEIGHT changed.
 *
 * Width is a cross-lane contract, not a private one. buildingContentW =
 * 48 + n x (ROOM_MIN_W + 4) is the divisor in the auto-fit scale
 * (containerW - 32) / buildingContentW that every consumer of this component
 * reads, and calculateCenter and clampPosition key off it too, so widening the
 * card does not merely cost this view a little fit scale — it shrinks the
 * rendered size of A2's timetable centre view and of every other consumer. A
 * previous revision of this comment claimed the opposite ("the building is
 * width-dominated at desktop pane widths, so the extra width costs essentially
 * no fit scale"). The code's own arithmetic refutes that, because
 * width-domination is precisely the case where sx is the limiter and the room
 * term grows with the width: at 110 wide the room term grows +22.2% and the
 * width-limited cases lost 16.4% to 16.8% of their fit scale, measured at A2's
 * 616px container. So the width stays at base 90.
 *
 * The 84px height is kept because it is genuinely required: name 2 lines (26) +
 * type (13) + occupancy (17) + footer (14) = 70px of text plus 8px padding
 * falls to 78px inside a 70px card, and the height term only limits a view
 * that is already taller than it is wide. The width-regression control in
 * a3-sections-map-layout.test.ts pins buildingContentW to base for a set of
 * (floors, maxRooms) cases so neither half of this can drift again silently.
 * Scaled device pixels are fontSize x stage scale, never the authored value, so
 * both are measured in that control. */
export const ROOM_NAME_FONT = 11;
export const ROOM_LABEL_FONT = 11;
/** The line PITCH in stage units, i.e. the height budget one text line may use. */
export const ROOM_LINE_H = 13;

/**
 * A3 fix 11 (second correction) — the value actually handed to Konva.
 *
 * Konva's `lineHeight` is a MULTIPLIER, not a pixel count
 * (`konva/lib/shapes/Text.js:455` `addGetterSetter(Text, 'lineHeight', 1)`,
 * and `:306` `lineHeightPx = this.lineHeight() * fontSize`). Passing the pixel
 * pitch `ROOM_LINE_H` (13) therefore produced a line pitch of
 * 13 x 11 = 143 STAGE UNITS, 11x the 13px budget, which is the whole fix-11
 * defect:
 *
 *  - `:400-404 _shouldHandleEllipsis` returns true after the FIRST line for
 *    every name, because `currentHeightPx + lineHeightPx` (286) exceeds
 *    `maxHeightPx` (26), so `:362 _tryToAddEllipsisToLastLine` replaces the rest
 *    of the name with a single "." — "Learning Commons" rendered as "Learning."
 *  - `:104/:111 translateY = lineHeightPx / 2` = 71.5, with `verticalAlign`
 *    defaulting to TOP so `alignY` is 0, so the name was drawn 71.5 units BELOW
 *    its own box — i.e. at the BOTTOM of the 84px card, which is exactly where
 *    the truncated label was observed, with the type line, occupancy chip and
 *    utilisation readout pushed off-card entirely.
 *
 * The ratio below is exact: (13/11) x 11 === 13 in IEEE-754, so a two-line name
 * occupies 26 units and still fits `ROOM_NAME_BOX.height` (26) with no ellipsis,
 * while a third line (39) is still rejected. `ROOM_LINE_H` itself is unchanged
 * at 13 so the disjoint-rectangle budget above and every existing layout control
 * keep their exact numbers, and no box moves.
 */
export const ROOM_LINE_RATIO = ROOM_LINE_H / ROOM_NAME_FONT;

/** The card frame, exported so the A3 layout control measures what is drawn. */
export const ROOM_CARD_W = ROOM_MIN_W;
export const ROOM_CARD_H = ROOM_H;

/** Room name: two wrapped lines before ellipsis (fix 11). Now actually true —
 *  the two lines are 2 x ROOM_LINE_RATIO x ROOM_NAME_FONT = 26 units, which
 *  equals this box height exactly, because `lineHeight` is a Konva ratio. */
export const ROOM_NAME_BOX = { x: 2, y: 4, width: 74, height: 26 } as const;
/** Room type (or the non-teaching marker) on its own line. */
export const ROOM_TYPE_BOX = { x: 2, y: 31, width: 74, height: 14 } as const;
/** Occupant / capacity chip. */
export const ROOM_OCCUPANCY_BOX = { x: 2, y: 47, width: 74, height: 17 } as const;
/**
 * A3 c11 fix 7.1 — the section-name label inside the occupant chip.
 *
 * THE MEASURED DEFECT, to two decimals, because "it looked tight" is not a
 * reason to move a box. Konva's default font is Arial (`Text.js:448`) and the
 * pill is `fontStyle="bold"`, so the glyph advances are the Arial Bold table:
 *
 *   "Sampaguita" = S667 a556 m889 p611 a556 g611 u611 i278 t333 a556
 *               = 5668/1000 em -> 62.35px at 11px
 *   "Sampaguita." = 5946/1000 em -> 65.41px
 *
 * The base label box was `ROOM_OCCUPANCY_BOX.width - 8` = 62 units wide, so the
 * NAME ITSELF was 0.35px wider than its box. Konva keeps a last line whole only
 * when `measureText(line + '\u2026') < maxWidth` (`Text.js:411-413`); both tests
 * fail, so Konva slices three characters and paints `Sampag\u2026` — the exact
 * string the 2026-09-28 live audit recorded on `G9 Room 401`.
 *
 * THE FIX is therefore WIDTH, not a smaller font. A 10px authored size was
 * available and was rejected on evidence: at 10px the name is 56.7px and still
 * needs a 59.5px box, so dropping the size costs legibility and buys nothing,
 * while an authored size below 11px is forbidden by the fix-10 ratchet
 * (`a3-sections-map-layout.test.ts`, "no text below 11px remains in the files
 * this stream owns"). The card is frozen at 90x84 for every consumer
 * (the width-regression control in the same file), so the room comes from the
 * 2px the text column was wasting on its left inset, uniformly across the name,
 * type and occupant rows: 74 units of column, 74 - 3 - 2 = 69 units of label.
 * 69 - 62.35 = 6.65px of slack.
 */
export const ROOM_OCCUPANCY_TEXT_BOX = { x: 3, y: 2, width: 69, height: 13 } as const;
/** Utilization percentage, left of the footer strip. */
export const ROOM_UTILIZATION_TEXT_BOX = { x: 4, y: 66, width: 36, height: 14 } as const;
/** Program badge, right of the footer strip. Its own space, clear of the name. */
export const ROOM_PROGRAM_BADGE_BOX = { x: 44, y: 66, width: 30, height: 14 } as const;
/** Utilization bar, right-hand column. Never overlaps the text column. */
export const ROOM_UTILIZATION_BAR_BOX = { x: 78, y: 5, width: 10, height: 62 } as const;
/**
 * A3 c11 fix 7.1 — the meter's permanent track, slate-300. Exported so the
 * rendered control measures the committed value rather than a constant the
 * control invented.
 *
 * The base value was slate-100 (`#f1f5f9`), which on the lightest card fill in
 * the palette (`CLASSROOM` `#eff6ff`) is **1.01:1** — the same colour to the eye,
 * which is why the rooms the operator named as showing no track (`G9 Room 402`,
 * `G9 Room 403`) showed none. slate-300 is 1.36:1 against that same fill and
 * 1.41:1 against the darkest (`FACULTY_ROOM` `#fff1f2`): a soft neutral slot that
 * is unmistakably present, which is what "permanent subtle background track"
 * asks for, and still not a border. The fix's own DOM example was
 * `bg-slate-200/70`, which composites to 1.14:1 over the same card — one step
 * short of being recognisable, so one step darker was taken deliberately.
 * `ROOM_UTILIZATION_BAR_BOX.width / 2` is what `rounded-full` resolves to on a
 * 10-unit-wide column, and the control asserts that equality so the track cannot
 * silently become a different shape.
 */
export const ROOM_UTILIZATION_TRACK_FILL = '#cbd5e1';
export const ROOM_UTILIZATION_TRACK_RADIUS = ROOM_UTILIZATION_BAR_BOX.width / 2;

/* ─── Grade-level color tokens (matching Sections.tsx) ─── */
const GRADE_ROOM_COLORS: Record<string, string> = {
	'7':  '#22c55e', // Green
	'8':  '#eab308', // Yellow
	'9':  '#ef4444', // Red
	'10': '#3b82f6', // Blue
};

const PROGRAM_BADGE_COLORS: Record<string, string> = {
	STE:   '#10b981', // emerald
	SPA:   '#8b5cf6', // purple
	SPS:   '#f59e0b', // orange
};

/**
 * Card-sized type labels. The full label is in the hover tooltip; the card line
 * uses a short form so it never has to ellipsise at 11px in the text column.
 */
const ROOM_TYPE_SHORT_LABEL: Record<RoomType, string> = {
	CLASSROOM: 'Classroom',
	LABORATORY: 'Laboratory',
	COMPUTER_LAB: 'Comp Lab',
	TLE_WORKSHOP: 'TLE Shop',
	LIBRARY: 'Library',
	GYMNASIUM: 'Gymnasium',
	FACULTY_ROOM: 'Faculty',
	OFFICE: 'Office',
	OTHER: 'Other',
};

/** Returns a color based on utilization percentage (green → yellow → red).
 *  A3: the body moved verbatim to `@/lib/room-utilization-display`, which now
 *  owns it for all three duplicated map components. The thresholds, the
 *  interpolation and the signature are unchanged. */
const getUtilizationColor = roomUtilizationColor;

export type RoomSectionMetadata = {
	sectionName: string;
	gradeKey: string;
	programCode?: string;
};

type BuildingViewProps = {
	building: Building;
	/** Fixed height for the canvas — defaults to 400 */
	height?: number;
	/**
	 * A3 fix 06 — track the host pane's height instead of a fixed canvas.
	 * The Assign-Home-Room pane is `flex-1` inside a `h-[90vh]` dialog, so a
	 * hardcoded height overflows the pane and the pane's `overflow-hidden`
	 * clips the bottom-most floor with no scrollbar to reveal it. The measured
	 * numbers are in the A3 handoff. Pan, zoom and clamp logic are untouched.
	 */
	fillAvailableHeight?: boolean;
	/** Show zoom toolbar — defaults to true */
	showToolbar?: boolean;
	/** Currently selected room (controlled from parent) */
	selectedRoomId?: number | null;
	/** Called when a room is clicked */
	onRoomSelect?: (room: Room | null) => void;
	/** Room utilization data: Map of roomId → percentage (0-100) */
	roomUtilization?: Map<number, number>;
	/** Room occupancy data: Map of roomId → sectionName (kept for backward compatibility) */
	roomOccupancy?: Map<number, string>;
	/** Rich room occupancy data: Map of roomId → Section metadata */
	roomSectionData?: Map<number, RoomSectionMetadata>;
};

/** The host pane's 1px top+bottom border, so the canvas never overflows it. */
const HOST_BORDER_PX = 2;

/* ─── A3 c11 FIX-06 — the pan bound, as one pure function ────────────────
 *
 * The recorded defect: "Building canvas cannot pan far enough to Floor 1 at
 * usable zoom." The clamp and the pane-measured stage were already correct, but
 * they lived inside the component, so the review's own verification matrix — 3+
 * floor counts x 60/80/100% x two pane heights — could not be decided without
 * a browser and a seeded 5-floor building, which is why the staging auditor
 * could not finish the row.
 *
 * `clampBuildingPan` is that same arithmetic, unchanged and used by the render
 * path (`clampPosition` below is now a one-line wrapper over it), exported so the
 * matrix is decidable. It is the ONLY pan bound in this component: there is no
 * second clamp for another page, which is what the "fix applies through the
 * shared component" criterion asks for.
 *
 * Why it is decidable without a browser: every input is either a constant
 * (`buildingFloorRowTop`, the padding) or a number the component measures
 * (`content`/`pane`). jsdom runs no layout, so the control supplies those
 * measured sizes directly rather than inventing them.
 */
export const BUILDING_PAN_PADDING_PX = 16;
export const BUILDING_FIT_MAX_SCALE = 1.4;
export const BUILDING_FIT_MIN_SCALE = 0.3;

export type BuildingPanContent = { width: number; height: number };
export type BuildingPanPane = { width: number; height: number };
export type BuildingPanPosition = { x: number; y: number };

/**
 * The content box, from the SAME constants the component lays out with. The
 * component keeps its own inline expressions (the width one is pinned by
 * `a3-sections-map-layout.test.ts` as a cross-lane contract), so this control
 * re-derives the committed expressions from source and fails if the two ever
 * disagree.
 */
export function buildingContentWidth(maxRoomsOnFloor: number): number {
	return FLOOR_LABEL_W + FLOOR_PAD_X * 2 + maxRoomsOnFloor * ROOM_MIN_W + (maxRoomsOnFloor - 1) * ROOM_GAP;
}

export function buildingContentHeight(floorCount: number): number {
	return ROOF_H + floorCount * FLOOR_ROW_H + (floorCount - 1) * FLOOR_GAP;
}

/**
 * The stage-space top edge of a floor row, measured from the top of the stage
 * (the roof is part of the content). Floor 1 is the BOTTOM-most row, so
 * `buildingFloorRowTop(1, n)` is the top of the floor the operator could not
 * reach. The render loop calls this, so the control and the pixels cannot
 * disagree about where that floor is.
 */
export function buildingFloorRowTop(floorNumber: number, floorCount: number): number {
	return ROOF_H + (floorCount - floorNumber) * FLOOR_ROW_PITCH;
}

/** The auto-fit scale: the smaller of the two axis fits, capped, never below 0.3. */
export function buildingFitScale(
	canvasWidth: number,
	canvasHeight: number,
	contentWidth: number,
	contentHeight: number,
): number {
	const sx = (canvasWidth - 32) / contentWidth;
	const sy = (canvasHeight - 32) / contentHeight;
	const fitScale = Math.min(sx, sy, 1.4);
	return Math.max(0.3, fitScale);
}

/** Where the content's centre sits in pane coordinates at a given scale. */
export function buildingPanCenter(
	nextScale: number,
	content: BuildingPanContent,
	pane: BuildingPanPane,
): BuildingPanPosition {
	return {
		x: (pane.width - content.width * nextScale) / 2,
		y: (pane.height - content.height * nextScale) / 2,
	};
}

/* clamp-building-pan:begin — the control compiles exactly this text, so the
 * matrix below fails if this function's arithmetic ever changes. */
export function clampBuildingPan(
	nextPosition: BuildingPanPosition,
	nextScale: number,
	content: BuildingPanContent,
	pane: BuildingPanPane,
): BuildingPanPosition {
	const canvasWidth = pane.width;
	const canvasHeight = pane.height;
	const scaledWidth = content.width * nextScale;
	const scaledHeight = content.height * nextScale;
	const center = buildingPanCenter(nextScale, content, pane);
	// Smaller than the pane on an axis: centre it, because there is no pan to
	// make. Larger: keep 16px of the pane on every side, which is both the
	// reachability guarantee and the infinite-drag bound.
	const x = scaledWidth <= canvasWidth
		? center.x
		: Math.min(16, Math.max(canvasWidth - scaledWidth - 16, nextPosition.x));
	const y = scaledHeight <= canvasHeight
		? center.y
		: Math.min(16, Math.max(canvasHeight - scaledHeight - 16, nextPosition.y));

	return { x, y };
}
/* clamp-building-pan:end */

export function BuildingView({ 
	building, 
	height: fixedHeight = 400, 
	fillAvailableHeight = false,
	showToolbar = true, 
	selectedRoomId, 
	onRoomSelect, 
	roomUtilization,
	roomOccupancy,
	roomSectionData
}: BuildingViewProps) {
	const [hoveredRoomId, setHoveredRoomId] = useState<number | null>(null);
	const [tooltipPos, setTooltipPos] = useState<{ x: number, y: number, roomId: number } | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const toolbarRef = useRef<HTMLDivElement>(null);
	const [containerW, setContainerW] = useState(600);
	const [hostHeight, setHostHeight] = useState<number | null>(null);
	const [scale, setScale] = useState(1);
	const [pos, setPos] = useState({ x: 0, y: 0 });
	const primaryCanvasColor = getPrimaryCanvasColor();
	// One effective height for auto-fit, clamping, centring and the Stage, so
	// the geometry the fit maths sees is the geometry that is actually drawn.
	const canvasHeight = fillAvailableHeight && hostHeight !== null ? hostHeight : fixedHeight;

	// Floor data (ascending: ground → top)
	const floorMap = useMemo(() => {
		const map = new Map<number, Room[]>();
		for (const room of building.rooms) {
			const existing = map.get(room.floor) ?? [];
			existing.push(room);
			map.set(room.floor, existing);
		}
		for (const [, rooms] of map) {
			rooms.sort((a, b) => a.floorPosition - b.floorPosition);
		}
		return map;
	}, [building.rooms]);

	const floorsAsc = useMemo(
		() => Array.from({ length: building.floorCount }, (_, i) => i + 1),
		[building.floorCount],
	);

	const maxRoomsOnFloor = useMemo(
		() => Math.max(1, ...floorsAsc.map((f) => (floorMap.get(f) ?? []).length)),
		[floorsAsc, floorMap],
	);

	const buildingContentW = FLOOR_LABEL_W + FLOOR_PAD_X * 2 + maxRoomsOnFloor * ROOM_MIN_W + (maxRoomsOnFloor - 1) * ROOM_GAP;
	const floorTotalH = FLOOR_ROW_H;
	const buildingContentH = ROOF_H + floorsAsc.length * floorTotalH + (floorsAsc.length - 1) * FLOOR_GAP;

	// A3 c11 FIX-06 — the centre, the clamp and the fit are the exported pure
	// functions above, so the review's floor x zoom x pane-height matrix decides
	// the same numbers the canvas draws. No arithmetic is restated here.
	const calculateCenter = useCallback((w: number, h: number, s: number) => {
		return buildingPanCenter(
			s,
			{ width: buildingContentW, height: buildingContentH },
			{ width: w, height: h },
		);
	}, [buildingContentW, buildingContentH]);

	const clampPosition = useCallback((nextPosition: { x: number; y: number }, nextScale: number) => {
		return clampBuildingPan(
			nextPosition,
			nextScale,
			{ width: buildingContentW, height: buildingContentH },
			{ width: containerW, height: canvasHeight },
		);
	}, [buildingContentH, buildingContentW, canvasHeight, containerW]);

	const zoomTo = useCallback((nextScale: number, anchor?: { x: number; y: number }) => {
		const boundedScale = Math.max(0.2, Math.min(3, nextScale));
		const focusPoint = anchor ?? { x: containerW / 2, y: canvasHeight / 2 };
		const buildingPoint = {
			x: (focusPoint.x - pos.x) / scale,
			y: (focusPoint.y - pos.y) / scale,
		};
		const nextPosition = {
			x: focusPoint.x - buildingPoint.x * boundedScale,
			y: focusPoint.y - buildingPoint.y * boundedScale,
		};

		setScale(boundedScale);
		setPos(clampPosition(nextPosition, boundedScale));
	}, [clampPosition, canvasHeight, containerW, pos.x, pos.y, scale]);

	// A3 fix 06 — measure the host pane, not this component. The host's height
	// is decided by the flex layout above it, so feeding the Stage back into
	// the measurement cannot feed back on itself.
	useEffect(() => {
		if (!fillAvailableHeight) return;
		const host = containerRef.current?.parentElement;
		if (!host) return;
		const measure = () => {
			const hostHeight = host.getBoundingClientRect().height;
			const toolbarHeight = showToolbar ? (toolbarRef.current?.offsetHeight ?? 0) : 0;
			setHostHeight(Math.max(0, Math.floor(hostHeight - toolbarHeight - HOST_BORDER_PX)));
		};
		measure();
		const obs = new ResizeObserver(measure);
		obs.observe(host);
		return () => obs.disconnect();
	}, [fillAvailableHeight, showToolbar]);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const obs = new ResizeObserver((entries) => {
			const w = entries[0]?.contentRect.width;
			if (w) {
				setContainerW(Math.floor(w));
				setPos(clampPosition(calculateCenter(w, canvasHeight, scale), scale));
			}
		});
		obs.observe(el);
		return () => obs.disconnect();
	}, [canvasHeight, scale, calculateCenter, clampPosition]);

	useEffect(() => {
		const s = buildingFitScale(containerW, canvasHeight, buildingContentW, buildingContentH);
		setScale(s);
		setPos(clampPosition(calculateCenter(containerW, canvasHeight, s), s));
	}, [containerW, canvasHeight, buildingContentW, buildingContentH, calculateCenter, clampPosition, building.id]);

	const resetView = useCallback(() => {
		const s = buildingFitScale(containerW, canvasHeight, buildingContentW, buildingContentH);
		setScale(s);
		setPos(clampPosition(calculateCenter(containerW, canvasHeight, s), s));
	}, [containerW, canvasHeight, buildingContentW, buildingContentH, calculateCenter, clampPosition]);

	if (building.rooms.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground" style={{ height: canvasHeight }}>
				<DoorOpen className="size-8 text-muted-foreground/30" />
				<p className="mt-2 text-sm">No rooms configured.</p>
			</div>
		);
	}

	const floorsRendered = floorsAsc.map((floorNum) => {
		const rooms = floorMap.get(floorNum) ?? [];
		// A3 c11 FIX-06 — measured from the stage top, then moved into the
		// roof-offset group this is drawn in, so the exported
		// `buildingFloorRowTop` is the same number the pixels use.
		const floorY = buildingFloorRowTop(floorNum, floorsAsc.length) - ROOF_H;

		return (
			<Group key={floorNum} x={0} y={floorY}>
				<Rect
					x={FLOOR_LABEL_W}
					y={0}
					width={buildingContentW - FLOOR_LABEL_W}
					height={floorTotalH}
					fill={DEPED_COLORS.walls}
					cornerRadius={2}
				/>
				<Line
					points={[FLOOR_LABEL_W, floorTotalH, buildingContentW, floorTotalH]}
					stroke="#d4cfa8"
					strokeWidth={1.5}
				/>
				<Rect x={0} y={0} width={FLOOR_LABEL_W - 2} height={floorTotalH} fill={DEPED_COLORS.floorLabel} cornerRadius={[4, 0, 0, 4]} />
				<Text
					x={2}
					y={floorTotalH / 2 - 8}
					width={FLOOR_LABEL_W - 4}
					text={`F${floorNum}`}
					fontSize={11}
					fontStyle="bold"
					fill="#0d9488"
					align="center"
				/>
				{rooms.map((room, ri) => {
					const colors = ROOM_FILLS[room.type] ?? ROOM_FILLS.OTHER;
					const roomX = FLOOR_LABEL_W + FLOOR_PAD_X + ri * (ROOM_MIN_W + ROOM_GAP);
					// A3: `?? 0` here rendered "we could not compute this" as a
					// confident 0%, because `roomUtilization` omits a room whose
					// draft has no single-term identity. The unknown case now keeps
					// its own readout; `utilization` is bar geometry only.
					const utilizationKnown = isRoomUtilizationKnown(roomUtilization, room.id);
					const utilization = roomUtilizationBarPercent(roomUtilization, room.id);

					const sectionData = roomSectionData?.get(room.id);
					const occupancy = sectionData?.sectionName ?? roomOccupancy?.get(room.id);
					const gradeColor = sectionData ? GRADE_ROOM_COLORS[sectionData.gradeKey] : null;

					const roomY = FLOOR_PAD_Y;
					const isHovered = hoveredRoomId === room.id;
					const isInspected = selectedRoomId === room.id;
					return (
						<Group
							key={room.id}
							x={roomX}
							y={roomY}
							onMouseEnter={(e) => {
								setHoveredRoomId(room.id);
								const stage = e.target.getStage();
								if (stage) {
									const p = stage.getPointerPosition();
									if (p) setTooltipPos({ ...p, roomId: room.id });
								}
							}}
							onMouseMove={(e) => {
								const stage = e.target.getStage();
								if (stage) {
									const p = stage.getPointerPosition();
									if (p) setTooltipPos({ ...p, roomId: room.id });
								}
							}}
							onMouseLeave={() => {
								setHoveredRoomId(null);
								setTooltipPos(null);
							}}
							onClick={() => onRoomSelect?.(isInspected ? null : room)}
						>
							<Rect
								width={ROOM_MIN_W}
								height={ROOM_H}
								fill={colors.bg}
								stroke={isInspected ? primaryCanvasColor : (gradeColor || (isHovered ? colors.text : colors.accent))}
								strokeWidth={isInspected || gradeColor ? 2 : 1}
								cornerRadius={3}
								shadowColor="rgba(0,0,0,0.06)"
								shadowBlur={isHovered ? 4 : 0}
								shadowOffsetY={isHovered ? 1 : 0}
							/>
							{/* A3 fix 07/11: the name, the type line, the occupant chip,
								the utilization readout, the program badge and the
								utilization bar each own a disjoint rectangle. The
								hover tooltip below is the single full-detail
								surface for this card, so nothing else is added. */}
							<Text
								x={ROOM_NAME_BOX.x}
								y={ROOM_NAME_BOX.y}
								width={ROOM_NAME_BOX.width}
								height={ROOM_NAME_BOX.height}
								text={room.name}
								fontSize={ROOM_NAME_FONT}
								lineHeight={ROOM_LINE_RATIO}
								fontStyle="bold"
								fill={gradeColor || colors.text}
								wrap="word"
								ellipsis
							/>
							<Text
								x={ROOM_TYPE_BOX.x}
								y={ROOM_TYPE_BOX.y}
								width={ROOM_TYPE_BOX.width}
								height={ROOM_TYPE_BOX.height}
								text={room.isTeachingSpace ? ROOM_TYPE_SHORT_LABEL[room.type] : 'Non-teaching'}
								fontSize={ROOM_LABEL_FONT}
								lineHeight={ROOM_LINE_RATIO}
								fontStyle={room.isTeachingSpace ? 'normal' : 'italic'}
								fill={room.isTeachingSpace ? '#6b7280' : '#b45309'}
								wrap="none"
								ellipsis
							/>

							{occupancy ? (
								<Group x={ROOM_OCCUPANCY_BOX.x} y={ROOM_OCCUPANCY_BOX.y}>
									<Rect
										width={ROOM_OCCUPANCY_BOX.width}
										height={ROOM_OCCUPANCY_BOX.height}
										fill={isInspected ? "rgba(255,255,255,0.2)" : (gradeColor ? `${gradeColor}20` : "rgba(16,185,129,0.1)")}
										cornerRadius={2}
									/>
									{sectionData?.programCode && PROGRAM_BADGE_COLORS[sectionData.programCode] && (
										<Rect
											width={2}
											height={ROOM_OCCUPANCY_BOX.height}
											fill={PROGRAM_BADGE_COLORS[sectionData.programCode]}
											cornerRadius={[2, 0, 0, 2]}
										/>
									)}
									<Text
										x={ROOM_OCCUPANCY_TEXT_BOX.x}
										y={ROOM_OCCUPANCY_TEXT_BOX.y}
										width={ROOM_OCCUPANCY_TEXT_BOX.width}
										height={ROOM_OCCUPANCY_TEXT_BOX.height}
										text={occupancy}
										fontSize={ROOM_LABEL_FONT}
										lineHeight={ROOM_LINE_RATIO}
										fontStyle="bold"
										fill={isInspected ? colors.text : (gradeColor || "#047857")}
										wrap="word"
										ellipsis
									/>
								</Group>
							) : room.capacity != null ? (
								<Text
									x={ROOM_OCCUPANCY_BOX.x}
									y={ROOM_OCCUPANCY_BOX.y}
									width={ROOM_OCCUPANCY_BOX.width}
									height={ROOM_OCCUPANCY_BOX.height}
									text={`Capacity: ${room.capacity}`}
									fontSize={ROOM_LABEL_FONT}
									lineHeight={ROOM_LINE_RATIO}
									fill="#6b7280"
									wrap="none"
									ellipsis
								/>
							) : null}

							{sectionData?.programCode && PROGRAM_BADGE_COLORS[sectionData.programCode] && (
								<Group
									x={ROOM_PROGRAM_BADGE_BOX.x}
									y={ROOM_PROGRAM_BADGE_BOX.y}
									opacity={isInspected ? 0.35 : 1}
								>
									<Rect
										width={ROOM_PROGRAM_BADGE_BOX.width}
										height={ROOM_PROGRAM_BADGE_BOX.height}
										fill={PROGRAM_BADGE_COLORS[sectionData.programCode]}
										cornerRadius={2}
									/>
									<Text
										width={ROOM_PROGRAM_BADGE_BOX.width}
										height={ROOM_PROGRAM_BADGE_BOX.height}
										verticalAlign="middle"
										text={sectionData.programCode}
										fontSize={ROOM_LABEL_FONT}
										lineHeight={ROOM_LINE_RATIO}
										fontStyle="bold"
										fill="#ffffff"
										align="center"
									/>
								</Group>
							)}

						{/* A3 c11 fix 7.1 — the meter TRACK is permanent.
						 * The base painted `fill="#f1f5f9"` (slate-100) with a
						 * `#e2e8f0` 0.5px stroke. slate-100 is 1.01:1 against a
						 * CLASSROOM card (`#eff6ff`), i.e. the same colour to the
						 * eye, so the "empty" rooms the operator named — `G9 Room
						 * 402`, `G9 Room 403` — showed no track at all; that is why
						 * the live audit recorded "neither the requested permanent
						 * meter track nor 0% tooltip" on exactly those cards. The
						 * stroke was also the "harsh border outline" the fix asks to
						 * be replaced by a soft neutral track, so it is gone.
						 *
						 * The track is drawn UNCONDITIONALLY, so a room at a measured
						 * 0% and a room whose utilisation is UNKNOWN now differ by the
						 * FILL alone (absent vs present) instead of by the whole
						 * widget. The label under the track is what separates those
						 * two readings in words (`0%` vs `n/a`); the track itself
						 * says only "this is the meter slot". */}
						<Rect
							x={ROOM_UTILIZATION_BAR_BOX.x}
							y={ROOM_UTILIZATION_BAR_BOX.y}
							width={ROOM_UTILIZATION_BAR_BOX.width}
							height={ROOM_UTILIZATION_BAR_BOX.height}
							fill={ROOM_UTILIZATION_TRACK_FILL}
							cornerRadius={ROOM_UTILIZATION_TRACK_RADIUS}
						/>
						{utilizationKnown && utilization > 0 && (
							<Rect
								x={ROOM_UTILIZATION_BAR_BOX.x + 1}
								y={ROOM_UTILIZATION_BAR_BOX.y + ROOM_UTILIZATION_BAR_BOX.height - 2 - (ROOM_UTILIZATION_BAR_BOX.height - 4) * (utilization / 100)}
								width={ROOM_UTILIZATION_BAR_BOX.width - 2}
								height={(ROOM_UTILIZATION_BAR_BOX.height - 4) * (utilization / 100)}
								fill={getUtilizationColor(utilization)}
								opacity={0.85}
								cornerRadius={[0, 0, 1, 1]}
							/>
						)}
						{/* A3: the label is the discriminator between a measured 0%
						 * and an unknown. An unknown readout is neutral grey and
						 * never passes through `getUtilizationColor`, whose
						 * green-at-zero is a measured-zero signal. */}
						<Text
							x={ROOM_UTILIZATION_TEXT_BOX.x}
							y={ROOM_UTILIZATION_TEXT_BOX.y}
							width={ROOM_UTILIZATION_TEXT_BOX.width}
							height={ROOM_UTILIZATION_TEXT_BOX.height}
							text={roomUtilizationCompactLabel(roomUtilization, room.id)}
							fontSize={ROOM_LABEL_FONT}
							lineHeight={ROOM_LINE_RATIO}
							fontStyle="bold"
							fill={utilizationKnown ? getUtilizationColor(utilization) : ROOM_UTILIZATION_UNKNOWN_FILL}
							align="left"
						/>
						</Group>
					);
				})}
				{rooms.length === 0 && (
					<Text
						x={FLOOR_LABEL_W + FLOOR_PAD_X}
						y={floorTotalH / 2 - 6}
						/* A3 C1 — one word for the empty-floor state. The label is
						 * already drawn inside this floor's own band, to the right of
						 * its `F<n>` tag, so "floor" restated what the position
						 * already says. "Empty" is the word the repo already uses for
						 * an empty container (`room-schedules/OccupancyTemplatePreview`),
						 * so choosing it settles inventory rows 249/250 without editing
						 * that file, and it keeps the meaning: this floor has no rooms. */
						text="Empty"
						fontSize={11}
						fill="#9ca3af"
						fontStyle="italic"
					/>
				)}
			</Group>
		);
	});

	return (
		<div className={cn('relative', fillAvailableHeight && 'h-full')}>
			{showToolbar && (
				<TooltipProvider>
				{/* A9 C6, fix 1.2 item 10.2 — horizontal inset ONLY: three of the four callers pass a
				    FIXED stage height and this row's height is bound by its `h-7` buttons ON PURPOSE.
				    Same `px-4 md:px-6` on the drawing surface below; `a3-c4-map-truth.test.ts` B has
				    the rationale, the `contentRect` proof and the :834 decline. */}
				<div ref={toolbarRef} className="mb-2 flex items-center gap-1 px-4 md:px-6">
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="outline" size="sm" className="h-7 w-7 p-0" aria-label="Zoom in building view" onClick={() => zoomTo(scale * 1.15)}>
									<Plus className="size-3" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Zoom in</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="outline" size="sm" className="h-7 w-7 p-0" aria-label="Zoom out building view" onClick={() => zoomTo(scale / 1.15)}>
									<Minus className="size-3" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Zoom out</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="outline" size="sm" className="h-7 w-7 p-0" aria-label="Reset building view" onClick={resetView}>
									<RotateCcw className="size-3" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Reset view</TooltipContent>
						</Tooltip>
					<span className="ml-1 text-xs text-muted-foreground tabular-nums">
						{Math.round(scale * 100)}%
					</span>
					{/* A3 c4 — the `n/a` token is honest but was UNLABELLED, and it
					 * contradicted the campus tile's `0%` for the same building.
					 * `ROOM_UTILIZATION_TEXT_BOX` is 36x14 and frozen, so the words
					 * cannot go in the card; they go in the DOM chrome, on the
					 * toolbar's EXISTING row. `h-7` buttons bound that row's height,
					 * so this adds ZERO height to all four callers — three of which
					 * pass a fixed stage height — and the `fillAvailableHeight`
					 * caller re-measures its host anyway. The full sentence is
					 * reachable on hover through `@/ui` rather than a raw `title`. */}
					<Tooltip>
						<TooltipTrigger asChild>
							<span className="ml-auto min-w-0 truncate text-xs text-muted-foreground">
								{ROOM_UTILIZATION_LEGEND_TEXT} &middot; {ROOM_UTILIZATION_UNKNOWN_LEGEND_TEXT}
							</span>
						</TooltipTrigger>
						<TooltipContent>
							{ROOM_UTILIZATION_LEGEND_TEXT} &middot; {ROOM_UTILIZATION_UNKNOWN_LEGEND_TEXT}
						</TooltipContent>
					</Tooltip>
				</div>
				</TooltipProvider>
			)}

			<div ref={containerRef} className={cn('overflow-hidden rounded-md border border-border bg-slate-50 relative px-4 md:px-6', fillAvailableHeight && 'h-full')}>
				<Stage
					width={containerW}
					height={canvasHeight}
					draggable
					x={pos.x}
					y={pos.y}
					scaleX={scale}
					scaleY={scale}
					onDragEnd={(e) => setPos(clampPosition({ x: e.target.x(), y: e.target.y() }, scale))}
					dragBoundFunc={(nextPosition) => clampPosition(nextPosition, scale)}
					onWheel={(event) => {
						event.evt.preventDefault();
						const stage = event.target.getStage();
						zoomTo(scale * (event.evt.deltaY < 0 ? 1.08 : 1 / 1.08), stage?.getPointerPosition() ?? undefined);
					}}
					style={{ cursor: 'grab', touchAction: 'none' }}
				>
					<Layer>
						<Line
							points={[
								FLOOR_LABEL_W - ROOF_OVERHANG, ROOF_H,
								FLOOR_LABEL_W + 24, 0,
								buildingContentW - 24, 0,
								buildingContentW + ROOF_OVERHANG, ROOF_H,
							]}
							closed
							fill={DEPED_COLORS.roof}
							stroke={DEPED_COLORS.roofStroke}
							strokeWidth={1.5}
						/>
						<Line
							points={[FLOOR_LABEL_W - ROOF_OVERHANG + 2, ROOF_H, buildingContentW + ROOF_OVERHANG - 2, ROOF_H]}
							stroke={DEPED_COLORS.roofStroke}
							strokeWidth={2}
						/>
						<Text
							x={FLOOR_LABEL_W + 24}
							y={ROOF_H / 2 - 6}
							width={buildingContentW - FLOOR_LABEL_W - 48}
							text={building.name}
							fontSize={12}
							fontStyle="bold"
							fill="#166534"
							align="center"
						/>

						<Group y={ROOF_H}>
							<Rect
								x={FLOOR_LABEL_W}
								y={0}
								width={buildingContentW - FLOOR_LABEL_W}
								height={buildingContentH - ROOF_H}
								fill={DEPED_COLORS.walls}
								stroke="#d4cfa8"
								strokeWidth={1}
								cornerRadius={[0, 0, 3, 3]}
							/>
						</Group>
						<Group y={ROOF_H}>
							{floorsRendered}
						</Group>
					</Layer>
				</Stage>

			{tooltipPos && (
				<div
					className="absolute z-50 pointer-events-none bg-popover/95 backdrop-blur-sm border shadow-xl rounded-lg p-2.5 text-xs flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-100 min-w-40 max-w-64"
					style={{ left: tooltipPos.x + 15, top: tooltipPos.y - 10 }}
				>
					{(() => {
						const r = building.rooms.find(rm => rm.id === tooltipPos.roomId);
						const meta = roomSectionData?.get(tooltipPos.roomId);
						if (!r) return null;
						return (
							<>
								<div className="flex items-center justify-between gap-2 border-b pb-1.5 mb-1">
									<span className="font-bold text-foreground break-words">{r.name}</span>
									<Badge variant="outline" className="h-5 px-1 text-xs shrink-0 uppercase">
										F{r.floor}
									</Badge>
								</div>
								<div className="flex justify-between gap-4">
									<span className="text-muted-foreground uppercase font-bold text-xs tracking-wide">Type</span>
									<span className="font-bold uppercase text-right">{ROOM_TYPE_LABELS[r.type]}</span>
								</div>
								<div className="flex justify-between gap-4">
									<span className="text-muted-foreground uppercase font-bold text-xs tracking-wide">Capacity</span>
									<span className="font-bold tabular-nums">{r.capacity ?? '—'}</span>
								</div>
								{/* A3 c4 — Top-10 #4: "is this room free?" was not
								 * answerable, because the card read `Capacity: 45` and
								 * nothing about use. It now reads beside it, from the SAME
								 * `roomUtilization` reading the card's own `n/a`/`0%` token
								 * is drawn from, so the two can never disagree.
								 *
								 * A PERCENTAGE, not "Used 32 of 40 periods": the only real
								 * denominator is `pivotDraftToView`'s `availableMinutes`, a
								 * duration, and a period count would have to be invented from
								 * a percentage — the same fabrication the campus tile just
								 * stopped making.
								 *
								 * And this is DOM, so the unknown case is spelled out in
								 * words here rather than left as the canvas-only `n/a` token:
								 * c0's header comment claimed this hover layer was the
								 * full-detail surface, and it did not mention use at all. */}
							<div className="flex justify-between gap-4" data-utilization={isRoomUtilizationKnown(roomUtilization, r.id) ? 'measured' : 'unknown'}>
								<span className="text-muted-foreground uppercase font-bold text-xs tracking-wide">Use</span>
								<span className={cn('font-bold tabular-nums', !isRoomUtilizationKnown(roomUtilization, r.id) && 'italic')}>
									{roomUtilizationLabel(roomUtilization, r.id)}
								</span>
							</div>
							{/* A3 c11 fix 7.1 — the meter's own sentence.
							 * Konva cannot hang a tooltip on ONE node, and the
							 * room card deliberately has a single full-detail hover
							 * surface (stated in the fix 07/11 comment above), so
							 * the operator's requested "share of periods in use: X%"
							 * lives on that surface, one line under the figure. It
							 * reads as the MEANING of the figure above it, which is
							 * what an operator reading a `0%` on an apparently empty
							 * room actually needs: the number, then what it counts. */}
							<div className="flex justify-between gap-4" data-meter="true">
								<span className="text-muted-foreground uppercase font-bold text-xs tracking-wide">Meter</span>
								<span className="text-right text-muted-foreground">{roomUtilizationMeterLabel(roomUtilization, r.id)}</span>
							</div>
								{meta && (
									<div className="mt-1 pt-1 border-t flex flex-col gap-1">
										<div className="flex items-center gap-1.5">
											<div className="size-2 shrink-0 rounded-full" style={{ backgroundColor: GRADE_ROOM_COLORS[meta.gradeKey] }} />
											<span className="font-bold text-foreground break-words">{meta.sectionName}</span>
										</div>
										{meta.programCode && (
											<div className="flex items-center gap-1.5">
												<Badge className="h-5 px-1.5 text-xs font-bold" style={{ backgroundColor: PROGRAM_BADGE_COLORS[meta.programCode] || '#94a3b8' }}>
													{meta.programCode}
												</Badge>
												<span className="text-xs text-muted-foreground uppercase font-bold">Home Room</span>
											</div>
										)}
									</div>
								)}
							</>
						);
					})()}
				</div>
			)}

			</div>
		</div>
	);
}
