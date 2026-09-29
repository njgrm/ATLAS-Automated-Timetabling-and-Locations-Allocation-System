/**
 * A8 C3 — the ONE gap-vs-blocker rule and the ONE root-cause grouping for the
 * canonical generation diagnostic.
 *
 * WHY THIS MODULE EXISTS.
 *
 * On live S.Y. 2023-2024 the canonical diagnostic reported 651 blocker rows and
 * `generateAllowed: false`, so the operator asked "Why can't I generate a
 * schedule?" and was shown 651 identical rows, each with its own "Recheck
 * generation readiness" button. 620 of those rows were ONE fact at two grains:
 * 50 classes have no Teaching Load owner, reported once per pair
 * (`TL_DEMAND_UNCOVERED`) and once per SESSION of that pair
 * (`TL_NO_QUALIFIED_OWNER`, x3 terms). 31 rows were three further root causes
 * (`WORKLOAD_POLICY_BLOCK` 15, `FACULTY_SUBJECT_NOT_QUALIFIED` 12,
 * `FACULTY_OVERLOAD` 4).
 *
 * Three rules follow, and they are deliberately kept here rather than inside
 * the readiness service so all are pure, hermetic and independently testable:
 *
 *  1. `classifyGenerationBlockers` — a GAP is a setup fact the scheduler can
 *     carry into the run (the class is listed as needing a teacher); a BLOCKER
 *     is a fact that makes a run wrong. Attribution is accepted ONLY when the
 *     violating (section, subject) pair is one the SAME diagnostic already
 *     proved has no active Teaching Load owner.
 *  2. `ADVISORY_CODES` (A8 C3 planner ruling) — the three workload/qualification
 *     codes are ADVISORY for generation in BOTH cases: attributable rows are
 *     folded into the GAP population above, and unattributable ones (a real
 *     teacher over their weekly cap names only a `facultyId`, so there is no
 *     pair to read) become their own ADVISORY class. They are recorded, counted,
 *     grouped and named in the run result; they do not stop a reviewable
 *     schedule. Every OTHER code is a BLOCKER — the rule fails closed, because a
 *     wrongly downgraded violation would ship a schedule with a real defect in
 *     it. Note this is a deliberate, bounded relaxation: it applies to exactly
 *     three codes and to nothing else.
 *  3. `buildGenerationBlockerGroups` — one line per ROOT CAUSE, counted in
 *     CLASSES, deterministic order, and derived from the blocker objects the
 *     caller already assembled. No second scheduler run, no second database
 *     read, no extra latency: this is a pure fold over an array in memory.
 *
 * NOT a schema change and not a migration: everything here is a projection of
 * data the diagnostic already loads.
 */

import type { GenerationPreflightBlocker } from './generation-preflight.service.js';

/**
 * The two codes that mean the same thing: a (section, subject) pair with no
 * active Teaching Load owner. One is stated at pair level, one at session level.
 */
export const COVERAGE_GAP_CODES: ReadonlySet<string> = new Set([
	'TL_DEMAND_UNCOVERED',
	'TL_NO_QUALIFIED_OWNER',
]);

/**
 * The three workload/qualification codes that are ADVISORY for generation.
 *
 * A8 C3 (planner ruling): these become non-blocking for GENERATION in both
 * cases, and the classification below still records every one of them:
 *
 *  - ATTRIBUTABLE (the row's `(section, subject)` pair is one this diagnostic
 *    already proved has no owner) -> GAP. The row is a consequence of the
 *    teacher gap, so it is named with it.
 *  - UNATTRIBUTABLE (a real teacher genuinely over their weekly cap, a placed
 *    class whose teacher is outside their subjects) -> ADVISORY. Still grouped,
 *    still counted, still visible, and named in the run result — it simply does
 *    not stop ATLAS from making a schedule the operator can review.
 *
 * The safety invariant this does NOT touch: publication. All three codes are on
 * `PROMOTABLE_CONSTRAINT_CODES`, and their persisted violation codes
 * (`FACULTY_OVERLOAD`, `FACULTY_SUBJECT_NOT_QUALIFIED`, `UNASSIGNED_SECTION`)
 * are on the same allowlist, so a run carrying any of them is still REFUSED by
 * the publication predicate. Generation may start; publication may not.
 */
export const ADVISORY_CODES: ReadonlySet<string> = new Set([
	'FACULTY_OVERLOAD',
	'FACULTY_SUBJECT_NOT_QUALIFIED',
	'WORKLOAD_POLICY_BLOCK',
]);

/**
 * Retained name for the same set, kept because the first A8 C3 rule it carried
 * (attribution) is unchanged: a row in this set is a GAP when it is provably a
 * consequence of an uncovered pair, and an ADVISORY when it is not.
 */
export const ATTRIBUTABLE_GAP_CODES: ReadonlySet<string> = ADVISORY_CODES;

/** The one root cause that folds both coverage codes into a single line. */
export const TEACHER_COVERAGE_CAUSE = 'TEACHER_COVERAGE_GAP';

export type GenerationBlockerUnit = 'classes' | 'items';

export interface GenerationBlockerGroupAction {
	/** A real action, never a no-op: every target is a mounted route. */
	label: string;
	target: string;
}

export interface GenerationBlockerGroup {
	/** Stable root-cause key. NOT a session and not necessarily an engine code. */
	cause: string;
	/** The representative engine code for the group (the first, sorted). */
	code: string;
	/** Every contributing code, sorted — the root cause is usually more than one. */
	codes: string[];
	/** CLASSES when `unit === 'classes'`, otherwise distinct items. Never sessions. */
	count: number;
	/** The raw blocker-row count this line folds. Never the headline number. */
	sessionCount: number;
	unit: GenerationBlockerUnit;
	/** At most five real class/item labels, no engine ids, no raw `entity` strings. */
	examples: string[];
	action: GenerationBlockerGroupAction;
}

export type GenerationBlockerClassification = {
	/** The GAP rows, in the caller's order. */
	gaps: GenerationPreflightBlocker[];
	/** The ADVISORY rows: recorded and visible, but not generation-blocking. */
	advisories: GenerationPreflightBlocker[];
	/** The BLOCKING rows, in the caller's order. */
	blocking: GenerationPreflightBlocker[];
	/** The (section, subject) pairs this diagnostic proved have no owner. */
	uncoveredPairs: Set<string>;
	/** Gap ROW count. Honest about the row-vs-class distinction. */
	gapCount: number;
	/** Advisory ROW count. */
	advisoryCount: number;
	/** Distinct CLASSES among the gaps — the number an operator can act on. */
	gapClassCount: number;
};

/** The canonical `sectionId:subjectId` key, or null when either id is unusable. */
export function pairKeyOf(sectionId: unknown, subjectId: unknown): string | null {
	if (!Number.isInteger(sectionId) || (sectionId as number) <= 0) return null;
	if (!Number.isInteger(subjectId) || (subjectId as number) <= 0) return null;
	return `${sectionId}:${subjectId}`;
}

/** Distinct (section, subject) pairs among the rows — the class-level count. */
export function countGapClasses(blockers: readonly GenerationPreflightBlocker[]): number {
	const pairs = new Set<string>();
	for (const blocker of blockers) {
		const key = pairKeyOf(blocker.sectionId, blocker.subjectId);
		if (key) pairs.add(key);
	}
	return pairs.size;
}

export function classifyGenerationBlockers(
	blockers: readonly GenerationPreflightBlocker[],
): GenerationBlockerClassification {
	// Pass 1 — the uncovered pairs are the FACTS the rest of the classification
	// is measured against, so they are collected before anything is judged.
	const uncoveredPairs = new Set<string>();
	for (const blocker of blockers) {
		if (!COVERAGE_GAP_CODES.has(blocker.code)) continue;
		const key = pairKeyOf(blocker.sectionId, blocker.subjectId);
		if (key) uncoveredPairs.add(key);
	}

	// Pass 2 — every row is placed in exactly one class. There is no fourth state
	// and no "unknown", so a count can never silently drop a row.
	const gaps: GenerationPreflightBlocker[] = [];
	const advisories: GenerationPreflightBlocker[] = [];
	const blocking: GenerationPreflightBlocker[] = [];
	for (const blocker of blockers) {
		const key = pairKeyOf(blocker.sectionId, blocker.subjectId);
		const attributable = ADVISORY_CODES.has(blocker.code) && key !== null && uncoveredPairs.has(key);
		if (COVERAGE_GAP_CODES.has(blocker.code) || attributable) gaps.push(blocker);
		else if (ADVISORY_CODES.has(blocker.code)) advisories.push(blocker);
		else blocking.push(blocker);
	}

	return {
		gaps,
		advisories,
		blocking,
		uncoveredPairs,
		gapCount: gaps.length,
		advisoryCount: advisories.length,
		gapClassCount: countGapClasses(gaps),
	};
}

export type GenerateDecisionInput = {
	blockingBlockerCount: number;
	schedulerRan: boolean;
	hardCount: number;
	/** HARD violations that are PROVABLY a consequence of an uncovered pair. */
	hardGapCount: number;
	/**
	 * HARD violations in `ADVISORY_CODES` that could NOT be attributed to an
	 * uncovered pair. They are reported and grouped, and they do not stop a
	 * reviewable run; they still refuse publication, which is unchanged.
	 */
	advisoryHardCount: number;
	zeroWrite: boolean;
};

export type GenerateDecision = {
	generateAllowed: boolean;
	status: 'READY' | 'BLOCKED';
	blockingHardCount: number;
};

/**
 * The generation gate, in ONE place.
 *
 * `blockingHardCount` is `hardCount` minus the hard violations the
 * classification resolved as gaps, minus the advisory-class hard violations.
 * A gap or an advisory can therefore never let a run through when a REAL hard
 * violation exists, when the scheduler dry run did not execute, when another
 * blocker code is present, or when the diagnostic was not zero-write.
 * `status` is derived from the same expression, so the two can never disagree.
 */
export function deriveGenerateDecision(input: GenerateDecisionInput): GenerateDecision {
	const blockingHardCount = Math.max(0, input.hardCount - input.hardGapCount - input.advisoryHardCount);
	const generateAllowed = input.blockingBlockerCount === 0
		&& input.schedulerRan
		&& blockingHardCount === 0
		&& input.zeroWrite;
	return { generateAllowed, status: generateAllowed ? 'READY' : 'BLOCKED', blockingHardCount };
}

/* ------------------------------------------------------------------ *
 * Root-cause grouping
 * ------------------------------------------------------------------ */

const TEACHING_LOAD_ACTION: GenerationBlockerGroupAction = { label: 'Assign teachers', target: '/teaching-load' };
const LOAD_REVIEW_ACTION: GenerationBlockerGroupAction = { label: 'Review their load', target: '/teaching-load' };
const ROOM_ACTION: GenerationBlockerGroupAction = { label: 'Review rooms', target: '/map' };
const YEAR_SETUP_ACTION: GenerationBlockerGroupAction = { label: 'Open Year Setup', target: '/admin/year-setup' };

/**
 * The action for one root cause. Every branch resolves to a MOUNTED route, so a
 * group line can never offer a no-op. The fallbacks are ordered and
 * deterministic: an unknown code is sent to Year Setup, the one surface that
 * repairs school-year/term/policy authority, rather than inventing a label.
 */
export function actionForCause(cause: string): GenerationBlockerGroupAction {
	if (cause === TEACHER_COVERAGE_CAUSE) return TEACHING_LOAD_ACTION;
	if (cause === 'WORKLOAD_POLICY_BLOCK' || cause === 'FACULTY_OVERLOAD' || cause === 'FACULTY_SUBJECT_NOT_QUALIFIED') return LOAD_REVIEW_ACTION;
	if (cause === 'TL_OWNERSHIP_CONFLICT' || cause === 'TEACHING_LOAD_REVIEW_REQUIRED') return TEACHING_LOAD_ACTION;
	if (cause === 'ROOM_RESOURCE_UNAVAILABLE') return ROOM_ACTION;
	if (cause.includes('ROOM')) return ROOM_ACTION;
	if (cause.includes('TEACHING_LOAD') || cause.includes('OWNER') || cause.includes('TL_')) return TEACHING_LOAD_ACTION;
	return YEAR_SETUP_ACTION;
}

const MAX_EXAMPLES = 5;

export type GenerationBlockerGroupsInput = {
	blockers: readonly GenerationPreflightBlocker[];
	/**
	 * The operator label for a (section, subject) pair, built by the caller from
	 * data the diagnostic has ALREADY loaded — a second read is never made for
	 * presentation. Returning null makes the group fall back to a plain class
	 * label built from the subject code.
	 */
	labelFor?: (sectionId: number, subjectId: number | null, subjectCode: string | null) => string | null;
};

/**
 * Fold the assembled blocker rows into one line per ROOT CAUSE.
 *
 * The two coverage codes share one cause, which is the whole point: 570 session
 * rows and 50 pair rows for the same 50 classes become ONE line reading
 * "50 classes", with the 620 row count still available as `sessionCount` so
 * nothing is hidden. Every other code is its own root cause and therefore its
 * own line.
 *
 * Deterministic: groups are sorted by count desc then cause asc, examples are
 * taken in first-appearance order over the caller's own sorted rows, and the
 * result depends only on the SET of rows (not their order — the caller may pass
 * any order, including a reversed one).
 */
export function buildGenerationBlockerGroups(input: GenerationBlockerGroupsInput): GenerationBlockerGroup[] {
	const byCause = new Map<string, GenerationPreflightBlocker[]>();
	for (const blocker of input.blockers) {
		const cause = COVERAGE_GAP_CODES.has(blocker.code) ? TEACHER_COVERAGE_CAUSE : blocker.code;
		const list = byCause.get(cause);
		if (list) list.push(blocker);
		else byCause.set(cause, [blocker]);
	}

	const groups: GenerationBlockerGroup[] = [];
	for (const [cause, rows] of byCause) {
		const codes = [...new Set(rows.map((row) => row.code))].sort();
		// A group counts CLASSES when every one of its rows names a real
		// (section, subject) pair; a year-wide row (a teacher over their cap, a
		// missing template) has no class and is counted as an ITEM, never faked
		// up as a class. The coverage group mixes a pair-level row and its
		// session rows, so the test is "does every row name a class", not "does
		// every row name a DIFFERENT class".
		const pairKeys = rows.map((row) => pairKeyOf(row.sectionId, row.subjectId));
		const unit: GenerationBlockerUnit = pairKeys.every((key) => key !== null) ? 'classes' : 'items';
		// An item is a distinct THING, not a distinct sentence. A year-wide cause
		// such as `FACULTY_OVERLOAD` produces rows whose `entity` is the same
		// string for every teacher ("Run validation · FACULTY_OVERLOAD"), so the
		// entity alone would report 4 overloaded teachers as 1. The `reason` of a
		// validator row names the subject of the finding, so the composite counts
		// the things an operator must actually fix.
		const count = unit === 'classes'
			? new Set(pairKeys).size
			: new Set(rows.map((row) => `${row.entity} ${row.reason}`)).size;

		// Examples are the most frequent real classes, then alphabetical, so the
		// list depends on the SET of rows and never on the order they arrived in.
		const exampleCounts = new Map<string, number>();
		for (const row of rows) {
			const label = exampleLabel(row, input.labelFor);
			if (label === null) continue;
			exampleCounts.set(label, (exampleCounts.get(label) ?? 0) + 1);
		}
		const examples = [...exampleCounts.entries()]
			.sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
			.slice(0, MAX_EXAMPLES)
			.map(([label]) => label);

		groups.push({
			cause,
			code: codes[0] ?? cause,
			codes,
			count,
			sessionCount: rows.length,
			unit,
			examples,
			action: actionForCause(cause),
		});
	}

	return groups.sort((a, b) => (b.count - a.count) || a.cause.localeCompare(b.cause));
}

function exampleLabel(
	blocker: GenerationPreflightBlocker,
	labelFor: GenerationBlockerGroupsInput['labelFor'],
): string | null {
	const hasSection = Number.isInteger(blocker.sectionId) && (blocker.sectionId as number) > 0;
	const hasSubject = Number.isInteger(blocker.subjectId) && (blocker.subjectId as number) > 0;
	if (hasSection && hasSubject && labelFor) {
		const label = labelFor(blocker.sectionId as number, blocker.subjectId as number, blocker.subjectCode);
		if (typeof label === 'string' && label.trim().length > 0) return label.trim();
	}
	// A subject-scoped row with no class still names a real subject, never an id.
	if (!hasSection && typeof blocker.subjectCode === 'string' && blocker.subjectCode.length > 0) {
		return blocker.subjectCode;
	}
	return null;
}
