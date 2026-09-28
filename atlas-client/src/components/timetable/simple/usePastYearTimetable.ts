/**
 * A2 C12 / ITEM S2 — the SCOPED PAST-YEAR READ the client performs.
 *
 * ## Why this is a hook and not inline fetch
 * `ScheduleReviewWorkspace` has early returns above its render (a loading guard and
 * an error guard), so a `useEffect` placed after them would run in fewer renders
 * than the ones that reach the body — which is React error #310, the crash that
 * took `/timetable` down on staging once already. The read is therefore a hook
 * called with the others, ABOVE every early return, and the workspace then decides
 * through the pure gate.
 *
 * ## Why `pending` is NOT the current year
 * While this read is in flight, `read.status === 'pending'` and the pure resolver
 * in `pastYearViewState.ts` turns that into a NOTICE. Rendering today's schedule
 * for the frame before the past year answers would be the same lie as a permanent
 * fall-through, one frame earlier.
 *
 * ## Why no request at all when no year was asked for
 * With no `schoolYearId` this hook issues NOTHING. That is the default path for
 * every existing `/timetable` visit, and it must not gain a request.
 */
import { useEffect, useState } from 'react';

import atlasApi from '@/lib/api';
import type { PastYearScopedRead } from '@/components/timetable/simple/pastYearViewState';
import type { DayKey, PublishedScheduleMatrixEntry } from '@/components/published-schedule/PublishedTimetableMatrix';

/** The terms the PAST YEAR's published run reported, in its own order. */
export type PastYearOrderedTerm = { identity: string; displayLabel: string; order: number };

export type PastYearPayload = {
	source: {
		schoolYearId: number;
		termIndex: number;
		termScope: 'active' | 'explicit';
		activeTermVerified: boolean;
		orderedTerms: PastYearOrderedTerm[];
	};
	entries: PublishedScheduleMatrixEntry[];
	pastYear: {
		schoolYearId: number;
		yearLabel: string | null;
		isActive: boolean;
		isArchived: boolean;
		readOnly: true;
	};
};

export type PastYearReadState = {
	read: PastYearScopedRead;
	payload: PastYearPayload | null;
	/** The term the server actually resolved for the PAST year. */
	termIndex: number | null;
	/** The term the operator has chosen, defaulting to the server's resolution. */
	selectedTermIndex: number | null;
	setSelectedTermIndex: (order: number) => void;
};

/** The same strict parse the server and `parsePastYearIdParam` use. */
function parseYear(raw: string | null | undefined): number | null {
	if (typeof raw !== 'string') return null;
	const trimmed = raw.trim();
	if (!/^\d+$/.test(trimmed)) return null;
	const parsed = Number(trimmed);
	return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
}

/**
 * @param requestedSchoolYearId the RAW `schoolYearId` query value, verbatim.
 * @param termOrder the operator's chosen term, or `null` to take the term the
 *   server resolves from the past year's own frozen contract.
 */
export function usePastYearTimetable({
	schoolId,
	requestedSchoolYearId,
	termOrder,
}: {
	schoolId: number | null;
	requestedSchoolYearId: string | null;
	termOrder: number | null;
}): PastYearReadState {
	const [read, setRead] = useState<PastYearScopedRead>({ status: 'pending' });
	const [payload, setPayload] = useState<PastYearPayload | null>(null);
	const [resolvedTermIndex, setResolvedTermIndex] = useState<number | null>(null);
	const [selectedTermIndex, setSelectedTermIndex] = useState<number | null>(null);

	const requestedYear = parseYear(requestedSchoolYearId);

	useEffect(() => {
		// No year asked for: TODAY'S BEHAVIOUR, and no request at all.
		if (requestedYear === null || schoolId === null) {
			setRead({ status: 'pending' });
			setPayload(null);
			setResolvedTermIndex(null);
			setSelectedTermIndex(null);
			return;
		}
		// The requested year changed, or the term changed: the previous answer is no
		// longer an answer to this question. Back to pending — a NOTICE, never the
		// current year.
		setRead({ status: 'pending' });

		let cancelled = false;
		void (async () => {
			try {
				const { data } = await atlasApi.get<PastYearPayload>(
					`/schools/${schoolId}/school-years/${requestedYear}/schedules/published/history`,
					// The term the PAST YEAR resolves for itself. Omitted entirely on
					// first load so the server resolves it from that year's own frozen
					// ordered-term contract rather than the client assuming one.
					{ params: termOrder === null ? {} : { termIndex: termOrder } },
				);
				if (cancelled) return;
				const yearLabel = data?.pastYear?.yearLabel ?? null;
				if (yearLabel === null) {
					// A published payload with no year label is not a past year we can
					// name, and C4 forbids inventing a second label source. Refuse it
					// rather than print a bare id.
					setRead({ status: 'refused', code: 'PAST_YEAR_LABEL_UNAVAILABLE' });
					setPayload(null);
					return;
				}
				setPayload(data);
				setResolvedTermIndex(data?.source?.termIndex ?? null);
				setSelectedTermIndex(termOrder ?? data?.source?.termIndex ?? null);
				setRead({ status: 'published', schoolYearId: data.pastYear.schoolYearId, yearLabel });
			} catch {
				if (cancelled) return;
				// ANY failure — 403, 404, network, malformed body — is a REFUSAL. There
				// is no branch here that resolves to the current year, and none that
				// retries into one. That asymmetry is the point.
				setRead({ status: 'refused', code: 'PAST_YEAR_READ_FAILED' });
				setPayload(null);
			}
		})();

		return () => { cancelled = true; };
	}, [schoolId, requestedYear, termOrder]);

	return { read, payload, termIndex: resolvedTermIndex, selectedTermIndex, setSelectedTermIndex };
}

export type { DayKey };
