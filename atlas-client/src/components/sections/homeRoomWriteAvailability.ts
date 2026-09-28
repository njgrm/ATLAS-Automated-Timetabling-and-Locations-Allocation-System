/**
 * A3 c11 FIX-12 — can a home-room change be written right now, and if not, what
 * exactly do we tell the operator?
 *
 * The recorded defect: `handleHomeRoomChange` returned with no user-visible
 * outcome whenever the roster source could not be written to. The map modal
 * therefore closed on a Confirm click and nothing happened — no save, no error,
 * no notice. A click that does nothing is indistinguishable from a click that
 * saved.
 *
 * This is the one derivation of that gate, extracted from the page so the page
 * does not carry a private copy and so a control can decide the wording without
 * mounting a 1000-line page that opens a supervised fetch, a year context and a
 * local cache on mount. The page's existing `isReadOnlyMode` condition is
 * reproduced EXACTLY, so this cannot disagree with the row's own disabled state:
 *
 *   no active school year | roster state is not 'ok' | source 'none' (not
 *   connected) | source 'refreshing' (still being checked)
 *
 * The notice is deliberately worded as NOT SAVED. It is the wording for a write
 * that was never attempted, so it must never contain "saved", "queued" or any
 * other word that would let a reader believe the change reached the server or a
 * queue. A queued change is a DIFFERENT, already-reported disposition
 * (`homeRoomResultCopy` in `HomeRoomConfirmDialogs.tsx`).
 */
export type HomeRoomWriteInput = {
	/** No selected school year means nothing can be written. */
	hasActiveSchoolYear: boolean;
	/** The roster fetch state. Anything but 'ok' blocks writes. */
	rosterStatus: 'loading' | 'ok' | 'unavailable' | 'no-year';
	/** Where the page is reading its roster from. */
	dataSource: 'live' | 'refreshing' | 'cached' | 'atlas-mirror' | 'none';
	/** Whether the browser reports a connection (a write may still be queued). */
	isOnline: boolean;
};

export type HomeRoomWriteAvailability = {
	canWrite: boolean;
	/** A not-saved sentence for a write that was never attempted, else null. */
	notSavedNotice: string | null;
};

/** The leading words every not-saved notice shares, so the state is scannable. */
export const HOME_ROOM_NOT_SAVED = 'Home-room change not saved';

export function homeRoomWriteAvailability(input: HomeRoomWriteInput): HomeRoomWriteAvailability {
	if (!input.hasActiveSchoolYear) {
		return {
			canWrite: false,
			notSavedNotice: `${HOME_ROOM_NOT_SAVED}. ATLAS has no active school year, so nothing was written. Run a successful sync, then assign the room again.`,
		};
	}
	if (input.rosterStatus !== 'ok') {
		return {
			canWrite: false,
			notSavedNotice: `${HOME_ROOM_NOT_SAVED}. The section roster is not loaded (${input.rosterStatus}), so nothing was written. Retry Sync, then assign the room again.`,
		};
	}
	if (input.dataSource === 'none') {
		return {
			canWrite: false,
			notSavedNotice: `${HOME_ROOM_NOT_SAVED}. ATLAS is not connected to a section source, so nothing was written. Reconnect and sync, then assign the room again.`,
		};
	}
	if (input.dataSource === 'refreshing') {
		return {
			canWrite: false,
			notSavedNotice: `${HOME_ROOM_NOT_SAVED}. ATLAS is still checking the section source, so nothing was written. Wait for the source to settle, then assign the room again.`,
		};
	}
	// Writable. Offline is NOT a block here: the roster is on the device and a
	// write is accepted into the local queue, which reports its own distinct
	// "not on the server yet" disposition. Reporting it as blocked would be the
	// opposite lie — claiming nothing can happen when something can.
	return { canWrite: true, notSavedNotice: null };
}
