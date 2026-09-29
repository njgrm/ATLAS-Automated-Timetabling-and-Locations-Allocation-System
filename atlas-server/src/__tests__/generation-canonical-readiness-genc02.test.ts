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
import { ADVISORY_CODES as ADVISORY_CODES_FOR_TEST, deriveGenerateDecision } from '../services/generation-blocker-groups.service.js';
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
	/** A8 C3: leave exactly these subject ids unowned (partial coverage). */
	unownedSubjects?: number[];
	/** A8 C3: every teacher's own weekly contract is 1 hour -> a real HARD
	 * `FACULTY_OVERLOAD` whose entities carry no (section, subject) pair. */
	lowWeeklyCap?: boolean;
	/** A8 C3 F1: policy `maxTeachingMinutesPerDay: 30` -> a real HARD
	 * `FACULTY_DAILY_MAX_EXCEEDED`, a code that is NOT advisory-class. */
	tightDailyCap?: boolean;
	/** C9: push MATH weekly minutes above canonical CLASS capacity. */
	hugeMathMinutes?: boolean;
	/** C6: change presentation ordering only; authoritative grade must not move. */
	displayOrderOverride?: number;
	/** C10: make one rotation-family member nonuniform in weekly minutes. */
	nonuniformRotation?: boolean;
	/** C03R3: give each subject its own qualified teacher (canonical clean fixture). */
	distinctTeachers?: boolean;
	/**
	 * A8 UNBLOCK: make the MATH owner unavailable for the whole week as a
	 * persisted UNAVAILABLE authority. Every MATH slot is then a bare slot
	 * collision (`NO_AVAILABLE_SLOT` + `FACULTY_SLOT_UNAVAILABLE`) — the live
	 * 55-row shape — not a cap breach. Requires `distinctTeachers`.
	 */
	slotCollision?: boolean;
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
	// A8 C3: a teacher whose own weekly contract is 1 hour cannot hold the placed
	// load, so the REAL `constraint-validator` emits a HARD `FACULTY_OVERLOAD`
	// whose `entities` carry only a `facultyId`. That is the live 2023-2024 shape
	// ("4 teachers are over 30 hours") and the exact case the ruling makes an
	// ADVISORY for generation while publication still refuses it.
	const capHours = overrides.lowWeeklyCap ? 1 : 30;
	for (const member of faculty) member.maxHoursPerWeek = capHours;
	const teacherBySubject: Record<number, number> = overrides.distinctTeachers
		? { 11: 71, 12: 72, 13: 73, 14: 74, 15: 75 }
		: { 11: 71, 12: 71, 13: 71, 14: 71, 15: 71 };
	const facultySubjects = [11, 12, 13, 14, 15].map((subjectId) => ({ facultyId: teacherBySubject[subjectId], subjectId, gradeLevels: [7], sectionIds: [9001] }));
	const ownership = overrides.ownership === false
		? []
		: [11, 12, 13, 14, 15].map((subjectId, index) => ({ id: index + 1, subjectId, sectionId: 9001, facultyId: teacherBySubject[subjectId], facultySubjectId: index + 1 }));
	// A8 C3: the LIVE 2023-2024 shape is PARTIAL coverage (264 required pairs,
	// 214 owned, 50 missing), not "no Teaching Load at all". `ownership: false`
	// above is the all-or-nothing shape, which additionally trips
	// `TEACHING_LOAD_REVIEW_REQUIRED` — a genuine blocker that has no pair to
	// attribute. The partial shape is what the gap rule must actually handle.
	const partialOwnership = [11, 12, 13, 14, 15]
		.filter((subjectId) => overrides.unownedSubjects?.includes(subjectId) !== true)
		.map((subjectId, index) => ({ id: index + 1, subjectId, sectionId: 9001, facultyId: teacherBySubject[subjectId], facultySubjectId: index + 1 }));
	const effectiveOwnership = overrides.unownedSubjects ? partialOwnership : ownership;

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
		// A8 C3 F1: a NON-advisory HARD validator code, reachable ONLY through the
		// policy. `maxTeachingMinutesPerDay: 30` makes the real `constraint-validator`
		// emit `FACULTY_DAILY_MAX_EXCEEDED` for a teacher who is inside their WEEKLY
		// cap but over their DAILY one — so the fixture is fully staffed, inside the
		// workload policy, and still hard-blocked. This is the case the previous
		// negative controls missed: they raised a PREFLIGHT blocker row instead, so
		// `blockerCount` saved them and the gate's hard term was never exercised.
		...(overrides.tightDailyCap ? { maxTeachingMinutesPerDay: 30 } : {}),
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
		subjectSectionOwnership: { count: async () => effectiveOwnership.length, findMany: async () => effectiveOwnership },
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
		// TEACHER-AVAILABILITY-AUTHORITY-C01: generation reads the reviewed
		// term-scoped availability authority.
		// A8 UNBLOCK: a full-week UNAVAILABLE for the MATH owner forces every MATH
		// session into a bare slot collision (the live 55-row shape).
		facultyAvailability: {
			findMany: async () => (overrides.slotCollision
				? [{
					facultyId: teacherBySubject[11],
					slots: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].map((day) => ({
						day, startTime: '00:00', endTime: '23:59', state: 'UNAVAILABLE',
					})),
				}]
				: []),
		},
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
	//
	// A8 C3: this line's INVARIANT is superseded and retained as the record. The
	// base expression was `blockers.length === 0 && hardCount === 0`, and it was
	// TRUE only because this fixture is fully staffed (no gaps) and clean. The
	// candidate gate is `blockerCount === 0 && blockingHardCount === 0` with the
	// scheduler-ran and zero-write terms, so a raw row count is no longer a gate
	// — 620 teacher-coverage rows on live 2023-2024 must not stop a run. The
	// replacement invariant is asserted immediately below, and it is STRICTLY
	// stronger: it also pins the gap split and the hard = gaps + blocking sum.
	assert.equal(readiness.generateAllowed, readiness.blockers.length === 0 && readiness.violations.hardCount === 0);
	assert.equal(
		readiness.generateAllowed,
		readiness.blockerCount === 0 && readiness.schedulerExecuted && readiness.violations.blockingHardCount === 0 && readiness.databaseSignature.zeroWrite,
		'the canonical gate is the blocking count, a scheduler that ran, no blocking hard violation, and a zero-write proof',
	);
	assert.equal(
		readiness.blockerCount + readiness.gapCount,
		readiness.blockers.length,
		'every blocker row is either a gap or a blocker, and none is lost',
	);

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

// ─── A8 C3: generate WITH teacher gaps, and group blockers by ROOT CAUSE ──────
//
// Live S.Y. 2023-2024 (`docs/prompts/a8-c3-generate-with-gaps-2026-09-29.md`):
// 620 of the operator's 651 rows were ONE fact at two grains — 50 classes with
// no Teaching Load owner, reported once per pair and once per session of it.
// The operator read that as 651 identical problems and could not start.
//
// These rows drive the REAL `buildGenerationReadiness` over the SAME mock client
// the accepted suite already uses, so the only thing that changes between the
// base result and the candidate result is the rule under test.

test('A8C3.1 a year whose only gap is teacher coverage is GENERATE-ALLOWED, and reports the gap in classes', async () => {
	// `distinctTeachers` is the accepted clean fixture (C03R3a reports READY);
	// leaving three of the five pairs unowned is the live 2023-2024 condition
	// (264 required / 214 owned / 50 missing) and changes nothing else.
	const { client, writes } = buildMockClient({ distinctTeachers: true, unownedSubjects: [12, 14, 15] });
	const readiness = await buildGenerationReadiness(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });

	assert.ok(readiness.teachingLoadCoverage.missingPairs > 0, 'the fixture must really be partially unstaffed');
	assert.ok(readiness.teachingLoadCoverage.ownedPairs > 0, 'and it must still own some pairs, or it is a different condition');
	const coverageRows = readiness.blockers.filter((entry) => entry.code === 'TL_DEMAND_UNCOVERED' || entry.code === 'TL_NO_QUALIFIED_OWNER');
	assert.ok(coverageRows.length > 0, 'the coverage rows must really be reported');

	// A teacher gap is a GAP, not a blocker: generation proceeds and the run will
	// name the classes. The diagnostic still reports every row, truthfully.
	assert.equal(readiness.gapCount, coverageRows.length, 'every coverage row is counted as a gap');
	assert.ok(readiness.gapCount >= readiness.gapClassCount, 'a row count is never smaller than the class count it folds');
	assert.equal(readiness.gapClassCount, readiness.teachingLoadCoverage.missingPairs, 'the class count equals the uncovered pairs, not the session rows');
	assert.equal(readiness.blockerCount, readiness.blockers.length - readiness.gapCount, 'the blocking count excludes exactly the gaps');
	assert.equal(readiness.blockerCount, 0, 'no coverage row blocks generation');
	assert.equal(readiness.violations.blockingHardCount, 0, 'a gap never lowers the real hard-violation count');
	assert.equal(readiness.violations.hardCount, readiness.violations.hardGapCount + readiness.violations.blockingHardCount, 'hard = gaps + blocking, always');
	assert.equal(readiness.status, 'READY');
	assert.equal(readiness.generateAllowed, true, 'a teacher gap must not stop ATLAS from making a schedule');
	assert.deepEqual(writes, [], 'the diagnostic stays zero-write with gaps present');
	assert.equal(readiness.databaseSignature.zeroWrite, true);
});

test('A8C3.2 the 620 live rows collapse to ONE line that counts classes, and every row is still accounted for', async () => {
	const { client } = buildMockClient({ distinctTeachers: true, unownedSubjects: [12, 14, 15] });
	const readiness = await buildGenerationReadiness(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });

	const coverage = readiness.groups.find((group) => group.cause === 'TEACHER_COVERAGE_GAP');
	assert.ok(coverage, 'the teacher-coverage root cause must be its own group');
	assert.equal(coverage.unit, 'classes');
	assert.equal(coverage.count, readiness.teachingLoadCoverage.missingPairs, 'the headline count is CLASSES');
	// The raw row count is still on the group, and the group is still the only
	// headline. (This mock's constructor places an unowned pair rather than
	// emitting a session-level row, so `sessionCount === count` here; the
	// 570-rows-into-50-classes fold is proven in `a8-c3-generate-with-gaps.test.ts`
	// against the real classifier.)
	assert.ok(coverage.sessionCount >= coverage.count, 'the raw row count is carried on the group, never substituted for the class count');
	assert.ok(coverage.examples.length <= 5, 'examples are capped');
	assert.equal(coverage.action.target, '/teaching-load');

	// Nothing is silently dropped: the groups partition the blocker rows exactly.
	const folded = readiness.groups.reduce((total, group) => total + group.sessionCount, 0);
	assert.equal(folded, readiness.blockers.length, 'every blocker row belongs to exactly one group');

	// Deterministic: a second identical call produces byte-identical groups.
	const { client: again } = buildMockClient({ distinctTeachers: true, unownedSubjects: [12, 14, 15] });
	const repeat = await buildGenerationReadiness(SCHOOL_ID, SCHOOL_YEAR_ID, { client: again, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	assert.deepEqual(repeat.groups, readiness.groups, 'the grouped diagnostic is reproducible');
	assert.deepEqual(repeat.gaps, readiness.gaps);
});

test('A8C3.3 NEGATIVE CONTROL: a gap never lets a run through a real blocker or a dry run that did not happen', async () => {
	// (a) a real blocker with no link to any unowned pair still blocks. `C9`
	// pushes MATH above the canonical CLASS capacity: a POLICY_BLOCKER whose
	// pair IS owned, so the gap rule cannot reach it.
	const { client } = buildMockClient({ distinctTeachers: true, unownedSubjects: [12, 14, 15], hugeMathMinutes: true });
	const blocked = await buildGenerationReadiness(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	assert.ok(blocked.gapCount > 0, 'the coverage gaps are present in this fixture too');
	assert.ok(blocked.blockers.some((entry) => entry.code === 'CANONICAL_SHAPE_CAPACITY_EXCEEDED'), 'the fixture really carries a real blocker');
	assert.ok(blocked.blockerCount > 0, 'and it is a BLOCKING one, not a gap');
	assert.equal(blocked.generateAllowed, false, 'a gap must not substitute for a real blocker');
	assert.equal(blocked.status, 'BLOCKED');

	// (b) no ordered term authority -> the scheduler never ran, and a gap is no help.
	const { client: noTerms } = buildMockClient({ distinctTeachers: true, unownedSubjects: [12, 14, 15], noTermCache: true });
	const unverified = await buildGenerationReadiness(SCHOOL_ID, SCHOOL_YEAR_ID, { client: noTerms, termContract: undefined, enforceShiftWindows: false });
	assert.equal(unverified.schedulerExecuted, false, 'the dry run did not run');
	assert.equal(unverified.generateAllowed, false, 'a gap never substitutes for the dry run');
});

test('A8C3.4 the generation gate is derived from the BLOCKING count, not from the raw row count', async () => {
	// The BASE expression was `blockers.length === 0`. The candidate must be the
	// blocking count, and a gap must be visible as a gap rather than as a count.
	const { client } = buildMockClient({ distinctTeachers: true, unownedSubjects: [12, 14, 15] });
	const readiness = await buildGenerationReadiness(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	assert.ok(readiness.gapCount > 0, 'the fixture must really carry gaps');
	assert.notEqual(readiness.blockerCount, readiness.blockers.length, 'the raw row count and the blocking count differ when gaps exist');
	assert.equal(readiness.gaps.every((gap) => gap.code === 'TL_DEMAND_UNCOVERED' || gap.code === 'TL_NO_QUALIFIED_OWNER' || gap.code === 'WORKLOAD_POLICY_BLOCK' || gap.code === 'FACULTY_SUBJECT_NOT_QUALIFIED' || gap.code === 'FACULTY_OVERLOAD'), true,
		'a gap is only ever a coverage row or a provably attributable consequence of one');
});

test('A8C3.5 the ADVISORY path (ruling): a year whose only findings are unattributable workload advisories is GENERATE-ALLOWED, and each one is still recorded, grouped and named', async () => {
	// A fully staffed, otherwise clean year where the real `constraint-validator`
	// emits HARD `FACULTY_OVERLOAD` against teachers whose own weekly contract is
	// 1 hour. That is the live "4 teachers are over 30 hours" shape, and it is the
	// case the planner ruled ADVISORY for generation — but never for publication.
	const { client, writes } = buildMockClient({ distinctTeachers: true, lowWeeklyCap: true });
	const readiness = await buildGenerationReadiness(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });

	// The finding is REAL and is reported as such. Nothing is softened away.
	assert.ok(readiness.violations.hardCount > 0, 'the fixture must really carry hard violations');
	assert.ok((readiness.violations.hardCodes.FACULTY_OVERLOAD ?? 0) > 0, 'and they must be the real FACULTY_OVERLOAD code');
	assert.equal(readiness.violations.advisoryHardCount, readiness.violations.hardCount, 'every hard violation here is advisory-class');
	assert.equal(readiness.violations.hardGapCount, 0, 'and none of them is attributable to an uncovered pair');
	assert.equal(readiness.violations.blockingHardCount, 0, 'so none of them blocks the gate');
	assert.equal(
		readiness.violations.hardCount,
		readiness.violations.hardGapCount + readiness.violations.advisoryHardCount + readiness.violations.blockingHardCount,
		'hard = gaps + advisories + blocking, always',
	);

	// RECORDED, not dropped: the rows are in the payload, in their own class, and
	// in their own grouped line with a real repair. With a 1-hour contract the
	// scheduler also refuses sessions outright, so BOTH advisory causes appear.
	assert.ok(readiness.advisoryCount > 0, 'the advisories are still counted');
	const advisoryCodes = new Set(readiness.advisories.map((row) => row.code));
	assert.deepEqual([...advisoryCodes].sort(), ['FACULTY_OVERLOAD', 'WORKLOAD_POLICY_BLOCK'], 'an advisory is only ever an advisory-class code');
	assert.equal(readiness.blockerCount, 0, 'no advisory is a blocking blocker');
	const overloadGroup = readiness.groups.find((group) => group.cause === 'FACULTY_OVERLOAD');
	assert.ok(overloadGroup, 'the overload cause is still a line of its own');
	assert.equal(overloadGroup.count, readiness.violations.hardCodes.FACULTY_OVERLOAD, 'its line counts the distinct teachers it names, not one sentence');
	assert.equal(overloadGroup.unit, 'items', 'a teacher finding has no class, so it is counted as an item');
	assert.equal(overloadGroup.action.target, '/teaching-load');
	assert.equal(overloadGroup.action.label, 'Review their load');
	// Every advisory row is still visible in some group: nothing is dropped to
	// relax the gate.
	assert.equal(
		readiness.groups.filter((group) => group.codes.some((code) => ADVISORY_CODES_FOR_TEST.has(code)))
			.reduce((total, group) => total + group.sessionCount, 0),
		readiness.advisoryCount,
		'the advisory rows are fully accounted for in their groups',
	);

	// The gate: advisories do not stop a reviewable schedule.
	assert.equal(readiness.schedulerExecuted, true);
	assert.equal(readiness.databaseSignature.zeroWrite, true);
	assert.equal(readiness.status, 'READY');
	assert.equal(readiness.generateAllowed, true, 'an advisory must not stop ATLAS from making a schedule to review');
	assert.deepEqual(writes, [], 'the diagnostic stays zero-write with advisories present');
});

// ─── A8 C3 CORRECTION ROUND 1, F1: the gate's HARD term must be a real term ───
//
// THE DEFECT THIS ROW EXISTS FOR. The candidate computed the attribution test
// (`code is advisory-class && pair is uncovered`) and then DISCARDED its result,
// so `hardGapCount` actually meant "every hard violation that is not
// advisory-class". The consequence was that `blockingHardCount =
// hardCount - hardGapCount - advisoryHardCount` was identically 0 for EVERY
// input, and `generateAllowed` reduced to `blockerCount === 0 && schedulerRan
// && zeroWrite`. It only ever held because the mirror loop independently pushes
// a blocker row for each HARD validator violation.
//
// WHY THE COMMITTED TESTS MISSED IT, stated plainly: both real-path negative
// controls (A8C3.3a, A8C3.6a) used `hugeMathMinutes`, which raises a PREFLIGHT
// blocker row (`CANONICAL_SHAPE_CAPACITY_EXCEEDED`). `blockerCount` therefore
// blocked them and the hard term was never reached. And the pure-helper row
// ("ONE real hard violation alongside advisories still blocks") hand-fed
// `deriveGenerateDecision` an input shape the production call site could never
// produce — a helper-only proof is not a real-path proof.
//
// THIS ROW IS THE REAL-PATH PROOF. It drives a NON-advisory HARD validator code
// (`FACULTY_DAILY_MAX_EXCEEDED`, raised by the real `constraint-validator`
// through the policy alone), on a year that is fully staffed and inside the
// workload policy, and asserts that `blockingHardCount` is non-zero AND that
// generation is refused BY THAT TERM — with no accompanying preflight blocker
// row of that code to save it.

test('A8C3.7 F1 real-path proof: a NON-advisory HARD violation blocks by the hard term alone, with no preflight blocker row of that code', async () => {
	const { client } = buildMockClient({ distinctTeachers: true, tightDailyCap: true });
	const readiness = await buildGenerationReadiness(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });

	// The finding is REAL, and it is the real production code path: the generic
	// hard validator raised it, through the policy, with a fully staffed year.
	assert.ok(readiness.violations.hardCount > 0, 'the fixture must really carry a hard violation');
	assert.ok(
		(readiness.violations.hardCodes.FACULTY_DAILY_MAX_EXCEEDED ?? 0) > 0,
		`the hard violation must be FACULTY_DAILY_MAX_EXCEEDED, saw ${JSON.stringify(readiness.violations.hardCodes)}`,
	);
	assert.equal(
		ADVISORY_CODES_FOR_TEST.has('FACULTY_DAILY_MAX_EXCEEDED'), false,
		'and it must be a code the ruling did NOT make advisory — otherwise this row proves nothing',
	);

	// A daily cap of 30 minutes is also tighter than the scheduler can satisfy, so
	// the constructor refuses some sessions outright. Those become
	// `WORKLOAD_POLICY_BLOCK` rows, which the ruling classifies as ADVISORY. That
	// is recorded rather than assumed, because it is exactly the population that
	// must NOT be what blocks this fixture.
	assert.ok(readiness.advisoryCount > 0, 'the tight daily cap does produce advisory-class refusals');
	assert.equal(
		readiness.advisories.every((row) => ADVISORY_CODES_FOR_TEST.has(row.code)), true,
		'and every one of them is advisory-class, so none of them blocks',
	);
	assert.equal(readiness.gapCount, 0, 'the fixture must carry no teacher gap');

	// THE ASSERTION F1 IS ABOUT: `blockingHardCount` is a REAL quantity now.
	assert.ok(
		readiness.violations.blockingHardCount > 0,
		`blockingHardCount must be non-zero for a real hard violation, got ${readiness.violations.blockingHardCount}`,
	);
	assert.equal(
		readiness.violations.blockingHardCount,
		readiness.violations.hardCount - readiness.violations.hardGapCount - readiness.violations.advisoryHardCount,
		'the three counts must partition hardCount',
	);
	assert.equal(readiness.violations.hardGapCount, 0, 'nothing here is attributable to an uncovered pair, so hardGapCount is 0');
	assert.equal(readiness.violations.advisoryHardCount, 0, 'and nothing here is advisory-class, so advisoryHardCount is 0');

	// And the gate is refused.
	assert.equal(readiness.schedulerExecuted, true, 'the dry run ran, so this is not a missing-dry-run refusal');
	assert.equal(readiness.databaseSignature.zeroWrite, true, 'and the diagnostic was zero-write, so this is not a zero-write refusal');
	assert.equal(readiness.status, 'BLOCKED');
	assert.equal(readiness.generateAllowed, false, 'a non-advisory HARD violation must block generation on its own');

	// ── WHY THE PREVIOUS PROOFS MISSED IT, AND WHY THIS ONE CANNOT ──
	// The readiness service mirrors every HARD validator violation into a blocker
	// row, so on this fixture `blockerCount` also happens to be positive. The
	// HIGH review named that redundancy as the reason the old controls were
	// vacuous, so this row proves the hard term is load-bearing ON ITS OWN by
	// re-running the REAL decision function with the reported numbers and with
	// every blocker row stripped out. If the hard term were vacuous — as it was
	// before this correction — this would return TRUE and the row would go red.
	const blockingRowsExcludingHardMirrors = readiness.blockers.filter((row) => row.code !== 'FACULTY_DAILY_MAX_EXCEEDED').length;
	const isolated = deriveGenerateDecision({
		blockingBlockerCount: blockingRowsExcludingHardMirrors,
		schedulerRan: readiness.schedulerExecuted,
		hardCount: readiness.violations.hardCount,
		hardGapCount: readiness.violations.hardGapCount,
		advisoryHardCount: readiness.violations.advisoryHardCount,
		zeroWrite: readiness.databaseSignature.zeroWrite,
	});
	assert.equal(
		isolated.generateAllowed, false,
		'with every blocker row removed, the hard term alone must still refuse: this is the term F1 found vacuous',
	);
	assert.ok(isolated.blockingHardCount > 0, 'and it must do so with a non-zero blocking hard count');
});

test('A8C3.8 F1: hardGapCount counts ONLY attributable violations, and the advisory class is its complement', async () => {
	// A fully staffed year with a real teacher over their WEEKLY cap: the code IS
	// advisory-class but carries no pair to attribute, so it must be counted as
	// an ADVISORY and `hardGapCount` must stay 0. This is the second half of F1:
	// a `hardGapCount` that claimed 3 here would be the false operator-facing
	// claim the HIGH review named.
	const { client } = buildMockClient({ distinctTeachers: true, lowWeeklyCap: true });
	const readiness = await buildGenerationReadiness(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	assert.ok(readiness.violations.hardCount > 0, 'the fixture must really carry a hard violation');
	assert.ok((readiness.violations.hardCodes.FACULTY_OVERLOAD ?? 0) > 0, 'and it must be FACULTY_OVERLOAD');
	assert.equal(
		readiness.violations.hardGapCount, 0,
		'an unattributable advisory-class violation is NOT a gap: hardGapCount must not claim it',
	);
	assert.equal(
		readiness.violations.advisoryHardCount, readiness.violations.hardCount,
		'every hard violation here is advisory-class, and none is attributable',
	);
	assert.equal(readiness.violations.blockingHardCount, 0);
	assert.equal(readiness.generateAllowed, true, 'the advisory path is unchanged by the F1 correction');
});

test('A8C3.6 NEGATIVE CONTROL for the ruling: advisories do NOT relax anything else', async () => {
	// (a) a real non-advisory blocker alongside advisories still blocks.
	const { client } = buildMockClient({ distinctTeachers: true, lowWeeklyCap: true, hugeMathMinutes: true });
	const blocked = await buildGenerationReadiness(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	assert.ok(blocked.violations.advisoryHardCount > 0, 'the advisories are present in this fixture too');
	assert.ok(blocked.blockerCount > 0, 'and a real blocker is present as well');
	assert.equal(blocked.generateAllowed, false, 'an advisory never substitutes for a real blocker');
	assert.equal(blocked.status, 'BLOCKED');

	// (b) teacher gaps AND advisories together: still allowed, both reported.
	const { client: both } = buildMockClient({ distinctTeachers: true, lowWeeklyCap: true, unownedSubjects: [12, 14, 15] });
	const combined = await buildGenerationReadiness(SCHOOL_ID, SCHOOL_YEAR_ID, { client: both, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	assert.ok(combined.gapCount > 0 && combined.advisoryCount > 0, 'both populations are reported');
	assert.equal(combined.blockerCount, 0);
	assert.equal(combined.generateAllowed, true, 'gaps plus advisories still allow a reviewable run');
	// The published run summary would still refuse publication: the advisories are
	// promotable codes, and the unplaced classes are unassigned sessions.
	assert.ok(combined.groups.some((group) => group.cause === 'TEACHER_COVERAGE_GAP'), 'the coverage line is present');
	assert.ok(combined.groups.some((group) => group.cause === 'FACULTY_OVERLOAD'), 'the advisory line is present');

	// (c) no ordered term authority -> the dry run never happened; advisories and
	// gaps together are no help.
	const { client: noTerms } = buildMockClient({ distinctTeachers: true, lowWeeklyCap: true, unownedSubjects: [12, 14, 15], noTermCache: true });
	const unverified = await buildGenerationReadiness(SCHOOL_ID, SCHOOL_YEAR_ID, { client: noTerms, termContract: undefined, enforceShiftWindows: false });
	assert.equal(unverified.schedulerExecuted, false, 'the dry run did not run');
	assert.equal(unverified.generateAllowed, false, 'a gap or an advisory never substitutes for the dry run');
});

/* ------------------------------------------------------------------ *
 * 6. A8 UNBLOCK — the WORKLOAD_POLICY_BLOCK reason is TRUE end to end
 *
 * Live S.Y. 2025-2026 evidence: the dry run produced ZERO hard over-cap
 * violations (30 h standard / 40 h cap) and 55 `WORKLOAD_POLICY_BLOCK` rows,
 * yet the panel said "55 classes have a teacher at their limit". Those rows
 * were bare slot collisions — the owner had no free period. This row proves
 * the reason the REAL `buildGenerationReadiness` payload carries is the
 * truthful one, and that it names the resolved owner. No gate moves.
 * ------------------------------------------------------------------ */

test('A8UNBLOCK.2 a slot-collision refusal reaches readiness with a truthful WORKLOAD_POLICY_BLOCK reason (never "limit")', async () => {
	const { client, writes } = buildMockClient({ distinctTeachers: true, slotCollision: true });
	const readiness = await buildGenerationReadiness(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	assert.equal(readiness.schedulerExecuted, true, 'the dry run must have run');
	assert.deepEqual(writes, [], 'the diagnostic stays zero-write');

	const workloadRows = readiness.blockers.filter((row) => row.code === 'WORKLOAD_POLICY_BLOCK');
	assert.ok(workloadRows.length > 0, 'the blocked owner must produce a workload/policy row');
	assert.ok(
		workloadRows.every((row) => !/limit/i.test(row.reason)),
		`no row may assert a cap breach the dry run did not show; saw ${JSON.stringify(workloadRows.map((row) => row.reason))}`,
	);
	assert.ok(
		workloadRows.some((row) => /no free period/i.test(row.reason)),
		'the slot-collision reason states the real cause',
	);
	assert.ok(
		workloadRows.some((row) => /owner A Math/.test(row.entity)),
		'the resolved class owner is named in the entity',
	);
	// The blocker CODE is unchanged: the gate reads the same code it always did.
	assert.equal(readiness.blockers.some((row) => row.code === 'WORKLOAD_POLICY_BLOCK'), true);
});
