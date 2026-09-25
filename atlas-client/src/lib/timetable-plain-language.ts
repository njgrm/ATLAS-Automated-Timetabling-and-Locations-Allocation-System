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
	ManualEditType,
	RoomPreferenceDecisionStatus,
	RoomPreferenceStatus,
	RoomRequestAppealStatus,
} from '@/types';

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

/* ────────────────────────────────────────────────────────────────────────────
 * LANE-C-PLAIN-TOKENS-C04 (J2) — no engine token reaches the operator.
 *
 * Everything below is presentation only. No enum value, request payload,
 * state machine or count is changed here: a raw token that used to be printed
 * is replaced by words that say the same thing, and where the raw value was the
 * only thing available the surface says nothing rather than printing it.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * A room request's DECISION, in the words a scheduler can act on, with the
 * consequence stated once per state.
 *
 * The `next` sentences are written from the server's own behaviour
 * (`room-preference.service.ts` `reviewRoomRequest`): an APPROVED decision runs
 * the manual-edit commit that moves the session to the requested room, and a
 * REJECTED decision writes no schedule change at all. PENDING is the default
 * column value, so "nothing has changed yet" is the truthful reading of it.
 */
export type PlainRoomRequestState = { label: string; next: string };

const ROOM_REQUEST_DECISION_STATES: Record<RoomPreferenceDecisionStatus, PlainRoomRequestState> = {
	PENDING: {
		label: 'Waiting for a decision',
		next: 'Nobody has approved or declined this request yet, so the schedule has not changed.',
	},
	APPROVED: {
		label: 'Approved',
		next: 'The schedule has been changed to use the requested room.',
	},
	REJECTED: {
		label: 'Not approved',
		next: 'The request was declined, so this session keeps the room and time it already had.',
	},
};

/**
 * A room request's SUBMISSION state. This is a different measurement from the
 * decision above and is labelled separately: a request that has not been sent
 * cannot be waiting for a decision, and printing only the decision would tell a
 * scheduler it is in the queue when it is still a draft in someone's list.
 */
const ROOM_REQUEST_SUBMISSION_STATES: Record<RoomPreferenceStatus, PlainRoomRequestState> = {
	DRAFT: {
		label: 'Not sent yet',
		next: 'This request has not been sent to a scheduler, so no decision is expected on it yet.',
	},
	SUBMITTED: {
		label: 'Sent for a decision',
		next: 'This request is in the queue for a scheduler to approve or decline.',
	},
};

/**
 * An APPEAL's own state, in plain words. These describe the appeal, never its
 * effect on the room, because the appeal history does not record one.
 */
const ROOM_REQUEST_APPEAL_STATES: Record<RoomRequestAppealStatus, string> = {
	OPEN: 'waiting to be looked at',
	UNDER_REVIEW: 'being looked at now',
	UPHELD: 'allowed',
	DENIED: 'not allowed',
};

/**
 * The one plain sentence for a stored code this version has no words for. It is
 * used wherever a label lookup misses. It deliberately does NOT de-snake-case
 * the token: "faculty excessive idle gap" reads as a broken sentence and looks
 * like a typo the scheduler caused, whereas this says plainly that ATLAS has no
 * name for the rule and invites the honest next step.
 *
 * Shared by the readiness warning groups (`simplePublishReadiness`) and the
 * blocker-repair banner (`dispatchSimpleReadinessRepair`) so the two C1/C2
 * consumers cannot drift into two different sentences for one gap.
 */
export const UNLABELLED_RULE_SENTENCE = 'A problem that this version of ATLAS does not have a name for yet.';

/** Unknown members degrade to English, never to the raw token. */
export function roomRequestDecisionState(status: string | null | undefined): PlainRoomRequestState {
	return ROOM_REQUEST_DECISION_STATES[status as RoomPreferenceDecisionStatus]
		?? { label: 'Decision not recorded', next: 'This request has no recorded decision. Ask a scheduler to review it.' };
}

export function roomRequestSubmissionState(status: string | null | undefined): PlainRoomRequestState {
	return ROOM_REQUEST_SUBMISSION_STATES[status as RoomPreferenceStatus]
		?? { label: 'Submission state not recorded', next: 'This request does not say whether it was sent. Ask a scheduler to review it.' };
}

export function roomRequestAppealState(status: string | null | undefined): string {
	return ROOM_REQUEST_APPEAL_STATES[status as RoomRequestAppealStatus] ?? 'in an unrecorded state';
}

/**
 * A run number is the one internal id a scheduler can legitimately quote, so it
 * stays — but never as the label on its own. It is always a quiet suffix behind
 * a human anchor: the run's own timestamp where one is available, and a plain
 * phrase where it is not. `runAnchorLabel(318)` -> "Generated schedule · run
 * 318"; `runAnchorLabel(318, 'Sep 26, 08:05 PM')` -> "Sep 26, 08:05 PM · run 318".
 */
export function runAnchorLabel(runId: number, humanAnchor?: string | null): string {
	const anchor = humanAnchor?.trim();
	return anchor ? `${anchor} · run ${runId}` : `Generated schedule · run ${runId}`;
}

/**
 * What a manual edit actually DID, in the words a scheduler would use. Every
 * `ManualEditType` member has an entry; an unknown member degrades to a plain
 * phrase rather than a de-snake-cased token. The four CHANGE_* members are
 * distinct intents in the proposal, and MOVE_ENTRY is named "moved" because the
 * commit path may also carry a new room and teacher with the move.
 */
const MANUAL_EDIT_ACTION_LABELS: Record<ManualEditType, string> = {
	PLACE_UNASSIGNED: 'Gave an unplaced session a slot',
	MOVE_ENTRY: 'Moved a session',
	CHANGE_ROOM: 'Changed the room',
	CHANGE_FACULTY: 'Changed the teacher',
	CHANGE_TIMESLOT: 'Changed the time',
	SWAP_ENTRIES: 'Swapped two sessions',
	REVERT: 'Undid an earlier change',
};

export function manualEditActionLabel(editType: string): string {
	return MANUAL_EDIT_ACTION_LABELS[editType as ManualEditType] ?? 'Changed the schedule';
}

/**
 * A run's own state, in plain words. TRACED: `GenerationRunStatus` in
 * `prisma/schema.prisma` is exactly `QUEUED | RUNNING | COMPLETED | FAILED`,
 * and the run pane printed the enum verbatim in a badge.
 */
const GENERATION_RUN_STATE_LABELS: Record<string, string> = {
	QUEUED: 'Waiting to start',
	RUNNING: 'Being generated now',
	COMPLETED: 'Finished',
	FAILED: 'Did not finish',
};

export function generationRunStateLabel(status: string | null | undefined): string {
	return GENERATION_RUN_STATE_LABELS[status ?? ''] ?? 'In a state this version does not name';
}

/**
 * A run's KIND. TRACED: `GenerationRun.runType` is a free-form `String` with
 * `@default("FULL")`; the only other value the server writes is
 * `PERFORMANCE_FIXTURE`, which `listRuns` filters out, so `FULL` is the sole
 * member this surface can receive. The fallback therefore claims nothing about
 * a kind it has not traced.
 */
const GENERATION_RUN_KIND_LABELS: Record<string, string> = {
	FULL: 'Full run',
};

export function generationRunKindLabel(runType: string | null | undefined): string {
	return GENERATION_RUN_KIND_LABELS[runType ?? ''] ?? 'A different kind of run';
}
