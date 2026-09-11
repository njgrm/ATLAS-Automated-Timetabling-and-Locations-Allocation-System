/**
 * GEN-C02R1 Finding F1 — real trigger preflight/assembly parity and zero-write.
 *
 * Run: `npx tsx src/__tests__/generation-production-trigger-genc02r1.test.ts`
 *
 * Invokes the REAL `triggerGenerationRun()` entry point with write-attempt
 * instrumentation against the production data-context path. Proves:
 *  1. missing setup / blocked authority produce typed preflight blockers and
 *     zero run/audit/notification/draft/lock/policy/window/template/slot/
 *     section/ownership/cycle writes;
 *  2. the trigger's typed blockers and bound preflight equal the shared
 *     readiness/preflight assembly;
 *  3. a mutation between preflight and the first write is rejected stale with
 *     zero writes;
 *  4. the old create-run-first ordering would be detected by the control.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { withDataContext } from '../lib/data-context.js';
import { triggerGenerationRun } from '../services/generation.service.js';
import { buildGenerationReadiness } from '../services/generation-readiness.service.js';
import {
	buildGenerationPreflight,
	summarizePreflightParity,
	type GenerationPreflightResult,
} from '../services/generation-preflight.service.js';
import { subscribeNotificationEvents } from '../services/notification-events.service.js';
import { getExpectedCanonicalSlots } from '../services/class-program-slot.service.js';
import type { VerifiedTermContract } from '../services/enrollpro-term-contract.service.js';

process.env.ENROLLPRO_API = 'http://127.0.0.1:1/api';

const SCHOOL_ID = 41;
const SCHOOL_YEAR_ID = 8;
const ACTOR_ID = 1;

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

interface TriggerMockOptions {
	missingPolicy?: boolean;
	noOwnership?: boolean;
	/** When set, the Nth `subjectSectionOwnership.findMany` call returns this set. */
	ownershipOnCall?: { call: number; rows: any[] };
}

function buildTriggerClient(options: TriggerMockOptions = {}) {
	const writes: string[] = [];
	const recordWrite = (name: string) => (..._args: unknown[]) => { writes.push(name); return Promise.resolve({ id: 1 }); };

	const sectionMirrors = [{
		id: 501, externalId: 9001, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, name: '7-A', gradeLevelId: 17, gradeLevelName: 'Grade 7',
		displayOrder: 7, maxCapacity: 50, enrolledCount: 40, programType: 'REGULAR', programCode: 'REGULAR', programName: 'Regular',
		isSpecialProgram: false, tleProgramId: null, tleSpecialization: null, tleProgramCategory: null, homeRoomId: null, buildingZoneId: null,
		isActiveForScheduling: true, isStale: false,
	}];

	const subjects = [
		{ id: 11, code: 'MATH', name: 'Mathematics', schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: [7], programScopes: ['REGULAR'], rotationFamily: null, modularOrder: null, minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM', requiredFeatures: [], isActive: true, ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST', interSectionEnabled: false, interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: null },
		{ id: 12, code: 'ENG', name: 'English', schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: [7], programScopes: ['REGULAR'], rotationFamily: null, modularOrder: null, minMinutesPerWeek: 180, preferredRoomType: 'CLASSROOM', requiredFeatures: [], isActive: true, ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST', interSectionEnabled: false, interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: null },
	];

	const faculty = [{ id: 71, department: 'REGULAR', maxHoursPerWeek: 30, ancillaryMinutesPerWeek: 0, isActiveForScheduling: true, isStale: false }];
	const facultySubjects = [
		{ facultyId: 71, subjectId: 11, gradeLevels: [7], sectionIds: [9001] },
		{ facultyId: 71, subjectId: 12, gradeLevels: [7], sectionIds: [9001] },
	];
	const baseOwnership = options.noOwnership
		? []
		: [
			{ id: 1, subjectId: 11, sectionId: 9001, facultyId: 71, facultySubjectId: 1 },
			{ id: 2, subjectId: 12, sectionId: 9001, facultyId: 71, facultySubjectId: 2 },
		];
	let ownershipCalls = 0;

	const policy = {
		id: 1, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, periodLengthMinutes: 45, periodsPerDay: 8,
		maxConsecutiveTeachingMinutesBeforeBreak: 120, minBreakMinutesAfterConsecutiveBlock: 15, maxTeachingMinutesPerDay: 480,
		earliestStartTime: '06:00', latestEndTime: '18:30', enforceConsecutiveBreakAsHard: false,
		enableTravelWellbeingChecks: false, maxWalkingDistanceMetersPerTransition: 120, maxBuildingTransitionsPerDay: 4,
		maxBackToBackTransitionsWithoutBuffer: 2, maxIdleGapMinutesPerDay: 60, avoidEarlyFirstPeriod: false, avoidLateLastPeriod: false,
		enableVacantAwareConstraints: false, targetFacultyDailyVacantMinutes: 60, targetSectionDailyVacantPeriods: 1,
		maxCompressedTeachingMinutesPerDay: 300, lunchStartTime: '12:15', lunchEndTime: '13:00', enforceLunchWindow: false,
		showSpecialEventsInGrid: false, enableFlagCeremony: false, flagCeremonyStartTime: '07:00', flagCeremonyEndTime: '07:30',
		enableRecess: false, recessStartTime: '09:00', recessEndTime: '09:15', enableLunchWindow: false,
		enableTleTwoPassPriority: true, allowFlexibleSubjectAssignment: false, allowConsecutiveLabSessions: false, constraintConfig: null,
	};

	const slotRows = getExpectedCanonicalSlots(7, 'REGULAR').map((slot, index) => ({
		id: index + 1, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, gradeLevel: 7, programType: 'REGULAR',
		startTime: slot.startTime, endTime: slot.endTime, rowKind: slot.rowKind, isActive: true,
		subjectFamily: slot.subjectFamily ?? null, subjectLabel: slot.subjectLabel ?? null, dayOfWeek: null,
	}));

	const client: any = {
		generationRun: { count: async () => 0, findFirst: async () => null, findMany: async () => [], create: recordWrite('generationRun.create'), update: recordWrite('generationRun.update') },
		lockedSession: { count: async () => 0, findFirst: async () => null, findMany: async () => [], updateMany: recordWrite('lockedSession.updateMany') },
		lockedSessionAction: { count: async () => 0, create: recordWrite('lockedSessionAction.create') },
		auditLog: { count: async () => 0, create: recordWrite('auditLog.create') },
		teachingLoadCycle: { findMany: async () => [], create: recordWrite('teachingLoadCycle.create') },
		subjectSectionOwnership: {
			count: async () => (ownershipCalls > 0 ? baseOwnership.length : baseOwnership.length),
			findMany: async () => {
				ownershipCalls += 1;
				if (options.ownershipOnCall && ownershipCalls === options.ownershipOnCall.call) return options.ownershipOnCall.rows;
				return baseOwnership;
			},
		},
		schedulingPolicy: { findUnique: async () => (options.missingPolicy ? null : policy), upsert: recordWrite('schedulingPolicy.upsert') },
		enrollProSchoolYearMirror: {
			findMany: async () => [{ enrollProSchoolYearId: SCHOOL_YEAR_ID, yearLabel: '2029-2030' }],
			findFirst: async () => ({ enrollProSchoolYearId: SCHOOL_YEAR_ID }),
			findUnique: async () => ({ isActive: true, isArchived: false, termContractCache: { schoolId: SCHOOL_ID, schoolYear: { id: SCHOOL_YEAR_ID }, format: 'TRIMESTER', terms: TERM_CONTRACT.terms }, termContractCachedAt: new Date('2029-01-01') }),
		},
		sectionMirror: { findMany: async () => sectionMirrors, count: async () => sectionMirrors.length, createMany: recordWrite('sectionMirror.createMany') },
		subject: { findMany: async () => subjects },
		facultyMirror: { findMany: async () => faculty },
		facultySubject: { findMany: async () => facultySubjects },
		room: { findMany: async () => [{ id: 201, type: 'CLASSROOM', isTeachingSpace: true, isSharedFacility: false, capacity: 50, features: [], buildingId: 301, buildingZoneId: 'Z1', building: { gradeScope: [7] } }] },
		building: { findMany: async () => [{ id: 301, name: 'Building 1', x: 0, y: 0 }] },
		facultyPreference: { findMany: async () => [] },
		policySpecialEvent: { findMany: async () => [] },
		gradeShiftWindow: { findMany: async () => [], createMany: recordWrite('gradeShiftWindow.createMany') },
		classProgramSlot: {
			findMany: async (args: any) => {
				const where = args?.where ?? {};
				return slotRows.filter((row) => (where.gradeLevel == null || row.gradeLevel === where.gradeLevel) && (where.programType === undefined || row.programType === where.programType));
			},
			createMany: recordWrite('classProgramSlot.createMany'),
		},
		classTemplate: { findMany: async () => [{ programType: 'REGULAR', periodLengthMinutes: 45, periodsPerDay: 8 }], createMany: recordWrite('classTemplate.createMany') },
		instructionalCohort: { findMany: async () => [] },
		sectionSnapshot: { findUnique: async () => null, upsert: recordWrite('sectionSnapshot.upsert') },
		publishedScheduleRevision: { count: async () => 0 },
		facultyRoomPreference: { count: async () => 0 },
		$transaction: recordWrite('$transaction'), $executeRaw: recordWrite('$executeRaw'),
		$queryRaw: async () => [], $queryRawUnsafe: async () => [],
	};
	return { client, writes: writes as string[], getOwnershipCalls: () => ownershipCalls, baseOwnership };
}

function trigger(client: any) {
	return withDataContext(client, () => triggerGenerationRun(SCHOOL_ID, SCHOOL_YEAR_ID, ACTOR_ID, { enforceShiftWindows: false }));
}

test('F1a. the trigger rejects missing policy with the same typed blockers as the shared preflight and zero writes', async () => {
	const { client, writes } = buildTriggerClient({ missingPolicy: true });
	const direct: GenerationPreflightResult = await buildGenerationPreflight(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	assert.equal(direct.ok, false);
	assert.ok(direct.blockers.some((blocker) => blocker.code === 'POLICY_UNINITIALIZED'));

	const events: unknown[] = [];
	const unsubscribe = subscribeNotificationEvents({ schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, facultyId: null, send: (event) => events.push(event) });
	try {
		await assert.rejects(trigger(client), (error: any) => {
			assert.equal(error.code, 'GENERATION_PREFLIGHT_BLOCKED');
			assert.deepEqual(error.details.blockers, direct.blockers, 'trigger blockers must equal the shared preflight blockers');
			return true;
		});
	} finally {
		unsubscribe();
	}
	assert.deepEqual(writes, [], 'a blocked preflight must perform zero writes');
	assert.deepEqual(events, [], 'a blocked preflight must emit no notification');
});

test('F1a. the trigger rejects missing Teaching Load ownership with typed blockers and zero writes', async () => {
	const { client, writes } = buildTriggerClient({ noOwnership: true });
	const direct = await buildGenerationPreflight(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	assert.equal(direct.ok, false);
	assert.ok(direct.blockers.some((blocker) => blocker.code === 'TEACHING_LOAD_REVIEW_REQUIRED'));
	assert.ok(direct.blockers.some((blocker) => blocker.code === 'TL_DEMAND_UNCOVERED'));

	await assert.rejects(trigger(client), (error: any) => {
		assert.equal(error.code, 'GENERATION_PREFLIGHT_BLOCKED');
		assert.deepEqual(error.details.blockers, direct.blockers);
		return true;
	});
	assert.deepEqual(writes, [], 'missing setup must perform zero writes');
});

test('F1b. readiness and trigger preflight expose equal revisions, terms, demand, owners, shapes, and validator policy', async () => {
	const { client } = buildTriggerClient();
	const preflight = await buildGenerationPreflight(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	assert.equal(preflight.ok, true, `expected a ready preflight: ${preflight.blockers.map((blocker) => blocker.code).join(', ')}`);
	const readiness = await buildGenerationReadiness(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	assert.equal(readiness.schedulerExecuted, true);
	assert.deepEqual(readiness.preflight, summarizePreflightParity(preflight.assembly), 'readiness preflight summary must equal the shared preflight assembly');

	// The trigger consumes the exact same function.
	const source = readFileSync(fileURLToPath(new URL('../services/generation.service.ts', import.meta.url)), 'utf8');
	const spanStart = source.indexOf('export async function triggerGenerationRun(');
	const spanEnd = source.indexOf('\nexport async function ', spanStart + 1);
	const triggerSpan = source.slice(spanStart, spanEnd < 0 ? undefined : spanEnd);
	assert.match(triggerSpan, /buildGenerationPreflight\(/, 'the trigger must call the shared preflight');
});

test('F1c. a mutation between the preflight and the first write is rejected stale with zero writes', async () => {
	// On the second ownership read (the trigger's revalidation) the canonical
	// owner changes, so the bound teaching-load/source revisions drift.
	const { client, writes, getOwnershipCalls } = buildTriggerClient({
		ownershipOnCall: { call: 2, rows: [{ id: 1, subjectId: 11, sectionId: 9001, facultyId: 72, facultySubjectId: 1 }, { id: 2, subjectId: 12, sectionId: 9001, facultyId: 71, facultySubjectId: 2 }] },
	});
	await assert.rejects(trigger(client), (error: any) => {
		assert.equal(error.code, 'GENERATION_PREFLIGHT_STALE');
		assert.ok(Array.isArray(error.details.changedRevisions) && error.details.changedRevisions.length > 0);
		return true;
	});
	assert.equal(getOwnershipCalls() >= 2, true, 'the trigger must re-read ownership during revalidation');
	assert.deepEqual(writes, [], 'a stale preflight must perform zero writes');
});

test('F1d. the old create-run-first ordering would be detected by the control', () => {
	const source = readFileSync(fileURLToPath(new URL('../services/generation.service.ts', import.meta.url)), 'utf8');
	const spanStart = source.indexOf('export async function triggerGenerationRun(');
	const spanEnd = source.indexOf('\nexport async function ', spanStart + 1);
	const triggerSpan = source.slice(spanStart, spanEnd < 0 ? undefined : spanEnd);
	const preflightIndex = triggerSpan.indexOf('buildGenerationPreflight(');
	const revalidateIndex = triggerSpan.indexOf('revalidateGenerationPreflight(');
	const createIndex = triggerSpan.indexOf('generationRun.create(');
	assert.ok(preflightIndex >= 0 && revalidateIndex >= 0 && createIndex >= 0);
	assert.ok(preflightIndex < createIndex, 'the preflight must precede the first run write');
	assert.ok(revalidateIndex < createIndex, 'the freshness revalidation must precede the first run write');
	// No setup-healing writer survives on the generation path.
	for (const retired of ['syncSectionsFromExternal(', 'ensureDefaultTemplates(', 'ensureTemplatesForProgramTypes(', 'ensurePhase3GradeWindows(', 'getOrCreatePolicy(', 'ensureCanonicalClassProgramSlots(']) {
		assert.equal(triggerSpan.includes(retired), false, `${retired} must not remain in the trigger`);
	}

	// Positive control: the write recorder detects a write when one occurs.
	const { client, writes } = buildTriggerClient();
	return (client.generationRun.create({}) as Promise<unknown>).then(() => {
		assert.deepEqual(writes, ['generationRun.create'], 'the write recorder must detect writes');
	});
});
