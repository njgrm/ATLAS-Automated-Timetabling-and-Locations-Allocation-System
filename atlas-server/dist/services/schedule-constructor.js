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
import { isSubjectAllowedForSectionProgram } from './subject-program-scope.service.js';
// ─── Standard time grid (JHS 8-period day) ───
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
/** Default period slots — used when no policy lunch window override is provided. */
const DEFAULT_PERIOD_SLOTS = [
    { startTime: '07:30', endTime: '08:20' },
    { startTime: '08:20', endTime: '09:10' },
    { startTime: '09:10', endTime: '10:00' },
    { startTime: '10:00', endTime: '10:50' },
    { startTime: '10:50', endTime: '11:40' },
    { startTime: '11:40', endTime: '12:30' },
    { startTime: '12:30', endTime: '13:20' },
    { startTime: '13:20', endTime: '14:10' },
    { startTime: '14:10', endTime: '15:00' },
    { startTime: '15:00', endTime: '15:50' },
];
const STANDARD_PERIOD_MINUTES = 50;
/**
 * Build schedulable class period slots from policy bounds and lunch window.
 * Special event rows are built separately via buildSpecialEventSlots().
 */
function buildPeriodSlots(policy) {
    let slots = [];
    if (!policy) {
        slots = [...DEFAULT_PERIOD_SLOTS];
    }
    else {
        const earliest = timeToMinutes(policy.earliestStartTime);
        const latest = timeToMinutes(policy.latestEndTime);
        const blockedWindows = [];
        if (policy.enableFlagCeremony ?? true) {
            blockedWindows.push({
                start: timeToMinutes(policy.flagCeremonyStartTime ?? '07:00'),
                end: timeToMinutes(policy.flagCeremonyEndTime ?? '07:30'),
            });
        }
        if (policy.enableRecess ?? true) {
            blockedWindows.push({
                start: timeToMinutes(policy.recessStartTime ?? '09:45'),
                end: timeToMinutes(policy.recessEndTime ?? '10:00'),
            });
        }
        const lunchEnforced = policy.enableLunchWindow ?? policy.enforceLunchWindow ?? true;
        if (lunchEnforced) {
            blockedWindows.push({
                start: timeToMinutes(policy.lunchStartTime ?? '11:55'),
                end: timeToMinutes(policy.lunchEndTime ?? '12:55'),
            });
        }
        let cursor = earliest;
        while (cursor + STANDARD_PERIOD_MINUTES <= latest) {
            const slotEnd = cursor + STANDARD_PERIOD_MINUTES;
            const overlappingWindow = blockedWindows
                .filter((window) => window.end > window.start)
                .find((window) => cursor < window.end && slotEnd > window.start);
            if (overlappingWindow) {
                cursor = Math.max(cursor + 1, overlappingWindow.end);
                continue;
            }
            const hh = (min) => String(Math.floor(min / 60)).padStart(2, '0');
            const mm = (min) => String(min % 60).padStart(2, '0');
            slots.push({
                startTime: `${hh(cursor)}:${mm(cursor)}`,
                endTime: `${hh(slotEnd)}:${mm(slotEnd)}`,
            });
            cursor = slotEnd;
        }
    }
    return slots;
}
function buildSpecialEventSlots(policy) {
    if (!policy) {
        return [];
    }
    const events = [];
    if (policy.enableFlagCeremony ?? true) {
        events.push({
            startTime: policy.flagCeremonyStartTime ?? '07:00',
            endTime: policy.flagCeremonyEndTime ?? '07:30',
            isSpecialEvent: true,
            eventName: 'FLAG CEREMONY',
        });
    }
    if (policy.enableRecess ?? true) {
        events.push({
            startTime: policy.recessStartTime ?? '09:45',
            endTime: policy.recessEndTime ?? '10:00',
            isSpecialEvent: true,
            eventName: 'RECESS',
        });
    }
    if (policy.enableLunchWindow ?? policy.enforceLunchWindow ?? true) {
        events.push({
            startTime: policy.lunchStartTime ?? '11:55',
            endTime: policy.lunchEndTime ?? '12:55',
            isSpecialEvent: true,
            eventName: 'LUNCH BREAK',
        });
    }
    return events.sort((left, right) => {
        const leftStart = timeToMinutes(left.startTime);
        const rightStart = timeToMinutes(right.startTime);
        if (leftStart !== rightStart)
            return leftStart - rightStart;
        return timeToMinutes(left.endTime) - timeToMinutes(right.endTime);
    });
}
function mergeDisplaySlots(periodSlots, specialEventSlots) {
    return [...periodSlots, ...specialEventSlots].sort((left, right) => {
        const leftStart = timeToMinutes(left.startTime);
        const rightStart = timeToMinutes(right.startTime);
        if (leftStart !== rightStart)
            return leftStart - rightStart;
        return timeToMinutes(left.endTime) - timeToMinutes(right.endTime);
    });
}
/** Exported for use by room-schedule service and other consumers. */
export { buildPeriodSlots, buildSpecialEventSlots, mergeDisplaySlots };
export function computeDemand(sectionsByGrade, subjects, cohorts = [], classTemplatePeriods = {}) {
    const EXPECTED_MODULAR_SUBJECTS = {
        SCIENCE: 4,
    };
    const demand = [];
    const sortedGrades = [...sectionsByGrade].sort((a, b) => a.displayOrder - b.displayOrder);
    const sortedSubjects = [...subjects].sort((a, b) => a.id - b.id);
    const activeCohorts = [...cohorts]
        .filter((cohort) => cohort.memberSectionIds.length > 0)
        .sort((left, right) => left.gradeLevel - right.gradeLevel || left.cohortCode.localeCompare(right.cohortCode));
    for (const grade of sortedGrades) {
        const gradeNum = grade.displayOrder;
        const sortedSections = [...grade.sections].sort((a, b) => a.id - b.id);
        const sectionsById = new Map(sortedSections.map((section) => [section.id, section]));
        const cohortsForGrade = activeCohorts.filter((cohort) => cohort.gradeLevel === gradeNum);
        const modularGroups = new Map();
        const modularSubjectIds = new Set();
        for (const subject of sortedSubjects) {
            if (!subject.gradeLevels.includes(gradeNum))
                continue;
            if (!subject.modularGroupId)
                continue;
            const groupId = subject.modularGroupId.trim().toUpperCase();
            if (!groupId)
                continue;
            const groupSubjects = modularGroups.get(groupId) ?? [];
            groupSubjects.push(subject);
            modularGroups.set(groupId, groupSubjects);
            modularSubjectIds.add(subject.id);
        }
        for (const [groupId, groupSubjects] of modularGroups) {
            const orderedModules = [...groupSubjects].sort((left, right) => {
                const leftOrder = left.modularOrder ?? Number.MAX_SAFE_INTEGER;
                const rightOrder = right.modularOrder ?? Number.MAX_SAFE_INTEGER;
                return leftOrder - rightOrder || left.id - right.id;
            });
            if (orderedModules.length === 0)
                continue;
            const primary = orderedModules[0];
            const maxMinutesPerWeek = Math.max(...orderedModules.map((moduleSubject) => moduleSubject.minMinutesPerWeek));
            const expectedCount = EXPECTED_MODULAR_SUBJECTS[groupId] ?? orderedModules.length;
            for (const section of sortedSections) {
                const applicableModules = orderedModules.filter((moduleSubject) => isSubjectAllowedForSectionProgram(moduleSubject.code, section.programCode, moduleSubject.programScopes));
                if (applicableModules.length === 0)
                    continue;
                const periodLength = classTemplatePeriods[(section.programCode ?? '').toUpperCase()] ?? STANDARD_PERIOD_MINUTES;
                const sessions = Math.ceil(maxMinutesPerWeek / periodLength);
                const duration = Math.ceil(maxMinutesPerWeek / sessions);
                demand.push({
                    sectionId: section.id,
                    subjectId: primary.id,
                    subjectCode: groupId,
                    gradeLevel: gradeNum,
                    sessionsPerWeek: sessions,
                    durationPerSession: duration,
                    enrolledCount: section.enrolledCount,
                    sessionPattern: primary.sessionPattern ?? 'ANY',
                    entryKind: 'SECTION',
                    programType: section.programType ?? null,
                    programCode: section.programCode ?? null,
                    programName: section.programName ?? null,
                    roomTypePreference: primary.preferredRoomType,
                    adviserId: section.adviserId ?? null,
                    adviserName: section.adviserName ?? null,
                    modularGroupId: groupId,
                    modularSubjects: applicableModules.map((moduleSubject, index) => ({
                        subjectId: moduleSubject.id,
                        subjectCode: moduleSubject.code,
                        modularOrder: moduleSubject.modularOrder ?? index + 1,
                        minMinutesPerWeek: moduleSubject.minMinutesPerWeek,
                    })),
                    modularExpectedCount: expectedCount,
                });
            }
        }
        for (const subject of sortedSubjects) {
            if (!subject.gradeLevels.includes(gradeNum))
                continue;
            if (modularSubjectIds.has(subject.id))
                continue;
            /**
             * Resolve period length for a section based on its program type.
             * Uses classTemplatePeriods override if provided; falls back to STANDARD_PERIOD_MINUTES.
             */
            const getPeriodLength = (programCode) => {
                const code = (programCode ?? '').toUpperCase();
                return classTemplatePeriods[code] ?? STANDARD_PERIOD_MINUTES;
            };
            const computeSessions = (programCode) => {
                const periodLen = getPeriodLength(programCode);
                const s = Math.ceil(subject.minMinutesPerWeek / periodLen);
                const d = Math.ceil(subject.minMinutesPerWeek / s);
                return { sessions: s, duration: d };
            };
            const usesCohorts = subject.interSectionEnabled === true
                && (subject.interSectionGradeLevels?.length ? subject.interSectionGradeLevels.includes(gradeNum) : true)
                && cohortsForGrade.length > 0;
            if (usesCohorts) {
                const cohortSectionIds = new Set();
                for (const cohort of cohortsForGrade) {
                    const memberSections = cohort.memberSectionIds
                        .map((memberSectionId) => sectionsById.get(memberSectionId))
                        .filter((memberSection) => memberSection != null);
                    const applicableMembers = memberSections.filter((memberSection) => isSubjectAllowedForSectionProgram(subject.code, memberSection.programCode, subject.programScopes));
                    if (applicableMembers.length === 0)
                        continue;
                    for (const memberSection of applicableMembers) {
                        cohortSectionIds.add(memberSection.id);
                    }
                    const anchorSection = applicableMembers[0];
                    const { sessions, duration } = computeSessions(anchorSection.programCode);
                    demand.push({
                        sectionId: anchorSection.id,
                        subjectId: subject.id,
                        subjectCode: subject.code,
                        gradeLevel: gradeNum,
                        sessionsPerWeek: sessions,
                        durationPerSession: duration,
                        enrolledCount: cohort.expectedEnrollment > 0
                            ? cohort.expectedEnrollment
                            : applicableMembers.reduce((total, memberSection) => total + memberSection.enrolledCount, 0),
                        sessionPattern: subject.sessionPattern ?? 'ANY',
                        entryKind: 'COHORT',
                        programType: anchorSection.programType ?? null,
                        programCode: anchorSection.programCode ?? null,
                        programName: anchorSection.programName ?? null,
                        cohortCode: cohort.cohortCode,
                        cohortName: cohort.specializationName,
                        cohortMemberSectionIds: applicableMembers.map((memberSection) => memberSection.id),
                        roomTypePreference: cohort.preferredRoomType ?? subject.preferredRoomType,
                        adviserId: null,
                        adviserName: null,
                    });
                }
                for (const section of sortedSections) {
                    if (cohortSectionIds.has(section.id))
                        continue;
                    if (!isSubjectAllowedForSectionProgram(subject.code, section.programCode, subject.programScopes))
                        continue;
                    const { sessions, duration } = computeSessions(section.programCode);
                    demand.push({
                        sectionId: section.id,
                        subjectId: subject.id,
                        subjectCode: subject.code,
                        gradeLevel: gradeNum,
                        sessionsPerWeek: sessions,
                        durationPerSession: duration,
                        enrolledCount: section.enrolledCount,
                        sessionPattern: subject.sessionPattern ?? 'ANY',
                        entryKind: 'SECTION',
                        programType: section.programType ?? null,
                        programCode: section.programCode ?? null,
                        programName: section.programName ?? null,
                        roomTypePreference: subject.preferredRoomType,
                        adviserId: section.adviserId ?? null,
                        adviserName: section.adviserName ?? null,
                    });
                }
                continue;
            }
            for (const section of sortedSections) {
                if (!isSubjectAllowedForSectionProgram(subject.code, section.programCode, subject.programScopes))
                    continue;
                const { sessions, duration } = computeSessions(section.programCode);
                demand.push({
                    sectionId: section.id,
                    subjectId: subject.id,
                    subjectCode: subject.code,
                    gradeLevel: gradeNum,
                    sessionsPerWeek: sessions,
                    durationPerSession: duration,
                    enrolledCount: section.enrolledCount,
                    sessionPattern: subject.sessionPattern ?? 'ANY',
                    entryKind: 'SECTION',
                    programType: section.programType ?? null,
                    programCode: section.programCode ?? null,
                    programName: section.programName ?? null,
                    roomTypePreference: subject.preferredRoomType,
                    adviserId: section.adviserId ?? null,
                    adviserName: section.adviserName ?? null,
                });
            }
        }
    }
    return demand;
}
export function getDemandSectionIds(item) {
    if (item.entryKind === 'COHORT' && item.cohortMemberSectionIds && item.cohortMemberSectionIds.length > 0) {
        return item.cohortMemberSectionIds;
    }
    return [item.sectionId];
}
export function getDemandAssignmentKey(item) {
    if (item.entryKind === 'COHORT' && item.cohortCode) {
        return `${item.cohortCode}:${item.subjectId}`;
    }
    return `${item.sectionId}:${item.subjectId}`;
}
// ─── Occupancy tracker ───
class OccupancyTracker {
    occupied = new Map();
    isOccupied(entityId, day, startTime, endTime) {
        const key = `${entityId}:${day}`;
        const start = timeToMinutes(startTime);
        const end = timeToMinutes(endTime);
        const intervals = this.occupied.get(key);
        if (!intervals)
            return false;
        return intervals.some((interval) => interval.start < end && start < interval.end);
    }
    mark(entityId, day, startTime, endTime) {
        const key = `${entityId}:${day}`;
        const start = timeToMinutes(startTime);
        const end = timeToMinutes(endTime);
        const intervals = this.occupied.get(key) ?? [];
        intervals.push({ start, end });
        this.occupied.set(key, intervals);
    }
}
// ─── Preference lookup ───
function buildPreferenceLookup(preferences, periodSlots) {
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
            for (let pi = 0; pi < periodSlots.length; pi++) {
                const period = periodSlots[pi];
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
    const { subjects, faculty, facultySubjects, rooms, preferences, sectionsByGrade, policy, lockedEntries, gradeWindows } = input;
    // Build period slots dynamically from policy (lunch window, school day bounds)
    const PERIOD_SLOTS = buildPeriodSlots(policy);
    // Use demandOverride when provided (H-ALG-1 multi-seed support), otherwise compute fresh demand.
    const demand = input.demandOverride ?? computeDemand(sectionsByGrade, subjects, input.cohorts ?? [], input.classTemplatePeriods ?? {});
    // Teaching rooms sorted by id, grouped by type
    const teachingRooms = rooms.filter((r) => r.isTeachingSpace).sort((a, b) => a.id - b.id);
    const roomsByType = new Map();
    for (const r of teachingRooms) {
        const arr = roomsByType.get(r.type) ?? [];
        arr.push(r);
        roomsByType.set(r.type, arr);
    }
    // ─── Building → Grade Level mapping ───
    // Grade-level buildings follow pattern "Grade X Academic Wing"
    // Shared buildings (Science, MAPEH, TLE, Admin) don't restrict to a grade
    function extractGradeLevelFromBuildingName(name) {
        const match = name.match(/Grade\s+(\d+)/i);
        return match ? Number(match[1]) : null;
    }
    const buildingGradeMap = new Map(); // buildingId → gradeLevel (null if shared)
    if (input.buildings && input.buildings.length > 0) {
        for (const building of input.buildings) {
            const gradeLevel = extractGradeLevelFromBuildingName(building.name);
            buildingGradeMap.set(building.id, gradeLevel);
        }
    }
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));
    // Qualified faculty index: "subjectId:sectionId" → sorted [facultyId, ...]
    const qualifiedMap = new Map();
    const sortedFS = [...facultySubjects].sort((a, b) => a.facultyId - b.facultyId);
    for (const fs of sortedFS) {
        for (const sectionId of fs.sectionIds) {
            const key = `${fs.subjectId}:${sectionId}`;
            const arr = qualifiedMap.get(key) ?? [];
            arr.push(fs.facultyId);
            qualifiedMap.set(key, arr);
        }
    }
    function isFacultyQualified(f, s) {
        const allowed = s.allowedSpecializations ?? [];
        if (allowed.length === 0)
            return true; // No restriction
        // Tier 1: Explicit Specialization
        if (f.specialization && allowed.includes(f.specialization))
            return true;
        // Tier 2: Structural Department
        if (f.department && allowed.includes(f.department))
            return true;
        // Tier 3: Alias Mapping
        if (input.specializationAliases && input.specializationAliases.length > 0) {
            const facultyTerms = [f.specialization, f.department].filter(Boolean);
            for (const alias of input.specializationAliases) {
                if (facultyTerms.includes(alias.alias) && allowed.includes(alias.canonical)) {
                    return true;
                }
            }
        }
        return false;
    }
    function getQualifiedFacultyIds(item, day, slot, pi) {
        const subject = subjectMap.get(item.subjectId);
        // Priority 1: Explicit Assignments from qualifiedMap
        let candidates = [];
        if (item.entryKind === 'COHORT' && item.cohortMemberSectionIds && item.cohortMemberSectionIds.length > 0) {
            const candidateLists = item.cohortMemberSectionIds.map((sectionId) => qualifiedMap.get(`${item.subjectId}:${sectionId}`) ?? []);
            if (!candidateLists.some((candidateList) => candidateList.length === 0)) {
                candidates = intersectCandidateLists(candidateLists);
            }
        }
        else {
            candidates = [...(qualifiedMap.get(`${item.subjectId}:${item.sectionId}`) ?? [])];
        }
        // Priority 2: Fallback to Tiered Qualification
        if (candidates.length === 0 && subject) {
            candidates = faculty.filter(f => isFacultyQualified(f, subject)).map(f => f.id);
        }
        if (candidates.length === 0) {
            return { ids: [], reason: 'NO_QUALIFIED_FACULTY' };
        }
        // Filter candidates based on load and availability at this specific slot
        const available = candidates.filter(facId => {
            const currentLoad = facultyLoad.get(facId) ?? 0;
            const maxLoad = facultyMax.get(facId) ?? 0;
            if (currentLoad + item.durationPerSession > maxLoad)
                return false;
            if (facultyOcc.isOccupied(facId, day, slot.startTime, slot.endTime))
                return false;
            const facPrefs = prefLookup.get(facId);
            if (facPrefs?.get(`${day}:${pi}`) === 'UNAVAILABLE')
                return false;
            return true;
        });
        if (available.length === 0) {
            // Check if it's overload or preference
            const overloaded = candidates.every(facId => (facultyLoad.get(facId) ?? 0) + item.durationPerSession > (facultyMax.get(facId) ?? 0));
            return { ids: [], reason: overloaded ? 'FACULTY_OVERLOADED' : 'NO_AVAILABLE_SLOT' };
        }
        return { ids: available.sort((a, b) => a - b) };
    }
    function buildModularAssignments(item) {
        if (!item.modularSubjects || item.modularSubjects.length === 0) {
            return { assignments: [], missingQuarters: [] };
        }
        const sortedModules = [...item.modularSubjects].sort((left, right) => left.modularOrder - right.modularOrder);
        const assignments = [];
        const missingQuarters = [];
        for (const moduleSubject of sortedModules) {
            const quarter = moduleSubject.modularOrder;
            const facultyIds = qualifiedMap.get(`${moduleSubject.subjectId}:${item.sectionId}`) ?? [];
            if (facultyIds.length === 0) {
                missingQuarters.push(quarter);
                continue;
            }
            assignments.push({
                quarter,
                facultyId: facultyIds[0],
                subjectCode: moduleSubject.subjectCode,
            });
        }
        if (missingQuarters.length > 0) {
            modularWarnings.push({
                code: 'LACKING_FACULTY',
                sectionId: item.sectionId,
                subjectId: item.subjectId,
                message: `Lacking Faculty for modular group ${item.modularGroupId ?? item.subjectCode} in section ${item.sectionId}. Missing quarter(s): ${missingQuarters.join(', ')}.`,
                meta: {
                    modularGroupId: item.modularGroupId ?? null,
                    missingQuarters,
                },
            });
        }
        if (item.modularExpectedCount && sortedModules.length < item.modularExpectedCount) {
            modularWarnings.push({
                code: 'INCOMPLETE_MODULAR_GROUP',
                sectionId: item.sectionId,
                subjectId: item.subjectId,
                message: `Incomplete Modular Group ${item.modularGroupId ?? item.subjectCode} in section ${item.sectionId}: found ${sortedModules.length} of expected ${item.modularExpectedCount} module subjects.`,
                meta: {
                    modularGroupId: item.modularGroupId ?? null,
                    foundSubjects: sortedModules.length,
                    expectedSubjects: item.modularExpectedCount,
                    subjectCodes: sortedModules.map((moduleSubject) => moduleSubject.subjectCode),
                },
            });
        }
        return { assignments, missingQuarters };
    }
    // Preference lookup
    const prefLookup = buildPreferenceLookup(preferences, PERIOD_SLOTS);
    // Occupancy trackers
    const facultyOcc = new OccupancyTracker();
    const roomOcc = new OccupancyTracker();
    const sectionOcc = new OccupancyTracker();
    // Faculty load (total assigned minutes)
    const facultyLoad = new Map();
    const facultyMax = new Map(faculty.map((f) => [f.id, f.maxHoursPerWeek * 60]));
    const entries = [];
    const unassignedItems = [];
    const lockWarnings = [];
    const modularWarnings = [];
    let assignedCount = 0;
    let unassignedCount = 0;
    let policyBlockedCount = 0;
    let entryCounter = 0;
    // Faculty daily teaching minutes tracker: "facultyId:day" → total minutes
    const facultyDailyMinutes = new Map();
    // Faculty day placement tracker for consecutive check: "facultyId:day" → sorted period indices
    const facultyDayPeriods = new Map();
    // ─── Pre-place locked entries ───
    // "sectionId:subjectId" → count of sessions already fulfilled by locks
    const lockSessionCounts = new Map();
    if (lockedEntries && lockedEntries.length > 0) {
        for (const lock of lockedEntries) {
            const pi = PERIOD_SLOTS.findIndex((s) => s.startTime === lock.startTime && s.endTime === lock.endTime);
            if (pi < 0) {
                lockWarnings.push(`Lock for section ${lock.sectionId}, subject ${lock.subjectId} at ${lock.day} ${lock.startTime}-${lock.endTime} does not match any canonical period slot and was skipped.`);
                continue;
            }
            if (!lock.facultyId || lock.facultyId < 1) {
                lockWarnings.push(`Lock for section ${lock.sectionId}, subject ${lock.subjectId} at ${lock.day} ${lock.startTime}-${lock.endTime} has no valid facultyId and was skipped.`);
                continue;
            }
            if (!lock.roomId || lock.roomId < 1) {
                lockWarnings.push(`Lock for section ${lock.sectionId}, subject ${lock.subjectId} at ${lock.day} ${lock.startTime}-${lock.endTime} has no valid roomId and was skipped.`);
                continue;
            }
            entryCounter++;
            const period = PERIOD_SLOTS[pi];
            const durationMinutes = timeToMinutes(period.endTime) - timeToMinutes(period.startTime);
            entries.push({
                entryId: `entry-${entryCounter}`,
                facultyId: lock.facultyId,
                roomId: lock.roomId,
                subjectId: lock.subjectId,
                sectionId: lock.sectionId,
                day: lock.day,
                startTime: period.startTime,
                endTime: period.endTime,
                durationMinutes,
                entryKind: lock.entryKind,
                cohortCode: lock.cohortCode ?? null,
            });
            // Mark occupancy for locked placements
            sectionOcc.mark(lock.sectionId, lock.day, period.startTime, period.endTime);
            facultyOcc.mark(lock.facultyId, lock.day, period.startTime, period.endTime);
            facultyLoad.set(lock.facultyId, (facultyLoad.get(lock.facultyId) ?? 0) + durationMinutes);
            const dailyKey = `${lock.facultyId}:${lock.day}`;
            facultyDailyMinutes.set(dailyKey, (facultyDailyMinutes.get(dailyKey) ?? 0) + durationMinutes);
            const dayPeriods = facultyDayPeriods.get(dailyKey) ?? [];
            dayPeriods.push(pi);
            facultyDayPeriods.set(dailyKey, dayPeriods);
            roomOcc.mark(lock.roomId, lock.day, period.startTime, period.endTime);
            assignedCount++;
            // Track lock session counts
            const lockKey = lock.entryKind === 'COHORT' && lock.cohortCode
                ? `${lock.cohortCode}:${lock.subjectId}`
                : `${lock.sectionId}:${lock.subjectId}`;
            lockSessionCounts.set(lockKey, (lockSessionCounts.get(lockKey) ?? 0) + 1);
        }
    }
    // ─── Grade window lookup ───
    // gradeLevel → { startMin, endMin }
    const gradeWindowMap = new Map();
    if (gradeWindows && gradeWindows.length > 0) {
        for (const gw of gradeWindows) {
            gradeWindowMap.set(gw.gradeLevel, {
                startMin: timeToMinutes(gw.startTime),
                endMin: timeToMinutes(gw.endTime),
            });
        }
    }
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
    /**
     * Check if placing a lab/workshop session at periodIdx for a section on a given day
     * would create consecutive lab sessions (when policy disallows it).
     */
    function wouldCreateConsecutiveLab(sectionId, day, periodIdx, roomType) {
        if (allowConsecutiveLab)
            return false;
        if (!LAB_ROOM_TYPES.has(roomType))
            return false;
        const dayKey = `${sectionId}:${day}`;
        const existing = sectionDayLabPeriods.get(dayKey) ?? [];
        // Check if any existing lab period is adjacent to this one
        for (const pi of existing) {
            if (Math.abs(pi - periodIdx) === 1)
                return true;
        }
        return false;
    }
    // ─── Two-pass TLE priority scheduling ───
    // When enabled, schedule TLE subjects first (Bucket A), then everything else (Bucket B)
    const enableTwoPass = policy?.enableTleTwoPassPriority !== false;
    let orderedDemand;
    if (enableTwoPass) {
        const tleDemand = demand.filter((d) => d.subjectCode === 'TLE');
        const otherDemand = demand.filter((d) => d.subjectCode !== 'TLE');
        orderedDemand = [...tleDemand, ...otherDemand];
    }
    else {
        orderedDemand = demand;
    }
    const allowFlexible = policy?.allowFlexibleSubjectAssignment === true;
    const allowConsecutiveLab = policy?.allowConsecutiveLabSessions === true;
    const allFacultyIds = faculty.map((f) => f.id).sort((a, b) => a - b);
    // Session pattern → allowed day sets
    const SESSION_PATTERN_DAYS = {
        MWF: new Set(['MONDAY', 'WEDNESDAY', 'FRIDAY']),
        TTH: new Set(['TUESDAY', 'THURSDAY']),
        FRIDAY_ONLY: new Set(['FRIDAY']),
        ANY: new Set(DAYS),
    };
    // Lab-like room types for consecutive lab check
    const LAB_ROOM_TYPES = new Set(['LABORATORY', 'TLE_WORKSHOP', 'COMPUTER_LAB']);
    // Section-day placement tracker for consecutive lab check: "sectionId:day" → array of {periodIdx, isLab}
    const sectionDayLabPeriods = new Map();
    for (const item of orderedDemand) {
        const subject = subjectMap.get(item.subjectId);
        const modularAssignmentInfo = item.modularGroupId ? buildModularAssignments(item) : null;
        if (!subject) {
            for (let s = 0; s < item.sessionsPerWeek; s++) {
                unassignedItems.push({
                    sectionId: item.sectionId,
                    subjectId: item.subjectId,
                    gradeLevel: item.gradeLevel,
                    session: s + 1,
                    reason: 'NO_QUALIFIED_FACULTY',
                    entryKind: item.entryKind,
                    programType: item.programType ?? null,
                    programCode: item.programCode ?? null,
                    programName: item.programName ?? null,
                    cohortCode: item.cohortCode ?? null,
                    cohortName: item.cohortName ?? null,
                    cohortMemberSectionIds: item.cohortMemberSectionIds,
                    cohortExpectedEnrollment: item.entryKind === 'COHORT' ? item.enrolledCount : null,
                    adviserId: item.adviserId ?? null,
                    adviserName: item.adviserName ?? null,
                });
            }
            unassignedCount += item.sessionsPerWeek;
            continue;
        }
        // Reduce sessions needed by already-placed locked entries
        const lockKey = getDemandAssignmentKey(item);
        const lockedSessions = lockSessionCounts.get(lockKey) ?? 0;
        const sessionsNeeded = Math.max(0, item.sessionsPerWeek - lockedSessions);
        // Grade window: narrow valid periods for this item's grade level
        let gradeValidPeriods = validPeriodIndices ?? Array.from({ length: PERIOD_SLOTS.length }, (_, i) => i);
        const gw = gradeWindowMap.get(item.gradeLevel);
        if (gw) {
            gradeValidPeriods = gradeValidPeriods.filter((pi) => {
                const slot = PERIOD_SLOTS[pi];
                return timeToMinutes(slot.startTime) >= gw.startMin && timeToMinutes(slot.endTime) <= gw.endMin;
            });
        }
        // Track which days we already used for this section-subject pair (spread sessions across days)
        const daysUsedForPair = new Set();
        // Track failure reasons across all attempts for this session
        const sessionFailureReasons = new Set();
        for (let session = 0; session < sessionsNeeded; session++) {
            let placed = false;
            // Build possible slot candidates first (deterministic scoring)
            const possibleSlots = [];
            for (let di = 0; di < DAYS.length; di++) {
                const day = DAYS[di];
                const allowedDays = SESSION_PATTERN_DAYS[item.sessionPattern] ?? SESSION_PATTERN_DAYS.ANY;
                if (!allowedDays.has(day))
                    continue;
                for (const pi of gradeValidPeriods) {
                    const slot = PERIOD_SLOTS[pi];
                    if (getDemandSectionIds(item).some((sectionId) => sectionOcc.isOccupied(sectionId, day, slot.startTime, slot.endTime)))
                        continue;
                    let score = 1;
                    if (daysUsedForPair.has(day))
                        score += 10;
                    possibleSlots.push({ day, pi, score });
                }
            }
            // Sort slots by score
            possibleSlots.sort((a, b) => {
                if (a.score !== b.score)
                    return a.score - b.score;
                const dayDiff = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
                if (dayDiff !== 0)
                    return dayDiff;
                return a.pi - b.pi;
            });
            // For each slot, place with explicit faculty (standard) or modular metadata (unified modular subjects)
            for (const slotCandidate of possibleSlots) {
                if (placed)
                    break;
                const slot = PERIOD_SLOTS[slotCandidate.pi];
                const isModularUnified = Boolean(item.modularGroupId);
                const { ids: candidates, reason: qReason } = isModularUnified
                    ? { ids: [0], reason: undefined }
                    : getQualifiedFacultyIds(item, slotCandidate.day, slot, slotCandidate.pi);
                if (qReason)
                    sessionFailureReasons.add(qReason);
                if (candidates.length === 0)
                    continue;
                // We have qualified teachers! Now try rooms
                let compatibleRooms = roomsByType.get(item.roomTypePreference ?? subject.preferredRoomType) ?? [];
                if (compatibleRooms.length > 0 && buildingGradeMap.size > 0) {
                    compatibleRooms = compatibleRooms.filter((room) => {
                        const buildingId = room.buildingId;
                        if (!buildingId)
                            return true;
                        const buildingGradeLevel = buildingGradeMap.get(buildingId);
                        if (buildingGradeLevel === null)
                            return true;
                        return buildingGradeLevel === item.gradeLevel;
                    });
                }
                if (compatibleRooms.length === 0) {
                    sessionFailureReasons.add('NO_COMPATIBLE_ROOM');
                    continue;
                }
                for (const facId of candidates) {
                    if (placed)
                        break;
                    // Final policy checks for this teacher
                    if (policy && !isModularUnified) {
                        const dailyKey = `${facId}:${slotCandidate.day}`;
                        const dailyUsed = facultyDailyMinutes.get(dailyKey) ?? 0;
                        if (dailyUsed + item.durationPerSession > policy.maxTeachingMinutesPerDay) {
                            sessionFailureReasons.add('FACULTY_OVERLOADED');
                            continue;
                        }
                        if (wouldExceedConsecutive(facId, slotCandidate.day, slotCandidate.pi, item.durationPerSession)) {
                            policyBlockedCount++;
                            // consecutive is a complex block, but treat as unavailable for now
                            sessionFailureReasons.add('NO_AVAILABLE_SLOT');
                            continue;
                        }
                    }
                    for (const room of compatibleRooms) {
                        if (roomOcc.isOccupied(room.id, slotCandidate.day, slot.startTime, slot.endTime))
                            continue;
                        if (room.capacity != null && item.enrolledCount > room.capacity)
                            continue;
                        // Feature check: Room must have all required features
                        if (subject.requiredFeatures && subject.requiredFeatures.length > 0) {
                            const roomFeatures = new Set(room.features || []);
                            if (!subject.requiredFeatures.every(f => roomFeatures.has(f)))
                                continue;
                        }
                        if (getDemandSectionIds(item).some((sectionId) => wouldCreateConsecutiveLab(sectionId, slotCandidate.day, slotCandidate.pi, room.type)))
                            continue;
                        // Place the entry
                        entryCounter++;
                        entries.push({
                            entryId: `entry-${entryCounter}`,
                            facultyId: isModularUnified ? null : facId,
                            roomId: room.id,
                            subjectId: item.subjectId,
                            sectionId: item.sectionId,
                            day: slotCandidate.day,
                            startTime: slot.startTime,
                            endTime: slot.endTime,
                            durationMinutes: item.durationPerSession,
                            entryKind: item.entryKind,
                            programType: item.programType ?? null,
                            programCode: item.programCode ?? null,
                            programName: item.programName ?? null,
                            cohortCode: item.cohortCode ?? null,
                            cohortName: item.cohortName ?? null,
                            cohortMemberSectionIds: item.cohortMemberSectionIds,
                            cohortExpectedEnrollment: item.entryKind === 'COHORT' ? item.enrolledCount : null,
                            adviserId: item.adviserId ?? null,
                            adviserName: item.adviserName ?? null,
                            metadata: isModularUnified
                                ? {
                                    modularGroupId: item.modularGroupId,
                                    modularAssignments: modularAssignmentInfo?.assignments ?? [],
                                }
                                : undefined,
                        });
                        // Mark occupancy
                        if (!isModularUnified) {
                            facultyOcc.mark(facId, slotCandidate.day, slot.startTime, slot.endTime);
                        }
                        roomOcc.mark(room.id, slotCandidate.day, slot.startTime, slot.endTime);
                        for (const sectionId of getDemandSectionIds(item)) {
                            sectionOcc.mark(sectionId, slotCandidate.day, slot.startTime, slot.endTime);
                        }
                        if (!isModularUnified) {
                            facultyLoad.set(facId, (facultyLoad.get(facId) ?? 0) + item.durationPerSession);
                            const dailyKey = `${facId}:${slotCandidate.day}`;
                            facultyDailyMinutes.set(dailyKey, (facultyDailyMinutes.get(dailyKey) ?? 0) + item.durationPerSession);
                            const dayPeriods = facultyDayPeriods.get(dailyKey) ?? [];
                            dayPeriods.push(slotCandidate.pi);
                            facultyDayPeriods.set(dailyKey, dayPeriods);
                        }
                        daysUsedForPair.add(slotCandidate.day);
                        placed = true;
                        if (LAB_ROOM_TYPES.has(room.type)) {
                            for (const sectionId of getDemandSectionIds(item)) {
                                const labKey = `${sectionId}:${slotCandidate.day}`;
                                const labPeriods = sectionDayLabPeriods.get(labKey) ?? [];
                                labPeriods.push(slotCandidate.pi);
                                sectionDayLabPeriods.set(labKey, labPeriods);
                            }
                        }
                        break;
                    }
                }
            }
            if (placed) {
                assignedCount++;
            }
            else {
                // Priority of reasons: NO_QUALIFIED > FACULTY_OVERLOADED > NO_COMPATIBLE_ROOM > NO_AVAILABLE_SLOT
                let reason = 'NO_AVAILABLE_SLOT';
                if (sessionFailureReasons.has('NO_QUALIFIED_FACULTY'))
                    reason = 'NO_QUALIFIED_FACULTY';
                else if (sessionFailureReasons.has('FACULTY_OVERLOADED'))
                    reason = 'FACULTY_OVERLOADED';
                else if (sessionFailureReasons.has('NO_COMPATIBLE_ROOM'))
                    reason = 'NO_COMPATIBLE_ROOM';
                unassignedItems.push({
                    sectionId: item.sectionId,
                    subjectId: item.subjectId,
                    gradeLevel: item.gradeLevel,
                    session: session + 1,
                    reason,
                    entryKind: item.entryKind,
                    programType: item.programType ?? null,
                    programCode: item.programCode ?? null,
                    programName: item.programName ?? null,
                    cohortCode: item.cohortCode ?? null,
                    cohortName: item.cohortName ?? null,
                    cohortMemberSectionIds: item.cohortMemberSectionIds,
                    cohortExpectedEnrollment: item.entryKind === 'COHORT' ? item.enrolledCount : null,
                    adviserId: item.adviserId ?? null,
                    adviserName: item.adviserName ?? null,
                });
                unassignedCount++;
            }
        }
    }
    return {
        entries,
        unassignedItems,
        lockWarnings,
        modularWarnings,
        assignedCount,
        unassignedCount,
        classesProcessed: assignedCount + unassignedCount,
        policyBlockedCount,
    };
}
//# sourceMappingURL=schedule-constructor.js.map