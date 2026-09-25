import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import jwt from 'jsonwebtoken';

import { withDataContext } from '../lib/data-context.js';
import {
	createPublishedScheduleRevision,
	createPublishedSwapRevision,
	previewPublishedScheduleRevision,
} from '../services/published-revision.service.js';
import { assertRunIsEditable } from '../services/manual-edit.service.js';
import { POLICY_DEFAULTS, isPromotableConstraintCode } from '../services/scheduling-policy.service.js';
import type { GenerationInputSnapshot } from '../services/generation-input-snapshot.service.js';

// PUBLISHED-REVISION-AUTHORITY-C12 — production-path evidence for R1-R4.
// Every row exercises the real service or the real HTTP route against a
// hermetic fake client (DATABASE_URL unset). A helper-only or source-string
// assertion is not evidence.

const SCHOOL_ID = 51;
const SCHOOL_YEAR_ID = 81;
const RUN_ID = 91;
const BASE_REVISION_ID = 700;
const ACTOR_ID = 41;
const FIXED_NOW = new Date('2030-01-02T03:04:05.000Z');

process.env.JWT_SECRET = 'published-revision-authority-c12-secret';

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

function snap(fingerprint: string, roomFingerprint = 'rooms-same'): GenerationInputSnapshot {
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
			rooms: domain(roomFingerprint),
			sections: domain('sections-same'),
			subjects: domain('subjects-same'),
			derivedDemand: domain('demand-same'),
			availability: domain('availability-same'),
		},
	};
}

type FixtureOptions = {
	entries?: Entry[];
	rooms?: Array<Record<string, any>>;
	qualifications?: Array<{ facultyId: number; subjectId: number; sectionIds: number[] }>;
	sections?: Array<{ id: number; enrolledCount: number }>;
	policy?: Record<string, any>;
	snapshots?: GenerationInputSnapshot[];
};

function makeFixture(options: FixtureOptions = {}) {
	const entries: Entry[] = options.entries ?? [
		slotEntry('e-1'),
		slotEntry('e-2', { facultyId: 21, roomId: 31, subjectId: 41, sectionId: 11, startTime: '08:15', endTime: '09:00' }),
	];
	const rooms: Array<Record<string, any>> = options.rooms ?? [
		{ id: 30, type: 'CLASSROOM', capacity: 40 },
		{ id: 31, type: 'CLASSROOM', capacity: 40 },
		{ id: 32, type: 'CLASSROOM', capacity: 40 },
		{ id: 33, type: 'CLASSROOM', capacity: 20 },
	];
	const qualifications = options.qualifications ?? [
		{ facultyId: 20, subjectId: 40, sectionIds: [10] },
		{ facultyId: 21, subjectId: 41, sectionIds: [11] },
		{ facultyId: 20, subjectId: 41, sectionIds: [11] },
	];
	const sections = options.sections ?? [
		{ id: 10, enrolledCount: 30 },
		{ id: 11, enrolledCount: 30 },
	];
	const policy = { ...POLICY_DEFAULTS, ...(options.policy ?? {}) };
	const snapshots = options.snapshots ?? [snap('fp-stable')];
	let snapshotCalls = 0;

	const state = { revisions: [] as any[], audits: [] as any[], nextRevisionId: 901, nextAuditId: 902 };
	const baseEffectiveDate = new Date('2030-01-01T00:00:00.000Z');
	const runSummary = {
		isPublished: true,
		publishedAt: FIXED_NOW.toISOString(),
		publication: { revisionId: BASE_REVISION_ID, sourceRunVersion: 5 },
	};

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
	const facultyIds = [...new Set(entries.map((entry) => entry.facultyId).filter((id) => id != null))];
	const facultyRows = facultyIds.map((id) => ({ id, firstName: `First${id}`, lastName: `Last${id}`, maxHoursPerWeek: 40, ancillaryMinutesPerWeek: 0 }));
	const subjectIds = [...new Set(entries.map((entry) => entry.subjectId).filter((id) => id != null))];
	const subjectRows = subjectIds.map((id) => ({ id, code: `S${id}`, name: `Subject ${id}`, minMinutesPerWeek: 45, preferredRoomType: 'CLASSROOM', requiredFeatures: [], gradeLevels: [7] }));

	const tx: any = {
		$executeRawUnsafe: async () => 1,
		$queryRawUnsafe: async (query: string, ...params: unknown[]) => {
			if (query.includes('faculty_mirrors')) {
				return [{ teachingLoad: 'tl', policy: 'pl', rooms: 'rm', sections: 'sc', subjects: 'sb', availability: 'av' }];
			}
			const ids = (params[1] ?? entries.map((entry) => entry.entryId)) as string[];
			return entries.filter((entry) => ids.includes(entry.entryId)).map((entry) => ({ entryId: entry.entryId, entry }));
		},
		enrollProSchoolYearMirror: {
			findMany: async () => [{ enrollProSchoolYearId: SCHOOL_YEAR_ID }],
			findUnique: async ({ where }: any) => {
				const key = where?.schoolId_enrollProSchoolYearId ?? {};
				return { isActive: true, isArchived: false, termContractCachedAt: new Date(), termContractCache: { ...validTermCache(key.schoolId, key.enrollProSchoolYearId), activeTerm: { order: 1 } } };
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
				if (where.id === BASE_REVISION_ID) {
					return { id: BASE_REVISION_ID, effectiveDate: baseEffectiveDate, sourceRevisionId: null, reason: 'INITIAL_PUBLICATION', metadata: { publicationBase: true, sourceRunVersion: 5 } };
				}
				return state.revisions.find((row) => where.id ? row.id === where.id : row.metadata?.idempotencyKey === where.metadata?.equals) ?? null;
			},
			findMany: async () => [
				{ id: BASE_REVISION_ID, effectiveDate: baseEffectiveDate, changeSet: [] },
				...state.revisions.map((row) => ({ id: row.id, effectiveDate: row.effectiveDate, changeSet: row.changeSet })),
			],
			create: async ({ data }: any) => { const row = { id: state.nextRevisionId++, ...data }; state.revisions.push(row); return row; },
		},
		auditLog: {
			findFirst: async ({ where }: any) => state.audits.find((row) => row.targetIds.includes(where.targetIds.has)) ?? null,
			create: async ({ data }: any) => { const row = { id: state.nextAuditId++, ...data }; state.audits.push(row); return row; },
		},
		facultyMirror: { findMany: async () => facultyRows },
		facultySubject: { findMany: async () => qualifications.map((q) => ({ ...q, gradeLevels: [7] })) },
		room: { findMany: async () => rooms.map(roomRow) },
		subject: { findMany: async () => subjectRows },
		schedulingPolicy: { findUnique: async () => ({ id: 1, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, ...policy, createdAt: FIXED_NOW, updatedAt: FIXED_NOW }) },
		building: { findMany: async () => [{ id: 1, x: 0, y: 0 }] },
		sectionSnapshot: {
			findUnique: async () => ({
				payload: [{
					gradeLevelId: 7, gradeLevelName: 'Grade 7', displayOrder: 1,
					sections: sections.map((section) => ({ id: section.id, name: `Section ${section.id}`, enrolledCount: section.enrolledCount })),
				}],
			}),
		},
		policySpecialEvent: { findMany: async () => [] },
		gradeShiftWindow: { findMany: async () => [] },
		classProgramSlot: { findMany: async () => [] },
	};
	// Aggregate delegates so the DEFAULT canonical snapshot binding
	// (`computeGenerationInputSnapshot`) also runs hermetically on the real
	// route path. All signals are constant, so the pre-validation and
	// pre-commit reads agree (FRESH) unless a test injects a scripted stub.
	const zeroAggregate = () => async () => ({ _count: { _all: 0 }, _max: { id: null, updatedAt: null, createdAt: null } });
	tx.facultyMirror.aggregate = zeroAggregate();
	tx.facultySubject.aggregate = zeroAggregate();
	tx.subjectSectionOwnership = { aggregate: zeroAggregate() };
	tx.teachingLoadCycle = { findUnique: async () => null };
	tx.gradeShiftWindow.aggregate = zeroAggregate();
	tx.policySpecialEvent.aggregate = zeroAggregate();
	tx.room.aggregate = zeroAggregate();
	tx.building.aggregate = zeroAggregate();
	tx.sectionMirror = { aggregate: zeroAggregate(), findMany: async () => [] };
	tx.subject.aggregate = zeroAggregate();
	tx.classTemplate = { aggregate: async () => ({ _count: { _all: 0 }, _max: { id: null, createdAt: null } }) };
	tx.classTemplateSubject = { aggregate: async () => ({ _count: { _all: 0 }, _max: { id: null, createdAt: null } }) };
	tx.facultyPreference = { aggregate: zeroAggregate() };
	tx.preferenceTimeSlot = { aggregate: async () => ({ _count: { _all: 0 }, _max: { id: null, createdAt: null } }) };
	// TEACHER-AVAILABILITY-AUTHORITY-C01: availability domain source.
	tx.facultyAvailability = { aggregate: zeroAggregate() };
	tx.facultyAvailabilitySlot = { aggregate: async () => ({ _count: { _all: 0 }, _max: { id: null, createdAt: null } }) };
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
	const computeInputSnapshot = async () => {
		const index = Math.min(snapshotCalls, snapshots.length - 1);
		snapshotCalls += 1;
		return snapshots[index];
	};
	const counts = () => ({ revisions: state.revisions.length, audits: state.audits.length });
	return { client, state, counts, computeInputSnapshot };
}

const baseInput = {
	schoolId: SCHOOL_ID,
	schoolYearId: SCHOOL_YEAR_ID,
	sourceRunId: RUN_ID,
	sourceRevisionId: BASE_REVISION_ID,
	actorId: ACTOR_ID,
	effectiveDate: '2030-01-03T00:00:00.000Z',
	reason: 'Authority evidence revision',
};

async function main() {
	// Row 1 — a revision that introduces a HARD violation is rejected with a
	// typed error and zero writes. Moving e-2 onto e-1's faculty + slot
	// produces FACULTY_TIME_CONFLICT (HARD severity, promotable code — the
	// exact publication-gate classification).
	{
		const fixture = makeFixture();
		const conflicting = {
			entryId: 'e-2',
			previous: { facultyId: 21, startTime: '08:15', endTime: '09:00' },
			next: { facultyId: 20, startTime: '07:30', endTime: '08:15' },
		};
		let captured: any = null;
		await assert.rejects(
			() => withDataContext(fixture.client, () => createPublishedScheduleRevision(
				{ ...baseInput, changes: [conflicting] },
				{ now: FIXED_NOW, computeInputSnapshot: fixture.computeInputSnapshot },
			)),
			(error: any) => { captured = error; return error?.code === 'PUBLISHED_REVISION_BLOCKED_HARD_VIOLATIONS'; },
			'HARD revision fails closed',
		);
		assert.ok((captured?.details?.blockingHardViolationCount ?? 0) >= 1, 'typed error carries the blocking HARD count');
		assert.ok((captured?.details?.violations ?? []).some((v: any) => v.code === 'FACULTY_TIME_CONFLICT' && v.severity === 'HARD'), 'conflict is attributed to the canonical code');
		assert.deepEqual(fixture.counts(), { revisions: 0, audits: 0 }, 'HARD rejection writes nothing');
	}

	// Row 2a — a revision that introduces only a soft violation is accepted,
	// and the soft classification is preserved and surfaced, not dropped.
	// Room 33 (capacity 20) overflows section 10 (enrolled 30):
	// ROOM_CAPACITY_EXCEEDED is canonically SOFT.
	{
		const fixture = makeFixture();
		const result = await withDataContext(fixture.client, () => createPublishedScheduleRevision(
			{ ...baseInput, changes: [{ entryId: 'e-1', previous: { roomId: 30 }, next: { roomId: 33 } }] },
			{ now: FIXED_NOW, computeInputSnapshot: fixture.computeInputSnapshot },
		));
		assert.equal(result.replayed, false);
		assert.equal(result.validation?.blockingHardViolationCount, 0);
		assert.equal(result.validation?.softViolationCount, 1);
		assert.ok(result.validation?.softViolations.some((v) => v.code === 'ROOM_CAPACITY_EXCEEDED' && v.severity === 'SOFT'), 'soft classification preserved and surfaced');
		assert.equal(fixture.state.audits[0]?.metadata?.softViolationCount, 1, 'soft count persisted in the audit record');
		assert.deepEqual(fixture.counts(), { revisions: 1, audits: 1 });
	}

	// Row 2b — the consumed classification is exactly the publication gate's:
	// HARD severity alone does not block; only HARD + promotable blocks. Four
	// back-to-back periods (180 min > 90 min policy max) with
	// enforceConsecutiveBreakAsHard produce a HARD-severity
	// FACULTY_CONSECUTIVE_LIMIT_EXCEEDED, which is NOT promotable, so the
	// revision is accepted with blockingHardViolationCount 0.
	{
		const block = ['07:30/08:15', '08:15/09:00', '09:00/09:45', '09:45/10:30'].map((range, index) => {
			const [start, end] = range.split('/');
			return slotEntry(`g-${index + 1}`, { roomId: 30, startTime: start, endTime: end });
		});
		const fixture = makeFixture({
			entries: block,
			qualifications: [{ facultyId: 20, subjectId: 40, sectionIds: [10] }],
			sections: [{ id: 10, enrolledCount: 30 }],
			policy: { maxConsecutiveTeachingMinutesBeforeBreak: 90, enforceConsecutiveBreakAsHard: true },
		});
		const result = await withDataContext(fixture.client, () => createPublishedScheduleRevision(
			{ ...baseInput, changes: [{ entryId: 'g-1', previous: { roomId: 30 }, next: { roomId: 31 } }] },
			{ now: FIXED_NOW, computeInputSnapshot: fixture.computeInputSnapshot },
		));
		assert.equal(result.replayed, false, 'non-promotable HARD does not block');
		assert.equal(result.validation?.blockingHardViolationCount, 0);
		assert.ok((result.validation?.hardViolationCount ?? 0) >= 1, 'a HARD-severity violation was actually present');
		assert.ok((result.validation?.hardCodes.length ?? 0) >= 1, 'the HARD code is surfaced');
		for (const code of result.validation?.hardCodes ?? []) assert.ok(!isPromotableConstraintCode(code), `${code} is not promotable`);
		assert.deepEqual(fixture.counts(), { revisions: 1, audits: 1 });
	}

	// Row 3 — a clean revision still succeeds on the real route with exactly
	// one revision row and one audit row.
	{
		const fixture = makeFixture();
		const { default: app } = await import('../app.js');
		const officer = jwt.sign({ userId: ACTOR_ID, role: 'officer', schoolId: SCHOOL_ID, authSource: 'local' }, process.env.JWT_SECRET!);
		await withDataContext(fixture.client, async () => {
			const server = createServer(app);
			await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
			try {
				const address = server.address();
				assert(address && typeof address === 'object');
				const url = `http://127.0.0.1:${address.port}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/published-revisions`;
				const response = await fetch(url, {
					method: 'POST',
					headers: { authorization: `Bearer ${officer}`, 'content-type': 'application/json' },
					body: JSON.stringify({
						effectiveDate: '2030-01-03', reason: 'clean room move',
						sourceRevisionId: BASE_REVISION_ID,
						changes: [{ entryId: 'e-1', previous: { roomId: 30 }, next: { roomId: 32 } }],
					}),
				});
				assert.equal(response.status, 201, 'clean revision succeeds on the real route');
				const body = await response.json() as any;
				assert.equal(body.replayed, false);
				assert.equal(body.validation?.blockingHardViolationCount, 0);
				assert.deepEqual(fixture.counts(), { revisions: 1, audits: 1 }, 'real route writes exactly one revision and one audit');
			} finally {
				await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
			}
		});
	}

	// Row 4 — stale-source interleave fails closed. The scripted snapshot
	// stub returns one fingerprint at validation time and a different rooms
	// fingerprint at pre-commit time; the write must abort with the typed
	// stale error and zero writes.
	{
		const fixture = makeFixture({ snapshots: [snap('fp-before'), snap('fp-after', 'rooms-changed')] });
		let captured: any = null;
		await assert.rejects(
			() => withDataContext(fixture.client, () => createPublishedScheduleRevision(
				{ ...baseInput, changes: [{ entryId: 'e-1', previous: { roomId: 30 }, next: { roomId: 32 } }] },
				{ now: FIXED_NOW, computeInputSnapshot: fixture.computeInputSnapshot },
			)),
			(error: any) => { captured = error; return error?.code === 'PUBLISHED_REVISION_INPUTS_STALE'; },
			'stale inputs fail closed',
		);
		assert.ok((captured?.details?.changedDomains ?? []).includes('rooms'), 'changed domain attributed');
		assert.deepEqual(fixture.counts(), { revisions: 0, audits: 0 }, 'stale abort writes nothing');
	}

	// Row 5 — actor-school / actor-year authority on the real route: missing
	// JWT, non-privileged role, cross-school actor, and malformed scope all
	// fail closed with zero downstream dispatch and zero writes.
	{
		const fixture = makeFixture();
		const { default: app } = await import('../app.js');
		const sign = (payload: object) => jwt.sign({ authSource: 'local', ...payload }, process.env.JWT_SECRET!);
		await withDataContext(fixture.client, async () => {
			const server = createServer(app);
			await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
			try {
				const address = server.address();
				assert(address && typeof address === 'object');
				const origin = `http://127.0.0.1:${address.port}`;
				const url = `${origin}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/published-revisions`;
				const body = JSON.stringify({
					effectiveDate: '2030-01-03', reason: 'unauthorized attempt',
					sourceRevisionId: BASE_REVISION_ID,
					changes: [{ entryId: 'e-1', previous: { roomId: 30 }, next: { roomId: 32 } }],
				});
				const noAuth = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
				assert.equal(noAuth.status, 401, 'missing JWT fails closed');
				const teacher = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${sign({ userId: 42, role: 'teacher', schoolId: SCHOOL_ID })}`, 'content-type': 'application/json' }, body });
				assert.equal(teacher.status, 403, 'non-privileged role fails closed');
				assert.equal((await teacher.json() as any).code, 'FORBIDDEN');
				const cross = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${sign({ userId: ACTOR_ID, role: 'officer', schoolId: 52 })}`, 'content-type': 'application/json' }, body });
				assert.equal(cross.status, 403, 'cross-school actor fails closed');
				assert.equal((await cross.json() as any).code, 'CROSS_SCHOOL_DENIED');
				const malformed = await fetch(`${origin}/api/v1/generation/abc/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/published-revisions`, { method: 'POST', headers: { authorization: `Bearer ${sign({ userId: ACTOR_ID, role: 'officer', schoolId: SCHOOL_ID })}`, 'content-type': 'application/json' }, body });
				assert.equal(malformed.status, 400, 'malformed scope fails closed');
				assert.equal((await malformed.json() as any).code, 'INVALID_PARAM');
				assert.deepEqual(fixture.counts(), { revisions: 0, audits: 0 }, 'authority rejections dispatch and write nothing');
			} finally {
				await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
			}
		});
	}

	// Row 6a — the supported published-safe swap succeeds on the real route.
	{
		const fixture = makeFixture();
		const { default: app } = await import('../app.js');
		const officer = jwt.sign({ userId: ACTOR_ID, role: 'officer', schoolId: SCHOOL_ID, authSource: 'local' }, process.env.JWT_SECRET!);
		await withDataContext(fixture.client, async () => {
			const server = createServer(app);
			await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
			try {
				const address = server.address();
				assert(address && typeof address === 'object');
				const url = `http://127.0.0.1:${address.port}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/published-revisions/swap`;
				const response = await fetch(url, {
					method: 'POST',
					headers: { authorization: `Bearer ${officer}`, 'content-type': 'application/json' },
					body: JSON.stringify({
						effectiveDate: '2030-01-03', reason: 'swap two slots after publication',
						sourceRevisionId: BASE_REVISION_ID, entryIdA: 'e-1', entryIdB: 'e-2',
					}),
				});
				assert.equal(response.status, 201, 'published-safe swap succeeds on the real route');
				const body = await response.json() as any;
				assert.equal(body.revision.changeSet.length, 2, 'swap persists exactly two entry changes');
				const byId = new Map<string, any>(body.revision.changeSet.map((change: any) => [change.entryId, change]));
				assert.deepEqual(byId.get('e-1')?.next, { day: 'MONDAY', startTime: '08:15', endTime: '09:00' }, 'e-1 takes e-2 slot');
				assert.deepEqual(byId.get('e-2')?.next, { day: 'MONDAY', startTime: '07:30', endTime: '08:15' }, 'e-2 takes e-1 slot');
				assert.deepEqual(fixture.counts(), { revisions: 1, audits: 1 });
			} finally {
				await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
			}
		});
	}

	// Row 6b — a swap that would introduce a HARD violation is rejected with
	// zero writes. e-3 shares e-1's faculty in e-2's slot, so swapping e-1
	// into that slot double-books the faculty.
	{
		const fixture = makeFixture({
			entries: [
				slotEntry('e-1'),
				slotEntry('e-2', { facultyId: 21, roomId: 31, subjectId: 41, sectionId: 11, startTime: '08:15', endTime: '09:00' }),
				slotEntry('e-3', { roomId: 32, subjectId: 40, sectionId: 12, startTime: '08:15', endTime: '09:00' }),
			],
			qualifications: [
				{ facultyId: 20, subjectId: 40, sectionIds: [10, 12] },
				{ facultyId: 21, subjectId: 41, sectionIds: [11] },
			],
			sections: [
				{ id: 10, enrolledCount: 30 },
				{ id: 11, enrolledCount: 30 },
				{ id: 12, enrolledCount: 25 },
			],
		});
		let captured: any = null;
		await assert.rejects(
			() => withDataContext(fixture.client, () => createPublishedSwapRevision(
				{ schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, sourceRunId: RUN_ID, sourceRevisionId: BASE_REVISION_ID, actorId: ACTOR_ID, effectiveDate: '2030-01-03T00:00:00.000Z', entryIdA: 'e-1', entryIdB: 'e-2' },
				{ now: FIXED_NOW, computeInputSnapshot: fixture.computeInputSnapshot },
			)),
			(error: any) => { captured = error; return error?.code === 'PUBLISHED_REVISION_BLOCKED_HARD_VIOLATIONS'; },
			'conflicting swap fails closed',
		);
		assert.ok((captured?.details?.violations ?? []).some((v: any) => v.code === 'FACULTY_TIME_CONFLICT'), 'swap conflict attributed');
		assert.deepEqual(fixture.counts(), { revisions: 0, audits: 0 }, 'conflicting swap writes nothing');
	}

	// Row 6c + R4 — the direct-swap guard stays fail-closed with 409, and the
	// copy names the real supported action instead of leaking an internal
	// workflow name. This asserts the real thrown guard error (the same error
	// object `swapManualEntries` raises via `loadRunContext` before any read
	// or write). `swapManualEntries` itself is not invoked hermetically here
	// because its run-context loader defaults to the Prisma singleton rather
	// than the ambient test context; changing that default is out of scope.
	{
		assert.throws(
			() => assertRunIsEditable({ isPublished: true }),
			(error: any) => {
				assert.equal(error?.code, 'RUN_ALREADY_PUBLISHED');
				assert.equal(error?.statusCode, 409);
				assert.doesNotMatch(error?.message ?? '', /Prompt 6/, 'no internal workflow name leaks to operators');
				assert.match(error?.message ?? '', /published-revisions\/swap/, 'refusal points at the real supported action');
				return true;
			},
			'direct edit on published run refuses truthfully',
		);
		assert.doesNotThrow(() => assertRunIsEditable({ isPublished: false }), 'unpublished runs stay editable');
	}

	// Swap input shape fails closed before any dispatch.
	{
		const fixture = makeFixture();
		await assert.rejects(
			() => withDataContext(fixture.client, () => createPublishedSwapRevision(
				{ schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, sourceRunId: RUN_ID, sourceRevisionId: BASE_REVISION_ID, actorId: ACTOR_ID, effectiveDate: '2030-01-03T00:00:00.000Z', entryIdA: 'e-1', entryIdB: 'e-1' },
				{ now: FIXED_NOW, computeInputSnapshot: fixture.computeInputSnapshot },
			)),
			(error: any) => error?.code === 'SWAP_SAME_ENTRY',
			'same-entry swap rejected',
		);
		await assert.rejects(
			() => withDataContext(fixture.client, () => createPublishedSwapRevision(
				{ schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, sourceRunId: RUN_ID, sourceRevisionId: BASE_REVISION_ID, actorId: ACTOR_ID, effectiveDate: '2030-01-03T00:00:00.000Z', entryIdA: 'e-1', entryIdB: 'missing' },
				{ now: FIXED_NOW, computeInputSnapshot: fixture.computeInputSnapshot },
			)),
			(error: any) => error?.code === 'REVISION_ENTRY_NOT_FOUND',
			'unknown-entry swap rejected',
		);
		assert.deepEqual(fixture.counts(), { revisions: 0, audits: 0 }, 'malformed swaps write nothing');
	}

	// LANE-C POST-PUBLISH-C01 — the dry run. The 2026-09-25 live audit found the
	// teacher-leaving wizard learned of a clash only at the final save, with a
	// message naming neither the teacher nor the class. These rows pin the
	// preview that runs the same checks earlier and names what collides.

	// Row P1 — a clashing change previews its clash by name, with zero writes.
	// The same change as Row 1: e-2 moves onto faculty 20 in e-1's slot.
	{
		const fixture = makeFixture();
		const preview = await withDataContext(fixture.client, () => previewPublishedScheduleRevision(
			{ schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, sourceRunId: RUN_ID, sourceRevisionId: BASE_REVISION_ID, actorId: ACTOR_ID, changes: [{
				entryId: 'e-2',
				previous: { facultyId: 21, startTime: '08:15', endTime: '09:00' },
				next: { facultyId: 20, startTime: '07:30', endTime: '08:15' },
			}] },
			{ now: FIXED_NOW, computeInputSnapshot: fixture.computeInputSnapshot },
		));
		assert.ok(preview.blockingHardViolationCount >= 1, 'preview reports the blocking count the commit would refuse');
		const clash = preview.clashes.find((c) => c.code === 'FACULTY_TIME_CONFLICT');
		assert.ok(clash, 'the faculty clash is reported');
		assert.equal(clash.title, 'Teacher double-booked', 'headline is operator language, not a code');
		assert.match(clash.action, /another qualified teacher|Move one class/, 'a next action is given');
		assert.equal(clash.facultyId, 20, 'the clashing teacher is identified');
		const ids = clash.entries.map((entry) => entry.entryId).sort();
		assert.deepEqual(ids, ['e-1', 'e-2'], 'both colliding classes are named');
		assert.equal(clash.entries.find((entry) => entry.entryId === 'e-2')?.changed, true, 'the changed class is marked');
		assert.equal(clash.entries.find((entry) => entry.entryId === 'e-1')?.changed, false, 'the existing class it hits is marked');
		assert.equal(clash.entries.find((entry) => entry.entryId === 'e-1')?.sectionId, 10, 'the existing class carries its section');
		assert.deepEqual(fixture.counts(), { revisions: 0, audits: 0 }, 'preview writes nothing');
	}

	// Row P2 — a clean change previews empty; no date or reason is needed yet.
	{
		const fixture = makeFixture();
		const preview = await withDataContext(fixture.client, () => previewPublishedScheduleRevision(
			{ schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, sourceRunId: RUN_ID, sourceRevisionId: BASE_REVISION_ID, actorId: ACTOR_ID, changes: [{ entryId: 'e-1', previous: { roomId: 30 }, next: { roomId: 32 } }] },
			{ now: FIXED_NOW, computeInputSnapshot: fixture.computeInputSnapshot },
		));
		assert.equal(preview.blockingHardViolationCount, 0);
		assert.deepEqual(preview.clashes, []);
		assert.equal(preview.changeCount, 1);
		assert.equal(preview.alreadyScheduled, false);
		assert.deepEqual(fixture.counts(), { revisions: 0, audits: 0 }, 'clean preview writes nothing');
		// Control: the same change commits, so the preview agreed with the write.
		const committed = await withDataContext(fixture.client, () => createPublishedScheduleRevision(
			{ ...baseInput, changes: [{ entryId: 'e-1', previous: { roomId: 30 }, next: { roomId: 32 } }] },
			{ now: FIXED_NOW, computeInputSnapshot: fixture.computeInputSnapshot },
		));
		assert.equal(committed.validation?.blockingHardViolationCount, 0);
		assert.deepEqual(fixture.counts(), { revisions: 1, audits: 1 });
	}

	// Row P3 — a refused commit carries the named clashes and a truthful hint
	// (the old client fallback told users to re-check the date and reason).
	{
		const fixture = makeFixture();
		let captured: any = null;
		await assert.rejects(
			() => withDataContext(fixture.client, () => createPublishedScheduleRevision(
				{ ...baseInput, changes: [{ entryId: 'e-2', previous: { facultyId: 21, startTime: '08:15', endTime: '09:00' }, next: { facultyId: 20, startTime: '07:30', endTime: '08:15' } }] },
				{ now: FIXED_NOW, computeInputSnapshot: fixture.computeInputSnapshot },
			)),
			(error: any) => { captured = error; return error?.code === 'PUBLISHED_REVISION_BLOCKED_HARD_VIOLATIONS'; },
		);
		assert.ok((captured?.details?.clashes ?? []).some((c: any) => c.code === 'FACULTY_TIME_CONFLICT' && c.entries.length === 2), 'refusal names the colliding classes');
		assert.ok(Array.isArray(captured?.details?.violations), 'the existing violations field is preserved');
		assert.doesNotMatch(captured?.actionHint ?? '', /effective date|reason/i, 'the hint does not blame the date or reason');
		assert.deepEqual(fixture.counts(), { revisions: 0, audits: 0 });
	}

	// Row P4 — the swap preview on the real route: the Row 6b conflict is
	// reported by name with 200 and zero writes; malformed input stays typed.
	{
		const fixture = makeFixture({
			entries: [
				slotEntry('e-1'),
				slotEntry('e-2', { facultyId: 21, roomId: 31, subjectId: 41, sectionId: 11, startTime: '08:15', endTime: '09:00' }),
				slotEntry('e-3', { roomId: 32, subjectId: 40, sectionId: 12, startTime: '08:15', endTime: '09:00' }),
			],
			qualifications: [
				{ facultyId: 20, subjectId: 40, sectionIds: [10, 12] },
				{ facultyId: 21, subjectId: 41, sectionIds: [11] },
			],
			sections: [
				{ id: 10, enrolledCount: 30 },
				{ id: 11, enrolledCount: 30 },
				{ id: 12, enrolledCount: 25 },
			],
		});
		const { default: app } = await import('../app.js');
		const officer = jwt.sign({ userId: ACTOR_ID, role: 'officer', schoolId: SCHOOL_ID, authSource: 'local' }, process.env.JWT_SECRET!);
		const outsider = jwt.sign({ userId: ACTOR_ID, role: 'officer', schoolId: SCHOOL_ID + 1, authSource: 'local' }, process.env.JWT_SECRET!);
		await withDataContext(fixture.client, async () => {
			const server = createServer(app);
			await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
			try {
				const address = server.address();
				assert(address && typeof address === 'object');
				const base = `http://127.0.0.1:${address.port}/api/v1/generation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/runs/${RUN_ID}/published-revisions`;
				const post = (path: string, token: string, body: unknown) => fetch(`${base}${path}`, {
					method: 'POST',
					headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
					body: JSON.stringify(body),
				});
				const response = await post('/swap/preview', officer, { sourceRevisionId: BASE_REVISION_ID, entryIdA: 'e-1', entryIdB: 'e-2' });
				assert.equal(response.status, 200, 'a clashing swap previews with 200, not a thrown error');
				const body = await response.json() as any;
				assert.ok(body.blockingHardViolationCount >= 1);
				assert.ok(body.clashes.some((c: any) => c.code === 'FACULTY_TIME_CONFLICT' && c.title === 'Teacher double-booked'), 'swap clash named');
				assert.deepEqual(fixture.counts(), { revisions: 0, audits: 0 }, 'swap preview writes nothing');

				const same = await post('/swap/preview', officer, { sourceRevisionId: BASE_REVISION_ID, entryIdA: 'e-1', entryIdB: 'e-1' });
				assert.equal(same.status, 400);
				assert.equal(((await same.json()) as any).code, 'SWAP_SAME_ENTRY');

				// Row P5 — the preview routes keep the write routes' gates.
				const crossSchool = await post('/preview', outsider, { sourceRevisionId: BASE_REVISION_ID, changes: [{ entryId: 'e-1', previous: { roomId: 30 }, next: { roomId: 32 } }] });
				assert.equal(crossSchool.status, 403, 'cross-school preview refused');
				assert.deepEqual(fixture.counts(), { revisions: 0, audits: 0 }, 'refused previews write nothing');
			} finally {
				await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
			}
		});
	}

	console.log('published revision authority C12: all checks passed');
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
