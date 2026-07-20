import { minutesBetween } from '@/lib/timetable-utils';
import type { CellConflictInfo, ScheduledEntry } from '@/types';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

export type TimetableConflictContext = {
	sectionId: number;
	facultyId?: number;
	allFacultyOptions?: number[];
	roomId?: number;
	sourceEntryId?: string;
};

export type TimetableConflictSlot = {
	startTime: string;
	endTime: string;
	isSpecialEvent?: boolean;
	eventName?: string;
};

type ConflictLookupMaps = {
	facultyName: (id: number) => string;
	sectionName: (id: number) => string;
	roomName: (id: number) => string;
	subjectName: (id: number) => string;
};

type LiveConflictIndex = {
	slotByKey: Map<string, TimetableConflictSlot>;
	slotMinutesByKey: Map<string, { start: number; end: number }>;
	entryMinutesById: Map<string, { start: number; end: number }>;
	entriesByDay: Map<string, ScheduledEntry[]>;
	sectionEntriesByDay: Map<string, ScheduledEntry[]>;
	roomEntriesByDay: Map<string, ScheduledEntry[]>;
	facultyEntriesByDay: Map<string, ScheduledEntry[]>;
	facultyDailyMinutes: Map<string, number>;
};

export type LiveConflictCompactKind = 'clean' | 'warning' | 'blocked' | 'self';

export type LiveConflictCompactState = {
	kind: LiveConflictCompactKind;
	codes: string[];
	displacedEntryIds: string[];
};

export type LiveConflictDetail = CellConflictInfo & {
	compact: LiveConflictCompactState;
	nextAction: string;
};

export type LiveConflictInspector = {
	getCompact: (cellId: string) => LiveConflictCompactState | null;
	getDetail: (cellId: string) => LiveConflictDetail | null;
};

function dayEntityKey(day: string, id: number): string {
	return `${day}:${id}`;
}

export function intervalsOverlap(
	startA: string,
	endA: string,
	startB: string,
	endB: string,
): boolean {
	return intervalsOverlapMinutes(
		minutesFromMidnight(startA),
		minutesFromMidnight(endA),
		minutesFromMidnight(startB),
		minutesFromMidnight(endB),
	);
}

function intervalsOverlapMinutes(
	startA: number,
	endA: number,
	startB: number,
	endB: number,
): boolean {
	return startA < endB && startB < endA;
}

function minutesFromMidnight(value: string): number {
	const [hourRaw, minuteRaw] = value.split(':');
	const hour = Number(hourRaw);
	const minute = Number(minuteRaw);
	if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
	return hour * 60 + minute;
}

function pushIndexedEntry(map: Map<string, ScheduledEntry[]>, key: string, entry: ScheduledEntry) {
	let list = map.get(key);
	if (!list) {
		list = [];
		map.set(key, list);
	}
	list.push(entry);
}

function unique<T>(items: T[]): T[] {
	return Array.from(new Set(items));
}

function addUnique(items: string[], item: string) {
	if (!items.includes(item)) items.push(item);
}

function toCompact(
	info: CellConflictInfo,
	codes: string[],
): LiveConflictCompactState {
	return {
		kind: info.kind === 'hard' ? 'blocked' : info.kind === 'soft' ? 'warning' : info.kind,
		codes: unique(codes),
		displacedEntryIds: unique(info.displaced.map((entry) => entry.entryId)),
	};
}

/**
 * This work happens while the board is idle (when run data changes), never on
 * pointer activation. A drag only closes over these immutable indexes.
 */
export function buildLiveConflictIndex(
	entries: ScheduledEntry[],
	timeSlots: TimetableConflictSlot[],
): LiveConflictIndex {
	const slotByKey = new Map<string, TimetableConflictSlot>();
	const slotMinutesByKey = new Map<string, { start: number; end: number }>();
	for (const slot of timeSlots) {
		const minutes = { start: minutesFromMidnight(slot.startTime), end: minutesFromMidnight(slot.endTime) };
		for (const day of DAYS) {
			const key = `${day}-${slot.startTime}-${slot.endTime}`;
			slotByKey.set(key, slot);
			slotMinutesByKey.set(key, minutes);
		}
	}

	const entriesByDay = new Map<string, ScheduledEntry[]>();
	const sectionEntriesByDay = new Map<string, ScheduledEntry[]>();
	const roomEntriesByDay = new Map<string, ScheduledEntry[]>();
	const facultyEntriesByDay = new Map<string, ScheduledEntry[]>();
	const facultyDailyMinutes = new Map<string, number>();
	const entryMinutesById = new Map<string, { start: number; end: number }>();
	for (const entry of entries) {
		const entryMinutes = {
			start: minutesFromMidnight(entry.startTime),
			end: minutesFromMidnight(entry.endTime),
		};
		entryMinutesById.set(entry.entryId, entryMinutes);
		pushIndexedEntry(entriesByDay, entry.day, entry);
		pushIndexedEntry(sectionEntriesByDay, dayEntityKey(entry.day, entry.sectionId), entry);
		pushIndexedEntry(roomEntriesByDay, dayEntityKey(entry.day, entry.roomId), entry);
		if (entry.facultyId != null) {
			const dailyKey = dayEntityKey(entry.day, entry.facultyId);
			pushIndexedEntry(facultyEntriesByDay, dailyKey, entry);
			facultyDailyMinutes.set(
				dailyKey,
				(facultyDailyMinutes.get(dailyKey) ?? 0) + Math.max(0, entryMinutes.end - entryMinutes.start),
			);
		}
	}

	return { slotByKey, slotMinutesByKey, entryMinutesById, entriesByDay, sectionEntriesByDay, roomEntriesByDay, facultyEntriesByDay, facultyDailyMinutes };
}

/**
 * Builds the immutable indexes once for a drag, then evaluates only the cell
 * the pointer is currently over. The previous implementation eagerly created
 * decorated conflict state for every visible cell at drag start.
 */
export function createLiveConflictLookup(
	entries: ScheduledEntry[],
	timeSlots: TimetableConflictSlot[],
	context: TimetableConflictContext | null,
	maps: ConflictLookupMaps,
	preparedIndex?: LiveConflictIndex,
): ((cellId: string) => CellConflictInfo | null) | null {
	return createLiveConflictInspector(entries, timeSlots, context, maps, preparedIndex)?.getDetail ?? null;
}

export function createLiveConflictInspector(
	entries: ScheduledEntry[],
	timeSlots: TimetableConflictSlot[],
	context: TimetableConflictContext | null,
	maps: ConflictLookupMaps,
	preparedIndex?: LiveConflictIndex,
): LiveConflictInspector | null {
	if (!context) return null;

	const sourceEntry = context.sourceEntryId
		? entries.find((entry) => entry.entryId === context.sourceEntryId) ?? null
		: null;
	const sourceEntryDuration = sourceEntry
		? minutesBetween(sourceEntry.startTime, sourceEntry.endTime)
		: 0;
	const { slotByKey, slotMinutesByKey, entryMinutesById, sectionEntriesByDay, roomEntriesByDay, facultyEntriesByDay, facultyDailyMinutes } = preparedIndex
		?? buildLiveConflictIndex(entries, timeSlots);

	const overlapsTarget = (entry: ScheduledEntry, targetStart: number, targetEnd: number) => {
		const minutes = entryMinutesById.get(entry.entryId);
		if (minutes) return intervalsOverlapMinutes(minutes.start, minutes.end, targetStart, targetEnd);
		return intervalsOverlapMinutes(
			minutesFromMidnight(entry.startTime),
			minutesFromMidnight(entry.endTime),
			targetStart,
			targetEnd,
		);
	};

	const calculateCompact = (cellId: string): LiveConflictCompactState | null => {
		const slot = slotByKey.get(cellId);
		if (!slot) return null;
		if (slot.isSpecialEvent) {
			return { kind: 'blocked', codes: ['SPECIAL_EVENT'], displacedEntryIds: [] };
		}

		const dividerIndex = cellId.indexOf('-');
		const day = dividerIndex > 0 ? cellId.slice(0, dividerIndex) : cellId;
		const slotMinutes = slotMinutesByKey.get(cellId) ?? {
			start: minutesFromMidnight(slot.startTime),
			end: minutesFromMidnight(slot.endTime),
		};
		const targetStart = slotMinutes.start;
		const targetEnd = slotMinutes.end;
		if (
			sourceEntry
			&& sourceEntry.day === day
			&& overlapsTarget(sourceEntry, targetStart, targetEnd)
		) {
			return { kind: 'self', codes: ['SELF'], displacedEntryIds: [] };
		}

		const codes: string[] = [];
		const displacedEntryIds: string[] = [];
		let hasHardConflict = false;
		let hasSoftConflict = false;

		const noteHard = (code: string, entryId?: string) => {
			addUnique(codes, code);
			if (entryId) addUnique(displacedEntryIds, entryId);
			hasHardConflict = true;
		};
		const noteSoft = (code: string, entryId?: string) => {
			addUnique(codes, code);
			if (entryId) addUnique(displacedEntryIds, entryId);
			hasSoftConflict = true;
		};

		const sectionEntries = sectionEntriesByDay.get(dayEntityKey(day, context.sectionId)) ?? [];
		for (const entry of sectionEntries) {
			if (entry.entryId !== context.sourceEntryId && overlapsTarget(entry, targetStart, targetEnd)) {
				noteHard('SECTION_OVERLAP', entry.entryId);
			}
		}

		if (context.roomId) {
			const roomEntries = roomEntriesByDay.get(dayEntityKey(day, context.roomId)) ?? [];
			for (const entry of roomEntries) {
				if (entry.entryId !== context.sourceEntryId && overlapsTarget(entry, targetStart, targetEnd)) {
					noteHard('ROOM_OVERLAP', entry.entryId);
				}
			}
		}

		const facultyOptions = context.allFacultyOptions?.length
			? context.allFacultyOptions
			: context.facultyId ? [context.facultyId] : [];
		if (context.allFacultyOptions?.length) {
			let busyCount = 0;
			for (const facultyId of facultyOptions) {
				const facultyEntries = facultyEntriesByDay.get(dayEntityKey(day, facultyId)) ?? [];
				const conflictEntry = facultyEntries.find((entry) => (
					entry.entryId !== context.sourceEntryId
					&& overlapsTarget(entry, targetStart, targetEnd)
				));
				if (conflictEntry) {
					busyCount += 1;
					addUnique(displacedEntryIds, conflictEntry.entryId);
				}
			}
			if (busyCount > 0) {
				if (busyCount < facultyOptions.length) noteSoft('FACULTY_OPTION_BUSY');
				else noteHard('FACULTY_OPTIONS_ALL_BUSY');
			}
		} else if (context.facultyId) {
			const facultyEntries = facultyEntriesByDay.get(dayEntityKey(day, context.facultyId)) ?? [];
			const conflictEntry = facultyEntries.find((entry) => (
				entry.entryId !== context.sourceEntryId
				&& overlapsTarget(entry, targetStart, targetEnd)
			));
			if (conflictEntry) noteHard('FACULTY_OVERLAP', conflictEntry.entryId);
		}

		const sessionDuration = Math.max(0, targetEnd - targetStart);
		if (sessionDuration > 0) {
			for (const facultyId of facultyOptions) {
				let existingDailyMinutes = facultyDailyMinutes.get(dayEntityKey(day, facultyId)) ?? 0;
				if (sourceEntry && sourceEntry.facultyId === facultyId && sourceEntry.day === day) {
					existingDailyMinutes = Math.max(0, existingDailyMinutes - sourceEntryDuration);
				}
				const projected = existingDailyMinutes + sessionDuration;
				if (projected > 480) noteHard('DAILY_LOAD_HARD');
				else if (projected > 360) noteSoft('DAILY_LOAD_SOFT');
			}
		}

		return {
			kind: hasHardConflict ? 'blocked' : hasSoftConflict ? 'warning' : 'clean',
			codes: codes.length ? codes : ['CLEAN'],
			displacedEntryIds,
		};
	};

	const calculate = (cellId: string, detailed: boolean): LiveConflictDetail | null => {
		const slot = slotByKey.get(cellId);
		if (!slot) return null;
		if (slot.isSpecialEvent) {
			const info: CellConflictInfo = {
				kind: 'hard',
				reasons: detailed ? [`${slot.eventName ?? 'Special event'} slot is non-schedulable`] : [],
				displaced: [],
			};
			return { ...info, compact: toCompact(info, ['SPECIAL_EVENT']), nextAction: 'Choose a schedulable class slot.' };
		}

		const [day] = cellId.split('-');
		const slotMinutes = slotMinutesByKey.get(cellId) ?? {
			start: minutesFromMidnight(slot.startTime),
			end: minutesFromMidnight(slot.endTime),
		};
		const targetStart = slotMinutes.start;
		const targetEnd = slotMinutes.end;
		if (
			sourceEntry
			&& sourceEntry.day === day
			&& overlapsTarget(sourceEntry, targetStart, targetEnd)
		) {
			const info: CellConflictInfo = {
				kind: 'self',
				reasons: detailed ? ['Current position'] : [],
				displaced: [],
			};
			return { ...info, compact: toCompact(info, ['SELF']), nextAction: 'This is the session current slot.' };
		}

		const hardReasons: string[] = [];
		const softReasons: string[] = [];
		const codes: string[] = [];
		const displaced: CellConflictInfo['displaced'] = [];
		const sectionEntries = sectionEntriesByDay.get(dayEntityKey(day, context.sectionId)) ?? [];
		for (const entry of sectionEntries) {
			if (entry.entryId === context.sourceEntryId) continue;
			if (overlapsTarget(entry, targetStart, targetEnd)) {
				codes.push('SECTION_OVERLAP');
				if (detailed) {
					const label = maps.sectionName(context.sectionId);
					if (!hardReasons.some((reason) => reason.startsWith('Section occupied'))) hardReasons.push(`Section occupied: ${label}`);
					displaced.push({ entryId: entry.entryId, subjectName: maps.subjectName(entry.subjectId), entityName: label, entityId: context.sectionId, conflictType: 'section' });
				} else {
					displaced.push({ entryId: entry.entryId, subjectName: '', entityName: '', entityId: context.sectionId, conflictType: 'section' });
				}
			}
		}

		if (context.roomId) {
			const roomEntries = roomEntriesByDay.get(dayEntityKey(day, context.roomId)) ?? [];
			for (const entry of roomEntries) {
				if (entry.entryId === context.sourceEntryId) continue;
				if (overlapsTarget(entry, targetStart, targetEnd)) {
					codes.push('ROOM_OVERLAP');
					if (detailed) {
						const label = maps.roomName(context.roomId);
						if (!hardReasons.some((reason) => reason.startsWith('Room occupied'))) hardReasons.push(`Room occupied: ${label}`);
						displaced.push({ entryId: entry.entryId, subjectName: maps.subjectName(entry.subjectId), entityName: label, entityId: context.roomId, conflictType: 'room' });
					} else {
						displaced.push({ entryId: entry.entryId, subjectName: '', entityName: '', entityId: context.roomId, conflictType: 'room' });
					}
				}
			}
		}

		const facultyOptions = context.allFacultyOptions?.length
			? context.allFacultyOptions
			: context.facultyId ? [context.facultyId] : [];
		if (context.allFacultyOptions?.length) {
			const busyOptions = facultyOptions.filter((facultyId) => {
				const facultyEntries = facultyEntriesByDay.get(dayEntityKey(day, facultyId)) ?? [];
				return facultyEntries.some((entry) => (
					entry.entryId !== context.sourceEntryId
					&& overlapsTarget(entry, targetStart, targetEnd)
				));
			});
			if (busyOptions.length) {
				codes.push(busyOptions.length < facultyOptions.length ? 'FACULTY_OPTION_BUSY' : 'FACULTY_OPTIONS_ALL_BUSY');
				if (detailed) {
					const busyLabels = busyOptions.map(maps.facultyName).join(', ');
					if (busyOptions.length < facultyOptions.length) softReasons.push(`Faculty busy: ${busyLabels} (alternatives available)`);
					else hardReasons.push(`Faculty overlap: all ${facultyOptions.length} option${facultyOptions.length === 1 ? '' : 's'} busy (${busyLabels})`);
				}
				for (const facultyId of busyOptions) {
					const facultyEntries = facultyEntriesByDay.get(dayEntityKey(day, facultyId)) ?? [];
					const conflictEntry = facultyEntries.find((entry) => (
						entry.entryId !== context.sourceEntryId
						&& overlapsTarget(entry, targetStart, targetEnd)
					));
					if (conflictEntry) {
						displaced.push({
							entryId: conflictEntry.entryId,
							subjectName: detailed ? maps.subjectName(conflictEntry.subjectId) : '',
							entityName: detailed ? maps.facultyName(facultyId) : '',
							entityId: facultyId,
							conflictType: 'faculty',
						});
					}
				}
			}
		} else if (context.facultyId) {
			const facultyEntries = facultyEntriesByDay.get(dayEntityKey(day, context.facultyId)) ?? [];
			const conflictEntry = facultyEntries.find((entry) => (
				entry.entryId !== context.sourceEntryId
				&& overlapsTarget(entry, targetStart, targetEnd)
			));
			if (conflictEntry) {
				codes.push('FACULTY_OVERLAP');
				if (detailed) {
					const label = maps.facultyName(context.facultyId);
					hardReasons.push(`Faculty overlap: ${label}`);
					displaced.push({ entryId: conflictEntry.entryId, subjectName: maps.subjectName(conflictEntry.subjectId), entityName: label, entityId: context.facultyId, conflictType: 'faculty' });
				} else {
					displaced.push({ entryId: conflictEntry.entryId, subjectName: '', entityName: '', entityId: context.facultyId, conflictType: 'faculty' });
				}
			}
		}

		const sessionDuration = Math.max(0, targetEnd - targetStart);
		if (sessionDuration > 0) {
			for (const facultyId of facultyOptions) {
				let existingDailyMinutes = facultyDailyMinutes.get(`${day}:${facultyId}`) ?? 0;
				if (sourceEntry && sourceEntry.facultyId === facultyId && sourceEntry.day === day) {
					existingDailyMinutes = Math.max(0, existingDailyMinutes - sourceEntryDuration);
				}
				const projected = existingDailyMinutes + sessionDuration;
				if (projected > 480) {
					codes.push('DAILY_LOAD_HARD');
					if (detailed) hardReasons.push(`Daily load hard cap: ${maps.facultyName(facultyId)} would reach ${Math.round((projected / 60) * 10) / 10}h (max 8h)`);
				} else if (projected > 360) {
					codes.push('DAILY_LOAD_SOFT');
					if (detailed) softReasons.push(`Daily load soft cap: ${maps.facultyName(facultyId)} would reach ${Math.round((projected / 60) * 10) / 10}h (soft limit 6h)`);
				}
			}
		}

		let info: CellConflictInfo;
		if (hardReasons.length || codes.some((code) => code === 'SECTION_OVERLAP' || code === 'ROOM_OVERLAP' || code === 'FACULTY_OVERLAP' || code === 'FACULTY_OPTIONS_ALL_BUSY' || code === 'DAILY_LOAD_HARD')) {
			info = { kind: 'hard', reasons: unique([...hardReasons, ...softReasons]), displaced };
		} else if (softReasons.length || codes.length) {
			info = { kind: 'soft', reasons: unique(softReasons), displaced };
		} else {
			info = { kind: 'clean', reasons: [], displaced };
		}
		return {
			...info,
			compact: toCompact(info, codes.length ? codes : ['CLEAN']),
			nextAction: info.kind === 'hard'
				? 'Pick another slot or review the blocking session.'
				: info.kind === 'soft'
					? 'This slot is possible, but review the warning before saving.'
					: 'This slot is available.',
		};
	};

	return {
		getCompact: calculateCompact,
		getDetail: (cellId) => calculate(cellId, true),
	};
}
