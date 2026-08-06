import { publishPublishedScheduleEvent, subscribePublishedScheduleEvents, getPublishedScheduleEventsSince, } from '../services/published-schedule-events.service.js';
let passCount = 0;
let failCount = 0;
function section(name) {
    console.log(`\n═══ ${name} ═══`);
}
function assert(condition, label) {
    if (condition) {
        passCount += 1;
        console.log(`  ✓ ${label}`);
    }
    else {
        failCount += 1;
        console.error(`  ✗ ${label}`);
    }
}
function assertEqual(actual, expected, label) {
    if (actual === expected) {
        passCount += 1;
        console.log(`  ✓ ${label}`);
    }
    else {
        failCount += 1;
        console.error(`  ✗ ${label} — expected ${String(expected)}, got ${String(actual)}`);
    }
}
function run() {
    section('Published Schedule SSE Service Tests');
    const schoolId = 1;
    const schoolYearId = 55;
    // Test 1: general broadcast gets received by all subscribers
    let receivedAdminEvent = null;
    let receivedFacultyEvent = null;
    const unsubAdmin = subscribePublishedScheduleEvents({
        schoolId,
        schoolYearId,
        facultyId: null, // Admin/Officer
        send: (event) => {
            receivedAdminEvent = event;
        },
    });
    const unsubFaculty = subscribePublishedScheduleEvents({
        schoolId,
        schoolYearId,
        facultyId: 101, // Faculty member
        send: (event) => {
            receivedFacultyEvent = event;
        },
    });
    const pubEvent = publishPublishedScheduleEvent({
        type: 'SCHEDULE_PUBLISHED',
        schoolId,
        schoolYearId,
        message: 'General published broadcast',
    });
    assertEqual(receivedAdminEvent?.message, 'General published broadcast', 'Admin receives general publish broadcast event');
    assertEqual(receivedFacultyEvent?.message, 'General published broadcast', 'Faculty receives general publish broadcast event');
    // Test 2: revision event filters correctly (affected vs unaffected faculty)
    receivedAdminEvent = null;
    receivedFacultyEvent = null;
    let receivedOtherFacultyEvent = null;
    const unsubOtherFaculty = subscribePublishedScheduleEvents({
        schoolId,
        schoolYearId,
        facultyId: 202, // Unaffected faculty member
        send: (event) => {
            receivedOtherFacultyEvent = event;
        },
    });
    publishPublishedScheduleEvent({
        type: 'SCHEDULE_REVISED',
        schoolId,
        schoolYearId,
        message: 'Schedule revised for faculty 101',
        metadata: {
            affectedFacultyIds: [101],
        },
    });
    assertEqual(receivedAdminEvent?.message, 'Schedule revised for faculty 101', 'Admin receives revision event');
    assertEqual(receivedFacultyEvent?.message, 'Schedule revised for faculty 101', 'Affected faculty receives revision event');
    assert(receivedOtherFacultyEvent === null, 'Unaffected faculty does not receive revision event');
    // Test 3: get missed events since last ID
    const missedEvents = getPublishedScheduleEventsSince(pubEvent.id, {
        schoolId,
        schoolYearId,
        facultyId: 101,
    });
    assertEqual(missedEvents.length, 1, 'Correctly retrieves 1 missed event since last ID');
    assertEqual(missedEvents[0].message, 'Schedule revised for faculty 101', 'Retrieved missed event matches expected message');
    // Clean up
    unsubAdmin();
    unsubFaculty();
    unsubOtherFaculty();
    console.log(`\n─── Results: ${passCount} passed, ${failCount} failed ───`);
    if (failCount > 0)
        process.exitCode = 1;
}
run();
