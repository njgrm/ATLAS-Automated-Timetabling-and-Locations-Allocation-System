import {
	buildSectionRosterIndex,
	detectSectionOwnershipConflicts,
	normalizeIncomingAssignmentScope,
} from '../atlas-server/src/services/faculty-assignment-scope.service.js';
import {
	buildPendingOwnershipMap,
	buildSectionMap,
	buildTeachingLoadProfile,
	type FacultyAssignmentDraft,
} from '../atlas-client/src/lib/faculty-assignment-helpers.ts';
import type { ExternalSection, Subject } from '../atlas-client/src/types.ts';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, label: string) {
	if (condition) {
		passCount++;
		console.log(`[PASS] ${label}`);
	} else {
		failCount++;
		console.error(`[FAIL] ${label}`);
	}
}

function assertEqual<T>(actual: T, expected: T, label: string) {
	assert(actual === expected, `${label} (expected ${String(expected)}, got ${String(actual)})`);
}

function assertArrayMembers(actual: readonly number[], expected: readonly number[], label: string) {
	const actualSorted = [...actual].sort((left, right) => left - right);
	const expectedSorted = [...expected].sort((left, right) => left - right);
	assertEqual(actualSorted.join(','), expectedSorted.join(','), label);
}

function section(title: string) {
	console.log(`\n=== ${title} ===`);
}

const sections: ExternalSection[] = [
	{
		id: 701,
		name: '7-Rizal',
		maxCapacity: 45,
		enrolledCount: 40,
		gradeLevelId: 7,
		gradeLevelName: 'Grade 7',
		displayOrder: 7,
		programType: 'REGULAR',
		programCode: 'REGULAR',
		programName: 'Regular',
		adviserId: 11,
		adviserName: 'Ana Cruz',
	},
	{
		id: 702,
		name: '7-Luna',
		maxCapacity: 45,
		enrolledCount: 38,
		gradeLevelId: 7,
		gradeLevelName: 'Grade 7',
		displayOrder: 7,
		programType: 'REGULAR',
		programCode: 'REGULAR',
		programName: 'Regular',
		adviserId: 12,
		adviserName: 'Berto Lim',
	},
	{
		id: 801,
		name: '8-Mabini',
		maxCapacity: 45,
		enrolledCount: 39,
		gradeLevelId: 8,
		gradeLevelName: 'Grade 8',
		displayOrder: 8,
		programType: 'REGULAR',
		programCode: 'REGULAR',
		programName: 'Regular',
		adviserId: 13,
		adviserName: 'Cora Yu',
	},
];

const sectionMap = buildSectionMap(sections);
const rosterIndex = buildSectionRosterIndex([
	{
		gradeLevelId: 7,
		gradeLevelName: 'Grade 7',
		displayOrder: 7,
		sections: sections.filter((entry) => entry.displayOrder === 7) as never,
	},
	{
		gradeLevelId: 8,
		gradeLevelName: 'Grade 8',
		displayOrder: 8,
		sections: sections.filter((entry) => entry.displayOrder === 8) as never,
	},
]);

const subjects: Subject[] = [
	{
		id: 91,
		schoolId: 1,
		code: 'MATH',
		name: 'Mathematics',
		minMinutesPerWeek: 240,
		preferredRoomType: 'CLASSROOM',
		sessionPattern: 'ANY',
		gradeLevels: [7, 8],
		isActive: true,
		isSeedable: true,
		interSectionEnabled: false,
		interSectionGradeLevels: [],
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
	},
];

section('Legacy grade expansion');
{
	const normalized = normalizeIncomingAssignmentScope({ subjectId: 91, gradeLevels: [7] }, rosterIndex);
	assert(normalized.ok, 'Legacy grade-level payload expands successfully');
	if (normalized.ok) {
		assertEqual(normalized.value.sectionIds.length, 2, 'Grade 7 expands to both Grade 7 sections');
		assertArrayMembers(normalized.value.sectionIds, [701, 702], 'Expanded section list keeps both Grade 7 sections');
		assertEqual(normalized.value.gradeLevels.join(','), '7', 'Expanded scope retains the derived grade level');
	}
}

section('Explicit section scope');
{
	const normalized = normalizeIncomingAssignmentScope({ subjectId: 91, gradeLevels: [8], sectionIds: [701] }, rosterIndex);
	assert(normalized.ok, 'Explicit sectionIds override legacy grade scope');
	if (normalized.ok) {
		assertEqual(normalized.value.sectionIds.join(','), '701', 'Explicit section scope keeps only the selected section');
		assertEqual(normalized.value.gradeLevels.join(','), '7', 'Derived grade level follows the selected section, not the legacy payload');
	}
}

section('Duplicate ownership detection');
{
	const conflicts = detectSectionOwnershipConflicts(
		1,
		[{ subjectId: 91, sectionIds: [701, 702] }],
		[
			{ facultyId: 2, facultyName: 'Dela Cruz, Mara', subjectId: 91, sectionIds: [702] },
			{ facultyId: 3, facultyName: 'Lopez, Carlo', subjectId: 91, sectionIds: [801] },
		],
	);
	assertEqual(conflicts.length, 1, 'Only overlapping subject-section pairs are reported as conflicts');
	assertEqual(conflicts[0]?.ownerFacultyId, 2, 'Conflict reports the owning faculty');
	assertEqual(conflicts[0]?.sectionId, 702, 'Conflict reports the overlapping section');
}

section('Pending ownership visibility');
{
	const savedAssignments: Record<number, FacultyAssignmentDraft[]> = {
		1: [{ subjectId: 91, sectionIds: [701], gradeLevels: [7] }],
	};
	const draftAssignments: Record<number, FacultyAssignmentDraft[]> = {
		1: [{ subjectId: 91, sectionIds: [701], gradeLevels: [7] }],
		2: [{ subjectId: 91, sectionIds: [702], gradeLevels: [7] }],
	};
	const pendingOwnershipMap = buildPendingOwnershipMap(savedAssignments, draftAssignments, {
		1: 'Reyes, Ana',
		2: 'Santos, Joel',
	});
	assertEqual(Object.keys(pendingOwnershipMap).length, 1, 'Only newly drafted subject-section pairs appear in pending ownership');
	assertEqual(pendingOwnershipMap['91:702']?.facultyId, 2, 'Pending ownership records the drafting faculty');
}

section('Section-based load calculation');
{
	const oneSectionProfile = buildTeachingLoadProfile(
		[{ subjectId: 91, sectionIds: [701], gradeLevels: [7] }],
		subjects,
		sectionMap,
		0,
	);
	const twoSectionProfile = buildTeachingLoadProfile(
		[{ subjectId: 91, sectionIds: [701, 702], gradeLevels: [7] }],
		subjects,
		sectionMap,
		0,
	);
	assertEqual(oneSectionProfile.actualTeachingHours, 4, 'One selected section counts one weekly subject load');
	assertEqual(twoSectionProfile.actualTeachingHours, 8, 'Two selected sections double the weekly subject load');
}

console.log(`\nSummary: ${passCount} passed, ${failCount} failed.`);
if (failCount > 0) {
	process.exitCode = 1;
}
