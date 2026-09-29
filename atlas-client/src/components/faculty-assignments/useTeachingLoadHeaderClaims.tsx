/**
 * A6 c9 — the Teaching Load header's two page-owned claims, as ONE hook.
 *
 * WHY A FILE. `pages/TeachingLoad.tsx` crossed the AGENTS.md §8 1000-physical-
 * line cap while the staffing figure and the 38.1 summary-window control were
 * added to it. Both are the same kind of thing — a page-level claim whose
 * figures come from `useTeachingLoadOutage` and whose open state the page owns —
 * so they are extracted together, and the page keeps deciding WHEN.
 *
 * THE STAFFING FIGURE SLOT. It is returned UNCONDITIONALLY. That is the whole
 * of the amber subtraction: `WorkspaceToolbar` still contains its degraded pill
 * for a host that supplies no claim, and no committed control changes, but the
 * real route now always supplies this one, so the pill is unreachable rather
 * than suppressed by a rule. The figure is a `@/ui` Button, it opens the window
 * of classes that still need a teacher, and it carries the single quiet
 * saved-roster line when the roster is not the current one.
 *
 * THE SUMMARY WINDOW CONTROL. 38.1 needs the page to open the `Load summary`
 * window already drilled into one teacher, so the page owns the flag. It is
 * returned as the `summaryControl` object rather than as raw state, so the page
 * never has to remember that `null` means "the roster".
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { TooltipProvider } from '@/ui/tooltip';
import { TeachingLoadStaffingFigure } from '@/components/faculty-assignments/TeachingLoadStaffingFigure';
import type { useTeachingLoadOutage } from '@/hooks/useTeachingLoadOutage';

type Outage = ReturnType<typeof useTeachingLoadOutage>;

export type TeachingLoadHeaderClaims = {
	/** The row-2 claim: the staffing figure, its window and its cover dialog. */
	staffingFigureSlot: ReactNode;
	/** The `Load summary` window's host-owned open flag, for `WorkspaceToolbar`. */
	summaryControl: {
		open: boolean;
		facultyId: number | null;
		setOpen: (open: boolean, facultyId: number | null) => void;
	};
	/**
	 * FIX 16.1 + 38.1 — the ONE production opener for a staff-workload review.
	 *
	 * The select runs BEFORE the open deliberately: the drill-in's node is derived
	 * from the page's selected teacher, and a window that opened against the
	 * previous teacher and corrected itself one render later is the defect this
	 * indirection causes. 38.1 changes only WHERE it opens: `Review load` now
	 * opens the header's `Staff workload audit` straight into that teacher, with
	 * the `< All teachers` control that returns to the roster without closing it.
	 */
	openTeacherReviewFor: (facultyId?: number | null) => void;
};

export function useTeachingLoadHeaderClaims(input: {
	outage: Outage;
	writeBlockedReason: string | null;
	/** The existing coverage detail the window's secondary control opens. */
	onShowCoverageDetail: () => void;
	/** The page's real `sectionSummary.fetchedAt`, or `null`. Never synthesised. */
	fetchedAt: string | null | undefined;
	/** The roster's own selection setter, so the drill-in shows the right teacher. */
	onSelectTeacher: (facultyId: number) => void;
}): TeachingLoadHeaderClaims {
	const [summaryWindow, setSummaryWindow] = useState<{ open: boolean; facultyId: number | null }>({
		open: false,
		facultyId: null,
	});

	const staffingFigureSlot = useMemo(
		() => (
			<TooltipProvider delayDuration={200}>
				<TeachingLoadStaffingFigure
					outage={input.outage}
					writeBlockedReason={input.writeBlockedReason}
					onShowCoverageDetail={input.onShowCoverageDetail}
					fetchedAt={input.fetchedAt}
				/>
			</TooltipProvider>
		),
		[input.fetchedAt, input.onShowCoverageDetail, input.outage, input.writeBlockedReason],
	);

	const summaryControl = useMemo(
		() => ({
			open: summaryWindow.open,
			facultyId: summaryWindow.facultyId,
			setOpen: (open: boolean, facultyId: number | null) => setSummaryWindow({ open, facultyId }),
		}),
		[summaryWindow.facultyId, summaryWindow.open],
	);

	const openTeacherReviewFor = useCallback((facultyId?: number | null) => {
		if (facultyId != null) input.onSelectTeacher(facultyId);
		setSummaryWindow({ open: true, facultyId: facultyId ?? null });
	}, [input.onSelectTeacher]);

	return { staffingFigureSlot, summaryControl, openTeacherReviewFor };
}
