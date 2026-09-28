/**
 * teacherReviewEntry — the ONE opener behind every control labelled
 * `Review teachers`, shared by `pages/TeachingLoad.tsx`.
 *
 * A3 correction 2 (fix 25/26 dead control). The page had two controls with the
 * identical label and two different handlers:
 *
 *  - the Next Step banner (`TeachingLoadRepairQueue`,
 *    `data-testid="teaching-load-repair-review"`, `actionLabel: 'Review
 *    teachers'`) was wired to `onOpenReview: () => ui.setViewMode('teacher')`.
 *    That callback sets a view mode that was already `teacher`, so the click
 *    took focus and opened NOTHING — no `role="dialog"` appeared in the DOM.
 *  - the bottom bar (`TeachingLoadInspectorTriggers`,
 *    `data-testid="teaching-load-review-open"`) was wired to
 *    `() => setReviewModalOpen(true)` and did open the dialog.
 *
 * Two controls, one label, one dead is a real defect: a labelled affordance
 * that does nothing. Both are now bound to this single function, so the
 * duplicate label can no longer drift into a second, different behaviour, and
 * the function is importable so a control can exercise the production wiring
 * instead of a retyped copy of it.
 *
 * It lives in its own module rather than inline in the page for two reasons:
 * the page is close to the AGENTS.md §8 1000-line cap, and the handler is the
 * thing the acceptance control must be able to import and click.
 */

export type TeacherReviewEntrySetters = {
	/** The workspace view switch; `Review staff workload` always means the teacher view. */
	setViewMode: (mode: 'teacher' | 'allocation') => void;
	/** Opens `ReviewTeachersModal` (rendered by `TeachingLoadModals`). */
	setReviewModalOpen: (open: boolean) => void;
};

/**
 * A6 C2 (Slice 5, Minor 7) — THE ONE label for this opener, exported from the
 * module that owns the opener.
 *
 * THE DEFECT, MEASURED BY LANE C: the neutral footer/queue control labelled
 * `Review teachers` opened a dialog titled `TEACHER WORKLOAD: <NAME>` that
 * exposed Total/Underloaded/Balanced/Overloaded filters and a 42-person roster.
 * The label neither said workload audit nor explained why one teacher was the
 * subject, so a roster-level census arrived as an unexpected context jump.
 *
 * `Review staff workload` says both: it is about STAFF, it is about WORKLOAD,
 * and it reads the same on the roster-level control and the per-teacher one
 * because both import THIS constant. Changing it per call site is how the two
 * entry points drift, which is the exact failure `openTeacherReview` itself was
 * extracted to prevent.
 *
 * The per-ROW control keeps its own `Review load` label: it sits inside one
 * teacher's row and names that teacher through its `aria-label`, so claiming a
 * staff-wide audit there would be the same kind of overclaim in reverse.
 */
export const STAFF_WORKLOAD_REVIEW_LABEL = 'Review staff workload';

/**
 * Open the teacher review dialog. Kept deliberately small and synchronous: the
 * dialog's own `open` flag is the single source of truth, so there is no second
 * "review is showing" state that could disagree with it.
 */
export function openTeacherReview({ setViewMode, setReviewModalOpen }: TeacherReviewEntrySetters): void {
	setViewMode('teacher');
	setReviewModalOpen(true);
}
