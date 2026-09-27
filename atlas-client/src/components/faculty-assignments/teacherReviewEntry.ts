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
	/** The workspace view switch; `Review teachers` always means the teacher view. */
	setViewMode: (mode: 'teacher' | 'allocation') => void;
	/** Opens `ReviewTeachersModal` (rendered by `TeachingLoadModals`). */
	setReviewModalOpen: (open: boolean) => void;
};

/**
 * Open the teacher review dialog. Kept deliberately small and synchronous: the
 * dialog's own `open` flag is the single source of truth, so there is no second
 * "review is showing" state that could disagree with it.
 */
export function openTeacherReview({ setViewMode, setReviewModalOpen }: TeacherReviewEntrySetters): void {
	setViewMode('teacher');
	setReviewModalOpen(true);
}
