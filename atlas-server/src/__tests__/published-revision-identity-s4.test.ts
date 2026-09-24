import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import jwt from 'jsonwebtoken';

import { withDataContext } from '../lib/data-context.js';
import {
	createPublishedScheduleRevision,
	resolveEffectivePublishedIdentitySnapshot,
} from '../services/published-revision.service.js';
import {
	applyIdentityOverrides,
	assertSnapshotConsistency,
	readIdentityOverrides,
	readPublishedIdentitySnapshot,
	resolveEffectiveIdentitySnapshot,
	snapshotDigest,
	IDENTITY_OVERRIDES_KEY,
	type PublishedIdentitySnapshot,
} from '../services/published-identity-snapshot.service.js';
import { assertRunIsEditable } from '../services/manual-edit.service.js';
import { POLICY_DEFAULTS } from '../services/scheduling-policy.service.js';
import type { GenerationInputSnapshot } from '../services/generation-input-snapshot.service.js';

// PUBLISHED-REVISION-IDENTITY-S4 — production-path evidence for D4
// (effective-dated published-revision identity deltas + bounded withdraw).
// Every row exercises the real service or the real HTTP route against a
// hermetic fake client (DATABASE_URL unset). Helper-only assertions are labelled
// as controls and always accompany a real-path row.

const SCHOOL_ID = 51;
const SCHOOL_YEAR_ID = 81;
const RUN_ID = 91;
const BASE_REVISION_ID = 700;
const ACTOR_ID = 41;
const FIXED_NOW = new Date('2030-01-02T03:04:05.000Z');

process.env.JWT_SECRET = 'published-revision-identity-s4-secret';

type Entry = Record<string, any>;

function slotEntry(entryId: string, overrides: Record<string, any> = {}): Entry {
	return {
		entryId,
		facultyId: 20,
		roomId: 30,
		subjectId: 40,
		sectionId: 10,
		day: 'MONDAY',
		startTime: '07:30',
		endTime: '08:15',
		durationMinutes: 45,
		termIndex: 1,
		...overrides,
	};
}

function baseIdentitySnapshot(): PublishedIdentitySnapshot {
	return {
		schemaVersion: 1,
		capturedAt: '2030-01-01T00:00:00.000Z',
		inputFingerprint: 'fp-base',
		orderedTermContract: {
			format: 'TRIMESTER',
			terms: [
				{ identity: 'T1', displayLabel: 'T1', order: 1 },
				{ identity: 'T2', displayLabel: 'T2', order: 2 },
				{ identity: 'T3', displayLabel: 'T3', order: 3 },
			],
			activeTermOrder: 1,
		},
		subjects: {},
		faculty: {},
		sections: {},
		buildings: {},
		rooms: {},
		specializations: {},
		cohorts: {},
		advisers: {},
		displaySlots: [
			{ key: '07:30-08:15', label: '07:30-08:15', startTime: '07:30', endTime: '08:15', order: 0, kind: 'PERIOD', dayOfWeek: null },
		],
		specialEvents: [],
		policy: { enableFlagCeremony: false, enableRecess: false, enableLunchWindow: false },
		classProgramSlots: [],
	};
}

const BASE_METADATA = {
	publishedIdentitySnapshot: baseIdentitySnapshot(),
	publicationBase: true,
	sourceRunVersion: 5,
} as const;

const QUARTERS_OVERRIDE = {
	orderedTermContract: {
		format: 'QUARTERS',
		terms: [
			{ identity: 'Q1', displayLabel: 'Q1', order: 1 },
			{ identity: 'Q2', displayLabel: 'Q2', order: 2 },
			{ identity: 'Q3', displayLabel: 'Q3', order: 3 },
			{ identity: 'Q4', displayLabel: 'Q4', order: 4 },
		],
		activeTermOrder: 1,
	},
};

const FLAG_EVENT = {
	eventType: 'FLAG_CEREMONY',
	label: 'Flag Ceremony',
	gradeGroup: null,
	programType: null,
	startTime: '07:00',
	endTime: '07:30',
	sortOrder: 0,
	dayOfWeek: 'MONDAY',
};

const INCONSISTENT_OVERRIDE = { specialEvents: [FLAG_EVENT] };

function validTermCache(schoolId: number, enrollProSchoolYearId: number) {
	return {
		schoolId,
		schoolYear: { id: enrollProSchoolYearId, yearLabel: '2030-2031' },
		format: 'TRIMESTER',
		terms: [
			{ identity: 'T1', displayLabel: 'T1', order: 1 },
			{ identity: 'T2', displayLabel: 'T2', order: 2 },
			{ identity: 'T3', displayLabel: 'T3', order: 3 },
		],
	};
}

function snap(fingerprint: string): GenerationInputSnapshot {
	const domain = (fp: string) => ({ fingerprint: fp, signals: {} });
	return {
		schemaVersion: 3,
		schoolId: SCHOOL_ID,
		schoolYearId: SCHOOL_YEAR_ID,
		computedAt: FIXED_NOW.toISOString(),
		fingerprint,
		domains: {
			teachingLoad: domain('teaching-same'),
			policy: domain('policy-same'),
			rooms: domain('rooms-same'),
			sections: domain('sections-same'),
			subjects: domain('subjects-same'),
			derivedDemand: domain('demand-same'),
			availability: domain('availability-same'),
		},
	};
}

type SeedRevision = {
	id: number;
	status: string;
	effectiveDate: Date;
	sourceRevisionId: number | null;
	reason: string;
	changeSet: unknown;
	metadata: Record<string, any>;
};

function makeFixture() {
	const entries: Entry[] = [slotEntry('e-1')];
	const roomRow = (room: Record<string, any>) => ({
		...room,
		isTeachingSpace: true,
		isSharedFacility: false,
		features: [],
		floor: 1,
		buildingId: 1,
		name: `Room ${room.id}`,
		building: { gradeScope: null, name: 'Main', shortCode: 'M' },
	});
	const rooms = [
		{ id: 30, type: 'CLASSROOM', capacity: 40 },
		{ id: 31, type: 'CLASSROOM', capacity: 40 },
	];
	const qualificationRows = [{ facultyId: 20, subjectId: 40, sectionIds: [10] }];
	const facultyRows = [{ id: 20, firstName: 'First20', lastName: 'Last20', maxHoursPerWeek: 40, ancillaryMinutesPerWeek: 0 }];
	const subjectRows = [{ id: 40, code: 'S40', name: 'Subject 40', minMinutesPerWeek: 45, preferredRoomType: 'CLASSROOM', requiredFeatures: [], gradeLevels: [7] }];
	const policy = { ...POLICY_DEFAULTS };

	const state = {
		revisions: [] as SeedRevision[],
		audits: [] as any[],
		nextRevisionId: 901,
		nextAuditId: 902,
	};
	const baseEffectiveDate = new Date('2030-01-01T00:00:00.000Z');
	const baseRow = {
		id: BASE_REVISION_ID,
		schoolId: SCHOOL_ID,
		schoolYearId: SCHOOL_YEAR_ID,
		sourceRunId: RUN_ID,
		sourceRevisionId: null,
		status: 'SCHEDULED',
		effectiveDate: baseEffectiveDate,
		reason: 'INITIAL_PUBLICATION',
		changeSet: [],
		metadata: BASE_METADATA,
	};
	const runSummary = {
		isPublished: true,
		publishedAt: FIXED_NOW.toISOString(),
		publication: { revisionId: BASE_REVISION_ID, sourceRunVersion: 5 },
	};

	const tx: any = {
		$executeRawUnsafe: async () => 1,
		$queryRawUnsafe: async (_query: string, ...params: unknown[]) => {
			const ids = (params[1] ?? entries.map((entry) => entry.entryId)) as string[];
			return entries.filter((entry) => ids.includes(entry.entryId)).map((entry) => ({ entryId: entry.entryId, entry }));
		},
		enrollProSchoolYearMirror: {
			findMany: async () => [{ enrollProSchoolYearId: SCHOOL_YEAR_ID }],
			findUnique: async ({ where }: any) => {
				const key = where?.schoolId_enrollProSchoolYearId ?? {};
				return {
					isActive: true,
					isArchived: false,
					termContractCachedAt: new Date(),
					termContractCache: { ...validTermCache(key.schoolId, key.enrollProSchoolYearId), activeTerm: { order: 1 } },
				};
			},
		},
		schoolYearTermConfig: { findUnique: async () => ({ termCount: 3, termIdentities: ['T1', 'T2', 'T3'], isActive: true }) },
		generationRun: {
			findFirst: async () => ({
				id: RUN_ID, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID,
				status: 'COMPLETED', runType: 'FULL', version: 5, summary: runSummary, draftEntries: entries,
			}),
		},
		publishedScheduleRevision: {
			findFirst: async ({ where }: any) => {
				if (where.id === BASE_REVISION_ID) return baseRow;
				if (where.metadata?.path) {
					return state.revisions.find((row) => row.metadata?.idempotencyKey === where.metadata.equals) ?? null;
				}
				if (where.id != null) return state.revisions.find((row) => row.id === where.id) ?? null;
				return null;
			},
			findMany: async () => [
				{ id: BASE_REVISION_ID, effectiveDate: baseEffectiveDate, changeSet: [], status: 'SCHEDULED', metadata: BASE_METADATA },
				...state.revisions.map((row) => ({ id: row.id, effectiveDate: row.effectiveDate, changeSet: row.changeSet, status: row.status, metadata: row.metadata })),
			],
			create: async ({ data }: any) => { const row = { id: state.nextRevisionId++, ...data }; state.revisions.push(row); return row; },
			update: async ({ where, data }: any) => {
				const row = state.revisions.find((candidate) => candidate.id === where.id);
				if (!row) throw new Error('revision not found for update');
				Object.assign(row, data);
				return row;
			},
		},
		auditLog: {
			findFirst: async ({ where }: any) => state.audits.find((row) => (where.targetIds?.has == null || row.targetIds.includes(where.targetIds.has)) && (where.action == null || row.action === where.action)) ?? null,
			create: async ({ data }: any) => { const row = { id: state.nextAuditId++, ...data }; state.audits.push(row); return row; },
		},
		facultyMirror: { findMany: async () => facultyRows },
		facultySubject: { findMany: async () => qualificationRows.map((q) => ({ ...q, gradeLevels: [7] })) },
		room: { findMany: async () => rooms.map(roomRow) },
		subject: { findMany: async () => subjectRows },
		schedulingPolicy: { findUnique: async () => ({ id: 1, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, ...policy, createdAt: FIXED_NOW, updatedAt: FIXED_NOW }) },
		building: { findMany: async () => [{ id: 1, x: 0, y: 0 }] },
		sectionSnapshot: {
			findUnique: async () => ({
				payload: [{ gradeLevelId: 7, gradeLevelName: 'Grade 7', displayOrder: 1, sections: [{ id: 10, name: 'Section 10', enrolledCount: 30 }] }],
			}),
		},
		policySpecialEvent: { findMany: async () => [] },
		gradeShiftWindow: { findMany: async () => [] },
		classProgramSlot: { findMany: async () => [] },
	};

	const client: any = {
		...tx,
		$transaction: async (work: any) => {
			const backup = structuredClone({ revisions: state.revisions, audits: state.audits });
			try {
				return await work(tx);
			} catch (error) {
				state.revisions = backup.revisions;
				state.audits = backup.audits;
				throw error;
			}
		},
	};

	const baseClone = structuredClone(BASE_METADATA);
	const counts = () => ({ revisions: state.revisions.length, audits: state.audits.length });
	const seedRevision = (revision: SeedRevision) => { state.revisions.push(revision); };
	const revisionById = (id: number) => state.revisions.find((row) => row.id === id);
	const baseSnapshotDigest = () => snapshotDigest(readPublishedIdentitySnapshot(baseRow.metadata)!);

	return {
		client,
		state,
		counts,
		seedRevision,
		revisionById,
		baseClone,
		baseSnapshotDigest,
		computeInputSnapshot: async () => snap('fp-stable'),
	};
}

const baseInput = {
	schoolId: SCHOOL_ID,
	schoolYearId: SCHOOL_YEAR_ID,
	sourceRunId: RUN_ID,
	sourceRevisionId: BASE_REVISION_ID,
	actorId: ACTOR_ID,
	effectiveDate: '2030-01-03T00:00:00.000Z',
	reason: 'Mid-year identity delta',
};

const ROOM_MOVE = [{ entryId: 'e-1', previous: { roomId: 30 }, next: { roomId: 31 } }];

async function main() {
	// Row 1 — FAILING-FIRST: the base reader ignores `identityOverrides`, a read
	// before the effective date returns the base authority, and a read at/after
	// it returns the override. The base bytes are unchanged by the read.
	{
		const baseSnapshot = readPublishedIdentitySnapshot(BASE_METADATA);
		assert.ok(baseSnapshot, 'base metadata carries a valid frozen snapshot');
		const baseDigest = snapshotDigest(baseSnapshot!);
		const metadataWithOverride = { ...BASE_METADATA, [IDENTITY_OVERRIDES_KEY]: QUARTERS_OVERRIDE };
		const stillBase = readPublishedIdentitySnapshot(metadataWithOverride);
		assert.ok(stillBase, 'base reader still validates the snapshot alongside overrides');
		assert.equal(snapshotDigest(stillBase!), baseDigest, 'base reader ignores identityOverrides (failing-first on the base behaviour)');

		const overrideRevision = { id: 901, status: 'SCHEDULED', effectiveDate: '2030-01-03T00:00:00.000Z', metadata: metadataWithOverride };
		const before = resolveEffectiveIdentitySnapshot({ baseMetadata: BASE_METADATA, revisions: [overrideRevision], asOf: '2030-01-02T00:00:00.000Z' });
		assert.equal(before!.orderedTermContract.format, 'TRIMESTER', 'read before the effective date returns the base authority');
		const after = resolveEffectiveIdentitySnapshot({ baseMetadata: BASE_METADATA, revisions: [overrideRevision], asOf: '2030-01-04T00:00:00.000Z' });
		assert.equal(after!.orderedTermContract.format, 'QUARTERS', 'read at/after the effective date returns the override authority');
		assert.notEqual(snapshotDigest(after!), baseDigest, 'effective snapshot differs from the base');
		const superseded = resolveEffectiveIdentitySnapshot({
			baseMetadata: BASE_METADATA,
			revisions: [{ ...overrideRevision, status: 'SUPERSEDED' }],
			asOf: '2030-01-04T00:00:00.000Z',
		});
		assert.equal(superseded!.orderedTermContract.format, 'TRIMESTER', 'a superseded revision override no longer governs');
		assert.equal(snapshotDigest(readPublishedIdentitySnapshot(BASE_METADATA)!), baseDigest, 'the base snapshot is byte-identical after the reads');
	}

	// Row 2 — VALIDATION + mutant control. A malformed override is a typed 422;
	// an inconsistent override is a typed 422; the same unvalidated merge is shown
	// by the canonical validator to be inconsistent, so a mutant that skipped the
	// override validation would accept it.
	{
		assert.throws(
			() => readIdentityOverrides({ bogus: 1 }),
			(error: any) => error?.code === 'PUBLISHED_IDENTITY_OVERRIDE_INVALID' && error?.statusCode === 422,
			'unknown override fields are a typed 422',
		);
		const baseSnapshot = readPublishedIdentitySnapshot(BASE_METADATA)!;
		assert.throws(
			() => applyIdentityOverrides(baseSnapshot, INCONSISTENT_OVERRIDE as any),
			(error: any) => error?.code === 'PUBLISHED_IDENTITY_OVERRIDE_INCONSISTENT' && error?.statusCode === 422,
			'an inconsistent override is a typed 422',
		);
		// Mutant control: the raw spread (what a validation-skipping mutant would
		// accept) IS inconsistent under the canonical rule.
		assert.throws(
			() => assertSnapshotConsistency({ ...baseSnapshot, specialEvents: [FLAG_EVENT] } as any),
			(error: any) => error?.code === 'PUBLICATION_SNAPSHOT_INCONSISTENT',
			'canonical validator rejects the unvalidated merge (load-bearing control)',
		);
		assert.deepEqual(readIdentityOverrides(QUARTERS_OVERRIDE), QUARTERS_OVERRIDE, 'a valid override round-trips structurally');
	}

	// Row 3 — the real create service rejects an invalid override with a typed 4xx
	// and zero writes (both unknown-field and inconsistent shapes).
	{
		for (const [label, override, code] of [
			['unknown field', { bogus: 1 }, 'PUBLISHED_IDENTITY_OVERRIDE_INVALID'],
			['inconsistent events', INCONSISTENT_OVERRIDE, 'PUBLISHED_IDENTITY_OVERRIDE_INCONSISTENT'],
		] as const) {
			const fixture = makeFixture();
			let captured: any = null;
			await assert.rejects(
				() => withDataContext(fixture.client, () => createPublishedScheduleRevision(
					{ ...baseInput, changes: ROOM_MOVE, metadata: { [IDENTITY_OVERRIDES_KEY]: override } },
					{ now: FIXED_NOW, computeInputSnapshot: fixture.computeInputSnapshot, publishEvent: () => undefined },
				)),
				(error: any) => { captured = error; return error?.code === code && error?.statusCode >= 400 && error?.statusCode < 500; },
				`invalid override (${label}) fails closed typed`,
			);
			assert.ok(captured, `typed error captured for ${label}`);
			assert.deepEqual(fixture.counts(), { revisions: 0, audits: 0 }, `invalid override (${label}) writes nothing`);
		}
	}

	// Row 4 — IMMUTABILITY: a valid override revision persists the delta on its
	// own metadata, the base snapshot stays byte-identical, and the effective read
	// resolves it by effective date.
	{
		const fixture = makeFixture();
		const beforeDigest = fixture.baseSnapshotDigest();
		const result = await withDataContext(fixture.client, () => createPublishedScheduleRevision(
			{ ...baseInput, changes: ROOM_MOVE, metadata: { [IDENTITY_OVERRIDES_KEY]: QUARTERS_OVERRIDE } },
			{ now: FIXED_NOW, computeInputSnapshot: fixture.computeInputSnapshot, publishEvent: () => undefined },
		));
		assert.equal(result.replayed, false);
		assert.deepEqual((result.revision.metadata as any)[IDENTITY_OVERRIDES_KEY], QUARTERS_OVERRIDE, 'override delta is persisted on the revision metadata');
		assert.deepEqual(fixture.counts(), { revisions: 1, audits: 1 }, 'exactly one revision and one audit row');
		assert.equal((fixture.state.revisions[0].metadata as any).publishedIdentitySnapshot, undefined, 'the override revision does not carry or replace a base snapshot');
		// The base is never mutated: the base object equals a pre-captured clone
		// and its frozen digest is unchanged.
		assert.deepEqual(BASE_METADATA, fixture.baseClone, 'base metadata object unchanged by the override revision');
		assert.equal(fixture.baseSnapshotDigest(), beforeDigest, 'base frozen digest is byte-identical after an override revision');

		const after = await withDataContext(fixture.client, () => resolveEffectivePublishedIdentitySnapshot({
			schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, sourceRunId: RUN_ID, asOf: '2030-01-04T00:00:00.000Z',
		}));
		assert.equal(after.state, 'FROZEN');
		assert.equal(after.snapshot!.orderedTermContract.format, 'QUARTERS', 'effective read returns the override at/after its date');
		assert.deepEqual(after.appliedRevisionIds, [fixture.state.revisions[0].id], 'the applied override revision is reported');
		const before = await withDataContext(fixture.client, () => resolveEffectivePublishedIdentitySnapshot({
			schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, sourceRunId: RUN_ID, asOf: '2030-01-02T00:00:00.000Z',
		}));
		assert.equal(before.snapshot!.orderedTermContract.format, 'TRIMESTER', 'effective read before the date returns the base authority');
		assert.deepEqual(before.appliedRevisionIds, [], 'no override applies before its effective date');
	}

	// Row 5 — WITHDRAW/supersede on the real HTTP route: reason-required typed 4xx
	// with zero writes, actor-school + role gates, one audit row, base intact, and
	// idempotent replay without a second audit row.
	{
		const fixture = makeFixture();
		fixture.seedRevision({ id: 901, status: 'SCHEDULED', effectiveDate: new Date('2030-01-03T00:00:00.000Z'), sourceRevisionId: BASE_REVISION_ID, reason: 'published repair', changeSet: [], metadata: { idempotencyKey: 'seed-901', [IDENTITY_OVERRIDES_KEY]: QUARTERS_OVERRIDE } });
		const baseDigest = fixture.baseSnapshotDigest();
		const { default: app } = await import('../app.js');
		const sign = (payload: object) => jwt.sign({ authSource: 'local', ...payload }, process.env.JWT_SECRET!);
		await withDataContext(fixture.client, async () => {
			const server = createServer(app);
			await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
			try {
				const address = server.address();
				assert(address && typeof address === 'object');
				const origin = `http://127.0.0.1:${address.port}`;
				const url = `${origin}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/published-revisions/901/withdraw`;
				const post = (body: any, token: string) => fetch(url, {
					method: 'POST',
					headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
					body: JSON.stringify(body),
				});
				const officer = sign({ userId: ACTOR_ID, role: 'officer', schoolId: SCHOOL_ID });

				const missing = await post({}, officer);
				assert.equal(missing.status, 400, 'missing reason fails closed');
				assert.equal((await missing.json() as any).code, 'REVISION_REASON_REQUIRED');
				assert.deepEqual(fixture.counts(), { revisions: 1, audits: 0 }, 'missing reason writes nothing');

				const blank = await post({ reason: '   ' }, officer);
				assert.equal(blank.status, 400, 'blank reason fails closed');

				const cross = await post({ reason: 'cross-school attempt' }, sign({ userId: ACTOR_ID, role: 'officer', schoolId: 52 }));
				assert.equal(cross.status, 403, 'cross-school actor fails closed');
				assert.equal((await cross.json() as any).code, 'CROSS_SCHOOL_DENIED');
				const teacher = await post({ reason: 'teacher attempt' }, sign({ userId: 42, role: 'teacher', schoolId: SCHOOL_ID }));
				assert.equal(teacher.status, 403, 'non-privileged role fails closed');
				assert.equal((await teacher.json() as any).code, 'FORBIDDEN');
				assert.deepEqual(fixture.counts(), { revisions: 1, audits: 0 }, 'authority rejections write nothing');

				const valid = await post({ reason: 'Mis-dated revision withdrawn' }, officer);
				assert.equal(valid.status, 200, 'valid withdraw succeeds on the real route');
				const validBody = await valid.json() as any;
				assert.equal(validBody.replayed, false);
				assert.equal(validBody.revision.status, 'SUPERSEDED', 'the revision is superseded');
				assert.deepEqual(fixture.counts(), { revisions: 1, audits: 1 }, 'valid withdraw writes exactly one audit row and no revision');
				assert.equal(fixture.state.audits[0].action, 'PUBLISHED_SCHEDULE_REVISION_WITHDRAWN');
				assert.equal(fixture.state.audits[0].targetIds.includes(901), true, 'the audit targets the withdrawn revision');
				assert.equal(fixture.revisionById(901)?.metadata.withdrawn, true, 'withdrawal is recorded on the revision metadata');
				assert.equal(fixture.revisionById(901)?.metadata.withdrawReason, 'Mis-dated revision withdrawn');
				assert.equal(fixture.baseSnapshotDigest(), baseDigest, 'the base frozen snapshot is intact after withdraw');

				const replay = await post({ reason: 'Mis-dated revision withdrawn' }, officer);
				assert.equal(replay.status, 200);
				assert.equal((await replay.json() as any).replayed, true, 'repeated withdraw replays idempotently');
				assert.deepEqual(fixture.counts(), { revisions: 1, audits: 1 }, 'replay writes no second audit row');

				const baseUrl = `${origin}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/published-revisions/${BASE_REVISION_ID}/withdraw`;
				const baseAttempt = await fetch(baseUrl, {
					method: 'POST',
					headers: { authorization: `Bearer ${officer}`, 'content-type': 'application/json' },
					body: JSON.stringify({ reason: 'try to withdraw the base' }),
				});
				assert.equal(baseAttempt.status, 409, 'the immutable base revision cannot be withdrawn');
				assert.equal((await baseAttempt.json() as any).code, 'PUBLISHED_REVISION_BASE_IMMUTABLE');
				assert.deepEqual(fixture.counts(), { revisions: 1, audits: 1 }, 'base-withdraw rejection writes nothing');
			} finally {
				await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
			}
		});
	}

	// Row 6 — PRESERVE: the direct-edit/swap guard on a published run is unchanged.
	{
		assert.throws(
			() => assertRunIsEditable({ isPublished: true }),
			(error: any) => error?.code === 'RUN_ALREADY_PUBLISHED' && error?.statusCode === 409,
			'RUN_ALREADY_PUBLISHED still blocks direct edits and swaps',
		);
		assert.doesNotThrow(() => assertRunIsEditable({ isPublished: false }), 'unpublished runs stay editable');
	}

	console.log('published revision identity S4: all checks passed');
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
