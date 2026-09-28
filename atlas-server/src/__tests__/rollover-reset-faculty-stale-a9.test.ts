/**
 * A9 / operator ruling 5 (2026-09-29) — the School Year Setup reset must STALE,
 * never DELETE, faculty that is absent from the (TEACHING-filtered) upstream
 * feed.
 *
 * Why this is a real defect and not a hypothetical one:
 *
 *  - `POST /runtime/rollover-sync/reset-dummy-year` reaches
 *    `resetDummyYearAndApplyRollover`, which used to call
 *    `applyRolloverSync(..., { facultyMode: 'prune' })`. A *year reset* was
 *    therefore silently deleting every faculty mirror missing from the feed.
 *  - Since 1ce31887 the feed is `personnelType=TEACHING`
 *    (`faculty-adapter.ts:94`), so "absent from the feed" now means "non-teaching
 *    staff" — exactly the mirrors that must be kept, not cleaned up.
 *  - Prune deletes `facultyMirror` rows, and `FacultySubject.faculty ->
 *    FacultyMirror onDelete: Cascade` (prisma/schema.prisma:468) takes the
 *    years 8-10 `faculty_subjects` ownership history with them.
 *
 * The other two reachable paths already reconcile and were left alone: the
 * `Sync now` button (`RolloverGuidanceCard.tsx:928/932` ->
 * `runtime.router.ts:348-358`) and the automation tick
 * (`rollover-automation.service.ts:2310/244`) both inherit
 * `applyRolloverSync`'s `facultyMode ?? 'reconcile'` default.
 *
 * The test asserts the ABSENCE OF DELETION positively: the mirror row and its
 * historical `faculty_subjects` ownerships are read back and must still exist.
 * Asserting only `isStale === true` would pass even if a later delete ran.
 *
 * Reachable from `test:server-db` (the per-file disposable harness), and it is
 * fail-closed on a non-disposable `DATABASE_URL` like every other DB-writing
 * suite (AGENTS.md §5, 2026-09-29).
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { prisma } from '../lib/prisma.js';
import { requireDisposableDatabase } from './helpers/disposable-database-guard.js';
import { resetDummyYearAndApplyRollover } from '../services/enrollpro-rollover.service.js';

requireDisposableDatabase('rollover-reset-faculty-stale-a9.test.ts');

let passCount = 0;
let failCount = 0;

function section(name: string) {
	console.log(`\n  ${name}  `);
}

function assert(condition: boolean, label: string) {
	if (condition) {
		passCount += 1;
		console.log(`    ${label}`);
		return;
	}
	failCount += 1;
	console.error(`    ${label}`);
}

function assertEqual<T>(actual: T, expected: T, label: string) {
	assert(actual === expected, `${label}   expected ${String(expected)}, got ${String(actual)}`);
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
	const body = JSON.stringify(payload);
	res.writeHead(statusCode, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
	res.end(body);
}

async function startAndGetUrl(server: Server): Promise<string> {
	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => resolve());
	});
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('No TCP port');
	return `http://127.0.0.1:${address.port}/api`;
}

async function stopServer(server: Server) {
	await new Promise<void>((resolve, reject) => {
		server.close((error) => (error ? reject(error) : resolve()));
	});
}

// The EnrollPro active year the fake reports, and the label ATLAS's mirror
// still carries. The mismatch is the documented RR-08 wedge: it is what makes
// the reset legitimately available (drift = mapping-conflict) and what
// `reconcileActiveYearMirrorLabel` repairs just before the apply.
const UPSTREAM_YEAR_ID = 950_001;
const UPSTREAM_YEAR_LABEL = '2030-2031';
const STALE_MIRROR_LABEL = '2029-2030';
/** The year ATLAS is still working in; carries the historical ownerships. */
const EARLIER_YEAR_ID = 940_001;
/** The operator performing the reset; recorded on the DUMMY_YEAR_RESET audit row. */
const ACTOR_ID = 1;

/** The one teaching staff member the `personnelType=TEACHING` feed returns. */
const TEACHING_EXTERNAL_ID = 7001;
/** A non-teaching staff member: absent from the filtered feed, must go stale. */
const NON_TEACHING_EXTERNAL_ID = 7002;

function startFakeEnrollPro(): Server {
	return createServer((req: IncomingMessage, res: ServerResponse) => {
		const url = new URL(req.url ?? '/', 'http://127.0.0.1');
		if (url.pathname === '/api/integration/v1/health') {
			sendJson(res, 200, { status: 'ok', service: 'enrollpro' });
			return;
		}
		if (url.pathname === '/api/integration/v1/school-year') {
			sendJson(res, 200, { data: { id: UPSTREAM_YEAR_ID, yearLabel: UPSTREAM_YEAR_LABEL } });
			return;
		}
		if (url.pathname === '/api/integration/v1/sections') {
			sendJson(res, 200, { data: [], meta: { page: 1, limit: 200, totalPages: 0 } });
			return;
		}
		// The feed is TEACHING-only (1ce31887): the non-teaching mirror is simply
		// not in this response. That is what makes it "absent upstream".
		if (url.pathname === '/api/integration/v1/faculty' || url.pathname === '/api/integration/v1/default/faculty') {
			sendJson(res, 200, {
				data: [{
					teacherId: TEACHING_EXTERNAL_ID,
					employeeId: '7001001',
					firstName: 'Teaching',
					lastName: 'Teacher',
					fullName: 'Teaching Teacher',
					departmentCode: 'MATH',
					departmentName: 'Mathematics',
					specialization: 'Mathematics',
					isActive: true,
					isTeachingExempt: false,
				}],
				meta: { page: 1, limit: 200, totalPages: 1 },
			});
			return;
		}
		if (url.pathname === '/api/settings/public') {
			sendJson(res, 200, {
				schoolName: 'A9 Rollover Reset Premise',
				activeSchoolYearId: UPSTREAM_YEAR_ID,
				activeSchoolYearLabel: UPSTREAM_YEAR_LABEL,
			});
			return;
		}
		sendJson(res, 404, { error: 'not found' });
	});
}

async function run() {
	if (!process.env.ENROLLPRO_API) process.env.ENROLLPRO_API = 'http://127.0.0.1:9/api';

	section('Premise: disposable school with a teaching mirror and a non-teaching mirror');
	const school = await prisma.school.create({
		data: { name: 'ROLLOVER-RESET-STALE A9 DISPOSABLE — SAFE TO DELETE', shortName: 'A9RRSTALE' },
		select: { id: true },
	});
	const schoolId = school.id;

	// ATLAS is still working in EARLIER_YEAR_ID; the upstream year exists with a
	// stale label, so the reset is legitimately available.
	await prisma.enrollProSchoolYearMirror.createMany({
		data: [
			{
				schoolId, enrollProSchoolYearId: EARLIER_YEAR_ID, yearLabel: STALE_MIRROR_LABEL,
				isActive: true, isArchived: false, syncStatus: 'synced', lastSyncedAt: new Date(),
			},
			{
				schoolId, enrollProSchoolYearId: UPSTREAM_YEAR_ID, yearLabel: STALE_MIRROR_LABEL,
				isActive: false, isArchived: false, syncStatus: 'synced', lastSyncedAt: new Date(),
			},
		],
	});

	const teaching = await prisma.facultyMirror.create({
		data: {
			schoolId, externalId: TEACHING_EXTERNAL_ID, firstName: 'Teaching', lastName: 'Teacher',
			department: 'MATH', maxHoursPerWeek: 30, isActiveForScheduling: true, isStale: false,
		},
		select: { id: true },
	});
	const nonTeaching = await prisma.facultyMirror.create({
		data: {
			schoolId, externalId: NON_TEACHING_EXTERNAL_ID, firstName: 'Non', lastName: 'Teaching',
			department: 'GRADE8', maxHoursPerWeek: 30, isActiveForScheduling: true, isStale: false,
		},
		select: { id: true },
	});

	// A dummy row under the upstream year, so `canResetDummyYear` has something
	// to clear and the reset is not vacuously refused.
	const dummySection = await prisma.sectionMirror.create({
		data: {
			schoolId, schoolYearId: UPSTREAM_YEAR_ID, externalId: 950_101, name: 'Dummy 7-A',
			gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR',
			maxCapacity: 50, enrolledCount: 40, isActiveForScheduling: true, isStale: false,
		},
		select: { id: true },
	});

	// THE OWNERSHIP HISTORY the ruling is about: the non-teaching mirror owns a
	// subject in an EARLIER year. Pruning the mirror would cascade these away.
	const historySubject = await prisma.subject.create({
		data: {
			schoolId, code: 'A9HIST', name: 'A9 Historical Subject', schedulingDisposition: 'SCHEDULED_TEACHING',
			minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM', gradeLevels: [7], programScopes: ['REGULAR'],
			isActive: true,
		},
		select: { id: true },
	});
	const historyFacultySubject = await prisma.facultySubject.create({
		data: {
			facultyId: nonTeaching.id, subjectId: historySubject.id, schoolId, schoolYearId: EARLIER_YEAR_ID,
			gradeLevels: [7], sectionIds: [940_101], assignedBy: 1,
		},
		select: { id: true },
	});
	const historyOwnership = await prisma.subjectSectionOwnership.create({
		data: {
			schoolId, schoolYearId: EARLIER_YEAR_ID, facultySubjectId: historyFacultySubject.id,
			facultyId: nonTeaching.id, subjectId: historySubject.id, sectionId: 940_101,
		},
		select: { id: true },
	});

	const nonTeachingId = nonTeaching.id;
	assert(true, `Premise: non-teaching mirror id ${nonTeachingId} owns faculty_subjects in year ${EARLIER_YEAR_ID}`);

	section('Reset preview: the dummy-year reset is legitimately available');
	const server = startFakeEnrollPro();
	const baseUrl = await startAndGetUrl(server);
	const origApi = process.env.ENROLLPRO_API;
	try {
		process.env.ENROLLPRO_API = baseUrl;

		const preview = await resetDummyYearAndApplyRollover({
			schoolId,
			actorId: ACTOR_ID,
			authToken: 'a9-fixture-token',
			confirmReset: false,
		});
		assert(preview.reset.canResetDummyYear, `Preview offers the reset (blockers: ${JSON.stringify(preview.reset.blockers)})`);
		assertEqual(preview.reset.targetSchoolYearId, UPSTREAM_YEAR_ID, 'Preview targets the EnrollPro active year');

		section('Apply: absent/non-teaching staff go stale, they are NOT deleted');
		const result = await resetDummyYearAndApplyRollover({
			schoolId,
			actorId: ACTOR_ID,
			authToken: 'a9-fixture-token',
			confirmReset: true,
			confirmationText: preview.reset.confirmationText,
		});
		assert(result.resetApplied, 'Reset was applied');
		assert(result.rolloverApply !== null, 'The EnrollPro apply ran');

		// ── The load-bearing assertions: the rows must still EXIST. ──
		const nonTeachingAfter = await prisma.facultyMirror.findUnique({
			where: { id: nonTeachingId },
			select: { id: true, externalId: true, isStale: true, staleReason: true, isActiveForScheduling: true },
		});
		assert(nonTeachingAfter !== null, 'The non-teaching faculty mirror STILL EXISTS (not deleted)');
		assertEqual(nonTeachingAfter?.externalId, NON_TEACHING_EXTERNAL_ID, 'The surviving mirror is the non-teaching one');
		assertEqual(nonTeachingAfter?.isStale, true, 'The absent mirror is marked stale');
		assertEqual(
			nonTeachingAfter?.staleReason,
			'Missing from upstream during reconciliation',
			'The stale reason is the canonical reconciliation reason',
		);

		const historySubjectsAfter = await prisma.facultySubject.findMany({
			where: { facultyId: nonTeachingId },
			select: { id: true, schoolYearId: true, subjectId: true },
		});
		assertEqual(historySubjectsAfter.length, 1, 'The historical faculty_subjects row for the non-teaching mirror SURVIVED');
		assertEqual(historySubjectsAfter[0]?.id, historyFacultySubject.id, 'It is the same faculty_subjects row (same id)');
		assertEqual(historySubjectsAfter[0]?.schoolYearId, EARLIER_YEAR_ID, 'Its earlier-year identity is intact');

		const historyOwnershipAfter = await prisma.subjectSectionOwnership.findUnique({
			where: { id: historyOwnership.id },
			select: { id: true, facultyId: true, schoolYearId: true },
		});
		assert(historyOwnershipAfter !== null, 'The historical subject_section_ownership row SURVIVED (not cascaded away)');
		assertEqual(historyOwnershipAfter?.facultyId, nonTeachingId, 'It still points at the surviving mirror');
		assertEqual(historyOwnershipAfter?.schoolYearId, EARLIER_YEAR_ID, 'It still carries the earlier-year identity');

		// ── The reset must still have done its actual job (not vacuously pass). ──
		const teachingAfter = await prisma.facultyMirror.findUnique({
			where: { id: teaching.id },
			select: { id: true, isStale: true },
		});
		assert(teachingAfter !== null, 'The teaching mirror present in the feed still exists');
		assertEqual(teachingAfter?.isStale, false, 'A teacher present upstream is not marked stale');

		const dummySectionAfter = await prisma.sectionMirror.findUnique({
			where: { id: dummySection.id },
			select: { id: true },
		});
		assert(dummySectionAfter === null, 'The reset DID clear the dummy-year section (the reset still works)');

		const activeMirror = await prisma.enrollProSchoolYearMirror.findFirst({
			where: { schoolId, isActive: true },
			select: { enrollProSchoolYearId: true, yearLabel: true },
		});
		assertEqual(activeMirror?.enrollProSchoolYearId, UPSTREAM_YEAR_ID, 'The active mirror advanced to the EnrollPro year');
		assertEqual(activeMirror?.yearLabel, UPSTREAM_YEAR_LABEL, 'The stale year label was reconciled to upstream truth');

		const facultyAfter = await prisma.facultyMirror.count({ where: { schoolId } });
		assertEqual(facultyAfter, 2, 'Both faculty mirrors survive the reset (nothing was pruned)');
	} finally {
		if (origApi === undefined) delete process.env.ENROLLPRO_API;
		else process.env.ENROLLPRO_API = origApi;
		await stopServer(server);
	}

	console.log(`\nRollover reset faculty-stale test complete: ${passCount} passed, ${failCount} failed.`);
	if (failCount > 0) {
		process.exitCode = 1;
	}
}

run()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
