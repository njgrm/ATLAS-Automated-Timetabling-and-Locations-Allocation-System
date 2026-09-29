import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Group, Layer, Rect, Stage, Text } from 'react-konva';

import type { Building } from '@/types';
import { MAP_DEFAULT_STROKE, MAP_SELECTED_STROKE, getPrimaryCanvasColor } from '@/components/campus-map/campusMapPalette';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
// A9 m1 — the framing and the background are now the SHARED ones. The four
// constants and the fit/offset/clamp/zoom arithmetic that used to be declared
// here are gone; see the file header for what they were and why a second copy was
// the bug.
import {
	backgroundWorld,
	fitViewTransform,
	nextBackgroundZoom,
	safeWorld,
} from '@/components/campus-map/campusMapBackground';
import { CampusMapBackgroundLayer, useCampusImage, viewerPlacement } from '@/components/campus-map/CampusMapBackgroundLayer';
import { CampusMapZoomControls } from '@/components/campus-map/CampusMapZoomControls';

/**
 * A9 m1 — the read-only campus map, used by the map overview and the Dashboard
 * campus card. Its framing is now the SAME function the editor uses, and its
 * background is the SAME component.
 *
 * WHAT WAS WRONG HERE, and it was not only the stretch. This file declared its
 * own `CANVAS_WIDTH = 920`, `CANVAS_HEIGHT = 580`, `MIN_ZOOM = 0.8` and
 * `MAX_ZOOM = 3`, and its own `getOffsets` / `clampPosition` / `zoomTo`. The
 * editor's cluster stopped at 0.4 and this one started at 0.8, so "Zoom Out" on
 * the overview did something visibly different from "Zoom Out" in the editor —
 * which is AGENTS.md §8's "one look per control" failure in its purest form, and
 * a scheduler who framed a photo in one place could not reproduce the framing in
 * the other.
 *
 * ALL FOUR CONSTANTS ARE GONE, and with them the duplicated arithmetic. The world
 * is now the union of the container, the buildings and the photo
 * (`backgroundWorld`), the view is `fitViewTransform` — the editor's own function,
 * by reference — and the zoom bounds are `MIN_VIEW_ZOOM`/`MAX_VIEW_ZOOM`, the
 * same pair the buttons and the wheel use everywhere.
 *
 * `DEFAULT_CAMPUS_WORLD` remains only as the UNMEASURED first paint, before the
 * ResizeObserver has reported a width. It is the pre-measurement placeholder, not
 * a frame the photo is fitted into: as soon as the container is measured the
 * world is derived from it.
 */
const DEFAULT_CAMPUS_WORLD = { width: 920, height: 580 };

export type CampusMapCanvasPreviewProps = {
	buildings: Building[];
	campusImageUrl?: string | null;
	/** A9 m1 — the stored placement, or null for a school that never chose one. */
	campusMapPlacement?: unknown;
	selectedBuildingId?: number | null;
	onSelectBuilding?: (buildingId: number) => void;
	height?: number;
	compact?: boolean;
	interactive?: boolean;
	showToolbar?: boolean;
};

function smartLabelRotation(buildingRotation: number): number {
	const absAngle = Math.abs(buildingRotation % 360);
	const effective = absAngle > 180 ? 360 - absAngle : absAngle;
	return effective <= 20 ? -(buildingRotation ?? 0) : 0;
}

export function CampusMapCanvasPreview({
	buildings,
	campusImageUrl,
	campusMapPlacement,
	selectedBuildingId,
	onSelectBuilding,
	height = 420,
	compact = false,
	interactive = false,
	showToolbar = false,
}: CampusMapCanvasPreviewProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [containerWidth, setContainerWidth] = useState(DEFAULT_CAMPUS_WORLD.width);
	const [containerHeight, setContainerHeight] = useState(height);
	const [zoom, setZoom] = useState(1);
	const [position, setPosition] = useState({ x: 0, y: 0 });

	useEffect(() => {
		const element = containerRef.current;
		if (!element) return;

		const resizeObserver = new ResizeObserver((entries) => {
			const rect = entries[0]?.contentRect;
			// BOTH axes are measured. The old code read only the width and took the
			// height from a prop, so a viewer in a shorter box framed its content
			// against a height it was not actually painting into.
			if (rect?.width) setContainerWidth(Math.floor(rect.width));
			if (rect?.height) setContainerHeight(Math.floor(rect.height));
		});
		resizeObserver.observe(element);
		return () => resizeObserver.disconnect();
	}, []);

	const campusImage = useCampusImage(campusImageUrl);

	// THE WORLD: the measured container, grown to hold every building and the
	// photo's own rectangle. A 3:1 panorama or a 2:3 plan now has somewhere to
	// live, which is what "the whole image is visible, never cropped" needs.
	const world = useMemo(() => {
		const base = { width: containerWidth, height: containerHeight };
		const placement = viewerPlacement(campusMapPlacement, campusImage, base);
		return backgroundWorld(placement, buildings, base);
	}, [containerWidth, containerHeight, campusMapPlacement, campusImage, buildings]);

	// A school with no stored placement gets the same "fit whole image, locked"
	// default the editor starts from, so an unconfigured school and a configured
	// one are framed by the same arithmetic.
	const placement = useMemo(
		() => viewerPlacement(campusMapPlacement, campusImage, world),
		[campusMapPlacement, campusImage, world],
	);

	const box = useMemo(
		() => ({ freeWidth: containerWidth, freeHeight: containerHeight }),
		[containerWidth, containerHeight],
	);
	// THE ONE FRAMING. `fitViewTransform` is the editor's own function, so the
	// overview, the Dashboard card and the editor cannot disagree about what "fit"
	// or "clamped pan" means.
	const view = useMemo(
		() => fitViewTransform({ content: world, box, zoom, pan: position }),
		[world, box, zoom, position],
	);

	const stageWidth = Math.max(320, containerWidth);
	const stageHeight = containerHeight;
	const fallbackSelectedId = selectedBuildingId ?? buildings[0]?.id ?? null;
	const primaryCanvasColor = getPrimaryCanvasColor(MAP_SELECTED_STROKE);

	// The clamped pan, through the SAME function that produced the transform, so
	// the drag boundary and the painted position are computed identically. The
	// old `clampPosition` re-derived the offsets from `scale` and the stage size
	// and could disagree with what was on screen.
	const clampPosition = useCallback(
		(next: { x: number; y: number }, atZoom: number) => {
			const transform = fitViewTransform({ content: world, box, zoom: atZoom, pan: next });
			return { x: transform.x, y: transform.y };
		},
		[world, box],
	);

	const zoomTo = useCallback(
		(nextZoomLevel: number, anchor?: { x: number; y: number }) => {
			const bounded = nextBackgroundZoom(nextZoomLevel, 0);
			// The focus point defaults to the centre of the box, and the map point
			// under it is preserved across the step so a wheel over a building keeps
			// pointing at that building.
			const focus = anchor ?? { x: stageWidth / 2, y: stageHeight / 2 };
			const before = fitViewTransform({ content: world, box, zoom, pan: position });
			const after = fitViewTransform({ content: world, box, zoom: bounded, pan: { x: 0, y: 0 } });
			const mapPoint = {
				x: (focus.x - before.x) / (before.scale || 1),
				y: (focus.y - before.y) / (before.scale || 1),
			};
			const nextPan = {
				x: focus.x - after.x - mapPoint.x * after.scale,
				y: focus.y - after.y - mapPoint.y * after.scale,
			};
			setZoom(bounded);
			setPosition(clampPosition(nextPan, bounded));
		},
		[world, box, zoom, position, stageWidth, stageHeight, clampPosition],
	);

	const adjustZoom = (delta: number) => zoomTo(zoom + delta);
	const resetView = () => {
		setZoom(1);
		setPosition({ x: 0, y: 0 });
	};

	// The pan is re-clamped whenever the world or the box changes, so a window
	// resize cannot leave the map parked off-screen. This is also what makes
	// "buildings keep their positions relative to the image when the window
	// resizes" true: the buildings' WORLD coordinates never change, only the
	// transform onto them does.
	useEffect(() => {
		setPosition((current) => clampPosition(current, zoom));
	}, [clampPosition, zoom]);

	return (
		<div ref={containerRef} className="relative overflow-hidden rounded-2xl border border-slate-100 bg-stone-50 shadow-inner" style={{ touchAction: interactive ? 'none' : 'pan-y' }}>
			{showToolbar && (
				<TooltipProvider>
					<div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur">
						{/* A9 m1 — the SHARED cluster: the same buttons, the same 0.25-4
						    bounds, the same "75%" readout as the editor's, instead of
						    this file's private 0.8-3 copy. */}
						<CampusMapZoomControls
							zoom={zoom}
							onZoomIn={() => adjustZoom(0.2)}
							onZoomOut={() => adjustZoom(-0.2)}
							onReset={resetView}
							label="campus map"
						/>
					</div>
				</TooltipProvider>
			)}
			<Stage
				width={stageWidth}
				height={stageHeight}
				// A9 m1 — the transform is the STAGE's, not a wrapper Group's, and it
				// is the shared one: scale (the fit × the operator's zoom) plus an
				// origin. The stage's own `width`/`height` and every building's stored
				// `x`/`y` are untouched by it, which is why a building keeps its
				// position relative to the image across a zoom or a window resize.
				x={view.x}
				y={view.y}
				scaleX={view.scale}
				scaleY={view.scale}
				draggable={interactive}
				onDragEnd={(event) => {
					if (!interactive) return;
					setPosition(clampPosition({ x: event.target.x(), y: event.target.y() }, zoom));
				}}
				dragBoundFunc={(nextPosition) => (interactive ? clampPosition(nextPosition, zoom) : nextPosition)}
				onWheel={(event) => {
					if (!interactive) return;
					event.evt.preventDefault();
					const stage = event.target.getStage();
					zoomTo(zoom + (event.evt.deltaY < 0 ? 0.1 : -0.1), stage?.getPointerPosition() ?? undefined);
				}}
				className={interactive ? 'cursor-grab active:cursor-grabbing' : undefined}
				style={{ touchAction: interactive ? 'none' : 'pan-y' }}
			>
				<Layer>
					{/* THE BACKGROUND, through the one shared layer, and buildings and
					    background in the SAME Group — so the photo cannot be painted
					    over a building or vice versa by a change to either tree. */}
					<Group>
						{/* A9 m1: the fixed 920x580 photo pair with its two independent
						    pattern scales is replaced by the shared layer, whose
						    pattern scales are equal BY CONSTRUCTION because the drawn
						    height is read off the file's own ratio. */}
						<CampusMapBackgroundLayer
							image={campusImage}
							placement={placement}
							world={world}
							cornerRadius={8}
						/>

						{buildings.map((building) => {
							const isSelected = fallbackSelectedId === building.id;
							const isNonTeaching = building.isTeachingBuilding === false;
							const roomLabel = isNonTeaching ? 'Not used for scheduling' : `${building.rooms.length} room${building.rooms.length === 1 ? '' : 's'}`;

							return (
								<Group
									key={building.id}
									x={building.x}
									y={building.y}
									width={building.width}
									height={building.height}
									rotation={building.rotation ?? 0}
									onClick={() => onSelectBuilding?.(building.id)}
									onTap={() => onSelectBuilding?.(building.id)}
								>
									<Rect
										width={building.width}
										height={building.height}
										fill={building.color}
										opacity={isSelected ? 0.96 : 0.78}
										cornerRadius={8}
										stroke={isSelected ? primaryCanvasColor : MAP_DEFAULT_STROKE}
										strokeWidth={isSelected ? 3 : 2}
										shadowColor="rgba(0,0,0,0.16)"
										shadowBlur={isSelected ? 12 : 3}
										shadowOffsetY={isSelected ? 4 : 1}
									/>
									{isNonTeaching && (
										<Rect
											width={building.width}
											height={building.height}
											cornerRadius={8}
											fillLinearGradientStartPoint={{ x: 0, y: 0 }}
											fillLinearGradientEndPoint={{ x: 12, y: 12 }}
											fillLinearGradientColorStops={[0, 'rgba(0,0,0,0.15)', 0.5, 'rgba(0,0,0,0.15)', 0.5, 'transparent', 1, 'transparent']}
											opacity={0.6}
											listening={false}
										/>
									)}
									<Text
										x={6}
										y={6}
										text={building.name}
										fontSize={Math.min(compact ? 12 : 14, building.width / 8, building.height / 5)}
										fill="#ffffff"
										fontStyle="bold"
										width={building.width - 12}
										height={building.height - 30}
										wrap="word"
										ellipsis
										rotation={smartLabelRotation(building.rotation ?? 0)}
									/>
									<Text
										x={6}
										y={building.height - 18}
										text={roomLabel}
										fontSize={Math.min(compact ? 9 : 11, building.width / 10)}
										fill="rgba(255,255,255,0.82)"
										width={building.width - 12}
										wrap="none"
										ellipsis
									/>
								</Group>
							);
						})}
					</Group>
				</Layer>
			</Stage>
			{buildings.length === 0 && (
				<div className="absolute inset-0 flex items-center justify-center text-center text-sm font-medium text-muted-foreground">
					Open the map editor to draw the first campus building.
				</div>
			)}
		</div>
	);
}

/** Re-exported so a caller can size a box without importing two modules. */
export { safeWorld };
