/**
 * Focused regression tests for Phase 3 generation components.
 * Run with: npx tsx atlas-server/src/__tests__/phase3-regression.test.ts
 *
 * Tests are self-contained and use only in-memory constructs (no DB).
 */
import { validateHardConstraints, } from '../services/constraint-validator.js';
import { computeOccupiedMinutesByIntervalUnion } from '../services/room-schedule.metrics.js';
// ─── Test helpers ───
let passCount = 0;
let failCount = 0;
function assert(condition, label) {
    if (condition) {
        passCount++;
        console.log(`  ✓ ${label}`);
    }
    else {
        failCount++;
        console.error(`  ✗ ${label}`);
    }
}
function assertEqual(actual, expected, label) {
    if (actual === expected) {
        passCount++;
        console.log(`  ✓ ${label}`);
    }
    else {
        failCount++;
        console.error(`  ✗ ${label} — expected ${expected}, got ${actual}`);
    }
}
function section(name) {
    console.log(`\n═══ ${name} ═══`);
}
// ─── Shared test fixtures ───
const baseFaculty = [{ id: 1, maxHoursPerWeek: 40 }, { id: 2, maxHoursPerWeek: 20 }];
const baseFacultySubjects = [
    { facultyId: 1, subjectId: 1, sectionIds: [1] },
    { facultyId: 2, subjectId: 2, sectionIds: [2] },
];
const baseRooms = [
    { id: 1, type: 'REGULAR_CLASSROOM' },
    { id: 2, type: 'SCIENCE_LAB' },
];
const baseSubjects = [
    { id: 1, preferredRoomType: 'REGULAR_CLASSROOM' },
    { id: 2, preferredRoomType: 'SCIENCE_LAB' },
];
function makeEntry(overrides) {
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
function makeCtx(entries, policyOverrides) {
    return {
        schoolId: 1,
        schoolYearId: 1,
        runId: 1,
        entries,
        faculty: baseFaculty,
        facultySubjects: baseFacultySubjects,
        rooms: baseRooms,
        subjects: baseSubjects,
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
    const entries = [
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
    const entries = [
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
    const entries = [
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
    const entries = [
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
    const entries = [
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
    const entries = [];
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
    const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
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
    const entries = [
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
    const entries = [
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
    const entries = [
        makeEntry({ entryId: 'e1', subjectId: 2, roomId: 1 }), // Subject 2 needs SCIENCE_LAB, room 1 is REGULAR
    ];
    const ctx = makeCtx(entries);
    const result = validateHardConstraints(ctx);
    const mismatches = result.violations.filter((v) => v.code === 'ROOM_TYPE_MISMATCH');
    assert(mismatches.length > 0, 'Room type mismatch detected');
}
{
    // Faculty-subject not qualified
    const entries = [
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
const travelBuildings = [
    { id: 10, x: 0, y: 0 },
    { id: 20, x: 200, y: 0 }, // 200m from building 10
    { id: 30, x: 50, y: 0 }, // 50m from building 10
];
const travelRoomBuildings = [
    { roomId: 1, buildingId: 10 },
    { roomId: 2, buildingId: 20 },
    { roomId: 3, buildingId: 30 },
];
function makeTravelCtx(entries, travelPolicyOverrides) {
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
    const entries = [
        makeEntry({ entryId: 'tw1', roomId: 1, day: 'MONDAY', startTime: '07:30', endTime: '08:20' }),
        makeEntry({ entryId: 'tw2', roomId: 1, day: 'MONDAY', startTime: '08:20', endTime: '09:10' }),
    ];
    const ctx = makeTravelCtx(entries);
    const result = validateHardConstraints(ctx);
    const travelViols = result.violations.filter((v) => v.code === 'FACULTY_EXCESSIVE_TRAVEL_DISTANCE' ||
        v.code === 'FACULTY_EXCESSIVE_BUILDING_TRANSITIONS' ||
        v.code === 'FACULTY_INSUFFICIENT_TRANSITION_BUFFER');
    assertEqual(travelViols.length, 0, 'Same-building transitions produce zero travel violations');
}
{
    // Cross-building short distance (50m) within threshold → no distance violation
    const entries = [
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
    const entries = [
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
    const entries = [];
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
    const entries = [
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
    const entries = [
        makeEntry({ entryId: 'tw1', roomId: 1, day: 'MONDAY', startTime: '07:30', endTime: '08:20' }),
        makeEntry({ entryId: 'tw2', roomId: 2, day: 'MONDAY', startTime: '08:20', endTime: '09:10' }),
    ];
    const ctx = makeTravelCtx(entries, { enableTravelWellbeingChecks: false });
    const result = validateHardConstraints(ctx);
    const travelViols = result.violations.filter((v) => v.code === 'FACULTY_EXCESSIVE_TRAVEL_DISTANCE' ||
        v.code === 'FACULTY_EXCESSIVE_BUILDING_TRANSITIONS' ||
        v.code === 'FACULTY_INSUFFICIENT_TRANSITION_BUFFER');
    assertEqual(travelViols.length, 0, 'No travel violations when enableTravelWellbeingChecks is false');
}
{
    // Cross-building with sufficient gap (> 5 min) → no buffer violation
    const entries = [
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
// Test Suite 6: Well-being soft constraints (idle gap, early start, late end)
// ═══════════════════════════════════════════════════════
section('Well-being soft constraints (idle gap, early/late)');
{
    // Excessive idle gap → FACULTY_EXCESSIVE_IDLE_GAP
    const entries = [
        makeEntry({ entryId: 'wb1', day: 'MONDAY', startTime: '07:30', endTime: '08:20', durationMinutes: 50 }),
        // 100 min gap
        makeEntry({ entryId: 'wb2', day: 'MONDAY', startTime: '10:00', endTime: '10:50', durationMinutes: 50 }),
    ];
    const ctx = makeTravelCtx(entries, { maxIdleGapMinutesPerDay: 60 });
    const result = validateHardConstraints(ctx);
    const idleViols = result.violations.filter((v) => v.code === 'FACULTY_EXCESSIVE_IDLE_GAP');
    assert(idleViols.length > 0, 'Idle gap of 100 min exceeds 60 min limit → violation emitted');
    assert(idleViols[0].severity === 'SOFT', 'Idle gap violation is SOFT');
    assert(idleViols[0].meta?.totalIdleMinutes === 100, 'Meta includes correct idle total');
}
{
    // Idle gap within threshold → no violation
    const entries = [
        makeEntry({ entryId: 'wb1', day: 'MONDAY', startTime: '07:30', endTime: '08:20', durationMinutes: 50 }),
        // 30 min gap
        makeEntry({ entryId: 'wb2', day: 'MONDAY', startTime: '08:50', endTime: '09:40', durationMinutes: 50 }),
    ];
    const ctx = makeTravelCtx(entries, { maxIdleGapMinutesPerDay: 60 });
    const result = validateHardConstraints(ctx);
    const idleViols = result.violations.filter((v) => v.code === 'FACULTY_EXCESSIVE_IDLE_GAP');
    assertEqual(idleViols.length, 0, 'Idle gap of 30 min within 60 min limit → no violation');
}
{
    // Early start preference triggered
    const entries = [
        makeEntry({ entryId: 'wb1', day: 'MONDAY', startTime: '07:00', endTime: '07:50', durationMinutes: 50 }),
        makeEntry({ entryId: 'wb2', day: 'MONDAY', startTime: '08:00', endTime: '08:50', durationMinutes: 50 }),
    ];
    const ctx = makeTravelCtx(entries, { avoidEarlyFirstPeriod: true });
    // Ensure policy sets earliestStartTime=07:00
    ctx.policy = {
        maxConsecutiveTeachingMinutesBeforeBreak: 120,
        minBreakMinutesAfterConsecutiveBlock: 15,
        maxTeachingMinutesPerDay: 400,
        earliestStartTime: '07:00',
        latestEndTime: '17:00',
        enforceConsecutiveBreakAsHard: false,
    };
    const result = validateHardConstraints(ctx);
    const earlyViols = result.violations.filter((v) => v.code === 'FACULTY_EARLY_START_PREFERENCE');
    assert(earlyViols.length > 0, 'Class at 07:00 with avoidEarlyFirstPeriod=true → violation emitted');
    assert(earlyViols[0].severity === 'SOFT', 'Early start preference is SOFT');
}
{
    // Early start preference disabled → no violation
    const entries = [
        makeEntry({ entryId: 'wb1', day: 'MONDAY', startTime: '07:00', endTime: '07:50', durationMinutes: 50 }),
    ];
    const ctx = makeTravelCtx(entries, { avoidEarlyFirstPeriod: false });
    const result = validateHardConstraints(ctx);
    const earlyViols = result.violations.filter((v) => v.code === 'FACULTY_EARLY_START_PREFERENCE');
    assertEqual(earlyViols.length, 0, 'avoidEarlyFirstPeriod=false → no early start violation');
}
{
    // Late end preference triggered
    const entries = [
        makeEntry({ entryId: 'wb1', day: 'MONDAY', startTime: '15:00', endTime: '15:50', durationMinutes: 50 }),
        makeEntry({ entryId: 'wb2', day: 'MONDAY', startTime: '16:10', endTime: '17:00', durationMinutes: 50 }),
    ];
    const ctx = makeTravelCtx(entries, { avoidLateLastPeriod: true });
    ctx.policy = {
        maxConsecutiveTeachingMinutesBeforeBreak: 120,
        minBreakMinutesAfterConsecutiveBlock: 15,
        maxTeachingMinutesPerDay: 400,
        earliestStartTime: '07:00',
        latestEndTime: '17:00',
        enforceConsecutiveBreakAsHard: false,
    };
    const result = validateHardConstraints(ctx);
    const lateViols = result.violations.filter((v) => v.code === 'FACULTY_LATE_END_PREFERENCE');
    assert(lateViols.length > 0, 'Class ending at 17:00 with avoidLateLastPeriod=true → violation emitted');
    assert(lateViols[0].severity === 'SOFT', 'Late end preference is SOFT');
}
{
    // Late end preference disabled → no violation
    const entries = [
        makeEntry({ entryId: 'wb1', day: 'MONDAY', startTime: '16:10', endTime: '17:00', durationMinutes: 50 }),
    ];
    const ctx = makeTravelCtx(entries, { avoidLateLastPeriod: false });
    const result = validateHardConstraints(ctx);
    const lateViols = result.violations.filter((v) => v.code === 'FACULTY_LATE_END_PREFERENCE');
    assertEqual(lateViols.length, 0, 'avoidLateLastPeriod=false → no late end violation');
}
{
    // enableTravelWellbeingChecks=false disables all wellbeing checks
    const entries = [
        makeEntry({ entryId: 'wb1', day: 'MONDAY', startTime: '07:00', endTime: '07:50', durationMinutes: 50 }),
        makeEntry({ entryId: 'wb2', day: 'MONDAY', startTime: '10:00', endTime: '10:50', durationMinutes: 50 }),
    ];
    const ctx = makeTravelCtx(entries, {
        enableTravelWellbeingChecks: false,
        avoidEarlyFirstPeriod: true,
        avoidLateLastPeriod: true,
        maxIdleGapMinutesPerDay: 10,
    });
    const result = validateHardConstraints(ctx);
    const wbCodes = ['FACULTY_EXCESSIVE_IDLE_GAP', 'FACULTY_EARLY_START_PREFERENCE', 'FACULTY_LATE_END_PREFERENCE'];
    const wbViols = result.violations.filter((v) => wbCodes.includes(v.code));
    assertEqual(wbViols.length, 0, 'enableTravelWellbeingChecks=false disables all wellbeing violations');
}
// ═══════════════════════════════════════════════════════
// Test Suite 7: constraintConfig overrides (enabled, treatAsHard, weight)
// ═══════════════════════════════════════════════════════
section('constraintConfig overrides');
{
    // Disabled constraint → violation dropped
    const entries = [
        makeEntry({ entryId: 'cc1', day: 'MONDAY', startTime: '07:30', endTime: '08:20', durationMinutes: 50 }),
        makeEntry({ entryId: 'cc2', day: 'MONDAY', startTime: '10:00', endTime: '10:50', durationMinutes: 50 }),
    ];
    const ctx = makeTravelCtx(entries, { maxIdleGapMinutesPerDay: 10 });
    ctx.constraintConfig = {
        FACULTY_EXCESSIVE_IDLE_GAP: { enabled: false, weight: 3, treatAsHard: false },
    };
    const result = validateHardConstraints(ctx);
    const idleViols = result.violations.filter((v) => v.code === 'FACULTY_EXCESSIVE_IDLE_GAP');
    assertEqual(idleViols.length, 0, 'Disabled constraint → idle gap violation suppressed');
}
{
    // treatAsHard promotes SOFT → HARD
    const entries = [
        makeEntry({ entryId: 'cc1', day: 'MONDAY', startTime: '07:30', endTime: '08:20', durationMinutes: 50 }),
        makeEntry({ entryId: 'cc2', day: 'MONDAY', startTime: '10:00', endTime: '10:50', durationMinutes: 50 }),
    ];
    const ctx = makeTravelCtx(entries, { maxIdleGapMinutesPerDay: 10 });
    ctx.constraintConfig = {
        FACULTY_EXCESSIVE_IDLE_GAP: { enabled: true, weight: 8, treatAsHard: true },
    };
    const result = validateHardConstraints(ctx);
    const idleViols = result.violations.filter((v) => v.code === 'FACULTY_EXCESSIVE_IDLE_GAP');
    assert(idleViols.length > 0, 'Idle gap violation still emitted when enabled');
    assert(idleViols[0].severity === 'HARD', 'treatAsHard=true promotes SOFT idle gap violation to HARD');
}
{
    // weight is included in violation meta
    const entries = [
        makeEntry({ entryId: 'cc1', day: 'MONDAY', startTime: '07:30', endTime: '08:20', durationMinutes: 50 }),
        makeEntry({ entryId: 'cc2', day: 'MONDAY', startTime: '10:00', endTime: '10:50', durationMinutes: 50 }),
    ];
    const ctx = makeTravelCtx(entries, { maxIdleGapMinutesPerDay: 10 });
    ctx.constraintConfig = {
        FACULTY_EXCESSIVE_IDLE_GAP: { enabled: true, weight: 7, treatAsHard: false },
    };
    const result = validateHardConstraints(ctx);
    const idleViols = result.violations.filter((v) => v.code === 'FACULTY_EXCESSIVE_IDLE_GAP');
    assert(idleViols.length > 0, 'Idle gap violation emitted');
    assert(idleViols[0].meta?.constraintWeight === 7, 'Weight value is injected into violation meta');
}
// ═══════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60));
console.log(`Tests: ${passCount} passed, ${failCount} failed, ${passCount + failCount} total`);
console.log('═'.repeat(60));
process.exit(failCount > 0 ? 1 : 0);
//# sourceMappingURL=phase3-regression.test.js.map