import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { Prisma, PrismaClient } from '@prisma/client';

import { withDataContext } from '../lib/data-context.js';
import type { GenerationInputSnapshot } from '../services/generation-input-snapshot.service.js';
import { publishSchedule } from '../services/publication-contract.service.js';
import { createPublishedScheduleRevision } from '../services/published-revision.service.js';
import { runSerializablePublicationTransaction } from '../services/serializable-transaction-retry.js';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const DATABASE_NAME = DATABASE_URL ? new URL(DATABASE_URL).pathname.replace(/^\//, '') : '';
const EXPECTED_DATABASE = process.env.PUBC01R_DISPOSABLE_DATABASE ?? '';
const NOW = new Date('2030-01-02T03:04:05.000Z');
const INT32_OVERFLOW = 2_147_483_648;

type ServiceFailure = Error & { code?: string; statusCode?: number; meta?: { code?: string } };

function requireDisposableTarget(): void {
	assert.match(DATABASE_NAME, /^atlas_restore_drill_[0-9]{8}_[a-z0-9]+$/);
	assert.equal(DATABASE_NAME, EXPECTED_DATABASE, 'DATABASE_URL must match the approved disposable target');
}

function snapshot(schoolId: number, schoolYearId: number, fingerprint = 'fixture-input-v1'): GenerationInputSnapshot {
	const domain = { fingerprint: 'fixture-domain-v1', signals: {} };
	return {
		schemaVersion: 2,
		schoolId,
		schoolYearId,
		computedAt: NOW.toISOString(),
		fingerprint,
		domains: {
			teachingLoad: domain,
			policy: domain,
			rooms: domain,
			sections: domain,
			subjects: domain,
			derivedDemand: domain,
		},
	};
}

async function expectCode(operation: () => Promise<unknown>, code: string): Promise<ServiceFailure> {
	try {
		await operation();
		assert.fail(`${code}: request unexpectedly succeeded`);
	} catch (error) {
		const failure = error as ServiceFailure;
		assert.equal(failure.code, code, `${code}: typed error code`);
		assert.ok((failure.statusCode ?? 0) >= 400 && (failure.statusCode ?? 0) < 500, `${code}: typed 4xx status`);
		return failure;
	}
}

async function expectSqlState42883(client: PrismaClient, sql: string): Promise<void> {
	await assert.rejects(
		() => client.$executeRawUnsafe(sql, 17, 19),
		(error: ServiceFailure) => error.code === 'P2010' && error.meta?.code === '42883',
		`${sql}: removing either cast must reproduce SQLSTATE 42883`,
	);
}

async function proveRetryBoundary(): Promise<void> {
	let attempts = 0;
	const eventualClient = {
		$transaction: async (work: (tx: Prisma.TransactionClient) => Promise<string>) => {
			attempts += 1;
			if (attempts < 3) throw Object.assign(new Error('serialization conflict'), { code: 'P2034' });
			return work({} as Prisma.TransactionClient);
		},
	} as unknown as PrismaClient;
	assert.equal(await runSerializablePublicationTransaction(eventualClient, async () => 'committed'), 'committed');
	assert.equal(attempts, 3, 'serialization conflict retries the whole transaction up to success');

	attempts = 0;
	const typed = Object.assign(new Error('typed application failure'), { code: 'SOURCE_REVISION_STALE', statusCode: 409 });
	const applicationFailureClient = {
		$transaction: async () => {
			attempts += 1;
			throw typed;
		},
	} as unknown as PrismaClient;
	await assert.rejects(
		() => runSerializablePublicationTransaction(applicationFailureClient, async () => undefined),
		(error) => error === typed,
	);
	assert.equal(attempts, 1, 'typed application errors never retry');

	attempts = 0;
	const exhaustedClient = {
		$transaction: async () => {
			attempts += 1;
			throw Object.assign(new Error('serialization conflict'), { meta: { code: '40001' } });
		},
	} as unknown as PrismaClient;
	await assert.rejects(
		() => runSerializablePublicationTransaction(exhaustedClient, async () => undefined),
		(error: ServiceFailure) => error.code === 'PUBLICATION_TRANSACTION_CONFLICT' && error.statusCode === 409,
	);
	assert.equal(attempts, 3, 'serialization conflict retry is bounded to three total attempts');
}

async function waitForWaiters(observer: PrismaClient, expected: number): Promise<number> {
	const deadline = Date.now() + 5_000;
	let count = 0;
	do {
		const rows = await observer.$queryRawUnsafe<Array<{ count: number }>>(
			`SELECT count(*)::int AS count
			 FROM pg_stat_activity
			 WHERE datname = current_database()
			   AND pid <> pg_backend_pid()
			   AND wait_event_type = 'Lock'
			   AND query LIKE 'SELECT pg_advisory_xact_lock%'`,
		);
		count = Number(rows[0]?.count ?? 0);
		if (count >= expected) return count;
		await new Promise((resolve) => setTimeout(resolve, 20));
	} while (Date.now() < deadline);
	assert.fail(`database-visible barrier observed ${count}/${expected} waiters`);
}

async function overlapBehindLock<T>(
	schoolId: number,
	schoolYearId: number,
	operations: Array<() => Promise<T>>,
	ordered = false,
): Promise<{ waiterCount: number; results: Array<PromiseSettledResult<T>> }> {
	const blocker = new PrismaClient();
	const observer = new PrismaClient();
	let acquiredResolve!: () => void;
	let release!: () => void;
	const acquired = new Promise<void>((resolve) => { acquiredResolve = resolve; });
	const released = new Promise<void>((resolve) => { release = resolve; });
	const blockerTransaction = blocker.$transaction(async (tx) => {
		await tx.$executeRawUnsafe(
			'SELECT pg_advisory_xact_lock($1::integer, $2::integer)',
			schoolId,
			schoolYearId,
		);
		acquiredResolve();
		await released;
	}, { timeout: 10_000 });

	try {
		await acquired;
		const pending: Array<Promise<T>> = [];
		pending.push(operations[0]());
		if (ordered) await waitForWaiters(observer, 1);
		for (const operation of operations.slice(1)) pending.push(operation());
		const resultsPromise = Promise.allSettled(pending);
		const waiterCount = await waitForWaiters(observer, operations.length);
		release();
		await blockerTransaction;
		return { waiterCount, results: await resultsPromise };
	} finally {
		release();
		await blockerTransaction.catch(() => undefined);
		await Promise.all([blocker.$disconnect(), observer.$disconnect()]);
	}
}

function requireFulfilled<T>(result: PromiseSettledResult<T>, label: string): T {
	if (result.status === 'rejected') {
		const failure = result.reason as ServiceFailure;
		assert.fail(`${label} rejected: ${failure.code ?? failure.name}: ${failure.message}`);
	}
	return result.value;
}

function requireRejectedCode<T>(result: PromiseSettledResult<T>, code: string): ServiceFailure {
	assert.equal(result.status, 'rejected', `${code}: request must reject`);
	const failure = result.reason as ServiceFailure;
	assert.equal(failure.code, code, `${code}: typed error code`);
	return failure;
}

async function main(): Promise<void> {
	requireDisposableTarget();
	const queryEvents: Prisma.QueryEvent[] = [];
	const prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
	prisma.$on('query', (event) => { queryEvents.push(event); });
	const control = new PrismaClient();
	const schoolYearId = 981_002;
	const actorId = 771_002;
	let schoolId = 0;
	let runId = 0;
	const publicationEvents: unknown[] = [];
	const revisionEvents: unknown[] = [];

	try {
		await proveRetryBoundary();
		await expectSqlState42883(control, 'SELECT pg_advisory_xact_lock($1::integer, $2)');
		await expectSqlState42883(control, 'SELECT pg_advisory_xact_lock($1, $2::integer)');
		await control.$transaction((tx) => tx.$executeRawUnsafe(
			'SELECT pg_advisory_xact_lock($1::integer, $2::integer)',
			17,
			19,
		));

		const serviceSources = await Promise.all([
			readFile(new URL('../services/publication-contract.service.ts', import.meta.url), 'utf8'),
			readFile(new URL('../services/published-revision.service.ts', import.meta.url), 'utf8'),
		]);
		for (const source of serviceSources) {
			assert.match(source, /pg_advisory_xact_lock\(\$1::integer, \$2::integer\)/);
			assert.doesNotMatch(source, /pg_advisory_xact_lock\(`|pg_advisory_xact_lock\('\s*\+/);
		}

		const school = await prisma.school.create({ data: { name: 'PUB-C01R2 Disposable School', shortName: 'PUBC01R2' } });
		schoolId = school.id;
		const fixtureTermCache = {
			schoolId,
			schoolYear: { id: schoolYearId, yearLabel: 'Disposable 2030-2031' },
			format: 'TRIMESTER' as const,
			terms: [
				{ identity: 'T1', displayLabel: 'T1', order: 1 },
				{ identity: 'T2', displayLabel: 'T2', order: 2 },
				{ identity: 'T3', displayLabel: 'T3', order: 3 },
			],
		};
		await prisma.enrollProSchoolYearMirror.create({
			data: {
				schoolId,
				enrollProSchoolYearId: schoolYearId,
				yearLabel: 'Disposable 2030-2031',
				isActive: true,
				isArchived: false,
				lastSyncedAt: NOW,
				termContractCache: fixtureTermCache,
				termContractCachedAt: NOW,
			},
		});
		await prisma.schoolYearTermConfig.create({
			data: { schoolId, schoolYearId, termCount: 3, termIdentities: ['T1', 'T2', 'T3'], isActive: true, createdBy: actorId },
		});
		const inputSnapshot = snapshot(schoolId, schoolYearId);
		const run = await prisma.generationRun.create({
			data: {
				schoolId,
				schoolYearId,
				status: 'COMPLETED',
				runType: 'FULL',
				triggeredBy: actorId,
				finishedAt: NOW,
				summary: { inputSnapshot },
				violations: [],
				unassignedItems: [],
				draftEntries: [{ entryId: 'fixture-entry-1', termIndex: 1, roomId: 30, facultyId: 40 }],
				version: 1,
			},
		});
		runId = run.id;

		const publishInput = { schoolId, schoolYearId, runId, actorId, actorSchoolId: schoolId };
		const publish = () => withDataContext(prisma, () => publishSchedule(publishInput, {
			now: () => NOW,
			computeInputSnapshot: async () => inputSnapshot,
			publishEvent: (event) => { publicationEvents.push(event); },
		}));

		for (const [input, code] of [
			[{ ...publishInput, schoolId: INT32_OVERFLOW }, 'INVALID_SCHOOL_ID'],
			[{ ...publishInput, schoolYearId: INT32_OVERFLOW }, 'INVALID_SCHOOL_YEAR_ID'],
		] as const) {
			const lockQueriesBefore = queryEvents.filter((event) => event.query.includes('pg_advisory_xact_lock')).length;
			await expectCode(() => withDataContext(prisma, () => publishSchedule(input, { computeInputSnapshot: async () => inputSnapshot })), code);
			assert.equal(queryEvents.filter((event) => event.query.includes('pg_advisory_xact_lock')).length, lockQueriesBefore, `${code}: no raw lock SQL`);
		}
		for (const [input, code] of [
			[{ schoolId: INT32_OVERFLOW, schoolYearId, sourceRunId: runId }, 'INVALID_SCHOOL_ID'],
			[{ schoolId, schoolYearId: INT32_OVERFLOW, sourceRunId: runId }, 'INVALID_SCHOOL_YEAR_ID'],
		] as const) {
			const lockQueriesBefore = queryEvents.filter((event) => event.query.includes('pg_advisory_xact_lock')).length;
			await expectCode(() => withDataContext(prisma, () => createPublishedScheduleRevision(input)), code);
			assert.equal(queryEvents.filter((event) => event.query.includes('pg_advisory_xact_lock')).length, lockQueriesBefore, `${code}: no raw lock SQL`);
		}

		const initial = await overlapBehindLock(schoolId, schoolYearId, [publish, publish]);
		const initialResults = initial.results.map((result, index) => requireFulfilled(result, `initial publication ${index + 1}`));
		assert.equal(initial.waiterCount, 2);
		assert.deepEqual(initialResults.map((result) => result.replayed).sort(), [false, true]);
		assert.equal(new Set(initialResults.map((result) => result.revisionId)).size, 1);
		assert.equal(new Set(initialResults.map((result) => result.auditId)).size, 1);
		assert.equal(publicationEvents.length, 1);
		const baseRevisionId = initialResults[0].revisionId;
		const initialCounts = {
			revisions: await prisma.publishedScheduleRevision.count({ where: { schoolId, schoolYearId, sourceRunId: runId } }),
			audits: await prisma.auditLog.count({ where: { schoolId, schoolYearId, action: 'GENERATION_RUN_PUBLISHED' } }),
		};
		assert.deepEqual(initialCounts, { revisions: 1, audits: 1 });

		const firstRevisionInput = {
			schoolId,
			schoolYearId,
			sourceRunId: runId,
			sourceRevisionId: baseRevisionId,
			actorId,
			effectiveDate: '2030-01-03T00:00:00.000Z',
			reason: 'PUB-C01R2 concurrent revision',
			changes: [{ entryId: 'fixture-entry-1', previous: { roomId: 30, termIndex: 1 }, next: { roomId: 31, termIndex: 1 } }],
		};
		const revise = () => withDataContext(prisma, () => createPublishedScheduleRevision(firstRevisionInput, {
			now: NOW,
			publishEvent: (event) => { revisionEvents.push(event); },
		}));
		const revisions = await overlapBehindLock(schoolId, schoolYearId, [revise, revise]);
		const revisionResults = revisions.results.map((result, index) => requireFulfilled(result, `revision ${index + 1}`));
		assert.equal(revisions.waiterCount, 2);
		assert.deepEqual(revisionResults.map((result) => result.replayed).sort(), [false, true]);
		assert.equal(new Set(revisionResults.map((result) => result.revision.id)).size, 1);
		assert.equal(new Set(revisionResults.map((result) => result.auditId)).size, 1);
		assert.equal(revisionEvents.length, 1);
		const firstRevisionId = revisionResults[0].revision.id;
		const revisionCounts = {
			revisions: await prisma.publishedScheduleRevision.count({ where: { schoolId, schoolYearId, sourceRunId: runId } }),
			audits: await prisma.auditLog.count({ where: { schoolId, schoolYearId, action: 'PUBLISHED_SCHEDULE_REVISION_CREATED' } }),
		};
		assert.deepEqual(revisionCounts, { revisions: 2, audits: 1 });

		const advanceInput = {
			...firstRevisionInput,
			sourceRevisionId: firstRevisionId,
			effectiveDate: '2030-01-04T00:00:00.000Z',
			reason: 'PUB-C01R2 winning revision',
			changes: [{ entryId: 'fixture-entry-1', previous: { roomId: 31, termIndex: 1 }, next: { roomId: 32, termIndex: 1 } }],
		};
		const staleInput = {
			...advanceInput,
			effectiveDate: '2030-01-05T00:00:00.000Z',
			reason: 'PUB-C01R2 stale competing revision',
			changes: [{ entryId: 'fixture-entry-1', previous: { roomId: 31, termIndex: 1 }, next: { roomId: 33, termIndex: 1 } }],
		};
		let staleNotificationAttempts = 0;
		const stale = await overlapBehindLock(schoolId, schoolYearId, [
			() => withDataContext(prisma, () => createPublishedScheduleRevision(advanceInput, { now: NOW, publishEvent: () => { staleNotificationAttempts += 1; } })),
			() => withDataContext(prisma, () => createPublishedScheduleRevision(staleInput, { now: NOW, publishEvent: () => { staleNotificationAttempts += 1; } })),
		], true);
		const advanced = requireFulfilled(stale.results[0], 'winning revision');
		const staleFailure = requireRejectedCode(stale.results[1], 'SOURCE_REVISION_STALE');
		const staleCounts = {
			revisions: await prisma.publishedScheduleRevision.count({ where: { schoolId, schoolYearId, sourceRunId: runId } }),
			audits: await prisma.auditLog.count({ where: { schoolId, schoolYearId, action: 'PUBLISHED_SCHEDULE_REVISION_CREATED' } }),
			notificationAttempts: staleNotificationAttempts,
		};
		assert.deepEqual(staleCounts, { revisions: 3, audits: 2, notificationAttempts: 1 });

		async function counts() {
			return {
				revisions: await prisma.publishedScheduleRevision.count({ where: { schoolId, schoolYearId } }),
				audits: await prisma.auditLog.count({ where: { schoolId, schoolYearId } }),
			};
		}
		async function zeroWriteGuard(operation: () => Promise<unknown>, code: string) {
			const before = await counts();
			const failure = await expectCode(operation, code);
			assert.deepEqual(await counts(), before, `${code}: zero database writes`);
			return failure;
		}

		const crossSchool = await zeroWriteGuard(
			() => withDataContext(prisma, () => publishSchedule({ ...publishInput, actorSchoolId: schoolId + 1 }, { computeInputSnapshot: async () => inputSnapshot })),
			'CROSS_SCHOOL_DENIED',
		);
		await prisma.enrollProSchoolYearMirror.updateMany({ where: { schoolId, enrollProSchoolYearId: schoolYearId }, data: { isActive: false } });
		const inactiveYear = await zeroWriteGuard(publish, 'ACTIVE_SCHOOL_YEAR_UNAVAILABLE');
		await prisma.enrollProSchoolYearMirror.updateMany({ where: { schoolId, enrollProSchoolYearId: schoolYearId }, data: { isActive: true } });
		const secondYear = await prisma.enrollProSchoolYearMirror.create({
			data: { schoolId, enrollProSchoolYearId: schoolYearId + 1, yearLabel: 'Ambiguous fixture year', isActive: true, isArchived: false, lastSyncedAt: NOW },
		});
		const ambiguousYear = await zeroWriteGuard(publish, 'ACTIVE_SCHOOL_YEAR_AMBIGUOUS');
		await prisma.enrollProSchoolYearMirror.delete({ where: { id: secondYear.id } });
		await prisma.enrollProSchoolYearMirror.updateMany({ where: { schoolId, enrollProSchoolYearId: schoolYearId }, data: { termContractCache: Prisma.JsonNull } });
		const invalidTerms = await zeroWriteGuard(publish, 'PUBLICATION_TERM_CONTRACT_INVALID');
		await prisma.enrollProSchoolYearMirror.updateMany({ where: { schoolId, enrollProSchoolYearId: schoolYearId }, data: { termContractCache: fixtureTermCache, termContractCachedAt: NOW } });

		const staleRun = await prisma.generationRun.create({
			data: {
				schoolId,
				schoolYearId,
				status: 'COMPLETED',
				runType: 'FULL',
				triggeredBy: actorId,
				finishedAt: NOW,
				summary: { inputSnapshot: snapshot(schoolId, schoolYearId, 'stale-input') },
				violations: [],
				unassignedItems: [],
				draftEntries: [{ entryId: 'stale-entry', termIndex: 1 }],
			},
		});
		const staleFingerprint = await zeroWriteGuard(
			() => withDataContext(prisma, () => publishSchedule({ ...publishInput, runId: staleRun.id }, { now: () => NOW, computeInputSnapshot: async () => inputSnapshot })),
			'PUBLICATION_INPUTS_STALE',
		);
		const causalDate = await zeroWriteGuard(
			() => withDataContext(prisma, () => createPublishedScheduleRevision({
				...advanceInput,
				sourceRevisionId: advanced.revision.id,
				effectiveDate: '2030-01-03T12:00:00.000Z',
				reason: 'PUB-C01R2 invalid causal date',
				changes: [{ entryId: 'fixture-entry-1', previous: { roomId: 32, termIndex: 1 }, next: { roomId: 34, termIndex: 1 } }],
			}, { now: NOW })),
			'REVISION_EFFECTIVE_DATE_BEFORE_SOURCE',
		);

		const productionLockEvents = queryEvents.filter((event) => event.query.includes('pg_advisory_xact_lock'));
		assert.ok(productionLockEvents.length >= 2, 'both production services execute advisory lock SQL');
		assert.ok(productionLockEvents.every((event) => event.query.includes('$1::integer') && event.query.includes('$2::integer')));
		assert.ok(productionLockEvents.every((event) => {
			const parameters = JSON.parse(event.params) as unknown[];
			return parameters.length === 2 && parameters[0] === schoolId && parameters[1] === schoolYearId;
		}), 'production advisory locks retain two bound scope parameters');

		console.log(JSON.stringify({
			disposableDatabase: DATABASE_NAME,
			lockContract: {
				signature: 'pg_advisory_xact_lock($1::integer, $2::integer)',
				productionQueryCount: productionLockEvents.length,
				parametersBound: true,
				missingFirstCastSqlstate: '42883',
				missingSecondCastSqlstate: '42883',
				int32OverflowCodes: ['INVALID_SCHOOL_ID', 'INVALID_SCHOOL_YEAR_ID'],
			},
			initialPublication: {
				waiterCount: initial.waiterCount,
				results: initialResults.map(({ revisionId, auditId, replayed, notificationDelivery }) => ({ revisionId, auditId, replayed, notificationDelivery })),
				databaseCounts: initialCounts,
				notificationAttempts: publicationEvents.length,
			},
			revisionConcurrency: {
				waiterCount: revisions.waiterCount,
				results: revisionResults.map(({ revision, auditId, replayed, notificationDelivery }) => ({ revisionId: revision.id, auditId, replayed, notificationDelivery })),
				databaseCounts: revisionCounts,
				notificationAttempts: revisionEvents.length,
			},
			staleTokenConcurrency: {
				waiterCount: stale.waiterCount,
				winningRevisionId: advanced.revision.id,
				staleCode: staleFailure.code,
				databaseCounts: staleCounts,
			},
			guards: {
				crossSchool: crossSchool.code,
				inactiveYear: inactiveYear.code,
				ambiguousYear: ambiguousYear.code,
				invalidTerms: invalidTerms.code,
				staleFingerprint: staleFingerprint.code,
				causalEffectiveDate: causalDate.code,
				zeroWrites: true,
			},
		}, null, 2));
	} finally {
		await Promise.all([prisma.$disconnect(), control.$disconnect()]);
	}
}

main().catch((error: ServiceFailure) => {
	console.error(JSON.stringify({
		status: 'FAIL',
		code: error.code ?? null,
		name: error.name,
		message: error.message,
	}, null, 2));
	process.exitCode = 1;
});
