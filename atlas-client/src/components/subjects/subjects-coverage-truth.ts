/**
 * A6 c10 — THE COVERAGE TRUTH A SUBJECT LIST MAY PRINT, and the one rule behind it.
 *
 * THE DEFECT, quoted from the Codex audit of 2026-09-29 against
 * `https://njgrm.buru-degree.ts.net` (release `e75d6b8f`): on `/subjects` it saw
 * "21 active subjects, MISSING COVERAGE 0", a per-row "Full coverage", and
 * "Review coverage" — while the Teaching Load header on the same deployment said
 * "72 classes short" and "72 classes still need a real teacher". Both were true
 * of the same data, and the difference was a to-be-hired record.
 *
 * WHY THE TWO NUMBERS COULD NOT BE RECONCILED. `/faculty-assignments/coverage/summary`
 * counts a class as covered when a pair exists, and a pair exists when a
 * placeholder holds it. So `uncoveredSectionCount` is 0 for a subject whose every
 * class sits on a "— TO BE HIRED, MAPEH —" record, and the page had no second
 * number to contradict it. The audit's own conclusion — "Full coverage conflicts
 * with the Teaching Load shortage language" — is the arithmetic of that: it is not
 * a wording problem, it is a missing input.
 *
 * THE RULE, stated once so no surface can hold a different one:
 *
 *     a class is COVERED only when a REAL teacher holds it, so
 *     `covered = (assignedSectionCount - placeholderHeldSectionCount)`
 *     and a subject is FULLY covered only when `uncovered === 0 AND
 *     placeholderHeld === 0`.
 *
 * `placeholderHeldSectionCount` comes from the roster the page already reads
 * (`/faculty-assignments/summary`, the same read the coverage detail uses), so
 * this is not a client guess about staffing: it is the roster's own `isPlaceholder`
 * flag, counted over the sections those records actually hold. A8 c4's
 * `cover-open-classes` read is the server's version of the same arithmetic
 * (contract §3) and will corroborate it; until it is deployed this is computed
 * from the two reads the page genuinely has.
 *
 * WHY "TEMPORARY COVERAGE" IS ITS OWN WORD. The audit asked for the two to be
 * distinguished, not merged: a scheduler looking at a green row needs to know
 * whether a person is teaching that class or a placeholder is. So the label has
 * three honest states and never prints `Full coverage` over a placeholder.
 */
import { openClassIsUnstaffed } from '@/components/faculty-assignments/coverClassCandidates';

/** The minimum a coverage row needs. Both numbers are counts of CLASSES. */
export type SubjectCoverageTruthInput = {
	/** `SubjectCoverageRow.uncoveredSectionCount` — pairs with no owner at all. */
	uncoveredSectionCount: number;
	/** Classes this subject's placeholders hold. See `countPlaceholderHeldClasses`. */
	placeholderHeldSectionCount: number;
};

export type SubjectCoverageVerdict = {
	/** `true` only when every class of this subject has a REAL teacher. */
	fullyCoveredByRealTeachers: boolean;
	/** Classes that are not covered by a real teacher: unowned PLUS placeholder-held. */
	openClassCount: number;
	/** The one line the row may print. Never `Full coverage` over a placeholder. */
	label: string;
	/** The tone, so a warning row looks like a warning on every surface. */
	tone: 'success' | 'warning';
};

/** `— TO BE HIRED, MAPEH — · 3 classes` — the honest count of what is standing in. */
export const PLACEHOLDER_HELD_LABEL = (count: number): string =>
	`Covered by a to-be-hired teacher (${count})`;

export const FULL_COVERAGE_LABEL = 'Full coverage';

/**
 * How many classes a subject's to-be-hired records are holding.
 *
 * A placeholder is counted by the SECTIONS it holds for THAT subject, not by the
 * number of placeholder rows: one to-be-hired record covering six MAPEH classes is
 * six open classes, and a count of records would understate the outage by exactly
 * the factor that makes it invisible.
 */
export function countPlaceholderHeldClasses(
	assigned: ReadonlyArray<{ isPlaceholder: boolean; sections: ReadonlyArray<unknown> }>,
): number {
	return assigned.reduce(
		(total, row) => (row.isPlaceholder ? total + row.sections.length : total),
		0,
	);
}

/**
 * THE DECISION. One function, three consumers: the status filter, the header
 * count, and the row's own line.
 *
 * `openClassCount` is deliberately the SUM of the two failure modes, so the row's
 * figure and the Teaching Load header's figure are the same quantity computed
 * the same way — which is the reconciliation the audit found missing.
 */
export function subjectCoverageVerdict(input: SubjectCoverageTruthInput): SubjectCoverageVerdict {
	const uncovered = Math.max(0, input.uncoveredSectionCount);
	const placeholderHeld = Math.max(0, input.placeholderHeldSectionCount);
	const open = uncovered + placeholderHeld;
	if (open === 0) {
		return { fullyCoveredByRealTeachers: true, openClassCount: 0, label: FULL_COVERAGE_LABEL, tone: 'success' };
	}
	return {
		fullyCoveredByRealTeachers: false,
		openClassCount: open,
		label: placeholderHeld > 0 && uncovered === 0
			? PLACEHOLDER_HELD_LABEL(placeholderHeld)
			: `${open} ${open === 1 ? 'class needs' : 'classes need'} a real teacher`,
		tone: 'warning',
	};
}

/**
 * Whether a subject belongs in the `missing coverage` filter.
 *
 * A6 c10: this used to be `uncoveredSectionCount > 0` alone, so a subject held
 * entirely by to-be-hired records was FILTERED OUT of the one filter whose job
 * is to find them. It now goes through the same verdict as the row's label, so the
 * filter and the label cannot disagree about which subjects are short.
 */
export function subjectNeedsRealTeacher(input: SubjectCoverageTruthInput): boolean {
	return !subjectCoverageVerdict(input).fullyCoveredByRealTeachers;
}

/**
 * The per-class half, for a coverage detail that lists classes.
 *
 * It exists so the detail and the header share ONE definition of "this class is
 * open" — `openClassIsUnstaffed` — rather than the detail asking `heldBy != null`
 * while the header asks the same question differently. That divergence is the
 * defect, so the predicate is imported from the one module that owns it rather
 * than restated here.
 */
export { openClassIsUnstaffed };
