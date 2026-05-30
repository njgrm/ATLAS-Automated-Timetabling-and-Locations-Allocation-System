import { useMemo } from 'react';
import type { ReactNode } from 'react';

export const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
export type DayKey = (typeof DAY_ORDER)[number];

export const DAY_LABELS: Record<DayKey, string> = {
	MONDAY: 'Monday',
	TUESDAY: 'Tuesday',
	WEDNESDAY: 'Wednesday',
	THURSDAY: 'Thursday',
	FRIDAY: 'Friday',
};

export type PublishedScheduleMatrixEntry = {
	entryId: string;
	day: string;
	startTime: string;
	endTime: string;
	subject: {
		code: string;
		name: string;
	};
	section?: {
		name: string;
		gradeLevel?: number | null;
		gradeLevelName: string | null;
		programName: string | null;
	};
	faculty?: {
		name: string;
	};
	room?: {
		name: string;
		buildingName: string | null;
	};
	durationMinutes?: number;
};

type PublishedTimetableMatrixProps = {
	entries: PublishedScheduleMatrixEntry[];
	emptyMessage: string;
	renderEntryDetails: (entry: PublishedScheduleMatrixEntry) => ReactNode;
	renderEntryBadges?: (entry: PublishedScheduleMatrixEntry) => ReactNode;
	dayFilter?: DayKey | 'all';
};

type TimeSlot = {
	startTime: string;
	endTime: string;
};

function normalizeDay(day: string): DayKey | null {
	const normalized = String(day ?? '').trim().toUpperCase();
	return DAY_ORDER.includes(normalized as DayKey) ? (normalized as DayKey) : null;
}

export function formatShortTime(time: string): string {
	const [rawHour, rawMinute] = time.split(':').map(Number);
	if (!Number.isFinite(rawHour) || !Number.isFinite(rawMinute)) return time;
	const period = rawHour >= 12 ? 'PM' : 'AM';
	const hour = rawHour % 12 || 12;
	const minute = String(rawMinute).padStart(2, '0');
	return `${hour}:${minute} ${period}`;
}

export function humanizeProgram(value: string): string {
	return value
		.toLowerCase()
		.split('_')
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

export function buildPublishedTimeSlots(entries: PublishedScheduleMatrixEntry[]): TimeSlot[] {
	const slotMap = new Map<string, TimeSlot>();
	for (const entry of entries) {
		const key = `${entry.startTime}-${entry.endTime}`;
		if (!slotMap.has(key)) {
			slotMap.set(key, { startTime: entry.startTime, endTime: entry.endTime });
		}
	}

	return [...slotMap.values()].sort((left, right) => left.startTime.localeCompare(right.startTime) || left.endTime.localeCompare(right.endTime));
}

function buildCellIndex(entries: PublishedScheduleMatrixEntry[], dayFilter: DayKey | 'all') {
	const index = new Map<string, PublishedScheduleMatrixEntry[]>();
	for (const entry of entries) {
		const normalizedDay = normalizeDay(entry.day);
		if (!normalizedDay) continue;
		if (dayFilter !== 'all' && normalizedDay !== dayFilter) continue;
		const key = `${normalizedDay}-${entry.startTime}-${entry.endTime}`;
		const list = index.get(key) ?? [];
		list.push(entry);
		index.set(key, list);
	}

	for (const list of index.values()) {
		list.sort((left, right) => left.subject.name.localeCompare(right.subject.name) || left.entryId.localeCompare(right.entryId));
	}

	return index;
}

export function PublishedTimetableMatrix({
	entries,
	emptyMessage,
	renderEntryDetails,
	renderEntryBadges,
	dayFilter = 'all',
}: PublishedTimetableMatrixProps) {
	const timeSlots = useMemo(() => buildPublishedTimeSlots(entries), [entries]);
	const cellIndex = useMemo(() => buildCellIndex(entries, dayFilter), [dayFilter, entries]);

	if (entries.length === 0) {
		return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
	}

	const visibleDays = DAY_ORDER.filter((day) => dayFilter === 'all' || dayFilter === day);

	return (
		<div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
			<div className="overflow-x-auto">
				<table className="w-full min-w-[900px] table-fixed border-collapse">
					<colgroup>
						<col className="w-28" />
						{visibleDays.map((day) => (
							<col key={day} />
						))}
					</colgroup>
					<thead className="bg-muted/40">
						<tr>
							<th className="border-b border-r border-border/70 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
								Time
							</th>
							{visibleDays.map((day) => (
								<th key={day} className="border-b border-border/70 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
									{DAY_LABELS[day]}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{timeSlots.map((slot) => (
							<tr key={`${slot.startTime}-${slot.endTime}`} className="align-top">
								<td className="border-b border-r border-border/70 px-3 py-3 align-top text-xs font-semibold whitespace-nowrap text-foreground">
									<div>{formatShortTime(slot.startTime)}</div>
									<div className="text-[11px] font-medium text-muted-foreground">to {formatShortTime(slot.endTime)}</div>
								</td>
								{visibleDays.map((day) => {
									const cellEntries = cellIndex.get(`${day}-${slot.startTime}-${slot.endTime}`) ?? [];
									return (
										<td key={day} className="border-b border-border/70 px-2 py-2 align-top">
											{cellEntries.length === 0 ? (
												<div className="min-h-20 rounded-xl border border-dashed border-border/60 bg-muted/20" />
											) : (
												<div className="space-y-2">
													{cellEntries.map((entry) => (
														<div key={entry.entryId} className="rounded-xl border border-border/70 bg-background px-3 py-2 shadow-sm">
															<div className="flex flex-wrap items-start gap-2">
																<div className="min-w-0 flex-1">
																	<p className="truncate text-sm font-semibold text-foreground">{entry.subject.name}</p>
																	<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{entry.subject.code}</p>
																</div>
																{renderEntryBadges && <div className="flex flex-wrap items-center gap-1.5">{renderEntryBadges(entry)}</div>}
															</div>
															<div className="mt-2 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
																{renderEntryDetails(entry)}
															</div>
														</div>
													))}
												</div>
											)}
										</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}