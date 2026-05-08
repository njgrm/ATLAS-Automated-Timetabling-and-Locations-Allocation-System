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
		if (typeof sectionId === 'number' && sectionId > 0) {
			return sectionId;
		}
	}
	return null;
}

async function run() {
	if (!process.env.JWT_SECRET) {
		process.env.JWT_SECRET = 'atlas-local-auth-test-secret';
	}

	const seededPassword = process.env.ATLAS_DEFAULT_AUTH_PASSWORD ?? 'Atlas2026!';
	const facultyAccount = await prisma.atlasAuthAccount.findFirst({
		where: { role: 'faculty', isActive: true, facultyId: { not: null } },
		orderBy: { id: 'asc' },
	});
	if (!facultyAccount?.facultyId) {
		console.error('\nNo seeded faculty account linked to faculty_mirror found. Run realistic seed first.');
		process.exitCode = 1;
		return;
	}

	const schoolId = facultyAccount.schoolId;
	const schoolYearId = 1;
	const subject = await prisma.subject.findFirst({ where: { schoolId, isActive: true }, orderBy: { id: 'asc' } });
	const room = await prisma.room.findFirst({
		where: {
			isTeachingSpace: true,
			building: { schoolId, isTeachingBuilding: true },
		},
		orderBy: { id: 'asc' },
	});
	const snapshot = await prisma.sectionSnapshot.findFirst({
		where: { schoolId },
		orderBy: { fetchedAt: 'desc' },
		select: { payload: true },
	});
	const sectionId = firstSectionIdFromSnapshot(snapshot?.payload);

	if (!subject || !room || !sectionId) {
		console.error('\nMissing subject/room/section snapshot data for draft contract test.');
		process.exitCode = 1;
		return;
	}

	const runIds: number[] = [];
	const now = Date.now();
	const sharedEntryId = `faculty-draft-${Date.now()}`;

	const oldRun = await prisma.generationRun.create({
		data: {
			schoolId,
			schoolYearId,
			status: 'COMPLETED',
			runType: 'FULL',
			triggeredBy: facultyAccount.id,
			startedAt: new Date(now - 120000),
			finishedAt: new Date(now - 119000),
			durationMs: 1000,
			summary: {},
			violations: { runId: 0, status: 'COMPLETED', violations: [], counts: { total: 0, byCode: {} } },
			draftEntries: [],
			unassignedItems: [],
		},
	});
	runIds.push(oldRun.id);

	const latestRun = await prisma.generationRun.create({
		data: {
			schoolId,
			schoolYearId,
			status: 'COMPLETED',
			runType: 'FULL',
			triggeredBy: facultyAccount.id,
			startedAt: new Date(now - 60000),
			finishedAt: new Date(now - 58000),
			durationMs: 1000,
			summary: {},
			violations: { runId: 0, status: 'COMPLETED', violations: [], counts: { total: 0, byCode: {} } },
			draftEntries: [
				{
					entryId: sharedEntryId,
					subjectId: subject.id,
					sectionId,
					facultyId: facultyAccount.facultyId,
					roomId: room.id,
					day: 'MONDAY',
					startTime: '08:00',
					endTime: '09:00',
					durationMinutes: 60,
					entryKind: 'SECTION',
				},
			],
			unassignedItems: [],
		},
	});
	runIds.push(latestRun.id);

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
		const login = await requestJson(baseUrl, '/auth/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: facultyAccount.email, password: seededPassword }),
		});
		assertEqual(login.status, 200, 'Faculty login returns HTTP 200');
		const token = login.json?.token as string | undefined;
		assert(Boolean(token), 'Faculty login token exists');
		if (!token) return;

		section('FAC-DRAFT-01 dashboard uses latest draft run and shows assigned session counts');
		const dashboard = await requestJson(baseUrl, `/faculty-portal/${schoolId}/${schoolYearId}/dashboard`, {
			headers: { authorization: `Bearer ${token}` },
		});
		assertEqual(dashboard.status, 200, 'Faculty dashboard endpoint returns HTTP 200');
		assertEqual(dashboard.json?.runContext?.runId, latestRun.id, 'Dashboard runContext resolves to latest draft run');
		assertEqual(dashboard.json?.schedulePreview?.runId, latestRun.id, 'Dashboard schedule preview runId uses latest draft run');
		assert((dashboard.json?.schedulePreview?.counts?.total ?? 0) > 0, 'Dashboard scheduled classes count is non-zero for assigned draft entry');

		section('FAC-DRAFT-02 room preferences latest contract resolves same draft run');
		const roomState = await requestJson(baseUrl, `/room-preferences/${schoolId}/${schoolYearId}/latest/faculty/${facultyAccount.facultyId}`, {
			headers: { authorization: `Bearer ${token}` },
		});
		assertEqual(roomState.status, 200, 'Room preferences latest endpoint returns HTTP 200');
		assertEqual(roomState.json?.runId, latestRun.id, 'Room preferences state resolves to latest draft run');
		assert((roomState.json?.entries?.length ?? 0) > 0, 'Room preferences state returns assigned entries for faculty');
		assertEqual(roomState.json?.entries?.[0]?.entryId, sharedEntryId, 'Room preferences entry comes from latest draft run payload');
	} finally {
		await new Promise<void>((resolve, reject) => {
			server.close((err) => {
				if (err) {
					reject(err);
					return;
				}
				resolve();
			});
		});
		if (runIds.length > 0) {
			await prisma.generationRun.deleteMany({ where: { id: { in: runIds } } }).catch(() => {});
		}
		await prisma.$disconnect();
	}

	console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
	if (failCount > 0) process.exitCode = 1;
}

run().catch((error) => {
	console.error('\nUnhandled faculty draft run contract test error:', error);
	process.exit(1);
});
