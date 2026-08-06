import { AlertTriangle, CheckCircle2, CircleSlash2, DoorOpen } from 'lucide-react';

import type { Building, Room } from '@/types';
import { Badge } from '@/ui/badge';

export type RoomReadinessStatus = 'ready' | 'needs-capacity' | 'needs-room-type' | 'needs-section' | 'unavailable';

type RoomReadinessListProps = {
	buildings: Building[];
	roomOccupancy?: Map<number, string>;
	compact?: boolean;
};

function getRoomStatus(room: Room, roomOccupancy?: Map<number, string>): RoomReadinessStatus {
	if (!room.isTeachingSpace) return 'unavailable';
	if (!room.capacity || room.capacity <= 0) return 'needs-capacity';
	if (room.type === 'OTHER') return 'needs-room-type';
	if (roomOccupancy && !roomOccupancy.has(room.id)) return 'needs-section';
	return 'ready';
}

const STATUS_COPY: Record<RoomReadinessStatus, { label: string; className: string }> = {
	ready: { label: 'Ready', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
	'needs-capacity': { label: 'Needs capacity', className: 'border-amber-200 bg-amber-50 text-amber-700' },
	'needs-room-type': { label: 'Needs room type', className: 'border-amber-200 bg-amber-50 text-amber-700' },
	'needs-section': { label: 'Needs section', className: 'border-sky-200 bg-sky-50 text-sky-700' },
	unavailable: { label: 'Unavailable', className: 'border-slate-200 bg-slate-100 text-slate-600' },
};

function StatusIcon({ status }: { status: RoomReadinessStatus }) {
	if (status === 'ready') return <CheckCircle2 className="size-3.5" aria-hidden="true" />;
	if (status === 'unavailable') return <CircleSlash2 className="size-3.5" aria-hidden="true" />;
	return <AlertTriangle className="size-3.5" aria-hidden="true" />;
}

export function RoomReadinessList({ buildings, roomOccupancy, compact = false }: RoomReadinessListProps) {
	const rooms = buildings.flatMap((building) =>
		(building.rooms ?? []).map((room) => ({ building, room, status: getRoomStatus(room, roomOccupancy) })),
	);
	const counts = rooms.reduce<Record<RoomReadinessStatus, number>>(
		(acc, item) => ({ ...acc, [item.status]: acc[item.status] + 1 }),
		{ ready: 0, 'needs-capacity': 0, 'needs-room-type': 0, 'needs-section': 0, unavailable: 0 },
	);

	return (
		<section data-testid="room-readiness-list" aria-labelledby="room-readiness-title" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<div className="flex items-center gap-2">
						<DoorOpen className="size-4 text-primary" aria-hidden="true" />
						<h2 id="room-readiness-title" className="text-sm font-bold text-slate-900">Room readiness</h2>
					</div>
					<p className="mt-1 text-xs text-slate-500">Fix the items marked for attention before generating.</p>
				</div>
				<div className="flex flex-wrap gap-1.5" aria-label="Room readiness totals">
					{(Object.keys(STATUS_COPY) as RoomReadinessStatus[]).map((status) => counts[status] > 0 ? (
						<Badge key={status} variant="outline" className={`gap-1 ${STATUS_COPY[status].className}`}>
							<StatusIcon status={status} /> {counts[status]} {STATUS_COPY[status].label}
						</Badge>
					) : null)}
				</div>
			</div>
			{rooms.length === 0 ? (
				<p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No rooms yet. Open Edit campus map to add the first teaching room.</p>
			) : (
				<div className={`mt-4 grid gap-2 ${compact ? 'max-h-44 overflow-auto pr-1 sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
					{rooms.map(({ building, room, status }) => {
						const copy = STATUS_COPY[status];
						return (
							<div key={room.id} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2" data-room-status={status}>
								<div className="min-w-0">
									<p className="truncate text-xs font-semibold text-slate-800">{room.name}</p>
									<p className="truncate text-[11px] text-slate-500">{building.name} · {room.capacity ? `${room.capacity} seats` : 'Capacity missing'}</p>
								</div>
								<Badge variant="outline" className={`shrink-0 gap-1 text-[11px] ${copy.className}`}><StatusIcon status={status} />{copy.label}</Badge>
							</div>
						);
					})}
				</div>
			)}
		</section>
	);
}
