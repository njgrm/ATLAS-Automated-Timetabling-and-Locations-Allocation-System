import {
	disposeNotificationEventBridges,
	getNotificationEventsSince,
	initializeNotificationEventBridges,
	publishNotificationEvent,
	subscribeNotificationEvents,
	type NotificationEvent,
} from '../services/notification-events.service.js';
import { publishPublishedScheduleEvent } from '../services/published-schedule-events.service.js';

let passCount = 0;
let failCount = 0;

function section(name: string) {
	console.log(`\n═══ ${name} ═══`);
}

function assert(condition: boolean, label: string) {
	if (condition) {
		passCount += 1;
		console.log(`  ✓ ${label}`);
		return;
	}
	failCount += 1;
	console.error(`  ✗ ${label}`);
}

function assertEqual<T>(actual: T, expected: T, label: string) {
	assert(actual === expected, `${label} — expected ${String(expected)}, got ${String(actual)}`);
}

function run() {
	section('Unified notification event service');
	disposeNotificationEventBridges();
	initializeNotificationEventBridges();

	const schoolId = 1;
	const schoolYearId = 55;
	let officerEvents: NotificationEvent[] = [];
	let faculty101Events: NotificationEvent[] = [];
	let faculty202Events: NotificationEvent[] = [];

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

	console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
	if (failCount > 0) process.exitCode = 1;
}

run();
