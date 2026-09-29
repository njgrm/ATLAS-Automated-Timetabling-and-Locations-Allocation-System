/**
 * A2 mc R2, item 7 — the lock surface the operator could not reach.
 *
 * THE DEFECT. The server capability EXISTS and has always existed:
 * `GET/POST/DELETE /api/v1/generation/:schoolId/:schoolYearId/locks`
 * (`atlas-server/src/routes/locked-session.router.ts`, backed by
 * `locked-session.service.ts` `listLocks` / `createLock` / `deleteLock`), and the
 * generate dialog already reads the count back as `Locked classes kept`. NOTHING
 * in the client ever called it: `atlas-client/src` contains no reference to the
 * locks API at all, and `components/LockPanel.tsx` is an orphan A2 c18 proved on
 * 2026-09-29 (zero importers). So `Lock this class` was not hidden behind a
 * disclosure — it did not exist as a control anywhere on `/timetable`.
 *
 * WHY A HOOK AND NOT A COMPONENT. `ScheduleReviewWorkspace.tsx` sits at 995
 * physical lines against the AGENTS.md §8 cap of 1000, so the behaviour lives here
 * and the workspace pays for one import and one menu row. The hook is deliberately
 * dumb: it reads the locks, decides whether ONE entry is locked, and posts or
 * deletes. It decides no policy beyond the two prerequisites the SERVER enforces,
 * so the two cannot disagree.
 *
 * THE TWO PREREQUISITES, stated rather than hidden. `createLock` requires a
 * positive `facultyId` and a positive `roomId` ("Locks must specify an explicit
 * faculty assignment" / "an explicit room assignment") and a canonical period
 * slot. A class with no teacher or no room therefore CANNOT be locked, and
 * `unlockBlockReason` returns the plain sentence for that case so the menu row can
 * be disabled WITH ITS REASON VISIBLE rather than firing a request that must
 * fail. That is a data condition, not a missing capability: the capability is
 * present for every class that has a teacher and a room.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import atlasApi from '@/lib/api';
import type { LockedSession } from '@/types';

export type LockTarget = {
	entryId: string;
	sectionId: number;
	subjectId: number;
	facultyId: number | null;
	roomId: number | null;
	day: string;
	startTime: string;
	endTime: string;
	entryKind?: 'SECTION' | 'COHORT';
	cohortCode?: string | null;
};

export type TimetableLocks = {
	/** Every lock for the active scope; `null` until the first read resolves. */
	locks: LockedSession[] | null;
	loading: boolean;
	busy: boolean;
	/** Plain words for why this entry cannot be locked, or `null` when it can. */
	unlockBlockReason: (entry: LockTarget) => string | null;
	/** Is THIS class locked right now? Matched on section + day + start, the
	 *  same key the server's own `LOCK_CONFLICT` check uses. */
	isLocked: (entry: LockTarget) => boolean;
	toggleLockForEntry: (entry: LockTarget) => Promise<{ ok: boolean; message: string }>;
};

/** The lock state of ONE selected class, already derived. */
export type SelectedClassLock = {
	isLocked: boolean;
	/** Null when the action is available; otherwise the plain reason it is not. */
	blockReason: string | null;
	/** The line the menu row shows under its label. */
	line: string;
	label: string;
	busy: boolean;
	toggle: () => Promise<void>;
};

export const LOCK_KEEPS_CLASS_LINE = 'Generate will keep this class where it is.';

/** The plain sentences. One place, so the menu row and any other surface agree. */
export const LOCK_NEEDS_TEACHER = 'This class has no teacher yet, so it cannot be locked.';
export const LOCK_NEEDS_ROOM = 'This class has no room yet, so it cannot be locked.';
export const LOCK_NEEDS_SCOPE = 'This class is not on a saved run yet, so it cannot be locked.';
/** A2 mc R2 (QA N2, 2026-09-30) — the fail-closed read state, in the operator's words. */
export const LOCK_READ_FAILED = 'ATLAS could not read which classes are locked. Try again before locking this one.';
export const LOCKED_CLASS_LINE = 'This class is locked. Generate will keep it in place.';

export function useTimetableLocks(scope: { schoolId: number | null; schoolYearId: number | null }): TimetableLocks {
	const [locks, setLocks] = useState<LockedSession[] | null>(null);
	const [loading, setLoading] = useState(false);
	const [busy, setBusy] = useState(false);

	const { schoolId, schoolYearId } = scope;
	const readLocks = useCallback(async () => {
		if (schoolId == null || schoolYearId == null) {
			setLocks([]);
			return;
		}
		setLoading(true);
		try {
			const { data } = await atlasApi.get<{ locks: LockedSession[] }>(`/generation/${schoolId}/${schoolYearId}/locks`);
			setLocks(data?.locks ?? []);
		} catch {
			// A failed read is NOT an empty list: the fail-closed state is `null`, so
			// no row can claim a class is unlocked because the read failed.
			setLocks(null);
		} finally {
			setLoading(false);
		}
	}, [schoolId, schoolYearId]);

	useEffect(() => { void readLocks(); }, [readLocks]);

	const unlockBlockReason = useCallback((entry: LockTarget): string | null => {
		// A2 mc R2 (QA N2, 2026-09-30). The comment beside `setLocks(null)` claimed
		// the fail-closed state stops "a row claim a class is unlocked because the read
		// failed" — but this function never consulted `locks`, so after a failed read
		// the row rendered ENABLED and the operator clicked into a 409. The fail-closed
		// state has to be consulted HERE, where the enabled state is decided.
		if (locks === null) return LOCK_READ_FAILED;
		if (schoolId == null || schoolYearId == null) return LOCK_NEEDS_SCOPE;
		if (entry.facultyId == null || !Number.isInteger(entry.facultyId) || entry.facultyId < 1) return LOCK_NEEDS_TEACHER;
		if (entry.roomId == null || !Number.isInteger(entry.roomId) || entry.roomId < 1) return LOCK_NEEDS_ROOM;
		return null;
	}, [locks, schoolId, schoolYearId]);

	const isLocked = useCallback((entry: LockTarget): boolean => {
		if (!locks) return false;
		return locks.some((lock) => (
			lock.sectionId === entry.sectionId
			&& lock.day === entry.day
			&& lock.startTime === entry.startTime
			&& lock.status !== 'ARCHIVED'
		));
	}, [locks]);

	const toggleLockForEntry = useCallback(async (entry: LockTarget) => {
		const blocked = unlockBlockReason(entry);
		if (blocked) return { ok: false, message: blocked };
		if (schoolId == null || schoolYearId == null) return { ok: false, message: LOCK_NEEDS_SCOPE };
		setBusy(true);
		try {
			const existing = (locks ?? []).find((lock) => (
				lock.sectionId === entry.sectionId
				&& lock.day === entry.day
				&& lock.startTime === entry.startTime
				&& lock.status !== 'ARCHIVED'
			));
			if (existing) {
				await atlasApi.delete(`/generation/${schoolId}/${schoolYearId}/locks/${existing.id}`);
				await readLocks();
				return { ok: true, message: 'Class unlocked. Generate may move it again.' };
			}
			await atlasApi.post(`/generation/${schoolId}/${schoolYearId}/locks`, {
				entryKind: entry.entryKind ?? 'SECTION',
				sectionId: entry.sectionId,
				subjectId: entry.subjectId,
				facultyId: entry.facultyId,
				roomId: entry.roomId,
				day: entry.day,
				startTime: entry.startTime,
				endTime: entry.endTime,
				cohortCode: entry.cohortCode ?? null,
			});
			await readLocks();
			return { ok: true, message: LOCKED_CLASS_LINE };
		} catch (error) {
			const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
			return { ok: false, message: message ?? 'ATLAS could not save that lock. Check the class has a teacher and a room.' };
		} finally {
			setBusy(false);
		}
	}, [locks, readLocks, schoolId, schoolYearId, unlockBlockReason]);

	return useMemo(
		() => ({ locks, loading, busy, unlockBlockReason, isLocked, toggleLockForEntry }),
		[locks, loading, busy, unlockBlockReason, isLocked, toggleLockForEntry],
	);
}

/**
 * The ONE derivation a selected-class action row renders, so the label, the
 * enabled state and the reason can never disagree with each other.
 *
 * The workspace holds 1000 physical lines, so the label/line/disabled decision is
 * derived here rather than assembled at the call site.
 */
export function useSelectedClassLock(
	locks: TimetableLocks,
	entry: {
		entryId: string; sectionId: number; subjectId: number;
		facultyId: number | null; roomId: number | null;
		day: string; startTime: string; endTime: string;
		entryKind?: 'SECTION' | 'COHORT'; cohortCode?: string | null;
	} | null,
	report: (status: { tone: 'success' | 'error'; message: string }) => void,
): SelectedClassLock {
	const target: LockTarget | null = entry
		? {
			entryId: entry.entryId,
			sectionId: entry.sectionId,
			subjectId: entry.subjectId,
			facultyId: entry.facultyId,
			roomId: entry.roomId,
			day: entry.day,
			startTime: entry.startTime,
			endTime: entry.endTime,
			entryKind: entry.entryKind,
			cohortCode: entry.cohortCode ?? null,
		}
		: null;

	const locked = target ? locks.isLocked(target) : false;
	const blockReason = target ? locks.unlockBlockReason(target) : LOCK_NEEDS_SCOPE;

	return {
		isLocked: locked,
		blockReason,
		line: blockReason ?? (locked ? LOCKED_CLASS_LINE : LOCK_KEEPS_CLASS_LINE),
		label: locked ? 'Unlock this class' : 'Lock this class',
		busy: locks.busy,
		toggle: async () => {
			if (!target) return;
			const result = await locks.toggleLockForEntry(target);
			report({ tone: result.ok ? 'success' : 'error', message: result.message });
		},
	};
}
