import type { DraftReport, RunSummary, Violation } from '@/types';

/**
 * TT-DYNAMIC-WORKSPACE-C04 (CP-1/CP-2) — single source of publication and
 * run-wide readiness truth for the Timetable workspace.
 *
 * Ordered-term invariant: an academic term is the authoritative scope/version
 * of a schedule. The interactive violation list is selected-term scoped, but
 * the publication gate and soft-acknowledgement contract are RUN-WIDE. Mixing
 * the two is the A-01/A-02 defect this module removes.
 */

type SummaryRecord = Record<string, unknown>;

function asRecord(value: unknown): SummaryRecord | null {
	return value && typeof value === 'object' ? (value as SummaryRecord) : null;
}

/**
 * The only publication predicate. Server truth is `summary.isPublished === true`
 * (`publication-contract.service.ts:78-79,240-242`). Superseded runs retain
 * `publishedAt`/`publishedBy` markers while `isPublished:false`
 * (`publication-contract.service.ts:295-305`); loose marker checks must never
 * render published affordances for them (findings A-04/B-11).
 */
export function isRunPublishedStrict(summary: unknown): boolean {
	return asRecord(summary)?.isPublished === true;
}

export function isDraftPublishedStrict(draft: Pick<DraftReport, 'summary'> | null | undefined): boolean {
	return isRunPublishedStrict(draft?.summary);
}

/** A superseded run keeps stale markers but is not published any more. */
export function hasSupersededPublicationMarkers(summary: unknown): boolean {
	const record = asRecord(summary);
	if (!record) return false;
	if (record.isPublished === true) return false;
	const hasMarker = (typeof record.publishedAt === 'string' && record.publishedAt.length > 0)
		|| typeof record.publishedBy === 'number';
	return hasMarker;
}

export type RunWideReadiness = {
	/** Total run-wide HARD count (may include legacy non-promotable codes). Display only. */
	hardCount: number;
	/**
	 * F2 — run-wide HARD count filtered by the server publication allowlist
	 * (`publication-contract.service.ts` `countBlockingHardViolations`). This is
	 * the count the publish gate must use, because legacy non-promotable HARD
	 * codes (e.g. retired travel) no longer block publication server-side.
	 */
	blockingHardCount: number;
	/** Run-wide SOFT count the server requires acknowledgement for. */
	softCount: number;
	unassignedCount: number;
	/** True when the summary could not supply authoritative counts. */
	derivedFromDisplayFallback: boolean;
};

function numericField(summary: unknown, key: string): number | null {
	const record = asRecord(summary);
	const value = record?.[key];
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * B-10 — the run-data cache can hold an `inputState`/version for up to its TTL
 * without any visible age. Surface the comparison's `checkedAt` as a bounded
 * relative age so a stale read never looks current.
 */
export function formatCheckedAtAge(checkedAt: string | null | undefined, now: number = Date.now()): string | null {
	if (!checkedAt) return null;
	const parsed = Date.parse(checkedAt);
	if (!Number.isFinite(parsed)) return null;
	const seconds = Math.max(0, Math.round((now - parsed) / 1000));
	if (seconds < 60) return `checked ${seconds}s ago`;
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `checked ${minutes}m ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `checked ${hours}h ago`;
	const days = Math.round(hours / 24);
	return `checked ${days}d ago`;
}

/**
 * The run-wide gate counts as the SERVER just computed them, from
 * `GET /runs/:id/violations`.
 *
 * A2-C6-TRUTH (#62, T4). The header figure was read from
 * `RunSummary.softViolationCount`, a number the run row carries from whenever
 * that row was last written. On live draft run 321 the run stored 148 SOFT
 * violations and the header chip read 48, then read 148 after an edit that
 * changed nothing about warnings — the tell that the chip was reading the
 * summary's stored copy rather than the run's violations. `counts.runWide` is
 * the same endpoint's own run-wide projection, recomputed on every read, so it
 * cannot lag the number it reports.
 */
export type AuthoritativeRunWideCounts = {
	total: number;
	hard: number;
	blockingHard?: number;
	soft: number;
	byCode: Record<string, number>;
};

function authoritativeCount(
	counts: AuthoritativeRunWideCounts | null | undefined,
	key: 'hard' | 'soft' | 'blockingHard',
): number | null {
	const value = counts?.[key];
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Derive the run-wide publication readiness from the canonical run summary
 * (`generation.service.ts:824,902-903` persists run-wide hard/soft counts).
 * The selected-term violation array is only a fallback for pre-generation
 * drafts that carry no run summary.
 *
 * A2-C6-TRUTH (T4): `authoritativeRunWide`, when the caller has the violation
 * report for THIS run, outranks the summary for every count. The summary is a
 * stored snapshot; the report is the live recomputation, and on a run whose
 * summary predates its own violation set the two disagree — which is exactly how
 * a header read 48 for a run holding 148. The summary remains the fallback for
 * the pre-generation case that has no report at all, and the display array
 * remains the last resort, so no caller loses a count.
 */
export function deriveRunWideReadiness(
	summary: RunSummary | null | undefined,
	displayViolations: readonly Violation[],
	authoritativeRunWide?: AuthoritativeRunWideCounts | null,
): RunWideReadiness {
	const summaryHard = numericField(summary, 'hardViolationCount');
	const summaryBlockingHard = numericField(summary, 'blockingHardViolationCount');
	const summarySoft = numericField(summary, 'softViolationCount');
	const summaryUnassigned = numericField(summary, 'unassignedCount');

	const hasRunWideHard = summaryHard != null;
	const hasRunWideSoft = summarySoft != null;

	const displayHard = displayViolations.filter((v) => v.severity === 'HARD').length;
	const displaySoft = displayViolations.filter((v) => v.severity === 'SOFT').length;

	// A2-C6-TRUTH (T4): the live run-wide projection outranks the stored summary.
	// Each count is resolved independently, so a report that carries `hard` but
	// not `blockingHard` still contributes what it actually knows.
	const authoritativeHard = authoritativeCount(authoritativeRunWide, 'hard');
	const authoritativeBlockingHard = authoritativeCount(authoritativeRunWide, 'blockingHard');
	const authoritativeSoft = authoritativeCount(authoritativeRunWide, 'soft');

	// F2 fail-closed: when the server allowlist count is absent (older run
	// summary), fall back to the total HARD count so an unknown code can never
	// silently become publishable.
	const blockingHardCount = authoritativeBlockingHard
		?? summaryBlockingHard
		?? authoritativeHard
		?? summaryHard
		?? displayHard;

	return {
		hardCount: authoritativeHard ?? summaryHard ?? displayHard,
		blockingHardCount,
		softCount: authoritativeSoft ?? summarySoft ?? displaySoft,
		unassignedCount: summaryUnassigned ?? 0,
		derivedFromDisplayFallback: authoritativeSoft == null && (!hasRunWideHard || !hasRunWideSoft),
	};
}
