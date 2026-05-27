import { constructBaseline, } from '../services/schedule-constructor.js';
import { validateHardConstraints } from '../services/constraint-validator.js';
let passCount = 0;
let failCount = 0;
function assert(condition, label) {
    if (condition) {
        passCount += 1;
        console.log(`  OK ${label}`);
        return;
    }
    failCount += 1;
    console.error(`  FAIL ${label}`);
}
const PERIOD_SLOTS = [
    { startTime: '07:30', endTime: '08:15' },
    { startTime: '08:15', endTime: '09:00' },
    { startTime: '09:00', endTime: '09:45' },
    { startTime: '09:45', endTime: '10:30' },
    { startTime: '10:30', endTime: '11:15' },
    { startTime: '11:15', endTime: '12:00' },
    { startTime: '12:00', endTime: '12:45' },
    { startTime: '12:45', endTime: '13:30' },
    { startTime: '13:30', endTime: '14:15' },
    { startTime: '14:15', endTime: '15:00' },
];
function buildUnavailableSlotsForConsecutivePressure() {
    const blocked = [];
    for (const day of ['TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']) {
        for (const slot of PERIOD_SLOTS) {
            blocked.push({
                day,
                startTime: slot.startTime,
                endTime: slot.endTime,
                preference: 'UNAVAILABLE',
            });
        }
    }
    for (const slot of PERIOD_SLOTS.slice(2)) {
        blocked.push({
            day: 'MONDAY',
            startTime: slot.startTime,
            endTime: slot.endTime,
            preference: 'UNAVAILABLE',
        });
    }
    return blocked;
}
function buildInput(enforceConsecutiveBreakAsHard) {
    const lockedEntries = PERIOD_SLOTS.flatMap((slot, index) => {
        if (index < 2)
            return [];
        return [
            {
                sectionId: 7701,
                subjectId: 9998,
                facultyId: 8899,
                roomId: 6601,
                day: 'MONDAY',
                startTime: slot.startTime,
                endTime: slot.endTime,
            },
            ...['TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].map((day) => ({
                sectionId: 7701,
                subjectId: 9998,
                facultyId: 8899,
                roomId: 6601,
                day,
                startTime: slot.startTime,
                endTime: slot.endTime,
            })),
        ];
    });
    return {
        schoolId: 1,
        schoolYearId: 55,
        roomingStrategy: 'UNIVERSAL',
        sectionsByGrade: [
            {
                gradeLevelId: 7,
                gradeLevelName: 'Grade 7',
                displayOrder: 7,
                sections: [
                    {
                        id: 7701,
                        name: 'G7-A',
                        maxCapacity: 45,
                        enrolledCount: 40,
                        gradeLevelId: 7,
                        gradeLevelName: 'Grade 7',
                        displayOrder: 7,
                        homeRoomId: 6601,
                        buildingZoneId: 'NORTH',
                        programType: 'REGULAR',
                        programCode: 'REGULAR',
                        programName: 'Regular',
                        isSpecialProgram: false,
                    },
                ],
            },
        ],
        subjects: [
            {
                id: 9901,
                code: 'ESP',
                name: 'Edukasyon sa Pagpapakatao',
                minMinutesPerWeek: 90,
                preferredRoomType: 'CLASSROOM',
                gradeLevels: [7],
                ownerDepartment: 'VALUES',
            },
        ],
        cohorts: [],
        faculty: [
            { id: 8801, maxHoursPerWeek: 40, department: 'VALUES' },
            { id: 8899, maxHoursPerWeek: 40, department: 'VALUES' },
        ],
        facultySubjects: [
            { facultyId: 8801, subjectId: 9901, gradeLevels: [7], sectionIds: [7701] },
        ],
        rooms: [
            { id: 6601, type: 'CLASSROOM', isTeachingSpace: true, capacity: 45, buildingZoneId: 'NORTH' },
        ],
        preferences: [
            {
                facultyId: 8801,
                status: 'SUBMITTED',
                timeSlots: buildUnavailableSlotsForConsecutivePressure(),
            },
        ],
        lockedEntries,
        policy: {
            periodLengthMinutes: 45,
            periodsPerDay: 10,
            maxConsecutiveTeachingMinutesBeforeBreak: 60,
            minBreakMinutesAfterConsecutiveBlock: 15,
            maxTeachingMinutesPerDay: 480,
            earliestStartTime: '07:30',
            latestEndTime: '15:00',
            enforceConsecutiveBreakAsHard,
            enableLunchWindow: false,
            enforceLunchWindow: false,
            enableFlagCeremony: false,
            enableRecess: false,
            allowFlexibleSubjectAssignment: false,
        },
    };
}
function run() {
    console.log('\n=== PHASE3-WELLBEING-SEMANTICS-ALIGNMENT ===');
    {
        const result = constructBaseline(buildInput(false));
        const targetEntries = result.entries.filter((entry) => entry.subjectId === 9901 && entry.sectionId === 7701);
        assert(result.unassignedCount === 0, 'soft consecutive/break semantics do not hard-block placement');
        assert(result.policyBlockedCount === 0, 'soft consecutive/break semantics do not increase policyBlockedCount');
        assert(targetEntries.length === 2, 'all required sessions are placed under soft consecutive semantics');
        const validatorCtx = {
            schoolId: 1,
            schoolYearId: 55,
            runId: 9101,
            entries: result.entries,
            faculty: [{ id: 8801, maxHoursPerWeek: 40 }],
            facultySubjects: [{ facultyId: 8801, subjectId: 9901, sectionIds: [7701] }],
            rooms: [{ id: 6601, type: 'CLASSROOM', capacity: 45 }],
            subjects: [{ id: 9901, preferredRoomType: 'CLASSROOM' }],
            policy: {
                maxConsecutiveTeachingMinutesBeforeBreak: 60,
                minBreakMinutesAfterConsecutiveBlock: 15,
                maxTeachingMinutesPerDay: 480,
                earliestStartTime: '07:30',
                latestEndTime: '15:00',
                enforceConsecutiveBreakAsHard: false,
            },
        };
        const validation = validateHardConstraints(validatorCtx);
        const consecutiveViolation = validation.violations.find((violation) => violation.code === 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED');
        assert(Boolean(consecutiveViolation), 'validator still reports consecutive limit pressure as a violation');
        assert(consecutiveViolation?.severity === 'SOFT', 'consecutive limit pressure remains SOFT when hard mode is disabled');
    }
    {
        const result = constructBaseline(buildInput(true));
        const targetEntries = result.entries.filter((entry) => entry.subjectId === 9901 && entry.sectionId === 7701);
        assert(result.unassignedCount === 1, 'hard consecutive/break semantics block the second session');
        assert(result.policyBlockedCount === 1, 'hard consecutive/break semantics increment policyBlockedCount');
        assert(targetEntries.length === 1, 'only one session is placeable under hard consecutive semantics');
        const blockedItem = result.unassignedItems[0];
        assert(Boolean(blockedItem), 'hard mode emits an explicit unassigned item for blocked session');
        assert(blockedItem?.roomAssignmentReason === 'POLICY_SLOT_BLOCKED', 'blocked session is classified as POLICY_SLOT_BLOCKED');
    }
    console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
    if (failCount > 0) {
        process.exitCode = 1;
    }
}
run();
//# sourceMappingURL=phase3-wellbeing-semantics-alignment.test.js.map