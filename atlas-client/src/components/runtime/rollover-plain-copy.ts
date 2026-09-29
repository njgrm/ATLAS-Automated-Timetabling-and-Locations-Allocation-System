/**
 * A7-C1 — plain-language copy for the `/admin/year-setup` next step.
 *
 * Pure module: no React, no requests, no state. Every string the Year Setup page
 * shows in plain mode is derived here so the wording is one testable table
 * instead of literals scattered through the card.
 *
 * BLAST RADIUS (A7-C1 packet §3): `RolloverGuidanceCard` is also mounted on
 * Dashboard, Sections, Faculty, TeachingLoad and two timetable surfaces that
 * other lanes own. Every string below is reachable ONLY through the opt-in
 * `plainLanguageNextStep` prop, so the other five mounts keep today's wording
 * byte for byte. Nothing in here is used by the default path.
 *
 * NO IDs AND NO CODES. The demo operator is an older school scheduler; the
 * machine contract (`code`, `action`, `classification`, typed confirmation
 * phrases) is unchanged and lives in `@/lib/settings` and the server.
 */
import type { ArchiveAndSyncPreviewResult, RolloverStatus, SchoolYearState } from '@/lib/settings';

/** Secondary action on the status card. It is the EXISTING preview handler. */
export const PLAIN_SECONDARY_LABEL = 'See what will change first';
/** Primary label when ATLAS cannot name the year. */
export const PLAIN_PRIMARY_NO_YEAR = 'Start the new school year in ATLAS';
/** Primary label for the separate ordered-terms action. */
export const PLAIN_TERMS_PRIMARY = 'Save the terms';
/** The one "what do I do next" sentence the page owes the operator after a start. */
export const PLAIN_NEXT_STEP_LINE = 'Next: check Sections, then Teaching Load, then build the timetable.';
/** The whole intro paragraph, two sentences (A7-C1 §1.1). */
export const PLAIN_INTRO = "Start the new school year in ATLAS after EnrollPro moves to it. Last year's schedules are kept for reference.";
/** Shown instead of a number we do not have. Never invent a number. */
export const PLAIN_COUNTS_UNKNOWN = 'Sections and teachers were brought in.';

/** `Start <year> in ATLAS`, or the yearless form when ATLAS has no year label. */
export function plainStartLabel(yearLabel: string | null | undefined): string {
	return yearLabel ? `Start ${yearLabel} in ATLAS` : PLAIN_PRIMARY_NO_YEAR;
}

export type PlainYearSetupInput = {
	loading: boolean;
	driftStatus: string;
	recommendedAction: string | null;
	yearLabel: string | null;
	canApply: boolean;
	pendingReconfigured: boolean;
	showArchiveFlow: boolean;
	termRepairNeeded: boolean;
	recoveryClassification: string | null;
	canOfferTestDataMarking: boolean;
	canClearTestData: boolean;
};

export type PlainYearSetupCopy = {
	/** "What happened" — one sentence. */
	whatHappened: string;
	/** "What to do" — one sentence, or null when there is nothing to do. */
	whatToDo: string | null;
	/** Primary button label, or null when this state has no start action. */
	primaryLabel: string | null;
	/** True when the primary action is the archive-shaped rollover start. */
	primaryStartsArchivedYear: boolean;
	/** True when the primary action acknowledges renamed sections first. */
	primaryAcknowledgesSections: boolean;
	/** True when the primary action is the separate ordered-terms save. */
	primarySavesTerms: boolean;
};

/**
 * The one decision table. Each branch is a distinct, already-authorised drift
 * state; the conditions are copied from the card's own gating expressions and
 * introduce no new state.
 */
export function plainYearSetupCopy(input: PlainYearSetupInput): PlainYearSetupCopy {
	const { loading, driftStatus, yearLabel } = input;
	const startLabel = plainStartLabel(yearLabel);

	if (loading) {
		return {
			whatHappened: 'Checking the school year now...',
			whatToDo: null,
			primaryLabel: null,
			primaryStartsArchivedYear: false,
			primaryAcknowledgesSections: false,
			primarySavesTerms: false,
		};
	}

	// RR-TERM-CACHE-C01: the year is current but its ordered terms are missing or
	// stale. That is a different job from starting a year, so it gets its own verb.
	if (input.termRepairNeeded) {
		return {
			whatHappened: 'The school year is in ATLAS, but its terms are not saved yet.',
			whatToDo: yearLabel
				? `Save the terms for ${yearLabel} so ATLAS can build the timetable.`
				: 'Save the terms so ATLAS can build the timetable.',
			primaryLabel: PLAIN_TERMS_PRIMARY,
			primaryStartsArchivedYear: false,
			primaryAcknowledgesSections: false,
			primarySavesTerms: true,
		};
	}

	if (driftStatus === 'enrollpro-unreachable') {
		return {
			whatHappened: 'ATLAS could not reach EnrollPro right now.',
			whatToDo: 'Nothing changed. Try again, or ask your IT admin.',
			primaryLabel: null,
			primaryStartsArchivedYear: false,
			primaryAcknowledgesSections: false,
			primarySavesTerms: false,
		};
	}

	if (driftStatus === 'aligned') {
		return {
			whatHappened: yearLabel ? `ATLAS is on ${yearLabel}.` : 'ATLAS is on the current school year.',
			whatToDo: yearLabel ? `Nothing to do. ${yearLabel} is ready.` : 'Nothing to do.',
			primaryLabel: null,
			primaryStartsArchivedYear: false,
			primaryAcknowledgesSections: false,
			primarySavesTerms: false,
		};
	}

	// A mapping conflict that is NOT the archive-shaped one is leftover data. It
	// is never silently "started": the operator has to mark or clear it first,
	// and the card's own blocks own that button.
	if (driftStatus === 'mapping-conflict' && !input.showArchiveFlow) {
		return {
			whatHappened: yearLabel
				? `EnrollPro has moved to ${yearLabel}, but ATLAS still has leftover data for this school year.`
				: 'ATLAS still has leftover data for this school year.',
			whatToDo: input.canClearTestData
				? 'Clear the leftover test data, then start the new school year.'
				: input.canOfferTestDataMarking
					? 'Mark this school year as test data so ATLAS can start the new one.'
					: 'Ask your IT admin to look at this school year before you start the new one.',
			primaryLabel: null,
			primaryStartsArchivedYear: false,
			primaryAcknowledgesSections: false,
			primarySavesTerms: false,
		};
	}

	const canStart = input.canApply || input.showArchiveFlow || input.pendingReconfigured;
	return {
		whatHappened: yearLabel
			? `EnrollPro has moved to ${yearLabel}.`
			: 'EnrollPro has moved to a new school year.',
		whatToDo: canStart ? `${startLabel}.` : 'Nothing to do.',
		primaryLabel: canStart ? startLabel : null,
		primaryStartsArchivedYear: input.showArchiveFlow,
		primaryAcknowledgesSections: input.pendingReconfigured,
		primarySavesTerms: false,
	};
}

/**
 * The archive-shaped explanation, in plain words. Built from the SAME preview
 * payload the card already holds (`yearsToArchive`, `enrollProActiveYear`), so
 * no request is added and no number is invented.
 *
 * The server's `summary` and `syncPlan` strings are technical by construction
 * ("section upsert, policy bootstrap, mirror activation", `yearLabel (#id)`), so
 * plain mode renders its own sentence from the payload instead of quoting them.
 */
export function plainKeptForReferenceCopy(preview: ArchiveAndSyncPreviewResult | null): string {
	if (!preview) {
		return 'EnrollPro has moved to a new school year.';
	}
	const active = preview.enrollProActiveYear?.yearLabel;
	const kept = preview.yearsToArchive.map((year) => year.yearLabel);
	if (kept.length === 0) {
		return active
			? `Start ${active} in ATLAS. Nothing is deleted.`
			: 'Nothing is deleted.';
	}
	return active
		? `Keep ${kept.join(', ')} for reference, then start ${active} in ATLAS. Nothing is deleted.`
		: `Keep ${kept.join(', ')} for reference. Nothing is deleted.`;
}

/** One line per kept year. Drops the `(#id)` the technical list carried. */
export function plainKeptYearLine(yearLabel: string): string {
	return `${yearLabel} — kept for reference`;
}

/**
 * The post-click confirmation (A7-C1 §1.4). Counts come from the `status.counts`
 * the page already reads after `loadStatus(true)`; when they are absent this says
 * so in plain words rather than inventing a number.
 */
export function plainStartedCopy(input: {
	yearLabel: string | null;
	sectionCount: number | null;
	facultyCount: number | null;
	keptYearLabels: string[];
	/**
	 * A7-C4: the carry result from the APPLY RESPONSE (packet R8 — no read path
	 * carries it, and no request is added). `null` on a page state that has no
	 * apply behind it, and the kept line is then simply absent.
	 */
	yearSetupCarry?: PlainYearSetupCarrySummary | null;
}): string[] {
	const lines: string[] = [
		input.yearLabel
			? `${input.yearLabel} is now the school year in ATLAS.`
			: 'The new school year is now the school year in ATLAS.',
	];
	lines.push(
		input.sectionCount != null && input.facultyCount != null
			? `${input.sectionCount} sections and ${input.facultyCount} teachers were brought in from EnrollPro.`
			: PLAIN_COUNTS_UNKNOWN,
	);
	const kept = plainYearSetupKeptLine(input.yearSetupCarry);
	if (kept) lines.push(kept);
	if (input.keptYearLabels.length > 0) {
		lines.push(`Kept for reference: ${input.keptYearLabels.join(', ')}.`);
	}
	lines.push(PLAIN_NEXT_STEP_LINE);
	return lines;
}

/**
 * A7-C4 — the plain automation line is GONE from the Year Setup mount, and with
 * it this helper and `PLAIN_AUTOMATION_OFF`. The two carry switches make the
 * pre-press state visible, so the reassurance line said the same thing twice in
 * two different places, and the design gate does not allow a region to gain words
 * without giving as much back. It was removed from the PLAIN CARD ONLY: the other
 * five `RolloverGuidanceCard` mounts (Dashboard, Sections, Faculty, TeachingLoad
 * and the two timetable surfaces) keep their own automation line, untouched, and
 * that line never came from this module.
 *
 * The strings are removed rather than left in this table on purpose: this module's
 * header promises that "every string the Year Setup page shows in plain mode is
 * derived here", so a row nothing renders would contradict the file's own contract
 * and invite someone to put the line back. (Evidence is never deleted for closing
 * a finding — AGENTS.md §16 — and no test or control is removed here; the
 * SUBTRACTION row in the new client suite asserts the line is absent from the
 * plain card and present on the other five mounts.)
 */

/**
 * The plain replacement for the recovery block's raw `artifactCounts` key list.
 * The keys are internal record names (`sectionMirrors`, `lockedSessions`), so
 * plain mode shows the operator how much will be cleared, in words.
 */
export function plainClearableCopy(artifactCounts: Record<string, number> | null): string {
	if (!artifactCounts) return 'ATLAS has data for this school year that does not match EnrollPro.';
	const total = Object.values(artifactCounts).reduce((sum, value) => sum + (Number(value) || 0), 0);
	return total > 0
		? `ATLAS has ${total} record(s) for this school year that do not match EnrollPro.`
		: 'ATLAS has data for this school year that does not match EnrollPro.';
}

/** The Year Setup page renders this state from `status`; the trigger is `onApplied`. */
export function isPlainStartedVisible(started: RolloverStatus | null): boolean {
	return started != null;
}

// ─── A7-C2: every school year, and "Keep as history" for one of them ─────────

/** Replaces the c1 "Past school years" heading, which could only ever list kept years. */
export const PLAIN_SCHOOL_YEARS_HEADING = 'Every school year in ATLAS';
/** Replaces the c1 helper under that heading. */
export const PLAIN_SCHOOL_YEARS_HELPER = 'The year ATLAS is using now, the years you have already kept, and the years you have not kept yet.';

/**
 * The one plain sentence per year, and it names the year first. This is the
 * sentence that replaces the three-state machine an operator had to infer from
 * an empty list; before A7-C2 a year that was neither active nor archived had
 * no sentence anywhere, because it had no row.
 */
export function plainSchoolYearStateSentence(input: {
	yearLabel: string;
	state: SchoolYearState;
	publishedTimetables?: number | null;
}): string {
	const kept = input.publishedTimetables ? `${input.publishedTimetables} published timetable(s)` : null;
	switch (input.state) {
		case 'current':
			return `${input.yearLabel} is the school year ATLAS is using now.`;
		case 'kept as history':
			return kept
				? `${input.yearLabel} is already kept as history, with ${kept}.`
				: `${input.yearLabel} is already kept as history.`;
		case 'past, not yet kept':
			return kept
				? `${input.yearLabel} is a past year with ${kept} that you have not kept as history yet.`
				: `${input.yearLabel} is a past year that you have not kept as history yet.`;
		/**
		 * A7-C2 QA N5: an unrecognised state rendered NOTHING, so a year could
		 * appear with a blank status line. `SchoolYearState` is a closed union
		 * today, so this is unreachable — but "the row is silent" is exactly
		 * the defect this cycle exists to remove, so the fallback has to say
		 * something an operator can act on rather than nothing at all.
		 */
		default:
			return `${input.yearLabel} is a past school year. Its status has not been checked yet.`;
	}
}

/** The per-year "Keep as history" action. Preview first, never apply first. */
export const PLAIN_KEEP_YEAR_LABEL = 'Keep as history';
/** The dialog title, which names the year before anything else. */
export function plainKeepYearTitle(yearLabel: string): string {
	return `Keep ${yearLabel} as history?`;
}
/** The question the operator must answer before the write is allowed. */
export const PLAIN_KEEP_YEAR_CONFIRM = 'Yes, keep this year as history';
/** What the operator is told about the effect, in one calm sentence. */
export const PLAIN_KEEP_YEAR_EFFECT = 'Nothing is deleted, and nothing in EnrollPro changes.';

/**
 * R6: the Timetable link is `/timetable?schoolYearId=<enrollProSchoolYearId>`,
 * using the SAME id the Teaching Load history link already uses. A2 owns the
 * route. Until it exists the link MUST fail closed — an operator sent to a
 * timetable page that silently ignores the parameter would read today's
 * schedule as last year's, which is worse than being told it is not ready.
 *
 * A2 flips `TIMETABLE_READS_SCHOOL_YEAR_PARAM` to `true` in the same commit
 * that makes the route honour the parameter. It is one boolean on purpose: the
 * page must not be able to link without also stating the fail-closed sentence.
 *
 * FLIPPED 2026-09-29, after verifying all three halves of the claim against this
 * tree rather than taking it on trust:
 *   1. the client reads it — `ScheduleReviewWorkspace.tsx` passes
 *      `new URLSearchParams(location.search).get('schoolYearId')` into
 *      `usePastYearTimetable`, and `pastYearViewState` turns it into a
 *      past-year read or a typed notice;
 *   2. the server resolves it — `resolvePastYearReadScope`
 *      (`atlas-server/src/services/past-year-timetable-scope.ts`) gates the read;
 *   3. THE ID SPACE MATCHES, which was the part that would have made this a lying
 *      link. The router builds its allowed set as
 *      `actorSchoolYearIds: yearRows.map((row) => row.enrollProSchoolYearId)` —
 *      the same `enrollProSchoolYearId` this card and the existing
 *      `/teaching-load/history?schoolYearId=` link already use. A proof that both
 *      sides are the same space is
 *      `atlas-server/src/__tests__/a7-past-year-id-space-c2.test.ts`.
 *
 * If the server ever stops accepting the EnrollPro year id, this must go back to
 * `false`: the failure mode is an operator reading today's schedule as last
 * year's, and a plain sentence is always better than that.
 */
export const TIMETABLE_READS_SCHOOL_YEAR_PARAM = true;

export function plainTimetableYearHref(enrollProSchoolYearId: number): string | null {
	return TIMETABLE_READS_SCHOOL_YEAR_PARAM
		? `/timetable?schoolYearId=${enrollProSchoolYearId}`
		: null;
}

/** The fail-closed sentence shown in place of the link. */
export const PLAIN_TIMETABLE_YEAR_UNAVAILABLE = "The Timetable page cannot show a past school year yet.";

/** The existing, unchanged read-only Teaching Load destination (R6, item 3). */
export function plainTeachingLoadYearHref(enrollProSchoolYearId: number): string {
	return `/teaching-load/history?schoolYearId=${enrollProSchoolYearId}`;
}

// ─── A7-C4: a new school year keeps last year's setup by default ─────────────

/**
 * R7 — the two switches, and the operator's OWN labels, byte for byte. The
 * operator said "One toggle for policy and grade shift? Both defaulted as don't
 * reset", so the labels are theirs, not ours.
 *
 * The two features genuinely exist in two places, and the labels overlap on
 * "flag ceremonies", so each switch states ITS OWN side of that line (R7):
 *
 *   switch 1 = the `scheduling_policies` row — school day length, teaching-hour
 *              caps, break and lunch times, and the flag-ceremony times and
 *              on/off switches STORED ON THE POLICY. Off ⇒ the new year gets
 *              default school-day rules and no ceremony times.
 *   switch 2 = the `grade_shift_windows` rows and the `policy_special_events`
 *              rows — the per-grade start/finish rows and the scheduled
 *              ceremony/special-day rows. Off ⇒ it starts with no per-grade times
 *              and no scheduled days.
 *
 * STATIC descriptions only (packet R8): `getRolloverStatus` is read by six
 * surfaces including four other lanes' pages, so no count and no request may
 * appear here. The counts live on the APPLY RESPONSE, below.
 */
export const PLAIN_KEEP_SCHEDULING_RULES_LABEL = "Keep last year's scheduling rules";
export const PLAIN_KEEP_SCHEDULING_RULES_LINE = 'Your school day, teaching hours and break times stay exactly as you set them last year.';
export const PLAIN_KEEP_GRADE_WINDOWS_LABEL = "Keep last year's grade time windows and flag ceremonies";
export const PLAIN_KEEP_GRADE_WINDOWS_LINE = 'Each grade keeps its own start and finish times, and your flag ceremonies and special days come with it.';

/**
 * What a switch says INSTEAD of its line when it is off. One sentence, in
 * place of the other — never both, and never an extra chip saying the same
 * thing twice (packet R2).
 */
export const PLAIN_KEEP_SWITCH_OFF_LINE = 'The new year starts empty for this.';

/** Shown when a carry was asked for and the new year already had all of it. */
export const PLAIN_KEEP_NOTHING_LINE = 'Nothing needed keeping — this year already had all of it.';

/** Honest 0/1/n pluralisation, so the confirmation can never over- or under-claim. */
function plainCount(count: number, one: string, many: string): string {
	return `${count} ${count === 1 ? one : many}`;
}

/**
 * The post-apply "what was kept" line, or null when there is nothing to say.
 *
 * Three branches, and the third is a judgement recorded on purpose:
 *
 *  1. something was actually inserted → the kept sentence, carrying the counts
 *     the SERVER reported (0 and 1 pluralised honestly, because a carry can
 *     legitimately keep the school-day rules while a grade already had its own
 *     times, and saying "0" is truer than hiding the part);
 *  2. at least one switch was ON and nothing was inserted → "this year already
 *     had all of it", which is what actually happened;
 *  3. BOTH switches were off → null. Saying "this year already had all of it"
 *     would be a false claim: the operator asked for an empty year and got one.
 *     The switch rows on the card already said `The new year starts empty for
 *     this.`, so the state is visible and no new sentence is invented here.
 */
/** The shape the kept line reads: the server's plan plus the two RESOLVED switches. */
export type PlainYearSetupCarrySummary = {
	applied: boolean;
	keepSchedulingRules: boolean;
	keepGradeTimeWindows: boolean;
	plan: {
		sourceYearLabel: string | null;
		gradeShiftWindows: { toInsert: number };
		policySpecialEvents: { toInsert: number };
	};
};

/**
 * Reads the carry result off an APPLY RESPONSE without assuming it is there.
 *
 * The confirmation may be rendered from a status that never came from an apply
 * (a reload, an archive-and-sync, or a server older than this packet), so every
 * absent part degrades to "no line" rather than to a claim. Nothing here
 * defaults a missing value: a missing carry is not "nothing was kept", it is
 * "there is nothing to say".
 */
export function plainYearSetupCarrySummary(applied: unknown): PlainYearSetupCarrySummary | null {
	const carry = (applied as { sync?: { yearSetupCarry?: unknown } } | null | undefined)?.sync?.yearSetupCarry;
	if (carry == null || typeof carry !== 'object') return null;
	const result = carry as {
		applied?: unknown;
		keepSchedulingRules?: unknown;
		keepGradeTimeWindows?: unknown;
		plan?: { sourceYearLabel?: unknown; gradeShiftWindows?: { toInsert?: unknown }; policySpecialEvents?: { toInsert?: unknown } } | null;
	};
	if (result.plan == null || typeof result.plan !== 'object') return null;
	const windows = Number(result.plan.gradeShiftWindows?.toInsert ?? 0);
	const events = Number(result.plan.policySpecialEvents?.toInsert ?? 0);
	if (!Number.isFinite(windows) || !Number.isFinite(events)) return null;
	return {
		applied: result.applied === true,
		keepSchedulingRules: result.keepSchedulingRules !== false,
		keepGradeTimeWindows: result.keepGradeTimeWindows !== false,
		plan: {
			sourceYearLabel: typeof result.plan.sourceYearLabel === 'string' ? result.plan.sourceYearLabel : null,
			gradeShiftWindows: { toInsert: windows },
			policySpecialEvents: { toInsert: events },
		},
	};
}

export function plainYearSetupKeptLine(carry: PlainYearSetupCarrySummary | null | undefined): string | null {
	if (!carry) return null;
	if (carry.applied) {
		const yearLabel = carry.plan.sourceYearLabel;
		const windows = plainCount(carry.plan.gradeShiftWindows.toInsert, 'grade start and finish time', 'grade start and finish times');
		const events = plainCount(carry.plan.policySpecialEvents.toInsert, 'flag ceremony and special day', 'flag ceremonies and special days');
		return yearLabel
			? `Kept from ${yearLabel}: your school day rules, ${windows}, and ${events}.`
			: `Kept: your school day rules, ${windows}, and ${events}.`;
	}
	if (!carry.keepSchedulingRules && !carry.keepGradeTimeWindows) return null;
	return PLAIN_KEEP_NOTHING_LINE;
}
