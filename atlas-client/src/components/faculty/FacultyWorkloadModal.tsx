/**
 * Fix 25 — `Review load` opens an IN-PAGE workload modal.
 *
 * THE DEFECT. The per-row repair action was a react-router `<Link>` to
 * `/teaching-load?facultyId=<id>&task=<intent>`, so clicking it unmounted the
 * roster and threw away the scheduler's search text, attention filter,
 * department/grade filters, sort order, pagination and scroll position. Lane C
 * observed the navigation directly: it "Navigates to
 * `/teaching-load?facultyId=1&task=review`".
 *
 * THE FIX, against the four acceptance criteria:
 *
 *   1. "Review load does not navigate by default." The action is a `<Button>`
 *      whose handler sets local state. Nothing in the open path touches the
 *      router, and the deep link is a separate, explicit control (below).
 *   2. "Modal data matches the selected teacher." The modal is keyed on the
 *      selected `FacultySummary` and projects it through
 *      `buildTeacherWorkloadView`; the deep link carries that same teacher's
 *      `facultyId`, so the two can never disagree.
 *   3. "Closing returns to the unchanged roster/filter/scroll state." The modal
 *      is a SIBLING of the roster inside the same page component, so no filter
 *      state is involved at all — there is nothing to restore. Scroll position
 *      is restored explicitly by `useRosterScrollMemory`, which captures the
 *      roster scroll container's `scrollTop` on open and re-applies it on close;
 *      the shared Dialog's own background scroll lock touches `document.body`,
 *      not the roster's inner scroll region, so without this hook the two would
 *      still agree — but the capture/restore is what makes it guaranteed rather
 *      than incidental.
 *   4. "Optional deep link intentionally navigates only when clicked." The
 *      `/teaching-load` link is present, labelled as leaving the page, and is
 *      the ONLY navigation in this component.
 *
 * REUSE, NOT COPY/PASTE. The metrics come from `WorkloadInspector` — imported
 * from `components/faculty-assignments/`, which this lane does not edit. The
 * modal supplies a viewport-appropriate wrapper and the deep link; every number
 * on screen is rendered by the inspector itself.
 *
 * The dialog is centred, responsive and scrolls INTERNALLY (`max-h` + internal
 * `overflow-auto` on the inspector's own scroll region, which it already owns),
 * so the page behind it never grows a scrollbar.
 */
import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { WorkloadInspector } from '@/components/faculty-assignments/WorkloadInspector';
import { formatFacultyDisplayName } from '@/components/faculty/teacherNameDisplay';
import { buildTeacherWorkloadView } from '@/components/faculty/teacherWorkloadProfile';
import type { FacultySummary } from '@/types';

export type FacultyRowRepairIntent = {
	task: string;
	label: string;
	helper: string;
};

type FacultyWorkloadModalProps = {
	faculty: FacultySummary | null;
	open: boolean;
	/** The row's repair intent, so the deep link keeps its `task=` parameter. */
	intent: FacultyRowRepairIntent | null;
	/**
	 * The roster's scroll region. The page restores the offset on close, so this
	 * is carried for documentation of ownership rather than used for the
	 * capture; see `rosterScrollMemory` for why the region is resolved from the
	 * clicked control rather than threaded down from `AdminWorkspaceFrame`.
	 */
	scrollRegionRef?: React.RefObject<HTMLElement | null>;
	/** Called on every dismissal, after the offset is restored. */
	onClose: () => void;
}

export function FacultyWorkloadModal({
	faculty,
	open,
	intent,
	onClose,
}: FacultyWorkloadModalProps) {
	/**
	 * Acceptance criterion 3. The offset was CAPTURED by the page on the click
	 * that opened this dialog (before the dialog took over), and the page's
	 * `onClose` restores it. Routing every dismissal — Escape, backdrop, the
	 * Close button, the X — through this one handler is what makes the restore
	 * unconditional.
	 */
	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (!nextOpen) onClose();
		},
		[onClose],
	);

	if (!faculty) return null;

	const { loadProfile, rotationTermBreakdown, teachingStandardHours, policyReady } =
		buildTeacherWorkloadView(faculty);
	const displayName = formatFacultyDisplayName(faculty);
	const deepLink = `/teaching-load?facultyId=${faculty.id}${intent ? `&task=${intent.task}` : ''}`;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				/*
				 * A5 item 23.2 — the dialog behind the `Assign teaching load` row
				 * action (`components/faculty/FacultyRowActions.tsx`) is a DATA
				 * surface: a weekly-load table the scheduler reads across, so it takes
				 * the shared dialog's default `resizable` handling rather than a
				 * local one. The clamps and the drag handles come from `@/ui/dialog`.
				 *
				 * A3 c17 row 7 — THE LOCAL WIDTH CAP IS GONE, and it was the reason
				 * this dialog did not resize while Profile and Subjects coverage
				 * did. `sm:max-w-2xl` is a `max-width`, and CSS resolves
				 * `max-width` against the drag handler's inline `style.width` LAST:
				 * every leftward drag computed a new width and the box clamped back
				 * to 672px, so the handle moved and nothing did. The right-hand
				 * handle was worse — it sat on the edge the text occupied, so
				 * dragging it selected text instead of resizing.
				 *
				 * What governs now is the shared primitive's own
				 * `DIALOG_RESIZABLE_CLASSES` (`min-w-[min(480px,95vw)] max-w-[95vw]`),
				 * which is the same bound every other resizable dialog in the app
				 * obeys (AGENTS.md §8, one look per control). No local `style`
				 * width, no local resize class and no local grip is added here:
				 * a second width authority on this surface is what broke it.
				 *
				 * This surface's own `max-h-[85svh]` and its
				 * `overflow-hidden flex flex-col p-0` stay — the inspector below
				 * owns the internal scroll, so the page behind never grows a
				 * scrollbar.
				 */
				resizable
				className="max-h-[85svh] overflow-hidden flex flex-col p-0"
				data-testid="faculty-workload-modal"
			>
				<DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
					<DialogTitle className="text-lg font-bold" data-testid="faculty-workload-modal-title">
						{displayName}
					</DialogTitle>
					<DialogDescription className="text-sm">
						{/* Fix 22: the teacher's own name uses the shared uppercase display
						    standard; the helper and the intent text are read as prose. */}
						{intent?.helper ??
							'Weekly teaching load, capacity, and assigned classes for this teacher.'}
					</DialogDescription>
				</DialogHeader>

				{/*
				 * The inspector owns its own internal scroll region
				 * (`flex-1 overflow-auto`), so the modal body scrolls INSIDE and
				 * the page behind it does not grow.
				 */}
				<div className="flex-1 min-h-0 overflow-auto">
					<WorkloadInspector
						selected={faculty}
						loadProfile={loadProfile}
						rotationTermBreakdown={rotationTermBreakdown}
						hoveredIncomingMinutes={0}
						previewLoadHours={0}
						isReadOnlyMode={false}
						teachingStandardHours={teachingStandardHours}
						policyReady={policyReady}
					/>
				</div>

				<DialogFooter className="px-6 py-4 border-t shrink-0 gap-2 sm:gap-0">
					{/*
					 * Acceptance criterion 4: the ONLY navigation in this modal, and
					 * it fires only on an explicit click.
					 */}
					<Button asChild variant="outline" size="sm" data-testid="faculty-workload-deep-link">
						<Link to={deepLink}>
							<ExternalLink className="mr-1.5 size-3.5" />
							Edit in Teaching Load
						</Link>
					</Button>
					<Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
