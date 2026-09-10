export type RolloverAwarenessNotice = {
	schoolId: number;
	activeSchoolYearId: number;
	activeSchoolYearLabel: string;
	previousSchoolYearId: number;
	previousSchoolYearLabel: string;
	changedAt: string;
};

const NOTICE_PREFIX = 'atlas:rollover-awareness:v1';

export function rolloverNoticeCacheKey(schoolId: number): string {
	return `${NOTICE_PREFIX}:${schoolId}`;
}

export function createRolloverAwarenessNotice(input: {
	schoolId: number;
	activeSchoolYearId: number;
	activeSchoolYearLabel: string | null;
	previousSchoolYearId: number;
	previousSchoolYearLabel: string | null;
}): RolloverAwarenessNotice {
	return {
		schoolId: input.schoolId,
		activeSchoolYearId: input.activeSchoolYearId,
		activeSchoolYearLabel: input.activeSchoolYearLabel ?? `School year ${input.activeSchoolYearId}`,
		previousSchoolYearId: input.previousSchoolYearId,
		previousSchoolYearLabel: input.previousSchoolYearLabel ?? `School year ${input.previousSchoolYearId}`,
		changedAt: new Date().toISOString(),
	};
}

export function readRolloverAwarenessNotice(schoolId: number): RolloverAwarenessNotice | null {
	try {
		const raw = localStorage.getItem(rolloverNoticeCacheKey(schoolId));
		if (!raw) return null;
		const notice = JSON.parse(raw) as RolloverAwarenessNotice;
		if (notice.schoolId !== schoolId || !Number.isInteger(notice.activeSchoolYearId)
			|| !Number.isInteger(notice.previousSchoolYearId) || !notice.changedAt) return null;
		return notice;
	} catch {
		return null;
	}
}

export function persistRolloverAwarenessNotice(notice: RolloverAwarenessNotice): void {
	try {
		localStorage.setItem(rolloverNoticeCacheKey(notice.schoolId), JSON.stringify(notice));
	} catch {
		// The current session still renders the notice when storage is unavailable.
	}
}

/**
 * Decide whether a verified active-year read represents a real rollover.
 *
 * A transition only counts when a previously verified year existed and the
 * verified year differs. This keeps the first read after page load from
 * producing a false notice and makes duplicate delivery of the same rollover
 * event a no-op once the runtime ref has advanced to the new year.
 */
export function evaluateRolloverTransition(input: {
	schoolId: number;
	previous: { id: number | null; label: string | null };
	next: { id: number; label: string | null };
}): { changed: boolean; notice: RolloverAwarenessNotice | null } {
	const changed = input.previous.id != null && input.previous.id !== input.next.id;
	if (!changed || input.previous.id == null) {
		return { changed: false, notice: null };
	}
	return {
		changed: true,
		notice: createRolloverAwarenessNotice({
			schoolId: input.schoolId,
			activeSchoolYearId: input.next.id,
			activeSchoolYearLabel: input.next.label,
			previousSchoolYearId: input.previous.id,
			previousSchoolYearLabel: input.previous.label,
		}),
	};
}
