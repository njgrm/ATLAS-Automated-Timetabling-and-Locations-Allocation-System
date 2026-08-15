import { AlertTriangle, CheckCircle2, Info, Layers, Loader2, XCircle } from 'lucide-react';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/ui/dialog';
import { buildLockRecoverySummary } from '@/lib/teaching-load-lock-helpers';
import type { TeachingLoadSplitBrainReconcileResult } from '@/types';

type TeachingLoadLockRecoveryDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	splitBrainIncident: TeachingLoadSplitBrainReconcileResult | null;
	loading: boolean;
	enabled: boolean;
	disabledReason?: string | null;
	error?: string | null;
	onConfirm: () => void;
};

export function TeachingLoadLockRecoveryDialog({
	open,
	onOpenChange,
	splitBrainIncident,
	loading,
	enabled,
	disabledReason,
	error,
	onConfirm,
}: TeachingLoadLockRecoveryDialogProps) {
	const summary = buildLockRecoverySummary(splitBrainIncident);
	const hasStale = summary.staleOwnershipCount > 0;
	const hasLoadReview = summary.loadReviewRows > 0;
	const quarantine = splitBrainIncident?.quarantine;

	return (
		<Dialog open={open} onOpenChange={(nextOpen) => {
			// Prevent closing while reconcile is running.
			if (loading && !nextOpen) return;
			onOpenChange(nextOpen);
		}}>
			<DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-lg font-bold">
						<Layers className="size-5 text-primary" />
						Review and unlock Teaching Load editing
					</DialogTitle>
					<DialogDescription className="text-sm text-muted-foreground">
						ATLAS found saved Teaching Load links that no longer match the current EnrollPro roster/setup. Review the cleanup before editing.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2">
					{/* Error banner */}
					{error && (
						<div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive" data-testid="lock-recovery-error">
							<AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
							<span>{error}</span>
						</div>
					)}

					{/* Counts */}
					<div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-2">
						<p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">What ATLAS found</p>
						<div className="grid grid-cols-2 gap-2 text-sm">
							{summary.staleOwnershipCount > 0 && (
								<div className="flex items-center gap-2">
									<Badge variant="outline" className="h-5 text-[0.65rem] font-bold border-amber-200 bg-amber-50 text-amber-700">{summary.staleOwnershipCount}</Badge>
									<span className="text-muted-foreground">stale ownership links</span>
								</div>
							)}
							{summary.loadReviewRows > 0 && (
								<div className="flex items-center gap-2">
									<Badge variant="outline" className="h-5 text-[0.65rem] font-bold border-orange-200 bg-orange-50 text-orange-700">{summary.loadReviewRows}</Badge>
									<span className="text-muted-foreground">load review rows</span>
								</div>
							)}
							{summary.missingOwnershipPairs > 0 && (
								<div className="flex items-center gap-2">
									<Badge variant="outline" className="h-5 text-[0.65rem] font-bold border-blue-200 bg-blue-50 text-blue-700">{summary.missingOwnershipPairs}</Badge>
									<span className="text-muted-foreground">missing ownership</span>
								</div>
							)}
							{summary.ownershipWithoutScopePairs > 0 && (
								<div className="flex items-center gap-2">
									<Badge variant="outline" className="h-5 text-[0.65rem] font-bold border-violet-200 bg-violet-50 text-violet-700">{summary.ownershipWithoutScopePairs}</Badge>
									<span className="text-muted-foreground">ownership without scope</span>
								</div>
							)}
							{summary.outOfSubjectScopePairs > 0 && (
								<div className="flex items-center gap-2">
									<Badge variant="outline" className="h-5 text-[0.65rem] font-bold border-rose-200 bg-rose-50 text-rose-700">{summary.outOfSubjectScopePairs}</Badge>
									<span className="text-muted-foreground">out-of-subject-scope</span>
								</div>
							)}
							{summary.rowsReconcilable > 0 && (
								<div className="flex items-center gap-2">
									<Badge variant="outline" className="h-5 text-[0.65rem] font-bold border-emerald-200 bg-emerald-50 text-emerald-700">{summary.rowsReconcilable}</Badge>
									<span className="text-muted-foreground">rows ATLAS can reconcile</span>
								</div>
							)}
							{summary.rowsNotAutomatic > 0 && (
								<div className="flex items-center gap-2">
									<Badge variant="outline" className="h-5 text-[0.65rem] font-bold border-slate-200 bg-slate-50 text-slate-600">{summary.rowsNotAutomatic}</Badge>
									<span className="text-muted-foreground">rows need manual review</span>
								</div>
							)}
						</div>
					</div>

					{/* Quarantine reason */}
					{quarantine?.message && (
						<div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
							<AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
							<span>{quarantine.message}</span>
						</div>
					)}

					{/* What ATLAS will do */}
					<div className="space-y-2">
						<p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">What ATLAS will do</p>
						<ul className="space-y-1.5 text-sm text-foreground">
							{hasStale && (
								<li className="flex items-start gap-2">
									<CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
									<span>Remove stale current-year ownership links from inactive/stale faculty mirrors.</span>
								</li>
							)}
							{(summary.missingOwnershipPairs > 0 || summary.ownershipWithoutScopePairs > 0) && (
								<li className="flex items-start gap-2">
									<CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
									<span>Reconcile ownership integrity issues in saved assignments.</span>
								</li>
							)}
							{summary.rowsReconcilable > 0 && (
								<li className="flex items-start gap-2">
									<CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
									<span>Update affected Teaching Load rows after cleanup.</span>
								</li>
							)}
							<li className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
								<span>Refresh the Teaching Load workspace so you can continue editing.</span>
							</li>
						</ul>
					</div>

					{/* What ATLAS will not do */}
					<div className="space-y-2">
						<p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">What ATLAS will not do</p>
						<ul className="space-y-1.5 text-sm text-muted-foreground">
							<li className="flex items-start gap-2">
								<XCircle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
								<span>Create a final timetable or publish anything.</span>
							</li>
							<li className="flex items-start gap-2">
								<XCircle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
								<span>Write back to EnrollPro.</span>
							</li>
							<li className="flex items-start gap-2">
								<XCircle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
								<span>Silently assign teachers without your review.</span>
							</li>
						</ul>
					</div>

					{/* Warnings */}
					{hasStale && (
						<div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
							<Info className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
							<span>This may remove old dummy/stale teacher links for the current school year.</span>
						</div>
					)}
					{hasLoadReview && (
						<div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
							<Info className="mt-0.5 size-3.5 shrink-0 text-orange-600" />
							<span>Some teachers still need workload review after unlocking.</span>
						</div>
					)}
				</div>

				<DialogFooter className="gap-2 sm:gap-0">
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
						{error ? 'Close' : 'Cancel'}
					</Button>
					{!error && (
						<Button
							onClick={onConfirm}
							disabled={loading || !enabled}
							className="gap-2 font-semibold"
						>
							{loading ? (
								<>
									<Loader2 className="size-4 animate-spin" />
									Unlocking...
								</>
							) : (
								<>
									<Layers className="size-4" />
									Unlock Teaching Load editing
								</>
							)}
						</Button>
					)}
					{error && (
						<Button
							onClick={onConfirm}
							disabled={loading || !enabled}
							className="gap-2 font-semibold"
						>
							<Layers className="size-4" />
							Try again
						</Button>
					)}
					{!enabled && disabledReason && (
						<p className="w-full mt-2 text-xs text-muted-foreground text-right">{disabledReason}</p>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
