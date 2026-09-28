/**
 * A6 c5 — the OUTAGE derivations for Teaching Load, in one pure module.
 *
 * WHY A SEPARATE FILE, AND WHY IT IMPORTS NO REACT AND NO API CLIENT.
 *
 * The packet's three deliverables are all statements about what a scheduler
 * reads: a shortage line that names SUBJECTS, a cover dialog whose numbers come
 * from the server's zero-write preview, and a placeholder that says what it is.
 * Every one of them had to be provable without a browser and without a
 * database, or the controls would be asserting source text (AGENTS.md §11:
 * "A test that only asserts source text is not acceptance evidence").
 *
 * So the module below is the same shape as
 * `components/faculty-assignments/teachingLoadWorkspaceMetrics.ts`: pure
 * functions, React-free, API-free, with the page deciding WHEN to recompute.
 * A component that quietly grew a write cannot hide here, because there is
 * nothing here that can write.
 *
 * THE THREE FIXTURES THIS MODULE OWNS, and the defect each closes.
 *
 *  1. `PLACEHOLDER_TRUTH_LABEL` — `to be hired — not a real person yet`. One
 *     string, three surfaces (roster row, sections grid, suggestion preview
 *     row). The defect it closes: a bare one-word `temporary` footnote, a
 *     percentage that was simply suppressed, and an empty Teacher cell with a
 *     colour-only chip. Three different silences for one fact.
 *
 *  2. `buildSubjectShortage` — which classes need a REAL teacher, per subject.
 *     The defect: a workspace-wide `12 classes need a teacher` forces the
 *     scheduler to open Subject Coverage to learn WHICH subject is short. The
 *     predicate counts a class as short when it has no owner at all AND when
 *     its owner is a placeholder, because a to-be-hired record is not a
 *     teacher. `completedSectionIds` already walked this same pair space; the
 *     applicability predicate is shared rather than re-derived so the roster's
 *     "completed" ticks and the header's shortage figures cannot disagree.
 *
 *  3. `coverPreviewNumber` / `coverOptionConsequence` — the three options and
 *     their consequence lines. The defect: a control with no stated
 *     consequence, and a preview number invented on the client instead of read
 *     from the server's `apply:false` plan.
 */
import { getAssignmentOwnershipKey, type FacultyOwnershipState } from '@/lib/faculty-assignment-helpers';
import type { ExternalSection, Subject } from '@/types';

/**
 * A6 c5 §3 — the ONE label that says what a placeholder is, everywhere it
 * appears in Teaching Load.
 *
 * It is exported rather than retyped three times because a placeholder that
 * reads `to be hired` on the roster and `temporary` in the grid is the same
 * defect the packet names, in a smaller font.
 */
export const PLACEHOLDER_TRUTH_LABEL = 'to be hired — not a real person yet';

/** How many subjects the shortage line names before it collapses to `+N more`. */
export const SHORTAGE_LINE_SUBJECT_CAP = 3;

/**
 * Whether this subject is a teaching subject this section can carry.
 *
 * SHARED with `completedSectionIds` on purpose, and the reasons are the packet's:
 * a shortage figure and a roster tick that disagreed about which pairs exist
 * would produce two different truths on one screen. Homeroom Guidance is
 * guidance, not a teaching load, so `HG` is excluded exactly as it is on the
 * roster.
 */
export function isSectionSubjectApplicable(
	subject: Subject,
	section: Pick<ExternalSection, 'displayOrder' | 'programType'>,
): boolean {
	if (!subject.isActive || subject.code === 'HG') return false;
	const gradeCompatible = subject.gradeLevels.length === 0 || subject.gradeLevels.includes(section.displayOrder);
	if (!gradeCompatible) return false;
	const programType = (section.programType ?? 'REGULAR').toUpperCase();
	const subjectScopes = subject.programScopes || [];
	return subjectScopes.length === 0 || subjectScopes.some((scope) => scope.toUpperCase() === programType);
}

/** One subject's share of the outage, as the line names it. */
export type SubjectShortageEntry = {
	subjectId: number;
	subjectCode: string;
	subjectName: string;
	/** Classes in this subject with no REAL teacher (unowned OR placeholder-held). */
	shortClassCount: number;
};

export type SubjectShortageResult = {
	/** Descending by `shortClassCount`, so the worst subject is read first. */
	entries: SubjectShortageEntry[];
	/** The total across every subject, which is the whole workspace's figure. */
	totalShortClasses: number;
};

/**
 * Per-subject shortage, derived from the SAVED ownership index the page already
 * holds.
 *
 * `savedOwnershipMap` is preferred over the effective (draft-inclusive) map
 * because the packet says the figure comes from saved coverage: a scheduler
 * reading a shortage number must be reading what ATLAS has committed, not a
 * half-made draft that may be discarded. `pendingOwnershipMap` is the fallback
 * for a scope whose index has not arrived, which is the same fallback
 * `completedSectionIds` uses, and it can only ever make a class look
 * LESS short — never more — so the line can never overstate the problem.
 *
 * `activeFacultyIds` gates the owner exactly as it gates the roster tick: an
 * owner who is not in the active roster is not a teacher, so their class is
 * short.
 */
export function buildSubjectShortage(input: {
	subjects: Subject[];
	sections: ExternalSection[];
	savedOwnershipMap: Record<string, FacultyOwnershipState>;
	pendingOwnershipMap: Record<string, FacultyOwnershipState>;
	placeholderFacultyIds: Set<number>;
	activeFacultyIds: Set<number>;
}): SubjectShortageResult {
	const bySubject = new Map<number, SubjectShortageEntry>();
	for (const subject of input.subjects) {
		if (subject.code === 'HG') continue;
		const entry: SubjectShortageEntry = {
			subjectId: subject.id,
			subjectCode: subject.code,
			subjectName: subject.name,
			shortClassCount: 0,
		};
		for (const section of input.sections) {
			if (!isSectionSubjectApplicable(subject, section)) continue;
			const key = getAssignmentOwnershipKey(subject.id, section.id);
			const owner = input.savedOwnershipMap[key] || input.pendingOwnershipMap[key];
			const hasRealTeacher = Boolean(
				owner
				&& input.activeFacultyIds.has(owner.facultyId)
				&& !input.placeholderFacultyIds.has(owner.facultyId),
			);
			if (!hasRealTeacher) entry.shortClassCount += 1;
		}
		if (entry.shortClassCount > 0) bySubject.set(subject.id, entry);
	}
	const entries = Array.from(bySubject.values()).sort(
		(left, right) => right.shortClassCount - left.shortClassCount
			|| left.subjectCode.localeCompare(right.subjectCode),
	);
	return {
		entries,
		totalShortClasses: entries.reduce((total, entry) => total + entry.shortClassCount, 0),
	};
}

/** `MAPEH: 9 classes need a teacher` — singular at one, never abbreviated. */
export function shortageClauseFor(entry: SubjectShortageEntry): string {
	const noun = entry.shortClassCount === 1 ? 'class needs' : 'classes need';
	return `${entry.subjectName}: ${entry.shortClassCount} ${noun} a teacher`;
}

/**
 * The data date, from the ONLY timestamp the client genuinely holds.
 *
 * `SectionSummaryResponse.fetchedAt` is that timestamp; the page supplies it and
 * supplies nothing else. An unparseable or absent value yields `null` and the
 * caller DROPS the clause — the packet forbids inventing a date, and a
 * fabricated "12 Sept" beside a number is the class of claim this packet exists
 * to remove. The format is fixed (`en-GB`, UTC) so the committed control can
 * assert the literal string without depending on the machine's locale.
 */
export function formatShortageDataDate(fetchedAt: string | null | undefined): string | null {
	if (!fetchedAt) return null;
	const parsed = new Date(fetchedAt);
	if (Number.isNaN(parsed.getTime())) return null;
	return `${parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })} roster`;
}

export type ShortageLineModel = {
	/** The named subjects, capped. */
	visible: SubjectShortageEntry[];
	/** How many further short subjects the `+N more` link stands for. */
	moreSubjectCount: number;
	/** `12 Sept roster`, or null when ATLAS holds no timestamp. */
	dataDateLabel: string | null;
	/** The whole line's text, assembled here so no two call sites can differ. */
	text: string;
	/** The `+N more` link's accessible name, or null when nothing is hidden. */
	moreLabel: string | null;
};

/**
 * The shortage line's own model, returned WHOLE so the visible text, the count
 * the `+N more` link stands for, and the link's accessible name can never come
 * from different branches.
 *
 * The count is named, not numbered: the operator reads `2 more subjects`, and
 * a `+2` is a code, not a sentence.
 */
export function buildShortageLineModel(input: {
	entries: SubjectShortageEntry[];
	dataDateLabel: string | null;
	cap?: number;
}): ShortageLineModel {
	const cap = input.cap ?? SHORTAGE_LINE_SUBJECT_CAP;
	const visible = input.entries.slice(0, cap);
	const hidden = input.entries.length - visible.length;
	const parts = visible.map(shortageClauseFor);
	if (hidden > 0) parts.push(`${hidden} more ${hidden === 1 ? 'subject' : 'subjects'}`);
	if (input.dataDateLabel) parts.push(input.dataDateLabel);
	return {
		visible,
		moreSubjectCount: hidden,
		dataDateLabel: input.dataDateLabel,
		text: parts.join(' · '),
		moreLabel: hidden > 0
			? `${hidden} more ${hidden === 1 ? 'subject needs' : 'subjects need'} a teacher`
			: null,
	};
}

/**
 * A6 c5 §3 — the two figures that lie about placeholders, corrected at source.
 *
 * `% staffed` counted `(real + placeholder) / total`, so a roster held entirely
 * by to-be-hired records read 100% staffed. `Still without a teacher` counted
 * UNOWNED pairs only, so it read 0 while 25 classes sat on temporary records.
 * Both are the same question asked wrong: the answer is "how many classes have
 * a REAL teacher", so both are derived from `realAssigned` alone.
 */
export type StaffingTruthFigures = {
	/** Percentage of classes held by a real, active teacher. */
	staffedPercent: number;
	/** Classes with no real teacher: unowned PLUS placeholder-held. */
	withoutRealTeacherCount: number;
};

export function buildStaffingTruthFigures(input: {
	realAssignedPairs: number;
	syntheticPlaceholderPairs: number;
	unassignedPairs: number;
	totalPairs: number;
}): StaffingTruthFigures {
	const real = Math.max(0, input.realAssignedPairs);
	const placeholder = Math.max(0, input.syntheticPlaceholderPairs);
	const unowned = Math.max(0, input.unassignedPairs);
	const total = Math.max(0, input.totalPairs);
	return {
		staffedPercent: total > 0 ? Math.round((real / total) * 100) : 0,
		withoutRealTeacherCount: placeholder + unowned,
	};
}

/** The three cover options, and the ONE line of consequence each carries. */
export type CoverOptionId = 'standard-30' | 'stretch-40' | 'leave-open';

export type CoverOption = {
	id: CoverOptionId;
	label: string;
	consequence: string;
	/** The server contract this option sends, or null for `leave-open`. */
	maxHoursPerWeek: number | null;
};

export const COVER_OPTIONS: readonly CoverOption[] = [
	{
		id: 'standard-30',
		label: '30 hours a week',
		consequence: 'A standard load. Leaves the other classes for a teacher you already have.',
		maxHoursPerWeek: 30,
	},
	{
		id: 'stretch-40',
		label: 'Stretch to 40 hours',
		consequence: 'Only for a subject specialist. A heavier load for one person.',
		maxHoursPerWeek: 40,
	},
	{
		id: 'leave-open',
		label: 'Leave it open',
		consequence: 'Nothing is saved. These classes stay on the shortage line.',
		maxHoursPerWeek: null,
	},
] as const;

/** `Leave it open` is a decision, not a contract, so it never has a number. */
export function isCoverOptionApplicable(option: CoverOption): boolean {
	return option.maxHoursPerWeek != null;
}

/**
 * `covers 6 of the 9` — the preview number, read from the server's plan.
 *
 * It counts the classes the plan would ASSIGN (`plannedPairCount`), not the
 * classes left behind: "covers 6 of the 9" is the decision the scheduler is
 * making, and a figure that counted the leftovers would answer a question
 * nobody asked. A plan that resolves nothing renders no number at all, because
 * `covers 0 of the 9` is a wall of text where a dash belongs.
 */
export function coverPreviewNumber(input: {
	plannedPairCount: number | null | undefined;
	shortClassCount: number;
}): string | null {
	const planned = input.plannedPairCount;
	if (planned == null || !Number.isFinite(planned) || planned <= 0) return null;
	const total = Math.max(0, input.shortClassCount);
	return `covers ${planned} of the ${total}`;
}

/** A pair id mapped to the words a scheduler can read, never `sectionId: 412`. */
export function classNameForPair(
	pair: { subjectId: number; sectionId: number },
	subjects: Subject[],
	sectionMap: Map<number, ExternalSection>,
): string {
	const subject = subjects.find((row) => row.id === pair.subjectId);
	const section = sectionMap.get(pair.sectionId);
	const subjectLabel = subject?.name ?? subject?.code ?? 'this subject';
	const sectionLabel = section?.name ?? 'this class';
	return `${subjectLabel} — ${sectionLabel}`;
}

export type NamedClassList = {
	/** Class names, in the order the server returned them. */
	names: string[];
	/** How many were collapsed behind `and N more`. */
	overflowCount: number;
};

/**
 * Map a server pair list to class names, bounded at ten.
 *
 * The bound is the server's own (`changedPairs` is capped at ten in
 * `teaching-load-suggestion-proposal.service.ts`), and it is honoured HERE too
 * so a client that receives a longer list still renders one readable sentence
 * rather than a wall. `and N more` is counted, never dropped: a bounded list
 * that does not say what it hid is a quieter version of the defect this packet
 * is about.
 */
export function namedClassesFromPairs(
	pairs: ReadonlyArray<{ subjectId: number; sectionId: number }>,
	subjects: Subject[],
	sectionMap: Map<number, ExternalSection>,
	limit = 10,
): NamedClassList {
	const names = pairs.slice(0, limit).map((pair) => classNameForPair(pair, subjects, sectionMap));
	return { names, overflowCount: Math.max(0, pairs.length - names.length) };
}

/** `MAPEH 7 and Fil 7-STAFF`, or `and 3 more` beside them. Never an id. */
export function joinClassNames(list: NamedClassList): string {
	if (list.names.length === 0) return 'none';
	const joined = list.names.join(', ');
	return list.overflowCount > 0 ? `${joined} and ${list.overflowCount} more` : joined;
}

/**
 * A6 c5 §2 — the after-state, and the one word it must never print.
 *
 * `applyResult.stillUncoveredPairs` is the authoritative "still open" list, and
 * `unresolvedSubjectRefs` names the subjects ATLAS could not resolve at all. A
 * result that still has either is INCOMPLETE, and the packet's S8 forbids
 * showing `complete` for it: `A8 c2` changed `created` / `assignmentsCreated`
 * to count persisted inserts only, so they are not a delivered-coverage figure
 * and this function never reads them.
 */
export type CoverOutcomeModel = {
	isComplete: boolean;
	/** What the call assigned, in class names. */
	assignedLine: string;
	/** What is still open, in class names, or the honest "which is none". */
	stillOpenLine: string;
	/** The one next step a scheduler can take from here. */
	nextStep: string;
};

export function buildCoverOutcomeModel(input: {
	assignedPairs: ReadonlyArray<{ subjectId: number; sectionId: number }>;
	stillUncoveredPairs: ReadonlyArray<{ subjectId: number; sectionId: number }>;
	unresolvedSubjectRefs: ReadonlyArray<string>;
	subjects: Subject[];
	sectionMap: Map<number, ExternalSection>;
}): CoverOutcomeModel {
	const assigned = namedClassesFromPairs(input.assignedPairs, input.subjects, input.sectionMap);
	const stillOpen = namedClassesFromPairs(input.stillUncoveredPairs, input.subjects, input.sectionMap);
	const isComplete = stillOpen.names.length === 0 && input.unresolvedSubjectRefs.length === 0;
	return {
		isComplete,
		assignedLine: assigned.names.length > 0
			? `Assigned ${joinClassNames(assigned)}.`
			: 'ATLAS assigned no classes.',
		stillOpenLine: stillOpen.names.length > 0
			? `${stillOpen.names.length} still open: ${joinClassNames(stillOpen)}.`
			: input.unresolvedSubjectRefs.length > 0
				? `No class was assigned. ATLAS could not resolve ${input.unresolvedSubjectRefs.join(', ')}.`
				: 'Every class in this subject now has a real teacher.',
		nextStep: isComplete
			? 'Close this dialog and review the rest of Teaching Load.'
			: 'Cover the classes still listed, or leave them open and come back to them.',
	};
}

/**
 * A6 c5 §2 — the 409 drift surface, named in plain words.
 *
 * The server bounds `details.changedPairs` at ten and reports
 * `remainingChangedPairCount` for the rest, so the sentence is assembled from
 * the pair list AND the server's own remainder rather than from a length guess.
 * `Review again` re-runs the `apply:false` preview, which is the only honest
 * next step: the plan the scheduler was shown is no longer the plan.
 */
export type CoverDriftModel = {
	headline: string;
	changedLine: string;
	remainingCount: number;
	/** The control's label; the packet names it, so it is not reworded. */
	retryLabel: string;
};

export function buildCoverDriftModel(input: {
	driftScope: string | null | undefined;
	details: {
		changedPairs?: ReadonlyArray<{ subjectId: number; sectionId: number }> | null;
		changedPairCount?: number | null;
		remainingChangedPairCount?: number | null;
	} | null | undefined;
	subjects: Subject[];
	sectionMap: Map<number, ExternalSection>;
}): CoverDriftModel {
	const pairs = input.details?.changedPairs ?? [];
	const named = namedClassesFromPairs(pairs, input.subjects, input.sectionMap);
	const reported = input.details?.changedPairCount ?? pairs.length;
	const serverRemaining = input.details?.remainingChangedPairCount ?? 0;
	// The server's remainder is authoritative; the named overflow only matters
	// when the server did not report one.
	const remainingCount = Math.max(serverRemaining, named.overflowCount, Math.max(0, reported - named.names.length));
	const scope = input.driftScope ? ` (${input.driftScope})` : '';
	return {
		headline: `Teaching Load changed while you were deciding${scope}.`,
		changedLine: named.names.length > 0
			? `These classes are no longer the ones you previewed: ${joinClassNames(named)}.`
			: 'The classes you previewed are no longer the ones ATLAS would assign.',
		remainingCount,
		retryLabel: 'Review again',
	};
}
