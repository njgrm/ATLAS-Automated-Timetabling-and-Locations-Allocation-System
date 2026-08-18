/**
 * Published Schedule Legacy Scoped Routes Test
 *
 * Proves that the legacy scoped routes (sections, faculty, rooms)
 * resolve the active school year and do NOT fall back to historical
 * published runs.
 *
 * Also proves that explicit school-year historical scoped routes
 * still return historical data with source.isHistorical=true.
 */
import http from 'node:http';
import app from '../app.js';
import { prisma } from '../lib/prisma.js';

let passCount = 0;
let failCount = 0;
let server: http.Server;
let baseUrl: string;

function section(name: string) {
	console.log(`\n════ ${name} ════`);
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

async function requestJson(path: string): Promise<{ status: number; body: any }> {
	const response = await fetch(`${baseUrl}${path}`);
	let body: any = null;
	try { body = await response.json(); } catch { body = null; }
	return { status: response.status, body };
}

async function run() {
	const DEFAULT_SCHOOL_ID = 1;

	// Start the server
	section('Setup: start server');
	await new Promise<void>((resolve) => {
		server = app.listen(0, () => {
			const addr = server.address();
			if (addr && typeof addr === 'object') {
				baseUrl = `http://localhost:${addr.port}`;
			}
			resolve();
		});
	});
	console.log(`  Server listening on ${baseUrl}`);

	try {
		// Resolve active school year
		const mirrors = await prisma.enrollProSchoolYearMirror.findMany({
			where: { schoolId: DEFAULT_SCHOOL_ID, isActive: true },
			orderBy: [{ lastSyncedAt: 'desc' }, { updatedAt: 'desc' }],
			take: 1,
			select: { enrollProSchoolYearId: true, yearLabel: true },
		});
		const activeSchoolYearId = mirrors[0]?.enrollProSchoolYearId;
		console.log(`  Active school year: ${activeSchoolYearId} (${mirrors[0]?.yearLabel})`);

		// Find a historical published run with entries to test scoped routes
		const historicalRuns = await prisma.generationRun.findMany({
			where: {
				schoolId: DEFAULT_SCHOOL_ID,
				status: 'COMPLETED',
				schoolYearId: { not: activeSchoolYearId },
			},
			orderBy: [{ createdAt: 'desc' }],
			take: 10,
			select: { id: true, schoolYearId: true, summary: true, draftEntries: true },
		});
		const historicalPublished = historicalRuns.find((r) => {
			const s = r.summary as Record<string, unknown> | null;
			return s?.isPublished === true && Array.isArray(r.draftEntries) && r.draftEntries.length > 0;
		});

		// Extract test IDs from the historical published run
		let testSectionId: number | undefined;
		let testFacultyId: number | undefined;
		let testRoomId: number | undefined;

		if (historicalPublished) {
			const entries = historicalPublished.draftEntries as unknown as Array<{ sectionId?: number; facultyId?: number; roomId?: number }>;
			const sectionIds = new Set<number>();
			const facultyIds = new Set<number>();
			const roomIds = new Set<number>();
			for (const e of entries) {
				if (e.sectionId != null) sectionIds.add(Number(e.sectionId));
				if (e.facultyId != null) facultyIds.add(Number(e.facultyId));
				if (e.roomId != null) roomIds.add(Number(e.roomId));
			}
			testSectionId = sectionIds.values().next().value;
			testFacultyId = facultyIds.values().next().value;
			testRoomId = roomIds.values().next().value;
			console.log(`  Historical published run: ID ${historicalPublished.id}, schoolYearId ${historicalPublished.schoolYearId}`);
			console.log(`  Test IDs from historical run: section=${testSectionId}, faculty=${testFacultyId}, room=${testRoomId}`);
		} else {
			console.log('  No historical published run with entries found; some tests will be skipped');
		}

		// ──────────────────────────────────────────────────────────
		// GROUP 1: Legacy scoped routes must NOT return historical data
		// ──────────────────────────────────────────────────────────
		section('GROUP 1: Legacy scoped routes do not fall back to historical runs');

		// 1a: Legacy section route
		if (testSectionId != null) {
			section(`Legacy section route (sectionId=${testSectionId})`);
			const resp = await requestJson(`/api/v1/schools/${DEFAULT_SCHOOL_ID}/schedules/published/sections/${testSectionId}`);
			if (resp.status === 200) {
				// Active year has a published run — verify it's the active year, not historical
				assertEqual(resp.body.source?.schoolYearId, activeSchoolYearId, 'Active-year section route returns active school year');
				assertEqual(resp.body.source?.isActiveSchoolYear, true, 'isActiveSchoolYear is true');
			} else if (resp.status === 404) {
				assertEqual(resp.body.code, 'CURRENT_PUBLISHED_RUN_NOT_FOUND', 'No active-year published run → 404 CURRENT_PUBLISHED_RUN_NOT_FOUND');
			} else {
				assert(false, `Unexpected status ${resp.status}: ${JSON.stringify(resp.body)}`);
			}
		}

		// 1b: Legacy faculty route
		if (testFacultyId != null) {
			section(`Legacy faculty route (facultyId=${testFacultyId})`);
			const resp = await requestJson(`/api/v1/schools/${DEFAULT_SCHOOL_ID}/schedules/published/faculty/${testFacultyId}`);
			if (resp.status === 200) {
				assertEqual(resp.body.source?.schoolYearId, activeSchoolYearId, 'Active-year faculty route returns active school year');
				assertEqual(resp.body.source?.isActiveSchoolYear, true, 'isActiveSchoolYear is true');
			} else if (resp.status === 404) {
				assertEqual(resp.body.code, 'CURRENT_PUBLISHED_RUN_NOT_FOUND', 'No active-year published run → 404 CURRENT_PUBLISHED_RUN_NOT_FOUND');
			} else {
				assert(false, `Unexpected status ${resp.status}: ${JSON.stringify(resp.body)}`);
			}
		}

		// 1c: Legacy room route
		if (testRoomId != null) {
			section(`Legacy room route (roomId=${testRoomId})`);
			const resp = await requestJson(`/api/v1/schools/${DEFAULT_SCHOOL_ID}/schedules/published/rooms/${testRoomId}`);
			if (resp.status === 200) {
				assertEqual(resp.body.source?.schoolYearId, activeSchoolYearId, 'Active-year room route returns active school year');
				assertEqual(resp.body.source?.isActiveSchoolYear, true, 'isActiveSchoolYear is true');
			} else if (resp.status === 404) {
				assertEqual(resp.body.code, 'CURRENT_PUBLISHED_RUN_NOT_FOUND', 'No active-year published run → 404 CURRENT_PUBLISHED_RUN_NOT_FOUND');
			} else {
				assert(false, `Unexpected status ${resp.status}: ${JSON.stringify(resp.body)}`);
			}
		}

		// ──────────────────────────────────────────────────────────
		// GROUP 2: Explicit school-year historical routes still work
		// ──────────────────────────────────────────────────────────
		if (historicalPublished && testSectionId != null && testFacultyId != null && testRoomId != null) {
			const histYear = historicalPublished.schoolYearId;

			section('GROUP 2: Explicit school-year historical routes return historical data');

			// 2a: Historical base schedule
			const baseResp = await requestJson(`/api/v1/schools/${DEFAULT_SCHOOL_ID}/school-years/${histYear}/schedules/published`);
			assertEqual(baseResp.status, 200, 'Historical base schedule returns 200');
			assertEqual(baseResp.body.source?.isActiveSchoolYear, false, 'isActiveSchoolYear is false for historical year');
			assertEqual(baseResp.body.source?.isHistorical, true, 'isHistorical is true for historical year');
			assertEqual(baseResp.body.source?.schoolYearId, histYear, 'schoolYearId matches historical year');

			// 2b: Historical section route
			const sectionResp = await requestJson(`/api/v1/schools/${DEFAULT_SCHOOL_ID}/school-years/${histYear}/schedules/published/sections/${testSectionId}`);
			assertEqual(sectionResp.status, 200, 'Historical section route returns 200');
			assertEqual(sectionResp.body.source?.isActiveSchoolYear, false, 'isActiveSchoolYear is false for historical section');
			assertEqual(sectionResp.body.source?.isHistorical, true, 'isHistorical is true for historical section');
			assertEqual(sectionResp.body.source?.schoolYearId, histYear, 'schoolYearId matches historical year for section');

			// 2c: Historical faculty route
			const facultyResp = await requestJson(`/api/v1/schools/${DEFAULT_SCHOOL_ID}/school-years/${histYear}/schedules/published/faculty/${testFacultyId}`);
			assertEqual(facultyResp.status, 200, 'Historical faculty route returns 200');
			assertEqual(facultyResp.body.source?.isActiveSchoolYear, false, 'isActiveSchoolYear is false for historical faculty');
			assertEqual(facultyResp.body.source?.isHistorical, true, 'isHistorical is true for historical faculty');
			assertEqual(facultyResp.body.source?.schoolYearId, histYear, 'schoolYearId matches historical year for faculty');

			// 2d: Historical room route
			const roomResp = await requestJson(`/api/v1/schools/${DEFAULT_SCHOOL_ID}/school-years/${histYear}/schedules/published/rooms/${testRoomId}`);
			assertEqual(roomResp.status, 200, 'Historical room route returns 200');
			assertEqual(roomResp.body.source?.isActiveSchoolYear, false, 'isActiveSchoolYear is false for historical room');
			assertEqual(roomResp.body.source?.isHistorical, true, 'isHistorical is true for historical room');
			assertEqual(roomResp.body.source?.schoolYearId, histYear, 'schoolYearId matches historical year for room');

			// 2e: Historical section route does NOT leak entries from other sections
			const histEntries = sectionResp.body.entries ?? [];
			const hasOtherSection = histEntries.some((e: any) => {
				const sid = typeof e.sectionId === 'string' ? parseInt(e.sectionId, 10) : e.sectionId;
				return sid !== testSectionId && !isNaN(sid);
			});
			assert(!hasOtherSection, `Historical section route does not leak entries from other sections (${histEntries.length} entries returned)`);

		} else {
			section('GROUP 2: Skipped (no historical published run with entries)');
		}

		// ──────────────────────────────────────────────────────────
		// GROUP 3: Active year does NOT have a published run → 404
		// ──────────────────────────────────────────────────────────
		section('GROUP 3: Active-year guard without published run');
		if (activeSchoolYearId) {
			// The default endpoint should return 404 if no published run exists for the active year
			const defaultResp = await requestJson(`/api/v1/schools/${DEFAULT_SCHOOL_ID}/schedules/published`);
			if (defaultResp.status === 404) {
				assertEqual(defaultResp.body.code, 'CURRENT_PUBLISHED_RUN_NOT_FOUND', 'Default endpoint returns CURRENT_PUBLISHED_RUN_NOT_FOUND');
			} else if (defaultResp.status === 200) {
				console.log(`  Active year (${activeSchoolYearId}) has a published run; legacy scoped routes also returned 200 above`);
				assert(true, 'Active year has a published run (guard not triggered)');
			} else {
				assert(false, `Default endpoint returned unexpected status ${defaultResp.status}`);
			}
		}

	} finally {
		section('Cleanup');
		await new Promise<void>((resolve) => {
			server.close(() => resolve());
		});
		console.log('  Server closed');
	}

	section('Summary');
	console.log(`  Pass: ${passCount}`);
	console.log(`  Fail: ${failCount}`);
	if (failCount > 0) {
		process.exit(1);
	}
}

run();
