import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import jwt from 'jsonwebtoken';

import { withDataContext } from '../lib/data-context.js';
import { publishSchedule } from '../services/publication-contract.service.js';
import { resolvePublishedRun } from '../services/published-schedule.service.js';
import { createPublishedScheduleRevision, resolveLatestPublishedSourceRevision } from '../services/published-revision.service.js';
import { computeGenerationInputSnapshot } from '../services/generation-input-snapshot.service.js';
import type { GenerationInputSnapshot } from '../services/generation-input-snapshot.service.js';

const ROOT = new URL('../', import.meta.url);
const FIXED_NOW = new Date('2030-01-02T03:04:05.000Z');

function snapshot(fingerprint = 'current'): GenerationInputSnapshot {
	const domain = { fingerprint: 'same', signals: {} };
	return {
		schemaVersion: 1,
		schoolId: 51,
		schoolYearId: 81,
		computedAt: FIXED_NOW.toISOString(),
		fingerprint,
		domains: {
			teachingLoad: domain,
			policy: domain,
			rooms: domain,
			sections: domain,
			subjects: domain,
		},
	};
}

type FakeOptions = {
	status?: string;
	schoolId?: number;
	schoolYearId?: number;
	summary?: unknown;
	violations?: unknown;
	unassignedItems?: unknown;
	activeYears?: number[];
	runType?: string;
	priorPublished?: boolean;
	termIdentities?: unknown[];
};

function fakeClient(options: FakeOptions = {}) {
	let nextRevisionId = 701;
	let nextAuditId = 801;
	let lock = Promise.resolve();
	const state = {
		run: {
			id: 91,
			schoolId: options.schoolId ?? 51,
			schoolYearId: options.schoolYearId ?? 81,
			status: options.status ?? 'COMPLETED',
			runType: options.runType ?? 'FULL',
			version: 4,
			summary: options.summary ?? { inputSnapshot: snapshot() },
			violations: Object.prototype.hasOwnProperty.call(options, 'violations') ? options.violations : [],
			unassignedItems: Object.prototype.hasOwnProperty.call(options, 'unassignedItems') ? options.unassignedItems : [],
			draftEntries: [{ entryId: 'e-1', termIndex: 1 }],
			finishedAt: FIXED_NOW,
			createdAt: FIXED_NOW,
		} as Record<string, any>,
		revisions: [] as Array<Record<string, any>>,
		audits: [] as Array<Record<string, any>>,
		prior: options.priorPublished ? { id: 90, schoolId: 51, schoolYearId: 81, status: 'COMPLETED', version: 2, summary: { isPublished: true } } as Record<string, any> : null,
	};

	const tx: any = {
		$executeRawUnsafe: async () => 1,
		schoolYearTermConfig: {
			findUnique: async () => ({ termCount: 3, termIdentities: options.termIdentities ?? ['T1', 'T2', 'T3'], isActive: true }),
		},
		enrollProSchoolYearMirror: {
			findMany: async () => (options.activeYears ?? [81]).map((enrollProSchoolYearId) => ({ enrollProSchoolYearId })),
			findFirst: async () => ({ enrollProSchoolYearId: (options.activeYears ?? [81])[0] }),
		},
		generationRun: {
			findFirst: async ({ where }: any) => state.run.id === where.id
				&& state.run.schoolId === where.schoolId
				&& state.run.schoolYearId === where.schoolYearId ? { ...state.run } : null,
			updateMany: async ({ where, data }: any) => {
				if (state.prior && where.id === state.prior.id) {
					if (state.prior.version !== where.version) return { count: 0 };
					state.prior.summary = data.summary;
					state.prior.version += data.version.increment;
					return { count: 1 };
				}
				if (state.run.version !== where.version || state.run.status !== where.status) return { count: 0 };
				state.run.summary = data.summary;
				state.run.version += data.version.increment;
				return { count: 1 };
			},
			findUnique: async () => ({ ...state.run }),
			findMany: async () => state.prior ? [{ ...state.prior }] : [],
		},
		publishedScheduleRevision: {
			findFirst: async ({ where }: any) => state.revisions.find((row) => row.id === where.id) ?? null,
			create: async ({ data }: any) => {
				const row = { id: nextRevisionId++, ...data };
				state.revisions.push(row);
				return row;
			},
		},
		auditLog: {
			findFirst: async ({ where }: any) => state.audits.find((row) => row.id === where.id) ?? null,
			create: async ({ data }: any) => {
				const row = { id: nextAuditId++, ...data };
				state.audits.push(row);
				return row;
			},
		},
	};

	const client: any = {
		enrollProSchoolYearMirror: tx.enrollProSchoolYearMirror,
		generationRun: tx.generationRun,
		facultyMirror: { findFirst: async () => ({ id: 20 }) },
		$transaction: async (work: (client: any) => Promise<any>) => {
			let release!: () => void;
			const previous = lock;
			lock = new Promise<void>((resolve) => { release = resolve; });
			await previous;
			const backup = structuredClone({ run: state.run, revisions: state.revisions, audits: state.audits, prior: state.prior });
			try {
				return await work(tx);
			} catch (error) {
				state.run = backup.run;
				state.revisions = backup.revisions;
				state.audits = backup.audits;
				state.prior = backup.prior;
				throw error;
			} finally {
				release();
			}
		},
	};
	return { client, state };
}

const validInput = {
	schoolId: 51,
	schoolYearId: 81,
	runId: 91,
	actorId: 41,
	actorSchoolId: 51,
};

type RevisionFixtureOptions = {
	summary?: unknown;
	baseEffectiveDate?: Date;
	changes?: unknown;
};

function makeRevisionFixture(options: RevisionFixtureOptions = {}) {
	const state = { revisions: [] as any[], audits: [] as any[], runSummary: null as any };
	const baseEffectiveDate = options.baseEffectiveDate ?? new Date('2030-01-01T00:00:00.000Z');
	const generationRunSummary = options.summary ?? { isPublished: true, publishedAt: FIXED_NOW.toISOString(), publication: { revisionId: 700, sourceRunVersion: 5 } };
	const changedEntries = options.changes ?? [{ entryId: 'e-1', entry: { entryId: 'e-1', roomId: 30, termIndex: 1 } }];
	const tx: any = {
		$executeRawUnsafe: async () => 1,
		$queryRawUnsafe: async () => changedEntries,
		enrollProSchoolYearMirror: { findMany: async () => [{ enrollProSchoolYearId: 81 }] },
		schoolYearTermConfig: { findUnique: async () => ({ termCount: 3, termIdentities: ['T1', 'T2', 'T3'], isActive: true }) },
		generationRun: { findFirst: async () => ({ id: 91, status: 'COMPLETED', runType: 'FULL', version: 5, summary: generationRunSummary }) },
		publishedScheduleRevision: {
			findFirst: async ({ where }: any) => {
				if (where.id === 700) return { id: 700, effectiveDate: baseEffectiveDate, sourceRevisionId: null, reason: 'INITIAL_PUBLICATION', metadata: { publicationBase: true, sourceRunVersion: 5 } };
				return state.revisions.find((row) => where.id ? row.id === where.id : row.metadata?.idempotencyKey === where.metadata?.equals) ?? null;
			},
			findMany: async () => [{ id: 700, effectiveDate: baseEffectiveDate, changeSet: [] }, ...state.revisions.map((row) => ({ id: row.id, effectiveDate: row.effectiveDate, changeSet: row.changeSet }))],
			create: async ({ data }: any) => { const row = { id: 901, ...data }; state.revisions.push(row); return row; },
		},
		auditLog: {
			findFirst: async ({ where }: any) => state.audits.find((row) => row.targetIds.includes(where.targetIds.has)) ?? null,
			create: async ({ data }: any) => { const row = { id: 902, ...data }; state.audits.push(row); return row; },
		},
	};
	let lock = Promise.resolve();
	const client: any = {
		...tx,
		$transaction: async (work: any) => {
			let release!: () => void;
			const previous = lock;
			lock = new Promise<void>((resolve) => { release = resolve; });
			await previous;
			const backup = structuredClone({ revisions: state.revisions, audits: state.audits });
			try {
				return await work(tx);
			} catch (error) {
				state.revisions = backup.revisions;
				state.audits = backup.audits;
				throw error;
			} finally {
				release();
			}
		},
	};
	return { client, state, tx };
}

const baseRevisionInput = {
	schoolId: 51,
	schoolYearId: 81,
	sourceRunId: 91,
	sourceRevisionId: 700,
	actorId: 41,
	effectiveDate: '2030-01-03T00:00:00.000Z',
	reason: 'Move one class after publication',
	changes: [{ entryId: 'e-1', previous: { roomId: 30, termIndex: 1 }, next: { roomId: 31, termIndex: 1 } }],
};

async function expectRevisionCode(code: string, fixture: ReturnType<typeof makeRevisionFixture>, input: Partial<typeof baseRevisionInput> = {}) {
	await assert.rejects(
		() => withDataContext(fixture.client, () => createPublishedScheduleRevision({ ...baseRevisionInput, ...input }, { now: FIXED_NOW })),
		(error: any) => error?.code === code,
		code,
	);
	assert.equal(fixture.state.revisions.length, 0, `${code}: no revision`);
	assert.equal(fixture.state.audits.length, 0, `${code}: no audit`);
}

async function makeRoutePublishClient() {
	const state = { revisions: [] as any[], audits: [] as any[], snapshot: null as unknown, runSummary: null as unknown, runVersion: 4 };
	const zeroAggregate = () => async () => ({ _count: { _all: 0 }, _max: { id: null, updatedAt: null, version: null, createdAt: null } });
	const tx: any = {
		$executeRawUnsafe: async () => 1,
		$queryRawUnsafe: async () => [{ teachingLoad: 'tl', policy: 'pl', rooms: 'rm', sections: 'sc', subjects: 'sb' }],
		enrollProSchoolYearMirror: { findMany: async () => [{ enrollProSchoolYearId: 81 }] },
		schoolYearTermConfig: { findUnique: async () => ({ termCount: 3, termIdentities: ['T1', 'T2', 'T3'], isActive: true }) },
		facultyMirror: { aggregate: zeroAggregate() },
		facultySubject: { aggregate: zeroAggregate() },
		subjectSectionOwnership: { aggregate: zeroAggregate() },
		teachingLoadCycle: { findUnique: async () => null },
		schedulingPolicy: { findUnique: async () => null },
		gradeShiftWindow: { aggregate: zeroAggregate() },
		room: { aggregate: zeroAggregate() },
		building: { aggregate: zeroAggregate() },
		sectionMirror: { aggregate: zeroAggregate() },
		subject: { aggregate: zeroAggregate() },
		classTemplate: { aggregate: async () => ({ _count: { _all: 0 }, _max: { id: null, createdAt: null } }) },
		classTemplateSubject: { aggregate: async () => ({ _count: { _all: 0 }, _max: { id: null, createdAt: null } }) },
		schoolYearOffering: { aggregate: async () => ({ _count: { _all: 0 }, _max: { id: null, version: null, updatedAt: null } }) },
		offeringTermAssignment: { aggregate: async () => ({ _count: { _all: 0 }, _max: { id: null, createdAt: null } }) },
		generationRun: {
			findFirst: async () => ({ id: 91, schoolId: 51, schoolYearId: 81, status: 'COMPLETED', runType: 'FULL', version: state.runVersion, summary: { inputSnapshot: state.snapshot }, violations: [], unassignedItems: [], draftEntries: [{ entryId: 'p-1', termIndex: 1 }], finishedAt: FIXED_NOW, createdAt: FIXED_NOW }),
			findMany: async () => [],
			updateMany: async ({ data }: any) => { state.runSummary = data.summary; state.runVersion += data.version.increment; return { count: 1 }; },
			findUnique: async () => ({ id: 91, schoolId: 51, schoolYearId: 81, status: 'COMPLETED', runType: 'FULL', version: state.runVersion, summary: { ...(state.runSummary as object) }, violations: [], unassignedItems: [], draftEntries: [{ entryId: 'p-1', termIndex: 1 }], finishedAt: FIXED_NOW, createdAt: FIXED_NOW }),
		},
		publishedScheduleRevision: {
			findFirst: async () => null,
			create: async ({ data }: any) => { const row = { id: 701, ...data }; state.revisions.push(row); return row; },
		},
		auditLog: {
			findFirst: async () => null,
			create: async ({ data }: any) => { const row = { id: 801, ...data }; state.audits.push(row); return row; },
		},
	};
	const client: any = { ...tx, $transaction: async (work: any) => work(tx) };
	state.snapshot = await computeGenerationInputSnapshot(51, 81, client);
	state.runSummary = state.snapshot;
	return { client, state, tx };
}

async function expectCode(code: string, options: FakeOptions, input = validInput, fingerprint = 'current') {
	const fixture = fakeClient(options);
	await assert.rejects(
		() => withDataContext(fixture.client, () => publishSchedule(input, {
			now: () => FIXED_NOW,
			computeInputSnapshot: async () => snapshot(fingerprint),
		})),
		(error: any) => error?.code === code,
		code,
	);
	assert.equal(fixture.state.revisions.length, 0, `${code}: no revision`);
	assert.equal(fixture.state.audits.length, 0, `${code}: no audit`);
}

async function main() {
	await expectCode('RUN_NOT_FOUND', { schoolId: 52 });
	await expectCode('RUN_NOT_COMPLETED', { status: 'FAILED', summary: { isPublished: true, inputSnapshot: snapshot() } });
	await expectCode('RUN_NOT_OFFICIAL', { runType: 'PERFORMANCE_FIXTURE' });
	await expectCode('HISTORICAL_YEAR_PUBLICATION_DENIED', { activeYears: [82] });
	await expectCode('CROSS_SCHOOL_DENIED', {}, { ...validInput, actorSchoolId: 52 });
	await expectCode('ACTIVE_SCHOOL_YEAR_AMBIGUOUS', { activeYears: [81, 82] });
	await expectCode('PUBLICATION_TERM_CONTRACT_INVALID', { termIdentities: ['T1', 'T1', ''] });
	await expectCode('PUBLICATION_INPUTS_STALE', {}, validInput, 'changed');
	await expectCode('PUBLISH_BLOCKED_HARD_VIOLATIONS', { violations: [{ severity: 'HARD' }] });
	await expectCode('PUBLISH_BLOCKED_UNASSIGNED_REQUIRED', { unassignedItems: [{ reason: 'NO_ROOM' }] });
	await expectCode('PUBLICATION_RUN_MALFORMED', { violations: null });

	const fixture = fakeClient();
	const events: unknown[] = [];
	const publish = () => withDataContext(fixture.client, () => publishSchedule(validInput, {
		now: () => FIXED_NOW,
		computeInputSnapshot: async () => snapshot(),
		publishEvent: (event) => { events.push(event); },
	}));
	const [first, concurrent] = await Promise.all([publish(), publish()]);
	assert.equal(fixture.state.revisions.length, 1, 'concurrent publish creates one immutable revision');
	assert.equal(fixture.state.audits.length, 1, 'concurrent publish creates one audit');
	assert.equal(events.length, 1, 'concurrent publish emits one event');
	assert.equal(first.revisionId, concurrent.revisionId, 'duplicate replay returns original revision');
	assert.equal([first.replayed, concurrent.replayed].filter(Boolean).length, 1, 'one concurrent request is replay');
	assert.equal((fixture.state.run.summary as any).publication.sourceRunVersion, 5, 'publication binds incremented run version');
	fixture.state.revisions[0].reason = 'UNRELATED_LATER_REVISION';
	await assert.rejects(
		() => withDataContext(fixture.client, () => publishSchedule(validInput, { now: () => FIXED_NOW, computeInputSnapshot: async () => snapshot() })),
		(error: any) => error?.code === 'PUBLICATION_STATE_AMBIGUOUS',
		'malformed replay pointers fail closed',
	);
	const replacementFixture = fakeClient({ priorPublished: true });
	await withDataContext(replacementFixture.client, () => publishSchedule(validInput, {
		now: () => FIXED_NOW,
		computeInputSnapshot: async () => snapshot(),
		publishEvent: () => undefined,
	}));
	assert.equal(replacementFixture.state.prior?.summary.isPublished, false, 'new publication retires prior current marker atomically');
	assert.equal(replacementFixture.state.prior?.summary.publicationSupersededByRunId, 91, 'prior publication records replacement run');

	const failureFixture = fakeClient();
	const delivery = await withDataContext(failureFixture.client, () => publishSchedule(validInput, {
		now: () => FIXED_NOW,
		computeInputSnapshot: async () => snapshot(),
		publishEvent: () => { throw new Error('subscriber failure'); },
	}));
	assert.equal(delivery.notificationDelivery, 'FAILED_AFTER_COMMIT');
	assert.equal(failureFixture.state.revisions.length, 1, 'notification failure preserves committed revision');
	assert.equal(failureFixture.state.audits.length, 1, 'notification failure preserves committed audit');

	const revisionState = { revisions: [] as any[], audits: [] as any[] };
	const revisionTx: any = {
		$executeRawUnsafe: async () => 1,
		$queryRawUnsafe: async () => [{ entryId: 'e-1', entry: { entryId: 'e-1', roomId: 30, termIndex: 1 } }],
		enrollProSchoolYearMirror: { findMany: async () => [{ enrollProSchoolYearId: 81 }] },
		schoolYearTermConfig: { findUnique: async () => ({ termCount: 3, termIdentities: ['T1', 'T2', 'T3'], isActive: true }) },
		generationRun: { findFirst: async () => ({ id: 91, status: 'COMPLETED', runType: 'FULL', version: 5, summary: { isPublished: true, publishedAt: FIXED_NOW.toISOString(), publication: { revisionId: 700, sourceRunVersion: 5 } } }) },
		publishedScheduleRevision: {
			findFirst: async ({ where }: any) => {
				if (where.id === 700) return { id: 700, effectiveDate: new Date('2030-01-01T00:00:00.000Z'), sourceRevisionId: null, reason: 'INITIAL_PUBLICATION', metadata: { publicationBase: true, sourceRunVersion: 5 } };
				return revisionState.revisions.find((row) => where.id ? row.id === where.id : row.metadata?.idempotencyKey === where.metadata?.equals) ?? null;
			},
			findMany: async () => [{ id: 700, effectiveDate: new Date('2030-01-01T00:00:00.000Z'), changeSet: [] }, ...revisionState.revisions.map((row) => ({ id: row.id, effectiveDate: row.effectiveDate, changeSet: row.changeSet }))],
			create: async ({ data }: any) => { const row = { id: 901, ...data }; revisionState.revisions.push(row); return row; },
		},
		auditLog: {
			findFirst: async ({ where }: any) => revisionState.audits.find((row) => row.targetIds.includes(where.targetIds.has)) ?? null,
			create: async ({ data }: any) => { const row = { id: 902, ...data }; revisionState.audits.push(row); return row; },
		},
	};
	const revisionClient: any = { $transaction: async (work: any) => work(revisionTx) };
	const revisionInput = {
		schoolId: 51,
		schoolYearId: 81,
		sourceRunId: 91,
		sourceRevisionId: 700,
		actorId: 41,
		effectiveDate: '2030-01-03T00:00:00.000Z',
		reason: 'Move one class after publication',
		changes: [{ entryId: 'e-1', previous: { roomId: 30, termIndex: 1 }, next: { roomId: 31, termIndex: 1 } }],
	};
	let revisionEvents = 0;
	const firstRevision = await withDataContext(revisionClient, () => createPublishedScheduleRevision(revisionInput, { now: FIXED_NOW, publishEvent: () => { revisionEvents++; } }));
	const replayRevision = await withDataContext(revisionClient, () => createPublishedScheduleRevision(revisionInput, { now: FIXED_NOW, publishEvent: () => { revisionEvents++; } }));
	assert.equal(firstRevision.replayed, false);
	assert.equal(replayRevision.replayed, true);
	assert.equal(revisionState.revisions.length, 1, 'revision replay creates no duplicate revision');
	assert.equal(revisionState.audits.length, 1, 'revision replay creates no duplicate audit');
	assert.equal(revisionEvents, 1, 'revision replay emits no duplicate event');
	assert.equal(revisionState.revisions[0].id, 901, 'committed revision becomes the authoritative latest token');
	assert.equal(replayRevision.revision.id, 901, 'retry replays the committed revision even though its sourceRevisionId (700) is no longer the latest token');
	const revisionFailureState = { revisions: [] as any[], audits: [] as any[] };
	revisionState.revisions = revisionFailureState.revisions;
	revisionState.audits = revisionFailureState.audits;
	const revisionDelivery = await withDataContext(revisionClient, () => createPublishedScheduleRevision({ ...revisionInput, reason: 'Notification failure boundary' }, { now: FIXED_NOW, publishEvent: () => { throw new Error('subscriber failure'); } }));
	assert.equal(revisionDelivery.notificationDelivery, 'FAILED_AFTER_COMMIT');
	assert.equal(revisionState.revisions.length, 1, 'revision notification failure preserves committed revision');
	assert.equal(revisionState.audits.length, 1, 'revision notification failure preserves committed audit');
	revisionState.revisions = [];
	revisionState.audits = [];
	await assert.rejects(
		() => withDataContext(revisionClient, () => createPublishedScheduleRevision({ ...revisionInput, changes: [{ entryId: 'e-1', previous: { termIndex: 1 }, next: { termIndex: 99 } }] }, { now: FIXED_NOW })),
		(error: any) => error?.code === 'REVISION_TERM_INDEX_INVALID',
		'invalid revised term fails closed',
	);
	await assert.rejects(
		() => withDataContext(revisionClient, () => createPublishedScheduleRevision({ ...revisionInput, changes: [{ entryId: 'e-1', previous: { termIndex: 1 }, next: { termIndex: '1' as any } }] }, { now: FIXED_NOW })),
		(error: any) => error?.code === 'REVISION_TERM_INDEX_INVALID',
		'numeric-string revised term is not persisted',
	);
	await assert.rejects(
		() => withDataContext(revisionClient, () => createPublishedScheduleRevision({ ...revisionInput, changes: [{ entryId: 'e-1', previous: {}, next: { roomId: 31 } }] }, { now: FIXED_NOW })),
		(error: any) => error?.code === 'REVISION_PREVIOUS_VALUES_INCOMPLETE',
		'every changed field requires a previous value',
	);
	await assert.rejects(
		() => withDataContext(revisionClient, () => createPublishedScheduleRevision({ ...revisionInput, changes: [{ entryId: 'e-1', previous: { roomId: '30' as any }, next: { roomId: 31 } }] }, { now: FIXED_NOW })),
		(error: any) => error?.code === 'REVISION_CHANGE_VALUE_INVALID',
		'numeric-string previous IDs are rejected as malformed',
	);
	await assert.rejects(
		() => withDataContext(revisionClient, () => createPublishedScheduleRevision({ ...revisionInput, changes: [revisionInput.changes[0], revisionInput.changes[0]] }, { now: FIXED_NOW })),
		(error: any) => error?.code === 'REVISION_CHANGE_DUPLICATE_ENTRY',
		'duplicate revised entry fails closed',
	);
	await assert.rejects(
		() => withDataContext(revisionClient, () => createPublishedScheduleRevision({ ...revisionInput, changes: [{ entryId: 'missing-entry', previous: { roomId: 30 }, next: { roomId: 31 } }] }, { now: FIXED_NOW })),
		(error: any) => error?.code === 'REVISION_ENTRY_NOT_FOUND',
		'nonexistent revised entry fails closed',
	);
	await assert.rejects(
		() => withDataContext(revisionClient, () => createPublishedScheduleRevision({ ...revisionInput, sourceRevisionId: null }, { now: FIXED_NOW })),
		(error: any) => error?.code === 'SOURCE_REVISION_STALE',
		'missing latest revision token fails closed',
	);
	await assert.rejects(
		() => withDataContext(revisionClient, () => createPublishedScheduleRevision({ ...revisionInput, changes: [{ entryId: 'e-1', previous: { roomId: 999 }, next: { roomId: 31 } }] }, { now: FIXED_NOW })),
		(error: any) => error?.code === 'REVISION_PREVIOUS_VALUES_STALE',
		'stale previous value fails closed',
	);

	// ── PUB-C01R defect 1: exact published-source truth ──
	const staleMarkers = makeRevisionFixture({
		summary: { isPublished: false, publishedAt: FIXED_NOW.toISOString(), publishedBy: 41, publication: { revisionId: 700, sourceRunVersion: 5 } },
	});
	await expectRevisionCode('PUBLISHED_SOURCE_REQUIRED', staleMarkers);
	assert.equal(staleMarkers.state.revisions.length, 0, 'stale markers alone never write a revision');
	assert.equal(staleMarkers.state.audits.length, 0, 'stale markers alone never write an audit');

	const truthOnly = makeRevisionFixture({ summary: { isPublished: true, publication: { revisionId: 700, sourceRunVersion: 5 } } });
	const truthOnlyRevision = await withDataContext(truthOnly.client, () => createPublishedScheduleRevision(baseRevisionInput, { now: FIXED_NOW }));
	assert.equal(truthOnlyRevision.replayed, false);
	assert.equal(truthOnly.state.revisions.length, 1, 'isPublished:true alone establishes publication');
	assert.equal(truthOnly.state.audits.length, 1, 'published run audits its base revision creation');

	// ── PUB-C01R defect 4: causal effective-date order ──
	const beforeSource = makeRevisionFixture({ baseEffectiveDate: new Date('2030-01-20T00:00:00.000Z') });
	await expectRevisionCode('REVISION_EFFECTIVE_DATE_BEFORE_SOURCE', beforeSource, { effectiveDate: '2030-01-10T00:00:00.000Z' });

	const sameDateFixture = makeRevisionFixture({ baseEffectiveDate: new Date('2030-01-20T00:00:00.000Z') });
	const sameDateResult = await withDataContext(sameDateFixture.client, () => createPublishedScheduleRevision({ ...baseRevisionInput, effectiveDate: '2030-01-20T00:00:00.000Z' }, { now: FIXED_NOW }));
	assert.equal(sameDateResult.replayed, false, 'same-date as the source revision remains valid');

	const forwardDateFixture = makeRevisionFixture({ baseEffectiveDate: new Date('2030-01-20T00:00:00.000Z') });
	const forwardDateResult = await withDataContext(forwardDateFixture.client, () => createPublishedScheduleRevision({ ...baseRevisionInput, effectiveDate: '2030-01-21T00:00:00.000Z' }, { now: FIXED_NOW }));
	assert.equal(forwardDateResult.replayed, false, 'forward date remains valid');

	const chainCausalFixture = makeRevisionFixture({ baseEffectiveDate: new Date('2030-01-20T00:00:00.000Z') });
	const chainHead = await withDataContext(chainCausalFixture.client, () => createPublishedScheduleRevision({ ...baseRevisionInput, effectiveDate: '2030-01-20T00:00:00.000Z' }, { now: FIXED_NOW }));
	assert.equal(chainHead.revision.id, 901, 'chain head committed');
	assert.equal(chainCausalFixture.state.revisions.length, 1, 'chain head is the only committed revision');
	await assert.rejects(
		() => withDataContext(chainCausalFixture.client, () => createPublishedScheduleRevision({ ...baseRevisionInput, sourceRevisionId: 901, effectiveDate: '2030-01-10T00:00:00.000Z' }, { now: FIXED_NOW })),
		(error: any) => error?.code === 'REVISION_EFFECTIVE_DATE_BEFORE_SOURCE',
		'chain revision with an earlier effective date is rejected',
	);
	assert.equal(chainCausalFixture.state.revisions.length, 1, 'causal violation on a chain revision writes nothing');
	assert.equal(chainCausalFixture.state.audits.length, 1, 'causal violation writes no additional audit');

	// ── PUB-C01R defect 2: authoritative latest revision read contract ──
	const freshRead = await withDataContext(makeRevisionFixture().client, () => resolveLatestPublishedSourceRevision({ schoolId: 51, schoolYearId: 81, sourceRunId: 91 }));
	assert.equal(freshRead.latestRevisionId, 700);
	assert.equal(freshRead.baseRevisionId, 700);
	const chainAwareRead = makeRevisionFixture();
	await withDataContext(chainAwareRead.client, () => createPublishedScheduleRevision(baseRevisionInput, { now: FIXED_NOW }));
	const readAfterCommit = await withDataContext(chainAwareRead.client, () => resolveLatestPublishedSourceRevision({ schoolId: 51, schoolYearId: 81, sourceRunId: 91 }));
	assert.equal(readAfterCommit.latestRevisionId, 901, 'read contract exposes the committed revision as the authoritative latest token');

	// ── PUB-C01R defect 5: publish outcome transparency through the production wrapper ──
	const { publishRun } = await import('../services/generation.service.js');
	const outcomeFixture = fakeClient();
	const outcome = await withDataContext(outcomeFixture.client, () => publishRun(51, 81, 91, 41, { actorSchoolId: 51 }, {
		now: () => FIXED_NOW,
		computeInputSnapshot: async () => snapshot(),
		publishEvent: () => { throw new Error('subscriber failure'); },
	}));
	assert.equal(outcome.notificationDelivery, 'FAILED_AFTER_COMMIT');
	assert.equal(outcome.replayed, false);
	assert.equal(typeof outcome.revisionId, 'number', 'publishRun exposes revisionId');
	assert.equal(typeof outcome.auditId, 'number', 'publishRun exposes auditId');
	assert.ok(outcome.run && typeof outcome.run === 'object', 'publishRun preserves the run response');
	assert.equal(outcomeFixture.state.revisions.length, 1, 'notification exception preserves committed base revision');
	assert.equal(outcomeFixture.state.audits.length, 1, 'notification exception preserves committed audit');

	let targetedQuery = '';
	let targetedParams: unknown[] = [];
	const publishedEntries = [
		{ entryId: 'e-1', sectionId: 10, facultyId: 20, roomId: 30, termIndex: 1 },
		{ entryId: 'e-2', sectionId: 11, facultyId: 21, roomId: 31, termIndex: 2 },
	];
	const readFixture: any = {
		generationRun: {
			findMany: async () => [{ id: 91, schoolId: 51, schoolYearId: 81, runType: 'FULL', version: 5, summary: { isPublished: true, publication: { revisionId: 701, sourceRunVersion: 5 } }, finishedAt: FIXED_NOW, createdAt: FIXED_NOW }],
			findUnique: async () => ({ draftEntries: publishedEntries }),
		},
		publishedScheduleRevision: {
			findMany: async () => [{
				id: 701,
				effectiveDate: new Date('2030-01-01T00:00:00.000Z'),
				sourceRevisionId: null,
				reason: 'INITIAL_PUBLICATION',
				metadata: { publicationBase: true, sourceRunVersion: 5 },
				changeSet: [
					{ entryId: 'e-1', next: { sectionId: 12 } },
					{ entryId: 'e-2', next: { sectionId: 10 } },
				],
			}],
		},
		$queryRawUnsafe: async (query: string, ...params: unknown[]) => {
			targetedQuery = query;
			targetedParams = params;
			return publishedEntries.map((elem) => ({ elem }));
		},
		enrollProSchoolYearMirror: { findFirst: async () => ({ yearLabel: '2030-2031' }) },
	};
	const effective = await withDataContext(readFixture, () => resolvePublishedRun(51, 81, { requestedDate: '2030-01-03' }, { sectionId: 10 }, 81));
	assert.deepEqual(effective.entries.map((entry) => [entry.entryId, entry.sectionId]), [['e-1', 12], ['e-2', 10]], 'revision changes apply in original entry order');
	assert.deepEqual(effective.entries.filter((entry) => entry.sectionId === 10).map((entry) => entry.entryId), ['e-2'], 'effective filter includes moved-in and excludes moved-out entry');
	assert.match(targetedQuery, /WITH ORDINALITY[\s\S]*entryId'[\s\S]*ANY[\s\S]*ORDER BY entry\.ord ASC/);
	assert.deepEqual(targetedParams.at(-1), ['e-1', 'e-2'], 'targeted query includes every revision-touched entry identity');

	process.env.JWT_SECRET = 'publication-contract-hermetic-secret';
	const { default: app } = await import('../app.js');
	const routeFixture = fakeClient({ schoolId: 52 });
	await withDataContext(routeFixture.client, async () => {
		const server = createServer(app);
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		try {
			const address = server.address();
			assert(address && typeof address === 'object');
			const base = `http://127.0.0.1:${address.port}/api/v1/generation/51/81/runs/91/publish`;
			const noAuth = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
			assert.equal(noAuth.status, 401, 'real publish route requires authentication');
			const crossToken = jwt.sign({ userId: 41, role: 'officer', schoolId: 52, authSource: 'local' }, process.env.JWT_SECRET!);
			const cross = await fetch(base, { method: 'POST', headers: { authorization: `Bearer ${crossToken}`, 'content-type': 'application/json' }, body: '{}' });
			assert.equal(cross.status, 403, 'real publish route rejects cross-school actor');
			assert.equal((await cross.json() as any).code, 'CROSS_SCHOOL_DENIED');
			const scopedToken = jwt.sign({ userId: 41, role: 'officer', schoolId: 51, authSource: 'local' }, process.env.JWT_SECRET!);
			const missing = await fetch(base, { method: 'POST', headers: { authorization: `Bearer ${scopedToken}`, 'content-type': 'application/json' }, body: '{}' });
			assert.equal(missing.status, 404, 'real publish route fails closed when run is missing');
			assert.equal((await missing.json() as any).code, 'RUN_NOT_FOUND');

			for (const path of [
				'/api/v1/schools/51/schedules/published',
				'/api/v1/schools/51/schedules/published?termIndex=2',
				'/api/v1/schools/51/schedules/published/sections/10',
				'/api/v1/schools/51/schedules/published/faculty-external/200020',
				'/api/v1/schools/51/schedules/published/rooms/30',
			]) {
				const response: Response = await fetch(`http://127.0.0.1:${address.port}${path}`);
				assert.equal(response.status, 404, `public read executes without auth and reports no published run: ${path}`);
				assert.equal((await response.json() as any).code, 'CURRENT_PUBLISHED_RUN_NOT_FOUND');
			}
		} finally {
			await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
		}
	});

	const positiveEntries = [
		{ entryId: 'p-1', sectionId: 10, subjectId: 40, facultyId: 20, roomId: 30, day: 'MONDAY', startTime: '07:30', endTime: '08:15', durationMinutes: 45, termIndex: 1 },
		{ entryId: 'p-2', sectionId: 11, subjectId: 41, facultyId: 21, roomId: 31, day: 'TUESDAY', startTime: '08:15', endTime: '09:00', durationMinutes: 45, termIndex: 2 },
		{ entryId: 'p-3', sectionId: 12, subjectId: 42, facultyId: 22, roomId: 32, day: 'WEDNESDAY', startTime: '09:00', endTime: '09:45', durationMinutes: 45, termIndex: 3 },
	];
	const positiveClient: any = {
		generationRun: {
			findMany: async () => [{ id: 91, schoolId: 51, schoolYearId: 81, runType: 'FULL', version: 5, summary: { isPublished: true, publication: { revisionId: 701, sourceRunVersion: 5 } }, finishedAt: FIXED_NOW, createdAt: FIXED_NOW }],
			findUnique: async () => ({ draftEntries: positiveEntries }),
		},
		publishedScheduleRevision: { findMany: async () => [{ id: 701, effectiveDate: new Date('2030-01-01T00:00:00.000Z'), changeSet: [], sourceRevisionId: null, reason: 'INITIAL_PUBLICATION', metadata: { publicationBase: true, sourceRunVersion: 5 } }] },
		enrollProSchoolYearMirror: {
			findFirst: async () => ({ enrollProSchoolYearId: 81, yearLabel: '2030-2031' }),
			findMany: async () => [{ enrollProSchoolYearId: 81 }],
		},
		facultyMirror: {
			findFirst: async ({ where }: any) => ({ id: where.externalId === 200020 ? 20 : 21 }),
			findMany: async () => [{ id: 20, externalId: 200020, employeeId: 'E20', firstName: 'Ada', lastName: 'Luna', isPlaceholder: false }, { id: 21, externalId: 200021, employeeId: 'E21', firstName: 'Jose', lastName: 'Rizal', isPlaceholder: false }, { id: 22, externalId: 200022, employeeId: 'E22', firstName: 'Andres', lastName: 'Bonifacio', isPlaceholder: false }],
		},
		subject: { findMany: async () => [40, 41, 42].map((id) => ({ id, code: `S${id}`, name: `Subject ${id}` })) },
		room: { findMany: async () => [30, 31, 32].map((id) => ({ id, name: `Room ${id}`, type: 'CLASSROOM', floor: 1, building: { id: 1, name: 'Main' } })) },
		sectionMirror: { findMany: async () => [10, 11, 12].map((externalId) => ({ id: externalId + 100, externalId, name: `Section ${externalId}`, gradeLevelId: 7, gradeLevelName: 'Grade 7', programType: 'REGULAR', programCode: 'REG', programName: 'Regular' })) },
		instructionalCohort: { findMany: async () => [] },
		subjectSectionOwnership: { findMany: async () => [] },
		schedulingPolicy: { findUnique: async () => null },
		policySpecialEvent: { findMany: async () => [] },
		$queryRawUnsafe: async () => positiveEntries.map((elem) => ({ elem })),
	};
	await withDataContext(positiveClient, async () => {
		const server = createServer(app);
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		try {
			const address = server.address();
			assert(address && typeof address === 'object');
			const origin = `http://127.0.0.1:${address.port}`;
			const cases = [
				['/api/v1/schools/51/schedules/published', 3],
				['/api/v1/schools/51/schedules/published?termIndex=2', 1],
				['/api/v1/schools/51/schedules/published/sections/10', 1],
				['/api/v1/schools/51/schedules/published/faculty-external/200020', 1],
				['/api/v1/schools/51/schedules/published/rooms/30', 1],
			] as const;
			for (const [path, expectedCount] of cases) {
				const response: Response = await fetch(origin + path);
				assert.equal(response.status, 200, `positive public contract: ${path}`);
				const body = await response.json() as any;
				assert.equal(body.source.schoolId, 51);
				assert.equal(body.source.schoolYearId, 81);
				assert.equal(body.entries.length, expectedCount);
			}
		} finally {
			await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
		}
	});

	// ── PUB-C01R defect 2: real revision-creation route + read contract ──
	const revisionRoute = makeRevisionFixture();
	const officerToken = jwt.sign({ userId: 41, role: 'officer', schoolId: 51, authSource: 'local' }, process.env.JWT_SECRET!);
	await withDataContext(revisionRoute.client, async () => {
		const server = createServer(app);
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		try {
			const address = server.address();
			assert(address && typeof address === 'object');
			const origin = `http://127.0.0.1:${address.port}`;
			const url = `${origin}/api/v1/generation/51/81/runs/91/published-revisions`;
			const headers = { authorization: `Bearer ${officerToken}`, 'content-type': 'application/json' };

			const read = await fetch(url, { headers });
			assert.equal(read.status, 200, 'read contract route exposes the latest revision token');
			const readBody = await read.json() as any;
			assert.equal(readBody.latestRevisionId, 700);
			assert.equal(readBody.baseRevisionId, 700);
			assert.equal(readBody.count, 1);

			const noToken = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ effectiveDate: '2030-01-03', reason: 'no token', changes: [{ entryId: 'e-1', previous: { roomId: 30 }, next: { roomId: 31 } }] }) });
			assert.equal(noToken.status, 409, 'missing source token fails closed on the real route');
			assert.equal((await noToken.json() as any).code, 'SOURCE_REVISION_STALE');

			const staleToken = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ effectiveDate: '2030-01-03', reason: 'stale token', sourceRevisionId: 705, changes: [{ entryId: 'e-1', previous: { roomId: 30 }, next: { roomId: 31 } }] }) });
			assert.equal(staleToken.status, 409, 'stale source token fails closed on the real route');
			assert.equal((await staleToken.json() as any).code, 'SOURCE_REVISION_STALE');

			const created = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ effectiveDate: '2030-01-03', reason: 'valid token', sourceRevisionId: 700, changes: [{ entryId: 'e-1', previous: { roomId: 30 }, next: { roomId: 31 } }] }) });
			assert.equal(created.status, 201, 'valid latest token creates a revision on the real route');
			const createdBody = await created.json() as any;
			assert.equal(createdBody.revision.id, 901);
			assert.equal(createdBody.replayed, false);
			assert.equal(revisionRoute.state.revisions.length, 1, 'real route writes exactly one revision');
			assert.equal(revisionRoute.state.audits.length, 1, 'real route writes exactly one audit');
		} finally {
			await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
		}
	});

	// ── PUB-C01R defect 5: production publish route returns the stable outcome envelope ──
	const publishRoute = await makeRoutePublishClient();
	const publishToken = jwt.sign({ userId: 41, role: 'officer', schoolId: 51, authSource: 'local' }, process.env.JWT_SECRET!);
	await withDataContext(publishRoute.client, async () => {
		const server = createServer(app);
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		try {
			const address = server.address();
			assert(address && typeof address === 'object');
			const base = `http://127.0.0.1:${address.port}/api/v1/generation/51/81/runs/91/publish`;
			const response = await fetch(base, { method: 'POST', headers: { authorization: `Bearer ${publishToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ acknowledgeSoftViolations: true }) });
			assert.equal(response.status, 200, 'production publish route returns the stable envelope');
			const body = await response.json() as any;
			assert.ok(body.run && typeof body.run === 'object', 'run response preserved in the envelope');
			assert.equal(body.publication.revisionId, publishRoute.state.revisions[0].id, 'envelope exposes revisionId');
			assert.equal(body.publication.auditId, publishRoute.state.audits[0].id, 'envelope exposes auditId');
			assert.equal(body.publication.replayed, false, 'envelope exposes replayed');
			assert.equal(body.publication.notificationDelivery, 'DELIVERED', 'envelope exposes notificationDelivery');
		} finally {
			await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
		}
	});

	const ambiguousReadClient: any = {
		generationRun: { findMany: async () => [{ id: 1 }, { id: 2 }] },
	};
	await assert.rejects(
		() => withDataContext(ambiguousReadClient, () => resolvePublishedRun(51, 81)),
		(error: any) => error?.code === 'PUBLISHED_RUN_AMBIGUOUS',
		'multiple published markers fail closed',
	);

	const generationRouter = await readFile(new URL('routes/generation.router.ts', ROOT), 'utf8');
	assert.match(generationRouter, /runs\/:runId\/publish'[\s\S]*authenticate/);
	assert.match(generationRouter, /actorSchoolId !== schoolId[\s\S]*CROSS_SCHOOL_DENIED/);
	assert.match(generationRouter, /genService\.publishRun[\s\S]*actorSchoolId/);
	assert.match(generationRouter, /publication:\s*\{\s*revisionId[\s\S]*auditId[\s\S]*replayed[\s\S]*notificationDelivery/, 'publish route returns the stable outcome envelope');

	const departureSheet = await readFile(new URL('../../../atlas-client/src/components/timetable/TeacherDepartureRecoverySheet.tsx', import.meta.url), 'utf8');
	assert.match(departureSheet, /fetchLatestRevisionToken\(schoolId, schoolYearId, runId\)/, 'departure sheet reads the latest revision token immediately before posting');
	assert.match(departureSheet, /buildRevisionCreatePayload\([\s\S]*sourceRevisionId/, 'departure sheet binds the token into the revision payload');

	const sandboxDock = await readFile(new URL('../../../atlas-client/src/components/timetable/TacticalSandboxDock.tsx', import.meta.url), 'utf8');
	assert.match(sandboxDock, /fetchLatestRevisionToken\(schoolId, schoolYearId, runId\)/, 'tactical dock reads the latest revision token immediately before posting');
	assert.match(sandboxDock, /buildRevisionCreatePayload\([\s\S]*sourceRevisionId/, 'tactical dock binds the token into the revision payload');

	const revisionRouter = await readFile(new URL('routes/published-revision.router.ts', ROOT), 'utf8');
	assert.match(revisionRouter, /latestRevisionId[\s\S]*baseRevisionId/, 'revision read contract exposes the authoritative latest token');

	const publishedRouter = await readFile(new URL('routes/published-schedule.router.ts', ROOT), 'utf8');
	assert.match(publishedRouter, /where:\s*\{ schoolId, isActive: true, isArchived: false \}/);
	for (const route of [
		"/schools/:schoolId/schedules/published'",
		"/schools/:schoolId/schedules/published/sections/:sectionId'",
		"/schools/:schoolId/schedules/published/faculty-external/:externalFacultyId'",
		"/schools/:schoolId/schedules/published/rooms/:roomId'",
		"/schools/:schoolId/schedules/published/:termId'",
	]) assert.match(publishedRouter, new RegExp(route.replace(/[/:]/g, '\\$&')), `public route exists: ${route}`);
	assert.doesNotMatch(publishedRouter, /schedules\/published',\s*authenticate/);

	const publishedService = await readFile(new URL('services/published-schedule.service.ts', ROOT), 'utf8');
	assert.match(publishedService, /generationRun\.findMany\([\s\S]*runType:\s*'FULL'[\s\S]*summary:\s*\{\s*path:\s*\['isPublished'\],\s*equals:\s*true/);
	assert.match(publishedService, /orderBy:\s*\[\{ createdAt: 'desc' \}, \{ id: 'desc' \}\]/);
	assert.doesNotMatch(publishedService, /generationRun\.findMany\([\s\S]{0,800}draftEntries/);
	assert.match(publishedService, /WITH ORDINALITY[\s\S]*ORDER BY entry\.ord ASC/);

	console.log('publication contract readiness: all checks passed');
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
