/**
 * A3 S1 — home-room assignment intent and persistence outcomes.
 *
 * Why this module exists (fix 12): `pages/Sections.tsx` used to fire the write
 * with `void performHomeRoomUpdate(...)` and immediately unmount the
 * confirmation dialog. The write had three genuinely different outcomes —
 * persisted, queued locally, or refused — and the user saw none of them, so a
 * queued or refused change was indistinguishable from a saved one. The owner of
 * the mutation now returns a typed result, the confirmation surface awaits it,
 * and the three outcomes stay distinguishable.
 *
 * `resolveHomeRoomIntent` is the decision that decides whether a pick is a
 * plain write, a swap escalation or an unassign escalation. It is pure, so the
 * confirm-and-cancel path is exercised through production code rather than a
 * re-implementation in a test.
 */

export type HomeRoomAssignment = { sectionId: number; homeRoomId: number | null };

export type HomeRoomUpdateResult =
	/** The server accepted the write. */
	| { status: 'saved' }
	/** Not on the server. The optimistic state is applied and the change is held locally. */
	| { status: 'queued'; reason: 'offline' | 'write-failed'; detail: string }
	/** Not written and not queued. Nothing changed anywhere. */
	| { status: 'failed'; reason: 'blocked'; detail: string };

export type HomeRoomIntent =
	| { kind: 'unassign'; currentRoomName: string }
	| { kind: 'swap'; displacedSectionName: string; currentRoomName: string | null; targetRoomName: string }
	| { kind: 'direct' };

/**
 * Decide what a room pick means. `occupantOf` returns the section currently
 * holding a room, or null. Thresholds are never applied here: a plain write
 * stays a plain write.
 */
export function resolveHomeRoomIntent(
	section: { id: number; homeRoomId?: number | null },
	nextHomeRoomId: number | null,
	occupantOf: (roomId: number) => string | undefined,
	roomNameOf: (roomId: number) => string | undefined,
): HomeRoomIntent {
	if (nextHomeRoomId === null && section.homeRoomId) {
		return { kind: 'unassign', currentRoomName: roomNameOf(section.homeRoomId) ?? 'Unknown Room' };
	}
	if (nextHomeRoomId !== null && section.homeRoomId !== nextHomeRoomId) {
		const displacedSectionName = occupantOf(nextHomeRoomId);
		if (displacedSectionName) {
			return {
				kind: 'swap',
				displacedSectionName,
				currentRoomName: section.homeRoomId ? (roomNameOf(section.homeRoomId) ?? 'Unknown Room') : null,
				targetRoomName: roomNameOf(nextHomeRoomId) ?? 'Unknown Room',
			};
		}
	}
	return { kind: 'direct' };
}

/**
 * The queued dispositions avoid the word "saved" entirely. A queued change is
 * not a saved change, and the review's requirement is that the two can never be
 * confused — including by a substring, a skim, or a screen reader.
 */
export const HOME_ROOM_QUEUED_OFFLINE = 'The server has not stored this change. It is held on this device and will sync when your connection is restored.';
export const HOME_ROOM_QUEUED_FAILED = 'The server has not stored this change. It is held on this device and will sync when the section service is reachable.';

export type HomeRoomPersistDeps = {
	/** False while the browser reports no connection. */
	isOnline: boolean;
	/** The exact payload the server receives. */
	assignments: HomeRoomAssignment[];
	/** The real transport. Any rejection means "not on the server". */
	put: () => Promise<void>;
	/** Apply the same local state the row already shows. */
	applyOptimistic: () => void;
	/** Persist the change to the local queue. */
	enqueue: () => void;
	/** Diagnostic hook for the rejected write. The outcome contract never
	 * changes because of it; it exists so a refused write is still diagnosable. */
	onWriteError?: (error: unknown) => void;
};

/**
 * Run the write and report what actually happened. Never throws: a refused
 * write is a reportable outcome, not an exception, because the caller has to
 * keep a truthful surface open for it.
 */
export async function persistHomeRoomAssignment(deps: HomeRoomPersistDeps): Promise<HomeRoomUpdateResult> {
	if (!deps.isOnline) {
		deps.applyOptimistic();
		deps.enqueue();
		return { status: 'queued', reason: 'offline', detail: HOME_ROOM_QUEUED_OFFLINE };
	}
	try {
		await deps.put();
		deps.applyOptimistic();
		return { status: 'saved' };
	} catch (error) {
		deps.onWriteError?.(error);
		deps.applyOptimistic();
		deps.enqueue();
		return { status: 'queued', reason: 'write-failed', detail: HOME_ROOM_QUEUED_FAILED };
	}
}
