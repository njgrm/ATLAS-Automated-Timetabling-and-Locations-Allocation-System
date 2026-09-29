/**
 * A9 C3 (2026-09-29) — the PLAIN WORDS of the home-room guided step.
 *
 * WHY THIS IS A MODULE AND NOT INLINE JSX. `AGENTS.md` §11's design judgement gate rejects a
 * source-text assertion as acceptance evidence, so the wording a scheduler reads is not the
 * place to keep a contract testable: it has to be a pure function whose RETURN VALUE the
 * control asserts. This is the same split `a3-c4-home-room-truth.test.ts` forced on the
 * Sections stat tile ("the printing now lives in `buildHomeRoomsStat`, which the behavioural
 * control calls directly"). The lesson is recorded there because the alternative shipped: a
 * suite stayed green at 17/17 while the page printed "Home rooms 3/3" beside two rows that
 * said they needed a room.
 *
 * It lives in `src/lib/` beside the other copy modules (`room-authority-copy.ts`,
 * `room-schedule-term-copy.ts`) and NOT in `components/sections/`, because
 * `a3-sections-map-layout.test.ts`'s completeness sweep treats any file under the two room
 * component directories that mentions a room/badge/building name as a protected room SURFACE.
 * This module renders nothing, and dodging that sweep by avoiding the words `buildingName`
 * and `<Badge` would mean writing worse code to please a test.
 *
 * THE ONE RULE. `home-room-auto-assign.service.ts` returns a `reason` ENUM
 * (`GRADE_SCOPE_MATCH`, `ANY_GRADE_FALLBACK`, `NO_GRADE_MATCHING_ROOM`,
 * `ROOM_CAPACITY_TOO_SMALL`, `NO_ELIGIBLE_ROOM`). The older-user audit rejected this page
 * for showing the operator enum-flavoured labels the old dialog printed ("Grade match",
 * "No grade-matching room"). An enum is the server's vocabulary, not the scheduler's, so
 * every reason is translated here exactly once and the enum is never rendered. An
 * unrecognised reason degrades to a plain phrase rather than leaking the raw token, because
 * a future server reason must not be able to print `SOME_NEW_ENUM` at a scheduler.
 */

/** The reason values `computeAutoAssign` emits today, plus room for a future one. */
export type HomeRoomAutoAssignReason = string;

/**
 * WHY A SECTION GOT THE ROOM, in the words of a person choosing a room.
 *
 * `GRADE_SCOPE_MATCH` is a room in this grade's own wing — the answer a scheduler expects,
 * and the only one where the building name on the row adds something she did not ask for.
 * `ANY_GRADE_FALLBACK` is a room in a wing that serves several grades, i.e. the closest free
 * room the school actually has.
 */
export function assignmentReasonPhrase(reason: HomeRoomAutoAssignReason): string {
	switch (reason) {
		case 'GRADE_SCOPE_MATCH':
			return 'same grade wing';
		case 'ANY_GRADE_FALLBACK':
			return 'closest free room';
		// A skip reason can reach this function only through a caller that reuses it; a
		// proposal is never a skip, so the wording below is the neutral one.
		case 'NO_GRADE_MATCHING_ROOM':
			return 'no room in this grade\u2019s wing is free';
		case 'ROOM_CAPACITY_TOO_SMALL':
			return 'every free room is too small';
		case 'NO_ELIGIBLE_ROOM':
			return 'no free room can be used for classes';
		default:
			return 'a free room';
	}
}

/**
 * WHY A SECTION WAS LEFT OUT, plus the ONE thing that would fix it.
 *
 * The packet is explicit that a skipped section is never hidden: a scheduler who cannot see
 * the 3 sections the server declined to place will assume the school has 20 sections and not
 * 23. The fix half matters as much as the reason half — a reason with no action leaves the
 * reader to invent one, and inventing one is exactly the tedium this page is being judged on.
 */
/** A skipped section's reason and the one action that would clear it. */
export type SkippedRoomCopy = { reason: string; fix: string };

export function skippedReasonPhrase(reason: HomeRoomAutoAssignReason): SkippedRoomCopy {
	switch (reason) {
		case 'NO_GRADE_MATCHING_ROOM':
			return {
				reason: 'no room in this grade\u2019s wing is free',
				fix: 'Free a room in that wing, or allow this section to use another grade\u2019s room.',
			};
		case 'ROOM_CAPACITY_TOO_SMALL':
			return {
				reason: 'every free room is too small for the class',
				fix: 'Add a room that seats this many students, or split the section.',
			};
		case 'NO_ELIGIBLE_ROOM':
			return {
				reason: 'no free room can be used for classes',
				fix: 'On Campus & Rooms, mark a free room as a teaching classroom.',
			};
		case 'ANY_GRADE_FALLBACK':
		case 'GRADE_SCOPE_MATCH':
			// Defensive: these are proposal reasons and never arrive on a skipped row. If a
			// future server revision reuses one, the reader still gets a fix rather than a
			// blank.
			return { reason: 'no free room for this section', fix: 'Open Campus & Rooms and check the free rooms for this wing.' };
		default:
			return { reason: 'no free room for this section', fix: 'Open Campus & Rooms and check the free rooms for this wing.' };
	}
}

/**
 * THE ONE ACTION, in the words of the job rather than the words of the feature.
 *
 * "Auto-assign rooms" names the mechanism; the scheduler's job is "give these sections a
 * home room". The count is the one the page already computes
 * (`summarizeHomeRoomReadiness().needing`, the same number the "Need rooms" stat tile prints,
 * A3 C4 defect A) and is quoted here so the action and the figure can never disagree.
 */
export function guidedStepActionLabel(needing: number): string {
	if (needing <= 0) return 'Give your sections a home room';
	return `Give ${needing} ${needing === 1 ? 'section' : 'sections'} a home room`;
}

/** The ONE apply action. Same count, same population, read at click time. */
export function applyActionLabel(count: number): string {
	if (count <= 0) return 'Apply these rooms';
	return `Apply these ${count} ${count === 1 ? 'room' : 'rooms'}`;
}

/**
 * WHAT SAVED, IN ONE SENTENCE — and the honest answer when it was not everything.
 *
 * `updateSectionHomeRooms` runs the whole batch inside ONE `$transaction`, so a rejected
 * write saves nothing at all; that is the `saved: 0` case and this function must not imply a
 * partial save. The other case is real and was the reason this sentence exists: the service
 * silently `continue`s a row whose section is not in the mirror set or whose room is not a
 * teaching room in this school, and returns only `{ updated }`. A scheduler who sent 20 and
 * got `updated: 17` was previously told nothing at all, so the count that was NOT saved is
 * named rather than dropped.
 */
export function saveOutcomeSentence(outcome: { requested: number; updated: number }): string {
	const { requested, updated } = outcome;
	if (requested <= 0) return 'No rooms were saved, because no rooms were chosen.';
	if (updated === 0) {
		return `No rooms were saved. ATLAS could not store ${requested === 1 ? 'the room' : `the ${requested} rooms`} you reviewed.`;
	}
	if (updated === requested) {
		return `Saved ${updated} ${updated === 1 ? 'room' : 'rooms'}.`;
	}
	return `Saved ${updated} of ${requested} rooms. The other ${requested - updated} ${requested - updated === 1 ? 'was' : 'were'} left unchanged.`;
}

/**
 * THE FAILURE SENTENCE. Typed server text first, then the one fact that matters most: a
 * rejected batch is atomic, so nothing was saved and the review list below is still correct.
 */
export function applyFailureSentence(reason: string): string {
	const detail = reason.trim() || 'ATLAS refused the request.';
	return `${detail} No rooms were saved, so the list below is still what ATLAS would change.`;
}

/** A row the scheduler changed herself is not "same grade wing" any more, and must say so. */
export const MANUAL_CHOICE_NOTE = 'your choice';
