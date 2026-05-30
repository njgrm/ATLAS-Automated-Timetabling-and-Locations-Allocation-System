import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Group, Layer, Rect, Stage, Text } from 'react-konva';
import { Move, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

import type { Building } from '@/types';
import { MAP_DEFAULT_STROKE, MAP_SELECTED_STROKE } from '@/components/campus-map/campusMapPalette';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

const CANVAS_WIDTH = 920;
const CANVAS_HEIGHT = 580;
const MIN_ZOOM = 0.8;
const MAX_ZOOM = 3;

export type CampusMapCanvasPreviewProps = {
	buildings: Building[];
	campusImageUrl?: string | null;
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
	selectedBuildingId,
	onSelectBuilding,
	height = 420,
	compact = false,
	interactive = false,
	showToolbar = false,
}: CampusMapCanvasPreviewProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [containerWidth, setContainerWidth] = useState(CANVAS_WIDTH);
	const [campusImage, setCampusImage] = useState<HTMLImageElement | null>(null);
	const [zoom, setZoom] = useState(1);
	const [position, setPosition] = useState({ x: 0, y: 0 });

	useEffect(() => {
		const element = containerRef.current;
		if (!element) return;

		const resizeObserver = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width;
			if (width) setContainerWidth(Math.floor(width));
		});
		resizeObserver.observe(element);
		return () => resizeObserver.disconnect();
	}, []);

	useEffect(() => {
		if (!campusImageUrl) {
			setCampusImage(null);
			return;
		}

		const image = new window.Image();
		image.crossOrigin = 'anonymous';
		image.src = campusImageUrl;
		image.onload = () => setCampusImage(image);
		image.onerror = () => setCampusImage(null);
	}, [campusImageUrl]);

	const scale = useMemo(() => Math.min(containerWidth / CANVAS_WIDTH, height / CANVAS_HEIGHT), [containerWidth, height]);
	const effectiveScale = interactive ? scale * zoom : scale;
	const stageWidth = Math.max(320, containerWidth);
	const stageHeight = height;
	const offsetX = Math.max(0, (stageWidth - CANVAS_WIDTH * effectiveScale) / 2);
	const offsetY = Math.max(0, (stageHeight - CANVAS_HEIGHT * effectiveScale) / 2);
	const fallbackSelectedId = selectedBuildingId ?? buildings[0]?.id ?? null;

	const getOffsets = useCallback((zoomLevel: number) => {
		const scaled = scale * zoomLevel;
		return {
			x: Math.max(0, (stageWidth - CANVAS_WIDTH * scaled) / 2),
			y: Math.max(0, (stageHeight - CANVAS_HEIGHT * scaled) / 2),
		};
	}, [scale, stageHeight, stageWidth]);

	const clampPosition = useCallback((nextPosition: { x: number; y: number }, zoomLevel: number) => {
		const scaled = scale * zoomLevel;
		const offsets = getOffsets(zoomLevel);
		const scaledWidth = CANVAS_WIDTH * scaled;
		const scaledHeight = CANVAS_HEIGHT * scaled;

		const x = scaledWidth <= stageWidth
			? 0
			: Math.min(-offsets.x, Math.max(stageWidth - offsets.x - scaledWidth, nextPosition.x));
		const y = scaledHeight <= stageHeight
			? 0
			: Math.min(-offsets.y, Math.max(stageHeight - offsets.y - scaledHeight, nextPosition.y));

		return { x, y };
	}, [getOffsets, scale, stageHeight, stageWidth]);

	const zoomTo = useCallback((nextZoomLevel: number, anchor?: { x: number; y: number }) => {
		const boundedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(nextZoomLevel * 10) / 10));
		const focusPoint = anchor ?? { x: stageWidth / 2, y: stageHeight / 2 };
		const currentScale = scale * zoom;
		const nextScale = scale * boundedZoom;
		const currentOffsets = getOffsets(zoom);
		const nextOffsets = getOffsets(boundedZoom);
		const mapPoint = {
			x: (focusPoint.x - position.x - currentOffsets.x) / currentScale,
			y: (focusPoint.y - position.y - currentOffsets.y) / currentScale,
		};
		const nextPosition = {
			x: focusPoint.x - nextOffsets.x - mapPoint.x * nextScale,
			y: focusPoint.y - nextOffsets.y - mapPoint.y * nextScale,
		};

		setZoom(boundedZoom);
		setPosition(clampPosition(nextPosition, boundedZoom));
	}, [clampPosition, getOffsets, position.x, position.y, scale, stageHeight, stageWidth, zoom]);

	const adjustZoom = (delta: number) => {
		zoomTo(zoom + delta);
	};

	const resetView = () => {
		setZoom(1);
		setPosition({ x: 0, y: 0 });
	};

	useEffect(() => {
		setPosition((current) => clampPosition(current, zoom));
	}, [clampPosition, zoom]);

	return (
		<div ref={containerRef} className="relative overflow-hidden rounded-2xl border border-slate-100 bg-stone-50 shadow-inner" style={{ touchAction: interactive ? 'none' : 'pan-y' }}>
			{showToolbar && (
				<TooltipProvider>
					<div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur">
						<Tooltip>
							<TooltipTrigger asChild>
								<Button type="button" variant="ghost" size="icon" className="size-8 rounded-lg" aria-label="Zoom in campus map" onClick={() => adjustZoom(0.2)}>
									<ZoomIn className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Zoom in</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button type="button" variant="ghost" size="icon" className="size-8 rounded-lg" aria-label="Zoom out campus map" onClick={() => adjustZoom(-0.2)}>
									<ZoomOut className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Zoom out</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button type="button" variant="ghost" size="icon" className="size-8 rounded-lg" aria-label="Reset campus map view" onClick={resetView}>
									<RotateCcw className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Reset view</TooltipContent>
						</Tooltip>
						<div className="flex h-8 items-center gap-1 border-l border-slate-200 pl-2 pr-1 text-[11px] font-semibold text-slate-500">
							<Move className="size-3.5" />
							{Math.round(zoom * 100)}%
						</div>
					</div>
				</TooltipProvider>
			)}
			<Stage
				width={stageWidth}
				height={stageHeight}
				x={interactive ? position.x : 0}
				y={interactive ? position.y : 0}
				draggable={interactive}
				onDragEnd={(event) => {
					if (!interactive) return;
					setPosition(clampPosition({ x: event.target.x(), y: event.target.y() }, zoom));
				}}
				dragBoundFunc={(nextPosition) => interactive ? clampPosition(nextPosition, zoom) : nextPosition}
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
					<Group x={offsetX} y={offsetY} scaleX={effectiveScale} scaleY={effectiveScale}>
						{campusImage ? (
							<>
								<Rect x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="#f5f5f4" cornerRadius={8} />
								<Rect
									x={0}
									y={0}
									width={CANVAS_WIDTH}
									height={CANVAS_HEIGHT}
									fillPatternImage={campusImage}
									fillPatternScaleX={CANVAS_WIDTH / campusImage.width}
									fillPatternScaleY={CANVAS_HEIGHT / campusImage.height}
									cornerRadius={8}
								/>
							</>
						) : (
							<Rect x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="hsl(40 30% 95%)" cornerRadius={8} />
						)}

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
										stroke={isSelected ? MAP_SELECTED_STROKE : MAP_DEFAULT_STROKE}
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
				<div className="absolute inset-0 flex items-center justify-center text-center text-sm font-medium text-slate-500">
					Open the map editor to draw the first campus building.
				</div>
			)}
		</div>
	);
}