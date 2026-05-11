import { prisma } from '../lib/prisma.js';
import { buildSpecialEventSlots } from './schedule-constructor.js';
import { getOrCreatePolicy } from './scheduling-policy.service.js';
function err(statusCode, code, message) {
    const e = new Error(message);
    e.statusCode = statusCode;
    e.code = code;
    return e;
}
function readPublishedAt(summary) {
    if (!summary || typeof summary !== 'object')
        return null;
    const value = summary.publishedAt;
    return typeof value === 'string' && value.length > 0 ? value : null;
}
function isRunPublished(summary) {
    if (!summary || typeof summary !== 'object')
        return false;
    return summary.isPublished === true;
}
async function resolvePublishedRun(schoolId, schoolYearId) {
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
        },
        entries: (publishedRun.draftEntries ?? []),
    };
}
async function loadReferenceMaps(schoolId, schoolYearId) {
    const [subjects, faculty, rooms, sectionSnapshot] = await Promise.all([
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
    ]);
    const sectionNameById = new Map();
    if (sectionSnapshot?.payload && Array.isArray(sectionSnapshot.payload)) {
        for (const grade of sectionSnapshot.payload) {
            for (const section of grade.sections ?? []) {
                if (typeof section.id === 'number' && typeof section.name === 'string') {
                    sectionNameById.set(section.id, section.name);
                }
            }
        }
    }
    return {
        subjectById: new Map(subjects.map((subject) => [subject.id, subject])),
        facultyById: new Map(faculty.map((member) => [member.id, `${member.lastName}, ${member.firstName}`])),
        roomById: new Map(rooms.map((room) => [room.id, room])),
        sectionNameById,
    };
}
function buildSpecialEventsPayload(policy) {
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
export async function getPublishedSchedulePayload(schoolId, schoolYearId) {
    const resolved = await resolvePublishedRun(schoolId, schoolYearId);
    const policy = await getOrCreatePolicy(resolved.source.schoolId, resolved.source.schoolYearId);
    const references = await loadReferenceMaps(resolved.source.schoolId, resolved.source.schoolYearId);
    const entries = resolved.entries.map((entry) => {
        const subject = references.subjectById.get(entry.subjectId);
        const room = references.roomById.get(entry.roomId);
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
                name: references.sectionNameById.get(entry.sectionId) ?? `Section #${entry.sectionId}`,
            },
            faculty: {
                id: entry.facultyId,
                name: references.facultyById.get(entry.facultyId) ?? `Faculty #${entry.facultyId}`,
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
    return {
        source: resolved.source,
        specialEvents: buildSpecialEventsPayload(policy),
        entries,
    };
}
export async function getPublishedSectionSchedule(schoolId, sectionId, schoolYearId) {
    const payload = await getPublishedSchedulePayload(schoolId, schoolYearId);
    return {
        ...payload,
        entries: payload.entries.filter((entry) => entry.section.id === sectionId),
    };
}
export async function getPublishedFacultySchedule(schoolId, facultyId, schoolYearId) {
    const payload = await getPublishedSchedulePayload(schoolId, schoolYearId);
    return {
        ...payload,
        entries: payload.entries.filter((entry) => entry.faculty.id === facultyId),
    };
}
export async function getPublishedRoomSchedule(schoolId, roomId, schoolYearId) {
    const payload = await getPublishedSchedulePayload(schoolId, schoolYearId);
    return {
        ...payload,
        entries: payload.entries.filter((entry) => entry.room.id === roomId),
    };
}
//# sourceMappingURL=published-schedule.service.js.map