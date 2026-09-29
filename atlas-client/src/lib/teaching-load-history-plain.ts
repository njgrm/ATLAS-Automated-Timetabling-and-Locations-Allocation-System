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
	/**
	 * A9 c5 r1 (D2): the PLAIN name (`Developmental Reading`), sent beside the code
	 * rather than in place of it.
	 *
	 * OPTIONAL on purpose. The server is additive here, so a payload saved before this
	 * field existed — or a page served by an older API — has no `subjectLabel`, and the
	 * row must still read. Every reader below falls back to `subjectName`, so making
	 * this required would turn a back-compat field into a crash.
	 */
	subjectLabel?: string;
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

/**
 * Plain subject names for the loaded year, MOST COMMON FIRST — the year shape, not an alphabet.
 *
 * A9 c5 r2: keyed on the PLAIN label, not `subjectName`. On this data `subjectName` is
 * the code (`DEVL_READING`, `SCI_BIO`, `STE_APPLIED_CHEM`), so the Subject list was a
 * list of machine codes — the same defect as the row, one control away. Every reader of
 * the subject filter compares against this same identity (see `tlHistoryMatches` and
 * `tlHistoryNoMatchAnswer`), so changing it here alone would have made the filter
 * select a value nothing matched.
 */
export function tlHistorySubjectOptions(teachers: TlHistoryTeacher[]): string[] {
	const counts = new Map<string, number>();
	for (const teacher of teachers) {
		for (const assignment of teacher.assignments) {
			const name = tlHistorySubjectPrimary(assignment);
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

/**
 * The plain subject name. Never the code — the code is a detail.
 *
 * A9 c5 r1 (D2). This used to be `subjectName`, which on this data IS the code, so the
 * row led with `DEVL_READING` and the plain name never appeared anywhere on the page.
 * The label is read first and `subjectName` is the fallback, so a payload without the
 * new field still renders instead of throwing.
 */
export function tlHistorySubjectPrimary(assignment: TlHistoryAssignment): string {
	const label = assignment.subjectLabel?.trim();
	if (label) return label;
	return assignment.subjectName;
}

/**
 * The muted detail under a subject: the code, and ONLY when it says something the
 * label does not.
 *
 * A9 c5 r1 (D2). The old row printed the code unconditionally, under a label that was
 * often the code again — `DEVL_READING` above `DEVL_READING`. Returning `''` for a
 * label that already IS the code is what makes "the code appears once, as a detail"
 * true by construction rather than by reviewer attention; the view renders nothing
 * when this is empty.
 */
export function tlHistorySubjectCodeDetail(assignment: TlHistoryAssignment): string {
	const label = tlHistorySubjectPrimary(assignment).trim().toLowerCase();
	const code = (assignment.subjectCode ?? '').trim();
	if (!code) return '';
	return code.toLowerCase() === label ? '' : code;
}

/**
 * A9 c5 r1 (D2) — the collapsed row, and the WHOLE of it.
 *
 * Name, then the muted load. That is all, and the omissions are the point: the old row
 * carried a third cell holding `teacher.department`, which on this data is a bare
 * subject code (`FIL`, `MATH`, `TLE`) that duplicated the subject line it sat beside
 * and meant nothing to an older scheduler.
 *
 * Modelled here rather than in JSX so the "no machine code in the default view" rule is
 * a testable table. If someone re-adds a third cell, this is the function that has to
 * change, and the row's own test fails.
 */
export function tlHistoryCollapsedRow(teacher: TlHistoryTeacher): { name: string; detail: string } {
	return {
		name: teacher.facultyName,
		detail: tlHistoryLoadLine({ weeklyMinutes: teacher.weeklyMinutes, classCount: teacher.classCount }),
	};
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
		if (subject !== 'all' && subject !== '' && tlHistorySubjectPrimary(assignment) !== subject) return false;
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

/* ─── the honest no-match answer ──────────────────────────────────────────── */

export type TlHistoryNoMatch = {
	/** Names the year and says plainly that nothing matches. Never an ellipsis. */
	sentence: string;
	/** The lead-in to the one-click answers, or `''` when there is nothing to offer. */
	lead: string;
	/** Grade names when a subject is selected, subject names when only a grade is. */
	suggestions: string[];
	/** Which filter a suggestion button sets. The other one is left selected. */
	axis: 'grade' | 'subject';
};

/**
 * A9 c5 r1 (D3) — a truthful no-match answer that is not a DEAD END.
 *
 * THE DEFECT. `Grade 8` + `MAPEH` in 2022-2023 returns nothing, and the page said
 * "No teacher in this year matches those filters." That is TRUE — MAPEH was only taught
 * in Grade 7 that year — and it is still useless: a scheduler who asked the audit's
 * question 1 is now told no, with nothing to do next and no way to find the answer.
 *
 * So the same facts are answered, not just refused: the year is named, the absence is
 * stated plainly, and the grades in which the selected subject WAS taught that year are
 * offered as one-click buttons. Every one of those is derived from the year the client
 * ALREADY holds — no extra request, and no claim the page cannot support.
 *
 * WHY THE OTHER AXIS. With a subject selected the useful next move is a grade; with only
 * a grade selected it is a subject. The suggestion always sets the filter the scheduler
 * did NOT just set, and leaves the one they did alone, so one click is a narrower
 * question rather than a different question.
 *
 * A SEARCH TERM ALONE IS DELIBERATELY NOT ANSWERED HERE. "No teacher matches
 * `agui`" has no enumerable answer set, so inventing one would be a guess; that case
 * keeps its plain one-liner and `null` here is what keeps it.
 */
export function tlHistoryNoMatchAnswer(
	teachers: TlHistoryTeacher[],
	filters: TlHistoryFilters,
	yearLabel: string | null | undefined,
): TlHistoryNoMatch | null {
	const year = yearLabel ?? 'this year';
	const grade = filters.grade;
	const subject = filters.subject;
	const hasGrade = grade !== 'all' && grade !== '';
	const hasSubject = subject !== 'all' && subject !== '';

	// No grade and no subject: the only reason nothing matched is the search box, and
	// this is not the place to answer it.
	if (!hasGrade && !hasSubject) return null;

	if (hasSubject) {
		const grades = new Set<string>();
		for (const teacher of teachers) {
			for (const assignment of teacher.assignments) {
				// A9 c5 r2: the filter's own identity is the PLAIN label, so the
				// suggestion is derived from the same field the filter compares
				// against — otherwise the offered grade would select nothing.
				if (tlHistorySubjectPrimary(assignment) !== subject) continue;
				for (const section of assignment.sections) grades.add(section.gradeLevelName);
			}
		}
		const suggestions = Array.from(grades).sort(compareGradeNames);
		return {
			sentence: hasGrade
				? `No one taught ${subject} in ${grade} in ${year}.`
				: `No one taught ${subject} in ${year}.`,
			lead: suggestions.length > 0 ? `${subject} was taught in:` : '',
			suggestions,
			axis: 'grade',
		};
	}

	// A grade with no subject: the answer is what that grade WAS taught.
	const counts = new Map<string, number>();
	for (const teacher of teachers) {
		for (const assignment of teacher.assignments) {
			if (!assignment.sections.some((section) => section.gradeLevelName === grade)) continue;
			const label = tlHistorySubjectPrimary(assignment);
			counts.set(label, (counts.get(label) ?? 0) + 1);
		}
	}
	const suggestions = Array.from(counts.entries())
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.map(([name]) => name);
	return {
		sentence: `No teacher in ${year} taught ${grade}.`,
		lead: suggestions.length > 0 ? `Subjects taught in ${grade}:` : '',
		suggestions,
		axis: 'subject',
	};
}
