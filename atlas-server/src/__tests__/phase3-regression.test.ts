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
// Test Suite 5: Travel / well-being soft constraints
// ═══════════════════════════════════════════════════════

section('Travel / well-being soft constraints');

// Shared travel test fixtures
const travelBuildings: Array<{ id: number; x: number; y: number }> = [
	{ id: 10, x: 0, y: 0 },
	{ id: 20, x: 200, y: 0 },   // 200m from building 10
	{ id: 30, x: 50, y: 0 },    // 50m from building 10
];

const travelRoomBuildings: Array<{ roomId: number; buildingId: number }> = [
	{ roomId: 1, buildingId: 10 },
	{ roomId: 2, buildingId: 20 },
	{ roomId: 3, buildingId: 30 },
];

function makeTravelCtx(
	entries: ScheduledEntry[],
	travelPolicyOverrides?: Partial<ValidatorContext['travelPolicy']>,
): ValidatorContext {
	return {
		...makeCtx(entries),
		buildings: travelBuildings,
		roomBuildings: travelRoomBuildings,
		travelPolicy: {
			enableTravelWellbeingChecks: true,
			maxWalkingDistanceMetersPerTransition: 120,
			maxBuildingTransitionsPerDay: 4,
			maxBackToBackTransitionsWithoutBuffer: 2,
			maxIdleGapMinutesPerDay: 60,
			avoidEarlyFirstPeriod: false,
			avoidLateLastPeriod: false,
			...travelPolicyOverrides,
		},
	};
}

{
	// Same-building transitions → no travel violations
	const entries: ScheduledEntry[] = [
		makeEntry({ entryId: 'tw1', roomId: 1, day: 'MONDAY', startTime: '07:30', endTime: '08:20' }),
		makeEntry({ entryId: 'tw2', roomId: 1, day: 'MONDAY', startTime: '08:20', endTime: '09:10' }),
	];
	const ctx = makeTravelCtx(entries);
	const result = validateHardConstraints(ctx);

	const travelViols = result.violations.filter((v) =>
		v.code === 'FACULTY_EXCESSIVE_TRAVEL_DISTANCE' ||
		v.code === 'FACULTY_EXCESSIVE_BUILDING_TRANSITIONS' ||
		v.code === 'FACULTY_INSUFFICIENT_TRANSITION_BUFFER'
	);
	assertEqual(travelViols.length, 0, 'Same-building transitions produce zero travel violations');
}

{
	// Cross-building short distance (50m) within threshold → no distance violation
	const entries: ScheduledEntry[] = [
		makeEntry({ entryId: 'tw1', roomId: 1, day: 'MONDAY', startTime: '07:30', endTime: '08:20' }),
		makeEntry({ entryId: 'tw2', roomId: 3, day: 'MONDAY', startTime: '08:30', endTime: '09:20' }),
	];
	const ctx = makeTravelCtx(entries, { maxWalkingDistanceMetersPerTransition: 120 });
	const result = validateHardConstraints(ctx);

	const distViols = result.violations.filter((v) => v.code === 'FACULTY_EXCESSIVE_TRAVEL_DISTANCE');
	assertEqual(distViols.length, 0, 'Under-threshold distance (50m < 120m) produces no distance violation');
}

{
	// Cross-building exceeding distance threshold → FACULTY_EXCESSIVE_TRAVEL_DISTANCE
	const entries: ScheduledEntry[] = [
		makeEntry({ entryId: 'tw1', roomId: 1, day: 'MONDAY', startTime: '07:30', endTime: '08:20' }),
		makeEntry({ entryId: 'tw2', roomId: 2, day: 'MONDAY', startTime: '08:30', endTime: '09:20' }),
	];
	const ctx = makeTravelCtx(entries, { maxWalkingDistanceMetersPerTransition: 120 });
	const result = validateHardConstraints(ctx);

	const distViols = result.violations.filter((v) => v.code === 'FACULTY_EXCESSIVE_TRAVEL_DISTANCE');
	assert(distViols.length > 0, 'Over-threshold distance (200m > 120m) emits FACULTY_EXCESSIVE_TRAVEL_DISTANCE');
	assert(distViols.every((v) => v.severity === 'SOFT'), 'Travel distance violations are SOFT');
	assert(distViols[0].meta?.estimatedDistanceMeters === 200, 'Meta includes correct estimated distance');
}

{
	// Excessive building transitions per day
	const entries: ScheduledEntry[] = [];
	// 6 entries alternating between building 10 and 20 → 5 cross-building transitions
	for (let i = 0; i < 6; i++) {
		const h = 7 + i;
		entries.push(makeEntry({
			entryId: `tw${i + 1}`,
			roomId: (i % 2 === 0) ? 1 : 2, // alternates building 10 and 20
			day: 'MONDAY',
			startTime: `${String(h).padStart(2, '0')}:00`,
			endTime: `${String(h).padStart(2, '0')}:50`,
			durationMinutes: 50,
		}));
	}
	const ctx = makeTravelCtx(entries, { maxBuildingTransitionsPerDay: 2 });
	const result = validateHardConstraints(ctx);

	const transViols = result.violations.filter((v) => v.code === 'FACULTY_EXCESSIVE_BUILDING_TRANSITIONS');
	assert(transViols.length > 0, '5 building transitions exceeds limit of 2 → violation emitted');
	assert(transViols[0].meta?.buildingTransitions === 5, 'Meta reports correct transition count');
}

{
	// Back-to-back cross-building transitions without buffer (gap ≤ 5 min)
	const entries: ScheduledEntry[] = [
		makeEntry({ entryId: 'tw1', roomId: 1, day: 'MONDAY', startTime: '07:30', endTime: '08:20' }),
		makeEntry({ entryId: 'tw2', roomId: 2, day: 'MONDAY', startTime: '08:20', endTime: '09:10' }), // 0 min gap, cross-building
		makeEntry({ entryId: 'tw3', roomId: 1, day: 'MONDAY', startTime: '09:10', endTime: '10:00' }), // 0 min gap, cross-building
		makeEntry({ entryId: 'tw4', roomId: 2, day: 'MONDAY', startTime: '10:00', endTime: '10:50' }), // 0 min gap, cross-building
	];
	const ctx = makeTravelCtx(entries, { maxBackToBackTransitionsWithoutBuffer: 1 });
	const result = validateHardConstraints(ctx);

	const bufferViols = result.violations.filter((v) => v.code === 'FACULTY_INSUFFICIENT_TRANSITION_BUFFER');
	assert(bufferViols.length > 0, '3 back-to-back cross-building transitions exceeds limit of 1');
	assert(bufferViols[0].meta?.backToBackTransitions === 3, 'Meta reports correct back-to-back count');
}

{
	// Travel checks disabled → no travel violations even with violating entries
	const entries: ScheduledEntry[] = [
		makeEntry({ entryId: 'tw1', roomId: 1, day: 'MONDAY', startTime: '07:30', endTime: '08:20' }),
		makeEntry({ entryId: 'tw2', roomId: 2, day: 'MONDAY', startTime: '08:20', endTime: '09:10' }),
	];
	const ctx = makeTravelCtx(entries, { enableTravelWellbeingChecks: false });
	const result = validateHardConstraints(ctx);

	const travelViols = result.violations.filter((v) =>
		v.code === 'FACULTY_EXCESSIVE_TRAVEL_DISTANCE' ||
		v.code === 'FACULTY_EXCESSIVE_BUILDING_TRANSITIONS' ||
		v.code === 'FACULTY_INSUFFICIENT_TRANSITION_BUFFER'
	);
	assertEqual(travelViols.length, 0, 'No travel violations when enableTravelWellbeingChecks is false');
}

{
	// Cross-building with sufficient gap (> 5 min) → no buffer violation
	const entries: ScheduledEntry[] = [
		makeEntry({ entryId: 'tw1', roomId: 1, day: 'MONDAY', startTime: '07:30', endTime: '08:20' }),
		makeEntry({ entryId: 'tw2', roomId: 2, day: 'MONDAY', startTime: '08:30', endTime: '09:20' }), // 10 min gap
		makeEntry({ entryId: 'tw3', roomId: 1, day: 'MONDAY', startTime: '09:30', endTime: '10:20' }), // 10 min gap
	];
	const ctx = makeTravelCtx(entries, { maxBackToBackTransitionsWithoutBuffer: 1 });
	const result = validateHardConstraints(ctx);

	const bufferViols = result.violations.filter((v) => v.code === 'FACULTY_INSUFFICIENT_TRANSITION_BUFFER');
	assertEqual(bufferViols.length, 0, 'Cross-building with > 5 min gaps → no buffer violation');
}

// ═══════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(60));
console.log(`Tests: ${passCount} passed, ${failCount} failed, ${passCount + failCount} total`);
console.log('═'.repeat(60));

process.exit(failCount > 0 ? 1 : 0);
