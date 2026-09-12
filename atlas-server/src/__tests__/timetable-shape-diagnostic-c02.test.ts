/** TT-SHAPE-DIAGNOSTIC-C02 — failing-first policy and stakeholder-shape mutants. */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
	validateOrderedTermAuthority,
	buildTimetableOutputProjections,
	validateOutputShapeParity,
	validateTermTeacherResolution,
	validateTimetableShapePolicy,
	type TimetableShapePolicyInput,
} from '../services/timetable-shape-policy.service.js';
import { buildSpecialEventSlots, buildTimetableShapeContract } from '../services/schedule-constructor.js';
import { getExpectedCanonicalSlots } from '../services/class-program-slot.service.js';
import { buildGenerationPreflight, buildSectionScopeMap, validateCanonicalEntryShapes } from '../services/generation-preflight.service.js';
import { buildGenerationReadiness } from '../services/generation-readiness.service.js';
import type { VerifiedTermContract } from '../services/enrollpro-term-contract.service.js';

const terms3 = [
	{ identity: 'T1', order: 1 },
	{ identity: 'T2', order: 2 },
	{ identity: 'T3', order: 3 },
];
const terms4 = [...terms3, { identity: 'T4', order: 4 }];

function matrixShapes() {
	return [7, 8, 9, 10].map((gradeLevel) => ({
		gradeLevel,
		programType: 'REGULAR',
		startTime: gradeLevel <= 8 ? '06:00' : '13:00',
		endTime: gradeLevel <= 8 ? '13:00' : '18:30',
		periodLengthMinutes: 45,
		periodsPerDay: getExpectedCanonicalSlots(gradeLevel, 'REGULAR').filter((row) => row.rowKind === 'CLASS').length,
		canonicalSlots: getExpectedCanonicalSlots(gradeLevel, 'REGULAR'),
	}));
}

function validInput(overrides: Partial<TimetableShapePolicyInput> = {}): TimetableShapePolicyInput {
	return {
		termAuthority: { format: 'TRIMESTER', terms: terms3, cachedAt: '2026-09-12T00:00:00Z' },
		shiftWindows: [
			{ gradeLevel: 7, programType: 'REGULAR', startTime: '06:00', endTime: '12:15' },
			{ gradeLevel: 8, programType: 'REGULAR', startTime: '06:00', endTime: '12:15' },
			{ gradeLevel: 9, programType: 'REGULAR', startTime: '13:00', endTime: '18:30' },
			{ gradeLevel: 10, programType: 'REGULAR', startTime: '13:00', endTime: '18:30' },
		],
		sections: [7, 8, 9, 10].map((gradeLevel) => ({ id: gradeLevel, gradeLevel, programType: 'REGULAR' })),
		shapes: matrixShapes().map((shape) => buildTimetableShapeContract({ ...shape, basePolicy: { maxConsecutiveTeachingMinutesBeforeBreak: 120, minBreakMinutesAfterConsecutiveBlock: 15, maxTeachingMinutesPerDay: 480, earliestStartTime: '06:00', latestEndTime: '18:30', enableFlagCeremony: false } })),
		rooms: [{ id: 1, isTeachingSpace: true }],
		subjects: [{ id: 1, code: 'MATH', schedulingDisposition: 'SCHEDULED_TEACHING' }],
		demandLines: [{ sectionExternalId: 7, subjectId: 1, subjectCode: 'MATH', termIdentity: 'T1', termIndex: 1, rotationFamily: null }],
		...overrides,
	};
}

test('stakeholder matrix: G7/G8 morning and G9/G10 afternoon rows preserve duration, breaks, and totals', () => {
	const blockers = validateTimetableShapePolicy(validInput());
	assert.deepEqual(blockers, []);
	for (const grade of [7, 8]) {
		const rows = getExpectedCanonicalSlots(grade, 'REGULAR');
		assert.equal(rows[0].startTime, '06:00');
		assert.equal(rows.filter((row) => row.rowKind === 'CLASS').length, 8);
		assert.ok(rows.some((row) => row.startTime === '09:00' && row.endTime === '09:15' && row.rowKind === 'BREAK'));
		assert.ok(rows.some((row) => row.startTime === '12:15' && row.endTime === '13:00' && row.rowKind === 'BREAK'));
	}
	for (const grade of [9, 10]) {
		const rows = getExpectedCanonicalSlots(grade, 'REGULAR');
		assert.equal(rows.find((row) => row.rowKind === 'CLASS')?.startTime, '13:00');
		assert.equal(rows.filter((row) => row.rowKind === 'CLASS').length, 7);
		assert.ok(rows.some((row) => row.startTime === '15:15' && row.endTime === '15:30' && row.rowKind === 'BREAK'));
	}
});

test('failing-first mutant: a Monday flag row widened to five days is blocked', () => {
	const blockers = validateTimetableShapePolicy({ ...validInput(), flagCeremony: { enabled: true, dayOfWeek: 'MONDAY', startTime: '07:00', endTime: '07:30' } });
	assert.equal(blockers.some((blocker) => blocker.code === 'FLAG_CEREMONY_SCOPE_INVALID'), false);
	const mutant = validateTimetableShapePolicy({ ...validInput(), flagCeremony: { enabled: true, dayOfWeek: 'WEEKDAYS', startTime: '07:00', endTime: '07:30' } });
	assert.ok(mutant.some((blocker) => blocker.code === 'FLAG_CEREMONY_SCOPE_INVALID'));
});

test('canonical schedule-constructor marks flag ceremony as a Monday-only display event', () => {
	const rows = buildSpecialEventSlots({
		maxConsecutiveTeachingMinutesBeforeBreak: 120,
		minBreakMinutesAfterConsecutiveBlock: 15,
		maxTeachingMinutesPerDay: 480,
		earliestStartTime: '06:00',
		latestEndTime: '18:30',
		enableFlagCeremony: true,
		flagCeremonyStartTime: '07:00',
		flagCeremonyEndTime: '07:30',
		enableRecess: false,
		enableLunchWindow: false,
	});
	const ceremony = rows.find((row) => row.eventName === 'FLAG CEREMONY');
	assert.equal(ceremony?.dayOfWeek, 'MONDAY');
	const custom = buildTimetableShapeContract({
		gradeLevel: 7,
		programType: 'REGULAR',
		startTime: '06:00',
		endTime: '13:00',
		periodLengthMinutes: 45,
		periodsPerDay: 8,
		canonicalSlots: getExpectedCanonicalSlots(7, 'REGULAR'),
		basePolicy: {
			maxConsecutiveTeachingMinutesBeforeBreak: 120,
			minBreakMinutesAfterConsecutiveBlock: 15,
			maxTeachingMinutesPerDay: 480,
			earliestStartTime: '06:00',
			latestEndTime: '18:30',
			enableFlagCeremony: true,
			specialEvents: [{ eventType: 'FLAG_OR_HGP', label: 'Flag Ceremony', startTime: '07:00', endTime: '07:30', dayOfWeek: 'TUESDAY', gradeGroup: null, programType: null, enabled: true }],
		},
	});
	assert.equal(custom.displaySlots.find((row) => row.eventName === 'Flag Ceremony')?.dayOfWeek, 'TUESDAY');
});

test('failing-first mutant: HG and ARAL demand is rejected as ordinary timetable demand', () => {
	const mutant = validateTimetableShapePolicy({
		...validInput(),
		subjects: [{ id: 99, code: 'HG', schedulingDisposition: 'SCHEDULED_TEACHING' }, { id: 100, code: 'ARAL', schedulingDisposition: 'SCHEDULED_TEACHING' }],
		demandLines: [
			{ sectionExternalId: 7, subjectId: 99, subjectCode: 'HG', termIdentity: 'T1', termIndex: 1, rotationFamily: null },
			{ sectionExternalId: 7, subjectId: 100, subjectCode: 'ARAL', termIdentity: 'T1', termIndex: 1, rotationFamily: null },
		],
	});
	assert.equal(mutant.filter((blocker) => blocker.code === 'NON_SCHEDULABLE_SUBJECT_DEMAND').length, 2);
});

test('failing-first mutants: two terms and collapsed Q4 are rejected without hard-coding Q4 into a trimester', () => {
	assert.ok(validateOrderedTermAuthority({ format: 'TRIMESTER', terms: terms3.slice(0, 2), cachedAt: 'x' }).some((blocker) => blocker.code === 'TERM_ORDER_INVALID'));
	assert.ok(validateOrderedTermAuthority({ format: 'QUARTERS', terms: terms3, cachedAt: 'x' }).some((blocker) => blocker.code === 'TERM_ORDER_INVALID'));
	assert.deepEqual(validateOrderedTermAuthority({ format: 'QUARTERS', terms: terms4, cachedAt: 'x' }), []);
});

test('typed blockers cover missing cache, stale authority, shift windows, slots, and rooms', () => {
	assert.equal(validateOrderedTermAuthority({ format: 'TRIMESTER', terms: [], cachedAt: null })[0].code, 'TERM_CACHE_MISSING');
	assert.equal(validateOrderedTermAuthority({ format: 'TRIMESTER', terms: terms3, cachedAt: 'x', stale: true })[0].code, 'TERM_AUTHORITY_STALE');
	const blockers = validateTimetableShapePolicy({
		...validInput(),
		termAuthority: { format: 'TRIMESTER', terms: terms3, cachedAt: 'x' },
		validateShiftWindows: true,
		shiftWindows: [],
		shapes: [],
		rooms: [],
	});
	assert.ok(blockers.some((blocker) => blocker.code === 'SHIFT_WINDOW_MISSING'));
	assert.ok(blockers.some((blocker) => blocker.code === 'CANONICAL_SLOTS_MISSING'));
	assert.ok(blockers.some((blocker) => blocker.code === 'ROOMS_MISSING'));
});

test('term-specific rotation teacher resolution permits a different teacher per term and rejects missing term teacher', () => {
	assert.deepEqual(validateTermTeacherResolution([
		{ subjectId: 50, sectionId: 7, termIndex: 1, facultyId: 101 },
		{ subjectId: 50, sectionId: 7, termIndex: 2, facultyId: 102 },
	]), []);
	assert.ok(validateTermTeacherResolution([{ subjectId: 50, sectionId: 7, termIndex: 3, facultyId: null }]).some((blocker) => blocker.code === 'TERM_TEACHER_UNRESOLVED'));
});

test('failing-first mutant: cross-shift placement and mismatched section/teacher/room projections are blocked', () => {
	const input = validInput({ entries: [{ sectionId: 9, facultyId: 101, roomId: 1, subjectId: 1, termIndex: 1, startTime: '06:00', endTime: '06:45' }] });
	assert.ok(validateTimetableShapePolicy(input).some((blocker) => blocker.code === 'OUTPUT_SHAPE_MISMATCH'));
	const parity = validateOutputShapeParity({ section: [{ key: 'a', entityId: 7 }, { key: 'b', entityId: 7 }], teacher: [{ key: 'a', entityId: 101 }], room: [{ key: 'a', entityId: 1 }, { key: 'b', entityId: 1 }] });
	assert.ok(parity.some((blocker) => blocker.code === 'OUTPUT_SHAPE_MISMATCH'));
});

test('distinct output projections bind entry identity to section, teacher, and room domains', () => {
	const projections = buildTimetableOutputProjections([
		{ entryId: 'e-1', sectionId: 7, subjectId: 1, termIndex: 1, facultyId: 101, roomId: 201, startTime: '06:00', endTime: '06:45' },
		{ entryId: 'e-2', sectionId: 7, subjectId: 2, termIndex: 1, facultyId: null, roomId: 202, startTime: '06:45', endTime: '07:30' },
	]);
	assert.deepEqual(projections.section.map((row) => row.key), ['e-1', 'e-2']);
	assert.deepEqual(projections.teacher.map((row) => row.key), ['e-1'], 'unresolved teacher rows are not projected');
	assert.deepEqual(projections.room.map((row) => row.key), ['e-1', 'e-2']);
	assert.deepEqual(projections.section.map((row) => row.entityId), [7, 7]);
	assert.deepEqual(projections.teacher.map((row) => row.entityId), [101]);
	assert.deepEqual(projections.room.map((row) => row.entityId), [201, 202]);
	assert.ok(validateOutputShapeParity(projections).some((blocker) => blocker.code === 'OUTPUT_SHAPE_MISMATCH'));
	const boundEntry = { entryId: 'e-1', sectionId: 7, facultyId: 101, roomId: 201, subjectId: 1, termIndex: 1, startTime: '06:00', endTime: '06:45' };
	const wrongRoomBinding = buildTimetableOutputProjections([boundEntry]);
	wrongRoomBinding.room[0] = { ...wrongRoomBinding.room[0], entityId: 999 };
	assert.ok(validateTimetableShapePolicy({ ...validInput(), entries: [boundEntry], outputProjections: wrongRoomBinding }).some((blocker) => blocker.code === 'OUTPUT_SHAPE_MISMATCH'));
});

// ─── Real canonical entry-point mutants (read-only disposable client) ─────

const DIAGNOSTIC_SCHOOL_ID = 71;
const DIAGNOSTIC_YEAR_ID = 11;
const DIAGNOSTIC_TERM_CONTRACT: VerifiedTermContract = {
	schoolId: DIAGNOSTIC_SCHOOL_ID,
	schoolYear: { id: DIAGNOSTIC_YEAR_ID, yearLabel: '2031-2032' },
	format: 'TRIMESTER',
	terms: [
		{ identity: 'T1', displayLabel: 'First Trimester', order: 1, startDate: '2031-06-01', endDate: '2031-09-01' },
		{ identity: 'T2', displayLabel: 'Second Trimester', order: 2, startDate: '2031-09-02', endDate: '2032-01-01' },
		{ identity: 'T3', displayLabel: 'Third Trimester', order: 3, startDate: '2032-01-02', endDate: '2032-04-01' },
	],
	semanticRevision: 'D'.repeat(64),
	activeTerm: { identity: 'T1', displayLabel: 'First Trimester', order: 1 },
	activeTermState: { availability: 'RESOLVED', code: null, message: 'resolved', reachable: true, identity: 'T1' },
};

type DiagnosticClientOptions = {
	terms?: 'valid' | 'missing' | 'stale';
	rooms?: 'valid' | 'missing';
	slots?: 'valid' | 'missing';
	demand?: 'valid' | 'empty';
	specialEvent?: { eventType: string; label: string; dayOfWeek?: string | null };
	includeReferenceSubjects?: boolean;
	includeOwnership?: boolean;
	includeRotatingSubjects?: boolean;
};

function buildDiagnosticClient(options: DiagnosticClientOptions = {}) {
	const writes: string[] = [];
	const write = (name: string) => async (..._args: unknown[]) => { writes.push(name); return {}; };
	const sections = [{
		id: 701,
		externalId: 701,
		mirrorId: 701,
		schoolId: DIAGNOSTIC_SCHOOL_ID,
		schoolYearId: DIAGNOSTIC_YEAR_ID,
		name: '7-REGULAR',
		gradeLevelId: 17,
		gradeLevelName: 'Grade 7',
		displayOrder: 1,
		maxCapacity: 45,
		enrolledCount: 40,
		programType: 'REGULAR',
		programCode: 'REGULAR',
		programName: 'Regular',
		isSpecialProgram: false,
		tleProgramId: null,
		tleSpecialization: null,
		tleProgramCategory: null,
		homeRoomId: null,
		buildingZoneId: 'Z1',
		isActiveForScheduling: true,
		isStale: false,
	}];
	const math = {
		id: 11,
		code: 'MATH',
		name: 'Mathematics',
		schedulingDisposition: 'SCHEDULED_TEACHING',
		gradeLevels: [7],
		programScopes: ['REGULAR'],
		rotationFamily: null,
		modularOrder: null,
		minMinutesPerWeek: 90,
		preferredRoomType: 'CLASSROOM',
		requiredFeatures: [],
		isActive: true,
		ownerDepartment: null,
		qualificationPriority: 'DEPARTMENT_FIRST',
		interSectionEnabled: false,
		interSectionGradeLevels: [],
		allowedSpecializations: [],
		modularGroupId: null,
	};
	const referenceSubjects = options.includeReferenceSubjects === false ? [] : [
		{ ...math, id: 98, code: 'HG', name: 'Homeroom Guidance', schedulingDisposition: 'REFERENCE_ONLY', minMinutesPerWeek: 0 },
		{ ...math, id: 99, code: 'ARAL', name: 'ARAL', schedulingDisposition: 'REFERENCE_ONLY', minMinutesPerWeek: 0 },
	];
	const rotationSubjects = [1, 2, 3].map((order) => ({
		...math,
		id: 20 + order,
		code: `SCI_${order}`,
		name: `Science ${order}`,
		rotationFamily: 'SCIENCE',
		modularOrder: order,
	}));
	const teachingSubjects = [math, ...(options.includeRotatingSubjects ? rotationSubjects : [])];
	const subjects = options.demand === 'empty' ? referenceSubjects : [...teachingSubjects, ...referenceSubjects];
	const slotRows = options.slots === 'missing' ? [] : getExpectedCanonicalSlots(7, 'REGULAR').map((slot, index) => ({
		id: 7100 + index,
		schoolId: DIAGNOSTIC_SCHOOL_ID,
		schoolYearId: DIAGNOSTIC_YEAR_ID,
		gradeLevel: 7,
		programType: 'REGULAR',
		startTime: slot.startTime,
		endTime: slot.endTime,
		rowKind: slot.rowKind,
		isActive: true,
		subjectFamily: slot.subjectFamily ?? null,
		subjectLabel: slot.subjectLabel ?? null,
		dayOfWeek: null,
	}));
	const policy = {
		id: 1,
		schoolId: DIAGNOSTIC_SCHOOL_ID,
		schoolYearId: DIAGNOSTIC_YEAR_ID,
		periodLengthMinutes: 45,
		periodsPerDay: 8,
		maxConsecutiveTeachingMinutesBeforeBreak: 120,
		minBreakMinutesAfterConsecutiveBlock: 15,
		maxTeachingMinutesPerDay: 480,
		earliestStartTime: '06:00',
		latestEndTime: '13:00',
		enforceConsecutiveBreakAsHard: false,
		enableTravelWellbeingChecks: false,
		maxWalkingDistanceMetersPerTransition: 120,
		maxBuildingTransitionsPerDay: 4,
		maxBackToBackTransitionsWithoutBuffer: 2,
		maxIdleGapMinutesPerDay: 60,
		avoidEarlyFirstPeriod: false,
		avoidLateLastPeriod: false,
		enableVacantAwareConstraints: false,
		targetFacultyDailyVacantMinutes: 60,
		targetSectionDailyVacantPeriods: 1,
		maxCompressedTeachingMinutesPerDay: 300,
		lunchStartTime: '12:15',
		lunchEndTime: '13:00',
		enforceLunchWindow: false,
		showSpecialEventsInGrid: true,
		enableFlagCeremony: options.specialEvent != null,
		flagCeremonyStartTime: '07:00',
		flagCeremonyEndTime: '07:30',
		enableRecess: false,
		recessStartTime: '09:00',
		recessEndTime: '09:15',
		enableLunchWindow: false,
		enableTleTwoPassPriority: true,
		allowFlexibleSubjectAssignment: false,
		allowConsecutiveLabSessions: false,
		constraintConfig: null,
	};
	const termCache = options.terms === 'valid' || options.terms === undefined
		? { schoolId: DIAGNOSTIC_SCHOOL_ID, schoolYear: { id: DIAGNOSTIC_YEAR_ID }, format: 'TRIMESTER', terms: DIAGNOSTIC_TERM_CONTRACT.terms, semanticRevision: 'D'.repeat(64) }
		: options.terms === 'stale'
			? { schoolId: DIAGNOSTIC_SCHOOL_ID, schoolYear: { id: DIAGNOSTIC_YEAR_ID }, format: 'TRIMESTER', terms: DIAGNOSTIC_TERM_CONTRACT.terms, semanticRevision: 'STALE' }
			: null;
	const rooms = options.rooms === 'missing' ? [] : [{ id: 201, name: 'R201', type: 'CLASSROOM', isTeachingSpace: true, isSharedFacility: false, capacity: 50, features: [], buildingId: 301, buildingZoneId: 'Z1', building: { id: 301, name: 'Building 1', shortCode: 'B1', x: 0, y: 0, gradeScope: [7], isTeachingBuilding: true } }];
	const ownership = options.includeOwnership === false ? [] : [{ id: 1, subjectId: 11, sectionId: 701, facultyId: 501, facultySubjectId: 1 }];
	const facultySubjects = [...teachingSubjects.map((subject, index) => ({ id: index + 1, facultyId: 501, subjectId: subject.id, gradeLevels: [7], sectionIds: [701] }))];
	const specialEvents = options.specialEvent ? [{ id: 1, schoolId: DIAGNOSTIC_SCHOOL_ID, schoolYearId: DIAGNOSTIC_YEAR_ID, eventType: options.specialEvent.eventType, label: options.specialEvent.label, gradeGroup: null, programType: null, startTime: '07:00', endTime: '07:30', dayOfWeek: options.specialEvent.dayOfWeek, enabled: true, sortOrder: 1 }] : [];
	const client: any = {
		generationRun: { count: async () => 0, findFirst: async () => null, findMany: async () => [] },
		lockedSession: { count: async () => 0, findFirst: async () => null, findMany: async () => [] },
		lockedSessionAction: { count: async () => 0 },
		auditLog: { count: async () => 0 },
		teachingLoadCycle: { findMany: async () => [] },
		subjectSectionOwnership: { count: async () => ownership.length, findMany: async () => ownership },
		schedulingPolicy: { findUnique: async () => policy },
		enrollProSchoolYearMirror: {
			findMany: async () => [{ enrollProSchoolYearId: DIAGNOSTIC_YEAR_ID, yearLabel: '2031-2032' }],
			findUnique: async () => options.terms === 'missing' ? { isActive: true, isArchived: false, termContractCache: null, termContractCachedAt: null } : { isActive: true, isArchived: false, termContractCache: termCache, termContractCachedAt: new Date('2031-01-01') },
		},
		sectionMirror: { findMany: async () => sections, count: async () => sections.length },
		subject: { findMany: async () => subjects },
		facultyMirror: { findMany: async () => [{ id: 501, firstName: 'T', lastName: 'Teacher', department: 'MATH', maxHoursPerWeek: 40, ancillaryMinutesPerWeek: 0, isActiveForScheduling: true, isStale: false, canTeachOutsideDepartment: true }] },
		facultySubject: { findMany: async () => facultySubjects },
		room: { findMany: async () => rooms },
		building: { findMany: async () => [{ id: 301, name: 'Building 1', shortCode: 'B1', x: 0, y: 0 }] },
		facultyPreference: { findMany: async () => [] },
		policySpecialEvent: { findMany: async () => specialEvents },
		gradeShiftWindow: { findMany: async () => [] },
		classProgramSlot: { findMany: async (args: any) => {
			const where = args?.where ?? {};
			return slotRows.filter((row) => (where.gradeLevel == null || row.gradeLevel === where.gradeLevel) && (where.programType === undefined || row.programType === where.programType) && (where.isActive === undefined || row.isActive === where.isActive));
		} },
		classTemplate: { findMany: async () => [{ programType: 'REGULAR', periodLengthMinutes: 45, periodsPerDay: 8 }] },
		instructionalCohort: { findMany: async () => [] },
		sectionSnapshot: { findUnique: async () => null },
		publishedScheduleRevision: { count: async () => 0 },
		$transaction: write('$transaction'),
		$executeRaw: write('$executeRaw'),
		$queryRaw: async () => [],
	};
	return { client, writes, sections, slotRows };
}

test('real preflight/readiness entry points fail closed for empty demand/output and remain zero-write', async () => {
	const empty = buildDiagnosticClient({ demand: 'empty', includeReferenceSubjects: true });
	const preflight = await buildGenerationPreflight(DIAGNOSTIC_SCHOOL_ID, DIAGNOSTIC_YEAR_ID, { client: empty.client, termContract: DIAGNOSTIC_TERM_CONTRACT, includeRetainedDrafts: false });
	assert.equal(preflight.assembly.schedulerCanRun, false);
	assert.ok(preflight.blockers.some((entry) => entry.code === 'EMPTY_DERIVED_DEMAND'));
	assert.deepEqual(empty.writes, []);

	const noRooms = buildDiagnosticClient({ rooms: 'missing' });
	const readiness = await buildGenerationReadiness(DIAGNOSTIC_SCHOOL_ID, DIAGNOSTIC_YEAR_ID, { client: noRooms.client, termContract: DIAGNOSTIC_TERM_CONTRACT, includeRetainedDrafts: false });
	assert.equal(readiness.status, 'BLOCKED');
	assert.ok(readiness.blockers.some((entry) => entry.code === 'ROOMS_MISSING'));
	assert.ok(readiness.blockers.some((entry) => entry.code === 'EMPTY_SCHEDULE_OUTPUT'));
	assert.equal(readiness.databaseSignature.zeroWrite, true);
	assert.deepEqual(noRooms.writes, []);
});

test('real preflight/readiness entry points report missing or stale ordered-term authority without writes', async () => {
	const missing = buildDiagnosticClient({ terms: 'missing' });
	const missingReadiness = await buildGenerationReadiness(DIAGNOSTIC_SCHOOL_ID, DIAGNOSTIC_YEAR_ID, { client: missing.client, includeRetainedDrafts: false });
	assert.equal(missingReadiness.status, 'BLOCKED');
	assert.ok(missingReadiness.blockers.some((entry) => entry.code === 'TERM_STRUCTURE_UNAVAILABLE'));
	assert.deepEqual(missing.writes, []);

	const stale = buildDiagnosticClient({ terms: 'stale' });
	const stalePreflight = await buildGenerationPreflight(DIAGNOSTIC_SCHOOL_ID, DIAGNOSTIC_YEAR_ID, { client: stale.client, includeRetainedDrafts: false });
	assert.ok(stalePreflight.blockers.some((entry) => entry.code === 'TERM_AUTHORITY_STALE'));
	assert.deepEqual(stale.writes, []);
});

test('real preflight reports missing canonical slots and schema-shaped FLAG_OR_HGP defaults to Monday', async () => {
	const missingSlots = buildDiagnosticClient({ slots: 'missing' });
	const preflight = await buildGenerationPreflight(DIAGNOSTIC_SCHOOL_ID, DIAGNOSTIC_YEAR_ID, { client: missingSlots.client, termContract: DIAGNOSTIC_TERM_CONTRACT, includeRetainedDrafts: false });
	assert.ok(preflight.blockers.some((entry) => entry.code === 'CANONICAL_TEMPLATE_INCOMPLETE'));
	assert.deepEqual(missingSlots.writes, []);

	const schemaShapedFlag = buildDiagnosticClient({ specialEvent: { eventType: 'FLAG_OR_HGP', label: 'Flag Ceremony' } });
	const monday = await buildGenerationPreflight(DIAGNOSTIC_SCHOOL_ID, DIAGNOSTIC_YEAR_ID, { client: schemaShapedFlag.client, termContract: DIAGNOSTIC_TERM_CONTRACT, includeRetainedDrafts: false });
	assert.equal(monday.blockers.some((entry) => entry.code === 'FLAG_CEREMONY_SCOPE_INVALID'), false);
	assert.deepEqual(schemaShapedFlag.writes, []);

	const tuesdayFlag = buildDiagnosticClient({ specialEvent: { eventType: 'FLAG_OR_HGP', label: 'Flag Ceremony', dayOfWeek: 'TUESDAY' } });
	const tuesday = await buildGenerationPreflight(DIAGNOSTIC_SCHOOL_ID, DIAGNOSTIC_YEAR_ID, { client: tuesdayFlag.client, termContract: DIAGNOSTIC_TERM_CONTRACT, includeRetainedDrafts: false });
	assert.ok(tuesday.blockers.some((entry) => entry.code === 'FLAG_CEREMONY_SCOPE_INVALID'));
	assert.deepEqual(tuesdayFlag.writes, []);
});

test('real preflight excludes HG/ARAL and binds cross-shift and missing rotating-term teacher mutants', async () => {
	const built = buildDiagnosticClient();
	const preflight = await buildGenerationPreflight(DIAGNOSTIC_SCHOOL_ID, DIAGNOSTIC_YEAR_ID, { client: built.client, termContract: DIAGNOSTIC_TERM_CONTRACT, includeRetainedDrafts: false });
	assert.equal(preflight.assembly.derived?.timetableLines.some((line) => /^(HG|ARAL)$/i.test(line.subjectCode)), false);
	assert.equal(preflight.assembly.schedulableSubjects.some((subject: any) => /^(HG|ARAL)$/i.test(subject.code)), false);

	const crossShift = validateCanonicalEntryShapes([{
		entryId: 'cross-shift', facultyId: 501, roomId: 201, subjectId: 11, sectionId: 701, day: 'MONDAY', startTime: '13:00', endTime: '13:45', durationMinutes: 45, termIndex: 1, entryKind: 'SECTION',
	}], preflight.assembly.timetableShapeContracts, buildSectionScopeMap(preflight.assembly.sectionsByGrade));
	assert.ok(crossShift.length > 0, 'cross-shift output must be rejected by the production canonical shape validator');

	const missingTeacher = buildDiagnosticClient({ includeOwnership: false, includeRotatingSubjects: true });
	const missingTeacherPreflight = await buildGenerationPreflight(DIAGNOSTIC_SCHOOL_ID, DIAGNOSTIC_YEAR_ID, { client: missingTeacher.client, termContract: DIAGNOSTIC_TERM_CONTRACT, includeRetainedDrafts: false });
	assert.ok(missingTeacherPreflight.blockers.some((entry) => entry.code === 'TL_DEMAND_UNCOVERED'));
	assert.ok(missingTeacherPreflight.assembly.perTermDemandLines.some((line) => line.rotationFamily === 'SCIENCE' && line.ownerFacultyId == null), 'a missing rotating-term teacher must remain unresolved per ordered term');
	assert.deepEqual(built.writes, []);
	assert.deepEqual(missingTeacher.writes, []);
});
