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
				sessionPattern: 'ANY',
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
	assertEqual(homeRoomEntry.roomId === 0, false, 'Home-room-first prefers same-zone standard room before broader fallback');

	const universalResult = constructBaseline(buildBaseInput('UNIVERSAL'));
	assert(universalResult.entries.length > 0, 'Universal strategy produces at least one entry');
	const universalEntry = universalResult.entries[0];
	assertEqual(universalEntry.roomId, 0, 'Universal strategy still assigns compatible alternate room');
	assertEqual(universalEntry.metadata?.roomAssignmentReason, 'GENERAL_POOL_ASSIGNED', 'Universal strategy uses GENERAL_POOL_ASSIGNED reason');

	console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
	if (failCount > 0) {
		process.exitCode = 1;
	}
}

run();
