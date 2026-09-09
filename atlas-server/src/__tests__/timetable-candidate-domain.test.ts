import assert from 'node:assert/strict';
import test from 'node:test';

import {
	evaluateCandidateInvariants,
	intervalsOverlap,
	isHomeroomGuidanceCandidate,
	isRoomInTeachingScope,
	isValidCandidateIdentity,
	isValidCandidateInterval,
	roomCanFitEnrollment,
} from '../services/timetable-candidate-domain.js';
import { evaluateManualCandidateInvariants, validateHardConstraints, type ScheduledEntry } from '../services/constraint-validator.js';
import { computeDemand, constructBaseline, evaluateConstructorCandidateInvariants, type ConstructorInput } from '../services/schedule-constructor.js';
import { evaluateInsertionCandidateInvariants } from '../services/timetable-insertion.service.js';
import { evaluateQuickPlaceCandidate, evaluateQuickPlaceCandidateAgainstEntries, solveQuickPlace } from '../services/timetable-quick-place.service.js';
import { previewManualEdit, validateManualCandidateInvariants } from '../services/manual-edit.service.js';

const baseCandidate = {
	facultyId: 11,
	sectionId: 22,
	roomId: 33,
	day: 'MONDAY',
	startTime: '08:00',
	endTime: '08:45',
	subjectCode: 'MATH',
	enrolledCount: 35,
	room: {
		id: 33,
		type: 'CLASSROOM',
		capacity: 35,
		isTeachingSpace: true,
		isSharedFacility: false,
		buildingGradeScope: [7],
	},
	gradeLevel: 7,
	allowedRoomTypes: ['CLASSROOM'],
};

test('shared candidate exports agree across constructor, manual validation, and insertion preview', () => {
	const accepted = [
		evaluateCandidateInvariants(baseCandidate),
		evaluateConstructorCandidateInvariants(baseCandidate),
		evaluateManualCandidateInvariants(baseCandidate),
		evaluateInsertionCandidateInvariants(baseCandidate),
		evaluateQuickPlaceCandidate(baseCandidate),
	];
	assert.deepEqual(accepted, [accepted[0], accepted[0], accepted[0], accepted[0], accepted[0]]);
	assert.equal(accepted[0].accepted, true);

	const rejected = { ...baseCandidate, enrolledCount: 36 };
	const results = [
		evaluateCandidateInvariants(rejected),
		evaluateConstructorCandidateInvariants(rejected),
		evaluateManualCandidateInvariants(rejected),
		evaluateInsertionCandidateInvariants(rejected),
		evaluateQuickPlaceCandidate(rejected),
	];
	assert.deepEqual(results, [results[0], results[0], results[0], results[0], results[0]]);
	assert.deepEqual(results[0].reasons, ['ROOM_CAPACITY_EXCEEDED']);
});

test('capacity uses exact persisted enrollment boundary', () => {
	assert.equal(roomCanFitEnrollment(34, 35), false);
	assert.equal(roomCanFitEnrollment(35, 35), true);
});

test('half-open overlaps reject different starts but allow boundary touching', () => {
	assert.equal(intervalsOverlap(
		{ day: 'MONDAY', startTime: '08:00', endTime: '08:45' },
		{ day: 'MONDAY', startTime: '08:30', endTime: '09:15' },
	), true);
	assert.equal(intervalsOverlap(
		{ day: 'MONDAY', startTime: '08:00', endTime: '08:45' },
		{ day: 'MONDAY', startTime: '08:45', endTime: '09:30' },
	), false);
	assert.equal(intervalsOverlap(
		{ day: 'MONDAY', startTime: '08:00', endTime: '08:45' },
		{ day: 'TUESDAY', startTime: '08:30', endTime: '09:15' },
	), false);

	for (const resource of ['facultyId', 'sectionId', 'roomId'] as const) {
		const occupied = [{ ...baseCandidate, startTime: '08:30', endTime: '09:15' }];
		const verdict = evaluateCandidateInvariants({ ...baseCandidate, occupied }, { occupancyResources: [resource] });
		assert.equal(verdict.accepted, false, `${resource} overlap must reject`);
		assert.ok(verdict.reasons.includes(resource === 'facultyId' ? 'FACULTY_TIME_CONFLICT' : resource === 'sectionId' ? 'SECTION_TIME_CONFLICT' : 'ROOM_TIME_CONFLICT'));
	}
});

test('room teaching scope, type compatibility, and HG exclusion are invariant', () => {
	assert.equal(isRoomInTeachingScope(baseCandidate.room, 7), true);
	assert.equal(isRoomInTeachingScope({ ...baseCandidate.room, buildingGradeScope: [8] }, 7), false);
	assert.equal(isRoomInTeachingScope({ ...baseCandidate.room, isTeachingSpace: false }, 7), false);
	assert.equal(isRoomInTeachingScope({ ...baseCandidate.room, isSharedFacility: true }, 7), false);
	assert.equal(evaluateCandidateInvariants({ ...baseCandidate, room: { ...baseCandidate.room, type: 'LABORATORY' } }).accepted, false);
	assert.equal(isHomeroomGuidanceCandidate(' hg '), true);
	assert.deepEqual(evaluateCandidateInvariants({ ...baseCandidate, subjectCode: 'HG' }).reasons, ['HG_FORBIDDEN']);
});

test('positive identifiers and valid day/time interval shape fail closed', () => {
	assert.equal(isValidCandidateIdentity(1), true);
	assert.equal(isValidCandidateIdentity(0), false);
	assert.equal(isValidCandidateIdentity(1.5), false);
	assert.equal(isValidCandidateInterval({ day: 'MONDAY', startTime: '08:00', endTime: '08:45' }), true);
	assert.equal(isValidCandidateInterval({ day: '', startTime: '08:00', endTime: '08:45' }), false);
	assert.equal(isValidCandidateInterval({ day: 'MONDAY', startTime: '08:45', endTime: '08:45' }), false);
	assert.equal(isValidCandidateInterval({ day: 'MONDAY', startTime: 'bad', endTime: '08:45' }), false);
});

test('canonical constructor excludes HG before producing demand lines', () => {
	const demand = computeDemand(
		[{
			gradeLevelId: 7,
			gradeLevelName: 'Grade 7',
			displayOrder: 7,
			sections: [{
				id: 22,
				name: '7-Test',
				maxCapacity: 40,
				enrolledCount: 35,
				gradeLevelId: 7,
				gradeLevelName: 'Grade 7',
				displayOrder: 7,
				programType: 'REGULAR',
			}],
		}],
		[{
			id: 1,
			code: 'HG',
			minMinutesPerWeek: 60,
			preferredRoomType: 'CLASSROOM',
			gradeLevels: [7],
		}],
	);
	assert.deepEqual(demand, []);
});

test('persisted reporting keeps capacity soft while resource overlaps remain hard', () => {
	const entry = (overrides: Partial<ScheduledEntry>): ScheduledEntry => ({
		entryId: 'entry-a',
		facultyId: 11,
		roomId: 33,
		subjectId: 44,
		sectionId: 22,
		day: 'MONDAY',
		startTime: '08:00',
		endTime: '08:45',
		durationMinutes: 45,
		...overrides,
	});
	const entries = [
		entry({}),
		entry({ entryId: 'entry-b', startTime: '08:30', endTime: '09:15' }),
	];
	const validation = validateHardConstraints({
		schoolId: 1,
		schoolYearId: 2,
		runId: 3,
		entries,
		faculty: [{ id: 11, maxHoursPerWeek: 40 }],
		facultySubjects: [{ facultyId: 11, subjectId: 44, sectionIds: [22] }],
		rooms: [{ id: 33, type: 'CLASSROOM', capacity: 34 }],
		subjects: [{ id: 44, preferredRoomType: 'CLASSROOM' }],
		sectionEnrollment: new Map([[22, 35]]),
	});
	for (const code of ['FACULTY_TIME_CONFLICT', 'SECTION_TIME_CONFLICT', 'ROOM_TIME_CONFLICT']) {
		assert.ok(validation.violations.some((violation) => violation.code === code && violation.severity === 'HARD'), code);
	}
	assert.ok(validation.violations.some((violation) => violation.code === 'ROOM_CAPACITY_EXCEEDED' && violation.severity === 'SOFT'));
});

test('quick-place production gate consumes persisted scope and current occupancy without writes', () => {
	const occupied: ScheduledEntry[] = [{
		entryId: 'occupied',
		facultyId: baseCandidate.facultyId,
		roomId: 99,
		subjectId: 44,
		sectionId: 88,
		day: 'MONDAY',
		startTime: '08:30',
		endTime: '09:15',
		durationMinutes: 45,
	}];
	const before = structuredClone(occupied);
	const overlap = evaluateQuickPlaceCandidateAgainstEntries(baseCandidate, occupied);
	assert.ok(overlap.reasons.includes('FACULTY_TIME_CONFLICT'));
	assert.deepEqual(occupied, before, 'candidate evaluation must not mutate schedule state');

	const sharedRoom = evaluateQuickPlaceCandidateAgainstEntries({
		...baseCandidate,
		room: { ...baseCandidate.room, isSharedFacility: true },
	}, []);
	assert.ok(sharedRoom.reasons.includes('NON_TEACHING_ROOM'));

	const wrongGrade = evaluateQuickPlaceCandidateAgainstEntries({
		...baseCandidate,
		room: { ...baseCandidate.room, buildingGradeScope: [8] },
	}, []);
	assert.ok(wrongGrade.reasons.includes('ROOM_SCOPE_MISMATCH'));
});

test('constructBaseline preserves the authorized capacity overflow bypass and soft reporting', () => {
	const input: ConstructorInput = {
		schoolId: 1,
		schoolYearId: 2,
		roomingStrategy: 'HOME_ROOM_FIRST',
		sectionsByGrade: [{
			gradeLevelId: 9,
			gradeLevelName: 'Grade 9',
			displayOrder: 9,
			sections: [{
				id: 22,
				name: '9-Test',
				maxCapacity: 40,
				enrolledCount: 35,
				gradeLevelId: 9,
				gradeLevelName: 'Grade 9',
				displayOrder: 9,
				homeRoomId: 33,
				programType: 'REGULAR',
			}],
		}],
		subjects: [{ id: 44, code: 'MATH', minMinutesPerWeek: 45, preferredRoomType: 'CLASSROOM', gradeLevels: [9] }],
		faculty: [{ id: 11, maxHoursPerWeek: 40 }],
		facultySubjects: [{ facultyId: 11, subjectId: 44, gradeLevels: [9], sectionIds: [22] }],
		rooms: [{ id: 33, type: 'CLASSROOM', isTeachingSpace: true, capacity: 34 }],
		preferences: [],
	};
	const result = constructBaseline(input);
	assert.equal(result.entries.length, 1);
	assert.equal(result.entries[0].roomId, 33);
	assert.equal(result.entries[0].metadata?.capacityOverflowBypass, true);
	const reporting = validateHardConstraints({
		schoolId: 1,
		schoolYearId: 2,
		runId: 3,
		entries: result.entries,
		faculty: [{ id: 11, maxHoursPerWeek: 40 }],
		facultySubjects: [{ facultyId: 11, subjectId: 44, sectionIds: [22] }],
		rooms: [{ id: 33, type: 'CLASSROOM', capacity: 34 }],
		subjects: [{ id: 44, preferredRoomType: 'CLASSROOM' }],
		sectionEnrollment: new Map([[22, 35]]),
	});
	assert.ok(reporting.violations.some((violation) => violation.code === 'ROOM_CAPACITY_EXCEEDED' && violation.severity === 'SOFT'));
	assert.equal(reporting.violations.some((violation) => violation.code === 'ROOM_CAPACITY_EXCEEDED' && violation.severity === 'HARD'), false);
});

test('real manual candidate validation blocks persisted room, HG, capacity, and overlap invariants', () => {
	const candidate: ScheduledEntry = {
		entryId: 'manual-new', facultyId: 11, roomId: 33, subjectId: 44, sectionId: 22,
		day: 'MONDAY', startTime: '08:00', endTime: '08:45', durationMinutes: 45,
	};
	const baseRef = {
		rooms: [{
			id: 33, type: 'CLASSROOM' as const, isTeachingSpace: true, isSharedFacility: false,
			capacity: 35, buildingId: 1, buildingGradeScope: [7], building: { gradeScope: [7] },
		}],
		subjects: [{ id: 44, code: 'MATH', minMinutesPerWeek: 45, preferredRoomType: 'CLASSROOM' as const, gradeLevels: [7] }],
		sectionEnrollment: new Map([[22, 35]]),
		sectionGradeLevel: new Map([[22, 7]]),
	};
	const scope = { schoolId: 1, schoolYearId: 2, runId: 3 };
	assert.deepEqual(validateManualCandidateInvariants(candidate, [candidate], baseRef, scope), []);

	const cases = [
		{ ref: { ...baseRef, rooms: [{ ...baseRef.rooms[0], isSharedFacility: true }] }, reason: 'NON_TEACHING_ROOM' },
		{ ref: { ...baseRef, rooms: [{ ...baseRef.rooms[0], isTeachingSpace: false }] }, reason: 'NON_TEACHING_ROOM' },
		{ ref: { ...baseRef, rooms: [{ ...baseRef.rooms[0], buildingGradeScope: [8] }] }, reason: 'ROOM_SCOPE_MISMATCH' },
		{ ref: { ...baseRef, rooms: [{ ...baseRef.rooms[0], capacity: 34 }] }, reason: 'ROOM_CAPACITY_EXCEEDED' },
		{ ref: { ...baseRef, subjects: [{ ...baseRef.subjects[0], code: 'HG' }] }, reason: 'HG_FORBIDDEN' },
	];
	for (const { ref, reason } of cases) {
		const violations = validateManualCandidateInvariants(candidate, [candidate], ref, scope);
		assert.ok(violations.some((violation) => violation.meta?.candidateInvariant === reason), reason);
	}

	const blockingEntry: ScheduledEntry = {
		...candidate,
		entryId: 'existing',
		startTime: '08:30',
		endTime: '09:15',
	};
	const overlapViolations = validateManualCandidateInvariants(candidate, [blockingEntry, candidate], baseRef, scope);
	for (const reason of ['FACULTY_TIME_CONFLICT', 'SECTION_TIME_CONFLICT', 'ROOM_TIME_CONFLICT']) {
		assert.ok(overlapViolations.some((violation) => violation.meta?.candidateInvariant === reason), reason);
	}
});

function productionRefData(overrides: Record<string, unknown> = {}) {
	const room = {
		id: 33, type: 'CLASSROOM', isTeachingSpace: true, isSharedFacility: false,
		capacity: 35, buildingId: 1, buildingGradeScope: [7], building: { gradeScope: [7] },
	};
	const subject = { id: 44, code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 45, preferredRoomType: 'CLASSROOM', gradeLevels: [7] };
	return {
		run: {
			id: 3, schoolId: 1, schoolYearId: 2, status: 'COMPLETED', runType: 'FULL', version: 1,
			summary: { timetableDisplaySlots: [{ startTime: '08:00', endTime: '08:45' }] },
			draftEntries: [] as unknown[], unassignedItems: [] as unknown[], violations: [], createdAt: new Date(), finishedAt: new Date(),
		},
		entries: [] as ScheduledEntry[],
		unassignedItems: [{ sectionId: 22, subjectId: 44, gradeLevel: 7, session: 1, reason: 'NO_AVAILABLE_SLOT', facultyId: 11, homeRoomId: 33 }],
		faculty: [{ id: 11, maxHoursPerWeek: 40 }],
		facultySubjects: [{ facultyId: 11, subjectId: 44, gradeLevels: [7], sectionIds: [22] }],
		rooms: [room], subjects: [subject],
		policyRecord: {
			maxConsecutiveTeachingMinutesBeforeBreak: 180, minBreakMinutesAfterConsecutiveBlock: 15,
			maxTeachingMinutesPerDay: 480, earliestStartTime: '07:00', latestEndTime: '17:00',
			enforceConsecutiveBreakAsHard: false, enableTravelWellbeingChecks: false,
			maxWalkingDistanceMetersPerTransition: 500, maxBuildingTransitionsPerDay: 10,
			maxBackToBackTransitionsWithoutBuffer: 10, maxIdleGapMinutesPerDay: 480,
			avoidEarlyFirstPeriod: false, avoidLateLastPeriod: false,
			enableVacantAwareConstraints: false, targetFacultyDailyVacantMinutes: 0,
			targetSectionDailyVacantPeriods: 0, maxCompressedTeachingMinutesPerDay: 480,
			constraintConfig: {},
		},
		buildings: [{ id: 1, x: 0, y: 0 }],
		facultyNameMap: new Map([[11, 'Teacher']]), roomNameMap: new Map([[33, 'Room']]),
		subjectNameMap: new Map([[44, 'MATH']]), subjectNameDetailMap: new Map([[44, 'Mathematics']]),
		sectionEnrollment: new Map([[22, 35]]), sectionGradeLevel: new Map([[22, 7]]),
		...overrides,
	};
}

test('previewManualEdit production entry rejects shared-domain invariant failures', async () => {
	const proposal = {
		editType: 'PLACE_UNASSIGNED' as const,
		sectionId: 22, subjectId: 44, session: 1,
		targetDay: 'MONDAY', targetStartTime: '08:00', targetEndTime: '08:45',
		targetRoomId: 33, targetFacultyId: 11,
	};
	const cases = [
		productionRefData({ rooms: [{ ...productionRefData().rooms[0], isSharedFacility: true }] }),
		productionRefData({ rooms: [{ ...productionRefData().rooms[0], isTeachingSpace: false }] }),
		productionRefData({ rooms: [{ ...productionRefData().rooms[0], buildingGradeScope: [8] }] }),
		productionRefData({ rooms: [{ ...productionRefData().rooms[0], capacity: 34 }] }),
		productionRefData({ subjects: [{ ...productionRefData().subjects[0], code: 'HG' }] }),
		productionRefData({ entries: [{
			entryId: 'existing', facultyId: 11, roomId: 33, subjectId: 44, sectionId: 22,
			day: 'MONDAY', startTime: '08:30', endTime: '09:15', durationMinutes: 45,
		}] }),
	];
	for (const refData of cases) {
		const preview = await previewManualEdit(3, 1, 2, proposal, { loadRunContext: async () => refData as never });
		assert.equal(preview.allowed, false);
		assert.ok(preview.hardViolations.some((violation) => violation.meta?.candidateInvariant));
	}
});

test('solveQuickPlace production entry applies shared scope without writes and keeps deterministic order', async () => {
	const refData = productionRefData();
	refData.run.unassignedItems = refData.unassignedItems;
	let writeAttempts = 0;
	const failWrite = () => { writeAttempts += 1; throw new Error('unexpected write'); };
	const dataAccess = {
		subjectSectionOwnership: { findMany: async () => [{ subjectId: 44, sectionId: 22, facultyId: 11 }], create: failWrite, update: failWrite, delete: failWrite },
		sectionSnapshot: { findUnique: async () => ({ payload: [{ displayOrder: 7, sections: [{ id: 22, name: '7-Test' }] }] }), create: failWrite, update: failWrite, delete: failWrite },
	} as never;
	const dependencies = { loadRunContext: async () => refData as never, prisma: dataAccess };
	const first = await solveQuickPlace(3, 1, 2, dependencies);
	const second = await solveQuickPlace(3, 1, 2, dependencies);
	assert.equal(first.placed.length, 1);
	assert.deepEqual(first.placed, second.placed);
	assert.equal(writeAttempts, 0);

	const blockedRef = productionRefData({ rooms: [{ ...refData.rooms[0], isSharedFacility: true }] });
	blockedRef.run.unassignedItems = blockedRef.unassignedItems;
	const blocked = await solveQuickPlace(3, 1, 2, { loadRunContext: async () => blockedRef as never, prisma: dataAccess });
	assert.equal(blocked.placed.length, 0);
	assert.equal(blocked.unplaced.length, 1);
	assert.equal(writeAttempts, 0);
});
