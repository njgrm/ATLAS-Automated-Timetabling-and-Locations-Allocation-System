/**
 * A6 — Teaching Load placement write gate, route + database rows.
 *
 * Operator decision 14 (2026-09-30): Teaching Load never saves a load the
 * timetable cannot place. This suite drives the REAL mounted
 * `faculty-assignment.router` over a disposable PostgreSQL database and proves:
 *
 *   R1 the zero-write preview route answers 200 with a blocked line + the
 *      reused reason + a teacher who fits, and writes nothing;
 *   R2 the single `PUT /faculty-assignments/:facultyId` save refuses with a
 *      typed 409 `TEACHING_LOAD_UNPLACEABLE` and `details.blockers`, writing
 *      nothing;
 *   R3 "Apply suggested" refuses with the same typed 409 and leaves the pending
 *      proposal intact (not consumed), writing nothing;
 *   R4 a placeable line still saves (the check does not block everything);
 *   R5 one section's check is under 2 s (measured, printed).
 *
 * Disposable database only (AGENTS.md §5/§13): run through
 * `npm run test:server-db` (or the same runner directly), which gives this file
 * its own `atlas_restore_drill_<yyyymmdd>_<suffix>` database and drops it. The
 * suite fails closed before the first write when `DATABASE_URL` is not
 * disposable.
 */
import http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';

import { requireDisposableDatabase } from './helpers/disposable-database-guard.js';

requireDisposableDatabase('a6-tl-placement-write-gate.test.ts');

const JWT_SECRET = process.env.JWT_SECRET ?? 'a6-tl-placement-write-gate-secret';
process.env.JWT_SECRET = JWT_SECRET;
process.env.ATLAS_SYSTEM_TOKEN = process.env.ATLAS_SYSTEM_TOKEN ?? 'a6-tl-placement-system-token';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, label: string) {
	if (condition) {
		passCount += 1;
		console.log(`[PASS] ${label}`);
		return;
	}
	failCount += 1;
	console.error(`[FAIL] ${label}`);
}

function section(title: string) {
	console.log(`\n=== ${title} ===`);
}

async function startServer(router: express.Router): Promise<{ baseUrl: string; close: () => Promise<void> }> {
	const app = express();
	app.use(express.json());
	app.use('/api/v1/faculty-assignments', router);
	app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
		res.status(err?.statusCode ?? 500).json({ code: err?.code ?? 'UNHANDLED', message: err?.message ?? String(err), ...(err?.details ? { details: err.details } : {}) });
	});
	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	const port = typeof address === 'object' && address ? address.port : 0;
	return {
		baseUrl: `http://127.0.0.1:${port}`,
		close: () => new Promise<void>((resolve) => server.close(() => resolve())),
	};
}

async function call(baseUrl: string, path: string, method: 'GET' | 'POST' | 'PUT', token: string | null, body?: unknown): Promise<{ status: number; payload: any }> {
	try {
		const response = await fetch(`${baseUrl}${path}`, {
			method,
			headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		});
		return { status: response.status, payload: await response.text().then((raw) => { try { return JSON.parse(raw); } catch { return { raw }; } }) };
	} catch (error) {
		return { status: 0, payload: { transportError: String(error) } };
	}
}

async function main() {
	if (!process.env.DATABASE_URL) {
		console.error('[FAIL] DATABASE_URL is unavailable; cannot run the A6 placement write-gate test.');
		process.exit(1);
	}

	const prismaModule = (await import('../lib/prisma.js')) as any;
	const placement = (await import('../services/teaching-load-placement-check.service.js')) as any;
	const suggestionService = (await import('../services/teaching-load-suggestion-proposal.service.js')) as any;
	const router = ((await import('../routes/faculty-assignment.router.js')) as any).default as express.Router;

	const p = (prismaModule as any).createTestPrismaClient();

	// ─── Fixture ────────────────────────────────────────────────────────────
	const school = await p.school.create({ data: { name: 'A6-TL-PLACEMENT FIXTURE — SAFE TO DELETE', shortName: 'A6TLPLC' }, select: { id: true } });
	const schoolId = school.id as number;
	const otherSchool = await p.school.create({ data: { name: 'A6-TL-PLACEMENT OTHER — SAFE TO DELETE', shortName: 'A6TLPLO' }, select: { id: true } });
	const otherSchoolId = otherSchool.id as number;
	const schoolYearId = 9187;

	await p.enrollProSchoolYearMirror.create({
		data: {
			schoolId,
			enrollProSchoolYearId: schoolYearId,
			yearLabel: '2030-2031',
			isActive: true,
			isArchived: false,
			syncStatus: 'synced',
			termContractCache: {
				schoolId,
				schoolYear: { id: schoolYearId, yearLabel: '2030-2031' },
				format: 'TRIMESTER',
				terms: [
					{ identity: 'T1', displayLabel: 'First Trimester', order: 1 },
					{ identity: 'T2', displayLabel: 'Second Trimester', order: 2 },
					{ identity: 'T3', displayLabel: 'Third Trimester', order: 3 },
				],
			},
			termContractCachedAt: new Date(),
		},
	});
	// One 45-minute period per day, at 11:30 — the live Makabansa "only 11:30 free".
	await p.schedulingPolicy.create({
		data: { schoolId, schoolYearId, periodLengthMinutes: 45, periodsPerDay: 1, earliestStartTime: '11:30', latestEndTime: '12:15' },
	});

	const building = await p.building.create({ data: { schoolId, name: 'Main', gradeScope: [] }, select: { id: true } });
	const room = await p.room.create({ data: { buildingId: building.id as number, name: 'Room 101', type: 'CLASSROOM', capacity: 45, isTeachingSpace: true, isSharedFacility: false }, select: { id: true } });

	const section87 = await p.sectionMirror.create({
		data: { externalId: 87, schoolId, schoolYearId, name: 'Grade 8 Makabansa', gradeLevelId: 1, gradeLevelName: 'Grade 8', displayOrder: 8, maxCapacity: 50, enrolledCount: 35, programType: 'REGULAR', isActiveForScheduling: true, isStale: false },
		select: { id: true },
	});
	const section90 = await p.sectionMirror.create({
		data: { externalId: 90, schoolId, schoolYearId, name: 'Grade 8 Mabini', gradeLevelId: 1, gradeLevelName: 'Grade 8', displayOrder: 8, maxCapacity: 50, enrolledCount: 35, programType: 'REGULAR', isActiveForScheduling: true, isStale: false },
		select: { id: true },
	});

	const tle = await p.subject.create({
		data: {
			schoolId, code: 'TLE_ICT', name: 'TLE Exploratory - ICT', minMinutesPerWeek: 45,
			gradeLevels: [8], programScopes: ['REGULAR'], schedulingDisposition: 'SCHEDULED_TEACHING',
			isActive: true, preferredRoomType: 'CLASSROOM', ownerDepartment: 'TLE',
		},
		select: { id: true },
	});
	const tleId = tle.id as number;

	const navarro = await p.facultyMirror.create({ data: { externalId: 7001, schoolId, firstName: 'Francis Miguel', lastName: 'Navarro', department: 'TLE', isActiveForScheduling: true, isStale: false, isPlaceholder: false }, select: { id: true } });
	const eduardo = await p.facultyMirror.create({ data: { externalId: 7002, schoolId, firstName: 'EDUARDO', lastName: 'VILLAREAL', department: 'TLE', isActiveForScheduling: true, isStale: false, isPlaceholder: false }, select: { id: true } });
	const busy = await p.facultyMirror.create({ data: { externalId: 7003, schoolId, firstName: 'Busy', lastName: 'Teacher', department: 'TLE', isActiveForScheduling: true, isStale: false, isPlaceholder: false }, select: { id: true } });
	const navarroId = navarro.id as number;
	const eduardoId = eduardo.id as number;
	const busyId = busy.id as number;

	const navarroFs = await p.facultySubject.create({ data: { facultyId: navarroId, subjectId: tleId, schoolId, schoolYearId, gradeLevels: [8], sectionIds: [87], assignedBy: 1 }, select: { id: true } });
	await p.subjectSectionOwnership.create({ data: { schoolId, schoolYearId, facultySubjectId: navarroFs.id as number, facultyId: navarroId, subjectId: tleId, sectionId: 87 } });

	// Locked sessions: section 87's own classes take Mon–Thu 11:30; teacher 25 is
	// booked at 11:30 every day (in another section, 999) — the live case.
	const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
	for (const day of DAYS) {
		await p.lockedSession.create({ data: { schoolId, schoolYearId, sectionId: 999, subjectId: tleId, facultyId: navarroId, roomId: null, status: 'DRAFT', day, startTime: '11:30', endTime: '12:15', termIndex: 1, createdBy: 1 } });
		if (day !== 'FRIDAY') {
			await p.lockedSession.create({ data: { schoolId, schoolYearId, sectionId: 87, subjectId: tleId, facultyId: null, roomId: null, status: 'DRAFT', day, startTime: '11:30', endTime: '12:15', termIndex: 1, createdBy: 1 } });
		}
	}
	// The would-be replacement who is qualified but booked at the only free slot.
	await p.lockedSession.create({ data: { schoolId, schoolYearId, sectionId: 998, subjectId: tleId, facultyId: busyId, roomId: null, status: 'DRAFT', day: 'FRIDAY', startTime: '11:30', endTime: '12:15', termIndex: 1, createdBy: 1 } });

	// ─── R1: the zero-write preview route ───────────────────────────────────
	section('R1 zero-write preview route');
	const writesBefore = await countWrites(p, schoolId);
	const { baseUrl, close } = await startServer(router);
	const officer = jwt.sign({ userId: 1, role: 'officer', authSource: 'local', schoolId }, JWT_SECRET, { expiresIn: '10m' });
	const foreign = jwt.sign({ userId: 2, role: 'officer', authSource: 'local', schoolId: otherSchoolId }, JWT_SECRET, { expiresIn: '10m' });
	try {
		const noToken = await call(baseUrl, '/api/v1/faculty-assignments/placement-check', 'POST', null, { schoolId, schoolYearId, lines: [{ sectionId: 87, subjectId: tleId, facultyId: navarroId }] });
		assert(noToken.status === 401, `no token is rejected (got ${noToken.status})`);

		const crossSchool = await call(baseUrl, '/api/v1/faculty-assignments/placement-check', 'POST', foreign, { schoolId, schoolYearId, lines: [{ sectionId: 87, subjectId: tleId, facultyId: navarroId }] });
		assert(crossSchool.status === 403 && crossSchool.payload.code === 'SCHOOL_MISMATCH', `cross-school actor is refused (got ${crossSchool.status} ${crossSchool.payload.code})`);

		const check = await call(baseUrl, '/api/v1/faculty-assignments/placement-check', 'POST', officer, { schoolId, schoolYearId, lines: [{ sectionId: 87, subjectId: tleId, facultyId: navarroId }] });
		assert(check.status === 200, `preview route answers 200 (got ${check.status} ${JSON.stringify(check.payload).slice(0, 200)})`);
		const line = check.payload?.lines?.[0];
		assert(line?.placeable === false, 'the Makabansa line is not placeable');
		assert(line?.reason === 'NO_AVAILABLE_SLOT', `the reused reason is NO_AVAILABLE_SLOT (got ${line?.reason})`);
		assert(typeof line?.sentence === 'string' && line.sentence.includes('Grade 8 Makabansa') && line.sentence.includes('TLE Exploratory - ICT'), `the sentence names the section and subject (got ${line?.sentence})`);
		const alternativeIds = (line?.alternatives ?? []).map((a: any) => a.facultyId);
		assert(alternativeIds.includes(eduardoId), `a teacher who fits is offered (got ${JSON.stringify(alternativeIds)})`);
		assert(!alternativeIds.includes(busyId), 'the candidate booked at 11:30 is not offered');
		assert(check.payload?.zeroWrite === true, 'the response declares zeroWrite');

		const writesAfterPreview = await countWrites(p, schoolId);
		assert(sameCounts(writesBefore, writesAfterPreview), `the preview wrote nothing (before ${JSON.stringify(writesBefore)} after ${JSON.stringify(writesAfterPreview)})`);
	} finally {
		await close();
	}

	// ─── R2: the single-assignment save gate ────────────────────────────────
	section('R2 single-assignment save gate');
	const beforeR2 = await countWrites(p, schoolId);
	const { baseUrl: saveUrl, close: closeSave } = await startServer(router);
	try {
		const blocked = await call(saveUrl, `/api/v1/faculty-assignments/${navarroId}`, 'PUT', officer, {
			schoolId, schoolYearId, version: 1, assignments: [{ subjectId: tleId, sectionIds: [87], gradeLevels: [8] }],
		});
		assert(blocked.status === 409, `unplaceable save is a 409 (got ${blocked.status} ${JSON.stringify(blocked.payload).slice(0, 240)})`);
		assert(blocked.payload?.code === 'TEACHING_LOAD_UNPLACEABLE', `the typed code is TEACHING_LOAD_UNPLACEABLE (got ${blocked.payload?.code})`);
		const blocker = blocked.payload?.details?.blockers?.[0];
		assert(Boolean(blocker?.sentence), 'the 409 carries the plain sentence');
		assert(Array.isArray(blocker?.alternatives), 'the 409 carries the alternatives');
		assert(blocker?.sectionName === 'Grade 8 Makabansa' && blocker?.subjectName === 'TLE Exploratory - ICT' && blocker?.facultyName === 'Francis Miguel Navarro', `the blocker names section, subject and teacher (got ${JSON.stringify(blocker)})`);

		const afterR2 = await countWrites(p, schoolId);
		assert(sameCounts(beforeR2, afterR2), `the refused save wrote nothing (before ${JSON.stringify(beforeR2)} after ${JSON.stringify(afterR2)})`);

		// R4: a placeable line still saves.
		const version90 = (await p.facultyMirror.findUnique({ where: { id: eduardoId }, select: { version: true } }))!.version;
		const saved = await call(saveUrl, `/api/v1/faculty-assignments/${eduardoId}`, 'PUT', officer, {
			schoolId, schoolYearId, version: version90, assignments: [{ subjectId: tleId, sectionIds: [90], gradeLevels: [8] }],
		});
		assert(saved.status === 200, `a placeable save succeeds (got ${saved.status} ${JSON.stringify(saved.payload).slice(0, 240)})`);
		const afterR4 = await countWrites(p, schoolId);
		assert(afterR4.facultySubject === beforeR2.facultySubject + 1, `the placeable save created exactly one faculty-subject row (before ${beforeR2.facultySubject} after ${afterR4.facultySubject})`);
	} finally {
		await closeSave();
	}

	// ─── R3: the "Apply suggested" gate ─────────────────────────────────────
	section('R3 apply-suggested gate');
	const plan = {
		policy: { revision: 'a6-test-policy', teachingStandardMinutes: 1200, advisoryCreditMinutes: 0, hardCapMinutes: 1800 },
		retains: [],
		inserts: [{ subjectId: tleId, sectionId: 87, facultyId: navarroId }],
		moves: [],
		summary: { distributionEvaluated: true },
	};
	const proposal = await p.teachingLoadSuggestionProposal.create({
		data: {
			schoolId, schoolYearId, coverageMode: 'BALANCED', status: 'PENDING',
			previewPayload: { distribution: plan, derivedDemandRevision: 'A6R3' } as any,
			suggestedAssignmentCount: 1, unresolvedCount: 0, warningCount: 0, createdBy: 1,
		},
		select: { id: true },
	});
	const beforeR3 = await countWrites(p, schoolId);
	let applyError: any = null;
	try {
		await suggestionService.applyTeachingLoadSuggestionProposal(
			{ proposalId: proposal.id as number, actorId: 1, actorSchoolId: schoolId },
			{
				preview: async () => ({
					coverageMode: 'BALANCED', suggestedRows: [], unresolved: 0, warnings: [],
					sectionSource: null, sectionFallbackReason: null, derivedDemandRevision: 'A6R3',
					distribution: plan,
				}),
				resolveDerivedDemand: async () => ({ ok: true, revision: 'A6R3' }),
			},
		);
	} catch (error: any) {
		applyError = error;
	}
	assert(applyError?.statusCode === 409, `apply is refused with a 409 (got ${applyError?.statusCode ?? 'no error'})`);
	assert(applyError?.code === 'TEACHING_LOAD_UNPLACEABLE', `the typed code is TEACHING_LOAD_UNPLACEABLE (got ${applyError?.code})`);
	assert(Boolean(applyError?.details?.blockers?.[0]?.sentence), 'the refusal carries the plain sentence');
	const afterR3 = await countWrites(p, schoolId);
	assert(sameCounts(beforeR3, afterR3), `the refused apply wrote nothing (before ${JSON.stringify(beforeR3)} after ${JSON.stringify(afterR3)})`);
	const proposalAfter = await p.teachingLoadSuggestionProposal.findUnique({ where: { id: proposal.id as number }, select: { status: true } });
	assert(proposalAfter?.status === 'PENDING', `the pending proposal is left intact (got ${proposalAfter?.status})`);

	// ─── R5: measured one-section check time ────────────────────────────────
	section('R5 one-section check time');
	const started = Date.now();
	await placement.checkTeachingLoadPlacement(schoolId, schoolYearId, [{ sectionId: 87, subjectId: tleId, facultyId: navarroId }]);
	const elapsedMs = Date.now() - started;
	console.log(`[INFO] one-section placement check: ${elapsedMs} ms (blocked case, incl. alternatives)`);
	assert(elapsedMs < 2000, `one section's check is under 2 s (got ${elapsedMs} ms)`);

	// ─── Teardown: zero residue ─────────────────────────────────────────────
	const cleanup = (prismaModule as any).createTestPrismaClient();
	try {
		for (const scoped of [schoolId, otherSchoolId]) {
			await cleanup.auditLog.deleteMany({ where: { schoolId: scoped } });
			await cleanup.lockedSession.deleteMany({ where: { schoolId: scoped } });
			await cleanup.teachingLoadSuggestionProposal.deleteMany({ where: { schoolId: scoped } });
			await cleanup.teachingLoadCycle.deleteMany({ where: { schoolId: scoped } });
			await cleanup.subjectSectionOwnership.deleteMany({ where: { schoolId: scoped } });
			await cleanup.facultySubject.deleteMany({ where: { schoolId: scoped } });
			await cleanup.room.deleteMany({ where: { building: { schoolId: scoped } } });
			await cleanup.building.deleteMany({ where: { schoolId: scoped } });
			await cleanup.facultyMirror.deleteMany({ where: { schoolId: scoped } });
			await cleanup.subject.deleteMany({ where: { schoolId: scoped } });
			await cleanup.sectionMirror.deleteMany({ where: { schoolId: scoped } });
			await cleanup.schedulingPolicy.deleteMany({ where: { schoolId: scoped } });
			await cleanup.enrollProSchoolYearMirror.deleteMany({ where: { schoolId: scoped } });
			await cleanup.school.deleteMany({ where: { id: scoped } });
		}
		const residue =
			(await cleanup.facultySubject.count({ where: { schoolId: { in: [schoolId, otherSchoolId] } } }))
			+ (await cleanup.subjectSectionOwnership.count({ where: { schoolId: { in: [schoolId, otherSchoolId] } } }))
			+ (await cleanup.facultyMirror.count({ where: { schoolId: { in: [schoolId, otherSchoolId] } } }))
			+ (await cleanup.subject.count({ where: { schoolId: { in: [schoolId, otherSchoolId] } } }))
			+ (await cleanup.sectionMirror.count({ where: { schoolId: { in: [schoolId, otherSchoolId] } } }))
			+ (await cleanup.schedulingPolicy.count({ where: { schoolId: { in: [schoolId, otherSchoolId] } } }))
			+ (await cleanup.enrollProSchoolYearMirror.count({ where: { schoolId: { in: [schoolId, otherSchoolId] } } }))
			+ (await cleanup.school.count({ where: { id: { in: [schoolId, otherSchoolId] } } }));
		assert(residue === 0, `zero residue across all fixture-scoped models (found ${residue})`);
	} finally {
		await cleanup.$disconnect();
	}

	await p.$disconnect();
	console.log(`\n=== A6 TL placement write gate ===`);
	console.log(`Total: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
	if (failCount > 0) process.exit(1);
}

function sameCounts(a: Record<string, number>, b: Record<string, number>): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

async function countWrites(p: any, schoolId: number): Promise<Record<string, number>> {
	return {
		facultySubject: await p.facultySubject.count({ where: { schoolId } }),
		subjectSectionOwnership: await p.subjectSectionOwnership.count({ where: { schoolId } }),
		lockedSession: await p.lockedSession.count({ where: { schoolId } }),
		auditLog: await p.auditLog.count({ where: { schoolId } }),
	};
}

main().catch((error) => {
	console.error(`[FAIL] A6 TL placement write-gate test crashed: ${String(error?.message ?? error).slice(0, 400)}`);
	process.exit(1);
});
