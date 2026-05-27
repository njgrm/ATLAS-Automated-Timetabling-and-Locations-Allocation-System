import { constructBaseline } from '../services/schedule-constructor.js';
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
function buildBaseInput(roomingStrategy) {
    return {
        schoolId: 1,
        schoolYearId: 1,
        roomingStrategy,
        sectionsByGrade: [
            {
                gradeLevelId: 7,
                gradeLevelName: 'Grade 7',
                displayOrder: 7,
                sections: [
                    {
                        id: 101,
                        name: 'G7-Rizal',
                        maxCapacity: 50,
                        enrolledCount: 30,
                        gradeLevelId: 7,
                        gradeLevelName: 'Grade 7',
                        displayOrder: 7,
                        homeRoomId: 1,
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
                id: 501,
                code: 'MATH',
                name: 'Mathematics',
                minMinutesPerWeek: 50,
                preferredRoomType: 'CLASSROOM',
                gradeLevels: [7],
            },
        ],
        cohorts: [],
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
                sectionIds: [101],
            },
        ],
        rooms: [
            {
                id: 1,
                type: 'CLASSROOM',
                isTeachingSpace: true,
                capacity: 10,
                buildingId: 11,
                buildingZoneId: 'NORTH',
                features: [],
            },
            {
                id: 0,
                type: 'CLASSROOM',
                isTeachingSpace: true,
                capacity: 45,
                buildingId: 12,
                buildingZoneId: 'SOUTH',
                features: [],
            },
            {
                id: 2,
                type: 'CLASSROOM',
                isTeachingSpace: true,
                capacity: 45,
                buildingId: 11,
                buildingZoneId: 'NORTH',
                features: [],
            },
        ],
        preferences: [],
        buildings: [
            { id: 11, name: 'Grade 7 Academic Wing' },
            { id: 12, name: 'Grade 8 Academic Wing' },
        ],
    };
}
function run() {
    console.log('\n=== PHASE2-HOME-ROOM-STRATEGY ===');
    const homeRoomFirstResult = constructBaseline(buildBaseInput('HOME_ROOM_FIRST'));
    assert(homeRoomFirstResult.entries.length > 0, 'Home-room-first strategy produces at least one entry');
    const homeRoomEntry = homeRoomFirstResult.entries[0];
    assertEqual(homeRoomEntry.roomId, 2, 'Home-room-first strategy falls back to alternate room when home room is incompatible');
    assertEqual(homeRoomEntry.metadata?.roomAssignmentReason, 'HOME_ROOM_UNAVAILABLE', 'Home-room-first marks fallback reason as HOME_ROOM_UNAVAILABLE');
    assertEqual(homeRoomEntry.metadata?.fallbackTier, 'SAME_ZONE', 'Home-room-first same-zone fallback records SAME_ZONE fallback tier');
    assertEqual(homeRoomEntry.roomId === 0, false, 'Home-room-first prefers same-zone standard room before broader fallback');
    const universalResult = constructBaseline(buildBaseInput('UNIVERSAL'));
    assert(universalResult.entries.length > 0, 'Universal strategy produces at least one entry');
    const universalEntry = universalResult.entries[0];
    assertEqual(universalEntry.roomId, 0, 'Universal strategy still assigns compatible alternate room');
    assertEqual(universalEntry.metadata?.roomAssignmentReason, 'GENERAL_POOL_ASSIGNED', 'Universal strategy uses GENERAL_POOL_ASSIGNED reason');
    const specializedSubjectInput = buildBaseInput('HOME_ROOM_FIRST');
    specializedSubjectInput.subjects = [
        {
            id: 601,
            code: 'SCI_LAB',
            name: 'Science Lab',
            minMinutesPerWeek: 50,
            preferredRoomType: 'LABORATORY',
            gradeLevels: [7],
        },
    ];
    specializedSubjectInput.facultySubjects = [
        {
            facultyId: 1001,
            subjectId: 601,
            gradeLevels: [7],
            sectionIds: [101],
        },
    ];
    const specializedResult = constructBaseline(specializedSubjectInput);
    assert(specializedResult.entries.length > 0, 'Home-room-first still places specialized subjects in the master schedule');
    assertEqual(specializedResult.entries[0]?.roomId, 2, 'Home-room-first keeps specialized subjects on the section homeroom fallback path');
    assertEqual(Boolean(specializedResult.entries[0]?.metadata?.deferredRoomTypePreference), true, 'Home-room-first marks deferred specialized-room expectations for section master schedules');
    assertEqual(specializedResult.unassignedItems.length, 0, 'Deferred specialized-room expectations no longer block section master-schedule placement');
    const specializedWithoutHomeRoomInput = buildBaseInput('HOME_ROOM_FIRST');
    specializedWithoutHomeRoomInput.sectionsByGrade[0].sections[0].homeRoomId = null;
    specializedWithoutHomeRoomInput.sectionsByGrade[0].sections[0].buildingZoneId = null;
    specializedWithoutHomeRoomInput.subjects = [
        {
            id: 701,
            code: 'TLE_ICT_EXP',
            name: 'TLE Exploratory ICT',
            minMinutesPerWeek: 50,
            preferredRoomType: 'COMPUTER_LAB',
            gradeLevels: [7],
        },
    ];
    specializedWithoutHomeRoomInput.facultySubjects = [
        {
            facultyId: 1001,
            subjectId: 701,
            gradeLevels: [7],
            sectionIds: [101],
        },
    ];
    const specializedWithoutHomeRoomResult = constructBaseline(specializedWithoutHomeRoomInput);
    assert(specializedWithoutHomeRoomResult.entries.length > 0, 'Home-room-first still places specialized section demand when home room is missing');
    assertEqual(specializedWithoutHomeRoomResult.entries[0]?.roomId, 0, 'Home-room-first uses classroom fallback pool when no home room is set');
    assertEqual(Boolean(specializedWithoutHomeRoomResult.entries[0]?.metadata?.deferredRoomTypePreference), true, 'Classroom fallback without home room still records deferred specialized-room diagnostics');
    assertEqual(specializedWithoutHomeRoomResult.unassignedItems.some((item) => item.roomAssignmentReason === 'SPECIALIZED_ROOM_UNAVAILABLE'), false, 'Missing home-room sections do not emit SPECIALIZED_ROOM_UNAVAILABLE under home-room-first contraction');
    const strictZoneInput = buildBaseInput('HOME_ROOM_FIRST');
    strictZoneInput.rooms = [
        {
            id: 1,
            type: 'CLASSROOM',
            isTeachingSpace: true,
            capacity: 10,
            buildingId: 11,
            buildingZoneId: 'NORTH',
            features: [],
        },
        {
            id: 0,
            type: 'CLASSROOM',
            isTeachingSpace: true,
            capacity: 45,
            buildingId: 12,
            buildingZoneId: 'SOUTH',
            features: [],
        },
    ];
    const strictZoneResult = constructBaseline(strictZoneInput);
    assertEqual(strictZoneResult.entries.length, 1, 'Home-room-first uses bounded cross-building fallback when no same-zone classroom remains');
    assertEqual(strictZoneResult.unassignedItems.length, 0, 'Cross-building fallback prevents false unresolved demand when broader classroom capacity exists');
    assertEqual(strictZoneResult.entries[0]?.roomId, 0, 'Cross-building fallback lands on the broader-zone classroom candidate');
    assertEqual(strictZoneResult.entries[0]?.metadata?.roomAssignmentReason, 'CROSS_BUILDING_FALLBACK_ASSIGNED', 'Cross-building fallback uses explicit room assignment reason');
    assertEqual(Boolean(strictZoneResult.entries[0]?.metadata?.crossBuildingFallbackUsed), true, 'Cross-building fallback sets explicit metadata marker');
    assertEqual(strictZoneResult.entries[0]?.metadata?.fallbackTier, 'CROSS_BUILDING', 'Cross-building fallback records CROSS_BUILDING fallback tier');
    const preferenceRelaxInput = buildBaseInput('HOME_ROOM_FIRST');
    preferenceRelaxInput.preferences = [
        {
            facultyId: 1001,
            status: 'SUBMITTED',
            timeSlots: [
                { day: 'MONDAY', startTime: '07:00', endTime: '18:00', preference: 'UNAVAILABLE' },
                { day: 'TUESDAY', startTime: '07:00', endTime: '18:00', preference: 'UNAVAILABLE' },
                { day: 'WEDNESDAY', startTime: '07:00', endTime: '18:00', preference: 'UNAVAILABLE' },
                { day: 'THURSDAY', startTime: '07:00', endTime: '18:00', preference: 'UNAVAILABLE' },
                { day: 'FRIDAY', startTime: '07:00', endTime: '18:00', preference: 'UNAVAILABLE' },
            ],
        },
    ];
    const preferenceRelaxResult = constructBaseline(preferenceRelaxInput);
    assert(preferenceRelaxResult.entries.length > 0, 'Home-room-first relaxes strict UNAVAILABLE preference blocking when section slot starvation would otherwise occur');
    assertEqual(preferenceRelaxResult.unassignedItems.length, 0, 'Preference-relax fallback avoids false NO_AVAILABLE_SLOT starvation for section demand');
    const capacityBlockedInput = buildBaseInput('HOME_ROOM_FIRST');
    capacityBlockedInput.sectionsByGrade[0].gradeLevelId = 9;
    capacityBlockedInput.sectionsByGrade[0].gradeLevelName = 'Grade 9';
    capacityBlockedInput.sectionsByGrade[0].displayOrder = 9;
    capacityBlockedInput.sectionsByGrade[0].sections[0].gradeLevelId = 9;
    capacityBlockedInput.sectionsByGrade[0].sections[0].gradeLevelName = 'Grade 9';
    capacityBlockedInput.sectionsByGrade[0].sections[0].displayOrder = 9;
    capacityBlockedInput.subjects[0].gradeLevels = [9];
    capacityBlockedInput.facultySubjects[0].gradeLevels = [9];
    capacityBlockedInput.rooms = [
        {
            id: 1,
            type: 'CLASSROOM',
            isTeachingSpace: true,
            capacity: 10,
            buildingId: 11,
            buildingZoneId: 'NORTH',
            features: [],
        },
        {
            id: 2,
            type: 'CLASSROOM',
            isTeachingSpace: true,
            capacity: 12,
            buildingId: 11,
            buildingZoneId: 'NORTH',
            features: [],
        },
        {
            id: 3,
            type: 'LABORATORY',
            isTeachingSpace: true,
            capacity: 8,
            buildingId: 11,
            buildingZoneId: 'NORTH',
            features: [],
        },
    ];
    capacityBlockedInput.sectionsByGrade[0].sections[0].enrolledCount = 30;
    const capacityBlockedResult = constructBaseline(capacityBlockedInput);
    assertEqual(capacityBlockedResult.entries.length, 1, 'HOME_ROOM_FIRST still places section demand in the homeroom when all classroom candidates are under capacity');
    assertEqual(capacityBlockedResult.entries[0]?.roomId, 1, 'Capacity overflow placement prefers the configured homeroom');
    assertEqual(Boolean(capacityBlockedResult.entries[0]?.metadata?.capacityOverflowBypass), true, 'Capacity overflow homeroom placement records an explicit bypass marker');
    assertEqual(capacityBlockedResult.unassignedItems.length, 0, 'Capacity overflow homeroom bypass prevents false NO_AVAILABLE_SLOT starvation in section master schedule');
    const universalCapacityBlockedInput = buildBaseInput('UNIVERSAL');
    universalCapacityBlockedInput.sectionsByGrade[0].gradeLevelId = 9;
    universalCapacityBlockedInput.sectionsByGrade[0].gradeLevelName = 'Grade 9';
    universalCapacityBlockedInput.sectionsByGrade[0].displayOrder = 9;
    universalCapacityBlockedInput.sectionsByGrade[0].sections[0].gradeLevelId = 9;
    universalCapacityBlockedInput.sectionsByGrade[0].sections[0].gradeLevelName = 'Grade 9';
    universalCapacityBlockedInput.sectionsByGrade[0].sections[0].displayOrder = 9;
    universalCapacityBlockedInput.subjects[0].gradeLevels = [9];
    universalCapacityBlockedInput.facultySubjects[0].gradeLevels = [9];
    universalCapacityBlockedInput.rooms = [
        {
            id: 1,
            type: 'CLASSROOM',
            isTeachingSpace: true,
            capacity: 10,
            buildingId: 11,
            buildingZoneId: 'NORTH',
            features: [],
        },
        {
            id: 2,
            type: 'CLASSROOM',
            isTeachingSpace: true,
            capacity: 12,
            buildingId: 11,
            buildingZoneId: 'NORTH',
            features: [],
        },
    ];
    universalCapacityBlockedInput.sectionsByGrade[0].sections[0].enrolledCount = 30;
    const universalCapacityBlockedResult = constructBaseline(universalCapacityBlockedInput);
    assertEqual(universalCapacityBlockedResult.entries.length, 0, 'UNIVERSAL strategy does not bypass room-capacity constraints');
    assertEqual(universalCapacityBlockedResult.unassignedItems[0]?.reason, 'ROOM_CAPACITY_EXCEEDED', 'UNIVERSAL strategy keeps explicit ROOM_CAPACITY_EXCEEDED diagnostics when blocked');
    console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
    if (failCount > 0) {
        process.exitCode = 1;
    }
}
run();
//# sourceMappingURL=phase2-home-room-strategy.test.js.map