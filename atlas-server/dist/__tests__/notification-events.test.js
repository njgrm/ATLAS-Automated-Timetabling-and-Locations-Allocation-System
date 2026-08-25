import { disposeNotificationEventBridges, getNotificationEventsSince, initializeNotificationEventBridges, publishNotificationEvent, subscribeNotificationEvents, } from '../services/notification-events.service.js';
import { publishPublishedScheduleEvent } from '../services/published-schedule-events.service.js';
let passCount = 0;
let failCount = 0;
function section(name) {
    console.log(`\n═══ ${name} ═══`);
}
function assert(condition, label) {
    if (condition) {
        passCount += 1;
        console.log(`  ✓ ${label}`);
        return;
    }
    failCount += 1;
    console.error(`  ✗ ${label}`);
}
function assertEqual(actual, expected, label) {
    assert(actual === expected, `${label} — expected ${String(expected)}, got ${String(actual)}`);
}
function run() {
    section('Unified notification event service');
    disposeNotificationEventBridges();
    initializeNotificationEventBridges();
    const schoolId = 1;
    const schoolYearId = 55;
    let officerEvents = [];
    let faculty101Events = [];
    let faculty202Events = [];
    const stopOfficer = subscribeNotificationEvents({
        schoolId,
        schoolYearId,
        facultyId: null,
        send: (event) => { officerEvents.push(event); },
    });
    const stopFaculty101 = subscribeNotificationEvents({
        schoolId,
        schoolYearId,
        facultyId: 101,
        send: (event) => { faculty101Events.push(event); },
    });
    const stopFaculty202 = subscribeNotificationEvents({
        schoolId,
        schoolYearId,
        facultyId: 202,
        send: (event) => { faculty202Events.push(event); },
    });
    const privileged = publishNotificationEvent({
        type: 'GENERATION_RUN_COMPLETED',
        domain: 'generation',
        severity: 'success',
        audience: 'PRIVILEGED',
        schoolId,
        schoolYearId,
        facultyId: null,
        message: 'Generation complete.',
    });
    assertEqual(officerEvents.at(-1)?.type, 'GENERATION_RUN_COMPLETED', 'Officer receives privileged generation notification');
    assert(!faculty101Events.some((event) => event.id === privileged.id), 'Faculty does not receive privileged generation notification');
    publishNotificationEvent({
        type: 'ROOM_REQUEST_REVIEWED',
        domain: 'room-request',
        severity: 'success',
        audience: 'FACULTY',
        schoolId,
        schoolYearId,
        facultyId: 101,
        message: 'Room request reviewed.',
    });
    assertEqual(faculty101Events.at(-1)?.type, 'ROOM_REQUEST_REVIEWED', 'Affected faculty receives faculty-scoped notification');
    assert(!faculty202Events.some((event) => event.type === 'ROOM_REQUEST_REVIEWED'), 'Unaffected faculty does not receive faculty-scoped notification');
    publishPublishedScheduleEvent({
        type: 'SCHEDULE_PUBLISHED',
        schoolId,
        schoolYearId,
        message: 'Published schedule is ready.',
    });
    assertEqual(officerEvents.at(-1)?.type, 'SCHEDULE_PUBLISHED', 'Officer receives bridged published schedule notification');
    assertEqual(faculty101Events.at(-1)?.type, 'SCHEDULE_PUBLISHED', 'Faculty receives global published schedule notification');
    assertEqual(faculty202Events.at(-1)?.type, 'SCHEDULE_PUBLISHED', 'Other faculty receives global published schedule notification');
    publishPublishedScheduleEvent({
        type: 'SCHEDULE_REVISED',
        schoolId,
        schoolYearId,
        message: 'Published schedule was revised.',
        metadata: { affectedFacultyIds: [101] },
    });
    assertEqual(faculty101Events.at(-1)?.type, 'SCHEDULE_REVISED', 'Affected faculty receives bridged revision notification');
    assertEqual(faculty202Events.at(-1)?.type, 'SCHEDULE_PUBLISHED', 'Unaffected faculty does not receive bridged revision notification');
    const missed = getNotificationEventsSince(privileged.id, { schoolId, schoolYearId, facultyId: 101 });
    assert(missed.some((event) => event.type === 'SCHEDULE_REVISED'), 'Replay includes missed faculty revision');
    assert(!missed.some((event) => event.type === 'GENERATION_RUN_COMPLETED'), 'Replay excludes privileged notification for faculty');
    stopOfficer();
    stopFaculty101();
    stopFaculty202();
    disposeNotificationEventBridges();
    // ─── Term metadata tests ───
    section('Notification term metadata');
    disposeNotificationEventBridges();
    initializeNotificationEventBridges();
    let termEvents = [];
    const stopTerm = subscribeNotificationEvents({
        schoolId,
        schoolYearId,
        facultyId: null,
        send: (event) => { termEvents.push(event); },
    });
    // Test GENERATION_RUN_COMPLETED with termCounts
    publishNotificationEvent({
        type: 'GENERATION_RUN_COMPLETED',
        domain: 'generation',
        severity: 'success',
        audience: 'PRIVILEGED',
        schoolId,
        schoolYearId,
        facultyId: null,
        message: 'Generation complete with term data.',
        metadata: {
            runId: 100,
            termCounts: { term1: 50, term2: 30, term3: 25 },
        },
    });
    const genEvent = termEvents.at(-1);
    assertEqual(genEvent?.type, 'GENERATION_RUN_COMPLETED', 'Generation event received');
    assertEqual(genEvent?.metadata?.termCounts?.term1, 50, 'Generation metadata has termCounts.term1');
    assertEqual(genEvent?.metadata?.termCounts?.term2, 30, 'Generation metadata has termCounts.term2');
    assertEqual(genEvent?.metadata?.termCounts?.term3, 25, 'Generation metadata has termCounts.term3');
    // Test SCHEDULE_PUBLISHED with termCounts
    publishPublishedScheduleEvent({
        type: 'SCHEDULE_PUBLISHED',
        schoolId,
        schoolYearId,
        message: 'Published with term data.',
        metadata: {
            runId: 100,
            termCounts: { term1: 50, term2: 30, term3: 25 },
        },
    });
    const pubEvent = termEvents.at(-1);
    assertEqual(pubEvent?.type, 'SCHEDULE_PUBLISHED', 'Publish event received');
    assertEqual(pubEvent?.metadata?.termCounts?.term1, 50, 'Publish metadata has termCounts.term1');
    // Test SCHEDULE_REVISED with affectedTermIndices
    publishPublishedScheduleEvent({
        type: 'SCHEDULE_REVISED',
        schoolId,
        schoolYearId,
        message: 'Revised with term data.',
        metadata: {
            revisionId: 1,
            affectedTermIndices: [1, 2],
        },
    });
    const revEvent = termEvents.at(-1);
    assertEqual(revEvent?.type, 'SCHEDULE_REVISED', 'Revision event received');
    assertEqual(Array.isArray(revEvent?.metadata?.affectedTermIndices), true, 'Revision metadata has affectedTermIndices array');
    assertEqual(revEvent?.metadata?.affectedTermIndices?.includes(1), true, 'Revision metadata includes term 1');
    assertEqual(revEvent?.metadata?.affectedTermIndices?.includes(2), true, 'Revision metadata includes term 2');
    // Test TIMETABLE_EDIT_COMMITTED with termIndex (single edit)
    publishNotificationEvent({
        type: 'TIMETABLE_EDIT_COMMITTED',
        domain: 'timetable',
        severity: 'success',
        audience: 'PRIVILEGED',
        schoolId,
        schoolYearId,
        facultyId: null,
        message: 'Single edit with term.',
        metadata: {
            editId: 1,
            editType: 'MOVE_ENTRY',
            termIndex: 1,
        },
    });
    const editEvent = termEvents.at(-1);
    assertEqual(editEvent?.type, 'TIMETABLE_EDIT_COMMITTED', 'Single edit event received');
    assertEqual(editEvent?.metadata?.termIndex, 1, 'Single edit metadata has termIndex=1');
    // Test TIMETABLE_EDIT_COMMITTED with affectedTermIndices (batch edit)
    publishNotificationEvent({
        type: 'TIMETABLE_EDIT_COMMITTED',
        domain: 'timetable',
        severity: 'success',
        audience: 'PRIVILEGED',
        schoolId,
        schoolYearId,
        facultyId: null,
        message: 'Batch edit with terms.',
        metadata: {
            editIds: [1, 2, 3],
            batchSize: 3,
            affectedTermIndices: [1, 3],
        },
    });
    const batchEvent = termEvents.at(-1);
    assertEqual(batchEvent?.type, 'TIMETABLE_EDIT_COMMITTED', 'Batch edit event received');
    assertEqual(Array.isArray(batchEvent?.metadata?.affectedTermIndices), true, 'Batch edit metadata has affectedTermIndices array');
    assertEqual(batchEvent?.metadata?.affectedTermIndices?.includes(1), true, 'Batch edit metadata includes term 1');
    assertEqual(batchEvent?.metadata?.affectedTermIndices?.includes(3), true, 'Batch edit metadata includes term 3');
    // Test TIMETABLE_REVERTED with termIndex
    publishNotificationEvent({
        type: 'TIMETABLE_REVERTED',
        domain: 'timetable',
        severity: 'warning',
        audience: 'PRIVILEGED',
        schoolId,
        schoolYearId,
        facultyId: null,
        message: 'Reverted edit with term.',
        metadata: {
            revertedEditId: 1,
            newEditId: 2,
            termIndex: 2,
        },
    });
    const revertEvent = termEvents.at(-1);
    assertEqual(revertEvent?.type, 'TIMETABLE_REVERTED', 'Revert event received');
    assertEqual(revertEvent?.metadata?.termIndex, 2, 'Revert metadata has termIndex=2');
    // Test backward compatibility: event without term metadata
    publishNotificationEvent({
        type: 'TIMETABLE_EDIT_COMMITTED',
        domain: 'timetable',
        severity: 'success',
        audience: 'PRIVILEGED',
        schoolId,
        schoolYearId,
        facultyId: null,
        message: 'Edit without term metadata.',
        metadata: {
            editId: 99,
            editType: 'PLACE_UNASSIGNED',
        },
    });
    const noTermEvent = termEvents.at(-1);
    assertEqual(noTermEvent?.type, 'TIMETABLE_EDIT_COMMITTED', 'No-term edit event received');
    assertEqual(noTermEvent?.metadata?.termIndex, undefined, 'No-term edit metadata has termIndex=undefined');
    assertEqual(noTermEvent?.metadata?.affectedTermIndices, undefined, 'No-term edit metadata has affectedTermIndices=undefined');
    stopTerm();
    disposeNotificationEventBridges();
    console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
    if (failCount > 0)
        process.exitCode = 1;
}
run();
//# sourceMappingURL=notification-events.test.js.map