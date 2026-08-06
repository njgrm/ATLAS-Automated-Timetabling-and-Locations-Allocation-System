import { buildTimetableShapeContract, constructBaseline, } from '../services/schedule-constructor.js';
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
function buildBaseInput(overrides) {
    const shape = buildTimetableShapeContract({
        gradeLevel: 7,
        programType: 'REGULAR',
        startTime: '07:30',
        endTime: '17:30',
        periodLengthMinutes: 45,
        periodsPerDay: 10,
        basePolicy: {
            maxConsecutiveTeachingMinutesBeforeBreak: 180,
            minBreakMinutesAfterConsecutiveBlock: 20,
            maxTeachingMinutesPerDay: 480,
            earliestStartTime: '07:30',
            latestEndTime: '17:30',
            enableLunchWindow: false,
            enableFlagCeremony: false,
            enableRecess: false,
        },
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
                        id: 7001,
                        name: 'G7-A',
                        maxCapacity: 50,
                        enrolledCount: 40,
                        gradeLevelId: 7,
                        gradeLevelName: 'Grade 7',
                        displayOrder: 7,
                        homeRoomId: null,
                        buildingZoneId: null,
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
                id: 9001,
                code: 'FIL',
                name: 'Filipino',
                minMinutesPerWeek: 225,
                preferredRoomType: 'CLASSROOM',
                gradeLevels: [7],
                ownerDepartment: 'LANGUAGES',
            },
        ],
        cohorts: [],
        faculty: [
            { id: 8001, maxHoursPerWeek: 40, department: 'LANGUAGES' },
        ],
        facultySubjects: [
            { facultyId: 8001, subjectId: 9001, gradeLevels: [7], sectionIds: [7001] },
        ],
        rooms: [
            { id: 6001, type: 'CLASSROOM', isTeachingSpace: true, capacity: 60 },
        ],
        preferences: [],
        policy: {
            periodLengthMinutes: 45,
            periodsPerDay: 10,
            maxConsecutiveTeachingMinutesBeforeBreak: 180,
            minBreakMinutesAfterConsecutiveBlock: 20,
            maxTeachingMinutesPerDay: 480,
            earliestStartTime: '07:30',
            latestEndTime: '17:30',
            enableLunchWindow: false,
            enforceLunchWindow: false,
            enableFlagCeremony: false,
            enableRecess: false,
            allowFlexibleSubjectAssignment: false,
        },
        classTemplatePeriods: {
            REGULAR: 40,
        },
        timetableShapes: [shape],
        ...overrides,
    };
}
function run() {
    console.log('\n=== PHASE3-DAY-SHAPE-AND-QUALIFICATION-AUTHORITY ===');
    {
        const input = buildBaseInput();
        const result = constructBaseline(input);
        const filEntries = result.entries.filter((entry) => entry.sectionId === 7001 && entry.subjectId === 9001);
        assert(filEntries.length === 5, '225-minute subject resolves to 5 sessions under 45-minute policy day shape');
    }
    {
        const baseInput = buildBaseInput();
        const policy = baseInput.policy;
        if (!policy) {
            throw new Error('Expected base policy for qualification authority test');
        }
        const input = buildBaseInput({
            facultySubjects: [],
            policy: {
                ...policy,
                allowFlexibleSubjectAssignment: false,
            },
        });
        const result = constructBaseline(input);
        assert(result.entries.length === 0, 'no explicit Teaching Load pairing means no auto-assignment when flexible mode is off');
        assert(result.unassignedItems.some((item) => item.reason === 'NO_QUALIFIED_FACULTY'), 'missing saved pairing is surfaced as NO_QUALIFIED_FACULTY');
    }
    console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
    if (failCount > 0) {
        process.exitCode = 1;
    }
}
run();
