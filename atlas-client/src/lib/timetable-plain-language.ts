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
	ManualEditType,
	RoomPreferenceDecisionStatus,
	RoomPreferenceStatus,
	RoomRequestAppealStatus,
} from '@/types';
import { UNLABELLED_RULE_SENTENCE, plainRuleValue } from '@/lib/plain-rule-degradation';

/* The degradation rule itself — the honest unlabelled sentence, the absent-value
 * em dash, and the ONE total helper that applies them — lives in
 * `lib/plain-rule-degradation.ts`, which imports nothing from here. It has to:
 * `lib/violation-presentation.ts` needs the same rule, and this module already
 * imports from that file, so a rule owned by either label module could not be
 * shared without an import cycle. `UNLABELLED_RULE_SENTENCE` is re-exported
 * below so every existing importer keeps working unchanged. */
export { UNLABELLED_RULE_SENTENCE };

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
 * `MUST_FIX_LABEL` in the one grammatical form a SENTENCE needs: a countable
 * noun phrase, so the same idea can be the subject of a verb.
 *
 * A2-TIMETABLE-CUSTODY (item 1). `MUST_FIX_LABEL` is a LABEL, and the sanctioned
 * chip/summary form above — `"3 Must fix"` — is a caption, not a noun. Putting
 * the bare label in front of a verb produced the ungrammatical
 * `"2 Must fix still need fixing …"`, because "Must fix" cannot be counted.
 * A surface that needs the idea as a SUBJECT (`N problems still need fixing`)
 * uses this instead, so there is still exactly one place the words are written.
 *
 * It is DERIVED from `MUST_FIX_LABEL`, never a second literal: a
 * `"Must fix problems"` typed here would be exactly the fourth-copy drift this
 * module exists to prevent, and it would survive every future rename.
 */
export const MUST_FIX_PROBLEM_NOUN = `${MUST_FIX_LABEL} problem`;

/**
 * `mustFixProblemCountLabel(2)` -> `"2 Must fix problems"`, and the singular
 * `mustFixProblemCountLabel(1)` -> `"1 Must fix problem"`.
 *
 * The plural is formed by suffixing the singular, so the noun is written once
 * and the two forms cannot drift. `count === 1` is the singular rule, matching
 * the unresolved-session clause beside it.
 */
export function mustFixProblemCountLabel(count: number): string {
	return `${count} ${count === 1 ? MUST_FIX_PROBLEM_NOUN : `${MUST_FIX_PROBLEM_NOUN}s`}`;
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
		? classesNeedingTime(unplaced)
		: mustFixCountLabel(input.blockingHardCount);
	return `${tail}${CLAUSE_SEPARATOR}${SAVE_BLOCKED_SHORT}`;
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
	'“Must fix” counts the problems that stop you saving. The total also counts '
	+ 'serious problems that do not stop saving, so the total can be higher. '
	+ 'If “Must fix” is 0 but the total is not, the schedule can still be saved.';

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
		next: 'The request was declined, so this class keeps the room and time it already had.',
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
 * `UNLABELLED_RULE_SENTENCE` is OWNED by `lib/plain-rule-degradation.ts` and
 * re-exported above. The rule it belongs to, restated here so this file cannot
 * be read as making a promise its own code does not keep:
 *
 *   absent value      -> the em-dash marker
 *   known member      -> the plain label from the ONE canonical map
 *   unmapped value    -> the shared honest sentence, NEVER a de-snake-cased
 *                        engine token
 *
 * R1 moved that sentence out of this module because `resolveViolationTitle` in
 * `lib/violation-presentation.ts` needs the same rule, and the import that
 * existed between the two files (this one reading `humaniseEngineToken` from
 * there) made the reverse import a cycle. While the sentence lived only here,
 * the other resolver improvised its own degradation and the same code rendered
 * two different sentences on two surfaces. Do not reintroduce a local fallback:
 * every degradation in this file goes through `plainRuleValue`.
 */

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
	return anchor ? `${anchor} · run ${runId}` : `${EDIT_STATE_LABEL} · run ${runId}`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * A2-TIMETABLE-CUSTODY — one meaning for "not placed yet", and one line that
 * says WHICH run is on screen.
 *
 * #57/#44: two numbers shared the word "unassigned" and meant two different
 * populations. Traced, not assumed:
 *   - the pre-generation draft board's `counts.unscheduled`
 *     (`pre-generation-draft.service.ts`, the `counts.unscheduled++` in the
 *     demand-vs-saved-placement loop) counts this year's WEEKLY demand sessions
 *     that have no saved draft placement yet;
 *   - a run's `summary.unassignedCount` (`generation.service.ts`, from the
 *     constructor result) counts the sessions that run could not place in its
 *     own grid.
 * Both are truthful about their own population. Neither is "wrong". The defect
 * was the shared word, so a scheduler read "Still unassigned: 1295" in the
 * generate dialog and "0" from the finish toast seconds later on the same run
 * and could not tell whether the schedule was complete.
 *
 * The fix is therefore to NAME each population, not to reconcile the numbers:
 * a truthful 1295 of a different thing beats a silently reconciled wrong 0.
 * These two constants are the single source for those names, so the generate
 * dialog, the left-rail badge, the publish checklist and the finish toast cannot
 * drift back into one word for two things.
 */

/** Names the pre-generation population: weekly demand with no saved placement. */
export const WEEKLY_UNPLACED_LABEL = 'Weekly demand with no time yet';

/**
 * The ONE clarification of which number is which, now one short sentence.
 *
 * A2-UX-COPY-C2 (U3a): this was 35 words of explanation ("…counts this year's
 * weekly demand that has no saved placement yet. A finished run reports a
 * different count: the sessions that run could not place in its own grid.") and
 * the generate dialog it sat in was 155 words. Both populations are still named —
 * that was the #57/#44 point and it is not given up — but the names now come
 * from the row labels themselves, so the sentence only has to say that a new
 * draft measures something else. 20 words, and it still contains the shared
 * label so the two can never drift apart.
 */
export const UNPLACED_COUNT_DISAMBIGUATION =
	`"${WEEKLY_UNPLACED_LABEL}" is this year's demand. A new schedule counts the classes it could not place.`;

/** The short badge form of the same population, for a space-limited badge. */
export const WEEKLY_UNPLACED_BADGE_LABEL = 'classes with no time yet';

/** Names the run population: classes a specific schedule could not place. */
export function runUnplacedSentence(count: number): string {
	return `${count} class${count === 1 ? '' : 'es'} this schedule could not place`;
}

/**
 * #41 / A2-UX-COPY-C2 (U1, U5) — the one plain line that says what the schedule
 * on screen actually IS.
 *
 * It used to be `Run 321 · Draft`: the run number was the SUBJECT, the state was
 * a suffix behind a middot, and the doubled "Run" collided with the header's own
 * `Run:` cell label to produce "Run: Run 321". It said nothing about what Draft
 * MEANS, which is the only thing a scheduler needs from it — a draft is invisible
 * to teachers and students, a published schedule is the one they are using.
 *
 * So the sentence is now STATE-FIRST and says the consequence. The run number
 * survives as a quiet trailing reference, because #41 (the screen must name the
 * run it is showing) is accepted committed behaviour and the number is what makes
 * a second, different run distinguishable — but it is no longer the subject, and
 * it can never be the first word.
 *
 * `null` when there is genuinely nothing to name, so a caller omits the line
 * rather than printing a placeholder.
 */
export function runStateSentence(input: {
	isPreGeneration: boolean;
	hasRun: boolean;
	runId: number | null | undefined;
	isPublished: boolean;
}): string | null {
	// U5: the empty state. "Planning draft — no generated run yet" described the
	// surface's own implementation and then said nothing had been made.
	// D1: the word "Draft" is retired here too — `planningStateSentence()`.
	if (input.isPreGeneration) return planningStateSentence();
	if (!input.hasRun || input.runId == null || !Number.isFinite(input.runId)) return null;
	const meaning = input.isPublished ? saveStateSentence() : editStateSentence();
	return `${meaning} (Run ${input.runId})`;
}

/**
 * #51 — the Expert heading badge, which read "Generated timetable" over a
 * PUBLISHED run and so never said what the run actually was. The badge carries
 * the same Draft/Published word as `runStateSentence`, so the two cannot
 * disagree, and the run number stays in the one plain line beside it.
 *
 * A2-UX-COPY-C2 (U5): the two "nothing here yet" branches now share ONE label
 * that says what is missing, instead of "Planning draft" (which described the
 * screen) and "No generated run yet" (which described the engine). One noun, one
 * verb-free label, so the badge is scannable at a glance.
 */
export function runStateBadgeLabel(input: {
	isPreGeneration: boolean;
	hasRun: boolean;
	isPublished: boolean;
}): string {
	if (input.isPreGeneration || !input.hasRun) return 'No schedule yet';
	// D1: the badge is `Save schedule` / `Edit schedule`, derived from the ONE
	// mapping, so it can never disagree with `stateWord` or the strip.
	return stateBadgeLabel(input.isPublished);
}

/**
 * What a manual edit actually DID, in the words a scheduler would use. Every
 * `ManualEditType` member has an entry; an unknown member degrades to a plain
 * phrase rather than a de-snake-cased token. The four CHANGE_* members are
 * distinct intents in the proposal, and MOVE_ENTRY is named "moved" because the
 * commit path may also carry a new room and teacher with the move.
 *
 * A2-TIMETABLE-CUSTODY-R1 (D3): `REVERT` was "Undid an earlier change", which
 * is a claim about WHICH edit that the label cannot back — the same phrase
 * rendered a row that named nothing, and QA read an undo as indistinguishable
 * from any other ("No row says which edit was undone"). It is now the KIND of
 * record only ("Undone change"), a category peer of "Swapped two sessions" that
 * asserts just what `editType: 'REVERT'` is. The specific edit is named beside
 * the badge by `undoneEditLabel` in `modals/TimetableAssignmentDialogs.tsx`,
 * which resolves the server-recorded `revertedEditId`; this map keeps no opinion
 * about it, so the two cannot drift.
 */
const MANUAL_EDIT_ACTION_LABELS: Record<ManualEditType, string> = {
	PLACE_UNASSIGNED: 'Gave a class without a time a time',
	MOVE_ENTRY: 'Moved a class',
	CHANGE_ROOM: 'Changed the room',
	CHANGE_FACULTY: 'Changed the teacher',
	CHANGE_TIMESLOT: 'Changed the time',
	SWAP_ENTRIES: 'Swapped two classes',
	REVERT: 'Undone change',
};

export function manualEditActionLabel(editType: string): string {
	return MANUAL_EDIT_ACTION_LABELS[editType as ManualEditType] ?? 'Changed the schedule';
}

/**
 * A run's own state, in plain words. TRACED: `GenerationRunStatus` in
 * `prisma/schema.prisma` is exactly `QUEUED | RUNNING | COMPLETED | FAILED`,
 * and the run pane printed the enum verbatim in a badge.
 *
 * Typed `Record<GenerationRunStatus, string>`, so it is TOTAL: adding a union
 * member is a compile error here rather than a silent enum on screen. This is
 * the same guarantee `ACTION_LABELS: Record<RoomPreferenceActionType, string>`
 * gives the Officer room-preferences page, and it is why the J2J3 candidate's
 * separate `GENERATION_RUN_STATUS_LABELS` map was NOT adopted — two label sets
 * for one status is exactly the one-label-one-idea defect this module exists to
 * remove (audit finding 3). The candidate's own retyped map is grafted here
 * instead; only the name and the two middle wordings differ.
 */
const GENERATION_RUN_STATE_LABELS: Record<GenerationRunStatus, string> = {
	QUEUED: 'Waiting to start',
	RUNNING: 'Being generated now',
	COMPLETED: 'Finished',
	FAILED: 'Did not finish',
};

export function generationRunStateLabel(status: string | null | undefined): string {
	/* The cast is required by the total `Record<GenerationRunStatus, string>`
	 * annotation and is sound: a value outside the union simply misses the map
	 * and falls through to the fallback below, so an unknown or absent status
	 * still never reaches the operator as a raw enum. */
	return GENERATION_RUN_STATE_LABELS[status as GenerationRunStatus] ?? 'In a state this version does not name';
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

/* ────────────────────────────────────────────────────────────────────────────
 * PLAIN-LANGUAGE-J2J3-C01 (J2/J3) — one degradation rule, grafted onto the
 * maps above.
 *
 * The candidate's own three bare-label maps (`ROOM_DECISION_STATUS_LABELS`,
 * `ROOM_APPEAL_STATUS_LABELS`, `GENERATION_RUN_STATUS_LABELS`) are NOT adopted:
 * this module already names each of those statuses, and two label sets for one
 * status is the exact "one HARD problem has four names" defect J1 was written to
 * remove (2026-09-26 audit finding 3). What IS adopted is the rule those
 * resolvers were built on, which is strictly better than the
 * `?? 'In a state this version does not name'` fallbacks above for one specific
 * reason: it distinguishes an ABSENT value from an UNKNOWN one.
 *
 * `generationRunStateLabel(null)` and `roomRequestDecisionState(null)` both
 * conflate the two, and the conflation is a false claim — "this version does not
 * name it" asserts something about ATLAS when the truth is that the server sent
 * no value at all. So a `plain*` caller gets the em dash for absent (the marker
 * the surfaces already used). Known values still come from the canonical maps
 * above, unchanged.
 *
 * R1 (B1) SUPERSEDES this block's original step 3, which degraded an
 * out-of-union value with `humaniseEngineToken(value)` — a de-snake-cased
 * phrase. That contradicted the prose this very module carried about
 * `UNLABELLED_RULE_SENTENCE` 200 lines above, and it gave the same canonical code
 * two different sentences depending on which resolver read it. Step 3 is now the
 * shared honest sentence, applied by the ONE helper in
 * `lib/plain-rule-degradation.ts`, which this module no longer owns a private
 * copy of. There is deliberately no local `plainEnumLabel` here any more: a
 * second implementation is what let the two rules drift in the first place.
 * ──────────────────────────────────────────────────────────────────────────── */

export function plainRoomDecisionStatus(value: string | null | undefined): string {
	return plainRuleValue(ROOM_REQUEST_DECISION_STATES, value, (state) => state.label);
}

export function plainRoomAppealStatus(value: string | null | undefined): string {
	return plainRuleValue(ROOM_REQUEST_APPEAL_STATES, value, (label) => label);
}

export function plainGenerationRunStatus(value: string | null | undefined): string {
	return plainRuleValue(GENERATION_RUN_STATE_LABELS, value, (label) => label);
}

/**
 * The canonical wording for "nothing is waiting to be placed", in the one unit
 * every other surface already uses for that count: classes.
 *
 * PLAIN-LANGUAGE-J2J3-C01 (J3) — this state read "All classes assigned
 * successfully" in two places. That sentence is not merely jargon: `classes`
 * there was the WRONG UNIT paired with a promise ("successfully") the surface
 * cannot make, since zero unplaced classes says nothing about whether the
 * schedule can be published. The count behind it is `unassignedCount`, which the
 * resolver, five other consumers and the J1 publish checklist all count in
 * classes, and a "class" is the unit a scheduler actually places.
 *
 * A2-UX-COPY-C2 (NOUN RULE): "All sessions placed" is the last user-facing
 * "session" in this module and it is now "All classes placed". It is the positive
 * counterpart of the checklist's "12 classes still need a time slot", and it is
 * stated once here so the two cannot drift.
 */
export const ALL_SESSIONS_PLACED_LABEL = 'All classes placed';

/* ────────────────────────────────────────────────────────────────────────────
 * A2-UX-COPY-C2 — the Wednesday-demo copy pass for an older, mouse-first
 * scheduler. Fewer words · one verb per action · less is more.
 *
 * EVERY string below is user-facing and lives here, in the module that already
 * owns "one plain word for one idea", so a component that does not own its copy
 * can import the correct sentence rather than retyping one. The components that
 * must adopt these are named as DEPENDENCY rows in the c2 handoff: the generate
 * dialog (`modals/TimetableWorkflowDialogs.tsx`), the More-menu entry and its
 * aria-label (`simple/SimpleHeaderHelpers.tsx`, `simple/SimpleHeaderActions.tsx`),
 * the drift banner (`simple/SimpleDriftBanner.tsx`), and the generation toasts
 * (`hooks/useTimetableMutations.ts`).
 * ──────────────────────────────────────────────────────────────────────────── */

/** The ONE noun for the unit a scheduler places. Nothing user-facing says "session". */
export const CLASS_NOUN = 'class';

/**
 * R1-C2 (decision 8, operator) — the ONE unplaced-count wording:
 * `classesNeedingTime(1)` -> `"1 class needs a time slot"`, plural otherwise.
 * It replaces `"N classes still need a time"`; every user-visible string that names
 * the unplaced count goes through this function, so the noun phrase cannot drift.
 */
export function classesNeedingTime(count: number): string {
	return `${count} ${count === 1 ? CLASS_NOUN : `${CLASS_NOUN}es`} ${count === 1 ? 'needs' : 'need'} a time slot`;
}

/* ── U3a / #43 — the generate dialog, cut from 155 words to a 30-word budget ── */

/** The headline. One line, the number, no explanation. */
export const GENERATE_DIALOG_HEADLINE_LABEL = 'Classes to schedule';

/** "Actor school year" was an engine term for a plain fact. */
export const GENERATE_DIALOG_YEAR_LABEL = 'School year';

/** "Term authority" was the internal name of the saved term setup. */
export const GENERATE_DIALOG_TERM_LABEL = 'Term setup';

/** Plain wording for the saved term setup, per source. */
export const GENERATE_DIALOG_TERM_SAVED = 'Saved in ATLAS';
export const GENERATE_DIALOG_TERM_VERIFIED = 'Confirmed with EnrollPro';
export const GENERATE_DIALOG_TERM_UNCONFIRMED = 'Not confirmed';

/**
 * The absent demand count, in the same plain "Not ..." vocabulary the other two
 * absent facts already use ("Not set", "Not confirmed"). It says the count was
 * never MEASURED; it must never read as a number, and above all must never read
 * as 0.
 *
 * A2-UX-STATUS-C2 correction B2: the caller used to pass `?? 0`, so a
 * `fetchDraftBoardSummary` that returned null on an intermittent 502 became a
 * green "nothing to do" beside the headline "Classes to schedule: 0". The server
 * this release shipped says it plainly: an unmeasured count announced as 0 is the
 * worst possible lie, because a scheduler reading "all classes placed" stops
 * looking for the classes that have no slot.
 */
export const GENERATE_DIALOG_DEMAND_UNMEASURED_WORD = 'Not checked';

/** "Retained draft anchors: 0 locked sessions" -> plain, one noun, no "(s)". */
export const GENERATE_DIALOG_LOCKED_LABEL = 'Locked classes kept';

/**
 * The ONE sentence about unavailable setup data (U3a caps it at 20 words; this
 * is 14). It replaces the 35-word "why two different numbers appear" note, which
 * the two row labels now carry by construction.
 */
export const GENERATE_SETUP_UNAVAILABLE_SENTENCE =
	'If the setup data is missing, nothing is scheduled and ATLAS says what to fix.';

/** What generating does NOT do, in plain words. D1 re-words it; see the D1 block
 *  below for the constant that is actually exported. */

export type GenerateDialogTermSource = 'atlas' | 'enrollpro' | 'enrollpro-verified' | string | null | undefined;

/** The term-setup value word. An unknown source is reported, never assumed. */
export function generateDialogTermSourceWord(source: GenerateDialogTermSource): string {
	if (source === 'enrollpro-verified' || source === 'enrollpro') return GENERATE_DIALOG_TERM_VERIFIED;
	if (source === 'atlas') return GENERATE_DIALOG_TERM_SAVED;
	return GENERATE_DIALOG_TERM_UNCONFIRMED;
}

export type GenerateDialogCopyInput = {
	/** The active school year label, when the caller has one. */
	schoolYearLabel?: string | null;
	/** The resolved term-setup source, per `generateDialogTermSourceWord`. */
	termSource?: GenerateDialogTermSource;
	/** Locked draft placements carried into the new draft. */
	lockedClassCount?: number | null;
	/**
	 * This year's weekly demand with no time yet. The headline number.
	 *
	 * `null`/`undefined` means the count was NOT MEASURED - the board summary read
	 * failed, or there is no authenticated school scope. That is NOT the same as
	 * `0`, which is a measured "nothing to schedule". Pass the absence through;
	 * never `?? 0`.
	 */
	classesToSchedule?: number | null;
};

export type GenerateDialogCopy = {
	headline: string;
	rows: ReadonlyArray<{ label: string; value: string; known: boolean }>;
	unavailability: string;
	publishesNothing: string;
	/**
	 * Whether `headline` carries a MEASURED count. `false` means the board summary
	 * was absent, so the number is unknown and the headline says so.
	 *
	 * The dialog's visual cue keys on this rather than on the count, so an
	 * unmeasured count can never be given the "nothing to do" treatment.
	 */
	classesToScheduleKnown: boolean;
	/**
	 * Whether the `lockedClassCount` row carries a MEASURED count. `false` means
	 * the board summary was absent and nothing was counted.
	 *
	 * A2 C5 item 4a: the headline was converted to a tri-state in c2 and the
	 * secondary row was left on `countOrZero`, so an absent board summary still
	 * printed a confident `0` under "Locked classes kept" — the same false zero
	 * the headline had already stopped printing, one line below it. The row now
	 * carries its own `known` flag and the dialog styles it from that, so the
	 * neutral state is a property of the copy rather than of the caller.
	 */
	lockedKnown: boolean;
	/** Every word above, joined, so one caller can budget the whole dialog. */
	plainText: string;
};

function countOrZero(value: number | null | undefined): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * U3a / #43 — the generate dialog's ENTIRE copy, composed in one place.
 *
 * It is a function rather than five constants so the word budget is enforceable:
 * `plainText` is every word the dialog shows, and the c2 regression asserts it is
 * at or under 45 words, carries no "unassigned", no "session(s)" and no "run #",
 * and names each of its numbers exactly once. The headline carries the demand
 * count, so the former fourth row that repeated it under the ambiguous word is
 * gone rather than kept.
 */
export function buildGenerateDialogCopy(input: GenerateDialogCopyInput): GenerateDialogCopy {
	const measured = typeof input.classesToSchedule === 'number' && Number.isFinite(input.classesToSchedule)
		? input.classesToSchedule
		: null;
	// A2 C5 item 4a — the SAME conversion the headline got, applied to the
	// secondary row. This was `countOrZero(input.lockedClassCount)`, so an absent
	// board summary (an intermittent 502, or no authenticated school scope)
	// printed "Locked classes kept: 0" — a claim that ATLAS had established
	// nothing is locked, when it had established nothing at all. `0` is a real
	// measurement and still reads `0`; only the absent case is reported absent.
	const measuredLocked = typeof input.lockedClassCount === 'number' && Number.isFinite(input.lockedClassCount)
		? input.lockedClassCount
		: null;
	const locked = measuredLocked === null
		? GENERATE_DIALOG_DEMAND_UNMEASURED_WORD
		: String(measuredLocked);
	const year = input.schoolYearLabel?.trim();
	// A2-UX-STATUS-C2 correction B2: an ABSENT count is reported as absent, never
	// coerced to 0. `countOrZero` used to serve this headline too, which turned an
	// intermittent 502 into "Classes to schedule: 0" - a false "all classes
	// placed". The measured number keeps its byte-identical rendering; only the
	// absent case gains a second, honest wording.
	const headline = measured === null
		? `${GENERATE_DIALOG_HEADLINE_LABEL}: ${GENERATE_DIALOG_DEMAND_UNMEASURED_WORD}`
		: `${GENERATE_DIALOG_HEADLINE_LABEL}: ${measured}`;
	const rows = [
		{ label: GENERATE_DIALOG_YEAR_LABEL, value: year && year.length > 0 ? year : 'Not set', known: Boolean(year && year.length > 0) },
		// The term row states a SOURCE, never a count, so it is always "known" in
		// the sense that it is a measurement of a different kind: an unresolved
		// term reports `Not confirmed`, which is already the honest wording.
		{ label: GENERATE_DIALOG_TERM_LABEL, value: generateDialogTermSourceWord(input.termSource), known: true },
		{ label: GENERATE_DIALOG_LOCKED_LABEL, value: locked, known: measuredLocked !== null },
	];
	const plainText = [headline, ...rows.map((row) => `${row.label} ${row.value}`), GENERATE_SETUP_UNAVAILABLE_SENTENCE]
		.join(' ');
	return {
		headline,
		rows,
		unavailability: GENERATE_SETUP_UNAVAILABLE_SENTENCE,
		publishesNothing: GENERATE_PUBLISHES_NOTHING_SENTENCE,
		classesToScheduleKnown: measured !== null,
		lockedKnown: measuredLocked !== null,
		plainText,
	};
}

/* ────────────────────────────────────────────────────────────────────────────
 * OPERATOR DECISION D1 (NJ, 2026-10-03, verbatim):
 *   "Yes, we'll use SAVE and EDIT instead of Publish and Draft"
 *
 * ── THE RULING, AND WHAT IT IS NOT ──────────────────────────────────────────
 * The state this module and the header have always called `Draft` is presented
 * to users as **Edit**. The state called `Published` is presented as **Save**.
 * `Generate` keeps its name — the operator named only two words.
 *
 * DISPLAY LAYER ONLY, exactly like the REGULAR-to-BEC change this follows: no
 * database enum, Prisma field, API status value or persisted value is renamed.
 * `GenerationRunStatus` is still `QUEUED | RUNNING | COMPLETED | FAILED`, and
 * `summary.isPublished` is still the boolean the server writes. Every mapping
 * below is stored-value → new display copy, so the rename is one edit here and
 * cannot leave a surface behind.
 *
 * ── WHAT IS *NOT* CHANGED, AND WHY ──────────────────────────────────────────
 * 1. The PUBLICATION GATE. "Save" is a new WORD for the existing published
 *    state; it is not a new gate and it is not a weaker one. A run with HARD
 *    violations is still not savable, because the gate reads
 *    `capabilities.gates.publication`, which is unchanged. Renaming the verb on
 *    the control does not rename the authority behind it.
 * 2. WHO MAY DO IT. No role's permission changes. This is wording.
 * 3. THE SERVER. Nothing under `atlas-server/` is touched.
 *
 * ── WHY THE STATE SET IS UNCHANGED ──────────────────────────────────────────
 * The brief asks for a STATE MODEL control: the schedule's states are the same
 * set as before, nothing added and nothing lost. These are therefore exactly
 * FOUR functions over an unchanged input shape — `isPublished: boolean` plus
 * the existing pre-generation/run-less branches. `vocab-state-model-c01.test.ts`
 * asserts the set, so a future word change that quietly adds or drops a state
 * fails a gate.
 */

/** The one word for the state a scheduler works in: what used to be "Draft". */
export const EDIT_STATE_LABEL = 'Edit';

/** The one word for the state that is in use: what used to be "Published". */
export const SAVE_STATE_LABEL = 'Save';

/**
 * `Edit` + the consequence, in one sentence. The old wording was "Draft —
 * teachers and students cannot see it yet.", which is still exactly true; only
 * the state word changes.
 */
export function editStateSentence(): string {
	return `${EDIT_STATE_LABEL} — teachers and students cannot see it yet.`;
}

/** `Save` + the consequence. The old wording said "Published" for the state. */
export function saveStateSentence(): string {
	return `${SAVE_STATE_LABEL} — this is the schedule in use.`;
}

/**
 * The pre-generation state. It is a planner, not a run, so it never wore the
 * published word; it wore "Draft", which is the word being retired, so it
 * becomes "Edit" and nothing else changes.
 */
export function planningStateSentence(): string {
	return `${EDIT_STATE_LABEL} · nothing placed yet`;
}

/**
 * The stable part of the pre-generation sentence — what it says is MISSING —
 * split out so a control can assert the claim without pinning the state word.
 * A wording change to `EDIT_STATE_LABEL` therefore cannot silently turn this
 * sentence into a bare noun.
 */
export const PLANNING_STATE_SENTENCE_STARTS_WITH = 'Edit';

/** The state chip / badge label for the run on screen. */
export function stateBadgeLabel(isPublished: boolean): string {
	return `${isPublished ? SAVE_STATE_LABEL : EDIT_STATE_LABEL} schedule`;
}

/** The short state word with no "schedule" — the strip's whole textContent. */
export function stateWord(isPublished: boolean): string {
	return isPublished ? SAVE_STATE_LABEL : EDIT_STATE_LABEL;
}

/**
 * WHO CAN SEE IT. Two sentences that are deliberately different facts and must
 * not be merged: this one names VISIBILITY, not which run is on screen.
 */
export function stateVisibilitySentence(isPublished: boolean): string {
	return isPublished
		? SAVE_STATE_LABEL
		: `${EDIT_STATE_LABEL} — not visible to teachers until you save`;
}

/** The "Generate" verb is UNCHANGED by D1 — the operator named only Save and Edit. */
export const GENERATE_VERB_LABEL = 'Generate';

/**
 * `BUILD_NEW_DRAFT_LABEL` keeps its exported NAME (21 production importers and a
 * committed source contract depend on it) and changes only its VALUE, so the
 * retire-and-replace note in `timetable-more-menu-a2.test.ts` still holds: one
 * More row, one dialog title, one aria-label, all from this one constant.
 */
export const BUILD_NEW_DRAFT_LABEL = 'Generate a schedule';

/**
 * The reassurance on the dialog's first line when a schedule is already saved.
 * `PUBLISHED_SCHEDULE_STAYS_IN_USE` keeps its name and changes its words — the
 * sentence's claim is unaffected by the vocabulary.
 */
export const PUBLISHED_SCHEDULE_STAYS_IN_USE = 'Your saved schedule stays in use.';

/**
 * The generate dialog's "nothing is published by generating" reassurance. The
 * member's words (class-schedule.docx): "do not use DRAFT. All generated
 * schedule should automatically SAVE" — so this sentence now names SAVE, and
 * it is still TRUE: the server writes the run with `status: 'COMPLETED'` inside
 * the generation transaction, and `summary.isPublished` stays false until the
 * publication gate is passed.
 */
export const GENERATE_PUBLISHES_NOTHING_SENTENCE = 'Nothing is saved for everyone to use until you save it.';

/**
 * The OBLIGATION clause every blocked sentence ends with. D1 changed the VERB
 * (`published` -> `saved`) and nothing else about the claim.
 *
 * There is ONE clause, exactly as at the base: `SAVE_BLOCKED_TAIL` and
 * `SAVE_BLOCKED_SHORT` are the same string, so the chip's `title`, the blocked
 * sentence and the `tt-warning-surface-c07b` rows can never name two different
 * consequences for one state. It is exported so a test can assert that a
 * sentence ENDS WITH the production tail instead of retyping it — which is how
 * the eight `tt-warning-surface-c07b` rows now assert the count phrase (the
 * part decision 8 actually fixed) without pinning the verb a second time.
 */
export const SAVE_BLOCKED_SHORT = 'this schedule cannot be saved yet.';

/**
 * The MID-SENTENCE form of the same obligation, used where the clause continues a
 * count phrase ("3 Must fix problems still need fixing before this schedule can be
 * saved."). It is deliberately NOT the standalone sentence: joining one to the
 * other would be ungrammatical, so this is the second named form of ONE clause.
 */
export const SAVE_BLOCKED_CONTINUATION = 'before this schedule can be saved.';

/**
 * The OBLIGATION clause every blocked sentence ends with. D1 changed the VERB
 * (`published` -> `saved`) and nothing else about the claim.
 *
 * This is the CONTINUATION form — it follows a count phrase ("2 Must fix problems
 * still need fixing `SAVE_BLOCKED_TAIL`"), which is why it is not the standalone
 * `SAVE_BLOCKED_SHORT` sentence. It is exported so a test can assert that a
 * sentence ENDS WITH the production clause instead of retyping it — which is how
 * the eight `tt-warning-surface-realism-c07b` rows assert the count phrase (the
 * part decision 8 actually fixed) without pinning the verb a second time.
 */
export const SAVE_BLOCKED_TAIL = SAVE_BLOCKED_CONTINUATION;

/** The separator the chip's structural row splits on to find the clause above. */
export const CLAUSE_SEPARATOR = ' — ';

/**
 * `Publish` as a control verb becomes `Save`. The gate behind it
 * (`gates.publication`) is untouched: a HARD-violating run still refuses.
 */
export const SAVE_CONTROL_LABEL = 'Save';

/** The ≤6-word short reason printed beside a disabled Save control. */
export const SAVE_SHORT_FALLBACK = 'Saving is not available';

/* ── #56 — ONE verb for "generate", on a published schedule ─────────────────── */

/**
 * The single verb for making a new schedule from the one in use. #56 collapsed
 * four names for one action; D1 changes the ARTEFACT word ("draft" → "schedule")
 * without reopening that collapse.
 */
export const BUILD_NEW_SCHEDULE_DESCRIPTION = `${GENERATE_VERB_LABEL} a schedule`;

/** The dialog title beside `BUILD_NEW_DRAFT_LABEL`. */
export function buildNewDraftDialogTitle(isPublished: boolean): string {
	return isPublished ? `${BUILD_NEW_DRAFT_LABEL}?` : BUILD_NEW_DRAFT_LABEL;
}

/* ── #58 / U4 — ONE outcome message for one generation ─────────────────────── */

/**
 * The single completion message, replacing a started toast, a completed toast and
 * a loading toast for one action (#58). It names the real number of classes still
 * without a time, drops "run #" and "session(s)", and tells the reader the next
 * step. The zero case keeps the count visible rather than implying the number is
 * absent, because "0" beside the same number on the dialog is what lets a
 * scheduler trust it.
 */
export function generationOutcomeToastSentence(unplacedCount: number): string {
	const unplaced = countOrZero(unplacedCount);
	const outstanding = unplaced === 0 ? `${unplaced} classes left to place` : classesNeedingTime(unplaced);
	const review = unplaced === 0 ? 'Review it, then save.' : 'Review them, then save.';
	return `Schedule ready — ${outstanding}. ${review}`;
}

/**
 * U4 — the generation notification's replacement. It used to read "Generation run
 * #N completed with N session(s) this run could not place.", which spent five
 * words on the run id, used a banned "(s)" form, and said nothing about what to
 * do. The non-zero case names the real number of classes that still need a time
 * slot rather than a count of something the reader cannot act on.
 */
export function generationNotificationSentence(unplacedCount: number): string {
	const unplaced = countOrZero(unplacedCount);
	if (unplaced === 0) return `New schedule ready. ${ALL_SESSIONS_PLACED_LABEL}.`;
	return `New schedule ready. ${classesNeedingTime(unplaced)}.`;
}

/* ── the publish-checklist sentence ────────────────────────────────────────── */

/**
 * The ungrammatical checklist sentence, corrected. It read "3 sessions this run
 * could not place must be placed before this schedule can be published." — two
 * verbs, a banned noun, the count stated twice, and a stacked obligation on top of
 * a modal that was already open. One noun, present tense, one verb, count once.
 */
export function publishPlacementBlockedSentence(count: number): string {
	const unplaced = countOrZero(count);
	if (unplaced === 0) return `${ALL_SESSIONS_PLACED_LABEL}.`;
	return `${classesNeedingTime(unplaced)}. Place them before you save.`;
}
