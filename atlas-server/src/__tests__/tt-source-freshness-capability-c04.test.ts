/**
 * TT-SOURCE-FRESHNESS-C04 — capability-override Serializable transaction
 * assertion (requirement §3.10).
 *
 * The production `applyCapabilityOverride` opens its write boundary with
 * `{ isolationLevel: 'Serializable' }`. This control OBSERVES the exact
 * transaction option on BOTH a successful apply and a stale-source rejection,
 * using a real disposable PostgreSQL fixture. Removing `Serializable` from the
 * production transaction makes these assertions fail (load-bearing mutant).
 *
 * Run: `npx tsx src/__tests__/tt-source-freshness-capability-c04.test.ts`
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

const RUNNABLE = isDisposableHarnessAvailable();
const CONFIRMATION = 'APPLY CAPABILITY OVERRIDE';

let harness: DisposableDatabase | null = null;
let prisma: any = null;
let fixture: CanonicalFixture;
let singleton: any;
let previewCapabilityOverride: (input: any) => Promise<any>;
let applyCapabilityOverride: (input: any) => Promise<any>;

before(async () => {
	if (!RUNNABLE) return;
	harness = provisionDisposableDatabase('cap');
	if (!harness) return;
	process.env.DATABASE_URL = harness.targetUrl;

	const { PrismaClient } = await import('@prisma/client');
	prisma = new PrismaClient({ datasourceUrl: harness.targetUrl });
	await prisma.$connect();
	fixture = await seedCanonicalFixture(prisma, { schoolYearId: 9_100_001, sectionExternalId: 9_101 });

	const facultyAssignment = await import('../services/faculty-assignment.service.js');
	previewCapabilityOverride = (facultyAssignment as any).previewCapabilityOverride;
	applyCapabilityOverride = (facultyAssignment as any).applyCapabilityOverride;
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

/** Record every transaction option observed while invoking `run`. */
async function observeTransactionOptions(run: () => Promise<void>): Promise<any[]> {
	const observed: any[] = [];
	const original = singleton.$transaction.bind(singleton);
	singleton.$transaction = async (arg: any, opts: any) => {
		observed.push(opts);
		return original(arg, opts);
	};
	try {
		await run();
	} finally {
		singleton.$transaction = original;
	}
	return observed;
}

const mutation = () => ({ action: 'SET', facultyId: fixture.facultyId, subjectCode: 'MATH', specializationCode: null, specializationLabel: null, note: null });

test('P1. a successful capability-override apply observes { isolationLevel: Serializable }', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	const preview = await previewCapabilityOverride({ actorSchoolId: fixture.schoolId, schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, mutation: mutation() });
	const observed = await observeTransactionOptions(async () => {
		await applyCapabilityOverride({
			actorSchoolId: fixture.schoolId,
			actorId: 1,
			schoolId: fixture.schoolId,
			schoolYearId: fixture.schoolYearId,
			mutation: mutation(),
			expectedFingerprint: preview.fingerprint,
			expectedSourceRevision: preview.sourceRevision,
			confirmationText: CONFIRMATION,
		});
	});
	assert.equal(observed.length, 1, 'exactly one apply transaction is opened');
	assert.equal(observed[0]?.isolationLevel, 'Serializable', 'the successful apply transaction is Serializable');
});

test('P2. a stale-source capability-override rejection also observes { isolationLevel: Serializable }', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	const preview = await previewCapabilityOverride({ actorSchoolId: fixture.schoolId, schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, mutation: { action: 'SET', facultyId: fixture.facultyId, subjectCode: 'ENG', specializationCode: null, specializationLabel: null, note: null } });
	// Interleave: an unrelated policy write changes the source revision.
	const policy = await prisma.schedulingPolicy.findFirst({ where: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId } });
	await prisma.schedulingPolicy.update({ where: { id: policy.id }, data: { constraintConfig: { ...(policy.constraintConfig as object ?? {}), __interleave: true } } });

	let error: any = null;
	const observed = await observeTransactionOptions(async () => {
		try {
			await applyCapabilityOverride({
				actorSchoolId: fixture.schoolId,
				actorId: 1,
				schoolId: fixture.schoolId,
				schoolYearId: fixture.schoolYearId,
				mutation: { action: 'SET', facultyId: fixture.facultyId, subjectCode: 'ENG', specializationCode: null, specializationLabel: null, note: null },
				expectedFingerprint: preview.fingerprint,
				expectedSourceRevision: preview.sourceRevision,
				confirmationText: CONFIRMATION,
			});
		} catch (caught) {
			error = caught;
		}
	});
	assert.ok(error, 'the stale-source apply rejects');
	assert.ok(['CAPABILITY_OVERRIDE_SOURCE_DRIFT', 'FINGERPRINT_MISMATCH'].includes(error.code), `typed stale rejection (got ${error.code})`);
	assert.equal(observed.length, 1, 'exactly one apply transaction is opened before the rejection');
	assert.equal(observed[0]?.isolationLevel, 'Serializable', 'the stale-rejecting transaction is also Serializable');
});
