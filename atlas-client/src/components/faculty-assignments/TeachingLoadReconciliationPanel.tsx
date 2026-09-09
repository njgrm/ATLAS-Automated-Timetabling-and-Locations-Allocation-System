import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import atlasApi from '@/lib/api';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Badge } from '@/ui/badge';
import { Separator } from '@/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/ui/sheet';
import { ScrollArea } from '@/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/ui/accordion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import {
	deriveReconciliationSummaries,
	formatStatusLabel,
	formatTeachingMinutes,
	readinessChipState,
	reconciliationActionLabel,
	reconciliationApplyDisabledReason,
} from '@/lib/teaching-load-reconciliation-helpers';
import type {
	TeachingLoadReconciliationPreview,
	TeachingLoadReconciliationReadiness,
} from '@/types';

type ReconciliationPanelProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	schoolId: number | null;
	schoolYearId: number | null;
	online: boolean;
	writable: boolean;
	readiness: TeachingLoadReconciliationReadiness | null;
	readinessLoading: boolean;
	onApplied: () => void;
};

const ACTION_TONE: Record<string, string> = {
	RETAIN: 'bg-emerald-50 text-emerald-700 border-emerald-200',
	INSERT: 'bg-sky-50 text-sky-700 border-sky-200',
	MOVE: 'bg-amber-50 text-amber-700 border-amber-200',
	RETIRE: 'bg-rose-50 text-rose-700 border-rose-200',
	UNRESOLVED: 'bg-slate-100 text-slate-700 border-slate-300',
};

export function TeachingLoadReconciliationPanel({
	open,
	onOpenChange,
	schoolId,
	schoolYearId,
	online,
	writable,
	readiness,
	readinessLoading,
	onApplied,
}: ReconciliationPanelProps) {
	const [preview, setPreview] = useState<TeachingLoadReconciliationPreview | null>(null);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [previewError, setPreviewError] = useState<string | null>(null);
	const [applyLoading, setApplyLoading] = useState(false);
	const [confirmation, setConfirmation] = useState('');
	const [applied, setApplied] = useState(false);

	const canPreview = Boolean(schoolId && schoolYearId && online);

	const summaries = useMemo(() => (preview ? deriveReconciliationSummaries(preview) : null), [preview]);

	useEffect(() => {
		if (open) {
			setPreview(null);
			setPreviewError(null);
			setApplied(false);
			setConfirmation('');
		}
	}, [open]);

	const handlePreview = useCallback(async () => {
		if (!schoolId || !schoolYearId) return;
		setPreviewLoading(true);
		setPreviewError(null);
		setApplied(false);
		setConfirmation('');
		try {
			const { data } = await atlasApi.post<TeachingLoadReconciliationPreview>(
				'/faculty-assignments/reconciliation/preview',
				{ schoolId, schoolYearId },
			);
			setPreview(data);
		} catch (error: any) {
			const message = error?.response?.data?.message ?? 'ATLAS could not prepare the reconciliation preview. Refresh and retry.';
			setPreviewError(message);
			toast.error(message);
		} finally {
			setPreviewLoading(false);
		}
	}, [schoolId, schoolYearId]);

	const applyDisabledReason = useMemo(
		() =>
			reconciliationApplyDisabledReason({
				preview,
				applyDisabled: applied,
				applyLoading,
				confirmation,
				online,
				writable,
			}),
		[preview, applied, applyLoading, confirmation, online, writable],
	);

	const handleApply = useCallback(async () => {
		if (!preview || applyDisabledReason) {
			if (applyDisabledReason) toast.error(applyDisabledReason);
			return;
		}
		if (!schoolId || !schoolYearId) return;
		setApplyLoading(true);
		const toastId = toast.loading('Applying the Teaching Load reconciliation…');
		try {
			await atlasApi.post('/faculty-assignments/reconciliation/apply', {
				schoolId,
				schoolYearId,
				expectedFingerprint: preview.fingerprint,
				expectedSourceRevision: preview.sourceRevision,
				confirmationText: confirmation,
			});
			setApplied(true);
			toast.success('Teaching Load reconciliation applied. Review the saved load before creating the timetable.', { id: toastId });
			onApplied();
		} catch (error: any) {
			const code = error?.response?.data?.code;
			const message = error?.response?.data?.message ?? 'ATLAS could not apply the reconciliation. Re-run the preview and retry.';
			setPreviewError(code === 'SOURCE_DRIFT' || code === 'FINGERPRINT_MISMATCH' || code === 'TRANSACTION_CONFLICT'
				? `${message} Re-run the preview to get a fresh plan.`
				: message);
			toast.error(message, { id: toastId });
		} finally {
			setApplyLoading(false);
		}
	}, [preview, applyDisabledReason, schoolId, schoolYearId, confirmation, onApplied]);

	const readinessChip = readinessChipState(readiness, readinessLoading);
	const unresolvedEntries = preview?.actions.filter((entry) => entry.action === 'UNRESOLVED') ?? [];

	return (
		<TooltipProvider delayDuration={200}>
			<Sheet open={open} onOpenChange={onOpenChange}>
				<SheetContent side="right" className="w-full sm:max-w-lg overflow-hidden" data-testid="teaching-load-reconciliation-panel">
					<SheetHeader className="border-b border-border/40 pb-3">
						<SheetTitle className="text-base font-bold">Reconcile Teaching Load</SheetTitle>
						<SheetDescription>
							Compare the active-year curriculum demand with current teaching load and preview exactly what changes. Nothing is applied unless you confirm it.
						</SheetDescription>
					</SheetHeader>

					<ScrollArea className="flex-1 min-h-0">
						<div className="space-y-4 p-4">
							<div className="flex flex-wrap items-center gap-2">
								<Badge
									variant="outline"
									data-testid="teaching-load-reconciliation-readiness"
									className={readinessChip.tone === 'ok' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : readinessChip.tone === 'warn' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}
								>
									{readinessChip.label}
								</Badge>
								{preview && (
									<Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
										Demand {preview.before.demandCount} pairs
									</Badge>
								)}
							</div>

							<Button
								type="button"
								onClick={handlePreview}
								disabled={previewLoading || !canPreview}
								className="h-11 w-full gap-2 font-bold"
								data-testid="teaching-load-reconciliation-preview"
							>
								{previewLoading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
								{preview ? 'Re-run reconciliation preview' : 'Preview reconciliation'}
							</Button>

							{!online && (
								<div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
									Offline: reconciliation is read-only. Reconnect to preview or apply.
								</div>
							)}

							{previewError && (
								<div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" data-testid="teaching-load-reconciliation-error">
									<AlertTriangle className="mt-0.5 size-4 shrink-0" />
									<span>{previewError}</span>
								</div>
							)}

							{previewLoading && (
								<div className="rounded-md border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
									<Loader2 className="mx-auto mb-2 size-5 animate-spin" />
									Building the canonical demand graph and reconciliation plan…
								</div>
							)}

							{preview && summaries && (
								<div className="space-y-4" data-testid="teaching-load-reconciliation-summary">
									<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
										{(['RETAIN', 'INSERT', 'MOVE', 'RETIRE', 'UNRESOLVED'] as const).map((action) => (
											<div key={action} className={`rounded-md border px-3 py-2 ${ACTION_TONE[action]}`} data-testid={`tl-recon-${action.toLowerCase()}`}>
												<div className="text-xl font-bold leading-none">{summaries.actionCounts[action]}</div>
												<div className="mt-1 text-xs font-medium">{reconciliationActionLabel(action)}</div>
											</div>
										))}
									</div>

									{preview.hgRows.found > 0 && (
										<div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" data-testid="tl-recon-hg">
											Homeroom Guidance rows found: {preview.hgRows.found}. Homeroom Guidance is never Teaching Load demand — these rows are proposed for removal.
										</div>
									)}

									{summaries.departmentState.status === 'EMPTY' && preview.actionTotals.UNRESOLVED > 0 && (
										<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" data-testid="tl-recon-unmapped">
											Departments are <strong>UNMAPPED</strong> (no department labels are configured). Pairs that need a department match remain unresolved until department authority is reviewed separately.
										</div>
									)}

									<div>
										<div className="mb-2 flex items-center justify-between">
											<h4 className="text-sm font-semibold">Workload before → after</h4>
											<span className="text-xs text-muted-foreground">actual teaching only</span>
										</div>
										<div className="grid grid-cols-2 gap-2 text-sm">
											<div className="rounded-md border border-border/60 p-2">
												<div className="text-xs font-medium text-muted-foreground">Before</div>
												<div className="mt-1 space-y-0.5">
													<div>Zero load: <strong>{summaries.before.zeroLoad}</strong></div>
													<div>Adviser only: <strong>{summaries.before.adviserOnly}</strong></div>
													<div>Below standard: <strong>{summaries.before.belowStandard}</strong></div>
													<div>At standard: <strong>{summaries.before.atStandard}</strong></div>
													<div className="text-amber-700">Excess teaching: <strong>{summaries.before.excess}</strong></div>
													<div className="text-rose-700">Over hard cap: <strong>{summaries.before.overCap}</strong></div>
												</div>
											</div>
											<div className="rounded-md border border-border/60 p-2">
												<div className="text-xs font-medium text-muted-foreground">After</div>
												<div className="mt-1 space-y-0.5">
													<div>Zero load: <strong>{summaries.after.zeroLoad}</strong></div>
													<div>Adviser only: <strong>{summaries.after.adviserOnly}</strong></div>
													<div>Below standard: <strong>{summaries.after.belowStandard}</strong></div>
													<div>At standard: <strong>{summaries.after.atStandard}</strong></div>
													<div className="text-amber-700">Excess teaching: <strong>{summaries.after.excess}</strong></div>
													<div className="text-rose-700">Over hard cap: <strong>{summaries.after.overCap}</strong></div>
												</div>
											</div>
										</div>
									</div>

									<Accordion type="single" collapsible className="w-full">
										<AccordionItem value="changes">
											<AccordionTrigger className="text-sm font-semibold">Every proposed change ({preview.actions.length})</AccordionTrigger>
											<AccordionContent>
												<div className="space-y-1.5">
													{preview.actions.map((entry, index) => (
														<div key={`${entry.subjectId}-${entry.sectionId}-${index}`} className="rounded-md border border-border/60 p-2 text-xs">
															<div className="flex items-center gap-2">
																<Badge variant="outline" className={ACTION_TONE[entry.action]}>{reconciliationActionLabel(entry.action)}</Badge>
																<span className="font-semibold">{entry.subjectCode}</span>
																<span className="text-muted-foreground">section {entry.sectionId}</span>
															</div>
															<div className="mt-1 text-muted-foreground">{entry.reason}</div>
															{entry.unresolvedReason && (
																<div className="mt-1 font-medium text-slate-700">Unresolved: {entry.unresolvedReason}</div>
															)}
															{entry.adviserPreferenceApplied && (
																<div className="mt-1 font-medium text-emerald-700">Adviser-own-section preference applied</div>
															)}
														</div>
													))}
												</div>
											</AccordionContent>
										</AccordionItem>

										<AccordionItem value="faculty">
											<AccordionTrigger className="text-sm font-semibold">Per-teacher workload</AccordionTrigger>
											<AccordionContent>
												<div className="space-y-1.5">
													{preview.perFaculty.map((row) => (
														<div key={row.facultyId} className="flex items-center justify-between rounded-md border border-border/60 p-2 text-xs">
															<span className="truncate font-medium">{row.name}</span>
															<span className="ml-2 shrink-0 text-muted-foreground">
																{formatTeachingMinutes(row.beforeMinutes)} → {formatTeachingMinutes(row.afterMinutes)}
															</span>
															<span className="ml-2 shrink-0">{formatStatusLabel(row.afterStatus, preview.workloadPolicy.status === 'CONFIGURED')}</span>
														</div>
													))}
												</div>
											</AccordionContent>
										</AccordionItem>

										{preview.adviserPreference.length > 0 && (
											<AccordionItem value="adviser">
												<AccordionTrigger className="text-sm font-semibold">
													Adviser-own-section preference ({summaries.adviserSatisfied} satisfied / {summaries.adviserUnsatisfied} not satisfied)
												</AccordionTrigger>
												<AccordionContent>
													<div className="space-y-1.5">
														{preview.adviserPreference.map((outcome) => (
															<div key={`${outcome.facultyId}-${outcome.sectionId}`} className="flex items-center gap-2 rounded-md border border-border/60 p-2 text-xs">
																{outcome.satisfied ? (
																	<CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
																) : (
																	<ShieldAlert className="size-3.5 shrink-0 text-amber-600" />
																)}
																<span className="truncate">
																	Faculty {outcome.facultyId} / section {outcome.sectionId}:{' '}
																	{outcome.satisfied ? 'has one demanded subject in the advisory section' : outcome.reason}
																</span>
															</div>
														))}
													</div>
												</AccordionContent>
											</AccordionItem>
										)}

										{unresolvedEntries.length > 0 && (
											<AccordionItem value="unresolved">
												<AccordionTrigger className="text-sm font-semibold">Unresolved pairs ({unresolvedEntries.length})</AccordionTrigger>
												<AccordionContent>
													<div className="space-y-1.5">
														{unresolvedEntries.map((entry) => (
															<div key={`${entry.subjectId}-${entry.sectionId}`} className="rounded-md border border-border/60 p-2 text-xs">
																<span className="font-semibold">{entry.subjectCode}</span> <span className="text-muted-foreground">section {entry.sectionId}</span>
																<div className="mt-0.5 text-muted-foreground">{entry.reason}</div>
															</div>
														))}
													</div>
												</AccordionContent>
											</AccordionItem>
										)}
									</Accordion>
								</div>
							)}
						</div>
					</ScrollArea>

					<div className="shrink-0 border-t border-border/40 p-4 space-y-3">
						<Separator />
						<div className="space-y-2">
							<Label htmlFor="tl-recon-confirmation" className="text-sm font-medium">
								Apply confirmation
							</Label>
							<Input
								id="tl-recon-confirmation"
								value={confirmation}
								onChange={(event) => setConfirmation(event.target.value)}
								disabled={!preview || applied || applyLoading}
								placeholder={preview?.confirmationText ?? 'Preview first to reveal the confirmation phrase'}
								data-testid="teaching-load-reconciliation-confirmation"
							/>
							<p className="text-xs text-muted-foreground">
								Applying writes the proposed Teaching Load changes. The preview fingerprint must still match — a stale preview is rejected with zero partial writes.
							</p>
						</div>
						<Button
							type="button"
							variant="destructive"
							className="h-11 w-full gap-2 font-bold"
							disabled={Boolean(applyDisabledReason)}
							onClick={handleApply}
							data-testid="teaching-load-reconciliation-apply"
						>
							{applyLoading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
							{applied ? 'Applied' : applyDisabledReason ? applyDisabledReason : 'Apply reconciliation'}
						</Button>
						{preview && (
							<p className="text-xs text-muted-foreground">
								Preview fingerprint <span className="font-mono break-all">{preview.fingerprint}</span>
							</p>
						)}
					</div>
				</SheetContent>
			</Sheet>
		</TooltipProvider>
	);
}