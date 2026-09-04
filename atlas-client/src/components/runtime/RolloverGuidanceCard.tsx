import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Archive, CheckCircle2, Loader2, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';

import {
	applyArchiveAndSync,
	applyRolloverSync,
	applyTestYearRecovery,
	fetchRecoveryClassification,
	fetchRolloverStatus,
	markSchoolYearAsTestData,
	previewArchiveAndSync,
	previewRolloverSync,
	type ArchiveAndSyncPreviewResult,
	type RecoveryClassifierResult,
	type RolloverStatus,
} from '@/lib/settings';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Checkbox } from '@/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * `RolloverGuidanceCard` -- school-year status banner.
 *
 * Phase 0B.1: this is now a *dismissible, non-destructive* banner. The
 * destructive year-reset flow lives only at `/admin/year-setup`
 * (`RolloverResetPanel`). Setup pages link to that route with "Open year
 * setup" instead of exposing the reset button inline. See
 * `docs/phases/setup-content-area-improvement-plan-2026-08-08.md` Phase 0B.
 */
type RolloverGuidanceCardProps = {
	schoolId?: number;
	compact?: boolean;
	dismissible?: boolean;
	/** Where the destructive year-setup/reset surface lives. Defaults to `/admin/year-setup`. */
	adminHref?: string;
	/** Enables the marker flow only inside the protected year-setup surface. */
	allowTestDataMarking?: boolean;
	onApplied?: (status: RolloverStatus) => void;
	onStatus?: (status: RolloverStatus) => void;
};

const DISMISS_STORAGE_PREFIX = 'atlas.rollover-banner.dismissed.';

const DRIFT_BADGE: Record<string, string> = {
	aligned: 'border-emerald-200 bg-emerald-50 text-emerald-700',
	'atlas-stale': 'border-amber-200 bg-amber-50 text-amber-700',
	'enrollpro-unreachable': 'border-slate-200 bg-slate-50 text-slate-700',
	'mapping-conflict': 'border-red-200 bg-red-50 text-red-700',
};

/** Drift status -> plain-language label. Phase 0A.1 glossary rule applies. */
function driftLabel(status: string, recommendedAction?: string): string {
	switch (status) {
		case 'aligned': return 'Year aligned';
		case 'atlas-stale': return 'New year needs setup';
		case 'mapping-conflict':
			// RR-09B: real-data rollover wedges are archive-shaped; only
			// dummy/test-shaped collisions keep the "clearing" framing.
			return recommendedAction === 'RUN_ARCHIVE_AND_SYNC'
				? 'Old school year needs archiving'
				: "Old year's data needs clearing";
		case 'enrollpro-unreachable': return "Can't reach EnrollPro right now";
		default: return 'School year check';
	}
}

/** Drift status -> plain-language next step shown in the banner body. */
function driftNextStep(status: string, recommendedAction?: string): string {
	switch (status) {
		case 'atlas-stale': return 'Open year setup to sync from EnrollPro, then review sections and Teaching Load.';
		case 'mapping-conflict':
			return recommendedAction === 'RUN_ARCHIVE_AND_SYNC'
				? 'Open year setup to archive the old school year and sync the new one from EnrollPro. History is kept.'
				: 'Open year setup to clear the old year, then sync the new school year from EnrollPro.';
		case 'enrollpro-unreachable': return 'ATLAS could not reach EnrollPro. Try again, or ask your IT admin.';
		default: return 'EnrollPro remains the source for the active school year; ATLAS keeps schedules, policies, and Teaching Load locally.';
	}
}

export function RolloverGuidanceCard({
	schoolId = 1,
	compact = false,
	dismissible = true,
	adminHref = '/admin/year-setup',
	allowTestDataMarking = false,
	onApplied,
	onStatus,
}: RolloverGuidanceCardProps) {
	const [status, setStatus] = useState<RolloverStatus | null>(null);
	const [loading, setLoading] = useState(true);
	const [previewing, setPreviewing] = useState(false);
	const [applying, setApplying] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [dismissedKey, setDismissedKey] = useState<string | null>(null);
	const [pendingReconfiguredIds, setPendingReconfiguredIds] = useState<number[] | null>(null);
	const [recoveryClassification, setRecoveryClassification] = useState<RecoveryClassifierResult | null>(null);
	const [showRecoveryConfirm, setShowRecoveryConfirm] = useState(false);
	const [recoveryConfirmText, setRecoveryConfirmText] = useState('');
	const [recoveryAckPublished, setRecoveryAckPublished] = useState(false);
	const [recovering, setRecovering] = useState(false);
	const [showMarkTestDataConfirm, setShowMarkTestDataConfirm] = useState(false);
	const [markTestDataAcknowledged, setMarkTestDataAcknowledged] = useState(false);
	const [markingTestData, setMarkingTestData] = useState(false);
	const [archivePreview, setArchivePreview] = useState<ArchiveAndSyncPreviewResult | null>(null);
	const [archivePreviewLoading, setArchivePreviewLoading] = useState(false);
	const [archiving, setArchiving] = useState(false);

	const loadStatus = async (includeCounts = false) => {
		setLoading(true);
		setError(null);
		try {
			const next = await fetchRolloverStatus(schoolId, includeCounts);
			setStatus(next);
			onStatus?.(next);
			if (next.drift.status === 'mapping-conflict') {
				try {
					const classification = await fetchRecoveryClassification(schoolId);
					setRecoveryClassification(classification);
				} catch {
					setRecoveryClassification(null);
				}
			} else {
				setRecoveryClassification(null);
			}
			// RR-09B: on the protected year-setup surface, load the archive
			// preview whenever the drift is archive-resolvable so the primary
			// action is informed, non-destructive, and one click.
			if (allowTestDataMarking && next.drift.recommendedAction === 'RUN_ARCHIVE_AND_SYNC') {
				setArchivePreviewLoading(true);
				try {
					setArchivePreview(await previewArchiveAndSync(schoolId));
				} catch {
					setArchivePreview(null);
				} finally {
					setArchivePreviewLoading(false);
				}
			} else {
				setArchivePreview(null);
			}
		} catch (err: any) {
			setError(err?.response?.data?.message ?? err?.message ?? 'ATLAS could not check the EnrollPro school year.');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadStatus(false);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [schoolId]);

	// Dismiss persistence: one key per drift status so a re-dismiss survives a
	// status transition. The banner re-shows when the drift status changes.
	const currentDrift = status?.drift.status ?? 'enrollpro-unreachable';
	const dismissStorageKey = `${DISMISS_STORAGE_PREFIX}${currentDrift}`;

	useEffect(() => {
		if (!dismissible) {
			setDismissedKey(null);
			return;
		}
		try {
			const stored = window.localStorage.getItem(dismissStorageKey);
			setDismissedKey(stored ? dismissStorageKey : null);
		} catch {
			setDismissedKey(null);
		}
	}, [dismissible, dismissStorageKey]);

	function dismiss() {
		try {
			window.localStorage.setItem(dismissStorageKey, '1');
		} catch {
			// Ignore write failures; the in-session dismiss still applies.
		}
		setDismissedKey(dismissStorageKey);
	}

	const canApply = (status?.drift.recommendedAction === 'RUN_ROLLOVER_SYNC' && status.conflicts.length === 0) || Boolean(pendingReconfiguredIds);
	const canPreviewReset = status?.drift.status === 'mapping-conflict' || status?.canResetDummyYear;
	const isBlocking = status?.drift.status === 'atlas-stale' || status?.drift.status === 'mapping-conflict';
	const isDismissed = Boolean(dismissedKey);
	const automation = status?.automation;
	const automationHealthy = automation?.enabled && automation?.lastResult === 'success' && (automation?.consecutiveFailures ?? 0) === 0;
	const automationBackoff = automation?.enabled && (automation?.consecutiveFailures ?? 0) > 0;
	const automationDisabled = automation && !automation.enabled;
	const showManualSync = !automation?.enabled || automationBackoff || automation?.lastResult === 'failure' || automation?.lastResult === 'unreachable';
	const hasPublishedRecoveryBlocker = recoveryClassification?.blockers.some((blocker) => blocker.code === 'PUBLISHED_DATA_BLOCKED') ?? false;
	const canOfferTestDataMarking = allowTestDataMarking
		&& recoveryClassification?.classification === 'TEST_DATA_RECOVERY_BLOCKED'
		&& recoveryClassification.conflictCode === 'SECTION_ID_COLLISION'
		&& recoveryClassification.enrollProActiveYear != null
		&& !hasPublishedRecoveryBlocker;
	const icon = useMemo(() => {
		if (status?.drift.status === 'aligned') return <CheckCircle2 className="h-4 w-4" />;
		if (loading) return <Loader2 className="h-4 w-4 animate-spin" />;
		return <AlertTriangle className="h-4 w-4" />;
	}, [loading, status?.drift.status]);

	const handlePreview = async () => {
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

	const handleApply = async (acknowledgedIds?: number[]) => {
		setApplying(true);
		setError(null);
		try {
			const result = await applyRolloverSync(schoolId, {
				acknowledgeReconfiguredSectionIds: acknowledgedIds,
			});
			setStatus(result);
			setPendingReconfiguredIds(null);
			onStatus?.(result);
			onApplied?.(result);
			toast.success(`Synced ${result.enrollProActiveYear?.yearLabel ?? 'the active school year'} from EnrollPro.`);
		} catch (err: any) {
			const code = err?.response?.data?.code ?? err?.code;
			const message = err?.response?.data?.message ?? err?.message ?? 'ATLAS could not sync the new school year.';
			if (code === 'SECTION_RECONFIGURATION_REVIEW_REQUIRED') {
				const details = err?.response?.data?.details ?? err?.details;
				const unacknowledged = details?.unacknowledgedSections ?? [];
				setPendingReconfiguredIds(unacknowledged.map((s: { externalId: number }) => s.externalId));
				setError(message);
			} else {
				setError(message);
				toast.error(message);
			}
		} finally {
			setApplying(false);
		}
	};

	const handleAcknowledgeAndApply = async () => {
		if (!pendingReconfiguredIds) return;
		await handleApply(pendingReconfiguredIds);
	};

	const handleRecoveryApply = async () => {
		setRecovering(true);
		setError(null);
		try {
			const result = await applyTestYearRecovery(schoolId, {
				confirmClear: true,
				confirmationText: recoveryConfirmText,
				acknowledgePublished: recoveryAckPublished,
			});
			setShowRecoveryConfirm(false);
			setRecoveryConfirmText('');
			setRecoveryAckPublished(false);
			setRecoveryClassification(null);
			await loadStatus(true);
			toast.success('Test-year data cleared and EnrollPro sync applied.');
			onApplied?.(result.sync as RolloverStatus);
		} catch (err: any) {
			const message = err?.response?.data?.message ?? err?.message ?? 'ATLAS could not clear test-year data.';
			setError(message);
			toast.error(message);
		} finally {
			setRecovering(false);
		}
	};

	const handleMarkTestData = async () => {
		const schoolYearId = recoveryClassification?.enrollProActiveYear?.id;
		if (!schoolYearId) return;
		setMarkingTestData(true);
		setError(null);
		try {
			await markSchoolYearAsTestData(schoolId, schoolYearId);
			setShowMarkTestDataConfirm(false);
			setMarkTestDataAcknowledged(false);
			await loadStatus(true);
			toast.success(`School year #${schoolYearId} is marked as test data. Review the cleanup scope before continuing.`);
		} catch (err: any) {
			const message = err?.response?.data?.message ?? err?.message ?? 'ATLAS could not mark this school year as test data.';
			setError(message);
			toast.error(message);
		} finally {
			setMarkingTestData(false);
		}
	};

	// RR-09B: non-destructive archive-and-sync — the primary resolution for
	// real-data rollover wedges. One click, no typed confirmation phrase.
	const showArchiveFlow = allowTestDataMarking
		&& status?.drift.recommendedAction === 'RUN_ARCHIVE_AND_SYNC'
		&& status.conflicts.length > 0;

	const handleArchiveAndSync = async () => {
		setArchiving(true);
		setError(null);
		try {
			const result = await applyArchiveAndSync(schoolId);
			setArchivePreview(null);
			await loadStatus(true);
			toast.success(
				result.archivedYears.length > 0
					? `Archived ${result.archivedYears.map((year) => year.yearLabel).join(', ')} and synced ${result.enrollProActiveYear.yearLabel} from EnrollPro. History is preserved.`
					: `Synced ${result.enrollProActiveYear.yearLabel} from EnrollPro.`,
			);
			onApplied?.(result.sync);
		} catch (err: any) {
			const message = err?.response?.data?.message ?? err?.message ?? 'ATLAS could not archive the old school year.';
			setError(message);
			toast.error(message);
		} finally {
			setArchiving(false);
		}
	};

	if (!loading && !status && !error) return null;

	// Compact setup pages need a true one-row year status. The full explanatory
	// card stays available on Dashboard and /admin/year-setup.
	if (compact && !isDismissed) {
		// Setup pages already expose source health through the command-bar chip.
		// Avoid duplicating non-blocking "checking/aligned" status in the work
		// area because it pushes the first useful content below the budget.
		if (!isBlocking && !error) return null;

		return (
			<div
				className={cn(
					'flex min-h-8 items-center gap-2 rounded-xl border px-2.5 py-1 text-xs shadow-none',
					isBlocking ? 'border-amber-200 bg-amber-50/70 text-amber-800' : 'border-slate-200 bg-white/80 text-slate-700',
					status?.drift.status === 'aligned' && 'border-emerald-100 bg-emerald-50/60 text-emerald-700',
				)}
				data-testid="rollover-guidance-card"
			>
				{icon}
				<span className="shrink-0 font-bold">{loading ? 'Checking school year' : driftLabel(currentDrift, status?.drift.recommendedAction)}</span>
				<span className="min-w-0 truncate text-muted-foreground">
					{status?.drift.message ?? 'Checking EnrollPro school year status.'}
				</span>
				{canPreviewReset || isBlocking ? (
					<Button type="button" variant="ghost" size="sm" asChild className="ml-auto h-7 shrink-0 px-2 text-xs font-semibold" data-testid="rollover-banner-open-year-setup">
						<Link to={adminHref}>Year setup</Link>
					</Button>
				) : null}
				{dismissible ? (
					<TooltipProvider delayDuration={200}>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									className={cn('h-6 w-6 shrink-0', !(canPreviewReset || isBlocking) && 'ml-auto')}
									aria-label="Dismiss year status"
									onClick={dismiss}
									data-testid="rollover-banner-dismiss"
								>
									<X className="size-3.5" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="bottom" className="text-xs">Hide this status</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				) : null}
			</div>
		);
	}

	// Dismissed non-blocking banner -> render nothing. Blocking drift states
	// Blocking drift states (atlas-stale / mapping-conflict) are never
	// dismissible: they stay visible until the year status changes. The
	// dismiss action only applies to non-blocking banners.
	if (isDismissed && !isBlocking) return null;

	return (
		<>
		<Card
			className={cn(
				'border-dashed shadow-none',
				isBlocking ? 'border-amber-200 bg-amber-50/70' : 'border-slate-200 bg-white/80',
			)}
			data-testid="rollover-guidance-card"
		>
			<CardContent className={cn('flex flex-col gap-3 p-3', !compact && 'sm:flex-row sm:items-center sm:justify-between')}>
				<div className="min-w-0 space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="outline" className={cn('gap-1', DRIFT_BADGE[currentDrift])} data-testid="rollover-banner-status">
							{icon}
							{loading ? 'Checking school year' : driftLabel(currentDrift, status?.drift.recommendedAction)}
						</Badge>
						{status?.enrollProActiveYear ? (
							<Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
								EnrollPro {status.enrollProActiveYear.yearLabel}
							</Badge>
						) : null}
						{status?.counts ? (
							<Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
								{status.counts.sectionCount} sections - {status.counts.facultyCount} teachers
							</Badge>
						) : null}
						{/* Phase 0B audit fix: blocking drift states are intentionally
							not dismissible; hiding the X avoids a dead button. */}
						{dismissible && !isBlocking ? (
							<TooltipProvider delayDuration={200}>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button type="button" variant="ghost" size="icon-sm" className="ml-auto h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground" aria-label="Hide year status" onClick={dismiss} data-testid="rollover-banner-dismiss">
											<X className="size-4" />
										</Button>
									</TooltipTrigger>
									<TooltipContent side="bottom" className="text-xs">Hide this status. It returns when the year status changes.</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						) : null}
					</div>
					<p className="text-sm font-medium text-slate-900">
						{status?.drift.message ?? 'Checking EnrollPro school year status.'}
					</p>
					<p className="text-xs text-slate-600">
						{status ? driftNextStep(status.drift.status, status.drift.recommendedAction) : 'Waiting for EnrollPro school year status.'}
					</p>
				{error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
				{status?.conflicts?.length ? (
					<ul className="space-y-1 text-xs text-red-700">
						{status.conflicts.slice(0, 3).map((conflict) => (
							<li key={conflict.code}>{conflict.message}</li>
						))}
					</ul>
				) : null}
				{showArchiveFlow ? (
					<div className="space-y-2 rounded-md border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900" data-testid="rollover-archive-flow">
						<div className="flex items-center gap-1.5 font-medium">
							<Archive className="size-3.5 shrink-0" />
							<span>Archive the old school year and sync the new one</span>
						</div>
						<p>{archivePreview?.summary ?? 'EnrollPro moved to a new school year. Archive the old year as read-only history, then sync the new one. Nothing is deleted.'}</p>
						{archivePreviewLoading ? <p className="text-sky-700">Loading the archive preview...</p> : null}
						{archivePreview?.yearsToArchive.length ? (
							<ul className="ml-3 list-disc space-y-0.5 text-sky-800">
								{archivePreview.yearsToArchive.map((year) => (
									<li key={year.schoolYearId} data-testid="rollover-archive-year">
										{year.yearLabel} (#{year.schoolYearId}) — kept as history
										{year.preservedCounts ? (
											<span className="text-sky-600">
												{`: ${Object.entries(year.preservedCounts).filter(([, v]) => (v as number) > 0).map(([k, v]) => `${k}: ${v}`).join(', ')}`}
											</span>
										) : null}
									</li>
								))}
							</ul>
						) : null}
						{archivePreview?.syncPlan ? (
							<p className="text-sky-700">Then: {archivePreview.syncPlan}</p>
						) : null}
						<Button type="button" size="sm" onClick={() => void handleArchiveAndSync()} disabled={archiving || previewing || applying} data-testid="rollover-archive-and-sync">
							{archiving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
							Archive and sync
						</Button>
					</div>
				) : null}
				{recoveryClassification?.classification === 'TEST_DATA_RECOVERY_AVAILABLE' ? (
					<div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
						<p className="font-medium">{recoveryClassification.message}</p>
						{recoveryClassification.artifactCounts ? (
							<ul className="ml-3 list-disc space-y-0.5 text-amber-700">
								{Object.entries(recoveryClassification.artifactCounts).filter(([, v]) => (v as number) > 0).map(([key, count]) => (
									<li key={key}>{key}: {String(count)}</li>
								))}
							</ul>
						) : null}
						{recoveryClassification.blockers.length > 0 ? (
							<ul className="ml-3 list-disc space-y-0.5 text-amber-700">
								{recoveryClassification.blockers.map((b) => (
									<li key={b.code}>{b.message}</li>
								))}
							</ul>
						) : null}
						<Button type="button" size="sm" variant="outline" onClick={() => setShowRecoveryConfirm(true)} data-testid="rollover-banner-clear-test-data">
							Clear test data and sync EnrollPro
						</Button>
					</div>
				) : null}
				{canOfferTestDataMarking ? (
					<div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
						<p className="font-medium">{recoveryClassification.message}</p>
						<p>Mark only a disposable test year. Marking enables a separate review before any data is cleared.</p>
						<Button type="button" size="sm" variant="outline" onClick={() => setShowMarkTestDataConfirm(true)} data-testid="rollover-banner-mark-test-data">
							Mark as test data
						</Button>
					</div>
				) : null}
				{status?.reconfiguredSections?.length ? (
					<div className="space-y-1 text-xs text-amber-700">
						<p className="font-medium">{status.reconfiguredSections.length} section(s) changed name, grade, or program since the last sync:</p>
						<ul className="ml-3 list-disc space-y-0.5">
							{status.reconfiguredSections.slice(0, 5).map((s) => (
								<li key={s.externalId}>
									{s.sectionName}: {s.previousName !== s.newName ? `name "${s.previousName}" → "${s.newName}"` : ''}
									{s.previousGradeLevelId !== s.newGradeLevelId ? ` grade ${s.previousGradeLevelId} → ${s.newGradeLevelId}` : ''}
									{s.previousProgramType !== s.newProgramType ? ` program ${s.previousProgramType} → ${s.newProgramType}` : ''}
								</li>
							))}
						</ul>
						{status.reconfiguredSections.length > 5 ? (
							<p className="text-muted-foreground">...and {status.reconfiguredSections.length - 5} more</p>
						) : null}
					</div>
				) : null}
				{automation?.enabled ? (
					<p className="text-xs text-slate-500">
						{automationHealthy
							? `Automatic year sync is on. Last checked ${automation.lastAttemptAt ? new Date(automation.lastAttemptAt).toLocaleString() : 'never'}.`
							: automationBackoff
								? `Automatic retry is waiting until ${automation.nextAttemptAt ? new Date(automation.nextAttemptAt).toLocaleString() : 'soon'} after ${automation.consecutiveFailures} failed attempt(s).`
								: `Automatic year sync is running.`}
					</p>
				) : automationDisabled ? (
					<p className="text-xs text-slate-500">Automatic year sync is off. Sync stays manual.</p>
				) : null}
				</div>
				<div className="flex shrink-0 flex-wrap items-center gap-2">
					<Button type="button" variant="outline" size="sm" onClick={() => void handlePreview()} disabled={previewing || applying}>
						{previewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
						Preview
					</Button>
					{pendingReconfiguredIds ? (
						<Button type="button" size="sm" onClick={() => void handleAcknowledgeAndApply()} disabled={previewing || applying} data-testid="rollover-banner-acknowledge-and-sync">
							{applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
							Acknowledge &amp; Sync
						</Button>
					) : (showManualSync && canApply && !canPreviewReset) || (canApply && !canPreviewReset && !automation?.enabled) ? (
						<Button type="button" size="sm" onClick={() => void handleApply()} disabled={previewing || applying} data-testid="rollover-banner-sync">
							{applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
							Sync now
						</Button>
					) : canApply && !canPreviewReset ? (
						<Button type="button" size="sm" onClick={() => void handleApply()} disabled={previewing || applying} data-testid="rollover-banner-sync">
							{applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
							Sync now
						</Button>
					) : null}
					{/* Destructive reset is intentionally NOT exposed here. The "Open year setup" link routes to /admin/year-setup where the reset lives. */}
					{canPreviewReset ? (
						<Button type="button" variant="outline" size="sm" asChild data-testid="rollover-banner-open-year-setup">
							<Link to={adminHref}>Open year setup</Link>
						</Button>
					) : (
						<Button type="button" variant="ghost" size="sm" asChild className="text-muted-foreground">
							<Link to={adminHref}>Year setup</Link>
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
		<Dialog open={showRecoveryConfirm} onOpenChange={(open) => {
			setShowRecoveryConfirm(open);
			if (!open) {
				setRecoveryConfirmText('');
				setRecoveryAckPublished(false);
			}
		}}>
			<DialogContent className="w-[calc(100%-2rem)] sm:max-w-md" hideClose={recovering}>
				<DialogHeader>
					<DialogTitle>Clear test data and sync EnrollPro</DialogTitle>
					<DialogDescription>
						This will delete ATLAS-owned data for school year #{recoveryClassification?.enrollProActiveYear?.id} and re-sync from EnrollPro. This action cannot be undone.
					</DialogDescription>
				</DialogHeader>
				{recoveryClassification?.publishedResetBlocked ? (
					<div className="flex items-start gap-2 text-sm text-amber-700">
						<Checkbox id="recovery-ack-published" checked={recoveryAckPublished} onCheckedChange={(checked) => setRecoveryAckPublished(checked === true)} disabled={recovering} />
						<Label htmlFor="recovery-ack-published" className="leading-5">I acknowledge that published schedule artifacts exist for this school year and will be cleared.</Label>
					</div>
				) : null}
				<div className="space-y-2">
					<Label htmlFor="recovery-confirmation">Type <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{recoveryClassification?.confirmationText}</code> to confirm</Label>
					<Input id="recovery-confirmation" value={recoveryConfirmText} onChange={(event) => setRecoveryConfirmText(event.target.value)} placeholder={recoveryClassification?.confirmationText ?? ''} disabled={recovering} autoComplete="off" />
				</div>
				<DialogFooter>
					<Button type="button" variant="outline" size="sm" onClick={() => setShowRecoveryConfirm(false)} disabled={recovering}>Cancel</Button>
					<Button type="button" size="sm" onClick={() => void handleRecoveryApply()} disabled={recovering || recoveryConfirmText !== recoveryClassification?.confirmationText || (Boolean(recoveryClassification?.publishedResetBlocked) && !recoveryAckPublished)} data-testid="recovery-confirm-apply">
						{recovering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
						Clear and sync
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
		<Dialog open={showMarkTestDataConfirm} onOpenChange={(open) => {
			setShowMarkTestDataConfirm(open);
			if (!open) setMarkTestDataAcknowledged(false);
		}}>
			<DialogContent className="w-[calc(100%-2rem)] sm:max-w-md" hideClose={markingTestData}>
				<DialogHeader>
					<DialogTitle>Mark school year as test data</DialogTitle>
					<DialogDescription>
						Mark school year #{recoveryClassification?.enrollProActiveYear?.id} only when its ATLAS data is disposable test data. This enables a separate cleanup review; it does not clear anything now.
					</DialogDescription>
				</DialogHeader>
				<div className="flex items-start gap-2 text-sm text-amber-700">
					<Checkbox id="mark-test-data-confirmation" checked={markTestDataAcknowledged} onCheckedChange={(checked) => setMarkTestDataAcknowledged(checked === true)} disabled={markingTestData} />
					<Label htmlFor="mark-test-data-confirmation" className="leading-5">I confirm that this school year contains only disposable test data.</Label>
				</div>
				<DialogFooter>
					<Button type="button" variant="outline" size="sm" onClick={() => setShowMarkTestDataConfirm(false)} disabled={markingTestData}>Cancel</Button>
					<Button type="button" size="sm" onClick={() => void handleMarkTestData()} disabled={markingTestData || !markTestDataAcknowledged} data-testid="rollover-mark-test-data-confirm">
						{markingTestData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
						Mark test data
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
		</>
	);
}
