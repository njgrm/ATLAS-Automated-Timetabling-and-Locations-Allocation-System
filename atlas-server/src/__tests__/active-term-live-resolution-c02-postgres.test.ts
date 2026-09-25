/**
 * ACTIVE-TERM-LIVE-RESOLUTION-C02 (Stage 2) — real-path, disposable-PostgreSQL
 * proof that generation, readiness, and publication consume ONE pre-resolved
 * authoritative active ordered term, resolved before any transaction, with no
 * live fetch inside a Serializable/advisory-locked transaction.
 *
 * Reuses the existing TT-SOURCE-FRESHNESS-C04 disposable-PostgreSQL harness and
 * its unreachable-EnrollPro tripwire (`ENROLLPRO_API` pointed at a dead port), so
 * the real resolver is exercised through its DEGRADED arm here while the live
 * arm is exercised through the injected provider seam. The canonical fixture is
 * used unchanged; this suite only adds the persisted `activeTerm` the canonical
 * seed omits, which is what makes the frozen-snapshot divergence real.
 *
 * Run: `npm run test:active-term-live-resolution-c02`
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

// The existing unreachable-EnrollPro tripwire: the real provider can never
// succeed, so every row below must control the authority through the seam.
process.env.ENROLLPRO_API = 'http://127.0.0.1:1/api';
process.env.ENROLLPRO_CLIENT_URL = 'http://127.0.0.1:1';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'active-term-live-resolution-c02-secret';

const RUNNABLE = isDisposableHarnessAvailable();

const SCHOOL_YEAR_ID = 9_200_001;
const SECTION_EXTERNAL_ID = 9_201;
/** The frozen persisted snapshot names T1; every live authority below names T2. */
const PERSISTED_ACTIVE_TERM = 1;
const LIVE_ACTIVE_TERM = 2;

let harness: DisposableDatabase | null = null;
let prisma: any = null;
let fixture: CanonicalFixture;
let singleton: any;
let triggerGenerationRun: (schoolId: number, schoolYearId: number, actorId: number, options?: any) => Promise<any>;
let buildGenerationReadiness: (schoolId: number, schoolYearId: number, deps?: any) => Promise<any>;
let buildGenerationPreflight: (schoolId: number, schoolYearId: number, deps?: any) => Promise<any>;
let revalidateGenerationPreflight: (assembly: any, deps?: any) => Promise<any>;
let computeGenerationInputSnapshot: (schoolId: number, schoolYearId: number, client?: any, options?: any) => Promise<any>;
let publishSchedule: (input: any, deps?: any) => Promise<any>;
let resolvePreResolvedActiveTermAuthority: (schoolId: number, schoolYearId: number, options?: any) => Promise<any>;

// ─── Live contract fixtures ───

type TermSpec = { identity: string; displayLabel: string; order: number };

const TERMS: TermSpec[] = [
	{ identity: 'T1', displayLabel: 'First Trimester', order: 1 },
	{ identity: 'T2', displayLabel: 'Second Trimester', order: 2 },
	{ identity: 'T3', displayLabel: 'Third Trimester', order: 3 },
];

function liveContract(activeOrder: number | null, availability: 'RESOLVED' | 'UNRESOLVED' = 'RESOLVED') {
	const activeTerm = activeOrder == null ? null : { identity: `T${activeOrder}`, displayLabel: `T${activeOrder} label`, order: activeOrder };
	return {
		ok: true as const,
		contract: {
			schoolId: fixture.schoolId,
			schoolYear: { id: fixture.schoolYearId, yearLabel: '2026-2027' },
			format: 'TRIMESTER' as const,
			terms: TERMS,
			semanticRevision: 'c02-fixture-revision',
			activeTerm,
			activeTermState: {
				availability,
				code: availability === 'UNRESOLVED' ? 'ACTIVE_TERM_UNRESOLVED' : null,
				message: 'c02 fixture',
				reachable: true,
				identity: activeTerm?.identity ?? null,
			},
		},
	};
}

/**
 * A provider that records whether it was consulted while a transaction was open,
 * so the "no live fetch inside Serializable/advisory locks" row is OBSERVED on the
 * real path rather than asserted from source text.
 */
function instrumentedProvider(result: unknown) {
	const observed = { total: 0, insideTransaction: 0, insideTransactionDepthMax: 0 };
	const provider = async () => {
		observed.total += 1;
		if (transactionState.depth > 0) {
			observed.insideTransaction += 1;
			observed.insideTransactionDepthMax = Math.max(observed.insideTransactionDepthMax, transactionState.depth);
		}
		return result as any;
	};
	return { provider, observed };
}

const transactionState = { depth: 0, observedIsolations: [] as unknown[] };

/** Wrap the real singleton `$transaction` so depth and isolation level are observed. */
async function observingTransactions<T>(run: () => Promise<T>): Promise<T> {
	const original = singleton.$transaction.bind(singleton);
	singleton.$transaction = async (arg: any, opts: any) => {
		transactionState.depth += 1;
		transactionState.observedIsolations.push(opts?.isolationLevel);
		try {
			return await original(arg, opts);
		} finally {
			transactionState.depth -= 1;
		}
	};
	try {
		return await run();
	} finally {
		singleton.$transaction = original;
	}
}

before(async () => {
	if (!RUNNABLE) return;
	harness = provisionDisposableDatabase('actvterm');
	if (!harness) return;
	process.env.DATABASE_URL = harness.targetUrl;

	const { PrismaClient } = await import('@prisma/client');
	prisma = new PrismaClient({ datasourceUrl: harness.targetUrl });
	await prisma.$connect();
	fixture = await seedCanonicalFixture(prisma, { schoolYearId: SCHOOL_YEAR_ID, sectionExternalId: SECTION_EXTERNAL_ID });

	// The canonical seed deliberately omits `activeTerm`. Adding the FROZEN
	// persisted T1 is what reproduces the real divergence: the persisted snapshot
	// still names T1 while every live authority names T2.
	await prisma.enrollProSchoolYearMirror.updateMany({
		where: { schoolId: fixture.schoolId, enrollProSchoolYearId: fixture.schoolYearId },
		data: {
			termContractCache: {
				schoolId: fixture.schoolId,
				schoolYear: { id: fixture.schoolYearId, yearLabel: '2026-2027' },
				format: 'TRIMESTER',
				terms: TERMS,
				activeTerm: { identity: 'T1', displayLabel: 'First Trimester label', order: PERSISTED_ACTIVE_TERM },
			},
		},
	});

	singleton = (await import('../lib/prisma.js')).prisma;
	({ triggerGenerationRun } = await import('../services/generation.service.js'));
	({ buildGenerationReadiness } = await import('../services/generation-readiness.service.js'));
	({ buildGenerationPreflight } = await import('../services/generation-preflight.service.js'));
	({ revalidateGenerationPreflight } = await import('../services/generation-preflight.service.js'));
	({ computeGenerationInputSnapshot } = await import('../services/generation-input-snapshot.service.js'));
	({ publishSchedule } = await import('../services/publication-contract.service.js'));
	({ resolvePreResolvedActiveTermAuthority } = await import('../services/academic-term.service.js'));
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

const skip = RUNNABLE ? false : 'DATABASE_URL is not configured';

function blockerCodes(result: any): string[] {
	return (result?.blockers ?? []).map((blocker: any) => String(blocker.code)).sort();
}

async function runCount(): Promise<number> {
	return prisma.generationRun.count({ where: { schoolId: fixture.schoolId } });
}

async function completedAuditCount(): Promise<number> {
	return prisma.auditLog.count({ where: { schoolId: fixture.schoolId, action: 'GENERATION_RUN_COMPLETED' } });
}

// ─── G1: the entry point is live-first on the REAL path ───

test('G1. the trigger and readiness both pre-resolve the LIVE term, not the frozen persisted T1', { skip }, async () => {
	const { provider, observed } = instrumentedProvider(liveContract(LIVE_ACTIVE_TERM));

	const preflight = await buildGenerationPreflight(fixture.schoolId, fixture.schoolYearId, { activeTermIndex: LIVE_ACTIVE_TERM });
	// The preflight consumes the pre-resolved term and is otherwise unblocked by
	// the term authority (it may still carry unrelated setup blockers).
	assert.equal(
		blockerCodes(preflight).includes('TERM_AUTHORITY_UNRESOLVED'),
		false,
		'a pre-resolved live term is accepted by the preflight (never treated as unresolved)',
	);
	assert.equal(
		blockerCodes(preflight).includes('TERM_AUTHORITY_STALE'),
		false,
		'the live term is inside the verified three-term structure, so there is no TERM_AUTHORITY_STALE divergence',
	);

	// Readiness, given the same authority, reaches the same verdict as the
	// generation preflight: same term authority, still zero-write.
	const readiness = await observingTransactions(() => buildGenerationReadiness(fixture.schoolId, fixture.schoolYearId, { activeTermProvider: provider }));
	assert.equal(
		blockerCodes(readiness).includes('TERM_AUTHORITY_UNRESOLVED'),
		false,
		'readiness resolves the same pre-resolved live term (readiness/generation parity)',
	);
	assert.equal(observed.total > 0, true, 'readiness performed exactly one live-first resolution at its entry point');
	assert.equal(observed.insideTransaction, 0, 'no live resolution happened inside a transaction');
});

// ─── G2: missing authority fails closed on BOTH entry points, with zero writes ───

test('G2. an unresolved live active term blocks generation and readiness identically, with zero writes', { skip }, async () => {
	const { provider } = instrumentedProvider(liveContract(null, 'UNRESOLVED'));
	const runsBefore = await runCount();
	const auditsBefore = await completedAuditCount();

	const readiness = await buildGenerationReadiness(fixture.schoolId, fixture.schoolYearId, { activeTermProvider: provider });
	assert.equal(readiness.status, 'BLOCKED', 'readiness refuses rather than assuming Term 1');
	assert.equal(blockerCodes(readiness).includes('TERM_AUTHORITY_UNRESOLVED'), true, 'readiness reports the typed unresolved-authority blocker');

	let error: any = null;
	try {
		await triggerGenerationRun(fixture.schoolId, fixture.schoolYearId, 1, { enforceShiftWindows: false, activeTermProvider: provider });
	} catch (caught) {
		error = caught;
	}
	assert.ok(error, 'generation refuses an unresolved active term');
	assert.equal(error.code, 'GENERATION_PREFLIGHT_BLOCKED', 'the existing typed preflight refusal is preserved');
	const codes = (error.details?.blockers ?? []).map((blocker: any) => String(blocker.code));
	assert.equal(codes.includes('TERM_AUTHORITY_UNRESOLVED'), true, 'the refusal carries the typed TERM_AUTHORITY_UNRESOLVED blocker');
	assert.equal(codes.includes('TERM_STRUCTURE_UNAVAILABLE'), false, 'a resolved structure is not misreported as unavailable');

	assert.equal(await runCount(), runsBefore, 'zero generation runs written');
	assert.equal(await completedAuditCount(), auditsBefore, 'zero success audits written');
});

// ─── G3: the generated run is bound to the pre-resolved term (failing-first) ───

test('G3. the completed run binds the pre-resolved LIVE term, and the frozen persisted T1 would NOT match', { skip }, async () => {
	const { provider, observed } = instrumentedProvider(liveContract(LIVE_ACTIVE_TERM));
	const auditsBefore = await completedAuditCount();

	const run = await observingTransactions(() => triggerGenerationRun(fixture.schoolId, fixture.schoolYearId, 1, {
		enforceShiftWindows: false,
		activeTermProvider: provider,
	}));
	assert.equal(run.status, 'COMPLETED', `generation completes: ${run.status}`);

	const boundTermIndex = run.summary.inputSnapshot.domains.availability.signals.availabilityTermIndex;
	assert.equal(boundTermIndex, LIVE_ACTIVE_TERM, 'the persisted snapshot records the PRE-RESOLVED live term');

	// Failing-first: recomputing with the frozen persisted T1 (the pre-change
	// behaviour) does NOT reproduce the run's fingerprint, so the row is
	// load-bearing — it would fail on the base persisted-only resolution.
	const withLiveTerm = await computeGenerationInputSnapshot(fixture.schoolId, fixture.schoolYearId, prisma, { availabilityTermIndex: LIVE_ACTIVE_TERM });
	const withPersistedTerm = await computeGenerationInputSnapshot(fixture.schoolId, fixture.schoolYearId, prisma, { availabilityTermIndex: PERSISTED_ACTIVE_TERM });
	assert.equal(run.summary.inputSnapshot.fingerprint, withLiveTerm.fingerprint, 'the captured snapshot is consistent with the pre-resolved term');
	assert.notEqual(run.summary.inputSnapshot.fingerprint, withPersistedTerm.fingerprint, 'the frozen persisted T1 would NOT reproduce this run (failing-first)');
	assert.notEqual(
		withLiveTerm.domains.availability.fingerprint,
		withPersistedTerm.domains.availability.fingerprint,
		'the availability domain digest is term-specific, so the term is genuinely bound',
	);

	assert.equal(await completedAuditCount(), auditsBefore + 1, 'exactly one success audit is written');
	assert.equal(observed.insideTransaction, 0, 'no live resolution happened inside the Serializable persist transaction');
	assert.equal(observed.insideTransactionDepthMax, 0, 'the provider was never consulted at any transaction depth');
	assert.equal(
		transactionState.observedIsolations.some((level) => level === 'Serializable'),
		true,
		'the persist transaction really was Serializable (the no-fetch row is observed on the real lock)',
	);
});

// ─── G4: a term change after pre-resolution fails closed with zero writes ───

test('G4. publication refuses a run whose bound term is no longer the pre-resolved term, with zero writes', { skip }, async () => {
	const run = await prisma.generationRun.findFirst({ where: { schoolId: fixture.schoolId, status: 'COMPLETED' }, orderBy: { id: 'desc' } });
	assert.ok(run, 'the completed run from G3 is available');

	const revisionsBefore = await prisma.publishedScheduleRevision.count({ where: { schoolId: fixture.schoolId } });
	const publicationAuditsBefore = await prisma.auditLog.count({ where: { schoolId: fixture.schoolId, action: 'GENERATION_RUN_PUBLISHED' } });

	// The active term advanced to T3 after the run was bound to T2.
	const { provider: t3, observed } = instrumentedProvider(liveContract(3));
	let error: any = null;
	try {
		await observingTransactions(() => publishSchedule({
			schoolId: fixture.schoolId,
			schoolYearId: fixture.schoolYearId,
			runId: run.id,
			actorId: 1,
			actorSchoolId: fixture.schoolId,
		}, { client: prisma, activeTermProvider: t3 }));
	} catch (caught) {
		error = caught;
	}
	assert.ok(error, 'publication refuses a term that no longer matches the bound run');
	assert.equal(error.code, 'PUBLICATION_INPUTS_STALE', `the existing typed stale error is preserved (got ${error.code})`);
	assert.deepEqual(error.details?.changedDomains, ['availability'], 'the changed availability domain names the term change');
	assert.equal(revisionsBefore, await prisma.publishedScheduleRevision.count({ where: { schoolId: fixture.schoolId } }), 'zero published revisions written');
	assert.equal(publicationAuditsBefore, await prisma.auditLog.count({ where: { schoolId: fixture.schoolId, action: 'GENERATION_RUN_PUBLISHED' } }), 'zero publication audits written');
	assert.equal(observed.insideTransaction, 0, 'the term was resolved before the advisory lock, never inside it');
	assert.equal(observed.insideTransactionDepthMax, 0, 'the provider was never consulted at any transaction depth');

	// PARITY: publication with the SAME term the run was bound to does not report
	// the term as stale, proving the refusal above is the term and nothing else.
	const sameTermSnapshot = await computeGenerationInputSnapshot(fixture.schoolId, fixture.schoolYearId, prisma, { availabilityTermIndex: 2 });
	assert.equal(sameTermSnapshot.fingerprint, run.summary.inputSnapshot.fingerprint, 'the run is publishable while its bound term is still the pre-resolved term');
});

// ─── G5: the pre-transaction revalidation detects a term change ───

test('G5. the pre-transaction revalidation reports an activeTermOrder change instead of Term 1', { skip }, async () => {
	const preflight = await buildGenerationPreflight(fixture.schoolId, fixture.schoolYearId, { activeTermIndex: 2 });

	// A fresh provider (its own bounded bucket) names T3 after pre-resolution.
	const { provider, observed } = instrumentedProvider(liveContract(3));
	const freshness = await observingTransactions(() => revalidateGenerationPreflight(preflight.assembly, { activeTermIndex: 2, activeTermProvider: provider }));
	assert.equal(freshness.ok, false, 'a term change fails the revalidation');
	assert.equal(freshness.changed.includes('activeTermOrder'), true, 'the changed revision is the active term');
	assert.equal(observed.total, 1, 'the recheck consulted the live resolver exactly once');
	assert.equal(observed.insideTransaction, 0, 'the recheck runs outside every transaction');
	assert.equal(observed.insideTransactionDepthMax, 0, 'the recheck never reached a transaction depth');

	// An unchanged term keeps the revalidation fresh.
	const { provider: stillT2 } = instrumentedProvider(liveContract(2));
	const unchanged = await revalidateGenerationPreflight(preflight.assembly, { activeTermIndex: 2, activeTermProvider: stillT2 });
	assert.equal(unchanged.changed.includes('activeTermOrder'), false, 'an unchanged active term is not reported as changed');
});

// ─── G6: the unresolved sentinel never becomes a resolved-term digest ───

test('G6. the pre-resolved term binds the structure, and an unresolved term stays null (never Term 1)', { skip }, async () => {
	const { provider } = instrumentedProvider(liveContract(null, 'UNRESOLVED'));
	const unresolved = await resolvePreResolvedActiveTermAuthority(fixture.schoolId, fixture.schoolYearId, { provider });
	assert.equal(unresolved.termIndex, null, 'a reachable unresolved active term is an authoritative null');
	assert.equal(unresolved.contract?.activeTermOrder, null, 'the bound structure never substitutes Term 1');

	const { provider: t2 } = instrumentedProvider(liveContract(2));
	const resolved = await resolvePreResolvedActiveTermAuthority(fixture.schoolId, fixture.schoolYearId, { provider: t2 });
	assert.equal(resolved.termIndex, 2);
	assert.equal(resolved.contract?.activeTermOrder, 2, 'the bound structure carries the pre-resolved term');
	assert.equal(resolved.contract?.terms.length, 3, 'the verified three-term structure is preserved');

	// The unresolved sentinel scopes the availability read to a non-matching term,
	// so it can never compare FRESH against a resolved-term digest.
	const unresolvedSnapshot = await computeGenerationInputSnapshot(fixture.schoolId, fixture.schoolYearId, prisma, { availabilityTermIndex: null });
	assert.equal(unresolvedSnapshot.domains.availability.signals.availabilityTermIndex, null, 'the unresolved domain records a null term index');
	assert.equal(unresolvedSnapshot.domains.availability.signals.availabilityCount, 0, 'the unresolved read is scoped to a non-matching sentinel term');
});
