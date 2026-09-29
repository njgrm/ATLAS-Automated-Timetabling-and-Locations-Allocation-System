import Konva from 'konva';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Group, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import { Save, Upload } from 'lucide-react';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import type { Building } from '@/types';
import {
	CALM_BUILDING_COLORS,
	MAP_DEFAULT_STROKE,
	MAP_SELECTED_STROKE,
	MAP_TRANSFORMER_STROKE,
	getPrimaryCanvasColor,
} from '@/components/campus-map/campusMapPalette';
// A9 m1 — the toolbar row, extracted so this file stays under the AGENTS.md §8
// 1000-line cap. Its layout note is in that file's header.
import { CampusMapEditorToolbar } from '@/components/campus-map/CampusMapEditorToolbar';
// A9 m1 — the Background step and the ONE background layer, both extracted. This
// file held the two fixed 920x580 background rects, whose independent X/Y pattern
// scales were the stretch.
import { CampusMapBackgroundLayer, useCampusImage, viewerPlacement } from '@/components/campus-map/CampusMapBackgroundLayer';
import { CampusMapBackgroundStep } from '@/components/campus-map/CampusMapBackgroundStep';
// A9 m1 — the Background step's state and its seven edits.
import { useCampusMapBackground } from '@/components/campus-map/useCampusMapBackground';
// A9 m1 — the framing contract, as pure functions. Nothing in this file decides
// what "fit" means; it asks `backgroundWorld` for a world and `fitViewTransform`
// for a transform.
import {
	backgroundWorld,
	type CampusMapPlacement,
	clampPlacement,
	defaultPlacement,
	fillPlacement,
	fitViewTransform,
	movePlacement,
	nextBackgroundZoom,
	scalePlacement,
	zoomLabel,
} from '@/components/campus-map/campusMapBackground';
import { saveCampusBackground } from '@/lib/campus-background-api';
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
	drawRectFromPointer,
	smartLabelRotation,
	transformOrigin,
} from '@/components/campus-map/campusEditorCanvas';

type EditorBuilding = Building & { dirty?: boolean; isNew?: boolean };

type CampusMapEditorProps = {
	schoolId: number;
	buildings: EditorBuilding[];
	campusImageUrl: string | null;
	/** A9 m1 — the stored background placement, or null for a school whose photo
	 *  predates the Background step. `null` normalises to "fit whole image,
	 *  locked", which is the pre-existing framing. */
	campusMapPlacement?: unknown;
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
	/** A9 m1 — the plain-words receipt line, rendered under the toolbar where the
	 *  save happened. The page that shows it is the page the action was taken on. */
	backgroundReceipt?: string | null;
};

type Tool = 'select' | 'add';

const COLORS = CALM_BUILDING_COLORS;

let tempIdCounter = -1;

export function CampusMapEditor({
	schoolId,
	buildings,
	campusImageUrl,
	campusMapPlacement,
	onBuildingsChange,
	selectedBuildingId,
	onSelect,
	onSaved,
	historyStack,
	redoStack,
	onPushHistory,
	onUndo,
	onRedo,
	backgroundReceipt,
}: CampusMapEditorProps) {
	// A9 c4, fix 36 — the operator's two numbers, not one. `zoom` and `pan` are
	// the USER's; the stage's own size is the coordinate space they act on. The
	// default is therefore the FIT view (see `fitViewTransform`), and reset
	// returns to the fit rather than to 100%.
	const [zoom, setZoom] = useState(1);
	const [pan, setPan] = useState({ x: 0, y: 0 });
	const [tool, setTool] = useState<Tool>('select');
	const [saving, setSaving] = useState(false);
	// A9 m1 — the background. Its state and its seven edits live in
	// `useCampusMapBackground` below; what is left here is the drawing. While the
	// photo is LOCKED, or while Move is off, the photo node is not draggable AT
	// ALL, so a drag can only ever reach a building — "dragging moves buildings
	// only and never the photo" is a property of the tree, not of a handler that
	// has to remember to undo a move.
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

	// THE PHOTO, decoded once, through the shared loader every viewer uses.
	const campusImage = useCampusImage(campusImageUrl);

	// The world as the editor's own measurements make it: the work area, grown for
	// the buildings. Nothing about the photo yet.
	const baseWorld = useMemo(() => ({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }), [CANVAS_WIDTH, CANVAS_HEIGHT]);

	// The placement AS STORED, repaired against the photo that actually loaded. A
	// replacement upload has different pixels, so `normalisePlacement` refits rather
	// than stretching the old framing onto a new file, and a school with no stored
	// placement at all gets the fit-whole, centred, LOCKED default. That is the
	// "existing schools are unchanged" guarantee, and it is arithmetic rather than
	// a migration.
	const storedPlacement = useMemo(
		() => viewerPlacement(campusMapPlacement, campusImage, baseWorld),
		[campusMapPlacement, campusImage, baseWorld],
	);

	// A9 m1 — the Background step's state and its seven edits live in a hook,
	// extracted for the AGENTS.md §8 line cap and because the edits are one
	// cohesive unit. It is fed the STORED placement and the BASE world; the world
	// below then grows to hold whatever the photo has become.
	const background = useCampusMapBackground({
		schoolId,
		placement: storedPlacement,
		world: baseWorld,
		image: campusImage,
		onSaved,
	});

	// THE DRAWN PLACEMENT, and THE WORLD THAT GROWS TO HOLD IT. This is the whole
	// fix for "the map is cut off": the world is no longer a fixed 920x580 box, it
	// is the union of the measured work area, every building, and the photo's own
	// rectangle — so a 3:1 panorama or a 2:3 plan has somewhere to live and the
	// view transform fits whatever it finds.
	const placement = campusImage ? clampPlacement(background.edited ?? storedPlacement, baseWorld) : null;
	const world = useMemo(
		() => (placement ? backgroundWorld(placement, buildings, baseWorld) : baseWorld),
		[placement, buildings, baseWorld],
	);

	// A9 c4, fix 36 — the view the stage is PAINTED through: the measured work
	// area is the free area, the world's own size is the content space, and the
	// result is the fit × the operator's zoom, centred, with the operator's pan
	// clamped. A9 m1 moved the arithmetic into `fitViewTransform`, so the editor
	// and every read-only viewer cannot disagree about the framing.
	const fitBox = useMemo(
		() => ({ freeWidth: containerSize.width, freeHeight: containerSize.height }),
		[containerSize.width, containerSize.height],
	);
	const view = useMemo(
		() => fitViewTransform({ content: world, box: fitBox, zoom, pan }),
		[world, fitBox, zoom, pan],
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

	// A9 m1 — the campus background image is loaded by the shared `useCampusImage`
	// hook above, so this file holds no image-loading state of its own and the
	// editor cannot drift from a viewer on when a photo counts as ready.

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
		// A9 m1: the clamp is now against the GROWN world, not the measured work
		// area, so a building can be drawn anywhere the photo reaches.
		const placed = clampBuildingToCanvas(
			{ x: drawRect.x, y: drawRect.y, width: drawRect.width, height: drawRect.height },
			world.width,
			world.height,
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
		[isDrawing, drawRect, buildings, onBuildingsChange, onSelect, world.width, world.height],
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
				world.width,
				world.height,
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
		[buildings, onBuildingsChange, onPushHistory, world.width, world.height],
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
			const contained = clampBuildingToCanvas({ x: snappedX, y: snappedY, width: newWidth, height: newHeight }, world.width, world.height);
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
		[buildings, onBuildingsChange, onPushHistory, world.width, world.height],
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
			// A NEW photo invalidates the stored framing: it was measured against a
			// different file's ratio. Clearing the local edit makes the editor
			// refit from the stored value, and `normalisePlacement` will refit anyway
			// because the recorded image size will not match the new upload.
			background.reset();
			toast.success('Campus image updated. It now fits the map area with its real shape.');
			onSaved();
		} catch (err) {
			toast.error('Failed to update campus image.');
			console.error('Image upload failed:', err);
		}
	}, [schoolId, onSaved]);

	const handleImageRemove = useCallback(async () => {
		try {
			await atlasApi.delete(`/map/schools/${schoolId}/campus-image`);
			background.reset();
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
			{/* ROW 1: the toolbar. A9 m1 extracted it to its own file so this one
			    stays under the AGENTS.md §8 1000-line cap while the Background
			    step below becomes a second row. Its layout note — what stayed, what
			    went, and what moved behind a Tooltip — is in that file's header,
			    because the operator's 2026-09-29 ruling was that "too literal"
			    changes with no subtraction are what got rejected. */}
			<CampusMapEditorToolbar
				tool={tool}
				onToolChange={setTool}
				zoom={zoom}
				onZoomChange={(next) => {
					// A9 c4, fix 36 — reset returns to the FIT view, not to 100%: at
					// the 1366px default 100% is the view that put a building under
					// the panel. A9 m1 widened the range to 0.25-4.
					if (next === 1) setPan({ x: 0, y: 0 });
					setZoom(next);
				}}

				roomsSummary={selectedBuilding ? { teaching: selectedTeachingRoomCount, total: selectedRoomCount } : null}
				campusImageUrl={campusImageUrl}
				onImageUpload={handleImageUpload}
				onImageRemove={handleImageRemove}
				canUndo={historyStack.length > 0}
				canRedo={redoStack.length > 0}
				onUndo={onUndo}
				onRedo={onRedo}
				saveState={saveState}
				saveStateLabel={saveStateLabel}
				canSave={hasDirty && !saving}
				onSave={handleSave}
			/>

			{/* ── A9 m1, ROW 2: the Background step, and the receipt.
			    THIS IS THE LAYOUT DECISION, so it is written down where a reviewer
			    will meet it. The toolbar above is already one dense row at the
			    1366px default (mode, zoom, rooms, photo, history, save state,
			    save), and §8's header budget plus the subtract-first rule both say
			    the answer to "one more group" is a second calm row rather than
			    cramming a ninth cluster into the first. So:

			      STAYS — every existing group, unchanged, on row 1.
			      GOES   — nothing. Nothing on row 1 was removed, because the
			              packet did not ask for a subtraction and every item
			              there earns its place. The subtraction is in WORD COUNT:
			              the step below carries no caption, no helper sentence and
			              no "More" menu, and the only sentence it renders when there
			              is no photo is eight words.
			      MOVES BEHIND A TOOLTIP — every explanation. "Fit whole image"
			              and "Fill the area" say what they do in their own labels,
			              so their tooltips add only WHY.

			    The step renders as a group with no chevron and no collapsed state:
			    a disclosure is explicitly forbidden, and an operator who has to
			    click to find out whether the background can be moved has already
			    lost. */}
			<CampusMapBackgroundStep
				placement={placement}
				moving={background.moving}
				saving={background.saving}
				onToggleMoving={background.toggleMoving}
				onBigger={background.bigger}
				onSmaller={background.smaller}
				onFitWholeImage={background.fitWholeImage}
				onFillTheArea={background.fillTheArea}
				onReset={background.resetBackground}
				onToggleLock={background.toggleLock}
				onSave={background.save}
			/>

			{/* THE RECEIPT, on the page where the save happened. The packet's exact
			    sentence first, then what was not done and the next step, because a
			    receipt that only says "done" leaves the scheduler guessing whether
			    their buildings moved. */}
			{(background.receipt ?? backgroundReceipt) && (
				<p
					role="status"
					aria-live="polite"
					data-testid="campus-background-receipt"
					className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-sm font-medium text-emerald-800"
				>
					{background.receipt ?? backgroundReceipt}
				</p>
			)}

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
				width={world.width}
				height={world.height}
				draggable={tool === 'select' && !background.moving}
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
					const bounded = fitViewTransform({ content: world, box: fitBox, zoom, pan: { x: next.x - view.x, y: next.y - view.y } });
					return { x: bounded.x, y: bounded.y };
				}}
				onClick={handleStageClick}
				onMouseDown={handleStageMouseDown}
				onMouseMove={handleStageMouseMove}
				onMouseUp={handleStageMouseUp}
			onWheel={(event) => {
				event.evt.preventDefault();
				setZoom((current) => nextBackgroundZoom(current, event.evt.deltaY < 0 ? 0.1 : -0.1));
			}}
			>
				<Layer>
					{/* THE BACKGROUND, through the one shared layer. This replaces the
					    two fixed `CANVAS_WIDTH x CANVAS_HEIGHT` rects whose independent
					    `fillPatternScaleX` / `fillPatternScaleY` stretched any photo
					    that was not 1.59:1. The stage is not draggable while the photo
					    is being moved, so a drag in Move mode reaches the photo and
					    nothing else. */}
					<CampusMapBackgroundLayer
						image={campusImage}
						placement={placement ?? defaultPlacement(null, world)}
						world={world}
						draggable={Boolean(placement) && background.moving && placement?.locked === false}
						onDragEnd={(next) => {
							// Konva reports the node's position in the LAYER's
							// coordinates, which IS the world — the same space a
							// building's stored `x`/`y` lives in, so the value is
							// directly comparable and no division by the view scale
							// is needed or wanted.
							background.moveTo(next);
						}}
					/>


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

						{/* Alignment guides. A9 m1: they span the GROWN world, so a guide
						    still reaches across a photo that made the canvas taller. */}
						{guides.map((g, i) =>
							g.x !== undefined ? (
								<Line key={`gv-${i}`} points={[g.x, 0, g.x, world.height]} stroke={primaryCanvasColor || MAP_TRANSFORMER_STROKE} strokeWidth={1} dash={[4, 4]} opacity={0.6} />
							) : g.y !== undefined ? (
								<Line key={`gh-${i}`} points={[0, g.y, world.width, g.y]} stroke={primaryCanvasColor || MAP_TRANSFORMER_STROKE} strokeWidth={1} dash={[4, 4]} opacity={0.6} />
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
