import http from 'node:http';

import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import {
	getPublishedFacultySchedule,
	getPublishedRoomSchedule,
	getPublishedSchedulePayload,
} from '../services/published-schedule.service.js';

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
	if (actual === expected) {
		passCount += 1;
		console.log(`  ✓ ${label}`);
		return;
	}
	failCount += 1;
	console.error(`  ✗ ${label} — expected ${String(expected)}, got ${String(actual)}`);
}

function isoDate(value: Date): string {
	return value.toISOString().slice(0, 10);
}

function daysFromToday(days: number): Date {
	const now = new Date();
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days, 0, 0, 0));
}

type JsonResponse = {
	status: number;
	json: any;
};

async function requestJson(baseUrl: string, path: string): Promise<JsonResponse> {
	const response = await fetch(`${baseUrl}${path}`);
	let json: any = null;
	try {
		json = await response.json();
	} catch {
		json = null;
	}
	return { status: response.status, json };
}

async function run() {
	const actorId = 929292;
	const schoolYearId = 606002;
	const effectiveDate = daysFromToday(-1);
	const historicalDate = isoDate(daysFromToday(-2));
	const currentDate = isoDate(daysFromToday(0));
	const testSchool = await prisma.school.create({
		data: {
			name: `Published Effective Date ${Date.now()}`,
			shortName: 'PED',
		},
	});

	const sourceRun = await prisma.generationRun.create({
		data: {
			schoolId: testSchool.id,
			schoolYearId,
			status: 'COMPLETED',
			runType: 'FULL',
			triggeredBy: actorId,
			startedAt: daysFromToday(-4),
			finishedAt: daysFromToday(-4),
			durationMs: 60000,
			summary: {
				isPublished: true,
				publishedAt: daysFromToday(-3).toISOString(),
				publishedBy: actorId,
				hardViolationCount: 0,
			},
			violations: [],
			draftEntries: [
				{
					entryId: 'effective-date-entry-1',
					subjectId: 101,
					sectionId: 202,
					facultyId: 303,
					roomId: 404,
					day: 'MONDAY',
					startTime: '07:30',
					endTime: '08:15',
					durationMinutes: 45,
				},
			],
			unassignedItems: [],
		},
	});

	const revisionChange = {
		entryId: 'effective-date-entry-1',
		changeType: 'PUBLISHED_REPAIR',
		previous: {
			facultyId: 303,
			roomId: 404,
			day: 'MONDAY',
			startTime: '07:30',
			endTime: '08:15',
		},
		next: {
			facultyId: 505,
			roomId: 606,
			day: 'TUESDAY',
			startTime: '09:00',
			endTime: '09:45',
			durationMinutes: 45,
		},
	};

	const revision = await prisma.publishedScheduleRevision.create({
		data: {
			schoolId: testSchool.id,
			schoolYearId,
			sourceRunId: sourceRun.id,
			status: 'SCHEDULED',
			effectiveDate,
			actorId,
			reason: 'Read-resolution test revision.',
			changeSet: [revisionChange],
			changeSummary: { changeCount: 1, entryIds: ['effective-date-entry-1'] },
			previousValues: [{ entryId: revisionChange.entryId, values: revisionChange.previous }],
			newValues: [{ entryId: revisionChange.entryId, values: revisionChange.next }],
			metadata: { sourceRunVersion: sourceRun.version },
		},
	});

	const server = http.createServer(app);
	await new Promise<void>((resolve) => {
		server.listen(0, '127.0.0.1', () => resolve());
	});
	const address = server.address();
	if (!address || typeof address === 'string') {
		console.error('Unable to resolve ephemeral test server port.');
		server.close();
		process.exitCode = 1;
		return;
	}

	const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

	try {
		section('PUB-READ-01 service resolves old, effective, and current truth');
		const oldPayload = await getPublishedSchedulePayload(testSchool.id, schoolYearId, { requestedDate: historicalDate });
		const oldEntry = oldPayload.entries[0];
		assertEqual(oldEntry.faculty.id, 303, 'Old date keeps original teacher');
		assertEqual(oldEntry.room.id, 404, 'Old date keeps original room');
		assertEqual(oldEntry.day, 'MONDAY', 'Old date keeps original day');
		assertEqual(oldEntry.startTime, '07:30', 'Old date keeps original start time');
		assertEqual(oldPayload.source.activeRevisionId, null, 'Old date has no active revision marker');

		const effectivePayload = await getPublishedSchedulePayload(testSchool.id, schoolYearId, { requestedDate: isoDate(effectiveDate) });
		const effectiveEntry = effectivePayload.entries[0];
		assertEqual(effectiveEntry.faculty.id, 505, 'Effective date applies revised teacher');
		assertEqual(effectiveEntry.room.id, 606, 'Effective date applies revised room');
		assertEqual(effectiveEntry.day, 'TUESDAY', 'Effective date applies revised day');
		assertEqual(effectiveEntry.startTime, '09:00', 'Effective date applies revised start time');
		assertEqual(effectivePayload.source.activeRevisionId, revision.id, 'Effective date exposes active revision ID');

		const currentPayload = await getPublishedSchedulePayload(testSchool.id, schoolYearId);
		assertEqual(currentPayload.entries[0].faculty.id, 505, 'No-date default returns current active revised teacher');
		assertEqual(currentPayload.source.activeRevisionId, revision.id, 'No-date default includes active revision marker');
		assert(currentPayload.source.revisionMarker.includes(`revision=${revision.id}`), 'No-date default source includes revision cache marker');

		section('PUB-READ-02 service entity filters resolve against the selected date');
		const oldFaculty = await getPublishedFacultySchedule(testSchool.id, 303, schoolYearId, { requestedDate: historicalDate });
		const currentOldFaculty = await getPublishedFacultySchedule(testSchool.id, 303, schoolYearId, { requestedDate: currentDate });
		const currentNewFaculty = await getPublishedFacultySchedule(testSchool.id, 505, schoolYearId, { requestedDate: currentDate });
		const oldRoom = await getPublishedRoomSchedule(testSchool.id, 404, schoolYearId, { requestedDate: historicalDate });
		const currentNewRoom = await getPublishedRoomSchedule(testSchool.id, 606, schoolYearId, { requestedDate: currentDate });

		assertEqual(oldFaculty.entries.length, 1, 'Old faculty view includes original teacher before effective date');
		assertEqual(currentOldFaculty.entries.length, 0, 'Current faculty view excludes original teacher after effective date');
		assertEqual(currentNewFaculty.entries.length, 1, 'Current faculty view includes revised teacher after effective date');
		assertEqual(oldRoom.entries.length, 1, 'Old room view includes original room before effective date');
		assertEqual(currentNewRoom.entries.length, 1, 'Current room view includes revised room after effective date');

		section('PUB-READ-03 public API accepts date query and rejects invalid dates');
		const oldApi = await requestJson(baseUrl, `/schools/${testSchool.id}/schedules/published/${schoolYearId}?date=${historicalDate}`);
		assertEqual(oldApi.status, 200, 'Old-date API read returns HTTP 200');
		assertEqual(oldApi.json?.entries?.[0]?.faculty?.id, 303, 'Old-date API read returns original teacher');

		const effectiveApi = await requestJson(baseUrl, `/schools/${testSchool.id}/schedules/published/${schoolYearId}?date=${isoDate(effectiveDate)}`);
		assertEqual(effectiveApi.status, 200, 'Effective-date API read returns HTTP 200');
		assertEqual(effectiveApi.json?.entries?.[0]?.faculty?.id, 505, 'Effective-date API read returns revised teacher');
		assertEqual(effectiveApi.json?.source?.activeRevisionId, revision.id, 'Effective-date API exposes active revision ID');

		const facultyApi = await requestJson(baseUrl, `/schools/${testSchool.id}/schedules/published/${schoolYearId}/faculty/505?date=${currentDate}`);
		assertEqual(facultyApi.status, 200, 'Faculty API date-aware read returns HTTP 200');
		assertEqual(facultyApi.json?.entries?.length, 1, 'Faculty API date-aware read filters after applying revision');

		const invalidDateApi = await requestJson(baseUrl, `/schools/${testSchool.id}/schedules/published/${schoolYearId}?date=not-a-date`);
		assertEqual(invalidDateApi.status, 400, 'Invalid date API read returns HTTP 400');
		assertEqual(invalidDateApi.json?.code, 'PUBLISHED_SCHEDULE_DATE_INVALID', 'Invalid date API read returns machine-readable code');
	} finally {
		await new Promise<void>((resolve, reject) => {
			server.close((error) => {
				if (error) reject(error);
				else resolve();
			});
		});

		await prisma.publishedScheduleRevision.deleteMany({ where: { schoolId: testSchool.id } });
		await prisma.generationRun.deleteMany({ where: { schoolId: testSchool.id } });
		await prisma.schedulingPolicy.deleteMany({ where: { schoolId: testSchool.id } });
		await prisma.school.delete({ where: { id: testSchool.id } });
		await prisma.$disconnect();
	}

	console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
	if (failCount > 0) process.exitCode = 1;
}

run().catch((error) => {
	console.error('\nUnhandled published schedule effective-date test error:', error);
	process.exit(1);
});