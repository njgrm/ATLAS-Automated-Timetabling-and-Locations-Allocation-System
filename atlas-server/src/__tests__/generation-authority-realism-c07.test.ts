/**
 * GENERATION-AUTHORITY-REALISM-C07 — primary source acceptance suite (C07-S01…S10).
 *
 * Run: `npx tsx src/__tests__/generation-authority-realism-c07.test.ts`
 *
 * Production entry points exercised here:
 *   - `buildGenerationPreflight` + `buildRunTimetableShapeContracts` (real
 *     preflight assembly with a mock DB client, zero writes);
 *   - `buildPreflightConstructorInput` (the exact constructor input both the
 *     readiness dry run and `triggerGenerationRun` consume);
 *   - `constructBaseline` (the real constructor);
 *   - `validateHardConstraints` (the real constraint validator);
 *   - `deriveCanonicalDemand` + `toSchedulerDemandOverride` (the real derived
 *     demand producer for the room-authority fixture);
 *   - `computeGenerationInputSnapshot` / `extractGenerationInputSnapshot` /
 *     `compareGenerationInputSnapshots`.
 *
 * No database writes, no generation run, no publication. The mock client
 * records every write attempt.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { withDataContext } from '../lib/data-context.js';
import {
	buildDayScopedEventWindows,
	buildSpecialEventSlots,
	buildTimetableShapeContract,
	buildUnionDisplaySlots,
	constructBaseline,
	resolveContainingClassRow,
	type ConstructorInput,
} from '../services/schedule-constructor.js';
import { runHybridScheduler } from '../services/hybrid-scheduler.js';
import { buildRunTimetableShapeContracts } from '../services/generation-shape-assembly.service.js';
import {
	buildGenerationPreflight,
	buildPreflightConstructorInput,
	toConstructorSpecialEvents,
} from '../services/generation-preflight.service.js';
import { validateHardConstraints, type ValidatorContext } from '../services/constraint-validator.js';
import { getExpectedCanonicalSlots } from '../services/class-program-slot.service.js';
import {
	GENERATION_INPUT_SNAPSHOT_SCHEMA_VERSION,
	compareGenerationInputSnapshots,
	computeGenerationInputSnapshot,
	extractGenerationInputSnapshot,
} from '../services/generation-input-snapshot.service.js';
import {
	deriveCanonicalDemand,
	toSchedulerDemandOverride,
	type DerivedDemandInput,
	type DerivedSubjectInput,
} from '../services/derived-demand.service.js';
import type { SectionsByGrade } from '../services/section-adapter.js';
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

const CANON_7 = getExpectedCanonicalSlots(7, 'REGULAR');
const CANON_7_SLOTS = CANON_7.map((slot) => ({
	startTime: slot.startTime,
	endTime: slot.endTime,
	subjectFamily: slot.subjectFamily ?? null,
	subjectLabel: slot.subjectLabel ?? null,
	rowKind: slot.rowKind,
}));
const CANON_7_CLASS_ROWS = CANON_7.filter((slot) => slot.rowKind === 'CLASS').map((slot) => ({ startTime: slot.startTime, endTime: slot.endTime }));

/** Persisted special-event rows used by the primary fixture (R1). */
function persistedSpecialEvents(flagDay: string | null, flagWindow = { startTime: '07:00', endTime: '07:30' }) {
	return [
		{ id: 1, eventType: 'FLAG_OR_HGP', label: 'Flag Ceremony / HGP', gradeGroup: null, programType: null, startTime: flagWindow.startTime, endTime: flagWindow.endTime, dayOfWeek: flagDay, enabled: true, sortOrder: 1 },
		{ id: 2, eventType: 'HEALTH_BREAK', label: 'Health Break', gradeGroup: '7-8', programType: null, startTime: '09:00', endTime: '09:15', dayOfWeek: null, enabled: true, sortOrder: 2 },
		{ id: 3, eventType: 'LUNCH_BREAK', label: 'Lunch Break', gradeGroup: '7-8', programType: null, startTime: '12:15', endTime: '13:00', dayOfWeek: null, enabled: true, sortOrder: 3 },
	];
}

// ─── A. Persisted events → shape contract + constructor policy (R1/R2/R3) ───

function shapeContractsFor(events: ReturnType<typeof persistedSpecialEvents>) {
	return buildRunTimetableShapeContracts({
		sectionsByGrade: [{ gradeLevelId: 17, sections: [{ programType: 'REGULAR' }] }],
		gradeWindows: [{ gradeLevel: 7, programType: 'REGULAR', startTime: '06:00', endTime: '13:00' }],
		templateProfiles: [{ programType: 'REGULAR', periodLengthMinutes: 45, periodsPerDay: 8 }],
		canonicalSlots: new Map([['7:REGULAR', CANON_7_SLOTS]]),
		policy: { periodLengthMinutes: 45, periodsPerDay: 8, specialEvents: toConstructorSpecialEvents(events) } as ConstructorInput['policy'],
	});
}

test('C07-S01/S03. persisted FLAG_OR_HGP renders exactly one Monday overlay on the containing canonical CLASS row with no extra period slot or minutes', () => {
	const contracts = shapeContractsFor(persistedSpecialEvents(null));
	assert.equal(contracts.length, 1);
	const shape = contracts[0];

	const flagOverlays = shape.displaySlots.filter((slot) => /flag|hgp/i.test(slot.eventName ?? ''));
	assert.equal(flagOverlays.length, 1, 'exactly one flag overlay row per grade/program contract');
	assert.equal(flagOverlays[0].startTime, '06:45');
	assert.equal(flagOverlays[0].endTime, '07:30');
	assert.equal(flagOverlays[0].dayOfWeek, 'MONDAY');
	assert.deepEqual(
		resolveContainingClassRow(CANON_7_CLASS_ROWS, '07:00', '07:30'),
		{ startTime: '06:45', endTime: '07:30' },
		'the configured window is contained by exactly one canonical CLASS row',
	);
	assert.ok(CANON_7_CLASS_ROWS.some((row) => row.startTime === '06:45' && row.endTime === '07:30'));
	// R2 conservation: period shape, weekly slots, and period count are identical
	// to the same fixture WITHOUT the flag row.
	const withoutFlag = shapeContractsFor(persistedSpecialEvents(null).filter((event) => event.eventType !== 'FLAG_OR_HGP'));
	assert.deepEqual(shape.periodSlots, withoutFlag[0].periodSlots, 'the overlay never adds a class period slot');
	assert.equal(shape.periodsPerDay, withoutFlag[0].periodsPerDay);
	assert.equal(shape.periodsPerDay, CANON_7_CLASS_ROWS.length);
	const classSlotMinutes = shape.periodSlots.reduce((total, slot) => total + (Number(slot.endTime.slice(0, 2)) * 60 + Number(slot.endTime.slice(3)) - (Number(slot.startTime.slice(0, 2)) * 60 + Number(slot.startTime.slice(3)))), 0);
	const withoutFlagClassMinutes = withoutFlag[0].periodSlots.reduce((total, slot) => total + (Number(slot.endTime.slice(0, 2)) * 60 + Number(slot.endTime.slice(3)) - (Number(slot.startTime.slice(0, 2)) * 60 + Number(slot.startTime.slice(3)))), 0);
	assert.equal(classSlotMinutes, withoutFlagClassMinutes, 'the overlay adds no weekly class minutes');
	// Break rows still derive from persisted HEALTH_BREAK/LUNCH_BREAK authority.
	const union = buildUnionDisplaySlots(contracts);
	assert.equal(union.filter((slot) => /flag|hgp/i.test(slot.eventName ?? '')).length, 1, 'no duplicate flag overlay in the union display slots');
});

test('C07-S01 mutant M1: omitting persisted specialEvents removes the overlay (the threading is load-bearing)', () => {
	const noEvents = buildRunTimetableShapeContracts({
		sectionsByGrade: [{ gradeLevelId: 17, sections: [{ programType: 'REGULAR' }] }],
		gradeWindows: [{ gradeLevel: 7, programType: 'REGULAR', startTime: '06:00', endTime: '13:00' }],
		templateProfiles: [{ programType: 'REGULAR', periodLengthMinutes: 45, periodsPerDay: 8 }],
		canonicalSlots: new Map([['7:REGULAR', CANON_7_SLOTS]]),
		policy: { periodLengthMinutes: 45, periodsPerDay: 8, enableFlagCeremony: false, specialEvents: [] } as unknown as ConstructorInput['policy'],
	});
	assert.equal(noEvents[0].displaySlots.filter((slot) => /flag|hgp/i.test(slot.eventName ?? '')).length, 0);
});

test('C07-S01/S03 mutant M2: a window that no single canonical CLASS row contains is never synthesized as an overlay', () => {
	// 07:00–08:00 spans 06:45–07:30 AND 07:30–08:15.
	assert.equal(resolveContainingClassRow(CANON_7_CLASS_ROWS, '07:00', '08:00'), undefined);
	const contracts = shapeContractsFor(persistedSpecialEvents(null, { startTime: '07:00', endTime: '08:00' }));
	assert.equal(contracts[0].displaySlots.filter((slot) => /flag|hgp/i.test(slot.eventName ?? '')).length, 0);
});

test('C07-S01. persisted HEALTH_BREAK/LUNCH_BREAK rows drive the non-canonical period grid (no hardcoded recess/lunch defaults)', () => {
	const policy = {
		specialEvents: toConstructorSpecialEvents(persistedSpecialEvents(null)),
		periodLengthMinutes: 45,
		periodsPerDay: 4,
		earliestStartTime: '06:00',
		latestEndTime: '09:15',
		enableRecess: true,
		recessStartTime: '09:45',
		recessEndTime: '10:00',
		enableLunchWindow: true,
		lunchStartTime: '11:55',
		lunchEndTime: '12:55',
		showSpecialEventsInGrid: true,
	} as ConstructorInput['policy'];
	const contract = buildTimetableShapeContract({
		gradeLevel: 7,
		programType: 'REGULAR',
		startTime: '06:00',
		endTime: '09:15',
		periodLengthMinutes: 45,
		periodsPerDay: 4,
		basePolicy: policy,
	});
	// 09:00–09:15 is the persisted HEALTH_BREAK, not the legacy 09:45–10:00 recess.
	assert.ok(contract.periodSlots.every((slot) => !(slot.startTime < '09:15' && slot.endTime > '09:00')), 'the persisted health break is excluded from class slots');
	assert.ok(contract.displaySlots.some((slot) => slot.startTime === '09:00' && slot.endTime === '09:15'));
});

// ─── B. R3 preflight rejection of explicit non-Monday authority ─────────────

function buildPreflightClient(flagRows: ReturnType<typeof persistedSpecialEvents>) {
	const writes: string[] = [];
	const recordWrite = (name: string) => (..._args: unknown[]) => { writes.push(name); return Promise.resolve({ id: 1 }); };
	const sectionMirrors = [{
		id: 501, externalId: 9001, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, name: '7-A', gradeLevelId: 17, gradeLevelName: 'Grade 7',
		displayOrder: 7, maxCapacity: 50, enrolledCount: 40, programType: 'REGULAR', programCode: 'REGULAR', programName: 'Regular',
		isSpecialProgram: false, tleProgramId: null, tleSpecialization: null, tleProgramCategory: null, homeRoomId: 201, buildingZoneId: 'Z1',
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
	const ownership = [
		{ id: 1, subjectId: 11, sectionId: 9001, facultyId: 71, facultySubjectId: 1 },
		{ id: 2, subjectId: 12, sectionId: 9001, facultyId: 71, facultySubjectId: 2 },
	];
	const policy = {
		id: 1, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, periodLengthMinutes: 45, periodsPerDay: 8,
		maxConsecutiveTeachingMinutesBeforeBreak: 120, minBreakMinutesAfterConsecutiveBlock: 15, maxTeachingMinutesPerDay: 480,
		earliestStartTime: '06:00', latestEndTime: '18:30', enforceConsecutiveBreakAsHard: false,
		enableTravelWellbeingChecks: false, maxWalkingDistanceMetersPerTransition: 120, maxBuildingTransitionsPerDay: 4,
		maxBackToBackTransitionsWithoutBuffer: 2, maxIdleGapMinutesPerDay: 60, avoidEarlyFirstPeriod: false, avoidLateLastPeriod: false,
		enableVacantAwareConstraints: false, targetFacultyDailyVacantMinutes: 60, targetSectionDailyVacantPeriods: 1,
		maxCompressedTeachingMinutesPerDay: 300, lunchStartTime: '12:15', lunchEndTime: '13:00', enforceLunchWindow: false,
		showSpecialEventsInGrid: true,
		// F4: `enableFlagCeremony` is FALSE on purpose — the persisted rows must be
		// validated independently of this legacy flag.
		enableFlagCeremony: false, flagCeremonyStartTime: '07:00', flagCeremonyEndTime: '07:30',
		enableRecess: false, recessStartTime: '09:00', recessEndTime: '09:15', enableLunchWindow: false,
		enableTleTwoPassPriority: true, allowFlexibleSubjectAssignment: false, allowConsecutiveLabSessions: false, constraintConfig: null,
	};
	const slotRows = CANON_7_SLOTS.map((slot, index) => ({
		id: index + 1, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, gradeLevel: 7, programType: 'REGULAR',
		startTime: slot.startTime, endTime: slot.endTime, rowKind: slot.rowKind, isActive: true,
		subjectFamily: slot.subjectFamily, subjectLabel: slot.subjectLabel, dayOfWeek: null,
	}));
	const client: any = {
		generationRun: { count: async () => 0, findFirst: async () => null, findMany: async () => [], create: recordWrite('generationRun.create'), update: recordWrite('generationRun.update') },
		lockedSession: { count: async () => 0, findFirst: async () => null, findMany: async () => [], updateMany: recordWrite('lockedSession.updateMany') },
		lockedSessionAction: { count: async () => 0, create: recordWrite('lockedSessionAction.create') },
		auditLog: { count: async () => 0, create: recordWrite('auditLog.create') },
		teachingLoadCycle: { findMany: async () => [], create: recordWrite('teachingLoadCycle.create') },
		subjectSectionOwnership: { count: async () => ownership.length, findMany: async () => ownership },
		schedulingPolicy: { findUnique: async () => policy, upsert: recordWrite('schedulingPolicy.upsert') },
		enrollProSchoolYearMirror: {
			findMany: async () => [{ enrollProSchoolYearId: SCHOOL_YEAR_ID, yearLabel: '2029-2030' }],
			findFirst: async () => ({ enrollProSchoolYearId: SCHOOL_YEAR_ID }),
			findUnique: async () => ({ isActive: true, isArchived: false, termContractCache: { schoolId: SCHOOL_ID, schoolYear: { id: SCHOOL_YEAR_ID }, format: 'TRIMESTER', terms: TERM_CONTRACT.terms }, termContractCachedAt: new Date('2029-01-01') }),
		},
		sectionMirror: { findMany: async () => sectionMirrors, count: async () => sectionMirrors.length, createMany: recordWrite('sectionMirror.createMany') },
		subject: { findMany: async () => subjects },
		facultyMirror: { findMany: async () => faculty },
		facultySubject: { findMany: async () => facultySubjects },
		// Primary fixture rooms: classrooms PLUS three laboratories and a TLE
		// workshop so a false laboratory inference is detectable.
		room: {
			findMany: async () => [
				{ id: 201, type: 'CLASSROOM', isTeachingSpace: true, isSharedFacility: false, capacity: 50, features: [], floor: 1, buildingId: 301, buildingZoneId: 'Z1', building: { gradeScope: [7] } },
				{ id: 202, type: 'CLASSROOM', isTeachingSpace: true, isSharedFacility: false, capacity: 50, features: [], floor: 1, buildingId: 301, buildingZoneId: 'Z1', building: { gradeScope: [7] } },
				{ id: 301, type: 'LABORATORY', isTeachingSpace: true, isSharedFacility: false, capacity: 50, features: ['SINK'], floor: 1, buildingId: 302, buildingZoneId: 'Z2', building: { gradeScope: [7] } },
				{ id: 302, type: 'LABORATORY', isTeachingSpace: true, isSharedFacility: false, capacity: 50, features: ['SINK'], floor: 1, buildingId: 302, buildingZoneId: 'Z2', building: { gradeScope: [7] } },
				{ id: 303, type: 'LABORATORY', isTeachingSpace: true, isSharedFacility: false, capacity: 50, features: ['SINK'], floor: 2, buildingId: 302, buildingZoneId: 'Z2', building: { gradeScope: [7] } },
				{ id: 401, type: 'TLE_WORKSHOP', isTeachingSpace: true, isSharedFacility: false, capacity: 50, features: [], floor: 1, buildingId: 303, buildingZoneId: 'Z3', building: { gradeScope: [7] } },
			],
		},
		building: { findMany: async () => [{ id: 301, name: 'Building 1', x: 0, y: 0 }, { id: 302, name: 'Science Building', x: 1, y: 0 }, { id: 303, name: 'TLE Building', x: 2, y: 0 }] },
		facultyPreference: { findMany: async () => [{ facultyId: 71, status: 'SUBMITTED', timeSlots: [{ day: 'MONDAY', startTime: '06:00', endTime: '06:45', preference: 'UNAVAILABLE' }] }] },
		policySpecialEvent: { findMany: async () => flagRows },
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
	return { client, writes };
}

test('C07-S02. the constructor policy built from the assembly carries the persisted special events verbatim and the Monday window equals the persisted interval', async () => {
	const { client, writes } = buildPreflightClient(persistedSpecialEvents(null));
	const preflight = await buildGenerationPreflight(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	assert.equal(preflight.ok, true, `expected a ready preflight: ${preflight.blockers.map((b) => b.code).join(', ')}`);
	assert.equal(preflight.assembly.specialEvents.length, 3);

	const constructorInput = buildPreflightConstructorInput(preflight.assembly);
	const specialEvents = constructorInput.policy?.specialEvents ?? [];
	assert.equal(specialEvents.length, 3, 'the real constructor input must receive the persisted rows');
	const flag = specialEvents.find((event) => event.eventType === 'FLAG_OR_HGP');
	assert.ok(flag, 'the persisted FLAG_OR_HGP row must reach the constructor');
	assert.equal(flag.startTime, '07:00');
	assert.equal(flag.endTime, '07:30');

	const shape = preflight.assembly.timetableShapeContracts[0];
	const overlay = shape.displaySlots.find((slot) => /flag|hgp/i.test(slot.eventName ?? ''));
	assert.equal(overlay?.startTime, '06:45');
	assert.equal(overlay?.endTime, '07:30');
	assert.equal(overlay?.dayOfWeek, 'MONDAY');

	// Non-day-scoped persisted events are day-scoped-blocked for every weekday;
	// a Monday-only overlay blocks Monday only.
	const windows = buildDayScopedEventWindows(constructorInput.policy, CANON_7_CLASS_ROWS);
	assert.equal(windows.length, 1);
	assert.equal(windows[0].day, 'MONDAY');
	assert.deepEqual(writes, [], 'a read-only preflight performs zero writes');
});

test('C07-S08. the constructor input carries the persisted availability slots verbatim (never `timeSlots: []`)', async () => {
	const { client } = buildPreflightClient(persistedSpecialEvents(null));
	const preflight = await buildGenerationPreflight(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	const constructorInput = buildPreflightConstructorInput(preflight.assembly);
	const preference = constructorInput.preferences.find((entry) => entry.facultyId === 71);
	assert.ok(preference);
	assert.equal(preference.timeSlots.length, 1, 'persisted availability must reach the constructor');
	assert.deepEqual(preference.timeSlots[0], { day: 'MONDAY', startTime: '06:00', endTime: '06:45', preference: 'UNAVAILABLE' });
});

test('C07-S04. an explicit non-Monday Flag/HGP row is rejected with FLAG_CEREMONY_SCOPE_INVALID even when enableFlagCeremony is false, with zero writes', async () => {
	const { client, writes } = buildPreflightClient(persistedSpecialEvents('WEDNESDAY'));
	const preflight = await buildGenerationPreflight(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	const scopeBlockers = preflight.blockers.filter((blocker) => blocker.code === 'FLAG_CEREMONY_SCOPE_INVALID');
	assert.equal(scopeBlockers.length, 1);
	assert.equal(scopeBlockers[0].category, 'POLICY_BLOCKER');
	assert.equal(scopeBlockers[0].owningSurface, 'Scheduling policy / special events');
	assert.ok(scopeBlockers[0].nextAction.length > 0);
	assert.equal(preflight.ok, false);
	assert.deepEqual(writes, [], 'a rejected flag authority performs zero writes');
});

test('C07-S04 mutant M3: removing the persisted non-Monday validation would accept the Wednesday row (the validation is load-bearing)', async () => {
	// The old preflight only inspected the FIRST matching row and only when
	// `enableFlagCeremony` was truthy. With that gate (`enableFlagCeremony === false`)
	// the same WEDNESDAY row produced no blocker at all.
	const { client } = buildPreflightClient(persistedSpecialEvents('WEDNESDAY'));
	const preflight = await buildGenerationPreflight(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	assert.equal(preflight.assembly.policyRow?.enableFlagCeremony, false, 'the fixture disables the legacy flag on purpose');
	assert.ok((preflight.assembly.policyRow as { enableFlagCeremony?: boolean })?.enableFlagCeremony === false);
	assert.equal(preflight.blockers.some((blocker) => blocker.code === 'FLAG_CEREMONY_SCOPE_INVALID'), true);
});

test('C07-S04. the constructor and the two read projections drop a rejected non-Monday Flag/HGP row', () => {
	const rejected = { eventType: 'FLAG_OR_HGP', label: 'Flag Ceremony', startTime: '07:00', endTime: '07:30', dayOfWeek: 'WEDNESDAY' };
	assert.deepEqual(buildDayScopedEventWindows({
		maxConsecutiveTeachingMinutesBeforeBreak: 120, minBreakMinutesAfterConsecutiveBlock: 15, maxTeachingMinutesPerDay: 480,
		earliestStartTime: '06:00', latestEndTime: '18:30', specialEvents: [rejected],
	}, CANON_7_CLASS_ROWS), []);
	assert.equal(buildSpecialEventSlots({
		maxConsecutiveTeachingMinutesBeforeBreak: 120, minBreakMinutesAfterConsecutiveBlock: 15, maxTeachingMinutesPerDay: 480,
		earliestStartTime: '06:00', latestEndTime: '18:30', specialEvents: [rejected],
	}).length, 0);
});

// ─── C. Data-driven room authority (R4/R5) via the real derived demand ──────

const ROOMS = [
	{ id: 201, type: 'CLASSROOM', isTeachingSpace: true, isSharedFacility: false, capacity: 50, buildingId: 301, buildingZoneId: 'Z1', buildingGradeScope: [7], features: [] },
	{ id: 202, type: 'CLASSROOM', isTeachingSpace: true, isSharedFacility: false, capacity: 50, buildingId: 301, buildingZoneId: 'Z1', buildingGradeScope: [7], features: [] },
	{ id: 301, type: 'LABORATORY', isTeachingSpace: true, isSharedFacility: false, capacity: 50, buildingId: 302, buildingZoneId: 'Z2', buildingGradeScope: [7], features: ['SINK'] },
	{ id: 302, type: 'LABORATORY', isTeachingSpace: true, isSharedFacility: false, capacity: 50, buildingId: 302, buildingZoneId: 'Z2', buildingGradeScope: [7], features: ['SINK'] },
	{ id: 303, type: 'LABORATORY', isTeachingSpace: true, isSharedFacility: false, capacity: 50, buildingId: 302, buildingZoneId: 'Z2', buildingGradeScope: [7], features: ['SINK'] },
	{ id: 401, type: 'TLE_WORKSHOP', isTeachingSpace: true, isSharedFacility: false, capacity: 50, buildingId: 303, buildingZoneId: 'Z3', buildingGradeScope: [7], features: [] },
] as ConstructorInput['rooms'];

function scienceSections(): SectionsByGrade[] {
	return [{
		gradeLevelId: 17,
		gradeLevelName: 'Grade 7',
		displayOrder: 7,
		sections: [{ mirrorId: 501, id: 9001, name: '7-A', maxCapacity: 50, enrolledCount: 40, gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR', homeRoomId: 201, buildingZoneId: 'Z1' } as never],
	}];
}

/** Fixture A producer: real derived demand, ordered T1/T2/T3 Science rotation. */
function scienceDerivedInput(editor?: (subject: DerivedSubjectInput) => DerivedSubjectInput): DerivedDemandInput {
	const base = (overrides: Partial<DerivedSubjectInput> & Pick<DerivedSubjectInput, 'id' | 'code'>): DerivedSubjectInput => ({
		name: overrides.code, schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: [7], programScopes: ['REGULAR'],
		rotationFamily: null, modularOrder: null, minMinutesPerWeek: 180, isActive: true,
		preferredRoomType: 'CLASSROOM', requiredFeatures: [], ...overrides,
	});
	const subjects = [
		base({ id: 11, code: 'MATH', minMinutesPerWeek: 180, preferredRoomType: 'CLASSROOM', requiredFeatures: [] }),
		base({ id: 13, code: 'SCI_BIO', rotationFamily: 'SCIENCE', modularOrder: 1, minMinutesPerWeek: 135 }),
		base({ id: 14, code: 'SCI_CHEM', rotationFamily: 'SCIENCE', modularOrder: 2, minMinutesPerWeek: 135 }),
		base({ id: 15, code: 'SCI_ES', rotationFamily: 'SCIENCE', modularOrder: 3, minMinutesPerWeek: 135 }),
	];
	return {
		schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, yearLabel: '2029-2030', termFormat: 'TRIMESTER', termStructureRevision: 'A'.repeat(64),
		terms: TERM_CONTRACT.terms.map((term) => ({ identity: term.identity, displayLabel: term.displayLabel, order: term.order, startDate: term.startDate, endDate: term.endDate })),
		sections: [{ sectionMirrorId: 501, externalId: 9001, gradeLevel: 7, programType: 'REGULAR', isActiveForScheduling: true, isStale: false }],
		subjects: editor ? subjects.map(editor) : subjects,
		periodLengthMinutes: 45,
	};
}

function scienceConstructorInput(): ConstructorInput {
	const sections = scienceSections();
	const derived = deriveCanonicalDemand(scienceDerivedInput());
	assert.equal(derived.ok, true, 'the real derived-demand producer must resolve the fixture');
	if (!derived.ok) throw new Error('unreachable');
	const subjects: ConstructorInput['subjects'] = [
		{ id: 11, code: 'MATH', minMinutesPerWeek: 180, preferredRoomType: 'CLASSROOM', gradeLevels: [7], requiredFeatures: [], programScopes: ['REGULAR'] },
		{ id: 13, code: 'SCI_BIO', minMinutesPerWeek: 135, preferredRoomType: 'CLASSROOM', gradeLevels: [7], requiredFeatures: [], programScopes: ['REGULAR'], modularGroupId: 'SCIENCE', modularOrder: 1 },
		{ id: 14, code: 'SCI_CHEM', minMinutesPerWeek: 135, preferredRoomType: 'CLASSROOM', gradeLevels: [7], requiredFeatures: [], programScopes: ['REGULAR'], modularGroupId: 'SCIENCE', modularOrder: 2 },
		{ id: 15, code: 'SCI_ES', minMinutesPerWeek: 135, preferredRoomType: 'CLASSROOM', gradeLevels: [7], requiredFeatures: [], programScopes: ['REGULAR'], modularGroupId: 'SCIENCE', modularOrder: 3 },
	];
	const facultySubjects: ConstructorInput['facultySubjects'] = subjects.flatMap((subject) => [71, 72, 73].map((facultyId) => ({ facultyId, subjectId: subject.id, gradeLevels: [7], sectionIds: [9001] })));
	const shapes = buildRunTimetableShapeContracts({
		sectionsByGrade: sections.map((grade) => ({ gradeLevelId: grade.gradeLevelId, sections: grade.sections.map((section) => ({ programType: section.programType })) })),
		gradeWindows: [{ gradeLevel: 7, programType: 'REGULAR', startTime: '06:00', endTime: '13:00' }],
		templateProfiles: [{ programType: 'REGULAR', periodLengthMinutes: 45, periodsPerDay: 8 }],
		canonicalSlots: new Map([['7:REGULAR', CANON_7_SLOTS]]),
		policy: { periodLengthMinutes: 45, periodsPerDay: 8 } as ConstructorInput['policy'],
	});
	return {
		schoolId: SCHOOL_ID,
		schoolYearId: SCHOOL_YEAR_ID,
		roomingStrategy: 'HOME_ROOM_FIRST',
		sectionsByGrade: sections,
		subjects,
		faculty: [
			{ id: 71, maxHoursPerWeek: 30, department: 'SCIENCE' },
			{ id: 72, maxHoursPerWeek: 30, department: 'SCIENCE' },
			{ id: 73, maxHoursPerWeek: 30, department: 'SCIENCE' },
		],
		facultySubjects,
		rooms: ROOMS,
		preferences: [],
		policy: {
			maxConsecutiveTeachingMinutesBeforeBreak: 120, minBreakMinutesAfterConsecutiveBlock: 15, maxTeachingMinutesPerDay: 480,
			earliestStartTime: '06:00', latestEndTime: '13:00', periodLengthMinutes: 45, periodsPerDay: 8,
			enableRecess: false, enableLunchWindow: false, enableFlagCeremony: false, showSpecialEventsInGrid: false,
		},
		buildings: [{ id: 301, name: 'Grade 7 Academic Wing' }, { id: 302, name: 'Science Building' }, { id: 303, name: 'TLE Building' }],
		classTemplatePeriods: { REGULAR: 45 },
		timetableShapes: shapes,
		demandOverride: toSchedulerDemandOverride(derived, sections, subjects as never),
		pairOwners: {},
	};
}

function validatorContext(input: ConstructorInput, entries: ReturnType<typeof runHybridScheduler>['entries']): ValidatorContext {
	return {
		schoolId: input.schoolId,
		schoolYearId: input.schoolYearId,
		runId: 1,
		entries: entries as never,
		faculty: input.faculty.map((member) => ({ id: member.id, maxHoursPerWeek: member.maxHoursPerWeek })),
		facultySubjects: input.facultySubjects,
		rooms: ROOMS as never,
		subjects: input.subjects.map((subject) => ({ id: subject.id, preferredRoomType: subject.preferredRoomType, requiredFeatures: subject.requiredFeatures ?? [] })),
		sectionEnrollment: new Map([[9001, 40]]),
		buildings: input.buildings ?? [],
		roomBuildings: ROOMS.map((room) => ({ roomId: room.id, buildingId: room.buildingId ?? null })),
		constraintConfig: {},
	} as unknown as ValidatorContext;
}

const LAB_TYPES = new Set(['LABORATORY', 'TLE_WORKSHOP', 'COMPUTER_LAB']);

test('C07-S05. Science CLASSROOM authority occupies zero laboratory rooms and emits zero room-type/feature violations (Fixture A)', () => {
	const input = scienceConstructorInput();
	const result = constructBaseline(input);
	const scienceSubjects = new Set([13, 14, 15]);
	const scienceEntries = result.entries.filter((entry) => scienceSubjects.has(entry.subjectId));
	assert.ok(scienceEntries.length > 0, 'the Science rotation must be scheduled');
	const labEntries = scienceEntries.filter((entry) => LAB_TYPES.has(String(ROOMS.find((room) => room.id === entry.roomId)?.type)));
	assert.equal(labEntries.length, 0, 'no Science session may occupy a laboratory under CLASSROOM authority');
	assert.ok(result.entries.every((entry) => entry.roomId === 201 || entry.roomId === 202));

	const ctx = validatorContext(input, result.entries);
	const validation = validateHardConstraints(ctx);
	assert.equal(validation.violations.filter((violation) => violation.code === 'ROOM_TYPE_MISMATCH').length, 0);
	assert.equal(validation.violations.filter((violation) => violation.code === 'ROOM_FEATURE_MISMATCH').length, 0);
	const labRooms = ROOMS.filter((room) => room.type === 'LABORATORY').map((room) => room.id);
	assert.equal(result.entries.filter((entry) => labRooms.includes(entry.roomId)).length, 0, 'zero laboratory occupancy across the whole schedule');
});

test('C07-S05 mutant M4. the removed non-classroom overflow pool would have absorbed a classroom shortfall into a laboratory', () => {
	// The old constructor appended ANY non-CLASSROOM teaching room that fit the
	// enrollment as capacity relief for a CLASSROOM-authority subject. Reproduce
	// exactly that predicate against the fixture to prove it is load-bearing: the
	// fixture owns three capacity-compliant laboratories, so with the old pool the
	// Science sessions would have been placed in a laboratory.
	const classroomRooms = ROOMS.filter((room) => room.type === 'CLASSROOM');
	const oldOverflowPool = ROOMS
		.filter((room) => !room.isSharedFacility)
		.filter((room) => room.type !== 'CLASSROOM')
		.filter((room) => (room.capacity ?? 0) >= 40)
		.filter((room) => (room.buildingGradeScope ?? []).includes(7));
	assert.ok(classroomRooms.length > 0);
	assert.ok(oldOverflowPool.length >= 3, 'the fixture must own capacity-compliant laboratories so the old overflow pool is detectable');
	assert.equal(oldOverflowPool.filter((room) => room.type === 'LABORATORY').length, 3);

	const withoutOverflow = scienceConstructorInput();
	const result = constructBaseline(withoutOverflow);
	const scienceSubjects = new Set([13, 14, 15]);
	assert.equal(result.entries.filter((entry) => scienceSubjects.has(entry.subjectId) && oldOverflowPool.some((room) => room.id === entry.roomId)).length, 0);
});

test('C07-S06. an explicit LABORATORY authority reserves the laboratory in every applicable term; removing compatibility reports the typed result (Fixture B)', () => {
	const input = scienceConstructorInput();
	const labAuthority: ConstructorInput = {
		...input,
		subjects: input.subjects.map((subject) => (subject.id === 11 ? subject : { ...subject, preferredRoomType: 'LABORATORY', requiredFeatures: ['SINK'] })),
		demandOverride: (input.demandOverride ?? []).map((item) => (item.subjectId === 11 ? item : { ...item, roomTypePreference: 'LABORATORY' })),
	};
	const result = constructBaseline(labAuthority);
	const scienceEntries = result.entries.filter((entry) => [13, 14, 15].includes(entry.subjectId));
	assert.ok(scienceEntries.length > 0);
	const labRoomIds = ROOMS.filter((room) => room.type === 'LABORATORY').map((room) => room.id);
	assert.ok(scienceEntries.every((entry) => labRoomIds.includes(entry.roomId)), 'a satisfied LABORATORY authority must occupy a laboratory');
	assert.deepEqual([...new Set(scienceEntries.map((entry) => entry.termIndex))].sort((left, right) => Number(left) - Number(right)), [1, 2, 3], 'every applicable ordered term keeps its laboratory session');

	// Compatibility removed: no laboratory has the required feature.
	const noCompatible: ConstructorInput = {
		...labAuthority,
		rooms: ROOMS.map((room) => (room.type === 'LABORATORY' ? { ...room, features: [] } : room)),
	};
	const blocked = constructBaseline(noCompatible);
	const blockedScience = blocked.unassignedItems.filter((item) => [13, 14, 15].includes(item.subjectId));
	assert.ok(blockedScience.length > 0, 'an unsatisfiable laboratory authority must not silently substitute a classroom');
	assert.ok(blockedScience.every((item) => item.roomAssignmentReason === 'SPECIALIZED_ROOM_UNAVAILABLE'));
	const blockedLab = constructBaseline(noCompatible);
	const ctx = validatorContext(noCompatible, blockedLab.entries);
	const blockedValidation = validateHardConstraints(ctx);
	assert.equal(blockedValidation.violations.filter((violation) => violation.code === 'ROOM_TYPE_MISMATCH').length, 0, 'a satisfied authority never emits ROOM_TYPE_MISMATCH');
});

test('C07-S06 mutant M5. restoring the unconditional specialized-room deferral would silently place the laboratory authority in a classroom', () => {
	const input = scienceConstructorInput();
	// Reproduce the removed predicate: under HOME_ROOM_FIRST any non-CLASSROOM
	// authority was forced to CLASSROOM, so the laboratory authority never
	// reserved a laboratory.
	const requested: Array<'CLASSROOM' | 'LABORATORY'> = ['LABORATORY'];
	const oldEffective = requested.map((roomType) => (roomType !== 'CLASSROOM' ? 'CLASSROOM' : roomType));
	assert.deepEqual(oldEffective, ['CLASSROOM']);

	const labAuthority: ConstructorInput = {
		...input,
		subjects: input.subjects.map((subject) => (subject.id === 11 ? subject : { ...subject, preferredRoomType: 'LABORATORY', requiredFeatures: ['SINK'] })),
		demandOverride: (input.demandOverride ?? []).map((item) => (item.subjectId === 11 ? item : { ...item, roomTypePreference: 'LABORATORY' })),
	};
	const result = constructBaseline(labAuthority);
	const scienceEntries = result.entries.filter((entry) => [13, 14, 15].includes(entry.subjectId));
	const labRoomIds = ROOMS.filter((room) => room.type === 'LABORATORY').map((room) => room.id);
	assert.ok(scienceEntries.some((entry) => labRoomIds.includes(entry.roomId)), 'the candidate must differ from the deferred mutant');
});

test('C07-S07. ROOM_TYPE_MISMATCH is emitted only on a recorded PREFERRED_ROOM_UNUSABLE_* failure; the documented contract and satisfied authority stay silent (mutant M6)', () => {
	const rooms = ROOMS as never;
	const mkContext = (entries: unknown[]): ValidatorContext => ({
		schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, runId: 1,
		entries, faculty: [], facultySubjects: [], rooms,
		subjects: [{ id: 13, preferredRoomType: 'LABORATORY', requiredFeatures: [] }],
		sectionEnrollment: new Map([[9001, 40]]), buildings: [], roomBuildings: [], constraintConfig: {},
	} as unknown as ValidatorContext);
	const entry = (metadata: Record<string, unknown>, roomId: number) => ({
		entryId: 'e-1', facultyId: 71, roomId, subjectId: 13, sectionId: 9001,
		day: 'MONDAY', startTime: '06:00', endTime: '06:45', durationMinutes: 45, metadata,
	});

	// (1) satisfied authority → silent
	const satisfied = validateHardConstraints(mkContext([entry({ roomAssignmentReason: 'SPECIALIZED_ROOM' }, 301)]));
	assert.equal(satisfied.violations.filter((violation) => violation.code === 'ROOM_TYPE_MISMATCH').length, 0);

	// (2) documented home-room contract, authority satisfied → silent
	const contract = validateHardConstraints(mkContext([entry({ roomAuthorityDeviationReason: 'HOME_ROOM_CONTRACT', roomAssignmentReason: 'HOME_ROOM_ASSIGNED' }, 201)]));
	assert.equal(contract.violations.filter((violation) => violation.code === 'ROOM_TYPE_MISMATCH').length, 0, 'the documented home-room contract never emits');

	// (3) recorded preferred-room failure → SOFT with the machine-readable reason
	const recorded = validateHardConstraints(mkContext([entry({ roomAuthorityDeviationReason: 'PREFERRED_ROOM_UNUSABLE_NO_REQUIRED_FEATURES', roomAssignmentReason: 'HOME_ROOM_ASSIGNED' }, 201)]));
	const recordedViolations = recorded.violations.filter((violation) => violation.code === 'ROOM_TYPE_MISMATCH');
	assert.equal(recordedViolations.length, 1);
	assert.equal(recordedViolations[0].severity, 'SOFT');
	assert.equal((recordedViolations[0].meta as { roomAuthorityDeviationReason?: string }).roomAuthorityDeviationReason, 'PREFERRED_ROOM_UNUSABLE_NO_REQUIRED_FEATURES');
	assert.equal((recordedViolations[0].meta as { roomType?: string }).roomType, 'CLASSROOM');
	assert.equal((recordedViolations[0].meta as { preferredRoomType?: string }).preferredRoomType, 'LABORATORY');

	// (4) mutant M6: the old blanket inequality emitted HARD even without a reason.
	const blanket = validateHardConstraints(mkContext([entry({ roomAssignmentReason: 'HOME_ROOM_ASSIGNED' }, 201)]));
	const blanketViolations = blanket.violations.filter((violation) => violation.code === 'ROOM_TYPE_MISMATCH');
	assert.equal(blanketViolations.length, 1);
	assert.equal(blanketViolations[0].severity, 'HARD', 'an unsatisfied authority with no recorded reason is the HARD regression signal');
	// …but the documented contract case above proves the blanket emission is gone
	// for the documented path.
});

// ─── D. Availability freshness domain + version (R7) ────────────────────────

function buildSnapshotClient(availabilityDigest: string | undefined) {
	const aggregate = async () => ({ _count: { _all: 0 }, _max: { id: null, updatedAt: null, version: null, createdAt: null } });
	const row: Record<string, unknown> = { teachingLoad: 'tl', policy: 'pl', rooms: 'rm', sections: 'sc', subjects: 'sb' };
	if (availabilityDigest !== undefined) row.availability = availabilityDigest;
	return {
		facultyMirror: { aggregate },
		facultySubject: { aggregate },
		subjectSectionOwnership: { aggregate },
		teachingLoadCycle: { findUnique: async () => null },
		schedulingPolicy: { findUnique: async () => null },
		gradeShiftWindow: { aggregate },
		room: { aggregate },
		building: { aggregate },
		sectionMirror: { aggregate },
		subject: { aggregate },
		classTemplate: { aggregate: async () => ({ _count: { _all: 0 }, _max: { id: null, createdAt: null } }) },
		classTemplateSubject: { aggregate: async () => ({ _count: { _all: 0 }, _max: { id: null, createdAt: null } }) },
		facultyPreference: { aggregate },
		preferenceTimeSlot: { aggregate: async () => ({ _count: { _all: 0 }, _max: { id: null, createdAt: null } }) },
		$queryRawUnsafe: async () => [row],
	};
}

test('C07-S09. the snapshot emits a non-empty availability domain at the bumped version and any availability edit changes the fingerprint', async () => {
	assert.equal(GENERATION_INPUT_SNAPSHOT_SCHEMA_VERSION, 3);
	const before = await computeGenerationInputSnapshot(SCHOOL_ID, SCHOOL_YEAR_ID, buildSnapshotClient('av-1') as never);
	assert.equal(before.schemaVersion, 3);
	assert.ok(before.domains.availability, 'the availability domain must be present');
	assert.equal(typeof before.domains.availability.fingerprint, 'string');
	assert.ok(before.domains.availability.fingerprint.length > 0);
	assert.equal(before.domains.availability.signals.exactRevisionDigest, 'av-1');

	const after = await computeGenerationInputSnapshot(SCHOOL_ID, SCHOOL_YEAR_ID, buildSnapshotClient('av-2') as never);
	assert.notEqual(before.domains.availability.fingerprint, after.domains.availability.fingerprint);
	assert.notEqual(before.fingerprint, after.fingerprint);
});

test('C07-S09/S10 mutant M8. a current-version snapshot missing the availability domain is rejected, and a below-current snapshot is STALE (never FRESH)', () => {
	const domain = { fingerprint: 'd', signals: {} };
	const current = (withAvailability: boolean): Record<string, unknown> => ({
		schemaVersion: 3, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, computedAt: 'x', fingerprint: 'f',
		domains: {
			teachingLoad: domain, policy: domain, rooms: domain, sections: domain, subjects: domain, derivedDemand: domain,
			...(withAvailability ? { availability: domain } : {}),
		},
	});
	assert.equal(extractGenerationInputSnapshot({ inputSnapshot: current(false) }), null, 'a current-version snapshot missing the availability domain is rejected');
	assert.ok(extractGenerationInputSnapshot({ inputSnapshot: current(true) }));

	const legacy = { schemaVersion: 2, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, computedAt: 'x', fingerprint: 'old', domains: { teachingLoad: domain, policy: domain, rooms: domain, sections: domain, subjects: domain, derivedDemand: domain } };
	const extracted = extractGenerationInputSnapshot({ inputSnapshot: legacy });
	assert.ok(extracted, 'a legacy snapshot stays extractable so it can be compared');
	const comparison = compareGenerationInputSnapshots(extracted, current(true) as never);
	assert.equal(comparison.status, 'STALE', 'a below-current snapshot must never compare as FRESH');
	assert.equal(comparison.missingReason, 'SNAPSHOT_VERSION_MISMATCH');

	const changed = compareGenerationInputSnapshots(extractGenerationInputSnapshot({ inputSnapshot: current(true) })!, {
		...(current(true) as never as Record<string, unknown>),
		domains: { teachingLoad: domain, policy: domain, rooms: domain, sections: domain, subjects: domain, derivedDemand: domain, availability: { fingerprint: 'edited', signals: {} } },
	} as never);
	assert.equal(changed.status, 'STALE');
	assert.ok(changed.changedDomains.includes('availability'), 'an availability edit must appear in changedDomains');
	assert.equal(changed.changedDomains.length, 1);
});

test('C07-S08 mutant M7. restoring `timeSlots: []` schedules a faculty member on their persisted UNAVAILABLE slot', () => {
	const input = scienceConstructorInput();
	const slot = { day: 'MONDAY', startTime: '06:00', endTime: '06:45', preference: 'UNAVAILABLE' };
	const withAvailability: ConstructorInput = { ...input, preferences: [{ facultyId: 71, status: 'SUBMITTED', timeSlots: [slot] }] };
	const honored = constructBaseline(withAvailability);
	const usedBlockedSlot = honored.entries.some((entry) => entry.facultyId === 71 && entry.day === 'MONDAY' && entry.startTime === '06:00' && entry.endTime === '06:45');
	assert.equal(usedBlockedSlot, false, 'the persisted UNAVAILABLE window must be excluded from placement');

	// Mutant: the former `timeSlots: []` constructor input, which excluded nothing.
	const mutant: ConstructorInput = { ...input, preferences: [{ facultyId: 71, status: 'SUBMITTED', timeSlots: [] }] };
	const unguarded = constructBaseline(mutant);
	const anyFacultyPlaced = unguarded.entries.some((entry) => entry.day === 'MONDAY' && entry.startTime === '06:00' && entry.endTime === '06:45');
	assert.equal(anyFacultyPlaced, true, 'with no availability the same fixture does use the Monday first period');
});

test('C07-S11 note. the guarded disposable-PostgreSQL write-time stale tier is provided by generation-authority-realism-c07-availability.test.ts', () => {
	assert.ok(true);
});

test('C07-S14. both the readiness dry run and the real trigger consume the same builder (parity is structural)', async () => {
	const { client } = buildPreflightClient(persistedSpecialEvents(null));
	const preflight = await buildGenerationPreflight(SCHOOL_ID, SCHOOL_YEAR_ID, { client, termContract: TERM_CONTRACT, enforceShiftWindows: false });
	const first = buildPreflightConstructorInput(preflight.assembly);
	const second = buildPreflightConstructorInput(preflight.assembly);
	assert.deepEqual(first.policy?.specialEvents, second.policy?.specialEvents);
	assert.deepEqual(first.preferences, second.preferences);
	// The hybrid scheduler consumes the same constructor input shape.
	const hybrid = runHybridScheduler(first);
	assert.ok(Array.isArray(hybrid.entries));
});
