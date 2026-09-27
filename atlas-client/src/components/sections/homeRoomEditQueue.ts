/**
 * A3 C4 — the offline home-room edit queue (extracted from `pages/Sections.tsx`).
 *
 * WHY THIS MOVED OUT (review finding B1, 2026-09-28): the page had grown to
 * 1063 physical lines, past the AGENTS.md §8 hard cap of 1000, and was 982 at
 * base — so the candidate pushed a previously COMPLIANT file over the limit.
 * These five functions plus their type and cache-key constant are one coherent
 * unit (the device-local queue of home-room edits awaiting a sync), they had no
 * JSX in them, and the page is not where they belong. Nothing about their
 * behaviour changed in the move; only the module they live in.
 *
 * They are kept together deliberately: reading the queue, merging one edit into
 * it, writing it back, and overlaying it onto a fetched roster are four halves
 * of one persistence contract. Splitting them would put a read next to a
 * component and a write next to a different component, which is how they drifted
 * apart in the first place.
 *
 * Every access is guarded: `localStorage` can throw in private-mode browsers and
 * when a storage quota is exceeded, and a home-room edit queue is never worth
 * taking the page down for. A failed write degrades to "the edit is only in
 * memory this session", which is exactly what the caller already handles.
 */
export const HOME_ROOM_QUEUE_CACHE_PREFIX = 'atlas:sections-home-room-queue:v1';

export type HomeRoomQueueEntry = {
	sectionId: number;
	homeRoomId: number | null;
	queuedAt: string;
};

/**
 * The structural shape a roster row must have for the queue to be overlaid
 * onto it. Declared structurally rather than importing `SectionDetail` so this
 * module stays a pure persistence helper with no dependency on a component.
 */
export type QueuedHomeRoomRow = { id?: number | null; homeRoomId?: number | null };

export function homeRoomQueueKey(schoolId: number, schoolYearId: number): string {
	return `${HOME_ROOM_QUEUE_CACHE_PREFIX}:${schoolId}:${schoolYearId}`;
}

export function readQueuedHomeRoomEdits(schoolId: number, schoolYearId: number): HomeRoomQueueEntry[] {
	try {
		const raw = localStorage.getItem(homeRoomQueueKey(schoolId, schoolYearId));
		if (!raw) return [];
		const parsed = JSON.parse(raw) as HomeRoomQueueEntry[];
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((item) => typeof item.sectionId === 'number');
	} catch {
		return [];
	}
}

export function writeQueuedHomeRoomEdits(schoolId: number, schoolYearId: number, entries: HomeRoomQueueEntry[]): void {
	try {
		if (entries.length === 0) {
			localStorage.removeItem(homeRoomQueueKey(schoolId, schoolYearId));
			return;
		}
		localStorage.setItem(homeRoomQueueKey(schoolId, schoolYearId), JSON.stringify(entries));
	} catch {
		// Ignore storage restrictions.
	}
}

export function mergeQueuedHomeRoomEdit(
	current: HomeRoomQueueEntry[],
	sectionId: number,
	homeRoomId: number | null,
): HomeRoomQueueEntry[] {
	const next = current.filter((entry) => entry.sectionId !== sectionId);
	next.push({ sectionId, homeRoomId, queuedAt: new Date().toISOString() });
	return next;
}

/**
 * Overlay the queue onto a freshly fetched roster, so a queued edit is visible
 * in the row the moment it is made — including in the optimistic update and in
 * the cached snapshot — instead of appearing only after the next successful
 * sync. The generic parameter preserves the caller's exact row type.
 */
export function applyQueuedHomeRoomEdits<T extends QueuedHomeRoomRow>(
	sections: T[],
	queued: HomeRoomQueueEntry[],
): T[] {
	if (queued.length === 0) return sections;
	const homeRoomBySection = new Map<number, number | null>(queued.map((entry) => [entry.sectionId, entry.homeRoomId]));
	return sections.map((section) => {
		if (!section.id) return section;
		if (!homeRoomBySection.has(section.id)) return section;
		return {
			...section,
			homeRoomId: homeRoomBySection.get(section.id) ?? null,
		};
	});
}
