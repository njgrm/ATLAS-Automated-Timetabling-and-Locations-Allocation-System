/**
 * Focused regression tests for Wave 4.3 pre-generation draft consumption.
 * Run with: npx tsx atlas-server/src/__tests__/wave4-pre-generation-draft.test.ts
 */

import { constructBaseline } from '../services/schedule-constructor.js';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, label: string) {
	if (condition) {
		passCount++;
		console.log(`  ✓ ${label}`);
	} else {
		failCount++;
		console.error(`  ✗ ${label}`);
	}
}

function assertEqual<T>(actual: T, expected: T, label: string) {
	if (actual === expected) {
		passCount++;
		console.log(`  ✓ ${label}`);
	} else {
		failCount++;
		console.error(`  ✗ ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
	}
}

function section(name: string) {
	console.log(`\n═══ ${name} ═══`);
}

section('Cohort pre-placement reduces remaining demand');

{
	const result = constructBaseline({
		schoolId: 1,
		schoolYearId: 1,
		sectionsByGrade: [
			{
				gradeLevelId: 7,
				gradeLevelName: 'Grade 7',
				displayOrder: 7,
				sections: [
					{ id: 101, name: '7-Rizal', maxCapacity: 45, enrolledCount: 32, gradeLevelId: 7, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR', programCode: 'REGULAR', programName: 'Regular' },
					{ id: 102, name: '7-Luna', maxCapacity: 45, enrolledCount: 31, gradeLevelId: 7, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR', programCode: 'REGULAR', programName: 'Regular' },
				],
			},
		],
		subjects: [
			{ id: 301, code: 'TLE', minMinutesPerWeek: 100, preferredRoomType: 'TLE_WORKSHOP', sessionPattern: 'ANY', gradeLevels: [7], interSectionEnabled: true, interSectionGradeLevels: [7] },
		],
		cohorts: [
			{ cohortCode: 'G7-TLE-IA', specializationCode: 'IA', specializationName: 'Industrial Arts', gradeLevel: 7, memberSectionIds: [101, 102], expectedEnrollment: 63, preferredRoomType: 'TLE_WORKSHOP' },
		],
		faculty: [{ id: 1, maxHoursPerWeek: 40 }],
		facultySubjects: [{ facultyId: 1, subjectId: 301, gradeLevels: [7], sectionIds: [101, 102] }],
		rooms: [{ id: 1, type: 'TLE_WORKSHOP', isTeachingSpace: true, capacity: 80 }],
		preferences: [],
		policy: {
			maxConsecutiveTeachingMinutesBeforeBreak: 120,
			minBreakMinutesAfterConsecutiveBlock: 15,
			maxTeachingMinutesPerDay: 300,
			earliestStartTime: '07:30',
			latestEndTime: '12:00',
			enableTleTwoPassPriority: true,
			allowFlexibleSubjectAssignment: false,
			allowConsecutiveLabSessions: true,
		},
		lockedEntries: [
			{
				entryKind: 'COHORT',
				cohortCode: 'G7-TLE-IA',
				sectionId: 101,
				subjectId: 301,
				facultyId: 1,
				roomId: 1,
				day: 'MONDAY',
				startTime: '07:30',
				endTime: '08:20',
			},
		],
	});

	assertEqual(result.entries.length, 2, 'One locked cohort session plus one generated cohort session satisfy a 2-session weekly demand');
	assertEqual(result.entries.filter((entry) => entry.cohortCode === 'G7-TLE-IA').length, 2, 'Cohort code is preserved on both locked and generated entries');
	assertEqual(result.unassignedItems.length, 0, 'Remaining cohort demand is fully scheduled after consuming the pre-placement');
	assert(result.entries.some((entry) => entry.day === 'MONDAY' && entry.startTime === '07:30'), 'Locked cohort entry is retained at its requested slot');
}

section('Invalid pre-placement still emits a lock warning');

{
	const result = constructBaseline({
		schoolId: 1,
		schoolYearId: 1,
		sectionsByGrade: [
			{
				gradeLevelId: 8,
				gradeLevelName: 'Grade 8',
				displayOrder: 8,
				sections: [
					{ id: 201, name: '8-Archimedes', maxCapacity: 45, enrolledCount: 40, gradeLevelId: 8, gradeLevelName: 'Grade 8', displayOrder: 8, programType: 'REGULAR', programCode: 'REGULAR', programName: 'Regular' },
				],
			},
		],
		subjects: [
			{ id: 401, code: 'SCI', minMinutesPerWeek: 50, preferredRoomType: 'LABORATORY', sessionPattern: 'ANY', gradeLevels: [8], interSectionEnabled: false, interSectionGradeLevels: [] },
		],
		cohorts: [],
		faculty: [{ id: 2, maxHoursPerWeek: 40 }],
		facultySubjects: [{ facultyId: 2, subjectId: 401, gradeLevels: [8], sectionIds: [201] }],
		rooms: [{ id: 2, type: 'LABORATORY', isTeachingSpace: true, capacity: 45 }],
		preferences: [],
		policy: {
			maxConsecutiveTeachingMinutesBeforeBreak: 120,
			minBreakMinutesAfterConsecutiveBlock: 15,
			maxTeachingMinutesPerDay: 300,
			earliestStartTime: '07:30',
			latestEndTime: '12:00',
			enableTleTwoPassPriority: true,
			allowFlexibleSubjectAssignment: false,
			allowConsecutiveLabSessions: false,
		},
		lockedEntries: [
			{
				sectionId: 201,
				subjectId: 401,
				facultyId: 0,
				roomId: 2,
				day: 'MONDAY',
				startTime: '07:30',
				endTime: '08:20',
			},
		],
	});

	assertEqual(result.lockWarnings.length, 1, 'Invalid lock is rejected with one warning');
	assert(result.lockWarnings[0]?.includes('has no valid facultyId') ?? false, 'Lock warning explains the invalid faculty reference');
	assertEqual(result.entries.length, 1, 'Constructor still schedules the section demand normally after skipping the invalid lock');
	assertEqual(result.unassignedItems.length, 0, 'Skipping the invalid lock does not prevent the remaining demand from being scheduled');
}

section('Manual anchor blocks generated sessions from reusing its slot');

{
	const result = constructBaseline({
		schoolId: 1,
		schoolYearId: 1,
		sectionsByGrade: [
			{
				gradeLevelId: 9,
				gradeLevelName: 'Grade 9',
				displayOrder: 9,
				sections: [
					{ id: 301, name: '9-Diamond', maxCapacity: 45, enrolledCount: 38, gradeLevelId: 9, gradeLevelName: 'Grade 9', displayOrder: 9, programType: 'REGULAR', programCode: 'REGULAR', programName: 'Regular' },
				],
			},
		],
		subjects: [
			{ id: 501, code: 'MATH', minMinutesPerWeek: 50, preferredRoomType: 'CLASSROOM', sessionPattern: 'ANY', gradeLevels: [9], interSectionEnabled: false, interSectionGradeLevels: [] },
			{ id: 502, code: 'ENG', minMinutesPerWeek: 50, preferredRoomType: 'CLASSROOM', sessionPattern: 'ANY', gradeLevels: [9], interSectionEnabled: false, interSectionGradeLevels: [] },
		],
		cohorts: [],
		faculty: [{ id: 7, maxHoursPerWeek: 40 }],
		facultySubjects: [
			{ facultyId: 7, subjectId: 501, gradeLevels: [9], sectionIds: [301] },
			{ facultyId: 7, subjectId: 502, gradeLevels: [9], sectionIds: [301] },
		],
		rooms: [{ id: 9, type: 'CLASSROOM', isTeachingSpace: true, capacity: 45 }],
		preferences: [],
		policy: {
			maxConsecutiveTeachingMinutesBeforeBreak: 120,
			minBreakMinutesAfterConsecutiveBlock: 15,
			maxTeachingMinutesPerDay: 300,
			earliestStartTime: '07:30',
			latestEndTime: '10:00',
			enableTleTwoPassPriority: true,
			allowFlexibleSubjectAssignment: false,
			allowConsecutiveLabSessions: false,
		},
		lockedEntries: [
			{
				sectionId: 301,
				subjectId: 501,
				facultyId: 7,
				roomId: 9,
				day: 'MONDAY',
				startTime: '07:30',
				endTime: '08:20',
			},
		],
	});

	const anchored = result.entries.find((entry) => entry.subjectId === 501);
	const generated = result.entries.find((entry) => entry.subjectId === 502);
	assert(anchored?.day === 'MONDAY' && anchored.startTime === '07:30', 'Manual anchor remains at its requested slot');
	assert(generated != null, 'Generation schedules remaining demand around the anchor');
	assert(generated?.day !== 'MONDAY' || generated.startTime !== '07:30', 'Generated session does not overwrite the anchored faculty/room/section slot');
	assertEqual(result.lockWarnings.length, 0, 'Valid anchor does not emit lock warnings');
}

console.log(`\nWave 4.4 Pre-Generation Draft Tests: ${passCount} passed, ${failCount} failed`);

// ── Wave 4.5 inline unit tests: daily load band + hasNoTeacher flag ──
// These don't require database access; they test the classification thresholds directly.

const DAILY_LOAD_SOFT_THRESHOLD = 360; // 6h in minutes
const DAILY_LOAD_HARD_THRESHOLD = 480; // 8h in minutes

function classifyDailyLoadBand(minutesAfter: number): 'ok' | 'soft' | 'hard' {
	if (minutesAfter > DAILY_LOAD_HARD_THRESHOLD) return 'hard';
	if (minutesAfter > DAILY_LOAD_SOFT_THRESHOLD) return 'soft';
	return 'ok';
}

section('Wave 4.5 — daily load band classification');
{
	assertEqual(classifyDailyLoadBand(0), 'ok', '0 minutes → ok band');
	assertEqual(classifyDailyLoadBand(360), 'ok', '360 minutes (exactly 6h) → ok band (≤ threshold)');
	assertEqual(classifyDailyLoadBand(361), 'soft', '361 minutes (just above 6h) → soft band');
	assertEqual(classifyDailyLoadBand(480), 'soft', '480 minutes (exactly 8h) → soft band (≤ hard threshold)');
	assertEqual(classifyDailyLoadBand(481), 'hard', '481 minutes (just above 8h) → hard band');
	assertEqual(classifyDailyLoadBand(600), 'hard', '600 minutes (10h) → hard band');
}

section('Wave 4.5 — hasNoTeacher flag from empty facultyOptions');
{
	const queueItemWithFaculty = { facultyOptions: [42, 99], hasNoTeacher: false };
	const queueItemNoFaculty = { facultyOptions: [], hasNoTeacher: true };

	assert(queueItemWithFaculty.hasNoTeacher === false, 'hasNoTeacher is false when facultyOptions is non-empty');
	assert(queueItemNoFaculty.hasNoTeacher === true, 'hasNoTeacher is true when facultyOptions is empty');
	assertEqual(queueItemWithFaculty.hasNoTeacher, queueItemWithFaculty.facultyOptions.length === 0, 'hasNoTeacher mirrors (facultyOptions.length === 0) for non-empty list');
	assertEqual(queueItemNoFaculty.hasNoTeacher, queueItemNoFaculty.facultyOptions.length === 0, 'hasNoTeacher mirrors (facultyOptions.length === 0) for empty list');
}

console.log(`\nWave 4.5 Daily Load + hasNoTeacher Tests: ${passCount} passed, ${failCount} failed`);

if (failCount > 0) {
	process.exit(1);
}