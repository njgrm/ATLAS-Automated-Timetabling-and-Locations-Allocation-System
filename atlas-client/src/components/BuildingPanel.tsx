import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';

import atlasApi from '@/lib/api';
import type { Building, Room, RoomType } from '@/types';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Badge } from '@/ui/badge';

type EditorBuilding = Building & { dirty?: boolean; isNew?: boolean };

type BuildingPanelProps = {
	building: EditorBuilding;
	onUpdate: (updates: Partial<EditorBuilding>) => void;
	onDelete: () => void;
	onClose: () => void;
	onRoomAdded: (room: Room) => void;
	onRoomDeleted: (roomId: number) => void;
};

const ROOM_TYPES: { value: RoomType; label: string }[] = [
	{ value: 'CLASSROOM', label: 'Classroom' },
	{ value: 'LABORATORY', label: 'Laboratory' },
	{ value: 'COMPUTER_LAB', label: 'Computer Lab' },
	{ value: 'LIBRARY', label: 'Library' },
	{ value: 'GYMNASIUM', label: 'Gymnasium' },
	{ value: 'FACULTY_ROOM', label: 'Faculty Room' },
	{ value: 'OFFICE', label: 'Office' },
	{ value: 'OTHER', label: 'Other' },
];

const COLORS = ['#2563eb', '#059669', '#ea580c', '#7c3aed', '#dc2626', '#0891b2', '#ca8a04', '#4f46e5', '#be185d', '#374151'];

export function BuildingPanel({
	building,
	onUpdate,
	onDelete,
	onClose,
	onRoomAdded,
	onRoomDeleted,
}: BuildingPanelProps) {
	const [newRoomName, setNewRoomName] = useState('');
	const [newRoomFloor, setNewRoomFloor] = useState(1);
	const [newRoomType, setNewRoomType] = useState<RoomType>('CLASSROOM');
	const [newRoomCapacity, setNewRoomCapacity] = useState('');
	const [addingRoom, setAddingRoom] = useState(false);
	const [deleting, setDeleting] = useState(false);

	const handleAddRoom = async () => {
		if (!newRoomName.trim()) return;

		// If the building hasn't been saved yet (temp id), can't add rooms
		if (building.isNew) return;

		setAddingRoom(true);
		try {
			const { data } = await atlasApi.post(`/map/buildings/${building.id}/rooms`, {
				name: newRoomName.trim(),
				floor: newRoomFloor,
				type: newRoomType,
				capacity: newRoomCapacity ? Number(newRoomCapacity) : null,
			});
			onRoomAdded(data.room);
			setNewRoomName('');
			setNewRoomCapacity('');
		} catch (err) {
			console.error('Failed to add room:', err);
		} finally {
			setAddingRoom(false);
		}
	};

	const handleDeleteRoom = async (roomId: number) => {
		try {
			await atlasApi.delete(`/map/rooms/${roomId}`);
			onRoomDeleted(roomId);
		} catch (err) {
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
			onDelete();
		} catch (err) {
			console.error('Failed to delete building:', err);
		} finally {
			setDeleting(false);
		}
	};

	return (
		<div className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-card">
			{/* Header */}
			<div className="flex items-center justify-between border-b border-border px-4 py-3">
				<h3 className="text-sm font-bold">Building Details</h3>
				<button
					onClick={onClose}
					className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
				>
					<X className="size-4" />
				</button>
			</div>

			<div className="flex-1 overflow-auto px-4 py-3 space-y-4">
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

				{/* Color */}
				<div>
					<label className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
						Color
					</label>
					<div className="mt-1.5 flex flex-wrap gap-1.5">
						{COLORS.map((c) => (
							<button
								key={c}
								onClick={() => onUpdate({ color: c, dirty: true })}
								className={`size-7 rounded-md border-2 transition-all ${
									building.color === c ? 'border-foreground scale-110' : 'border-transparent'
								}`}
								style={{ backgroundColor: c }}
							/>
						))}
					</div>
				</div>

				{/* Position (read-only) */}
				<div className="grid grid-cols-2 gap-2">
					<div>
						<label className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
							X
						</label>
						<Input value={Math.round(building.x)} className="mt-1" readOnly />
					</div>
					<div>
						<label className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
							Y
						</label>
						<Input value={Math.round(building.y)} className="mt-1" readOnly />
					</div>
				</div>
				<div className="grid grid-cols-2 gap-2">
					<div>
						<label className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
							Width
						</label>
						<Input value={Math.round(building.width)} className="mt-1" readOnly />
					</div>
					<div>
						<label className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
							Height
						</label>
						<Input value={Math.round(building.height)} className="mt-1" readOnly />
					</div>
				</div>

				{/* Rooms */}
				<div>
					<div className="flex items-center justify-between">
						<label className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
							Rooms ({building.rooms.length})
						</label>
					</div>

					{building.rooms.length > 0 ? (
						<ul className="mt-2 space-y-1.5">
							{building.rooms.map((room) => (
								<li
									key={room.id}
									className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-2.5 py-1.5"
								>
									<span className="size-1.5 shrink-0 rounded-full bg-primary" />
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium">{room.name}</p>
										<div className="flex items-center gap-1.5 mt-0.5">
											<Badge variant="outline" className="text-[0.6rem] px-1 py-0">
												{ROOM_TYPES.find((t) => t.value === room.type)?.label ?? room.type}
											</Badge>
											{room.capacity && (
												<span className="text-[0.6875rem] text-muted-foreground">
													Cap: {room.capacity}
												</span>
											)}
										</div>
									</div>
									<button
										onClick={() => handleDeleteRoom(room.id)}
										className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
									>
										<Trash2 className="size-3.5" />
									</button>
								</li>
							))}
						</ul>
					) : (
						<p className="mt-2 text-[0.8125rem] text-muted-foreground">
							{building.isNew
								? 'Save the building first to add rooms.'
								: 'No rooms yet. Add one below.'}
						</p>
					)}

					{/* Add room form */}
					{!building.isNew && (
						<div className="mt-3 space-y-2 rounded-md border border-dashed border-border p-2.5">
							<Input
								placeholder="Room name"
								value={newRoomName}
								onChange={(e) => setNewRoomName(e.target.value)}
							/>
							<div className="grid grid-cols-2 gap-2">
								<div>
									<label className="text-[0.6rem] text-muted-foreground">Floor</label>
									<Input
										type="number"
										min={1}
										value={newRoomFloor}
										onChange={(e) => setNewRoomFloor(Number(e.target.value))}
									/>
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
								<label className="text-[0.6rem] text-muted-foreground">Type</label>
								<select
									value={newRoomType}
									onChange={(e) => setNewRoomType(e.target.value as RoomType)}
									className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
								>
									{ROOM_TYPES.map((t) => (
										<option key={t.value} value={t.value}>
											{t.label}
										</option>
									))}
								</select>
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

			{/* Footer actions */}
			<div className="border-t border-border px-4 py-3">
				<Button
					variant="destructive"
					size="sm"
					className="w-full"
					onClick={handleDeleteBuilding}
					disabled={deleting}
				>
					<Trash2 className="size-3.5" />
					{deleting ? 'Deleting...' : 'Delete Building'}
				</Button>
			</div>
		</div>
	);
}
