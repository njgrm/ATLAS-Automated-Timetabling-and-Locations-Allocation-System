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
	const faculty = await prisma.atlasAuthAccount.findFirst({ where: { role: 'faculty', isActive: true, facultyId: { not: null } }, orderBy: { id: 'asc' } });
	if (!officer || !faculty?.facultyId) {
		console.error('\nMissing seeded officer/faculty accounts for sync test.');
		process.exitCode = 1;
		return;
	}

	const schoolId = faculty.schoolId;
	const schoolYearId = 1;
	const subject = await prisma.subject.findFirst({ where: { schoolId, isActive: true }, orderBy: { id: 'asc' } });
	const rooms = await prisma.room.findMany({
		where: { isTeachingSpace: true, building: { schoolId, isTeachingBuilding: true } },
		orderBy: { id: 'asc' },
		take: 2,
	});
	const snapshot = await prisma.sectionSnapshot.findFirst({ where: { schoolId }, orderBy: { fetchedAt: 'desc' }, select: { payload: true } });
	const sectionId = firstSectionIdFromSnapshot(snapshot?.payload);
	if (!subject || rooms.length < 2 || !sectionId) {
		console.error('\nMissing seed data for sync test.');
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
			startedAt: new Date(now - 50000),
			finishedAt: new Date(now - 49000),
			durationMs: 1000,
			summary: {},
			violations: { runId: 0, status: 'COMPLETED', violations: [], counts: { total: 0, byCode: {} } },
			draftEntries: [
				{
					entryId: `phase1-sync-${Date.now()}`,
					subjectId: subject.id,
					sectionId,
					facultyId: faculty.facultyId,
					roomId: rooms[0].id,
					day: 'MONDAY',
					startTime: '08:00',
					endTime: '09:00',
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
		const login = await requestJson(baseUrl, '/auth/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: faculty.email, password: seededPassword }),
		});
		assertEqual(login.status, 200, 'Faculty login returns HTTP 200');
		const token = login.json?.token as string | undefined;
		assert(Boolean(token), 'Faculty token available');
		if (!token) return;

		section('PH1-SYNC-01 autosync accepts unified action payload types');
		const sync = await requestJson(baseUrl, `/room-preferences/${schoolId}/${schoolYearId}/runs/${run.id}/faculty/${faculty.facultyId}/sync`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({
				actions: [
					{
						actionId: 'phase1-sync-room',
						type: 'SAVE_DRAFT',
						entryId: (run.draftEntries as any[])[0].entryId,
						actionType: 'ROOM_CHANGE',
						requestedRoomId: rooms[1].id,
						expectedRunVersion: run.version,
					},
					{
						actionId: 'phase1-sync-invalid',
						type: 'SUBMIT',
						entryId: 'missing-entry',
						actionType: 'MOVE_TO_EMPTY_SLOT',
						targetDay: 'MONDAY',
						targetStartTime: '09:00',
						targetEndTime: '10:00',
						expectedRunVersion: run.version,
					},
				],
			}),
		});
		assertEqual(sync.status, 200, 'Sync endpoint returns HTTP 200');
		assertEqual(sync.json?.results?.length, 2, 'Sync returns deterministic per-action results');
		assertEqual(sync.json?.results?.[0]?.ok, true, 'Valid unified action succeeds');
		assertEqual(sync.json?.results?.[1]?.ok, false, 'Invalid unified action fails deterministically');
		assert(Array.isArray(sync.json?.state?.entries), 'Sync response includes latest state snapshot');
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
	console.error('\nUnhandled phase1 sync test error:', error);
	process.exit(1);
});
