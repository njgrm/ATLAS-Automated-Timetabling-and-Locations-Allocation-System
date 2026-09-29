/**
 * A8-C5 S2.1 / S2.4 — the ONE code → sentence → route table.
 *
 * The operator's question, verbatim (`a8-c5-generation-always-fixable-2026-09-29.md`):
 * *"After train 10, can we expect that timetable will always be available and/or
 * fixable? We can't have this happening."* Rule 2: **inventory every hard blocker
 * code the preflight can emit; for each, name its fix page and write the
 * sentence. A code with no fix page is a defect.**
 *
 * WHY ONE TABLE. Before this, three places each decided what a code meant:
 * `GROUP_CAUSE_COPY` (the panel headline), `actionForCause` (the fix button) and
 * `deriveTimetableReadinessRepair` (the per-blocker repair). They could disagree,
 * and an unmapped code silently fell through to "Open Year Setup" — a button that
 * does not fix the thing it names. One table, one row per code, consumed by all
 * three, is the only shape in which "every code has a fix page" is a decidable
 * property rather than a hope.
 *
 * A code with no fix page IS a defect, and the table says so out loud: every entry
 * carries `advisoryWithReason` when the code is not a hard blocker at all. There
 * is no such row today, and `a8-c5-blocker-code-table.test.tsx` fails if one is
 * added without a written reason — which is the packet's "or make it advisory and
 * write the reason in the table".
 *
 * PLAIN-WORD RULES EVERY ROW OBEYS (the packet's rule 1 and 3, and AGENTS.md §8):
 *   - a NOUN COUNT, not a session count: the count a scheduler can act on;
 *   - NO engine code, NO id, NO `entity` string, NO ellipsis, no jargon;
 *   - ONE fix button per cause, to a ROUTE THAT IS MOUNTED — asserted against the
 *     real `appRoutes` table, not against a list of strings someone agreed with.
 *
 * The inventory itself is server-owned: `PREFLIGHT_BLOCKER_CODES` below is the
 * transcription of what `generation-preflight.service.ts` can emit (its literal
 * `code:` values plus `classifyShapePolicyBlocker`'s pass-through and
 * `classifyDemandBlocker`'s `DerivedDemandBlockerCode` union), and
 * `a8-c5-blocker-code-table.test.tsx` reads the SERVER SOURCE to prove the two
 * cannot drift. Presentation only — no gate, no authority, no server behaviour is
 * decided here.
 */

/** One row of the table. */
export type BlockerCodeCopy = {
	/**
	 * The plain sentence, as a TEMPLATE. `{count}` is replaced with the count in
	 * CLASSES; `{one}` is 'is' for a single item and '' otherwise, so a row never
	 * has to carry two spellings of its own verb.
	 */
	readonly sentence: string;
	/** The count noun in the plural, e.g. `classes`. Used for the headline. */
	readonly noun: string;
	/** ONE real fix route. Must be a mounted route — asserted against `appRoutes`. */
	readonly route: string;
	/** The ONE button label. Short, a verb, no question mark. */
	readonly buttonLabel: string;
	/**
	 * Set ONLY when the code is not a hard blocker. The value is the WRITTEN
	 * reason, which the test requires to be non-empty. A row without this is a
	 * hard blocker and must carry a real fix route.
	 */
	readonly advisoryWithReason?: string;
};

/** Format one row's sentence with a class count. Exported for the panel and the test. */
export function blockerSentence(code: string, count: number): string {
	const row = BLOCKER_CODE_COPY[code];
	if (!row) return `${count} ${count === 1 ? 'item needs' : 'items need'} attention`;
	const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
	return row.sentence
		.replace('{count}', String(safeCount))
		.replace('{one}', safeCount === 1 ? 'is' : 'are')
		.replace(/\{onePlural\}/g, safeCount === 1 ? 'needs' : 'need');
}

/** The ONE fix action for a code, or null when the code has no row. */
export function blockerFixAction(code: string): { label: string; href: string } | null {
	const row = BLOCKER_CODE_COPY[code];
	if (!row) return null;
	return { label: row.buttonLabel, href: row.route };
}

/**
 * The inventory, in the order the packet lists it. Every code the canonical
 * preflight can reach has a row — that is what the table-driven test decides.
 */
export const PREFLIGHT_BLOCKER_CODES = [
	// Coverage / Teaching Load (the two-grain pair folds into one cause).
	'TL_DEMAND_UNCOVERED',
	'TL_NO_QUALIFIED_OWNER',
	'TL_OWNERSHIP_CONFLICT',
	'TEACHING_LOAD_REVIEW_REQUIRED',
	'WORKLOAD_POLICY_BLOCK',
	// A8-C5 S1.2's third state.
	'SYNTHETIC_PLACEHOLDER_OWNED',
	// Shape and capacity.
	'CANONICAL_SHAPE_CAPACITY_EXCEEDED',
	'CANONICAL_SHAPE_VIOLATION',
	'CANONICAL_TEMPLATE_INCOMPLETE',
	// Rooms.
	'ROOM_RESOURCE_UNAVAILABLE',
	'ROOMS_MISSING',
	// Policy and windows.
	'POLICY_WINDOW_BLOCK',
	'POLICY_UNINITIALIZED',
	'GRADE_WINDOW_MISSING',
	// Term and year authority (shape-policy pass-through + demand authority).
	'TERM_CACHE_MISSING',
	'TERM_AUTHORITY_STALE',
	'TERM_AUTHORITY_UNRESOLVED',
	'ROTATION_TERM_INVALID',
	// Sections.
	'SECTION_SETUP_REQUIRED',
	// Demand.
	'EMPTY_DERIVED_DEMAND',
	// Misc policy.
	'FLAG_CEREMONY_SCOPE_INVALID',
	// Search budget.
	'SEARCH_LIMIT_UNRESOLVED',
	// The `DerivedDemandBlockerCode` union `classifyDemandBlocker` passes through.
	'ACTIVE_YEAR_UNAVAILABLE',
	'ACTIVE_YEAR_AMBIGUOUS',
	'INACTIVE_HISTORICAL_YEAR',
	'TERM_STRUCTURE_UNAVAILABLE',
	'TERM_STRUCTURE_EMPTY',
	'ROTATION_FAMILY_MISSING',
	'ROTATION_ORDER_MISSING',
	'ROTATION_ORDER_OUT_OF_RANGE',
	'ROTATION_ORDER_DUPLICATE',
	'ROTATION_INCOMPLETE',
] as const;

export type PreflightBlockerCode = (typeof PREFLIGHT_BLOCKER_CODES)[number];

/**
 * The table. Presentation only; the count is always supplied by the server.
 *
 * Wording decisions, one per family, so two rows never read as the same problem:
 *  - a class COUNT noun everywhere a (section, subject) pair exists;
 *  - `are`/`is` supplied by `{one}` so a row never spells both forms;
 *  - verbs in the second person the operator uses ("have no suitable room").
 */
export const BLOCKER_CODE_COPY: Record<string, BlockerCodeCopy> = {
	// ── Teaching Load coverage ──────────────────────────────────────────────
	TL_DEMAND_UNCOVERED: {
		sentence: '{count} {one} without a teacher',
		noun: 'classes',
		route: '/teaching-load',
		buttonLabel: 'Assign teachers',
	},
	TL_NO_QUALIFIED_OWNER: {
		sentence: '{count} {one} without a teacher',
		noun: 'classes',
		route: '/teaching-load',
		buttonLabel: 'Assign teachers',
	},
	TL_OWNERSHIP_CONFLICT: {
		sentence: '{count} {one} with more than one teacher',
		noun: 'classes',
		route: '/teaching-load',
		buttonLabel: 'Resolve the conflict',
	},
	TEACHING_LOAD_REVIEW_REQUIRED: {
		sentence: '{count} {one} with no teaching load yet',
		noun: 'classes',
		route: '/teaching-load',
		buttonLabel: 'Review teaching load',
	},
	WORKLOAD_POLICY_BLOCK: {
		sentence: '{count} {one} with a teacher at their weekly limit',
		noun: 'classes',
		route: '/teaching-load',
		buttonLabel: 'Review teaching load',
	},
	// ── A8-C5 S1.2: the third ownership state ───────────────────────────────
	SYNTHETIC_PLACEHOLDER_OWNED: {
		sentence: '{count} {one} on a to-be-hired teacher',
		noun: 'classes',
		route: '/teaching-load',
		buttonLabel: 'See the to-be-hired list',
	},
	// ── Shape and capacity ──────────────────────────────────────────────────
	CANONICAL_SHAPE_CAPACITY_EXCEEDED: {
		sentence: '{count} {one} with more lessons than the week allows',
		noun: 'classes',
		route: '/admin/year-setup',
		buttonLabel: 'Review the timetable shape',
	},
	CANONICAL_SHAPE_VIOLATION: {
		sentence: '{count} {one} outside the approved lesson shape',
		noun: 'classes',
		route: '/admin/year-setup',
		buttonLabel: 'Review the timetable shape',
	},
	CANONICAL_TEMPLATE_INCOMPLETE: {
		sentence: '{count} {one} with no lesson rows in the timetable',
		noun: 'class groups',
		route: '/admin/year-setup',
		buttonLabel: 'Add the lesson rows',
	},
	// ── Rooms ───────────────────────────────────────────────────────────────
	ROOM_RESOURCE_UNAVAILABLE: {
		sentence: '{count} {one} with no suitable room',
		noun: 'classes',
		route: '/campus-rooms',
		buttonLabel: 'Review rooms',
	},
	ROOMS_MISSING: {
		sentence: '{count} {one} with no teaching room available',
		noun: 'class groups',
		route: '/campus-rooms',
		buttonLabel: 'Add teaching rooms',
	},
	// ── Policy and windows ──────────────────────────────────────────────────
	POLICY_WINDOW_BLOCK: {
		sentence: '{count} {one} with no time window allowed by the policy',
		noun: 'classes',
		route: '/admin/year-setup',
		buttonLabel: 'Open the time windows',
	},
	POLICY_UNINITIALIZED: {
		sentence: '{count} {one} waiting on the scheduling policy',
		noun: 'class groups',
		route: '/admin/year-setup',
		buttonLabel: 'Set the scheduling policy',
	},
	GRADE_WINDOW_MISSING: {
		sentence: '{count} {one} with no time window for that grade',
		noun: 'class groups',
		route: '/admin/year-setup',
		buttonLabel: 'Open the time windows',
	},
	// ── Term and year authority ─────────────────────────────────────────────
	TERM_CACHE_MISSING: {
		sentence: '{count} {one} waiting on the term list from EnrollPro',
		noun: 'class groups',
		route: '/admin/year-setup',
		buttonLabel: 'Check the term list',
	},
	TERM_AUTHORITY_STALE: {
		sentence: '{count} {one} on an out-of-date term list',
		noun: 'class groups',
		route: '/admin/year-setup',
		buttonLabel: 'Refresh the term list',
	},
	TERM_AUTHORITY_UNRESOLVED: {
		sentence: '{count} {one} with no term set for this school year',
		noun: 'class groups',
		route: '/admin/year-setup',
		buttonLabel: 'Set the school year terms',
	},
	ROTATION_TERM_INVALID: {
		sentence: '{count} {one} with a rotating subject outside its terms',
		noun: 'class groups',
		route: '/subjects',
		buttonLabel: 'Review the rotating subjects',
	},
	// ── Sections ────────────────────────────────────────────────────────────
	SECTION_SETUP_REQUIRED: {
		sentence: '{count} {one} not set up yet',
		noun: 'sections',
		route: '/sections',
		buttonLabel: 'Open Sections',
	},
	// ── Demand ──────────────────────────────────────────────────────────────
	EMPTY_DERIVED_DEMAND: {
		sentence: '{count} {one} with no lessons to place',
		noun: 'class groups',
		route: '/sections',
		buttonLabel: 'Check the sections',
	},
	// ── Misc policy ─────────────────────────────────────────────────────────
	FLAG_CEREMONY_SCOPE_INVALID: {
		sentence: '{count} {one} with a flag ceremony outside its scope',
		noun: 'class groups',
		route: '/admin/year-setup',
		buttonLabel: 'Review the flag ceremony',
	},
	// ── Search budget ───────────────────────────────────────────────────────
	SEARCH_LIMIT_UNRESOLVED: {
		sentence: '{count} {one} beyond the placement search limit',
		noun: 'class groups',
		route: '/admin/year-setup',
		buttonLabel: 'Review the search limit',
	},
	// ── Derived-demand authority (classifyDemandBlocker pass-through) ───────
	ACTIVE_YEAR_UNAVAILABLE: {
		sentence: '{count} {one} because no school year is active',
		noun: 'class groups',
		route: '/admin/year-setup',
		buttonLabel: 'Set the active year',
	},
	ACTIVE_YEAR_AMBIGUOUS: {
		sentence: '{count} {one} because more than one school year is active',
		noun: 'class groups',
		route: '/admin/year-setup',
		buttonLabel: 'Choose one active year',
	},
	INACTIVE_HISTORICAL_YEAR: {
		sentence: '{count} {one} on a year that is no longer active',
		noun: 'class groups',
		route: '/admin/year-setup',
		buttonLabel: 'Choose the active year',
	},
	TERM_STRUCTURE_UNAVAILABLE: {
		sentence: '{count} {one} with no term structure from EnrollPro',
		noun: 'class groups',
		route: '/admin/year-setup',
		buttonLabel: 'Check the term structure',
	},
	TERM_STRUCTURE_EMPTY: {
		sentence: '{count} {one} with an empty term structure',
		noun: 'class groups',
		route: '/admin/year-setup',
		buttonLabel: 'Check the term structure',
	},
	ROTATION_FAMILY_MISSING: {
		sentence: '{count} {one} with a rotating subject outside its family',
		noun: 'subjects',
		route: '/subjects',
		buttonLabel: 'Review the rotating subjects',
	},
	ROTATION_ORDER_MISSING: {
		sentence: '{count} {one} with no order in its rotating subject',
		noun: 'subjects',
		route: '/subjects',
		buttonLabel: 'Review the rotating subjects',
	},
	ROTATION_ORDER_OUT_OF_RANGE: {
		sentence: '{count} {one} ordered outside the rotating subject',
		noun: 'subjects',
		route: '/subjects',
		buttonLabel: 'Review the rotating subjects',
	},
	ROTATION_ORDER_DUPLICATE: {
		sentence: '{count} {one} sharing a place in a rotating subject',
		noun: 'subjects',
		route: '/subjects',
		buttonLabel: 'Review the rotating subjects',
	},
	ROTATION_INCOMPLETE: {
		sentence: '{count} {one} with a rotating subject missing a term',
		noun: 'subjects',
		route: '/subjects',
		buttonLabel: 'Complete the rotating subjects',
	},
};

/** The root causes that fold more than one code into ONE line (packet rule 1). */
export const BLOCKER_CODE_CAUSE: Record<string, string> = {
	TL_DEMAND_UNCOVERED: 'TEACHER_COVERAGE_GAP',
	TL_NO_QUALIFIED_OWNER: 'TEACHER_COVERAGE_GAP',
};

/** The stable root-cause key for a code, for the one-line-per-cause panel. */
export function causeForBlockerCode(code: string): string {
	return BLOCKER_CODE_CAUSE[code] ?? code;
}
