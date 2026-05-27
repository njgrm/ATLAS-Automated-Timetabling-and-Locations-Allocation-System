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
	swapCandidate: {
		subjectId: number;
		sectionId: number;
		fromFacultyId: number;
		toFacultyId?: number | null;
		subjectName?: string;
		subjectCode?: string;
		sectionName?: string;
		fromFacultyName?: string;
		toFacultyName?: string;
	} | null;
	onSwapCandidateChange: (candidate: {
		subjectId: number;
		sectionId: number;
		fromFacultyId: number;
		toFacultyId?: number | null;
		subjectName?: string;
		subjectCode?: string;
		sectionName?: string;
		fromFacultyName?: string;
		toFacultyName?: string;
	} | null) => void;
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
				title="Transfer Section Ownership?"
				description={
					swapCandidate ? (
						<div className="space-y-1 text-sm">
							<div className="flex gap-2">
								<span className="font-semibold text-muted-foreground uppercase tracking-wide text-xs w-16 shrink-0 pt-0.5">Subject</span>
								<span className="font-bold">
									{swapCandidate.subjectCode && swapCandidate.subjectName
										? `${swapCandidate.subjectCode} — ${swapCandidate.subjectName}`
										: (swapCandidate.subjectName ?? '(unknown)')}
								</span>
							</div>
							<div className="flex gap-2">
								<span className="font-semibold text-muted-foreground uppercase tracking-wide text-xs w-16 shrink-0 pt-0.5">Section</span>
								<span className="font-bold">{swapCandidate.sectionName ?? '(unknown)'}</span>
							</div>
							<div className="flex gap-2">
								<span className="font-semibold text-muted-foreground uppercase tracking-wide text-xs w-16 shrink-0 pt-0.5">From</span>
								<span className="font-bold text-rose-700">{swapCandidate.fromFacultyName ?? 'current owner'}</span>
							</div>
							<div className="flex gap-2">
								<span className="font-semibold text-muted-foreground uppercase tracking-wide text-xs w-16 shrink-0 pt-0.5">To</span>
								<span className="font-bold text-emerald-700">{swapCandidate.toFacultyName ?? 'currently selected teacher'}</span>
							</div>
							<p className="text-xs text-muted-foreground pt-2 border-t border-border/30">This change is in draft mode and must be saved to persist.</p>
						</div>
					) : ''
				}
				onConfirm={onSwapConfirm}
				confirmText="Transfer"
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
		</>
	);
}
