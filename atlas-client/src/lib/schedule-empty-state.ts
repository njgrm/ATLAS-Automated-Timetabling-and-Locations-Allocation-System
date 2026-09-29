/**
 * A5 C5 CORRECTION ROUND 1 (2026-09-29) — F1: which of the FOUR empty reasons is on screen.
 *
 * THE DEFECT THIS FIXES. My first candidate hardcoded one heading, `No timetable to show yet`, for
 * every `status: 'empty'`, and paired it with one action, `Build one on the Timetable page`. There
 * are four producers of `status: 'empty'` and only ONE of them makes that pair true. Fresh QA
 * caught two self-contradictions on screen:
 *
 *  - the unverified-term case rendered the body "This is a term-contract problem on the ATLAS
 *    side, NOT a missing timetable" directly under a heading asserting that no timetable exists;
 *  - the pivot-untermable case offered "Build one on the Timetable page" when the timetable DOES
 *    exist and the correct next step is to REGENERATE the draft.
 *
 * That was also a REGRESSION against base `6d81026b`, which used the honest generic
 * `Schedule not available` and imported and rendered `UNVERIFIED_TERM_TITLE` for the unresolved
 * term. My candidate dropped that import, leaving the constant with no consumer on the page that
 * documents why it exists.
 *
 * WHY A SEPARATE MODULE, AND WHY THE SAME SHAPE AS `room-schedule-term-copy.ts`. The title and the
 * next step are ONE claim about one condition. Keeping them in two JSX branches is how a page ends
 * up saying "not a missing timetable" above "no timetable yet". They are resolved together here,
 * from a reason, and the reason is carried in the fetch state so the JSX cannot invent a fifth
 * meaning. This mirrors the existing `room-schedule-term-copy.ts` contract — "One export,
 * imported by all three surfaces. Copying this sentence a third time is how two wordings for one
 * condition start" — and it is what makes the four rows unit-testable without a browser.
 *
 * WHAT IS DELIBERATELY NOT HERE. No new body copy. Three of the four bodies already exist and are
 * correct (two of them pre-date this change), so the fix is a title and a next step per reason,
 * not a rewrite of sentences an operator and QA have already read. `UNVERIFIED_TERM_TITLE` and
 * `UNVERIFIED_TERM_BODY` are imported from their own module rather than restated, per F1.
 *
 * AND WHAT IS NOT TOUCHED: every one of these four is a FAIL-CLOSED refusal, and every one stays
 * one. Nothing here weakens a guard to make a message reachable.
 */
import { UNVERIFIED_TERM_BODY, UNVERIFIED_TERM_TITLE } from './room-schedule-term-copy';

/**
 * The four producers of `status: 'empty'`, named. Adding a fifth producer without adding a fifth
 * reason here is a type error, which is the point: a new empty path cannot silently inherit
 * another one's wording.
 */
export type ScheduleEmptyReason =
	/** The actor's school scope could not be verified. Nothing was requested. */
	| 'scope-unverified'
	/** Term authority is unresolved, so the view refuses rather than merge terms. */
	| 'term-unverified'
	/** A draft exists, but some sessions carry no verified term, so it cannot be scoped. */
	| 'draft-untermable'
	/** The school year genuinely has no completed timetable. */
	| 'no-runs';

export type ScheduleEmptyNextStep =
	| { kind: 'link'; to: string; label: string }
	/** A refetch: the condition is a verification state, not something to go and build. */
	| { kind: 'retry'; label: string };

export type ScheduleEmptyState = {
	/** The heading. True for THIS reason and no other. */
	title: string;
	/** The explanation under it, in the operator's words. */
	body: string;
	/** Exactly one next step. Never two — a second hint is how a page contradicts itself. */
	nextStep: ScheduleEmptyNextStep;
	/** The page's own test hook, so acceptance can aim at the reason rather than at a heading. */
	testId: string;
};

const BUILD_ON_TIMETABLE = '/timetable';

/**
 * The one resolver. Four reasons in, four truthful states out.
 *
 * The next steps, and why each is what it is:
 *  - `no-runs`      → BUILD. Nothing exists; building is the only move.
 *  - `term-unverified` → RETRY, not build. `UNVERIFIED_TERM_BODY` says "Retry once the term is
 *    confirmed, or ask an administrator to re-sync the school year." Offering a link to the
 *    Timetable page here would send a scheduler to build a timetable that already exists because
 *    ATLAS could not read its term contract.
 *  - `scope-unverified` → SIGN IN. The request was never made, so the actor's scope is the thing
 *    to restore.
 *  - `draft-untermable` → REGENERATE. The draft exists and is the problem, so "build one" is a
 *    category error and "regenerate the draft" is the sentence the body already uses.
 */
export function resolveScheduleEmptyState(reason: ScheduleEmptyReason, message: string): ScheduleEmptyState {
	switch (reason) {
		case 'term-unverified':
			return {
				title: UNVERIFIED_TERM_TITLE,
				body: UNVERIFIED_TERM_BODY,
				nextStep: { kind: 'retry', label: 'Try again' },
				testId: 'schedules-empty-term-unverified',
			};
		case 'scope-unverified':
			return {
				title: 'School could not be confirmed',
				body: message,
				nextStep: { kind: 'link', to: '/login', label: 'Sign in again' },
				testId: 'schedules-empty-scope-unverified',
			};
		case 'draft-untermable':
			return {
				title: 'This draft cannot be scoped to one term',
				body: message,
				nextStep: { kind: 'link', to: BUILD_ON_TIMETABLE, label: 'Regenerate the draft on the Timetable page' },
				testId: 'schedules-empty-draft-untermable',
			};
		case 'no-runs':
		default:
			return {
				title: 'No timetable has been made yet',
				body: message,
				nextStep: { kind: 'link', to: BUILD_ON_TIMETABLE, label: 'Build one on the Timetable page' },
				testId: 'schedules-empty-no-runs',
			};
	}
}
