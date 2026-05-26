import { prisma } from '../lib/prisma.js';
import type { ScheduledEntry } from './constraint-validator.js';
import { buildSpecialEventSlots } from './schedule-constructor.js';
import { getOrCreatePolicy } from './scheduling-policy.service.js';

type PublishedRunSource = {
	runId: number;
	schoolId: number;
	schoolYearId: number;
	publishedAt: string | null;
	generatedAt: string | null;
};

type SectionReference = {
	name: string;
	gradeLevel: number | null;
	gradeLevelName: string | null;
	programType: string | null;
	programCode: string | null;
	programName: string | null;
};

function err(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
	const e = new Error(message) as Error & { statusCode: number; code: string };
	e.statusCode = statusCode;
	e.code = code;
	return e;
}

function readPublishedAt(summary: unknown): string | null {
	if (!summary || typeof summary !== 'object') return null;
	const value = (summary as Record<string, unknown>).publishedAt;
	return typeof value === 'string' && value.length > 0 ? value : null;
}

function isRunPublished(summary: unknown): boolean {
	if (!summary || typeof summary !== 'object') return false;
	return (summary as Record<string, unknown>).isPublished === true;
}

async function resolvePublishedRun(schoolId: number, schoolYearId?: number) {
	const candidates = await prisma.generationRun.findMany({
		where: {
			schoolId,
			status: 'COMPLETED',
			...(schoolYearId ? { schoolYearId } : {}),
		},
		orderBy: [{ createdAt: 'desc' }],
		select: {
			id: true,
			schoolId: true,
			schoolYearId: true,
			draftEntries: true,
			summary: true,
			finishedAt: true,
			createdAt: true,
		},
		take: 200,
	});

	const publishedRun = candidates.find((candidate) => isRunPublished(candidate.summary));
	if (!publishedRun) {
		throw err(404, 'PUBLISHED_RUN_NOT_FOUND', 'No published schedule is available for the requested scope.');
	}

	return {
		source: {
			runId: publishedRun.id,
			schoolId: publishedRun.schoolId,
			schoolYearId: publishedRun.schoolYearId,
			publishedAt: readPublishedAt(publishedRun.summary),
			generatedAt: publishedRun.finishedAt?.toISOString() ?? publishedRun.createdAt.toISOString(),
		} satisfies PublishedRunSource,
		entries: (publishedRun.draftEntries ?? []) as unknown as ScheduledEntry[],
		summary: (publishedRun.summary ?? null) as Record<string, unknown> | null,
	};
}

async function loadReferenceMaps(schoolId: number, schoolYearId: number, sectionIds: number[]) {
	const [subjects, faculty, rooms, sectionSnapshot, sectionMirrors] = await Promise.all([
		prisma.subject.findMany({ where: { schoolId }, select: { id: true, code: true, name: true } }),
		prisma.facultyMirror.findMany({
			where: { schoolId },
			select: { id: true, firstName: true, lastName: true },
		}),
		prisma.room.findMany({
			where: { building: { schoolId } },
			select: { id: true, name: true, type: true, floor: true, building: { select: { id: true, name: true } } },
		}),
		prisma.sectionSnapshot.findUnique({
			where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
			select: { payload: true },
		}),
		prisma.sectionMirror.findMany({
			where: {
				schoolId,
				schoolYearId,
				...(sectionIds.length > 0 ? { externalId: { in: sectionIds } } : {}),
			},
			select: {
				externalId: true,
				name: true,
				gradeLevelId: true,
				gradeLevelName: true,
				programType: true,
				programCode: true,
				programName: true,
			},
		}),
	]);

	const sectionNameById = new Map<number, string>();
	if (sectionSnapshot?.payload && Array.isArray(sectionSnapshot.payload)) {
		for (const grade of sectionSnapshot.payload as Array<{ sections?: Array<{ id?: number; name?: string }> }>) {
			for (const section of grade.sections ?? []) {
				if (typeof section.id === 'number' && typeof section.name === 'string') {
					sectionNameById.set(section.id, section.name);
				}
			}
		}
	}

	const sectionById = new Map<number, SectionReference>();
	for (const section of sectionMirrors) {
		sectionById.set(section.externalId, {
			name: section.name,
			gradeLevel: section.gradeLevelId,
			gradeLevelName: section.gradeLevelName,
			programType: section.programType,
			programCode: section.programCode,
			programName: section.programName,
		});
	}

	return {
		subjectById: new Map(subjects.map((subject) => [subject.id, subject])),
		facultyById: new Map(faculty.map((member) => [member.id, `${member.lastName}, ${member.firstName}`])),
		roomById: new Map(rooms.map((room) => [room.id, room])),
		sectionById,
		sectionNameById,
	};
}

function buildSpecialEventsPayload(policy: Awaited<ReturnType<typeof getOrCreatePolicy>>) {
	const specialEvents = buildSpecialEventSlots({
		maxConsecutiveTeachingMinutesBeforeBreak: policy.maxConsecutiveTeachingMinutesBeforeBreak,
		minBreakMinutesAfterConsecutiveBlock: policy.minBreakMinutesAfterConsecutiveBlock,
		maxTeachingMinutesPerDay: policy.maxTeachingMinutesPerDay,
		earliestStartTime: policy.earliestStartTime,
		latestEndTime: policy.latestEndTime,
		lunchStartTime: policy.lunchStartTime ?? undefined,
		lunchEndTime: policy.lunchEndTime ?? undefined,
		enforceLunchWindow: policy.enforceLunchWindow ?? undefined,
		enableLunchWindow: policy.enableLunchWindow ?? undefined,
		enableFlagCeremony: policy.enableFlagCeremony ?? undefined,
		flagCeremonyStartTime: policy.flagCeremonyStartTime ?? undefined,
		flagCeremonyEndTime: policy.flagCeremonyEndTime ?? undefined,
		enableRecess: policy.enableRecess ?? undefined,
		recessStartTime: policy.recessStartTime ?? undefined,
		recessEndTime: policy.recessEndTime ?? undefined,
	});

	return specialEvents.map((event) => ({
		eventName: event.eventName,
		startTime: event.startTime,
		endTime: event.endTime,
		days: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
	}));
}

export async function getPublishedSchedulePayload(schoolId: number, schoolYearId?: number) {
	const resolved = await resolvePublishedRun(schoolId, schoolYearId);
	const policy = await getOrCreatePolicy(resolved.source.schoolId, resolved.source.schoolYearId);
	const sectionIds = Array.from(new Set(resolved.entries.map((entry) => entry.sectionId)));
	const references = await loadReferenceMaps(resolved.source.schoolId, resolved.source.schoolYearId, sectionIds);

	const entries = resolved.entries.map((entry) => {
		const subject = references.subjectById.get(entry.subjectId);
		const room = references.roomById.get(entry.roomId);
		const section = references.sectionById.get(entry.sectionId);
		return {
			entryId: entry.entryId,
			day: entry.day,
			startTime: entry.startTime,
			endTime: entry.endTime,
			durationMinutes: entry.durationMinutes,
			subject: {
				id: entry.subjectId,
				code: subject?.code ?? `SUBJECT_${entry.subjectId}`,
				name: subject?.name ?? 'Unknown Subject',
			},
			section: {
				id: entry.sectionId,
				name: section?.name ?? references.sectionNameById.get(entry.sectionId) ?? `Section #${entry.sectionId}`,
				gradeLevel: section?.gradeLevel ?? null,
				gradeLevelName: section?.gradeLevelName ?? null,
				programType: section?.programType ?? null,
				programCode: section?.programCode ?? null,
				programName: section?.programName ?? null,
			},
			faculty: {
				id: entry.facultyId,
				name: entry.facultyId != null
					? (references.facultyById.get(entry.facultyId) ?? `Faculty #${entry.facultyId}`)
					: 'Unassigned Faculty',
			},
			room: {
				id: entry.roomId,
				name: room?.name ?? `Room #${entry.roomId}`,
				type: room?.type ?? 'UNKNOWN',
				floor: room?.floor ?? null,
				buildingId: room?.building.id ?? null,
				buildingName: room?.building.name ?? null,
			},
			entryKind: entry.entryKind ?? 'SECTION',
			cohortCode: entry.cohortCode ?? null,
		};
	});

	const summaryDisplaySlots = Array.isArray(resolved.summary?.timetableDisplaySlots)
		? (resolved.summary?.timetableDisplaySlots as Array<{ startTime: string; endTime: string; eventName?: string; isSpecialEvent?: boolean }>)
		: [];
	const timeSlots = summaryDisplaySlots.length > 0
		? summaryDisplaySlots
		: Array.from(new Set(entries.map((entry) => `${entry.startTime}-${entry.endTime}`)))
			.map((key) => {
				const [startTime, endTime] = key.split('-');
				return { startTime, endTime };
			})
			.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));

	return {
		source: resolved.source,
		timeSlots,
		specialEvents: buildSpecialEventsPayload(policy),
		entries,
	};
}

export async function getPublishedSectionSchedule(schoolId: number, sectionId: number, schoolYearId?: number) {
	const payload = await getPublishedSchedulePayload(schoolId, schoolYearId);
	return {
		...payload,
		entries: payload.entries.filter((entry) => entry.section.id === sectionId),
	};
}

export async function getPublishedFacultySchedule(schoolId: number, facultyId: number, schoolYearId?: number) {
	const payload = await getPublishedSchedulePayload(schoolId, schoolYearId);
	return {
		...payload,
		entries: payload.entries.filter((entry) => entry.faculty.id === facultyId),
	};
}

export async function getPublishedRoomSchedule(schoolId: number, roomId: number, schoolYearId?: number) {
	const payload = await getPublishedSchedulePayload(schoolId, schoolYearId);
	return {
		...payload,
		entries: payload.entries.filter((entry) => entry.room.id === roomId),
	};
}
