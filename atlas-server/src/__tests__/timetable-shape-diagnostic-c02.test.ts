/** TT-SHAPE-DIAGNOSTIC-C02 — failing-first policy and stakeholder-shape mutants. */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
	validateOrderedTermAuthority,
	validateOutputShapeParity,
	validateTermTeacherResolution,
	validateTimetableShapePolicy,
	type TimetableShapePolicyInput,
} from '../services/timetable-shape-policy.service.js';
import { buildSpecialEventSlots, buildTimetableShapeContract } from '../services/schedule-constructor.js';
import { getExpectedCanonicalSlots } from '../services/class-program-slot.service.js';

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
	const parity = validateOutputShapeParity({ section: [{ key: 'a' }, { key: 'b' }], teacher: [{ key: 'a' }], room: [{ key: 'a' }, { key: 'b' }] });
	assert.ok(parity.some((blocker) => blocker.code === 'OUTPUT_SHAPE_MISMATCH'));
});
