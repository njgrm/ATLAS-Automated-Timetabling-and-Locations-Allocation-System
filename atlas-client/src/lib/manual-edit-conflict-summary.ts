/**
 * A2 mc, S4 — the Conflict Inspector speaks plain words, once.
 *
 * THREE LEAKS, all measured at base `c57b8e1d`:
 *
 *  1. RAW ENGINE CODES. `manual-edit.service.ts:919` read
 *     `VIOLATION_TITLES[v.code] ?? v.code`, and `VIOLATION_TITLES` has no entry
 *     for `SECTION_TIME_CONFLICT`, `ROOM_CAPACITY_EXCEEDED`, `UNASSIGNED_SECTION`
 *     or `INCOMPLETE_MODULAR_GROUP` — so the raw code is literally what rendered.
 *  2. RAW INVARIANT TEXT. `manual-edit.service.ts:451` composed
 *     `Manual candidate ${entry.entryId} rejected by shared invariant: ${reason}.`
 *     and `buildHumanConflicts` falls back to `v.message` for any code without a
 *     `case`, so that engine sentence reached the operator as `humanDetail`.
 *  3. ONE CARD PER SOFT VIOLATION. 525 rows on the operator's drill.
 *
 * THIS MODULE is the client half of the fix. The server half extends
 * `VIOLATION_TITLES` and composes the manual-candidate message for the operator;
 * this module is the RENDERING GUARD that makes the raw token unreachable even
 * when an older server (or a path this slice did not reach) still sends one.
 * The guard is deliberately total: an unmapped code becomes a plain sentence,
 * never the code.
 */

import type { HumanConflict } from '@/types';

/* ─── Plain titles ─── */

/**
 * Every code the manual-edit preview path can emit, in the operator's words.
 *
 * The HARD entries reuse the wording ALREADY APPROVED on this surface in
 * `simple/SimpleTaskDrawerHelpers.tsx` `HARD_VIOLATION_GROUP_MAP`, so the
 * preview and Publish Readiness cannot drift into two names for one rule. The
 * SOFT entries are the plain rewording of `manual-edit.service.ts`
 * `VIOLATION_TITLES`, which was written in engine nouns ("Faculty Time
 * Conflict").
 */
export const MANUAL_EDIT_PLAIN_TITLES: Record<string, string> = {
	// HARD — the publication-blocking family. Wording from HARD_VIOLATION_GROUP_MAP.
	FACULTY_TIME_CONFLICT: 'Teacher double-booked',
	ROOM_TIME_CONFLICT: 'Room double-booked',
	SECTION_TIME_CONFLICT: 'Section double-booked',
	FACULTY_OVERLOAD: 'Teacher overloaded',
	FACULTY_SUBJECT_NOT_QUALIFIED: 'Teacher not qualified for subject',
	LACKING_FACULTY: 'Missing teacher for this class',
	INCOMPLETE_MODULAR_GROUP: 'Incomplete modular group',
	ROOM_TYPE_MISMATCH: 'Room type mismatch',
	ROOM_FEATURE_MISMATCH: 'Room missing a required feature',
	FACULTY_DAILY_MAX_EXCEEDED: 'Daily maximum exceeded',
	ROOM_CAPACITY_EXCEEDED: 'Room is too small for this class',
	UNASSIGNED_SECTION: 'This class was not placed',

	// SOFT — reviewable, not blocking.
	FACULTY_CONSECUTIVE_LIMIT_EXCEEDED: 'Too many periods in a row',
	FACULTY_BREAK_REQUIREMENT_VIOLATED: 'Break requirement not met',
	FACULTY_DAILY_STANDARD_EXCEEDED: 'More teaching minutes than the daily target',
	FACULTY_EXCESSIVE_BUILDING_TRANSITIONS: 'Too many building changes in a day',
	FACULTY_INSUFFICIENT_TRANSITION_BUFFER: 'Not enough time to move between buildings',
	FACULTY_EXCESSIVE_IDLE_GAP: 'A long gap between this teacher’s classes',
	FACULTY_EARLY_START_PREFERENCE: 'Early start preference',
	FACULTY_LATE_END_PREFERENCE: 'Late finish preference',
	FACULTY_INSUFFICIENT_DAILY_VACANT: 'Not enough free time in the day',
	FACULTY_LUNCH_WINDOW_VIOLATION: 'No free lunch window for this teacher',
	SPECIALIZED_ROOM_UNAVAILABLE: 'Specialized room unavailable',
	SECTION_OVERCOMPRESSED: 'Class is packed too tightly',
};

/** An unmapped code never renders as a code. */
export const UNNAMED_RULE_TITLE = 'A scheduling rule needs attention';

/** A raw engine token: at least one underscore, all caps/digits. */
const ENGINE_TOKEN = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g;
/**
 * The same shape WITHOUT `/g`.
 *
 * A `/g` regex carries `lastIndex` between calls, so `.test()` on it alternates
 * true/false across calls — a guard that silently lets the second token through.
 * The probe must be stateless.
 */
const ENGINE_TOKEN_PROBE = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/;

/** The engine sentence `manual-edit.service.ts:451` composed. */
const MANUAL_CANDIDATE_PREFIX = /^\s*manual candidate\s+\S+\s+rejected by shared invariant:?\s*/i;

/**
 * The title the operator reads.
 *
 * A server title is trusted only when it is not itself a raw token; otherwise the
 * client's own plain map decides, and a code nobody mapped degrades to
 * `UNNAMED_RULE_TITLE` rather than printing the enum.
 */
export function plainConflictTitle(code: string, serverTitle: string | null | undefined): string {
	const mapped = MANUAL_EDIT_PLAIN_TITLES[code];
	if (mapped) return mapped;
	const server = (serverTitle ?? '').trim();
	if (server && !ENGINE_TOKEN_PROBE.test(server)) return server;
	return UNNAMED_RULE_TITLE;
}

/**
 * The detail the operator reads.
 *
 * Three passes, in order:
 *   1. the manual-candidate invariant prefix becomes a sentence about the refusal;
 *   2. any residual engine phrase is restated in words;
 *   3. any residual raw token is replaced by its plain title, or by
 *      `a scheduling rule` when it is unknown — so the token itself is
 *      unreachable from any rendered text.
 */
export function plainConflictDetail(code: string, serverDetail: string | null | undefined): string {
	const raw = (serverDetail ?? '').trim();
	if (!raw) return '';
	if (MANUAL_CANDIDATE_PREFIX.test(raw)) {
		const reason = raw.replace(MANUAL_CANDIDATE_PREFIX, '').trim();
		return reason
			? `ATLAS refused this change because it breaks a rule every class must follow: ${scrubTokens(reason)}.`
			: 'ATLAS refused this change because it breaks a rule every class must follow.';
	}
	return scrubTokens(raw.replace(/rejected by shared invariant/gi, 'broke a scheduling rule'))
		.replace(/manual candidate/gi, 'this class');
}

function scrubTokens(text: string): string {
	return text.replace(ENGINE_TOKEN, (token) => MANUAL_EDIT_PLAIN_TITLES[token] ?? 'a scheduling rule');
}

/* ─── Summaries: blockers first, deduplicated; soft warnings by cause ─── */

export type PlainConflict = {
	code: string;
	severity: 'HARD' | 'SOFT';
	humanTitle: string;
	humanDetail: string;
	delta?: string;
};

/** One plain conflict, derived through the guard. Never holds a raw token. */
export function toPlainConflict(conflict: HumanConflict): PlainConflict {
	return {
		code: conflict.code,
		severity: conflict.severity,
		humanTitle: plainConflictTitle(conflict.code, conflict.humanTitle),
		humanDetail: plainConflictDetail(conflict.code, conflict.humanDetail),
		delta: conflict.delta,
	};
}

export type HardConflictSummary = PlainConflict & {
	/** How many times the server reported this SAME blocker. */
	occurrences: number;
};

export type SoftConflictSummary = {
	code: string;
	humanTitle: string;
	/** How many warnings share this cause. */
	count: number;
	/** The first such warning, in the operator's words. */
	exampleDetail: string;
	/** The plain next step for this cause. */
	nextStep: string;
	/** Whether the warnings of this cause all read the same. */
	sameDetail: boolean;
};

/**
 * The plain next step per SOFT cause.
 *
 * 525 cards became 525 identical instructions; this is the one line per cause
 * that says what to do instead. `DEFAULT_SOFT_NEXT_STEP` is honest for a cause
 * nobody has a specific instruction for — it says to review, not to fix.
 */
export const SOFT_CONFLICT_NEXT_STEPS: Record<string, string> = {
	FACULTY_CONSECUTIVE_LIMIT_EXCEEDED: 'Break the run of periods, or move one class to another day.',
	FACULTY_BREAK_REQUIREMENT_VIOLATED: 'Shorten the teaching day or move a class so the break fits.',
	FACULTY_DAILY_STANDARD_EXCEEDED: 'Move one class to a lighter day.',
	FACULTY_EXCESSIVE_BUILDING_TRANSITIONS: 'Group this teacher’s classes by building where you can.',
	FACULTY_INSUFFICIENT_TRANSITION_BUFFER: 'Move a class so there is walking time between buildings.',
	FACULTY_EXCESSIVE_IDLE_GAP: 'Move a class into the gap, or accept the gap as part of the day.',
	FACULTY_EARLY_START_PREFERENCE: 'Move the first class later if the day allows.',
	FACULTY_LATE_END_PREFERENCE: 'Move the last class earlier if the day allows.',
	FACULTY_INSUFFICIENT_DAILY_VACANT: 'Leave one free period in this teacher’s day.',
	FACULTY_LUNCH_WINDOW_VIOLATION: 'Free one period across the lunch window for this teacher.',
	SPECIALIZED_ROOM_UNAVAILABLE: 'Give this class a room with the feature it needs.',
	SECTION_OVERCOMPRESSED: 'Spread this class’s periods out, or accept a lighter day.',
};

export const DEFAULT_SOFT_NEXT_STEP = 'Review these warnings. They do not block publishing.';

/**
 * HARD first, then SOFT, each deduplicated.
 *
 * A blocker reported for ten sections is ONE cause, not ten cards: it is
 * deduplicated on `(code, title, detail)` and rendered once with its count, so
 * the operator reads the cause and the count instead of scrolling a repeated
 * sentence. The relative order of first appearance is preserved inside each
 * severity, so nothing is silently reordered.
 */
export function summarizeConflicts(conflicts: readonly HumanConflict[]): {
	hard: HardConflictSummary[];
	soft: SoftConflictSummary[];
} {
	const plain = conflicts.map(toPlainConflict);
	const hard: HardConflictSummary[] = [];
	const hardIndex = new Map<string, HardConflictSummary>();

	for (const conflict of plain.filter((c) => c.severity === 'HARD')) {
		const key = `${conflict.code} ${conflict.humanTitle} ${conflict.humanDetail}`;
		const existing = hardIndex.get(key);
		if (existing) {
			existing.occurrences += 1;
			continue;
		}
		const summary: HardConflictSummary = { ...conflict, occurrences: 1 };
		hardIndex.set(key, summary);
		hard.push(summary);
	}

	const softOrder: string[] = [];
	const softMap = new Map<string, SoftConflictSummary>();
	for (const conflict of plain.filter((c) => c.severity === 'SOFT')) {
		const key = `${conflict.code} ${conflict.humanTitle}`;
		let summary = softMap.get(key);
		if (!summary) {
			summary = {
				code: conflict.code,
				humanTitle: conflict.humanTitle,
				count: 0,
				exampleDetail: conflict.humanDetail,
				nextStep: SOFT_CONFLICT_NEXT_STEPS[conflict.code] ?? DEFAULT_SOFT_NEXT_STEP,
				sameDetail: true,
			};
			softMap.set(key, summary);
			softOrder.push(key);
		}
		summary.count += 1;
		if (conflict.humanDetail !== summary.exampleDetail) summary.sameDetail = false;
	}

	return { hard, soft: softOrder.map((key) => softMap.get(key)!) };
}

/** The literal the operator reads while the server is still deciding. */
export const CHECKING_THIS_CHANGE = 'Checking this change…';
