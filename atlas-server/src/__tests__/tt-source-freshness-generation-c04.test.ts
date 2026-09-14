/**
 * TT-SOURCE-FRESHNESS-C04 — generation source-snapshot binding (B-03) and
 * ordered-term freshness (B-06) proof.
 *
 * Provisions a disposable PostgreSQL database, seeds the canonical fixture, and
 * exercises the REAL `triggerGenerationRun()` entry point:
 *
 *   1. positive control: the run COMPLETES and the persisted `inputSnapshot`
 *      equals the transaction-verified source snapshot used for computation;
 *   2. room authority, scheduling policy, subject/derived-demand, Teaching Load
 *      ownership, and ordered-term semantic-revision interleaves after the
 *      schedule is computed but before persistence each abort with typed
 *      `SOURCE_AUTHORITY_STALE`, zero COMPLETED timetable, zero success audit,
 *      and zero success notification (FAILED lifecycle only);
 *   3. the ordered-term contract identities/order are part of the fingerprint;
 *   4. run-wide summary fields (`blockingHardViolationCount`, `termCounts`) are
 *      produced by generation and preserved by the manual-edit summary merge.
 *
 * Run: `npx tsx src/__tests__/tt-source-freshness-generation-c04.test.ts`
 * Skips safely when no PostgreSQL DATABASE_URL is configured.
 */

import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import {
	provisionDisposableDatabase,
	seedCanonicalFixture,
	teardownCanonicalFixture,
	isDisposableHarnessAvailable,
	type DisposableDatabase,
	type CanonicalFixture,
} from './helpers/tt-source-freshness-db.js';

process.env.ENROLLPRO_API = 'http://127.0.0.1:1/api';
process.env.ENROLLPRO_CLIENT_URL = 'http://127.0.0.1:1';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'tt-source-freshness-c04-generation-secret';

const RUNNABLE = isDisposableHarnessAvailable();

let harness: DisposableDatabase | null = null;
let prisma: any = null;
let fixture: CanonicalFixture;
let triggerGenerationRun: (schoolId: number, schoolYearId: number, actorId: number, options?: any) => Promise<any>;
let computeGenerationInputSnapshot: (schoolId: number, schoolYearId: number, client?: any) => Promise<any>;
let mergePreservedSummaryFields: (existing: unknown, next: any) => any;
let singleton: any;
let subscribeNotificationEvents: any;

before(async () => {
	if (!RUNNABLE) return;
	harness = provisionDisposableDatabase('gen');
	if (!harness) return;
	process.env.DATABASE_URL = harness.targetUrl;

	const { PrismaClient } = await import('@prisma/client');
	prisma = new PrismaClient({ datasourceUrl: harness.targetUrl });
	await prisma.$connect();

	fixture = await seedCanonicalFixture(prisma, { schoolYearId: 9_100_001, sectionExternalId: 9_101 });

	const snapshotModule = await import('../services/generation-input-snapshot.service.js');
	computeGenerationInputSnapshot = snapshotModule.computeGenerationInputSnapshot as any;
	const generationModule = await import('../services/generation.service.js');
	triggerGenerationRun = generationModule.triggerGenerationRun as any;
	const manualEditModule = await import('../services/manual-edit.service.js');
	mergePreservedSummaryFields = manualEditModule.mergePreservedSummaryFields as any;
	const notificationModule = await import('../services/notification-events.service.js');
	subscribeNotificationEvents = (notificationModule as any).subscribeNotificationEvents;
	const prismaModule = await import('../lib/prisma.js');
	singleton = (prismaModule as any).prisma;
});

after(async () => {
	if (prisma) {
		if (fixture) await teardownCanonicalFixture(prisma, fixture.schoolId);
		await prisma.$disconnect().catch(() => undefined);
	}
	if (harness) {
		harness.drop();
		try {
			harness.assertDropped();
		} catch (error) {
			// surfaced by the caller's assertions; rethrow to fail the run
			throw error;
		}
	}
});

/**
 * Run the real trigger, injecting one persisted mutation through a separate
 * connection immediately before the final Serializable persistence transaction.
 * The patch is consumed once so a retry cannot cascade it.
 */
async function triggerWithInterleave(mutation: (() => Promise<void>) | null): Promise<{ run: any; error: any; notifications: any[]; completedAudits: number }> {
	const schoolId = fixture.schoolId;
	const schoolYearId = fixture.schoolYearId;
	const notifications: any[] = [];
	const unsubscribe = subscribeNotificationEvents({ schoolId, schoolYearId, facultyId: null, send: (event: any) => notifications.push(event) });
	const original = singleton.$transaction.bind(singleton);
	let pending = mutation;
	singleton.$transaction = async (arg: any, opts: any) => {
		if (pending) {
			const current = pending;
			pending = null;
			await current();
		}
		return original(arg, opts);
	};
	let run: any = null;
	let error: any = null;
	try {
		run = await triggerGenerationRun(schoolId, schoolYearId, 1, { enforceShiftWindows: false });
	} catch (caught) {
		error = caught;
	} finally {
		singleton.$transaction = original;
		unsubscribe();
	}
	const completedAudits = await prisma.auditLog.count({ where: { schoolId, action: 'GENERATION_RUN_COMPLETED' } });
	return { run, error, notifications, completedAudits };
}

async function latestRun(): Promise<any> {
	return prisma.generationRun.findFirst({ where: { schoolId: fixture.schoolId }, orderBy: { id: 'desc' } });
}

test('S1. positive control: generation binds the persisted snapshot to the computed source', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	const beforeAudits = await prisma.auditLog.count({ where: { schoolId: fixture.schoolId, action: 'GENERATION_RUN_COMPLETED' } });
	const { run, error, notifications } = await triggerWithInterleave(null);
	assert.equal(error, null, `unexpected generation error: ${error?.code ?? ''} ${error?.message ?? ''}`);
	assert.ok(run, 'the completed run must be returned');
	assert.equal(run.status, 'COMPLETED', 'the positive run completes');
	const persisted = run.summary.inputSnapshot;
	assert.ok(persisted && typeof persisted.fingerprint === 'string', 'the persisted inputSnapshot is present');
	const recomputed = await computeGenerationInputSnapshot(fixture.schoolId, fixture.schoolYearId, prisma);
	assert.equal(persisted.fingerprint, recomputed.fingerprint, 'persisted snapshot fingerprint equals the source snapshot used for computation');

	// Ordered-term parity: every ordered term appears in the resolved entries.
	const terms = new Set<number>((run.draftEntries ?? []).map((entry: any) => entry.termIndex));
	for (const expected of [1, 2, 3]) assert.ok(terms.has(expected), `term ${expected} must be present in the generated entries (no missing term collapsed to Term 1)`);

	const afterAudits = await prisma.auditLog.count({ where: { schoolId: fixture.schoolId, action: 'GENERATION_RUN_COMPLETED' } });
	assert.equal(afterAudits, beforeAudits + 1, 'exactly one success audit is written');
	assert.ok(notifications.some((event) => event.type === 'GENERATION_RUN_COMPLETED'), 'the success notification is emitted');

	// F3: run-wide summary fields exist and survive a partial summary merge.
	assert.equal(typeof run.summary.blockingHardViolationCount, 'number', 'blockingHardViolationCount is produced');
	assert.ok(run.summary.termCounts, 'termCounts is produced');
	const merged = mergePreservedSummaryFields(run.summary, { classesProcessed: 1, assignedCount: 1, unassignedCount: 0, hardViolationCount: 0, violationCounts: {} });
	assert.equal(merged.blockingHardViolationCount, run.summary.blockingHardViolationCount, 'blockingHardViolationCount survives the merge');
	assert.deepEqual(merged.termCounts, run.summary.termCounts, 'termCounts survives the merge');
	assert.equal(merged.inputSnapshot, run.summary.inputSnapshot, 'inputSnapshot survives the merge');
});

const interleaves: Array<[string, () => Promise<void>]> = [
	['rooms', async () => { await prisma.room.create({ data: { buildingId: (await prisma.room.findFirst({ where: { building: { schoolId: fixture.schoolId } } })).buildingId, name: `R-interleave-${Date.now()}`, type: 'CLASSROOM', capacity: 45, isTeachingSpace: true, isSharedFacility: false } }); }],
	['policy', async () => { await prisma.schedulingPolicy.update({ where: { schoolId_schoolYearId: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId } }, data: { periodsPerDay: 9 } }); }],
	['subjects', async () => { await prisma.subject.update({ where: { id: fixture.subjectIdByCode.MATH }, data: { name: `Mathematics ${Date.now()}` } }); }],
	['ownership', async () => {
		const replacement = await prisma.facultyMirror.create({ data: { externalId: 711, schoolId: fixture.schoolId, firstName: 'B', lastName: 'Teacher', department: 'REGULAR', maxHoursPerWeek: 30, isActiveForScheduling: true, isStale: false } });
		const fs = await prisma.facultySubject.create({ data: { facultyId: replacement.id, subjectId: fixture.subjectIdByCode.MATH, schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, gradeLevels: [7], sectionIds: [fixture.sectionExternalId], assignedBy: 1 } });
		await prisma.subjectSectionOwnership.updateMany({ where: { schoolId: fixture.schoolId, subjectId: fixture.subjectIdByCode.MATH }, data: { facultyId: replacement.id, facultySubjectId: fs.id } });
	}],
	['term-revision', async () => {
		const mirror = await prisma.enrollProSchoolYearMirror.findFirst({ where: { schoolId: fixture.schoolId, enrollProSchoolYearId: fixture.schoolYearId } });
		const cache = mirror.termContractCache as any;
		cache.terms = [{ identity: 'T2', displayLabel: 'Second Trimester', order: 1 }, { identity: 'T1', displayLabel: 'First Trimester', order: 2 }, { identity: 'T3', displayLabel: 'Third Trimester', order: 3 }];
		await prisma.enrollProSchoolYearMirror.update({ where: { id: mirror.id }, data: { termContractCache: cache, termContractCachedAt: new Date() } });
	}],
];

for (const [label, mutation] of interleaves) {
	test(`S2. generation rejects a ${label} change after computation with typed SOURCE_AUTHORITY_STALE and no success output`, { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
		const beforeAudits = await prisma.auditLog.count({ where: { schoolId: fixture.schoolId, action: 'GENERATION_RUN_COMPLETED' } });
		const { run, error, notifications } = await triggerWithInterleave(mutation);
		assert.ok(error, `an interleaved ${label} change must reject the run`);
		assert.equal(error.code, 'SOURCE_AUTHORITY_STALE', `${label} interleave must surface the typed stale error`);
		assert.equal(run, null, 'no completed run is returned for a stale source');
		const persisted = await latestRun();
		assert.equal(persisted.status, 'FAILED', `${label} interleave leaves the run FAILED, never COMPLETED`);
		assert.equal(persisted.draftEntries, null, `${label} interleave persists no timetable entries`);
		const afterAudits = await prisma.auditLog.count({ where: { schoolId: fixture.schoolId, action: 'GENERATION_RUN_COMPLETED' } });
		assert.equal(afterAudits, beforeAudits, `${label} interleave writes no success audit`);
		assert.ok(!notifications.some((event) => event.type === 'GENERATION_RUN_COMPLETED'), `${label} interleave emits no success notification`);
	});
}
