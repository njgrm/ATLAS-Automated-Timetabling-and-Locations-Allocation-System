/**
 * Deterministic baseline schedule constructor.
 * Produces ScheduledEntry[] from setup data using a greedy single-pass algorithm.
 *
 * Determinism rules:
 *  - Grades sorted by ascending displayOrder (7, 8, 9, 10)
 *  - Sections sorted by ascending id within each grade
 *  - Subjects sorted by ascending id within each section
 *  - Faculty candidates sorted by ascending facultyId
 *  - Slot candidates sorted by preference score → day index → period index
 *  - Room candidates sorted by ascending room id
 *  - No randomness; identical inputs → identical output
 *
 * Assignment policy (baseline):
 *  - For each section-subject pair, compute sessions per week
 *  - Pick first qualified faculty with available load
 *  - Pick best available timeslot (prefer faculty PREFERRED slots, spread across days)
 *  - Pick first compatible room available at that slot
 *  - If no valid candidate exists, count as unassigned (never fabricate invalid data)
 */
// ─── Standard time grid (JHS 8-period day) ───
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
const STANDARD_PERIOD_MINUTES = 50;
function computeDemand(sectionsByGrade, subjects) {
    const demand = [];
    const sortedGrades = [...sectionsByGrade].sort((a, b) => a.displayOrder - b.displayOrder);
    const sortedSubjects = [...subjects].sort((a, b) => a.id - b.id);
    for (const grade of sortedGrades) {
        const gradeNum = grade.displayOrder;
        const sortedSections = [...grade.sections].sort((a, b) => a.id - b.id);
        for (const section of sortedSections) {
            for (const subject of sortedSubjects) {
                if (!subject.gradeLevels.includes(gradeNum))
                    continue;
                const sessions = Math.ceil(subject.minMinutesPerWeek / STANDARD_PERIOD_MINUTES);
                const duration = Math.ceil(subject.minMinutesPerWeek / sessions);
                demand.push({
                    sectionId: section.id,
                    subjectId: subject.id,
                    gradeLevel: gradeNum,
                    sessionsPerWeek: sessions,
                    durationPerSession: duration,
                });
            }
        }
    }
    return demand;
}
// ─── Occupancy tracker ───
class OccupancyTracker {
    occupied = new Set();
    isOccupied(entityId, day, periodIdx) {
        return this.occupied.has(`${entityId}:${day}:${periodIdx}`);
    }
    mark(entityId, day, periodIdx) {
        this.occupied.add(`${entityId}:${day}:${periodIdx}`);
    }
}
// ─── Preference lookup ───
function buildPreferenceLookup(preferences) {
    const lookup = new Map();
    // Group by faculty — prefer SUBMITTED over DRAFT
    const byFaculty = new Map();
    for (const pref of preferences) {
        const existing = byFaculty.get(pref.facultyId);
        if (!existing || (pref.status === 'SUBMITTED' && existing.status !== 'SUBMITTED')) {
            byFaculty.set(pref.facultyId, pref);
        }
    }
    for (const [facultyId, pref] of byFaculty) {
        const slotMap = new Map();
        for (const ts of pref.timeSlots) {
            for (let pi = 0; pi < PERIOD_SLOTS.length; pi++) {
                const period = PERIOD_SLOTS[pi];
                // Check if preference slot overlaps this standard period
                if (ts.startTime < period.endTime && period.startTime < ts.endTime) {
                    const key = `${ts.day}:${pi}`;
                    const existing = slotMap.get(key);
                    // UNAVAILABLE is most restrictive — always wins
                    if (!existing || ts.preference === 'UNAVAILABLE') {
                        slotMap.set(key, ts.preference);
                    }
                }
            }
        }
        lookup.set(facultyId, slotMap);
    }
    return lookup;
}
// ─── Time helper ───
function timeToMinutes(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}
// ─── Main constructor ───
export function constructBaseline(input) {
    const { subjects, faculty, facultySubjects, rooms, preferences, sectionsByGrade, policy } = input;
    const demand = computeDemand(sectionsByGrade, subjects);
    // Teaching rooms sorted by id, grouped by type
    const teachingRooms = rooms.filter((r) => r.isTeachingSpace).sort((a, b) => a.id - b.id);
    const roomsByType = new Map();
    for (const r of teachingRooms) {
        const arr = roomsByType.get(r.type) ?? [];
        arr.push(r);
        roomsByType.set(r.type, arr);
    }
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));
    // Qualified faculty index: "subjectId:gradeLevel" → sorted [facultyId, ...]
    const qualifiedMap = new Map();
    const sortedFS = [...facultySubjects].sort((a, b) => a.facultyId - b.facultyId);
    for (const fs of sortedFS) {
        for (const gl of fs.gradeLevels) {
            const key = `${fs.subjectId}:${gl}`;
            const arr = qualifiedMap.get(key) ?? [];
            arr.push(fs.facultyId);
            qualifiedMap.set(key, arr);
        }
    }
    // Preference lookup
    const prefLookup = buildPreferenceLookup(preferences);
    // Occupancy trackers
    const facultyOcc = new OccupancyTracker();
    const roomOcc = new OccupancyTracker();
    const sectionOcc = new OccupancyTracker();
    // Faculty load (total assigned minutes)
    const facultyLoad = new Map();
    const facultyMax = new Map(faculty.map((f) => [f.id, f.maxHoursPerWeek * 60]));
    const entries = [];
    let assignedCount = 0;
    let unassignedCount = 0;
    let policyBlockedCount = 0;
    let entryCounter = 0;
    // Faculty daily teaching minutes tracker: "facultyId:day" → total minutes
    const facultyDailyMinutes = new Map();
    // Faculty day placement tracker for consecutive check: "facultyId:day" → sorted period indices
    const facultyDayPeriods = new Map();
    // Pre-filter valid period indices by policy time bounds
    let validPeriodIndices = null;
    if (policy) {
        const earliestMin = timeToMinutes(policy.earliestStartTime);
        const latestMin = timeToMinutes(policy.latestEndTime);
        validPeriodIndices = [];
        for (let pi = 0; pi < PERIOD_SLOTS.length; pi++) {
            const slot = PERIOD_SLOTS[pi];
            if (timeToMinutes(slot.startTime) >= earliestMin && timeToMinutes(slot.endTime) <= latestMin) {
                validPeriodIndices.push(pi);
            }
        }
    }
    /**
     * Check if placing a class at periodIdx for faculty on a given day
     * would exceed the consecutive teaching limit (without required break).
     */
    function wouldExceedConsecutive(facId, day, periodIdx, duration) {
        if (!policy)
            return false;
        const dayKey = `${facId}:${day}`;
        const existing = facultyDayPeriods.get(dayKey) ?? [];
        const allPeriods = [...existing, periodIdx].sort((a, b) => a - b);
        // Walk periods and compute consecutive blocks
        let consecutive = 0;
        for (let i = 0; i < allPeriods.length; i++) {
            const pi = allPeriods[i];
            const slotDuration = (pi === periodIdx) ? duration : STANDARD_PERIOD_MINUTES;
            if (i === 0) {
                consecutive = slotDuration;
                continue;
            }
            const prevPi = allPeriods[i - 1];
            const prevEnd = PERIOD_SLOTS[prevPi].endTime;
            const currStart = PERIOD_SLOTS[pi].startTime;
            const gapMinutes = timeToMinutes(currStart) - timeToMinutes(prevEnd);
            if (gapMinutes < policy.minBreakMinutesAfterConsecutiveBlock) {
                consecutive += slotDuration;
            }
            else {
                consecutive = slotDuration;
            }
            if (consecutive > policy.maxConsecutiveTeachingMinutesBeforeBreak) {
                return true;
            }
        }
        return false;
    }
    for (const item of demand) {
        const subject = subjectMap.get(item.subjectId);
        if (!subject) {
            unassignedCount += item.sessionsPerWeek;
            continue;
        }
        const candidateFaculty = qualifiedMap.get(`${item.subjectId}:${item.gradeLevel}`) ?? [];
        const compatibleRooms = roomsByType.get(subject.preferredRoomType) ?? [];
        // Track which days we already used for this section-subject pair (spread sessions across days)
        const daysUsedForPair = new Set();
        for (let session = 0; session < item.sessionsPerWeek; session++) {
            let placed = false;
            // Try each faculty candidate (sorted by id)
            for (const facId of candidateFaculty) {
                if (placed)
                    break;
                // Check faculty load
                const currentLoad = facultyLoad.get(facId) ?? 0;
                const maxLoad = facultyMax.get(facId) ?? 0;
                if (currentLoad + item.durationPerSession > maxLoad)
                    continue;
                // Get faculty preference map
                const facPrefs = prefLookup.get(facId);
                // Build slot candidates with deterministic scoring
                const candidates = [];
                for (let di = 0; di < DAYS.length; di++) {
                    const day = DAYS[di];
                    // Policy: check daily max before considering this day
                    if (policy) {
                        const dailyKey = `${facId}:${day}`;
                        const dailyUsed = facultyDailyMinutes.get(dailyKey) ?? 0;
                        if (dailyUsed + item.durationPerSession > policy.maxTeachingMinutesPerDay)
                            continue;
                    }
                    const periodsToCheck = validPeriodIndices ?? Array.from({ length: PERIOD_SLOTS.length }, (_, i) => i);
                    for (const pi of periodsToCheck) {
                        if (sectionOcc.isOccupied(item.sectionId, day, pi))
                            continue;
                        if (facultyOcc.isOccupied(facId, day, pi))
                            continue;
                        const prefKey = `${day}:${pi}`;
                        const pref = facPrefs?.get(prefKey);
                        if (pref === 'UNAVAILABLE')
                            continue;
                        // Policy: check consecutive teaching limit
                        if (wouldExceedConsecutive(facId, day, pi, item.durationPerSession)) {
                            policyBlockedCount++;
                            continue;
                        }
                        // Score: PREFERRED=0, AVAILABLE/other=1, +10 if day already used for this pair
                        let score = pref === 'PREFERRED' ? 0 : 1;
                        if (daysUsedForPair.has(day))
                            score += 10;
                        candidates.push({ day, pi, score });
                    }
                }
                // Deterministic sort: score → day index → period index
                candidates.sort((a, b) => {
                    if (a.score !== b.score)
                        return a.score - b.score;
                    const dayDiff = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
                    if (dayDiff !== 0)
                        return dayDiff;
                    return a.pi - b.pi;
                });
                // Try each slot with compatible rooms
                for (const cand of candidates) {
                    if (placed)
                        break;
                    for (const room of compatibleRooms) {
                        if (roomOcc.isOccupied(room.id, cand.day, cand.pi))
                            continue;
                        // Place the entry
                        entryCounter++;
                        const period = PERIOD_SLOTS[cand.pi];
                        entries.push({
                            entryId: `entry-${entryCounter}`,
                            facultyId: facId,
                            roomId: room.id,
                            subjectId: item.subjectId,
                            sectionId: item.sectionId,
                            day: cand.day,
                            startTime: period.startTime,
                            endTime: period.endTime,
                            durationMinutes: item.durationPerSession,
                        });
                        // Mark occupancy
                        facultyOcc.mark(facId, cand.day, cand.pi);
                        roomOcc.mark(room.id, cand.day, cand.pi);
                        sectionOcc.mark(item.sectionId, cand.day, cand.pi);
                        // Update load
                        facultyLoad.set(facId, currentLoad + item.durationPerSession);
                        // Track daily minutes and period indices for policy
                        const dailyKey = `${facId}:${cand.day}`;
                        facultyDailyMinutes.set(dailyKey, (facultyDailyMinutes.get(dailyKey) ?? 0) + item.durationPerSession);
                        const dayPeriods = facultyDayPeriods.get(dailyKey) ?? [];
                        dayPeriods.push(cand.pi);
                        facultyDayPeriods.set(dailyKey, dayPeriods);
                        daysUsedForPair.add(cand.day);
                        placed = true;
                        break;
                    }
                }
            }
            if (placed) {
                assignedCount++;
            }
            else {
                unassignedCount++;
            }
        }
    }
    return {
        entries,
        assignedCount,
        unassignedCount,
        classesProcessed: assignedCount + unassignedCount,
        policyBlockedCount,
    };
}
//# sourceMappingURL=schedule-constructor.js.map