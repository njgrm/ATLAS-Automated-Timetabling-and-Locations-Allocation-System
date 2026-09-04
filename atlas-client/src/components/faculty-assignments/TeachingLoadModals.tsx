import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
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
	onReviewSuggestionManually: () => void;
	suggestionApplying: boolean;
	suggestionApplyDisabledReason?: string | null;
	suggestionReviewWarning?: string | null;
	summaryModalReviewOnly?: boolean;
	resetDialogOpen: boolean;
	onResetDialogOpenChange: (open: boolean) => void;
	canRunGlobalReset: boolean;
	resetLoading: boolean;
	resetConfirmText: string;
	onResetConfirmTextChange: (text: string) => void;
	onResetConfirm: () => void;
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
	onReviewSuggestionManually,
	suggestionApplying,
	suggestionApplyDisabledReason,
	suggestionReviewWarning,
	summaryModalReviewOnly,
	resetDialogOpen,
	onResetDialogOpenChange,
	canRunGlobalReset,
	resetLoading,
	resetConfirmText,
	onResetConfirmTextChange,
	onResetConfirm,
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
				onReviewManually={onReviewSuggestionManually}
				applyingSuggestion={suggestionApplying}
				applyDisabledReason={suggestionApplyDisabledReason}
				reviewWarning={suggestionReviewWarning}
				reviewOnly={summaryModalReviewOnly}
			/>

			<Dialog open={resetDialogOpen} onOpenChange={onResetDialogOpenChange}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="text-xl font-bold text-rose-700">Global Assignment Reset</DialogTitle>
						<DialogDescription className="text-sm font-medium">
							This action will <span className="font-bold text-rose-800 uppercase underline">permanently delete all assignments</span> for the current school year.
						</DialogDescription>
					</DialogHeader>

					<div className="bg-rose-50 border border-rose-100 rounded-xl p-4 space-y-3">
						<p className="text-xs font-bold text-rose-900 leading-relaxed">
							This cannot be undone. All teacher-subject ownership records will be cleared. 
							You will need to suggest a Teaching Load draft or re-assign sections manually.
						</p>
						<div className="space-y-2">
							<label htmlFor="reset-confirm" className="text-xs font-semibold uppercase tracking-widest text-rose-800/60">
								Type "RESET" to confirm
							</label>
							<Input
								id="reset-confirm"
								value={resetConfirmText}
								onChange={(e) => onResetConfirmTextChange(e.target.value)}
								placeholder="RESET"
								className="h-9 border-rose-200 focus:ring-rose-500 font-semibold uppercase text-center"
							/>
						</div>
					</div>

					<DialogFooter className="mt-2">
						<div className="flex w-full items-center justify-between">
							<p className="text-xs font-bold text-muted-foreground italic uppercase">Requires live connection</p>
							<div className="flex justify-end gap-2 pt-2">
								<Button variant="ghost" size="sm" onClick={() => { onResetDialogOpenChange(false); onResetConfirmTextChange(''); }}>
									Cancel
								</Button>
								<Button
									variant="destructive"
									size="sm"
									disabled={!canRunGlobalReset || resetLoading || resetConfirmText.trim().toUpperCase() !== 'RESET'}
									onClick={onResetConfirm}
								>
									{resetLoading ? 'Resetting...' : 'Confirm Reset'}
								</Button>
							</div>
						</div>
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
