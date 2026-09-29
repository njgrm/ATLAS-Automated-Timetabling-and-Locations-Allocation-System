/**
 * A2 C17 — "were teacher preferences kept?" (R1-R7).
 *
 * PURE rows only. Every test drives `computePreferenceAdherence` with a fixture
 * it declares inline, so no database, no network and no clock is involved. The
 * mounted route is decided separately by `a2-c17-preference-adherence-route.test.ts`.
 *
 * R2 is the parent packet's NAMED fixture and is not weakened: two `UNAVAILABLE`
 * slots, one of which a placed class overlaps, must report exactly `1 of 2` with
 * exactly one group `kept: false`.
 *
 * Run: `npm run test:a2-c17-preference-adherence`
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
	computePreferenceAdherence,
	type PreferenceAdherenceAvailabilityRow,
	type PreferenceAdherenceInput,
	type PreferenceAdherencePlacedEntry,
} from '../services/preference-adherence.service.js';

const SCHOOL_ID = 1;
const YEAR_ID = 7;
const RUN_ID = 321;
const TERM = 1;

const OTHER_YEAR = 8;
const OTHER_TERM = 2;
const OTHER_SCHOOL = 2;

function names(...ids: number[]): Map<number, string> {
	return new Map(ids.map((id) => [id, `Teacher ${id}`]));
}

function row(overrides: Partial<PreferenceAdherenceAvailabilityRow> & Pick<PreferenceAdherenceAvailabilityRow, 'facultyId' | 'slots'>): PreferenceAdherenceAvailabilityRow {
	return {
		schoolId: SCHOOL_ID,
		schoolYearId: YEAR_ID,
		termIndex: TERM,
		status: 'REVIEWED',
		...overrides,
	};
}

function entry(facultyId: number | null, day: string, startTime: string, endTime: string, termIndex: number | null = TERM): PreferenceAdherencePlacedEntry {
	return { facultyId, day, startTime, endTime, termIndex };
}

function build(input: Partial<PreferenceAdherenceInput> & Pick<PreferenceAdherenceInput, 'availability' | 'placedEntries'> & { facultyNames?: Map<number, string> }) {
	return computePreferenceAdherence({
		runId: RUN_ID,
		schoolId: SCHOOL_ID,
		schoolYearId: YEAR_ID,
		termIndex: TERM,
		facultyNames: input.facultyNames ?? names(10, 11, 12, 13),
		...input,
	});
}

// ─── R1: pure function, all kept ───

test('R1: two UNAVAILABLE slots with no overlapping class report 2 of 2 kept, every group kept', () => {
	const report = build({
		availability: [row({
			facultyId: 10,
			slots: [
				{ day: 'MONDAY', startTime: '08:00', endTime: '09:00', state: 'UNAVAILABLE' },
				{ day: 'FRIDAY', startTime: '13:00', endTime: '14:00', state: 'UNAVAILABLE' },
			],
		})],
		// Both classes sit outside both painted windows.
		placedEntries: [entry(10, 'MONDAY', '10:00', '11:00'), entry(10, 'FRIDAY', '15:00', '16:00')],
	});

	assert.equal(report.totals.unavailableSlots, 2);
	assert.equal(report.totals.unavailableKept, 2);
	assert.equal(report.totals.preferredSlots, 0);
	assert.equal(report.hasAny, true);
	assert.equal(report.teachers.length, 1);
	assert.equal(report.teachers[0].name, 'Teacher 10');
	for (const group of report.teachers[0].groups) {
		assert.equal(group.kind, 'UNAVAILABLE');
		assert.equal(group.kept, true, `${group.label} must read as kept`);
	}
	assert.deepEqual(
		report.teachers[0].groups.map((group) => group.label),
		['Unavailable Monday morning', 'Unavailable Friday afternoon'],
		'the labels use the app day/period vocabulary, never a raw enum',
	);
});

// ─── R2: the parent packet's named fixture — one violated slot ───

test('R2 [PARENT PACKET FIXTURE]: one violated UNAVAILABLE slot reports 1 of 2 kept and exactly one group kept:false', () => {
	const report = build({
		availability: [row({
			facultyId: 10,
			slots: [
				{ day: 'MONDAY', startTime: '08:00', endTime: '09:00', state: 'UNAVAILABLE' },
				{ day: 'FRIDAY', startTime: '13:00', endTime: '14:00', state: 'UNAVAILABLE' },
			],
		})],
		// This class lands INSIDE the Monday 08:00-09:00 unavailable window.
		placedEntries: [entry(10, 'MONDAY', '08:30', '09:15'), entry(10, 'FRIDAY', '15:00', '16:00')],
	});

	assert.equal(report.totals.unavailableSlots, 2, 'both painted windows are counted');
	assert.equal(report.totals.unavailableKept, 1, 'exactly one was kept');
	assert.equal(report.teachers[0].groups.length, 2);
	const notKept = report.teachers[0].groups.filter((group) => group.kept === false);
	assert.equal(notKept.length, 1, 'exactly one group reads as not kept');
	assert.equal(notKept[0].label, 'Unavailable Monday morning');
	assert.equal(
		report.teachers[0].groups.filter((group) => group.kept === true).length,
		1,
		'the Friday window is still kept',
	);
});

// ─── R3: preferred partial ───

test('R3: seven PREFERRED blocks with classes in five report 5 of 7 preferred times met', () => {
	const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
	// SEVEN separate windows. A window is one thing the scheduler asked for, so the
	// fixture is written as seven SEPARATE blocks: two touching slots would collapse
	// into one block (see the grouping row below) and the fixture would be six.
	const slots = [
		...days.map((day) => ({ day, startTime: '08:00', endTime: '09:00', state: 'PREFERRED' })),
		{ day: 'MONDAY', startTime: '10:00', endTime: '11:00', state: 'PREFERRED' },
		{ day: 'MONDAY', startTime: '14:00', endTime: '15:00', state: 'PREFERRED' },
	];

	// A class in each of five of the seven windows.
	const placed = days.slice(0, 4).map((day) => entry(10, day, '08:30', '09:00'))
		.concat([entry(10, 'MONDAY', '10:30', '11:00')]);

	const report = build({ availability: [row({ facultyId: 10, slots })], placedEntries: placed });

	assert.equal(report.totals.preferredSlots, 7);
	assert.equal(report.totals.preferredMet, 5);
	assert.equal(report.totals.unavailableSlots, 0, 'a PREFERRED window is not an unavailable one');
	assert.equal(report.teachers[0].groups.length, 7, 'seven painted windows are seven rows in the list');
	const mondayMorning = report.teachers[0].groups.find((group) => group.label === 'Prefers Monday morning' && group.slotCount === 1);
	assert.equal(mondayMorning?.metCount, 1);
	const mondayAfternoon = report.teachers[0].groups.find((group) => group.label === 'Prefers Monday afternoon');
	assert.equal(mondayAfternoon?.metCount, 0, 'the 2-3 PM window got no class');
	assert.equal(mondayAfternoon?.kept, false);
});

test('R3b: two touching PREFERRED slots are ONE preferred time, and its metCount is per underlying slot', () => {
	const slots = [
		{ day: 'MONDAY', startTime: '10:00', endTime: '11:00', state: 'PREFERRED' },
		{ day: 'MONDAY', startTime: '11:00', endTime: '12:00', state: 'PREFERRED' },
	];
	const report = build({
		availability: [row({ facultyId: 10, slots })],
		placedEntries: [entry(10, 'MONDAY', '10:30', '11:00')],
	});

	assert.equal(report.totals.preferredSlots, 1, '10:00-12:00 is one thing the scheduler asked for');
	assert.equal(report.totals.preferredMet, 1);
	assert.equal(report.teachers[0].groups.length, 1);
	assert.equal(report.teachers[0].groups[0].label, 'Prefers Monday morning');
	assert.equal(report.teachers[0].groups[0].slotCount, 2, 'the two painted half-hours are still reported');
	assert.equal(report.teachers[0].groups[0].metCount, 1, 'only one of the two carries a class');
	assert.equal(report.teachers[0].groups[0].kept, false);
});

// ─── R4: reviewed-only ───

test('R4: a DRAFT row whose slot overlaps a placed class changes no count', () => {
	const reviewed = [row({
		facultyId: 10,
		slots: [{ day: 'MONDAY', startTime: '08:00', endTime: '09:00', state: 'UNAVAILABLE' }],
	})];
	const placed = [entry(10, 'MONDAY', '10:00', '11:00')];

	const withoutDraft = build({ availability: reviewed, placedEntries: placed });
	const withDraft = build({
		availability: [
			...reviewed,
			// Same teacher, same scope, DRAFT, and its window DOES overlap a class.
			row({ facultyId: 10, status: 'DRAFT', slots: [{ day: 'MONDAY', startTime: '10:00', endTime: '11:00', state: 'UNAVAILABLE' }] }),
		],
		placedEntries: placed,
	});

	assert.deepEqual(withDraft.totals, withoutDraft.totals, 'the DRAFT slot moves no total');
	assert.equal(withDraft.totals.unavailableSlots, 1, 'the DRAFT window is not counted as an unavailable time');
	assert.equal(withDraft.totals.unavailableKept, 1);
	assert.deepEqual(
		withDraft.teachers[0].groups.map((group) => group.label),
		['Unavailable Monday morning'],
		'the DRAFT window is not in the group list',
	);
	assert.equal(
		withDraft.notReviewedTeacherCount,
		0,
		'a faculty that ALSO has a REVIEWED row is not "not reviewed" — one row per faculty per term',
	);
});

// ─── R5: unreviewed disclosure ───

test('R5: two faculty with DRAFT/SUBMITTED rows only report notReviewedTeacherCount 2, hasAny true, totals 0', () => {
	const report = build({
		availability: [
			row({ facultyId: 11, status: 'DRAFT', slots: [{ day: 'MONDAY', startTime: '08:00', endTime: '09:00', state: 'PREFERRED' }] }),
			row({ facultyId: 12, status: 'SUBMITTED', slots: [{ day: 'TUESDAY', startTime: '13:00', endTime: '14:00', state: 'UNAVAILABLE' }] }),
		],
		placedEntries: [],
	});

	assert.equal(report.notReviewedTeacherCount, 2);
	assert.deepEqual(report.notReviewedTeacherNames, ['Teacher 11', 'Teacher 12']);
	assert.equal(report.hasAny, true, 'unreviewed preferences alone still have something to say');
	assert.deepEqual(report.totals, { unavailableSlots: 0, unavailableKept: 0, preferredSlots: 0, preferredMet: 0 });
	assert.equal(report.teachers.length, 0, 'no reviewed group is invented for them');
});

test('R5b: a REJECTED row counts as not in use, and an empty DRAFT row is not a claim about a teacher', () => {
	const report = build({
		availability: [
			row({ facultyId: 11, status: 'REJECTED', slots: [{ day: 'MONDAY', startTime: '08:00', endTime: '09:00', state: 'UNAVAILABLE' }] }),
			// No slots: indistinguishable from "never started", so it is not counted.
			row({ facultyId: 12, status: 'DRAFT', slots: [] }),
		],
		placedEntries: [],
	});

	assert.equal(report.notReviewedTeacherCount, 1);
	assert.deepEqual(report.notReviewedTeacherNames, ['Teacher 11']);
});

// ─── R6: silence ───

test('R6: no availability rows at all report hasAny false and no teachers', () => {
	const report = build({ availability: [], placedEntries: [entry(10, 'MONDAY', '08:00', '09:00')] });

	assert.equal(report.hasAny, false, 'the client must render NOTHING, not an empty box');
	assert.equal(report.notReviewedTeacherCount, 0);
	assert.deepEqual(report.teachers, []);
	assert.deepEqual(report.totals, { unavailableSlots: 0, unavailableKept: 0, preferredSlots: 0, preferredMet: 0 });
});

test('R6b: a REVIEWED row whose only slots are AVAILABLE renders nothing — AVAILABLE is not a preference', () => {
	const report = build({
		availability: [row({ facultyId: 10, slots: [{ day: 'MONDAY', startTime: '08:00', endTime: '09:00', state: 'AVAILABLE' }] })],
		placedEntries: [],
	});
	assert.equal(report.hasAny, false);
	assert.deepEqual(report.teachers, []);
});

// ─── R7: scope ───

test('R7: rows from another term, another year and another school change nothing', () => {
	const inScope = [row({
		facultyId: 10,
		slots: [{ day: 'MONDAY', startTime: '08:00', endTime: '09:00', state: 'UNAVAILABLE' }],
	})];
	const placed = [entry(10, 'MONDAY', '08:30', '09:00'), entry(10, 'MONDAY', '10:00', '11:00')];

	const baseline = build({ availability: inScope, placedEntries: placed });
	assert.equal(baseline.totals.unavailableKept, 0, 'the Monday class is inside the window');

	const foreign = [
		...inScope,
		// Another TERM. A class inside this window must not change the Term 1 answer.
		row({ facultyId: 10, termIndex: OTHER_TERM, slots: [{ day: 'MONDAY', startTime: '10:00', endTime: '11:00', state: 'UNAVAILABLE' }] }),
		// Another YEAR.
		row({ facultyId: 10, schoolYearId: OTHER_YEAR, slots: [{ day: 'MONDAY', startTime: '10:00', endTime: '11:00', state: 'UNAVAILABLE' }] }),
		// Another SCHOOL.
		row({ facultyId: 10, schoolId: OTHER_SCHOOL, slots: [{ day: 'MONDAY', startTime: '10:00', endTime: '11:00', state: 'UNAVAILABLE' }] }),
	];

	const report = build({ availability: foreign, placedEntries: placed });
	assert.deepEqual(report.totals, baseline.totals, 'no out-of-scope row moved a total');
	assert.equal(report.termIndex, TERM);
	assert.equal(report.schoolYearId, YEAR_ID);
	assert.equal(report.notReviewedTeacherCount, 0, 'an out-of-scope DRAFT row is not an unreviewed teacher here');
	assert.deepEqual(
		report.teachers[0].groups.map((group) => group.label),
		['Unavailable Monday morning'],
		'no out-of-scope window appears in the list',
	);
});

test('R7b: an entry recorded against another term is not counted against this term, but an entry with no term is', () => {
	const availability = [row({
		facultyId: 10,
		slots: [{ day: 'MONDAY', startTime: '08:00', endTime: '09:00', state: 'UNAVAILABLE' }],
	})];

	const otherTerm = build({ availability, placedEntries: [entry(10, 'MONDAY', '08:30', '09:00', OTHER_TERM)] });
	assert.equal(otherTerm.totals.unavailableKept, 1, 'a Term-2 class does not violate a Term-1 window');

	const noTerm = build({ availability, placedEntries: [entry(10, 'MONDAY', '08:30', '09:00', null)] });
	assert.equal(noTerm.totals.unavailableKept, 0, 'an entry with no recorded term is in scope, so the window is not called kept');
});

// ─── Grouping and labelling ───

test('grouping: one painted afternoon is ONE time, not twenty-four quarter-hours', () => {
	// What "not Friday afternoon" actually stores: 24 fifteen-minute rows.
	const slots = Array.from({ length: 24 }, (_, index) => ({
		day: 'FRIDAY',
		startTime: `${String(13 + Math.floor(index / 4)).padStart(2, '0')}:${String((index % 4) * 15).padStart(2, '0')}`,
		endTime: '',
		state: 'UNAVAILABLE',
	})).map((slot, index) => ({
		...slot,
		endTime: `${String(13 + Math.floor((index + 1) / 4)).padStart(2, '0')}:${String(((index + 1) % 4) * 15).padStart(2, '0')}`,
	}));

	const report = build({ availability: [row({ facultyId: 10, slots })], placedEntries: [] });

	assert.equal(report.totals.unavailableSlots, 1, 'one thing the scheduler asked for is one number');
	assert.equal(report.totals.unavailableKept, 1);
	assert.equal(report.teachers[0].groups.length, 1);
	assert.equal(report.teachers[0].groups[0].label, 'Unavailable Friday afternoon');
	assert.equal(report.teachers[0].groups[0].slotCount, 24, 'the underlying rows are still reported');
});

test('labels: a whole painted day, a midday window and a clock range — never a raw enum, an ellipsis or a bare clock', () => {
	const report = build({
		availability: [row({
			facultyId: 10,
			slots: [
				{ day: 'MONDAY', startTime: '07:00', endTime: '19:00', state: 'UNAVAILABLE' },
				{ day: 'TUESDAY', startTime: '08:00', endTime: '09:00', state: 'UNAVAILABLE' },
				// Crosses the 12:00 line the two day-part templates meet at, so it is
				// neither "morning" nor "afternoon" and must read as a clock range.
				{ day: 'WEDNESDAY', startTime: '11:15', endTime: '13:00', state: 'PREFERRED' },
			],
		})],
		placedEntries: [],
	});

	const labels = report.teachers[0].groups.map((group) => group.label);
	assert.deepEqual(labels, [
		'Unavailable Monday all day',
		'Unavailable Tuesday morning',
		'Prefers Wednesday 11:15 AM to 1:00 PM',
	]);
	for (const label of labels) {
		assert.doesNotMatch(label, /MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY/, 'no raw enum reaches the screen');
		assert.doesNotMatch(label, /\u2026|\.\.\./, 'no ellipsis');
		assert.doesNotMatch(label, /^\d{2}:\d{2}/, 'a bare clock range is never the whole label');
	}
});
