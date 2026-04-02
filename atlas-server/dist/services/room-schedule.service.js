/**
 * Room schedule projection service.
 * Reads draft entries from generation runs and projects a room-centric timetable view.
 * Business logic only; no transport concerns.
 */
import { prisma } from '../lib/prisma.js';
import * as genService from './generation.service.js';
// ─── Constants ───
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
const PERIOD_SLOTS = [
    { startTime: '07:30', endTime: '08:20' },
    { startTime: '08:20', endTime: '09:10' },
    { startTime: '09:10', endTime: '10:00' },
    { startTime: '10:15', endTime: '11:05' },
    { startTime: '11:05', endTime: '11:55' },
    { startTime: '12:55', endTime: '13:45' },
    { startTime: '13:45', endTime: '14:35' },
    { startTime: '14:35', endTime: '15:25' },
];
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
function timeToMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
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
    // 2) Fetch draft from generation run
    const draft = source.mode === 'LATEST'
        ? await genService.getLatestRunDraft(schoolId, schoolYearId)
        : await genService.getRunDraft(source.runId, schoolId, schoolYearId);
    // 3) Filter entries for this room
    const roomEntries = draft.entries.filter((e) => e.roomId === roomId);
    // 4) Build index: day -> entries[]
    const entriesByDay = new Map();
    for (const e of roomEntries) {
        const arr = entriesByDay.get(e.day) ?? [];
        arr.push(e);
        entriesByDay.set(e.day, arr);
    }
    // 5) Build grid row by row (time slot × day)
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
    // 6) Summary — unique-entry aggregation to avoid per-cell inflation
    const uniqueEntries = new Map();
    for (const e of roomEntries) {
        if (!uniqueEntries.has(e.entryId))
            uniqueEntries.set(e.entryId, e);
    }
    const entryCount = uniqueEntries.size;
    // Compute occupied minutes via interval-union per day to handle overlaps accurately
    let occupiedMinutes = 0;
    for (const day of DAYS) {
        const dayEntries = entriesByDay.get(day);
        if (!dayEntries || dayEntries.length === 0)
            continue;
        // Collect intervals as [start, end] minute-of-day pairs, then merge
        const intervals = dayEntries
            .map((e) => [timeToMinutes(e.startTime), timeToMinutes(e.endTime)])
            .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        let [curStart, curEnd] = intervals[0];
        for (let i = 1; i < intervals.length; i++) {
            const [s, e] = intervals[i];
            if (s < curEnd) {
                curEnd = Math.max(curEnd, e);
            }
            else {
                occupiedMinutes += curEnd - curStart;
                curStart = s;
                curEnd = e;
            }
        }
        occupiedMinutes += curEnd - curStart;
    }
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