/**
 * Tests for hybrid-scheduler.ts
 *
 * H-ALG-1: Seed determinism and diversity
 * H-ALG-2: Fitness scoring correctness
 * H-ALG-3: Repair operator correctness
 */
import { scoreFitness, repairHardConflicts, runHybridScheduler, } from '../services/hybrid-scheduler.js';
/** Build a minimal valid SectionsByGrade entry for test fixtures. */
function makeGrade(displayOrder, sections) {
    return {
        gradeLevelId: displayOrder,
        gradeLevelName: `Grade ${displayOrder}`,
        displayOrder,
        sections: sections.map((s) => ({
            id: s.id,
            name: s.name,
            maxCapacity: 45,
            enrolledCount: s.enrolledCount,
            gradeLevelId: displayOrder,
            gradeLevelName: `Grade ${displayOrder}`,
            displayOrder,
            programType: 'REGULAR',
            adviserId: s.adviserId ?? null,
            adviserName: s.adviserName ?? null,
        })),
    };
}
let passCount = 0;
let failCount = 0;
function section(name) {
    console.log(`\n═══ ${name} ═══`);
}
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
        console.error(`  ✗ ${label} — expected ${String(expected)}, got ${String(actual)}`);
    }
}
function assertGreaterThan(actual, threshold, label) {
    if (actual > threshold) {
        passCount++;
        console.log(`  ✓ ${label} (${actual} > ${threshold})`);
    }
    else {
        failCount++;
        console.error(`  ✗ ${label} — expected > ${threshold}, got ${actual}`);
    }
}
function assertLessThan(actual, threshold, label) {
    if (actual < threshold) {
        passCount++;
        console.log(`  ✓ ${label} (${actual} < ${threshold})`);
    }
    else {
        failCount++;
        console.error(`  ✗ ${label} — expected < ${threshold}, got ${actual}`);
    }
}
// ─── H-ALG-2: Fitness scoring tests ───
section('H-ALG-2-01 scoreFitness completionRate reflects assignment ratio');
{
    const r = {
        entries: [],
        unassignedItems: [],
        lockWarnings: [],
        assignedCount: 8,
        unassignedCount: 2,
        classesProcessed: 10,
        policyBlockedCount: 0,
    };
    const f = scoreFitness(r);
    assertEqual(f.completionRate, 0.8, 'completionRate = 0.8 when 8 of 10 assigned');
    assert(f.total > 0, 'Score is positive when no hard violations');
}
section('H-ALG-2-02 scoreFitness hard violations dominate score');
{
    const r = {
        entries: [],
        unassignedItems: [],
        lockWarnings: [],
        assignedCount: 10,
        unassignedCount: 0,
        classesProcessed: 10,
        policyBlockedCount: 0,
    };
    const good = scoreFitness(r, 0, 0);
    const hardViolation = scoreFitness(r, 1, 0);
    const softViolation = scoreFitness(r, 0, 5);
    assert(good.total > hardViolation.total, 'One hard violation drops score below zero hard violations');
    assert(hardViolation.total < softViolation.total, 'One hard violation is worse than five soft violations');
}
section('H-ALG-2-03 scoreFitness zero classesProcessed returns 0 completionRate');
{
    const r = {
        entries: [],
        unassignedItems: [],
        lockWarnings: [],
        assignedCount: 0,
        unassignedCount: 0,
        classesProcessed: 0,
        policyBlockedCount: 0,
    };
    const f = scoreFitness(r);
    assertEqual(f.completionRate, 0, 'completionRate = 0 when classesProcessed = 0 (no division by zero)');
}
section('H-ALG-2-04 scoreFitness is deterministic for same input');
{
    const r = {
        entries: [],
        unassignedItems: [],
        lockWarnings: [],
        assignedCount: 5,
        unassignedCount: 3,
        classesProcessed: 8,
        policyBlockedCount: 1,
    };
    const f1 = scoreFitness(r, 0, 2);
    const f2 = scoreFitness(r, 0, 2);
    assertEqual(f1.total, f2.total, 'scoreFitness is deterministic (same input → same output)');
    assertEqual(f1.completionRate, f2.completionRate, 'completionRate is deterministic');
}
// ─── H-ALG-3: Repair operator tests ───
function makeEntry(id, facultyId, roomId, sectionId, day, startTime, endTime = '08:20') {
    return {
        entryId: id,
        facultyId,
        roomId,
        subjectId: 1,
        sectionId,
        day,
        startTime,
        endTime,
        durationMinutes: 50,
    };
}
section('H-ALG-3-01 repairHardConflicts returns unchanged entries when no conflicts');
{
    const entries = [
        makeEntry('e1', 1, 1, 1, 'MONDAY', '07:30'),
        makeEntry('e2', 2, 2, 2, 'MONDAY', '08:20'),
        makeEntry('e3', 1, 1, 1, 'TUESDAY', '07:30'),
    ];
    const { entries: result, impact } = repairHardConflicts(entries, new Set());
    assertEqual(result.length, 3, 'All entries preserved');
    assertEqual(impact.attemptsTotal, 0, 'No repair attempts when no conflicts');
    assertEqual(impact.conflictsResolved, 0, 'No conflicts resolved');
}
section('H-ALG-3-02 repairHardConflicts detects faculty-time conflict');
{
    // Two entries same faculty, same slot — conflict on entry e2.
    // e3 uses a DIFFERENT faculty (2) to create a TUESDAY slot that is free for faculty=1.
    const entries = [
        makeEntry('e1', 1, 1, 1, 'MONDAY', '07:30', '08:20'),
        makeEntry('e2', 1, 2, 2, 'MONDAY', '07:30', '08:20'), // same faculty=1 + slot → conflict
        makeEntry('e3', 2, 3, 3, 'TUESDAY', '07:30', '08:20'), // faculty=2 creates TUESDAY slot; faculty=1 free then
    ];
    const { entries: result, impact } = repairHardConflicts(entries, new Set());
    assert(impact.attemptsTotal > 0, 'At least one repair attempt made');
    // After repair, e2 should be on a different slot than e1
    const e1 = result.find((e) => e.entryId === 'e1');
    const e2 = result.find((e) => e.entryId === 'e2');
    assert(!(e1.facultyId === e2.facultyId && e1.day === e2.day && e1.startTime === e2.startTime), 'Faculty-time conflict resolved: e1 and e2 no longer overlap');
}
section('H-ALG-3-03 repairHardConflicts detects room-time conflict');
{
    // Same room=5, same slot — two different faculty but same room → conflict on e2.
    // e3 uses faculty=3, room=6, section=3 to create a TUESDAY slot that is free for faculty=2/room=5/section=2.
    const entries = [
        makeEntry('e1', 1, 5, 1, 'MONDAY', '07:30', '08:20'),
        makeEntry('e2', 2, 5, 2, 'MONDAY', '07:30', '08:20'), // same room=5 + slot → conflict
        makeEntry('e3', 3, 6, 3, 'TUESDAY', '07:30', '08:20'), // faculty=3 creates TUESDAY slot; faculty=2/room=5/section=2 free then
    ];
    const { entries: result, impact } = repairHardConflicts(entries, new Set());
    assert(impact.attemptsTotal > 0, 'Repair attempted for room conflict');
    const e1 = result.find((e) => e.entryId === 'e1');
    const e2 = result.find((e) => e.entryId === 'e2');
    assert(!(e1.roomId === e2.roomId && e1.day === e2.day && e1.startTime === e2.startTime), 'Room-time conflict resolved: e1 and e2 no longer share room+slot');
}
section('H-ALG-3-04 repairHardConflicts never relocates locked entries');
{
    const entries = [
        makeEntry('entry-1', 1, 1, 1, 'MONDAY', '07:30', '08:20'), // locked
        makeEntry('entry-2', 1, 2, 2, 'MONDAY', '07:30', '08:20'), // same faculty+slot → conflict
        makeEntry('entry-3', 2, 3, 3, 'TUESDAY', '07:30', '08:20'), // free for relocation
    ];
    const lockedIds = new Set(['entry-1']);
    const { entries: result, impact } = repairHardConflicts(entries, lockedIds);
    const locked = result.find((e) => e.entryId === 'entry-1');
    assertEqual(locked.day, 'MONDAY', 'Locked entry day unchanged');
    assertEqual(locked.startTime, '07:30', 'Locked entry startTime unchanged');
    // entry-2 should be the one relocated (not entry-1)
    const e2 = result.find((e) => e.entryId === 'entry-2');
    assert(e2 !== undefined, 'Non-locked conflicting entry still in result');
}
section('H-ALG-3-05 repairHardConflicts no mutation of original array');
{
    const entries = [
        makeEntry('e1', 1, 1, 1, 'MONDAY', '07:30', '08:20'),
        makeEntry('e2', 1, 2, 2, 'MONDAY', '07:30', '08:20'), // conflict
        makeEntry('e3', 1, 3, 3, 'TUESDAY', '07:30', '08:20'),
    ];
    const originalSnapshot = entries.map((e) => ({ ...e }));
    repairHardConflicts(entries, new Set());
    assert(entries[0].day === originalSnapshot[0].day && entries[0].startTime === originalSnapshot[0].startTime, 'Original entries array not mutated (entry 0)');
}
// ─── H-ALG-1: Seed diversity / runHybridScheduler integration ───
section('H-ALG-1-01 runHybridScheduler produces valid HybridSchedulerResult shape');
{
    // Minimal valid input — should produce a result with no assignments (no faculty/rooms)
    const input = {
        schoolId: 1,
        schoolYearId: 1,
        sectionsByGrade: [makeGrade(7, [{ id: 1, name: '7-A', enrolledCount: 30 }])],
        subjects: [
            {
                id: 1,
                code: 'ENG',
                minMinutesPerWeek: 200,
                preferredRoomType: 'CLASSROOM',
                gradeLevels: [7],
            },
        ],
        faculty: [],
        facultySubjects: [],
        rooms: [],
        preferences: [],
    };
    const result = runHybridScheduler(input);
    assert(result.hybridEnabled, 'hybridEnabled = true when profiles succeed');
    assert(result.seedQuality.length === 6, `seedQuality has 6 entries (one per profile), got ${result.seedQuality.length}`);
    assert(result.repairImpact !== undefined, 'repairImpact is present');
    assert(result.selectedProfileId !== undefined, 'selectedProfileId is set');
    // With no faculty or rooms, all sessions are unassigned
    assert(result.unassignedCount > 0, 'Unassigned count > 0 when no faculty');
}
section('H-ALG-1-02 runHybridScheduler seedQuality profiles are deterministic');
{
    const input = {
        schoolId: 1,
        schoolYearId: 1,
        sectionsByGrade: [makeGrade(7, [{ id: 1, name: '7-A', enrolledCount: 25 }])],
        subjects: [
            { id: 1, code: 'MATH', minMinutesPerWeek: 150, preferredRoomType: 'CLASSROOM', gradeLevels: [7] },
            { id: 2, code: 'SCI', minMinutesPerWeek: 100, preferredRoomType: 'LABORATORY', gradeLevels: [7] },
        ],
        faculty: [],
        facultySubjects: [],
        rooms: [],
        preferences: [],
    };
    const r1 = runHybridScheduler(input);
    const r2 = runHybridScheduler(input);
    assertEqual(r1.seedQuality.length, r2.seedQuality.length, 'Same number of seed profiles on both runs');
    for (let i = 0; i < r1.seedQuality.length; i++) {
        assertEqual(r1.seedQuality[i].profileId, r2.seedQuality[i].profileId, `Profile[${i}] id is deterministic`);
        assertEqual(r1.seedQuality[i].assignedCount, r2.seedQuality[i].assignedCount, `Profile[${i}] assignedCount is deterministic`);
    }
    assertEqual(r1.selectedProfileId, r2.selectedProfileId, 'selectedProfileId is deterministic');
}
section('H-ALG-1-03 runHybridScheduler selects profile with fewest unassigned');
{
    // All profiles will produce same result with empty faculty, but structure should be correct
    const input = {
        schoolId: 1,
        schoolYearId: 1,
        sectionsByGrade: [
            makeGrade(7, [{ id: 1, name: '7-A', enrolledCount: 25 }]),
            makeGrade(8, [{ id: 2, name: '8-A', enrolledCount: 25 }]),
        ],
        subjects: [
            { id: 1, code: 'ENG', minMinutesPerWeek: 200, preferredRoomType: 'CLASSROOM', gradeLevels: [7, 8] },
        ],
        faculty: [],
        facultySubjects: [],
        rooms: [],
        preferences: [],
    };
    const result = runHybridScheduler(input);
    // The selected profile should have the minimum unassigned among all seeds
    const selectedSeed = result.seedQuality.find((s) => s.profileId === result.selectedProfileId);
    assert(selectedSeed !== undefined, 'selectedProfileId maps to a seedQuality entry');
    const minUnassigned = Math.min(...result.seedQuality.map((s) => s.unassignedCount));
    assertEqual(selectedSeed.unassignedCount, minUnassigned, 'Selected seed has minimum unassigned count');
}
// ─── Summary ───
console.log(`\n${'═'.repeat(50)}`);
console.log(`Results: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) {
    process.exitCode = 1;
}
