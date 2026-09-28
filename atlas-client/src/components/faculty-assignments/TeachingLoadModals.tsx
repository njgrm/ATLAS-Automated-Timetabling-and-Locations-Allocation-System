import type { ReactNode } from 'react';
import { ConfirmationModal } from '@/ui/confirmation-modal';
import { AutoFillSummaryModal, type AutoFillSummaryResult } from '@/components/faculty-assignments/AutoFillSummaryModal';
import { ReviewTeachersModal } from '@/components/faculty-assignments/ReviewTeachersModal';

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
	pendingChangeCount: number;
	/** ` for Term 2` when the scope has a term, `''` when it does not. */
	pendingChangeScope: string;
};

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
	pendingChangeScope,
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
			/>

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
		 * FIX 40 — what `Save changes` actually opens. The count is singularised
		 * so "1 uncommitted load assignment change" never reads as a typo, and
		 * the term is appended by the page only when the scope has one. Nothing
		 * else varies: the consequence sentence is the same every time, which is
		 * what makes it worth reading once.
		 */}
		<ConfirmationModal
			open={saveChangesConfirmOpen}
			onOpenChange={onSaveChangesConfirmOpenChange}
			title="Save Teaching Load Changes?"
			description={`You have ${pendingChangeCount} uncommitted load assignment change${pendingChangeCount === 1 ? '' : 's'}${pendingChangeScope}. This will update faculty workloads and sync with the scheduling engine.`}
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
