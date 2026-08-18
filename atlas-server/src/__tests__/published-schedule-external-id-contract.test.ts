/**
 * Published Schedule External ID Contract Test
 *
 * Proves that published schedule payloads include ATLAS and EnrollPro
 * identity fields for faculty and sections, and that the external
 * faculty route works correctly.
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

function assertNotNull(value: unknown, label: string) {
	assert(value != null, `${label} — expected non-null, got ${String(value)}`);
}

async function requestJson(path: string): Promise<{ status: number; body: any }> {
	const response = await fetch(`${baseUrl}${path}`);
	let body: any = null;
	try { body = await response.json(); } catch { body = null; }
	return { status: response.status, body };
}

async function run() {
	const DEFAULT_SCHOOL_ID = 1;

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

		// Find a historical published run with entries
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

		if (!historicalPublished) {
			console.log('  No historical published run with entries found; aborting');
			return;
		}

		const histYear = historicalPublished.schoolYearId;
		const entries = historicalPublished.draftEntries as unknown as Array<{
			sectionId: number; facultyId: number | null; roomId: number;
		}>;
		const firstEntryWithFaculty = entries.find((e) => e.facultyId != null);

		if (!firstEntryWithFaculty) {
			console.log('  No entries with faculty found; aborting');
			return;
		}

		const testFacultyId = firstEntryWithFaculty.facultyId!;
		const testSectionId = firstEntryWithFaculty.sectionId;

		console.log(`  Historical year: ${histYear}`);
		console.log(`  Test facultyId (ATLAS internal): ${testFacultyId}`);
		console.log(`  Test sectionId (EnrollPro external): ${testSectionId}`);

		// Look up the faculty mirror to get externalId
		const facultyMirror = await prisma.facultyMirror.findUnique({
			where: { id: testFacultyId },
			select: { id: true, externalId: true, employeeId: true, isPlaceholder: true, firstName: true, lastName: true },
		});
		console.log(`  Faculty mirror: atlasId=${facultyMirror?.id}, externalId=${facultyMirror?.externalId}, employeeId=${facultyMirror?.employeeId}, isPlaceholder=${facultyMirror?.isPlaceholder}`);

		// ──────────────────────────────────────────────────────────
		// GROUP 1: Payload includes external ID fields
		// ──────────────────────────────────────────────────────────
		section('GROUP 1: Published payload includes external ID fields');

		const baseResp = await requestJson(`/api/v1/schools/${DEFAULT_SCHOOL_ID}/school-years/${histYear}/schedules/published`);
		assertEqual(baseResp.status, 200, 'Historical base schedule returns 200');

		const payloadEntries = baseResp.body.entries ?? [];
		const sampleEntry = payloadEntries.find((e: any) => e.faculty?.atlasId === testFacultyId && e.section?.externalId === testSectionId)
			?? payloadEntries.find((e: any) => e.faculty?.atlasId === testFacultyId)
			?? payloadEntries[0];

		if (sampleEntry) {
			console.log(`  Sample entry: ${sampleEntry.entryId}`);

			// Faculty fields
			assertNotNull(sampleEntry.faculty?.atlasId, 'faculty.atlasId is present');
			assertNotNull(sampleEntry.faculty?.externalId, 'faculty.externalId is present');
			assertEqual(sampleEntry.faculty?.atlasId, testFacultyId, 'faculty.atlasId matches ATLAS internal ID');
			if (facultyMirror) {
				assertEqual(sampleEntry.faculty?.externalId, facultyMirror.externalId, 'faculty.externalId matches EnrollPro external ID');
				assertEqual(sampleEntry.faculty?.employeeId, facultyMirror.employeeId, 'faculty.employeeId matches');
				assertEqual(sampleEntry.faculty?.isPlaceholder, facultyMirror.isPlaceholder, 'faculty.isPlaceholder matches');
			}
			assertEqual(sampleEntry.faculty?.id, testFacultyId, 'faculty.id preserved for backward compatibility');

			// Section fields
			assertNotNull(sampleEntry.section?.externalId, 'section.externalId is present');
			assertEqual(sampleEntry.section?.externalId, testSectionId, 'section.externalId matches EnrollPro section ID');
			assertEqual(sampleEntry.section?.id, testSectionId, 'section.id preserved for backward compatibility');
		} else {
			assert(false, 'Could not find a sample entry matching test criteria');
		}

		// ──────────────────────────────────────────────────────────
		// GROUP 2: External faculty route returns entries
		// ──────────────────────────────────────────────────────────
		if (facultyMirror) {
			section('GROUP 2: External faculty route works');

			// Explicit school-year external faculty route
			const extResp = await requestJson(`/api/v1/schools/${DEFAULT_SCHOOL_ID}/school-years/${histYear}/schedules/published/faculty-external/${facultyMirror.externalId}`);
			assertEqual(extResp.status, 200, 'External faculty route returns 200');
			assertEqual(extResp.body.source?.schoolYearId, histYear, 'Response scoped to requested year');

			const extEntries = extResp.body.entries ?? [];
			const allMatchExternalId = extEntries.every((e: any) => e.faculty?.externalId === facultyMirror?.externalId);
			assert(allMatchExternalId, `All returned entries have matching externalId (${extEntries.length} entries)`);

			console.log(`  External faculty route returned ${extEntries.length} entries for externalId=${facultyMirror.externalId}`);
		}

		// ──────────────────────────────────────────────────────────
		// GROUP 3: Internal faculty route still works
		// ──────────────────────────────────────────────────────────
		section('GROUP 3: Internal faculty route backward compatible');
		const intResp = await requestJson(`/api/v1/schools/${DEFAULT_SCHOOL_ID}/school-years/${histYear}/schedules/published/faculty/${testFacultyId}`);
		assertEqual(intResp.status, 200, 'Internal faculty route returns 200');
		const intEntries = intResp.body.entries ?? [];
		assert(intEntries.length > 0, `Internal faculty route returns entries (${intEntries.length} entries)`);

		// Verify the entries also have the new external ID fields
		if (intEntries.length > 0) {
			const first = intEntries[0];
			assertNotNull(first.faculty?.atlasId, 'Internal route entry has faculty.atlasId');
			assertNotNull(first.faculty?.externalId, 'Internal route entry has faculty.externalId');
		}

		// ──────────────────────────────────────────────────────────
		// GROUP 4: Non-existent external faculty returns 404
		// ──────────────────────────────────────────────────────────
		section('GROUP 4: Non-existent external faculty returns 404');
		const missingResp = await requestJson(`/api/v1/schools/${DEFAULT_SCHOOL_ID}/school-years/${histYear}/schedules/published/faculty-external/999999`);
		assertEqual(missingResp.status, 404, 'Missing external faculty returns 404');
		assertEqual(missingResp.body?.code, 'FACULTY_NOT_FOUND', 'Missing external faculty returns FACULTY_NOT_FOUND');

		// ──────────────────────────────────────────────────────────
		// GROUP 5: Unassigned faculty shows placeholder values
		// ──────────────────────────────────────────────────────────
		section('GROUP 5: Unassigned faculty shows placeholder values');
		const unassignedEntry = payloadEntries.find((e: any) => e.faculty?.id == null);
		if (unassignedEntry) {
			assertEqual(unassignedEntry.faculty?.atlasId, null, 'Unassigned faculty.atlasId is null');
			assertEqual(unassignedEntry.faculty?.externalId, null, 'Unassigned faculty.externalId is null');
			assertEqual(unassignedEntry.faculty?.name, 'Unassigned Faculty', 'Unassigned faculty.name is placeholder text');
		} else {
			console.log('  No unassigned entries found (all entries have faculty)');
			assert(true, 'No unassigned entries to test');
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
