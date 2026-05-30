import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Maximize2 } from 'lucide-react';

import atlasApi from '@/lib/api';
import { resolveActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import type { RoomScheduleView } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Skeleton } from '@/ui/skeleton';

const DEFAULT_SCHOOL_ID = 1;

const DAY_SHORT: Record<string, string> = {
	MONDAY: 'M',
	TUESDAY: 'T',
	WEDNESDAY: 'W',
	THURSDAY: 'Th',
	FRIDAY: 'F',
};

export function RoomSchedulePreview({
	roomId,
	isTeachingSpace,
	onExpandSchedule,
}: {
	roomId: number;
	isTeachingSpace: boolean;
	onExpandSchedule?: (schedule: RoomScheduleView) => void;
}) {
	const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'empty' | 'error'>('idle');
	const [schedule, setSchedule] = useState<RoomScheduleView | null>(null);

	useEffect(() => {
		if (!isTeachingSpace) return;
		let cancelled = false;
		setState('loading');

		(async () => {
			try {
				const context = await resolveActiveSchoolYearContext({ allowStaleOnError: true, allowEnrollProFallback: false });
				if (!context.activeSchoolYearId || cancelled) return;
				const { data } = await atlasApi.get<RoomScheduleView>(
					`/room-schedules/${DEFAULT_SCHOOL_ID}/${context.activeSchoolYearId}/rooms/${roomId}?source=latest`,
				);
				if (cancelled) return;
				setSchedule(data);
				setState('ok');
			} catch {
				if (!cancelled) setState('empty');
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [roomId, isTeachingSpace]);

	if (!isTeachingSpace) {
		return (
			<div className="mt-4 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2.5">
				<p className="text-[0.6875rem] text-muted-foreground/60 italic">Non-teaching room — no schedule</p>
			</div>
		);
	}

	if (state === 'loading' || state === 'idle') {
		return <Skeleton className="mt-4 h-16 w-full rounded-md" />;
	}

	if (state === 'empty' || !schedule) {
		return (
			<div className="mt-4 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2.5">
				<p className="text-xs font-medium text-muted-foreground">Room schedule</p>
				<p className="mt-1 text-[0.6875rem] text-muted-foreground/60 italic">No schedule attempts yet</p>
			</div>
		);
	}

	return (
		<div className="mt-4 space-y-2">
			<div className="flex items-center justify-between">
				<p className="text-xs font-medium text-muted-foreground">Room schedule</p>
				<Badge variant="outline" className="text-[0.5625rem] px-1 py-0">
					{schedule.summary.utilizationPercent}% util
				</Badge>
			</div>
			<div className="flex gap-1">
				{schedule.days.map((day, dayIdx) => {
					const slotCount = schedule.grid.reduce(
						(sum, row) => sum + (row.cells[dayIdx]?.occupied ? 1 : 0),
						0,
					);
					return (
						<div
							key={day}
							className={`flex-1 rounded border text-center py-1 text-[0.625rem] ${
								slotCount > 0
									? 'border-primary/30 bg-primary/5 text-foreground font-medium'
									: 'border-border bg-muted/30 text-muted-foreground'
							}`}
						>
							<div>{DAY_SHORT[day] ?? day}</div>
							<div className="text-[0.5625rem] opacity-70">{slotCount}/{schedule.grid.length}</div>
						</div>
					);
				})}
			</div>
			<div className="flex items-center justify-between text-[0.625rem] text-muted-foreground">
				<span>{schedule.summary.entryCount} entries</span>
				{schedule.summary.conflictCount > 0 && (
					<span className="text-red-600 font-medium">{schedule.summary.conflictCount} conflicts</span>
				)}
			</div>
			{onExpandSchedule && (
				<Button
					variant="default"
					size="sm"
					className="w-full h-6 text-[0.625rem]"
					onClick={() => onExpandSchedule(schedule)}
				>
					<Maximize2 className="size-3 mr-1" />
					Expand full schedule
				</Button>
			)}
			<Button asChild variant="outline" size="sm" className="w-full h-6 text-[0.625rem]">
				<Link to={`/room-schedules?roomId=${roomId}&source=latest`}>View full schedule</Link>
			</Button>
		</div>
	);
}
