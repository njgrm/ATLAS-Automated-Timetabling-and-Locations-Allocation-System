/**
 * Room schedule projection service.
 * Reads draft entries from generation runs and projects a room-centric timetable view.
 * Business logic only; no transport concerns.
 */

import { prisma } from '../lib/prisma.js';
import type { ScheduledEntry } from './constraint-validator.js';
import * as genService from './generation.service.js';
import { computeOccupiedMinutesByIntervalUnion, countUniqueEntryIds } from './room-schedule.metrics.js';
import { buildPeriodSlots, buildSpecialEventSlots, mergeDisplaySlots } from './schedule-constructor.js';
import * as policyService from './scheduling-policy.service.js';
import { normalizeSubjectDisplayLabel } from './schedule-output-normalization.service.js';

// ─── Constants ───

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
type Day = (typeof DAYS)[number];

// ─── Helpers ───

function err(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
	const e = new Error(message) as Error & { statusCode: number; code: string };
	e.statusCode = statusCode;
	e.code = code;
	return e;
}

function timesOverlap(a: { startTime: string; endTime: string }, b: { startTime: string; endTime: string }): boolean {
	return a.startTime < b.endTime && b.startTime < a.endTime;
}

// ─── Types ───

export interface RoomScheduleEntry {
	entryId: string;
	subjectId: number;
	subjectDisplayLabel?: string;
	sectionId: number;
	facultyId: number | null;
	startTime: string;
	endTime: string;
	durationMinutes: number;
	termIndex: 1 | 2 | 3;
}

export interface RoomScheduleCell {
	day: string;
	occupied: boolean;
	entries: RoomScheduleEntry[];
	conflict: boolean;
}

export interface RoomScheduleView {
	room: {
		id: number;
		name: string;
		type: string;
		buildingId?: number;
		buildingName?: string;
		floor?: number;
	};
	source: {
		mode: 'LATEST' | 'RUN' | 'DRAFT';
		runId: number | null;
		status: string;
		generatedAt?: string;
	};
	timeSlots: Array<{ startTime: string; endTime: string; eventLabel?: string | null }>;
	days: typeof DAYS;
	grid: Array<{
		timeSlot: { startTime: string; endTime: string; eventLabel?: string | null };
		cells: RoomScheduleCell[];
	}>;
	summary: {
		occupiedMinutes: number;
		availableMinutes: number;
		utilizationPercent: number;
		entryCount: number;
		conflictCount: number;
	};
}

// ─── Service ───

export async function getRoomScheduleView(
	schoolId: number,
	schoolYearId: number,
	roomId: number,
	source: { mode: 'LATEST' } | { mode: 'RUN'; runId: number } | { mode: 'DRAFT' },
): Promise<RoomScheduleView> {
	// 1) Fetch room with building
	const room = await prisma.room.findFirst({
		where: { id: roomId, building: { schoolId } },
		include: { building: { select: { id: true, name: true } } },
	});
	if (!room) throw err(404, 'ROOM_NOT_FOUND', `Room ${roomId} not found in school ${schoolId}.`);

	// 2) Fetch policy to build dynamic time slots
	const policy = await policyService.getOrCreatePolicy(schoolId, schoolYearId);
	const specialEventSlots = buildSpecialEventSlots({
		maxConsecutiveTeachingMinutesBeforeBreak: policy.maxConsecutiveTeachingMinutesBeforeBreak,
		minBreakMinutesAfterConsecutiveBlock: policy.minBreakMinutesAfterConsecutiveBlock,
		maxTeachingMinutesPerDay: policy.maxTeachingMinutesPerDay,
		earliestStartTime: policy.earliestStartTime,
		latestEndTime: policy.latestEndTime,
		lunchStartTime: policy.lunchStartTime,
		lunchEndTime: policy.lunchEndTime,
		enableLunchWindow: policy.enableLunchWindow,
		enforceLunchWindow: policy.enforceLunchWindow,
		enableFlagCeremony: policy.enableFlagCeremony,
		flagCeremonyStartTime: policy.flagCeremonyStartTime,
		flagCeremonyEndTime: policy.flagCeremonyEndTime,
		enableRecess: policy.enableRecess,
		recessStartTime: policy.recessStartTime,
		recessEndTime: policy.recessEndTime,
	});
	let classPeriodSlots = buildPeriodSlots({
		maxConsecutiveTeachingMinutesBeforeBreak: policy.maxConsecutiveTeachingMinutesBeforeBreak,
		minBreakMinutesAfterConsecutiveBlock: policy.minBreakMinutesAfterConsecutiveBlock,
		maxTeachingMinutesPerDay: policy.maxTeachingMinutesPerDay,
		earliestStartTime: policy.earliestStartTime,
		latestEndTime: policy.latestEndTime,
		lunchStartTime: policy.lunchStartTime,
		lunchEndTime: policy.lunchEndTime,
		enableLunchWindow: policy.enableLunchWindow,
		enforceLunchWindow: policy.enforceLunchWindow,
		enableFlagCeremony: policy.enableFlagCeremony,
		flagCeremonyStartTime: policy.flagCeremonyStartTime,
		flagCeremonyEndTime: policy.flagCeremonyEndTime,
		enableRecess: policy.enableRecess,
		recessStartTime: policy.recessStartTime,
		recessEndTime: policy.recessEndTime,
	});
	let PERIOD_SLOTS = (policy.showSpecialEventsInGrid ?? true)
		? mergeDisplaySlots(classPeriodSlots, specialEventSlots)
		: classPeriodSlots;

	// 3) Resolve source entries (generated run draft OR pre-generation draft board)
	let roomEntries: ScheduledEntry[] = [];
	let sourceRunId: number | null = null;
	let sourceStatus = 'PRE_GENERATION_DRAFT';
	let sourceGeneratedAt: string | undefined;

	if (source.mode === 'DRAFT') {
		const placements = await prisma.lockedSession.findMany({
			where: {
				schoolId,
				schoolYearId,
				status: 'DRAFT',
				roomId,
			},
			orderBy: [{ day: 'asc' }, { startTime: 'asc' }, { id: 'asc' }],
		});
		roomEntries = placements.map((placement) => {
			const [startHour, startMinute] = placement.startTime.split(':').map(Number);
			const [endHour, endMinute] = placement.endTime.split(':').map(Number);
			const durationMinutes = Math.max(0, ((endHour * 60) + endMinute) - ((startHour * 60) + startMinute));
			return {
				entryId: `draft-lock-${placement.id}`,
				facultyId: placement.facultyId ?? 0,
				roomId: placement.roomId ?? roomId,
				subjectId: placement.subjectId,
				sectionId: placement.sectionId,
				day: placement.day,
				startTime: placement.startTime,
				endTime: placement.endTime,
				durationMinutes,
				termIndex: placement.termIndex as 1 | 2 | 3,
				entryKind: placement.entryKind,
				cohortCode: placement.cohortCode ?? null,
			} satisfies ScheduledEntry;
		});
		sourceGeneratedAt = placements[0]?.updatedAt?.toISOString();
	} else {
		const draft = source.mode === 'LATEST'
			? await genService.getLatestRunDraft(schoolId, schoolYearId)
			: await genService.getRunDraft(source.runId, schoolId, schoolYearId);
		roomEntries = draft.entries.filter((e: ScheduledEntry) => e.roomId === roomId);

		if (draft.summary?.timetableShapeContracts && draft.summary.timetableShapeContracts.length > 0) {
			const dedupedClassSlots = new Map<string, { startTime: string; endTime: string }>();
			for (const contract of draft.summary.timetableShapeContracts) {
				for (const slot of contract.periodSlots) {
					dedupedClassSlots.set(`${slot.startTime}-${slot.endTime}`, { startTime: slot.startTime, endTime: slot.endTime });
				}
			}
			classPeriodSlots = [...dedupedClassSlots.values()].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));
		}

		if (draft.summary?.timetableDisplaySlots && draft.summary.timetableDisplaySlots.length > 0) {
			PERIOD_SLOTS = draft.summary.timetableDisplaySlots.map((slot) => ({
				startTime: slot.startTime,
				endTime: slot.endTime,
				isSpecialEvent: slot.isSpecialEvent,
				eventName: slot.eventName,
			}));
		}

		sourceRunId = draft.runId;
		sourceStatus = draft.status;
		sourceGeneratedAt = draft.finishedAt ?? draft.createdAt;
	}

	// 4) Build index: day -> entries[]
	const subjectIds = [...new Set(roomEntries.map((entry) => entry.subjectId))];
	const subjects = subjectIds.length > 0
		? await prisma.subject.findMany({
			where: { schoolId, id: { in: subjectIds } },
			select: { id: true, code: true, name: true, modularGroupId: true },
		})
		: [];
	const subjectDisplayMap = new Map<number, string>(subjects.map((subject) => [
		subject.id,
		normalizeSubjectDisplayLabel({
			code: subject.code,
			name: subject.name,
			modularGroupId: subject.modularGroupId,
		}),
	]));

	const entriesByDay = new Map<string, ScheduledEntry[]>();
	for (const e of roomEntries) {
		const arr = entriesByDay.get(e.day) ?? [];
		arr.push(e);
		entriesByDay.set(e.day, arr);
	}

	// 5) Build grid row by row (time slot × day)
	let conflictCount = 0;

	const grid = PERIOD_SLOTS.map((slot) => {
		const eventLabel = slot.eventName ?? null;
		const cells: RoomScheduleCell[] = DAYS.map((day) => {
			if (slot.isSpecialEvent) {
				return {
					day,
					occupied: false,
					entries: [],
					conflict: false,
				};
			}
			const dayEntries = entriesByDay.get(day) ?? [];
			const overlapping = dayEntries.filter((e) => timesOverlap(slot, e));

			const mapped: RoomScheduleEntry[] = overlapping.map((e) => ({
				entryId: e.entryId,
				subjectId: e.subjectId,
				subjectDisplayLabel: subjectDisplayMap.get(e.subjectId),
				sectionId: e.sectionId,
				facultyId: e.facultyId,
				startTime: e.startTime,
				endTime: e.endTime,
				durationMinutes: e.durationMinutes,
				termIndex: (e.termIndex ?? 1) as 1 | 2 | 3,
			}));

			const hasConflict = mapped.length > 1;
			if (hasConflict) conflictCount++;

			return {
				day,
				occupied: mapped.length > 0,
				entries: mapped,
				conflict: hasConflict,
			};
		});

		return { timeSlot: { startTime: slot.startTime, endTime: slot.endTime, eventLabel }, cells };
	});

	// 6) Summary — unique-entry aggregation to avoid per-cell inflation
	const entryCount = countUniqueEntryIds(roomEntries);
	const occupiedMinutes = computeOccupiedMinutesByIntervalUnion(roomEntries, DAYS);

	const slotMinutesTotal = classPeriodSlots.reduce((total, slot) => {
		const [startH, startM] = slot.startTime.split(':').map(Number);
		const [endH, endM] = slot.endTime.split(':').map(Number);
		return total + Math.max(0, (endH * 60 + endM) - (startH * 60 + startM));
	}, 0);
	const availableMinutes = slotMinutesTotal * DAYS.length;
	const utilizationPercent = availableMinutes > 0
		? Math.round((occupiedMinutes / availableMinutes) * 10000) / 100
		: 0;

	return {
		room: {
			id: room.id,
			name: room.name,
			type: room.type,
			buildingId: room.building.id,
			buildingName: room.building.name,
			floor: room.floor,
		},
		source: {
			mode: source.mode,
			runId: sourceRunId,
			status: sourceStatus,
			generatedAt: sourceGeneratedAt,
		},
		timeSlots: PERIOD_SLOTS.map((s) => ({ startTime: s.startTime, endTime: s.endTime, eventLabel: s.eventName ?? null })),
		days: DAYS,
		grid,
		summary: {
			occupiedMinutes,
			availableMinutes,
			utilizationPercent,
			entryCount,
			conflictCount,
		},
	};
}
