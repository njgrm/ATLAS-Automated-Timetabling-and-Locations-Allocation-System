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
	for (const preference of report.teachers[0].preferences) {
		assert.equal(preference.kind, 'UNAVAILABLE');
		assert.equal(preference.kept, true, `${preference.label} must read as kept`);
	}
	assert.deepEqual(
		report.teachers[0].preferences.map((preference) => preference.label),
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
	assert.equal(report.teachers[0].preferences.length, 2);
	const notKept = report.teachers[0].preferences.filter((preference) => preference.kept === false);
	assert.equal(notKept.length, 1, 'exactly one line reads as not kept');
	assert.equal(notKept[0].label, 'Unavailable Monday morning');
	assert.deepEqual(notKept[0].days, [{ day: 'Monday', met: true, classCount: 1 }], 'the detail row is the NEUTRAL fact — a class did land there, which is why the line is not kept');
	assert.equal(
		report.teachers[0].preferences.filter((preference) => preference.kept === true).length,
		1,
		'the Friday window is still kept',
	);
});

// ─── The real picker surface, as stored ───

/**
 * What `AvailabilityPicker.tsx` actually persists: 15-minute rows
 * (`STEP_MINUTES = 15`) between 07:00 and 19:00. Every fixture below is built with
 * THIS, not with hand-written one-slot blocks, because the first cut shaped the
 * fixture around the arithmetic it was meant to police — seven single-slot blocks
 * made "5 of 7" come out right while the product could never produce that shape.
 */
const PICKER_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

function paintedWindow(day: string, fromHour: number, toHour: number, state: 'UNAVAILABLE' | 'PREFERRED') {
	// `AvailabilityPicker` writes each 15-minute cell as [start, start+15), which is
	// why a "7 AM - 12 PM" template is 20 rows and not 5.
	const slots: Array<{ day: string; startTime: string; endTime: string; state: string }> = [];
	for (let minutes = fromHour * 60; minutes < toHour * 60; minutes += 15) {
		const at = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
		slots.push({ day, startTime: at(minutes), endTime: at(minutes + 15), state });
	}
	return slots;
}

/** The drill's own T3: "preferred mornings", painted across the five weekdays. */
function preferredMorningsAllWeek() {
	return PICKER_DAYS.flatMap((day) => paintedWindow(day, 8, 12, 'PREFERRED'));
}

/** An ordinary 50-minute morning class, the way a real run places one. */
function morningClass(day: string) {
	return entry(10, day, '08:00', '08:50');
}

// ─── R3: preferred partial, on the real surface ───

test('R3 [REAL SURFACE]: five painted weekday mornings with a class in three reads 3 of 5', () => {
	// 5 days × 16 fifteen-minute rows (4 painted hours) = 80 stored rows, 5 day-windows.
	const slots = preferredMorningsAllWeek();
	assert.equal(slots.length, 80, 'the fixture is what the picker persists, not 5 tidy blocks');

	const report = build({
		availability: [row({ facultyId: 10, slots })],
		placedEntries: [morningClass('MONDAY'), morningClass('WEDNESDAY'), morningClass('FRIDAY')],
	});

	assert.equal(report.totals.preferredSlots, 5, 'five painted mornings are five times');
	assert.equal(report.totals.preferredMet, 3, 'and the numerator counts the SAME unit');
	assert.ok(
		report.totals.preferredMet <= report.totals.preferredSlots,
		'the invariant this row exists for: a numerator can never exceed its denominator',
	);
	assert.equal(report.totals.unavailableSlots, 0);

	// The rollup: ONE line for five days, not five lines of equal weight.
	assert.equal(report.teachers[0].preferences.length, 1);
	assert.equal(report.teachers[0].preferences[0].label, 'Prefers mornings', "the packet's own shape");
	assert.equal(report.teachers[0].preferences[0].totalCount, 5);
	assert.equal(report.teachers[0].preferences[0].metCount, 3);
	assert.equal(report.teachers[0].preferences[0].slotCount, 80, 'the raw stored rows are still reported, outside any ratio');
	assert.deepEqual(
		report.teachers[0].preferences[0].days.map((day) => `${day.day}:${day.met}`),
		['Monday:true', 'Tuesday:false', 'Wednesday:true', 'Thursday:false', 'Friday:true'],
	);
});

test('R3b: two touching PREFERRED slots are ONE preferred time, and its count is that one time', () => {
	const slots = [
		{ day: 'MONDAY', startTime: '10:00', endTime: '11:00', state: 'PREFERRED' },
		{ day: 'MONDAY', startTime: '11:00', endTime: '12:00', state: 'PREFERRED' },
	];
	const report = build({
		availability: [row({ facultyId: 10, slots })],
		placedEntries: [entry(10, 'MONDAY', '10:30', '11:00')],
	});

	assert.equal(report.totals.preferredSlots, 1, '10:00-12:00 is one thing the scheduler asked for');
	assert.equal(report.totals.preferredMet, 1, 'one window either way — never 1 of 2 or 2 of 1');
	assert.equal(report.teachers[0].preferences.length, 1);
	assert.equal(report.teachers[0].preferences[0].label, 'Prefers Monday morning');
	assert.equal(report.teachers[0].preferences[0].slotCount, 2, 'the two painted half-hours are still reported');
	assert.equal(report.teachers[0].preferences[0].metCount, 1, 'a class landed in it, so the one window is met');
	assert.equal(report.teachers[0].preferences[0].kept, true);
	assert.deepEqual(report.teachers[0].preferences[0].days, [{ day: 'Monday', met: true, classCount: 1 }]);
});

test('R3c: the same window on one weekday alone still names the day', () => {
	const report = build({
		availability: [row({ facultyId: 10, slots: paintedWindow('FRIDAY', 8, 12, 'PREFERRED') })],
		placedEntries: [],
	});
	assert.equal(report.teachers[0].preferences.length, 1);
	assert.equal(report.teachers[0].preferences[0].label, 'Prefers Friday morning');
	assert.equal(report.teachers[0].preferences[0].totalCount, 1);
	assert.equal(report.teachers[0].preferences[0].metCount, 0);
});

// ─── The invariant row: the one that catches F1 without a human ───

test('a2-c17-preference-adherence-ratio-invariant: no reported ratio exceeds 1, on any fixture', () => {
	/**
	 * F1 shipped a report reading "20 of 5 preferred times met" and every individual
	 * assertion still passed, because each asserted one half of a ratio whose two
	 * halves came from different units. This row walks a spread of reports and asks
	 * the only question that matters: is every number a scheduler reads smaller than
	 * the one it is compared against? A future split of the unit fails here instead
	 * of in a screenshot.
	 */
	const fixtures: Array<{ name: string; input: Parameters<typeof build>[0] }> = [
		{
			name: 'five painted mornings, class in three',
			input: {
				availability: [row({ facultyId: 10, slots: preferredMorningsAllWeek() })],
				placedEntries: [morningClass('MONDAY'), morningClass('TUESDAY'), morningClass('FRIDAY')],
			},
		},
		{
			name: 'five painted mornings, a class in EVERY one',
			input: {
				availability: [row({ facultyId: 10, slots: preferredMorningsAllWeek() })],
				placedEntries: PICKER_DAYS.map(morningClass),
			},
		},
		{
			name: 'five painted mornings, no class anywhere',
			input: { availability: [row({ facultyId: 10, slots: preferredMorningsAllWeek() })], placedEntries: [] },
		},
		{
			name: 'mixed: painted unavailable afternoons and preferred mornings, several teachers',
			input: {
				availability: [
					row({ facultyId: 10, slots: [
						...PICKER_DAYS.flatMap((day) => paintedWindow(day, 13, 17, 'UNAVAILABLE')),
						...preferredMorningsAllWeek(),
					] }),
					row({ facultyId: 11, slots: PICKER_DAYS.flatMap((day) => paintedWindow(day, 7, 12, 'PREFERRED')) }),
				],
				placedEntries: [entry(10, 'MONDAY', '13:30', '14:20'), morningClass('MONDAY'), morningClass('TUESDAY')],
			},
		},
	];

	for (const fixture of fixtures) {
		const report = build(fixture.input);
		const { unavailableSlots, unavailableKept, preferredSlots, preferredMet } = report.totals;
		assert.ok(
			0 <= unavailableKept && unavailableKept <= unavailableSlots,
			`${fixture.name}: unavailable ratio ${unavailableKept}/${unavailableSlots} is not a fraction`,
		);
		assert.ok(
			0 <= preferredMet && preferredMet <= preferredSlots,
			`${fixture.name}: preferred ratio ${preferredMet}/${preferredSlots} is not a fraction — the denominator and the numerator are counting different things`,
		);

		// The same rule on every per-teacher line, which is where the drill read it.
		for (const teacher of report.teachers) {
			for (const preference of teacher.preferences) {
				assert.ok(
					0 <= preference.metCount && preference.metCount <= preference.totalCount,
					`${fixture.name} / ${teacher.name} / ${preference.label}: ${preference.metCount} of ${preference.totalCount} is not a fraction`,
				);
				assert.equal(
					preference.days.length,
					preference.totalCount,
					`${fixture.name} / ${preference.label}: the per-day detail must have exactly one row per counted window, or the detail and the count disagree`,
				);
			}
		}
	}
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
		withDraft.teachers[0].preferences.map((preference) => preference.label),
		['Unavailable Monday morning'],
		'the DRAFT window is not in the list',
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
		report.teachers[0].preferences.map((preference) => preference.label),
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
	// What "not Friday afternoon" actually stores: 24 fifteen-minute rows, built by
	// the same 15-minute walk the picker uses.
	const slots = paintedWindow('FRIDAY', 13, 19, 'UNAVAILABLE');
	assert.equal(slots.length, 24);

	const report = build({ availability: [row({ facultyId: 10, slots })], placedEntries: [] });

	assert.equal(report.totals.unavailableSlots, 1, 'one thing the scheduler asked for is one number');
	assert.equal(report.totals.unavailableKept, 1);
	assert.equal(report.teachers[0].preferences.length, 1);
	assert.equal(report.teachers[0].preferences[0].label, 'Unavailable Friday afternoon');
	assert.equal(report.teachers[0].preferences[0].slotCount, 24, 'the underlying rows are still reported, outside any ratio');
	assert.equal(report.teachers[0].preferences[0].totalCount, 1);
	assert.equal(report.teachers[0].preferences[0].metCount, 1);
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

	const labels = report.teachers[0].preferences.map((preference) => preference.label);
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
