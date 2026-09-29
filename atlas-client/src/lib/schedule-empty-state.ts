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
 *
 * A5 C5 PROOF FIX (2026-09-29) D2 — ONE body changed, and the reasoning above is superseded for
 * that one case only. The claim "no new body copy" was true when all four bodies were client
 * copy, and a real browser render then showed that it was false for exactly ONE of them: the
 * `no-runs` body was the SERVER's message, passing straight through `body`. So the three bodies
 * that were already client copy are untouched, and the fourth now reads as a plain sentence with
 * the server string kept beside it as `rawDetail`. The refusal, its heading, its testId and its
 * next step are all unchanged.
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
	/**
	 * A5 C5 R2 (2026-09-29) B1 — A retry must DECLARE what it redoes, and the page must perform
	 * exactly that. The first `retry` shipped as a bare `{ kind: 'retry' }` and the page wired it
	 * to its schedule refetch, which for `term-unverified` provably cannot change the outcome:
	 * `viewTerm` is null, so the refetch returns the same refusal before any request, and the year
	 * context is resolved once, on `actorSchoolId`. QA's words: "an inert button is not a right
	 * next step." `recheck` is what makes that failure impossible to reintroduce silently — a new
	 * retry reason cannot be added without naming the authority it re-reads, and the page's
	 * dispatch has to handle that name.
	 *
	 * `term-authority` is the one recovery that exists today: ask the ONE resolver
	 * (`resolveActiveSchoolYearContext`) again, which is the only thing that can turn an
	 * unresolved term into a resolved one.
	 */
	| { kind: 'retry'; label: string; recheck: 'term-authority' };

export type ScheduleEmptyState = {
	/** The heading. True for THIS reason and no other. */
	title: string;
	/** The explanation under it, in the operator's words. */
	body: string;
	/**
	 * A5 C5 PROOF FIX (2026-09-29) D2 — the RAW server string, when the body above is a plain
	 * sentence instead of it. `AGENTS.md` §8 requires a raw code or server sentence to MOVE behind
	 * a `Help` affordance, never to be deleted, and this is the A5 c4 pattern on the
	 * `TERM_CACHE_INVALID` chip: the calm sentence is the primary read, and the evidence moves
	 * behind `Help`.
	 *
	 * ONLY set where the message is server-AUTHORED. Three of the four producers set their own
	 * message text in `fetchSchedule`, so for those it is already plain copy and belongs in
	 * `body` where a scheduler actually reads it. `no-runs` is the one producer that passes a
	 * server string through — it is the sole reason this field exists, and it is the reason
	 * Defect 2 was a real leak rather than a stylistic one.
	 */
	rawDetail?: string;
	/** Exactly one next step. Never two — a second hint is how a page contradicts itself. */
	nextStep: ScheduleEmptyNextStep;
	/** The page's own test hook, so acceptance can aim at the reason rather than at a heading. */
	testId: string;
};

const BUILD_ON_TIMETABLE = '/timetable';

/**
 * A5 C5 PROOF FIX (2026-09-29) D2 — the `no-runs` body in a scheduler's words.
 *
 * THE DEFECT THIS FIXES. This body used to be the server's own `message`, which rendered verbatim
 * as `No completed generation runs found for this school/year.` A real browser render of this page
 * against real staging data showed it as the FIRST thing a user reads on the one screen whose whole
 * purpose is plain words. "generation runs" and "school/year" are a database's grammar, not a
 * scheduler's, and the heading directly above it already says the same fact in plain words.
 *
 * The server string is NOT deleted. It moves to `rawDetail`, which the page renders behind the
 * A5 c4 `Help` popover, so support can still read the reason ATLAS was given.
 */
const NO_RUNS_BODY =
  'This school year has no finished timetable yet, so there is no week to show here.';

/**
 * The one resolver. Four reasons in, four truthful states out.
 *
 * The next steps, and why each is what it is:
 *  - `no-runs`      → BUILD. Nothing exists; building is the only move.
 *  - `term-unverified` → RETRY, not build. `UNVERIFIED_TERM_BODY` says "Retry once the term is
 *    confirmed, or ask an administrator to re-sync the school year." Offering a link to the
 *    Timetable page here would send a scheduler to build a timetable that already exists because
 *    ATLAS could not read its term contract. The retry therefore re-reads the term authority
 *    (`recheck: 'term-authority'`), which is what "retry once the term is confirmed" actually
 *    means; it is not a refetch of a schedule this page has not been allowed to request.
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
				nextStep: { kind: 'retry', label: 'Try again', recheck: 'term-authority' },
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
		default: {
			// A5 C5 PROOF FIX (2026-09-29) D2. The body is plain copy; the server's own sentence is
			// preserved verbatim as `rawDetail` for the `Help` popover. A blank or whitespace-only
			// message must not open an empty popover, so it is dropped to `undefined` — and because
			// the page renders the affordance ONLY when this is set, a server that stops explaining
			// itself removes a control rather than leaving a dead one.
			const rawDetail = message.trim();
			return {
				title: 'No timetable has been made yet',
				body: NO_RUNS_BODY,
				...(rawDetail.length > 0 ? { rawDetail } : {}),
				nextStep: { kind: 'link', to: BUILD_ON_TIMETABLE, label: 'Build one on the Timetable page' },
				testId: 'schedules-empty-no-runs',
			};
		}
	}
}
