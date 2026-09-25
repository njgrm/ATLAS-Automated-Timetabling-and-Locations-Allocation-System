/**
 * LANE-C-PLAIN-LANGUAGE-C03 (J1) — one plain word for one idea, stated once.
 *
 * The 2026-09-26 audit (finding 3) found the same HARD problem rendered under
 * four different names on one screen — `Must fix` (grid), `Blocked` (grid
 * badge), `blocker` (header chip) and `Hard` (summary stat) — and three
 * different "hard" numbers with nothing saying they can legitimately differ. A
 * scheduler could read `0 Hard` in one place and `3 blockers` in another and
 * conclude the product contradicts itself.
 *
 * `MUST_FIX_LABEL` is the single plain word. It is already the grid's severity
 * sign and the C1 disclosure paragraph already speaks of a rule that "breaks",
 * so reusing it introduces no new vocabulary for an older scheduler to learn.
 *
 * The three counts are genuinely different measurements and are NOT merged by
 * this module: `blockingHardCount` is the allowlist-filtered,
 * publication-relevant count, `hardCount` is every HARD, and
 * `summary.hardViolationCount` is the run's recorded total.
 * `HARD_COUNT_RELATIONSHIP_NOTE` states that relationship once in plain words,
 * so any surface showing more than one of them explains itself. No new number
 * is introduced.
 */

import type {
	GenerationRunStatus,
	RoomPreferenceDecisionStatus,
	RoomRequestAppealStatus,
} from '@/types';
import { humaniseEngineToken } from '@/lib/violation-presentation';

/** The one plain word for "a problem that stops you saving and publishing". */
export const MUST_FIX_LABEL = 'Must fix';

/**
 * The one plain phrase for the OTHER count: every serious problem the run
 * recorded, including the ones that do not stop publishing.
 *
 * It exists because the number is genuinely different from `MUST_FIX_LABEL`:
 * `RunSummary.hardViolationCount` is the run's TOTAL, while
 * `RunSummary.blockingHardViolationCount` is the allowlist-filtered
 * publication-relevant subset (`timetableWorkspaceTruth.ts`
 * `deriveRunWideReadiness` reads them as two distinct fields, and
 * `blockingHardCount = summaryBlockingHard ?? summaryHard ?? displayHard`).
 * A surface that shows the TOTAL must therefore NOT wear the blocking word,
 * or a run with `hardViolationCount: 4, blockingHardViolationCount: 0` renders
 * "Must fix: 4" and contradicts the publish gate three lines away.
 */
export const ALL_SERIOUS_PROBLEMS_LABEL = 'All serious problems';

/** `mustFixCountLabel(3)` -> `"3 Must fix"`. */
export function mustFixCountLabel(count: number): string {
	return `${count} ${MUST_FIX_LABEL}`;
}

/**
 * The consequence sentence for a publish gate that is shut, in one shape, so
 * the header chip and the setup pane cannot disagree about what is wrong.
 * `blockingHardCount` is the publication-relevant count, so its clause wears
 * `MUST_FIX_LABEL`; an unresolved-session clause names sessions, which is the
 * unit every other surface uses for that count.
 */
export function publishBlockedSentence(input: {
	blockingHardCount: number;
	unassignedCount: number;
}): string {
	const unplaced = input.unassignedCount;
	const tail = unplaced > 0
		? `${unplaced} session${unplaced === 1 ? ' still needs' : 's still need'} fixing`
		: mustFixCountLabel(input.blockingHardCount);
	return `${tail} — this schedule cannot be published yet.`;
}

/* The consequence sentences ("This blocks saving and publishing." / "This does
 * not block saving or publishing.") are deliberately NOT re-exported here: they
 * are already correct in the grid badge and the session details, they are the
 * best plain English on the surface, and a second copy of the same idea is the
 * exact hazard this module exists to remove (audit "protect this" 2). */

/**
 * Stated once, in plain words, on any surface that shows more than one "hard"
 * number. It names why the numbers differ (so a mismatch reads as deliberate
 * rather than contradictory) and what a zero in the first column means.
 */
export const HARD_COUNT_RELATIONSHIP_NOTE =
	'“Must fix” counts the problems that stop you saving and publishing. The total also counts '
	+ 'serious problems that do not stop publishing, so the total can be higher. '
	+ 'If “Must fix” is 0 but the total is not, the schedule can still be published.';

/**
 * Plain scope words. `run-wide` is the whole year's schedule, which is what
 * decides publication; a selected-term scope is only what one term shows.
 */
export function plainScopeLabel(scope: 'run-wide' | 'selected-term'): string {
	return scope === 'run-wide' ? 'Whole year' : 'Selected term only';
}

/* ------------------------------------------------------------------ *
 * PLAIN-LANGUAGE-J2J3-C01 (J2) — engine tokens that were still on screen.
 *
 * Three unions reached the operator as raw `SCREAMING_SNAKE`:
 * `request.decisionStatus` (left rail + selected-entry panel), `appeal.status`
 * (workflow dialog) and `run.status` (runs pane + summary stat). The repo
 * already had the right pattern for this — `ACTION_LABELS: Record<
 * RoomPreferenceActionType, string>` in the Officer room-preferences page: a
 * TOTAL `Record<Enum, string>` of plain words, so a new union member is a
 * compile error instead of a silent enum on screen. These three reuse it.
 *
 * The maps are total by annotation, which is the load-bearing part: totality is
 * what guarantees no enum can leak, and a `Record<Union, string>` is checked by
 * the compiler rather than by a test that could be deleted.
 */

/** `RoomPreferenceDecisionStatus` — a room request's officer decision. */
export const ROOM_DECISION_STATUS_LABELS: Record<RoomPreferenceDecisionStatus, string> = {
	PENDING: 'Waiting for a decision',
	APPROVED: 'Approved',
	REJECTED: 'Not approved',
};

/** `RoomRequestAppealStatus` — what happened to a room request's appeal. */
export const ROOM_APPEAL_STATUS_LABELS: Record<RoomRequestAppealStatus, string> = {
	OPEN: 'Open',
	UNDER_REVIEW: 'Being reviewed',
	UPHELD: 'Upheld',
	DENIED: 'Not upheld',
};

/** `GenerationRunStatus` — what one scheduling attempt did. */
export const GENERATION_RUN_STATUS_LABELS: Record<GenerationRunStatus, string> = {
	QUEUED: 'Waiting to start',
	RUNNING: 'In progress',
	COMPLETED: 'Finished',
	FAILED: 'Did not finish',
};

/** The one "this value is genuinely absent" marker, matching the em-dash the
 * surfaces already used. It is not an enum, so it is not in any map. */
const ABSENT_VALUE_LABEL = '—';

function plainEnumLabel<T extends string>(
	map: Record<T, string>,
	value: string | null | undefined,
): string {
	// An absent value keeps the existing em-dash. It must not be humanised into
	// a word, and it must not reach a map lookup typed as the union.
	if (value == null || value === '' || value === ABSENT_VALUE_LABEL) return ABSENT_VALUE_LABEL;
	const known = map[value as T];
	if (known) return known;
	// A value outside the union (a newer server, a stored legacy row) degrades
	// to a readable phrase. It must NEVER echo the raw token: an unmapped enum
	// reaching the operator is the exact defect J2 exists to close, so a missing
	// map entry is a defect here, not a pass.
	return humaniseEngineToken(value);
}

export function plainRoomDecisionStatus(value: string | null | undefined): string {
	return plainEnumLabel(ROOM_DECISION_STATUS_LABELS, value);
}

export function plainRoomAppealStatus(value: string | null | undefined): string {
	return plainEnumLabel(ROOM_APPEAL_STATUS_LABELS, value);
}

export function plainGenerationRunStatus(value: string | null | undefined): string {
	return plainEnumLabel(GENERATION_RUN_STATUS_LABELS, value);
}

/**
 * The canonical wording for "nothing is waiting to be placed", in the one unit
 * every other surface already uses for that count: sessions.
 *
 * PLAIN-LANGUAGE-J2J3-C01 (J3) — this state read "All classes assigned
 * successfully" in two places. That sentence is not merely jargon: `classes`
 * is the WRONG UNIT. The count behind it is `unassignedCount`, which the
 * resolver, five other consumers and the J1 publish checklist all call
 * sessions, and an "assigned class" is a subject-period pair rather than
 * anything a scheduler places. So the sentence was wrong twice over — wrong
 * vocabulary, and a promise ("successfully") the surface cannot make, since
 * zero unplaced sessions says nothing about whether the schedule can be
 * published. It is the positive counterpart of the checklist's "N sessions need
 * placement", and it is stated once here so the two cannot drift.
 */
export const ALL_SESSIONS_PLACED_LABEL = 'All sessions placed';
