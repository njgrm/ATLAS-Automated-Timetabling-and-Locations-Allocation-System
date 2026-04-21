import { prisma } from '../lib/prisma.js';
import * as generationService from './generation.service.js';
import * as manualEditService from './manual-edit.service.js';
function err(statusCode, code, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    return error;
}
function buildEntryMap(entries) {
    return new Map(entries.map((entry) => [entry.entryId, entry]));
}
async function getRunDraftWithVersion(runId, schoolId, schoolYearId) {
    const draft = await generationService.getRunDraft(runId, schoolId, schoolYearId);
    return draft;
}
function assertRunVersion(actualVersion, expectedVersion) {
    if (expectedVersion != null && actualVersion !== expectedVersion) {
        throw err(409, 'VERSION_CONFLICT', `Run version conflict: expected ${expectedVersion}, actual ${actualVersion}. Please reload and retry.`);
    }
}
function assertRequestVersion(actualVersion, expectedVersion) {
    if (expectedVersion != null && actualVersion !== expectedVersion) {
        throw err(409, 'VERSION_CONFLICT', `Request version conflict: expected ${expectedVersion}, actual ${actualVersion}. Please reload and retry.`);
    }
}
async function getTeachingRoom(schoolId, roomId) {
    const room = await prisma.room.findFirst({
        where: {
            id: roomId,
            isTeachingSpace: true,
            building: {
                schoolId,
                isTeachingBuilding: true,
            },
        },
        include: {
            building: {
                select: { name: true, shortCode: true },
            },
        },
    });
    if (!room) {
        throw err(404, 'ROOM_NOT_FOUND', 'Requested room was not found in this school or is not a teaching space.');
    }
    return room;
}
function ensureFacultyOwnsEntry(entry, facultyId) {
    if (!entry) {
        throw err(404, 'ENTRY_NOT_FOUND', 'Draft entry was not found in this generation run.');
    }
    if (entry.facultyId !== facultyId) {
        throw err(403, 'FORBIDDEN', 'This draft entry is not assigned to the requested faculty member.');
    }
    return entry;
}
async function buildLookupMaps(schoolId, entryIds, entries) {
    const subjectIds = [...new Set(entries.map((entry) => entry.subjectId))];
    const sectionIds = [...new Set(entries.map((entry) => entry.sectionId))];
    const roomIds = [...new Set(entries.map((entry) => entry.roomId))];
    const [subjects, snapshot, rooms] = await Promise.all([
        prisma.subject.findMany({
            where: { schoolId, id: { in: subjectIds } },
            select: { id: true, code: true, name: true },
        }),
        prisma.sectionSnapshot.findFirst({
            where: { schoolId },
            orderBy: { fetchedAt: 'desc' },
            select: { payload: true },
        }),
        prisma.room.findMany({
            where: { id: { in: roomIds } },
            select: {
                id: true,
                name: true,
                building: { select: { name: true, shortCode: true } },
            },
        }),
    ]);
    const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
    const sectionMap = new Map();
    if (Array.isArray(snapshot?.payload)) {
        for (const grade of snapshot.payload) {
            for (const section of grade.sections ?? []) {
                if (sectionIds.includes(section.id)) {
                    sectionMap.set(section.id, section.name);
                }
            }
        }
    }
    const roomMap = new Map(rooms.map((room) => [
        room.id,
        `${room.name} · ${room.building.shortCode || room.building.name}`,
    ]));
    return { subjectMap, sectionMap, roomMap };
}
export async function getFacultyRoomPreferenceState(schoolId, schoolYearId, runId, facultyId) {
    const draft = await getRunDraftWithVersion(runId, schoolId, schoolYearId);
    const assignedEntries = draft.entries
        .filter((entry) => entry.facultyId === facultyId)
        .sort((left, right) => left.day.localeCompare(right.day)
        || left.startTime.localeCompare(right.startTime)
        || left.subjectId - right.subjectId);
    const requests = await prisma.facultyRoomPreference.findMany({
        where: { schoolId, schoolYearId, runId, facultyId },
        include: {
            requestedRoom: {
                select: {
                    id: true,
                    name: true,
                    building: { select: { name: true, shortCode: true } },
                },
            },
        },
    });
    const requestMap = new Map(requests.map((request) => [request.entryId, request]));
    const { subjectMap, sectionMap, roomMap } = await buildLookupMaps(schoolId, assignedEntries.map((entry) => entry.entryId), assignedEntries);
    return {
        runId: draft.runId,
        runVersion: draft.version,
        entries: assignedEntries.map((entry) => {
            const request = requestMap.get(entry.entryId);
            return {
                entryId: entry.entryId,
                subjectId: entry.subjectId,
                sectionId: entry.sectionId,
                facultyId: entry.facultyId,
                currentRoomId: entry.roomId,
                currentRoomName: roomMap.get(entry.roomId) ?? `Room #${entry.roomId}`,
                requestedRoomId: request?.requestedRoomId ?? null,
                requestedRoomName: request
                    ? `${request.requestedRoom.name} · ${request.requestedRoom.building.shortCode || request.requestedRoom.building.name}`
                    : null,
                day: entry.day,
                startTime: entry.startTime,
                endTime: entry.endTime,
                durationMinutes: entry.durationMinutes,
                status: request?.status ?? null,
                decisionStatus: request?.decisionStatus ?? null,
                rationale: request?.rationale ?? null,
                submittedAt: request?.submittedAt?.toISOString() ?? null,
                version: request?.version ?? null,
                subjectCode: subjectMap.get(entry.subjectId)?.code ?? `Subject #${entry.subjectId}`,
                subjectName: subjectMap.get(entry.subjectId)?.name ?? `Subject #${entry.subjectId}`,
                sectionName: sectionMap.get(entry.sectionId) ?? `Section #${entry.sectionId}`,
                requestId: request?.id ?? null,
                reviewerNotes: request?.reviewerNotes ?? null,
                reviewedAt: request?.reviewedAt?.toISOString() ?? null,
                entryKind: entry.entryKind,
                cohortCode: entry.cohortCode ?? null,
                cohortName: entry.cohortName ?? null,
                programCode: entry.programCode ?? null,
                programName: entry.programName ?? null,
            };
        }),
    };
}
export async function getLatestFacultyRoomPreferenceState(schoolId, schoolYearId, facultyId) {
    const run = await generationService.assertLatestRunIsCurrent(schoolId, schoolYearId);
    return getFacultyRoomPreferenceState(schoolId, schoolYearId, run.id, facultyId);
}
async function upsertRoomPreference(input, status) {
    const draft = await getRunDraftWithVersion(input.runId, input.schoolId, input.schoolYearId);
    assertRunVersion(draft.version, input.expectedRunVersion);
    const entryMap = buildEntryMap(draft.entries);
    const entry = ensureFacultyOwnsEntry(entryMap.get(input.entryId), input.facultyId);
    const requestedRoom = await getTeachingRoom(input.schoolId, input.requestedRoomId);
    const existing = await prisma.facultyRoomPreference.findUnique({
        where: { runId_entryId: { runId: input.runId, entryId: input.entryId } },
    });
    if (existing && existing.facultyId !== input.facultyId) {
        throw err(403, 'FORBIDDEN', 'This room preference belongs to a different faculty member.');
    }
    if (existing?.decisionStatus === 'APPROVED') {
        throw err(422, 'ALREADY_APPROVED', 'An approved room preference can no longer be modified.');
    }
    assertRequestVersion(existing?.version ?? 1, input.requestVersion);
    const data = {
        schoolId: input.schoolId,
        schoolYearId: input.schoolYearId,
        runId: input.runId,
        entryId: input.entryId,
        facultyId: input.facultyId,
        subjectId: entry.subjectId,
        sectionId: entry.sectionId,
        currentRoomId: entry.roomId,
        requestedRoomId: requestedRoom.id,
        day: entry.day,
        startTime: entry.startTime,
        endTime: entry.endTime,
        rationale: input.rationale ?? null,
        status,
        submittedAt: status === 'SUBMITTED' ? new Date() : null,
        decisionStatus: 'PENDING',
        reviewerId: null,
        reviewerNotes: null,
        reviewedAt: null,
    };
    const preference = existing
        ? await prisma.facultyRoomPreference.update({
            where: { id: existing.id },
            data: {
                ...data,
                version: { increment: 1 },
            },
        })
        : await prisma.facultyRoomPreference.create({
            data,
        });
    await prisma.auditLog.create({
        data: {
            schoolId: input.schoolId,
            schoolYearId: input.schoolYearId,
            action: status === 'SUBMITTED' ? 'ROOM_PREFERENCE_SUBMITTED' : 'ROOM_PREFERENCE_DRAFT_SAVED',
            actorId: input.facultyId,
            targetIds: [input.runId, preference.id],
            metadata: {
                entryId: input.entryId,
                requestedRoomId: requestedRoom.id,
                status,
            },
        },
    });
    return getFacultyRoomPreferenceState(input.schoolId, input.schoolYearId, input.runId, input.facultyId);
}
export async function saveRoomPreferenceDraft(input) {
    return upsertRoomPreference(input, 'DRAFT');
}
export async function submitRoomPreference(input) {
    return upsertRoomPreference(input, 'SUBMITTED');
}
export async function deleteRoomPreferenceDraft(schoolId, schoolYearId, runId, facultyId, entryId, requestVersion) {
    const existing = await prisma.facultyRoomPreference.findUnique({
        where: { runId_entryId: { runId, entryId } },
    });
    if (!existing || existing.schoolId !== schoolId || existing.schoolYearId !== schoolYearId) {
        throw err(404, 'ROOM_PREFERENCE_NOT_FOUND', 'Room preference request was not found in this run scope.');
    }
    if (existing.facultyId !== facultyId) {
        throw err(403, 'FORBIDDEN', 'This room preference belongs to a different faculty member.');
    }
    if (existing.decisionStatus === 'APPROVED') {
        throw err(422, 'ALREADY_APPROVED', 'An approved room preference can no longer be deleted.');
    }
    assertRequestVersion(existing.version, requestVersion);
    await prisma.facultyRoomPreference.delete({ where: { id: existing.id } });
    await prisma.auditLog.create({
        data: {
            schoolId,
            schoolYearId,
            action: 'ROOM_PREFERENCE_DELETED',
            actorId: facultyId,
            targetIds: [runId, existing.id],
            metadata: {
                entryId,
                requestedRoomId: existing.requestedRoomId,
            },
        },
    });
    return getFacultyRoomPreferenceState(schoolId, schoolYearId, runId, facultyId);
}
export async function getRoomPreferenceSummary(schoolId, schoolYearId, runId, filters) {
    const draft = await getRunDraftWithVersion(runId, schoolId, schoolYearId);
    const entryMap = buildEntryMap(draft.entries);
    const requests = await prisma.facultyRoomPreference.findMany({
        where: {
            schoolId,
            schoolYearId,
            runId,
            status: filters?.status,
            decisionStatus: filters?.decisionStatus,
            facultyId: filters?.facultyId,
            requestedRoomId: filters?.requestedRoomId,
        },
        include: {
            faculty: { select: { firstName: true, lastName: true } },
            requestedRoom: {
                select: {
                    id: true,
                    name: true,
                    building: { select: { name: true, shortCode: true } },
                },
            },
        },
        orderBy: [{ submittedAt: 'desc' }, { updatedAt: 'desc' }],
    });
    const currentRoomIds = [...new Set(requests.map((request) => request.currentRoomId))];
    const [currentRooms, subjects, snapshot] = await Promise.all([
        prisma.room.findMany({
            where: { id: { in: currentRoomIds } },
            select: {
                id: true,
                name: true,
                building: { select: { name: true, shortCode: true } },
            },
        }),
        prisma.subject.findMany({
            where: { schoolId, id: { in: [...new Set(requests.map((request) => request.subjectId))] } },
            select: { id: true, code: true, name: true },
        }),
        prisma.sectionSnapshot.findFirst({
            where: { schoolId },
            orderBy: { fetchedAt: 'desc' },
            select: { payload: true },
        }),
    ]);
    const currentRoomMap = new Map(currentRooms.map((room) => [room.id, `${room.name} · ${room.building.shortCode || room.building.name}`]));
    const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
    const sectionMap = new Map();
    if (Array.isArray(snapshot?.payload)) {
        for (const grade of snapshot.payload) {
            for (const section of grade.sections ?? []) {
                sectionMap.set(section.id, section.name);
            }
        }
    }
    const mappedRequests = requests.map((request) => {
        const entry = entryMap.get(request.entryId);
        const subject = subjectMap.get(request.subjectId);
        return {
            id: request.id,
            runId: request.runId,
            entryId: request.entryId,
            facultyId: request.facultyId,
            facultyName: `${request.faculty.lastName}, ${request.faculty.firstName}`,
            subjectId: request.subjectId,
            subjectCode: subject?.code ?? `Subject #${request.subjectId}`,
            subjectName: subject?.name ?? `Subject #${request.subjectId}`,
            sectionId: request.sectionId,
            sectionName: sectionMap.get(request.sectionId) ?? `Section #${request.sectionId}`,
            currentRoomId: request.currentRoomId,
            currentRoomName: currentRoomMap.get(request.currentRoomId) ?? `Room #${request.currentRoomId}`,
            requestedRoomId: request.requestedRoomId,
            requestedRoomName: `${request.requestedRoom.name} · ${request.requestedRoom.building.shortCode || request.requestedRoom.building.name}`,
            day: request.day,
            startTime: request.startTime,
            endTime: request.endTime,
            status: request.status,
            decisionStatus: request.decisionStatus,
            rationale: request.rationale,
            submittedAt: request.submittedAt?.toISOString() ?? null,
            version: request.version,
            reviewerId: request.reviewerId,
            reviewerNotes: request.reviewerNotes,
            reviewedAt: request.reviewedAt?.toISOString() ?? null,
            entryKind: entry?.entryKind,
            cohortCode: entry?.cohortCode ?? null,
            cohortName: entry?.cohortName ?? null,
            programCode: entry?.programCode ?? null,
            programName: entry?.programName ?? null,
        };
    });
    return {
        runId,
        counts: {
            total: requests.length,
            draft: requests.filter((request) => request.status === 'DRAFT').length,
            submitted: requests.filter((request) => request.status === 'SUBMITTED').length,
            pending: requests.filter((request) => request.decisionStatus === 'PENDING').length,
            approved: requests.filter((request) => request.decisionStatus === 'APPROVED').length,
            rejected: requests.filter((request) => request.decisionStatus === 'REJECTED').length,
        },
        requests: mappedRequests,
        runVersion: draft.version,
    };
}
export async function getLatestRoomPreferenceSummary(schoolId, schoolYearId, filters) {
    const run = await generationService.assertLatestRunIsCurrent(schoolId, schoolYearId);
    return getRoomPreferenceSummary(schoolId, schoolYearId, run.id, filters);
}
export async function getRoomPreferenceDetail(schoolId, schoolYearId, runId, requestId) {
    const summary = await getRoomPreferenceSummary(schoolId, schoolYearId, runId);
    const request = summary.requests.find((item) => item.id === requestId);
    if (!request) {
        throw err(404, 'ROOM_PREFERENCE_NOT_FOUND', 'Room preference request was not found in this run scope.');
    }
    return {
        request,
        runVersion: summary.runVersion,
    };
}
export async function previewRoomPreferenceDecision(schoolId, schoolYearId, runId, requestId) {
    const detail = await getRoomPreferenceDetail(schoolId, schoolYearId, runId, requestId);
    const preview = await manualEditService.previewManualEdit(runId, schoolId, schoolYearId, {
        editType: 'CHANGE_ROOM',
        entryId: detail.request.entryId,
        targetRoomId: detail.request.requestedRoomId,
    });
    return {
        request: detail.request,
        runVersion: detail.runVersion,
        preview,
    };
}
export async function reviewRoomPreference(input) {
    const request = await prisma.facultyRoomPreference.findFirst({
        where: {
            id: input.requestId,
            schoolId: input.schoolId,
            schoolYearId: input.schoolYearId,
            runId: input.runId,
        },
    });
    if (!request) {
        throw err(404, 'ROOM_PREFERENCE_NOT_FOUND', 'Room preference request was not found in this run scope.');
    }
    if (request.status !== 'SUBMITTED') {
        throw err(422, 'ROOM_PREFERENCE_NOT_SUBMITTED', 'Only submitted room preference requests can be reviewed.');
    }
    assertRequestVersion(request.version, input.requestVersion);
    let commitResult = null;
    if (input.decisionStatus === 'APPROVED') {
        if (input.expectedRunVersion == null) {
            throw err(400, 'INVALID_BODY', 'expectedRunVersion is required when approving a room preference request.');
        }
        commitResult = await manualEditService.commitManualEdit(input.runId, input.schoolId, input.schoolYearId, input.reviewerId, {
            editType: 'CHANGE_ROOM',
            entryId: request.entryId,
            targetRoomId: request.requestedRoomId,
        }, input.expectedRunVersion, !!input.allowSoftOverride);
    }
    const updated = await prisma.facultyRoomPreference.update({
        where: { id: request.id },
        data: {
            decisionStatus: input.decisionStatus,
            reviewerId: input.reviewerId,
            reviewerNotes: input.reviewerNotes ?? null,
            reviewedAt: new Date(),
            version: { increment: 1 },
        },
    });
    await prisma.auditLog.create({
        data: {
            schoolId: input.schoolId,
            schoolYearId: input.schoolYearId,
            action: input.decisionStatus === 'APPROVED' ? 'ROOM_PREFERENCE_APPROVED' : 'ROOM_PREFERENCE_REJECTED',
            actorId: input.reviewerId,
            targetIds: [input.runId, updated.id],
            metadata: {
                entryId: request.entryId,
                requestedRoomId: request.requestedRoomId,
                manualEditId: commitResult?.editId ?? null,
            },
        },
    });
    return {
        request: updated,
        commitResult,
    };
}
//# sourceMappingURL=room-preference.service.js.map