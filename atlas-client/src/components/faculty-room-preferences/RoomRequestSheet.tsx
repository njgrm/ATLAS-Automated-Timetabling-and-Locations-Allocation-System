import { useEffect, useMemo, useState } from 'react';
import { Building2, List, Loader2, MapPinned, Move, Search, Send, Shuffle, TimerReset } from 'lucide-react';

import { formatTime } from '@/lib/utils';
import type {
	Building,
	DayOfWeek,
	FacultyRoomPreferenceEntry,
	PreviewResult,
	Room,
	RoomPreferenceActionType,
} from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Separator } from '@/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs';
import ConflictInspector from '@/components/faculty-shared/ConflictInspector';

type RoomOption = Room & { buildingName: string };

type SlotTarget = {
	day: DayOfWeek;
	startTime: string;
	endTime: string;
	targetEntryId: string | null;
};

type RoomPickerMode = 'LIST' | 'BUILDING' | 'MAP';

type RoomRequestSheetProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	selectedEntry: FacultyRoomPreferenceEntry | null;
	targetSlot: SlotTarget | null;
	actionType: RoomPreferenceActionType;
	onActionTypeChange: (value: RoomPreferenceActionType) => void;
	requestedRoomId: string;
	onRequestedRoomIdChange: (value: string) => void;
	requestRoomSearch: string;
	onRequestRoomSearchChange: (value: string) => void;
	requestRoomOptions: RoomOption[];
	buildings: Building[];
	campusImageUrl: string | null;
	reason: string;
	onReasonChange: (value: string) => void;
	reasonRequired: boolean;
	previewLoading: boolean;
	requestPreview: PreviewResult | null;
	submitting: boolean;
	onSubmit: () => void;
};

function mapBounds(buildings: Building[]) {
	if (buildings.length === 0) {
		return { minX: 0, minY: 0, width: 100, height: 100 };
	}
	const minX = Math.min(...buildings.map((building) => building.x));
	const minY = Math.min(...buildings.map((building) => building.y));
	const maxX = Math.max(...buildings.map((building) => building.x + building.width));
	const maxY = Math.max(...buildings.map((building) => building.y + building.height));
	return {
		minX,
		minY,
		width: Math.max(1, maxX - minX),
		height: Math.max(1, maxY - minY),
	};
}

export default function RoomRequestSheet({
	open,
	onOpenChange,
	selectedEntry,
	targetSlot,
	actionType,
	onActionTypeChange,
	requestedRoomId,
	onRequestedRoomIdChange,
	requestRoomSearch,
	onRequestRoomSearchChange,
	requestRoomOptions,
	buildings,
	campusImageUrl,
	reason,
	onReasonChange,
	reasonRequired,
	previewLoading,
	requestPreview,
	submitting,
	onSubmit,
}: RoomRequestSheetProps) {
	const [roomPickerMode, setRoomPickerMode] = useState<RoomPickerMode>('LIST');
	const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);

	const roomsByBuilding = useMemo(() => {
		const map = new Map<number, RoomOption[]>();
		for (const room of requestRoomOptions) {
			const rows = map.get(room.buildingId) ?? [];
			rows.push(room);
			map.set(room.buildingId, rows);
		}
		for (const rows of map.values()) {
			rows.sort((left, right) => left.name.localeCompare(right.name) || left.floor - right.floor);
		}
		return map;
	}, [requestRoomOptions]);

	const buildingsWithRooms = useMemo(() => {
		return buildings
			.map((building) => ({
				...building,
				rooms: roomsByBuilding.get(building.id) ?? [],
			}))
			.filter((building) => building.rooms.length > 0)
			.sort((left, right) => left.name.localeCompare(right.name));
	}, [buildings, roomsByBuilding]);

	useEffect(() => {
		if (buildingsWithRooms.length === 0) {
			setSelectedBuildingId(null);
			return;
		}
		setSelectedBuildingId((current) => {
			if (current && buildingsWithRooms.some((building) => building.id === current)) {
				return current;
			}
			return buildingsWithRooms[0]?.id ?? null;
		});
	}, [buildingsWithRooms]);

	const selectedBuilding = useMemo(
		() => buildingsWithRooms.find((building) => building.id === selectedBuildingId) ?? null,
		[buildingsWithRooms, selectedBuildingId],
	);

	const bounds = useMemo(() => mapBounds(buildingsWithRooms), [buildingsWithRooms]);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side='bottom' className='h-[88dvh] overflow-auto rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+0.5rem)]' data-tutorial='room-request-sheet'>
				<SheetHeader>
					<SheetTitle>Request a Room Change</SheetTitle>
					<SheetDescription>Step 3: Review your request, pick a room, then submit for scheduler approval.</SheetDescription>
				</SheetHeader>

				<div className='mt-4 space-y-4'>
					{selectedEntry && (
						<div className='rounded-xl border border-border bg-muted/30 p-3'>
							<p className='text-xs font-medium text-muted-foreground'>Selected class</p>
							<p className='mt-1 text-sm font-semibold text-foreground'>{selectedEntry.subjectDisplayLabel ?? selectedEntry.subjectCode} · {selectedEntry.sectionName}</p>
							<p className='text-xs text-muted-foreground'>{selectedEntry.day.slice(0, 3)} {formatTime(selectedEntry.startTime)} - {formatTime(selectedEntry.endTime)} · {selectedEntry.currentRoomName}</p>
						</div>
					)}

					<div className='grid gap-3 sm:grid-cols-2'>
						<div className='space-y-2'>
							<Label>What do you want to change?</Label>
							<Select value={actionType} onValueChange={(value) => onActionTypeChange(value as RoomPreferenceActionType)}>
								<SelectTrigger><SelectValue /></SelectTrigger>
								<SelectContent>
									<SelectItem value='MOVE_TO_EMPTY_SLOT'><Move className='mr-2 inline size-4' />Move my class to a free time slot</SelectItem>
									<SelectItem value='SWAP_WITH_OCCUPIED'><Shuffle className='mr-2 inline size-4' />Swap time slots with another class</SelectItem>
									<SelectItem value='ROOM_CHANGE'><TimerReset className='mr-2 inline size-4' />Change my classroom only</SelectItem>
									<SelectItem value='TIME_AND_ROOM_CHANGE'><Send className='mr-2 inline size-4' />Change both time and classroom</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className='space-y-2'>
							<Label>Find a room</Label>
							<div className='flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2'>
								<Search className='size-4 text-muted-foreground' />
								<Input
									value={requestRoomSearch}
									onChange={(event) => onRequestRoomSearchChange(event.target.value)}
									placeholder='Search by room or building name'
									className='h-8 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0'
								/>
							</div>
						</div>
					</div>

					<div className='space-y-3 rounded-xl border border-border bg-muted/20 p-3' data-tutorial='room-picker-modes'>
						<div className='flex items-center justify-between gap-2'>
							<p className='text-xs font-semibold text-foreground'>Pick a room using your preferred view</p>
							{requestedRoomId && <Badge variant='outline'>Room selected</Badge>}
						</div>
						<Tabs value={roomPickerMode} onValueChange={(value) => setRoomPickerMode(value as RoomPickerMode)}>
							<TabsList className='grid h-auto grid-cols-3'>
								<TabsTrigger value='LIST' className='gap-1.5'><List className='size-3.5' />List</TabsTrigger>
								<TabsTrigger value='BUILDING' className='gap-1.5'><Building2 className='size-3.5' />Building</TabsTrigger>
								<TabsTrigger value='MAP' className='gap-1.5'><MapPinned className='size-3.5' />Map</TabsTrigger>
							</TabsList>

							<TabsContent value='LIST' className='space-y-2'>
								<div className='max-h-48 space-y-2 overflow-auto pr-1'>
									{requestRoomOptions.map((room) => (
										<Button
											type='button'
											key={`request-room-list-${room.id}`}
											variant={requestedRoomId === String(room.id) ? 'default' : 'outline'}
											className='h-auto w-full justify-start px-3 py-2 text-left'
											onClick={() => onRequestedRoomIdChange(String(room.id))}
										>
											<div>
												<p className='text-sm font-medium'>{room.name}</p>
												<p className='text-xs opacity-80'>{room.buildingName} · Floor {room.floor}</p>
											</div>
										</Button>
									))}
									{requestRoomOptions.length === 0 && (
										<div className='rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground'>No rooms match your search.</div>
									)}
								</div>
							</TabsContent>

							<TabsContent value='BUILDING' className='space-y-2'>
								<div className='max-h-56 space-y-2 overflow-auto pr-1'>
									{buildingsWithRooms.map((building) => (
										<div key={`request-building-${building.id}`} className='rounded-lg border border-border bg-background p-2'>
											<p className='px-1 text-xs font-semibold text-foreground'>{building.shortCode ?? building.name}</p>
											<div className='mt-2 flex flex-wrap gap-2'>
												{building.rooms.map((room) => (
													<Button
														type='button'
														key={`request-building-room-${room.id}`}
														variant={requestedRoomId === String(room.id) ? 'default' : 'outline'}
														size='sm'
														onClick={() => onRequestedRoomIdChange(String(room.id))}
													>
														{room.name}
													</Button>
												))}
											</div>
										</div>
									))}
									{buildingsWithRooms.length === 0 && (
										<div className='rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground'>No building rooms match your search.</div>
									)}
								</div>
							</TabsContent>

							<TabsContent value='MAP' className='space-y-3'>
								{!campusImageUrl && buildingsWithRooms.length === 0 ? (
									<div className='rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground'>
										<p className='font-medium'>No campus map available.</p>
										<p className='mt-1'>Ask your IT admin to upload a campus map in the Map Editor.</p>
									</div>
								) : (
									<>
										<div
											className='overflow-auto rounded-xl border border-border bg-slate-50'
											style={{ height: '14rem', touchAction: 'pan-x pan-y' }}
										>
											<div
												className='relative'
												style={{
													width: '600px',
													height: '400px',
													backgroundImage: campusImageUrl ? `url(${campusImageUrl})` : undefined,
													backgroundSize: 'cover',
													backgroundPosition: 'center',
												}}
											>
												{buildingsWithRooms.map((building) => {
													const MAP_W = 600;
													const MAP_H = 400;
													const left = ((building.x - bounds.minX) / bounds.width) * MAP_W;
													const top = ((building.y - bounds.minY) / bounds.height) * MAP_H;
													const width = Math.max(60, (building.width / bounds.width) * MAP_W);
													const height = Math.max(44, (building.height / bounds.height) * MAP_H);
													const isActive = selectedBuildingId === building.id;
													return (
														<button
															type='button'
															key={`request-map-building-${building.id}`}
															aria-label={`Select ${building.shortCode ?? building.name}`}
															onClick={() => setSelectedBuildingId(building.id)}
															className={`absolute flex items-center justify-center rounded-md border font-semibold text-white shadow transition-all ${isActive ? 'border-white ring-2 ring-sky-400 shadow-lg' : 'border-white/70 hover:ring-1 hover:ring-white/60'}`}
															style={{
																left: `${Math.min(540, left)}px`,
																top: `${Math.min(356, top)}px`,
																width: `${Math.min(160, width)}px`,
																height: `${Math.min(100, height)}px`,
																backgroundColor: building.color,
																fontSize: '11px',
															}}
														>
															<span className='px-1 text-center leading-tight line-clamp-2'>
																{building.shortCode ?? building.name}
															</span>
														</button>
													);
												})}
												{buildingsWithRooms.length === 0 && (
													<div className='flex h-full items-center justify-center text-sm text-muted-foreground'>
														No buildings match your search.
													</div>
												)}
											</div>
										</div>
										<div className='space-y-2 rounded-lg border border-border bg-background p-2'>
											<p className='text-xs font-semibold text-foreground'>
												{selectedBuilding ? `Rooms in ${selectedBuilding.shortCode ?? selectedBuilding.name}` : 'Tap a building on the map above'}
											</p>
											<div className='flex max-h-32 flex-wrap gap-2 overflow-auto pr-1'>
												{selectedBuilding?.rooms.map((room) => (
													<Button
														type='button'
														key={`request-map-room-${room.id}`}
														variant={requestedRoomId === String(room.id) ? 'default' : 'outline'}
														size='sm'
														onClick={() => onRequestedRoomIdChange(String(room.id))}
													>
														{room.name}
													</Button>
												))}
												{!selectedBuilding && (
													<p className='text-xs text-muted-foreground px-1'>Select a building first.</p>
												)}
											</div>
										</div>
									</>
								)}
							</TabsContent>
						</Tabs>
					</div>

					<Select value={requestedRoomId} onValueChange={onRequestedRoomIdChange}>
						<SelectTrigger><SelectValue placeholder='Keep current room' /></SelectTrigger>
						<SelectContent>
							{requestRoomOptions.map((room) => (
								<SelectItem key={`request-room-select-${room.id}`} value={String(room.id)}>{room.name} · {room.buildingName}</SelectItem>
							))}
						</SelectContent>
					</Select>

					<div className='rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground'>
						{targetSlot
							? `Target slot: ${targetSlot.day.slice(0, 3)} ${formatTime(targetSlot.startTime)} - ${formatTime(targetSlot.endTime)} ${targetSlot.targetEntryId ? '(occupied)' : '(empty)'}`
							: 'Select a target slot from the schedule grid.'}
					</div>

					<Separator />

					<ConflictInspector
						previewLoading={previewLoading}
						preview={requestPreview}
						reasonRequired={reasonRequired}
						reason={reason}
						onReasonChange={onReasonChange}
					/>

					<div className='rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900'>
						Requests with conflicts are reviewed by the scheduling officer. They are not auto-rejected.
					</div>

					<div className='flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
						<Button variant='outline' className='sm:w-auto' onClick={() => onOpenChange(false)}>Cancel</Button>
						<Button
							className='sm:w-auto'
							onClick={onSubmit}
							disabled={submitting || !selectedEntry || !targetSlot || (reasonRequired && !reason.trim())}
						>
							{submitting ? <Loader2 className='mr-1.5 size-4 animate-spin' /> : <Send className='mr-1.5 size-4' />}
							Submit request
						</Button>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
