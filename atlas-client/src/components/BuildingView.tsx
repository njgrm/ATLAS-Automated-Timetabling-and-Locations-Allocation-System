import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Group, Layer, Line, Rect, Stage, Text } from 'react-konva';
import { DoorOpen, Minus, Plus, RotateCcw } from 'lucide-react';

import type { Building, Room, RoomType } from '@/types';
import { getPrimaryCanvasColor } from '@/components/campus-map/campusMapPalette';
import { ROOM_TYPE_LABELS } from '@/lib/room-type-labels';
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
const ROOM_MIN_W = 110;
const ROOM_H = 84;
const FLOOR_PAD_X = 8;
const FLOOR_PAD_Y = 6;
const ROOF_H = 32;
const ROOF_OVERHANG = 14;
const UTILIZATION_BAR_W = 10;

/* ─── Room-card frame budget (A3 fix 07/11) ───
 * Every text and meter element below owns a disjoint rectangle inside the
 * card, so no element can paint over another at any stage scale. The card grew
 * from 90x70 to 110x84 to hold that budget at an 11px authored size: the
 * building is width-dominated at desktop pane widths, so the extra width costs
 * essentially no fit scale while the taller card only costs the height budget
 * reported in the A3 handoff. Scaled device pixels are fontSize x stage scale,
 * never the authored value, so both are measured in the A3 layout control. */
export const ROOM_NAME_FONT = 11;
export const ROOM_LABEL_FONT = 11;
export const ROOM_LINE_H = 13;

/** The card frame, exported so the A3 layout control measures what is drawn. */
export const ROOM_CARD_W = ROOM_MIN_W;
export const ROOM_CARD_H = ROOM_H;

/** Room name: two wrapped lines before ellipsis (fix 11). */
export const ROOM_NAME_BOX = { x: 4, y: 4, width: 88, height: 26 } as const;
/** Room type (or the non-teaching marker) on its own line. */
export const ROOM_TYPE_BOX = { x: 4, y: 31, width: 88, height: 14 } as const;
/** Occupant / capacity chip. */
export const ROOM_OCCUPANCY_BOX = { x: 4, y: 47, width: 88, height: 17 } as const;
/** Utilization percentage, left of the footer strip. */
export const ROOM_UTILIZATION_TEXT_BOX = { x: 4, y: 66, width: 56, height: 14 } as const;
/** Program badge, right of the footer strip. Its own space, clear of the name. */
export const ROOM_PROGRAM_BADGE_BOX = { x: 66, y: 66, width: 26, height: 14 } as const;
/** Utilization bar, right-hand column. Never overlaps the text column. */
export const ROOM_UTILIZATION_BAR_BOX = { x: 96, y: 5, width: 10, height: 62 } as const;

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

/** Returns a color based on utilization percentage (green → yellow → red) */
function getUtilizationColor(pct: number): string {
	const clamped = Math.max(0, Math.min(100, pct));
	if (clamped <= 50) {
		const ratio = clamped / 50;
		const r = Math.round(34 + (234 - 34) * ratio);
		const g = Math.round(197 + (179 - 197) * ratio);
		const b = Math.round(94 + (8 - 94) * ratio);
		return `rgb(${r},${g},${b})`;
	} else {
		const ratio = (clamped - 50) / 50;
		const r = Math.round(234 + (220 - 234) * ratio);
		const g = Math.round(179 + (38 - 179) * ratio);
		const b = Math.round(8 + (38 - 8) * ratio);
		return `rgb(${r},${g},${b})`;
	}
}

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
	const floorTotalH = ROOM_H + FLOOR_PAD_Y * 2;
	const buildingContentH = ROOF_H + floorsAsc.length * floorTotalH + (floorsAsc.length - 1) * FLOOR_GAP;

	const calculateCenter = useCallback((w: number, h: number, s: number) => {
		return {
			x: (w - buildingContentW * s) / 2,
			y: (h - buildingContentH * s) / 2
		};
	}, [buildingContentW, buildingContentH]);

	const clampPosition = useCallback((nextPosition: { x: number; y: number }, nextScale: number) => {
		const scaledWidth = buildingContentW * nextScale;
		const scaledHeight = buildingContentH * nextScale;
		const center = calculateCenter(containerW, canvasHeight, nextScale);
		const x = scaledWidth <= containerW
			? center.x
			: Math.min(16, Math.max(containerW - scaledWidth - 16, nextPosition.x));
		const y = scaledHeight <= canvasHeight
			? center.y
			: Math.min(16, Math.max(canvasHeight - scaledHeight - 16, nextPosition.y));

		return { x, y };
	}, [buildingContentH, buildingContentW, calculateCenter, canvasHeight, containerW]);

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
		const sx = (containerW - 32) / buildingContentW;
		const sy = (canvasHeight - 32) / buildingContentH;
		const fitScale = Math.min(sx, sy, 1.4);
		const s = Math.max(0.3, fitScale);
		setScale(s);
		setPos(clampPosition(calculateCenter(containerW, canvasHeight, s), s));
	}, [containerW, canvasHeight, buildingContentW, buildingContentH, calculateCenter, clampPosition, building.id]);

	const resetView = useCallback(() => {
		const sx = (containerW - 32) / buildingContentW;
		const sy = (canvasHeight - 32) / buildingContentH;
		const fitScale = Math.min(sx, sy, 1.4);
		const s = Math.max(0.3, fitScale);
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

	const floorsRendered = floorsAsc.map((floorNum, idx) => {
		const rooms = floorMap.get(floorNum) ?? [];
		const floorY = (floorsAsc.length - 1 - idx) * (floorTotalH + FLOOR_GAP);

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
					const utilization = roomUtilization?.get(room.id) ?? 0;
					
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
								lineHeight={ROOM_LINE_H}
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
								lineHeight={ROOM_LINE_H}
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
										x={sectionData?.programCode ? 6 : 4}
										y={2}
										width={ROOM_OCCUPANCY_BOX.width - 8}
										height={ROOM_OCCUPANCY_BOX.height - 4}
										text={occupancy}
										fontSize={ROOM_LABEL_FONT}
										lineHeight={ROOM_LINE_H}
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
									lineHeight={ROOM_LINE_H}
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
										lineHeight={ROOM_LINE_H}
										fontStyle="bold"
										fill="#ffffff"
										align="center"
									/>
								</Group>
							)}

							<Rect
								x={ROOM_UTILIZATION_BAR_BOX.x}
								y={ROOM_UTILIZATION_BAR_BOX.y}
								width={ROOM_UTILIZATION_BAR_BOX.width}
								height={ROOM_UTILIZATION_BAR_BOX.height}
								fill="#f1f5f9"
								stroke="#e2e8f0"
								strokeWidth={0.5}
								cornerRadius={2}
							/>
							{utilization > 0 && (
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
							<Text
								x={ROOM_UTILIZATION_TEXT_BOX.x}
								y={ROOM_UTILIZATION_TEXT_BOX.y}
								width={ROOM_UTILIZATION_TEXT_BOX.width}
								height={ROOM_UTILIZATION_TEXT_BOX.height}
								text={`${Math.round(utilization)}%`}
								fontSize={ROOM_LABEL_FONT}
								lineHeight={ROOM_LINE_H}
								fontStyle="bold"
								fill={getUtilizationColor(utilization)}
								align="left"
							/>
						</Group>
					);
				})}
				{rooms.length === 0 && (
					<Text
						x={FLOOR_LABEL_W + FLOOR_PAD_X}
						y={floorTotalH / 2 - 6}
						text="Empty floor"
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
					<div ref={toolbarRef} className="mb-2 flex items-center gap-1">
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
					</div>
				</TooltipProvider>
			)}

			<div ref={containerRef} className={cn('overflow-hidden rounded-md border border-border bg-slate-50 relative', fillAvailableHeight && 'h-full')}>
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
