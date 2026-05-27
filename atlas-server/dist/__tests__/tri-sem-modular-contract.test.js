import { computeDemand, constructBaseline } from '../services/schedule-constructor.js';
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
function assertEqual(actual, expected, label) {
    if (actual === expected) {
        passCount += 1;
        console.log(`  OK ${label}`);
        return;
    }
    failCount += 1;
    console.error(`  FAIL ${label} - expected ${String(expected)}, got ${String(actual)}`);
}
function run() {
    console.log('\n=== TRI-SEM-MODULAR-CONTRACT ===');
    const subjects = [
        {
            id: 1,
            code: 'SCI_BIO',
            minMinutesPerWeek: 240,
            preferredRoomType: 'LABORATORY',
            gradeLevels: [7],
            modularGroupId: 'SCIENCE',
            modularOrder: 1,
            programScopes: ['REGULAR'],
        },
        {
            id: 2,
            code: 'SCI_CHEM',
            minMinutesPerWeek: 240,
            preferredRoomType: 'LABORATORY',
            gradeLevels: [7],
            modularGroupId: 'SCIENCE',
            modularOrder: 2,
            programScopes: ['REGULAR'],
        },
        {
            id: 3,
            code: 'SCI_ES',
            minMinutesPerWeek: 240,
            preferredRoomType: 'LABORATORY',
            gradeLevels: [7],
            modularGroupId: 'SCIENCE',
            modularOrder: 3,
            programScopes: ['REGULAR'],
        },
    ];
    const sectionsByGrade = [
        {
            gradeLevelId: 7,
            gradeLevelName: 'Grade 7',
            displayOrder: 7,
            sections: [
                {
                    id: 101,
                    name: 'G7-Rizal',
                    maxCapacity: 50,
                    enrolledCount: 35,
                    gradeLevelId: 7,
                    gradeLevelName: 'Grade 7',
                    displayOrder: 7,
                    homeRoomId: 11,
                    buildingZoneId: 'G7',
                    programType: 'REGULAR',
                    programCode: 'REGULAR',
                    programName: 'Regular',
                    isSpecialProgram: false,
                },
            ],
        },
    ];
    const demand = computeDemand(sectionsByGrade, subjects, []);
    const scienceDemand = demand.find((item) => item.subjectCode === 'SCIENCE');
    assert(Boolean(scienceDemand), 'Science modular demand entry is produced');
    assertEqual(scienceDemand?.modularSubjects?.length ?? 0, 3, 'Science modular bundle uses 3 term slices');
    assertEqual(scienceDemand?.modularExpectedCount ?? 0, 3, 'Science modular expected count is tri-sem');
    const physicsDemand = demand.find((item) => item.subjectCode === 'SCI_PHYS');
    assertEqual(Boolean(physicsDemand), false, 'Physics transitional subject is not part of the active default demand set');
    const input = {
        schoolId: 1,
        schoolYearId: 1,
        roomingStrategy: 'UNIVERSAL',
        sectionsByGrade,
        subjects,
        cohorts: [],
        faculty: [
            { id: 1001, maxHoursPerWeek: 30 },
            { id: 1002, maxHoursPerWeek: 30 },
            { id: 1003, maxHoursPerWeek: 30 },
        ],
        facultySubjects: [
            { facultyId: 1001, subjectId: 1, gradeLevels: [7], sectionIds: [101] },
            { facultyId: 1002, subjectId: 2, gradeLevels: [7], sectionIds: [101] },
            { facultyId: 1003, subjectId: 3, gradeLevels: [7], sectionIds: [101] },
        ],
        rooms: [
            { id: 11, type: 'LABORATORY', isTeachingSpace: true, isSharedFacility: true, capacity: 45, buildingId: 1, features: [] },
            { id: 12, type: 'CLASSROOM', isTeachingSpace: true, isSharedFacility: false, capacity: 45, buildingId: 1, features: [] },
        ],
        preferences: [],
        buildings: [{ id: 1, name: 'Science Building' }],
    };
    const result = constructBaseline(input);
    const modularEntry = result.entries.find((entry) => entry.metadata?.modularGroupId === 'SCIENCE');
    assert(Boolean(modularEntry), 'Modular schedule entry is produced for SCIENCE');
    assertEqual(modularEntry?.metadata?.modularAssignments?.length ?? 0, 3, 'Modular metadata carries three term assignments');
    const hasQuarterKey = (modularEntry?.metadata?.modularAssignments ?? []).some((assignment) => 'quarter' in assignment);
    assertEqual(hasQuarterKey, false, 'Modular metadata does not expose quarter key');
    console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
    if (failCount > 0) {
        process.exitCode = 1;
    }
}
run();
//# sourceMappingURL=tri-sem-modular-contract.test.js.map