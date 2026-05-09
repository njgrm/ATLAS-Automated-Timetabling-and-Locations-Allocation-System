import http from 'node:http';

import app from '../app.js';
import { prisma } from '../lib/prisma.js';

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

async function requestJson(baseUrl: string, path: string, options?: RequestInit) {
	const response = await fetch(`${baseUrl}${path}`, options);
	let json: any = null;
	try {
		json = await response.json();
	} catch {
		json = null;
	}
	return { status: response.status, json };
}

function firstSectionIdFromSnapshot(payload: unknown): number | null {
	if (!Array.isArray(payload)) return null;
	for (const grade of payload as Array<{ sections?: Array<{ id: number }> }>) {
		const sectionId = grade.sections?.[0]?.id;
		if (typeof sectionId === 'number' && sectionId > 0) return sectionId;
	}
	return null;
}

async function run() {
	if (!process.env.JWT_SECRET) {
		process.env.JWT_SECRET = 'atlas-local-auth-test-secret';
	}

	const seededPassword = process.env.ATLAS_DEFAULT_AUTH_PASSWORD ?? 'Atlas2026!';
	const officer = await prisma.atlasAuthAccount.findFirst({ where: { role: { in: ['officer', 'admin', 'SYSTEM_ADMIN'] }, isActive: true }, orderBy: { id: 'asc' } });
	const facultyAccounts = await prisma.atlasAuthAccount.findMany({
		where: { role: 'faculty', isActive: true, facultyId: { not: null } },
		orderBy: { id: 'asc' },
		take: 2,
	});
	if (!officer || facultyAccounts.length < 2 || !facultyAccounts[0].facultyId || !facultyAccounts[1].facultyId) {
		console.error('\nMissing seeded officer/two faculty accounts for unified request tests.');
		process.exitCode = 1;
		return;
	}

	const schoolId = facultyAccounts[0].schoolId;
	const schoolYearId = 1;
	const subject = await prisma.subject.findFirst({ where: { schoolId, isActive: true }, orderBy: { id: 'asc' } });
	const rooms = await prisma.room.findMany({
		where: { isTeachingSpace: true, building: { schoolId, isTeachingBuilding: true } },
		orderBy: { id: 'asc' },
		take: 3,
	});
	const snapshot = await prisma.sectionSnapshot.findFirst({ where: { schoolId }, orderBy: { fetchedAt: 'desc' }, select: { payload: true } });
	const sectionId = firstSectionIdFromSnapshot(snapshot?.payload);
	if (!subject || rooms.length < 3 || !sectionId) {
		console.error('\nMissing seed data for unified request tests.');
		process.exitCode = 1;
		return;
	}

	const now = Date.now();
	const run = await prisma.generationRun.create({
		data: {
			schoolId,
			schoolYearId,
			status: 'COMPLETED',
			runType: 'FULL',
			triggeredBy: officer.id,
			startedAt: new Date(now - 90000),
			finishedAt: new Date(now - 89000),
			durationMs: 1000,
			summary: {},
			violations: { runId: 0, status: 'COMPLETED', violations: [], counts: { total: 0, byCode: {} } },
			draftEntries: [
				{
					entryId: `phase1-source-${Date.now()}`,
					subjectId: subject.id,
					sectionId,
					facultyId: facultyAccounts[0].facultyId,
					roomId: rooms[0].id,
					day: 'MONDAY',
					startTime: '08:00',
					endTime: '09:00',
					durationMinutes: 60,
				},
				{
					entryId: `phase1-target-${Date.now()}`,
					subjectId: subject.id,
					sectionId,
					facultyId: facultyAccounts[1].facultyId,
					roomId: rooms[1].id,
					day: 'MONDAY',
					startTime: '10:00',
					endTime: '11:00',
					durationMinutes: 60,
				},
			],
			unassignedItems: [],
		},
	});

	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
	const address = server.address();
	if (!address || typeof address === 'string') {
		console.error('Unable to resolve ephemeral test server port.');
		server.close();
		process.exitCode = 1;
		return;
	}
	const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

	try {
		const facultyLogin = await requestJson(baseUrl, '/auth/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: facultyAccounts[0].email, password: seededPassword }),
		});
		assertEqual(facultyLogin.status, 200, 'Faculty login returns HTTP 200');
		const token = facultyLogin.json?.token as string | undefined;
		assert(Boolean(token), 'Faculty token available');
		if (!token) return;

		const latestState = await requestJson(baseUrl, `/room-preferences/${schoolId}/${schoolYearId}/latest/faculty/${facultyAccounts[0].facultyId}`, {
			headers: { authorization: `Bearer ${token}` },
		});
		assertEqual(latestState.status, 200, 'Latest state endpoint returns HTTP 200');
		const sourceEntryId = latestState.json?.entries?.[0]?.entryId as string | undefined;
		assert(Boolean(sourceEntryId), 'Source entry available for request testing');
		if (!sourceEntryId) return;

		section('PH1-REQ-01 move-to-empty preview uses unified action payload');
		const movePreview = await requestJson(baseUrl, `/room-preferences/${schoolId}/${schoolYearId}/runs/${run.id}/faculty/${facultyAccounts[0].facultyId}/entries/${sourceEntryId}/preview`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({
				actionType: 'MOVE_TO_EMPTY_SLOT',
				targetDay: 'MONDAY',
				targetStartTime: '09:00',
				targetEndTime: '10:00',
				requestedRoomId: rooms[2].id,
				expectedRunVersion: run.version,
			}),
		});
		assertEqual(movePreview.status, 200, 'Move preview returns HTTP 200');
		assert(typeof movePreview.json?.preview?.allowed === 'boolean', 'Move preview returns conflict inspector payload');

		section('PH1-REQ-02 swap preview parity and reason-required validation path');
		const swapPreview = await requestJson(baseUrl, `/room-preferences/${schoolId}/${schoolYearId}/runs/${run.id}/faculty/${facultyAccounts[0].facultyId}/entries/${sourceEntryId}/preview`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({
				actionType: 'SWAP_WITH_OCCUPIED',
				targetDay: 'MONDAY',
				targetStartTime: '10:00',
				targetEndTime: '11:00',
				targetEntryId: (run.draftEntries as any[])[1].entryId,
				expectedRunVersion: run.version,
			}),
		});
		assertEqual(swapPreview.status, 200, 'Swap preview returns HTTP 200');
		assert(Array.isArray(swapPreview.json?.preview?.hardViolations), 'Swap preview includes hard conflict array');
		assert(Array.isArray(swapPreview.json?.preview?.softViolations), 'Swap preview includes soft conflict array');

		const swapSubmitNoReason = await requestJson(baseUrl, `/room-preferences/${schoolId}/${schoolYearId}/runs/${run.id}/faculty/${facultyAccounts[0].facultyId}/entries/${sourceEntryId}/submit`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({
				actionType: 'SWAP_WITH_OCCUPIED',
				targetDay: 'MONDAY',
				targetStartTime: '10:00',
				targetEndTime: '11:00',
				targetEntryId: (run.draftEntries as any[])[1].entryId,
				expectedRunVersion: run.version,
			}),
		});
		if ((swapPreview.json?.preview?.hardViolations?.length ?? 0) > 0) {
			assertEqual(swapSubmitNoReason.status, 422, 'Conflict-causing swap requires rationale');
			assertEqual(swapSubmitNoReason.json?.code, 'SWAP_REASON_REQUIRED', 'Swap reason-required code returned');
		} else {
			assert([200, 422].includes(swapSubmitNoReason.status), 'Swap submit response is deterministic when no hard conflicts are present');
		}

		section('PH1-REQ-03 room-only and combined requests submit successfully');
		const roomOnly = await requestJson(baseUrl, `/room-preferences/${schoolId}/${schoolYearId}/runs/${run.id}/faculty/${facultyAccounts[0].facultyId}/entries/${sourceEntryId}/submit`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({
				actionType: 'ROOM_CHANGE',
				requestedRoomId: rooms[2].id,
				rationale: 'Need science room equipment',
				expectedRunVersion: run.version,
			}),
		});
		assertEqual(roomOnly.status, 200, 'Room-only request submits successfully');

		const combined = await requestJson(baseUrl, `/room-preferences/${schoolId}/${schoolYearId}/runs/${run.id}/faculty/${facultyAccounts[0].facultyId}/entries/${sourceEntryId}/draft`, {
			method: 'PUT',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({
				actionType: 'TIME_AND_ROOM_CHANGE',
				targetDay: 'MONDAY',
				targetStartTime: '09:00',
				targetEndTime: '10:00',
				requestedRoomId: rooms[2].id,
				rationale: 'Combined test payload',
				expectedRunVersion: run.version,
			}),
		});
		assertEqual(combined.status, 200, 'Combined draft request saves successfully');

		const latestAfter = await requestJson(baseUrl, `/room-preferences/${schoolId}/${schoolYearId}/latest/faculty/${facultyAccounts[0].facultyId}`, {
			headers: { authorization: `Bearer ${token}` },
		});
		assertEqual(latestAfter.status, 200, 'Latest endpoint remains accessible after unified requests');
		assert(Array.isArray(latestAfter.json?.globalEntries), 'Global draft sessions are returned for read-only inspection');
	} finally {
		await prisma.facultyRoomPreference.deleteMany({ where: { runId: run.id } }).catch(() => {});
		await prisma.generationRun.delete({ where: { id: run.id } }).catch(() => {});
		await new Promise<void>((resolve, reject) => {
			server.close((err) => {
				if (err) {
					reject(err);
					return;
				}
				resolve();
			});
		});
	}

	console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
	if (failCount > 0) process.exitCode = 1;
}

run().catch((error) => {
	console.error('\nUnhandled phase1 unified request test error:', error);
	process.exit(1);
});
