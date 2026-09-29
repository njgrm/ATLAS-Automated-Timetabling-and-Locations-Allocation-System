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
	tlHistoryCollapsedRow,
	tlHistoryCommaList,
	tlHistoryFutureYearSentence,
	tlHistoryGradeOptions,
	tlHistoryHeading,
	tlHistoryHours,
	tlHistoryLoadLine,
	tlHistoryNoMatchAnswer,
	tlHistoryPlural,
	tlHistorySectionLine,
	tlHistorySubjectCodeDetail,
	tlHistorySubjectOptions,
	tlHistorySubjectPrimary,
	tlHistoryTeacherMatches,
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

test('A9C5-R2-P1: the Subject filter offers PLAIN names, and a code-only payload still filters', () => {
	// The real 2022-2023 payload: `subjectName` IS the code, and `subjectLabel` is the
	// human name. Before this row the Subject dropdown offered DEVL_READING,
	// STE_APPLIED_CHEM and SCI_BIO — machine codes, the same defect as the row.
	const teachers: TlHistoryTeacher[] = [
		teacher({
			facultyId: 1,
			assignments: [
				assignment({
					facultySubjectId: 1,
					subjectCode: 'DEVL_READING',
					subjectName: 'DEVL_READING',
					subjectLabel: 'Developmental Reading',
					sections: [{ sectionId: 1, sectionName: 'Rizal', gradeLevelName: 'Grade 7' }],
				}),
				assignment({
					facultySubjectId: 2,
					subjectCode: 'SCI_BIO',
					subjectName: 'SCIENCE',
					subjectLabel: 'Science - Biology',
					sections: [{ sectionId: 2, sectionName: 'Luna', gradeLevelName: 'Grade 8' }],
				}),
			],
		}),
	];
	const options = tlHistorySubjectOptions(teachers);
	assert.deepEqual(options, ['Developmental Reading', 'Science - Biology']);
	// The offered value is the one the filter actually compares against, so selecting
	// it returns the teacher instead of an empty page.
	const selected = tlHistoryTeacherMatches(teachers[0], { query: '', grade: 'all', subject: 'Developmental Reading' });
	assert.equal(selected?.length, 1);
	// And the grade suggestion follows the same identity.
	const answer = tlHistoryNoMatchAnswer(teachers, { query: '', grade: 'Grade 8', subject: 'Developmental Reading' }, '2022-2023');
	assert.deepEqual(answer?.suggestions, ['Grade 7']);
	// A payload from before the label field existed still filters on `subjectName`.
	const legacy: TlHistoryTeacher[] = [
		teacher({
			facultyId: 2,
			assignments: [assignment({ facultySubjectId: 3, subjectCode: 'FIL', subjectName: 'Filipino', sections: [{ sectionId: 4, sectionName: 'Luna', gradeLevelName: 'Grade 7' }] })],
		}),
	];
	assert.equal(tlHistoryTeacherMatches(legacy[0], { query: '', grade: 'all', subject: 'Filipino' })?.length, 1);
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

/* ─── A9 c5 ROUND 1: the plain name leads, the code is a detail (D2) ────────── */

/**
 * The fixture that failed on the operator's rendered proof: a subject whose
 * `outputLabel` — and therefore whose `subjectName` — IS the machine code. This is
 * the real 2022-2023 shape for `DEVL_READING`, whose stored name is
 * `Developmental Reading`.
 */
const codelabelled = assignment({
	facultySubjectId: 1,
	subjectCode: 'DEVL_READING',
	subjectName: 'DEVL_READING',
	subjectLabel: 'Developmental Reading',
	sections: [{ sectionId: 1, sectionName: 'Rizal', gradeLevelName: 'Grade 7' }],
});

test('A9C5-R1-P1: an outputLabel that is a code still renders the PLAIN name first', () => {
	assert.equal(
		tlHistorySubjectPrimary(codelabelled),
		'Developmental Reading',
		'the row must lead with the plain name even though subjectName is the code',
	);
	assert.equal(
		tlHistorySubjectPrimary(codelabelled).includes('DEVL_READING'),
		false,
		'the machine code must not be the primary label — that was audit problem 5',
	);
	// The code is still available, exactly once, as a muted detail.
	assert.equal(tlHistorySubjectCodeDetail(codelabelled), 'DEVL_READING');
	// And the two are genuinely different, so the detail is not a repeat of the label.
	assert.notEqual(tlHistorySubjectPrimary(codelabelled), tlHistorySubjectCodeDetail(codelabelled));
});

test('A9C5-R1-P2: the code is NOT repeated when the label already IS the code', () => {
	// A subject with no plain name anywhere: name, outputLabel and code are all `MAPEH`.
	// Repeating it under itself is the `DEVL_READING` / `DEVL_READING` defect.
	const noPlainName = assignment({
		facultySubjectId: 2,
		subjectCode: 'MAPEH',
		subjectName: 'MAPEH',
		subjectLabel: 'MAPEH',
	});
	assert.equal(tlHistorySubjectPrimary(noPlainName), 'MAPEH');
	assert.equal(
		tlHistorySubjectCodeDetail(noPlainName),
		'',
		'when the label already carries the code the detail is empty, so the code cannot print twice',
	);
	// A payload from before the field existed must still render rather than throw.
	const legacy = assignment({ facultySubjectId: 3, subjectCode: 'SCI_BIO', subjectName: 'SCIENCE' });
	assert.equal(tlHistorySubjectPrimary(legacy), 'SCIENCE', 'a payload with no subjectLabel falls back to subjectName');
	assert.equal(tlHistorySubjectCodeDetail(legacy), 'SCI_BIO');
	// An empty label string is not a label.
	assert.equal(
		tlHistorySubjectPrimary(assignment({ facultySubjectId: 4, subjectLabel: '   ' })),
		'SCIENCE',
		'a whitespace-only label falls back rather than rendering blank',
	);
});

test('A9C5-R1-P3: the collapsed row carries a name and a load, and NO subject code', () => {
	const row = teacher({
		facultyId: 11,
		facultyName: 'Aguilar, Carlo Miguel',
		// On the real data this is a bare subject code, which is why the cell is gone.
		department: 'FIL',
		weeklyMinutes: 1410,
		classCount: 9,
		assignments: [
			assignment({ facultySubjectId: 1, subjectCode: 'DEVL_READING', subjectName: 'DEVL_READING', subjectLabel: 'Developmental Reading' }),
			assignment({ facultySubjectId: 2, subjectCode: 'FIL', subjectName: 'FIL', subjectLabel: 'Filipino' }),
		],
	});
	const collapsed = tlHistoryCollapsedRow(row);
	assert.equal(collapsed.name, 'Aguilar, Carlo Miguel');
	assert.equal(collapsed.detail, '23.5 hours/week · 9 classes');

	const rendered = `${collapsed.name} ${collapsed.detail}`;
	for (const code of ['DEVL_READING', 'FIL', 'SCI_BIO', 'SCIENCE']) {
		assert.equal(
			rendered.includes(code),
			false,
			`the collapsed row must not carry the code "${code}"; it is a detail of the expanded row only`,
		);
	}
	assert.equal(
		rendered.includes(row.department as string),
		false,
		'the third cell that held a bare department code is removed, not reworded',
	);
	// The keys are the contract: name and detail, so a third cell cannot be added
	// without this test seeing it.
	assert.deepEqual(Object.keys(collapsed).sort(), ['detail', 'name']);
});

/* ─── A9 c5 ROUND 1: the no-match answer is not a dead end (D3) ────────────── */

const mapezYear: TlHistoryTeacher[] = [
	teacher({
		facultyId: 1,
		facultyName: 'Reyes, Ana',
		assignments: [assignment({ facultySubjectId: 1, subjectCode: 'MAPEH', subjectName: 'MAPEH', sections: [{ sectionId: 1, sectionName: 'Sampaguita', gradeLevelName: 'Grade 7' }] })],
	}),
	teacher({
		facultyId: 2,
		facultyName: 'Santos, Liza',
		assignments: [assignment({ facultySubjectId: 2, subjectCode: 'AP', subjectName: 'AP', sections: [{ sectionId: 2, sectionName: 'Luna', gradeLevelName: 'Grade 8' }] })],
	}),
];

test('A9C5-R1-P4: Grade 8 + MAPEH names the year and offers the grades MAPEH WAS taught', () => {
	// The exact case the operator measured in staging: MAPEH was taught only in Grade 7
	// in 2022-2023, so this filter truthfully returns nothing.
	const answer = tlHistoryNoMatchAnswer(mapezYear, { query: '', grade: 'Grade 8', subject: 'MAPEH' }, '2022-2023');
	assert.ok(answer, 'a grade or subject filter that yields nothing is answered, not refused');
	assert.equal(answer!.sentence, 'No one taught MAPEH in Grade 8 in 2022-2023.');
	assert.deepEqual(answer!.suggestions, ['Grade 7'], 'the grades where MAPEH WAS taught that year');
	assert.equal(answer!.lead, 'MAPEH was taught in:');
	assert.equal(answer!.axis, 'grade', 'a suggestion sets the filter the scheduler did NOT set');
	// No sentence may end in an ellipsis (§8).
	assert.equal(/…|\.\.\.$/.test(answer!.sentence), false);
	assert.equal(answer!.sentence.endsWith('.'), true, 'it is a sentence');
});

test('A9C5-R1-P5: a subject with no grade still names the year, and a grade alone is answered too', () => {
	const subjectOnly = tlHistoryNoMatchAnswer(mapezYear, { query: '', grade: 'all', subject: 'ESP' }, '2022-2023');
	assert.equal(subjectOnly!.sentence, 'No one taught ESP in 2022-2023.');
	assert.deepEqual(subjectOnly!.suggestions, [], 'a subject that was never taught that year has nothing to offer');
	assert.equal(subjectOnly!.lead, '', 'and no lead-in inventing one');

	const gradeOnly = tlHistoryNoMatchAnswer(mapezYear, { query: '', grade: 'Grade 10', subject: 'all' }, '2022-2023');
	assert.equal(gradeOnly!.sentence, 'No teacher in 2022-2023 taught Grade 10.');
	assert.equal(gradeOnly!.axis, 'subject');
	assert.deepEqual(gradeOnly!.suggestions, [], 'Grade 10 held nothing that year');

	// A grade that DOES exist is answered with what it was taught.
	const gradeHeld = tlHistoryNoMatchAnswer(mapezYear, { query: 'zzz', grade: 'Grade 8', subject: 'all' }, '2022-2023');
	assert.deepEqual(gradeHeld!.suggestions, ['AP']);
	assert.equal(gradeHeld!.lead, 'Subjects taught in Grade 8:');
});

test('A9C5-R1-P6: a search term alone keeps the plain one-liner, and a full match is not an answer', () => {
	assert.equal(
		tlHistoryNoMatchAnswer(mapezYear, { query: 'nobody', grade: 'all', subject: 'all' }, '2022-2023'),
		null,
		'a search term has no enumerable answer set, so this case must not invent one',
	);
	// The one-liner the view falls back to is unchanged.
	assert.equal(
		tlHistoryNoMatchAnswer(mapezYear, { query: 'nobody', grade: 'all', subject: 'all' }, '2022-2023')?.sentence
			?? 'No teacher in this year matches those filters.',
		'No teacher in this year matches those filters.',
	);
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
