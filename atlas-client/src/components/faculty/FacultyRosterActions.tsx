/**
 * FacultyRosterActions — the Teachers page header actions.
 *
 * Extracted from `pages/Faculty.tsx` so that page does not grow past the
 * AGENTS.md §8 1000-line cap.
 *
 * FIX 24 (c10 re-issue) — THE ORIGINAL COPY IS RESTORED.
 *
 * Requested copy, verbatim: `Create temporary teacher (Teacher X)` and
 * `Refresh teacher list`, with "Menu must grow enough to keep these labels on
 * one line." An earlier cycle shortened these to "Add temporary" and "Refresh
 * roster" to make them fit; that is the opposite of the criterion and it left
 * the live symptom in place, so it is overruled. Both labels now come from
 * `rosterActionLabels` and the row is allowed to grow to its full intrinsic
 * width (`w-max` + `shrink-0`) instead of the copy being cut down to fit.
 *
 * ACCESSIBLE NAME / LABEL-IN-NAME (AGENTS.md §8).
 *
 * Both controls previously carried a raw `title` attribute
 * ("Add a temporary teacher record", "Refresh teacher list from EnrollPro") and
 * an `aria-label`. The `title` was NOT the accessible description of the control
 * — it carried extra information ("a temporary teacher record", "from
 * EnrollPro") beyond the control's name — so per §8 it is converted to a
 * `@/ui` Tooltip rather than kept. The `aria-label`s are removed because the
 * visible label is now the full sentence; an `aria-label` of "Add temporary
 * teacher" on a button whose visible text reads "Create temporary teacher
 * (Teacher 42)" would break WCAG 2.5.3 Label in Name, because the accessible
 * name no longer contains the visible label.
 *
 * FIX 25 — the per-row repair action no longer navigates. It opens the in-page
 * workload modal; the deep link to `/teaching-load` is an explicit secondary
 * action inside that modal. See `FacultyWorkloadModal`.
 */
import { useLayoutEffect, useRef } from 'react';
import { BookOpenCheck, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import {
	measureRosterActionLabel,
	REFRESH_TEACHER_LIST_LABEL,
	temporaryTeacherActionLabel,
} from '@/components/faculty/rosterActionLabels';

type FacultyRosterActionsProps = {
	/**
	 * `AdminWorkspaceFrame` renders a primary slot and a secondary slot. Keeping
	 * the same split preserves the existing header layout exactly.
	 */
	slot: 'primary' | 'secondary';
	onOpenReview: () => void;
	onCreateTemporary: () => void;
	onRefreshRoster: () => void;
	syncing: boolean;
	isOnline: boolean;
	refreshing: boolean;
	/**
	 * `X` for `Create temporary teacher (Teacher X)`. The page passes the real
	 * next teacher number from the roster, not a placeholder.
	 */
	nextTeacherNumber: number;
};

export function FacultyRosterActions({
	slot,
	onOpenReview,
	onCreateTemporary,
	onRefreshRoster,
	syncing,
	isOnline,
	refreshing,
	nextTeacherNumber,
}: FacultyRosterActionsProps) {
	const createTemporaryLabel = temporaryTeacherActionLabel(nextTeacherNumber);
	const rowRef = useRosterActionRowFit();
	const refreshLabel = syncing
		? 'Refreshing...'
		: !isOnline
			? 'Offline'
			: refreshing
				? 'Checking...'
				: REFRESH_TEACHER_LIST_LABEL;

	if (slot === 'primary') {
		return (
			<Button
				type="button"
				onClick={onOpenReview}
				size="sm"
				data-testid="faculty-review-open"
				className="hidden gap-2 whitespace-nowrap font-semibold shadow-sm sm:inline-flex"
			>
				<BookOpenCheck className="size-4" />
				Review teachers
			</Button>
		);
	}

	return (
		<div
			ref={rowRef}
			data-testid="faculty-roster-action-row"
			data-label-fits="unmeasurable"
			/*
			 * Fix 24: the row GROWS to the full intrinsic width of the longest
			 * label (`w-max`) and its buttons never shrink (`shrink-0`), so a long
			 * label cannot be wrapped or clipped to fit. The copy was not shortened
			 * to buy space; the container was allowed to take the space.
			 */
			className="flex w-max shrink-0 items-center gap-2"
		>
			{/* Mobile variant of the same in-page review. */}
			<Button
				type="button"
				onClick={onOpenReview}
				size="sm"
				data-testid="faculty-review-open-mobile"
				className="gap-2 whitespace-nowrap font-semibold shadow-sm sm:hidden"
			>
				<BookOpenCheck className="size-4" />
				Review
			</Button>

			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						type="button"
						onClick={onCreateTemporary}
						size="sm"
						data-testid="faculty-create-temporary"
						data-label={createTemporaryLabel}
						className="gap-2 whitespace-nowrap font-semibold shadow-sm"
					>
						<Plus className="size-4" />
						{createTemporaryLabel}
					</Button>
				</TooltipTrigger>
				<TooltipContent side="bottom" className="max-w-xs p-3">
					<p className="text-xs font-medium">
						Add a temporary teacher record, for a teacher who has not been hired yet.
					</p>
				</TooltipContent>
			</Tooltip>

			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						type="button"
						variant="outline"
						onClick={onRefreshRoster}
						disabled={syncing || !isOnline}
						size="sm"
						data-testid="faculty-refresh-list"
						data-label={REFRESH_TEACHER_LIST_LABEL}
						className="gap-2 whitespace-nowrap font-semibold"
					>
						<RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
						{refreshLabel}
					</Button>
				</TooltipTrigger>
				<TooltipContent side="bottom" className="max-w-xs p-3">
					<p className="text-xs font-medium">Refresh teacher list from EnrollPro.</p>
				</TooltipContent>
			</Tooltip>
		</div>
	);
}

/**
 * Publishes the rendered fit verdict for the action row.
 *
 * The row is `w-max` and its buttons are `shrink-0`, so it grows to the full
 * intrinsic width of the longest label rather than wrapping or clipping it. This
 * hook then MEASURES what actually rendered and writes the outcome to
 * `data-label-fits`, which is `unmeasurable` until a real layout engine has
 * laid the row out. It is deliberately not a pass-by-default.
 */
export function useRosterActionRowFit() {
	const rowRef = useRef<HTMLDivElement | null>(null);

	useLayoutEffect(() => {
		const row = rowRef.current;
		if (!row) return;
		const run = () => {
			for (const labelEl of Array.from(row.querySelectorAll<HTMLElement>('[data-label]'))) {
				measureRosterActionLabel(labelEl, row, window.innerWidth);
			}
		};
		run();
		window.addEventListener('resize', run);
		return () => window.removeEventListener('resize', run);
	}, []);

	return rowRef;
}
