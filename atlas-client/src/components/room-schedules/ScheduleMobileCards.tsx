import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';

import { formatTime } from '@/lib/utils';
import type { RoomScheduleView, RoomScheduleEntry } from '@/types';
import { Badge } from '@/ui/badge';
import { GradeLevelBadge } from '@/components/GradeLevelBadge';
import type { ScheduleGridSharedProps, ConflictClickHandler } from './schedule-types';
import { DAY_SHORT } from './schedule-types';

export function ScheduleMobileCards({
	view,
	viewMode,
	subjectMap,
	facultyMap,
	sectionMap,
	roomMap,
	onConflictClick,
}: ScheduleGridSharedProps & {
	view: RoomScheduleView;
	onConflictClick?: ConflictClickHandler;
}) {
	const dayEntries = useMemo(() => {
		const grouped: { day: string; label: string; items: { timeSlot: string; entries: RoomScheduleEntry[]; conflict: boolean; startTime: string; endTime: string }[] }[] = [];
		for (const day of view.days) {
			const label = DAY_SHORT[day] ?? day;
			const items: { timeSlot: string; entries: RoomScheduleEntry[]; conflict: boolean; startTime: string; endTime: string }[] = [];
			for (const row of view.grid) {
				const dayIdx = view.days.indexOf(day);
				const cell = row.cells[dayIdx];
				if (!cell.occupied || cell.entries.length === 0) continue;
				const timeSlot = row.timeSlot.eventLabel
					? row.timeSlot.eventLabel
					: `${formatTime(row.timeSlot.startTime)}–${formatTime(row.timeSlot.endTime)}`;
				items.push({
					timeSlot,
					entries: cell.entries,
					conflict: cell.conflict,
					startTime: row.timeSlot.startTime,
					endTime: row.timeSlot.endTime,
				});
			}
			if (items.length > 0) {
				grouped.push({ day, label, items });
			}
		}
		return grouped;
	}, [view]);

	if (dayEntries.length === 0) {
		return (
			<p className="py-8 text-center text-sm text-muted-foreground">No scheduled classes found.</p>
		);
	}

	return (
		<div className="space-y-3">
			{dayEntries.map(({ day, label, items }) => (
				<section key={day}>
					<div className="sticky top-0 z-10 -mx-4 mb-2 bg-muted/40 px-4 py-1 backdrop-blur-md border-y border-border/20">
						<h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</h2>
					</div>
					<div className="space-y-2">
						{items.map((item, idx) => (
							<div
								key={idx}
								className={`rounded-2xl border shadow-sm ${item.conflict ? 'border-red-200 bg-red-50 cursor-pointer hover:bg-red-100' : 'border-border/60 bg-white'}`}
								onClick={item.conflict && onConflictClick ? () => onConflictClick(day, label, item.startTime, item.endTime, item.entries) : undefined}
							>
								<div className="px-3.5 py-2.5">
									<div className="flex items-center justify-between gap-2 mb-1.5">
										<span className="text-xs font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5">{item.timeSlot}</span>
										{item.conflict && (
											<Badge variant="destructive" className="text-[10px] px-1.5 py-0">
												<AlertTriangle className="mr-0.5 size-2.5" />
												Conflict
											</Badge>
										)}
									</div>
									{item.entries.map((entry) => {
										const sectionInfo = sectionMap.get(entry.sectionId);
										const sectionLabel = sectionInfo?.name ?? 'Section not listed';
										const facultyLabel = entry.facultyId != null
											? (facultyMap.get(entry.facultyId) ?? 'Teacher not listed')
											: 'Unassigned';
										const roomLabel = entry.roomId != null
											? (roomMap.get(entry.roomId) ?? 'Room not listed')
											: '—';
										const subjectLabel = entry.subjectDisplayLabel ?? subjectMap.get(entry.subjectId) ?? 'Subject not listed';
										return (
											<div key={entry.entryId} className="py-1">
												<p className="text-sm font-semibold text-foreground leading-tight">{subjectLabel}</p>
												<div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
													{viewMode === 'rooms' && (
														<>
															<GradeLevelBadge grade={sectionInfo?.gradeLevel ?? null} size="xs" />
															<span>{sectionLabel}</span>
															<span>·</span>
															<span>{facultyLabel}</span>
														</>
													)}
													{viewMode === 'teachers' && (
														<>
															<GradeLevelBadge grade={sectionInfo?.gradeLevel ?? null} size="xs" />
															<span>{sectionLabel}</span>
															<span>·</span>
															<span>{roomLabel}</span>
														</>
													)}
													{viewMode === 'sections' && (
														<>
															<span>{facultyLabel}</span>
															<span>·</span>
															<span>{roomLabel}</span>
														</>
													)}
												</div>
											</div>
										);
									})}
								</div>
							</div>
						))}
					</div>
				</section>
			))}
		</div>
	);
}
