import { ConfirmationModal } from '@/ui/confirmation-modal';
import { AutoFillSummaryModal, type AutoFillSummaryResult } from '@/components/faculty-assignments/AutoFillSummaryModal';

type TeachingLoadModalsProps = {
	autoFillDialogOpen: boolean;
	onAutoFillDialogOpenChange: (open: boolean) => void;
	coverageModeConfig: { label: string; description: string };
	onAutoFillConfirm: () => void;
	autoFillLoading: boolean;
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
};

export function TeachingLoadModals({
	autoFillDialogOpen,
	onAutoFillDialogOpenChange,
	coverageModeConfig,
	onAutoFillConfirm,
	autoFillLoading,
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
}: TeachingLoadModalsProps) {
	return (
		<>
			<ConfirmationModal
				open={autoFillDialogOpen}
				onOpenChange={onAutoFillDialogOpenChange}
				title="Preview suggested Teaching Load draft?"
				description={`Coverage mode: ${coverageModeConfig.label}. ${coverageModeConfig.description} This preview will not save Teaching Load rows.`}
				onConfirm={onAutoFillConfirm}
				confirmText="Preview suggestion"
				variant="primary"
				loading={autoFillLoading}
			/>

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

			<ConfirmationModal
				open={discardConfirmOpen}
				onOpenChange={onDiscardConfirmOpenChange}
				title={`Discard ${activeDraftCount} draft ${activeDraftCount === 1 ? 'change' : 'changes'}?`}
				description="This will discard every unsaved Teaching Load change. This cannot be undone."
				onConfirm={onDiscardConfirm}
				confirmText="Discard all"
				variant="danger"
			/>
		</>
	);
}
