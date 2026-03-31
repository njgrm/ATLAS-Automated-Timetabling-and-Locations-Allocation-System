import { useMemo, useState } from 'react';
import { AlertTriangle, DoorOpen, Users, X } from 'lucide-react';

import type { Building, Room, RoomType } from '@/types';
import { Badge } from '@/ui/badge';

/* ─── Room-type color tokens ─── */
const ROOM_COLORS: Record<RoomType, { bg: string; border: string; text: string }> = {
	CLASSROOM: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
	LABORATORY: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700' },
	COMPUTER_LAB: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
	TLE_WORKSHOP: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
	LIBRARY: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
	GYMNASIUM: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
	FACULTY_ROOM: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
	OFFICE: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600' },
	OTHER: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600' },
};

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
	CLASSROOM: 'Classroom',
	LABORATORY: 'Lab',
	COMPUTER_LAB: 'ICT Lab',
	TLE_WORKSHOP: 'TLE',
	LIBRARY: 'Library',
	GYMNASIUM: 'Gym',
	FACULTY_ROOM: 'Faculty',
	OFFICE: 'Office',
	OTHER: 'Other',
};

type BuildingViewProps = {
	building: Building;
};

export function BuildingView({ building }: BuildingViewProps) {
	const [inspectedRoom, setInspectedRoom] = useState<Room | null>(null);

	const floorMap = useMemo(() => {
		const map = new Map<number, Room[]>();
		for (const room of building.rooms) {
			const existing = map.get(room.floor) ?? [];
			existing.push(room);
			map.set(room.floor, existing);
		}
		// Sort rooms within each floor by position
		for (const [, rooms] of map) {
			rooms.sort((a, b) => a.floorPosition - b.floorPosition);
		}
		return map;
	}, [building.rooms]);

	// Floors in descending order (top floor first)
	const floors = useMemo(
		() => Array.from({ length: building.floorCount }, (_, i) => building.floorCount - i),
		[building.floorCount],
	);

	if (building.rooms.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
				<DoorOpen className="size-8 text-muted-foreground/30" />
				<p className="mt-2 text-sm">No rooms configured.</p>
			</div>
		);
	}

	return (
		<div className="relative">
			{/* Floor plan */}
			<div className="space-y-px rounded-lg border border-border overflow-hidden bg-border">
				{floors.map((floor) => {
					const rooms = floorMap.get(floor) ?? [];
					return (
						<div key={floor} className="flex bg-background">
							{/* Floor label */}
							<div className="flex w-7 shrink-0 items-center justify-center border-r border-border bg-muted/50">
								<span className="text-[0.6rem] font-bold text-muted-foreground [writing-mode:vertical-lr] rotate-180">
									F{floor}
								</span>
							</div>
							{/* Rooms */}
							<div className="flex flex-1 gap-px bg-border min-h-11">
								{rooms.length === 0 ? (
									<div className="flex flex-1 items-center justify-center bg-background px-2">
										<span className="text-[0.625rem] text-muted-foreground/50 italic">Empty</span>
									</div>
								) : (
									rooms.map((room) => {
										const colors = ROOM_COLORS[room.type] ?? ROOM_COLORS.OTHER;
										const isInspected = inspectedRoom?.id === room.id;
										return (
											<button
												key={room.id}
												onClick={() => setInspectedRoom(isInspected ? null : room)}
												className={`flex flex-1 flex-col items-center justify-center px-1 py-1.5 transition-all text-left ${colors.bg} ${
													isInspected ? `ring-2 ring-primary ring-inset ${colors.bg}` : `hover:brightness-95`
												}`}
											>
												<span className={`text-[0.625rem] font-semibold truncate w-full text-center ${colors.text}`}>
													{room.name}
												</span>
												<span className="text-[0.5rem] text-muted-foreground truncate w-full text-center">
													{ROOM_TYPE_LABELS[room.type]}
												</span>
											</button>
										);
									})
								)}
							</div>
						</div>
					);
				})}
			</div>

			{/* Room detail popover */}
			{inspectedRoom && (
				<div className="mt-2 rounded-lg border border-border bg-background p-3 shadow-sm animate-in fade-in-0 slide-in-from-top-1 duration-150">
					<div className="flex items-start justify-between">
						<div className="flex items-center gap-2 min-w-0">
							<div className={`size-2.5 rounded-sm ${ROOM_COLORS[inspectedRoom.type]?.bg ?? 'bg-muted'} border ${ROOM_COLORS[inspectedRoom.type]?.border ?? 'border-border'}`} />
							<span className="text-sm font-semibold truncate">{inspectedRoom.name}</span>
							<Badge variant="outline" className="text-[0.6rem] px-1.5 py-0 shrink-0">
								{ROOM_TYPE_LABELS[inspectedRoom.type]}
							</Badge>
						</div>
						<button
							onClick={() => setInspectedRoom(null)}
							className="text-muted-foreground hover:text-foreground -mt-0.5 -mr-1 p-0.5"
						>
							<X className="size-3.5" />
						</button>
					</div>
					<div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[0.6875rem]">
						<div className="text-muted-foreground">Floor</div>
						<div className="font-medium">{inspectedRoom.floor}</div>
						<div className="text-muted-foreground">Capacity</div>
						<div className="font-medium flex items-center gap-1">
							{inspectedRoom.capacity != null ? (
								<><Users className="size-3" /> {inspectedRoom.capacity}</>
							) : (
								<span className="text-muted-foreground/60">—</span>
							)}
						</div>
						<div className="text-muted-foreground">Teaching space</div>
						<div className="font-medium">
							{inspectedRoom.isTeachingSpace ? (
								<span className="text-emerald-600">Yes</span>
							) : (
								<span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="size-3" /> No</span>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
