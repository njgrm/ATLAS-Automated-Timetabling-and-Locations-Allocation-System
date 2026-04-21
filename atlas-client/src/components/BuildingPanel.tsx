import { useMemo, useState } from 'react';
import { GripVertical, PencilLine, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
} from '@dnd-kit/core';
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import atlasApi from '@/lib/api';
import type { Building, Room, RoomType } from '@/types';
import { Button } from '@/ui/button';
import { ConfirmationModal } from '@/ui/confirmation-modal';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/ui/dialog';
import { Input } from '@/ui/input';
import { Badge } from '@/ui/badge';
import { Label } from '@/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Switch } from '@/ui/switch';

type EditorBuilding = Building & { dirty?: boolean; isNew?: boolean };
type RoomEditForm = {
	id: number;
	name: string;
	floor: number;
	type: RoomType;
	capacity: string;
	isTeachingSpace: boolean;
};

type BuildingPanelProps = {
	building: EditorBuilding;
	onUpdate: (updates: Partial<EditorBuilding>) => void;
	onDelete: () => void;
	onClose: () => void;
	onRoomAdded: (room: Room) => void;
	onRoomDeleted: (roomId: number) => void;
	onRoomUpdated: (room: Room) => void;
	onPushHistory: () => void;
	/** Read-only mode hides edit controls (used in dashboard) */
	readOnly?: boolean;
};

const ROOM_TYPES: { value: RoomType; label: string }[] = [
	{ value: 'CLASSROOM', label: 'Classroom' },
	{ value: 'LABORATORY', label: 'Laboratory' },
	{ value: 'COMPUTER_LAB', label: 'Computer Lab' },
	{ value: 'TLE_WORKSHOP', label: 'TLE Workshop' },
	{ value: 'LIBRARY', label: 'Library' },
	{ value: 'GYMNASIUM', label: 'Gymnasium' },
	{ value: 'FACULTY_ROOM', label: 'Faculty Room' },
	{ value: 'OFFICE', label: 'Office' },
	{ value: 'OTHER', label: 'Other' },
];

const COLORS = ['#2563eb', '#059669', '#ea580c', '#7c3aed', '#dc2626', '#0891b2', '#ca8a04', '#4f46e5', '#be185d', '#374151'];

/** Room types that default to non-teaching when created */
const NON_TEACHING_TYPES: RoomType[] = ['LIBRARY', 'FACULTY_ROOM', 'OFFICE', 'OTHER'];

export function BuildingPanel({
	building,
	onUpdate,
	onDelete,
	onClose,
	onRoomAdded,
	onRoomDeleted,
	onRoomUpdated,
	onPushHistory,
	readOnly = false,
}: BuildingPanelProps) {
	const [newRoomName, setNewRoomName] = useState('');
	const [newRoomType, setNewRoomType] = useState<RoomType>('CLASSROOM');
	const [newRoomCapacity, setNewRoomCapacity] = useState('45');
	const [addingRoom, setAddingRoom] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [deleteRoomTarget, setDeleteRoomTarget] = useState<Room | null>(null);
	const [showDeleteBuilding, setShowDeleteBuilding] = useState(false);
	const [activeFloor, setActiveFloor] = useState(1);
	const [newRoomFloor, setNewRoomFloor] = useState(1); // Separate state for add-room target floor
	const [togglingTeaching, setTogglingTeaching] = useState(false);
	const [editingRoom, setEditingRoom] = useState<RoomEditForm | null>(null);
	const [savingRoom, setSavingRoom] = useState(false);

	// Derive persisted floor count from existing rooms (highest floor among saved rooms)
	// This helps detect when local floorCount has been increased but not saved
	const persistedFloorCount = useMemo(() => {
		if (building.rooms.length === 0) return building.floorCount;
		return Math.max(...building.rooms.map((r) => r.floor), 1);
	}, [building.rooms, building.floorCount]);

	const minFloorCount = useMemo(
		() => (building.rooms.length === 0 ? 1 : Math.max(...building.rooms.map((room) => room.floor), 1)),
		[building.rooms],
	);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	// Rooms filtered by active floor
	const roomsOnFloor = useMemo(
		() => building.rooms
			.filter((r) => r.floor === activeFloor)
			.sort((a, b) => (a.floorPosition ?? 0) - (b.floorPosition ?? 0)),
		[building.rooms, activeFloor],
	);

	const handleAddRoom = async () => {
		if (!newRoomName.trim()) return;

		// If the building hasn't been saved yet (temp id), can't add rooms
		if (building.isNew) return;

		// Guard: Block if local floorCount increased but not saved
		// If newRoomFloor exceeds what we can infer is persisted, user must save first
		const localFloorCount = building.floorCount ?? 1;
		if (building.dirty && newRoomFloor > persistedFloorCount) {
			toast.error('Save building changes first before adding rooms on a new floor.');
			return;
		}

		setAddingRoom(true);
		try {
			const isTeachingSpace = building.isTeachingBuilding !== false && !NON_TEACHING_TYPES.includes(newRoomType);
			const { data } = await atlasApi.post(`/map/buildings/${building.id}/rooms`, {
				name: newRoomName.trim(),
				floor: newRoomFloor,
				type: newRoomType,
				capacity: newRoomCapacity ? Number(newRoomCapacity) : null,
				isTeachingSpace,
			});
			onPushHistory();
			onRoomAdded(data.room);
			setNewRoomName('');
			setNewRoomCapacity('45');
			toast.success('Room added successfully.');
		} catch (err: any) {
			// Surface backend error message if available
			const backendMsg = err?.response?.data?.message;
			toast.error(backendMsg || 'Failed to add room.');
			console.error('Failed to add room:', err);
		} finally {
			setAddingRoom(false);
		}
	};

	const handleDeleteRoom = async (roomId: number) => {
		try {
			await atlasApi.delete(`/map/rooms/${roomId}`);
			onPushHistory();
			onRoomDeleted(roomId);
			setDeleteRoomTarget(null);
			toast.success('Room deleted.');
		} catch (err) {
			toast.error('Failed to delete room.');
			console.error('Failed to delete room:', err);
		}
	};

	const handleDeleteBuilding = async () => {
		if (building.isNew) {
			onDelete();
			return;
		}
		setDeleting(true);
		try {
			await atlasApi.delete(`/map/buildings/${building.id}`);
			onPushHistory();
			toast.success('Building deleted.');
			onDelete();
		} catch (err) {
			toast.error('Failed to delete building.');
			console.error('Failed to delete building:', err);
		} finally {
			setDeleting(false);
		}
	};

	const openRoomEditor = (room: Room) => {
		setEditingRoom({
			id: room.id,
			name: room.name,
			floor: room.floor,
			type: room.type,
			capacity: room.capacity != null ? String(room.capacity) : '',
			isTeachingSpace: room.isTeachingSpace,
		});
	};

	const handleSaveRoomEdit = async () => {
		if (!editingRoom || !editingRoom.name.trim()) return;

		setSavingRoom(true);
		try {
			const isTeachingSpace = building.isTeachingBuilding !== false && !NON_TEACHING_TYPES.includes(editingRoom.type)
				? editingRoom.isTeachingSpace
				: false;

			const { data } = await atlasApi.patch(`/map/rooms/${editingRoom.id}`, {
				name: editingRoom.name.trim(),
				floor: editingRoom.floor,
				type: editingRoom.type,
				capacity: editingRoom.capacity ? Number(editingRoom.capacity) : null,
				isTeachingSpace,
			});

			onPushHistory();
			onRoomUpdated(data.room);
			setEditingRoom(null);
			toast.success('Room updated successfully.');
		} catch (err: any) {
			const backendMsg = err?.response?.data?.message;
			toast.error(backendMsg || 'Failed to update room.');
			console.error('Failed to update room:', err);
		} finally {
			setSavingRoom(false);
		}
	};

	const handleToggleTeachingSpace = async (room: Room) => {
		if (building.isTeachingBuilding === false) return; // hidden when non-teaching building
		try {
			const { data } = await atlasApi.patch(`/map/rooms/${room.id}`, {
				isTeachingSpace: !room.isTeachingSpace,
			});
			onRoomUpdated(data.room);
		} catch (err) {
			toast.error('Failed to update room.');
			console.error('Failed to update room:', err);
		}
	};

	const handleToggleTeachingBuilding = async () => {
		if (building.isNew) return;
		setTogglingTeaching(true);
		try {
			const newVal = !(building.isTeachingBuilding ?? true);
			const { data } = await atlasApi.patch(`/map/buildings/${building.id}`, {
				isTeachingBuilding: newVal,
			});
			onPushHistory();
			// Update building with cascaded room data
			onUpdate({ isTeachingBuilding: data.building.isTeachingBuilding, dirty: true });
			// Refresh all rooms from response to reflect cascade
			if (data.building.rooms) {
				for (const room of data.building.rooms as Room[]) {
					onRoomUpdated(room);
				}
			}
			toast.success(newVal ? 'Building marked as teaching.' : 'Building excluded from scheduling.');
		} catch (err) {
			toast.error('Failed to update building.');
			console.error('Failed to toggle teaching building:', err);
		} finally {
			setTogglingTeaching(false);
		}
	};

	const handleRoomDragEnd = async (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;

		const oldIndex = roomsOnFloor.findIndex((r) => r.id === active.id);
		const newIndex = roomsOnFloor.findIndex((r) => r.id === over.id);
		if (oldIndex === -1 || newIndex === -1) return;

		const reordered = arrayMove(roomsOnFloor, oldIndex, newIndex);

		// Optimistically update positions
		for (let i = 0; i < reordered.length; i++) {
			const room = reordered[i];
			if (room.floorPosition !== i) {
				onRoomUpdated({ ...room, floorPosition: i });
				// Fire-and-forget API update
				atlasApi.patch(`/map/rooms/${room.id}`, { floorPosition: i }).catch(() => {});
			}
		}
	};

	return (
		<div className="flex h-full w-79.5 shrink-0 flex-col border-l border-border bg-card">
			{/* Header */}
			<div className="flex items-center justify-between border-b border-border px-4 py-3">
				<h3 className="text-sm font-bold">Building Details</h3>
				<Button type="button" variant="ghost" size="icon-xs" onClick={onClose} aria-label="Close building details">
					<X className="size-4" />
				</Button>
			</div>

			<div className="flex-1 overflow-auto px-4 py-3 space-y-4">
				{!readOnly && (
					<>
						{/* Name */}
						<div>
							<label className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
								Name
							</label>
							<Input
								value={building.name}
								onChange={(e) => onUpdate({ name: e.target.value, dirty: true })}
								className="mt-1"
							/>
						</div>

						<div>
							<label className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
								Short Code
							</label>
							<Input
								value={building.shortCode ?? ''}
								placeholder="Auto-generate on save"
								onChange={(e) => {
									const nextValue = e.target.value.trim();
									onUpdate({ shortCode: nextValue ? nextValue.toUpperCase() : null, dirty: true });
								}}
								className="mt-1"
							/>
							<p className="mt-1 text-[0.6875rem] text-muted-foreground">
								Used for room labels and stable seeded-map matching.
							</p>
						</div>

						{/* Color */}
						<div>
							<label className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
								Color
							</label>
							<div className="mt-1.5 flex flex-wrap gap-1.5">
								{COLORS.map((c) => (
									<Button
										key={c}
										type="button"
										variant="outline"
										size="icon-xs"
										aria-label={`Set color ${c}`}
										onClick={() => onUpdate({ color: c, dirty: true })}
										className={`border-2 transition-all ${
											building.color === c ? 'border-foreground scale-110' : 'border-transparent'
										}`}
										style={{ backgroundColor: c }}
									/>
								))}
							</div>
						</div>

						{/* Position (editable) */}
						<div className="grid grid-cols-2 gap-2">
							<div>
								<label className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
									X
								</label>
								<Input
									type="number"
									value={Math.round(building.x)}
									onChange={(e) => onUpdate({ x: Number(e.target.value), dirty: true })}
									className="mt-1"
								/>
							</div>
							<div>
								<label className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
									Y
								</label>
								<Input
									type="number"
									value={Math.round(building.y)}
									onChange={(e) => onUpdate({ y: Number(e.target.value), dirty: true })}
									className="mt-1"
								/>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<div>
								<label className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
									Width
								</label>
								<Input
									type="number"
									min={60}
									value={Math.round(building.width)}
									onChange={(e) => onUpdate({ width: Math.max(60, Number(e.target.value)), dirty: true })}
									className="mt-1"
								/>
							</div>
							<div>
								<label className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
									Height
								</label>
								<Input
									type="number"
									min={40}
									value={Math.round(building.height)}
									onChange={(e) => onUpdate({ height: Math.max(40, Number(e.target.value)), dirty: true })}
									className="mt-1"
								/>
							</div>
						</div>

						{/* Floor count */}
						<div>
							<label className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
								Number of floors
							</label>
							<Input
								type="number"
								min={minFloorCount}
								max={10}
								value={building.floorCount ?? 1}
								onChange={(e) => {
									const val = Math.max(minFloorCount, Math.min(10, Number(e.target.value)));
									onUpdate({ floorCount: val, dirty: true });
									if (activeFloor > val) setActiveFloor(val);
									if (newRoomFloor > val) setNewRoomFloor(val);
								}}
								className="mt-1"
							/>
							<p className="mt-1 text-[0.6875rem] text-muted-foreground">
								Minimum {minFloorCount} while rooms remain assigned above the ground floor.
							</p>
						</div>

						{/* Non-teaching building toggle */}
						{!building.isNew && (
							<div className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
								<Switch
									checked={building.isTeachingBuilding === false}
									onCheckedChange={() => {
										void handleToggleTeachingBuilding();
									}}
									disabled={togglingTeaching}
								/>
								<label className="text-[0.6875rem] text-muted-foreground">
									Exclude from scheduling (non-teaching building)
								</label>
							</div>
						)}
					</>
				)}

				{/* Floor tabs + Rooms */}
				<div>
					<div className="flex items-center justify-between">
						<label className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
							Rooms ({building.rooms.length})
						</label>
					</div>

					{/* Floor tab switcher */}
					{(building.floorCount ?? 1) > 1 && (
						<div className="mt-2 flex flex-wrap gap-1">
							{Array.from({ length: building.floorCount ?? 1 }, (_, i) => i + 1).map((floor) => {
								const count = building.rooms.filter((r) => r.floor === floor).length;
								return (
									<Button
										key={floor}
										type="button"
										size="xs"
										variant={activeFloor === floor ? 'default' : 'outline'}
										onClick={() => {
										setActiveFloor(floor);
										setNewRoomFloor(floor); // Sync add-room floor with selected tab
									}}
									>
										F{floor} {count > 0 && <span className="text-[0.6rem] opacity-70">({count})</span>}
									</Button>
								);
							})}
						</div>
					)}

					{roomsOnFloor.length > 0 ? (
						readOnly ? (
							<ul className="mt-2 space-y-1.5">
								{roomsOnFloor.map((room) => (
									<RoomTileReadOnly key={room.id} room={room} />
								))}
							</ul>
						) : (
							<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRoomDragEnd}>
								<SortableContext items={roomsOnFloor.map((r) => r.id)} strategy={verticalListSortingStrategy}>
									<ul className="mt-2 space-y-1.5">
										{roomsOnFloor.map((room) => (
											<SortableRoomTile
												key={room.id}
												room={room}
												showTeachingToggle={building.isTeachingBuilding !== false && !NON_TEACHING_TYPES.includes(room.type)}
												onToggleTeaching={() => handleToggleTeachingSpace(room)}
												onEdit={() => openRoomEditor(room)}
												onDelete={() => setDeleteRoomTarget(room)}
											/>
										))}
									</ul>
								</SortableContext>
							</DndContext>
						)
					) : (
						<p className="mt-2 text-[0.8125rem] text-muted-foreground">
							{building.isNew
								? 'Save the building first to add rooms.'
								: `No rooms on floor ${activeFloor}. Add one below.`}
						</p>
					)}

					{/* Add room form */}
					{!building.isNew && !readOnly && (
						<div className="mt-3 space-y-2 rounded-md border border-dashed border-border p-2.5">
							<Input
								placeholder="Room name"
								value={newRoomName}
								onChange={(e) => setNewRoomName(e.target.value)}
							/>
							<div className="grid grid-cols-2 gap-2">
								<div>
									<label className="text-[0.6rem] text-muted-foreground mb-1 block">Floor</label>
									<Select
										value={String(newRoomFloor)}
										onValueChange={(v) => setNewRoomFloor(Number(v))}
									>
										<SelectTrigger className="flex h-9 w-full bg-transparent text-sm shadow-sm transition-colors">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{Array.from({ length: building.floorCount ?? 1 }, (_, i) => i + 1).map((floor) => (
												<SelectItem key={floor} value={String(floor)}>
													Floor {floor}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div>
									<label className="text-[0.6rem] text-muted-foreground">Capacity</label>
									<Input
										type="number"
										min={1}
										placeholder="—"
										value={newRoomCapacity}
										onChange={(e) => setNewRoomCapacity(e.target.value)}
									/>
								</div>
							</div>
							<div>
								<label className="text-[0.6rem] text-muted-foreground mb-1 block">Type</label>
								<Select value={newRoomType} onValueChange={(v) => setNewRoomType(v as RoomType)}>
									<SelectTrigger className="flex h-9 w-full bg-transparent text-sm shadow-sm transition-colors">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{ROOM_TYPES.map((t) => (
											<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<Button
								size="sm"
								className="w-full"
								disabled={!newRoomName.trim() || addingRoom}
								onClick={handleAddRoom}
							>
								<Plus className="size-3.5" />
								{addingRoom ? 'Adding...' : 'Add Room'}
							</Button>
						</div>
					)}
				</div>
			</div>

			{!readOnly && (
				<div className="border-t border-border px-4 py-3">
					<Button
						variant="destructive"
						size="sm"
						className="w-full"
						onClick={() => building.isNew ? handleDeleteBuilding() : setShowDeleteBuilding(true)}
						disabled={deleting}
					>
						<Trash2 className="size-3.5" />
						{deleting ? 'Deleting...' : 'Delete Building'}
					</Button>
				</div>
			)}

			{/* Room delete confirmation */}
			<ConfirmationModal
				open={!!deleteRoomTarget}
				onOpenChange={(open) => !open && setDeleteRoomTarget(null)}
				title="Delete Room"
				description={<>Are you sure you want to delete <strong>{deleteRoomTarget?.name}</strong>? This action cannot be undone.</>}
				confirmText="Yes, Delete"
				onConfirm={() => deleteRoomTarget && handleDeleteRoom(deleteRoomTarget.id)}
				variant="danger"
			/>

			{/* Building delete confirmation */}
			<ConfirmationModal
				open={showDeleteBuilding}
				onOpenChange={setShowDeleteBuilding}
				title="Delete Building"
				description={<>Are you sure you want to delete <strong>{building.name}</strong> and all its rooms? This action cannot be undone.</>}
				confirmText="Yes, Delete"
				onConfirm={handleDeleteBuilding}
				loading={deleting}
				variant="danger"
			/>

			<Dialog open={!!editingRoom} onOpenChange={(open) => !open && !savingRoom && setEditingRoom(null)}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Edit Room</DialogTitle>
						<DialogDescription>
							Update the room metadata for the selected building and floor.
						</DialogDescription>
					</DialogHeader>

					{editingRoom && (
						<div className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="edit-room-name">Room name</Label>
								<Input
									id="edit-room-name"
									value={editingRoom.name}
									onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
								/>
							</div>

							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-2">
									<Label>Floor</Label>
									<Select
										value={String(editingRoom.floor)}
										onValueChange={(value) => setEditingRoom({ ...editingRoom, floor: Number(value) })}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{Array.from({ length: building.floorCount ?? 1 }, (_, index) => index + 1).map((floor) => (
												<SelectItem key={floor} value={String(floor)}>
													Floor {floor}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-2">
									<Label htmlFor="edit-room-capacity">Capacity</Label>
									<Input
										id="edit-room-capacity"
										type="number"
										min={1}
										value={editingRoom.capacity}
										onChange={(e) => setEditingRoom({ ...editingRoom, capacity: e.target.value })}
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label>Room type</Label>
								<Select
									value={editingRoom.type}
									onValueChange={(value) => {
										const nextType = value as RoomType;
										setEditingRoom({
											...editingRoom,
											type: nextType,
											isTeachingSpace: NON_TEACHING_TYPES.includes(nextType) ? false : editingRoom.isTeachingSpace,
										});
									}}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{ROOM_TYPES.map((type) => (
											<SelectItem key={type.value} value={type.value}>
												{type.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
								<div>
									<p className="text-sm font-medium">Teaching space</p>
									<p className="text-[0.6875rem] text-muted-foreground">
										Disabled automatically for non-teaching buildings and room types.
									</p>
								</div>
								<Switch
									checked={editingRoom.isTeachingSpace}
									onCheckedChange={(checked) => setEditingRoom({ ...editingRoom, isTeachingSpace: checked })}
									disabled={building.isTeachingBuilding === false || NON_TEACHING_TYPES.includes(editingRoom.type)}
								/>
							</div>
						</div>
					)}

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setEditingRoom(null)} disabled={savingRoom}>
							Cancel
						</Button>
						<Button type="button" onClick={() => void handleSaveRoomEdit()} disabled={savingRoom || !editingRoom?.name.trim()}>
							{savingRoom ? 'Saving...' : 'Save changes'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

/* ─── Sortable room tile (editor) ─── */
function SortableRoomTile({
	room,
	showTeachingToggle,
	onToggleTeaching,
	onEdit,
	onDelete,
}: {
	room: Room;
	showTeachingToggle: boolean;
	onToggleTeaching: () => void;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: room.id });
	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<li
			ref={setNodeRef}
			style={style}
			className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${
				room.isTeachingSpace
					? 'border-border bg-muted/50'
					: 'border-amber-200 bg-amber-50/50'
			}`}
		>
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				{...attributes}
				{...listeners}
				className="shrink-0 cursor-grab touch-none text-muted-foreground/60 active:cursor-grabbing"
			>
				<GripVertical className="size-3.5" />
			</Button>
			<span className={`size-1.5 shrink-0 rounded-full ${room.isTeachingSpace ? 'bg-primary' : 'bg-amber-500'}`} />
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-medium">{room.name}</p>
				<div className="flex items-center gap-1.5 mt-0.5">
					<Badge variant="outline" className="text-[0.6rem] px-1 py-0">
						{ROOM_TYPES.find((t) => t.value === room.type)?.label ?? room.type}
					</Badge>
					{room.capacity != null && room.capacity > 0 && (
						<span className="text-[0.6875rem] text-muted-foreground">
							Cap: {room.capacity}
						</span>
					)}
					{!room.isTeachingSpace && (
						<Badge className="bg-amber-100 text-amber-700 text-[0.55rem] px-1 py-0">
							Non-teaching
						</Badge>
					)}
				</div>
			</div>
			<div className="flex shrink-0 items-center gap-1">
				{showTeachingToggle && (
					<Button type="button" variant="outline" size="xs" onClick={onToggleTeaching}>
						{room.isTeachingSpace ? 'Exclude' : 'Teach'}
					</Button>
				)}
				<Button type="button" variant="outline" size="xs" onClick={onEdit}>
					<PencilLine className="size-3.5" />
					Edit
				</Button>
				<Button type="button" variant="destructive" size="xs" onClick={onDelete}>
					<Trash2 className="size-3.5" />
					Delete
				</Button>
			</div>
		</li>
	);
}

/* ─── Read-only room tile (dashboard) ─── */
function RoomTileReadOnly({ room }: { room: Room }) {
	return (
		<li
			className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${
				room.isTeachingSpace
					? 'border-border bg-muted/50'
					: 'border-amber-200 bg-amber-50/50'
			}`}
		>
			<span className={`size-1.5 shrink-0 rounded-full ${room.isTeachingSpace ? 'bg-primary' : 'bg-amber-500'}`} />
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-medium">{room.name}</p>
				<div className="flex items-center gap-1.5 mt-0.5">
					<Badge variant="outline" className="text-[0.6rem] px-1 py-0">
						{ROOM_TYPES.find((t) => t.value === room.type)?.label ?? room.type}
					</Badge>
					{room.capacity != null && room.capacity > 0 && (
						<span className="text-[0.6875rem] text-muted-foreground">
							Cap: {room.capacity}
						</span>
					)}
					{!room.isTeachingSpace && (
						<Badge className="bg-amber-100 text-amber-700 text-[0.55rem] px-1 py-0">
							Non-teaching
						</Badge>
					)}
				</div>
			</div>
		</li>
	);
}
