import { useMemo, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Clock } from 'lucide-react';
import { formatTime } from '@/lib/utils';
import type { DayOfWeek, FacultyRoomPreferenceEntry } from '@/types';
import { Badge } from '@/ui/badge';

type WeeklyScheduleGridProps = {
	entries: FacultyRoomPreferenceEntry[];
	renderEntryBadge?: (entry: FacultyRoomPreferenceEntry) => React.ReactNode;
	onEntryClick?: (entry: FacultyRoomPreferenceEntry) => void;
	selectedEntryId?: string | null;
};

const DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

export default function WeeklyScheduleGrid({
	entries,
	renderEntryBadge,
	onEntryClick,
	selectedEntryId,
}: WeeklyScheduleGridProps) {
	const [now, setNow] = useState(new Date());

	useEffect(() => {
		const interval = setInterval(() => setNow(new Date()), 60000);
		return () => clearInterval(interval);
	}, []);

	const currentDay = useMemo(() => {
		const dayMap: Record<number, DayOfWeek> = {
			1: 'MONDAY',
			2: 'TUESDAY',
			3: 'WEDNESDAY',
			4: 'THURSDAY',
			5: 'FRIDAY',
		};
		return dayMap[now.getDay()] || null;
	}, [now]);

	const currentTimeStr = useMemo(() => {
		return now.toTimeString().slice(0, 5);
	}, [now]);

	const timeSlots = useMemo(() => {
		const unique = new Map<string, { start: string; end: string }>();
		entries.forEach((e) => {
			const key = `${e.startTime}-${e.endTime}`;
			unique.set(key, { start: e.startTime, end: e.endTime });
		});
		return Array.from(unique.values()).sort((a, b) => a.start.localeCompare(b.start));
	}, [entries]);

	const entriesBySlot = useMemo(() => {
		const map = new Map<string, FacultyRoomPreferenceEntry[]>();
		entries.forEach((e) => {
			const key = `${e.day}|${e.startTime}|${e.endTime}`;
			const existing = map.get(key) ?? [];
			map.set(key, [...existing, e]);
		});
		return map;
	}, [entries]);

	if (entries.length === 0) {
		return (
			<div className='flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-2xl'>
				<Clock className='size-8 mb-3 opacity-20' />
				<p className='text-sm font-medium'>No scheduled classes found.</p>
			</div>
		);
	}

	return (
		<div className='overflow-x-auto rounded-2xl border border-border bg-card shadow-sm'>
			<div className='min-w-[800px]'>
				<div className='grid grid-cols-[100px_repeat(5,1fr)] border-b border-border bg-muted/30'>
					<div className='p-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-r border-border'>
						Time
					</div>
					{DAYS.map((day) => (
						<div
							key={day}
							className={`p-3 text-[11px] font-bold uppercase tracking-wider text-center border-r border-border last:border-r-0 ${
								day === currentDay ? 'bg-primary/5 text-primary' : 'text-muted-foreground'
							}`}
						>
							{day.slice(0, 3)}
						</div>
					))}
				</div>

				<div className='divide-y divide-border'>
					{timeSlots.map((slot) => {
						const isCurrentSlot = currentTimeStr >= slot.start && currentTimeStr < slot.end;

						return (
							<div key={`${slot.start}-${slot.end}`} className='grid grid-cols-[100px_repeat(5,1fr)]'>
								<div className='flex flex-col justify-center p-3 border-r border-border bg-muted/10 text-center'>
									<span className='text-xs font-semibold'>{formatTime(slot.start)}</span>
									<span className='text-[10px] text-muted-foreground'>{formatTime(slot.end)}</span>
								</div>
								{DAYS.map((day) => {
									const key = `${day}|${slot.start}|${slot.end}`;
									const cellEntries = entriesBySlot.get(key) ?? [];
									const isToday = day === currentDay;
									const isActiveCell = isToday && isCurrentSlot;

									return (
										<div
											key={day}
											className={`p-1.5 min-h-[80px] border-r border-border last:border-r-0 transition-colors ${
												isActiveCell ? 'bg-primary/[0.03] ring-1 ring-primary/20 inset-0 z-10' : ''
											}`}
										>
											<div className='space-y-1'>
												{cellEntries.map((entry) => (
													<motion.button
														key={entry.entryId}
														layoutId={entry.entryId}
														onClick={() => onEntryClick?.(entry)}
														className={`w-full text-left p-2 rounded-lg border text-[10px] transition-all ${
															selectedEntryId === entry.entryId
																? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary'
																: 'border-border bg-background hover:border-primary/50'
														}`}
													>
														<div className='flex justify-between items-start gap-1'>
															<span className='font-bold truncate'>{entry.subjectCode}</span>
															{renderEntryBadge?.(entry)}
														</div>
														<p className='truncate text-muted-foreground mt-0.5'>{entry.sectionName}</p>
														<p className='truncate font-medium mt-1'>{entry.currentRoomName}</p>
													</motion.button>
												))}
											</div>
										</div>
									);
								})}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
