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
	 * The PREDICATE half of the plain sentence — everything after the count.
	 *
	 * A8-C5 S2.2 (correction to S2.1): the count and its unit are composed ONCE,
	 * in `blockerSentence`, from the count the server measured and the `noun` on
	 * this row. Storing `{count} {one} …` here and never rendering the noun meant
	 * the live headline read "50 are without a teacher": the number survived and
	 * the thing it counted did not, which is the one thing the packet's "count in
	 * classes" rule exists to guarantee. It was also ungrammatical for any row
	 * whose predicate stands alone ("4 are over their weekly limit"). A row now
	 * carries only what is specific to it, and the two slots it may use are
	 * `{one}` ('is'/'are') and `{onePlural}` ('needs'/'need').
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
	// The count and its unit are composed HERE, once, for every row: `<n> <noun>
	// <predicate>`. A row can therefore never be rendered without saying what it
	// counted, which is what makes "count in classes" a property of the table
	// rather than a habit of whoever writes the next row.
	return `${safeCount} ${singularizeNoun(row.noun, safeCount)} ${row.sentence}`
		.replace('{one}', safeCount === 1 ? 'is' : 'are')
		.replace(/\{onePlural\}/g, safeCount === 1 ? 'needs' : 'need');
}

/** The count unit, in the form the sentence needs: singular for one, plural otherwise. */
export function singularizeNoun(noun: string, count: number): string {
	if (count !== 1) return noun;
	if (noun.endsWith('es')) return noun.slice(0, -2);
	if (noun.endsWith('s')) return noun.slice(0, -1);
	return noun;
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

/**
 * The codes that reach the PANEL without being hard blockers.
 *
 * A8-C5 S2.2: they are not in `PREFLIGHT_BLOCKER_CODES` — the A8 C3
 * `ADVISORY_CODES` are non-blocking for generation (still refused by
 * publication), and S1.2's placeholder state blocks neither — but the server
 * still groups, counts and names every one of them, so a scheduler sees them as
 * their own lines. They therefore need a sentence and a fix button like any
 * other line, and the packet's answer to "where do those words live?" is THIS
 * table, not a second noun/verb map beside it.
 *
 * Each carries `advisoryWithReason`, so the reason it is not a blocker is
 * WRITTEN rather than inferred, and each still carries a real route: it is on
 * screen, so its button has to go somewhere.
 */
export const PANEL_ADVISORY_CODES = [
	'FACULTY_OVERLOAD',
	'FACULTY_SUBJECT_NOT_QUALIFIED',
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
		sentence: '{onePlural} a teacher',
		noun: 'classes',
		route: '/teaching-load',
		buttonLabel: 'Assign teachers',
	},
	TL_NO_QUALIFIED_OWNER: {
		sentence: '{onePlural} a teacher',
		noun: 'classes',
		route: '/teaching-load',
		buttonLabel: 'Assign teachers',
	},
	TL_OWNERSHIP_CONFLICT: {
		sentence: '{one} with more than one teacher',
		noun: 'classes',
		route: '/teaching-load',
		buttonLabel: 'Resolve the conflict',
	},
	TEACHING_LOAD_REVIEW_REQUIRED: {
		sentence: '{one} with no teaching load yet',
		noun: 'classes',
		route: '/teaching-load',
		buttonLabel: 'Review teaching load',
	},
	WORKLOAD_POLICY_BLOCK: {
		sentence: '{one} with a teacher at their weekly limit',
		noun: 'classes',
		route: '/teaching-load',
		buttonLabel: 'Review teaching load',
	},
	// ── A8-C5 S1.2: the third ownership state ───────────────────────────────
	SYNTHETIC_PLACEHOLDER_OWNED: {
		sentence: '{one} on a to-be-hired teacher',
		noun: 'classes',
		route: '/teaching-load',
		buttonLabel: 'See the to-be-hired list',
	},
	// ── A8 C3 ADVISORY lines: shown, named, and NOT blockers ──────────────────
	FACULTY_OVERLOAD: {
		sentence: '{one} over their weekly limit',
		noun: 'teachers',
		route: '/teaching-load',
		buttonLabel: 'Review their load',
		advisoryWithReason: 'Advisory for generation (A8 C3 ADVISORY_CODES): a real teacher over their weekly cap still stops publication, and ATLAS will make a reviewable schedule with it named. It is shown here so it is never a surprise at publish time.',
	},
	FACULTY_SUBJECT_NOT_QUALIFIED: {
		sentence: '{one} with a teacher outside their subjects',
		noun: 'classes',
		route: '/teaching-load',
		buttonLabel: 'Review their load',
		advisoryWithReason: 'Advisory for generation (A8 C3 ADVISORY_CODES): a class whose teacher is outside their subjects still stops publication, and is named in the run result. It is shown here so it is never a surprise at publish time.',
	},
	// ── Shape and capacity ──────────────────────────────────────────────────
	CANONICAL_SHAPE_CAPACITY_EXCEEDED: {
		sentence: '{one} with more lessons than the week allows',
		noun: 'classes',
		route: '/admin/year-setup',
		buttonLabel: 'Review the timetable shape',
	},
	CANONICAL_SHAPE_VIOLATION: {
		sentence: '{one} outside the approved lesson shape',
		noun: 'classes',
		route: '/admin/year-setup',
		buttonLabel: 'Review the timetable shape',
	},
	CANONICAL_TEMPLATE_INCOMPLETE: {
		sentence: '{one} with no lesson rows in the timetable',
		noun: 'class groups',
		route: '/admin/year-setup',
		buttonLabel: 'Add the lesson rows',
	},
	// ── Rooms ───────────────────────────────────────────────────────────────
	ROOM_RESOURCE_UNAVAILABLE: {
		sentence: '{one} with no suitable room',
		noun: 'classes',
		route: '/campus-rooms',
		buttonLabel: 'Review rooms',
	},
	ROOMS_MISSING: {
		sentence: '{one} with no teaching room available',
		noun: 'class groups',
		route: '/campus-rooms',
		buttonLabel: 'Add teaching rooms',
	},
	// ── Policy and windows ──────────────────────────────────────────────────
	POLICY_WINDOW_BLOCK: {
		sentence: '{one} with no time window allowed by the policy',
		noun: 'classes',
		route: '/admin/year-setup',
		buttonLabel: 'Open the time windows',
	},
	POLICY_UNINITIALIZED: {
		sentence: '{one} waiting on the scheduling policy',
		noun: 'class groups',
		route: '/admin/year-setup',
		buttonLabel: 'Set the scheduling policy',
	},
	GRADE_WINDOW_MISSING: {
		sentence: '{one} with no time window for that grade',
		noun: 'class groups',
		route: '/admin/year-setup',
		buttonLabel: 'Open the time windows',
	},
	// ── Term and year authority ─────────────────────────────────────────────
	TERM_CACHE_MISSING: {
		sentence: '{one} waiting on the term list from EnrollPro',
		noun: 'class groups',
		route: '/admin/year-setup',
		buttonLabel: 'Check the term list',
	},
	TERM_AUTHORITY_STALE: {
		sentence: '{one} on an out-of-date term list',
		noun: 'class groups',
		route: '/admin/year-setup',
		buttonLabel: 'Refresh the term list',
	},
	TERM_AUTHORITY_UNRESOLVED: {
		sentence: '{one} with no term set for this school year',
		noun: 'class groups',
		route: '/admin/year-setup',
		buttonLabel: 'Set the school year terms',
	},
	ROTATION_TERM_INVALID: {
		sentence: '{one} with a rotating subject outside its terms',
		noun: 'class groups',
		route: '/subjects',
		buttonLabel: 'Review the rotating subjects',
	},
	// ── Sections ────────────────────────────────────────────────────────────
	SECTION_SETUP_REQUIRED: {
		sentence: '{one} not set up yet',
		noun: 'sections',
		route: '/sections',
		buttonLabel: 'Open Sections',
	},
	// ── Demand ──────────────────────────────────────────────────────────────
	EMPTY_DERIVED_DEMAND: {
		sentence: '{one} with no lessons to place',
		noun: 'class groups',
		route: '/sections',
		buttonLabel: 'Check the sections',
	},
	// ── Misc policy ─────────────────────────────────────────────────────────
	FLAG_CEREMONY_SCOPE_INVALID: {
		sentence: '{one} with a flag ceremony outside its scope',
		noun: 'class groups',
		route: '/admin/year-setup',
		buttonLabel: 'Review the flag ceremony',
	},
	// ── Search budget ───────────────────────────────────────────────────────
	SEARCH_LIMIT_UNRESOLVED: {
		sentence: '{one} beyond the placement search limit',
		noun: 'class groups',
		route: '/admin/year-setup',
		buttonLabel: 'Review the search limit',
	},
	// ── Derived-demand authority (classifyDemandBlocker pass-through) ───────
	ACTIVE_YEAR_UNAVAILABLE: {
		sentence: '{one} because no school year is active',
		noun: 'class groups',
		route: '/admin/year-setup',
		buttonLabel: 'Set the active year',
	},
	ACTIVE_YEAR_AMBIGUOUS: {
		sentence: '{one} because more than one school year is active',
		noun: 'class groups',
		route: '/admin/year-setup',
		buttonLabel: 'Choose one active year',
	},
	INACTIVE_HISTORICAL_YEAR: {
		sentence: '{one} on a year that is no longer active',
		noun: 'class groups',
		route: '/admin/year-setup',
		buttonLabel: 'Choose the active year',
	},
	TERM_STRUCTURE_UNAVAILABLE: {
		sentence: '{one} with no term structure from EnrollPro',
		noun: 'class groups',
		route: '/admin/year-setup',
		buttonLabel: 'Check the term structure',
	},
	TERM_STRUCTURE_EMPTY: {
		sentence: '{one} with an empty term structure',
		noun: 'class groups',
		route: '/admin/year-setup',
		buttonLabel: 'Check the term structure',
	},
	ROTATION_FAMILY_MISSING: {
		sentence: '{one} with a rotating subject outside its family',
		noun: 'subjects',
		route: '/subjects',
		buttonLabel: 'Review the rotating subjects',
	},
	ROTATION_ORDER_MISSING: {
		sentence: '{one} with no order in its rotating subject',
		noun: 'subjects',
		route: '/subjects',
		buttonLabel: 'Review the rotating subjects',
	},
	ROTATION_ORDER_OUT_OF_RANGE: {
		sentence: '{one} ordered outside the rotating subject',
		noun: 'subjects',
		route: '/subjects',
		buttonLabel: 'Review the rotating subjects',
	},
	ROTATION_ORDER_DUPLICATE: {
		sentence: '{one} sharing a place in a rotating subject',
		noun: 'subjects',
		route: '/subjects',
		buttonLabel: 'Review the rotating subjects',
	},
	ROTATION_INCOMPLETE: {
		sentence: '{one} with a rotating subject missing a term',
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
