/**
 * TEACHER-AVAILABILITY-AUTHORITY-C01 (S1 / decisions D1/D2) — server proof.
 *
 * Production contracts exercised here:
 *  1. Reviewed-only, term-scoped binding: only `REVIEWED` rows for the persisted
 *     active ordered term reach generation; `DRAFT`/`SUBMITTED` and other terms
 *     do not. An unresolved term fails closed (never Term 1).
 *  2. `UNAVAILABLE` is a HARD exclusion: the real constructor leaves the session
 *     unplaced with `FACULTY_SLOT_UNAVAILABLE`; the omitted-authority mutant
 *     schedules it inside the window.
 *  3. `PREFERRED` is a ranked SOFT signal: it changes candidate ordering and
 *     never changes HARD counts.
 *  4. Review rejection is infeasible-aware and writes NOTHING.
 *  5. The `availability` freshness domain is sourced from the reviewed authority.
 *  6. Routes are authenticate + `timetable:edit` + actor-school scoped, with no
 *     `?? 1` default and zero dispatch on rejection.
 *  7. The legacy preference path compiles/works but is no longer a generation
 *     consumer; the legacy flag is not flipped (source-level control).
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';

import {
	constructBaseline,
	type ConstructorInput,
} from '../services/schedule-constructor.js';
import {
	GENERATION_INPUT_SNAPSHOT_SCHEMA_VERSION,
	computeGenerationInputSnapshot,
} from '../services/generation-input-snapshot.service.js';
import {
	FacultyAvailabilityError,
	loadReviewedAvailabilityForActiveTerm,
	loadReviewedAvailabilityForTerm,
	normalizeAvailabilitySlots,
	reviewAvailability,
	saveAvailabilityDraft,
	submitAvailability,
	type AvailabilitySlotInput,
} from '../services/faculty-availability.service.js';

const here = dirname(fileURLToPath(import.meta.url));
const SCHOOL_ID = 41;
const SCHOOL_YEAR_ID = 8;

// ─── Shared fake authority client ───

type FakeAvailabilityRow = {
	id: number;
	schoolId: number;
	schoolYearId: number;
	facultyId: number;
	termIndex: number;
	status: 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'REJECTED';
	version: number;
	notes: string | null;
	submittedAt: Date | null;
	reviewedBy: number | null;
	reviewedAt: Date | null;
	reviewerNotes: string | null;
	slots: AvailabilitySlotInput[];
};

const TERM_CACHE = {
	schoolId: SCHOOL_ID,
	schoolYear: { id: SCHOOL_YEAR_ID, yearLabel: '2029-2030' },
	format: 'TRIMESTER',
	terms: [
		{ identity: 'T1', displayLabel: 'First Trimester', order: 1, startDate: '2029-06-01', endDate: '2029-09-01' },
		{ identity: 'T2', displayLabel: 'Second Trimester', order: 2, startDate: '2029-09-02', endDate: '2030-01-01' },
		{ identity: 'T3', displayLabel: 'Third Trimester', order: 3, startDate: '2030-01-02', endDate: '2030-04-01' },
	],
	activeTerm: { identity: 'T2', displayLabel: 'Second Trimester', order: 2 },
};

function matchesWhere(row: FakeAvailabilityRow, where: any): boolean {
	if (!where) return true;
	if (where.schoolId != null && row.schoolId !== where.schoolId) return false;
	if (where.schoolYearId != null && row.schoolYearId !== where.schoolYearId) return false;
	if (where.facultyId != null && row.facultyId !== where.facultyId) return false;
	if (where.termIndex != null && row.termIndex !== where.termIndex) return false;
	if (where.status != null && row.status !== where.status) return false;
	return true;
}

function createFakeClient(options: {
	rows?: FakeAvailabilityRow[];
	activeTermOrder?: number | null;
	contractPresent?: boolean;
	facultyExists?: boolean;
	requiredMinutes?: number;
	periodsPerDay?: number;
	periodLengthMinutes?: number;
}) {
	const store = new Map<number, FakeAvailabilityRow>();
	let nextId = 1;
	for (const row of options.rows ?? []) {
		const withId = { ...row, id: row.id ?? nextId++ };
		store.set(withId.id, withId);
	}
	const writes: string[] = [];
	const contractPresent = options.contractPresent !== false;
	const activeTermOrder = 'activeTermOrder' in options ? options.activeTermOrder : 2;
	const facultyExists = options.facultyExists !== false;

	const project = (row: FakeAvailabilityRow) => ({ ...row, slots: row.slots.map((slot) => ({ ...slot })) });

	const client: any = {
		enrollProSchoolYearMirror: {
			findUnique: async () => contractPresent
				? {
					isActive: true,
					isArchived: false,
					termContractCachedAt: new Date('2030-01-01T00:00:00Z'),
					termContractCache: { ...TERM_CACHE, activeTerm: activeTermOrder == null ? undefined : { ...TERM_CACHE.activeTerm, order: activeTermOrder } },
				}
				: null,
		},
		facultyMirror: {
			findFirst: async () => (facultyExists ? { id: 71 } : null),
		},
		facultyAvailability: {
			findUnique: async ({ where }: any) => {
				const key = where.schoolId_schoolYearId_facultyId_termIndex;
				const row = [...store.values()].find((entry) =>
					entry.schoolId === key.schoolId && entry.schoolYearId === key.schoolYearId && entry.facultyId === key.facultyId && entry.termIndex === key.termIndex);
				return row ? project(row) : null;
			},
			findMany: async ({ where }: any) =>
				[...store.values()].filter((row) => matchesWhere(row, where)).sort((a, b) => a.facultyId - b.facultyId).map(project),
			create: async ({ data }: any) => {
				writes.push('create');
				const row: FakeAvailabilityRow = {
					id: nextId++,
					schoolId: data.schoolId,
					schoolYearId: data.schoolYearId,
					facultyId: data.facultyId,
					termIndex: data.termIndex,
					status: data.status ?? 'DRAFT',
					version: 1,
					notes: data.notes ?? null,
					submittedAt: null,
					reviewedBy: null,
					reviewedAt: null,
					reviewerNotes: null,
					slots: (data.slots?.createMany?.data ?? []).map((slot: any) => ({ day: slot.day, startTime: slot.startTime, endTime: slot.endTime, state: slot.state })),
				};
				store.set(row.id, row);
				return project(row);
			},
			update: async ({ where, data }: any) => {
				writes.push('update');
				const row = store.get(where.id);
				if (!row) throw new Error('missing row');
				if (data.version !== undefined) row.version = data.version;
				if (data.status !== undefined) row.status = data.status;
				if (data.notes !== undefined) row.notes = data.notes;
				if (data.submittedAt !== undefined) row.submittedAt = data.submittedAt;
				if (data.reviewedBy !== undefined) row.reviewedBy = data.reviewedBy;
				if (data.reviewedAt !== undefined) row.reviewedAt = data.reviewedAt;
				if (data.reviewerNotes !== undefined) row.reviewerNotes = data.reviewerNotes;
				if (data.slots?.createMany?.data) {
					row.slots = data.slots.createMany.data.map((slot: any) => ({ day: slot.day, startTime: slot.startTime, endTime: slot.endTime, state: slot.state }));
				}
				return project(row);
			},
		},
		facultyAvailabilitySlot: {
			deleteMany: async () => { writes.push('slot.deleteMany'); },
			createMany: async () => { writes.push('slot.createMany'); },
		},
		facultySubject: {
			findMany: async () => (options.requiredMinutes && options.requiredMinutes > 0 ? [{ subjectId: 11 }] : []),
		},
		subject: {
			findMany: async () => [{ id: 11, minMinutesPerWeek: options.requiredMinutes ?? 0 }],
		},
		schedulingPolicy: {
			findUnique: async () => ({ periodsPerDay: options.periodsPerDay ?? 8, periodLengthMinutes: options.periodLengthMinutes ?? 45 }),
		},
	};
	return { client, store, writes };
}

function reviewedRow(slots: AvailabilitySlotInput[], overrides: Partial<FakeAvailabilityRow> = {}): FakeAvailabilityRow {
	return {
		id: 1, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, facultyId: 71, termIndex: 2, status: 'REVIEWED', version: 3,
		notes: null, submittedAt: new Date('2030-01-01T00:00:00Z'), reviewedBy: 9, reviewedAt: new Date('2030-01-02T00:00:00Z'), reviewerNotes: null,
		slots, ...overrides,
	};
}

const ALL_WEEK_UNAVAILABLE: AvailabilitySlotInput[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']
	.map((day) => ({ day: day as AvailabilitySlotInput['day'], startTime: '06:00', endTime: '13:00', state: 'UNAVAILABLE' }));

// ─── 1. Binding: reviewed-only, term-scoped, fail-closed ───

test('reviewed-only and term-scoped: DRAFT/SUBMITTED and other terms never reach generation', async () => {
	const { client } = createFakeClient({
		rows: [
			reviewedRow([{ day: 'MONDAY', startTime: '06:00', endTime: '06:45', state: 'UNAVAILABLE' }], { id: 1, termIndex: 2 }),
			reviewedRow([{ day: 'TUESDAY', startTime: '06:00', endTime: '06:45', state: 'UNAVAILABLE' }], { id: 2, termIndex: 1 }),
			reviewedRow([{ day: 'WEDNESDAY', startTime: '06:00', endTime: '06:45', state: 'UNAVAILABLE' }], { id: 3, termIndex: 2, status: 'SUBMITTED' }),
			reviewedRow([{ day: 'THURSDAY', startTime: '06:00', endTime: '06:45', state: 'UNAVAILABLE' }], { id: 4, termIndex: 2, status: 'DRAFT' }),
		],
	});
	const read = await loadReviewedAvailabilityForTerm(SCHOOL_ID, SCHOOL_YEAR_ID, 2, client);
	assert.equal(read.ok, true);
	assert.equal(read.termIndex, 2);
	assert.equal(read.preferences.length, 1, 'only the single REVIEWED term-2 row binds');
	assert.equal(read.preferences[0].facultyId, 71);
	assert.deepEqual(read.preferences[0].timeSlots[0], { day: 'MONDAY', startTime: '06:00', endTime: '06:45', preference: 'UNAVAILABLE' });
});

test('an unresolved active term fails closed with zero preferences and never defaults to Term 1', async () => {
	const { client } = createFakeClient({ activeTermOrder: null });
	const read = await loadReviewedAvailabilityForActiveTerm(SCHOOL_ID, SCHOOL_YEAR_ID, client);
	assert.equal(read.ok, false);
	assert.equal(read.code, 'TERM_AUTHORITY_UNRESOLVED');
	assert.equal(read.termIndex, null);
	assert.deepEqual(read.preferences, []);

	const missing = createFakeClient({ contractPresent: false });
	const missingRead = await loadReviewedAvailabilityForActiveTerm(SCHOOL_ID, SCHOOL_YEAR_ID, missing.client);
	assert.equal(missingRead.ok, false);
	assert.equal(missingRead.code, 'TERM_AUTHORITY_UNRESOLVED');
});

// ─── 2 & 3. Real constructor: UNAVAILABLE hard exclusion; PREFERRED ranked SOFT ───

function minimalConstructorInput(preferences: ConstructorInput['preferences'], facultyIds = [71]): ConstructorInput {
	return {
		schoolId: SCHOOL_ID,
		schoolYearId: SCHOOL_YEAR_ID,
		sectionsByGrade: [{
			gradeLevelId: 7, gradeLevelName: 'Grade 7', displayOrder: 7,
			sections: [{ id: 9001, name: '7-A', maxCapacity: 50, enrolledCount: 40, gradeLevelId: 7, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR' }],
		}],
		subjects: [{ id: 11, code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 45, preferredRoomType: 'CLASSROOM', gradeLevels: [7], requiredFeatures: [], programScopes: ['REGULAR'] }],
		faculty: facultyIds.map((id) => ({ id, maxHoursPerWeek: 30, department: 'MATH' })),
		facultySubjects: facultyIds.map((id) => ({ facultyId: id, subjectId: 11, gradeLevels: [7], sectionIds: [9001] })),
		rooms: [{ id: 201, type: 'CLASSROOM', isTeachingSpace: true, isSharedFacility: false, capacity: 50, features: [], floor: 1, buildingId: 301, buildingZoneId: 'Z1', buildingGradeScope: [7] } as ConstructorInput['rooms'][number]],
		preferences,
		policy: { maxConsecutiveTeachingMinutesBeforeBreak: 120, minBreakMinutesAfterConsecutiveBlock: 15, maxTeachingMinutesPerDay: 480, earliestStartTime: '06:00', latestEndTime: '13:00', periodLengthMinutes: 45, periodsPerDay: 8, enableRecess: false, enableLunchWindow: false, enableFlagCeremony: false, showSpecialEventsInGrid: false },
		buildings: [{ id: 301, name: 'Building 1' }],
		demandOverride: [{ sectionId: 9001, subjectId: 11, subjectCode: 'MATH', gradeLevel: 7, sessionsPerWeek: 1, durationPerSession: 45, enrolledCount: 40, entryKind: 'SECTION' }],
	};
}

test('failing-first: a reviewed UNAVAILABLE authority makes the real constructor leave the session unplaced with FACULTY_SLOT_UNAVAILABLE; the omission mutant schedules inside it', async () => {
	const { client } = createFakeClient({ rows: [reviewedRow(ALL_WEEK_UNAVAILABLE)] });
	const read = await loadReviewedAvailabilityForTerm(SCHOOL_ID, SCHOOL_YEAR_ID, 2, client);
	assert.equal(read.preferences.length, 1);

	const guarded = constructBaseline(minimalConstructorInput(read.preferences));
	assert.equal(guarded.entries.length, 0, 'the UNAVAILABLE owner must not be placed anywhere');
	assert.equal(guarded.unassignedItems.length, 1);
	assert.equal(guarded.unassignedItems[0].reason, 'NO_AVAILABLE_SLOT');
	assert.equal(guarded.unassignedItems[0].roomAssignmentReason, 'FACULTY_SLOT_UNAVAILABLE');

	// Mutant: the omitted authority (the former `timeSlots: []` input) schedules
	// the same session inside the unavailable window.
	const mutant = constructBaseline(minimalConstructorInput([]));
	assert.equal(mutant.entries.length, 1, 'without the authority the session is placeable');
	assert.equal(mutant.unassignedItems.length, 0);
});

test('PREFERRED changes candidate ranking only and leaves HARD counts unchanged', async () => {
	const control = constructBaseline(minimalConstructorInput([], [71, 72]));
	assert.equal(control.entries.length, 1);
	assert.equal(control.entries[0].facultyId, 71, 'without a preference the stable id order wins');
	assert.equal(control.unassignedItems.length, 0);

	const preferred = constructBaseline(minimalConstructorInput([
		{ facultyId: 72, status: 'SUBMITTED', timeSlots: ALL_WEEK_UNAVAILABLE.map((slot) => ({ ...slot, preference: 'PREFERRED' })) },
	], [71, 72]));
	assert.equal(preferred.entries.length, 1);
	assert.equal(preferred.entries[0].facultyId, 72, 'the PREFERRED candidate is ranked first');
	assert.equal(preferred.unassignedItems.length, 0, 'PREFERRED never changes the HARD count');
});

test('PREFERRED is never a HARD exclusion: a PREFERRED candidate with no qualified peer is still assigned', () => {
	const result = constructBaseline(minimalConstructorInput([
		{ facultyId: 71, status: 'SUBMITTED', timeSlots: ALL_WEEK_UNAVAILABLE.map((slot) => ({ ...slot, preference: 'PREFERRED' })) },
	]));
	assert.equal(result.entries.length, 1);
	assert.equal(result.unassignedItems.length, 0);
});

// ─── 4. Feasibility at review: typed refusal with zero writes ───

test('review rejects an infeasible (all-week unavailable) authority with a typed 422 and zero writes', async () => {
	const { client, writes } = createFakeClient({
		rows: [reviewedRow(ALL_WEEK_UNAVAILABLE, { status: 'SUBMITTED', version: 5 })],
		requiredMinutes: 45,
	});
	await assert.rejects(
		() => reviewAvailability({ schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, facultyId: 71, version: 5, decision: 'REVIEWED', reviewerId: 9 }, client),
		(err: unknown) => err instanceof FacultyAvailabilityError && err.code === 'AVAILABILITY_INFEASIBLE' && err.statusCode === 422,
	);
	assert.deepEqual(writes, [], 'an infeasible review must dispatch no write');
});

test('review accepts a feasible authority and stamps reviewer identity', async () => {
	const { client } = createFakeClient({
		rows: [reviewedRow([{ day: 'MONDAY', startTime: '06:00', endTime: '06:45', state: 'UNAVAILABLE' }], { status: 'SUBMITTED', version: 5 })],
		requiredMinutes: 45,
	});
	const reviewed = await reviewAvailability({ schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, facultyId: 71, version: 5, decision: 'REVIEWED', reviewerId: 9 }, client);
	assert.equal(reviewed.status, 'REVIEWED');
	assert.equal(reviewed.reviewedBy, 9);
	assert.equal(reviewed.version, 6);
});

test('draft/submit lifecycle enforces the active term, validates slots, and version-checks', async () => {
	const { client, writes } = createFakeClient({ rows: [], activeTermOrder: 2, facultyExists: true });
	assert.deepEqual(normalizeAvailabilitySlots([{ day: 'MONDAY', startTime: '06:00', endTime: '06:45', state: 'UNAVAILABLE' }]), [
		{ day: 'MONDAY', startTime: '06:00', endTime: '06:45', state: 'UNAVAILABLE' },
	]);
	assert.throws(() => normalizeAvailabilitySlots([{ day: 'SATURDAY', startTime: '06:00', endTime: '06:45', state: 'UNAVAILABLE' }]), /day must be one of/);
	assert.throws(() => normalizeAvailabilitySlots([{ day: 'MONDAY', startTime: '07:00', endTime: '06:45', state: 'UNAVAILABLE' }]), /startTime must be before endTime/);
	assert.throws(() => normalizeAvailabilitySlots([{ day: 'MONDAY', startTime: '06:00', endTime: '06:45', state: 'MAYBE' }]), /state must be PREFERRED/);

	const wrongTerm = await assert.rejects(
		() => saveAvailabilityDraft({ schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, facultyId: 71, termIndex: 1, slots: [] }, client),
		(err: unknown) => err instanceof FacultyAvailabilityError && err.code === 'TERM_SCOPE_MISMATCH',
	);
	void wrongTerm;
	assert.deepEqual(writes, [], 'a non-active term writes nothing');

	const saved = await saveAvailabilityDraft({ schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, facultyId: 71, termIndex: 2, slots: [{ day: 'MONDAY', startTime: '06:00', endTime: '06:45', state: 'UNAVAILABLE' }] }, client);
	assert.equal(saved.termIndex, 2);
	assert.equal(saved.status, 'DRAFT');

	const submitted = await submitAvailability({ schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, facultyId: 71, version: saved.version }, client);
	assert.equal(submitted.status, 'SUBMITTED');

	await assert.rejects(
		() => reviewAvailability({ schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, facultyId: 71, version: 999, decision: 'REVIEWED', reviewerId: 9 }, client),
		(err: unknown) => err instanceof FacultyAvailabilityError && err.code === 'VERSION_CONFLICT',
	);
});

// ─── 5. Freshness domain source ───

test('the availability freshness domain digests REVIEWED new-authority slots and a reviewed edit changes the fingerprint', async () => {
	assert.equal(GENERATION_INPUT_SNAPSHOT_SCHEMA_VERSION, 3, 'source swap of an existing domain does not require a schema-version bump');

	const zeroAggregate = async () => ({ _count: { _all: 0 }, _max: { id: null, updatedAt: null, version: null, createdAt: null } });
	const availabilityCalls: any[] = [];
	const makeClient = (digest: string) => ({
		facultyMirror: { aggregate: zeroAggregate },
		facultySubject: { aggregate: zeroAggregate },
		subjectSectionOwnership: { aggregate: zeroAggregate },
		teachingLoadCycle: { findUnique: async () => null },
		schedulingPolicy: { findUnique: async () => null },
		gradeShiftWindow: { aggregate: zeroAggregate },
		policySpecialEvent: { aggregate: async () => ({ _count: { _all: 0 }, _max: { id: null, updatedAt: null } }) },
		room: { aggregate: zeroAggregate },
		building: { aggregate: zeroAggregate },
		sectionMirror: { aggregate: zeroAggregate },
		subject: { aggregate: zeroAggregate },
		classTemplate: { aggregate: async () => ({ _count: { _all: 0 }, _max: { id: null, createdAt: null } }) },
		classTemplateSubject: { aggregate: async () => ({ _count: { _all: 0 }, _max: { id: null, createdAt: null } }) },
		enrollProSchoolYearMirror: { findUnique: async () => { throw new Error('DERIVED_DEMAND_UNUSED'); } },
		facultyAvailability: {
			aggregate: async (args: unknown) => {
				availabilityCalls.push(args);
				return { _count: { _all: 1 }, _max: { id: 1, updatedAt: new Date('2030-01-01T00:00:00Z'), version: 3 } };
			},
		},
		facultyAvailabilitySlot: {
			aggregate: async (args: unknown) => {
				availabilityCalls.push(args);
				return { _count: { _all: 2 }, _max: { id: 2, createdAt: new Date('2030-01-01T00:00:00Z') } };
			},
		},
		$queryRawUnsafe: async () => [{ teachingLoad: 'tl', policy: 'pl', rooms: 'rm', sections: 'sc', subjects: 'sb', availability: digest }],
	});

	const before = await computeGenerationInputSnapshot(SCHOOL_ID, SCHOOL_YEAR_ID, makeClient('av-A') as never);
	const after = await computeGenerationInputSnapshot(SCHOOL_ID, SCHOOL_YEAR_ID, makeClient('av-B') as never);
	assert.equal(before.domains.availability.signals.availabilityCount, 1);
	assert.equal(before.domains.availability.signals.availabilitySlotCount, 2);
	assert.equal(before.domains.availability.signals.exactRevisionDigest, 'av-A');
	assert.notEqual(before.domains.availability.fingerprint, after.domains.availability.fingerprint);
	assert.notEqual(before.fingerprint, after.fingerprint);

	const availabilityAggregateCall = availabilityCalls.find((call) => call?.where?.status === 'REVIEWED');
	assert.ok(availabilityAggregateCall, 'the availability domain aggregate is scoped to REVIEWED rows');
	const slotAggregateCall = availabilityCalls.find((call) => call?.where?.availability?.status === 'REVIEWED');
	assert.ok(slotAggregateCall, 'the slot aggregate is scoped to REVIEWED authorities');
});

// ─── 6. Mounted router authority matrix ───

const JWT_SECRET = 'faculty-availability-s1-disposable-proof-secret';

function token(payload: Record<string, unknown>): string {
	return jwt.sign(payload, JWT_SECRET, { expiresIn: '10m' });
}

async function request(baseUrl: string, path: string, method: 'GET' | 'PUT' | 'POST' | 'PATCH', jwtToken?: string, body?: unknown): Promise<{ status: number; payload: any }> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 2_000);
	try {
		const response = await fetch(`${baseUrl}${path}`, {
			method,
			headers: { ...(jwtToken === undefined ? {} : { authorization: `Bearer ${jwtToken}` }), 'content-type': 'application/json' },
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
			signal: controller.signal,
		});
		return { status: response.status, payload: await response.json() };
	} finally {
		clearTimeout(timeout);
	}
}

test('mounted availability routes enforce authenticate + timetable:edit + actor-school scope with zero dispatch on rejection', async () => {
	process.env.DATABASE_URL = 'postgresql://placeholder:placeholder@127.0.0.1:1/never_used';
	process.env.JWT_SECRET = JWT_SECRET;

	const { prisma } = await import('../lib/prisma.js');
	const router = (await import('../routes/faculty-availability.router.js')).default;

	const dispatches = { mirrorUnique: 0, availabilityUnique: 0 };
	const originals = {
		mirrorUnique: prisma.enrollProSchoolYearMirror.findUnique,
		availabilityUnique: prisma.facultyAvailability.findUnique,
	};
	prisma.enrollProSchoolYearMirror.findUnique = (async () => {
		dispatches.mirrorUnique += 1;
		return { isActive: true, isArchived: false, termContractCachedAt: new Date(), termContractCache: TERM_CACHE } as never;
	}) as never;
	prisma.facultyAvailability.findUnique = (async () => {
		dispatches.availabilityUnique += 1;
		return { ...reviewedRow([{ day: 'MONDAY', startTime: '06:00', endTime: '06:45', state: 'UNAVAILABLE' }]), slots: [{ day: 'MONDAY', startTime: '06:00', endTime: '06:45', state: 'UNAVAILABLE' }] } as never;
	}) as never;

	const app = express();
	app.use(express.json());
	app.use('/api/v1/faculty-availability', router);
	app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
		res.status(err?.statusCode ?? 500).json({ code: err?.code ?? 'UNHANDLED', message: err?.message ?? String(err) });
	});
	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	const port = typeof address === 'object' && address ? address.port : 0;
	const baseUrl = `http://127.0.0.1:${port}/api/v1/faculty-availability`;
	const path = `/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/faculty/71`;

	const scheduler = token({ userId: 1, role: 'scheduler', authSource: 'local', schoolId: SCHOOL_ID });
	const crossSchool = token({ userId: 2, role: 'scheduler', authSource: 'local', schoolId: SCHOOL_ID + 1 });
	const noSchool = token({ userId: 3, role: 'scheduler', authSource: 'local' });
	const faculty = token({ userId: 4, role: 'faculty', authSource: 'local', schoolId: SCHOOL_ID });
	const reset = () => { dispatches.mirrorUnique = 0; dispatches.availabilityUnique = 0; };
	const assertNoDispatch = () => assert.deepEqual(dispatches, { mirrorUnique: 0, availabilityUnique: 0 });

	try {
		reset();
		const noToken = await request(baseUrl, path, 'GET');
		assert.equal(noToken.status, 401, 'no token');
		assert.equal(noToken.payload.code, 'NO_TOKEN');
		assertNoDispatch();

		reset();
		const teacherRead = await request(baseUrl, path, 'GET', faculty);
		assert.equal(teacherRead.status, 403, 'faculty lacks timetable:edit');
		assert.equal(teacherRead.payload.code, 'FORBIDDEN');
		assertNoDispatch();

		reset();
		const crossRead = await request(baseUrl, path, 'GET', crossSchool);
		assert.equal(crossRead.status, 403, 'cross-school read');
		assert.equal(crossRead.payload.code, 'CROSS_SCHOOL_DENIED');
		assertNoDispatch();

		reset();
		const noSchoolRead = await request(baseUrl, path, 'GET', noSchool);
		assert.equal(noSchoolRead.status, 403, 'missing actor school never defaults to 1');
		assert.equal(noSchoolRead.payload.code, 'SCHOOL_SCOPE_REQUIRED');
		assertNoDispatch();

		reset();
		const okRead = await request(baseUrl, path, 'GET', scheduler);
		assert.equal(okRead.status, 200, `scheduler read: ${okRead.status}/${okRead.payload.code}`);
		assert.equal(okRead.payload.availability.termIndex, 2);
		assert.deepEqual(dispatches, { mirrorUnique: 1, availabilityUnique: 1 });

		reset();
		const badWrite = await request(baseUrl, path, 'PUT', scheduler, { termIndex: 1, slots: [] });
		assert.equal(badWrite.status, 409, 'a non-active term is refused');
		assert.equal(badWrite.payload.code, 'TERM_SCOPE_MISMATCH');
		assert.deepEqual(dispatches, { mirrorUnique: 1, availabilityUnique: 0 });

		reset();
		const teacherWrite = await request(baseUrl, path, 'PUT', faculty, { termIndex: 2, slots: [] });
		assert.equal(teacherWrite.status, 403, 'faculty lacks timetable:edit');
		assertNoDispatch();
	} finally {
		prisma.enrollProSchoolYearMirror.findUnique = originals.mirrorUnique;
		prisma.facultyAvailability.findUnique = originals.availabilityUnique;
		server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
		await prisma.$disconnect();
	}
});

// ─── 7. Schema, migration, and legacy-source controls ───

test('the schema and migration are additive and the legacy preference path is no longer a generation consumer', () => {
	const schema = readFileSync(resolve(here, '..', '..', '..', 'prisma', 'schema.prisma'), 'utf8');
	assert.ok(schema.includes('model FacultyAvailability {'));
	assert.ok(schema.includes('model FacultyAvailabilitySlot {'));
	assert.ok(schema.includes('@@map("faculty_availabilities")'));
	assert.ok(schema.includes('@@map("faculty_availability_slots")'));
	assert.ok(schema.includes('@@unique([schoolId, schoolYearId, facultyId, termIndex]'));
	assert.ok(schema.includes('enum FacultyAvailabilityStatus {'));

	const sql = readFileSync(resolve(here, '..', '..', '..', 'prisma', 'migrations', '20260925000002_faculty_availability', 'migration.sql'), 'utf8');
	assert.ok(sql.includes('CREATE TABLE "faculty_availabilities"'));
	assert.ok(sql.includes('CREATE TABLE "faculty_availability_slots"'));
	assert.ok(sql.includes('CREATE TYPE "faculty_availability_status"'));
	assert.equal(/\bDROP\b/i.test(sql), false, 'no destructive statement');
	assert.equal(/ALTER TABLE "faculty_preferences"/i.test(sql), false, 'the legacy table is not altered');

	const preflight = readFileSync(resolve(here, '..', 'services', 'generation-preflight.service.ts'), 'utf8');
	assert.equal(preflight.includes('client.facultyPreference'), false, 'the legacy preference read is retired from generation');
	assert.ok(preflight.includes('loadReviewedAvailabilityForTerm'));

	const snapshot = readFileSync(resolve(here, '..', 'services', 'generation-input-snapshot.service.ts'), 'utf8');
	assert.equal(snapshot.includes('client.facultyPreference'), false, 'the availability domain no longer reads the legacy table');
	assert.equal(snapshot.includes('preferenceTimeSlot'), false, 'the availability domain no longer reads the legacy slot table');

	const preferenceService = readFileSync(resolve(here, '..', 'services', 'preference.service.ts'), 'utf8');
	assert.ok(preferenceService.includes('ATLAS_ENABLE_LEGACY_TIME_PREFERENCES'), 'the legacy flag is retained (never flipped)');
	assert.ok(preferenceService.includes('DEPRECATED (TEACHER-AVAILABILITY-AUTHORITY-C01)'));
});
