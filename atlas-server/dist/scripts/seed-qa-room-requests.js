import { prisma } from '../lib/prisma.js';
import * as generationService from '../services/generation.service.js';
import * as manualEditService from '../services/manual-edit.service.js';
import * as roomPreferenceService from '../services/room-preference.service.js';
function usage() {
    throw new Error('Usage: npx tsx src/scripts/seed-qa-room-requests.ts --schoolId=N --schoolYearId=N');
}
function parseCliArgs(argv) {
    const values = new Map();
    for (const arg of argv) {
        if (!arg.startsWith('--'))
            continue;
        const [rawKey, rawValue] = arg.slice(2).split('=', 2);
        values.set(rawKey, rawValue ?? true);
    }
    return values;
}
function getRequiredInt(args, key) {
    const rawValue = args.get(key);
    if (typeof rawValue !== 'string')
        usage();
    const value = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`--${key} must be a positive integer.`);
    }
    return value;
}
async function loadTeachingRooms(schoolId) {
    return prisma.room.findMany({
        where: {
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
        orderBy: [{ buildingId: 'asc' }, { floor: 'asc' }, { floorPosition: 'asc' }, { id: 'asc' }],
    });
}
function roomLabel(room) {
    return `${room.name} · ${room.building.shortCode || room.building.name}`;
}
function buildSlotOccupancyMap(entries) {
    const occupancy = new Map();
    for (const entry of entries) {
        const slotKey = `${entry.day}:${entry.startTime}:${entry.endTime}`;
        const occupiedRooms = occupancy.get(slotKey) ?? new Set();
        occupiedRooms.add(entry.roomId);
        occupancy.set(slotKey, occupiedRooms);
    }
    return occupancy;
}
async function findApprovableCandidate(schoolId, schoolYearId, runId, entries, rooms) {
    const roomById = new Map(rooms.map((room) => [room.id, room]));
    const slotOccupancy = buildSlotOccupancyMap(entries);
    for (const entry of entries) {
        const currentRoom = roomById.get(entry.roomId);
        if (!currentRoom)
            continue;
        const slotKey = `${entry.day}:${entry.startTime}:${entry.endTime}`;
        const occupiedRooms = slotOccupancy.get(slotKey) ?? new Set();
        const slotCompatibleRooms = rooms.filter((room) => room.id !== entry.roomId && !occupiedRooms.has(room.id));
        const prioritizedRooms = [
            ...slotCompatibleRooms.filter((room) => room.type === currentRoom.type),
            ...slotCompatibleRooms.filter((room) => room.type !== currentRoom.type),
        ].slice(0, 8);
        for (const room of prioritizedRooms) {
            const preview = await manualEditService.previewManualEdit(runId, schoolId, schoolYearId, {
                editType: 'CHANGE_ROOM',
                entryId: entry.entryId,
                targetRoomId: room.id,
            });
            if (preview.allowed) {
                return {
                    entryId: entry.entryId,
                    facultyId: entry.facultyId,
                    requestedRoomId: room.id,
                    requestedRoomLabel: roomLabel(room),
                    preview,
                };
            }
        }
    }
    return null;
}
async function findBlockedCandidate(schoolId, schoolYearId, runId, entries, roomById) {
    for (const sourceEntry of entries) {
        for (const conflictingEntry of entries) {
            if (sourceEntry.entryId === conflictingEntry.entryId)
                continue;
            if (sourceEntry.day !== conflictingEntry.day)
                continue;
            if (sourceEntry.startTime !== conflictingEntry.startTime)
                continue;
            if (sourceEntry.endTime !== conflictingEntry.endTime)
                continue;
            if (sourceEntry.roomId === conflictingEntry.roomId)
                continue;
            const targetRoom = roomById.get(conflictingEntry.roomId);
            if (!targetRoom)
                continue;
            const preview = await manualEditService.previewManualEdit(runId, schoolId, schoolYearId, {
                editType: 'CHANGE_ROOM',
                entryId: sourceEntry.entryId,
                targetRoomId: conflictingEntry.roomId,
            });
            if (!preview.allowed) {
                return {
                    entryId: sourceEntry.entryId,
                    facultyId: sourceEntry.facultyId,
                    requestedRoomId: conflictingEntry.roomId,
                    requestedRoomLabel: roomLabel(targetRoom),
                    preview,
                };
            }
        }
    }
    return null;
}
async function ensureSubmittedRequest(input) {
    const existing = await prisma.facultyRoomPreference.findUnique({
        where: { runId_entryId: { runId: input.runId, entryId: input.entryId } },
        select: { version: true },
    });
    await roomPreferenceService.submitRoomPreference({
        schoolId: input.schoolId,
        schoolYearId: input.schoolYearId,
        runId: input.runId,
        facultyId: input.facultyId,
        entryId: input.entryId,
        requestedRoomId: input.requestedRoomId,
        rationale: input.rationale,
        expectedRunVersion: input.runVersion,
        requestVersion: existing?.version,
    });
    const request = await prisma.facultyRoomPreference.findUnique({
        where: { runId_entryId: { runId: input.runId, entryId: input.entryId } },
        select: { id: true, version: true, decisionStatus: true, status: true },
    });
    if (!request) {
        throw new Error(`Failed to create room preference for entry ${input.entryId}.`);
    }
    return request;
}
async function main() {
    const args = parseCliArgs(process.argv.slice(2));
    const schoolId = getRequiredInt(args, 'schoolId');
    const schoolYearId = getRequiredInt(args, 'schoolYearId');
    const run = await generationService.assertLatestRunIsCurrent(schoolId, schoolYearId);
    const draft = await generationService.getRunDraft(run.id, schoolId, schoolYearId);
    const rooms = await loadTeachingRooms(schoolId);
    const roomById = new Map(rooms.map((room) => [room.id, room]));
    const entries = draft.entries.filter((entry) => roomById.has(entry.roomId));
    if (entries.length === 0) {
        throw new Error('No draft entries with teaching-room assignments were found in the latest run.');
    }
    const approvableCandidate = await findApprovableCandidate(schoolId, schoolYearId, run.id, entries, rooms);
    if (!approvableCandidate) {
        throw new Error('Unable to find an approvable room-request candidate in the latest run.');
    }
    const blockedCandidate = await findBlockedCandidate(schoolId, schoolYearId, run.id, entries, roomById);
    if (!blockedCandidate) {
        throw new Error('Unable to find a preview-blocked room-request candidate in the latest run.');
    }
    if (approvableCandidate.entryId === blockedCandidate.entryId) {
        throw new Error('QA seeding selected the same entry for both approvable and blocked requests. Rerun after refreshing the dataset.');
    }
    const approvableRequest = await ensureSubmittedRequest({
        schoolId,
        schoolYearId,
        runId: run.id,
        runVersion: draft.version,
        entryId: approvableCandidate.entryId,
        facultyId: approvableCandidate.facultyId,
        requestedRoomId: approvableCandidate.requestedRoomId,
        rationale: '[QA seed] Approvable room request for timetable review evidence.',
    });
    const blockedRequest = await ensureSubmittedRequest({
        schoolId,
        schoolYearId,
        runId: run.id,
        runVersion: draft.version,
        entryId: blockedCandidate.entryId,
        facultyId: blockedCandidate.facultyId,
        requestedRoomId: blockedCandidate.requestedRoomId,
        rationale: '[QA seed] Blocked room request for timetable review evidence.',
    });
    const output = {
        schoolId,
        schoolYearId,
        runId: run.id,
        runVersion: draft.version,
        approvableRequest: {
            requestId: approvableRequest.id,
            entryId: approvableCandidate.entryId,
            requestedRoomId: approvableCandidate.requestedRoomId,
            requestedRoom: approvableCandidate.requestedRoomLabel,
            allowed: approvableCandidate.preview.allowed,
            hardConflicts: approvableCandidate.preview.hardViolations.length,
            softWarnings: approvableCandidate.preview.softViolations.length,
        },
        blockedRequest: {
            requestId: blockedRequest.id,
            entryId: blockedCandidate.entryId,
            requestedRoomId: blockedCandidate.requestedRoomId,
            requestedRoom: blockedCandidate.requestedRoomLabel,
            allowed: blockedCandidate.preview.allowed,
            hardConflicts: blockedCandidate.preview.hardViolations.length,
            softWarnings: blockedCandidate.preview.softViolations.length,
            reasons: blockedCandidate.preview.humanConflicts.map((conflict) => conflict.humanTitle),
        },
    };
    console.log(JSON.stringify(output, null, 2));
}
main()
    .catch((error) => {
    console.error('[seed-qa-room-requests] Failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-qa-room-requests.js.map