/**
 * GEN-C02 — canonical generation readiness and legacy-consumer closure.
 *
 * Run (server workspace): `npx tsx src/__tests__/generation-canonical-readiness-genc02.test.ts`
 *
 * Proves:
 *  1. The legacy catalog `computeDemand()` consumer call sites are gone from the
 *     pre-generation draft, sync/setup, and quick-place services; the hybrid
 *     scheduler fails closed without a canonical derived-demand override.
 *  2. The derived per-pair projection preserves subject identity, exact ordered
 *     term identities, and pair parity.
 *  3. The read-only readiness dry run executes the real scheduler with zero
 *     writes, is deterministic for identical inputs, and reports a
 *     write-recorder positive control.
 *  4. Teaching Load coverage gaps become deterministic, owned blockers.
 *  5. Retained draft placements that no longer match live demand are reported
 *     (never silently carried) with a structured rejection.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
	deriveCanonicalDemand,
	toPerPairDemandItems,
	type DerivedDemandInput,
	type DerivedSubjectInput,
	type DerivedSectionInput,
} from '../services/derived-demand.service.js';
import { runHybridScheduler } from '../services/hybrid-scheduler.js';
import { getExpectedCanonicalSlots } from '../services/class-program-slot.service.js';
import { buildGenerationReadiness } from '../services/generation-readiness.service.js';
import type { VerifiedTermContract } from '../services/enrollpro-term-contract.service.js';
import type { ConstructorInput } from '../services/schedule-constructor.js';
import type { SectionsByGrade } from '../services/section-adapter.js';

const SCHOOL_ID = 41;
const SCHOOL_YEAR_ID = 8;

// ─── 1. Legacy consumer closure ─────────────────────────────────────────────

function readServiceSource(relative: string): string {
	return readFileSync(fileURLToPath(new URL(`../services/${relative}`, import.meta.url)), 'utf8');
}

/** Strip line and block comments so a textual `computeDemand()` mention in prose is not a false positive. */
function stripComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

test('1a. no reachable generation/draft/sync/quick-place path calls computeDemand()', () => {
	for (const file of ['pre-generation-draft.service.ts', 'timetable-sync-setup.service.ts', 'timetable-quick-place.service.ts']) {
		const source = stripComments(readServiceSource(file));
		assert.equal(/computeDemand\s*\(/.test(source), false, `${file} must not call legacy computeDemand()`);
	}
	const hybrid = stripComments(readServiceSource('hybrid-scheduler.ts'));
	assert.equal(/import[^;]*computeDemand/.test(hybrid), false, 'hybrid-scheduler must not import computeDemand');
	assert.match(hybrid, /input\.demandOverride == null/, 'hybrid-scheduler must fail closed without a canonical override');
});

test('1b. the hybrid scheduler fails closed without the derived demand override', () => {
	const input: ConstructorInput = {
		schoolId: SCHOOL_ID,
		schoolYearId: SCHOOL_YEAR_ID,
		sectionsByGrade: [],
		subjects: [],
		faculty: [],
		facultySubjects: [],
		rooms: [],
		preferences: [],
	};
	assert.throws(() => runHybridScheduler(input), (error: unknown) => (error as { code?: string }).code === 'DERIVED_DEMAND_REQUIRED');
	// Empty override is accepted (proves the override is authoritative, not a fallback).
	const empty = runHybridScheduler({ ...input, demandOverride: [] });
	assert.equal(empty.assignedCount, 0);
	assert.equal(empty.unassignedItems.length, 0);
});

// ─── 2. Derived per-pair projection parity ──────────────────────────────────

const TERM_CONTRACT: VerifiedTermContract = {
	schoolId: SCHOOL_ID,
	schoolYear: { id: SCHOOL_YEAR_ID, yearLabel: '2029-2030' },
	format: 'TRIMESTER',
	terms: [
		{ identity: 'T1', displayLabel: 'First Trimester', order: 1, startDate: '2029-06-01', endDate: '2029-09-01' },
		{ identity: 'T2', displayLabel: 'Second Trimester', order: 2, startDate: '2029-09-02', endDate: '2030-01-01' },
		{ identity: 'T3', displayLabel: 'Third Trimester', order: 3, startDate: '2030-01-02', endDate: '2030-04-01' },
	],
	semanticRevision: 'A'.repeat(64),
	activeTerm: { identity: 'T2', displayLabel: 'Second Trimester', order: 2 },
	activeTermState: { availability: 'RESOLVED', code: null, message: 'resolved', reachable: true, identity: 'T2' },
};

function derivedSubjects(): DerivedSubjectInput[] {
	const base = (overrides: Partial<DerivedSubjectInput> & Pick<DerivedSubjectInput, 'id' | 'code'>): DerivedSubjectInput => ({
		name: overrides.code,
		schedulingDisposition: 'SCHEDULED_TEACHING',
		gradeLevels: [7],
		programScopes: ['REGULAR'],
		rotationFamily: null,
		modularOrder: null,
		minMinutesPerWeek: 240,
		isActive: true,
		preferredRoomType: 'CLASSROOM',
		requiredFeatures: [],
		...overrides,
	});
	return [
		base({ id: 11, code: 'MATH', minMinutesPerWeek: 240 }),
		base({ id: 12, code: 'ENG', minMinutesPerWeek: 180 }),
		base({ id: 13, code: 'SCI_BIO', rotationFamily: 'SCIENCE', modularOrder: 1, minMinutesPerWeek: 180 }),
		base({ id: 14, code: 'SCI_CHEM', rotationFamily: 'SCIENCE', modularOrder: 2, minMinutesPerWeek: 180 }),
		base({ id: 15, code: 'SCI_PHY', rotationFamily: 'SCIENCE', modularOrder: 3, minMinutesPerWeek: 180 }),
	];
}

function derivedInput(): DerivedDemandInput {
	return {
		schoolId: SCHOOL_ID,
		schoolYearId: SCHOOL_YEAR_ID,
		yearLabel: '2029-2030',
		termFormat: 'TRIMESTER',
		termStructureRevision: 'A'.repeat(64),
		terms: TERM_CONTRACT.terms,
		sections: [{ sectionMirrorId: 501, externalId: 9001, gradeLevel: 7, programType: 'REGULAR', isActiveForScheduling: true, isStale: false }],
		subjects: derivedSubjects(),
		periodLengthMinutes: 60,
	};
}

test('2. per-pair projection preserves subject identity, ordered terms, and parity', () => {
	const result = deriveCanonicalDemand(derivedInput());
	assert.equal(result.ok, true);
	if (!result.ok) return;

	const sectionsByGrade: SectionsByGrade[] = [{
		gradeLevelId: 17,
		gradeLevelName: 'Grade 7',
		displayOrder: 7,
		sections: [{
			mirrorId: 501, id: 9001, name: '7-A', maxCapacity: 50, enrolledCount: 40,
			gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR',
		}],
	}];
	const subjects = derivedSubjects().map((s): ConstructorInput['subjects'][number] => ({
		id: s.id, code: s.code, name: s.name, minMinutesPerWeek: s.minMinutesPerWeek,
		preferredRoomType: 'CLASSROOM', gradeLevels: s.gradeLevels, programScopes: s.programScopes,
	}));
	const items = toPerPairDemandItems(result, sectionsByGrade, subjects);

	// One item per (subject, section) pair — rotation members are NOT collapsed.
	assert.equal(items.length, result.totalPairs);
	assert.equal(items.length, 5);
	const bio = items.find((item) => item.subjectId === 13);
	assert.deepEqual(bio?.applicableTermIdentities, ['T1']);
	const math = items.find((item) => item.subjectId === 11);
	assert.deepEqual(math?.applicableTermIdentities, ['T1', 'T2', 'T3']);
	// Session math mirrors the derived contract.
	assert.equal(math?.sessionsPerWeek, 4);
});

// ─── 3-5. Read-only readiness dry run with an in-memory client ───────────────

interface MockOverrides {
	ownership?: boolean;
	retainedLock?: { subjectId: number; termIndex: number; day: string; startTime: string; endTime: string };
}

function buildMockClient(overrides: MockOverrides = {}) {
	const writes: string[] = [];

	const sectionsByGrade: SectionsByGrade[] = [{
		gradeLevelId: 17,
		gradeLevelName: 'Grade 7',
		displayOrder: 7,
		sections: [{
			mirrorId: 501, id: 9001, name: '7-A', maxCapacity: 50, enrolledCount: 40,
			gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR',
			homeRoomId: null, buildingZoneId: null, isSpecialProgram: false,
		}],
	}];

	const sectionMirrors = [{
		id: 501, externalId: 9001, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, name: '7-A',
		gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, maxCapacity: 50, enrolledCount: 40,
		programType: 'REGULAR', programCode: 'REGULAR', programName: 'Regular', isSpecialProgram: false,
		tleProgramId: null, tleSpecialization: null, tleProgramCategory: null, homeRoomId: null, buildingZoneId: null,
		isActiveForScheduling: true, isStale: false,
	}];

	const subjects = [
		{ id: 11, code: 'MATH', name: 'Mathematics', schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: [7], programScopes: ['REGULAR'], rotationFamily: null, modularOrder: null, minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM', requiredFeatures: [], isActive: true, ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST', interSectionEnabled: false, interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: null },
		{ id: 12, code: 'ENG', name: 'English', schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: [7], programScopes: ['REGULAR'], rotationFamily: null, modularOrder: null, minMinutesPerWeek: 180, preferredRoomType: 'CLASSROOM', requiredFeatures: [], isActive: true, ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST', interSectionEnabled: false, interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: null },
		{ id: 13, code: 'SCI_BIO', name: 'Science Biology', schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: [7], programScopes: ['REGULAR'], rotationFamily: 'SCIENCE', modularOrder: 1, minMinutesPerWeek: 180, preferredRoomType: 'CLASSROOM', requiredFeatures: [], isActive: true, ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST', interSectionEnabled: false, interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: 'SCIENCE' },
		{ id: 14, code: 'SCI_CHEM', name: 'Science Chemistry', schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: [7], programScopes: ['REGULAR'], rotationFamily: 'SCIENCE', modularOrder: 2, minMinutesPerWeek: 180, preferredRoomType: 'CLASSROOM', requiredFeatures: [], isActive: true, ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST', interSectionEnabled: false, interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: 'SCIENCE' },
		{ id: 15, code: 'SCI_PHY', name: 'Science Physics', schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: [7], programScopes: ['REGULAR'], rotationFamily: 'SCIENCE', modularOrder: 3, minMinutesPerWeek: 180, preferredRoomType: 'CLASSROOM', requiredFeatures: [], isActive: true, ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST', interSectionEnabled: false, interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: 'SCIENCE' },
	];

	const faculty = [{ id: 71, externalId: 710, firstName: 'A', lastName: 'Teacher', department: 'REGULAR', maxHoursPerWeek: 30, ancillaryMinutesPerWeek: 0, isActiveForScheduling: true, isStale: false, canTeachOutsideDepartment: true }];
	const facultySubjects = [11, 12, 13, 14, 15].map((subjectId) => ({ facultyId: 71, subjectId, gradeLevels: [7], sectionIds: [9001] }));
	const ownership = overrides.ownership === false
		? []
		: [11, 12, 13, 14, 15].map((subjectId, index) => ({ id: index + 1, subjectId, sectionId: 9001, facultyId: 71, facultySubjectId: index + 1 }));

	const rooms = [{ id: 201, type: 'CLASSROOM', isTeachingSpace: true, isSharedFacility: false, capacity: 50, features: [], buildingId: 301, buildingZoneId: 'Z1', building: { gradeScope: [7] } }];
	const buildings = [{ id: 301, name: 'Building 1', x: 0, y: 0 }];

	const policy = {
		id: 1, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID,
		teacherMoveEnabled: true, periodLengthMinutes: 60, periodsPerDay: 8,
		maxConsecutiveTeachingMinutesBeforeBreak: 120, minBreakMinutesAfterConsecutiveBlock: 15, maxTeachingMinutesPerDay: 480,
		earliestStartTime: '07:00', latestEndTime: '17:00', enforceConsecutiveBreakAsHard: false,
		enableTravelWellbeingChecks: false, maxWalkingDistanceMetersPerTransition: 120, maxBuildingTransitionsPerDay: 4,
		maxBackToBackTransitionsWithoutBuffer: 2, maxIdleGapMinutesPerDay: 60, avoidEarlyFirstPeriod: false, avoidLateLastPeriod: false,
		enableVacantAwareConstraints: false, targetFacultyDailyVacantMinutes: 60, targetSectionDailyVacantPeriods: 1,
		maxCompressedTeachingMinutesPerDay: 300, lunchStartTime: '12:00', lunchEndTime: '13:00', enforceLunchWindow: false,
		showSpecialEventsInGrid: false, enableFlagCeremony: false, flagCeremonyStartTime: '07:00', flagCeremonyEndTime: '07:30',
		enableRecess: false, recessStartTime: '09:45', recessEndTime: '10:00', enableLunchWindow: false,
		enableTleTwoPassPriority: true, allowFlexibleSubjectAssignment: false, allowConsecutiveLabSessions: false,
		constraintConfig: null,
	};

	const slotRows = getExpectedCanonicalSlots(7, 'REGULAR').map((slot, index) => ({
		id: index + 1, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, gradeLevel: 7, programType: 'REGULAR',
		startTime: slot.startTime, endTime: slot.endTime, rowKind: slot.rowKind, isActive: true,
		subjectFamily: slot.subjectFamily ?? null, subjectLabel: slot.subjectLabel ?? null, dayOfWeek: null,
	}));

	const locks: any[] = overrides.retainedLock
		? [{
			id: 900, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, entryKind: 'SECTION', sectionId: 9001,
			subjectId: overrides.retainedLock.subjectId, facultyId: 71, roomId: 201, cohortCode: null,
			status: 'DRAFT', lockedRunId: null, notes: null, version: 1, day: overrides.retainedLock.day,
			startTime: overrides.retainedLock.startTime, endTime: overrides.retainedLock.endTime,
			termIndex: overrides.retainedLock.termIndex, createdBy: 1,
			createdAt: new Date('2029-01-01'), updatedAt: new Date('2029-01-01'),
		}]
		: [];

	const recordWrite = (name: string) => (..._args: unknown[]) => { writes.push(name); return Promise.resolve({}); };

	const client: any = {
		generationRun: { count: async () => 0, findFirst: async () => null, findMany: async () => [] },
		lockedSession: { count: async () => locks.length, findFirst: async () => locks[0] ?? null, findMany: async () => locks },
		lockedSessionAction: { count: async () => 0 },
		auditLog: { count: async () => 0 },
		teachingLoadCycle: { findMany: async () => [] },
		subjectSectionOwnership: { count: async () => ownership.length, findMany: async () => ownership },
		schedulingPolicy: { findUnique: async () => policy },
		enrollProSchoolYearMirror: {
			findMany: async () => [{ enrollProSchoolYearId: SCHOOL_YEAR_ID, yearLabel: '2029-2030' }],
			findUnique: async () => ({
				isActive: true, isArchived: false,
				termContractCache: {
					schoolId: SCHOOL_ID, schoolYear: { id: SCHOOL_YEAR_ID }, format: 'TRIMESTER',
					terms: TERM_CONTRACT.terms.map((term) => ({ identity: term.identity, displayLabel: term.displayLabel, order: term.order })),
				},
				termContractCachedAt: new Date('2029-01-01'),
			}),
		},
		sectionMirror: { findMany: async () => sectionMirrors, count: async () => sectionMirrors.length },
		subject: { findMany: async () => subjects },
		facultyMirror: { findMany: async () => faculty },
		facultySubject: { findMany: async () => facultySubjects },
		room: { findMany: async () => rooms },
		building: { findMany: async () => buildings },
		facultyPreference: { findMany: async () => [] },
		policySpecialEvent: { findMany: async () => [] },
		gradeShiftWindow: { findMany: async () => [] },
		classProgramSlot: { findMany: async () => slotRows },
		classTemplate: { findMany: async () => [{ programType: 'REGULAR', periodLengthMinutes: 60, periodsPerDay: 8 }] },
		instructionalCohort: { findMany: async () => [] },
		sectionSnapshot: { findUnique: async () => ({ payload: sectionsByGrade, fetchedAt: new Date('2029-01-01') }) },
		publishedScheduleRevision: { count: async () => 0 },
		create: recordWrite('create'), update: recordWrite('update'), updateMany: recordWrite('updateMany'),
		delete: recordWrite('delete'), deleteMany: recordWrite('deleteMany'), upsert: recordWrite('upsert'),
		$transaction: recordWrite('$transaction'), $executeRaw: recordWrite('$executeRaw'), $queryRaw: async () => [],
	};

	return { client, writes };
}

test('3. the readiness dry run executes the real scheduler and performs zero writes', async () => {
	const { client, writes } = buildMockClient();
	const readiness = await buildGenerationReadiness(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });

	assert.equal(readiness.schedulerExecuted, true, 'the real hybrid scheduler must run in dry-run mode');
	assert.deepEqual(writes, [], 'the readiness dry run must perform zero writes');
	assert.equal(readiness.databaseSignature.zeroWrite, true, 'before/after database signature must be identical');

	// No retained locks configured: none reported.
	assert.equal(readiness.retainedLocks.retainedCount, 0);
	assert.equal(readiness.retainedLocks.rejected.length, 0);

	// Readiness must be a server-side decision derived from the dry run.
	assert.equal(readiness.generateAllowed, readiness.blockers.length === 0 && readiness.violations.hardCount === 0);

	// Positive control: the recorder detects a write when one occurs.
	await client.create({});
	assert.deepEqual(writes, ['create'], 'write recorder must detect writes');
});

test('4. identical inputs produce deterministic readiness output', async () => {
	const { client } = buildMockClient();
	const first = await buildGenerationReadiness(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	const second = await buildGenerationReadiness(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	assert.equal(first.derivedDemandRevision, second.derivedDemandRevision);
	assert.deepEqual(first.blockers, second.blockers);
	assert.equal(first.scheduler.assignedCount, second.scheduler.assignedCount);
	assert.equal(first.scheduler.unassignedCount, second.scheduler.unassignedCount);
	assert.equal(first.violations.hardCount, second.violations.hardCount);
});

test('5. uncovered derived demand becomes a deterministic, owned Teaching Load blocker', async () => {
	const { client } = buildMockClient({ ownership: false });
	const readiness = await buildGenerationReadiness(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	assert.equal(readiness.teachingLoadCoverage.requiredPairs, 5);
	assert.equal(readiness.teachingLoadCoverage.missingPairs, 5);
	const blocker = readiness.blockers.find((entry) => entry.code === 'TL_DEMAND_UNCOVERED');
	assert.ok(blocker, 'an uncovered Teaching Load pair must be reported');
	assert.equal(blocker?.category, 'DATA_GAP');
	assert.equal(blocker?.owningSurface, 'Teaching Load');
	assert.equal(readiness.generateAllowed, false);
});

test('6. a retained placement that no longer matches live demand is reported, never carried', async () => {
	const { client } = buildMockClient({ retainedLock: { subjectId: 13, termIndex: 3, day: 'MONDAY', startTime: '07:00', endTime: '08:00' } });
	const readiness = await buildGenerationReadiness(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	assert.equal(readiness.retainedLocks.retainedCount, 0);
	assert.equal(readiness.retainedLocks.rejected.length, 1);
	assert.equal(readiness.retainedLocks.rejected[0]?.placementId, 900);
	assert.ok(readiness.blockers.some((entry) => entry.code.startsWith('RETAINED_LOCK_')), 'a rejected retained lock must surface as a blocker');
});
