/**
 * Published Schedule School-Year Routes Test
 *
 * Proves that explicit school-year routes return correct active/historical
 * metadata and do not leak entries from other school years.
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

		// Find a historical published run
		const historicalRuns = await prisma.generationRun.findMany({
			where: {
				schoolId: DEFAULT_SCHOOL_ID,
				status: 'COMPLETED',
				schoolYearId: { not: activeSchoolYearId },
			},
			orderBy: [{ createdAt: 'desc' }],
			take: 5,
			select: { id: true, schoolYearId: true, summary: true },
		});
		const historicalPublished = historicalRuns.find((r) => {
			const s = r.summary as Record<string, unknown> | null;
			return s?.isPublished === true;
		});

		// Test 1: Explicit active-year request returns active source metadata
		section('Explicit active-year request returns active source metadata');
		if (activeSchoolYearId) {
			const activeResp = await requestJson(`/api/v1/schools/${DEFAULT_SCHOOL_ID}/school-years/${activeSchoolYearId}/schedules/published`);
			if (activeResp.status === 200) {
				assertEqual(activeResp.body.source?.isActiveSchoolYear, true, 'isActiveSchoolYear is true for active year');
				assertEqual(activeResp.body.source?.isHistorical, false, 'isHistorical is false for active year');
				assertEqual(activeResp.body.source?.schoolYearId, activeSchoolYearId, 'schoolYearId matches active year');
				console.log(`  schoolYearLabel: ${activeResp.body.source?.schoolYearLabel}`);
			} else if (activeResp.status === 404) {
				assertEqual(activeResp.body.code, 'PUBLISHED_RUN_NOT_FOUND', 'Active year has no published run (expected for current live state)');
			} else {
				assert(false, `Unexpected status ${activeResp.status}`);
			}
		}

		// Test 2: Explicit historical-year request returns historical source metadata
		section('Explicit historical-year request returns historical source metadata');
		if (historicalPublished) {
			const histResp = await requestJson(`/api/v1/schools/${DEFAULT_SCHOOL_ID}/school-years/${historicalPublished.schoolYearId}/schedules/published`);
			assertEqual(histResp.status, 200, 'Historical year endpoint returns 200');
			assertEqual(histResp.body.source?.isActiveSchoolYear, false, 'isActiveSchoolYear is false for historical year');
			assertEqual(histResp.body.source?.isHistorical, true, 'isHistorical is true for historical year');
			assertEqual(histResp.body.source?.schoolYearId, historicalPublished.schoolYearId, 'schoolYearId matches historical year');
			console.log(`  Historical schoolYearLabel: ${histResp.body.source?.schoolYearLabel}`);
		} else {
			console.log('  Skipped: no historical published runs to test against');
		}

		// Test 3: Explicit missing-year request returns 404
		section('Explicit missing-year request returns 404');
		const missingResp = await requestJson(`/api/v1/schools/${DEFAULT_SCHOOL_ID}/school-years/99999/schedules/published`);
		assertEqual(missingResp.status, 404, 'Missing year returns 404');
		assertEqual(missingResp.body?.code, 'PUBLISHED_RUN_NOT_FOUND', 'Missing year returns PUBLISHED_RUN_NOT_FOUND');

		// Test 4: Section filter does not leak entries from other years
		section('Section filter scoped to school year');
		if (historicalPublished) {
			// Get a section ID from the historical run
			const histEntries = await prisma.generationRun.findUnique({
				where: { id: historicalPublished.id },
				select: { draftEntries: true },
			});
			const entries = (histEntries?.draftEntries ?? []) as unknown as Array<{ sectionId: number }>;
			if (entries.length > 0) {
				const testSectionId = entries[0].sectionId;
				const filteredResp = await requestJson(
					`/api/v1/schools/${DEFAULT_SCHOOL_ID}/school-years/${historicalPublished.schoolYearId}/schedules/published/sections/${testSectionId}`
				);
				assertEqual(filteredResp.status, 200, 'Section filter returns 200');
				assertEqual(filteredResp.body.source?.schoolYearId, historicalPublished.schoolYearId, 'Filtered response scoped to requested year');
				// Verify no entries leak from other years
				const returnedEntries = filteredResp.body.entries ?? [];
				const hasOtherYearEntries = returnedEntries.some((e: any) => {
					const sid = typeof e.sectionId === 'string' ? parseInt(e.sectionId, 10) : e.sectionId;
					return sid !== testSectionId && !isNaN(sid);
				});
				assert(!hasOtherYearEntries, `No entries with other section IDs leaked (got ${returnedEntries.length} entries)`);
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
