/**
 * A6 c11 (truth-fixes §A6) — "PLACEHOLDERS ARE NOT STAFF", as ONE arithmetic.
 *
 * THE DEFECT, quoted from `docs/prompts/truth-fixes-2026-09-29.md` §A6 and the
 * Codex audit of 2026-09-29 that produced it: on `/faculty` the `With load` tile
 * read `34/34` while the Teaching Load header on the same deployment read `72
 * classes short`. Both were true of the same data. The roster had 34 active
 * records, 14 of which were to-be-hired placeholders that hold subjects and are
 * therefore counted by `(subjectCount ?? 0) > 0` and by `isActiveForScheduling`.
 * A roster that is fully "staffed" by records that are not people reads as fully
 * staffed, and no amount of rewording fixes an arithmetic that counts the wrong
 * thing.
 *
 * WHY A FILE, and why it is the same shape as `subjects-coverage-truth.ts`.
 * That module exists because Subjects had the same defect and the same fix: a
 * status filter, a header count and a row label each asked the question
 * separately and got different answers. Here the consumers are the three header
 * tiles, the two attention-filter badges that describe the same two facts, and
 * the committed control — so the arithmetic is stated ONCE, here, React-free and
 * API-free, and the page decides only WHEN to read it. A component here cannot
 * grow a second opinion because it holds no opinion.
 *
 * THE RULE, stated once so no surface on this page can hold a different one:
 *
 *     a teacher is a REAL, ACTIVE person, so a placeholder record is excluded
 *     from every count of people, and `withLoad + withoutLoad === activeReal`.
 *
 * That partition is a claim about the ROSTER branch, where the numerator is
 * counted as a subset of the denominator and so cannot violate it. The server
 * branch is exempt by construction — it publishes figures it did not compute —
 * and when those two figures contradict each other it says so instead of
 * forcing them to agree.
 *
 * THE PLACEHOLDER PREDICATE IS NOT INVENTED HERE. It is `isPlaceholder`, which
 * is the flag the roster read already carries and which the page's own attention
 * filters have used since the filters were written (`Faculty.tsx` reads
 * `isActiveForScheduling && !isPlaceholder` for `needs-load`, `over-cap` and
 * `no-active-load`). A second spelling of "is this a person" is the defect this
 * module exists to prevent, so the row type below REQUIRES the flag and derives
 * everything else from it.
 *
 * ABOUT THE SERVER'S NUMBERS, said plainly so nobody mistakes this for a claim
 * that the client fixed the server. `/faculty/summary`'s `rosterStats` counts a
 * placeholder as an active teacher and as an assigned one; correcting that is
 * A8's work on the server, and this module does not pretend otherwise. The
 * PRIMARY derivation is therefore the page's own roster — a read the page
 * already performs and already trusts for every row it renders. The server is
 * consulted only when that roster is EMPTY, and in that branch its figures are
 * passed through with the client's own contribution reported as zero rather than
 * corrected by a guess. Which branch produced the numbers is reported in
 * `source`, and the branch is named `server-uncorrected` because uncorrected is
 * the operation — so a control can assert which number is which instead of
 * guessing, and a reader is never told an adjustment happened that did not.
 */

/** The minimum a roster row needs. Every field here is on `FacultySummary`. */
export type TeacherLoadTruthRow = {
	isActiveForScheduling: boolean;
	/** The roster's own flag: a to-be-hired record, not a person. */
	isPlaceholder: boolean;
	subjectCount: number;
	policyCreditedHours?: number | null;
	/** Decision 13: true teaching hours; advisory and ancillary credit never count toward the weekly max. */
	sectionTeachingHours?: number | null;
	maxHoursPerWeek?: number | null;
};

/**
 * The server's `/faculty/summary` roster block, structurally — the page declares
 * its own `TeacherRosterStats` and this accepts it without importing that page.
 */
export type TeacherRosterStatsInput = {
	activeCount: number;
	assignedCount: number;
	overCapCount: number;
};

export type TeacherLoadTruth = {
	/** Active REAL teachers — the denominator. A placeholder is not a person. */
	activeRealCount: number;
	/** Active real teachers holding at least one subject. */
	withLoadCount: number;
	/** Active real teachers holding none. */
	withoutLoadCount: number;
	/** Active to-be-hired records. The number the tile no longer counts. */
	toBeHiredActiveCount: number;
	/** How many of those are holding subjects, i.e. load that is not staffed. */
	toBeHiredWithLoadCount: number;
	/** Active real teachers above the weekly maximum. */
	overCapRealCount: number;
	/** `20/24` — the tile's value. */
	withLoadValue: string;
	/** The tile's one help sentence, which names what is NOT counted. */
	withLoadHelpText: string;
	/** Whether every real active teacher holds a load. Drives the tile's tone. */
	everyRealTeacherHasLoad: boolean;
	/**
	 * Which branch produced the numbers. See the header.
	 *
	 * Named `server-uncorrected` rather than `server-adjusted` until this
	 * correction, because `adjusted` asserted an adjustment the code explicitly
	 * refuses to make (argue it at length in the note above the fallback): the
	 * operation is the server's figures arriving and leaving unchanged, with this
	 * client's own contribution reported as zero because none of it was visible.
	 * A name that claims a correction is the first half of a claim nobody can
	 * check, and this field exists so nobody has to guess which number is which.
	 */
	source: 'roster' | 'server-uncorrected';
};

const isRealActive = (row: TeacherLoadTruthRow): boolean =>
	row.isActiveForScheduling && !row.isPlaceholder;

const hasLoad = (row: TeacherLoadTruthRow): boolean => (row.subjectCount ?? 0) > 0;

/**
 * ONE SPELLING OF ENGLISH PLURAL, shared by every branch below.
 *
 * It takes the count that is being printed, so a form can never be chosen from a
 * DIFFERENT number than the one it sits beside. That is the whole defect this
 * function was corrected for: four inline ternaries, each reading whichever
 * count was nearest, produced `2 to-be-hired records are holding classes, and is
 * not counted here as a teacher` and `1 to-be-hired record is on this roster, and
 * are not counted here` — the sentence disagreeing with itself in the one place
 * its whole job is to be exact. A helper is the fix, because a helper cannot be
 * passed the wrong count by accident.
 */
const agrees = (count: number, singular: string, pluralForm: string): string => (count === 1 ? singular : pluralForm);

/**
 * THE CLAUSE, and precisely what it is about.
 *
 * IT NAMES `toBeHiredActiveCount`. That is the number of to-be-hired records the
 * `With load` tile dropped from its denominator, and naming the state a count
 * dropped is the packet's requirement for a teacher-facing figure. The clause
 * agrees in number with that count in EVERY branch.
 *
 * `toBeHiredWithLoadCount` is a second, different question — of the dropped
 * records, how many are currently standing in for classes — and it is stated
 * ONLY when it is not the same number as the excluded count. When every dropped
 * record is holding a class, printing both would say `14` twice and add nothing
 * the first number did not already say, which §8's "less is more" rules out. When
 * the two DIFFER, both are stated, because "3 records were dropped" and "1 of
 * them is holding a class" are different facts about one roster and a scheduler
 * acts on the second. Note the shape is only reachable from two records up: with
 * one dropped record it is either holding a class (equal) or not (zero), so the
 * differing branch is structurally a plural one.
 *
 * The clause is DROPPED when there are none, rather than printed as a zero: §8's
 * "less on screen" is a subtraction, and a permanent `0 to-be-hired records` on
 * a healthy roster is the same always-present reassurance the operator overruled
 * when they had two amber banners removed.
 */
function toBeHiredClause(toBeHiredActiveCount: number, toBeHiredWithLoadCount: number): string {
	if (toBeHiredActiveCount === 0) return '';
	const records = `${toBeHiredActiveCount} to-be-hired ${agrees(toBeHiredActiveCount, 'record is', 'records are')}`;

	// A dropped record that is holding NO classes. This is an ordinary state —
	// the page has a `No sections assigned` filter for exactly it — so the branch
	// is reachable and has to be grammatical. It used to be broken twice over: it
	// agreed with `toBeHiredWithLoadCount`, which is 0 on this path and therefore
	// could only ever print `are`.
	if (toBeHiredWithLoadCount === 0) {
		return `${records} on this roster, and ${agrees(toBeHiredActiveCount, 'is', 'are')} not counted here.`;
	}
	// Every dropped record is holding a class: one number, one clause.
	if (toBeHiredWithLoadCount === toBeHiredActiveCount) {
		return `${records} holding ${agrees(toBeHiredActiveCount, 'a class', 'classes')}, and ${agrees(toBeHiredActiveCount, 'is', 'are')} not counted here as ${agrees(toBeHiredActiveCount, 'a teacher', 'teachers')}.`;
	}
	// The two counts differ, so one number cannot stand for both. The subject of
	// every verb is still the dropped records, never the holding ones.
	return `${records} on this roster, ${toBeHiredWithLoadCount === 1 ? '1 holding a class' : `${toBeHiredWithLoadCount} holding classes`}, and ${agrees(toBeHiredActiveCount, 'is', 'are')} not counted here.`;
}

/**
 * THE THREE-STATE ARITHMETIC. One function, every consumer on this page.
 *
 * `overCapRealCount` uses the SAME predicate the `over-cap` attention filter uses
 * (`isActiveForScheduling && !isPlaceholder && sectionTeachingHours >
 * maxHoursPerWeek`), because a badge that counts a different set from the filter
 * it labels is the "two chips that say the same thing" defect in numeric form.
 */
export function teacherLoadTruth(input: {
	roster: ReadonlyArray<TeacherLoadTruthRow>;
	serverStats?: TeacherRosterStatsInput | null;
}): TeacherLoadTruth {
	const { roster } = input;

	if (roster.length > 0) {
		let withLoadCount = 0;
		let withoutLoadCount = 0;
		let overCapRealCount = 0;
		let toBeHiredActiveCount = 0;
		let toBeHiredWithLoadCount = 0;
		for (const row of roster) {
			if (!row.isActiveForScheduling) continue;
			if (row.isPlaceholder) {
				toBeHiredActiveCount += 1;
				if (hasLoad(row)) toBeHiredWithLoadCount += 1;
				continue;
			}
			if (hasLoad(row)) withLoadCount += 1;
			else withoutLoadCount += 1;
			if ((row.sectionTeachingHours ?? 0) > (row.maxHoursPerWeek ?? 0)) overCapRealCount += 1;
		}
		const activeRealCount = withLoadCount + withoutLoadCount;
		return finish({
			activeRealCount,
			withLoadCount,
			withoutLoadCount,
			toBeHiredActiveCount,
			toBeHiredWithLoadCount,
			overCapRealCount,
			source: 'roster',
		});
	}

	/*
	 * THE FALLBACK, and its honest limit. The roster has not arrived, so the
	 * server's block is the only arithmetic ATLAS holds — and BOTH of the two
	 * figures this tile needs count placeholders on the server side:
	 * `activeCount` includes the record itself and `assignedCount` includes the
	 * subjects a to-be-hired record holds. Correcting that is A8's server-side
	 * fix and this line does not assume it has landed.
	 *
	 * It is NOT corrected here, and that is the point rather than an omission.
	 * Subtracting a placeholder contribution requires SEEING a placeholder, and
	 * the branch that reaches here has no roster at all, so the subtraction would
	 * be `x - 0`: an expression that looks like a correction and performs none.
	 * The client's honest move is to publish the server's figure, label its own
	 * contribution as zero (nothing was visible) and report which branch produced
	 * the numbers in `source`, so a control — and a reviewer — can tell a
	 * server figure from a roster one instead of having to guess.
	 */
	const server = input.serverStats ?? null;
	if (server) {
		const activeRealCount = Math.max(0, server.activeCount);
		const withLoadCount = Math.max(0, server.assignedCount);
		/*
		 * `assignedCount` PASSES THROUGH, and it used to be clamped to
		 * `Math.min(withLoadCount, activeRealCount)`. That clamp was the only
		 * correction this branch performed — against its own stated doctrine, two
		 * paragraphs above: correcting here is a guess, because a placeholder can
		 * only be subtracted by SEEING one and this branch saw none. It was also
		 * the worst possible guess, because `assignedCount > activeCount` is not
		 * an arithmetic accident to be tidied away. It is the FINGERPRINT of the
		 * server defect this module exists to expose: the server counts a
		 * to-be-hired record as an active teacher AND counts the subjects it holds
		 * in `assignedCount`, which is how the very roster this cycle was opened
		 * for read `34/34`. The clamp resolved that fingerprint into
		 * `active/active` — a calm, fully-staffed tile published from a figure
		 * nobody can stand behind, which is the defect wearing the fix's clothes.
		 *
		 * So the number is reported as it arrived, and `finish` states that the
		 * two server figures disagree rather than printing a reassurance derived
		 * from them. The client cannot make the server's arithmetic coherent; it
		 * can refuse to pretend the incoherence is not there.
		 */
		return finish({
			activeRealCount,
			withLoadCount,
			withoutLoadCount: Math.max(0, activeRealCount - withLoadCount),
			toBeHiredActiveCount: 0,
			toBeHiredWithLoadCount: 0,
			// `overCapCount` is the server's and is NOT corrected here either: the
			// roster that would supply the placeholder contribution is the empty one
			// that got us to this branch. The number is the server's, unchanged.
			overCapRealCount: Math.max(0, server.overCapCount),
			source: 'server-uncorrected',
		});
	}

	return finish({
		activeRealCount: 0,
		withLoadCount: 0,
		withoutLoadCount: 0,
		toBeHiredActiveCount: 0,
		toBeHiredWithLoadCount: 0,
		overCapRealCount: 0,
		source: 'roster',
	});
}

/** The invariant, the value and the one help sentence — shared by both branches. */
function finish(counts: Omit<TeacherLoadTruth, 'withLoadValue' | 'withLoadHelpText' | 'everyRealTeacherHasLoad'>): TeacherLoadTruth {
	const { activeRealCount, withoutLoadCount, toBeHiredActiveCount, toBeHiredWithLoadCount } = counts;
	/*
	 * THE ONE PREDICATE THE FALLBACK NEEDS. `withLoadCount` cannot exceed
	 * `activeRealCount` in the roster branch — it is counted as a subset of it —
	 * so this is false everywhere except where the SERVER's own two figures
	 * contradict each other. There, the subtraction behind "0 of 10 active
	 * teachers still need a teaching load" is not a fact about anybody, and
	 * publishing it would be a calm, confident sentence derived from a
	 * subtraction that does not mean what it says. So the module states the
	 * contradiction, and says its number is uncorrected. This is the same
	 * doctrine the fallback's note argues, applied where it is checkable: publish
	 * what you were given, claim nothing you cannot support, and never resolve an
	 * anomaly you have no authority to explain.
	 */
	const serverFiguresDisagree = counts.withLoadCount > activeRealCount;
	const base = {
		...counts,
		withLoadValue: `${counts.withLoadCount}/${activeRealCount}`,
		everyRealTeacherHasLoad: !serverFiguresDisagree && activeRealCount > 0 && withoutLoadCount === 0,
	};
	if (serverFiguresDisagree) {
		return {
			...base,
			withLoadHelpText:
				`The server reports ${counts.withLoadCount} with a load and ${activeRealCount} active, which cannot both be true; this count is uncorrected.`,
		};
	}
	const clause = toBeHiredClause(toBeHiredActiveCount, toBeHiredWithLoadCount);
	return {
		...base,
		withLoadHelpText:
			`${withoutLoadCount} of ${activeRealCount} active teachers still need a teaching load.${clause ? ` ${clause}` : ''}`,
	};
}

/**
 * The `With load` tile, so the tile's own copy cannot drift from the arithmetic
 * that produced it.
 *
 * The tone rule is UNCHANGED (`some real teacher has a load` → calm), and that
 * is deliberate: making the tile amber whenever one teacher is still unassigned
 * would put the loudest chrome on the most ordinary state. What the rule now
 * asks is the REAL question, so a roster whose only loaded records are
 * to-be-hired placeholders now reads `0/20` in the `warning` tone instead of
 * `34/34` in the calm one. The number changed; the vocabulary did not.
 *
 * The one addition is the `readable` guard, and it is not a new tone rule: a
 * numerator larger than its own denominator is a number no one can read, so it
 * is never calm about it. Only the server branch can produce that shape, and
 * only because the clamp that used to hide it was removed — see the note in the
 * fallback.
 */
export function withLoadTile(truth: TeacherLoadTruth): {
	value: string;
	helpText: string;
	tone: 'info' | 'warning';
} {
	const readable = truth.withLoadCount <= truth.activeRealCount;
	return {
		value: truth.withLoadValue,
		helpText: truth.withLoadHelpText,
		tone: truth.withLoadCount > 0 && readable ? 'info' : 'warning',
	};
}

/**
 * One tile in the roster header's stat banner, in the shape
 * `AdminStatBanner` renders. `value` is `string | number`, which is what
 * `AdminStatItem['value']` (`ReactNode`) accepts — this module stays React-free.
 */
export type TeacherStatItem = {
	label: string;
	value: string | number;
	helpText: string;
	tone: 'success' | 'warning' | 'info';
};

/**
 * THE THREE TILES, in one function, so the header's numbers and their help
 * sentences cannot be built in two places.
 *
 * They live here rather than in `Faculty.tsx` because two of the three had to
 * change together: `Active teachers` lost the placeholders from its denominator
 * and `With load` gained a clause naming them. Split across a page and a module,
 * that is exactly the pair that drifts back into disagreeing — and a `34` beside
 * a `20/20` on one row is the incoherence this whole change exists to remove.
 *
 * The to-be-hired count is stated ONCE, in the `With load` help text, because it
 * is the number that tile is no longer counting; `Active teachers` keeps its
 * original sentence, which has become true for the first time rather than
 * needing a second clause.
 */
export function teacherStatItems(truth: TeacherLoadTruth): TeacherStatItem[] {
	const withLoad = withLoadTile(truth);
	return [
		{
			label: 'Active teachers',
			value: truth.activeRealCount,
			tone: truth.activeRealCount > 0 ? 'success' : 'warning',
			helpText: 'Teachers currently available for scheduling.',
		},
		{ label: 'With load', value: withLoad.value, tone: withLoad.tone, helpText: withLoad.helpText },
		{
			label: 'Above weekly max',
			value: truth.overCapRealCount,
			tone: truth.overCapRealCount > 0 ? 'warning' : 'success',
			helpText: 'Active teachers above the weekly maximum. Move classes before generating.',
		},
	];
}
