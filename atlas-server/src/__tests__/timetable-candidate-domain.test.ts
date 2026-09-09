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
import { computeDemand, evaluateConstructorCandidateInvariants } from '../services/schedule-constructor.js';
import { evaluateInsertionCandidateInvariants } from '../services/timetable-insertion.service.js';
import { evaluateQuickPlaceCandidate, evaluateQuickPlaceCandidateAgainstEntries } from '../services/timetable-quick-place.service.js';

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

test('manual/repair validator hard-rejects capacity and different-start resource overlaps', () => {
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
	for (const code of ['FACULTY_TIME_CONFLICT', 'SECTION_TIME_CONFLICT', 'ROOM_TIME_CONFLICT', 'ROOM_CAPACITY_EXCEEDED']) {
		assert.ok(validation.violations.some((violation) => violation.code === code && violation.severity === 'HARD'), code);
	}
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
