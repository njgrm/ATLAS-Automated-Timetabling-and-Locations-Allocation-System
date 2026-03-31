import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Group, Layer, Line, Rect, Stage, Text } from 'react-konva';
import { DoorOpen, Minus, Plus, RotateCcw } from 'lucide-react';

import type { Building, Room, RoomType } from '@/types';
import { Button } from '@/ui/button';

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

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
	CLASSROOM: 'Classroom',
	LABORATORY: 'Lab',
	COMPUTER_LAB: 'ICT Lab',
	TLE_WORKSHOP: 'TLE',
	LIBRARY: 'Library',
	GYMNASIUM: 'Gym',
	FACULTY_ROOM: 'Faculty',
	OFFICE: 'Office',
	OTHER: 'Other',
};

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

/* ─── Layout constants ─── */
const FLOOR_LABEL_W = 36;
const ROOM_GAP = 4;
const FLOOR_GAP = 3;
const ROOM_MIN_W = 80;
const ROOM_H = 64;
const SCHEDULE_PLACEHOLDER_H = 18;
const FLOOR_PAD_X = 8;
const FLOOR_PAD_Y = 6;
const ROOF_H = 28;
const GROUND_H = 14;
const PILLAR_W = 6;

type BuildingViewProps = {
	building: Building;
	/** Fixed height for the canvas — defaults to 400 */
	height?: number;
	/** Show zoom toolbar — defaults to true */
	showToolbar?: boolean;
	/** Currently selected room (controlled from parent) */
	selectedRoomId?: number | null;
	/** Called when a room is clicked */
	onRoomSelect?: (room: Room | null) => void;
};

export function BuildingView({ building, height: fixedHeight = 400, showToolbar = true, selectedRoomId, onRoomSelect }: BuildingViewProps) {
	const [hoveredRoomId, setHoveredRoomId] = useState<number | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [containerW, setContainerW] = useState(600);
	const [scale, setScale] = useState(1);
	const [pos, setPos] = useState({ x: 0, y: 0 });

	// Responsive width
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const obs = new ResizeObserver((entries) => {
			const w = entries[0]?.contentRect.width;
			if (w) setContainerW(Math.floor(w));
		});
		obs.observe(el);
		return () => obs.disconnect();
	}, []);

	const canvasH = fixedHeight;

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

	// Floors ascending (floor 1 at bottom)
	const floorsAsc = useMemo(
		() => Array.from({ length: building.floorCount }, (_, i) => i + 1),
		[building.floorCount],
	);

	// Compute the virtual building layout dimensions
	const maxRoomsOnFloor = useMemo(
		() => Math.max(1, ...floorsAsc.map((f) => (floorMap.get(f) ?? []).length)),
		[floorsAsc, floorMap],
	);

	const buildingContentW = FLOOR_LABEL_W + FLOOR_PAD_X * 2 + maxRoomsOnFloor * ROOM_MIN_W + (maxRoomsOnFloor - 1) * ROOM_GAP + PILLAR_W * 2;
	const floorTotalH = ROOM_H + SCHEDULE_PLACEHOLDER_H + FLOOR_PAD_Y * 2;
	const buildingContentH = ROOF_H + floorsAsc.length * floorTotalH + (floorsAsc.length - 1) * FLOOR_GAP + GROUND_H;

	// Auto-fit scale on mount / building change
	useEffect(() => {
		const sx = (containerW - 16) / buildingContentW;
		const sy = (canvasH - 16) / buildingContentH;
		const fitScale = Math.min(sx, sy, 1.4);
		setScale(Math.max(0.3, fitScale));
		// Center the building
		const scaledW = buildingContentW * fitScale;
		const scaledH = buildingContentH * fitScale;
		setPos({ x: (containerW - scaledW) / 2, y: (canvasH - scaledH) / 2 });
	}, [containerW, canvasH, buildingContentW, buildingContentH]);

	const resetView = useCallback(() => {
		const sx = (containerW - 16) / buildingContentW;
		const sy = (canvasH - 16) / buildingContentH;
		const fitScale = Math.min(sx, sy, 1.4);
		const s = Math.max(0.3, fitScale);
		setScale(s);
		setPos({ x: (containerW - buildingContentW * s) / 2, y: (canvasH - buildingContentH * s) / 2 });
	}, [containerW, canvasH, buildingContentW, buildingContentH]);

	if (building.rooms.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground" style={{ height: fixedHeight }}>
				<DoorOpen className="size-8 text-muted-foreground/30" />
				<p className="mt-2 text-sm">No rooms configured.</p>
			</div>
		);
	}

	// Render floors from bottom-up. Y origin = bottom of building content.
	const floorsRendered = floorsAsc.map((floorNum, idx) => {
		const rooms = floorMap.get(floorNum) ?? [];
		const floorY = buildingContentH - GROUND_H - (idx + 1) * floorTotalH - idx * FLOOR_GAP;
		const isGround = floorNum === 1;

		return (
			<Group key={floorNum} x={0} y={floorY}>
				{/* Floor slab background */}
				<Rect
					x={FLOOR_LABEL_W}
					y={0}
					width={buildingContentW - FLOOR_LABEL_W}
					height={floorTotalH}
					fill={isGround ? '#fafaf9' : '#fefefe'}
					cornerRadius={2}
				/>
				{/* Left pillar */}
				<Rect x={FLOOR_LABEL_W} y={0} width={PILLAR_W} height={floorTotalH} fill="#d4d4d4" />
				{/* Right pillar */}
				<Rect x={buildingContentW - PILLAR_W} y={0} width={PILLAR_W} height={floorTotalH} fill="#d4d4d4" />
				{/* Floor separator line */}
				<Line
					points={[FLOOR_LABEL_W, floorTotalH, buildingContentW, floorTotalH]}
					stroke="#a8a29e"
					strokeWidth={2}
				/>
				{/* Floor label */}
				<Rect x={0} y={0} width={FLOOR_LABEL_W - 2} height={floorTotalH} fill="#f5f5f4" cornerRadius={[4, 0, 0, 4]} />
				<Text
					x={2}
					y={floorTotalH / 2 - 8}
					width={FLOOR_LABEL_W - 4}
					text={`F${floorNum}`}
					fontSize={11}
					fontStyle="bold"
					fill="#78716c"
					align="center"
				/>
				{/* Rooms */}
				{rooms.map((room, ri) => {
					const colors = ROOM_FILLS[room.type] ?? ROOM_FILLS.OTHER;
					const roomX = FLOOR_LABEL_W + PILLAR_W + FLOOR_PAD_X + ri * (ROOM_MIN_W + ROOM_GAP);
					const roomY = FLOOR_PAD_Y;
					const isHovered = hoveredRoomId === room.id;
					const isInspected = selectedRoomId === room.id;
					return (
						<Group
							key={room.id}
							x={roomX}
							y={roomY}
							onMouseEnter={() => setHoveredRoomId(room.id)}
							onMouseLeave={() => setHoveredRoomId(null)}
								onClick={() => onRoomSelect?.(isInspected ? null : room)}
						>
							{/* Room body */}
							<Rect
								width={ROOM_MIN_W}
								height={ROOM_H}
								fill={colors.bg}
								stroke={isInspected ? '#6366f1' : isHovered ? colors.text : colors.accent}
								strokeWidth={isInspected ? 2 : 1}
								cornerRadius={3}
								shadowColor="rgba(0,0,0,0.06)"
								shadowBlur={isHovered ? 4 : 0}
								shadowOffsetY={isHovered ? 1 : 0}
							/>
							{/* Room name */}
							<Text
								x={4}
								y={6}
								width={ROOM_MIN_W - 8}
								text={room.name}
								fontSize={10}
								fontStyle="bold"
								fill={colors.text}
								wrap="none"
								ellipsis
							/>
							{/* Room type label */}
							<Text
								x={4}
								y={20}
								width={ROOM_MIN_W - 8}
								text={ROOM_TYPE_LABELS[room.type]}
								fontSize={8}
								fill="#9ca3af"
								wrap="none"
								ellipsis
							/>
							{/* Capacity indicator */}
							{room.capacity != null && (
								<Text
									x={4}
									y={34}
									width={ROOM_MIN_W - 8}
									text={`Cap: ${room.capacity}`}
									fontSize={8}
									fill="#9ca3af"
								/>
							)}
							{/* Non-teaching indicator */}
							{!room.isTeachingSpace && (
								<Text
									x={4}
									y={room.capacity != null ? 46 : 34}
									width={ROOM_MIN_W - 8}
									text="Non-teaching"
									fontSize={7}
									fill="#f59e0b"
									fontStyle="italic"
								/>
							)}
							{/* Schedule placeholder area */}
							<Rect
								x={0}
								y={ROOM_H + 2}
								width={ROOM_MIN_W}
								height={SCHEDULE_PLACEHOLDER_H - 2}
								fill={isHovered ? '#f3f4f6' : '#f9fafb'}
								stroke="#e5e7eb"
								strokeWidth={0.5}
								cornerRadius={[0, 0, 2, 2]}
								dash={[3, 2]}
							/>
							<Text
								x={2}
								y={ROOM_H + 4}
								width={ROOM_MIN_W - 4}
								text="Schedule"
								fontSize={7}
								fill="#d1d5db"
								align="center"
								fontStyle="italic"
							/>
						</Group>
					);
				})}
				{/* Empty floor placeholder */}
				{rooms.length === 0 && (
					<Text
						x={FLOOR_LABEL_W + PILLAR_W + FLOOR_PAD_X}
						y={floorTotalH / 2 - 6}
						text="Empty floor"
						fontSize={10}
						fill="#d1d5db"
						fontStyle="italic"
					/>
				)}
			</Group>
		);
	});

	return (
		<div className="relative">
			{/* Zoom toolbar */}
			{showToolbar && (
				<div className="mb-2 flex items-center gap-1">
					<Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setScale((s) => Math.min(s * 1.15, 3))}>
						<Plus className="size-3" />
					</Button>
					<Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setScale((s) => Math.max(s / 1.15, 0.2))}>
						<Minus className="size-3" />
					</Button>
					<Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={resetView}>
						<RotateCcw className="size-3" />
					</Button>
					<span className="ml-1 text-[0.625rem] text-muted-foreground tabular-nums">
						{Math.round(scale * 100)}%
					</span>
				</div>
			)}

			{/* Canvas */}
			<div ref={containerRef} className="overflow-hidden rounded-md border border-border bg-stone-50">
				<Stage
					width={containerW}
					height={canvasH}
					draggable
					x={pos.x}
					y={pos.y}
					scaleX={scale}
					scaleY={scale}
					onDragEnd={(e) => setPos({ x: e.target.x(), y: e.target.y() })}
					style={{ cursor: 'grab' }}
				>
					<Layer>
						{/* ── Roof ── */}
						<Line
							points={[
								FLOOR_LABEL_W - 4, ROOF_H,
								(FLOOR_LABEL_W + buildingContentW) / 2, 0,
								buildingContentW + 4, ROOF_H,
							]}
							closed
							fill="#78716c"
							stroke="#57534e"
							strokeWidth={1.5}
						/>
						{/* Roof accent line */}
						<Line
							points={[FLOOR_LABEL_W, ROOF_H, buildingContentW, ROOF_H]}
							stroke="#57534e"
							strokeWidth={2}
						/>
						{/* Building name on roof */}
						<Text
							x={FLOOR_LABEL_W}
							y={ROOF_H - 14}
							width={buildingContentW - FLOOR_LABEL_W}
							text={building.name}
							fontSize={11}
							fontStyle="bold"
							fill="#ffffff"
							align="center"
						/>

						{/* ── Floors group (offset below roof) ── */}
						<Group y={ROOF_H}>
							{/* Outer wall background */}
							<Rect
								x={FLOOR_LABEL_W}
								y={0}
								width={buildingContentW - FLOOR_LABEL_W}
								height={buildingContentH - ROOF_H - GROUND_H}
								fill="#fafaf9"
								stroke="#d6d3d1"
								strokeWidth={1}
							/>
						</Group>
						<Group y={ROOF_H}>
							{floorsRendered}
						</Group>

						{/* ── Ground / Foundation ── */}
						<Rect
							x={FLOOR_LABEL_W - 8}
							y={buildingContentH - GROUND_H}
							width={buildingContentW - FLOOR_LABEL_W + 16}
							height={GROUND_H}
							fill="#a8a29e"
							cornerRadius={[0, 0, 4, 4]}
						/>
						{/* Ground texture lines */}
						{[0.25, 0.5, 0.75].map((pct) => (
							<Line
								key={pct}
								points={[
									FLOOR_LABEL_W - 4 + pct * (buildingContentW - FLOOR_LABEL_W + 8),
									buildingContentH - GROUND_H + 3,
									FLOOR_LABEL_W - 4 + pct * (buildingContentW - FLOOR_LABEL_W + 8),
									buildingContentH - 2,
								]}
								stroke="#78716c"
								strokeWidth={0.5}
								opacity={0.4}
							/>
						))}
					</Layer>
				</Stage>
			</div>
		</div>
	);
}
