/**
 * GENERATION-AUTHORITY-REALISM-C07 — R3/B3 focused suite: the ordered-term
 * authority concurrency check must compare canonical ↔ canonical.
 *
 * Run: `npx tsx src/__tests__/generation-authority-realism-c07-term-authority.test.ts`
 *
 * B3 defect: `buildGenerationPreflight` compared the stored upstream
 * `termContractCache.semanticRevision` (namespace: `enrollpro-term-contract.service`
 * `semanticRevisionFor`, order-sensitive over a different payload) against the
 * locally computed canonical revision. The two are not interchangeable, so a
 * healthy mirror-223-shaped cache produced a FALSE `TERM_AUTHORITY_STALE`.
 *
 * These tests use a production-shaped persisted cache (school 1, year 9,
 * TRIMESTER, ordered T1/T2/T3 with labels and dates, upstream
 * `semanticRevision a51b62a2…`) and drive the REAL `buildGenerationPreflight`
 * entry point with a write-instrumented mock client. No database writes, no
 * generation, no publication.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
	canonicalTermStructureRevision,
	normalizePersistedTermStructure,
	type DerivedTermInput,
} from '../services/derived-demand.service.js';
import { buildGenerationPreflight } from '../services/generation-preflight.service.js';
import { getExpectedCanonicalSlots } from '../services/class-program-slot.service.js';

process.env.ENROLLPRO_API = 'http://127.0.0.1:1/api';

const SCHOOL_ID = 1;
const SCHOOL_YEAR_ID = 9;

/** The live mirror-223 upstream revision (untrusted provenance). */
const MIRROR_223_UPSTREAM_REVISION = 'a51b62a26e27416c3d1295697f144d7ae5de5c56bb6a5e0d25bcb0c24dd8abb9';

function terms(overrides: Partial<DerivedTermInput> = {}): DerivedTermInput[] {
	return [
		{ identity: 'T1', displayLabel: 'First Trimester', order: 1, startDate: '2030-06-01', endDate: '2030-09-30', ...overrides },
		{ identity: 'T2', displayLabel: 'Second Trimester', order: 2, startDate: '2030-10-01', endDate: '2031-01-31' },
		{ identity: 'T3', displayLabel: 'Third Trimester', order: 3, startDate: '2031-02-01', endDate: '2031-05-31' },
	];
}

/** The exact persisted cache shape written by the verified rollover sync. */
function mirrorCache(overrides: {
	terms?: unknown;
	semanticRevision?: string;
	format?: string;
	schoolId?: number;
	schoolYearId?: number;
} = {}) {
	return {
		schoolId: overrides.schoolId ?? SCHOOL_ID,
		schoolYear: { id: overrides.schoolYearId ?? SCHOOL_YEAR_ID },
		format: overrides.format ?? 'TRIMESTER',
		terms: overrides.terms ?? terms(),
		activeTerm: { identity: 'T2', order: 2 },
		semanticRevision: overrides.semanticRevision ?? MIRROR_223_UPSTREAM_REVISION,
	};
}

/** Re-serialize with JSON keys in a different order (JSONB round-trip proxy). */
function reorderKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(reorderKeys);
	if (value && typeof value === 'object') {
		const record = value as Record<string, unknown>;
		const reordered: Record<string, unknown> = {};
		for (const key of Object.keys(record).sort().reverse()) reordered[key] = reorderKeys(record[key]);
		return reordered;
	}
	return value;
}

interface ReadPlan {
	/** Caches returned by successive `enrollProSchoolYearMirror.findUnique` calls. */
	reads: unknown[];
}

function buildTermAuthorityClient(plan: ReadPlan) {
	const writes: string[] = [];
	const record = (name: string) => (..._args: unknown[]) => { writes.push(name); return Promise.resolve({ id: 1 }); };
	let readIndex = 0;
	const nextCache = () => {
		const value = plan.reads[Math.min(readIndex, plan.reads.length - 1)];
		readIndex += 1;
		return value;
	};

	const section = {
		id: 9001, externalId: 9001, mirrorId: 501, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID,
		name: '7-A', gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7,
		maxCapacity: 50, enrolledCount: 40, programType: 'REGULAR', programCode: 'REGULAR', programName: 'Regular',
		isSpecialProgram: false, tleProgramId: null, tleSpecialization: null, tleProgramCategory: null,
		homeRoomId: 201, buildingZoneId: 'Z1', isActiveForScheduling: true, isStale: false,
	};
	const subjects = [{
		id: 11, code: 'MATH', name: 'Mathematics', schedulingDisposition: 'SCHEDULED_TEACHING',
		gradeLevels: [7], programScopes: ['REGULAR'], rotationFamily: null, modularOrder: null,
		minMinutesPerWeek: 180, preferredRoomType: 'CLASSROOM', requiredFeatures: [], isActive: true,
		ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST', interSectionEnabled: false,
		interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: null,
	}];
	const slotRows = getExpectedCanonicalSlots(7, 'REGULAR').map((slot, index) => ({
		id: index + 1, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, gradeLevel: 7, programType: 'REGULAR',
		startTime: slot.startTime, endTime: slot.endTime, rowKind: slot.rowKind, isActive: true,
		subjectFamily: slot.subjectFamily ?? null, subjectLabel: slot.subjectLabel ?? null, dayOfWeek: null,
	}));

	const client: any = {
		generationRun: { count: async () => 0, findFirst: async () => null, findMany: async () => [], create: record('generationRun.create'), update: record('generationRun.update') },
		lockedSession: { count: async () => 0, findFirst: async () => null, findMany: async () => [], updateMany: record('lockedSession.updateMany') },
		lockedSessionAction: { count: async () => 0, create: record('lockedSessionAction.create') },
		auditLog: { count: async () => 0, create: record('auditLog.create') },
		teachingLoadCycle: { findMany: async () => [] },
		subjectSectionOwnership: { count: async () => 0, findMany: async () => [] },
		schedulingPolicy: {
			findUnique: async () => ({
				id: 1, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, periodLengthMinutes: 45, periodsPerDay: 8,
				maxConsecutiveTeachingMinutesBeforeBreak: 120, minBreakMinutesAfterConsecutiveBlock: 15, maxTeachingMinutesPerDay: 480,
				earliestStartTime: '06:00', latestEndTime: '18:30', enforceConsecutiveBreakAsHard: false,
				enableTravelWellbeingChecks: false, maxWalkingDistanceMetersPerTransition: 120, maxBuildingTransitionsPerDay: 4,
				maxBackToBackTransitionsWithoutBuffer: 2, maxIdleGapMinutesPerDay: 60, avoidEarlyFirstPeriod: false, avoidLateLastPeriod: false,
				enableVacantAwareConstraints: false, targetFacultyDailyVacantMinutes: 60, targetSectionDailyVacantPeriods: 1,
				maxCompressedTeachingMinutesPerDay: 300, lunchStartTime: '12:15', lunchEndTime: '13:00', enforceLunchWindow: false,
				showSpecialEventsInGrid: true, enableFlagCeremony: false, flagCeremonyStartTime: '07:00', flagCeremonyEndTime: '07:30',
				enableRecess: false, recessStartTime: '09:00', recessEndTime: '09:15', enableLunchWindow: false,
				enableTleTwoPassPriority: true, allowFlexibleSubjectAssignment: false, allowConsecutiveLabSessions: false, constraintConfig: null,
			}),
			upsert: record('schedulingPolicy.upsert'),
		},
		enrollProSchoolYearMirror: {
			findMany: async () => [{ enrollProSchoolYearId: SCHOOL_YEAR_ID, yearLabel: '2030-2031' }],
			findFirst: async () => ({ enrollProSchoolYearId: SCHOOL_YEAR_ID }),
			findUnique: async () => ({ isActive: true, isArchived: false, termContractCache: nextCache(), termContractCachedAt: new Date('2030-01-01T00:00:00Z') }),
		},
		sectionMirror: { findMany: async () => [section], count: async () => 1, createMany: record('sectionMirror.createMany') },
		subject: { findMany: async () => subjects },
		facultyMirror: { findMany: async () => [{ id: 71, firstName: 'T', lastName: 'Teacher', department: 'MATH', maxHoursPerWeek: 40, ancillaryMinutesPerWeek: 0, isActiveForScheduling: true, isStale: false, canTeachOutsideDepartment: true }] },
		facultySubject: { findMany: async () => [{ id: 1, facultyId: 71, subjectId: 11, gradeLevels: [7], sectionIds: [9001] }] },
		room: { findMany: async () => [{ id: 201, type: 'CLASSROOM', isTeachingSpace: true, isSharedFacility: false, capacity: 50, features: [], floor: 1, buildingId: 301, buildingZoneId: 'Z1', building: { gradeScope: [7] } }] },
		building: { findMany: async () => [{ id: 301, name: 'Building 1', shortCode: 'B1', x: 0, y: 0 }] },
		facultyPreference: { findMany: async () => [] },
		// TEACHER-AVAILABILITY-AUTHORITY-C01: generation now reads the reviewed
		// term-scoped availability authority instead of the legacy preference read.
		facultyAvailability: { findMany: async () => [] },
		policySpecialEvent: { findMany: async () => [] },
		gradeShiftWindow: { findMany: async () => [], createMany: record('gradeShiftWindow.createMany') },
		classProgramSlot: {
			findMany: async (args: any) => {
				const where = args?.where ?? {};
				return slotRows.filter((row) => (where.gradeLevel == null || row.gradeLevel === where.gradeLevel) && (where.programType === undefined || row.programType === where.programType) && (where.isActive === undefined || row.isActive === where.isActive));
			},
			createMany: record('classProgramSlot.createMany'),
		},
		classTemplate: { findMany: async () => [{ programType: 'REGULAR', periodLengthMinutes: 45, periodsPerDay: 8 }], createMany: record('classTemplate.createMany') },
		instructionalCohort: { findMany: async () => [] },
		sectionSnapshot: { findUnique: async () => null, upsert: record('sectionSnapshot.upsert') },
		publishedScheduleRevision: { count: async () => 0 },
		facultyRoomPreference: { count: async () => 0 },
		$transaction: record('$transaction'), $executeRaw: record('$executeRaw'),
		$queryRaw: async () => [], $queryRawUnsafe: async () => [],
	};
	return { client, writes, reads: () => readIndex };
}

async function runPreflight(plan: ReadPlan) {
	const harness = buildTermAuthorityClient(plan);
	const preflight = await buildGenerationPreflight(SCHOOL_ID, SCHOOL_YEAR_ID, { client: harness.client, includeRetainedDrafts: false });
	return { preflight, harness };
}

function staleBlockers(preflight: { blockers: Array<Record<string, any>> }) {
	return preflight.blockers.filter((blocker) => blocker.code === 'TERM_AUTHORITY_STALE');
}

// ─── B3-1/2: a healthy mirror-223 snapshot must NOT be reported stale ───────

test('B3 control 1+2. the unchanged mirror-223 persisted cache emits no TERM_AUTHORITY_STALE through the real preflight', async () => {
	const { preflight, harness } = await runPreflight({ reads: [mirrorCache(), mirrorCache()] });
	assert.equal(preflight.assembly.derived?.ok, true, 'the derived demand must resolve from the persisted cache');
	const stale = staleBlockers(preflight);
	assert.deepEqual(
		stale.map((blocker) => blocker.code), [],
		'the stored upstream semanticRevision is untrusted provenance and must never be compared with the canonical revision',
	);
	assert.deepEqual(harness.writes, [], 'a read-only preflight performs zero writes');
});

test('B3 control 1 (mutant). a zeroed upstream semanticRevision on otherwise unchanged authority still emits no stale blocker', async () => {
	// Restoring the cross-namespace comparison makes this fail: the stored string
	// would no longer equal the canonical revision.
	const { preflight, harness } = await runPreflight({
		reads: [mirrorCache({ semanticRevision: '0'.repeat(64) }), mirrorCache({ semanticRevision: '0'.repeat(64) })],
	});
	assert.equal(preflight.assembly.derived?.ok, true);
	assert.deepEqual(staleBlockers(preflight), [], 'the upstream revision is provenance only');
	assert.deepEqual(harness.writes, []);
});

test('B3 control 4. JSON object-key reordering of the persisted cache is deterministic (no stale blocker)', async () => {
	const reorderedFirst = reorderKeys(mirrorCache());
	const reorderedSecond = reorderKeys(mirrorCache());
	const { preflight } = await runPreflight({ reads: [reorderedFirst, reorderedSecond] });
	assert.equal(preflight.assembly.derived?.ok, true);
	assert.deepEqual(staleBlockers(preflight), [], 'the canonical revision must not depend on JSONB key order');
});

test('B3 control 3. a generation-relevant term field changed between the two reads emits typed TERM_AUTHORITY_STALE with zero writes', async () => {
	for (const mutation of [
		{ field: 'displayLabel', value: 'First Trimester (revised)' },
		{ field: 'startDate', value: '2030-06-02' },
		{ field: 'endDate', value: '2030-09-29' },
	] as const) {
		const changedTerms = terms();
		changedTerms[0] = { ...changedTerms[0], [mutation.field]: mutation.value };
		const { preflight, harness } = await runPreflight({ reads: [mirrorCache(), mirrorCache({ terms: changedTerms })] });
		const stale = staleBlockers(preflight);
		assert.equal(stale.length, 1, `a changed ${mutation.field} must be reported as stale authority`);
		assert.equal(stale[0].category, 'DEMAND_AUTHORITY');
		assert.equal(stale[0].owningSurface, 'EnrollPro term authority cache');
		assert.ok(stale[0].nextAction.length > 0);
		assert.deepEqual(harness.writes, [], `zero writes on the ${mutation.field} rejection`);
	}
});

test('B3 control 4b. malformed, foreign-school, wrong-year, duplicate, and out-of-order authority fail closed with the typed blocker and zero writes', async () => {
	const cases: Array<{ name: string; second: unknown }> = [
		{ name: 'malformed (not an object)', second: 'not-an-object' },
		{ name: 'foreign school', second: mirrorCache({ schoolId: 999 }) },
		{ name: 'wrong year', second: mirrorCache({ schoolYearId: 999 }) },
		{ name: 'duplicate term identity', second: mirrorCache({ terms: [{ identity: 'T1', displayLabel: 'First', order: 1, startDate: '2030-06-01', endDate: '2030-09-30' }, { identity: 'T1', displayLabel: 'Again', order: 2, startDate: '2030-10-01', endDate: '2031-01-31' }, { identity: 'T3', displayLabel: 'Third', order: 3, startDate: '2031-02-01', endDate: '2031-05-31' }] }) },
		{ name: 'out-of-order terms', second: mirrorCache({ terms: [{ identity: 'T2', displayLabel: 'Second', order: 2, startDate: '2030-10-01', endDate: '2031-01-31' }, { identity: 'T1', displayLabel: 'First', order: 1, startDate: '2030-06-01', endDate: '2030-09-30' }, { identity: 'T3', displayLabel: 'Third', order: 3, startDate: '2031-02-01', endDate: '2031-05-31' }] }) },
		{ name: 'missing cache', second: null },
		{ name: 'malformed boundary value', second: mirrorCache({ terms: [{ identity: 'T1', displayLabel: 'First', order: 1, startDate: 20300601, endDate: '2030-09-30' }, { identity: 'T2', displayLabel: 'Second', order: 2, startDate: '2030-10-01', endDate: '2031-01-31' }, { identity: 'T3', displayLabel: 'Third', order: 3, startDate: '2031-02-01', endDate: '2031-05-31' }] }) },
	];
	for (const entry of cases) {
		const { preflight, harness } = await runPreflight({ reads: [mirrorCache(), entry.second] });
		const stale = staleBlockers(preflight);
		assert.equal(stale.length, 1, `${entry.name} must fail closed with the typed TERM_AUTHORITY_STALE blocker`);
		assert.equal(stale[0].category, 'DEMAND_AUTHORITY');
		assert.match(stale[0].reason, /could not be normalized|changed between/, `${entry.name} must explain the rejection`);
		assert.deepEqual(harness.writes, [], `${entry.name} must perform zero writes`);
	}
});

// ─── Canonical payload: completeness and determinism ───────────────────────

test('B3. the canonical revision binds identity, displayLabel, order, and retained term boundaries field-by-field', () => {
	const base = terms();
	const revision = canonicalTermStructureRevision(SCHOOL_ID, SCHOOL_YEAR_ID, 'TRIMESTER', base);
	assert.match(revision, /^[A-F0-9]{64}$/);
	assert.equal(revision, canonicalTermStructureRevision(SCHOOL_ID, SCHOOL_YEAR_ID, 'TRIMESTER', [...base]), 'order of the input array must not matter');
	assert.equal(revision, canonicalTermStructureRevision(SCHOOL_ID, SCHOOL_YEAR_ID, 'TRIMESTER', [...base].reverse()), 'the payload sorts by `order`');

	// Every generation-relevant field must move the revision.
	assert.notEqual(revision, canonicalTermStructureRevision(SCHOOL_ID, SCHOOL_YEAR_ID, 'TRIMESTER', [{ ...base[0], identity: 'T1X' }, base[1], base[2]]));
	assert.notEqual(revision, canonicalTermStructureRevision(SCHOOL_ID, SCHOOL_YEAR_ID, 'TRIMESTER', [{ ...base[0], displayLabel: 'Renamed' }, base[1], base[2]]));
	assert.notEqual(revision, canonicalTermStructureRevision(SCHOOL_ID, SCHOOL_YEAR_ID, 'TRIMESTER', [{ ...base[0], startDate: '2030-06-02' }, base[1], base[2]]));
	assert.notEqual(revision, canonicalTermStructureRevision(SCHOOL_ID, SCHOOL_YEAR_ID, 'TRIMESTER', [{ ...base[0], endDate: '2030-09-29' }, base[1], base[2]]));
	assert.notEqual(revision, canonicalTermStructureRevision(SCHOOL_ID, 10, 'TRIMESTER', base));
	assert.notEqual(revision, canonicalTermStructureRevision(SCHOOL_ID, SCHOOL_YEAR_ID, 'QUARTERS', base));
});

test('B3. the shared normalizer retains and validates persisted term boundaries and recomputes the revision canonically', () => {
	const normalized = normalizePersistedTermStructure(mirrorCache(), SCHOOL_ID, SCHOOL_YEAR_ID);
	assert.equal(normalized.ok, true);
	if (!normalized.ok) return;
	assert.deepEqual(normalized.structure.terms.map((term) => ({ identity: term.identity, displayLabel: term.displayLabel, order: term.order })), [
		{ identity: 'T1', displayLabel: 'First Trimester', order: 1 },
		{ identity: 'T2', displayLabel: 'Second Trimester', order: 2 },
		{ identity: 'T3', displayLabel: 'Third Trimester', order: 3 },
	]);
	assert.equal(normalized.structure.terms[0].startDate, '2030-06-01', 'the normalizer must retain the persisted term start boundary');
	assert.equal(normalized.structure.terms[2].endDate, '2031-05-31', 'the normalizer must retain the persisted term end boundary');
	assert.equal(
		normalized.structure.revision,
		canonicalTermStructureRevision(SCHOOL_ID, SCHOOL_YEAR_ID, 'TRIMESTER', normalized.structure.terms),
		'the normalizer must recompute the revision through the one shared canonical helper',
	);
	assert.notEqual(normalized.structure.revision, MIRROR_223_UPSTREAM_REVISION, 'the upstream order-sensitive hash is a different namespace');
	// Key-reordered input normalizes to the identical canonical revision.
	const reordered = normalizePersistedTermStructure(reorderKeys(mirrorCache()), SCHOOL_ID, SCHOOL_YEAR_ID);
	assert.equal(reordered.ok, true);
	if (reordered.ok) assert.equal(reordered.structure.revision, normalized.structure.revision);
});
