export type RolloverAwarenessNotice = {
	schoolId: number;
	activeSchoolYearId: number;
	activeSchoolYearLabel: string;
	previousSchoolYearId: number;
	previousSchoolYearLabel: string;
	changedAt: string;
};

const NOTICE_PREFIX = 'atlas:rollover-awareness:v1';

/**
 * CLIENT-QUALITY-C01: a verified year-change notice is a transient operator
 * alert, not permanent chrome. It is re-hydrated from localStorage on every
 * load, so without an upper bound an old notice would reappear forever
 * (`changedAt` was stored but unused). Fourteen days is long enough to cover a
 * normal rollover hand-off and short enough that stale guidance cannot
 * masquerade as current.
 */
export const ROLLOVER_NOTICE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function rolloverNoticeCacheKey(schoolId: number): string {
	return `${NOTICE_PREFIX}:${schoolId}`;
}

export function isRolloverNoticeExpired(
	notice: Pick<RolloverAwarenessNotice, 'changedAt'>,
	now: number = Date.now(),
): boolean {
	const changedAtMs = Date.parse(notice.changedAt);
	if (!Number.isFinite(changedAtMs)) return true;
	return now - changedAtMs > ROLLOVER_NOTICE_TTL_MS;
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
		if (isRolloverNoticeExpired(notice)) return null;
		return notice;
	} catch {
		return null;
	}
}

/**
 * Explicit operator dismissal: remove the durable cache entry so the notice does
 * not re-hydrate on the next load. Returns true when an entry was present.
 */
export function clearRolloverAwarenessNotice(schoolId: number): boolean {
	try {
		const key = rolloverNoticeCacheKey(schoolId);
		const present = localStorage.getItem(key) != null;
		localStorage.removeItem(key);
		return present;
	} catch {
		return false;
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
 * A7-C7 — the new year as the SERVER describes it, not as the client infers it.
 *
 * `archived` and `serverVerifiedActive` come straight from the runtime context.
 * The defect this closes: a notice said "2029-2030" had become the new active
 * year while the server was actually still on 2022-2023, and a notice naming an
 * ARCHIVED year as "the new active year" is self-contradictory — the very next
 * sentence tells the operator that year is read-only.
 */
export type RolloverTransitionTarget = {
	id: number;
	label: string | null;
	/** The server reported this year as archived. An archived year is never "the new active year". */
	archived: boolean;
	/** The server itself confirmed this year is the live EnrollPro active year. */
	serverVerifiedActive: boolean;
};

/**
 * Decide whether a verified active-year read represents a real rollover.
 *
 * A transition only counts when a previously verified year existed, the
 * verified year differs, the server itself confirms the new year is the live
 * one, and that year is not archived. The first condition keeps the first read
 * after page load from producing a false notice and makes duplicate delivery of
 * the same rollover event a no-op once the runtime ref has advanced.
 *
 * A7-C7 added the last two. Both are refusals, not new behaviour: an unverified
 * or archived year is a server state the banner cannot honestly describe, so the
 * answer is "no notice" rather than a better-guessed one. No new notice type was
 * introduced for this.
 */
export function evaluateRolloverTransition(input: {
	schoolId: number;
	previous: { id: number | null; label: string | null };
	next: RolloverTransitionTarget;
}): { changed: boolean; notice: RolloverAwarenessNotice | null } {
	const changed = input.previous.id != null && input.previous.id !== input.next.id;
	if (!changed || input.previous.id == null) {
		return { changed: false, notice: null };
	}
	if (input.next.archived === true) {
		// An archived year is history. Naming it the new active year produced the
		// false banner this guards against.
		return { changed: false, notice: null };
	}
	if (input.next.serverVerifiedActive !== true) {
		// The server did not confirm the new year. A year that merely won a
		// local election is not a rollover the operator should be told about.
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

/**
 * A7-C7 — reconcile a notice rehydrated from durable storage against the
 * freshly verified context, on every load.
 *
 * Operators who already have the false notice saved must stop seeing it the
 * moment this ships, and the durable entry must be removed, not just hidden.
 *
 * The rules, in the order they are applied:
 * 1. no notice -> nothing to do;
 * 2. expired -> drop (the existing bounded window);
 * 3. the named active year is ARCHIVED -> drop;
 * 4. the named active year disagrees with the freshly verified year -> drop;
 * 5. otherwise keep it.
 *
 * `verifiedYear` is `null` when verification did not happen (offline, or the
 * runtime context was unavailable). Then the notice is KEPT: a legitimate
 * notice must not be destroyed by an operator's network state. The asymmetry is
 * deliberate — when the truth is unknown we keep what was previously verified,
 * and we never invent a notice. The server-side fix means the truth cannot be a
 * false one, so a surviving notice is either legitimate or will be corrected by
 * the next successful verification.
 */
export function reconcilePersistedRolloverNotice(input: {
	notice: RolloverAwarenessNotice | null;
	verifiedYear: { id: number; archived: boolean } | null;
	now?: number;
}): RolloverAwarenessNotice | null {
	const notice = input.notice;
	if (!notice) return null;
	if (isRolloverNoticeExpired(notice, input.now ?? Date.now())) return null;
	const verified = input.verifiedYear;
	if (!verified) return notice;
	if (verified.archived === true) return null;
	if (verified.id !== notice.activeSchoolYearId) return null;
	return notice;
}
