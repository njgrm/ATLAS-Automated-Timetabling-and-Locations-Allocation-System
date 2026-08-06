import { validateHardConstraints } from '../services/constraint-validator.js';
let passCount = 0;
let failCount = 0;
function assert(condition, label) {
    if (condition) {
        passCount += 1;
        console.log(`  OK ${label}`);
        return;
    }
    failCount += 1;
    console.error(`  FAIL ${label}`);
}
function run() {
    console.log('\n=== PHASE3-ROOM-MISMATCH-SEMANTICS ===');
    const ctx = {
        schoolId: 1,
        schoolYearId: 55,
        runId: 9001,
        entries: [
            {
                entryId: 'entry-1',
                facultyId: 1001,
                roomId: 2001,
                subjectId: 3001,
                sectionId: 4001,
                day: 'MONDAY',
                startTime: '07:30',
                endTime: '08:15',
                durationMinutes: 45,
                metadata: {
                    roomAssignmentReason: 'MODULAR_POOL_ASSIGNED',
                },
            },
        ],
        faculty: [{ id: 1001, maxHoursPerWeek: 30 }],
        facultySubjects: [{ facultyId: 1001, subjectId: 3001, sectionIds: [4001] }],
        rooms: [{ id: 2001, type: 'CLASSROOM', capacity: 50 }],
        subjects: [{ id: 3001, preferredRoomType: 'LABORATORY' }],
    };
    const result = validateHardConstraints(ctx);
    const mismatch = result.violations.find((violation) => violation.code === 'ROOM_TYPE_MISMATCH');
    assert(Boolean(mismatch), 'room type mismatch is emitted for modular pool entries');
    assert(mismatch?.severity === 'SOFT', 'modular pool room type mismatch is downgraded to SOFT');
    assert(mismatch?.meta?.deferredByModularPool === true, 'modular pool mismatch includes explicit deferredByModularPool metadata');
    console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
    if (failCount > 0) {
        process.exitCode = 1;
    }
}
run();
