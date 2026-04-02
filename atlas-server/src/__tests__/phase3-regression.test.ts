/**
 * Focused regression tests for Phase 3 generation components.
 * Run with: npx tsx atlas-server/src/__tests__/phase3-regression.test.ts
 *
 * Tests are self-contained and use only in-memory constructs (no DB).
 */

import {
	validateHardConstraints,
	type ValidatorContext,
	type ScheduledEntry,
} from '../services/constraint-validator.js';
import { computeOccupiedMinutesByIntervalUnion } from '../services/room-schedule.metrics.js';

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
		console.error(`  ✗ ${label} — expected ${expected}, got ${actual}`);
	}
}

function section(name: string) {
	console.log(`\n═══ ${name} ═══`);
}

// ─── Shared test fixtures ───

const baseFaculty = [{ id: 1, maxHoursPerWeek: 40 }, { id: 2, maxHoursPerWeek: 20 }];
const baseFacultySubjects = [
	{ facultyId: 1, subjectId: 1 },
	{ facultyId: 2, subjectId: 2 },
];
const baseRooms: Array<{ id: number; type: string }> = [
	{ id: 1, type: 'REGULAR_CLASSROOM' },
	{ id: 2, type: 'SCIENCE_LAB' },
];
const baseSubjects: Array<{ id: number; preferredRoomType: string }> = [
	{ id: 1, preferredRoomType: 'REGULAR_CLASSROOM' },
	{ id: 2, preferredRoomType: 'SCIENCE_LAB' },
];

function makeEntry(overrides: Partial<ScheduledEntry> & { entryId: string }): ScheduledEntry {
	return {
		facultyId: 1,
		roomId: 1,
		subjectId: 1,
		sectionId: 1,
		day: 'MONDAY',
		startTime: '07:30',
		endTime: '08:20',
		durationMinutes: 50,
		...overrides,
	};
}

function makeCtx(entries: ScheduledEntry[], policyOverrides?: Partial<ValidatorContext['policy']>): ValidatorContext {
	return {
		schoolId: 1,
		schoolYearId: 1,
		runId: 1,
		entries,
		faculty: baseFaculty,
		facultySubjects: baseFacultySubjects,
		rooms: baseRooms as ValidatorContext['rooms'],
		subjects: baseSubjects as ValidatorContext['subjects'],
		policy: policyOverrides !== undefined ? {
			maxConsecutiveTeachingMinutesBeforeBreak: 120,
			minBreakMinutesAfterConsecutiveBlock: 15,
			maxTeachingMinutesPerDay: 400,
			earliestStartTime: '07:00',
			latestEndTime: '17:00',
			enforceConsecutiveBreakAsHard: false,
			...policyOverrides,
		} : undefined,
	};
}

// ═══════════════════════════════════════════════════════
// Test Suite 1: hardViolationCount semantics (HARD-only)
// ═══════════════════════════════════════════════════════

section('hardViolationCount semantics');

{
	// Scenario: consecutive limit exceeded with enforceConsecutiveBreakAsHard=false (SOFT)
	// Should NOT count as hard violation
	const entries: ScheduledEntry[] = [
		makeEntry({ entryId: 'e1', startTime: '07:30', endTime: '08:20', durationMinutes: 50 }),
		makeEntry({ entryId: 'e2', startTime: '08:20', endTime: '09:10', durationMinutes: 50 }),
		makeEntry({ entryId: 'e3', startTime: '09:10', endTime: '10:00', durationMinutes: 50 }),
	];
	const ctx = makeCtx(entries, { enforceConsecutiveBreakAsHard: false, maxConsecutiveTeachingMinutesBeforeBreak: 100 });
	const result = validateHardConstraints(ctx);

	const hardViolations = result.violations.filter((v) => v.severity === 'HARD');
	const softViolations = result.violations.filter((v) => v.severity === 'SOFT');

	assertEqual(hardViolations.length, 0, 'No HARD violations when consecutive limit is SOFT-only');
	assert(softViolations.length > 0, 'SOFT violations emitted for consecutive limit breach');

	const consecutiveViolations = result.violations.filter((v) => v.code === 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED');
	assert(consecutiveViolations.every((v) => v.severity === 'SOFT'), 'All consecutive violations are SOFT when toggle is off');
}

{
	// Scenario: consecutive limit exceeded with enforceConsecutiveBreakAsHard=true (HARD)
	const entries: ScheduledEntry[] = [
		makeEntry({ entryId: 'e1', startTime: '07:30', endTime: '08:20', durationMinutes: 50 }),
		makeEntry({ entryId: 'e2', startTime: '08:20', endTime: '09:10', durationMinutes: 50 }),
		makeEntry({ entryId: 'e3', startTime: '09:10', endTime: '10:00', durationMinutes: 50 }),
	];
	const ctx = makeCtx(entries, { enforceConsecutiveBreakAsHard: true, maxConsecutiveTeachingMinutesBeforeBreak: 100 });
	const result = validateHardConstraints(ctx);

	const hardViolations = result.violations.filter((v) => v.severity === 'HARD');
	const consecutiveHard = hardViolations.filter((v) => v.code === 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED');

	assert(consecutiveHard.length > 0, 'HARD consecutive violations when toggle is ON');
}

{
	// Scenario: clean schedule — zero violations of any kind
	const entries: ScheduledEntry[] = [
		makeEntry({ entryId: 'e1', day: 'MONDAY', startTime: '07:30', endTime: '08:20', durationMinutes: 50 }),
		makeEntry({ entryId: 'e2', day: 'TUESDAY', startTime: '07:30', endTime: '08:20', durationMinutes: 50 }),
	];
	const ctx = makeCtx(entries, { enforceConsecutiveBreakAsHard: false });
	const result = validateHardConstraints(ctx);

	const hardViolations = result.violations.filter((v) => v.severity === 'HARD');
	assertEqual(hardViolations.length, 0, 'Clean schedule has zero hard violations');
	assertEqual(result.violations.length, 0, 'Clean schedule has zero total violations');
}

// ═══════════════════════════════════════════════════════
// Test Suite 2: Policy severity toggling
// ═══════════════════════════════════════════════════════

section('Policy severity toggling (consecutive + break)');

{
	// Break requirement violated — toggle OFF → SOFT
	const entries: ScheduledEntry[] = [
		makeEntry({ entryId: 'e1', startTime: '07:30', endTime: '08:20', durationMinutes: 50 }),
		makeEntry({ entryId: 'e2', startTime: '08:25', endTime: '09:15', durationMinutes: 50 }),
	];
	const ctx = makeCtx(entries, { enforceConsecutiveBreakAsHard: false, minBreakMinutesAfterConsecutiveBlock: 15 });
	const result = validateHardConstraints(ctx);

	const breakViolations = result.violations.filter((v) => v.code === 'FACULTY_BREAK_REQUIREMENT_VIOLATED');
	assert(breakViolations.length > 0, 'Break requirement violation emitted when gap < minimum');
	assert(breakViolations.every((v) => v.severity === 'SOFT'), 'Break violations are SOFT when toggle is OFF');
}

{
	// Break requirement violated — toggle ON → HARD
	const entries: ScheduledEntry[] = [
		makeEntry({ entryId: 'e1', startTime: '07:30', endTime: '08:20', durationMinutes: 50 }),
		makeEntry({ entryId: 'e2', startTime: '08:25', endTime: '09:15', durationMinutes: 50 }),
	];
	const ctx = makeCtx(entries, { enforceConsecutiveBreakAsHard: true, minBreakMinutesAfterConsecutiveBlock: 15 });
	const result = validateHardConstraints(ctx);

	const breakViolations = result.violations.filter((v) => v.code === 'FACULTY_BREAK_REQUIREMENT_VIOLATED');
	assert(breakViolations.length > 0, 'Break requirement violation emitted when toggle is ON');
	assert(breakViolations.every((v) => v.severity === 'HARD'), 'Break violations are HARD when toggle is ON');
}

{
	// Daily max always stays HARD regardless of toggle
	const entries: ScheduledEntry[] = [];
	// Create 9 x 50-minute entries in one day = 450 min (exceeds 400 daily max)
	for (let i = 0; i < 9; i++) {
		const h = 7 + i;
		entries.push(makeEntry({
			entryId: `e${i + 1}`,
			day: 'MONDAY',
			startTime: `${String(h).padStart(2, '0')}:00`,
			endTime: `${String(h).padStart(2, '0')}:50`,
			durationMinutes: 50,
		}));
	}
	const ctx = makeCtx(entries, { enforceConsecutiveBreakAsHard: false, maxTeachingMinutesPerDay: 400 });
	const result = validateHardConstraints(ctx);

	const dailyMax = result.violations.filter((v) => v.code === 'FACULTY_DAILY_MAX_EXCEEDED');
	assert(dailyMax.length > 0, 'Daily max violation emitted');
	assert(dailyMax.every((v) => v.severity === 'HARD'), 'Daily max is always HARD regardless of toggle');
}

// ═══════════════════════════════════════════════════════
// Test Suite 3: Room schedule interval-union dedup
// ═══════════════════════════════════════════════════════

section('Interval-union deduplication for occupiedMinutes');

{
	const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

	// Non-overlapping: two distinct slots = 100 min
	const nonOverlapping = computeOccupiedMinutesByIntervalUnion([
		{ day: 'MONDAY', startTime: '07:30', endTime: '08:20' },
		{ day: 'MONDAY', startTime: '08:20', endTime: '09:10' },
	], DAYS);
	assertEqual(nonOverlapping, 100, 'Non-overlapping adjacent periods = 100 min');

	// Overlapping: same slot listed twice should NOT double-count
	const overlapping = computeOccupiedMinutesByIntervalUnion([
		{ day: 'MONDAY', startTime: '07:30', endTime: '08:20' },
		{ day: 'MONDAY', startTime: '07:30', endTime: '08:20' },
	], DAYS);
	assertEqual(overlapping, 50, 'Duplicate entry on same slot = 50 min (not 100)');

	// Partial overlap
	const partialOverlap = computeOccupiedMinutesByIntervalUnion([
		{ day: 'MONDAY', startTime: '07:30', endTime: '08:30' },
		{ day: 'MONDAY', startTime: '08:00', endTime: '09:00' },
	], DAYS);
	assertEqual(partialOverlap, 90, 'Partial overlap [07:30-08:30] + [08:00-09:00] = 90 min (union)');

	// Multi-day entries are summed independently
	const multiDay = computeOccupiedMinutesByIntervalUnion([
		{ day: 'MONDAY', startTime: '07:30', endTime: '08:20' },
		{ day: 'TUESDAY', startTime: '07:30', endTime: '08:20' },
	], DAYS);
	assertEqual(multiDay, 100, 'Two entries on different days = 100 min total');

	// Empty schedule
	const empty = computeOccupiedMinutesByIntervalUnion([], DAYS);
	assertEqual(empty, 0, 'Empty schedule = 0 occupied minutes');
}

// ═══════════════════════════════════════════════════════
// Test Suite 4: Core hard constraints
// ═══════════════════════════════════════════════════════

section('Core hard constraint detection');

{
	// Faculty time conflict
	const entries: ScheduledEntry[] = [
		makeEntry({ entryId: 'e1', facultyId: 1, sectionId: 1, day: 'MONDAY', startTime: '07:30', endTime: '08:20' }),
		makeEntry({ entryId: 'e2', facultyId: 1, sectionId: 2, day: 'MONDAY', startTime: '07:30', endTime: '08:20' }),
	];
	const ctx = makeCtx(entries);
	const result = validateHardConstraints(ctx);

	const conflicts = result.violations.filter((v) => v.code === 'FACULTY_TIME_CONFLICT');
	assert(conflicts.length > 0, 'Faculty time conflict detected for same faculty/day/time');
	assert(conflicts.every((v) => v.severity === 'HARD'), 'Faculty time conflicts are always HARD');
}

{
	// Room time conflict
	const entries: ScheduledEntry[] = [
		makeEntry({ entryId: 'e1', facultyId: 1, roomId: 1, sectionId: 1, day: 'MONDAY', startTime: '07:30', endTime: '08:20' }),
		makeEntry({ entryId: 'e2', facultyId: 2, roomId: 1, sectionId: 2, subjectId: 2, day: 'MONDAY', startTime: '07:30', endTime: '08:20' }),
	];
	const ctx = makeCtx(entries);
	const result = validateHardConstraints(ctx);

	const roomConflicts = result.violations.filter((v) => v.code === 'ROOM_TIME_CONFLICT');
	assert(roomConflicts.length > 0, 'Room time conflict detected for same room/day/time');
}

{
	// Room type mismatch
	const entries: ScheduledEntry[] = [
		makeEntry({ entryId: 'e1', subjectId: 2, roomId: 1 }), // Subject 2 needs SCIENCE_LAB, room 1 is REGULAR
	];
	const ctx = makeCtx(entries);
	const result = validateHardConstraints(ctx);

	const mismatches = result.violations.filter((v) => v.code === 'ROOM_TYPE_MISMATCH');
	assert(mismatches.length > 0, 'Room type mismatch detected');
}

{
	// Faculty-subject not qualified
	const entries: ScheduledEntry[] = [
		makeEntry({ entryId: 'e1', facultyId: 1, subjectId: 2 }), // Faculty 1 not assigned to subject 2
	];
	const ctx = makeCtx(entries);
	const result = validateHardConstraints(ctx);

	const unqualified = result.violations.filter((v) => v.code === 'FACULTY_SUBJECT_NOT_QUALIFIED');
	assert(unqualified.length > 0, 'Faculty-subject mismatch detected');
}

// ═══════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(60));
console.log(`Tests: ${passCount} passed, ${failCount} failed, ${passCount + failCount} total`);
console.log('═'.repeat(60));

process.exit(failCount > 0 ? 1 : 0);
