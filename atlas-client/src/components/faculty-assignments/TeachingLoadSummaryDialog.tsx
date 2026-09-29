/**
 * TeachingLoadSummaryDialog — the header's `Load summary` window, and from
 * A6 c9 the STAFF WORKLOAD AUDIT.
 *
 * FIX 38 (operator, 2026-09-28). The Teaching Load page carried its complete
 * load breakdown as an INLINE collapsible `TEACHING LOAD SUMMARY` band in the
 * page body, whose two metric rows are `overflow-x-auto` pill strips. That
 * bought two things nobody asked for: ~42px of permanent header band, and a
 * horizontal scroll area a scheduler had to discover to read the numbers. The
 * operator's fix is that the numbers stay, but they move behind one header
 * button and a centred dialog.
 *
 * ── A6 c9 (fix-1.2 38.1), and what the operator overruled ──────────────────────
 *
 * The binding addendum to the c9 packet is explicit on both halves, and they
 * pull in opposite directions, which is why this is a re-wiring rather than a
 * rename:
 *
 *  1. `Load summary` opens the SCHOOL-WIDE audit: TOTAL / UNDERLOADED /
 *     BALANCED / OVERLOADED badges, a scrollable roster (avatar, name,
 *     department, ADVISER, OVER CAP, hours and percent of standard), and a row
 *     click that drills into that teacher.
 *  2. The old table of totals nobody reads goes BEHIND a `More detail`
 *     disclosure at the BOTTOM of the window, with its `truthModel` authority
 *     unchanged.
 *
 * So the window has two panes and one disclosure. The roster is the pane the
 * packet asks for; the totals table is still here, still the page's real
 * `TeachingLoadTruthPanel` node, and still reachable in one press.
 *
 * WHY THE FILE DUPLICATES NOTHING. It is a frame with two `children` slots. The
 * roster is the REAL `TeacherWorkloadAuditSummary` — already the body of
 * `ReviewTeachersModal` (Fix 26) — and the breakdown is the page's REAL
 * `TeachingLoadTruthPanel` node. Recomputing or re-listing either one here would
 * create a second authority for the same figures, which is the exact failure
 * both of those components were built to prevent.
 *
 * ONE SCROLL REGION, SIZED ONCE (AGENTS.md §8). The dialog is a fixed-height
 * flex column — header and footer `shrink-0`, the body `min-h-0 flex-1
 * overflow-y-auto` — so the audit's own list does not scroll inside a scrolling
 * body and no global browser scrollbar can appear. The roster component is
 * rendered with `fill`, which is what drops ITS bounded scroller; without that
 * flag the same body would nest two `overflow-y-auto` regions, which is the
 * defect a6 C2 measured on this very dialog.
 *
 * The frame's width and height are the packet's: `min-w-[540px] max-w-[95vw]
 * max-h-[85vh]`, centred by the shared `Dialog` primitive.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/ui/dialog';
import { TeacherWorkloadAuditSummary } from '@/components/faculty-assignments/TeacherWorkloadAuditSummary';
import { getTeacherWorkloadAuditSelectTeacher } from '@/components/faculty-assignments/teacherWorkloadAudit';

type TeachingLoadSummaryDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The real `TeachingLoadTruthPanel`, already built by the page. `More detail`. */
	children: ReactNode;
	/**
	 * A6 c9 (38.1) — the page's per-teacher workload node, for the drill-in.
	 * Omitted, a row click selects the teacher and this window says so rather
	 * than rendering an empty pane.
	 */
	teacherDetail?: ReactNode;
	/**
	 * A6 c9 (38.1) — open ALREADY on one teacher, which is how a card's
	 * `Review load` reaches its detail in one press. Read on the open transition
	 * only, so a later re-render cannot move a scheduler out of the teacher they
	 * opened.
	 */
	initialFacultyId?: number | null;
	/** A6 c9 (38.1) — lets a host open this window on a chosen teacher. */
	openFor?: (facultyId: number | null) => void;
};

export function TeachingLoadSummaryDialog({
	open,
	onOpenChange,
	children,
	teacherDetail,
	initialFacultyId = null,
	openFor,
}: TeachingLoadSummaryDialogProps) {
	// Which pane is showing. The ROSTER is the default on every open, so the
	// window always delivers what the `Load summary` control promises; the only
	// way in is an explicit request for a teacher.
	const [facultyId, setFacultyId] = useState<number | null>(null);
	const [moreDetailOpen, setMoreDetailOpen] = useState(false);

	useEffect(() => {
		if (!open) return;
		setFacultyId(initialFacultyId ?? null);
		setMoreDetailOpen(false);
	}, [initialFacultyId, open]);

	const selectTeacher = (nextFacultyId: number) => {
		// The roster's own selection setter, so the page recomputes that
		// teacher's load and the `teacherDetail` node re-renders with it. This
		// changes SELECTION only: no save, discard or apply is reachable here.
		getTeacherWorkloadAuditSelectTeacher()?.(nextFacultyId);
		setFacultyId(nextFacultyId);
	};

	const backToRoster = () => {
		setFacultyId(null);
		openFor?.(null);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="flex min-w-[540px] max-w-[95vw] max-h-[85vh] flex-col overflow-hidden p-0"
				data-testid="teaching-load-summary-dialog"
			>
				<DialogHeader className="shrink-0 border-b border-border/40 px-6 pb-4 pt-5">
					<DialogTitle className="text-base font-bold" data-testid="teaching-load-summary-title">
						{teacherDetail ? 'Staff workload audit' : 'Load summary'}
					</DialogTitle>
					<DialogDescription className="text-xs">
						{teacherDetail
							? 'Every teacher on this roster, and the load each one carries.'
							: 'Every class, teacher, and capacity figure ATLAS derives for this school year.'}
					</DialogDescription>
				</DialogHeader>

				{/* THE ONE SCROLL REGION. */}
				<div className="min-h-0 flex-1 overflow-y-auto" data-testid="teaching-load-summary-body">
					{facultyId != null && teacherDetail ? (
						<div className="px-6 py-4" data-testid="teaching-load-summary-teacher-pane">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-7 cursor-pointer gap-1.5 px-2 font-bold"
								data-testid="workload-audit-back"
								onClick={backToRoster}
							>
								<ChevronLeft className="size-4" aria-hidden="true" />
								All teachers
							</Button>
							{/* `WorkloadInspector` carries its own `border-l`; suppress it
							    inside this window, where there is no adjacent pane to
							    divide. */}
							<div className="mt-3 [&>div]:border-l-0">{teacherDetail}</div>
						</div>
					) : (
						<TeacherWorkloadAuditSummary onSelectTeacher={selectTeacher} fill />
					)}
				</div>

				{/*
				 * THE TOTALS TABLE, BEHIND ONE DISCLOSURE, AT THE BOTTOM.
				 *
				 * It is the page's real panel node with its own `truthModel`
				 * authority — nothing here recomputes or restates a figure it
				 * already owns. A `Button` toggles it, never a raw `<details>` or
				 * `<summary>` (AGENTS.md §8), and it is closed on every open so the
				 * window lands on the roster the packet asks for.
				 */}
				<div className="shrink-0 border-t border-border/40 px-6 py-3">
					<Button
						type="button"
						variant="outline"
						size="sm"
						aria-expanded={moreDetailOpen}
						aria-controls="teaching-load-summary-more-detail"
						className="h-8 cursor-pointer gap-1.5 px-3 text-xs"
						data-testid="teaching-load-summary-more-detail-toggle"
						onClick={() => setMoreDetailOpen((value) => !value)}
					>
						More detail
						<ChevronRight
							className={`size-3.5 transition-transform ${moreDetailOpen ? 'rotate-90' : ''}`}
							aria-hidden="true"
						/>
					</Button>
					{moreDetailOpen && (
						<div id="teaching-load-summary-more-detail" data-testid="teaching-load-summary-more-detail">
							{children}
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
