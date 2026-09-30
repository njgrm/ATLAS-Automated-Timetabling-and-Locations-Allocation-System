import type { ReactNode } from 'react';
import { ConfirmationModal } from '@/ui/confirmation-modal';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { AutoFillSummaryModal, type AutoFillSummaryResult } from '@/components/faculty-assignments/AutoFillSummaryModal';
import { ReviewTeachersModal } from '@/components/faculty-assignments/ReviewTeachersModal';
import { TeachingLoadPlacementNotice } from '@/components/faculty-assignments/TeachingLoadPlacementNotice';
import type { PlacementAlternative, PlacementBlocker } from '@/lib/teaching-load-placement';

type TeachingLoadModalsProps = {
	summaryModalOpen: boolean;
	onSummaryModalOpenChange: (open: boolean) => void;
	autoFillResult: AutoFillSummaryResult | null;
	onApplySuggestion: () => void;
	suggestionApplying: boolean;
	suggestionApplyDisabledReason?: string | null;
	saveWarningOpen: boolean;
	onSaveWarningOpenChange: (open: boolean) => void;
	onSaveConfirm: () => void;
	discardConfirmOpen: boolean;
	onDiscardConfirmOpenChange: (open: boolean) => void;
	onDiscardConfirm: () => void;
	activeDraftCount: number;
	/** Fix 26: the on-demand replacement for the permanent desktop inspector. */
	reviewModalOpen: boolean;
	onReviewModalOpenChange: (open: boolean) => void;
	reviewInspector: ReactNode;
	reviewTitle: string;
	reviewDescription: string;
	/**
	 * FIX 40 — the pre-save confirmation.
	 *
	 * This is a DIFFERENT gate from `saveWarningOpen` and both must survive.
	 * `saveWarningOpen` is the timetable-sync warning: it appears only when
	 * `hasGeneratedRuns` is true, and it says which classes move back to the
	 * unassigned list. This one is unconditional on a draft, it names the number
	 * of pending changes and the term, and it is the thing `Save changes` opens.
	 * Collapsing them would silently drop the sync warning; keeping them apart
	 * is the point.
	 */
	saveChangesConfirmOpen: boolean;
	onSaveChangesConfirmOpenChange: (open: boolean) => void;
	onSaveChangesConfirm: () => void;
	/**
	 * FIX-40 CORRECTION (QA BLOCKING 1). Unit: (teacher x subject x section)
	 * assignment pairs the save would ADD OR REMOVE. It is NOT a teacher count
	 * and must never be wired to one.
	 */
	pendingChangeCount: number;
	/**
	 * The teacher count the change count spans. Passed separately so the body can
	 * name BOTH figures, which is what makes it impossible for a reader to take
	 * one for the other.
	 */
	pendingChangeTeacherCount: number;
	/**
	 * Appended verbatim to the count sentence; `''` when there is no provable
	 * scope.
	 *
	 * FIX-40 CORRECTION: the page now passes `''`. The draft is a whole-year
	 * draft — `FacultyAssignmentDraft` carries no term, and
	 * `effectiveDraftAssignmentsByFaculty` is keyed by faculty only — so
	 * ` for Term N` claimed a scope the code does not have. The requester's own
	 * wording is exemplary ("e.g."), so the clause is WITHHELD rather than
	 * asserted. It is kept as a prop, with a single producer, so a future
	 * term-scoped draft can restore it without touching this component.
	 */
	pendingChangeScope: string;
	/**
	 * A6 (operator decision 14) — the classes a save or an "Apply suggested" could
	 * not place. Empty means no refusal. The page owns the state; the notice is
	 * rendered here (save path) and inline in the summary modal (apply path).
	 */
	placementBlockers?: PlacementBlocker[];
	onUsePlacementAlternative?: (blocker: PlacementBlocker, alternative: PlacementAlternative) => void;
	/** Clear the blockers and close the refusal (Escape / overlay / Close). */
	onDismissPlacementBlockers?: () => void;
	placementBusy?: boolean;
};

/**
 * FIX-40 CORRECTION: the pre-save sentence, assembled where the copy can be
 * read in one place.
 *
 * WHY BOTH FIGURES. QA's blocking finding is that the sentence labelled a
 * teacher count as a change count. Showing the change count and the teacher
 * count it spans removes the ambiguity structurally, not just numerically: when
 * the two differ the reader sees both units, and when they are equal they are
 * genuinely the same figure, so there is nothing to confuse.
 *
 * The teacher clause is emitted only when more than one teacher is involved.
 * With exactly one teacher the change count cannot be misread as a teacher
 * count, and the shorter line is what a mouse-first scheduler wants.
 */
export function buildSaveChangesDescription(
	changeCount: number,
	teacherCount: number,
	scope: string,
): string {
	const changes = `${changeCount} uncommitted load assignment change${changeCount === 1 ? '' : 's'}`;
	const across = teacherCount > 1 ? ` across ${teacherCount} teachers` : '';
	return `You have ${changes}${across}${scope}. This will update faculty workloads and sync with the scheduling engine.`;
}

export function TeachingLoadModals({
	summaryModalOpen,
	onSummaryModalOpenChange,
	autoFillResult,
	onApplySuggestion,
	suggestionApplying,
	suggestionApplyDisabledReason,
	saveWarningOpen,
	onSaveWarningOpenChange,
	onSaveConfirm,
	discardConfirmOpen,
	onDiscardConfirmOpenChange,
	onDiscardConfirm,
	activeDraftCount,
	reviewModalOpen,
	onReviewModalOpenChange,
	reviewInspector,
	reviewTitle,
	reviewDescription,
	saveChangesConfirmOpen,
	onSaveChangesConfirmOpenChange,
	onSaveChangesConfirm,
	pendingChangeCount,
	pendingChangeTeacherCount,
	pendingChangeScope,
	placementBlockers = [],
	onUsePlacementAlternative,
	onDismissPlacementBlockers,
	placementBusy,
}: TeachingLoadModalsProps) {
	return (
		<>
			{/* The legacy zero-write confirmation step was removed: its open flag was
				never set true anywhere, so the dialog was unreachable. The primary
				toolbar action already dispatches the zero-write preview directly. */}

			<AutoFillSummaryModal
				open={summaryModalOpen}
				onOpenChange={onSummaryModalOpenChange}
				result={autoFillResult}
				onApplySuggestion={onApplySuggestion}
				applyingSuggestion={suggestionApplying}
				applyDisabledReason={suggestionApplyDisabledReason}
				placementBlockers={placementBlockers}
				onUsePlacementAlternative={onUsePlacementAlternative}
				onDismissPlacementBlockers={onDismissPlacementBlockers}
				placementBusy={placementBusy}
			/>

			{/*
			 * A6 (decision 14) — the SAVE path. When a save is refused because the
			 * timetable cannot place a class, the refusal is a named dialog, never
			 * a toast. Escape, overlay-click and the primitive's own close control
			 * all dismiss it (a real `onOpenChange`), and a visible Close button is
			 * always offered so a mouse-first scheduler is never trapped. Dismissing
			 * is NOT success: it only clears the blockers; no save is issued.
			 */}
			<Dialog
				open={placementBlockers.length > 0 && !summaryModalOpen}
				onOpenChange={(open) => { if (!open) onDismissPlacementBlockers?.(); }}
			>
				<DialogContent className="max-w-md" data-testid="teaching-load-placement-dialog">
					<DialogHeader>
						<DialogTitle>The timetable cannot place this class</DialogTitle>
						<DialogDescription>Assign a teacher who fits the free time, then save again.</DialogDescription>
					</DialogHeader>
					<TeachingLoadPlacementNotice
						blockers={placementBlockers}
						onUseAlternative={onUsePlacementAlternative}
						onDismiss={onDismissPlacementBlockers}
						busy={placementBusy}
					/>
					<DialogFooter>
						<Button
							type="button"
							variant="ghost"
							className="h-9 rounded-xl px-4 font-bold"
							data-testid="teaching-load-placement-close"
							onClick={onDismissPlacementBlockers}
							disabled={placementBusy}
						>
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

		<ConfirmationModal
			open={saveWarningOpen}
			onOpenChange={onSaveWarningOpenChange}
			title="Save teaching load changes?"
			description="Saving now will update the timetable's unassigned list when ATLAS next syncs. Any class whose teacher you changed will be moved back to the unassigned list. Do you want to continue?"
			onConfirm={onSaveConfirm}
			confirmText="Save changes"
			variant="warning"
		/>

		{/*
		 * FIX 40 — what `Save changes` actually opens. FIX-40 CORRECTION: the
		 * body is built by `buildSaveChangesDescription`, so the copy is one
		 * function a test can drive with REAL props instead of re-asserting a
		 * literal the test wrote itself.
		 */}
		<ConfirmationModal
			open={saveChangesConfirmOpen}
			onOpenChange={onSaveChangesConfirmOpenChange}
			title="Save Teaching Load Changes?"
			description={buildSaveChangesDescription(pendingChangeCount, pendingChangeTeacherCount, pendingChangeScope)}
			onConfirm={onSaveChangesConfirm}
			confirmText="Confirm & Save"
			variant="primary"
		/>


			<ConfirmationModal
				open={discardConfirmOpen}
				onOpenChange={onDiscardConfirmOpenChange}
				title={`Discard ${activeDraftCount} draft ${activeDraftCount === 1 ? 'change' : 'changes'}?`}
				description="This will discard every unsaved Teaching Load change. This cannot be undone."
				onConfirm={onDiscardConfirm}
				confirmText="Discard all"
				variant="danger"
			/>

			<ReviewTeachersModal
				open={reviewModalOpen}
				onOpenChange={onReviewModalOpenChange}
				title={reviewTitle}
				description={reviewDescription}
			>
				{reviewInspector}
			</ReviewTeachersModal>
		</>
	);
}
