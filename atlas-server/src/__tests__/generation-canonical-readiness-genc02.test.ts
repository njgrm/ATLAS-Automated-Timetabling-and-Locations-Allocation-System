/**
 * GEN-C02 Ã¢â‚¬â€ canonical generation readiness and legacy-consumer closure.
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
	buildDerivedDemand,
	toPerPairDemandItems,
	toSchedulerDemandOverride,
	type DerivedDemandInput,
	type DerivedSubjectInput,
	type DerivedSectionInput,
} from '../services/derived-demand.service.js';
import { runHybridScheduler } from '../services/hybrid-scheduler.js';
import { getExpectedCanonicalSlots, normalizeInternalGradeId } from '../services/class-program-slot.service.js';
import { buildGenerationReadiness } from '../services/generation-readiness.service.js';
import { buildGenerationPreflight, buildPreflightConstructorInput } from '../services/generation-preflight.service.js';
import {
	buildTimetableOutputProjections,
	validateTermTeacherResolution,
	validateTimetableShapePolicy,
} from '../services/timetable-shape-policy.service.js';
import { normalizeProgramType } from '../services/generation-shape-assembly.service.js';
import type { ScheduledEntry } from '../services/constraint-validator.js';
import type { VerifiedTermContract } from '../services/enrollpro-term-contract.service.js';
import type { ConstructorInput } from '../services/schedule-constructor.js';
import type { SectionsByGrade } from '../services/section-adapter.js';

const SCHOOL_ID = 41;
const SCHOOL_YEAR_ID = 8;

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ 1. Legacy consumer closure Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ 2. Derived per-pair projection parity Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

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

	// One item per (subject, section) pair Ã¢â‚¬â€ rotation members are NOT collapsed.
	assert.equal(items.length, result.totalPairs);
	assert.equal(items.length, 5);
	const bio = items.find((item) => item.subjectId === 13);
	assert.deepEqual(bio?.applicableTermIdentities, ['T1']);
	const math = items.find((item) => item.subjectId === 11);
	assert.deepEqual(math?.applicableTermIdentities, ['T1', 'T2', 'T3']);
	// Session math mirrors the derived contract.
	assert.equal(math?.sessionsPerWeek, 4);
});

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ 3-5. Read-only readiness dry run with an in-memory client Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

interface MockOverrides {
	ownership?: boolean;
	retainedLock?: { subjectId: number; termIndex: number; day: string; startTime: string; endTime: string };
	/** C4: persisted term snapshot absent -> derived demand is a typed blocker. */
	noTermCache?: boolean;
	/** C4: no sole active year -> buildDerivedDemand throws ACTIVE_YEAR_UNAVAILABLE. */
	noActiveYear?: boolean;
	/** C9: push MATH weekly minutes above canonical CLASS capacity. */
	hugeMathMinutes?: boolean;
	/** C6: change presentation ordering only; authoritative grade must not move. */
	displayOrderOverride?: number;
	/** C10: make one rotation-family member nonuniform in weekly minutes. */
	nonuniformRotation?: boolean;
	/** C03R3: give each subject its own qualified teacher (canonical clean fixture). */
	distinctTeachers?: boolean;
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
		gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: overrides.displayOrderOverride ?? 7, maxCapacity: 50, enrolledCount: 40,
		programType: 'REGULAR', programCode: 'REGULAR', programName: 'Regular', isSpecialProgram: false,
		tleProgramId: null, tleSpecialization: null, tleProgramCategory: null, homeRoomId: null, buildingZoneId: null,
		isActiveForScheduling: true, isStale: false,
	}];

	const subjects = [
		{ id: 11, code: 'MATH', name: 'Mathematics', schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: [7], programScopes: ['REGULAR'], rotationFamily: null, modularOrder: null, minMinutesPerWeek: overrides.hugeMathMinutes ? 5000 : 240, preferredRoomType: 'CLASSROOM', requiredFeatures: [], isActive: true, ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST', interSectionEnabled: false, interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: null },
		{ id: 12, code: 'ENG', name: 'English', schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: [7], programScopes: ['REGULAR'], rotationFamily: null, modularOrder: null, minMinutesPerWeek: 180, preferredRoomType: 'CLASSROOM', requiredFeatures: [], isActive: true, ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST', interSectionEnabled: false, interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: null },
		{ id: 13, code: 'SCI_BIO', name: 'Science Biology', schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: [7], programScopes: ['REGULAR'], rotationFamily: 'SCIENCE', modularOrder: 1, minMinutesPerWeek: 180, preferredRoomType: 'CLASSROOM', requiredFeatures: [], isActive: true, ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST', interSectionEnabled: false, interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: 'SCIENCE' },
		{ id: 14, code: 'SCI_CHEM', name: 'Science Chemistry', schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: [7], programScopes: ['REGULAR'], rotationFamily: 'SCIENCE', modularOrder: 2, minMinutesPerWeek: overrides.nonuniformRotation ? 300 : 180, preferredRoomType: 'CLASSROOM', requiredFeatures: [], isActive: true, ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST', interSectionEnabled: false, interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: 'SCIENCE' },
		{ id: 15, code: 'SCI_PHY', name: 'Science Physics', schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: [7], programScopes: ['REGULAR'], rotationFamily: 'SCIENCE', modularOrder: 3, minMinutesPerWeek: 180, preferredRoomType: 'CLASSROOM', requiredFeatures: [], isActive: true, ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST', interSectionEnabled: false, interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: 'SCIENCE' },
	];

	const faculty = overrides.distinctTeachers
		? [
			{ id: 71, externalId: 710, firstName: 'A', lastName: 'Math', department: 'REGULAR', maxHoursPerWeek: 30, ancillaryMinutesPerWeek: 0, isActiveForScheduling: true, isStale: false, canTeachOutsideDepartment: true },
			{ id: 72, externalId: 720, firstName: 'B', lastName: 'Eng', department: 'REGULAR', maxHoursPerWeek: 30, ancillaryMinutesPerWeek: 0, isActiveForScheduling: true, isStale: false, canTeachOutsideDepartment: true },
			{ id: 73, externalId: 730, firstName: 'C', lastName: 'Bio', department: 'SCIENCE', maxHoursPerWeek: 30, ancillaryMinutesPerWeek: 0, isActiveForScheduling: true, isStale: false, canTeachOutsideDepartment: true },
			{ id: 74, externalId: 740, firstName: 'D', lastName: 'Chem', department: 'SCIENCE', maxHoursPerWeek: 30, ancillaryMinutesPerWeek: 0, isActiveForScheduling: true, isStale: false, canTeachOutsideDepartment: true },
			{ id: 75, externalId: 750, firstName: 'E', lastName: 'Phy', department: 'SCIENCE', maxHoursPerWeek: 30, ancillaryMinutesPerWeek: 0, isActiveForScheduling: true, isStale: false, canTeachOutsideDepartment: true },
		]
		: [{ id: 71, externalId: 710, firstName: 'A', lastName: 'Teacher', department: 'REGULAR', maxHoursPerWeek: 30, ancillaryMinutesPerWeek: 0, isActiveForScheduling: true, isStale: false, canTeachOutsideDepartment: true }];
	const teacherBySubject: Record<number, number> = overrides.distinctTeachers
		? { 11: 71, 12: 72, 13: 73, 14: 74, 15: 75 }
		: { 11: 71, 12: 71, 13: 71, 14: 71, 15: 71 };
	const facultySubjects = [11, 12, 13, 14, 15].map((subjectId) => ({ facultyId: teacherBySubject[subjectId], subjectId, gradeLevels: [7], sectionIds: [9001] }));
	const ownership = overrides.ownership === false
		? []
		: [11, 12, 13, 14, 15].map((subjectId, index) => ({ id: index + 1, subjectId, sectionId: 9001, facultyId: teacherBySubject[subjectId], facultySubjectId: index + 1 }));

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
			findMany: async () => overrides.noActiveYear ? [] : [{ enrollProSchoolYearId: SCHOOL_YEAR_ID, yearLabel: '2029-2030' }],
			findUnique: async () => overrides.noTermCache
				? { isActive: true, isArchived: false, termContractCache: null, termContractCachedAt: null }
				: ({
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

	// UX-C01 stable contract: the operator surface requires these exact fields.
	for (const key of ['derivedDemandRevision', 'generateAllowed', 'blockers', 'totals', 'scheduler', 'violations', 'teachingLoadCoverage', 'decisionNotes', 'databaseSignature', 'termStructure']) {
		assert.ok(key in readiness, `readiness payload must expose ${key}`);
	}
	assert.ok(Array.isArray(readiness.decisionNotes) && readiness.decisionNotes.length > 0, 'unresolved stakeholder decisions must be surfaced');

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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ GEN-C02R corrections Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

test('C4a. unavailable term authority returns structured blocked readiness (no throw, zero writes)', async () => {
	const { client, writes } = buildMockClient({ noTermCache: true });
	const readiness = await buildGenerationReadiness(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: undefined, enforceShiftWindows: false });
	assert.equal(readiness.status, 'BLOCKED');
	assert.equal(readiness.generateAllowed, false);
	assert.equal(readiness.schedulerExecuted, false, 'downstream scheduler must not run without resolved demand');
	assert.ok(readiness.derivedDemandBlockers.some((blocker) => blocker.code === 'TERM_STRUCTURE_UNAVAILABLE'));
	assert.ok(readiness.blockers.some((blocker) => blocker.code === 'TERM_STRUCTURE_UNAVAILABLE'));
	assert.deepEqual(writes, [], 'a blocked readiness result must still be zero-write');
});

test('C4b. missing active year is converted to a typed blocker instead of thrown', async () => {
	const { client } = buildMockClient({ noActiveYear: true });
	const readiness = await buildGenerationReadiness(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	assert.equal(readiness.status, 'BLOCKED');
	assert.equal(readiness.generateAllowed, false);
	assert.equal(readiness.schedulerExecuted, false);
	assert.ok(readiness.derivedDemandBlockers.some((blocker) => blocker.code === 'ACTIVE_YEAR_UNAVAILABLE'));
});

test('C6. section displayOrder never determines curriculum demand scope', async () => {
	const base = buildMockClient();
	const permuted = buildMockClient({ displayOrderOverride: 99 });
	const baseDemand = await buildDerivedDemand(SCHOOL_ID, SCHOOL_YEAR_ID, { client: base.client, termContract: TERM_CONTRACT });
	const permutedDemand = await buildDerivedDemand(SCHOOL_ID, SCHOOL_YEAR_ID, { client: permuted.client, termContract: TERM_CONTRACT });
	assert.equal(baseDemand.ok, true);
	assert.equal(permutedDemand.ok, true);
	if (!baseDemand.ok || !permutedDemand.ok) return;
	assert.equal(baseDemand.timetableLines.every((line) => line.gradeLevel === 7), true);
	// Authoritative grade comes from gradeLevelId (internal 17 -> grade 7), so a
	// presentation-order change must not change any curriculum demand/revision.
	assert.equal(permutedDemand.timetableLines.every((line) => line.gradeLevel === 7), true);
	assert.equal(permutedDemand.revision, baseDemand.revision, 'displayOrder must not change the derived revision');
});

test('C9. demand above canonical CLASS capacity is a typed HARD blocker (never an escape hatch)', async () => {
	const { client } = buildMockClient({ hugeMathMinutes: true });
	const readiness = await buildGenerationReadiness(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	const capacityBlocker = readiness.blockers.find((entry) => entry.code === 'CANONICAL_SHAPE_CAPACITY_EXCEEDED');
	assert.ok(capacityBlocker, 'over-capacity demand must surface CANONICAL_SHAPE_CAPACITY_EXCEEDED');
	assert.equal(capacityBlocker?.category, 'POLICY_BLOCKER');
	assert.ok(capacityBlocker?.termIdentity, 'the capacity blocker must name the term identity');
	assert.ok(capacityBlocker?.sectionId, 'the capacity blocker must name the section');
	assert.equal(readiness.generateAllowed, false);
});

test('C10a. a nonuniform rotating family fails closed instead of collapsing to the family maximum', () => {
	const input = derivedInput();
	const nonuniform = { ...input, subjects: input.subjects.map((s) => s.id === 14 ? { ...s, minMinutesPerWeek: 300 } : s) };
	const result = deriveCanonicalDemand(nonuniform);
	assert.equal(result.ok, true);
	if (!result.ok) return;

	const sectionsByGrade: SectionsByGrade[] = [{
		gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7,
		sections: [{ mirrorId: 501, id: 9001, name: '7-A', maxCapacity: 50, enrolledCount: 40, gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR' }],
	}];
	const subjects = derivedSubjects().map((s): ConstructorInput['subjects'][number] => ({
		id: s.id, code: s.code, name: s.name, minMinutesPerWeek: s.id === 14 ? 300 : s.minMinutesPerWeek,
		preferredRoomType: 'CLASSROOM', gradeLevels: s.gradeLevels, programScopes: s.programScopes,
	}));

	// Per-pair projection still preserves each member's exact per-term totals.
	const items = toPerPairDemandItems(result, sectionsByGrade, subjects);
	const bio = items.find((item) => item.subjectId === 13);
	const chem = items.find((item) => item.subjectId === 14);
	const phy = items.find((item) => item.subjectId === 15);
	assert.deepEqual(bio?.applicableTermIdentities, ['T1']);
	assert.deepEqual(chem?.applicableTermIdentities, ['T2']);
	assert.deepEqual(phy?.applicableTermIdentities, ['T3']);
	assert.equal(bio?.sessionsPerWeek, 3);
	assert.equal(chem?.sessionsPerWeek, 5, 'the uneven member keeps its own session count');
	assert.equal(phy?.sessionsPerWeek, 3);

	// The collapsed scheduler lane must fail closed rather than use max(5) for all terms.
	assert.throws(
		() => toSchedulerDemandOverride(result, sectionsByGrade, subjects),
		(error: unknown) => (error as { code?: string }).code === 'ROTATION_DEMAND_INCONSISTENT',
	);
});

test('C10b. readiness reports ROTATION_DEMAND_INCONSISTENT and does not run the scheduler', async () => {
	const { client } = buildMockClient({ nonuniformRotation: true });
	const readiness = await buildGenerationReadiness(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	assert.equal(readiness.schedulerExecuted, false);
	assert.ok(readiness.blockers.some((entry) => entry.code === 'ROTATION_DEMAND_INCONSISTENT'));
	assert.equal(readiness.generateAllowed, false);
});

test('C7. the canonical owner is the only scheduler candidate for its pair', async () => {
	const { constructBaseline } = await import('../services/schedule-constructor.js');
	const input: ConstructorInput = {
		schoolId: SCHOOL_ID,
		schoolYearId: SCHOOL_YEAR_ID,
		sectionsByGrade: [{
			gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7,
			sections: [{ mirrorId: 501, id: 9001, name: '7-A', maxCapacity: 50, enrolledCount: 40, gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR' }],
		}],
		subjects: [{ id: 11, code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 60, preferredRoomType: 'CLASSROOM', gradeLevels: [7], programScopes: ['REGULAR'] }],
		faculty: [
			{ id: 71, maxHoursPerWeek: 30, department: 'MATH' },
			{ id: 72, maxHoursPerWeek: 30, department: 'MATH' },
		],
		facultySubjects: [
			{ facultyId: 71, subjectId: 11, gradeLevels: [7], sectionIds: [9001] },
			{ facultyId: 72, subjectId: 11, gradeLevels: [7], sectionIds: [9001] },
		],
		rooms: [{ id: 201, type: 'CLASSROOM', isTeachingSpace: true, isSharedFacility: false, capacity: 50, buildingId: 301, buildingZoneId: 'Z1', buildingGradeScope: [7] } as never],
		preferences: [],
		policy: { periodLengthMinutes: 60, periodsPerDay: 8, earliestStartTime: '07:00', latestEndTime: '17:00', enableLunchWindow: false, enableFlagCeremony: false, enableRecess: false } as never,
		lockedEntries: [],
		gradeWindows: [],
		demandOverride: [{ sectionId: 9001, subjectId: 11, subjectCode: 'MATH', gradeLevel: 7, sessionsPerWeek: 1, durationPerSession: 60, enrolledCount: 40, entryKind: 'SECTION', programType: 'REGULAR', roomTypePreference: 'CLASSROOM' }],
		pairOwners: { '11:9001': 71 },
	};
	const result = constructBaseline(input);
	const mathEntries = result.entries.filter((entry) => entry.subjectId === 11 && entry.sectionId === 9001);
	assert.ok(mathEntries.length > 0, 'the owned pair must be scheduled');
	assert.equal(mathEntries.every((entry) => entry.facultyId === 71), true, 'only the canonical owner may be assigned');
});

// ─── TT-OUTPUT-C03R3: readiness must validate RESOLVED per-term entries ──────
//
// The constructor emits COMPACT base entries: a year-long subject session has no
// term identity and a rotating family is one lane carrying
// `metadata.modularAssignments[]`. The readiness diagnostic validated the raw
// entries, so it false-blocked an otherwise clean year-long + rotation dataset
// with ROTATION_TERM_INVALID, TERM_TEACHER_UNRESOLVED, and
// OUTPUT_SHAPE_MISMATCH. These two tests fail on the pre-fix consumer.

test('C03R3a. the readiness diagnostic validates resolved per-term entries and reports the canonical fixture READY', async () => {
	const { client, writes } = buildMockClient({ distinctTeachers: true });
	const readiness = await buildGenerationReadiness(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });

	assert.equal(readiness.schedulerExecuted, true, 'the real hybrid scheduler must run');
	assert.equal(readiness.violations.hardCount, 0, 'a cleanly resolved schedule must have zero hard violations');
	const codes = readiness.blockers.map((entry) => entry.code);
	for (const code of ['ROTATION_TERM_INVALID', 'TERM_TEACHER_UNRESOLVED', 'OUTPUT_SHAPE_MISMATCH']) {
		assert.equal(codes.includes(code), false, `${code} must not be reported once per-term entries are resolved before validation`);
	}
	assert.equal(readiness.status, 'READY');
	assert.equal(readiness.generateAllowed, true, 'year-long + rotation demand must be generateAllowed');
	assert.deepEqual(writes, [], 'the readiness dry run must remain zero-write');
});

test('C03R3b mutant: validating the raw compact entries reproduces the false block the fix removes', async () => {
	// Reconstruct the pre-fix production consumer: run the REAL shared preflight
	// and the REAL scheduler, then feed the RAW `result.entries` straight into the
	// same shape/teacher checks. This proves the resolution step (not merely a new
	// assertion) is load-bearing.
	const { client } = buildMockClient({ distinctTeachers: true });
	const preflight = await buildGenerationPreflight(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	const assembly = preflight.assembly;
	assert.ok(assembly.derived, 'the canonical derived demand must be available');
	if (!assembly.derived) return;

	const rawEntries = runHybridScheduler(buildPreflightConstructorInput(assembly, {})).entries as ScheduledEntry[];
	const rawShapePolicy = validateTimetableShapePolicy({
		termAuthority: { format: assembly.derived.termStructure.format, terms: assembly.derived.termStructure.terms.map((term) => ({ identity: term.identity, order: term.order })), cachedAt: 'derived-demand-authority' },
		validateShiftWindows: false,
		shiftWindows: [],
		sections: assembly.sectionsByGrade.flatMap((grade) => grade.sections.map((section) => ({ id: section.id, gradeLevel: normalizeInternalGradeId(grade.gradeLevelId), programType: normalizeProgramType(section.programType) }))),
		shapes: assembly.timetableShapeContracts,
		rooms: assembly.rooms,
		subjects: assembly.subjects.map((subject: any) => ({ id: subject.id, code: subject.code, schedulingDisposition: subject.schedulingDisposition })),
		entries: rawEntries.map((entry) => ({ entryId: entry.entryId, sectionId: entry.sectionId, facultyId: entry.facultyId, roomId: entry.roomId, subjectId: entry.subjectId, termIndex: entry.termIndex ?? 0, startTime: entry.startTime, endTime: entry.endTime })),
		outputProjections: buildTimetableOutputProjections(rawEntries),
	});
	const rawTeacherBlockers = validateTermTeacherResolution(rawEntries.map((entry) => ({ subjectId: entry.subjectId, sectionId: entry.sectionId, termIndex: entry.termIndex ?? 0, facultyId: entry.facultyId })));
	const rawCodes = [...rawShapePolicy.map((entry) => entry.code), ...rawTeacherBlockers.map((entry) => entry.code)];

	assert.ok(rawCodes.includes('ROTATION_TERM_INVALID'), 'raw compact entries must false-block with ROTATION_TERM_INVALID');
	assert.ok(
		rawCodes.includes('TERM_TEACHER_UNRESOLVED') || rawCodes.includes('OUTPUT_SHAPE_MISMATCH'),
		'raw compact entries must false-block the teacher/shape checks',
	);

	// Positive control: the fixed readiness consumer on the exact same fixture
	// reports none of those blockers and allows generation.
	const { client: fixedClient } = buildMockClient({ distinctTeachers: true });
	const readiness = await buildGenerationReadiness(SCHOOL_ID, SCHOOL_YEAR_ID, { client: fixedClient, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	assert.equal(readiness.blockers.some((entry) => entry.code === 'ROTATION_TERM_INVALID'), false, 'the resolved consumer must not report ROTATION_TERM_INVALID');
	assert.equal(readiness.blockers.some((entry) => entry.code === 'TERM_TEACHER_UNRESOLVED'), false, 'the resolved consumer must not report TERM_TEACHER_UNRESOLVED');
	assert.equal(readiness.generateAllowed, true);
});
