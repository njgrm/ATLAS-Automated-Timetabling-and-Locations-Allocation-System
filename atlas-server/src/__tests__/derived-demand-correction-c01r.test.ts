/**
 * DEMAND-C01R — Derived Demand Authority Closure controls.
 *
 * Run (server workspace): `npx tsx src/__tests__/derived-demand-correction-c01r.test.ts`
 *
 * Ten controls that fail on the pre-correction candidate and pass after the
 * correction, covering per-scope rotation completeness, ordered-term
 * preservation, complete semantic revision, transaction-consistent term
 * authority, generation/publication freshness, real Timetable blocker
 * propagation, and projection parity.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
	deriveCanonicalDemand,
	toSchedulerDemandOverride,
	assertProjectionParity,
	buildDerivedDemand,
	canonicalTermStructureRevision,
	type DerivedDemandInput,
	type DerivedDemandSuccess,
	type DerivedSubjectInput,
} from '../services/derived-demand.service.js';
import { computeGenerationInputSnapshot, compareGenerationInputSnapshots } from '../services/generation-input-snapshot.service.js';
import { summarizeUnassignedInsertionReadiness } from '../services/timetable-insertion.service.js';
import { buildCanonicalTimetableDemand } from '../services/timetable-demand.service.js';
import { constructBaseline, type ConstructorInput, type SubjectInput } from '../services/schedule-constructor.js';
import type { SectionsByGrade } from '../services/section-adapter.js';
import { withDataContext } from '../lib/data-context.js';
import timetableUnassignedRouter from '../routes/timetable-unassigned.router.js';

const SCHOOL_ID = 10;
const YEAR_ID = 20;

// ─── Fixtures ────────────────────────────────────────────────────────────────

function terms(identities: string[]) {
	return identities.map((identity, index) => ({ identity, displayLabel: identity, order: index + 1 }));
}

function subject(overrides: Partial<DerivedSubjectInput> & Pick<DerivedSubjectInput, 'id' | 'code'>): DerivedSubjectInput {
	return {
		name: overrides.code,
		schedulingDisposition: 'SCHEDULED_TEACHING',
		gradeLevels: [7],
		programScopes: ['REGULAR'],
		rotationFamily: null,
		modularOrder: null,
		minMinutesPerWeek: 240,
		preferredRoomType: 'CLASSROOM',
		requiredFeatures: [],
		isActive: true,
		...overrides,
	};
}

function section(overrides: Partial<DerivedDemandInput['sections'][number]> & Pick<DerivedDemandInput['sections'][number], 'sectionMirrorId' | 'externalId'>) {
	return { gradeLevel: 7, programType: 'REGULAR', isActiveForScheduling: true, isStale: false, ...overrides };
}

function baseInput(overrides: Partial<DerivedDemandInput> = {}): DerivedDemandInput {
	return {
		schoolId: SCHOOL_ID,
		schoolYearId: YEAR_ID,
		yearLabel: '2030-2031',
		termFormat: 'TRIMESTER',
		termStructureRevision: 'A'.repeat(64),
		terms: terms(['T1', 'T2', 'T3']),
		sections: [section({ sectionMirrorId: 501, externalId: 9001 })],
		subjects: [subject({ id: 11, code: 'MATH' })],
		periodLengthMinutes: 60,
		...overrides,
	};
}

type FakeState = {
	activeYears: number[];
	termCache: { format: 'TRIMESTER' | 'QUARTERS'; terms: Array<{ identity: string; displayLabel: string; order: number }> } | null;
	sections: Array<Record<string, unknown>>;
	subjects: Array<Record<string, unknown>>;
	policy: Record<string, unknown>;
	ownership: Array<Record<string, unknown>>;
	faculty: Array<Record<string, unknown>>;
	facultySubjects: Array<Record<string, unknown>>;
	rooms: Array<Record<string, unknown>>;
	buildings: Array<Record<string, unknown>>;
	locked: Array<Record<string, unknown>>;
};

function baseState(overrides: Partial<FakeState> = {}): FakeState {
	return {
		activeYears: [YEAR_ID],
		termCache: { format: 'TRIMESTER', terms: terms(['T1', 'T2', 'T3']) },
		sections: [{ id: 501, externalId: 9001, displayOrder: 7, gradeLevelId: 17, programType: 'REGULAR', isActiveForScheduling: true, isStale: false, name: '7-A', maxCapacity: 50, enrolledCount: 40, homeRoomId: null, buildingZoneId: null }],
		subjects: [{
			id: 11, code: 'MATH', name: 'Mathematics', schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: [7], programScopes: ['REGULAR'],
			rotationFamily: null, modularOrder: null, minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM', requiredFeatures: [], isActive: true,
		}],
		policy: { id: 1, periodLengthMinutes: 60, periodsPerDay: 8, earliestStartTime: '07:00', latestEndTime: '18:00', updatedAt: new Date('2030-01-01T00:00:00.000Z') },
		ownership: [],
		faculty: [{ id: 5, externalId: 7005, firstName: 'Flow', lastName: 'Faculty', isActiveForScheduling: true, isStale: false, version: 1 }],
		facultySubjects: [],
		rooms: [],
		buildings: [],
		locked: [],
		...overrides,
	};
}

function makeClient(state: FakeState) {
	const calls: string[] = [];
	const zeroAggregate = async () => ({ _count: { _all: 0 }, _max: { id: null, updatedAt: null, version: null, createdAt: null } });
	const client: Record<string, unknown> = {
		enrollProSchoolYearMirror: {
			findMany: async () => { calls.push('mirror.findMany'); return state.activeYears.map((enrollProSchoolYearId) => ({ enrollProSchoolYearId, yearLabel: '2030-2031' })); },
			findUnique: async ({ where }: { where?: { schoolId_enrollProSchoolYearId?: { schoolId?: number; enrollProSchoolYearId?: number } } }) => {
				calls.push('mirror.findUnique');
				if (!state.termCache) return null;
				const key = where?.schoolId_enrollProSchoolYearId ?? {};
				return {
					isActive: true,
					isArchived: false,
					termContractCachedAt: new Date(),
					termContractCache: { schoolId: key.schoolId, schoolYear: { id: key.enrollProSchoolYearId, yearLabel: '2030-2031' }, ...state.termCache },
				};
			},
		},
		sectionMirror: {
			findMany: async () => { calls.push('sectionMirror.findMany'); return state.sections.map((row) => ({ ...row })); },
			aggregate: zeroAggregate,
		},
		subject: {
			findMany: async () => { calls.push('subject.findMany'); return state.subjects.map((row) => ({ ...row })); },
			aggregate: zeroAggregate,
		},
		schedulingPolicy: { findUnique: async () => { calls.push('policy.findUnique'); return state.policy; } },
		subjectSectionOwnership: { findMany: async () => { calls.push('ownership.findMany'); return state.ownership; }, aggregate: zeroAggregate },
		facultyMirror: { findMany: async () => { calls.push('faculty.findMany'); return state.faculty; }, aggregate: zeroAggregate },
		facultySubject: { findMany: async () => { calls.push('facultySubject.findMany'); return state.facultySubjects; }, aggregate: zeroAggregate },
		teachingLoadCycle: { findUnique: async () => { calls.push('cycle.findUnique'); return null; } },
		gradeShiftWindow: { aggregate: zeroAggregate },
		room: {
			findMany: async () => { calls.push('room.findMany'); return state.rooms; },
			count: async () => state.rooms.length,
			aggregate: zeroAggregate,
		},
		building: { findMany: async () => { calls.push('building.findMany'); return state.buildings; }, aggregate: zeroAggregate },
		lockedSession: { findMany: async () => { calls.push('locked.findMany'); return state.locked; } },
		generationRun: { count: async () => 0 },
		classTemplate: { aggregate: async () => ({ _count: { _all: 0 }, _max: { id: null, createdAt: null } }) },
		classTemplateSubject: { aggregate: async () => ({ _count: { _all: 0 }, _max: { id: null, createdAt: null } }) },
		$queryRawUnsafe: async () => { calls.push('raw'); return [{ teachingLoad: 'tl', policy: 'pl', rooms: 'rm', sections: 'sc', subjects: 'sb' }]; },
	};
	return { client, calls };
}

// ─── 1. Rotation completeness per applicable scope ──────────────────────────

test('control 1: a family missing an ordered position returns ROTATION_INCOMPLETE', () => {
	const result = deriveCanonicalDemand(baseInput({
		subjects: [
			subject({ id: 31, code: 'SCI_A', rotationFamily: 'SCIENCE', modularOrder: 1 }),
			subject({ id: 32, code: 'SCI_C', rotationFamily: 'SCIENCE', modularOrder: 3 }),
		],
	}));
	assert.equal(result.ok, false);
	if (result.ok) return;
	assert.ok(result.blockers.some((entry) => entry.code === 'ROTATION_INCOMPLETE'), 'missing position 2 must be ROTATION_INCOMPLETE');
	assert.equal(result.blockers.find((entry) => entry.code === 'ROTATION_INCOMPLETE')?.scopeGradeLevel, 7);
	assert.equal(result.blockers.find((entry) => entry.code === 'ROTATION_INCOMPLETE')?.scopeProgramType, 'REGULAR');
});

test('control 2: order reuse across disjoint grade/program scopes is allowed; per-scope gaps/duplicates fail', () => {
	// Complete in both (7,REGULAR) and (8,REGULAR): equal orders in disjoint scopes.
	const disjoint = deriveCanonicalDemand(baseInput({
		sections: [
			section({ sectionMirrorId: 501, externalId: 9001, gradeLevel: 7 }),
			section({ sectionMirrorId: 502, externalId: 9002, gradeLevel: 8 }),
		],
		subjects: [
			subject({ id: 31, code: 'G7_A', gradeLevels: [7], rotationFamily: 'SCI', modularOrder: 1 }),
			subject({ id: 32, code: 'G7_B', gradeLevels: [7], rotationFamily: 'SCI', modularOrder: 2 }),
			subject({ id: 33, code: 'G7_C', gradeLevels: [7], rotationFamily: 'SCI', modularOrder: 3 }),
			subject({ id: 34, code: 'G8_A', gradeLevels: [8], rotationFamily: 'SCI', modularOrder: 1 }),
			subject({ id: 35, code: 'G8_B', gradeLevels: [8], rotationFamily: 'SCI', modularOrder: 2 }),
			subject({ id: 36, code: 'G8_C', gradeLevels: [8], rotationFamily: 'SCI', modularOrder: 3 }),
		],
	}));
	assert.equal(disjoint.ok, true, 'equal orders in disjoint scopes must not be a collision');
	if (disjoint.ok) assert.equal(disjoint.revision.length, 64);

	// Incomplete inside only the grade-8 scope, even though grade-7 is complete.
	const gapInOneScope = deriveCanonicalDemand(baseInput({
		sections: [
			section({ sectionMirrorId: 501, externalId: 9001, gradeLevel: 7 }),
			section({ sectionMirrorId: 502, externalId: 9002, gradeLevel: 8 }),
		],
		subjects: [
			subject({ id: 31, code: 'G7_A', gradeLevels: [7], rotationFamily: 'SCI', modularOrder: 1 }),
			subject({ id: 32, code: 'G7_B', gradeLevels: [7], rotationFamily: 'SCI', modularOrder: 2 }),
			subject({ id: 33, code: 'G7_C', gradeLevels: [7], rotationFamily: 'SCI', modularOrder: 3 }),
			subject({ id: 34, code: 'G8_A', gradeLevels: [8], rotationFamily: 'SCI', modularOrder: 1 }),
			subject({ id: 35, code: 'G8_B', gradeLevels: [8], rotationFamily: 'SCI', modularOrder: 2 }),
		],
	}));
	assert.equal(gapInOneScope.ok, false);
	if (!gapInOneScope.ok) {
		const incomplete = gapInOneScope.blockers.filter((entry) => entry.code === 'ROTATION_INCOMPLETE');
		assert.ok(incomplete.length > 0, 'a globally complete grade-7 family must not hide the grade-8 gap');
		assert.ok(incomplete.every((entry) => entry.scopeGradeLevel === 8));
	}

	const duplicateInOneScope = deriveCanonicalDemand(baseInput({
		sections: [
			section({ sectionMirrorId: 501, externalId: 9001, gradeLevel: 7 }),
			section({ sectionMirrorId: 502, externalId: 9002, gradeLevel: 8 }),
		],
		subjects: [
			subject({ id: 31, code: 'G7_A', gradeLevels: [7], rotationFamily: 'SCI', modularOrder: 1 }),
			subject({ id: 32, code: 'G7_B', gradeLevels: [7], rotationFamily: 'SCI', modularOrder: 2 }),
			subject({ id: 33, code: 'G7_C', gradeLevels: [7], rotationFamily: 'SCI', modularOrder: 3 }),
			subject({ id: 34, code: 'G8_A', gradeLevels: [8], rotationFamily: 'SCI', modularOrder: 1 }),
			subject({ id: 35, code: 'G8_A2', gradeLevels: [8], rotationFamily: 'SCI', modularOrder: 1 }),
			subject({ id: 36, code: 'G8_B', gradeLevels: [8], rotationFamily: 'SCI', modularOrder: 2 }),
			subject({ id: 37, code: 'G8_C', gradeLevels: [8], rotationFamily: 'SCI', modularOrder: 3 }),
		],
	}));
	assert.equal(duplicateInOneScope.ok, false);
	if (!duplicateInOneScope.ok) {
		const duplicates = duplicateInOneScope.blockers.filter((entry) => entry.code === 'ROTATION_ORDER_DUPLICATE');
		assert.ok(duplicates.length > 0);
		assert.ok(duplicates.every((entry) => entry.scopeGradeLevel === 8));
	}
});

// ─── 3. Ordered-term preservation (QUARTERS) ────────────────────────────────

test('control 3: a four-term family reaches the constructor with term index 4 preserved', () => {
	const quarters = deriveCanonicalDemand(baseInput({
		termFormat: 'QUARTERS',
		terms: terms(['Q1', 'Q2', 'Q3', 'Q4']),
		subjects: [
			subject({ id: 41, code: 'ROT_1', rotationFamily: 'ROT', modularOrder: 1, minMinutesPerWeek: 240 }),
			subject({ id: 42, code: 'ROT_2', rotationFamily: 'ROT', modularOrder: 2, minMinutesPerWeek: 240 }),
			subject({ id: 43, code: 'ROT_3', rotationFamily: 'ROT', modularOrder: 3, minMinutesPerWeek: 240 }),
			subject({ id: 44, code: 'ROT_4', rotationFamily: 'ROT', modularOrder: 4, minMinutesPerWeek: 240 }),
		],
		periodLengthMinutes: 60,
	}));
	assert.equal(quarters.ok, true);
	if (!quarters.ok) return;

	const sectionsByGrade: SectionsByGrade[] = [{
		gradeLevelId: 17,
		gradeLevelName: 'Grade 7',
		displayOrder: 7,
		sections: [{ id: 9001, name: '7-A', maxCapacity: 50, enrolledCount: 40, gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR', programCode: 'REGULAR', programName: 'Regular' }],
	} as SectionsByGrade];
	const subjectInputs: SubjectInput[] = [41, 42, 43, 44].map((id) => ({ id, code: `ROT_${id - 40}`, name: `ROT ${id}`, minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM' as const, gradeLevels: [7], programScopes: ['REGULAR'] }));

	const override = toSchedulerDemandOverride(quarters, sectionsByGrade, subjectInputs);
	assert.equal(override.length, 1, 'one modular demand item for the section');
	assert.deepEqual(override[0].modularSubjects?.map((entry) => entry.modularOrder), [1, 2, 3, 4]);
	assert.equal(override[0].modularExpectedCount, 4);

	const constructorInput: ConstructorInput = {
		schoolId: SCHOOL_ID,
		schoolYearId: YEAR_ID,
		sectionsByGrade,
		subjects: subjectInputs,
		faculty: [{ id: 5, maxHoursPerWeek: 30, department: 'SCI' }],
		facultySubjects: [41, 42, 43, 44].map((subjectId) => ({ facultyId: 5, subjectId, gradeLevels: [7], sectionIds: [9001] })),
		rooms: [{ id: 1, type: 'CLASSROOM' as const, isTeachingSpace: true, capacity: 50, buildingId: 1, buildingZoneId: 'A', buildingGradeScope: [] }],
		preferences: [],
		policy: { periodLengthMinutes: 60, periodsPerDay: 8, maxConsecutiveTeachingMinutesBeforeBreak: 180, minBreakMinutesAfterConsecutiveBlock: 10, maxTeachingMinutesPerDay: 480, earliestStartTime: '07:00', latestEndTime: '18:00' },
		classTemplatePeriods: { REGULAR: 60 },
		demandOverride: override,
	};
	const result = constructBaseline(constructorInput);
	const termIndices = new Set(result.entries.map((entry) => entry.termIndex).filter((value): value is 1 | 2 | 3 | 4 => value != null));
	assert.ok(termIndices.has(4), `a verified fourth term must not be collapsed onto term 3 (got ${[...termIndices].join(',')})`);
	assert.deepEqual([...termIndices].sort((a, b) => a - b), [1, 2, 3, 4]);
});

// ─── 4. Complete semantic revision ──────────────────────────────────────────

test('control 4: period length changes the revision and session count; read-order stays stable', () => {
	const at60 = deriveCanonicalDemand(baseInput({ periodLengthMinutes: 60 }));
	const at45 = deriveCanonicalDemand(baseInput({ periodLengthMinutes: 45 }));
	assert.equal(at60.ok, true);
	assert.equal(at45.ok, true);
	if (!at60.ok || !at45.ok) return;
	assert.notEqual(at60.revision, at45.revision, 'period length must be bound into the revision');
	assert.equal(at60.timetableLines[0].sessionsPerWeek, 4, '240min / 60min = 4 sessions');
	assert.equal(at45.timetableLines[0].sessionsPerWeek, 6, '240min / 45min = 6 sessions');

	const permuted = deriveCanonicalDemand(baseInput({
		periodLengthMinutes: 60,
		subjects: [subject({ id: 11, code: 'MATH' }), subject({ id: 12, code: 'ENG' })],
	}));
	const permutedReversed = deriveCanonicalDemand(baseInput({
		periodLengthMinutes: 60,
		subjects: [subject({ id: 12, code: 'ENG' }), subject({ id: 11, code: 'MATH' })],
	}));
	assert.equal(permuted.ok && permutedReversed.ok, true);
	if (permuted.ok && permutedReversed.ok) assert.equal(permuted.revision, permutedReversed.revision, 'read-order permutation must not change the revision');
});

// ─── 5 & 7 & 10. Snapshot freshness bound to derived authority ──────────────

test('control 5: room semantics change the derived revision and the generation freshness domain', async () => {
	const state = baseState();
	const { client } = makeClient(state);
	const before = await computeGenerationInputSnapshot(SCHOOL_ID, YEAR_ID, client as never);

	state.subjects = [{ ...state.subjects[0], preferredRoomType: 'LABORATORY' }];
	const after = await computeGenerationInputSnapshot(SCHOOL_ID, YEAR_ID, client as never);

	const beforeDomain = before.domains.derivedDemand.fingerprint;
	const afterDomain = after.domains.derivedDemand.fingerprint;
	assert.notEqual(beforeDomain, afterDomain, 'preferred room type must change the derivedDemand freshness domain');
	assert.notEqual(before.fingerprint, after.fingerprint, 'room semantics must change the generation input fingerprint');

	const comparison = compareGenerationInputSnapshots(before, after);
	assert.equal(comparison.status, 'STALE');
	assert.ok(comparison.changedDomains.includes('derivedDemand'));
});

test('control 7: legacy transition rows never stale a derived run; ordered terms and semantic inputs do', async () => {
	const state = baseState();
	const { client, calls } = makeClient(state);
	const baseline = await computeGenerationInputSnapshot(SCHOOL_ID, YEAR_ID, client as never);

	// The legacy transition tables are never read for current-year authority.
	assert.equal(calls.some((entry) => /offering|termConfig/i.test(entry)), false, 'legacy offering/termConfig rows must not be read');

	// A legacy offering/term-config mutation is not representable in the client
	// call graph; recomputing yields an identical snapshot.
	const afterLegacyMutation = await computeGenerationInputSnapshot(SCHOOL_ID, YEAR_ID, client as never);
	assert.equal(afterLegacyMutation.fingerprint, baseline.fingerprint, 'legacy rows cannot stale a derived run');

	// Changing the ordered EnrollPro terms stales the run.
	state.termCache = { format: 'TRIMESTER', terms: terms(['T1', 'T2', 'T3X']) };
	const afterTermChange = await computeGenerationInputSnapshot(SCHOOL_ID, YEAR_ID, client as never);
	assert.notEqual(afterTermChange.fingerprint, baseline.fingerprint, 'ordered term change must stale the run');
	const termComparison = compareGenerationInputSnapshots(baseline, afterTermChange);
	assert.equal(termComparison.status, 'STALE');
	assert.ok(termComparison.changedDomains.includes('derivedDemand'));
});

test('control 10: one canonical revision flows through snapshot, Timetable, and buildDerivedDemand', async () => {
	const state = baseState();
	const { client } = makeClient(state);

	const derived = await buildDerivedDemand(SCHOOL_ID, YEAR_ID, { client: client as never });
	assert.equal(derived.ok, true);
	if (!derived.ok) return;

	const snapshot = await computeGenerationInputSnapshot(SCHOOL_ID, YEAR_ID, client as never);
	assert.equal(snapshot.domains.derivedDemand.signals.derivedDemandRevision, derived.revision);

	const timetable = await withDataContext(client, () => buildCanonicalTimetableDemand(SCHOOL_ID, YEAR_ID));
	assert.equal(timetable.derivedDemandRevision, derived.revision, 'Timetable summary must expose the same canonical revision');
	const summary = await withDataContext(client, () => summarizeUnassignedInsertionReadiness(SCHOOL_ID, YEAR_ID));
	assert.equal(summary.derivedDemandRevision, derived.revision, 'Timetable insertion summary must expose the same canonical revision');
	assert.equal(derived.termStructure.terms.length, 3);
	assert.equal(canonicalTermStructureRevision(SCHOOL_ID, YEAR_ID, 'TRIMESTER', derived.termStructure.terms).length, 64);
});

// ─── 6. Transaction-consistent term authority (trap client, no network) ─────
test('control 9: projection fails closed on missing section/Subject and enforces exact parity', () => {
	const derived = deriveCanonicalDemand(baseInput());
	assert.equal(derived.ok, true);
	if (!derived.ok) return;
	const sectionsByGrade: SectionsByGrade[] = [{
		gradeLevelId: 17,
		gradeLevelName: 'Grade 7',
		displayOrder: 7,
		sections: [{ id: 9001, name: '7-A', maxCapacity: 50, enrolledCount: 40, gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR', programCode: 'REGULAR', programName: 'Regular' }],
	} as SectionsByGrade];
	const subjectInputs: SubjectInput[] = [{ id: 11, code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM', gradeLevels: [7], programScopes: ['REGULAR'] }];

	assert.throws(
		() => toSchedulerDemandOverride(derived, sectionsByGrade, []),
		(error: { code?: string }) => error?.code === 'DERIVED_DEMAND_PROJECTION_INCOMPLETE',
		'missing Subject snapshot must be a typed drift blocker',
	);
	assert.throws(
		() => toSchedulerDemandOverride(derived, [{ gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, sections: [] } as SectionsByGrade], subjectInputs),
		(error: { code?: string }) => error?.code === 'DERIVED_DEMAND_PROJECTION_INCOMPLETE',
		'missing section snapshot must be a typed drift blocker',
	);

	const items = toSchedulerDemandOverride(derived, sectionsByGrade, subjectInputs);
	assertProjectionParity(derived, items);
	assert.throws(
		() => assertProjectionParity(derived, []),
		(error: { code?: string }) => error?.code === 'DERIVED_DEMAND_PROJECTION_PARITY_MISMATCH',
		'parity assertion must reject a projection that omits canonical lines',
	);
});

test('control 6: a supplied trap client governs every persisted term read with no global/network call', async () => {
	const state = baseState();
	const { client, calls } = makeClient(state);
	const originalFetch = globalThis.fetch;
	const fetchCalls: string[] = [];
	globalThis.fetch = (async (input: unknown) => {
		fetchCalls.push(String(input));
		throw new Error('network access is forbidden inside the transactional derived-demand path');
	}) as typeof fetch;
	try {
		const result = await buildDerivedDemand(SCHOOL_ID, YEAR_ID, { client: client as never });
		assert.equal(result.ok, true);
		assert.ok(calls.includes('mirror.findUnique'), 'the persisted term snapshot must be read through the supplied client');
		assert.ok(calls.includes('sectionMirror.findMany'));
		assert.ok(calls.includes('subject.findMany'));
		assert.equal(fetchCalls.length, 0, 'no live EnrollPro network call may occur');
	} finally {
		globalThis.fetch = originalFetch;
	}
});

// ─── 8. Timetable blocker propagation ───────────────────────────────────────

test('control 8: Timetable summary returns the canonical revision and a typed blocker instead of an empty result', async () => {
	const routerStack = (timetableUnassignedRouter as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> }).stack
		.flatMap((layer) => layer.route ? Object.keys(layer.route.methods).map((method) => `${method.toUpperCase()} ${layer.route?.path}`) : []);
	assert.deepEqual(routerStack, [
		'GET /:schoolId/:schoolYearId/unassigned-workflow/summary',
		'POST /:schoolId/:schoolYearId/unassigned-workflow/preview',
	]);

	// Blocked authority: a typed blocker, never an empty-looking summary.
	const blocked = makeClient(baseState({ termCache: null }));
	const blockedDemand = await withDataContext(blocked.client, () => buildCanonicalTimetableDemand(SCHOOL_ID, YEAR_ID));
	assert.equal(blockedDemand.derivedDemandRevision, null);
	assert.ok(blockedDemand.derivedDemandBlockers.length > 0, 'blocked demand must expose typed blockers');
	await assert.rejects(
		() => withDataContext(blocked.client, () => summarizeUnassignedInsertionReadiness(SCHOOL_ID, YEAR_ID)),
		(error: { code?: string }) => error?.code === 'DERIVED_DEMAND_BLOCKED',
		'a blocked derived authority must surface DERIVED_DEMAND_BLOCKED, not an empty summary',
	);

	// Unblocked authority: the summary exposes the canonical revision.
	const ok = makeClient(baseState());
	const okDerived = await buildDerivedDemand(SCHOOL_ID, YEAR_ID, { client: ok.client as never });
	assert.equal(okDerived.ok, true);
	const okSummary = await withDataContext(ok.client, () => summarizeUnassignedInsertionReadiness(SCHOOL_ID, YEAR_ID));
	assert.equal(okDerived.ok && okSummary.derivedDemandRevision === okDerived.revision, true);
});
