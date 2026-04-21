/**
 * Room schedule projection service.
 * Reads draft entries from generation runs and projects a room-centric timetable view.
 * Business logic only; no transport concerns.
 */
import { prisma } from '../lib/prisma.js';
import * as genService from './generation.service.js';
import { computeOccupiedMinutesByIntervalUnion, countUniqueEntryIds } from './room-schedule.metrics.js';
import { buildPeriodSlots } from './schedule-constructor.js';
import * as policyService from './scheduling-policy.service.js';
// ─── Constants ───
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
// ─── Helpers ───
function err(statusCode, code, message) {
    const e = new Error(message);
    e.statusCode = statusCode;
    e.code = code;
    return e;
}
function timesOverlap(a, b) {
    return a.startTime < b.endTime && b.startTime < a.endTime;
}
// ─── Service ───
export async function getRoomScheduleView(schoolId, schoolYearId, roomId, source) {
    // 1) Fetch room with building
    const room = await prisma.room.findFirst({
        where: { id: roomId, building: { schoolId } },
        include: { building: { select: { id: true, name: true } } },
    });
    if (!room)
        throw err(404, 'ROOM_NOT_FOUND', `Room ${roomId} not found in school ${schoolId}.`);
    // 2) Fetch policy to build dynamic time slots
    const policy = await policyService.getOrCreatePolicy(schoolId, schoolYearId);
    const PERIOD_SLOTS = buildPeriodSlots({
        maxConsecutiveTeachingMinutesBeforeBreak: policy.maxConsecutiveTeachingMinutesBeforeBreak,
        minBreakMinutesAfterConsecutiveBlock: policy.minBreakMinutesAfterConsecutiveBlock,
        maxTeachingMinutesPerDay: policy.maxTeachingMinutesPerDay,
        earliestStartTime: policy.earliestStartTime,
        latestEndTime: policy.latestEndTime,
        lunchStartTime: policy.lunchStartTime,
        lunchEndTime: policy.lunchEndTime,
        enforceLunchWindow: policy.enforceLunchWindow,
    });
    // 3) Fetch draft from generation run
    const draft = source.mode === 'LATEST'
        ? await genService.getLatestRunDraft(schoolId, schoolYearId)
        : await genService.getRunDraft(source.runId, schoolId, schoolYearId);
    // 4) Filter entries for this room
    const roomEntries = draft.entries.filter((e) => e.roomId === roomId);
    // 5) Build index: day -> entries[]
    const entriesByDay = new Map();
    for (const e of roomEntries) {
        const arr = entriesByDay.get(e.day) ?? [];
        arr.push(e);
        entriesByDay.set(e.day, arr);
    }
    // 6) Build grid row by row (time slot × day)
    let conflictCount = 0;
    const grid = PERIOD_SLOTS.map((slot) => {
        const cells = DAYS.map((day) => {
            const dayEntries = entriesByDay.get(day) ?? [];
            const overlapping = dayEntries.filter((e) => timesOverlap(slot, e));
            const mapped = overlapping.map((e) => ({
                entryId: e.entryId,
                subjectId: e.subjectId,
                sectionId: e.sectionId,
                facultyId: e.facultyId,
                startTime: e.startTime,
                endTime: e.endTime,
                durationMinutes: e.durationMinutes,
            }));
            const hasConflict = mapped.length > 1;
            if (hasConflict)
                conflictCount++;
            return {
                day,
                occupied: mapped.length > 0,
                entries: mapped,
                conflict: hasConflict,
            };
        });
        return { timeSlot: { startTime: slot.startTime, endTime: slot.endTime }, cells };
    });
    // 7) Summary — unique-entry aggregation to avoid per-cell inflation
    const entryCount = countUniqueEntryIds(roomEntries);
    const occupiedMinutes = computeOccupiedMinutesByIntervalUnion(roomEntries, DAYS);
    const totalSlots = PERIOD_SLOTS.length * DAYS.length;
    const slotMinutes = 50; // standard JHS period
    const availableMinutes = totalSlots * slotMinutes;
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
            runId: draft.runId,
            status: draft.status,
            generatedAt: draft.finishedAt ?? draft.createdAt,
        },
        timeSlots: PERIOD_SLOTS.map((s) => ({ startTime: s.startTime, endTime: s.endTime })),
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
//# sourceMappingURL=room-schedule.service.js.map