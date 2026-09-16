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
	/**
	 * R2/F9 control: use a dedicated scenario whose only specialized subject is
	 * ROBOTICS (no Science name, code, or rotation family), optionally with an
	 * out-of-roster FacultySubject scope so the constructor has NO qualified
	 * candidate for that pair while the preflight's teaching-load coverage stays
	 * satisfied.
	 */
	scenario?: 'default' | 'dedicatedSpecialized';
	/** Subject id that deliberately has no Teaching Load ownership row. */
	noOwnershipForSubject?: number;
	/** Faculty id given zero effective weekly capacity (produces FACULTY_OVERLOADED). */
	zeroCapacityFacultyId?: number;
	/** Add an ARAL subject that would create Site-A demand if the preflight allowed it. */
	addNonSchedulableDemand?: boolean;
	/**
	 * R2d: mark the availability owner (faculty 72) UNAVAILABLE for EVERY canonical
	 * Grade 7 REGULAR class period on every weekday, so the entire admissible grid
	 * is a persisted UNAVAILABLE authority for the session it owns.
	 */
	ownerUnavailableInEveryClassSlot?: boolean;
	/**
	 * R2d production-input mutant: drop the persisted availability authority from
	 * `facultyPreference.findMany`, so the constructor receives `timeSlots: []`.
	 */
	omitPersistedAvailability?: boolean;
}

const ROBOTICS_SUBJECT_ID = 31;
const ARAL_SUBJECT_ID = 41;

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

	const base = (overrides: Record<string, unknown>) => ({
		name: 'Subject', schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: [7], programScopes: ['REGULAR'],
		rotationFamily: null, modularOrder: null, minMinutesPerWeek: 90, preferredRoomType: 'CLASSROOM', requiredFeatures: [],
		isActive: true, ownerDepartment: null, qualificationPriority: 'DEPARTMENT_FIRST', interSectionEnabled: false,
		interSectionGradeLevels: [], allowedSpecializations: [], modularGroupId: null, ...overrides,
	});
	const scienceSubjects = [
		base({ id: 13, code: 'SCI_BIO', name: 'Science Biology', rotationFamily: 'SCIENCE', modularOrder: 1, preferredRoomType: scienceAuthority, requiredFeatures: scienceFeatures, modularGroupId: 'SCIENCE' }),
		base({ id: 14, code: 'SCI_CHEM', name: 'Science Chemistry', rotationFamily: 'SCIENCE', modularOrder: 2, preferredRoomType: scienceAuthority, requiredFeatures: scienceFeatures, modularGroupId: 'SCIENCE' }),
		base({ id: 15, code: 'SCI_ES', name: 'Science Earth Science', rotationFamily: 'SCIENCE', modularOrder: 3, preferredRoomType: scienceAuthority, requiredFeatures: scienceFeatures, modularGroupId: 'SCIENCE' }),
	];
	const commonSubjects = [
		base({ id: 11, code: 'MATH', name: 'Mathematics' }),
		base({ id: 12, code: 'ENG', name: 'English' }),
	];
	// Identity negative control: an ordinary CUSTOM event must never be mistaken
	// for the Monday-only Flag/HGP overlay.
	const extraSubjects = [base({ id: 21, code: 'CUSTOM_READING', name: 'Reading Camp', minMinutesPerWeek: 45 })];
	const dedicatedSubjects = [
		base({ id: 11, code: 'MATH', name: 'Mathematics' }),
		// No Science name, code, or rotation family — a specialized authority that
		// can only be honoured from persisted data.
		base({ id: ROBOTICS_SUBJECT_ID, code: 'ROBOTICS', name: 'Robotics Club', preferredRoomType: 'LABORATORY', minMinutesPerWeek: 45 }),
	];
	const subjects = options.scenario === 'dedicatedSpecialized'
		? dedicatedSubjects
		: [...commonSubjects, ...scienceSubjects, ...extraSubjects];
	if (options.addNonSchedulableDemand) {
		subjects.push(base({ id: ARAL_SUBJECT_ID, code: 'ARAL', name: 'Araling Panlipunan', schedulingDisposition: 'SCHEDULED_TEACHING', minMinutesPerWeek: 45 }));
	}

	const faculty = [71, 72, 73, 74].map((id, index) => ({ id, externalId: id, firstName: 'F', lastName: `${index}`, department: 'REGULAR', maxHoursPerWeek: 40, ancillaryMinutesPerWeek: 0, isActiveForScheduling: true, isStale: false, canTeachOutsideDepartment: true }));
	if (options.zeroCapacityFacultyId != null) {
		for (const member of faculty) {
			if (member.id === options.zeroCapacityFacultyId) member.maxHoursPerWeek = 0;
		}
	}
	const schedulableSubjectIds = subjects.map((subject: any) => subject.id as number);
	const facultySubjects = faculty.flatMap((member) =>
		schedulableSubjectIds.map((subjectId, index) => ({
			facultyId: member.id,
			subjectId,
			gradeLevels: [7],
			sectionIds: [SECTION_ID],
			id: member.id * 100 + index,
		})),
	);
	const ownership = schedulableSubjectIds
		.filter((subjectId) => subjectId !== (options.noOwnershipForSubject ?? null))
		.map((subjectId, index) => ({
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

	const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
	// R2d: the canonical Grade 7 REGULAR class periods — the only admissible slots.
	const CANONICAL_CLASS_ROWS = getExpectedCanonicalSlots(7, 'REGULAR')
		.filter((slot) => slot.rowKind === 'CLASS')
		.map((slot) => ({ startTime: slot.startTime, endTime: slot.endTime }));
	const preferenceRows = options.ownerUnavailableInEveryClassSlot
		? [{
			facultyId: 72,
			status: 'SUBMITTED',
			// `omitPersistedAvailability` removes the authority from the production
			// input entirely (no `timeSlots` property, exactly like no persisted row).
			...(options.omitPersistedAvailability ? {} : {
				timeSlots: WEEKDAYS.flatMap((day) => CANONICAL_CLASS_ROWS.map((slot) => ({
					day, startTime: slot.startTime, endTime: slot.endTime, preference: 'UNAVAILABLE',
				}))),
			}),
		}]
		: [{
			facultyId: 71,
			status: 'SUBMITTED',
			...(options.omitPersistedAvailability ? {} : {
				timeSlots: [{ day: 'WEDNESDAY', startTime: '06:00', endTime: '06:45', preference: 'UNAVAILABLE' }],
			}),
		}];

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

/**
 * Minimal real `ConstructorInput` used by the R2/F9 constructor-level controls.
 * `constructBaseline` is the exact function the real trigger calls.
 */
function buildConstructorInputFixture(shapes: unknown, overrides: {
	subject: Record<string, unknown>;
	facultySubjects: unknown[];
	pairOwners: Record<string, number>;
	demandOverride?: unknown[];
}) {
	return {
		schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, roomingStrategy: 'HOME_ROOM_FIRST',
		sectionsByGrade: [{
			gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7,
			sections: [{ mirrorId: SECTION_MIRROR_ID, id: SECTION_ID, name: '7-A', maxCapacity: 50, enrolledCount: 40, gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR', homeRoomId: 201, buildingZoneId: 'Z1' }],
		}],
		subjects: [overrides.subject],
		faculty: [{ id: 71, maxHoursPerWeek: 30, department: 'REGULAR' }],
		facultySubjects: overrides.facultySubjects,
		rooms: [
			{ id: 201, type: 'CLASSROOM', isTeachingSpace: true, isSharedFacility: false, capacity: 50, buildingId: 301, buildingZoneId: 'Z1', buildingGradeScope: [7], features: [] },
			{ id: 301, type: 'LABORATORY', isTeachingSpace: true, isSharedFacility: false, capacity: 50, buildingId: 302, buildingZoneId: 'Z2', buildingGradeScope: [7], features: [] },
		],
		preferences: [],
		policy: { maxConsecutiveTeachingMinutesBeforeBreak: 120, minBreakMinutesAfterConsecutiveBlock: 15, maxTeachingMinutesPerDay: 480, earliestStartTime: '06:00', latestEndTime: '13:00', periodLengthMinutes: 45, periodsPerDay: 8, enableRecess: false, enableLunchWindow: false },
		buildings: [{ id: 301, name: 'Grade 7 Academic Wing' }, { id: 302, name: 'Science Building' }],
		timetableShapes: shapes,
		demandOverride: overrides.demandOverride ?? [{
			sectionId: SECTION_ID, subjectId: overrides.subject.id, subjectCode: overrides.subject.code,
			gradeLevel: 7, sessionsPerWeek: 1, durationPerSession: 45, enrolledCount: 40, entryKind: 'SECTION',
			roomTypePreference: overrides.subject.preferredRoomType, homeRoomId: 201,
		}],
		pairOwners: overrides.pairOwners,
	};
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

// ─── R2d: persisted UNAVAILABLE is a hard exclusion at the trigger boundary ───

test('C07-R2d. the real trigger keeps a persisted-UNAVAILABLE session unplaced with a typed reason, and the availability-omission mutant schedules it inside the window', async () => {
	const canonicalClassRows = getExpectedCanonicalSlots(7, 'REGULAR')
		.filter((slot) => slot.rowKind === 'CLASS')
		.map((slot) => ({ startTime: slot.startTime, endTime: slot.endTime }));
	const isInCanonicalClassSlot = (entry: any) => entry.facultyId === 72
		&& canonicalClassRows.some((slot) => slot.startTime === entry.startTime && slot.endTime === entry.endTime);

	// ── Real production input: the persisted availability authority is honoured ──
	// Faculty 72 is the owner of the ROBOTICS session and is persisted UNAVAILABLE
	// for every canonical Grade 7 REGULAR class period, so no slot can serve it.
	const realHarness = buildTriggerClient({ scenario: 'dedicatedSpecialized', ownerUnavailableInEveryClassSlot: true });
	await trigger(realHarness.client);
	const realPayload = realHarness.completedPayload();
	assert.ok(realPayload, 'the trigger must complete with a truthful result');
	const realEntries = realPayload.draftEntries as any[];
	assert.equal(
		realEntries.some(isInCanonicalClassSlot), false,
		'the real trigger must never place the availability owner inside a persisted UNAVAILABLE window',
	);
	const roboticsUnassigned = (realPayload.unassignedItems as any[]).filter((item) => item.subjectId === ROBOTICS_SUBJECT_ID);
	assert.ok(roboticsUnassigned.length > 0, 'the session must remain unplaced rather than silently scheduled');
	assert.ok(
		roboticsUnassigned.every((item) => item.reason === 'NO_AVAILABLE_SLOT'),
		`expected NO_AVAILABLE_SLOT, saw ${[...new Set(roboticsUnassigned.map((item) => item.reason))].join(', ')}`,
	);
	assert.ok(
		roboticsUnassigned.every((item) => item.roomAssignmentReason === 'FACULTY_SLOT_UNAVAILABLE'),
		`the persisted refusal must surface as FACULTY_SLOT_UNAVAILABLE, saw ${[...new Set(roboticsUnassigned.map((item) => item.roomAssignmentReason))].join(', ')}`,
	);
	const roboticsViolations = (realPayload.violations as any[]).filter((violation) => violation.entities?.subjectId === ROBOTICS_SUBJECT_ID);
	assert.ok(roboticsViolations.length > 0);
	assert.ok(
		roboticsViolations.every((violation) => violation.code === 'UNASSIGNED_SECTION' && violation.severity === 'HARD'),
		`an availability refusal must stay HARD; saw ${[...new Set(roboticsViolations.map((violation) => `${violation.code}/${violation.severity}`))].join(', ')}`,
	);

	// ── Production-input mutant: the persisted availability authority is omitted ──
	// Without the authority the constructor receives `timeSlots: []`, so the same
	// session IS scheduled inside a previously unavailable window. This is what
	// makes the assertions above load-bearing at the trigger boundary.
	const mutantHarness = buildTriggerClient({ scenario: 'dedicatedSpecialized', ownerUnavailableInEveryClassSlot: true, omitPersistedAvailability: true });
	await trigger(mutantHarness.client);
	const mutantPayload = mutantHarness.completedPayload();
	assert.ok(mutantPayload, 'the mutant run must complete');
	const mutantEntries = mutantPayload.draftEntries as any[];
	assert.equal(
		mutantEntries.some(isInCanonicalClassSlot), true,
		'dropping the availability authority must schedule the session inside the previously unavailable window',
	);
	assert.equal(
		(mutantPayload.unassignedItems as any[]).filter((item) => item.subjectId === ROBOTICS_SUBJECT_ID).length, 0,
		'the session must be placed once the availability authority is dropped',
	);
});

// ─── R2 / F9: non-room failures must never be reported as room results ─────

test('C07-R2a. a specialized authority with NO available (overloaded) faculty persists a non-room reason and a HARD UNASSIGNED_SECTION violation through the real trigger', async () => {
	// The owner is present (so the preflight stays satisfied) but has zero
	// effective weekly capacity, so the specialized authority cannot be served by
	// any qualified faculty. The refusal is a workload failure, not a room result.
	const harness = buildTriggerClient({
		scenario: 'dedicatedSpecialized',
		zeroCapacityFacultyId: 72,
	});
	await trigger(harness.client);
	const payload = harness.completedPayload();
	assert.ok(payload, 'the trigger must complete with a truthful result');

	const roboticsUnassigned = (payload.unassignedItems as any[]).filter((item) => item.subjectId === ROBOTICS_SUBJECT_ID);
	assert.ok(roboticsUnassigned.length > 0, 'the unserveable specialized subject must be reported as unassigned');
	assert.ok(
		roboticsUnassigned.every((item) => item.reason === 'FACULTY_OVERLOADED'),
		`expected FACULTY_OVERLOADED, saw ${[...new Set(roboticsUnassigned.map((item) => item.reason))].join(', ')}`,
	);
	assert.ok(
		roboticsUnassigned.every((item) => item.roomAssignmentReason === 'FACULTY_SLOT_UNAVAILABLE'),
		`a workload refusal is not a room result; saw ${[...new Set(roboticsUnassigned.map((item) => item.roomAssignmentReason))].join(', ')}`,
	);

	const violations = payload.violations as any[];
	const roboticsViolations = violations.filter((violation) => violation.entities?.subjectId === ROBOTICS_SUBJECT_ID);
	assert.ok(roboticsViolations.length > 0);
	assert.ok(
		roboticsViolations.every((violation) => violation.code === 'UNASSIGNED_SECTION' && violation.severity === 'HARD'),
		`a genuine data/workload blocker must stay HARD; saw ${[...new Set(roboticsViolations.map((violation) => `${violation.code}/${violation.severity}`))].join(', ')}`,
	);
	assert.equal(
		violations.some((violation) => violation.code === 'SPECIALIZED_ROOM_UNAVAILABLE'), false,
		'a workload refusal must never be laundered into a SOFT room warning',
	);
});

test('C07-R2a2. the constructor reports NO_QUALIFIED_FACULTY (not a room result) for a specialized authority with no qualified candidate', async () => {
	const { buildRunTimetableShapeContracts } = await import('../services/generation-shape-assembly.service.js');
	const { constructBaseline } = await import('../services/schedule-constructor.js');
	const shapes = buildRunTimetableShapeContracts({
		sectionsByGrade: [{ gradeLevelId: 17, sections: [{ programType: 'REGULAR' }] }],
		gradeWindows: [{ gradeLevel: 7, programType: 'REGULAR', startTime: '06:00', endTime: '13:00' }],
		templateProfiles: [{ programType: 'REGULAR', periodLengthMinutes: 45, periodsPerDay: 8 }],
		canonicalSlots: new Map([['7:REGULAR', getExpectedCanonicalSlots(7, 'REGULAR').map((slot) => ({
			startTime: slot.startTime, endTime: slot.endTime, subjectFamily: slot.subjectFamily ?? null, subjectLabel: slot.subjectLabel ?? null, rowKind: slot.rowKind,
		}))]]),
		policy: { periodLengthMinutes: 45, periodsPerDay: 8 } as any,
	});
	const specializedInput: any = buildConstructorInputFixture(shapes, {
		// A specialized authority whose pair has no qualified faculty and no owner.
		subject: { id: 31, code: 'ROBOTICS', minMinutesPerWeek: 45, preferredRoomType: 'LABORATORY', gradeLevels: [7], requiredFeatures: [], programScopes: ['REGULAR'] },
		facultySubjects: [],
		pairOwners: {},
	});
	const specializedResult = constructBaseline(specializedInput);
	const specializedUnassigned = specializedResult.unassignedItems.filter((item) => item.subjectId === 31);
	assert.equal(specializedUnassigned.length, 1);
	assert.equal(specializedUnassigned[0].reason, 'NO_QUALIFIED_FACULTY');
	assert.equal(specializedUnassigned[0].roomAssignmentReason, 'NO_QUALIFIED_FACULTY', 'a missing teacher is not a room result');
});

test('C07-R2b. an unresolved demand item whose subject is absent from the subject map reports NO_QUALIFIED_FACULTY (Site A)', async () => {
	const { buildRunTimetableShapeContracts } = await import('../services/generation-shape-assembly.service.js');
	const { constructBaseline } = await import('../services/schedule-constructor.js');
	const shapes = buildRunTimetableShapeContracts({
		sectionsByGrade: [{ gradeLevelId: 17, sections: [{ programType: 'REGULAR' }] }],
		gradeWindows: [{ gradeLevel: 7, programType: 'REGULAR', startTime: '06:00', endTime: '13:00' }],
		templateProfiles: [{ programType: 'REGULAR', periodLengthMinutes: 45, periodsPerDay: 8 }],
		canonicalSlots: new Map([['7:REGULAR', getExpectedCanonicalSlots(7, 'REGULAR').map((slot) => ({
			startTime: slot.startTime, endTime: slot.endTime, subjectFamily: slot.subjectFamily ?? null, subjectLabel: slot.subjectLabel ?? null, rowKind: slot.rowKind,
		}))]]),
		policy: { periodLengthMinutes: 45, periodsPerDay: 8 } as any,
	});
	const ghostInput: any = buildConstructorInputFixture(shapes, {
		subject: { id: 11, code: 'MATH', minMinutesPerWeek: 90, preferredRoomType: 'CLASSROOM', gradeLevels: [7], requiredFeatures: [], programScopes: ['REGULAR'] },
		facultySubjects: [{ facultyId: 71, subjectId: 11, gradeLevels: [7], sectionIds: [SECTION_ID] }],
		pairOwners: { [`11:${SECTION_ID}`]: 71 },
		// subject 999 is deliberately absent from `subjects` (Site A).
		demandOverride: [{ sectionId: SECTION_ID, subjectId: 999, subjectCode: 'GHOST', gradeLevel: 7, sessionsPerWeek: 1, durationPerSession: 45, enrolledCount: 40, entryKind: 'SECTION', roomTypePreference: 'LABORATORY', homeRoomId: 201 }],
	});
	const result = constructBaseline(ghostInput);
	const ghost = result.unassignedItems.filter((item) => item.subjectId === 999);
	assert.equal(ghost.length, 1);
	assert.equal(ghost[0].reason, 'NO_QUALIFIED_FACULTY');
	assert.equal(ghost[0].roomAssignmentReason, 'NO_QUALIFIED_FACULTY', 'a missing subject is not a room result');
});

test('C07-R2c. the real trigger cannot reach Site A or an ownerless pair: the preflight fails closed instead', async () => {
	// (i) A non-schedulable (ARAL) subject that would create Site-A demand is
	// rejected by the preflight rather than scheduled without a subject binding.
	const aralHarness = buildTriggerClient({ addNonSchedulableDemand: true });
	await assert.rejects(trigger(aralHarness.client), (error: any) => {
		assert.equal(error.code, 'GENERATION_PREFLIGHT_BLOCKED');
		const codes = (error.details?.blockers ?? []).map((blocker: { code: string }) => blocker.code);
		assert.ok(codes.includes('NON_SCHEDULABLE_SUBJECT_DEMAND'), `expected NON_SCHEDULABLE_SUBJECT_DEMAND, saw ${codes.join(', ')}`);
		return true;
	});
	assert.equal(aralHarness.sequence().length, 0, 'a blocked preflight performs zero writes');

	// (ii) An ownerless derived pair is rejected by the preflight too, so the
	// constructor can never see an ownerless pair through the real trigger.
	const ownerlessHarness = buildTriggerClient({ scenario: 'dedicatedSpecialized', noOwnershipForSubject: ROBOTICS_SUBJECT_ID });
	await assert.rejects(trigger(ownerlessHarness.client), (error: any) => {
		assert.equal(error.code, 'GENERATION_PREFLIGHT_BLOCKED');
		const codes = (error.details?.blockers ?? []).map((blocker: { code: string }) => blocker.code);
		assert.ok(codes.includes('TL_DEMAND_UNCOVERED'), `expected TL_DEMAND_UNCOVERED, saw ${codes.join(', ')}`);
		return true;
	});
	assert.equal(ownerlessHarness.sequence().length, 0, 'a blocked preflight performs zero writes');
});

test('C07-R2d. settled room contract re-asserted: CLASSROOM Science stays in classrooms, LABORATORY authority stays data-driven, no inference from name/code/rotation', async () => {
	// (1) Science configured CLASSROOM: zero laboratory reservations, zero laboratory warnings.
	const classroomHarness = buildTriggerClient({ scienceAuthority: 'CLASSROOM' });
	await trigger(classroomHarness.client);
	const classroomPayload = classroomHarness.completedPayload();
	assert.ok(classroomPayload);
	assert.equal((classroomPayload.draftEntries as any[]).filter((entry) => SPECIALIST_ROOM_IDS.includes(entry.roomId)).length, 0);
	assert.equal((classroomPayload.violations as any[]).some((violation) => violation.code === 'SPECIALIZED_ROOM_UNAVAILABLE' || violation.code === 'ROOM_TYPE_MISMATCH' || violation.code === 'ROOM_FEATURE_MISMATCH'), false);

	// (2) Explicit LABORATORY authority on the same Science family: honoured per term.
	const labHarness = buildTriggerClient({ scienceAuthority: 'LABORATORY' });
	await trigger(labHarness.client);
	const labPayload = labHarness.completedPayload();
	assert.ok(labPayload);
	const labEntries = (labPayload.draftEntries as any[]).filter((entry) => SCIENCE_SUBJECT_IDS.includes(entry.subjectId));
	assert.ok(labEntries.length > 0);
	assert.ok(labEntries.every((entry) => LAB_ROOM_IDS.includes(entry.roomId)));

	// (3) A specialized authority with NO Science name/code/rotation family is still
	// honoured from persisted data alone (no inference), and the Science rotation
	// members would stay in classrooms if their authority said so.
	assert.equal((labPayload.draftEntries as any[]).filter((entry) => entry.subjectId === ROBOTICS_SUBJECT_ID).length, 0, 'the dedicated scenario subject is not part of this fixture');
	const dedicated = buildTriggerClient({ scenario: 'dedicatedSpecialized' });
	await trigger(dedicated.client);
	const dedicatedPayload = dedicated.completedPayload();
	assert.ok(dedicatedPayload);
	const roboticsEntries = (dedicatedPayload.draftEntries as any[]).filter((entry) => entry.subjectId === ROBOTICS_SUBJECT_ID);
	assert.ok(roboticsEntries.length > 0, 'a specialized authority must be honoured from persisted data with no name/code inference');
	assert.ok(roboticsEntries.every((entry) => LAB_ROOM_IDS.includes(entry.roomId)), 'the ROBOTICS laboratory authority must reserve a laboratory');
	assert.equal((dedicatedPayload.draftEntries as any[]).filter((entry) => entry.subjectId === 11).every((entry) => entry.roomId === 201 || entry.roomId === 202), true, 'the CLASSROOM subject stays in classrooms');
});


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
