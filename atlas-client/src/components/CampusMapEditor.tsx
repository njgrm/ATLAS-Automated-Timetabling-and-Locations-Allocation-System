import Konva from 'konva';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Group, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import { DoorOpen, ImageOff, MousePointer2, Redo2, Save, Square, Undo2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import type { Building } from '@/types';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import {
	CALM_BUILDING_COLORS,
	MAP_DEFAULT_STROKE,
	MAP_SELECTED_STROKE,
	MAP_TRANSFORMER_STROKE,
	getPrimaryCanvasColor,
} from '@/components/campus-map/campusMapPalette';
// A9 c4 — the view cluster, extracted because this file reached the AGENTS.md §8
// 1000-line cap while the fit view was added. Dumb by design: it holds no zoom
// arithmetic and no view state.
import { CampusMapEditorZoomControls } from '@/components/campus-map/CampusMapEditorZoomControls';
// A3 c11 fix 36 — every number the canvas decision needs, as pure functions, in
// one place with the geometry contract that explains them. See the module header
// for the 1366px arithmetic that reproduces the operator's clip.
import {
	MIN_HEIGHT,
	MIN_WIDTH,
	alignmentGuides,
	canvasWorkArea,
	clampBuildingToCanvas,
	campusEditorCanvasSize,
	campusEditorViewTransform,
	drawRectFromPointer,
	nextZoomScale,
	smartLabelRotation,
	transformOrigin,
} from '@/components/campus-map/campusEditorCanvas';

type EditorBuilding = Building & { dirty?: boolean; isNew?: boolean };

type CampusMapEditorProps = {
	schoolId: number;
	buildings: EditorBuilding[];
	campusImageUrl: string | null;
	onBuildingsChange: (buildings: EditorBuilding[]) => void;
	selectedBuildingId: number | null;
	onSelect: (id: number | null) => void;
	onSaved: () => void;
	/** Undo/redo history managed externally */
	historyStack: EditorBuilding[][];
	redoStack: EditorBuilding[][];
	onPushHistory: () => void;
	onUndo: () => void;
	onRedo: () => void;
};

type Tool = 'select' | 'add';

const COLORS = CALM_BUILDING_COLORS;

let tempIdCounter = -1;

export function CampusMapEditor({
	schoolId,
	buildings,
	campusImageUrl,
	onBuildingsChange,
	selectedBuildingId,
	onSelect,
	onSaved,
	historyStack,
	redoStack,
	onPushHistory,
	onUndo,
	onRedo,
}: CampusMapEditorProps) {
	// A9 c4, fix 36 — the operator's two numbers, not one. `zoom` and `pan` are
	// the USER's; the stage's own size is the coordinate space they act on. The
	// default is therefore the FIT view (see `campusEditorViewTransform`), and
	// reset returns to the fit rather than to 100%.
	const [zoom, setZoom] = useState(1);
	const [pan, setPan] = useState({ x: 0, y: 0 });
	const [tool, setTool] = useState<Tool>('select');
	const [saving, setSaving] = useState(false);
	const [campusImage, setCampusImage] = useState<HTMLImageElement | null>(null);
	const [hoveredBuildingId, setHoveredBuildingId] = useState<number | null>(null);
	// A3 c11 fix 36 — the canvas size is MEASURED, from the page's scroll region
	// (see `campusEditorCanvas.ts` for the 1366px arithmetic). Measuring the
	// host's own box instead would feed the stage's size back into itself; the
	// region is bounded by the page root, so its box is independent of the stage.
	const canvasHostRef = useRef<HTMLDivElement>(null);
	const statusBarRef = useRef<HTMLDivElement>(null);
	const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
	const canvas = useMemo(
		() => campusEditorCanvasSize({ containerWidth: containerSize.width, containerHeight: containerSize.height, buildings }),
		[containerSize.width, containerSize.height, buildings],
	);
	const { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } = canvas;

	// A9 c4, fix 36 — the view the stage is PAINTED through: the measured work
	// area is the free area, the stage's own size is the content space, and the
	// result is the fit × the operator's zoom, centred, with the operator's pan
	// clamped. The stage's `width`/`height` and every building's stored `x`/`y`
	// are untouched, so the A3 c11 size and containment contract is unchanged.
	const fitBox = useMemo(
		() => ({ freeWidth: containerSize.width, freeHeight: containerSize.height }),
		[containerSize.width, containerSize.height],
	);
	const canvasSpace = useMemo(() => ({ canvasWidth: CANVAS_WIDTH, canvasHeight: CANVAS_HEIGHT }), [CANVAS_WIDTH, CANVAS_HEIGHT]);
	const view = useMemo(
		() => campusEditorViewTransform({ free: fitBox, canvas: canvasSpace, zoom, pan }),
		[fitBox, canvasSpace, zoom, pan],
	);

	useEffect(() => {
		const host = canvasHostRef.current;
		if (!host) return;
		// The page names its canvas column (`pages/MapEditor.tsx`); a canvas
		// mounted outside one is unmeasured, and takes the named floor.
		const region = host.closest('[data-campus-map-canvas-region]') as HTMLElement | null;
		const measure = () => {
			if (!region) {
				setContainerSize({ width: 0, height: 0 });
				return;
			}
			const rect = region.getBoundingClientRect();
			// Read the region's own padding rather than assuming it, so the
			// arithmetic follows the page's `p-4` instead of a copy of it.
			const style = getComputedStyle(region);
			const px = (value: string): number => {
				const n = Number.parseFloat(value);
				return Number.isFinite(n) && n > 0 ? n : 0;
			};
			setContainerSize(
				canvasWorkArea({
					regionWidth: rect.width,
					regionHeight: rect.height,
					paddingTop: px(style.paddingTop),
					paddingRight: px(style.paddingRight),
					paddingBottom: px(style.paddingBottom),
					paddingLeft: px(style.paddingLeft),
					// `offsetTop`/`offsetHeight` are layout boxes that do not move
					// with the stage, so subtracting them is not a feedback loop.
					contentAbove: host.offsetTop,
					contentBelow: statusBarRef.current?.offsetHeight ?? 0,
				}),
			);
		};
		measure();
		// Observed: the region, whose box the page root bounds. The host is NOT
		// observed — its height follows the stage, so observing it would close a
		// loop that grows the canvas to fit its own growth.
		const observer = new ResizeObserver(measure);
		observer.observe(region ?? host);
		return () => observer.disconnect();
	}, []);

	// Draw-to-create state
	const [isDrawing, setIsDrawing] = useState(false);
	const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
	const [drawRect, setDrawRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

	const transformerRef = useRef<Konva.Transformer>(null);
	const shapeRefs = useRef<Map<number, Konva.Group>>(new Map());
	const stageRef = useRef<Konva.Stage>(null);

	// Track which resize anchor the user is dragging (for anchored-resize logic)
	const activeAnchorRef = useRef<string | null>(null);

	// Dimension tooltip state for transform/drag
	const [dimTooltip, setDimTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

	// Alignment guide state
	const [guides, setGuides] = useState<{ x?: number; y?: number }[]>([]);

	// Load campus background image
	useEffect(() => {
		if (!campusImageUrl) {
			setCampusImage(null);
			return;
		}
		const img = new window.Image();
		img.crossOrigin = 'anonymous';
		img.src = campusImageUrl;
		img.onload = () => setCampusImage(img);
		img.onerror = () => setCampusImage(null);
	}, [campusImageUrl]);

	// Attach transformer to selected building
	useEffect(() => {
		const tr = transformerRef.current;
		if (!tr) return;
		if (selectedBuildingId == null) {
			tr.nodes([]);
			tr.getLayer()?.batchDraw();
			return;
		}
		const node = shapeRefs.current.get(selectedBuildingId);
		if (node) {
			tr.nodes([node]);
			tr.getLayer()?.batchDraw();
		}
	}, [selectedBuildingId, buildings]);

	// Keyboard shortcuts for undo/redo
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			const isCtrlOrCmd = e.ctrlKey || e.metaKey;
			if (!isCtrlOrCmd) return;

			if (e.key === 'z' && !e.shiftKey) {
				e.preventDefault();
				onUndo();
			} else if (e.key === 'y' || (e.key === 'z' && e.shiftKey) || (e.key === 'Z' && e.shiftKey)) {
				e.preventDefault();
				onRedo();
			}
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, [onUndo, onRedo]);

	const handleStageClick = useCallback(
		(e: Konva.KonvaEventObject<MouseEvent>) => {
			// Only used for selection in select mode
			const clickedOnEmpty = e.target === e.target.getStage() || e.target.name() === 'bg';
			if (clickedOnEmpty && tool === 'select') {
				onSelect(null);
			}
		},
		[tool, onSelect],
	);

	const handleStageMouseDown = useCallback(
		(e: Konva.KonvaEventObject<MouseEvent>) => {
			if (tool !== 'add') return;
			const clickedOnEmpty = e.target === e.target.getStage() || e.target.name() === 'bg';
			if (!clickedOnEmpty) return;

			const stage = stageRef.current;
			if (!stage) return;
			const pointer = stage.getRelativePointerPosition();
			if (!pointer) return;

			setIsDrawing(true);
			setDrawStart(pointer);
			setDrawRect({ x: pointer.x, y: pointer.y, width: 0, height: 0 });
		},
		[tool],
	);

	const handleStageMouseMove = useCallback(
		() => {
			if (!isDrawing || !drawStart) return;
			const stage = stageRef.current;
			if (!stage) return;
			const pointer = stage.getRelativePointerPosition();
			if (!pointer) return;
			setDrawRect(drawRectFromPointer(drawStart, pointer));
		},
		[isDrawing, drawStart],
	);

	const handleStageMouseUp = useCallback(
		() => {
			if (!isDrawing || !drawRect) {
				setIsDrawing(false);
				setDrawStart(null);
				setDrawRect(null);
				return;
			}

			setIsDrawing(false);
			setDrawStart(null);
			setDrawRect(null);

		// Only create if rect is large enough
		if (drawRect.width < MIN_WIDTH || drawRect.height < MIN_HEIGHT) return;

		// A3 c11 fix 36, option 3 — a drawn building is CONTAINED by the same clamp.
		const placed = clampBuildingToCanvas(
			{ x: drawRect.x, y: drawRect.y, width: drawRect.width, height: drawRect.height },
			CANVAS_WIDTH,
			CANVAS_HEIGHT,
		);

		const newBuilding: EditorBuilding = {
			id: tempIdCounter--,
			name: `Building ${buildings.length + 1}`,
			shortCode: null,
			x: placed.x,
			y: placed.y,
			width: placed.width,
			height: placed.height,
				rotation: 0,
				color: COLORS[buildings.length % COLORS.length],
				floorCount: 1,
				isTeachingBuilding: true,
				gradeScope: [],
				rooms: [],
				dirty: true,
				isNew: true,
			};
			onPushHistory();
			onBuildingsChange([...buildings, newBuilding]);
			onSelect(newBuilding.id);
			setTool('select');
		},
		[isDrawing, drawRect, buildings, onBuildingsChange, onSelect, CANVAS_WIDTH, CANVAS_HEIGHT],
	);

	const handleDragEnd = useCallback(
		(buildingId: number, e: Konva.KonvaEventObject<DragEvent>) => {
			const node = e.target;
			// Snap to integer coordinates to prevent sub-pixel drift
			let snappedX = Math.round(node.x());
			let snappedY = Math.round(node.y());
			// A3 c11 fix 36, option 3 — a DRAG is contained, by the same single
			// clamp the draw-create and resize/rotate paths use. Drag was the one
			// way the operator could still put a building outside the work area,
			// which made containment rest on auto-grow alone.
			const dragged = buildings.find((b) => b.id === buildingId);
			const contained = clampBuildingToCanvas(
				{ x: snappedX, y: snappedY, width: dragged?.width ?? node.width(), height: dragged?.height ?? node.height() },
				CANVAS_WIDTH,
				CANVAS_HEIGHT,
			);
			snappedX = contained.x;
			snappedY = contained.y;
			node.x(snappedX);
			node.y(snappedY);
			onPushHistory();
			onBuildingsChange(
				buildings.map((b) =>
					b.id === buildingId
						? { ...b, x: snappedX, y: snappedY, dirty: true }
						: b,
				),
			);
			setDimTooltip(null);
			setGuides([]);
		},
		[buildings, onBuildingsChange, onPushHistory, CANVAS_WIDTH, CANVAS_HEIGHT],
	);

	const handleDragMove = useCallback(
		(buildingId: number, e: Konva.KonvaEventObject<DragEvent>) => {
			const node = e.target;
			const dragX = node.x();
			const dragY = node.y();
			const building = buildings.find((b) => b.id === buildingId);
			if (!building) return;

			setGuides(alignmentGuides(
				{ x: dragX, y: dragY, width: building.width, height: building.height },
				buildings.filter((b) => b.id !== buildingId),
			));
			setDimTooltip({
				x: dragX + building.width / 2,
				y: dragY - 20,
				text: `${Math.round(dragX)}, ${Math.round(dragY)}`,
			});
		},
		[buildings],
	);

	const handleTransformEnd = useCallback(
		(buildingId: number) => {
			const node = shapeRefs.current.get(buildingId);
			if (!node) return;
			const scaleX = node.scaleX();
			const scaleY = node.scaleY();
			const rotation = node.rotation();

			const building = buildings.find((b) => b.id === buildingId);
			if (!building) return;

			const newWidth = Math.max(MIN_WIDTH, Math.round(building.width * Math.abs(scaleX)));
			const newHeight = Math.max(MIN_HEIGHT, Math.round(building.height * Math.abs(scaleY)));
			const newRotation = Math.round(rotation * 10) / 10;

			// Anchored resize: the origin that keeps the OPPOSITE handle fixed.
			const origin = transformOrigin({
				building,
				activeAnchor: activeAnchorRef.current,
				nodeX: node.x(),
				nodeY: node.y(),
				newWidth,
				newHeight,
				newRotation,
			});
			let snappedX = origin.x;
			let snappedY = origin.y;

			// Reset scale to 1 and apply computed dimensions to prevent drift
			// A3 c11 fix 36, option 3 — a resize/rotate keeps the opposite anchor
			// fixed AND stays inside the canvas, by the same single clamp.
			const contained = clampBuildingToCanvas({ x: snappedX, y: snappedY, width: newWidth, height: newHeight }, CANVAS_WIDTH, CANVAS_HEIGHT);
			snappedX = contained.x;
			snappedY = contained.y;

			node.scaleX(1);
			node.scaleY(1);
			node.width(newWidth);
			node.height(newHeight);
			node.x(snappedX);
			node.y(snappedY);

			activeAnchorRef.current = null;

			onPushHistory();
			onBuildingsChange(
				buildings.map((b) =>
					b.id === buildingId
						? {
								...b,
								x: snappedX,
								y: snappedY,
								width: newWidth,
								height: newHeight,
								rotation: newRotation,
								dirty: true,
							}
						: b,
				),
			);
			setDimTooltip(null);
		},
		[buildings, onBuildingsChange, onPushHistory, CANVAS_WIDTH, CANVAS_HEIGHT],
	);

	const handleTransform = useCallback(
		(buildingId: number) => {
			const node = shapeRefs.current.get(buildingId);
			if (!node) return;
			const building = buildings.find((b) => b.id === buildingId);
			if (!building) return;

			// Capture which anchor is being dragged so handleTransformEnd can
			// keep the opposite anchor fixed.
			const tr = transformerRef.current;
			if (tr) {
				activeAnchorRef.current = tr.getActiveAnchor();
			}

			const w = Math.round(Math.max(MIN_WIDTH, building.width * node.scaleX()));
			const h = Math.round(Math.max(MIN_HEIGHT, building.height * node.scaleY()));
			const rot = Math.round(node.rotation());
			const text = rot !== 0 && rot !== (building.rotation ?? 0)
				? `${w} × ${h} · ${rot}°`
				: `${w} × ${h}`;
			setDimTooltip({
				x: node.x() + w / 2,
				y: node.y() - 20,
				text,
			});
		},
		[buildings],
	);

	const handleSave = useCallback(async () => {
		setSaving(true);
		try {
			let nextBuildings = buildings.map((building) => ({ ...building, rooms: [...building.rooms] }));
			const dirtyBuildings = nextBuildings.filter((building) => building.dirty);

			for (const building of dirtyBuildings) {
				const payload = {
					name: building.name,
					shortCode: building.shortCode ?? undefined,
					x: Math.round(building.x),
					y: Math.round(building.y),
					width: Math.round(building.width),
					height: Math.round(building.height),
					color: building.color,
					rotation: building.rotation ?? 0,
					floorCount: building.floorCount ?? 1,
					isTeachingBuilding: building.isTeachingBuilding ?? true,
					gradeScope: building.gradeScope ?? [],
				};

				if (building.isNew) {
					const { data } = await atlasApi.post(`/map/schools/${schoolId}/buildings`, payload);
					nextBuildings = nextBuildings.map((existing) =>
						existing.id === building.id
							? { ...data.building, dirty: false, isNew: false }
							: existing,
					);
				} else {
					const { data } = await atlasApi.patch(`/map/buildings/${building.id}`, payload);
					nextBuildings = nextBuildings.map((existing) =>
						existing.id === building.id
							? { ...data.building, dirty: false, isNew: false }
							: existing,
					);
				}
			}

			onBuildingsChange(nextBuildings);
			toast.success('Map changes saved.');
			onSaved();
		} catch (err: any) {
			const backendMsg = err?.response?.data?.message;
			toast.error(backendMsg || 'Failed to save map changes.');
			console.error('Save failed:', err);
		} finally {
			setSaving(false);
		}
	}, [buildings, schoolId, onBuildingsChange, onSaved]);

	const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const formData = new FormData();
		formData.append('image', file);
		try {
			await atlasApi.post(`/map/schools/${schoolId}/campus-image`, formData, {
				headers: { 'Content-Type': 'multipart/form-data' },
			});
			toast.success('Campus image updated.');
			onSaved();
		} catch (err) {
			toast.error('Failed to update campus image.');
			console.error('Image upload failed:', err);
		}
	}, [schoolId, onSaved]);

	const handleImageRemove = useCallback(async () => {
		try {
			await atlasApi.delete(`/map/schools/${schoolId}/campus-image`);
			toast.success('Campus photo removed.');
			onSaved();
		} catch (err) {
			toast.error('Failed to remove campus photo.');
			console.error('Image remove failed:', err);
		}
	}, [schoolId, onSaved]);

	const hasDirty = buildings.some((b) => b.dirty);
	const selectedBuilding = buildings.find((building) => building.id === selectedBuildingId) ?? null;
	const selectedRoomCount = selectedBuilding?.rooms.length ?? 0;
	const selectedTeachingRoomCount = selectedBuilding?.rooms.filter((room) => room.isTeachingSpace).length ?? 0;
	const primaryCanvasColor = getPrimaryCanvasColor(MAP_SELECTED_STROKE);
	const saveState: 'saved' | 'dirty' | 'saving' = saving ? 'saving' : hasDirty ? 'dirty' : 'saved';
	const saveStateClass = saveState === 'saved'
		? 'border-emerald-200 bg-emerald-50 text-emerald-700'
		: saveState === 'saving'
			? 'border-sky-200 bg-sky-50 text-sky-700'
			: 'border-amber-200 bg-amber-50 text-amber-800';
	const saveStateLabel = saveState === 'saved' ? 'All changes saved' : saveState === 'saving' ? 'Saving...' : 'Unsaved changes';

	return (
		<div className="flex flex-col gap-2">
			{/* Task-grouped toolbar */}
			<div className="flex flex-wrap items-center gap-2">
				<TooltipProvider>
					{/* Group: Select / Draw */}
					<div className="inline-flex rounded-md border border-border bg-card p-0.5" role="tablist" aria-label="Map mode">
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant={tool === 'select' ? 'default' : 'ghost'}
									size="sm"
									onClick={() => setTool('select')}
									aria-pressed={tool === 'select'}
									aria-label="Select buildings"
									className="h-8"
								>
									<MousePointer2 className="size-3.5" /> Select
								</Button>
							</TooltipTrigger>
							<TooltipContent>Select and edit buildings</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant={tool === 'add' ? 'default' : 'ghost'}
									size="sm"
									onClick={() => setTool('add')}
									aria-pressed={tool === 'add'}
									aria-label="Draw building"
									className="h-8"
								>
									<Square className="size-3.5" /> Draw building
								</Button>
							</TooltipTrigger>
							<TooltipContent>Draw a new building rectangle</TooltipContent>
						</Tooltip>
					</div>

					{/* Group: view. `zoom` is the operator's multiplier ON TOP of the
					    fit, so zoom in starts from "the whole campus" rather than
					    from a canvas that was already too big for its box. The
					    cluster itself is extracted; see its file for why reset is
					    the fit and not 100%. */}
					<CampusMapEditorZoomControls
						onZoomIn={() => setZoom((z) => nextZoomScale(z, 0.15))}
						onZoomOut={() => setZoom((z) => nextZoomScale(z, -0.15))}
						onReset={() => {
							// A9 c4, fix 36 — reset returns to the FIT view, not to
							// 100%: at the 1366px default 100% is the view that put a
							// building under the panel.
							setZoom(1);
							setPan({ x: 0, y: 0 });
						}}
					/>

					{/* Group: Rooms */}
					<div className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2 text-[0.7rem] font-semibold text-slate-600" aria-label="Rooms summary">
						<DoorOpen className="size-3.5 text-primary" />
						<span>Rooms</span>
						<span className="text-muted-foreground">
							{selectedBuilding ? `${selectedTeachingRoomCount}/${selectedRoomCount} teaching` : 'Select building'}
						</span>
					</div>

					{/* Group: campus photo */}
					<div className="inline-flex items-center gap-1">
						<label className="cursor-pointer">
							<Button variant="outline" size="sm" asChild aria-label="Upload campus photo">
								<span>
									<Upload className="size-3.5" /> Campus photo
								</span>
							</Button>
							<input
								type="file"
								accept="image/png,image/jpeg,image/webp"
								className="hidden"
								onChange={handleImageUpload}
							/>
						</label>
						{campusImageUrl && (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon-xs"
										className="text-muted-foreground hover:text-destructive"
										onClick={handleImageRemove}
										aria-label="Remove campus photo"
									>
										<ImageOff className="size-3.5" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Remove campus photo</TooltipContent>
							</Tooltip>
						)}
					</div>

					{/* Group: History */}
					<div className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-1">
						<span className="px-1 text-[0.65rem] font-semibold text-muted-foreground">History</span>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="icon-xs"
									disabled={historyStack.length === 0}
									onClick={onUndo}
									aria-label="Undo"
								>
									<Undo2 className="size-3.5" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Undo</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="icon-xs"
									disabled={redoStack.length === 0}
									onClick={onRedo}
									aria-label="Redo"
								>
									<Redo2 className="size-3.5" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Redo</TooltipContent>
						</Tooltip>
					</div>

					<div className="flex-1" />

					<div className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-card px-2" aria-label="Save state">
						<span className="text-[0.65rem] font-semibold text-muted-foreground">Save</span>
						<span
							role="status"
							aria-live="polite"
							className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.7rem] font-medium ${saveStateClass}`}
						>
							<span className={`size-1.5 rounded-full ${
								saveState === 'saved' ? 'bg-emerald-500' : saveState === 'saving' ? 'bg-sky-500 animate-pulse' : 'bg-amber-500'
							}`} />
							{saveStateLabel}
						</span>
					</div>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								size="sm"
								disabled={!hasDirty || saving}
								onClick={handleSave}
								aria-label="Save campus map changes"
							>
								<Save className="size-3.5" />
								{saving ? 'Saving...' : 'Save changes'}
							</Button>
						</TooltipTrigger>
						<TooltipContent>Save building changes</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>

			{/* Canvas. The Stage is sized from the MEASURED work area by
			    `campusEditorCanvasSize`, so the ground spans the workspace to the
			    left of the inspector and grows for content beyond it. Growth is
			    reachable, never clipped: `w-max` makes THIS box as large as the
			    stage, so an over-sized stage enlarges the region (which scrolls)
			    instead of being cut here.
			    A9 c4, fix 36 — and reachability alone was not the ask: the operator
			    must SEE the whole campus without scrolling. The stage is therefore
			    PAINTED through the fitted view transform above, which is a change of
			    scale and origin only; the stage's `width`/`height` and the painted
			    ground's size in stage coordinates are exactly as they were. */}
			<div
				ref={canvasHostRef}
				className={`w-max overflow-hidden rounded-lg border border-border bg-muted/30 ${tool === 'add' ? 'cursor-crosshair' : ''}`}
			>
				<Stage
					ref={stageRef}
					width={CANVAS_WIDTH}
					height={CANVAS_HEIGHT}
					draggable={tool === 'select'}
					x={view.x}
					y={view.y}
					scaleX={view.scale}
					scaleY={view.scale}
					onDragEnd={(e) => {
						if (e.target === stageRef.current) {
							// Konva hands back the stage's own translated position,
							// which is the centring offset PLUS the operator's pan.
							setPan({ x: e.target.x() - view.x, y: e.target.y() - view.y });
						}
					}}
					dragBoundFunc={(next) => {
						// Bounded DURING the drag, not snapped back after it, so the
						// clamped pan is felt rather than corrected.
						const bounded = campusEditorViewTransform({
							free: fitBox,
							canvas: canvasSpace,
							zoom,
							pan: { x: next.x - view.x, y: next.y - view.y },
						});
						return { x: bounded.x, y: bounded.y };
					}}
					onClick={handleStageClick}
					onMouseDown={handleStageMouseDown}
					onMouseMove={handleStageMouseMove}
					onMouseUp={handleStageMouseUp}
				onWheel={(event) => {
					event.evt.preventDefault();
					setZoom((current) => nextZoomScale(current, event.evt.deltaY < 0 ? 0.1 : -0.1));
				}}
				>
					<Layer>
						{/* Campus photo layer */}
						{campusImage ? (
							<>
								<Rect name="bg" x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="#f5f5f4" />
								<Rect
									name="bg"
									x={0}
									y={0}
									width={CANVAS_WIDTH}
									height={CANVAS_HEIGHT}
									fillPatternImage={campusImage}
									fillPatternScaleX={CANVAS_WIDTH / campusImage.width}
									fillPatternScaleY={CANVAS_HEIGHT / campusImage.height}
								/>
							</>
						) : (
							<Rect name="bg" x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="hsl(40 30% 95%)" cornerRadius={8} />
						)}

						{/* Buildings */}
						{buildings.map((b) => {
							const selected = selectedBuildingId === b.id;
							const isNonTeaching = b.isTeachingBuilding === false;
							return (
								<Group
									key={b.id}
									ref={(node) => {
										if (node) shapeRefs.current.set(b.id, node);
										else shapeRefs.current.delete(b.id);
									}}
									x={b.x}
									y={b.y}
									width={b.width}
									height={b.height}
									rotation={b.rotation ?? 0}
									draggable={tool === 'select'}
									onClick={(e) => {
										e.cancelBubble = true;
										onSelect(b.id);
									}}
									onMouseEnter={() => setHoveredBuildingId(b.id)}
									onMouseLeave={() => setHoveredBuildingId((prev) => (prev === b.id ? null : prev))}
									onDragMove={(e) => handleDragMove(b.id, e)}
									onDragEnd={(e) => handleDragEnd(b.id, e)}
									onTransform={() => handleTransform(b.id)}
									onTransformEnd={() => handleTransformEnd(b.id)}
								>
									<Rect
										width={b.width}
										height={b.height}
										fill={b.color}
										opacity={selected ? 0.95 : 0.78}
										cornerRadius={8}
										stroke={selected ? primaryCanvasColor : MAP_DEFAULT_STROKE}
										strokeWidth={selected ? 3 : 2}
										shadowColor={selected ? primaryCanvasColor : 'rgba(0,0,0,0.12)'}
										shadowBlur={selected ? 12 : 3}
										shadowOffsetY={selected ? 4 : 1}
									/>
									{/* Diagonal hatch overlay for non-teaching buildings */}
									{isNonTeaching && (
										<Rect
											width={b.width}
											height={b.height}
											cornerRadius={8}
											fillLinearGradientStartPoint={{ x: 0, y: 0 }}
											fillLinearGradientEndPoint={{ x: 12, y: 12 }}
											fillLinearGradientColorStops={[0, 'rgba(0,0,0,0.15)', 0.5, 'rgba(0,0,0,0.15)', 0.5, 'transparent', 1, 'transparent']}
											opacity={0.6}
											listening={false}
										/>
									)}
									{/* Smart-threshold rotation: upright when nearly axis-aligned, else ride with building */}
									<Text
										x={6}
										y={6}
										text={b.name}
										fontSize={Math.min(14, b.width / 8, b.height / 5)}
										fill="#ffffff"
										fontStyle="bold"
										width={b.width - 12}
										height={b.height - 30}
										wrap="word"
										ellipsis
										rotation={smartLabelRotation(b.rotation ?? 0)}
										offsetX={0}
										offsetY={0}
									/>
									<Text
										x={6}
										y={b.height - 18}
										text={isNonTeaching ? 'Non-teaching' : `${b.rooms.length} room${b.rooms.length !== 1 ? 's' : ''}`}
										fontSize={Math.min(11, b.width / 10)}
										fill="rgba(255,255,255,0.8)"
										width={b.width - 12}
										wrap="none"
										ellipsis
									/>
									{b.dirty && (
										<Rect
											x={b.width - 12}
											y={4}
											width={8}
											height={8}
											fill="#facc15"
											cornerRadius={4}
										/>
									)}
								</Group>
							);
						})}

						{/* Draw preview rectangle */}
						{isDrawing && drawRect && drawRect.width > 0 && drawRect.height > 0 && (
							<>
								<Rect
									x={drawRect.x}
									y={drawRect.y}
									width={drawRect.width}
									height={drawRect.height}
									fill={COLORS[buildings.length % COLORS.length]}
									opacity={0.4}
									stroke={COLORS[buildings.length % COLORS.length]}
									strokeWidth={2}
									dash={[6, 3]}
									cornerRadius={8}
								/>
								<Text
									x={drawRect.x + drawRect.width / 2 - 30}
									y={drawRect.y + drawRect.height / 2 - 8}
									text={`${Math.round(drawRect.width)} × ${Math.round(drawRect.height)}`}
									fontSize={12}
									fill="#ffffff"
									fontStyle="bold"
									align="center"
									width={60}
								/>
							</>
						)}

						{/* Transformer */}
						<Transformer
							ref={transformerRef}
							rotateEnabled={true}
							rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
							rotationSnapTolerance={10}
							enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
							boundBoxFunc={(oldBox, newBox) => {
								// Enforce minimum dimensions
								if (Math.abs(newBox.width) < MIN_WIDTH || Math.abs(newBox.height) < MIN_HEIGHT) {
									return oldBox;
								}
								return newBox;
							}}
							borderStroke={primaryCanvasColor || MAP_TRANSFORMER_STROKE}
							borderStrokeWidth={2}
							anchorFill="#ffffff"
							anchorStroke={primaryCanvasColor || MAP_TRANSFORMER_STROKE}
							anchorSize={10}
							anchorCornerRadius={3}
							anchorStrokeWidth={2}
							padding={4}
						/>

						{/* Alignment guides */}
						{guides.map((g, i) =>
							g.x !== undefined ? (
								<Line key={`gv-${i}`} points={[g.x, 0, g.x, CANVAS_HEIGHT]} stroke={primaryCanvasColor || MAP_TRANSFORMER_STROKE} strokeWidth={1} dash={[4, 4]} opacity={0.6} />
							) : g.y !== undefined ? (
								<Line key={`gh-${i}`} points={[0, g.y, CANVAS_WIDTH, g.y]} stroke={primaryCanvasColor || MAP_TRANSFORMER_STROKE} strokeWidth={1} dash={[4, 4]} opacity={0.6} />
							) : null,
						)}

						{/* Dimension / position tooltip */}
						{dimTooltip && (
							<>
								<Rect
									x={dimTooltip.x - 40}
									y={dimTooltip.y - 5}
									width={80}
									height={20}
									fill={primaryCanvasColor || MAP_TRANSFORMER_STROKE}
									cornerRadius={4}
								/>
								<Text
									x={dimTooltip.x - 40}
									y={dimTooltip.y - 2}
									text={dimTooltip.text}
									fontSize={11}
									fill="#ffffff"
									fontStyle="bold"
									width={80}
									align="center"
								/>
							</>
						)}
					</Layer>
				</Stage>
			</div>

			{/* Status bar. Its own height is subtracted from the work area, so the
			    default layout fits the canvas exactly instead of growing a
			    scrollbar out of the bar itself. */}
			<div ref={statusBarRef} className="flex items-center justify-between text-[0.75rem] text-muted-foreground ">
				<span>
					{tool === 'add' && isDrawing
						? 'Release to place — minimum size 60×40'
						: tool === 'add'
							? 'Click and drag on the canvas to draw a new building'
							: tool === 'select' && selectedBuildingId != null
								? 'Drag to move • Handles to resize • Corner handle to rotate'
								: tool === 'select' && hoveredBuildingId != null
									? 'Click to select • Double-click to rename'
									: 'Click a building to select it'}
				</span>
				<span className="tabular-nums">{Math.round(view.scale * 100)}% zoom</span>
			</div>
		</div>
	);
}
