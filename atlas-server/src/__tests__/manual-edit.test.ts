/**
 * Unit tests for manual-edit service logic.
 * Tests the pure applyProposal + validation pipeline without DB.
 * Run with: npx tsx atlas-server/src/__tests__/manual-edit.test.ts
 */

import {
	validateHardConstraints,
	type ValidatorContext,
	type ScheduledEntry,
	type ValidationResult,
} from '../services/constraint-validator.js';

// ─── Test helpers ───

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

// ─── Fixtures ───

const faculty = [
	{ id: 1, maxHoursPerWeek: 40 },
	{ id: 2, maxHoursPerWeek: 30 },
];
const facultySubjects = [
	{ facultyId: 1, subjectId: 1 },
	{ facultyId: 1, subjectId: 2 },
	{ facultyId: 2, subjectId: 2 },
];
const rooms = [
	{ id: 1, type: 'CLASSROOM' as const },
	{ id: 2, type: 'CLASSROOM' as const },
	{ id: 3, type: 'LABORATORY' as const },
];
const subjects = [
	{ id: 1, preferredRoomType: 'CLASSROOM' as const },
	{ id: 2, preferredRoomType: 'CLASSROOM' as const },
];

function makeEntry(overrides: Partial<ScheduledEntry> & { entryId: string }): ScheduledEntry {
	return {
		facultyId: 1,
		roomId: 1,
		subjectId: 1,
		sectionId: 1,
		day: 'MONDAY',
		startTime: '08:00',
		endTime: '08:50',
		durationMinutes: 50,
		...overrides,
	};
}

function makeCtx(entries: ScheduledEntry[]): ValidatorContext {
	return {
		schoolId: 1,
		schoolYearId: 1,
		runId: 1,
		entries,
		faculty,
		facultySubjects,
		rooms,
		subjects,
	};
}

// ─── Simulate applyProposal (copied logic for unit testing without DB) ───

interface ManualEditProposal {
	editType: string;
	sectionId?: number;
	subjectId?: number;
	session?: number;
	entryId?: string;
	targetDay?: string;
	targetStartTime?: string;
	targetEndTime?: string;
	targetRoomId?: number;
	targetFacultyId?: number;
}

interface UnassignedItem {
	sectionId: number;
	subjectId: number;
	gradeLevel: number;
	session: number;
	reason: string;
}

function timeToMinutes(t: string): number {
	const [h, m] = t.split(':').map(Number);
	return h * 60 + m;
}

function applyProposal(
	entries: ScheduledEntry[],
	unassigned: UnassignedItem[],
	proposal: ManualEditProposal,
): { newEntries: ScheduledEntry[]; newUnassigned: UnassignedItem[]; beforeEntry: ScheduledEntry | null; afterEntry: ScheduledEntry | null } {
	const newEntries = [...entries];
	let newUnassigned = [...unassigned];
	let beforeEntry: ScheduledEntry | null = null;
	let afterEntry: ScheduledEntry | null = null;

	if (proposal.editType === 'PLACE_UNASSIGNED') {
		const uIdx = newUnassigned.findIndex(
			(u) => u.sectionId === proposal.sectionId && u.subjectId === proposal.subjectId &&
				(proposal.session == null || u.session === proposal.session),
		);
		if (uIdx === -1) throw new Error('Unassigned item not found');
		const durationMinutes = timeToMinutes(proposal.targetEndTime!) - timeToMinutes(proposal.targetStartTime!);
		const newEntry: ScheduledEntry = {
			entryId: `manual-test-${Date.now()}`,
			facultyId: proposal.targetFacultyId!,
			roomId: proposal.targetRoomId!,
			subjectId: newUnassigned[uIdx].subjectId,
			sectionId: newUnassigned[uIdx].sectionId,
			day: proposal.targetDay!,
			startTime: proposal.targetStartTime!,
			endTime: proposal.targetEndTime!,
			durationMinutes,
		};
		afterEntry = newEntry;
		newEntries.push(newEntry);
		newUnassigned = newUnassigned.filter((_, i) => i !== uIdx);
	} else {
		const idx = newEntries.findIndex((e) => e.entryId === proposal.entryId);
		if (idx === -1) throw new Error('Entry not found');
		beforeEntry = { ...newEntries[idx] };
		const updated = { ...newEntries[idx] };
		if (proposal.targetDay != null) updated.day = proposal.targetDay;
		if (proposal.targetStartTime != null) updated.startTime = proposal.targetStartTime;
		if (proposal.targetEndTime != null) {
			updated.endTime = proposal.targetEndTime;
			updated.durationMinutes = timeToMinutes(updated.endTime) - timeToMinutes(updated.startTime);
		}
		if (proposal.targetRoomId != null) updated.roomId = proposal.targetRoomId;
		if (proposal.targetFacultyId != null) updated.facultyId = proposal.targetFacultyId;
		afterEntry = updated;
		newEntries[idx] = updated;
	}

	return { newEntries, newUnassigned, beforeEntry, afterEntry };
}

// ═══════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════

section('Preview: No conflict on valid move');
{
	const entries = [
		makeEntry({ entryId: 'e1', day: 'MONDAY', startTime: '08:00', endTime: '08:50' }),
		makeEntry({ entryId: 'e2', day: 'TUESDAY', startTime: '08:00', endTime: '08:50' }),
	];

	const proposal: ManualEditProposal = {
		editType: 'CHANGE_TIMESLOT',
		entryId: 'e1',
		targetDay: 'WEDNESDAY',
		targetStartTime: '08:00',
		targetEndTime: '08:50',
	};

	const { newEntries } = applyProposal(entries, [], proposal);
	const validation = validateHardConstraints(makeCtx(newEntries));
	const hardCount = validation.violations.filter((v) => v.severity === 'HARD').length;
	assertEqual(hardCount, 0, 'Moving to empty slot produces no hard violations');
	assertEqual(newEntries.length, 2, 'Entry count unchanged');
	assertEqual(newEntries[0].day, 'WEDNESDAY', 'Entry day updated');
}

section('Preview: Detects faculty time conflict on overlap');
{
	const entries = [
		makeEntry({ entryId: 'e1', facultyId: 1, day: 'MONDAY', startTime: '08:00', endTime: '08:50' }),
		makeEntry({ entryId: 'e2', facultyId: 1, day: 'TUESDAY', startTime: '09:00', endTime: '09:50' }),
	];

	// Move e2 to overlap with e1
	const proposal: ManualEditProposal = {
		editType: 'CHANGE_TIMESLOT',
		entryId: 'e2',
		targetDay: 'MONDAY',
		targetStartTime: '08:00',
		targetEndTime: '08:50',
	};

	const { newEntries } = applyProposal(entries, [], proposal);
	const validation = validateHardConstraints(makeCtx(newEntries));
	const facultyConflicts = validation.violations.filter((v) => v.code === 'FACULTY_TIME_CONFLICT');
	assert(facultyConflicts.length > 0, 'Faculty time conflict detected on overlap');
	assert(facultyConflicts[0].severity === 'HARD', 'Faculty time conflict is HARD');
}

section('Preview: Detects room time conflict');
{
	const entries = [
		makeEntry({ entryId: 'e1', facultyId: 1, roomId: 1, day: 'MONDAY', startTime: '08:00', endTime: '08:50' }),
		makeEntry({ entryId: 'e2', facultyId: 2, roomId: 2, subjectId: 2, day: 'TUESDAY', startTime: '08:00', endTime: '08:50' }),
	];

	// Move e2 to same room+time as e1
	const proposal: ManualEditProposal = {
		editType: 'CHANGE_ROOM',
		entryId: 'e2',
		targetRoomId: 1,
		targetDay: 'MONDAY',
		targetStartTime: '08:00',
		targetEndTime: '08:50',
	};

	const { newEntries } = applyProposal(entries, [], proposal);
	const validation = validateHardConstraints(makeCtx(newEntries));
	const roomConflicts = validation.violations.filter((v) => v.code === 'ROOM_TIME_CONFLICT');
	assert(roomConflicts.length > 0, 'Room time conflict detected');
}

section('Preview: Room type mismatch detected');
{
	const entries = [
		makeEntry({ entryId: 'e1', subjectId: 1, roomId: 1, day: 'MONDAY', startTime: '08:00', endTime: '08:50' }),
	];

	// Move to LABORATORY room when subject prefers CLASSROOM
	const proposal: ManualEditProposal = {
		editType: 'CHANGE_ROOM',
		entryId: 'e1',
		targetRoomId: 3, // LABORATORY
	};

	const { newEntries } = applyProposal(entries, [], proposal);
	const validation = validateHardConstraints(makeCtx(newEntries));
	const mismatch = validation.violations.filter((v) => v.code === 'ROOM_TYPE_MISMATCH');
	assert(mismatch.length > 0, 'Room type mismatch detected');
}

section('Preview: Faculty qualification mismatch');
{
	const entries = [
		makeEntry({ entryId: 'e1', facultyId: 1, subjectId: 1, day: 'MONDAY', startTime: '08:00', endTime: '08:50' }),
	];

	// Reassign to faculty 2 who is not qualified for subject 1
	const proposal: ManualEditProposal = {
		editType: 'CHANGE_FACULTY',
		entryId: 'e1',
		targetFacultyId: 2,
	};

	const { newEntries } = applyProposal(entries, [], proposal);
	const validation = validateHardConstraints(makeCtx(newEntries));
	const qualViolations = validation.violations.filter((v) => v.code === 'FACULTY_SUBJECT_NOT_QUALIFIED');
	assert(qualViolations.length > 0, 'Faculty qualification mismatch detected');
}

section('Place unassigned: Valid placement');
{
	const entries = [
		makeEntry({ entryId: 'e1', day: 'MONDAY', startTime: '08:00', endTime: '08:50' }),
	];
	const unassigned: UnassignedItem[] = [
		{ sectionId: 2, subjectId: 2, gradeLevel: 7, session: 1, reason: 'NO_AVAILABLE_SLOT' },
	];

	const proposal: ManualEditProposal = {
		editType: 'PLACE_UNASSIGNED',
		sectionId: 2,
		subjectId: 2,
		session: 1,
		targetDay: 'TUESDAY',
		targetStartTime: '08:00',
		targetEndTime: '08:50',
		targetRoomId: 2,
		targetFacultyId: 2, // faculty 2 is qualified for subject 2
	};

	const { newEntries, newUnassigned } = applyProposal(entries, unassigned, proposal);
	assertEqual(newEntries.length, 2, 'Entry added for placed unassigned');
	assertEqual(newUnassigned.length, 0, 'Unassigned item removed');

	const validation = validateHardConstraints(makeCtx(newEntries));
	const hardCount = validation.violations.filter((v) => v.severity === 'HARD').length;
	assertEqual(hardCount, 0, 'No hard violations for valid placement');
}

section('Place unassigned: Not found');
{
	try {
		applyProposal([], [], {
			editType: 'PLACE_UNASSIGNED',
			sectionId: 999,
			subjectId: 999,
		});
		assert(false, 'Should have thrown');
	} catch (e: unknown) {
		assert((e as Error).message.includes('not found'), 'Throws when unassigned not found');
	}
}

section('Move entry: Entry not found');
{
	try {
		applyProposal([], [], {
			editType: 'MOVE_ENTRY',
			entryId: 'nonexistent',
			targetDay: 'MONDAY',
		});
		assert(false, 'Should have thrown');
	} catch (e: unknown) {
		assert((e as Error).message.includes('not found'), 'Throws when entry not found');
	}
}

section('Soft-only violations allow commit');
{
	// Setup: two entries for same faculty with sufficient gap (no hard violation)
	// but we'll set policy to detect soft violations
	const entries = [
		makeEntry({ entryId: 'e1', facultyId: 1, day: 'MONDAY', startTime: '07:15', endTime: '08:05' }),
		makeEntry({ entryId: 'e2', facultyId: 1, day: 'MONDAY', startTime: '14:50', endTime: '15:40' }),
	];

	const ctx: ValidatorContext = {
		...makeCtx(entries),
		policy: {
			maxConsecutiveTeachingMinutesBeforeBreak: 120,
			minBreakMinutesAfterConsecutiveBlock: 15,
			maxTeachingMinutesPerDay: 400,
			earliestStartTime: '07:30',
			latestEndTime: '15:25',
			enforceConsecutiveBreakAsHard: false,
		},
		travelPolicy: {
			enableTravelWellbeingChecks: true,
			maxWalkingDistanceMetersPerTransition: 120,
			maxBuildingTransitionsPerDay: 4,
			maxBackToBackTransitionsWithoutBuffer: 2,
			maxIdleGapMinutesPerDay: 60,
			avoidEarlyFirstPeriod: true,
			avoidLateLastPeriod: true,
		},
	};

	const validation = validateHardConstraints(ctx);
	const hardCount = validation.violations.filter((v) => v.severity === 'HARD').length;
	const softCount = validation.violations.filter((v) => v.severity === 'SOFT').length;
	assertEqual(hardCount, 0, 'No hard violations (soft-only scenario)');
	assert(softCount > 0, 'Has soft violations (early/late/idle gap)');
}

section('Violation delta computation');
{
	const beforeEntries = [
		makeEntry({ entryId: 'e1', facultyId: 1, day: 'MONDAY', startTime: '08:00', endTime: '08:50' }),
		makeEntry({ entryId: 'e2', facultyId: 1, day: 'MONDAY', startTime: '08:00', endTime: '08:50', sectionId: 2 }),
	];
	const beforeValidation = validateHardConstraints(makeCtx(beforeEntries));
	const hardBefore = beforeValidation.violations.filter((v) => v.severity === 'HARD').length;
	assert(hardBefore > 0, 'Before state has hard violations (faculty time conflict)');

	// Fix by moving e2 to different time
	const { newEntries } = applyProposal(beforeEntries, [], {
		editType: 'CHANGE_TIMESLOT',
		entryId: 'e2',
		targetStartTime: '09:00',
		targetEndTime: '09:50',
	});
	const afterValidation = validateHardConstraints(makeCtx(newEntries));
	const hardAfter = afterValidation.violations.filter((v) => v.severity === 'HARD').length;
	assert(hardAfter < hardBefore, `Hard violations reduced (${hardBefore} → ${hardAfter})`);
}

// ─── Report ───

console.log(`\n${'═'.repeat(40)}`);
console.log(`Manual Edit Tests: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
