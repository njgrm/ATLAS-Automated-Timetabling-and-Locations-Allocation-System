import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Group, Layer, Rect, Stage, Text } from 'react-konva';
import { useRef } from 'react';

import type { Building } from '../types';
import {
	ROOM_UTILIZATION_LEGEND_TEXT,
	ROOM_UTILIZATION_UNKNOWN_FILL,
	ROOM_UTILIZATION_UNKNOWN_LEGEND_TEXT,
	buildingOccupancyBarPercent,
	buildingOccupancyTileLabel,
	isBuildingOccupancyKnown,
} from '../lib/room-utilization-display';
// A9 m1 — the framing, the background and the zoom cluster are the SHARED ones.
// This file had a `width={920} height={520}` stage, its own 0.4-2.5 arithmetic
// and three raw `<button>` elements, so it was a fourth private copy of the map
// and a §8 "one look per control" failure at the same time.
import { backgroundWorld, fitViewTransform, nextBackgroundZoom } from '@/components/campus-map/campusMapBackground';
import { CampusMapBackgroundLayer, useCampusImage, viewerPlacement } from '@/components/campus-map/CampusMapBackgroundLayer';
import { CampusMapZoomControls } from '@/components/campus-map/CampusMapZoomControls';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

type CampusMapProps = {
	buildings: Building[];
	activeBuildingId: number | null;
	onSelect: (buildingId: number | null) => void;
	/** Map of buildingId -> occupancy percentage (0-100). OPTIONAL: a building
	 *  with no entry has no measurement, which is NOT the same as an empty one.
	 *  `timetable/CenterWorkspace` does not supply this yet, so the absent case
	 *  is the common one and must never render as a figure. */
	buildingOccupancy?: Map<number, number>;
	/** A9 m1 — the photo and its placement, read by the caller through the shared
	 *  client seam. Both are OPTIONAL: a caller that does not supply them gets the
	 *  same "no background" view it has always got, and one that does gets the
	 *  same framing as the editor. */
	campusImageUrl?: string | null;
	campusMapPlacement?: unknown;
};

const DEPED_COLORS = {
	roof: '#95d1af',
	roofStroke: '#6fb890',
	walls: '#f1edca',
} as const;

const UNMEASURED_WORLD = { width: 920, height: 520 };

export function CampusMap({
	buildings,
	activeBuildingId,
	onSelect,
	buildingOccupancy,
	campusImageUrl,
	campusMapPlacement,
}: CampusMapProps) {
	const [zoom, setZoom] = useState(1);
	const [position, setPosition] = useState({ x: 0, y: 0 });
	// A9 m1 — the box is MEASURED. The old `width={920} height={520}` was a
	// constant standing in for a pane, which is the same mistake the editor's
	// `campusEditorCanvasSize` module documents at length.
	const boxRef = useRef<HTMLDivElement>(null);
	const [box, setBox] = useState({ width: UNMEASURED_WORLD.width, height: UNMEASURED_WORLD.height });

	useEffect(() => {
		const element = boxRef.current;
		if (!element) return;
		const observer = new ResizeObserver((entries) => {
			const rect = entries[0]?.contentRect;
			if (rect?.width) setBox((current) => ({ ...current, width: Math.floor(rect.width) }));
			if (rect?.height) setBox((current) => ({ ...current, height: Math.floor(rect.height) }));
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	const campusImage = useCampusImage(campusImageUrl);
	const world = useMemo(() => {
		const placement = viewerPlacement(campusMapPlacement, campusImage, box);
		return backgroundWorld(placement, buildings, box);
	}, [campusMapPlacement, campusImage, box, buildings]);
	const placement = useMemo(
		() => viewerPlacement(campusMapPlacement, campusImage, world),
		[campusMapPlacement, campusImage, world],
	);
	// The free area the world is fitted into, named as the shared function wants it.
	const fitBox = useMemo(() => ({ freeWidth: box.width, freeHeight: box.height }), [box.width, box.height]);
	const view = useMemo(
		() => fitViewTransform({ content: world, box: fitBox, zoom, pan: position }),
		[world, fitBox, zoom, position],
	);
	const clampPosition = useCallback(
		(next: { x: number; y: number }, atZoom: number) => {
			const transform = fitViewTransform({ content: world, box: fitBox, zoom: atZoom, pan: next });
			return { x: transform.x, y: transform.y };
		},
		[world, fitBox],
	);

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
			{/* Toolbar. A9 C6, fix 1.2 item 10.2: `md:px-6` matches `BuildingView`'s
			    utility bar, so the zoom controls sit the same distance from the border on
			    both campus maps ("one look per control", AGENTS.md §8).
			    A9 m1: the three raw `<button>` elements and their private 0.4-2.5
			    arithmetic are replaced by the SHARED `@/ui` cluster, so this map and the
			    editor and the overview have one zoom control, one range and one
			    percentage readout. `DEPED_COLORS` is retained above because it is this
			    file's own palette, not a duplicate of anything. */}
			<div className="shrink-0 mb-3 flex items-center gap-1.5 px-4 pt-4 md:px-6">
				<CampusMapZoomControls
					zoom={zoom}
					onZoomIn={() => setZoom((z) => nextBackgroundZoom(z, 0.15))}
					onZoomOut={() => setZoom((z) => nextBackgroundZoom(z, -0.15))}
					onReset={() => {
						setZoom(1);
						setPosition({ x: 0, y: 0 });
					}}
					label="campus map"
				/>
				<div className="h-4 w-px bg-border mx-2" />
				<span className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Campus Map View</span>
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<span className="ml-auto min-w-0 text-sm text-muted-foreground">
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
			<div ref={boxRef} className="flex-1 min-h-0 overflow-hidden relative bg-slate-50 shadow-inner">
				<Stage
					width={box.width}
					height={box.height}
					draggable
					x={view.x}
					y={view.y}
					scaleX={view.scale}
					scaleY={view.scale}
					onDragEnd={(e) => setPosition(clampPosition({ x: e.target.x(), y: e.target.y() }, zoom))}
					dragBoundFunc={(next) => clampPosition(next, zoom)}
					style={{ cursor: 'grab' }}
				>
					<Layer>
						{/* A9 m1: the shared background layer. This map painted a
						    4000x4000 beige rect and NO photo, so the room map a
						    scheduler sees in `/sections` and in the timetable centre pane
						    showed none of the background they had uploaded. */}
						<CampusMapBackgroundLayer
							image={campusImage}
							placement={placement}
							world={world}
						/>
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
