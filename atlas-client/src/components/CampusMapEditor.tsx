import Konva from 'konva';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Group, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import { Minus, MousePointer2, Plus, Redo2, RotateCcw, Save, Square, Undo2, Upload } from 'lucide-react';

import atlasApi from '@/lib/api';
import type { Building } from '@/types';
import { Button } from '@/ui/button';

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

const MIN_WIDTH = 60;
const MIN_HEIGHT = 40;
const CANVAS_WIDTH = 920;
const CANVAS_HEIGHT = 580;

const COLORS = ['#2563eb', '#059669', '#ea580c', '#7c3aed', '#dc2626', '#0891b2', '#ca8a04', '#4f46e5'];

/**
 * Smart-threshold label rotation:
 * - |angle| <= 20°: keep text upright (counter-rotate fully)
 * - |angle| > 20°: let text ride with the building (no correction)
 */
function smartLabelRotation(buildingRotation: number): number {
	const absAngle = Math.abs(buildingRotation % 360);
	const effective = absAngle > 180 ? 360 - absAngle : absAngle;
	return effective <= 20 ? -(buildingRotation ?? 0) : 0;
}

let tempIdCounter = -1;

/** Map each resize anchor to the opposite (fixed) anchor */
const OPPOSITE_ANCHORS: Record<string, string> = {
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
function anchorLocalOffset(w: number, h: number, anchor: string): { x: number; y: number } {
	let x = 0;
	let y = 0;
	if (anchor.includes('right')) x = w;
	else if (anchor.includes('center')) x = w / 2;
	if (anchor.includes('bottom')) y = h;
	else if (anchor.startsWith('middle')) y = h / 2;
	return { x, y };
}

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
	const [scale, setScale] = useState(1);
	const [position, setPosition] = useState({ x: 0, y: 0 });
	const [tool, setTool] = useState<Tool>('select');
	const [saving, setSaving] = useState(false);
	const [campusImage, setCampusImage] = useState<HTMLImageElement | null>(null);
	const [hoveredBuildingId, setHoveredBuildingId] = useState<number | null>(null);

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

			const x = Math.min(drawStart.x, pointer.x);
			const y = Math.min(drawStart.y, pointer.y);
			const width = Math.abs(pointer.x - drawStart.x);
			const height = Math.abs(pointer.y - drawStart.y);
			setDrawRect({ x, y, width, height });
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

			const newBuilding: EditorBuilding = {
				id: tempIdCounter--,
				name: `Building ${buildings.length + 1}`,
				x: drawRect.x,
				y: drawRect.y,
				width: drawRect.width,
				height: drawRect.height,
				rotation: 0,
				color: COLORS[buildings.length % COLORS.length],
				floorCount: 1,
				isTeachingBuilding: true,
				rooms: [],
				dirty: true,
				isNew: true,
			};
			onPushHistory();
			onBuildingsChange([...buildings, newBuilding]);
			onSelect(newBuilding.id);
			setTool('select');
		},
		[isDrawing, drawRect, buildings, onBuildingsChange, onSelect],
	);

	const handleDragEnd = useCallback(
		(buildingId: number, e: Konva.KonvaEventObject<DragEvent>) => {
			const node = e.target;
			// Snap to integer coordinates to prevent sub-pixel drift
			const snappedX = Math.round(node.x());
			const snappedY = Math.round(node.y());
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
		[buildings, onBuildingsChange, onPushHistory],
	);

	const handleDragMove = useCallback(
		(buildingId: number, e: Konva.KonvaEventObject<DragEvent>) => {
			const node = e.target;
			const dragX = node.x();
			const dragY = node.y();
			const building = buildings.find((b) => b.id === buildingId);
			if (!building) return;

			const SNAP_THRESHOLD = 5;
			const newGuides: { x?: number; y?: number }[] = [];

			// Check alignment with other buildings
			for (const other of buildings) {
				if (other.id === buildingId) continue;

				// Vertical guides (left-left, right-right, left-right, right-left, center-center)
				const edges = [
					{ dragEdge: dragX, otherEdge: other.x }, // left-left
					{ dragEdge: dragX + building.width, otherEdge: other.x + other.width }, // right-right
					{ dragEdge: dragX, otherEdge: other.x + other.width }, // left-right
					{ dragEdge: dragX + building.width, otherEdge: other.x }, // right-left
					{ dragEdge: dragX + building.width / 2, otherEdge: other.x + other.width / 2 }, // center-center
				];
				for (const { dragEdge, otherEdge } of edges) {
					if (Math.abs(dragEdge - otherEdge) < SNAP_THRESHOLD) {
						newGuides.push({ x: otherEdge });
					}
				}

				// Horizontal guides (top-top, bottom-bottom, top-bottom, bottom-top, center-center)
				const hEdges = [
					{ dragEdge: dragY, otherEdge: other.y },
					{ dragEdge: dragY + building.height, otherEdge: other.y + other.height },
					{ dragEdge: dragY, otherEdge: other.y + other.height },
					{ dragEdge: dragY + building.height, otherEdge: other.y },
					{ dragEdge: dragY + building.height / 2, otherEdge: other.y + other.height / 2 },
				];
				for (const { dragEdge, otherEdge } of hEdges) {
					if (Math.abs(dragEdge - otherEdge) < SNAP_THRESHOLD) {
						newGuides.push({ y: otherEdge });
					}
				}
			}

			setGuides(newGuides);
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

			let snappedX: number;
			let snappedY: number;

			// Anchored resize: compute origin so the opposite handle stays put.
			// The fixed anchor's stage position is derived from the pre-transform
			// (integer) state, so rounding the new origin does not accumulate drift.
			const anchor = activeAnchorRef.current;
			const fixedAnchorName = anchor ? OPPOSITE_ANCHORS[anchor] : null;

			if (fixedAnchorName) {
				const oldRad = ((building.rotation ?? 0) * Math.PI) / 180;
				const oldCos = Math.cos(oldRad);
				const oldSin = Math.sin(oldRad);
				const oldOff = anchorLocalOffset(building.width, building.height, fixedAnchorName);
				// Fixed anchor in stage coords from pre-transform integers
				const fixedX = building.x + oldOff.x * oldCos - oldOff.y * oldSin;
				const fixedY = building.y + oldOff.x * oldSin + oldOff.y * oldCos;

				const newRad = (newRotation * Math.PI) / 180;
				const newCos = Math.cos(newRad);
				const newSin = Math.sin(newRad);
				const newOff = anchorLocalOffset(newWidth, newHeight, fixedAnchorName);
				// Derive origin: fixedPoint = origin + rotatedOffset → origin = fixedPoint − rotatedOffset
				snappedX = Math.round(fixedX - (newOff.x * newCos - newOff.y * newSin));
				snappedY = Math.round(fixedY - (newOff.x * newSin + newOff.y * newCos));
			} else {
				// Pure rotation or unknown anchor — just snap the node's position
				snappedX = Math.round(node.x());
				snappedY = Math.round(node.y());
			}

			// Reset scale to 1 and apply computed dimensions to prevent drift
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
		[buildings, onBuildingsChange, onPushHistory],
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
			const dirtyBuildings = buildings.filter((b) => b.dirty);
			for (const b of dirtyBuildings) {
				if (b.isNew) {
					// Create new building via API
					const { data } = await atlasApi.post(`/map/schools/${schoolId}/buildings`, {
						name: b.name,
						x: Math.round(b.x),
						y: Math.round(b.y),
						width: Math.round(b.width),
						height: Math.round(b.height),
						color: b.color,
						rotation: b.rotation ?? 0,
						floorCount: b.floorCount ?? 1,
						isTeachingBuilding: b.isTeachingBuilding ?? true,
					});
					// Replace temp id with real id
					const newId = data.building.id;
					onBuildingsChange(
						buildings.map((existing) =>
							existing.id === b.id
								? { ...data.building, dirty: false, isNew: false }
								: existing,
						),
					);
				} else {
					// Update existing building
					await atlasApi.patch(`/map/buildings/${b.id}`, {
						name: b.name,
						x: Math.round(b.x),
						y: Math.round(b.y),
						width: Math.round(b.width),
						height: Math.round(b.height),
						color: b.color,
						rotation: b.rotation ?? 0,
						floorCount: b.floorCount ?? 1,
						isTeachingBuilding: b.isTeachingBuilding ?? true,
					});
				}
			}
			// Clear dirty flags
			onBuildingsChange(
				buildings.map((b) => ({ ...b, dirty: false, isNew: false })),
			);
			onSaved();
		} catch (err) {
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
			// Reload the campus image
			onSaved();
		} catch (err) {
			console.error('Image upload failed:', err);
		}
	}, [schoolId, onSaved]);

	const hasDirty = buildings.some((b) => b.dirty);

	return (
		<div className="flex flex-col gap-2">
			{/* Toolbar */}
			<div className="flex flex-wrap items-center gap-2">
				<Button
					variant={tool === 'select' ? 'default' : 'outline'}
					size="sm"
					onClick={() => setTool('select')}
				>
					<MousePointer2 className="size-3.5" /> Select
				</Button>
				<Button
					variant={tool === 'add' ? 'default' : 'outline'}
					size="sm"
					onClick={() => setTool('add')}
				>
					<Square className="size-3.5" /> Add Building
				</Button>

				<div className="h-6 w-px bg-border" />

				<Button variant="outline" size="sm" onClick={() => setScale((s) => Math.min(s + 0.15, 2.5))}>
					<Plus className="size-3.5" />
				</Button>
				<Button variant="outline" size="sm" onClick={() => setScale((s) => Math.max(s - 0.15, 0.4))}>
					<Minus className="size-3.5" />
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={() => {
						setScale(1);
						setPosition({ x: 0, y: 0 });
					}}
				>
					<RotateCcw className="size-3.5" />
				</Button>

				<div className="h-6 w-px bg-border" />

				<label className="cursor-pointer">
					<Button variant="outline" size="sm" asChild>
						<span>
							<Upload className="size-3.5" /> Background
						</span>
					</Button>
					<input
						type="file"
						accept="image/png,image/jpeg,image/webp"
						className="hidden"
						onChange={handleImageUpload}
					/>
				</label>

				<div className="h-6 w-px bg-border" />

				<Button
					variant="outline"
					size="sm"
					disabled={historyStack.length === 0}
					onClick={onUndo}
					title="Undo (Ctrl+Z)"
				>
					<Undo2 className="size-3.5" />
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={redoStack.length === 0}
					onClick={onRedo}
					title="Redo (Ctrl+Y)"
				>
					<Redo2 className="size-3.5" />
				</Button>

				<div className="flex-1" />

				<Button
					size="sm"
					disabled={!hasDirty || saving}
					onClick={handleSave}
				>
					<Save className="size-3.5" />
					{saving ? 'Saving...' : 'Save Changes'}
				</Button>
			</div>

			{/* Canvas */}
			<div
				className={`overflow-hidden rounded-lg border border-border bg-muted/30 ${
					tool === 'add' ? 'cursor-crosshair' : ''
				}`}
			>
				<Stage
					ref={stageRef}
					width={CANVAS_WIDTH}
					height={CANVAS_HEIGHT}
					draggable={tool === 'select'}
					x={position.x}
					y={position.y}
					scaleX={scale}
					scaleY={scale}
					onDragEnd={(e) => {
						if (e.target === stageRef.current) {
							setPosition({ x: e.target.x(), y: e.target.y() });
						}
					}}
					onClick={handleStageClick}
					onMouseDown={handleStageMouseDown}
					onMouseMove={handleStageMouseMove}
					onMouseUp={handleStageMouseUp}
				>
					<Layer>
						{/* Background */}
						{campusImage ? (
							<>
								<Rect name="bg" x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="#f5f5f4" />
								{/* eslint-disable-next-line jsx-a11y/alt-text */}
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
										stroke={selected ? '#6366f1' : '#ffffff'}
										strokeWidth={selected ? 3 : 2}
										shadowColor={selected ? 'rgba(99,102,241,0.35)' : 'rgba(0,0,0,0.12)'}
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
							borderStroke="#6366f1"
							borderStrokeWidth={2}
							anchorFill="#ffffff"
							anchorStroke="#6366f1"
							anchorSize={10}
							anchorCornerRadius={3}
							anchorStrokeWidth={2}
							padding={4}
						/>

						{/* Alignment guides */}
						{guides.map((g, i) =>
							g.x !== undefined ? (
								<Line key={`gv-${i}`} points={[g.x, 0, g.x, CANVAS_HEIGHT]} stroke="#6366f1" strokeWidth={1} dash={[4, 4]} opacity={0.6} />
							) : g.y !== undefined ? (
								<Line key={`gh-${i}`} points={[0, g.y, CANVAS_WIDTH, g.y]} stroke="#6366f1" strokeWidth={1} dash={[4, 4]} opacity={0.6} />
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
									fill="rgba(99,102,241,0.9)"
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

			{/* Status bar */}
			<div className="flex items-center justify-between text-[0.75rem] text-muted-foreground ">
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
				<span className="tabular-nums">{Math.round(scale * 100)}% zoom</span>
			</div>
		</div>
	);
}
