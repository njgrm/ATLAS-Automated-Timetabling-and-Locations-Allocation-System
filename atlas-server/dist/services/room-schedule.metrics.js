/**
 * Pure metric helpers for room schedule summaries.
 * Kept separate from room-schedule.service.ts so unit tests can import
 * these helpers without requiring Prisma/database wiring.
 */
function timeToMinutes(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}
/**
 * Calculates occupied minutes by taking the union of occupied time intervals
 * per day, then summing across days.
 */
export function computeOccupiedMinutesByIntervalUnion(entries, days) {
    const entriesByDay = new Map();
    for (const e of entries) {
        const arr = entriesByDay.get(e.day) ?? [];
        arr.push(e);
        entriesByDay.set(e.day, arr);
    }
    let occupiedMinutes = 0;
    for (const day of days) {
        const dayEntries = entriesByDay.get(day);
        if (!dayEntries || dayEntries.length === 0)
            continue;
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
    return occupiedMinutes;
}
export function countUniqueEntryIds(entries) {
    return new Set(entries.map((e) => e.entryId)).size;
}
//# sourceMappingURL=room-schedule.metrics.js.map