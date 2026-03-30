import Konva from 'konva';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Group, Layer, Rect, Stage, Text, Transformer } from 'react-konva';
import { Minus, MousePointer2, Plus, RotateCcw, Save, Square, Upload } from 'lucide-react';

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
};

type Tool = 'select' | 'add';

const MIN_WIDTH = 60;
const MIN_HEIGHT = 40;
const CANVAS_WIDTH = 920;
const CANVAS_HEIGHT = 580;

const COLORS = ['#2563eb', '#059669', '#ea580c', '#7c3aed', '#dc2626', '#0891b2', '#ca8a04', '#4f46e5'];

let tempIdCounter = -1;

export function CampusMapEditor({
	schoolId,
	buildings,
	campusImageUrl,
	onBuildingsChange,
	selectedBuildingId,
	onSelect,
	onSaved,
}: CampusMapEditorProps) {
	const [scale, setScale] = useState(1);
	const [position, setPosition] = useState({ x: 0, y: 0 });
	const [tool, setTool] = useState<Tool>('select');
	const [saving, setSaving] = useState(false);
	const [campusImage, setCampusImage] = useState<HTMLImageElement | null>(null);

	const transformerRef = useRef<Konva.Transformer>(null);
	const shapeRefs = useRef<Map<number, Konva.Group>>(new Map());
	const stageRef = useRef<Konva.Stage>(null);

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

	const handleStageClick = useCallback(
		(e: Konva.KonvaEventObject<MouseEvent>) => {
			// If clicked on stage background
			const clickedOnEmpty = e.target === e.target.getStage() || e.target.name() === 'bg';

			if (tool === 'add' && clickedOnEmpty) {
				const stage = stageRef.current;
				if (!stage) return;
				const pointer = stage.getRelativePointerPosition();
				if (!pointer) return;

				const newBuilding: EditorBuilding = {
					id: tempIdCounter--,
					name: `Building ${buildings.length + 1}`,
					x: pointer.x - 50,
					y: pointer.y - 30,
					width: 200,
					height: 120,
					color: COLORS[buildings.length % COLORS.length],
					rooms: [],
					dirty: true,
					isNew: true,
				};
				onBuildingsChange([...buildings, newBuilding]);
				onSelect(newBuilding.id);
				setTool('select');
				return;
			}

			if (clickedOnEmpty) {
				onSelect(null);
			}
		},
		[tool, buildings, onBuildingsChange, onSelect],
	);

	const handleDragEnd = useCallback(
		(buildingId: number, e: Konva.KonvaEventObject<DragEvent>) => {
			const node = e.target;
			onBuildingsChange(
				buildings.map((b) =>
					b.id === buildingId
						? { ...b, x: node.x(), y: node.y(), dirty: true }
						: b,
				),
			);
		},
		[buildings, onBuildingsChange],
	);

	const handleTransformEnd = useCallback(
		(buildingId: number) => {
			const node = shapeRefs.current.get(buildingId);
			if (!node) return;
			const scaleX = node.scaleX();
			const scaleY = node.scaleY();

			// Reset scale and update width/height
			node.scaleX(1);
			node.scaleY(1);

			const building = buildings.find((b) => b.id === buildingId);
			if (!building) return;

			onBuildingsChange(
				buildings.map((b) =>
					b.id === buildingId
						? {
								...b,
								x: node.x(),
								y: node.y(),
								width: Math.max(MIN_WIDTH, b.width * scaleX),
								height: Math.max(MIN_HEIGHT, b.height * scaleY),
								dirty: true,
							}
						: b,
				),
			);
		},
		[buildings, onBuildingsChange],
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
									draggable={tool === 'select'}
									onClick={(e) => {
										e.cancelBubble = true;
										onSelect(b.id);
									}}
									onDragEnd={(e) => handleDragEnd(b.id, e)}
									onTransformEnd={() => handleTransformEnd(b.id)}
								>
									<Rect
										width={b.width}
										height={b.height}
										fill={b.color}
										opacity={selected ? 0.95 : 0.78}
										cornerRadius={8}
										stroke={selected ? '#111827' : '#ffffff'}
										strokeWidth={selected ? 3 : 2}
										shadowColor="rgba(0,0,0,0.12)"
										shadowBlur={selected ? 6 : 3}
										shadowOffsetY={selected ? 2 : 1}
									/>
									<Text
										x={10}
										y={10}
										text={b.name}
										fontSize={14}
										fill="#ffffff"
										fontStyle="bold"
										width={b.width - 20}
										ellipsis
										wrap="none"
									/>
									<Text
										x={10}
										y={b.height - 24}
										text={`${b.rooms.length} room${b.rooms.length !== 1 ? 's' : ''}`}
										fontSize={11}
										fill="rgba(255,255,255,0.8)"
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

						{/* Transformer */}
						<Transformer
							ref={transformerRef}
							rotateEnabled={false}
							enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
							boundBoxFunc={(_oldBox, newBox) => {
								if (newBox.width < MIN_WIDTH) newBox.width = MIN_WIDTH;
								if (newBox.height < MIN_HEIGHT) newBox.height = MIN_HEIGHT;
								return newBox;
							}}
							borderStroke="#2563eb"
							borderStrokeWidth={2}
							anchorFill="#ffffff"
							anchorStroke="#2563eb"
							anchorSize={8}
							anchorCornerRadius={2}
						/>
					</Layer>
				</Stage>
			</div>

			{/* Status bar */}
			<div className="flex items-center justify-between text-[0.75rem] text-muted-foreground">
				<span>
					{tool === 'add'
						? 'Click on the canvas to place a new building'
						: 'Click a building to select • Drag to move • Handles to resize'}
				</span>
				<span className="tabular-nums">{Math.round(scale * 100)}% zoom</span>
			</div>
		</div>
	);
}
