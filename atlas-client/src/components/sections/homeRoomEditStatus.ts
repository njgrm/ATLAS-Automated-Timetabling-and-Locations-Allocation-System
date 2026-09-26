/**
 * A3 S1 — why home-room edits are (or are not) writable right now.
 *
 * Extracted from `pages/Sections.tsx` so the page stays inside the 1000-line
 * component cap and so the writability contract is a pure function that a
 * control can exercise without mounting the page. The copy is unchanged: the
 * point of the extraction is locality, not a product decision.
 */

export type HomeRoomEditStatus = {
	tone: 'blocked' | 'checking' | 'queued' | 'ready';
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
			message: 'Home-room edits are blocked until ATLAS has a section roster for the active school year.',
		};
	}
	if (input.dataSource === 'refreshing') {
		return {
			tone: 'checking',
			message: 'Home-room edits are paused while ATLAS checks the roster source. Review the list now, then save room changes when the source settles.',
		};
	}
	if (!input.isOnline) {
		return {
			tone: 'queued',
			message: 'You are offline. Home-room changes save on this device and sync when the connection returns.',
		};
	}
	if (input.queuedEditCount > 0) {
		return {
			tone: 'queued',
			message: `${input.queuedEditCount} home-room change${input.queuedEditCount === 1 ? '' : 's'} will sync before the page is final.`,
		};
	}
	return {
		tone: 'ready',
		message: 'Home-room edits are writable. Pick a room from the row or review the room map before changing assignments.',
	};
}
