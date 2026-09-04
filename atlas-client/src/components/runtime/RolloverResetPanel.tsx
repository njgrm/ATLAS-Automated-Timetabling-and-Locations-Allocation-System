import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
	applyRolloverSync,
	fetchRolloverStatus,
	previewRolloverSync,
	resetDummyRolloverYear,
	type RolloverDummyYearResetResult,
	type RolloverStatus,
} from '@/lib/settings';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/ui/accordion';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Checkbox } from '@/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Label } from '@/ui/label';
import { cn } from '@/lib/utils';

const DUMMY_YEAR_RESET_CONFIRMATION_TEXT = ['RESET', 'DUMMY', 'SCHOOL', 'YEAR', '1'].join('_');

/**
 * `RolloverResetPanel` -- the destructive test-data reset flow, admin-only.
 *
 * RR-09B: the reset is demoted to an "Advanced: clear disposable test data"
 * disclosure inside the year-setup page. It is visible only when the server
 * classifies the current year as resettable dummy-shaped data
 * (`canResetDummyYear`), never as the primary path for real-data rollover
 * conflicts (those lead with the non-destructive Archive and sync flow in
 * `RolloverGuidanceCard`). When archive-and-sync resolves the state, the
 * disclosure hides. The confirmation stays a two-step checkbox + "Yes, erase
 * and sync" button (Phase 0B.2 Decision 1).
 */
type RolloverResetPanelProps = {
	schoolId?: number;
	onApplied?: (status: RolloverStatus) => void;
	onStatus?: (status: RolloverStatus) => void;
};

type ResetRowCount = { label: string; value: number };

function resetCountRows(result: RolloverDummyYearResetResult | null): ResetRowCount[] {
	const counts = result?.reset.counts;
	if (!counts) return [];
	return [
		{ label: 'Sections', value: counts.sectionMirrors },
		{ label: 'Generated timetables', value: counts.generationRuns },
		{ label: 'Teaching Load assignments', value: counts.teachingLoadOwnerships },
		{ label: 'Teacher load rows', value: counts.teachingLoadFacultySubjects },
		{ label: 'Policies', value: counts.schedulingPolicies },
		{ label: 'Notes and flags', value: counts.followUpFlags },
		{ label: 'Draft locks', value: counts.lockedSessions },
		{ label: 'Cohorts', value: counts.instructionalCohorts },
		{ label: 'Audit log entries', value: counts.auditLogs },
	].filter((row) => row.value > 0);
}

export function RolloverResetPanel({ schoolId = 1, onApplied, onStatus }: RolloverResetPanelProps) {
	const [status, setStatus] = useState<RolloverStatus | null>(null);
	const [loading, setLoading] = useState(true);
	const [previewing, setPreviewing] = useState(false);
	const [applying, setApplying] = useState(false);
	const [resetOpen, setResetOpen] = useState(false);
	const [resetting, setResetting] = useState(false);
	const [showResetCounts, setShowResetCounts] = useState(false);
	const [resetPreview, setResetPreview] = useState<RolloverDummyYearResetResult | null>(null);
	const [confirmAcknowledged, setConfirmAcknowledged] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const loadStatus = async (includeCounts = false) => {
		setLoading(true);
		setError(null);
		try {
			const next = await fetchRolloverStatus(schoolId, includeCounts);
			setStatus(next);
			onStatus?.(next);
		} catch (err: any) {
			setError(err?.response?.data?.message ?? err?.message ?? 'ATLAS could not check the EnrollPro school year.');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadStatus(true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [schoolId]);

	const canApply = status?.drift.recommendedAction === 'RUN_ROLLOVER_SYNC' && status.conflicts.length === 0;
	// RR-09B: the destructive reset is offered ONLY for dummy-shaped data the
	// server classifies as resettable. Real-data rollover conflicts lead with
	// Archive and sync (RolloverGuidanceCard), never this panel.
	const canPreviewReset = status?.canResetDummyYear === true;
	const isBlocking = status?.drift.status === 'atlas-stale' || status?.drift.status === 'mapping-conflict';
	const icon = useMemo(() => {
		if (status?.drift.status === 'aligned') return <CheckCircle2 className="h-4 w-4" />;
		if (loading) return <Loader2 className="h-4 w-4 animate-spin" />;
		return <AlertTriangle className="h-4 w-4" />;
	}, [loading, status?.drift.status]);

	const resetBlocked = Boolean(resetPreview?.reset.publishedResetBlocked || resetPreview?.reset.blockers.length);
	const resetRows = resetCountRows(resetPreview);

	const handlePreviewRollover = async () => {
		setPreviewing(true);
		setError(null);
		try {
			const next = await previewRolloverSync(schoolId);
			setStatus(next);
			onStatus?.(next);
		} catch (err: any) {
			setError(err?.response?.data?.message ?? err?.message ?? 'ATLAS could not preview the EnrollPro rollover.');
		} finally {
			setPreviewing(false);
		}
	};

	const handleApplyRollover = async () => {
		setApplying(true);
		setError(null);
		try {
			const result = await applyRolloverSync(schoolId);
			setStatus(result);
			onStatus?.(result);
			onApplied?.(result);
			toast.success(`Synced ${result.enrollProActiveYear?.yearLabel ?? 'the active school year'} from EnrollPro.`);
		} catch (err: any) {
			const message = err?.response?.data?.message ?? err?.message ?? 'ATLAS could not sync the new school year.';
			setError(message);
			toast.error(message);
		} finally {
			setApplying(false);
		}
	};

	const handlePreviewReset = async () => {
		setResetting(true);
		setError(null);
		try {
			const result = await resetDummyRolloverYear(schoolId, { confirmReset: false });
			setResetPreview(result);
			setConfirmAcknowledged(false);
			setShowResetCounts(false);
			setResetOpen(true);
		} catch (err: any) {
			const message = err?.response?.data?.message ?? err?.message ?? 'ATLAS could not preview the test-data reset.';
			setError(message);
			toast.error(message);
		} finally {
			setResetting(false);
		}
	};

	const handleResetAndSync = async () => {
		setResetting(true);
		setError(null);
		try {
			const result = await resetDummyRolloverYear(schoolId, { confirmReset: true, confirmationText: DUMMY_YEAR_RESET_CONFIRMATION_TEXT });
			setResetPreview(result);
			setStatus(result);
			onStatus?.(result);
			onApplied?.(result);
			setResetOpen(false);
			toast.success(`Cleared disposable test data and synced ${result.enrollProActiveYear?.yearLabel ?? 'the active school year'} from EnrollPro.`);
		} catch (err: any) {
			const message = err?.response?.data?.message ?? err?.response?.data?.actionHint ?? err?.message ?? 'ATLAS could not clear the disposable test data.';
			setError(message);
			toast.error(message);
		} finally {
			setResetting(false);
		}
	};

	if (!loading && !status && !error) return null;

	return (
		<>
			<Card className={cn('border-dashed shadow-none', isBlocking ? 'border-amber-200 bg-amber-50/70' : 'border-slate-200 bg-white/80')} data-testid="rollover-reset-panel">
				<CardContent className="space-y-4 p-4">
					<div className="space-y-2">
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-700" data-testid="rollover-reset-status">
								{icon}
								{loading ? 'Checking school year' : 'Year setup'}
							</Badge>
							{status?.enrollProActiveYear ? (
								<Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
									EnrollPro {status.enrollProActiveYear.yearLabel}
								</Badge>
							) : null}
						</div>
						<p className="text-sm font-medium text-slate-900">
							{status?.drift.message ?? 'Checking EnrollPro school year status.'}
						</p>
						<p className="text-xs text-slate-600">
							This page is for IT admins only. Use Archive and sync to move the old school year to read-only history and sync the new one from EnrollPro. Nothing on this page changes EnrollPro.
						</p>
						{error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
						{status?.conflicts?.length ? (
							<ul className="space-y-1 text-xs text-red-700">
								{status.conflicts.slice(0, 3).map((conflict) => (
									<li key={conflict.code}>{conflict.message}</li>
								))}
							</ul>
						) : null}
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<Button type="button" variant="outline" size="sm" onClick={() => void handlePreviewRollover()} disabled={previewing || applying || resetting}>
							{previewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
							Preview rollover
						</Button>
						{canApply && !canPreviewReset ? (
							<Button type="button" size="sm" onClick={() => void handleApplyRollover()} disabled={previewing || applying || resetting} data-testid="rollover-reset-sync">
								{applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
								Sync from EnrollPro
							</Button>
						) : null}
					</div>

					{canPreviewReset ? (
						<Accordion type="single" collapsible data-testid="rollover-reset-advanced">
							<AccordionItem value="advanced-reset" className="border-0">
								<AccordionTrigger className="py-2 text-left text-xs font-semibold text-slate-600 hover:no-underline">
									Advanced: clear disposable test data
								</AccordionTrigger>
								<AccordionContent className="space-y-2 pt-1 text-xs text-slate-600">
									<p>
										Only for genuinely disposable test data (dummy years used for testing). Real school-year history must be archived, not cleared. This reset erases ATLAS data for the active EnrollPro school year, then syncs the new year. It cannot be undone.
									</p>
									<Button type="button" variant="destructive" size="sm" onClick={() => void handlePreviewReset()} disabled={previewing || applying || resetting} data-testid="rollover-reset-preview">
										{resetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
										Clear disposable test data
									</Button>
								</AccordionContent>
							</AccordionItem>
						</Accordion>
					) : null}
				</CardContent>
			</Card>

			<Dialog open={resetOpen} onOpenChange={setResetOpen}>
				<DialogContent className="sm:max-w-2xl" data-testid="rollover-reset-dialog">
					<DialogHeader>
						<DialogTitle>Erase ATLAS disposable test data and sync the new school year</DialogTitle>
						<DialogDescription>
							This clears ATLAS disposable test data for the active EnrollPro school year, then syncs the new year from EnrollPro. This only affects ATLAS -- it does not change EnrollPro. Real school-year history should be archived instead.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
							<p className="font-semibold">Teaching Load will be cleared and must be rebuilt before timetable generation.</p>
							<p>This action cannot be undone.</p>
						</div>
						{resetRows.length > 0 ? (
							<div>
								<Button type="button" variant="ghost" size="sm" onClick={() => setShowResetCounts((show) => !show)} aria-expanded={showResetCounts} aria-controls="rollover-reset-counts">
									{showResetCounts ? 'Hide what will be erased' : 'Show what will be erased'}
								</Button>
								{showResetCounts ? (
									<div id="rollover-reset-counts" className="mt-2 grid gap-2 sm:grid-cols-2" data-testid="rollover-reset-counts">
										{resetRows.map((row) => (
											<div key={row.label} className="rounded-xl border bg-white p-3">
												<p className="text-xs text-slate-500">{row.label}</p>
												<p className="text-lg font-semibold text-slate-900">{row.value}</p>
											</div>
										))}
									</div>
								) : null}
							</div>
						) : (
							<p className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-600">No disposable test-data records were found for reset.</p>
						)}
						{resetPreview?.reset.blockers.length ? (
							<div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
								<p className="font-semibold">Reset is blocked</p>
								<ul className="mt-1 list-disc space-y-1 pl-5">
									{resetPreview.reset.blockers.map((blocker) => (
										<li key={blocker.code}>{blocker.message}</li>
									))}
								</ul>
							</div>
						) : null}
						<div className="flex items-start gap-2">
							<Checkbox
								id="rollover-reset-confirm"
								checked={confirmAcknowledged}
								onCheckedChange={(checked) => setConfirmAcknowledged(checked === true)}
								disabled={resetBlocked || resetting}
								data-testid="rollover-reset-confirm"
							/>
							<Label htmlFor="rollover-reset-confirm" className="text-sm leading-relaxed text-slate-700">
								I understand this will erase ATLAS disposable test data, including teachers, classes, and timetables set up for the old school year.
							</Label>
						</div>
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setResetOpen(false)} disabled={resetting} data-testid="rollover-reset-cancel">
							Cancel
						</Button>
						<Button
							type="button"
							variant="destructive"
							onClick={() => void handleResetAndSync()}
							disabled={resetBlocked || !confirmAcknowledged || resetting}
							data-testid="rollover-reset-confirm-button"
						>
							{resetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
							Yes, erase and sync
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
