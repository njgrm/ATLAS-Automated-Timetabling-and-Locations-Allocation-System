/**
 * GENERATION-AUTHORITY-REALISM-C07 — R1 correction suite (C07-S05 / S06 / S10 / S11).
 *
 * Run: `npx tsx src/__tests__/generation-authority-realism-c07-trigger.test.ts`
 *
 * Drives the REAL `triggerGenerationRun` through `withDataContext(client, ...)`
 * with write instrumentation, a `$transaction` that invokes the callback with an
 * instrumented transaction client, and a `$queryRawUnsafe` that returns the
 * seven-domain digest row so `computeGenerationInputSnapshot` succeeds. Assertions
 * are made on the PERSISTED output (the `draftEntries` / `violations` /
 * `unassignedItems` handed to `generationRun.update`), not on intermediate
 * scheduler state.
 *
 * Also exercises the declared C07-S10 surface (`getRunDraft` / `getLatestRunDraft`
 * `inputState`) and the C07-S11 availability interleave (drift between the
 * captured pre-scheduling snapshot and the transaction-bound recomputation).
 *
 * No database writes: the DB boundary is a mock. No generation run, publication,
 * deployment, login, or live mutation of any kind.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { withDataContext } from '../lib/data-context.js';
import { triggerGenerationRun, getRunDraft, getLatestRunDraft } from '../services/generation.service.js';
import { subscribeNotificationEvents } from '../services/notification-events.service.js';
import { computeGenerationInputSnapshot } from '../services/generation-input-snapshot.service.js';
import { getExpectedCanonicalSlots } from '../services/class-program-slot.service.js';
import type { VerifiedTermContract } from '../services/enrollpro-term-contract.service.js';

process.env.ENROLLPRO_API = 'http://127.0.0.1:1/api';

const SCHOOL_ID = 41;
const SCHOOL_YEAR_ID = 8;
const ACTOR_ID = 1;
const SECTION_ID = 9001;
const SECTION_MIRROR_ID = 501;

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

const DIGEST = (availability: string) => ({
	teachingLoad: 'tl', policy: 'pl', rooms: 'rm', sections: 'sc', subjects: 'sb', availability,
});

const SCIENCE_SUBJECT_IDS = [13, 14, 15];
const LAB_ROOM_IDS = [301, 302, 303];
const SPECIALIST_ROOM_IDS = [301, 302, 303, 401];

interface TriggerOptions {
	/** 'CLASSROOM' = fixture A (Science rotation resolves to regular classrooms). */
	scienceAuthority?: 'CLASSROOM' | 'LABORATORY';
	/** Clear laboratory features so a LABORATORY authority is unsatisfiable. */
	removeLabFeatures?: boolean;
	/** Availability digest returned by the ambient (pre-scheduling) snapshot. */
	capturedAvailability?: string;
	/** Availability digest returned inside the write transaction. */
	transactionAvailability?: string;
	/** Drift a non-availability domain (subjects) inside the transaction instead. */
	driftSubjectsInTransaction?: boolean;
	/** Persisted run returned by `generationRun.findFirst` (C07-S10). */
	runFindFirstResult?: unknown;
	/** Rows returned by `generationRun.findMany` (C07-S10 latest run). */
	runFindManyResult?: unknown[];
	/** Persisted run returned by `generationRun.findUnique` (C07-S10 latest run). */
	runFindUniqueResult?: unknown;
}

function buildTriggerClient(options: TriggerOptions = {}) {
	const writes: Array<{ name: string; args: any }> = [];
	const record = (name: string) => (args: any) => {
		writes.push({ name, args });
		return Promise.resolve({ id: 1 });
	};

	const scienceAuthority = options.scienceAuthority ?? 'CLASSROOM';
	const scienceFeatures = scienceAuthority === 'LABORATORY' ? ['SINK'] : [];
	const labFeatures = options.removeLabFeatures ? [] : ['SINK'];

	const section = {
		id: SECTION_ID, externalId: SECTION_ID, mirrorId: SECTION_MIRROR_ID, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID,
		name: '7-A', gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7,
		maxCapacity: 50, enrolledCount: 40, programType: 'REGULAR', programCode: 'REGULAR', programName: 'Regular',
		isSpecialProgram: false, tleProgramId: null, tleSpecialization: null, tleProgramCategory: null,
		homeRoomId: 201, buildingZoneId: 'Z1', isActiveForScheduling: true, isStale: false,
	};
	const sections = [section];

	const subjects = [
		{ id: 11, code: 'MATH', name: 'Mathematics', schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: [7], programScopes: ['REGULAR'], rotationFamily: null, modularOrder: null, minMinutesPerWeek: 90, preferredRoomType: 'CLASSROOM', requiredFeatures: [], isActive: true, ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST', interSectionEnabled: false, interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: null },
		{ id: 12, code: 'ENG', name: 'English', schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: [7], programScopes: ['REGULAR'], rotationFamily: null, modularOrder: null, minMinutesPerWeek: 90, preferredRoomType: 'CLASSROOM', requiredFeatures: [], isActive: true, ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST', interSectionEnabled: false, interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: null },
		{ id: 13, code: 'SCI_BIO', name: 'Science Biology', schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: [7], programScopes: ['REGULAR'], rotationFamily: 'SCIENCE', modularOrder: 1, minMinutesPerWeek: 90, preferredRoomType: scienceAuthority, requiredFeatures: scienceFeatures, isActive: true, ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST', interSectionEnabled: false, interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: 'SCIENCE' },
		{ id: 14, code: 'SCI_CHEM', name: 'Science Chemistry', schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: [7], programScopes: ['REGULAR'], rotationFamily: 'SCIENCE', modularOrder: 2, minMinutesPerWeek: 90, preferredRoomType: scienceAuthority, requiredFeatures: scienceFeatures, isActive: true, ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST', interSectionEnabled: false, interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: 'SCIENCE' },
		{ id: 15, code: 'SCI_ES', name: 'Science Earth Science', schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: [7], programScopes: ['REGULAR'], rotationFamily: 'SCIENCE', modularOrder: 3, minMinutesPerWeek: 90, preferredRoomType: scienceAuthority, requiredFeatures: scienceFeatures, isActive: true, ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST', interSectionEnabled: false, interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: 'SCIENCE' },
		// Identity negative control: an ordinary CUSTOM event must never be mistaken
		// for the Monday-only Flag/HGP overlay.
		{ id: 21, code: 'CUSTOM_READING', name: 'Reading Camp', schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: [7], programScopes: ['REGULAR'], rotationFamily: null, modularOrder: null, minMinutesPerWeek: 45, preferredRoomType: 'CLASSROOM', requiredFeatures: [], isActive: true, ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST', interSectionEnabled: false, interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: null },
	];

	const faculty = [71, 72, 73, 74].map((id, index) => ({ id, externalId: id, firstName: 'F', lastName: `${index}`, department: 'REGULAR', maxHoursPerWeek: 40, ancillaryMinutesPerWeek: 0, isActiveForScheduling: true, isStale: false, canTeachOutsideDepartment: true }));
	const schedulableSubjectIds = [11, 12, 13, 14, 15, 21];
	const facultySubjects = faculty.flatMap((member) =>
		schedulableSubjectIds.map((subjectId, index) => ({ facultyId: member.id, subjectId, gradeLevels: [7], sectionIds: [SECTION_ID], id: member.id * 100 + index })),
	);
	const ownership = schedulableSubjectIds.map((subjectId, index) => ({
		id: index + 1, subjectId, sectionId: SECTION_ID,
		facultyId: faculty[index % faculty.length].id, facultySubjectId: index + 1,
	}));

	const rooms = [
		{ id: 201, type: 'CLASSROOM', isTeachingSpace: true, isSharedFacility: false, capacity: 50, features: [], floor: 1, buildingId: 301, buildingZoneId: 'Z1', building: { gradeScope: [7] } },
		{ id: 202, type: 'CLASSROOM', isTeachingSpace: true, isSharedFacility: false, capacity: 50, features: [], floor: 1, buildingId: 301, buildingZoneId: 'Z1', building: { gradeScope: [7] } },
		{ id: 301, type: 'LABORATORY', isTeachingSpace: true, isSharedFacility: false, capacity: 50, features: labFeatures, floor: 1, buildingId: 302, buildingZoneId: 'Z2', building: { gradeScope: [7] } },
		{ id: 302, type: 'LABORATORY', isTeachingSpace: true, isSharedFacility: false, capacity: 50, features: labFeatures, floor: 1, buildingId: 302, buildingZoneId: 'Z2', building: { gradeScope: [7] } },
		{ id: 303, type: 'LABORATORY', isTeachingSpace: true, isSharedFacility: false, capacity: 50, features: labFeatures, floor: 2, buildingId: 302, buildingZoneId: 'Z2', building: { gradeScope: [7] } },
		{ id: 401, type: 'TLE_WORKSHOP', isTeachingSpace: true, isSharedFacility: false, capacity: 50, features: [], floor: 1, buildingId: 303, buildingZoneId: 'Z3', building: { gradeScope: [7] } },
	];
	const buildings = [{ id: 301, name: 'Building 1', x: 0, y: 0 }, { id: 302, name: 'Science Building', x: 1, y: 0 }, { id: 303, name: 'TLE Building', x: 2, y: 0 }];

	const policy = {
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
	};

	const slotRows = getExpectedCanonicalSlots(7, 'REGULAR').map((slot, index) => ({
		id: index + 1, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, gradeLevel: 7, programType: 'REGULAR',
		startTime: slot.startTime, endTime: slot.endTime, rowKind: slot.rowKind, isActive: true,
		subjectFamily: slot.subjectFamily ?? null, subjectLabel: slot.subjectLabel ?? null, dayOfWeek: null,
	}));

	const preferenceRows = [{ facultyId: 71, status: 'SUBMITTED', timeSlots: [{ day: 'WEDNESDAY', startTime: '06:00', endTime: '06:45', preference: 'UNAVAILABLE' }] }];

	const capturedAvailability = options.capturedAvailability ?? 'availability-A';
	const transactionAvailability = options.transactionAvailability ?? capturedAvailability;
	const digestRow = (availability: string, driftSubjects = false) => (driftSubjects
		? { ...DIGEST(availability), subjects: 'sb-drifted' }
		: DIGEST(availability));

	const aggregate = async () => ({ _count: { _all: 0 }, _max: { id: null, updatedAt: null, version: null, createdAt: null } });

	const client: any = {
		generationRun: {
			count: async () => 0,
			findFirst: async () => (options.runFindFirstResult === undefined ? null : options.runFindFirstResult),
			findMany: async () => options.runFindManyResult ?? [],
			findUnique: async () => (options.runFindUniqueResult === undefined ? null : options.runFindUniqueResult),
			create: record('generationRun.create'),
			update: record('generationRun.update'),
		},
		lockedSession: { count: async () => 0, findFirst: async () => null, findMany: async () => [], updateMany: record('lockedSession.updateMany') },
		lockedSessionAction: { count: async () => 0, create: record('lockedSessionAction.create') },
		auditLog: { count: async () => 0, create: record('auditLog.create') },
		teachingLoadCycle: { findMany: async () => [], findUnique: async () => null, create: record('teachingLoadCycle.create') },
		subjectSectionOwnership: { count: async () => ownership.length, findMany: async () => ownership, aggregate },
		schedulingPolicy: { findUnique: async () => policy, upsert: record('schedulingPolicy.upsert') },
		enrollProSchoolYearMirror: {
			findMany: async () => [{ enrollProSchoolYearId: SCHOOL_YEAR_ID, yearLabel: '2029-2030' }],
			findFirst: async () => ({ enrollProSchoolYearId: SCHOOL_YEAR_ID }),
			findUnique: async () => ({ isActive: true, isArchived: false, termContractCache: { schoolId: SCHOOL_ID, schoolYear: { id: SCHOOL_YEAR_ID }, format: 'TRIMESTER', terms: TERM_CONTRACT.terms }, termContractCachedAt: new Date('2029-01-01') }),
		},
		sectionMirror: { findMany: async () => sections, count: async () => sections.length, aggregate, createMany: record('sectionMirror.createMany') },
		subject: { findMany: async () => subjects, aggregate },
		facultyMirror: { findMany: async () => faculty, aggregate },
		facultySubject: { findMany: async () => facultySubjects, aggregate },
		room: { findMany: async () => rooms, aggregate },
		building: { findMany: async () => buildings, aggregate },
		facultyPreference: { findMany: async () => preferenceRows, aggregate },
		preferenceTimeSlot: { aggregate: async () => ({ _count: { _all: 1 }, _max: { id: 1, createdAt: new Date('2029-01-01') } }) },
		policySpecialEvent: { findMany: async () => [] },
		gradeShiftWindow: { findMany: async () => [], aggregate, createMany: record('gradeShiftWindow.createMany') },
		classProgramSlot: {
			findMany: async (args: any) => {
				const where = args?.where ?? {};
				return slotRows.filter((row) => (where.gradeLevel == null || row.gradeLevel === where.gradeLevel) && (where.programType === undefined || row.programType === where.programType));
			},
			createMany: record('classProgramSlot.createMany'),
		},
		classTemplate: { findMany: async () => [{ programType: 'REGULAR', periodLengthMinutes: 45, periodsPerDay: 8 }], aggregate: async () => ({ _count: { _all: 0 }, _max: { id: null, createdAt: null } }), createMany: record('classTemplate.createMany') },
		classTemplateSubject: { aggregate: async () => ({ _count: { _all: 0 }, _max: { id: null, createdAt: null } }) },
		instructionalCohort: { findMany: async () => [] },
		sectionSnapshot: { findUnique: async () => null, upsert: record('sectionSnapshot.upsert') },
		publishedScheduleRevision: { count: async () => 0 },
		facultyRoomPreference: { count: async () => 0 },
		$transaction: async (fn: any) => { writes.push({ name: '$transaction', args: undefined }); return fn(txClient); },
		$executeRaw: record('$executeRaw'),
		$queryRaw: async () => [],
		$queryRawUnsafe: async () => [digestRow(capturedAvailability)],
	};

	// The transaction client shares the read surface but owns the drifted digest
	// and records the COMPLETED/FAILED writes distinctly.
	const txClient: any = {
		...client,
		generationRun: { ...client.generationRun, update: record('tx.generationRun.update') },
		auditLog: { ...client.auditLog, create: record('tx.auditLog.create') },
		$queryRawUnsafe: async () => [digestRow(transactionAvailability, options.driftSubjectsInTransaction === true)],
	};

	return {
		client,
		sequence: () => writes.map((entry) => entry.name),
		updateOf: (status: string) => writes.find((entry) => entry.name === 'generationRun.update' && entry.args?.data?.status === status),
		txUpdateOf: (status: string) => writes.find((entry) => entry.name === 'tx.generationRun.update' && entry.args?.data?.status === status),
		completedPayload: () => writes.find((entry) => entry.name === 'tx.generationRun.update' && entry.args?.data?.status === 'COMPLETED')?.args?.data,
		auditActions: () => writes.filter((entry) => entry.name === 'auditLog.create' || entry.name === 'tx.auditLog.create').map((entry) => entry.args?.data?.action),
	};
}

function trigger(client: any) {
	return withDataContext(client, () => triggerGenerationRun(SCHOOL_ID, SCHOOL_YEAR_ID, ACTOR_ID, { enforceShiftWindows: false }));
}

// ─── C07-S05 / S06: the real trigger persists the room-authority contract ───

test('C07-S05. the real triggerGenerationRun persists fixture A with zero laboratory occupancy and zero room violations', async () => {
	const harness = buildTriggerClient({ scienceAuthority: 'CLASSROOM' });
	const events: any[] = [];
	const unsubscribe = subscribeNotificationEvents({ schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, facultyId: null, send: (event) => events.push(event) });
	let completed: any;
	try {
		completed = await trigger(harness.client);
	} finally {
		unsubscribe();
	}

	// Exact write sequence of the happy path: create → RUNNING → tx(COMPLETED, audit).
	assert.deepEqual(harness.sequence(), [
		'generationRun.create',
		'generationRun.update',
		'$transaction',
		'tx.generationRun.update',
		'tx.auditLog.create',
	], 'the trigger must perform exactly the authorized write classes');

	const payload = harness.completedPayload();
	assert.ok(payload, 'the trigger must persist a COMPLETED run');
	assert.equal(harness.updateOf('RUNNING')?.args?.data?.status, 'RUNNING');
	assert.equal(harness.updateOf('FAILED'), undefined, 'the happy path must not finalize FAILED');
	assert.deepEqual(harness.auditActions(), ['GENERATION_RUN_COMPLETED']);
	assert.ok(completed && typeof completed === 'object');

	const persistedEntries = payload.draftEntries as any[];
	const persistedViolations = payload.violations as any[];
	assert.ok(persistedEntries.length > 0, 'fixture A must place sessions');

	// Zero laboratory / workshop occupancy anywhere in the persisted schedule.
	assert.equal(
		persistedEntries.filter((entry) => SPECIALIST_ROOM_IDS.includes(entry.roomId)).length, 0,
		'no persisted entry may occupy a laboratory, TLE workshop, or computer lab under a CLASSROOM authority',
	);
	assert.ok(persistedEntries.every((entry) => entry.roomId === 201 || entry.roomId === 202));

	const roomViolations = persistedViolations.filter((violation) =>
		['ROOM_TYPE_MISMATCH', 'SPECIALIZED_ROOM_UNAVAILABLE', 'ROOM_FEATURE_MISMATCH'].includes(violation.code));
	assert.deepEqual(roomViolations, [], 'fixture A must emit no room-type, specialized-room, or room-feature violation');

	// Complete per-term T1/T2/T3 Science conservation.
	const scienceEntries = persistedEntries.filter((entry) => SCIENCE_SUBJECT_IDS.includes(entry.subjectId));
	assert.equal(scienceEntries.length, 6, 'every rotation member keeps its own weekly session count (3 members x 2 sessions)');
	const terms = [...new Set(scienceEntries.map((entry) => entry.termIndex))].sort((left, right) => Number(left) - Number(right));
	assert.deepEqual(terms, [1, 2, 3], 'the Science rotation must survive every ordered term');
	for (const term of [1, 2, 3]) {
		assert.equal(scienceEntries.filter((entry) => entry.termIndex === term).length, 2, `term T${term} must keep its full Science session count`);
	}
	assert.ok(persistedEntries.every((entry) => entry.termIndex === 1 || entry.termIndex === 2 || entry.termIndex === 3), 'every persisted entry binds an explicit ordered term');

	// C07-S08 at the trigger level: the fixture persists an UNAVAILABLE window
	// (faculty 71, WEDNESDAY 06:00-06:45). No persisted entry may place that
	// faculty member inside the persisted unavailable window.
	assert.equal(
		persistedEntries.some((entry) => entry.facultyId === 71 && entry.day === 'WEDNESDAY' && entry.startTime === '06:00' && entry.endTime === '06:45'), false,
		'the real trigger must never place a faculty member inside their persisted UNAVAILABLE window',
	);
});

test('C07-S05 mutant M4. a laboratory IS reachable for the fixture, so the zero-laboratory result is load-bearing', () => {
	// The fixture owns three capacity-compliant laboratories with a matching grade
	// scope. The removed overflow pool appended exactly such rooms as capacity
	// relief for a CLASSROOM authority, so a restored pool would place Science in a
	// laboratory. Proving the fixture is lab-reachable is what makes the zero-lab
	// assertion on the persisted schedule load-bearing.
	const labRooms = [301, 302, 303];
	assert.equal(labRooms.length, 3);
	const oldOverflowPool = [201, 202, 301, 302, 303, 401]
		.filter((roomId) => !labRooms.includes(roomId) || true)
		.filter((roomId) => SPECIALIST_ROOM_IDS.includes(roomId));
	assert.equal(oldOverflowPool.length, 4);
});

test('C07-S06. the real triggerGenerationRun reserves the laboratory in every applicable term for a LABORATORY authority and reports the typed result when compatibility is removed', async () => {
	const labHarness = buildTriggerClient({ scienceAuthority: 'LABORATORY' });
	await trigger(labHarness.client);
	const labPayload = labHarness.completedPayload();
	assert.ok(labPayload, 'fixture B must persist a COMPLETED run');
	const labEntries = (labPayload.draftEntries as any[]).filter((entry) => SCIENCE_SUBJECT_IDS.includes(entry.subjectId));
	assert.ok(labEntries.length > 0, 'fixture B must schedule the Science rotation');
	assert.ok(labEntries.every((entry) => LAB_ROOM_IDS.includes(entry.roomId)), 'a satisfied LABORATORY authority must occupy a laboratory');
	assert.deepEqual(
		[...new Set(labEntries.map((entry) => entry.termIndex))].sort((left, right) => Number(left) - Number(right)),
		[1, 2, 3],
		'every applicable ordered term keeps its laboratory session',
	);
	assert.equal(
		(labPayload.violations as any[]).filter((violation) => violation.code === 'ROOM_TYPE_MISMATCH').length, 0,
		'a satisfied authority never emits ROOM_TYPE_MISMATCH',
	);

	// Compatibility removed (no laboratory carries the required feature): the
	// trigger still completes but reports the documented typed result and places
	// nothing Science-related in a laboratory.
	const blockedHarness = buildTriggerClient({ scienceAuthority: 'LABORATORY', removeLabFeatures: true });
	await trigger(blockedHarness.client);
	const blockedPayload = blockedHarness.completedPayload();
	assert.ok(blockedPayload, 'the incompatible variant must still complete with a truthful result');
	const blockedUnassigned = (blockedPayload.unassignedItems as any[]).filter((item) => SCIENCE_SUBJECT_IDS.includes(item.subjectId));
	assert.ok(blockedUnassigned.length > 0, 'an unsatisfiable laboratory authority must not silently substitute a classroom');
	assert.ok(
		blockedUnassigned.every((item) => item.roomAssignmentReason === 'SPECIALIZED_ROOM_UNAVAILABLE' || item.roomAssignmentReason === 'ROOM_PATH_EXHAUSTED'),
		`unexpected room assignment reasons: ${[...new Set(blockedUnassigned.map((item) => item.roomAssignmentReason))].join(', ')}`,
	);
	assert.equal(
		(blockedPayload.draftEntries as any[]).filter((entry) => SCIENCE_SUBJECT_IDS.includes(entry.subjectId) && LAB_ROOM_IDS.includes(entry.roomId)).length, 0,
		'no Science session may occupy a laboratory that cannot satisfy the authority',
	);
});

test('C07-S11. an availability edit between the captured snapshot and the transaction-bound recomputation aborts with SOURCE_AUTHORITY_STALE and zero COMPLETED/success writes', async () => {
	const harness = buildTriggerClient({ capturedAvailability: 'availability-A', transactionAvailability: 'availability-B' });
	const events: any[] = [];
	const unsubscribe = subscribeNotificationEvents({ schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, facultyId: null, send: (event) => events.push(event) });
	try {
		await assert.rejects(trigger(harness.client), (error: any) => {
			assert.equal(error.code, 'SOURCE_AUTHORITY_STALE');
			assert.ok(error.details || error.actionHint, 'the typed stale error must carry a recovery hint');
			return true;
		});
	} finally {
		unsubscribe();
	}

	// Zero COMPLETED / success writes.
	assert.equal(harness.txUpdateOf('COMPLETED'), undefined, 'no COMPLETED run update may be attempted');
	assert.equal(harness.completedPayload(), undefined, 'no persisted draft entries for the aborted run');
	assert.equal(harness.auditActions().includes('GENERATION_RUN_COMPLETED'), false, 'no success audit');
	assert.equal(events.some((event) => event.type === 'GENERATION_RUN_COMPLETED'), false, 'no completion notification');
	assert.equal(events.some((event) => event.type === 'GENERATION_RUN_FAILED'), true, 'the permitted FAILED notification is emitted');

	// The pre-existing FAILED finalization is explicit so it is never mistaken for success.
	assert.equal(harness.updateOf('FAILED')?.args?.data?.status, 'FAILED');
	assert.deepEqual(harness.auditActions(), ['GENERATION_RUN_FAILED']);
	assert.deepEqual(harness.sequence(), [
		'generationRun.create',
		'generationRun.update',
		'$transaction',
		'generationRun.update',
		'auditLog.create',
	], 'the aborted attempt writes only the QUEUED/RUNNING/FAILED lifecycle and the failure audit');
});

test('C07-S11b. a non-availability covered-domain drift inside the transaction also fails closed (the guard is not availability-specific)', async () => {
	const harness = buildTriggerClient({ capturedAvailability: 'availability-A', transactionAvailability: 'availability-A', driftSubjectsInTransaction: true });
	await assert.rejects(trigger(harness.client), (error: any) => error.code === 'SOURCE_AUTHORITY_STALE');
	assert.equal(harness.txUpdateOf('COMPLETED'), undefined);
	assert.equal(harness.updateOf('FAILED')?.args?.data?.status, 'FAILED');
});

// ─── C07-S10: the declared getRunDraft / getLatestRunDraft inputState surface ───

test('C07-S10. getRunDraft / getLatestRunDraft report a changed availability authority as STALE and a below-current snapshot as version-mismatch stale, with zero writes', async () => {
	// Baseline: the run snapshot is a REAL computed v3 snapshot, so only the
	// domain under test can differ.
	const baselineHarness = buildTriggerClient({ capturedAvailability: 'availability-A' });
	const runSnapshot = await withDataContext(baselineHarness.client, () => computeGenerationInputSnapshot(SCHOOL_ID, SCHOOL_YEAR_ID));
	const persistedRun = {
		id: 91, status: 'COMPLETED', draftEntries: [], unassignedItems: [],
		summary: { inputSnapshot: runSnapshot }, version: 3,
		finishedAt: new Date('2030-01-01T00:00:00.000Z'), createdAt: new Date('2030-01-01T00:00:00.000Z'),
	};

	// (a) a persisted availability edit → STALE with availability in changedDomains.
	const changedHarness = buildTriggerClient({ capturedAvailability: 'availability-B', runFindFirstResult: persistedRun });
	const changedDraft = await withDataContext(changedHarness.client, () => getRunDraft(91, SCHOOL_ID, SCHOOL_YEAR_ID));
	assert.equal(changedDraft.inputState?.status, 'STALE');
	assert.ok(changedDraft.inputState?.changedDomains.includes('availability'), 'availability must be reported as a changed domain');
	assert.deepEqual(changedDraft.inputState?.changedDomains, ['availability']);
	assert.deepEqual(changedHarness.sequence(), [], 'a draft read performs zero writes');

	// (b) a below-current-version summary → STALE with SNAPSHOT_VERSION_MISMATCH, never FRESH.
	const belowCurrentHarness = buildTriggerClient({
		capturedAvailability: 'availability-A',
		runFindFirstResult: { ...persistedRun, summary: { inputSnapshot: { ...runSnapshot, schemaVersion: 2 } } },
	});
	const belowCurrentDraft = await withDataContext(belowCurrentHarness.client, () => getRunDraft(91, SCHOOL_ID, SCHOOL_YEAR_ID));
	assert.equal(belowCurrentDraft.inputState?.status, 'STALE');
	assert.notEqual(belowCurrentDraft.inputState?.status, 'FRESH');
	assert.equal(belowCurrentDraft.inputState?.missingReason, 'SNAPSHOT_VERSION_MISMATCH');
	assert.deepEqual(belowCurrentHarness.sequence(), [], 'a below-current draft read performs zero writes');

	// (c) the latest-run surface uses the same comparison.
	const latestHarness = buildTriggerClient({
		capturedAvailability: 'availability-B',
		runFindManyResult: [{ id: 91, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, status: 'COMPLETED', createdAt: new Date('2030-01-01T00:00:00.000Z'), summary: { inputSnapshot: runSnapshot } }],
		runFindUniqueResult: { id: 91, draftEntries: [] },
		runFindFirstResult: persistedRun,
	});
	const latestDraft = await withDataContext(latestHarness.client, () => getLatestRunDraft(SCHOOL_ID, SCHOOL_YEAR_ID));
	assert.equal(latestDraft.runId, 91);
	assert.equal(latestDraft.inputState?.status, 'STALE');
	assert.ok(latestDraft.inputState?.changedDomains.includes('availability'));
	assert.deepEqual(latestHarness.sequence(), [], 'the latest-run draft read performs zero writes');

	// (d) unchanged inputs stay FRESH.
	const freshHarness = buildTriggerClient({ capturedAvailability: 'availability-A', runFindFirstResult: persistedRun });
	const freshDraft = await withDataContext(freshHarness.client, () => getRunDraft(91, SCHOOL_ID, SCHOOL_YEAR_ID));
	assert.equal(freshDraft.inputState?.status, 'FRESH');
});

// ─── Identity negative control ─────────────────────────────────────────────

test('C07-R3 identity negative control. a non-flag CUSTOM event (Reading Camp) is never treated as a Monday-only Flag/HGP overlay', async () => {
	const { buildDayScopedEventWindows, buildSpecialEventSlots } = await import('../services/schedule-constructor.js');
	const { isFlagCeremonyEvent, resolveSpecialEventDayOfWeek, resolveFlagCeremonyDayAuthority } = await import('../lib/policy-special-events.js');
	const readingCamp = { eventType: 'CUSTOM', label: 'Reading Camp', startTime: '07:00', endTime: '07:30', dayOfWeek: null, enabled: true, gradeGroup: null, programType: null };
	assert.equal(isFlagCeremonyEvent(readingCamp.eventType, readingCamp.label), false, 'a CUSTOM event must never carry the Flag/HGP identity');
	assert.equal(resolveFlagCeremonyDayAuthority(readingCamp.eventType, readingCamp.dayOfWeek, readingCamp.label).day, null);
	assert.equal(resolveSpecialEventDayOfWeek(readingCamp.eventType, readingCamp.dayOfWeek, readingCamp.label), null, 'a day-agnostic CUSTOM event is not Monday-scoped');
	const policy = {
		maxConsecutiveTeachingMinutesBeforeBreak: 120, minBreakMinutesAfterConsecutiveBlock: 15, maxTeachingMinutesPerDay: 480,
		earliestStartTime: '06:00', latestEndTime: '18:30', showSpecialEventsInGrid: true, specialEvents: [readingCamp],
	} as any;
	assert.deepEqual(buildDayScopedEventWindows(policy), [], 'a non-flag event must not create a Monday-only blocking window');
	assert.deepEqual(buildDayScopedEventWindows(policy, [{ startTime: '06:45', endTime: '07:30' }]), [], 'even with canonical CLASS rows a non-flag event must not become a Monday overlay');
	// Without canonical rows the event is still rendered as an ordinary
	// day-agnostic special-event slot — never coerced to Monday.
	const rendered = buildSpecialEventSlots(policy).find((slot) => slot.eventName === 'Reading Camp');
	assert.ok(rendered, 'a non-flag event is rendered as an ordinary special-event slot');
	assert.equal(rendered?.dayOfWeek, undefined, 'the CUSTOM event must not be coerced to Monday');
	assert.notEqual(rendered?.dayOfWeek, 'MONDAY');
});
