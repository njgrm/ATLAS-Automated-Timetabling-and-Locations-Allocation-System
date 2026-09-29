/**
 * A3 S1 — why home-room edits are (or are not) writable right now.
 *
 * Extracted from `pages/Sections.tsx` so the page stays inside the 1000-line
 * component cap and so the writability contract is a pure function that a
 * control can exercise without mounting the page.
 *
 * ── A9 C3 (2026-09-29): THE COPY IS THE PRODUCT, AND IT IS NOW ONE LINE ──────────────
 *
 * The older-user audit rejected `/sections` for jargon, and named three lines of it: the
 * queue notice ("Showing saved section data with 2 queued home-room changes"), the source
 * sentences ("Section data is available from ATLAS runtime cache while upstream
 * verification is unavailable"), and the source chip's own text ("Home-room edits can be
 * queued if saving fails"). None of them answered the only question the page raises before
 * every click: **does a click save right now, or is it waiting?**
 *
 * So this function now answers exactly that, in one sentence per state, and the sentence
 * NAMES the condition when the answer differs by it — "you are online", "you are offline" —
 * because "changes are handled appropriately" is the answer that makes a scheduler re-check.
 * The one line replaced THREE surfaces (this banner, the queue notice and the source chip's
 * copy), so the page says less and says it once.
 *
 * WHAT DID NOT CHANGE: the four tones, the input shape, and the decision order. This is
 * still the page's ONE writability gate — the row picker, the guided step's apply action and
 * `homeRoomWriteAvailability` all read the same conditions, so nothing here can disagree with
 * them. Only the sentence a person reads is new.
 */

export type HomeRoomEditStatus = {
	tone: 'blocked' | 'checking' | 'queued' | 'ready';
	/** ONE line, answering "does a click save right now, or is it waiting?". */
	message: string;
};

export type HomeRoomEditStatusInput = {
	/** No selected school year means nothing can be written. */
	hasActiveSchoolYear: boolean;
	/** The roster fetch state. Anything but 'ok' blocks edits. */
	rosterStatus: 'loading' | 'ok' | 'unavailable' | 'no-year';
	/** Where the page is reading its roster from. */
	dataSource: 'live' | 'refreshing' | 'cached' | 'atlas-mirror' | 'none';
	isOnline: boolean;
	/** Changes held on this device, waiting for the server. */
	queuedEditCount: number;
};

export function deriveHomeRoomEditStatus(input: HomeRoomEditStatusInput): HomeRoomEditStatus {
	if (!input.hasActiveSchoolYear || input.rosterStatus !== 'ok' || input.dataSource === 'none') {
		return {
			tone: 'blocked',
			message: 'Rooms cannot be saved yet \u2014 ATLAS has no section list for this school year.',
		};
	}
	if (input.dataSource === 'refreshing') {
		return {
			tone: 'checking',
			message: 'Saving is paused while ATLAS checks the roster \u2014 your clicks will save once it settles.',
		};
	}
	if (!input.isOnline) {
		return {
			tone: 'queued',
			message: 'You are offline, so room changes wait on this computer until you reconnect.',
		};
	}
	if (input.queuedEditCount > 0) {
		return {
			tone: 'queued',
			message: `${input.queuedEditCount} room ${input.queuedEditCount === 1 ? 'change is' : 'changes are'} still waiting to reach ATLAS.`,
		};
	}
	// A9 C3: the online case used to render NOTHING (the banner only drew when
	// `tone !== 'ready'`), so the scheduler who had done nothing wrong was the one person
	// never told whether a click would save. The ready state now states itself, and names
	// the condition, because "saves right away" and "saves right away while ATLAS has your
	// real roster" are the same sentence only when nothing is being verified.
	return {
		tone: 'ready',
		message: 'A click saves right away \u2014 you are online.',
	};
}
