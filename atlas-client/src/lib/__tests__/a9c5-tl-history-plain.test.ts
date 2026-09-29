/**
 * A9 c5 — the pure plain-language layer of the Past-years Teaching Load page.
 *
 * No DOM, no React, no requests: every row here is provable from source, which is
 * what makes the three scheduler questions and the copy fixes testable without a
 * browser. The rendered proof is the screenshots under
 * `docs/reviews/a9-c5-tl-history/screenshots/`; this suite is what keeps the
 * wording from drifting back.
 *
 * The FIXTURES ARE THE REAL SURFACE, not an invented one: the grades are the
 * `sectionMirror.gradeLevelName` values staging carries (`Grade 8`), the section
 * names are its `name` values (`Luna`, `Rose`), the subject codes are its real
 * `code` values (`SCI_BIO`) and its plain labels are its real `outputLabel`
 * values (`SCIENCE`), and `minMinutesPerWeek` is the ordinary 225.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
	TL_HISTORY_READ_ONLY_NOTE,
	TL_HISTORY_VIEW_ONLY_CHIP,
	tlHistoryCarryForwardLine,
	tlHistoryCommaList,
	tlHistoryFutureYearSentence,
	tlHistoryGradeOptions,
	tlHistoryHeading,
	tlHistoryHours,
	tlHistoryLoadLine,
	tlHistoryPlural,
	tlHistorySectionLine,
	tlHistorySubjectCodeDetail,
	tlHistorySubjectOptions,
	tlHistorySubjectPrimary,
	tlHistoryTotalsLine,
	tlHistoryVisibleTeachers,
	tlHistoryYearOptionLabel,
	tlHistoryYearShortLabel,
	tlHistoryYearStateWord,
	type TlHistoryAssignment,
	type TlHistoryTeacher,
	type TlHistoryYear,
} from '@/lib/teaching-load-history-plain';

const assignment = (
	over: Partial<TlHistoryAssignment> & { facultySubjectId: number },
): TlHistoryAssignment => ({
	subjectCode: 'SCI_BIO',
	subjectName: 'SCIENCE',
	minutesPerWeek: 225,
	sections: [{ sectionId: 1, sectionName: 'Luna', gradeLevelName: 'Grade 8' }],
	...over,
});

const teacher = (over: Partial<TlHistoryTeacher> & { facultyId: number }): TlHistoryTeacher => ({
	facultyName: 'Alcantara, Roberto',
	department: 'Science',
	weeklyMinutes: 450,
	classCount: 2,
	assignments: [],
	...over,
});

const year = (over: Partial<TlHistoryYear> & { schoolYearId: number }): TlHistoryYear => ({
	yearLabel: '2022-2023',
	isArchived: false,
	state: 'past',
	assignmentCount: 82,
	cycle: { state: 'POPULATED' },
	...over,
});

/* ─── singular / plural ───────────────────────────────────────────────────── */

test('A9C5-P1: one and many are never mixed up, so "5 subject s" cannot come back', () => {
	assert.equal(tlHistoryPlural(1, 'subject'), '1 subject');
	assert.equal(tlHistoryPlural(5, 'subject'), '5 subjects');
	assert.equal(tlHistoryPlural(0, 'subject'), '0 subjects');
	assert.equal(tlHistoryPlural(1, 'class', 'classes'), '1 class');
	assert.equal(tlHistoryPlural(4, 'class', 'classes'), '4 classes');
	// A non-finite count must not print `NaN`.
	assert.equal(tlHistoryPlural(Number.NaN, 'teacher'), '0 teachers');
});

/* ─── hours and classes ───────────────────────────────────────────────────── */

test('A9C5-P2: 225 minutes a week across 2 sections reads 7.5 hours/week', () => {
	// The audit asked for `hours/week · classes` on the collapsed row. This is the
	// arithmetic from the REAL staging shape: `minMinutesPerWeek` 225 for an
	// ordinary subject, taught in two sections.
	assert.equal(tlHistoryHours(225 * 2), '7.5');
	assert.equal(
		tlHistoryLoadLine({ weeklyMinutes: 225 * 2, classCount: 2 }),
		'7.5 hours/week · 2 classes',
	);
});

test('A9C5-P3: hours carry ONE decimal, and a whole number shows none', () => {
	assert.equal(tlHistoryHours(225), '3.8', '225 minutes is 3.75 hours, shown to one decimal');
	assert.equal(tlHistoryHours(450), '7.5');
	assert.equal(tlHistoryHours(300), '5', 'a whole number shows no trailing .0');
	assert.equal(tlHistoryHours(0), '0');
	assert.equal(tlHistoryHours(-60), '0', 'a negative load is not a number a scheduler should read');
	assert.equal(tlHistoryHours(Number.NaN), '0');
	assert.equal(tlHistoryLoadLine({ weeklyMinutes: 300, classCount: 1 }), '5 hours/week · 1 class');
});

test('A9C5-P4: the year totals are one inline line, not three badges', () => {
	assert.equal(
		tlHistoryTotalsLine({ teachers: 42, assignments: 95, sections: 20 }),
		'42 teachers · 95 subject assignments · 20 sections',
	);
	assert.equal(
		tlHistoryTotalsLine({ teachers: 1, assignments: 1, sections: 1 }),
		'1 teacher · 1 subject assignment · 1 section',
	);
});

/* ─── plain subject names, codes only in the detail ───────────────────────── */

test('A9C5-P5: the default label is the PLAIN subject name; the code is only ever a detail', () => {
	const row = assignment({ facultySubjectId: 1 });
	assert.equal(tlHistorySubjectPrimary(row), 'SCIENCE');
	assert.equal(
		tlHistorySubjectPrimary(row).includes('SCI_BIO'),
		false,
		'the default label must not carry the machine code — that was audit problem 5',
	);
	assert.equal(tlHistorySubjectCodeDetail(row), 'SCI_BIO');
	// The two are different strings for a reason: if they were equal the code would
	// be back in the default view.
	assert.notEqual(tlHistorySubjectPrimary(row), tlHistorySubjectCodeDetail(row));
});

test('A9C5-P6: an expanded subject line reads "Grade 8 — Luna, Rose"', () => {
	assert.equal(
		tlHistorySectionLine(assignment({
			facultySubjectId: 1,
			sections: [
				{ sectionId: 1, sectionName: 'Luna', gradeLevelName: 'Grade 8' },
				{ sectionId: 2, sectionName: 'Rose', gradeLevelName: 'Grade 8' },
			],
		})),
		'Grade 8 — Luna, Rose',
	);
	// The old string was `No preserved section assignment`.
	assert.equal(tlHistorySectionLine(assignment({ facultySubjectId: 1, sections: [] })), 'No sections were saved');
});

/* ─── the year picker ─────────────────────────────────────────────────────── */

test('A9C5-P7: a past year is offered in School Year Setup\'s own words, most recent first by the server', () => {
	const past = year({ schoolYearId: 1 });
	assert.equal(tlHistoryYearStateWord(past), 'past year');
	assert.equal(
		tlHistoryYearOptionLabel(past),
		'2022-2023 — past year, 82 assignments',
	);
	assert.equal(
		tlHistoryYearOptionLabel(year({ schoolYearId: 8, yearLabel: '2029-2030', isArchived: true, state: 'kept as history', assignmentCount: 95 })),
		'2029-2030 — kept as history, 95 assignments',
	);
	// A year with nothing in it is still named, never hidden: hiding it would read
	// as "never saved", which the page cannot claim.
	assert.equal(
		tlHistoryYearOptionLabel(year({ schoolYearId: 5, yearLabel: '2019-2020', assignmentCount: 0, cycle: null })),
		'2019-2020 — past year, nothing saved',
	);
	assert.equal(tlHistoryYearShortLabel(past), '2022-2023', 'the trigger face is short; the popover keeps the long label');
	assert.equal(tlHistoryYearStateWord(year({ schoolYearId: 8, state: 'kept as history' })), 'kept as history');
	assert.equal(tlHistoryYearStateWord(past), 'past year');
});

/* ─── the three questions ─────────────────────────────────────────────────── */

test('A9C5-P8: Grade + Subject together answer "who taught Grade 8 MAPEH?"', () => {
	const teachers: TlHistoryTeacher[] = [
		teacher({
			facultyId: 11,
			facultyName: 'Alcantara, Roberto',
			assignments: [
				assignment({
					facultySubjectId: 1,
					subjectCode: 'SCI_BIO',
					subjectName: 'SCIENCE',
					sections: [{ sectionId: 1, sectionName: 'Luna', gradeLevelName: 'Grade 8' }],
				}),
				assignment({
					facultySubjectId: 2,
					subjectCode: 'MAPEH',
					subjectName: 'MAPEH',
					sections: [{ sectionId: 2, sectionName: 'Sampaguita', gradeLevelName: 'Grade 7' }],
				}),
			],
		}),
		teacher({
			facultyId: 12,
			facultyName: 'Diaz, Maria',
			assignments: [
				assignment({
					facultySubjectId: 3,
					subjectCode: 'MAPEH',
					subjectName: 'MAPEH',
					sections: [{ sectionId: 3, sectionName: 'Luna', gradeLevelName: 'Grade 8' }],
				}),
			],
		}),
		teacher({
			facultyId: 13,
			facultyName: 'Reyes, Ana',
			assignments: [
				// MAPEH, but to Grade 7 — NOT the answer to "who taught Grade 8 MAPEH".
				assignment({
					facultySubjectId: 4,
					subjectCode: 'MAPEH',
					subjectName: 'MAPEH',
					sections: [{ sectionId: 4, sectionName: 'Sampaguita', gradeLevelName: 'Grade 7' }],
				}),
			],
		}),
	];

	const visible = tlHistoryVisibleTeachers(teachers, { query: '', grade: 'Grade 8', subject: 'MAPEH' });
	assert.deepEqual(
		visible.map((row) => row.teacher.facultyName),
		['Diaz, Maria'],
		'both filters must match the SAME assignment — Alcantara teaches MAPEH but to Grade 7, and Reyes teaches MAPEH but to Grade 7',
	);
	// The matched row carries the grade and the section, which is what the old page
	// omitted and what made this question unanswerable.
	assert.equal(tlHistorySectionLine(visible[0].matches[0]), 'Grade 8 — Luna');

	// Either filter alone is a valid coarser question, and neither filter is required.
	assert.deepEqual(
		tlHistoryVisibleTeachers(teachers, { query: '', grade: 'all', subject: 'MAPEH' }).map((row) => row.teacher.facultyId),
		[11, 12, 13],
	);
	assert.deepEqual(
		tlHistoryVisibleTeachers(teachers, { query: '', grade: 'Grade 8', subject: 'all' }).map((row) => row.teacher.facultyId),
		[11, 12],
	);
	assert.equal(tlHistoryVisibleTeachers(teachers, { query: '', grade: 'all', subject: 'all' }).length, 3);

	// The free-text box still works, and it searches the matched rows' grades and
	// sections as well as the teacher name.
	assert.deepEqual(
		tlHistoryVisibleTeachers(teachers, { query: 'sampaguita', grade: 'all', subject: 'all' }).map((row) => row.teacher.facultyId),
		[11, 13],
	);
	assert.deepEqual(
		tlHistoryVisibleTeachers(teachers, { query: 'nobody', grade: 'all', subject: 'all' }),
		[],
	);
});

test('A9C5-P9: the filter options come from the loaded year, subjects most common first', () => {
	const teachers: TlHistoryTeacher[] = [
		teacher({
			facultyId: 1,
			assignments: [
				assignment({ facultySubjectId: 1, subjectCode: 'SCI_BIO', subjectName: 'SCIENCE', sections: [{ sectionId: 1, sectionName: 'Luna', gradeLevelName: 'Grade 8' }] }),
				assignment({ facultySubjectId: 2, subjectCode: 'SCI_ES', subjectName: 'EARTH SCIENCE', sections: [{ sectionId: 2, sectionName: 'Rose', gradeLevelName: 'Grade 9' }] }),
			],
		}),
		teacher({
			facultyId: 2,
			assignments: [
				assignment({ facultySubjectId: 3, subjectCode: 'SCI_BIO', subjectName: 'SCIENCE', sections: [{ sectionId: 3, sectionName: 'Luna', gradeLevelName: 'Grade 8' }] }),
				assignment({ facultySubjectId: 4, subjectCode: 'MAPEH', subjectName: 'MAPEH', sections: [{ sectionId: 4, sectionName: 'Sampaguita', gradeLevelName: 'Grade 7' }] }),
			],
		}),
	];
	assert.deepEqual(tlHistoryGradeOptions(teachers), ['Grade 7', 'Grade 8', 'Grade 9']);
	// Most common first (SCIENCE twice), not alphabetical.
	assert.deepEqual(tlHistorySubjectOptions(teachers), ['SCIENCE', 'EARTH SCIENCE', 'MAPEH']);
	// Codes are never offered as a filter value.
	assert.equal(tlHistorySubjectOptions(teachers).includes('SCI_BIO'), false);
});

/* ─── the honest lines ────────────────────────────────────────────────────── */

test('A9C5-P10: the identity names the year, and there is ONE status for it', () => {
	assert.equal(
		tlHistoryHeading('2022-2023'),
		'Teaching Load — 2022-2023 (past year, view only)',
	);
	assert.equal(TL_HISTORY_VIEW_ONLY_CHIP, 'View only');
	assert.equal(TL_HISTORY_READ_ONLY_NOTE, 'Past years are read only — you can look, not change.');
	// The note replaced a two-line banner; it must not have grown back.
	assert.equal(TL_HISTORY_READ_ONLY_NOTE.includes('\n'), false);
});

test('A9C5-P11: the copy-forward line is TRUE and names the year', () => {
	const line = tlHistoryCarryForwardLine('2022-2023');
	assert.match(line, /^To copy 2022-2023 into this year's Teaching Load,/);
	assert.match(line, /keep that year as history in School Year Setup/);
	assert.match(line, /"Start from last year"/);
	// The packet's suggested sentence was FALSE — suggestion and auto-fill come from
	// canonical derived demand, not from last year. It must not be on the page.
	assert.equal(line.includes('uses last year'), false);
	assert.equal(line.includes('\n'), false);
	assert.match(tlHistoryCarryForwardLine(null), /^To copy a past year/);
});

test('A9C5-P12: drill years are named, comma-listed, and never hidden silently', () => {
	assert.equal(
		tlHistoryFutureYearSentence(['2029-2030', '2030-2031', '2031-2032']),
		'2029-2030, 2030-2031 and 2031-2032 are not past years, so they are not listed here.',
	);
	assert.equal(
		tlHistoryFutureYearSentence(['2029-2030']),
		'2029-2030 is not a past year, so it is not listed here.',
	);
	assert.equal(tlHistoryFutureYearSentence([]), '', 'with nothing to disclose the line is simply absent');
	// No serial comma, ever.
	assert.equal(tlHistoryCommaList(['a', 'b', 'c']), 'a, b and c');
	assert.equal(tlHistoryCommaList(['a', 'b']), 'a and b');
	assert.equal(tlHistoryCommaList(['a']), 'a');
});

/* ─── nothing the audit called broken is still on the page ────────────────── */

test('A9C5-P13: the strings the Codex audit named as broken cannot return', () => {
	const broken = ['Department not recorded', 'No preserved section assignment', 'subject s', 'Read-only history'];
	const rendered = [
		tlHistoryLoadLine({ weeklyMinutes: 450, classCount: 4 }),
		tlHistorySectionLine(assignment({ facultySubjectId: 1, sections: [] })),
		tlHistorySubjectPrimary(assignment({ facultySubjectId: 1 })),
		tlHistoryTotalsLine({ teachers: 42, assignments: 95, sections: 20 }),
		tlHistoryHeading('2022-2023'),
		tlHistoryYearOptionLabel(year({ schoolYearId: 1 })),
		tlHistoryFutureYearSentence(['2029-2030']),
		tlHistoryCarryForwardLine('2022-2023'),
		TL_HISTORY_READ_ONLY_NOTE,
		TL_HISTORY_VIEW_ONLY_CHIP,
	].join('\n');
	for (const phrase of broken) {
		assert.equal(rendered.includes(phrase), false, `"${phrase}" must not come back`);
	}
	// And no sentence may end in an ellipsis (§8).
	assert.equal(/…|\.\.\./.test(rendered), false);
});
