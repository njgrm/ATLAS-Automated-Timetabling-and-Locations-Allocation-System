import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';

import {
	applyRolloverSync,
	fetchRolloverStatus,
	previewRolloverSync,
	type RolloverStatus,
} from '@/lib/settings';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
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
function driftLabel(status: string): string {
	switch (status) {
		case 'aligned': return 'Year aligned';
		case 'atlas-stale': return 'New year needs setup';
		case 'mapping-conflict': return "Old year's data needs clearing";
		case 'enrollpro-unreachable': return "Can't reach EnrollPro right now";
		default: return 'School year check';
	}
}

/** Drift status -> plain-language next step shown in the banner body. */
function driftNextStep(status: string): string {
	switch (status) {
		case 'atlas-stale': return 'Open year setup to sync from EnrollPro, then review sections and Teaching Load.';
		case 'mapping-conflict': return 'Open year setup to clear the old year, then sync the new school year from EnrollPro.';
		case 'enrollpro-unreachable': return 'ATLAS could not reach EnrollPro. Try again, or ask your IT admin.';
		default: return 'EnrollPro remains the source for the active school year; ATLAS keeps schedules, policies, and Teaching Load locally.';
	}
}

export function RolloverGuidanceCard({
	schoolId = 1,
	compact = false,
	dismissible = true,
	adminHref = '/admin/year-setup',
	onApplied,
	onStatus,
}: RolloverGuidanceCardProps) {
	const [status, setStatus] = useState<RolloverStatus | null>(null);
	const [loading, setLoading] = useState(true);
	const [previewing, setPreviewing] = useState(false);
	const [applying, setApplying] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [dismissedKey, setDismissedKey] = useState<string | null>(null);

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

	const canApply = status?.drift.recommendedAction === 'RUN_ROLLOVER_SYNC' && status.conflicts.length === 0;
	const canPreviewReset = status?.drift.status === 'mapping-conflict' || status?.canResetDummyYear;
	const isBlocking = status?.drift.status === 'atlas-stale' || status?.drift.status === 'mapping-conflict';
	const isDismissed = Boolean(dismissedKey);
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

	const handleApply = async () => {
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
				<span className="shrink-0 font-bold">{loading ? 'Checking school year' : driftLabel(currentDrift)}</span>
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
							{loading ? 'Checking school year' : driftLabel(currentDrift)}
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
						{status ? driftNextStep(status.drift.status) : 'Waiting for EnrollPro school year status.'}
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
				<div className="flex shrink-0 flex-wrap items-center gap-2">
					<Button type="button" variant="outline" size="sm" onClick={() => void handlePreview()} disabled={previewing || applying}>
						{previewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
						Preview
					</Button>
					{canApply && !canPreviewReset ? (
						<Button type="button" size="sm" onClick={() => void handleApply()} disabled={previewing || applying} data-testid="rollover-banner-sync">
							{applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
							Sync from EnrollPro
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
	);
}
