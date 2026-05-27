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
	swapCandidate: { subjectId: number; sectionId: number; fromFacultyId: number } | null;
	onSwapCandidateChange: (candidate: { subjectId: number; sectionId: number; fromFacultyId: number } | null) => void;
	onSwapConfirm: () => void;
	summaryModalOpen: boolean;
	onSummaryModalOpenChange: (open: boolean) => void;
	autoFillResult: AutoFillSummaryResult | null;
	resetDialogOpen: boolean;
	onResetDialogOpenChange: (open: boolean) => void;
	canRunGlobalReset: boolean;
	resetLoading: boolean;
	resetConfirmText: string;
	onResetConfirmTextChange: (text: string) => void;
	onResetConfirm: () => void;
};

export function TeachingLoadModals({
	autoFillDialogOpen,
	onAutoFillDialogOpenChange,
	coverageModeConfig,
	onAutoFillConfirm,
	autoFillLoading,
	swapCandidate,
	onSwapCandidateChange,
	onSwapConfirm,
	summaryModalOpen,
	onSummaryModalOpenChange,
	autoFillResult,
	resetDialogOpen,
	onResetDialogOpenChange,
	canRunGlobalReset,
	resetLoading,
	resetConfirmText,
	onResetConfirmTextChange,
	onResetConfirm,
}: TeachingLoadModalsProps) {
	return (
		<>
			<ConfirmationModal
				open={autoFillDialogOpen}
				onOpenChange={onAutoFillDialogOpenChange}
				title="Auto-Fill Remaining Assignments?"
				description={`Coverage mode: ${coverageModeConfig.label}. ${coverageModeConfig.description}`}
				onConfirm={onAutoFillConfirm}
				confirmText="Run Auto-Fill"
				variant="primary"
				loading={autoFillLoading}
			/>

			<ConfirmationModal
				open={Boolean(swapCandidate)}
				onOpenChange={(open) => {
					if (!open) onSwapCandidateChange(null);
				}}
				title="Swap Section Ownership?"
				description="This will move the selected subject-section from the current owner to the selected teacher in draft mode."
				onConfirm={onSwapConfirm}
				confirmText="Swap"
				variant="primary"
			/>

			<AutoFillSummaryModal
				open={summaryModalOpen}
				onOpenChange={onSummaryModalOpenChange}
				result={autoFillResult}
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
							You will need to run Auto-Fill or re-assign sections manually.
						</p>
						<div className="space-y-2">
							<label htmlFor="reset-confirm" className="text-[0.65rem] font-black uppercase tracking-widest text-rose-800/60">
								Type "RESET" to confirm
							</label>
							<Input
								id="reset-confirm"
								value={resetConfirmText}
								onChange={(e) => onResetConfirmTextChange(e.target.value)}
								placeholder="RESET"
								className="h-9 border-rose-200 focus:ring-rose-500 font-black uppercase text-center"
							/>
						</div>
					</div>

					<DialogFooter className="mt-2">
						<div className="flex w-full items-center justify-between">
							<p className="text-[0.6rem] font-bold text-muted-foreground italic uppercase">Requires live connection</p>
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
		</>
	);
}
