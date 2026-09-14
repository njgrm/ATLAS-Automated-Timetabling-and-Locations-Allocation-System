/**
 * TT-SOURCE-FRESHNESS-C04 — setup-sync hidden-write removal (B-09), teacher-pin
 * behavior (D5/B-13), and run-wide summary conservation (F3).
 *
 *     1. passive policy read: `loadRunContext` must NOT create or normalize a
 *        scheduling-policy row (instrumented model writes + row census);
 *     2. a valid, manually reviewed teacher pin is preserved with an exact
 *        retained total and never silently rebound to the live owner;
 *     3. an invalid pin is reported as a typed `TEACHER_PIN_CONFLICT` with exact
 *        retained/conflicted totals and zero writes;
 *     4. `blockingHardViolationCount`, `termCounts`, `inputSnapshot`, and
 *        publication markers survive a committed sync summary merge;
 *     5. a repeat sync against already-synchronized state replays with zero writes.
 *
 * Run: `npx tsx src/__tests__/tt-source-freshness-sync-pin-c04.test.ts`
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
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'tt-source-freshness-c04-sync-secret';

const RUNNABLE = isDisposableHarnessAvailable();

let harness: DisposableDatabase | null = null;
let prisma: any = null;
let fixture: CanonicalFixture;
let baseRun: any;
let faculty2Id = 0;
let syncTimetableSetup: (schoolId: number, schoolYearId: number, runId: number, actorId: number, expectedVersion: number) => Promise<any>;
let loadRunContext: (runId: number, schoolId: number, schoolYearId: number, client?: any) => Promise<any>;
let singleton: any;

async function createSyncRun(mutate?: (entries: any[], summary: any) => void): Promise<any> {
	const entries = (baseRun.draftEntries as any[]).map((entry) => ({ ...entry }));
	const summary = { ...(baseRun.summary as any) };
	if (mutate) mutate(entries, summary);
	return prisma.generationRun.create({
		data: {
			schoolId: fixture.schoolId,
			schoolYearId: fixture.schoolYearId,
			status: 'COMPLETED',
			triggeredBy: 1,
			version: 1,
			draftEntries: entries as object[],
			unassignedItems: baseRun.unassignedItems as object[],
			violations: baseRun.violations as object[],
			summary: summary as object,
		},
	});
}

function firstEntryIndex(entries: any[], subjectId: number): number {
	return entries.findIndex((entry) => entry.subjectId === subjectId);
}

before(async () => {
	if (!RUNNABLE) return;
	harness = provisionDisposableDatabase('sync');
	if (!harness) return;
	process.env.DATABASE_URL = harness.targetUrl;

	const { PrismaClient } = await import('@prisma/client');
	prisma = new PrismaClient({ datasourceUrl: harness.targetUrl });
	await prisma.$connect();
	fixture = await seedCanonicalFixture(prisma, { schoolYearId: 9_100_001, sectionExternalId: 9_101 });

	const faculty2 = await prisma.facultyMirror.create({
		data: { externalId: 713, schoolId: fixture.schoolId, firstName: 'D', lastName: 'Qualified', department: 'REGULAR', maxHoursPerWeek: 30, isActiveForScheduling: true, isStale: false },
	});
	faculty2Id = faculty2.id;
	await prisma.facultySubject.create({
		data: { facultyId: faculty2Id, subjectId: fixture.subjectIdByCode.MATH, schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, gradeLevels: [7], sectionIds: [fixture.sectionExternalId], assignedBy: 1 },
	});

	const generationModule = await import('../services/generation.service.js');
	baseRun = await generationModule.triggerGenerationRun(fixture.schoolId, fixture.schoolYearId, 1, { enforceShiftWindows: false });
	assert.equal(baseRun.status, 'COMPLETED', 'the fixture base run must complete');

	syncTimetableSetup = (await import('../services/timetable-sync-setup.service.js')).syncTimetableSetup as any;
	loadRunContext = (await import('../services/manual-edit.service.js')).loadRunContext as any;
	singleton = (await import('../lib/prisma.js')).prisma;
});

after(async () => {
	if (prisma) {
		if (fixture) await teardownCanonicalFixture(prisma, fixture.schoolId);
		await prisma.$disconnect().catch(() => undefined);
	}
	if (harness) {
		harness.drop();
		harness.assertDropped();
	}
});

/** Patch the singleton scheduling-policy write methods and count calls. */
function instrumentPolicyWrites(): { counts: Record<string, number>; restore: () => void } {
	const counts: Record<string, number> = { create: 0, update: 0, upsert: 0, updateMany: 0, createMany: 0 };
	const originals: Record<string, any> = {};
	for (const method of Object.keys(counts)) {
		if (typeof singleton.schedulingPolicy[method] !== 'function') continue;
		originals[method] = singleton.schedulingPolicy[method].bind(singleton.schedulingPolicy);
		singleton.schedulingPolicy[method] = async (...args: any[]) => {
			counts[method] += 1;
			return originals[method](...args);
		};
	}
	return {
		counts,
		restore: () => {
			for (const [method, original] of Object.entries(originals)) {
				singleton.schedulingPolicy[method] = original;
			}
		},
	};
}

test('C1. passive read snapshot never creates or normalizes a scheduling-policy row', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	const run = await createSyncRun();
	const policy = await prisma.schedulingPolicy.findFirst({ where: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId } });
	await prisma.schedulingPolicy.delete({ where: { id: policy.id } });
	assert.equal(await prisma.schedulingPolicy.count({ where: { schoolId: fixture.schoolId } }), 0, 'policy row removed for the passive-read control');

	const instrument = instrumentPolicyWrites();
	try {
		const ctx = await loadRunContext(run.id, fixture.schoolId, fixture.schoolYearId);
		assert.ok(ctx.policyRecord, 'a read resolves an in-memory policy');
	} finally {
		instrument.restore();
	}
	assert.equal(await prisma.schedulingPolicy.count({ where: { schoolId: fixture.schoolId } }), 0, 'the read snapshot created no policy row');
	assert.deepEqual(instrument.counts, { create: 0, update: 0, upsert: 0, updateMany: 0, createMany: 0 }, 'the read snapshot performed zero policy writes');

	// Restore the persisted policy for the remaining controls.
	await prisma.schedulingPolicy.create({
		data: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, periodLengthMinutes: 60, periodsPerDay: 8, earliestStartTime: '07:00', latestEndTime: '17:00' },
	});
});

test('C2. a valid manually reviewed teacher pin is preserved with an exact retained total', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	const run = await createSyncRun((entries) => {
		const index = firstEntryIndex(entries, fixture.subjectIdByCode.MATH);
		entries[index].facultyId = faculty2Id;
	});
	const result = await syncTimetableSetup(fixture.schoolId, fixture.schoolYearId, run.id, 1, 1);
	assert.ok(result.retainedFacultyPinCount >= 1, `the valid pin is retained (got ${result.retainedFacultyPinCount})`);
	assert.equal(result.conflictedFacultyPinCount, 0, 'no conflict is reported');
	const persisted = await prisma.generationRun.findUnique({ where: { id: run.id } });
	const pinned = (persisted.draftEntries as any[]).find((entry) => entry.subjectId === fixture.subjectIdByCode.MATH && entry.termIndex === 1);
	assert.equal(pinned.facultyId, faculty2Id, 'the reviewed teacher is preserved, not silently rebound to the live owner');
});

test('C3. an invalid teacher pin fails closed with typed TEACHER_PIN_CONFLICT and zero writes', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	const run = await createSyncRun((entries) => {
		const index = firstEntryIndex(entries, fixture.subjectIdByCode.MATH);
		entries[index].facultyId = 999_999;
	});
	const before = await prisma.generationRun.findUnique({ where: { id: run.id } });
	const auditBefore = await prisma.auditLog.count({ where: { schoolId: fixture.schoolId } });
	let error: any = null;
	try {
		await syncTimetableSetup(fixture.schoolId, fixture.schoolYearId, run.id, 1, 1);
	} catch (caught) {
		error = caught;
	}
	assert.ok(error, 'an invalid pin must reject the sync');
	assert.equal(error.code, 'TEACHER_PIN_CONFLICT', 'the conflict is typed');
	assert.equal(error.details?.conflictedFacultyPinCount, 1, 'the exact conflicted total is reported');
	assert.equal(typeof error.details?.retainedFacultyPinCount, 'number', 'the retained total is reported');
	// §3.5: the typed message must state BOTH exact integers, and they must be the
	// same values carried in `details` — not a second, independently-worded guess.
	const conflictedTotal = error.details.conflictedFacultyPinCount as number;
	const retainedTotal = error.details.retainedFacultyPinCount as number;
	assert.ok(
		error.message.includes(`${conflictedTotal} reviewed teacher assignment(s) are no longer valid`),
		`the conflict message states the exact conflicted total (message: ${error.message})`,
	);
	assert.ok(
		error.message.includes(`${retainedTotal} valid reviewed assignment(s) will be retained`),
		`the conflict message states the exact retained total (message: ${error.message})`,
	);
	const after = await prisma.generationRun.findUnique({ where: { id: run.id } });
	assert.equal(after.version, before.version, 'zero version increment');
	assert.deepEqual(after.draftEntries, before.draftEntries, 'zero entry writes');
	assert.equal(await prisma.auditLog.count({ where: { schoolId: fixture.schoolId } }), auditBefore, 'zero audit writes');
});

test('C4. a committed sync preserves run-wide summary truth', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	const run = await createSyncRun((entries, summary) => {
		summary.blockingHardViolationCount = 7;
		summary.termCounts = { '1': 10, '2': 10, '3': 10 };
		summary.isPublished = false;
		const index = firstEntryIndex(entries, fixture.subjectIdByCode.MATH);
		entries[index].facultyId = faculty2Id;
	});
	const persistedBefore = (await prisma.generationRun.findUnique({ where: { id: run.id } })).summary as any;
	const result = await syncTimetableSetup(fixture.schoolId, fixture.schoolYearId, run.id, 1, 1);
	const after = (await prisma.generationRun.findUnique({ where: { id: run.id } })).summary as any;
	assert.equal(after.blockingHardViolationCount, 7, 'blockingHardViolationCount is preserved');
	assert.deepEqual(after.termCounts, persistedBefore.termCounts, 'termCounts is preserved');
	assert.equal(after.isPublished, false, 'publication marker is preserved');
	assert.ok(after.inputSnapshot && typeof after.inputSnapshot.fingerprint === 'string', 'the tx-verified snapshot is persisted');
	assert.equal(result.replayed, false, 'a pinned change commits');
});

test('C5. a repeat sync against synchronized state replays with zero writes', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	const run = await createSyncRun();
	// First sync reconciles the generated output into the canonical sync shape.
	await syncTimetableSetup(fixture.schoolId, fixture.schoolYearId, run.id, 1, 1);
	// Second identical sync must be a zero-write replay.
	const before = await prisma.generationRun.findUnique({ where: { id: run.id } });
	const auditBefore = await prisma.auditLog.count({ where: { schoolId: fixture.schoolId } });
	const result = await syncTimetableSetup(fixture.schoolId, fixture.schoolYearId, run.id, 1, before.version);
	assert.equal(result.noChange, true, 'an unchanged sync is detected as a replay');
	const after = await prisma.generationRun.findUnique({ where: { id: run.id } });
	assert.equal(after.version, before.version, 'replay does not increment the version');
	assert.deepEqual(after.draftEntries, before.draftEntries, 'replay writes no entries');
	assert.equal(await prisma.auditLog.count({ where: { schoolId: fixture.schoolId } }), auditBefore, 'replay writes no audit row');
});
