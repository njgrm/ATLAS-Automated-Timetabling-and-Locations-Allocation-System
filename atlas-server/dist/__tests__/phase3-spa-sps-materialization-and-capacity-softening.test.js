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
function buildBaseInput() {
    return {
        schoolId: 1,
        schoolYearId: 1,
        roomingStrategy: 'HOME_ROOM_FIRST',
        sectionsByGrade: [
            {
                gradeLevelId: 7,
                gradeLevelName: 'Grade 7',
                displayOrder: 7,
                sections: [
                    {
                        id: 101,
                        name: 'G7-SPA-A',
                        maxCapacity: 50,
                        enrolledCount: 34,
                        gradeLevelId: 7,
                        gradeLevelName: 'Grade 7',
                        displayOrder: 7,
                        homeRoomId: 1,
                        buildingZoneId: 'NORTH',
                        programType: 'SPA',
                        programCode: 'SPA',
                        programName: 'Special Program in the Arts',
                        isSpecialProgram: true,
                    },
                    {
                        id: 102,
                        name: 'G7-SPA-B',
                        maxCapacity: 50,
                        enrolledCount: 32,
                        gradeLevelId: 7,
                        gradeLevelName: 'Grade 7',
                        displayOrder: 7,
                        homeRoomId: 2,
                        buildingZoneId: 'NORTH',
                        programType: 'SPA',
                        programCode: 'SPA',
                        programName: 'Special Program in the Arts',
                        isSpecialProgram: true,
                    },
                ],
            },
        ],
        subjects: [
            {
                id: 501,
                code: 'SPA_SPEC',
                name: 'SPA Specialization',
                minMinutesPerWeek: 90,
                preferredRoomType: 'CLASSROOM',
                gradeLevels: [7],
                interSectionEnabled: true,
                interSectionGradeLevels: [7],
                programScopes: ['SPA'],
                allowedSpecializations: ['VISUAL_ARTS'],
            },
        ],
        cohorts: [
            {
                cohortCode: 'G7-SPA-VA',
                specializationCode: 'SPA_VA',
                specializationName: 'Visual Arts',
                gradeLevel: 7,
                memberSectionIds: [101, 102],
                expectedEnrollment: 66,
                preferredRoomType: 'CLASSROOM',
            },
        ],
        faculty: [
            {
                id: 1001,
                maxHoursPerWeek: 30,
            },
        ],
        facultySubjects: [
            {
                facultyId: 1001,
                subjectId: 501,
                gradeLevels: [7],
                sectionIds: [101, 102],
            },
        ],
        rooms: [
            {
                id: 1,
                type: 'CLASSROOM',
                isTeachingSpace: true,
                capacity: 80,
                buildingId: 11,
                buildingZoneId: 'NORTH',
                features: [],
            },
            {
                id: 2,
                type: 'CLASSROOM',
                isTeachingSpace: true,
                capacity: 80,
                buildingId: 11,
                buildingZoneId: 'NORTH',
                features: [],
            },
        ],
        preferences: [],
        buildings: [{ id: 11, name: 'Grade 7 Academic Wing' }],
    };
}
function run() {
    console.log('\n=== PHASE3-SPA-SPS-MATERIALIZATION-AND-CAPACITY-SOFTENING ===');
    {
        const input = buildBaseInput();
        const demand = computeDemand(input.sectionsByGrade, input.subjects, input.cohorts, {}, 45);
        const cohortDemand = demand.find((item) => item.entryKind === 'COHORT' && item.subjectId === 501);
        assert(Boolean(cohortDemand), 'SPA demand materializes from cohort truth even when allowedSpecializations mismatches raw specialization code');
        assertEqual(cohortDemand?.cohortCode, 'G7-SPA-VA', 'Materialized cohort demand keeps cohort code identity');
        assertEqual(cohortDemand?.specializationCode, 'SPA_VA', 'Materialized cohort demand keeps specialization code identity');
        assertEqual(cohortDemand?.specializationName, 'Visual Arts', 'Materialized cohort demand keeps specialization label identity');
    }
    {
        const input = buildBaseInput();
        const result = constructBaseline(input);
        assert(result.entries.length > 0, 'Construct baseline places SPA cohort demand when qualified faculty and slots exist');
        const placed = result.entries.find((entry) => entry.subjectId === 501);
        assertEqual(placed?.subjectCode, 'SPA_SPEC', 'Placed draft entry carries subject code identity');
        assertEqual(placed?.specializationCode, 'SPA_VA', 'Placed draft entry carries specialization code identity');
        assertEqual(placed?.specializationName, 'Visual Arts', 'Placed draft entry carries specialization label identity');
    }
    {
        const input = buildBaseInput();
        input.facultySubjects = [];
        const result = constructBaseline(input);
        assert(result.unassignedItems.length > 0, 'Constructor emits unassigned diagnostics when no faculty pairing exists');
        const unassigned = result.unassignedItems[0];
        assertEqual(unassigned.subjectCode, 'SPA_SPEC', 'Unassigned diagnostics preserve subject code identity');
        assertEqual(unassigned.specializationCode, 'SPA_VA', 'Unassigned diagnostics preserve specialization code identity');
        assertEqual(unassigned.specializationName, 'Visual Arts', 'Unassigned diagnostics preserve specialization label identity');
    }
    {
        const input = buildBaseInput();
        input.sectionsByGrade[0].gradeLevelId = 9;
        input.sectionsByGrade[0].gradeLevelName = 'Grade 9';
        input.sectionsByGrade[0].displayOrder = 9;
        input.sectionsByGrade[0].sections[0].gradeLevelId = 9;
        input.sectionsByGrade[0].sections[0].gradeLevelName = 'Grade 9';
        input.sectionsByGrade[0].sections[0].displayOrder = 9;
        input.sectionsByGrade[0].sections[0].programType = 'REGULAR';
        input.sectionsByGrade[0].sections[0].programCode = 'REGULAR';
        input.sectionsByGrade[0].sections[0].programName = 'Regular';
        input.sectionsByGrade[0].sections[1].programType = 'REGULAR';
        input.sectionsByGrade[0].sections[1].programCode = 'REGULAR';
        input.sectionsByGrade[0].sections[1].programName = 'Regular';
        input.subjects = [
            {
                id: 601,
                code: 'MATH',
                name: 'Mathematics',
                minMinutesPerWeek: 45,
                preferredRoomType: 'CLASSROOM',
                gradeLevels: [9],
            },
        ];
        input.cohorts = [];
        input.facultySubjects = [
            {
                facultyId: 1001,
                subjectId: 601,
                gradeLevels: [9],
                sectionIds: [101],
            },
        ];
        input.sectionsByGrade[0].sections = [input.sectionsByGrade[0].sections[0]];
        input.sectionsByGrade[0].sections[0].enrolledCount = 34;
        input.sectionsByGrade[0].sections[0].homeRoomId = 1;
        input.rooms = [
            {
                id: 1,
                type: 'CLASSROOM',
                isTeachingSpace: true,
                capacity: 20,
                buildingId: 11,
                buildingZoneId: 'NORTH',
                features: [],
            },
            {
                id: 2,
                type: 'CLASSROOM',
                isTeachingSpace: true,
                capacity: 18,
                buildingId: 11,
                buildingZoneId: 'NORTH',
                features: [],
            },
        ];
        const result = constructBaseline(input);
        assert(result.entries.length > 0, 'HOME_ROOM_FIRST still places section demand when only under-capacity classrooms exist');
        assertEqual(Boolean(result.entries[0]?.metadata?.capacityOverflowBypass), true, 'Capacity-softened placement marks explicit overflow bypass metadata');
    }
    {
        const input = buildBaseInput();
        input.cohorts = [];
        input.subjects = [
            {
                id: 701,
                code: 'ENG',
                name: 'English',
                minMinutesPerWeek: 45,
                preferredRoomType: 'CLASSROOM',
                gradeLevels: [7],
            },
        ];
        input.faculty = [{ id: 1001, maxHoursPerWeek: 0 }];
        input.facultySubjects = [
            {
                facultyId: 1001,
                subjectId: 701,
                gradeLevels: [7],
                sectionIds: [101],
            },
        ];
        input.sectionsByGrade[0].sections = [input.sectionsByGrade[0].sections[0]];
        input.rooms = [input.rooms[0]];
        const result = constructBaseline(input);
        assertEqual(result.unassignedItems.length, 1, 'Overloaded faculty scenario leaves one session unassigned');
        assertEqual(result.unassignedItems[0]?.reason, 'FACULTY_OVERLOADED', 'Unassigned reason remains faculty-overload driven');
        assert(result.unassignedItems[0]?.homeRoomFallbackCause !== 'POLICY_OR_SHIFT_WINDOW_INCOMPATIBLE', 'Fallback cause does not misclassify faculty overload as policy-or-shift incompatibility');
    }
    console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
    if (failCount > 0) {
        process.exitCode = 1;
    }
}
run();
//# sourceMappingURL=phase3-spa-sps-materialization-and-capacity-softening.test.js.map