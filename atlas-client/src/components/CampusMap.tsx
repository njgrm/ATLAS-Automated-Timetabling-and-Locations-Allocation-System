import { Fragment, useCallback, useMemo, useState } from 'react';
import { Group, Layer, Rect, Stage, Text } from 'react-konva';
import { Minus, Plus, RotateCcw } from 'lucide-react';

import type { Building } from '../types';
import {
	ROOM_UTILIZATION_LEGEND_TEXT,
	ROOM_UTILIZATION_UNKNOWN_FILL,
	ROOM_UTILIZATION_UNKNOWN_LEGEND_TEXT,
	buildingOccupancyBarPercent,
	buildingOccupancyTileLabel,
	isBuildingOccupancyKnown,
} from '../lib/room-utilization-display';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

type CampusMapProps = {
	buildings: Building[];
	activeBuildingId: number | null;
	onSelect: (buildingId: number | null) => void;
	/** Map of buildingId -> occupancy percentage (0-100). OPTIONAL: a building
	 *  with no entry has no measurement, which is NOT the same as an empty one.
	 *  `timetable/CenterWorkspace` does not supply this yet, so the absent case
	 *  is the common one and must never render as a figure. */
	buildingOccupancy?: Map<number, number>;
};

const DEPED_COLORS = {
	roof: '#95d1af',
	roofStroke: '#6fb890',
	walls: '#f1edca',
} as const;

export function CampusMap({ buildings, activeBuildingId, onSelect, buildingOccupancy }: CampusMapProps) {
	const [scale, setScale] = useState(1);
	const [position, setPosition] = useState({ x: 0, y: 0 });

	const active = useMemo(
		() => buildings.find((b) => b.id === activeBuildingId) ?? null,
		[buildings, activeBuildingId],
	);

	const getOccupancyColor = (pct: number) => {
		if (pct >= 90) return '#dc2626'; // Red
		if (pct >= 70) return '#ea580c'; // Orange
		if (pct >= 50) return '#ca8a04'; // Yellow
		return '#16a34a'; // Green
	};

	return (
		<div className="h-full flex flex-col">
			{/* Toolbar */}
			<div className="shrink-0 mb-3 flex items-center gap-1.5 px-4 pt-4">
				<button
					className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-bold text-foreground hover:border-primary hover:text-primary transition-all shadow-sm"
					onClick={() => setScale((s) => Math.min(s + 0.15, 2.5))}
				>
					<Plus className="size-3.5" /> Zoom In
				</button>
				<button
					className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-bold text-foreground hover:border-primary hover:text-primary transition-all shadow-sm"
					onClick={() => setScale((s) => Math.max(s - 0.15, 0.4))}
				>
					<Minus className="size-3.5" /> Zoom Out
				</button>
				<button
					className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-bold text-foreground hover:border-primary hover:text-primary transition-all shadow-sm"
					onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }}
				>
					<RotateCcw className="size-3.5" /> Reset
				</button>
				<div className="h-4 w-px bg-border mx-2" />
				<span className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">Campus Map View</span>
				{/* A3 c4 — the tile says `USE N/A` in seven 7px characters because
				 * the canvas admits one line and no smaller font. The words go
				 * here, in the DOM, on the toolbar's EXISTING row: `h-8` buttons
				 * bound that row's height, so the legend adds none, and the 920px
				 * stage leaves the row room for the trailing `ml-auto` item. */}
				<TooltipProvider>
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
				</TooltipProvider>
			</div>

			{/* Canvas */}
			<div className="flex-1 overflow-hidden relative bg-slate-50 shadow-inner">
				<Stage
					width={920}
					height={520}
					draggable
					x={position.x}
					y={position.y}
					scaleX={scale}
					scaleY={scale}
					onDragEnd={(e) => setPosition({ x: e.target.x(), y: e.target.y() })}
					style={{ cursor: 'grab' }}
				>
					<Layer>
						<Rect x={-2000} y={-2000} width={4000} height={4000} fill="hsl(40 30% 95%)" />
					{buildings.map((b) => {
						const isSelected = active?.id === b.id;
						// A3 c4 — the recorded defect #53. This was
						// `buildingOccupancy?.get(b.id) ?? 0`, and line 144 formatted
						// it as `${Math.round(occupancy)}% FILLED`. `buildingOccupancy` is
						// optional and `timetable/CenterWorkspace` passes none, so every
						// wing asserted a confident, fabricated `0%` — including Grade 7
						// Wing, which had a full Term 2 week in G7 Room 103. An absent
						// measurement is now UNKNOWN, in a neutral grey that is not this
						// ramp's green-at-zero, and the bar is geometry only.
						const occupancyKnown = isBuildingOccupancyKnown(buildingOccupancy, b.id);
						const occupancy = buildingOccupancyBarPercent(buildingOccupancy, b.id);
						// The ramp is a MEASURED-FIGURE ramp. An unknown must never reach
						// it, or the tile wears the green that means "measured, empty".
						const occColor = occupancyKnown ? getOccupancyColor(occupancy) : ROOM_UTILIZATION_UNKNOWN_FILL;

						return (
								<Group 
									key={b.id} 
									x={b.x} y={b.y} 
									rotation={b.rotation ?? 0}
									onClick={() => onSelect(b.id)}
									onTap={() => onSelect(b.id)}
								>
									{/* Building Shadow */}
									<Rect
										x={4} y={4}
										width={b.width} height={b.height}
										fill="rgba(0,0,0,0.08)"
										cornerRadius={8}
										listening={false}
									/>
									{/* Building Body */}
									<Rect
										width={b.width} height={b.height}
										fill={b.color}
										opacity={isSelected ? 1 : 0.85}
										cornerRadius={8}
										stroke={isSelected ? '#111827' : '#ffffff'}
										strokeWidth={isSelected ? 4 : 2}
										shadowColor="rgba(0,0,0,0.15)"
										shadowBlur={isSelected ? 10 : 4}
										shadowOffsetY={2}
									/>

									{/* Name on Roof */}
									<Text
										x={8} y={8}
										width={b.width - 16}
										text={b.name}
										fontSize={Math.max(10, b.width / 8)} 
										fill="#ffffff" 
										fontStyle="bold"
										align="center"
										listening={false}
									/>

								{/* Occupancy Indicator. Geometry frozen: the group, the
								 * `b.width - 12` track, the 12-unit height and the 7px
								 * font all belong to the building boxes, which are sized
								 * from `b.width` and which other work depends on. Only the
								 * FILL and the LABEL became tri-state — the group was never
								 * grown and the font never shrunk, so the unknown label
								 * had to be short enough to stay on ONE line (a Konva
								 * `Text` with a `width` wraps, and a second line would
								 * run off the bottom of the building). */}
								<Group x={6} y={b.height - 18} data-utilization={occupancyKnown ? 'measured' : 'unknown'}>
									<Rect
										width={b.width - 12}
										height={12}
										fill={occupancyKnown ? 'rgba(255,255,255,0.2)' : ROOM_UTILIZATION_UNKNOWN_FILL}
										cornerRadius={4}
										opacity={occupancyKnown ? 1 : 0.75}
									/>
									{occupancyKnown && occupancy > 0 && (
										<Rect
											width={(b.width - 12) * (occupancy / 100)}
											height={12}
											fill={occColor}
											cornerRadius={4}
											opacity={0.9}
										/>
									)}
									<Text
										x={0} y={2.5}
										width={b.width - 12}
										text={buildingOccupancyTileLabel(buildingOccupancy, b.id)}
										fontSize={7}
										fontStyle="black"
										fill="#ffffff"
										align="center"
										listening={false}
									/>
								</Group>
								</Group>
							);
						})}
					</Layer>
				</Stage>
			</div>
		</div>
	);
}
