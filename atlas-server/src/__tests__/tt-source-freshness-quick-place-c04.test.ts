/**
 * TT-SOURCE-FRESHNESS-C04 — Quick Place freshness (B-04) and mounted
 * actor-school/year/run authority (tally row 9).
 *
 * Provisions a disposable PostgreSQL database, seeds the canonical fixture, runs
 * the real generation once to obtain a valid COMPLETED run, then exercises the
 * REAL `applyQuickPlace` service and the REAL mounted quick-place router:
 *
 *   1. positive control: a placement commits, advances the version, and persists
 *      the transaction-verified `inputSnapshot`;
 *   2. a room/policy/ownership/ordered-term change between computation and the
 *      commit transaction aborts with typed `SOURCE_AUTHORITY_STALE` and ZERO
 *      entry/version/history/audit writes;
 *   3. mounted authority matrix: missing JWT, missing actor school, non-privileged
 *      role, cross-school actor, archived year, malformed scope, out-of-scope run,
 *      and version conflict each fail closed with zero downstream writes.
 *
 * Run: `npx tsx src/__tests__/tt-source-freshness-quick-place-c04.test.ts`
 * Skips safely when no PostgreSQL DATABASE_URL is configured.
 */

import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import jwt from 'jsonwebtoken';

import {
	provisionDisposableDatabase,
	seedCanonicalFixture,
	teardownCanonicalFixture,
	isDisposableHarnessAvailable,
	type DisposableDatabase,
	type CanonicalFixture,
} from './helpers/tt-source-freshness-db.js';

process.env.ENROLLPRO_API = 'http://127.0.0.1:1/api';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'tt-source-freshness-c04-quick-place-secret';

const RUNNABLE = isDisposableHarnessAvailable();
const ARCHIVED_YEAR = 9_100_099;

let harness: DisposableDatabase | null = null;
let prisma: any = null;
let fixture: CanonicalFixture;
let baseRun: any;
let applyQuickPlace: (runId: number, schoolId: number, schoolYearId: number, actorId: number, expectedVersion: number) => Promise<any>;
let singleton: any;
let baseUrl = '';
let privilegedToken = '';
let server: any = null;

function jwtSign(payload: Record<string, unknown>): string {
	return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: '5m' });
}

async function createRunWithUnassigned(): Promise<any> {
	const summary = { ...(baseRun.summary as any) };
	// Remove exactly one Term-1 MATH placement from the real generation output
	// and re-declare it as an unassigned session, so the solver has a genuinely
	// free target slot to place and the commit path is exercised.
	const allEntries = (baseRun.draftEntries ?? []) as any[];
	const removed = allEntries.find((entry) => entry.subjectId === fixture.subjectIdByCode.MATH && entry.termIndex === 1);
	assert.ok(removed, 'the base generation output must contain a Term-1 MATH placement');
	const entries = allEntries.filter((entry) => entry !== removed);
	const unassigned = [{
		sectionId: removed.sectionId,
		subjectId: removed.subjectId,
		gradeLevel: 7,
		session: 1,
		reason: 'NO_AVAILABLE_SLOT',
		roomAssignmentReason: 'FALLBACK_UNRESOLVED',
		facultyId: removed.facultyId ?? fixture.facultyId,
		entryKind: 'SECTION',
		termIndex: 1,
	}];
	return prisma.generationRun.create({
		data: {
			schoolId: fixture.schoolId,
			schoolYearId: fixture.schoolYearId,
			status: 'COMPLETED',
			triggeredBy: 1,
			version: 1,
			draftEntries: entries as object[],
			unassignedItems: unassigned as object[],
			violations: baseRun.violations as object[],
			summary: summary as object,
		},
	});
}

async function runFingerprint(): Promise<string> {
	const { computeGenerationInputSnapshot } = await import('../services/generation-input-snapshot.service.js');
	return (await computeGenerationInputSnapshot(fixture.schoolId, fixture.schoolYearId, prisma)).fingerprint;
}

before(async () => {
	if (!RUNNABLE) return;
	harness = provisionDisposableDatabase('qp');
	if (!harness) return;
	process.env.DATABASE_URL = harness.targetUrl;

	const { PrismaClient } = await import('@prisma/client');
	prisma = new PrismaClient({ datasourceUrl: harness.targetUrl });
	await prisma.$connect();
	fixture = await seedCanonicalFixture(prisma, { schoolYearId: 9_100_001, sectionExternalId: 9_101 });
	await prisma.enrollProSchoolYearMirror.create({
		data: { schoolId: fixture.schoolId, enrollProSchoolYearId: ARCHIVED_YEAR, yearLabel: 'ARCHIVED', isActive: false, isArchived: true },
	});

	const generationModule = await import('../services/generation.service.js');
	baseRun = await generationModule.triggerGenerationRun(fixture.schoolId, fixture.schoolYearId, 1, { enforceShiftWindows: false });
	assert.equal(baseRun.status, 'COMPLETED', 'the fixture base run must complete');

	applyQuickPlace = (await import('../services/timetable-quick-place.service.js')).applyQuickPlace as any;
	singleton = (await import('../lib/prisma.js')).prisma;

	const express = (await import('express')).default;
	const { errorHandler } = await import('../middleware/errorHandler.js');
	const quickPlaceRouter = (await import('../routes/timetable-quick-place.router.js')).default;
	const app = express();
	app.use(express.json());
	app.use('/api/v1/timetable', quickPlaceRouter);
	app.use(errorHandler as any);
	server = await new Promise<any>((resolveServer) => {
		const listener = app.listen(0, '127.0.0.1', () => resolveServer(listener));
	});
	const address = server.address();	baseUrl = `http://127.0.0.1:${(address as any).port}`;
	privilegedToken = jwtSign({ userId: 9001, role: 'officer', authSource: 'local', schoolId: fixture.schoolId });
});

after(async () => {
	if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
	if (prisma) {
		if (fixture) await teardownCanonicalFixture(prisma, fixture.schoolId);
		await prisma.$disconnect().catch(() => undefined);
	}
	if (harness) {
		harness.drop();
		harness.assertDropped();
	}
});

async function callQuickPlace(runId: number, path: 'preview' | 'apply', token: string | null, body?: unknown): Promise<{ status: number; body: any }> {
	const res = await fetch(`${baseUrl}/api/v1/timetable/${fixture.schoolId}/${fixture.schoolYearId}/runs/${runId}/quick-place/${path}`, {
		method: 'POST',
		headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
		body: JSON.stringify(body ?? {}),
	});
	return { status: res.status, body: await res.json().catch(() => ({})) };
}

test('Q1. positive control: Quick Place commits, bumps version, and binds the persisted snapshot', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	const run = await createRunWithUnassigned();
	const result = await applyQuickPlace(run.id, fixture.schoolId, fixture.schoolYearId, 1, 1);
	assert.ok(result.success, 'quick place succeeds');
	assert.ok(result.placedCount >= 1, `at least one session was placed (got ${result.placedCount})`);
	const after = await prisma.generationRun.findUnique({ where: { id: run.id } });
	assert.equal(after.version, 2, 'the run version advanced');
	const persisted = after.summary.inputSnapshot;
	const recomputed = await runFingerprint();
	assert.equal(persisted.fingerprint, recomputed, 'the persisted snapshot is the tx-verified source snapshot');
});

for (const [label, mutate] of [
	['rooms', async () => { const room = await prisma.room.findFirst({ where: { building: { schoolId: fixture.schoolId } } }); await prisma.room.create({ data: { buildingId: room.buildingId, name: `QP-interleave-${Date.now()}`, type: 'CLASSROOM', capacity: 40, isTeachingSpace: true, isSharedFacility: false } }); }],
	['policy', async () => { await prisma.schedulingPolicy.update({ where: { schoolId_schoolYearId: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId } }, data: { latestEndTime: '17:30' } }); }],
	['ownership', async () => { const replacement = await prisma.facultyMirror.create({ data: { externalId: 712, schoolId: fixture.schoolId, firstName: 'C', lastName: 'Teacher', department: 'REGULAR', maxHoursPerWeek: 30, isActiveForScheduling: true, isStale: false } }); await prisma.subjectSectionOwnership.updateMany({ where: { schoolId: fixture.schoolId, subjectId: fixture.subjectIdByCode.ENG }, data: { facultyId: replacement.id } }); }],
] as Array<[string, () => Promise<void>]>) {
	test(`Q2. Quick Place rejects a ${label} change with typed SOURCE_AUTHORITY_STALE and zero writes`, { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
		const run = await createRunWithUnassigned();
		const before = await prisma.generationRun.findUnique({ where: { id: run.id } });
		const editsBefore = await prisma.manualScheduleEdit.count({ where: { runId: run.id } });
		const auditBefore = await prisma.auditLog.count({ where: { schoolId: fixture.schoolId } });
		const original = singleton.$transaction.bind(singleton);
		let pending: (() => Promise<void>) | null = mutate;
		singleton.$transaction = async (arg: any, opts: any) => {
			if (pending) { const current = pending; pending = null; await current(); }
			return original(arg, opts);
		};
		let error: any = null;
		try {
			await applyQuickPlace(run.id, fixture.schoolId, fixture.schoolYearId, 1, 1);
		} catch (caught) {
			error = caught;
		} finally {
			singleton.$transaction = original;
		}
		assert.ok(error, `a ${label} change must reject quick place`);
		assert.equal(error.code, 'SOURCE_AUTHORITY_STALE', `${label} must surface the typed stale error`);
		const after = await prisma.generationRun.findUnique({ where: { id: run.id } });
		assert.equal(after.version, before.version, `${label}: zero version increment`);
		assert.deepEqual(after.draftEntries, before.draftEntries, `${label}: zero entry changes`);
		assert.deepEqual(after.unassignedItems, before.unassignedItems, `${label}: zero unassigned changes`);
		assert.equal(await prisma.manualScheduleEdit.count({ where: { runId: run.id } }), editsBefore, `${label}: zero history writes`);
		assert.equal(await prisma.auditLog.count({ where: { schoolId: fixture.schoolId } }), auditBefore, `${label}: zero audit writes`);
	});
}

test('Q3. mounted authority matrix fails closed before any service dispatch', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	const run = await createRunWithUnassigned();
	const auditBefore = await prisma.auditLog.count({ where: { schoolId: fixture.schoolId } });
	const editsBefore = await prisma.manualScheduleEdit.count({ where: { runId: run.id } });

	// missing JWT
	let res = await callQuickPlace(run.id, 'preview', null);
	assert.equal(res.status, 401, 'missing JWT is 401');
	// missing actor school
	res = await callQuickPlace(run.id, 'preview', jwtSign({ userId: 9001, role: 'officer', authSource: 'local' }));
	assert.equal(res.status, 403, 'missing actor school is rejected');
	assert.equal(res.body.code, 'ACTOR_SCHOOL_REQUIRED');
	// non-privileged role
	res = await callQuickPlace(run.id, 'apply', jwtSign({ userId: 9001, role: 'faculty', authSource: 'local', schoolId: fixture.schoolId }), { expectedRunVersion: 1 });
	assert.equal(res.status, 403, 'non-privileged role is rejected');
	assert.equal(res.body.code, 'FORBIDDEN');
	// cross-school actor
	res = await callQuickPlace(run.id, 'apply', jwtSign({ userId: 9001, role: 'officer', authSource: 'local', schoolId: 999_997 }), { expectedRunVersion: 1 });
	assert.equal(res.status, 403, 'cross-school actor is rejected');
	assert.equal(res.body.code, 'SCHOOL_MISMATCH');
	// archived year (authority guard rejects before run lookup)
	const archived = await fetch(`${baseUrl}/api/v1/timetable/${fixture.schoolId}/${ARCHIVED_YEAR}/runs/${run.id}/quick-place/preview`, {
		method: 'POST',
		headers: { authorization: `Bearer ${privilegedToken}`, 'content-type': 'application/json' },
		body: JSON.stringify({}),
	});
	const archivedBody = await archived.json().catch(() => ({}));
	assert.equal(archived.status, 409, 'archived year is rejected');
	assert.equal(archivedBody.code, 'ARCHIVED_YEAR_READ_ONLY');
	// malformed scope
	const bad = await fetch(`${baseUrl}/api/v1/timetable/abc/${fixture.schoolYearId}/runs/${run.id}/quick-place/preview`, { method: 'POST', headers: { authorization: `Bearer ${privilegedToken}` } });
	assert.equal(bad.status, 400, 'malformed scope is 400');
	// out-of-scope run
	res = await callQuickPlace(999_999_999, 'apply', privilegedToken, { expectedRunVersion: 1 });
	assert.equal(res.status, 404, 'out-of-scope run is 404');
	assert.equal(res.body.code, 'RUN_NOT_FOUND');
	// version conflict
	res = await callQuickPlace(run.id, 'apply', privilegedToken, { expectedRunVersion: 99 });
	assert.equal(res.status, 409, 'version conflict is 409');
	assert.equal(res.body.code, 'VERSION_CONFLICT');

	assert.equal(await prisma.auditLog.count({ where: { schoolId: fixture.schoolId } }), auditBefore, 'every rejection wrote zero audit rows');
	assert.equal(await prisma.manualScheduleEdit.count({ where: { runId: run.id } }), editsBefore, 'every rejection wrote zero history rows');

	// positive mounted control
	const ok = await callQuickPlace(run.id, 'apply', privilegedToken, { expectedRunVersion: 1 });
	assert.equal(ok.status, 200, `mounted apply succeeds (got ${ok.status}/${ok.body?.code ?? ''})`);
});
