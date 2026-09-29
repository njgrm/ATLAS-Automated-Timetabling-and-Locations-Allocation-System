/**
 * A9 c5 — the plain words and the pure logic of the Past-years Teaching Load page.
 *
 * Pure module: no React, no requests, no DOM. Every string and every decision the
 * page shows is derived here so the wording is one testable table instead of
 * literals scattered through the view, and so the three scheduler questions the
 * Codex audit found unanswered can be answered without a browser.
 *
 * TWO RULES THAT ARE NOT NEGOTIABLE HERE (AGENTS.md §8, design gate):
 *
 *  1. NO MACHINE CODES IN THE DEFAULT VIEW. `SCI_BIO` is not scheduler language.
 *     A subject leads with its plain name (`SCIENCE`) and the code exists only in
 *     a muted detail line beside it.
 *  2. ONE FACT, ONE SENTENCE. A teacher's `hours/week · classes` line always means
 *     that teacher's whole year, whether or not a Grade or Subject filter is
 *     applied. Filters answer WHO; they never change what a number means, because a
 *     number that changes meaning when a filter moves is two numbers wearing one
 *     label.
 *
 * The year vocabulary (`past year`, `kept as history`) is A7-C2's
 * `plainSchoolYearStateSentence` vocabulary, reused rather than re-invented.
 */

export type TlHistoryYearState = 'current' | 'past' | 'kept as history';

export type TlHistoryYear = {
	schoolYearId: number;
	yearLabel: string;
	isArchived: boolean;
	state: TlHistoryYearState;
	assignmentCount: number;
	cycle: { state: 'EMPTY' | 'POPULATED' } | null;
};

export type TlHistorySection = { sectionId: number; sectionName: string; gradeLevelName: string };

export type TlHistoryAssignment = {
	facultySubjectId: number;
	subjectCode: string;
	subjectName: string;
	minutesPerWeek: number;
	sections: TlHistorySection[];
};

export type TlHistoryTeacher = {
	facultyId: number;
	facultyName: string;
	department: string | null;
	weeklyMinutes: number;
	classCount: number;
	assignments: TlHistoryAssignment[];
};

export type TlHistoryFilters = { query: string; grade: string; subject: string };

/* ─── the identity ───────────────────────────────────────────────────────── */

/** The ONE read-only line that replaces the old two-line amber banner. */
export const TL_HISTORY_READ_ONLY_NOTE = 'Past years are read only — you can look, not change.';

/** The one status chip. A second chip saying the same thing is forbidden. */
export const TL_HISTORY_VIEW_ONLY_CHIP = 'View only';

/**
 * The page identity, and it names the year. The audit's problem 10 was that
 * `S.Y. 2023-2024 • ACTIVE` and the page's own words disagreed about which year
 * you were looking at, so the heading carries the year and the rest of the screen
 * stops competing with it.
 */
export function tlHistoryHeading(yearLabel: string | null | undefined): string {
	return yearLabel
		? `Teaching Load — ${yearLabel} (past year, view only)`
		: 'Teaching Load — past years (view only)';
}

/**
 * The third scheduler question, and the answer is TRUE.
 *
 * The packet suggested "suggestions use last year's" — it does not. Suggestion and
 * auto-fill on Teaching Load come from canonical derived demand. Copy-forward is
 * real, it lives in School Year Setup as `Start from last year (optional)`, and its
 * source list is kept/archived years only. So this line names the year you are
 * looking at and points at the one control that actually copies it.
 */
export function tlHistoryCarryForwardLine(yearLabel: string | null | undefined): string {
	return yearLabel
		? `To copy ${yearLabel} into this year's Teaching Load, keep that year as history in School Year Setup, then use "Start from last year".`
		: 'To copy a past year into this year\'s Teaching Load, keep that year as history in School Year Setup, then use "Start from last year".';
}

/* ─── counting ───────────────────────────────────────────────────────────── */

/** Honest 0/1/n, so `5 subject s` cannot come back. */
export function tlHistoryPlural(count: number, one: string, many: string = `${one}s`): string {
	const safe = Number.isFinite(count) ? count : 0;
	return `${safe} ${safe === 1 ? one : many}`;
}

/**
 * Minutes a week, as the hours a scheduler thinks in. ONE decimal, no trailing
 * `.0`, and a whole number shows no decimal at all: `450 -> 7.5`, `225 -> 3.8`,
 * `300 -> 5`.
 */
export function tlHistoryHours(weeklyMinutes: number): string {
	const minutes = Number.isFinite(weeklyMinutes) && weeklyMinutes > 0 ? weeklyMinutes : 0;
	const tenths = Math.round((minutes / 60) * 10) / 10;
	return String(Number.isFinite(tenths) ? tenths : 0);
}

/** The collapsed row's whole line: name, then the muted load. */
export function tlHistoryLoadLine(input: {
	weeklyMinutes: number;
	classCount: number;
}): string {
	return `${tlHistoryHours(input.weeklyMinutes)} hours/week · ${tlHistoryPlural(input.classCount, 'class', 'classes')}`;
}

/** The one inline stat line. A wall of badges was the audit's problem 4. */
export function tlHistoryTotalsLine(totals: {
	teachers: number;
	assignments: number;
	sections: number;
}): string {
	return `${tlHistoryPlural(totals.teachers, 'teacher')} · ${tlHistoryPlural(totals.assignments, 'subject assignment')} · ${tlHistoryPlural(totals.sections, 'section')}`;
}

/* ─── the year picker ────────────────────────────────────────────────────── */

/** The plain state a year is offered under, in School Year Setup's own words. */
export function tlHistoryYearStateWord(year: Pick<TlHistoryYear, 'state'>): string {
	return year.state === 'kept as history' ? 'kept as history' : 'past year';
}

/**
 * A year option, most recent first, saying what it holds. A year with nothing in
 * it says so rather than being hidden: a scheduler who cannot see 2021-2022
 * concludes it was never saved, and the page cannot make that claim.
 */
export function tlHistoryYearOptionLabel(
	year: Pick<TlHistoryYear, 'yearLabel' | 'state' | 'assignmentCount'>,
): string {
	const state = tlHistoryYearStateWord(year);
	return year.assignmentCount === 0
		? `${year.yearLabel} — ${state}, nothing saved`
		: `${year.yearLabel} — ${state}, ${tlHistoryPlural(year.assignmentCount, 'assignment')}`;
}

/** A year with no cycle AND no assignments is readable but has nothing to show. */
export function tlHistoryYearIsEmpty(year: Pick<TlHistoryYear, 'assignmentCount' | 'cycle'>): boolean {
	return year.cycle == null && year.assignmentCount === 0;
}

/** The short value on the trigger face; the popover keeps the long label. */
export function tlHistoryYearShortLabel(year: Pick<TlHistoryYear, 'yearLabel'>): string {
	return year.yearLabel;
}

/* ─── the three questions ────────────────────────────────────────────────── */

/**
 * Comma list with `and` and NO serial comma: `A, B and C`.
 *
 * This is the DISCLOSURE vocabulary (drill years, the copy-forward line), not the
 * section vocabulary — see `tlHistorySectionList`.
 */
export function tlHistoryCommaList(items: string[]): string {
	const clean = items.filter((item) => item.trim().length > 0);
	if (clean.length === 0) return '';
	if (clean.length === 1) return clean[0];
	return `${clean.slice(0, -1).join(', ')} and ${clean[clean.length - 1]}`;
}

/**
 * The SECTION vocabulary: a plain comma list, `Luna, Rose`.
 *
 * Deliberately NOT `tlHistoryCommaList`. Sections of one grade are a roster, not a
 * sentence: "Grade 8 — Luna and Rose" reads as a pair, and the packet's own example
 * for an expanded subject line is `Grade 8 — Luna, Rose`.
 */
export function tlHistorySectionList(names: string[]): string {
	return names.join(', ');
}

/**
 * Drill years are disclosed, never hidden silently. The page cannot answer for
 * them, so it says so in one line and names them.
 */
export function tlHistoryFutureYearSentence(yearLabels: string[]): string {
	const names = tlHistoryCommaList(yearLabels);
	return names
		? `${names} ${yearLabels.length === 1 ? 'is not a past year' : 'are not past years'}, so ${yearLabels.length === 1 ? 'it is' : 'they are'} not listed here.`
		: '';
}

/** Every grade level the loaded year actually has sections for. */
export function tlHistoryGradeOptions(teachers: TlHistoryTeacher[]): string[] {
	const grades = new Set<string>();
	for (const teacher of teachers) {
		for (const assignment of teacher.assignments) {
			for (const section of assignment.sections) grades.add(section.gradeLevelName);
		}
	}
	return Array.from(grades).sort(compareGradeNames);
}

/** Plain subject names for the loaded year, MOST COMMON FIRST — the year shape, not an alphabet. */
export function tlHistorySubjectOptions(teachers: TlHistoryTeacher[]): string[] {
	const counts = new Map<string, number>();
	for (const teacher of teachers) {
		for (const assignment of teacher.assignments) {
			const name = assignment.subjectName;
			counts.set(name, (counts.get(name) ?? 0) + 1);
		}
	}
	return Array.from(counts.entries())
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.map(([name]) => name);
}

function compareGradeNames(a: string, b: string): number {
	const left = /(\d+)/.exec(a);
	const right = /(\d+)/.exec(b);
	if (left && right) {
		const byNumber = Number(left[1]) - Number(right[1]);
		if (byNumber !== 0) return byNumber;
	}
	return a.localeCompare(b);
}

/** The assignments one subject line shows: `Grade 8 — Luna, Rose`. */
export function tlHistorySectionLine(assignment: TlHistoryAssignment): string {
	const names = assignment.sections.map((section) => section.sectionName);
	if (names.length === 0) return 'No sections were saved';
	return `${assignment.sections[0].gradeLevelName} — ${tlHistorySectionList(names)}`;
}

/** The plain subject name. Never the code — the code is a detail. */
export function tlHistorySubjectPrimary(assignment: TlHistoryAssignment): string {
	return assignment.subjectName;
}

/** The muted detail under a subject. This is the only place a code may appear. */
export function tlHistorySubjectCodeDetail(assignment: TlHistoryAssignment): string {
	return assignment.subjectCode;
}

/**
 * Does this teacher answer "who taught <grade> <subject>?".
 *
 * BOTH filters must match the SAME assignment on purpose: a teacher who teaches
 * MAPEH to Grade 8 and Science to Grade 9 is not the answer to "who taught Grade
 * 8 MAPEH", and matching each filter against the whole teacher would return them
 * anyway.
 */
export function tlHistoryTeacherMatches(
	teacher: TlHistoryTeacher,
	filters: TlHistoryFilters,
): TlHistoryAssignment[] | null {
	const query = filters.query.trim().toLowerCase();
	const grade = filters.grade;
	const subject = filters.subject;

	const matched = teacher.assignments.filter((assignment) => {
		if (subject !== 'all' && subject !== '' && assignment.subjectName !== subject) return false;
		if (grade !== 'all' && grade !== '') {
			if (!assignment.sections.some((section) => section.gradeLevelName === grade)) return false;
		}
		return true;
	});
	if (matched.length === 0) return null;
	if (!query) return matched;

	const searchable = [
		teacher.facultyName,
		teacher.department ?? '',
		...matched.flatMap((assignment) => [
			assignment.subjectName,
			assignment.subjectCode,
			...assignment.sections.flatMap((section) => [section.sectionName, section.gradeLevelName]),
		]),
	].join(' ').toLowerCase();
	return searchable.includes(query) ? matched : null;
}

/** Every teacher who answers the filters, most-assigned first, each with its matched rows. */
export function tlHistoryVisibleTeachers(
	teachers: TlHistoryTeacher[],
	filters: TlHistoryFilters,
): Array<{ teacher: TlHistoryTeacher; matches: TlHistoryAssignment[] }> {
	const rows: Array<{ teacher: TlHistoryTeacher; matches: TlHistoryAssignment[] }> = [];
	for (const teacher of teachers) {
		const matches = tlHistoryTeacherMatches(teacher, filters);
		if (matches) rows.push({ teacher, matches });
	}
	return rows;
}
