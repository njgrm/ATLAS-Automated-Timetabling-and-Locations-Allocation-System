/**
 * Focused regression tests for Wave 4 cohort-aware generation and contract normalization.
 * Run with: npx tsx atlas-server/src/__tests__/phase4-cohort-review.test.ts
 */

import { validateHardConstraints, type ScheduledEntry, type ValidatorContext } from '../services/constraint-validator.js';
import { normalizeEnrollProCohortResponse } from '../services/cohort.service.js';
import { constructBaseline } from '../services/schedule-constructor.js';
import { normalizeEnrollProSectionsResponse, type SectionsByGrade } from '../services/section-adapter.js';

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
		console.error(`  ✗ ${label} — expected ${expected}, got ${actual}`);
	}
}

function section(name: string) {
	console.log(`\n═══ ${name} ═══`);
}

section('Section contract normalization');

{
	const normalized = normalizeEnrollProSectionsResponse({
		gradeLevels: [
			{
				gradeLevelId: 7,
				gradeLevelName: 'Grade 7',
				displayOrder: 7,
				sections: [
					{
						id: 701,
						name: '7-Einstein',
						maxCapacity: 45,
						enrolledCount: 42,
						programType: 'SCIENCE_TECHNOLOGY_AND_ENGINEERING',
						advisingTeacher: { id: 9001, name: 'Ada Lovelace' },
					},
				],
			},
		],
	});

	const sectionPayload = normalized.gradeLevels[0]?.sections[0];
	assertEqual(sectionPayload?.programType, 'STE', 'Upstream special program type normalizes to STE');
	assertEqual(sectionPayload?.programCode, 'STE', 'Program code is derived from upstream contract');
	assertEqual(sectionPayload?.adviserId, 9001, 'Nested advisingTeacher.id maps to adviserId');
	assertEqual(sectionPayload?.adviserName, 'Ada Lovelace', 'Nested advisingTeacher.name maps to adviserName');
	assertEqual(normalized.warnings.length, 0, 'Known section contract shape does not emit warnings');
}

section('Cohort fallback derivation');

{
	const sectionsByGrade: SectionsByGrade[] = [
		{
			gradeLevelId: 7,
			gradeLevelName: 'Grade 7',
			displayOrder: 7,
			sections: [
				{ id: 11, name: '7-Rizal', maxCapacity: 45, enrolledCount: 40, gradeLevelId: 7, gradeLevelName: 'Grade 7', programType: 'REGULAR', programCode: 'REGULAR', programName: 'Regular', adviserId: 100, adviserName: 'Maria Santos' },
				{ id: 12, name: '7-Bonifacio', maxCapacity: 45, enrolledCount: 38, gradeLevelId: 7, gradeLevelName: 'Grade 7', programType: 'REGULAR', programCode: 'REGULAR', programName: 'Regular', adviserId: 101, adviserName: 'Jose Cruz' },
				{ id: 13, name: '7-Mabini', maxCapacity: 45, enrolledCount: 36, gradeLevelId: 7, gradeLevelName: 'Grade 7', programType: 'REGULAR', programCode: 'REGULAR', programName: 'Regular', adviserId: 102, adviserName: 'Ana Reyes' },
			],
		},
	];

	const normalized = normalizeEnrollProCohortResponse(
		{ scpProgramConfigs: [{ id: 1, scpType: 'SPECIAL_CURRICULAR_PROGRAMS', isOffered: true }] },
		sectionsByGrade,
	);

	assertEqual(normalized.source, 'derived-sections', 'scpProgramConfigs without cohorts derives fallback cohorts');
	assertEqual(normalized.cohorts.length, 3, 'Fallback derivation creates one cohort per TLE specialization blueprint');
	assert(normalized.warnings.some((warning) => warning.includes('deriving fallback TLE cohorts')), 'Fallback derivation emits an explicit contract warning');
}

section('Cohort-aware baseline construction');

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
					{ id: 21, name: '7-Rizal', maxCapacity: 45, enrolledCount: 32, gradeLevelId: 7, gradeLevelName: 'Grade 7', programType: 'REGULAR', programCode: 'REGULAR', programName: 'Regular', adviserId: 201, adviserName: 'Luna Dizon' },
					{ id: 22, name: '7-Bonifacio', maxCapacity: 45, enrolledCount: 31, gradeLevelId: 7, gradeLevelName: 'Grade 7', programType: 'REGULAR', programCode: 'REGULAR', programName: 'Regular', adviserId: 202, adviserName: 'Rico Flores' },
				],
			},
		],
		subjects: [
			{
				id: 301,
				code: 'TLE',
				minMinutesPerWeek: 100,
				preferredRoomType: 'TLE_WORKSHOP',
				sessionPattern: 'ANY',
				gradeLevels: [7],
				interSectionEnabled: true,
				interSectionGradeLevels: [7],
			},
		],
		cohorts: [
			{
				cohortCode: 'G7-TLE-IA',
				specializationCode: 'IA',
				specializationName: 'Industrial Arts',
				gradeLevel: 7,
				memberSectionIds: [21, 22],
				expectedEnrollment: 63,
				preferredRoomType: 'TLE_WORKSHOP',
			},
		],
		faculty: [{ id: 1, maxHoursPerWeek: 40 }],
		facultySubjects: [{ facultyId: 1, subjectId: 301, gradeLevels: [7] }],
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
	});

	assertEqual(result.entries.length, 2, 'Two cohort TLE sessions are scheduled for a 100-minute weekly requirement');
	assert(result.entries.every((entry) => entry.entryKind === 'COHORT'), 'Inter-section TLE demand is scheduled as cohort entries');
	assert(result.entries.every((entry) => entry.cohortCode === 'G7-TLE-IA'), 'Scheduled cohort entries retain their cohort code');
	assertEqual(result.unassignedItems.length, 0, 'Qualified faculty and room capacity allow all cohort sessions to be placed');
}

section('Cohort capacity validation');

{
	const entries: ScheduledEntry[] = [
		{
			entryId: 'cohort-1',
			facultyId: 1,
			roomId: 1,
			subjectId: 301,
			sectionId: 21,
			day: 'MONDAY',
			startTime: '07:30',
			endTime: '08:20',
			durationMinutes: 50,
			entryKind: 'COHORT',
			cohortCode: 'G7-TLE-IA',
			cohortName: 'Industrial Arts',
			cohortMemberSectionIds: [21, 22],
			cohortExpectedEnrollment: 70,
		},
	];

	const ctx: ValidatorContext = {
		schoolId: 1,
		schoolYearId: 1,
		runId: 1,
		entries,
		faculty: [{ id: 1, maxHoursPerWeek: 40 }],
		facultySubjects: [{ facultyId: 1, subjectId: 301 }],
		rooms: [{ id: 1, type: 'TLE_WORKSHOP', capacity: 40 }],
		subjects: [{ id: 301, preferredRoomType: 'TLE_WORKSHOP', sessionPattern: 'ANY' }],
		sectionEnrollment: new Map([[21, 32], [22, 31]]),
		};

	const result = validateHardConstraints(ctx);
	const capacityViolations = result.violations.filter((violation) => violation.code === 'ROOM_CAPACITY_EXCEEDED');
	assertEqual(capacityViolations.length, 1, 'Cohort entries are checked against room capacity using cohort enrollment');
	assertEqual(capacityViolations[0]?.meta?.cohortCode as string, 'G7-TLE-IA', 'Capacity violation metadata preserves cohort code');
}

console.log(`\nPassed: ${passCount}`);
console.log(`Failed: ${failCount}`);

if (failCount > 0) {
	process.exitCode = 1;
}