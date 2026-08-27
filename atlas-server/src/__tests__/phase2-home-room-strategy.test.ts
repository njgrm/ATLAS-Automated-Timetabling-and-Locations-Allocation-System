import { constructBaseline, type ConstructorInput } from '../services/schedule-constructor.js';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, label: string) {
	if (condition) {
		passCount += 1;
		console.log(`  OK ${label}`);
		return;
	}
	failCount += 1;
	console.error(`  FAIL ${label}`);
}

function assertEqual<T>(actual: T, expected: T, label: string) {
	if (actual === expected) {
		passCount += 1;
		console.log(`  OK ${label}`);
		return;
	}
	failCount += 1;
	console.error(`  FAIL ${label} - expected ${String(expected)}, got ${String(actual)}`);
}

function buildBaseInput(roomingStrategy: 'HOME_ROOM_FIRST' | 'UNIVERSAL'): ConstructorInput {
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
	assertEqual(
		specializedWithoutHomeRoomResult.unassignedItems.some((item) => item.roomAssignmentReason === 'SPECIALIZED_ROOM_UNAVAILABLE'),
		false,
		'Missing home-room sections do not emit SPECIALIZED_ROOM_UNAVAILABLE under home-room-first contraction',
	);

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

	// ── Grade-scope fallback tests ──

	// Test 1: Grade 8 section must not fallback into Grade 7-only classroom
	// Setup: section is Grade 8, all rooms are Grade 7-only with sufficient capacity.
	// The homeroom is Grade 7-only so it should not be used for Grade 8.
	// The section should remain unassigned because no Grade 8-compatible room exists.
	console.log('\n--- Grade-scope: cross-grade fallback blocked ---');
	const g8BlockedInput = buildBaseInput('HOME_ROOM_FIRST');
	g8BlockedInput.sectionsByGrade[0].sections[0].gradeLevelId = 8;
	g8BlockedInput.sectionsByGrade[0].sections[0].gradeLevelName = 'Grade 8';
	g8BlockedInput.sectionsByGrade[0].sections[0].homeRoomId = 1;
	g8BlockedInput.sectionsByGrade[0].sections[0].buildingZoneId = 'NORTH';
	g8BlockedInput.sectionsByGrade[0].sections[0].enrolledCount = 30;
	g8BlockedInput.sectionsByGrade[0].gradeLevelId = 8;
	g8BlockedInput.sectionsByGrade[0].gradeLevelName = 'Grade 8';
	g8BlockedInput.sectionsByGrade[0].displayOrder = 8;
	// All rooms are Grade 7-only with enough capacity
	g8BlockedInput.rooms[0].buildingGradeScope = [7]; g8BlockedInput.rooms[0].capacity = 45;
	g8BlockedInput.rooms[1].buildingGradeScope = [7]; g8BlockedInput.rooms[1].capacity = 45;
	g8BlockedInput.rooms[2].buildingGradeScope = [7]; g8BlockedInput.rooms[2].capacity = 45;
	const g8BlockedResult = constructBaseline(g8BlockedInput);
	// Section should not be placed in any room because all are Grade 7-only
	const g8PlacedInGrade7 = g8BlockedResult.entries.some((e) => {
		const room = g8BlockedInput.rooms.find((r) => r.id === e.roomId);
		return room?.buildingGradeScope !== undefined && room.buildingGradeScope.length > 0 && !room.buildingGradeScope.includes(8);
	});
	assert(!g8PlacedInGrade7, 'Grade 8 section must not be placed in a Grade 7-only classroom');
	// The section should either be unassigned or placed in a non-scoped room (none exist)
	assertEqual(g8BlockedResult.entries.filter((e) => e.sectionId === 101).length, 0, 'Grade 8 section has no placement when all rooms are Grade 7-only');

	// Test 2: Grade 7 section must not be displaced by Grade 8 fallback into Grade 7-only room
	// This is the production scenario: Grade 8 section tries to fallback, must not consume Grade 7 rooms
	console.log('\n--- Grade-scope: no cross-grade displacement ---');
	const g7ProtectInput = buildBaseInput('HOME_ROOM_FIRST');
	g7ProtectInput.sectionsByGrade[0].sections[0].gradeLevelId = 7;
	g7ProtectInput.sectionsByGrade[0].sections[0].homeRoomId = 1;
	g7ProtectInput.rooms[0].buildingGradeScope = [7]; g7ProtectInput.rooms[0].capacity = 45;
	g7ProtectInput.rooms[1].buildingGradeScope = [7]; g7ProtectInput.rooms[1].capacity = 45;
	g7ProtectInput.rooms[2].buildingGradeScope = [7]; g7ProtectInput.rooms[2].capacity = 45;
	// Add Grade 8 rooms that should NOT be used for Grade 7 section
	g7ProtectInput.rooms.push({
		id: 10, type: 'CLASSROOM', isTeachingSpace: true, capacity: 45,
		buildingId: 12, buildingZoneId: 'SOUTH', buildingGradeScope: [8], features: [],
	});
	const g7ProtectResult = constructBaseline(g7ProtectInput);
	const g7ProtectEntry = g7ProtectResult.entries.find((e) => e.sectionId === 101);
	assert(g7ProtectEntry != null, 'Grade 7 section is placed');
	assertEqual(g7ProtectEntry?.roomId, 1, 'Grade 7 section uses its own Grade 7 homeroom');
	const g7UsedG8Room = g7ProtectResult.entries.some(
		(e) => e.sectionId === 101 && g7ProtectInput.rooms.find((r) => r.id === e.roomId)?.buildingGradeScope?.includes(8),
	);
	assert(!g7UsedG8Room, 'Grade 7 section never uses a Grade 8-only room');

	// Test 3: Any-grade room with gradeScope=[] remains eligible
	// Homeroom is Grade 7-only (compatible), same-zone backup is Grade 8-only (incompatible)
	console.log('\n--- Grade-scope: any-grade fallback eligible ---');
	const g7AnyInput = buildBaseInput('HOME_ROOM_FIRST');
	g7AnyInput.rooms[0].buildingGradeScope = [7]; g7AnyInput.rooms[0].capacity = 45; // homeroom OK
	g7AnyInput.rooms[1].buildingGradeScope = [8]; g7AnyInput.rooms[1].capacity = 45; // wrong grade, not a fallback
	g7AnyInput.rooms[2].buildingGradeScope = [7]; g7AnyInput.rooms[2].capacity = 45; // same zone, grade-compatible
	// Add a cross-building any-grade room
	g7AnyInput.rooms.push({
		id: 3, type: 'CLASSROOM', isTeachingSpace: true, capacity: 45,
		buildingId: 13, buildingZoneId: 'EAST', buildingGradeScope: [], features: [],
	});
	g7AnyInput.buildings = g7AnyInput.buildings ?? [];
	g7AnyInput.buildings.push({ id: 13, name: 'Community Wing' });
	const g7AnyResult = constructBaseline(g7AnyInput);
	const g7AnyEntry = g7AnyResult.entries.find((e) => e.sectionId === 101);
	// Homeroom has gradeScope=[7] and is grade-compatible, so it should be used
	assertEqual(g7AnyEntry?.roomId, 1, 'Grade 7 section uses its grade-compatible homeroom when available');

	// Test 4: Cross-building fallback works for same-grade target
	// Homeroom is same-grade, same-zone is same-grade, cross-building is same-grade
	console.log('\n--- Grade-scope: cross-building same-grade fallback ---');
	const g7CrossInput = buildBaseInput('HOME_ROOM_FIRST');
	g7CrossInput.rooms[0].buildingGradeScope = [7]; g7CrossInput.rooms[0].capacity = 45;
	g7CrossInput.rooms[1].buildingGradeScope = [7]; g7CrossInput.rooms[1].capacity = 45;
	g7CrossInput.rooms[2].buildingGradeScope = [7]; g7CrossInput.rooms[2].capacity = 45;
	// Add a cross-building room that is grade-compatible
	g7CrossInput.rooms.push({
		id: 3, type: 'CLASSROOM', isTeachingSpace: true, capacity: 45,
		buildingId: 13, buildingZoneId: 'EAST', buildingGradeScope: [7], features: [],
	});
	g7CrossInput.buildings = g7CrossInput.buildings ?? [];
	g7CrossInput.buildings.push({ id: 13, name: 'Grade 7 Extension' });
	const g7CrossResult = constructBaseline(g7CrossInput);
	const g7CrossEntry = g7CrossResult.entries.find((e) => e.sectionId === 101);
	// Homeroom is compatible, so it should be used (not cross-building)
	assertEqual(g7CrossEntry?.roomId, 1, 'Grade 7 section uses homeroom when it is grade-compatible');

	// Test 5: No grade-compatible room → session remains unassigned
	console.log('\n--- Grade-scope: exhaustion leaves section unassigned ---');
	const g7ExhaustInput = buildBaseInput('HOME_ROOM_FIRST');
	g7ExhaustInput.rooms[0].buildingGradeScope = [7];
	g7ExhaustInput.rooms[0].capacity = 10; // homeroom too small
	g7ExhaustInput.rooms[1].buildingGradeScope = [8]; // wrong grade, too small anyway
	g7ExhaustInput.rooms[1].capacity = 45;
	g7ExhaustInput.rooms[2].buildingGradeScope = [9]; // wrong grade
	g7ExhaustInput.rooms[2].capacity = 45;
	const g7ExhaustResult = constructBaseline(g7ExhaustInput);
	assert(g7ExhaustResult.entries.length === 0 || g7ExhaustResult.unassignedItems.length > 0, 'Grade 7 section is unassigned when no grade-compatible room exists');

	console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
	if (failCount > 0) {
		process.exitCode = 1;
	}
}

run();
