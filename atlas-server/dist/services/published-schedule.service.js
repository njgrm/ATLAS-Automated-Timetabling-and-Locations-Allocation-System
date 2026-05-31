import { prisma } from '../lib/prisma.js';
import { buildSpecialEventSlots } from './schedule-constructor.js';
import { getOrCreatePolicy } from './scheduling-policy.service.js';
import { reconcileInvalidPublishedRunStates } from './generation.service.js';
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
function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function resolveReadDate(value) {
    if (value == null || value === '') {
        return { readDate: new Date(), requestedDate: null };
    }
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
            throw err(400, 'PUBLISHED_SCHEDULE_DATE_INVALID', 'Published schedule date must be a valid date.');
        }
        return { readDate: value, requestedDate: value.toISOString() };
    }
    const requestedDate = value.trim();
    if (!requestedDate)
        return { readDate: new Date(), requestedDate: null };
    const readDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
        ? new Date(`${requestedDate}T12:00:00.000Z`)
        : new Date(requestedDate);
    if (Number.isNaN(readDate.getTime())) {
        throw err(400, 'PUBLISHED_SCHEDULE_DATE_INVALID', 'Published schedule date must be a valid date or ISO date string.');
    }
    return { readDate, requestedDate };
}
function readRevisionChanges(changeSet) {
    if (!Array.isArray(changeSet))
        return [];
    return changeSet.flatMap((change) => {
        if (!isRecord(change))
            return [];
        const entryId = typeof change.entryId === 'string' ? change.entryId.trim() : '';
        if (!entryId || !isRecord(change.next))
            return [];
        return [{ entryId, next: change.next }];
    });
}
const REVISION_ENTRY_FIELDS = new Set([
    'facultyId',
    'roomId',
    'subjectId',
    'subjectCode',
    'sectionId',
    'day',
    'startTime',
    'endTime',
    'durationMinutes',
    'termIndex',
    'entryKind',
    'programType',
    'programCode',
    'programName',
    'cohortCode',
    'cohortName',
    'specializationCode',
    'specializationName',
    'cohortMemberSectionIds',
    'cohortExpectedEnrollment',
    'adviserId',
    'adviserName',
    'metadata',
]);
function applyRevisionValues(entry, nextValues) {
    const nextEntry = { ...entry };
    for (const [key, value] of Object.entries(nextValues)) {
        if (!REVISION_ENTRY_FIELDS.has(key) || value === undefined)
            continue;
        nextEntry[key] = value;
    }
    return nextEntry;
}
function applyPublishedRevisions(entries, revisions) {
    if (revisions.length === 0)
        return entries;
    const entriesById = new Map(entries.map((entry) => [entry.entryId, entry]));
    let changed = false;
    for (const revision of revisions) {
        for (const change of readRevisionChanges(revision.changeSet)) {
            const current = entriesById.get(change.entryId);
            if (!current)
                continue;
            entriesById.set(change.entryId, applyRevisionValues(current, change.next));
            changed = true;
        }
    }
    return changed ? entries.map((entry) => entriesById.get(entry.entryId) ?? entry) : entries;
}
function buildRevisionMarker(params) {
    return [
        `run=${params.runId}`,
        `published=${params.publishedAt ?? 'none'}`,
        `revision=${params.activeRevisionId ?? 'base'}`,
        `effective=${params.activeRevisionEffectiveDate ?? 'none'}`,
        `date=${params.resolvedForDate.slice(0, 10)}`,
    ].join('|');
}
async function resolvePublishedRun(schoolId, schoolYearId, options) {
    await reconcileInvalidPublishedRunStates(schoolId, {
        schoolYearId,
        reason: 'PUBLISHED_ENDPOINT_INTEGRITY_RECONCILIATION',
    });
    const { readDate, requestedDate } = resolveReadDate(options?.requestedDate);
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
    const applicableRevisions = await prisma.publishedScheduleRevision.findMany({
        where: {
            schoolId: publishedRun.schoolId,
            schoolYearId: publishedRun.schoolYearId,
            sourceRunId: publishedRun.id,
            status: { in: ['SCHEDULED', 'SUPERSEDED'] },
            effectiveDate: { lte: readDate },
        },
        orderBy: [{ effectiveDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: {
            id: true,
            effectiveDate: true,
            changeSet: true,
        },
    });
    const activeRevision = applicableRevisions.at(-1) ?? null;
    const publishedAt = readPublishedAt(publishedRun.summary);
    const generatedAt = publishedRun.finishedAt?.toISOString() ?? publishedRun.createdAt.toISOString();
    const resolvedForDate = readDate.toISOString();
    const activeRevisionEffectiveDate = activeRevision?.effectiveDate.toISOString() ?? null;
    return {
        source: {
            runId: publishedRun.id,
            schoolId: publishedRun.schoolId,
            schoolYearId: publishedRun.schoolYearId,
            publishedAt,
            generatedAt,
            requestedDate,
            resolvedForDate,
            activeRevisionId: activeRevision?.id ?? null,
            activeRevisionEffectiveDate,
            appliedRevisionIds: applicableRevisions.map((revision) => revision.id),
            revisionMarker: buildRevisionMarker({
                runId: publishedRun.id,
                publishedAt,
                activeRevisionId: activeRevision?.id ?? null,
                activeRevisionEffectiveDate,
                resolvedForDate,
            }),
        },
        entries: applyPublishedRevisions((publishedRun.draftEntries ?? []), applicableRevisions),
        summary: (publishedRun.summary ?? null),
    };
}
async function loadReferenceMaps(schoolId, schoolYearId, sectionIds, subjectIds) {
    const [subjects, faculty, rooms, sectionSnapshot, sectionMirrors, cohorts, ownershipRows] = await Promise.all([
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
        prisma.instructionalCohort.findMany({
            where: { schoolId, schoolYearId, isActive: true },
            select: {
                cohortCode: true,
                specializationCode: true,
                specializationName: true,
            },
        }),
        sectionIds.length > 0 && subjectIds.length > 0
            ? prisma.subjectSectionOwnership.findMany({
                where: {
                    schoolId,
                    sectionId: { in: sectionIds },
                    subjectId: { in: subjectIds },
                    OR: [
                        { specializationCode: { not: null } },
                        { specializationLabel: { not: null } },
                    ],
                },
                select: {
                    subjectId: true,
                    sectionId: true,
                    specializationCode: true,
                    specializationLabel: true,
                },
            })
            : Promise.resolve([]),
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
    const sectionById = new Map();
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
    const specializationBySubjectSection = new Map();
    for (const row of ownershipRows) {
        const key = `${row.subjectId}:${row.sectionId}`;
        if (specializationBySubjectSection.has(key))
            continue;
        specializationBySubjectSection.set(key, {
            specializationCode: row.specializationCode ?? null,
            specializationLabel: row.specializationLabel ?? null,
        });
    }
    const cohortByCode = new Map(cohorts.map((cohort) => [cohort.cohortCode, {
            specializationCode: cohort.specializationCode,
            specializationName: cohort.specializationName,
        }]));
    return {
        subjectById: new Map(subjects.map((subject) => [subject.id, subject])),
        facultyById: new Map(faculty.map((member) => [member.id, `${member.lastName}, ${member.firstName}`])),
        roomById: new Map(rooms.map((room) => [room.id, room])),
        sectionById,
        sectionNameById,
        cohortByCode,
        specializationBySubjectSection,
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
export async function getPublishedSchedulePayload(schoolId, schoolYearId, options) {
    const resolved = await resolvePublishedRun(schoolId, schoolYearId, options);
    const policy = await getOrCreatePolicy(resolved.source.schoolId, resolved.source.schoolYearId);
    const sectionIds = Array.from(new Set(resolved.entries.map((entry) => entry.sectionId)));
    const subjectIds = Array.from(new Set(resolved.entries.map((entry) => entry.subjectId)));
    const references = await loadReferenceMaps(resolved.source.schoolId, resolved.source.schoolYearId, sectionIds, subjectIds);
    const entries = resolved.entries.map((entry) => {
        const subject = references.subjectById.get(entry.subjectId);
        const room = references.roomById.get(entry.roomId);
        const section = references.sectionById.get(entry.sectionId);
        const cohort = entry.cohortCode ? references.cohortByCode.get(entry.cohortCode) : null;
        const ownershipSpecialization = references.specializationBySubjectSection.get(`${entry.subjectId}:${entry.sectionId}`);
        const specializationCode = cohort?.specializationCode ?? ownershipSpecialization?.specializationCode ?? null;
        const specializationLabel = cohort?.specializationName ?? ownershipSpecialization?.specializationLabel ?? null;
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
            cohortName: entry.cohortName ?? cohort?.specializationName ?? null,
            specializationCode,
            specializationLabel,
        };
    });
    const summaryDisplaySlots = Array.isArray(resolved.summary?.timetableDisplaySlots)
        ? resolved.summary?.timetableDisplaySlots
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
export async function getPublishedSectionSchedule(schoolId, sectionId, schoolYearId, options) {
    const payload = await getPublishedSchedulePayload(schoolId, schoolYearId, options);
    return {
        ...payload,
        entries: payload.entries.filter((entry) => entry.section.id === sectionId),
    };
}
export async function getPublishedFacultySchedule(schoolId, facultyId, schoolYearId, options) {
    const payload = await getPublishedSchedulePayload(schoolId, schoolYearId, options);
    return {
        ...payload,
        entries: payload.entries.filter((entry) => entry.faculty.id === facultyId),
    };
}
export async function getPublishedRoomSchedule(schoolId, roomId, schoolYearId, options) {
    const payload = await getPublishedSchedulePayload(schoolId, schoolYearId, options);
    return {
        ...payload,
        entries: payload.entries.filter((entry) => entry.room.id === roomId),
    };
}
//# sourceMappingURL=published-schedule.service.js.map