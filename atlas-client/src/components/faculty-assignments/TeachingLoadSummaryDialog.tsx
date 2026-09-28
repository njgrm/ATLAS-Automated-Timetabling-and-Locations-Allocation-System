/**
 * TeachingLoadSummaryDialog — the header's `Load summary` modal.
 *
 * FIX 38 (operator, 2026-09-28). The Teaching Load page carried its complete
 * load breakdown as an INLINE collapsible `TEACHING LOAD SUMMARY` band in the
 * page body, whose two metric rows are `overflow-x-auto` pill strips. That
 * bought two things nobody asked for: ~42px of permanent header band, and a
 * horizontal scroll area a scheduler had to discover to read the numbers. The
 * operator's fix is that the numbers stay, but they move behind one header
 * button and a centred dialog.
 *
 * WHY THIS FILE DUPLICATES NOTHING.
 * It is a frame with a `children` slot. The complete breakdown is the REAL
 * `TeachingLoadTruthPanel` node, passed in by `pages/TeachingLoad.tsx` and
 * rendered with `expanded`, so the dialog cannot show a different number from
 * the row. Recomputing or re-listing the metrics here would create a second
 * authority for the same figure — the exact failure mode the truth panel was
 * built to prevent.
 *
 * `max-h-[70vh] overflow-y-auto` on the body is the dialog's ONE scroll
 * region, bounded so the dialog itself can never grow past the viewport and
 * produce a global scrollbar (AGENTS.md §8).
 */
import type { ReactNode } from 'react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/ui/dialog';

type TeachingLoadSummaryDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The real `TeachingLoadTruthPanel`, already built by the page. */
	children: ReactNode;
};

export function TeachingLoadSummaryDialog({
	open,
	onOpenChange,
	children,
}: TeachingLoadSummaryDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl" data-testid="teaching-load-summary-dialog">
				<DialogHeader>
					<DialogTitle>Load summary</DialogTitle>
					<DialogDescription>
						Every class, teacher, and capacity figure ATLAS derives for this school year.
					</DialogDescription>
				</DialogHeader>
				<div className="max-h-[70vh] overflow-y-auto">
					{children}
				</div>
			</DialogContent>
		</Dialog>
	);
}
