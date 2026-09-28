/**
 * ReviewTeachersModal — the desktop replacement for the permanent right-hand
 * inspector column (Fix 26), and now also the `Teacher Workload Audit Summary`.
 *
 * Root cause of the density complaint: `pages/TeachingLoad.tsx` rendered a
 * `hidden w-80 shrink-0 border-l ... lg:block` column that was present on EVERY
 * large viewport, permanently narrowing the assignment workspace by 320px even
 * when the operator never opened it. This modal keeps the identical content
 * (`WorkloadInspector` / `SectionInspector`, passed in as a node by the page)
 * and makes it on-demand.
 *
 * The mobile path is deliberately NOT touched: the floating `View profile`
 * button and its `Sheet` remain the small-screen affordance.
 *
 * ── Design decision (mine, Executor S5) ──────────────────────────────────
 *
 * The criteria name ONE entry point, "Review teachers opens a centered Teacher
 * Workload Audit Summary modal". Lane C measured that the same control opened a
 * single-teacher modal. I chose option (a): `Review teachers` opens the AUDIT
 * SUMMARY, and a row in it drills into the single-teacher inspector that the
 * accepted desktop modal already renders. I did not add a second entry point
 * (option b).
 *
 * Why (a): the operator's c10 packet names the `Review teachers` control itself
 * as the thing that must produce the summary, so (b) would have left the
 * reviewed live behaviour ("Sidebar gone", single click → one teacher) intact
 * and bolted the summary beside it — a second, easier-to-miss affordance for the
 * same job, and the exact "two controls, one label" shape that A3 correction 2
 * removed from this stream. (a) also costs no extra navigation: the drill-in
 * renders the SAME `children` node the page already passes, so the per-teacher
 * metrics are the imported `WorkloadInspector`, not a copy.
 *
 * The single-teacher path is NOT dropped. It is one click away and is rendered by
 * the same `children` prop, so anything that depends on the accepted behaviour
 * — including the `teaching-load-review-modal` / `-title` test ids and the
 * `a3-teaching-load-review-c2` controls that click `Review teachers` and require
 * a dialog whose text contains the page's title — still holds.
 *
 * ── Layout / a11y ───────────────────────────────────────────────────────
 *
 * `@/ui` `Dialog` (Radix) supplies centering, the background scroll lock, Escape
 * and back-dismissal, and focus return to the previously focused element (the
 * `Review teachers` button, which is a sibling trigger outside the dialog).
 * `DialogContent` is a fixed-height flex column: header and footer `shrink-0`,
 * the flagged list `flex-1 min-h-0 overflow-y-auto`. That is what keeps the
 * close control on screen with a long list instead of scrolling it away, and it
 * spawns no global browser scrollbar.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/ui/dialog';
import { TooltipProvider } from '@/ui/tooltip';
import { TeacherWorkloadAuditSummary } from '@/components/faculty-assignments/TeacherWorkloadAuditSummary';
import { getTeacherWorkloadAuditSelectTeacher } from '@/components/faculty-assignments/teacherWorkloadAudit';

type ReviewTeachersModalProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/**
	 * `WorkloadInspector` or `SectionInspector`, supplied by the page. Rendered
	 * when the operator drills into one teacher; unchanged from the accepted
	 * single-teacher modal, which is what keeps the mobile/desktop content
	 * identical.
	 */
	children?: ReactNode;
	title: string;
	description: string;
};

export function ReviewTeachersModal({
	open,
	onOpenChange,
	children,
	title,
	description,
}: ReviewTeachersModalProps) {
	// Which pane is showing. `false` (the summary) is the default and the state
	// on every open, so reopening the dialog always lands on the audit summary.
	const [showingTeacher, setShowingTeacher] = useState(false);

	/**
	 * Focus return, made explicit.
	 *
	 * MEASURED, NOT ASSUMED: the shared primitive moves focus INTO the dialog on
	 * open (observed: the dialog contains `document.activeElement` immediately
	 * after the trigger click), but it did NOT hand focus back on close —
	 * `document.activeElement` was `BODY` after Escape, both with a plain
	 * `act` flush and after draining the timer queue. For a mouse-first,
	 * keyboard-using operator that strands them at the top of the page after
	 * every review, so this modal restores focus itself.
	 *
	 * The element is captured on the open transition, BEFORE the dialog mounts,
	 * so it is the outside control the operator came from — the `Review teachers`
	 * button, or the repair-queue banner control that shares the opener. If that
	 * element has since left the document, the primitive's own behaviour stands
	 * rather than focusing something detached.
	 */
	const restoreFocusTo = useRef<HTMLElement | null>(null);

	useEffect(() => {
		if (open) {
			const active = document.activeElement;
			restoreFocusTo.current = active instanceof HTMLElement ? active : null;
		} else {
			// Reopening must never restore a previous drill-in. Without this,
			// closing on a teacher's pane and reopening lands on that teacher and
			// the audit summary — the thing `Review teachers` promises — is skipped.
			setShowingTeacher(false);
		}
	}, [open]);

	const handleCloseAutoFocus = (event: Event) => {
		const target = restoreFocusTo.current;
		if (!target || !document.contains(target)) return;
		event.preventDefault();
		target.focus();
	};

	/**
	 * Click-through. Selecting the row's teacher is the roster's OWN selection
	 * setter (`data.setSelectedId`, a `useState` setter), so the page recomputes
	 * that teacher's `loadProfile` and re-renders the `children` node with it.
	 *
	 * DRAFT SAFETY: this changes selection only. It does not save, discard, or
	 * apply a draft, and no other draft-mutating callback is reachable from this
	 * module. If the roster has not published, the click is a no-op rather than a
	 * fabricated selection.
	 */
	const handleSelectTeacher = (facultyId: number) => {
		getTeacherWorkloadAuditSelectTeacher()?.(facultyId);
		setShowingTeacher(true);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl flex-col overflow-hidden p-0"
				onCloseAutoFocus={handleCloseAutoFocus}
				data-testid="teaching-load-review-modal"
			>
				{/* The summary's row figures come from `TeacherLoadReadout`, whose
				    explanation is a Radix `Tooltip`. Radix requires an ancestor
				    `TooltipProvider`, and the page happens to supply one — but this
				    modal renders through a PORTAL and is now usable from any host,
				    so it owns its own provider instead of carrying a hidden
				    dependency on the page's wrapper. Caught by running the modal
				    outside that wrapper, not by reading this file. */}
				<TooltipProvider>
					<DialogHeader className="shrink-0 border-b border-border/40 px-6 pb-4 pt-5">
						<DialogTitle className="text-base font-bold uppercase tracking-tight" data-testid="teaching-load-review-modal-title">
							{title}
						</DialogTitle>
						<DialogDescription className="text-xs">{description}</DialogDescription>
					</DialogHeader>

					{showingTeacher ? (
						<div className="flex min-h-0 flex-1 flex-col">
							<div className="shrink-0 border-b border-border/40 px-6 py-2">
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => setShowingTeacher(false)}
									className="h-7 gap-1.5 px-2 font-bold"
									data-testid="workload-audit-back"
								>
									<ChevronLeft className="size-4" aria-hidden="true" />
									All teachers
								</Button>
							</div>
							{/* `WorkloadInspector` carries its own `border-l`; suppress it
							    inside the modal where there is no adjacent pane to
							    divide. It scrolls inside this region, so the header and
							    the close control stay put. */}
							<div className="min-h-0 flex-1 overflow-y-auto [&>div]:border-l-0">{children}</div>
						</div>
					) : (
						<TeacherWorkloadAuditSummary onSelectTeacher={handleSelectTeacher} />
					)}
				</TooltipProvider>
			</DialogContent>
		</Dialog>
	);
}
